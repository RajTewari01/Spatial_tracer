/* ═══════════════════════════════════════════════════════════════
   MotionW — In-Browser MediaPipe + Three.js
   ✦ Cupertino Minimalist & Solid Theme
   ✦ Complete Black Background (#000000)
   ✦ Zero Red: Pure White, Titanium, Champagne Gold, Green
   ✦ Small Floating Globe by default on mobile (zoomable via gesture)
   ✦ Widescreen 16:9 Rectangular PiP Camera
   ✦ Live FPS Motion from 3D Render Loop
   ✦ Creator Profile Modal: Biswadeep Tewari (from mobile_client_v2)
   ═══════════════════════════════════════════════════════════════ */

// ── State ──────────────────────────────────────────────────────
let scene, camera, renderer, controls;
let mpHands = null, mpCamera = null, cameraRunning = false;
let handData = [];
let particleSphere = null;
let trailParticles = [], ripples = [];
let gestureFlashTimer = null;
let eventLog = [];
let animFrames = 0, lastAnimTime = performance.now(), currentFps = 60;
let trailFrameSkip = 0;

const CONN = [
    [0,1],[1,2],[2,3],[3,4],
    [0,5],[5,6],[6,7],[7,8],
    [0,9],[9,10],[10,11],[11,12],
    [0,13],[13,14],[14,15],[15,16],
    [0,17],[17,18],[18,19],[19,20],
    [5,9],[9,13],[13,17],
];

const TIP = [4, 8, 12, 16, 20];
const DIP = [3, 7, 11, 15, 19];
const PIP = [3, 6, 10, 14, 18];
const MCP = [2, 5, 9,  13, 17];

const FNAMES = ['thumb','index','middle','ring','pinky'];
const FLABELS = ['THM','IDX','MID','RNG','PNK'];

// ── Gesture Catalog — ZERO RED (Cupertino Gold, White, Titanium, Silver) ──
const G = {
    thumbs_up:     { label: 'THUMBS UP',     color: 0xd4af37 },
    thumbs_down:   { label: 'THUMBS DOWN',   color: 0x8e8e93 },
    peace:         { label: 'PEACE',          color: 0xffffff },
    middle_finger: { label: 'MIDDLE FINGER', color: 0x636366 },
    rock:          { label: 'ROCK',           color: 0xd4af37 },
    ok:            { label: 'OK SIGN',        color: 0xffffff },
    pinch:         { label: 'PINCH',          color: 0xc5a059 },
    open_palm:     { label: 'OPEN PALM',      color: 0xd4af37 },
    fist:          { label: 'FIST',           color: 0x8e8e93 },
    pointing:      { label: 'POINTING',       color: 0xffffff },
    call_me:       { label: 'CALL ME',        color: 0xd4af37 },
    three:         { label: 'THREE',          color: 0xc5a059 },
    spiderman:     { label: 'SPIDERMAN',      color: 0xffffff },
};


// ═══════════════════════════════════════════════════════════════
//  TYPEWRITER ENGINE
// ═══════════════════════════════════════════════════════════════

class Typewriter {
    constructor(el, opts = {}) {
        this.el = el;
        this.speed = opts.speed || 60;
        this.queue = [];
        this.running = false;
    }
    type(text) { this.queue.push({ action: 'type', text }); return this; }
    clear() { this.queue.push({ action: 'clear' }); return this; }
    wait(ms) { this.queue.push({ action: 'wait', ms }); return this; }
    loop() { this.queue.push({ action: 'loop' }); return this; }
    async start() {
        if (this.running || !this.el) return;
        this.running = true;
        const origQueue = [...this.queue];
        while (this.running) {
            while (this.queue.length > 0) {
                if (!this.running) return;
                const item = this.queue.shift();
                if (item.action === 'type') {
                    for (let i = 0; i < item.text.length; i++) {
                        if (!this.running) return;
                        this.el.textContent += item.text[i];
                        await sleep(this.speed);
                    }
                } else if (item.action === 'wait') {
                    await sleep(item.ms);
                } else if (item.action === 'clear') {
                    const txt = this.el.textContent;
                    for (let i = txt.length; i > 0; i--) {
                        if (!this.running) return;
                        this.el.textContent = txt.substring(0, i - 1);
                        await sleep(25);
                    }
                } else if (item.action === 'loop') {
                    this.queue = [...origQueue];
                }
            }
            if (!this.queue.find(q => q.action === 'loop')) break;
        }
    }
    stop() { this.running = false; }
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }


// ═══════════════════════════════════════════════════════════════
//  THREE.JS SCENE SETUP
// ═══════════════════════════════════════════════════════════════

function initThreeJS() {
    const container = document.getElementById('canvas-container');
    scene = new THREE.Scene();

    const isMobile = window.innerWidth <= 768;
    camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 100);

    // Floating globe starts small on mobile, user can zoom in!
    camera.position.set(0, 0, isMobile ? 8.2 : 4.2);

    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setSize(innerWidth, innerHeight);
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 1);
    container.appendChild(renderer.domElement);

    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.enablePan = false;
    controls.minDistance = 2.0;
    controls.maxDistance = 16.0;
    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.35;

    // Solid Cupertino Lights — Pure White & Gold & Titanium
    scene.add(new THREE.AmbientLight(0x1c1c1e, 0.9));
    const p1 = new THREE.PointLight(0xffffff, 2.2, 16);
    p1.position.set(3, 3, 5); scene.add(p1);
    const p2 = new THREE.PointLight(0xd4af37, 1.8, 16);
    p2.position.set(-3, -2, 4); scene.add(p2);
    const p3 = new THREE.PointLight(0x8e8e93, 1.2, 12);
    p3.position.set(0, -3, 3); scene.add(p3);

    createParticleSphere();

    window.addEventListener('resize', () => {
        camera.aspect = innerWidth / innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(innerWidth, innerHeight);
    });
}


function createParticleSphere() {
    const isMobile = window.innerWidth <= 768;
    const count = isMobile ? 3200 : 4000;
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(count * 3);
    const col = new Float32Array(count * 3);
    const base = new Float32Array(count * 3);

    // Smaller radius on mobile from the start
    const R = isMobile ? 1.05 : 1.6;

    for (let i = 0; i < count; i++) {
        const y = 1 - (i / (count - 1)) * 2;
        const rY = Math.sqrt(1 - y * y);
        const theta = ((1 + Math.sqrt(5)) / 2) * i * Math.PI * 2;
        const x = rY * Math.cos(theta) * R, z = rY * Math.sin(theta) * R, yp = y * R;

        pos[i * 3] = x; pos[i * 3 + 1] = yp; pos[i * 3 + 2] = z;
        base[i * 3] = x; base[i * 3 + 1] = yp; base[i * 3 + 2] = z;

        const t = (y + 1) / 2;
        if (t < 0.5) {
            const s = t * 2;
            // Obsidian to Titanium Silver
            col[i * 3]     = 0.12 * (1 - s) + 0.55 * s;
            col[i * 3 + 1] = 0.12 * (1 - s) + 0.55 * s;
            col[i * 3 + 2] = 0.14 * (1 - s) + 0.58 * s;
        } else {
            const s = (t - 0.5) * 2;
            // Titanium Silver to Warm Gold & Pure White
            col[i * 3]     = 0.55 * (1 - s) + 0.85 * s;
            col[i * 3 + 1] = 0.55 * (1 - s) + 0.72 * s;
            col[i * 3 + 2] = 0.58 * (1 - s) + 0.35 * s;
        }
    }

    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.userData = { basePositions: base };

    particleSphere = new THREE.Points(geo, new THREE.PointsMaterial({
        size: isMobile ? 0.026 : 0.022,
        vertexColors: true,
        transparent: true,
        opacity: 0.9,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        sizeAttenuation: true,
    }));
    scene.add(particleSphere);
}


function updateSphere(time) {
    if (!particleSphere) return;
    const pos = particleSphere.geometry.attributes.position.array;
    const base = particleSphere.geometry.userData.basePositions;
    const col = particleSphere.geometry.attributes.color.array;
    const n = pos.length / 3;

    const tips3D = [];
    for (const hand of handData) {
        for (const tid of TIP) {
            const lm = hand.landmarks[tid];
            if (lm) tips3D.push({ x: (lm.x - 0.5) * 4, y: -(lm.y - 0.5) * 4, z: -lm.z * 2 });
        }
    }

    const hasHands = tips3D.length > 0;
    for (let i = 0; i < n; i++) {
        const bx = base[i * 3], by = base[i * 3 + 1], bz = base[i * 3 + 2];
        const breathe = 1 + Math.sin(time * 0.6 + i * 0.008) * 0.025;
        let tx = bx * breathe, ty = by * breathe, tz = bz * breathe;

        if (hasHands) {
            let fx = 0, fy = 0, fz = 0, totalF = 0;
            for (const tip of tips3D) {
                const dx = tx - tip.x, dy = ty - tip.y, dz = tz - tip.z;
                const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
                if (d < 2.2) {
                    const f = Math.pow(Math.max(0, 1 - d / 2.2), 2) * 0.9;
                    const nm = d || 0.001;
                    fx += (dx / nm) * f; fy += (dy / nm) * f; fz += (dz / nm) * f; totalF += f;
                }
            }
            tx += fx; ty += fy; tz += fz;
            if (totalF > 0.03) {
                const t = Math.min(1, totalF * 3);
                col[i * 3]     += (1 - col[i * 3]) * t * 0.1;
                col[i * 3 + 1] += (1 - col[i * 3 + 1]) * t * 0.1;
                col[i * 3 + 2] += (1 - col[i * 3 + 2]) * t * 0.05;
            }
        } else {
            const ot = (by / 1.6 + 1) / 2;
            col[i * 3]     += (0.55 * (1 - ot) + 0.85 * ot - col[i * 3]) * 0.01;
            col[i * 3 + 1] += (0.55 * (1 - ot) + 0.72 * ot - col[i * 3 + 1]) * 0.01;
            col[i * 3 + 2] += (0.58 * (1 - ot) + 0.35 * ot - col[i * 3 + 2]) * 0.01;
        }

        pos[i * 3]     += (tx - pos[i * 3]) * 0.07;
        pos[i * 3 + 1] += (ty - pos[i * 3 + 1]) * 0.07;
        pos[i * 3 + 2] += (tz - pos[i * 3 + 2]) * 0.07;
    }

    particleSphere.geometry.attributes.position.needsUpdate = true;
    particleSphere.geometry.attributes.color.needsUpdate = true;
    particleSphere.rotation.y += 0.0008;
}


// ── Particle Effects ───────────────────────────────────────────

function spawnTrail(x, y, z, color) {
    const m = new THREE.Mesh(
        new THREE.SphereGeometry(0.016, 6, 6),
        new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.85 })
    );
    m.position.set(x, y, z);
    m.userData = { age: 0, maxAge: 22 };
    scene.add(m);
    trailParticles.push(m);
}

function spawnRipple(x, y, z, color) {
    const m = new THREE.Mesh(
        new THREE.RingGeometry(0.01, 0.04, 32),
        new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 1, side: THREE.DoubleSide })
    );
    m.position.set(x, y, z);
    m.lookAt(camera.position);
    m.userData = { age: 0, maxAge: 35 };
    scene.add(m);
    ripples.push(m);
}

function updateEffects() {
    for (let i = trailParticles.length - 1; i >= 0; i--) {
        const p = trailParticles[i];
        p.userData.age++;
        const pr = p.userData.age / p.userData.maxAge;
        p.material.opacity = Math.max(0, 0.85 * (1 - pr));
        p.scale.setScalar(Math.max(0.1, 1 - pr * 0.7));
        if (p.userData.age >= p.userData.maxAge) {
            scene.remove(p);
            p.geometry.dispose();
            p.material.dispose();
            trailParticles.splice(i, 1);
        }
    }
    for (let i = ripples.length - 1; i >= 0; i--) {
        const r = ripples[i];
        r.userData.age++;
        const pr = r.userData.age / r.userData.maxAge;
        r.scale.setScalar(1 + pr * 3.5);
        r.material.opacity = Math.max(0, 1 - pr);
        if (r.userData.age >= r.userData.maxAge) {
            scene.remove(r);
            r.geometry.dispose();
            r.material.dispose();
            ripples.splice(i, 1);
        }
    }
}


// ═══════════════════════════════════════════════════════════════
//  MEDIAPIPE INTEGRATION
// ═══════════════════════════════════════════════════════════════

function initMediaPipe() {
    if (mpHands) return;
    mpHands = new Hands({
        locateFile: file => `https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4.1675469240/${file}`
    });
    mpHands.setOptions({
        maxNumHands: 2,
        modelComplexity: 1,
        minDetectionConfidence: 0.65,
        minTrackingConfidence: 0.55
    });
    mpHands.onResults(onHandResults);
}


function onHandResults(results) {
    const canvas = document.getElementById('hand-overlay');
    const ctx = canvas.getContext('2d');
    const video = document.getElementById('webcam');

    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 360;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    handData = [];
    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
        const handsEl = document.getElementById('hands-value');
        if (handsEl) handsEl.textContent = results.multiHandLandmarks.length;

        for (let h = 0; h < results.multiHandLandmarks.length; h++) {
            const lm = results.multiHandLandmarks[h];
            const handedness = results.multiHandedness[h];
            const label = handedness ? handedness.label : 'Hand';

            handData.push({ landmarks: lm, label });

            // Crisp Cupertino Skeleton (Zero Red: White + Gold)
            drawHand(ctx, lm, canvas.width, canvas.height, h);

            trailFrameSkip++;
            if (trailFrameSkip % 2 === 0) {
                const tip = lm[8];
                const tc = G.pointing ? G.pointing.color : 0xffffff;
                spawnTrail((tip.x - 0.5) * 4, -(tip.y - 0.5) * 4, -tip.z * 2, tc);
            }

            const gestures = detectGestures(lm, label);
            updateFingerStatus(lm);

            if (gestures.length > 0) {
                showGestureTags(gestures);
                const wrist = lm[0];
                for (const g of gestures) {
                    spawnRipple((wrist.x - 0.5) * 4, -(wrist.y - 0.5) * 4, 0.3, G[g]?.color || 0xd4af37);
                }
            }
        }
    } else {
        const handsEl = document.getElementById('hands-value');
        if (handsEl) handsEl.textContent = '0';
        clearFingerStatus();
    }
}


function drawHand(ctx, lm, w, h, hIdx) {
    // Pure White or Champagne Gold — ZERO RED
    const c = hIdx === 0 ? '#FFFFFF' : '#D4AF37';

    ctx.strokeStyle = c;
    ctx.lineWidth = 1.8;

    for (const [a, b] of CONN) {
        ctx.beginPath();
        ctx.moveTo(lm[a].x * w, lm[a].y * h);
        ctx.lineTo(lm[b].x * w, lm[b].y * h);
        ctx.stroke();
    }

    for (let i = 0; i < lm.length; i++) {
        const isTip = TIP.includes(i);
        ctx.beginPath();
        ctx.arc(lm[i].x * w, lm[i].y * h, isTip ? 4 : 2, 0, Math.PI * 2);
        ctx.fillStyle = isTip ? '#D4AF37' : c;
        ctx.fill();
    }
}


// ═══════════════════════════════════════════════════════════════
//  GESTURE DETECTION ENGINE
// ═══════════════════════════════════════════════════════════════

function isExtended(lm, f) {
    if (f === 0) {
        const ref = lm[5].x;
        return Math.abs(lm[4].x - ref) > Math.abs(lm[3].x - ref);
    }
    return lm[TIP[f]].y < lm[MCP[f]].y;
}

function isFolded(lm, f) {
    if (f === 0) {
        const ref = lm[5].x;
        return Math.abs(lm[4].x - ref) < Math.abs(lm[3].x - ref);
    }
    return lm[TIP[f]].y > lm[PIP[f]].y;
}

function dist(a, b) {
    return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

function getStates(lm) {
    const ext = [], fold = [];
    for (let f = 0; f < 5; f++) {
        ext.push(isExtended(lm, f));
        fold.push(isFolded(lm, f));
    }
    return { ext, fold };
}

let gestureBuffer = {};
const STABILITY_FRAMES = 2;

function stabilize(name, active) {
    if (active) {
        gestureBuffer[name] = (gestureBuffer[name] || 0) + 1;
    } else {
        gestureBuffer[name] = 0;
    }
    return gestureBuffer[name] >= STABILITY_FRAMES;
}

let lastGTime = {};

function detectGestures(lm, hand) {
    const now = Date.now();
    const { ext, fold } = getStates(lm);
    const [thuE, idxE, midE, rngE, pnkE] = ext;
    const [thuF, idxF, midF, rngF, pnkF] = fold;

    const raw = [];
    const palmCenterY = (lm[0].y + lm[5].y + lm[17].y) / 3;
    const isThumbOnly = thuE && idxF && midF && rngF && pnkF;

    if (isThumbOnly && lm[4].y < palmCenterY - 0.03) raw.push('thumbs_up');
    if (isThumbOnly && lm[4].y > palmCenterY + 0.03) raw.push('thumbs_down');
    if (midE && idxF && rngF && pnkF) raw.push('middle_finger');
    if (idxE && pnkE && midF && rngF) raw.push('rock');
    if (thuE && pnkE && idxF && midF && rngF) raw.push('call_me');
    if (thuE && idxE && pnkE && midF && rngF) raw.push('spiderman');
    if (dist(lm[4], lm[8]) < 0.055 && midE && rngE && pnkE) raw.push('ok');
    if (dist(lm[4], lm[8]) < 0.06 && !midE && !rngE && !pnkE) raw.push('pinch');
    if (idxE && midE && rngF && pnkF && !midE !== true) {
        if (Math.abs(lm[8].x - lm[12].x) > 0.02) raw.push('peace');
    }
    if (idxE && midE && rngE && pnkF) raw.push('three');
    if (idxE && midF && rngF && pnkF) raw.push('pointing');
    if (ext.filter(Boolean).length >= 4) raw.push('open_palm');
    if (fold.filter(Boolean).length >= 4 && !idxE && !midE) raw.push('fist');

    const detected = [];
    for (const g of Object.keys(G)) {
        if (stabilize(g, raw.includes(g))) {
            detected.push(g);
        }
    }

    for (const g of detected) {
        const key = `${hand}_${g}`;
        if (!lastGTime[key] || now - lastGTime[key] > 1200) {
            lastGTime[key] = now;
            const info = G[g];
            if (info) {
                flashGesture(info.label);
                addEventLog(`${hand} > ${info.label}`);
            }
        }
    }

    return detected;
}


// ── UI Updates ─────────────────────────────────────────────────

function showGestureTags(gestures) {
    const el = document.getElementById('gesture-display');
    if (el) {
        el.innerHTML = '';
        for (const g of gestures) {
            const info = G[g];
            if (!info) continue;
            const tag = document.createElement('div');
            tag.className = 'gesture-tag';
            tag.textContent = info.label;
            el.appendChild(tag);
        }
    }

    // Update Mobile Cupertino Dock Pill
    const mobileLabel = document.getElementById('mobile-gesture-label');
    if (mobileLabel) {
        if (gestures.length > 0 && G[gestures[0]]) {
            mobileLabel.textContent = G[gestures[0]].label;
        } else {
            mobileLabel.textContent = 'Tracking';
        }
    }
}

function updateFingerStatus(lm) {
    for (let f = 0; f < 5; f++) {
        const el = document.getElementById(`f-${FNAMES[f]}`);
        if (!el) continue;
        const up = isExtended(lm, f);
        el.textContent = `${FLABELS[f]} ${up ? 'UP' : '\u2014'}`;
        el.className = `finger ${up ? 'extended' : ''}`;
    }
}

function clearFingerStatus() {
    for (let f = 0; f < 5; f++) {
        const el = document.getElementById(`f-${FNAMES[f]}`);
        if (el) {
            el.textContent = `${FLABELS[f]} \u2014`;
            el.className = 'finger';
        }
    }
    const gDisplay = document.getElementById('gesture-display');
    if (gDisplay) {
        gDisplay.innerHTML = '<span class="gesture-placeholder">No hands in frame</span>';
    }
    const mobileLabel = document.getElementById('mobile-gesture-label');
    if (mobileLabel) {
        mobileLabel.textContent = 'No Hand';
    }
}


// ── Camera Controls ────────────────────────────────────────────

async function startCamera() {
    const video = document.getElementById('webcam');
    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            video: { width: 640, height: 360, facingMode: 'user' }
        });
        video.srcObject = stream;
        await video.play();

        initMediaPipe();
        mpCamera = new Camera(video, {
            onFrame: async () => { await mpHands.send({ image: video }); },
            width: 640, height: 360,
        });
        mpCamera.start();
        cameraRunning = true;

        const ind = document.getElementById('connection-indicator');
        if (ind) {
            ind.classList.remove('disconnected');
            ind.classList.add('connected');
        }
        const connText = document.getElementById('connection-text');
        if (connText) connText.textContent = 'Active';

        const btnStart = document.getElementById('btn-start');
        if (btnStart) {
            btnStart.textContent = 'Running';
            btnStart.disabled = true;
        }

        // Hide camera off placeholder
        const offState = document.getElementById('camera-off-state');
        if (offState) offState.classList.add('hidden');

        // Update mobile dock button
        const mBtn = document.getElementById('mobile-btn-camera');
        const mTxt = document.getElementById('mobile-cam-text');
        if (mBtn && mTxt) {
            mBtn.classList.add('active');
            mTxt.textContent = 'Stop';
        }

        addEventLog('Camera started');
    } catch (err) {
        console.error('Camera error:', err);
        addEventLog('Camera access denied');
    }
}

function stopCamera() {
    if (mpCamera) { mpCamera.stop(); mpCamera = null; }
    cameraRunning = false;
    const v = document.getElementById('webcam');
    if (v && v.srcObject) {
        v.srcObject.getTracks().forEach(t => t.stop());
        v.srcObject = null;
    }
    handData = [];

    // Show camera off placeholder
    const offState = document.getElementById('camera-off-state');
    if (offState) offState.classList.remove('hidden');

    const ind = document.getElementById('connection-indicator');
    if (ind) {
        ind.classList.remove('connected');
        ind.classList.add('disconnected');
    }
    const connText = document.getElementById('connection-text');
    if (connText) connText.textContent = 'Offline';

    const btnStart = document.getElementById('btn-start');
    if (btnStart) {
        btnStart.textContent = 'Start Camera';
        btnStart.disabled = false;
    }

    // Update mobile dock button
    const mBtn = document.getElementById('mobile-btn-camera');
    const mTxt = document.getElementById('mobile-cam-text');
    if (mBtn && mTxt) {
        mBtn.classList.remove('active');
        mTxt.textContent = 'Start';
    }

    clearFingerStatus();
    addEventLog('Camera stopped');
}

function toggleCameraMobile() {
    if (cameraRunning) {
        stopCamera();
    } else {
        startCamera();
    }
}

function toggleCameraSize() {
    const panel = document.getElementById('camera-panel');
    if (panel) panel.classList.toggle('expanded');
}

function flashGesture(text) {
    const el = document.getElementById('gesture-flash');
    if (!el) return;
    el.textContent = text;
    el.classList.remove('hidden');
    el.classList.add('visible');
    if (gestureFlashTimer) clearTimeout(gestureFlashTimer);
    gestureFlashTimer = setTimeout(() => {
        el.classList.remove('visible');
        el.classList.add('hidden');
    }, 600);
}

function addEventLog(msg) {
    const t = new Date().toLocaleTimeString('en-US', { hour12: false });
    eventLog.unshift({ time: t, message: msg });
    if (eventLog.length > 30) eventLog.pop();
    const logEl = document.getElementById('event-log');
    if (logEl) {
        logEl.innerHTML = eventLog.slice(0, 10).map(e =>
            `<div class="event-entry"><span class="time">${e.time}</span> <span class="ev">${e.message}</span></div>`
        ).join('');
    }
}


// ═══════════════════════════════════════════════════════════════
//  CREATOR PROFILE MODAL (Biswadeep Tewari)
// ═══════════════════════════════════════════════════════════════

function openCreatorModal() {
    const modal = document.getElementById('creator-modal');
    if (modal) {
        modal.classList.remove('hidden');
        document.body.style.overflow = 'hidden';
    }
}

function closeCreatorModal() {
    const modal = document.getElementById('creator-modal');
    if (modal) {
        modal.classList.add('hidden');
        document.body.style.overflow = '';
    }
}

function handleModalBackdrop(event) {
    if (event.target.id === 'creator-modal') {
        closeCreatorModal();
    }
}

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeCreatorModal();
});


// ── Render Loop — Live Continuous 60/120 FPS Motion ───────────

function animate(time) {
    requestAnimationFrame(animate);

    // Live continuous FPS calculation driven by actual 3D render loop
    animFrames++;
    const now = performance.now();
    if (now - lastAnimTime >= 500) {
        currentFps = Math.round((animFrames * 1000) / (now - lastAnimTime));
        animFrames = 0;
        lastAnimTime = now;
        const fpsEl = document.getElementById('fps-value');
        if (fpsEl) fpsEl.textContent = currentFps;
    }

    updateSphere(time * 0.001);
    updateEffects();
    if (controls) controls.update();
    if (renderer && scene && camera) renderer.render(scene, camera);
}


// ── Boot Initializer ───────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
    initThreeJS();
    animate(0);

    const twEl = document.getElementById('typewriter-text');
    if (twEl) {
        const logoTW = new Typewriter(twEl, { speed: 70 });
        logoTW
            .type('Air Gesture Engine')
            .wait(3000)
            .clear()
            .type('Spatial Vision 3D')
            .wait(2500)
            .clear()
            .type('Real-Time MediaPipe')
            .wait(2500)
            .clear()
            .type('Zero-Latency Tracking')
            .wait(2500)
            .clear()
            .loop()
            .start();
    }

    addEventLog('MotionW initialized');

    // ── Brand Typewriter Cycle: Motion W (Pacifico) <-> Made by alypion (Normal Text) ──
    const brandEl = document.getElementById('brand-title');
    if (brandEl) {
        async function runBrandCycle() {
            while (true) {
                // Hold Motion W for 60 seconds (every minute)
                await sleep(60000);

                // Typewriter backspace / erase "Motion W"
                while (brandEl.textContent.length > 0) {
                    brandEl.textContent = brandEl.textContent.slice(0, -1);
                    await sleep(40);
                }
                await sleep(250);

                // Switch to normal text font for author
                brandEl.classList.add('author-mode');

                // Type "Made by alypion" in clean normal text
                const authorText = "Made by alypion";
                for (let i = 0; i < authorText.length; i++) {
                    brandEl.textContent += authorText[i];
                    await sleep(55);
                }

                // Hold "Made by alypion" so it is clearly readable
                await sleep(4500);

                // Typewriter backspace / erase "Made by alypion"
                while (brandEl.textContent.length > 0) {
                    brandEl.textContent = brandEl.textContent.slice(0, -1);
                    await sleep(35);
                }
                await sleep(250);

                // Switch back to Pacifico font for Motion W
                brandEl.classList.remove('author-mode');

                // Type back "Motion W" in Pacifico
                const brandText = "Motion W";
                for (let i = 0; i < brandText.length; i++) {
                    brandEl.textContent += brandText[i];
                    await sleep(60);
                }
            }
        }
        runBrandCycle();
    }

    // ── Draggable Camera PiP (Mobile Touch + Desktop Drag) ──
    const panel = document.getElementById('camera-panel');
    if (panel) {
        let isDragging = false;
        let startX = 0, startY = 0, origLeft = 0, origTop = 0;

        function startDrag(clientX, clientY) {
            isDragging = true;
            const rect = panel.getBoundingClientRect();
            startX = clientX;
            startY = clientY;
            origLeft = rect.left;
            origTop = rect.top;
            panel.style.transition = 'none';
            panel.style.cursor = 'grabbing';
        }

        function moveDrag(clientX, clientY) {
            if (!isDragging) return;
            const dx = clientX - startX;
            const dy = clientY - startY;

            let newLeft = origLeft + dx;
            let newTop = origTop + dy;

            const pw = panel.offsetWidth || 176;
            const ph = panel.offsetHeight || 99;
            const maxW = window.innerWidth - pw - 8;
            const maxH = window.innerHeight - ph - 16;

            newLeft = Math.max(8, Math.min(maxW, newLeft));
            newTop = Math.max(10, Math.min(maxH, newTop));

            panel.style.setProperty('left', newLeft + 'px', 'important');
            panel.style.setProperty('top', newTop + 'px', 'important');
            panel.style.setProperty('right', 'auto', 'important');
            panel.style.setProperty('bottom', 'auto', 'important');
        }

        function endDrag() {
            if (!isDragging) return;
            isDragging = false;
            panel.style.cursor = 'grab';
            panel.style.transition = 'width 0.35s cubic-bezier(0.16, 1, 0.3, 1)';
        }

        // Touch event handlers for mobile
        panel.addEventListener('touchstart', function(e) {
            if (e.target.closest('button, a')) return;
            const t = e.touches[0];
            startDrag(t.clientX, t.clientY);
        }, { passive: true });

        window.addEventListener('touchmove', function(e) {
            if (!isDragging) return;
            if (e.cancelable) e.preventDefault();
            const t = e.touches[0];
            moveDrag(t.clientX, t.clientY);
        }, { passive: false });

        window.addEventListener('touchend', endDrag);
        window.addEventListener('touchcancel', endDrag);

        // Mouse event handlers for desktop
        panel.addEventListener('mousedown', function(e) {
            if (e.target.closest('button, a')) return;
            startDrag(e.clientX, e.clientY);
            e.preventDefault();
        });

        window.addEventListener('mousemove', function(e) {
            if (!isDragging) return;
            e.preventDefault();
            moveDrag(e.clientX, e.clientY);
        });

        window.addEventListener('mouseup', endDrag);
    }
});
