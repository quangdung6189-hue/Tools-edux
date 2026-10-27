const fs = require('fs');

// We simulate the DOM methods needed by utils.js and scanners.js
class MockElement {
  constructor(tagName, textContent = '', className = '', attrs = {}) {
    this.tagName = tagName.toUpperCase();
    this.nodeName = this.tagName;
    this.textContent = textContent;
    this.className = className;
    this.attrs = attrs;
    this.children = [];
    this.parentElement = null;
    this.nextElementSibling = null;
    this.previousElementSibling = null;
    this.offsetParent = {}; // visible
    this.style = { display: 'block' };
    this.classList = {
      contains: (c) => this.className.includes(c),
      add: (c) => { this.className += ' ' + c; },
      remove: (c) => { this.className = this.className.replace(c, '').trim(); }
    };
  }

  getAttribute(name) {
    return this.attrs[name] || null;
  }

  setAttribute(name, val) {
    this.attrs[name] = val;
  }

  appendChild(child) {
    if (this.children.length > 0) {
      const prev = this.children[this.children.length - 1];
      prev.nextElementSibling = child;
      child.previousElementSibling = prev;
    }
    child.parentElement = this;
    this.children.push(child);
    return child;
  }

  closest(selector) {
    const parts = selector.split(',').map(s => s.trim());
    let curr = this;
    while (curr) {
      for (const p of parts) {
        if (curr.matchesSelector(p)) return curr;
      }
      curr = curr.parentElement;
    }
    return null;
  }

  matchesSelector(sel) {
    sel = sel.trim().toLowerCase();
    if (sel === '*' || sel === this.tagName.toLowerCase()) return true;
    if (sel.startsWith('.')) {
      const cls = sel.slice(1);
      return this.className.split(/\s+/).includes(cls);
    }
    if (sel.includes('.flex.items-start') || sel.includes('items-start')) {
      return this.className.includes('items-start');
    }
    if (sel.startsWith('div[class*="') || sel.startsWith('[class*="')) {
      const m = sel.match(/\[class\*="([^"]+)"\]/);
      if (m && this.className.includes(m[1])) return true;
    }
    if (sel.includes('space-y-3') && this.className.includes('space-y-3')) return true;
    if (sel.includes('border') && this.className.includes('border')) return true;
    if (sel.includes('button') && this.tagName === 'BUTTON') return true;
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
    const parts = selector.split(',').map(s => s.trim().toLowerCase());
    const res = [];
    const traverse = (node) => {
      for (const child of node.children) {
        let matched = false;
        for (const p of parts) {
          if (child.matchesSelector(p)) {
            matched = true;
            break;
          }
        }
        if (matched) res.push(child);
        traverse(child);
      }
    };
    traverse(this);
    return res;
  }

  querySelector(selector) {
    const all = this.querySelectorAll(selector);
    return all.length > 0 ? all[0] : null;
  }

  getBoundingClientRect() {
    return { top: 100, left: 100, width: 200, height: 40 };
  }

  compareDocumentPosition(other) {
    return 4; // Node.DOCUMENT_POSITION_FOLLOWING
  }

  cloneNode(deep = true) {
    const clone = new MockElement(this.tagName, this.textContent, this.className, { ...this.attrs });
    if (deep) {
      for (const child of this.children) {
        clone.appendChild(child.cloneNode(true));
      }
    }
    return clone;
  }

  remove() {
    if (this.parentElement) {
      const idx = this.parentElement.children.indexOf(this);
      if (idx >= 0) this.parentElement.children.splice(idx, 1);
      if (this.previousElementSibling) this.previousElementSibling.nextElementSibling = this.nextElementSibling;
      if (this.nextElementSibling) this.nextElementSibling.previousElementSibling = this.previousElementSibling;
      this.parentElement = null;
    }
  }

  get innerText() {
    return this.textContent;
  }
}

// Build exact Edux Exam tree for Câu 23
const body = new MockElement('body');
const examContainer = new MockElement('div', '', 'p-4 max-w-4xl mx-auto');
body.appendChild(examContainer);

// Header block: <div class="flex items-start gap-2 mb-2">
const headerBlock = new MockElement('div', '', 'flex items-start gap-2 mb-2');
const headerPrefix = new MockElement('div', '', 'flex items-center gap-2 shrink-0 pt-0.5');
const qNumSpan = new MockElement('span', 'Câu 23', 'text-sm sm:text-base font-medium text-foreground');
const qBadgeSpan = new MockElement('span', 'Đúng sai', 'hidden sm:inline-flex text-xs sm:text-sm bg-gray-100 text-foreground px-2 py-0.5 rounded-full whitespace-nowrap');
const qColonSpan = new MockElement('span', ':', 'text-sm font-medium text-foreground');
headerPrefix.appendChild(qNumSpan);
headerPrefix.appendChild(qBadgeSpan);
headerPrefix.appendChild(qColonSpan);

const promptDiv = new MockElement('div', '', 'flex-1 min-w-0 text-sm sm:text-base font-medium text-foreground [&_p]:my-0');
const promptP = new MockElement('p', 'Phân tích vai trò của đội phát triển trong việc thích ứng với thay đổi nhân sự:');
promptDiv.appendChild(promptP);

headerBlock.appendChild(headerPrefix);
headerBlock.appendChild(promptDiv);
examContainer.appendChild(headerBlock);

// Options block (sibling of headerBlock): <div class="space-y-2">
const optionsOuter = new MockElement('div', '', 'space-y-2');
const tfWrapper = new MockElement('div', '', 'space-y-3');
const subtitle = new MockElement('div', 'Chọn Đúng hoặc Sai cho từng mệnh đề:', 'text-foreground text-xs sm:text-sm mb-1');
tfWrapper.appendChild(subtitle);

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

  const btnCol = new MockElement('div', '', 'flex gap-2 sm:flex-shrink-0');
  const btnTrue = new MockElement('button', 'Đúng', 'py-1.5 px-4 rounded text-sm border transition-all bg-white text-gray-700 border-gray-300 hover:border-green-400', { type: 'button' });
  const btnFalse = new MockElement('button', 'Sai', 'py-1.5 px-4 rounded text-sm border transition-all bg-white text-gray-700 border-gray-300 hover:border-red-400', { type: 'button' });
  btnCol.appendChild(btnTrue);
  btnCol.appendChild(btnFalse);
  card.appendChild(btnCol);

  tfWrapper.appendChild(card);
});

optionsOuter.appendChild(tfWrapper);
examContainer.appendChild(optionsOuter);

// Pagination at bottom
const navDiv = new MockElement('div', '', 'flex items-center justify-between mt-4');
const prevBtn = new MockElement('button', 'Câu trước');
const btn22 = new MockElement('button', '22', 'rounded-full w-8 h-8');
const btn23 = new MockElement('button', '23', 'rounded-full w-8 h-8 bg-blue-600 text-white');
const nextBtn = new MockElement('button', 'Câu tiếp >');
navDiv.appendChild(prevBtn);
navDiv.appendChild(btn22);
navDiv.appendChild(btn23);
navDiv.appendChild(nextBtn);
examContainer.appendChild(navDiv);

// Helper to compute textContent for mock nodes
function updateTextContent(node) {
  if (node.children.length > 0) {
    node.children.forEach(updateTextContent);
    node.textContent = node.children.map(c => c.textContent).join(' ');
  }
}
updateTextContent(body);

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

// Load utils.js and scanners.js code
const utilsCode = fs.readFileSync('content/utils.js', 'utf8');
const scannersCode = fs.readFileSync('content/scanners.js', 'utf8');

// Evaluate in sandbox
eval(utilsCode);
eval(scannersCode);

console.log('--- Testing extractPaginatedQuestion on each candidate ---');
console.log('1. On qNumSpan:');
const q1 = extractPaginatedQuestion(qNumSpan);
console.log('q1 text:', q1 ? q1.questionText : null);
console.log('q1 options count:', q1 && q1.options ? q1.options.length : 0);
console.log('q1 statements count:', q1 && q1.statements ? q1.statements.length : 0);

console.log('2. On headerPrefix:');
const q2 = extractPaginatedQuestion(headerPrefix);
console.log('q2 text:', q2 ? q2.questionText : null);
console.log('q2 options count:', q2 && q2.options ? q2.options.length : 0);

console.log('3. On headerBlock:');
const q3 = extractPaginatedQuestion(headerBlock);
console.log('q3 text:', q3 ? q3.questionText : null);
console.log('q3 options count:', q3 && q3.options ? q3.options.length : 0);

console.log('\n--- Testing scanQuestions() on Edux DOM ---');
const found = scanQuestions();
console.log('Found questions count:', found.length);
if (found.length > 0) {
  const q = found[0];
  console.log('Question Text:', q.questionText);
  console.log('Question Type:', q.questionType);
  console.log('isMultiStatement:', q.isMultiStatement);
  console.log('Options count:', q.options ? q.options.length : 0);
  console.log('Statements count:', q.statements ? q.statements.length : 0);
  if (q.statements) {
    q.statements.forEach((s, i) => console.log(`  [${i+1}] ${s.text} (trueEl: ${!!s.trueElement}, falseEl: ${!!s.falseElement})`));
  }
}
