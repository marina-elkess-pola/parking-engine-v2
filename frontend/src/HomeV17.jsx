import React, { useRef, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, useInView, useScroll } from 'framer-motion';
import * as THREE from 'three';

/* ───────────────────────────────────────────────────────────
   VERSION 17 — "Connected City" (Interactive)

   The 3D city is fixed behind the entire page and is
   INTERACTIVE at every scroll position:
   - Mouse proximity raises nearby buildings
   - Click anywhere → ripple spike outward
   - Hold + drag → sculpt a trail of tall buildings
   - Scroll progress grows the base height + color vibrancy

   Content floats above with pointer-events-none so the
   city always receives interaction. Links/buttons opt
   back in with pointer-events-auto.
   ─────────────────────────────────────────────────────────── */

const TOOLS = [
    {
        name: 'RSI',
        full: 'Residential Scheme Intelligence',
        hex: '#14b8a6',
        status: 'Live',
        before: 'Spreadsheets, manual takeoffs, disconnected data',
        after: 'Automated feasibility analysis from your design model',
        metric: '8 seconds',
        metricLabel: 'vs. hours of spreadsheet work',
        link: '/rsi',
    },
    {
        name: 'ParkCore',
        full: 'Parking Core Engine',
        hex: '#f59e0b',
        status: 'Coming',
        before: 'Manual stall layouts, hand-counted spaces, compliance guesswork',
        after: 'Optimized parking layouts from any site boundary',
        metric: '3 layouts',
        metricLabel: 'generated and compared instantly',
    },
    {
        name: 'OccuCalc',
        full: 'Occupancy Calculator',
        hex: '#8b5cf6',
        status: 'Coming',
        before: 'Cross-referencing code tables, manual floor area calculations',
        after: 'Instant code-compliant occupant loads from floor plans',
        metric: '0 lookups',
        metricLabel: 'every code table built in',
    },
    {
        name: 'SiteGen',
        full: 'Site Generator',
        hex: '#3b82f6',
        status: 'Coming',
        before: 'Sketch, measure, iterate, repeat \u2014 hoping one option works',
        after: 'Optimized massing options from site constraints in seconds',
        metric: '10+ options',
        metricLabel: 'explored before you finish one by hand',
    },
];

/* ════════════════════════════════════════════════════════════
   INTERACTIVE PARTICLE UNIVERSE — MINIMAL
   Monochrome particles trace orbital loops. Near-invisible
   at rest — they come alive near your cursor.

   - Cursor proximity → particles illuminate and attract
   - Fast mouse → particles scatter like startled fireflies
   - Click → shockwave burst
   - Drag → gravity well
   - Scroll → orbits accelerate, system brightens
   ════════════════════════════════════════════════════════════ */

function InteractiveCity({ className, scrollProgress }) {
    const mountRef = useRef(null);
    const progressRef = useRef(0);

    useEffect(() => { progressRef.current = scrollProgress; }, [scrollProgress]);

    useEffect(() => {
        const el = mountRef.current;
        if (!el) return;
        let W = el.clientWidth, H = el.clientHeight;
        let mx = W / 2, my = H / 2;
        let mouseDown = false;

        const ripples = []; // { x, y, z, t }

        const scene = new THREE.Scene();

        const camera = new THREE.PerspectiveCamera(55, W / H, 0.1, 200);
        camera.position.set(0, 8, 18);
        camera.lookAt(0, 0, 0);

        const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        renderer.setSize(W, H);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.setClearColor(0x050508, 1);
        el.appendChild(renderer.domElement);

        // Monochrome orbits
        const orbits = [
            { particles: 500, R: 7, tiltX: 0.08, tiltZ: 0, scaleY: 0.75, speed: 0.25, dir: 1 },
            { particles: 450, R: 6.5, tiltX: 0.45, tiltZ: 0.22, scaleY: 0.85, speed: 0.20, dir: -1 },
            { particles: 400, R: 7.5, tiltX: 0.75, tiltZ: -0.1, scaleY: 0.65, speed: 0.18, dir: 1 },
        ];

        // Per-particle shader for proximity brightness
        const vtx = `
            attribute float aSize;
            attribute float aBright;
            varying float vB;
            void main() {
                vB = aBright;
                vec4 mv = modelViewMatrix * vec4(position, 1.0);
                gl_PointSize = aSize * (200.0 / -mv.z);
                gl_Position = projectionMatrix * mv;
            }
        `;
        const frg = `
            varying float vB;
            void main() {
                float d = length(gl_PointCoord - vec2(0.5));
                if (d > 0.5) discard;
                float a = smoothstep(0.5, 0.0, d) * vB;
                gl_FragColor = vec4(1.0, 1.0, 1.0, a);
            }
        `;

        function applyTilt(x, y, z, tiltX, tiltZ) {
            const cosX = Math.cos(Math.PI * tiltX), sinX = Math.sin(Math.PI * tiltX);
            const cosZ = Math.cos(Math.PI * tiltZ), sinZ = Math.sin(Math.PI * tiltZ);
            const y1 = y * cosX - z * sinX;
            const z1 = y * sinX + z * cosX;
            const x2 = x * cosZ - y1 * sinZ;
            const y2 = x * sinZ + y1 * cosZ;
            return { x: x2, y: y2, z: z1 };
        }

        const orbitSystems = [];

        // ── Floor plan shape (L-shaped building with rooms) ──
        // Points distributed along wall edges, in world XZ plane (y=0)
        const S = 1.8; // scale factor — bigger = more recognizable
        const planSegments = [
            // Outer L-shape
            [[-4 * S, -3 * S], [4 * S, -3 * S]],   // bottom wall
            [[4 * S, -3 * S], [4 * S, 1 * S]],     // right lower wall
            [[4 * S, 1 * S], [1 * S, 1 * S]],      // step
            [[1 * S, 1 * S], [1 * S, 4 * S]],      // right upper wall
            [[-4 * S, 4 * S], [1 * S, 4 * S]],     // top wall
            [[-4 * S, -3 * S], [-4 * S, 4 * S]],   // left wall
            // Interior walls (rooms)
            [[-1 * S, -3 * S], [-1 * S, 1 * S]],   // vertical room divider
            [[-4 * S, 0.5 * S], [-1 * S, 0.5 * S]],  // horizontal corridor wall
            [[1 * S, -0.5 * S], [4 * S, -0.5 * S]], // right side room divider
        ];

        // Sample points along the plan edges
        const planPoints = [];
        const totalPlanPts = 500 + 450 + 400; // match orbit particle counts
        const ptsPerSeg = Math.ceil(totalPlanPts / planSegments.length);
        for (const seg of planSegments) {
            for (let j = 0; j < ptsPerSeg; j++) {
                const frac = j / ptsPerSeg;
                const x = seg[0][0] + (seg[1][0] - seg[0][0]) * frac;
                const z = seg[0][1] + (seg[1][1] - seg[0][1]) * frac;
                // Small jitter so they don't stack on perfect lines
                planPoints.push([
                    x + (Math.random() - 0.5) * 0.12,
                    (Math.random() - 0.5) * 0.15, // slight y scatter
                    z + (Math.random() - 0.5) * 0.12,
                ]);
            }
        }
        // Shuffle so assignment across orbits feels random
        for (let i = planPoints.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [planPoints[i], planPoints[j]] = [planPoints[j], planPoints[i]];
        }

        let planIdx = 0; // running index into planPoints

        for (let oi = 0; oi < orbits.length; oi++) {
            const orb = orbits[oi];
            const count = orb.particles;

            const positions = new Float32Array(count * 3);
            const baseAngles = new Float32Array(count);
            const speeds = new Float32Array(count);
            const offsets = new Float32Array(count * 3);
            const aSize = new Float32Array(count);
            const aBright = new Float32Array(count);
            const planTargets = new Float32Array(count * 3); // morph target

            for (let i = 0; i < count; i++) {
                const theta = Math.random() * Math.PI * 2;
                baseAngles[i] = theta;
                speeds[i] = 0.85 + Math.random() * 0.3;
                aSize[i] = 0.8 + Math.random() * 1.5;
                aBright[i] = 0.06;
                offsets[i * 3] = (Math.random() - 0.5) * 0.6;
                offsets[i * 3 + 1] = (Math.random() - 0.5) * 0.6;
                offsets[i * 3 + 2] = (Math.random() - 0.5) * 0.6;

                // Assign a floor plan target
                const pp = planPoints[planIdx % planPoints.length];
                planTargets[i * 3] = pp[0];
                planTargets[i * 3 + 1] = pp[1];
                planTargets[i * 3 + 2] = pp[2];
                planIdx++;

                const x = Math.cos(theta) * orb.R;
                const y = Math.sin(theta) * orb.R * orb.scaleY;
                const pt = applyTilt(x, y, 0, orb.tiltX, orb.tiltZ);
                positions[i * 3] = pt.x + offsets[i * 3];
                positions[i * 3 + 1] = pt.y + offsets[i * 3 + 1];
                positions[i * 3 + 2] = pt.z + offsets[i * 3 + 2];
            }

            const geometry = new THREE.BufferGeometry();
            geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
            geometry.setAttribute('aSize', new THREE.BufferAttribute(aSize, 1));
            geometry.setAttribute('aBright', new THREE.BufferAttribute(aBright, 1));

            const material = new THREE.ShaderMaterial({
                vertexShader: vtx,
                fragmentShader: frg,
                transparent: true,
                blending: THREE.AdditiveBlending,
                depthWrite: false,
            });

            const points = new THREE.Points(geometry, material);
            scene.add(points);

            orbitSystems.push({
                points, geometry, material,
                baseAngles, speeds, offsets, aSize, aBright, planTargets,
                ...orb, orbitIdx: oi,
            });
        }

        // Sparse dust
        const dustCount = 150;
        const dustPos = new Float32Array(dustCount * 3);
        for (let i = 0; i < dustCount; i++) {
            dustPos[i * 3] = (Math.random() - 0.5) * 60;
            dustPos[i * 3 + 1] = (Math.random() - 0.5) * 60;
            dustPos[i * 3 + 2] = (Math.random() - 0.5) * 60;
        }
        const dustGeo = new THREE.BufferGeometry();
        dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
        scene.add(new THREE.Points(dustGeo, new THREE.PointsMaterial({
            color: 0xffffff,
            size: 0.015,
            transparent: true,
            opacity: 0.06,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            sizeAttenuation: true,
        })));

        const raycaster = new THREE.Raycaster();
        const cursorWorld = new THREE.Vector3();

        let frame;
        const clock = new THREE.Clock();
        let camAngle = 0;

        function getCursorWorld() {
            const ndc = new THREE.Vector2((mx / W) * 2 - 1, -(my / H) * 2 + 1);
            raycaster.setFromCamera(ndc, camera);
            const sphere = new THREE.Sphere(new THREE.Vector3(0, 0, 0), 10);
            const target = new THREE.Vector3();
            if (raycaster.ray.intersectSphere(sphere, target)) {
                cursorWorld.copy(target);
            } else {
                cursorWorld.set(mx / W * 20 - 10, -(my / H) * 20 + 10, 0);
            }
        }

        function animate() {
            frame = requestAnimationFrame(animate);
            const dt = Math.min(clock.getDelta(), 0.05);
            const t = clock.elapsedTime;
            const p = progressRef.current;

            // Slow steady camera orbit
            camAngle += dt * 0.03;
            const camR = 20 - p * 5;
            camera.position.x = Math.sin(camAngle) * camR;
            camera.position.z = Math.cos(camAngle) * camR;
            camera.position.y = 8 - p * 4;
            camera.lookAt(0, 0, 0);

            getCursorWorld();

            // Decay ripples
            for (let i = ripples.length - 1; i >= 0; i--) {
                ripples[i].t += dt;
                if (ripples[i].t > 2) ripples.splice(i, 1);
            }

            // Morph cycle: orbits ↔ floor plan (10s loop)
            // 0-2s orbit | 2-3.5s morph in | 3.5-6.5s hold plan | 6.5-8s morph out | 8-10s orbit
            const cycle = t % 10;
            let morph = 0;
            if (cycle >= 2 && cycle < 3.5) morph = (cycle - 2) / 1.5;
            else if (cycle >= 3.5 && cycle < 6.5) morph = 1;
            else if (cycle >= 6.5 && cycle < 8) morph = 1 - (cycle - 6.5) / 1.5;
            morph = morph * morph * (3 - 2 * morph); // smooth

            for (const sys of orbitSystems) {
                const positions = sys.geometry.attributes.position.array;
                const brightness = sys.geometry.attributes.aBright.array;
                const sizes = sys.geometry.attributes.aSize.array;

                // Orbit speed: gentle base, faster with scroll
                const speedMult = (0.12 + p * 1.0) * sys.dir;

                for (let i = 0; i < sys.particles; i++) {
                    // Advance along orbit (slower during morph so transition is smooth)
                    sys.baseAngles[i] += sys.speed * speedMult * sys.speeds[i] * dt * (1 - morph * 0.8);

                    const theta = sys.baseAngles[i];
                    const tilted = applyTilt(
                        Math.cos(theta) * sys.R,
                        Math.sin(theta) * sys.R * sys.scaleY,
                        0, sys.tiltX, sys.tiltZ
                    );

                    // Blend orbit → floor plan
                    const baseX = tilted.x + (sys.planTargets[i * 3] - tilted.x) * morph;
                    const baseY = tilted.y + (sys.planTargets[i * 3 + 1] - tilted.y) * morph;
                    const baseZ = tilted.z + (sys.planTargets[i * 3 + 2] - tilted.z) * morph;

                    const px = baseX + sys.offsets[i * 3];
                    const py = baseY + sys.offsets[i * 3 + 1];
                    const pz = baseZ + sys.offsets[i * 3 + 2];

                    // Distance to cursor
                    const dx = cursorWorld.x - px;
                    const dy = cursorWorld.y - py;
                    const dz = cursorWorld.z - pz;
                    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

                    // ── 1. Flashlight glow ──
                    const glow = dist < 10 ? Math.pow(1 - dist / 10, 1.5) : 0;
                    brightness[i] = 0.15 + p * 0.05 + morph * 0.15 + glow * 0.65;
                    sizes[i] = sys.aSize[i] * (0.5 + p * 0.2) * (1 + glow * 2);

                    // ── 2. Cursor push (particles part like water) ──
                    if (dist < 5 && dist > 0.05) {
                        const pushStr = mouseDown
                            ? (1 - dist / 5) * 15 * dt   // strong push when holding
                            : (1 - dist / 5) * 4 * dt;   // gentle push on hover
                        const invD = 1 / dist;
                        // Push AWAY from cursor (repulsion)
                        sys.offsets[i * 3] -= dx * invD * pushStr;
                        sys.offsets[i * 3 + 1] -= dy * invD * pushStr;
                        sys.offsets[i * 3 + 2] -= dz * invD * pushStr;
                    }

                    // ── 3. Click ripple (expanding ring wave) ──
                    for (const r of ripples) {
                        const rx = px - r.x, ry = py - r.y, rz = pz - r.z;
                        const rd = Math.sqrt(rx * rx + ry * ry + rz * rz);
                        // Ripple is a ring expanding outward
                        const ringR = r.t * 12; // ring radius grows at 12 units/sec
                        const ringDist = Math.abs(rd - ringR);
                        if (ringDist < 1.5 && rd > 0.1) {
                            const wave = (1 - ringDist / 1.5) * Math.max(0, 1 - r.t / 1.5) * 6 * dt;
                            sys.offsets[i * 3] += (rx / rd) * wave;
                            sys.offsets[i * 3 + 1] += (ry / rd) * wave;
                            sys.offsets[i * 3 + 2] += (rz / rd) * wave;
                        }
                    }

                    // ── Return to path (spring) ──
                    sys.offsets[i * 3] *= Math.max(0, 1 - 2.0 * dt);
                    sys.offsets[i * 3 + 1] *= Math.max(0, 1 - 2.0 * dt);
                    sys.offsets[i * 3 + 2] *= Math.max(0, 1 - 2.0 * dt);

                    positions[i * 3] = baseX + sys.offsets[i * 3];
                    positions[i * 3 + 1] = baseY + sys.offsets[i * 3 + 1];
                    positions[i * 3 + 2] = baseZ + sys.offsets[i * 3 + 2];
                }

                sys.geometry.attributes.position.needsUpdate = true;
                sys.geometry.attributes.aBright.needsUpdate = true;
                sys.geometry.attributes.aSize.needsUpdate = true;
            }

            renderer.render(scene, camera);
        }
        animate();

        // ── Events ──
        function onMove(e) { mx = e.clientX; my = e.clientY; }
        function onClick(e) {
            getCursorWorld();
            ripples.push({ x: cursorWorld.x, y: cursorWorld.y, z: cursorWorld.z, t: 0 });
        }
        function onDown(e) { if (e.button === 0) mouseDown = true; }
        function onUp() { mouseDown = false; }
        function onTouchStart(e) {
            if (e.touches.length > 0) {
                mx = e.touches[0].clientX; my = e.touches[0].clientY;
                mouseDown = true;
                getCursorWorld();
                ripples.push({ x: cursorWorld.x, y: cursorWorld.y, z: cursorWorld.z, t: 0 });
            }
        }
        function onTouchMove(e) {
            if (e.touches.length > 0) {
                mx = e.touches[0].clientX; my = e.touches[0].clientY;
            }
        }
        function onTouchEnd() { mouseDown = false; }
        function onResize() {
            W = el.clientWidth; H = el.clientHeight;
            camera.aspect = W / H; camera.updateProjectionMatrix();
            renderer.setSize(W, H);
        }

        el.addEventListener('mousemove', onMove);
        el.addEventListener('click', onClick);
        el.addEventListener('mousedown', onDown);
        el.addEventListener('mouseup', onUp);
        el.addEventListener('touchstart', onTouchStart, { passive: true });
        el.addEventListener('touchmove', onTouchMove, { passive: true });
        el.addEventListener('touchend', onTouchEnd);
        window.addEventListener('resize', onResize);

        return () => {
            cancelAnimationFrame(frame);
            el.removeEventListener('mousemove', onMove);
            el.removeEventListener('click', onClick);
            el.removeEventListener('mousedown', onDown);
            el.removeEventListener('mouseup', onUp);
            el.removeEventListener('touchstart', onTouchStart);
            el.removeEventListener('touchmove', onTouchMove);
            el.removeEventListener('touchend', onTouchEnd);
            window.removeEventListener('resize', onResize);
            renderer.dispose();
            if (el.contains(renderer.domElement)) el.removeChild(renderer.domElement);
        };
    }, []);

    return <div ref={mountRef} className={className} />;
}

/* ════════════════════════════════════════════════════════════
   TOOL CARD
   ════════════════════════════════════════════════════════════ */

function ToolCard({ tool, index }) {
    const ref = useRef(null);
    const inView = useInView(ref, { once: true, margin: '-15% 0px -15% 0px' });
    const [revealed, setRevealed] = useState(false);

    useEffect(() => {
        if (inView) {
            const t = setTimeout(() => setRevealed(true), 600);
            return () => clearTimeout(t);
        }
    }, [inView]);

    return (
        <motion.div
            ref={ref}
            className="relative pointer-events-auto"
            initial={{ opacity: 0, y: 20 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6, delay: index * 0.08, ease: [0.22, 1, 0.36, 1] }}
        >
            <div className="bg-[#0a0a0f]/70 backdrop-blur-md border border-white/[0.06] rounded-2xl p-6 sm:p-8 hover:border-white/[0.12] transition-all duration-500">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: tool.hex }} />
                        <div>
                            <h3 className="text-base font-bold text-white/90">{tool.name}</h3>
                            <p className="text-[11px] text-white/25">{tool.full}</p>
                        </div>
                    </div>
                    <span
                        className="text-[9px] font-bold tracking-wider uppercase px-2.5 py-1 rounded-full"
                        style={{
                            color: tool.status === 'Live' ? tool.hex : 'rgba(255,255,255,0.2)',
                            backgroundColor: tool.status === 'Live' ? `${tool.hex}15` : 'rgba(255,255,255,0.03)',
                        }}
                    >
                        {tool.status === 'Live' ? 'Live now' : 'Coming soon'}
                    </span>
                </div>

                {/* Before */}
                <div className="mb-4">
                    <p className="text-[10px] font-bold text-white/15 tracking-widest uppercase mb-1.5">Without</p>
                    <p
                        className="text-sm leading-relaxed transition-all duration-700"
                        style={{
                            color: revealed ? 'rgba(248,113,113,0.3)' : 'rgba(255,255,255,0.4)',
                            textDecoration: revealed ? 'line-through' : 'none',
                        }}
                    >
                        {tool.before}
                    </p>
                </div>

                {/* After */}
                <motion.div
                    initial={false}
                    animate={revealed ? { opacity: 1, height: 'auto', y: 0 } : { opacity: 0, height: 0, y: 6 }}
                    transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                    className="overflow-hidden"
                >
                    <div className="pl-4 border-l-2 mb-5" style={{ borderColor: tool.hex }}>
                        <p className="text-[10px] font-bold tracking-widest uppercase mb-1.5" style={{ color: `${tool.hex}60` }}>With {tool.name}</p>
                        <p className="text-sm text-white/80 leading-relaxed">{tool.after}</p>
                    </div>
                </motion.div>

                {/* Metric */}
                <motion.div
                    initial={false}
                    animate={revealed ? { opacity: 1 } : { opacity: 0 }}
                    transition={{ duration: 0.5, delay: 0.3 }}
                    className="flex items-baseline gap-3"
                >
                    <span className="text-2xl sm:text-3xl font-extrabold font-mono" style={{ color: tool.hex }}>
                        {tool.metric}
                    </span>
                    <span className="text-[11px] text-white/25">{tool.metricLabel}</span>
                </motion.div>

                {/* Link for live tools */}
                {tool.link && revealed && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }} className="mt-5">
                        <Link
                            to={tool.link}
                            className="inline-flex items-center gap-1.5 text-xs font-semibold transition-colors"
                            style={{ color: `${tool.hex}90` }}
                        >
                            Try {tool.name}
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                        </Link>
                    </motion.div>
                )}
            </div>
        </motion.div>
    );
}

/* ════════════════════════════════════════════════════════════
   HELPERS
   ════════════════════════════════════════════════════════════ */

function Reveal({ children, className = '', delay = 0 }) {
    const ref = useRef(null);
    const inView = useInView(ref, { once: true, margin: '-60px' });
    return (
        <motion.div
            ref={ref} className={className}
            initial={{ opacity: 0, y: 24 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.7, delay, ease: [0.22, 1, 0.36, 1] }}
        >{children}</motion.div>
    );
}

function FloatingNav() {
    const [scrolled, setScrolled] = useState(false);
    useEffect(() => {
        const fn = () => setScrolled(window.scrollY > 50);
        window.addEventListener('scroll', fn, { passive: true });
        return () => window.removeEventListener('scroll', fn);
    }, []);
    return (
        <motion.nav
            className="fixed top-0 left-0 right-0 z-50 px-6 py-3 flex items-center justify-between pointer-events-auto transition-colors duration-300"
            style={{
                backgroundColor: scrolled ? 'rgba(5,5,8,0.92)' : 'rgba(5,5,8,0.3)',
                backdropFilter: 'blur(12px)',
            }}
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
        >
            <Link to="/" className="flex items-center gap-2.5">
                <img src="/genfabtools-logo.png" alt="" className="h-7 w-7 brightness-0 invert opacity-90" />
                <span className="text-sm font-bold text-white tracking-wide">GenFabTools</span>
            </Link>
            <div className="hidden sm:flex items-center gap-6">
                <Link to="/tools" className="text-sm text-white/50 hover:text-white transition-colors">Tools</Link>
                <Link to="/rsi" className="text-sm text-white/50 hover:text-white transition-colors">RSI</Link>
                <Link to="/about" className="text-sm text-white/50 hover:text-white transition-colors">About</Link>
                <Link to="/register" className="text-sm bg-white/10 hover:bg-white/15 text-white px-4 py-2 rounded-full font-medium transition-colors border border-white/10">
                    Get Started
                </Link>
            </div>
        </motion.nav>
    );
}

/* ════════════════════════════════════════════════════════════
   MAIN PAGE

   Layout trick: The 3D city is at z-10 (interactive layer).
   All content sits above at z-20 with pointer-events-none.
   Clickable elements (buttons, links, cards) opt back in
   with pointer-events-auto. This means the city is ALWAYS
   interactive — click/drag anywhere that isn't a button.
   ════════════════════════════════════════════════════════════ */

export default function HomeV17() {
    const pageRef = useRef(null);
    const { scrollYProgress } = useScroll({ target: pageRef });
    const [cityProgress, setCityProgress] = useState(0);

    useEffect(() => {
        const unsub = scrollYProgress.on('change', (v) => setCityProgress(v));
        return unsub;
    }, [scrollYProgress]);

    return (
        <div ref={pageRef} className="bg-[#050508] text-white selection:bg-teal-400/30 overflow-x-hidden">

            {/* ── Layer 1: Interactive 3D City (fixed, always clickable) ── */}
            <div className="fixed inset-0 z-10">
                <InteractiveCity className="absolute inset-0 w-full h-full" scrollProgress={cityProgress} />
            </div>

            {/* ── Layer 2: Content (pointer-events-none, floats above) ── */}
            <div className="relative z-20 pointer-events-none">
                <FloatingNav />

                {/* ═══════ HERO ═══════ */}
                <section className="h-screen flex flex-col items-center justify-center px-6">
                    <motion.div
                        className="text-center max-w-3xl"
                        initial={{ opacity: 0, y: 30 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 1, delay: 0.4, ease: [0.22, 1, 0.36, 1] }}
                    >
                        <p className="text-[11px] font-bold text-white/20 tracking-[0.3em] uppercase mb-6">
                            Design Intelligence for Architecture
                        </p>
                        <h1 className="text-4xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight leading-[1.05]">
                            You design buildings.
                            <br />
                            <span className="bg-gradient-to-r from-white/90 to-white/50 bg-clip-text text-transparent">
                                We automate the rest.
                            </span>
                        </h1>
                        <p className="mt-6 text-white/30 text-sm sm:text-base max-w-lg mx-auto leading-relaxed">
                            Feasibility, parking, compliance, massing &mdash;
                            the hours of calculation that keep you from designing.
                            Automated.
                        </p>
                        <div className="mt-6 flex flex-col items-center gap-1.5 pointer-events-none">
                            <p className="text-[11px] text-white/20 tracking-wide">
                                Click anywhere. Drag to sculpt. Watch it form.
                            </p>
                            <motion.div
                                className="w-5 h-5 rounded-full border border-white/10 flex items-center justify-center"
                                animate={{ scale: [1, 1.3, 1], opacity: [0.15, 0.3, 0.15] }}
                                transition={{ repeat: Infinity, duration: 2, ease: 'easeInOut' }}
                            >
                                <div className="w-1.5 h-1.5 rounded-full bg-white/20" />
                            </motion.div>
                        </div>
                    </motion.div>

                    <motion.div
                        className="absolute bottom-10"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 2.5 }}
                    >
                        <motion.div
                            className="flex flex-col items-center gap-2"
                            animate={{ y: [0, 6, 0] }}
                            transition={{ repeat: Infinity, duration: 2.5, ease: 'easeInOut' }}
                        >
                            <span className="text-[10px] text-white/15 tracking-widest uppercase font-bold">Scroll</span>
                            <svg className="w-4 h-4 text-white/10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                            </svg>
                        </motion.div>
                    </motion.div>
                </section>

                {/* ═══════ THE PROBLEM ═══════ */}
                <section className="py-24 sm:py-32">
                    <div className="max-w-2xl mx-auto px-6 text-center">
                        <Reveal>
                            <p className="text-[11px] font-bold text-white/15 tracking-[0.25em] uppercase mb-8">
                                The industry problem
                            </p>
                            <h2 className="text-2xl sm:text-4xl font-extrabold tracking-tight leading-snug">
                                <span className="text-white/80">Hours of calculation</span>
                                <br />
                                <span className="text-white/20">for minutes of design.</span>
                            </h2>
                            <p className="mt-8 text-sm text-white/30 max-w-md mx-auto leading-relaxed">
                                Area takeoffs. Financial models. Parking counts. Code compliance. Massing studies.
                                <br /><br />
                                The same repetitive work, every project, everywhere in the world.
                                <br />
                                <span className="text-white/50">It doesn&apos;t have to be this way.</span>
                            </p>
                        </Reveal>
                    </div>
                </section>

                {/* ═══════ THE TOOLS ═══════ */}
                <section className="pb-16 sm:pb-24">
                    <div className="max-w-2xl mx-auto px-4 sm:px-6">
                        <Reveal>
                            <p className="text-[10px] font-bold text-white/15 tracking-[0.3em] uppercase mb-12 text-center">
                                Four tools. One platform.
                            </p>
                        </Reveal>
                        <div className="space-y-4">
                            {TOOLS.map((tool, i) => (
                                <ToolCard key={tool.name} tool={tool} index={i} />
                            ))}
                        </div>
                    </div>
                </section>

                {/* ═══════ THE SHIFT ═══════ */}
                <section className="py-24 sm:py-32">
                    <div className="max-w-2xl mx-auto px-6 text-center">
                        <Reveal>
                            <p className="text-[10px] font-bold text-emerald-400/30 tracking-[0.3em] uppercase mb-6">
                                The result
                            </p>
                            <h2 className="text-3xl sm:text-5xl font-extrabold tracking-tight leading-tight text-white/90">
                                Less calculating.
                                <br />
                                <span className="text-emerald-400">More designing.</span>
                            </h2>
                            <p className="mt-8 text-white/30 text-sm max-w-sm mx-auto leading-relaxed">
                                Every tool works with your existing design workflow.
                                <br />
                                No new file formats. No learning curve. No lock-in.
                            </p>
                        </Reveal>
                    </div>
                </section>

                {/* ═══════ CTA ═══════ */}
                <section className="py-24 sm:py-32">
                    <div className="max-w-2xl mx-auto px-6 text-center">
                        <Reveal>
                            <h2 className="text-3xl sm:text-5xl font-extrabold tracking-tight leading-tight">
                                Start designing.
                                <br />
                                <span className="text-white/25">Stop calculating.</span>
                            </h2>
                            <div className="mt-12 flex flex-wrap justify-center gap-4 pointer-events-auto">
                                <Link
                                    to="/register"
                                    className="bg-white text-slate-900 px-8 py-3.5 rounded-full text-sm font-bold hover:shadow-xl hover:shadow-white/10 transition-all hover:-translate-y-0.5"
                                >
                                    Get started with RSI
                                </Link>
                                <Link
                                    to="/rsi"
                                    className="bg-white/[0.06] border border-white/[0.1] text-white/60 px-8 py-3.5 rounded-full text-sm font-semibold hover:bg-white/[0.1] transition-all backdrop-blur-sm"
                                >
                                    See what RSI does
                                </Link>
                            </div>
                        </Reveal>
                    </div>
                </section>

                {/* Footer */}
                <footer className="py-8 px-6 pointer-events-auto bg-[#050508]/80 backdrop-blur-sm">
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-white/15 max-w-3xl mx-auto">
                        <span>&copy; {new Date().getFullYear()} GenFabTools</span>
                        <div className="flex gap-6">
                            <Link to="/contact" className="hover:text-white/40 transition-colors">Contact</Link>
                            <Link to="/about" className="hover:text-white/40 transition-colors">About</Link>
                            <Link to="/faq" className="hover:text-white/40 transition-colors">FAQ</Link>
                        </div>
                    </div>
                </footer>
            </div>
        </div>
    );
}
