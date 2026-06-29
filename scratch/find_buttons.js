const fs = require('fs');
const path = require('path');

const mainJs = path.join(__dirname, '../js/main.js');
const indexHtml = path.join(__dirname, '../index.html');

if (fs.existsSync(mainJs)) {
    const content = fs.readFileSync(mainJs, 'utf8');
    const lines = content.split('\n');
    lines.forEach((line, idx) => {
        if (line.includes('weapon-button') || line.includes('weapon-btn')) {
            console.log(`main.js:${idx + 1}: ${line.trim()}`);
        }
    });
}

if (fs.existsSync(indexHtml)) {
    const content = fs.readFileSync(indexHtml, 'utf8');
    const lines = content.split('\n');
    lines.forEach((line, idx) => {
        if (line.includes('weapon-button') || line.includes('weapon-btn')) {
            console.log(`index.html:${idx + 1}: ${line.trim()}`);
        }
    });
}
