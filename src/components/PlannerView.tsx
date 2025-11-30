import React, { useState, useEffect } from 'react';

interface Task {
    id: string;
    name: string;
    redmine_issue_id?: number;
    planned_hours: number;
    is_logged: boolean;
    date: string;
    activity_id?: number;
    rd_function_team?: string;
    comments?: string;
}

interface PlannerViewProps {
    onTestAlert: () => void;
    onTestAutoLog: () => void;
    refreshTrigger?: number;
}

const PlannerView: React.FC<Partial<PlannerViewProps>> = ({ onTestAlert = () => console.log("Test Alert"), onTestAutoLog = () => console.log("Test Auto Log"), refreshTrigger }) => {
    const [tasks, setTasks] = useState<Task[]>([]);
    const [projects, setProjects] = useState<any[]>([]);
    const [issues, setIssues] = useState<any[]>([]);

    const [selectedProjectId, setSelectedProjectId] = useState<number | ''>('');
    const [selectedIssueId, setSelectedIssueId] = useState<number | ''>('');
    const [newHours, setNewHours] = useState('8'); // Default 8 hours

    // New state for profile fields
    const [selectedActivityId, setSelectedActivityId] = useState<number | undefined>(undefined);
    const [selectedRdTeam, setSelectedRdTeam] = useState<string>('N/A');
    const [selectedComment, setSelectedComment] = useState('');

    const [alertTime, setAlertTime] = useState(localStorage.getItem('planner_alert_time') || '17:00');
    const [autoLogTime, setAutoLogTime] = useState(localStorage.getItem('planner_auto_log_time') || '18:00');

    const [profiles, setProfiles] = useState<any[]>([]);
    const [selectedProfileName, setSelectedProfileName] = useState('');

    // Use ref to track if we're currently loading from a profile
    const isLoadingFromProfile = React.useRef(false);

    useEffect(() => {
        fetchTasks();
        fetchProfiles();
        fetchProjects();
    }, []);

    // Refresh tasks when refreshTrigger changes
    useEffect(() => {
        if (refreshTrigger !== undefined && refreshTrigger > 0) {
            fetchTasks();
        }
    }, [refreshTrigger]);

    const fetchProjects = async () => {
        // Try cache first
        const cached = localStorage.getItem('redmine_projects');
        if (cached) {
            try {
                setProjects(JSON.parse(cached));
            } catch (e) {
                console.error("Error parsing cached projects", e);
            }
        }

        try {
            const response = await fetch('http://127.0.0.1:8000/api/redmine/projects');
            const data = await response.json();
            if (!data.error) {
                setProjects(data);
                localStorage.setItem('redmine_projects', JSON.stringify(data));
            }
        } catch (error) {
            console.error("Failed to fetch projects:", error);
        }
    };

    const fetchIssues = async (projectId: number) => {
        // Try cache first
        const cacheKey = `redmine_issues_${projectId}`;
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
            try {
                setIssues(JSON.parse(cached));
            } catch (e) {
                console.error("Error parsing cached issues", e);
            }
        }

        try {
            const response = await fetch(`http://127.0.0.1:8000/api/redmine/issues?project_id=${projectId}`);
            const data = await response.json();
            if (!data.error) {
                setIssues(data);
                localStorage.setItem(cacheKey, JSON.stringify(data));
            }
        } catch (error) {
            console.error("Failed to fetch issues:", error);
        }
    };

    const fetchProfiles = async () => {
        try {
            const response = await fetch('http://127.0.0.1:8000/api/profiles');
            const data = await response.json();
            if (Array.isArray(data)) setProfiles(data);
        } catch (error) {
            console.error("Failed to fetch profiles:", error);
        }
    };

    const handleProfileSelect = (profileName: string) => {
        const profile = profiles.find(p => p.name === profileName);
        if (profile) {
            console.log("Loading profile:", profile);
            isLoadingFromProfile.current = true;
            setSelectedProfileName(profile.name); // Store profile name
            setSelectedProjectId(profile.project_id);

            // Set activity, rd_team and comment from profile
            setSelectedActivityId(profile.activity_id);
            setSelectedRdTeam(profile.rd_function_team || 'N/A');
            setSelectedComment(profile.comments || '');

            // Inject project if missing (for offline support)
            if (profile.project_name && profile.project_id) {
                setProjects(prev => {
                    const exists = prev.find(p => p.id === profile.project_id);
                    if (!exists) {
                        return [...prev, { id: profile.project_id, name: profile.project_name }];
                    }
                    return prev;
                });
            }

            // If we have issue name, ensure it's in the list so it displays immediately
            if (profile.issue_name && profile.issue_id) {
                setIssues(prevIssues => {
                    const exists = prevIssues.find(i => i.id === profile.issue_id);
                    if (!exists) {
                        return [...prevIssues, { id: profile.issue_id, subject: profile.issue_name }];
                    }
                    return prevIssues;
                });
            } else {
                // If no name locally, try fetch (which will check cache first now)
                console.warn("Profile missing issue_name, attempting fetch/cache lookup");
                fetchIssues(profile.project_id);
            }

            setSelectedIssueId(profile.issue_id);

            // Reset the flag after state updates
            setTimeout(() => {
                isLoadingFromProfile.current = false;
            }, 50);
        }
    };

    const fetchTasks = async (preventAutoCopy = false) => {
        try {
            let url = 'http://127.0.0.1:8000/api/tasks';
            if (preventAutoCopy) {
                const today = new Date().toISOString().split('T')[0];
                url += `?date_str=${today}`;
            }
            const response = await fetch(url); // Backend defaults to today
            const data = await response.json();
            if (Array.isArray(data)) setTasks(data);
        } catch (error) {
            console.error("Failed to fetch tasks:", error);
        }
    };

    const handleAddTask = async () => {
        if (!selectedIssueId) return;

        const issue = issues.find(i => i.id === selectedIssueId);
        // Priority: Comment -> Profile Name -> Issue Subject -> Unknown
        let taskName = 'Unknown Task';
        if (selectedComment) {
            taskName = selectedComment;
        } else if (selectedProfileName) {
            taskName = selectedProfileName;
        } else if (issue) {
            taskName = issue.subject;
        }

        const today = new Date().toISOString().split('T')[0];

        const newTask: Task = {
            id: Date.now().toString(),
            name: taskName,
            redmine_issue_id: Number(selectedIssueId),
            planned_hours: newHours ? parseFloat(newHours) : 0,
            is_logged: false,
            date: today,
            activity_id: selectedActivityId,
            rd_function_team: selectedRdTeam,
            comments: selectedComment
        };

        try {
            await fetch('http://127.0.0.1:8000/api/tasks', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newTask)
            });
            // Reset fields
            setSelectedIssueId('');
            setSelectedProfileName(''); // Reset profile name
            setSelectedActivityId(undefined);
            setSelectedRdTeam('N/A');
            setSelectedComment('');
            setNewHours('8');
            fetchTasks(true); // Prevent auto-copy when adding (though unlikely to trigger it)
        } catch (error) {
            console.error("Failed to add task:", error);
        }
    };

    const handleDeleteTask = async (taskId: string) => {
        const task = tasks.find(t => t.id === taskId);
        if (!task) return;

        let deleteFromRedmine = false;
        if (task.is_logged) {
            if (window.confirm("This task is logged in Redmine. Do you want to delete the time entry from Redmine as well?")) {
                deleteFromRedmine = true;
            }
        }

        try {
            await fetch(`http://127.0.0.1:8000/api/tasks/${taskId}?delete_from_redmine=${deleteFromRedmine}`, {
                method: 'DELETE'
            });
            fetchTasks(true); // Prevent auto-copy on delete to avoid refilling the list
        } catch (error) {
            console.error("Failed to delete task:", error);
        }
    };

    const handleLogTask = async (task: Task) => {
        if (task.is_logged) return;
        if (!confirm(`Log ${task.planned_hours} hours for "${task.name}"?`)) return;

        try {
            const response = await fetch('http://127.0.0.1:8000/api/planner/log_batch', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify([task])
            });
            const data = await response.json();
            if (data.status === 'success' || data.status === 'partial_success') {
                fetchTasks(true);
            } else {
                alert("Failed to log task: " + (data.error || "Unknown error"));
            }
        } catch (error) {
            console.error("Failed to log task:", error);
            alert("Failed to log task");
        }
    };

    const handleSaveSettings = () => {
        localStorage.setItem('planner_alert_time', alertTime);
        localStorage.setItem('planner_auto_log_time', autoLogTime);
        alert("Settings saved!");
    };

    const handleUpdateTask = async (task: Task) => {
        try {
            await fetch(`http://127.0.0.1:8000/api/tasks/${task.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(task)
            });
            // Update local state to reflect change
            setTasks(prev => prev.map(t => t.id === task.id ? task : t));
        } catch (error) {
            console.error("Failed to update task:", error);
        }
    };

    const totalPlanned = tasks.reduce((sum, t) => sum + t.planned_hours, 0);

    return (
        <div style={{ padding: '30px', color: 'white', height: '100%', display: 'flex', flexDirection: 'column', maxWidth: '1000px', margin: '0 auto' }}>
            {/* Header Area */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px' }}>
                <div>
                    <h2 style={{ margin: 0, fontSize: '1.8em', background: 'var(--accent-gradient)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Daily Planner</h2>
                    <div style={{ fontSize: '0.9em', color: 'var(--text-secondary)', marginTop: '5px' }}>
                        {new Date().toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                    </div>
                </div>

                {/* Quick Settings Bar */}
                <div className="glass-panel" style={{ padding: '8px 15px', display: 'flex', gap: '15px', alignItems: 'center', borderRadius: '20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '0.8em', color: 'var(--text-secondary)' }}>Alert:</span>
                        <input
                            type="time"
                            value={alertTime}
                            onChange={(e) => setAlertTime(e.target.value)}
                            onBlur={handleSaveSettings}
                            style={{ background: 'transparent', border: 'none', color: 'white', fontFamily: 'inherit', fontSize: '0.9em', cursor: 'pointer' }}
                        />
                    </div>
                    <div style={{ width: '1px', height: '15px', background: 'rgba(255,255,255,0.1)' }}></div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '0.8em', color: 'var(--text-secondary)' }}>Auto-Log:</span>
                        <input
                            type="time"
                            value={autoLogTime}
                            onChange={(e) => setAutoLogTime(e.target.value)}
                            onBlur={handleSaveSettings}
                            style={{ background: 'transparent', border: 'none', color: 'white', fontFamily: 'inherit', fontSize: '0.9em', cursor: 'pointer' }}
                        />
                    </div>
                    <div style={{ width: '1px', height: '15px', background: 'rgba(255,255,255,0.1)' }}></div>
                    <div style={{ display: 'flex', gap: '5px' }}>
                        <button onClick={onTestAlert} title="Test Alert" style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '1em' }}>🔔</button>
                        <button onClick={onTestAutoLog} title="Test Auto-Log" style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '1em' }}>🚀</button>
                    </div>
                </div>
            </div>

            {/* Task Entry Bar */}
            <div className="glass-panel" style={{ padding: '15px', marginBottom: '30px', display: 'flex', gap: '15px', alignItems: 'center' }}>
                <div style={{ flex: 1, minWidth: '200px' }}>
                    <select
                        onChange={(e) => {
                            handleProfileSelect(e.target.value);
                            e.target.value = "";
                        }}
                        style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--glass-border)', backgroundColor: 'rgba(0,0,0,0.2)', color: 'white' }}
                        defaultValue=""
                    >
                        <option value="" disabled>Load Saved Task...</option>
                        {profiles.map((p: any) => <option key={p.name} value={p.name}>{p.name}</option>)}
                    </select>
                </div>

                <div style={{ flex: 1, minWidth: '150px' }}>
                    <select
                        value={selectedProjectId}
                        onChange={(e) => {
                            const newProjectId = Number(e.target.value);
                            setSelectedProjectId(newProjectId);
                            if (!isLoadingFromProfile.current) {
                                if (newProjectId) fetchIssues(newProjectId);
                                else setIssues([]);
                            }
                        }}
                        style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--glass-border)', backgroundColor: 'rgba(0,0,0,0.2)', color: 'white' }}
                    >
                        <option value="">Select Project</option>
                        {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                </div>

                <div style={{ flex: 2, minWidth: '200px' }}>
                    <select
                        value={selectedIssueId}
                        onChange={(e) => setSelectedIssueId(Number(e.target.value))}
                        style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--glass-border)', backgroundColor: 'rgba(0,0,0,0.2)', color: 'white' }}
                    >
                        <option value="">Select Issue</option>
                        {issues.map(i => <option key={i.id} value={i.id}>{i.subject}</option>)}
                    </select>
                </div>

                <div style={{ width: '80px' }}>
                    <input
                        type="number"
                        placeholder="Hrs"
                        value={newHours}
                        onChange={(e) => setNewHours(e.target.value)}
                        step="0.5"
                        style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--glass-border)', backgroundColor: 'rgba(0,0,0,0.2)', color: 'white', textAlign: 'center' }}
                    />
                </div>

                <button
                    onClick={handleAddTask}
                    style={{
                        padding: '10px 20px',
                        backgroundColor: 'var(--primary)',
                        color: 'white',
                        border: 'none',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        fontWeight: 'bold',
                        boxShadow: '0 4px 15px rgba(100, 108, 255, 0.3)'
                    }}
                >
                    Add
                </button>
            </div>

            {/* Task List */}
            <div style={{ flex: 1, overflowY: 'auto', paddingRight: '10px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                    {tasks.length === 0 && (
                        <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)', border: '2px dashed var(--glass-border)', borderRadius: '12px' }}>
                            No tasks planned for today. Start by adding one above!
                        </div>
                    )}
                    {tasks.map(task => (
                        <div key={task.id} className="glass-panel" style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '20px',
                            padding: '20px',
                            borderLeft: task.is_logged ? '4px solid #4caf50' : '4px solid #ff9800',
                            background: task.is_logged ? 'rgba(76, 175, 80, 0.05)' : 'rgba(30, 30, 36, 0.6)',
                            transition: 'all 0.3s ease'
                        }}>
                            <div style={{ flex: 1 }}>
                                <input
                                    type="text"
                                    value={task.name}
                                    onChange={(e) => {
                                        const newName = e.target.value;
                                        setTasks(prev => prev.map(t => t.id === task.id ? { ...t, name: newName } : t));
                                    }}
                                    onBlur={() => handleUpdateTask(task)}
                                    disabled={task.is_logged}
                                    style={{
                                        fontWeight: '600',
                                        backgroundColor: 'transparent',
                                        border: 'none',
                                        color: 'var(--text-primary)',
                                        width: '100%',
                                        fontSize: '1.1em',
                                        padding: '5px 0',
                                        outline: 'none',
                                        textDecoration: task.is_logged ? 'line-through' : 'none',
                                        opacity: task.is_logged ? 0.7 : 1
                                    }}
                                />
                                <div style={{ fontSize: '0.85em', color: 'var(--text-secondary)', marginTop: '5px' }}>
                                    {task.redmine_issue_id ? `Issue #${task.redmine_issue_id}` : 'No Issue Linked'}
                                    {task.comments && task.comments !== task.name && ` • ${task.comments}`}
                                </div>
                            </div>

                            <div style={{
                                fontWeight: 'bold',
                                fontSize: '1.2em',
                                color: task.is_logged ? '#4caf50' : 'var(--primary)',
                                minWidth: '60px',
                                textAlign: 'right'
                            }}>
                                {task.planned_hours.toFixed(1)}h
                            </div>

                            <div style={{
                                padding: '5px 12px',
                                borderRadius: '20px',
                                fontSize: '0.85em',
                                fontWeight: 'bold',
                                background: task.is_logged ? 'rgba(76, 175, 80, 0.2)' : 'rgba(255, 152, 0, 0.2)',
                                color: task.is_logged ? '#4caf50' : '#ff9800',
                                border: task.is_logged ? '1px solid rgba(76, 175, 80, 0.3)' : '1px solid rgba(255, 152, 0, 0.3)'
                            }}>
                                {task.is_logged ? 'LOGGED' : 'PENDING'}
                            </div>

                            {!task.is_logged && (
                                <button
                                    onClick={() => handleLogTask(task)}
                                    style={{
                                        background: 'rgba(76, 175, 80, 0.1)',
                                        border: '1px solid rgba(76, 175, 80, 0.3)',
                                        cursor: 'pointer',
                                        color: '#4caf50',
                                        padding: '5px 10px',
                                        borderRadius: '4px',
                                        fontSize: '0.9em',
                                        fontWeight: 'bold',
                                        transition: 'all 0.2s'
                                    }}
                                    title="Log to Redmine"
                                >
                                    Log
                                </button>
                            )}

                            {!task.is_logged && (
                                <button
                                    onClick={() => handleDeleteTask(task.id)}
                                    style={{
                                        background: 'transparent',
                                        border: 'none',
                                        cursor: 'pointer',
                                        color: 'var(--text-secondary)',
                                        padding: '8px',
                                        borderRadius: '50%',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        transition: 'all 0.2s'
                                    }}
                                    onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(244, 67, 54, 0.1)'; e.currentTarget.style.color = '#f44336'; }}
                                    onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
                                    title="Delete Task"
                                >
                                    ✕
                                </button>
                            )}
                        </div>
                    ))}
                </div>
            </div>

            {/* Footer */}
            <div style={{ marginTop: '20px', paddingTop: '20px', borderTop: '1px solid rgba(255,255,255,0.1)', display: 'flex', justifyContent: 'flex-end', alignItems: 'baseline', gap: '10px' }}>
                <span style={{ color: 'var(--text-secondary)', fontSize: '1.1em' }}>Total Planned:</span>
                <span style={{ fontSize: '2em', fontWeight: 'bold', background: 'var(--accent-gradient)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                    {totalPlanned.toFixed(1)}h
                </span>
            </div>
        </div>
    );
};

export default PlannerView;
