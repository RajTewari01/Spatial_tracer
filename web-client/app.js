/* ═══════════════════════════════════════════════════════════════
   Vision Tracking Engine — Three.js 3D Hand Visualizer
   
   Connects to ws://localhost:8765/ws/hand-data
   Renders a 3D hand skeleton from MediaPipe landmarks
   Visualizes gestures with particle effects
   ═══════════════════════════════════════════════════════════════ */

// ── Globals ────────────────────────────────────────────────────
let scene, camera, renderer, controls;
let ws = null;
let isConnected = false;
let handMeshes = {};       // { "Left": { joints: [], bones: [], tips: [] }, ... }
let particles = [];        // Active particle effects
let gestureFlashTimer = null;
let eventLog = [];

// MediaPipe hand connections (pairs of landmark indices)
const HAND_CONNECTIONS = [
    [0,1],[1,2],[2,3],[3,4],       // Thumb
    [0,5],[5,6],[6,7],[7,8],       // Index
    [0,9],[9,10],[10,11],[11,12],   // Middle
    [0,13],[13,14],[14,15],[15,16], // Ring
    [0,17],[17,18],[18,19],[19,20], // Pinky
    [5,9],[9,13],[13,17],          // Palm
];

const FINGERTIP_IDS = [4, 8, 12, 16, 20];

const GESTURE_COLORS = {
    tap:        0x00e676,
    pinch:      0xffc107,
    swipe_left: 0x6c63ff,
    swipe_right:0x6c63ff,
    swipe_up:   0x6c63ff,
    swipe_down: 0x6c63ff,
    open_palm:  0xff5252,
};

const GESTURE_EMOJIS = {
    tap:        '👆',
    pinch:      '🤏',
    swipe_left: '👈',
    swipe_right:'👉',
    swipe_up:   '👆',
    swipe_down: '👇',
    open_palm:  '✋',
};


// ── Three.js Setup ─────────────────────────────────────────────

function initScene() {
    const container = document.getElementById('canvas-container');

    // Scene
    scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x0d1117, 0.15);

    // Camera
    camera = new THREE.PerspectiveCamera(
        60,
        window.innerWidth / window.innerHeight,
        0.1,
        100
    );
    camera.position.set(0, 0, 2.5);

    // Renderer
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x0d1117, 1);
    renderer.shadowMap.enabled = true;
    container.appendChild(renderer.domElement);

    // Orbit controls
    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.enablePan = false;
    controls.maxDistance = 5;
    controls.minDistance = 1;

    // Lighting
    const ambientLight = new THREE.AmbientLight(0x404060, 0.5);
    scene.add(ambientLight);

    const pointLight = new THREE.PointLight(0x6c63ff, 1.5, 10);
    pointLight.position.set(2, 2, 3);
    scene.add(pointLight);

    const pointLight2 = new THREE.PointLight(0x00e676, 0.8, 10);
    pointLight2.position.set(-2, -1, 2);
    scene.add(pointLight2);

    // Grid helper (subtle)
    const gridHelper = new THREE.GridHelper(4, 20, 0x21262d, 0x161b22);
    gridHelper.position.y = -1.2;
    scene.add(gridHelper);

    // Floating particles background
    createBackgroundParticles();

    // Resize handler
    window.addEventListener('resize', onResize);
}


function createBackgroundParticles() {
    const geometry = new THREE.BufferGeometry();
    const count = 300;
    const positions = new Float32Array(count * 3);

    for (let i = 0; i < count * 3; i++) {
        positions[i] = (Math.random() - 0.5) * 8;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const material = new THREE.PointsMaterial({
        size: 0.02,
        color: 0x6c63ff,
        transparent: true,
        opacity: 0.4,
        blending: THREE.AdditiveBlending,
    });

    const points = new THREE.Points(geometry, material);
    scene.add(points);

    // Store for animation
    points.userData.isBackground = true;
}


function onResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}


// ── Hand Mesh Management ───────────────────────────────────────

function getOrCreateHand(handLabel) {
    if (handMeshes[handLabel]) return handMeshes[handLabel];

    const hand = {
        joints: [],
        bones: [],
        tips: [],
        group: new THREE.Group(),
    };

    // Create 21 joint spheres
    const jointGeometry = new THREE.SphereGeometry(0.02, 16, 16);
    const jointMaterial = new THREE.MeshPhongMaterial({
        color: 0x58a6ff,
        emissive: 0x2244aa,
        emissiveIntensity: 0.3,
        shininess: 80,
    });

    for (let i = 0; i < 21; i++) {
        const sphere = new THREE.Mesh(jointGeometry.clone(), jointMaterial.clone());
        sphere.castShadow = true;
        hand.joints.push(sphere);
        hand.group.add(sphere);
    }

    // Create bone connections (lines)
    for (const [a, b] of HAND_CONNECTIONS) {
        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(6); // 2 points × 3 coords
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

        const material = new THREE.LineBasicMaterial({
            color: 0x58a6ff,
            transparent: true,
            opacity: 0.6,
            linewidth: 2,
        });

        const line = new THREE.Line(geometry, material);
        hand.bones.push({ line, a, b });
        hand.group.add(line);
    }

    // Fingertip glow spheres
    for (const tipId of FINGERTIP_IDS) {
        const glowGeometry = new THREE.SphereGeometry(0.035, 16, 16);
        const glowMaterial = new THREE.MeshPhongMaterial({
            color: 0x6c63ff,
            emissive: 0x6c63ff,
            emissiveIntensity: 0.8,
            transparent: true,
            opacity: 0.6,
            shininess: 100,
        });
        const glow = new THREE.Mesh(glowGeometry, glowMaterial);
        glow.userData.tipId = tipId;
        hand.tips.push(glow);
        hand.group.add(glow);
    }

    scene.add(hand.group);
    handMeshes[handLabel] = hand;
    return hand;
}


function updateHand(handLabel, landmarks) {
    const hand = getOrCreateHand(handLabel);

    // Update joint positions
    // MediaPipe: x(0-1 left-right), y(0-1 top-bottom), z(depth)
    // Convert to Three.js: x(-1 to 1), y(1 to -1), z(forward)
    for (const lm of landmarks) {
        const joint = hand.joints[lm.id];
        if (joint) {
            joint.position.set(
                (lm.x - 0.5) * 2,     // Center horizontally
                -(lm.y - 0.5) * 2,    // Flip Y
                -lm.z * 2             // Z depth
            );
            joint.visible = true;
        }
    }

    // Update bone connections
    for (const bone of hand.bones) {
        const jointA = hand.joints[bone.a];
        const jointB = hand.joints[bone.b];
        if (jointA && jointB) {
            const positions = bone.line.geometry.attributes.position.array;
            positions[0] = jointA.position.x;
            positions[1] = jointA.position.y;
            positions[2] = jointA.position.z;
            positions[3] = jointB.position.x;
            positions[4] = jointB.position.y;
            positions[5] = jointB.position.z;
            bone.line.geometry.attributes.position.needsUpdate = true;
        }
    }

    // Update fingertip glows
    for (const tip of hand.tips) {
        const joint = hand.joints[tip.userData.tipId];
        if (joint) {
            tip.position.copy(joint.position);
        }
    }
}


function hideAllHands() {
    for (const [label, hand] of Object.entries(handMeshes)) {
        for (const joint of hand.joints) joint.visible = false;
    }
}


// ── Gesture Effects ────────────────────────────────────────────

function createTapRipple(x, y) {
    const posX = (x - 0.5) * 2;
    const posY = -(y - 0.5) * 2;

    const geometry = new THREE.RingGeometry(0.01, 0.03, 32);
    const material = new THREE.MeshBasicMaterial({
        color: 0x00e676,
        transparent: true,
        opacity: 1,
        side: THREE.DoubleSide,
    });
    const ring = new THREE.Mesh(geometry, material);
    ring.position.set(posX, posY, 0.1);
    ring.userData = { type: 'ripple', age: 0, maxAge: 40 };
    scene.add(ring);
    particles.push(ring);
}


function createSwipeTrail(x, y, dx, dy) {
    const count = 15;
    for (let i = 0; i < count; i++) {
        const geometry = new THREE.SphereGeometry(0.015, 8, 8);
        const material = new THREE.MeshBasicMaterial({
            color: 0x6c63ff,
            transparent: true,
            opacity: 1 - (i / count),
        });
        const sphere = new THREE.Mesh(geometry, material);
        const t = i / count;
        sphere.position.set(
            ((x - dx * t) - 0.5) * 2,
            -((y - dy * t) - 0.5) * 2,
            0.05
        );
        sphere.userData = { type: 'trail', age: 0, maxAge: 25 + i * 2 };
        scene.add(sphere);
        particles.push(sphere);
    }
}


function createPinchArc(x, y) {
    const posX = (x - 0.5) * 2;
    const posY = -(y - 0.5) * 2;

    const geometry = new THREE.TorusGeometry(0.06, 0.01, 8, 32, Math.PI);
    const material = new THREE.MeshBasicMaterial({
        color: 0xffc107,
        transparent: true,
        opacity: 1,
    });
    const torus = new THREE.Mesh(geometry, material);
    torus.position.set(posX, posY, 0.1);
    torus.userData = { type: 'arc', age: 0, maxAge: 30 };
    scene.add(torus);
    particles.push(torus);
}


function updateParticles() {
    for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.userData.age++;

        const progress = p.userData.age / p.userData.maxAge;

        if (p.userData.type === 'ripple') {
            p.scale.setScalar(1 + progress * 6);
            p.material.opacity = 1 - progress;
        } else if (p.userData.type === 'trail') {
            p.material.opacity = Math.max(0, (1 - progress) * 0.8);
            p.scale.setScalar(Math.max(0.1, 1 - progress));
        } else if (p.userData.type === 'arc') {
            p.rotation.z += 0.05;
            p.material.opacity = 1 - progress;
            p.scale.setScalar(1 + progress * 2);
        }

        if (p.userData.age >= p.userData.maxAge) {
            scene.remove(p);
            p.geometry.dispose();
            p.material.dispose();
            particles.splice(i, 1);
        }
    }
}


// ── WebSocket Connection ───────────────────────────────────────

function connect() {
    if (ws && ws.readyState === WebSocket.OPEN) return;

    const host = window.location.hostname || 'localhost';
    const port = window.location.port || '8765';
    const url = `ws://${host}:${port}/ws/hand-data`;

    ws = new WebSocket(url);

    ws.onopen = () => {
        isConnected = true;
        updateConnectionUI(true);
        addEventLog('Connected to server');
    };

    ws.onclose = () => {
        isConnected = false;
        updateConnectionUI(false);
        addEventLog('Disconnected');
        // Auto-reconnect after 3s
        setTimeout(() => {
            if (!isConnected) connect();
        }, 3000);
    };

    ws.onerror = (err) => {
        console.error('WebSocket error:', err);
        isConnected = false;
        updateConnectionUI(false);
    };

    ws.onmessage = (event) => {
        try {
            const data = JSON.parse(event.data);
            handleFrame(data);
        } catch (e) {
            console.error('Parse error:', e);
        }
    };
}


function disconnect() {
    if (ws) {
        ws.close();
        ws = null;
    }
    isConnected = false;
    updateConnectionUI(false);
}


function toggleConnection() {
    const btn = document.getElementById('btn-connect');
    if (isConnected) {
        disconnect();
        btn.textContent = 'Connect';
    } else {
        connect();
        btn.textContent = 'Disconnect';
    }
}


async function startTracking() {
    try {
        const host = window.location.hostname || 'localhost';
        const port = window.location.port || '8765';
        const resp = await fetch(`http://${host}:${port}/start`, { method: 'POST' });
        const data = await resp.json();
        addEventLog(`Tracker: ${data.status}`);
    } catch (e) {
        addEventLog('Failed to start tracking');
    }
}


// ── Frame Handler ──────────────────────────────────────────────

function handleFrame(data) {
    // Update FPS
    const fpsEl = document.getElementById('fps-value');
    fpsEl.textContent = Math.round(data.fps || 0);

    // Update hands count
    const handsCountEl = document.getElementById('hands-count');
    handsCountEl.textContent = (data.hands || []).length;

    // Update hand meshes
    if (data.hands && data.hands.length > 0) {
        for (const hand of data.hands) {
            updateHand(hand.handedness, hand.landmarks);
        }
    } else {
        hideAllHands();
    }

    // Handle gestures
    if (data.gestures && data.gestures.length > 0) {
        updateGestureDisplay(data.gestures);

        for (const gesture of data.gestures) {
            const pos = gesture.position || { x: 0.5, y: 0.5 };

            switch (gesture.gesture) {
                case 'tap':
                    createTapRipple(pos.x, pos.y);
                    flashGesture('👆 TAP');
                    break;
                case 'pinch':
                    createPinchArc(pos.x, pos.y);
                    flashGesture('🤏 PINCH');
                    break;
                case 'swipe_left':
                case 'swipe_right':
                case 'swipe_up':
                case 'swipe_down':
                    const d = gesture.details || {};
                    createSwipeTrail(pos.x, pos.y, d.dx || 0, d.dy || 0);
                    flashGesture(`${GESTURE_EMOJIS[gesture.gesture] || '👋'} ${gesture.gesture.toUpperCase()}`);
                    break;
                case 'open_palm':
                    flashGesture('✋ OPEN PALM');
                    break;
            }

            addEventLog(`${gesture.gesture} (${gesture.hand || '?'}) conf:${gesture.confidence}`);
        }
    } else {
        clearGestureDisplay();
    }
}


// ── UI Updates ─────────────────────────────────────────────────

function updateConnectionUI(connected) {
    const indicator = document.getElementById('connection-indicator');
    const text = document.getElementById('connection-text');

    if (connected) {
        indicator.classList.remove('disconnected');
        indicator.classList.add('connected');
        text.textContent = 'Connected';
    } else {
        indicator.classList.remove('connected');
        indicator.classList.add('disconnected');
        text.textContent = 'Disconnected';
    }
}


function updateGestureDisplay(gestures) {
    const container = document.getElementById('gesture-display');
    container.innerHTML = '';

    for (const g of gestures) {
        const badge = document.createElement('span');
        const baseClass = g.gesture.startsWith('swipe') ? 'swipe' : g.gesture;
        badge.className = `gesture-badge ${baseClass}`;
        badge.textContent = `${GESTURE_EMOJIS[g.gesture] || '❓'} ${g.gesture}`;
        container.appendChild(badge);
    }
}


function clearGestureDisplay() {
    const container = document.getElementById('gesture-display');
    if (container.querySelector('.gesture-badge')) {
        // Keep badges for a moment before clearing
        setTimeout(() => {
            if (!container.querySelector('.gesture-badge')) return;
            container.innerHTML = '<span class="gesture-placeholder">No gestures detected</span>';
        }, 1500);
    }
}


function flashGesture(text) {
    const el = document.getElementById('gesture-flash');
    el.textContent = text;
    el.classList.remove('hidden');
    el.classList.add('visible');

    if (gestureFlashTimer) clearTimeout(gestureFlashTimer);
    gestureFlashTimer = setTimeout(() => {
        el.classList.remove('visible');
        el.classList.add('hidden');
    }, 600);
}


function addEventLog(message) {
    const log = document.getElementById('event-log');
    const now = new Date();
    const timeStr = now.toLocaleTimeString('en-US', { hour12: false });

    eventLog.unshift({ time: timeStr, message });
    if (eventLog.length > 50) eventLog.pop();

    log.innerHTML = eventLog.slice(0, 20).map(e =>
        `<div class="event-entry">
            <span class="time">${e.time}</span>
            <span class="event-type">${e.message}</span>
        </div>`
    ).join('');
}


// ── Animation Loop ─────────────────────────────────────────────

function animate() {
    requestAnimationFrame(animate);

    // Rotate background particles
    scene.children.forEach(child => {
        if (child.userData && child.userData.isBackground) {
            child.rotation.y += 0.0003;
            child.rotation.x += 0.0001;
        }
    });

    // Update effects
    updateParticles();

    // Update controls
    controls.update();

    renderer.render(scene, camera);
}


// ── Init ───────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
    initScene();
    animate();

    // Auto-connect on load
    setTimeout(connect, 500);
});
