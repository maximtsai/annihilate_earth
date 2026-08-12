// 0. Global error reporting
// On a portal (Poki/CrazyGames) there is no devtools access, and a single
// uncaught exception in the game loop otherwise freezes the game silently.
// Record the most recent errors so they can be inspected, and throttle logging
// so a per-frame failure can't flood the console.
(function () {
    var errorLog = [];
    var lastLoggedAt = 0;
    var suppressed = 0;

    function reportGameError(source, error) {
        var now = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
        var entry = {
            source: source,
            message: (error && error.message) ? error.message : String(error),
            stack: (error && error.stack) ? error.stack : null,
            time: Date.now()
        };
        errorLog.push(entry);
        if (errorLog.length > 20) errorLog.shift();

        // Throttle console output to at most once every 2s to avoid flooding.
        if (now - lastLoggedAt > 2000) {
            if (suppressed > 0) {
                console.warn('[GameError] ' + suppressed + ' additional error(s) suppressed.');
                suppressed = 0;
            }
            console.error('[GameError] (' + source + ')', error);
            lastLoggedAt = now;
        } else {
            suppressed++;
        }
    }

    window.reportGameError = reportGameError;
    // Exposed for manual inspection, e.g. `copy(__gameErrors)` in a console.
    window.__gameErrors = errorLog;

    window.addEventListener('error', function (e) {
        reportGameError('window.error', e.error || e.message);
    });
    window.addEventListener('unhandledrejection', function (e) {
        reportGameError('unhandledrejection', e.reason);
    });
})();

// 3. Device & API Capability Detections
// Two-tier device classification: `mobile` (any phone/tablet-class device, however
// fast) and `weak` (the slow end - reduced particle/effect budgets).
// Detection is never gated on the UA alone: iPad, ChromeOS and embedded webviews
// ship desktop UA strings, so touch/pointer/screen signals are queried first and
// the UA is only used to widen the result.
//
// Touch alone is NOT enough: touchscreen laptops and 2-in-1s report
// maxTouchPoints > 1 but are full-power desktops with a mouse. `mobile` drives
// glow-disable and finger-sized UI (bigger meters, bigger floating text), so a
// false positive there is a visible regression, not just a perf tradeoff.
// Requiring a coarse *primary* pointer alongside touch keeps iPad in and
// touch-capable desktops out.
var deviceTier = (function () {
    var ua = (typeof navigator !== 'undefined' && navigator.userAgent) || '';
    var hasTouch = typeof navigator !== 'undefined' && typeof navigator.maxTouchPoints === 'number' && navigator.maxTouchPoints > 1;
    var coarsePointer = typeof window !== 'undefined' && typeof window.matchMedia === 'function' && !!window.matchMedia('(pointer: coarse)').matches;
    var smallScreen = typeof window !== 'undefined' && window.innerWidth <= 768;
    var uaMobile = /Mobi|Android|iPhone|iPod/i.test(ua);
    var mobile = uaMobile || (hasTouch && coarsePointer) || smallScreen;

    var weak = false;
    if (typeof navigator !== 'undefined') {
        if (navigator.hardwareConcurrency && navigator.hardwareConcurrency < 4) weak = true;
        if (navigator.deviceMemory && navigator.deviceMemory < 2) weak = true;
    }
    // Very small viewport = ancient/entry-level device (modern phones are 360-430 CSS px wide)
    if (typeof window !== 'undefined' && window.innerWidth <= 320) weak = true;

    return { mobile: mobile, weak: weak };
})();
var isMobile = deviceTier.mobile;
var isWeakDevice = deviceTier.weak;
// Effect budget multiplier (1.0 = full effects). Applied at emission sites, not per call.
// The `weak` thresholds (<4 cores, <2GB, <=320px) almost never fire on hardware
// shipping today, so mid-range phones get their own middle tier rather than
// falling through to the full desktop budget.
var particleBudget = isWeakDevice ? 0.6 : (isMobile ? 0.8 : 1);

// UA-only mobile detection. isMobile above also counts narrow desktop
// windows as mobile (needed for touch-target sizing), but UI features that
// must only appear on real handheld devices need a stricter check.
var isMobileUA = (function () {
    var ua = (typeof navigator !== 'undefined' && navigator.userAgent) || '';
    return /Mobi|Android|iPhone|iPad|iPod/i.test(ua);
})();

function detectGlowSupport() {
    // Heuristic for extremely low-end devices: return false early if single-core or RAM < 1GB
    if (typeof navigator !== 'undefined') {
        if (navigator.hardwareConcurrency && navigator.hardwareConcurrency < 2) {
            return false;
        }
        if (navigator.deviceMemory && navigator.deviceMemory < 1) {
            return false;
        }
    }

    const testCanvas = document.createElement('canvas');
    testCanvas.width = 10;
    testCanvas.height = 10;
    const testCtx = testCanvas.getContext('2d');
    if (!testCtx) return false;

    // Set up a shadow/glow
    testCtx.shadowColor = 'rgba(255, 0, 0, 1)';
    testCtx.shadowBlur = 4;
    testCtx.shadowOffsetX = 10; // Draw offscreen to isolate the shadow
    testCtx.shadowOffsetY = 0;

    // Draw a 1x1 solid rectangle that casts the shadow onto the visible canvas area
    testCtx.fillStyle = 'black';
    testCtx.fillRect(-10, 4, 1, 1);

    try {
        // Read pixel data from the shadow area (which should have semi-transparent pixels)
        const imgData = testCtx.getImageData(2, 4, 1, 1).data;
        const alpha = imgData[3];

        // If alpha is 255 (fully opaque) or 0 (fully transparent), 
        // the smooth shadow gradient failed to render.
        return alpha > 0 && alpha < 255;
    } catch (e) {
        return false;
    }
}

function toggleFullscreen(enable) {
    if (enable) {
        const docEl = document.documentElement;
        if (docEl.requestFullscreen) {
            docEl.requestFullscreen();
        } else if (docEl.mozRequestFullScreen) {
            docEl.mozRequestFullScreen();
        } else if (docEl.webkitRequestFullscreen) {
            docEl.webkitRequestFullscreen();
        } else if (docEl.msRequestFullscreen) {
            docEl.msRequestFullscreen();
        }
    } else {
        if (document.exitFullscreen) {
            document.exitFullscreen();
        } else if (document.mozCancelFullScreen) {
            document.mozCancelFullScreen();
        } else if (document.webkitExitFullscreen) {
            document.webkitExitFullscreen();
        } else if (document.msExitFullscreen) {
            document.msExitFullscreen();
        }
    }
}

// Safe storage wrapper — uses the CrazyGames SDK data store exclusively.
// There is no localStorage fallback: when the SDK is unavailable (adblocker,
// offline, rehosted domain) writes are no-ops and reads return null rather than
// persisting anywhere off-platform.
function getPreferredStorage() {
    try {
        if (window.PlatformBridge && typeof window.PlatformBridge.getDataStore === 'function') {
            const data = window.PlatformBridge.getDataStore();
            if (data && typeof data.getItem === 'function') return data;
        }
    } catch (e) { }
    return null;
}

window.safeLocalStorage = {
    getItem: function(key) {
        try {
            const store = getPreferredStorage();
            if (store) return store.getItem(key);
        } catch (e) { }
        return null;
    },
    setItem: function(key, value) {
        const str = String(value);
        try {
            const store = getPreferredStorage();
            if (store) {
                store.setItem(key, str);
                return;
            }
            console.warn('[Save] CrazyGames SDK data store unavailable; save not persisted.');
        } catch (e) {
            console.warn('[Save] Failed to write to CrazyGames SDK data store.', e);
        }
    },
    removeItem: function(key) {
        try {
            const store = getPreferredStorage();
            if (store) store.removeItem(key);
        } catch (e) { }
    }
};

// 4. Configuration & State Persistence Helpers

// Current save schema version. Bump this whenever the shape of the saved state
// changes, and add a corresponding step to SAVE_MIGRATIONS so returning players'
// saves are upgraded on load instead of crashing or silently losing progress.
const SAVE_VERSION = 2;

// Stepwise migrations. Each key N is a function that migrates a save from
// version N to version N+1, mutating and returning the state object.
// Legacy saves (written before versioning existed) have no `_version` field and
// are treated as version 0.
const SAVE_MIGRATIONS = {
    // 0 -> 1: original un-versioned save. Shape was already current, so this
    // only stamps the version.
    0: (state) => state,
    // 1 -> 2: weaponOrder is derived from unlockedWeapons at runtime and is no
    // longer stored. Drop the stale copy so it can't be mistaken for data.
    1: (state) => { delete state.weaponOrder; return state; }
};

// Apply migrations in sequence from the save's version up to SAVE_VERSION.
// Returns the (possibly mutated) state, or null if it can't be migrated safely.
function migrateSaveState(state) {
    if (!state || typeof state !== 'object') return null;

    let version = typeof state._version === 'number' ? state._version : 0;
    while (version < SAVE_VERSION) {
        const migrate = SAVE_MIGRATIONS[version];
        if (typeof migrate !== 'function') {
            console.warn('No save migration from version ' + version + '; keeping state as-is.');
            break;
        }
        try {
            state = migrate(state) || state;
        } catch (e) {
            console.error('Save migration from version ' + version + ' failed', e);
            break;
        }
        version++;
    }
    state._version = version;
    return state;
}

const SAVE_KEY = 'annihilate_earth_save';

// The parsed save is held in memory and treated as authoritative for the
// session. Without this, every read hit the storage backend again: on
// CrazyGames that meant a stream of SDK.data Get calls during boot alone.
let _saveCache = null;
let _saveCacheLoaded = false;
// Serialized form of what is already persisted (minus the timestamp), so a
// save that changes nothing can be skipped instead of issuing a write.
let _persistedJson = null;

function parseSave(raw) {
    if (!raw) return null;
    try {
        const parsed = JSON.parse(raw);
        return (parsed && typeof parsed === 'object') ? parsed : null;
    } catch (e) {
        return null;
    }
}

// _savedAt changes on every write by definition, so it must not participate in
// the "did anything actually change?" comparison.
function serializeForCompare(state) {
    const copy = Object.assign({}, state);
    delete copy._savedAt;
    return JSON.stringify(copy);
}

// Returns the live save object (or null if the player has none yet). The
// CrazyGames SDK data module is synchronous — it returns immediately,
// debouncing only its own network sync — so there is no async step in the
// save path.
function readGameState() {
    if (_saveCacheLoaded) return _saveCache;

    try {
        const saved = parseSave(window.safeLocalStorage.getItem(SAVE_KEY));
        _saveCache = saved ? migrateSaveState(saved) : null;
        _persistedJson = _saveCache ? serializeForCompare(_saveCache) : null;
    } catch (e) {
        console.error('Failed to load state', e);
        _saveCache = null;
        _persistedJson = null;
    }
    _saveCacheLoaded = true;
    return _saveCache;
}

// Persists the save. Returns once it is durably written, so there is never a
// pending write to flush or serialize against.
function saveGameState(state) {
    try {
        const toSave = Object.assign({}, state, { _version: SAVE_VERSION });
        delete toSave._savedAt;
        const compare = JSON.stringify(toSave);

        // The cache tracks the live object either way, so an unchanged save
        // still "succeeds" — it just doesn't touch storage.
        _saveCache = state;
        _saveCacheLoaded = true;
        if (compare === _persistedJson) return { success: true, skipped: true };

        toSave._savedAt = Date.now();
        window.safeLocalStorage.setItem(SAVE_KEY, JSON.stringify(toSave));
        _persistedJson = compare;
        return { success: true };
    } catch (e) {
        console.error('Failed to save state', e);
        return { success: false };
    }
}

// Drops the in-memory copy so the next read goes back to storage. Needed when
// the backend can change underneath us — CrazyGames syncs cloud data on login.
function invalidateGameStateCache() {
    _saveCache = null;
    _saveCacheLoaded = false;
    _persistedJson = null;
}

// Read the save, apply a change, write it back. This is the entire save API —
// every saveX() helper in state.js is a one-line call to it.
function updateGameState(updater) {
    const state = readGameState() || {};
    updater(state);
    return saveGameState(state);
}

window.readGameState = readGameState;
window.saveGameState = saveGameState;
window.updateGameState = updateGameState;
window.invalidateGameStateCache = invalidateGameStateCache;

function getConfigValue(path, defaultValue) {
    if (!window.gameConfig) return defaultValue;
    const parts = path.split('.');
    let current = window.gameConfig;
    for (const part of parts) {
        if (current[part] === undefined) return defaultValue;
        current = current[part];
    }
    return current;
}
