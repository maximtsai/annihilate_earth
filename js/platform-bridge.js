// Poki SDK implementation of the Platform Bridge API
window.PlatformBridge = {
    platform: 'poki',
    sdkLoaded: false,

    init: function() {
        return new Promise((resolve) => {
            if (this.sdkLoaded) {
                resolve();
                return;
            }
            
            const script = document.createElement('script');
            script.src = 'https://game-cdn.poki.com/scripts/v2/poki-sdk.js';
            script.onload = () => {
                this.sdkLoaded = true;
                if (typeof PokiSDK !== 'undefined') {
                    PokiSDK.init().then(() => {
                        console.log("[PlatformBridge] Poki SDK successfully initialized.");
                        resolve();
                    }).catch(() => {
                        console.warn("[PlatformBridge] Poki SDK failed to initialize; using fallback mode.");
                        resolve();
                    });
                } else {
                    console.warn("[PlatformBridge] PokiSDK variable not found; using fallback mode.");
                    resolve();
                }
            };
            script.onerror = () => {
                console.warn("[PlatformBridge] Poki SDK script failed to load; using fallback mode.");
                resolve();
            };
            document.head.appendChild(script);
        });
    },

    gameLoadingFinished: function() {
        if (this.sdkLoaded && typeof PokiSDK !== 'undefined') {
            PokiSDK.gameLoadingFinished();
            console.log("[PlatformBridge] Poki gameLoadingFinished triggered.");
        }
    },

    gameplayStart: function() {
        if (this.sdkLoaded && typeof PokiSDK !== 'undefined') {
            PokiSDK.gameplayStart();
        }
    },

    gameplayStop: function() {
        if (this.sdkLoaded && typeof PokiSDK !== 'undefined') {
            PokiSDK.gameplayStop();
        }
    },

    showAdBreak: function(onComplete) {
        console.log("[PlatformBridge] Poki commercial break requested.");

        // Pause audio and game loop
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
                
                // Transition away once everything is completed
                this._runTransitionOut();
            }
        };

        // 1. Start transition-in immediately
        this._runTransitionIn(() => {
            transitionInFinished = true;
            tryResume();
        });

        // 2. Request Poki ad immediately (running in parallel to transition-in)
        const onAdComplete = () => {
            adFinished = true;
            tryResume();
        };

        if (this.sdkLoaded && typeof PokiSDK !== 'undefined') {
            PokiSDK.commercialBreak()
                .then(() => {
                    console.log("[PlatformBridge] Commercial break completed successfully.");
                    onAdComplete();
                })
                .catch((err) => {
                    console.warn("[PlatformBridge] Commercial break failed or was skipped:", err);
                    onAdComplete();
                });
        } else {
            // Fallback if SDK failed to load
            console.log("[PlatformBridge] Fallback: No Poki SDK loaded, skipping commercial break.");
            onAdComplete();
        }
    },

    showRewardedAd: function(onComplete) {
        console.log("[PlatformBridge] Poki rewarded ad break requested.");

        // Pause audio and game loop
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
                
                // Transition away once everything is completed
                this._runTransitionOut();
            }
        };

        // 1. Start transition-in immediately
        this._runTransitionIn(() => {
            transitionInFinished = true;
            tryResume();
        });

        // 2. Request Poki rewarded ad immediately
        const onAdComplete = (success) => {
            rewardGranted = success;
            adFinished = true;
            tryResume();
        };

        if (this.sdkLoaded && typeof PokiSDK !== 'undefined') {
            PokiSDK.rewardedBreak()
                .then((withReward) => {
                    console.log("[PlatformBridge] Rewarded break completed. Reward status: " + withReward);
                    onAdComplete(withReward);
                })
                .catch((err) => {
                    console.warn("[PlatformBridge] Rewarded break failed or was skipped:", err);
                    onAdComplete(false);
                });
        } else {
            // Fallback if SDK failed to load - grant reward for testing
            console.log("[PlatformBridge] Fallback: No Poki SDK loaded, skipping rewarded break but granting mock reward.");
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
                    left: 0;
                    width: 100vw;
                    height: 100vh;
                    background: #000000;
                    z-index: 999999;
                    transform-origin: center center;
                    pointer-events: all;
                }
                .ad-transition-in {
                    animation: adTransitionIn 0.22s cubic-bezier(0.25, 1, 0.5, 1) forwards;
                }
                .ad-transition-out {
                    animation: adTransitionOut 0.22s cubic-bezier(0.25, 1, 0.5, 1) forwards;
                }
                @keyframes adTransitionIn {
                    0% {
                        transform: scale(0, 0);
                        opacity: 0;
                    }
                    10% {
                        opacity: 1;
                    }
                    100% {
                        transform: scale(1, 1);
                        opacity: 1;
                    }
                }
                @keyframes adTransitionOut {
                    0% {
                        transform: scale(1, 1);
                        clip-path: polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%, 0% 0%, 50% 50%, 50% 50%, 50% 50%, 50% 50%, 50% 50%);
                    }
                    100% {
                        transform: scale(1, 1);
                        clip-path: polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%, 0% 0%, 0% 0%, 100% 0%, 100% 100%, 0% 100%, 0% 0%);
                    }
                }
            `;
            document.head.appendChild(style);
            document.body.appendChild(overlay);
        }
        overlay.className = '';
        overlay.offsetHeight; // trigger reflow
        overlay.classList.add('ad-transition-in');
        setTimeout(() => {
            if (onMidpoint) onMidpoint();
        }, 220);
    },

    _runTransitionOut: function() {
        const overlay = document.getElementById('ad-transition-overlay');
        if (!overlay) return;
        overlay.className = '';
        overlay.offsetHeight; // trigger reflow
        overlay.classList.add('ad-transition-out');
        setTimeout(() => {
            overlay.remove();
        }, 220);
    }
};
