import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence, useInView } from 'framer-motion';
import * as THREE from 'three';
import { SHOW_DRAFT_TOOLS } from './config/featureFlags';

/* ───────────────────────────────────────────────────────────
   VERSION 7 — "The Living City"
   Full-screen interactive 3D cityscape built with Three.js.
   Move your mouse and buildings rise toward the cursor.
   Click to "stamp" permanent towers. Scroll to transition
   into content. Full-bleed, transparent nav overlay.
   ─────────────────────────────────────────────────────────── */

/* ── 3D City Grid ── */
function CityCanvas({ className }) {
    const mountRef = useRef(null);
    const mouseRef = useRef({ x: 0, y: 0, clicked: false });
    const stampsRef = useRef([]);

    useEffect(() => {
        const container = mountRef.current;
        if (!container) return;

        const w = container.clientWidth;
        const h = container.clientHeight;

        // Scene setup
        const scene = new THREE.Scene();
        scene.fog = new THREE.FogExp2(0x0a0a0f, 0.045);

        const camera = new THREE.PerspectiveCamera(50, w / h, 0.1, 100);
        camera.position.set(0, 14, 18);
        camera.lookAt(0, 0, 0);

        const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        renderer.setSize(w, h);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.setClearColor(0x0a0a0f, 1);
        container.appendChild(renderer.domElement);

        // Grid of buildings
        const gridSize = 22;
        const spacing = 0.85;
        const buildings = [];
        const baseGeom = new THREE.BoxGeometry(0.55, 1, 0.55);

        const brandColors = [
            new THREE.Color(0x14b8a6), // teal
            new THREE.Color(0x3b82f6), // blue
            new THREE.Color(0x8b5cf6), // purple
            new THREE.Color(0x06b6d4), // cyan
        ];

        for (let ix = 0; ix < gridSize; ix++) {
            for (let iz = 0; iz < gridSize; iz++) {
                const x = (ix - gridSize / 2) * spacing;
                const z = (iz - gridSize / 2) * spacing;

                const mat = new THREE.MeshStandardMaterial({
                    color: new THREE.Color(0x1e293b),
                    emissive: new THREE.Color(0x000000),
                    metalness: 0.3,
                    roughness: 0.7,
                });

                const mesh = new THREE.Mesh(baseGeom, mat);
                mesh.position.set(x, 0, z);
                mesh.scale.y = 0.1;
                scene.add(mesh);
                buildings.push({ mesh, mat, ix, iz, baseX: x, baseZ: z, targetHeight: 0.1, velocity: 0 });
            }
        }

        // Lighting
        const ambient = new THREE.AmbientLight(0x334155, 0.6);
        scene.add(ambient);

        const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
        dirLight.position.set(5, 12, 8);
        scene.add(dirLight);

        const pointLight = new THREE.PointLight(0x14b8a6, 2, 20);
        pointLight.position.set(0, 8, 0);
        scene.add(pointLight);

        // Raycaster for mouse -> grid mapping
        const raycaster = new THREE.Raycaster();
        const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
        const intersectPoint = new THREE.Vector3();

        // Animation loop
        let frameId;
        const clock = new THREE.Clock();

        function animate() {
            frameId = requestAnimationFrame(animate);
            const dt = Math.min(clock.getDelta(), 0.05);

            // Convert mouse to world coords on ground plane
            const ndc = new THREE.Vector2(mouseRef.current.x, mouseRef.current.y);
            raycaster.setFromCamera(ndc, camera);
            raycaster.ray.intersectPlane(groundPlane, intersectPoint);

            // Move point light toward cursor
            pointLight.position.x += (intersectPoint.x - pointLight.position.x) * 2 * dt;
            pointLight.position.z += (intersectPoint.z - pointLight.position.z) * 2 * dt;

            // Register clicks as stamps
            if (mouseRef.current.clicked) {
                mouseRef.current.clicked = false;
                stampsRef.current.push({ x: intersectPoint.x, z: intersectPoint.z, t: clock.elapsedTime });
                if (stampsRef.current.length > 30) stampsRef.current.shift();
            }

            // Update buildings
            for (const b of buildings) {
                const dx = b.baseX - intersectPoint.x;
                const dz = b.baseZ - intersectPoint.z;
                const dist = Math.sqrt(dx * dx + dz * dz);

                // Mouse proximity effect
                const influence = Math.max(0, 1 - dist / 4.5);
                let target = 0.1 + influence * 4.5;

                // Stamp effects (permanent towers)
                for (const s of stampsRef.current) {
                    const sdx = b.baseX - s.x;
                    const sdz = b.baseZ - s.z;
                    const sdist = Math.sqrt(sdx * sdx + sdz * sdz);
                    if (sdist < 1.5) {
                        target = Math.max(target, (1.5 - sdist) * 3.5);
                    }
                }

                // Ambient wave
                const wave = Math.sin(b.baseX * 0.5 + clock.elapsedTime * 0.8) *
                    Math.cos(b.baseZ * 0.5 + clock.elapsedTime * 0.6) * 0.3;
                target += wave;

                // Spring physics
                const spring = 6;
                const damping = 4;
                b.velocity += (target - b.mesh.scale.y) * spring * dt;
                b.velocity *= Math.max(0, 1 - damping * dt);
                b.mesh.scale.y += b.velocity * dt;
                b.mesh.scale.y = Math.max(0.05, b.mesh.scale.y);
                b.mesh.position.y = b.mesh.scale.y * 0.5;

                // Color based on height
                const heightNorm = Math.min(b.mesh.scale.y / 5, 1);
                const colorIdx = Math.floor(heightNorm * (brandColors.length - 1));
                const nextIdx = Math.min(colorIdx + 1, brandColors.length - 1);
                const t = (heightNorm * (brandColors.length - 1)) - colorIdx;
                const col = brandColors[colorIdx].clone().lerp(brandColors[nextIdx], t);

                b.mat.emissive.copy(col).multiplyScalar(heightNorm * 0.6);
                b.mat.color.setHex(0x1e293b).lerp(col, heightNorm * 0.3);
            }

            renderer.render(scene, camera);
        }
        animate();

        // Mouse handlers
        function onMouseMove(e) {
            const rect = container.getBoundingClientRect();
            mouseRef.current.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
            mouseRef.current.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
        }
        function onClick() {
            mouseRef.current.clicked = true;
        }
        function onResize() {
            const nw = container.clientWidth;
            const nh = container.clientHeight;
            camera.aspect = nw / nh;
            camera.updateProjectionMatrix();
            renderer.setSize(nw, nh);
        }

        container.addEventListener('mousemove', onMouseMove);
        container.addEventListener('click', onClick);
        window.addEventListener('resize', onResize);

        // Touch support
        function onTouchMove(e) {
            if (e.touches.length > 0) {
                const touch = e.touches[0];
                const rect = container.getBoundingClientRect();
                mouseRef.current.x = ((touch.clientX - rect.left) / rect.width) * 2 - 1;
                mouseRef.current.y = -((touch.clientY - rect.top) / rect.height) * 2 + 1;
            }
        }
        function onTouchStart(e) {
            onTouchMove(e);
            mouseRef.current.clicked = true;
        }
        container.addEventListener('touchmove', onTouchMove, { passive: true });
        container.addEventListener('touchstart', onTouchStart, { passive: true });

        return () => {
            cancelAnimationFrame(frameId);
            container.removeEventListener('mousemove', onMouseMove);
            container.removeEventListener('click', onClick);
            container.removeEventListener('touchmove', onTouchMove);
            container.removeEventListener('touchstart', onTouchStart);
            window.removeEventListener('resize', onResize);
            renderer.dispose();
            if (container.contains(renderer.domElement)) {
                container.removeChild(renderer.domElement);
            }
        };
    }, []);

    return <div ref={mountRef} className={className} />;
}

/* ── Floating Nav ── */
function FloatingNav() {
    const [scrolled, setScrolled] = useState(false);
    useEffect(() => {
        const onScroll = () => setScrolled(window.scrollY > 50);
        window.addEventListener('scroll', onScroll, { passive: true });
        return () => window.removeEventListener('scroll', onScroll);
    }, []);

    return (
        <motion.nav
            className="fixed top-0 left-0 right-0 z-50 px-6 py-4 flex items-center justify-between transition-colors duration-300"
            style={{ backgroundColor: scrolled ? 'rgba(10,10,15,0.85)' : 'transparent', backdropFilter: scrolled ? 'blur(12px)' : 'none' }}
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.5 }}
        >
            <Link to="/" className="flex items-center gap-2.5">
                <img src="/genfabtools-logo.png" alt="" className="h-7 w-7 brightness-0 invert opacity-90" />
                <span className="text-sm font-bold text-white tracking-wide">GenFabTools</span>
            </Link>
            <div className="hidden sm:flex items-center gap-6">
                <Link to="/tools" className="text-sm text-white/60 hover:text-white transition-colors">Tools</Link>
                <Link to="/rsi" className="text-sm text-white/60 hover:text-white transition-colors">RSI</Link>
                <Link to="/about" className="text-sm text-white/60 hover:text-white transition-colors">About</Link>
                <Link to="/register" className="text-sm bg-white/10 hover:bg-white/15 text-white px-4 py-2 rounded-full font-medium transition-colors border border-white/10">
                    Get Started
                </Link>
            </div>
        </motion.nav>
    );
}

/* ── Fade helper ── */
function Fade({ children, className = '', delay = 0 }) {
    const ref = useRef(null);
    const inView = useInView(ref, { once: true, margin: '-60px' });
    return (
        <motion.div ref={ref} className={className}
            initial={{ opacity: 0, y: 30 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.7, delay, ease: [0.22, 1, 0.36, 1] }}
        >{children}</motion.div>
    );
}

/* ── Tool data ── */
const TOOLS = [
    { id: 'rsi', name: 'RSI', full: 'Residential Scheme Intelligence', desc: 'Efficiency scoring, financial feasibility, scheme comparison — live inside Revit.', color: '#14b8a6', status: 'live', link: '/rsi', image: '/images/rsi/project00.png' },
    { id: 'sitegen', name: 'SiteGen', full: 'Site Generator', desc: 'Automated building massing and parking from site constraints.', color: '#3b82f6', status: 'coming', link: SHOW_DRAFT_TOOLS ? '/sitegen' : null },
    { id: 'occucalc', name: 'OccuCalc', full: 'Occupancy Calculator', desc: 'Code-compliant occupant loads, calculated instantly.', color: '#8b5cf6', status: 'coming', link: SHOW_DRAFT_TOOLS ? '/occucalc' : null },
    { id: 'parkcore', name: 'ParkCore', full: 'Parking Core Engine', desc: 'Optimized parking layouts from boundary geometry.', color: '#f59e0b', status: 'coming', link: SHOW_DRAFT_TOOLS ? '/parkcore' : null },
];

export default function HomeV7() {
    return (
        <div className="bg-[#0a0a0f] text-white selection:bg-teal-400/30 overflow-x-hidden">
            <FloatingNav />

            {/* ── Hero: Full-screen 3D City ── */}
            <section className="relative w-full h-screen overflow-hidden">
                <CityCanvas className="absolute inset-0 w-full h-full" />

                {/* Overlay content */}
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none" style={{ background: 'linear-gradient(to bottom, rgba(10,10,15,0.3), rgba(10,10,15,0.1) 50%, rgba(10,10,15,0.6))' }}>
                    <motion.div
                        className="text-center px-6 max-w-4xl"
                        initial={{ opacity: 0, y: 30 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 1, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
                    >
                        <h1 className="text-5xl sm:text-7xl lg:text-8xl font-extrabold tracking-tight leading-[1.0]">
                            Build the
                            <br />
                            <span className="bg-gradient-to-r from-teal-400 via-cyan-300 to-blue-400 bg-clip-text text-transparent">
                                future
                            </span>
                        </h1>
                        <p className="mt-6 text-base sm:text-lg text-white/50 font-light max-w-lg mx-auto leading-relaxed">
                            GenFabTools is an ecosystem of intelligent utilities for the AEC industry. Move your cursor to shape the city. Click to build.
                        </p>

                        <div className="mt-8 flex flex-wrap justify-center gap-3 pointer-events-auto">
                            <Link
                                to="/tools"
                                className="group bg-white text-slate-900 px-7 py-3.5 rounded-full text-sm font-semibold hover:shadow-xl hover:shadow-white/10 transition-all hover:-translate-y-0.5"
                            >
                                Explore Tools <span className="inline-block ml-1 group-hover:translate-x-1 transition-transform">→</span>
                            </Link>
                            <Link
                                to="/rsi"
                                className="bg-white/5 border border-white/10 text-white/80 px-7 py-3.5 rounded-full text-sm font-semibold hover:bg-white/10 transition-all backdrop-blur-sm"
                            >
                                Try RSI
                            </Link>
                        </div>
                    </motion.div>

                    {/* Hint */}
                    <motion.p
                        className="absolute bottom-24 text-xs text-white/30 tracking-wider uppercase"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 2, duration: 1 }}
                    >
                        Move your mouse · Click to build · Scroll to explore
                    </motion.p>
                </div>

                {/* Scroll indicator */}
                <motion.div
                    className="absolute bottom-8 left-1/2 -translate-x-1/2"
                    animate={{ y: [0, 8, 0] }}
                    transition={{ repeat: Infinity, duration: 2, ease: 'easeInOut' }}
                >
                    <svg className="w-6 h-6 text-white/20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                    </svg>
                </motion.div>
            </section>

            {/* ── Brand Statement — Full Width ── */}
            <section className="w-full bg-gradient-to-b from-[#0a0a0f] to-slate-950 py-32">
                <div className="px-6 sm:px-12 lg:px-20">
                    <Fade>
                        <h2 className="text-4xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight leading-[1.1] max-w-5xl">
                            We build tools that think
                            <span className="text-slate-600"> — so you can focus on design.</span>
                        </h2>
                    </Fade>
                    <Fade delay={0.15}>
                        <p className="mt-8 text-lg text-slate-500 max-w-2xl leading-relaxed">
                            Every GenFabTools utility targets a single bottleneck in the AEC workflow. Small, fast, purpose-built. One platform, infinite potential.
                        </p>
                    </Fade>
                </div>
            </section>

            {/* ── Ecosystem Tools — Full Bleed Cards ── */}
            <section className="w-full py-28 lg:py-36">
                <div className="px-6 sm:px-12 lg:px-20 mb-16">
                    <Fade>
                        <div className="flex items-center gap-3 mb-4">
                            <div className="h-px w-12 bg-gradient-to-r from-teal-500 to-transparent" />
                            <span className="text-xs font-bold tracking-[0.2em] uppercase text-teal-400">The Ecosystem</span>
                        </div>
                        <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">Tools that scale with your practice</h2>
                    </Fade>
                </div>

                {/* Horizontal scroll on mobile, grid on desktop */}
                <div className="px-6 sm:px-12 lg:px-20">
                    <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-4">
                        {TOOLS.map((tool, i) => (
                            <Fade key={tool.id} delay={i * 0.08}>
                                <div className="group relative bg-white/[0.02] border border-white/[0.06] rounded-2xl overflow-hidden hover:bg-white/[0.05] hover:border-white/10 transition-all duration-500 h-full">
                                    {/* Color accent top bar */}
                                    <div className="h-1 w-full" style={{ background: `linear-gradient(to right, ${tool.color}, transparent)` }} />

                                    <div className="p-7">
                                        <div className="flex items-center justify-between mb-5">
                                            <div className="w-11 h-11 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${tool.color}15` }}>
                                                <span className="text-sm font-extrabold" style={{ color: tool.color }}>{tool.name}</span>
                                            </div>
                                            {tool.status === 'live' ? (
                                                <span className="flex items-center gap-1.5 text-[10px] font-bold tracking-widest uppercase text-green-400">
                                                    <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" /> Live
                                                </span>
                                            ) : (
                                                <span className="text-[10px] font-bold tracking-widest uppercase text-slate-600">Coming Soon</span>
                                            )}
                                        </div>

                                        <h3 className="text-lg font-bold text-white">{tool.full}</h3>
                                        <p className="mt-2 text-sm text-slate-500 leading-relaxed">{tool.desc}</p>

                                        {tool.image && (
                                            <div className="mt-5 -mx-7 -mb-7">
                                                <img src={tool.image} alt={tool.full} className="w-full border-t border-white/5" loading="lazy" />
                                            </div>
                                        )}

                                        {!tool.image && (
                                            <div className="mt-5 flex items-center gap-1.5">
                                                <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: tool.color }} />
                                                <span className="text-xs text-slate-600">In development</span>
                                            </div>
                                        )}
                                    </div>

                                    {/* Hover overlay link */}
                                    {tool.link && (
                                        <Link to={tool.link} className="absolute inset-0 z-10" aria-label={`Explore ${tool.name}`} />
                                    )}
                                </div>
                            </Fade>
                        ))}
                    </div>
                </div>
            </section>

            {/* ── Platform stats — Edge-to-edge dark strip ── */}
            <section className="w-full border-y border-white/5 bg-black/20">
                <div className="grid sm:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-white/5">
                    {[
                        { val: '4', label: 'Tools in ecosystem', suffix: '' },
                        { val: '1', label: 'Live now (RSI)', suffix: '' },
                        { val: '10', label: 'Seconds per analysis', suffix: 's' },
                        { val: '10', label: 'Times faster', suffix: '×' },
                    ].map((s, i) => (
                        <Fade key={i} delay={i * 0.06}>
                            <div className="px-8 py-12 text-center">
                                <p className="text-4xl sm:text-5xl font-extrabold tracking-tight bg-gradient-to-b from-white to-slate-400 bg-clip-text text-transparent">
                                    {s.val}{s.suffix}
                                </p>
                                <p className="mt-2 text-xs text-slate-500 tracking-wider uppercase">{s.label}</p>
                            </div>
                        </Fade>
                    ))}
                </div>
            </section>

            {/* ── Brand philosophy ── */}
            <section className="w-full py-28 lg:py-36">
                <div className="px-6 sm:px-12 lg:px-20 grid lg:grid-cols-2 gap-20">
                    <Fade>
                        <div>
                            <h2 className="text-4xl sm:text-5xl font-extrabold tracking-tight leading-tight">
                                One platform for
                                <br />
                                every smart tool
                                <br />
                                <span className="text-slate-600">you'll ever need.</span>
                            </h2>
                        </div>
                    </Fade>
                    <div className="space-y-8">
                        {[
                            { title: 'Purpose-built', desc: 'Each tool does one thing brilliantly. No bloat.' },
                            { title: 'Inside your workflow', desc: "We live in Revit, your browser, your tools — not a new app to learn." },
                            { title: 'Seconds, not hours', desc: 'Manual processes that take hours become instant automated insight.' },
                            { title: 'Grows with you', desc: 'Start with one tool. The ecosystem keeps expanding.' },
                        ].map((item, i) => (
                            <Fade key={i} delay={i * 0.08}>
                                <div className="flex items-start gap-4 group">
                                    <div className="shrink-0 w-8 h-8 rounded-lg bg-white/[0.04] border border-white/[0.06] flex items-center justify-center text-xs font-bold text-teal-400 group-hover:bg-teal-400/10 transition-colors">
                                        {String(i + 1).padStart(2, '0')}
                                    </div>
                                    <div>
                                        <h3 className="font-semibold text-white">{item.title}</h3>
                                        <p className="text-sm text-slate-500 mt-1">{item.desc}</p>
                                    </div>
                                </div>
                            </Fade>
                        ))}
                    </div>
                </div>
            </section>

            {/* ── CTA — Full bleed gradient ── */}
            <section className="relative w-full py-32 overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-t from-teal-500/[0.05] via-transparent to-transparent" />
                <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[800px] h-[300px] bg-gradient-to-t from-teal-500/[0.08] to-transparent rounded-full blur-[80px]" />

                <div className="relative px-6 sm:px-12 lg:px-20 text-center">
                    <Fade>
                        <h2 className="text-4xl sm:text-6xl font-extrabold tracking-tight leading-tight">
                            Shape the future
                            <br />
                            of AEC design
                        </h2>
                        <p className="mt-6 text-slate-500 text-lg max-w-lg mx-auto">
                            Start with RSI. Watch the ecosystem grow. Your practice will never work the same way again.
                        </p>
                        <div className="mt-10 flex flex-wrap justify-center gap-4">
                            <Link
                                to="/register"
                                className="bg-white text-slate-900 px-10 py-4 rounded-full text-sm font-semibold hover:shadow-xl hover:shadow-white/10 transition-all hover:-translate-y-0.5"
                            >
                                Create free account
                            </Link>
                            <Link
                                to="/rsi"
                                className="bg-white/5 border border-white/10 text-white/80 px-8 py-4 rounded-full text-sm font-semibold hover:bg-white/10 transition-all backdrop-blur-sm"
                            >
                                Try RSI — $49/mo
                            </Link>
                        </div>
                    </Fade>
                </div>
            </section>

            {/* ── Minimal footer ── */}
            <footer className="w-full border-t border-white/5 py-8 px-6 sm:px-12 lg:px-20">
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-600">
                    <span>© {new Date().getFullYear()} GenFabTools. All rights reserved.</span>
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
