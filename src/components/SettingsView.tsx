import { useState, useEffect, useRef } from 'react';
import { ToastContainer } from './Toast';
import ConfirmModal from './ConfirmModal';

interface Profile {
    name: string;
    project_id: number;
    issue_id: number;
    activity_id: number;
    comments: string;
    rd_function_team?: string;
    project_name?: string;
    issue_name?: string;
}

interface Project {
    id: number;
    name: string;
}

interface Issue {
    id: number;
    subject: string;
}

interface Activity {
    id: number;
    name: string;
}

const RD_FUNCTION_TEAMS = [
    "SW_Platform_management", "SW_OS/BSP", "SW_Networking", "SW_APTC", "SW_PM", "SW_QA",
    "BIOS", "EE1", "EE2", "EE3", "ME", "Thermal", "N/A", "EE4", "SE"
];

const SettingsView = () => {
    const [activeTab, setActiveTab] = useState<'general' | 'profiles'>('general');
    const [apiKey, setApiKey] = useState('');
    const [status, setStatus] = useState('');
    const [syncStatus, setSyncStatus] = useState('');

    // Profile State
    const [profiles, setProfiles] = useState<Profile[]>([]);
    const [projects, setProjects] = useState<Project[]>([]);
    const [activities, setActivities] = useState<Activity[]>([]);
    const [projectIssues, setProjectIssues] = useState<Issue[]>([]);

    const [profileMode, setProfileMode] = useState<'project' | 'issue'>('project');
    const [newProfileName, setNewProfileName] = useState('');
    const [newProfileComment, setNewProfileComment] = useState('');

    const [selectedProject, setSelectedProject] = useState<number | ''>('');
    const [selectedIssue, setSelectedIssue] = useState<number | ''>('');
    const [selectedActivity, setSelectedActivity] = useState<number | ''>('');
    const [selectedRdTeam, setSelectedRdTeam] = useState('N/A');

    const [issueIdInput, setIssueIdInput] = useState('');
    const [issueSearchStatus, setIssueSearchStatus] = useState('');
    const [loadingIssues, setLoadingIssues] = useState(false);

    // New Settings State
    const [alertTime, setAlertTime] = useState('17:00');
    const [autoLogTime, setAutoLogTime] = useState('18:00');
    const [calendarStartTime, setCalendarStartTime] = useState('06:00');
    const [calendarEndTime, setCalendarEndTime] = useState('21:00');

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
        fetchSettings();
        fetchProfiles();
        fetchProjects();
        fetchActivities();
    }, []);

    // Fetch issues when a project is selected
    useEffect(() => {
        if (selectedProject && profileMode === 'project') {
            fetchProjectIssues(Number(selectedProject));
        } else {
            setProjectIssues([]);
        }
    }, [selectedProject, profileMode]);

    const fetchSettings = () => {
        fetch('http://127.0.0.1:8000/api/settings')
            .then(res => res.json())
            .then(data => {
                setApiKey(data.api_key || '');
                setAlertTime(data.alert_time || '17:00');
                setAutoLogTime(data.auto_log_time || '18:00');
                setCalendarStartTime(data.calendar_start_time || '06:00');
                setCalendarEndTime(data.calendar_end_time || '21:00');
            })
            .catch(console.error);
    };

    const fetchProfiles = () => {
        fetch('http://127.0.0.1:8000/api/profiles')
            .then(res => res.json())
            .then(setProfiles)
            .catch(console.error);
    };

    const fetchProjects = () => {
        fetch('http://127.0.0.1:8000/api/redmine/projects')
            .then(res => res.json())
            .then(data => Array.isArray(data) ? setProjects(data) : setProjects([]))
            .catch(console.error);
    };

    const fetchActivities = () => {
        fetch('http://127.0.0.1:8000/api/redmine/activities')
            .then(res => res.json())
            .then(data => {
                if (typeof data === 'object' && !Array.isArray(data)) {
                    const list = Object.entries(data).map(([id, name]) => ({ id: Number(id), name: String(name) }));
                    setActivities(list);
                } else if (Array.isArray(data)) {
                    setActivities(data);
                }
            })
            .catch(console.error);
    };

    const fetchProjectIssues = (projectId: number) => {
        setLoadingIssues(true);
        fetch(`http://127.0.0.1:8000/api/redmine/issues?project_id=${projectId}&scope=all`) // Scope all to see all issues in project
            .then(res => res.json())
            .then(data => {
                if (Array.isArray(data)) {
                    setProjectIssues(data);
                } else {
                    setProjectIssues([]);
                }
                setLoadingIssues(false);
            })
            .catch(err => {
                console.error(err);
                setProjectIssues([]);
                setLoadingIssues(false);
            });
    };

    const saveSettings = () => {
        fetch('http://127.0.0.1:8000/api/settings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                api_key: apiKey,
                redmine_url: 'http://advrm.advantech.com:3002/', // Assuming default or fetched
                alert_time: alertTime,
                auto_log_time: autoLogTime,
                calendar_start_time: calendarStartTime,
                calendar_end_time: calendarEndTime
            })
        })
            .then(res => res.json())
            .then(data => {
                setStatus(data.message);
                addToast("Settings saved", 'success');
            })
            .catch(() => {
                setStatus('Error saving settings');
                addToast("Error saving settings", 'error');
            });
    };

    const syncData = () => {
        setSyncStatus('Syncing...');
        fetch('http://127.0.0.1:8000/api/sync', { method: 'POST' })
            .then(res => res.json())
            .then(data => {
                if (data.status === 'ignored') {
                    setSyncStatus(data.message);
                    addToast(data.message, 'info');
                } else if (data.error) {
                    setSyncStatus(`Error: ${data.error}`);
                    addToast(`Sync Error: ${data.error}`, 'error');
                } else {
                    const msg = `Synced successfully at ${new Date().toLocaleTimeString()}`;
                    setSyncStatus(msg);
                    addToast("Data synced successfully", 'success');
                }
            })
            .catch(err => {
                setSyncStatus(`Sync failed: ${err}`);
                addToast("Sync failed", 'error');
            });
    };

    const handleIssueSearch = async () => {
        if (!issueIdInput) return;
        setIssueSearchStatus('Searching...');
        try {
            const res = await fetch(`http://127.0.0.1:8000/api/redmine/issue/${issueIdInput}`);
            const data = await res.json();
            if (data.error) {
                setIssueSearchStatus('Issue not found');
                addToast("Issue not found", 'error');
            } else {
                setIssueSearchStatus(`Found: ${data.subject}`);
                if (!newProfileName) {
                    setNewProfileName(data.subject);
                }
            }
        } catch (e) {
            setIssueSearchStatus('Error searching issue');
            addToast("Error searching issue", 'error');
        }
    };

    const saveProfile = async () => {
        if (!newProfileName) {
            addToast("Please enter a profile name", 'error');
            return;
        }
        if (!selectedActivity) {
            addToast("Please select an activity", 'error');
            return;
        }

        const profileData: any = {
            name: newProfileName,
            comments: newProfileComment,
            activity_id: Number(selectedActivity),
            rd_function_team: selectedRdTeam
        };

        if (profileMode === 'project') {
            if (!selectedProject) {
                addToast("Please select a project", 'error');
                return;
            }
            if (!selectedIssue) {
                addToast("Please select an issue", 'error');
                return;
            }

            profileData.project_id = Number(selectedProject);
            profileData.issue_id = Number(selectedIssue);

            const proj = projects.find(p => p.id === Number(selectedProject));
            if (proj) profileData.project_name = proj.name;

            const issue = projectIssues.find(i => i.id === Number(selectedIssue));
            if (issue) profileData.issue_name = issue.subject;

        } else {
            if (!issueIdInput) {
                addToast("Please enter an Issue ID", 'error');
                return;
            }
            profileData.issue_id = Number(issueIdInput);

            try {
                const res = await fetch(`http://127.0.0.1:8000/api/redmine/issue/${issueIdInput}`);
                const data = await res.json();
                if (!data.error && data.project) {
                    profileData.project_id = data.project.id;
                    profileData.project_name = data.project.name;
                    profileData.issue_name = data.subject;
                } else {
                    profileData.project_id = 0;
                }
            } catch (e) {
                console.error("Failed to resolve issue details for profile", e);
                profileData.project_id = 0;
            }
        }

        fetch('http://127.0.0.1:8000/api/profiles', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(profileData)
        })
            .then(res => res.json())
            .then(data => {
                if (data.status === 'success') {
                    setProfiles(data.profiles);
                    setNewProfileName('');
                    setNewProfileComment('');
                    setIssueIdInput('');
                    setIssueSearchStatus('');
                    setSelectedRdTeam('N/A');
                    setSelectedIssue(''); // Reset issue selection
                    addToast("Profile saved!", 'success');
                } else {
                    addToast(`Error: ${data.error || 'Unknown error'}`, 'error');
                }
            })
            .catch(err => {
                console.error(err);
                addToast("Failed to save profile", 'error');
            });
    };

    const deleteProfile = async (name: string) => {
        const confirmed = await openConfirm(`Delete profile "${name}"?`, "Delete Profile");
        if (!confirmed) return;

        fetch(`http://127.0.0.1:8000/api/profile?name=${encodeURIComponent(name)}`, { method: 'DELETE' })
            .then(res => res.json())
            .then(data => {
                if (data.status === 'success') {
                    setProfiles(data.profiles);
                    addToast("Profile deleted", 'success');
                } else {
                    addToast("Failed to delete profile", 'error');
                }
            })
            .catch(err => {
                console.error(err);
                addToast("Failed to delete profile", 'error');
            });
    };

    const handleEditProfile = (profile: Profile) => {
        setNewProfileName(profile.name);
        setNewProfileComment(profile.comments);
        setSelectedActivity(profile.activity_id);
        setSelectedRdTeam(profile.rd_function_team || 'N/A');

        // Logic to determine mode based on profile data could be improved
        // For now, if we have project ID, we default to project mode if possible
        // But since we need to load issues, it might be tricky to auto-select the issue immediately if not loaded
        // So we might default to Issue ID mode for editing to be safe, or trigger load

        if (profile.issue_id && profile.issue_id > 0) {
            // If we have an issue ID, we can use Issue ID mode for simplicity in editing
            // OR try to set project mode if we know the project
            setProfileMode('issue');
            setIssueIdInput(profile.issue_id.toString());
        } else if (profile.project_id) {
            setProfileMode('project');
            setSelectedProject(profile.project_id);
            // We won't have the issue selected until issues load, which is async
        }

        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    // Shared Styles
    const inputStyle = {
        width: '100%',
        padding: '12px',
        borderRadius: '6px',
        border: '1px solid #444',
        background: '#1a1a1a',
        color: 'white',
        fontSize: '1em',
        boxSizing: 'border-box' as const
    };

    const labelStyle = {
        display: 'block',
        marginBottom: '8px',
        color: '#ddd',
        fontSize: '0.95em',
        fontWeight: 500
    };

    const cardStyle = {
        background: '#2a2a2a',
        padding: '30px',
        borderRadius: '12px',
        marginBottom: '30px',
        boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
    };

    const buttonStyle = {
        padding: '12px 24px',
        borderRadius: '6px',
        border: 'none',
        cursor: 'pointer',
        fontWeight: 600,
        fontSize: '1em',
        transition: 'background 0.2s'
    };

    return (
        <div style={{ padding: '40px 20px', maxWidth: '900px', margin: '0 auto', color: 'white' }}>
            <ToastContainer toasts={toasts} removeToast={removeToast} />
            <ConfirmModal
                isOpen={confirmModal.isOpen}
                message={confirmModal.message}
                title={confirmModal.title}
                onConfirm={confirmModal.onConfirm}
                onCancel={handleConfirmCancel}
            />

            <div style={{ textAlign: 'center', marginBottom: '30px' }}>
                <h2 style={{ margin: '0 0 10px 0', fontSize: '1.8em', background: 'var(--accent-gradient)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Settings</h2>
                <div style={{ fontSize: '0.9em', color: 'var(--text-secondary)', marginTop: '5px' }}>
                    Configure application preferences and profiles
                </div>
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', gap: '5px', marginBottom: '30px', borderBottom: '2px solid #333' }}>
                <button
                    onClick={() => setActiveTab('general')}
                    style={{
                        background: activeTab === 'general' ? '#333' : 'transparent',
                        border: 'none',
                        borderBottom: activeTab === 'general' ? '2px solid #3b82f6' : 'none',
                        padding: '12px 24px',
                        color: activeTab === 'general' ? 'white' : '#aaa',
                        borderRadius: '8px 8px 0 0',
                        cursor: 'pointer',
                        fontSize: '1.05em',
                        fontWeight: 500,
                        marginBottom: '-2px'
                    }}
                >
                    General
                </button>
                <button
                    onClick={() => setActiveTab('profiles')}
                    style={{
                        background: activeTab === 'profiles' ? '#333' : 'transparent',
                        border: 'none',
                        borderBottom: activeTab === 'profiles' ? '2px solid #3b82f6' : 'none',
                        padding: '12px 24px',
                        color: activeTab === 'profiles' ? 'white' : '#aaa',
                        borderRadius: '8px 8px 0 0',
                        cursor: 'pointer',
                        fontSize: '1.05em',
                        fontWeight: 500,
                        marginBottom: '-2px'
                    }}
                >
                    Saved Profiles
                </button>
            </div>

            {
                activeTab === 'general' && (
                    <>
                        <div style={cardStyle}>
                            <h3 style={{ marginTop: 0, marginBottom: '20px', fontSize: '1.3em' }}>Redmine Configuration</h3>
                            <div style={{ marginBottom: '20px' }}>
                                <label style={labelStyle}>Redmine API Key</label>
                                <input
                                    type="password"
                                    value={apiKey}
                                    onChange={(e) => setApiKey(e.target.value)}
                                    placeholder="Enter your API Key"
                                    style={inputStyle}
                                />
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
                                <div>
                                    <label style={labelStyle}>Calendar Start Time</label>
                                    <input
                                        type="time"
                                        value={calendarStartTime}
                                        onChange={(e) => setCalendarStartTime(e.target.value)}
                                        style={inputStyle}
                                    />
                                </div>
                                <div>
                                    <label style={labelStyle}>Calendar End Time</label>
                                    <input
                                        type="time"
                                        value={calendarEndTime}
                                        onChange={(e) => setCalendarEndTime(e.target.value)}
                                        style={inputStyle}
                                    />
                                </div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                                <button
                                    onClick={saveSettings}
                                    style={{ ...buttonStyle, background: '#22c55e', color: 'white' }}
                                >
                                    Save Configuration
                                </button>
                                {status && <span style={{ color: '#4ade80' }}>{status}</span>}
                            </div>
                        </div>

                        <div style={cardStyle}>
                            <h3 style={{ marginTop: 0, marginBottom: '20px', fontSize: '1.3em' }}>Data Synchronization</h3>
                            <p style={{ color: '#aaa', fontSize: '0.95em', marginBottom: '20px', lineHeight: '1.5' }}>
                                To prevent blocking by Redmine, data is cached locally.
                                Click below to manually refresh projects, issues, and recent time entries.
                            </p>
                            <button
                                onClick={syncData}
                                style={{ ...buttonStyle, background: '#3b82f6', color: 'white', width: '100%' }}
                            >
                                Sync Data from Redmine
                            </button>
                            {syncStatus && <div style={{ marginTop: '15px', fontSize: '0.9em', color: '#aaa', textAlign: 'center' }}>{syncStatus}</div>}
                        </div>
                    </>
                )
            }

            {
                activeTab === 'profiles' && (
                    <>
                        <div style={cardStyle}>
                            <h3 style={{ marginTop: 0, marginBottom: '25px', fontSize: '1.3em' }}>Create New Profile</h3>

                            <div style={{ display: 'flex', gap: '30px', marginBottom: '25px' }}>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '1em' }}>
                                    <input
                                        type="radio"
                                        name="profileMode"
                                        checked={profileMode === 'project'}
                                        onChange={() => setProfileMode('project')}
                                        style={{ width: '18px', height: '18px' }}
                                    />
                                    Search by Project
                                </label>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '1em' }}>
                                    <input
                                        type="radio"
                                        name="profileMode"
                                        checked={profileMode === 'issue'}
                                        onChange={() => setProfileMode('issue')}
                                        style={{ width: '18px', height: '18px' }}
                                    />
                                    Enter Issue ID
                                </label>
                            </div>

                            {profileMode === 'project' ? (
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
                                    <div>
                                        <label style={labelStyle}>Project</label>
                                        <select
                                            value={selectedProject}
                                            onChange={e => setSelectedProject(Number(e.target.value))}
                                            style={inputStyle}
                                        >
                                            <option value="">Select Project</option>
                                            {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label style={labelStyle}>Issue</label>
                                        <select
                                            value={selectedIssue}
                                            onChange={e => {
                                                setSelectedIssue(Number(e.target.value));
                                                // Auto-fill name if empty
                                                const issue = projectIssues.find(i => i.id === Number(e.target.value));
                                                if (issue && !newProfileName) {
                                                    setNewProfileName(issue.subject);
                                                }
                                            }}
                                            style={inputStyle}
                                            disabled={!selectedProject || loadingIssues}
                                        >
                                            <option value="">{loadingIssues ? "Loading..." : "Select Issue"}</option>
                                            {projectIssues.map(i => <option key={i.id} value={i.id}>#{i.id} - {i.subject.substring(0, 50)}...</option>)}
                                        </select>
                                    </div>
                                </div>
                            ) : (
                                <div style={{ marginBottom: '20px' }}>
                                    <label style={labelStyle}>Issue ID</label>
                                    <div style={{ display: 'flex', gap: '10px' }}>
                                        <input
                                            type="text"
                                            placeholder="Enter Issue ID"
                                            value={issueIdInput}
                                            onChange={e => setIssueIdInput(e.target.value)}
                                            style={inputStyle}
                                        />
                                        <button
                                            onClick={handleIssueSearch}
                                            style={{ ...buttonStyle, background: '#3b82f6', color: 'white', whiteSpace: 'nowrap' }}
                                        >
                                            Search
                                        </button>
                                    </div>
                                    {issueSearchStatus && <div style={{ marginTop: '8px', fontSize: '0.9em', color: '#4ade80' }}>{issueSearchStatus}</div>}
                                </div>
                            )}

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
                                <div>
                                    <label style={labelStyle}>Activity</label>
                                    <select
                                        value={selectedActivity}
                                        onChange={e => setSelectedActivity(Number(e.target.value))}
                                        style={inputStyle}
                                    >
                                        <option value="">Select Activity</option>
                                        {activities.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label style={labelStyle}>RD Function Team</label>
                                    <select
                                        value={selectedRdTeam}
                                        onChange={e => setSelectedRdTeam(e.target.value)}
                                        style={inputStyle}
                                    >
                                        {RD_FUNCTION_TEAMS.map(team => <option key={team} value={team}>{team}</option>)}
                                    </select>
                                </div>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '30px' }}>
                                <div>
                                    <label style={labelStyle}>Profile Name</label>
                                    <input
                                        type="text"
                                        placeholder="e.g., Daily Standup"
                                        value={newProfileName}
                                        onChange={e => setNewProfileName(e.target.value)}
                                        style={inputStyle}
                                    />
                                </div>
                                <div>
                                    <label style={labelStyle}>Default Comment</label>
                                    <input
                                        type="text"
                                        placeholder="Defaults to Issue Name if empty"
                                        value={newProfileComment}
                                        onChange={e => setNewProfileComment(e.target.value)}
                                        style={inputStyle}
                                    />
                                </div>
                            </div>

                            <button
                                onClick={saveProfile}
                                style={{ ...buttonStyle, background: '#22c55e', color: 'white', width: '100%' }}
                            >
                                Save Profile
                            </button>
                        </div>

                        <div style={cardStyle}>
                            <h3 style={{ marginTop: 0, marginBottom: '20px', fontSize: '1.3em' }}>Existing Profiles</h3>
                            {profiles.length === 0 ? (
                                <p style={{ color: '#aaa', textAlign: 'center', padding: '20px' }}>No saved profiles yet.</p>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                                    {profiles.map((p, idx) => (
                                        <div key={idx} style={{
                                            padding: '20px',
                                            background: 'rgba(255,255,255,0.03)',
                                            borderRadius: '8px',
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center',
                                            border: '1px solid rgba(255,255,255,0.05)'
                                        }}>
                                            <div>
                                                <div style={{ fontWeight: 600, fontSize: '1.1em', marginBottom: '5px' }}>{p.name}</div>
                                                <div style={{ fontSize: '0.9em', color: '#aaa', marginBottom: '5px' }}>
                                                    {p.project_name ? p.project_name : `Project #${p.project_id}`}
                                                    {p.issue_id ? ` • Issue #${p.issue_id}` : ''}
                                                    {p.issue_name ? ` • ${p.issue_name}` : ''}
                                                </div>
                                                <div style={{ fontSize: '0.85em', color: '#888' }}>
                                                    Activity: {activities.find(a => a.id === p.activity_id)?.name || p.activity_id}
                                                    {p.rd_function_team && ` • Team: ${p.rd_function_team}`}
                                                    {p.comments && ` • Comment: ${p.comments}`}
                                                </div>
                                            </div>
                                            <div style={{ display: 'flex', gap: '10px' }}>
                                                <button
                                                    onClick={() => handleEditProfile(p)}
                                                    style={{ background: 'transparent', border: '1px solid #3b82f6', color: '#3b82f6', borderRadius: '4px', padding: '6px 12px', cursor: 'pointer', fontWeight: 500 }}
                                                >
                                                    Edit
                                                </button>
                                                <button
                                                    onClick={() => deleteProfile(p.name)}
                                                    style={{ background: 'transparent', border: '1px solid #f44336', color: '#f44336', borderRadius: '4px', padding: '6px 12px', cursor: 'pointer', fontWeight: 500 }}
                                                >
                                                    Delete
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </>
                )
            }
        </div >
    );
};

export default SettingsView;
