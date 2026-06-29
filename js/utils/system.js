// 3. Device & API Capability Detections
var isMobile = (function () {
    var ua = (typeof navigator !== 'undefined' && navigator.userAgent) || '';
    var uaMatch = /Mobi|Android|iPhone|iPad|iPod/i.test(ua);
    var smallScreen = typeof window !== 'undefined' && window.innerWidth <= 768;
    return uaMatch || smallScreen;
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

// 4. Configuration & State Persistence Helpers
const localStorageMock = {};
window.safeLocalStorage = {
    getItem: (key) => {
        try {
            return window.localStorage ? window.localStorage.getItem(key) : localStorageMock[key];
        } catch (e) {
            return localStorageMock[key];
        }
    },
    setItem: (key, value) => {
        try {
            if (window.localStorage) {
                window.localStorage.setItem(key, value);
            } else {
                localStorageMock[key] = value;
            }
        } catch (e) {
            localStorageMock[key] = value;
        }
    },
    removeItem: (key) => {
        try {
            if (window.localStorage) {
                window.localStorage.removeItem(key);
            } else {
                delete localStorageMock[key];
            }
        } catch (e) {
            delete localStorageMock[key];
        }
    }
};

const saveGameState = async (state) => {
    try {
        safeLocalStorage.setItem('annihilate_earth_save', JSON.stringify(state));
        return { success: true };
    } catch (e) {
        console.error('Failed to save to local storage', e);
        return { success: false };
    }
};

const getGameState = async () => {
    try {
        const saved = safeLocalStorage.getItem('annihilate_earth_save');
        return { state: saved ? JSON.parse(saved) : null, success: true };
    } catch (e) {
        console.error('Failed to load from local storage', e);
        return { state: null, success: false };
    }
};

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
