const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../js/translations.js');
let content = fs.readFileSync(filePath, 'utf8');

const replacements = [
    { target: "mysterybox: 'Mystery'", replacement: "mysterybox: 'Mystery', drill: 'Drill'" },
    { target: "mysterybox: '神秘'", replacement: "mysterybox: '神秘', drill: '钻头'" }, // Will replace both zh-CN and zh-TW since they are identical
    { target: "mysterybox: 'Misterio'", replacement: "mysterybox: 'Misterio', drill: 'Taladro'" },
    { target: "mysterybox: 'Mystère'", replacement: "mysterybox: 'Mystère', drill: 'Foreuse'" },
    { target: "mysterybox: 'Секрет'", replacement: "mysterybox: 'Секрет', drill: 'Дрель'" },
    { target: "mysterybox: 'ミステリー'", replacement: "mysterybox: 'ミステリー', drill: 'ドリル'" },
    { target: "mysterybox: 'غموض'", replacement: "mysterybox: 'غموض', drill: 'مثقاب'" }
];

replacements.forEach(r => {
    // Note: Use split/join to replace all occurrences since '神秘' occurs twice (zh-CN and zh-TW)
    content = content.split(r.target).join(r.replacement);
});

fs.writeFileSync(filePath, content, 'utf8');
console.log("Successfully updated translations.js for drill!");
