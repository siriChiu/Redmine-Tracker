import { useState, useEffect } from 'react';

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
    const [profileMode, setProfileMode] = useState<'project' | 'issue'>('project');
    const [newProfileName, setNewProfileName] = useState('');
    const [newProfileComment, setNewProfileComment] = useState('');
    const [selectedProject, setSelectedProject] = useState<number | ''>('');
    const [selectedActivity, setSelectedActivity] = useState<number | ''>('');
    const [selectedRdTeam, setSelectedRdTeam] = useState('N/A');
    const [issueIdInput, setIssueIdInput] = useState('');
    const [issueSearchStatus, setIssueSearchStatus] = useState('');

    useEffect(() => {
        fetchSettings();
        fetchProfiles();
        fetchProjects();
        fetchActivities();
    }, []);

    const fetchSettings = () => {
        fetch('http://127.0.0.1:8000/api/settings')
            .then(res => res.json())
            .then(data => {
                setApiKey(data.api_key || '');
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
                // Convert map to array if needed, or handle object
                // Assuming backend returns { id: name } map or list
                if (typeof data === 'object' && !Array.isArray(data)) {
                    const list = Object.entries(data).map(([id, name]) => ({ id: Number(id), name: String(name) }));
                    setActivities(list);
                } else if (Array.isArray(data)) {
                    setActivities(data);
                }
            })
            .catch(console.error);
    };

    const saveSettings = () => {
        fetch('http://127.0.0.1:8000/api/settings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                api_key: apiKey
            })
        })
            .then(res => res.json())
            .then(data => setStatus(data.message))
            .catch(err => setStatus('Error saving settings'));
    };

    const syncData = () => {
        setSyncStatus('Syncing...');
        fetch('http://127.0.0.1:8000/api/sync', { method: 'POST' })
            .then(res => res.json())
            .then(data => {
                if (data.status === 'ignored') {
                    setSyncStatus(data.message);
                } else if (data.error) {
                    setSyncStatus(`Error: ${data.error}`);
                } else {
                    setSyncStatus(`Synced successfully at ${new Date().toLocaleTimeString()}`);
                }
            })
            .catch(err => setSyncStatus(`Sync failed: ${err}`));
    };

    const handleIssueSearch = async () => {
        if (!issueIdInput) return;
        setIssueSearchStatus('Searching...');
        try {
            const res = await fetch(`http://127.0.0.1:8000/api/redmine/issue/${issueIdInput}`);
            const data = await res.json();
            if (data.error) {
                setIssueSearchStatus('Issue not found');
            } else {
                setIssueSearchStatus(`Found: ${data.subject}`);
                // Auto-fill name if empty
                if (!newProfileName) {
                    setNewProfileName(data.subject);
                }
            }
        } catch (e) {
            setIssueSearchStatus('Error searching issue');
        }
    };

    const saveProfile = async () => {
        if (!newProfileName) {
            alert("Please enter a profile name");
            return;
        }
        if (!selectedActivity) {
            alert("Please select an activity");
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
                alert("Please select a project");
                return;
            }
            profileData.project_id = Number(selectedProject);
            profileData.issue_id = 0;
            const proj = projects.find(p => p.id === Number(selectedProject));
            if (proj) profileData.project_name = proj.name;
        } else {
            if (!issueIdInput) {
                alert("Please enter an Issue ID");
                return;
            }
            profileData.issue_id = Number(issueIdInput);

            // Fetch details to get project ID/Name if not already known
            try {
                const res = await fetch(`http://127.0.0.1:8000/api/redmine/issue/${issueIdInput}`);
                const data = await res.json();
                if (!data.error && data.project) {
                    profileData.project_id = data.project.id;
                    profileData.project_name = data.project.name;
                    profileData.issue_name = data.subject;
                } else {
                    profileData.project_id = 0; // Fallback
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
                    alert("Profile saved!");
                }
            })
            .catch(console.error);
    };

    const deleteProfile = (name: string) => {
        if (!confirm(`Delete profile "${name}"?`)) return;

        fetch(`http://127.0.0.1:8000/api/profile?name=${encodeURIComponent(name)}`, { method: 'DELETE' })
            .then(res => res.json())
            .then(data => {
                if (data.status === 'success') {
                    setProfiles(data.profiles);
                }
            })
            .catch(console.error);
    };

    const handleEditProfile = (profile: Profile) => {
        setNewProfileName(profile.name);
        setNewProfileComment(profile.comments);
        setSelectedActivity(profile.activity_id);
        setSelectedRdTeam(profile.rd_function_team || 'N/A');

        if (profile.issue_id && profile.issue_id > 0) {
            setProfileMode('issue');
            setIssueIdInput(profile.issue_id.toString());
            // Optionally trigger search to refresh details
            // handleIssueSearch(); 
        } else {
            setProfileMode('project');
            setSelectedProject(profile.project_id);
        }

        // Scroll to top to show the form
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    return (
        <div style={{ padding: '20px', maxWidth: '800px', color: 'white' }}>
            <h1 style={{ marginBottom: '20px' }}>Settings</h1>

            <div style={{ display: 'flex', gap: '20px', marginBottom: '20px', borderBottom: '1px solid #444' }}>
                <button
                    onClick={() => setActiveTab('general')}
                    style={{
                        background: activeTab === 'general' ? '#333' : 'transparent',
                        border: 'none',
                        borderBottom: activeTab === 'general' ? '2px solid #3b82f6' : 'none',
                        padding: '10px 20px',
                        color: activeTab === 'general' ? 'white' : '#aaa',
                        borderRadius: '8px 8px 0 0',
                        cursor: 'pointer'
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
                        padding: '10px 20px',
                        color: activeTab === 'profiles' ? 'white' : '#aaa',
                        borderRadius: '8px 8px 0 0',
                        cursor: 'pointer'
                    }}
                >
                    Saved Profiles
                </button>
            </div>

            {activeTab === 'general' && (
                <>
                    <div className="card" style={{ background: '#2a2a2a', padding: '20px', borderRadius: '8px', marginBottom: '20px' }}>
                        <h3>Redmine Configuration</h3>
                        <div style={{ marginBottom: '15px' }}>
                            <label style={{ display: 'block', marginBottom: '5px', color: '#ddd' }}>Redmine API Key</label>
                            <input
                                type="password"
                                value={apiKey}
                                onChange={(e) => setApiKey(e.target.value)}
                                placeholder="Enter your API Key"
                                style={{ width: '100%', padding: '10px', borderRadius: '4px', border: '1px solid #444', background: '#1a1a1a', color: 'white' }}
                            />
                        </div>
                        <button onClick={saveSettings} style={{ background: '#22c55e', color: 'white', padding: '10px 20px', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
                            Save Configuration
                        </button>
                        {status && <span style={{ marginLeft: '10px', color: '#4ade80' }}>{status}</span>}
                    </div>

                    <div className="card" style={{ background: '#2a2a2a', padding: '20px', borderRadius: '8px' }}>
                        <h3>Data Synchronization</h3>
                        <p style={{ color: '#aaa', fontSize: '0.9em', marginBottom: '15px' }}>
                            To prevent blocking by Redmine, data is cached locally.
                            Click below to manually refresh projects, issues, and recent time entries.
                        </p>
                        <button onClick={syncData} style={{ background: '#3b82f6', color: 'white', padding: '10px 20px', border: 'none', borderRadius: '4px', width: '100%', cursor: 'pointer' }}>
                            Sync Data from Redmine
                        </button>
                        {syncStatus && <div style={{ marginTop: '10px', fontSize: '0.9em', color: '#aaa', textAlign: 'center' }}>{syncStatus}</div>}
                    </div>
                </>
            )}

            {activeTab === 'profiles' && (
                <>
                    <div className="card" style={{ background: '#2a2a2a', padding: '20px', borderRadius: '8px', marginBottom: '20px' }}>
                        <h3>Create New Profile</h3>

                        <div style={{ display: 'flex', gap: '20px', marginBottom: '15px' }}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer' }}>
                                <input
                                    type="radio"
                                    name="profileMode"
                                    checked={profileMode === 'project'}
                                    onChange={() => setProfileMode('project')}
                                />
                                Search by Project
                            </label>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer' }}>
                                <input
                                    type="radio"
                                    name="profileMode"
                                    checked={profileMode === 'issue'}
                                    onChange={() => setProfileMode('issue')}
                                />
                                Enter Issue ID
                            </label>
                        </div>

                        {profileMode === 'project' ? (
                            <div style={{ marginBottom: '15px' }}>
                                <select
                                    value={selectedProject}
                                    onChange={e => setSelectedProject(Number(e.target.value))}
                                    style={{ width: '100%', padding: '10px', borderRadius: '4px', border: '1px solid #444', background: '#1a1a1a', color: 'white' }}
                                >
                                    <option value="">Select Project</option>
                                    {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                </select>
                            </div>
                        ) : (
                            <div style={{ marginBottom: '15px' }}>
                                <div style={{ display: 'flex', gap: '10px' }}>
                                    <input
                                        type="text"
                                        placeholder="Issue ID"
                                        value={issueIdInput}
                                        onChange={e => setIssueIdInput(e.target.value)}
                                        style={{ flex: 1, padding: '10px', borderRadius: '4px', border: '1px solid #444', background: '#1a1a1a', color: 'white' }}
                                    />
                                    <button
                                        onClick={handleIssueSearch}
                                        style={{ padding: '0 15px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                                    >
                                        Search
                                    </button>
                                </div>
                                {issueSearchStatus && <div style={{ marginTop: '5px', fontSize: '0.9em', color: '#4ade80' }}>{issueSearchStatus}</div>}
                            </div>
                        )}

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '15px' }}>
                            <div>
                                <label style={{ display: 'block', marginBottom: '5px', color: '#ddd' }}>Activity</label>
                                <select
                                    value={selectedActivity}
                                    onChange={e => setSelectedActivity(Number(e.target.value))}
                                    style={{ width: '100%', padding: '10px', borderRadius: '4px', border: '1px solid #444', background: '#1a1a1a', color: 'white' }}
                                >
                                    <option value="">Select Activity</option>
                                    {activities.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                                </select>
                            </div>
                            <div>
                                <label style={{ display: 'block', marginBottom: '5px', color: '#ddd' }}>RD Function Team</label>
                                <select
                                    value={selectedRdTeam}
                                    onChange={e => setSelectedRdTeam(e.target.value)}
                                    style={{ width: '100%', padding: '10px', borderRadius: '4px', border: '1px solid #444', background: '#1a1a1a', color: 'white' }}
                                >
                                    {RD_FUNCTION_TEAMS.map(team => <option key={team} value={team}>{team}</option>)}
                                </select>
                            </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '20px' }}>
                            <div>
                                <label style={{ display: 'block', marginBottom: '5px', color: '#ddd' }}>Profile Name</label>
                                <input
                                    type="text"
                                    placeholder="e.g., Daily Standup"
                                    value={newProfileName}
                                    onChange={e => setNewProfileName(e.target.value)}
                                    style={{ width: '100%', padding: '10px', borderRadius: '4px', border: '1px solid #444', background: '#1a1a1a', color: 'white' }}
                                />
                            </div>
                            <div>
                                <label style={{ display: 'block', marginBottom: '5px', color: '#ddd' }}>Default Comment</label>
                                <input
                                    type="text"
                                    placeholder="Defaults to Issue Name if empty"
                                    value={newProfileComment}
                                    onChange={e => setNewProfileComment(e.target.value)}
                                    style={{ width: '100%', padding: '10px', borderRadius: '4px', border: '1px solid #444', background: '#1a1a1a', color: 'white' }}
                                />
                            </div>
                        </div>

                        <button onClick={saveProfile} style={{ background: '#22c55e', color: 'white', padding: '10px 20px', border: 'none', borderRadius: '4px', width: '100%', cursor: 'pointer' }}>
                            Save Profile
                        </button>
                    </div>

                    <div className="card" style={{ background: '#2a2a2a', padding: '20px', borderRadius: '8px' }}>
                        <h3>Existing Profiles</h3>
                        {profiles.length === 0 ? (
                            <p style={{ color: '#aaa' }}>No saved profiles yet.</p>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                {profiles.map((p, idx) => (
                                    <div key={idx} style={{
                                        padding: '15px',
                                        background: 'rgba(255,255,255,0.05)',
                                        borderRadius: '6px',
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center'
                                    }}>
                                        <div>
                                            <div style={{ fontWeight: 'bold', fontSize: '1.1em' }}>{p.name}</div>
                                            <div style={{ fontSize: '0.85em', color: '#aaa' }}>
                                                {p.project_name ? p.project_name : `Project #${p.project_id}`}
                                                {p.issue_id ? ` • Issue #${p.issue_id}` : ''}
                                                {p.issue_name ? ` • ${p.issue_name}` : ''}
                                            </div>
                                            <div style={{ fontSize: '0.8em', color: '#888', marginTop: '4px' }}>
                                                Activity: {activities.find(a => a.id === p.activity_id)?.name || p.activity_id}
                                                {p.rd_function_team && ` • Team: ${p.rd_function_team}`}
                                                {p.comments && ` • Comment: ${p.comments}`}
                                            </div>
                                        </div>
                                        <div style={{ display: 'flex', gap: '10px' }}>
                                            <button
                                                onClick={() => handleEditProfile(p)}
                                                style={{ background: 'transparent', border: '1px solid #3b82f6', color: '#3b82f6', borderRadius: '4px', padding: '5px 10px', cursor: 'pointer' }}
                                            >
                                                Edit
                                            </button>
                                            <button
                                                onClick={() => deleteProfile(p.name)}
                                                style={{ background: 'transparent', border: '1px solid #f44336', color: '#f44336', borderRadius: '4px', padding: '5px 10px', cursor: 'pointer' }}
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
            )}
        </div>
    );
};

export default SettingsView;
