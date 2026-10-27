// Test scanTrueFalseStatements from utils.js

function isTrueText(t) {
  if (!t) return false;
  const clean = (t || '').normalize('NFC').replace(/[\u200B-\u200D\uFEFF\u00A0]/g, ' ').trim().toLowerCase();
  return /^(?:\(?\s*(?:đúng|true|đ)\s*\)?[\:\.]?|1[\.\:\)]\s*đúng)$/i.test(clean) || clean === 'đúng' || clean === 'true';
}
function isFalseText(t) {
  if (!t) return false;
  const clean = (t || '').normalize('NFC').replace(/[\u200B-\u200D\uFEFF\u00A0]/g, ' ').trim().toLowerCase();
  return /^(?:\(?\s*(?:sai|false|s)\s*\)?[\:\.]?|2[\.\:\)]\s*sai)$/i.test(clean) || clean === 'sai' || clean === 'false';
}

console.log('isTrueText("Đúng"):', isTrueText("Đúng"));
console.log('isFalseText("Sai"):', isFalseText("Sai"));
console.log('isTrueText(" Đúng "):', isTrueText(" Đúng "));
console.log('isFalseText(" Sai "):', isFalseText(" Sai "));

// Check regex in detectTrueFalseAnswer:
const answerText = "1. Đúng\n2. Sai\n3. Đúng\n4. Sai";
console.log('Pattern 1 test:', /(?:^|[\r\n]+)\s*\d+[\.:\)\s\-–—]+\s*(?:đúng|sai|true|false|đ|s)\b/i.test(answerText));
