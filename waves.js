const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');

const DPR = Math.max(1, window.devicePixelRatio || 1);

// --- Tunable constants ---
const LAYER_COUNT = 16; // previous: 20
const BASE_ALPHA = 0.05; // overall opacity baseline
const ALPHA_STEP = 0.004; // per-layer opacity increase
const ALPHA_FLICKER = 0.03; // subtle time-varying alpha
const LAG_MIN = 0.07; // previous: 0.02
const LAG_MAX = 0.10;
const Y_LAYER_GAP = 9; // 15
const X_STEP_PX = 20; // nominal x step (will be scaled by DPR)
const NOISE_TIME_SPEED = 2.0; // wave scroll speed
const AMP_MOUSE_Y_INFL = 0.02; // mouse Y influence
const AMP_SCALE = 1.4; // global amp multiplier
const DRIFT_SPEED = 0.0005; // amp field horizontal drift
const PULSE_SPEED = 0.0005; // amp field vertical pulsing
const WAVE_SCROLL_PX_PER_SEC = 1.3; // try 2–10 for subtle motion

// --- Wave state functions for transitions ---
function captureWaveState() {
    return {
        timeMs: timeMs,
        mouse: {
            ...mouse
        },
        smoothedMouseByLayer: smoothedMouseByLayer.map(layer => ({
            ...layer
        }))
    };
}

function restoreWaveState(state) {
    if (state) {
        timeMs = state.timeMs;
        mouse = {
            ...state.mouse
        };
        state.smoothedMouseByLayer.forEach((layer, i) => {
            if (smoothedMouseByLayer[i]) {
                smoothedMouseByLayer[i] = {
                    ...layer
                };
            }
        });
    }
}

function freezeWaves() {
    // Stop the animation loop
    animating = false;
    // Capture current state and store in sessionStorage
    const state = captureWaveState();
    sessionStorage.setItem('waveState', JSON.stringify(state));
}

// --- Size helpers ---
function resizeCanvas() {
    const cssW = window.innerWidth;
    const cssH = window.innerHeight;
    canvas.style.width = cssW + 'px';
    canvas.style.height = cssH + 'px';
    canvas.width = Math.floor(cssW * DPR);
    canvas.height = Math.floor(cssH * DPR);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0); // draw in CSS pixels
}
resizeCanvas();

let timeMs = 0;
let mouse = {
    x: canvas.width / DPR / 2,
    y: canvas.height / DPR / 2
};
const smoothedMouseByLayer = Array.from({
    length: LAYER_COUNT
}, () => ({
    x: mouse.x,
    y: mouse.y
}));

// Check if we're restoring from a previous page
const savedState = sessionStorage.getItem('waveState');
if (savedState) {
    try {
        restoreWaveState(JSON.parse(savedState));
    } catch (e) {
        console.log('Could not restore wave state:', e);
    }
}

window.addEventListener('mousemove', (e) => {
    mouse.x = e.clientX;
    mouse.y = e.clientY;
}, {
    passive: true
});

// Touch support (optional)
// window.addEventListener('pointermove', (e) => { mouse.x = e.clientX; mouse.y = e.clientY; }, { passive: true });

function noise(x) {
    return Math.sin(x * 0.01) + Math.sin(x * 0.005 + 3) * 0.5;
}

// amplitude varies across X and over time
function ampAtX(x, tMs) {

    const t = tMs / 1000;
    const w = canvas.width / DPR;
    const tx = x / w;
    const timeShift = t * DRIFT_SPEED;
    const lobe = (center, width, gain, phase) =>
        Math.exp(-Math.pow((tx - (center + Math.sin(timeShift + phase) * 0.2)) / width, 2)) *
        gain *
        (0.8 + 0.2 * Math.sin(t * PULSE_SPEED + phase * 2));

    const profile =
        lobe(0.20, 0.12, 0.8, 0) +
        lobe(0.50, 0.10, 1.2, 1) +
        lobe(0.80, 0.12, 0.9, 2);

    return 12 + profile * 28; // baseline + extra
}

function drawLayer(yBase, layerIndex, timeOffset, influence) {
    ctx.beginPath();
    const w = canvas.width / DPR;
    const step = Math.max(4, Math.floor(X_STEP_PX)); // keep >=4px for smoothness

    for (let x = 0; x <= w; x += step) {
        const offsetY = yBase + (influence.y - (canvas.height / DPR) / 2) * 0.1;
        const amp = ampAtX(x, timeMs) * AMP_SCALE + influence.y * AMP_MOUSE_Y_INFL;
        // const y = offsetY + noise((x + timeMs / 1000 * NOISE_TIME_SPEED * 60) + timeOffset) * amp;
        const timeSec = timeMs / 20;
        const y = offsetY + noise((x + timeSec * WAVE_SCROLL_PX_PER_SEC) + timeOffset) * amp;

        if (x === 0) {
            ctx.moveTo(x, y);
        } else {
            ctx.lineTo(x, y);
        }
    }

    ctx.lineTo(w, canvas.height / DPR);
    ctx.lineTo(0, canvas.height / DPR);
    ctx.closePath();

    // precompute alpha per layer + subtle flicker
    const a = (BASE_ALPHA + layerIndex * ALPHA_STEP + noise(timeMs * 0.001) * ALPHA_FLICKER);
    ctx.fillStyle = `rgba(255, 255, 255, ${Math.max(0, Math.min(1, a))})`;
    ctx.fill();
}

function drawLayerLine(yBase, layerIndex, timeOffset, influence) {
    ctx.beginPath();
    const w = canvas.width / DPR;
    const step = Math.max(4, Math.floor(X_STEP_PX));

    ctx.lineWidth = 0.5 + layerIndex * 0.05; // thin → thicker
    ctx.lineCap = 'round'; // smoother joins

    for (let x = 0; x <= w; x += step) {
        const offsetY = yBase + (influence.y - (canvas.height / DPR) / 2) * 0.1;
        const amp = ampAtX(x, timeMs) * AMP_SCALE + influence.y * AMP_MOUSE_Y_INFL;
        const timeSec = timeMs / 20;
        const y = offsetY + noise((x + timeSec * WAVE_SCROLL_PX_PER_SEC) + timeOffset) * amp;

        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    }

    // Instead of closing the shape & filling, just draw the path as a line
    ctx.strokeStyle = `rgba(255, 255, 255, ${
    BASE_ALPHA * 6 + layerIndex * ALPHA_STEP + noise(timeMs * 0.001) * ALPHA_FLICKER
  })`;
    // ctx.lineWidth = 1; // tweak if you want thicker lines
    ctx.stroke();
}

let animating = true;
let lastTs = performance.now();

function animate(ts) {
    if (!animating) return; // Stop animation if frozen

    const dt = Math.min(50, ts - lastTs); // clamp to avoid huge jumps on tab switches
    lastTs = ts;
    timeMs += dt;

    ctx.clearRect(0, 0, canvas.width / DPR, canvas.height / DPR);

    for (let i = 0; i < LAYER_COUNT; i++) {
        const lagFactor = LAG_MIN + (i / LAYER_COUNT) * (LAG_MAX - LAG_MIN);
        smoothedMouseByLayer[i].x += (mouse.x - smoothedMouseByLayer[i].x) * lagFactor;
        smoothedMouseByLayer[i].y += (mouse.y - smoothedMouseByLayer[i].y) * lagFactor;

        const y = (canvas.height / DPR) / 2 + i * Y_LAYER_GAP;
        drawLayerLine(y, i, i * 50, smoothedMouseByLayer[i]);
    }

    requestAnimationFrame(animate);
}
requestAnimationFrame(animate);

let resizeTimer = null;
window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
        resizeCanvas();
        // recenter defaults to avoid jumps
        mouse = {
            x: canvas.width / DPR / 2,
            y: canvas.height / DPR / 2
        };
        for (let i = 0; i < LAYER_COUNT; i++) {
            smoothedMouseByLayer[i].x = mouse.x;
            smoothedMouseByLayer[i].y = mouse.y;
        }
    }, 100);
});

// Export functions for use by other scripts
window.waveControls = {
    freeze: freezeWaves,
    capture: captureWaveState,
    restore: restoreWaveState
};