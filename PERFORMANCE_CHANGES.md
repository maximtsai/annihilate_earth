# Loading Performance Changes — Applied to garden.html

This document describes a set of loading-performance fixes made to `garden.html`
("Obliterate Earth", a single-file canvas game). It's written so another AI agent
can apply the same changes to a similar/v2 copy of the game that may have
different line numbers, different weapon names, or minor structural differences.

Read each section, locate the equivalent code in the target file by the
described pattern (not by line number), and apply the analogous change.

---

## 1. Non-blocking Google Fonts loading

**Problem:** The stylesheet used a CSS `@import` for Google Fonts inside a
`<style>` block in `<head>`. A CSS `@import` blocks the whole stylesheet — and
therefore first paint — until that external request completes.

**Find:** A `<style>` block in `<head>` starting with something like:
```css
@import url('https://fonts.googleapis.com/css2?family=...&display=swap');

/* CSS Reset */
* { ... }
```

**Change:** Move the font loading out of CSS and into `<head>` as a
non-blocking `<link>`, using the classic "media=print, swap to all on load"
trick, with a `<noscript>` fallback for when JS is disabled:

```html
<head>
    <title>...</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=...&display=swap"
        media="print" onload="this.media='all'">
    <noscript>
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=...&display=swap">
    </noscript>
    <style>
        /* CSS Reset */
        * { ... }
```

Keep the exact same Google Fonts URL/params that were in the original
`@import` — just relocate it. Remove the `@import` line entirely from the
`<style>` block.

---

## 2. Lazy-load per-weapon sound effects

**Problem:** All sound effect / music mp3s (roughly two dozen) were fetched
and `decodeAudioData`'d up front during the loading screen, via something
like:
```js
const soundIds = ['sfx_a', 'sfx_b', /* ...20+ ids... */];
soundIds.forEach(id => soundManager.load(id));
```
This delays the point at which the game is meaningfully "ready" and wastes
bandwidth/decode time on sounds for weapons the player may never select.

### 2a. Make `SoundManager.load()` idempotent

Find the `SoundManager` class's `load(id)` method (fetches `lib.getAsset(id).url`,
decodes via `AudioContext.decodeAudioData`, stores in `this.buffers[id]`).

Add a `loadingPromises` map to the constructor:
```js
constructor() {
    this.context = new (window.AudioContext || window.webkitAudioContext)();
    this.buffers = {};
    this.loadingPromises = {};   // <-- add this
    this.activeLoops = {};
    ...
}
```

Rewrite `load()` so repeated calls for the same id don't re-fetch/re-decode,
and add a `loadMany()` convenience helper:
```js
async load(id) {
    if (this.buffers[id] || this.loadingPromises[id]) return this.loadingPromises[id];
    const asset = lib.getAsset(id);
    if (!asset) return;
    const promise = (async () => {
        try {
            const response = await fetch(asset.url);
            const arrayBuffer = await response.arrayBuffer();
            const audioBuffer = await this.context.decodeAudioData(arrayBuffer);
            this.buffers[id] = audioBuffer;
        } catch (e) {
            console.error(`Failed to load sound: ${id}`, e);
        }
    })();
    this.loadingPromises[id] = promise;
    return promise;
}

loadMany(ids) {
    ids.forEach(id => this.load(id));
}
```
This is a pure refactor of the existing `load()` body — same fetch/decode
logic, just wrapped so it's safe to call multiple times.

### 2b. Split sound IDs into "essential" (load immediately) vs "per-weapon" (load on demand)

Find where the `soundManager` is constructed and the full `soundIds` array is
built and force-loaded (usually right after `setLoadingProgress(10, ...)` in
the main `run()`/init function). Replace it with:

```js
const soundManager = new SoundManager();

// Sounds needed right away: UI, music, and the default starting weapon.
const essentialSoundIds = [
    'bgm_gentle_space', 'sfx_ui_switch', 'sfx_ui_scroll',
    'sfx_out_of_ammo', 'sfx_launch_heavy', 'sfx_explosion_small'
];
essentialSoundIds.forEach(id => soundManager.load(id));

// Everything else is fetched on-demand the first time its weapon is selected.
const WEAPON_SOUNDS = {
    missile: ['sfx_explosion_small'],
    nuke: ['sfx_explosion_medium'],
    laser: ['sfx_laser_fire', 'sfx_laser_crack', 'sfx_laser_hum'],
    asteroid: ['sfx_launch_heavy', 'sfx_explosion_large'],
    gamma: ['sfx_gamma_charge', 'sfx_gamma_warning', 'sfx_gamma_beam'],
    sword: ['sfx_sword_fly', 'sfx_sword_stab', 'sfx_sword_rumble_loop', 'sfx_sword_pullout', 'sfx_explosion_medium'],
    moon: ['sfx_launch_heavy', 'sfx_mystical_moon_explosion', 'sfx_holy_shine'],
    blackhole: ['sfx_black_hole_spawn', 'sfx_black_hole_disappear'],
    kraken: ['sfx_gamma_charge'],
    bowling: ['sfx_launch_heavy', 'sfx_bowling_pins'],
    fist: ['sfx_launch_heavy', 'sfx_fist_impact', 'sfx_nom_short']
};
function ensureWeaponSoundsLoaded(weaponType) {
    const ids = WEAPON_SOUNDS[weaponType];
    if (ids) soundManager.loadMany(ids);
}
// Victory sound is only ever needed once, at game end.
soundManager.load('sfx_victory');
```

**IMPORTANT — adapt this to the target file, don't copy blindly:**
- Grep the target file for every `soundManager.play('sfx_...')` /
  `soundManager.play("sfx_...")` call site and note which weapon-handling
  code block each one lives in (e.g. inside `if (type === 'laser') {...}`,
  or in the shared explosion-sound function keyed by `weaponType`).
- Build `WEAPON_SOUNDS` from that mapping — one entry per weapon id used in
  `data-weapon="..."` attributes on the weapon-select buttons, listing every
  sound that weapon's code path can call `soundManager.play()` on.
- The "essential" list should be: background music, generic UI sounds
  (menu clicks/scroll), any "can't fire" feedback sound, and whichever
  sounds the *default selected weapon* (the one with `class="selected"` on
  its button at page load) can trigger immediately.
- If a sound is shared across multiple weapons (e.g. a generic explosion
  sound used by several weapon types), include it in every relevant
  weapon's list — `loadMany`/`load` are idempotent so no wasted work.

### 2c. Trigger lazy-loading on weapon selection

Find the weapon-select button click handler, typically:
```js
document.querySelectorAll('.weapon-button').forEach(button => {
    button.addEventListener('click', (e) => {
        ...
        selectedWeapon = button.dataset.weapon;
        ...
    });
});
```
Immediately after the `selectedWeapon = button.dataset.weapon;` line, add:
```js
ensureWeaponSoundsLoaded(selectedWeapon);
```
If keyboard shortcuts select weapons by calling `.click()` on the button
elements (common pattern: `document.getElementById('btn-laser').click()`),
no extra change is needed there — the click handler above already covers it.
If any keyboard/programmatic weapon-switch path sets `selectedWeapon`
*without* going through the button's click handler, add the same
`ensureWeaponSoundsLoaded(...)` call there too.

---

## 3. Remove artificial delays in the loading-screen dismissal

**Problem:** The loading screen's dismissal sequence had fixed `setTimeout`
pauses that added ~2 seconds of dead time on top of actual asset loading,
regardless of how fast loading really finished.

**Find:** Near the end of the main init function, something like:
```js
// Dismiss loading screen after a brief delay
setTimeout(() => {
    setLoadingProgress(100, 'READY');
    setTimeout(() => {
        if (loadingAnimId) cancelAnimationFrame(loadingAnimId);
        if (missileDiv.parentNode) missileDiv.parentNode.removeChild(missileDiv);
        loadingScreen.classList.add('fade-out');
        setTimeout(() => {
            loadingScreen.style.display = 'none';
        }, 800);

        // Staggered flicker-in: weapons first (fast), then header, then planet selector
        flickerIn(weaponBarWrapper, 300, 200);
        flickerIn(hudHeaderWrapper, 500, 600);
        flickerIn(planetSelector, 500, 900);
    }, 400);
}, 800);
```

**Change:** Remove the outer 800ms wrapper (pure dead time before even
showing "READY") and the 400ms pause between showing "READY" and starting
the fade-out (also pure dead time). Keep only the fade-out itself, and
shorten it from 800ms to 400ms so it still feels smooth but isn't slow:

```js
// Dismiss loading screen
setLoadingProgress(100, 'READY');
if (loadingAnimId) cancelAnimationFrame(loadingAnimId);
if (missileDiv.parentNode) missileDiv.parentNode.removeChild(missileDiv);
loadingScreen.classList.add('fade-out');
setTimeout(() => {
    loadingScreen.style.display = 'none';
}, 400);

// Staggered flicker-in: weapons first (fast), then header, then planet selector
flickerIn(weaponBarWrapper, 300, 200);
flickerIn(hudHeaderWrapper, 500, 600);
flickerIn(planetSelector, 500, 900);
```

Then find the matching CSS rule for the fade transition (search for
`.loading-screen.fade-out` and its sibling `.loading-screen` rule with a
`transition: opacity ...` property) and shorten the duration to match:
```css
.loading-screen {
    ...
    transition: opacity 0.4s ease-out;   /* was 0.8s */
    ...
}
.loading-screen.fade-out {
    opacity: 0;
    pointer-events: none;
}
```
The JS `setTimeout` duration (400ms) and the CSS `transition` duration
(0.4s) must match — the timeout is what actually removes the element from
layout (`display: none`) after the CSS opacity transition finishes.

---

## 4. Optimize procedural planet texture generation

**Problem:** `initializePlanet()` (the function that procedurally generates
the planet's surface texture into a hidden canvas using value-noise/fBm)
does a synchronous nested loop over every pixel of the canvas (e.g. 500×500 =
250,000 pixels), computing 4-9 octaves of noise per pixel. This blocks the
main thread for a noticeable chunk of time, which visibly freezes any
`requestAnimationFrame`-driven animation running concurrently (e.g. the
loading screen's starfield/missile animation).

Locate this function — look for a function (commonly named
`initializePlanet`) containing a double `for` loop over canvas width/height,
computing `dist = Math.sqrt(dx*dx + dy*dy)`, comparing against a planet
`radius`, and branching on `currentPlanet === 'earth' | 'mars' | ...` to pick
RGB values via noise thresholds, finally writing into an `ImageData`'s
`data` typed array.

Apply two independent optimizations:

### 4a. Skip `Math.sqrt` for pixels outside the planet circle

**Before** (typical structure):
```js
for (let y = 0; y < hiddenCanvas.height; y++) {
    for (let x = 0; x < hiddenCanvas.width; x++) {
        const dx = x - cx;
        const dy = y - cy;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist <= radius) {
            const idx = (y * hiddenCanvas.width + x) * 4;
            const nx = dx / radius;
            const ny = dy / radius;
            // ... noise + color logic using `dist`/`nx`/`ny` ...
        }
    }
}
```

**After:** compare squared distance first (cheap), and only take the actual
`Math.sqrt` for pixels that pass the test (since `nx`/`ny`/color logic
inside the circle still needs the real distance/radius fraction):
```js
const radiusSq = radius * radius;
...
for (let y = 0; y < canvasHeight; y++) {
    for (let x = 0; x < canvasWidth; x++) {
        const dx = x - cx;
        const dy = y - cy;
        const distSq = dx * dx + dy * dy;

        if (distSq <= radiusSq) {
            const dist = Math.sqrt(distSq);
            const idx = (y * canvasWidth + x) * 4;
            const nx = dx / radius;
            const ny = dy / radius;
            // ... unchanged noise + color logic ...
        }
    }
}
```
Roughly ~21% of pixels in the bounding square fall outside the inscribed
circle (`1 - π/4`); this avoids the sqrt call for all of them.

Apply the same squared-distance trick to any secondary pixel-scanning loop
in the same function that computes a core/inner-radius check purely to
increment a counter (e.g. counting how many generated pixels fall within a
"core" radius) — replace `const d = Math.sqrt(dx*dx+dy*dy); if (d <= coreRadius)`
with `if (dx*dx + dy*dy <= coreRadiusSq)` (precompute `coreRadiusSq = coreRadius * coreRadius`
once outside the loop).

### 4b. Chunk the generation across animation frames instead of one blocking pass

**Goal:** yield control back to the browser every N rows so any concurrent
`requestAnimationFrame` loop (loading-screen animation, etc.) keeps running
smoothly, instead of stalling for the entire generation duration in one
synchronous call.

Restructure the function to:
1. Do all the one-time setup (clear canvas, compute `radius`/`radiusSq`,
   allocate `imgData`/`data`, pick random noise seeds) synchronously, same
   as before.
2. Process the pixel loop in row-chunks (e.g. 40 rows at a time) inside a
   `processChunk()` function scheduled via `requestAnimationFrame`.
3. After each chunk finishes, call `hiddenCtx.putImageData(...)` for just
   that chunk's row range (a "dirty rectangle" partial paint) so the planet
   visibly materializes top-to-bottom over several frames rather than
   popping in fully formed at the end (or worse, staying blank until the
   very end).
4. When all rows are done, run the pixel-counting logic (previously done via
   a *second* `hiddenCtx.getImageData()` call — instead read directly from
   the `data` array you already have in memory, avoiding a redundant full
   canvas readback) and assign the completed `ImageData` object to whatever
   "cached planet image data" variable the rest of the game reads from
   (commonly `cachedPlanetImageData`).
5. Make the function return a `Promise` that resolves once step 4 completes.
   Callers do **not** need to `await` it as long as nothing they run
   immediately after depends on the planet texture being fully ready
   synchronously (verify this for your file — see caller-safety note below).

**Full pattern:**
```js
function initializePlanet() {
    hiddenCtx.clearRect(0, 0, hiddenCanvas.width, hiddenCanvas.height);

    const d = getPlanetSize();
    const radius = d / 2;
    const radiusSq = radius * radius;
    const cx = hiddenCanvas.width / 2;
    const cy = hiddenCanvas.height / 2;
    const canvasWidth = hiddenCanvas.width;
    const canvasHeight = hiddenCanvas.height;

    const imgData = hiddenCtx.createImageData(canvasWidth, canvasHeight);
    const data = imgData.data;

    seedX = Math.random() * 1000;
    seedY = Math.random() * 1000;
    const cloudSeedX = Math.random() * 1000;
    const cloudSeedY = Math.random() * 1000;

    const ROWS_PER_CHUNK = 40;
    let chunkStartY = 0;

    return new Promise((resolve) => {
        function processChunk() {
            const chunkEndY = Math.min(chunkStartY + ROWS_PER_CHUNK, canvasHeight);

            for (let y = chunkStartY; y < chunkEndY; y++) {
                for (let x = 0; x < canvasWidth; x++) {
                    const dx = x - cx;
                    const dy = y - cy;
                    const distSq = dx * dx + dy * dy;

                    if (distSq <= radiusSq) {
                        const dist = Math.sqrt(distSq);
                        const idx = (y * canvasWidth + x) * 4;
                        const nx = dx / radius;
                        const ny = dy / radius;

                        // ... UNCHANGED: all the existing noise/fbm calls and
                        // per-planet (earth/mars/neptune/jupiter/etc.) color
                        // branching that was already in the loop body,
                        // ending with r/g/b assignment ...

                        data[idx] = r;
                        data[idx + 1] = g;
                        data[idx + 2] = b;
                        data[idx + 3] = 255;
                    }
                }
            }

            hiddenCtx.putImageData(imgData, 0, 0, 0, chunkStartY, canvasWidth, chunkEndY - chunkStartY);
            chunkStartY = chunkEndY;

            if (chunkStartY < canvasHeight) {
                requestAnimationFrame(processChunk);
            } else {
                finish();
            }
        }

        function finish() {
            cachedPlanetImageData = imgData;   // <-- use your file's actual variable name

            // Count starting pixels (reads `data` directly — no second getImageData call)
            initialPixelCount = 0;
            initialCorePixelCount = 0;
            const planetCanvasCX = canvasWidth / 2;
            const planetCanvasCY = canvasHeight / 2;
            const planetSize = getPlanetSize();
            const coreRadius = (currentPlanet === 'neutron') ? 0 : (25 + 0.4 * (planetSize / 2));
            const coreRadiusSq = coreRadius * coreRadius;

            let x = 0, y = 0;
            for (let i = 3; i < data.length; i += 4) {
                if (data[i] > 0) {
                    initialPixelCount++;
                    const dx = x - planetCanvasCX;
                    const dy = y - planetCanvasCY;
                    if (dx * dx + dy * dy <= coreRadiusSq) {
                        initialCorePixelCount++;
                    }
                }
                x++;
                if (x >= canvasWidth) {
                    x = 0;
                    y++;
                }
            }
            currentPixelCount = initialPixelCount;
            currentCorePixelCount = initialCorePixelCount;

            planetCenterX = canvasWidth / 2;
            planetCenterY = canvasHeight / 2;

            resolve();
        }

        processChunk();
    });
}
```

**Do not change** any of the per-planet noise/color logic inside the
`if (distSq <= radiusSq) { ... }` block — copy it verbatim from the
original file into the chunked version. Only the outer loop structure,
the sqrt-skipping, and the chunking/Promise wrapper are new.

**Caller-safety check (do this for the target file, don't assume):**
Before applying 4b, grep for every call site of `initializePlanet()` and
confirm that no code *immediately following* the call (in the same
synchronous block) reads `cachedPlanetImageData` (or whatever the
finished-texture variable is called) expecting it to be populated already.
In the original file there were exactly two call sites — one at startup
(followed only by `generateStars()` and UI setup, which don't touch planet
pixel data) and one inside a `resetGame()`-style function (followed only by
`generateStars()`) — so fire-and-forget was safe. If your target file calls
`initializePlanet()` and then synchronously reads pixel data from the
result (e.g. immediately computing collisions or center-of-mass), you must
either `await` the call (making the caller `async`) or move that dependent
code into the `finish()` callback / a `.then()` on the returned promise.

Also verify how the planet is actually drawn to the visible canvas each
frame (search for `ctx.drawImage(hiddenCanvas, ...)`). If it draws directly
from the hidden canvas bitmap (as in the original file), the progressive
`putImageData` calls during chunking will make the planet visibly "paint
in" from top to bottom over a few frames on first load — this is expected
and acceptable. If instead the target file draws by reading
`cachedPlanetImageData` pixel-by-pixel rather than via `drawImage`, the
planet will stay fully invisible until `finish()` runs; consider assigning
`cachedPlanetImageData = imgData` once at the *start* (before chunking
begins) in that case, so partial/stale-but-present data is available
immediately, then it naturally updates in place as chunks fill in.

---

## Verification steps used

- No test suite exists; this is a single self-contained HTML file that
  depends on a host-injected `lib` global (`lib.getAsset`, etc.) not present
  outside the actual game platform, so it can't be run standalone in a
  browser preview.
- Syntax was verified after each change via Node.js: extract the inline
  `<script>...</script>` contents to a `.js` file and run `node --check
  <file>.js`. Do this after applying each section above, and again after
  all sections are applied.
- Recommend a manual smoke test on the real host platform: initial load
  (confirm Earth renders and loading screen dismisses promptly), switching
  weapons (confirm each weapon's sounds still play correctly on first use),
  and a game restart/planet switch (confirm terrain regenerates correctly).
