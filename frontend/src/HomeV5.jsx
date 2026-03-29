import React, { useRef } from 'react';
import { Link } from 'react-router-dom';
import { motion, useScroll, useTransform, useInView } from 'framer-motion';
import { SHOW_DRAFT_TOOLS } from './config/featureFlags';

/* ───────────────────────────────────────────────────────────
   VERSION 5 — "The Scroll Theater"
   Cinematic vertical scroll experience. Each section
   transforms as you scroll — parallax, scale, opacity.
   Tools reveal one-by-one like acts in a play.
   Brand story told through motion.
   ─────────────────────────────────────────────────────────── */

function Fade({ children, className = '', delay = 0 }) {
    const ref = useRef(null);
    const inView = useInView(ref, { once: true, margin: '-80px' });
    return (
        <motion.div ref={ref} className={className}
            initial={{ opacity: 0, y: 36 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.8, delay, ease: [0.22, 1, 0.36, 1] }}
        >{children}</motion.div>
    );
}

/* Tool "act" component — each tool gets a full-viewport section */
function ToolAct({ tool, index, reverse }) {
    const ref = useRef(null);
    const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] });
    const imgY = useTransform(scrollYProgress, [0, 1], [60, -60]);
    const textY = useTransform(scrollYProgress, [0, 1], [30, -30]);

    const isLive = tool.status === 'live';

    return (
        <section ref={ref} className="relative py-24 lg:py-32 overflow-hidden">
            <div className="max-w-7xl mx-auto px-6 sm:px-12">
                <div className={`grid lg:grid-cols-2 gap-16 items-center ${reverse ? 'lg:direction-rtl' : ''}`}>
                    {/* Image side */}
                    <motion.div style={{ y: imgY }} className={`${reverse ? 'lg:order-2' : ''}`}>
                        <Fade delay={0.1}>
                            <div className="relative">
                                {/* Colored accent glow */}
                                <div
                                    className="absolute -inset-8 rounded-3xl blur-3xl opacity-20"
                                    style={{ backgroundColor: tool.color }}
                                />
                                {tool.image ? (
                                    <img
                                        src={tool.image}
                                        alt={`${tool.name} interface`}
                                        className="relative rounded-2xl shadow-2xl border border-white/10 w-full"
                                        loading="lazy"
                                    />
                                ) : (
                                    <div className="relative rounded-2xl bg-gradient-to-br from-slate-800 to-slate-900 border border-white/10 aspect-video flex items-center justify-center shadow-2xl">
                                        <div className="text-center">
                                            <span className="text-4xl font-extrabold text-white/20">{tool.name}</span>
                                            <p className="text-sm text-white/10 mt-2">Preview coming soon</p>
                                        </div>
                                    </div>
                                )}

                                {/* Tool number badge */}
                                <div className="absolute -top-4 -left-4 w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white shadow-lg" style={{ backgroundColor: tool.color }}>
                                    {String(index + 1).padStart(2, '0')}
                                </div>
                            </div>
                        </Fade>
                    </motion.div>

                    {/* Text side */}
                    <motion.div style={{ y: textY }} className={`${reverse ? 'lg:order-1 lg:text-right' : ''}`}>
                        <Fade>
                            <div className={`flex items-center gap-2 mb-4 ${reverse ? 'lg:justify-end' : ''}`}>
                                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: tool.color }} />
                                <span className="text-xs font-bold tracking-[0.15em] uppercase" style={{ color: tool.color }}>
                                    {tool.category} · {isLive ? 'Available Now' : 'Coming Soon'}
                                </span>
                            </div>
                            <h2 className="text-3xl sm:text-5xl font-extrabold tracking-tight leading-tight">
                                {tool.name}
                            </h2>
                            <p className="text-lg sm:text-xl text-slate-400 font-light mt-1">{tool.full}</p>
                            <p className="mt-6 text-slate-500 text-base leading-relaxed max-w-md">
                                {tool.desc}
                            </p>
                        </Fade>

                        {tool.stats && (
                            <Fade delay={0.15}>
                                <div className={`mt-8 flex gap-6 ${reverse ? 'lg:justify-end' : ''}`}>
                                    {tool.stats.map((s, i) => (
                                        <div key={i}>
                                            <p className="text-2xl font-extrabold">{s.val}</p>
                                            <p className="text-xs text-slate-500">{s.label}</p>
                                        </div>
                                    ))}
                                </div>
                            </Fade>
                        )}

                        <Fade delay={0.2}>
                            {tool.link ? (
                                <Link
                                    to={tool.link}
                                    className="inline-flex items-center gap-2 mt-8 px-6 py-3 rounded-full text-sm font-semibold text-white transition-all shadow-md hover:shadow-lg"
                                    style={{ backgroundColor: tool.color }}
                                >
                                    Explore {tool.name}
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
                                </Link>
                            ) : (
                                <div className="inline-flex items-center gap-2 mt-8 px-5 py-2.5 rounded-full text-sm font-medium bg-white/5 border border-white/10 text-slate-400">
                                    <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: tool.color }} />
                                    In development
                                </div>
                            )}
                        </Fade>
                    </motion.div>
                </div>
            </div>
        </section>
    );
}

const TOOLS = [
    {
        id: 'rsi',
        name: 'RSI',
        full: 'Residential Scheme Intelligence',
        desc: 'Analyze residential scheme efficiency, run financial feasibility, and compare design alternatives — all live inside Autodesk Revit. No exports, no spreadsheets.',
        color: '#14b8a6',
        status: 'live',
        link: '/rsi',
        category: 'Analysis',
        image: '/images/rsi/project00.png',
        stats: [
            { val: '10×', label: 'Faster' },
            { val: '<10s', label: 'Per run' },
            { val: '$49', label: '/month' },
        ],
    },
    {
        id: 'sitegen',
        name: 'SiteGen',
        full: 'Site Generator',
        desc: 'Automated site planning with optimized building massing and parking layouts. Draw a boundary, set constraints, get a scheme.',
        color: '#3b82f6',
        status: 'coming',
        link: SHOW_DRAFT_TOOLS ? '/sitegen' : null,
        category: 'Generative',
        image: null,
    },
    {
        id: 'occucalc',
        name: 'OccuCalc',
        full: 'Occupancy Calculator',
        desc: 'Code-compliant occupant load calculations for any building type. Select a code, pick a use, get instant results with full auditability.',
        color: '#8b5cf6',
        status: 'coming',
        link: SHOW_DRAFT_TOOLS ? '/occucalc' : null,
        category: 'Compliance',
        image: null,
    },
    {
        id: 'parkcore',
        name: 'ParkCore',
        full: 'Parking Core Engine',
        desc: 'Generate optimized parking layouts from site boundaries with intelligent circulation routing. Upload DXF, get an optimized layout.',
        color: '#f59e0b',
        status: 'coming',
        link: SHOW_DRAFT_TOOLS ? '/parkcore' : null,
        category: 'Generative',
        image: null,
    },
];

export default function HomeV5() {
    const heroRef = useRef(null);
    const { scrollYProgress } = useScroll({ target: heroRef, offset: ['start start', 'end start'] });
    const heroScale = useTransform(scrollYProgress, [0, 1], [1, 0.9]);
    const heroBgY = useTransform(scrollYProgress, [0, 1], [0, -100]);

    return (
        <div className="bg-[#09090b] text-white selection:bg-teal-400/30 overflow-hidden">

            {/* ── Hero — Brand Statement ── */}
            <motion.section ref={heroRef} style={{ scale: heroScale }} className="relative min-h-screen flex flex-col items-center justify-center text-center px-6 origin-top">
                {/* Moving grid */}
                <motion.div
                    style={{ y: heroBgY }}
                    className="absolute inset-0 opacity-[0.04]"
                >
                    <div className="w-full h-full" style={{
                        backgroundImage: 'linear-gradient(to right, white 1px, transparent 1px), linear-gradient(to bottom, white 1px, transparent 1px)',
                        backgroundSize: '60px 60px'
                    }} />
                </motion.div>

                {/* Glow */}
                <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] bg-gradient-to-r from-teal-500/10 via-blue-500/8 to-purple-500/10 rounded-full blur-[100px]" />

                <Fade>
                    <motion.img
                        src="/genfabtools-logo.png"
                        alt="GenFabTools"
                        className="h-16 w-16 mx-auto mb-8"
                        animate={{ rotate: [0, 360] }}
                        transition={{ duration: 60, repeat: Infinity, ease: 'linear' }}
                    />
                </Fade>
                <Fade delay={0.1}>
                    <h1 className="text-5xl sm:text-7xl lg:text-8xl font-extrabold tracking-tight leading-[1.05] max-w-5xl">
                        The platform for{' '}
                        <span className="bg-gradient-to-r from-teal-400 via-cyan-300 to-blue-400 bg-clip-text text-transparent">
                            AEC intelligence
                        </span>
                    </h1>
                </Fade>
                <Fade delay={0.2}>
                    <p className="mt-8 text-lg sm:text-xl text-slate-400 font-light max-w-2xl leading-relaxed">
                        GenFabTools builds specialized, powerful utilities for architects, engineers, and planners. Each tool eliminates hours of manual work — and they're just getting started.
                    </p>
                </Fade>
                <Fade delay={0.3}>
                    <div className="mt-10 flex items-center gap-3">
                        {TOOLS.map((t) => (
                            <div
                                key={t.id}
                                className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-full px-4 py-2 text-xs font-medium"
                            >
                                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: t.color }} />
                                <span className="text-slate-300">{t.name}</span>
                                {t.status === 'live' && <span className="text-teal-400 text-[10px]">●</span>}
                            </div>
                        ))}
                    </div>
                </Fade>

                {/* Scroll hint */}
                <motion.div
                    className="absolute bottom-12"
                    animate={{ y: [0, 8, 0] }}
                    transition={{ repeat: Infinity, duration: 2.5, ease: 'easeInOut' }}
                >
                    <div className="flex flex-col items-center gap-2">
                        <span className="text-xs text-slate-600 tracking-wider uppercase">Scroll to explore</span>
                        <svg className="w-5 h-5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 14l-7 7m0 0l-7-7m7 7V3" /></svg>
                    </div>
                </motion.div>
            </motion.section>

            {/* ── Act divider ── */}
            <div className="max-w-xl mx-auto px-6 py-20 text-center">
                <Fade>
                    <p className="text-sm text-slate-600 tracking-wider uppercase font-medium">
                        — The Tools —
                    </p>
                </Fade>
            </div>

            {/* ── Tool Acts ── */}
            {TOOLS.map((tool, i) => (
                <ToolAct key={tool.id} tool={tool} index={i} reverse={i % 2 !== 0} />
            ))}

            {/* ── Future teaser ── */}
            <section className="py-28 text-center">
                <Fade>
                    <div className="max-w-2xl mx-auto px-6">
                        <div className="inline-flex items-center gap-2 bg-white/5 border border-white/10 rounded-full px-5 py-2.5 text-sm text-slate-400 mb-8">
                            <span className="w-2 h-2 rounded-full bg-slate-500 animate-pulse" />
                            More tools in development
                        </div>
                        <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">
                            This is just the beginning
                        </h2>
                        <p className="mt-4 text-slate-500 text-lg max-w-lg mx-auto">
                            The GenFabTools ecosystem will grow to cover every repetitive bottleneck in your design pipeline.
                            One platform, one account, unlimited intelligence.
                        </p>
                    </div>
                </Fade>
            </section>

            {/* ── Brand values strip ── */}
            <section className="border-y border-white/5">
                <div className="max-w-6xl mx-auto px-6 py-16 grid sm:grid-cols-4 gap-8 text-center">
                    {[
                        { icon: '🎯', label: 'Purpose-built' },
                        { icon: '⚡', label: 'Instant results' },
                        { icon: '🔒', label: 'Privacy-first' },
                        { icon: '🌐', label: 'One platform' },
                    ].map((v, i) => (
                        <Fade key={i} delay={i * 0.06}>
                            <span className="text-2xl">{v.icon}</span>
                            <p className="mt-2 text-sm font-semibold text-slate-300">{v.label}</p>
                        </Fade>
                    ))}
                </div>
            </section>

            {/* ── Final CTA ── */}
            <section className="relative py-32">
                <div className="absolute inset-0 bg-gradient-to-b from-transparent via-teal-500/[0.03] to-transparent" />
                <div className="relative max-w-3xl mx-auto px-6 text-center">
                    <Fade>
                        <h2 className="text-4xl sm:text-6xl font-extrabold tracking-tight leading-tight">
                            Ready to build
                            <br />
                            smarter?
                        </h2>
                        <p className="mt-6 text-slate-500 text-lg">
                            Start with RSI — our Revit plugin that pays for itself on day one. Then watch the ecosystem grow.
                        </p>
                        <div className="mt-10 flex flex-wrap justify-center gap-4">
                            <Link
                                to="/rsi"
                                className="bg-gradient-to-r from-teal-500 to-blue-500 text-white px-10 py-4 rounded-full text-sm font-semibold hover:shadow-lg hover:shadow-teal-500/20 transition-all"
                            >
                                Get RSI — $49/month
                            </Link>
                            <Link
                                to="/contact"
                                className="text-slate-400 hover:text-white px-6 py-4 text-sm font-semibold transition-colors"
                            >
                                Talk to us →
                            </Link>
                        </div>
                    </Fade>
                </div>
            </section>
        </div>
    );
}
