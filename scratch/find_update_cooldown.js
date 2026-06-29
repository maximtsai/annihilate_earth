const fs = require('fs');
const path = require('path');

const mainJs = path.join(__dirname, '../js/main.js');
const content = fs.readFileSync(mainJs, 'utf8');
const lines = content.split('\n');

let found = false;
lines.forEach((line, idx) => {
    if (line.includes('function updateCooldownWeapon')) {
        found = true;
    }
    if (found && idx < 1050) { // print 30 lines
        console.log(`${idx + 1}: ${line.trim()}`);
        if (line.includes('}')) {
            // let's print up to the end of the function
        }
    }
});
