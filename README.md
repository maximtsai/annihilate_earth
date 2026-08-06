# Annihilate Earth — CrazyGames SDK Integration

This branch of the project is dedicated exclusively to the **CrazyGames SDK v3** integration. 

---

## Directory Structure

```text
├── index.html                  # Includes js/platform-bridge.js
└── js/
    └── platform-bridge.js      # CrazyGames SDK v3 bridge loaded by the game
```

* **`js/platform-bridge.js`**: Contains the complete integration logic for CrazyGames SDK v3. It dynamically loads the CrazyGames SDK, handles loading and gameplay events, requests commercial breaks & rewarded ads, and processes settings changes (such as audio muting).

---

## Features Implemented in this Branch

### 1. CrazyGames Cloud Saves (Data Module)
- All game progress (unlocked planets, unlocked weapons, best times, option settings) is saved using `window.CrazyGames.SDK.data` exclusively.
- Saves automatically synchronize with the user's CrazyGames account across devices.
- Progress resets also properly clear the CrazyGames cloud save state.

### 2. Happy Time Celebrations
- Employs the `window.CrazyGames.SDK.game.happytime()` endpoint.
- Celebrations are triggered automatically at the moment of victory, but **only** when the player successfully destroys the **Sun** or the **Neutron Star**.

### 3. SDK Audio Muting Settings
- Hooks settings updates using `window.CrazyGames.SDK.game.addSettingsChangeListener`.
- Disables/mutes game audio automatically with highest priority when `muteAudio` is requested by CrazyGames.

---

## Development Constraints

> [!IMPORTANT]
> **Do NOT run `node build.js`** under any circumstances in this project.
