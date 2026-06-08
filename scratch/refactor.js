const fs = require('fs');
const path = require('path');

const indexHtmlPath = path.join(__dirname, '..', 'index.html');
const indexHtmlContent = fs.readFileSync(indexHtmlPath, 'utf8');

// 1. Extract CSS
const styleStart = indexHtmlContent.indexOf('<style>');
const styleEnd = indexHtmlContent.indexOf('</style>');
const cssContent = indexHtmlContent.substring(styleStart + 7, styleEnd).trim();
fs.writeFileSync(path.join(__dirname, '..', 'style.css'), cssContent, 'utf8');
console.log('Saved style.css');

// 2. Extract Javascript code block
const scriptStart = indexHtmlContent.indexOf('<script>');
const scriptEnd = indexHtmlContent.lastIndexOf('</script>');
const jsText = indexHtmlContent.substring(scriptStart + 8, scriptEnd).trim();

// Split static configs and SoundManager
const soundStartIdx = jsText.indexOf('class SoundManager');
const runStartIdx = jsText.indexOf('async function run');

// Create js/ folder if not exists
const jsDir = path.join(__dirname, '..', 'js');
if (!fs.existsSync(jsDir)) {
    fs.mkdirSync(jsDir, { recursive: true });
}

// config.js contents
const configText = jsText.substring(0, soundStartIdx).trim() + `

// Config value fetch with fallback defaults
function getConfigValue(path, defaultValue) {
    if (!window.gameConfig) return defaultValue;
    const parts = path.split('.');
    let current = window.gameConfig;
    for (const part of parts) {
        if (current[part] === undefined) return defaultValue;
        current = current[part];
    }
    return current;
}
`;
fs.writeFileSync(path.join(jsDir, 'config.js'), configText, 'utf8');
console.log('Saved js/config.js');

// sound.js contents
const soundText = jsText.substring(soundStartIdx, runStartIdx).trim();
fs.writeFileSync(path.join(jsDir, 'sound.js'), soundText, 'utf8');
console.log('Saved js/sound.js');

// Now parse the run body
const runBodyStart = jsText.indexOf('{', runStartIdx) + 1;
const runBodyEnd = jsText.lastIndexOf('// Auto-run the game');
const closingBraceIdx = jsText.lastIndexOf('}', runBodyEnd);
const runBodyText = jsText.substring(runBodyStart, closingBraceIdx).trim();

// Split runBodyText into:
// - initCode: from start to '// Game States'
// - variables: from '// Game States' to '// Persistence functions'
// - stateFuncs: from '// Persistence functions' to '// Generate space starfield background'
// - planetFuncs: from '// Generate space starfield background' to 'function spawnWeapon'
// - weaponsFuncs: from 'function spawnWeapon' to 'function update(deltaTime)'
// - engineFuncs: from 'function update(deltaTime)' to end

const initEndIdx = runBodyText.indexOf('// Game States');
const varEndIdx = runBodyText.indexOf('// Persistence functions');
const stateFuncsEndIdx = runBodyText.indexOf('// Generate space starfield background');
const planetFuncsEndIdx = runBodyText.indexOf('function spawnWeapon');
const weaponsFuncsEndIdx = runBodyText.indexOf('function update(deltaTime)');

let initCode = runBodyText.substring(0, initEndIdx).trim();
// Remove getConfigValue from initCode since it's now in config.js
initCode = initCode.replace(/\/\/\s*Config value fetch[\s\S]*?function getConfigValue\([\s\S]*?return current;\s*\}/, '');

let variables = runBodyText.substring(initEndIdx, varEndIdx).trim();
variables = variables.split('\n').filter(line => {
    const trimmed = line.trim();
    if (trimmed.startsWith('let dt60 = 1;')) return false;
    if (trimmed.startsWith('const weaponQueues = {};')) return false;
    return true;
}).join('\n');
let stateFuncs = runBodyText.substring(varEndIdx, stateFuncsEndIdx).trim();
// Fix canvas-dependent variables that fail at load-time in state.js
stateFuncs = stateFuncs
    .replace('let planetCenterX = hiddenCanvas.width / 2; // 200', 'let planetCenterX = 230; // 200')
    .replace('let planetCenterY = hiddenCanvas.height / 2; // 200', 'let planetCenterY = 230; // 200');
stateFuncs = stateFuncs.split('\n').filter(line => {
    const trimmed = line.trim();
    if (trimmed.startsWith('let dt60 = 1;')) return false;
    if (trimmed.startsWith('const weaponQueues = {};')) return false;
    return true;
}).join('\n');
let planetFuncs = runBodyText.substring(stateFuncsEndIdx, planetFuncsEndIdx).trim();
let weaponsFuncs = runBodyText.substring(planetFuncsEndIdx, weaponsFuncsEndIdx).trim();
let engineFuncs = runBodyText.substring(weaponsFuncsEndIdx).trim();

// Extract translations block from engineFuncs so it becomes global in state.js
const translationsStartIdx = engineFuncs.indexOf('// Translations system');
const translationsEndIdx = engineFuncs.indexOf('function getUnlockText');
let translationsBlock = '';
if (translationsStartIdx !== -1 && translationsEndIdx !== -1) {
    translationsBlock = engineFuncs.substring(translationsStartIdx, translationsEndIdx).trim();
    engineFuncs = engineFuncs.substring(0, translationsStartIdx) + '\n' + engineFuncs.substring(translationsEndIdx);
}

// Clean up initCode const/let declarations that need to be global
initCode = initCode
    .replace('const canvas =', 'canvas =')
    .replace('const ctx =', 'ctx =')
    .replace('const hiddenCanvas =', 'hiddenCanvas =')
    .replace('const hiddenCtx =', 'hiddenCtx =')
    .replace('const bgCanvas =', 'bgCanvas =')
    .replace('const bgCtx =', 'bgCtx =')
    .replace('const soundManager =', 'soundManager =')
    .replace('const fistImage =', 'fistImage =')
    .replace('const SCREEN_W =', 'SCREEN_W =')
    .replace('const SCREEN_H =', 'SCREEN_H =')
    .replace('const CENTER_X =', 'CENTER_X =')
    .replace('const CENTER_Y =', 'CENTER_Y =')
    .replace('const PLANET_CANVAS_SIZE =', 'PLANET_CANVAS_SIZE =')
    .replace('const MAX_COOLDOWNS =', 'MAX_COOLDOWNS =')
    .replace('let dt60 = 1;', 'dt60 = 1;')
    .replace('const weaponQueues = {};', 'weaponQueues = {};');

// Also, extract addFloatingText and showUnlockNotification from initCode, since they should be global functions
const addFloatingTextIdx = initCode.indexOf('function addFloatingText');
const showUnlockNotificationIdx = initCode.indexOf('function showUnlockNotification');
const canvasSetupIdx = initCode.indexOf('const gameWorld =');

// Split initCode into:
// - initCodeBeforeFuncs
// - addFloatingTextFunc
// - showUnlockNotificationFunc
// - initCodeAfterFuncs
const initCodeBeforeFuncs = initCode.substring(0, addFloatingTextIdx).trim();
const addFloatingTextFunc = initCode.substring(addFloatingTextIdx, showUnlockNotificationIdx).trim();
const showUnlockNotificationFunc = initCode.substring(showUnlockNotificationIdx, canvasSetupIdx).trim();
const initCodeAfterFuncs = initCode.substring(canvasSetupIdx).trim();



// Write js/state.js
const stateContent = `// Game State, Globals & Persistence
var canvas, ctx, hiddenCanvas, hiddenCtx, bgCanvas, bgCtx, soundManager, fistImage;
var SCREEN_W = 1600;
var SCREEN_H = 900;
var CENTER_X = 800;
var CENTER_Y = 450;
var PLANET_CANVAS_SIZE = 460;
var MAX_COOLDOWNS;
var dt60 = 1;
var weaponQueues = {};

${variables}

${addFloatingTextFunc}

${showUnlockNotificationFunc}

${stateFuncs}

${translationsBlock}
`;
fs.writeFileSync(path.join(jsDir, 'state.js'), stateContent, 'utf8');
console.log('Saved js/state.js');

// Write js/planet.js
const planetContent = `// Planet Procedural Generation & Destruction Logic
${planetFuncs}
`;
fs.writeFileSync(path.join(jsDir, 'planet.js'), planetContent, 'utf8');
console.log('Saved js/planet.js');

// Write js/weapons.js
const weaponsContent = `// Weapons Physics & Interaction Logic
${weaponsFuncs}
`;
fs.writeFileSync(path.join(jsDir, 'weapons.js'), weaponsContent, 'utf8');
console.log('Saved js/weapons.js');

// Write js/main.js
const mainContent = `// Core Game Engine & Main Loop
${initCodeBeforeFuncs}

async function run(mode) {
    // Initialize global canvas and contexts
    ${initCodeAfterFuncs}

    ${engineFuncs}
}

// Auto-run the game in local mode
window.addEventListener('DOMContentLoaded', () => {
    run('play');
});
`;
fs.writeFileSync(path.join(jsDir, 'main.js'), mainContent, 'utf8');
console.log('Saved js/main.js');

// 4. Save index.html skeleton
const cleanHtml = indexHtmlContent.substring(0, styleStart) +
`<link rel="stylesheet" href="style.css">
</head>
<body>` +
indexHtmlContent.substring(indexHtmlContent.indexOf('<div id="game-world">'), indexHtmlContent.indexOf('<script>')) +
`<script src="js/config.js"></script>
    <script src="js/sound.js"></script>
    <script src="js/state.js"></script>
    <script src="js/planet.js"></script>
    <script src="js/weapons.js"></script>
    <script src="js/main.js"></script>
</body>
</html>`;

fs.writeFileSync(indexHtmlPath, cleanHtml, 'utf8');
console.log('Saved index.html skeleton');
