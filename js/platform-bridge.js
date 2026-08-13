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
// The whole SDK handshake — script load, init(), hasAdblock(), getUser() — is
// awaited before the game boots. Every step is a promise the SDK owns, and one
// that never settles would hold the loading screen up forever, so cap the wait
// and continue in fallback mode. Late arrivals still populate sdkReady and the
// rest; they just stop gating the boot.
const SDK_INIT_TIMEOUT_MS = 8000;
// Dev toggle: when true, every ad request (rewarded or midgame) settles
// instantly. Rewarded ads grant the reward immediately, so every reward
// button skips straight to its payout. Flip back to false to restore real ads.
const SKIP_ADS = true;

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
    _sdkLocale: null,
    // Whether the CrazyGames user is signed in. Gates the save reconciliation
    // in system.js: the cloud copy is authoritative when signed in, because the
    // SDK syncs it across devices.
    userSignedIn: false,

    // Gameplay signalling state. `_gameplayActive` is what the GAME wants;
    // `_sdkGameplayRunning` is what the SDK has actually been told. They diverge
    // during ads and while a throttled call is waiting to be re-issued.
    _sdkGameplayRunning: false,
    _gameplaySyncTimer: null,
    _lastGameplayCallAt: { start: 0, stop: 0 },
    _audioSuspendedForAd: false,

    init: function() {
        if (this._initPromise) return this._initPromise;

        this._initPromise = new Promise((resolve) => {
            let initTimer = setTimeout(() => {
                initTimer = null;
                console.warn("[PlatformBridge] CrazyGames SDK handshake exceeded " +
                    SDK_INIT_TIMEOUT_MS + "ms; booting without waiting for it.");
                resolve();
            }, SDK_INIT_TIMEOUT_MS);

            const finish = () => {
                if (initTimer) { clearTimeout(initTimer); initTimer = null; }
                resolve();
            };

            const script = document.createElement('script');
            script.src = 'https://sdk.crazygames.com/crazygames-sdk-v3.js';
            script.onload = () => {
                if (typeof window.CrazyGames === 'undefined' || !window.CrazyGames.SDK ||
                    typeof window.CrazyGames.SDK.init !== 'function') {
                    console.warn("[PlatformBridge] CrazyGames SDK not usable; using fallback mode.");
                    finish();
                    return;
                }

                // Guard against a synchronous throw: if init() is missing or
                // throws, finish() never runs and the game hangs on
                // `await bridgeReady` with no way to recover.
                let initResult;
                try {
                    initResult = window.CrazyGames.SDK.init();
                } catch (e) {
                    console.warn("[PlatformBridge] CrazyGames SDK init threw synchronously; using fallback mode.", e);
                    finish();
                    return;
                }

                initResult
                    .then(async () => {
                        // v3 SDK.init() resolves on every host: on CrazyGames it
                        // builds the real module, but on a rehosted domain or a
                        // server-side "fail mode" it resolves into a stub whose
                        // module getters THROW on access. Probe before trusting
                        // it, or sdkReady would be true while every SDK call
                        // blows up in the game boot.
                        if (!this._probeSdkFunctional()) {
                            console.warn("[PlatformBridge] CrazyGames SDK loaded but not functional; using fallback mode.");
                            finish();
                            return;
                        }

                        this.sdkLoaded = true;
                        this.sdkReady = true;

                        this._setupSettingsListener();
                        this._setupAuthListener();
                        this._readLocale();
                        this._startLoadingIfNeeded();
                        // Any gameplayStart/Stop the game issued while the SDK
                        // was still initialising was a no-op; reconcile now.
                        this._syncGameplayState();

                        try {
                            if (window.CrazyGames.SDK.ad && typeof window.CrazyGames.SDK.ad.hasAdblock === 'function') {
                                this.hasAdblock = !!(await window.CrazyGames.SDK.ad.hasAdblock());
                                window.hasAdblock = this.hasAdblock;
                            }
                        } catch (e) {
                            console.warn("[PlatformBridge] hasAdblock check failed:", e);
                        }

                        // Signed-in state decides whether the cloud save is
                        // authoritative in system.js. Resolve it before the game
                        // boots so the first readGameState() knows which backend
                        // to trust.
                        try {
                            if (window.CrazyGames.SDK.user && typeof window.CrazyGames.SDK.user.getUser === 'function') {
                                this.userSignedIn = !!(await window.CrazyGames.SDK.user.getUser());
                            }
                        } catch (e) {
                            this.userSignedIn = false;
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

    // Signing in makes the SDK sync cloud data into the data module, so the
    // save we have cached in memory may no longer match what's stored. Drop it
    // and re-read rather than writing a stale copy back over the cloud save.
    _setupAuthListener: function() {
        try {
            const user = window.CrazyGames.SDK.user;
            if (!user || typeof user.addAuthListener !== 'function') return;
            user.addAuthListener((u) => {
                this.userSignedIn = !!u;
                if (typeof window.invalidateGameStateCache === 'function') {
                    window.invalidateGameStateCache();
                }
            });
        } catch (e) {
            console.warn("[PlatformBridge] Auth listener setup failed:", e);
        }
    },

    // Read the platform locale so first-time visitors get a language matching
    // the CrazyGames portal they arrived from (e.g. crazygames.com.br → pt-BR).
    _readLocale: function() {
        try {
            const user = window.CrazyGames.SDK.user;
            if (user && user.systemInfo && user.systemInfo.locale) {
                this._sdkLocale = user.systemInfo.locale;
            }
        } catch (e) {
            console.warn("[PlatformBridge] Failed to read SDK locale:", e);
        }
    },

    // Returns the BCP-47 locale from the SDK, or null if unavailable.
    getLocale: function() {
        return this._sdkLocale;
    },

    _startLoadingIfNeeded: function() {
        if (this._loadingStarted) return;
        if (!this.sdkReady || !window.CrazyGames.SDK.game) return;
        if (typeof window.CrazyGames.SDK.game.loadingStart !== 'function') return;

        window.CrazyGames.SDK.game.loadingStart();
        this._loadingStarted = true;

        if (this._loadingFinished && typeof window.CrazyGames.SDK.game.loadingStop === 'function') {
            window.CrazyGames.SDK.game.loadingStop();
        }
    },

    // v3's init() resolves even where the SDK cannot actually run (rehosted
    // domains, server-side fail mode). Its module getters throw when accessed
    // there, so probe the game module before declaring the SDK usable.
    _probeSdkFunctional: function() {
        try {
            const game = window.CrazyGames.SDK.game;
            return !!(game && typeof game.gameplayStart === 'function' && typeof game.loadingStart === 'function');
        } catch (e) {
            return false;
        }
    },

    getDataStore: function() {
        if (this.sdkReady && window.CrazyGames && window.CrazyGames.SDK && window.CrazyGames.SDK.data) {
            return window.CrazyGames.SDK.data;
        }
        return null;
    },

    isUserSignedIn: function() {
        return this.userSignedIn;
    },

    gameLoadingFinished: function() {
        this._loadingFinished = true;
        if (!this.sdkReady) return;
        // Accessing the module getters throws on a stubbed SDK; the sdkReady
        // probe already rules that out, but keep the reads guarded so a future
        // module change can't soft-lock the boot.
        let game = null;
        try {
            if (window.CrazyGames && window.CrazyGames.SDK) {
                game = window.CrazyGames.SDK.game;
            }
        } catch (e) {
            game = null;
        }
        if (!game) return;

        if (this._loadingStarted && typeof game.loadingStop === 'function') {
            game.loadingStop();
        }
        // Re-apply mute in case soundManager was created after settings were first read
        try {
            const settings = game.settings;
            if (settings && settings.muteAudio !== undefined && window.soundManager) {
                window.soundManager.setCrazyGamesMuted(settings.muteAudio);
            }
        } catch (e) { }
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

        // Accessing the module getters throws on a stubbed SDK; keep this
        // guarded so a bad module can't crash gameplayStart/Stop callers.
        let game = null;
        try {
            if (this.sdkReady && window.CrazyGames && window.CrazyGames.SDK) {
                game = window.CrazyGames.SDK.game;
            }
        } catch (e) {
            game = null;
        }
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
            }
        }
    },

    reportGameCompletedPercentage: function(pct) {
        const value = Math.max(0, Math.min(100, Math.round(Number(pct) || 0)));
        if (this.sdkReady && window.CrazyGames && window.CrazyGames.SDK && window.CrazyGames.SDK.game) {
            if (typeof window.CrazyGames.SDK.game.reportGameCompletedPercentage === 'function') {
                window.CrazyGames.SDK.game.reportGameCompletedPercentage(value);
            }
        }
    },

    // Runs BEFORE requestAd: CrazyGames expects gameplay to already be stopped
    // when an ad is requested, not once it starts playing. Audio is left alone
    // here — an unfilled request can take seconds to fail and silencing the
    // game for that is worse than the ad never appearing.
    _pauseForAd: function() {
        this._adInProgress = true;
        window.gamePausedForAd = true;
        this._syncGameplayState();   // forces the SDK to gameplayStop if it isn't already
        // Input is frozen from here on, so a hold in progress would never see
        // its release event. Drop it now instead of leaking it past the ad.
        if (typeof window.releaseHeldInput === 'function') {
            try { window.releaseHeldInput(); } catch (e) { }
        }
    },

    _suspendAudioForAd: function() {
        this._audioSuspendedForAd = true;
        if (window.soundManager && window.soundManager.context) {
            window.soundManager.context.suspend().catch(() => {});
        }
    },

    _resumeAfterAd: function() {
        this._adInProgress = false;
        window.gamePausedForAd = false;
        // Only un-suspend what this bridge suspended; an ad that never started
        // left the audio context alone and must not be force-resumed here.
        if (this._audioSuspendedForAd) {
            this._audioSuspendedForAd = false;
            if (window.soundManager && window.soundManager.context && window.soundManager.isInitialized) {
                if (!document.hidden) {
                    window.soundManager.context.resume().catch(() => {});
                }
            }
        }
        // Re-check platform mute: the user may have toggled it during the ad
        // and our settings listener may have missed it or been no-oped.
        this._reapplyMuteState();
        this._syncGameplayState();   // restores gameplayStart if the game still wants it
    },

    // Re-reads the SDK mute flag and pushes it to the audio system. Acts as a
    // safety net so a mute change that occurred during an ad (when events can
    // be swallowed) never leaks audible audio into a muted portal.
    _reapplyMuteState: function() {
        try {
            if (!this.sdkReady || !window.CrazyGames || !window.CrazyGames.SDK) return;
            const settings = window.CrazyGames.SDK.game && window.CrazyGames.SDK.game.settings;
            if (settings && settings.muteAudio !== undefined && window.soundManager) {
                window.soundManager.setCrazyGamesMuted(settings.muteAudio);
            }
        } catch (e) { }
    },

    _isLocalDev: function() {
        const hostname = (window.location.hostname || '').toLowerCase();
        return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '';
    },

    // Sitelock predicate for the parts of the game that only unlock on an
    // authorized host. The v3 SDK initializes on ANY host (it resolves into a
    // "disabled" stub off CrazyGames), so sdkReady is NOT an authorization
    // signal — a rehosted copy would pass it trivially. Hostname is the gate;
    // it also keeps real players unlocked if an ad blocker stops the SDK script
    // from loading on the genuine site.
    //
    // Intentionally lenient: any hostname containing "crazy" passes. This is a
    // speed bump against casual re-hosting, not a security boundary — a
    // determined thief just registers a matching domain. Erring wide is the
    // deliberate trade, since a host we fail to recognise silently locks
    // legitimate players out of the victory screen and the weapon spinner,
    // and that covers every CrazyGames regional domain automatically.
    isAuthorizedHost: function() {
        if (this._isLocalDev()) return true;
        return (window.location.hostname || '').toLowerCase().includes('crazy');
    },

    // Shared driver for both ad types. `onSettled(success)` always runs exactly
    // once — on completion, on failure, and on either watchdog firing — so no
    // caller can be left waiting on a callback that never arrives.
    _runAd: function(type, onSettled) {
        let adResolved = false;
        let settledSuccess = false;
        let transitionInFinished = false;
        let resumed = false;
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
            // Unconditional: gameplay is now stopped from the moment the ad is
            // requested, so every exit path — filled, unfilled, timed out —
            // has to hand control back.
            this._resumeAfterAd();
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

        // Dev toggle: short-circuit every ad to its successful outcome.
        if (SKIP_ADS) {
            settle(true);
            return;
        }

        // Local dev mock comes first: a developer running with an adblocker
        // extension still needs the reward path to be testable.
        if (type === 'rewarded' && this._isLocalDev() &&
            !(this.sdkReady && window.CrazyGames && window.CrazyGames.SDK && window.CrazyGames.SDK.ad)) {
            settle(true);
            return;
        }

        // Known-unfillable: don't make the player sit through the transition
        // waiting for an adError that is already certain.
        if (this.hasAdblock) {
            settle(false);
            return;
        }

        if (this.sdkReady && window.CrazyGames && window.CrazyGames.SDK && window.CrazyGames.SDK.ad) {
            // Gameplay must be stopped before the request, not after adStarted.
            this._pauseForAd();

            // Watchdog: the request never launched at all.
            requestTimer = setTimeout(() => {
                console.warn("[PlatformBridge] " + type + " ad request timed out with no response; continuing.");
                settle(false);
            }, AD_REQUEST_TIMEOUT_MS);

            try {
                window.CrazyGames.SDK.ad.requestAd(type, {
                    adStarted: () => {
                        if (requestTimer) { clearTimeout(requestTimer); requestTimer = null; }
                        // Second watchdog: the ad started but never reported an end.
                        durationTimer = setTimeout(() => {
                            console.warn("[PlatformBridge] " + type + " ad exceeded max duration with no end event; resuming.");
                            settle(false);
                        }, AD_MAX_DURATION_MS);
                        this._suspendAudioForAd();
                    },
                    adFinished: () => {
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
            settle(type === 'midgame');
        }
    },

    showAdBreak: function(onComplete) {
        if (this._adInProgress || this._adRequestPending) {
            // Skip the ad, but never swallow the callback: progression to the
            // next planet rides on it, and dropping it strands the player on
            // the victory screen with a dead button.
            console.warn("[PlatformBridge] Ad already in progress; continuing without a second break.");
            if (onComplete) onComplete();
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
