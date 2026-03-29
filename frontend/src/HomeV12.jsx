import React, { useRef, useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion, useScroll, useTransform, useInView } from 'framer-motion';
import { SHOW_DRAFT_TOOLS } from './config/featureFlags';

/* ───────────────────────────────────────────────────────────
   VERSION 12 — "The Architect's Worst Day"
   Storytelling-as-scroll. Narrates a painful workday
   hour-by-hour. Each pain point strikes through and
   rewrites itself with how GenFabTools solves it.
   ─────────────────────────────────────────────────────────── */

const HOURS = [
    {
        time: '8:30 AM',
        emoji: '☕',
        pain: 'Arrived at the office. Three residential scheme options need feasibility analysis by EOD. Client meeting at 5 PM.',
        fix: null,
        mood: 'neutral',
    },
    {
        time: '9:15 AM',
        emoji: '📊',
        pain: 'Opened Excel. Started manually measuring GIA, NIA, and wall ratios from Revit floor plans. Copy, paste, calculate, repeat.',
        fix: 'Opened RSI inside Revit. All area metrics calculated automatically in 8 seconds.',
        tool: 'RSI',
        toolColor: '#14b8a6',
        saved: '1.5 hours saved',
    },
    {
        time: '10:45 AM',
        emoji: '🧮',
        pain: 'Still in Excel. Now building a financial model — unit mix, revenue projection, construction cost estimate. Formula errors everywhere.',
        fix: 'RSI generated the full financial model from live Revit data. Revenue, cost, margin — all instant.',
        tool: 'RSI',
        toolColor: '#14b8a6',
        saved: '2 hours saved',
    },
    {
        time: '12:00 PM',
        emoji: '🍕',
        pain: 'Skipped lunch. Need to compare all three scheme options side by side. Made a PowerPoint with screenshots. Formatting hell.',
        fix: 'RSI\'s scheme comparison dashboard showed all three options with visual charts. Exported a PDF in one click.',
        tool: 'RSI',
        toolColor: '#14b8a6',
        saved: '1 hour saved',
    },
    {
        time: '1:30 PM',
        emoji: '📐',
        pain: 'Client wants parking layout options. Drew stalls manually in AutoCAD. Counted spots by hand. Checked ADA compliance with a ruler.',
        fix: 'ParkCore generated three optimized parking layouts from the site boundary. ADA-compliant. 47 stalls — 3 more than manual.',
        tool: 'ParkCore',
        toolColor: '#f59e0b',
        saved: '2 hours saved',
    },
    {
        time: '3:00 PM',
        emoji: '📖',
        pain: 'Building code review. Opened the IBC. Looked up occupancy tables. Cross-referenced with floor areas. Calculated by hand. Prayed it was right.',
        fix: 'OccuCalc calculated code-compliant occupant loads from the floor plans instantly. Zero table lookups.',
        tool: 'OccuCalc',
        toolColor: '#8b5cf6',
        saved: '45 min saved',
    },
    {
        time: '4:15 PM',
        emoji: '🏗️',
        pain: 'Tried to fit building massing to the site constraints. Sketched five options. None optimal. Running out of time.',
        fix: 'SiteGen produced optimized massing options from site constraints in seconds. Option 3 was better than anything sketched by hand.',
        tool: 'SiteGen',
        toolColor: '#3b82f6',
        saved: '1.5 hours saved',
    },
    {
        time: '4:55 PM',
        emoji: '😰',
        pain: 'Scrambling. Slides half done. Numbers don\'t add up. Formatting broken. Client walks in at 5:00.',
        fix: 'Lean back. Everything was done by noon. Spent the afternoon refining design quality instead of fighting spreadsheets.',
        mood: 'resolved',
    },
    {
        time: '5:00 PM',
        emoji: '🎤',
        pain: '"Uh, we\'re still working on the final numbers. Can we reschedule?"',
        fix: '"Here are three fully analyzed options with financials, parking, compliance, and massing. Which direction speaks to you?"',
        mood: 'win',
    },
];

/* ── Single Hour Block ── */
function HourBlock({ hour, index }) {
    const ref = useRef(null);
    const inView = useInView(ref, { once: true, margin: '-20% 0px -20% 0px' });
    const [showFix, setShowFix] = useState(false);

    useEffect(() => {
        if (inView && hour.fix) {
            const timer = setTimeout(() => setShowFix(true), 800);
            return () => clearTimeout(timer);
        }
    }, [inView, hour.fix]);

    const isEven = index % 2 === 0;

    return (
        <div ref={ref} className="relative">
            {/* Timeline connector */}
            <div className="absolute left-[39px] top-0 bottom-0 w-px bg-gradient-to-b from-slate-800 to-slate-800/50 hidden sm:block" />

            <motion.div
                className="flex gap-4 sm:gap-8 py-10 sm:py-16 px-4 sm:px-8"
                initial={{ opacity: 0, x: -20 }}
                animate={inView ? { opacity: 1, x: 0 } : {}}
                transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            >
                {/* Time column */}
                <div className="shrink-0 w-[60px] sm:w-[80px] text-right pt-1">
                    <span className="text-2xl block mb-1">{hour.emoji}</span>
                    <span className="font-mono text-xs text-white/40 font-bold tracking-wider">{hour.time}</span>
                    {/* Timeline dot */}
                    <div className="hidden sm:block absolute left-[36px] top-[52px] w-[7px] h-[7px] rounded-full border-2 border-slate-700 bg-slate-900"
                        style={hour.mood === 'win' ? { borderColor: '#14b8a6', backgroundColor: '#14b8a6' } : {}}
                    />
                </div>

                {/* Content column */}
                <div className="flex-1 max-w-2xl">
                    {/* Pain text */}
                    <motion.p
                        className={`text-base sm:text-lg leading-relaxed transition-all duration-700 ${showFix ? 'line-through opacity-25 text-red-400/70' : 'text-white/70'
                            }`}
                    >
                        {hour.pain}
                    </motion.p>

                    {/* Fix text (appears after delay) */}
                    {hour.fix && (
                        <motion.div
                            initial={{ opacity: 0, height: 0, y: 10 }}
                            animate={showFix ? { opacity: 1, height: 'auto', y: 0 } : {}}
                            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                            className="overflow-hidden"
                        >
                            <div className="mt-4 pl-4 border-l-2" style={{ borderColor: hour.toolColor || '#14b8a6' }}>
                                <p className="text-base sm:text-lg text-white/90 leading-relaxed font-medium">
                                    {hour.fix}
                                </p>
                                {hour.tool && (
                                    <div className="mt-3 flex items-center gap-3 flex-wrap">
                                        <span className="inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full"
                                            style={{ backgroundColor: `${hour.toolColor}15`, color: hour.toolColor }}
                                        >
                                            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: hour.toolColor }} />
                                            {hour.tool}
                                        </span>
                                        {hour.saved && (
                                            <span className="text-xs text-green-400/70 font-mono">⏱ {hour.saved}</span>
                                        )}
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    )}

                    {/* Win state */}
                    {hour.mood === 'win' && !hour.tool && (
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={showFix ? { opacity: 1, y: 0 } : {}}
                            transition={{ duration: 0.8, delay: 0.2 }}
                            className="overflow-hidden"
                        >
                            <div className="mt-4 pl-4 border-l-2 border-emerald-500">
                                <p className="text-base sm:text-lg text-emerald-400/90 leading-relaxed font-medium">
                                    {hour.fix}
                                </p>
                            </div>
                        </motion.div>
                    )}
                </div>
            </motion.div>
        </div>
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

export default function HomeV12() {
    // Total time saved counter
    const savedMinutes = 8 * 60 + 45; // 8 hours 45 min

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
                    <Link to="/register" className="bg-white/5 text-white/70 px-4 py-2 rounded-full hover:bg-white/10 transition-colors border border-white/[0.06]">
                        Get Started
                    </Link>
                </div>
            </motion.nav>

            {/* ── Hero ── */}
            <section className="relative pt-28 pb-16 sm:pt-36 sm:pb-24 px-6 sm:px-12 lg:px-20 text-center">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8, delay: 0.3 }}
                >
                    <div className="inline-flex items-center gap-2 bg-red-500/5 border border-red-500/10 rounded-full px-4 py-1.5 mb-8">
                        <span className="text-red-400 text-sm">😤</span>
                        <span className="text-[11px] font-semibold text-red-300/60 tracking-wide">BASED ON A TRUE STORY</span>
                    </div>

                    <h1 className="text-4xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight leading-[1.05] max-w-4xl mx-auto">
                        An architect's
                        <br />
                        <span className="text-red-400/80">worst</span> day
                        <br />
                        <span className="text-white/30 text-3xl sm:text-5xl lg:text-6xl">(and how it could have gone)</span>
                    </h1>

                    <p className="mt-6 text-slate-500 text-base sm:text-lg max-w-lg mx-auto leading-relaxed">
                        Scroll through a real workday. Watch the pain points rewrite themselves.
                    </p>

                    {/* Scroll indicator */}
                    <motion.div
                        className="mt-12"
                        animate={{ y: [0, 8, 0] }}
                        transition={{ repeat: Infinity, duration: 2, ease: 'easeInOut' }}
                    >
                        <svg className="w-6 h-6 mx-auto text-white/15" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                        </svg>
                    </motion.div>
                </motion.div>
            </section>

            {/* ── Timeline ── */}
            <section className="w-full max-w-4xl mx-auto relative">
                {HOURS.map((hour, i) => (
                    <HourBlock key={i} hour={hour} index={i} />
                ))}
            </section>

            {/* ── Time Saved Summary ── */}
            <section className="w-full py-24 lg:py-32 border-t border-white/5">
                <div className="px-6 sm:px-12 lg:px-20 max-w-4xl mx-auto text-center">
                    <Reveal>
                        <div className="inline-flex items-center gap-2 bg-emerald-500/5 border border-emerald-500/10 rounded-full px-4 py-1.5 mb-8">
                            <span className="text-emerald-400 text-sm">⏱</span>
                            <span className="text-[11px] font-semibold text-emerald-300/60 tracking-wide">TOTAL TIME SAVED</span>
                        </div>

                        <h2 className="text-6xl sm:text-8xl font-extrabold tracking-tight text-emerald-400">
                            8h 45m
                        </h2>
                        <p className="mt-4 text-xl text-white/50">
                            The same day. The same deliverables.
                            <br />
                            <span className="text-white/80 font-semibold">Done before lunch instead of after midnight.</span>
                        </p>
                    </Reveal>
                </div>
            </section>

            {/* ── Tool recap strip ── */}
            <section className="w-full border-y border-white/5 bg-black/30">
                <div className="grid sm:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-white/5 max-w-5xl mx-auto">
                    {[
                        { tool: 'RSI', color: '#14b8a6', saved: '4.5 hours', status: 'Live' },
                        { tool: 'ParkCore', color: '#f59e0b', saved: '2 hours', status: 'Coming' },
                        { tool: 'OccuCalc', color: '#8b5cf6', saved: '45 min', status: 'Coming' },
                        { tool: 'SiteGen', color: '#3b82f6', saved: '1.5 hours', status: 'Coming' },
                    ].map((t, i) => (
                        <Reveal key={i} delay={i * 0.05}>
                            <div className="px-6 py-8 text-center">
                                <div className="w-2.5 h-2.5 rounded-full mx-auto mb-3" style={{ backgroundColor: t.color }} />
                                <p className="font-bold text-white/80 text-sm">{t.tool}</p>
                                <p className="text-lg font-extrabold mt-1" style={{ color: t.color }}>{t.saved}</p>
                                <p className="text-[10px] text-slate-600 tracking-wider uppercase mt-1">{t.status}</p>
                            </div>
                        </Reveal>
                    ))}
                </div>
            </section>

            {/* ── The question ── */}
            <section className="w-full py-24 lg:py-32">
                <div className="px-6 sm:px-12 lg:px-20 max-w-3xl mx-auto text-center">
                    <Reveal>
                        <h2 className="text-3xl sm:text-5xl font-extrabold tracking-tight leading-tight">
                            What kind of day
                            <br />
                            do <span className="text-white/40">you</span> want to have?
                        </h2>
                        <div className="mt-12 flex flex-wrap justify-center gap-4">
                            <Link
                                to="/register"
                                className="bg-white text-slate-900 px-8 py-3.5 rounded-full text-sm font-bold hover:shadow-xl hover:shadow-white/10 transition-all hover:-translate-y-0.5"
                            >
                                Start with RSI — it's the first floor
                            </Link>
                            <Link
                                to="/rsi"
                                className="bg-white/5 border border-white/10 text-white/70 px-8 py-3.5 rounded-full text-sm font-semibold hover:bg-white/10 transition-all"
                            >
                                See what RSI does
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
