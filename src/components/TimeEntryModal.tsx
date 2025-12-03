import React, { useState, useEffect, useRef } from 'react';
import { ToastContainer } from './Toast';
import ConfirmModal from './ConfirmModal';

interface TimeEntryModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: () => void;
    initialDate: string;
    existingEntry: any | null;
    initialStartTime?: string; // Optional prop
}

const TimeEntryModal: React.FC<TimeEntryModalProps> = ({ isOpen, onClose, onSave, initialDate, existingEntry, initialStartTime }) => {
    const [hours, setHours] = useState(0);
    const [comments, setComments] = useState('');
    const [activityId, setActivityId] = useState(9); // Default Dev
    const [projectId, setProjectId] = useState<number | ''>('');
    const [issueId, setIssueId] = useState<number | ''>('');
    const [rdFunctionTeam, setRdFunctionTeam] = useState('N/A');
    const [startTime, setStartTime] = useState('09:00'); // Default start time
    const [selectedProfile, setSelectedProfile] = useState('');

    const [projects, setProjects] = useState<any[]>([]);
    const [activities, setActivities] = useState<any>({});
    const [profiles, setProfiles] = useState<any[]>([]);

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

    const fetchProfiles = () => {
        fetch('http://127.0.0.1:8000/api/profiles')
            .then(res => res.json())
            .then(data => {
                const profileList = Array.isArray(data) ? data : [];
                setProfiles(profileList);

                // Auto-load logic here to avoid race conditions
                const isNewEntry = !existingEntry || !existingEntry.id;
                if (isNewEntry && profileList.length > 0) {
                    const lastProfileName = localStorage.getItem('redmine_tracker_last_profile');
                    if (lastProfileName) {
                        const profile = profileList.find(p => p.name === lastProfileName);
                        if (profile) {
                            const pId = profile.project_id ? Number(profile.project_id) : '';
                            const iId = profile.issue_id ? Number(profile.issue_id) : '';
                            const aId = profile.activity_id ? Number(profile.activity_id) : 9;

                            setProjectId(pId);
                            setIssueId(iId);
                            setActivityId(aId);
                            setComments(profile.comments || '');
                            setRdFunctionTeam(profile.rd_function_team || 'N/A');
                            setSelectedProfile(lastProfileName);
                            // console.log("Auto-loaded profile:", lastProfileName);
                        }
                    }
                }
            })
            .catch(console.error);
    };

    useEffect(() => {
        if (isOpen) {
            fetchProjects();
            fetchActivities();
            fetchProfiles();

            if (existingEntry) {
                setHours(existingEntry.extendedProps.hours || 0);
                setComments(existingEntry.extendedProps.comments || '');
                setProjectId(existingEntry.extendedProps.projectId || '');
                setIssueId(existingEntry.extendedProps.issueId || '');
                // Use stored start time or default
                setStartTime(existingEntry.extendedProps.startTime || '09:00');
                setSelectedProfile('');
            } else {
                // Reset for new entry
                setHours(0);
                setComments('');
                setProjectId('');
                setIssueId('');
                setActivityId(9);
                setRdFunctionTeam('N/A');
                // Use passed initial start time or default
                setStartTime(initialStartTime || '09:00');
                // Don't reset selectedProfile here, let fetchProfiles handle it
            }
        }
    }, [isOpen, existingEntry, initialStartTime]);



    const isEditMode = existingEntry && existingEntry.id;



    const handleProfileSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const profileName = e.target.value;
        setSelectedProfile(profileName);

        if (!profileName) {
            // Reset if empty selection
            setProjectId('');
            setIssueId('');
            setActivityId(9);
            setComments('');
            setRdFunctionTeam('N/A');
            return;
        }

        // Save to localStorage
        localStorage.setItem('redmine_tracker_last_profile', profileName);

        const profile = profiles.find(p => p.name === profileName);
        if (profile) {
            // Ensure IDs are numbers
            const pId = profile.project_id ? Number(profile.project_id) : '';
            const iId = profile.issue_id ? Number(profile.issue_id) : '';
            const aId = profile.activity_id ? Number(profile.activity_id) : 9;

            setProjectId(pId);
            setIssueId(iId);
            setActivityId(aId);
            setComments(profile.comments || '');
            setRdFunctionTeam(profile.rd_function_team || 'N/A');
        }
    };

    // ... (omitting other functions for brevity if not changing) ...

    // Note: I need to make sure I don't delete the other functions.
    // The replace_file_content tool replaces the chunk. 
    // I will target the handleProfileSelect function and the Select element separately or together if contiguous.
    // They are not contiguous. I will do handleProfileSelect first.






    const handleSave = () => {
        const entry = {
            spent_on: initialDate,
            hours: Number(hours),
            comments,
            activity_id: Number(activityId),
            project_id: projectId ? Number(projectId) : undefined,
            issue_id: issueId ? Number(issueId) : undefined,
            rd_function_team: rdFunctionTeam,
            start_time: startTime // Include start_time in payload
        };

        const url = isEditMode
            ? `http://127.0.0.1:8000/api/redmine/time_entries/${existingEntry.id}`
            : 'http://127.0.0.1:8000/api/redmine/time_entries';

        const method = isEditMode ? 'PUT' : 'POST';

        fetch(url, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(entry)
        })
            .then(res => res.json())
            .then(data => {
                if (data.status === 'success') {
                    addToast(data.message || "Entry saved successfully!", 'success');
                    setTimeout(() => onSave(), 500); // Delay close to show toast
                } else {
                    addToast(`Error: ${data.error || data.detail || 'Unknown error'}`, 'error');
                }
            })
            .catch(err => {
                console.error(err);
                addToast("Failed to save entry. See console for details.", 'error');
            });
    };

    const handleDelete = async () => {
        if (!isEditMode) return;

        const confirmed = await openConfirm("Are you sure you want to delete this entry?", "Delete Entry");
        if (!confirmed) return;

        fetch(`http://127.0.0.1:8000/api/redmine/time_entries/${existingEntry.id}`, {
            method: 'DELETE'
        })
            .then(res => res.json())
            .then(data => {
                if (data.status === 'success') {
                    addToast(data.message || "Entry deleted successfully", 'success');
                    setTimeout(() => onSave(), 500);
                } else {
                    addToast(`Error: ${data.error || data.detail || 'Unknown error'}`, 'error');
                }
            })
            .catch(err => {
                console.error(err);
                addToast("Failed to delete entry", 'error');
            });
    };



    if (!isOpen) return null;

    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100
        }}>
            <ToastContainer toasts={toasts} removeToast={removeToast} />
            <ConfirmModal
                isOpen={confirmModal.isOpen}
                message={confirmModal.message}
                title={confirmModal.title}
                onConfirm={confirmModal.onConfirm}
                onCancel={handleConfirmCancel}
            />

            <div className="glass-panel" style={{ background: '#2a2a2a', padding: '20px', borderRadius: '8px', width: '400px', position: 'relative' }}>
                <h3>{isEditMode ? 'Edit Time Entry' : 'Log Time'} - {initialDate}</h3>

                <div style={{ marginBottom: '15px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', marginBottom: '5px' }}>
                        <label style={{ color: '#aaa', fontSize: '0.9em', marginRight: '8px' }}>Select Saved Profile</label>
                        <div
                            title="You can add/edit issues in the setting page"
                            style={{
                                cursor: 'help',
                                color: '#3b82f6',
                                fontSize: '0.9em',
                                border: '1px solid #3b82f6',
                                borderRadius: '50%',
                                width: '16px',
                                height: '16px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                            }}
                        >
                            i
                        </div>
                    </div>
                    <select onChange={handleProfileSelect} value={selectedProfile} style={{ width: '100%', padding: '8px', background: '#333', color: 'white', border: '1px solid #444' }}>
                        <option value="">{isEditMode ? "Change Profile (Optional)..." : "Select a saved profile..."}</option>
                        {profiles.map(p => <option key={p.name} value={p.name}>{p.name}</option>)}
                    </select>
                </div>

                {projectId ? (
                    <div style={{ marginBottom: '15px', padding: '10px', background: 'rgba(59, 130, 246, 0.05)', borderRadius: '4px', border: '1px solid rgba(59, 130, 246, 0.2)' }}>
                        <div style={{ fontSize: '0.85em', color: '#888', marginBottom: '2px' }}>Project: <span style={{ color: '#ccc' }}>{projects.find(p => p.id === projectId)?.name || projectId}</span></div>
                        {issueId && (
                            <div style={{ fontSize: '0.85em', color: '#888' }}>Issue ID: <span style={{ color: '#ccc' }}>{issueId}</span></div>
                        )}
                    </div>
                ) : (
                    <div style={{ marginBottom: '15px', padding: '10px', background: '#333', borderRadius: '4px', color: '#888', fontSize: '0.9em' }}>
                        {isEditMode ? "Current project details not mapped to a profile." : "Please select a profile to load project details."}
                    </div>
                )}

                <div style={{ marginBottom: '10px' }}>
                    <label style={{ display: 'block', marginBottom: '5px' }}>Hours</label>
                    <input type="number" step="0.25" value={hours} onChange={e => setHours(Number(e.target.value))} style={{ width: '100%', padding: '8px', background: '#333', color: 'white', border: '1px solid #444' }} />
                </div>

                <div style={{ marginBottom: '10px' }}>
                    <label style={{ display: 'block', marginBottom: '5px' }}>Comments</label>
                    <input type="text" value={comments} onChange={e => setComments(e.target.value)} style={{ width: '100%', padding: '8px', background: '#333', color: 'white', border: '1px solid #444' }} />
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '20px' }}>
                    {isEditMode && <button onClick={handleDelete} style={{ background: '#ef4444' }}>Delete</button>}
                    <div style={{ display: 'flex', gap: '10px', marginLeft: 'auto' }}>
                        <button onClick={onClose} style={{ background: 'transparent', border: '1px solid #555' }}>Cancel</button>
                        <button onClick={handleSave} disabled={!projectId && !isEditMode} style={{ background: (!projectId && !isEditMode) ? '#555' : '#3b82f6', cursor: (!projectId && !isEditMode) ? 'not-allowed' : 'pointer' }}>Save</button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default TimeEntryModal;
