"""Windows Outlook calendar adapter.

The adapter deliberately keeps Outlook/COM details outside the FastAPI module so
the backend can still start on machines without classic Outlook or pywin32.
"""

from __future__ import annotations

from datetime import datetime, timedelta
from hashlib import sha256
from typing import Any


class OutlookCalendarError(RuntimeError):
    """A user-facing Outlook integration error."""


def _com_datetime(value: datetime) -> str:
    # Outlook Restrict expects a US-style date string, regardless of the Python
    # process locale. Use a 12-hour clock to avoid ambiguous filtering.
    return value.strftime("%m/%d/%Y %I:%M %p")


def _safe_text(value: Any) -> str:
    return str(value or "").strip()


def read_default_calendar(from_date: str, to_date: str) -> list[dict[str, Any]]:
    """Read occurrences from the signed-in user's default Outlook calendar.

    ``to_date`` is inclusive. Recurring meetings are expanded by Outlook and a
    stable occurrence id is derived from the global appointment id and start.
    """

    try:
        import pythoncom  # type: ignore
        import win32com.client  # type: ignore
    except ImportError as exc:
        raise OutlookCalendarError(
            "Outlook integration requires pywin32. Reinstall or update the desktop app."
        ) from exc

    try:
        range_start = datetime.strptime(from_date, "%Y-%m-%d")
        range_end = datetime.strptime(to_date, "%Y-%m-%d") + timedelta(days=1)
    except ValueError as exc:
        raise OutlookCalendarError("Dates must use YYYY-MM-DD format.") from exc

    if range_end <= range_start:
        raise OutlookCalendarError("The calendar end date must not be before the start date.")
    if (range_end - range_start).days > 93:
        raise OutlookCalendarError("Outlook calendar reads are limited to 93 days at a time.")

    pythoncom.CoInitialize()
    try:
        outlook = win32com.client.Dispatch("Outlook.Application")
        namespace = outlook.GetNamespace("MAPI")
        # 9 = olFolderCalendar
        calendar = namespace.GetDefaultFolder(9)
        items = calendar.Items
        items.Sort("[Start]")
        items.IncludeRecurrences = True
        restriction = (
            f"[Start] >= '{_com_datetime(range_start)}' AND "
            f"[Start] < '{_com_datetime(range_end)}'"
        )
        appointments = items.Restrict(restriction)

        events: list[dict[str, Any]] = []
        for appointment in appointments:
            # Outlook may expose non-appointment items in custom calendar folders.
            try:
                start = appointment.Start
                end = appointment.End
            except Exception:
                continue

            # COM datetime values support strftime and are local-time values.
            start_iso = start.strftime("%Y-%m-%dT%H:%M:%S")
            end_iso = end.strftime("%Y-%m-%dT%H:%M:%S")
            global_id = _safe_text(getattr(appointment, "GlobalAppointmentID", ""))
            entry_id = _safe_text(getattr(appointment, "EntryID", ""))
            occurrence_key = f"{global_id or entry_id}|{start_iso}"
            event_id = sha256(occurrence_key.encode("utf-8")).hexdigest()[:32]
            duration_minutes = max(0, int(round((end - start).total_seconds() / 60)))

            events.append(
                {
                    "id": event_id,
                    "subject": _safe_text(getattr(appointment, "Subject", "")) or "(No title)",
                    "start": start_iso,
                    "end": end_iso,
                    "date": start.strftime("%Y-%m-%d"),
                    "start_time": start.strftime("%H:%M"),
                    "duration_minutes": duration_minutes,
                    "hours": round(duration_minutes / 60, 2),
                    "location": _safe_text(getattr(appointment, "Location", "")),
                    "organizer": _safe_text(getattr(appointment, "Organizer", "")),
                    "all_day": bool(getattr(appointment, "AllDayEvent", False)),
                    "busy_status": int(getattr(appointment, "BusyStatus", 0) or 0),
                }
            )

        return events
    except OutlookCalendarError:
        raise
    except Exception as exc:
        message = str(exc).strip() or exc.__class__.__name__
        raise OutlookCalendarError(
            "Could not read Outlook. Make sure classic Outlook is installed, running, "
            f"and a calendar profile is signed in. Details: {message}"
        ) from exc
    finally:
        pythoncom.CoUninitialize()


def match_mapping(subject: str, mappings: list[dict[str, Any]]) -> dict[str, Any] | None:
    """Return the most specific enabled title mapping for an Outlook subject."""

    normalized_subject = subject.casefold().strip()
    candidates = []
    for mapping in mappings:
        pattern = _safe_text(mapping.get("title_pattern"))
        if not mapping.get("enabled", True) or not pattern:
            continue
        match_type = mapping.get("match_type", "contains")
        normalized_pattern = pattern.casefold()
        matched = (
            normalized_subject == normalized_pattern
            if match_type == "exact"
            else normalized_pattern in normalized_subject
        )
        if matched:
            candidates.append((len(normalized_pattern), mapping))

    if not candidates:
        return None
    candidates.sort(key=lambda item: item[0], reverse=True)
    return candidates[0][1]
