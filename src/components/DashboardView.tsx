import { useEffect, useState } from 'react';
import Confetti from './Confetti';

interface Task {
    id: string;
    name: string;
    is_logged: boolean;
    planned_hours: number;
}

const DashboardView = () => {
    const [dailyHours, setDailyHours] = useState(0);
    const [weeklyHours, setWeeklyHours] = useState(0);
    const [dailyBreakdown, setDailyBreakdown] = useState<number[]>([0, 0, 0, 0, 0]); // Mon-Fri
    const [, setLoading] = useState(true);
    const [todaysTasks, setTodaysTasks] = useState<Task[]>([]);
    const [showConfetti, setShowConfetti] = useState(false);
    const [issueBreakdown, setIssueBreakdown] = useState<{ name: string; hours: number; percentage: number; color: string }[]>([]);

    // New State for Breakdown Mode and Raw Data
    const [breakdownMode, setBreakdownMode] = useState<'issue' | 'comment'>('issue');
    const [weeklyEntries, setWeeklyEntries] = useState<any[]>([]);
    const [weekOffset, setWeekOffset] = useState(0); // 0 = current week, -1 = previous, etc.

    const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#6366f1'];

    useEffect(() => {
        fetchDailyHours();
        fetchTodaysTasks();
    }, []);

    useEffect(() => {
        fetchWeeklyStats();
    }, [weekOffset]);

    useEffect(() => {
        if (dailyHours >= 8.0) {
            setShowConfetti(true);
        }
    }, [dailyHours]);

    // Re-calculate breakdown when mode or data changes
    useEffect(() => {
        if (weeklyEntries.length > 0) {
            calculateBreakdown(weeklyEntries);
        }
    }, [breakdownMode, weeklyEntries]);

    const fetchDailyHours = () => {
        fetch('http://127.0.0.1:8000/api/redmine/daily_hours')
            .then(res => res.json())
            .then(data => {
                animateValue(setDailyHours, 0, data.hours || 0, 1000);
            })
            .catch(console.error);
    };

    const fetchTodaysTasks = () => {
        fetch('http://127.0.0.1:8000/api/tasks')
            .then(res => res.json())
            .then(data => {
                if (Array.isArray(data)) {
                    setTodaysTasks(data);
                }
            })
            .catch(console.error);
    };

    const fetchWeeklyStats = () => {
        const { start, end } = getWeekRange();
        fetch(`http://127.0.0.1:8000/api/redmine/time_entries?from_date=${start}&to_date=${end}`)
            .then(res => res.json())
            .then(data => {
                if (Array.isArray(data)) {
                    setWeeklyEntries(data); // Store raw data
                    processWeeklyTotals(data); // Calculate totals immediately
                }
                setLoading(false);
            })
            .catch(err => {
                console.error(err);
                setLoading(false);
            });
    };

    const getWeekRange = () => {
        const now = new Date();
        // Adjust for offset
        now.setDate(now.getDate() + (weekOffset * 7));

        const day = now.getDay(); // 0 is Sunday
        const diff = now.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
        const monday = new Date(now.setDate(diff));
        const sunday = new Date(now.setDate(monday.getDate() + 6));

        return {
            start: monday.toISOString().split('T')[0],
            end: sunday.toISOString().split('T')[0],
            monday,
            sunday
        };
    };

    const processWeeklyTotals = (entries: any[]) => {
        let total = 0;
        const breakdown = [0, 0, 0, 0, 0]; // Mon-Fri

        entries.forEach(entry => {
            total += entry.hours;
            // Daily Breakdown
            const date = new Date(entry.spent_on);
            const day = date.getDay(); // 1=Mon, 5=Fri
            if (day >= 1 && day <= 5) {
                breakdown[day - 1] += entry.hours;
            }
        });

        animateValue(setWeeklyHours, 0, total, 1000);
        setDailyBreakdown(breakdown);
    };

    const calculateBreakdown = (entries: any[]) => {
        const groupMap: { [key: string]: number } = {};
        let total = 0;

        entries.forEach(entry => {
            total += entry.hours;
            let key = 'Unknown';

            if (breakdownMode === 'issue') {
                key = entry.issue_subject
                    ? `${entry.issue_subject} (#${entry.issue})`
                    : (entry.project || 'Unknown Project');
            } else {
                // Comment Mode
                key = entry.comments || 'No Comment';
            }

            groupMap[key] = (groupMap[key] || 0) + entry.hours;
        });

        // Process Breakdown
        const sortedGroups = Object.entries(groupMap)
            .map(([name, hours], index) => ({
                name,
                hours,
                percentage: (hours / total) * 100,
                color: COLORS[index % COLORS.length]
            }))
            .sort((a, b) => b.hours - a.hours)
            .slice(0, 7); // Top 7

        setIssueBreakdown(sortedGroups);
    };

    const animateValue = (setter: (val: number) => void, start: number, end: number, duration: number) => {
        const startTime = performance.now();

        const animate = (currentTime: number) => {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const ease = 1 - Math.pow(1 - progress, 4); // Ease out quart
            const current = start + (end - start) * ease;
            setter(current);

            if (progress < 1) {
                requestAnimationFrame(animate);
            }
        };
        requestAnimationFrame(animate);
    };

    const maxDaily = Math.max(...dailyBreakdown, 8); // Scale based on max or at least 8h
    // const maxGroupHours = Math.max(...issueBreakdown.map(i => i.hours), 1); // Unused

    return (
        <div style={{ padding: '40px', maxWidth: '1000px', margin: '0 auto' }}>
            <Confetti active={showConfetti} />
            <h2 style={{ marginBottom: '30px', fontSize: '2em', background: 'var(--accent-gradient)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Dashboard</h2>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>

                {/* Today's Overview Card - Responsive Flex */}
                <div className="glass-panel" style={{ padding: '40px', display: 'flex', flexWrap: 'wrap', gap: '40px', alignItems: 'center' }}>

                    {/* Left: Hours */}
                    <div style={{ flex: '1 1 300px', display: 'flex', flexDirection: 'column', justifyContent: 'center', position: 'relative' }}>
                        <div style={{
                            position: 'absolute', top: '-20px', left: '-20px',
                            fontSize: '8em', opacity: 0.03, transform: 'rotate(-10deg)', pointerEvents: 'none'
                        }}>
                            ⏱️
                        </div>
                        <h3 style={{ margin: '0 0 10px 0', color: 'var(--text-secondary)', fontSize: '1.1em', fontWeight: 500 }}>
                            Hours Today
                        </h3>
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px' }}>
                            <div style={{
                                fontSize: '4.5em',
                                fontWeight: 700,
                                background: 'var(--accent-gradient)',
                                WebkitBackgroundClip: 'text',
                                WebkitTextFillColor: 'transparent',
                                lineHeight: 1
                            }}>
                                {dailyHours.toFixed(2)}
                            </div>
                            <span style={{ fontSize: '1.2em', color: 'var(--text-secondary)' }}>hrs</span>
                        </div>
                    </div>

                    {/* Right: Plan */}
                    <div style={{ flex: '1 1 300px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                            <h3 style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '1.1em', fontWeight: 500 }}>
                                Today's Plan
                            </h3>
                            <span style={{ background: 'rgba(255,255,255,0.1)', padding: '2px 8px', borderRadius: '10px', fontSize: '0.8em', color: '#aaa' }}>
                                {todaysTasks.length} Tasks
                            </span>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '150px', overflowY: 'auto' }}>
                            {todaysTasks.length === 0 ? (
                                <div style={{ color: '#aaa', fontStyle: 'italic', textAlign: 'center', marginTop: '20px' }}>No tasks planned yet.</div>
                            ) : (
                                todaysTasks.map(task => (
                                    <div key={task.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.95em', color: '#ddd', padding: '8px', background: 'rgba(255,255,255,0.03)', borderRadius: '6px' }}>
                                        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: task.is_logged ? '#4ade80' : '#fbbf24', flexShrink: 0 }}></div>
                                        <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{task.name}</div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>

                {/* Weekly Analysis Card */}
                <div className="glass-panel" style={{ padding: '40px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '40px' }}>
                        <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '5px' }}>
                                <h3 style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '1.1em', fontWeight: 500 }}>
                                    Weekly Overview
                                </h3>
                                {/* Week Navigation */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: '5px', background: 'rgba(255,255,255,0.05)', borderRadius: '20px', padding: '2px 8px' }}>
                                    <button
                                        onClick={() => setWeekOffset(prev => prev - 1)}
                                        style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '1.0em', padding: '0 4px' }}
                                    >
                                        ‹
                                    </button>
                                    <span style={{ fontSize: '0.8em', color: '#aaa', whiteSpace: 'nowrap' }}>
                                        {(() => {
                                            const { monday, sunday } = getWeekRange();
                                            const formatDate = (d: Date) => d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
                                            return `${formatDate(monday)} - ${formatDate(sunday)}`;
                                        })()}
                                    </span>
                                    <button
                                        onClick={() => setWeekOffset(prev => prev + 1)}
                                        disabled={weekOffset === 0}
                                        style={{ background: 'none', border: 'none', color: weekOffset === 0 ? 'rgba(255,255,255,0.1)' : 'var(--text-secondary)', cursor: weekOffset === 0 ? 'default' : 'pointer', fontSize: '1.0em', padding: '0 4px' }}
                                    >
                                        ›
                                    </button>
                                </div>
                            </div>
                            <div style={{ fontSize: '2.5em', fontWeight: 700, color: 'white' }}>
                                {weeklyHours.toFixed(1)} <span style={{ fontSize: '0.5em', color: 'var(--text-secondary)', fontWeight: 400 }}>hrs total</span>
                            </div>
                        </div>
                        <div style={{
                            fontSize: '3em', opacity: 0.1
                        }}>
                            📊
                        </div>
                    </div>

                    {/* Daily Bar Chart (Restored) */}
                    <div style={{ display: 'flex', alignItems: 'flex-end', height: '200px', gap: '20px', marginBottom: '30px', paddingBottom: '10px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                        {['M', 'T', 'W', 'T', 'F'].map((day, index) => {
                            const hours = dailyBreakdown[index];
                            const height = (hours / maxDaily) * 100;
                            const isToday = new Date().getDay() === index + 1;

                            return (
                                <div key={day} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', height: '100%', justifyContent: 'flex-end' }}>
                                    <div style={{ fontSize: '0.8em', color: isToday ? 'white' : '#aaa', fontWeight: 500 }}>{hours > 0 ? hours.toFixed(1) : ''}</div>
                                    <div style={{
                                        width: '100%',
                                        height: `${Math.max(height, 2)}%`,
                                        background: isToday ? 'var(--accent-gradient)' : 'rgba(255,255,255,0.1)',
                                        borderRadius: '4px',
                                        transition: 'height 1s cubic-bezier(0.4, 0, 0.2, 1)',
                                        minHeight: '4px'
                                    }}></div>
                                    <div style={{ fontSize: '0.9em', color: isToday ? 'white' : 'var(--text-secondary)', fontWeight: isToday ? 700 : 400 }}>
                                        {day}
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* Breakdown Header with Switch */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                        <h4 style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.9em', textTransform: 'uppercase', letterSpacing: '1px' }}>
                            Breakdown by {breakdownMode === 'issue' ? 'Issue' : 'Comment'}
                        </h4>
                        <div style={{ display: 'flex', background: 'rgba(255,255,255,0.1)', borderRadius: '6px', padding: '2px' }}>
                            <button
                                onClick={() => setBreakdownMode('issue')}
                                style={{
                                    background: breakdownMode === 'issue' ? 'rgba(255,255,255,0.2)' : 'transparent',
                                    border: 'none', color: 'white', padding: '4px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8em', transition: 'all 0.2s'
                                }}
                            >
                                Issue
                            </button>
                            <button
                                onClick={() => setBreakdownMode('comment')}
                                style={{
                                    background: breakdownMode === 'comment' ? 'rgba(255,255,255,0.2)' : 'transparent',
                                    border: 'none', color: 'white', padding: '4px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8em', transition: 'all 0.2s'
                                }}
                            >
                                Comment
                            </button>
                        </div>
                    </div>

                    {/* Breakdown Legend */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '15px' }}>
                        {issueBreakdown.map((item, index) => (
                            <div key={index} style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.9em' }}>
                                <div style={{ width: '12px', height: '12px', borderRadius: '3px', background: item.color, flexShrink: 0 }}></div>
                                <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#ddd', flex: 1 }} title={item.name}>
                                    {item.name}
                                </div>
                                <div style={{ color: '#aaa', fontWeight: 600 }}>{Math.round(item.percentage)}%</div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DashboardView;
