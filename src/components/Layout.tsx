import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import TitleBar from './TitleBar';

const Layout = () => {
    return (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            height: '100vh',
            width: '100vw',
            overflow: 'hidden',
            background: 'radial-gradient(circle at top right, #1e1e24 0%, #0f0f13 100%)'
        }}>
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
