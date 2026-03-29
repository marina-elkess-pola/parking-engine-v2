import React, { useRef, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, useInView, useScroll } from 'framer-motion';
import * as THREE from 'three';

/* ───────────────────────────────────────────────────────────
   VERSION 19 — "Platform Showcase"

   Background: Pure atmospheric particle city.
   Slow orbit, scroll grows buildings, no interactions.
   Just mood and brand.

   Tool cards: Each has a micro-demo canvas that plays
   on hover — a tiny animated preview of what the tool
   actually does. THIS is where the fun lives.
   ─────────────────────────────────────────────────────────── */

/* ════════════════════════════════════════════════════════════
   ATMOSPHERIC CITY — particles forming wireframe buildings
   No click/drag — purely ambient background
   ════════════════════════════════════════════════════════════ */

const CITY_LAYOUT = [
    { x: -7, z: -5, w: 2.5, d: 2, h: 6 },
    { x: -3.5, z: -5, w: 2, d: 2.5, h: 10 },
    { x: 0, z: -5, w: 3, d: 2, h: 4 },
    { x: 4, z: -5, w: 2.5, d: 2.5, h: 8 },
    { x: -6, z: -1, w: 2, d: 3, h: 7 },
    { x: -2.5, z: -1, w: 3, d: 2, h: 12 },
    { x: 2, z: -1, w: 2.5, d: 2.5, h: 5 },
    { x: 5.5, z: -1, w: 2, d: 2, h: 9 },
    { x: -5, z: 3.5, w: 3, d: 2, h: 8 },
    { x: -1, z: 3.5, w: 2, d: 3, h: 6 },
    { x: 3, z: 3.5, w: 3.5, d: 2.5, h: 11 },
];

function getBuildingEdges(b, heightScale) {
    const hw = b.w / 2, hd = b.d / 2;
    const h = b.h * heightScale;
    const x = b.x, z = b.z;
    return [
        [[x - hw, 0, z - hd], [x + hw, 0, z - hd]], [[x + hw, 0, z - hd], [x + hw, 0, z + hd]],
        [[x + hw, 0, z + hd], [x - hw, 0, z + hd]], [[x - hw, 0, z + hd], [x - hw, 0, z - hd]],
        [[x - hw, h, z - hd], [x + hw, h, z - hd]], [[x + hw, h, z - hd], [x + hw, h, z + hd]],
        [[x + hw, h, z + hd], [x - hw, h, z + hd]], [[x - hw, h, z + hd], [x - hw, h, z - hd]],
        [[x - hw, 0, z - hd], [x - hw, h, z - hd]], [[x + hw, 0, z - hd], [x + hw, h, z - hd]],
        [[x + hw, 0, z + hd], [x + hw, h, z + hd]], [[x - hw, 0, z + hd], [x - hw, h, z + hd]],
    ];
}

function AtmosphericCity({ className, scrollProgress }) {
    const mountRef = useRef(null);
    const progressRef = useRef(0);
    useEffect(() => { progressRef.current = scrollProgress; }, [scrollProgress]);

    useEffect(() => {
        const el = mountRef.current;
        if (!el) return;
        let W = el.clientWidth, H = el.clientHeight;

        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(50, W / H, 0.1, 200);
        camera.position.set(0, 14, 22);
        camera.lookAt(0, 2, 0);

        const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        renderer.setSize(W, H);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.setClearColor(0x050508, 1);
        el.appendChild(renderer.domElement);

        const vtx = `
            attribute float aSize;
            attribute float aBright;
            varying float vB;
            void main() {
                vB = aBright;
                vec4 mv = modelViewMatrix * vec4(position, 1.0);
                gl_PointSize = aSize * (250.0 / -mv.z);
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

        const PARTICLE_COUNT = 2000;
        const positions = new Float32Array(PARTICLE_COUNT * 3);
        const aSize = new Float32Array(PARTICLE_COUNT);
        const aBright = new Float32Array(PARTICLE_COUNT);
        const targetPos = new Float32Array(PARTICLE_COUNT * 3);
        const baseSize = new Float32Array(PARTICLE_COUNT);
        const flowPhase = new Float32Array(PARTICLE_COUNT);

        for (let i = 0; i < PARTICLE_COUNT; i++) {
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.acos(2 * Math.random() - 1);
            const r = 8 + Math.random() * 8;
            positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
            positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta) + 4;
            positions[i * 3 + 2] = r * Math.cos(phi);
            baseSize[i] = 0.6 + Math.random() * 1.2;
            aSize[i] = baseSize[i];
            aBright[i] = 0.1;
            flowPhase[i] = Math.random();
        }

        function assignTargets(heightScale) {
            const allEdges = [];
            for (const b of CITY_LAYOUT) {
                const edges = getBuildingEdges(b, heightScale);
                for (const e of edges) allEdges.push(e);
            }
            for (let gx = -9; gx <= 9; gx += 3) allEdges.push([[gx, 0, -8], [gx, 0, 8]]);
            for (let gz = -8; gz <= 8; gz += 3) allEdges.push([[-9, 0, gz], [9, 0, gz]]);

            for (let i = 0; i < PARTICLE_COUNT; i++) {
                const edge = allEdges[i % allEdges.length];
                const t = (i / PARTICLE_COUNT + flowPhase[i] * 0.1) % 1;
                const j = 0.05;
                targetPos[i * 3] = edge[0][0] + (edge[1][0] - edge[0][0]) * t + (Math.random() - 0.5) * j;
                targetPos[i * 3 + 1] = edge[0][1] + (edge[1][1] - edge[0][1]) * t + (Math.random() - 0.5) * j;
                targetPos[i * 3 + 2] = edge[0][2] + (edge[1][2] - edge[0][2]) * t + (Math.random() - 0.5) * j;
            }
        }
        assignTargets(0.5);

        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('aSize', new THREE.BufferAttribute(aSize, 1));
        geometry.setAttribute('aBright', new THREE.BufferAttribute(aBright, 1));

        const material = new THREE.ShaderMaterial({
            vertexShader: vtx, fragmentShader: frg,
            transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
        });
        scene.add(new THREE.Points(geometry, material));

        const gridHelper = new THREE.GridHelper(20, 20, 0x111118, 0x111118);
        gridHelper.position.y = -0.05;
        scene.add(gridHelper);

        // Dust
        const dustCount = 200;
        const dustPos = new Float32Array(dustCount * 3);
        for (let i = 0; i < dustCount; i++) {
            dustPos[i * 3] = (Math.random() - 0.5) * 60;
            dustPos[i * 3 + 1] = (Math.random() - 0.5) * 40;
            dustPos[i * 3 + 2] = (Math.random() - 0.5) * 60;
        }
        const dustGeo = new THREE.BufferGeometry();
        dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
        scene.add(new THREE.Points(dustGeo, new THREE.PointsMaterial({
            color: 0xffffff, size: 0.02, transparent: true, opacity: 0.08,
            blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true,
        })));

        let frame;
        const clock = new THREE.Clock();
        let camAngle = 0;
        let lastHS = 0;

        function animate() {
            frame = requestAnimationFrame(animate);
            const dt = Math.min(clock.getDelta(), 0.05);
            const t = clock.elapsedTime;
            const p = progressRef.current;

            const hs = 0.1 + p * 0.9;
            if (Math.abs(hs - lastHS) > 0.01) { assignTargets(hs); lastHS = hs; }

            camAngle += dt * 0.035;
            const camR = 24 - p * 6;
            camera.position.x = Math.sin(camAngle) * camR;
            camera.position.z = Math.cos(camAngle) * camR;
            camera.position.y = 16 - p * 6;
            camera.lookAt(0, p * 4, 0);

            const posArr = geometry.attributes.position.array;
            const brightArr = geometry.attributes.aBright.array;

            for (let i = 0; i < PARTICLE_COUNT; i++) {
                const convergence = Math.min(1, p * 2.5 + 0.15);
                const lerpRate = 1.8 * dt;
                posArr[i * 3] += (targetPos[i * 3] - posArr[i * 3]) * lerpRate * convergence;
                posArr[i * 3 + 1] += (targetPos[i * 3 + 1] - posArr[i * 3 + 1]) * lerpRate * convergence;
                posArr[i * 3 + 2] += (targetPos[i * 3 + 2] - posArr[i * 3 + 2]) * lerpRate * convergence;

                const flowOsc = Math.sin(t * 1.5 + i * 0.3) * 0.015;
                posArr[i * 3] += flowOsc;

                const hBright = Math.min(1, posArr[i * 3 + 1] / 8) * 0.12;
                brightArr[i] = 0.15 + p * 0.08 + hBright;
            }

            geometry.attributes.position.needsUpdate = true;
            geometry.attributes.aBright.needsUpdate = true;
            renderer.render(scene, camera);
        }
        animate();

        function onResize() {
            W = el.clientWidth; H = el.clientHeight;
            camera.aspect = W / H; camera.updateProjectionMatrix();
            renderer.setSize(W, H);
        }
        window.addEventListener('resize', onResize);

        return () => {
            cancelAnimationFrame(frame);
            window.removeEventListener('resize', onResize);
            renderer.dispose();
            if (el.contains(renderer.domElement)) el.removeChild(renderer.domElement);
        };
    }, []);

    return <div ref={mountRef} className={className} />;
}

/* ════════════════════════════════════════════════════════════
   MICRO-DEMO CANVASES — each tool gets a tiny animated preview
   ════════════════════════════════════════════════════════════ */

function useCanvasDemo(drawFn, deps = []) {
    const canvasRef = useRef(null);
    const frameRef = useRef(null);
    const startRef = useRef(0);

    const start = () => {
        startRef.current = performance.now();
        const loop = () => {
            const canvas = canvasRef.current;
            if (!canvas) return;
            const ctx = canvas.getContext('2d');
            const elapsed = (performance.now() - startRef.current) / 1000;
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            drawFn(ctx, canvas.width, canvas.height, elapsed);
            frameRef.current = requestAnimationFrame(loop);
        };
        loop();
    };

    const stop = () => {
        if (frameRef.current) cancelAnimationFrame(frameRef.current);
        const canvas = canvasRef.current;
        if (canvas) {
            const ctx = canvas.getContext('2d');
            ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
    };

    return { canvasRef, start, stop };
}

// ── RSI: Numbers cascading into a spreadsheet grid ──
function rsiDraw(ctx, w, h, t) {
    const cols = 5, rows = 6;
    const cellW = w / cols, cellH = h / rows;
    const headers = ['Type', 'GFA', 'Units', 'Eff%', 'ROI'];
    const data = [
        ['Studio', '420', '14', '82%', '12%'],
        ['1BR', '680', '22', '78%', '15%'],
        ['2BR', '1,240', '18', '81%', '18%'],
        ['3BR', '960', '8', '76%', '11%'],
        ['Retail', '340', '—', '91%', '22%'],
    ];

    // Grid lines
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.lineWidth = 1;
    for (let c = 0; c <= cols; c++) {
        ctx.beginPath(); ctx.moveTo(c * cellW, 0); ctx.lineTo(c * cellW, h); ctx.stroke();
    }
    for (let r = 0; r <= rows; r++) {
        ctx.beginPath(); ctx.moveTo(0, r * cellH); ctx.lineTo(w, r * cellH); ctx.stroke();
    }

    // Headers
    ctx.font = 'bold 9px monospace';
    ctx.fillStyle = 'rgba(20,184,166,0.7)';
    for (let c = 0; c < cols; c++) {
        if (t > 0.1) ctx.fillText(headers[c], c * cellW + 4, cellH * 0.65);
    }

    // Data cascade — each row appears 0.3s apart, each cell 0.08s apart
    ctx.font = '9px monospace';
    for (let r = 0; r < data.length; r++) {
        const rowDelay = 0.3 + r * 0.3;
        for (let c = 0; c < cols; c++) {
            const cellDelay = rowDelay + c * 0.08;
            if (t > cellDelay) {
                const alpha = Math.min(1, (t - cellDelay) * 3);
                const yOff = Math.max(0, (1 - alpha) * 8);
                ctx.fillStyle = c === 0
                    ? `rgba(255,255,255,${alpha * 0.5})`
                    : `rgba(255,255,255,${alpha * 0.7})`;
                ctx.fillText(data[r][c], c * cellW + 4, (r + 1) * cellH + cellH * 0.65 - yOff);
            }
        }
    }

    // Highlight sweep — a teal bar that moves across filled rows
    if (t > 1.5) {
        const sweepRow = Math.floor((t - 1.5) * 2) % (data.length + 1);
        if (sweepRow < data.length) {
            ctx.fillStyle = 'rgba(20,184,166,0.06)';
            ctx.fillRect(0, (sweepRow + 1) * cellH, w, cellH);
        }
    }
}

// ── ParkCore: Parking stalls filling a rectangle ──
function parkcoreDraw(ctx, w, h, t) {
    const pad = 12;
    const siteW = w - pad * 2, siteH = h - pad * 2;

    // Site boundary
    ctx.strokeStyle = 'rgba(245,158,11,0.3)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(pad, pad, siteW, siteH);

    // Drive aisle (horizontal center)
    const aisleY = pad + siteH * 0.48;
    const aisleH = siteH * 0.1;
    if (t > 0.2) {
        ctx.fillStyle = 'rgba(245,158,11,0.05)';
        ctx.fillRect(pad, aisleY, siteW, aisleH);
        ctx.strokeStyle = 'rgba(245,158,11,0.12)';
        ctx.setLineDash([4, 3]);
        ctx.beginPath();
        ctx.moveTo(pad, aisleY + aisleH / 2);
        ctx.lineTo(pad + siteW, aisleY + aisleH / 2);
        ctx.stroke();
        ctx.setLineDash([]);
    }

    // Stalls — top row and bottom row
    const stallW = siteW / 14;
    const stallHTop = (aisleY - pad) * 0.85;
    const stallHBot = (pad + siteH - aisleY - aisleH) * 0.85;
    let count = 0;

    for (let i = 0; i < 13; i++) {
        const delay = 0.4 + i * 0.1;
        if (t > delay) {
            const alpha = Math.min(1, (t - delay) * 4);
            // Top stall
            ctx.strokeStyle = `rgba(245,158,11,${alpha * 0.4})`;
            ctx.lineWidth = 0.8;
            const sx = pad + 4 + i * stallW;
            ctx.strokeRect(sx, pad + 4, stallW - 2, stallHTop);
            count++;
            // Bottom stall
            if (t > delay + 0.05) {
                ctx.strokeRect(sx, aisleY + aisleH + 2, stallW - 2, stallHBot);
                count++;
            }
        }
    }

    // Counter
    if (count > 0) {
        ctx.font = 'bold 11px monospace';
        ctx.fillStyle = 'rgba(245,158,11,0.8)';
        ctx.textAlign = 'right';
        ctx.fillText(`${count} stalls`, w - pad, h - 4);
        ctx.textAlign = 'left';
    }
}

// ── OccuCalc: Floor plan fills with occupant dots ──
function occucalcDraw(ctx, w, h, t) {
    const pad = 10;

    // L-shaped floor plan
    const rooms = [
        { x: pad, y: pad, w: w * 0.55, h: h - pad * 2, label: 'Office', cap: 42 },
        { x: pad + w * 0.55 + 2, y: pad, w: w * 0.4 - pad, h: (h - pad * 2) * 0.55, label: 'Meeting', cap: 18 },
        { x: pad + w * 0.55 + 2, y: pad + (h - pad * 2) * 0.55 + 2, w: w * 0.4 - pad, h: (h - pad * 2) * 0.44, label: 'Lobby', cap: 12 },
    ];

    let totalOcc = 0;

    rooms.forEach((room, ri) => {
        const roomDelay = ri * 0.4;
        const alpha = t > roomDelay ? Math.min(1, (t - roomDelay) * 2) : 0;
        if (alpha <= 0) return;

        // Room outline
        ctx.strokeStyle = `rgba(139,92,246,${alpha * 0.35})`;
        ctx.lineWidth = 1;
        ctx.strokeRect(room.x, room.y, room.w, room.h);

        // Room label
        ctx.font = '8px sans-serif';
        ctx.fillStyle = `rgba(139,92,246,${alpha * 0.4})`;
        ctx.fillText(room.label, room.x + 3, room.y + 10);

        // Occupant dots
        const dotDelay = roomDelay + 0.3;
        if (t > dotDelay) {
            const dotProgress = Math.min(1, (t - dotDelay) * 0.8);
            const dotCount = Math.floor(room.cap * dotProgress);
            totalOcc += dotCount;

            // Seed-based placement
            let seed = ri * 1000;
            const seededRand = () => { seed = (seed * 16807 + 0) % 2147483647; return seed / 2147483647; };

            for (let d = 0; d < dotCount; d++) {
                const dx = room.x + 6 + seededRand() * (room.w - 12);
                const dy = room.y + 16 + seededRand() * (room.h - 22);
                const popAlpha = Math.min(1, (dotProgress * room.cap - d) * 2);
                ctx.fillStyle = `rgba(139,92,246,${popAlpha * 0.7})`;
                ctx.beginPath();
                ctx.arc(dx, dy, 2, 0, Math.PI * 2);
                ctx.fill();
            }
        }
    });

    // Counter
    if (totalOcc > 0) {
        ctx.font = 'bold 11px monospace';
        ctx.fillStyle = 'rgba(139,92,246,0.8)';
        ctx.textAlign = 'right';
        ctx.fillText(`${totalOcc} occupants`, w - pad, h - 4);
        ctx.textAlign = 'left';
    }
}

// ── SiteGen: Building masses popping up on a site ──
function sitegenDraw(ctx, w, h, t) {
    const pad = 10;

    // Irregular site boundary
    const sitePoints = [
        [pad + 8, pad + 5],
        [w - pad - 5, pad + 12],
        [w - pad, h * 0.45],
        [w - pad - 15, h - pad - 5],
        [pad + 20, h - pad],
        [pad, h * 0.55],
    ];

    ctx.strokeStyle = 'rgba(59,130,246,0.25)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(sitePoints[0][0], sitePoints[0][1]);
    for (let i = 1; i < sitePoints.length; i++) ctx.lineTo(sitePoints[i][0], sitePoints[i][1]);
    ctx.closePath();
    ctx.stroke();

    // Fill with very faint site color
    ctx.fillStyle = 'rgba(59,130,246,0.03)';
    ctx.fill();

    // Building options cycle every 2.5s
    const cycle = Math.floor(t / 2.5) % 3;
    const cycleT = (t % 2.5);
    const optionNum = cycle + 1;

    const massings = [
        [ // Option 1 — L-shape + tower
            { x: 0.15, y: 0.2, w: 0.35, h: 0.55, floors: 8 },
            { x: 0.55, y: 0.15, w: 0.2, h: 0.25, floors: 14 },
            { x: 0.55, y: 0.55, w: 0.3, h: 0.3, floors: 4 },
        ],
        [ // Option 2 — Courtyard
            { x: 0.1, y: 0.12, w: 0.6, h: 0.15, floors: 6 },
            { x: 0.1, y: 0.65, w: 0.6, h: 0.15, floors: 6 },
            { x: 0.1, y: 0.27, w: 0.12, h: 0.38, floors: 6 },
            { x: 0.58, y: 0.27, w: 0.12, h: 0.38, floors: 6 },
        ],
        [ // Option 3 — Towers + podium
            { x: 0.12, y: 0.35, w: 0.6, h: 0.35, floors: 3 },
            { x: 0.15, y: 0.1, w: 0.15, h: 0.22, floors: 16 },
            { x: 0.5, y: 0.1, w: 0.15, h: 0.22, floors: 20 },
        ],
    ];

    const buildings = massings[cycle];
    const areaW = w - pad * 2, areaH = h - pad * 2;

    buildings.forEach((b, bi) => {
        const bDelay = bi * 0.25;
        if (cycleT < bDelay) return;
        const alpha = Math.min(1, (cycleT - bDelay) * 2.5);
        const popScale = Math.min(1, (cycleT - bDelay) * 4);

        const bx = pad + b.x * areaW;
        const by = pad + b.y * areaH;
        const bw = b.w * areaW * popScale;
        const bh = b.h * areaH * popScale;

        // Building footprint
        ctx.fillStyle = `rgba(59,130,246,${alpha * 0.12})`;
        ctx.fillRect(bx, by, bw, bh);
        ctx.strokeStyle = `rgba(59,130,246,${alpha * 0.5})`;
        ctx.lineWidth = 1;
        ctx.strokeRect(bx, by, bw, bh);

        // Floor count label
        if (alpha > 0.5) {
            ctx.font = 'bold 9px monospace';
            ctx.fillStyle = `rgba(59,130,246,${alpha * 0.7})`;
            ctx.textAlign = 'center';
            ctx.fillText(`${b.floors}F`, bx + bw / 2, by + bh / 2 + 3);
            ctx.textAlign = 'left';
        }
    });

    // Option indicator
    if (cycleT > 0.1) {
        ctx.font = 'bold 10px monospace';
        ctx.fillStyle = 'rgba(59,130,246,0.7)';
        ctx.textAlign = 'right';
        ctx.fillText(`Option ${optionNum} of 3`, w - pad, h - 4);
        ctx.textAlign = 'left';
    }
}

/* ════════════════════════════════════════════════════════════
   TOOL CARD — with micro-demo canvas
   ════════════════════════════════════════════════════════════ */

const TOOLS = [
    {
        name: 'RSI', full: 'Residential Scheme Intelligence', hex: '#14b8a6', status: 'Live',
        before: 'Spreadsheets, manual takeoffs, disconnected data',
        after: 'Automated feasibility analysis from your design model',
        metric: '8 seconds', metricLabel: 'vs. hours of spreadsheet work', link: '/rsi',
        draw: rsiDraw
    },
    {
        name: 'ParkCore', full: 'Parking Core Engine', hex: '#f59e0b', status: 'Coming',
        before: 'Manual stall layouts, hand-counted spaces, compliance guesswork',
        after: 'Optimized parking layouts from any site boundary',
        metric: '3 layouts', metricLabel: 'generated and compared instantly',
        draw: parkcoreDraw
    },
    {
        name: 'OccuCalc', full: 'Occupancy Calculator', hex: '#8b5cf6', status: 'Coming',
        before: 'Cross-referencing code tables, manual floor area calculations',
        after: 'Instant code-compliant occupant loads from floor plans',
        metric: '0 lookups', metricLabel: 'every code table built in',
        draw: occucalcDraw
    },
    {
        name: 'SiteGen', full: 'Site Generator', hex: '#3b82f6', status: 'Coming',
        before: 'Sketch, measure, iterate, repeat — hoping one option works',
        after: 'Optimized massing options from site constraints in seconds',
        metric: '10+ options', metricLabel: 'explored before you finish one by hand',
        draw: sitegenDraw
    },
];

function ToolCard({ tool, index }) {
    const ref = useRef(null);
    const inView = useInView(ref, { once: true, margin: '-15% 0px -15% 0px' });
    const [revealed, setRevealed] = useState(false);
    const [hovered, setHovered] = useState(false);
    useEffect(() => { if (inView) { const t = setTimeout(() => setRevealed(true), 600); return () => clearTimeout(t); } }, [inView]);

    const { canvasRef, start, stop } = useCanvasDemo(tool.draw);

    useEffect(() => {
        if (hovered && revealed) start();
        else stop();
        return stop;
    }, [hovered, revealed]);

    // Also auto-play briefly when card reveals (draws attention)
    useEffect(() => {
        if (revealed) {
            start();
            const timer = setTimeout(() => { if (!hovered) stop(); }, 3000);
            return () => clearTimeout(timer);
        }
    }, [revealed]);

    return (
        <motion.div ref={ref} className="relative pointer-events-auto"
            initial={{ opacity: 0, y: 20 }} animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6, delay: index * 0.08, ease: [0.22, 1, 0.36, 1] }}
            onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
            <div className="bg-[#0a0a0f]/70 backdrop-blur-md border border-white/[0.06] rounded-2xl p-6 sm:p-8 hover:border-white/[0.12] transition-all duration-500">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: tool.hex }} />
                        <div>
                            <h3 className="text-base font-bold text-white/90">{tool.name}</h3>
                            <p className="text-[11px] text-white/25">{tool.full}</p>
                        </div>
                    </div>
                    <span className="text-[9px] font-bold tracking-wider uppercase px-2.5 py-1 rounded-full"
                        style={{ color: tool.status === 'Live' ? tool.hex : 'rgba(255,255,255,0.2)', backgroundColor: tool.status === 'Live' ? `${tool.hex}15` : 'rgba(255,255,255,0.03)' }}>
                        {tool.status === 'Live' ? 'Live now' : 'Coming soon'}
                    </span>
                </div>

                {/* ── Micro-demo canvas ── */}
                <div className="relative w-full h-32 sm:h-36 mb-4 rounded-lg overflow-hidden border border-white/[0.04]"
                    style={{ backgroundColor: 'rgba(255,255,255,0.015)' }}>
                    <canvas ref={canvasRef} width={400} height={180} className="w-full h-full" />
                    {!hovered && !revealed && (
                        <div className="absolute inset-0 flex items-center justify-center">
                            <span className="text-[10px] text-white/15 tracking-wide">Hover to preview</span>
                        </div>
                    )}
                </div>

                <div className="mb-4">
                    <p className="text-[10px] font-bold text-white/15 tracking-widest uppercase mb-1.5">Without</p>
                    <p className="text-sm leading-relaxed transition-all duration-700"
                        style={{ color: revealed ? 'rgba(248,113,113,0.3)' : 'rgba(255,255,255,0.4)', textDecoration: revealed ? 'line-through' : 'none' }}>
                        {tool.before}
                    </p>
                </div>
                <motion.div initial={false} animate={revealed ? { opacity: 1, height: 'auto', y: 0 } : { opacity: 0, height: 0, y: 6 }}
                    transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }} className="overflow-hidden">
                    <div className="pl-4 border-l-2 mb-5" style={{ borderColor: tool.hex }}>
                        <p className="text-[10px] font-bold tracking-widest uppercase mb-1.5" style={{ color: `${tool.hex}60` }}>With {tool.name}</p>
                        <p className="text-sm text-white/80 leading-relaxed">{tool.after}</p>
                    </div>
                </motion.div>
                <motion.div initial={false} animate={revealed ? { opacity: 1 } : { opacity: 0 }} transition={{ duration: 0.5, delay: 0.3 }}
                    className="flex items-baseline gap-3">
                    <span className="text-2xl sm:text-3xl font-extrabold font-mono" style={{ color: tool.hex }}>{tool.metric}</span>
                    <span className="text-[11px] text-white/25">{tool.metricLabel}</span>
                </motion.div>
                {tool.link && revealed && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }} className="mt-5">
                        <Link to={tool.link} className="inline-flex items-center gap-1.5 text-xs font-semibold transition-colors" style={{ color: `${tool.hex}90` }}>
                            Try {tool.name}
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                        </Link>
                    </motion.div>
                )}
            </div>
        </motion.div>
    );
}

/* ═══ SHARED ═══ */

function Reveal({ children, className = '', delay = 0 }) {
    const ref = useRef(null);
    const inView = useInView(ref, { once: true, margin: '-60px' });
    return (
        <motion.div ref={ref} className={className} initial={{ opacity: 0, y: 24 }} animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.7, delay, ease: [0.22, 1, 0.36, 1] }}>{children}</motion.div>
    );
}

function FloatingNav() {
    const [scrolled, setScrolled] = useState(false);
    useEffect(() => { const fn = () => setScrolled(window.scrollY > 50); window.addEventListener('scroll', fn, { passive: true }); return () => window.removeEventListener('scroll', fn); }, []);
    return (
        <motion.nav className="fixed top-0 left-0 right-0 z-50 px-6 py-3 flex items-center justify-between pointer-events-auto transition-colors duration-300"
            style={{ backgroundColor: scrolled ? 'rgba(5,5,8,0.92)' : 'rgba(5,5,8,0.3)', backdropFilter: 'blur(12px)' }}
            initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.3 }}>
            <Link to="/" className="flex items-center gap-2.5">
                <img src="/genfabtools-logo.png" alt="" className="h-7 w-7 brightness-0 invert opacity-90" />
                <span className="text-sm font-bold text-white tracking-wide">GenFabTools</span>
            </Link>
            <div className="hidden sm:flex items-center gap-6">
                <Link to="/tools" className="text-sm text-white/50 hover:text-white transition-colors">Tools</Link>
                <Link to="/rsi" className="text-sm text-white/50 hover:text-white transition-colors">RSI</Link>
                <Link to="/about" className="text-sm text-white/50 hover:text-white transition-colors">About</Link>
                <Link to="/register" className="text-sm bg-white/10 hover:bg-white/15 text-white px-4 py-2 rounded-full font-medium transition-colors border border-white/10">Get Started</Link>
            </div>
        </motion.nav>
    );
}

/* ════════════════════════════════════════════════════════════
   MAIN PAGE
   ════════════════════════════════════════════════════════════ */

export default function HomeV19() {
    const pageRef = useRef(null);
    const { scrollYProgress } = useScroll({ target: pageRef });
    const [cityProgress, setCityProgress] = useState(0);
    useEffect(() => { const unsub = scrollYProgress.on('change', (v) => setCityProgress(v)); return unsub; }, [scrollYProgress]);

    return (
        <div ref={pageRef} className="bg-[#050508] text-white selection:bg-teal-400/30 overflow-x-hidden">
            <div className="fixed inset-0 z-10">
                <AtmosphericCity className="absolute inset-0 w-full h-full" scrollProgress={cityProgress} />
            </div>

            <div className="relative z-20 pointer-events-none">
                <FloatingNav />

                {/* HERO */}
                <section className="h-screen flex flex-col items-center justify-center px-6">
                    <motion.div className="text-center max-w-3xl"
                        initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 1, delay: 0.4, ease: [0.22, 1, 0.36, 1] }}>
                        <p className="text-[11px] font-bold text-white/20 tracking-[0.3em] uppercase mb-6">Design Intelligence for Architecture</p>
                        <h1 className="text-4xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight leading-[1.05]">
                            You design buildings.
                            <br />
                            <span className="bg-gradient-to-r from-white/90 to-white/50 bg-clip-text text-transparent">We automate the rest.</span>
                        </h1>
                        <p className="mt-6 text-white/30 text-sm sm:text-base max-w-lg mx-auto leading-relaxed">
                            Feasibility, parking, compliance, massing &mdash;
                            the hours of calculation that keep you from designing. Automated.
                        </p>
                    </motion.div>
                    <motion.div className="absolute bottom-10" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 2.5 }}>
                        <motion.div className="flex flex-col items-center gap-2" animate={{ y: [0, 6, 0] }} transition={{ repeat: Infinity, duration: 2.5, ease: 'easeInOut' }}>
                            <span className="text-[10px] text-white/15 tracking-widest uppercase font-bold">Scroll</span>
                            <svg className="w-4 h-4 text-white/10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                            </svg>
                        </motion.div>
                    </motion.div>
                </section>

                {/* THE PROBLEM */}
                <section className="py-24 sm:py-32">
                    <div className="max-w-2xl mx-auto px-6 text-center">
                        <Reveal>
                            <p className="text-[11px] font-bold text-white/15 tracking-[0.25em] uppercase mb-8">The industry problem</p>
                            <h2 className="text-2xl sm:text-4xl font-extrabold tracking-tight leading-snug">
                                <span className="text-white/80">Hours of calculation</span><br />
                                <span className="text-white/20">for minutes of design.</span>
                            </h2>
                            <p className="mt-8 text-sm text-white/30 max-w-md mx-auto leading-relaxed">
                                Area takeoffs. Financial models. Parking counts. Code compliance. Massing studies.
                                <br /><br />
                                The same repetitive work, every project, everywhere in the world.
                                <br /><span className="text-white/50">It doesn&apos;t have to be this way.</span>
                            </p>
                        </Reveal>
                    </div>
                </section>

                {/* THE TOOLS */}
                <section className="pb-16 sm:pb-24">
                    <div className="max-w-2xl mx-auto px-4 sm:px-6">
                        <Reveal><p className="text-[10px] font-bold text-white/15 tracking-[0.3em] uppercase mb-12 text-center">Four tools. One platform.</p></Reveal>
                        <div className="space-y-4">{TOOLS.map((tool, i) => (<ToolCard key={tool.name} tool={tool} index={i} />))}</div>
                    </div>
                </section>

                {/* THE SHIFT */}
                <section className="py-24 sm:py-32">
                    <div className="max-w-2xl mx-auto px-6 text-center">
                        <Reveal>
                            <p className="text-[10px] font-bold text-emerald-400/30 tracking-[0.3em] uppercase mb-6">The result</p>
                            <h2 className="text-3xl sm:text-5xl font-extrabold tracking-tight leading-tight text-white/90">
                                Less calculating.<br /><span className="text-emerald-400">More designing.</span>
                            </h2>
                            <p className="mt-8 text-white/30 text-sm max-w-sm mx-auto leading-relaxed">
                                Every tool works with your existing design workflow.<br />No new file formats. No learning curve. No lock-in.
                            </p>
                        </Reveal>
                    </div>
                </section>

                {/* CTA */}
                <section className="py-24 sm:py-32">
                    <div className="max-w-2xl mx-auto px-6 text-center">
                        <Reveal>
                            <h2 className="text-3xl sm:text-5xl font-extrabold tracking-tight leading-tight">
                                Start designing.<br /><span className="text-white/25">Stop calculating.</span>
                            </h2>
                            <div className="mt-12 flex flex-wrap justify-center gap-4 pointer-events-auto">
                                <Link to="/register" className="bg-white text-slate-900 px-8 py-3.5 rounded-full text-sm font-bold hover:shadow-xl hover:shadow-white/10 transition-all hover:-translate-y-0.5">Get started with RSI</Link>
                                <Link to="/rsi" className="bg-white/[0.06] border border-white/[0.1] text-white/60 px-8 py-3.5 rounded-full text-sm font-semibold hover:bg-white/[0.1] transition-all backdrop-blur-sm">See what RSI does</Link>
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
