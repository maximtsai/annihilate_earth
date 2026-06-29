const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../style.css');
const content = fs.readFileSync(filePath, 'utf8');

const targets = ['#ui-container', '.ui-overlay', '.options-toggle-wrapper', '.options-toggle'];
targets.forEach(target => {
    console.log(`=== Matches for ${target} ===`);
    let idx = 0;
    while ((idx = content.indexOf(target, idx)) !== -1) {
        // Print the block around it
        const start = Math.max(0, idx - 50);
        const end = Math.min(content.length, idx + 250);
        console.log(content.slice(start, end));
        console.log('-----------------------------------');
        idx += target.length;
    }
});
