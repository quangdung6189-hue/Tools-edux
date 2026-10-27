const assert = require('assert');

// Implement the new rock-solid scanTrueFalseStatements
function scanTrueFalseStatements(root) {
  const container = root || document.body;
  if (!container) return [];

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

  const trueFalsePairs = [];

  // Helper: check if element is a valid statement card/row
  function analyzeCard(el) {
    if (!el || ['BUTTON', 'INPUT', 'LABEL', 'A'].includes(el.tagName)) return null;
    if (el.closest && el.closest('[class*="ahs-"], [id*="ahs-"]')) return null;
    if (el.offsetParent === null && typeof window !== 'undefined' && window.getComputedStyle(el).display === 'none') return null;

    const clickables = Array.from(el.querySelectorAll('button, [role="button"], input[type="button"], label'));
    const tBtns = clickables.filter(b => isTrueText(b.textContent));
    const fBtns = clickables.filter(b => isFalseText(b.textContent));

    // A statement card has at least 1 True and 1 False button (typically exactly 1 of each)
    if (tBtns.length !== 1 || fBtns.length !== 1) return null;

    const tBtn = tBtns[0];
    const fBtn = fBtns[0];
    if (tBtn === fBtn) return null;

    // Check if element has substantial statement text outside the buttons
    const textWithoutBtns = (el.textContent || '')
      .replace(tBtn.textContent, '')
      .replace(fBtn.textContent, '')
      .replace(/\s+/g, ' ')
      .trim();

    // Must have at least 8 characters of statement text
    if (textWithoutBtns.length < 8) return null;

    // Must NOT be the header/title container e.g. "Chọn Đúng hoặc Sai cho từng mệnh đề:"
    if (/^chọn\s+đúng\s+hoặc\s+sai/i.test(textWithoutBtns) && textWithoutBtns.length < 45) return null;

    return {
      card: el,
      trueBtn: tBtn,
      falseBtn: fBtn,
      textWithoutBtns
    };
  }

  // ── STRATEGY 1: Dedicated Statement Card Elements ───────────────
  // Search all potential card containers
  const candidates = Array.from(container.querySelectorAll(
    'div[class*="border"], div[class*="rounded"], div[class*="bg-gray"], tr, li, div[class*="item"], div[class*="statement"], div[class*="card"], div[class*="flex"]'
  ));

  const validCards = [];
  for (const el of candidates) {
    const analysis = analyzeCard(el);
    if (!analysis) continue;

    // Check if any child of el is ALSO a valid card (we want the innermost card)
    const children = Array.from(el.querySelectorAll(
      'div[class*="border"], div[class*="rounded"], div[class*="bg-gray"], tr, li, div[class*="item"], div[class*="statement"], div[class*="card"]'
    ));
    const hasChildCard = children.some(c => c !== el && analyzeCard(c) !== null);
    if (!hasChildCard) {
      validCards.push(analysis);
    }
  }

  // Deduplicate cards in case both flex and border matched the same container
  const uniqueCards = [];
  const seenElements = new Set();
  for (const item of validCards) {
    if (!seenElements.has(item.card) && !uniqueCards.some(u => u.card.contains(item.card) || item.card.contains(u.card))) {
      seenElements.add(item.card);
      uniqueCards.push(item);
    }
  }

  // Sort top-to-bottom
  uniqueCards.sort((a, b) => {
    try {
      const aRect = a.card.getBoundingClientRect();
      const bRect = b.card.getBoundingClientRect();
      if (Math.abs(aRect.top - bRect.top) > 5) return aRect.top - bRect.top;
    } catch (e) {}
    if (typeof a.card.compareDocumentPosition === 'function') {
      const pos = a.card.compareDocumentPosition(b.card);
      return (pos & 4) ? -1 : 1;
    }
    return 0;
  });

  uniqueCards.forEach((item, idx) => {
    const pairIndex = idx + 1;
    let stmtText = '';

    // Look for text element inside card that does not contain buttons
    const textEls = Array.from(item.card.querySelectorAll('div, p, span')).filter(el =>
      !el.contains(item.trueBtn) && !el.contains(item.falseBtn) && el !== item.trueBtn && el !== item.falseBtn
    );

    for (const el of textEls) {
      const t = (el.textContent || '').normalize('NFC').replace(/\s+/g, ' ').trim();
      if (t.length >= 8 && !isTrueText(t) && !isFalseText(t) && !/^(?:chọn\s+đúng|đúng\s+sai)/i.test(t)) {
        if (!stmtText || t.length > stmtText.length) {
          stmtText = t;
        }
      }
    }

    if (!stmtText) {
      stmtText = item.textWithoutBtns;
    }

    stmtText = stmtText
      .replace(/\s+/g, ' ')
      .replace(/^(?:đúng|sai|true|false)\s*[:\.]?\s*/gi, '')
      .replace(/\s*[:\.]?\s*(?:đúng|sai|true|false)$/gi, '')
      .trim();

    if (!/^\d+[\.\:\)]/.test(stmtText) && stmtText) {
      stmtText = `${pairIndex}. ${stmtText}`;
    } else if (!stmtText) {
      stmtText = `Mệnh đề ${pairIndex}`;
    }

    trueFalsePairs.push({
      index: pairIndex,
      text: stmtText,
      trueElement: item.trueBtn,
      falseElement: item.falseBtn,
      cardElement: item.card
    });
  });

  // Sort by statement index (e.g. 1., 2., 3., 4.) to guarantee ascending order
  trueFalsePairs.sort((a, b) => {
    const aNum = parseInt((a.text.match(/^(\d+)[\.\:\)]/) || [])[1], 10);
    const bNum = parseInt((b.text.match(/^(\d+)[\.\:\)]/) || [])[1], 10);
    if (!isNaN(aNum) && !isNaN(bNum)) return aNum - bNum;
    return a.index - b.index;
  });

  // Re-index cleanly 1..N
  trueFalsePairs.forEach((p, idx) => {
    p.index = idx + 1;
  });

  return trueFalsePairs;
}

// ── TEST WITH MOCK EDUX EXACT DOM ───────────────────────────
class MockElement {
  constructor(tagName, textContent = '', className = '') {
    this.tagName = tagName.toUpperCase();
    this.textContent = textContent;
    this.className = className;
    this.children = [];
    this.parentElement = null;
  }
  appendChild(child) {
    child.parentElement = this;
    this.children.push(child);
    return child;
  }
  querySelectorAll(selector) {
    const res = [];
    const traverse = (node) => {
      for (const child of node.children) {
        if (child.matches(selector)) res.push(child);
        traverse(child);
      }
    };
    traverse(this);
    return res;
  }
  matches(selector) {
    const parts = selector.split(',').map(s => s.trim().toLowerCase());
    for (const part of parts) {
      if (part === '*' || part === this.tagName.toLowerCase()) return true;
      if (part.includes('button') && this.tagName === 'BUTTON') return true;
      if (part.startsWith('div[class*="') || part.startsWith('[class*="')) {
        const m = part.match(/\[class\*="([^"]+)"\]/);
        if (m && this.className.toLowerCase().includes(m[1].toLowerCase())) return true;
      }
    }
    return false;
  }
  contains(other) {
    if (this === other) return true;
    for (const c of this.children) {
      if (c.contains(other)) return true;
    }
    return false;
  }
  compareDocumentPosition() { return 4; }
  getBoundingClientRect() { return { top: 0, left: 0, width: 100, height: 50 }; }
}

function updateText(node) {
  if (node.children.length > 0) {
    node.children.forEach(updateText);
    node.textContent = node.children.map(c => c.textContent).join(' ');
  }
}

// Build Câu 23 Tree
const root = new MockElement('div', '', 'exam-container');
const stmts = [
  'Đội phát triển có thể thích nghi khi có thành viên rời đi hoặc gia nhập.',
  'Trách nhiệm công việc thuộc về từng cá nhân thay vì cả đội.',
  'Đội tự tổ chức giúp tăng khả năng thích ứng với thay đổi.',
  'Thay đổi nhân sự luôn làm gián đoạn hoàn toàn tiến trình phát triển.'
];

stmts.forEach((stText, idx) => {
  const card = new MockElement('div', '', 'border border-gray-200 rounded-lg p-3 bg-gray-50 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2');
  const textCol = new MockElement('div', '', 'text-sm font-medium text-gray-800 sm:flex-1 flex items-start gap-1');
  const numSpan = new MockElement('span', `${idx + 1}.`, 'shrink-0 mt-0.5');
  const textDiv = new MockElement('div', '', '[&_p]:my-0 flex-1 min-w-0');
  const p = new MockElement('p', stText);
  textDiv.appendChild(p);
  textCol.appendChild(numSpan);
  textCol.appendChild(textDiv);
  card.appendChild(textCol);

  // Button container holding BOTH Đúng and Sai
  const btnCol = new MockElement('div', '', 'flex gap-2 sm:flex-shrink-0');
  const btnTrue = new MockElement('button', 'Đúng', 'py-1.5 px-4 rounded text-sm border bg-white');
  const btnFalse = new MockElement('button', 'Sai', 'py-1.5 px-4 rounded text-sm border bg-white');
  btnCol.appendChild(btnTrue);
  btnCol.appendChild(btnFalse);
  card.appendChild(btnCol);

  root.appendChild(card);
});

updateText(root);

console.log('--- Testing new scanTrueFalseStatements ---');
const results = scanTrueFalseStatements(root);
console.log('Detected pairs:', results.length);
results.forEach(r => console.log(`[${r.index}] ${r.text} (True: ${r.trueElement.textContent}, False: ${r.falseElement.textContent})`));

assert.strictEqual(results.length, 4, 'Phải tìm thấy đủ 4 mệnh đề');
assert.strictEqual(results[0].text.includes('Đội phát triển có thể thích nghi'), true);
assert.strictEqual(results[1].text.includes('Trách nhiệm công việc thuộc về từng cá nhân'), true);
assert.strictEqual(results[2].text.includes('Đội tự tổ chức'), true);
assert.strictEqual(results[3].text.includes('Thay đổi nhân sự'), true);

console.log('\n🎉 TEST NEW TF SCANNER PASSED 100%!');
