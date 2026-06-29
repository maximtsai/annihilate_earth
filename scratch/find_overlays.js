const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../index.html');
const content = fs.readFileSync(filePath, 'utf8');
const lines = content.split('\n');

lines.forEach((line, index) => {
    if (line.includes('popup-overlay') || line.includes('popup')) {
        console.log(`${index + 1}: ${line.trim()}`);
    }
});
