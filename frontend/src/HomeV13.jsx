import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { motion, useMotionValue, useTransform, useSpring, useInView, AnimatePresence } from 'framer-motion';
import { SHOW_DRAFT_TOOLS } from './config/featureFlags';

/* ───────────────────────────────────────────────────────────
   VERSION 13 — "The Desk"
   Isometric top-down view of an architect's desk.
   Each object IS a tool — hover to glow, click to learn.
   Mouse parallax gives depth. Zero marketing copy in hero.
   ─────────────────────────────────────────────────────────── */

/* ── Desk items ── */
const DESK_ITEMS = [
    {
        id: 'laptop',
        tool: 'RSI',
        full: 'Residential Scheme Intelligence',
        desc: 'Efficiency scoring, financial feasibility, scheme comparison — live inside Revit.',
        color: '#14b8a6',
        status: 'live',
        link: '/rsi',
        emoji: '💻',
        label: 'Laptop',
        x: 50, y: 38,
        w: 22, h: 16,
        hint: 'Your Revit add-in lives here',
    },
    {
        id: 'calculator',
        tool: 'OccuCalc',
        full: 'Occupancy Calculator',
        desc: 'Code-compliant occupant loads, calculated instantly from your floor plans.',
        color: '#8b5cf6',
        status: 'coming',
        link: SHOW_DRAFT_TOOLS ? '/occucalc' : null,
        emoji: '🧮',
        label: 'Calculator',
        x: 78, y: 32,
        w: 12, h: 12,
        hint: 'No more IBC table lookups',
    },
    {
        id: 'blueprint',
        tool: 'SiteGen',
        full: 'Site Generator',
        desc: 'Automated building massing and parking from site boundary constraints.',
        color: '#3b82f6',
        status: 'coming',
        link: SHOW_DRAFT_TOOLS ? '/sitegen' : null,
        emoji: '📐',
        label: 'Drawing Roll',
        x: 15, y: 55,
        w: 18, h: 20,
        hint: 'From constraints to massing',
    },
    {
        id: 'scaleruler',
        tool: 'ParkCore',
        full: 'Parking Core Engine',
        desc: 'Optimized parking layouts from any boundary geometry. ADA compliant.',
        color: '#f59e0b',
        status: 'coming',
        link: SHOW_DRAFT_TOOLS ? '/parkcore' : null,
        emoji: '📏',
        label: 'Scale Ruler',
        x: 68, y: 62,
        w: 20, h: 8,
        hint: 'Measure twice, automate once',
    },
    {
        id: 'coffee',
        tool: null,
        full: 'Coffee',
        desc: 'Essential fuel. Still required even with GenFabTools.',
        color: '#78716c',
        emoji: '☕',
        label: 'Coffee',
        x: 82, y: 52,
        w: 8, h: 8,
        hint: 'Always necessary',
    },
    {
        id: 'sticky',
        tool: null,
        full: 'Sticky Notes',
        desc: '"TODO: Automate everything." — Every architect ever.',
        color: '#fbbf24',
        emoji: '📝',
        label: 'Sticky Notes',
        x: 12, y: 28,
        w: 10, h: 10,
        hint: '"Automate everything"',
    },
    {
        id: 'plant',
        tool: null,
        full: 'The Desk Plant',
        desc: 'The only living thing in the office that doesn\'t need a deadline.',
        color: '#22c55e',
        emoji: '🌱',
        label: 'Plant',
        x: 8, y: 72,
        w: 8, h: 8,
        hint: 'Thriving (unlike your schedule)',
    },
];

/* ── Desk Item Component ── */
function DeskItem({ item, mouseX, mouseY, onSelect, isSelected }) {
    const ref = useRef(null);
    const hasTool = !!item.tool;

    // Parallax offset based on position (items closer to center move less)
    const depth = hasTool ? 1.5 : 0.8;
    const offsetX = useTransform(mouseX, [0, 1], [-8 * depth, 8 * depth]);
    const offsetY = useTransform(mouseY, [0, 1], [-6 * depth, 6 * depth]);
    const springX = useSpring(offsetX, { stiffness: 150, damping: 25 });
    const springY = useSpring(offsetY, { stiffness: 150, damping: 25 });

    return (
        <motion.div
            ref={ref}
            className="absolute cursor-pointer group"
            style={{
                left: `${item.x}%`,
                top: `${item.y}%`,
                width: `${item.w}%`,
                height: `${item.h}%`,
                x: springX,
                y: springY,
                zIndex: isSelected ? 30 : hasTool ? 10 : 5,
            }}
            onClick={() => onSelect(item)}
            whileHover={{ scale: 1.08, zIndex: 20 }}
            transition={{ type: 'spring', stiffness: 300, damping: 20 }}
        >
            {/* Glow ring on hover */}
            <div className="absolute -inset-3 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
                style={{ boxShadow: `0 0 30px ${item.color}30, inset 0 0 20px ${item.color}10`, border: `1px solid ${item.color}30` }}
            />

            {/* Item body */}
            <div className="w-full h-full rounded-xl flex flex-col items-center justify-center text-center relative overflow-hidden border transition-all duration-300 group-hover:border-opacity-60"
                style={{
                    backgroundColor: `${item.color}08`,
                    borderColor: isSelected ? item.color : `${item.color}15`,
                    boxShadow: isSelected ? `0 0 20px ${item.color}25` : 'none',
                }}
            >
                <span className="text-2xl sm:text-4xl filter drop-shadow-lg">{item.emoji}</span>
                <span className="text-[9px] sm:text-[10px] font-mono mt-1 opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: item.color }}>
                    {item.tool || item.label}
                </span>
            </div>

            {/* Tooltip */}
            <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                <span className="text-[9px] font-mono px-2 py-0.5 rounded bg-black/80 border border-white/10" style={{ color: item.color }}>
                    {item.hint}
                </span>
            </div>

            {/* Live badge */}
            {item.status === 'live' && (
                <div className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-emerald-400 animate-pulse border-2 border-[#0a0a0f]" />
            )}
        </motion.div>
    );
}

/* ── Info Panel ── */
function InfoPanel({ item, onClose }) {
    if (!item) return null;

    return (
        <AnimatePresence>
            <motion.div
                key={item.id}
                className="fixed bottom-6 left-6 right-6 sm:left-auto sm:right-6 sm:w-[380px] z-50 bg-slate-900/95 border border-white/10 rounded-2xl p-6 backdrop-blur-xl shadow-2xl"
                initial={{ opacity: 0, y: 40, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 40, scale: 0.95 }}
                transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            >
                <button onClick={onClose} className="absolute top-3 right-3 w-6 h-6 rounded-full bg-white/5 flex items-center justify-center text-white/30 hover:text-white/60 transition-colors text-xs">
                    ✕
                </button>

                <div className="flex items-center gap-3 mb-4">
                    <span className="text-3xl">{item.emoji}</span>
                    <div>
                        <h3 className="font-bold text-white">{item.full}</h3>
                        {item.tool && (
                            <div className="flex items-center gap-2 mt-0.5">
                                <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: item.color }} />
                                <span className="text-[10px] font-bold tracking-widest uppercase" style={{ color: item.color }}>{item.tool}</span>
                                {item.status === 'live' && <span className="text-[10px] font-bold text-emerald-400 tracking-widest">● LIVE</span>}
                                {item.status === 'coming' && <span className="text-[10px] text-slate-600 tracking-widest">COMING SOON</span>}
                            </div>
                        )}
                    </div>
                </div>

                <p className="text-sm text-slate-400 leading-relaxed">{item.desc}</p>

                {item.link && (
                    <Link to={item.link} className="inline-flex items-center gap-2 mt-4 text-sm font-semibold hover:gap-3 transition-all" style={{ color: item.color }}>
                        Open {item.tool} →
                    </Link>
                )}
            </motion.div>
        </AnimatePresence>
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

export default function HomeV13() {
    const mouseX = useMotionValue(0.5);
    const mouseY = useMotionValue(0.5);
    const [selected, setSelected] = useState(null);

    function onMouseMove(e) {
        mouseX.set(e.clientX / window.innerWidth);
        mouseY.set(e.clientY / window.innerHeight);
    }

    return (
        <div className="bg-[#0a0a0f] text-white selection:bg-teal-400/30 overflow-x-hidden" onMouseMove={onMouseMove}>

            {/* ── Nav ── */}
            <motion.nav
                className="fixed top-0 left-0 right-0 z-50 px-6 py-3 flex items-center justify-between"
                style={{ backgroundColor: 'rgba(10,10,15,0.8)', backdropFilter: 'blur(12px)' }}
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
                    <Link to="/register" className="bg-white/5 hover:bg-white/10 text-white/70 px-4 py-2 rounded-full border border-white/[0.06] transition-all">
                        Get Started
                    </Link>
                </div>
            </motion.nav>

            {/* ── Hero: The Desk ── */}
            <section className="relative w-full h-screen pt-14 overflow-hidden">
                {/* Desk surface */}
                <div className="absolute inset-0" style={{
                    background: 'radial-gradient(ellipse at 50% 50%, rgba(30,25,20,0.3) 0%, rgba(10,10,15,1) 70%)',
                }} />

                {/* Wood grain texture */}
                <div className="absolute inset-0 opacity-[0.015]" style={{
                    backgroundImage: 'repeating-linear-gradient(90deg, transparent, transparent 40px, rgba(139,92,20,0.5) 40px, rgba(139,92,20,0.5) 41px)',
                }} />

                {/* Desk items */}
                <div className="relative w-full h-full max-w-6xl mx-auto">
                    {DESK_ITEMS.map(item => (
                        <DeskItem
                            key={item.id}
                            item={item}
                            mouseX={mouseX}
                            mouseY={mouseY}
                            onSelect={setSelected}
                            isSelected={selected?.id === item.id}
                        />
                    ))}
                </div>

                {/* Center branding overlay */}
                <motion.div
                    className="absolute top-[12%] left-1/2 -translate-x-1/2 text-center pointer-events-none"
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 1, delay: 0.5 }}
                >
                    <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-white/80">
                        Your desk.{' '}
                        <span className="text-white/20">Reimagined.</span>
                    </h1>
                    <p className="mt-2 text-sm text-white/25 font-light">
                        Every object is a tool. Hover to discover. Click to explore.
                    </p>
                </motion.div>

                {/* Legend */}
                <motion.div
                    className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-6"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 2, duration: 1 }}
                >
                    <div className="flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                        <span className="text-[10px] text-white/30 font-mono">LIVE TOOL</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full border border-white/20" />
                        <span className="text-[10px] text-white/30 font-mono">COMING SOON</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full bg-white/10" />
                        <span className="text-[10px] text-white/30 font-mono">DESK ITEM</span>
                    </div>
                </motion.div>
            </section>

            {/* Info panel */}
            {selected && <InfoPanel item={selected} onClose={() => setSelected(null)} />}

            {/* ── Below the desk: The pitch ── */}
            <section className="w-full py-28 lg:py-36 border-t border-white/5">
                <div className="px-6 sm:px-12 lg:px-20 max-w-4xl mx-auto">
                    <Reveal>
                        <h2 className="text-3xl sm:text-5xl font-extrabold tracking-tight leading-tight text-center">
                            Every tool on your desk
                            <br />
                            <span className="text-white/30">should be this smart.</span>
                        </h2>
                    </Reveal>

                    <div className="mt-16 grid sm:grid-cols-2 gap-6">
                        {DESK_ITEMS.filter(i => i.tool).map((item, idx) => (
                            <Reveal key={item.id} delay={idx * 0.08}>
                                <div className="bg-white/[0.02] border border-white/[0.05] rounded-xl p-6 hover:bg-white/[0.04] hover:border-white/10 transition-all h-full">
                                    <div className="flex items-center gap-3 mb-3">
                                        <span className="text-2xl">{item.emoji}</span>
                                        <div>
                                            <span className="font-bold text-white text-sm">{item.tool}</span>
                                            {item.status === 'live' && <span className="ml-2 text-[10px] text-emerald-400 font-bold">● LIVE</span>}
                                        </div>
                                    </div>
                                    <h3 className="font-semibold text-white/80 mb-1">{item.full}</h3>
                                    <p className="text-sm text-slate-500 leading-relaxed">{item.desc}</p>
                                    {item.link && (
                                        <Link to={item.link} className="inline-flex items-center gap-1.5 mt-3 text-xs font-semibold" style={{ color: item.color }}>
                                            Explore →
                                        </Link>
                                    )}
                                </div>
                            </Reveal>
                        ))}
                    </div>
                </div>
            </section>

            {/* ── CTA ── */}
            <section className="w-full py-24 lg:py-32 border-t border-white/5">
                <div className="px-6 sm:px-12 lg:px-20 text-center max-w-3xl mx-auto">
                    <Reveal>
                        <h2 className="text-4xl sm:text-5xl font-extrabold tracking-tight">
                            Clean up your workflow
                        </h2>
                        <p className="mt-4 text-slate-500 text-lg">
                            Start with RSI. Watch the desk transform.
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
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-600">
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
