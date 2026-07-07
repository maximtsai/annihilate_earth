// Steam / desktop implementation of the Platform Bridge API.
//
// This build is packaged as a native executable via a Rust host (e.g. Tauri, or
// a wry / WebView2 wrapper). The web layer talks to the host through `_callHost`,
// which auto-detects whichever IPC channel the wrapper exposes and degrades to a
// safe, logged no-op when the game is run in a plain browser during development.
//
// Keep the method signatures identical to the other platform bridges
// (local.js, poki.js) so the game's call sites and cross-branch merges stay clean.
// The Steam build ships with NO ADS: ad hooks resolve immediately and rewarded
// hooks grant their reward instantly, so gameplay logic runs unchanged.
window.PlatformBridge = {
    platform: 'steam',

    // Cached IPC channel. `undefined` = not yet detected, `null` = none available.
    _host: undefined,

    init: async function() {
        console.log("[PlatformBridge] Initialized in Steam mode.");
        // Ask the Rust host to boot the Steamworks API (SteamAPI_Init) and confirm
        // the game is running through the authorized Steam launcher.
        // TODO(rust): implement the `steam_init` command host-side.
        await this._callHost('steam_init');
        return Promise.resolve();
    },

    gameLoadingFinished: function() {
        console.log("[PlatformBridge] Steam gameLoadingFinished triggered.");
        // Good hook to dismiss a native splash / mark the app window as ready.
        this._callHost('game_loading_finished');
    },

    gameplayStart: function() {
        console.log("[PlatformBridge] Gameplay Start triggered.");
        // Wire to Steam Rich Presence, e.g. status "Annihilating Earth".
        this._callHost('gameplay_start');
    },

    gameplayStop: function() {
        console.log("[PlatformBridge] Gameplay Stop triggered.");
        this._callHost('gameplay_stop');
    },

    // --- Ads: intentional no-ops on the paid Steam build --------------------
    showAdBreak: function(onComplete) {
        console.log("[PlatformBridge] Steam: Skipping ad break.");
        if (onComplete) onComplete();
    },

    showRewardedAd: function(onComplete) {
        console.log("[PlatformBridge] Steam: Skipping rewarded ad, granting reward immediately.");
        if (onComplete) onComplete();
    },

    // --- Achievements & Stats -----------------------------------------------
    // Scaffolding; not yet called by the game. Wire these to milestones such as
    // destroying each planet or unlocking every weapon.
    // TODO(rust): implement the matching host commands + define the API names in
    // the Steamworks partner backend before calling.
    unlockAchievement: function(id) {
        if (!id) return;
        console.log("[PlatformBridge] Steam: unlockAchievement " + id);
        this._callHost('unlock_achievement', { id: id });
    },

    // Steam Stats (int/float) — often back achievement progress and feed the
    // Steam profile showcase. Buffered client-side until storeStats() is called.
    setStat: function(name, value) {
        if (!name) return;
        this._callHost('set_stat', { name: name, value: value });
    },

    getStat: function(name) {
        // Returns a Promise resolving to the stat value (or undefined w/o host).
        return this._callHost('get_stat', { name: name });
    },

    // Flush buffered stats/achievements to the Steam servers. Call after a batch
    // of setStat/unlockAchievement (e.g. on victory or when returning to menu).
    storeStats: function() {
        this._callHost('store_stats');
    },

    // --- Leaderboards --------------------------------------------------------
    // Maps naturally onto the per-planet `bestTimes` already in the save. Score
    // convention for a time attack: submit milliseconds and sort ascending.
    submitLeaderboardScore: function(boardName, score) {
        if (!boardName) return;
        console.log("[PlatformBridge] Steam: submitLeaderboardScore " + boardName + " = " + score);
        this._callHost('submit_leaderboard_score', { board: boardName, score: score });
    },

    downloadLeaderboardScores: function(boardName, count) {
        // Returns a Promise resolving to an array of entries (or undefined w/o host).
        return this._callHost('download_leaderboard_scores', { board: boardName, count: count || 10 });
    },

    // --- User & System info (getters return Promises) ------------------------
    // Use to auto-select the UI language from the Steam client on first launch,
    // matching one of the keys in translations.js.
    getSteamLanguage: function() {
        return this._callHost('get_steam_language');
    },

    getPlayerName: function() {
        return this._callHost('get_player_name');
    },

    // True when running on Steam Deck — useful for defaulting to controller
    // hints / larger touch targets.
    isSteamDeck: function() {
        return this._callHost('is_steam_deck');
    },

    // --- App / UI actions ----------------------------------------------------
    // Desktop builds need a real quit action (the web build never did).
    quitGame: function() {
        console.log("[PlatformBridge] Steam: quitGame requested.");
        this._callHost('quit_game');
    },

    // Open an external link. Prefer the Steam overlay browser when available so
    // the player stays in-app (e.g. wishlist the next game, Discord, credits).
    openURL: function(url) {
        if (!url) return;
        this._callHost('open_url', { url: url });
    },

    // --- Inbound: called BY the Rust host ------------------------------------
    // Invoked when the Steam overlay opens/closes. Reuses the existing ad-pause
    // path so the game freezes cleanly (and audio suspends) while the overlay is
    // up. The host should call: window.PlatformBridge.setOverlayActive(true/false)
    setOverlayActive: function(active) {
        window.gamePausedForAd = !!active;
        if (window.soundManager && window.soundManager.context) {
            if (active) {
                window.soundManager.context.suspend().catch(function() {});
            } else if (window.soundManager.isInitialized) {
                window.soundManager.context.resume().catch(function() {});
            }
        }
    },

    // --- Host IPC plumbing ---------------------------------------------------
    // Detect whichever IPC channel the Rust wrapper exposes. All optional; if
    // none are present (browser dev), host calls become logged no-ops.
    _detectHost: function() {
        if (typeof window === 'undefined') return null;
        // Tauri v2 (core.invoke) / v1 (invoke)
        if (window.__TAURI__ && window.__TAURI__.core && typeof window.__TAURI__.core.invoke === 'function') {
            return { kind: 'tauri', invoke: window.__TAURI__.core.invoke };
        }
        if (window.__TAURI__ && typeof window.__TAURI__.invoke === 'function') {
            return { kind: 'tauri', invoke: window.__TAURI__.invoke };
        }
        // wry / generic postMessage channel
        if (window.ipc && typeof window.ipc.postMessage === 'function') {
            return { kind: 'post', post: function(m) { window.ipc.postMessage(m); } };
        }
        // Edge WebView2
        if (window.chrome && window.chrome.webview && typeof window.chrome.webview.postMessage === 'function') {
            return { kind: 'post', post: function(m) { window.chrome.webview.postMessage(m); } };
        }
        return null;
    },

    // Fire a command at the Rust host. Returns a Promise: it resolves to the
    // host's return value on Tauri, or to `undefined` on fire-and-forget channels.
    // Never throws — an absent or failing host is logged and swallowed so the
    // desktop layer can never block gameplay.
    _callHost: function(command, payload) {
        try {
            if (this._host === undefined) this._host = this._detectHost();
            if (!this._host) {
                console.log("[PlatformBridge:steam] (no host) " + command, payload || '');
                return Promise.resolve(undefined);
            }
            if (this._host.kind === 'tauri') {
                return Promise.resolve(this._host.invoke(command, payload || {})).catch(function(e) {
                    console.warn("[PlatformBridge:steam] host command failed: " + command, e);
                    return undefined;
                });
            }
            this._host.post(JSON.stringify({ command: command, payload: payload || {} }));
            return Promise.resolve(undefined);
        } catch (e) {
            console.warn("[PlatformBridge:steam] _callHost error: " + command, e);
            return Promise.resolve(undefined);
        }
    }
};
