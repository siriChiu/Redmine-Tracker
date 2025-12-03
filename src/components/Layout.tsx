import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import TitleBar from './TitleBar';
import { ToastContainer } from './Toast';
import { useState, useEffect } from 'react';

const Layout = () => {
    const [toasts, setToasts] = useState<{ id: string; message: string; type: 'success' | 'error' | 'info' }[]>([]);

    const addToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
        const id = Date.now().toString();
        setToasts(prev => [...prev, { id, message, type }]);
    };

    const removeToast = (id: string) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    };

    useEffect(() => {
        // Check for API Key on mount
        fetch('http://127.0.0.1:8000/api/settings')
            .then(res => res.json())
            .then(data => {
                if (!data.api_key) {
                    addToast("Please configure your Redmine API Key in Settings", 'error');
                }
            })
            .catch(() => {
                // Backend might be down, silent fail or show connection error
                // For now, silent as the user might just be starting up
            });
    }, []);

    return (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            height: '100vh',
            width: '100vw',
            overflow: 'hidden',
            background: 'radial-gradient(circle at top right, #1e1e24 0%, #0f0f13 100%)'
        }}>
            <ToastContainer toasts={toasts} removeToast={removeToast} />
            <TitleBar />
            <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
                <Sidebar />
                <div className="content-area" style={{
                    flex: 1,
                    overflowY: 'auto',
                    padding: '0',
                    scrollBehavior: 'smooth',
                    position: 'relative'
                }}>
                    <Outlet />
                </div>
            </div>
        </div>
    );
};

export default Layout;
