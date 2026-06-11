var canvas, ctx, hiddenCanvas, hiddenCtx, bgCanvas, bgCtx, soundManager, fistImage;
var spriteOrange, spriteBrightYellow, spriteSmokeStandard, spriteSmokeMissile, spriteVermillionRed, spriteLightOrange, spriteWhiteGold;
var SCREEN_W = 1600;
var SCREEN_H = 900;
const PLANET_OFFSET_Y = 44;
var CENTER_X = 800;
var CENTER_Y = 450 + PLANET_OFFSET_Y;
var PLANET_CANVAS_SIZE = 460;
var MAX_COOLDOWNS;
var dt60 = 1;
var weaponQueues = {};

// Game States
let selectedWeapon = 'missile';
let currentPlanet = 'earth';
let seedX = 0;
let seedY = 0;
let laserSoundCounter = 0;
const PLANET_ORDER = ['earth', 'mars', 'neptune', 'jupiter', 'sun'];
let unlockedPlanets = ['earth'];
let weapons = [];

// High-performance pre-allocated particle pool class
class ParticlePool {
    constructor(maxSize = 250) {
        this.maxSize = maxSize;
        this.pool = [];
        for (let i = 0; i < maxSize; i++) {
            this.pool.push({
                active: false,
                x: 0,
                y: 0,
                vx: 0,
                vy: 0,
                life: 0,
                maxLife: 0,
                size: 0,
                color: '',
                type: '',
                moonExhaust: false,
                isComet: false
            });
        }
    }

    push(properties) {
        // Find inactive particle
        let p = null;
        for (let i = 0; i < this.maxSize; i++) {
            if (!this.pool[i].active) {
                p = this.pool[i];
                break;
            }
        }
        // Fallback: steal oldest (lowest life)
        if (!p) {
            let minLife = Infinity;
            for (let i = 0; i < this.maxSize; i++) {
                if (this.pool[i].active && this.pool[i].life < minLife) {
                    minLife = this.pool[i].life;
                    p = this.pool[i];
                }
            }
        }
        if (p) {
            p.active = true;
            p.x = properties.x;
            p.y = properties.y;
            p.vx = properties.vx;
            p.vy = properties.vy;
            p.life = properties.life !== undefined ? properties.life : 1.0;
            p.maxLife = properties.maxLife;
            p.size = properties.size;
            p.color = properties.color;
            p.type = properties.type;
            p.moonExhaust = !!properties.moonExhaust;
            p.isComet = !!properties.isComet;
        }
    }

    clear() {
        for (let i = 0; i < this.maxSize; i++) {
            this.pool[i].active = false;
        }
    }
}

let particles = new ParticlePool(50);
let shockwaves = []; // (User feature 7: Shockwave rings)
let holyRays = []; // Holy rays effect for Excalibur
let totalShotsFired = 0; // (User feature 4: Stats tracking)
let totalCratersMade = 0; // (User feature 4: Stats tracking)
let planetTimeSpent = 0;
let bestTimes = {};
let gameplayStarted = false;
let planetRotation = 0;
let planetScale = 1.0;
let isPlanetSwitching = false;
let zoomProgress = 1.0;
const ZOOM_DURATION = 1; // seconds

function cubicEaseOut(t) {
    return 1 - Math.pow(1 - t, 3);
}

function cubicEaseIn(t) {
    return t * t * t;
}

function addFloatingText(x, y, text, color = 'rgba(0, 240, 255,', duration = 0.5) {
    floatingTexts.push({
        x: x,
        y: y,
        startY: y,
        text: text,
        color: color,
        life: duration,
        maxLife: duration
    });
}

let unlockNotificationTimeout = null;

function showUnlockNotification(text) {
    const notif = document.getElementById('weapon-unlock-notification');
    if (!notif) return;

    if (unlockNotificationTimeout) {
        clearTimeout(unlockNotificationTimeout);
    }

    notif.textContent = text;
    notif.style.transition = 'none';
    notif.style.opacity = '0';
    notif.style.transform = 'translate(-50%, 15px)';

    // Trigger reflow
    notif.offsetHeight;

    notif.style.transition = 'opacity 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275), transform 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)';
    notif.style.opacity = '1';
    notif.style.transform = 'translate(-50%, 0px)';

    soundManager.play('sfx_ui_switch', false, 0.7, 400);

    unlockNotificationTimeout = setTimeout(() => {
        notif.style.transition = 'opacity 0.5s ease-in, transform 0.5s ease-in';
        notif.style.opacity = '0';
        notif.style.transform = 'translate(-50%, -25px)';
    }, 2000);
}

// Persistence functions for saving/loading unlocked planets
async function saveUnlockedPlanets() {
    try {
        const current = await getGameState();
        const state = (current && current.state) ? current.state : {};
        state.unlockedPlanets = unlockedPlanets;
        await saveGameState(state);
    } catch (error) {
        console.warn('Failed to save unlocked planets:', error.message);
    }
}

async function saveBestTimes() {
    try {
        const current = await getGameState();
        const state = (current && current.state) ? current.state : {};
        state.bestTimes = bestTimes;
        await saveGameState(state);
    } catch (error) {
        console.warn('Failed to save best times:', error.message);
    }
}

async function saveOptions(options) {
    try {
        const current = await getGameState();
        const state = (current && current.state) ? current.state : {};
        if (options.sfxVolume !== undefined) state.sfxVolume = options.sfxVolume;
        if (options.musicVolume !== undefined) state.musicVolume = options.musicVolume;
        if (options.language !== undefined) state.language = options.language;
        await saveGameState(state);
    } catch (error) {
        console.warn('Failed to save options:', error.message);
    }
}

let initiallyUnlockedPlanets = new Set(['earth']);
async function loadUnlockedPlanets() {
    try {
        const response = await getGameState();
        if (response.state) {
            if (response.state.unlockedPlanets) {
                unlockedPlanets = response.state.unlockedPlanets;
                initiallyUnlockedPlanets = new Set(unlockedPlanets);
                updatePlanetButtons();
                refreshWeaponLocks();
            }
            if (response.state.bestTimes) {
                bestTimes = response.state.bestTimes;
            }
        }
    } catch (error) {
        console.warn('Failed to load unlocked planets:', error.message);
    }
}

function refreshWeaponLocks() {
    // Handle Kraken (Cthulhu) Progression locks and starting cooldown overrides
    if (!unlockedPlanets.includes('mars')) {
        krakenCooldown = 99999.0;
        isInitialKrakenCooldown = false;
    } else {
        if (initiallyUnlockedPlanets.has('mars')) {
            krakenCooldown = 0.0;
            isInitialKrakenCooldown = false;
        } else {
            if (currentPlanet === 'mars') {
                krakenCooldown = 2.0;
                isInitialKrakenCooldown = true;
            } else {
                krakenCooldown = 0.0;
                isInitialKrakenCooldown = false;
            }
        }
    }

    // Handle Bowling Progression locks and starting cooldown overrides (Locked behind Sun)
    if (!unlockedPlanets.includes('sun')) {
        bowlingCooldown = 99999.0;
        isInitialBowlingCooldown = false;
    } else {
        if (initiallyUnlockedPlanets.has('sun')) {
            bowlingCooldown = 0.0;
            isInitialBowlingCooldown = false;
        } else {
            if (currentPlanet === 'sun') {
                bowlingCooldown = 2.0;
                isInitialBowlingCooldown = true;
            } else {
                bowlingCooldown = 0.0;
                isInitialBowlingCooldown = false;
            }
        }
    }

    // Handle Worm Progression locks and starting cooldown overrides (Locked behind Neptune)
    if (!unlockedPlanets.includes('neptune')) {
        wormCooldown = 99999.0;
        isInitialWormCooldown = false;
    } else {
        if (initiallyUnlockedPlanets.has('neptune')) {
            wormCooldown = 0.0;
            isInitialWormCooldown = false;
        } else {
            if (currentPlanet === 'neptune') {
                wormCooldown = 2.0;
                isInitialWormCooldown = true;
            } else {
                wormCooldown = 0.0;
                isInitialWormCooldown = false;
            }
        }
    }

    // Handle Fist Progression locks and starting cooldown overrides (Locked behind Jupiter)
    if (!unlockedPlanets.includes('jupiter')) {
        fistCooldown = 99999.0;
        isInitialFistCooldown = false;
    } else {
        if (initiallyUnlockedPlanets.has('jupiter')) {
            fistCooldown = 0.0;
            isInitialFistCooldown = false;
        } else {
            if (currentPlanet === 'jupiter') {
                fistCooldown = 2.0;
                isInitialFistCooldown = true;
            } else {
                fistCooldown = 0.0;
                isInitialFistCooldown = false;
            }
        }
    }

    // Handle Star Progression locks and starting cooldown overrides (Locked behind Sun)
    if (!unlockedPlanets.includes('sun')) {
        starCooldown = 99999.0;
        isInitialStarCooldown = false;
    } else {
        if (initiallyUnlockedPlanets.has('sun')) {
            starCooldown = 0.0;
            isInitialStarCooldown = false;
        } else {
            if (currentPlanet === 'sun') {
                starCooldown = 2.0;
                isInitialStarCooldown = true;
            } else {
                starCooldown = 0.0;
                isInitialStarCooldown = false;
            }
        }
    }

    // Handle Comet Progression locks and starting cooldown overrides (Locked behind Neptune)
    if (!unlockedPlanets.includes('neptune')) {
        cometCooldown = 99999.0;
        isInitialCometCooldown = false;
    } else {
        if (initiallyUnlockedPlanets.has('neptune')) {
            cometCooldown = 0.0;
            isInitialCometCooldown = false;
        } else {
            if (currentPlanet === 'neptune') {
                cometCooldown = 2.0;
                isInitialCometCooldown = true;
            } else {
                cometCooldown = 0.0;
                isInitialCometCooldown = false;
            }
        }
    }

    // Handle Black Hole Progression locks and starting cooldown overrides (Locked behind Sun)
    // Black hole is now unlocked by time only (no more planet lock).

    // Instantly update active/inactive cooldown states in UI for unlocked weapons
    const weaponsToCheck = [
        { id: 'kraken', key: 'mars', cd: krakenCooldown },
        { id: 'bowling', key: 'sun', cd: bowlingCooldown },
        { id: 'fist', key: 'jupiter', cd: fistCooldown },
        { id: 'worm', key: 'neptune', cd: wormCooldown },
        { id: 'star', key: 'sun', cd: starCooldown },
        { id: 'comet', key: 'neptune', cd: cometCooldown }
    ];
    weaponsToCheck.forEach(w => {
        const btn = document.getElementById(`btn-${w.id}`);
        const ui = document.getElementById(`${w.id}-cooldown-ui`);
        if (unlockedPlanets.includes(w.key)) {
            if (w.cd <= 0) {
                if (btn) btn.classList.remove('cooldown-active');
                if (ui) {
                    const text = ui.querySelector('.cooldown-text');
                    const bar = ui.querySelector('.cooldown-bar');
                    if (text) text.textContent = '';
                    if (bar) bar.style.height = '0%';
                }
            }
        }
    });
}

function getPlanetSize() {
    if (currentPlanet === 'mars') return 190;
    if (currentPlanet === 'neptune') return 340;
    if (currentPlanet === 'jupiter') return 380;
    if (currentPlanet === 'sun') return 455;
    return getConfigValue('planet.size', 230);
}

// Dynamic Center of Mass variables
let planetCenterX = 230; // 200
let planetCenterY = 230; // 200
let initialPixelCount = 0;
let currentPixelCount = 0;
let initialCorePixelCount = 0;
let currentCorePixelCount = 0;

let screenShake = { x: 0, y: 0, intensity: 0, duration: 0 };
let sharedPlanetData = null;
function getSharedPlanetData() {
    if (!sharedPlanetData && typeof hiddenCtx !== 'undefined' && hiddenCtx) {
        sharedPlanetData = hiddenCtx.getImageData(0, 0, PLANET_CANVAS_SIZE, PLANET_CANVAS_SIZE);
    }
    return sharedPlanetData;
}
let screenFlash = { alpha: 0, r: 255, g: 190, b: 100 };
let stars = [];
let floatingTexts = [];
let victoryTriggered = false;
let pointerX = CENTER_X;
let pointerY = 340;
let showPointer = false;
// Weapon states
let asteroidCooldown = 11.0;
let moonCooldown = 160.0;
let nukeCooldown = 0;
let missileCooldown = 0;
let gammaBurstCooldown = 40.0;
let laserCooldown = 4.0;
let swordCooldown = 80.0;
let bowlingCooldown = 0;
let krakenCooldown = 0;
let wormCooldown = 0.0;
let blackholeCooldown = 240.0;
let fistCooldown = 0;
let starCooldown = 0;
let cometCooldown = 0;
let isInitialAsteroidCooldown = true;
let isInitialLaserCooldown = true;
let isInitialGammaCooldown = true;
let isInitialSwordCooldown = true;
let isInitialMoonCooldown = true;
let isInitialKrakenCooldown = false;
let isInitialBowlingCooldown = false;
let isInitialFistCooldown = false;
let isInitialWormCooldown = false;
let isInitialBlackholeCooldown = true;
let isInitialStarCooldown = false;
let isInitialCometCooldown = false;
let iceGrid = new Uint8Array(115 * 115);
let activeGammaBursts = [];
let activeSwords = [];
let activeBowlingBalls = [];
let activeKrakens = [];
let activeWorms = [];
let activeBlackHoles = [];
let activeFists = [];
let activeStars = [];
let activeStarProjectiles = [];
let fistStuckCount = 0;
let isHolding = false;
let missileLaunchTimer = 0;
let laserLaunchTimer = 0;
let laserHoldTime = 0;
let laserEnhanced = false;
let laserTier3 = false;
let laserFlickerTime = 0;
let laserFlickerTriggered = false;
let laserFlicker2Time = 0;
let laserFlicker2Triggered = false;
let lastLaserImpact = null;
let lastLaserTier = 1;



// 2D Value Noise Grid
const NOISE_SIZE = 128;
const noiseGrid = new Float32Array(NOISE_SIZE * NOISE_SIZE);
for (let i = 0; i < noiseGrid.length; i++) {
    noiseGrid[i] = Math.random();
}

function smoothNoise(x, y) {
    let x1 = Math.floor(x) % NOISE_SIZE;
    let y1 = Math.floor(y) % NOISE_SIZE;
    if (x1 < 0) x1 += NOISE_SIZE;
    if (y1 < 0) y1 += NOISE_SIZE;
    const x2 = (x1 + 1) % NOISE_SIZE;
    const y2 = (y1 + 1) % NOISE_SIZE;

    const tx = x - Math.floor(x);
    const ty = y - Math.floor(y);

    const sx = tx * tx * (3 - 2 * tx);
    const sy = ty * ty * (3 - 2 * ty);

    const n11 = noiseGrid[y1 * NOISE_SIZE + x1];
    const n12 = noiseGrid[y1 * NOISE_SIZE + x2];
    const n21 = noiseGrid[y2 * NOISE_SIZE + x1];
    const n22 = noiseGrid[y2 * NOISE_SIZE + x2];

    const nx1 = n11 + sx * (n12 - n11);
    const nx2 = n21 + sx * (n22 - n21);

    return nx1 + sy * (nx2 - nx1);
}

function fbm(x, y, octaves = 5) {
    let value = 0;
    let amplitude = 0.5;
    let frequency = 1.0;
    for (let i = 0; i < octaves; i++) {
        value += amplitude * smoothNoise(x * frequency, y * frequency);
        frequency *= 2.0;
        amplitude *= 0.5;
    }
    return value;
}
// Translations system (loaded from js/translations.js)

let currentLanguage = 'en';
