# Annihilate Earth — SDK Platform Integration Guide

This project uses a polymorphic **Platform Bridge** to decouple core gameplay logic from portal-specific SDK libraries (such as Poki or CrazyGames). This ensures that only the target platform's SDK code is bundled in your builds, completely preventing cross-platform script conflicts or portal review rejections.

---

## Directory Structure

```text
├── index.html                  # Includes js/platform-bridge.js
└── js/
    ├── platform-bridge.js      # ACTIVE SDK bridge loaded by the game
    └── platforms/
        ├── local.js            # Offline development mock (default)
        └── poki.js             # Poki SDK integration
```

* **`js/platform-bridge.js`**: This is the file imported by `index.html`. It should never be edited directly. Instead, it is replaced with one of the platform-specific scripts in the `js/platforms/` directory during export.
* **`js/platforms/local.js`**: Emulates ad breaks (pausing game loops and muting sound for 1 second) and mocks gameplay start/stop lifecycles for offline/development work.
* **`js/platforms/poki.js`**: Dynamically loads and initializes the official Poki SDK on demand and routes gameplay and ad events.

---

## How to Swap Platforms

To swap platform integrations, copy the desired platform file from `js/platforms/` and overwrite `js/platform-bridge.js`.

### 1. Manual Swapping
Copy the contents of the file you want (e.g., `js/platforms/poki.js`) and paste them directly into `js/platform-bridge.js`.

### 2. Command Line Swapping

#### Windows (PowerShell)
To switch to **Poki**:
```powershell
Copy-Item -Path "js/platforms/poki.js" -Destination "js/platform-bridge.js" -Force
```
To switch back to **Local Development**:
```powershell
Copy-Item -Path "js/platforms/local.js" -Destination "js/platform-bridge.js" -Force
```

#### macOS / Linux (Bash)
To switch to **Poki**:
```bash
cp js/platforms/poki.js js/platform-bridge.js
```
To switch back to **Local Development**:
```bash
cp js/platforms/local.js js/platform-bridge.js
```

---

## Creating a New SDK Integration (e.g., CrazyGames)

To add another platform integration, create a new file under `js/platforms/` (e.g., `js/platforms/crazygames.js`). The file must populate `window.PlatformBridge` with the exact same method signatures:

```javascript
// js/platforms/crazygames.js
window.PlatformBridge = {
    platform: 'crazygames',

    init: function() {
        return new Promise((resolve) => {
            // 1. Dynamically load CrazyGames SDK scripts
            const script = document.createElement('script');
            script.src = 'https://sdk.crazygames.com/crazygames-sdk-v2.js';
            script.onload = () => {
                // Initialize the SDK if required
                resolve();
            };
            document.head.appendChild(script);
        });
    },

    gameplayStart: function() {
        // Signal gameplay start to CrazyGames
        if (window.CrazyGames && window.CrazyGames.SDK) {
            window.CrazyGames.SDK.game.gameplayStart();
        }
    },

    gameplayStop: function() {
        // Signal gameplay stop to CrazyGames
        if (window.CrazyGames && window.CrazyGames.SDK) {
            window.CrazyGames.SDK.game.gameplayStop();
        }
    },

    showAdBreak: function(onComplete) {
        // Request commercial break
        window.gamePausedForAd = true;
        if (window.soundManager && window.soundManager.context) {
            window.soundManager.context.suspend().catch(() => {});
        }

        const resumeGame = () => {
            window.gamePausedForAd = false;
            if (window.soundManager && window.soundManager.context && window.soundManager.isInitialized) {
                window.soundManager.context.resume().catch(() => {});
            }
            if (onComplete) onComplete();
        };

        if (window.CrazyGames && window.CrazyGames.SDK) {
            window.CrazyGames.SDK.ad.requestAd('midroll', {
                adStarted: () => {},
                adFinished: resumeGame,
                adError: resumeGame
            });
        } else {
            resumeGame();
        }
    }
};
```
Once created, you can swap it into `js/platform-bridge.js` using the copy commands above!
