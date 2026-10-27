const fs = require('fs');
const { JSDOM } = require('jsdom');
const html = fs.readFileSync('scratch/edux_user_page.html', 'utf8');
const dom = new JSDOM(html);
const document = dom.window.document;
const window = dom.window;

function isElementVisible(el) {
  if (!el) return false;
  return true;
}

function isButtonEnabled(btn) {
  if (!btn) return false;
  if (btn.disabled === true) return false;
  if (btn.getAttribute('disabled') !== null) return false;
  if (btn.getAttribute('aria-disabled') === 'true') return false;
  return true;
}

// 1. getNavigationToolbar
function getNavigationToolbar() {
  // 0. Locate toolbar via slide counter element (GUARANTEED FOOTER)
  const elements = Array.from(document.querySelectorAll('span, p, div, b, strong'));
  for (const el of elements) {
    if (el.children.length > 0) continue;
    const t = (el.textContent || '').trim();
    if (/^\d+\s*\/\s*\d+$/.test(t)) {
      const bar = el.closest('div[class*="border-t"], div[class*="p-4"], div[class*="shrink-0"], div[class*="h-20"], footer');
      if (bar && bar !== document.body && isElementVisible(bar)) return bar;
    }
  }

  // 1. Direct slide dialog footer (border-t, NOT header border-b)
  const dialog = document.querySelector('div[role="dialog"][data-state="open"], div[role="dialog"]');
  if (dialog && isElementVisible(dialog)) {
    const dialogFooter = dialog.querySelector('div[class*="border-t"][class*="p-4"], div[class*="border-t"][class*="shrink-0"], div[class*="border-t"]');
    if (dialogFooter && isElementVisible(dialogFooter)) return dialogFooter;
  }

  // 2. Primary Edux AI slide toolbar by exact class:
  const eduxBar = document.querySelector('div.h-20.shrink-0, div[class*="h-20"][class*="shadow-lg"], div[class*="h-20"][class*="rounded-lg"]');
  if (eduxBar && isElementVisible(eduxBar)) return eduxBar;

  // 3. Direct Edux AI slide check: find parent toolbar of span.text-blue-600
  const eduxBlue = document.querySelector('span.text-blue-600, span[class*="text-blue-600"]');
  if (eduxBlue) {
    const bar = eduxBlue.closest('div[class*="h-20"], div[class*="shadow"], div[class*="rounded"], footer');
    if (bar && isElementVisible(bar)) return bar;
  }

  return null;
}

// 2. getSlideCounter
function getSlideCounter() {
  // 0. Exact leaf counter 'X / Y'
  const leafSpans = Array.from(document.querySelectorAll('span, p, div, b, strong'));
  for (const el of leafSpans) {
    if (el.children.length > 0) continue;
    const t = (el.textContent || '').trim();
    const m = t.match(/^(\d+)\s*\/\s*(\d+)$/);
    if (m) {
      const cur = parseInt(m[1], 10);
      const tot = parseInt(m[2], 10);
      if (tot > 0 && cur <= tot && tot <= 500) {
        return { completed: cur - 1, total: tot, current: cur, text: t };
      }
    }
  }

  // 1. Legacy eduxBlue
  const eduxBlue = document.querySelector('span.text-blue-600, span[class*="text-blue-600"]');
  if (eduxBlue && isElementVisible(eduxBlue)) {
    const curNum = parseInt(eduxBlue.textContent.trim(), 10);
    if (!isNaN(curNum) && curNum > 0) {
      let totalNum = null;
      const nextSpan = eduxBlue.nextElementSibling;
      if (nextSpan) {
        const tm = nextSpan.textContent.match(/\/?\s*(\d+)/);
        if (tm) totalNum = parseInt(tm[1], 10);
      }
      if (!totalNum && eduxBlue.parentElement) {
        const pm = eduxBlue.parentElement.textContent.match(/(\d+)\s*\/\s*(\d+)/);
        if (pm) totalNum = parseInt(pm[2], 10);
      }
      if (totalNum && totalNum > 0) {
        return { completed: curNum - 1, total: totalNum, current: curNum, text: `${curNum} / ${totalNum}` };
      }
    }
  }

  return null;
}

// 3. isInsideSlideViewer
function isInsideSlideViewer() {
  const dialog = document.querySelector('div[role="dialog"][data-state="open"], div[role="dialog"]');
  if (dialog && isElementVisible(dialog)) {
    const srTitle = (dialog.querySelector('[data-slot="dialog-title"]')?.textContent || '').toLowerCase();
    const txt = (dialog.textContent || '').toLowerCase();
    if (
      srTitle.includes('bài giảng') ||
      txt.includes('thoát bài giảng') ||
      txt.includes('chat với ai') ||
      txt.includes('chưa hiểu') ||
      dialog.querySelector('button[title*="Thoát bài giảng"], button[aria-label*="Thoát bài giảng"]')
    ) {
      return true;
    }
  }

  if (getSlideCounter() !== null) {
    return true;
  }

  const eduxBlue = document.querySelector('span.text-blue-600, span[class*="text-blue-600"]');
  if (eduxBlue && /^\d+$/.test(eduxBlue.textContent.trim())) {
    return true;
  }

  const eduxBar = document.querySelector('div.h-20.shrink-0, div[class*="h-20"][class*="shadow-lg"]');
  if (eduxBar) {
    const text = (eduxBar.textContent || '').toLowerCase();
    if (text.includes('trang sau') || text.includes('trang trước')) {
      return true;
    }
  }

  return false;
}

// 4. findNextSlideButton
function findNextSlideButton() {
  const toolbar = getNavigationToolbar();
  if (toolbar) {
    const buttons = Array.from(toolbar.querySelectorAll('button, a, [role="button"]'));

    // 1. Chevron right button inside toolbar (matches Edux SVG: lucide-chevron-right)
    for (const btn of buttons) {
      if (btn.classList.contains('text-green-500') || btn.classList.contains('border-green-500')) continue;
      if (btn.querySelector('svg.lucide-chevron-right, svg[class*="chevron-right"], svg path[d*="m9 18"], svg path[d*="M9 18"]')) {
        return btn;
      }
    }

    // 2. Button following counter span in toolbar
    const counterSpan = Array.from(toolbar.querySelectorAll('span, div')).find(s => 
      s.children.length === 0 && /^\d+\s*\/\s*\d+$/.test(s.textContent.trim())
    );
    if (counterSpan) {
      let nextEl = counterSpan.nextElementSibling;
      while (nextEl) {
        const innerBtn = nextEl.tagName === 'BUTTON' ? nextEl : nextEl.querySelector('button');
        if (innerBtn && !innerBtn.classList.contains('text-green-500') && !innerBtn.classList.contains('border-green-500')) {
          return innerBtn;
        }
        nextEl = nextEl.nextElementSibling;
      }
      const rowBtns = Array.from(counterSpan.parentElement?.querySelectorAll('button') || []);
      if (rowBtns.length >= 2) {
        const lastBtn = rowBtns[rowBtns.length - 1];
        if (!lastBtn.classList.contains('text-green-500') && !lastBtn.classList.contains('border-green-500')) {
          return lastBtn;
        }
      }
    }

    // 3. Look for button in toolbar with text/title/aria "Trang sau"
    for (const btn of buttons) {
      if (btn.classList.contains('text-green-500') || btn.classList.contains('border-green-500')) continue;
      const text = (btn.textContent || '').trim().toLowerCase();
      const title = (btn.getAttribute('title') || btn.getAttribute('aria-label') || '').toLowerCase();
      if (text === 'trang sau' || text === 'trang sau >' || text.startsWith('trang sau') || text === 'sau' || text === 'next' ||
          title.includes('trang sau') || title.includes('chuyển trang')) {
        return btn.closest('button, a, [role="button"]') || btn;
      }
    }
  }

  // Fallback
  const directFallback = document.querySelector('button[title*="Trang sau"], button[aria-label*="Trang sau"]');
  if (directFallback) return directFallback;

  const dialog = document.querySelector('div[role="dialog"][data-state="open"], div[role="dialog"]');
  if (dialog) {
    const chevronBtn = Array.from(dialog.querySelectorAll('button')).find(b => 
      b.querySelector('svg.lucide-chevron-right, svg[class*="chevron-right"], svg path[d*="m9 18"]')
    );
    if (chevronBtn) return chevronBtn;
  }

  return null;
}

// 5. findClassroomQuizButton
function findClassroomQuizButton() {
  const toolbar = getNavigationToolbar();
  if (!toolbar) return null;

  // 1. Direct green button inside toolbar:
  const greenBtns = Array.from(toolbar.querySelectorAll('button.text-green-500.border-green-500, button[class*="text-green-500"][class*="border-green"], button.border-green-500'));
  for (const btn of greenBtns) {
    const text = (btn.textContent || '').toLowerCase().trim();
    const title = (btn.getAttribute('title') || '').toLowerCase().trim();
    if (text.includes('không có câu hỏi') || title.includes('không có câu hỏi')) continue;
    if (text.includes('đang kiểm tra') || title.includes('đang kiểm tra')) continue;
    if (text.includes('bài giảng') || title.includes('bài giảng')) continue;
    if (btn.disabled === true) continue;
    return btn;
  }

  const patterns = ['trả lời trên lớp', 'hỏi trên lớp', 'câu hỏi trên lớp', 'làm bài tập', 'bài tập trên lớp', 'câu hỏi ôn tập'];
  const candidates = Array.from(toolbar.querySelectorAll('button, a, [role="button"]'));
  for (const el of candidates) {
    if (el.disabled) continue;
    const t = (el.textContent || '').toLowerCase().trim();
    const title = (el.getAttribute('title') || '').toLowerCase().trim();
    if (t.includes('không có câu hỏi') || title.includes('không có câu hỏi')) continue;
    if (t.includes('bài giảng') || title.includes('bài giảng')) continue;
    for (const p of patterns) {
      if (t.includes(p) || title.includes(p)) return el;
    }
  }

  return null;
}

// 6. getClassroomQuizButtonState
function getClassroomQuizButtonState() {
  const toolbar = getNavigationToolbar();
  if (!toolbar) return { button: null, state: 'none' };

  const greenBtn = toolbar.querySelector('button.text-green-500.border-green-500, button[class*="text-green-500"][class*="border-green"], button.border-green-500');
  if (greenBtn) {
    const text = (greenBtn.textContent || '').toLowerCase().trim();
    const title = (greenBtn.getAttribute('title') || '').toLowerCase().trim();
    if (text.includes('không có câu hỏi') || title.includes('không có câu hỏi')) {
      return { button: greenBtn, state: 'disabled' }; // No questions on this slide!
    }
    if (text.includes('đang kiểm tra') || title.includes('đang kiểm tra')) {
      return { button: greenBtn, state: 'checking' };
    }
    if (greenBtn.disabled === true) {
      return { button: greenBtn, state: 'disabled' };
    }
    return { button: greenBtn, state: 'ready' };
  }

  const activeBtn = findClassroomQuizButton();
  if (activeBtn) {
    return { button: activeBtn, state: 'ready' };
  }

  return { button: null, state: 'none' };
}

console.log('=== TEST RESULTS ===');
console.log('1. getNavigationToolbar():', !!getNavigationToolbar());
console.log('2. isInsideSlideViewer():', isInsideSlideViewer());
console.log('3. getSlideCounter():', getSlideCounter());
console.log('4. findNextSlideButton():', {
  found: !!findNextSlideButton(),
  disabled: findNextSlideButton()?.disabled,
  className: findNextSlideButton()?.className
});
console.log('5. getClassroomQuizButtonState():', {
  state: getClassroomQuizButtonState().state,
  buttonText: getClassroomQuizButtonState().button?.textContent?.trim()
});
