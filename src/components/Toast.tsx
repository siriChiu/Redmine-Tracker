import React, { useEffect } from 'react';

interface ToastProps {
    message: string;
    type?: 'success' | 'error' | 'info';
    onClose: () => void;
    duration?: number;
}

export const Toast: React.FC<ToastProps> = ({ message, type = 'info', onClose, duration = 3000 }) => {
    useEffect(() => {
        const timer = setTimeout(() => {
            onClose();
        }, duration);
        return () => clearTimeout(timer);
    }, [duration, onClose]);

    const bgColors = {
        success: 'rgba(76, 175, 80, 0.9)',
        error: 'rgba(244, 67, 54, 0.9)',
        info: 'rgba(33, 150, 243, 0.9)'
    };

    return (
        <div style={{
            padding: '12px 24px',
            marginBottom: '10px',
            borderRadius: '8px',
            background: bgColors[type],
            color: 'white',
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            minWidth: '250px',
            backdropFilter: 'blur(5px)',
            animation: 'slideIn 0.3s ease-out',
            zIndex: 9999
        }}>
            <span>{message}</span>
            <button
                onClick={onClose}
                style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'white',
                    marginLeft: '15px',
                    cursor: 'pointer',
                    fontSize: '0.9em', // Reduced size
                    padding: '2px', // Reduced padding
                    lineHeight: 1,
                    opacity: 0.8
                }}
            >
                ×
            </button>
            <style>{`
                @keyframes slideIn {
                    from { transform: translateX(100%); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                }
            `}</style>
        </div>
    );
};

interface ToastContainerProps {
    toasts: { id: string; message: string; type: 'success' | 'error' | 'info' }[];
    removeToast: (id: string) => void;
}

export const ToastContainer: React.FC<ToastContainerProps> = ({ toasts, removeToast }) => {
    return (
        <div style={{
            position: 'fixed',
            top: '20px',
            right: '20px',
            zIndex: 9999,
            display: 'flex',
            flexDirection: 'column'
        }}>
            {toasts.map(t => (
                <Toast
                    key={t.id}
                    message={t.message}
                    type={t.type}
                    onClose={() => removeToast(t.id)}
                />
            ))}
        </div>
    );
};
