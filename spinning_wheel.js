//   // Turning line-ring loader (canvas)
function createBasicRingLoader() {
    const canvas = document.getElementById('loadingCanvas');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;

    function resize() {
        const size = Math.min(window.innerWidth, window.innerHeight) * 0.3; // ~30vmin
        canvas.style.width = size + 'px';
        canvas.style.height = size + 'px';
        canvas.width = Math.floor(size * dpr);
        canvas.height = Math.floor(size * dpr);
    }
    resize();
    window.addEventListener('resize', resize);

    let rot = 0;
    const lines = 18;       // number of ellipses
    const speed = 0.02;     // radians/frame

    function draw() {
        const w = canvas.width / dpr, h = canvas.height / dpr;

        // reset + clear
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, w, h);

        // center and rotate the group
        ctx.translate(w / 2, h / 2);
        ctx.rotate(rot);

        // ellipse radii (shape of the ring)
        const rx = w * 0.42, ry = h * 0.28;

        // bundle of rotated ellipses from 0..π
        for (let i = 0; i < lines; i++) {
        const theta = (i / (lines - 1)) * Math.PI;
        const depth = 0.35 + 0.65 * Math.sin(theta); // simple shading
        ctx.beginPath();
        ctx.ellipse(0, 0, rx, ry, theta, 0, Math.PI * 2);
        ctx.lineWidth = 1;
        ctx.strokeStyle = `rgba(255,255,255,${depth})`;
        ctx.stroke();
        }

        rot += speed;
        requestAnimationFrame(draw);
    }

    requestAnimationFrame(draw);
}
    
// Create ring loader from spinning_wheel.js
function createRingLoader() {
    const canvas = document.getElementById('loadingCanvas');
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    
    function resize() {
        const size = Math.min(window.innerWidth, window.innerHeight) * 0.3; // ~30vmin
        canvas.style.width  = size + 'px';
        canvas.style.height = size + 'px';
        canvas.width  = Math.floor(size * dpr);
        canvas.height = Math.floor(size * dpr);
    }
    resize();
    window.addEventListener('resize', resize);
    
    // -------- knobs you can tweak --------
    const LINES        = 20;     // number of ellipses in the band
    const ROT_SPEED    = 1.1;    // rad/s (overall spin)
    const BASE_RX      = 0.42;   // base radii as fraction of canvas
    const BASE_RY      = 0.28;
    
    const PULSE_HZ     = 1.0;    // base breathing frequency (cycles per second)
    const BASE_AMP     = 0.14;   // baseline amplitude (max scale is 1 ± AMP terms)
    
    // amplitude modulation by time & angle (radian position)
    const AMP_TIME_HZ  = 0.33;   // how fast amplitude swells/shrinks over time
    const AMP_ANG_LOBES= 4;      // how many amplitude lobes around the ring
    
    // traveling wave around the ring (independent of spin)
    const TRAVEL_HZ    = 0.5;   // how fast the out-of-phase wave circulates
    
    // smooth "noise" controls (kept subtle so it feels organic, not jittery)
    const NOISE_AMOUNT = 0.50;   // 0..1; ±20% amplitude variation
    const NOISE_SPEED  = 1;    // speed of noise evolution over time
    const NOISE_SCALE  = 2.0;    // spatial scale along the ring (theta direction)
    // -------------------------------------
    
    // simple smooth 2D noise (combination of sines; returns ~[0,1])
    function smoothNoise2D(x, y) {
        const n =
        Math.sin(1.3 * x + 1.7 * y) +
        Math.sin(0.7 * x - 2.3 * y + 1.1) +
        Math.sin(2.1 * x + 0.5 * y - 0.7);
        return 0.5 + 0.5 * (n / 3); // normalize to ~[0,1]
    }
    
    let t0 = undefined;
    let animationActive = true;
    
    function draw(ts) {
        if (!animationActive) return;
        
        if (t0 === undefined) t0 = ts;
        const t = (ts - t0) / 1000; // seconds since start
    
        const w = canvas.width / dpr, h = canvas.height / dpr;
    
        // reset + clear
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, w, h);
    
        // center & rotate the whole bundle
        ctx.translate(w / 2, h / 2);
        ctx.rotate(t * ROT_SPEED);
    
        // phases that evolve over time
        const pulsePhase  = 2 * Math.PI * PULSE_HZ  * t;      // base breathing
        const travelPhase = 2 * Math.PI * TRAVEL_HZ * t;      // wave traveling around ring
        const timeAmpPhase= 2 * Math.PI * AMP_TIME_HZ * t;    // amplitude time modulation
    
        // draw ellipses rotated from 0..π
        for (let i = 0; i < LINES; i++) {
        const theta = (i / (LINES - 1)) * Math.PI; // "radian position" around ring
    
        // --- amplitude as a function of time & theta, plus smooth noise ---
        // start with a baseline amplitude
        let amp = BASE_AMP;
    
        // multiply by time modulation (0..1)
        const timeMod = 0.5 + 0.5 * Math.sin(timeAmpPhase);
        amp *= timeMod;
    
        // multiply by angular modulation (0..1) -> AMP_ANG_LOBES lobes around ring
        const angMod = 0.5 + 0.5 * Math.sin(AMP_ANG_LOBES * theta);
        amp *= angMod;
    
        // add smooth noise as a mild factor around 1.0 -> [1-N, 1+N]
        const n = smoothNoise2D(NOISE_SPEED * t, NOISE_SCALE * theta);
        const noiseFactor = 1 - NOISE_AMOUNT + NOISE_AMOUNT * (2 * n);
        amp *= noiseFactor;
        // ------------------------------------------------------------------
    
        // per-ellipse phase so different parts breathe out of phase
        const phase = pulsePhase + AMP_ANG_LOBES * theta + travelPhase;
    
        // final scale (1 ± amp)
        const scale = 1 + amp * Math.sin(phase);
    
        // radii
        const rx = w * BASE_RX * scale;
        const ry = h * BASE_RY * scale;
    
        // depth shading to suggest 3D (front brighter)
        const alpha = 0.35 + 0.65 * Math.sin(theta);
    
        ctx.beginPath();
        ctx.ellipse(0, 0, rx, ry, theta, 0, Math.PI * 2);
        ctx.lineWidth = 1;
        ctx.strokeStyle = `rgba(255,255,255,${alpha})`;
        ctx.stroke();
        }
    
        // Stop animation when overlay is hidden
        if (document.getElementById('loadingOverlay').style.opacity === '0') {
        animationActive = false;
        } else {
        requestAnimationFrame(draw);
        }
    }
    
    requestAnimationFrame(draw);
}

// Start the ring loader
createRingLoader();

const img = document.getElementById('startupImage');
const loadingOverlay = document.getElementById('loadingOverlay');
const mainContent = document.getElementById('mainContent');

// Function to hide loading screen and show content
function showPageContent() {
// Fade out the loading overlay
loadingOverlay.style.opacity = '0';

// After fade out is done (1s), hide it completely
setTimeout(() => {
    loadingOverlay.style.display = 'none';

    // Now fade in the page content
    mainContent.style.opacity = '1';
    mainContent.style.transform = 'translateY(0)';
}, 1000);
}

// Ensure the image is fully loaded and decoded
if (img.complete) {
img.decode().then(showPageContent).catch(showPageContent);
} else {
img.onload = function() {
    img.decode().then(showPageContent).catch(showPageContent);
};
}
setTimeout(() => {
img.style.opacity = '1';
}, 1200); // 1s for overlay fade + 200ms