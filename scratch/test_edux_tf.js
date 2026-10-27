// Test Edux True/False question scanning directly
const fs = require('fs');

// We will construct a minimal DOM simulator for this test
class MockNode {
  constructor(tagName, textContent = '', className = '', attrs = {}) {
    this.tagName = tagName.toUpperCase();
    this.textContent = textContent;
    this.className = className;
    this.attrs = attrs;
    this.children = [];
    this.parentElement = null;
    this.nextElementSibling = null;
    this.previousElementSibling = null;
    this.offsetParent = {}; // not null (visible)
    this.style = { display: 'block' };
  }

  appendChild(child) {
    if (this.children.length > 0) {
      const last = this.children[this.children.length - 1];
      last.nextElementSibling = child;
      child.previousElementSibling = last;
    }
    child.parentElement = this;
    this.children.push(child);
    return child;
  }

  closest(selector) {
    let curr = this;
    while (curr) {
      if (curr.matches && curr.matches(selector)) return curr;
      curr = curr.parentElement;
    }
    return null;
  }

  matches(selector) {
    const sel = selector.toLowerCase();
    if (sel === 'button' && this.tagName === 'BUTTON') return true;
    if (sel.includes('.flex.items-start') && this.className.includes('flex') && this.className.includes('items-start')) return true;
    if (sel.includes('div') && this.tagName === 'DIV') return true;
    if (sel.includes('border') && this.className.includes('border')) return true;
    if (sel.includes('space-y-3') && this.className.includes('space-y-3')) return true;
    return false;
  }

  contains(other) {
    if (this === other) return true;
    for (const child of this.children) {
      if (child.contains(other)) return true;
    }
    return false;
  }

  querySelectorAll(selector) {
    const results = [];
    function traverse(node) {
      for (const child of node.children) {
        if (child.matchesSelector(selector)) {
          results.push(child);
        }
        traverse(child);
      }
    }
    traverse(this);
    return results;
  }

  querySelector(selector) {
    const all = this.querySelectorAll(selector);
    return all.length > 0 ? all[0] : null;
  }

  matchesSelector(selector) {
    const parts = selector.split(',').map(s => s.trim().toLowerCase());
    for (const p of parts) {
      if (p === '*' || p === this.tagName.toLowerCase()) return true;
      if (p.startsWith('[role=') && this.attrs.role) return true;
      if (p.includes('button') && this.tagName === 'BUTTON') return true;
      if (p.includes('input') && this.tagName === 'INPUT') return true;
      if (p.includes('label') && this.tagName === 'LABEL') return true;
      if (p.includes('span') && this.tagName === 'SPAN') return true;
      if (p.includes('div') && this.tagName === 'DIV') return true;
      if (p.includes('p') && this.tagName === 'P') return true;
      if (p.includes('a') && this.tagName === 'A') return true;
    }
    return false;
  }

  getBoundingClientRect() {
    return { top: 100, left: 100, width: 200, height: 40 };
  }

  compareDocumentPosition(other) {
    return 4; // Node.DOCUMENT_POSITION_FOLLOWING
  }
}

// Build exact Edux exam tree
const body = new MockNode('body');
const main = new MockNode('div', '', 'main-exam');
body.appendChild(main);

// Header
const headerBlock = new MockNode('div', '', 'flex items-start gap-2 mb-2');
const headerPrefix = new MockNode('div', '', 'flex items-center gap-2 shrink-0 pt-0.5');
const qNum = new MockNode('span', 'Câu 23', 'text-sm font-medium');
const qBadge = new MockNode('span', 'Đúng sai', 'bg-gray-100 rounded-full');
const qColon = new MockNode('span', ':', 'text-sm');
headerPrefix.appendChild(qNum);
headerPrefix.appendChild(qBadge);
headerPrefix.appendChild(qColon);

const qTextDiv = new MockNode('div', '', 'flex-1 text-sm font-medium');
const qP = new MockNode('p', 'Phân tích vai trò của đội phát triển trong việc thích ứng với thay đổi nhân sự:');
qTextDiv.appendChild(qP);

headerBlock.appendChild(headerPrefix);
headerBlock.appendChild(qTextDiv);
main.appendChild(headerBlock);

// Options container
const optionsOuter = new MockNode('div', '', 'space-y-2');
const optionsInner = new MockNode('div', '', 'space-y-3');
const subtitle = new MockNode('div', 'Chọn Đúng hoặc Sai cho từng mệnh đề:', 'text-xs mb-1');
optionsInner.appendChild(subtitle);

const stmtsData = [
  '1. Đội phát triển có thể thích nghi khi có thành viên rời đi hoặc gia nhập.',
  '2. Trách nhiệm công việc thuộc về từng cá nhân thay vì cả đội.',
  '3. Đội tự tổ chức giúp tăng khả năng thích ứng với thay đổi.',
  '4. Thay đổi nhân sự luôn làm gián đoạn hoàn toàn tiến trình phát triển.'
];

stmtsData.forEach((sText, idx) => {
  const row = new MockNode('div', '', 'border border-gray-200 rounded-lg p-3 bg-gray-50 flex flex-col sm:flex-row gap-2');
  const textCol = new MockNode('div', '', 'text-sm font-medium sm:flex-1 flex gap-1');
  const numSpan = new MockNode('span', `${idx + 1}.`, 'shrink-0');
  const textDiv = new MockNode('div', '', 'flex-1');
  const p = new MockNode('p', sText.replace(/^\d+\.\s*/, ''));
  textDiv.appendChild(p);
  textCol.appendChild(numSpan);
  textCol.appendChild(textDiv);
  row.appendChild(textCol);

  const btnCol = new MockNode('div', '', 'flex gap-2 sm:flex-shrink-0');
  const btnTrue = new MockNode('button', 'Đúng', 'py-1.5 px-4 rounded border', { type: 'button' });
  const btnFalse = new MockNode('button', 'Sai', 'py-1.5 px-4 rounded border', { type: 'button' });
  btnCol.appendChild(btnTrue);
  btnCol.appendChild(btnFalse);
  row.appendChild(btnCol);

  optionsInner.appendChild(row);
});

optionsOuter.appendChild(optionsInner);
main.appendChild(optionsOuter);

// Set textContent recursively if needed
function computeText(node) {
  if (node.children.length === 0) return node.textContent;
  return node.children.map(computeText).join(' ');
}

// Set up globals
global.document = {
  body: body,
  querySelectorAll: (sel) => body.querySelectorAll(sel),
  querySelector: (sel) => body.querySelector(sel)
};
global.window = {
  getComputedStyle: () => ({ display: 'block' }),
  innerHeight: 1000
};
global.Node = { DOCUMENT_POSITION_FOLLOWING: 4 };

// Now test candidate extraction and extractPaginatedQuestion
// Read utils.js and extract scanTrueFalseStatements
const utilsCode = fs.readFileSync('content/utils.js', 'utf8');

// Extract scanTrueFalseStatements function
const fnMatch = utilsCode.match(/function scanTrueFalseStatements\(root\) \{([\s\S]*?)\n  \}/);
if (!fnMatch) {
  console.error('Could not find scanTrueFalseStatements in utils.js');
  process.exit(1);
}

const scanTrueFalseStatements = new Function('root', fnMatch[1]);

console.log('\n--- Running scanTrueFalseStatements(body) ---');
const tf = scanTrueFalseStatements(body);
console.log('Result length:', tf.length);
tf.forEach((s, idx) => {
  console.log(`[${idx + 1}] text: "${s.text}", trueBtn: ${!!s.trueElement}, falseBtn: ${!!s.falseElement}`);
});
