import React, { useRef } from 'react';
import { Link } from 'react-router-dom';
import { motion, useInView } from 'framer-motion';
import { SHOW_DRAFT_TOOLS } from './config/featureFlags';

/* ───────────────────────────────────────────────────────────
   VERSION 3 — "The Dynamic"
   Mixed light/dark, bento grid layout, scroll-triggered
   stagger animations, animated gradient borders.
   Inspired by Raycast, Arc Browser, and Lemon Squeezy.
   ─────────────────────────────────────────────────────────── */

function Stagger({ children, className = '', delay = 0 }) {
    const ref = useRef(null);
    const inView = useInView(ref, { once: true, margin: '-60px' });
    return (
        <motion.div
            ref={ref}
            className={className}
            initial={{ opacity: 0, y: 28, filter: 'blur(6px)' }}
            animate={inView ? { opacity: 1, y: 0, filter: 'blur(0px)' } : {}}
            transition={{ duration: 0.6, delay, ease: [0.22, 1, 0.36, 1] }}
        >
            {children}
        </motion.div>
    );
}

/* Glowing border card */
function GlowCard({ children, className = '', color = 'teal' }) {
    const colors = {
        teal: 'from-teal-400/40 to-cyan-400/40',
        blue: 'from-blue-400/40 to-indigo-400/40',
        amber: 'from-amber-400/40 to-orange-400/40',
    };
    return (
        <div className={`relative group ${className}`}>
            <div className={`absolute -inset-px bg-gradient-to-br ${colors[color]} rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 blur-sm`} />
            <div className="relative bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl h-full">
                {children}
            </div>
        </div>
    );
}

const SCREENSHOTS = [
    { src: '/images/rsi/efficiency-dashboard.png', label: 'Efficiency Dashboard', sub: '83% net-to-gross ratio' },
    { src: '/images/rsi/financial-impact-RSI.png', label: 'Financial Impact', sub: 'Revenue per scheme' },
    { src: '/images/rsi/decision-summary.png', label: 'Decision Summary', sub: 'Side-by-side comparison' },
];

export default function HomeV3() {
    return (
        <div className="bg-white text-slate-900 selection:bg-teal-200 overflow-hidden">

            {/* ── Hero ── */}
            <section className="relative min-h-screen flex items-center bg-gradient-to-b from-slate-50 via-white to-white">
                {/* Decorative blobs */}
                <div className="absolute top-20 left-10 w-72 h-72 bg-teal-200/30 rounded-full blur-3xl pointer-events-none" />
                <div className="absolute bottom-20 right-10 w-96 h-96 bg-blue-200/20 rounded-full blur-3xl pointer-events-none" />

                <div className="relative max-w-6xl mx-auto px-6 py-32 lg:py-40 w-full">
                    <div className="max-w-3xl">
                        <Stagger>
                            <div className="inline-flex items-center gap-2.5 border border-slate-200 rounded-full px-4 py-2 text-sm text-slate-500 mb-8 bg-white shadow-sm">
                                <span className="relative flex h-2 w-2">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal-400 opacity-75" />
                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-teal-500" />
                                </span>
                                RSI for Revit 2024 is live
                            </div>
                        </Stagger>
                        <Stagger delay={0.08}>
                            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-extrabold leading-[1.08] tracking-tight">
                                The architect's
                                <br />
                                unfair{' '}
                                <span className="relative">
                                    advantage
                                    <svg className="absolute -bottom-2 left-0 w-full" viewBox="0 0 200 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                                        <path d="M2 8 C50 2, 150 2, 198 8" stroke="url(#grad)" strokeWidth="3" strokeLinecap="round" />
                                        <defs><linearGradient id="grad" x1="0" y1="0" x2="200" y2="0"><stop stopColor="#14b8a6" /><stop offset="1" stopColor="#3b82f6" /></linearGradient></defs>
                                    </svg>
                                </span>
                            </h1>
                        </Stagger>
                        <Stagger delay={0.16}>
                            <p className="mt-8 text-lg sm:text-xl text-slate-500 leading-relaxed max-w-xl">
                                GenFabTools builds intelligent software that turns hours of manual analysis into seconds of automated insight — directly inside your design tools.
                            </p>
                        </Stagger>
                        <Stagger delay={0.24}>
                            <div className="mt-10 flex flex-wrap gap-3">
                                <Link
                                    to="/rsi"
                                    className="bg-slate-900 text-white px-7 py-3.5 rounded-xl text-sm font-semibold hover:bg-slate-800 transition-all shadow-lg shadow-slate-900/15 hover:-translate-y-0.5"
                                >
                                    Try RSI — $49/mo
                                </Link>
                                <Link
                                    to="/about"
                                    className="bg-slate-100 text-slate-700 px-7 py-3.5 rounded-xl text-sm font-semibold hover:bg-slate-200 transition-all"
                                >
                                    How it works
                                </Link>
                            </div>
                        </Stagger>
                    </div>
                </div>
            </section>

            {/* ── Bento Grid — Product ── */}
            <section className="max-w-6xl mx-auto px-6 py-20 lg:py-28">
                <Stagger>
                    <p className="text-xs font-bold tracking-[0.2em] uppercase text-teal-600 mb-3">Flagship</p>
                    <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-12">
                        Residential Scheme Intelligence
                    </h2>
                </Stagger>

                {/* Bento layout */}
                <div className="grid md:grid-cols-3 gap-4">
                    {/* Large card */}
                    <Stagger className="md:col-span-2 md:row-span-2">
                        <GlowCard color="teal">
                            <div className="p-6 pb-0">
                                <span className="text-xs font-semibold text-teal-600 tracking-wider uppercase">Live in Revit</span>
                                <h3 className="mt-2 text-xl font-bold">Click Analyze. See everything.</h3>
                                <p className="mt-2 text-sm text-slate-500 max-w-md">
                                    Efficiency ratios, area breakdowns, financial feasibility — all computed in real time as you design.
                                </p>
                            </div>
                            <div className="mt-4 px-4">
                                <img
                                    src="/images/rsi/project00.png"
                                    alt="RSI analysis view inside Revit"
                                    className="rounded-xl border border-slate-200 shadow-md w-full"
                                    loading="lazy"
                                />
                            </div>
                        </GlowCard>
                    </Stagger>

                    {/* Top-right stat */}
                    <Stagger delay={0.1}>
                        <GlowCard color="blue">
                            <div className="p-6 flex flex-col justify-between h-full min-h-[180px]">
                                <span className="text-xs font-semibold text-blue-600 tracking-wider uppercase">Speed</span>
                                <div>
                                    <p className="text-5xl font-extrabold tracking-tight">10×</p>
                                    <p className="mt-1 text-sm text-slate-500">Faster than spreadsheets</p>
                                </div>
                            </div>
                        </GlowCard>
                    </Stagger>

                    {/* Bottom-right stat */}
                    <Stagger delay={0.15}>
                        <GlowCard color="amber">
                            <div className="p-6 flex flex-col justify-between h-full min-h-[180px]">
                                <span className="text-xs font-semibold text-amber-600 tracking-wider uppercase">Value</span>
                                <div>
                                    <p className="text-5xl font-extrabold tracking-tight">$49</p>
                                    <p className="mt-1 text-sm text-slate-500">Per month — pays for itself day one</p>
                                </div>
                            </div>
                        </GlowCard>
                    </Stagger>
                </div>
            </section>

            {/* ── Dark section — Capabilities ── */}
            <section className="bg-slate-950 text-white py-28 lg:py-36">
                <div className="max-w-6xl mx-auto px-6">
                    <Stagger>
                        <div className="text-center mb-20">
                            <h2 className="text-3xl sm:text-5xl font-bold tracking-tight">
                                What used to take hours
                                <br />
                                <span className="text-slate-500">now takes seconds</span>
                            </h2>
                        </div>
                    </Stagger>

                    {/* Before / After columns */}
                    <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
                        <Stagger delay={0.1}>
                            <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-8">
                                <p className="text-xs font-bold tracking-[0.15em] uppercase text-red-400 mb-6">Without RSI</p>
                                <ul className="space-y-4">
                                    {[
                                        'Export area schedules to Excel',
                                        'Manually tag net, core, circulation',
                                        'Calculate efficiency ratios by hand',
                                        'Google industry benchmarks',
                                        'Build separate financial model',
                                        'Repeat for each design option',
                                    ].map((s, i) => (
                                        <li key={i} className="flex items-start gap-3 text-slate-500 text-sm">
                                            <svg className="w-4 h-4 text-red-400/60 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                            {s}
                                        </li>
                                    ))}
                                </ul>
                                <p className="mt-6 text-sm font-semibold text-red-400">2–4 hours per iteration</p>
                            </div>
                        </Stagger>

                        <Stagger delay={0.2}>
                            <div className="bg-teal-500/[0.05] border border-teal-400/10 rounded-2xl p-8">
                                <p className="text-xs font-bold tracking-[0.15em] uppercase text-teal-400 mb-6">With RSI</p>
                                <ul className="space-y-4">
                                    {[
                                        'Click Analyze in Revit',
                                        'Areas auto-classified from model',
                                        'Efficiency + benchmarks — live',
                                        'Financial impact calculated instantly',
                                        'Compare schemes with one click',
                                        'Results update as you design',
                                    ].map((s, i) => (
                                        <li key={i} className="flex items-start gap-3 text-slate-300 text-sm">
                                            <svg className="w-4 h-4 text-teal-400 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                                            {s}
                                        </li>
                                    ))}
                                </ul>
                                <p className="mt-6 text-sm font-semibold text-teal-400">Under 10 seconds</p>
                            </div>
                        </Stagger>
                    </div>
                </div>
            </section>

            {/* ── Screenshots Gallery ── */}
            <section className="max-w-6xl mx-auto px-6 py-28 lg:py-36">
                <Stagger>
                    <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-center mb-14">
                        See it in action
                    </h2>
                </Stagger>
                <div className="grid sm:grid-cols-3 gap-6">
                    {SCREENSHOTS.map((s, i) => (
                        <Stagger key={i} delay={i * 0.1}>
                            <div className="group">
                                <div className="overflow-hidden rounded-2xl border border-slate-200 shadow-sm group-hover:shadow-lg transition-shadow duration-300">
                                    <img
                                        src={s.src}
                                        alt={s.label}
                                        className="w-full group-hover:scale-[1.02] transition-transform duration-500"
                                        loading="lazy"
                                    />
                                </div>
                                <p className="mt-3 text-sm font-semibold text-slate-900">{s.label}</p>
                                <p className="text-xs text-slate-500">{s.sub}</p>
                            </div>
                        </Stagger>
                    ))}
                </div>
            </section>

            {/* ── Coming Soon Tools ── */}
            <section className="bg-slate-50 py-28 lg:py-36">
                <div className="max-w-6xl mx-auto px-6">
                    <Stagger>
                        <div className="text-center mb-14">
                            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">More intelligence, coming soon</h2>
                            <p className="mt-3 text-slate-500 text-lg max-w-lg mx-auto">Three more tools are in the pipeline — each targeting a different AEC bottleneck.</p>
                        </div>
                    </Stagger>

                    <div className="grid sm:grid-cols-3 gap-4">
                        {[
                            { emoji: '🏗️', title: 'Site Planning', desc: 'Generate optimized building massing from site constraints.' },
                            { emoji: '👥', title: 'Occupancy Analysis', desc: 'Code-compliant occupant loads, calculated instantly.' },
                            { emoji: '🅿️', title: 'Parking Design', desc: 'Smart parking layouts from boundary geometry input.' },
                        ].map((t, i) => (
                            <Stagger key={i} delay={i * 0.08}>
                                <div className="bg-white rounded-2xl border border-slate-200 p-7 relative">
                                    <span className="text-3xl">{t.emoji}</span>
                                    <h3 className="mt-4 text-base font-semibold">{t.title}</h3>
                                    <p className="mt-1.5 text-sm text-slate-500">{t.desc}</p>
                                    <span className="absolute top-5 right-5 text-[10px] font-bold tracking-widest uppercase text-slate-400 bg-slate-100 px-2.5 py-1 rounded-full">
                                        Soon
                                    </span>
                                </div>
                            </Stagger>
                        ))}
                    </div>
                </div>
            </section>

            {/* ── Final CTA ── */}
            <section className="relative py-32">
                {/* Gradient accent */}
                <div className="absolute inset-0 bg-gradient-to-b from-white via-teal-50/30 to-white pointer-events-none" />
                <div className="relative max-w-3xl mx-auto px-6 text-center">
                    <Stagger>
                        <h2 className="text-4xl sm:text-5xl font-extrabold tracking-tight">
                            Your next project,
                            <br />
                            analyzed in seconds
                        </h2>
                        <p className="mt-6 text-slate-500 text-lg max-w-md mx-auto">
                            Join architects who've stopped fighting spreadsheets and started making better design decisions.
                        </p>
                        <div className="mt-10 flex flex-wrap justify-center gap-4">
                            <Link
                                to="/rsi"
                                className="bg-slate-900 text-white px-8 py-4 rounded-xl text-sm font-semibold hover:bg-slate-800 transition-all shadow-lg shadow-slate-900/15 hover:-translate-y-0.5"
                            >
                                Get RSI — $49/month
                            </Link>
                            <Link
                                to="/contact"
                                className="text-slate-500 hover:text-slate-900 px-8 py-4 text-sm font-semibold transition-colors"
                            >
                                Questions? Let's talk →
                            </Link>
                        </div>
                    </Stagger>
                </div>
            </section>
        </div>
    );
}
