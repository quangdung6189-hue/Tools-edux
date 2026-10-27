const fs = require('fs');
const exactCode = fs.readFileSync('scratch/test_edux_exact.js', 'utf8');

const debugScript = exactCode.substring(0, exactCode.indexOf('// Load utils.js')) + '\n' + `
function isTrueText(t) {
  if (!t) return false;
  const clean = (t || '').normalize('NFC').replace(/[\u200B-\u200D\uFEFF\u00A0]/g, ' ').trim().toLowerCase();
  return /^(?:\\(?\\s*(?:đúng|true|đ)\\s*\\)?[\\:\\.]?|1[\\.\\:\\)]\\s*đúng)$/i.test(clean) || clean === 'đúng' || clean === 'true';
}
function isFalseText(t) {
  if (!t) return false;
  const clean = (t || '').normalize('NFC').replace(/[\u200B-\u200D\uFEFF\u00A0]/g, ' ').trim().toLowerCase();
  return /^(?:\\(?\\s*(?:sai|false|s)\\s*\\)?[\\:\\.]?|2[\\.\\:\\)]\\s*sai)$/i.test(clean) || clean === 'sai' || clean === 'false';
}

function hasBothTF(el) {
  if (['BUTTON', 'INPUT', 'LABEL'].includes(el.tagName)) return false;
  const btns = Array.from(el.querySelectorAll('button, [role="button"], input[type="button"], label'));
  const hasT = btns.some(b => isTrueText(b.textContent));
  const hasF = btns.some(b => isFalseText(b.textContent));
  return hasT && hasF;
}

const allDivs = Array.from(body.querySelectorAll('div, tr, li, p'));
const statementCards = [];

for (const el of allDivs) {
  if (!hasBothTF(el)) continue;
  const children = Array.from(el.children);
  const childHasBoth = children.some(c => hasBothTF(c));
  if (!childHasBoth) {
    statementCards.push(el);
  }
}

console.log('Found statementCards:', statementCards.length);
statementCards.forEach((card, idx) => {
  const btns = Array.from(card.querySelectorAll('button, [role="button"], input[type="button"], label'));
  const trueBtn = btns.find(b => isTrueText(b.textContent));
  const falseBtn = btns.find(b => isFalseText(b.textContent));
  
  let stmtText = '';
  for (const child of card.children) {
    if (!child.contains(trueBtn) && !child.contains(falseBtn) && child !== trueBtn && child !== falseBtn) {
      const t = (child.textContent || '').normalize('NFC').replace(/\\s+/g, ' ').trim();
      if (t.length >= 5) {
        stmtText = t;
        break;
      }
    }
  }

  const pairIndex = idx + 1;
  stmtText = (stmtText || '').replace(/^(?:đúng|sai)\\s*[:\\.]?\\s*/gi, '').trim();
  if (!/^\\d+[\\.\\:\\)]/.test(stmtText) && stmtText) {
    stmtText = pairIndex + '. ' + stmtText;
  }

  console.log('Statement ' + pairIndex + ': "' + stmtText + '" | TrueBtn: ' + (!!trueBtn) + ' | FalseBtn: ' + (!!falseBtn));
});
`;

eval(debugScript);
