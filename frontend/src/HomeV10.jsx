import React, { useRef, useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { motion, useScroll, useTransform, useInView, AnimatePresence } from 'framer-motion';
import { SHOW_DRAFT_TOOLS } from './config/featureFlags';

/* ───────────────────────────────────────────────────────────
   VERSION 10 — "The Building Section"
   Navigate the page like a building.
   Scroll = move between floors. Each floor is a tool.
   Architectural cross-section with tiny animated life.
   Top floors under construction (crane, scaffolding).
   Ground floor lobby = "Welcome to GenFabTools."
   ─────────────────────────────────────────────────────────── */

/* ── Building config ── */
const FLOORS = [
    {
        id: 'lobby',
        label: 'LOBBY',
        name: 'Welcome to GenFabTools',
        desc: 'An ecosystem of intelligent tools for the AEC industry. Each floor represents a tool in our platform.',
        color: '#64748b',
        bgColor: 'rgba(30,41,59,0.5)',
        features: ['Reception', 'Directory', 'Information'],
        people: ['🧑‍💼', '🧑‍💻', '👷'],
        furniture: ['🪑', '🖥️', '🏗️'],
        status: 'open',
    },
    {
        id: 'rsi',
        label: 'FLOOR 1',
        name: 'RSI — Residential Scheme Intelligence',
        desc: 'Efficiency scoring, financial feasibility, and scheme comparison — all running live inside Revit. What used to take hours now takes 10 seconds.',
        color: '#14b8a6',
        bgColor: 'rgba(20,184,166,0.04)',
        features: ['Efficiency Score', 'Financial Model', 'Scheme Compare'],
        people: ['🧑‍💻', '📊', '🏠'],
        furniture: ['🖥️', '📐', '📈'],
        status: 'live',
        link: '/rsi',
        image: '/images/rsi/project00.png',
    },
    {
        id: 'sitegen',
        label: 'FLOOR 2',
        name: 'SiteGen — Site Generator',
        desc: 'Automated building massing and parking layouts generated from site boundary constraints. From DXF in, optimized layout out.',
        color: '#3b82f6',
        bgColor: 'rgba(59,130,246,0.04)',
        features: ['Auto Massing', 'Parking Gen', 'Constraint Solver'],
        people: ['👷', '📐', '🔧'],
        furniture: ['🏗️', '📋', '🔨'],
        status: 'construction',
        link: SHOW_DRAFT_TOOLS ? '/sitegen' : null,
    },
    {
        id: 'occucalc',
        label: 'FLOOR 3',
        name: 'OccuCalc — Occupancy Calculator',
        desc: 'Code-compliant occupant load calculations from your floor plans, computed instantly. Never look up IBC tables again.',
        color: '#8b5cf6',
        bgColor: 'rgba(139,92,246,0.04)',
        features: ['IBC Lookup', 'Auto Calculate', 'Export Report'],
        people: ['📋', '🔢', '✅'],
        furniture: ['📊', '🧮', '📄'],
        status: 'construction',
        link: SHOW_DRAFT_TOOLS ? '/occucalc' : null,
    },
    {
        id: 'parkcore',
        label: 'FLOOR 4',
        name: 'ParkCore — Parking Core Engine',
        desc: 'Generate optimized parking layouts from any boundary geometry. ADA compliance, turning radii, stall counts — all automated.',
        color: '#f59e0b',
        bgColor: 'rgba(245,158,11,0.04)',
        features: ['Layout Optimizer', 'ADA Compliance', 'Stall Counter'],
        people: ['🚗', '📐', '🅿️'],
        furniture: ['🏗️', '🔧', '📏'],
        status: 'construction',
        link: SHOW_DRAFT_TOOLS ? '/parkcore' : null,
    },
    {
        id: 'roof',
        label: 'ROOF',
        name: 'The Future',
        desc: 'More tools are on the way. The building keeps growing. Every floor we add makes the whole platform more powerful.',
        color: '#06b6d4',
        bgColor: 'rgba(6,182,212,0.03)',
        features: ['More Tools', 'API Access', 'Integrations'],
        people: ['🏗️', '🔮', '🚀'],
        furniture: ['🏗️', '🔧'],
        status: 'future',
    },
];

/* ── Single Floor Component ── */
function FloorSection({ floor, index, total }) {
    const ref = useRef(null);
    const inView = useInView(ref, { margin: '-30% 0px -30% 0px' });
    const [expanded, setExpanded] = useState(false);
    const isTop = index === total - 1;
    const isBottom = index === 0;

    return (
        <section
            ref={ref}
            className="relative w-full min-h-screen flex items-center"
            style={{ backgroundColor: floor.bgColor }}
        >
            {/* ── Building structure — left side ── */}
            <div className="hidden lg:block absolute left-0 top-0 bottom-0 w-[120px]">
                {/* Column */}
                <div className="absolute left-[20px] top-0 bottom-0 w-[8px]" style={{ backgroundColor: 'rgba(148,163,184,0.08)' }}>
                    {/* Column hatching */}
                    <div className="absolute inset-0" style={{
                        backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 3px, rgba(148,163,184,0.04) 3px, rgba(148,163,184,0.04) 4px)',
                    }} />
                </div>
                {/* Second column */}
                <div className="absolute left-[80px] top-0 bottom-0 w-[8px]" style={{ backgroundColor: 'rgba(148,163,184,0.08)' }}>
                    <div className="absolute inset-0" style={{
                        backgroundImage: 'repeating-linear-gradient(-45deg, transparent, transparent 3px, rgba(148,163,184,0.04) 3px, rgba(148,163,184,0.04) 4px)',
                    }} />
                </div>

                {/* Floor slab (top line) */}
                <div className="absolute left-0 right-0 top-0 h-[3px] bg-slate-700/30" />

                {/* Floor label */}
                <div className="absolute left-[36px] top-1/2 -translate-y-1/2 -rotate-90 origin-center whitespace-nowrap">
                    <span className="text-[10px] font-mono font-bold tracking-[0.25em] text-slate-600/50">{floor.label}</span>
                </div>

                {/* Construction crane on top floor */}
                {isTop && (
                    <motion.div
                        className="absolute -top-2 left-[60px]"
                        animate={{ rotate: [-2, 2, -2] }}
                        transition={{ repeat: Infinity, duration: 6, ease: 'easeInOut' }}
                    >
                        <div className="text-3xl">🏗️</div>
                    </motion.div>
                )}
            </div>

            {/* ── Building structure — right side ── */}
            <div className="hidden lg:block absolute right-0 top-0 bottom-0 w-[120px]">
                <div className="absolute right-[20px] top-0 bottom-0 w-[8px]" style={{ backgroundColor: 'rgba(148,163,184,0.08)' }} />
                <div className="absolute right-[80px] top-0 bottom-0 w-[8px]" style={{ backgroundColor: 'rgba(148,163,184,0.08)' }} />
                <div className="absolute left-0 right-0 top-0 h-[3px] bg-slate-700/30" />

                {/* Window panes */}
                {!isTop && !isBottom && (
                    <div className="absolute right-[36px] top-[20%] bottom-[20%] w-[36px] border border-slate-700/15 rounded-sm overflow-hidden">
                        <div className="absolute inset-0 bg-gradient-to-b from-sky-500/[0.02] to-transparent" />
                        <div className="absolute top-1/2 left-0 right-0 h-px bg-slate-700/10" />
                        <div className="absolute left-1/2 top-0 bottom-0 w-px bg-slate-700/10" />
                    </div>
                )}
            </div>

            {/* ── Floor slab lines (top and bottom) ── */}
            <div className="absolute left-0 right-0 top-0 h-px bg-slate-700/20" />
            {isBottom && <div className="absolute left-0 right-0 bottom-0 h-[4px] bg-slate-700/30" />}

            {/* ── Floor content ── */}
            <div className="w-full px-6 sm:px-12 lg:px-[160px] py-20">
                <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={inView ? { opacity: 1, x: 0 } : { opacity: 0.3, x: -10 }}
                    transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                >
                    {/* Floor badge */}
                    <div className="flex items-center gap-3 mb-6">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: floor.color, boxShadow: `0 0 12px ${floor.color}40` }} />
                        <span className="font-mono text-[11px] font-bold tracking-[0.2em] uppercase" style={{ color: floor.color }}>
                            {floor.label}
                        </span>
                        {floor.status === 'live' && (
                            <span className="flex items-center gap-1 text-[10px] font-bold tracking-widest text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded-full">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> LIVE
                            </span>
                        )}
                        {floor.status === 'construction' && (
                            <span className="text-[10px] font-bold tracking-widest text-amber-400/60 bg-amber-400/5 px-2 py-0.5 rounded-full">
                                🔨 UNDER CONSTRUCTION
                            </span>
                        )}
                        {floor.status === 'future' && (
                            <span className="text-[10px] font-bold tracking-widest text-cyan-400/60 bg-cyan-400/5 px-2 py-0.5 rounded-full">
                                📋 PLANNED
                            </span>
                        )}
                    </div>

                    {/* Floor name */}
                    <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white/90 tracking-tight leading-tight mb-4">
                        {floor.name}
                    </h2>

                    {/* Description */}
                    <p className="text-base sm:text-lg text-slate-400 max-w-2xl leading-relaxed mb-8">
                        {floor.desc}
                    </p>

                    {/* Features as architectural keynotes */}
                    <div className="flex flex-wrap gap-3 mb-8">
                        {floor.features.map((feat, i) => (
                            <div
                                key={i}
                                className="flex items-center gap-2 border rounded-full px-3 py-1.5 text-xs font-mono tracking-wider"
                                style={{ borderColor: `${floor.color}25`, color: `${floor.color}90` }}
                            >
                                <span className="w-4 h-4 rounded-full border flex items-center justify-center text-[8px] font-bold"
                                    style={{ borderColor: `${floor.color}40` }}
                                >
                                    {i + 1}
                                </span>
                                {feat}
                            </div>
                        ))}
                    </div>

                    {/* Animated occupants */}
                    <div className="flex items-center gap-2 mb-8">
                        {floor.people.map((p, i) => (
                            <motion.span
                                key={i}
                                className="text-xl"
                                animate={{ y: [0, -4, 0] }}
                                transition={{ repeat: Infinity, duration: 2 + i * 0.3, delay: i * 0.5, ease: 'easeInOut' }}
                            >
                                {p}
                            </motion.span>
                        ))}
                        <span className="ml-2 text-[10px] font-mono text-slate-600 tracking-wider">
                            {floor.furniture.join('  ')}
                        </span>
                    </div>

                    {/* Screenshot if available */}
                    {floor.image && (
                        <motion.div
                            className="relative max-w-xl rounded-lg overflow-hidden border border-white/5 shadow-2xl shadow-black/30"
                            whileHover={{ scale: 1.01 }}
                            transition={{ duration: 0.3 }}
                        >
                            <img src={floor.image} alt={floor.name} className="w-full" loading="lazy" />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent pointer-events-none" />
                        </motion.div>
                    )}

                    {/* Construction scaffolding visual for under-construction floors */}
                    {floor.status === 'construction' && (
                        <div className="relative max-w-xl h-32 border border-dashed border-slate-700/20 rounded-lg flex items-center justify-center overflow-hidden">
                            <div className="absolute inset-0 opacity-[0.03]"
                                style={{
                                    backgroundImage: `repeating-linear-gradient(45deg, ${floor.color} 0px, ${floor.color} 1px, transparent 1px, transparent 12px)`,
                                }}
                            />
                            <span className="font-mono text-xs text-slate-600 tracking-wider">
                                ▦ AREA UNDER DEVELOPMENT — CHECK BACK SOON ▦
                            </span>
                        </div>
                    )}

                    {/* Link */}
                    {floor.link && (
                        <Link
                            to={floor.link}
                            className="inline-flex items-center gap-2 mt-6 text-sm font-semibold hover:gap-3 transition-all"
                            style={{ color: floor.color }}
                        >
                            Enter {floor.label === 'FLOOR 1' ? 'RSI' : floor.id} →
                        </Link>
                    )}
                </motion.div>
            </div>
        </section>
    );
}

/* ── Elevator indicator (side nav) ── */
function ElevatorIndicator() {
    const [activeFloor, setActiveFloor] = useState(0);

    useEffect(() => {
        function onScroll() {
            const scrollFrac = window.scrollY / (document.body.scrollHeight - window.innerHeight);
            const floorIdx = Math.round(scrollFrac * (FLOORS.length - 1));
            setActiveFloor(Math.min(floorIdx, FLOORS.length - 1));
        }
        window.addEventListener('scroll', onScroll, { passive: true });
        return () => window.removeEventListener('scroll', onScroll);
    }, []);

    return (
        <motion.div
            className="fixed right-6 top-1/2 -translate-y-1/2 z-40 hidden lg:flex flex-col-reverse items-center gap-1"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 1, duration: 0.6 }}
        >
            {/* Current floor display */}
            <div className="mt-3 w-10 h-10 border border-slate-700/30 rounded flex items-center justify-center font-mono text-xs font-bold text-white/60 bg-slate-900/80 backdrop-blur-sm">
                {activeFloor === 0 ? 'L' : activeFloor === FLOORS.length - 1 ? 'R' : activeFloor}
            </div>

            {/* Floor dots */}
            {FLOORS.map((floor, i) => (
                <button
                    key={floor.id}
                    onClick={() => {
                        const target = (i / (FLOORS.length - 1)) * (document.body.scrollHeight - window.innerHeight);
                        window.scrollTo({ top: target, behavior: 'smooth' });
                    }}
                    className="group relative w-4 h-4 flex items-center justify-center"
                    title={floor.label}
                >
                    <motion.div
                        className="w-2 h-2 rounded-full transition-all duration-300"
                        style={{
                            backgroundColor: i === activeFloor ? floor.color : 'rgba(148,163,184,0.15)',
                            boxShadow: i === activeFloor ? `0 0 8px ${floor.color}60` : 'none',
                        }}
                        animate={i === activeFloor ? { scale: [1, 1.3, 1] } : {}}
                        transition={{ repeat: i === activeFloor ? Infinity : 0, duration: 2 }}
                    />
                    {/* Tooltip */}
                    <span className="absolute right-6 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity text-[10px] font-mono text-white/50 bg-slate-900/90 px-2 py-1 rounded pointer-events-none">
                        {floor.label}
                    </span>
                </button>
            ))}

            {/* Arrow labels */}
            <div className="text-[8px] font-mono text-slate-600 tracking-widest mb-1">▲ UP</div>
        </motion.div>
    );
}

export default function HomeV10() {
    return (
        <div className="bg-[#0a0a0f] text-white selection:bg-teal-400/30 overflow-x-hidden">

            {/* ── Top Nav ── */}
            <motion.nav
                className="fixed top-0 left-0 right-0 z-50 px-6 lg:px-10 py-3 flex items-center justify-between border-b border-white/[0.04]"
                style={{ backgroundColor: 'rgba(10,10,15,0.9)', backdropFilter: 'blur(12px)' }}
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.3 }}
            >
                <Link to="/" className="flex items-center gap-2.5">
                    <img src="/genfabtools-logo.png" alt="" className="h-7 w-7 brightness-0 invert opacity-80" />
                    <div className="leading-tight">
                        <span className="text-xs font-bold text-white/80 tracking-wide">GenFabTools</span>
                        <span className="block text-[9px] text-white/25 font-mono tracking-widest">BUILDING TOOLS</span>
                    </div>
                </Link>
                <div className="hidden sm:flex items-center gap-6">
                    <Link to="/tools" className="text-xs text-white/40 hover:text-white/80 transition-colors font-mono tracking-wider">TOOLS</Link>
                    <Link to="/rsi" className="text-xs text-white/40 hover:text-white/80 transition-colors font-mono tracking-wider">RSI</Link>
                    <Link to="/about" className="text-xs text-white/40 hover:text-white/80 transition-colors font-mono tracking-wider">ABOUT</Link>
                    <Link to="/register" className="text-xs bg-white/5 hover:bg-white/10 text-white/70 px-4 py-2 rounded font-mono tracking-wider border border-white/[0.06] transition-all">
                        ENTER BUILDING →
                    </Link>
                </div>
            </motion.nav>

            {/* ── Elevator indicator ── */}
            <ElevatorIndicator />

            {/* ── Floors (bottom to top, rendered top to bottom in DOM, reversed visually) ── */}
            <div className="pt-14">
                {FLOORS.map((floor, i) => (
                    <FloorSection key={floor.id} floor={floor} index={i} total={FLOORS.length} />
                ))}
            </div>

            {/* ── Ground level / CTA ── */}
            <section className="relative w-full py-28 border-t-4 border-slate-700/20 overflow-hidden" style={{ backgroundColor: 'rgba(10,10,15,0.95)' }}>
                {/* Ground texture */}
                <div className="absolute bottom-0 left-0 right-0 h-4" style={{
                    backgroundImage: 'repeating-linear-gradient(90deg, rgba(148,163,184,0.1) 0px, rgba(148,163,184,0.1) 2px, transparent 2px, transparent 20px)',
                }} />

                <div className="relative px-6 sm:px-12 lg:px-20 text-center max-w-3xl mx-auto">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.7 }}
                    >
                        <div className="inline-flex items-center gap-2 bg-white/[0.03] border border-white/[0.06] rounded-full px-4 py-1.5 mb-8">
                            <span className="text-[10px] font-mono text-white/40 tracking-wider">EXIT → STREET LEVEL</span>
                        </div>

                        <h2 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-white/90 leading-tight">
                            Ready to take
                            <br />
                            the elevator up?
                        </h2>
                        <p className="mt-4 text-slate-500 max-w-md mx-auto">
                            Create your account and start exploring the building. RSI is open on Floor 1. More floors opening soon.
                        </p>

                        <div className="mt-10 flex flex-wrap justify-center gap-4">
                            <Link
                                to="/register"
                                className="bg-white text-slate-900 px-8 py-3.5 rounded-full text-sm font-bold hover:shadow-xl hover:shadow-white/10 transition-all hover:-translate-y-0.5"
                            >
                                Create free account
                            </Link>
                            <Link
                                to="/rsi"
                                className="bg-white/5 border border-white/10 text-white/70 px-8 py-3.5 rounded-full text-sm font-semibold hover:bg-white/10 transition-all"
                            >
                                Visit Floor 1 — RSI
                            </Link>
                        </div>

                        {/* Building count */}
                        <div className="mt-16 flex justify-center gap-8 text-center">
                            {[
                                { n: FLOORS.length - 1, label: 'Active floors' },
                                { n: '1', label: 'Open now' },
                                { n: '∞', label: 'Floors possible' },
                            ].map((stat, i) => (
                                <div key={i}>
                                    <p className="text-2xl font-extrabold text-white/80">{stat.n}</p>
                                    <p className="text-[10px] font-mono text-slate-600 tracking-wider mt-1">{stat.label}</p>
                                </div>
                            ))}
                        </div>
                    </motion.div>
                </div>
            </section>

            {/* ── Footer ── */}
            <footer className="w-full border-t border-white/5 py-6 px-6 sm:px-12 lg:px-20">
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600 max-w-5xl mx-auto">
                    <span className="font-mono text-[10px]">© {new Date().getFullYear()} GENFABTOOLS</span>
                    <div className="flex gap-6 font-mono text-[10px] tracking-wider">
                        <Link to="/contact" className="hover:text-white transition-colors">CONTACT</Link>
                        <Link to="/about" className="hover:text-white transition-colors">ABOUT</Link>
                        <Link to="/faq" className="hover:text-white transition-colors">FAQ</Link>
                    </div>
                </div>
            </footer>
        </div>
    );
}
