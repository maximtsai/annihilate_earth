// Local/Mock implementation of the Platform Bridge API
window.PlatformBridge = {
    platform: 'local',

    init: async function() {
        console.log("[PlatformBridge] Initialized in local mode.");
        return Promise.resolve();
    },

    gameLoadingFinished: function() {
        console.log("[PlatformBridge] Local gameLoadingFinished triggered.");
    },

    gameplayStart: function() {
        console.log("[PlatformBridge] Gameplay Start triggered.");
    },

    gameplayStop: function() {
        console.log("[PlatformBridge] Gameplay Stop triggered.");
    },

    happytime: function() {
        console.log("[PlatformBridge] Local happytime triggered.");
    },

    showAdBreak: function(onComplete) {
        console.log("[PlatformBridge] Requesting commercial/ad break...");
        
        // Pause audio and game loop
        window.gamePausedForAd = true;
        if (window.soundManager && window.soundManager.context) {
            window.soundManager.context.suspend().catch(() => {});
        }

        this._runTransitionIn(() => {
            window.lastAdPlayTime = Date.now();
            if (onComplete) onComplete();

            window.gamePausedForAd = false;
            if (window.soundManager && window.soundManager.context && window.soundManager.isInitialized) {
                window.soundManager.context.resume().catch(() => {});
            }

            this._runTransitionOut();
        });
    },

    showRewardedAd: function(onComplete) {
        console.log("[PlatformBridge] Requesting rewarded ad break...");
        
        // Pause audio and game loop
        window.gamePausedForAd = true;
        if (window.soundManager && window.soundManager.context) {
            window.soundManager.context.suspend().catch(() => {});
        }

        this._runTransitionIn(() => {
            if (onComplete) onComplete();

            window.gamePausedForAd = false;
            if (window.soundManager && window.soundManager.context && window.soundManager.isInitialized) {
                window.soundManager.context.resume().catch(() => {});
            }

            this._runTransitionOut();
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
