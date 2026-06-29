const fs = require('fs');
const path = require('path');

const htmlFile = path.join(__dirname, '../index.html');
const content = fs.readFileSync(htmlFile, 'utf8');

const idx = content.indexOf('id="options-popup-overlay"');
if (idx !== -1) {
    const start = content.lastIndexOf('<div', idx);
    console.log(content.substring(start, start + 5000));
} else {
    console.log("Not found");
}
