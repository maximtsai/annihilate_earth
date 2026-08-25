var canvas, ctx, hiddenCanvas, hiddenCtx, bgCanvas, bgCtx, soundManager, fistImage;
var spriteOrange, spriteBrightYellow, spriteSmokeStandard, spriteSmokeMissile, spriteVermillionRed, spriteLightOrange, spriteWhiteGold, spriteDuck;
var supportsGlow = true;
var earthGlow, marsGlow, neptuneGlow, jupiterGlow, neutronStarGlow, sunCorona, sunCoreGlow, magmaCoreGlow;
var SCREEN_W = 1600;
var SCREEN_H = 900;
const PLANET_OFFSET_Y = 44;
var CENTER_X = 800;
var CENTER_Y = 450 + PLANET_OFFSET_Y;
var PLANET_CANVAS_SIZE = 460;
var MAX_COOLDOWNS;
var dt60 = 1;
var frameDeltaTime = 0;
var weaponQueues = {};

// Game States
let selectedWeapon = 'missile';
let currentPlanet = 'earth';
let isPlanetBuilderMode = false;
let seedX = 0;
let seedY = 0;
let laserSoundCounter = 0;
const PLANET_ORDER = ['earth', 'mars', 'neptune', 'jupiter', 'sun', 'neutron_star'];
let unlockedPlanets = ['earth'];
let weapons = [];

// High-performance pre-allocated particle pool class
function getSpriteForColor(color) {
    if (!color) return typeof spriteOrange !== 'undefined' ? spriteOrange : null;
    if (color.startsWith('hsl(')) {
        const match = color.match(/hsl\(([^,]+),\s*([^,]+),\s*([^%)]+)%?\)/);
        if (match) {
            const h = parseFloat(match[1]);
            const l = parseFloat(match[3]);
            if (l >= 88) return typeof spriteWhiteGold !== 'undefined' ? spriteWhiteGold : null;
            if (l >= 82) return typeof spriteBrightYellow !== 'undefined' ? spriteBrightYellow : null;
            if (h >= 52) return typeof spriteLightOrange !== 'undefined' ? spriteLightOrange : null;
            if (h >= 30) return typeof spriteOrange !== 'undefined' ? spriteOrange : null;
            return typeof spriteVermillionRed !== 'undefined' ? spriteVermillionRed : null;
        }
    } else if (color.includes('255, 255') || color.includes('255, 255, 120')) {
        return typeof spriteBrightYellow !== 'undefined' ? spriteBrightYellow : null;
    } else if (color === '#66b2ff' || color === '#00f0ff' || color === '#ffffff') {
        return null;
    }
    return typeof spriteOrange !== 'undefined' ? spriteOrange : null;
}

class ParticlePool {
    constructor(maxSize = 450) {
        this.maxSize = maxSize;
        this.pool = [];
        this.freeList = [];
        for (let i = 0; i < maxSize; i++) {
            const p = {
                poolIndex: i,
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
                sprite: null,
                moonExhaust: false,
                isComet: false,
                isFreeze: false
            };
            this.pool.push(p);
            this.freeList.push(i);
        }
    }

    push(properties) {
        let p = null;
        if (this.freeList.length > 0) {
            const idx = this.freeList.pop();
            p = this.pool[idx];
        } else {
            // Fallback: steal oldest (lowest life)
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
            p.sprite = properties.sprite !== undefined ? properties.sprite : getSpriteForColor(properties.color);
            p.moonExhaust = !!properties.moonExhaust;
            p.isComet = !!properties.isComet;
            p.isFreeze = !!properties.isFreeze;
        }
        return p;
    }

    release(p) {
        if (p && p.active) {
            p.active = false;
            this.freeList.push(p.poolIndex);
        }
    }

    clear() {
        this.freeList = [];
        for (let i = 0; i < this.maxSize; i++) {
            this.pool[i].active = false;
            this.freeList.push(i);
        }
    }
}

let particles = new ParticlePool(200);
let shockwaves = []; // (User feature 7: Shockwave rings)
let holyRays = []; // Holy rays effect for Excalibur
let totalShotsFired = 0; // (User feature 4: Stats tracking)
let totalCratersMade = 0; // (User feature 4: Stats tracking)
let planetTimeSpent = 0;
let bestTimes = {};
let gameMode = 'menu'; // 'menu', 'builder', 'gameplay'
// True while the main menu overlay is shown. gameMode can flip to 'gameplay'
// on the menu (clicks on the background fire missiles at the planet behind it),
// so gameplay-only extras like shooting stars must check this flag too.
let inMainMenu = true;
let planetRotation = 0;
let planetScale = 1.0;
let isPlanetSwitching = false;
let gameplayStarted = false;
let zoomProgress = 1.0;
const ZOOM_DURATION = 1; // seconds

function cubicEaseOut(t) {
    return 1 - Math.pow(1 - t, 3);
}

function cubicEaseIn(t) {
    return t * t * t;
}

// ─── Floating Text Object Pool (GC optimisation #6) ───────────────────────
// Pre-allocated objects are recycled via a free-list instead of being
// heap-allocated on every spawn and collected after expiry.
const _ftPool = [];        // free-list of reusable objects
const _ftActive = [];      // mirror of the floatingTexts array (same reference)

function _acquireFloatingText() {
    return _ftPool.length > 0 ? _ftPool.pop() : {};
}

function _releaseFloatingText(obj) {
    _ftPool.push(obj);
}

function addFloatingText(x, y, text, color = 'rgba(0, 240, 255,', duration = 0.5, maxOffset = 50, fontSize = 28, strokeWidth = 4.5) {
    const obj = _acquireFloatingText();
    obj.x          = x;
    obj.y          = y;
    obj.startY     = y;
    obj.text       = text;
    obj.color      = color;
    obj.life       = duration;
    obj.maxLife    = duration;
    obj.maxOffset  = maxOffset;
    obj.fontSize   = fontSize;
    obj.strokeWidth = strokeWidth;
    floatingTexts.push(obj);
}

let unlockNotificationTimeout = null;

function showUnlockNotification(text) {
    if (gameMode === 'menu' || currentPlanet === 'custom') return;
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

// Serialization queue to prevent race conditions during async state saves
let isSavingState = false;
const stateSaveQueue = [];

// Updaters that have been queued but are not yet known to be persisted. An
// updater stays here until its write has completed, so a teardown flush can
// re-apply anything still in flight (see flushSaveStateSync).
const unflushedUpdaters = [];

// Bumped by every synchronous flush. An async save that read its snapshot
// before a flush must not write it back afterwards — that snapshot predates the
// flush and would silently drop the other updaters the flush persisted.
let saveEpoch = 0;

function forgetUnflushed(updater) {
    const i = unflushedUpdaters.indexOf(updater);
    if (i !== -1) unflushedUpdaters.splice(i, 1);
}

async function queueSaveState(updater) {
    stateSaveQueue.push(updater);
    unflushedUpdaters.push(updater);
    if (isSavingState) return;

    isSavingState = true;
    const spinner = document.getElementById('save-spinner');
    if (spinner) spinner.classList.add('active');
    while (stateSaveQueue.length > 0) {
        const currentUpdater = stateSaveQueue.shift();
        try {
            const epoch = saveEpoch;
            const current = await getGameState();
            if (epoch !== saveEpoch) {
                // A flush ran while we were reading; it already persisted this
                // updater along with everything else outstanding.
                forgetUnflushed(currentUpdater);
                continue;
            }
            const state = (current && current.state) ? current.state : {};
            currentUpdater(state);
            await saveGameState(state);
        } catch (error) {
            console.warn('Failed to save state:', error.message);
        }
        forgetUnflushed(currentUpdater);
    }
    isSavingState = false;
    if (spinner) spinner.classList.remove('active');
}

// #3A — the save queue is async, so a write can still be in flight when the tab
// is suspended or closed; those microtasks never run and the progress is lost.
// Apply every outstanding updater synchronously against the stored state and
// write it in one pass. Safe to call more than once — it drains its own queue.
function flushSaveStateSync() {
    if (unflushedUpdaters.length === 0) return;

    const pending = unflushedUpdaters.splice(0, unflushedUpdaters.length);
    stateSaveQueue.length = 0;
    saveEpoch++;

    try {
        const raw = window.safeLocalStorage.getItem('annihilate_earth_save');
        const parsed = raw ? JSON.parse(raw) : null;
        let state = (parsed && typeof parsed === 'object') ? migrateSaveState(parsed) : null;
        if (!state || typeof state !== 'object') state = {};

        for (const updater of pending) {
            try {
                updater(state);
            } catch (e) {
                console.warn('Save updater failed during teardown flush:', e && e.message);
            }
        }

        state._version = SAVE_VERSION;
        window.safeLocalStorage.setItem('annihilate_earth_save', JSON.stringify(state));
    } catch (e) {
        console.warn('Failed to flush state on teardown:', e && e.message);
    }
}
window.flushSaveStateSync = flushSaveStateSync;

// Persistence functions for saving/loading unlocked planets
function saveUnlockedPlanets() {
    queueSaveState(state => {
        state.unlockedPlanets = unlockedPlanets;
    });
}

function saveBestTimes() {
    queueSaveState(state => {
        state.bestTimes = bestTimes;
    });
}

function saveOptions(options) {
    queueSaveState(state => {
        if (options.sfxVolume !== undefined) state.sfxVolume = options.sfxVolume;
        if (options.musicVolume !== undefined) state.musicVolume = options.musicVolume;
        if (options.language !== undefined) state.language = options.language;
        if (options.screenShake !== undefined) state.screenShake = options.screenShake;
        if (options.vibration !== undefined) state.vibration = options.vibration;
    });
}

let initiallyUnlockedPlanets = new Set(['earth']);
let weaponOrder = ['missile', 'nuke', 'laser', 'asteroid', 'gamma', 'mysterybox', 'moon', 'blackhole', 'sword', 'kraken', 'worm', 'fist', 'bowling', 'lightning', 'star', 'comet', 'drill'];
let unlockedWeapons = ['missile', 'nuke', 'laser', 'asteroid', 'gamma', 'mysterybox', 'moon', 'blackhole'];
let initiallyUnlockedWeapons = new Set(unlockedWeapons);
const ALL_LOCKED_WEAPONS = ['lightning', 'kraken', 'worm', 'fist', 'bowling', 'star', 'comet', 'sword', 'drill'];
let claimedPlanetSpinners = [];
let unlockedTooltipShown = false;
window.shouldShowUnlockTooltipOnNextPlanet = false;

function saveClaimedPlanetSpinners() {
    queueSaveState(state => {
        state.claimedPlanetSpinners = claimedPlanetSpinners;
    });
}


function isWeaponUnlocked(wid) {
    return unlockedWeapons.includes(wid);
}

function saveUnlockedWeapons() {
    queueSaveState(state => {
        state.unlockedWeapons = unlockedWeapons;
    });
    try {
        const saved = window.safeLocalStorage.getItem('annihilate_earth_save');
        const state = saved ? JSON.parse(saved) : {};
        state.unlockedWeapons = unlockedWeapons;
        window.safeLocalStorage.setItem('annihilate_earth_save', JSON.stringify(state));
    } catch (e) {
        console.warn('Failed to save unlocked weapons immediately:', e);
    }
}

function saveUnlockedTooltipShown() {
    queueSaveState(state => {
        state.unlockedTooltipShown = unlockedTooltipShown;
    });
    try {
        const saved = window.safeLocalStorage.getItem('annihilate_earth_save');
        const state = saved ? JSON.parse(saved) : {};
        state.unlockedTooltipShown = unlockedTooltipShown;
        window.safeLocalStorage.setItem('annihilate_earth_save', JSON.stringify(state));
    } catch (e) {
        console.warn('Failed to save unlocked tooltip state:', e);
    }
}

function unlockRandomWeapon() {
    const lockedRemaining = ALL_LOCKED_WEAPONS.filter(wid => !unlockedWeapons.includes(wid));
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

        if (!unlockedTooltipShown) {
            unlockedTooltipShown = true;
            saveUnlockedTooltipShown();
            const isVictoryScreen = document.getElementById('victory-screen') && document.getElementById('victory-screen').classList.contains('show');
            if (isVictoryScreen || (typeof victoryTriggered !== 'undefined' && victoryTriggered)) {
                window.shouldShowUnlockTooltipOnNextPlanet = true;
            } else {
                if (typeof window.showNewWeaponUnlockTooltip === 'function') {
                    window.showNewWeaponUnlockTooltip();
                }
            }
        }

        const btn = document.getElementById(`btn-${wid}`);
        const name = btn ? btn.querySelector('.weapon-name').innerText.replace('\n', ' ') : wid.toUpperCase();
        const icon = btn ? btn.querySelector('.weapon-icon').innerText : '⚡';
        const t = translations[currentLanguage] || translations['en'];
        const unlockMsg = (t.weaponUnlocked || '{icon} {name} UNLOCKED!').replace('{icon}', icon).replace('{name}', name);
        showUnlockNotification(unlockMsg);
        return true;
    }
    return false;
}

function saveWeaponOrder() {
    queueSaveState(state => {
        state.weaponOrder = weaponOrder;
    });
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
    if (typeof window.updateWeaponScrollButtons === 'function') {
        window.updateWeaponScrollButtons();
    }
}

async function loadUnlockedPlanets() {
    try {
        const response = await getGameState();
        if (response.state) {
            if (response.state.weaponOrder) {
                weaponOrder = response.state.weaponOrder;
                if (!weaponOrder.includes('drill')) {
                    weaponOrder.push('drill');
                }
                // Enforce that 'lightning' is positioned after 'bowling' in weaponOrder
                const lightningIdx = weaponOrder.indexOf('lightning');
                const bowlingIdx = weaponOrder.indexOf('bowling');
                if (lightningIdx !== -1 && bowlingIdx !== -1 && lightningIdx < bowlingIdx) {
                    weaponOrder.splice(lightningIdx, 1);
                    const newBowlingIdx = weaponOrder.indexOf('bowling');
                    weaponOrder.splice(newBowlingIdx + 1, 0, 'lightning');
                }
            }
            if (response.state.unlockedWeapons) {
                unlockedWeapons = response.state.unlockedWeapons;
                if (!unlockedWeapons.includes('mysterybox')) {
                    unlockedWeapons.push('mysterybox');
                }
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
            if (response.state.claimedPlanetSpinners) {
                claimedPlanetSpinners = response.state.claimedPlanetSpinners;
            }
            if (response.state.unlockedTooltipShown !== undefined) {
                unlockedTooltipShown = response.state.unlockedTooltipShown;
            }
        }
        updateWeaponOrderOnUnlock();
    } catch (error) {
        console.warn('Failed to load unlocked planets:', error.message);
    }
}

function refreshWeaponLocks() {
    const weaponsInfo = [
        { id: 'lightning', getCd: () => lightningCooldown, setCd: (v) => lightningCooldown = v, getInitCd: () => isInitialLightningCooldown, setInitCd: (v) => isInitialLightningCooldown = v },
        { id: 'kraken', getCd: () => krakenCooldown, setCd: (v) => krakenCooldown = v, getInitCd: () => isInitialKrakenCooldown, setInitCd: (v) => isInitialKrakenCooldown = v },
        { id: 'worm', getCd: () => wormCooldown, setCd: (v) => wormCooldown = v, getInitCd: () => isInitialWormCooldown, setInitCd: (v) => isInitialWormCooldown = v },
        { id: 'fist', getCd: () => fistCooldown, setCd: (v) => fistCooldown = v, getInitCd: () => isInitialFistCooldown, setInitCd: (v) => isInitialFistCooldown = v },
        { id: 'star', getCd: () => starCooldown, setCd: (v) => starCooldown = v, getInitCd: () => isInitialStarCooldown, setInitCd: (v) => isInitialStarCooldown = v },
        { id: 'comet', getCd: () => cometCooldown, setCd: (v) => cometCooldown = v, getInitCd: () => isInitialCometCooldown, setInitCd: (v) => isInitialCometCooldown = v },
        { id: 'sword', getCd: () => swordCooldown, setCd: (v) => swordCooldown = v, getInitCd: () => isInitialSwordCooldown, setInitCd: (v) => isInitialSwordCooldown = v },
        { id: 'drill', getCd: () => drillCooldown, setCd: (v) => drillCooldown = v, getInitCd: () => isInitialDrillCooldown, setInitCd: (v) => isInitialDrillCooldown = v },
        { id: 'bowling', getCd: () => bowlingCooldown, setCd: (v) => bowlingCooldown = v, getInitCd: () => isInitialBowlingCooldown, setInitCd: (v) => isInitialBowlingCooldown = v }
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

// Custom Planet Builder state variables
var customPlanetSize = 240;
var customPlanetDurability = 0;
var customPlanetHasCore = true;
var customPlanetRotationSpeed = 1.0;
var customPlanetEnforceCircle = true;

function getPlanetSize() {
    if (currentPlanet === 'earth') return 240;
    if (currentPlanet === 'neutron_star') return 188;
    if (currentPlanet === 'mars') return 201;
    if (currentPlanet === 'neptune') return 340;
    if (currentPlanet === 'jupiter') return 380;
    if (currentPlanet === 'sun') return 455;
    if (currentPlanet === 'custom') return customPlanetSize;
    return getConfigValue('planet.size', 245);
}

function getCoreRadius(planetSize, planetName = currentPlanet) {
    if (planetName === 'custom') {
        return customPlanetHasCore ? (25 + 0.4 * (planetSize / 2)) : 0;
    }
    if (planetName === 'neutron_star') return 0;
    return 25 + 0.4 * (planetSize / 2);
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
let weaponAmmo = {
    nuke: 18,
    bowling: 15,
    mysterybox: 4,
    drill: 5
};

function updateAmmoUI(type) {
    if (type) {
        if (weaponAmmo[type] === undefined) return;
        const ammoEl = document.getElementById(`ammo-${type}`);
        if (ammoEl) {
            ammoEl.textContent = weaponAmmo[type];
        }
        const btn = document.getElementById(`btn-${type}`);
        if (btn) {
            if (weaponAmmo[type] <= 0) {
                btn.classList.add('no-ammo');
            } else {
                btn.classList.remove('no-ammo');
            }
        }
    } else {
        updateAmmoUI('nuke');
        updateAmmoUI('bowling');
        updateAmmoUI('mysterybox');
        updateAmmoUI('drill');
    }
}

const STARTING_COOLDOWNS = {
    asteroid: 12.0,
    moon: 165.0,
    gammaBurst: 35.0,
    laser: 4.5,
    mysterybox: 85.0,
    blackhole: 255.0
};

let asteroidCooldown = STARTING_COOLDOWNS.asteroid;
let moonCooldown = STARTING_COOLDOWNS.moon;
let nukeCooldown = 0;
let missileCooldown = 0;
let gammaBurstCooldown = STARTING_COOLDOWNS.gammaBurst;
let laserCooldown = STARTING_COOLDOWNS.laser;
let swordCooldown = 0;
let mysteryboxCooldown = STARTING_COOLDOWNS.mysterybox;
let bowlingCooldown = 0;
let krakenCooldown = 0;
let wormCooldown = 0.0;
let blackholeCooldown = STARTING_COOLDOWNS.blackhole;
let fistCooldown = 0;
let starCooldown = 0;
let cometCooldown = 0;
let drillCooldown = 0;
let isInitialAsteroidCooldown = true;
let isInitialLaserCooldown = true;
let isInitialGammaCooldown = true;
let isInitialSwordCooldown = false;
let isInitialMysteryBoxCooldown = true;
let isInitialMoonCooldown = true;
let isInitialKrakenCooldown = false;
let isInitialBowlingCooldown = false;
let isInitialFistCooldown = false;
let isInitialWormCooldown = false;
let isInitialBlackholeCooldown = true;
let isInitialStarCooldown = false;
let isInitialCometCooldown = false;
let isInitialLightningCooldown = false;
let isInitialDrillCooldown = false;
let iceGrid = new Uint8Array(115 * 115);
let activeGammaBursts = [];
let activeSwords = [];
let activeBowlingBalls = [];
let activeKrakens = [];
let activeWorms = [];
let activeBlackHoles = [];
let activeFists = [];
let activeFistVisualExplosions = [];
let activeStars = [];
let activeStarProjectiles = [];
let activeMysteryBoxes = [];
let activeFallingDucks = [];
let activeDrills = [];
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
let laserPulseCount = 0;
let activeLightnings = [];
let lightningCooldown = 0;
let lightningHoldTime = 0;
let lightningQueue = [];
let lightningChargeFlashTimer = 0;
let lightningChargeShakeTimer = 0;
let lightningLastChargedCount = 0;



var coreBuffer32 = new Uint32Array(PLANET_CANVAS_SIZE * PLANET_CANVAS_SIZE);

// 2D Value Noise Grid.
// smoothNoise() wraps with a bitmask and indexes rows with a shift instead of
// % and *, so NOISE_SIZE must stay a power of two - these two derived constants
// keep that dependency explicit rather than hard-coded at the use sites.
const NOISE_SIZE = 128;
const NOISE_MASK = NOISE_SIZE - 1;          // 127
const NOISE_SHIFT = Math.log2(NOISE_SIZE);  // 7
const noiseGrid = new Float32Array(NOISE_SIZE * NOISE_SIZE);
for (let i = 0; i < noiseGrid.length; i++) {
    noiseGrid[i] = Math.random();
}

function smoothNoise(x, y) {
    const x1 = Math.floor(x) & NOISE_MASK;
    const y1 = Math.floor(y) & NOISE_MASK;
    const x2 = (x1 + 1) & NOISE_MASK;
    const y2 = (y1 + 1) & NOISE_MASK;

    const tx = x - Math.floor(x);
    const ty = y - Math.floor(y);

    const sx = tx * tx * (3 - 2 * tx);
    const sy = ty * ty * (3 - 2 * ty);

    const y1Shift = y1 << NOISE_SHIFT;
    const y2Shift = y2 << NOISE_SHIFT;

    const n11 = noiseGrid[y1Shift + x1];
    const n12 = noiseGrid[y1Shift + x2];
    const n21 = noiseGrid[y2Shift + x1];
    const n22 = noiseGrid[y2Shift + x2];

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
let currentScreenShakeSetting = 'full';
let vibrationEnabled = true;
