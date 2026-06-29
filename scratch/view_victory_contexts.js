const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../js/main.js');
const content = fs.readFileSync(filePath, 'utf8');
const lines = content.split('\n');

const lineNumbers = [1231, 2139, 2427];
lineNumbers.forEach(ln => {
    console.log(`=== Line ${ln} ===`);
    for (let i = -5; i <= 5; i++) {
        const index = ln - 1 + i;
        if (index >= 0 && index < lines.length) {
            console.log(`${index + 1}: ${lines[index]}`);
        }
    }
    console.log('----------------------------');
});
