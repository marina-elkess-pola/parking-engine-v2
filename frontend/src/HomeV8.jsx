import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { motion, useInView, useScroll, useTransform } from 'framer-motion';
import { SHOW_DRAFT_TOOLS } from './config/featureFlags';

/* ───────────────────────────────────────────────────────────
   VERSION 8 — "The Magnetic Field"
   Full-screen interactive dot grid that warps around cursor.
   Particles cluster and ripple. Brand and tools emerge from
   the magnetic field. No WebGL — pure Canvas 2D + CSS.
   ─────────────────────────────────────────────────────────── */

/* ── Interactive Dot Grid Canvas ── */
function MagneticCanvas({ className }) {
    const canvasRef = useRef(null);
    const mouseRef = useRef({ x: -1000, y: -1000, down: false });
    const pulsesRef = useRef([]);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        let w, h, cols, rows, dots;
        const spacing = 28;
        const dotBase = 1.8;

        function buildGrid() {
            w = canvas.width = canvas.offsetWidth * window.devicePixelRatio;
            h = canvas.height = canvas.offsetHeight * window.devicePixelRatio;
            ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
            cols = Math.ceil(canvas.offsetWidth / spacing) + 2;
            rows = Math.ceil(canvas.offsetHeight / spacing) + 2;
            dots = [];
            for (let r = 0; r < rows; r++) {
                for (let c = 0; c < cols; c++) {
                    dots.push({
                        ox: c * spacing,
                        oy: r * spacing,
                        x: c * spacing,
                        y: r * spacing,
                        vx: 0,
                        vy: 0,
                        radius: dotBase,
                    });
                }
            }
        }
        buildGrid();

        const palette = [
            [20, 184, 166],   // teal
            [59, 130, 246],   // blue
            [139, 92, 246],   // purple
            [6, 182, 212],    // cyan
        ];

        let frame;
        let t = 0;

        function animate() {
            frame = requestAnimationFrame(animate);
            t += 0.016;
            const cw = canvas.offsetWidth;
            const ch = canvas.offsetHeight;

            ctx.clearRect(0, 0, cw, ch);

            const mx = mouseRef.current.x;
            const my = mouseRef.current.y;
            const isDown = mouseRef.current.down;
            const fieldRadius = isDown ? 180 : 140;
            const fieldStrength = isDown ? 45 : 25;

            // Update pulses
            for (let i = pulsesRef.current.length - 1; i >= 0; i--) {
                const p = pulsesRef.current[i];
                p.r += 3;
                p.opacity -= 0.012;
                if (p.opacity <= 0) pulsesRef.current.splice(i, 1);
            }

            // Update dots
            for (const dot of dots) {
                const dx = mx - dot.ox;
                const dy = my - dot.oy;
                const dist = Math.sqrt(dx * dx + dy * dy);

                // Magnetic repulsion
                if (dist < fieldRadius && dist > 0) {
                    const force = (1 - dist / fieldRadius) * fieldStrength;
                    dot.vx -= (dx / dist) * force * 0.05;
                    dot.vy -= (dy / dist) * force * 0.05;
                }

                // Pulse waves
                for (const p of pulsesRef.current) {
                    const pdx = p.x - dot.ox;
                    const pdy = p.y - dot.oy;
                    const pdist = Math.sqrt(pdx * pdx + pdy * pdy);
                    const waveDist = Math.abs(pdist - p.r);
                    if (waveDist < 30) {
                        const waveForce = (1 - waveDist / 30) * 8 * p.opacity;
                        dot.vx -= (pdx / (pdist || 1)) * waveForce * 0.03;
                        dot.vy -= (pdy / (pdist || 1)) * waveForce * 0.03;
                    }
                }

                // Spring back
                dot.vx += (dot.ox - dot.x) * 0.06;
                dot.vy += (dot.oy - dot.y) * 0.06;

                // Damping
                dot.vx *= 0.88;
                dot.vy *= 0.88;

                dot.x += dot.vx;
                dot.y += dot.vy;

                // Size & color
                const displacement = Math.sqrt((dot.x - dot.ox) ** 2 + (dot.y - dot.oy) ** 2);
                const norm = Math.min(displacement / 20, 1);
                dot.radius = dotBase + norm * 3;

                // Color interpolation
                const colorIdx = Math.floor(norm * (palette.length - 1));
                const nextIdx = Math.min(colorIdx + 1, palette.length - 1);
                const ct = (norm * (palette.length - 1)) - colorIdx;
                const cr = palette[colorIdx][0] + (palette[nextIdx][0] - palette[colorIdx][0]) * ct;
                const cg = palette[colorIdx][1] + (palette[nextIdx][1] - palette[colorIdx][1]) * ct;
                const cb = palette[colorIdx][2] + (palette[nextIdx][2] - palette[colorIdx][2]) * ct;
                const alpha = 0.15 + norm * 0.75;

                // Ambient float
                const float = Math.sin(dot.ox * 0.01 + t) * Math.cos(dot.oy * 0.01 + t * 0.7) * 0.4;

                ctx.beginPath();
                ctx.arc(dot.x, dot.y + float, dot.radius, 0, Math.PI * 2);
                ctx.fillStyle = norm > 0.05
                    ? `rgba(${Math.round(cr)},${Math.round(cg)},${Math.round(cb)},${alpha})`
                    : `rgba(255,255,255,${0.08 + Math.sin(dot.ox * 0.02 + t * 0.5) * 0.03})`;
                ctx.fill();
            }

            // Draw pulse rings
            for (const p of pulsesRef.current) {
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
                ctx.strokeStyle = `rgba(20,184,166,${p.opacity * 0.3})`;
                ctx.lineWidth = 1.5;
                ctx.stroke();
            }
        }
        animate();

        function onMouseMove(e) {
            const rect = canvas.getBoundingClientRect();
            mouseRef.current.x = e.clientX - rect.left;
            mouseRef.current.y = e.clientY - rect.top;
        }
        function onMouseDown(e) {
            mouseRef.current.down = true;
            const rect = canvas.getBoundingClientRect();
            pulsesRef.current.push({ x: e.clientX - rect.left, y: e.clientY - rect.top, r: 0, opacity: 1 });
        }
        function onMouseUp() { mouseRef.current.down = false; }
        function onMouseLeave() { mouseRef.current.x = -1000; mouseRef.current.y = -1000; mouseRef.current.down = false; }
        function onTouchMove(e) {
            if (e.touches.length) {
                const rect = canvas.getBoundingClientRect();
                mouseRef.current.x = e.touches[0].clientX - rect.left;
                mouseRef.current.y = e.touches[0].clientY - rect.top;
            }
        }
        function onTouchStart(e) {
            onTouchMove(e);
            if (e.touches.length) {
                const rect = canvas.getBoundingClientRect();
                pulsesRef.current.push({ x: e.touches[0].clientX - rect.left, y: e.touches[0].clientY - rect.top, r: 0, opacity: 1 });
            }
        }
        function onTouchEnd() { mouseRef.current.x = -1000; mouseRef.current.y = -1000; }

        function onResize() {
            buildGrid();
        }

        canvas.addEventListener('mousemove', onMouseMove);
        canvas.addEventListener('mousedown', onMouseDown);
        canvas.addEventListener('mouseup', onMouseUp);
        canvas.addEventListener('mouseleave', onMouseLeave);
        canvas.addEventListener('touchmove', onTouchMove, { passive: true });
        canvas.addEventListener('touchstart', onTouchStart, { passive: true });
        canvas.addEventListener('touchend', onTouchEnd);
        window.addEventListener('resize', onResize);

        return () => {
            cancelAnimationFrame(frame);
            canvas.removeEventListener('mousemove', onMouseMove);
            canvas.removeEventListener('mousedown', onMouseDown);
            canvas.removeEventListener('mouseup', onMouseUp);
            canvas.removeEventListener('mouseleave', onMouseLeave);
            canvas.removeEventListener('touchmove', onTouchMove);
            canvas.removeEventListener('touchstart', onTouchStart);
            canvas.removeEventListener('touchend', onTouchEnd);
            window.removeEventListener('resize', onResize);
        };
    }, []);

    return <canvas ref={canvasRef} className={className} style={{ touchAction: 'none' }} />;
}

/* ── Floating Nav ── */
function FloatingNav() {
    const [scrolled, setScrolled] = useState(false);
    useEffect(() => {
        const onScroll = () => setScrolled(window.scrollY > 50);
        window.addEventListener('scroll', onScroll, { passive: true });
        return () => window.removeEventListener('scroll', onScroll);
    }, []);

    return (
        <motion.nav
            className="fixed top-0 left-0 right-0 z-50 px-6 lg:px-10 py-4 flex items-center justify-between transition-all duration-300"
            style={{ backgroundColor: scrolled ? 'rgba(10,10,15,0.9)' : 'transparent', backdropFilter: scrolled ? 'blur(16px)' : 'none' }}
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
        >
            <Link to="/" className="flex items-center gap-2.5">
                <img src="/genfabtools-logo.png" alt="" className="h-7 w-7 brightness-0 invert opacity-90" />
                <span className="text-sm font-bold text-white tracking-wide">GenFabTools</span>
            </Link>
            <div className="hidden sm:flex items-center gap-6">
                <Link to="/tools" className="text-sm text-white/50 hover:text-white transition-colors">Tools</Link>
                <Link to="/rsi" className="text-sm text-white/50 hover:text-white transition-colors">RSI</Link>
                <Link to="/about" className="text-sm text-white/50 hover:text-white transition-colors">About</Link>
                <Link to="/register" className="text-sm bg-teal-500/20 hover:bg-teal-500/30 text-teal-300 px-5 py-2 rounded-full font-semibold transition-colors border border-teal-500/20">
                    Get Started
                </Link>
            </div>
        </motion.nav>
    );
}

/* ── Reveal component ── */
function Reveal({ children, className = '', delay = 0 }) {
    const ref = useRef(null);
    const inView = useInView(ref, { once: true, margin: '-50px' });
    return (
        <motion.div ref={ref} className={className}
            initial={{ opacity: 0, y: 24 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.7, delay, ease: [0.22, 1, 0.36, 1] }}
        >{children}</motion.div>
    );
}

/* ── Rotating word ── */
function RotatingWord({ words }) {
    const [idx, setIdx] = useState(0);
    useEffect(() => {
        const timer = setInterval(() => setIdx(i => (i + 1) % words.length), 2800);
        return () => clearInterval(timer);
    }, [words.length]);

    return (
        <span className="inline-block relative h-[1.15em] overflow-hidden align-bottom">
            {words.map((word, i) => (
                <motion.span
                    key={word}
                    className="absolute left-0 top-0 bg-gradient-to-r from-teal-400 via-cyan-300 to-blue-400 bg-clip-text text-transparent whitespace-nowrap"
                    initial={{ y: '100%', opacity: 0 }}
                    animate={i === idx ? { y: 0, opacity: 1 } : { y: '-100%', opacity: 0 }}
                    transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                >
                    {word}
                </motion.span>
            ))}
        </span>
    );
}

/* ── Tool data ── */
const TOOLS = [
    { id: 'rsi', name: 'RSI', full: 'Residential Scheme Intelligence', tagline: 'Score schemes in seconds, not days.', desc: 'Efficiency scoring, financial feasibility, and scheme comparison — all live inside Revit.', color: '#14b8a6', status: 'live', link: '/rsi', image: '/images/rsi/project00.png' },
    { id: 'sitegen', name: 'SiteGen', full: 'Site Generator', tagline: 'From constraints to massing.', desc: 'Automated building massing and parking from site constraints.', color: '#3b82f6', status: 'coming', link: SHOW_DRAFT_TOOLS ? '/sitegen' : null },
    { id: 'occucalc', name: 'OccuCalc', full: 'Occupancy Calculator', tagline: 'Code-compliant, instantly.', desc: 'Occupant loads calculated from your floor plans in real time.', color: '#8b5cf6', status: 'coming', link: SHOW_DRAFT_TOOLS ? '/occucalc' : null },
    { id: 'parkcore', name: 'ParkCore', full: 'Parking Core Engine', tagline: 'Optimal layouts, every time.', desc: 'Generate optimized parking layouts from any boundary geometry.', color: '#f59e0b', status: 'coming', link: SHOW_DRAFT_TOOLS ? '/parkcore' : null },
];

export default function HomeV8() {
    return (
        <div className="bg-[#0a0a0f] text-white selection:bg-teal-400/30 overflow-x-hidden">
            <FloatingNav />

            {/* ── Hero — Full-screen magnetic field ── */}
            <section className="relative w-full h-screen overflow-hidden cursor-crosshair">
                <MagneticCanvas className="absolute inset-0 w-full h-full" />

                {/* Overlay content */}
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none"
                    style={{ background: 'radial-gradient(circle at 50% 50%, transparent 20%, rgba(10,10,15,0.4) 70%)' }}
                >
                    <motion.div
                        className="text-center px-6 max-w-5xl"
                        initial={{ opacity: 0, scale: 0.96 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 1.2, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
                    >
                        <motion.div
                            className="inline-flex items-center gap-2 bg-white/[0.04] border border-white/[0.08] rounded-full px-4 py-1.5 mb-8"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.6, duration: 0.6 }}
                        >
                            <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                            <span className="text-[11px] font-semibold text-white/60 tracking-wide uppercase">RSI is live — more tools coming</span>
                        </motion.div>

                        <h1 className="text-5xl sm:text-7xl lg:text-[5.5rem] font-extrabold tracking-tight leading-[1.05]">
                            Intelligent tools
                            <br />
                            for{' '}
                            <RotatingWord words={['architects', 'engineers', 'planners', 'developers', 'the built world']} />
                        </h1>

                        <p className="mt-6 text-base sm:text-lg text-white/40 font-light max-w-xl mx-auto leading-relaxed">
                            Move your cursor. Click to create waves. This is GenFabTools — an ecosystem of purpose-built AEC utilities that transform how you design.
                        </p>

                        <div className="mt-10 flex flex-wrap justify-center gap-3 pointer-events-auto">
                            <Link
                                to="/tools"
                                className="group relative bg-gradient-to-r from-teal-500 to-cyan-500 text-white px-8 py-4 rounded-full text-sm font-bold hover:shadow-xl hover:shadow-teal-500/20 transition-all hover:-translate-y-0.5 overflow-hidden"
                            >
                                <span className="relative z-10">Explore the Ecosystem <span className="inline-block ml-1 group-hover:translate-x-1 transition-transform">→</span></span>
                            </Link>
                            <Link
                                to="/rsi"
                                className="bg-white/[0.04] border border-white/10 text-white/70 px-8 py-4 rounded-full text-sm font-semibold hover:bg-white/[0.08] transition-all backdrop-blur-sm"
                            >
                                See RSI in action
                            </Link>
                        </div>
                    </motion.div>
                </div>

                {/* Scroll hint */}
                <motion.div
                    className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 2.5, duration: 1 }}
                >
                    <span className="text-[10px] text-white/20 tracking-[0.15em] uppercase">Scroll</span>
                    <motion.div
                        className="w-px h-8 bg-gradient-to-b from-white/20 to-transparent"
                        animate={{ scaleY: [1, 0.5, 1] }}
                        transition={{ repeat: Infinity, duration: 1.8, ease: 'easeInOut' }}
                    />
                </motion.div>
            </section>

            {/* ── Impact statement ── */}
            <section className="w-full py-28 lg:py-36 bg-gradient-to-b from-[#0a0a0f] to-[#0d0d14]">
                <div className="px-6 sm:px-12 lg:px-20 max-w-7xl mx-auto">
                    <Reveal>
                        <p className="text-2xl sm:text-4xl lg:text-5xl text-white/90 font-medium leading-snug tracking-tight">
                            The AEC industry runs on repetitive calculations.
                            <span className="text-white/30"> We automate every single one — starting with residential scheme analysis, and expanding to every tool the industry needs.</span>
                        </p>
                    </Reveal>
                </div>
            </section>

            {/* ── Tool Showcase — Full-bleed alternating ── */}
            <section className="w-full">
                {TOOLS.map((tool, i) => (
                    <div key={tool.id} className="relative border-t border-white/[0.04]">
                        <div className={`px-6 sm:px-12 lg:px-20 py-20 lg:py-28 max-w-7xl mx-auto grid lg:grid-cols-2 gap-12 lg:gap-20 items-center ${i % 2 === 1 ? 'lg:direction-rtl' : ''}`}>
                            {/* Text */}
                            <Reveal className={i % 2 === 1 ? 'lg:order-2 lg:text-left' : ''}>
                                <div className="flex items-center gap-3 mb-4">
                                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: tool.color }} />
                                    <span className="text-xs font-bold tracking-[0.15em] uppercase" style={{ color: tool.color }}>
                                        {tool.name}
                                    </span>
                                    {tool.status === 'live' ? (
                                        <span className="ml-2 text-[10px] font-bold tracking-widest uppercase text-green-400 bg-green-400/10 px-2 py-0.5 rounded-full">Live</span>
                                    ) : (
                                        <span className="ml-2 text-[10px] font-bold tracking-widest uppercase text-slate-600 bg-white/[0.03] px-2 py-0.5 rounded-full">Coming Soon</span>
                                    )}
                                </div>
                                <h3 className="text-3xl sm:text-4xl font-bold tracking-tight">{tool.full}</h3>
                                <p className="mt-2 text-xl text-white/60 font-light">{tool.tagline}</p>
                                <p className="mt-4 text-sm text-slate-500 leading-relaxed max-w-md">{tool.desc}</p>
                                {tool.link && (
                                    <Link
                                        to={tool.link}
                                        className="inline-flex items-center gap-2 mt-6 text-sm font-semibold hover:gap-3 transition-all"
                                        style={{ color: tool.color }}
                                    >
                                        Explore {tool.name} <span>→</span>
                                    </Link>
                                )}
                            </Reveal>

                            {/* Visual */}
                            <Reveal delay={0.1} className={i % 2 === 1 ? 'lg:order-1' : ''}>
                                {tool.image ? (
                                    <div className="relative rounded-2xl overflow-hidden border border-white/[0.06] bg-white/[0.02] group">
                                        <div className="absolute inset-0 bg-gradient-to-tr opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                                            style={{ background: `linear-gradient(135deg, ${tool.color}08, transparent)` }}
                                        />
                                        <img src={tool.image} alt={tool.full} className="w-full" loading="lazy" />
                                    </div>
                                ) : (
                                    <div className="relative h-64 lg:h-80 rounded-2xl overflow-hidden border border-white/[0.06] bg-white/[0.02] flex items-center justify-center">
                                        {/* Decorative grid pattern */}
                                        <div className="absolute inset-0 opacity-[0.03]" style={{
                                            backgroundImage: `linear-gradient(${tool.color} 1px, transparent 1px), linear-gradient(90deg, ${tool.color} 1px, transparent 1px)`,
                                            backgroundSize: '20px 20px'
                                        }} />
                                        <div className="text-center">
                                            <div className="w-16 h-16 rounded-2xl mx-auto flex items-center justify-center mb-4" style={{ backgroundColor: `${tool.color}15` }}>
                                                <span className="text-xl font-extrabold" style={{ color: tool.color }}>{tool.name}</span>
                                            </div>
                                            <p className="text-sm text-slate-600">In active development</p>
                                        </div>
                                    </div>
                                )}
                            </Reveal>
                        </div>
                    </div>
                ))}
            </section>

            {/* ── Stats Band ── */}
            <section className="w-full border-y border-white/5">
                <div className="grid grid-cols-2 lg:grid-cols-4 divide-x divide-white/5">
                    {[
                        { n: '4+', label: 'Tools planned' },
                        { n: '<10s', label: 'Per analysis' },
                        { n: '10×', label: 'Faster workflow' },
                        { n: '1', label: 'Platform' },
                    ].map((s, i) => (
                        <Reveal key={i} delay={i * 0.05}>
                            <div className="px-6 py-12 text-center">
                                <p className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white">{s.n}</p>
                                <p className="mt-1 text-[11px] text-slate-600 tracking-wider uppercase">{s.label}</p>
                            </div>
                        </Reveal>
                    ))}
                </div>
            </section>

            {/* ── Why GenFabTools — Full-width dark on darker ── */}
            <section className="w-full py-28 lg:py-36 bg-[#080810]">
                <div className="px-6 sm:px-12 lg:px-20 max-w-7xl mx-auto">
                    <Reveal>
                        <span className="text-xs font-bold tracking-[0.2em] uppercase text-teal-400 mb-4 block">Why GenFabTools</span>
                        <h2 className="text-3xl sm:text-5xl font-extrabold tracking-tight mb-16">Not another all-in-one.<br /><span className="text-slate-600">Each tool does one thing brilliantly.</span></h2>
                    </Reveal>

                    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
                        {[
                            { icon: '⚡', title: 'Instant', desc: 'Results in seconds. No waiting for batch processes or server queues.' },
                            { icon: '🎯', title: 'Purpose-built', desc: 'Each tool targets a single AEC bottleneck. No feature bloat.' },
                            { icon: '🔗', title: 'Inside your workflow', desc: 'Works in Revit, your browser, your tools — not a new platform to learn.' },
                            { icon: '📐', title: 'AEC-native', desc: 'Built by architects, for architects. Every metric means something.' },
                            { icon: '🔄', title: 'Always growing', desc: 'New tools ship regularly. Your subscription unlocks the full ecosystem.' },
                            { icon: '🛡️', title: 'Production-grade', desc: 'Enterprise security, reliability, and performance from day one.' },
                        ].map((item, i) => (
                            <Reveal key={i} delay={i * 0.05}>
                                <div className="bg-white/[0.02] border border-white/[0.05] rounded-2xl p-7 hover:bg-white/[0.04] hover:border-white/[0.08] transition-all duration-300 h-full">
                                    <span className="text-2xl block mb-4">{item.icon}</span>
                                    <h3 className="font-bold text-white mb-2">{item.title}</h3>
                                    <p className="text-sm text-slate-500 leading-relaxed">{item.desc}</p>
                                </div>
                            </Reveal>
                        ))}
                    </div>
                </div>
            </section>

            {/* ── CTA ── */}
            <section className="relative w-full py-32 overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-t from-teal-500/[0.04] via-transparent to-transparent" />
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-3xl h-px bg-gradient-to-r from-transparent via-teal-500/30 to-transparent" />

                <div className="relative px-6 sm:px-12 lg:px-20 text-center max-w-3xl mx-auto">
                    <Reveal>
                        <h2 className="text-4xl sm:text-6xl font-extrabold tracking-tight leading-tight">
                            Ready to work
                            <br />
                            <span className="bg-gradient-to-r from-teal-400 to-blue-400 bg-clip-text text-transparent">smarter?</span>
                        </h2>
                        <p className="mt-6 text-slate-500 text-lg">
                            Join the architects and engineers who are automating their most repetitive calculations.
                        </p>
                        <div className="mt-10 flex flex-wrap justify-center gap-4">
                            <Link
                                to="/register"
                                className="bg-gradient-to-r from-teal-500 to-cyan-500 text-white px-10 py-4 rounded-full text-sm font-bold hover:shadow-xl hover:shadow-teal-500/20 transition-all hover:-translate-y-0.5"
                            >
                                Create free account
                            </Link>
                            <Link
                                to="/login"
                                className="bg-white/[0.04] border border-white/10 text-white/70 px-8 py-4 rounded-full text-sm font-semibold hover:bg-white/[0.08] transition-all"
                            >
                                Sign in
                            </Link>
                        </div>
                    </Reveal>
                </div>
            </section>

            {/* ── Footer ── */}
            <footer className="w-full border-t border-white/5 py-8 px-6 sm:px-12 lg:px-20">
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-600 max-w-7xl mx-auto">
                    <span>© {new Date().getFullYear()} GenFabTools. All rights reserved.</span>
                    <div className="flex gap-6">
                        <Link to="/contact" className="hover:text-white transition-colors">Contact</Link>
                        <Link to="/about" className="hover:text-white transition-colors">About</Link>
                        <Link to="/faq" className="hover:text-white transition-colors">FAQ</Link>
                    </div>
                </div>
            </footer>
        </div>
    );
}
