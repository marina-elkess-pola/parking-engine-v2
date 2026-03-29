import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { SHOW_DRAFT_TOOLS } from './config/featureFlags';

/* ───────────────────────────────────────────────────────────
   VERSION 11 — "The Terminal"
   The entire homepage is a command-line interface.
   Text auto-types on load, users can type real commands.
   Green/teal monospace on near-black. Feels like hacking
   into the future of architecture.
   ─────────────────────────────────────────────────────────── */

const BRAND = { bg: '#0c0c0c', text: '#a3e635', dim: '#4d7c0f', accent: '#14b8a6', border: '#1a2e05' };

/* ── Command registry ── */
const COMMANDS = {
    help: () => [
        {
            type: 'table', rows: [
                ['help', 'Show available commands'],
                ['about', 'About GenFabTools'],
                ['tools', 'List all tools in the ecosystem'],
                ['rsi', 'Residential Scheme Intelligence details'],
                ['sitegen', 'Site Generator details'],
                ['occucalc', 'Occupancy Calculator details'],
                ['parkcore', 'Parking Core Engine details'],
                ['stats', 'Platform statistics'],
                ['signup', 'Create a free account'],
                ['login', 'Sign in to your account'],
                ['clear', 'Clear terminal'],
                ['matrix', 'Why not?'],
            ]
        },
    ],
    about: () => [
        { type: 'text', value: '╔══════════════════════════════════════════════════╗' },
        { type: 'text', value: '║          G E N F A B T O O L S                   ║' },
        { type: 'text', value: '║      AEC Tool Ecosystem Platform                 ║' },
        { type: 'text', value: '╚══════════════════════════════════════════════════╝' },
        { type: 'text', value: '' },
        { type: 'text', value: 'GenFabTools builds purpose-built intelligent utilities' },
        { type: 'text', value: 'for the Architecture, Engineering, and Construction' },
        { type: 'text', value: 'industry. Each tool targets a single workflow bottleneck.' },
        { type: 'text', value: '' },
        { type: 'text', value: 'No feature bloat. No new software to learn.' },
        { type: 'text', value: 'Just tools that work inside your existing workflow.' },
    ],
    tools: () => [
        { type: 'text', value: '┌─────────────┬────────────────────────────────┬────────┐' },
        { type: 'text', value: '│ ID          │ NAME                           │ STATUS │' },
        { type: 'text', value: '├─────────────┼────────────────────────────────┼────────┤' },
        { type: 'highlight', value: '│ rsi         │ Residential Scheme Intelligence │ ● LIVE │', color: BRAND.accent },
        { type: 'text', value: '│ sitegen     │ Site Generator                 │ ○ DEV  │' },
        { type: 'text', value: '│ occucalc    │ Occupancy Calculator           │ ○ DEV  │' },
        { type: 'text', value: '│ parkcore    │ Parking Core Engine            │ ○ DEV  │' },
        { type: 'text', value: '└─────────────┴────────────────────────────────┴────────┘' },
        { type: 'text', value: '' },
        { type: 'dim', value: '  4 tools registered · 1 live · 3 in development' },
        { type: 'dim', value: '  Type a tool ID for details (e.g. "rsi")' },
    ],
    rsi: () => [
        { type: 'highlight', value: '■ RSI — Residential Scheme Intelligence', color: '#14b8a6' },
        { type: 'text', value: '  Status: ● LIVE' },
        { type: 'text', value: '  Type:   Revit Add-in + Web Dashboard' },
        { type: 'text', value: '  Price:  $49/month' },
        { type: 'text', value: '' },
        { type: 'text', value: '  Efficiency scoring, financial feasibility analysis,' },
        { type: 'text', value: '  and scheme comparison — running live inside Revit.' },
        { type: 'text', value: '' },
        { type: 'text', value: '  What used to take 2-4 hours now takes <10 seconds.' },
        { type: 'text', value: '' },
        { type: 'dim', value: '  Features: Efficiency Score · Financial Model · Scheme Compare' },
        { type: 'link', value: '  → Type "signup" to get started, or visit /rsi', href: '/rsi' },
    ],
    sitegen: () => [
        { type: 'highlight', value: '■ SiteGen — Site Generator', color: '#3b82f6' },
        { type: 'text', value: '  Status: ○ In Development' },
        { type: 'text', value: '' },
        { type: 'text', value: '  Automated building massing and parking layouts' },
        { type: 'text', value: '  generated from site boundary constraints.' },
        { type: 'text', value: '  DXF in → optimized layout out.' },
        { type: 'dim', value: '  ETA: Coming soon. Sign up for early access.' },
    ],
    occucalc: () => [
        { type: 'highlight', value: '■ OccuCalc — Occupancy Calculator', color: '#8b5cf6' },
        { type: 'text', value: '  Status: ○ In Development' },
        { type: 'text', value: '' },
        { type: 'text', value: '  Code-compliant occupant load calculations' },
        { type: 'text', value: '  from your floor plans, computed instantly.' },
        { type: 'text', value: '  Never look up IBC tables by hand again.' },
        { type: 'dim', value: '  ETA: Coming soon. Sign up for early access.' },
    ],
    parkcore: () => [
        { type: 'highlight', value: '■ ParkCore — Parking Core Engine', color: '#f59e0b' },
        { type: 'text', value: '  Status: ○ In Development' },
        { type: 'text', value: '' },
        { type: 'text', value: '  Optimized parking layouts from any boundary geometry.' },
        { type: 'text', value: '  ADA compliance, turning radii, stall counts.' },
        { type: 'dim', value: '  ETA: Coming soon. Sign up for early access.' },
    ],
    stats: () => [
        { type: 'text', value: '┌───────────────────────────────────────┐' },
        { type: 'text', value: '│ PLATFORM STATISTICS                   │' },
        { type: 'text', value: '├───────────────────────────────────────┤' },
        { type: 'text', value: '│ Tools in ecosystem:        4          │' },
        { type: 'highlight', value: '│ Live now:                  1 (RSI)    │', color: BRAND.accent },
        { type: 'text', value: '│ In development:            3          │' },
        { type: 'text', value: '│ Avg analysis time:         <10s       │' },
        { type: 'text', value: '│ Manual equivalent:         2-4 hours  │' },
        { type: 'text', value: '│ Speed improvement:         10×+       │' },
        { type: 'text', value: '└───────────────────────────────────────┘' },
    ],
    matrix: () => {
        const chars = 'GENFABTOOLS RSI SITEGEN OCCUCALC PARKCORE AEC'.split('');
        const lines = [];
        for (let i = 0; i < 8; i++) {
            let line = '';
            for (let j = 0; j < 50; j++) {
                line += chars[Math.floor(Math.random() * chars.length)];
            }
            lines.push({ type: 'highlight', value: line, color: '#14b8a6' });
        }
        lines.push({ type: 'text', value: '' });
        lines.push({ type: 'dim', value: '  There is no spoon. But there are very good AEC tools.' });
        return lines;
    },
};

/* ── Auto-typing effect ── */
function useAutoType(lines, speed = 25) {
    const [displayed, setDisplayed] = useState([]);
    const [done, setDone] = useState(false);

    useEffect(() => {
        let cancelled = false;
        let lineIdx = 0;
        let charIdx = 0;
        const current = [];

        function tick() {
            if (cancelled) return;
            if (lineIdx >= lines.length) { setDone(true); return; }

            const line = lines[lineIdx];
            if (charIdx === 0) current.push({ ...line, value: '' });

            const fullText = line.value || '';
            if (charIdx <= fullText.length) {
                current[current.length - 1] = { ...line, value: fullText.slice(0, charIdx) };
                setDisplayed([...current]);
                charIdx++;
                setTimeout(tick, line.fast ? 5 : speed);
            } else {
                lineIdx++;
                charIdx = 0;
                setTimeout(tick, line.pause || 60);
            }
        }
        tick();
        return () => { cancelled = true; };
    }, []);

    return { displayed, done };
}

/* ── Terminal Line Renderer ── */
function TermLine({ line }) {
    if (!line) return null;
    const base = 'font-mono text-sm whitespace-pre leading-relaxed';
    switch (line.type) {
        case 'prompt':
            return <div className={base}><span style={{ color: BRAND.accent }}>$ </span><span style={{ color: BRAND.text }}>{line.value}</span></div>;
        case 'highlight':
            return <div className={base} style={{ color: line.color || BRAND.accent }}>{line.value}</div>;
        case 'dim':
            return <div className={`${base} opacity-40`} style={{ color: BRAND.text }}>{line.value}</div>;
        case 'link':
            return <div className={base} style={{ color: BRAND.accent }}>{line.value}</div>;
        case 'table':
            return (
                <div className="my-1">
                    {line.rows.map(([cmd, desc], i) => (
                        <div key={i} className={`${base} grid grid-cols-[120px_1fr]`}>
                            <span style={{ color: BRAND.accent }}>  {cmd}</span>
                            <span style={{ color: BRAND.text }} className="opacity-60">{desc}</span>
                        </div>
                    ))}
                </div>
            );
        default:
            return <div className={base} style={{ color: BRAND.text }}>{line.value}</div>;
    }
}

/* ── Main Component ── */
export default function HomeV11() {
    const navigate = useNavigate();
    const [history, setHistory] = useState([]);
    const [input, setInput] = useState('');
    const [cmdHistory, setCmdHistory] = useState([]);
    const [cmdIdx, setCmdIdx] = useState(-1);
    const inputRef = useRef(null);
    const bottomRef = useRef(null);
    const containerRef = useRef(null);

    // Boot sequence
    const bootLines = [
        { type: 'dim', value: '  GenFabTools Platform v1.0.0', fast: true },
        { type: 'dim', value: `  Booting... ${new Date().toISOString()}`, fast: true },
        { type: 'text', value: '', pause: 200 },
        { type: 'text', value: '╔══════════════════════════════════════════════════════════╗' },
        { type: 'text', value: '║                                                          ║' },
        { type: 'text', value: '║     ██████  ███████ ███    ██ ███████  █████  ██████      ║' },
        { type: 'text', value: '║    ██       ██      ████   ██ ██      ██   ██ ██   ██     ║' },
        { type: 'highlight', value: '║    ██   ███ █████   ██ ██  ██ █████   ███████ ██████      ║', color: BRAND.accent },
        { type: 'highlight', value: '║    ██    ██ ██      ██  ██ ██ ██      ██   ██ ██   ██     ║', color: BRAND.accent },
        { type: 'text', value: '║     ██████  ███████ ██   ████ ██      ██   ██ ██████      ║' },
        { type: 'text', value: '║                                                          ║' },
        { type: 'dim', value: '║             TOOLS · FOR · THE · BUILT · WORLD             ║' },
        { type: 'text', value: '║                                                          ║' },
        { type: 'text', value: '╚══════════════════════════════════════════════════════════╝' },
        { type: 'text', value: '', pause: 300 },
        { type: 'text', value: '  Welcome to the GenFabTools ecosystem.' },
        { type: 'text', value: '  An intelligent platform of AEC utilities.' },
        { type: 'text', value: '', pause: 100 },
        { type: 'dim', value: '  Loading tools...' },
        { type: 'highlight', value: '  ✓ RSI           [LIVE]   Residential Scheme Intelligence', color: BRAND.accent },
        { type: 'text', value: '  ○ SiteGen       [DEV]    Site Generator' },
        { type: 'text', value: '  ○ OccuCalc      [DEV]    Occupancy Calculator' },
        { type: 'text', value: '  ○ ParkCore      [DEV]    Parking Core Engine' },
        { type: 'text', value: '', pause: 200 },
        { type: 'dim', value: '  4 tools registered. 1 live. 3 in development.' },
        { type: 'text', value: '' },
        { type: 'highlight', value: '  Type "help" for commands, or start typing.', color: BRAND.accent },
        { type: 'text', value: '' },
    ];

    const { displayed: bootDisplayed, done: bootDone } = useAutoType(bootLines);

    // Execute command
    const execCommand = useCallback((cmd) => {
        const trimmed = cmd.trim().toLowerCase();
        const newHistory = [...history, { type: 'prompt', value: cmd }];

        if (trimmed === 'clear') {
            setHistory([]);
            return;
        }
        if (trimmed === 'signup' || trimmed === 'register') {
            setHistory([...newHistory, { type: 'highlight', value: '  Redirecting to registration...', color: BRAND.accent }]);
            setTimeout(() => navigate('/register'), 600);
            return;
        }
        if (trimmed === 'login') {
            setHistory([...newHistory, { type: 'highlight', value: '  Redirecting to login...', color: BRAND.accent }]);
            setTimeout(() => navigate('/login'), 600);
            return;
        }

        const handler = COMMANDS[trimmed];
        if (handler) {
            const output = handler();
            setHistory([...newHistory, ...output, { type: 'text', value: '' }]);
        } else {
            setHistory([...newHistory,
            { type: 'text', value: `  Command not found: ${trimmed}` },
            { type: 'dim', value: '  Type "help" for available commands.' },
            { type: 'text', value: '' },
            ]);
        }
        setCmdHistory(prev => [cmd, ...prev]);
        setCmdIdx(-1);
    }, [history, navigate]);

    // Auto-scroll
    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [history, bootDisplayed]);

    // Focus input on click anywhere
    function focusInput() {
        inputRef.current?.focus();
    }

    // Key handling
    function onKeyDown(e) {
        if (e.key === 'Enter' && input.trim()) {
            execCommand(input);
            setInput('');
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            if (cmdHistory.length > 0) {
                const next = Math.min(cmdIdx + 1, cmdHistory.length - 1);
                setCmdIdx(next);
                setInput(cmdHistory[next]);
            }
        } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            if (cmdIdx > 0) {
                setCmdIdx(cmdIdx - 1);
                setInput(cmdHistory[cmdIdx - 1]);
            } else {
                setCmdIdx(-1);
                setInput('');
            }
        } else if (e.key === 'Tab') {
            e.preventDefault();
            const partial = input.trim().toLowerCase();
            const match = Object.keys(COMMANDS).find(c => c.startsWith(partial));
            if (match) setInput(match);
        }
    }

    return (
        <div
            ref={containerRef}
            className="min-h-screen w-full font-mono cursor-text"
            style={{ backgroundColor: BRAND.bg }}
            onClick={focusInput}
        >
            {/* Top bar */}
            <div className="sticky top-0 z-50 flex items-center gap-2 px-4 py-2 border-b" style={{ backgroundColor: '#111', borderColor: BRAND.border }}>
                <div className="flex gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-red-500/70" />
                    <div className="w-3 h-3 rounded-full bg-yellow-500/70" />
                    <div className="w-3 h-3 rounded-full bg-green-500/70" />
                </div>
                <span className="text-xs ml-3 opacity-40" style={{ color: BRAND.text }}>genfabtools — bash — 120×40</span>
                <div className="ml-auto flex gap-4">
                    <Link to="/rsi" className="text-[10px] opacity-30 hover:opacity-70 transition-opacity" style={{ color: BRAND.accent }}>RSI</Link>
                    <Link to="/tools" className="text-[10px] opacity-30 hover:opacity-70 transition-opacity" style={{ color: BRAND.accent }}>TOOLS</Link>
                    <Link to="/register" className="text-[10px] opacity-30 hover:opacity-70 transition-opacity" style={{ color: BRAND.accent }}>SIGNUP</Link>
                </div>
            </div>

            {/* Terminal body */}
            <div className="px-4 sm:px-8 py-4 max-w-5xl mx-auto">
                {/* Boot sequence */}
                {bootDisplayed.map((line, i) => (
                    <TermLine key={`boot-${i}`} line={line} />
                ))}

                {/* Command history */}
                {history.map((line, i) => (
                    <TermLine key={`hist-${i}`} line={line} />
                ))}

                {/* Input line */}
                {bootDone && (
                    <div className="flex items-center text-sm">
                        <span style={{ color: BRAND.accent }}>$ </span>
                        <input
                            ref={inputRef}
                            type="text"
                            value={input}
                            onChange={e => setInput(e.target.value)}
                            onKeyDown={onKeyDown}
                            className="flex-1 bg-transparent outline-none ml-1 caret-lime-400"
                            style={{ color: BRAND.text, caretColor: BRAND.accent }}
                            autoFocus
                            spellCheck={false}
                            autoComplete="off"
                        />
                        <motion.span
                            className="w-2 h-4 ml-0.5"
                            style={{ backgroundColor: BRAND.accent }}
                            animate={{ opacity: [1, 0, 1] }}
                            transition={{ repeat: Infinity, duration: 1 }}
                        />
                    </div>
                )}

                <div ref={bottomRef} />
            </div>

            {/* Scanline effect */}
            <div className="fixed inset-0 pointer-events-none z-40 opacity-[0.03]"
                style={{
                    backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.3) 2px, rgba(0,0,0,0.3) 4px)',
                }}
            />
        </div>
    );
}
