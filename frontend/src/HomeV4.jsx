import React, { useRef, useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion, useInView, AnimatePresence } from 'framer-motion';
import { SHOW_DRAFT_TOOLS } from './config/featureFlags';

/* ───────────────────────────────────────────────────────────
   VERSION 4 — "The Constellation"
   GenFabTools as a connected ecosystem. Tools are nodes in
   an interactive network drawn with SVG lines. Hovering a
   node highlights its connections and shows a preview.
   Brand-first, platform-forward, scales to 20+ tools.
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

/* ── Tool ecosystem data — add new tools here as they ship ── */
const ECOSYSTEM = [
    {
        id: 'rsi',
        name: 'RSI',
        full: 'Residential Scheme Intelligence',
        desc: 'Live efficiency scoring, financial feasibility, and scheme comparison inside Revit.',
        color: '#14b8a6',
        status: 'live',
        link: '/rsi',
        category: 'Analysis',
    },
    {
        id: 'sitegen',
        name: 'SiteGen',
        full: 'Site Generator',
        desc: 'Automated site planning with optimized building massing and parking layouts.',
        color: '#3b82f6',
        status: 'coming',
        link: SHOW_DRAFT_TOOLS ? '/sitegen' : null,
        category: 'Generative',
    },
    {
        id: 'occucalc',
        name: 'OccuCalc',
        full: 'Occupancy Calculator',
        desc: 'Code-compliant occupant load calculations for architects and engineers.',
        color: '#8b5cf6',
        status: 'coming',
        link: SHOW_DRAFT_TOOLS ? '/occucalc' : null,
        category: 'Compliance',
    },
    {
        id: 'parkcore',
        name: 'ParkCore',
        full: 'Parking Core Engine',
        desc: 'Generate optimized parking layouts from site boundaries with smart circulation.',
        color: '#f59e0b',
        status: 'coming',
        link: SHOW_DRAFT_TOOLS ? '/parkcore' : null,
        category: 'Generative',
    },
];

/* ── Interactive Constellation ── */
function Constellation() {
    const [active, setActive] = useState(null);
    const containerRef = useRef(null);

    /* Node positions — center is GenFabTools hub, tools orbit around it */
    const positions = [
        { x: 50, y: 50 },  // center hub
        { x: 22, y: 28 },  // RSI — top-left
        { x: 78, y: 25 },  // SiteGen — top-right
        { x: 20, y: 75 },  // OccuCalc — bottom-left
        { x: 80, y: 72 },  // ParkCore — bottom-right
    ];

    return (
        <div ref={containerRef} className="relative w-full aspect-square max-w-lg mx-auto">
            {/* SVG connection lines */}
            <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" fill="none">
                {/* Ambient grid dots */}
                {Array.from({ length: 8 }).map((_, i) =>
                    Array.from({ length: 8 }).map((_, j) => (
                        <circle key={`${i}-${j}`} cx={10 + i * 11.5} cy={10 + j * 11.5} r="0.3" fill="currentColor" className="text-slate-300 dark:text-slate-700" />
                    ))
                )}
                {/* Lines from hub to each tool */}
                {ECOSYSTEM.map((tool, i) => (
                    <motion.line
                        key={tool.id}
                        x1={positions[0].x} y1={positions[0].y}
                        x2={positions[i + 1].x} y2={positions[i + 1].y}
                        stroke={active === tool.id || active === null ? tool.color : '#e2e8f0'}
                        strokeWidth={active === tool.id ? 0.6 : 0.3}
                        strokeDasharray={tool.status === 'coming' ? '1.5 1' : 'none'}
                        initial={{ pathLength: 0 }}
                        animate={{ pathLength: 1 }}
                        transition={{ duration: 1.2, delay: 0.3 + i * 0.15, ease: 'easeOut' }}
                    />
                ))}
            </svg>

            {/* Center Hub — GenFabTools */}
            <motion.div
                className="absolute z-10 flex items-center justify-center"
                style={{ left: `${positions[0].x}%`, top: `${positions[0].y}%`, transform: 'translate(-50%, -50%)' }}
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 200, damping: 20, delay: 0.2 }}
            >
                <div className="relative">
                    <div className="absolute -inset-3 bg-gradient-to-br from-teal-400/20 via-blue-400/20 to-purple-400/20 rounded-full blur-lg animate-pulse" />
                    <div
                        className="relative w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-slate-900 flex items-center justify-center shadow-xl cursor-default"
                        onMouseEnter={() => setActive(null)}
                    >
                        <span className="text-white text-lg sm:text-xl font-extrabold tracking-tight">GF</span>
                    </div>
                </div>
            </motion.div>

            {/* Tool Nodes */}
            {ECOSYSTEM.map((tool, i) => (
                <motion.div
                    key={tool.id}
                    className="absolute z-10"
                    style={{ left: `${positions[i + 1].x}%`, top: `${positions[i + 1].y}%`, transform: 'translate(-50%, -50%)' }}
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: 'spring', stiffness: 200, damping: 20, delay: 0.5 + i * 0.12 }}
                >
                    <div
                        className="group cursor-pointer"
                        onMouseEnter={() => setActive(tool.id)}
                        onMouseLeave={() => setActive(null)}
                    >
                        {/* Glow ring */}
                        <div
                            className="absolute -inset-2 rounded-full blur-md opacity-0 group-hover:opacity-40 transition-opacity duration-300"
                            style={{ backgroundColor: tool.color }}
                        />

                        {/* Node circle */}
                        <div
                            className="relative w-12 h-12 sm:w-14 sm:h-14 rounded-full border-2 flex items-center justify-center transition-all duration-300 group-hover:scale-110"
                            style={{
                                borderColor: tool.color,
                                backgroundColor: active === tool.id ? tool.color : 'white',
                            }}
                        >
                            <span
                                className="text-xs sm:text-sm font-bold transition-colors duration-300"
                                style={{ color: active === tool.id ? 'white' : tool.color }}
                            >
                                {tool.name}
                            </span>
                        </div>

                        {/* Status badge */}
                        {tool.status === 'coming' && (
                            <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 text-[8px] font-bold tracking-wider uppercase bg-slate-100 text-slate-400 px-1.5 py-0.5 rounded-full whitespace-nowrap">
                                Soon
                            </span>
                        )}
                    </div>
                </motion.div>
            ))}

            {/* Hover info panel */}
            <AnimatePresence>
                {active && (
                    <motion.div
                        className="absolute bottom-0 left-1/2 -translate-x-1/2 w-72 bg-white rounded-xl shadow-xl border border-slate-200 p-5 z-20"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 10 }}
                        transition={{ duration: 0.2 }}
                    >
                        {(() => {
                            const tool = ECOSYSTEM.find(t => t.id === active);
                            if (!tool) return null;
                            return (
                                <>
                                    <div className="flex items-center gap-2 mb-2">
                                        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: tool.color }} />
                                        <span className="text-xs font-semibold tracking-wider uppercase text-slate-400">{tool.category}</span>
                                    </div>
                                    <h3 className="text-base font-bold text-slate-900">{tool.full}</h3>
                                    <p className="mt-1 text-sm text-slate-500 leading-relaxed">{tool.desc}</p>
                                    {tool.link ? (
                                        <Link to={tool.link} className="mt-3 inline-flex items-center gap-1 text-sm font-semibold transition-colors" style={{ color: tool.color }}>
                                            Explore {tool.name} <span>→</span>
                                        </Link>
                                    ) : (
                                        <p className="mt-3 text-xs text-slate-400 font-medium">Coming soon</p>
                                    )}
                                </>
                            );
                        })()}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

/* ── Typing animation for taglines ── */
function RotatingText() {
    const phrases = [
        'for architects',
        'for engineers',
        'for planners',
        'for the built world',
    ];
    const [index, setIndex] = useState(0);

    useEffect(() => {
        const interval = setInterval(() => setIndex(i => (i + 1) % phrases.length), 2800);
        return () => clearInterval(interval);
    }, []);

    return (
        <span className="relative inline-block h-[1.2em] overflow-hidden align-bottom min-w-[200px]">
            <AnimatePresence mode="wait">
                <motion.span
                    key={index}
                    className="absolute left-0 bg-gradient-to-r from-teal-500 via-blue-500 to-purple-500 bg-clip-text text-transparent"
                    initial={{ y: 40, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: -40, opacity: 0 }}
                    transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                >
                    {phrases[index]}
                </motion.span>
            </AnimatePresence>
        </span>
    );
}

/* ── Principles / Brand Values ── */
const PRINCIPLES = [
    { num: '01', title: 'Purpose-built', desc: "Every tool solves one problem exceptionally well. No bloat, no feature creep." },
    { num: '02', title: 'Inside your tools', desc: "We meet you where you work — Revit, AutoCAD, your browser. No new software to learn." },
    { num: '03', title: 'Seconds, not hours', desc: "Manual processes that take hours become instant. Your time is for design, not data entry." },
    { num: '04', title: 'Grows with you', desc: "Start with one tool. As your needs expand, the GenFabTools ecosystem is ready." },
];

export default function HomeV4() {
    return (
        <div className="bg-white text-slate-900 selection:bg-teal-200 overflow-hidden">

            {/* ── Hero ── */}
            <section className="relative min-h-screen flex items-center">
                {/* Subtle radial gradient */}
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(20,184,166,0.08),transparent)]" />

                <div className="relative max-w-7xl mx-auto px-6 sm:px-12 py-28 w-full">
                    <div className="grid lg:grid-cols-2 gap-16 items-center">
                        {/* Left — Messaging */}
                        <div>
                            <Fade>
                                <div className="flex items-center gap-3 mb-8">
                                    <img src="/genfabtools-logo.png" alt="GenFabTools" className="h-8 w-8" />
                                    <span className="text-sm font-bold tracking-[0.12em] uppercase text-slate-400">GenFabTools</span>
                                </div>
                            </Fade>
                            <Fade delay={0.1}>
                                <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold leading-[1.1] tracking-tight">
                                    Intelligent tools
                                    <br />
                                    <RotatingText />
                                </h1>
                            </Fade>
                            <Fade delay={0.2}>
                                <p className="mt-8 text-lg text-slate-500 leading-relaxed max-w-md">
                                    GenFabTools is a growing platform of specialized utilities that automate tedious workflows across architecture, engineering, and site planning.
                                </p>
                            </Fade>
                            <Fade delay={0.3}>
                                <div className="mt-10 flex flex-wrap gap-4">
                                    <Link
                                        to="/tools"
                                        className="bg-slate-900 text-white px-7 py-3.5 rounded-full text-sm font-semibold hover:bg-slate-800 transition-all shadow-lg shadow-slate-900/15"
                                    >
                                        Explore the ecosystem
                                    </Link>
                                    <Link
                                        to="/about"
                                        className="text-slate-500 hover:text-slate-900 px-4 py-3.5 text-sm font-semibold transition-colors"
                                    >
                                        Our philosophy →
                                    </Link>
                                </div>
                            </Fade>
                        </div>

                        {/* Right — Interactive constellation */}
                        <Fade delay={0.15}>
                            <Constellation />
                        </Fade>
                    </div>
                </div>
            </section>

            {/* ── Brand Principles ── */}
            <section className="bg-slate-950 text-white">
                <div className="max-w-7xl mx-auto px-6 sm:px-12 py-28 lg:py-36">
                    <Fade>
                        <p className="text-xs font-bold tracking-[0.2em] uppercase text-teal-400 mb-4">Our approach</p>
                        <h2 className="text-3xl sm:text-5xl font-bold tracking-tight max-w-xl">
                            Not another software suite
                        </h2>
                        <p className="mt-4 text-slate-400 text-lg max-w-xl">
                            Each GenFabTools utility is laser-focused on a single bottleneck in your workflow. Small, powerful, interoperable.
                        </p>
                    </Fade>

                    <div className="mt-16 grid sm:grid-cols-2 lg:grid-cols-4 gap-px bg-white/[0.06] rounded-2xl overflow-hidden">
                        {PRINCIPLES.map((p, i) => (
                            <Fade key={i} delay={i * 0.08}>
                                <div className="bg-slate-950 p-8 h-full hover:bg-white/[0.03] transition-colors">
                                    <span className="text-xs font-bold text-teal-400/60">{p.num}</span>
                                    <h3 className="mt-3 text-lg font-semibold">{p.title}</h3>
                                    <p className="mt-2 text-sm text-slate-500 leading-relaxed">{p.desc}</p>
                                </div>
                            </Fade>
                        ))}
                    </div>
                </div>
            </section>

            {/* ── Tool Spotlight — RSI (current flagship) ── */}
            <section className="max-w-7xl mx-auto px-6 sm:px-12 py-28 lg:py-36">
                <div className="grid lg:grid-cols-2 gap-16 items-center">
                    <Fade>
                        <div className="relative">
                            <div className="absolute -inset-6 bg-gradient-to-br from-teal-100/50 to-blue-100/30 rounded-3xl blur-2xl" />
                            <img
                                src="/images/rsi/project00.png"
                                alt="RSI efficiency analysis inside Revit"
                                className="relative rounded-2xl shadow-2xl border border-slate-200/60 w-full"
                                loading="lazy"
                            />
                        </div>
                    </Fade>
                    <div>
                        <Fade>
                            <div className="inline-flex items-center gap-2 mb-6">
                                <div className="w-2.5 h-2.5 rounded-full bg-teal-500" />
                                <span className="text-xs font-bold tracking-[0.15em] uppercase text-slate-400">Now Available</span>
                            </div>
                            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">
                                RSI — Residential Scheme Intelligence
                            </h2>
                            <p className="mt-4 text-slate-500 text-lg leading-relaxed">
                                The first tool in the GenFabTools ecosystem. Analyze residential scheme efficiency, run financial feasibility, and compare design alternatives — all inside Revit.
                            </p>
                        </Fade>
                        <Fade delay={0.1}>
                            <div className="mt-8 grid grid-cols-3 gap-4">
                                {[
                                    { val: '10×', label: 'Faster' },
                                    { val: '<10s', label: 'Per analysis' },
                                    { val: '$49', label: '/month' },
                                ].map((s, i) => (
                                    <div key={i} className="bg-slate-50 rounded-xl p-4 text-center">
                                        <p className="text-2xl font-extrabold tracking-tight text-slate-900">{s.val}</p>
                                        <p className="text-xs text-slate-400 mt-1">{s.label}</p>
                                    </div>
                                ))}
                            </div>
                            <Link
                                to="/rsi"
                                className="inline-flex items-center gap-2 mt-8 bg-teal-600 text-white px-6 py-3 rounded-full text-sm font-semibold hover:bg-teal-700 transition-colors shadow-md shadow-teal-600/20"
                            >
                                Learn more about RSI
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
                            </Link>
                        </Fade>
                    </div>
                </div>
            </section>

            {/* ── Ecosystem Roadmap ── */}
            <section className="bg-slate-50">
                <div className="max-w-5xl mx-auto px-6 sm:px-12 py-28 lg:py-36">
                    <Fade>
                        <div className="text-center mb-16">
                            <p className="text-xs font-bold tracking-[0.2em] uppercase text-slate-400 mb-3">Roadmap</p>
                            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">The ecosystem is growing</h2>
                            <p className="mt-3 text-slate-500 text-lg max-w-lg mx-auto">
                                Every new tool integrates into the GenFabTools platform. One account, one workflow.
                            </p>
                        </div>
                    </Fade>

                    {/* Timeline */}
                    <div className="relative">
                        {/* Vertical line */}
                        <div className="absolute left-6 sm:left-1/2 top-0 bottom-0 w-px bg-slate-200 -translate-x-1/2" />

                        {ECOSYSTEM.map((tool, i) => (
                            <Fade key={tool.id} delay={i * 0.1}>
                                <div className={`relative flex items-start gap-8 mb-12 ${i % 2 === 0 ? 'sm:flex-row' : 'sm:flex-row-reverse'}`}>
                                    {/* Dot on timeline */}
                                    <div className="absolute left-6 sm:left-1/2 -translate-x-1/2 w-4 h-4 rounded-full border-4 border-white z-10" style={{ backgroundColor: tool.color }} />

                                    {/* Content card */}
                                    <div className={`ml-14 sm:ml-0 sm:w-[calc(50%-2rem)] ${i % 2 === 0 ? 'sm:pr-8 sm:text-right' : 'sm:pl-8'}`}>
                                        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm hover:shadow-md transition-shadow">
                                            <div className={`flex items-center gap-2 mb-2 ${i % 2 === 0 ? 'sm:justify-end' : ''}`}>
                                                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: tool.color }} />
                                                <span className="text-xs font-bold tracking-wider uppercase" style={{ color: tool.color }}>
                                                    {tool.status === 'live' ? 'Live Now' : 'In Development'}
                                                </span>
                                            </div>
                                            <h3 className="text-lg font-bold">{tool.full}</h3>
                                            <p className="mt-1 text-sm text-slate-500">{tool.desc}</p>
                                            {tool.link && (
                                                <Link to={tool.link} className="mt-3 inline-flex items-center gap-1 text-sm font-semibold" style={{ color: tool.color }}>
                                                    Explore →
                                                </Link>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </Fade>
                        ))}

                        {/* Future placeholder */}
                        <Fade delay={0.5}>
                            <div className="relative flex items-start gap-8 sm:flex-row">
                                <div className="absolute left-6 sm:left-1/2 -translate-x-1/2 w-4 h-4 rounded-full border-4 border-white bg-slate-300 z-10" />
                                <div className="ml-14 sm:ml-0 sm:w-[calc(50%-2rem)] sm:pr-8 sm:text-right">
                                    <p className="text-sm text-slate-400 font-medium italic">More tools on the way...</p>
                                </div>
                            </div>
                        </Fade>
                    </div>
                </div>
            </section>

            {/* ── CTA ── */}
            <section className="relative overflow-hidden">
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_40%_at_50%_100%,rgba(20,184,166,0.06),transparent)]" />
                <div className="relative max-w-3xl mx-auto px-6 py-32 text-center">
                    <Fade>
                        <h2 className="text-4xl sm:text-5xl font-extrabold tracking-tight">
                            One platform.
                            <br />
                            Every tool you need.
                        </h2>
                        <p className="mt-6 text-slate-500 text-lg max-w-md mx-auto">
                            Start with RSI today. As the GenFabTools ecosystem grows, your workflow only gets smarter.
                        </p>
                        <div className="mt-10 flex flex-wrap justify-center gap-4">
                            <Link to="/rsi" className="bg-slate-900 text-white px-8 py-4 rounded-full text-sm font-semibold hover:bg-slate-800 transition-all shadow-lg shadow-slate-900/15">
                                Get started with RSI
                            </Link>
                            <Link to="/contact" className="text-slate-500 hover:text-slate-900 px-6 py-4 text-sm font-semibold transition-colors">
                                Contact us →
                            </Link>
                        </div>
                    </Fade>
                </div>
            </section>
        </div>
    );
}
