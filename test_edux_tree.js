const fs = require('fs');
const js = fs.readFileSync('C:/Users/DANG QUANG DUNG/.gemini/antigravity-ide/brain/69cdf84b-42ff-4eff-8fb1-07cb8e12703c/scratch/edux.js', 'utf8');

const pos = js.lastIndexOf('flex items-start gap-2 mb-2', 5565647);
console.log(js.substring(pos - 3500, pos - 2500));
