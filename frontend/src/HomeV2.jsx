import React, { useRef, useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion, useInView, useScroll, useTransform } from 'framer-motion';
import { SHOW_DRAFT_TOOLS } from './config/featureFlags';

/* ───────────────────────────────────────────────────────────
   VERSION 2 — "The Statement"
   Dark, cinematic, premium. Inspired by Linear, Vercel,
   and Stripe. Gradient glows, glass-morphism cards,
   bold numbers, product-forward.
   ─────────────────────────────────────────────────────────── */

function Reveal({ children, className = '', delay = 0 }) {
    const ref = useRef(null);
    const inView = useInView(ref, { once: true, margin: '-80px' });
    return (
        <motion.div
            ref={ref}
            className={className}
            initial={{ opacity: 0, y: 40 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.8, delay, ease: [0.25, 1, 0.5, 1] }}
        >
            {children}
        </motion.div>
    );
}

function AnimatedNumber({ target, suffix = '' }) {
    const ref = useRef(null);
    const inView = useInView(ref, { once: true });
    const [val, setVal] = useState(0);
    useEffect(() => {
        if (!inView) return;
        const num = parseInt(target, 10);
        if (isNaN(num)) { setVal(target); return; }
        let start = 0;
        const step = Math.max(1, Math.ceil(num / 40));
        const interval = setInterval(() => {
            start += step;
            if (start >= num) { setVal(num); clearInterval(interval); }
            else setVal(start);
        }, 30);
        return () => clearInterval(interval);
    }, [inView, target]);
    return <span ref={ref}>{typeof val === 'number' ? val : target}{suffix}</span>;
}

const FEATURES = [
    { icon: '⚡', title: 'Instant Analysis', desc: 'Click once — full efficiency report in under 10 seconds, live inside Revit.' },
    { icon: '🗺️', title: 'Heatmap Overlays', desc: 'Color-coded diagnostics rendered directly on your floor plans.' },
    { icon: '📊', title: 'Scheme Comparison', desc: 'Run multiple options, compare side-by-side with revenue deltas.' },
    { icon: '💰', title: 'Financial Insight', desc: 'Revenue potential, pricing scenarios, and feasibility — instantly.' },
    { icon: '📄', title: 'Export Anything', desc: 'Excel worksheets, PDF reports, or CSV — ready for stakeholders.' },
    { icon: '🔒', title: 'Fully Offline', desc: 'Runs locally inside Revit. No cloud. No data leaves your machine.' },
];

export default function HomeV2() {
    const heroRef = useRef(null);
    const { scrollYProgress } = useScroll({ target: heroRef, offset: ['start start', 'end start'] });
    const heroY = useTransform(scrollYProgress, [0, 1], [0, 120]);
    const heroOpacity = useTransform(scrollYProgress, [0, 0.8], [1, 0]);

    return (
        <div className="bg-[#0a0a0f] text-white selection:bg-teal-500/30 selection:text-white overflow-hidden">

            {/* ── Hero ── */}
            <section ref={heroRef} className="relative min-h-screen flex items-center justify-center">
                {/* Ambient glow */}
                <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[500px] bg-gradient-to-r from-teal-500/20 via-blue-500/15 to-purple-500/10 rounded-full blur-[120px] pointer-events-none" />

                <motion.div style={{ y: heroY, opacity: heroOpacity }} className="relative max-w-5xl mx-auto px-6 text-center">
                    <Reveal>
                        <div className="inline-flex items-center gap-2 bg-white/5 border border-white/10 rounded-full px-4 py-1.5 text-xs font-medium text-slate-300 mb-8 backdrop-blur-sm">
                            <span className="w-2 h-2 bg-teal-400 rounded-full animate-pulse" />
                            RSI for Revit 2024 — Now Available
                        </div>
                    </Reveal>
                    <Reveal delay={0.1}>
                        <h1 className="text-5xl sm:text-7xl lg:text-8xl font-extrabold leading-[1.0] tracking-tight">
                            Design smarter.
                            <br />
                            <span className="bg-gradient-to-r from-teal-400 via-cyan-300 to-blue-400 bg-clip-text text-transparent">
                                Build better.
                            </span>
                        </h1>
                    </Reveal>
                    <Reveal delay={0.2}>
                        <p className="mt-8 text-lg sm:text-xl text-slate-400 font-light leading-relaxed max-w-2xl mx-auto">
                            GenFabTools is a platform of intelligent utilities for architects, engineers, and planners. Automate the tedious. Surface better decisions. Ship faster.
                        </p>
                    </Reveal>
                    <Reveal delay={0.3}>
                        <div className="mt-10 flex flex-wrap justify-center gap-4">
                            <Link
                                to="/rsi"
                                className="group bg-white text-slate-900 px-8 py-4 rounded-full text-sm font-semibold hover:shadow-lg hover:shadow-white/10 transition-all"
                            >
                                Get Started with RSI
                                <span className="inline-block ml-2 group-hover:translate-x-1 transition-transform">→</span>
                            </Link>
                            <Link
                                to="/tools"
                                className="bg-white/5 border border-white/10 text-slate-300 px-8 py-4 rounded-full text-sm font-semibold hover:bg-white/10 transition-colors backdrop-blur-sm"
                            >
                                View All Tools
                            </Link>
                        </div>
                    </Reveal>
                </motion.div>

                {/* Scroll indicator */}
                <motion.div
                    className="absolute bottom-10 left-1/2 -translate-x-1/2"
                    animate={{ y: [0, 8, 0] }}
                    transition={{ repeat: Infinity, duration: 2, ease: 'easeInOut' }}
                >
                    <div className="w-5 h-8 border-2 border-white/20 rounded-full flex justify-center pt-1.5">
                        <div className="w-1 h-2 bg-white/40 rounded-full" />
                    </div>
                </motion.div>
            </section>

            {/* ── Product Showcase ── */}
            <section className="relative py-20 lg:py-32">
                <div className="max-w-6xl mx-auto px-6">
                    <Reveal>
                        <div className="relative">
                            <div className="absolute -inset-1 bg-gradient-to-r from-teal-500/30 via-blue-500/20 to-purple-500/30 rounded-3xl blur-xl opacity-60" />
                            <img
                                src="/images/rsi/project00.png"
                                alt="RSI running inside Revit"
                                className="relative rounded-2xl border border-white/10 shadow-2xl w-full"
                                loading="lazy"
                            />
                        </div>
                    </Reveal>
                </div>
            </section>

            {/* ── Stats ── */}
            <section className="border-y border-white/5">
                <div className="max-w-6xl mx-auto px-6 py-20 grid sm:grid-cols-4 gap-10 text-center">
                    {[
                        { val: '10', suf: '×', label: 'Faster analysis' },
                        { val: '10', suf: 's', label: 'Click to full report' },
                        { val: '49', suf: '', label: 'Per month', prefix: '$' },
                        { val: '2', suf: '%+', label: 'Efficiency gains found' },
                    ].map((s, i) => (
                        <Reveal key={i} delay={i * 0.08}>
                            <p className="text-4xl sm:text-5xl font-extrabold tracking-tight">
                                <span className="bg-gradient-to-b from-white to-slate-400 bg-clip-text text-transparent">
                                    {s.prefix || ''}<AnimatedNumber target={s.val} suffix={s.suf} />
                                </span>
                            </p>
                            <p className="mt-2 text-sm text-slate-500">{s.label}</p>
                        </Reveal>
                    ))}
                </div>
            </section>

            {/* ── Features Grid ── */}
            <section className="max-w-6xl mx-auto px-6 py-28 lg:py-36">
                <Reveal>
                    <div className="text-center mb-16">
                        <h2 className="text-3xl sm:text-5xl font-bold tracking-tight">
                            Everything you need,
                            <br />
                            nothing you don't
                        </h2>
                        <p className="mt-4 text-slate-500 text-lg max-w-lg mx-auto">
                            RSI plugs directly into your Revit workflow. No exports, no spreadsheets, no context-switching.
                        </p>
                    </div>
                </Reveal>

                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {FEATURES.map((f, i) => (
                        <Reveal key={i} delay={i * 0.06}>
                            <div className="group relative bg-white/[0.03] border border-white/[0.06] rounded-2xl p-7 hover:bg-white/[0.06] hover:border-white/10 transition-all duration-300">
                                <span className="text-2xl">{f.icon}</span>
                                <h3 className="mt-4 text-base font-semibold text-white">{f.title}</h3>
                                <p className="mt-2 text-sm text-slate-500 leading-relaxed">{f.desc}</p>
                            </div>
                        </Reveal>
                    ))}
                </div>
            </section>

            {/* ── More Tools Coming ── */}
            <section className="border-t border-white/5">
                <div className="max-w-6xl mx-auto px-6 py-28 lg:py-36">
                    <Reveal>
                        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-6 mb-14">
                            <div>
                                <p className="text-xs font-semibold tracking-[0.2em] uppercase text-teal-400 mb-3">Expanding</p>
                                <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">More tools in the pipeline</h2>
                            </div>
                            <p className="text-slate-500 text-sm max-w-sm">
                                We're building a full ecosystem of AEC intelligence. Each tool targets a specific bottleneck in your design workflow.
                            </p>
                        </div>
                    </Reveal>

                    <div className="grid sm:grid-cols-3 gap-4">
                        {[
                            { label: 'Site Planning', desc: 'Automated building massing and layout generation from site constraints.' },
                            { label: 'Occupancy Analysis', desc: 'Instant code-compliant occupant load calculations for any space type.' },
                            { label: 'Parking Design', desc: 'Optimized parking layouts with smart circulation from boundary input.' },
                        ].map((t, i) => (
                            <Reveal key={i} delay={i * 0.1}>
                                <div className="relative bg-white/[0.02] border border-white/[0.06] border-dashed rounded-2xl p-8 group">
                                    <div className="flex items-center justify-between mb-4">
                                        <span className="text-xs font-bold tracking-widest uppercase text-slate-600">0{i + 1}</span>
                                        <span className="text-[10px] font-semibold tracking-wider uppercase text-teal-400/80 bg-teal-400/10 px-2.5 py-1 rounded-full">
                                            Coming Soon
                                        </span>
                                    </div>
                                    <h3 className="text-lg font-semibold text-slate-300">{t.label}</h3>
                                    <p className="mt-2 text-sm text-slate-600">{t.desc}</p>
                                </div>
                            </Reveal>
                        ))}
                    </div>
                </div>
            </section>

            {/* ── Final CTA ── */}
            <section className="relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-b from-transparent via-teal-500/5 to-transparent pointer-events-none" />
                <div className="max-w-3xl mx-auto px-6 py-32 text-center relative">
                    <Reveal>
                        <h2 className="text-4xl sm:text-6xl font-extrabold tracking-tight leading-tight">
                            Stop wrestling
                            <br />
                            with spreadsheets
                        </h2>
                        <p className="mt-6 text-slate-500 text-lg">
                            RSI pays for itself on the first use. $49/month — less than 20 minutes of an architect's billable time.
                        </p>
                        <div className="mt-10 flex flex-wrap justify-center gap-4">
                            <Link
                                to="/rsi"
                                className="bg-gradient-to-r from-teal-500 to-blue-500 text-white px-10 py-4 rounded-full text-sm font-semibold hover:shadow-lg hover:shadow-teal-500/25 transition-all"
                            >
                                Start with RSI
                            </Link>
                            <Link
                                to="/contact"
                                className="text-slate-400 hover:text-white px-8 py-4 text-sm font-semibold transition-colors"
                            >
                                Contact sales →
                            </Link>
                        </div>
                    </Reveal>
                </div>
            </section>
        </div>
    );
}
