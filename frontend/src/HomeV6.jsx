import React, { useRef, useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion, useInView, AnimatePresence } from 'framer-motion';
import { SHOW_DRAFT_TOOLS } from './config/featureFlags';

/* ───────────────────────────────────────────────────────────
   VERSION 6 — "The Orbit"
   Interactive orbital visualization with tools circling the
   GenFabTools brand center. Cursor-reactive, auto-rotating,
   click-to-explore. Full brand identity page with manifesto
   and ecosystem philosophy.
   ─────────────────────────────────────────────────────────── */

function Fade({ children, className = '', delay = 0 }) {
    const ref = useRef(null);
    const inView = useInView(ref, { once: true, margin: '-60px' });
    return (
        <motion.div ref={ref} className={className}
            initial={{ opacity: 0, y: 30 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.7, delay, ease: [0.22, 1, 0.36, 1] }}
        >{children}</motion.div>
    );
}

const TOOLS = [
    { id: 'rsi', name: 'RSI', full: 'Residential Scheme Intelligence', color: '#14b8a6', status: 'live', link: '/rsi', angle: 0 },
    { id: 'sitegen', name: 'SiteGen', full: 'Site Generator', color: '#3b82f6', status: 'coming', link: SHOW_DRAFT_TOOLS ? '/sitegen' : null, angle: 90 },
    { id: 'occucalc', name: 'OccuCalc', full: 'Occupancy Calculator', color: '#8b5cf6', status: 'coming', link: SHOW_DRAFT_TOOLS ? '/occucalc' : null, angle: 180 },
    { id: 'parkcore', name: 'ParkCore', full: 'Parking Core Engine', color: '#f59e0b', status: 'coming', link: SHOW_DRAFT_TOOLS ? '/parkcore' : null, angle: 270 },
];

/* ── Orbital Ring Visualization ── */
function OrbitalRing() {
    const [rotation, setRotation] = useState(0);
    const [hovered, setHovered] = useState(null);
    const [paused, setPaused] = useState(false);

    useEffect(() => {
        if (paused) return;
        const raf = { id: 0 };
        let last = performance.now();
        function tick(now) {
            const dt = now - last;
            last = now;
            setRotation(r => (r + dt * 0.008) % 360);
            raf.id = requestAnimationFrame(tick);
        }
        raf.id = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(raf.id);
    }, [paused]);

    const radius = 42; // % of container

    return (
        <div
            className="relative w-full aspect-square max-w-md mx-auto"
            onMouseEnter={() => setPaused(true)}
            onMouseLeave={() => { setPaused(false); setHovered(null); }}
        >
            {/* Orbit track */}
            <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r={radius} fill="none" stroke="currentColor" className="text-white/[0.06]" strokeWidth="0.3" />
                {/* Inner decorative ring */}
                <circle cx="50" cy="50" r={radius * 0.55} fill="none" stroke="currentColor" className="text-white/[0.03]" strokeWidth="0.2" strokeDasharray="2 2" />
                {/* Outer decorative ring */}
                <circle cx="50" cy="50" r={radius * 1.15} fill="none" stroke="currentColor" className="text-white/[0.03]" strokeWidth="0.2" strokeDasharray="1 3" />
            </svg>

            {/* Center hub */}
            <div className="absolute inset-0 flex items-center justify-center z-10">
                <div className="relative">
                    <div className="absolute -inset-6 bg-gradient-to-br from-teal-500/10 via-blue-500/10 to-purple-500/10 rounded-full blur-2xl" />
                    <div className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-gradient-to-br from-slate-800 to-slate-900 border border-white/10 flex flex-col items-center justify-center shadow-2xl">
                        <img src="/genfabtools-logo.png" alt="GenFabTools" className="h-8 w-8 sm:h-10 sm:w-10 brightness-0 invert opacity-80" />
                        <span className="text-[10px] text-white/40 font-medium mt-1 tracking-wider">PLATFORM</span>
                    </div>
                </div>
            </div>

            {/* Orbiting tool nodes */}
            {TOOLS.map((tool) => {
                const angle = ((tool.angle + rotation) * Math.PI) / 180;
                const x = 50 + radius * Math.cos(angle);
                const y = 50 + radius * Math.sin(angle);
                const isHovered = hovered === tool.id;

                return (
                    <motion.div
                        key={tool.id}
                        className="absolute z-20"
                        style={{
                            left: `${x}%`,
                            top: `${y}%`,
                            transform: 'translate(-50%, -50%)',
                        }}
                        animate={{ scale: isHovered ? 1.25 : 1 }}
                        transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                    >
                        <div
                            className="cursor-pointer group"
                            onMouseEnter={() => setHovered(tool.id)}
                            onMouseLeave={() => setHovered(null)}
                        >
                            {/* Glow */}
                            <div
                                className="absolute -inset-3 rounded-full blur-lg transition-opacity duration-300"
                                style={{ backgroundColor: tool.color, opacity: isHovered ? 0.4 : 0 }}
                            />

                            {/* Node */}
                            <div
                                className="relative w-12 h-12 sm:w-14 sm:h-14 rounded-full border-2 flex items-center justify-center transition-all duration-300 shadow-lg"
                                style={{
                                    borderColor: tool.color,
                                    backgroundColor: isHovered ? tool.color : 'rgba(15,23,42,0.95)',
                                }}
                            >
                                <span className={`text-xs sm:text-sm font-bold transition-colors duration-200 ${isHovered ? 'text-white' : ''}`} style={{ color: isHovered ? 'white' : tool.color }}>
                                    {tool.name}
                                </span>
                            </div>

                            {/* Status dot */}
                            {tool.status === 'live' && (
                                <span className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-green-400 border-2 border-[#0a0a0f]" />
                            )}
                        </div>
                    </motion.div>
                );
            })}

            {/* Hover info tooltip */}
            <AnimatePresence>
                {hovered && (
                    <motion.div
                        className="absolute z-30 left-1/2 -translate-x-1/2"
                        style={{ bottom: '-12%' }}
                        initial={{ opacity: 0, y: -8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        transition={{ duration: 0.15 }}
                    >
                        {(() => {
                            const tool = TOOLS.find(t => t.id === hovered);
                            if (!tool) return null;
                            return (
                                <div className="bg-white/[0.08] backdrop-blur-md border border-white/10 rounded-xl px-5 py-3 text-center min-w-[200px]">
                                    <p className="text-sm font-semibold text-white">{tool.full}</p>
                                    <p className="text-xs mt-0.5" style={{ color: tool.color }}>
                                        {tool.status === 'live' ? '● Live' : '○ Coming soon'}
                                    </p>
                                </div>
                            );
                        })()}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

/* ── Animated counter ── */
function Counter({ end, suffix = '' }) {
    const ref = useRef(null);
    const inView = useInView(ref, { once: true });
    const [val, setVal] = useState(0);
    useEffect(() => {
        if (!inView) return;
        const num = parseInt(end, 10);
        if (isNaN(num)) return;
        let cur = 0;
        const step = Math.max(1, Math.ceil(num / 30));
        const id = setInterval(() => {
            cur += step;
            if (cur >= num) { setVal(num); clearInterval(id); }
            else setVal(cur);
        }, 35);
        return () => clearInterval(id);
    }, [inView, end]);
    return <span ref={ref}>{val}{suffix}</span>;
}

/* ── Brand manifesto words ── */
const MANIFESTO = [
    { word: 'Purpose-built', desc: 'Every tool does one thing brilliantly.' },
    { word: 'Inside your workflow', desc: 'No new apps to learn. We live in your tools.' },
    { word: 'Seconds, not hours', desc: 'Manual drudgery becomes instant insight.' },
    { word: 'Ecosystem-ready', desc: 'Each tool connects. Start with one, add more.' },
];

export default function HomeV6() {
    return (
        <div className="bg-[#0a0a0f] text-white selection:bg-teal-400/30 overflow-hidden">

            {/* ── Hero — Orbital + Tagline ── */}
            <section className="relative min-h-screen flex items-center">
                {/* Ambient gradients */}
                <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
                    <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-teal-500/[0.05] rounded-full blur-[120px]" />
                    <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-blue-500/[0.04] rounded-full blur-[100px]" />
                </div>

                <div className="relative max-w-7xl mx-auto px-6 sm:px-12 py-20 w-full">
                    <div className="grid lg:grid-cols-2 gap-12 items-center">
                        {/* Left — Brand message */}
                        <div>
                            <Fade>
                                <div className="flex items-center gap-3 mb-8">
                                    <div className="h-px flex-1 max-w-[40px] bg-gradient-to-r from-teal-500 to-transparent" />
                                    <span className="text-xs font-bold tracking-[0.2em] uppercase text-teal-400">GenFabTools</span>
                                </div>
                            </Fade>
                            <Fade delay={0.08}>
                                <h1 className="text-4xl sm:text-6xl lg:text-7xl font-extrabold leading-[1.05] tracking-tight">
                                    One platform.
                                    <br />
                                    <span className="bg-gradient-to-r from-teal-400 via-cyan-300 to-blue-400 bg-clip-text text-transparent">
                                        Every tool
                                    </span>
                                    <br />
                                    you need.
                                </h1>
                            </Fade>
                            <Fade delay={0.16}>
                                <p className="mt-8 text-lg text-slate-400 font-light leading-relaxed max-w-md">
                                    An expanding ecosystem of intelligent utilities for architects, engineers, and planners. Each tool eliminates a different bottleneck in your design pipeline.
                                </p>
                            </Fade>
                            <Fade delay={0.24}>
                                <div className="mt-10 flex flex-wrap gap-4">
                                    <Link
                                        to="/tools"
                                        className="group bg-white text-slate-900 px-7 py-3.5 rounded-full text-sm font-semibold hover:shadow-lg hover:shadow-white/10 transition-all"
                                    >
                                        Explore the ecosystem
                                        <span className="inline-block ml-2 group-hover:translate-x-1 transition-transform">→</span>
                                    </Link>
                                    <Link
                                        to="/rsi"
                                        className="bg-white/5 border border-white/10 text-slate-300 px-7 py-3.5 rounded-full text-sm font-semibold hover:bg-white/10 transition-colors"
                                    >
                                        Start with RSI
                                    </Link>
                                </div>
                            </Fade>
                        </div>

                        {/* Right — Orbital visualization */}
                        <Fade delay={0.1}>
                            <OrbitalRing />
                        </Fade>
                    </div>
                </div>
            </section>

            {/* ── Brand Manifesto ── */}
            <section className="border-y border-white/5">
                <div className="max-w-6xl mx-auto px-6 sm:px-12 py-24 lg:py-32">
                    <Fade>
                        <h2 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-center mb-20">
                            What makes GenFabTools{' '}
                            <span className="bg-gradient-to-r from-teal-400 to-blue-400 bg-clip-text text-transparent">different</span>
                        </h2>
                    </Fade>

                    <div className="grid sm:grid-cols-2 gap-x-12 gap-y-16">
                        {MANIFESTO.map((m, i) => (
                            <Fade key={i} delay={i * 0.08}>
                                <div className="flex gap-5">
                                    <div className="shrink-0 w-12 h-12 rounded-xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-center">
                                        <span className="text-xs font-extrabold text-teal-400">{String(i + 1).padStart(2, '0')}</span>
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-bold">{m.word}</h3>
                                        <p className="mt-1 text-sm text-slate-500 leading-relaxed">{m.desc}</p>
                                    </div>
                                </div>
                            </Fade>
                        ))}
                    </div>
                </div>
            </section>

            {/* ── Flagship — RSI Spotlight ── */}
            <section className="py-28 lg:py-36">
                <div className="max-w-6xl mx-auto px-6 sm:px-12">
                    <Fade>
                        <div className="flex items-center gap-3 mb-6">
                            <span className="w-2.5 h-2.5 rounded-full bg-teal-500" />
                            <span className="text-xs font-bold tracking-[0.15em] uppercase text-teal-400">Available Now</span>
                        </div>
                    </Fade>

                    <div className="grid lg:grid-cols-5 gap-8 items-start">
                        {/* Info — 2 cols */}
                        <div className="lg:col-span-2">
                            <Fade>
                                <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight">RSI</h2>
                                <p className="text-lg text-slate-400 font-light mt-1">Residential Scheme Intelligence</p>
                                <p className="mt-6 text-slate-500 leading-relaxed">
                                    The first tool in the GenFabTools ecosystem. Live efficiency scoring, financial feasibility, heatmap diagnostics, and scheme comparison — running inside Autodesk Revit.
                                </p>
                            </Fade>

                            <Fade delay={0.1}>
                                <div className="mt-8 space-y-4">
                                    {[
                                        { val: '10×', text: 'faster than manual spreadsheet analysis' },
                                        { val: '<10s', text: 'from click to full efficiency report' },
                                        { val: '$49/mo', text: 'less than 20 min of architect billable time' },
                                    ].map((s, i) => (
                                        <div key={i} className="flex items-baseline gap-3">
                                            <span className="text-xl font-extrabold text-teal-400 shrink-0 w-20">{s.val}</span>
                                            <span className="text-sm text-slate-500">{s.text}</span>
                                        </div>
                                    ))}
                                </div>
                            </Fade>

                            <Fade delay={0.15}>
                                <Link
                                    to="/rsi"
                                    className="inline-flex items-center gap-2 mt-8 bg-teal-600 text-white px-6 py-3 rounded-full text-sm font-semibold hover:bg-teal-700 transition-colors shadow-md shadow-teal-600/20"
                                >
                                    Explore RSI
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
                                </Link>
                            </Fade>
                        </div>

                        {/* Screenshot — 3 cols */}
                        <Fade delay={0.1} className="lg:col-span-3">
                            <div className="relative">
                                <div className="absolute -inset-4 bg-gradient-to-br from-teal-500/15 to-blue-500/10 rounded-3xl blur-2xl" />
                                <img
                                    src="/images/rsi/project00.png"
                                    alt="RSI running inside Revit"
                                    className="relative rounded-2xl border border-white/10 shadow-2xl w-full"
                                    loading="lazy"
                                />
                            </div>
                        </Fade>
                    </div>
                </div>
            </section>

            {/* ── Ecosystem meter ── */}
            <section className="py-20 border-y border-white/5">
                <div className="max-w-4xl mx-auto px-6 text-center">
                    <Fade>
                        <p className="text-xs font-bold tracking-[0.2em] uppercase text-slate-500 mb-6">Ecosystem Status</p>
                        <div className="flex items-center justify-center gap-1 mb-4">
                            {TOOLS.map((t) => (
                                <div
                                    key={t.id}
                                    className="h-3 flex-1 max-w-[120px] rounded-full transition-all"
                                    style={{
                                        backgroundColor: t.status === 'live' ? t.color : `${t.color}33`,
                                    }}
                                />
                            ))}
                            {/* Future slots */}
                            {[1, 2, 3].map(i => (
                                <div key={`future-${i}`} className="h-3 flex-1 max-w-[120px] rounded-full bg-white/[0.04]" />
                            ))}
                        </div>
                        <p className="text-sm text-slate-500">
                            <span className="text-white font-semibold">1</span> of <span className="text-white font-semibold">7+</span> tools live
                            <span className="text-slate-700 mx-2">·</span>
                            <span className="text-teal-400">3 in development</span>
                        </p>
                    </Fade>
                </div>
            </section>

            {/* ── Coming tools ── */}
            <section className="py-28 lg:py-36">
                <div className="max-w-6xl mx-auto px-6 sm:px-12">
                    <Fade>
                        <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">Coming next</h2>
                        <p className="text-slate-500 text-lg max-w-lg mb-14">
                            Each new tool plugs into the GenFabTools platform. Your account and workflow carry over.
                        </p>
                    </Fade>

                    <div className="grid sm:grid-cols-3 gap-4">
                        {TOOLS.filter(t => t.status === 'coming').map((t, i) => (
                            <Fade key={t.id} delay={i * 0.08}>
                                <div className="group bg-white/[0.02] border border-dashed border-white/[0.08] rounded-2xl p-7 hover:border-white/15 hover:bg-white/[0.04] transition-all duration-300">
                                    <div className="flex items-center justify-between mb-5">
                                        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${t.color}15` }}>
                                            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: t.color }} />
                                        </div>
                                        <span className="text-[10px] font-bold tracking-widest uppercase px-2.5 py-1 rounded-full" style={{ color: t.color, backgroundColor: `${t.color}15` }}>
                                            Soon
                                        </span>
                                    </div>
                                    <h3 className="text-lg font-bold text-white">{t.name}</h3>
                                    <p className="text-sm text-slate-400 mt-0.5">{t.full}</p>
                                </div>
                            </Fade>
                        ))}
                    </div>
                </div>
            </section>

            {/* ── Final CTA ── */}
            <section className="relative py-32 overflow-hidden">
                <div className="absolute inset-0">
                    <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-gradient-to-t from-teal-500/[0.06] to-transparent rounded-full blur-[80px]" />
                </div>
                <div className="relative max-w-3xl mx-auto px-6 text-center">
                    <Fade>
                        <h2 className="text-4xl sm:text-6xl font-extrabold tracking-tight leading-tight">
                            The future of AEC
                            <br />
                            tools starts here
                        </h2>
                        <p className="mt-6 text-slate-500 text-lg max-w-md mx-auto">
                            Join the architects and engineers who are automating the tedious and focusing on what matters — design.
                        </p>
                        <div className="mt-10 flex flex-wrap justify-center gap-4">
                            <Link
                                to="/register"
                                className="bg-white text-slate-900 px-10 py-4 rounded-full text-sm font-semibold hover:shadow-lg hover:shadow-white/10 transition-all"
                            >
                                Create free account
                            </Link>
                            <Link
                                to="/rsi"
                                className="bg-white/5 border border-white/10 text-slate-300 px-8 py-4 rounded-full text-sm font-semibold hover:bg-white/10 transition-colors"
                            >
                                Explore RSI
                            </Link>
                        </div>
                    </Fade>
                </div>
            </section>
        </div>
    );
}
