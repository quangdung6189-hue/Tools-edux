const fs = require('fs');
const js = fs.readFileSync('C:/Users/DANG QUANG DUNG/.gemini/antigravity-ide/brain/69cdf84b-42ff-4eff-8fb1-07cb8e12703c/scratch/edux.js', 'utf8');

console.log('--- SEARCH 1: Trang sau button ---');
let idx = 0;
while ((idx = js.indexOf('"Trang sau"', idx)) !== -1) {
  console.log('Found at pos:', idx);
  console.log(js.substring(Math.max(0, idx - 400), Math.min(js.length, idx + 400)));
  console.log('====================================');
  idx += 11;
}

console.log('--- SEARCH 2: Trả lời trên lớp button ---');
idx = 0;
while ((idx = js.indexOf('"Trả lời trên lớp"', idx)) !== -1) {
  console.log('Found at pos:', idx);
  console.log(js.substring(Math.max(0, idx - 400), Math.min(js.length, idx + 400)));
  console.log('====================================');
  idx += 18;
}
