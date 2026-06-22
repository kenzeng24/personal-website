(function() {
    // ── Canvas ────────────────────────────────────────────────────────
    const canvas = document.getElementById('km-canvas');
    const ctx = canvas.getContext('2d');
    const DPR = window.devicePixelRatio || 1;
    const CW = 940,
        CH = 470;
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
        if (scale < 1) {
            canvas.style.transform = `scale(${scale})`;
            canvas.style.transformOrigin = 'top left';
            wrapper.style.height = Math.round(CH * scale) + 'px';
        } else {
            canvas.style.transform = '';
            wrapper.style.height = '';
        }
    }
    scaleCanvas();
    window.addEventListener('resize', scaleCanvas);

    // ── Deterministic LCG ─────────────────────────────────────────────
    function makeLCG(seed) {
        let s = seed >>> 0;
        return () => {
            s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
            return s / 0x100000000;
        };
    }

    // ── KM generation ─────────────────────────────────────────────────
    function generateKM(hazard, n, seed) {
        const rand = makeLCG(seed);
        const events = [];
        for (let i = 0; i < n; i++) {
            const t = -Math.log(Math.max(rand(), 1e-12)) / hazard;
            if (t <= 10) events.push(t);
        }
        events.sort((a, b) => a - b);
        let ar = n,
            s = 1.0;
        const steps = [{
            t: 0,
            s: 1.0
        }];
        for (const t of events) {
            s *= (ar - 1) / ar;
            ar--;
            steps.push({
                t,
                s
            });
        }
        steps.push({
            t: 10,
            s
        });
        return steps;
    }

    function sAt(steps, t) {
        let s = 1.0;
        for (const st of steps) {
            if (st.t > t) break;
            s = st.s;
        }
        return s;
    }

    // h_high / h_low = 0.02414 / 0.0085 = 2.84
    const KM_HIGH = generateKM(0.02414, 120, 42);
    const KM_LOW = generateKM(0.0085, 360, 73);
    const popS = t => Math.exp(-0.01054 * t);

    // ── Dot grid (15 × 20 = 300 patients) ────────────────────────────
    const COLS = 15,
        ROWS = 20,
        SP = 14,
        DOT_R = 4.5;
    const GX = 28,
        GY = 88;
    const N = COLS * ROWS; // 300
    const N_HIGH = 75; // 25%

    const jR = makeLCG(789);
    const dots = Array.from({
        length: N
    }, (_, i) => ({
        x: GX + (i % COLS) * SP + (jR() - 0.5) * 2.4,
        y: GY + Math.floor(i / COLS) * SP + (jR() - 0.5) * 2.4,
    }));

    function deterministicShuffle(n, seed) {
        const a = Array.from({
            length: n
        }, (_, i) => i);
        const r = makeLCG(seed);
        for (let i = n - 1; i > 0; i--) {
            const j = Math.floor(r() * (i + 1));
            [a[i], a[j]] = [a[j], a[i]];
        }
        return a;
    }

    const highOrder = deterministicShuffle(N, 123);
    const isHigh = new Uint8Array(N);
    highOrder.slice(0, N_HIGH).forEach(i => {
        isHigh[i] = 1;
    });

    const colorOrder = deterministicShuffle(N, 456);
    const colorPos = new Uint16Array(N);
    colorOrder.forEach((dotIdx, pos) => {
        colorPos[dotIdx] = pos;
    });

    const C_INIT = [0x55, 0x55, 0x55];
    const C_HIGH = [0xDA, 0xA5, 0x20]; // goldenrod
    const C_LOW = [0xCC, 0xCC, 0xCC]; // light grey

    // Dot coloring and unzip start together after pop label fades out
    const COLOR_START = 3000;
    const COLOR_WINDOW = 2000;
    const DOT_TR_DUR = 260;

    // Dot de-coloring starts with the return animation
    const REVERSE_COLOR_START = 9500;
    const REVERSE_COLOR_WINDOW = 1000;

    // ── KM plot layout ────────────────────────────────────────────────
    const PL = 328,
        PT = 65,
        PW = 382,
        PH = 295;
    const PB = PT + PH;
    const PR = PL + PW;

    const px = x => PL + x / 10 * PW;
    const py = y => PB - (y - 0.70) / 0.30 * PH;

    const S_HIGH_10 = sAt(KM_HIGH, 10);
    const S_LOW_10 = sAt(KM_LOW, 10);

    // ── Utilities ─────────────────────────────────────────────────────
    function ease(t) {
        return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
    }

    function clamp01(x) {
        return Math.max(0, Math.min(1, x));
    }

    function pp(now, s, e) {
        return ease(clamp01((now - s) / (e - s)));
    }

    // ── Draw: dot grid ────────────────────────────────────────────────
    function drawDots(elapsed, alpha) {
        if (alpha <= 0) return;
        for (let i = 0; i < N; i++) {
            const d = dots[i];
            const dotStart = COLOR_START + (colorPos[i] / N) * COLOR_WINDOW;
            const revDotStart = REVERSE_COLOR_START + (colorPos[i] / N) * REVERSE_COLOR_WINDOW;
            const fwdT = ease(clamp01((elapsed - dotStart) / DOT_TR_DUR));
            const revT = ease(clamp01((elapsed - revDotStart) / DOT_TR_DUR));
            // fwdT brings colour in; revT brings it back out — net blend stays in [0,1]
            const t = clamp01(fwdT - revT);
            let cr, cg, cb;
            if (t <= 0) {
                [cr, cg, cb] = C_INIT;
            } else {
                const tgt = isHigh[i] ? C_HIGH : C_LOW;
                cr = Math.round(C_INIT[0] + (tgt[0] - C_INIT[0]) * t);
                cg = Math.round(C_INIT[1] + (tgt[1] - C_INIT[1]) * t);
                cb = Math.round(C_INIT[2] + (tgt[2] - C_INIT[2]) * t);
            }
            const r = DOT_R + Math.sin(t * Math.PI) * 2.2;
            ctx.globalAlpha = alpha;
            ctx.fillStyle = `rgb(${cr},${cg},${cb})`;
            ctx.beginPath();
            ctx.arc(d.x, d.y, r, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = 1;
    }

    // ── Draw: dot title + legend ──────────────────────────────────────
    function drawDotMeta(titleA, legendA) {
        if (titleA > 0) {
            ctx.save();
            ctx.globalAlpha = titleA;
            ctx.fillStyle = '#555';
            ctx.font = '15px Helvetica';
            ctx.textAlign = 'left';
            ctx.fillText('Patient population', GX, GY - 18);
            ctx.restore();
        }
        if (legendA > 0) {
            const lx = GX;
            const ly = GY + (ROWS - 1) * SP + DOT_R + 28;
            ctx.save();
            ctx.globalAlpha = legendA;
            ctx.fillStyle = `rgb(${C_HIGH[0]},${C_HIGH[1]},${C_HIGH[2]})`;
            ctx.beginPath();
            ctx.arc(lx + 5, ly, 5, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#333';
            ctx.font = '15px Helvetica';
            ctx.textAlign = 'left';
            ctx.fillText('AI high risk', lx + 15, ly + 4);
            ctx.fillStyle = `rgb(${C_LOW[0]},${C_LOW[1]},${C_LOW[2]})`;
            ctx.beginPath();
            ctx.arc(lx + 5, ly + 20, 5, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#bbb';
            ctx.lineWidth = 0.8;
            ctx.beginPath();
            ctx.arc(lx + 5, ly + 20, 5, 0, Math.PI * 2);
            ctx.stroke();
            ctx.fillStyle = '#333';
            ctx.fillText('AI low risk', lx + 15, ly + 24);
            ctx.restore();
        }
    }

    // ── Draw: axes ────────────────────────────────────────────────────
    function drawAxes(alpha) {
        if (alpha <= 0) return;
        ctx.save();
        ctx.globalAlpha = alpha;

        // Grid lines (slightly darker than #e8e8e8 background)
        [0.7, 0.8, 0.9, 1.0].forEach(y => {
            ctx.strokeStyle = 'rgba(0,0,0,0.12)';
            ctx.lineWidth = 0.75;
            ctx.beginPath();
            ctx.moveTo(PL, py(y));
            ctx.lineTo(PR, py(y));
            ctx.stroke();
        });

        // Frame
        ctx.strokeStyle = '#444';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(PL, PT);
        ctx.lineTo(PL, PB);
        ctx.moveTo(PL, PB);
        ctx.lineTo(PR, PB);
        ctx.stroke();

        // Y ticks + labels
        ctx.fillStyle = '#555';
        ctx.font = '18px Helvetica';
        ctx.textAlign = 'right';
        [0.7, 0.8, 0.9, 1.0].forEach(y => {
            ctx.strokeStyle = '#444';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(PL - 5, py(y));
            ctx.lineTo(PL, py(y));
            ctx.stroke();
            ctx.fillText(y.toFixed(1), PL - 9, py(y) + 4.5);
        });

        // X ticks + labels
        ctx.textAlign = 'center';
        [0, 2, 4, 6, 8, 10].forEach(x => {
            ctx.strokeStyle = '#444';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(px(x), PB);
            ctx.lineTo(px(x), PB + 5);
            ctx.stroke();
            ctx.fillText(x, px(x), PB + 18);
        });

        // Axis titles
        ctx.fillStyle = '#333';
        ctx.font = '18px Helvetica';
        ctx.textAlign = 'center';
        ctx.fillText('Years from diagnosis', PL + PW / 2, PB + 40);
        ctx.save();
        ctx.translate(PL - 62, PT + PH / 2);
        ctx.rotate(-Math.PI / 2);
        ctx.fillText('Probability of no recurrence', 0, 0);
        ctx.restore();

        ctx.font = 'bold 20px Helvetica';
        ctx.fillText('AI Risk Stratification', PL + PW / 2, PT - 22);
        ctx.restore();
    }

    // ── Draw: population reference curve (dashed) ────────────────────
    function drawPopCurve(progress, alpha) {
        if (alpha <= 0 || progress <= 0) return;
        const maxT = 10 * progress;
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.strokeStyle = '#888';
        ctx.lineWidth = 1.8;
        ctx.setLineDash([7, 5]);
        ctx.beginPath();
        ctx.moveTo(px(0), py(1.0));
        for (let i = 1; i <= 150; i++) ctx.lineTo(px(maxT * i / 150), py(popS(maxT * i / 150)));
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
    }

    // ── Draw: pop label (above curve, clear of the line) ─────────────
    function drawPopLabel(alpha) {
        if (alpha <= 0) return;
        const t = 5.5;
        const cy = py(popS(t)); // curve y at t=5.5
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.fillStyle = '#888';
        ctx.font = '18px Helvetica';
        ctx.textAlign = 'left';
        // Place text ABOVE the curve with a 22 px gap
        ctx.fillText('General population', px(t) + 8, cy - 22);
        ctx.fillText('~10% recurrence at 10 years', px(t) + 8, cy - 8);
        ctx.restore();
    }

    // ── Draw: split animation (pop → high/low risk curves) ────────────
    // morphT = 0: both curves sit on the pop curve
    // morphT = 1: curves at their final KM positions, pop gone
    function drawSplitCurves(morphT, alpha) {
        if (alpha <= 0 || morphT <= 0) return;

        // At full morph, switch to crisp step functions
        if (morphT >= 0.99) {
            // Low risk (grey)
            ctx.save();
            ctx.strokeStyle = '#777';
            ctx.lineWidth = 2.0;
            ctx.globalAlpha = alpha;
            ctx.beginPath();
            let curS = KM_LOW[0].s,
                done = false;
            ctx.moveTo(px(0), py(curS));
            for (let i = 1; i < KM_LOW.length; i++) {
                const st = KM_LOW[i];
                ctx.lineTo(px(st.t), py(curS));
                ctx.lineTo(px(st.t), py(st.s));
                curS = st.s;
            }
            if (!done) ctx.lineTo(px(10), py(curS));
            ctx.stroke();
            ctx.restore();

            // High risk (goldenrod)
            ctx.save();
            ctx.strokeStyle = '#DAA520';
            ctx.lineWidth = 2.2;
            ctx.globalAlpha = alpha;
            ctx.beginPath();
            curS = KM_HIGH[0].s;
            done = false;
            ctx.moveTo(px(0), py(curS));
            for (let i = 1; i < KM_HIGH.length; i++) {
                const st = KM_HIGH[i];
                ctx.lineTo(px(st.t), py(curS));
                ctx.lineTo(px(st.t), py(st.s));
                curS = st.s;
            }
            if (!done) ctx.lineTo(px(10), py(curS));
            ctx.stroke();
            ctx.restore();
            return;
        }

        // Unzip wavefront: separation begins at t=10 (right) and sweeps left as morphT 0→1.
        // Cubic ease-in: wavefront barely moves at first, then accelerates sharply leftward.
        const W = 3.5; // wavefront width in data-years
        const warpedMorph = Math.pow(morphT, 3); // cubic ease-in: slow start, fast leftward sweep
        const wavecenter = 10 + W / 2 - warpedMorph * (10 + W);

        function localMorph(dataT) {
            return ease(clamp01(0.5 + (dataT - wavecenter) / W));
        }

        const N_S = 300;

        // Low risk: grey, morphs from popS toward KM_LOW
        ctx.save();
        ctx.strokeStyle = '#777';
        ctx.lineWidth = 2.0;
        ctx.globalAlpha = alpha;
        ctx.beginPath();
        for (let i = 0; i <= N_S; i++) {
            const t = 10 * i / N_S;
            const s = popS(t) + (sAt(KM_LOW, t) - popS(t)) * localMorph(t);
            i === 0 ? ctx.moveTo(px(t), py(s)) : ctx.lineTo(px(t), py(s));
        }
        ctx.stroke();
        ctx.restore();

        // High risk: colour morphs grey → goldenrod as it diverges downward
        const cr = Math.round(136 + (218 - 136) * morphT);
        const cg = Math.round(136 + (165 - 136) * morphT);
        const cb = Math.round(136 + (32 - 136) * morphT);
        ctx.save();
        ctx.strokeStyle = `rgb(${cr},${cg},${cb})`;
        ctx.lineWidth = 2.2;
        ctx.globalAlpha = alpha;
        ctx.beginPath();
        for (let i = 0; i <= N_S; i++) {
            const t = 10 * i / N_S;
            const s = popS(t) + (sAt(KM_HIGH, t) - popS(t)) * localMorph(t);
            i === 0 ? ctx.moveTo(px(t), py(s)) : ctx.lineTo(px(t), py(s));
        }
        ctx.stroke();
        ctx.restore();
    }

    // ── Draw: AI curve labels ─────────────────────────────────────────
    // Both labels placed above their curve — "AI high risk" must go above (not
    // below) because the descending curve overtakes any label placed beneath it.
    function drawCurveLabels(alpha) {
        if (alpha <= 0) return;
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.font = '20px Helvetica';
        ctx.textAlign = 'left';

        const yLow = py(sAt(KM_LOW, 7.0));
        ctx.fillStyle = '#555';
        ctx.fillText('AI low risk', px(7.0) + 6, yLow - 32);

        const yHigh = py(sAt(KM_HIGH, 7.0));
        ctx.fillStyle = '#c8960c';
        ctx.fillText('AI high risk', px(7.0) + 6, yHigh - 32);

        ctx.restore();
    }

    // ── Draw: HR bracket ──────────────────────────────────────────────
    function drawHRAnnotation(alpha) {
        if (alpha <= 0) return;
        const yLow = py(S_LOW_10);
        const yHigh = py(S_HIGH_10);
        const bx = PR + 12,
            arm = 10;
        const midY = (yLow + yHigh) / 2;
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.strokeStyle = '#666';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(PR + 3, yLow);
        ctx.lineTo(bx + arm, yLow);
        ctx.lineTo(bx + arm, yHigh);
        ctx.lineTo(PR + 3, yHigh);
        ctx.stroke();
        ctx.fillStyle = '#333';
        ctx.font = 'bold 20px Helvetica';
        ctx.textAlign = 'left';
        ctx.fillText('2.84x higher risk', bx + arm + 8, midY - 20);
        ctx.font = '18px Helvetica';
        ctx.fillStyle = '#555';
        // ctx.fillText('of recurrence than', bx + arm + 8, midY - 2);
        // ctx.fillText('low risk patients', bx + arm + 8, midY + 16);
        ctx.restore();
    }

    // ── Animation timeline (ms) ───────────────────────────────────────
    //    0– 2000  hold: grey dots + full pop KM curve + pop label visible
    // 2000– 2800  pop label fades out
    // 3000– 5200  dot coloring (grey→orange/grey) AND KM unzip simultaneously
    //             last dot at 3000+2000+260=5260; morphT done at 5500
    // 5000– 6000  AI legend fades in
    // 5500– 6800  AI curve labels fade in
    // 6800– 7800  HR annotation fades in
    // 7800– 9500  hold on final state
    // ── return ────────────────────────────────────────────────────────
    // 9500–10200  curve labels + HR fade out
    // 9500–10700  morph reverses 1→0; dot colours revert
    // 10700–12000  hold on starting config (pop curve always visible); loop
    //   cycle: 12000 ms

    const CYCLE = 12000;
    let t0 = null;

    function render(ts) {
        if (!t0) t0 = ts;
        const el = (ts - t0) % CYCLE;

        ctx.clearRect(0, 0, CW, CH);
        ctx.fillStyle = '#f4f0ea';
        ctx.fillRect(0, 0, CW, CH);

        // morphT: forward 3000→5500, hold, reverse 9500→10700
        let morphT;
        if (el <= 3000) {
            morphT = 0;
        } else if (el <= 5500) {
            morphT = pp(el, 3000, 5500);
        } else if (el <= 9500) {
            morphT = 1;
        } else {
            morphT = 1 - pp(el, 9500, 10700);
        }

        const lblFadeOut = el > 9500 ? pp(el, 9500, 10200) : 0;

        // Pop label: visible from start, fades out before action begins
        // Fade out before the action; fade back in as the return completes
        const popLabelA = Math.max(
            1 - pp(el, 3500, 4500), // fade out (longer hold then slow fade)
            pp(el, 10000, 10700) // fade back in as morphT returns to 0
        );

        // AI legend, curve labels, HR annotation
        const legendA = pp(el, 5000, 6000) * (1 - lblFadeOut);
        const lblA = pp(el, 5500, 6800) * (1 - lblFadeOut);
        const hrA = pp(el, 6800, 7800) * (1 - lblFadeOut);

        // Pop curve fades out as unzip progresses, reappears as morph reverses
        const popCurveA = Math.max(0, 1 - morphT * 2.3);

        drawAxes(1);
        drawDots(el, 1);
        drawDotMeta(1, legendA);
        drawPopCurve(1, popCurveA);
        drawSplitCurves(morphT, morphT);
        drawPopLabel(popLabelA);
        drawCurveLabels(lblA);
        drawHRAnnotation(hrA);

        requestAnimationFrame(render);
    }

    const observer = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting) {
            observer.disconnect();
            requestAnimationFrame(render);
        }
    }, {
        threshold: 0.1
    });
    observer.observe(canvas);
})();