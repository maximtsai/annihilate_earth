// No callback from requestAd within this window means the request never
// launched (blocked frame, hung SDK). Treat it as a failure rather than leaving
// the game locked behind the ad overlay forever.
const AD_REQUEST_TIMEOUT_MS = 10000;
// adStarted fired but the ad never reported an end. Generous, since a real ad
// plus its end card can legitimately run a while.
const AD_MAX_DURATION_MS = 120000;
// The SDK throttles gameplayStart/gameplayStop at 1s per method and DISCARDS
// calls inside that window, so pacing has to happen on our side.
const GAMEPLAY_CALL_THROTTLE_MS = 1100;

window.PlatformBridge = {
    platform: 'crazygames',
    sdkLoaded: false,
    sdkReady: false,
    _loadingStarted: false,
    _loadingFinished: false,
    _initPromise: null,
    _gameplayActive: false,
    _adInProgress: false,
    _adRequestPending: false,
    hasAdblock: false,

    // Gameplay signalling state. `_gameplayActive` is what the GAME wants;
    // `_sdkGameplayRunning` is what the SDK has actually been told. They diverge
    // during ads and while a throttled call is waiting to be re-issued.
    _sdkGameplayRunning: false,
    _gameplaySyncTimer: null,
    _lastGameplayCallAt: { start: 0, stop: 0 },

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
                        // Any gameplayStart/Stop the game issued while the SDK
                        // was still initialising was a no-op; reconcile now.
                        this._syncGameplayState();

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

    // Reconciles the SDK's gameplay state with what the game wants. Never calls
    // the SDK when it is already in the desired state (duplicate calls are
    // logged as errors and dropped), and reschedules itself when the 1s
    // per-method throttle would swallow the call — otherwise a quick menu
    // toggle leaves CrazyGames believing gameplay is running.
    _syncGameplayState: function() {
        if (this._gameplaySyncTimer) {
            clearTimeout(this._gameplaySyncTimer);
            this._gameplaySyncTimer = null;
        }

        const game = (this.sdkReady && window.CrazyGames && window.CrazyGames.SDK)
            ? window.CrazyGames.SDK.game : null;
        if (!game) return;

        // During an ad the SDK must see gameplay stopped regardless of intent.
        const desired = this._adInProgress ? false : this._gameplayActive;
        if (desired === this._sdkGameplayRunning) return;

        const which = desired ? 'start' : 'stop';
        const fn = desired ? game.gameplayStart : game.gameplayStop;
        if (typeof fn !== 'function') return;

        const now = Date.now();
        const waited = now - this._lastGameplayCallAt[which];
        if (waited < GAMEPLAY_CALL_THROTTLE_MS) {
            this._gameplaySyncTimer = setTimeout(
                () => this._syncGameplayState(),
                GAMEPLAY_CALL_THROTTLE_MS - waited
            );
            return;
        }

        this._lastGameplayCallAt[which] = now;
        this._sdkGameplayRunning = desired;
        fn.call(game);
        console.log("[PlatformBridge] CrazyGames gameplay" + (desired ? 'Start' : 'Stop') + " triggered.");
    },

    gameplayStart: function() {
        this._gameplayActive = true;
        this._syncGameplayState();
    },

    gameplayStop: function() {
        this._gameplayActive = false;
        this._syncGameplayState();
    },

    // Called before requesting an ad from a state where gameplay is already
    // stopped (a popup, the victory screen), so the ad's resume knows to hand
    // control back to gameplay afterwards.
    resumeGameplayAfterAd: function() {
        this._gameplayActive = true;
        this._syncGameplayState();
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
        this._syncGameplayState();   // forces the SDK to gameplayStop if it isn't already
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
        this._syncGameplayState();   // restores gameplayStart if the game still wants it
    },

    _isLocalDev: function() {
        const hostname = (window.location.hostname || '').toLowerCase();
        return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '';
    },

    // Shared driver for both ad types. `onSettled(success)` always runs exactly
    // once — on completion, on failure, and on either watchdog firing — so no
    // caller can be left waiting on a callback that never arrives.
    _runAd: function(type, onSettled) {
        let adResolved = false;
        let settledSuccess = false;
        let transitionInFinished = false;
        let resumed = false;
        let adStarted = false;
        let requestTimer = null;
        let durationTimer = null;

        const clearTimers = () => {
            if (requestTimer) { clearTimeout(requestTimer); requestTimer = null; }
            if (durationTimer) { clearTimeout(durationTimer); durationTimer = null; }
        };

        const tryResume = () => {
            if (!adResolved || !transitionInFinished || resumed) return;
            resumed = true;
            this._adRequestPending = false;
            if (adStarted) {
                this._resumeAfterAd();
            } else {
                window.gamePausedForAd = false;
            }
            onSettled(settledSuccess);
            requestAnimationFrame(() => this._runTransitionOut());
        };

        const settle = (success) => {
            if (adResolved) return;
            adResolved = true;
            settledSuccess = success;
            clearTimers();
            tryResume();
        };

        this._adRequestPending = true;
        window.gamePausedForAd = true;   // block input during the transition too

        this._runTransitionIn(() => {
            transitionInFinished = true;
            tryResume();
        });

        // Local dev mock comes first: a developer running with an adblocker
        // extension still needs the reward path to be testable.
        if (type === 'rewarded' && this._isLocalDev() &&
            !(this.sdkReady && window.CrazyGames && window.CrazyGames.SDK && window.CrazyGames.SDK.ad)) {
            console.log("[PlatformBridge] Fallback (local dev): granting mock rewarded ad.");
            settle(true);
            return;
        }

        // Known-unfillable: don't make the player sit through the transition
        // waiting for an adError that is already certain.
        if (this.hasAdblock) {
            console.log("[PlatformBridge] Adblock detected; skipping " + type + " ad request.");
            settle(false);
            return;
        }

        if (this.sdkReady && window.CrazyGames && window.CrazyGames.SDK && window.CrazyGames.SDK.ad) {
            // Watchdog: the request never launched at all.
            requestTimer = setTimeout(() => {
                console.warn("[PlatformBridge] " + type + " ad request timed out with no response; continuing.");
                settle(false);
            }, AD_REQUEST_TIMEOUT_MS);

            try {
                window.CrazyGames.SDK.ad.requestAd(type, {
                    adStarted: () => {
                        console.log("[PlatformBridge] CrazyGames " + type + " ad started.");
                        adStarted = true;
                        if (requestTimer) { clearTimeout(requestTimer); requestTimer = null; }
                        // Second watchdog: the ad started but never reported an end.
                        durationTimer = setTimeout(() => {
                            console.warn("[PlatformBridge] " + type + " ad exceeded max duration with no end event; resuming.");
                            settle(false);
                        }, AD_MAX_DURATION_MS);
                        this._pauseForAd();
                    },
                    adFinished: () => {
                        console.log("[PlatformBridge] CrazyGames " + type + " ad completed successfully.");
                        if (type === 'midgame') window.lastAdPlayTime = Date.now();
                        settle(true);
                    },
                    adError: (error) => {
                        // Per CrazyGames requirements: on adError the player is
                        // NOT rewarded, but the game must continue normally.
                        console.warn("[PlatformBridge] CrazyGames " + type + " ad failed or was skipped:", error);
                        settle(false);
                    }
                });
            } catch (e) {
                console.warn("[PlatformBridge] requestAd threw synchronously:", e);
                settle(false);
            }
        } else {
            console.log("[PlatformBridge] Fallback: No CrazyGames SDK loaded; skipping " + type + " ad.");
            settle(type === 'midgame');
        }
    },

    showAdBreak: function(onComplete) {
        console.log("[PlatformBridge] CrazyGames commercial break requested.");
        if (this._adInProgress || this._adRequestPending) {
            console.warn("[PlatformBridge] Ad already in progress; ignoring duplicate request.");
            return;
        }
        // A midgame break always continues the game, filled or not.
        this._runAd('midgame', () => {
            if (onComplete) onComplete();
        });
    },

    // onComplete runs only when the reward was actually earned. onFailed (if
    // given) runs otherwise, so callers can roll back any UI they locked.
    showRewardedAd: function(onComplete, onFailed) {
        console.log("[PlatformBridge] CrazyGames rewarded ad break requested.");
        if (this._adInProgress || this._adRequestPending) {
            console.warn("[PlatformBridge] Ad already in progress; ignoring duplicate request.");
            if (onFailed) onFailed();
            return;
        }
        this._runAd('rewarded', (success) => {
            if (success) {
                if (onComplete) onComplete();
            } else if (onFailed) {
                onFailed();
            }
        });
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
