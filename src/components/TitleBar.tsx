import React from 'react';

const TitleBar = () => {
    const handleClose = () => {
        if (window.require) {
            const { ipcRenderer } = window.require('electron');
            ipcRenderer.send('close-window');
        }
    };

    return (
        <div style={{
            height: '32px',
            width: '100%',
            backgroundColor: 'var(--bg-card)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            WebkitAppRegion: 'drag', // Electron specific: allows dragging
            borderBottom: '1px solid var(--glass-border)',
            userSelect: 'none',
            zIndex: 1000
        } as React.CSSProperties}>
            <div style={{ paddingLeft: '15px', fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 600 }}>
                Redmine Tracker
            </div>
            <div
                onClick={handleClose}
                style={{
                    width: '40px',
                    height: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    WebkitAppRegion: 'no-drag', // Clickable
                    color: 'var(--text-secondary)',
                    transition: 'background 0.2s'
                }}
                onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#e81123';
                    e.currentTarget.style.color = 'white';
                }}
                onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                    e.currentTarget.style.color = 'var(--text-secondary)';
                }}
            >
                ✕
            </div>
        </div>
    );
};

export default TitleBar;
