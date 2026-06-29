const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../js/translations.js');
let content = fs.readFileSync(filePath, 'utf8');

const additions = {
    'en': {
        planetBuilder: 'PLANET BUILDER',
        comingSoon: 'COMING SOON'
    },
    'zh-CN': {
        planetBuilder: '星球建造器',
        comingSoon: '即将推出'
    },
    'zh-TW': {
        planetBuilder: '星球建造器',
        comingSoon: '即將推出'
    },
    'es': {
        planetBuilder: 'CREADOR DE PLANETAS',
        comingSoon: 'PRÓXIMAMENTE'
    },
    'fr': {
        planetBuilder: 'CRÉATEUR DE PLANÈTES',
        comingSoon: 'BIENTÔT DISPONIBLE'
    },
    'ru': {
        planetBuilder: 'СОЗДАТЕЛЬ ПЛАНЕТ',
        comingSoon: 'СКОРО В ИГРЕ'
    },
    'ja': {
        planetBuilder: '惑星ビルダー',
        comingSoon: '近日公開'
    },
    'ar': {
        planetBuilder: 'منشئ الكواكب',
        comingSoon: 'قريباً'
    }
};

for (const [lang, keys] of Object.entries(additions)) {
    const searchStr = lang.includes('-') ? `\n    '${lang}': {` : `\n    ${lang}: {`;
    let replacement = `${searchStr}\n`;
    for (const [k, v] of Object.entries(keys)) {
        replacement += `        ${k}: '${v.replace(/'/g, "\\'")}',\n`;
    }
    content = content.replace(searchStr, replacement.trim());
}

fs.writeFileSync(filePath, content, 'utf8');
console.log('Planet Builder translations successfully added!');
