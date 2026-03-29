import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { motion, useInView, AnimatePresence } from 'framer-motion';
import { SHOW_DRAFT_TOOLS } from './config/featureFlags';

/* ───────────────────────────────────────────────────────────
   VERSION 15 — "The Gravity Playground"
   A 2D physics sandbox. Tool-colored blocks fall with
   realistic gravity, collide, stack. Grab and throw them.
   Click to spawn. Each block is a tool. Double-click for info.
   Shake mouse for earthquake. Pure Canvas 2D physics.
   ─────────────────────────────────────────────────────────── */

const TOOL_DEFS = [
    { id: 'rsi', name: 'RSI', full: 'Residential Scheme Intelligence', color: '#14b8a6', status: 'live', link: '/rsi' },
    { id: 'sitegen', name: 'SiteGen', full: 'Site Generator', color: '#3b82f6', status: 'coming' },
    { id: 'occucalc', name: 'OccuCalc', full: 'Occupancy Calculator', color: '#8b5cf6', status: 'coming' },
    { id: 'parkcore', name: 'ParkCore', full: 'Parking Core Engine', color: '#f59e0b', status: 'coming' },
];

function hexToRgb(hex) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return { r, g, b };
}

/* ── Physics Canvas ── */
function PhysicsCanvas({ className, onBlockSelect }) {
    const canvasRef = useRef(null);
    const stateRef = useRef({
        blocks: [],
        mx: 0, my: 0,
        pmx: 0, pmy: 0,
        mouseSpeed: 0,
        grabbed: null,
        grabOffset: { x: 0, y: 0 },
        mouseDown: false,
        lastSpawn: 0,
        earthquake: 0,
        dblClick: null,
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
        const gravity = 800;
        const bounce = 0.5;
        const friction = 0.98;
        const airFriction = 0.999;

        function createBlock(x, y, vx = 0, vy = 0) {
            const tool = TOOL_DEFS[Math.floor(Math.random() * TOOL_DEFS.length)];
            const size = 40 + Math.random() * 30;
            return {
                x, y, vx, vy,
                w: size * (0.8 + Math.random() * 0.4),
                h: size * (0.8 + Math.random() * 0.4),
                rotation: (Math.random() - 0.5) * 0.4,
                angVel: (Math.random() - 0.5) * 2,
                tool,
                id: Date.now() + Math.random(),
                alpha: 1,
            };
        }

        // Spawn initial blocks
        for (let i = 0; i < 12; i++) {
            const x = 80 + Math.random() * (w - 160);
            const y = -50 - Math.random() * 600;
            S.blocks.push(createBlock(x, y, (Math.random() - 0.5) * 100, Math.random() * 50));
        }

        let frame;
        let lastTime = performance.now();

        function animate(now) {
            frame = requestAnimationFrame(animate);
            const dt = Math.min((now - lastTime) / 1000, 0.033);
            lastTime = now;

            ctx.clearRect(0, 0, w, h);

            // Mouse speed tracking
            const dx = S.mx - S.pmx;
            const dy = S.my - S.pmy;
            S.mouseSpeed = Math.sqrt(dx * dx + dy * dy);
            S.pmx = S.mx;
            S.pmy = S.my;

            // Earthquake detection (fast mouse movement)
            if (S.mouseSpeed > 40) {
                S.earthquake = Math.min(S.earthquake + dt * 3, 1);
            } else {
                S.earthquake = Math.max(S.earthquake - dt * 0.5, 0);
            }

            // Draw subtle grid
            ctx.strokeStyle = 'rgba(255,255,255,0.015)';
            ctx.lineWidth = 0.5;
            for (let x = 0; x < w; x += 40) {
                ctx.beginPath();
                ctx.moveTo(x, 0);
                ctx.lineTo(x, h);
                ctx.stroke();
            }
            for (let y = 0; y < h; y += 40) {
                ctx.beginPath();
                ctx.moveTo(0, y);
                ctx.lineTo(w, y);
                ctx.stroke();
            }

            // Ground
            ctx.fillStyle = 'rgba(255,255,255,0.02)';
            ctx.fillRect(0, h - 3, w, 3);

            // Update & draw blocks
            for (const b of S.blocks) {
                if (S.grabbed === b) {
                    // Follow mouse with throwing velocity
                    const targetX = S.mx - S.grabOffset.x;
                    const targetY = S.my - S.grabOffset.y;
                    b.vx = (targetX - b.x) * 15;
                    b.vy = (targetY - b.y) * 15;
                    b.x = targetX;
                    b.y = targetY;
                    b.angVel *= 0.9;
                } else {
                    // Gravity
                    b.vy += gravity * dt;

                    // Earthquake shake
                    if (S.earthquake > 0.1) {
                        b.vx += (Math.random() - 0.5) * S.earthquake * 2000 * dt;
                        b.vy -= Math.random() * S.earthquake * 600 * dt;
                    }

                    // Air friction
                    b.vx *= airFriction;
                    b.vy *= airFriction;

                    // Move
                    b.x += b.vx * dt;
                    b.y += b.vy * dt;
                    b.rotation += b.angVel * dt;
                    b.angVel *= 0.995;

                    // Floor collision
                    if (b.y + b.h / 2 > h - 3) {
                        b.y = h - 3 - b.h / 2;
                        b.vy *= -bounce;
                        b.vx *= friction;
                        b.angVel *= 0.8;
                        if (Math.abs(b.vy) < 10) b.vy = 0;
                    }

                    // Wall collisions
                    if (b.x - b.w / 2 < 0) {
                        b.x = b.w / 2;
                        b.vx *= -bounce;
                    }
                    if (b.x + b.w / 2 > w) {
                        b.x = w - b.w / 2;
                        b.vx *= -bounce;
                    }

                    // Ceiling
                    if (b.y - b.h / 2 < 0) {
                        b.y = b.h / 2;
                        b.vy *= -bounce;
                    }
                }

                // Block-block collision (simple AABB push)
                for (const other of S.blocks) {
                    if (other === b) continue;
                    const overlapX = (b.w / 2 + other.w / 2) - Math.abs(b.x - other.x);
                    const overlapY = (b.h / 2 + other.h / 2) - Math.abs(b.y - other.y);
                    if (overlapX > 0 && overlapY > 0) {
                        // Push apart on smallest overlap axis
                        if (overlapX < overlapY) {
                            const sign = b.x > other.x ? 1 : -1;
                            b.x += sign * overlapX * 0.5;
                            other.x -= sign * overlapX * 0.5;
                            const avgVx = (b.vx + other.vx) * 0.5;
                            b.vx = avgVx + sign * 20;
                            other.vx = avgVx - sign * 20;
                        } else {
                            const sign = b.y > other.y ? 1 : -1;
                            b.y += sign * overlapY * 0.5;
                            other.y -= sign * overlapY * 0.5;
                            const avgVy = (b.vy + other.vy) * 0.5;
                            b.vy = avgVy + sign * 20;
                            other.vy = avgVy - sign * 20;
                        }
                    }
                }

                // Draw block
                ctx.save();
                ctx.translate(b.x, b.y);
                ctx.rotate(b.rotation);

                const rgb = hexToRgb(b.tool.color);
                const isGrabbed = S.grabbed === b;
                const glow = isGrabbed ? 0.5 : 0.15;

                // Shadow
                ctx.shadowColor = `rgba(${rgb.r},${rgb.g},${rgb.b},${glow})`;
                ctx.shadowBlur = isGrabbed ? 20 : 8;

                // Body
                ctx.fillStyle = `rgba(${rgb.r},${rgb.g},${rgb.b},0.15)`;
                ctx.strokeStyle = `rgba(${rgb.r},${rgb.g},${rgb.b},${isGrabbed ? 0.8 : 0.4})`;
                ctx.lineWidth = isGrabbed ? 2 : 1.5;

                const radius = 6;
                ctx.beginPath();
                ctx.roundRect(-b.w / 2, -b.h / 2, b.w, b.h, radius);
                ctx.fill();
                ctx.stroke();

                ctx.shadowBlur = 0;

                // Tool name
                ctx.font = `bold ${Math.min(b.w * 0.28, 14)}px -apple-system, sans-serif`;
                ctx.fillStyle = `rgba(${rgb.r},${rgb.g},${rgb.b},0.9)`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(b.tool.name, 0, -3);

                // Status dot
                if (b.tool.status === 'live') {
                    ctx.beginPath();
                    ctx.arc(0, b.h / 2 - 10, 3, 0, Math.PI * 2);
                    ctx.fillStyle = '#22c55e';
                    ctx.fill();
                } else {
                    ctx.font = `${Math.min(b.w * 0.16, 8)}px -apple-system, sans-serif`;
                    ctx.fillStyle = `rgba(${rgb.r},${rgb.g},${rgb.b},0.3)`;
                    ctx.fillText('SOON', 0, 10);
                }

                ctx.restore();
            }

            // Earthquake indicator
            if (S.earthquake > 0.1) {
                ctx.save();
                ctx.fillStyle = `rgba(239,68,68,${S.earthquake * 0.3})`;
                ctx.font = 'bold 14px -apple-system, sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText('🌋 EARTHQUAKE!', w / 2 + (Math.random() - 0.5) * S.earthquake * 10, 80);
                ctx.restore();
            }

            // Spawn hint
            ctx.save();
            ctx.font = '11px -apple-system, sans-serif';
            ctx.fillStyle = 'rgba(255,255,255,0.08)';
            ctx.textAlign = 'center';
            ctx.fillText('Click to spawn · Grab & throw · Shake mouse for earthquake · Double-click for info', w / 2, h - 20);
            ctx.restore();

            // Cap blocks
            while (S.blocks.length > 50) S.blocks.shift();
        }

        frame = requestAnimationFrame(animate);

        // Events
        function onMouseMove(e) {
            const rect = canvas.getBoundingClientRect();
            S.mx = e.clientX - rect.left;
            S.my = e.clientY - rect.top;
        }

        function findBlock(x, y) {
            for (let i = S.blocks.length - 1; i >= 0; i--) {
                const b = S.blocks[i];
                if (Math.abs(x - b.x) < b.w / 2 && Math.abs(y - b.y) < b.h / 2) return b;
            }
            return null;
        }

        function onMouseDown(e) {
            const rect = canvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            S.mouseDown = true;

            const hit = findBlock(x, y);
            if (hit) {
                S.grabbed = hit;
                S.grabOffset = { x: x - hit.x, y: y - hit.y };
            }
        }

        function onMouseUp(e) {
            S.mouseDown = false;
            if (S.grabbed) {
                // Release with current velocity (throwing)
                S.grabbed = null;
            }
        }

        function onClick(e) {
            const rect = canvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;

            const hit = findBlock(x, y);
            if (!hit) {
                // Spawn new block
                S.blocks.push(createBlock(x, y, (Math.random() - 0.5) * 200, -200 - Math.random() * 200));
            }
        }

        function onDblClick(e) {
            const rect = canvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            const hit = findBlock(x, y);
            if (hit && onBlockSelect) {
                onBlockSelect(hit.tool);
            }
        }

        function onTouchStart(e) {
            if (e.touches.length > 0) {
                const rect = canvas.getBoundingClientRect();
                const x = e.touches[0].clientX - rect.left;
                const y = e.touches[0].clientY - rect.top;
                S.mx = x;
                S.my = y;
                const hit = findBlock(x, y);
                if (hit) {
                    S.grabbed = hit;
                    S.grabOffset = { x: x - hit.x, y: y - hit.y };
                } else {
                    S.blocks.push(createBlock(x, y, (Math.random() - 0.5) * 200, -300));
                }
            }
        }
        function onTouchMove(e) {
            if (e.touches.length > 0) {
                const rect = canvas.getBoundingClientRect();
                S.mx = e.touches[0].clientX - rect.left;
                S.my = e.touches[0].clientY - rect.top;
            }
        }
        function onTouchEnd() {
            S.grabbed = null;
            S.mouseDown = false;
        }

        canvas.addEventListener('mousemove', onMouseMove);
        canvas.addEventListener('mousedown', onMouseDown);
        canvas.addEventListener('mouseup', onMouseUp);
        canvas.addEventListener('click', onClick);
        canvas.addEventListener('dblclick', onDblClick);
        canvas.addEventListener('touchstart', onTouchStart, { passive: true });
        canvas.addEventListener('touchmove', onTouchMove, { passive: true });
        canvas.addEventListener('touchend', onTouchEnd);
        window.addEventListener('resize', resize);

        return () => {
            cancelAnimationFrame(frame);
            canvas.removeEventListener('mousemove', onMouseMove);
            canvas.removeEventListener('mousedown', onMouseDown);
            canvas.removeEventListener('mouseup', onMouseUp);
            canvas.removeEventListener('click', onClick);
            canvas.removeEventListener('dblclick', onDblClick);
            canvas.removeEventListener('touchstart', onTouchStart);
            canvas.removeEventListener('touchmove', onTouchMove);
            canvas.removeEventListener('touchend', onTouchEnd);
            window.removeEventListener('resize', resize);
        };
    }, [onBlockSelect]);

    return <canvas ref={canvasRef} className={className} style={{ touchAction: 'none', cursor: 'pointer' }} />;
}

/* ── Info Panel ── */
function InfoPanel({ tool, onClose }) {
    if (!tool) return null;
    return (
        <AnimatePresence>
            <motion.div
                key={tool.id}
                className="fixed bottom-6 left-6 right-6 sm:left-auto sm:right-6 sm:w-[360px] z-50 bg-slate-900/95 border border-white/10 rounded-2xl p-6 backdrop-blur-xl shadow-2xl"
                initial={{ opacity: 0, y: 30, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 30 }}
                transition={{ duration: 0.3 }}
            >
                <button onClick={onClose} className="absolute top-3 right-3 w-6 h-6 rounded-full bg-white/5 flex items-center justify-center text-white/30 hover:text-white/60 text-xs">✕</button>
                <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center text-sm font-extrabold" style={{ backgroundColor: `${tool.color}15`, color: tool.color }}>
                        {tool.name}
                    </div>
                    <div>
                        <h3 className="font-bold text-white text-sm">{tool.full}</h3>
                        <span className="text-[10px] font-bold tracking-widest" style={{ color: tool.status === 'live' ? '#22c55e' : '#64748b' }}>
                            {tool.status === 'live' ? '● LIVE' : '○ COMING SOON'}
                        </span>
                    </div>
                </div>
                {tool.link && (
                    <Link to={tool.link} className="inline-flex items-center gap-1.5 mt-2 text-sm font-semibold" style={{ color: tool.color }}>
                        Open {tool.name} →
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

export default function HomeV15() {
    const [selectedTool, setSelectedTool] = useState(null);

    return (
        <div className="bg-[#0a0a0f] text-white selection:bg-teal-400/30 overflow-x-hidden">

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
                    <Link to="/register" className="bg-white/5 text-white/70 px-4 py-2 rounded-full border border-white/[0.06] hover:bg-white/10 transition-all">
                        Get Started
                    </Link>
                </div>
            </motion.nav>

            {/* ── Hero: Physics Playground ── */}
            <section className="relative w-full h-screen pt-14 overflow-hidden">
                <PhysicsCanvas className="absolute inset-0 w-full h-full" onBlockSelect={setSelectedTool} />

                {/* Overlay branding */}
                <motion.div
                    className="absolute top-[10%] left-1/2 -translate-x-1/2 text-center pointer-events-none z-10"
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 1, delay: 0.5 }}
                >
                    <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-white/60">
                        Play with your tools.
                    </h1>
                    <p className="mt-2 text-sm text-white/20">
                        Grab. Throw. Stack. This is GenFabTools.
                    </p>
                </motion.div>

                {/* Tool legend */}
                <motion.div
                    className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-4 pointer-events-none z-10"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 2 }}
                >
                    {TOOL_DEFS.map(t => (
                        <div key={t.id} className="flex items-center gap-1.5">
                            <div className="w-2.5 h-2.5 rounded" style={{ backgroundColor: t.color }} />
                            <span className="text-[10px] font-mono text-white/25">{t.name}</span>
                        </div>
                    ))}
                </motion.div>
            </section>

            {/* Info panel */}
            {selectedTool && <InfoPanel tool={selectedTool} onClose={() => setSelectedTool(null)} />}

            {/* ── Below fold ── */}
            <section className="w-full py-28 lg:py-36 border-t border-white/5">
                <div className="px-6 sm:px-12 lg:px-20 max-w-4xl mx-auto text-center">
                    <Reveal>
                        <h2 className="text-3xl sm:text-5xl font-extrabold tracking-tight leading-tight">
                            Tools that are as fun to use
                            <br />
                            <span className="text-white/30">as they are powerful.</span>
                        </h2>
                        <p className="mt-6 text-slate-500 max-w-lg mx-auto">
                            GenFabTools builds purpose-built utilities for the AEC industry. Fast, intelligent, delightful.
                        </p>
                    </Reveal>

                    <Reveal delay={0.15}>
                        <div className="mt-12 grid sm:grid-cols-2 gap-4 max-w-2xl mx-auto">
                            {TOOL_DEFS.map(t => (
                                <div key={t.id} className="bg-white/[0.02] border border-white/[0.05] rounded-xl p-5 text-left hover:bg-white/[0.04] transition-all">
                                    <div className="flex items-center gap-2 mb-2">
                                        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: t.color }} />
                                        <span className="font-bold text-sm text-white/80">{t.name}</span>
                                        {t.status === 'live' && <span className="text-[10px] text-emerald-400 font-bold">● LIVE</span>}
                                    </div>
                                    <p className="text-xs text-slate-500">{t.full}</p>
                                    {t.link && <Link to={t.link} className="text-xs font-semibold mt-2 inline-block" style={{ color: t.color }}>Explore →</Link>}
                                </div>
                            ))}
                        </div>
                    </Reveal>

                    <Reveal delay={0.25}>
                        <div className="mt-12 flex flex-wrap justify-center gap-4">
                            <Link to="/register" className="bg-white text-slate-900 px-8 py-3.5 rounded-full text-sm font-bold hover:shadow-xl hover:shadow-white/10 transition-all hover:-translate-y-0.5">
                                Create free account
                            </Link>
                            <Link to="/rsi" className="bg-white/5 border border-white/10 text-white/70 px-8 py-3.5 rounded-full text-sm font-semibold hover:bg-white/10 transition-all">
                                Try RSI
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
                    </div>
                </div>
            </footer>
        </div>
    );
}
