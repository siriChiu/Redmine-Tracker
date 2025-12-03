import { useEffect, useRef } from 'react';

const Confetti = ({ active }: { active: boolean }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        if (!active || !canvasRef.current) return;

        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;

        const particles: any[] = [];
        const colors = ['#26ccff', '#a25afd', '#ff5e7e', '#88ff5a', '#fcff42', '#ffa62d', '#ff36ff'];

        for (let i = 0; i < 200; i++) {
            particles.push({
                x: Math.random() * canvas.width,
                y: Math.random() * canvas.height - canvas.height,
                w: Math.random() * 10 + 5,
                h: Math.random() * 10 + 5,
                color: colors[Math.floor(Math.random() * colors.length)],
                vy: Math.random() * 3 + 2,
                vx: Math.random() * 4 - 2,
                r: Math.random() * 360,
                vr: Math.random() * 10 - 5
            });
        }

        let animationId: number;

        const animate = () => {
            if (!ctx) return;
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            particles.forEach((p) => {
                ctx.save();
                ctx.translate(p.x + p.w / 2, p.y + p.h / 2);
                ctx.rotate((p.r * Math.PI) / 180);
                ctx.fillStyle = p.color;
                ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
                ctx.restore();

                p.y += p.vy;
                p.x += p.vx;
                p.r += p.vr;

                if (p.y > canvas.height) {
                    p.y = -p.h;
                    p.x = Math.random() * canvas.width;
                }
            });

            animationId = requestAnimationFrame(animate);
        };

        animate();

        // Stop after 5 seconds
        const timeout = setTimeout(() => {
            cancelAnimationFrame(animationId);
            if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
        }, 5000);

        return () => {
            cancelAnimationFrame(animationId);
            clearTimeout(timeout);
        };
    }, [active]);

    if (!active) return null;

    return (
        <canvas
            ref={canvasRef}
            style={{
                position: 'fixed',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                pointerEvents: 'none',
                zIndex: 9999
            }}
        />
    );
};

export default Confetti;
