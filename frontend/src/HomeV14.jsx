import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { motion, useInView, useMotionValue, useTransform, useSpring } from 'framer-motion';
import { SHOW_DRAFT_TOOLS } from './config/featureFlags';

/* ───────────────────────────────────────────────────────────
   VERSION 14 — "The Before / After"
   Full-screen draggable split. Left = the old way (pain).
   Right = the GenFabTools way (clean). Drag the handle
   to reveal. Each scroll section is a different pain point.
   ─────────────────────────────────────────────────────────── */

/* ── Comparison data ── */
const COMPARISONS = [
    {
        title: 'Scheme Feasibility',
        tool: 'RSI',
        toolColor: '#14b8a6',
        before: {
            headline: 'The Old Way',
            time: '3-4 hours',
            steps: [
                'Measure GIA/NIA manually from floor plans',
                'Build Excel financial model from scratch',
                'Copy-paste unit counts, check formulas',
                'Create PowerPoint comparison slides',
                'Pray the numbers are right',
            ],
            mood: '😤',
            vibe: 'Spreadsheet chaos. Copy errors. Format hell.',
        },
        after: {
            headline: 'With RSI',
            time: '10 seconds',
            steps: [
                'Click "Analyze" in Revit',
                'Efficiency scores calculated live',
                'Financial model auto-generated',
                'Scheme comparison with one click',
                'Export a polished PDF',
            ],
            mood: '😎',
            vibe: 'Click a button. Get the answer. Move on.',
        },
    },
    {
        title: 'Parking Layout',
        tool: 'ParkCore',
        toolColor: '#f59e0b',
        before: {
            headline: 'The Old Way',
            time: '2-3 hours',
            steps: [
                'Draw stalls manually in CAD',
                'Count spots by hand',
                'Check ADA with a ruler',
                'Adjust turning radii manually',
                'Start over when the boundary changes',
            ],
            mood: '😩',
            vibe: 'Tedious. Error-prone. Nobody enjoys this.',
        },
        after: {
            headline: 'With ParkCore',
            time: 'Seconds',
            steps: [
                'Upload site boundary',
                'Engine optimizes stall placement',
                'ADA compliance automatic',
                'Turning radii calculated',
                'Change boundary → instant update',
            ],
            mood: '🚀',
            vibe: 'Optimized. Compliant. Instant.',
        },
    },
    {
        title: 'Occupancy Calculation',
        tool: 'OccuCalc',
        toolColor: '#8b5cf6',
        before: {
            headline: 'The Old Way',
            time: '30-45 minutes',
            steps: [
                'Open IBC code book to Table 1004',
                'Look up occupancy load factors',
                'Measure each room area',
                'Calculate by hand or in Excel',
                'Double-check everything twice',
            ],
            mood: '📖',
            vibe: 'Table lookups. Manual math. Boring.',
        },
        after: {
            headline: 'With OccuCalc',
            time: 'Instant',
            steps: [
                'Import floor plan',
                'Auto-detect room types',
                'IBC factors applied automatically',
                'Occupant loads calculated',
                'Export compliance report',
            ],
            mood: '✅',
            vibe: 'Code-compliant. Zero table lookups.',
        },
    },
    {
        title: 'Site Massing',
        tool: 'SiteGen',
        toolColor: '#3b82f6',
        before: {
            headline: 'The Old Way',
            time: '1-2 hours',
            steps: [
                'Sketch massing options by hand',
                'Guess at site utilization',
                'Try to fit parking underneath',
                'None of the options feel optimal',
                'Wish there was a better way',
            ],
            mood: '✏️',
            vibe: 'Guesswork. Suboptimal. Time-consuming.',
        },
        after: {
            headline: 'With SiteGen',
            time: 'Seconds',
            steps: [
                'Define site constraints',
                'Engine generates massing options',
                'Parking integrated automatically',
                'Optimal utilization guaranteed',
                'Try 10 options in the time of 1',
            ],
            mood: '🏗️',
            vibe: 'Automated. Optimal. Fast.',
        },
    },
];

/* ── Draggable Split Component ── */
function DraggableSplit({ comparison }) {
    const containerRef = useRef(null);
    const [splitPos, setSplitPos] = useState(50);
    const [dragging, setDragging] = useState(false);

    const onPointerDown = useCallback((e) => {
        e.preventDefault();
        setDragging(true);
    }, []);

    useEffect(() => {
        if (!dragging) return;

        function onPointerMove(e) {
            const container = containerRef.current;
            if (!container) return;
            const rect = container.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const pct = Math.max(10, Math.min(90, (x / rect.width) * 100));
            setSplitPos(pct);
        }
        function onPointerUp() {
            setDragging(false);
        }

        window.addEventListener('pointermove', onPointerMove);
        window.addEventListener('pointerup', onPointerUp);
        return () => {
            window.removeEventListener('pointermove', onPointerMove);
            window.removeEventListener('pointerup', onPointerUp);
        };
    }, [dragging]);

    const ref = useRef(null);
    const inView = useInView(ref, { once: true, margin: '-20%' });

    return (
        <motion.div
            ref={ref}
            initial={{ opacity: 0, y: 30 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        >
            <div
                ref={containerRef}
                className="relative w-full h-[480px] sm:h-[520px] rounded-2xl overflow-hidden border border-white/[0.06] select-none"
                style={{ cursor: dragging ? 'grabbing' : 'default' }}
            >
                {/* ── BEFORE (left side, red tint) ── */}
                <div
                    className="absolute inset-0 overflow-hidden"
                    style={{ clipPath: `inset(0 ${100 - splitPos}% 0 0)` }}
                >
                    <div className="w-full h-full bg-gradient-to-br from-red-950/40 via-[#0f0a0a] to-[#0a0a0f] p-6 sm:p-10">
                        <div className="flex items-center gap-2 mb-1">
                            <span className="text-2xl">{comparison.before.mood}</span>
                            <span className="text-xs font-bold text-red-400/60 tracking-widest uppercase">Before</span>
                        </div>
                        <h3 className="text-lg sm:text-xl font-bold text-red-300/80 mb-1">{comparison.before.headline}</h3>
                        <div className="inline-flex items-center gap-1.5 bg-red-500/10 border border-red-500/15 rounded-full px-3 py-1 mb-5">
                            <span className="text-[11px] font-mono text-red-400/70">⏱ {comparison.before.time}</span>
                        </div>

                        <ul className="space-y-3">
                            {comparison.before.steps.map((step, i) => (
                                <li key={i} className="flex items-start gap-2.5 text-sm text-red-200/40">
                                    <span className="shrink-0 w-5 h-5 rounded border border-red-500/15 flex items-center justify-center text-[10px] text-red-400/40 mt-0.5">{i + 1}</span>
                                    <span className="leading-relaxed">{step}</span>
                                </li>
                            ))}
                        </ul>

                        <p className="mt-6 text-xs text-red-300/25 italic">{comparison.before.vibe}</p>
                    </div>
                </div>

                {/* ── AFTER (right side, green/teal tint) ── */}
                <div
                    className="absolute inset-0 overflow-hidden"
                    style={{ clipPath: `inset(0 0 0 ${splitPos}%)` }}
                >
                    <div className="w-full h-full bg-gradient-to-bl from-emerald-950/30 via-[#060f0a] to-[#0a0a0f] p-6 sm:p-10">
                        <div className="flex items-center gap-2 mb-1">
                            <span className="text-2xl">{comparison.after.mood}</span>
                            <span className="text-xs font-bold tracking-widest uppercase" style={{ color: `${comparison.toolColor}90` }}>After</span>
                        </div>
                        <h3 className="text-lg sm:text-xl font-bold mb-1" style={{ color: `${comparison.toolColor}cc` }}>{comparison.after.headline}</h3>
                        <div className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 mb-5"
                            style={{ backgroundColor: `${comparison.toolColor}10`, border: `1px solid ${comparison.toolColor}20` }}
                        >
                            <span className="text-[11px] font-mono" style={{ color: `${comparison.toolColor}bb` }}>⚡ {comparison.after.time}</span>
                        </div>

                        <ul className="space-y-3">
                            {comparison.after.steps.map((step, i) => (
                                <li key={i} className="flex items-start gap-2.5 text-sm" style={{ color: `${comparison.toolColor}70` }}>
                                    <span className="shrink-0 w-5 h-5 rounded flex items-center justify-center text-[10px] mt-0.5"
                                        style={{ border: `1px solid ${comparison.toolColor}25`, color: `${comparison.toolColor}60` }}
                                    >✓</span>
                                    <span className="leading-relaxed text-white/60">{step}</span>
                                </li>
                            ))}
                        </ul>

                        <p className="mt-6 text-xs italic" style={{ color: `${comparison.toolColor}35` }}>{comparison.after.vibe}</p>
                    </div>
                </div>

                {/* ── Drag handle ── */}
                <div
                    className="absolute top-0 bottom-0 z-20 flex flex-col items-center justify-center"
                    style={{ left: `${splitPos}%`, transform: 'translateX(-50%)' }}
                >
                    {/* Line */}
                    <div className="w-px h-full bg-white/20" />

                    {/* Handle button */}
                    <div
                        className="absolute top-1/2 -translate-y-1/2 w-10 h-16 rounded-full bg-white/10 border border-white/20 backdrop-blur-sm flex flex-col items-center justify-center gap-0.5 cursor-grab active:cursor-grabbing hover:bg-white/15 transition-colors"
                        onPointerDown={onPointerDown}
                    >
                        <span className="text-white/40 text-xs">◀</span>
                        <div className="w-4 h-px bg-white/20" />
                        <span className="text-white/40 text-xs">▶</span>
                    </div>
                </div>

                {/* Labels */}
                <div className="absolute top-3 left-3 text-[10px] font-mono text-red-400/40 tracking-wider z-10">BEFORE</div>
                <div className="absolute top-3 right-3 text-[10px] font-mono tracking-wider z-10" style={{ color: `${comparison.toolColor}50` }}>AFTER</div>
            </div>
        </motion.div>
    );
}

/* ── Reveal ── */
function Reveal({ children, className = '', delay = 0 }) {
    const ref = useRef(null);
    const inView = useInView(ref, { once: true, margin: '-60px' });
    return (
        <motion.div ref={ref} className={className}
            initial={{ opacity: 0, y: 24 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.7, delay, ease: [0.22, 1, 0.36, 1] }}
        >{children}</motion.div>
    );
}

export default function HomeV14() {
    return (
        <div className="bg-[#0a0a0f] text-white selection:bg-teal-400/30 overflow-x-hidden">

            {/* ── Nav ── */}
            <motion.nav
                className="fixed top-0 left-0 right-0 z-50 px-6 py-3 flex items-center justify-between border-b border-white/[0.04]"
                style={{ backgroundColor: 'rgba(10,10,15,0.92)', backdropFilter: 'blur(12px)' }}
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.3 }}
            >
                <Link to="/" className="flex items-center gap-2.5">
                    <img src="/genfabtools-logo.png" alt="" className="h-7 w-7 brightness-0 invert opacity-80" />
                    <span className="text-sm font-bold text-white/80 tracking-wide">GenFabTools</span>
                </Link>
                <div className="hidden sm:flex items-center gap-6 text-sm">
                    <Link to="/tools" className="text-white/40 hover:text-white/80 transition-colors">Tools</Link>
                    <Link to="/rsi" className="text-white/40 hover:text-white/80 transition-colors">RSI</Link>
                    <Link to="/register" className="bg-white/5 text-white/70 px-4 py-2 rounded-full border border-white/[0.06] hover:bg-white/10 transition-all">
                        Get Started
                    </Link>
                </div>
            </motion.nav>

            {/* ── Hero ── */}
            <section className="pt-28 pb-16 sm:pt-36 sm:pb-24 px-6 sm:px-12 lg:px-20 text-center">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8, delay: 0.3 }}
                >
                    <h1 className="text-4xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight leading-[1.05] max-w-4xl mx-auto">
                        <span className="text-red-400/70">Before</span>
                        {' '}vs{' '}
                        <span className="bg-gradient-to-r from-teal-400 to-cyan-400 bg-clip-text text-transparent">After</span>
                    </h1>
                    <p className="mt-4 text-slate-500 text-base sm:text-lg max-w-xl mx-auto leading-relaxed">
                        Drag the handle to see the difference. Every comparison is a real workflow.
                    </p>
                    <p className="mt-2 text-xs text-white/20 tracking-wider uppercase font-mono">◀ Drag handles to compare ▶</p>
                </motion.div>
            </section>

            {/* ── Comparisons ── */}
            <section className="w-full px-4 sm:px-8 lg:px-16 pb-20 space-y-20">
                {COMPARISONS.map((comp, i) => (
                    <div key={comp.tool}>
                        {/* Section header */}
                        <Reveal>
                            <div className="flex items-center gap-3 mb-6 max-w-5xl mx-auto">
                                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: comp.toolColor }} />
                                <span className="text-sm font-bold tracking-wider" style={{ color: comp.toolColor }}>{comp.tool}</span>
                                <h2 className="text-xl sm:text-2xl font-bold text-white/80">{comp.title}</h2>
                            </div>
                        </Reveal>
                        <div className="max-w-5xl mx-auto">
                            <DraggableSplit comparison={comp} />
                        </div>
                    </div>
                ))}
            </section>

            {/* ── Summary stats ── */}
            <section className="w-full border-y border-white/5 bg-black/20">
                <div className="grid grid-cols-2 lg:grid-cols-4 divide-x divide-white/5 max-w-5xl mx-auto">
                    {[
                        { before: '8+ hours', after: '< 15 min', label: 'Total workflow' },
                        { before: '4 tools', after: '1 platform', label: 'Software needed' },
                        { before: 'Errors likely', after: '100% accurate', label: 'Calculation quality' },
                        { before: 'Zero', after: '10×', label: 'Speed improvement' },
                    ].map((s, i) => (
                        <Reveal key={i} delay={i * 0.05}>
                            <div className="px-4 sm:px-6 py-10 text-center">
                                <p className="text-xs text-red-400/40 line-through font-mono mb-1">{s.before}</p>
                                <p className="text-2xl sm:text-3xl font-extrabold bg-gradient-to-r from-teal-400 to-cyan-400 bg-clip-text text-transparent">
                                    {s.after}
                                </p>
                                <p className="mt-1 text-[10px] text-slate-600 tracking-wider uppercase">{s.label}</p>
                            </div>
                        </Reveal>
                    ))}
                </div>
            </section>

            {/* ── CTA ── */}
            <section className="w-full py-24 lg:py-32">
                <div className="px-6 sm:px-12 lg:px-20 text-center max-w-3xl mx-auto">
                    <Reveal>
                        <h2 className="text-3xl sm:text-5xl font-extrabold tracking-tight leading-tight">
                            Stop living on the
                            <span className="text-red-400/60"> left side</span>
                        </h2>
                        <p className="mt-4 text-slate-500 text-lg">
                            Start with RSI. The right side is waiting.
                        </p>
                        <div className="mt-10 flex flex-wrap justify-center gap-4">
                            <Link to="/register" className="bg-white text-slate-900 px-8 py-3.5 rounded-full text-sm font-bold hover:shadow-xl hover:shadow-white/10 transition-all hover:-translate-y-0.5">
                                Create free account
                            </Link>
                            <Link to="/rsi" className="bg-white/5 border border-white/10 text-white/70 px-8 py-3.5 rounded-full text-sm font-semibold hover:bg-white/10 transition-all">
                                See RSI in action
                            </Link>
                        </div>
                    </Reveal>
                </div>
            </section>

            {/* ── Footer ── */}
            <footer className="w-full border-t border-white/5 py-8 px-6 sm:px-12 lg:px-20">
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-600 max-w-5xl mx-auto">
                    <span>© {new Date().getFullYear()} GenFabTools</span>
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
