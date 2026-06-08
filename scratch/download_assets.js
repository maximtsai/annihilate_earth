const fs = require('fs');
const path = require('path');
const https = require('https');

const assetMapPath = path.join(__dirname, '..', 'asset_map');
const assetsDir = path.join(__dirname, '..', 'assets');

if (!fs.existsSync(assetsDir)) {
    fs.mkdirSync(assetsDir, { recursive: true });
}

// Read and parse asset_map
let content = fs.readFileSync(assetMapPath, 'utf8');
// Find the json part
const jsonStart = content.indexOf('{');
const jsonEnd = content.lastIndexOf('}');
const jsonStr = content.substring(jsonStart, jsonEnd + 1);
const assets = JSON.parse(jsonStr);

// Helper to download a file
function downloadFile(url, destPath) {
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(destPath);
        https.get(url, (response) => {
            if (response.statusCode !== 200) {
                reject(new Error(`Failed to download ${url}: ${response.statusCode}`));
                return;
            }
            response.pipe(file);
            file.on('finish', () => {
                file.close(resolve);
            });
        }).on('error', (err) => {
            fs.unlink(destPath, () => {});
            reject(err);
        });
    });
}

async function run() {
    const keys = Object.keys(assets);
    for (const key of keys) {
        const asset = assets[key];
        const urlObj = new URL(asset.url);
        // get the file extension or guess it from type
        let ext = path.extname(urlObj.pathname);
        if (!ext) {
            ext = asset.type === 'audio' ? '.mp3' : '.webp';
        }
        const filename = `${key}${ext}`;
        const destPath = path.join(assetsDir, filename);
        
        console.log(`Downloading ${key} from ${asset.url} -> assets/${filename}...`);
        await downloadFile(asset.url, destPath);
        
        // Update URL to local path
        asset.url = `./assets/${filename}`;
    }
    
    // Save updated asset_map
    const updatedContent = `// Asset Map (Read-Only)
// Edit assets in the Media tab.
// Use these IDs to reference assets in your code:
//
// Example: assets["player_sprite"]

const assets = ${JSON.stringify(assets, null, 4)};
`;
    fs.writeFileSync(assetMapPath, updatedContent, 'utf8');
    console.log("Completed downloading all assets and updating asset_map!");
}

run().catch(console.error);
