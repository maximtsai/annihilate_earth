# Three.js mobile optimization notes

Findings from getting *Little Planet Lumberjack* running acceptably on low-end Android,
after playtest reports of both lag and outright failure to boot. Written so the same
fixes can be applied to other Three.js games.

**Part 1 (§0–§10)** is performance: making the frame rate acceptable.
**Part 2 (§11–§15)** is robustness: making the game start and stay running at all. Both
matter on the same hardware, and to the player both failures look the same.

The problem devices:

| | GPU | DPR | cores | user agent | symptom |
|---|---|---|---|---|---|
| A | PowerVR Rogue GE8320 | 1.33 | 8 | `Android 10; K ... Chrome/150` | lag |
| B | Adreno 640 (Snapdragon 855) | **2.75** | 8 | `X11; Linux x86_64 ... Chrome/151` | lag |
| C | PowerVR Rogue GE8320 | 1.7 | 8 | `Android 10; K ... Mobile ... Chrome/150` | **black screen** |

Device B matters most for Part 1: an Adreno 640 is a *fast* GPU. It was not lagging
because it was weak. It was lagging because it was being handed desktop settings.

Device C matters most for Part 2, and is a cautionary tale — it black-screened on a build
that already contained most of Part 1. Two of the fixes below were themselves the cause
(see §5 and §13). Optimization work can introduce boot failures on exactly the hardware
it targets, so re-test the low end after optimizing, not just before.

---

## 0. Measure first — the bottleneck is usually not what you think

Before changing anything, dump what the renderer is actually doing. Paste into the
console with a handle on your renderer:

```js
const i = renderer.info;
console.log({
  drawCalls: i.render.calls,
  triangles: i.render.triangles,
  geometries: i.memory.geometries,
  textures:   i.memory.textures,
  programs:   i.programs.length,
  pixelRatio: renderer.getPixelRatio(),
  buffer: [renderer.domElement.width, renderer.domElement.height],
});
```

This game reported **154 draw calls, 26k triangles, 4 textures, 3 lights, no shadow
maps**. That is a geometrically trivial scene. Anyone reaching for mesh decimation or
LODs would have wasted their time.

The decisive test is to sweep pixel ratio and see whether cost tracks pixel count. If
it does, you are fillrate-bound and every fix belongs in the fragment/pixel budget,
not the vertex budget:

```js
const v = new THREE.Vector2(); renderer.getSize(v);
const gl = renderer.getContext();
const sync = () => gl.readPixels(0,0,1,1,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array(4));
for (const dpr of [1, 1.5, 2, 2.75]) {
  renderer.setPixelRatio(dpr); renderer.setSize(v.x, v.y, false);
  for (let k=0;k<5;k++) renderer.render(scene, camera); sync();      // warm
  const t0 = performance.now();
  for (let k=0;k<25;k++) renderer.render(scene, camera); sync();      // sync = real GPU time
  console.log(dpr, ((performance.now()-t0)/25).toFixed(2)+'ms');
}
```

Result here (desktop GPU — treat the *ratios* as transferable, not the absolutes):

| DPR | megapixels | ms/render | vs 1× pixels | vs 1× time |
|---|---|---|---|---|
| 1.0 | 0.63 | 1.01 | 1.00× | 1.00× |
| 1.5 | 1.42 | 1.25 | 2.25× | 1.24× |
| 2.0 | 2.53 | 2.08 | 4.02× | 2.06× |
| 2.75 | 4.78 | 3.38 | 7.59× | 3.35× |

Cost tracks pixels closely above ~1.5×, with a floor at low DPR from per-draw-call
overhead. Conclusion: **pixel ratio is the dominant lever; draw calls are the floor;
triangles are irrelevant.**

The `sync()` call matters. `renderer.render()` only queues work — without forcing a
GPU round-trip you are timing the JS submit, not the draw.

---

## 1. Tier devices by GPU renderer string, never by user agent

**This was the single highest-impact bug.** Device B's UA is
`Mozilla/5.0 (X11; Linux x86_64) ... Chrome/151` — no `android`, no `mobile` token.
UA reduction, privacy modes, embedded webviews, and ChromeOS containers all produce
UA strings that no `/android|mobile/i` test will catch.

The original code gated its GPU check *behind* a UA check:

```js
// BROKEN: the UA test short-circuits before the GPU probe ever runs
if (!/android|iphone|mobile/i.test(ua)) return false;
const gpu = gl.getParameter(ext.UNMASKED_RENDERER_WEBGL);   // never reached on device B
```

So device B was classified desktop and received 2× pixel ratio, MSAA on, and every
cosmetic effect enabled — on a phone.

Query the renderer string **first and unconditionally**. Use UA only to *widen* the
result, never to skip the probe:

```js
let gpu = '';
const c = document.createElement('canvas');
const gl = c.getContext('webgl') || c.getContext('experimental-webgl');
if (gl) {
  const ext = gl.getExtension('WEBGL_debug_renderer_info');
  if (ext) gpu = (gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) || '').toLowerCase();
  // Do NOT call WEBGL_lose_context here — see §5.
}

if (/adreno|mali|powervr|videocore|tegra|vivante/.test(gpu)) tier.mobile = true;
// Apple reports "apple gpu"/"apple mN" for desktop and mobile alike; iPadOS also
// ships a desktop UA. Touch points disambiguate iPad from Mac.
if (/apple\s*(?:gpu|a\d|m\d)/.test(gpu) && navigator.maxTouchPoints > 1) tier.mobile = true;
// Fallback for masked renderer strings.
if (/android|iphone|ipod|ipad|mobile/.test(ua)) tier.mobile = true;
```

### Use two tiers, not one

The instinct is a single `isWeak()` boolean. That is wrong, and it is why device B
slipped through even after a GPU allowlist was added: an Adreno 640 is genuinely fast
and does not belong on a "weak GPU" list. It still needs mobile pixel budgets.

- **`mobile`** — any phone/tablet-class GPU, however fast. Cap pixel ratio, disable MSAA.
- **`weak`** — the slow end of that set. Additionally drop to 1:1 and skip cosmetic layers.

`weak` is a subset of `mobile`. Detect `mobile` from the GPU family; detect `weak`
from specific slow families plus `deviceMemory`, `hardwareConcurrency`, OS version,
and screen size.

Verify against a table of real device strings rather than eyeballing regexes:

| device | mobile | weak | MSAA | eff. DPR |
|---|---|---|---|---|
| PowerVR GE8320 | ✅ | ✅ | off | 1.0 |
| Adreno 640 | ✅ | ❌ | off | 1.5 |
| Desktop NVIDIA | ❌ | ❌ | on | 2.0 |
| iPad (desktop UA + touch) | ✅ | ❌ | off | 1.5 |
| Mac M3 (Apple GPU, no touch) | ❌ | ❌ | on | 2.0 |
| Masked renderer + mobile UA | ✅ | ❌ | off | 1.5 |

The last three rows are the ones that catch regressions. Guard them explicitly.

---

## 2. Cap pixel ratio — the biggest single win

`devicePixelRatio` on modern phones is routinely 2.5–3.5. Rendering a full-screen 3D
scene at native density is almost never the right call: at DPR 2.75 you draw **7.6× the
pixels of 1×** for detail nobody can resolve on a 6" panel.

```js
const maxDpr = tier.weak ? 1 : (tier.mobile ? 1.5 : 2);
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, maxDpr));
```

Never pass raw `devicePixelRatio`. For a stylized/low-poly look 1.5 is generous; many
shipped mobile games sit at 1.0–1.25.

---

## 3. Disable MSAA on all mobile GPUs

`antialias: true` is priced per sample per pixel, so it **compounds** with pixel ratio.
Gate it on the `mobile` tier, not `weak`:

```js
new THREE.WebGLRenderer({ antialias: !tier.mobile, /* ... */ })
```

At 1.5×+ density on a phone screen, MSAA buys very little. Note the attribute is
immutable after context creation — you must decide before constructing the renderer.

---

## 4. Set `powerPreference: 'high-performance'`

One word. Nudges hybrid-GPU laptops, some Android configs, and ChromeOS toward the
faster GPU instead of the power-saving default.

Not quite free, though: it is an *optional* context attribute, and a minority of Android
drivers reject optional attributes rather than ignoring them, which makes context
creation throw. Pair it with the retry in §13 so a rejected hint degrades instead of
black-screening.

```js
new THREE.WebGLRenderer({ antialias: !tier.mobile, alpha: true, powerPreference: 'high-performance' });
```

Confirm it stuck — the browser may not honour it:

```js
renderer.getContext().getContextAttributes();  // { antialias, powerPreference, alpha }
```

---

## 5. Cache the GPU probe — it costs a whole WebGL context

The detection function created a canvas and a WebGL context **on every call**, and was
called 5+ times (renderer construction, pixel ratio, effect gating, and once per garage
open from a UI module).

Measured **8.6 ms per context creation on a fast desktop** — considerably worse on the
hardware this code exists to detect. Worse than the time: browsers cap live WebGL
contexts (~8–16) and evict the oldest. Leaking one per call risks killing your game's
own context.

Memoize it:

```js
let _tier = null;
function gpuTier() {
  if (!_tier) _tier = computeGpuTier();
  return _tier;
}
```

After: 100 calls created **0** contexts in **0 ms**. This also makes it safe to call
the tier check from hot paths (see §9).

### Do not "release" the probe with `WEBGL_lose_context`

Tidying up the probe by force-losing its context looks responsible and is a trap:

```js
// DON'T
const lose = gl.getExtension('WEBGL_lose_context');
if (lose) lose.loseContext();
```

Forcing a context loss microseconds before the real renderer's context is created can
disturb the shared GPU process on some drivers — PowerVR/ANGLE especially — and the
failure mode is a black screen on exactly the low-end hardware the probe exists to
detect. One idle context is a far cheaper problem.

Memoization already solves the leak on its own: the probe runs **at most once per
session**, and the canvas and context fall out of scope on return, so they are
collectable normally. The leak was only ever caused by calling the probe repeatedly.

### Full reference implementation

§0–§5 above build this up piece by piece; here is the whole thing as shipped, for
copying wholesale rather than reassembling from fragments.

```js
// GPU capability tiers. Two of them, and the distinction matters:
//
//   mobile — any phone/tablet-class GPU, however fast. Caps pixel ratio and
//            turns MSAA off. A flagship mobile part is still a mobile part:
//            at 2.75 devicePixelRatio it draws 7.6x the pixels of 1x, and
//            measured render cost tracks pixel count almost linearly past
//            ~1.5x, so density is the dominant lever regardless of GPU speed.
//   weak   — the slow end of that set. Additionally drops to 1:1 and skips
//            the cosmetic-heavy layers (fog shells, myco fog, clouds).
//
// The user agent CANNOT be the gate. A playtest device reported
// "Mozilla/5.0 (X11; Linux x86_64) ... Chrome/151" while running an Adreno
// 640, so every /android|mobile/ test failed and it was handed full desktop
// settings — 2x pixel ratio, MSAA on, and every cosmetic layer enabled — on
// a phone GPU. The unmasked renderer string is the signal that survives UA
// reduction, so it is checked first and unconditionally; UA is only ever
// used to widen the result, never to skip the probe.
let _gpuTier = null;

function computeGpuTier() {
  const tier = { mobile: false, weak: false };
  try {
    let gpu = '';
    try {
      const c = document.createElement('canvas');
      const gl = c.getContext('webgl') || c.getContext('experimental-webgl');
      if (gl) {
        const ext = gl.getExtension('WEBGL_debug_renderer_info');
        if (ext) gpu = (gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) || '').toLowerCase();
        // Deliberately NOT calling WEBGL_lose_context.loseContext() here — see
        // the "do not release the probe" note above.
      }
    } catch (glErr) { }

    const ua = (navigator.userAgent || '').toLowerCase();

    // Mobile GPU families, by renderer string.
    if (/adreno|mali|powervr|videocore|tegra|vivante/.test(gpu)) tier.mobile = true;
    // Apple reports "apple gpu" / "apple mN" for both desktop and mobile
    // parts, and iPadOS ships a desktop UA, so disambiguate on touch.
    if (/apple\s*(?:gpu|a\d|m\d)/.test(gpu) && navigator.maxTouchPoints > 1) tier.mobile = true;
    // Belt and braces: a mobile UA still counts even if the probe failed or
    // the renderer string was masked for privacy.
    if (/android|iphone|ipod|ipad|mobile|windows phone|webos|blackberry|bb10|opera mini/.test(ua)) tier.mobile = true;

    if (!tier.mobile) return tier;

    // --- weak tier ----------------------------------------------------
    if (/powervr|ge8320|mali-g52|mali-g51|mali-g31|mali-t|adreno\s*(?:3[0-9]{2}|50[0-9]|510|610)/.test(gpu)) tier.weak = true;

    const mem = navigator.deviceMemory; // GB, Chromium only
    const cores = navigator.hardwareConcurrency;

    // Old mobile OS builds
    const oldAndroid = /android\s([0-9]+)/.test(ua) &&
      parseInt(ua.match(/android\s([0-9]+)/)[1], 10) <= 7;
    const oldIOS = /iphone\sos\s([0-9_]+)/.test(ua) &&
      parseInt(ua.match(/iphone\sos\s([0-9_]+)/)[1], 10) < 12;

    if (oldAndroid || oldIOS) tier.weak = true;
    if (typeof mem === 'number' && mem <= 2) tier.weak = true;
    if (typeof cores === 'number' && cores <= 2) tier.weak = true;

    // Very small screens on weak/mid hardware
    const smallScreen = Math.min(window.screen.width, window.screen.height) <= 360;
    if (smallScreen && (typeof cores === 'number' && cores <= 4)) tier.weak = true;
  } catch (e) { }
  return tier;
}

// Cached: the probe costs a throwaway WebGL context (~9ms on desktop, worse
// on the hardware this exists for) and callers hit it repeatedly.
function gpuTier() {
  if (!_gpuTier) _gpuTier = computeGpuTier();
  return _gpuTier;
}

function isWeakMobile() { return gpuTier().weak; }
function isMobileGPU() { return gpuTier().mobile; }
```

Two call-site notes that don't fit anywhere else in the writeup:

- `isWeakMobile()`/`isMobileGPU()` are thin readers over the memoized `gpuTier()` —
  cheap to call from anywhere, including per-frame code, precisely because the
  expensive work happens at most once.
- The 360px/≤4-core small-screen rule exists for cheap tablets and low-end phones
  that pass every other check (enough memory, enough cores individually) but are
  still underpowered as a combination. Tune the thresholds to your own target
  hardware rather than copying them verbatim — they were picked for this game's
  specific playtest devices, not derived from a general rule.

---

## 6. Do not over-tessellate backdrops

The skybox was `SphereGeometry(250, 64, 64)` — **8,064 triangles, ~72% of the entire
visible scene** — wrapping a fragment shader that does one texture fetch.

A skybox surrounds the camera, so it has **no silhouette to preserve**. The only thing
tessellation buys is finer UV interpolation. Dropped to `(250, 32, 24)`: 1,472 triangles,
an 82% cut, and scene triangles fell 26% overall.

Verify the tradeoff rather than assuming — low tessellation *can* warp an equirect
texture. Render both and diff:

```js
// draw each version to a canvas, then compare pixel buffers
let maxd = 0, over = 0;
for (let i = 0; i < a.length; i += 4) {
  const d = Math.max(Math.abs(a[i]-b[i]), Math.abs(a[i+1]-b[i+1]), Math.abs(a[i+2]-b[i+2]));
  if (d > maxd) maxd = d;
  if (d > 8) over++;
}
```

Result: max channel difference **9/255 on 2 pixels out of 176,400** (0.001%), mean
0.198/255. Visually identical. If your backdrop has hard edges or text, expect worse —
measure before committing.

---

## 7. Keep particles opaque

The most counter-intuitive result. Marking particles `transparent: true` moves them out
of the opaque pass and into the blended pass, which costs you:

- **early-Z rejection** — every fragment shades, even fully hidden ones
- **a per-frame depth sort** on the CPU, O(n log n) over transparent objects
- **blend bandwidth** — read-modify-write per fragment instead of write

Benchmarked with 260 overlapping boxes matching the real particle pool, at 1080×1920,
interleaved runs to cancel thermal drift:

| | ms/frame |
|---|---|
| opaque | 0.824 |
| `transparent: true, opacity: 0.85` | 1.476 |
| | **1.79× slower** |

On a tile-based mobile GPU the gap widens further. Dust and smoke were ~half of all
particle spawn sites and the highest-count ones — exactly the wrong things to blend.

**Fade particles by shrinking, not by opacity.** A scale-driven fade looks nearly the
same in motion and keeps everything in the opaque pass:

```js
const k = clamp(1 - p.life / p.maxLife, 0, 1);
p.mesh.scale.setScalar(Math.max(p.baseScale * (1 - easeOutCubic(k)), 0.0001));
```

Before removing translucency, confirm nothing animates `opacity` — if it does, an opaque
material will silently ignore it and the fade will pop instead of easing.

Audit what is actually transparent in a live scene:

```js
const agg = {};
scene.traverse(o => {
  if (!o.isMesh || !o.visible) return;
  const m = Array.isArray(o.material) ? o.material[0] : o.material;
  if (!m || !m.transparent) return;
  const k = `${m.type} #${m.color.getHexString()} op=${m.opacity} dw=${m.depthWrite}`;
  agg[k] = (agg[k] || 0) + 1;
});
console.table(agg);
```

Watch for near-opaque blending (`opacity: 0.88`) — it pays the full transparent cost for
a barely visible effect. Either commit to opaque or justify the blend.

---

## 8. Never mutate shared materials at runtime

A tempting "optimization" is to coerce a material as you assign it:

```js
// DON'T
if (!isDust && mat.transparent) mat.transparent = false;
```

Pooled objects share a handful of material instances. Flipping a flag on one leaks to
**every** object that later uses it, for the rest of the session, and nothing undoes it.
Set material state at construction, and give objects needing different state their own
material.

In this codebase the guard was also dead — every material reaching it was already
opaque, since `MeshBasicMaterial` defaults to `transparent: false`. Worth checking
before writing defensive coercion at all.

(For the record, in r128 flipping `transparent` does take effect immediately without
`needsUpdate` and triggers no shader recompile — verified. The problem is the shared
mutation, not the cost.)

---

## 9. Make particle emission framerate-independent

A per-frame probability is a hidden performance bug:

```js
// BROKEN: emission rate scales with framerate
if (spd > 0.5 && Math.random() < 0.3) burst(pos, 1, wheelMats);
```

At 144 Hz this emits **2.4× more particles** than at 60 Hz. The faster the machine, the
more work it creates for itself — and the effect literally looks different across
devices. Drive emission from a `dt` accumulator instead:

```js
if (spd > 0.5) {
  trailT -= dt;
  if (trailT <= 0) { trailT = 0.055; burst(pos, 1, wheelMats); }
} else {
  trailT = 0;                 // reset so it fires immediately next time
}
```

Now the rate is a fixed emissions/second regardless of refresh rate, and the particle
budget is bounded. Same reasoning applies to any `Math.random()`-gated per-frame effect:
screen shake, sparks, audio triggers.

---

## 10. Scale effect budgets by tier

Once tiering is trustworthy, spend it. Reduce particle counts at the single choke point
rather than at every call site:

```js
function burst(worldPos, n, mats, ...) {
  if (isWeakMobile()) n = Math.max(1, Math.round(n * 0.6));
  // ...
}
```

`Math.max(1, ...)` keeps the effect legible instead of letting it vanish. This is only
cheap because the tier check is memoized (§5) — an unmemoized probe here would create a
WebGL context per particle burst.

Also gate whole cosmetic layers on `weak`: volumetric fog shells, cloud layers, ambient
particle systems. Large, low-alpha, screen-covering meshes (`opacity: 0.14`,
`depthWrite: false`) are pure overdraw and the first thing to cut.

---

# Part 2 — Surviving low-end devices

Performance work gets you a playable frame rate. It does not stop the game **not booting
at all**, which is the other thing that happens on cheap hardware — and it presents
identically to the player: a black screen.

Everything below came from chasing exactly that on a PowerVR GE8320. The lesson that
generalizes: on low-end Android, a lost WebGL context is a *normal event*, not an
exceptional one. Memory pressure, backgrounding, and driver resets all trigger it. Treat
recovery as a supported path, not an edge case.

## 11. Actually resume after context loss

The single highest-value fix here. A handler that looks correct and is not:

```js
// BROKEN: cancels the loop and never restarts it, despite the log line
this._onContextRestored = () => {
  console.log("WebGL context restored. Resuming game loop...");
  if (this._raf) cancelAnimationFrame(this._raf);
};
```

**three.js recovers itself.** Its internal `webglcontextrestored` listener clears the
lost flag and calls `initGLContext()`, rebuilding state, capabilities and extensions. The
renderer is ready to draw. The only thing missing is that *you* have to ask for frames
again:

```js
this._onContextRestored = () => {
  if (this._raf) cancelAnimationFrame(this._raf);
  this._raf = this._loop ? requestAnimationFrame(this._loop) : 0;
};
```

Without that one line, any context loss kills the game permanently. Since three's own
listener is registered inside the `WebGLRenderer` constructor and yours is registered
afterwards, and DOM listeners fire in registration order, three has always finished
reinitializing before your handler runs.

Calling `renderer.resetState()` in your handler is harmless but redundant for the same
reason — it is meant for interop when non-three code mutates raw GL state.

Test it. You do not need the failing device:

```js
const ext = renderer.getContext().getExtension('WEBGL_lose_context');
ext.loseContext();
setTimeout(() => ext.restoreContext(), 600);
// then confirm renderer.info.render.frame climbs again
```

Note `renderer.info.render.frame` **resets to 0** on reinitialization, so compare against
0 after the restore rather than against the pre-loss value.

## 12. Set the loop handle before heavy GPU allocation

A subtle ordering bug in the fix above. If the handle the restore path needs is assigned
*after* your scene build, a loss during that build leaves it unset and the restore
schedules nothing:

```js
const loop = (now) => { /* ... */ };
this._loop = loop;          // BEFORE the heavy work, not after
buildPlanet();              // peak GPU allocation = likeliest moment to lose the context
this._raf = requestAnimationFrame(loop);
```

Scene construction is when you allocate the most GPU memory, so it is precisely when a
weak device drops the context. Anything the recovery path depends on must be initialized
before it, not after.

## 13. Renderer construction throws — catch it

`new THREE.WebGLRenderer()` throws `"Error creating WebGL context."` when the context
cannot be created. If that call sits in an unguarded `async` init function, the throw
becomes a swallowed promise rejection: black screen, empty console, no clue.

Some Android drivers **reject** optional context attributes rather than ignoring them, so
retry bare before giving up:

```js
let renderer = null;
try {
  renderer = new THREE.WebGLRenderer({ antialias: !tier.mobile, alpha: true,
                                       powerPreference: 'high-performance' });
} catch (err) {
  try {
    renderer = new THREE.WebGLRenderer({ alpha: true });   // drop the optional attrs
  } catch (err2) {
    showFatalUI('webgl');                                   // never fail silently
    return;
  }
}
```

This is the counterweight to §4: `powerPreference` is worth setting, and worth not dying
over. Note `antialias` is immutable after creation — it is the one setting that must be
decided before you can query the real context.

## 14. Do not wrap the render call in try/catch

Tempting, and wrong:

```js
// DON'T
try { renderer.render(scene, camera); } catch (e) { console.warn(e); }
```

`WebGLRenderer.render()` already begins with a context-lost guard and **silently returns**
when the context is gone — there is no exception to catch. What the block actually
swallows is genuine bugs: a bad uniform, a disposed geometry, an undefined material.

And it swallows them *per frame*. Because the loop schedules its next frame first, a
persistent error becomes a warning 60 times a second — the real failure is buried and the
logging itself becomes a performance problem. One loud stack trace is strictly better.

If you want a guard, test state rather than catching exceptions:

```js
if (!renderer.getContext().isContextLost()) renderer.render(scene, camera);
```

## 15. Things you do not need to build

Checked against three.js r128 — verify against your own version before assuming:

- **WebGL 1 fallback.** `WebGLRenderer` already tries `["webgl2", "webgl", "experimental-webgl"]`
  in order. Hand-rolling this adds complexity for nothing.
- **GL state reinitialization after context restore.** Handled internally, as above.
- **Auto-reload on context loss.** Attractive as a catch-all, dangerous in practice: if the
  loss is deterministic at boot you get an infinite reload loop. Prefer real recovery,
  and if you must have a fallback, surface an error after a timeout instead:

```js
this._ctxLostTimer = setTimeout(() => {
  if (this._raf) return;              // recovered in the meantime
  showFatalUI('webgl-context');
}, 4000);
```

A guarded one-shot reload (counter in `sessionStorage`) is acceptable as a last resort.
An unguarded one is a bug generator.

---

## Checklist

**Performance**

- [ ] Profile `renderer.info` before optimizing; sweep DPR to confirm fillrate-bound
- [ ] Tier from the **GPU renderer string**, queried first and unconditionally
- [ ] Two tiers (`mobile` ⊃ `weak`), not one boolean
- [ ] Memoize the tier probe — and do **not** force-lose the probe context
- [ ] Clamp `setPixelRatio` — never pass raw `devicePixelRatio`
- [ ] `antialias: !mobile`
- [ ] `powerPreference: 'high-performance'`
- [ ] Backdrop/skybox geometry tessellated to the minimum that avoids UV warping
- [ ] Particles opaque; fade by scale, not opacity
- [ ] No runtime mutation of shared materials
- [ ] All emission on `dt` timers, never per-frame `Math.random()`
- [ ] Effect budgets and cosmetic layers gated on tier
- [ ] Regression-test the tier table: desktop, iPad-with-desktop-UA, Mac, masked renderer

**Robustness**

- [ ] `webglcontextrestored` actually calls `requestAnimationFrame` again
- [ ] Anything the restore path needs is assigned *before* scene construction
- [ ] Renderer construction wrapped in try/catch, with a bare-attribute retry
- [ ] Every failure path reaches a visible error UI — never a silent black screen
- [ ] No try/catch around `renderer.render()`
- [ ] Recovery tested with `WEBGL_lose_context` (`loseContext()` → `restoreContext()`)

## Not covered here, worth doing next

**Adaptive resolution.** Every static device list has a next unknown device — and here
one of two problem devices defeated UA sniffing entirely. Sampling frame time over ~30
frames and stepping pixel ratio down (1.5 → 1.25 → 1.0) when the budget is missed is the
only approach that self-corrects for hardware you have never tested.

**Draw-call batching.** 154 draw calls for 26k triangles is ~170 triangles per call — the
floor visible at low DPR in §0. Repeated static props were already `InstancedMesh`; the
remainder is many small unique meshes. Merging static geometry per material would lower
that floor, which matters most on weak GPUs with high driver overhead.
