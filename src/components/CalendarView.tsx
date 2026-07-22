import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import type { DateSelectArg, EventClickArg } from '@fullcalendar/core';
import TimeEntryModal from './TimeEntryModal';
import './CalendarView.css';

interface CalendarEvent {
    id: string;
    title: string;
    start?: string;
    end?: string;
    backgroundColor?: string;
    borderColor?: string;
    textColor?: string;
    display?: string;
    classNames?: string[];
    daysOfWeek?: number[];
    startTime?: string;
    endTime?: string;
    editable?: boolean;
    selectable?: boolean;
    extendedProps?: CalendarExtendedProps;
}

interface CalendarExtendedProps {
    source?: 'redmine' | 'outlook';
    projectId?: number;
    issueId?: number;
    activityId?: number;
    comments?: string;
    hours?: number;
    startTime?: string;
    endTime?: string;
    rdFunctionTeam?: string;
    outlookEventId?: string;
    outlookSubject?: string;
    loggedEntryId?: number;
    location?: string;
    organizer?: string;
}

interface RedmineEntry {
    id: number;
    project?: string;
    project_id?: number;
    issue?: number;
    activity_id?: number;
    comments?: string;
    hours: number;
    spent_on: string;
    start_time?: string;
    end_time?: string;
}

interface OutlookCalendarEvent {
    id: string;
    subject: string;
    start: string;
    end: string;
    start_time: string;
    hours: number;
    duration_minutes: number;
    all_day: boolean;
    location?: string;
    organizer?: string;
    logged_entry_id?: number;
    mapping?: {
        project_id?: number;
        issue_id?: number;
        activity_id?: number;
        rd_function_team?: string;
        comments?: string;
    };
}

const backgroundEvents: CalendarEvent[] = [
    {
        id: 'lunch-block', title: 'Lunch Break', daysOfWeek: [1, 2, 3, 4, 5], startTime: '12:00',
        endTime: '13:00', display: 'background', backgroundColor: 'transparent', classNames: ['lunch-break'],
        editable: false, selectable: false
    },
    {
        id: 'morning-gray', title: '', daysOfWeek: [1, 2, 3, 4, 5], startTime: '06:00', endTime: '07:30',
        display: 'background', backgroundColor: 'transparent', classNames: ['gray-out-time'], editable: false, selectable: false
    },
    {
        id: 'evening-gray', title: '', daysOfWeek: [1, 2, 3, 4, 5], startTime: '18:30', endTime: '21:00',
        display: 'background', backgroundColor: 'transparent', classNames: ['gray-out-time'], editable: false, selectable: false
    }
];

const dateOnly = (value: Date) => {
    const local = new Date(value.getTime() - value.getTimezoneOffset() * 60000);
    return local.toISOString().split('T')[0];
};

const endTimeFromWorkingHours = (startTime: string, hours: number) => {
    const [startHour, startMinute] = startTime.split(':').map(Number);
    let cursor = startHour * 60 + startMinute;
    let remaining = Math.max(0, Number(hours) * 60);
    if (cursor >= 12 * 60 && cursor < 13 * 60) cursor = 13 * 60;
    if (cursor < 12 * 60 && cursor + remaining > 12 * 60) {
        remaining -= 12 * 60 - cursor;
        cursor = 13 * 60;
    }
    const endMinutes = Math.max(0, Math.min(1439, Math.round(cursor + remaining)));
    return `${String(Math.floor(endMinutes / 60)).padStart(2, '0')}:${String(endMinutes % 60).padStart(2, '0')}`;
};

const CalendarView = () => {
    const [events, setEvents] = useState<CalendarEvent[]>(backgroundEvents);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedDate, setSelectedDate] = useState('');
    const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
    const [slotMinTime, setSlotMinTime] = useState('06:00:00');
    const [slotMaxTime, setSlotMaxTime] = useState('21:00:00');
    const [outlookError, setOutlookError] = useState('');
    const [loading, setLoading] = useState(false);
    const calendarRef = useRef<FullCalendar>(null);
    const visibleRange = useRef<{ from: string; to: string } | null>(null);
    const calendarRequestId = useRef(0);

    useEffect(() => {
        fetch('http://127.0.0.1:8000/api/settings')
            .then(res => res.json())
            .then(data => {
                if (data.calendar_start_time) setSlotMinTime(`${data.calendar_start_time}:00`);
                if (data.calendar_end_time) setSlotMaxTime(`${data.calendar_end_time}:00`);
            })
            .catch(console.error);
    }, []);

    const mapRedmineEntries = (entries: RedmineEntry[]): CalendarEvent[] => entries.map(entry => {
        const startTime = entry.start_time || '09:00';
        const endTime = entry.end_time || endTimeFromWorkingHours(startTime, entry.hours);
        return {
            id: String(entry.id),
            title: `${entry.hours}h · ${entry.comments || entry.project}`,
            start: `${entry.spent_on}T${startTime}`,
            end: `${entry.spent_on}T${endTime}`,
            backgroundColor: 'rgba(59, 130, 246, 0.68)',
            borderColor: 'rgba(96, 165, 250, 0.9)',
            textColor: '#fff',
            classNames: ['glass-event'],
            extendedProps: {
                source: 'redmine', projectId: entry.project_id, issueId: entry.issue,
                activityId: entry.activity_id, comments: entry.comments, hours: entry.hours,
                startTime, endTime
            }
        };
    });

    const mapOutlookEvents = (outlookEvents: OutlookCalendarEvent[]): CalendarEvent[] => outlookEvents
        .filter(event => !event.all_day && event.duration_minutes > 0)
        .map(event => {
            const mapping = event.mapping;
            const logged = Boolean(event.logged_entry_id);
            return {
                id: `outlook-${event.id}`,
                title: `${logged ? '✓ ' : 'Outlook · '}${event.subject}`,
                start: event.start,
                end: event.end,
                backgroundColor: logged ? 'rgba(34, 197, 94, 0.23)' : mapping ? 'rgba(139, 92, 246, 0.52)' : 'rgba(245, 158, 11, 0.30)',
                borderColor: logged ? '#22c55e' : mapping ? '#a78bfa' : '#f59e0b',
                textColor: '#fff',
                classNames: ['outlook-event', mapping ? 'outlook-mapped' : 'outlook-unmapped'],
                extendedProps: {
                    source: 'outlook', outlookEventId: event.id, outlookSubject: event.subject,
                    loggedEntryId: event.logged_entry_id, projectId: mapping?.project_id,
                    issueId: mapping?.issue_id, activityId: mapping?.activity_id || 9,
                    rdFunctionTeam: 'SW_OS/BSP',
                    comments: mapping?.comments || event.subject, hours: event.hours,
                    startTime: event.start_time, endTime: event.end.split('T')[1]?.substring(0, 5),
                    location: event.location, organizer: event.organizer
                }
            };
        });

    const fetchCalendarData = async (from: string, to: string, forceRefresh = true) => {
        const requestId = ++calendarRequestId.current;
        setLoading(true);
        try {
            const [redmineResult, outlookResult] = await Promise.allSettled([
                fetch(`http://127.0.0.1:8000/api/redmine/time_entries?from_date=${from}&to_date=${to}&refresh=${forceRefresh}`).then(res => res.json()),
                fetch(`http://127.0.0.1:8000/api/outlook/events?from_date=${from}&to_date=${to}`).then(res => res.json())
            ]);

            if (requestId !== calendarRequestId.current) return;

            const redmineData = redmineResult.status === 'fulfilled' && Array.isArray(redmineResult.value) ? redmineResult.value : [];
            let outlookData: OutlookCalendarEvent[] = [];
            if (outlookResult.status === 'fulfilled' && Array.isArray(outlookResult.value)) {
                outlookData = outlookResult.value as OutlookCalendarEvent[];
                setOutlookError('');
            } else {
                const reason = outlookResult.status === 'fulfilled'
                    ? (outlookResult.value as { error?: string })?.error
                    : '';
                setOutlookError(reason || '目前無法讀取 Outlook 行事曆。');
            }
            setEvents([
                ...mapRedmineEntries(redmineData as RedmineEntry[]),
                ...mapOutlookEvents(outlookData),
                ...backgroundEvents
            ]);
        } finally {
            if (requestId === calendarRequestId.current) setLoading(false);
        }
    };

    const refreshVisibleRange = () => {
        if (visibleRange.current) fetchCalendarData(visibleRange.current.from, visibleRange.current.to);
    };

    const handleDateSelect = (selectInfo: DateSelectArg) => {
        const start = selectInfo.start as Date;
        const end = selectInfo.end as Date;
        let diffMs = end.getTime() - start.getTime();
        const lunchStart = new Date(start); lunchStart.setHours(12, 0, 0, 0);
        const lunchEnd = new Date(start); lunchEnd.setHours(13, 0, 0, 0);
        const overlapStart = start > lunchStart ? start : lunchStart;
        const overlapEnd = end < lunchEnd ? end : lunchEnd;
        if (overlapStart < overlapEnd) diffMs -= overlapEnd.getTime() - overlapStart.getTime();
        const startTime = selectInfo.startStr.split('T')[1].substring(0, 5);
        const endTime = selectInfo.endStr.split('T')[1].substring(0, 5);
        setSelectedDate(selectInfo.startStr.split('T')[0]);
        setSelectedEvent({ id: '', title: '', start: selectInfo.startStr, extendedProps: {
            hours: Number((diffMs / 3600000).toFixed(2)), startTime, endTime
        }});
        setIsModalOpen(true);
    };

    const handleEventClick = (clickInfo: EventClickArg) => {
        const clicked = clickInfo.event;
        if (clicked.display === 'background') return;
        const props = clicked.extendedProps as CalendarExtendedProps;
        if (props.source === 'outlook' && props.loggedEntryId) {
            const redmineEvent = events.find(event => event.id === String(props.loggedEntryId));
            if (!redmineEvent) return;
            setSelectedEvent(redmineEvent);
            setSelectedDate((redmineEvent.start || '').split('T')[0]);
        } else {
            setSelectedDate(clicked.startStr.split('T')[0]);
            setSelectedEvent({ id: clicked.id, title: clicked.title, start: clicked.startStr, extendedProps: props });
        }
        setIsModalOpen(true);
    };

    return (
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column', maxWidth: '1200px', margin: '0 auto', padding: '20px', boxSizing: 'border-box', color: 'white' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', gap: '16px' }}>
                <div>
                    <h2 style={{ margin: 0, fontSize: '1.8em', background: 'var(--accent-gradient)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Calendar</h2>
                    <div style={{ fontSize: '0.88em', color: 'var(--text-secondary)', marginTop: '4px' }}>
                        藍色為 Redmine 工時，紫色為已對應會議，黃色為待設定會議
                    </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {loading && <span style={{ fontSize: '0.82em', color: 'var(--text-secondary)' }}>同步中…</span>}
                    <button onClick={refreshVisibleRange} style={{ padding: '8px 12px' }}>↻ 更新</button>
                    <Link to="/outlook" style={{ color: 'white', textDecoration: 'none', background: 'var(--accent-gradient)', padding: '9px 13px', borderRadius: '10px', fontWeight: 600 }}>
                        Outlook 對應
                    </Link>
                </div>
            </div>

            {outlookError && (
                <div style={{ padding: '9px 12px', marginBottom: '10px', borderRadius: '8px', color: '#fcd34d', background: 'rgba(245,158,11,0.10)', border: '1px solid rgba(245,158,11,0.25)', fontSize: '0.82em' }}>
                    Outlook：{outlookError}
                </div>
            )}

            <div className="glass-panel" style={{ flex: 1, padding: '10px', overflow: 'hidden', display: 'flex', flexDirection: 'column', background: '#0f0f14', border: 'none', borderRadius: '12px' }}>
                <FullCalendar
                    ref={calendarRef}
                    plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
                    initialView="timeGridWeek"
                    scrollTime="09:00:00"
                    headerToolbar={{ left: 'prev,next today', center: 'title', right: 'dayGridMonth,timeGridWeek' }}
                    events={events}
                    datesSet={info => {
                        const endInclusive = new Date(info.end.getTime() - 86400000);
                        const range = { from: dateOnly(info.start), to: dateOnly(endInclusive) };
                        visibleRange.current = range;
                        fetchCalendarData(range.from, range.to);
                    }}
                    selectable
                    selectMirror
                    select={handleDateSelect}
                    eventClick={handleEventClick}
                    height="100%"
                    handleWindowResize
                    expandRows
                    stickyHeaderDates
                    dayMaxEvents
                    weekends={false}
                    slotMinTime={slotMinTime}
                    slotMaxTime={slotMaxTime}
                    allDaySlot={false}
                    slotDuration="00:30:00"
                    slotLabelInterval="01:00"
                    nowIndicator
                />
                {isModalOpen && (
                    <TimeEntryModal isOpen={isModalOpen} onClose={() => { setIsModalOpen(false); setSelectedEvent(null); }}
                        onSave={() => { setIsModalOpen(false); refreshVisibleRange(); }} initialDate={selectedDate}
                        existingEntry={selectedEvent} initialStartTime={selectedEvent?.extendedProps?.startTime}
                        initialEndTime={selectedEvent?.extendedProps?.endTime} />
                )}
            </div>
        </div>
    );
};

export default CalendarView;
