# Annihilate Earth — CrazyGames SDK Platform Integration Guide

This branch of the project is dedicated to the **CrazyGames SDK v3** integration. It uses a polymorphic **Platform Bridge** to decouple core gameplay logic from portal-specific SDK libraries. This ensures that only the target platform's SDK code is bundled in your builds, completely preventing cross-platform script conflicts or portal review rejections.

---

## Directory Structure

```text
├── index.html                  # Includes js/platform-bridge.js
└── js/
    ├── platform-bridge.js      # ACTIVE SDK bridge loaded by the game
    └── platforms/
        ├── local.js            # Offline development mock
        └── crazygames.js       # CrazyGames SDK v3 integration
```

* **`js/platform-bridge.js`**: This is the file imported by `index.html`. During development, it is replaced with one of the platform-specific scripts in the `js/platforms/` directory.
* **`js/platforms/local.js`**: Emulates ad breaks (pausing game loops and muting sound for 1 second) and mocks gameplay start/stop lifecycles for offline/development work.
* **`js/platforms/crazygames.js`**: Dynamically loads and initializes the official CrazyGames SDK v3 on demand and routes loading, gameplay, and ad events.

---

## Features Implemented in this Branch

### 1. CrazyGames Cloud Saves (Data Module)
- All game progress (unlocked planets, unlocked weapons, best times, option settings) is saved using `window.CrazyGames.SDK.data` when the SDK is active, falling back to standard `localStorage`.
- Saves automatically synchronize with the user's CrazyGames account across devices.
- Progress resets also properly clear both LocalStorage and CrazyGames cloud save states.

### 2. Happy Time Celebrations
- Employs the `window.CrazyGames.SDK.game.happytime()` endpoint.
- Celebrations are triggered automatically at the moment of victory, but **only** when the player successfully destroys the **Sun** or the **Neutron Star**.

---

## How to Swap Platforms

To swap platform integrations, copy the desired platform file from `js/platforms/` and overwrite `js/platform-bridge.js`.

### 1. Manual Swapping
Copy the contents of the file you want (e.g., `js/platforms/crazygames.js`) and paste them directly into `js/platform-bridge.js`.

### 2. Command Line Swapping

#### Windows (PowerShell)
To switch to **CrazyGames**:
```powershell
Copy-Item -Path "js/platforms/crazygames.js" -Destination "js/platform-bridge.js" -Force
```
To switch back to **Local Development**:
```powershell
Copy-Item -Path "js/platforms/local.js" -Destination "js/platform-bridge.js" -Force
```

#### macOS / Linux (Bash)
To switch to **CrazyGames**:
```bash
cp js/platforms/crazygames.js js/platform-bridge.js
```
To switch back to **Local Development**:
```bash
cp js/platforms/local.js js/platform-bridge.js
```

---

## Development Constraints

> [!IMPORTANT]
> **Do NOT run `node build.js`** under any circumstances in this project.
