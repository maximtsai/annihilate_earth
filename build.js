const fs = require('fs');
const path = require('path');
const { minify } = require('terser');

const DIST_DIR = path.join(__dirname, 'dist');

// Order of JS files to bundle
const JS_FILES = [
    path.join(__dirname, 'js', 'platforms', 'poki.js'),
    path.join(__dirname, 'js', 'config.js'),
    path.join(__dirname, 'js', 'sound.js'),
    path.join(__dirname, 'js', 'translations.js'),
    path.join(__dirname, 'js', 'state.js'),
    path.join(__dirname, 'js', 'planet.js'),
    path.join(__dirname, 'js', 'weapons.js'),
    path.join(__dirname, 'js', 'spinner.js'),
    path.join(__dirname, 'js', 'shooting-star.js'),
    path.join(__dirname, 'js', 'main.js')
];

async function build() {
    console.log("Starting build process...");

    // 1. Recreate clean dist directory
    if (fs.existsSync(DIST_DIR)) {
        fs.rmSync(DIST_DIR, { recursive: true, force: true });
    }
    fs.mkdirSync(DIST_DIR);

    // 2. Bundle JavaScript files
    console.log("Bundling JavaScript files...");
    let bundledJsContent = '';
    JS_FILES.forEach(filePath => {
        if (!fs.existsSync(filePath)) {
            console.error(`Error: File not found - ${filePath}`);
            process.exit(1);
        }
        console.log(`- Bundling: ${path.basename(filePath)}`);
        bundledJsContent += `\n/* --- BUNDLED: ${path.basename(filePath)} --- */\n`;
        bundledJsContent += fs.readFileSync(filePath, 'utf8') + '\n';
    });
    console.log("Minifying JavaScript...");
    const minified = await minify(bundledJsContent, {
        compress: true,
        mangle: true
    });
    if (minified.error) {
        console.error('Minification failed:', minified.error);
        process.exit(1);
    }
    fs.writeFileSync(path.join(DIST_DIR, 'game.js'), minified.code, 'utf8');
    const originalKB = (Buffer.byteLength(bundledJsContent, 'utf8') / 1024).toFixed(1);
    const minifiedKB = (Buffer.byteLength(minified.code, 'utf8') / 1024).toFixed(1);
    console.log(`Successfully created dist/game.js (${originalKB} KB -> ${minifiedKB} KB)`);

    // 3. Copy style.css
    console.log("Copying style.css...");
    fs.copyFileSync(path.join(__dirname, 'style.css'), path.join(DIST_DIR, 'style.css'));

    // 4. Copy assets directory recursively
    const srcAssets = path.join(__dirname, 'assets');
    const destAssets = path.join(DIST_DIR, 'assets');
    if (fs.existsSync(srcAssets)) {
        console.log("Copying assets directory...");
        fs.mkdirSync(destAssets, { recursive: true });
        copyDirRecursive(srcAssets, destAssets);
    }

    // 5. Update index.html to load game.js instead of individual scripts
    console.log("Creating optimized index.html...");
    let htmlContent = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');

    // Replace the block of script tags with a single bundle tag
    const scriptBlockPattern = /<script\s+src=["']js\/platform-bridge\.js["']><\/script>[\s\S]*?<script\s+src=["']js\/main\.js["']><\/script>/i;
    if (scriptBlockPattern.test(htmlContent)) {
        htmlContent = htmlContent.replace(scriptBlockPattern, '<script src="game.js"></script>');
    } else {
        // Fallback replacement case by case if block is formatted differently
        htmlContent = htmlContent.replace(/<script\s+src=["']js\/platform-bridge\.js["']><\/script>/i, '<script src="game.js"></script>');
        htmlContent = htmlContent.replace(/<script\s+src=["']js\/config\.js["']><\/script>\s*/gi, '');
        htmlContent = htmlContent.replace(/<script\s+src=["']js\/sound\.js["']><\/script>\s*/gi, '');
        htmlContent = htmlContent.replace(/<script\s+src=["']js\/translations\.js["']><\/script>\s*/gi, '');
        htmlContent = htmlContent.replace(/<script\s+src=["']js\/state\.js["']><\/script>\s*/gi, '');
        htmlContent = htmlContent.replace(/<script\s+src=["']js\/planet\.js["']><\/script>\s*/gi, '');
        htmlContent = htmlContent.replace(/<script\s+src=["']js\/weapons\.js["']><\/script>\s*/gi, '');
        htmlContent = htmlContent.replace(/<script\s+src=["']js\/shooting-star\.js["']><\/script>\s*/gi, '');
        htmlContent = htmlContent.replace(/<script\s+src=["']js\/main\.js["']><\/script>\s*/gi, '');
    }

    fs.writeFileSync(path.join(DIST_DIR, 'index.html'), htmlContent, 'utf8');
    console.log("Successfully created dist/index.html");

    console.log("Build complete! Output directory: /dist");
}

function copyDirRecursive(src, dest) {
    const entries = fs.readdirSync(src, { withFileTypes: true });
    for (let entry of entries) {
        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);
        if (entry.isDirectory()) {
            fs.mkdirSync(destPath, { recursive: true });
            copyDirRecursive(srcPath, destPath);
        } else {
            fs.copyFileSync(srcPath, destPath);
        }
    }
}

build().catch(err => { console.error(err); process.exit(1); });
