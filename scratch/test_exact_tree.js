const fs = require('fs');

class MockNode {
  constructor(tag, cls = '', text = '') {
    this.tagName = tag.toUpperCase();
    this.className = cls;
    this.textContent = text;
    this.children = [];
    this.parentElement = null;
    this.nextElementSibling = null;
    this.previousElementSibling = null;
    this.offsetParent = {};
    this.style = { display: 'block' };
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
  closest(sel) {
    let curr = this;
    while (curr) {
      if (curr.matches(sel)) return curr;
      curr = curr.parentElement;
    }
    return null;
  }
  matches(sel) {
    const parts = sel.split(',').map(s => s.trim().toLowerCase());
    for (const p of parts) {
      if (p === '*' || p === this.tagName.toLowerCase()) return true;
      if (p.startsWith('.') && this.className.includes(p.slice(1))) return true;
      if (p.includes('[class*="') && this.className.includes(p.match(/\[class\*="([^"]+)"/)[1])) return true;
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
  querySelectorAll(sel) {
    const res = [];
    const walk = (node) => {
      for (const c of node.children) {
        if (c.matches(sel)) res.push(c);
        walk(c);
      }
    };
    walk(this);
    return res;
  }
  querySelector(sel) {
    const all = this.querySelectorAll(sel);
    return all.length > 0 ? all[0] : null;
  }
  getBoundingClientRect() { return { top: 10, left: 10, width: 100, height: 20 }; }
  compareDocumentPosition(other) { return 4; }
}

function updateText(node) {
  if (node.children.length > 0) {
    node.children.forEach(updateText);
    node.textContent = node.children.map(c => c.textContent).join(' ');
  }
}

// Build exact Edux React component tree:
const root = new MockNode('div', 'bg-white rounded-lg p-2 w-full h-full');
const mb2 = new MockNode('div', 'mb-2 h-ful');
const headerBlock = new MockNode('div', 'flex items-start gap-2 mb-2');
const headerPrefix = new MockNode('div', 'flex items-center gap-2 shrink-0 pt-0.5');
const qSpan = new MockNode('span', 'text-sm sm:text-base font-medium text-foreground', 'Câu 23');
const badgeSpan = new MockNode('span', 'hidden sm:inline-flex text-xs sm:text-sm bg-gray-100 text-foreground px-2 py-0.5 rounded-full whitespace-nowrap', 'Đúng sai');
const colonSpan = new MockNode('span', 'text-sm font-medium text-foreground', ':');
headerPrefix.appendChild(qSpan);
headerPrefix.appendChild(badgeSpan);
headerPrefix.appendChild(colonSpan);

const promptDiv = new MockNode('div', 'flex-1 min-w-0 text-sm sm:text-base font-medium text-foreground');
const oiDiv = new MockNode('div', 'prose prose-slate max-w-none dark:prose-invert flex-1 min-w-0');
const p = new MockNode('p', '', 'Phân tích vai trò của đội phát triển trong việc thích ứng với thay đổi nhân sự:');
oiDiv.appendChild(p);
promptDiv.appendChild(oiDiv);
headerBlock.appendChild(headerPrefix);
headerBlock.appendChild(promptDiv);
mb2.appendChild(headerBlock);
root.appendChild(mb2);

const spaceY2 = new MockNode('div', 'space-y-2');
const spaceY3 = new MockNode('div', 'space-y-3');
const subTitle = new MockNode('div', 'text-foreground text-xs sm:text-sm mb-1', 'Chọn Đúng hoặc Sai cho từng mệnh đề:');
spaceY3.appendChild(subTitle);

const stmts = [
  'Đội phát triển có thể thích nghi khi có thành viên rời đi hoặc gia nhập.',
  'Trách nhiệm công việc thuộc về từng cá nhân thay vì cả đội.',
  'Đội tự tổ chức giúp tăng khả năng thích ứng với thay đổi.',
  'Thay đổi nhân sự luôn làm gián đoạn hoàn toàn tiến trình phát triển.'
];

stmts.forEach((s, idx) => {
  const card = new MockNode('div', 'border border-gray-200 rounded-lg p-3 bg-gray-50 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2');
  const textCol = new MockNode('div', 'text-sm font-medium text-gray-800 sm:flex-1 flex items-start gap-1');
  const numSpan = new MockNode('span', 'shrink-0 mt-0.5', (idx + 1) + '.');
  const sOi = new MockNode('div', 'prose prose-slate max-w-none dark:prose-invert flex-1 min-w-0');
  const sP = new MockNode('p', '', s);
  sOi.appendChild(sP);
  textCol.appendChild(numSpan);
  textCol.appendChild(sOi);

  const btnCol = new MockNode('div', 'flex gap-2 sm:flex-shrink-0');
  const btnT = new MockNode('button', 'py-1.5 px-4 rounded text-sm border transition-all bg-white text-gray-700 border-gray-300 hover:border-green-400', 'Đúng');
  const btnF = new MockNode('button', 'py-1.5 px-4 rounded text-sm border transition-all bg-white text-gray-700 border-gray-300 hover:border-red-400', 'Sai');
  btnCol.appendChild(btnT);
  btnCol.appendChild(btnF);

  card.appendChild(textCol);
  card.appendChild(btnCol);
  spaceY3.appendChild(card);
});
spaceY2.appendChild(spaceY3);
root.appendChild(spaceY2);

updateText(root);

global.document = { body: root, querySelectorAll: sel => root.querySelectorAll(sel), querySelector: sel => root.querySelector(sel) };
global.window = { getComputedStyle: () => ({ display: 'block' }), innerHeight: 1000 };
global.Node = { DOCUMENT_POSITION_FOLLOWING: 4 };

const utilsCode = fs.readFileSync('content/utils.js', 'utf8');
const scannersCode = fs.readFileSync('content/scanners.js', 'utf8');
eval(utilsCode);
eval(scannersCode);

console.log('--- TEST ON EXACT TREE ---');
const q = extractPaginatedQuestion(qSpan);
console.log('extractPaginatedQuestion result:');
console.log('qText:', q ? q.questionText : null);
console.log('qType:', q ? q.questionType : null);
console.log('options length:', q && q.options ? q.options.length : 0);
console.log('statements length:', q && q.statements ? q.statements.length : 0);
