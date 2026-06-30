// CrazyGames SDK v3 implementation of the Platform Bridge API
window.PlatformBridge = {
    platform: 'crazygames',
    sdkLoaded: false,

    init: function() {
        return new Promise((resolve) => {
            if (this.sdkLoaded) {
                resolve();
                return;
            }
            
            const script = document.createElement('script');
            script.src = 'https://sdk.crazygames.com/crazygames-sdk-v3.js';
            script.onload = () => {
                this.sdkLoaded = true;
                if (typeof window.CrazyGames !== 'undefined' && window.CrazyGames.SDK) {
                    window.CrazyGames.SDK.init()
                        .then(() => {
                            console.log("[PlatformBridge] CrazyGames SDK successfully initialized.");
                            
                            // Initialize audio settings listener
                            if (window.CrazyGames.SDK.game) {
                                if (typeof window.CrazyGames.SDK.game.addSettingsChangeListener === 'function') {
                                    const currentSettings = window.CrazyGames.SDK.game.settings;
                                    if (currentSettings && currentSettings.muteAudio !== undefined) {
                                        if (window.soundManager) window.soundManager.setCrazyGamesMuted(currentSettings.muteAudio);
                                    }
                                    window.CrazyGames.SDK.game.addSettingsChangeListener((newSettings) => {
                                        if (newSettings && newSettings.muteAudio !== undefined) {
                                            if (window.soundManager) window.soundManager.setCrazyGamesMuted(newSettings.muteAudio);
                                        }
                                    });
                                }

                                // Start loading event as per CrazyGames SDK v3 requirements
                                if (typeof window.CrazyGames.SDK.game.loadingStart === 'function') {
                                    window.CrazyGames.SDK.game.loadingStart();
                                    console.log("[PlatformBridge] CrazyGames loadingStart triggered.");
                                }
                            }
                            resolve();
                        })
                        .catch((err) => {
                            console.warn("[PlatformBridge] CrazyGames SDK failed to initialize; using fallback mode.", err);
                            resolve();
                        });
                } else {
                    console.warn("[PlatformBridge] CrazyGames SDK variable not found; using fallback mode.");
                    resolve();
                }
            };
            script.onerror = () => {
                console.warn("[PlatformBridge] CrazyGames SDK script failed to load; using fallback mode.");
                resolve();
            };
            document.head.appendChild(script);
        });
    },

    gameLoadingFinished: function() {
        if (this.sdkLoaded && typeof window.CrazyGames !== 'undefined' && window.CrazyGames.SDK.game) {
            if (typeof window.CrazyGames.SDK.game.loadingStop === 'function') {
                window.CrazyGames.SDK.game.loadingStop();
                console.log("[PlatformBridge] CrazyGames loadingStop triggered.");
            }
        }
    },

    gameplayStart: function() {
        if (this.sdkLoaded && typeof window.CrazyGames !== 'undefined' && window.CrazyGames.SDK.game) {
            if (typeof window.CrazyGames.SDK.game.gameplayStart === 'function') {
                window.CrazyGames.SDK.game.gameplayStart();
                console.log("[PlatformBridge] CrazyGames gameplayStart triggered.");
            }
        }
    },

    gameplayStop: function() {
        if (this.sdkLoaded && typeof window.CrazyGames !== 'undefined' && window.CrazyGames.SDK.game) {
            if (typeof window.CrazyGames.SDK.game.gameplayStop === 'function') {
                window.CrazyGames.SDK.game.gameplayStop();
                console.log("[PlatformBridge] CrazyGames gameplayStop triggered.");
            }
        }
    },

    happytime: function() {
        if (this.sdkLoaded && typeof window.CrazyGames !== 'undefined' && window.CrazyGames.SDK.game) {
            if (typeof window.CrazyGames.SDK.game.happytime === 'function') {
                window.CrazyGames.SDK.game.happytime();
                console.log("[PlatformBridge] CrazyGames happytime triggered.");
            }
        }
    },

    showAdBreak: function(onComplete) {
        console.log("[PlatformBridge] CrazyGames commercial break requested.");

        // Pause audio and game loop immediately
        window.gamePausedForAd = true;
        if (window.soundManager && window.soundManager.context) {
            window.soundManager.context.suspend().catch(() => {});
        }

        let adFinished = false;
        let transitionInFinished = false;

        const tryResume = () => {
            if (adFinished && transitionInFinished) {
                window.gamePausedForAd = false;
                if (window.soundManager && window.soundManager.context && window.soundManager.isInitialized) {
                    window.soundManager.context.resume().catch(() => {});
                }
                if (onComplete) onComplete();
                
                // Defer transition-out by one frame so game DOM updates (hiding
                // victory screen, loading next planet) flush before the overlay sweeps away
                requestAnimationFrame(() => this._runTransitionOut());
            }
        };

        // 1. Start transition-in immediately
        this._runTransitionIn(() => {
            transitionInFinished = true;
            tryResume();
        });

        // 2. Request CrazyGames ad immediately (running in parallel to transition-in)
        const onAdComplete = () => {
            adFinished = true;
            tryResume();
        };

        if (this.sdkLoaded && typeof window.CrazyGames !== 'undefined' && window.CrazyGames.SDK.ad) {
            window.CrazyGames.SDK.ad.requestAd("midgame", {
                adStarted: () => {
                    console.log("[PlatformBridge] CrazyGames midgame ad started.");
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
            // Fallback if SDK failed to load
            console.log("[PlatformBridge] Fallback: No CrazyGames SDK loaded, skipping commercial break.");
            onAdComplete();
        }
    },

    showRewardedAd: function(onComplete) {
        console.log("[PlatformBridge] CrazyGames rewarded ad break requested.");

        // Pause audio and game loop immediately
        window.gamePausedForAd = true;
        if (window.soundManager && window.soundManager.context) {
            window.soundManager.context.suspend().catch(() => {});
        }

        let adFinished = false;
        let transitionInFinished = false;
        let rewardGranted = false;

        const tryResume = () => {
            if (adFinished && transitionInFinished) {
                window.gamePausedForAd = false;
                if (window.soundManager && window.soundManager.context && window.soundManager.isInitialized) {
                    window.soundManager.context.resume().catch(() => {});
                }
                if (rewardGranted && onComplete) onComplete();
                
                // Defer transition-out by one frame so game DOM updates flush
                // before the overlay sweeps away
                requestAnimationFrame(() => this._runTransitionOut());
            }
        };

        // 1. Start transition-in immediately
        this._runTransitionIn(() => {
            transitionInFinished = true;
            tryResume();
        });

        // 2. Request CrazyGames rewarded ad immediately
        const onAdComplete = (success) => {
            rewardGranted = success;
            adFinished = true;
            tryResume();
        };

        if (this.sdkLoaded && typeof window.CrazyGames !== 'undefined' && window.CrazyGames.SDK.ad) {
            window.CrazyGames.SDK.ad.requestAd("rewarded", {
                adStarted: () => {
                    console.log("[PlatformBridge] CrazyGames rewarded ad started.");
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
        } else {
            // Fallback if SDK failed to load - grant reward for testing
            console.log("[PlatformBridge] Fallback: No CrazyGames SDK loaded, skipping rewarded break but granting mock reward.");
            onAdComplete(true);
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
        overlay.style.transform = 'skewX(-20deg) translateX(-100%)'; // reset to start position
        overlay.offsetHeight; // trigger reflow
        overlay.classList.add('ad-transition-in');
        setTimeout(() => {
            overlay.style.display = 'none'; // Hide during the ad break so CrazyGames ad is visible
            if (onMidpoint) onMidpoint();
        }, 420);
    },

    _runTransitionOut: function() {
        const overlay = document.getElementById('ad-transition-overlay');
        if (!overlay) return;
        overlay.style.display = 'block';
        overlay.className = '';
        overlay.style.transform = 'skewX(-20deg) translateX(0%)';
        overlay.offsetHeight; // trigger reflow
        overlay.classList.add('ad-transition-out');
        setTimeout(() => {
            overlay.remove();
        }, 420);
    }
};
