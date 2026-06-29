const fs = require('fs');
const path = require('path');

const cssFile = path.join(__dirname, '../style.css');
const content = fs.readFileSync(cssFile, 'utf8');
const lines = content.split('\n');

let currentMediaQuery = null;
let bracketCount = 0;
let inMediaQuery = false;

lines.forEach((line, idx) => {
    const trimmed = line.trim();
    if (trimmed.startsWith('@media')) {
        currentMediaQuery = trimmed;
        inMediaQuery = true;
        bracketCount = 0;
    }
    
    if (inMediaQuery) {
        if (trimmed.includes('{')) {
            bracketCount += (trimmed.split('{').length - 1);
        }
        if (trimmed.includes('}')) {
            bracketCount -= (trimmed.split('}').length - 1);
        }
        
        if (trimmed.includes('.options-toggle-wrapper') || trimmed.includes('.options-toggle')) {
            console.log(`Line ${idx + 1} inside "${currentMediaQuery}":`);
            console.log(`   ${trimmed}`);
        }
        
        if (bracketCount <= 0 && trimmed.includes('}')) {
            inMediaQuery = false;
            currentMediaQuery = null;
        }
    } else {
        if (trimmed.includes('.options-toggle-wrapper') || trimmed.includes('.options-toggle')) {
            console.log(`Line ${idx + 1} (Global Scope):`);
            console.log(`   ${trimmed}`);
        }
    }
});
