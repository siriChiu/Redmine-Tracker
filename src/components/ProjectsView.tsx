import { useState, useEffect, useMemo } from 'react';
import { ToastContainer } from './Toast';
import IssueDetailModal from './IssueDetailModal';

interface Profile {
    name: string;
    project_id?: number;
    issue_id?: number;
    redmine_issue_id?: number;
    activity_id?: number;
    comments?: string;
    rd_function_team?: string;
}

interface Journal {
    user: string;
    created_on: string;
    notes: string;
}

interface CustomField {
    id: number;
    name: string;
    value: any;
}

interface IssueDetail {
    id: number;
    subject: string;
    description: string;
    status: string;
    priority: string;
    author: string;
    assigned_to: string;
    start_date: string;
    due_date: string;
    done_ratio: number;
    estimated_hours: any;
    spent_hours: any;
    fixed_version: string; // Target version
    category: string; // Component
    project: { id: number; name: string };
    journals: Journal[];
    url: string;
    custom_fields: CustomField[];
}

const ProjectsView = () => {
    const [profiles, setProfiles] = useState<Profile[]>([]);
    const [selectedProfileName, setSelectedProfileName] = useState('');
    const [issue, setIssue] = useState<IssueDetail | null>(null);
    const [loading, setLoading] = useState(false);
    const [loadingProfiles, setLoadingProfiles] = useState(true);
    const [error, setError] = useState('');

    // My Issues Mode State
    const [viewMode, setViewMode] = useState<'profiles' | 'my-issues'>('profiles');
    const [myIssues, setMyIssues] = useState<any[]>([]);
    const [projectFilter, setProjectFilter] = useState('');
    const [activities, setActivities] = useState<{ id: number; name: string }[]>([]);
    const [loadingMyIssues, setLoadingMyIssues] = useState(false);
    const [hiddenIssueIds, setHiddenIssueIds] = useState<number[]>(() => {
        try {
            const saved = localStorage.getItem('redmine_hidden_issues');
            return saved ? JSON.parse(saved) : [];
        } catch (e) {
            console.error("Failed to load hidden issues", e);
            return [];
        }
    });

    useEffect(() => {
        localStorage.setItem('redmine_hidden_issues', JSON.stringify(hiddenIssueIds));
    }, [hiddenIssueIds]);

    const toggleHideIssue = (id: number) => {
        setHiddenIssueIds(prev =>
            prev.includes(id)
                ? prev.filter(hid => hid !== id)
                : [...prev, id]
        );
    };

    // Issue Detail Modal State
    const [showDetailModal, setShowDetailModal] = useState(false);
    const [detailIssueId, setDetailIssueId] = useState<number | null>(null);

    const handleIssueClick = (id: number) => {
        setDetailIssueId(id);
        setShowDetailModal(true);
    };

    // Save Profile Modal State
    const [showSaveModal, setShowSaveModal] = useState(false);
    const [issueToSave, setIssueToSave] = useState<any>(null);
    const [saveProfileName, setSaveProfileName] = useState('');
    const [saveActivityId, setSaveActivityId] = useState<number | ''>('');
    const [saveComment, setSaveComment] = useState('');

    // Toast State
    const [toasts, setToasts] = useState<{ id: string; message: string; type: 'success' | 'error' | 'info' }[]>([]);

    const addToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
        const id = Date.now().toString();
        setToasts(prev => [...prev, { id, message, type }]);
    };

    const removeToast = (id: string) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    };

    useEffect(() => {
        fetchProfiles();
        fetchActivities();
    }, []);

    useEffect(() => {
        if (viewMode === 'my-issues') {
            fetchMyIssues();
        }
    }, [viewMode]);

    // Computed Properties for filtering
    const availableProjects = useMemo(() => {
        const distinct = new Map();
        myIssues.forEach(i => {
            if (i.project) {
                distinct.set(i.project.id, i.project.name);
            } else if (i.project_id) {
                // Fallback if full object not present
                distinct.set(i.project_id, `Project ${i.project_id}`);
            }
        });
        return Array.from(distinct.entries()).map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
    }, [myIssues]);

    const filteredIssues = useMemo(() => {
        if (!projectFilter) return myIssues;
        return myIssues.filter(i => {
            const pId = i.project ? i.project.id : i.project_id;
            return String(pId) === String(projectFilter);
        });
    }, [myIssues, projectFilter]);

    const fetchProfiles = () => {
        fetch('http://127.0.0.1:8000/api/profiles')
            .then(res => res.json())
            .then(data => {
                if (Array.isArray(data)) {
                    setProfiles(data);
                }
                setLoadingProfiles(false);
            })
            .catch(err => {
                console.error(err);
                addToast("Failed to load profiles", 'error');
                setLoadingProfiles(false);
            });
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

    const fetchMyIssues = () => {
        setLoadingMyIssues(true);
        // assigned_to_id=me is standard Redmine API, defaulting to open issues
        // Fetch MORE issues to ensure we get a good list for client-side filtering
        let url = `http://127.0.0.1:8000/api/redmine/issues?assigned_to_id=me&status_id=open&limit=100`;

        fetch(url)
            .then(res => res.json())
            .then(data => {
                if (Array.isArray(data)) {
                    setMyIssues(data);
                } else {
                    setMyIssues([]);
                }
                setLoadingMyIssues(false);
            })
            .catch(err => {
                console.error(err);
                addToast("Failed to load assigned issues", 'error');
                setLoadingMyIssues(false);
            });
    };

    const handleSaveProfileClick = (issue: any) => {
        setIssueToSave(issue);
        setSaveProfileName(issue.subject);
        setSaveActivityId(''); // User must select
        setSaveComment('');
        setShowSaveModal(true);
    };

    const confirmSaveProfile = () => {
        if (!saveProfileName || !saveActivityId) {
            addToast("Name and Activity are required", 'error');
            return;
        }

        const profileData = {
            name: saveProfileName,
            comments: saveComment,
            activity_id: Number(saveActivityId),
            issue_id: issueToSave.id,
            project_id: issueToSave.project.id,
            project_name: issueToSave.project.name,
            issue_name: issueToSave.subject
        };

        fetch('http://127.0.0.1:8000/api/profiles', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(profileData)
        })
            .then(res => res.json())
            .then(data => {
                if (data.status === 'success') {
                    addToast("Profile saved!", 'success');
                    setShowSaveModal(false);
                    fetchProfiles(); // Refresh profiles list
                } else {
                    addToast("Failed to save profile: " + (data.error || 'Unknown'), 'error');
                }
            })
            .catch(err => {
                console.error(err);
                addToast("Error saving profile", 'error');
            });
    };

    const handleProfileSelect = async (profileName: string) => {
        setSelectedProfileName(profileName);
        setIssue(null);
        setError('');

        const profile = profiles.find(p => p.name === profileName);
        if (!profile) return;

        const issueId = profile.issue_id || profile.redmine_issue_id;

        if (issueId) {
            setLoading(true);
            try {
                const res = await fetch(`http://127.0.0.1:8000/api/redmine/issue/${issueId}`);
                const data = await res.json();
                if (data.error) {
                    setError(data.error);
                } else {
                    setIssue(data);
                }
            } catch (err) {
                setError('Failed to load issue details.');
                console.error(err);
            } finally {
                setLoading(false);
            }
        } else {
            setError("This profile is not linked to a specific issue.");
        }
    };

    const getCustomField = (name: string) => {
        if (!issue || !issue.custom_fields) return null;
        const field = issue.custom_fields.find(f => f.name === name);
        return field ? field.value : null;
    };

    return (
        <div style={{ padding: '40px', maxWidth: '1000px', margin: '0 auto', color: 'white' }}>
            <ToastContainer toasts={toasts} removeToast={removeToast} />

            <div style={{ marginBottom: '30px', textAlign: 'center' }}>
                <h2 style={{ margin: '0 0 10px 0', fontSize: '1.8em', background: 'var(--accent-gradient)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                    Project Issue Viewer
                </h2>
                <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: '0.9em' }}>Select a profile to view its current issue status</p>
            </div>

            {/* Mode Switch Tabs */}
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '30px' }}>
                <div style={{ display: 'flex', background: 'rgba(255,255,255,0.1)', borderRadius: '8px', padding: '4px' }}>
                    <button
                        onClick={() => setViewMode('profiles')}
                        style={{
                            padding: '10px 24px',
                            background: viewMode === 'profiles' ? 'rgba(255,255,255,0.15)' : 'transparent',
                            border: 'none', color: 'white', borderRadius: '6px', cursor: 'pointer', fontWeight: 500
                        }}
                    >
                        Saved Profiles
                    </button>
                    <button
                        onClick={() => setViewMode('my-issues')}
                        style={{
                            padding: '10px 24px',
                            background: viewMode === 'my-issues' ? 'rgba(255,255,255,0.15)' : 'transparent',
                            border: 'none', color: 'white', borderRadius: '6px', cursor: 'pointer', fontWeight: 500
                        }}
                    >
                        Assigned to Me
                    </button>
                </div>
            </div>

            {/* Content Area */}
            {viewMode === 'profiles' ? (
                // EXISTING PROFILE SELECTOR
                <div className="glass-panel" style={{ padding: '20px', marginBottom: '30px', display: 'flex', justifyContent: 'center' }}>
                    {loadingProfiles ? (
                        <div style={{ color: 'var(--text-secondary)' }}>Loading profiles...</div>
                    ) : (
                        <select
                            value={selectedProfileName}
                            onChange={(e) => handleProfileSelect(e.target.value)}
                            style={{
                                width: '100%',
                                maxWidth: '500px',
                                padding: '12px',
                                borderRadius: '8px',
                                border: '1px solid var(--glass-border)',
                                backgroundColor: 'rgba(0,0,0,0.3)',
                                color: 'white',
                                fontSize: '1.1em',
                                cursor: 'pointer'
                            }}
                        >
                            <option value="" disabled>Select a profile...</option>
                            {profiles.map(p => (
                                <option key={p.name} value={p.name}>{p.name}</option>
                            ))}
                        </select>
                    )}
                </div>
            ) : (
                // MY ISSUES LIST
                <div style={{ maxWidth: '800px', margin: '0 auto' }}>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '20px', alignItems: 'center', gap: '10px' }}>
                        <label style={{ color: 'var(--text-secondary)', fontSize: '0.9em' }}>Project:</label>
                        <select
                            value={projectFilter}
                            onChange={(e) => setProjectFilter(e.target.value)}
                            style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', padding: '6px 12px', borderRadius: '6px', maxWidth: '200px' }}
                        >
                            <option value="">All Projects</option>
                            {availableProjects.map(p => (
                                <option key={p.id} value={p.id}>{p.name}</option>
                            ))}
                        </select>
                    </div>

                    {loadingMyIssues ? (
                        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>Loading issues...</div>
                    ) : (
                        <>
                            {(() => {
                                try {
                                    if (!Array.isArray(filteredIssues)) {
                                        console.error("filteredIssues is not an array:", filteredIssues);
                                        return <div>Error loading issues data</div>;
                                    }
                                    if (filteredIssues.length === 0) {
                                        return (
                                            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)', background: 'rgba(255,255,255,0.03)', borderRadius: '12px' }}>
                                                {projectFilter ? "No issues found in this project." : "No issues found."}
                                            </div>
                                        );
                                    }
                                    return (
                                        <>
                                            {/* Main Grid - Visible Issues */}
                                            <div style={{
                                                display: 'grid',
                                                gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
                                                gap: '15px',
                                                marginBottom: '40px'
                                            }}>
                                                {filteredIssues.filter(i => i && i.id && !hiddenIssueIds.includes(i.id)).map(i => (
                                                    <div key={i.id} style={{
                                                        padding: '15px 20px',
                                                        background: 'rgba(255,255,255,0.03)',
                                                        borderRadius: '10px',
                                                        border: '1px solid rgba(255,255,255,0.05)',
                                                        display: 'flex',
                                                        justifyContent: 'space-between',
                                                        alignItems: 'center',
                                                        minHeight: '80px'
                                                    }}>
                                                        <div style={{ flex: 1, marginRight: '15px', overflow: 'hidden' }}>
                                                            <div style={{ fontSize: '0.8em', color: 'var(--primary)', marginBottom: '4px', opacity: 0.8 }}>
                                                                #{i.id}
                                                            </div>
                                                            <div
                                                                style={{ fontWeight: 500, fontSize: '1.05em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', cursor: 'pointer' }}
                                                                title={i.subject || ''}
                                                                onClick={() => handleIssueClick(i.id)}
                                                                onMouseOver={(e) => e.currentTarget.style.textDecoration = 'underline'}
                                                                onMouseOut={(e) => e.currentTarget.style.textDecoration = 'none'}
                                                            >
                                                                {i.subject || '(No Subject)'}
                                                            </div>
                                                        </div>
                                                        <div style={{ display: 'flex', gap: '8px' }}>
                                                            <button
                                                                onClick={() => handleSaveProfileClick(i)}
                                                                title="Save to Profiles"
                                                                style={{
                                                                    background: 'rgba(255,255,255,0.08)',
                                                                    border: 'none',
                                                                    color: '#d1d5db',
                                                                    borderRadius: '6px',
                                                                    width: '32px',
                                                                    height: '32px',
                                                                    display: 'flex',
                                                                    alignItems: 'center',
                                                                    justifyContent: 'center',
                                                                    cursor: 'pointer',
                                                                    fontSize: '1.2em'
                                                                }}
                                                            >
                                                                🔖
                                                            </button>
                                                            <button
                                                                onClick={() => toggleHideIssue(i.id)}
                                                                title="Hide Issue"
                                                                style={{
                                                                    background: 'rgba(255,255,255,0.08)',
                                                                    border: 'none',
                                                                    color: '#9ca3af',
                                                                    borderRadius: '6px',
                                                                    width: '32px',
                                                                    height: '32px',
                                                                    display: 'flex',
                                                                    alignItems: 'center',
                                                                    justifyContent: 'center',
                                                                    cursor: 'pointer',
                                                                    fontSize: '1em'
                                                                }}
                                                            >
                                                                👁️
                                                            </button>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>

                                            {/* Hidden Issues Section */}
                                            {filteredIssues.some(i => i && i.id && hiddenIssueIds.includes(i.id)) && (
                                                <div style={{ marginTop: '30px', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '20px' }}>
                                                    <h3 style={{ color: 'var(--text-secondary)', fontSize: '1.1em', marginBottom: '15px' }}>Hidden Issues</h3>
                                                    <div style={{
                                                        display: 'grid',
                                                        gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
                                                        gap: '15px'
                                                    }}>
                                                        {filteredIssues.filter(i => i && i.id && hiddenIssueIds.includes(i.id)).map(i => (
                                                            <div key={i.id} style={{
                                                                padding: '15px 20px',
                                                                background: 'rgba(0,0,0,0.2)',
                                                                borderRadius: '10px',
                                                                border: '1px solid rgba(255,255,255,0.02)',
                                                                display: 'flex',
                                                                justifyContent: 'space-between',
                                                                alignItems: 'center',
                                                                opacity: 0.7
                                                            }}>
                                                                <div style={{ flex: 1, marginRight: '15px', overflow: 'hidden' }}>
                                                                    <div style={{ fontSize: '0.8em', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                                                                        #{i.id}
                                                                    </div>
                                                                    <div
                                                                        style={{ fontWeight: 400, fontSize: '1em', color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', cursor: 'pointer' }}
                                                                        title={i.subject || ''}
                                                                        onClick={() => handleIssueClick(i.id)}
                                                                        onMouseOver={(e) => e.currentTarget.style.textDecoration = 'underline'}
                                                                        onMouseOut={(e) => e.currentTarget.style.textDecoration = 'none'}
                                                                    >
                                                                        {i.subject || '(No Subject)'}
                                                                    </div>
                                                                </div>
                                                                <div>
                                                                    <button
                                                                        onClick={() => toggleHideIssue(i.id)}
                                                                        title="Display Issue"
                                                                        style={{
                                                                            background: 'rgba(255,255,255,0.05)',
                                                                            border: 'none',
                                                                            color: 'var(--primary)',
                                                                            borderRadius: '6px',
                                                                            width: '32px',
                                                                            height: '32px',
                                                                            display: 'flex',
                                                                            alignItems: 'center',
                                                                            justifyContent: 'center',
                                                                            cursor: 'pointer',
                                                                            fontSize: '1em'
                                                                        }}
                                                                    >
                                                                        👁️
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </>
                                    );
                                } catch (e) {
                                    console.error("Error rendering issues:", e);
                                    return <div style={{ color: 'red' }}>Error rendering issues. Check console.</div>;
                                }
                            })()}
                        </>
                    )}
                </div>
            )}

            {/* Save Modal */}
            {showSaveModal && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    background: 'rgba(0,0,0,0.8)', zIndex: 1000,
                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                    <div style={{
                        background: '#1f1f1f', width: '90%', maxWidth: '500px',
                        borderRadius: '12px', padding: '30px',
                        border: '1px solid #333',
                        boxShadow: '0 10px 30px rgba(0,0,0,0.5)'
                    }}>
                        <h3 style={{ marginTop: 0, marginBottom: '20px' }}>Save as Profile</h3>

                        <div style={{ marginBottom: '15px' }}>
                            <label style={{ display: 'block', color: '#aaa', marginBottom: '8px', fontSize: '0.9em' }}>Profile Name</label>
                            <input
                                value={saveProfileName}
                                onChange={e => setSaveProfileName(e.target.value)}
                                style={{ width: '100%', padding: '10px', background: '#333', border: '1px solid #444', color: 'white', borderRadius: '6px' }}
                            />
                        </div>

                        <div style={{ marginBottom: '15px' }}>
                            <label style={{ display: 'block', color: '#aaa', marginBottom: '8px', fontSize: '0.9em' }}>Activity *</label>
                            <select
                                value={saveActivityId}
                                onChange={e => setSaveActivityId(Number(e.target.value))}
                                style={{ width: '100%', padding: '10px', background: '#333', border: '1px solid #444', color: 'white', borderRadius: '6px' }}
                            >
                                <option value="">Select Activity</option>
                                {activities.map(a => (
                                    <option key={a.id} value={a.id}>{a.name}</option>
                                ))}
                            </select>
                        </div>

                        <div style={{ marginBottom: '25px' }}>
                            <label style={{ display: 'block', color: '#aaa', marginBottom: '8px', fontSize: '0.9em' }}>Default Comment (Optional)</label>
                            <input
                                value={saveComment}
                                onChange={e => setSaveComment(e.target.value)}
                                style={{ width: '100%', padding: '10px', background: '#333', border: '1px solid #444', color: 'white', borderRadius: '6px' }}
                                placeholder="e.g. Daily Progress"
                            />
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '15px' }}>
                            <button
                                onClick={() => setShowSaveModal(false)}
                                style={{ background: 'transparent', border: 'none', color: '#aaa', cursor: 'pointer', padding: '10px 20px' }}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={confirmSaveProfile}
                                style={{ background: '#22c55e', border: 'none', color: 'white', cursor: 'pointer', padding: '10px 25px', borderRadius: '6px', fontWeight: 600 }}
                            >
                                Save Profile
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <IssueDetailModal
                isOpen={showDetailModal}
                onClose={() => setShowDetailModal(false)}
                issueId={detailIssueId}
            />

            {/* Issue Details Content - Only show when viewing Profiles */}
            {viewMode === 'profiles' && (
                loading ? (
                    <div style={{ display: 'flex', justifyContent: 'center', padding: '40px', color: 'var(--text-secondary)' }}>
                        <div className="loading-spinner"></div> Loading details...
                    </div>
                ) : error ? (
                    <div className="glass-panel" style={{ padding: '30px', textAlign: 'center', color: '#f44336', border: '1px solid rgba(244, 67, 54, 0.3)', background: 'rgba(244, 67, 54, 0.05)' }}>
                        {error}
                    </div>
                ) : issue ? (
                    <div className="glass-panel" style={{ padding: '30px', animation: 'fadeIn 0.3s ease' }}>

                        {/* Header */}
                        <div style={{ marginBottom: '30px', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '20px' }}>
                            <div style={{ fontSize: '0.9em', color: 'var(--text-secondary)', marginBottom: '5px' }}>
                                {issue.project.name} • #{issue.id}
                            </div>
                            <h2 style={{ margin: 0, fontSize: '1.8em', lineHeight: '1.3' }}>{issue.subject}</h2>
                        </div>

                        {/* Meta Grid - Vertical Layout as requested */}
                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                            gap: '20px',
                            marginBottom: '30px'
                        }}>
                            {/* Column 1 */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                                <div>
                                    <div style={{ fontSize: '0.85em', color: 'var(--text-secondary)', marginBottom: '4px' }}>Status:</div>
                                    <div style={{ fontWeight: '600', fontSize: '1.1em', color: issue.status === 'Closed' ? '#4caf50' : 'white' }}>{issue.status}</div>
                                </div>
                                <div>
                                    <div style={{ fontSize: '0.85em', color: 'var(--text-secondary)', marginBottom: '4px' }}>Priority:</div>
                                    <div style={{ fontWeight: '600', fontSize: '1.1em' }}>{issue.priority}</div>
                                </div>
                                <div>
                                    <div style={{ fontSize: '0.85em', color: 'var(--text-secondary)', marginBottom: '4px' }}>Assignee:</div>
                                    <div style={{ fontWeight: '600', fontSize: '1.1em' }}>{issue.assigned_to}</div>
                                </div>
                                <div>
                                    <div style={{ fontSize: '0.85em', color: 'var(--text-secondary)', marginBottom: '4px' }}>Target version:</div>
                                    <div style={{ fontWeight: '600', fontSize: '1.1em' }}>{issue.fixed_version || '-'}</div>
                                </div>
                            </div>

                            {/* Column 2 */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                                <div>
                                    <div style={{ fontSize: '0.85em', color: 'var(--text-secondary)', marginBottom: '4px' }}>Start date:</div>
                                    <div style={{ fontWeight: '600', fontSize: '1.1em' }}>{issue.start_date}</div>
                                </div>
                                <div>
                                    <div style={{ fontSize: '0.85em', color: 'var(--text-secondary)', marginBottom: '4px' }}>Due date:</div>
                                    <div style={{ fontWeight: '600', fontSize: '1.1em' }}>{issue.due_date}</div>
                                </div>
                                <div>
                                    <div style={{ fontSize: '0.85em', color: 'var(--text-secondary)', marginBottom: '4px' }}>Estimated time:</div>
                                    <div style={{ fontWeight: '600', fontSize: '1.1em' }}>{issue.estimated_hours ? `${issue.estimated_hours} h` : '-'}</div>
                                </div>
                                <div>
                                    <div style={{ fontSize: '0.85em', color: 'var(--text-secondary)', marginBottom: '4px' }}>Spent time:</div>
                                    <div style={{ fontWeight: '600', fontSize: '1.1em' }}>{issue.spent_hours ? `${issue.spent_hours} h` : '-'}</div>
                                </div>
                            </div>

                            {/* Column 3 */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                                <div>
                                    <div style={{ fontSize: '0.85em', color: 'var(--text-secondary)', marginBottom: '4px' }}>Component:</div>
                                    <div style={{ fontWeight: '600', fontSize: '1.1em' }}>{issue.category || '(none)'}</div>
                                </div>
                                <div>
                                    <div style={{ fontSize: '0.85em', color: 'var(--text-secondary)', marginBottom: '4px' }}>Req.ID:</div>
                                    <div style={{ fontWeight: '600', fontSize: '1.1em' }}>{getCustomField('Req.ID') || '-'}</div>
                                </div>
                                <div>
                                    <div style={{ fontSize: '0.85em', color: 'var(--text-secondary)', marginBottom: '4px' }}>Test Result:</div>
                                    <div style={{ fontWeight: '600', fontSize: '1.1em' }}>{getCustomField('Test Result') || 'Not Yet'}</div>
                                </div>
                            </div>
                        </div>

                        <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', margin: '20px 0' }}></div>

                        {/* Description */}
                        {issue.description && (
                            <div style={{ marginBottom: '30px' }}>
                                <h3 style={{ fontSize: '1.2em', marginBottom: '15px', color: 'var(--text-secondary)' }}>Description</h3>
                                <div
                                    style={{
                                        padding: '20px',
                                        background: 'rgba(255,255,255,0.03)',
                                        borderRadius: '8px',
                                        lineHeight: '1.6',
                                        fontSize: '1em',
                                        whiteSpace: 'pre-wrap',
                                        border: '1px solid rgba(255,255,255,0.05)'
                                    }}
                                >
                                    {issue.description}
                                </div>
                            </div>
                        )}

                        {/* Journals / History */}
                        {issue.journals && issue.journals.length > 0 && (
                            <div style={{ marginBottom: '30px' }}>
                                <h3 style={{ fontSize: '1.2em', marginBottom: '20px', color: 'var(--text-secondary)' }}>History</h3>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                                    {issue.journals.map((journal, idx) => (
                                        <div key={idx} style={{ paddingLeft: '20px', borderLeft: '2px solid var(--glass-border)', position: 'relative' }}>
                                            <div style={{ position: 'absolute', left: '-6px', top: '0', width: '10px', height: '10px', borderRadius: '50%', background: 'var(--glass-border)' }}></div>
                                            <div style={{ fontSize: '0.9em', color: 'var(--text-secondary)', marginBottom: '8px', display: 'flex', justifyContent: 'space-between' }}>
                                                <span style={{ color: 'var(--primary)', fontWeight: 'bold' }}>{journal.user}</span>
                                                <span>{new Date(journal.created_on).toLocaleString()}</span>
                                            </div>
                                            <div style={{ fontSize: '0.95em', whiteSpace: 'pre-wrap', lineHeight: '1.5', color: '#ddd' }}>{journal.notes}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Open in Redmine Button - Moved to Bottom */}
                        <div style={{ display: 'flex', justifyContent: 'center', marginTop: '40px' }}>
                            <button
                                onClick={() => window.open(issue.url, '_blank')}
                                style={{
                                    padding: '12px 24px',
                                    backgroundColor: 'var(--primary)',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '8px',
                                    cursor: 'pointer',
                                    fontWeight: 'bold',
                                    fontSize: '1.1em',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '10px',
                                    boxShadow: '0 4px 15px rgba(59, 130, 246, 0.4)'
                                }}
                            >
                                Open in Redmine ↗
                            </button>
                        </div>

                    </div>
                ) : (
                    <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-secondary)', opacity: 0.7 }}>
                        <div style={{ fontSize: '4em', marginBottom: '20px' }}>📋</div>
                        <p>Select a profile above to view details</p>
                    </div>
                )
            )}
        </div>
    );
};

export default ProjectsView;
