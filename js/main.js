// Core Game Engine & Main Loop
supportsGlow = detectGlowSupport();
console.log("[Glow Detection] Smooth gradient support:", supportsGlow);

if (!supportsGlow) {
    // Intercept Canvas shadowBlur setter to disable it game-wide
    const descriptor = Object.getOwnPropertyDescriptor(CanvasRenderingContext2D.prototype, 'shadowBlur');
    if (descriptor) {
        Object.defineProperty(CanvasRenderingContext2D.prototype, 'shadowBlur', {
            set: function (val) {
                descriptor.set.call(this, 0); // Force to 0
            },
            get: function () {
                return 0;
            },
            configurable: true,
            enumerable: true
        });
    }
    // Add class to document to disable CSS/HTML glows
    document.documentElement.classList.add('no-glows');
}

// ─── Loading Screen Animation ───
const loadingScreen = document.getElementById('loading-screen');
const loadingBar = document.getElementById('loading-bar-fill');
const loadingStatus = document.getElementById('loading-status');
const loadingStarsCanvas = document.getElementById('loading-stars-canvas');
const lsCtx = loadingStarsCanvas.getContext('2d');

loadingStarsCanvas.width = window.innerWidth;
loadingStarsCanvas.height = window.innerHeight;

let loadingScreenWidth = loadingScreen.offsetWidth || window.innerWidth;
let loadingScreenHeight = loadingScreen.offsetHeight || window.innerHeight;

function resizeLoadingCanvas() {
    loadingStarsCanvas.width = window.innerWidth;
    loadingStarsCanvas.height = window.innerHeight;
    loadingScreenWidth = loadingScreen.offsetWidth || window.innerWidth;
    loadingScreenHeight = loadingScreen.offsetHeight || window.innerHeight;
    if (!supportsGlow || isMobile) {
        drawStaticStars();
    }
}
window.addEventListener('resize', resizeLoadingCanvas);

// Animated warp-speed starfield for loading screen
const loadingStars = [];
for (let i = 0; i < 200; i++) {
    loadingStars.push({
        x: Math.random() * 1600 - 800,
        y: Math.random() * 900 - 450,
        z: Math.random() * 1000 + 200,
        speed: Math.random() * 3 + 1.5
    });
}

// Missile emoji flying over title — true ballistic (parabolic) arc, left → right
const missileDiv = document.createElement('div');
missileDiv.style.cssText = 'position:absolute;font-size:36px;z-index:1;pointer-events:none;opacity:0;';
missileDiv.textContent = '🚀';
loadingScreen.appendChild(missileDiv);

// Parabolic arc parameters (in loading-screen pixel space, which matches viewport)
// x goes from -80 (off-screen left) to 1680 (off-screen right)
// y at t=0 and t=1 starts below viewport; peaks at ~35% up the screen at t=0.5
const missileStartX = -80;
const missileEndX = 1680;
const missilePeakY = 0.20;  // fraction of screen height for the peak y (higher up)
const missileBaseY = 0.50;  // fraction of screen height for start/end y (mid-screen)
const missileDuration = 6.0;  // seconds per pass

let missileT = 0;             // 0..1 progress along arc
let missilePrevTime = null;

function animateMissile(timestamp) {
    if (missilePrevTime === null) missilePrevTime = timestamp;
    const dt = Math.min((timestamp - missilePrevTime) / 1000, 0.05);
    missilePrevTime = timestamp;

    missileT += dt / missileDuration;
    if (missileT >= 1.0) missileT = 0.0; // loop

    const t = missileT;
    const screenH = loadingScreenHeight;
    const screenW = loadingScreenWidth;

    // x advances linearly across screen width
    const mx = missileStartX + t * (missileEndX - missileStartX);

    // y follows a parabola: y = baseY + (peakY - baseY) * 4t(1-t)  [peaks at t=0.5]
    const peakYpx = missilePeakY * screenH;
    const baseYpx = missileBaseY * screenH;
    const my = baseYpx + (peakYpx - baseYpx) * 4 * t * (1 - t);

    // Tangent direction: dx/dt = const, dy/dt = (peakY - baseY)*4*(1-2t) * screenH
    const dxdt = (missileEndX - missileStartX);
    const dydt = (peakYpx - baseYpx) * 4 * (1 - 2 * t);
    const flightAngleDeg = Math.atan2(dydt, dxdt) * (180 / Math.PI);

    // 🚀 emoji points 45° up-right natively; compensate by +45° to align with travel
    const cssRotation = flightAngleDeg + 45;

    missileDiv.style.left = mx + 'px';
    missileDiv.style.top = my + 'px';
    missileDiv.style.transform = `translate(-50%,-50%) rotate(${cssRotation}deg)`;
    missileDiv.style.opacity = '1';
}

function drawStaticStars() {
    lsCtx.fillStyle = '#020206';
    lsCtx.fillRect(0, 0, loadingStarsCanvas.width, loadingStarsCanvas.height);

    const cx = loadingStarsCanvas.width / 2;
    const cy = loadingStarsCanvas.height / 2;
    const scaleX = loadingStarsCanvas.width / 1600;
    const scaleY = loadingStarsCanvas.height / 900;
    const starScale = scaleY;

    loadingStars.forEach(star => {
        const sx = (star.x / star.z) * 400 * scaleX + cx;
        const sy = (star.y / star.z) * 400 * scaleY + cy;
        const size = Math.max(0.5, (1 - star.z / 1000) * 3 * starScale);
        const alpha = Math.max(0.2, 1 - star.z / 1000);

        lsCtx.fillStyle = `rgba(180, 220, 255, ${alpha})`;
        lsCtx.beginPath();
        lsCtx.arc(sx, sy, size, 0, Math.PI * 2);
        lsCtx.fill();
    });
}

let loadingAnimId = null;

function animateMissileOnly(timestamp) {
    timestamp = timestamp || performance.now();
    animateMissile(timestamp);
    loadingAnimId = requestAnimationFrame(animateMissileOnly);
}

function animateLoadingStars(timestamp) {
    timestamp = timestamp || performance.now();
    lsCtx.fillStyle = 'rgba(2, 2, 6, 0.3)';
    lsCtx.fillRect(0, 0, loadingStarsCanvas.width, loadingStarsCanvas.height);

    animateMissile(timestamp);

    const cx = loadingStarsCanvas.width / 2;
    const cy = loadingStarsCanvas.height / 2;
    const scaleX = loadingStarsCanvas.width / 1600;
    const scaleY = loadingStarsCanvas.height / 900;
    const starScale = scaleY;

    loadingStars.forEach(star => {
        star.z -= star.speed;
        if (star.z <= 1) {
            star.z = 1000;
            star.x = Math.random() * 1600 - 800;
            star.y = Math.random() * 900 - 450;
        }

        const sx = (star.x / star.z) * 400 * scaleX + cx;
        const sy = (star.y / star.z) * 400 * scaleY + cy;
        const size = Math.max(0.5, (1 - star.z / 1000) * 3 * starScale);
        const alpha = Math.max(0.2, 1 - star.z / 1000);

        lsCtx.fillStyle = `rgba(180, 220, 255, ${alpha})`;
        lsCtx.beginPath();
        lsCtx.arc(sx, sy, size, 0, Math.PI * 2);
        lsCtx.fill();
    });

    loadingAnimId = requestAnimationFrame(animateLoadingStars);
}

if (!supportsGlow || isMobile) {
    drawStaticStars();
    animateMissileOnly();
} else {
    animateLoadingStars();
}

function setLoadingProgress(pct, status) {
    if (loadingBar) loadingBar.style.width = pct + '%';
    if (loadingStatus) loadingStatus.textContent = status;
}

setLoadingProgress(10, (translations[currentLanguage] || translations['en']).loadingAudio || 'Initializing audio system...');
soundManager = new SoundManager();
const essentialSoundIds = [
    'bgm_gentle_space',
    'sfx_ui_switch', 'sfx_ui_scroll',
    'sfx_launch_heavy',
    'sfx_explosion_small', 'sfx_explosion_medium', 'sfx_explosion_large',
    'sfx_victory'
];
// Kept so run() can gate the end of the loading bar on these actually decoding.
// SoundManager.load() never rejects, so this always settles.
const essentialSoundsReady = Promise.all(essentialSoundIds.map(id => soundManager.load(id)));

window.deferredSoundIds = [
    'sfx_laser_fire', 'sfx_laser_hum', 'sfx_laser_crack',
    'sfx_gamma_charge', 'sfx_gamma_beam', 'sfx_gamma_warning',
    'sfx_sword_fly', 'sfx_sword_stab', 'sfx_sword_pullout', 'sfx_sword_rumble_loop', 'sfx_holy_shine',
    'sfx_bowling_pins',
    'sfx_black_hole_spawn', 'sfx_black_hole_disappear',
    'sfx_nom_short',
    'sfx_fist_impact',
    'sfx_mystical_moon_explosion',
    'sfx_magical_star_shot', 'sfx_magical_star_shot2', 'sfx_magical_star_fade',
    'sfx_freeze', 'sfx_shatter',
    'sfx_lightning',
    'sfx_void_body',
    'sfx_quack',
    'sfx_error'
];

const WEAPON_SOUNDS = {
    missile: ['sfx_explosion_small'],
    nuke: ['sfx_explosion_medium'],
    laser: ['sfx_laser_fire', 'sfx_laser_crack', 'sfx_laser_hum'],
    asteroid: ['sfx_launch_heavy', 'sfx_explosion_large'],
    gamma: ['sfx_gamma_charge', 'sfx_gamma_warning', 'sfx_gamma_beam'],
    sword: ['sfx_sword_fly', 'sfx_sword_stab', 'sfx_sword_rumble_loop', 'sfx_sword_pullout', 'sfx_explosion_medium'],
    moon: ['sfx_launch_heavy', 'sfx_mystical_moon_explosion', 'sfx_holy_shine'],
    blackhole: ['sfx_black_hole_spawn', 'sfx_black_hole_disappear'],
    kraken: ['sfx_gamma_charge', 'sfx_void_body'],
    bowling: ['sfx_launch_heavy', 'sfx_bowling_pins'],
    fist: ['sfx_launch_heavy', 'sfx_fist_impact', 'sfx_nom_short'],
    worm: ['sfx_launch_heavy', 'sfx_explosion_medium'],
    star: ['sfx_magical_star_shot', 'sfx_magical_star_shot2', 'sfx_magical_star_fade'],
    comet: ['sfx_launch_heavy', 'sfx_holy_shine', 'sfx_explosion_medium'],
    lightning: ['sfx_lightning', 'sfx_explosion_small']
};

function ensureWeaponSoundsLoaded(weaponType) {
    const ids = WEAPON_SOUNDS[weaponType];
    if (ids && window.soundManager) soundManager.loadMany(ids);
}
ensureWeaponSoundsLoaded(typeof selectedWeapon !== 'undefined' ? selectedWeapon : 'missile');

// Spritesheet Atlas Loading & Extraction Logic
const atlasImage = new Image();
let atlasData = null;

function extractSprite(frameName) {
    if (!atlasData || !atlasImage.complete) {
        return document.createElement('canvas');
    }
    const spriteInfo = atlasData.frames[frameName];
    if (!spriteInfo) return document.createElement('canvas');

    const f = spriteInfo.frame;
    const canvas = document.createElement('canvas');
    canvas.width = spriteInfo.sourceSize.w;
    canvas.height = spriteInfo.sourceSize.h;
    const ctx = canvas.getContext('2d');

    const dx = spriteInfo.spriteSourceSize ? spriteInfo.spriteSourceSize.x : 0;
    const dy = spriteInfo.spriteSourceSize ? spriteInfo.spriteSourceSize.y : 0;

    if (spriteInfo.rotated) {
        // TexturePacker rotates frames 90 degrees CCW to pack them into the atlas.
        // In the atlas, the texture rectangle has width f.h and height f.w at (f.x, f.y).
        // Draw the rotated rectangle upright at (dx, dy).
        ctx.save();
        ctx.translate(dx + f.w, dy);
        ctx.rotate(Math.PI / 2);
        ctx.drawImage(atlasImage, f.x, f.y, f.h, f.w, 0, 0, f.h, f.w);
        ctx.restore();
    } else {
        const sx = f.x;
        const sy = f.y;
        const sw = f.w;
        const sh = f.h;
        const dw = sw;
        const dh = sh;
        ctx.drawImage(atlasImage, sx, sy, sw, sh, dx, dy, dw, dh);
    }
    return canvas;
}

// ─── #29 Asset loader failure handling & automatic retry ───
// A dropped request must not resolve as success: booting with a blank atlas
// crashes later, far from the real cause. Retry with a capped backoff and, if
// the asset is genuinely unreachable, halt boot and tell the player.
const ASSET_MAX_ATTEMPTS = 3;

function assetRetryDelay(attempt) {
    return Math.min(1000 * attempt, 3000);
}

// Cache-bust retries so a cached error response isn't replayed verbatim.
function retryUrl(url, attempt) {
    if (attempt === 1) return url;
    return url + (url.indexOf('?') === -1 ? '?' : '&') + 'retry=' + attempt;
}

function loadImageWithRetry(img, url, label) {
    return new Promise((resolve) => {
        let attempt = 0;
        const tryLoad = () => {
            attempt++;
            img.onload = () => resolve(true);
            img.onerror = () => {
                if (attempt < ASSET_MAX_ATTEMPTS) {
                    console.warn(`Asset load failed (attempt ${attempt}/${ASSET_MAX_ATTEMPTS}): ${label}`);
                    setTimeout(tryLoad, assetRetryDelay(attempt));
                } else {
                    console.error(`Failed to load ${label} after ${ASSET_MAX_ATTEMPTS} attempts`);
                    resolve(false);
                }
            };
            img.src = retryUrl(url, attempt);
        };
        tryLoad();
    });
}

async function fetchJsonWithRetry(url, label) {
    for (let attempt = 1; attempt <= ASSET_MAX_ATTEMPTS; attempt++) {
        try {
            const res = attempt === 1
                ? await fetch(url)
                : await fetch(retryUrl(url, attempt), { cache: 'reload' });
            if (!res.ok) throw new Error('HTTP ' + res.status);
            return await res.json();
        } catch (err) {
            if (attempt < ASSET_MAX_ATTEMPTS) {
                console.warn(`Asset load failed (attempt ${attempt}/${ASSET_MAX_ATTEMPTS}): ${label}`, err);
                await new Promise(r => setTimeout(r, assetRetryDelay(attempt)));
            } else {
                console.error(`Failed to load ${label} after ${ASSET_MAX_ATTEMPTS} attempts`, err);
            }
        }
    }
    return null;
}

// Shows the permanent-failure state on the loading screen. `onRetry` must
// re-issue the real requests — clearing bookkeeping alone would "succeed" with
// the assets still missing.
let loadingFailureRetryBusy = false;
function showLoadingFailureUI(onRetry) {
    const box = document.getElementById('loading-failure');
    const text = document.getElementById('loading-failure-text');
    const btn = document.getElementById('loading-failure-retry');
    const t = translations[currentLanguage] || translations['en'];

    if (text) text.textContent = t.loadFailed || 'LOADING INTERRUPTED\nCheck your connection and try again.';
    if (btn) {
        btn.textContent = t.loadRetry || 'RETRY';
        btn.disabled = false;
    }
    if (loadingStatus) loadingStatus.textContent = '';
    if (!box) {
        console.error('Loading failure UI is missing from the DOM.');
        return;
    }
    box.hidden = false;
    loadingFailureRetryBusy = false;

    if (btn && !btn._retryBound) {
        btn._retryBound = true;
        btn.addEventListener('click', () => {
            if (loadingFailureRetryBusy) return;   // guard double-taps
            loadingFailureRetryBusy = true;
            btn.disabled = true;
            hideLoadingFailureUI();
            setLoadingProgress(20, (translations[currentLanguage] || translations['en']).loadingAssets || 'Loading assets...');
            Promise.resolve(btn._onRetry && btn._onRetry()).catch(err => {
                console.error('Retry attempt failed', err);
            });
        });
    }
    if (btn) btn._onRetry = onRetry;
}

function hideLoadingFailureUI() {
    const box = document.getElementById('loading-failure');
    if (box) box.hidden = true;
}

function extractAtlasSprites() {
    fistImage = extractSprite('fist_punch_up.webp');
    spriteOrange = extractSprite('orange.webp');
    spriteVermillionRed = extractSprite('vermillion_red.webp');
    spriteLightOrange = extractSprite('light_orange.webp');
    spriteWhiteGold = extractSprite('white_gold.webp');
    spriteBrightYellow = extractSprite('bright_yellow.webp');
    spriteSmokeStandard = extractSprite('smoke_standard.webp');
    spriteSmokeMissile = extractSprite('smoke_missile.webp');
    spriteDuck = extractSprite('duck.png');

    // Planet and core glows
    earthGlow = extractSprite('earth-glow.png');
    marsGlow = extractSprite('mars-glow.png');
    neptuneGlow = extractSprite('neptune-glow.png');
    jupiterGlow = extractSprite('jupiter-glow.png');
    neutronStarGlow = extractSprite('neutron-star-glow.png');
    sunCorona = extractSprite('sun-corona.png');
    sunCoreGlow = extractSprite('sun-core-glow.png');
    magmaCoreGlow = extractSprite('magma-core-glow.png');
}

// Resolves true only when BOTH halves of the atlas are actually usable.
// "Request finished" is not "load succeeded" — a missing page or manifest here
// means every sprite in the game would draw blank.
async function loadSpritesAtlas() {
    const [imgOk, data] = await Promise.all([
        loadImageWithRetry(atlasImage, './assets/sprites.png', 'sprites.png'),
        fetchJsonWithRetry('./assets/sprites.json', 'sprites.json')
    ]);

    if (!imgOk || !data) return false;

    atlasData = data;
    extractAtlasSprites();
    return true;
}

setLoadingProgress(40, (translations[currentLanguage] || translations['en']).loadingWeaponAssets || 'Loading weapon assets...');
setLoadingProgress(60, (translations[currentLanguage] || translations['en']).loadingPlanet || 'Generating planet terrain...');

// Cache for radial gradient canvases (pre-rendered for circular_flash performance)
const gradientCanvasCache = {};

function getGradientCanvas(color) {
    let rgbKey = '255, 255, 255';
    if (color) {
        if (color.startsWith('rgba(') || color.startsWith('rgb(')) {
            const match = color.match(/\(([^)]+)\)/);
            if (match) {
                const parts = match[1].split(',');
                if (parts.length >= 3) {
                    rgbKey = `${parts[0].trim()}, ${parts[1].trim()}, ${parts[2].trim()}`;
                }
            }
        } else {
            rgbKey = color; // e.g. "0, 230, 255"
        }
    }

    if (gradientCanvasCache[rgbKey]) {
        return gradientCanvasCache[rgbKey];
    }

    // Create offscreen canvas for caching
    const size = 128;
    const offCanvas = document.createElement('canvas');
    offCanvas.width = size;
    offCanvas.height = size;
    const offCtx = offCanvas.getContext('2d');

    const half = size / 2;
    const grad = offCtx.createRadialGradient(half, half, 0, half, half, half);
    if (!supportsGlow) {
        grad.addColorStop(0, `rgba(${rgbKey}, 0.98)`);
        grad.addColorStop(0.5, `rgba(${rgbKey}, 0.98)`);
        grad.addColorStop(0.52, `rgba(${rgbKey}, 0)`);
    } else {
        grad.addColorStop(0, `rgba(${rgbKey}, 0.98)`);
        grad.addColorStop(0.25, `rgba(${rgbKey}, 0.75)`);
        grad.addColorStop(1, `rgba(${rgbKey}, 0)`);
    }

    offCtx.fillStyle = grad;
    offCtx.beginPath();
    offCtx.arc(half, half, half, 0, Math.PI * 2);
    offCtx.fill();

    gradientCanvasCache[rgbKey] = offCanvas;
    return offCanvas;
}

async function run(mode) {
    // Load spritesheet atlas assets first. #29 — if it is permanently
    // unreachable, halt boot and offer a retry instead of continuing into a
    // session where every sprite is blank. Nothing below has run yet, so
    // re-entering run() from the retry button is safe.
    if (!await loadSpritesAtlas()) {
        showLoadingFailureUI(() => run(mode));
        return;
    }
    hideLoadingFailureUI();

    // #18 — the loading bar must not reach 100% before the sounds it claims to
    // be loading are decoded, or the first tap plays nothing. Capped so a single
    // stalled request can't hold the game hostage; missing sounds degrade to
    // silence and are retried lazily by SoundManager.
    await Promise.race([
        essentialSoundsReady,
        new Promise(resolve => setTimeout(resolve, 8000))
    ]);

    // Wait for local fonts to load to prevent canvas text rendering fallback glitches
    if (document.fonts && typeof document.fonts.ready !== 'undefined') {
        await document.fonts.ready;
    }

    // Initialize the platform bridge interface
    if (window.PlatformBridge) {
        await window.PlatformBridge.init();
    }

    // Initialize global canvas and contexts
    const gameWorld = document.getElementById('game-world');
    canvas = document.getElementById('game-canvas');
    ctx = canvas.getContext('2d');
    hiddenCanvas = document.getElementById('hidden-canvas');
    hiddenCtx = hiddenCanvas.getContext('2d');



    function isSolidPixel(px, py, imgData) {
        if (px < 0 || px >= PLANET_CANVAS_SIZE || py < 0 || py >= PLANET_CANVAS_SIZE) return false;
        const idx = (py * PLANET_CANVAS_SIZE + px) * 4;
        return imgData.data[idx + 3] > 0;
    }
    window.isSolidPixel = isSolidPixel;

    // Intercept hidden canvas modifications to invalidate the cache automatically
    const originalPutImageData = hiddenCtx.putImageData;
    hiddenCtx.putImageData = function (...args) {
        sharedPlanetData = null;
        return originalPutImageData.apply(this, args);
    };

    const originalClearRect = hiddenCtx.clearRect;
    hiddenCtx.clearRect = function (...args) {
        sharedPlanetData = null;
        return originalClearRect.apply(this, args);
    };

    const originalDrawImage = hiddenCtx.drawImage;
    hiddenCtx.drawImage = function (...args) {
        sharedPlanetData = null;
        return originalDrawImage.apply(this, args);
    };

    // Fixed dimensions (logical coordinate space)
    SCREEN_W = 1600;
    SCREEN_H = 900;
    CENTER_X = SCREEN_W / 2;   // 800
    CENTER_Y = SCREEN_H / 2 + PLANET_OFFSET_Y;
    canvas.width = SCREEN_W;
    canvas.height = SCREEN_H;

    // Background canvas for stretching space stars
    bgCanvas = document.getElementById('background-canvas');
    bgCtx = bgCanvas.getContext('2d');

    const gameContainer = document.getElementById('game-container');
    const uiContainer = document.getElementById('ui-container');
    function resizeBackground() {
        // Native 1:1 pixel resolution for crisp stars and nebula rendering
        bgCanvas.width = window.innerWidth;
        bgCanvas.height = window.innerHeight;
        bakeNebulaCanvas(bgCanvas.width, bgCanvas.height);
        if (gameContainer) {
            const scaleY = window.innerHeight / SCREEN_H;
            const isVertical = window.innerHeight > window.innerWidth;
            let scale;
            if (isVertical) {
                const minHeight = window.innerWidth * (12 / 9);
                const targetHeight = Math.max(window.innerHeight, minHeight);
                scale = (targetHeight * 0.64) / SCREEN_H;
            } else {
                scale = scaleY;
            }
            gameContainer.style.transform = `translate(-50%, -50%) scale(${scale})`;
        }
        if (uiContainer) {
            uiContainer.style.width = '100%';
            uiContainer.style.height = '100%';
            uiContainer.style.transform = 'none';
        }
        document.documentElement.style.setProperty('--ui-scale', Math.min(1, window.innerWidth / 1280));

        const scaleHeight = (window.innerHeight * 0.88) / 720;
        const isLandscape = window.innerWidth >= window.innerHeight;
        const baseWidth = isLandscape ? window.innerWidth * 1.15 : 600;
        const scaleWidth = (window.innerWidth * 0.94) / baseWidth;
        const victoryScale = Math.min(scaleWidth, scaleHeight);
        document.documentElement.style.setProperty('--victory-scale', victoryScale);

        // Options popup scale (base size 420x520)
        const optScaleH = (window.innerHeight * 0.88) / 520;
        const optScaleW = (window.innerWidth * 0.94) / 420;
        const optionsScale = Math.min(1.0, Math.min(optScaleW, optScaleH));
        document.documentElement.style.setProperty('--options-scale', optionsScale);

        // Ad spin popup scale (base size 693x572)
        const adScaleH = (window.innerHeight * 0.88) / 572;
        const adScaleW = (window.innerWidth * 0.94) / 693;
        const adSpinScale = Math.min(1.0, Math.min(adScaleW, adScaleH));
        document.documentElement.style.setProperty('--ad-spin-scale', adSpinScale);
    }
    // #19 — ResizeObserver with window.resize fallback for older browsers (iOS < 13.4, Safari < 13.1)
    if (window.ResizeObserver) {
        const _resizeObserver = new ResizeObserver(resizeBackground);
        _resizeObserver.observe(gameWorld);
    } else {
        window.addEventListener('resize', resizeBackground);
    }
    resizeBackground();

    // Translate loading screen
    const loadingTitleEl = document.querySelector('.loading-title');
    const loadingSubtitleEl = document.querySelector('.loading-subtitle');
    if (loadingTitleEl) loadingTitleEl.innerHTML = getTranslation('loadingTitle').replace(' ', '<br>');
    if (loadingSubtitleEl) loadingSubtitleEl.textContent = getTranslation('loadingWeapons');

    // Hidden canvas is fixed (holds static pixel data)
    PLANET_CANVAS_SIZE = 460;
    hiddenCanvas.width = PLANET_CANVAS_SIZE;
    hiddenCanvas.height = PLANET_CANVAS_SIZE;



    MAX_COOLDOWNS = {
        gamma: 30.0,
        asteroid: 1.75,
        moon: 14.0,
        sword: 10.0,
        mysterybox: 10.0,
        bowling: 0.35,
        kraken: 8.5,
        worm: 35.0,
        blackhole: 45.0,
        laser: 11.0,
        fist: 20.0,
        star: 15.0,
        comet: 1.5,
        lightning: 1.0,
        drill: 1.5
    };

    // ── Cached DOM references (avoids per-frame getElementById / querySelector) ──
    const _dom = {
        gammaBtn: document.getElementById('btn-gamma'),
        gammaUi: document.getElementById('gamma-cooldown-ui'),
        laserBtn: document.getElementById('btn-laser'),
        laserUi: document.getElementById('laser-cooldown-ui'),
        asteroidBtn: document.getElementById('btn-asteroid'),
        asteroidUi: document.getElementById('asteroid-cooldown-ui'),
        swordBtn: document.getElementById('btn-sword'),
        swordUi: document.getElementById('sword-cooldown-ui'),
        mysteryboxBtn: document.getElementById('btn-mysterybox'),
        mysteryboxUi: document.getElementById('mysterybox-cooldown-ui'),
        bowlingBtn: document.getElementById('btn-bowling'),
        bowlingUi: document.getElementById('bowling-cooldown-ui'),
        krakenBtn: document.getElementById('btn-kraken'),
        krakenUi: document.getElementById('kraken-cooldown-ui'),
        wormBtn: document.getElementById('btn-worm'),
        wormUi: document.getElementById('worm-cooldown-ui'),
        blackholeBtn: document.getElementById('btn-blackhole'),
        blackholeUi: document.getElementById('blackhole-cooldown-ui'),
        fistBtn: document.getElementById('btn-fist'),
        fistUi: document.getElementById('fist-cooldown-ui'),
        moonBtn: document.getElementById('btn-moon'),
        moonUi: document.getElementById('moon-cooldown-ui'),
        starBtn: document.getElementById('btn-star'),
        starUi: document.getElementById('star-cooldown-ui'),
        cometBtn: document.getElementById('btn-comet'),
        cometUi: document.getElementById('comet-cooldown-ui'),
        lightningBtn: document.getElementById('btn-lightning'),
        lightningUi: document.getElementById('lightning-cooldown-ui'),
        drillBtn: document.getElementById('btn-drill'),
        drillUi: document.getElementById('drill-cooldown-ui'),
        uiOverlay: document.querySelector('.ui-overlay'),
        massText: document.getElementById('mass-text'),
        massBar: document.getElementById('mass-bar'),
        statusLed: document.getElementById('hud-status-led'),
        flashOverlay: document.getElementById('screen-flash-overlay')
    };
    // Pre-resolve child elements for cooldown UIs
    const _cdChildren = {};
    ['gamma', 'laser', 'lightning', 'asteroid', 'sword', 'mysterybox', 'bowling', 'kraken', 'worm', 'blackhole', 'fist', 'moon', 'star', 'comet', 'drill'].forEach(name => {
        const ui = _dom[name + 'Ui'];
        _cdChildren[name] = ui ? {
            text: ui.querySelector('.cooldown-text'),
            bar: ui.querySelector('.cooldown-bar')
        } : { text: null, bar: null };
    });

    // ── Switch-weapon tooltip state ──
    const _switchTooltip = {
        el: document.getElementById('switch-weapon-tooltip'),
        arrowEl: null,
        timer: 0,           // seconds elapsed since conditions first met
        shown: false,       // currently visible
        dismissed: false,   // permanently dismissed this session
        DELAY: 14.5           // seconds before showing
    };
    if (_switchTooltip.el) {
        _switchTooltip.arrowEl = _switchTooltip.el.querySelector('.tooltip-arrow');
        _switchTooltip.labelEl = _switchTooltip.el.querySelector('.tooltip-label');
    }
    function _applySwitchTooltipLabel() {
        if (!_switchTooltip.labelEl) return;
        const t = translations[currentLanguage] || translations['en'];
        _switchTooltip.labelEl.textContent = t.switchWeapons || 'CLICK TO\nSWITCH WEAPONS';
    }
    _applySwitchTooltipLabel();

    // ── New-weapon tooltip state ──
    const _newWeaponTooltip = {
        el: document.getElementById('new-weapon-tooltip'),
        arrowEl: null,
        shown: false,
        timer: 0,
        DURATION: 9 // seconds to display
    };
    if (_newWeaponTooltip.el) {
        _newWeaponTooltip.arrowEl = _newWeaponTooltip.el.querySelector('.tooltip-arrow');
    }

    window.showNewWeaponUnlockTooltip = function () {
        if (!_newWeaponTooltip.el) return;
        _newWeaponTooltip.shown = true;
        _newWeaponTooltip.timer = 0;
        _newWeaponTooltip.el.classList.add('visible');
        _updateNewWeaponTooltipPosition();
    };

    window.dismissNewWeaponTooltip = function () {
        if (!_newWeaponTooltip.shown) return;
        _newWeaponTooltip.shown = false;
        if (_newWeaponTooltip.el) {
            _newWeaponTooltip.el.classList.remove('visible');
        }
    };

    function _updateNewWeaponTooltipPosition() {
        const tip = _newWeaponTooltip.el;
        if (!tip) return;
        const weaponBar = document.querySelector('.weapon-bar-wrapper');
        if (!weaponBar) return;
        const rect = weaponBar.getBoundingClientRect();
        const isPortrait = window.innerHeight > window.innerWidth;
        tip.classList.remove('tooltip-portrait', 'tooltip-landscape');
        if (isPortrait) {
            // Portrait: above the weapon bar, arrow pointing DOWN
            tip.classList.add('tooltip-portrait');
            if (_newWeaponTooltip.arrowEl) _newWeaponTooltip.arrowEl.textContent = '▼';
            const tipW = tip.offsetWidth || 160;
            const tipH = tip.offsetHeight || 70;

            const scrollBtn = document.getElementById('scroll-right-btn');
            let left = rect.left + rect.width / 2 - tipW / 2; // Default fallback
            if (scrollBtn) {
                const scrollRect = scrollBtn.getBoundingClientRect();
                if (scrollRect.left > 0) {
                    left = scrollRect.left + scrollRect.width / 2 - tipW / 2;
                }
            }
            // Clamp so it's not off screen horizontally
            left = Math.max(8, Math.min(left, window.innerWidth - tipW - 8));

            const top = rect.top - tipH - 18;
            tip.style.left = left + 'px';
            tip.style.top = Math.max(8, top) + 'px';
        } else {
            // Landscape: left of the weapon bar, arrow pointing RIGHT
            tip.classList.add('tooltip-landscape');
            if (_newWeaponTooltip.arrowEl) _newWeaponTooltip.arrowEl.textContent = '▶';
            const tipW = tip.offsetWidth || 180;
            const tipH = tip.offsetHeight || 54;
            const left = rect.left - tipW - 18;

            const scrollBtn = document.getElementById('scroll-right-btn');
            let top = rect.top + rect.height / 2 - tipH / 2; // Default fallback
            if (scrollBtn) {
                const scrollRect = scrollBtn.getBoundingClientRect();
                if (scrollRect.top > 0) {
                    top = scrollRect.top + scrollRect.height / 2 - tipH / 2;
                }
            }
            tip.style.left = Math.max(8, left) + 'px';
            tip.style.top = Math.max(8, top) + 'px';
        }
    }

    function _updateSwitchTooltipPosition() {
        const tip = _switchTooltip.el;
        if (!tip) return;
        const weaponBar = document.querySelector('.weapon-bar-wrapper');
        if (!weaponBar) return;
        const rect = weaponBar.getBoundingClientRect();
        const isPortrait = window.innerHeight > window.innerWidth;
        tip.classList.remove('tooltip-portrait', 'tooltip-landscape');
        if (isPortrait) {
            // Portrait: above the weapon bar, arrow pointing DOWN
            tip.classList.add('tooltip-portrait');
            if (_switchTooltip.arrowEl) _switchTooltip.arrowEl.textContent = '▼';
            const tipW = tip.offsetWidth || 160;
            const tipH = tip.offsetHeight || 70;
            const left = rect.left + rect.width / 2 - tipW / 2;
            const top = rect.top - tipH - 14;
            tip.style.left = Math.max(8, left) + 'px';
            tip.style.top = Math.max(8, top) + 'px';
        } else {
            // Landscape: left of the weapon bar, arrow pointing RIGHT
            tip.classList.add('tooltip-landscape');
            if (_switchTooltip.arrowEl) _switchTooltip.arrowEl.textContent = '▶';
            const tipW = tip.offsetWidth || 180;
            const tipH = tip.offsetHeight || 54;
            const left = rect.left - tipW - 14;
            const top = rect.top + rect.height / 2 - tipH / 2;
            tip.style.left = Math.max(8, left) + 'px';
            tip.style.top = Math.max(8, top) + 'px';
        }
    }

    function update(deltaTime) {
        deltaTime = Math.min(deltaTime, 0.11);
        dt60 = deltaTime * 60;

        function updateCooldownWeapon(id, getCd, setCd, getInitCd, setInitCd, defaultMaxCd) {
            const btn = _dom[id + 'Btn'];
            const ui = _dom[id + 'Ui'];
            if (!unlockedWeapons.includes(id)) {
                if (btn) btn.classList.add('cooldown-active');
                if (ui) {
                    const text = _cdChildren[id].text;
                    const bar = _cdChildren[id].bar;
                    if (text) text.textContent = getTranslation('locked');
                    if (bar) bar.style.height = '100%';
                }
            } else {
                let cd = getCd();
                if (cd > 0) {
                    cd -= deltaTime;
                    if (cd <= 0) {
                        cd = 0;
                        if (btn) {
                            btn.classList.add('weapon-ready-glow');
                            setTimeout(() => btn.classList.remove('weapon-ready-glow'), 600);
                        }
                        if (getInitCd()) {
                            showUnlockNotification(getUnlockText(id));
                            setInitCd(false);
                        }
                    }
                    setCd(cd);
                }
                if (cd > 0) {
                    if (btn) btn.classList.add('cooldown-active');
                    if (ui) {
                        const text = _cdChildren[id].text;
                        const bar = _cdChildren[id].bar;
                        const maxCd = getInitCd() ? (id === 'blackhole' ? 240.0 : 1.25) : defaultMaxCd;
                        if (text) text.textContent = `${Math.ceil(cd)}s`;
                        if (bar) bar.style.height = `${Math.min(100, (cd / maxCd) * 100)}%`;
                    }
                } else {
                    if (btn) btn.classList.remove('cooldown-active');
                    if (ui) {
                        const text = _cdChildren[id].text;
                        const bar = _cdChildren[id].bar;
                        if (text) text.textContent = '';
                        if (bar) bar.style.height = '0%';
                    }
                }
            }
        }

        if (!victoryTriggered) {
            planetTimeSpent += deltaTime;
        }

        if (window.ShootingStarManager) {
            window.ShootingStarManager.update(deltaTime);
        }

        // Planet scale transition (User feature 5)
        if (isPlanetSwitching) {
            zoomProgress -= deltaTime * (1 / 0.28); // Fade out over 0.28s
            if (zoomProgress <= 0) {
                zoomProgress = 0;
            }
            // Zoom away with cubic ease-in (starts slow, accelerates to fast scale-down)
            planetScale = 1 - cubicEaseIn(1 - zoomProgress);
        } else if (zoomProgress < 1.0) {
            zoomProgress += deltaTime * (1 / ZOOM_DURATION);
            if (zoomProgress > 1.0) zoomProgress = 1.0;

            // Cubic.easeOut tween: start at 0.7, end at 1.0
            const eased = cubicEaseOut(zoomProgress);
            planetScale = 0.2 + (0.8 * eased);
        }

        if (mode === 'play') {
            // Handle continuous missile auto-launch
            if (isHolding && selectedWeapon === 'missile' && !victoryTriggered) {
                missileLaunchTimer += deltaTime;
                while (missileLaunchTimer >= 0.2) {
                    spawnWeapon(pointerX, pointerY);
                    missileLaunchTimer -= 0.2;
                }
            } else {
                missileLaunchTimer = 0;
            }

            // Handle continuous laser strikes
            if (isHolding && selectedWeapon === 'laser' && !victoryTriggered && laserCooldown <= 0) {
                laserHoldTime += deltaTime;
                // Laser hum: start loop if not playing, ramp volume based on hold time (35% quieter overall)
                if (!soundManager.activeLoops['sfx_laser_hum']) {
                    soundManager.play('sfx_laser_hum', true, 0.024);
                }
                // Volume ramp: 0.024 at start, 0.17 at tier2 (1.1s), 0.4875 at tier3 (3.0s)
                let humVol = 0.024;
                if (laserHoldTime <= 1.1) {
                    humVol = 0.024 + (laserHoldTime / 1.1) * 0.146;
                } else if (laserHoldTime <= 3.0) {
                    humVol = 0.17 + ((laserHoldTime - 1.1) / 1.9) * 0.3175;
                } else {
                    humVol = 0.4875;
                }
                soundManager.setLoopVolume('sfx_laser_hum', humVol);
                // Flicker transition before tier 2 enhancement
                if (laserHoldTime > 0.9 && !laserFlickerTriggered) {
                    laserFlickerTriggered = true;
                    laserFlickerTime = 0.2;
                    screenShake = { x: 0, y: 0, intensity: 10, duration: 100 };
                    soundManager.play('sfx_laser_crack', false, 0.6, -600);
                    screenFlash.alpha = 0.1;
                    screenFlash.r = 0; screenFlash.g = 0; screenFlash.b = 0;
                }
                // Flicker transition before tier 3 enhancement
                if (laserHoldTime > 2.8 && !laserFlicker2Triggered) {
                    laserFlicker2Triggered = true;
                    laserFlicker2Time = 0.2;
                    screenShake = { x: 0, y: 0, intensity: 28, duration: 180 };
                    soundManager.play('sfx_laser_crack', false, 0.8, -1200);
                    screenFlash.alpha = 0.3;
                    screenFlash.r = 0; screenFlash.g = 0; screenFlash.b = 0;
                }
                if (laserFlickerTime > 0) {
                    laserFlickerTime -= deltaTime;
                    laserEnhanced = false;
                    laserTier3 = false;
                } else if (laserFlicker2Time > 0) {
                    laserFlicker2Time -= deltaTime;
                    laserEnhanced = true;
                    laserTier3 = false;
                } else {
                    laserEnhanced = laserHoldTime > 1.1;
                    laserTier3 = laserHoldTime > 3.0;
                }

                const currentTier = laserTier3 ? 3 : (laserEnhanced ? 2 : 1);
                if (currentTier > lastLaserTier) {
                    if (currentTier === 2) {
                        screenShake = { x: 0, y: 0, intensity: 12, duration: 120 };
                    } else if (currentTier === 3) {
                        screenShake = { x: 0, y: 0, intensity: 24, duration: 180 };
                    }
                    lastLaserTier = currentTier;
                }

                const laserInterval = laserTier3 ? 0.05 : (laserEnhanced ? 0.06 : 0.075);
                const laserExplosionSize = laserTier3 ? 12 + 1.5 : (laserEnhanced ? 12 : 8);
                const angle = Math.atan2(pointerY - CENTER_Y, pointerX - CENTER_X);
                const spawnRadius = getConfigValue('gameplay.spawnDistance', 300);
                const spawnX = CENTER_X + Math.cos(angle) * spawnRadius;
                const spawnY = CENTER_Y + Math.sin(angle) * spawnRadius;

                lastLaserImpact = findLaserImpactWithData(spawnX, spawnY, getSharedPlanetData());

                laserLaunchTimer += deltaTime;
                while (laserLaunchTimer >= laserInterval) {
                    if (lastLaserImpact && lastLaserImpact.local) {
                        const laserShake = (currentTier === 1) ? 0 : 2;
                        createExplosion(lastLaserImpact.local.x, lastLaserImpact.local.y, laserExplosionSize, laserShake, 'laser', false, true);
                    }
                    if (laserTier3) {
                        laserPulseCount++;
                    }
                    laserLaunchTimer -= laserInterval;
                }
            } else {
                laserLaunchTimer = 0;
                laserHoldTime = 0;
                laserEnhanced = false;
                laserTier3 = false;
                laserFlickerTriggered = false;
                laserFlickerTime = 0;
                laserFlicker2Triggered = false;
                laserFlicker2Time = 0;
                lastLaserImpact = null;
                lastLaserTier = 1;
                laserPulseCount = 0;
                if (activeBlackHoles.length === 0) {
                    soundManager.stopLoop('sfx_laser_hum');
                }
            }

            // Handle Gamma Burst Cooldown UI ticking
            const gammaBtn = _dom.gammaBtn;
            const gammaUi = _dom.gammaUi;
            if (gammaBurstCooldown > 0) {
                gammaBurstCooldown -= deltaTime;
                if (gammaBurstCooldown <= 0) {
                    gammaBurstCooldown = 0;
                    if (gammaBtn) {
                        gammaBtn.classList.add('weapon-ready-glow');
                        setTimeout(() => gammaBtn.classList.remove('weapon-ready-glow'), 600);
                    }
                    if (isInitialGammaCooldown) {
                        showUnlockNotification(getUnlockText('gamma'));
                        isInitialGammaCooldown = false;
                    }
                }
                if (gammaBtn) gammaBtn.classList.add('cooldown-active');
                if (gammaUi) {
                    const text = _cdChildren.gamma.text;
                    const bar = _cdChildren.gamma.bar;
                    if (text) text.textContent = `${Math.ceil(gammaBurstCooldown)}s`;
                    if (bar) bar.style.height = `${Math.min(100, (gammaBurstCooldown / MAX_COOLDOWNS.gamma) * 100)}%`;
                }
            } else {
                if (gammaBtn) gammaBtn.classList.remove('cooldown-active');
                if (gammaUi) {
                    const text = _cdChildren.gamma.text;
                    const bar = _cdChildren.gamma.bar;
                    if (text) text.textContent = '';
                    if (bar) bar.style.height = '0%';
                }
            }

            // Handle Laser Cooldown UI ticking
            const laserBtn = _dom.laserBtn;
            const laserUi = _dom.laserUi;
            if (laserCooldown > 0) {
                laserCooldown -= deltaTime;
                if (laserCooldown <= 0) {
                    laserCooldown = 0;
                    if (laserBtn) {
                        laserBtn.classList.add('weapon-ready-glow');
                        setTimeout(() => laserBtn.classList.remove('weapon-ready-glow'), 600);
                    }
                    if (isInitialLaserCooldown) {
                        showUnlockNotification(getUnlockText('laser'));
                        isInitialLaserCooldown = false;
                    }
                }
                if (laserBtn) laserBtn.classList.add('cooldown-active');
                if (laserUi) {
                    const text = _cdChildren.laser.text;
                    const bar = _cdChildren.laser.bar;
                    if (text) text.textContent = `${Math.ceil(laserCooldown)}s`;
                    if (bar) bar.style.height = `${(laserCooldown / MAX_COOLDOWNS.laser) * 100}%`;
                }
            } else {
                if (laserBtn) laserBtn.classList.remove('cooldown-active');
                if (laserUi) {
                    const text = _cdChildren.laser.text;
                    const bar = _cdChildren.laser.bar;
                    if (text) text.textContent = '';
                    if (bar) bar.style.height = '0%';
                }
            }

            // Handle Lightning Cooldown UI ticking
            updateCooldownWeapon('lightning', () => lightningCooldown, v => lightningCooldown = v, () => isInitialLightningCooldown, v => isInitialLightningCooldown = v, MAX_COOLDOWNS.lightning);

            // Handle Nuke Cooldown
            if (nukeCooldown > 0) {
                nukeCooldown -= deltaTime;
                if (nukeCooldown < 0) nukeCooldown = 0;
            }

            // Handle Drill Cooldown UI ticking
            updateCooldownWeapon('drill', () => drillCooldown, v => drillCooldown = v, () => isInitialDrillCooldown, v => isInitialDrillCooldown = v, MAX_COOLDOWNS.drill);

            // Handle Missile Cooldown
            if (missileCooldown > 0) {
                missileCooldown -= deltaTime;
                if (missileCooldown < 0) missileCooldown = 0;
            }

            // Handle Asteroid Cooldown UI ticking
            updateCooldownWeapon('asteroid', () => asteroidCooldown, v => asteroidCooldown = v, () => isInitialAsteroidCooldown, v => isInitialAsteroidCooldown = v, MAX_COOLDOWNS.asteroid);

            // Handle Sword Cooldown UI ticking
            updateCooldownWeapon('sword', () => swordCooldown, v => swordCooldown = v, () => isInitialSwordCooldown, v => isInitialSwordCooldown = v, MAX_COOLDOWNS.sword);

            // Handle Mystery Box Cooldown UI ticking
            updateCooldownWeapon('mysterybox', () => mysteryboxCooldown, v => mysteryboxCooldown = v, () => isInitialMysteryBoxCooldown, v => isInitialMysteryBoxCooldown = v, MAX_COOLDOWNS.mysterybox);

            // Handle Bowling Cooldown UI ticking
            updateCooldownWeapon('bowling', () => bowlingCooldown, v => bowlingCooldown = v, () => isInitialBowlingCooldown, v => isInitialBowlingCooldown = v, MAX_COOLDOWNS.bowling);

            // Handle Kraken (Cthulhu) Cooldown UI ticking
            updateCooldownWeapon('kraken', () => krakenCooldown, v => krakenCooldown = v, () => isInitialKrakenCooldown, v => isInitialKrakenCooldown = v, MAX_COOLDOWNS.kraken);

            // Handle Worm Cooldown UI ticking
            updateCooldownWeapon('worm', () => wormCooldown, v => wormCooldown = v, () => isInitialWormCooldown, v => isInitialWormCooldown = v, MAX_COOLDOWNS.worm);

            // Handle Black Hole Cooldown UI ticking
            updateCooldownWeapon('blackhole', () => blackholeCooldown, v => blackholeCooldown = v, () => isInitialBlackholeCooldown, v => isInitialBlackholeCooldown = v, MAX_COOLDOWNS.blackhole);

            // Handle Fist Cooldown UI ticking
            updateCooldownWeapon('fist', () => fistCooldown, v => fistCooldown = v, () => isInitialFistCooldown, v => isInitialFistCooldown = v, MAX_COOLDOWNS.fist);

            // Handle Moon Cooldown UI ticking
            updateCooldownWeapon('moon', () => moonCooldown, v => moonCooldown = v, () => isInitialMoonCooldown, v => isInitialMoonCooldown = v, MAX_COOLDOWNS.moon);

            // Handle Star Cooldown UI ticking
            updateCooldownWeapon('star', () => starCooldown, v => starCooldown = v, () => isInitialStarCooldown, v => isInitialStarCooldown = v, MAX_COOLDOWNS.star);

            // Handle Comet Cooldown UI ticking
            updateCooldownWeapon('comet', () => cometCooldown, v => cometCooldown = v, () => isInitialCometCooldown, v => isInitialCometCooldown = v, MAX_COOLDOWNS.comet);

            // Check Weapon Queues
            if (nukeCooldown <= 0 && weaponQueues['nuke']) {
                const q = weaponQueues['nuke'];
                delete weaponQueues['nuke'];
                spawnWeapon(q.x, q.y, 'nuke');
            }
            if (missileCooldown <= 0 && weaponQueues['missile']) {
                const q = weaponQueues['missile'];
                delete weaponQueues['missile'];
                spawnWeapon(q.x, q.y, 'missile');
            }
            if (laserCooldown <= 0 && weaponQueues['laser']) {
                const q = weaponQueues['laser'];
                delete weaponQueues['laser'];
                spawnWeapon(q.x, q.y, 'laser');
            }
            if (asteroidCooldown <= 0 && weaponQueues['asteroid']) {
                const q = weaponQueues['asteroid'];
                delete weaponQueues['asteroid'];
                spawnWeapon(q.x, q.y, 'asteroid');
            }
            if (moonCooldown <= 0 && weaponQueues['moon']) {
                const q = weaponQueues['moon'];
                delete weaponQueues['moon'];
                spawnWeapon(q.x, q.y, 'moon');
            }
            if (swordCooldown <= 0 && weaponQueues['sword']) {
                const q = weaponQueues['sword'];
                delete weaponQueues['sword'];
                spawnWeapon(q.x, q.y, 'sword');
            }
            if (krakenCooldown <= 0 && weaponQueues['kraken']) {
                const q = weaponQueues['kraken'];
                delete weaponQueues['kraken'];
                spawnWeapon(q.x, q.y, 'kraken');
            }
            if (bowlingCooldown <= 0 && weaponQueues['bowling']) {
                const q = weaponQueues['bowling'];
                delete weaponQueues['bowling'];
                spawnWeapon(q.x, q.y, 'bowling');
            }
            if (fistCooldown <= 0 && weaponQueues['fist']) {
                const q = weaponQueues['fist'];
                delete weaponQueues['fist'];
                spawnWeapon(q.x, q.y, 'fist');
            }
            if (starCooldown <= 0 && weaponQueues['star']) {
                const q = weaponQueues['star'];
                delete weaponQueues['star'];
                spawnWeapon(q.x, q.y, 'star');
            }
            if (cometCooldown <= 0 && weaponQueues['comet']) {
                const q = weaponQueues['comet'];
                delete weaponQueues['comet'];
                spawnWeapon(q.x, q.y, 'comet');
            }
            if (wormCooldown <= 0 && weaponQueues['worm']) {
                const q = weaponQueues['worm'];
                delete weaponQueues['worm'];
                spawnWeapon(q.x, q.y, 'worm');
            }
            if (blackholeCooldown <= 0 && weaponQueues['blackhole']) {
                const q = weaponQueues['blackhole'];
                delete weaponQueues['blackhole'];
                spawnWeapon(q.x, q.y, 'blackhole');
            }
            if (gammaBurstCooldown <= 0 && weaponQueues['gamma']) {
                const q = weaponQueues['gamma'];
                delete weaponQueues['gamma'];
                spawnWeapon(q.x, q.y, 'gamma');
            }

            // Handle Lightning hold time increment
            if (isHolding && selectedWeapon === 'lightning' && !victoryTriggered && lightningCooldown <= 0) {
                lightningHoldTime += deltaTime;
                const chargeCount = Math.floor(lightningHoldTime / 0.3);
                if (chargeCount > lightningLastChargedCount && chargeCount <= 7) {
                    lightningLastChargedCount = chargeCount;
                    // Play sfx_laser_crack detuned low to start and rising in detune with each bolt
                    const detune = -800 + (chargeCount - 1) * 300;
                    soundManager.play('sfx_laser_crack', false, 0.75, detune);
                    // Shake the bar and make it briefly glow white each time a new lightning bolt is charged up
                    lightningChargeFlashTimer = 0.15;
                    lightningChargeShakeTimer = 0.15;
                }
            } else {
                if (!isHolding || selectedWeapon !== 'lightning') {
                    lightningLastChargedCount = 0;
                }
            }

            if (lightningChargeFlashTimer > 0) {
                lightningChargeFlashTimer -= deltaTime;
            }
            if (lightningChargeShakeTimer > 0) {
                lightningChargeShakeTimer -= deltaTime;
            }

            // Handle Lightning Queue strikes
            if (lightningQueue.length > 0) {
                for (let i = lightningQueue.length - 1; i >= 0; i--) {
                    const strike = lightningQueue[i];
                    strike.delay -= deltaTime;
                    if (strike.delay <= 0) {
                        fireLightning(pointerX, pointerY, strike.chargeIndex || 1);
                        if (strike.totalCharges >= 3 && strike.chargeIndex === strike.totalCharges - 2) {
                            soundManager.play('sfx_lightning');
                        }
                        if (strike.totalCharges >= 6 && strike.chargeIndex === strike.totalCharges - 2) {
                            soundManager.play('sfx_mystical_moon_explosion', false, 0.25);
                        }
                        lightningQueue.splice(i, 1);
                    }
                }
            }

            // Handle Active Lightnings lifetime decrement
            if (activeLightnings.length > 0) {
                for (let i = activeLightnings.length - 1; i >= 0; i--) {
                    activeLightnings[i].life -= deltaTime;
                    if (activeLightnings[i].life <= 0) {
                        activeLightnings.splice(i, 1);
                    }
                }
            }

            // Update floating texts
            for (let i = floatingTexts.length - 1; i >= 0; i--) {
                const ft = floatingTexts[i];
                ft.life -= deltaTime;
                if (ft.life <= 0) {
                    floatingTexts.splice(i, 1);
                    _releaseFloatingText(ft); // return to pool (#6 GC optimisation)
                }
            }

            // ── Switch-weapon tooltip logic ──
            if (_switchTooltip.el && !_switchTooltip.dismissed && !victoryTriggered) {
                const marsUnlocked = unlockedPlanets.includes('mars');
                const isMissileSelected = selectedWeapon === 'missile';
                const nukeAmmoFull = (typeof weaponAmmo !== 'undefined' && weaponAmmo.nuke >= 18);
                const conditionsMet = !marsUnlocked && isMissileSelected && nukeAmmoFull;

                if (conditionsMet) {
                    _switchTooltip.timer += deltaTime;
                } else {
                    _switchTooltip.timer = 0;
                    if (_switchTooltip.shown) {
                        _switchTooltip.shown = false;
                        _switchTooltip.el.classList.remove('visible');
                    }
                }

                if (!_switchTooltip.shown && _switchTooltip.timer >= _switchTooltip.DELAY) {
                    _switchTooltip.shown = true;
                    _switchTooltip.el.classList.add('visible');
                    _updateSwitchTooltipPosition();
                }
                if (_switchTooltip.shown) {
                    _updateSwitchTooltipPosition();
                }
            }

            // ── New-weapon tooltip logic ──
            if (_newWeaponTooltip.el && _newWeaponTooltip.shown && !victoryTriggered) {
                _newWeaponTooltip.timer += deltaTime;
                if (_newWeaponTooltip.timer >= _newWeaponTooltip.DURATION) {
                    window.dismissNewWeaponTooltip();
                } else {
                    _updateNewWeaponTooltipPosition();
                }
            }

            // Update active gamma bursts (independent of active selectedWeapon!)
            for (let i = activeGammaBursts.length - 1; i >= 0; i--) {
                const gb = activeGammaBursts[i];
                if (!gb.active) {
                    gb.warningTime -= deltaTime;
                    gb.warningTimer += deltaTime;
                    if (gb.warningTime <= 0) {
                        gb.active = true;
                        gb.strikeTimer = 0.25; // Trigger immediate strike upon activation
                        soundManager.play('sfx_gamma_beam', true);
                    }
                } else if (gb.shrinking) {
                    // Tick the shrink timer
                    gb.shrinkTimer -= deltaTime;
                    if (gb.shrinkTimer <= 0) {
                        soundManager.stopLoop('sfx_gamma_beam');
                        activeGammaBursts.splice(i, 1);
                    }
                } else {
                    // Active damage phase
                    gb.beamTime -= deltaTime;
                    gb.strikeTimer += deltaTime;

                    while (gb.strikeTimer >= 0.25 && gb.hitsRemaining > 0) {
                        // Create a very brief 0.5 alpha white flash when gamma burst creates its first or second-to-last round of explosions
                        if (gb.hitsRemaining === 8 || gb.hitsRemaining === 2) {
                            screenFlash.alpha = 0.5;
                            screenFlash.r = 255; screenFlash.g = 255; screenFlash.b = 255;
                        }

                        const spawnRadius = getConfigValue('gameplay.spawnDistance', 300);
                        const spawnX = CENTER_X + Math.cos(gb.angle) * spawnRadius;
                        const spawnY = CENTER_Y + Math.sin(gb.angle) * spawnRadius;
                        const perpAngle = gb.angle + Math.PI / 2;

                        // Main beam direction (toward planet center) — all sub-beams must be parallel to this
                        const beamDirX = CENTER_X - spawnX;
                        const beamDirY = CENTER_Y - spawnY;

                        // Fetch the pixel buffer ONCE for this entire tick's 10-ray sweep via shared cache
                        const sharedImgData = getSharedPlanetData();

                        let anyHit = false;
                        let playedStrikeSound = false;
                        for (let step = 1; step <= 5; step++) {
                            for (let side of [-1, 1]) {
                                const offsetDist = side * (step - 0.5) * 25;
                                const lSpawnX = spawnX + Math.cos(perpAngle) * offsetDist;
                                const lSpawnY = spawnY + Math.sin(perpAngle) * offsetDist;

                                // Pass the fixed beam direction so the ray stays parallel, not aimed at center
                                const impact = findLaserImpactWithData(lSpawnX, lSpawnY, sharedImgData, beamDirX, beamDirY);
                                if (impact.local) {
                                    if (!playedStrikeSound) {
                                        const detune = (Math.random() - 0.5) * 400;
                                        soundManager.play('sfx_laser_crack', false, 1.0, detune);
                                        playedStrikeSound = true;
                                    }
                                    // Erase + spawn particles but skip collapseTerrain/CoM (batched below)
                                    createExplosionRaw(impact.local.x, impact.local.y, 15, 'gamma');
                                    anyHit = true;
                                }
                            }
                        }

                        // Run the heavy passes exactly once for all hits this tick
                        if (anyHit) {
                            collapseTerrain();
                            const remainingPixels = calculateCenterOfMass();
                            if (!victoryTriggered) {
                                const massPct = (remainingPixels / initialPixelCount) * 100;
                                if (massPct < getConfigValue('gameplay.victoryThreshold', 1.75)) {
                                    triggerVictory();
                                }
                            }
                        }

                        // Apply a heavy screen shake for the massive burst!
                        screenShake = {
                            x: 0,
                            y: 0,
                            intensity: 18,
                            duration: 200
                        };

                        gb.hitsRemaining--;
                        gb.strikeTimer -= 0.25;
                    }

                    if (gb.beamTime <= 0 || gb.hitsRemaining <= 0) {
                        // Transition to shrink phase instead of immediate cleanup
                        gb.shrinking = true;
                        gb.shrinkTimer = gb.shrinkDuration;
                    }
                }
            }

            // Update active swords
            let stuckCount = 0;
            for (let i = activeSwords.length - 1; i >= 0; i--) {
                const w = activeSwords[i];
                if (w.state === 'flying') {
                    // Rapidly accelerate speed in flight
                    w.speed += deltaTime * 65;
                    w.vx = Math.cos(w.angle) * w.speed;
                    w.vy = Math.sin(w.angle) * w.speed;

                    w.x += w.vx * dt60;
                    w.y += w.vy * dt60;

                    // Calculate distance squared to the center of the planet
                    const sDx = w.x - CENTER_X;
                    const sDy = w.y - CENTER_Y;
                    const currentDistSq = sDx * sDx + sDy * sDy;

                    let forcedStuck = false;
                    if (w.lastDistanceSq !== undefined && w.lastDistanceSq !== null && currentDistSq < 10000 && currentDistSq > w.lastDistanceSq) {
                        forcedStuck = true;
                    }
                    w.lastDistanceSq = currentDistSq;

                    // Check collision with planet silhouette
                    const local = screenToLocal(w.x, w.y, CENTER_X, CENTER_Y, planetRotation);
                    let hitTerrain = false;

                    if (local.x >= 0 && local.x < hiddenCanvas.width &&
                        local.y >= 0 && local.y < hiddenCanvas.height) {
                        const px = Math.floor(local.x);
                        const py = Math.floor(local.y);
                        if (isSolidPixel(px, py, getSharedPlanetData())) {
                            hitTerrain = true;
                        }
                    }

                    if (hitTerrain || forcedStuck) {
                        // Make contact!
                        soundManager.stopLoop('sfx_sword_fly');
                        soundManager.play('sfx_sword_stab');
                        w.state = 'penetrating';
                        w.contactX = w.x;
                        w.contactY = w.y;
                        w.targetX = w.x + Math.cos(w.angle) * 70; // 70px penetration depth
                        w.targetY = w.y + Math.sin(w.angle) * 70; // 70px penetration depth
                        w.penetrateTimer = 0.06; // Highly satisfying rapid stab (0.06s)

                        // Spawn dust particles flying away from the center of Earth in a 140-degree arc
                        const angleAway = Math.atan2(w.y - CENTER_Y, w.x - CENTER_X);
                        for (let p = 0; p < 25; p++) {
                            const spreadAngle = angleAway + (Math.random() - 0.5) * (140 * Math.PI / 180);
                            const pSpeed = Math.random() * 3.5 + 1.5;
                            particles.push({
                                x: w.x,
                                y: w.y,
                                vx: Math.cos(spreadAngle) * pSpeed,
                                vy: Math.sin(spreadAngle) * pSpeed,
                                life: 1.0,
                                maxLife: Math.random() * 0.8 + 0.6,
                                size: Math.random() * 5 + 3,
                                color: `rgba(${Math.random() * 40 + 120}, ${Math.random() * 30 + 110}, ${Math.random() * 30 + 100}, ${0.5 + Math.random() * 0.4})`, // high-fidelity dust smoke HSL/RGBA
                                type: 'smoke'
                            });
                        }
                    }

                    // Remove out of bounds swords
                    const dx = w.x - CENTER_X;
                    const dy = w.y - CENTER_Y;
                    if (Math.sqrt(dx * dx + dy * dy) > 1000) {
                        soundManager.stopLoop('sfx_sword_fly');
                        activeSwords.splice(i, 1);
                    }
                } else if (w.state === 'penetrating') {
                    w.penetrateTimer -= deltaTime;
                    const t = Math.max(0, Math.min(1.0, 1.0 - (w.penetrateTimer / 0.06)));
                    w.x = w.contactX + (w.targetX - w.contactX) * t;
                    w.y = w.contactY + (w.targetY - w.contactY) * t;

                    if (w.penetrateTimer <= 0) {
                        w.state = 'stuck';
                        w.stuckTimer = 2.5;
                        soundManager.play('sfx_sword_rumble_loop', true);
                    }
                    stuckCount++;
                } else if (w.state === 'stuck') {
                    w.stuckTimer -= deltaTime;
                    // Apply continuous screen shake rumble
                    screenShake = {
                        x: (Math.random() - 0.5) * 3,
                        y: (Math.random() - 0.5) * 3,
                        intensity: 3,
                        duration: 100
                    };
                    if (w.stuckTimer <= 0) {
                        w.state = 'pulling';
                        w.pullTimer = 0.35;
                        soundManager.stopLoop('sfx_sword_rumble_loop');
                        soundManager.play('sfx_sword_pullout', false, 0.85);
                        soundManager.play('sfx_holy_shine', false, 1.0);

                        // Create Holy Rays effect
                        holyRays.push({
                            x: w.contactX,
                            y: w.contactY,
                            timer: 1.0,
                            maxTime: 1.0,
                            rotation: Math.random() * Math.PI * 2,
                            rotationSpeed: 0.02,
                            rayCount: 12,
                            rayLength: 200,
                            rayWidth: 40
                        });

                        // Destroy the penetration channel! (8 steps for a clean 70px carve)
                        for (let step = 0; step <= 7; step++) {
                            const interX = w.contactX + (w.targetX - w.contactX) * (step / 7);
                            const interY = w.contactY + (w.targetY - w.contactY) * (step / 7);
                            const localHit = screenToLocal(interX, interY, CENTER_X, CENTER_Y, planetRotation);
                            createExplosion(localHit.x, localHit.y, 28 - step * 2, 8, 'sword', step < 7, true);
                        }
                    }
                    stuckCount++;
                } else if (w.state === 'pulling') {
                    w.pullTimer -= deltaTime;
                    const t = Math.max(0, Math.min(1.0, 1.0 - (w.pullTimer / 0.35)));
                    w.x = w.targetX - Math.cos(w.angle) * 150 * t;
                    w.y = w.targetY - Math.sin(w.angle) * 150 * t;
                    w.opacity = 1.0 - t;

                    if (w.pullTimer <= 0) {
                        activeSwords.splice(i, 1);
                    }
                }
            }

            // Update active krakens (Curling Tentacle Grab)
            for (let i = activeKrakens.length - 1; i >= 0; i--) {
                const w = activeKrakens[i];
                if (w.state === 'portal_opening') {
                    w.portalTimer -= deltaTime;
                    w.portalScale = Math.max(0.0, Math.min(1.0, 1.0 - (w.portalTimer / 0.5)));
                    if (w.portalTimer <= 0) {
                        // Compute three tentacle targets curling toward the planet
                        const baseAngle = w.angle + Math.PI; // toward planet center
                        const spreadAngle = 0.4; // radians spread between tentacles
                        const imgData = hiddenCtx.getImageData(0, 0, PLANET_CANVAS_SIZE, PLANET_CANVAS_SIZE);
                        w.tentacles = [];

                        for (let t = -1; t <= 1; t++) {
                            const tentAngle = baseAngle + t * spreadAngle;
                            const dx = CENTER_X - w.portalX;
                            const dy = CENTER_Y - w.portalY;
                            const dist = Math.sqrt(dx * dx + dy * dy);

                            // Ray march to find surface point along this tentacle's direction
                            const stepSize = 3;
                            const numSteps = Math.ceil((dist + getPlanetSize()) / stepSize);
                            let rx = w.portalX, ry = w.portalY;
                            const stepX = Math.cos(tentAngle) * stepSize;
                            const stepY = Math.sin(tentAngle) * stepSize;
                            let targetX = CENTER_X + Math.cos(tentAngle) * 30;
                            let targetY = CENTER_Y + Math.sin(tentAngle) * 30;

                            for (let s = 0; s < numSteps; s++) {
                                rx += stepX;
                                ry += stepY;
                                const local = screenToLocal(rx, ry, CENTER_X, CENTER_Y, planetRotation);
                                const px = Math.floor(local.x);
                                const py = Math.floor(local.y);
                                if (px >= 0 && px < PLANET_CANVAS_SIZE && py >= 0 && py < PLANET_CANVAS_SIZE) {
                                    const idx = (py * PLANET_CANVAS_SIZE + px) * 4;
                                    if (imgData.data[idx + 3] > 0) {
                                        targetX = rx;
                                        targetY = ry;
                                        break;
                                    }
                                }
                            }

                            // Control point creates curling arc
                            // Offset perpendicular to create C-shaped curl toward planet
                            const midX = (w.portalX + targetX) / 2;
                            const midY = (w.portalY + targetY) / 2;
                            const perpAngle = tentAngle + Math.PI / 2 * (t === 0 ? 1 : t);
                            const curlDist = dist * 0.4;
                            const controlX = midX + Math.cos(perpAngle) * curlDist;
                            const controlY = midY + Math.sin(perpAngle) * curlDist;

                            w.tentacles.push({
                                tIndex: t, // Keep track of the index for curling calculations
                                targetX, targetY,
                                impactX: targetX, impactY: targetY, // Store original impact point
                                controlX, controlY,
                                progress: 0,
                                hasHitEarth: false, // Track contact reaction
                                grabbedChunks: [], // Array to store grabbed earth chunks
                                lastExplosionIdx: -1
                            });
                        }

                        w.state = 'tentacles_curling';
                        w.tentacleTimer = 2.0; // Total sequential extension timing
                    }
                } else if (w.state === 'tentacles_curling') {
                    w.tentacleTimer -= deltaTime;
                    const elapsed = Math.max(0, 2.0 - w.tentacleTimer);

                    // Update tentacle tips to follow planet rotation after contact
                    w.tentacles.forEach((tent) => {
                        if (tent.hasHitEarth && tent.localX !== undefined) {
                            const cos = Math.cos(planetRotation);
                            const sin = Math.sin(planetRotation);
                            const dxL = tent.localX - planetCenterX;
                            const dyL = tent.localY - planetCenterY;
                            tent.targetX = CENTER_X + (dxL * cos - dyL * sin);
                            tent.targetY = CENTER_Y + (dxL * sin + dyL * cos);
                            tent.impactX = tent.targetX;
                            tent.impactY = tent.targetY;

                            // Update control point to follow
                            const dxPortal = tent.targetX - w.portalX;
                            const dyPortal = tent.targetY - w.portalY;
                            const distPortal = Math.sqrt(dxPortal * dxPortal + dyPortal * dyPortal);
                            const midX = (w.portalX + tent.targetX) / 2;
                            const midY = (w.portalY + tent.targetY) / 2;
                            const tentAngle = Math.atan2(dyPortal, dxPortal);
                            const perpAngle = tentAngle + Math.PI / 2 * (tent.tIndex === 0 ? 1 : tent.tIndex);
                            const curlDist = distPortal * 0.4;
                            tent.controlX = midX + Math.cos(perpAngle) * curlDist;
                            tent.controlY = midY + Math.sin(perpAngle) * curlDist;
                        }
                    });

                    // Update all three tentacle progresses with exact 0.4s sequential delays
                    w.tentacles.forEach((tent, idx) => {
                        const start = idx * 0.4; // 0s, 0.4s, 0.8s sequential start
                        // Third tentacle (idx === 2) extends and curves faster (0.72s vs 0.8s)
                        const duration = (idx === 2) ? 0.72 : 0.8;
                        const tentElapsed = elapsed - start;
                        tent.progress = Math.max(0.0, Math.min(1.0, tentElapsed / duration));

                        // Organic Earth Contact Reaction!
                        if (tent.progress >= 0.98 && !tent.hasHitEarth) {
                            tent.hasHitEarth = true;

                            // Store local (unrotated) coordinates so tentacle tip follows planet rotation
                            const localImpact = screenToLocal(tent.targetX, tent.targetY, CENTER_X, CENTER_Y, planetRotation);
                            tent.localX = localImpact.x;
                            tent.localY = localImpact.y;

                            // Heavy Flesh impact thud sound
                            soundManager.play('sfx_explosion_small', false, 0.7, (Math.random() - 0.5) * 300 - 150);

                            // Shockwave at impact point
                            shockwaves.push({
                                x: tent.targetX,
                                y: tent.targetY,
                                radius: 0,
                                maxRadius: 36,
                                life: 1.0,
                                maxLife: 0.52
                            });

                            // Splash of purple alien mud droplets
                            const awayAngle = Math.atan2(tent.targetY - CENTER_Y, tent.targetX - CENTER_X);
                            for (let k = 0; k < 10; k++) {
                                const sprayAngle = awayAngle + (Math.random() - 0.5) * 1.5;
                                const speed = Math.random() * 4.5 + 2.5;
                                particles.push({
                                    x: tent.targetX,
                                    y: tent.targetY,
                                    vx: Math.cos(sprayAngle) * speed,
                                    vy: Math.sin(sprayAngle) * speed,
                                    life: 1.0,
                                    maxLife: Math.random() * 0.6 + 0.4,
                                    size: Math.random() * 4.5 + 2,
                                    color: '#d946ef',
                                    type: 'fire'
                                });
                            }

                            // Recoil shock screen shake
                            screenShake = {
                                x: (Math.random() - 0.5) * 8,
                                y: (Math.random() - 0.5) * 8,
                                intensity: 9,
                                duration: 180
                            };
                        }
                    });

                    if (w.tentacleTimer <= 0) {
                        w.state = 'grabbing';
                        w.tentacleTimer = 1.2; // 1.2s Weighted Squeeze & Yank grab phase!
                        soundManager.play('sfx_explosion_medium');
                    }
                } else if (w.state === 'grabbing') {
                    w.tentacleTimer -= deltaTime;
                    const grabProgress = Math.max(0.0, Math.min(1.0, 1.0 - (w.tentacleTimer / 1.2)));

                    // Low-frequency rumble screen shake during the squeeze phase
                    if (grabProgress < 0.4) {
                        screenShake = {
                            x: (Math.random() - 0.5) * 4,
                            y: (Math.random() - 0.5) * 4,
                            intensity: 4,
                            duration: 100
                        };
                    } else {
                        // Violent shaking during the tear/yank phase!
                        screenShake = {
                            x: (Math.random() - 0.5) * 12,
                            y: (Math.random() - 0.5) * 12,
                            intensity: 12,
                            duration: 150
                        };
                    }

                    // Update tentacle tip positions to follow planet rotation
                    w.tentacles.forEach((tent) => {
                        if (tent.hasHitEarth && tent.localX !== undefined) {
                            const cos = Math.cos(planetRotation);
                            const sin = Math.sin(planetRotation);
                            const dxL = tent.localX - planetCenterX;
                            const dyL = tent.localY - planetCenterY;
                            tent.impactX = CENTER_X + (dxL * cos - dyL * sin);
                            tent.impactY = CENTER_Y + (dxL * sin + dyL * cos);
                        }
                    });

                    // Update positions of tentacles as they squeeze, dig, and yank
                    w.tentacles.forEach((tent) => {
                        const dx = tent.impactX - CENTER_X;
                        const dy = tent.impactY - CENTER_Y;
                        const radius = Math.sqrt(dx * dx + dy * dy);
                        const baseAngle = Math.atan2(dy, dx);

                        let angleShift = 0;
                        let radiusShift = 0;

                        if (grabProgress < 0.4) {
                            // SQUEEZE/DIG PHASE: Tips remain locked at landing point, only sink slightly!
                            angleShift = 0;
                            radiusShift = -4 * (grabProgress / 0.4); // dig straight in slightly, no tip movement
                        } else {
                            // YANK/TEAR PHASE: Pull the tips back out, ripping the chunks off!
                            const yankFact = (grabProgress - 0.4) / 0.6;
                            if (tent.tIndex === -1) {
                                angleShift = -0.15 * yankFact;
                                radiusShift = -4 + 26 * yankFact; // pulls back outward!
                            } else if (tent.tIndex === 1) {
                                angleShift = 0.19 * yankFact;
                                radiusShift = -4 + 26 * yankFact; // pulls back outward!
                            } else {
                                angleShift = 0.05 * yankFact;
                                radiusShift = -4 + 32 * yankFact; // pulls back outward!
                            }
                        }

                        const curlAngle = baseAngle + angleShift;
                        const curlRadius = radius + radiusShift;
                        tent.targetX = CENTER_X + Math.cos(curlAngle) * curlRadius;
                        tent.targetY = CENTER_Y + Math.sin(curlAngle) * curlRadius;

                        // Dynamically update control point to follow the curling tip beautifully!
                        const dxPortal = tent.targetX - w.portalX;
                        const dyPortal = tent.targetY - w.portalY;
                        const distPortal = Math.sqrt(dxPortal * dxPortal + dyPortal * dyPortal);
                        const midX = (w.portalX + tent.targetX) / 2;
                        const midY = (w.portalY + tent.targetY) / 2;
                        const tentAngle = Math.atan2(dyPortal, dxPortal);
                        const perpAngle = tentAngle + Math.PI / 2 * (tent.tIndex === 0 ? 1 : tent.tIndex);

                        // Straining/straightening factor:
                        // During the squeeze phase (< 0.4), the tentacle straightens completely to show immense tension.
                        // At 0.4 progress (the crack), it is perfectly straight (curlFactor = 0.0).
                        // After 0.4 progress, once the pieces are pulled loose, it quickly snaps back to its curved state (curlFactor = 1.0).
                        let curlFactor = 1.0;
                        if (grabProgress < 0.4) {
                            const tenseProgress = grabProgress / 0.4; // 0.0 to 1.0
                            curlFactor = 1.0 - tenseProgress; // straightens to 0.0!
                        } else {
                            const snapProgress = (grabProgress - 0.4) / 0.6; // 0.0 to 1.0
                            curlFactor = Math.min(1.0, snapProgress * 2.0); // Snaps back within 30% of the remaining phase!
                        }

                        const curlDist = distPortal * 0.4 * curlFactor;
                        tent.controlX = midX + Math.cos(perpAngle) * curlDist;
                        tent.controlY = midY + Math.sin(perpAngle) * curlDist;
                    });

                    // Trigger the epic terrain rupture and chunk yank at exactly 40% progress!
                    if (grabProgress >= 0.4 && !w.hasTriggeredFlash) {
                        w.hasTriggeredFlash = true;
                        w.flashSequenceState = 1;
                        w.flashSequenceTimer = 0.06;
                        screenFlash.alpha = 0.6;
                        screenFlash.r = 0; screenFlash.g = 0; screenFlash.b = 0;
                    }
                    w.tentacles.forEach(tent => {
                        if (grabProgress >= 0.4 && tent.lastExplosionIdx < 0) {
                            tent.lastExplosionIdx = 1;

                            // Rupture the earth at the tentacle tip!
                            const localHit = screenToLocal(tent.targetX, tent.targetY, CENTER_X, CENTER_Y, planetRotation);

                            // Slightly reduced tighter crater explosion (5% bigger: 1.1 * 1.1 * 1.05)
                            createExplosion(localHit.x, localHit.y, Math.floor(w.explosionRadius * 1.3), w.shakeIntensity * 3, 'kraken', false, false);

                            // Play a loud cracking/rupturing sound
                            if (!w.hasPlayedSound) {
                                soundManager.play('sfx_explosion_large');
                                w.hasPlayedSound = true;
                            }

                            // Grab 2 big heavy chunks of earth (2x larger!)
                            tent.grabbedChunks = [
                                {
                                    offsetX: -12 + Math.random() * 8,
                                    offsetY: -12 + Math.random() * 8,
                                    size: Math.random() * 8 + 14, // 2x larger!
                                    color: '#3d2f26'
                                },
                                {
                                    offsetX: 12 + Math.random() * 8,
                                    offsetY: 12 + Math.random() * 8,
                                    size: Math.random() * 5 + 11, // 2x larger!
                                    color: '#4e3a2f'
                                }
                            ];

                            // Spray massive rock and mud debris outward!
                            const awayAngle = Math.atan2(tent.targetY - CENTER_Y, tent.targetX - CENTER_X);
                            for (let k = 0; k < 18; k++) {
                                const sprayAngle = awayAngle + (Math.random() - 0.5) * 1.6;
                                const speed = Math.random() * 8 + 4.5;
                                const isMud = Math.random() > 0.4;
                                particles.push({
                                    x: tent.targetX,
                                    y: tent.targetY,
                                    vx: Math.cos(sprayAngle) * speed,
                                    vy: Math.sin(sprayAngle) * speed,
                                    life: 1.0,
                                    maxLife: Math.random() * 0.9 + 0.6,
                                    size: Math.random() * 7.5 + 3.5,
                                    color: isMud ? `hsl(${20 + Math.random() * 15}, 45%, ${12 + Math.random() * 12}%)` : `hsl(${285 + Math.random() * 35}, 90%, ${30 + Math.random() * 15}%)`,
                                    type: 'fire'
                                });
                            }
                        }
                    });

                    if (w.flashSequenceState === 1) {
                        w.flashSequenceTimer -= deltaTime;
                        if (w.flashSequenceTimer <= 0) {
                            w.flashSequenceState = 2;
                            screenFlash.alpha = 0.4;
                            screenFlash.r = 255; screenFlash.g = 255; screenFlash.b = 255;
                        }
                    }

                    if (w.tentacleTimer <= 0) {
                        w.state = 'retracting';
                        w.tentacleTimer = 0.8;
                    }
                } else if (w.state === 'retracting') {
                    w.tentacleTimer -= deltaTime;
                    const retractProgress = Math.max(0.0, w.tentacleTimer / 0.8);
                    w.tentacles.forEach(tent => {
                        tent.progress = retractProgress;
                    });
                    if (w.tentacleTimer <= 0) {
                        w.state = 'portal_closing';
                        w.portalTimer = 0.4;
                    }
                } else if (w.state === 'portal_closing') {
                    w.portalTimer -= deltaTime;
                    w.portalScale = Math.max(0.0, w.portalTimer / 0.4);
                    if (w.portalTimer <= 0) {
                        activeKrakens.splice(i, 1);
                    }
                }
            }

            // Update active bowling balls
            for (let i = activeBowlingBalls.length - 1; i >= 0; i--) {
                const w = activeBowlingBalls[i];
                if (w.state === 'flying') {
                    w.x += w.vx * dt60;
                    w.y += w.vy * dt60;

                    // Check collision with planet silhouette
                    const local = screenToLocal(w.x, w.y, CENTER_X, CENTER_Y, planetRotation);
                    if (local.x >= 0 && local.x < hiddenCanvas.width &&
                        local.y >= 0 && local.y < hiddenCanvas.height) {

                        const px = Math.floor(local.x);
                        const py = Math.floor(local.y);

                        if (isSolidPixel(px, py, getSharedPlanetData())) {
                            // Make contact!
                            w.state = 'penetrating';
                            w.contactX = w.x;
                            w.contactY = w.y;
                            w.targetX = w.x + Math.cos(w.angle) * 10; // 15px penetration depth - 15px = 0px
                            w.targetY = w.y + Math.sin(w.angle) * 10;
                            w.penetrateTimer = 0.08; // 0.08s satisfy sink
                        }
                    }

                    // Remove out of bounds bowling balls
                    const dx = w.x - CENTER_X;
                    const dy = w.y - CENTER_Y;
                    if (Math.sqrt(dx * dx + dy * dy) > 1000) {
                        activeBowlingBalls.splice(i, 1);
                    }
                } else if (w.state === 'penetrating') {
                    w.penetrateTimer -= deltaTime;
                    const t = Math.max(0, Math.min(1.0, 1.0 - (w.penetrateTimer / 0.08)));
                    w.x = w.contactX + (w.targetX - w.contactX) * t;
                    w.y = w.contactY + (w.targetY - w.contactY) * t;

                    if (w.penetrateTimer <= 0) {
                        w.state = 'stuck';
                        w.stuckTimer = 2.0;

                        // Record its local unrotated position to lock orientation and position
                        const local = screenToLocal(w.x, w.y, CENTER_X, CENTER_Y, planetRotation);
                        w.localX = local.x;
                        w.localY = local.y;
                        w.stuckAngle = w.angle - planetRotation;
                    }
                } else if (w.state === 'stuck') {
                    w.stuckTimer -= deltaTime;

                    // Fixed-rate rumble tick (independent of refresh rate)
                    w.sfxTimer = (w.sfxTimer || 0) + deltaTime;
                    if (w.sfxTimer >= 0.21) {
                        w.sfxTimer = 0;
                        soundManager.play('sfx_ui_switch', false, 0.3, 800);
                    }

                    // Re-calculate its current screen coordinates dynamically
                    const cos = Math.cos(planetRotation);
                    const sin = Math.sin(planetRotation);
                    const dxLocal = w.localX - planetCenterX;
                    const dyLocal = w.localY - planetCenterY;
                    w.x = CENTER_X + (dxLocal * cos - dyLocal * sin);
                    w.y = CENTER_Y + (dxLocal * sin + dyLocal * cos);

                    if (w.stuckTimer <= 0) {
                        // Explode!
                        soundManager.play('sfx_bowling_pins', false, 0.6, (Math.random() - 0.5) * 600);
                        createExplosion(w.localX, w.localY, w.explosionRadius + 4, w.shakeIntensity, 'bowling', false, true);
                        activeBowlingBalls.splice(i, 1);
                    }
                }
            }

            // Update active fist visual explosions
            for (let i = activeFistVisualExplosions.length - 1; i >= 0; i--) {
                const p = activeFistVisualExplosions[i];
                p.life -= deltaTime / p.maxLife;
                p.radius = 5 + (p.maxRadius - 5) * (1 - p.life);
                if (p.life <= 0) {
                    activeFistVisualExplosions.splice(i, 1);
                }
            }

            // Update active fists
            for (let i = activeFists.length - 1; i >= 0; i--) {
                const w = activeFists[i];
                if (w.state === 'flying') {
                    // Start slow in speed, then quickly accelerate up to its contact point
                    const accelFactor = Math.pow(1.08, dt60);
                    w.vx *= accelFactor;
                    w.vy *= accelFactor;
                    w.x += w.vx * dt60;
                    w.y += w.vy * dt60;

                    // Wide rectangular hitbox checks (7 evenly-spaced points along the front face - now slightly narrower)
                    let makesContact = false;
                    const hHalf = w.width * 0.42;
                    const perpAngle = w.angle + Math.PI / 2;
                    const imgData = getSharedPlanetData();
                    const data = imgData.data;

                    for (let k = -3; k <= 3; k++) {
                        const offset = (k / 3) * hHalf;
                        const sx = w.x + Math.cos(perpAngle) * offset;
                        const sy = w.y + Math.sin(perpAngle) * offset;

                        const local = screenToLocal(sx, sy, CENTER_X, CENTER_Y, planetRotation);
                        const px = Math.floor(local.x);
                        const py = Math.floor(local.y);

                        if (px >= 0 && px < PLANET_CANVAS_SIZE && py >= 0 && py < PLANET_CANVAS_SIZE) {
                            const idx = (py * PLANET_CANVAS_SIZE + px) * 4;
                            if (data[idx + 3] > 0) {
                                makesContact = true;
                                break;
                            }
                        }
                    }

                    if (makesContact) {
                        // Contact made! Stop rotation
                        fistStuckCount++;
                        soundManager.play('sfx_fist_impact');
                        screenShake = { x: 0, y: 0, intensity: 30, duration: 200 };

                        // Create a shockwave spreading out from the contact point
                        shockwaves.push({
                            x: w.x,
                            y: w.y,
                            radius: 0,
                            maxRadius: 280,
                            life: 1.0,
                            maxLife: 0.8,
                            isOval: true,
                            angle: w.angle
                        });

                        // Carve Stage 1 tapering tree-branch cracks directly into planet surface
                        carveFistImpactCracksStage1(w);

                        w.state = 'sinking';
                        w.timer = 0.0;
                        w.contactX = w.x;
                        w.contactY = w.y;
                        w.initialContactX = w.x;
                        w.initialContactY = w.y;
                        w.targetX = w.x + Math.cos(w.angle) * 25;
                        w.targetY = w.y + Math.sin(w.angle) * 25;
                    }

                    // Clean up if it misses and flies more than 1000 units away
                    const dx = w.x - CENTER_X;
                    const dy = w.y - CENTER_Y;
                    if (Math.sqrt(dx * dx + dy * dy) > 1000) {
                        activeFists.splice(i, 1);
                    }

                } else if (w.state === 'sinking') {
                    w.timer += deltaTime;
                    const duration = 0.15; // sink quickly in 25px over 0.15s
                    const t = Math.max(0, Math.min(1.0, w.timer / duration));
                    w.x = w.contactX + (w.targetX - w.contactX) * t;
                    w.y = w.contactY + (w.targetY - w.contactY) * t;

                    // Handle 7 small explosions along the front face
                    const perpAngle = w.angle + Math.PI / 2;
                    w.sinkExplosions.forEach((expT, idx) => {
                        const key = `sink_${idx}`;
                        if (t >= expT && !w.triggeredIdxs.has(key)) {
                            w.triggeredIdxs.add(key);

                            // Trigger small explosion at a random point along the front face (25% narrower spread, twice as big)
                            const offset = (Math.random() - 0.5) * w.width * 0.75;
                            const ex = w.x + Math.cos(perpAngle) * offset;
                            const ey = w.y + Math.sin(perpAngle) * offset;
                            const exShifted = ex - Math.cos(w.angle) * 10;
                            const eyShifted = ey - Math.sin(w.angle) * 10;
                            const localHit = screenToLocal(exShifted, eyShifted, CENTER_X, CENTER_Y, planetRotation);

                            createExplosion(localHit.x, localHit.y, 19.4, 8, 'missile', false, true);

                            // Create dust particles flying far (away from impact zone)
                            const dustCount = 4;
                            for (let d = 0; d < dustCount; d++) {
                                const angle = w.angle + Math.PI + (Math.random() - 0.5) * 1.75;
                                const speed = (Math.random() * 14 + 12);
                                particles.push({
                                    x: ex,
                                    y: ey,
                                    vx: Math.cos(angle) * speed,
                                    vy: Math.sin(angle) * speed,
                                    life: 1.0,
                                    maxLife: Math.random() * 0.5 + 0.35,
                                    size: Math.random() * 4 + 2.5,
                                    color: `rgba(${Math.random() * 40 + 130}, ${Math.random() * 30 + 100}, ${Math.random() * 30 + 80}, 0.8)`,
                                    type: 'smoke'
                                });
                            }

                            // Create a few visual only orange-red circles that look like explosions at lower depth than the fist
                            const circlesCount = Math.floor(Math.random() * 2) + 2; // 2 to 3 circles
                            for (let c = 0; c < circlesCount; c++) {
                                activeFistVisualExplosions.push({
                                    x: ex - Math.cos(w.angle) * 1 + (Math.random() - 0.5) * 18,
                                    y: ey - Math.sin(w.angle) * 1 + (Math.random() - 0.5) * 18,
                                    radius: 5,
                                    maxRadius: Math.random() * 15 + 30,
                                    life: 1.0,
                                    maxLife: Math.random() * 0.25 + 0.22
                                });
                            }
                        }
                    });

                    if (w.timer >= duration) {
                        w.state = 'sinking_pause';
                        w.timer = 0.0;
                    }

                } else if (w.state === 'sinking_pause') {
                    w.timer += deltaTime;
                    if (w.timer >= 0.75) { // pause for 0.75s
                        w.state = 'ramming';
                        w.timer = 0.0;
                        w.contactX = w.x;
                        w.contactY = w.y;
                        w.targetX = w.x + Math.cos(w.angle) * 65;
                        w.targetY = w.y + Math.sin(w.angle) * 65;

                        // Carve Stage 2 cracks (extends first cracks longer, branches further and an extra time)
                        carveFistImpactCracksStage2(w);
                    }

                } else if (w.state === 'ramming') {
                    w.timer += deltaTime;
                    const duration = 0.20; // ram forward another 65px deeply over 0.2s
                    const t = Math.max(0, Math.min(1.0, w.timer / duration));
                    w.x = w.contactX + (w.targetX - w.contactX) * t;
                    w.y = w.contactY + (w.targetY - w.contactY) * t;

                    // Heavy screenshake during ramming
                    screenShake = {
                        x: (Math.random() - 0.5) * 18,
                        y: (Math.random() - 0.5) * 18,
                        intensity: 24,
                        duration: 100
                    };

                    // Handle 6 medium explosions along the front face
                    const perpAngle = w.angle + Math.PI / 2;
                    w.ramExplosions.forEach((expT, idx) => {
                        const key = `ram_${idx}`;
                        if (t >= expT && !w.triggeredIdxs.has(key)) {
                            w.triggeredIdxs.add(key);

                            // White flash for the second round of explosions
                            if (!w.hasFistRamFlash) {
                                screenFlash.alpha = 0.5;
                                screenFlash.r = 255; screenFlash.g = 255; screenFlash.b = 255;
                                w.hasFistRamFlash = true;
                            }

                            // Trigger medium explosion in a slightly narrower area closer to the fist's center
                            const offset = (Math.random() - 0.5) * w.width * 0.5;
                            const ex = w.x + Math.cos(perpAngle) * offset;
                            const ey = w.y + Math.sin(perpAngle) * offset;
                            const localHit = screenToLocal(ex, ey, CENTER_X, CENTER_Y, planetRotation);

                            createExplosion(localHit.x, localHit.y, 23, 28, 'nuke', false, true); // medium explosion
                        }
                    });

                    if (w.timer >= duration) {
                        w.state = 'ram_pause';
                        w.timer = 0.0;
                    }

                } else if (w.state === 'ram_pause') {
                    w.timer += deltaTime;
                    if (w.timer >= 1.25) { // pause for 1.25s
                        w.state = 'micro_pull';
                        w.timer = 0.0;
                        w.contactX = w.x;
                        w.contactY = w.y;
                        w.targetX = w.x - Math.cos(w.angle) * 6; // pull back 6px
                        w.targetY = w.y - Math.sin(w.angle) * 6;

                        // Trigger a large explosion 35px higher up on pullback (further away from center)
                        const explX = w.x - Math.cos(w.angle) * 35;
                        const explY = w.y - Math.sin(w.angle) * 35;
                        const localHit = screenToLocal(explX, explY, CENTER_X, CENTER_Y, planetRotation);
                        createExplosion(localHit.x, localHit.y, 75, 60, 'asteroid', false, true);
                    }

                } else if (w.state === 'micro_pull') {
                    w.timer += deltaTime;
                    const duration = 0.06; // pull back 6px very quickly (0.06s)
                    const t = Math.max(0, Math.min(1.0, w.timer / duration));
                    w.x = w.contactX + (w.targetX - w.contactX) * t;
                    w.y = w.contactY + (w.targetY - w.contactY) * t;

                    if (w.timer >= duration) {
                        w.state = 'micro_pause';
                        w.timer = 0.0;
                    }

                } else if (w.state === 'micro_pause') {
                    w.timer += deltaTime;
                    if (w.timer >= 0.25) { // pause for 0.25s
                        w.state = 'pulling';
                        // Planet resumes rotation
                        fistStuckCount = Math.max(0, fistStuckCount - 1);
                    }

                } else if (w.state === 'pulling') {
                    // Pull back a much greater distance while fading away
                    w.x -= Math.cos(w.angle) * deltaTime * 300;
                    w.y -= Math.sin(w.angle) * deltaTime * 300;
                    w.opacity -= deltaTime * 2.0; // fade out over 0.5s

                    if (w.opacity <= 0) {
                        activeFists.splice(i, 1);
                    }
                }
            }

            // Update rotation (stop rotation if any sword/fist is stuck/penetrating)
            let spinMultiplier = 1.0;
            if (currentPlanet === 'neptune') spinMultiplier = 0.60;
            else if (currentPlanet === 'jupiter') spinMultiplier = 0.40;
            else if (currentPlanet === 'sun') spinMultiplier = 0.25;

            const spinSpeed = getConfigValue('planet.rotationSpeed', 0.008) * 0.7225 * spinMultiplier;
            if (stuckCount > 0 || fistStuckCount > 0) {
                // Earth stops spinning!
            } else {
                planetRotation += spinSpeed * dt60;
            }

            // Update active worms
            for (let i = activeWorms.length - 1; i >= 0; i--) {
                const worm = activeWorms[i];
                worm.time += deltaTime;

                // Wriggle: oscillate head angle
                const wriggleAngle = worm.angle + Math.sin(worm.time * 14) * 0.35;

                // Move head in wriggle direction
                const speed = 1.8 * dt60;
                const head = worm.segments[0];
                head.x += Math.cos(wriggleAngle) * speed;
                head.y += Math.sin(wriggleAngle) * speed;
                worm.distanceTraveled += speed;

                // Update body segments to follow in a chain
                const spacing = worm.size * 0.75;
                for (let j = 1; j < worm.segments.length; j++) {
                    const seg = worm.segments[j];
                    const prevSeg = worm.segments[j - 1];
                    const dx = seg.x - prevSeg.x;
                    const dy = seg.y - prevSeg.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    if (dist > spacing) {
                        seg.x = prevSeg.x + (dx / dist) * spacing;
                        seg.y = prevSeg.y + (dy / dist) * spacing;
                    }
                }

                // Spawn sand/dust particles trailing from body segments (fixed rate, not per-frame)
                worm.dustTimer = (worm.dustTimer || 0) + deltaTime;
                if (worm.dustTimer >= 0.037 / particleBudget) {
                    worm.dustTimer = 0;
                    const followSegment = worm.segments[3 + Math.floor(Math.random() * 3)] || head;
                    const pAngle = Math.random() * Math.PI * 2;
                    const pSpeed = Math.random() * 1.5 + 0.5;
                    particles.push({
                        x: followSegment.x,
                        y: followSegment.y,
                        vx: Math.cos(pAngle) * pSpeed,
                        vy: Math.sin(pAngle) * pSpeed,
                        life: 1.0,
                        maxLife: Math.random() * 0.5 + 0.3,
                        size: Math.random() * 4 + 2,
                        color: Math.random() < 0.5 ? '#a67246' : '#d2b48c', // sandy dust
                        type: 'smoke'
                    });
                }

                // Eat terrain every 0.35s
                worm.damageTimer += deltaTime;
                if (worm.damageTimer >= 0.35) {
                    worm.damageTimer -= 0.35;
                    soundManager.play('sfx_nom_short', false, 0.8, (Math.random() * 2 - 1) * 550);
                    screenShake = { x: 0, y: 0, intensity: 7, duration: 70 };
                    // Use head position for damage!
                    const local = screenToLocal(head.x, head.y, CENTER_X, CENTER_Y, planetRotation);
                    let eraseRadius = worm.radius * 0.5 + 5;
                    if (currentPlanet === 'neutron_star') {
                        eraseRadius *= 0.35;
                    }
                    eraseTerrain(local.x, local.y, eraseRadius, false, 'worm');
                    collapseTerrain();
                    const remainingPixels = calculateCenterOfMass();
                    if (!victoryTriggered) {
                        const massPct = (remainingPixels / initialPixelCount) * 100;
                        if (massPct < getConfigValue('gameplay.victoryThreshold', 1.75)) {
                            triggerVictory();
                        }
                    }
                }

                // Disappear after 625 units traveled
                if (worm.distanceTraveled >= 625) {
                    soundManager.play('sfx_black_hole_disappear');
                    // Poof: sand explosion at exit point
                    for (let p = 0; p < 18; p++) {
                        const pAngle = Math.random() * Math.PI * 2;
                        const pSpeed = Math.random() * 4 + 1;
                        particles.push({
                            x: head.x,
                            y: head.y,
                            vx: Math.cos(pAngle) * pSpeed,
                            vy: Math.sin(pAngle) * pSpeed,
                            life: 1.0,
                            maxLife: Math.random() * 0.5 + 0.3,
                            size: Math.random() * 6 + 2,
                            color: '#8c5830',
                            type: 'smoke'
                        });
                    }
                    activeWorms.splice(i, 1);
                }
            }

            // Manage Laser Hum and Rumble Sound for Black Hole
            if (activeBlackHoles.length > 0) {
                const maxTime = Math.max(...activeBlackHoles.map(b => b.time));
                let baseHumVol = 0.35;
                let baseRumbleVol = 0.45;

                if (maxTime > 5.0 && maxTime <= 6.0) {
                    const progress = (maxTime - 5.0); // 0.0 to 1.0
                    baseHumVol = 0.35 + progress * 0.45;
                    baseRumbleVol = 0.45 + progress * 0.55;
                } else if (maxTime > 6.0) {
                    const progress = (maxTime - 6.0) / 0.5;
                    baseHumVol = Math.max(0, 0.8 * (1.0 - progress));
                    baseRumbleVol = Math.max(0, 1.0 * (1.0 - progress));
                }

                if (!soundManager.activeLoops['sfx_laser_hum']) {
                    soundManager.play('sfx_laser_hum', true, baseHumVol);
                } else {
                    // Check if laser is not currently firing (if it is, laser handles volume)
                    if (!(isHolding && selectedWeapon === 'laser' && !victoryTriggered && laserCooldown <= 0)) {
                        soundManager.setLoopVolume('sfx_laser_hum', baseHumVol);
                    }
                }

                if (!soundManager.activeLoops['sfx_sword_rumble_loop']) {
                    soundManager.play('sfx_sword_rumble_loop', true, baseRumbleVol, -200);
                } else {
                    soundManager.setLoopVolume('sfx_sword_rumble_loop', baseRumbleVol);
                }
            }

            // Update active black holes
            let maxBhShakeIntensity = 0;
            for (let i = activeBlackHoles.length - 1; i >= 0; i--) {
                const bh = activeBlackHoles[i];
                bh.time += deltaTime;

                // Track when large rings get sucked in (between 3.5s and 6.5s, stopping new ones after 5.5s)
                if (bh.time > 3.5 && bh.time < 6.5) {
                    if (!bh.lastLargeRingProgress) {
                        bh.lastLargeRingProgress = [0.25, 0.75];
                    }
                    const tLarge = bh.time * 0.8;
                    const thickRingCount = 2;

                    // Capture tLarge at the 5.5s mark to calculate wrap thresholds
                    if (bh.time >= 5.5 && bh.tLargeAt5_5 === undefined) {
                        bh.tLargeAt5_5 = tLarge;
                    }

                    for (let r = 0; r < thickRingCount; r++) {
                        const progress = (tLarge + r / thickRingCount + 0.25) % 1.0;

                        // Stop spawning new rings after 5.5s by checking if they wrapped around
                        if (bh.tLargeAt5_5 !== undefined) {
                            const p5_5 = (bh.tLargeAt5_5 + r / thickRingCount + 0.25) % 1.0;
                            if (progress < p5_5) {
                                continue;
                            }
                        }

                        const lastProgress = bh.lastLargeRingProgress[r];
                        if (progress < lastProgress && lastProgress > 0.8) {
                            soundManager.play('sfx_mystical_moon_explosion', false, 0.35, 800);
                        }
                        bh.lastLargeRingProgress[r] = progress;
                    }
                }

                // Growing over 5.0s, then expanding and shaking to 6.0s, then rapidly collapsing to 6.5s
                let displaySize = 0;
                let shakeAmp = 0;
                if (bh.time <= 5.0) {
                    // Grows from 0 to 60 over 5.0 seconds
                    displaySize = (bh.time / 5.0) * 60;
                } else if (bh.time <= 6.0) {
                    // Expands from 60 to 75 over 1.0 seconds, shaking increases with time
                    const tExp = (bh.time - 5.0) / 1.0;
                    displaySize = 60 + 15 * Math.sin(tExp * Math.PI / 2);
                    shakeAmp = tExp * 5.0; // shaking intensity grows up to 5px
                } else {
                    // Collapses from 75 to 0 over 0.5 seconds
                    const tCol = (bh.time - 6.0) / 0.5;
                    displaySize = Math.max(0, 75 * (1.0 - tCol));
                    shakeAmp = (1.0 - tCol) * 5.0; // shaking intensity fades out with size
                }

                bh.displaySize = displaySize;

                // Calculate screen shake for this black hole
                let bhShake = 0.5;
                if (bh.time <= 5.0) {
                    bhShake = 0.5 + (bh.time / 5.0) * 2.0;
                } else if (bh.time <= 6.0) {
                    const tExp = (bh.time - 5.0) / 1.0;
                    bhShake = 2.5 + tExp * 4.5;
                } else {
                    const tCol = (bh.time - 6.0) / 0.5;
                    bhShake = 7.0 * (1.0 - tCol);
                }
                maxBhShakeIntensity = Math.max(maxBhShakeIntensity, bhShake);

                // Shaking offsets for the black hole itself
                bh.shakeX = 0;
                bh.shakeY = 0;
                if (shakeAmp > 0) {
                    bh.shakeX = (Math.random() - 0.5) * 2 * shakeAmp;
                    bh.shakeY = (Math.random() - 0.5) * 2 * shakeAmp;
                }

                // If fully shrunk, disappear
                if (bh.time >= 6.5) {
                    soundManager.play('sfx_black_hole_disappear');

                    // Trigger a massive screenshake explosion impact
                    screenShake = {
                        x: 0,
                        y: 0,
                        intensity: 24,
                        duration: 800
                    };

                    // Flash screen purple
                    screenFlash.alpha = 0.5;
                    screenFlash.r = 160; screenFlash.g = 60; screenFlash.b = 255;

                    // Add shockwave ring
                    shockwaves.push({
                        x: bh.x,
                        y: bh.y,
                        radius: 0,
                        maxRadius: 300,
                        life: 1.0,
                        maxLife: 1.2
                    });

                    activeBlackHoles.splice(i, 1);
                    continue;
                }

                // Spawn invisible rain particles during growing phase (0 to 5s)
                if (bh.time <= 5.0) {
                    const progress = Math.min(1.0, bh.time / 5.0);
                    // Spawn interval in seconds, refresh-rate independent (was per-frame chance).
                    // particleBudget scales the interval up (fewer spawns), matching every
                    // other emission site - it must not divide the rate.
                    const rainInterval = 1 / ((0.12 + progress * 0.35) * 0.8 * 60 * particleBudget);

                    // Current behavior: rain falling from outer orbit
                    bh.rainTimer = (bh.rainTimer || 0) + deltaTime;
                    if (bh.rainTimer >= rainInterval) {
                        bh.rainTimer -= rainInterval;
                        const bhAngle = Math.atan2(bh.y - CENTER_Y, bh.x - CENTER_X);
                        const spreadWidth = 0.9 + progress * 2; // scales from 0.4 to 2.2 rad
                        const spreadAngle = bhAngle + (Math.random() - 0.5) * spreadWidth;
                        const rSpeed = (Math.random() * 5 + 6.0); // 50% faster

                        const spawnDist = getConfigValue('gameplay.spawnDistance', 300) + -25;
                        const px = CENTER_X + Math.cos(spreadAngle) * spawnDist;
                        const py = CENTER_Y + Math.sin(spreadAngle) * spawnDist;

                        bh.projectiles.push({
                            x: px,
                            y: py,
                            vx: Math.cos(spreadAngle + Math.PI) * rSpeed,
                            vy: Math.sin(spreadAngle + Math.PI) * rSpeed
                        });
                    }

                    // Old behavior: shoot particles outwards from the black hole itself at 25% the frequency
                    const outwardInterval = rainInterval / 0.35;
                    bh.outwardTimer = (bh.outwardTimer || 0) + deltaTime;
                    if (bh.outwardTimer >= outwardInterval) {
                        bh.outwardTimer -= outwardInterval;
                        const toPlanetAngle = Math.atan2(CENTER_Y - bh.y, CENTER_X - bh.x);
                        const spreadWidth = 2.2;
                        const spreadAngle = toPlanetAngle + (Math.random() - 0.5) * spreadWidth;
                        const rSpeed = (Math.random() * 5 + 6.0); // 50% faster

                        bh.projectiles.push({
                            x: bh.x,
                            y: bh.y,
                            vx: Math.cos(spreadAngle) * rSpeed,
                            vy: Math.sin(spreadAngle) * rSpeed
                        });
                    }
                }

                let blackholeHitThisFrame = false;
                const sharedData = getSharedPlanetData();

                // Update rain projectiles
                for (let pIdx = bh.projectiles.length - 1; pIdx >= 0; pIdx--) {
                    const rp = bh.projectiles[pIdx];
                    rp.x += rp.vx * dt60;
                    rp.y += rp.vy * dt60;

                    // Check collision with planet
                    const local = screenToLocal(rp.x, rp.y, CENTER_X, CENTER_Y, planetRotation);
                    const px = Math.floor(local.x);
                    const py = Math.floor(local.y);

                    if (px >= 0 && px < PLANET_CANVAS_SIZE && py >= 0 && py < PLANET_CANVAS_SIZE) {
                        const idx = (py * PLANET_CANVAS_SIZE + px) * 4;
                        if (sharedData.data[idx + 3] > 0) {
                            // Collision detected! Read exact color
                            const color = `rgb(${sharedData.data[idx]},${sharedData.data[idx + 1]},${sharedData.data[idx + 2]})`;

                            // Calculate growing explosion scale (start +40% bigger, grow to +170% by end of active phase)
                            const scale = 2 + Math.min(1.0, bh.time / 5.0) * 1.3;
                            let radius = 8 * scale - 2;
                            if (currentPlanet === 'neutron_star') {
                                radius *= 0.22;
                            } else {
                                radius *= 0.94;
                            }

                            // Play subtle crackling/crushing impact sound (fixed per-projectile rate)
                            rp.crackleTimer = (rp.crackleTimer || 0) + deltaTime;
                            if (rp.crackleTimer >= 0.067) {
                                rp.crackleTimer = 0;
                                const detune = (Math.random() - 1.3) * 1400;
                                soundManager.play('sfx_explosion_small', false, 0.15, detune);
                            }

                            // Erase terrain with radius
                            eraseTerrain(local.x, local.y, radius, false, 'blackhole');
                            blackholeHitThisFrame = true;

                            // Spawn visual chunk at rotated screen coordinate
                            const cos = Math.cos(planetRotation);
                            const sin = Math.sin(planetRotation);
                            const dxLocal = local.x - planetCenterX;
                            const dyLocal = local.y - planetCenterY;
                            const screenX = CENTER_X + (dxLocal * cos - dyLocal * sin);
                            const screenY = CENTER_Y + (dxLocal * sin + dyLocal * cos);

                            bh.chunks.push({
                                x: screenX,
                                y: screenY,
                                color: color,
                                size: (Math.random() * 3 + 2.5) * scale,
                                speed: Math.random() * 2.5 + 2.0,
                                alpha: 1.0,
                                fadeStartOffset: Math.random() * 0.5,
                                fadeDuration: 0.5 + Math.random() * 0.4
                            });

                            // Remove projectile
                            bh.projectiles.splice(pIdx, 1);
                            continue;
                        }
                    }

                    // Remove if out of bounds
                    const dx = rp.x - CENTER_X;
                    const dy = rp.y - CENTER_Y;
                    if (Math.sqrt(dx * dx + dy * dy) > 1000) {
                        bh.projectiles.splice(pIdx, 1);
                    }
                }

                // If any blackhole projectile hit the planet this frame, run the heavy passes exactly once
                if (blackholeHitThisFrame) {
                    collapseTerrain();
                    const remainingPixels = calculateCenterOfMass();
                    if (!victoryTriggered) {
                        const massPct = (remainingPixels / initialPixelCount) * 100;
                        if (massPct < getConfigValue('gameplay.victoryThreshold', 1.75)) {
                            triggerVictory();
                        }
                    }
                }

                // Update visual chunks flying towards the black hole
                for (let cIdx = bh.chunks.length - 1; cIdx >= 0; cIdx--) {
                    const chunk = bh.chunks[cIdx];

                    // Fade logic starting at 5.0s with slight stagger
                    if (bh.time >= 5.0) {
                        const elapsedSinceFade = bh.time - (5.0 + (chunk.fadeStartOffset || 0));
                        if (elapsedSinceFade > 0) {
                            chunk.alpha = Math.max(0, 1.0 - elapsedSinceFade / (chunk.fadeDuration || 0.8));
                        } else {
                            chunk.alpha = 1.0;
                        }
                    } else {
                        chunk.alpha = 1.0;
                    }

                    if (chunk.alpha <= 0) {
                        bh.chunks.splice(cIdx, 1);
                        continue;
                    }

                    const dx = (bh.x + (bh.shakeX || 0)) - chunk.x;
                    const dy = (bh.y + (bh.shakeY || 0)) - chunk.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);

                    if (dist < displaySize + 5) {
                        // Absorbed!
                        bh.chunks.splice(cIdx, 1);
                    } else {
                        // Spiral towards black hole (including shake offsets)
                        const speed = chunk.speed * dt60;
                        const pullX = (dx / dist) * speed;
                        const pullY = (dy / dist) * speed;

                        const swirlStrength = 0.65;
                        const swirlX = (-dy / dist) * speed * swirlStrength;
                        const swirlY = (dx / dist) * speed * swirlStrength;

                        chunk.x += pullX + swirlX;
                        chunk.y += pullY + swirlY;

                        // Spawn small dust particles behind chunk, swirling along (fixed per-chunk rate)
                        chunk.dustTimer = (chunk.dustTimer || 0) + deltaTime;
                        if (chunk.dustTimer >= 0.111 / particleBudget) {
                            chunk.dustTimer = 0;
                            particles.push({
                                x: chunk.x,
                                y: chunk.y,
                                vx: (Math.random() - 0.5) * 1.0 - (dy / dist) * 2.0,
                                vy: (Math.random() - 0.5) * 1.0 + (dx / dist) * 2.0,
                                life: 1.0,
                                maxLife: 0.3,
                                size: chunk.size * 0.5,
                                color: chunk.color,
                                type: 'smoke'
                            });
                        }
                    }
                }
            }

            // If all black holes are gone and laser is not active, stop loop hum
            if (activeBlackHoles.length === 0 && !(isHolding && selectedWeapon === 'laser' && !victoryTriggered && laserCooldown <= 0)) {
                soundManager.stopLoop('sfx_laser_hum');
            }

            // Apply continuous screen shake for active black holes
            if (maxBhShakeIntensity > 0) {
                screenShake = {
                    x: (Math.random() - 0.5) * maxBhShakeIntensity,
                    y: (Math.random() - 0.5) * maxBhShakeIntensity,
                    intensity: maxBhShakeIntensity,
                    duration: 50
                };
            }

            // Update flying projectiles
            for (let i = weapons.length - 1; i >= 0; i--) {
                const w = weapons[i];

                if (w.state === 'flash') {
                    w.flashTimer -= deltaTime;
                    if (w.flashTimer <= 0) {
                        if ((w.type === 'asteroid' || w.type === 'nuke') && w.flashPhase === 'black') {
                            w.flashPhase = 'white';
                            w.flashTimer = w.type === 'nuke' ? 0.04 : 0.05;
                        } else {
                            createExplosion(w.localX, w.localY, w.explosionRadius, w.shakeIntensity, w.type, false, true);
                            weapons.splice(i, 1);
                        }
                    }
                    continue;
                }

                // Gravitational arcing logic: pull missiles towards the center of Earth
                if (w.type === 'missile') {
                    const dx = CENTER_X - w.x;
                    const dy = CENTER_Y - w.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    if (dist > 0) {
                        const gravity = 0.22 * dt60;
                        w.vx += (dx / dist) * gravity;
                        w.vy += (dy / dist) * gravity;

                        // Add slight decay to velocity components so orbital/lateral movement dampens over time
                        w.vx *= Math.pow(0.99, dt60);
                        w.vy *= Math.pow(0.99, dt60);

                        // Align rotation with velocity vector
                        w.angle = Math.atan2(w.vy, w.vx);
                    }
                }

                w.x += w.vx * dt60;
                w.y += w.vy * dt60;

                if (w.type === 'comet') {
                    w.spinAngle = (w.spinAngle || 0) + 3.5 * deltaTime;
                }

                // Missile smoke trail particles
                if (w.type === 'missile' && Math.random() > 0.4) {
                    particles.push({
                        x: w.x - w.vx * 0.5 + (Math.random() - 0.5) * 3,
                        y: w.y - w.vy * 0.5 + (Math.random() - 0.5) * 3,
                        vx: (Math.random() - 0.5) * 0.6,
                        vy: (Math.random() - 0.5) * 0.6,
                        life: 1.0,
                        maxLife: 0.35,
                        size: Math.random() * 3 + 1.5,
                        color: `rgba(180, 190, 200, 0.5)`,
                        type: 'smoke'
                    });
                }

                // Asteroid fire exhaust particles
                if (w.type === 'asteroid' && Math.random() > 0.28) {
                    particles.push({
                        x: w.x - w.vx * 0.8 + (Math.random() - 0.5) * 16,
                        y: w.y - w.vy * 0.8 + (Math.random() - 0.5) * 16,
                        vx: (Math.random() - 0.5) * 1.5 - w.vx * 0.2,
                        vy: (Math.random() - 0.5) * 1.5 - w.vy * 0.2,
                        life: 1.0,
                        maxLife: 0.5,
                        size: Math.random() * 6 + 4,
                        color: `hsl(${Math.random() * 30 + 10}, 100%, ${Math.random() * 30 + 40}%)`,
                        type: 'fire'
                    });
                }

                // Moon cold light exhaust particles (only when flying normally)
                if (w.type === 'moon' && (!w.state || w.state === 'flying' || w.state === 'glowing') && Math.random() > 0.55) {
                    const spd = Math.sqrt(w.vx * w.vx + w.vy * w.vy) || 1;
                    const dx = w.vx / spd;
                    const dy = w.vy / spd;
                    // Perpendicular direction for lateral spread
                    const perpX = -dy;
                    const perpY = dx;
                    const spread = (Math.random() - 0.5) * w.size * 2.2; // wider spread
                    // Colour stays cool blue-white in both states
                    const exhaustColor = `hsl(${Math.random() * 30 + 195}, 75%, ${Math.random() * 25 + 65}%)`;
                    particles.push({
                        x: w.x - dx * w.size * 0.8 + perpX * spread,
                        y: w.y - dy * w.size * 0.8 + perpY * spread,
                        vx: (Math.random() - 0.5) * 1.2 - w.vx * 0.08 + perpX * (Math.random() * 0.8),
                        vy: (Math.random() - 0.5) * 1.2 - w.vy * 0.08 + perpY * (Math.random() * 0.8),
                        life: 1.0,
                        maxLife: 1.4,
                        size: Math.random() * 7 + 3,
                        color: exhaustColor,
                        type: 'fire',
                        moonExhaust: true // drawn before weapons so they appear behind the moon
                    });
                }

                // Moon 40px lookahead: detect ground ahead and enter glowing state
                if (w.type === 'moon' && (!w.state || w.state === 'flying')) {
                    const spd = Math.sqrt(w.vx * w.vx + w.vy * w.vy) || 1;
                    const lookX = w.x + (w.vx / spd) * 40;
                    const lookY = w.y + (w.vy / spd) * 40;
                    const localAhead = screenToLocal(lookX, lookY, CENTER_X, CENTER_Y, planetRotation);
                    const lax = Math.floor(localAhead.x);
                    const lay = Math.floor(localAhead.y);
                    if (lax >= 0 && lax < hiddenCanvas.width && lay >= 0 && lay < hiddenCanvas.height) {
                        if (isSolidPixel(lax, lay, getSharedPlanetData())) {
                            w.state = 'glowing';
                            w.glowAge = 0; // Track time in glowing state for ramp-up
                            soundManager.play('sfx_black_hole_disappear');
                        }
                    }
                }

                // Advance glowAge for ramp-up calculation
                if (w.state === 'glowing') {
                    w.glowAge = (w.glowAge || 0) + deltaTime;
                }

                // Check collision using Matrix Inverse Transformation
                const local = screenToLocal(w.x, w.y, CENTER_X, CENTER_Y, planetRotation);

                if (local.x >= 0 && local.x < hiddenCanvas.width &&
                    local.y >= 0 && local.y < hiddenCanvas.height) {

                    const px = Math.floor(local.x);
                    const py = Math.floor(local.y);

                    if (isSolidPixel(px, py, getSharedPlanetData())) {
                        if (w.type === 'comet') {
                            freezeArea(local.x, local.y, w.explosionRadius);

                            // Play freezing sound
                            soundManager.play('sfx_freeze', false, 1.0);
                            soundManager.play('sfx_magical_star_shot2', false, 0.2, -250);

                            // Trigger screen shake slightly
                            screenShake = {
                                x: 0,
                                y: 0,
                                intensity: 8,
                                duration: 300
                            };

                            // Spawn ice impact particles radiating in screen space (similar to Moon's explosion structure)
                            const cos = Math.cos(planetRotation);
                            const sin = Math.sin(planetRotation);
                            const dxLocal = local.x - planetCenterX;
                            const dyLocal = local.y - planetCenterY;
                            const rotX = dxLocal * cos - dyLocal * sin;
                            const rotY = dxLocal * sin + dyLocal * cos;
                            const impactScreenX = CENTER_X + rotX;
                            const impactScreenY = CENTER_Y + rotY;

                            // Cool blue/white screen flash
                            screenFlash.alpha = 0.25;
                            screenFlash.r = 180; screenFlash.g = 235; screenFlash.b = 255;

                            // Add shockwave ring
                            shockwaves.push({
                                x: impactScreenX,
                                y: impactScreenY,
                                radius: 0,
                                maxRadius: w.explosionRadius * 3.6,
                                life: 1.0,
                                maxLife: 0.6
                            });

                            // Nested expanding ice explosion rings (custom handled in renderer)
                            particles.push({
                                x: impactScreenX, y: impactScreenY,
                                vx: 0, vy: 0, life: 1.0, maxLife: 0.41,
                                size: w.explosionRadius * 1.3,
                                color: 'rgba(0, 217, 255, 0.85)',
                                type: 'explosion_ring',
                                isComet: true,
                                isFreeze: true
                            });


                            // Blue/cyan circular flash
                            particles.push({
                                x: impactScreenX, y: impactScreenY,
                                vx: 0, vy: 0, life: 1.0, maxLife: 0.16,
                                size: w.explosionRadius * 2.25,
                                color: '0, 217, 255',
                                type: 'circular_flash',
                                isFreeze: true
                            });

                            // Debris particles (50 particles: mix of cyan/blue/white fire and smoke)
                            const particleCount = 50;
                            for (let pIdx = 0; pIdx < particleCount; pIdx++) {
                                const angle = Math.random() * Math.PI * 2;
                                const speed = Math.random() * 6 + 4;
                                particles.push({
                                    x: impactScreenX,
                                    y: impactScreenY,
                                    vx: Math.cos(angle) * speed,
                                    vy: Math.sin(angle) * speed,
                                    life: 1.0,
                                    maxLife: Math.random() * 1.0 + 0.6,
                                    size: Math.random() * 6 + 3,
                                    color: Math.random() < 0.6 ? '#66b2ff' : (Math.random() < 0.5 ? '#00f0ff' : '#ffffff'),
                                    type: Math.random() > 0.75 ? 'fire' : 'smoke'
                                });
                            }

                            weapons.splice(i, 1);
                            continue;
                        } else if (w.type === 'moon' || w.type === 'asteroid' || w.type === 'nuke') {
                            w.state = 'flash';
                            w.flashPhase = 'black';
                            w.flashTimer = w.type === 'moon' ? 0.12 : 0.04;
                            w.localX = local.x;
                            w.localY = local.y;
                            w.vx = 0;
                            w.vy = 0;

                            if (w.type === 'moon') {
                                screenFlash.alpha = 0.9;
                                screenFlash.r = 0; screenFlash.g = 0; screenFlash.b = 0;
                            } else if (w.type === 'asteroid') {
                                screenFlash.alpha = 0.15;
                                screenFlash.r = 255; screenFlash.g = 255; screenFlash.b = 255;
                            } else if (w.type === 'nuke') {
                                screenFlash.alpha = 0.12;
                                screenFlash.r = 0; screenFlash.g = 0; screenFlash.b = 0;
                            }
                            continue;
                        } else {
                            // Hit! Trigger explosion
                            createExplosion(local.x, local.y, w.explosionRadius, w.shakeIntensity, w.type, false, true);
                            weapons.splice(i, 1);
                            continue;
                        }
                    }
                }

                // Remove out of bounds projectiles
                const dx = w.x - CENTER_X;
                const dy = w.y - CENTER_Y;
                if (Math.sqrt(dx * dx + dy * dy) > 1000) {
                    weapons.splice(i, 1);
                }
            }

            // Update active mystery boxes
            updateMysteryBoxes(deltaTime, dt60);
            if (typeof updateFallingDucks === 'function') {
                updateFallingDucks(deltaTime, dt60);
            }

            // Update active drills
            if (typeof updateDrills === 'function') {
                updateDrills(deltaTime, dt60);
            }

            // Update particles using the static pool (no array splicing, no allocations)
            for (let i = 0; i < particles.pool.length; i++) {
                const p = particles.pool[i];
                if (!p.active) continue;

                p.x += p.vx * dt60;
                p.y += p.vy * dt60;
                p.life -= deltaTime * (1 / p.maxLife);

                if (p.type === 'smoke') {
                    const drag = Math.pow(0.96, dt60);
                    p.vx *= drag;
                    p.vy *= drag;
                } else if (p.type === 'fire' && !p.moonExhaust) {
                    const fireDrag = Math.pow(0.987, dt60);
                    p.vx *= fireDrag;
                    p.vy *= fireDrag;
                }

                if (p.life <= 0) {
                    particles.release(p);
                }
            }

            // Update shockwaves (User feature 7)
            for (let i = shockwaves.length - 1; i >= 0; i--) {
                const sw = shockwaves[i];
                sw.life -= deltaTime * (1 / sw.maxLife);
                sw.radius = sw.maxRadius * (1 - Math.pow(sw.life, 2));
                if (sw.life <= 0) {
                    shockwaves.splice(i, 1);
                }
            }

            // Update holy rays
            for (let i = holyRays.length - 1; i >= 0; i--) {
                const hr = holyRays[i];
                hr.timer -= deltaTime;
                hr.rotation += hr.rotationSpeed * dt60;
                if (hr.timer <= 0) {
                    holyRays.splice(i, 1);
                }
            }

            // Decay screen flash (clamped so tab-switches don't cause instant disappearance)
            if (screenFlash.alpha > 0) {
                screenFlash.alpha = Math.max(0, screenFlash.alpha - Math.min(deltaTime, 0.05) * 5.0);
            }

            // Update screen shake displacements
            let isShaking = false;
            if (screenShake.duration > 0) {
                screenShake.duration -= deltaTime * 1000;
                let mult = 1.0;
                if (currentScreenShakeSetting === 'none') {
                    mult = 0.0;
                } else if (currentScreenShakeSetting === 'half') {
                    mult = 0.5;
                }
                screenShake.x = (Math.random() - 0.5) * screenShake.intensity * mult;
                screenShake.y = (Math.random() - 0.5) * screenShake.intensity * mult;
                isShaking = true;

                if (screenShake.duration <= 0) {
                    screenShake.x = 0;
                    screenShake.y = 0;
                }
            }

            const uiOverlay = _dom.uiOverlay;
            if (uiOverlay) {
                if (isShaking && (screenShake.x !== 0 || screenShake.y !== 0)) {
                    uiOverlay.style.transform = `translate(${screenShake.x * 0.5}px, ${screenShake.y * 0.5}px)`;
                } else {
                    uiOverlay.style.transform = '';
                }
            }


            // Twinkle background stars (throttled — only update a subset each frame)
            const starBatchSize = Math.ceil(stars.length / 4);
            const starOffset = Math.floor(performance.now() / 50) % 4;
            for (let si = starOffset * starBatchSize; si < Math.min(stars.length, (starOffset + 1) * starBatchSize); si++) {
                const star = stars[si];
                // Smooth sine-based twinkle blended with gentle randomness
                const sinTwinkle = Math.sin(performance.now() * star.twinkleSpeed + si) * 0.15;
                star.opacity += sinTwinkle * deltaTime * 2 + (Math.random() - 0.5) * star.twinkleSpeed * 2;
                star.opacity = Math.max(0.2, Math.min(0.9, star.opacity));
            }

            // Update HUD Progress indicators
            const massPercentage = ((currentPixelCount / initialPixelCount) * 100).toFixed(1);
            if (_dom.massText) _dom.massText.textContent = `${massPercentage}%`;
            if (_dom.massBar) _dom.massBar.style.width = `${massPercentage}%`;

            const statusLed = _dom.statusLed;
            if (statusLed) {
                if (parseFloat(massPercentage) <= 25.0) {
                    statusLed.classList.add('danger');
                } else {
                    statusLed.classList.remove('danger');
                }
            }

            // Update active stars (the 5-point star emitters)
            for (let i = activeStars.length - 1; i >= 0; i--) {
                const w = activeStars[i];
                w.timer += deltaTime;

                // Spinning
                w.spin += 6.0 * deltaTime;

                // State logic:
                // 1. Growing phase (first 0.5s)
                if (w.timer < 0.5) {
                    w.size = (w.timer / 0.5) * 50;
                    w.opacity = 1.0;
                }
                // 2. Active phase (0.5s to 3.5s): Spewing small stars
                else if (w.timer < 3.5) {
                    w.size = 50;
                    w.opacity = 1.0;
                    w.projectileTimer += deltaTime;

                    // Spew a projectile every 0.105s
                    while (w.projectileTimer >= 0.105) {
                        w.projectileTimer -= 0.105;

                        // Angle facing towards planet with spread reduced by 60% (0.95 * 0.40 = 0.38)
                        const projAngle = w.angle + (Math.random() - 0.5) * 0.38;
                        const speed = (280 + Math.random() * 125) * 1.5; // 50% faster

                        const isSpecial = Math.random() < 0.15; // 15% chance
                        const color = isSpecial ? '#66b2ff' : (Math.random() < 0.5 ? '#00f0ff' : '#ff00ff');
                        const baseSize = isSpecial ? 16 : 8; // 8 is slightly smaller than 12
                        const explosionRadius = isSpecial ? 29 : 19;
                        const shakeIntensity = isSpecial ? 8 : 5;

                        activeStarProjectiles.push({
                            x: w.x,
                            y: w.y,
                            vx: Math.cos(projAngle) * speed,
                            vy: Math.sin(projAngle) * speed,
                            spinAngle: Math.random() * Math.PI * 2,
                            spinSpeed: (Math.random() * 4 + 4) * (Math.random() < 0.5 ? 1 : -1),
                            color: color,
                            baseSize: baseSize,
                            explosionRadius: explosionRadius,
                            shakeIntensity: shakeIntensity,
                            life: 0.0,
                            travelLimit: 1.25 + Math.random() * 0.5,
                            state: 'flying',
                            shrinkTimer: 0.0
                        });

                        // Play magical star shot sound alternating every 2nd projectile
                        w.shotCounter = (w.shotCounter || 0) + 1;
                        if (w.shotCounter % 2 === 0) {
                            const soundId = ((w.shotCounter / 2) % 2 === 1) ? 'sfx_magical_star_shot' : 'sfx_magical_star_shot2';
                            const detune = (Math.random() - 0.5) * 200; // +/- 100 cents detune
                            soundManager.play(soundId, false, 0.75, detune);
                        } else {
                            soundManager.play('sfx_laser_crack', false, 0.4, 500);
                        }
                    }
                }
                // 3. Shrinking / Fading phase (3.5s to 4.0s)
                else {
                    const shrinkProgress = (w.timer - 3.5) / 0.5; // 0 to 1
                    w.size = 50 * (1 - shrinkProgress);
                    w.opacity = 1 - shrinkProgress;
                }

                // Delete star after 4 seconds
                if (w.timer >= w.duration) {
                    soundManager.play('sfx_holy_shine', false, 0.4, 300);
                    shockwaves.push({
                        x: w.x,
                        y: w.y,
                        radius: 0,
                        maxRadius: 120,
                        life: 1.0,
                        maxLife: 0.7
                    });
                    activeStars.splice(i, 1);
                }
            }

            // Update star projectiles
            for (let i = activeStarProjectiles.length - 1; i >= 0; i--) {
                const p = activeStarProjectiles[i];

                if (p.state === 'flying') {
                    p.x += p.vx * deltaTime;
                    p.y += p.vy * deltaTime;
                    p.spinAngle += p.spinSpeed * deltaTime;
                    p.life += deltaTime;

                    // Collision check with planet
                    const local = screenToLocal(p.x, p.y, CENTER_X, CENTER_Y, planetRotation);
                    const px = Math.floor(local.x);
                    const py = Math.floor(local.y);

                    if (px >= 0 && px < PLANET_CANVAS_SIZE && py >= 0 && py < PLANET_CANVAS_SIZE) {
                        const sharedData = getSharedPlanetData();
                        const idx = (py * PLANET_CANVAS_SIZE + px) * 4;
                        if (sharedData.data[idx + 3] > 0) {
                            // Hit! Trigger explosion
                            createExplosion(local.x, local.y, p.explosionRadius, p.shakeIntensity, 'star_nuke', false, true);
                            activeStarProjectiles.splice(i, 1);
                            continue;
                        }
                    }

                    // Expiration check
                    if (p.life >= p.travelLimit) {
                        p.state = 'shrinking';
                        p.shrinkTimer = 0.0;
                    }
                } else if (p.state === 'shrinking') {
                    // Slow down slightly while shrinking
                    p.x += p.vx * deltaTime * 0.4;
                    p.y += p.vy * deltaTime * 0.4;
                    p.spinAngle += p.spinSpeed * deltaTime;
                    p.shrinkTimer += deltaTime;

                    if (p.shrinkTimer >= 0.3) {
                        activeStarProjectiles.splice(i, 1);
                    }
                }
            }
        }
    }

    // Draws beautiful customized vector projectiles
    function drawWeaponProjectile(w) {
        ctx.save();
        ctx.translate(w.x, w.y);
        ctx.rotate(w.angle);

        if (w.type === 'missile') {
            // Sleek rocket body
            ctx.fillStyle = '#b0b5c0';
            ctx.fillRect(-12, -4, 20, 8);

            // Fin details
            ctx.fillStyle = '#ff3366';
            ctx.beginPath();
            ctx.moveTo(-12, -8);
            ctx.lineTo(-6, -4);
            ctx.lineTo(-12, -4);
            ctx.closePath();
            ctx.fill();
            ctx.beginPath();
            ctx.moveTo(-12, 8);
            ctx.lineTo(-6, 4);
            ctx.lineTo(-12, 4);
            ctx.closePath();
            ctx.fill();

            // Pointed Nose Cone
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.moveTo(8, -4);
            ctx.lineTo(16, 0);
            ctx.lineTo(8, 4);
            ctx.closePath();
            ctx.fill();

            // Rocket engine flame
            const flameSize = Math.random() * 12 + 8;
            const gradient = ctx.createLinearGradient(-12, 0, -12 - flameSize, 0);
            gradient.addColorStop(0, '#ffcc00');
            gradient.addColorStop(0.5, '#ff3300');
            gradient.addColorStop(1, 'rgba(255, 0, 0, 0)');
            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.moveTo(-12, -3);
            ctx.lineTo(-12 - flameSize, 0);
            ctx.lineTo(-12, 3);
            ctx.closePath();
            ctx.fill();


        } else if (w.type === 'nuke') {
            if (w.state === 'flash') {
                ctx.shadowBlur = 25;
                if (w.flashPhase === 'black') {
                    ctx.shadowColor = 'rgba(0,0,0,1)';
                    ctx.fillStyle = '#000000';
                } else {
                    ctx.shadowColor = 'rgba(255,255,255,0.8)';
                    ctx.fillStyle = 'rgba(255,255,255,0.8)';
                }
                ctx.beginPath();
                ctx.arc(0, 0, w.explosionRadius * 0.85, 0, Math.PI * 2);
                ctx.fill();
                ctx.restore();
                return;
            }
            // Heavy bomb shape with yellow details
            ctx.fillStyle = '#3a3a45';
            ctx.beginPath();
            ctx.arc(0, 0, w.size, 0, Math.PI * 2);
            ctx.fill();

            // Tail fins
            ctx.fillRect(-18, -w.size + 2, 8, (w.size - 2) * 2);
            ctx.fillStyle = '#ffd200';
            ctx.beginPath();
            ctx.moveTo(-18, -w.size);
            ctx.lineTo(-10, -w.size + 3);
            ctx.lineTo(-10, w.size - 3);
            ctx.lineTo(-18, w.size);
            ctx.closePath();
            ctx.fill();

            // Pulsing red glowing hazard light
            const coreIntensityN = Math.abs(Math.sin(performance.now() * 0.015));
            ctx.fillStyle = `rgba(255, 30, 30, ${0.4 + coreIntensityN * 0.6})`;
            ctx.beginPath();
            ctx.arc(4, 0, 5, 0, Math.PI * 2);
            ctx.fill();

        } else if (w.type === 'asteroid') {
            if (w.state === 'flash') {
                ctx.shadowBlur = 35;
                if (w.flashPhase === 'black') {
                    ctx.shadowColor = 'rgba(0,0,0,1)';
                    ctx.fillStyle = '#000000';
                } else {
                    ctx.shadowColor = 'rgba(255,255,255,1)';
                    ctx.fillStyle = '#ffffff';
                }
                ctx.beginPath();
                ctx.arc(0, 0, w.explosionRadius * 1, 0, Math.PI * 2);
                ctx.fill();
                ctx.restore();
                return;
            }
            // Craggy volcanic magma rock
            const pulse = Math.abs(Math.sin(performance.now() * 0.005));
            const grad = ctx.createRadialGradient(0, 0, 2, 0, 0, w.size + 4);
            grad.addColorStop(0, '#ff9900');
            grad.addColorStop(0.4, '#e65c00');
            grad.addColorStop(0.7, '#662200');
            grad.addColorStop(1, '#1a0500');

            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(0, 0, w.size, 0, Math.PI * 2);
            ctx.fill();

            // Fiery outline glow
            ctx.strokeStyle = `rgba(255, 120, 0, ${0.4 + pulse * 0.4})`;
            ctx.lineWidth = 3;
            ctx.stroke();

        } else if (w.type === 'comet') {
            ctx.rotate(w.spinAngle || 0);

            if (!w.jaggedOffsets) {
                w.jaggedOffsets = [];
                const numVertices = 12;
                for (let j = 0; j < numVertices; j++) {
                    w.jaggedOffsets.push(w.size * (0.82 + Math.random() * 0.36));
                }
            }

            const numVertices = w.jaggedOffsets.length;
            ctx.beginPath();
            for (let j = 0; j < numVertices; j++) {
                const angleOffset = (j * Math.PI * 2) / numVertices;
                const r = w.jaggedOffsets[j];
                const vx = Math.cos(angleOffset) * r;
                const vy = Math.sin(angleOffset) * r;
                if (j === 0) ctx.moveTo(vx, vy);
                else ctx.lineTo(vx, vy);
            }
            ctx.closePath();

            const grad = ctx.createRadialGradient(0, 0, 2, 0, 0, w.size + 6);
            grad.addColorStop(0, '#e6f7ff');
            grad.addColorStop(0.4, '#80c0ff');
            grad.addColorStop(0.7, '#0066cc');
            grad.addColorStop(1, '#002b5c');

            ctx.fillStyle = grad;
            ctx.fill();

            ctx.strokeStyle = '#00d9ff';
            ctx.lineWidth = 2.5;
            ctx.stroke();

            ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(0, 0);
            for (let j = 0; j < numVertices; j += 2) {
                const angleOffset = (j * Math.PI * 2) / numVertices;
                const r = w.jaggedOffsets[j] * 0.55;
                ctx.lineTo(Math.cos(angleOffset) * r, Math.sin(angleOffset) * r);
            }
            ctx.stroke();

        } else if (w.type === 'moon') {
            if (w.state === 'flash') {
                // Phase 1: solid black circle the size of the larger explosion sprite
                ctx.fillStyle = '#000000';
                ctx.beginPath();
                ctx.arc(0, 0, w.explosionRadius * 1.3, 0, Math.PI * 2);
                ctx.fill();
            } else {
                const pulse = Math.abs(Math.sin(performance.now() * 0.005));
                const isGlowing = w.state === 'glowing';
                // Ramp-up: 0→1 over 0.4 seconds since entering glowing state
                const glowRamp = isGlowing ? Math.min(1.0, (w.glowAge || 0) / 0.4) : 0;

                // ── Draw glow halos FIRST (behind the moon body) ──
                if (isGlowing) {
                    const glowPulse = Math.abs(Math.sin(performance.now() * 0.025));
                    // Outer soft blue halo — scales from 0 → full with ramp
                    const outerR = (w.size + 22) * glowRamp;
                    ctx.strokeStyle = `rgba(130, 200, 255, ${(0.15 + glowPulse * 0.12) * glowRamp})`;
                    ctx.lineWidth = 22 * glowRamp;
                    ctx.beginPath();
                    ctx.arc(0, 0, outerR, 0, Math.PI * 2);
                    ctx.stroke();
                    // Mid blue ring
                    const midR = (w.size + 8) * glowRamp;
                    ctx.strokeStyle = `rgba(180, 225, 255, ${(0.45 + glowPulse * 0.25) * glowRamp})`;
                    ctx.lineWidth = 9 * glowRamp;
                    ctx.beginPath();
                    ctx.arc(0, 0, midR, 0, Math.PI * 2);
                    ctx.stroke();
                    // Bright white inner ring right at edge
                    const innerR = w.size * glowRamp + w.size * (1 - glowRamp);
                    ctx.strokeStyle = `rgba(240, 250, 255, ${(0.65 + glowPulse * 0.25) * glowRamp})`;
                    ctx.lineWidth = 3;
                    ctx.beginPath();
                    ctx.arc(0, 0, innerR, 0, Math.PI * 2);
                    ctx.stroke();
                }

                // ── Moon body (drawn on top of halos) ──
                let grad;
                if (isGlowing) {
                    // Soft white-blue surface gradient during glow — no red/orange
                    grad = ctx.createRadialGradient(0, 0, 0, 0, 0, w.size + 4);
                    grad.addColorStop(0, '#ffffff');
                    grad.addColorStop(0.35, `rgba(220, 238, 255, ${0.9 + glowRamp * 0.1})`);
                    grad.addColorStop(0.7, `rgba(160, 210, 245, ${0.85})`);
                    grad.addColorStop(1, '#94b8d0');
                } else {
                    grad = ctx.createRadialGradient(0, 0, 2, 0, 0, w.size + 6);
                    grad.addColorStop(0, '#eef2f7');
                    grad.addColorStop(0.3, '#cbd5e1');
                    grad.addColorStop(0.7, '#64748b');
                    grad.addColorStop(1, '#334155');
                }

                ctx.fillStyle = grad;
                ctx.beginPath();
                ctx.arc(0, 0, w.size, 0, Math.PI * 2);
                ctx.fill();

                // Craters (faded to near-invisible while glowing)
                ctx.fillStyle = isGlowing
                    ? `rgba(200, 230, 255, ${0.08 * (1 - glowRamp * 0.6)})`
                    : 'rgba(30, 41, 59, 0.25)';
                const craters = [
                    { x: -w.size * 0.4, y: -w.size * 0.3, r: w.size * 0.15 },
                    { x: w.size * 0.2, y: -w.size * 0.4, r: w.size * 0.25 },
                    { x: -w.size * 0.1, y: w.size * 0.3, r: w.size * 0.2 },
                    { x: w.size * 0.5, y: w.size * 0.2, r: w.size * 0.12 },
                    { x: -w.size * 0.5, y: w.size * 0.3, r: w.size * 0.1 }
                ];
                craters.forEach(c => {
                    ctx.beginPath();
                    ctx.arc(c.x, c.y, c.r, 0, Math.PI * 2);
                    ctx.fill();
                    if (!isGlowing) {
                        ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
                        ctx.lineWidth = 1;
                        ctx.beginPath();
                        ctx.arc(c.x, c.y, c.r, Math.PI, Math.PI * 2);
                        ctx.stroke();
                    }
                });

                // Normal sky-blue aura when not glowing
                if (!isGlowing) {
                    ctx.strokeStyle = `rgba(14, 165, 233, ${0.45 + pulse * 0.35})`;
                    ctx.lineWidth = 4;
                    ctx.beginPath();
                    ctx.arc(0, 0, w.size, 0, Math.PI * 2);
                    ctx.stroke();
                }
            }
        }

        ctx.restore();
    }

    // Draws the beautiful Excalibur giant sword
    function drawSword(w) {
        ctx.save();
        ctx.translate(w.x, w.y);
        ctx.rotate(w.angle);
        ctx.globalAlpha = w.opacity;

        // 1. Blade Outer Glow (cyan neon)
        ctx.shadowBlur = 15;
        ctx.shadowColor = '#00e5ff';
        ctx.fillStyle = 'rgba(0, 229, 255, 0.4)';
        ctx.beginPath();
        ctx.moveTo(0, 0); // Tip
        ctx.lineTo(-10, -18); // Tip bevel
        ctx.lineTo(-130, -18); // Left edge
        ctx.lineTo(-130, 18);  // Right edge
        ctx.lineTo(-10, 18);  // Tip bevel
        ctx.closePath();
        ctx.fill();

        // 2. Inner Blade Core (bright white-silver)
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.moveTo(-4, 0);
        ctx.lineTo(-12, -10);
        ctx.lineTo(-128, -10);
        ctx.lineTo(-128, 10);
        ctx.lineTo(-12, 10);
        ctx.closePath();
        ctx.fill();

        // 3. Central fuller line (engraved channel)
        ctx.strokeStyle = '#a0c0d0';
        ctx.lineWidth = 3.0;
        ctx.beginPath();
        ctx.moveTo(-20, 0);
        ctx.lineTo(-120, 0);
        ctx.stroke();

        // 4. Golden Crossguard (at x = -130)
        ctx.fillStyle = '#ffd200';
        ctx.strokeStyle = '#d4af37';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        if (ctx.roundRect) {
            ctx.roundRect(-137, -35, 14, 70, 5);
        } else {
            ctx.rect(-137, -35, 14, 70);
        }
        ctx.fill();
        ctx.stroke();

        // Guard wing details
        ctx.fillStyle = '#e6b800';
        ctx.beginPath();
        ctx.arc(-130, -35, 6, 0, Math.PI * 2);
        ctx.arc(-130, 35, 6, 0, Math.PI * 2);
        ctx.fill();

        // 5. Leather-wrapped Hilt/Handle
        ctx.fillStyle = '#3a2010';
        ctx.fillRect(-172, -6, 35, 12);
        // Gripping ridges
        ctx.strokeStyle = '#1e1005';
        ctx.lineWidth = 2;
        for (let h = -167; h <= -137; h += 6) {
            ctx.beginPath();
            ctx.moveTo(h, -6);
            ctx.lineTo(h, 6);
            ctx.stroke();
        }

        // 6. Gold Pommel & Sapphire circular gem (at end x = -172)
        ctx.fillStyle = '#ffd200';
        ctx.beginPath();
        ctx.arc(-177, 0, 9, 0, Math.PI * 2);
        ctx.fill();
        // Sapphire center
        ctx.fillStyle = '#0066ff';
        ctx.beginPath();
        ctx.arc(-177, 0, 4.5, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    }

    // Bezier curve utility evaluation
    function getBezierPoint(p0, p1, p2, t) {
        return {
            x: (1 - t) * (1 - t) * p0.x + 2 * (1 - t) * t * p1.x + t * t * p2.x,
            y: (1 - t) * (1 - t) * p0.y + 2 * (1 - t) * t * p1.y + t * t * p2.y
        };
    }

    // Draws swirling rift portal
    function drawKrakenPortal(w) {
        ctx.save();
        ctx.translate(w.portalX, w.portalY);
        ctx.scale(w.portalScale, w.portalScale);
        ctx.rotate(performance.now() * 0.008);

        const portalGrad = ctx.createRadialGradient(0, 0, 2, 0, 0, 32);
        portalGrad.addColorStop(0, '#000000');
        portalGrad.addColorStop(0.4, '#4a0e4e');
        portalGrad.addColorStop(0.8, '#a22aa8');
        portalGrad.addColorStop(1, 'rgba(162, 42, 168, 0)');
        ctx.fillStyle = portalGrad;
        ctx.beginPath();
        ctx.arc(0, 0, 32, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = '#a22aa8';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([8, 12]);
        ctx.beginPath();
        ctx.arc(0, 0, 24, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
    }

    // Draws three curling Cthulhu tentacles along quadratic splines
    function drawKrakenTentacle(w) {
        if (!w.tentacles || w.tentacles.length === 0) return;

        w.tentacles.forEach((tent, tIdx) => {
            if (tent.progress <= 0) return;

            const p0 = { x: w.portalX, y: w.portalY };
            const p1 = { x: tent.controlX, y: tent.controlY };
            const p2 = { x: tent.targetX, y: tent.targetY };

            // Dynamically calculate segments to avoid stretching or spacing gaps
            const dxP = tent.targetX - w.portalX;
            const dyP = tent.targetY - w.portalY;
            const approxLength = Math.sqrt(dxP * dxP + dyP * dyP) * 1.3;
            const numSegments = Math.max(32, Math.ceil(approxLength / 4.2)); // segments every 4 pixels!

            const points = [];
            for (let j = 0; j <= numSegments; j++) {
                const tVal = (j / numSegments) * tent.progress;
                points.push(getBezierPoint(p0, p1, p2, tVal));
            }

            const baseRadius = 17.5; // Beefy Lovecraftian muscle mass!

            // Eldritch crackling purple/cyan lightning along the tentacle body (fixed flicker rate)
            tent.lightningTimer = (tent.lightningTimer || 0) + frameDeltaTime;
            if (tent.lightningTimer >= 0.111 / particleBudget) {
                tent.lightningTimer = 0;
                ctx.save();
                ctx.strokeStyle = Math.random() > 0.45 ? '#d946ef' : '#00f3ff';
                ctx.lineWidth = 1.4;
                ctx.shadowBlur = 8;
                ctx.shadowColor = ctx.strokeStyle;
                ctx.beginPath();
                ctx.moveTo(p0.x, p0.y);

                const steps = 6;
                for (let s = 1; s <= steps; s++) {
                    const tVal = s / steps;
                    const bp = getBezierPoint(p0, p1, p2, tVal * tent.progress);
                    const jitterX = (Math.random() - 0.5) * 16;
                    const jitterY = (Math.random() - 0.5) * 16;
                    ctx.lineTo(bp.x + jitterX, bp.y + jitterY);
                }
                ctx.stroke();
                ctx.restore();
            }

            // Outer glow using pulsating organic coordinates
            ctx.save();
            ctx.shadowBlur = 12;
            ctx.shadowColor = '#d946ef';
            ctx.beginPath();
            for (let j = 0; j <= numSegments; j++) {
                const pt = points[j];
                const pulsePhase = performance.now() * 0.009 - j * 0.16;
                const pulse = 1.0 + 0.15 * Math.sin(pulsePhase);
                const r = (baseRadius + 1.2) * (1 - (j / numSegments) * 0.68) * pulse;
                ctx.moveTo(pt.x + r, pt.y);
                ctx.arc(pt.x, pt.y, r, 0, Math.PI * 2);
            }
            ctx.fillStyle = 'rgba(120, 20, 150, 0.2)';
            ctx.fill();
            ctx.restore();

            // Tentacle segments (smooth muscular flesh overlay)
            for (let j = 0; j <= numSegments; j++) {
                const pt = points[j];
                const pulsePhase = performance.now() * 0.009 - j * 0.16;
                const pulse = 1.0 + 0.15 * Math.sin(pulsePhase);
                const r = baseRadius * (1 - (j / numSegments) * 0.68) * pulse;

                ctx.fillStyle = `hsl(${290 + (j / numSegments) * 35 + tIdx * 12}, 90%, ${25 + (j % 2) * 8}%)`;
                ctx.beginPath();
                ctx.arc(pt.x, pt.y, r, 0, Math.PI * 2);
                ctx.fill();

                // Specular highlight
                ctx.fillStyle = `rgba(255, 200, 255, ${0.4 * (1 - j / numSegments)})`;
                ctx.beginPath();
                ctx.arc(pt.x - r * 0.2, pt.y - r * 0.2, r * 0.3, 0, Math.PI * 2);
                ctx.fill();

                // Suction cups on inner side
                if (j > 0 && j < numSegments && j % 3 === 0) {
                    const prev = points[j - 1];
                    const next = points[Math.min(j + 1, points.length - 1)];
                    const dx = next.x - prev.x;
                    const dy = next.y - prev.y;
                    const len = Math.sqrt(dx * dx + dy * dy);
                    if (len > 0) {
                        const px = -dy / len;
                        const py = dx / len;

                        const cupX = pt.x + px * r * 0.85;
                        const cupY = pt.y + py * r * 0.85;
                        const cupR = r * 0.32;

                        ctx.fillStyle = '#ff00aa';
                        ctx.beginPath();
                        ctx.arc(cupX, cupY, cupR, 0, Math.PI * 2);
                        ctx.fill();

                        ctx.fillStyle = '#00f3ff';
                        ctx.beginPath();
                        ctx.arc(cupX, cupY, cupR * 0.55, 0, Math.PI * 2);
                        ctx.fill();
                    }
                }

                // Blinking vertical-pupil slit void eyes along the tentacle length
                if (j > 0 && j < numSegments && j % 8 === 0) {
                    const eyeBlink = Math.sin(performance.now() * 0.0022 + j * 0.4);
                    if (eyeBlink > -0.15) { // periodic blink cycle
                        const eyeWidth = r * 0.58;
                        const eyeHeight = r * 0.26 * Math.max(0, eyeBlink);

                        ctx.save();
                        ctx.translate(pt.x, pt.y);

                        // Void eye background
                        ctx.fillStyle = '#0a0014';
                        ctx.beginPath();
                        ctx.ellipse(0, 0, eyeWidth, eyeHeight, 0, 0, Math.PI * 2);
                        ctx.fill();

                        // Glowing cyan pupil slit
                        ctx.fillStyle = '#00f3ff';
                        ctx.beginPath();
                        ctx.ellipse(0, 0, eyeWidth * 0.22, eyeHeight, 0, 0, Math.PI * 2);
                        ctx.fill();

                        ctx.restore();
                    }
                }
            }

            // Draw claw hooks at tentacle tip during grabbing
            if (tent.progress >= 0.95) {
                const tipPt = points[points.length - 1];
                const prevPt = points[Math.max(0, points.length - 2)];
                const tipAngle = Math.atan2(tipPt.y - prevPt.y, tipPt.x - prevPt.x);

                ctx.save();
                ctx.translate(tipPt.x, tipPt.y);
                ctx.rotate(tipAngle);

                // Calculate clench progress: claws curl shut during first 40% of grab and stay shut
                let clench = 0;
                if (w.state === 'grabbing') {
                    const grabProgress = Math.max(0.0, Math.min(1.0, 1.0 - (w.tentacleTimer / 1.2)));
                    clench = Math.min(1.0, grabProgress / 0.4);
                } else if (w.state === 'retracting' || w.state === 'portal_closing') {
                    clench = 1.0;
                }

                // Three claw hooks curling inward
                for (let c = -1; c <= 1; c++) {
                    ctx.save();
                    // Rotate claw further inward if clenched!
                    ctx.rotate(c * (0.5 - clench * 0.35));
                    ctx.strokeStyle = '#cc00ff';
                    ctx.lineWidth = 3;
                    ctx.lineCap = 'round';
                    ctx.beginPath();
                    ctx.moveTo(0, 0);

                    // Adjust Bezier curvature of claws to look tightly curled when clenched!
                    const xControl = 10 - clench * 4;
                    const yControl = c * (4 - clench * 2);
                    const xEnd = 6 - clench * 3;
                    const yEnd = c * (9 - clench * 5);

                    ctx.quadraticCurveTo(xControl, yControl, xEnd, yEnd);
                    ctx.stroke();
                    ctx.restore();
                }

                ctx.restore();
            }

            // Draw grabbed chunks of earth near the tip
            if (tent.grabbedChunks && tent.grabbedChunks.length > 0) {
                const tipPt = points[points.length - 1];
                tent.grabbedChunks.forEach(chunk => {
                    ctx.save();
                    ctx.shadowBlur = 8;
                    ctx.shadowColor = '#d946ef'; // Purple alien energy glow on ripped chunks
                    ctx.fillStyle = chunk.color;
                    ctx.beginPath();
                    ctx.arc(tipPt.x + chunk.offsetX, tipPt.y + chunk.offsetY, chunk.size, 0, Math.PI * 2);
                    ctx.fill();

                    // Glowing core representing alien hold
                    ctx.fillStyle = '#ff00aa';
                    ctx.beginPath();
                    ctx.arc(tipPt.x + chunk.offsetX, tipPt.y + chunk.offsetY, chunk.size * 0.45, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.restore();
                });
            }
        });
    }

    // Draws a glossy high-fidelity celestial bowling ball with finger holes and a fuse indicator
    function drawBowlingBall(w, isLocal = false) {
        ctx.save();
        if (isLocal) {
            // Inside local planet coordinate space
            ctx.translate(w.localX - planetCenterX, w.localY - planetCenterY);
        } else {
            // In screen space
            ctx.translate(w.x, w.y);
        }

        let angle = w.angle;
        if (w.state === 'stuck') {
            angle = w.stuckAngle;
        } else {
            angle = performance.now() * 0.01;
        }
        ctx.rotate(angle);

        // 1. The Bowling Ball Sphere
        ctx.shadowBlur = 10;
        ctx.shadowColor = 'rgba(0, 217, 255, 0.4)';

        const grad = ctx.createRadialGradient(-w.size * 0.2, -w.size * 0.2, 2, 0, 0, w.size);
        grad.addColorStop(0, '#8a9abf');
        grad.addColorStop(0.35, '#3a4a6a');
        grad.addColorStop(0.75, '#1a1e2e');
        grad.addColorStop(1, '#0a0c14');
        ctx.fillStyle = grad;

        ctx.beginPath();
        ctx.arc(0, 0, w.size, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = 'rgba(0, 217, 255, 0.35)';
        ctx.lineWidth = 1;
        ctx.stroke();

        // 2. Three finger holes
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#0a0a0f';
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
        ctx.lineWidth = 0.5;

        const holeRadius = w.size * 0.15;
        const offsets = [
            { x: -w.size * 0.3, y: -w.size * 0.25 },
            { x: w.size * 0.1, y: -w.size * 0.4 },
            { x: -w.size * 0.05, y: -w.size * 0.1 }
        ];

        offsets.forEach(offset => {
            ctx.beginPath();
            ctx.arc(offset.x, offset.y, holeRadius, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
        });

        // 3. Danger light indicator
        if (w.state === 'stuck') {
            const timeRemaining = w.stuckTimer;
            const pulseSpeed = timeRemaining < 0.75 ? 0.04 : 0.015;
            const pulse = Math.abs(Math.sin(performance.now() * pulseSpeed));
            ctx.fillStyle = `rgba(255, 0, 85, ${0.3 + pulse * 0.7})`;
            ctx.beginPath();
            ctx.arc(0, 0, w.size * 0.22, 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.restore();
    }

    // Draws the giant human fist sprite
    function drawFist(w) {
        if (!fistImage) return;

        ctx.save();
        ctx.translate(w.x, w.y);
        ctx.rotate(w.angle - Math.PI / 2);
        ctx.globalAlpha = w.opacity;

        const width = w.width; // 200
        const height = w.width * (994 / 601); // ~330px

        // Draw centered horizontally, extending backward along negative local Y, with 12px knuckles overlap
        ctx.drawImage(fistImage, -width / 2, -height + 12, width, height);

        ctx.restore();
    }

    // -------------------------------------------------------------
    // FIST IMPACT TREE CRACKS (Direct Pixel Carving into Planet Canvas)
    // Modeled after othergame.html pixel carving system
    // -------------------------------------------------------------
    function carveFistImpactCracksStage1(w) {
        const localHit = screenToLocal(w.x, w.y, CENTER_X, CENTER_Y, planetRotation);
        const localAngle = w.angle - planetRotation;
        const perpAngle = localAngle + Math.PI / 2;

        const imgData = hiddenCtx.getImageData(0, 0, PLANET_CANVAS_SIZE, PLANET_CANVAS_SIZE);
        const data = imgData.data;
        const size = PLANET_CANVAS_SIZE;

        let minX = size, minY = size, maxX = 0, maxY = 0;

        function darkenPixel(px, py, strength) {
            if (px < 0 || py < 0 || px >= size || py >= size) return;
            const idx = (py * size + px) * 4;
            if (data[idx + 3] === 0) return;
            const s = Math.min(1, Math.max(0, strength));
            if (s <= 0.02) return;
            // Deep pitch black fracture
            data[idx] = Math.floor(data[idx] * (1 - s * 0.96));
            data[idx + 1] = Math.floor(data[idx + 1] * (1 - s * 0.96));
            data[idx + 2] = Math.floor(data[idx + 2] * (1 - s * 0.98));
            if (px < minX) minX = px;
            if (py < minY) minY = py;
            if (px > maxX) maxX = px;
            if (py > maxY) maxY = py;
        }

        function stampCrackPoint(cx, cy, halfW, coreStrength) {
            const r = Math.ceil(halfW + 1.1);
            const r2 = (halfW + 0.9) * (halfW + 0.9);
            const coreR = Math.max(0.3, halfW * 0.3);
            const coreR2 = coreR * coreR;
            for (let dy = -r; dy <= r; dy++) {
                for (let dx = -r; dx <= r; dx++) {
                    const d2 = dx * dx + dy * dy;
                    if (d2 > r2) continue;
                    let s;
                    if (d2 <= coreR2) {
                        s = coreStrength;
                    } else {
                        const d = Math.sqrt(d2);
                        const t = (d - coreR) / Math.max(0.01, halfW + 0.9 - coreR);
                        s = coreStrength * (1 - t) * (1 - t);
                    }
                    const n = ((Math.sin(cx * 0.37 + cy * 0.29 + dx * 1.7) + 1) * 0.5);
                    s *= 0.8 + n * 0.25;
                    darkenPixel(Math.round(cx + dx), Math.round(cy + dy), s);
                }
            }
        }

        function rasterizePolyline(points) {
            for (let i = 0; i < points.length - 1; i++) {
                const p0 = points[i];
                const p1 = points[i + 1];
                const dx = p1.x - p0.x;
                const dy = p1.y - p0.y;
                const dist = Math.hypot(dx, dy) || 1;
                const samples = Math.max(2, Math.ceil(dist));
                for (let s = 0; s <= samples; s++) {
                    const u = s / samples;
                    const px = p0.x + dx * u;
                    const py = p0.y + dy * u;
                    const w = p0.w + (p1.w - p0.w) * u;
                    const tipFade = 0.65 + 0.35 * (1 - (i + u) / Math.max(1, points.length - 1));
                    stampCrackPoint(px, py, w, 0.98 * tipFade);
                }
            }
        }

        // Recursive tree branch builder for Stage 1 (moderately reaching, clean tectonic fractures)
        function buildBranchStage1(startX, startY, angle, length, baseWidth, depth) {
            const points = [{ x: startX, y: startY, w: baseWidth }];
            let x = startX, y = startY;
            let a = angle;
            const stepLen = 6.5;
            const steps = Math.max(5, Math.floor(length / stepLen));
            const children = [];

            for (let i = 0; i < steps; i++) {
                const t = i / steps;
                a += (Math.random() - 0.5) * 0.23;
                x += Math.cos(a) * stepLen * (0.9 + Math.random() * 0.2);
                y += Math.sin(a) * stepLen * (0.9 + Math.random() * 0.2);
                // Needle-sharp tapering down to true point (0.1px)
                const w = Math.max(0.1, baseWidth * (1 - t * 0.92) * (0.9 + Math.random() * 0.2));
                points.push({ x, y, w });

                // Infrequent, clean branching
                if (depth > 0 && t > 0.30 && t < 0.75 && Math.random() < 0.20) {
                    const side = (Math.random() < 0.5 ? -1 : 1);
                    const bLen = length * (0.42 + Math.random() * 0.20) * (1 - t * 0.5);
                    const bAng = a + side * (0.45 + Math.random() * 0.25);
                    const childBranch = buildBranchStage1(x, y, bAng, bLen, baseWidth * (0.55 + Math.random() * 0.15), depth - 1);
                    children.push(childBranch);
                }
            }

            rasterizePolyline(points);

            return {
                points,
                endX: x,
                endY: y,
                endAngle: a,
                endWidth: points[points.length - 1].w,
                baseWidth,
                depth,
                children
            };
        }

        // 4 to 5 prominent fractures
        const numMain = 4 + (Math.random() < 0.6 ? 1 : 0);
        const hSpread = w.width * 0.35;
        const mainBranches = [];

        for (let k = 0; k < numMain; k++) {
            const offsetNorm = numMain === 1 ? 0 : (k / (numMain - 1)) * 2 - 1; // -1 to +1
            const offset = offsetNorm * hSpread;
            const sx = localHit.x + Math.cos(perpAngle) * offset;
            const sy = localHit.y + Math.sin(perpAngle) * offset;
            // Clean fanning trajectory towards the planet interior
            const ang = localAngle + offsetNorm * 0.42 + (Math.random() - 0.5) * 0.15;
            // Shorter, controlled length: 50 - 72px
            const len = 50 + Math.random() * 22;
            // Thinner base width: 3.6 - 5.4px
            const width = 3.6 + Math.random() * 1.8;

            const branch = buildBranchStage1(sx, sy, ang, len, width, 1);
            mainBranches.push(branch);
        }

        // Commit pixel modifications
        if (maxX >= minX && maxY >= minY) {
            const wBox = maxX - minX + 1;
            const hBox = maxY - minY + 1;
            hiddenCtx.putImageData(imgData, 0, 0, minX, minY, wBox, hBox);
        }

        // Save continuation data on the fist instance for impact 2
        w.crackData = {
            mainBranches,
            localHit,
            localAngle,
            perpAngle
        };
    }

    function carveFistImpactCracksStage2(w) {
        if (!w.crackData) return;
        const imgData = hiddenCtx.getImageData(0, 0, PLANET_CANVAS_SIZE, PLANET_CANVAS_SIZE);
        const data = imgData.data;
        const size = PLANET_CANVAS_SIZE;

        let minX = size, minY = size, maxX = 0, maxY = 0;

        function darkenPixel(px, py, strength) {
            if (px < 0 || py < 0 || px >= size || py >= size) return;
            const idx = (py * size + px) * 4;
            if (data[idx + 3] === 0) return;
            const s = Math.min(1, Math.max(0, strength));
            if (s <= 0.02) return;
            data[idx] = Math.floor(data[idx] * (1 - s * 0.96));
            data[idx + 1] = Math.floor(data[idx + 1] * (1 - s * 0.96));
            data[idx + 2] = Math.floor(data[idx + 2] * (1 - s * 0.98));
            if (px < minX) minX = px;
            if (py < minY) minY = py;
            if (px > maxX) maxX = px;
            if (py > maxY) maxY = py;
        }

        function stampCrackPoint(cx, cy, halfW, coreStrength) {
            const r = Math.ceil(halfW + 1.1);
            const r2 = (halfW + 0.9) * (halfW + 0.9);
            const coreR = Math.max(0.3, halfW * 0.3);
            const coreR2 = coreR * coreR;
            for (let dy = -r; dy <= r; dy++) {
                for (let dx = -r; dx <= r; dx++) {
                    const d2 = dx * dx + dy * dy;
                    if (d2 > r2) continue;
                    let s;
                    if (d2 <= coreR2) {
                        s = coreStrength;
                    } else {
                        const d = Math.sqrt(d2);
                        const t = (d - coreR) / Math.max(0.01, halfW + 0.9 - coreR);
                        s = coreStrength * (1 - t) * (1 - t);
                    }
                    const n = ((Math.sin(cx * 0.37 + cy * 0.29 + dx * 1.7) + 1) * 0.5);
                    s *= 0.8 + n * 0.25;
                    darkenPixel(Math.round(cx + dx), Math.round(cy + dy), s);
                }
            }
        }

        function rasterizePolyline(points) {
            for (let i = 0; i < points.length - 1; i++) {
                const p0 = points[i];
                const p1 = points[i + 1];
                const dx = p1.x - p0.x;
                const dy = p1.y - p0.y;
                const dist = Math.hypot(dx, dy) || 1;
                const samples = Math.max(2, Math.ceil(dist));
                for (let s = 0; s <= samples; s++) {
                    const u = s / samples;
                    const px = p0.x + dx * u;
                    const py = p0.y + dy * u;
                    const w = p0.w + (p1.w - p0.w) * u;
                    const tipFade = 0.60 + 0.40 * (1 - (i + u) / Math.max(1, points.length - 1));
                    stampCrackPoint(px, py, w, 0.98 * tipFade);
                }
            }
        }

        function buildBranchExtension(startX, startY, angle, length, startWidth, depth) {
            const points = [{ x: startX, y: startY, w: startWidth }];
            let x = startX, y = startY;
            let a = angle;
            const stepLen = 6.5;
            const steps = Math.max(5, Math.floor(length / stepLen));

            for (let i = 0; i < steps; i++) {
                const t = i / steps;
                a += (Math.random() - 0.5) * 0.23;
                x += Math.cos(a) * stepLen * (0.9 + Math.random() * 0.2);
                y += Math.sin(a) * stepLen * (0.9 + Math.random() * 0.2);
                // Needle-sharp tapering down to true point (0.1px)
                const w = Math.max(0.1, startWidth * (1 - t * 0.92) * (0.9 + Math.random() * 0.2));
                points.push({ x, y, w });

                // Infrequent secondary branching along extension
                if (depth > 0 && t > 0.25 && t < 0.75 && Math.random() < 0.20) {
                    const side = (Math.random() < 0.5 ? -1 : 1);
                    const bLen = length * (0.42 + Math.random() * 0.20) * (1 - t * 0.4);
                    const bAng = a + side * (0.45 + Math.random() * 0.25);
                    buildBranchExtension(x, y, bAng, bLen, startWidth * 0.6, depth - 1);
                }
            }

            rasterizePolyline(points);
        }

        // Process all main branches from Stage 1:
        // 1. Re-stamp the base points with 1.3x width (deepens the root fissure)
        // 2. Extend from the exact end of Stage 1 (shorter extension: 35 - 53px)
        // 3. Sprout an extra generation of clean sub-branches along the fracture
        w.crackData.mainBranches.forEach(branch => {
            // 1. Re-deepen base
            for (let i = 0; i < Math.min(branch.points.length, 5); i++) {
                const pt = branch.points[i];
                stampCrackPoint(pt.x, pt.y, pt.w * 1.3, 0.98);
            }

            // 2. Continue branch from exact stage 1 end point (tight extension: 35 - 53px)
            const extLen = 35 + Math.random() * 18;
            buildBranchExtension(branch.endX, branch.endY, branch.endAngle, extLen, branch.endWidth * 1.1, 1);

            // 3. Extra sub-branches branching off existing Stage 1 points ("branching out an extra time")
            for (let i = 3; i < branch.points.length - 1; i += 4) {
                if (Math.random() < 0.35) {
                    const pt = branch.points[i];
                    const side = (Math.random() < 0.5 ? -1 : 1);
                    const extraAng = branch.endAngle + side * (0.45 + Math.random() * 0.3);
                    const extraLen = 18 + Math.random() * 10;
                    buildBranchExtension(pt.x, pt.y, extraAng, extraLen, pt.w * 0.65, 0);
                }
            }

            // Also extend any child branches from stage 1
            if (branch.children) {
                branch.children.forEach(child => {
                    const childExtLen = 18 + Math.random() * 10;
                    buildBranchExtension(child.endX, child.endY, child.endAngle, childExtLen, child.endWidth * 1.1, 0);
                });
            }
        });

        if (maxX >= minX && maxY >= minY) {
            const wBox = maxX - minX + 1;
            const hBox = maxY - minY + 1;
            hiddenCtx.putImageData(imgData, 0, 0, minX, minY, wBox, hBox);
        }
    }

    function drawFivePointStar(spikes, outerRadius, innerRadius, spinAngle, fillStyle, strokeStyle = null) {
        let rot = Math.PI / 2 * 3 + spinAngle;
        let x = 0;
        let y = 0;
        const step = Math.PI / spikes;

        ctx.beginPath();
        ctx.moveTo(Math.cos(rot) * outerRadius, Math.sin(rot) * outerRadius);
        for (let i = 0; i < spikes; i++) {
            x = Math.cos(rot) * outerRadius;
            y = Math.sin(rot) * outerRadius;
            ctx.lineTo(x, y);
            rot += step;

            x = Math.cos(rot) * innerRadius;
            y = Math.sin(rot) * innerRadius;
            ctx.lineTo(x, y);
            rot += step;
        }
        ctx.closePath();
        ctx.fillStyle = fillStyle;
        ctx.fill();
        if (strokeStyle) {
            ctx.strokeStyle = strokeStyle;
            ctx.lineWidth = 2.5;
            ctx.stroke();
        }
    }

    function drawStar(w) {
        ctx.save();
        ctx.translate(w.x, w.y);
        ctx.globalAlpha = w.opacity;

        // Draw premium radial glow behind the star
        const glowRad = ctx.createRadialGradient(0, 0, w.size * 0.1, 0, 0, w.size * 1.6);
        glowRad.addColorStop(0, 'rgba(255, 230, 0, 0.6)');
        glowRad.addColorStop(0.4, 'rgba(255, 0, 255, 0.35)');
        glowRad.addColorStop(1, 'rgba(255, 0, 255, 0)');
        ctx.fillStyle = glowRad;
        ctx.beginPath();
        ctx.arc(0, 0, w.size * 1.6, 0, Math.PI * 2);
        ctx.fill();

        // Point the top spike towards the planet center
        ctx.rotate(w.angle - (3 * Math.PI / 2));

        ctx.shadowBlur = 25;
        ctx.shadowColor = 'rgba(255, 0, 255, 0.95)';

        drawFivePointStar(5, w.size, w.size * 0.4, w.spin, '#ffe600', '#ffb3ff');
        ctx.restore();
    }

    function drawStarProjectile(p) {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.spinAngle);

        ctx.shadowBlur = 8;
        ctx.shadowColor = p.color;

        const currentSize = p.state === 'shrinking' ? p.baseSize * (1.0 - p.shrinkTimer / 0.3) : p.baseSize;
        if (currentSize > 0) {
            drawFivePointStar(5, currentSize, currentSize * 0.4, 0, p.color, '#ffffff');
        }
        ctx.restore();
    }

    // Starfield bucketing scratch: 16 alpha levels, each holding star indices.
    // Reused every frame (length counters reset) to avoid any allocation.
    const STAR_ALPHA_LEVELS = 16;
    const starBuckets = [];
    const starBucketCounts = new Uint8Array(STAR_ALPHA_LEVELS);
    for (let i = 0; i < STAR_ALPHA_LEVELS; i++) starBuckets.push([]);

    // Pre-rendered accretion disk for black holes. The original inline version
    // drew 14 shadowBlur-30 strokes per frame (back ring + front ring + 12 band
    // arcs) — the most expensive glow in the game. Everything is baked once into
    // offscreen sprites at max black-hole size; per frame only a few scaled blits
    // remain. The halo sprites bake glow + stroke together, so they reproduce the
    // original single-stroke brightness exactly (no separate core blits — those
    // would composite the stroke twice). The back half (full ring + dimmer band
    // pass) is drawn behind the event horizon so the sphere occludes its far side;
    // the front half (upper arc + brighter band pass) over it to warp around; the
    // halos breathe via alpha and the bands rotate via a draw-time swirl.
    const DISK_SQUISH = 0.32; // vertical squish that gives the disk its 3D perspective
    let accretionDiskSprites = null;
    function getAccretionDiskSprites() {
        if (accretionDiskSprites) return accretionDiskSprites;
        const size = 75; // max displaySize of any black hole
        const margin = 50; // shadowBlur 30 + stroke bleed
        const half = Math.ceil(size * 1.79 + margin);

        function makeSprite(draw) {
            const canvas = document.createElement('canvas');
            canvas.width = half * 2;
            canvas.height = half * 2;
            const c = canvas.getContext('2d');
            c.translate(half, half);
            draw(c);
            return canvas;
        }
        // Baked WITH the 0.32 squish already applied. shadowBlur is a device-space
        // effect, so the original's blur was circular in screen space, applied after
        // the squish. Baking round and squishing the sprite at blit time compresses
        // the glow vertically (measured mean error 10.3/255); baking pre-squished
        // and blitting with only the tilt reproduces the original (error 1.1).
        // Safe for the rings because they need no draw-time swirl - unlike the
        // bands, whose rotation has to happen inside the squish.
        function bakeRing(c, color, alpha, arcTo) {
            c.scale(1.0, DISK_SQUISH);
            c.shadowBlur = 30;
            c.shadowColor = 'rgba(255, 90, 0, 0.95)';
            c.strokeStyle = `rgba(${color}, ${alpha})`;
            c.lineWidth = size * 0.28;
            c.beginPath();
            c.arc(0, 0, size * 1.55, 0, arcTo);
            c.stroke();
        }
        function bakeBands(c, goldAlpha, redAlpha) {
            c.shadowBlur = 30;
            c.shadowColor = 'rgba(255, 90, 0, 0.95)';
            const diskRays = 6;
            for (let j = 0; j < diskRays; j++) {
                const angle = (j * Math.PI * 2) / diskRays;
                c.strokeStyle = j % 2 === 0 ? `rgba(255, 215, 0, ${goldAlpha})` : `rgba(255, 70, 0, ${redAlpha})`;
                c.lineWidth = size * 0.14;
                c.beginPath();
                c.arc(0, 0, size * (1.35 + (j % 3) * 0.22), angle, angle + 1.4);
                c.stroke();
            }
        }
        // Back pass (behind the event horizon): full ring + dimmer band layer
        const backHalo = makeSprite(c => bakeRing(c, '255, 140, 0', 0.85, Math.PI * 2));
        const backBands = makeSprite(c => bakeBands(c, 0.75, 0.6));
        // Front pass (over the horizon): upper arc + brighter band layer
        const frontHalo = makeSprite(c => bakeRing(c, '255, 140, 0', 0.9, Math.PI));
        const frontBands = makeSprite(c => bakeBands(c, 0.85, 0.7));
        accretionDiskSprites = { backHalo, backBands, frontHalo, frontBands };
        return accretionDiskSprites;
    }

    // -------------------------------------------------------------
    // PROCEDURAL NEBULA BACKGROUND BAKER
    // Soft, rounded multi-tiered blue-purple nebula shapes along perimeter
    // -------------------------------------------------------------
    function bakeNebulaCanvas(w, h) {
        if (!w || !h) return;
        if (!nebulaCanvas) {
            nebulaCanvas = document.createElement('canvas');
        }
        nebulaCanvas.width = w;
        nebulaCanvas.height = h;
        const nCtx = nebulaCanvas.getContext('2d');
        if (!nCtx) return;

        // Base space color (#000000) baked into single texture
        nCtx.fillStyle = '#000000';
        nCtx.fillRect(0, 0, w, h);

        // Layer 1: Deep Outer Indigo-Blue Layer (very dark subtle wisp)
        nCtx.fillStyle = 'rgba(4, 14, 40, 0.28)';

        // Top & Top-Right perimeter mass
        nCtx.beginPath();
        nCtx.moveTo(0, 0);
        nCtx.lineTo(w, 0);
        nCtx.lineTo(w, h * 0.48);
        nCtx.bezierCurveTo(w * 0.82, h * 0.42, w * 0.76, h * 0.20, w * 0.64, h * 0.18);
        nCtx.bezierCurveTo(w * 0.52, h * 0.16, w * 0.46, h * 0.30, w * 0.32, h * 0.28);
        nCtx.bezierCurveTo(w * 0.18, h * 0.26, w * 0.12, h * 0.08, 0, h * 0.14);
        nCtx.closePath();
        nCtx.fill();

        // Right & Bottom-Right perimeter mass
        nCtx.beginPath();
        nCtx.moveTo(w, h * 0.28);
        nCtx.lineTo(w, h);
        nCtx.lineTo(w * 0.42, h);
        nCtx.bezierCurveTo(w * 0.54, h * 0.86, w * 0.66, h * 0.92, w * 0.72, h * 0.80);
        nCtx.bezierCurveTo(w * 0.80, h * 0.64, w * 0.66, h * 0.52, w * 0.78, h * 0.38);
        nCtx.bezierCurveTo(w * 0.86, h * 0.28, w * 0.94, h * 0.30, w, h * 0.28);
        nCtx.closePath();
        nCtx.fill();

        // Bottom-Left & Left perimeter mass
        nCtx.beginPath();
        nCtx.moveTo(0, h * 0.12);
        nCtx.lineTo(0, h);
        nCtx.lineTo(w * 0.54, h);
        nCtx.bezierCurveTo(w * 0.42, h * 0.92, w * 0.34, h * 0.78, w * 0.22, h * 0.80);
        nCtx.bezierCurveTo(w * 0.10, h * 0.82, w * 0.14, h * 0.60, w * 0.08, h * 0.46);
        nCtx.bezierCurveTo(w * 0.02, h * 0.34, w * 0.06, h * 0.20, 0, h * 0.12);
        nCtx.closePath();
        nCtx.fill();

        // Layer 2: Mid-Tone Dark Soft Blue-Purple Layer
        nCtx.fillStyle = 'rgba(6, 18, 50, 0.20)';

        // Top-Left to Top-Center organic cloud
        nCtx.beginPath();
        nCtx.moveTo(0, 0);
        nCtx.lineTo(w * 0.58, 0);
        nCtx.bezierCurveTo(w * 0.50, h * 0.14, w * 0.40, h * 0.20, w * 0.28, h * 0.18);
        nCtx.bezierCurveTo(w * 0.16, h * 0.16, w * 0.12, h * 0.05, 0, h * 0.09);
        nCtx.closePath();
        nCtx.fill();

        // Top-Right deep sweeping lobe
        nCtx.beginPath();
        nCtx.moveTo(w * 0.66, 0);
        nCtx.lineTo(w, 0);
        nCtx.lineTo(w, h * 0.38);
        nCtx.bezierCurveTo(w * 0.86, h * 0.34, w * 0.80, h * 0.16, w * 0.70, h * 0.12);
        nCtx.bezierCurveTo(w * 0.68, h * 0.06, w * 0.67, 0.02, w * 0.66, 0);
        nCtx.closePath();
        nCtx.fill();

        // Right-hand organic lobe reaching inward
        nCtx.beginPath();
        nCtx.moveTo(w, h * 0.40);
        nCtx.lineTo(w, h * 0.86);
        nCtx.bezierCurveTo(w * 0.84, h * 0.78, w * 0.74, h * 0.66, w * 0.76, h * 0.52);
        nCtx.bezierCurveTo(w * 0.78, h * 0.42, w * 0.90, h * 0.40, w, h * 0.40);
        nCtx.closePath();
        nCtx.fill();

        // Bottom-Left large organic sweeping lobe
        nCtx.beginPath();
        nCtx.moveTo(0, h * 0.38);
        nCtx.lineTo(0, h);
        nCtx.lineTo(w * 0.40, h);
        nCtx.bezierCurveTo(w * 0.30, h * 0.86, w * 0.26, h * 0.72, w * 0.15, h * 0.74);
        nCtx.bezierCurveTo(w * 0.05, h * 0.74, w * 0.07, h * 0.50, 0, h * 0.38);
        nCtx.closePath();
        nCtx.fill();

        // Layer 3: Dark Subtle Accent Highlights
        nCtx.fillStyle = 'rgba(10, 24, 62, 0.14)';

        // Top-right corner accent
        nCtx.beginPath();
        nCtx.moveTo(w * 0.80, 0);
        nCtx.lineTo(w, 0);
        nCtx.lineTo(w, h * 0.22);
        nCtx.bezierCurveTo(w * 0.88, h * 0.18, w * 0.84, h * 0.06, w * 0.80, 0);
        nCtx.closePath();
        nCtx.fill();

        // Bottom-left accent lobe
        nCtx.beginPath();
        nCtx.moveTo(0, h * 0.62);
        nCtx.lineTo(0, h);
        nCtx.lineTo(w * 0.24, h);
        nCtx.bezierCurveTo(w * 0.16, h * 0.88, w * 0.10, h * 0.78, w * 0.05, h * 0.76);
        nCtx.bezierCurveTo(w * 0.01, h * 0.74, 0.005, h * 0.68, 0, h * 0.62);
        nCtx.closePath();
        nCtx.fill();

        // Right-center accent lobe
        nCtx.beginPath();
        nCtx.moveTo(w, h * 0.50);
        nCtx.lineTo(w, h * 0.76);
        nCtx.bezierCurveTo(w * 0.86, h * 0.68, w * 0.82, h * 0.58, w, h * 0.50);
        nCtx.closePath();
        nCtx.fill();
    }

    // Draws 4-point pointy celestial diamond sparkle stars (perfect vertical/horizontal symmetry)
    function drawDiamondStar(c, x, y, size, alpha, color) {
        c.save();
        c.globalAlpha = alpha;
        c.fillStyle = color || '#ffffff';
        const arm = size;
        const waist = size * 0.15;
        c.beginPath();
        // Top tip (0, -arm) -> Right tip (arm, 0)
        c.moveTo(x, y - arm);
        c.quadraticCurveTo(x + waist, y - waist, x + arm, y);
        // Right tip (arm, 0) -> Bottom tip (0, arm)
        c.quadraticCurveTo(x + waist, y + waist, x, y + arm);
        // Bottom tip (0, arm) -> Left tip (-arm, 0)
        c.quadraticCurveTo(x - waist, y + waist, x - arm, y);
        // Left tip (-arm, 0) -> Top tip (0, -arm)
        c.quadraticCurveTo(x - waist, y - waist, x, y - arm);
        c.closePath();
        c.fill();
        c.restore();
    }

    // Draw game screen
    function render() {
        // Clear screen
        ctx.clearRect(0, 0, SCREEN_W, SCREEN_H);

        ctx.save();
        ctx.translate(screenShake.x, screenShake.y);

        // Render combined background (base space + nebula clouds in 1 single texture)
        if (nebulaCanvas) {
            bgCtx.drawImage(nebulaCanvas, 0, 0);
        } else {
            bgCtx.fillStyle = '#000000';
            bgCtx.fillRect(0, 0, bgCanvas.width, bgCanvas.height);
        }

        // Draw background stars
        bgCtx.save();
        bgCtx.translate(screenShake.x * 0.5, screenShake.y * 0.5);
        const scaleY = bgCanvas.height / 900;
        const scaleX = bgCanvas.width / 1600;
        const starScale = scaleY; // height-based scaling for stars size!

        // Twinkle opacity is quantized to 16 levels and stars batched per level, so
        // globalAlpha is set at most 16 times instead of once per star per frame
        for (let l = 0; l < STAR_ALPHA_LEVELS; l++) starBucketCounts[l] = 0;
        const diamondIndices = [];

        for (let i = 0; i < stars.length; i++) {
            const s = stars[i];
            const distFromCenter = Math.hypot(s.x - 800, s.y - 450);
            // Smoothly ramp alpha: zero in the core dead-zone, reaching full alpha as stars spread towards edges
            const distMultiplier = Math.min(1.0, Math.max(0, (distFromCenter - 210) / 260));
            const effectiveOpacity = s.opacity * distMultiplier;
            s.currentEffectiveOpacity = effectiveOpacity;

            if (s.isDiamond) {
                if (effectiveOpacity > 0.05) {
                    diamondIndices.push(i);
                }
            } else {
                const level = Math.min(STAR_ALPHA_LEVELS - 1, Math.max(0, (effectiveOpacity * STAR_ALPHA_LEVELS) | 0));
                starBuckets[level][starBucketCounts[level]++] = i;
            }
        }

        // Draw regular dot stars (quantized alpha buckets for high performance)
        for (let l = 0; l < STAR_ALPHA_LEVELS; l++) {
            const count = starBucketCounts[l];
            if (!count) continue;
            bgCtx.globalAlpha = (l + 0.5) / STAR_ALPHA_LEVELS;
            for (let k = 0; k < count; k++) {
                const star = stars[starBuckets[l][k]];
                const pxOff = star.size > 2.0 ? (screenShake.x * -0.22) * 0.5 : (screenShake.x * -0.07) * 0.5;
                const pyOff = star.size > 2.0 ? (screenShake.y * -0.22) * 0.5 : (screenShake.y * -0.07) * 0.5;
                const renderX = star.x * scaleX + pxOff;
                const renderY = star.y * scaleY + pyOff;
                const renderSize = star.size * starScale;
                bgCtx.fillStyle = star.color || '#ffffff';
                bgCtx.fillRect(renderX - renderSize / 2, renderY - renderSize / 2, renderSize, renderSize);
            }
        }

        // Draw 4-point diamond sparkle stars
        for (let d = 0; d < diamondIndices.length; d++) {
            const star = stars[diamondIndices[d]];
            const pxOff = (screenShake.x * -0.22) * 0.5;
            const pyOff = (screenShake.y * -0.22) * 0.5;
            const renderX = star.x * scaleX + pxOff;
            const renderY = star.y * scaleY + pyOff;
            const renderSize = star.size * starScale;
            drawDiamondStar(bgCtx, renderX, renderY, renderSize, star.currentEffectiveOpacity, star.color);
        }

        bgCtx.globalAlpha = 1.0;
        bgCtx.restore();

        const planetSize = getPlanetSize();
        const radius = planetSize / 2;

        // Planet atmospheric glow (drawn behind silhouette and core glow, fades with mass)
        if (currentPixelCount > 0 && !victoryTriggered) {
            let glowImg = null;
            if (currentPlanet === 'earth') glowImg = earthGlow;
            else if (currentPlanet === 'mars') glowImg = marsGlow;
            else if (currentPlanet === 'neptune') glowImg = neptuneGlow;
            else if (currentPlanet === 'jupiter') glowImg = jupiterGlow;
            else if (currentPlanet === 'neutron_star') glowImg = neutronStarGlow;

            if (glowImg) {
                const intRatio = Math.min(1, currentPixelCount / Math.max(1, initialPixelCount));
                ctx.save();
                ctx.translate(CENTER_X, CENTER_Y);
                ctx.scale(planetScale, planetScale);
                ctx.globalAlpha = intRatio;
                ctx.drawImage(glowImg, -glowImg.width / 2, -glowImg.height / 2);
                ctx.restore();
            }
        }

        // Draw Glowing Core at center (drawn above atmospheric glow but behind the planet silhouette)
        if (currentPixelCount > 0 && !victoryTriggered && currentCorePixelCount > 0) {
            ctx.save();
            ctx.translate(CENTER_X, CENTER_Y);
            ctx.scale(planetScale, planetScale);
            ctx.rotate(planetRotation);

            const dxLocal = (PLANET_CANVAS_SIZE / 2) - planetCenterX;
            const dyLocal = (PLANET_CANVAS_SIZE / 2) - planetCenterY;
            const coreRatio = initialCorePixelCount > 0 ? ((currentCorePixelCount / initialCorePixelCount) + 0.15) : 1.0;

            let coreImg = null;
            if (currentPlanet === 'sun') {
                coreImg = sunCoreGlow;
            } else if (currentPlanet !== 'neutron_star') {
                coreImg = magmaCoreGlow;
            }

            if (coreImg) {
                const pulse = 0.7 + Math.sin(performance.now() * 0.005) * 0.05;
                ctx.save();
                ctx.translate(dxLocal, dyLocal);
                let scaleFactor = coreRatio * pulse * (planetSize / 240);
                ctx.scale(scaleFactor, scaleFactor);
                ctx.drawImage(coreImg, -coreImg.width / 2, -coreImg.height / 2);
                ctx.restore();
            }

            ctx.restore();
        }

        // Draw active Excalibur swords
        activeSwords.forEach(drawSword);

        // Draw background thick Einstein Rings for active black holes (drawn behind planet)
        activeBlackHoles.forEach(bh => {
            const displaySize = bh.displaySize !== undefined ? bh.displaySize : 0;
            if (displaySize <= 0) return;

            if (bh.time > 3 && bh.time < 6.5) {
                ctx.save();
                ctx.translate(bh.x + (bh.shakeX || 0), bh.y + (bh.shakeY || 0));

                // Use stable size capped at 60 and no wobble to ensure smooth ring contraction
                const stableSize = 60;
                const baseMaxRadius = stableSize * 4.5;
                const minRadius = stableSize * 0.95;

                // Travel half as fast / travel slightly slower (from 0.00176 down to 0.0008)
                const tLarge = bh.time * 0.8;
                const largeMaxRadius = baseMaxRadius * 2.5;
                const thickRingCount = 2;

                ctx.shadowBlur = 12;
                ctx.shadowColor = 'rgba(255, 255, 255, 0.45)';
                for (let r = 0; r < thickRingCount; r++) {
                    const progress = (tLarge + r / thickRingCount + 0.25) % 1.0;

                    // Stop spawning new rings after 5.5s by checking if they wrapped around
                    if (bh.tLargeAt5_5 !== undefined) {
                        const p5_5 = (bh.tLargeAt5_5 + r / thickRingCount + 0.25) % 1.0;
                        if (progress < p5_5) {
                            continue;
                        }
                    }

                    const easedProgress = progress * progress; // quad.easeIn tween
                    const ringRadius = largeMaxRadius - (largeMaxRadius - minRadius) * easedProgress;
                    const alpha = 0.01 + Math.sin(progress * Math.PI) * 0.2;
                    ctx.strokeStyle = `rgba(255, 255, 255, ${alpha})`;
                    ctx.lineWidth = (1.0 + progress * 2.5) * 4.0; // 4 times thicker
                    ctx.beginPath();
                    ctx.arc(0, 0, ringRadius, 0, Math.PI * 2);
                    ctx.stroke();
                }
                ctx.restore();
            }
        });

        // Draw Planet Silhouette
        if (currentPixelCount > 0) {
            ctx.save();
            ctx.translate(CENTER_X, CENTER_Y);
            ctx.scale(planetScale, planetScale);
            ctx.rotate(planetRotation);

            // Draw dynamic pulsing warm solar corona/glow behind the Sun silhouette
            if (currentPlanet === 'sun' && sunCorona) {
                const integrityRatio = initialPixelCount > 0 ? (currentPixelCount / initialPixelCount) : 1.0;
                const pulse = 1.0 + Math.sin(performance.now() * 0.0045) * 0.04;

                ctx.save();
                const glowX = (PLANET_CANVAS_SIZE / 2) - planetCenterX;
                const glowY = (PLANET_CANVAS_SIZE / 2) - planetCenterY;
                ctx.translate(glowX, glowY);
                ctx.scale(integrityRatio * pulse, integrityRatio * pulse);
                ctx.drawImage(sunCorona, -sunCorona.width / 2, -sunCorona.height / 2);
                ctx.restore();
            }

            // Draw from hidden logic canvas offset by its dynamic center of mass
            ctx.drawImage(
                hiddenCanvas,
                -planetCenterX,
                -planetCenterY
            );

            // Draw active stuck bowling balls inside the rotated planet coordinate space!
            activeBowlingBalls.forEach(w => {
                if (w.state === 'stuck') {
                    drawBowlingBall(w, true);
                }
            });

            ctx.restore();
        }

        // Draw active Space Kraken portals & tentacles (higher depth, on top of planet surface)
        activeKrakens.forEach(w => {
            drawKrakenTentacle(w);
            drawKrakenPortal(w);
        });

        // Draw active Fists
        activeFists.forEach(drawFist);

        // Draw active Fist Visual Explosions (drawn in front of the fist)
        activeFistVisualExplosions.forEach(p => {
            ctx.save();
            ctx.globalAlpha = p.life;
            const drawRadius = p.radius * 1.4;


            // 2. Translucent filled orange circle
            ctx.fillStyle = 'rgba(255, 120, 0, 0.45)';
            ctx.beginPath();
            ctx.arc(p.x, p.y, drawRadius * 0.65, 0, Math.PI * 2);
            ctx.fill();

            // 3. Smaller yellow circle in front of the orange circle
            ctx.fillStyle = 'rgba(255, 230, 0, 0.65)';
            ctx.beginPath();
            ctx.arc(p.x, p.y, drawRadius * 0.4, 0, Math.PI * 2);
            ctx.fill();

            ctx.restore();
        });

        // Draw active Stars & Star Projectiles
        activeStarProjectiles.forEach(drawStarProjectile);
        activeStars.forEach(drawStar);

        // Draw active drills
        if (typeof activeDrills !== 'undefined' && typeof drawDrill === 'function') {
            activeDrills.forEach(drill => drawDrill(ctx, drill));
        }

        // Draw active mystery boxes
        activeMysteryBoxes.forEach(box => {
            ctx.save();
            ctx.translate(box.x, box.y);
            ctx.rotate(box.angle);

            // Draw yellow box (or red if flashing_red state)
            let fillColor = '#fdcf35';
            let strokeColor = '#f57f17';
            if (box.state === 'flashing_red' || (box.state && box.state.startsWith('flying_up'))) {
                // Flash red/yellow based on time (e.g. 0.07s intervals)
                const isFlying = box.state.startsWith('flying_up');
                const tValue = isFlying ? performance.now() * 0.001 : box.flashTimer;
                const flashInterval = 0.07;
                const phase = Math.floor(tValue / flashInterval) % 2;
                if (phase === 0) {
                    fillColor = '#f44336'; // vivid red
                    strokeColor = '#b71c1c'; // dark red border
                }
            }

            ctx.fillStyle = fillColor;
            ctx.strokeStyle = strokeColor;
            ctx.lineWidth = 2;
            const size = box.size || 20;
            ctx.fillRect(-size / 2, -size / 2, size, size);
            ctx.strokeRect(-size / 2, -size / 2, size, size);

            // Draw thick "?" symbol in white
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 32px Arial, sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('?', 0, 0);

            ctx.restore();

            // Draw the laser coming out of the spinning mystery box
            if (box.state === 'spinning_lasers') {
                const sharedData = getSharedPlanetData();
                const beamAngle = Math.atan2(CENTER_Y - box.y, CENTER_X - box.x);
                const impact = findLaserImpactWithData(box.x, box.y, sharedData, Math.cos(beamAngle), Math.sin(beamAngle));

                const t3pulse = Math.sin(performance.now() * 0.03) * 0.5 + 0.5;
                const widthMult = 4.0 + t3pulse * 1.0;
                const innerWidthMult = widthMult * 1.25;

                ctx.save();
                // 1. Thick Outer Neon Glow
                ctx.strokeStyle = 'rgba(0, 240, 255, 0.25)';
                ctx.lineWidth = 10 * widthMult;
                ctx.lineCap = 'round';
                ctx.beginPath();
                ctx.moveTo(box.x, box.y);
                ctx.lineTo(impact.x, impact.y);
                ctx.stroke();

                // 2. Vibrant Inner Beam
                ctx.strokeStyle = '#00f0ff';
                ctx.lineWidth = 4 * innerWidthMult;
                ctx.beginPath();
                ctx.moveTo(box.x, box.y);
                ctx.lineTo(impact.x, impact.y);
                ctx.stroke();

                // 3. Bright White Core
                ctx.strokeStyle = '#ffffff';
                ctx.lineWidth = 1.5 * innerWidthMult;
                ctx.beginPath();
                ctx.moveTo(box.x, box.y);
                ctx.lineTo(impact.x, impact.y);
                ctx.stroke();

                ctx.restore();

                // Continuous spark particles spray at impact point (fixed rate, not per-frame)
                box.sparkTimer = (box.sparkTimer || 0) + frameDeltaTime;
                if (!impact.local) box.sparkTimer = 0;
                if (impact.local && box.sparkTimer >= 0.056 / particleBudget) {
                    box.sparkTimer = 0;
                    const pAngle = beamAngle + Math.PI + (Math.random() - 0.5) * 1.5;
                    const speed = Math.random() * 2 + 1;
                    particles.push({
                        x: impact.x,
                        y: impact.y,
                        vx: Math.cos(pAngle) * speed + (Math.random() - 0.5) * 1,
                        vy: Math.sin(pAngle) * speed + (Math.random() - 0.5) * 1,
                        life: 1.0,
                        maxLife: Math.random() * 0.2 + 0.1,
                        size: Math.random() * 3 + 1.5,
                        color: `hsl(${Math.random() * 30 + 175}, 100%, ${Math.random() * 20 + 70}%)`,
                        type: 'fire'
                    });
                }
            }
        });

        // Draw active falling ducks
        if (typeof activeFallingDucks !== 'undefined') {
            activeFallingDucks.forEach(duck => {
                ctx.save();
                ctx.translate(duck.x, duck.y);
                ctx.rotate(duck.angle);

                const baseScale = 1.0;
                ctx.scale(baseScale, baseScale);

                if (spriteDuck) {
                    const w = spriteDuck.width;
                    const h = spriteDuck.height;
                    ctx.drawImage(spriteDuck, -w / 2, -h / 2);

                    if (duck.state === 'flashing_red') {
                        const flashInterval = 0.07;
                        const phase = Math.floor(duck.flashTimer / flashInterval) % 2;
                        if (phase === 0) {
                            ctx.save();
                            ctx.globalCompositeOperation = 'source-atop';
                            ctx.fillStyle = 'rgba(244, 67, 54, 0.65)';
                            ctx.fillRect(-w / 2, -h / 2, w, h);
                            ctx.restore();
                        }
                    }
                } else {
                    ctx.fillStyle = duck.state === 'flashing_red' && (Math.floor(duck.flashTimer / 0.07) % 2 === 0) ? '#f44336' : '#ffeb3b';
                    ctx.beginPath();
                    ctx.arc(0, 0, 15, 0, Math.PI * 2);
                    ctx.fill();
                }

                ctx.restore();

                // Draw anticipation AOE circle right before exploding (last 0.14 seconds)
                if (duck.state === 'flashing_red' && duck.flashTimer <= 0.18) {
                    ctx.save();
                    ctx.beginPath();
                    ctx.arc(duck.x, duck.y, duck.explosionSize, 0, Math.PI * 2);
                    if (duck.flashTimer > 0.09) {
                        // White flash phase
                        ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
                        ctx.fill();
                        ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
                        ctx.lineWidth = 2.5;
                        ctx.stroke();
                    } else {
                        // Black flash phase (subtle dark border)
                        ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
                        ctx.fill();
                        ctx.strokeStyle = 'rgba(0, 0, 0, 0.7)';
                        ctx.lineWidth = 1.5;
                        ctx.stroke();
                    }
                    ctx.restore();
                }
            });
        }

        // Draw flying or penetrating bowling balls in screen space (higher depth)
        activeBowlingBalls.forEach(w => {
            if (w.state !== 'stuck') {
                drawBowlingBall(w, false);
            }
        });

        // Draw active worms
        activeWorms.forEach(worm => {
            // Draw segments from tail to head for proper overlapping
            for (let j = worm.segments.length - 1; j >= 0; j--) {
                const segment = worm.segments[j];
                ctx.save();
                ctx.translate(segment.x, segment.y);

                // Compute orientation angle of the segment
                let segAngle = worm.angle;
                if (j > 0) {
                    segAngle = Math.atan2(worm.segments[j - 1].y - segment.y, worm.segments[j - 1].x - segment.x);
                } else if (worm.segments.length > 1) {
                    segAngle = Math.atan2(segment.y - worm.segments[1].y, segment.x - worm.segments[1].x);
                }
                ctx.rotate(segAngle);

                // Size tapering
                const multipliers = [1.15, 1.25, 1.15, 0.95, 0.75, 0.5];
                const segSize = worm.size * multipliers[j];

                if (j === 0) {
                    // Head: scary sandworm head with glowing throat and ivory teeth
                    // Draw outer head body
                    const headGrad = ctx.createRadialGradient(-segSize * 0.2, 0, 0, 0, 0, segSize);
                    headGrad.addColorStop(0, '#c29770'); // sandy beige
                    headGrad.addColorStop(0.7, '#8f6542'); // tan/brown
                    headGrad.addColorStop(1, '#573a21'); // dark shadow
                    ctx.fillStyle = headGrad;
                    ctx.beginPath();
                    ctx.arc(0, 0, segSize, 0, Math.PI * 2);
                    ctx.fill();

                    // Open mouth circle
                    const mouthX = segSize * 0.2;
                    const mouthRadius = segSize * 0.7;
                    ctx.fillStyle = '#1c0f05';
                    ctx.beginPath();
                    ctx.arc(mouthX, 0, mouthRadius, 0, Math.PI * 2);
                    ctx.fill();

                    // Glowing orange throat
                    const throatGrad = ctx.createRadialGradient(mouthX, 0, 0, mouthX, 0, mouthRadius);
                    throatGrad.addColorStop(0, '#ff4500'); // orange-red
                    throatGrad.addColorStop(0.6, '#ff8c00'); // dark orange
                    throatGrad.addColorStop(1, 'rgba(28, 15, 5, 0)');
                    ctx.fillStyle = throatGrad;
                    ctx.beginPath();
                    ctx.arc(mouthX, 0, mouthRadius, 0, Math.PI * 2);
                    ctx.fill();

                    // Circular rows of teeth
                    ctx.fillStyle = '#fbfbf0'; // ivory
                    const numTeeth = 10;
                    for (let t = 0; t < numTeeth; t++) {
                        const toothAngle = (t * Math.PI * 2) / numTeeth;
                        const tx = mouthX + Math.cos(toothAngle) * (mouthRadius - 2);
                        const ty = Math.sin(toothAngle) * (mouthRadius - 2);

                        ctx.save();
                        ctx.translate(tx, ty);
                        ctx.rotate(toothAngle + Math.PI);
                        ctx.beginPath();
                        ctx.moveTo(0, -3);
                        ctx.lineTo(6, 0);
                        ctx.lineTo(0, 3);
                        ctx.closePath();
                        ctx.fill();
                        ctx.restore();
                    }
                } else {
                    // Body / Tail segments: overlapping armored plates
                    const colors = ['#8f6542', '#9c6f4b', '#a97a54', '#b6855d', '#c29066'];
                    const baseColor = colors[j - 1] || '#8f6542';

                    const segGrad = ctx.createRadialGradient(-segSize * 0.2, 0, 0, 0, 0, segSize);
                    segGrad.addColorStop(0, baseColor);
                    segGrad.addColorStop(0.75, baseColor);
                    segGrad.addColorStop(1, '#3b2411'); // darker edge
                    ctx.fillStyle = segGrad;

                    ctx.beginPath();
                    ctx.arc(0, 0, segSize, 0, Math.PI * 2);
                    ctx.fill();

                    // Segment rib outlines
                    ctx.strokeStyle = '#4e331a';
                    ctx.lineWidth = 2.0;
                    ctx.beginPath();
                    ctx.arc(-segSize * 0.2, 0, segSize * 0.9, -Math.PI / 2, Math.PI / 2);
                    ctx.stroke();

                    // Pointed tail tip on final segment
                    if (j === 5) {
                        ctx.fillStyle = '#573a21';
                        ctx.beginPath();
                        ctx.moveTo(-segSize * 0.1, -segSize);
                        ctx.lineTo(-segSize * 1.5, 0);
                        ctx.lineTo(-segSize * 0.1, segSize);
                        ctx.closePath();
                        ctx.fill();
                    }
                }
                ctx.restore();
            }
        });

        // Draw active black holes
        activeBlackHoles.forEach(bh => {
            const displaySize = bh.displaySize !== undefined ? bh.displaySize : 0;
            if (displaySize <= 0) return;

            ctx.save();
            ctx.translate(bh.x + (bh.shakeX || 0), bh.y + (bh.shakeY || 0));

            // Add a dynamic size wobble/pulsation factor (~5% size variance)
            const wobble = 1.0 + Math.sin(performance.now() * 0.015) * 0.04;
            const size = displaySize * wobble;

            // Tilt angle for the 3D disk and jets
            const tiltAngle = Math.PI / 6; // 30 degrees tilt

            // 1. Relativistic Jets (glowing purple/blue/white cones shooting from poles)
            ctx.save();
            ctx.rotate(tiltAngle);

            const jetLength = size * 6;
            const jetWidth = size * 0.35 * (1 + Math.sin(performance.now() * 0.03) * 0.15);
            ctx.shadowBlur = 30;
            ctx.shadowColor = 'rgba(140, 0, 255, 0.95)';

            // Upper polar jet
            const gradUp = ctx.createLinearGradient(0, 0, 0, -jetLength);
            gradUp.addColorStop(0, 'rgba(255, 255, 255, 0.95)');
            gradUp.addColorStop(0.2, 'rgba(160, 60, 255, 0.8)');
            gradUp.addColorStop(0.5, 'rgba(100, 0, 255, 0.5)');
            gradUp.addColorStop(1, 'rgba(0, 0, 0, 0)');
            ctx.fillStyle = gradUp;
            ctx.beginPath();
            ctx.moveTo(-jetWidth / 2, 0);
            ctx.lineTo(0, -jetLength);
            ctx.lineTo(jetWidth / 2, 0);
            ctx.closePath();
            ctx.fill();

            // Lower polar jet
            const gradDown = ctx.createLinearGradient(0, 0, 0, jetLength);
            gradDown.addColorStop(0, 'rgba(255, 255, 255, 0.95)');
            gradDown.addColorStop(0.2, 'rgba(160, 60, 255, 0.8)');
            gradDown.addColorStop(0.5, 'rgba(100, 0, 255, 0.5)');
            gradDown.addColorStop(1, 'rgba(0, 0, 0, 0)');
            ctx.fillStyle = gradDown;
            ctx.beginPath();
            ctx.moveTo(-jetWidth / 2, 0);
            ctx.lineTo(0, jetLength);
            ctx.lineTo(jetWidth / 2, 0);
            ctx.closePath();
            ctx.fill();

            ctx.restore();

            // 2. Outer gravitational lensing glow (soft purple/blue)
            const lensGrad = ctx.createRadialGradient(0, 0, size * 0.8, 0, 0, size * 2.8);
            const lensAlpha = 0.45 + Math.sin(performance.now() * 0.008) * 0.1;
            lensGrad.addColorStop(0, `rgba(120, 0, 200, ${lensAlpha})`);
            lensGrad.addColorStop(0.4, `rgba(60, 0, 140, ${lensAlpha * 0.45})`);
            lensGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
            ctx.fillStyle = lensGrad;
            ctx.beginPath();
            ctx.arc(0, 0, size * 2.8, 0, Math.PI * 2);
            ctx.fill();

            // 3. Background Einstein Rings / gravitational lensing rings
            const ringCount = 3;
            const baseMaxRadius = size * 4.5;
            const minRadius = size * 0.95;
            const t = performance.now() * 0.00175; // 12% less frequent
            ctx.save();
            ctx.shadowBlur = 12;
            ctx.shadowColor = 'rgba(255, 255, 255, 0.45)';

            // Standard rings
            for (let r = 0; r < ringCount; r++) {
                const progress = (t + r / ringCount) % 1.0;
                const ringRadius = baseMaxRadius - (baseMaxRadius - minRadius) * progress;
                const alpha = Math.sin(progress * Math.PI) * 0.22;
                ctx.strokeStyle = `rgba(255, 255, 255, ${alpha})`;
                ctx.lineWidth = 1.0 + progress * 2.5;
                ctx.beginPath();
                ctx.arc(0, 0, ringRadius, 0, Math.PI * 2);
                ctx.stroke();
            }
            ctx.restore();

            // 4. Accretion Disk, back half (pre-rendered; drawn behind the event
            // horizon so the sphere occludes the far side of the ring. Halo sprites
            // bake glow + stroke, matching the original single-stroke brightness)
            const diskSprites = getAccretionDiskSprites();
            const diskScale = size / 75;
            const diskHalf = diskSprites.backHalo.width / 2;
            const diskGlowAlpha = 0.8 + Math.sin(performance.now() * 0.01) * 0.2;
            // One swirl phase for the whole frame, as the original's single angleOffset
            const diskSwirl = performance.now() * 0.0035;
            const drawDiskSprite = (sprite, alpha) => {
                ctx.globalAlpha = alpha;
                ctx.drawImage(sprite, -diskHalf * diskScale, -diskHalf * diskScale, diskHalf * 2 * diskScale, diskHalf * 2 * diskScale);
            };
            ctx.save();
            ctx.rotate(tiltAngle);
            // Rings are baked pre-squished, so they blit under the tilt alone; the
            // squish only wraps the bands, whose swirl must rotate inside it.
            drawDiskSprite(diskSprites.backHalo, diskGlowAlpha);
            ctx.scale(1.0, DISK_SQUISH);
            ctx.rotate(diskSwirl); // swirl phase (bands only)
            drawDiskSprite(diskSprites.backBands, 1);
            ctx.restore();

            // 5. Event Horizon (black core)
            ctx.save();
            ctx.shadowBlur = 0;
            ctx.fillStyle = '#000000';
            ctx.beginPath();
            ctx.arc(0, 0, size, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();

            // 6. Accretion Disk, front half + swirling bands (pre-rendered; drawn
            // over the sphere to warp around it. The bands rotate via draw-time
            // swirl; the upper-arc halves stay fixed to the disk orientation)
            ctx.save();
            ctx.rotate(tiltAngle);
            drawDiskSprite(diskSprites.frontHalo, diskGlowAlpha);
            ctx.scale(1.0, DISK_SQUISH);
            ctx.rotate(diskSwirl); // swirl phase (bands only)
            drawDiskSprite(diskSprites.frontBands, 1);
            ctx.restore();

            // 7. Swirling Sparks/Debris Ring (orbiting matter)
            ctx.save();
            ctx.rotate(tiltAngle);
            ctx.scale(1.0, 0.32);
            const sparkCount = 18;
            for (let s = 0; s < sparkCount; s++) {
                const speedScale = 0.003 + (s % 3) * 0.0015;
                const radiusScale = 1.15 + (s % 4) * 0.25;
                const angle = performance.now() * speedScale + (s * Math.PI * 2) / sparkCount;
                const sparkX = Math.cos(angle) * size * radiusScale;
                const sparkY = Math.sin(angle) * size * radiusScale;

                ctx.fillStyle = s % 2 === 0 ? '#fffae0' : '#ffa54f';
                ctx.shadowBlur = 10;
                ctx.shadowColor = ctx.fillStyle;
                ctx.beginPath();
                ctx.arc(sparkX, sparkY, size * 0.05, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.restore();

            ctx.restore();

            // Draw visual chunks flying towards the black hole
            bh.chunks.forEach(chunk => {
                ctx.save();
                ctx.globalAlpha = chunk.alpha !== undefined ? chunk.alpha : 1.0;
                if (currentPlanet === 'sun') {
                    ctx.shadowBlur = 8;
                    ctx.shadowColor = '#ff4500';
                    ctx.fillStyle = '#ff8c00';
                } else {
                    ctx.fillStyle = chunk.color;
                }
                ctx.beginPath();
                ctx.arc(chunk.x, chunk.y, chunk.size, 0, Math.PI * 2);
                ctx.fill();
                ctx.restore();
            });
        });

        // Draw faint spawn orbit ring when hovering (hidden)
        /*
        if (!victoryTriggered && mode === 'play') {
            const orbitRadius = getConfigValue('gameplay.spawnDistance', 300) + 10;
            ctx.save();
            ctx.globalAlpha = 0.2;
            ctx.strokeStyle = '#ffd200';
            ctx.lineWidth = 1;
            ctx.setLineDash([5, 10]);
            ctx.beginPath();
            ctx.arc(CENTER_X, CENTER_Y, orbitRadius, 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();
        }
        */

        // Draw Glowing Spawn Indicator Triangle (hollow, pointing inward, offset further back)
        if (showPointer && !victoryTriggered && mode === 'play') {
            const angle = Math.atan2(pointerY - CENTER_Y, pointerX - CENTER_X);
            const spawnRadius = getConfigValue('gameplay.spawnDistance', 300);
            // Shift the indicator 35px further back from the actual weapon spawn orbit (which is spawnRadius + 10)
            // We keep it at spawnRadius + 35 relative to the original base to keep it at same screen location
            const indicatorRadius = spawnRadius + 35;
            const indX = CENTER_X + Math.cos(angle) * indicatorRadius;
            const indY = CENTER_Y + Math.sin(angle) * indicatorRadius;

            ctx.save();
            ctx.translate(indX, indY);
            ctx.rotate(angle + Math.PI); // Rotate to point inward

            // Draw sleek hollow yellow triangle pointing right (inward)
            ctx.strokeStyle = '#ffd200';
            ctx.lineWidth = 3;

            ctx.beginPath();
            ctx.moveTo(-12, -8); // Back top
            ctx.lineTo(8, 0);    // Tip pointing inward
            ctx.lineTo(-12, 8);  // Back bottom
            ctx.closePath();
            ctx.stroke();

            ctx.restore();
        }

        // Draw moon exhaust particles behind weapons using the static pool
        const originalAlpha = ctx.globalAlpha;
        for (let i = 0; i < particles.pool.length; i++) {
            const p = particles.pool[i];
            if (!p.active || !p.moonExhaust) continue;
            ctx.globalAlpha = p.life * 0.7;
            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = originalAlpha;

        // Draw weapons
        weapons.forEach(drawWeaponProjectile);

        // Draw active lightnings
        activeLightnings.forEach(lightning => {
            const alpha = lightning.life / lightning.maxLife;
            ctx.save();
            ctx.strokeStyle = `rgba(255, 255, 255, ${alpha})`;
            ctx.lineWidth = 4.5;
            ctx.shadowBlur = 18;
            ctx.shadowColor = 'rgba(0, 191, 255, 0.9)'; // deep sky blue glow
            ctx.beginPath();
            ctx.moveTo(lightning.segments[0].x, lightning.segments[0].y);
            for (let i = 1; i < lightning.segments.length; i++) {
                ctx.lineTo(lightning.segments[i].x, lightning.segments[i].y);
            }
            ctx.stroke();

            // Inner core
            ctx.strokeStyle = `rgba(255, 255, 255, ${alpha * 0.95})`;
            ctx.lineWidth = 1.8;
            ctx.shadowBlur = 0;
            ctx.beginPath();
            ctx.moveTo(lightning.segments[0].x, lightning.segments[0].y);
            for (let i = 1; i < lightning.segments.length; i++) {
                ctx.lineTo(lightning.segments[i].x, lightning.segments[i].y);
            }
            ctx.stroke();
            ctx.restore();
        });

        // Draw Lightning Charge Meter
        if (isHolding && selectedWeapon === 'lightning' && !victoryTriggered && mode === 'play' && lightningCooldown <= 0) {
            const isMax = lightningHoldTime >= 2.10;
            const width = isMobile ? 160 : 80;
            const height = isMobile ? 16 : 8;

            let meterX = pointerX;
            let meterY = pointerY - (isMobile ? 75 : 25);
            if (isMax || lightningChargeShakeTimer > 0) {
                const shakeAmt = isMax ? 4 : 3;
                meterX += (Math.random() - 0.5) * (isMobile ? shakeAmt * 2 : shakeAmt);
                meterY += (Math.random() - 0.5) * (isMobile ? shakeAmt * 2 : shakeAmt);
            }

            const x = meterX - width / 2;
            const y = meterY;

            ctx.save();
            ctx.fillStyle = 'rgba(15, 15, 15, 0.6)';
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
            ctx.lineWidth = isMobile ? 3.0 : 1.5;
            ctx.beginPath();
            ctx.rect(x, y, width, height);
            ctx.fill();
            ctx.stroke();

            const pct = Math.min(1.0, lightningHoldTime / 2.10);
            if (pct > 0) {
                if (isMax || lightningChargeFlashTimer > 0) {
                    ctx.fillStyle = '#ffffff';
                    ctx.shadowBlur = isMobile ? 30 : 15;
                    ctx.shadowColor = '#ffffff';
                } else {
                    ctx.fillStyle = '#ffd200';
                    ctx.shadowBlur = isMobile ? 16 : 8;
                    ctx.shadowColor = 'rgba(255, 210, 0, 0.6)';
                }
                ctx.beginPath();
                const inset = isMobile ? 3 : 1.5;
                ctx.rect(x + inset, y + inset, (width - inset * 2) * pct, height - inset * 2);
                ctx.fill();
            }

            ctx.strokeStyle = 'rgba(0, 0, 0, 0.5)';
            ctx.lineWidth = isMobile ? 2 : 1;
            ctx.shadowBlur = 0;
            for (let i = 1; i < 7; i++) {
                const tx = x + (width / 7) * i;
                ctx.beginPath();
                const inset = isMobile ? 3 : 1.5;
                ctx.moveTo(tx, y + inset);
                ctx.lineTo(tx, y + height - inset);
                ctx.stroke();
            }

            ctx.restore();
        }

        // Draw black flash if active (above planet, below laser beam)
        if (screenFlash.alpha > 0 && screenFlash.r === 0 && screenFlash.g === 0 && screenFlash.b === 0) {
            ctx.save();
            ctx.setTransform(1, 0, 0, 1, 0, 0);
            ctx.fillStyle = `rgba(${screenFlash.r}, ${screenFlash.g}, ${screenFlash.b}, ${screenFlash.alpha})`;
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.restore();
        }

        // Draw continuous laser beam
        if (isHolding && selectedWeapon === 'laser' && !victoryTriggered && mode === 'play') {
            const angle = Math.atan2(pointerY - CENTER_Y, pointerX - CENTER_X);
            const spawnRadius = getConfigValue('gameplay.spawnDistance', 300);
            const spawnX = CENTER_X + Math.cos(angle) * spawnRadius;
            const spawnY = CENTER_Y + Math.sin(angle) * spawnRadius;

            const impact = lastLaserImpact || findLaserImpact(spawnX, spawnY);

            // Calculate width multiplier based on enhanced state
            let widthMult = 1.0;
            let laserColorOverride = null;
            if (laserFlicker2Time > 0) {
                // Unstable flicker before tier 3
                const flickerPhase = Math.floor(laserFlicker2Time * 40) % 2 === 0;
                widthMult = flickerPhase ? 6.4 : 1.5;
                laserColorOverride = flickerPhase ? 'white' : null;
            } else if (laserFlickerTime > 0) {
                // Unstable flicker before tier 2
                const flickerPhase = Math.floor(laserFlickerTime * 40) % 2 === 0;
                widthMult = flickerPhase ? 3.8 : 0.5;
                laserColorOverride = flickerPhase ? 'white' : null;
            } else if (laserTier3) {
                const t3pulse = Math.sin(performance.now() * 0.03) * 0.5 + 0.5;
                widthMult = 4.0 + t3pulse * 1.0;
            } else if (laserEnhanced) {
                const pulse = Math.sin(performance.now() * 0.012) * 0.5 + 0.5;
                widthMult = 2.5 + pulse * 0.5;
            }

            // Draw the multi-layered glowing laser beam
            ctx.save();

            // Dim tier 3 laser to 50% alpha every 6th pulse
            if (laserTier3 && laserPulseCount > 0 && Math.floor(laserPulseCount / 1) % 4 === 0) {
                ctx.globalAlpha = 0.5;
            }

            // For tier 3: main beam and core are 25% bigger; outer aura stays the same size
            const innerWidthMult = (laserTier3 && !laserColorOverride) ? widthMult * 1.25 : widthMult;

            // 1. Thick Outer Neon Glow (same size regardless of tier)
            ctx.strokeStyle = laserColorOverride ? 'rgba(255, 255, 255, 0.35)' : 'rgba(0, 240, 255, 0.25)';
            ctx.lineWidth = 10 * widthMult;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(spawnX, spawnY);
            ctx.lineTo(impact.x, impact.y);
            ctx.stroke();

            // 2. Vibrant Inner Beam (25% bigger at tier 3)
            ctx.strokeStyle = laserColorOverride ? '#ffffff' : '#00f0ff';
            ctx.lineWidth = 4 * innerWidthMult;
            ctx.beginPath();
            ctx.moveTo(spawnX, spawnY);
            ctx.lineTo(impact.x, impact.y);
            ctx.stroke();

            // 3. Bright White Core (25% bigger at tier 3)
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 1.5 * innerWidthMult;
            ctx.beginPath();
            ctx.moveTo(spawnX, spawnY);
            ctx.lineTo(impact.x, impact.y);
            ctx.stroke();

            ctx.restore();

            // Continuous spark particles spray at impact point
            if (impact.local) {
                const sparkCount = Math.random() < 0.5 ? 1 : 2; // Average of 1.5 sparks (half of 3)
                for (let k = 0; k < sparkCount; k++) {
                    const pAngle = angle + Math.PI + (Math.random() - 0.5) * 1.5; // reflect spark outwards
                    const speed = Math.random() * 2 + 1; // Slower speed (half of [2, 6] range)
                    particles.push({
                        x: impact.x,
                        y: impact.y,
                        vx: Math.cos(pAngle) * speed + (Math.random() - 0.5) * 1, // smaller offset
                        vy: Math.sin(pAngle) * speed + (Math.random() - 0.5) * 1,
                        life: 1.0,
                        maxLife: Math.random() * 0.2 + 0.1, // Shorter life so they fly not as far
                        size: Math.random() * 3 + 1.5,
                        color: `hsl(${Math.random() * 30 + 175}, 100%, ${Math.random() * 20 + 70}%)`, // electric cyan sparks
                        type: 'fire'
                    });
                }
            }
        }

        // Draw Active Gamma Bursts (Warnings and Beams)
        activeGammaBursts.forEach(gb => {
            const spawnRadius = getConfigValue('gameplay.spawnDistance', 300);
            const spawnX = CENTER_X + Math.cos(gb.angle) * spawnRadius;
            const spawnY = CENTER_Y + Math.sin(gb.angle) * spawnRadius;

            if (!gb.active) {
                // Smoothly fading yellow warning symbol (fast pulsing)
                const pulseAlpha = Math.abs(Math.sin(performance.now() * 0.015));

                // Dotted yellow guide line
                ctx.save();
                ctx.globalAlpha = pulseAlpha * 0.75;
                ctx.strokeStyle = '#ffd200';
                ctx.lineWidth = 2;
                ctx.setLineDash([8, 6]);
                ctx.beginPath();
                ctx.moveTo(spawnX, spawnY);
                ctx.lineTo(CENTER_X, CENTER_Y);
                ctx.stroke();
                ctx.restore();

                // Warning indicator arrow/triangle at orbital spawn point
                ctx.save();
                ctx.translate(spawnX, spawnY);
                ctx.rotate(gb.angle + Math.PI); // Point towards Earth center
                ctx.globalAlpha = pulseAlpha;

                // Sleek yellow warning triangle (pulsing fade in/out)
                ctx.fillStyle = '#ffd200';
                ctx.strokeStyle = '#000000';
                ctx.lineWidth = 1.5;
                ctx.beginPath();
                ctx.moveTo(-15, -12);
                ctx.lineTo(15, 0);
                ctx.lineTo(-15, 12);
                ctx.closePath();
                ctx.fill();
                ctx.stroke();

                ctx.restore();
            } else {
                // Beam is active: render two thick lasers (dimmer outer, brighter inner) that completely pierce Earth
                const impact = findLaserImpact(spawnX, spawnY);

                // Opacity of the beam (fade out during shrinking/normal operation)
                const beamOpacity = gb.shrinking
                    ? Math.max(0.0, gb.shrinkTimer / gb.shrinkDuration)
                    : Math.min(1.0, gb.beamTime * 2);

                // Dimensions:
                // Inner laser matches damage area (242px wide).
                // Outer laser is slightly larger (300px wide).
                let outerWidth = 300;
                let innerWidth = 242;

                if (gb.shrinking) {
                    const shrinkRatio = Math.max(0.0, gb.shrinkTimer / gb.shrinkDuration);
                    outerWidth = 300 * shrinkRatio;
                    innerWidth = 242 * shrinkRatio;
                }

                // Coordinates: Completely pierce the Earth
                const endX = spawnX + Math.cos(gb.angle + Math.PI) * 1200;
                const endY = spawnY + Math.sin(gb.angle + Math.PI) * 1200;

                ctx.save();

                // Flicker: combine two fast sine waves for an irregular crackle effect
                const _t = performance.now();
                const _flickerAlpha = gb.active && !gb.shrinking
                    ? 0.8 + 0.2 * (0.6 * Math.sin(_t * 0.047) + 0.4 * Math.sin(_t * 0.031))
                    : 1.0;
                // Width variation is much subtler — beam barely breathes
                const _flickerWidth = gb.active && !gb.shrinking
                    ? 0.97 + 0.03 * (0.6 * Math.sin(_t * 0.047) + 0.4 * Math.sin(_t * 0.031))
                    : 1.0;

                // 1. Dimmer Outer Laser (dim orange-red, width: outerWidth)
                ctx.strokeStyle = `rgba(255, 60, 0, ${0.28 * beamOpacity * _flickerAlpha})`;
                ctx.lineWidth = outerWidth * _flickerWidth;
                ctx.lineCap = 'round';
                ctx.beginPath();
                ctx.moveTo(spawnX, spawnY);
                ctx.lineTo(endX, endY);
                ctx.stroke();

                // 2. Brighter Inner Laser (bright yellow-white glow, width: innerWidth) — flickers in opacity, subtle width
                ctx.strokeStyle = `rgba(255, 230, 0, ${0.9 * beamOpacity * _flickerAlpha})`;
                ctx.lineWidth = innerWidth * _flickerWidth;
                ctx.beginPath();
                ctx.moveTo(spawnX, spawnY);
                ctx.lineTo(endX, endY);
                ctx.stroke();

                ctx.restore();

                // Continuous golden spark shower spray at impact zone spread across 240px width (active damage phase only)
                if (impact.local && !gb.shrinking) {
                    const perpAngle = gb.angle + Math.PI / 2;
                    const sparkCount = 4;
                    for (let k = 0; k < sparkCount; k++) {
                        const offsetDist = (Math.random() - 0.5) * 240;
                        const sX = impact.x + Math.cos(perpAngle) * offsetDist;
                        const sY = impact.y + Math.sin(perpAngle) * offsetDist;

                        const pAngle = gb.angle + Math.PI + (Math.random() - 0.5) * 1.5; // Reflect outwards
                        const speed = Math.random() * 5 + 3;
                        particles.push({
                            x: sX,
                            y: sY,
                            vx: Math.cos(pAngle) * speed,
                            vy: Math.sin(pAngle) * speed,
                            life: 1.0,
                            maxLife: Math.random() * 0.4 + 0.2,
                            size: Math.random() * 4 + 2,
                            color: `hsl(${Math.random() * 20 + 25}, 100%, 50%)`, // Golden sparks
                            type: 'fire'
                        });
                    }
                }
            }
        });

        // Draw shockwaves (User feature 7)
        shockwaves.forEach(sw => {
            ctx.save();
            ctx.strokeStyle = `rgba(255, 255, 255, ${sw.life * 0.4})`;
            ctx.lineWidth = 2 + sw.life * 4;
            ctx.beginPath();
            if (sw.isOval) {
                ctx.ellipse(sw.x, sw.y, sw.radius * 0.25, sw.radius, sw.angle, 0, Math.PI * 2);
            } else {
                ctx.arc(sw.x, sw.y, sw.radius, 0, Math.PI * 2);
            }
            ctx.stroke();
            // Optional: inner faint ring
            ctx.strokeStyle = `rgba(0, 217, 255, ${sw.life * 0.2})`;
            ctx.lineWidth = 1;
            ctx.beginPath();
            if (sw.isOval) {
                ctx.ellipse(sw.x, sw.y, sw.radius * 0.85 * 0.25, sw.radius * 0.85, sw.angle, 0, Math.PI * 2);
            } else {
                ctx.arc(sw.x, sw.y, sw.radius * 0.85, 0, Math.PI * 2);
            }
            ctx.stroke();
            ctx.restore();
        });

        // Draw holy rays
        holyRays.forEach(hr => {
            ctx.save();
            ctx.translate(hr.x, hr.y);
            ctx.rotate(hr.rotation);
            const alpha = hr.timer / hr.maxTime;

            for (let i = 0; i < hr.rayCount; i++) {
                ctx.save();
                ctx.rotate((i / hr.rayCount) * Math.PI * 2);

                const grad = ctx.createLinearGradient(0, 0, 0, hr.rayLength);
                grad.addColorStop(0, `rgba(255, 255, 200, ${alpha * 0.8})`);
                grad.addColorStop(0.5, `rgba(255, 255, 100, ${alpha * 0.4})`);
                grad.addColorStop(1, 'rgba(255, 255, 255, 0)');

                ctx.fillStyle = grad;
                ctx.beginPath();
                ctx.moveTo(-hr.rayWidth / 2, 0);
                ctx.lineTo(hr.rayWidth / 2, 0);
                ctx.lineTo(0, hr.rayLength);
                ctx.closePath();
                ctx.fill();
                ctx.restore();
            }
            ctx.restore();
        });

        // Draw fire and smoke particles using the static pool and cached gradients
        const originalMainAlpha = ctx.globalAlpha;
        for (let i = 0; i < particles.pool.length; i++) {
            const p = particles.pool[i];
            if (!p.active || p.moonExhaust) continue;
            ctx.globalAlpha = p.life;

            if (p.type === 'fire' || p.type === 'explosion_ring') {
                const drawSize = p.size * 2;
                if (p.isComet) {
                    ctx.beginPath();
                    const grad = ctx.createRadialGradient(p.x, p.y, p.size * 0.7, p.x, p.y, p.size);
                    grad.addColorStop(0, 'rgba(255, 255, 255, 0)');
                    grad.addColorStop(0.5, p.color);
                    grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
                    ctx.strokeStyle = grad;
                    ctx.lineWidth = 12;
                    ctx.arc(p.x, p.y, p.size * 0.85, 0, Math.PI * 2);
                    ctx.stroke();
                } else {
                    let img = p.sprite;

                    if (img) {
                        ctx.drawImage(img, p.x - p.size, p.y - p.size, drawSize, drawSize);
                    } else {
                        ctx.beginPath();
                        ctx.fillStyle = p.color || '#ff7800';
                        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
                        ctx.fill();
                    }
                }
            } else if (p.type === 'circular_flash') {
                const gradCanvas = getGradientCanvas(p.color);
                const currentSize = p.size * (1 + (1 - p.life) * 0.35);
                ctx.drawImage(
                    gradCanvas,
                    p.x - currentSize,
                    p.y - currentSize,
                    currentSize * 2,
                    currentSize * 2
                );
            } else { // smoke
                const isMissile = p.color && p.color.includes('180, 190, 200');
                const img = isMissile ? spriteSmokeMissile : spriteSmokeStandard;
                if (img) {
                    const factor = isMissile ? 1.0 : 1.4;
                    const drawSize = p.size * 2 * factor;
                    ctx.globalAlpha = p.life * (isMissile ? 0.58 : 0.42);
                    ctx.drawImage(img, p.x - p.size * factor, p.y - p.size * factor, drawSize, drawSize);
                } else {
                    ctx.beginPath();
                    ctx.fillStyle = isMissile ? 'rgba(180, 190, 200, 0.5)' : 'rgba(80, 75, 85, 0.32)';
                    const factor = isMissile ? 1.0 : 1.4;
                    ctx.arc(p.x, p.y, p.size * factor, 0, Math.PI * 2);
                    ctx.fill();
                }
            }
        }
        ctx.globalAlpha = originalMainAlpha;

        // Draw floating texts (above planet and weapons)
        floatingTexts.forEach(ft => {
            const elapsed = ft.maxLife - ft.life;
            const floatDuration = Math.min(0.25, ft.maxLife * 0.5);
            const fadeDuration = ft.maxLife - floatDuration;
            const maxOffset = ft.maxOffset !== undefined ? ft.maxOffset : 50;

            let yOffset = 0;
            let alpha = 1;

            if (elapsed < floatDuration) {
                const t = elapsed / floatDuration;
                // Quart.easeOut: 1 - (1-t)^4
                const ease = 1 - Math.pow(1 - t, 4);
                yOffset = ease * -maxOffset;
            } else {
                yOffset = -maxOffset;
                const tFade = Math.min(1.0, Math.max(0.0, (elapsed - floatDuration) / fadeDuration));
                alpha = 1 - tFade;
            }

            ctx.save();
            ctx.font = `bold ${ft.fontSize || 28}px Orbitron, sans-serif`;
            ctx.fillStyle = ft.color.endsWith(',') ? `${ft.color}${alpha})` : ft.color;
            ctx.textAlign = 'center';
            ctx.shadowBlur = 10;
            ctx.shadowColor = ft.color.endsWith(',') ? `${ft.color}0.5)` : ft.color;
            ctx.strokeStyle = `rgba(0, 0, 0, ${alpha})`;
            ctx.lineWidth = ft.strokeWidth !== undefined ? ft.strokeWidth : 4.5;
            ctx.strokeText(ft.text, ft.x, ft.startY + yOffset);
            ctx.fillText(ft.text, ft.x, ft.startY + yOffset);
            ctx.restore();
        });

        if (window.ShootingStarManager) {
            window.ShootingStarManager.draw(ctx);
        }

        // Screen flash overlay (covers full screen including UI / letterboxing)
        const flashOverlay = _dom.flashOverlay;
        if (flashOverlay) {
            if (screenFlash.alpha > 0) {
                if (flashOverlay.style.display !== 'block') {
                    flashOverlay.style.display = 'block';
                }
                flashOverlay.style.backgroundColor = `rgb(${screenFlash.r}, ${screenFlash.g}, ${screenFlash.b})`;
                flashOverlay.style.opacity = screenFlash.alpha;
            } else {
                if (flashOverlay.style.display !== 'none') {
                    flashOverlay.style.opacity = 0;
                    flashOverlay.style.display = 'none';
                }
            }
        }

        ctx.restore(); // Revert screen shake translation
    }

    let bgmStarted = false;
    let bgmPendingLoad = false;
    function startBGM() {
        if (bgmStarted) return;
        soundManager.init().then(() => {
            // play() returns null when the buffer hasn't decoded yet. Latching
            // unconditionally would leave the player with no music for the rest
            // of the session, so only latch on an actual start and kick a
            // (re)load so the next interaction can succeed.
            const source = soundManager.play('bgm_gentle_space', true, 0.45);
            if (source) {
                bgmStarted = true;
            } else if (!bgmPendingLoad) {
                bgmPendingLoad = true;
                soundManager.load('bgm_gentle_space').then(() => {
                    bgmPendingLoad = false;
                    if (!bgmStarted && soundManager.play('bgm_gentle_space', true, 0.45)) {
                        bgmStarted = true;
                    }
                });
            }
        });
    }

    const triggerFirstClickGameplayStart = () => {
        startBGM();
        if (!gameplayStarted) {
            gameplayStarted = true;
            if (window.PlatformBridge && typeof window.PlatformBridge.gameplayStart === 'function') {
                window.PlatformBridge.gameplayStart();
            }
        }
        window.removeEventListener('mousedown', triggerFirstClickGameplayStart, true);
        window.removeEventListener('touchstart', triggerFirstClickGameplayStart, true);
    };
    window.addEventListener('mousedown', triggerFirstClickGameplayStart, true);
    window.addEventListener('touchstart', triggerFirstClickGameplayStart, true);

    // Prevent context menu from popping up on the page (CrazyGames common fixes)
    document.addEventListener('contextmenu', (e) => e.preventDefault());

    // Prevent unwanted page scroll via mouse wheel and scroll through weapons if playing (CrazyGames common fixes)
    window.addEventListener('wheel', (e) => {
        e.preventDefault();
        if (window.gamePausedForAd) return;
        if (typeof mode !== 'undefined' && mode === 'play' && typeof victoryTriggered !== 'undefined' && !victoryTriggered) {
            const buttons = Array.from(document.querySelectorAll('.weapon-button'));
            if (buttons.length > 0) {
                const currentIndex = buttons.findIndex(btn => btn.classList.contains('selected'));
                let nextIndex = currentIndex;
                if (e.deltaY < 0) {
                    // Scroll up: previous weapon
                    nextIndex = (currentIndex - 1 + buttons.length) % buttons.length;
                } else if (e.deltaY > 0) {
                    // Scroll down: next weapon
                    nextIndex = (currentIndex + 1) % buttons.length;
                }
                if (nextIndex !== currentIndex && nextIndex >= 0 && nextIndex < buttons.length) {
                    buttons[nextIndex].click();
                }
            }
        }
    }, { passive: false });

    // Input landing on the HUD belongs to the HUD, not the planet: no weapon
    // spawn, and (on the legacy touch path) no preventDefault, or the scrollable
    // weapon list can't be panned.
    function isUiInputTarget(target) {
        if (!target || typeof target.closest !== 'function') return false;
        return !!(target.closest('.weapon-button') || target.closest('.planet-btn') ||
            target.closest('.options-toggle-wrapper') || target.closest('.options-hitbox') ||
            target.closest('.options-popup-overlay') || target.closest('.weapon-bar-wrapper') ||
            target.closest('.victory-screen') || target.closest('.loading-screen'));
    }

    // #27 — Pointer Events with Touch Event Fallback for iOS < 13
    if (window.PointerEvent) {
        gameWorld.addEventListener('pointerdown', (e) => {
            if (window.gamePausedForAd) return;
            if (isUiInputTarget(e.target)) {
                return;
            }
            if (canvas) canvas.focus();
            startBGM();
            if (!gameplayStarted) {
                gameplayStarted = true;
                if (window.PlatformBridge) {
                    window.PlatformBridge.gameplayStart();
                }
            }
            const rect = canvas.getBoundingClientRect();
            const scaleX = rect.width / SCREEN_W;
            const scaleY = rect.height / SCREEN_H;
            const x = (e.clientX - rect.left) / scaleX;
            const y = (e.clientY - rect.top) / scaleY;
            pointerX = x;
            pointerY = y;
            showPointer = true;

            if (window.ShootingStarManager && window.ShootingStarManager.checkClick(x, y)) {
                return;
            }

            if (mode === 'play') {
                isHolding = true;
                missileLaunchTimer = 0;
                spawnWeapon(x, y);
            }
        });

        gameWorld.addEventListener('pointermove', (e) => {
            if (window.gamePausedForAd) return;
            const rect = canvas.getBoundingClientRect();
            const scaleX = rect.width / SCREEN_W;
            const scaleY = rect.height / SCREEN_H;
            pointerX = (e.clientX - rect.left) / scaleX;
            pointerY = (e.clientY - rect.top) / scaleY;
            showPointer = true;
        });

        window.addEventListener('pointerup', () => {
            if (window.gamePausedForAd) return;
            isHolding = false;
            soundManager.stopLoop('sfx_laser_fire');
            soundManager.stopLoop('sfx_laser_hum');
            handleLightningRelease();
        });

        window.addEventListener('pointercancel', () => {
            if (window.gamePausedForAd) return;
            isHolding = false;
            handleLightningRelease();
        });
    } else {
        // Touch events fallback ONLY for legacy browsers without PointerEvent (iOS < 13)
        gameWorld.addEventListener('touchstart', (e) => {
            if (window.gamePausedForAd) return;
            if (isUiInputTarget(e.target)) {
                return;
            }
            if (canvas) canvas.focus(); // Focus canvas on touch gesture
            startBGM();
            if (!gameplayStarted) {
                gameplayStarted = true;
                if (window.PlatformBridge) {
                    window.PlatformBridge.gameplayStart();
                }
            }
            const rect = canvas.getBoundingClientRect();
            const scaleX = rect.width / SCREEN_W;
            const scaleY = rect.height / SCREEN_H;

            // Defensive coordinate check for mock touch profiles
            const touch = (e.touches && e.touches.length > 0) ? e.touches[0] : ((e.changedTouches && e.changedTouches.length > 0) ? e.changedTouches[0] : e);
            const clientX = touch.clientX !== undefined ? touch.clientX : 0;
            const clientY = touch.clientY !== undefined ? touch.clientY : 0;

            const x = (clientX - rect.left) / scaleX;
            const y = (clientY - rect.top) / scaleY;
            pointerX = x;
            pointerY = y;
            showPointer = true;

            // Check shooting star click
            if (window.ShootingStarManager && window.ShootingStarManager.checkClick(x, y)) {
                return;
            }

            if (mode === 'play') {
                isHolding = true;
                missileLaunchTimer = 0;
                spawnWeapon(x, y);
            }
        }, { passive: false });

        gameWorld.addEventListener('touchmove', (e) => {
            if (window.gamePausedForAd) return;
            // #2B — do not swallow the move over scrollable HUD overlays (the
            // weapon list lives inside #game-world and must still pan).
            if (isUiInputTarget(e.target)) return;
            e.preventDefault(); // Prevents screen dragging/scrolling on mobile devices
            const rect = canvas.getBoundingClientRect();
            const scaleX = rect.width / SCREEN_W;
            const scaleY = rect.height / SCREEN_H;

            // Defensive coordinate check for mock touch profiles
            const touch = (e.touches && e.touches.length > 0) ? e.touches[0] : ((e.changedTouches && e.changedTouches.length > 0) ? e.changedTouches[0] : e);
            const clientX = touch.clientX !== undefined ? touch.clientX : 0;
            const clientY = touch.clientY !== undefined ? touch.clientY : 0;

            pointerX = (clientX - rect.left) / scaleX;
            pointerY = (clientY - rect.top) / scaleY;
            showPointer = true;
        }, { passive: false });

        window.addEventListener('touchend', () => {
            if (window.gamePausedForAd) return;
            isHolding = false;
            soundManager.stopLoop('sfx_laser_fire');
            soundManager.stopLoop('sfx_laser_hum');
            handleLightningRelease();
        });

        window.addEventListener('touchcancel', () => {
            if (window.gamePausedForAd) return;
            isHolding = false;
            handleLightningRelease();
        });
    }

    function handleLightningRelease() {
        if (selectedWeapon === 'lightning') {
            if (lightningCooldown <= 0) {
                const boltCount = Math.min(7, Math.max(lightningLastChargedCount, Math.floor(lightningHoldTime / 0.3)));
                if (boltCount < 1) {
                    addFloatingText(pointerX, pointerY - 40, getTranslation('holdLonger'), 'rgba(0, 240, 255,', 1.5, 15);
                } else {
                    lightningCooldown = 1.0;
                    for (let i = 0; i < boltCount; i++) {
                        lightningQueue.push({
                            x: pointerX,
                            y: pointerY,
                            delay: i * 0.1,
                            chargeIndex: i + 1,
                            totalCharges: boltCount
                        });
                    }
                }
            }
            lightningHoldTime = 0;
            lightningLastChargedCount = 0;
        }
    }

    window.addEventListener('mouseup', () => {
        if (window.gamePausedForAd) return;
        isHolding = false;
        soundManager.stopLoop('sfx_laser_fire');
        soundManager.stopLoop('sfx_laser_hum');
        handleLightningRelease();
    });

    window.addEventListener('touchend', () => {
        if (window.gamePausedForAd) return;
        isHolding = false;
        soundManager.stopLoop('sfx_laser_fire');
        soundManager.stopLoop('sfx_laser_hum');
        handleLightningRelease();
    });

    window.addEventListener('touchcancel', () => {
        if (window.gamePausedForAd) return;
        isHolding = false;
        handleLightningRelease();
    });

    function handleVisibilityChange() {
        if (document.hidden || !document.hasFocus()) {
            isHolding = false;
            soundManager.stopLoop('sfx_laser_fire');
            soundManager.stopLoop('sfx_laser_hum');
            // #3A — on mobile the tab can be killed from the background without
            // another event, so persist any in-flight save before suspending.
            if (window.flushSaveStateSync) window.flushSaveStateSync();
            if (soundManager && soundManager.context) {
                soundManager.context.suspend().catch(() => { });
            }
        } else {
            if (soundManager && soundManager.context && soundManager.isInitialized) {
                soundManager.context.resume().catch(() => { });
            }
        }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleVisibilityChange);
    window.addEventListener('focus', handleVisibilityChange);
    const handleLifecycleTeardown = () => {
        if (window.flushSaveStateSync) window.flushSaveStateSync();
        if (soundManager && soundManager.context) {
            soundManager.context.suspend().catch(() => { });
        }
    };
    window.addEventListener('beforeunload', handleLifecycleTeardown);
    window.addEventListener('pagehide', handleLifecycleTeardown);

    // Weapon selections panel
    document.querySelectorAll('.weapon-button').forEach(button => {
        button.addEventListener('click', (e) => {
            startBGM();
            e.stopPropagation();
            soundManager.play('sfx_ui_switch');
            soundManager.stopLoop('sfx_laser_fire');
            selectedWeapon = button.dataset.weapon;
            ensureWeaponSoundsLoaded(selectedWeapon);
            // Dismiss switch-weapon tooltip when player switches away from missile
            if (selectedWeapon !== 'missile' && _switchTooltip.el && _switchTooltip.shown) {
                _switchTooltip.dismissed = true;
                _switchTooltip.shown = false;
                _switchTooltip.el.classList.remove('visible');
            }
            // Dismiss new-weapon tooltip if player clicks on any unlocked (but initially locked) weapons
            const initiallyLocked = ['sword', 'kraken', 'worm', 'fist', 'bowling', 'lightning', 'star', 'comet'];
            if (initiallyLocked.includes(selectedWeapon) && isWeaponUnlocked(selectedWeapon)) {
                window.dismissNewWeaponTooltip();
            }
            document.querySelectorAll('.weapon-button').forEach(b => {
                b.classList.remove('selected');
                b.style.animation = '';
            });
            button.classList.add('selected');
            // Subtle select feedback: snap to slightly larger, then Back.easeOut tween back to base over 200ms
            button.style.transition = 'none';
            button.style.transform = 'translateY(-2px) scale(0.88)';
            button.offsetHeight; // force reflow
            button.style.transition = 'transform 280ms cubic-bezier(0.34, 1.56, 0.64, 1)';
            button.style.transform = 'translateY(-2px) scale(1)';
            setTimeout(() => {
                button.style.transition = '';
                button.style.transform = '';
            }, 300);

            // Auto-scroll logic to center the selected weapon card in the panel.
            // Since the weapon bar is now outside the scaled #game-container, scale is 1.
            const scrollWrapper = document.getElementById('weapon-scroll-wrapper');
            const panelInner = document.getElementById('weapon-panel-inner');
            if (scrollWrapper && panelInner) {
                const isHorizontal = window.getComputedStyle(panelInner).flexDirection === 'row';
                const buttonRect = button.getBoundingClientRect();
                const wrapperRect = scrollWrapper.getBoundingClientRect();

                if (isHorizontal) {
                    const buttonCenterRelative = (buttonRect.left + buttonRect.width / 2) - wrapperRect.left;
                    const targetScrollLeft = scrollWrapper.scrollLeft + (buttonCenterRelative - wrapperRect.width / 2);
                    scrollWrapper.scrollTo({
                        left: targetScrollLeft,
                        behavior: 'smooth'
                    });
                } else {
                    const buttonCenterRelative = (buttonRect.top + buttonRect.height / 2) - wrapperRect.top;
                    const targetScrollTop = scrollWrapper.scrollTop + (buttonCenterRelative - wrapperRect.height / 2);
                    scrollWrapper.scrollTo({
                        top: targetScrollTop,
                        behavior: 'smooth'
                    });
                }
            }
        });
    });

    // Scroll HUD weapon bar click handlers
    const scrollLeftBtn = document.getElementById('scroll-left-btn');
    const scrollRightBtn = document.getElementById('scroll-right-btn');
    const scrollWrapper = document.getElementById('weapon-scroll-wrapper');

    if (scrollLeftBtn && scrollWrapper) {
        scrollLeftBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            soundManager.play('sfx_ui_scroll');
            const panelInner = document.getElementById('weapon-panel-inner');
            const isHorizontal = panelInner ? window.getComputedStyle(panelInner).flexDirection === 'row' : false;
            if (isHorizontal) {
                scrollWrapper.scrollBy({ left: -130, behavior: 'smooth' });
            } else {
                scrollWrapper.scrollBy({ top: -130, behavior: 'smooth' });
            }
        });
    }

    if (scrollRightBtn && scrollWrapper) {
        scrollRightBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            soundManager.play('sfx_ui_scroll');
            const panelInner = document.getElementById('weapon-panel-inner');
            const isHorizontal = panelInner ? window.getComputedStyle(panelInner).flexDirection === 'row' : false;
            if (isHorizontal) {
                scrollWrapper.scrollBy({ left: 130, behavior: 'smooth' });
            } else {
                scrollWrapper.scrollBy({ top: 130, behavior: 'smooth' });
            }
        });
    }

    // Scroll buttons limit/grey-out logic
    function updateWeaponScrollButtons() {
        if (!scrollWrapper || !scrollLeftBtn || !scrollRightBtn) return;
        const panelInner = document.getElementById('weapon-panel-inner');
        const isHorizontal = panelInner ? window.getComputedStyle(panelInner).flexDirection === 'row' : false;

        if (isHorizontal) {
            const scrollLeft = scrollWrapper.scrollLeft;
            const scrollWidth = scrollWrapper.scrollWidth;
            const clientWidth = scrollWrapper.clientWidth;

            scrollLeftBtn.disabled = scrollLeft <= 1.5;
            scrollRightBtn.disabled = (scrollLeft + clientWidth) >= (scrollWidth - 1.5);
        } else {
            const scrollTop = scrollWrapper.scrollTop;
            const scrollHeight = scrollWrapper.scrollHeight;
            const clientHeight = scrollWrapper.clientHeight;

            scrollLeftBtn.disabled = scrollTop <= 1.5;
            scrollRightBtn.disabled = (scrollTop + clientHeight) >= (scrollHeight - 1.5);
        }
    }

    if (scrollWrapper) {
        scrollWrapper.addEventListener('scroll', updateWeaponScrollButtons);
        window.addEventListener('resize', updateWeaponScrollButtons);
        window.updateWeaponScrollButtons = updateWeaponScrollButtons;
        updateWeaponScrollButtons();
        setTimeout(updateWeaponScrollButtons, 100);
        setTimeout(updateWeaponScrollButtons, 500);
    }

    // Photo Mode / Cinematic HUD Toggle
    let uiHidden = false;
    let uiNotificationTimeout = null;

    function toggleUI() {
        const uiContainer = document.getElementById('ui-container');
        if (!uiContainer) return;

        uiHidden = !uiHidden;
        if (uiHidden) {
            uiContainer.classList.add('ui-hidden-mode');

            // Remove existing notification if any
            const oldNotif = document.getElementById('ui-hidden-notification');
            if (oldNotif) oldNotif.remove();
            if (uiNotificationTimeout) clearTimeout(uiNotificationTimeout);

            // Create new notification
            const notif = document.createElement('div');
            notif.id = 'ui-hidden-notification';
            notif.textContent = 'UI Hidden with "H"';

            // Append to game-world so it's visible even when ui-container is hidden
            const gameWorld = document.getElementById('game-world') || document.body;
            gameWorld.appendChild(notif);

            // Trigger fade out after a short delay (so transition works)
            requestAnimationFrame(() => {
                // Force reflow
                notif.offsetHeight;
                notif.classList.add('ui-hidden-fade');
            });

            // Remove element after 3 seconds
            uiNotificationTimeout = setTimeout(() => {
                notif.remove();
            }, 3000);
        } else {
            uiContainer.classList.remove('ui-hidden-mode');
            const notif = document.getElementById('ui-hidden-notification');
            if (notif) notif.remove();
            if (uiNotificationTimeout) clearTimeout(uiNotificationTimeout);
        }
    }

    // Keyboard shortcut hooks
    window.addEventListener('keydown', (e) => {
        // Prevent default scrolling behavior on PageUp and PageDown (others are handled downstream)
        if (['PageUp', 'PageDown'].includes(e.key)) {
            e.preventDefault();
        }

        if (window.gamePausedForAd) return;

        // Toggle UI / Photo Mode
        if (e.key === 'h' || e.key === 'H') {
            toggleUI();
            return;
        }

        if (e.key === 'Escape') {
            const optionsOverlay = document.getElementById('options-overlay');
            if (optionsOverlay && optionsOverlay.classList.contains('show')) {
                const closeBtn = document.getElementById('options-close-button');
                if (closeBtn) closeBtn.click();
            }
        }
        if (mode === 'play') {
            // Handle restart shortcut on victory screen
            if (e.key === 'r' || e.key === 'R') {
                if (victoryTriggered) {
                    document.getElementById('restart-button').click();
                    return;
                }
            }

            const buttons = Array.from(document.querySelectorAll('.weapon-button'));
            const keyToIdx = {
                '1': 0, '2': 1, '3': 2, '4': 3, '5': 4, '6': 5, '7': 6, '8': 7, '9': 8, '0': 9,
                'q': 10, 'w': 11, 'e': 12, 'r': 13, 't': 14,
                'Q': 10, 'W': 11, 'E': 12, 'R': 13, 'T': 14
            };
            const idx = keyToIdx[e.key];
            if (idx !== undefined && idx < buttons.length) {
                const btn = buttons[idx];
                selectedWeapon = btn.getAttribute('data-weapon');
                btn.click();
            } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
                e.preventDefault();
                if (buttons.length > 0) {
                    const currentIndex = buttons.findIndex(btn => btn.classList.contains('selected'));
                    let nextIndex = currentIndex;
                    if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
                        nextIndex = (currentIndex - 1 + buttons.length) % buttons.length;
                    } else {
                        nextIndex = (currentIndex + 1) % buttons.length;
                    }
                    buttons[nextIndex].click();
                }
            } else if (e.key === ' ' || e.code === 'Space') {
                e.preventDefault();
                isHolding = true;
                spawnWeapon(pointerX, pointerY);
            }
        }
    });

    window.addEventListener('keyup', (e) => {
        if (window.gamePausedForAd) return;
        if (e.key === ' ' || e.code === 'Space') {
            isHolding = false;
            soundManager.stopLoop('sfx_laser_fire');
            soundManager.stopLoop('sfx_laser_hum');
            handleLightningRelease();
        }
    });

    // Planet selector trigger
    document.querySelectorAll('.planet-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            startBGM();
            try {
                e.stopPropagation();
                const nextPlanet = btn.dataset.planet;
                if (btn.classList.contains('locked')) {
                    try { soundManager.play('sfx_ui_switch', false, 1.0, -800); } catch (sfxErr) { }
                    return;
                }
                if (nextPlanet === currentPlanet || isPlanetSwitching) return;

                const isProgression = window.isNextPlanetProgression;
                window.isNextPlanetProgression = false;

                try { soundManager.play('sfx_ui_switch'); } catch (sfxErr) { }

                // Start cinematic transition (User feature 5)
                isPlanetSwitching = true;

                setTimeout(() => {
                    currentPlanet = nextPlanet;
                    document.querySelectorAll('.planet-btn').forEach(b => b.classList.remove('selected'));
                    btn.classList.add('selected');

                    updateGameTitle();
                    planetTimeSpent = 0;
                    gameplayStarted = true;
                    resetGame(true, !isProgression);

                    isPlanetSwitching = false;
                    zoomProgress = 0;
                    planetScale = 0.7; // Start point for the ease

                    // Subtle UI polish
                    if (weaponBarWrapper) weaponBarWrapper.style.opacity = '0';
                    if (hudHeaderWrapper) hudHeaderWrapper.style.opacity = '0';
                    if (planetSelector) planetSelector.style.opacity = '0';
                    flickerIn(weaponBarWrapper, 300, 50);
                    flickerIn(hudHeaderWrapper, 500, 300);
                    flickerIn(planetSelector, 500, 500);
                }, 300); // Wait for scale down
            } catch (err) {
                console.error("Error swapping planets:", err);
            }
        });
    });

    // Restart / Next Planet trigger
    document.getElementById('restart-button').addEventListener('click', (e) => {
        e.stopPropagation();

        // If this button is acting as the Spinner Stop button
        if (e.currentTarget.isSpinnerStopButton) {
            if (window.activeWeaponSpinner && window.activeWeaponSpinner.isSpinning && window.activeWeaponSpinner.spinPhase === 'running') {
                window.activeWeaponSpinner.stop();
                e.currentTarget.disabled = true;
                e.currentTarget.style.opacity = '0.5';
                e.currentTarget.style.pointerEvents = 'none';
                e.currentTarget.style.cursor = 'default';
            }
            return;
        }

        if (window.shouldShowUnlockTooltipOnNextPlanet) {
            window.shouldShowUnlockTooltipOnNextPlanet = false;
            setTimeout(() => {
                if (typeof window.showNewWeaponUnlockTooltip === 'function') {
                    window.showNewWeaponUnlockTooltip();
                }
            }, 800);
        }

        const nextPlanetVal = getNextPlanet(currentPlanet);
        const isNextPlanet = nextPlanetVal !== 'earth';
        const victoryScreenVisible = document.getElementById('victory-screen').classList.contains('show');
        if (victoryScreenVisible && isNextPlanet && !victoryBeaconSent) {
            victoryBeaconSent = true;
            navigator.sendBeacon('https://leveldata.poki.io/data', '5da267b2-074f-4740-b6a4-f487c29bc3d3');
        }

        const proceedRestart = () => {
            const next = getNextPlanet(currentPlanet);
            const nextBtn = document.getElementById(`btn-planet-${next}`);
            window.isNextPlanetProgression = true;
            if (nextBtn) {
                nextBtn.click();
            } else {
                if (next === 'neutron_star') {
                    isPlanetSwitching = true;
                    setTimeout(() => {
                        currentPlanet = 'neutron_star';
                        document.querySelectorAll('.planet-btn').forEach(b => b.classList.remove('selected'));
                        updateGameTitle();
                        planetTimeSpent = 0;
                        gameplayStarted = true;
                        resetGame(true);
                        isPlanetSwitching = false;
                        zoomProgress = 0;
                        planetScale = 0.7;
                    }, 300);
                } else {
                    gameplayStarted = true;
                    resetGame();
                }
            }
        };

        if (window.PlatformBridge) {
            window.PlatformBridge.showAdBreak(proceedRestart);
        } else {
            proceedRestart();
        }
    });


    function getUnlockText(weaponId) {
        const t = translations[currentLanguage] || translations['en'];
        const rawName = (t.weaponNames[weaponId] || weaponId).replace(/<br>/gi, ' ');
        const unlocked = t.unlocked || 'UNLOCKED';
        const cjkLangs = ['zh-CN', 'zh-TW', 'ja'];
        if (cjkLangs.includes(currentLanguage)) {
            return `${rawName} ${unlocked}`;
        }
        return `${rawName} ${unlocked}`.toUpperCase();
    }

    function getTranslation(key) {
        const lang = translations[currentLanguage] || translations['en'];
        return lang[key] || translations['en'][key] || key;
    }

    function applyLanguage() {
        const t = translations[currentLanguage] || translations['en'];

        // Options popup labels
        const optTitle = document.getElementById('options-title');
        const optSound = document.getElementById('options-sound-label');
        const optMusic = document.getElementById('options-music-label');
        const optLang = document.getElementById('options-lang-label');
        const optReset = document.getElementById('options-reset-btn');
        if (optTitle) optTitle.textContent = t.options;
        if (optSound) optSound.textContent = '🔊 ' + t.soundEffects;
        if (optMusic) optMusic.textContent = '🎵 ' + t.music;
        if (optLang) optLang.textContent = '🌐 ' + t.language;

        const optShake = document.getElementById('options-shake-label');
        const btnNone = document.getElementById('shake-btn-none');
        const btnHalf = document.getElementById('shake-btn-half');
        const btnFull = document.getElementById('shake-btn-full');
        if (optShake) optShake.textContent = '📳 ' + (t.screenShake || 'SCREEN SHAKE');
        if (btnNone) btnNone.textContent = t.none || 'NONE';
        if (btnHalf) btnHalf.textContent = t.half || 'HALF';
        if (btnFull) btnFull.textContent = t.full || 'FULL';

        const optFullscreen = document.getElementById('fullscreen-label-text');
        if (optFullscreen) optFullscreen.textContent = '🖥️ ' + (t.fullScreen || 'FULL SCREEN');

        const optVibration = document.getElementById('vibration-label-text');
        if (optVibration) optVibration.textContent = '📳 ' + (t.vibration || 'VIBRATION');

        if (optReset) optReset.textContent = '⚠️ ' + (t.resetProgress || 'RESET PROGRESS') + ' ⚠️';

        // Reset Confirmation Popup translations
        const confirmTitle = document.querySelector('#confirm-popup-overlay .options-popup-title');
        const confirmMsg = document.querySelector('#confirm-popup-overlay .confirm-message');
        const confirmYes = document.getElementById('confirm-reset-yes');
        const confirmNo = document.getElementById('confirm-reset-no');
        if (confirmTitle) confirmTitle.textContent = t.resetProgressConfirm || 'RESET PROGRESS?';
        if (confirmMsg) confirmMsg.textContent = t.resetWarnMessage || '';
        if (confirmYes) confirmYes.textContent = t.yesReset || 'YES, RESET';
        if (confirmNo) confirmNo.textContent = t.cancel || 'CANCEL';

        // Victory stats labels (User feature 4)
        const shotsLabel = document.getElementById('stat-shots-label');
        const timeLabel = document.getElementById('stat-time-label');
        const bestTimeLabel = document.getElementById('stat-best-time-label');
        if (shotsLabel) shotsLabel.textContent = t.shotsFired || 'SHOTS FIRED';
        if (timeLabel) timeLabel.textContent = t.timeSpent || 'TIME SPENT';
        if (bestTimeLabel) bestTimeLabel.textContent = t.bestTime || 'BEST TIME';

        // HUD target integrity label
        const integrityLabel = document.getElementById('integrity-label-text');
        if (integrityLabel) integrityLabel.textContent = t.targetIntegrity;

        // Planet button names
        PLANET_ORDER.forEach(planet => {
            const btn = document.getElementById(`btn-planet-${planet}`);
            if (btn) {
                const iconSpan = btn.querySelector('.planet-btn-icon');
                const iconHTML = iconSpan ? iconSpan.outerHTML : '';
                const name = t.planets[planet] || planet;
                btn.innerHTML = iconHTML + ' ' + name;
                // Re-apply translated lock tooltip if locked
                if (btn.classList.contains('locked')) {
                    const idx = PLANET_ORDER.indexOf(planet);
                    if (idx > 0) {
                        const prevPlanet = PLANET_ORDER[idx - 1];
                        const prevName = (t.planets[prevPlanet] || prevPlanet).toUpperCase();
                        const destroyVerb = (t.annihilate || 'DESTROY').toUpperCase();
                        const toUnlockText = (t.toUnlock || 'TO UNLOCK!').toUpperCase();
                        btn.setAttribute('data-tooltip', `${destroyVerb} ${prevName}\n${toUnlockText}`);
                    }
                }
            }
        });

        // Weapon button names
        const weaponIds = ['missile', 'nuke', 'asteroid', 'laser', 'gamma', 'sword', 'moon', 'kraken', 'bowling', 'worm', 'fist', 'blackhole', 'star', 'comet', 'mysterybox', 'lightning'];
        weaponIds.forEach(wid => {
            const btn = document.getElementById(`btn-${wid}`);
            if (btn) {
                const nameEl = btn.querySelector('.weapon-name');
                if (nameEl && t.weaponNames[wid]) {
                    nameEl.innerHTML = t.weaponNames[wid];
                }
                const noAmmoOverlay = btn.querySelector('.no-ammo-overlay');
                if (noAmmoOverlay) {
                    noAmmoOverlay.textContent = t.outOfAmmo || 'NO AMMO';
                }
            }
        });

        // Toggle CJK class for font sizing
        const cjkLangs = ['zh-CN', 'zh-TW', 'ja'];
        const gw = document.getElementById('game-world');
        if (gw) {
            if (cjkLangs.includes(currentLanguage)) {
                gw.classList.add('lang-cjk');
            } else {
                gw.classList.remove('lang-cjk');
            }
        }

        // Ad spin popup
        const adSpinTitle = document.querySelector('#ad-spin-popup-overlay .options-popup-title');
        const adSpinClose = document.getElementById('ad-spin-close');
        const adSpinMsg = document.getElementById('ad-spin-message');
        const adSpinNo = document.getElementById('ad-spin-no');
        const adSpinYes = document.getElementById('ad-spin-yes');
        if (adSpinTitle) adSpinTitle.textContent = t.specialSpin || 'SPECIAL SPIN!';
        if (adSpinClose) adSpinClose.textContent = t.close || 'X';
        if (adSpinMsg) adSpinMsg.textContent = t.spinToDiscover || 'SPIN TO DISCOVER A WEAPON!';
        if (adSpinNo) adSpinNo.textContent = t.nevermind || 'NEVERMIND';
        if (adSpinYes) adSpinYes.textContent = t.watch || 'WATCH!';

        // New best badge
        const bestBadge = document.getElementById('new-best-badge');
        if (bestBadge) bestBadge.innerHTML = `🏆 ${t.newBest || 'NEW BEST!'}`;

        // Switch-weapon tooltip label
        _applySwitchTooltipLabel();

        // Game title
        updateGameTitle();
    }

    function updateGameTitle() {
        const titleEl = document.querySelector('.game-title');
        if (!titleEl) return;
        const t = translations[currentLanguage] || translations['en'];
        if (currentPlanet === 'sun') {
            titleEl.textContent = `${t.annihilateThe} ${currentLanguage === 'en' ? 'SUN' : (currentLanguage === 'ja' ? '太陽' : currentLanguage === 'zh-CN' ? '太阳' : currentLanguage === 'zh-TW' ? '太陽' : currentLanguage === 'es' ? 'EL SOL' : currentLanguage === 'fr' ? 'LE SOLEIL' : currentLanguage === 'ru' ? 'СОЛНЦЕ' : currentLanguage === 'ar' ? 'الشمس' : 'SUN')}`;
        } else {
            const planetNames = {
                en: { earth: 'EARTH', mars: 'MARS', neptune: 'NEPTUNE', jupiter: 'JUPITER', neutron_star: 'NEUTRON STAR' },
                'zh-CN': { earth: '地球', mars: '火星', neptune: '海王星', jupiter: '木星', neutron_star: '中子星' },
                'zh-TW': { earth: '地球', mars: '火星', neptune: '海王星', jupiter: '木星', neutron_star: '中子星' },
                es: { earth: 'LA TIERRA', mars: 'MARTE', neptune: 'NEPTUNO', jupiter: 'JÚPITER', neutron_star: 'ESTRELLA DE NEUTRONES' },
                fr: { earth: 'LA TERRE', mars: 'MARS', neptune: 'NEPTUNE', jupiter: 'JUPITER', neutron_star: 'ÉTOILE À NEUTRONS' },
                ru: { earth: 'ЗЕМЛЮ', mars: 'МАРС', neptune: 'НЕПТУН', jupiter: 'ЮПИТЕР', neutron_star: 'НЕЙТРОННУЮ ЗВЕЗДУ' },
                ja: { earth: '地球', mars: '火星', neptune: '海王星', jupiter: '木星', neutron_star: '中子星' },
                ar: { earth: 'الأرض', mars: 'المريخ', neptune: 'نبتون', jupiter: 'المشتري', neutron_star: 'النجم النيوتروني' }
            };
            const names = planetNames[currentLanguage] || planetNames['en'];
            titleEl.textContent = `${t.annihilate} ${names[currentPlanet] || currentPlanet.toUpperCase()}`;
        }
        document.title = 'ANNIHILATE EARTH';
    }

    // Options popup trigger
    const optionsBtn = document.getElementById('options-btn');
    const optionsOverlay = document.getElementById('options-popup-overlay');
    const optionsCloseBtn = document.getElementById('options-close-btn');
    const sfxSlider = document.getElementById('sfx-volume-slider');
    const sfxValue = document.getElementById('sfx-volume-value');
    const musicSlider = document.getElementById('music-volume-slider');
    const musicValue = document.getElementById('music-volume-value');

    optionsBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        soundManager.play('sfx_ui_switch');
        optionsOverlay.classList.add('show');
    });

    // Extended invisible hit-area behind the options button (same size/position,
    // scaled up) so taps just outside its clipped octagon shape still open options.
    const optionsHitbox = document.getElementById('options-hitbox');
    if (optionsHitbox) {
        optionsHitbox.addEventListener('click', (e) => {
            e.stopPropagation();
            optionsBtn.click();
        });
    }

    optionsCloseBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        soundManager.play('sfx_ui_switch');
        optionsOverlay.classList.remove('show');
    });

    optionsOverlay.addEventListener('click', (e) => {
        if (e.target === optionsOverlay) {
            optionsOverlay.classList.remove('show');
        }
    });

    // Reset Progress custom popup logic
    const optionsResetBtn = document.getElementById('options-reset-btn');
    const confirmOverlay = document.getElementById('confirm-popup-overlay');
    const confirmResetYes = document.getElementById('confirm-reset-yes');
    const confirmResetNo = document.getElementById('confirm-reset-no');

    if (optionsResetBtn) {
        optionsResetBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            soundManager.play('sfx_ui_switch');
            if (confirmOverlay) confirmOverlay.style.display = 'flex';
        });
    }

    if (confirmResetNo) {
        confirmResetNo.addEventListener('click', (e) => {
            e.stopPropagation();
            soundManager.play('sfx_ui_switch');
            if (confirmOverlay) confirmOverlay.style.display = 'none';
        });
    }

    if (confirmResetYes) {
        confirmResetYes.addEventListener('click', async (e) => {
            e.stopPropagation();
            soundManager.play('sfx_ui_switch');

            if (window.PlatformBridge && typeof window.PlatformBridge.gameplayStop === 'function') {
                window.PlatformBridge.gameplayStop();
            }

            // Clear saved progress
            window.safeLocalStorage.removeItem('annihilate_earth_save');

            // Reset state variables
            unlockedPlanets = ['earth'];
            initiallyUnlockedPlanets = new Set(['earth']);
            bestTimes = {};
            claimedPlanetSpinners = [];
            weaponOrder = ['missile', 'nuke', 'laser', 'asteroid', 'gamma', 'mysterybox', 'moon', 'blackhole', 'sword', 'kraken', 'worm', 'fist', 'bowling', 'lightning', 'star', 'comet', 'drill'];
            unlockedWeapons = ['missile', 'nuke', 'laser', 'asteroid', 'gamma', 'mysterybox', 'moon', 'blackhole'];
            initiallyUnlockedWeapons = new Set(unlockedWeapons);
            saveWeaponOrder();
            saveUnlockedWeapons();
            unlockedTooltipShown = false;
            if (typeof saveUnlockedTooltipShown === 'function') {
                saveUnlockedTooltipShown();
            }

            // Update UI/Locks
            updatePlanetButtons();
            refreshWeaponLocks();

            if (currentPlanet !== 'earth') {
                currentPlanet = 'earth';
                document.querySelectorAll('.planet-btn').forEach(b => b.classList.remove('selected'));
                const earthBtn = document.getElementById('btn-planet-earth');
                if (earthBtn) earthBtn.classList.add('selected');
                updateGameTitle();
            }

            // Reset game state and reload planet
            gameplayStarted = true;
            resetGame(false);

            // Hide popups
            if (confirmOverlay) confirmOverlay.style.display = 'none';
            if (optionsOverlay) optionsOverlay.classList.remove('show');
        });
    }

    // Ad Spin Popup Click Handlers
    const adSpinOverlay = document.getElementById('ad-spin-popup-overlay');
    const adSpinYes = document.getElementById('ad-spin-yes');
    const adSpinNo = document.getElementById('ad-spin-no');
    const adSpinClose = document.getElementById('ad-spin-close');

    if (adSpinYes) {
        adSpinYes.addEventListener('click', (e) => {
            e.stopPropagation();
            soundManager.play('sfx_ui_switch');
            adSpinYes.classList.remove('glow-shine');

            // Trigger the ad break
            if (window.PlatformBridge && typeof window.PlatformBridge.showRewardedAd === 'function') {
                window.PlatformBridge.showRewardedAd(() => {
                    console.log("[ShootingStar] Ad finished. Spinner reward granted.");
                    if (window.ShootingStarManager && ShootingStarManager.onWeaponClaimed) {
                        ShootingStarManager.onWeaponClaimed();
                    }
                    if (window.starSelectedWeapon) {
                        unlockSpecificWeapon(window.starSelectedWeapon);
                        window.starSelectedWeapon = null;
                    }
                });
            } else {
                // Fallback unlock if PlatformBridge isn't available
                if (window.ShootingStarManager && ShootingStarManager.onWeaponClaimed) {
                    ShootingStarManager.onWeaponClaimed();
                }
                if (window.starSelectedWeapon) {
                    unlockSpecificWeapon(window.starSelectedWeapon);
                    window.starSelectedWeapon = null;
                }
            }

            if (adSpinOverlay) adSpinOverlay.style.display = 'none';
        });
    }

    if (adSpinNo) {
        adSpinNo.addEventListener('click', (e) => {
            e.stopPropagation();
            soundManager.play('sfx_ui_switch');
            if (adSpinYes) adSpinYes.classList.remove('glow-shine');
            if (window.activeWeaponSpinner) {
                window.activeWeaponSpinner.destroy();
            }
            if (adSpinOverlay) adSpinOverlay.style.display = 'none';
        });
    }

    if (adSpinClose) {
        adSpinClose.addEventListener('click', (e) => {
            e.stopPropagation();
            soundManager.play('sfx_ui_switch');
            if (adSpinYes) adSpinYes.classList.remove('glow-shine');
            if (window.activeWeaponSpinner) {
                window.activeWeaponSpinner.destroy();
            }
            if (adSpinOverlay) adSpinOverlay.style.display = 'none';
        });
    }

    sfxSlider.addEventListener('input', (e) => {
        const val = parseInt(e.target.value);
        sfxValue.textContent = val + '%';
        soundManager.setSfxVolume(val / 100);
    });
    sfxSlider.addEventListener('change', (e) => {
        const val = parseInt(e.target.value);
        saveOptions({ sfxVolume: val });
    });

    musicSlider.addEventListener('input', (e) => {
        const val = parseInt(e.target.value);
        musicValue.textContent = val + '%';
        soundManager.setBgmVolume(val / 100);
    });
    musicSlider.addEventListener('change', (e) => {
        const val = parseInt(e.target.value);
        saveOptions({ musicVolume: val });
    });

    // Custom language dropdown
    const customLangBtn = document.getElementById('custom-lang-btn');
    const customLangDropdown = document.getElementById('custom-lang-dropdown');
    const customLangLabelText = document.getElementById('custom-lang-label-text');

    customLangBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const isOpen = customLangDropdown.classList.contains('open');
        customLangDropdown.classList.toggle('open', !isOpen);
        customLangBtn.classList.toggle('open', !isOpen);
    });

    customLangDropdown.querySelectorAll('.custom-select-option').forEach(opt => {
        opt.addEventListener('click', (e) => {
            e.stopPropagation();
            const val = opt.dataset.value;
            currentLanguage = val;
            customLangLabelText.textContent = opt.textContent;
            customLangDropdown.querySelectorAll('.custom-select-option').forEach(o => o.classList.remove('selected'));
            opt.classList.add('selected');
            customLangDropdown.classList.remove('open');
            customLangBtn.classList.remove('open');
            applyLanguage();
            saveOptions({ language: val });
        });
    });

    // Close dropdown when clicking outside
    document.addEventListener('click', () => {
        customLangDropdown.classList.remove('open');
        customLangBtn.classList.remove('open');
    });

    function updateScreenShakeUI() {
        const buttons = document.querySelectorAll('.shake-option-btn');
        buttons.forEach(btn => {
            if (btn.dataset.value === currentScreenShakeSetting) {
                btn.classList.add('selected');
            } else {
                btn.classList.remove('selected');
            }
        });
    }

    document.querySelectorAll('.shake-option-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const val = btn.dataset.value;
            currentScreenShakeSetting = val;
            updateScreenShakeUI();
            saveOptions({ screenShake: val });
            soundManager.play('sfx_ui_switch');
        });
    });

    // Fullscreen Option Logic

    const fsCheckbox = document.getElementById('fullscreen-checkbox');
    if (fsCheckbox) {
        fsCheckbox.addEventListener('change', (e) => {
            toggleFullscreen(fsCheckbox.checked);
            soundManager.play('sfx_ui_switch');
        });
    }

    function updateFullscreenCheckbox() {
        const isCurrentlyFullscreen = !!(document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement || document.msFullscreenElement);
        if (fsCheckbox) {
            fsCheckbox.checked = isCurrentlyFullscreen;
        }
    }

    document.addEventListener('fullscreenchange', updateFullscreenCheckbox);
    document.addEventListener('webkitfullscreenchange', updateFullscreenCheckbox);
    document.addEventListener('mozfullscreenchange', updateFullscreenCheckbox);
    document.addEventListener('MSFullscreenChange', updateFullscreenCheckbox);

    // Vibration Option Logic
    const vibCheckbox = document.getElementById('vibration-checkbox');
    if (vibCheckbox) {
        vibCheckbox.addEventListener('change', (e) => {
            vibrationEnabled = vibCheckbox.checked;
            saveOptions({ vibration: vibrationEnabled });
            soundManager.play('sfx_ui_switch');
            if (vibrationEnabled && typeof navigator !== 'undefined' && navigator.vibrate) {
                try { navigator.vibrate(20); } catch (e) { }
            }
        });
    }

    function updateVibrationUI() {
        if (vibCheckbox) {
            vibCheckbox.checked = vibrationEnabled;
        }
    }

    // Setup scene
    updatePlanetButtons();

    // Load saved planet unlocks
    loadUnlockedPlanets().then(async () => {
        // Load options
        const response = await getGameState();
        if (response.success && response.state) {
            const state = response.state;
            if (state.language) {
                currentLanguage = state.language;
                const opt = customLangDropdown.querySelector(`.custom-select-option[data-value="${currentLanguage}"]`);
                if (opt) {
                    customLangLabelText.textContent = opt.textContent;
                    customLangDropdown.querySelectorAll('.custom-select-option').forEach(o => o.classList.remove('selected'));
                    opt.classList.add('selected');
                }
                applyLanguage();
            }
            if (state.sfxVolume !== undefined) {
                sfxSlider.value = state.sfxVolume;
                sfxValue.textContent = state.sfxVolume + '%';
                soundManager.setSfxVolume(state.sfxVolume / 100);
            }
            if (state.musicVolume !== undefined) {
                musicSlider.value = state.musicVolume;
                musicValue.textContent = state.musicVolume + '%';
                soundManager.setBgmVolume(state.musicVolume / 100);
            }
            if (state.screenShake !== undefined) {
                currentScreenShakeSetting = state.screenShake;
                updateScreenShakeUI();
            }
            if (state.vibration !== undefined) {
                vibrationEnabled = state.vibration;
                updateVibrationUI();
            }
        }

        let furthestPlanet = 'earth';
        for (let i = PLANET_ORDER.length - 1; i >= 0; i--) {
            if (unlockedPlanets.includes(PLANET_ORDER[i])) {
                furthestPlanet = PLANET_ORDER[i];
                break;
            }
        }
        if (furthestPlanet === 'neutron_star') {
            furthestPlanet = 'sun';
        }
        if (currentPlanet !== furthestPlanet) {
            currentPlanet = furthestPlanet;
            document.querySelectorAll('.planet-btn').forEach(b => {
                if (b.dataset.planet === furthestPlanet) {
                    b.classList.add('selected');
                } else {
                    b.classList.remove('selected');
                }
            });
            updateGameTitle();
        }
        // Always reset the game to set up the starting planet state and trigger gameplayStart
        resetGame(true);
    });

    setLoadingProgress(90, getTranslation('loadingCalibrate'));

    // Staggered flickering in animation for UI elements
    function flickerIn(element, duration, delay) {
        if (!element) return;
        element.style.opacity = '0';
        element.style.visibility = 'visible';
        setTimeout(() => {
            const startTime = performance.now();
            const flickerCount = 6;
            function doFlicker() {
                const elapsed = performance.now() - startTime;
                const progress = Math.min(1, elapsed / duration);
                if (progress >= 1) {
                    element.style.opacity = '1';
                    return;
                }
                // Random flicker between 0 and current progress
                const flicker = Math.random() < 0.4 ? 0 : progress + Math.random() * (1 - progress) * 0.3;
                element.style.opacity = flicker.toString();
                requestAnimationFrame(doFlicker);
            }
            doFlicker();
        }, delay);
    }

    function beginGameplay() {
        flickerIn(weaponBarWrapper, 300, 200);
        flickerIn(hudHeaderWrapper, 500, 750);
        flickerIn(planetSelector, 500, 450);
    }

    // Hide UI elements initially
    const weaponBarWrapper = document.querySelector('.weapon-bar-wrapper');
    const hudHeaderWrapper = document.querySelector('.hud-header-wrapper');
    const planetSelector = document.querySelector('.planet-selector');

    if (weaponBarWrapper) weaponBarWrapper.style.opacity = '0';
    if (hudHeaderWrapper) hudHeaderWrapper.style.opacity = '0';
    if (planetSelector) planetSelector.style.opacity = '0';

    // Dismiss loading screen after a brief delay
    if (window.PlatformBridge && typeof window.PlatformBridge.gameLoadingFinished === 'function') {
        window.PlatformBridge.gameLoadingFinished();
    }
    navigator.sendBeacon('https://leveldata.poki.io/data', '5da267b2-074f-4740-b6a4-f487c29bc3d3');

    setLoadingProgress(100, getTranslation('ready'));
    if (loadingAnimId) cancelAnimationFrame(loadingAnimId);
    window.removeEventListener('resize', resizeLoadingCanvas);
    if (missileDiv.parentNode) missileDiv.parentNode.removeChild(missileDiv);
    loadingScreen.classList.add('fade-out');
    if (window.deferredSoundIds) {
        window.deferredSoundIds.forEach(id => soundManager.load(id));
    }
    setTimeout(() => {
        loadingScreen.style.display = 'none';
    }, 400);

    // Call intro sequence instead of going straight to gameplay
    if (typeof window.startIntro === 'function') {
        window.startIntro(beginGameplay);
    } else {
        beginGameplay();
    }

    // Setup Loop
    let lastTime = performance.now();

    function gameLoop(timestamp) {
        if (window.gamePausedForAd) {
            lastTime = timestamp; // Prevent delta-time jump on resume
            requestAnimationFrame(gameLoop);
            return;
        }
        let deltaTime = (timestamp - lastTime) / 1000;
        lastTime = timestamp;

        // Cap deltaTime to 0.1s to prevent physics/state explosion after backgrounding or lag spikes
        if (deltaTime > 0.1) {
            deltaTime = 0.1;
        }
        frameDeltaTime = deltaTime;

        // Guard a single frame's work so one bad frame reports the error but
        // does not break the requestAnimationFrame chain (which would freeze
        // the game permanently with no way to recover on a portal).
        try {
            update(deltaTime);
            render();
        } catch (err) {
            if (window.reportGameError) {
                window.reportGameError('gameLoop', err);
            } else {
                console.error('[GameError] (gameLoop)', err);
            }
        }

        requestAnimationFrame(gameLoop);
    }

    requestAnimationFrame(gameLoop);
}

// Auto-run the game in local mode
window.addEventListener('DOMContentLoaded', () => {
    let booted = false;
    const initializeGameSafely = () => {
        if (booted) return;
        booted = true;
        run('play');
    };
    // Safety fallback: boot anyway after 1.5 seconds in case the Font API hangs
    const safetyTimeout = setTimeout(initializeGameSafely, 1500);

    if (document.fonts && typeof document.fonts.ready === 'object' && typeof document.fonts.ready.then === 'function') {
        document.fonts.ready.then(() => {
            clearTimeout(safetyTimeout);
            initializeGameSafely();
        }).catch(() => {
            clearTimeout(safetyTimeout);
            initializeGameSafely();
        });
    } else {
        clearTimeout(safetyTimeout);
        initializeGameSafely();
    }
});
