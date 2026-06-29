const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../style.css');
const content = fs.readFileSync(filePath, 'utf8');
const lines = content.split('\n');

lines.forEach((line, index) => {
    if (line.includes('.options-toggle-wrapper {')) {
        console.log(`${index + 1}: ${line.trim()}`);
    }
});
