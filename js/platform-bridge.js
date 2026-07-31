window.PlatformBridge = {
    platform: 'crazygames',
    sdkLoaded: false,
    sdkReady: false,
    _loadingStarted: false,
    _loadingFinished: false,
    _initPromise: null,
    _gameplayActive: false,
    _adInProgress: false,
    hasAdblock: false,

    init: function() {
        if (this._initPromise) return this._initPromise;

        this._initPromise = new Promise((resolve) => {
            const finish = () => resolve();

            const script = document.createElement('script');
            script.src = 'https://sdk.crazygames.com/crazygames-sdk-v3.js';
            script.onload = () => {
                if (typeof window.CrazyGames === 'undefined' || !window.CrazyGames.SDK) {
                    console.warn("[PlatformBridge] CrazyGames SDK variable not found; using fallback mode.");
                    finish();
                    return;
                }

                window.CrazyGames.SDK.init()
                    .then(async () => {
                        this.sdkLoaded = true;
                        this.sdkReady = true;
                        console.log("[PlatformBridge] CrazyGames SDK successfully initialized.");

                        this._setupSettingsListener();
                        this._migrateLocalSaveToDataModule();
                        this._startLoadingIfNeeded();

                        try {
                            if (window.CrazyGames.SDK.ad && typeof window.CrazyGames.SDK.ad.hasAdblock === 'function') {
                                this.hasAdblock = !!(await window.CrazyGames.SDK.ad.hasAdblock());
                                window.hasAdblock = this.hasAdblock;
                                if (this.hasAdblock) {
                                    console.log("[PlatformBridge] Adblock detected; game remains fully playable.");
                                }
                            }
                        } catch (e) {
                            console.warn("[PlatformBridge] hasAdblock check failed:", e);
                        }

                        finish();
                    })
                    .catch((err) => {
                        console.warn("[PlatformBridge] CrazyGames SDK failed to initialize; using fallback mode.", err);
                        finish();
                    });
            };
            script.onerror = () => {
                console.warn("[PlatformBridge] CrazyGames SDK script failed to load; using fallback mode.");
                finish();
            };
            document.head.appendChild(script);
        });

        return this._initPromise;
    },

    _setupSettingsListener: function() {
        const game = window.CrazyGames.SDK.game;
        if (!game || typeof game.addSettingsChangeListener !== 'function') return;

        const applyMute = (settings) => {
            if (settings && settings.muteAudio !== undefined && window.soundManager) {
                window.soundManager.setCrazyGamesMuted(settings.muteAudio);
            }
        };

        if (game.settings) applyMute(game.settings);
        game.addSettingsChangeListener(applyMute);
    },

    _migrateLocalSaveToDataModule: function() {
        try {
            const data = window.CrazyGames.SDK.data;
            if (!data || typeof data.getItem !== 'function') return;
            const key = 'annihilate_earth_save';
            if (data.getItem(key) != null) return;
            let local = null;
            try { local = localStorage.getItem(key); } catch (e) { return; }
            if (local != null) {
                data.setItem(key, local);
                console.log("[PlatformBridge] Migrated local save into CrazyGames data module.");
            }
        } catch (e) {
            console.warn("[PlatformBridge] Save migration failed:", e);
        }
    },

    _startLoadingIfNeeded: function() {
        if (this._loadingStarted) return;
        if (!this.sdkReady || !window.CrazyGames.SDK.game) return;
        if (typeof window.CrazyGames.SDK.game.loadingStart !== 'function') return;

        window.CrazyGames.SDK.game.loadingStart();
        this._loadingStarted = true;
        console.log("[PlatformBridge] CrazyGames loadingStart triggered.");

        if (this._loadingFinished && typeof window.CrazyGames.SDK.game.loadingStop === 'function') {
            window.CrazyGames.SDK.game.loadingStop();
            console.log("[PlatformBridge] CrazyGames loadingStop triggered (deferred).");
        }
    },

    getDataStore: function() {
        if (this.sdkReady && window.CrazyGames && window.CrazyGames.SDK && window.CrazyGames.SDK.data) {
            return window.CrazyGames.SDK.data;
        }
        return null;
    },

    gameLoadingFinished: function() {
        this._loadingFinished = true;
        if (this.sdkReady && window.CrazyGames && window.CrazyGames.SDK && window.CrazyGames.SDK.game) {
            if (this._loadingStarted && typeof window.CrazyGames.SDK.game.loadingStop === 'function') {
                window.CrazyGames.SDK.game.loadingStop();
                console.log("[PlatformBridge] CrazyGames loadingStop triggered.");
            }
            // Re-apply mute in case soundManager was created after settings were first read
            try {
                const settings = window.CrazyGames.SDK.game.settings;
                if (settings && settings.muteAudio !== undefined && window.soundManager) {
                    window.soundManager.setCrazyGamesMuted(settings.muteAudio);
                }
            } catch (e) { }
        }
    },

    gameplayStart: function() {
        this._gameplayActive = true;
        if (this._adInProgress) return;
        if (this.sdkReady && window.CrazyGames && window.CrazyGames.SDK && window.CrazyGames.SDK.game) {
            if (typeof window.CrazyGames.SDK.game.gameplayStart === 'function') {
                window.CrazyGames.SDK.game.gameplayStart();
                console.log("[PlatformBridge] CrazyGames gameplayStart triggered.");
            }
        }
    },

    gameplayStop: function() {
        this._gameplayActive = false;
        if (this.sdkReady && window.CrazyGames && window.CrazyGames.SDK && window.CrazyGames.SDK.game) {
            if (typeof window.CrazyGames.SDK.game.gameplayStop === 'function') {
                window.CrazyGames.SDK.game.gameplayStop();
                console.log("[PlatformBridge] CrazyGames gameplayStop triggered.");
            }
        }
    },

    happytime: function() {
        if (this.sdkReady && window.CrazyGames && window.CrazyGames.SDK && window.CrazyGames.SDK.game) {
            if (typeof window.CrazyGames.SDK.game.happytime === 'function') {
                window.CrazyGames.SDK.game.happytime();
                console.log("[PlatformBridge] CrazyGames happytime triggered.");
            }
        }
    },

    reportGameCompletedPercentage: function(pct) {
        const value = Math.max(0, Math.min(100, Math.round(Number(pct) || 0)));
        if (this.sdkReady && window.CrazyGames && window.CrazyGames.SDK && window.CrazyGames.SDK.game) {
            if (typeof window.CrazyGames.SDK.game.reportGameCompletedPercentage === 'function') {
                window.CrazyGames.SDK.game.reportGameCompletedPercentage(value);
                console.log("[PlatformBridge] CrazyGames completion % reported:", value);
            }
        }
    },

    _pauseForAd: function() {
        this._adInProgress = true;
        window.gamePausedForAd = true;
        if (this._gameplayActive && this.sdkReady && window.CrazyGames && window.CrazyGames.SDK && window.CrazyGames.SDK.game) {
            if (typeof window.CrazyGames.SDK.game.gameplayStop === 'function') {
                window.CrazyGames.SDK.game.gameplayStop();
            }
        }
        if (window.soundManager && window.soundManager.context) {
            window.soundManager.context.suspend().catch(() => {});
        }
    },

    _resumeAfterAd: function() {
        this._adInProgress = false;
        window.gamePausedForAd = false;
        if (window.soundManager && window.soundManager.context && window.soundManager.isInitialized) {
            if (!document.hidden) {
                window.soundManager.context.resume().catch(() => {});
            }
        }
        if (this._gameplayActive && this.sdkReady && window.CrazyGames && window.CrazyGames.SDK && window.CrazyGames.SDK.game) {
            if (typeof window.CrazyGames.SDK.game.gameplayStart === 'function') {
                window.CrazyGames.SDK.game.gameplayStart();
            }
        }
    },

    _isLocalDev: function() {
        const hostname = (window.location.hostname || '').toLowerCase();
        return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '';
    },

    showAdBreak: function(onComplete) {
        console.log("[PlatformBridge] CrazyGames commercial break requested.");

        let adFinished = false;
        let transitionInFinished = false;
        let resumed = false;
        let adStarted = false;

        const tryResume = () => {
            if (adFinished && transitionInFinished && !resumed) {
                resumed = true;
                if (adStarted) {
                    this._resumeAfterAd();
                } else {
                    window.gamePausedForAd = false;
                }
                if (onComplete) onComplete();
                requestAnimationFrame(() => this._runTransitionOut());
            }
        };

        // Block input during transition even before ad starts
        window.gamePausedForAd = true;

        this._runTransitionIn(() => {
            transitionInFinished = true;
            tryResume();
        });

        const onAdComplete = () => {
            adFinished = true;
            tryResume();
        };

        if (this.sdkReady && window.CrazyGames && window.CrazyGames.SDK && window.CrazyGames.SDK.ad) {
            window.CrazyGames.SDK.ad.requestAd("midgame", {
                adStarted: () => {
                    console.log("[PlatformBridge] CrazyGames midgame ad started.");
                    adStarted = true;
                    this._pauseForAd();
                },
                adFinished: () => {
                    console.log("[PlatformBridge] CrazyGames midgame ad completed successfully.");
                    window.lastAdPlayTime = Date.now();
                    onAdComplete();
                },
                adError: (error) => {
                    console.warn("[PlatformBridge] CrazyGames midgame ad failed or was skipped:", error);
                    onAdComplete();
                }
            });
        } else {
            console.log("[PlatformBridge] Fallback: No CrazyGames SDK loaded, skipping commercial break.");
            onAdComplete();
        }
    },

    showRewardedAd: function(onComplete) {
        console.log("[PlatformBridge] CrazyGames rewarded ad break requested.");

        let adFinished = false;
        let transitionInFinished = false;
        let rewardGranted = false;
        let resumed = false;
        let adStarted = false;

        const tryResume = () => {
            if (adFinished && transitionInFinished && !resumed) {
                resumed = true;
                if (adStarted) {
                    this._resumeAfterAd();
                } else {
                    window.gamePausedForAd = false;
                }
                if (rewardGranted && onComplete) onComplete();
                requestAnimationFrame(() => this._runTransitionOut());
            }
        };

        window.gamePausedForAd = true;

        this._runTransitionIn(() => {
            transitionInFinished = true;
            tryResume();
        });

        const onAdComplete = (success) => {
            rewardGranted = success;
            adFinished = true;
            tryResume();
        };

        if (this.sdkReady && window.CrazyGames && window.CrazyGames.SDK && window.CrazyGames.SDK.ad) {
            window.CrazyGames.SDK.ad.requestAd("rewarded", {
                adStarted: () => {
                    console.log("[PlatformBridge] CrazyGames rewarded ad started.");
                    adStarted = true;
                    this._pauseForAd();
                },
                adFinished: () => {
                    console.log("[PlatformBridge] CrazyGames rewarded ad completed. Granting reward.");
                    onAdComplete(true);
                },
                adError: (error) => {
                    console.warn("[PlatformBridge] CrazyGames rewarded ad failed or was skipped:", error);
                    onAdComplete(false);
                }
            });
        } else if (this._isLocalDev()) {
            console.log("[PlatformBridge] Fallback (local dev): granting mock rewarded ad.");
            onAdComplete(true);
        } else {
            console.log("[PlatformBridge] Fallback: No CrazyGames SDK; rewarded ad unavailable.");
            onAdComplete(false);
        }
    },

    _runTransitionIn: function(onMidpoint) {
        let overlay = document.getElementById('ad-transition-overlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'ad-transition-overlay';

            const style = document.createElement('style');
            style.textContent = `
                #ad-transition-overlay {
                    position: fixed;
                    top: 0;
                    left: -40vw;
                    width: 180vw;
                    height: 100vh;
                    background: #000000;
                    z-index: 999999;
                    pointer-events: all;
                    border-right: 6px solid #00ffff;
                    box-shadow: 0 0 30px rgba(0, 255, 255, 0.8);
                    transform: skewX(-20deg) translateX(-100%);
                }
                .ad-transition-in {
                    animation: adTransitionIn 0.42s cubic-bezier(0.25, 1, 0.5, 1) forwards;
                }
                .ad-transition-out {
                    animation: adTransitionOut 0.42s cubic-bezier(0.25, 1, 0.5, 1) forwards;
                }
                @keyframes adTransitionIn {
                    0% {
                        transform: skewX(-20deg) translateX(-100%);
                    }
                    100% {
                        transform: skewX(-20deg) translateX(0%);
                    }
                }
                @keyframes adTransitionOut {
                    0% {
                        transform: skewX(-20deg) translateX(0%);
                    }
                    100% {
                        transform: skewX(-20deg) translateX(100%);
                    }
                }
            `;
            document.head.appendChild(style);
            document.body.appendChild(overlay);
        }
        overlay.style.display = 'block';
        overlay.className = '';
        overlay.style.transform = 'skewX(-20deg) translateX(-100%)';
        overlay.offsetHeight;
        overlay.classList.add('ad-transition-in');
        setTimeout(() => {
            if (onMidpoint) onMidpoint();
        }, 420);
    },

    _runTransitionOut: function() {
        const overlay = document.getElementById('ad-transition-overlay');
        if (!overlay) return;
        overlay.style.display = 'block';
        overlay.className = '';
        overlay.style.transform = 'skewX(-20deg) translateX(0%)';
        overlay.offsetHeight;
        overlay.classList.add('ad-transition-out');
        setTimeout(() => {
            overlay.style.display = 'none';
            overlay.className = '';
        }, 420);
    }
};

// Kick off SDK load immediately so loadingStart can fire as early as possible.
window.PlatformBridge.init();
