const fs = require('fs');
const path = require('path');

const mainJs = path.join(__dirname, '../js/main.js');
const content = fs.readFileSync(mainJs, 'utf8');
const lines = content.split('\n');

lines.forEach((line, idx) => {
    if (line.includes('unlockedWeapons =') || line.includes('weaponOrder =')) {
        console.log(`${idx + 1}: ${line.trim()}`);
    }
});
