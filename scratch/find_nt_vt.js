const fs = require('fs');
const js = fs.readFileSync('C:/Users/DANG QUANG DUNG/.gemini/antigravity-ide/brain/69cdf84b-42ff-4eff-8fb1-07cb8e12703c/scratch/edux.js', 'utf8');

const pos = 5043131;
let p = pos - 1000;
while (p > pos - 50000) {
  const slice = js.substring(p, p + 2000);
  if (slice.includes('const Vt=') || slice.includes('const Nt=') || slice.includes('function Vt(') || slice.includes('function Nt(')) {
    console.log('Found Nt/Vt around pos:', p);
    console.log(slice.substring(0, 1000));
    break;
  }
  p -= 1000;
}
