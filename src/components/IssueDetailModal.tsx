import React, { useEffect, useState } from 'react';

interface Journal {
    user: string;
    created_on: string;
    notes: string;
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
    project: { id: number; name: string };
    journals: Journal[];
    url: string;
}

interface IssueDetailModalProps {
    isOpen: boolean;
    onClose: () => void;
    issueId: number | null;
}

const IssueDetailModal: React.FC<IssueDetailModalProps> = ({ isOpen, onClose, issueId }) => {
    const [issue, setIssue] = useState<IssueDetail | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (isOpen && issueId) {
            fetchIssueDetails(issueId);
        } else {
            setIssue(null);
        }
    }, [isOpen, issueId]);

    const fetchIssueDetails = async (id: number) => {
        setLoading(true);
        setError('');
        try {
            const res = await fetch(`http://127.0.0.1:8000/api/redmine/issue/${id}`);
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
    };

    if (!isOpen) return null;

    return (
        <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            backdropFilter: 'blur(5px)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 1000,
            animation: 'fadeIn 0.2s ease-out'
        }} onClick={onClose}>
            <div
                className="glass-panel"
                style={{
                    width: '90%',
                    maxWidth: '800px',
                    height: '85vh',
                    display: 'flex',
                    flexDirection: 'column',
                    position: 'relative',
                    padding: '0',
                    overflow: 'hidden',
                    backgroundColor: '#1e1e24',
                    border: '1px solid rgba(255, 255, 255, 0.1)'
                }}
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div style={{
                    padding: '20px',
                    borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'start',
                    background: 'rgba(30, 30, 36, 0.95)'
                }}>
                    <div style={{ flex: 1, paddingRight: '20px' }}>
                        {loading ? (
                            <div style={{ height: '24px', width: '60%', background: 'rgba(255,255,255,0.1)', borderRadius: '4px' }}></div>
                        ) : issue ? (
                            <>
                                <div style={{ fontSize: '0.9em', color: 'var(--text-secondary)', marginBottom: '5px' }}>
                                    {issue.project.name} • #{issue.id}
                                </div>
                                <h2 style={{ margin: 0, fontSize: '1.4em', lineHeight: '1.3' }}>{issue.subject}</h2>
                            </>
                        ) : (
                            <div>Loading...</div>
                        )}
                    </div>
                    <button
                        onClick={onClose}
                        style={{
                            background: 'transparent',
                            border: 'none',
                            color: 'var(--text-secondary)',
                            fontSize: '1.5em',
                            cursor: 'pointer',
                            padding: '0 5px'
                        }}
                    >
                        ×
                    </button>
                </div>

                {/* Content */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
                    {loading ? (
                        <div style={{ display: 'flex', justifyContent: 'center', padding: '40px', color: 'var(--text-secondary)' }}>
                            Loading details...
                        </div>
                    ) : error ? (
                        <div style={{ color: '#f44336', padding: '20px', textAlign: 'center' }}>{error}</div>
                    ) : issue ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '25px' }}>

                            {/* Meta Grid */}
                            <div style={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                                gap: '15px',
                                background: 'rgba(0,0,0,0.2)',
                                padding: '15px',
                                borderRadius: '8px'
                            }}>
                                <div>
                                    <div style={{ fontSize: '0.8em', color: 'var(--text-secondary)' }}>Status</div>
                                    <div style={{ fontWeight: '500' }}>{issue.status}</div>
                                </div>
                                <div>
                                    <div style={{ fontSize: '0.8em', color: 'var(--text-secondary)' }}>Priority</div>
                                    <div style={{ fontWeight: '500' }}>{issue.priority}</div>
                                </div>
                                <div>
                                    <div style={{ fontSize: '0.8em', color: 'var(--text-secondary)' }}>Assigned To</div>
                                    <div style={{ fontWeight: '500' }}>{issue.assigned_to}</div>
                                </div>
                                <div>
                                    <div style={{ fontSize: '0.8em', color: 'var(--text-secondary)' }}>Done Ratio</div>
                                    <div style={{ fontWeight: '500' }}>{issue.done_ratio}%</div>
                                </div>
                                <div>
                                    <div style={{ fontSize: '0.8em', color: 'var(--text-secondary)' }}>Start Date</div>
                                    <div style={{ fontWeight: '500' }}>{issue.start_date}</div>
                                </div>
                                <div>
                                    <div style={{ fontSize: '0.8em', color: 'var(--text-secondary)' }}>Due Date</div>
                                    <div style={{ fontWeight: '500' }}>{issue.due_date}</div>
                                </div>
                            </div>

                            {/* Description */}
                            {issue.description && (
                                <div>
                                    <h3 style={{ fontSize: '1.1em', marginBottom: '10px', color: 'var(--text-secondary)' }}>Description</h3>
                                    <div
                                        style={{
                                            padding: '15px',
                                            background: 'rgba(255,255,255,0.05)',
                                            borderRadius: '8px',
                                            lineHeight: '1.6',
                                            fontSize: '0.95em',
                                            whiteSpace: 'pre-wrap'
                                        }}
                                    >
                                        {issue.description}
                                    </div>
                                </div>
                            )}

                            {/* Journals / History */}
                            {issue.journals && issue.journals.length > 0 && (
                                <div>
                                    <h3 style={{ fontSize: '1.1em', marginBottom: '15px', color: 'var(--text-secondary)' }}>History</h3>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                                        {issue.journals.map((journal, idx) => (
                                            <div key={idx} style={{ borderLeft: '2px solid var(--glass-border)', paddingLeft: '15px' }}>
                                                <div style={{ fontSize: '0.85em', color: 'var(--text-secondary)', marginBottom: '5px' }}>
                                                    <span style={{ color: 'var(--primary)', fontWeight: 'bold' }}>{journal.user}</span> • {new Date(journal.created_on).toLocaleString()}
                                                </div>
                                                <div style={{ fontSize: '0.95em', whiteSpace: 'pre-wrap' }}>{journal.notes}</div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    ) : null}
                </div>

                {/* Footer Actions */}
                <div style={{
                    padding: '15px 20px',
                    borderTop: '1px solid rgba(255, 255, 255, 0.1)',
                    display: 'flex',
                    justifyContent: 'flex-end',
                    background: 'rgba(30, 30, 36, 0.95)'
                }}>
                    {issue && (
                        <button
                            onClick={() => window.open(issue.url, '_blank')}
                            style={{
                                padding: '8px 16px',
                                backgroundColor: 'var(--primary)',
                                color: 'white',
                                border: 'none',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                fontWeight: '500',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px'
                            }}
                        >
                            Open in Browser ↗
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default IssueDetailModal;
