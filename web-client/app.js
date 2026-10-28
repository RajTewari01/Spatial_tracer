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
    [0, 1], [1, 2], [2, 3], [3, 4],
    [0, 5], [5, 6], [6, 7], [7, 8],
    [0, 9], [9, 10], [10, 11], [11, 12],
    [0, 13], [13, 14], [14, 15], [15, 16],
    [0, 17], [17, 18], [18, 19], [19, 20],
    [5, 9], [9, 13], [13, 17],
];

const TIP = [4, 8, 12, 16, 20];
const DIP = [3, 7, 11, 15, 19];
const PIP = [3, 6, 10, 14, 18];
const MCP = [2, 5, 9, 13, 17];

const FNAMES = ['thumb', 'index', 'middle', 'ring', 'pinky'];
const FLABELS = ['THM', 'IDX', 'MID', 'RNG', 'PNK'];

// ── Gesture Catalog — ZERO RED (Cupertino Gold, White, Titanium, Silver) ──
const G = {
    thumbs_up: { label: 'THUMBS UP', color: 0xd4af37 },
    thumbs_down: { label: 'THUMBS DOWN', color: 0x8e8e93 },
    peace: { label: 'PEACE', color: 0xffffff },
    middle_finger: { label: 'MIDDLE FINGER', color: 0x636366 },
    rock: { label: 'ROCK', color: 0xd4af37 },
    ok: { label: 'OK SIGN', color: 0xffffff },
    pinch: { label: 'PINCH', color: 0xc5a059 },
    open_palm: { label: 'OPEN PALM', color: 0xd4af37 },
    fist: { label: 'FIST', color: 0x8e8e93 },
    pointing: { label: 'POINTING', color: 0xffffff },
    call_me: { label: 'CALL ME', color: 0xd4af37 },
    three: { label: 'THREE', color: 0xc5a059 },
    spiderman: { label: 'SPIDERMAN', color: 0xffffff },
};

const GESTURE_SVGS = {
    no_hand: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="2" y1="2" x2="22" y2="22"></line><path d="M18 11V6a2 2 0 0 0-2-2 2 2 0 0 0-2 2v2"></path><path d="M14 10V4a2 2 0 0 0-2-2 2 2 0 0 0-2 2v6"></path><path d="M10 10.5V6a2 2 0 0 0-2-2 2 2 0 0 0-2 2v8"></path><path d="M6 14.5v3.5a6 6 0 0 0 6 6h1a6 6 0 0 0 5.4-3.4"></path></svg>`,
    fist: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 10a2 2 0 0 0-2-2h-1a2 2 0 0 0-2-2h-1a2 2 0 0 0-2-2H9a2 2 0 0 0-2 2v8a5 5 0 0 0 5 5h3a5 5 0 0 0 5-5v-4z"></path><path d="M7 8h10"></path><path d="M7 11h10"></path></svg>`,
    open_palm: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 11V6a2 2 0 0 0-4 0v2"></path><path d="M14 8V4a2 2 0 0 0-4 0v6"></path><path d="M10 10V6a2 2 0 0 0-4 0v8"></path><path d="M6 14v1a6 6 0 0 0 6 6h2a6 6 0 0 0 6-6V9a2 2 0 0 0-4 0"></path></svg>`,
    thumbs_up: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"></path></svg>`,
    thumbs_down: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3zm7-13h3a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-3"></path></svg>`,
    peace: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 12V4a2 2 0 0 1 3.5 0v8"></path><path d="M12.5 12V3a2 2 0 0 1 3.5 0v9"></path><path d="M8 12a4 4 0 0 0-4 4v2a4 4 0 0 0 4 4h6a4 4 0 0 0 4-4v-6"></path></svg>`,
    pointing: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v9"></path><path d="M12 12a4 4 0 0 0-4 4v2a4 4 0 0 0 4 4h6a4 4 0 0 0 4-4v-6a2 2 0 0 0-4 0"></path><circle cx="12" cy="3" r="1.5"></circle></svg>`,
    rock: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 12V4a2 2 0 0 1 4 0v8"></path><path d="M17 12V4a2 2 0 0 1 4 0v10a6 6 0 0 1-6 6H9a6 6 0 0 1-6-6v-2"></path><path d="M11 12h6"></path></svg>`,
    ok: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="9" r="4"></circle><path d="M13 9V3a2 2 0 0 1 4 0v8"></path><path d="M17 11V5a2 2 0 0 1 4 0v9a6 6 0 0 1-6 6h-4a6 6 0 0 1-6-6"></path></svg>`,
    pinch: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 8a3 3 0 0 1 5 2l-2 2"></path><path d="M11 12l2-2a3 3 0 0 1 4 4l-4 4"></path><path d="M7 14a5 5 0 0 0 5 5h4a5 5 0 0 0 5-5"></path></svg>`,
    call_me: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8l3-3a2 2 0 0 1 2.8 0L11 6a2 2 0 0 1 0 2.8L10 10a12 12 0 0 0 4 4l1.2-1a2 2 0 0 1 2.8 0l1.2 1.2a2 2 0 0 1 0 2.8l-3 3a4 4 0 0 1-4.2.8A16 16 0 0 1 3.2 8.2 4 4 0 0 1 4 8z"></path></svg>`,
    three: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 12V4a2 2 0 0 1 4 0v8"></path><path d="M12 12V3a2 2 0 0 1 4 0v9"></path><path d="M16 12V4a2 2 0 0 1 4 0v10a6 6 0 0 1-6 6H8a6 6 0 0 1-6-6"></path></svg>`,
    spiderman: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 12V4a2 2 0 0 1 4 0v8"></path><path d="M18 12V4a2 2 0 0 1 4 0v10a6 6 0 0 1-6 6H8a6 6 0 0 1-6-6"></path><path d="M10 12h4"></path></svg>`,
    middle_finger: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v9"></path><path d="M8 12a4 4 0 0 0-4 4v2a4 4 0 0 0 4 4h6a4 4 0 0 0 4-4v-4"></path></svg>`,
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


// ── Multi-Stop 3D Globe Particle Sphere Gradient ───────────────
// Progression: White -> Light Red -> Vivid Ruby -> Deep Blood Red -> Garnet -> Light Coral Glow
function getGlobeColor(normY) {
    const t = Math.max(0, Math.min(1, (normY + 1) / 2));
    const stops = [
        [0.00, 1.00, 0.45, 0.50], // Luminous light coral/ember glow at bottom pole
        [0.15, 0.72, 0.04, 0.12], // Rich garnet crimson
        [0.35, 0.42, 0.01, 0.05], // Deep luxurious blood red
        [0.58, 0.96, 0.08, 0.20], // Vivid radiant ruby crimson
        [0.82, 1.00, 0.48, 0.56], // Delicate luminous light red / rose
        [1.00, 1.00, 1.00, 1.00]  // Pure brilliant white at top pole
    ];
    for (let s = 0; s < stops.length - 1; s++) {
        const s0 = stops[s];
        const s1 = stops[s + 1];
        if (t >= s0[0] && t <= s1[0]) {
            const f = (t - s0[0]) / (s1[0] - s0[0]);
            return [
                s0[1] + (s1[1] - s0[1]) * f,
                s0[2] + (s1[2] - s0[2]) * f,
                s0[3] + (s1[3] - s0[3]) * f
            ];
        }
    }
    return [1.0, 1.0, 1.0];
}

function createParticleSphere() {
    const isMobile = window.innerWidth <= 768;
    const count = isMobile ? 3200 : 4000;
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(count * 3);
    const col = new Float32Array(count * 3);
    const base = new Float32Array(count * 3);
    const baseCol = new Float32Array(count * 3);

    // Smaller radius on mobile from the start
    const R = isMobile ? 1.05 : 1.6;

    for (let i = 0; i < count; i++) {
        const y = 1 - (i / (count - 1)) * 2;
        const rY = Math.sqrt(1 - y * y);
        const theta = ((1 + Math.sqrt(5)) / 2) * i * Math.PI * 2;
        const x = rY * Math.cos(theta) * R, z = rY * Math.sin(theta) * R, yp = y * R;

        pos[i * 3] = x; pos[i * 3 + 1] = yp; pos[i * 3 + 2] = z;
        base[i * 3] = x; base[i * 3 + 1] = yp; base[i * 3 + 2] = z;

        // Rich Multi-stop gradient: White -> Light Red -> Ruby -> Deep Blood Red -> Garnet -> Light Coral Glow
        const [cr, cg, cb] = getGlobeColor(y);
        col[i * 3] = cr;
        col[i * 3 + 1] = cg;
        col[i * 3 + 2] = cb;

        baseCol[i * 3] = cr;
        baseCol[i * 3 + 1] = cg;
        baseCol[i * 3 + 2] = cb;
    }

    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.userData = { basePositions: base, baseColors: baseCol };

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
    const baseCol = particleSphere.geometry.userData.baseColors;
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
                // Luminous flare on hand interaction
                col[i * 3] += (1.0 - col[i * 3]) * t * 0.15;
                col[i * 3 + 1] += (0.95 - col[i * 3 + 1]) * t * 0.1;
                col[i * 3 + 2] += (0.95 - col[i * 3 + 2]) * t * 0.1;
            }
        } else if (baseCol) {
            // Restore back to original rich multi-stop gradient
            const targetR = baseCol[i * 3];
            const targetG = baseCol[i * 3 + 1];
            const targetB = baseCol[i * 3 + 2];
            col[i * 3] += (targetR - col[i * 3]) * 0.02;
            col[i * 3 + 1] += (targetG - col[i * 3 + 1]) * 0.02;
            col[i * 3 + 2] += (targetB - col[i * 3 + 2]) * 0.02;
        }

        pos[i * 3] += (tx - pos[i * 3]) * 0.07;
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

    // Update Mobile Cupertino Dock Pill (Icon + Label)
    const mobileIcon = document.getElementById('mobile-gesture-icon');
    const mobileLabel = document.getElementById('mobile-gesture-label');
    if (mobileLabel) {
        if (gestures.length > 0 && G[gestures[0]]) {
            const gKey = gestures[0];
            mobileLabel.textContent = G[gKey].label;
            if (mobileIcon) {
                mobileIcon.innerHTML = GESTURE_SVGS[gKey] || GESTURE_SVGS.open_palm;
            }
        } else {
            mobileLabel.textContent = 'Tracking';
            if (mobileIcon) {
                mobileIcon.innerHTML = GESTURE_SVGS.open_palm;
            }
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
    const mobileIcon = document.getElementById('mobile-gesture-icon');
    const mobileLabel = document.getElementById('mobile-gesture-label');
    if (mobileLabel) {
        mobileLabel.textContent = 'No Hand';
    }
    if (mobileIcon) {
        mobileIcon.innerHTML = GESTURE_SVGS.no_hand;
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

        // Show PiP and navbar FPS badge when camera is open
        const camPanel = document.getElementById('camera-panel');
        if (camPanel) camPanel.classList.add('active');
        const fpsPill = document.getElementById('navbar-fps-pill') || document.getElementById('floating-fps-pill');
        if (fpsPill) fpsPill.classList.add('active');
        const fpsVal = document.getElementById('fps-value');
        if (fpsVal) fpsVal.textContent = '0';

        // Update mobile dock: morph from single Start pill into Stop + Posture pill
        const mobileDock = document.getElementById('mobile-dock');
        if (mobileDock) mobileDock.classList.add('camera-active');

        // Update mobile dock button icon and text (Switch to Stop)
        const mBtn = document.getElementById('mobile-btn-camera');
        if (mBtn) {
            mBtn.classList.add('active');
            mBtn.innerHTML = `
                <svg id="mobile-cam-icon" width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <rect x="5" y="5" width="14" height="14" rx="2"></rect>
                </svg>
                <span id="mobile-cam-text">Stop</span>
            `;
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

    // Hide PiP and navbar FPS badge when camera is closed
    const camPanel = document.getElementById('camera-panel');
    if (camPanel) camPanel.classList.remove('active');
    const fpsPill = document.getElementById('navbar-fps-pill') || document.getElementById('floating-fps-pill');
    if (fpsPill) fpsPill.classList.remove('active');
    const fpsVal = document.getElementById('fps-value');
    if (fpsVal) fpsVal.textContent = '0';

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

    // Update mobile dock: morph back into single centered Start pill
    const mobileDock = document.getElementById('mobile-dock');
    if (mobileDock) mobileDock.classList.remove('camera-active');

    // Update mobile dock button icon and text (Switch to Start)
    const mBtn = document.getElementById('mobile-btn-camera');
    if (mBtn) {
        mBtn.classList.remove('active');
        mBtn.innerHTML = `
            <svg id="mobile-cam-icon" width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <polygon points="6 4 20 12 6 20 6 4"></polygon>
            </svg>
            <span id="mobile-cam-text">Start</span>
        `;
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
    const formatted = String(text || '').toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
    el.textContent = formatted;
    el.classList.remove('hidden');
    el.classList.add('visible');
    if (gestureFlashTimer) clearTimeout(gestureFlashTimer);
    gestureFlashTimer = setTimeout(() => {
        el.classList.remove('visible');
        el.classList.add('hidden');
    }, 750);
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
//  CREATOR PROFILE MODAL & LIVING ZEN PHYSICS (Biswadeep Tewari)
// ═══════════════════════════════════════════════════════════════

let zenPhysicsAnimId = null;
const ZEN_PARTICLE_COUNT = 42;
const zenParticles = [];

// Precomputed pseudo-random harmonic particles matching mobile_client_v2
(function initZenParticles() {
    for (let i = 0; i < ZEN_PARTICLE_COUNT; i++) {
        const s1 = Math.sin(i * 997 + 13) * 10000;
        const s2 = Math.sin(i * 389 + 71) * 10000;
        const r1 = s1 - Math.floor(s1);
        const r2 = s2 - Math.floor(s2);
        const r3 = ((s1 + s2) * 5) - Math.floor((s1 + s2) * 5);

        zenParticles.push({
            xSeed: r1,
            ySeed: r2,
            speed: 0.025 + r3 * 0.045,
            amplitude: 15.0 + r1 * 25.0,
            frequency: 1.0 + r2 * 2.5,
            radius: 1.4 + r3 * 2.0,
            phase: r1 * 2 * Math.PI,
            maxOpacity: 0.35 + r2 * 0.45
        });
    }
})();

function renderZenPhysics(timestamp) {
    const canvas = document.getElementById('zen-physics-canvas');
    const modal = document.querySelector('.portfolio-modal.zen-container');
    if (!canvas || !modal || document.getElementById('creator-modal').classList.contains('hidden')) {
        return;
    }

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = modal.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;

    if (canvas.width !== Math.floor(width * dpr) || canvas.height !== Math.floor(height * dpr)) {
        canvas.width = Math.floor(width * dpr);
        canvas.height = Math.floor(height * dpr);
    }

    const ctx = canvas.getContext('2d');
    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, width, height);

    // Continuous 30-second repeating cycle (matches Flutter AnimationController duration: 30s)
    const time = (timestamp % 30000) / 30000.0;

    // 1. Living Floating Zen Golden Particles / Fireflies
    for (const p of zenParticles) {
        const pTime = (time + p.phase) % 1.0;
        let y = ((p.ySeed - (pTime * p.speed * 4.0)) % 1.0) * height;
        if (y < 0) y += height;

        let x = ((p.xSeed * width) + Math.sin(pTime * 2 * Math.PI * p.frequency + p.phase) * p.amplitude) % width;
        if (x < 0) x += width;

        const alpha = (Math.abs(Math.sin(pTime * 2 * Math.PI)) * 0.7 + 0.3) * p.maxOpacity;

        // Radiant golden aura
        const glowRadius = p.radius * 3.2;
        const grad = ctx.createRadialGradient(x, y, 0, x, y, glowRadius);
        grad.addColorStop(0, `rgba(255, 238, 160, ${alpha * 0.9})`);
        grad.addColorStop(0.45, `rgba(212, 175, 55, ${alpha * 0.45})`);
        grad.addColorStop(1, 'rgba(212, 175, 55, 0)');

        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(x, y, glowRadius, 0, Math.PI * 2);
        ctx.fill();

        // Core light seed
        ctx.fillStyle = `rgba(255, 255, 230, ${alpha * 0.95})`;
        ctx.beginPath();
        ctx.arc(x, y, p.radius, 0, Math.PI * 2);
        ctx.fill();
    }

    // 2. Flying Zen Birds Kinematics Flock (High-frequency wing flap & sinusoidal traversal)
    const flap = Math.sin(time * 2 * Math.PI * 14.0);
    const flightX = (time * width * 1.35) % (width + 160) - 80;
    const flightY = height * 0.15 + Math.sin(time * 2 * Math.PI * 1.5) * 16.0;

    function drawZenBird(bx, by, scale) {
        const wingH = 5.5 * scale;
        const wingY = by - wingH + (flap * 4.5 * scale);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.42)';
        ctx.lineWidth = 1.35 * scale;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(bx - (10 * scale), wingY);
        ctx.quadraticCurveTo(bx - (5 * scale), by + (2 * scale), bx, by);
        ctx.quadraticCurveTo(bx + (5 * scale), by + (2 * scale), bx + (10 * scale), wingY);
        ctx.stroke();
    }

    // V-formation flock
    drawZenBird(flightX, flightY, 1.05);
    drawZenBird(flightX - 22, flightY + 12, 0.88);
    drawZenBird(flightX - 42, flightY + 24, 0.72);
    drawZenBird(flightX + 20, flightY + 11, 0.92);
    drawZenBird(flightX + 38, flightY + 22, 0.78);

    ctx.restore();
    zenPhysicsAnimId = requestAnimationFrame(renderZenPhysics);
}

function startZenPhysics() {
    if (!zenPhysicsAnimId) {
        zenPhysicsAnimId = requestAnimationFrame(renderZenPhysics);
    }
}

function stopZenPhysics() {
    if (zenPhysicsAnimId) {
        cancelAnimationFrame(zenPhysicsAnimId);
        zenPhysicsAnimId = null;
    }
}

// ═══════════════════════════════════════════════════════════════
//  SETTINGS & CREATOR MODAL NAVIGATION
// ═══════════════════════════════════════════════════════════════

function openSettingsModal() {
    const modal = document.getElementById('settings-modal');
    if (modal) {
        modal.classList.remove('hidden');
        document.body.style.overflow = 'hidden';
    }
}

function closeSettingsModal() {
    const modal = document.getElementById('settings-modal');
    if (modal) {
        modal.classList.add('hidden');
        document.body.style.overflow = '';
    }
}

function handleSettingsBackdrop(event) {
    if (event.target.id === 'settings-modal') {
        closeSettingsModal();
    }
}

function openCreatorFromSettings() {
    closeSettingsModal();
    openCreatorModal();
}

function backToSettings() {
    closeCreatorModal();
    openSettingsModal();
}

function triggerApkDownload(event) {
    const downloadUrl = './assets/binaries/MotionW.apk';
    if (window.flutter_inappwebview || window.Android) {
        window.location.href = downloadUrl;
    }
}

// ═══════════════════════════════════════════════════════════════
//  PAGE SPOTLIGHT READING ANIMATION (Creator Info)
//  "The white moves by itself as we scroll down" — Lag-Free 60/120fps
// ═══════════════════════════════════════════════════════════════

let pageSpotlightTimer = null;
let isProgrammaticScroll = false;
let scrollTicking = false;
let currentSpotlightPortion = null;

function onCreatorScroll() {
    if (isProgrammaticScroll) return;
    if (!scrollTicking) {
        requestAnimationFrame(() => {
            updateSpotlightOnScroll();
            scrollTicking = false;
        });
        scrollTicking = true;
    }
}

// Automatically shifts the white illuminated highlight to the card in current reading focus
// Uses zero-layout-thrashing offset checks and early exit to ensure 60/120fps butter-smooth scroll
function updateSpotlightOnScroll() {
    const modal = document.getElementById('creator-modal');
    if (!modal || modal.classList.contains('hidden')) return;
    const scrollBody = modal.querySelector('.zen-scroll-body');
    if (!scrollBody) return;

    const scrollTop = scrollBody.scrollTop;

    // Fast parallax kanji transform update (in same animation frame)
    const kanjiRight = modal.querySelector('.zen-kanji-right');
    const kanjiLeft = modal.querySelector('.zen-kanji-left');
    if (kanjiRight) kanjiRight.style.transform = `translateY(${scrollTop * -0.22}px)`;
    if (kanjiLeft) kanjiLeft.style.transform = `translateY(${scrollTop * -0.38}px)`;

    // Trackable portions in visual reading order
    const portionIds = ['dialogue', 'math', 'cv', 'satori', 'socials'];
    const focalY = scrollTop + (scrollBody.clientHeight * 0.38);

    let bestPortion = null;
    let minDistance = Infinity;

    for (const id of portionIds) {
        const el = document.getElementById('portion-' + id);
        if (!el) continue;
        const centerY = el.offsetTop + (el.offsetHeight * 0.5);
        const dist = Math.abs(centerY - focalY);
        if (dist < minDistance) {
            minDistance = dist;
            bestPortion = id;
        }
    }

    if (bestPortion && bestPortion !== currentSpotlightPortion) {
        applySpotlightSilent(bestPortion);
    }
}

function applySpotlightSilent(portionId) {
    if (currentSpotlightPortion === portionId) return; // Exit immediately if already active!
    currentSpotlightPortion = portionId;

    const modal = document.getElementById('creator-modal');
    if (!modal) return;
    const scrollBody = modal.querySelector('.zen-scroll-body');
    if (!scrollBody) return;

    scrollBody.classList.add('spotlight-mode');

    const portions = modal.querySelectorAll('.page-portion');
    const pills = modal.querySelectorAll('.page-nav-pill');

    portions.forEach(p => {
        if (p.id === 'portion-' + portionId) {
            p.classList.add('portion-highlighted');
        } else {
            p.classList.remove('portion-highlighted');
        }
    });

    pills.forEach(p => {
        if (p.id === 'pill-' + portionId) {
            p.classList.add('active');
        } else {
            p.classList.remove('active');
        }
    });
}

function highlightPortion(portionId, scrollIntoView = true) {
    const modal = document.getElementById('creator-modal');
    if (!modal) return;
    const scrollBody = modal.querySelector('.zen-scroll-body');
    if (!scrollBody) return;

    if (portionId === 'all') {
        currentSpotlightPortion = 'all';
        scrollBody.classList.remove('spotlight-mode');
        modal.querySelectorAll('.page-portion').forEach(p => p.classList.remove('portion-highlighted'));
        modal.querySelectorAll('.page-nav-pill').forEach(p => p.classList.remove('active'));
        const pillAll = document.getElementById('pill-all');
        if (pillAll) pillAll.classList.add('active');
        return;
    }

    applySpotlightSilent(portionId);

    if (scrollIntoView) {
        const target = document.getElementById('portion-' + portionId);
        if (target) {
            isProgrammaticScroll = true;
            target.scrollIntoView({ behavior: 'smooth', block: 'center' });
            setTimeout(() => { isProgrammaticScroll = false; }, 450);
        }
    }
}

function openCreatorModal() {
    const modal = document.getElementById('creator-modal');
    if (modal) {
        modal.classList.remove('hidden');
        document.body.style.overflow = 'hidden';
        startZenPhysics();

        const scrollBody = modal.querySelector('.zen-scroll-body');
        if (scrollBody) {
            // Step 1: Whole page is shown first in its entirety (overview mode)
            currentSpotlightPortion = null;
            scrollBody.classList.remove('spotlight-mode');
            modal.querySelectorAll('.page-portion').forEach(p => p.classList.remove('portion-highlighted'));
            modal.querySelectorAll('.page-nav-pill').forEach(p => p.classList.remove('active'));
            const pillAll = document.getElementById('pill-all');
            if (pillAll) pillAll.classList.add('active');

            // Step 2: Like reading a book, spotlight first portion after initial display
            clearTimeout(pageSpotlightTimer);
            pageSpotlightTimer = setTimeout(() => {
                applySpotlightSilent('dialogue');
            }, 600);

            // Single high-efficiency scroll listener
            if (!scrollBody._hasCreatorScrollListener) {
                scrollBody._hasCreatorScrollListener = true;
                scrollBody.addEventListener('scroll', onCreatorScroll, { passive: true });
            }
        }
    }
}

function closeCreatorModal() {
    clearTimeout(pageSpotlightTimer);
    const modal = document.getElementById('creator-modal');
    if (modal) {
        modal.classList.add('hidden');
        document.body.style.overflow = '';
        stopZenPhysics();
    }
}

function handleModalBackdrop(event) {
    if (event.target.id === 'creator-modal') {
        closeCreatorModal();
    }
}

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        closeSettingsModal();
        closeCreatorModal();
    }
});


// ── Render Loop — Live Continuous 60/120 FPS Motion ───────────

function animate(time) {
    requestAnimationFrame(animate);

    // Live continuous FPS calculation driven by actual 3D render loop (updates when camera is active)
    animFrames++;
    const now = performance.now();
    if (now - lastAnimTime >= 500) {
        currentFps = cameraRunning ? Math.round((animFrames * 1000) / (now - lastAnimTime)) : 0;
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
    addEventLog('MotionW initialized');

    // ── Draggable Camera PiP (Mobile Touch + Desktop Drag) ──
    // ── Draggable & Resizable Camera PiP (Mobile Touch + Desktop Drag) ──
    const panel = document.getElementById('camera-panel');
    if (panel) {
        let isDragging = false;
        let startX = 0, startY = 0, origLeft = 0, origTop = 0;
        let dragDist = 0;

        window.togglePipSize = function (e) {
            if (e) {
                e.stopPropagation();
                e.preventDefault();
            }
            panel.classList.toggle('expanded');
            const isExp = panel.classList.contains('expanded');
            const icon = document.getElementById('pip-expand-icon');
            if (icon) {
                if (isExp) {
                    icon.innerHTML = `
                        <polyline points="4 14 10 14 10 20"></polyline>
                        <polyline points="20 10 14 10 14 4"></polyline>
                        <line x1="14" y1="10" x2="21" y2="3"></line>
                        <line x1="3" y1="21" x2="10" y2="14"></line>
                    `;
                } else {
                    icon.innerHTML = `
                        <polyline points="15 3 21 3 21 9"></polyline>
                        <polyline points="9 21 3 21 3 15"></polyline>
                        <line x1="21" y1="3" x2="14" y2="10"></line>
                        <line x1="3" y1="21" x2="10" y2="14"></line>
                    `;
                }
            }
        };

        function startDrag(clientX, clientY) {
            isDragging = true;
            dragDist = 0;
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
            dragDist = Math.hypot(dx, dy);

            let newLeft = origLeft + dx;
            let newTop = origTop + dy;

            const pw = panel.offsetWidth || 230;
            const ph = panel.offsetHeight || 130;
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
        let lastTapTime = 0;
        panel.addEventListener('touchstart', function (e) {
            if (e.target.closest('button, a')) return;
            const t = e.touches[0];
            startDrag(t.clientX, t.clientY);
        }, { passive: true });

        window.addEventListener('touchmove', function (e) {
            if (!isDragging) return;
            if (e.cancelable) e.preventDefault();
            const t = e.touches[0];
            moveDrag(t.clientX, t.clientY);
        }, { passive: false });

        window.addEventListener('touchend', function (e) {
            if (!isDragging) return;
            if (dragDist < 8) {
                const now = Date.now();
                if (now - lastTapTime < 320) {
                    togglePipSize(e);
                }
                lastTapTime = now;
            }
            endDrag();
        });
        window.addEventListener('touchcancel', endDrag);

        // Mouse event handlers for desktop
        panel.addEventListener('mousedown', function (e) {
            if (e.target.closest('button, a')) return;
            startDrag(e.clientX, e.clientY);
            e.preventDefault();
        });

        window.addEventListener('mousemove', function (e) {
            if (!isDragging) return;
            e.preventDefault();
            moveDrag(e.clientX, e.clientY);
        });

        window.addEventListener('mouseup', endDrag);

        panel.addEventListener('dblclick', function (e) {
            if (e.target.closest('button, a')) return;
            togglePipSize(e);
        });
    }
});
