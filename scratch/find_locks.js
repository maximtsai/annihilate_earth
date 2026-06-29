const fs = require('fs');
const path = require('path');

function searchDir(dir) {
    const files = fs.readdirSync(dir);
    files.forEach(file => {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            if (file !== 'node_modules' && file !== '.git' && file !== 'scratch') {
                searchDir(fullPath);
            }
        } else {
            const ext = path.extname(file);
            if (['.js', '.css', '.html'].includes(ext)) {
                const content = fs.readFileSync(fullPath, 'utf8');
                const lines = content.split('\n');
                lines.forEach((line, idx) => {
                    if (line.toLowerCase().includes('lock')) {
                        console.log(`${path.relative(path.join(__dirname, '..'), fullPath)}:${idx + 1}: ${line.trim()}`);
                    }
                });
            }
        }
    });
}

searchDir(path.join(__dirname, '..'));
