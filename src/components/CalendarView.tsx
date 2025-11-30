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
    };
}

const CalendarView = () => {
    const [events, setEvents] = useState<CalendarEvent[]>([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedDate, setSelectedDate] = useState<string>('');
    const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
    const calendarRef = useRef<FullCalendar>(null);

    // Default start time for tasks without specific time
    const DEFAULT_START_TIME = '09:00:00';

    useEffect(() => {
        fetchTimeEntries();
    }, []);

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
                        // Assuming 9:00 AM start for visualization if no specific time
                        const startDate = new Date(`${entry.spent_on}T${DEFAULT_START_TIME}`);
                        const endDate = new Date(startDate.getTime() + (entry.hours * 60 * 60 * 1000));

                        // Format HH:MM
                        const formatTime = (date: Date) => {
                            return date.toTimeString().substring(0, 5);
                        };

                        return {
                            id: entry.id.toString(),
                            title: `${entry.hours}h - ${entry.comments || entry.project}`,
                            start: `${entry.spent_on}T${DEFAULT_START_TIME}`,
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
                                hours: entry.hours
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
        const diffMs = end - start;
        const diffHours = diffMs / (1000 * 60 * 60);

        setSelectedDate(selectInfo.startStr.split('T')[0]);
        setSelectedEvent({
            id: '',
            title: '',
            start: selectInfo.startStr,
            extendedProps: {
                hours: Number(diffHours.toFixed(1))
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
        <div className="glass-panel" style={{
            height: '100%',
            margin: '0',
            padding: '10px',
            boxSizing: 'border-box', /* Prevent padding from adding to height */
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            background: '#0f0f14',
            border: 'none',
            borderRadius: '0'
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
                expandRows={true} /* Distribute height evenly */
                stickyHeaderDates={true}
                dayMaxEvents={true}
                weekends={false}
                slotMinTime="06:00:00"
                slotMaxTime="21:00:00"
                allDaySlot={false}
                slotDuration="00:30:00"
                slotLabelInterval="01:00"
                nowIndicator={true}
            />
            <TimeEntryModal
                isOpen={isModalOpen}
                onClose={handleModalClose}
                onSave={handleEntrySaved}
                initialDate={selectedDate}
                existingEntry={selectedEvent}
            />
        </div>
    );
};

export default CalendarView;
