# Redmine Tracker UX & Architecture Notes

## Product direction

The primary workflow is now **Calendar → confirm context → log**. A user should not
need to visit Redmine or a separate profile screen for ordinary worklog entry.

### Happy paths

1. Outlook meetings appear automatically in Calendar.
2. A saved title rule pre-fills the Redmine project, issue, activity, team, and comment.
3. The user clicks a meeting and saves, or selects several mapped meetings on the
   Outlook Import page and logs them as a batch.
4. For non-meeting work, Log Time offers the same project selector plus either an
   existing issue or a new issue name. A new issue and its worklog are created in one action.
5. At the configured time, the background Electron process checks live Redmine totals.
   It shows a desktop-top warning only when the daily target is missing, and on Friday
   also checks the weekly target.

The Log Time project picker shows favorite projects first and remembers the last selected
project. The full project list is one click away, avoiding a permanently oversized form.
Inline Issue creation exposes the four server-required custom fields only in the new-Issue
path; ordinary worklog entry remains compact. `RD Function Team` is enforced as
`SW_OS/BSP` in the backend rather than trusting a UI value.

## Important architecture decisions

### Outlook stays local

Classic Outlook is read through Windows COM (`pywin32`). Meeting content does not pass
through a cloud integration or require a second OAuth flow. The adapter is isolated in
`backend/outlook_calendar.py`, so Outlook failures do not prevent the rest of the app
from starting. New Outlook for Windows does not expose this COM model; a future Microsoft
Graph adapter can implement the same normalized event contract.

### Mapping is deterministic

Mappings are stored in local settings. Matching is case-insensitive, supports `contains`
and `exact`, and chooses the longest matching title pattern. This lets a general rule such
as `Weekly` coexist with a more specific `Platform Weekly` rule without surprising results.

### Meeting logging is idempotent

Each occurrence receives a stable local identifier derived from Outlook's global
appointment ID and occurrence start time. Successful worklogs are linked in
`outlook_log_history.json`. Repeated clicks cannot create duplicates. Deleting the linked
Redmine time entry removes that local link so the occurrence can intentionally be logged again.

### Reminder logic belongs to the desktop process

Reminder scheduling runs in Electron rather than a React page. It therefore continues
when the main window is hidden in the system tray. The reminder asks the backend for a
fresh Redmine Monday-to-date summary and falls back to the local cache only if Redmine is
unavailable. The warning window is separate from the main app and uses Windows' topmost level.

## UX states that must remain explicit

- Outlook meeting: mapped, unmapped, or already logged.
- Worklog save: idle, creating issue, writing time, complete, or failed.
- Batch import: per-meeting success/failure; a partial failure must never hide successes.
- Data freshness: live Redmine versus cached data, especially for reminder decisions.
- Outlook compatibility: classic Outlook available versus COM unavailable.

## Recommended next improvements

1. **Credential protection:** move the Redmine API key from YAML into Windows Credential
   Manager/DPAPI and leave only a credential reference in settings.
2. **Redmine metadata:** fetch required trackers and custom fields per project instead of
   relying on the current first-tracker fallback and hard-coded custom field ID `93`.
3. **Retry queue:** retain failed worklog requests locally with a user-visible retry action;
   never silently auto-retry a request whose server outcome is unknown.
4. **New Outlook support:** add a Microsoft Graph adapter behind the same event interface,
   with explicit tenant consent and an account selector.
5. **Calendar policy:** allow users to exclude cancelled, private, declined, tentative, or
   all-day events and optionally round meeting duration to a configurable increment.
6. **Workday policy:** add holiday/leave calendars and configurable workdays so 8/40-hour
   reminders do not fire on approved leave.
7. **Accessibility:** replace emoji-only navigation with icon + text in wider layouts,
   add a compact mode, and complete keyboard/focus testing for all modal actions.

## Data ownership

All mappings, cache files, Outlook-to-Redmine links, and task plans remain under
`%APPDATA%\RedmineTracker`. Outlook is read-only. Redmine is mutated only after an explicit
save/batch-log action, except the pre-existing opt-in Planner auto-log feature.

## Runtime port coordination

Electron probes `127.0.0.1:8000-8099`, starts its Python child on the first available
port (or an OS-assigned port when that range is full), waits for that exact backend to become healthy, and passes the selected port to the
renderer. The renderer remaps API requests to that origin, while reminder checks use the
same port directly. An older Tracker or another service occupying port 8000 therefore
cannot prevent startup or accidentally receive requests from the new window.
In development, Electron also starts Vite itself and selects an available frontend port,
so an occupied `5173` cannot redirect the window to an unrelated development server.
