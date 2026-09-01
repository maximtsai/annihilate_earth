# CrazyGames HTML5 SDK v3 Requirements & Technical Specification

> **Target Audience:** AI Coding Agents, Web Game Developers, Platform Engineers  
> **SDK Version:** CrazyGames HTML5 SDK v3 (`window.CrazyGames.SDK`)  
> **Global Namespace:** `window.CrazyGames.SDK`  
> **Official Docs:** [CrazyGames Developer Documentation](https://docs.crazygames.com/sdk/)

---

## 1. Architecture Overview & Bridge Design

All platform features are abstracted through an SDK Bridge implementing a unified polymorphic adapter interface (`BaseSDKAdapter` / `window.GameSDK`).

### Core Architectural Principles
1. **Pure Adapter Pattern:** Game logic calls `window.GameSDK.<method>()` unconditionally.
2. **Degradation & Fallbacks:** If the CrazyGames SDK script fails to load (e.g. adblocker or offline origin), `CrazyGamesAdapter` remains selected but operates in degraded mode:
   - Ads immediately report an `'adblock'` error.
   - Cloud save writes are safely dropped without throwing runtime exceptions.
   - **No Manual LocalStorage Fallback:** Persistence is delegated to `SDK.data`; the adapter avoids raw `localStorage` fallbacks (guest behaviour details in [Section 5](#5-data-persistence-sdkdata)).
3. **Eager Initialisation & Memoization:** `CrazyGamesAdapter.init()` fires eagerly when the bridge parses and returns a memoized promise so `await window.GameSDK.init()` reuses the same execution context.

---

## 2. Lifecycle Hooks (`SDK.game`)

### A. SDK Initialisation
- **Script Include:** Load the SDK **before** any game code in `<head>`:
  ```html
  <script src="https://sdk.crazygames.com/crazygames-sdk-v3.js"></script>
  ```
- **SDK Call:** `await window.CrazyGames.SDK.init()` — MUST be awaited; the SDK is unusable until it resolves.
- **Timing:** Executed at boot time before preloading game assets.
- **Behavior:** Initialises the SDK runtime, reads initial host settings (`muteAudio`, `disableChat`), and registers setting listeners.
- **Error Format:** All v3 SDK errors are objects shaped `{ code: string, message: string }` (e.g. `{ code: 'adCooldown', message: '...' }`).

### B. Loading Events
- **`SDK.game.loadingStart()`**
  - **Timing:** Called immediately after `SDK.init()` resolves.
  - **Purpose:** Signals to CrazyGames that asset downloading/parsing has begun.
- **`SDK.game.loadingStop()`**
  - **Timing:** Called once asset preloading is complete and the loader UI begins hiding.
  - **Purpose:** Signals that the game is fully interactive and playable.

### C. No `firstFrameReady()` in CrazyGames
> [!WARNING]
> CrazyGames v3 has **no** `firstFrameReady()` method — that API belongs to YouTube Playables (`ytgame.game.firstFrameReady()`). Do not call it here. Loading is signalled exclusively via `loadingStart()` / `loadingStop()` (Section 2.B).

### D. Gameplay State Tracking (`gameplayStart` / `gameplayStop`)
CrazyGames requires strict tracking of active gameplay vs. idle/menu states to manage ad eligibility and server resources.

```javascript
// Signal gameplay start
window.CrazyGames.SDK.game.gameplayStart();

// Signal gameplay stop
window.CrazyGames.SDK.game.gameplayStop();
```

#### Event Call Triggers
- **`gameplayStart()` Must Be Called When:**
  1. Immediately after `loadingStop()` when the game first starts.
  2. When any overlay or modal popup is closed.
  3. When an ad break of either type settles.
  4. When the game engine unpauses via `resumeGame()`, provided no popups or ad breaks are pending.
  - *Guard Logic:* Wrap in `sdkGameplayStart()` to ensure `_gameplayActive` is `false` before firing, preventing duplicate start events.

- **`gameplayStop()` Must Be Called When:**
  1. When an overlay or modal popup opens.
  2. When an ad break starts (`adStarted` callback).
  3. When the game engine explicitly pauses via `pauseGame()`.
  - *Guard Logic:* Wrap in `sdkGameplayStop()` to ensure `_gameplayActive` is `true` before firing.

> [!IMPORTANT]
> **Window Focus & Tab Switching Rule:** Per official CrazyGames SDK guidelines, do **NOT** call `gameplayStop()` in `visibilitychange` or `blur` event listeners. The CrazyGames SDK automatically detects browser window focus and tab switches.

### E. Celebratory Moments
- **`SDK.game.happytime()`**
  - **Timing:** Triggered during positive player milestones (e.g. multi-merges, combo streaks, level unlocks, boss victories).

---

## 3. Monetization & Ads (`SDK.ad`)

### Ad Request Signature
```typescript
interface AdCallbacks {
    adStarted?: () => void;
    adFinished?: () => void;
    adError?: (error: string | object) => void;
}

function requestAd(type: 'midgame' | 'rewarded', callbacks: AdCallbacks): void;
```

### Trigger Scenarios
1. **`'midgame'`:** Requested after closing major popups or upon completing level milestones.
2. **`'rewarded'`:** Requested only when the player clicks an explicit reward button (e.g., "Free Upgrade", "Double Coins").

### Critical Monetization Rules
1. **`adStarted` Callback:** Must pause game audio, freeze game loop (`pauseGame()`), and call `sdkGameplayStop()`.
2. **`adFinished` Callback:** Resumes game loop (`resumeGame()`) and calls `sdkGameplayStart()`. For `'rewarded'`, in-game rewards are granted **exclusively** inside `adFinished`.
3. **`adError` Callback:** Resumes game loop without granting any reward. See "Ad Error Codes" below. **An error must NEVER grant a reward.**
4. **SDK Unavailable Fallback:** If `SDK.ad` is missing (e.g. adblocker), `showAd()` immediately invokes `callbacks.onError('adblock')` and returns `false`. It must **NEVER** invoke `adFinished`.

### Adblock Detection (`SDK.ad.hasAdblock()`)
CrazyGames requires games to remain functional even when the player uses an adblocker (progress must be saved; you may gate bonus content to encourage disabling it, and note that disabling it usually requires a page refresh).

```javascript
const hasAdblock = await window.CrazyGames.SDK.ad.hasAdblock();
```

### Ad Error Codes
The `adError` callback receives `{ code, message }` where `code` can be:
- `adsDisabledBasicLaunch` — ads are disabled during Basic Launch
- `unfilled` — no ad available
- `adblock` — an adblocker is preventing ads
- `adCooldown` — requested too soon (midgame cooldown ~3 min, counting rewarded/preroll)
- `other`

### Mutex & Ad Pending Flag (`window.Game._adPending`)
`_adPending` is the engine's single-ad-break mutex — set synchronously before a popup closes so `popupClosed()` can't emit a spurious `gameplayStart()` (Section 13). Contention and watchdog behaviour live in Section 4 (Rules 4 & 5).

---

## 4. Ad Break Safety Invariants (Lockup Prevention)

> [!CAUTION]
> **Root Cause Analysis:** Ad breaks pause the game by setting `Game.isPaused = true`, cancelling the RAF loop, and adding `body.game-paused`. Nothing else ever clears that state — `resumeGame()` is the only exit. Every single execution path out of `requestAd` MUST reach exactly one resume call. Any path that pauses without a live resume path creates a permanent freeze for the session.

All ad breaks must pass through a single engine wrapper (`window.Game.runAdBreak(type, opts)` in `js/adBreak.js`). The 5 rules below MUST be enforced:

### Rule 1: Never Pause on a Callback That Arrives After Request Settled
If an ad request hits a 10s watchdog timeout, it marks the request as settled and resumes the game. If `adStarted` fires *after* the watchdog expires (e.g., slow network), `onStarted` must check the settled guard first:
```javascript
adStarted: () => {
    if (settled) return; // CRITICAL: A callback that cannot resume must not pause!
    pauseGame();
}
```

### Rule 2: Re-Arm the Watchdog on `adStarted` (Do Not Clear It)
`adStarted` firing proves the SDK is alive at that moment, but does not guarantee `adFinished` will follow (network drop or ad stall).
- On request entry: Set `NO_RESPONSE_TIMEOUT_MS` (10,000 ms).
- On `adStarted`: Clear the 10s timer and re-arm with `AD_STALL_TIMEOUT_MS` (90,000 ms).

### Rule 3: Stall Recovery Must Resume but Must NOT Reward
`runAdBreak` fires `onReward` **ONLY** from a genuine `adFinished`. Synthetic watchdog exits (`'ad_timeout'` or `'ad_stalled'`) invoke `onFail(code)`, which silently resumes gameplay and restores the offer without granting a reward.

### Rule 4: Enforce Single Ad Break Mutex with User Feedback
If an ad request arrives while `window.Game._adPending === true`:
- **Midgame Path:** Bails silently (unsolicited ad).
- **Rewarded Path:** Must **NOT** fail silently. It shows a toast notification (e.g., `'ad_cooldown'`) and keeps the button visible. A button click that produces no feedback appears broken to the user.

### Rule 5: Implement a Dead-Man Switch for Ad-Driven UI States
UI states driven by ad callbacks (e.g. `freeUpgradeState = 'requesting'`) must include a countdown fallback timer (`REQUEST_FALLBACK_SECONDS = 120s`). If no callback settles the state within 120s of running time, the UI automatically resets to `'waiting'` and releases `_adPending`.

---

## 5. Data Persistence (`SDK.data`)

### API Call Signatures
```typescript
namespace SDK.data {
    function setItem(key: string, value: string): void;
    function getItem(key: string): string | null;
    function removeItem(key: string): void;
    function clear(): void;
}
```

### Persistence Pattern Rules
- Saves go through CrazyGames `SDK.data` (same API as `localStorage`).
- **Guest behaviour (official SDK):** For non-logged-in players, `SDK.data` transparently stores data in `localStorage` and syncs it to the account when the player signs in (and reverts to guest data on sign-out). Do not implement your own localStorage fallback for guests.
- **Adapter degraded mode:** If the SDK itself is unavailable (adblocker or offline origin), write calls are dropped and `loadData()` returns `null` — never fall back to raw `localStorage`.
- **Retrieve before set:** Always `getItem()` before `setItem()` to avoid overwriting existing progress.
- Hard-reset sentinels (e.g., `Game.HARD_RESET_FLAG`) are saved through `SDK.data.setItem()` after `SDK.data.clear()` resolves.

### Limits & Errors
- **1 MB total** per player (JSON-stringified). Exceeding it throws `{ code: 'dataLimitExceeded', ... }` and the data is not saved.
- **Debounce:** writes are debounced ~1 second (may extend up to ~30s).
- **`dataModuleDisabled`:** thrown if the "Progress Save" toggle wasn't enabled in the submission flow.
- **Migration:** For already-published games, copy existing `localStorage` keys into `SDK.data` once so returning players keep their progress.

---

## 6. Audio Synchronization (`SDK.game.settings`)

### API Call Signatures
```typescript
interface GameSettings {
    muteAudio: boolean;    // MUST take priority over in-game audio settings
    disableChat: boolean;  // if true, disable in-game chat (multiplayer)
}

namespace SDK.game {
    const settings: GameSettings;
    function addSettingsChangeListener(callback: (settings: GameSettings) => void): void;
    function removeSettingsChangeListener(callback: (settings: GameSettings) => void): void;
}
```

### Implementation Rules
1. Platform mute state **overrides** in-game volume settings.
2. `CrazyGamesAdapter` registers `addSettingsChangeListener` and notifies the audio graph via `onAudioEnabledChange`.
3. Muting is implemented at the Web Audio Master Gain Node level (or `audioCtx.suspend()`). In-game volume sliders in cloud save are never altered.
4. A 1-second polling safety net (`isAudioEnabled()`) runs in the main game loop to auto-correct audio state if setting events are missed during boot.

---

## 7. User Identity, System Info & Auth (`SDK.user`, `SDK.environment`)

### API Call Signatures
```typescript
interface PortalUser {
    __dangerousUserId: string;   // MUST NOT be used for auth (spoofable in browser)
    username: string;            // 6-20 chars: letters, numbers, '.', '_'
    profilePictureUrl: string;
}

interface Friend {
    id: string;                  // friend id (NOT __dangerousUserId)
    username: string;
    profilePictureUrl: string;
}

interface FriendsPage {
    friends: Friend[];
    page: number;
    size: number;
    hasMore: boolean;
    total: number;
}

namespace SDK.user {
    const isUserAccountAvailable: boolean;  // sync property (v3), not a method
    function getUser(): Promise<PortalUser | null>;  // null if not logged in
    function showAuthPrompt(): Promise<PortalUser | null>;
    function getUserToken(): Promise<string>;  // 1h JWT for server-side auth
    function listFriends(opts: { page: number; size: number }): Promise<FriendsPage>; // page starts at 1, size max 50
    function addAuthListener(listener: (user: PortalUser) => void): void;
    function removeAuthListener(listener: (user: PortalUser) => void): void;
    function showAccountLinkPrompt(): Promise<{ response: 'yes' | 'no' }>;
    const systemInfo: {
        locale: string;       // BCP-47 tag, e.g. "en-US", "zh-CN"
        countryCode: string;  // ISO 3166-1 alpha-2, e.g. "US", "DE"
        device: { type: 'desktop' | 'mobile' | 'tablet' };
        os: { name: string; version: string };
        browser: { name: string; version: string };
        applicationType: 'google_play_store' | 'apple_store' | 'pwa' | 'web';
    };
}

namespace SDK {
    const environment: 'local' | 'crazygames' | 'disabled';
}
```

### Auth & Identity Rules
- **Never authenticate with `__dangerousUserId`** — it can be spoofed in the browser. For server-side auth use `getUserToken()` and verify the JWT against CrazyGames' public key (`https://sdk.crazygames.com/publicKey.json`). Do not decrypt the token client-side.
- **User token lifetime:** 1 hour; the SDK auto-refreshes. Do not store it — call `getUserToken()` each time it is needed.
- **Locale & System Info:** `systemInfo.locale` provides full BCP-47 locale tags (e.g. `"en-US"`). Safe for auto-detecting player language (match primary subtag when porting to Yandex/YouTube).
- **Auth Prompt:** Call `window.CrazyGames.SDK.user.showAuthPrompt()` to prompt guest players to log in or create an account. Errors: `showAuthPromptInProgress`, `userAlreadySignedIn`, `userCancelled`.
- **Auth listener:** A logout does NOT fire auth listeners (the page reloads instead).
- **Account link:** Use `showAccountLinkPrompt()` rather than a custom modal. Errors: `showAccountLinkPromptInProgress`, `userNotAuthenticated`.
- **listFriends errors:** `userNotAuthenticated`, `rateLimited` (250ms), `requestInProgress`, `unexpectedError`.
- **Environment:** `SDK.environment` is `'local'` (localhost/127.0.0.1), `'crazygames'`, or `'disabled'` (any other domain). On other local domains, force local mode with `?useLocalSdk=true`. Avoid calling SDK methods when `'disabled'`.

---

## 8. Banner Advertisements (`SDK.banner`)

Official Reference: [CrazyGames Banner Ads](https://docs.crazygames.com/sdk/banners/)

Display static or responsive banner ads in defined DOM containers.

```javascript
// 1. Static Banner Request
await window.CrazyGames.SDK.banner.requestBanner({
    id: "banner-container", // DOM element ID
    width: 300,             // 300, 728, 320, 468
    height: 250             // 250, 90, 50, 60, 100
});

// 2. Responsive Banner Request (stretches to container bounds)
await window.CrazyGames.SDK.banner.requestResponsiveBanner("responsive-banner-container");

// 3. Clear Banners
window.CrazyGames.SDK.banner.clearBanner("banner-container");
window.CrazyGames.SDK.banner.clearAllBanners();
```

### Supported Banner Dimensions
- **Leaderboard:** `728x90`
- **Medium Rectangle:** `300x250`
- **Mobile Banner:** `320x50`
- **Main Banner:** `468x60`
- **Large Mobile:** `320x100`

### Banner Limits & Errors
- **Refresh limits:** min 30s between refreshes of the same container; max 120 refreshes per size per session.
- The banner container must be fully inside the game window, or it won't render.
- Clear banners after hiding them (otherwise old banners may flash on the next request).
- Error codes (`{ code, message }`): `bannersDisabledBasicLaunch`, `unfilled`, `missingId`, `notVisible`, `noAvailableSizes`, `notCreated`, `videoAdPlaying`, `invalidSize`, `bannerCooldown`, `maxRefreshReached`, `bannersDisabledMobileApp`, `other`.

---

## 9. Game Progression & Context (`SDK.game`)

### A. Game Completion Percentage
Report player progression milestones (0 to 100) to optimize post-game completion user flows and platform badges:
```javascript
// Report progression milestone
window.CrazyGames.SDK.game.reportGameCompletedPercentage(50); // 50% completed
```

### B. Game Context for User Feedback
Attach relevant in-game debug data (level, inventory, score) to user feedback and bug report emails sent via the Developer Portal:
```javascript
// Set contextual state at level start
window.CrazyGames.SDK.game.setGameContext({
    level: 12,
    mode: "hardcore",
    equippedWeapon: "laser_rifle"
});

// Clear context when leaving the level
window.CrazyGames.SDK.game.clearGameContext();
```

---

## 10. Multiplayer & Invite Features (`SDK.game`)

Official Reference: [CrazyGames Game Module](https://docs.crazygames.com/sdk/game/)

Support instant matchmaking, room tracking, and native invite links:

```javascript
// 1. Check Instant Multiplayer Flag (bypasses main menu on direct match link)
const isInstant = window.CrazyGames.SDK.game.isInstantMultiplayer;

// 2. Room State Updates
window.CrazyGames.SDK.game.updateRoom({
    roomId: "room_123_eu",
    isJoinable: true,
    inviteParams: { roomName: "123", region: "eu" }
});

// Signal room full or closed
window.CrazyGames.SDK.game.updateRoom({ isJoinable: false });

// Signal player left room
window.CrazyGames.SDK.game.leftRoom();

// 3. Invite Links (synchronous — returns a link string)
const inviteUrl = window.CrazyGames.SDK.game.inviteLink({ roomName: 12345 });

// 4. Receiving invites
// On game start, check if the game was launched from an invite link:
const room = window.CrazyGames.SDK.game.getInviteParam("roomName"); // string | null
const allParams = window.CrazyGames.SDK.game.inviteParams;          // object | null

// While already in game, listen for live join attempts:
const joinListener = (inviteParams) => { /* route player to the room */ };
window.CrazyGames.SDK.game.addJoinRoomListener(joinListener);
window.CrazyGames.SDK.game.removeJoinRoomListener(joinListener);

// 5. Invite Button (DEPRECATED — prefer Room Data + inviteParams)
window.CrazyGames.SDK.game.showInviteButton({ roomName: 12345 });
window.CrazyGames.SDK.game.hideInviteButton();
```

---

## 11. Leaderboards (`SDK.user.submitScore`)

Official Reference: [CrazyGames Leaderboard SDK](https://docs.crazygames.com/sdk/leaderboards-client/)

> [!NOTE]
> **Invite-Only Feature:** CrazyGames Leaderboards are an invite-only feature requiring developer setup and approval from the CrazyGames team. Games in our portfolio are unlikely to use this feature unless specifically approved.

Submit player scores with mandatory client-side AES encryption:

```javascript
// Encrypt score with developer 32-byte Base64 key
const encryptedScore = await encryptScore(finalScore, encryptionKey);

// Submit score payload
window.CrazyGames.SDK.user.submitScore({
    score: finalScore,
    encryptedScore: encryptedScore
});
```

---

## 12. In-App Purchases & Analytics (`SDK.user`, `SDK.analytics`)

Official Reference: [In-Game Purchases](https://docs.crazygames.com/sdk/in-game-purchases/)

CrazyGames partners with Xsolla for Web Monetization and In-App Purchases:

```javascript
// 1. Get short-lived Xsolla User Token
const token = await window.CrazyGames.SDK.user.getXsollaUserToken();

// 2. Track Completed Orders in CrazyGames Analytics
window.CrazyGames.SDK.analytics.trackOrder("xsolla", {
    orderId: "xsolla_order_9981",
    status: "done"
});
```

---

## 13. Popup & Modal State Machine (`openPopupCount`)

To maintain strict `gameplayStart` / `gameplayStop` balance across nested UI modals:

- **Global Counter:** `openPopupCount` (tracks active modal overlays).
- **Element Marking:** `el.__popupCounted = true` prevents duplicate decrements when an overlay closes via multiple input events (e.g. Escape key + click).
- **State Machine Rules:**
  - Transition `0 -> 1`: Triggers `sdkGameplayStop()`.
  - Transition `1 -> 0`: Triggers `sdkGameplayStart()` (provided no ad break is pending).
- **Exclusion:** Confirmation dialogs (`.confirm-overlay`) are brief prompts and are excluded from popup tracking.

---

## 14. Engine Pause & Resume Invariants

`pauseGame()` and `resumeGame()` are the sole engine state handlers. To prevent state corruption and frozen screens:

1. **Idempotency Guard:** Both methods must early-return if `Game.isPaused` already matches the target state.
2. **Unfreeze Order:** `resumeGame()` MUST clear `isPaused` and restart the RAF loop **BEFORE** touching Web Audio or external APIs:
   ```javascript
   function resumeGame() {
       if (!Game.isPaused) return;
       
       // 1. Unfreeze engine state FIRST
       Game.isPaused = false;
       document.body.classList.remove('game-paused');
       startLoop();

       // 2. Side effects in isolated try-catch SECOND
       try {
           applyHostAudioState();
       } catch (e) {
           console.warn('Audio resume error (non-fatal):', e);
       }
   }
   ```
3. **Authoritative RAF Handle:** `startLoop()` must no-op if `rafId !== null`, and `gameLoop()` must set `rafId = null` upon observing `isPaused === true`.

