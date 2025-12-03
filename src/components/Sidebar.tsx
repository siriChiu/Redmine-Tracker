import { NavLink } from 'react-router-dom';

const Sidebar = () => {
    const linkStyle = ({ isActive }: { isActive: boolean }) => ({
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '50px',
        height: '50px',
        borderRadius: '12px',
        margin: '10px 0',
        color: isActive ? '#fff' : 'var(--text-secondary)',
        background: isActive ? 'var(--accent-gradient)' : 'transparent',
        boxShadow: isActive ? '0 4px 15px rgba(100, 108, 255, 0.4)' : 'none',
        transition: 'all 0.3s ease',
        textDecoration: 'none',
        fontSize: '1.5em',
        position: 'relative' as const
    });

    return (
        <div style={{
            width: '60px',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            padding: '10px 0 100px 0',
            backgroundColor: 'rgba(30, 30, 36, 0.3)', // Subtle background
            borderRight: '1px solid var(--glass-border)',
            zIndex: 100
        }}>
            {/* Navigation Items aligned to top */}
            <NavLink to="/dashboard" style={linkStyle} title="Dashboard">
                <span className="icon">📊</span>
            </NavLink>
            <NavLink to="/planner" style={linkStyle} title="Daily Planner">
                <span className="icon">📝</span>
            </NavLink>
            <NavLink to="/calendar" style={linkStyle} title="Calendar">
                <span className="icon">📅</span>
            </NavLink>
            <NavLink to="/projects" style={linkStyle} title="Projects">
                <span className="icon">📁</span>
            </NavLink>

            <div style={{ flex: 1 }}></div>

            <NavLink to="/settings" style={({ isActive }) => ({ ...linkStyle({ isActive }), marginBottom: '20px' })} title="Settings">
                <span className="icon">⚙️</span>
            </NavLink>
        </div>
    );
};

export default Sidebar;
