/* ═══════════════════════════════════════════════════════════════
   Vision Tracking Engine — In-Browser MediaPipe + Three.js
   
   ✦ MediaPipe Hands runs DIRECTLY in the browser (no server needed)
   ✦ Camera feed visible in a pip-style panel
   ✦ Particle sphere reacts to hand movements and gestures
   ═══════════════════════════════════════════════════════════════ */

// ── State ──────────────────────────────────────────────────────
let scene, camera, renderer, controls;
let mpHands = null;
let mpCamera = null;
let cameraRunning = false;

let handData = [];          // Array of { landmarks, worldLandmarks, handedness }
let particleSphere = null;  // Main particle sphere
let trailParticles = [];    // Fingertip trail particles
let ripples = [];           // Gesture ripple effects
let gestureFlashTimer = null;
let eventLog = [];
let frameCount = 0;
let lastFpsTime = performance.now();
let currentFps = 0;

// ── MediaPipe Hand Connections ─────────────────────────────────
const HAND_CONNECTIONS_MP = [
    [0,1],[1,2],[2,3],[3,4],
    [0,5],[5,6],[6,7],[7,8],
    [0,9],[9,10],[10,11],[11,12],
    [0,13],[13,14],[14,15],[15,16],
    [0,17],[17,18],[18,19],[19,20],
    [5,9],[9,13],[13,17],
];

const FINGERTIP_IDS = [4, 8, 12, 16, 20];
const MCP_IDS = [2, 5, 9, 13, 17];
const FINGER_NAMES = ['thumb', 'index', 'middle', 'ring', 'pinky'];
const FINGER_EMOJIS = ['👍', '☝️', '🖕', '💍', '🤙'];


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
    renderer.setClearColor(0x0a0a1a, 1);
    container.appendChild(renderer.domElement);

    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.enablePan = false;
    controls.maxDistance = 8;
    controls.minDistance = 2;
    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.5;

    // Lighting
    scene.add(new THREE.AmbientLight(0x303050, 0.4));
    const p1 = new THREE.PointLight(0x6c63ff, 2, 15);
    p1.position.set(3, 3, 5);
    scene.add(p1);
    const p2 = new THREE.PointLight(0x00e5ff, 1.2, 15);
    p2.position.set(-3, -2, 4);
    scene.add(p2);

    // Create particle sphere
    createParticleSphere();

    window.addEventListener('resize', () => {
        camera.aspect = innerWidth / innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(innerWidth, innerHeight);
    });
}


// ── Particle Sphere ────────────────────────────────────────────

function createParticleSphere() {
    const count = 3000;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    const basePositions = new Float32Array(count * 3);  // Store original sphere positions

    const radius = 1.5;
    for (let i = 0; i < count; i++) {
        // Fibonacci sphere distribution
        const y = 1 - (i / (count - 1)) * 2;
        const radiusAtY = Math.sqrt(1 - y * y);
        const theta = ((1 + Math.sqrt(5)) / 2) * i * Math.PI * 2;

        const x = radiusAtY * Math.cos(theta) * radius;
        const z = radiusAtY * Math.sin(theta) * radius;
        const yPos = y * radius;

        positions[i*3]   = x;
        positions[i*3+1] = yPos;
        positions[i*3+2] = z;

        basePositions[i*3]   = x;
        basePositions[i*3+1] = yPos;
        basePositions[i*3+2] = z;

        // Gradient colors: purple → cyan
        const t = (y + 1) / 2;
        colors[i*3]   = 0.42 * (1-t) + 0.0 * t;   // R
        colors[i*3+1] = 0.39 * (1-t) + 0.9 * t;   // G
        colors[i*3+2] = 1.0  * (1-t) + 1.0 * t;   // B

        sizes[i] = 2.0 + Math.random() * 2.0;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
    geometry.userData = { basePositions };

    const material = new THREE.PointsMaterial({
        size: 0.03,
        vertexColors: true,
        transparent: true,
        opacity: 0.8,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        sizeAttenuation: true,
    });

    particleSphere = new THREE.Points(geometry, material);
    scene.add(particleSphere);
}


function updateParticleSphere(time) {
    if (!particleSphere) return;

    const positions = particleSphere.geometry.attributes.position.array;
    const basePos = particleSphere.geometry.userData.basePositions;
    const colors = particleSphere.geometry.attributes.color.array;
    const count = positions.length / 3;

    // Gather all fingertip positions in 3D space
    const tips3D = [];
    for (const hand of handData) {
        for (const tipId of FINGERTIP_IDS) {
            const lm = hand.landmarks[tipId];
            if (lm) {
                tips3D.push({
                    x: (lm.x - 0.5) * 4,
                    y: -(lm.y - 0.5) * 4,
                    z: -lm.z * 2,
                });
            }
        }
    }

    const hasHands = tips3D.length > 0;

    for (let i = 0; i < count; i++) {
        const bx = basePos[i*3];
        const by = basePos[i*3+1];
        const bz = basePos[i*3+2];

        // Default: gentle breathing animation
        const breathe = 1 + Math.sin(time * 0.8 + i * 0.01) * 0.03;
        let tx = bx * breathe;
        let ty = by * breathe;
        let tz = bz * breathe;

        // Influence from fingertips
        if (hasHands) {
            let totalForce = 0;
            let fx = 0, fy = 0, fz = 0;

            for (const tip of tips3D) {
                const dx = tx - tip.x;
                const dy = ty - tip.y;
                const dz = tz - tip.z;
                const dist = Math.sqrt(dx*dx + dy*dy + dz*dz);

                if (dist < 2.0) {
                    // Repel particles away from fingertips
                    const force = Math.pow(Math.max(0, 1 - dist / 2.0), 2) * 0.8;
                    const norm = dist || 0.001;
                    fx += (dx / norm) * force;
                    fy += (dy / norm) * force;
                    fz += (dz / norm) * force;
                    totalForce += force;
                }
            }

            tx += fx;
            ty += fy;
            tz += fz;

            // Color shift when influenced
            if (totalForce > 0.05) {
                const t = Math.min(1, totalForce * 2);
                colors[i*3]   = 0.42 * (1-t) + 0.0 * t;
                colors[i*3+1] = 0.39 * (1-t) + 1.0 * t;
                colors[i*3+2] = 1.0;
            }
        } else {
            // Slowly restore original colors
            const origT = (by / 1.5 + 1) / 2;
            colors[i*3]   += (0.42 * (1-origT) - colors[i*3]) * 0.02;
            colors[i*3+1] += (0.39 * (1-origT) + 0.9 * origT - colors[i*3+1]) * 0.02;
            colors[i*3+2] += (1.0 - colors[i*3+2]) * 0.02;
        }

        // Smooth lerp to target
        positions[i*3]   += (tx - positions[i*3])   * 0.08;
        positions[i*3+1] += (ty - positions[i*3+1]) * 0.08;
        positions[i*3+2] += (tz - positions[i*3+2]) * 0.08;
    }

    particleSphere.geometry.attributes.position.needsUpdate = true;
    particleSphere.geometry.attributes.color.needsUpdate = true;

    // Gentle rotation
    particleSphere.rotation.y += 0.001;
}


// ── Trail Particles ────────────────────────────────────────────

function spawnTrailParticle(x, y, z, color) {
    const geo = new THREE.SphereGeometry(0.02, 6, 6);
    const mat = new THREE.MeshBasicMaterial({
        color: color,
        transparent: true,
        opacity: 0.9,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, y, z);
    mesh.userData = { age: 0, maxAge: 30 };
    scene.add(mesh);
    trailParticles.push(mesh);
}


function updateTrailParticles() {
    for (let i = trailParticles.length - 1; i >= 0; i--) {
        const p = trailParticles[i];
        p.userData.age++;
        const progress = p.userData.age / p.userData.maxAge;
        p.material.opacity = Math.max(0, 0.9 * (1 - progress));
        p.scale.setScalar(Math.max(0.1, 1 - progress * 0.7));
        if (p.userData.age >= p.userData.maxAge) {
            scene.remove(p);
            p.geometry.dispose();
            p.material.dispose();
            trailParticles.splice(i, 1);
        }
    }

    // Cap trail particles
    while (trailParticles.length > 200) {
        const old = trailParticles.shift();
        scene.remove(old);
        old.geometry.dispose();
        old.material.dispose();
    }
}


// ── Ripple Effects ─────────────────────────────────────────────

function createRipple(x, y, z, color) {
    const geo = new THREE.RingGeometry(0.01, 0.04, 32);
    const mat = new THREE.MeshBasicMaterial({
        color: color,
        transparent: true,
        opacity: 1,
        side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, y, z);
    mesh.lookAt(camera.position);
    mesh.userData = { age: 0, maxAge: 40 };
    scene.add(mesh);
    ripples.push(mesh);
}


function updateRipples() {
    for (let i = ripples.length - 1; i >= 0; i--) {
        const r = ripples[i];
        r.userData.age++;
        const p = r.userData.age / r.userData.maxAge;
        r.scale.setScalar(1 + p * 8);
        r.material.opacity = 1 - p;
        if (r.userData.age >= r.userData.maxAge) {
            scene.remove(r);
            r.geometry.dispose();
            r.material.dispose();
            ripples.splice(i, 1);
        }
    }
}


// ═══════════════════════════════════════════════════════════════
//  MEDIAPIPE HANDS (IN-BROWSER)
// ═══════════════════════════════════════════════════════════════

function initMediaPipe() {
    mpHands = new Hands({
        locateFile: (file) => {
            return `https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4.1675469240/${file}`;
        }
    });

    mpHands.setOptions({
        maxNumHands: 2,
        modelComplexity: 1,
        minDetectionConfidence: 0.6,
        minTrackingConfidence: 0.5,
    });

    mpHands.onResults(onHandResults);
}


function onHandResults(results) {
    // FPS calculation
    frameCount++;
    const now = performance.now();
    if (now - lastFpsTime >= 1000) {
        currentFps = frameCount;
        frameCount = 0;
        lastFpsTime = now;
        document.getElementById('fps-value').textContent = currentFps;
    }

    // Draw on camera overlay canvas
    const canvas = document.getElementById('hand-overlay');
    const video = document.getElementById('webcam');
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Store hand data
    handData = [];

    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
        document.getElementById('hands-value').textContent = results.multiHandLandmarks.length;

        for (let hIdx = 0; hIdx < results.multiHandLandmarks.length; hIdx++) {
            const landmarks = results.multiHandLandmarks[hIdx];
            const handedness = results.multiHandedness?.[hIdx]?.label || 'Unknown';

            handData.push({ landmarks, handedness });

            // Draw skeleton on camera overlay
            drawHandOnCanvas(ctx, landmarks, canvas.width, canvas.height, hIdx);

            // Spawn trail particles for each fingertip
            for (const tipId of FINGERTIP_IDS) {
                const lm = landmarks[tipId];
                spawnTrailParticle(
                    (lm.x - 0.5) * 4,
                    -(lm.y - 0.5) * 4,
                    -lm.z * 2,
                    hIdx === 0 ? 0x6c63ff : 0x00e5ff
                );
            }

            // Detect gestures
            detectGestures(landmarks, handedness);
            updateFingerStatus(landmarks);
        }
    } else {
        document.getElementById('hands-value').textContent = '0';
        clearFingerStatus();
    }
}


function drawHandOnCanvas(ctx, landmarks, w, h, handIdx) {
    const color = handIdx === 0 ? '#6c63ff' : '#00e5ff';
    const glowColor = handIdx === 0 ? 'rgba(108,99,255,0.4)' : 'rgba(0,229,255,0.4)';

    // Draw connections
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.shadowColor = glowColor;
    ctx.shadowBlur = 8;

    for (const [a, b] of HAND_CONNECTIONS_MP) {
        const la = landmarks[a], lb = landmarks[b];
        ctx.beginPath();
        ctx.moveTo(la.x * w, la.y * h);
        ctx.lineTo(lb.x * w, lb.y * h);
        ctx.stroke();
    }

    // Draw joints
    ctx.shadowBlur = 0;
    for (let i = 0; i < landmarks.length; i++) {
        const lm = landmarks[i];
        const isTip = FINGERTIP_IDS.includes(i);
        const radius = isTip ? 5 : 3;

        ctx.beginPath();
        ctx.arc(lm.x * w, lm.y * h, radius, 0, Math.PI * 2);
        ctx.fillStyle = isTip ? '#00e676' : color;
        ctx.fill();

        if (isTip) {
            // Glow on fingertips
            ctx.beginPath();
            ctx.arc(lm.x * w, lm.y * h, 12, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(0,230,118,0.15)';
            ctx.fill();
        }
    }
}


// ── Gesture Detection ──────────────────────────────────────────

let lastGestureTime = {};

function detectGestures(landmarks, handedness) {
    const now = Date.now();
    const gestures = [];

    // Pinch: thumb tip close to index tip
    const thumb = landmarks[4], index = landmarks[8];
    const pinchDist = Math.sqrt(
        (thumb.x - index.x)**2 + (thumb.y - index.y)**2
    );
    if (pinchDist < 0.06) {
        gestures.push('pinch');
        const mx = ((thumb.x + index.x)/2 - 0.5) * 4;
        const my = -((thumb.y + index.y)/2 - 0.5) * 4;
        createRipple(mx, my, 0.5, 0xffc107);
    }

    // Open palm: all fingertips above MCPs
    let fingersUp = 0;
    for (let f = 1; f < 5; f++) {
        if (landmarks[FINGERTIP_IDS[f]].y < landmarks[MCP_IDS[f]].y) {
            fingersUp++;
        }
    }
    // Thumb check: x-distance from wrist
    const wrist = landmarks[0];
    if (Math.abs(landmarks[4].x - wrist.x) > Math.abs(landmarks[2].x - wrist.x)) {
        fingersUp++;
    }

    if (fingersUp >= 5) {
        gestures.push('open_palm');
    } else if (fingersUp === 1 && landmarks[8].y < landmarks[5].y) {
        gestures.push('pointing');
    } else if (fingersUp === 0) {
        gestures.push('fist');
    }

    // Update UI
    updateGestureUI(gestures, handedness, now);
}


function updateGestureUI(gestures, handedness, now) {
    const container = document.getElementById('gesture-display');
    if (gestures.length === 0) return;

    container.innerHTML = '';
    for (const g of gestures) {
        const badge = document.createElement('span');
        badge.className = `gesture-badge ${g}`;
        const emojis = { pinch: '🤏', open_palm: '✋', pointing: '☝️', fist: '✊' };
        badge.textContent = `${emojis[g] || '❓'} ${g}`;
        container.appendChild(badge);

        // Flash for important gestures
        const key = `${handedness}_${g}`;
        if (!lastGestureTime[key] || now - lastGestureTime[key] > 1500) {
            lastGestureTime[key] = now;
            flashGesture(`${emojis[g] || ''} ${g.toUpperCase()}`);
            addEventLog(`${handedness}: ${g}`);
        }
    }
}


function updateFingerStatus(landmarks) {
    const fingers = ['thumb', 'index', 'middle', 'ring', 'pinky'];
    const wrist = landmarks[0];

    for (let f = 0; f < 5; f++) {
        const el = document.getElementById(`f-${fingers[f]}`);
        if (!el) continue;

        let isUp = false;
        if (f === 0) {
            isUp = Math.abs(landmarks[4].x - wrist.x) > Math.abs(landmarks[2].x - wrist.x);
        } else {
            isUp = landmarks[FINGERTIP_IDS[f]].y < landmarks[MCP_IDS[f]].y;
        }

        el.textContent = `${FINGER_EMOJIS[f]} ${isUp ? 'UP' : 'DN'}`;
        el.className = `finger ${isUp ? 'up' : 'down'}`;
    }
}


function clearFingerStatus() {
    for (const name of FINGER_NAMES) {
        const el = document.getElementById(`f-${name}`);
        if (el) {
            el.textContent = `${FINGER_EMOJIS[FINGER_NAMES.indexOf(name)]} —`;
            el.className = 'finger';
        }
    }
}


// ── Camera Control ─────────────────────────────────────────────

async function startCamera() {
    const video = document.getElementById('webcam');

    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            video: { width: 640, height: 480, facingMode: 'user' }
        });
        video.srcObject = stream;
        await video.play();

        // Init MediaPipe & start processing
        initMediaPipe();

        mpCamera = new Camera(video, {
            onFrame: async () => {
                await mpHands.send({ image: video });
            },
            width: 640,
            height: 480,
        });
        mpCamera.start();
        cameraRunning = true;

        // Update UI
        const indicator = document.getElementById('connection-indicator');
        indicator.classList.remove('disconnected');
        indicator.classList.add('connected');
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
    if (mpCamera) {
        mpCamera.stop();
        mpCamera = null;
    }
    cameraRunning = false;

    const video = document.getElementById('webcam');
    if (video.srcObject) {
        video.srcObject.getTracks().forEach(t => t.stop());
        video.srcObject = null;
    }

    handData = [];

    const indicator = document.getElementById('connection-indicator');
    indicator.classList.remove('connected');
    indicator.classList.add('disconnected');
    document.getElementById('connection-text').textContent = 'Camera Off';
    document.getElementById('btn-start').textContent = '🎥 Start Camera';
    document.getElementById('btn-start').disabled = false;

    addEventLog('Camera stopped');
}


function toggleCameraSize() {
    document.getElementById('camera-panel').classList.toggle('expanded');
}


// ── UI Helpers ─────────────────────────────────────────────────

function flashGesture(text) {
    const el = document.getElementById('gesture-flash');
    el.textContent = text;
    el.classList.remove('hidden');
    el.classList.add('visible');
    if (gestureFlashTimer) clearTimeout(gestureFlashTimer);
    gestureFlashTimer = setTimeout(() => {
        el.classList.remove('visible');
        el.classList.add('hidden');
    }, 500);
}


function addEventLog(message) {
    const log = document.getElementById('event-log');
    const t = new Date().toLocaleTimeString('en-US', { hour12: false });
    eventLog.unshift({ time: t, message });
    if (eventLog.length > 30) eventLog.pop();
    log.innerHTML = eventLog.slice(0, 15).map(e =>
        `<div class="event-entry"><span class="time">${e.time}</span> <span class="event-type">${e.message}</span></div>`
    ).join('');
}


// ── Animation Loop ─────────────────────────────────────────────

function animate(time) {
    requestAnimationFrame(animate);

    const t = time * 0.001;

    updateParticleSphere(t);
    updateTrailParticles();
    updateRipples();

    controls.update();
    renderer.render(scene, camera);
}


// ── Init ───────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
    initThreeJS();
    animate(0);
    addEventLog('Ready — click "Start Camera" to begin');
});
