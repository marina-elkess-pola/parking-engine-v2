import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { motion, useInView } from 'framer-motion';
import { SHOW_DRAFT_TOOLS } from './config/featureFlags';

/* ───────────────────────────────────────────────────────────
   VERSION 9 — "The Live Blueprint"
   The whole page IS an architectural drawing.
   Your cursor is a drafting pen — move it and walls auto-draw
   with dimension lines in real time. Tool info rendered as
   architectural room schedules. Title block holds the brand.
   Blueprint grid background throughout.
   ─────────────────────────────────────────────────────────── */

const BP = {
    bg: '#0c1929',
    grid: 'rgba(59,130,246,0.06)',
    gridMajor: 'rgba(59,130,246,0.12)',
    line: 'rgba(147,197,253,0.85)',
    lineFaint: 'rgba(147,197,253,0.3)',
    dim: 'rgba(147,197,253,0.5)',
    text: 'rgba(147,197,253,0.9)',
    textFaint: 'rgba(147,197,253,0.45)',
    accent: '#3b82f6',
    teal: '#14b8a6',
    white: 'rgba(255,255,255,0.92)',
};

/* ── TOOLS ── */
const TOOLS = [
    { id: 'rsi', name: 'RSI', full: 'RESIDENTIAL SCHEME INTELLIGENCE', desc: 'Efficiency scoring, financial feasibility, scheme comparison — live inside Revit.', status: 'LIVE', area: '48.2 m²', ref: 'GF-T001' },
    { id: 'sitegen', name: 'SiteGen', full: 'SITE GENERATOR', desc: 'Automated building massing and parking from site constraints.', status: 'DEV', area: '36.0 m²', ref: 'GF-T002' },
    { id: 'occucalc', name: 'OccuCalc', full: 'OCCUPANCY CALCULATOR', desc: 'Code-compliant occupant loads, calculated instantly.', status: 'DEV', area: '28.5 m²', ref: 'GF-T003' },
    { id: 'parkcore', name: 'ParkCore', full: 'PARKING CORE ENGINE', desc: 'Optimized parking layouts from boundary geometry.', status: 'DEV', area: '41.7 m²', ref: 'GF-T004' },
];

/* ── Blueprint Canvas — Live Drawing ── */
function BlueprintCanvas({ className }) {
    const canvasRef = useRef(null);
    const stateRef = useRef({
        mx: -1000, my: -1000,
        segments: [],       // completed wall segments
        current: null,      // in-progress segment from last click
        lastClick: null,
        trail: [],          // mouse trail for "pen" effect
    });

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const dpr = Math.min(window.devicePixelRatio, 2);
        let w, h;

        function resize() {
            w = canvas.offsetWidth;
            h = canvas.offsetHeight;
            canvas.width = w * dpr;
            canvas.height = h * dpr;
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        }
        resize();

        const S = stateRef.current;
        let frame;
        let t = 0;

        // Snap to grid
        const gridSnap = 20;
        function snap(v) { return Math.round(v / gridSnap) * gridSnap; }

        // Draw dimension line
        function drawDim(x1, y1, x2, y2) {
            const dx = x2 - x1;
            const dy = y2 - y1;
            const len = Math.sqrt(dx * dx + dy * dy);
            if (len < 30) return;

            const angle = Math.atan2(dy, dx);
            const perpX = -Math.sin(angle) * 12;
            const perpY = Math.cos(angle) * 12;

            ctx.save();
            ctx.strokeStyle = BP.dim;
            ctx.lineWidth = 0.5;
            ctx.setLineDash([3, 3]);

            // Extension lines
            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.lineTo(x1 + perpX, y1 + perpY);
            ctx.moveTo(x2, y2);
            ctx.lineTo(x2 + perpX, y2 + perpY);
            ctx.stroke();

            // Dimension line
            ctx.beginPath();
            ctx.moveTo(x1 + perpX, y1 + perpY);
            ctx.lineTo(x2 + perpX, y2 + perpY);
            ctx.stroke();
            ctx.setLineDash([]);

            // Ticks
            const tickLen = 4;
            ctx.lineWidth = 0.8;
            for (const [px, py] of [[x1 + perpX, y1 + perpY], [x2 + perpX, y2 + perpY]]) {
                ctx.beginPath();
                ctx.moveTo(px - Math.cos(angle + Math.PI / 4) * tickLen, py - Math.sin(angle + Math.PI / 4) * tickLen);
                ctx.lineTo(px + Math.cos(angle + Math.PI / 4) * tickLen, py + Math.sin(angle + Math.PI / 4) * tickLen);
                ctx.stroke();
            }

            // Text
            const midX = (x1 + x2) / 2 + perpX;
            const midY = (y1 + y2) / 2 + perpY;
            const meters = (len / 20).toFixed(1);
            ctx.font = '9px "Courier New", monospace';
            ctx.fillStyle = BP.dim;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'bottom';
            ctx.save();
            ctx.translate(midX, midY);
            let textAngle = angle;
            if (textAngle > Math.PI / 2) textAngle -= Math.PI;
            if (textAngle < -Math.PI / 2) textAngle += Math.PI;
            ctx.rotate(textAngle);
            ctx.fillText(`${meters}m`, 0, -4);
            ctx.restore();
            ctx.restore();
        }

        // Draw a wall segment
        function drawWall(x1, y1, x2, y2, thickness, alpha) {
            ctx.save();
            ctx.strokeStyle = BP.line.replace('0.85', String(alpha));
            ctx.lineWidth = thickness;
            ctx.lineCap = 'square';
            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
            ctx.stroke();

            // Hatch fill for thick walls
            if (thickness >= 3) {
                const dx = x2 - x1;
                const dy = y2 - y1;
                const len = Math.sqrt(dx * dx + dy * dy);
                const perpX = -dy / len;
                const perpY = dx / len;
                const half = thickness / 2;
                ctx.lineWidth = 0.3;
                ctx.strokeStyle = BP.lineFaint;
                const steps = Math.floor(len / 6);
                for (let i = 0; i <= steps; i++) {
                    const frac = i / steps;
                    const bx = x1 + dx * frac;
                    const by = y1 + dy * frac;
                    ctx.beginPath();
                    ctx.moveTo(bx + perpX * half, by + perpY * half);
                    ctx.lineTo(bx - perpX * half, by - perpY * half);
                    ctx.stroke();
                }
            }
            ctx.restore();
        }

        function animate() {
            frame = requestAnimationFrame(animate);
            t += 0.016;
            ctx.clearRect(0, 0, w, h);

            // Blueprint grid
            ctx.strokeStyle = BP.grid;
            ctx.lineWidth = 0.5;
            for (let x = 0; x < w; x += gridSnap) {
                ctx.beginPath();
                ctx.moveTo(x, 0);
                ctx.lineTo(x, h);
                ctx.stroke();
            }
            for (let y = 0; y < h; y += gridSnap) {
                ctx.beginPath();
                ctx.moveTo(0, y);
                ctx.lineTo(w, y);
                ctx.stroke();
            }
            // Major grid
            ctx.strokeStyle = BP.gridMajor;
            ctx.lineWidth = 0.5;
            for (let x = 0; x < w; x += gridSnap * 5) {
                ctx.beginPath();
                ctx.moveTo(x, 0);
                ctx.lineTo(x, h);
                ctx.stroke();
            }
            for (let y = 0; y < h; y += gridSnap * 5) {
                ctx.beginPath();
                ctx.moveTo(0, y);
                ctx.lineTo(w, y);
                ctx.stroke();
            }

            // Draw completed segments
            for (const seg of S.segments) {
                drawWall(seg.x1, seg.y1, seg.x2, seg.y2, 3, 0.85);
                drawDim(seg.x1, seg.y1, seg.x2, seg.y2);
            }

            // Draw current segment (mouse to last click)
            if (S.lastClick) {
                const sx = snap(S.mx);
                const sy = snap(S.my);
                // Guide lines
                ctx.save();
                ctx.strokeStyle = BP.lineFaint;
                ctx.lineWidth = 0.3;
                ctx.setLineDash([4, 4]);
                ctx.beginPath();
                ctx.moveTo(sx, 0);
                ctx.lineTo(sx, h);
                ctx.moveTo(0, sy);
                ctx.lineTo(w, sy);
                ctx.stroke();
                ctx.setLineDash([]);
                ctx.restore();

                drawWall(S.lastClick.x, S.lastClick.y, sx, sy, 2, 0.5);
                drawDim(S.lastClick.x, S.lastClick.y, sx, sy);
            }

            // Pen trail (fading ink effect)
            if (S.trail.length > 1) {
                ctx.save();
                ctx.lineWidth = 0.8;
                ctx.lineCap = 'round';
                for (let i = 1; i < S.trail.length; i++) {
                    const alpha = (i / S.trail.length) * 0.4;
                    ctx.strokeStyle = `rgba(147,197,253,${alpha})`;
                    ctx.beginPath();
                    ctx.moveTo(S.trail[i - 1].x, S.trail[i - 1].y);
                    ctx.lineTo(S.trail[i].x, S.trail[i].y);
                    ctx.stroke();
                }
                ctx.restore();
            }

            // Cursor crosshair
            if (S.mx > 0 && S.my > 0) {
                const sx = snap(S.mx);
                const sy = snap(S.my);
                ctx.save();
                ctx.strokeStyle = BP.teal;
                ctx.lineWidth = 0.8;
                // Small crosshair
                ctx.beginPath();
                ctx.moveTo(sx - 8, sy);
                ctx.lineTo(sx + 8, sy);
                ctx.moveTo(sx, sy - 8);
                ctx.lineTo(sx, sy + 8);
                ctx.stroke();
                // Coordinate label
                ctx.font = '9px "Courier New", monospace';
                ctx.fillStyle = BP.teal;
                ctx.textAlign = 'left';
                ctx.fillText(`(${(sx / 20).toFixed(1)}, ${(sy / 20).toFixed(1)})`, sx + 12, sy - 6);
                ctx.restore();
            }

            // Title block (bottom-right)
            const tbW = 220;
            const tbH = 80;
            const tbX = w - tbW - 20;
            const tbY = h - tbH - 20;
            ctx.save();
            ctx.strokeStyle = BP.lineFaint;
            ctx.lineWidth = 1;
            ctx.strokeRect(tbX, tbY, tbW, tbH);
            ctx.lineWidth = 0.5;
            ctx.beginPath();
            ctx.moveTo(tbX, tbY + 25);
            ctx.lineTo(tbX + tbW, tbY + 25);
            ctx.moveTo(tbX, tbY + 50);
            ctx.lineTo(tbX + tbW, tbY + 50);
            ctx.moveTo(tbX + tbW * 0.5, tbY + 50);
            ctx.lineTo(tbX + tbW * 0.5, tbY + tbH);
            ctx.stroke();

            ctx.font = 'bold 11px "Courier New", monospace';
            ctx.fillStyle = BP.text;
            ctx.textAlign = 'center';
            ctx.fillText('GENFABTOOLS', tbX + tbW / 2, tbY + 17);
            ctx.font = '8px "Courier New", monospace';
            ctx.fillStyle = BP.textFaint;
            ctx.fillText('AEC TOOL ECOSYSTEM — PLATFORM OVERVIEW', tbX + tbW / 2, tbY + 40);
            ctx.textAlign = 'left';
            ctx.fillText('DWG: GF-001', tbX + 6, tbY + 66);
            ctx.textAlign = 'right';
            ctx.fillText(`SCALE 1:${gridSnap}`, tbX + tbW - 6, tbY + 66);
            ctx.textAlign = 'left';

            const date = new Date();
            ctx.fillText(`DATE: ${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`, tbX + 6, tbY + tbH - 6);
            ctx.textAlign = 'right';
            ctx.fillText('REV: A', tbX + tbW - 6, tbY + tbH - 6);
            ctx.restore();

            // North arrow (top-right)
            const naX = w - 50;
            const naY = 50;
            ctx.save();
            ctx.strokeStyle = BP.lineFaint;
            ctx.fillStyle = BP.lineFaint;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(naX, naY - 18);
            ctx.lineTo(naX - 6, naY + 6);
            ctx.lineTo(naX, naY);
            ctx.lineTo(naX + 6, naY + 6);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
            ctx.font = 'bold 9px "Courier New", monospace';
            ctx.textAlign = 'center';
            ctx.fillText('N', naX, naY - 22);
            ctx.restore();

            // Instruction text (top-left)
            ctx.save();
            ctx.font = '10px "Courier New", monospace';
            ctx.fillStyle = BP.textFaint;
            ctx.textAlign = 'left';
            const pulse = 0.3 + Math.sin(t * 2) * 0.15;
            ctx.fillStyle = `rgba(147,197,253,${pulse})`;
            ctx.fillText('CLICK TO PLACE WALLS  •  MOVE CURSOR TO DRAFT  •  RIGHT-CLICK TO RESET', 20, 30);
            ctx.restore();

            // Trim trail
            while (S.trail.length > 60) S.trail.shift();
        }
        animate();

        function onMouseMove(e) {
            const rect = canvas.getBoundingClientRect();
            S.mx = e.clientX - rect.left;
            S.my = e.clientY - rect.top;
            S.trail.push({ x: S.mx, y: S.my });
        }
        function onClick(e) {
            if (e.button !== 0) return;
            const rect = canvas.getBoundingClientRect();
            const sx = snap(e.clientX - rect.left);
            const sy = snap(e.clientY - rect.top);

            if (S.lastClick) {
                S.segments.push({ x1: S.lastClick.x, y1: S.lastClick.y, x2: sx, y2: sy });
                if (S.segments.length > 80) S.segments.shift();
            }
            S.lastClick = { x: sx, y: sy };
        }
        function onContextMenu(e) {
            e.preventDefault();
            S.lastClick = null;
        }
        function onMouseLeave() {
            S.mx = -1000;
            S.my = -1000;
        }
        function onTouchMove(e) {
            if (e.touches.length) {
                const rect = canvas.getBoundingClientRect();
                S.mx = e.touches[0].clientX - rect.left;
                S.my = e.touches[0].clientY - rect.top;
                S.trail.push({ x: S.mx, y: S.my });
            }
        }
        function onTouchStart(e) {
            onTouchMove(e);
            if (e.touches.length) {
                const rect = canvas.getBoundingClientRect();
                const sx = snap(e.touches[0].clientX - rect.left);
                const sy = snap(e.touches[0].clientY - rect.top);
                if (S.lastClick) {
                    S.segments.push({ x1: S.lastClick.x, y1: S.lastClick.y, x2: sx, y2: sy });
                }
                S.lastClick = { x: sx, y: sy };
            }
        }

        canvas.addEventListener('mousemove', onMouseMove);
        canvas.addEventListener('click', onClick);
        canvas.addEventListener('contextmenu', onContextMenu);
        canvas.addEventListener('mouseleave', onMouseLeave);
        canvas.addEventListener('touchmove', onTouchMove, { passive: true });
        canvas.addEventListener('touchstart', onTouchStart, { passive: true });
        window.addEventListener('resize', resize);

        return () => {
            cancelAnimationFrame(frame);
            canvas.removeEventListener('mousemove', onMouseMove);
            canvas.removeEventListener('click', onClick);
            canvas.removeEventListener('contextmenu', onContextMenu);
            canvas.removeEventListener('mouseleave', onMouseLeave);
            canvas.removeEventListener('touchmove', onTouchMove);
            canvas.removeEventListener('touchstart', onTouchStart);
            window.removeEventListener('resize', resize);
        };
    }, []);

    return <canvas ref={canvasRef} className={className} style={{ cursor: 'crosshair', touchAction: 'none' }} />;
}

/* ── Reveal helper ── */
function Reveal({ children, className = '', delay = 0 }) {
    const ref = useRef(null);
    const inView = useInView(ref, { once: true, margin: '-40px' });
    return (
        <motion.div ref={ref} className={className}
            initial={{ opacity: 0, y: 20 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6, delay, ease: [0.22, 1, 0.36, 1] }}
        >{children}</motion.div>
    );
}

/* ── Room Schedule Row ── */
function ScheduleRow({ tool, index }) {
    const [hovered, setHovered] = useState(false);
    const isLive = tool.status === 'LIVE';
    const link = isLive ? '/rsi' : (SHOW_DRAFT_TOOLS ? `/${tool.id}` : null);

    const inner = (
        <div
            className={`group grid grid-cols-[60px_1fr_80px_60px_60px] items-center gap-4 px-4 py-3 border-b transition-colors duration-200 font-mono text-xs ${hovered ? 'bg-blue-500/[0.04] border-blue-400/20' : 'bg-transparent border-blue-400/[0.06]'
                }`}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
        >
            <span className="text-blue-300/40">{tool.ref}</span>
            <div>
                <span className="text-blue-200/90 font-bold tracking-wider">{tool.full}</span>
                <p className="text-blue-300/30 text-[10px] mt-0.5 leading-relaxed">{tool.desc}</p>
            </div>
            <span className="text-blue-300/50 text-right">{tool.area}</span>
            <span className={`text-center text-[10px] font-bold tracking-widest ${isLive ? 'text-emerald-400' : 'text-blue-300/25'}`}>
                {tool.status}
            </span>
            <span className="text-right text-blue-400/40">{String(index + 1).padStart(2, '0')}</span>
        </div>
    );

    if (link) {
        return <Link to={link} className="block">{inner}</Link>;
    }
    return inner;
}

export default function HomeV9() {
    return (
        <div className="text-blue-200 selection:bg-blue-400/30 overflow-x-hidden" style={{ backgroundColor: BP.bg }}>

            {/* ── Nav — Architectural title block style ── */}
            <motion.nav
                className="fixed top-0 left-0 right-0 z-50 px-5 py-3 flex items-center justify-between font-mono text-xs border-b border-blue-400/[0.08]"
                style={{ backgroundColor: 'rgba(12,25,41,0.85)', backdropFilter: 'blur(12px)' }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.8, delay: 0.3 }}
            >
                <Link to="/" className="flex items-center gap-3 group">
                    <div className="w-6 h-6 border border-blue-400/30 rounded-sm flex items-center justify-center">
                        <span className="text-[8px] font-bold text-blue-300/70">GF</span>
                    </div>
                    <div className="leading-tight">
                        <span className="text-blue-200/70 font-bold tracking-[0.15em] text-[11px]">GENFABTOOLS</span>
                        <span className="block text-blue-400/30 text-[8px] tracking-[0.2em]">AEC TOOL ECOSYSTEM</span>
                    </div>
                </Link>
                <div className="hidden sm:flex items-center gap-6">
                    <Link to="/tools" className="text-blue-300/40 hover:text-blue-200/80 transition-colors tracking-wider">TOOLS</Link>
                    <Link to="/rsi" className="text-blue-300/40 hover:text-blue-200/80 transition-colors tracking-wider">RSI</Link>
                    <Link to="/about" className="text-blue-300/40 hover:text-blue-200/80 transition-colors tracking-wider">ABOUT</Link>
                    <Link to="/register" className="border border-blue-400/20 text-blue-200/70 px-4 py-1.5 hover:bg-blue-500/10 hover:border-blue-400/40 transition-all tracking-wider">
                        START →
                    </Link>
                </div>
            </motion.nav>

            {/* ── Hero — Full-screen Blueprint Canvas ── */}
            <section className="relative w-full h-screen overflow-hidden">
                <BlueprintCanvas className="absolute inset-0 w-full h-full" />

                {/* Center content overlay */}
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none"
                    style={{ background: 'radial-gradient(ellipse at center, rgba(12,25,41,0.4), rgba(12,25,41,0.15) 70%)' }}
                >
                    <motion.div
                        className="text-center px-6"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 1, delay: 0.5 }}
                    >
                        <h1 className="font-mono text-4xl sm:text-6xl lg:text-7xl font-bold tracking-tight text-blue-100/90 leading-[1.1]">
                            DRAW THE
                            <br />
                            <span className="text-transparent bg-clip-text" style={{ backgroundImage: 'linear-gradient(to right, #93c5fd, #14b8a6)' }}>
                                FUTURE
                            </span>
                        </h1>
                        <p className="mt-4 font-mono text-xs sm:text-sm text-blue-300/40 tracking-wider max-w-md mx-auto leading-relaxed">
                            AN ECOSYSTEM OF INTELLIGENT AEC TOOLS.<br />
                            CLICK TO DRAW WALLS. SCROLL TO EXPLORE.
                        </p>
                        <div className="mt-8 flex flex-wrap justify-center gap-3 pointer-events-auto">
                            <Link
                                to="/tools"
                                className="font-mono text-xs border border-blue-400/30 text-blue-200/80 px-6 py-3 hover:bg-blue-500/10 hover:border-blue-400/50 transition-all tracking-[0.15em]"
                            >
                                EXPLORE TOOLS →
                            </Link>
                            <Link
                                to="/rsi"
                                className="font-mono text-xs bg-blue-500/10 border border-blue-400/15 text-blue-300/60 px-6 py-3 hover:bg-blue-500/15 transition-all tracking-[0.15em]"
                            >
                                VIEW RSI
                            </Link>
                        </div>
                    </motion.div>
                </div>

                {/* Scale bar (bottom-left) */}
                <motion.div
                    className="absolute bottom-8 left-8 font-mono text-[9px] text-blue-300/25"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 1.5 }}
                >
                    <div className="flex items-end gap-0">
                        <div className="w-[60px] h-[1px] bg-blue-400/20" />
                        <div className="w-[1px] h-[6px] bg-blue-400/20" />
                    </div>
                    <span className="block mt-1">3.0m</span>
                </motion.div>
            </section>

            {/* ── Room Schedule Section ── */}
            <section className="w-full py-20 lg:py-28" style={{ backgroundColor: 'rgba(12,25,41,0.95)' }}>
                <div className="px-6 sm:px-12 lg:px-20 max-w-5xl mx-auto">
                    <Reveal>
                        <div className="font-mono mb-10">
                            <div className="flex items-center gap-3 mb-2">
                                <div className="h-px flex-1 bg-blue-400/[0.08]" />
                                <span className="text-[10px] text-blue-300/30 tracking-[0.2em]">SHEET A-101</span>
                                <div className="h-px flex-1 bg-blue-400/[0.08]" />
                            </div>
                            <h2 className="text-2xl sm:text-3xl font-bold text-blue-100/80 tracking-tight text-center">
                                ROOM SCHEDULE — TOOLS
                            </h2>
                            <p className="text-center text-xs text-blue-300/25 tracking-wider mt-2">
                                GENFABTOOLS ECOSYSTEM — ALL REGISTERED UTILITIES
                            </p>
                        </div>
                    </Reveal>

                    {/* Schedule header */}
                    <Reveal delay={0.1}>
                        <div className="grid grid-cols-[60px_1fr_80px_60px_60px] items-center gap-4 px-4 py-2 border-y-2 border-blue-400/15 font-mono text-[10px] text-blue-300/30 tracking-wider">
                            <span>REF</span>
                            <span>NAME / DESCRIPTION</span>
                            <span className="text-right">AREA</span>
                            <span className="text-center">STATUS</span>
                            <span className="text-right">NO.</span>
                        </div>
                    </Reveal>

                    {/* Schedule rows */}
                    {TOOLS.map((tool, i) => (
                        <Reveal key={tool.id} delay={0.15 + i * 0.05}>
                            <ScheduleRow tool={tool} index={i} />
                        </Reveal>
                    ))}

                    {/* Schedule footer */}
                    <Reveal delay={0.4}>
                        <div className="grid grid-cols-[60px_1fr_80px_60px_60px] items-center gap-4 px-4 py-2 border-t-2 border-blue-400/15 font-mono text-[10px] text-blue-300/20 tracking-wider">
                            <span />
                            <span className="font-bold">TOTAL</span>
                            <span className="text-right font-bold">154.4 m²</span>
                            <span />
                            <span className="text-right font-bold">04</span>
                        </div>
                    </Reveal>

                    {/* More tools note */}
                    <Reveal delay={0.45}>
                        <div className="mt-6 font-mono text-[10px] text-blue-300/20 text-center tracking-wider">
                            NOTE: ADDITIONAL TOOLS IN DESIGN DEVELOPMENT. SCHEDULE WILL BE UPDATED UPON REGISTRATION.
                            <br />
                            <span className="text-blue-400/30">SEE REVISION CLOUD FOR PENDING ADDITIONS.</span>
                        </div>
                    </Reveal>
                </div>
            </section>

            {/* ── Drawing Notes Section — Architectural markup style ── */}
            <section className="w-full py-20 lg:py-28 border-t border-blue-400/[0.06]" style={{ backgroundColor: BP.bg }}>
                <div className="px-6 sm:px-12 lg:px-20 max-w-5xl mx-auto">
                    <Reveal>
                        <div className="font-mono mb-12">
                            <h2 className="text-xl sm:text-2xl font-bold text-blue-100/70 tracking-tight">
                                GENERAL NOTES
                            </h2>
                            <div className="h-px w-full bg-blue-400/[0.08] mt-3" />
                        </div>
                    </Reveal>

                    <div className="grid sm:grid-cols-2 gap-x-12 gap-y-6">
                        {[
                            { n: '1', text: 'ALL TOOLS IN THE GENFABTOOLS ECOSYSTEM ARE PURPOSE-BUILT FOR A SINGLE AEC BOTTLENECK. NO FEATURE BLOAT.' },
                            { n: '2', text: 'RSI (RESIDENTIAL SCHEME INTELLIGENCE) IS THE FIRST TOOL LIVE ON THE PLATFORM. OPERATES AS A REVIT ADD-IN.' },
                            { n: '3', text: 'EACH ANALYSIS COMPLETES IN UNDER 10 SECONDS. MANUAL EQUIVALENT TAKES 2-4 HOURS.' },
                            { n: '4', text: 'PLATFORM SUBSCRIPTION UNLOCKS ALL CURRENT AND FUTURE TOOLS. NO PER-TOOL PRICING.' },
                            { n: '5', text: 'ALL TOOLS OPERATE INSIDE YOUR EXISTING WORKFLOW — REVIT, BROWSER, OR API. NO NEW SOFTWARE TO LEARN.' },
                            { n: '6', text: 'ENTERPRISE-GRADE SECURITY, HARDWARE-LOCKED LICENSING, AND PRODUCTION RELIABILITY FROM DAY ONE.' },
                        ].map((note, i) => (
                            <Reveal key={i} delay={i * 0.05}>
                                <div className="flex gap-3 font-mono text-xs leading-relaxed">
                                    <span className="shrink-0 text-blue-400/40 font-bold">{note.n}.</span>
                                    <p className="text-blue-300/35 tracking-wide">{note.text}</p>
                                </div>
                            </Reveal>
                        ))}
                    </div>
                </div>
            </section>

            {/* ── Keynote Callout / CTA ── */}
            <section className="w-full py-24 lg:py-32 border-t border-blue-400/[0.06] relative overflow-hidden">
                <div className="absolute inset-0 opacity-[0.02]"
                    style={{
                        backgroundImage: `linear-gradient(${BP.accent} 1px, transparent 1px), linear-gradient(90deg, ${BP.accent} 1px, transparent 1px)`,
                        backgroundSize: '20px 20px',
                    }}
                />
                <div className="relative px-6 sm:px-12 lg:px-20 text-center max-w-3xl mx-auto">
                    <Reveal>
                        {/* Keynote bubble */}
                        <div className="inline-flex items-center justify-center w-12 h-12 border-2 border-blue-400/20 rounded-full font-mono text-lg font-bold text-blue-200/60 mb-8">
                            A
                        </div>
                        <h2 className="font-mono text-3xl sm:text-5xl font-bold tracking-tight text-blue-100/85 leading-tight">
                            START DESIGNING
                            <br />
                            <span className="text-blue-400/40">WITH INTELLIGENCE</span>
                        </h2>
                        <p className="mt-4 font-mono text-xs text-blue-300/30 tracking-wider max-w-md mx-auto">
                            JOIN THE ARCHITECTS AND ENGINEERS WHO AUTOMATE THEIR MOST REPETITIVE CALCULATIONS.
                        </p>
                        <div className="mt-10 flex flex-wrap justify-center gap-4">
                            <Link
                                to="/register"
                                className="font-mono text-xs border-2 border-blue-400/30 text-blue-100/80 px-8 py-3.5 hover:bg-blue-500/10 hover:border-blue-400/60 transition-all tracking-[0.15em] font-bold"
                            >
                                CREATE ACCOUNT →
                            </Link>
                            <Link
                                to="/login"
                                className="font-mono text-xs border border-blue-400/10 text-blue-300/40 px-8 py-3.5 hover:bg-blue-500/5 transition-all tracking-[0.15em]"
                            >
                                SIGN IN
                            </Link>
                        </div>
                    </Reveal>
                </div>
            </section>

            {/* ── Footer — Title block style ── */}
            <footer className="w-full border-t-2 border-blue-400/[0.08] py-6 px-6 sm:px-12 lg:px-20">
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 font-mono text-[10px] text-blue-300/20 tracking-wider max-w-5xl mx-auto">
                    <span>© {new Date().getFullYear()} GENFABTOOLS — ALL RIGHTS RESERVED</span>
                    <div className="flex gap-6">
                        <Link to="/contact" className="hover:text-blue-200/60 transition-colors">CONTACT</Link>
                        <Link to="/about" className="hover:text-blue-200/60 transition-colors">ABOUT</Link>
                        <Link to="/faq" className="hover:text-blue-200/60 transition-colors">FAQ</Link>
                    </div>
                    <span>DWG: GF-001 REV A</span>
                </div>
            </footer>
        </div>
    );
}
