import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence, useInView, useScroll } from 'framer-motion';
import * as THREE from 'three';

/* ───────────────────────────────────────────────────────────
   VERSION 18A-PRO — "Iterative City" (Enhanced)

   Three unique-to-web interactions:

   1. DRAW-TO-BUILD — Click-drag on the city to draw a
      building footprint. Particles rush to form YOUR
      building in real-time with teal wireframe.

   2. LIVE HUD — Floating architectural metrics (Buildings,
      GFA, FAR, Iterations) update in real-time as you
      interact — directly demoing the product.

   3. ITERATION COUNTER — Each click shows "Design Iteration N"
      with a generated-in time, mirroring the RSI value prop.

   Plus: per-particle color (white=layout, teal=your builds),
   3000 particles, scroll grows height, camera orbit.
   ─────────────────────────────────────────────────────────── */

const TOOLS = [
    { name: 'RSI', full: 'Residential Scheme Intelligence', hex: '#14b8a6', status: 'Live', before: 'Spreadsheets, manual takeoffs, disconnected data', after: 'Automated feasibility analysis from your design model', metric: '8 seconds', metricLabel: 'vs. hours of spreadsheet work', link: '/rsi' },
    { name: 'ParkCore', full: 'Parking Core Engine', hex: '#f59e0b', status: 'Coming', before: 'Manual stall layouts, hand-counted spaces, compliance guesswork', after: 'Optimized parking layouts from any site boundary', metric: '3 layouts', metricLabel: 'generated and compared instantly' },
    { name: 'OccuCalc', full: 'Occupancy Calculator', hex: '#8b5cf6', status: 'Coming', before: 'Cross-referencing code tables, manual floor area calculations', after: 'Instant code-compliant occupant loads from floor plans', metric: '0 lookups', metricLabel: 'every code table built in' },
    { name: 'SiteGen', full: 'Site Generator', hex: '#3b82f6', status: 'Coming', before: 'Sketch, measure, iterate, repeat — hoping one option works', after: 'Optimized massing options from site constraints in seconds', metric: '10+ options', metricLabel: 'explored before you finish one by hand' },
];

/* ════════════════════════════════════════════════════════════
   ITERATIVE CITY — 3D wireframe buildings from particles
   Draw-to-build + Live HUD + Iteration counter
   ════════════════════════════════════════════════════════════ */

const CITY_LAYOUTS = [
    [
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
    ],
    [
        { x: -6, z: -6, w: 3, d: 2.5, h: 9 },
        { x: -1.5, z: -6, w: 2.5, d: 2, h: 5 },
        { x: 3, z: -6, w: 2, d: 3, h: 13 },
        { x: -7, z: -1.5, w: 2, d: 2, h: 7 },
        { x: -3.5, z: -1.5, w: 3.5, d: 2.5, h: 4 },
        { x: 1, z: -1.5, w: 2, d: 2, h: 11 },
        { x: 5, z: -1.5, w: 2.5, d: 3, h: 6 },
        { x: -5.5, z: 3, w: 2.5, d: 2, h: 10 },
        { x: -1, z: 3, w: 3, d: 2.5, h: 3 },
        { x: 3.5, z: 3, w: 2, d: 2, h: 8 },
        { x: 6.5, z: 3, w: 2, d: 2.5, h: 14 },
    ],
    [
        { x: -5, z: -5.5, w: 4, d: 2, h: 7 },
        { x: 1, z: -5.5, w: 2.5, d: 3, h: 11 },
        { x: 5, z: -5.5, w: 2, d: 2, h: 5 },
        { x: -7, z: -0.5, w: 2, d: 2.5, h: 14 },
        { x: -3, z: -0.5, w: 2.5, d: 2, h: 6 },
        { x: 1, z: -0.5, w: 3, d: 3, h: 9 },
        { x: 5.5, z: -0.5, w: 2, d: 2, h: 4 },
        { x: -6, z: 4, w: 3, d: 2.5, h: 8 },
        { x: -1.5, z: 4, w: 2, d: 2, h: 12 },
        { x: 3, z: 4, w: 3.5, d: 2, h: 6 },
    ],
];

function getBuildingEdges(b, heightScale) {
    const hw = b.w / 2, hd = b.d / 2;
    const h = b.h * heightScale;
    const x = b.x, z = b.z;
    return [
        [[x - hw, 0, z - hd], [x + hw, 0, z - hd]],
        [[x + hw, 0, z - hd], [x + hw, 0, z + hd]],
        [[x + hw, 0, z + hd], [x - hw, 0, z + hd]],
        [[x - hw, 0, z + hd], [x - hw, 0, z - hd]],
        [[x - hw, h, z - hd], [x + hw, h, z - hd]],
        [[x + hw, h, z - hd], [x + hw, h, z + hd]],
        [[x + hw, h, z + hd], [x - hw, h, z + hd]],
        [[x - hw, h, z + hd], [x - hw, h, z - hd]],
        [[x - hw, 0, z - hd], [x - hw, h, z - hd]],
        [[x + hw, 0, z - hd], [x + hw, h, z - hd]],
        [[x + hw, 0, z + hd], [x + hw, h, z + hd]],
        [[x - hw, 0, z + hd], [x - hw, h, z + hd]],
    ];
}

function InteractiveCity({ className, scrollProgress, onHudUpdate, onIteration }) {
    const mountRef = useRef(null);
    const progressRef = useRef(0);
    useEffect(() => { progressRef.current = scrollProgress; }, [scrollProgress]);

    useEffect(() => {
        const el = mountRef.current;
        if (!el) return;
        let W = el.clientWidth, H = el.clientHeight;
        let mx = W / 2, my = H / 2;
        let mouseDown = false;

        // Draw-to-build state
        let isDragging = false;
        let dragStartWorld = null;
        let dragScreenStart = { x: 0, y: 0 };
        let dragScreenDist = 0;
        const DRAG_THRESHOLD = 8;
        const customBuildings = [];

        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(50, W / H, 0.1, 200);
        camera.position.set(0, 14, 22);
        camera.lookAt(0, 2, 0);

        const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        renderer.setSize(W, H);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.setClearColor(0x050508, 1);
        el.appendChild(renderer.domElement);

        // Shader with per-particle color
        const vtx = `
            attribute float aSize;
            attribute float aBright;
            attribute vec3 aColor;
            varying float vB;
            varying vec3 vC;
            void main() {
                vB = aBright;
                vC = aColor;
                vec4 mv = modelViewMatrix * vec4(position, 1.0);
                gl_PointSize = aSize * (250.0 / -mv.z);
                gl_Position = projectionMatrix * mv;
            }
        `;
        const frg = `
            varying float vB;
            varying vec3 vC;
            void main() {
                float d = length(gl_PointCoord - vec2(0.5));
                if (d > 0.5) discard;
                float a = smoothstep(0.5, 0.0, d) * vB;
                gl_FragColor = vec4(vC, a);
            }
        `;

        const PARTICLE_COUNT = 3000;
        const SITE_AREA = 18 * 16;
        const positions = new Float32Array(PARTICLE_COUNT * 3);
        const aSize = new Float32Array(PARTICLE_COUNT);
        const aBright = new Float32Array(PARTICLE_COUNT);
        const aColor = new Float32Array(PARTICLE_COUNT * 3);
        const targetPos = new Float32Array(PARTICLE_COUNT * 3);
        const nextTarget = new Float32Array(PARTICLE_COUNT * 3);
        const targetColor = new Float32Array(PARTICLE_COUNT * 3);
        const nextColor = new Float32Array(PARTICLE_COUNT * 3);
        const baseSize = new Float32Array(PARTICLE_COUNT);
        const flowSpeed = new Float32Array(PARTICLE_COUNT);
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
            aColor[i * 3] = 1; aColor[i * 3 + 1] = 1; aColor[i * 3 + 2] = 1;
            flowSpeed[i] = 0.3 + Math.random() * 0.7;
            flowPhase[i] = Math.random();
        }

        let currentLayout = 0;
        let iterationCount = 0;
        let transitioning = false;
        let transitionT = 0;

        function assignAllTargets(layoutIdx, tgtArr, colArr, heightScale) {
            const layout = CITY_LAYOUTS[layoutIdx % CITY_LAYOUTS.length];
            const allEdges = [];
            const edgeColors = [];

            for (const b of layout) {
                const edges = getBuildingEdges(b, heightScale);
                for (const e of edges) { allEdges.push(e); edgeColors.push([1.0, 1.0, 1.0]); }
            }

            for (const b of customBuildings) {
                const edges = getBuildingEdges(b, heightScale);
                for (const e of edges) { allEdges.push(e); edgeColors.push([0.08, 0.72, 0.65]); }
            }

            for (let gx = -9; gx <= 9; gx += 3) {
                allEdges.push([[gx, 0, -8], [gx, 0, 8]]);
                edgeColors.push([0.45, 0.45, 0.5]);
            }
            for (let gz = -8; gz <= 8; gz += 3) {
                allEdges.push([[-9, 0, gz], [9, 0, gz]]);
                edgeColors.push([0.45, 0.45, 0.5]);
            }

            for (let i = 0; i < PARTICLE_COUNT; i++) {
                const ei = i % allEdges.length;
                const edge = allEdges[ei];
                const color = edgeColors[ei];
                const t = (i / PARTICLE_COUNT + flowPhase[i] * 0.1) % 1;
                const jitter = 0.05;
                tgtArr[i * 3] = edge[0][0] + (edge[1][0] - edge[0][0]) * t + (Math.random() - 0.5) * jitter;
                tgtArr[i * 3 + 1] = edge[0][1] + (edge[1][1] - edge[0][1]) * t + (Math.random() - 0.5) * jitter;
                tgtArr[i * 3 + 2] = edge[0][2] + (edge[1][2] - edge[0][2]) * t + (Math.random() - 0.5) * jitter;
                colArr[i * 3] = color[0];
                colArr[i * 3 + 1] = color[1];
                colArr[i * 3 + 2] = color[2];
            }
        }

        function computeHud(heightScale) {
            const layout = CITY_LAYOUTS[currentLayout % CITY_LAYOUTS.length];
            const allB = [...layout, ...customBuildings];
            const gfa = allB.reduce((s, b) => s + b.w * b.d * b.h * heightScale, 0);
            if (onHudUpdate) onHudUpdate({
                buildings: allB.length,
                gfa: Math.round(gfa),
                far: +(gfa / SITE_AREA).toFixed(2),
                iteration: iterationCount,
            });
        }

        assignAllTargets(0, targetPos, targetColor, 0.5);
        assignAllTargets(0, nextTarget, nextColor, 0.5);
        aColor.set(targetColor);

        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('aSize', new THREE.BufferAttribute(aSize, 1));
        geometry.setAttribute('aBright', new THREE.BufferAttribute(aBright, 1));
        geometry.setAttribute('aColor', new THREE.BufferAttribute(aColor, 3));

        const material = new THREE.ShaderMaterial({
            vertexShader: vtx, fragmentShader: frg,
            transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
        });
        scene.add(new THREE.Points(geometry, material));

        // Ground grid
        const gridHelper = new THREE.GridHelper(20, 20, 0x111118, 0x111118);
        gridHelper.position.y = -0.05;
        scene.add(gridHelper);

        // Draw outline — rectangle on ground while dragging
        const outlineVerts = new Float32Array(15);
        const outlineGeo = new THREE.BufferGeometry();
        outlineGeo.setAttribute('position', new THREE.BufferAttribute(outlineVerts, 3));
        const outlineMat = new THREE.LineBasicMaterial({ color: 0x14b8a6, transparent: true, opacity: 0.7 });
        const outlineLine = new THREE.Line(outlineGeo, outlineMat);
        outlineLine.visible = false;
        scene.add(outlineLine);

        // Height preview — 4 vertical lines at corners
        const hpVerts = new Float32Array(24);
        const hpGeo = new THREE.BufferGeometry();
        hpGeo.setAttribute('position', new THREE.BufferAttribute(hpVerts, 3));
        const hpMat = new THREE.LineBasicMaterial({ color: 0x14b8a6, transparent: true, opacity: 0.35 });
        const heightPreview = new THREE.LineSegments(hpGeo, hpMat);
        heightPreview.visible = false;
        scene.add(heightPreview);

        // Top rectangle of height preview
        const topVerts = new Float32Array(15);
        const topGeo = new THREE.BufferGeometry();
        topGeo.setAttribute('position', new THREE.BufferAttribute(topVerts, 3));
        const topMat = new THREE.LineBasicMaterial({ color: 0x14b8a6, transparent: true, opacity: 0.25 });
        const topLine = new THREE.Line(topGeo, topMat);
        topLine.visible = false;
        scene.add(topLine);

        // Sparse dust backdrop
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

        const raycaster = new THREE.Raycaster();
        const cursorWorld = new THREE.Vector3();
        const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
        const ripples = [];

        let frame;
        const clock = new THREE.Clock();
        let camAngle = 0;
        let lastHeightScale = 0;

        function getCursorWorldOnGround() {
            const ndc = new THREE.Vector2((mx / W) * 2 - 1, -(my / H) * 2 + 1);
            raycaster.setFromCamera(ndc, camera);
            const target = new THREE.Vector3();
            if (raycaster.ray.intersectPlane(groundPlane, target)) return target;
            return null;
        }

        function getCursorWorld() {
            const ndc = new THREE.Vector2((mx / W) * 2 - 1, -(my / H) * 2 + 1);
            raycaster.setFromCamera(ndc, camera);
            const target = new THREE.Vector3();
            if (raycaster.ray.intersectPlane(groundPlane, target)) {
                cursorWorld.copy(target);
                cursorWorld.y = 4;
            }
        }

        function updateDrawOutline(x1, z1, x2, z2) {
            const minX = Math.min(x1, x2), maxX = Math.max(x1, x2);
            const minZ = Math.min(z1, z2), maxZ = Math.max(z1, z2);
            const y = 0.08;

            // Ground rectangle
            const p = outlineVerts;
            p[0]=minX; p[1]=y; p[2]=minZ;
            p[3]=maxX; p[4]=y; p[5]=minZ;
            p[6]=maxX; p[7]=y; p[8]=maxZ;
            p[9]=minX; p[10]=y; p[11]=maxZ;
            p[12]=minX; p[13]=y; p[14]=minZ;
            outlineGeo.attributes.position.needsUpdate = true;
            outlineLine.visible = true;

            // Height preview verticals
            const w = maxX - minX, d = maxZ - minZ;
            const previewH = (4 + Math.max(w, d) * 0.8) * Math.max(lastHeightScale, 0.3);
            const corners = [[minX,minZ],[maxX,minZ],[maxX,maxZ],[minX,maxZ]];
            for (let c = 0; c < 4; c++) {
                hpVerts[c*6] = corners[c][0]; hpVerts[c*6+1] = y; hpVerts[c*6+2] = corners[c][1];
                hpVerts[c*6+3] = corners[c][0]; hpVerts[c*6+4] = previewH; hpVerts[c*6+5] = corners[c][1];
            }
            hpGeo.attributes.position.needsUpdate = true;
            heightPreview.visible = true;

            // Top rectangle
            const tp = topVerts;
            tp[0]=minX; tp[1]=previewH; tp[2]=minZ;
            tp[3]=maxX; tp[4]=previewH; tp[5]=minZ;
            tp[6]=maxX; tp[7]=previewH; tp[8]=maxZ;
            tp[9]=minX; tp[10]=previewH; tp[11]=maxZ;
            tp[12]=minX; tp[13]=previewH; tp[14]=minZ;
            topGeo.attributes.position.needsUpdate = true;
            topLine.visible = true;
        }

        function hideDrawOutline() {
            outlineLine.visible = false;
            heightPreview.visible = false;
            topLine.visible = false;
        }

        function finalizeDraw(x1, z1, x2, z2) {
            const minX = Math.min(x1, x2), maxX = Math.max(x1, x2);
            const minZ = Math.min(z1, z2), maxZ = Math.max(z1, z2);
            const w = maxX - minX, d = maxZ - minZ;
            if (w < 0.8 || d < 0.8) return; // footprint too small
            const cx = (minX + maxX) / 2;
            const cz = (minZ + maxZ) / 2;
            const h = 4 + Math.max(w, d) * 0.8;
            customBuildings.push({ x: cx, z: cz, w, d, h });

            // Reassign all targets including new building
            assignAllTargets(currentLayout, targetPos, targetColor, lastHeightScale);
            aColor.set(targetColor);
            geometry.attributes.aColor.needsUpdate = true;
            computeHud(lastHeightScale);

            // Ripple from new building center
            ripples.push({ x: cx, y: h * lastHeightScale * 0.5, z: cz, t: 0 });
        }

        // ── Animation loop ──
        function animate() {
            frame = requestAnimationFrame(animate);
            const dt = Math.min(clock.getDelta(), 0.05);
            const t = clock.elapsedTime;
            const p = progressRef.current;

            // City height grows with scroll
            const heightScale = 0.1 + p * 0.9;
            if (Math.abs(heightScale - lastHeightScale) > 0.01) {
                assignAllTargets(currentLayout, targetPos, targetColor, heightScale);
                aColor.set(targetColor);
                geometry.attributes.aColor.needsUpdate = true;
                lastHeightScale = heightScale;
                computeHud(heightScale);
            }

            // Camera orbit
            camAngle += dt * 0.04;
            const camR = 24 - p * 6;
            const camY = 16 - p * 6;
            camera.position.x = Math.sin(camAngle) * camR;
            camera.position.z = Math.cos(camAngle) * camR;
            camera.position.y = camY;
            camera.lookAt(0, p * 4, 0);

            getCursorWorld();

            // Transition handling (iteration switch)
            if (transitioning) {
                transitionT += dt * 1.5;
                if (transitionT >= 1) {
                    transitioning = false;
                    transitionT = 1;
                    targetPos.set(nextTarget);
                    targetColor.set(nextColor);
                    aColor.set(targetColor);
                    geometry.attributes.aColor.needsUpdate = true;
                }
            }

            // Ripple decay
            for (let ri = ripples.length - 1; ri >= 0; ri--) {
                ripples[ri].t += dt;
                if (ripples[ri].t > 2.5) ripples.splice(ri, 1);
            }

            // Update draw outline while dragging
            if (isDragging && dragStartWorld) {
                const cur = getCursorWorldOnGround();
                if (cur) updateDrawOutline(dragStartWorld.x, dragStartWorld.z, cur.x, cur.z);
            }

            // ── Particle update ──
            const posArr = geometry.attributes.position.array;
            const brightArr = geometry.attributes.aBright.array;
            const sizeArr = geometry.attributes.aSize.array;
            const colArr = geometry.attributes.aColor.array;

            for (let i = 0; i < PARTICLE_COUNT; i++) {
                flowPhase[i] += flowSpeed[i] * dt * 0.15;
                if (flowPhase[i] > 1) flowPhase[i] -= 1;

                // Current target (blend during transition)
                let tx, ty, tz;
                if (transitioning) {
                    const st = transitionT * transitionT * (3 - 2 * transitionT);
                    tx = targetPos[i * 3] + (nextTarget[i * 3] - targetPos[i * 3]) * st;
                    ty = targetPos[i * 3 + 1] + (nextTarget[i * 3 + 1] - targetPos[i * 3 + 1]) * st;
                    tz = targetPos[i * 3 + 2] + (nextTarget[i * 3 + 2] - targetPos[i * 3 + 2]) * st;
                    // Lerp color during transition
                    colArr[i * 3] = targetColor[i * 3] + (nextColor[i * 3] - targetColor[i * 3]) * st;
                    colArr[i * 3 + 1] = targetColor[i * 3 + 1] + (nextColor[i * 3 + 1] - targetColor[i * 3 + 1]) * st;
                    colArr[i * 3 + 2] = targetColor[i * 3 + 2] + (nextColor[i * 3 + 2] - targetColor[i * 3 + 2]) * st;
                } else {
                    tx = targetPos[i * 3];
                    ty = targetPos[i * 3 + 1];
                    tz = targetPos[i * 3 + 2];
                }

                // Convergence toward target
                const convergence = Math.min(1, p * 2.5 + 0.15);
                const cx = posArr[i * 3], cy = posArr[i * 3 + 1], cz = posArr[i * 3 + 2];
                const lerpRate = (transitioning ? 3.0 : 2.0) * dt;
                posArr[i * 3] += (tx - cx) * lerpRate * convergence;
                posArr[i * 3 + 1] += (ty - cy) * lerpRate * convergence;
                posArr[i * 3 + 2] += (tz - cz) * lerpRate * convergence;

                // Flow oscillation
                const flowOsc = Math.sin(t * 2 + i * 0.3) * 0.02 * (1 - convergence * 0.5);
                posArr[i * 3] += flowOsc;
                posArr[i * 3 + 1] += flowOsc * 0.5;

                // Cursor distance
                const dx = cursorWorld.x - posArr[i * 3];
                const dy = cursorWorld.y - posArr[i * 3 + 1];
                const dz = cursorWorld.z - posArr[i * 3 + 2];
                const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

                // Glow from cursor proximity
                const glow = dist < 12 ? Math.pow(1 - dist / 12, 1.8) : 0;
                const hBright = Math.min(1, posArr[i * 3 + 1] / 8) * 0.15;

                brightArr[i] = 0.2 + p * 0.1 + glow * 0.7 + hBright;
                sizeArr[i] = baseSize[i] * (0.6 + p * 0.3 + glow * 2.5);

                // Cursor push (disabled while drawing)
                if (!isDragging && dist < 6 && dist > 0.05) {
                    const pushStr = mouseDown
                        ? (1 - dist / 6) * 18 * dt
                        : (1 - dist / 6) * 5 * dt;
                    const invD = 1 / dist;
                    posArr[i * 3] -= dx * invD * pushStr;
                    posArr[i * 3 + 1] -= dy * invD * pushStr;
                    posArr[i * 3 + 2] -= dz * invD * pushStr;
                }

                // Ripple waves
                for (const r of ripples) {
                    const rx = posArr[i * 3] - r.x;
                    const ry = posArr[i * 3 + 1] - r.y;
                    const rz = posArr[i * 3 + 2] - r.z;
                    const rd = Math.sqrt(rx * rx + ry * ry + rz * rz);
                    const ringR = r.t * 14;
                    const ringDist = Math.abs(rd - ringR);
                    if (ringDist < 2 && rd > 0.1) {
                        const wave = (1 - ringDist / 2) * Math.max(0, 1 - r.t / 2) * 8 * dt;
                        posArr[i * 3] += (rx / rd) * wave;
                        posArr[i * 3 + 1] += Math.abs(ry / rd) * wave * 2;
                        posArr[i * 3 + 2] += (rz / rd) * wave;
                    }
                }
            }

            geometry.attributes.position.needsUpdate = true;
            geometry.attributes.aBright.needsUpdate = true;
            geometry.attributes.aSize.needsUpdate = true;
            if (transitioning) geometry.attributes.aColor.needsUpdate = true;

            renderer.render(scene, camera);
        }
        animate();

        // ── Iteration trigger ──
        function triggerIteration() {
            iterationCount++;
            currentLayout = (currentLayout + 1) % CITY_LAYOUTS.length;
            assignAllTargets(currentLayout, nextTarget, nextColor, lastHeightScale);
            transitioning = true;
            transitionT = 0;
            computeHud(lastHeightScale);
            if (onIteration) {
                const genTime = (0.3 + Math.random() * 1.2).toFixed(1);
                onIteration({ iteration: iterationCount, time: genTime });
            }
        }

        // ── Events: click vs drag detection ──
        function onMove(e) {
            mx = e.clientX; my = e.clientY;
            if (mouseDown) {
                dragScreenDist += Math.abs(e.clientX - dragScreenStart.x) + Math.abs(e.clientY - dragScreenStart.y);
                dragScreenStart.x = e.clientX;
                dragScreenStart.y = e.clientY;
                if (dragScreenDist > DRAG_THRESHOLD && !isDragging) {
                    isDragging = true;
                    const ground = getCursorWorldOnGround();
                    if (ground) dragStartWorld = { x: ground.x, z: ground.z };
                }
            }
        }
        function onDown(e) {
            if (e.button === 0) {
                mouseDown = true;
                dragScreenStart.x = e.clientX;
                dragScreenStart.y = e.clientY;
                dragScreenDist = 0;
                isDragging = false;
                dragStartWorld = null;
            }
        }
        function onUp() {
            if (isDragging && dragStartWorld) {
                const cur = getCursorWorldOnGround();
                if (cur) finalizeDraw(dragStartWorld.x, dragStartWorld.z, cur.x, cur.z);
                hideDrawOutline();
            } else if (mouseDown && !isDragging) {
                getCursorWorld();
                ripples.push({ x: cursorWorld.x, y: cursorWorld.y, z: cursorWorld.z, t: 0 });
                triggerIteration();
            }
            mouseDown = false;
            isDragging = false;
            dragStartWorld = null;
        }
        function onTouchStart(e) {
            if (e.touches.length > 0) {
                mx = e.touches[0].clientX; my = e.touches[0].clientY;
                mouseDown = true;
                dragScreenStart.x = mx;
                dragScreenStart.y = my;
                dragScreenDist = 0;
                isDragging = false;
                dragStartWorld = null;
            }
        }
        function onTouchMove(e) {
            if (e.touches.length > 0) {
                mx = e.touches[0].clientX; my = e.touches[0].clientY;
                if (mouseDown) {
                    dragScreenDist += Math.abs(mx - dragScreenStart.x) + Math.abs(my - dragScreenStart.y);
                    dragScreenStart.x = mx;
                    dragScreenStart.y = my;
                    if (dragScreenDist > DRAG_THRESHOLD && !isDragging) {
                        isDragging = true;
                        const ground = getCursorWorldOnGround();
                        if (ground) dragStartWorld = { x: ground.x, z: ground.z };
                    }
                }
            }
        }
        function onTouchEnd() {
            if (isDragging && dragStartWorld) {
                const cur = getCursorWorldOnGround();
                if (cur) finalizeDraw(dragStartWorld.x, dragStartWorld.z, cur.x, cur.z);
                hideDrawOutline();
            } else if (mouseDown && !isDragging) {
                getCursorWorld();
                ripples.push({ x: cursorWorld.x, y: cursorWorld.y, z: cursorWorld.z, t: 0 });
                triggerIteration();
            }
            mouseDown = false;
            isDragging = false;
            dragStartWorld = null;
        }
        function onResize() {
            W = el.clientWidth; H = el.clientHeight;
            camera.aspect = W / H; camera.updateProjectionMatrix();
            renderer.setSize(W, H);
        }

        el.addEventListener('mousemove', onMove);
        el.addEventListener('mousedown', onDown);
        el.addEventListener('mouseup', onUp);
        el.addEventListener('touchstart', onTouchStart, { passive: true });
        el.addEventListener('touchmove', onTouchMove, { passive: true });
        el.addEventListener('touchend', onTouchEnd);
        window.addEventListener('resize', onResize);

        // Initial HUD
        computeHud(0.5);

        return () => {
            cancelAnimationFrame(frame);
            el.removeEventListener('mousemove', onMove);
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

/* ═══ SHARED COMPONENTS ═══ */

function ToolCard({ tool, index }) {
    const ref = useRef(null);
    const inView = useInView(ref, { once: true, margin: '-15% 0px -15% 0px' });
    const [revealed, setRevealed] = useState(false);
    useEffect(() => { if (inView) { const t = setTimeout(() => setRevealed(true), 600); return () => clearTimeout(t); } }, [inView]);

    return (
        <motion.div ref={ref} className="relative pointer-events-auto"
            initial={{ opacity: 0, y: 20 }} animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6, delay: index * 0.08, ease: [0.22, 1, 0.36, 1] }}>
            <div className="bg-[#0a0a0f]/70 backdrop-blur-md border border-white/[0.06] rounded-2xl p-6 sm:p-8 hover:border-white/[0.12] transition-all duration-500">
                <div className="flex items-center justify-between mb-6">
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
   MAIN PAGE — with Live HUD + Iteration Flash overlays
   ════════════════════════════════════════════════════════════ */

export default function HomeV18A() {
    const pageRef = useRef(null);
    const { scrollYProgress } = useScroll({ target: pageRef });
    const [cityProgress, setCityProgress] = useState(0);
    const [hud, setHud] = useState({ buildings: 0, gfa: 0, far: 0, iteration: 0 });
    const [iterFlash, setIterFlash] = useState(null);
    const flashTimerRef = useRef(null);

    useEffect(() => { const unsub = scrollYProgress.on('change', (v) => setCityProgress(v)); return unsub; }, [scrollYProgress]);

    const handleHudUpdate = useCallback((data) => setHud(data), []);
    const handleIteration = useCallback((data) => {
        setIterFlash(data);
        if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
        flashTimerRef.current = setTimeout(() => setIterFlash(null), 2200);
    }, []);

    return (
        <div ref={pageRef} className="bg-[#050508] text-white selection:bg-teal-400/30 overflow-x-hidden">
            {/* 3D Canvas */}
            <div className="fixed inset-0 z-10">
                <InteractiveCity className="absolute inset-0 w-full h-full" scrollProgress={cityProgress} onHudUpdate={handleHudUpdate} onIteration={handleIteration} />
            </div>

            {/* Live HUD — bottom left */}
            <div className="fixed bottom-6 left-6 z-30 pointer-events-none">
                <motion.div className="font-mono" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.8, delay: 1.5 }}>
                    <div className="bg-[#0a0a0f]/50 backdrop-blur-sm border border-white/[0.06] rounded-xl px-4 py-3 space-y-1.5">
                        <p className="text-[9px] text-white/15 uppercase tracking-[0.2em] font-bold mb-2">Live Analysis</p>
                        <div className="flex items-baseline gap-2">
                            <span className="text-base font-bold text-teal-400 tabular-nums">{hud.buildings}</span>
                            <span className="text-[10px] text-white/20">Buildings</span>
                        </div>
                        <div className="flex items-baseline gap-2">
                            <span className="text-base font-bold text-white/70 tabular-nums">{hud.gfa.toLocaleString()}</span>
                            <span className="text-[10px] text-white/20">GFA m&sup2;</span>
                        </div>
                        <div className="flex items-baseline gap-2">
                            <span className="text-base font-bold text-amber-400/80 tabular-nums">{hud.far}</span>
                            <span className="text-[10px] text-white/20">FAR</span>
                        </div>
                        <div className="flex items-baseline gap-2">
                            <span className="text-base font-bold text-white/40 tabular-nums">{hud.iteration}</span>
                            <span className="text-[10px] text-white/20">Iterations</span>
                        </div>
                    </div>
                </motion.div>
            </div>

            {/* Iteration flash — top right */}
            <AnimatePresence>
                {iterFlash && (
                    <motion.div key={iterFlash.iteration} className="fixed top-24 right-6 z-30 pointer-events-none"
                        initial={{ opacity: 0, x: 20, scale: 0.95 }} animate={{ opacity: 1, x: 0, scale: 1 }} exit={{ opacity: 0, x: 20, scale: 0.95 }}
                        transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}>
                        <div className="bg-[#0a0a0f]/70 backdrop-blur-md border border-teal-400/15 rounded-xl px-5 py-3 font-mono text-center">
                            <p className="text-[9px] text-white/20 uppercase tracking-[0.15em] font-bold">Design Iteration</p>
                            <p className="text-2xl font-extrabold text-white/90 mt-0.5">{iterFlash.iteration}</p>
                            <p className="text-[10px] text-teal-400/50 mt-0.5">Generated in {iterFlash.time}s</p>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Page content */}
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
                        <div className="mt-6 flex flex-col items-center gap-1.5">
                            <p className="text-[11px] text-white/25 tracking-wide">
                                Click to iterate &middot; Scroll to grow &middot; Drag to build
                            </p>
                            <motion.div className="w-5 h-5 rounded-full border border-white/15 flex items-center justify-center"
                                animate={{ scale: [1, 1.3, 1], opacity: [0.2, 0.4, 0.2] }}
                                transition={{ repeat: Infinity, duration: 2, ease: 'easeInOut' }}>
                                <div className="w-1.5 h-1.5 rounded-full bg-white/30" />
                            </motion.div>
                        </div>
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
