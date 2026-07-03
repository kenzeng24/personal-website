# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Static personal portfolio site for Ken Zeng, deployed via GitHub Pages at `https://kenzeng24.github.io/personal-website/`. No build step, no package manager — all files are plain HTML, CSS, and JavaScript served directly. The `_config.yml` exists solely for GitHub Pages to apply the `jekyll-theme-midnight` theme (it has no other effect on local development).

## Local Development

Open files directly in a browser — no server required for most changes. To test with a local server (needed for certain browser security policies around `sessionStorage` and canvas):

```bash
python3 -m http.server 8080
# then open http://localhost:8080
```

There are no linting tools, test suites, or CI pipelines configured.

## Site Structure

The site is a two-page flow:

1. **`index.html` + `index.css` + `waves.js`** — Landing page. Dark background with an animated canvas wave effect, Mondrian-inspired color strips on the right side, and an "EXPLORE →" button that navigates to `main_page.html`.

2. **`main_page.html` + `main_page.css` + `spinning_wheel.js`** — Portfolio page with a light (`#f4f0ea`) background. Shows a loading overlay with a spinning ring animation until `img/banner.jpg` is decoded, then fades in the main content. Content is laid out in two-column grid sections (`section-2col`: 160px left label + flexible right content). Additional scripts: `site_nav.js` (active nav link highlighting on scroll), `multimodal.js` (canvas diagram on `#multimodal-canvas`), `km.js` (Kaplan-Meier survival curve on `#km-canvas`).

## JavaScript Architecture

**`waves.js`** — Runs on `index.html`. Draws 16 layered sine-wave lines on a full-viewport canvas. Mouse position smoothly influences wave shape (each layer has a different lag factor for a parallax feel). On navigation away, `window.waveControls.freeze()` serializes animation state to `sessionStorage` so it can resume seamlessly if the user returns. Exposes `window.waveControls` (`freeze`, `capture`, `restore`).

**`spinning_wheel.js`** — Runs on `main_page.html`. Draws a rotating bundle of ellipses with pulsing amplitude modulation on `#loadingCanvas`. After the banner image is decoded AND at least 1300ms has elapsed, it fades out the overlay and fades in `#mainContent`. The animation self-terminates once the overlay is hidden.

## main_page.html Content Sections

- `#story` — opening headline bio
- `#research` — dark-background goal block ("From H&E histology to patient-level prognosis") + histopathology image
- `#multimodal` — dark section with canvas pipeline diagram
- Research Methods — `.method-item` list (Survival analysis, Multimodal fusion, Causal inference, Calibration)
- `#research-highlights` — KM curve canvas
- Full-width header image with "MY RESEARCH" overlay
- `#publications` — selected publications
- `#posters` — conference posters (PDFs in `posters/`)
- `#contact` (footer) — email, Twitter, GitHub, LinkedIn, Google Scholar

## Key Design Patterns

- Wave constants (layer count, speed, amplitude) are grouped at the top of `waves.js` as named constants — tune those to adjust the animation feel.
- `spinning_wheel.js` contains two loader implementations (`createBasicRingLoader` and `createRingLoader`); only `createRingLoader` is called.
- All canvas drawing uses `devicePixelRatio` scaling for sharp rendering on HiDPI screens.
- The `main_page.html` has several commented-out sections (overview bio, profile image placeholder) that are preserved for potential re-enabling.
- Inline styles in `main_page.html` should be moved to `main_page.css` when a pattern repeats — e.g. `.method-item`, `.method-title`, `.method-desc` were extracted from repeated inline styles on the research methods list.
