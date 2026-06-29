const fs = require('fs');
const path = require('path');

const styleCss = path.join(__dirname, '../style.css');
const content = fs.readFileSync(styleCss, 'utf8');
const lines = content.split('\n');

lines.forEach((line, idx) => {
    if (line.includes('cooldown')) {
        console.log(`${idx + 1}: ${line.trim()}`);
    }
});
