const fs = require('fs');
const js = fs.readFileSync('C:/Users/DANG QUANG DUNG/.gemini/antigravity-ide/brain/69cdf84b-42ff-4eff-8fb1-07cb8e12703c/scratch/edux.js', 'utf8');

const pos = 5043131; // where Vt() is called
const slice = js.substring(pos - 1500, pos);
console.log('--- Code before Vt() call: ---');
console.log(slice);
