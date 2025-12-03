import React, { useState, useEffect, useRef } from 'react';
import { ToastContainer } from './Toast';
import ConfirmModal from './ConfirmModal';

interface Task {
    id: string;
    name: string;
    redmine_issue_id?: number;
    planned_hours: number;
    is_logged: boolean;
    is_paused: boolean; // New field
    date: string;
    activity_id?: number;
    rd_function_team?: string;
    comments?: string;
    project_id?: number;
    time_entry_id?: number;
}

interface PlannerViewProps {
    refreshTrigger?: number;
}

const PlannerView: React.FC<Partial<PlannerViewProps>> = ({ refreshTrigger }) => {
    const [tasks, setTasks] = useState<Task[]>([]);
    const [issues, setIssues] = useState<any[]>([]);

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

    // UI State
    const [toasts, setToasts] = useState<{ id: string; message: string; type: 'success' | 'error' | 'info' }[]>([]);
    const [confirmModal, setConfirmModal] = useState<{ isOpen: boolean; message: string; title?: string; onConfirm: () => void }>({
        isOpen: false,
        message: '',
        onConfirm: () => { }
    });

    // Helper: Add Toast
    const addToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
        const id = Date.now().toString();
        setToasts(prev => [...prev, { id, message, type }]);
    };

    const removeToast = (id: string) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    };

    // We need to store the resolve function for the current confirmation
    const confirmResolveRef = useRef<((value: boolean) => void) | null>(null);

    const openConfirm = (message: string, title?: string) => {
        return new Promise<boolean>((resolve) => {
            confirmResolveRef.current = resolve;
            setConfirmModal({
                isOpen: true,
                message,
                title,
                onConfirm: () => {
                    if (confirmResolveRef.current) confirmResolveRef.current(true);
                    setConfirmModal(prev => ({ ...prev, isOpen: false }));
                }
            });
        });
    };

    const handleConfirmCancel = () => {
        if (confirmResolveRef.current) confirmResolveRef.current(false);
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
    };

    useEffect(() => {
        fetchTasks();
        loadSavedTasks();
    }, []);

    // Refresh tasks when refreshTrigger changes
    useEffect(() => {
        if (refreshTrigger !== undefined && refreshTrigger > 0) {
            fetchTasks();
        }
    }, [refreshTrigger]);

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

    const loadSavedTasks = async () => {
        try {
            // Fetch both profiles (settings) and history (tasks.json)
            const [profilesResponse, historyResponse] = await Promise.all([
                fetch('http://127.0.0.1:8000/api/profiles'),
                fetch('http://127.0.0.1:8000/api/task_history')
            ]);

            const profilesData = await profilesResponse.json();
            const historyData = await historyResponse.json();

            console.log("DEBUG: Profiles Data:", profilesData);
            console.log("DEBUG: History Data:", historyData);

            const combined: any[] = [];
            const seenNames = new Set();

            // Add Profiles first (they are "templates" and likely have better data like project_id)
            if (Array.isArray(profilesData)) {
                profilesData.forEach((p: any) => {
                    combined.push(p);
                    seenNames.add(p.name);
                });
            }

            // Add History items if name not already seen
            if (Array.isArray(historyData)) {
                historyData.forEach((p: any) => {
                    if (!seenNames.has(p.name)) {
                        combined.push(p);
                        seenNames.add(p.name);
                    }
                });
            }

            setProfiles(combined);
        } catch (error) {
            console.error("Failed to load saved tasks:", error);
        }
    };

    const handleProfileSelect = (profileName: string) => {
        const profile = profiles.find(p => p.name === profileName);
        if (profile) {
            console.log("Loading profile:", profile);
            isLoadingFromProfile.current = true;
            setSelectedProfileName(profile.name); // Store profile name

            // Set activity, rd_team and comment from profile
            setSelectedActivityId(profile.activity_id);
            setSelectedRdTeam(profile.rd_function_team || 'N/A');
            setSelectedComment(profile.comments || '');

            // Handle both profile (issue_id) and history task (redmine_issue_id) formats
            const issueId = profile.issue_id || profile.redmine_issue_id;

            // If we have issue name, ensure it's in the list so it displays immediately
            // History tasks might not have issue_name, but we can try to find it in existing issues or fetch
            if (profile.issue_name && issueId) {
                setIssues(prevIssues => {
                    const exists = prevIssues.find(i => i.id === issueId);
                    if (!exists) {
                        return [...prevIssues, { id: issueId, subject: profile.issue_name }];
                    }
                    return prevIssues;
                });
            } else if (profile.project_id) {
                // If no name locally, try fetch (which will check cache first now)
                // console.warn("Profile missing issue_name, attempting fetch/cache lookup");
                fetchIssues(profile.project_id);
            }

            setSelectedIssueId(issueId || '');

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
                url += `?date_str=${today}&no_auto_copy=true`;
            }
            const response = await fetch(url); // Backend defaults to today
            const data = await response.json();
            if (Array.isArray(data)) setTasks(data);
        } catch (error) {
            console.error("Failed to fetch tasks:", error);
        }
    };

    const handleAddTask = async () => {
        // Allow adding task even without issue ID, as long as we have a name
        // Priority: Comment -> Profile Name -> Issue Subject -> Unknown
        let taskName = 'Unknown Task';
        if (selectedComment) {
            taskName = selectedComment;
        } else if (selectedProfileName) {
            taskName = selectedProfileName;
        } else if (selectedIssueId) {
            const issue = issues.find(i => i.id === selectedIssueId);
            if (issue) taskName = issue.subject;
        }

        if (taskName === 'Unknown Task' && !selectedIssueId) {
            alert("Please select a profile or ensure task details are loaded.");
            return;
        }

        const today = new Date().toISOString().split('T')[0];

        const newTask: Task = {
            id: Date.now().toString(),
            name: taskName,
            redmine_issue_id: selectedIssueId ? Number(selectedIssueId) : undefined,
            planned_hours: newHours ? parseFloat(newHours) : 0,
            is_logged: false,
            date: today,
            activity_id: selectedActivityId,
            rd_function_team: selectedRdTeam,
            comments: selectedComment,
            project_id: selectedIssueId ? undefined : (profiles.find(p => p.name === selectedProfileName)?.project_id),
            is_paused: false
        };

        console.log("DEBUG: Adding New Task:", newTask);

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
            const confirmed = await openConfirm(
                "This task is logged in Redmine. Do you want to delete the time entry from Redmine as well?",
                "Delete Logged Task"
            );
            if (confirmed) {
                deleteFromRedmine = true;
            }
        }

        try {
            await fetch(`http://127.0.0.1:8000/api/tasks/${taskId}?delete_from_redmine=${deleteFromRedmine}`, {
                method: 'DELETE'
            });
            fetchTasks(true); // Prevent auto-copy on delete to avoid refilling the list
            addToast("Task deleted", 'success');
        } catch (error) {
            console.error("Failed to delete task:", error);
            addToast("Failed to delete task", 'error');
        }
    };

    const handleLogTask = async (task: Task) => {
        if (task.is_logged) return;

        const confirmed = await openConfirm(`Log ${task.planned_hours} hours for "${task.name}"?`, "Confirm Logging");
        if (!confirmed) return;

        // Append timestamp to comment
        // const nowTime = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
        const taskToLog = {
            ...task,
            comments: task.comments ? `${task.comments}` : `${task.name}`
        };

        console.log("DEBUG: Sending Task to Log:", taskToLog);

        try {
            const response = await fetch('http://127.0.0.1:8000/api/planner/log_batch', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify([taskToLog])
            });
            const data = await response.json();
            if (data.status === 'success') {
                fetchTasks(true);
                addToast("Task logged successfully!", 'success');
            } else if (data.status === 'partial_success') {
                fetchTasks(true);
                addToast(`Logged ${data.logged} tasks. Errors: ${data.errors.join(', ')}`, 'error');
            } else {
                addToast("Failed to log task: " + (data.error || "Unknown error"), 'error');
            }
        } catch (error) {
            console.error("Failed to log task:", error);
            addToast("Failed to log task", 'error');
        }
    };

    const handleDeleteHistoryItem = async () => {
        console.log("DEBUG: Attempting to delete history item:", selectedProfileName);
        if (!selectedProfileName) return;

        const confirmed = await openConfirm(`Delete "${selectedProfileName}" from saved tasks?`, "Delete Saved Task");
        if (!confirmed) return;

        try {
            console.log(`DEBUG: Sending DELETE requests for '${selectedProfileName}'...`);
            // Delete from both History (tasks.json) and Profiles (settings.yaml)
            const [historyRes, profileRes] = await Promise.all([
                fetch(`http://127.0.0.1:8000/api/task_history?name=${encodeURIComponent(selectedProfileName)}`, {
                    method: 'DELETE'
                }),
                fetch(`http://127.0.0.1:8000/api/profile?name=${encodeURIComponent(selectedProfileName)}`, {
                    method: 'DELETE'
                })
            ]);

            const historyData = await historyRes.json();
            const profileData = await profileRes.json();

            console.log("DEBUG: Delete History Response:", historyData);
            console.log("DEBUG: Delete Profile Response:", profileData);

            // We consider it a success if at least one deletion worked or if the item is gone from the list
            // (ignoring 404s if it only existed in one place)

            // Remove from list locally
            setProfiles(prev => prev.filter(p => p.name !== selectedProfileName));

            // Reset selection
            setSelectedProfileName('');
            setSelectedIssueId('');
            setSelectedActivityId(undefined);
            setSelectedRdTeam('N/A');
            setSelectedComment('');

            addToast("Saved task deleted", 'success');

        } catch (error) {
            console.error("DEBUG: Failed to delete saved task:", error);
            addToast("Failed to delete saved task", 'error');
        }
    };

    const handleSaveSettings = () => {
        localStorage.setItem('planner_alert_time', alertTime);
        localStorage.setItem('planner_auto_log_time', autoLogTime);
        addToast("Settings saved!", 'success');
    };

    const handleUpdateTask = async (task: Task) => {
        try {
            // 1. Update local task
            await fetch(`http://127.0.0.1:8000/api/tasks/${task.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(task)
            });
            // Update local state to reflect change
            setTasks(prev => prev.map(t => t.id === task.id ? task : t));

            // 2. If logged, update Redmine time entry
            if (task.is_logged && task.time_entry_id) {
                console.log(`DEBUG: Syncing update to Redmine Time Entry ${task.time_entry_id}`);

                const timeEntryPayload = {
                    project_id: task.project_id,
                    issue_id: task.redmine_issue_id,
                    spent_on: task.date,
                    hours: task.planned_hours,
                    activity_id: task.activity_id || 9,
                    rd_function_team: task.rd_function_team,
                    comments: task.comments
                };

                const response = await fetch(`http://127.0.0.1:8000/api/redmine/time_entries/${task.time_entry_id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(timeEntryPayload)
                });

                const data = await response.json();
                if (data.status !== 'success') {
                    console.error("Failed to sync with Redmine:", data.error);
                    // Optional: alert user?
                } else {
                    console.log("DEBUG: Redmine sync successful");
                }
            }
        } catch (error) {
            console.error("Failed to update task:", error);
        }
    };

    const totalPlanned = tasks.reduce((sum, t) => sum + t.planned_hours, 0);



    // Use ref to access latest tasks in interval
    const tasksRef = React.useRef(tasks);
    useEffect(() => {
        tasksRef.current = tasks;
    }, [tasks]);

    // Check time every minute
    useEffect(() => {
        const interval = setInterval(() => {
            const now = new Date();
            const currentTime = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

            if (currentTime === alertTime) {
                checkAlert(true);
            }

            if (currentTime === autoLogTime) {
                checkAutoLog(true);
            }
        }, 60000); // Check every minute

        return () => clearInterval(interval);
    }, [alertTime, autoLogTime]);

    const checkAlert = (force = false) => {
        if (force) {
            addToast("🔔 Time Check! Don't forget to update your daily log!", 'info');
        }
    };

    const checkAutoLog = async (force = false) => {
        if (force) {
            console.log("Triggering Auto-Log...");
            // Use ref to get latest tasks
            const currentTasks = tasksRef.current;
            // Filter out logged tasks AND paused tasks
            const unloggedTasks = currentTasks.filter(t => !t.is_logged && !t.is_paused && t.planned_hours > 0);

            if (unloggedTasks.length === 0) {
                if (force) addToast("No unlogged tasks to auto-log.", 'info');
                return;
            }

            // Append timestamp to comments for auto-log
            // const nowTime = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
            const tasksToLog = unloggedTasks.map(t => ({
                ...t,
                comments: t.comments ? `${t.comments}` : `${t.name}`
            }));

            try {
                const response = await fetch('http://127.0.0.1:8000/api/planner/log_batch', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(tasksToLog)
                });
                const data = await response.json();
                if (data.status === 'success' || data.status === 'partial_success') {
                    fetchTasks(true);
                    if (force) addToast(`Auto-logged ${data.logged} tasks.`, 'success');
                } else {
                    console.error("Auto-log failed:", data);
                    addToast("Auto-log failed", 'error');
                }
            } catch (error) {
                console.error("Auto-log error:", error);
                addToast("Auto-log error", 'error');
            }
        }
    };

    return (
        <div style={{ padding: '20px', color: 'white', height: '100%', display: 'flex', flexDirection: 'column', maxWidth: '800px', margin: '0 auto', boxSizing: 'border-box' }}>
            <ToastContainer toasts={toasts} removeToast={removeToast} />
            <ConfirmModal
                isOpen={confirmModal.isOpen}
                message={confirmModal.message}
                title={confirmModal.title}
                onConfirm={confirmModal.onConfirm}
                onCancel={handleConfirmCancel}
            />
            {/* Header Area */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '15px', gap: '10px', flexShrink: 0 }}>
                <div style={{ textAlign: 'center' }}>
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

                </div>
            </div>

            {/* Task Entry Bar */}
            <div className="glass-panel" style={{ padding: '15px', marginBottom: '20px', display: 'flex', gap: '15px', alignItems: 'center', flexShrink: 0 }}>
                <div style={{ flex: 1, display: 'flex', gap: '10px' }}>
                    <select
                        onChange={(e) => {
                            handleProfileSelect(e.target.value);
                            // Keep the value selected so we can delete it
                            // e.target.value = ""; 
                        }}
                        value={selectedProfileName}
                        style={{ flex: 1, padding: '10px', borderRadius: '8px', border: '1px solid var(--glass-border)', backgroundColor: 'rgba(0,0,0,0.2)', color: 'white' }}
                    >
                        <option value="" disabled>Load Saved Task...</option>
                        {profiles.map((p: any) => <option key={p.name} value={p.name}>{p.name}</option>)}
                    </select>
                    {selectedProfileName && (
                        <button
                            onClick={handleDeleteHistoryItem}
                            style={{
                                background: 'rgba(244, 67, 54, 0.1)',
                                border: '1px solid rgba(244, 67, 54, 0.3)',
                                color: '#f44336',
                                borderRadius: '8px',
                                padding: '0 15px',
                                cursor: 'pointer',
                                fontSize: '1.2em'
                            }}
                            title="Delete Saved Task"
                        >
                            🗑️
                        </button>
                    )}
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
            <div style={{ flex: 1, overflowY: 'auto', paddingRight: '10px', minHeight: 0 }}>
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
                            gap: '15px',
                            padding: '15px 20px',
                            borderLeft: task.is_logged ? '4px solid #4caf50' : '4px solid #ff9800',
                            background: task.is_logged ? 'rgba(76, 175, 80, 0.05)' : 'rgba(30, 30, 36, 0.6)',
                            transition: 'all 0.3s ease'
                        }}>
                            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '5px' }}>
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
                                        padding: '0',
                                        outline: 'none',
                                        textDecoration: 'none',
                                        opacity: task.is_logged ? 0.7 : 1
                                    }}
                                />

                                {/* Editable Comment Field */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                    <span style={{ fontSize: '0.9em', color: 'var(--text-secondary)' }}>Comment:</span>
                                    <input
                                        type="text"
                                        value={task.comments || ''}
                                        placeholder="Add a comment..."
                                        onChange={(e) => {
                                            const newComment = e.target.value;
                                            setTasks(prev => prev.map(t => t.id === task.id ? { ...t, comments: newComment } : t));
                                        }}
                                        onBlur={() => handleUpdateTask(task)}
                                        style={{
                                            background: 'transparent',
                                            border: 'none',
                                            borderBottom: '1px solid rgba(255,255,255,0.1)',
                                            color: 'var(--text-secondary)',
                                            fontSize: '0.9em',
                                            width: '100%',
                                            padding: '2px 0'
                                        }}
                                    />
                                </div>

                                <div style={{ fontSize: '0.85em', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <span>{task.redmine_issue_id ? `Issue #${task.redmine_issue_id}` : 'No Issue Linked'}</span>
                                    <span style={{
                                        fontSize: '0.8em',
                                        fontWeight: 'bold',
                                        color: task.is_logged ? '#4caf50' : '#ff9800',
                                        border: `1px solid ${task.is_logged ? '#4caf50' : '#ff9800'}`,
                                        padding: '1px 6px',
                                        borderRadius: '4px'
                                    }}>
                                        {task.is_logged ? 'LOGGED' : 'PENDING'}
                                    </span>
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

                            {/* Pause Button */}
                            {!task.is_logged && (
                                <button
                                    onClick={() => {
                                        const updatedTask = { ...task, is_paused: !task.is_paused };
                                        handleUpdateTask(updatedTask);
                                    }}
                                    style={{
                                        background: 'transparent',
                                        border: 'none',
                                        cursor: 'pointer',
                                        color: task.is_paused ? '#ff9800' : 'var(--text-secondary)',
                                        padding: '8px',
                                        borderRadius: '50%',
                                        fontSize: '1.2em',
                                        transition: 'all 0.2s',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        opacity: task.is_paused ? 1 : 0.5
                                    }}
                                    onMouseEnter={(e) => { e.currentTarget.style.opacity = '1'; }}
                                    onMouseLeave={(e) => { e.currentTarget.style.opacity = task.is_paused ? '1' : '0.5'; }}
                                    title={task.is_paused ? "Resume Auto-Log" : "Pause Auto-Log"}
                                >
                                    {task.is_paused ? '⏸️' : '⏯️'}
                                </button>
                            )}

                            {!task.is_logged && (
                                <button
                                    onClick={() => handleLogTask(task)}
                                    style={{
                                        background: 'transparent',
                                        border: 'none',
                                        cursor: 'pointer',
                                        color: 'var(--primary)',
                                        padding: '8px',
                                        borderRadius: '50%',
                                        fontSize: '1.2em',
                                        transition: 'all 0.2s',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center'
                                    }}
                                    onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(100, 108, 255, 0.1)'; }}
                                    onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                                    title="Log to Redmine"
                                >
                                    🕑
                                </button>
                            )}

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
                        </div>
                    ))}
                </div>
            </div>

            {/* Footer */}
            <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px solid rgba(255,255,255,0.1)', display: 'flex', justifyContent: 'flex-end', alignItems: 'baseline', gap: '10px', flexShrink: 0 }}>
                <span style={{ color: 'var(--text-secondary)', fontSize: '1.1em' }}>Total Planned:</span>
                <span style={{ fontSize: '2em', fontWeight: 'bold', background: 'var(--accent-gradient)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                    {totalPlanned.toFixed(1)}h
                </span>
            </div>


        </div>
    );
};

export default PlannerView;
