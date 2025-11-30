import { useEffect, useState } from 'react';

const DashboardView = () => {
    const [dailyHours, setDailyHours] = useState(0);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch('http://127.0.0.1:8000/api/redmine/daily_hours')
            .then(res => res.json())
            .then(data => {
                const target = data.hours || 0;
                // Animate count up
                let start = 0;
                const duration = 1000; // 1s
                const startTime = performance.now();

                const animate = (currentTime: number) => {
                    const elapsed = currentTime - startTime;
                    const progress = Math.min(elapsed / duration, 1);

                    // Ease out quart
                    const ease = 1 - Math.pow(1 - progress, 4);

                    const current = start + (target - start) * ease;
                    setDailyHours(current);

                    if (progress < 1) {
                        requestAnimationFrame(animate);
                    } else {
                        setLoading(false);
                    }
                };

                requestAnimationFrame(animate);
            })
            .catch(err => {
                console.error(err);
                setLoading(false);
            });
    }, []);

    return (
        <div style={{ padding: '40px', maxWidth: '1200px', margin: '0 auto' }}>
            <h1 style={{ marginBottom: '40px' }}>Dashboard</h1>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '30px' }}>
                {/* Daily Hours Card */}
                <div className="glass-panel" style={{ padding: '30px', position: 'relative', overflow: 'hidden' }}>
                    <div style={{
                        position: 'absolute', top: '-20px', right: '-20px',
                        fontSize: '10em', opacity: 0.05, transform: 'rotate(15deg)'
                    }}>
                        ⏱️
                    </div>

                    <h3 style={{ margin: '0 0 20px 0', color: 'var(--text-secondary)', fontSize: '1.1em', fontWeight: 500 }}>
                        Hours Today
                    </h3>

                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px' }}>
                        <div style={{
                            fontSize: '4em',
                            fontWeight: 700,
                            background: 'var(--accent-gradient)',
                            WebkitBackgroundClip: 'text',
                            WebkitTextFillColor: 'transparent'
                        }}>
                            {loading ? '...' : dailyHours.toFixed(2)}
                        </div>
                        <span style={{ fontSize: '1.2em', color: 'var(--text-secondary)' }}>hrs</span>
                    </div>

                    <div style={{ marginTop: '20px', fontSize: '0.9em', color: 'var(--text-secondary)' }}>
                        Target: <span style={{ color: 'var(--text-primary)' }}>8.0 hrs</span>
                    </div>
                </div>

                {/* Placeholder for Weekly Stats */}
                <div className="glass-panel" style={{ padding: '30px', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', opacity: 0.7 }}>
                    <div style={{ fontSize: '3em', marginBottom: '10px' }}>📊</div>
                    <div style={{ color: 'var(--text-secondary)' }}>Weekly stats coming soon...</div>
                </div>
            </div>
        </div>
    );
};

export default DashboardView;
