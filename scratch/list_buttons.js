const fs = require('fs');
const path = require('path');

const htmlFile = path.join(__dirname, '../index.html');
const content = fs.readFileSync(htmlFile, 'utf8');

// Find all buttons
const btnRegex = /<button[^>]*class="[^"]*weapon-button[^"]*"[^>]*>([\s\S]*?)<\/button>/g;
let match;
while ((match = btnRegex.exec(content)) !== null) {
    const fullTag = match[0];
    const innerHtml = match[1];
    const idMatch = /id="([^"]+)"/.exec(fullTag);
    const id = idMatch ? idMatch[1] : 'unknown';
    console.log(`=== Button: ${id} ===`);
    console.log(innerHtml.trim());
}
