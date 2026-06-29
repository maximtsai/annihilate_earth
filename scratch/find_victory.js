const fs = require('fs');
const path = require('path');

const jsDir = path.join(__dirname, '../js');
const files = fs.readdirSync(jsDir);

files.forEach(file => {
    const filePath = path.join(jsDir, file);
    if (fs.statSync(filePath).isFile() && file.endsWith('.js')) {
        const content = fs.readFileSync(filePath, 'utf8');
        const lines = content.split('\n');
        lines.forEach((line, index) => {
            if (line.includes('triggerVictory') && (line.includes('function') || line.includes('='))) {
                console.log(`${file}:${index + 1}: ${line.trim()}`);
            }
        });
    }
});
