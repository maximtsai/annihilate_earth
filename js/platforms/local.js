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

    showAdBreak: function(onComplete) {
        console.log("[PlatformBridge] Requesting commercial/ad break...");
        
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
