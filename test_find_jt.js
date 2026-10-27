const fs = require('fs');
const js = fs.readFileSync('C:/Users/DANG QUANG DUNG/.gemini/antigravity-ide/brain/69cdf84b-42ff-4eff-8fb1-07cb8e12703c/scratch/edux.js', 'utf8');

const tfPos = 5565647;
let searchPos = tfPos - 20000;
const matches = [];
while ((searchPos = js.indexOf('Jt(', searchPos)) !== -1 && searchPos < tfPos + 5000) {
  matches.push(searchPos);
  searchPos += 3;
}
console.log('Jt( calls count:', matches.length);
if (matches.length > 0) {
  console.log('First Jt call:', js.substring(matches[0] - 100, matches[0] + 150));
}

// Where is Jt passed as param or declared?
let p = tfPos;
while (p > tfPos - 30000) {
  const slice = js.substring(p - 1000, p);
  if (slice.includes(',Jt,') || slice.includes(',Jt=') || slice.includes('Jt,') || slice.includes('const [S,')) {
    console.log('Found near:', p, slice);
    break;
  }
  p -= 1000;
}
