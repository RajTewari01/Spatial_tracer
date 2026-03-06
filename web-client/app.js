/* ═══════════════════════════════════════════════════════════════
   Spatial_Tracer — In-Browser MediaPipe + Three.js
   
   ✦ Zero emojis — premium monospace labels
   ✦ Typewriter effects on logo + bio
   ✦ 13 gesture types with improved detection
   ✦ 4000-particle sphere with fingertip physics
   ═══════════════════════════════════════════════════════════════ */

// ── State ──────────────────────────────────────────────────────
let scene, camera, renderer, controls;
let mpHands = null, mpCamera = null, cameraRunning = false;
let handData = [];
let particleSphere = null;
let trailParticles = [], ripples = [];
let gestureFlashTimer = null;
let eventLog = [];
let frameCount = 0, lastFpsTime = performance.now(), currentFps = 0;

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

// ── Gesture catalog (no emojis, just clean labels) ─────────────
const G = {
    thumbs_up:     { label: 'THUMBS UP',     color: 0x34d399 },
    thumbs_down:   { label: 'THUMBS DOWN',   color: 0xf472b6 },
    peace:         { label: 'PEACE',          color: 0x7c6aff },
    middle_finger: { label: 'MIDDLE FINGER', color: 0xfb923c },
    rock:          { label: 'ROCK',           color: 0xfbbf24 },
    ok:            { label: 'OK SIGN',        color: 0x38bdf8 },
    pinch:         { label: 'PINCH',          color: 0xfbbf24 },
    open_palm:     { label: 'OPEN PALM',      color: 0x22d3ee },
    fist:          { label: 'FIST',           color: 0xef4444 },
    pointing:      { label: 'POINTING',       color: 0x34d399 },
    call_me:       { label: 'CALL ME',        color: 0x22d3ee },
    three:         { label: 'THREE',          color: 0xa393ff },
    spiderman:     { label: 'SPIDERMAN',      color: 0xf472b6 },
};


// ═══════════════════════════════════════════════════════════════
//  TYPEWRITER ENGINE
// ═══════════════════════════════════════════════════════════════

class Typewriter {
    constructor(element, options = {}) {
        this.el = element;
        this.speed = options.speed || 70;
        this.pause = options.pause || 1200;
        this.queue = [];
        this.running = false;
    }
    type(text) { this.queue.push({ action: 'type', text }); return this; }
    wait(ms)   { this.queue.push({ action: 'wait', ms }); return this; }
    clear()    { this.queue.push({ action: 'clear' }); return this; }
    loop()     { this.queue.push({ action: 'loop' }); return this; }

    async start() {
        if (this.running) return;
        this.running = true;
        const origQueue = [...this.queue];
        while (this.running) {
            for (const item of this.queue) {
                if (!this.running) return;
                if (item.action === 'type') {
                    for (let i = 0; i < item.text.length; i++) {
                        if (!this.running) return;
                        this.el.textContent += item.text[i];
                        await sleep(this.speed + Math.random() * 30);
                    }
                } else if (item.action === 'wait') {
                    await sleep(item.ms);
                } else if (item.action === 'clear') {
                    const txt = this.el.textContent;
                    for (let i = txt.length; i > 0; i--) {
                        if (!this.running) return;
                        this.el.textContent = txt.substring(0, i - 1);
                        await sleep(30);
                    }
                } else if (item.action === 'loop') {
                    this.queue = [...origQueue];
                }
            }
            // If no loop action, stop
            if (!this.queue.find(q => q.action === 'loop')) break;
        }
    }
    stop() { this.running = false; }
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }


// ═══════════════════════════════════════════════════════════════
//  THREE.JS
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
    controls.minDistance = 1.5;
    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.35;

    scene.add(new THREE.AmbientLight(0x101020, 0.4));
    const p1 = new THREE.PointLight(0x7c6aff, 2, 15);
    p1.position.set(3, 3, 5); scene.add(p1);
    const p2 = new THREE.PointLight(0x22d3ee, 1, 15);
    p2.position.set(-3, -2, 4); scene.add(p2);
    const p3 = new THREE.PointLight(0x34d399, 0.5, 12);
    p3.position.set(0, -3, 3); scene.add(p3);

    createParticleSphere();

    window.addEventListener('resize', () => {
        camera.aspect = innerWidth/innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(innerWidth, innerHeight);
    });
}


function createParticleSphere() {
    const count = 4000;
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(count * 3);
    const col = new Float32Array(count * 3);
    const base = new Float32Array(count * 3);
    const R = 1.6;

    for (let i = 0; i < count; i++) {
        const y = 1 - (i/(count-1))*2;
        const rY = Math.sqrt(1 - y*y);
        const theta = ((1+Math.sqrt(5))/2) * i * Math.PI * 2;
        const x = rY*Math.cos(theta)*R, z = rY*Math.sin(theta)*R, yp = y*R;

        pos[i*3]=x; pos[i*3+1]=yp; pos[i*3+2]=z;
        base[i*3]=x; base[i*3+1]=yp; base[i*3+2]=z;

        const t = (y+1)/2;
        if (t < 0.5) {
            const s = t*2;
            col[i*3]=0.49*(1-s)+0.13*s; col[i*3+1]=0.42*(1-s)+0.83*s; col[i*3+2]=1.0;
        } else {
            const s = (t-0.5)*2;
            col[i*3]=0.13*(1-s)+0.2*s; col[i*3+1]=0.83*(1-s)+0.83*s; col[i*3+2]=0.93*(1-s)+0.6*s;
        }
    }

    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.userData = { basePositions: base };

    particleSphere = new THREE.Points(geo, new THREE.PointsMaterial({
        size: 0.022, vertexColors: true, transparent: true,
        opacity: 0.85, blending: THREE.AdditiveBlending,
        depthWrite: false, sizeAttenuation: true,
    }));
    scene.add(particleSphere);
}


function updateSphere(time) {
    if (!particleSphere) return;
    const pos = particleSphere.geometry.attributes.position.array;
    const base = particleSphere.geometry.userData.basePositions;
    const col = particleSphere.geometry.attributes.color.array;
    const n = pos.length/3;

    const tips3D = [];
    for (const hand of handData) {
        for (const tid of TIP) {
            const lm = hand.landmarks[tid];
            if (lm) tips3D.push({ x:(lm.x-0.5)*4, y:-(lm.y-0.5)*4, z:-lm.z*2 });
        }
    }

    const hasHands = tips3D.length > 0;
    for (let i = 0; i < n; i++) {
        const bx=base[i*3], by=base[i*3+1], bz=base[i*3+2];
        const breathe = 1+Math.sin(time*0.6+i*0.008)*0.025;
        let tx=bx*breathe, ty=by*breathe, tz=bz*breathe;

        if (hasHands) {
            let fx=0, fy=0, fz=0, totalF=0;
            for (const tip of tips3D) {
                const dx=tx-tip.x, dy=ty-tip.y, dz=tz-tip.z;
                const d = Math.sqrt(dx*dx+dy*dy+dz*dz);
                if (d < 2.2) {
                    const f = Math.pow(Math.max(0,1-d/2.2),2)*0.9;
                    const nm = d||0.001;
                    fx+=(dx/nm)*f; fy+=(dy/nm)*f; fz+=(dz/nm)*f; totalF+=f;
                }
            }
            tx+=fx; ty+=fy; tz+=fz;
            if (totalF>0.03) {
                const t=Math.min(1,totalF*3);
                col[i*3]+=(1-col[i*3])*t*0.1;
                col[i*3+1]+=(1-col[i*3+1])*t*0.1;
                col[i*3+2]+=(1-col[i*3+2])*t*0.05;
            }
        } else {
            const ot=(by/1.6+1)/2;
            col[i*3]+=(0.49*(1-ot)-col[i*3])*0.01;
            col[i*3+1]+=(0.42*(1-ot)+0.83*ot-col[i*3+1])*0.01;
            col[i*3+2]+=(1-col[i*3+2])*0.01;
        }

        pos[i*3]+=(tx-pos[i*3])*0.07;
        pos[i*3+1]+=(ty-pos[i*3+1])*0.07;
        pos[i*3+2]+=(tz-pos[i*3+2])*0.07;
    }

    particleSphere.geometry.attributes.position.needsUpdate = true;
    particleSphere.geometry.attributes.color.needsUpdate = true;
    particleSphere.rotation.y += 0.0008;
}


// ── Effects ────────────────────────────────────────────────────

function spawnTrail(x,y,z,color) {
    const m = new THREE.Mesh(
        new THREE.SphereGeometry(0.016,6,6),
        new THREE.MeshBasicMaterial({color, transparent:true, opacity:0.8})
    );
    m.position.set(x,y,z); m.userData={age:0,maxAge:22};
    scene.add(m); trailParticles.push(m);
}

function spawnRipple(x,y,z,color) {
    const m = new THREE.Mesh(
        new THREE.RingGeometry(0.01,0.04,32),
        new THREE.MeshBasicMaterial({color, transparent:true, opacity:1, side:THREE.DoubleSide})
    );
    m.position.set(x,y,z); m.lookAt(camera.position);
    m.userData={age:0,maxAge:35};
    scene.add(m); ripples.push(m);
}

function updateEffects() {
    for (let i=trailParticles.length-1; i>=0; i--) {
        const p=trailParticles[i]; p.userData.age++;
        const pr=p.userData.age/p.userData.maxAge;
        p.material.opacity=Math.max(0,0.8*(1-pr));
        p.scale.setScalar(Math.max(0.1,1-pr*0.7));
        if (p.userData.age>=p.userData.maxAge) {
            scene.remove(p); p.geometry.dispose(); p.material.dispose();
            trailParticles.splice(i,1);
        }
    }
    while (trailParticles.length>250) {
        const o=trailParticles.shift(); scene.remove(o); o.geometry.dispose(); o.material.dispose();
    }
    for (let i=ripples.length-1; i>=0; i--) {
        const r=ripples[i]; r.userData.age++;
        const pr=r.userData.age/r.userData.maxAge;
        r.scale.setScalar(1+pr*8); r.material.opacity=1-pr;
        if (r.userData.age>=r.userData.maxAge) {
            scene.remove(r); r.geometry.dispose(); r.material.dispose();
            ripples.splice(i,1);
        }
    }
}


// ═══════════════════════════════════════════════════════════════
//  MEDIAPIPE
// ═══════════════════════════════════════════════════════════════

function initMediaPipe() {
    mpHands = new Hands({
        locateFile: f => `https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4.1675469240/${f}`
    });
    mpHands.setOptions({
        maxNumHands: 2, modelComplexity: 1,
        minDetectionConfidence: 0.65, minTrackingConfidence: 0.55,
    });
    mpHands.onResults(onResults);
}


function onResults(results) {
    frameCount++;
    const now = performance.now();
    if (now-lastFpsTime >= 1000) {
        currentFps=frameCount; frameCount=0; lastFpsTime=now;
        document.getElementById('fps-value').textContent = currentFps;
    }

    const canvas = document.getElementById('hand-overlay');
    const video = document.getElementById('webcam');
    canvas.width = video.videoWidth||640;
    canvas.height = video.videoHeight||480;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0,0,canvas.width,canvas.height);

    handData = [];

    if (results.multiHandLandmarks?.length > 0) {
        document.getElementById('hands-value').textContent = results.multiHandLandmarks.length;

        for (let h=0; h<results.multiHandLandmarks.length; h++) {
            const lm = results.multiHandLandmarks[h];
            const label = results.multiHandedness?.[h]?.label || 'Unknown';
            handData.push({ landmarks:lm, handedness:label });

            drawHand(ctx, lm, canvas.width, canvas.height, h);

            // Trails on fingertips
            for (const tid of TIP) {
                const l=lm[tid];
                spawnTrail((l.x-0.5)*4, -(l.y-0.5)*4, -l.z*2, h===0?0x7c6aff:0x22d3ee);
            }

            // Detect + show gestures
            const gestures = detectGestures(lm, label);
            updateFingerStatus(lm);

            if (gestures.length > 0) {
                showGestureTags(gestures);
                const wrist = lm[0];
                for (const g of gestures) {
                    spawnRipple((wrist.x-0.5)*4, -(wrist.y-0.5)*4, 0.3, G[g]?.color||0xffffff);
                }
            }
        }
    } else {
        document.getElementById('hands-value').textContent = '0';
        clearFingerStatus();
    }
}


function drawHand(ctx, lm, w, h, hIdx) {
    const c = hIdx===0 ? '#7c6aff' : '#22d3ee';
    const glow = hIdx===0 ? 'rgba(124,106,255,0.3)' : 'rgba(34,211,238,0.3)';

    ctx.strokeStyle=c; ctx.lineWidth=2;
    ctx.shadowColor=glow; ctx.shadowBlur=10;

    for (const [a,b] of CONN) {
        ctx.beginPath(); ctx.moveTo(lm[a].x*w, lm[a].y*h);
        ctx.lineTo(lm[b].x*w, lm[b].y*h); ctx.stroke();
    }

    ctx.shadowBlur=0;
    for (let i=0; i<lm.length; i++) {
        const isTip = TIP.includes(i);
        ctx.beginPath(); ctx.arc(lm[i].x*w, lm[i].y*h, isTip?5:2.5, 0, Math.PI*2);
        ctx.fillStyle = isTip ? '#34d399' : c; ctx.fill();
        if (isTip) {
            ctx.beginPath(); ctx.arc(lm[i].x*w, lm[i].y*h, 14, 0, Math.PI*2);
            ctx.fillStyle = 'rgba(52,211,153,0.1)'; ctx.fill();
        }
    }
}


// ═══════════════════════════════════════════════════════════════
//  GESTURE DETECTION — IMPROVED ACCURACY
// ═══════════════════════════════════════════════════════════════

function isUp(lm, f) {
    if (f === 0) {
        // Thumb: compare tip x vs IP joint x relative to wrist
        // For right hand: thumb tip should be further left (lower x)
        // For left hand: opposite
        // Use absolute distance from wrist as a simpler heuristic
        const wristX = lm[0].x;
        const tipDist = Math.abs(lm[4].x - wristX);
        const ipDist = Math.abs(lm[3].x - wristX);
        return tipDist > ipDist * 1.15;
    }
    // Other fingers: tip above PIP (y is inverted in screen space)
    return lm[TIP[f]].y < lm[PIP[f]].y - 0.02;
}

function isCurled(lm, f) {
    if (f === 0) return !isUp(lm, 0);
    // Finger is curled if tip is below MCP
    return lm[TIP[f]].y > lm[MCP[f]].y;
}

function dist(a, b) {
    return Math.sqrt((a.x-b.x)**2 + (a.y-b.y)**2);
}

function fingerStates(lm) {
    return [isUp(lm,0), isUp(lm,1), isUp(lm,2), isUp(lm,3), isUp(lm,4)];
}

let lastGTime = {};

function detectGestures(lm, hand) {
    const now = Date.now();
    const [thu, idx, mid, rng, pnk] = fingerStates(lm);
    const detected = [];

    // Priority order matters — most specific first

    // ── THUMBS UP / DOWN ──
    if (thu && !idx && !mid && !rng && !pnk) {
        // Check thumb direction: tip above or below thumb MCP
        if (lm[4].y < lm[2].y - 0.04) {
            detected.push('thumbs_up');
        } else if (lm[4].y > lm[2].y + 0.04) {
            detected.push('thumbs_down');
        }
    }

    // ── PEACE ✌ ──
    if (!thu && idx && mid && !rng && !pnk) {
        // Extra: index and middle should be spread apart
        const spread = dist(lm[8], lm[12]);
        if (spread > 0.04) detected.push('peace');
    }

    // ── MIDDLE FINGER ──
    if (!thu && !idx && mid && !rng && !pnk) {
        detected.push('middle_finger');
    }

    // ── ROCK 🤘 ──
    if (idx && !mid && !rng && pnk) {
        detected.push('rock');
    }

    // ── SPIDERMAN ──
    if (thu && idx && !mid && !rng && pnk) {
        detected.push('spiderman');
    }

    // ── CALL ME 🤙 ──
    if (thu && !idx && !mid && !rng && pnk) {
        detected.push('call_me');
    }

    // ── THREE ──
    if (!thu && idx && mid && rng && !pnk) {
        detected.push('three');
    }

    // ── OK 👌 ──
    const thumbIndexDist = dist(lm[4], lm[8]);
    if (thumbIndexDist < 0.055 && mid && rng && pnk) {
        detected.push('ok');
    }

    // ── PINCH 🤏 ──
    if (thumbIndexDist < 0.055 && !detected.includes('ok')) {
        detected.push('pinch');
    }

    // ── OPEN PALM ──
    if (thu && idx && mid && rng && pnk) {
        detected.push('open_palm');
    }

    // ── FIST ──
    if (!thu && !idx && !mid && !rng && !pnk) {
        detected.push('fist');
    }

    // ── POINTING ──
    if (!thu && idx && !mid && !rng && !pnk) {
        detected.push('pointing');
    }

    // Flash + log with cooldown
    for (const g of detected) {
        const key = `${hand}_${g}`;
        if (!lastGTime[key] || now-lastGTime[key] > 1000) {
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


// ── UI ─────────────────────────────────────────────────────────

function showGestureTags(gestures) {
    const el = document.getElementById('gesture-display');
    el.innerHTML = '';
    for (const g of gestures) {
        const info = G[g];
        if (!info) continue;
        const tag = document.createElement('div');
        tag.className = 'gesture-tag';
        tag.setAttribute('data-g', g);
        tag.innerHTML = `<span class="tag-dot"></span>${info.label}`;
        el.appendChild(tag);
    }
}


function updateFingerStatus(lm) {
    const up = fingerStates(lm);
    for (let f=0; f<5; f++) {
        const el = document.getElementById(`f-${FNAMES[f]}`);
        if (!el) continue;
        el.textContent = `${FLABELS[f]} ${up[f]?'UP':'DN'}`;
        el.className = `finger ${up[f]?'up':'down'}`;
    }
}

function clearFingerStatus() {
    for (let f=0; f<5; f++) {
        const el = document.getElementById(`f-${FNAMES[f]}`);
        if (el) { el.textContent=`${FLABELS[f]} \u2014`; el.className='finger'; }
    }
    document.getElementById('gesture-display').innerHTML =
        '<span class="gesture-placeholder">No hands in frame</span>';
}


// ── Camera ─────────────────────────────────────────────────────

async function startCamera() {
    const video = document.getElementById('webcam');
    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            video: { width:640, height:480, facingMode:'user' }
        });
        video.srcObject = stream;
        await video.play();

        initMediaPipe();
        mpCamera = new Camera(video, {
            onFrame: async () => { await mpHands.send({image:video}); },
            width:640, height:480,
        });
        mpCamera.start();
        cameraRunning = true;

        const ind = document.getElementById('connection-indicator');
        ind.classList.remove('disconnected'); ind.classList.add('connected');
        document.getElementById('connection-text').textContent = 'Active';
        document.getElementById('btn-start').textContent = 'Running...';
        document.getElementById('btn-start').disabled = true;
        addEventLog('Camera started');
    } catch(err) {
        console.error('Camera error:', err);
        addEventLog('Camera access denied');
    }
}

function stopCamera() {
    if (mpCamera) { mpCamera.stop(); mpCamera=null; }
    cameraRunning = false;
    const v = document.getElementById('webcam');
    if (v.srcObject) { v.srcObject.getTracks().forEach(t=>t.stop()); v.srcObject=null; }
    handData = [];
    const ind = document.getElementById('connection-indicator');
    ind.classList.remove('connected'); ind.classList.add('disconnected');
    document.getElementById('connection-text').textContent = 'Offline';
    document.getElementById('btn-start').textContent = 'Start Camera';
    document.getElementById('btn-start').disabled = false;
    addEventLog('Camera stopped');
}

function toggleCameraSize() {
    document.getElementById('camera-panel').classList.toggle('expanded');
}

function flashGesture(text) {
    const el = document.getElementById('gesture-flash');
    el.textContent = text;
    el.classList.remove('hidden'); el.classList.add('visible');
    if (gestureFlashTimer) clearTimeout(gestureFlashTimer);
    gestureFlashTimer = setTimeout(() => {
        el.classList.remove('visible'); el.classList.add('hidden');
    }, 600);
}

function addEventLog(msg) {
    const t = new Date().toLocaleTimeString('en-US', {hour12:false});
    eventLog.unshift({time:t, message:msg});
    if (eventLog.length>40) eventLog.pop();
    document.getElementById('event-log').innerHTML = eventLog.slice(0,15).map(e =>
        `<div class="event-entry"><span class="time">${e.time}</span> <span class="ev">${e.message}</span></div>`
    ).join('');
}


// ── Render Loop ────────────────────────────────────────────────

function animate(time) {
    requestAnimationFrame(animate);
    updateSphere(time*0.001);
    updateEffects();
    controls.update();
    renderer.render(scene, camera);
}


// ── Boot ───────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
    initThreeJS();
    animate(0);

    // ── Logo typewriter ──
    const logoTW = new Typewriter(document.getElementById('typewriter-text'), { speed: 80 });
    logoTW
        .type('Spatial_Tracer')
        .wait(3000)
        .clear()
        .type('Air Gesture Engine')
        .wait(2500)
        .clear()
        .type('by Biswadeep Tewari')
        .wait(2500)
        .clear()
        .loop()
        .start();

    // ── Bio typewriter ──
    const bioEl = document.getElementById('about-bio');
    const bioTW = new Typewriter(bioEl, { speed: 25 });
    bioTW
        .type('Full-Stack & AI/ML Engineer')
        .wait(1800)
        .clear()
        .type('Python . Dart . Kotlin . JS')
        .wait(1800)
        .clear()
        .type('FastAPI . Django . Flutter')
        .wait(1800)
        .clear()
        .type('LangChain . PyTorch . RAG')
        .wait(1800)
        .clear()
        .type('MAKAUT University, West Bengal')
        .wait(1800)
        .clear()
        .type('build > ship > learn > repeat')
        .wait(2000)
        .clear()
        .loop()
        .start();

    addEventLog('Spatial_Tracer initialized');
    addEventLog('Click Start Camera to begin');
});
