import React from 'react';

interface Task {
    id: string;
    name: string;
    planned_hours: number;
    redmine_issue_id?: number;
}

interface PlannerConfirmationModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    tasks: Task[];
}

const PlannerConfirmationModal: React.FC<PlannerConfirmationModalProps> = ({ isOpen, onClose, onConfirm, tasks }) => {
    if (!isOpen) return null;

    const totalHours = tasks.reduce((sum, t) => sum + t.planned_hours, 0);

    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
            <div style={{ background: '#2a2a2a', padding: '20px', borderRadius: '8px', width: '500px', maxHeight: '80vh', overflow: 'auto' }}>
                <h2>Confirm Time Log</h2>
                <p>You are about to log time for the following tasks:</p>
                <ul style={{ listStyle: 'none', padding: 0 }}>
                    {tasks.map(task => (
                        <li key={task.id} style={{ padding: '10px', borderBottom: '1px solid #444', display: 'flex', justifyContent: 'space-between' }}>
                            <span>{task.name} {task.redmine_issue_id && <span style={{ color: '#aaa' }}>#{task.redmine_issue_id}</span>}</span>
                            <strong>{task.planned_hours}h</strong>
                        </li>
                    ))}
                </ul>
                <div style={{ textAlign: 'right', marginTop: '20px', borderTop: '1px solid #555', paddingTop: '10px' }}>
                    <strong>Total: {totalHours.toFixed(2)}h</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
                    <button onClick={onClose} style={{ background: 'transparent', border: '1px solid #555' }}>Cancel</button>
                    <button onClick={onConfirm} style={{ background: '#3b82f6' }}>Confirm & Log</button>
                </div>
            </div>
        </div>
    );
};

export default PlannerConfirmationModal;
