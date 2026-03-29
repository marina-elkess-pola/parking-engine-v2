import React, { useRef, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, useInView, useScroll } from 'framer-motion';
import * as THREE from 'three';

/* ───────────────────────────────────────────────────────────
   VERSION 18B — "Solution Multiverse" (v2)

   Design dimensions as labeled orbital clusters connected
   by visible particle streams. Scroll tells a story:
   you start with one "Concept" seed — as you scroll,
   dimensions split off one by one (Structure, Circulation,
   Program, Envelope, Site). Each gets a visible label.

   Click on a cluster triggers an "optimize" animation:
   particles tighten into a clean ring, pulse, then return.
   Streams are clearly visible with pulsing brightness waves.
   Connection lines are prominent. Everything is legible.
   ─────────────────────────────────────────────────────────── */

const TOOLS = [
    { name: 'RSI', full: 'Residential Scheme Intelligence', hex: '#14b8a6', status: 'Live', before: 'Spreadsheets, manual takeoffs, disconnected data', after: 'Automated feasibility analysis from your design model', metric: '8 seconds', metricLabel: 'vs. hours of spreadsheet work', link: '/rsi' },
    { name: 'ParkCore', full: 'Parking Core Engine', hex: '#f59e0b', status: 'Coming', before: 'Manual stall layouts, hand-counted spaces, compliance guesswork', after: 'Optimized parking layouts from any site boundary', metric: '3 layouts', metricLabel: 'generated and compared instantly' },
    { name: 'OccuCalc', full: 'Occupancy Calculator', hex: '#8b5cf6', status: 'Coming', before: 'Cross-referencing code tables, manual floor area calculations', after: 'Instant code-compliant occupant loads from floor plans', metric: '0 lookups', metricLabel: 'every code table built in' },
    { name: 'SiteGen', full: 'Site Generator', hex: '#3b82f6', status: 'Coming', before: 'Sketch, measure, iterate, repeat — hoping one option works', after: 'Optimized massing options from site constraints in seconds', metric: '10+ options', metricLabel: 'explored before you finish one by hand' },
];

/* ════════════════════════════════════════════════════════════
   MULTIDIMENSIONAL UNIVERSE v2 — Labeled, narrative, clear
   ════════════════════════════════════════════════════════════ */

// Each cluster: a design dimension with its own color tint & orbit
// scrollThreshold = when it appears (0 = always, 0.15 = at 15% scroll)
const CLUSTER_DEFS = [
    { label: 'Concept', R: 3.0, tiltX: 0.0, tiltZ: 0.0, center: [0, 0, 0], color: [1.0, 1.0, 1.0], count: 280, speed: 0.3, scrollThreshold: 0 },
    { label: 'Structure', R: 2.5, tiltX: 0.5, tiltZ: 0.3, center: [7, 1.5, -2], color: [0.7, 1.0, 0.9], count: 230, speed: -0.25, scrollThreshold: 0.1 },
    { label: 'Circulation', R: 2.8, tiltX: 0.25, tiltZ: -0.15, center: [-6, -0.5, 3], color: [0.9, 0.8, 1.0], count: 230, speed: 0.2, scrollThreshold: 0.25 },
    { label: 'Envelope', R: 2.2, tiltX: 0.7, tiltZ: 0.1, center: [3, -2.5, 5], color: [1.0, 0.92, 0.75], count: 200, speed: -0.35, scrollThreshold: 0.45 },
    { label: 'Site', R: 3.2, tiltX: 0.4, tiltZ: -0.3, center: [-4, 2.5, -4], color: [0.75, 0.9, 1.0], count: 230, speed: 0.22, scrollThreshold: 0.65 },
];

// Connections — only between adjacent-in-order clusters for clarity
const CONNECTIONS = [
    [0, 1], [0, 2], [1, 3], [2, 4], [1, 2], [3, 4],
];

const STREAM_PER_CONN = 100; // more for visibility

function InteractiveCity({ className, scrollProgress }) {
    const mountRef = useRef(null);
    const labelsRef = useRef(null);
    const progressRef = useRef(0);
    useEffect(() => { progressRef.current = scrollProgress; }, [scrollProgress]);

    useEffect(() => {
        const el = mountRef.current;
        const labelContainer = labelsRef.current;
        if (!el || !labelContainer) return;
        let W = el.clientWidth, H = el.clientHeight;
        let mx = W / 2, my = H / 2;
        let mouseDown = false;

        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(55, W / H, 0.1, 200);
        camera.position.set(0, 5, 22);
        camera.lookAt(0, 0, 0);

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
                gl_PointSize = aSize * (240.0 / -mv.z);
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

        function applyTilt(x, y, z, tiltX, tiltZ) {
            const cosX = Math.cos(Math.PI * tiltX), sinX = Math.sin(Math.PI * tiltX);
            const cosZ = Math.cos(Math.PI * tiltZ), sinZ = Math.sin(Math.PI * tiltZ);
            const y1 = y * cosX - z * sinX, z1 = y * sinX + z * cosX;
            const x2 = x * cosZ - y1 * sinZ, y2 = x * sinZ + y1 * cosZ;
            return { x: x2, y: y2, z: z1 };
        }

        // Total particles
        const totalClusterP = CLUSTER_DEFS.reduce((s, c) => s + c.count, 0);
        const totalStreamP = CONNECTIONS.length * STREAM_PER_CONN;
        const TOTAL = totalClusterP + totalStreamP;

        const positions = new Float32Array(TOTAL * 3);
        const aSize = new Float32Array(TOTAL);
        const aBright = new Float32Array(TOTAL);
        const aColor = new Float32Array(TOTAL * 3);

        // Per-particle metadata
        const pCluster = new Int16Array(TOTAL);
        const pAngle = new Float32Array(TOTAL);
        const pSpeed = new Float32Array(TOTAL);
        const pStreamT = new Float32Array(TOTAL);
        const pStreamConn = new Int16Array(TOTAL);
        const pOffset = new Float32Array(TOTAL * 3);
        const pIsStream = new Uint8Array(TOTAL);

        // Animated cluster centers (lerp toward target when appearing)
        const clusterCenters = CLUSTER_DEFS.map(() => [0, 0, 0]); // all start at origin
        const clusterAlpha = new Float32Array(CLUSTER_DEFS.length); // 0 = hidden, 1 = fully shown
        clusterAlpha[0] = 1; // Concept always visible

        // Click "optimize" state per cluster
        const optimizing = new Float32Array(CLUSTER_DEFS.length); // 0 = idle, >0 = animation progress

        let idx = 0;

        // Initialize cluster particles (all start at origin, will lerp out)
        for (let ci = 0; ci < CLUSTER_DEFS.length; ci++) {
            const cl = CLUSTER_DEFS[ci];
            for (let i = 0; i < cl.count; i++) {
                const theta = Math.random() * Math.PI * 2;
                pCluster[idx] = ci;
                pAngle[idx] = theta;
                pSpeed[idx] = 0.7 + Math.random() * 0.6;
                aSize[idx] = 0.8 + Math.random() * 1.4;
                aBright[idx] = 0.0;
                aColor[idx * 3] = cl.color[0];
                aColor[idx * 3 + 1] = cl.color[1];
                aColor[idx * 3 + 2] = cl.color[2];
                positions[idx * 3] = (Math.random() - 0.5) * 0.5;
                positions[idx * 3 + 1] = (Math.random() - 0.5) * 0.5;
                positions[idx * 3 + 2] = (Math.random() - 0.5) * 0.5;
                idx++;
            }
        }

        // Initialize stream particles
        for (let si = 0; si < CONNECTIONS.length; si++) {
            const [ca, cb] = CONNECTIONS[si];
            const colA = CLUSTER_DEFS[ca].color;
            const colB = CLUSTER_DEFS[cb].color;
            for (let i = 0; i < STREAM_PER_CONN; i++) {
                const t = Math.random();
                pIsStream[idx] = 1;
                pStreamConn[idx] = si;
                pStreamT[idx] = t;
                pSpeed[idx] = 0.08 + Math.random() * 0.12;
                aSize[idx] = 0.5 + Math.random() * 0.8;
                aBright[idx] = 0.0;
                aColor[idx * 3] = colA[0] + (colB[0] - colA[0]) * t;
                aColor[idx * 3 + 1] = colA[1] + (colB[1] - colA[1]) * t;
                aColor[idx * 3 + 2] = colA[2] + (colB[2] - colA[2]) * t;
                positions[idx * 3] = 0;
                positions[idx * 3 + 1] = 0;
                positions[idx * 3 + 2] = 0;
                idx++;
            }
        }

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

        // Sparse dust
        const dustCount = 200;
        const dustPos = new Float32Array(dustCount * 3);
        for (let i = 0; i < dustCount; i++) {
            dustPos[i * 3] = (Math.random() - 0.5) * 70;
            dustPos[i * 3 + 1] = (Math.random() - 0.5) * 50;
            dustPos[i * 3 + 2] = (Math.random() - 0.5) * 70;
        }
        const dustGeo = new THREE.BufferGeometry();
        dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
        scene.add(new THREE.Points(dustGeo, new THREE.PointsMaterial({
            color: 0xffffff, size: 0.015, transparent: true, opacity: 0.05,
            blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true,
        })));

        // Connection lines — much more visible now
        const lineMat = new THREE.LineBasicMaterial({
            color: 0xffffff, transparent: true, opacity: 0.12,
            blending: THREE.AdditiveBlending, depthWrite: false,
        });
        const lineGeos = [];
        const lineMeshes = [];
        for (let li = 0; li < CONNECTIONS.length; li++) {
            const lineGeo = new THREE.BufferGeometry();
            const linePos = new Float32Array(6);
            lineGeo.setAttribute('position', new THREE.BufferAttribute(linePos, 3));
            lineGeos.push(lineGeo);
            const line = new THREE.Line(lineGeo, lineMat);
            line.visible = false;
            scene.add(line);
            lineMeshes.push(line);
        }

        // HTML labels for each cluster
        const labelEls = [];
        for (const cl of CLUSTER_DEFS) {
            const lbl = document.createElement('div');
            lbl.textContent = cl.label;
            lbl.style.cssText = 'position:absolute;pointer-events:none;font-size:10px;font-weight:700;letter-spacing:0.15em;text-transform:uppercase;color:rgba(255,255,255,0);transition:color 0.5s;white-space:nowrap;transform:translate(-50%,-50%);text-shadow:0 0 8px rgba(255,255,255,0.3);';
            labelContainer.appendChild(lbl);
            labelEls.push(lbl);
        }

        const raycaster = new THREE.Raycaster();
        const cursorWorld = new THREE.Vector3();
        const ripples = [];

        let frame;
        const clock = new THREE.Clock();
        let camAngle = 0;

        function getCursorWorld() {
            const ndc = new THREE.Vector2((mx / W) * 2 - 1, -(my / H) * 2 + 1);
            raycaster.setFromCamera(ndc, camera);
            const sphere = new THREE.Sphere(new THREE.Vector3(0, 0, 0), 15);
            const target = new THREE.Vector3();
            if (raycaster.ray.intersectSphere(sphere, target)) {
                cursorWorld.copy(target);
            } else {
                cursorWorld.set(mx / W * 20 - 10, -(my / H) * 20 + 10, 0);
            }
        }

        // Find nearest visible cluster to cursor
        function nearestCluster() {
            let best = -1, bestD = Infinity;
            for (let i = 0; i < clusterCenters.length; i++) {
                if (clusterAlpha[i] < 0.3) continue;
                const dx = clusterCenters[i][0] - cursorWorld.x;
                const dy = clusterCenters[i][1] - cursorWorld.y;
                const dz = clusterCenters[i][2] - cursorWorld.z;
                const d = dx * dx + dy * dy + dz * dz;
                if (d < bestD) { bestD = d; best = i; }
            }
            return best;
        }

        // Project 3D → 2D for label positioning
        const projVec = new THREE.Vector3();
        function project3D(x, y, z) {
            projVec.set(x, y, z);
            projVec.project(camera);
            return {
                x: (projVec.x * 0.5 + 0.5) * W,
                y: (-projVec.y * 0.5 + 0.5) * H,
                visible: projVec.z < 1,
            };
        }

        function animate() {
            frame = requestAnimationFrame(animate);
            const dt = Math.min(clock.getDelta(), 0.05);
            const t = clock.elapsedTime;
            const p = progressRef.current;

            // Camera orbit
            camAngle += dt * 0.035;
            const camR = 22 - p * 5;
            camera.position.x = Math.sin(camAngle) * camR;
            camera.position.z = Math.cos(camAngle) * camR;
            camera.position.y = 6 - p * 2;
            camera.lookAt(0, 0, 0);

            getCursorWorld();
            const nearCl = nearestCluster();

            // ── Scroll-driven cluster reveal ──
            // Each cluster fades in when scroll passes its threshold
            for (let ci = 0; ci < CLUSTER_DEFS.length; ci++) {
                const th = CLUSTER_DEFS[ci].scrollThreshold;
                const targetAlpha = p >= th ? 1 : 0;
                clusterAlpha[ci] += (targetAlpha - clusterAlpha[ci]) * Math.min(1, dt * 2.5);

                // Lerp centers: from origin to actual position as alpha grows
                const def = CLUSTER_DEFS[ci].center;
                const alpha = clusterAlpha[ci];
                clusterCenters[ci][0] += (def[0] * alpha - clusterCenters[ci][0]) * Math.min(1, dt * 3);
                clusterCenters[ci][1] += (def[1] * alpha - clusterCenters[ci][1]) * Math.min(1, dt * 3);
                clusterCenters[ci][2] += (def[2] * alpha - clusterCenters[ci][2]) * Math.min(1, dt * 3);
            }

            // Optimize animation decay
            for (let ci = 0; ci < CLUSTER_DEFS.length; ci++) {
                if (optimizing[ci] > 0) {
                    optimizing[ci] += dt * 2;
                    if (optimizing[ci] > 3) optimizing[ci] = 0;
                }
            }

            // Ripple decay
            for (let ri = ripples.length - 1; ri >= 0; ri--) {
                ripples[ri].t += dt;
                if (ripples[ri].t > 2.5) ripples.splice(ri, 1);
            }

            // Update connection lines
            for (let li = 0; li < CONNECTIONS.length; li++) {
                const [ca, cb] = CONNECTIONS[li];
                const vis = clusterAlpha[ca] > 0.3 && clusterAlpha[cb] > 0.3;
                lineMeshes[li].visible = vis;
                if (vis) {
                    const linePos = lineGeos[li].attributes.position.array;
                    linePos[0] = clusterCenters[ca][0]; linePos[1] = clusterCenters[ca][1]; linePos[2] = clusterCenters[ca][2];
                    linePos[3] = clusterCenters[cb][0]; linePos[4] = clusterCenters[cb][1]; linePos[5] = clusterCenters[cb][2];
                    lineGeos[li].attributes.position.needsUpdate = true;
                }
            }

            // ── Update labels ──
            for (let ci = 0; ci < CLUSTER_DEFS.length; ci++) {
                const alpha = clusterAlpha[ci];
                const lbl = labelEls[ci];
                if (alpha < 0.05) {
                    lbl.style.color = 'rgba(255,255,255,0)';
                    continue;
                }
                // Position label above cluster center
                const proj = project3D(clusterCenters[ci][0], clusterCenters[ci][1] + CLUSTER_DEFS[ci].R + 0.8, clusterCenters[ci][2]);
                if (proj.visible) {
                    lbl.style.left = proj.x + 'px';
                    lbl.style.top = proj.y + 'px';
                    const highlight = ci === nearCl ? 0.6 : 0.25;
                    const a = alpha * highlight;
                    lbl.style.color = `rgba(255,255,255,${a.toFixed(2)})`;
                } else {
                    lbl.style.color = 'rgba(255,255,255,0)';
                }
            }

            const posArr = geometry.attributes.position.array;
            const brightArr = geometry.attributes.aBright.array;
            const sizeArr = geometry.attributes.aSize.array;
            const colorArr = geometry.attributes.aColor.array;

            let pidx = 0;

            // ── Cluster particles ──
            for (let ci = 0; ci < CLUSTER_DEFS.length; ci++) {
                const cl = CLUSTER_DEFS[ci];
                const alpha = clusterAlpha[ci];
                const center = clusterCenters[ci];
                const opt = optimizing[ci]; // optimize animation phase

                for (let i = 0; i < cl.count; i++) {
                    if (alpha < 0.02) {
                        brightArr[pidx] = 0;
                        sizeArr[pidx] = 0;
                        pidx++;
                        continue;
                    }

                    // Advance orbit
                    pAngle[pidx] += cl.speed * pSpeed[pidx] * dt * (0.3 + p * 1.0);
                    const theta = pAngle[pidx];

                    // During optimize: tighten orbit radius
                    let effR = cl.R;
                    let brightBoost = 0;
                    if (opt > 0 && opt < 3) {
                        // Phase 0-1: tighten. 1-2: pulse bright. 2-3: release
                        if (opt < 1) {
                            effR = cl.R * (1 - opt * 0.5); // shrink to 50%
                        } else if (opt < 2) {
                            effR = cl.R * 0.5;
                            brightBoost = Math.sin((opt - 1) * Math.PI) * 0.5; // pulse
                        } else {
                            effR = cl.R * (0.5 + (opt - 2) * 0.5); // expand back
                        }
                    }

                    const orbitX = Math.cos(theta) * effR;
                    const orbitY = Math.sin(theta) * effR * 0.7;
                    const tilted = applyTilt(orbitX, orbitY, 0, cl.tiltX, cl.tiltZ);

                    const baseX = center[0] + tilted.x;
                    const baseY = center[1] + tilted.y;
                    const baseZ = center[2] + tilted.z;

                    const px = baseX + pOffset[pidx * 3];
                    const py = baseY + pOffset[pidx * 3 + 1];
                    const pz = baseZ + pOffset[pidx * 3 + 2];

                    // Distance to cursor
                    const dx = cursorWorld.x - px;
                    const dy = cursorWorld.y - py;
                    const dz = cursorWorld.z - pz;
                    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

                    const proximityGlow = dist < 10 ? Math.pow(1 - dist / 10, 1.5) : 0;
                    const clusterHighlight = ci === nearCl ? 0.12 : 0;

                    brightArr[pidx] = (0.22 + p * 0.08 + proximityGlow * 0.65 + clusterHighlight + brightBoost) * alpha;
                    sizeArr[pidx] = aSize[pidx] * (0.6 + p * 0.25 + proximityGlow * 2) * alpha;

                    // Color
                    colorArr[pidx * 3] = cl.color[0];
                    colorArr[pidx * 3 + 1] = cl.color[1];
                    colorArr[pidx * 3 + 2] = cl.color[2];

                    // Cursor push
                    if (dist < 6 && dist > 0.05) {
                        const pushStr = mouseDown ? (1 - dist / 6) * 14 * dt : (1 - dist / 6) * 4 * dt;
                        const invD = 1 / dist;
                        pOffset[pidx * 3] -= dx * invD * pushStr;
                        pOffset[pidx * 3 + 1] -= dy * invD * pushStr;
                        pOffset[pidx * 3 + 2] -= dz * invD * pushStr;
                    }

                    // Ripples
                    for (const r of ripples) {
                        const rx = px - r.x, ry = py - r.y, rz = pz - r.z;
                        const rd = Math.sqrt(rx * rx + ry * ry + rz * rz);
                        const ringR = r.t * 14;
                        const ringDist = Math.abs(rd - ringR);
                        if (ringDist < 2 && rd > 0.1) {
                            const wave = (1 - ringDist / 2) * Math.max(0, 1 - r.t / 2) * 6 * dt;
                            pOffset[pidx * 3] += (rx / rd) * wave;
                            pOffset[pidx * 3 + 1] += (ry / rd) * wave;
                            pOffset[pidx * 3 + 2] += (rz / rd) * wave;
                        }
                    }

                    // Spring return
                    pOffset[pidx * 3] *= Math.max(0, 1 - 2.5 * dt);
                    pOffset[pidx * 3 + 1] *= Math.max(0, 1 - 2.5 * dt);
                    pOffset[pidx * 3 + 2] *= Math.max(0, 1 - 2.5 * dt);

                    posArr[pidx * 3] = px;
                    posArr[pidx * 3 + 1] = py;
                    posArr[pidx * 3 + 2] = pz;

                    pidx++;
                }
            }

            // ── Stream particles ──
            for (let si = 0; si < CONNECTIONS.length; si++) {
                const [ca, cb] = CONNECTIONS[si];
                const cenA = clusterCenters[ca];
                const cenB = clusterCenters[cb];
                const vis = clusterAlpha[ca] > 0.3 && clusterAlpha[cb] > 0.3;
                const streamAlpha = vis ? Math.min(clusterAlpha[ca], clusterAlpha[cb]) : 0;

                for (let i = 0; i < STREAM_PER_CONN; i++) {
                    if (streamAlpha < 0.05) {
                        brightArr[pidx] = 0;
                        sizeArr[pidx] = 0;
                        pidx++;
                        continue;
                    }

                    // Flow along connection
                    pStreamT[pidx] += pSpeed[pidx] * dt * (0.4 + p * 1.2);
                    if (pStreamT[pidx] > 1) pStreamT[pidx] -= 1;
                    const st = pStreamT[pidx];

                    // Quadratic bezier arc
                    const midX = (cenA[0] + cenB[0]) / 2;
                    const midY = (cenA[1] + cenB[1]) / 2 + 2.0;
                    const midZ = (cenA[2] + cenB[2]) / 2;
                    const a2 = (1 - st), b2 = st;
                    const arcX = cenA[0] * a2 * a2 + midX * 2 * a2 * b2 + cenB[0] * b2 * b2;
                    const arcY = cenA[1] * a2 * a2 + midY * 2 * a2 * b2 + cenB[1] * b2 * b2;
                    const arcZ = cenA[2] * a2 * a2 + midZ * 2 * a2 * b2 + cenB[2] * b2 * b2;

                    // Helix wrap around path (wider = more visible)
                    const helixAngle = st * Math.PI * 6 + t * 0.3 + si * 2;
                    const helixR = 0.5;
                    const hx = Math.cos(helixAngle) * helixR;
                    const hy = Math.sin(helixAngle) * helixR;

                    posArr[pidx * 3] = arcX + hx + pOffset[pidx * 3];
                    posArr[pidx * 3 + 1] = arcY + hy + pOffset[pidx * 3 + 1];
                    posArr[pidx * 3 + 2] = arcZ + Math.sin(helixAngle * 0.7) * helixR * 0.4 + pOffset[pidx * 3 + 2];

                    // Pulsing wave along the stream (traveling brightness)
                    const pulseWave = Math.sin((st - t * 0.5) * Math.PI * 4) * 0.5 + 0.5;

                    // Distance to cursor
                    const dx = cursorWorld.x - posArr[pidx * 3];
                    const dy = cursorWorld.y - posArr[pidx * 3 + 1];
                    const dz = cursorWorld.z - posArr[pidx * 3 + 2];
                    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
                    const glow = dist < 8 ? Math.pow(1 - dist / 8, 1.5) : 0;

                    const connHighlight = (ca === nearCl || cb === nearCl) ? 0.15 : 0;
                    brightArr[pidx] = (0.1 + pulseWave * 0.12 + p * 0.06 + glow * 0.5 + connHighlight) * streamAlpha;
                    sizeArr[pidx] = aSize[pidx] * (0.5 + p * 0.15 + glow * 1.5) * streamAlpha;

                    // Cursor push
                    if (dist < 4 && dist > 0.05) {
                        const pushStr = mouseDown ? (1 - dist / 4) * 8 * dt : (1 - dist / 4) * 2 * dt;
                        const invD = 1 / dist;
                        pOffset[pidx * 3] -= dx * invD * pushStr;
                        pOffset[pidx * 3 + 1] -= dy * invD * pushStr;
                        pOffset[pidx * 3 + 2] -= dz * invD * pushStr;
                    }

                    pOffset[pidx * 3] *= Math.max(0, 1 - 3 * dt);
                    pOffset[pidx * 3 + 1] *= Math.max(0, 1 - 3 * dt);
                    pOffset[pidx * 3 + 2] *= Math.max(0, 1 - 3 * dt);

                    pidx++;
                }
            }

            geometry.attributes.position.needsUpdate = true;
            geometry.attributes.aBright.needsUpdate = true;
            geometry.attributes.aSize.needsUpdate = true;
            geometry.attributes.aColor.needsUpdate = true;

            renderer.render(scene, camera);
        }
        animate();

        // Click: optimize nearest cluster + ripple
        function onMove(e) { mx = e.clientX; my = e.clientY; }
        function onClick() {
            getCursorWorld();
            ripples.push({ x: cursorWorld.x, y: cursorWorld.y, z: cursorWorld.z, t: 0 });
            const nc = nearestCluster();
            if (nc >= 0 && optimizing[nc] === 0) {
                optimizing[nc] = 0.01; // start optimize animation
            }
        }
        function onDown(e) { if (e.button === 0) mouseDown = true; }
        function onUp() { mouseDown = false; }
        function onTouchStart(e) {
            if (e.touches.length > 0) {
                mx = e.touches[0].clientX; my = e.touches[0].clientY;
                mouseDown = true;
                onClick();
            }
        }
        function onTouchMove(e) {
            if (e.touches.length > 0) { mx = e.touches[0].clientX; my = e.touches[0].clientY; }
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
            // Clean up labels
            while (labelContainer.firstChild) labelContainer.removeChild(labelContainer.firstChild);
        };
    }, []);

    return (
        <div className={className} style={{ position: 'relative' }}>
            <div ref={mountRef} style={{ position: 'absolute', inset: 0 }} />
            <div ref={labelsRef} style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 1 }} />
        </div>
    );
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
   MAIN PAGE
   ════════════════════════════════════════════════════════════ */

export default function HomeV18B() {
    const pageRef = useRef(null);
    const { scrollYProgress } = useScroll({ target: pageRef });
    const [cityProgress, setCityProgress] = useState(0);
    useEffect(() => { const unsub = scrollYProgress.on('change', (v) => setCityProgress(v)); return unsub; }, [scrollYProgress]);

    return (
        <div ref={pageRef} className="bg-[#050508] text-white selection:bg-teal-400/30 overflow-x-hidden">
            <div className="fixed inset-0 z-10">
                <InteractiveCity className="absolute inset-0 w-full h-full" scrollProgress={cityProgress} />
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
                        <div className="mt-6 flex flex-col items-center gap-1.5">
                            <p className="text-[11px] text-white/25 tracking-wide">
                                Scroll to grow. Click to optimize. Drag to disrupt.
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
