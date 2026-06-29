const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../js/translations.js');
let content = fs.readFileSync(filePath, 'utf8');

const additions = {
    'en': {
        mainMenu: 'MAIN MENU',
        newGame: 'NEW GAME',
        continue: 'CONTINUE',
        levelSelect: 'LEVEL SELECT',
        credits: 'CREDITS',
        planetBuilder: 'PLANET BUILDER',
        comingSoon: 'COMING SOON'
    },
    'zh-CN': {
        mainMenu: '主菜单',
        newGame: '新游戏',
        continue: '继续',
        levelSelect: '选择关卡',
        credits: '制作人员',
        planetBuilder: '星球建造器',
        comingSoon: '即将推出'
    },
    'zh-TW': {
        mainMenu: '主選單',
        newGame: '新遊戲',
        continue: '繼續',
        levelSelect: '選擇關卡',
        credits: '製作人員',
        planetBuilder: '星球建造器',
        comingSoon: '即將推出'
    },
    'es': {
        mainMenu: 'MENÚ PRINCIPAL',
        newGame: 'NUEVO JUEGO',
        continue: 'CONTINUAR',
        levelSelect: 'SELECCIONAR NIVEL',
        credits: 'CRÉDITOS',
        planetBuilder: 'CREADOR DE PLANETAS',
        comingSoon: 'PRÓXIMAMENTE'
    },
    'fr': {
        mainMenu: 'MENU PRINCIPAL',
        newGame: 'NOUVEAU JEU',
        continue: 'CONTINUER',
        levelSelect: 'SÉLECTIONNER NIVEAU',
        credits: 'CRÉDITS',
        planetBuilder: 'CRÉATEUR DE PLANÈTES',
        comingSoon: 'BIENTÔT DISPONIBLE'
    },
    'ru': {
        mainMenu: 'ГЛАВНОЕ МЕНЮ',
        newGame: 'НОВАЯ ИГРА',
        continue: 'ПРОДОЛЖИТЬ',
        levelSelect: 'ВЫБОР УРОВНЯ',
        credits: 'АВТОРЫ',
        planetBuilder: 'СОЗДАТЕЛЬ ПЛАНЕТ',
        comingSoon: 'СКОРО В ИГРЕ'
    },
    'ja': {
        mainMenu: 'メインメニュー',
        newGame: 'ニューゲーム',
        continue: 'つづける',
        levelSelect: 'レベル選択',
        credits: 'クレジット',
        planetBuilder: '惑星ビルダー',
        comingSoon: '近日公開'
    },
    'ar': {
        mainMenu: 'القائمة الرئيسية',
        newGame: 'لعبة جديدة',
        continue: 'استمرار',
        levelSelect: 'تحديد المستوى',
        credits: 'الأسماء المشاركة',
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
    // We do NOT use .trim() here to preserve the exact newlines and indentation!
    content = content.replace(searchStr, replacement);
}

fs.writeFileSync(filePath, content, 'utf8');
console.log('All translations successfully added and formatting preserved!');
