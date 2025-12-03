import React from 'react';

interface ConfirmModalProps {
    isOpen: boolean;
    message: string;
    onConfirm: () => void;
    onCancel: () => void;
    title?: string;
}

const ConfirmModal: React.FC<ConfirmModalProps> = ({ isOpen, message, onConfirm, onCancel, title = "Confirm Action" }) => {
    if (!isOpen) return null;

    return (
        <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000,
            backdropFilter: 'blur(3px)'
        }}>
            <div className="glass-panel" style={{
                padding: '25px',
                borderRadius: '16px',
                width: '400px',
                maxWidth: '90%',
                border: '1px solid var(--glass-border)',
                background: '#1a1a20',
                boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
                transform: 'scale(1)',
                animation: 'popIn 0.2s ease-out'
            }}>
                <h3 style={{
                    marginTop: 0,
                    marginBottom: '15px',
                    color: 'white',
                    fontSize: '1.3em',
                    borderBottom: '1px solid rgba(255,255,255,0.1)',
                    paddingBottom: '10px'
                }}>
                    {title}
                </h3>

                <p style={{
                    color: 'var(--text-secondary)',
                    marginBottom: '25px',
                    fontSize: '1.1em',
                    lineHeight: '1.5'
                }}>
                    {message}
                </p>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                    <button
                        onClick={onCancel}
                        style={{
                            padding: '10px 20px',
                            borderRadius: '8px',
                            border: '1px solid rgba(255,255,255,0.2)',
                            background: 'transparent',
                            color: 'var(--text-secondary)',
                            cursor: 'pointer',
                            fontSize: '1em',
                            transition: 'all 0.2s'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                    >
                        Cancel
                    </button>
                    <button
                        onClick={onConfirm}
                        style={{
                            padding: '10px 20px',
                            borderRadius: '8px',
                            border: 'none',
                            background: 'var(--primary)',
                            color: 'white',
                            cursor: 'pointer',
                            fontWeight: 'bold',
                            fontSize: '1em',
                            boxShadow: '0 4px 12px rgba(100, 108, 255, 0.3)'
                        }}
                    >
                        Confirm
                    </button>
                </div>
            </div>
            <style>{`
                @keyframes popIn {
                    from { transform: scale(0.9); opacity: 0; }
                    to { transform: scale(1); opacity: 1; }
                }
            `}</style>
        </div>
    );
};

export default ConfirmModal;
