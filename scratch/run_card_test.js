const fs = require('fs');
const exactCode = fs.readFileSync('scratch/test_edux_exact.js', 'utf8');
const cardLogic = fs.readFileSync('scratch/test_card_detection.js', 'utf8');
const testRunner = exactCode.substring(0, exactCode.indexOf('// Load utils.js')) + '\n' +
  cardLogic + '\n' +
  `const res = testScanTF(body);
  console.log("Card detection results count:", res.length);
  res.forEach((r, i) => console.log("  [" + (i+1) + "] " + r.text + " (trueEl: " + (!!r.trueElement) + ", falseEl: " + (!!r.falseElement) + ")"));
`;

eval(testRunner);
