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
    constructor(maxSize = 450) {
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

let particles = new ParticlePool(150);
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

function addFloatingText(x, y, text, color = 'rgba(0, 240, 255,', duration = 0.5, maxOffset = 50) {
    floatingTexts.push({
        x: x,
        y: y,
        startY: y,
        text: text,
        color: color,
        life: duration,
        maxLife: duration,
        maxOffset: maxOffset
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

    // Clear any previous transition state classes
    notif.classList.remove('show', 'hide');

    // Trigger reflow
    notif.offsetHeight;

    // Apply the show class to animate entry
    notif.classList.add('show');

    soundManager.play('sfx_ui_switch', false, 0.7, 400);

    unlockNotificationTimeout = setTimeout(() => {
        notif.classList.remove('show');
        notif.classList.add('hide');
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
let weaponOrder = ['missile', 'nuke', 'asteroid', 'laser', 'lightning', 'gamma', 'sword', 'moon', 'blackhole', 'kraken', 'worm', 'fist', 'bowling', 'star', 'comet'];
let unlockedWeapons = ['missile', 'nuke', 'asteroid', 'laser', 'lightning', 'gamma', 'sword', 'moon', 'blackhole'];
let initiallyUnlockedWeapons = new Set(unlockedWeapons);

function isWeaponUnlocked(wid) {
    return unlockedWeapons.includes(wid);
}

async function saveUnlockedWeapons() {
    try {
        const current = await getGameState();
        const state = (current && current.state) ? current.state : {};
        state.unlockedWeapons = unlockedWeapons;
        await saveGameState(state);
    } catch (error) {
        console.warn('Failed to save unlocked weapons:', error.message);
    }
}

function unlockRandomWeapon() {
    const allLockedWeapons = ['kraken', 'worm', 'fist', 'bowling', 'star', 'comet'];
    const lockedRemaining = allLockedWeapons.filter(wid => !unlockedWeapons.includes(wid));
    if (lockedRemaining.length > 0) {
        const randomIndex = Math.floor(Math.random() * lockedRemaining.length);
        const weaponToUnlock = lockedRemaining[randomIndex];
        unlockedWeapons.push(weaponToUnlock);
        saveUnlockedWeapons();
        return weaponToUnlock;
    }
    return null;
}

function unlockSpecificWeapon(wid) {
    if (!unlockedWeapons.includes(wid)) {
        unlockedWeapons.push(wid);
        saveUnlockedWeapons();
        updateWeaponOrderOnUnlock();
        refreshWeaponLocks();
        
        const btn = document.getElementById(`btn-${wid}`);
        const name = btn ? btn.querySelector('.weapon-name').innerText.replace('\n', ' ') : wid.toUpperCase();
        const icon = btn ? btn.querySelector('.weapon-icon').innerText : '⚡';
        showUnlockNotification(`${icon} ${name} UNLOCKED!`);
        return true;
    }
    return false;
}

async function saveWeaponOrder() {
    try {
        const current = await getGameState();
        const state = (current && current.state) ? current.state : {};
        state.weaponOrder = weaponOrder;
        await saveGameState(state);
    } catch (error) {
        console.warn('Failed to save weapon order:', error.message);
    }
}

function applyWeaponOrderToDOM() {
    const container = document.getElementById('weapon-panel-inner');
    if (!container) return;
    weaponOrder.forEach(wid => {
        const btn = document.getElementById(`btn-${wid}`);
        if (btn) {
            container.appendChild(btn);
        }
    });
}

function updateWeaponOrderOnUnlock() {
    const unlocked = [];
    const locked = [];
    weaponOrder.forEach(wid => {
        if (isWeaponUnlocked(wid)) {
            unlocked.push(wid);
        } else {
            locked.push(wid);
        }
    });
    weaponOrder = [...unlocked, ...locked];
    saveWeaponOrder();
    applyWeaponOrderToDOM();
}

async function loadUnlockedPlanets() {
    try {
        const response = await getGameState();
        if (response.state) {
            if (response.state.weaponOrder) {
                weaponOrder = response.state.weaponOrder;
            }
            if (response.state.unlockedWeapons) {
                unlockedWeapons = response.state.unlockedWeapons;
                initiallyUnlockedWeapons = new Set(unlockedWeapons);
            }
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
        updateWeaponOrderOnUnlock();
    } catch (error) {
        console.warn('Failed to load unlocked planets:', error.message);
    }
}

function refreshWeaponLocks() {
    const weaponsInfo = [
        { id: 'kraken', getCd: () => krakenCooldown, setCd: (v) => krakenCooldown = v, getInitCd: () => isInitialKrakenCooldown, setInitCd: (v) => isInitialKrakenCooldown = v },
        { id: 'bowling', getCd: () => bowlingCooldown, setCd: (v) => bowlingCooldown = v, getInitCd: () => isInitialBowlingCooldown, setInitCd: (v) => isInitialBowlingCooldown = v },
        { id: 'worm', getCd: () => wormCooldown, setCd: (v) => wormCooldown = v, getInitCd: () => isInitialWormCooldown, setInitCd: (v) => isInitialWormCooldown = v },
        { id: 'fist', getCd: () => fistCooldown, setCd: (v) => fistCooldown = v, getInitCd: () => isInitialFistCooldown, setInitCd: (v) => isInitialFistCooldown = v },
        { id: 'star', getCd: () => starCooldown, setCd: (v) => starCooldown = v, getInitCd: () => isInitialStarCooldown, setInitCd: (v) => isInitialStarCooldown = v },
        { id: 'comet', getCd: () => cometCooldown, setCd: (v) => cometCooldown = v, getInitCd: () => isInitialCometCooldown, setInitCd: (v) => isInitialCometCooldown = v }
    ];

    weaponsInfo.forEach(w => {
        if (!unlockedWeapons.includes(w.id)) {
            w.setCd(99999.0);
            w.setInitCd(false);
        } else {
            if (initiallyUnlockedWeapons.has(w.id)) {
                w.setCd(0.0);
                w.setInitCd(false);
            } else {
                w.setCd(1.25);
                w.setInitCd(true);
            }
        }
    });

    // Instantly update active/inactive cooldown states in UI for unlocked weapons
    weaponsInfo.forEach(w => {
        const btn = document.getElementById(`btn-${w.id}`);
        const ui = document.getElementById(`${w.id}-cooldown-ui`);
        if (unlockedWeapons.includes(w.id)) {
            if (w.getCd() <= 0) {
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

    updateWeaponOrderOnUnlock();
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
let activeLightnings = [];
let lightningCooldown = 0;
let lightningHoldTime = 0;
let lightningQueue = [];
let lightningChargeFlashTimer = 0;
let lightningChargeShakeTimer = 0;
let lightningLastChargedCount = 0;



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
