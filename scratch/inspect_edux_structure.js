const fs = require('fs');
const js = fs.readFileSync('C:/Users/DANG QUANG DUNG/.gemini/antigravity-ide/brain/69cdf84b-42ff-4eff-8fb1-07cb8e12703c/scratch/edux.js', 'utf8');
const idx = js.indexOf('ft.type==="fill_blank"');
console.log('Index:', idx);
console.log('=== HEADER BEFORE FILL_BLANK (2000 chars) ===');
console.log(js.substring(idx - 2500, idx));
