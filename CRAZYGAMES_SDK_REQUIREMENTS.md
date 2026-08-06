# CrazyGames SDK — Complete Integration Requirements Reference

This document consolidates every requirement, guideline, API contract, limit, and error code from the
official [CrazyGames SDK documentation](https://docs.crazygames.com/sdk/intro/) into a single game-agnostic
reference. It is written for teams integrating any game (HTML5, Unity, GameMaker, Construct, Godot, Cocos)
against the CrazyGames SDK v3. Where the docs give per-engine wrappers, this document describes the HTML5
API, which is the canonical surface; the other engines mirror it.

> **Source of truth:** always confirm against https://docs.crazygames.com. SDK modules and requirements
> evolve. Each section below notes the upstream page(s) it is derived from.

---

## Table of Contents

1. [Implementation tiers (Basic vs Full)](#1-implementation-tiers-basic-vs-full)
2. [Setup & initialization](#2-setup--initialization)
3. [Environment detection & local testing](#3-environment-detection--local-testing)
4. [Sitelock](#4-sitelock)
5. [Game module](#5-game-module)
6. [Data module](#6-data-module)
7. [Video ads module](#7-video-ads-module)
8. [Banner module](#8-banner-module)
9. [User module](#9-user-module)
10. [In-game purchases (Xsolla)](#10-in-game-purchases-xsolla)
11. [Leaderboards](#11-leaderboards)
12. [Advertisement requirements (cross-cutting)](#12-advertisement-requirements-cross-cutting)
13. [Final integration checklist](#13-final-integration-checklist)

---

## 1. Implementation tiers (Basic vs Full)

Source: [Requirements / Introduction](https://docs.crazygames.com/requirements/intro/)

CrazyGames ships games in two phases. These determine how much SDK work is mandatory.

| Category | Basic Implementation | Full Implementation |
|---|---|---|
| Technical | Initial download ≤ 50 MB; total ≤ 250 MB (50 MB without SDK); ≤ 1500 files | Everything in Basic **plus** SDK and `gameplayStart` event |
| Gameplay | Basic visual QA; PEGI 12 | Full visual QA; land directly in gameplay |
| Advertisement | Monetization disabled; no external ads | Ads only through the SDK, per ad guidelines; works with AdBlock |
| Account integration | (only when applicable) no external login options | Progress linked to CrazyGames Account; use CrazyGames username & avatar; automatic login |
| Multiplayer | (only when applicable) optional | Room info, invite link, instant-multiplayer flow, rooms across rounds, `disableChat` |
| In-game purchases | Not available | Invite only; Xsolla + CrazyGames `userId` |

- **Basic Launch:** SDK is optional, monetization is not available.
- **Full Launch:** all requirements below apply. A Full implementation must also satisfy the Basic requirements.

---

## 2. Setup & initialization

Source: [SDK / Introduction](https://docs.crazygames.com/sdk/intro/)

### 2.1 Loading the SDK

Load the v3 SDK script **before** game code:

```html
<script src="https://sdk.crazygames.com/crazygames-sdk-v3.js"></script>
```

### 2.2 Manual initialization is mandatory

The v3 SDK **must** be manually initialized and the promise awaited before any other SDK call:

```js
await window.CrazyGames.SDK.init();
```

- Initialization is asynchronous; the SDK is unusable until it resolves.
- Do this on the loading screen, **before the game starts**.
- The SDK preloads all user data during initialization, which can take time depending on stored data.
- The SDK only accepts promises — there is **no callback parameter**. Use `await` or `.then(...).catch(...)`.
- On a stub/disabled SDK (rehosted domain, server-side fail mode) `init()` may resolve but module getters
  can **throw on access**. Always probe modules before use and wrap reads in try/catch.

### 2.3 SDK modules

| Module | Purpose |
|---|---|
| `SDK.ad` | Video ads (midgame, rewarded), adblock detection |
| `SDK.banner` | In-game banner ads |
| `SDK.game` | Game lifecycle events, settings, completion, context, multiplayer |
| `SDK.user` | Signed-in user identity, friends, tokens, auth |
| `SDK.data` | Cross-device persistent user data (localStorage-compatible API) |
| In-game purchases | Xsolla payments (not a separate module; uses `SDK.user`) |

### 2.4 v3 vs v2 breaking changes

- The SDK requires manual initialization now.
- Some async getters are now plain variables: `SDK.environment`, `SDK.user.isUserAccountAvailable`, `SDK.user.systemInfo`.
- Loading methods renamed: `sdkGameLoadingStart()`/`sdkGameLoadingStop()` → `loadingStart()`/`loadingStop()`.
- v3 errors are consistently `{ code, message }` objects (v2 mixed strings and objects).

---

## 3. Environment detection & local testing

Source: [SDK / Introduction](https://docs.crazygames.com/sdk/intro/) § "Development & Testing"

### 3.1 Environments

| Environment | When | Behavior |
|---|---|---|
| `local` | `localhost`, `127.0.0.1`, or `?useLocalSdk=true` | Ads show an overlay text; SDK console logging enabled; demo user data; demo banners |
| `crazygames` | `crazygames.*` domains | Full functionality |
| `disabled` | Any other domain | All SDK method calls **throw** |

The current environment:

```js
window.CrazyGames.SDK.environment; // "local" | "crazygames" | "disabled"
```

**Requirement:** avoid making SDK calls when the environment is `disabled`. Check the environment (or gate
all SDK access behind successful init + functional module probes) before calling SDK methods, and make sure
no SDK call throws an unhandled exception in fallback mode.

### 3.2 Local testing

- Run on `localhost`/`127.0.0.1` to force `local` mode; append `?useLocalSdk=true` to force it on other local IPs.
- In `local` mode the user module returns hardcoded values. Customize via query params:
  - `?user_account_available=false` — `isUserAccountAvailable` returns `false` (default `true`).
  - `?show_auth_prompt_response=user1|user2|user_cancelled`
  - `?link_account_response=yes|no|logged_out`
  - `?user_response=user1|user2|logged_out`
  - `?token_response=user1|user2|expired_token|logged_out`
- The Xsolla token method only works on `crazygames.com`; test via the Developer Portal preview tool.

---

## 4. Sitelock

Source: [Resources / HTML5 / Sitelock](https://docs.crazygames.com/resources/html5/sitelock/)

- Sitelocking prevents your game from being copied and hosted on unauthorized websites.
- For HTML5 games, check that the game runs on valid CrazyGames domains. The documented helper:

```js
function isCrazyGames() {
    const hostname = window.location.hostname;
    const parts = hostname.split(".");
    const idx = parts.indexOf("crazygames");
    return idx !== -1 && idx >= parts.length - 3;
}
```

- If the check fails, show a message (e.g. "Available only on CrazyGames") or render a blank screen.
- Obfuscating relevant game code (e.g. with obfuscator.io) improves robustness.
- **Iframe games:** configure the CSP header `Content-Security-Policy: frame-ancestors [...]` and whitelist
  **all** CrazyGames regional domains (`*.crazygames.com`, `crazygames.*`, plus the exhaustive domain list
  in the docs — video ads run on `games.crazygames.com`).
- **Requirement:** never lock out legitimate players. Keep real players unlocked even if the SDK script is
  blocked (e.g. by an adblocker) on the genuine site.

---

## 5. Game module

Source: [SDK / Game](https://docs.crazygames.com/sdk/game/)

### 5.1 Game settings (`SDK.game.settings`)

Full Implementation requires `muteAudio` support for HTML5, Unity, Cocos, and Construct.

- `settings.muteAudio` — if `true`, disable game audio. **Must take priority over in-game audio settings.**
  If the game has its own audio toggle, it must not re-enable audio while the SDK says muted.
- `settings.disableChat` — if `true`, disable chat (if the game has chat). Only relevant for multiplayer games.
- Register a change listener:

```js
function listener(newSettings) { /* re-read muteAudio / disableChat */ }
window.CrazyGames.SDK.game.addSettingsChangeListener(listener);
window.CrazyGames.SDK.game.removeSettingsChangeListener(listener);
```

### 5.2 Gameplay start/stop

Track when the user is actively playing.

- Call `gameplayStart()` whenever the player starts or resumes playing (game start, resume, revive, next level...).
  The first event determines the game's initial loading size.
- Call `gameplayStop()` on every game break: entering a menu, ending a level, pausing.
  Resume with `gameplayStart()` when gameplay resumes.
- **Do NOT call `gameplayStop()` when the user switches focus or leaves the game area** — CrazyGames handles
  this on their side. (`visibilitychange`/`blur` handlers should not call it.)

### 5.3 Game loading start/stop

- Call `loadingStart()` when you start loading the game.
- Call `loadingStop()` when loading is complete and gameplay is about to start.
- Not supported/required for some engines (Unity, Godot, GameMaker use the engine's own loader).

### 5.4 Happy time

`gameplay`-adjacent celebration:

```js
window.CrazyGames.SDK.game.happytime();
```

- Call on special player achievements (beating a boss, reaching a high score).
- **Use sparingly** — the celebration should remain a special moment.
- **Not** for every level completion or item obtained.

### 5.5 Game completion percentage

```js
window.CrazyGames.SDK.game.reportGameCompletedPercentage(50); // 0-100
```

- Notifies CrazyGames that a player completed the game or reached a progression milestone.
- Accepts a value between 0 and 100. Reporting only 100 is enough, but intermediate updates are encouraged.
- Progression should **generally move forward over time**; report 100 only at a meaningful completion point.
- If the game has clear progression (levels/chapters), report progress as the player advances.
- For endless/sandbox games, define your own consistent interpretation of 100%.
- **On update with new content:** report the updated percentage on game start (a former 100% player may now be lower).
- Not supported on Unity, GameMaker, Godot, Construct, Cocos.

### 5.6 Game context (optional)

Attach in-game state to player feedback:

```js
window.CrazyGames.SDK.game.setGameContext({ "level": 12 });
window.CrazyGames.SDK.game.clearGameContext(); // when leaving the level
```

### 5.7 Multiplayer features (only when applicable)

- `SDK.game.isInstantMultiplayer` — direct users to a joinable multiplayer location.
- `SDK.game.updateRoom({ roomId, isJoinable, inviteParams })` and `SDK.game.leftRoom()` — report room state.
- `SDK.game.addJoinRoomListener(fn)` / `removeJoinRoomListener(fn)`; check `SDK.game.inviteParams` on game start.
- `SDK.game.inviteLink(params)` / `SDK.game.getInviteParam(key)` — generate/read invite links.
- `SDK.game.showInviteButton(...)` / `hideInviteButton()` — deprecated, replaced by room data.

---

## 6. Data module

Source: [SDK / Data](https://docs.crazygames.com/sdk/data/)

### 6.1 What it does

- Saves and retrieves user data for **logged-in** CrazyGames users; synced across all devices where the user plays.
- For **guest** (not logged-in) users, the module stores data in `localStorage` **internally**. When the guest
  signs in, the SDK automatically syncs/transfers that data to the account; when they sign out, the SDK
  reverts to guest data. No game code is required for this.

### 6.2 API

Identical to `localStorage`:

```ts
clear(): void;
getItem(key: string): string | null;
removeItem(key: string): void;
setItem(key: string, value: string): void;
```

Example:

```js
window.CrazyGames.SDK.data.setItem("gold", 100);
```

### 6.3 Mandatory requirements

- **Initialize first:** call `await window.CrazyGames.SDK.init()` before using any data-module method.
  The SDK preloads all game data during init, so init on the loading screen.
- **Submission toggle:** if you use the data module, you must select the appropriate *Progress Save* toggle in
  the submission flow, or the module is disabled (`dataModuleDisabled` error).
- **Fully rely on the data module:** for both guest and logged-in users on CrazyGames, rely on the Data Module
  save and **avoid relying on local saves** — the docs state this is required for the Data Module to work correctly.
- **Read before write:** retrieve data before setting data so previous progress isn't lost.

### 6.4 Limits & behavior

- **1 MB** maximum stored user data (per save). Approaching it logs console warnings; data stops being backed up past 1 MB.
- **Debounce:** writes are debounced ~1 second (up to 30 seconds in edge cases).

### 6.5 Errors

The module can throw errors shaped `{ code, message }`. Known codes:

| Code | Meaning |
|---|---|
| `dataLimitExcedeed` | JSON string exceeds 1 MB; data was not saved |
| `dataModuleDisabled` | Progress Save toggle not selected at submission |
| `other` | Unknown error |

Handle thrown errors gracefully (don't crash the save path).

### 6.6 Migrating an already-published game

If your game previously saved to browser `localStorage`, run a **one-time migration**: copy existing
`localStorage` keys into the data module so returning players keep their progress. The docs recommend this for
games that already had a published version using local saves.

---

## 7. Video ads module

Source: [SDK / Video ads](https://docs.crazygames.com/sdk/video-ads/) + [Advertisement requirements](https://docs.crazygames.com/requirements/ads/)

### 7.1 Ad types

| Type | Use case |
|---|---|
| `midgame` | Between levels, after a death, at a level transition |
| `rewarded` | User requests an ad in exchange for a reward (extra life, retry, bonus, etc.) |

Request:

```js
window.CrazyGames.SDK.ad.requestAd("midgame", {
    adStarted: () => {},
    adFinished: () => {},
    adError: (error) => {},
});
```

### 7.2 Callbacks

- `adStarted` — the ad actually started playing.
- `adFinished` — the ad completed; **for rewarded ads, grant the reward here**.
- `adError` — also triggered when the ad is **unfilled** or something else goes wrong; the game must continue
  normally and the player must **not** be rewarded on `adError`.

### 7.3 Pause/mute requirements

- **Pause the game** so the user cannot progress while requesting or showing an ad. Block UI until either
  `adFinished` or `adError` (an ad request runs several auctions and is not instantaneous).
- **Mute the game when the ad starts** (`adStarted`), unmute when it finishes or fails (`adFinished`/`adError`).
- **Do not mute when merely requesting** an ad — only when it actually starts playing (an unfilled request
  must not cause a silent-game blink).

### 7.4 Adblock detection

```js
const result = await window.CrazyGames.SDK.ad.hasAdblock();
```

- Games must function even when the user has an adblocker. Never block adblock users from playing or penalize them.
- You may gate special features on adblock status, but show a notice and do **not** use popups, and do **not**
  keep rewarded-ad buttons clickable without effect.

### 7.5 Midgame ad frequency

- The SDK automatically controls midgame frequency: max 1 midgame every **3 minutes**, interplaying with
  rewarded and preroll ads. A request that is too early is **ignored** by the SDK (`adCooldown`) with no user impact.
- You may request a midgame ad at any opportune moment without managing minimum intervals.

### 7.6 Ad error codes

```json
{ "code": "unfilled", "message": "No ad available" }
```

Possible codes:

- `adsDisabledBasicLaunch` — Basic Launch has ads disabled
- `unfilled` — no ad available
- `adblock` — an adblocker prevents ads
- `adCooldown` — requested too soon (midgame interval ~3 min, considering rewarded/preroll)
- `other`

---

## 8. Banner module

Source: [SDK / Banners](https://docs.crazygames.com/sdk/banners/)

### 8.1 Static banners

Sizes:

- Leaderboard `728x90`
- Medium `300x250`
- Mobile `320x50`
- Main `468x60`
- Large Mobile `320x100`

HTML5 requires a container element of the banner size present on the page, then:

```js
await window.CrazyGames.SDK.banner.requestBanner({
    id: "banner-container",
    width: 300,
    height: 250,
});
```

### 8.2 Responsive banners

`requestResponsiveBanner(containerId)` picks from sizes: `970x90, 320x50, 160x600, 336x280, 728x90, 300x600,
468x60, 970x250, 300x250, 250x250, 120x600`. Only sizes that fit the container render; the banner is centered
in the container. If nothing fits, no ad renders.

### 8.3 Refresh & clear

- Refresh by calling `requestBanner`/`requestResponsiveBanner` again with the same container id.
- Clearing: `SDK.banner.clearBanner(id)` and `SDK.banner.clearAllBanners()`.
- **Recommendation:** clear banners after hiding them, so stale banners don't flash when new ones are requested.

### 8.4 Limitations

- Minimum **30 seconds** between banner refreshes per container (`bannerCooldown`).
- Up to **120 refreshes per gaming session** (per banner size).
- The banner must be **fully inside the game window** (else `notVisible`).
- Same banner can only be re-displayed 30 s after last display.

### 8.5 Banner error codes

- `bannersDisabledBasicLaunch` — Basic Launch disables banners
- `unfilled` — no banner available
- `missingId` — banner id not provided
- `notVisible` — container not fully visible (off-page or hidden)
- `noAvailableSizes` — responsive request matches no available size
- `notCreated` — container element not present
- `videoAdPlaying` — banners cannot render/refresh during a video ad
- `invalidSize` — only the documented sizes are valid
- `bannerCooldown` — refreshed too quickly (< 30 s)
- `maxRefreshReached` — per-session refresh limit reached
- `bannersDisabledMobileApp` — banners disabled in the mobile app
- `other`

---

## 9. User module

Source: [SDK / User](https://docs.crazygames.com/sdk/user/)

### 9.1 Check availability

User account functionality is not available on domains that embed your game. Always check before using account features:

```js
const available = window.CrazyGames.SDK.user.isUserAccountAvailable;
```

### 9.2 Get current user

```js
const user = await window.CrazyGames.SDK.user.getUser(); // null if not logged in
```

User object shape: `{ "__dangerousUserId", "username", "profilePictureUrl" }`.
Usernames are 6–20 chars (letters, numbers, period, underscore).

**Security:** `__dangerousUserId` must **not** be used for authentication (anyone can inject IDs client-side).
Use the user token for authentication instead.

### 9.3 System info & locale

```js
const systemInfo = window.CrazyGames.SDK.user.systemInfo;
```

Includes `countryCode`, `locale`, `device.type` (`desktop`/`tablet`/`mobile`), `os`, `browser`, `applicationType`
(`google_play_store`/`apple_store`/`pwa`/`web`).

- **Use the `locale` field** to automatically set the game language based on user location.

### 9.4 Friends

```js
const friendsPage = await window.CrazyGames.SDK.user.listFriends({ page: 1, size: 10 }); // page starts at 1, max size 50
```

Response: `{ friends: [...], page, size, hasMore, total }`.
Errors: `userNotAuthenticated`, `rateLimited` (calls limited every 250 ms), `requestInProgress` (only one active call), `unexpectedError`.

### 9.5 User token

```js
const token = await window.CrazyGames.SDK.user.getUserToken();
```

- Token contains `userId`, `gameId`, `username`, `profilePictureUrl`, `iat`, `exp`.
- **1-hour lifetime**; the SDK handles refresh. Don't store the token — call this method when needed.
- Send the token to your server to authenticate; verify/decode there (do **not** decrypt on the client).
- Verify with the public key at `https://sdk.crazygames.com/publicKey.json` (re-fetch every time; it may change).
- Errors: `userNotAuthenticated`, `unexpectedError`.

### 9.6 Auth prompt

```js
const user = await window.CrazyGames.SDK.user.showAuthPrompt();
```

Shows the CrazyGames login/register popup. Errors: `showAuthPromptInProgress`, `userAlreadySignedIn`, `userCancelled`.

### 9.7 Auth listener

```js
const listener = (user) => { /* re-fetch progress from back-end if using account identity */ };
window.CrazyGames.SDK.user.addAuthListener(listener);
window.CrazyGames.SDK.user.removeAuthListener(listener);
```

- Fires when the player logs in. **A logout does not trigger the listener** — the whole page refreshes on logout.
- If you rely on the data module or automatic progress save, CrazyGames auto-reloads the game on login; otherwise
  re-fetch the player's progress from your back-end on login.

### 9.8 Account link prompt

For linking CrazyGames accounts to in-game accounts, use the provided modal:

```js
const response = await window.CrazyGames.SDK.user.showAccountLinkPrompt();
// response: { "response": "yes" } | { "response": "no" }
```

Errors: `showAccountLinkPromptInProgress`, `userNotAuthenticated`.

### 9.9 Xsolla token

See [Section 10](#10-in-game-purchases-xsolla).

---

## 10. In-game purchases (Xsolla)

Source: [SDK / In-game purchases](https://docs.crazygames.com/sdk/in-game-purchases/)

### 10.1 Access & prerequisites

- **Invite only** — contact CrazyGames to enable it.
- **Signed-in users only:** purchases must only be available to signed-in users; guest users must not be able to purchase.
- Requires the **User module** (if you have a back-end) or the **Data module** (to save progress securely).
- If using an external payment flow, **disable it in the CrazyGames App** when `applicationType` is
  `google_play_store` or `apple_store`.

### 10.2 Getting the Xsolla token

```js
const token = await window.CrazyGames.SDK.user.getXsollaUserToken();
```

- Tokens are short-lived (~1 hour); the SDK handles refresh — retrieve before each use.
- Two auth paths:
  - **Standard (linked to CrazyGames accounts):** generate credentials via the developer portal; purchases are
    linked to the CrazyGames account automatically.
  - **Custom (your in-game accounts):** reference the CrazyGames `userId` as the order identifier, or pass it as
    `crazyGamesUserId` in `custom_parameters`.
- Works only on `crazygames.com`; test with the Developer Portal preview. Use **sandbox** orders for initial
  testing and disable sandbox before submission.

### 10.3 Order tracking

- Track successful orders with the analytics module:

```js
window.CrazyGames.SDK.analytics.trackOrder("xsolla", order); // order is a JSON object
```

- Common order statuses: `new`, `done`, `canceled`. Track `done` (required) and ideally `new`/`canceled`.

### 10.4 Payment handling requirements

- Use the CrazyGames account ID to register purchases.
- Provide a working **close** button so players can resume the session.
- If the PayStation opens in a new tab, notify players (text only) that they should allow browser popups.
- Hide the "Back to the game" hyperlink after successful payment (set *Manual redirect condition* to None).
- Correctly handle payment statuses to avoid charging without crediting:
  - Use **Webhooks** to get order status on your API, and/or
  - Use **Xsolla Inventory** to retrieve player purchases, and/or
  - Use **client-side order tracking** (validated through webhooks/inventory). Avoid navigating away from the
    shop screen until the purchase is attributed.
- Hide/disable purchases in the CrazyGames App on mobile (unsupported flow).

### 10.5 Loot box / randomized-content restrictions

Sales of randomized-content items (loot boxes, wheel-of-fortune, card packs, etc.) are restricted in:

- **Belgium, China, Netherlands, Serbia, Slovakia** — always restricted.
- **Taiwan, South Korea** — restricted unless acquisition probabilities are disclosed per item (by equal `weight`).
- **Japan** — restricted if an item's value can be lower than the price paid, or if the ToS lacks a real-money
  trading (RMT) and secondary-market trading prohibition.

---

## 11. Leaderboards

Source: [SDK / Leaderboards SDK](https://docs.crazygames.com/sdk/leaderboards-client/)

### 11.1 Score encryption (required)

Encrypt scores before submission to resist tampering. The docs provide an AES-GCM reference implementation
(`encryptScore(score, encryptionKey)` with a random 12-byte IV, using `window.crypto.subtle`).

### 11.2 Submitting a score

Pass **both** the encrypted and the plain score:

```js
const encryptedScore = await encryptScore(finalScore, encryptionKey);
CrazyGames.SDK.user.submitScore({
    encryptedScore: encryptedScore,
    score: finalScore,
});
```

### 11.3 Testing

- Use the Developer Portal preview tool; a `submitScore` message appears in logs/console.
- The server response is always "successful"; validation happens server-side.

---

## 12. Advertisement requirements (cross-cutting)

Source: [Requirements / Advertisement](https://docs.crazygames.com/requirements/ads/)

Applies to Full Implementation.

- **Only ads through the CrazyGames SDK are allowed.** No external ad networks.
- In-game ads and purchases must not appear before a reasonable amount of gameplay.

### 12.1 Video ads

- **Never interrupt active gameplay.** Show midgame ads at logical points: level transition, map change, player
  death, etc. Do **not** show a midgame ad on a navigational button (main-menu icon, settings, shop).
- **Pause the game** during an ad request and display; block interaction until `adFinished` or `adError`.
- **Handle unfilled calls** (`adError`) correctly and keep the game going.
- **Mute the game during the ad**, only once the ad actually starts.
- Don't worry about midgame frequency — the SDK enforces the ~3-minute max.

### 12.2 Rewarded ads

Rewarded ads must be a special, optional opportunity — never an expectation or a requirement to progress.

- **Placement & frequency:**
  - Do not offer rewarded ads too often; show a timer or hide the request button.
  - Do **not** chain multiple rewarded ads for a single reward.
  - Do not promote them aggressively.
  - The request button must **not** appear on an active gameplay screen (e.g. not during a race).
- **Reward UI:**
  - Button easily accessible in a consistent location; not misleading; the "continue without watching" option
    must be the same size/font/color as the ad button.
  - It must be immediately clear the reward is optional — never hide or delay a skip/close button.
  - It must be clear the player must watch an ad in exchange for the reward (e.g. a video icon).
  - Provide an alternative to watching an ad (e.g. buy the reward with in-game currency).
- **Callbacks:**
  - On `adFinished`, clearly show the player was rewarded (animation/notification).
  - On `adError`, do **not** reward the player.
- **Out-of-lives rules:** do not offer an out-of-lives rewarded ad every death; don't combine a midgame
  "between levels" ad with a "watch rewarded to keep playing current level" — between two levels you may have
  either a midgame ad + restart **or** a rewarded keep-playing option, not both.

### 12.3 In-game banner ads

- Only on useful screens with content open at least **5 seconds** on average.
- Never during gameplay; must not block game UI at any size (including mobile).
- Must be clearly distinguishable from game content.
- **Maximum 2 in-game banners** per screen/view.
- Banners have a performance cost; keep the experience non-intrusive.

### 12.4 Adblockers

- Players with adblockers must be able to **play normally** — never block or disadvantage them.
- You may block specific features with a visible notice; never use popups (they interfere with fullscreen and
  CrazyGames adblock notices); never keep rewarded buttons clickable without effect.

---

## 13. Final integration checklist

Use this to verify a game before submission.

**Setup**
- [ ] v3 SDK script loaded before game code.
- [ ] `await SDK.init()` on the loading screen before any other SDK call.
- [ ] All SDK access gated/guarded for `local`/`crazygames` environments; safe in `disabled` environment.
- [ ] No unhandled exceptions from stub SDK module getters.

**Game**
- [ ] `gameplayStart()` on every start/resume; `gameplayStop()` on every break; **not** on `visibilitychange`/`blur`.
- [ ] `loadingStart()`/`loadingStop()` emitted around real load.
- [ ] `muteAudio` respected with priority over the in-game toggle; `disableChat` honored.
- [ ] `happytime()` used sparingly; `reportGameCompletedPercentage()` monotonic, 0–100, reported on load and on updates.

**Data**
- [ ] Progress saved via `SDK.data` only (no reliance on own local saves).
- [ ] Progress Save toggle selected in submission flow.
- [ ] Reads precede writes; errors caught; size < 1 MB.

**Ads**
- [ ] Only SDK ads; midgame at logical breaks; game paused and muted during ads; resumed on `adFinished`/`adError`.
- [ ] Rewards only on `adFinished`; `adError` never rewards; UI rules for rewarded ads met.
- [ ] Works fully with adblockers; no blocked/penalized players; no dead rewarded buttons.
- [ ] Banners: valid sizes, ≤ 2 per screen, off gameplay screens, ≥ 5 s screens, cleared after hiding.

**Account (if applicable)**
- [ ] `isUserAccountAvailable` checked before account features.
- [ ] Username/avatar from CrazyGames used for the account.
- [ ] Authentication via user token (never `__dangerousUserId`); locale from `systemInfo.locale`.

**Multiplayer (if applicable)**
- [ ] Room reporting, invite links, instant-multiplayer flow, `disableChat` handled.

**Purchases (if applicable)**
- [ ] Invite-gated, signed-in users only, Xsolla token flow, order tracking, webhook/inventory validation.
- [ ] No loot-box sales in restricted territories (or probability disclosure / ToS where required).
