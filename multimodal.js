(function() {
    const canvas = document.getElementById('multimodal-canvas') || document.getElementById('c');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const DPR = window.devicePixelRatio || 1;
    const CW = 680,
        CH = 250;
    canvas.width = CW * DPR;
    canvas.height = CH * DPR;
    canvas.style.width = CW + 'px';
    canvas.style.height = CH + 'px';
    ctx.scale(DPR, DPR);

    function scaleCanvas() {
        const wrapper = canvas.parentElement;
        if (!wrapper) return;
        const available = wrapper.clientWidth;
        const scale = Math.min(1, available / CW);
        canvas.style.width = Math.round(CW * scale) + 'px';
        canvas.style.height = Math.round(CH * scale) + 'px';
    }
    scaleCanvas();
    window.addEventListener('resize', scaleCanvas);

    // ── Panels ───────────────────────────────────────────────────────
    const SLIDE = {
        x: 24,
        y: 20,
        w: 128,
        h: 128
    };
    const PATCHES = {
        x: 196,
        y: 20,
        w: 128,
        h: 128
    };
    const EMB = {
        x: 370,
        y: 20,
        w: 130,
        h: 188
    };
    const RISK = {
        x: 554,
        y: 20,
        w: 90,
        h: 128
    };

    // ── H&E tissue (pre-computed) ────────────────────────────────────
    const TILE = 4;
    const TCOLS = SLIDE.w / TILE; // 40
    const TROWS = SLIDE.h / TILE; // 40

    function nz(x, y) {
        return Math.sin(x * 0.31 + y * 0.17) * 0.40 +
            Math.sin(x * 0.13 - y * 0.29) * 0.30 +
            Math.sin(x * 0.47 + y * 0.43) * 0.20 +
            Math.sin(x * 0.07 + y * 0.61) * 0.10;
    }

    function heColor(v) {
        const n = (v + 1) / 2;
        if (n < 0.30) return null; // background (no tissue)
        if (n < 0.42) return '#eebcd2';
        if (n < 0.54) return '#d278a4';
        if (n < 0.66) return '#b85a8c';
        if (n < 0.78) return '#9660bc';
        if (n < 0.88) return '#7048aa';
        return '#4a3090';
    }
    const tissue = Array.from({
            length: TROWS
        }, (_, r) =>
        Array.from({
            length: TCOLS
        }, (_, c) => heColor(nz(c, r)))
    );

    // ── Patch grid ───────────────────────────────────────────────────
    const PGRID = 4;
    const PW = SLIDE.w / PGRID; // 40
    const PH = SLIDE.h / PGRID;

    // Select only patches that contain enough foreground tissue tiles.
    const TISSUE_THRESHOLD = 0.25; // ≥25% of tiles must be foreground

    function patchTissueFraction(pidx) {
        const pr = Math.floor(pidx / PGRID),
            pc = pidx % PGRID;
        const r0 = Math.floor((pr * PH) / TILE);
        const r1 = Math.min(TROWS, Math.ceil(((pr + 1) * PH) / TILE));
        const c0 = Math.floor((pc * PW) / TILE);
        const c1 = Math.min(TCOLS, Math.ceil(((pc + 1) * PW) / TILE));
        let count = 0,
            total = 0;
        for (let r = r0; r < r1; r++)
            for (let c = c0; c < c1; c++) {
                total++;
                if (tissue[r][c] !== null) count++;
            }
        return total === 0 ? 0 : count / total;
    }

    const ALL_PATCHES = Array.from({
        length: PGRID * PGRID
    }, (_, i) => i);
    const SELECTED = ALL_PATCHES.filter(i => patchTissueFraction(i) >= TISSUE_THRESHOLD);

    // Pre-computed embeddings (one per selected tissue patch × 10 dims)
    const EMB_DIMS = 10;
    const embVecs = SELECTED.map(pidx =>
        Array.from({
            length: EMB_DIMS
        }, (_, d) => {
            const v = Math.sin(pidx * 1.73 + d * 2.31) * 0.5 +
                Math.cos(pidx * 0.97 - d * 1.13) * 0.5;
            return (v + 1) / 2;
        })
    );

    const RISK_SCORE = 0.3;

    // ── Utils ────────────────────────────────────────────────────────
    function ease(t) {
        return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
    }

    function lerp(a, b, t) {
        return a + (b - a) * t;
    }

    function clamp01(x) {
        return Math.max(0, Math.min(1, x));
    }

    function pp(now, s, e) {
        return ease(clamp01((now - s) / (e - s)));
    }

    // ── Particle system ──────────────────────────────────────────────
    let particles = [];

    function tickParticles(elapsed) {
        if (SELECTED.length === 0) return;

        if (elapsed > 3300 && elapsed < 4700) {
            for (let i = 0; i < 2; i++) {
                if (Math.random() > 0.45) continue;
                const sel = SELECTED[Math.floor(Math.random() * SELECTED.length)];
                particles.push({
                    x: PATCHES.x + (sel % PGRID) * PW + PW / 2 + (Math.random() - 0.5) * 10,
                    y: PATCHES.y + Math.floor(sel / PGRID) * PH + PH / 2 + (Math.random() - 0.5) * 10,
                    tx: EMB.x + 10 + Math.random() * (EMB.w - 20),
                    ty: EMB.y + 10 + Math.random() * (EMB.h - 20),
                    life: 0,
                    dur: 0.55 + Math.random() * 0.45,
                    hue: 200 + Math.random() * 140,
                    r: 3 + Math.random() * 2,
                });
            }
        }
        particles = particles.filter(p => {
            p.life += 1 / 60;
            return p.life < p.dur;
        });
        particles.forEach(p => {
            const t = ease(p.life / p.dur);
            ctx.save();
            ctx.globalAlpha = Math.sin(Math.PI * p.life / p.dur) * 0.75;
            ctx.fillStyle = `hsl(${p.hue}, 70%, 65%)`;
            ctx.beginPath();
            ctx.arc(lerp(p.x, p.tx, t), lerp(p.y, p.ty, t), p.r, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        });
    }

    // ── Draw tissue ──────────────────────────────────────────────────
    function drawTissue(ox, oy, alpha) {
        if (alpha <= 0) return;
        ctx.save();
        ctx.globalAlpha = alpha;
        // Background (slide glass)
        ctx.fillStyle = '#f0ecee';
        ctx.fillRect(ox, oy, SLIDE.w, SLIDE.h);
        // Foreground tissue tiles only
        for (let r = 0; r < TROWS; r++)
            for (let c = 0; c < TCOLS; c++) {
                if (tissue[r][c] === null) continue;
                ctx.fillStyle = tissue[r][c];
                ctx.fillRect(ox + c * TILE, oy + r * TILE, TILE, TILE);
            }
        ctx.strokeStyle = 'rgba(200,200,200,0.25)';
        ctx.lineWidth = 1;
        ctx.strokeRect(ox, oy, SLIDE.w, SLIDE.h);
        ctx.restore();
    }

    // ── Draw patch grid lines ────────────────────────────────────────
    function drawGrid(ox, oy, p) {
        if (p <= 0) return;
        ctx.save();
        ctx.strokeStyle = `rgba(255,200,60,${p * 0.9})`;
        ctx.lineWidth = 1;
        for (let r = 1; r < PGRID; r++) {
            const lp = ease(clamp01(p * PGRID - (r - 1)));
            ctx.beginPath();
            ctx.moveTo(ox, oy + r * PH);
            ctx.lineTo(ox + SLIDE.w * lp, oy + r * PH);
            ctx.stroke();
        }
        for (let c = 1; c < PGRID; c++) {
            const lp = ease(clamp01(p * PGRID - (c - 1)));
            ctx.beginPath();
            ctx.moveTo(ox + c * PW, oy);
            ctx.lineTo(ox + c * PW, oy + SLIDE.h * lp);
            ctx.stroke();
        }
        ctx.restore();
    }

    // ── Patch highlights ─────────────────────────────────────────────
    function drawHighlights(ox, oy, p) {
        if (p <= 0) return;
        SELECTED.forEach((pidx, i) => {
            const ip = ease(clamp01(p * SELECTED.length - i));
            if (ip <= 0) return;
            const r = Math.floor(pidx / PGRID),
                c = pidx % PGRID;
            ctx.save();
            ctx.globalAlpha = ip * 0.38;
            ctx.fillStyle = '#ffcc00';
            ctx.fillRect(ox + c * PW + 1, oy + r * PH + 1, PW - 2, PH - 2);
            ctx.globalAlpha = ip;
            ctx.strokeStyle = '#ffcc00';
            ctx.lineWidth = 1.5;
            ctx.strokeRect(ox + c * PW + 1, oy + r * PH + 1, PW - 2, PH - 2);
            ctx.restore();
        });
    }

    // ── Embedding bars ───────────────────────────────────────────────
    function drawEmbeddings(p) {
        if (p <= 0) return;
        const {
            x: ex,
            y: ey,
            w: ew,
            h: eh
        } = EMB;
        const slotH = eh / SELECTED.length;
        const barMaxW = ew - 18;

        embVecs.forEach((vec, i) => {
            const ip = ease(clamp01(p * SELECTED.length - i));
            if (ip <= 0) return;
            const topY = ey + i * slotH + slotH * 0.12;
            const barH = slotH * 0.62;
            const dimW = barMaxW / EMB_DIMS;

            vec.forEach((val, d) => {
                const h = barH * val * ip;
                const hue = lerp(210, 330, val);
                ctx.fillStyle = `hsla(${hue},80%,75%,${ip * 0.95})`;
                ctx.fillRect(ex + 14 + d * dimW, topY + barH - h, dimW * 0.78, h);
            });

        });

        ctx.save();
        ctx.globalAlpha = clamp01(p) * 0.18;
        ctx.strokeStyle = '#ccc';
        ctx.lineWidth = 1;
        ctx.strokeRect(ex, ey, ew, eh);
        ctx.restore();
    }

    // ── Risk gauge ───────────────────────────────────────────────────
    function drawRisk(p) {
        if (p <= 0) return;
        const {
            x: rx,
            y: ry,
            w: rw,
            h: rh
        } = RISK;
        const score = RISK_SCORE * p;
        const bw = rw * 0.40;
        const bx = rx + (rw - bw) / 2;

        ctx.save();
        ctx.globalAlpha = p;

        // Track
        ctx.fillStyle = 'rgba(255,255,255,0.15)';
        ctx.fillRect(bx, ry, bw, rh);

        // Gradient fill: grey (low risk) → goldenrod (high risk)
        const fillH = rh * score;
        const grad = ctx.createLinearGradient(0, ry + rh, 0, ry);
        grad.addColorStop(0.0, '#CCCCCC');
        grad.addColorStop(0.10, '#DAA520');
        grad.addColorStop(1.0, '#DAA520');
        ctx.fillStyle = grad;
        ctx.fillRect(bx, ry + rh - fillH, bw, fillH);

        // Border
        ctx.strokeStyle = 'rgba(255,255,255,0.4)';
        ctx.lineWidth = 1;
        ctx.strokeRect(bx, ry, bw, rh);

        // Tick labels
        [{
            lbl: 'HIGH',
            pos: 0.05
        }, {
            lbl: 'LOW',
            pos: 0.95
        }].forEach(({
            lbl,
            pos
        }) => {
            const ty = ry + rh * pos;
            ctx.globalAlpha = p * 0.75;
            ctx.strokeStyle = '#aaa';
            ctx.lineWidth = 0.5;
            ctx.beginPath();
            ctx.moveTo(bx + bw, ty);
            ctx.lineTo(bx + bw + 5, ty);
            ctx.stroke();
            ctx.fillStyle = '#bbb';
            ctx.font = '13px Helvetica';
            ctx.textAlign = 'left';
            ctx.fillText(lbl, bx + bw + 8, ty + 2.5);
        });

        // Score
        ctx.globalAlpha = p;
        ctx.fillStyle = score > 0.10 ? '#c8960c' : '#888';
        ctx.font = 'bold 18px Helvetica';
        ctx.textAlign = 'center';
        ctx.fillText(`${Math.round(score * 100)}%`, rx + rw / 2, ry + rh + 30);

        if (score > 0.10) {
            ctx.globalAlpha = p * clamp01((score - 0.10) / 0.04);
            ctx.fillStyle = '#c8960c';
            ctx.font = '13px Helvetica';
            ctx.letterSpacing = '0.05em';
            ctx.fillText('HIGH RISK', rx + rw / 2, ry + rh + 44);
        }
        ctx.restore();
    }

    // ── Arrow ────────────────────────────────────────────────────────
    function drawArrow(x1, y1, x2, y2, p) {
        if (p <= 0) return;
        const ex = lerp(x1, x2, p),
            ey = lerp(y1, y2, p);
        ctx.save();
        ctx.globalAlpha = p * 0.85;
        ctx.strokeStyle = '#aaa';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 3]);
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(ex, ey);
        ctx.stroke();
        ctx.setLineDash([]);
        if (p > 0.88) {
            ctx.globalAlpha = ((p - 0.88) / 0.12) * 0.9;
            ctx.fillStyle = '#aaa';
            const angle = Math.atan2(y2 - y1, x2 - x1);
            ctx.save();
            ctx.translate(ex, ey);
            ctx.rotate(angle);
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(-7, -3.5);
            ctx.lineTo(-7, 3.5);
            ctx.closePath();
            ctx.fill();
            ctx.restore();
        }
        ctx.restore();
    }

    // ── Panel label ──────────────────────────────────────────────────
    function panelLabel(text, cx, y, alpha) {
        if (alpha <= 0) return;
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.fillStyle = '#ccc';
        ctx.font = '14px Helvetica';
        ctx.textAlign = 'center';
        ctx.fillText(text, cx, y);
        ctx.restore();
    }


    // ── Animation loop ───────────────────────────────────────────────
    const CYCLE = 9800;
    let t0 = null;

    function frame(ts) {
        if (!t0) t0 = ts;
        const elapsed = (ts - t0) % CYCLE;
        const fade = elapsed > 8800 ? 1 - (elapsed - 8800) / 1000 : 1;
        if (elapsed < 50 && ts > t0 + 100) particles = []; // clear on loop restart

        ctx.clearRect(0, 0, CW, CH);
        ctx.fillStyle = '#1a1a1a';
        ctx.fillRect(0, 0, CW, CH);

        // Multiply phase progress by fade so everything fades out together
        const slideP = pp(elapsed, 0, 900) * fade;
        const gridP = pp(elapsed, 900, 2100) * fade;
        const hlP = pp(elapsed, 2100, 3300) * fade;
        const embP = pp(elapsed, 3300, 4900) * fade;
        const riskP = pp(elapsed, 4900, 6700) * fade;

        const midSlide = SLIDE.y + SLIDE.h / 2;
        const midPatches = PATCHES.y + PATCHES.h / 2;
        const midEmb = EMB.y + EMB.h / 2;
        const midRisk = RISK.y + RISK.h / 2;

        // WSI slide
        drawTissue(SLIDE.x, SLIDE.y, slideP);
        panelLabel('H&E Slide', SLIDE.x + SLIDE.w / 2, SLIDE.y + SLIDE.h + 20, slideP);

        // Arrow 1
        drawArrow(SLIDE.x + SLIDE.w + 5, midSlide, PATCHES.x - 5, midPatches, slideP);

        // Patched slide
        drawTissue(PATCHES.x, PATCHES.y, gridP);
        drawGrid(PATCHES.x, PATCHES.y, gridP);
        drawHighlights(PATCHES.x, PATCHES.y, hlP);
        panelLabel('Patch Extraction', PATCHES.x + PATCHES.w / 2, PATCHES.y + PATCHES.h + 20, gridP);

        // Arrow 2
        drawArrow(PATCHES.x + PATCHES.w + 5, midPatches, EMB.x - 5, midPatches, gridP);

        // Particles (encode phase)
        tickParticles(elapsed);

        // Embeddings
        drawEmbeddings(embP);
        panelLabel('Patch Embeddings', EMB.x + EMB.w / 2, EMB.y + EMB.h + 20, embP);

        // Arrow 3
        drawArrow(EMB.x + EMB.w + 5, midRisk, RISK.x - 5, midRisk, embP);

        // Risk gauge
        drawRisk(riskP);
        panelLabel('Risk Score', RISK.x + RISK.w / 2, RISK.y + RISK.h + 62, riskP);

        if (visible) requestAnimationFrame(frame);
    }

    let visible = false;
    window.addEventListener('load', scaleCanvas);

    const observer = new IntersectionObserver(entries => {
        visible = entries[0].isIntersecting;
        if (visible) {
            scaleCanvas();
            requestAnimationFrame(frame);
        }
    }, { threshold: 0 });
    observer.observe(canvas);
})();