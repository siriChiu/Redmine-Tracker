import React, { useState, useEffect } from 'react';

interface TimeEntryModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: () => void;
    initialDate: string;
    existingEntry: any | null;
}

const TimeEntryModal: React.FC<TimeEntryModalProps> = ({ isOpen, onClose, onSave, initialDate, existingEntry }) => {
    const [hours, setHours] = useState(0);
    const [comments, setComments] = useState('');
    const [activityId, setActivityId] = useState(9); // Default Dev
    const [projectId, setProjectId] = useState<number | ''>('');
    const [issueId, setIssueId] = useState<number | ''>('');

    const [projects, setProjects] = useState<any[]>([]);
    const [activities, setActivities] = useState<any>({});

    useEffect(() => {
        if (isOpen) {
            fetchProjects();
            fetchActivities();

            if (existingEntry) {
                setHours(existingEntry.extendedProps.hours || 0);
                setComments(existingEntry.extendedProps.comments || '');
                // Note: Mapping back from event to IDs might be tricky if data is partial
            } else {
                setHours(0);
                setComments('');
            }
        }
    }, [isOpen, existingEntry]);

    const fetchProjects = () => {
        fetch('http://127.0.0.1:8000/api/redmine/projects')
            .then(res => res.json())
            .then(data => Array.isArray(data) ? setProjects(data) : setProjects([]))
            .catch(console.error);
    };

    const fetchActivities = () => {
        fetch('http://127.0.0.1:8000/api/redmine/activities')
            .then(res => res.json())
            .then(setActivities)
            .catch(console.error);
    };

    const handleSave = () => {
        const entry = {
            spent_on: initialDate,
            hours: Number(hours),
            comments,
            activity_id: Number(activityId),
            project_id: projectId ? Number(projectId) : undefined,
            issue_id: issueId ? Number(issueId) : undefined
        };

        const url = existingEntry
            ? `http://127.0.0.1:8000/api/redmine/time_entries/${existingEntry.id}` // Update not fully impl in backend yet?
            : 'http://127.0.0.1:8000/api/redmine/time_entries';

        // For now, backend only supports create and delete. Update might need delete+create logic or new endpoint.
        // Let's assume create for new.

        if (existingEntry) {
            // Delete old then create new? Or just alert not supported yet
            alert("Editing entries not fully supported yet.");
            return;
        }

        fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(entry)
        })
            .then(res => res.json())
            .then(data => {
                if (data.status === 'success') {
                    onSave();
                } else {
                    alert(`Error: ${data.error}`);
                }
            })
            .catch(console.error);
    };

    const handleDelete = () => {
        if (!existingEntry) return;
        if (!confirm("Are you sure you want to delete this entry?")) return;

        fetch(`http://127.0.0.1:8000/api/redmine/time_entries/${existingEntry.id}`, {
            method: 'DELETE'
        })
            .then(res => res.json())
            .then(data => {
                if (data.status === 'success') {
                    onSave();
                } else {
                    alert(`Error: ${data.error}`);
                }
            })
            .catch(console.error);
    };

    if (!isOpen) return null;

    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100
        }}>
            <div style={{ background: '#2a2a2a', padding: '20px', borderRadius: '8px', width: '400px' }}>
                <h3>{existingEntry ? 'Edit Time Entry' : 'Log Time'} - {initialDate}</h3>

                <div style={{ marginBottom: '10px' }}>
                    <label style={{ display: 'block', marginBottom: '5px' }}>Project</label>
                    <select value={projectId} onChange={e => setProjectId(Number(e.target.value))} style={{ width: '100%', padding: '8px', background: '#333', color: 'white', border: '1px solid #444' }}>
                        <option value="">Select Project...</option>
                        {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                </div>

                <div style={{ marginBottom: '10px' }}>
                    <label style={{ display: 'block', marginBottom: '5px' }}>Issue ID (Optional)</label>
                    <input type="number" value={issueId} onChange={e => setIssueId(Number(e.target.value))} style={{ width: '100%', padding: '8px', background: '#333', color: 'white', border: '1px solid #444' }} />
                </div>

                <div style={{ marginBottom: '10px' }}>
                    <label style={{ display: 'block', marginBottom: '5px' }}>Hours</label>
                    <input type="number" step="0.25" value={hours} onChange={e => setHours(Number(e.target.value))} style={{ width: '100%', padding: '8px', background: '#333', color: 'white', border: '1px solid #444' }} />
                </div>

                <div style={{ marginBottom: '10px' }}>
                    <label style={{ display: 'block', marginBottom: '5px' }}>Comments</label>
                    <input type="text" value={comments} onChange={e => setComments(e.target.value)} style={{ width: '100%', padding: '8px', background: '#333', color: 'white', border: '1px solid #444' }} />
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '20px' }}>
                    {existingEntry && <button onClick={handleDelete} style={{ background: '#ef4444' }}>Delete</button>}
                    <div style={{ display: 'flex', gap: '10px', marginLeft: 'auto' }}>
                        <button onClick={onClose} style={{ background: 'transparent', border: '1px solid #555' }}>Cancel</button>
                        <button onClick={handleSave} style={{ background: '#3b82f6' }}>Save</button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default TimeEntryModal;
