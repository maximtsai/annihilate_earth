const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../js/translations.js');
let content = fs.readFileSync(filePath, 'utf8');

const replacements = [
    { target: "watch: 'SPIN!',", replacement: "watch: 'SPIN!',\n        acquire: 'ACQUIRE'," },
    { target: "watch: '开始抽奖！',", replacement: "watch: '开始抽奖！',\n        acquire: '获取'," },
    { target: "watch: '開始抽獎！',", replacement: "watch: '開始抽獎！',\n        acquire: '獲取'," },
    { target: "watch: '¡GIRAR!',", replacement: "watch: '¡GIRAR!',\n        acquire: 'ADQUIRIR'," },
    { target: "watch: 'TOURNER !',", replacement: "watch: 'TOURNER !',\n        acquire: 'ACQUÉRIR'," },
    { target: "watch: 'КРУТИТЬ!',", replacement: "watch: 'КРУТИТЬ!',\n        acquire: 'ПОЛУЧИТЬ'," },
    { target: "watch: 'スピン！',", replacement: "watch: 'スピン！',\n        acquire: '獲得する'," },
    { target: "watch: 'دور!',", replacement: "watch: 'دور!',\n        acquire: 'الحصول على'," }
];

replacements.forEach(r => {
    content = content.replace(r.target, r.replacement);
});

fs.writeFileSync(filePath, content, 'utf8');
console.log("Successfully updated translations.js!");
