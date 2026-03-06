/* ═══════════════════════════════════════════════════════════════
   Vision Tracking Engine — In-Browser MediaPipe + Three.js
   
   ✦ MediaPipe Hands — IN-BROWSER, no server latency
   ✦ 13 gesture types with visual effects
   ✦ Particle sphere with fingertip repulsion physics
   ✦ Camera feed with skeleton overlay
   ═══════════════════════════════════════════════════════════════ */

// ── State ──────────────────────────────────────────────────────
let scene, camera, renderer, controls;
let mpHands = null;
let mpCamera = null;
let cameraRunning = false;

let handData = [];
let particleSphere = null;
let trailParticles = [];
let ripples = [];
let gestureFlashTimer = null;
let eventLog = [];
let frameCount = 0;
let lastFpsTime = performance.now();
let currentFps = 0;

// MediaPipe connections
const CONNECTIONS = [
    [0,1],[1,2],[2,3],[3,4],
    [0,5],[5,6],[6,7],[7,8],
    [0,9],[9,10],[10,11],[11,12],
    [0,13],[13,14],[14,15],[15,16],
    [0,17],[17,18],[18,19],[19,20],
    [5,9],[9,13],[13,17],
];

const TIP  = [4, 8, 12, 16, 20];
const PIP  = [3, 6, 10, 14, 18];
const MCP  = [2, 5, 9, 13, 17];

const FNAMES  = ['thumb','index','middle','ring','pinky'];
const FEMOJI  = ['👍','☝️','🖕','💍','🤙'];

// ── All gestures with emoji + color ────────────────────────────
const GESTURES = {
    thumbs_up:     { emoji: '👍', label: 'THUMBS UP',     color: 0x34d399, cssClass: 'thumbs_up' },
    thumbs_down:   { emoji: '👎', label: 'THUMBS DOWN',   color: 0xfb7185, cssClass: 'thumbs_down' },
    peace:         { emoji: '✌️', label: 'PEACE',          color: 0x7c6aff, cssClass: 'peace' },
    middle_finger: { emoji: '🖕', label: 'F**K YOU',      color: 0xfb923c, cssClass: 'middle_finger' },
    rock:          { emoji: '🤘', label: 'ROCK ON',       color: 0xfbbf24, cssClass: 'rock' },
    ok:            { emoji: '👌', label: 'OK',            color: 0x38bdf8, cssClass: 'ok' },
    pinch:         { emoji: '🤏', label: 'PINCH',         color: 0xfbbf24, cssClass: 'pinch' },
    open_palm:     { emoji: '✋', label: 'OPEN PALM',     color: 0x22d3ee, cssClass: 'open_palm' },
    fist:          { emoji: '✊', label: 'FIST',           color: 0xfb7185, cssClass: 'fist' },
    pointing:      { emoji: '☝️', label: 'POINTING',      color: 0x34d399, cssClass: 'pointing' },
    call_me:       { emoji: '🤙', label: 'CALL ME',       color: 0x22d3ee, cssClass: 'call_me' },
    three:         { emoji: '3️⃣',  label: 'THREE',         color: 0xa78bfa, cssClass: 'three' },
    spiderman:     { emoji: '🕷️', label: 'SPIDERMAN',     color: 0xfb7185, cssClass: 'spiderman' },
};


// ═══════════════════════════════════════════════════════════════
//  THREE.JS SCENE
// ═══════════════════════════════════════════════════════════════

function initThreeJS() {
    const container = document.getElementById('canvas-container');

    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(60, innerWidth/innerHeight, 0.1, 100);
    camera.position.set(0, 0, 4);

    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(innerWidth, innerHeight);
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 1);
    container.appendChild(renderer.domElement);

    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.enablePan = false;
    controls.maxDistance = 8;
    controls.minDistance = 2;
    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.4;

    // Moody lighting
    scene.add(new THREE.AmbientLight(0x1a1a30, 0.3));
    const p1 = new THREE.PointLight(0x7c6aff, 2, 15);
    p1.position.set(3, 3, 5);
    scene.add(p1);
    const p2 = new THREE.PointLight(0x22d3ee, 1, 15);
    p2.position.set(-3, -2, 4);
    scene.add(p2);
    const p3 = new THREE.PointLight(0x34d399, 0.6, 12);
    p3.position.set(0, -3, 3);
    scene.add(p3);

    createParticleSphere();

    window.addEventListener('resize', () => {
        camera.aspect = innerWidth / innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(innerWidth, innerHeight);
    });
}


function createParticleSphere() {
    const count = 4000;
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(count * 3);
    const col = new Float32Array(count * 3);
    const basePos = new Float32Array(count * 3);

    const R = 1.6;
    for (let i = 0; i < count; i++) {
        const y = 1 - (i / (count - 1)) * 2;
        const rY = Math.sqrt(1 - y * y);
        const theta = ((1 + Math.sqrt(5)) / 2) * i * Math.PI * 2;
        const x = rY * Math.cos(theta) * R;
        const z = rY * Math.sin(theta) * R;
        const yp = y * R;

        pos[i*3] = x; pos[i*3+1] = yp; pos[i*3+2] = z;
        basePos[i*3] = x; basePos[i*3+1] = yp; basePos[i*3+2] = z;

        // Gradient: deep purple → cyan → emerald
        const t = (y + 1) / 2;
        if (t < 0.5) {
            const s = t * 2;
            col[i*3]   = 0.49*(1-s) + 0.13*s;
            col[i*3+1] = 0.42*(1-s) + 0.83*s;
            col[i*3+2] = 1.0;
        } else {
            const s = (t - 0.5) * 2;
            col[i*3]   = 0.13*(1-s) + 0.2*s;
            col[i*3+1] = 0.83*(1-s) + 0.83*s;
            col[i*3+2] = 0.93*(1-s) + 0.6*s;
        }
    }

    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.userData = { basePositions: basePos };

    const mat = new THREE.PointsMaterial({
        size: 0.025,
        vertexColors: true,
        transparent: true,
        opacity: 0.85,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        sizeAttenuation: true,
    });

    particleSphere = new THREE.Points(geo, mat);
    scene.add(particleSphere);
}


function updateParticleSphere(time) {
    if (!particleSphere) return;
    const pos = particleSphere.geometry.attributes.position.array;
    const base = particleSphere.geometry.userData.basePositions;
    const col = particleSphere.geometry.attributes.color.array;
    const n = pos.length / 3;

    const tips3D = [];
    for (const hand of handData) {
        for (const tid of TIP) {
            const lm = hand.landmarks[tid];
            if (lm) tips3D.push({ x: (lm.x-0.5)*4, y: -(lm.y-0.5)*4, z: -lm.z*2 });
        }
    }
    const hasHands = tips3D.length > 0;

    for (let i = 0; i < n; i++) {
        const bx = base[i*3], by = base[i*3+1], bz = base[i*3+2];
        const breathe = 1 + Math.sin(time*0.6 + i*0.008) * 0.025;
        let tx = bx * breathe, ty = by * breathe, tz = bz * breathe;

        if (hasHands) {
            let fx=0, fy=0, fz=0, totalF=0;
            for (const tip of tips3D) {
                const dx=tx-tip.x, dy=ty-tip.y, dz=tz-tip.z;
                const dist = Math.sqrt(dx*dx+dy*dy+dz*dz);
                if (dist < 2.2) {
                    const force = Math.pow(Math.max(0,1-dist/2.2), 2) * 0.9;
                    const norm = dist || 0.001;
                    fx += (dx/norm)*force;
                    fy += (dy/norm)*force;
                    fz += (dz/norm)*force;
                    totalF += force;
                }
            }
            tx += fx; ty += fy; tz += fz;

            if (totalF > 0.03) {
                const t = Math.min(1, totalF*3);
                col[i*3]   += (1.0 - col[i*3])   * t * 0.1;
                col[i*3+1] += (1.0 - col[i*3+1]) * t * 0.1;
                col[i*3+2] += (1.0 - col[i*3+2]) * t * 0.05;
            }
        } else {
            const origT = (by/1.6 + 1)/2;
            col[i*3]   += (0.49*(1-origT) - col[i*3])   * 0.01;
            col[i*3+1] += (0.42*(1-origT)+0.83*origT - col[i*3+1]) * 0.01;
            col[i*3+2] += (1.0 - col[i*3+2]) * 0.01;
        }

        pos[i*3]   += (tx - pos[i*3])   * 0.07;
        pos[i*3+1] += (ty - pos[i*3+1]) * 0.07;
        pos[i*3+2] += (tz - pos[i*3+2]) * 0.07;
    }

    particleSphere.geometry.attributes.position.needsUpdate = true;
    particleSphere.geometry.attributes.color.needsUpdate = true;
    particleSphere.rotation.y += 0.0008;
}


// ── Trail & Ripple ─────────────────────────────────────────────

function spawnTrail(x,y,z,color) {
    const g = new THREE.SphereGeometry(0.018, 6, 6);
    const m = new THREE.MeshBasicMaterial({ color, transparent:true, opacity:0.85 });
    const mesh = new THREE.Mesh(g, m);
    mesh.position.set(x, y, z);
    mesh.userData = { age:0, maxAge:25 };
    scene.add(mesh);
    trailParticles.push(mesh);
}

function spawnRipple(x,y,z,color) {
    const g = new THREE.RingGeometry(0.01, 0.04, 32);
    const m = new THREE.MeshBasicMaterial({ color, transparent:true, opacity:1, side:THREE.DoubleSide });
    const mesh = new THREE.Mesh(g, m);
    mesh.position.set(x,y,z);
    mesh.lookAt(camera.position);
    mesh.userData = { age:0, maxAge:35 };
    scene.add(mesh);
    ripples.push(mesh);
}

function updateEffects() {
    for (let i = trailParticles.length-1; i >= 0; i--) {
        const p = trailParticles[i]; p.userData.age++;
        const pr = p.userData.age / p.userData.maxAge;
        p.material.opacity = Math.max(0, 0.85*(1-pr));
        p.scale.setScalar(Math.max(0.1, 1-pr*0.7));
        if (p.userData.age >= p.userData.maxAge) {
            scene.remove(p); p.geometry.dispose(); p.material.dispose();
            trailParticles.splice(i,1);
        }
    }
    while (trailParticles.length > 250) {
        const old = trailParticles.shift();
        scene.remove(old); old.geometry.dispose(); old.material.dispose();
    }

    for (let i = ripples.length-1; i >= 0; i--) {
        const r = ripples[i]; r.userData.age++;
        const pr = r.userData.age / r.userData.maxAge;
        r.scale.setScalar(1 + pr*8);
        r.material.opacity = 1 - pr;
        if (r.userData.age >= r.userData.maxAge) {
            scene.remove(r); r.geometry.dispose(); r.material.dispose();
            ripples.splice(i,1);
        }
    }
}


// ═══════════════════════════════════════════════════════════════
//  MEDIAPIPE (IN-BROWSER)
// ═══════════════════════════════════════════════════════════════

function initMediaPipe() {
    mpHands = new Hands({
        locateFile: (file) =>
            `https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4.1675469240/${file}`
    });
    mpHands.setOptions({
        maxNumHands: 2,
        modelComplexity: 1,
        minDetectionConfidence: 0.6,
        minTrackingConfidence: 0.5,
    });
    mpHands.onResults(onResults);
}


function onResults(results) {
    // FPS
    frameCount++;
    const now = performance.now();
    if (now - lastFpsTime >= 1000) {
        currentFps = frameCount; frameCount = 0; lastFpsTime = now;
        document.getElementById('fps-value').textContent = currentFps;
    }

    // Canvas overlay
    const canvas = document.getElementById('hand-overlay');
    const video = document.getElementById('webcam');
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    handData = [];

    if (results.multiHandLandmarks?.length > 0) {
        document.getElementById('hands-value').textContent = results.multiHandLandmarks.length;

        for (let h = 0; h < results.multiHandLandmarks.length; h++) {
            const lm = results.multiHandLandmarks[h];
            const label = results.multiHandedness?.[h]?.label || 'Unknown';
            handData.push({ landmarks: lm, handedness: label });

            drawHand(ctx, lm, canvas.width, canvas.height, h);

            for (const tid of TIP) {
                const l = lm[tid];
                spawnTrail((l.x-0.5)*4, -(l.y-0.5)*4, -l.z*2, h===0 ? 0x7c6aff : 0x22d3ee);
            }

            const gestures = detectAllGestures(lm, label);
            updateFingerStatus(lm);

            if (gestures.length > 0) {
                showGestureBadges(gestures, label);
                for (const g of gestures) {
                    const pos = lm[0]; // wrist as anchor
                    spawnRipple((pos.x-0.5)*4, -(pos.y-0.5)*4, 0.3, GESTURES[g]?.color || 0xffffff);
                }
            }
        }
    } else {
        document.getElementById('hands-value').textContent = '0';
        clearFingerStatus();
    }
}


function drawHand(ctx, lm, w, h, hIdx) {
    const c = hIdx === 0 ? '#7c6aff' : '#22d3ee';
    const glow = hIdx === 0 ? 'rgba(124,106,255,0.35)' : 'rgba(34,211,238,0.35)';

    ctx.strokeStyle = c; ctx.lineWidth = 2;
    ctx.shadowColor = glow; ctx.shadowBlur = 10;

    for (const [a,b] of CONNECTIONS) {
        ctx.beginPath();
        ctx.moveTo(lm[a].x*w, lm[a].y*h);
        ctx.lineTo(lm[b].x*w, lm[b].y*h);
        ctx.stroke();
    }

    ctx.shadowBlur = 0;
    for (let i = 0; i < lm.length; i++) {
        const isTip = TIP.includes(i);
        ctx.beginPath();
        ctx.arc(lm[i].x*w, lm[i].y*h, isTip?5:3, 0, Math.PI*2);
        ctx.fillStyle = isTip ? '#34d399' : c;
        ctx.fill();
        if (isTip) {
            ctx.beginPath();
            ctx.arc(lm[i].x*w, lm[i].y*h, 14, 0, Math.PI*2);
            ctx.fillStyle = 'rgba(52,211,153,0.12)';
            ctx.fill();
        }
    }
}


// ═══════════════════════════════════════════════════════════════
//  GESTURE DETECTION — 13 GESTURES
// ═══════════════════════════════════════════════════════════════

function isFingerUp(lm, fingerIdx) {
    if (fingerIdx === 0) {
        // Thumb: tip farther from wrist (x) than IP joint
        return Math.abs(lm[TIP[0]].x - lm[0].x) > Math.abs(lm[MCP[0]].x - lm[0].x);
    }
    return lm[TIP[fingerIdx]].y < lm[PIP[fingerIdx]].y;
}

function isFingerCurled(lm, fingerIdx) {
    if (fingerIdx === 0) return !isFingerUp(lm, 0);
    return lm[TIP[fingerIdx]].y > lm[MCP[fingerIdx]].y;
}

function fingerStates(lm) {
    return FNAMES.map((_,i) => isFingerUp(lm, i));
}

function dist2D(a, b) {
    return Math.sqrt((a.x-b.x)**2 + (a.y-b.y)**2);
}


let lastGestureTime = {};

function detectAllGestures(lm, handedness) {
    const now = Date.now();
    const up = fingerStates(lm);
    const [thumbUp, indexUp, middleUp, ringUp, pinkyUp] = up;
    const detected = [];

    // ── 1. THUMBS UP: only thumb extended, hand roughly upright ──
    if (thumbUp && !indexUp && !middleUp && !ringUp && !pinkyUp) {
        if (lm[TIP[0]].y < lm[MCP[0]].y) {
            detected.push('thumbs_up');
        } else {
            detected.push('thumbs_down');
        }
    }

    // ── 2. PEACE: index + middle up, rest down ──
    if (!thumbUp && indexUp && middleUp && !ringUp && !pinkyUp) {
        detected.push('peace');
    }

    // ── 3. MIDDLE FINGER: only middle up ──
    if (!thumbUp && !indexUp && middleUp && !ringUp && !pinkyUp) {
        detected.push('middle_finger');
    }

    // ── 4. ROCK 🤘: index + pinky up, middle + ring down ──
    if (!thumbUp && indexUp && !middleUp && !ringUp && pinkyUp) {
        detected.push('rock');
    }

    // ── 5. OK 👌: thumb-index circle, others extended ──
    const okDist = dist2D(lm[TIP[0]], lm[TIP[1]]);
    if (okDist < 0.06 && middleUp && ringUp && pinkyUp) {
        detected.push('ok');
    }

    // ── 6. PINCH 🤏: thumb-index close, others can vary ──
    if (okDist < 0.06 && !detected.includes('ok')) {
        detected.push('pinch');
    }

    // ── 7. OPEN PALM ✋: all five up ──
    if (thumbUp && indexUp && middleUp && ringUp && pinkyUp) {
        detected.push('open_palm');
    }

    // ── 8. FIST ✊: all curled ──
    if (!thumbUp && !indexUp && !middleUp && !ringUp && !pinkyUp) {
        detected.push('fist');
    }

    // ── 9. POINTING ☝️: only index up ──
    if (!thumbUp && indexUp && !middleUp && !ringUp && !pinkyUp) {
        detected.push('pointing');
    }

    // ── 10. CALL ME 🤙: thumb + pinky up, rest down ──
    if (thumbUp && !indexUp && !middleUp && !ringUp && pinkyUp) {
        detected.push('call_me');
    }

    // ── 11. THREE 3️⃣: index + middle + ring up ──
    if (!thumbUp && indexUp && middleUp && ringUp && !pinkyUp) {
        detected.push('three');
    }

    // ── 12. SPIDERMAN 🕷️: thumb + index + pinky up ──
    if (thumbUp && indexUp && !middleUp && !ringUp && pinkyUp) {
        detected.push('spiderman');
    }

    // Flash + log (cooldown per gesture)
    for (const g of detected) {
        const key = `${handedness}_${g}`;
        if (!lastGestureTime[key] || now - lastGestureTime[key] > 1200) {
            lastGestureTime[key] = now;
            const info = GESTURES[g];
            if (info) {
                flashGesture(`${info.emoji} ${info.label}`);
                addEventLog(`${handedness}: ${info.emoji} ${g}`);
            }
        }
    }

    return detected;
}


// ── UI ─────────────────────────────────────────────────────────

function showGestureBadges(gestures, handedness) {
    const container = document.getElementById('gesture-display');
    container.innerHTML = '';
    for (const g of gestures) {
        const info = GESTURES[g];
        if (!info) continue;
        const badge = document.createElement('span');
        badge.className = `gesture-badge ${info.cssClass}`;
        badge.textContent = `${info.emoji} ${g.replace(/_/g,' ')}`;
        container.appendChild(badge);
    }
}


function updateFingerStatus(lm) {
    const up = fingerStates(lm);
    for (let f = 0; f < 5; f++) {
        const el = document.getElementById(`f-${FNAMES[f]}`);
        if (!el) continue;
        el.textContent = `${FEMOJI[f]} ${up[f] ? 'UP' : 'DN'}`;
        el.className = `finger ${up[f] ? 'up' : 'down'}`;
    }
}

function clearFingerStatus() {
    for (let f = 0; f < 5; f++) {
        const el = document.getElementById(`f-${FNAMES[f]}`);
        if (el) { el.textContent = `${FEMOJI[f]} —`; el.className = 'finger'; }
    }
    document.getElementById('gesture-display').innerHTML =
        '<span class="gesture-placeholder">Waiting for hands...</span>';
}


// ── Camera ─────────────────────────────────────────────────────

async function startCamera() {
    const video = document.getElementById('webcam');
    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            video: { width: 640, height: 480, facingMode: 'user' }
        });
        video.srcObject = stream;
        await video.play();

        initMediaPipe();
        mpCamera = new Camera(video, {
            onFrame: async () => { await mpHands.send({ image: video }); },
            width: 640, height: 480,
        });
        mpCamera.start();
        cameraRunning = true;

        const ind = document.getElementById('connection-indicator');
        ind.classList.remove('disconnected');
        ind.classList.add('connected');
        document.getElementById('connection-text').textContent = 'Camera Active';
        document.getElementById('btn-start').textContent = '🎥 Running...';
        document.getElementById('btn-start').disabled = true;
        addEventLog('Camera started');
    } catch (err) {
        console.error('Camera error:', err);
        addEventLog('Camera access denied!');
    }
}

function stopCamera() {
    if (mpCamera) { mpCamera.stop(); mpCamera = null; }
    cameraRunning = false;
    const v = document.getElementById('webcam');
    if (v.srcObject) { v.srcObject.getTracks().forEach(t => t.stop()); v.srcObject = null; }
    handData = [];
    const ind = document.getElementById('connection-indicator');
    ind.classList.remove('connected'); ind.classList.add('disconnected');
    document.getElementById('connection-text').textContent = 'Camera Off';
    document.getElementById('btn-start').textContent = '🎥 Start Camera';
    document.getElementById('btn-start').disabled = false;
    addEventLog('Camera stopped');
}

function toggleCameraSize() {
    document.getElementById('camera-panel').classList.toggle('expanded');
}


// ── Helpers ────────────────────────────────────────────────────

function flashGesture(text) {
    const el = document.getElementById('gesture-flash');
    el.textContent = text;
    el.classList.remove('hidden'); el.classList.add('visible');
    if (gestureFlashTimer) clearTimeout(gestureFlashTimer);
    gestureFlashTimer = setTimeout(() => {
        el.classList.remove('visible'); el.classList.add('hidden');
    }, 550);
}

function addEventLog(msg) {
    const t = new Date().toLocaleTimeString('en-US', { hour12: false });
    eventLog.unshift({ time: t, message: msg });
    if (eventLog.length > 40) eventLog.pop();
    document.getElementById('event-log').innerHTML = eventLog.slice(0,18).map(e =>
        `<div class="event-entry"><span class="time">${e.time}</span> <span class="event-type">${e.message}</span></div>`
    ).join('');
}


// ── Render Loop ────────────────────────────────────────────────

function animate(time) {
    requestAnimationFrame(animate);
    updateParticleSphere(time * 0.001);
    updateEffects();
    controls.update();
    renderer.render(scene, camera);
}


// ── Boot ───────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
    initThreeJS();
    animate(0);
    addEventLog('Ready — click Start Camera');
});
