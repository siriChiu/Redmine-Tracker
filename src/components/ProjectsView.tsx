import { useState, useEffect } from 'react';
import { ToastContainer } from './Toast';

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
    }, []);

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

            {/* Profile Selector */}
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

            {/* Issue Details Content */}
            {loading ? (
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
            )}
        </div>
    );
};

export default ProjectsView;
