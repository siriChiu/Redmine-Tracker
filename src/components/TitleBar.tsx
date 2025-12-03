import React from 'react';

const TitleBar = () => {
    const handleMinimize = () => {
        if (window.require) {
            const { ipcRenderer } = window.require('electron');
            ipcRenderer.send('minimize-to-tray');
        }
    };

    const handleQuit = () => {
        if (window.require) {
            const { ipcRenderer } = window.require('electron');
            ipcRenderer.send('quit-app');
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
            <div style={{ display: 'flex', height: '100%', WebkitAppRegion: 'no-drag' } as any}>
                {/* Minimize Button */}
                <div
                    onClick={handleMinimize}
                    style={{
                        width: '40px',
                        height: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        color: 'var(--text-secondary)',
                        transition: 'background 0.2s',
                        fontSize: '14px'
                    }}
                    onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
                        e.currentTarget.style.color = 'white';
                    }}
                    onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'transparent';
                        e.currentTarget.style.color = 'var(--text-secondary)';
                    }}
                    title="Minimize to Tray"
                >
                    ─
                </div>

                {/* Close Button */}
                <div
                    onClick={handleQuit}
                    style={{
                        width: '40px',
                        height: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        color: 'var(--text-secondary)',
                        transition: 'background 0.2s',
                        fontSize: '14px'
                    }}
                    onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = '#e81123';
                        e.currentTarget.style.color = 'white';
                    }}
                    onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'transparent';
                        e.currentTarget.style.color = 'var(--text-secondary)';
                    }}
                    title="Quit Application"
                >
                    ✕
                </div>
            </div>
        </div>
    );
};

export default TitleBar;
