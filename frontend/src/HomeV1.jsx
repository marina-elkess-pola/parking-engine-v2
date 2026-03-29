import React, { useRef } from 'react';
import { Link } from 'react-router-dom';
import { motion, useInView } from 'framer-motion';
import { SHOW_DRAFT_TOOLS } from './config/featureFlags';

/* ───────────────────────────────────────────────────────────
   VERSION 1 — "The Architect"
   Clean, editorial, whitespace-driven. Inspired by Dezeen,
   Apple, and Pentagram. Light palette, giant typography,
   geometric accents, asymmetric layouts.
   ─────────────────────────────────────────────────────────── */

function FadeIn({ children, className = '', delay = 0 }) {
    const ref = useRef(null);
    const inView = useInView(ref, { once: true, margin: '-60px' });
    return (
        <motion.div
            ref={ref}
            className={className}
            initial={{ opacity: 0, y: 32 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.7, delay, ease: [0.22, 1, 0.36, 1] }}
        >
            {children}
        </motion.div>
    );
}

const STATS = [
    { value: '10×', label: 'Faster than manual analysis' },
    { value: '2%+', label: 'Efficiency gains found' },
    { value: '<10s', label: 'From click to full report' },
];

const TOOLS_COMING = [
    { name: 'Site Planning', desc: 'Automated massing and layout generation' },
    { name: 'Occupancy Analysis', desc: 'Code-compliant occupant load calculations' },
    { name: 'Parking Optimization', desc: 'Intelligent parking layout from boundaries' },
];

export default function HomeV1() {
    return (
        <div className="bg-white text-slate-900 selection:bg-teal-200 selection:text-slate-900">

            {/* ── Hero ── */}
            <section className="relative min-h-screen flex items-center overflow-hidden">
                {/* Thin grid lines background */}
                <div className="absolute inset-0 opacity-[0.035]" style={{
                    backgroundImage: 'linear-gradient(to right, #0f172a 1px, transparent 1px), linear-gradient(to bottom, #0f172a 1px, transparent 1px)',
                    backgroundSize: '80px 80px'
                }} />

                <div className="relative max-w-7xl mx-auto px-6 sm:px-12 py-32 lg:py-40 w-full">
                    <FadeIn>
                        <p className="text-sm font-medium tracking-[0.2em] uppercase text-teal-600 mb-6">
                            GenFabTools
                        </p>
                    </FadeIn>
                    <FadeIn delay={0.1}>
                        <h1 className="text-5xl sm:text-7xl lg:text-[5.5rem] font-extrabold leading-[1.05] tracking-tight max-w-4xl">
                            Intelligent tools
                            <br />
                            for the <span className="relative inline-block">
                                built world
                                <span className="absolute -bottom-2 left-0 w-full h-1 bg-teal-500 rounded-full" />
                            </span>
                        </h1>
                    </FadeIn>
                    <FadeIn delay={0.2}>
                        <p className="mt-8 text-lg sm:text-xl text-slate-500 font-light leading-relaxed max-w-xl">
                            We build purpose-made utilities that automate tedious workflows for architects, engineers, and planners — so you can focus on design, not data entry.
                        </p>
                    </FadeIn>
                    <FadeIn delay={0.3}>
                        <div className="mt-10 flex flex-wrap gap-4">
                            <Link
                                to="/rsi"
                                className="inline-flex items-center gap-2 bg-slate-900 text-white px-7 py-3.5 rounded-full text-sm font-semibold hover:bg-slate-800 transition-colors shadow-lg shadow-slate-900/20"
                            >
                                Explore RSI
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
                            </Link>
                            <Link
                                to="/about"
                                className="inline-flex items-center gap-2 border border-slate-300 text-slate-700 px-7 py-3.5 rounded-full text-sm font-semibold hover:border-slate-400 hover:bg-slate-50 transition-colors"
                            >
                                About us
                            </Link>
                        </div>
                    </FadeIn>
                </div>
            </section>

            {/* ── Divider Line ── */}
            <div className="max-w-7xl mx-auto px-6 sm:px-12"><div className="border-t border-slate-200" /></div>

            {/* ── Flagship Product — RSI ── */}
            <section className="max-w-7xl mx-auto px-6 sm:px-12 py-28 lg:py-36">
                <div className="grid lg:grid-cols-2 gap-16 lg:gap-24 items-center">
                    <div>
                        <FadeIn>
                            <span className="inline-block text-xs font-semibold tracking-[0.15em] uppercase text-teal-600 bg-teal-50 px-3 py-1 rounded-full mb-6">
                                Flagship Product
                            </span>
                            <h2 className="text-3xl sm:text-5xl font-bold leading-tight tracking-tight">
                                Residential Scheme Intelligence
                            </h2>
                            <p className="mt-6 text-slate-500 text-lg leading-relaxed">
                                Live efficiency scoring, financial feasibility analysis, and scheme comparison — running directly inside Autodesk Revit. What used to take hours now takes seconds.
                            </p>
                        </FadeIn>
                        <FadeIn delay={0.15}>
                            <ul className="mt-8 space-y-3">
                                {['Heatmap diagnostics overlaid on floor plans', 'Side-by-side scheme comparison with delta tables', 'One-click export to Excel, PDF, or CSV'].map((item, i) => (
                                    <li key={i} className="flex items-start gap-3 text-slate-600">
                                        <svg className="w-5 h-5 text-teal-500 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                                        {item}
                                    </li>
                                ))}
                            </ul>
                            <Link
                                to="/rsi"
                                className="inline-flex items-center gap-2 mt-8 text-sm font-semibold text-teal-600 hover:text-teal-700 transition-colors group"
                            >
                                Learn more about RSI
                                <svg className="w-4 h-4 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
                            </Link>
                        </FadeIn>
                    </div>
                    <FadeIn delay={0.1}>
                        <div className="relative">
                            <div className="absolute -inset-4 bg-gradient-to-br from-teal-100/60 to-blue-100/40 rounded-3xl blur-2xl" />
                            <img
                                src="/images/rsi/project00.png"
                                alt="RSI plugin running inside Revit showing efficiency analysis"
                                className="relative rounded-2xl shadow-2xl border border-slate-200/60 w-full"
                                loading="lazy"
                            />
                        </div>
                    </FadeIn>
                </div>
            </section>

            {/* ── Stats Strip ── */}
            <section className="bg-slate-950 text-white">
                <div className="max-w-7xl mx-auto px-6 sm:px-12 py-20">
                    <div className="grid sm:grid-cols-3 gap-12 text-center">
                        {STATS.map((s, i) => (
                            <FadeIn key={i} delay={i * 0.1}>
                                <p className="text-4xl sm:text-5xl font-extrabold tracking-tight text-teal-400">{s.value}</p>
                                <p className="mt-2 text-slate-400 text-sm">{s.label}</p>
                            </FadeIn>
                        ))}
                    </div>
                </div>
            </section>

            {/* ── Coming Soon / More Tools ── */}
            <section className="max-w-7xl mx-auto px-6 sm:px-12 py-28 lg:py-36">
                <FadeIn>
                    <p className="text-sm font-medium tracking-[0.2em] uppercase text-slate-400 mb-4">What's next</p>
                    <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">
                        A growing ecosystem of tools
                    </h2>
                    <p className="mt-4 text-slate-500 text-lg max-w-xl">
                        We're building more intelligent utilities for the AEC industry. Each one is purpose-built to eliminate hours of manual work.
                    </p>
                </FadeIn>

                <div className="mt-14 grid sm:grid-cols-3 gap-6">
                    {(SHOW_DRAFT_TOOLS ? TOOLS_COMING : TOOLS_COMING).map((tool, i) => (
                        <FadeIn key={i} delay={i * 0.1}>
                            <div className="relative group rounded-2xl border border-slate-200 p-8 hover:border-slate-300 transition-colors">
                                <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center mb-5">
                                    <span className="text-lg font-bold text-slate-400">0{i + 1}</span>
                                </div>
                                {SHOW_DRAFT_TOOLS ? (
                                    <>
                                        <h3 className="text-lg font-semibold text-slate-900">{tool.name}</h3>
                                        <p className="mt-2 text-sm text-slate-500">{tool.desc}</p>
                                    </>
                                ) : (
                                    <>
                                        <h3 className="text-lg font-semibold text-slate-900">{tool.name}</h3>
                                        <p className="mt-2 text-sm text-slate-500">{tool.desc}</p>
                                        <span className="absolute top-4 right-4 text-[10px] font-bold tracking-widest uppercase text-teal-600 bg-teal-50 px-2 py-0.5 rounded-full">
                                            Coming Soon
                                        </span>
                                    </>
                                )}
                            </div>
                        </FadeIn>
                    ))}
                </div>
            </section>

            {/* ── Final CTA ── */}
            <section className="bg-slate-50">
                <div className="max-w-3xl mx-auto px-6 sm:px-12 py-28 text-center">
                    <FadeIn>
                        <h2 className="text-3xl sm:text-5xl font-bold tracking-tight">
                            Ready to work smarter?
                        </h2>
                        <p className="mt-4 text-slate-500 text-lg">
                            Start with RSI — our Revit plugin that pays for itself on day one.
                        </p>
                        <div className="mt-10 flex flex-wrap justify-center gap-4">
                            <Link
                                to="/rsi"
                                className="bg-slate-900 text-white px-8 py-4 rounded-full text-sm font-semibold hover:bg-slate-800 transition-colors shadow-lg shadow-slate-900/20"
                            >
                                Get RSI — $49/month
                            </Link>
                            <Link
                                to="/contact"
                                className="border border-slate-300 text-slate-700 px-8 py-4 rounded-full text-sm font-semibold hover:border-slate-400 transition-colors"
                            >
                                Talk to us
                            </Link>
                        </div>
                    </FadeIn>
                </div>
            </section>
        </div>
    );
}
