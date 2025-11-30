import { useState, useEffect } from 'react';
import IssueDetailModal from './IssueDetailModal';

interface Project {
    id: number;
    name: string;
}

const ProjectsView = () => {
    const [projects, setProjects] = useState<Project[]>([]);
    const [loading, setLoading] = useState(true);
    const [expandedProjectId, setExpandedProjectId] = useState<number | null>(null);
    const [projectIssues, setProjectIssues] = useState<Record<number, any>>({}); // Changed to any to support nested structure
    const [redmineUrl, setRedmineUrl] = useState('');
    const [activeTab, setActiveTab] = useState<'my_issues' | 'all_issues' | 'activity'>('my_issues');
    const [loadingIssues, setLoadingIssues] = useState(false);

    // Modal State
    const [selectedIssueId, setSelectedIssueId] = useState<number | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);

    useEffect(() => {
        fetch('http://127.0.0.1:8000/api/redmine/projects')
            .then(res => res.json())
            .then(data => {
                if (Array.isArray(data)) {
                    setProjects(data);
                }
                setLoading(false);
            })
            .catch(err => {
                console.error(err);
                setLoading(false);
            });

        // Fetch settings to get Redmine URL
        fetch('http://127.0.0.1:8000/api/settings')
            .then(res => res.json())
            .then(data => {
                if (data.redmine_url) {
                    setRedmineUrl(data.redmine_url.replace(/\/$/, '')); // Remove trailing slash
                }
            })
            .catch(console.error);
    }, []);

    const handleProjectClick = async (projectId: number) => {
        if (expandedProjectId === projectId) {
            setExpandedProjectId(null);
            return;
        }
        setExpandedProjectId(projectId);
        setActiveTab('my_issues'); // Reset to default tab

        // Fetch My Issues by default
        fetchIssues(projectId, 'my_issues');
    };

    const fetchIssues = async (projectId: number, scope: 'my_issues' | 'all_issues') => {
        // Simple in-memory caching for this session using the state
        // We can store it in projectIssues as { [projectId]: { my_issues: [], all_issues: [] } }
        // But for now, let's just fetch.

        setLoadingIssues(true);
        try {
            const apiScope = scope === 'my_issues' ? 'me' : 'all';
            const res = await fetch(`http://127.0.0.1:8000/api/redmine/issues?project_id=${projectId}&scope=${apiScope}`);
            const data = await res.json();

            if (Array.isArray(data)) {
                setProjectIssues(prev => ({
                    ...prev,
                    [projectId]: {
                        ...prev[projectId],
                        [scope]: data
                    }
                }));
            }
        } catch (error) {
            console.error("Failed to fetch issues", error);
        } finally {
            setLoadingIssues(false);
        }
    };

    const openInRedmine = (path: string) => {
        if (!redmineUrl) {
            alert("Redmine URL not configured in settings.");
            return;
        }
        window.open(`${redmineUrl}/${path}`, '_blank');
    };

    return (
        <div style={{ padding: '40px', maxWidth: '1200px', margin: '0 auto' }}>
            <h1 style={{ marginBottom: '30px' }}>Projects</h1>
            {loading ? (
                <p>Loading projects...</p>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px' }}>
                    {projects.map(project => (
                        <div
                            key={project.id}
                            className="glass-panel"
                            onClick={() => handleProjectClick(project.id)}
                            style={{
                                padding: '20px',
                                cursor: 'pointer',
                                transition: 'all 0.3s ease',
                                border: expandedProjectId === project.id ? '1px solid var(--primary)' : '1px solid var(--glass-border)',
                                position: 'relative',
                                overflow: 'hidden'
                            }}
                        >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                <div>
                                    <h3 style={{ margin: '0 0 5px 0', fontSize: '1.2em' }}>{project.name}</h3>
                                    <span style={{ color: 'var(--text-secondary)', fontSize: '0.8em' }}>ID: {project.id}</span>
                                </div>
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        openInRedmine(`projects/${project.id}`);
                                    }}
                                    style={{
                                        fontSize: '0.8em',
                                        padding: '4px 8px',
                                        background: 'rgba(255,255,255,0.1)',
                                        border: 'none',
                                        borderRadius: '4px',
                                        cursor: 'pointer'
                                    }}
                                >
                                    Open ↗
                                </button>
                            </div>

                            {expandedProjectId === project.id && (
                                <div style={{ marginTop: '20px', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '15px', animation: 'fadeIn 0.3s ease' }}>

                                    {/* Tabs */}
                                    <div style={{ display: 'flex', gap: '15px', marginBottom: '15px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                                        <button
                                            onClick={(e) => { e.stopPropagation(); setActiveTab('my_issues'); fetchIssues(project.id, 'my_issues'); }}
                                            style={{
                                                background: 'transparent',
                                                border: 'none',
                                                borderBottom: activeTab === 'my_issues' ? '2px solid var(--primary)' : '2px solid transparent',
                                                color: activeTab === 'my_issues' ? 'white' : 'var(--text-secondary)',
                                                padding: '5px 0',
                                                cursor: 'pointer',
                                                fontSize: '0.9em'
                                            }}
                                        >
                                            My Issues
                                        </button>
                                        <button
                                            onClick={(e) => { e.stopPropagation(); setActiveTab('all_issues'); fetchIssues(project.id, 'all_issues'); }}
                                            style={{
                                                background: 'transparent',
                                                border: 'none',
                                                borderBottom: activeTab === 'all_issues' ? '2px solid var(--primary)' : '2px solid transparent',
                                                color: activeTab === 'all_issues' ? 'white' : 'var(--text-secondary)',
                                                padding: '5px 0',
                                                cursor: 'pointer',
                                                fontSize: '0.9em'
                                            }}
                                        >
                                            All Issues
                                        </button>
                                        <button
                                            onClick={(e) => { e.stopPropagation(); setActiveTab('activity'); }}
                                            style={{
                                                background: 'transparent',
                                                border: 'none',
                                                borderBottom: activeTab === 'activity' ? '2px solid var(--primary)' : '2px solid transparent',
                                                color: activeTab === 'activity' ? 'white' : 'var(--text-secondary)',
                                                padding: '5px 0',
                                                cursor: 'pointer',
                                                fontSize: '0.9em'
                                            }}
                                        >
                                            Activity
                                        </button>
                                    </div>

                                    {/* Content */}
                                    {activeTab === 'activity' ? (
                                        <div style={{ fontSize: '0.9em', color: '#888', padding: '10px 0' }}>Recent activity stream coming soon...</div>
                                    ) : (
                                        <>
                                            {loadingIssues && (!projectIssues[project.id] || !projectIssues[project.id][activeTab]) ? (
                                                <div style={{ fontSize: '0.8em', color: '#888' }}>Loading issues...</div>
                                            ) : !projectIssues[project.id] || !projectIssues[project.id][activeTab] || projectIssues[project.id][activeTab].length === 0 ? (
                                                <div style={{ fontSize: '0.8em', color: '#888' }}>No open issues found.</div>
                                            ) : (
                                                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                                                    <select
                                                        onChange={(e) => {
                                                            const issueId = Number(e.target.value);
                                                            if (issueId) {
                                                                setSelectedIssueId(issueId);
                                                                setIsModalOpen(true);
                                                            }
                                                            e.target.value = ""; // Reset
                                                        }}
                                                        style={{
                                                            flex: 1,
                                                            padding: '10px',
                                                            borderRadius: '6px',
                                                            border: '1px solid var(--glass-border)',
                                                            backgroundColor: 'rgba(0,0,0,0.3)',
                                                            color: 'white',
                                                            cursor: 'pointer'
                                                        }}
                                                        defaultValue=""
                                                    >
                                                        <option value="" disabled>Select an issue to view details...</option>
                                                        {projectIssues[project.id][activeTab].map((issue: any) => (
                                                            <option key={issue.id} value={issue.id}>
                                                                #{issue.id} - {issue.subject}
                                                            </option>
                                                        ))}
                                                    </select>
                                                </div>
                                            )}
                                        </>
                                    )}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}

            <IssueDetailModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                issueId={selectedIssueId}
            />
        </div>
    );
};

export default ProjectsView;
