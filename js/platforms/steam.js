// Steam implementation of the Platform Bridge API
window.PlatformBridge = {
    platform: 'steam',

    init: async function() {
        console.log("[PlatformBridge] Initialized in Steam mode.");
        // Steamworks initialization (e.g., greenworks or steamworks.js) can be added here
        return Promise.resolve();
    },

    gameLoadingFinished: function() {
        console.log("[PlatformBridge] Steam gameLoadingFinished triggered.");
    },

    gameplayStart: function() {
        console.log("[PlatformBridge] Gameplay Start triggered.");
    },

    gameplayStop: function() {
        console.log("[PlatformBridge] Gameplay Stop triggered.");
    },

    showAdBreak: function(onComplete) {
        console.log("[PlatformBridge] Steam: Skipping ad break.");
        if (onComplete) onComplete();
    },

    showRewardedAd: function(onComplete) {
        console.log("[PlatformBridge] Steam: Skipping rewarded ad, granting reward immediately.");
        if (onComplete) onComplete();
    }
};
