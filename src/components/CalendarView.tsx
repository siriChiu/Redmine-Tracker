import { useState, useEffect, useRef } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import TimeEntryModal from './TimeEntryModal';
import './CalendarView.css';

interface CalendarEvent {
    id: string;
    title: string;
    start?: string;
    end?: string;
    backgroundColor?: string;
    borderColor?: string;
    display?: string;
    classNames?: string[];
    daysOfWeek?: number[];
    startTime?: string;
    endTime?: string;
    extendedProps?: {
        projectId?: number;
        issueId?: number;
        activityId?: number;
        comments?: string;
        hours?: number;
        startTime?: string; // Add startTime
    };
}

const CalendarView = () => {
    const [events, setEvents] = useState<CalendarEvent[]>([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedDate, setSelectedDate] = useState<string>('');
    const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
    const calendarRef = useRef<FullCalendar>(null);
    const [slotMinTime, setSlotMinTime] = useState('06:00:00');
    const [slotMaxTime, setSlotMaxTime] = useState('21:00:00');

    // Default start time for tasks without specific time
    const DEFAULT_START_TIME = '09:00:00';

    useEffect(() => {
        fetchTimeEntries();
        fetchSettings();
    }, []);

    const fetchSettings = () => {
        fetch('http://127.0.0.1:8000/api/settings')
            .then(res => res.json())
            .then(data => {
                if (data.calendar_start_time) setSlotMinTime(data.calendar_start_time + ':00');
                if (data.calendar_end_time) setSlotMaxTime(data.calendar_end_time + ':00');
            })
            .catch(console.error);
    };

    const fetchTimeEntries = () => {
        // Fetch last 3 months to cover the view
        const today = new Date();
        const fromDate = new Date(today.getFullYear(), today.getMonth() - 1, 1).toISOString().split('T')[0];
        const toDate = new Date(today.getFullYear(), today.getMonth() + 2, 0).toISOString().split('T')[0];

        fetch(`http://127.0.0.1:8000/api/redmine/time_entries?from_date=${fromDate}&to_date=${toDate}`)
            .then(res => res.json())
            .then(data => {
                if (Array.isArray(data)) {
                    const mappedEvents = data.map((entry: any) => {
                        // Calculate end time based on hours
                        // Use stored start_time if available, otherwise default
                        const startTimeStr = entry.start_time || DEFAULT_START_TIME;
                        const startDate = new Date(`${entry.spent_on}T${startTimeStr}`);

                        // Initial end date based purely on hours
                        let endDate = new Date(startDate.getTime() + (entry.hours * 60 * 60 * 1000));

                        // Visual Adjustment: Skip Lunch Break (12:00 - 13:00)
                        // If the task starts before 12:00 and ends after 12:00, extend by 1 hour
                        // to visually represent the gap.
                        const lunchStart = new Date(startDate);
                        lunchStart.setHours(12, 0, 0, 0);

                        if (startDate < lunchStart && endDate > lunchStart) {
                            endDate = new Date(endDate.getTime() + (60 * 60 * 1000)); // Add 1 hour
                        }

                        // Format HH:MM
                        const formatTime = (date: Date) => {
                            return date.toTimeString().substring(0, 5);
                        };

                        return {
                            id: entry.id.toString(),
                            title: `${entry.hours}h - ${entry.comments || entry.project}`,
                            start: `${entry.spent_on}T${startTimeStr}`,
                            end: `${entry.spent_on}T${formatTime(endDate)}`,
                            backgroundColor: 'rgba(59, 130, 246, 0.6)', // Glassy blue
                            borderColor: 'rgba(59, 130, 246, 0.8)',
                            textColor: '#ffffff',
                            classNames: ['glass-event'],
                            extendedProps: {
                                projectId: entry.project_id,
                                issueId: entry.issue,
                                activityId: entry.activity_id,
                                comments: entry.comments,
                                hours: entry.hours,
                                startTime: entry.start_time // Pass to extendedProps
                            }
                        };
                    });

                    // Background events for special time ranges
                    const backgroundEvents = [
                        // Lunch: 12:00 PM - 1:00 PM
                        {
                            id: 'lunch-block',
                            daysOfWeek: [1, 2, 3, 4, 5], // Mon-Fri
                            startTime: '12:00',
                            endTime: '13:00',
                            display: 'background',
                            backgroundColor: 'transparent',
                            classNames: ['lunch-break'],
                            title: 'Lunch Break',
                            editable: false,
                            selectable: false
                        },
                        // Morning gray: 6:00 AM - 7:30 AM
                        {
                            id: 'morning-gray',
                            daysOfWeek: [1, 2, 3, 4, 5],
                            startTime: '06:00',
                            endTime: '07:30',
                            display: 'background',
                            backgroundColor: 'transparent', // Use CSS class pattern
                            classNames: ['gray-out-time'],
                            title: '',
                            editable: false,
                            selectable: false
                        },
                        // Evening gray: 6:30 PM - 9:00 PM
                        {
                            id: 'evening-gray',
                            daysOfWeek: [1, 2, 3, 4, 5],
                            startTime: '18:30',
                            endTime: '21:00',
                            display: 'background',
                            backgroundColor: 'transparent', // Use CSS class pattern
                            classNames: ['gray-out-time'],
                            title: '',
                            editable: false,
                            selectable: false
                        }
                    ];

                    setEvents([...mappedEvents, ...backgroundEvents]);
                }
            })
            .catch(console.error);
    };

    const handleDateSelect = (selectInfo: any) => {
        // Calculate hours from selection
        const start = selectInfo.start;
        const end = selectInfo.end;
        let diffMs = end - start;

        // Lunch Break Logic: Deduct overlap with 12:00 - 13:00

        // Create lunch start/end for the selected day
        const lunchStart = new Date(start);
        lunchStart.setHours(12, 0, 0, 0);
        const lunchEnd = new Date(start);
        lunchEnd.setHours(13, 0, 0, 0);

        // Check for overlap
        const overlapStart = start > lunchStart ? start : lunchStart;
        const overlapEnd = end < lunchEnd ? end : lunchEnd;

        if (overlapStart < overlapEnd) {
            const overlapMs = overlapEnd.getTime() - overlapStart.getTime();
            diffMs -= overlapMs;
            // Optional: Notify user? 
            // console.log(`Deducted ${overlapMs / (1000 * 60)} minutes for lunch break`);
        }

        const diffHours = diffMs / (1000 * 60 * 60);

        // Extract start time HH:MM
        const startTime = selectInfo.startStr.split('T')[1].substring(0, 5);

        setSelectedDate(selectInfo.startStr.split('T')[0]);
        setSelectedEvent({
            id: '',
            title: '',
            start: selectInfo.startStr,
            extendedProps: {
                hours: Number(diffHours.toFixed(1)),
                startTime: startTime // Pass selected start time
            }
        });
        setIsModalOpen(true);
    };

    const handleEventClick = (clickInfo: any) => {
        const event = clickInfo.event;
        setSelectedDate(event.startStr.split('T')[0]);
        setSelectedEvent({
            id: event.id,
            title: event.title,
            start: event.startStr,
            extendedProps: event.extendedProps
        });
        setIsModalOpen(true);
    };

    const handleModalClose = () => {
        setIsModalOpen(false);
        setSelectedEvent(null);
    };

    const handleEntrySaved = () => {
        fetchTimeEntries();
        setIsModalOpen(false);
    };

    return (
        <div style={{
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            maxWidth: '1200px',
            margin: '0 auto',
            padding: '20px',
            boxSizing: 'border-box',
            color: 'white'
        }}>
            {/* Standard Header */}
            <div style={{ textAlign: 'center', marginBottom: '20px' }}>
                <h2 style={{ margin: 0, fontSize: '1.8em', background: 'var(--accent-gradient)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Calendar</h2>
                <div style={{ fontSize: '0.9em', color: 'var(--text-secondary)', marginTop: '5px' }}>
                    View and manage your time entries
                </div>
            </div>

            <div className="glass-panel" style={{
                flex: 1,
                padding: '10px',
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
                background: '#0f0f14',
                border: 'none',
                borderRadius: '12px'
            }}>
                <FullCalendar
                    ref={calendarRef}
                    plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
                    initialView="timeGridWeek"
                    scrollTime="09:00:00"
                    headerToolbar={{
                        left: 'prev,next today',
                        center: 'title',
                        right: 'dayGridMonth,timeGridWeek'
                    }}
                    events={events}
                    selectable={true}
                    selectMirror={true}
                    select={handleDateSelect}
                    eventClick={handleEventClick}
                    height="100%"
                    handleWindowResize={true}
                    expandRows={true}
                    stickyHeaderDates={true}
                    dayMaxEvents={true}
                    weekends={false}
                    slotMinTime={slotMinTime}
                    slotMaxTime={slotMaxTime}
                    allDaySlot={false}
                    slotDuration="00:30:00"
                    slotLabelInterval="01:00"
                    nowIndicator={true}
                />
                {isModalOpen && (
                    <TimeEntryModal
                        isOpen={isModalOpen}
                        onClose={handleModalClose}
                        onSave={handleEntrySaved}
                        initialDate={selectedDate}
                        existingEntry={selectedEvent}
                        initialStartTime={selectedEvent?.extendedProps?.startTime}
                    />
                )}
            </div>
        </div>
    );
};

export default CalendarView;
