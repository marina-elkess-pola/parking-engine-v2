import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence, useInView } from 'framer-motion';
import * as THREE from 'three';
import { SHOW_DRAFT_TOOLS } from './config/featureFlags';

/* ───────────────────────────────────────────────────────────
   VERSION 16 — "The Living City: Architect Mode"
   The V7 city grid reimagined as a deep interactive sandbox.

   MODES (toolbar or keys 1-4):
     1. SCULPT  — mouse raises buildings, hold to push down
     2. BUILD   — click to place new towers at cursor
     3. DESTROY — click buildings to demolish (particle burst)
     4. ZONE    — paint tool colors onto buildings (cycles tools)

   EXTRA INTERACTIONS:
     • Scroll wheel = orbit camera around the city
     • Space = shockwave pulse from cursor position
     • N = toggle night mode
     • R = reset city to flat
     • Right-click = destroy in any mode
     • Live HUD: building count, tallest, zoned %, city score
     • Cursor glow ring on ground plane shows influence area
   ─────────────────────────────────────────────────────────── */

const TOOL_DEFS = [
    { id: 'rsi', name: 'RSI', full: 'Residential Scheme Intelligence', color: 0x14b8a6, hex: '#14b8a6', status: 'live', link: '/rsi' },
    { id: 'sitegen', name: 'SiteGen', full: 'Site Generator', color: 0x3b82f6, hex: '#3b82f6', status: 'coming' },
    { id: 'occucalc', name: 'OccuCalc', full: 'Occupancy Calculator', color: 0x8b5cf6, hex: '#8b5cf6', status: 'coming' },
    { id: 'parkcore', name: 'ParkCore', full: 'Parking Core Engine', color: 0xf59e0b, hex: '#f59e0b', status: 'coming' },
];

const MODES = ['sculpt', 'build', 'destroy', 'zone'];
const MODE_LABELS = { sculpt: 'Sculpt', build: 'Build', destroy: 'Destroy', zone: 'Zone' };
const MODE_ICONS = { sculpt: '\u270B', build: '\u{1F3D7}\uFE0F', destroy: '\u{1F4A5}', zone: '\u{1F3A8}' };
const MODE_CURSORS = { sculpt: 'grab', build: 'crosshair', destroy: 'pointer', zone: 'cell' };

function CityCanvas({ className, mode, onStats, onEvent }) {
    const mountRef = useRef(null);
    const stateRef = useRef({
        mx: 0, my: 0, ndcX: 0, ndcY: 0,
        mouseDown: false, rightDown: false,
        clicked: false, rightClicked: false,
        shockwave: null,
        night: false, nightTransition: 0,
        orbitAngle: 0,
        zoneIdx: 0,
    });

    const controlsRef = useRef({
        triggerShockwave: () => { },
        toggleNight: () => { },
        resetCity: () => { },
    });

    useEffect(() => {
        const container = mountRef.current;
        if (!container) return;
        let W = container.clientWidth;
        let H = container.clientHeight;
        const S = stateRef.current;

        // ── Scene ──
        const scene = new THREE.Scene();
        scene.fog = new THREE.FogExp2(0x0a0a0f, 0.035);

        const camera = new THREE.PerspectiveCamera(50, W / H, 0.1, 100);
        camera.position.set(0, 16, 20);
        camera.lookAt(0, 0, 0);

        const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        renderer.setSize(W, H);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.setClearColor(0x0a0a0f, 1);
        container.appendChild(renderer.domElement);

        // ── Grid of buildings ──
        const gridSize = 24;
        const spacing = 0.8;
        const buildings = [];
        const baseGeom = new THREE.BoxGeometry(0.52, 1, 0.52);

        const brandColors = [
            new THREE.Color(0x14b8a6),
            new THREE.Color(0x3b82f6),
            new THREE.Color(0x8b5cf6),
            new THREE.Color(0xf59e0b),
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
                buildings.push({
                    mesh, mat, ix, iz,
                    baseX: x, baseZ: z,
                    targetHeight: 0.1,
                    velocity: 0,
                    zoneColor: null,
                    alive: true,
                });
            }
        }

        // ── Placed buildings (build mode) ──
        const placed = [];

        // ── Debris particles (destroy mode) ──
        const debrisPool = [];
        const debrisGeo = new THREE.BoxGeometry(0.08, 0.08, 0.08);

        function spawnDebris(x, y, z, color) {
            const count = 15 + Math.floor(Math.random() * 10);
            for (let i = 0; i < count; i++) {
                const dMat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 1 });
                const d = new THREE.Mesh(debrisGeo, dMat);
                d.position.set(x, y, z);
                d.userData = {
                    vx: (Math.random() - 0.5) * 8,
                    vy: 3 + Math.random() * 6,
                    vz: (Math.random() - 0.5) * 8,
                    life: 1.0,
                    decay: 0.6 + Math.random() * 0.8,
                };
                scene.add(d);
                debrisPool.push(d);
            }
        }

        // ── Cursor ring on ground ──
        const ringGeo = new THREE.RingGeometry(1.8, 2.0, 48);
        const ringMat = new THREE.MeshBasicMaterial({ color: 0x14b8a6, transparent: true, opacity: 0.15, side: THREE.DoubleSide });
        const cursorRing = new THREE.Mesh(ringGeo, ringMat);
        cursorRing.rotation.x = -Math.PI / 2;
        cursorRing.position.y = 0.02;
        scene.add(cursorRing);

        // ── Shockwave ring ──
        const swGeo = new THREE.RingGeometry(0.1, 0.3, 48);
        const swMat = new THREE.MeshBasicMaterial({ color: 0x06b6d4, transparent: true, opacity: 0, side: THREE.DoubleSide });
        const shockwaveRing = new THREE.Mesh(swGeo, swMat);
        shockwaveRing.rotation.x = -Math.PI / 2;
        shockwaveRing.position.y = 0.03;
        scene.add(shockwaveRing);

        // ── Lighting ──
        const ambient = new THREE.AmbientLight(0x334155, 0.6);
        scene.add(ambient);
        const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
        dirLight.position.set(5, 12, 8);
        scene.add(dirLight);
        const pointLight = new THREE.PointLight(0x14b8a6, 2, 20);
        pointLight.position.set(0, 8, 0);
        scene.add(pointLight);

        // ── Raycaster ──
        const raycaster = new THREE.Raycaster();
        const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
        const intersectPoint = new THREE.Vector3();

        // ── Stats ──
        let statTimer = 0;
        function computeStats() {
            let tallest = 0;
            let zonedCount = 0;
            let aliveCount = 0;
            let totalHeight = 0;
            for (const b of buildings) {
                if (!b.alive) continue;
                aliveCount++;
                const h = b.mesh.scale.y;
                if (h > tallest) tallest = h;
                if (b.zoneColor !== null) zonedCount++;
                totalHeight += h;
            }
            const total = aliveCount + placed.length;
            const score = Math.floor(totalHeight * 10 + zonedCount * 50 + placed.length * 30);
            if (onStats) {
                onStats({ buildings: total, tallest: tallest.toFixed(1), zoned: total > 0 ? Math.round((zonedCount / total) * 100) : 0, score });
            }
        }

        // ── Imperative controls ──
        controlsRef.current.triggerShockwave = () => {
            S.shockwave = { x: intersectPoint.x, z: intersectPoint.z, t: 0, radius: 0 };
        };
        controlsRef.current.toggleNight = () => { S.night = !S.night; };
        controlsRef.current.resetCity = () => {
            for (const b of buildings) {
                b.targetHeight = 0.1;
                b.velocity = 0;
                b.alive = true;
                b.zoneColor = null;
                b.mat.color.setHex(0x1e293b);
                b.mat.emissive.setHex(0x000000);
                b.mesh.visible = true;
            }
            for (const p of placed) { scene.remove(p.mesh); p.mesh.geometry.dispose(); p.mat.dispose(); }
            placed.length = 0;
            if (onEvent) onEvent('reset');
        };

        // ── Animation ──
        let frame;
        const clock = new THREE.Clock();

        function animate() {
            frame = requestAnimationFrame(animate);
            const dt = Math.min(clock.getDelta(), 0.05);
            const elapsed = clock.elapsedTime;

            // NDC
            const ndc = new THREE.Vector2(S.ndcX, S.ndcY);
            raycaster.setFromCamera(ndc, camera);
            raycaster.ray.intersectPlane(groundPlane, intersectPoint);

            // Point light follows cursor
            pointLight.position.x += (intersectPoint.x - pointLight.position.x) * 3 * dt;
            pointLight.position.z += (intersectPoint.z - pointLight.position.z) * 3 * dt;

            // Cursor ring
            cursorRing.position.x = intersectPoint.x;
            cursorRing.position.z = intersectPoint.z;
            const modeIdx = MODES.indexOf(mode);
            const modeColor = modeIdx >= 0 && modeIdx < brandColors.length ? brandColors[modeIdx] : brandColors[0];
            ringMat.color.copy(modeColor);
            ringMat.opacity = 0.1 + Math.sin(elapsed * 3) * 0.05;

            // ── Camera orbit ──
            const orbitRadius = 20;
            const orbitHeight = 16;
            camera.position.x = Math.sin(S.orbitAngle) * orbitRadius;
            camera.position.z = Math.cos(S.orbitAngle) * orbitRadius;
            camera.position.y = orbitHeight;
            camera.lookAt(0, 0, 0);

            // ── Night transition ──
            const nightTarget = S.night ? 1 : 0;
            S.nightTransition += (nightTarget - S.nightTransition) * dt * 2;
            const nt = S.nightTransition;
            const dayBg = new THREE.Color(0x151520);
            const nightBg = new THREE.Color(0x050508);
            const bgColor = dayBg.clone().lerp(nightBg, nt);
            renderer.setClearColor(bgColor);
            scene.fog.color.copy(bgColor);
            dirLight.intensity = 0.8 - nt * 0.6;
            ambient.intensity = 0.6 - nt * 0.3;
            pointLight.intensity = 1.5 + nt * 2;

            // ── Shockwave ──
            if (S.shockwave) {
                const sw = S.shockwave;
                sw.t += dt;
                sw.radius += dt * 12;
                const swAlpha = Math.max(0, 1 - sw.t * 1.5);
                shockwaveRing.position.x = sw.x;
                shockwaveRing.position.z = sw.z;
                shockwaveRing.scale.set(sw.radius, sw.radius, 1);
                swMat.opacity = swAlpha * 0.4;
                for (const b of buildings) {
                    if (!b.alive) continue;
                    const dx = b.baseX - sw.x;
                    const dz = b.baseZ - sw.z;
                    const dist = Math.sqrt(dx * dx + dz * dz);
                    if (Math.abs(dist - sw.radius) < 1.5) {
                        b.velocity += (3.0 - Math.abs(dist - sw.radius)) * 8 * dt;
                    }
                }
                if (sw.t > 2) { S.shockwave = null; swMat.opacity = 0; }
            }

            // ── Update buildings ──
            const curMode = mode;
            for (const b of buildings) {
                if (!b.alive) continue;
                const dx = b.baseX - intersectPoint.x;
                const dz = b.baseZ - intersectPoint.z;
                const dist = Math.sqrt(dx * dx + dz * dz);

                if (curMode === 'sculpt') {
                    const influence = Math.max(0, 1 - dist / 4);
                    if (S.mouseDown && !S.rightDown && influence > 0) {
                        b.targetHeight = Math.min(b.targetHeight + influence * 8 * dt, 8);
                    } else if (S.rightDown && influence > 0) {
                        b.targetHeight = Math.max(b.targetHeight - influence * 6 * dt, 0.1);
                    }
                    let target = b.targetHeight;
                    const passiveInfluence = Math.max(0, 1 - dist / 3.5);
                    target += passiveInfluence * 2;
                    const wave = Math.sin(b.baseX * 0.5 + elapsed * 0.8) * Math.cos(b.baseZ * 0.5 + elapsed * 0.6) * 0.2;
                    target += wave;
                    const spring = 6, damping = 4;
                    b.velocity += (target - b.mesh.scale.y) * spring * dt;
                    b.velocity *= Math.max(0, 1 - damping * dt);
                    b.mesh.scale.y += b.velocity * dt;
                    b.mesh.scale.y = Math.max(0.05, b.mesh.scale.y);
                } else {
                    let target = b.targetHeight;
                    const wave = Math.sin(b.baseX * 0.4 + elapsed * 0.5) * Math.cos(b.baseZ * 0.4 + elapsed * 0.4) * 0.15;
                    target += wave;
                    const spring = 4, damping = 4;
                    b.velocity += (target - b.mesh.scale.y) * spring * dt;
                    b.velocity *= Math.max(0, 1 - damping * dt);
                    b.mesh.scale.y += b.velocity * dt;
                    b.mesh.scale.y = Math.max(0.05, b.mesh.scale.y);
                }

                b.mesh.position.y = b.mesh.scale.y * 0.5;

                // Color
                const heightNorm = Math.min(b.mesh.scale.y / 5, 1);
                if (b.zoneColor !== null) {
                    const zc = new THREE.Color(b.zoneColor);
                    b.mat.emissive.copy(zc).multiplyScalar(0.2 + heightNorm * 0.4 + nt * 0.3);
                    b.mat.color.setHex(0x1e293b).lerp(zc, 0.3 + heightNorm * 0.2);
                } else {
                    const colorIdx = Math.floor(heightNorm * (brandColors.length - 1));
                    const nextIdx = Math.min(colorIdx + 1, brandColors.length - 1);
                    const t = (heightNorm * (brandColors.length - 1)) - colorIdx;
                    const col = brandColors[colorIdx].clone().lerp(brandColors[nextIdx], t);
                    b.mat.emissive.copy(col).multiplyScalar(heightNorm * 0.4 + nt * 0.3);
                    b.mat.color.setHex(0x1e293b).lerp(col, heightNorm * 0.25);
                }
                if (dist < 2) { b.mat.emissive.addScalar((1 - dist / 2) * 0.15); }
            }

            // ── Placed buildings pulse ──
            for (const p of placed) {
                if (p.growT < 1) { p.growT = Math.min(p.growT + dt * 3, 1); const ease = 1 - Math.pow(1 - p.growT, 3); p.mesh.scale.set(ease, ease, ease); }
                p.mat.emissiveIntensity = 0.1 + Math.sin(elapsed * 2 + p.x) * 0.05 + nt * 0.2;
            }

            // ── Debris ──
            for (let i = debrisPool.length - 1; i >= 0; i--) {
                const d = debrisPool[i];
                const u = d.userData;
                u.vy -= 15 * dt;
                d.position.x += u.vx * dt;
                d.position.y += u.vy * dt;
                d.position.z += u.vz * dt;
                d.rotation.x += u.vx * dt * 2;
                d.rotation.z += u.vz * dt * 2;
                u.life -= u.decay * dt;
                d.material.opacity = Math.max(0, u.life);
                if (u.life <= 0 || d.position.y < -1) { scene.remove(d); d.material.dispose(); debrisPool.splice(i, 1); }
            }

            // ── Build click ──
            if (S.clicked && curMode === 'build') {
                S.clicked = false;
                const bw = 0.4 + Math.random() * 0.4;
                const bh = 2 + Math.random() * 5;
                const geo = new THREE.BoxGeometry(bw, bh, bw);
                const toolColor = brandColors[placed.length % brandColors.length];
                const mat = new THREE.MeshStandardMaterial({ color: toolColor.clone().multiplyScalar(0.4), emissive: toolColor, emissiveIntensity: 0.15, metalness: 0.4, roughness: 0.5 });
                const mesh = new THREE.Mesh(geo, mat);
                mesh.position.set(intersectPoint.x, bh / 2, intersectPoint.z);
                mesh.scale.set(0.01, 0.01, 0.01);
                scene.add(mesh);
                placed.push({ mesh, mat, x: intersectPoint.x, z: intersectPoint.z, height: bh, growT: 0 });
                if (onEvent) onEvent('build');
            }

            // ── Destroy click ──
            if ((S.clicked && curMode === 'destroy') || S.rightClicked) {
                S.clicked = false;
                S.rightClicked = false;
                raycaster.setFromCamera(ndc, camera);
                const meshes = buildings.filter(b => b.alive).map(b => b.mesh);
                const hits = raycaster.intersectObjects(meshes);
                if (hits.length > 0) {
                    const hitMesh = hits[0].object;
                    const bld = buildings.find(b => b.mesh === hitMesh);
                    if (bld && bld.alive) {
                        bld.alive = false;
                        bld.mesh.visible = false;
                        spawnDebris(bld.mesh.position.x, bld.mesh.position.y, bld.mesh.position.z, bld.zoneColor !== null ? bld.zoneColor : 0x1e293b);
                        if (onEvent) onEvent('destroy');
                    }
                }
            }

            // ── Zone click ──
            if (S.clicked && curMode === 'zone') {
                S.clicked = false;
                raycaster.setFromCamera(ndc, camera);
                const meshes = buildings.filter(b => b.alive).map(b => b.mesh);
                const hits = raycaster.intersectObjects(meshes);
                if (hits.length > 0) {
                    const hitMesh = hits[0].object;
                    const bld = buildings.find(b => b.mesh === hitMesh);
                    if (bld) {
                        const tool = TOOL_DEFS[S.zoneIdx % TOOL_DEFS.length];
                        bld.zoneColor = tool.color;
                        S.zoneIdx++;
                        if (onEvent) onEvent('zone');
                    }
                }
            }

            // ── Sculpt click (consume) ──
            if (S.clicked && curMode === 'sculpt') { S.clicked = false; }

            // Stats
            statTimer += dt;
            if (statTimer > 0.5) { statTimer = 0; computeStats(); }

            renderer.render(scene, camera);
        }
        animate();

        // ── Events ──
        function onMouseMove(e) {
            const rect = container.getBoundingClientRect();
            S.mx = e.clientX - rect.left;
            S.my = e.clientY - rect.top;
            S.ndcX = (S.mx / rect.width) * 2 - 1;
            S.ndcY = -(S.my / rect.height) * 2 + 1;
        }
        function onMouseDown(e) { if (e.button === 0) S.mouseDown = true; if (e.button === 2) S.rightDown = true; }
        function onMouseUp(e) { if (e.button === 0) S.mouseDown = false; if (e.button === 2) S.rightDown = false; }
        function onClick(e) { if (e.button === 0) S.clicked = true; }
        function onContextMenu(e) { e.preventDefault(); S.rightClicked = true; }
        function onWheel(e) { e.preventDefault(); S.orbitAngle += e.deltaY * 0.002; }
        function onTouchStart(e) {
            if (e.touches.length > 0) {
                const rect = container.getBoundingClientRect();
                S.ndcX = ((e.touches[0].clientX - rect.left) / rect.width) * 2 - 1;
                S.ndcY = -((e.touches[0].clientY - rect.top) / rect.height) * 2 + 1;
                S.mouseDown = true;
                S.clicked = true;
            }
        }
        function onTouchMove(e) {
            if (e.touches.length > 0) {
                const rect = container.getBoundingClientRect();
                S.ndcX = ((e.touches[0].clientX - rect.left) / rect.width) * 2 - 1;
                S.ndcY = -((e.touches[0].clientY - rect.top) / rect.height) * 2 + 1;
            }
            if (e.touches.length === 2) { S.orbitAngle += 0.02; }
        }
        function onTouchEnd() { S.mouseDown = false; }
        function onResize() {
            W = container.clientWidth; H = container.clientHeight;
            camera.aspect = W / H; camera.updateProjectionMatrix();
            renderer.setSize(W, H);
        }

        container.addEventListener('mousemove', onMouseMove);
        container.addEventListener('mousedown', onMouseDown);
        container.addEventListener('mouseup', onMouseUp);
        container.addEventListener('click', onClick);
        container.addEventListener('contextmenu', onContextMenu);
        container.addEventListener('wheel', onWheel, { passive: false });
        container.addEventListener('touchstart', onTouchStart, { passive: true });
        container.addEventListener('touchmove', onTouchMove, { passive: true });
        container.addEventListener('touchend', onTouchEnd);
        window.addEventListener('resize', onResize);

        return () => {
            cancelAnimationFrame(frame);
            container.removeEventListener('mousemove', onMouseMove);
            container.removeEventListener('mousedown', onMouseDown);
            container.removeEventListener('mouseup', onMouseUp);
            container.removeEventListener('click', onClick);
            container.removeEventListener('contextmenu', onContextMenu);
            container.removeEventListener('wheel', onWheel);
            container.removeEventListener('touchstart', onTouchStart);
            container.removeEventListener('touchmove', onTouchMove);
            container.removeEventListener('touchend', onTouchEnd);
            window.removeEventListener('resize', onResize);
            renderer.dispose();
            if (container.contains(renderer.domElement)) container.removeChild(renderer.domElement);
        };
    }, [mode, onStats, onEvent]);

    return <div ref={mountRef} className={className} style={{ cursor: MODE_CURSORS[mode] || 'default' }} />;
}

// Global controls bridge
const controlsGlobal = { current: null };

/* ── Floating Nav ── */
function FloatingNav() {
    const [scrolled, setScrolled] = useState(false);
    useEffect(() => {
        const fn = () => setScrolled(window.scrollY > 50);
        window.addEventListener('scroll', fn, { passive: true });
        return () => window.removeEventListener('scroll', fn);
    }, []);
    return (
        <motion.nav
            className="fixed top-0 left-0 right-0 z-50 px-6 py-3 flex items-center justify-between transition-colors duration-300"
            style={{ backgroundColor: scrolled ? 'rgba(10,10,15,0.9)' : 'rgba(10,10,15,0.5)', backdropFilter: 'blur(12px)' }}
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
                <Link to="/register" className="text-sm bg-white/10 hover:bg-white/15 text-white px-4 py-2 rounded-full font-medium transition-colors border border-white/10">
                    Get Started
                </Link>
            </div>
        </motion.nav>
    );
}

/* ── Reveal ── */
function Reveal({ children, className = '', delay = 0 }) {
    const ref = useRef(null);
    const inView = useInView(ref, { once: true, margin: '-60px' });
    return (
        <motion.div ref={ref} className={className}
            initial={{ opacity: 0, y: 28 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.7, delay, ease: [0.22, 1, 0.36, 1] }}
        >{children}</motion.div>
    );
}

export default function HomeV16() {
    const [mode, setMode] = useState('sculpt');
    const [stats, setStats] = useState({ buildings: 0, tallest: '0.0', zoned: 0, score: 0 });
    const [toast, setToast] = useState(null);
    const [showHelp, setShowHelp] = useState(true);
    const canvasRef = useRef(null);

    useEffect(() => { const t = setTimeout(() => setShowHelp(false), 8000); return () => clearTimeout(t); }, []);

    const onEvent = useCallback((type) => {
        const labels = { build: '\u{1F3D7}\uFE0F Tower placed!', destroy: '\u{1F4A5} Demolished!', zone: '\u{1F3A8} Zoned!', reset: '\u{1F504} City reset!' };
        setToast(labels[type] || null);
        setTimeout(() => setToast(null), 1200);
    }, []);

    // Keyboard shortcuts
    useEffect(() => {
        function onKey(e) {
            if (e.key === '1') setMode('sculpt');
            else if (e.key === '2') setMode('build');
            else if (e.key === '3') setMode('destroy');
            else if (e.key === '4') setMode('zone');
            else if (e.key === ' ' || e.code === 'Space') {
                e.preventDefault();
                if (controlsGlobal.current) controlsGlobal.current.triggerShockwave();
            }
            else if (e.key === 'n' || e.key === 'N') { if (controlsGlobal.current) controlsGlobal.current.toggleNight(); }
            else if (e.key === 'r' || e.key === 'R') { if (controlsGlobal.current) controlsGlobal.current.resetCity(); }
        }
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, []);

    // Bridge controls from canvas
    const onCanvasMount = useCallback((ref) => {
        if (ref) controlsGlobal.current = ref;
    }, []);

    return (
        <div className="bg-[#0a0a0f] text-white selection:bg-teal-400/30 overflow-x-hidden">
            <FloatingNav />

            {/* ── Hero: Full-screen 3D City ── */}
            <section className="relative w-full h-screen overflow-hidden">
                <CityCanvas className="absolute inset-0 w-full h-full" mode={mode} onStats={setStats} onEvent={onEvent} />

                {/* Gradient overlay */}
                <div className="absolute inset-0 pointer-events-none" style={{ background: 'linear-gradient(to bottom, rgba(10,10,15,0.15), transparent 30%, transparent 70%, rgba(10,10,15,0.4))' }} />

                {/* Title */}
                <motion.div
                    className="absolute top-[9%] left-1/2 -translate-x-1/2 text-center pointer-events-none z-10 px-4"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 1, delay: 0.3 }}
                >
                    <h1 className="text-4xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight leading-[1.0]">
                        Architect
                        <span className="bg-gradient-to-r from-teal-400 via-blue-400 to-purple-400 bg-clip-text text-transparent"> Mode</span>
                    </h1>
                    <p className="mt-2 text-xs sm:text-sm text-white/25 max-w-sm mx-auto">
                        Sculpt &middot; Build &middot; Destroy &middot; Zone &mdash; this is your city.
                    </p>
                </motion.div>

                {/* ── MODE TOOLBAR ── */}
                <motion.div
                    className="absolute left-1/2 -translate-x-1/2 bottom-6 z-30 flex items-center gap-1 bg-slate-900/80 backdrop-blur-xl border border-white/10 rounded-2xl p-1.5"
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: 0.8 }}
                >
                    {MODES.map((m, i) => (
                        <button
                            key={m}
                            onClick={() => setMode(m)}
                            className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold transition-all duration-200 ${mode === m
                                    ? 'bg-white/10 text-white shadow-lg'
                                    : 'text-white/35 hover:text-white/60 hover:bg-white/5'
                                }`}
                        >
                            <span className="text-sm">{MODE_ICONS[m]}</span>
                            <span className="hidden sm:inline">{MODE_LABELS[m]}</span>
                            <span className="text-[9px] text-white/20 hidden sm:inline font-mono ml-1">{i + 1}</span>
                        </button>
                    ))}
                </motion.div>

                {/* ── STATS HUD ── */}
                <motion.div
                    className="absolute top-16 right-4 z-20 bg-slate-900/60 backdrop-blur-xl border border-white/[0.06] rounded-xl p-3 text-right min-w-[140px]"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 1 }}
                >
                    <div className="text-[10px] font-bold text-white/20 tracking-widest mb-2">CITY STATS</div>
                    <div className="space-y-1.5">
                        <div className="flex items-center justify-between gap-4">
                            <span className="text-[10px] text-white/30">Buildings</span>
                            <span className="text-xs font-bold text-white/70 font-mono">{stats.buildings}</span>
                        </div>
                        <div className="flex items-center justify-between gap-4">
                            <span className="text-[10px] text-white/30">Tallest</span>
                            <span className="text-xs font-bold text-white/70 font-mono">{stats.tallest}</span>
                        </div>
                        <div className="flex items-center justify-between gap-4">
                            <span className="text-[10px] text-white/30">Zoned</span>
                            <span className="text-xs font-bold text-white/70 font-mono">{stats.zoned}%</span>
                        </div>
                        <div className="border-t border-white/5 pt-1.5 flex items-center justify-between gap-4">
                            <span className="text-[10px] text-white/30">Score</span>
                            <span className="text-xs font-extrabold text-teal-400/80 font-mono">{stats.score}</span>
                        </div>
                    </div>
                </motion.div>

                {/* ── KEYBOARD SHORTCUTS ── */}
                <AnimatePresence>
                    {showHelp && (
                        <motion.div
                            className="absolute top-16 left-4 z-20 bg-slate-900/60 backdrop-blur-xl border border-white/[0.06] rounded-xl p-3"
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            transition={{ duration: 0.3 }}
                        >
                            <div className="text-[10px] font-bold text-white/20 tracking-widest mb-2">CONTROLS</div>
                            <div className="space-y-1 text-[10px]">
                                <div className="flex gap-2"><kbd className="bg-white/5 px-1.5 py-0.5 rounded text-white/40 font-mono">1-4</kbd><span className="text-white/30">Switch mode</span></div>
                                <div className="flex gap-2"><kbd className="bg-white/5 px-1.5 py-0.5 rounded text-white/40 font-mono">Scroll</kbd><span className="text-white/30">Orbit camera</span></div>
                                <div className="flex gap-2"><kbd className="bg-white/5 px-1.5 py-0.5 rounded text-white/40 font-mono">Space</kbd><span className="text-white/30">Shockwave</span></div>
                                <div className="flex gap-2"><kbd className="bg-white/5 px-1.5 py-0.5 rounded text-white/40 font-mono">N</kbd><span className="text-white/30">Night mode</span></div>
                                <div className="flex gap-2"><kbd className="bg-white/5 px-1.5 py-0.5 rounded text-white/40 font-mono">R</kbd><span className="text-white/30">Reset city</span></div>
                                <div className="flex gap-2"><kbd className="bg-white/5 px-1.5 py-0.5 rounded text-white/40 font-mono">R-Click</kbd><span className="text-white/30">Destroy</span></div>
                            </div>
                            <button onClick={() => setShowHelp(false)} className="mt-2 text-[9px] text-white/15 hover:text-white/30 transition-colors">dismiss</button>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Toast */}
                <AnimatePresence>
                    {toast && (
                        <motion.div
                            key={toast}
                            className="absolute top-[50%] left-1/2 -translate-x-1/2 -translate-y-1/2 z-30 bg-slate-900/80 backdrop-blur-xl border border-white/10 rounded-xl px-5 py-2.5 pointer-events-none"
                            initial={{ opacity: 0, scale: 0.8, y: 10 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.8 }}
                            transition={{ duration: 0.2 }}
                        >
                            <span className="text-sm font-bold text-white/80">{toast}</span>
                        </motion.div>
                    )}
                </AnimatePresence>
            </section>

            {/* ── Below fold ── */}
            <section className="py-28 lg:py-36 border-t border-white/5">
                <div className="px-6 sm:px-12 lg:px-20 max-w-4xl mx-auto text-center">
                    <Reveal>
                        <h2 className="text-3xl sm:text-5xl font-extrabold tracking-tight">
                            Design tools that feel
                            <br />
                            <span className="text-white/30">this responsive.</span>
                        </h2>
                        <p className="mt-6 text-slate-500 max-w-md mx-auto">
                            GenFabTools builds AEC utilities with the same attention to interactivity you just experienced.
                        </p>
                    </Reveal>

                    <Reveal delay={0.15}>
                        <div className="mt-12 grid sm:grid-cols-2 gap-4 max-w-2xl mx-auto">
                            {TOOL_DEFS.map(t => (
                                <div key={t.id} className="bg-white/[0.02] border border-white/[0.05] rounded-xl p-5 text-left hover:bg-white/[0.04] transition-all">
                                    <div className="flex items-center gap-2 mb-2">
                                        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: t.hex }} />
                                        <span className="font-bold text-sm text-white/80">{t.name}</span>
                                        {t.status === 'live' && <span className="text-[10px] text-emerald-400 font-bold">&bull; LIVE</span>}
                                    </div>
                                    <p className="text-xs text-slate-500">{t.full}</p>
                                    {t.link && <Link to={t.link} className="text-xs font-semibold mt-2 inline-block" style={{ color: t.hex }}>Explore &rarr;</Link>}
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

            {/* Footer */}
            <footer className="border-t border-white/5 py-8 px-6 sm:px-12 lg:px-20">
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-600">
                    <span>&copy; {new Date().getFullYear()} GenFabTools</span>
                    <div className="flex gap-6">
                        <Link to="/contact" className="hover:text-white transition-colors">Contact</Link>
                        <Link to="/about" className="hover:text-white transition-colors">About</Link>
                    </div>
                </div>
            </footer>
        </div>
    );
}
