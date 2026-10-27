const fs = require('fs');
const js = fs.readFileSync('C:/Users/DANG QUANG DUNG/.gemini/antigravity-ide/brain/69cdf84b-42ff-4eff-8fb1-07cb8e12703c/scratch/edux.js', 'utf8');
const target = '},"Câu ",Ot+1';
const idx = js.indexOf(target);
console.log(js.substring(idx - 3500, idx - 1000));
