// ── Question Scanner ─────────────────────────────────────── ────────────────────────────────────────
// Question Scanner ────────────────────────────────────────
  function scanQuestions() {
    const questions = [];

    // Try all strategies in order of specificity
    const strategies = [
      scanCurrentPageQuestion,   // Strategy 1: Current visible question (paginated LMS like Edux, CMCU)
      scanFormQuestions,         // Strategy 2: Form-based quiz structures
      scanLMSPatterns,           // Strategy 3: Common LMS patterns
      scanGenericQuestions,      // Strategy 4: Generic numbered questions
    ];

    for (const strategy of strategies) {
      try {
        const found = strategy();
        if (found && found.length > 0) {
          questions.push(...found);
          break; // Use the first strategy that finds valid questions
        }
      } catch (err) {
        console.warn('Scanner strategy failed:', err);
      }
    }

    // Deduplicate and filter out garbage
    const seen = new Set();
    const unique = [];
    for (const q of questions) {
      if (!q || !q.questionText) continue;

      // Filter out garbage texts like "Trắc nghiệm :", "Câu 1", etc.
      const cleanBody = q.questionText
        .replace(/^(?:câu|question)\s*\d+[\s\:\.\-]*/i, '')
        .replace(/^\[?\s*(?:trắc\s*nghiệm|tự\s*luận|đúng[\s\/\-]*sai|chọn\s*nhiều|chọn\s*một|short-answer|multiple-choice)\s*\]?[\s\:\.\-]*/i, '')
        .replace(/^[:：\.\-]+\s*/, '')
        .trim();

      if (cleanBody.length < 4) continue;

      const key = cleanBody.substring(0, 100).toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(q);
      }
    }

    return unique;
  }

  
// ── Strategy 1: Current visible question (paginated LMS) ── ────────────────────────────────────────
// Strategy 1: Current visible question (paginated LMS) ───
  function scanCurrentPageQuestion() {
    const questions = [];

    // Helper: detect if an element is inside an overlay/dropdown to ignore (e.g. "Câu hỏi chưa làm")
    function isInsideDropdownOrOverlay(el) {
      if (!el) return false;
      const overlay = el.closest(
        '[class*="dropdown"], [class*="popover"], [class*="popup"], [class*="tooltip"], [class*="drawer"]'
      );
      if (overlay) {
        const t = overlay.textContent.toLowerCase();
        if (t.includes('chưa làm') || t.includes('chuyển đến') || t.includes('danh sách câu')) {
          return true;
        }
      }
      return false;
    }

    // 1. Search for question heading elements ("Câu 1", "Câu 2", etc.)
    const allElements = Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6, div, span, p, b, strong'));
    const candidates = [];

    for (const el of allElements) {
      if (isInsideDropdownOrOverlay(el)) continue;
      if (el.offsetParent === null && window.getComputedStyle(el).display === 'none') continue;

      const text = el.textContent.trim();
      if (/^câu\s+\d+/i.test(text) || /^question\s+\d+/i.test(text)) {
        if (el.children.length > 15) continue;
        candidates.push(el);
      }
    }

    // Filter out giant parent containers that wrap smaller question candidate elements
    const specificCandidates = candidates.filter(c => {
      const textLen = (c.textContent || '').trim().length;
      if (textLen > 350 && candidates.some(other => other !== c && c.contains(other))) {
        return false;
      }
      return true;
    });

    // Prioritize candidate matching active page number or currently visible in viewport
    let activePageNum = null;
    // Priority 1: Direct active/current question indicator (Edux active is bg-primary; answered questions are bg-blue-500)
    const primaryActiveBtns = Array.from(document.querySelectorAll(
      'button[class*="bg-primary"], [role="button"][class*="bg-primary"], [class*="bg-primary"][class*="rounded"], button[class*="active"], [aria-current="page"], .page-item.active, [class*="current"]'
    ));
    for (const btn of primaryActiveBtns) {
      const numMatch = (btn.textContent || '').trim().match(/^\d+$/);
      if (numMatch) {
        activePageNum = parseInt(numMatch[0], 10);
        break;
      }
    }

    // Priority 2: Other highlighted buttons only if no primary active button was found
    if (!activePageNum) {
      const fallbackBtns = Array.from(document.querySelectorAll(
        'button[class*="bg-indigo"], button[class*="bg-cyan"], button[class*="bg-sky"]'
      ));
      for (const btn of fallbackBtns) {
        const numMatch = (btn.textContent || '').trim().match(/^\d+$/);
        if (numMatch) {
          activePageNum = parseInt(numMatch[0], 10);
          break;
        }
      }
    }

    specificCandidates.sort((a, b) => {
      if (activePageNum) {
        const aMatch = new RegExp(`^câu\\s*${activePageNum}\\b`, 'i').test(a.textContent.trim());
        const bMatch = new RegExp(`^câu\\s*${activePageNum}\\b`, 'i').test(b.textContent.trim());
        if (aMatch && !bMatch) return -1;
        if (!aMatch && bMatch) return 1;
      }

      const aRect = a.getBoundingClientRect();
      const bRect = b.getBoundingClientRect();
      const aInView = (aRect.width > 0 && aRect.height > 0 && aRect.top >= 0 && aRect.top < window.innerHeight);
      const bInView = (bRect.width > 0 && bRect.height > 0 && bRect.top >= 0 && bRect.top < window.innerHeight);
      if (aInView && !bInView) return -1;
      if (!aInView && bInView) return 1;
      return 0;
    });

    let bestQuestion = null;

    for (const headerEl of specificCandidates) {
      const q = extractPaginatedQuestion(headerEl);
      if (q && q.questionText) {
        const raw = q.questionText
          .replace(/^(?:câu|question)\s*\d+[\s\:\.\-]*/i, '')
          .replace(/^(?:trắc\s*nghiệm|tự\s*luận|đúng[\s\/\-]*sai)[\s\:\.\-]*/i, '')
          .replace(/^[:：\.\-]+\s*/, '')
          .trim();
        if (raw.length > 4) {
          // If this question has full options/statements, return immediately
          if (q.options && q.options.length >= 2) {
            questions.push(q);
            return questions;
          }
          if (!bestQuestion) {
            bestQuestion = q;
          }
        }
      }
    }

    if (bestQuestion) {
      // If True/False question or options are empty or only simple Đúng/Sai words, actively search document.body for live statement pairs
      const isTFQuestion = bestQuestion.questionType === 'true-false' ||
        /(?:đúng[\s\/\-]*sai|true[\s\/\-]*false|chọn\s+đúng\s+hoặc\s+sai|từng\s+mệnh\s+đề)/i.test(bestQuestion.questionText || '');
      const hasOnlySimpleWords = bestQuestion.options && bestQuestion.options.length === 2 &&
        bestQuestion.options.every(o => /^(?:đúng|sai|true|false|đ|s)$/i.test((o || '').trim()));

      if (isTFQuestion || (!bestQuestion.options || bestQuestion.options.length === 0) || hasOnlySimpleWords) {
        const globalTF = typeof scanTrueFalseStatements === 'function' ? scanTrueFalseStatements(document.body) : [];
        if (globalTF && globalTF.length > 0) {
          bestQuestion.questionType = 'true-false';
          bestQuestion.options = globalTF.map(s => s.text);
          bestQuestion.statements = globalTF;
          bestQuestion.inputElements = globalTF.flatMap(s => [s.trueElement, s.falseElement]);
          bestQuestion.isMultiStatement = globalTF.length > 1;
          bestQuestion.questionText = (bestQuestion.questionText || '')
            .replace(/chọn\s+đúng\s+hoặc\s+sai\s+cho\s+từng\s+mệnh\s+đề\s*[:\.]?/gi, '')
            .trim();
        }
      }
      questions.push(bestQuestion);
      return questions;
    }

    // Fallback: extract by looking for options A, B, C, D directly
    const fallbackQ = extractByOptionsPattern();
    if (fallbackQ) {
      questions.push(fallbackQ);
      return questions;
    }

    return questions;
  }

  
// ── Strategy 2: Form-based questions ─────────────────────── ────────────────────────────────────────
// Strategy 2: Form-based questions ────────────────────────
  function scanFormQuestions() {
    const questions = [];

    const containers = document.querySelectorAll(
      'fieldset, ' +
      '[class*="question"], [class*="Question"], ' +
      '[class*="quiz"], [class*="Quiz"], ' +
      '[class*="exam"], [class*="Exam"], ' +
      '[class*="exercise"], [class*="Exercise"], ' +
      '[class*="problem"], [class*="Problem"], ' +
      '[id*="question"], [id*="Question"], ' +
      '[data-question], [data-quiz], ' +
      '.que, .formulation, .qtext'
    );

    for (const container of containers) {
      const question = extractQuestionFromContainer(container);
      if (question) {
        questions.push(question);
      }
    }

    return questions;
  }

  
// ── Strategy 3: LMS-specific patterns ───────────────────── ────────────────────────────────────────
// Strategy 3: LMS-specific patterns ──────────────────────
  function scanLMSPatterns() {
    const questions = [];

    // Moodle patterns
    const moodleQuestions = document.querySelectorAll('.que, .question-container, .quiz-question');
    for (const el of moodleQuestions) {
      const question = extractQuestionFromContainer(el);
      if (question) questions.push(question);
    }

    // Google Classroom patterns
    const classroomQuestions = document.querySelectorAll('[data-item-id], .freebirdFormviewerViewItemsItemItem');
    for (const el of classroomQuestions) {
      const question = extractQuestionFromContainer(el);
      if (question) questions.push(question);
    }

    // Generic form patterns - radio/checkbox groups
    const radioGroups = new Map();
    const radios = document.querySelectorAll('input[type="radio"], input[type="checkbox"]');
    for (const radio of radios) {
      const name = radio.name || radio.getAttribute('data-name') || '';
      if (name) {
        if (!radioGroups.has(name)) radioGroups.set(name, []);
        radioGroups.get(name).push(radio);
      }
    }

    for (const [name, inputs] of radioGroups) {
      if (inputs.length < 2) continue;
      const container = findCommonAncestor(inputs);
      if (!container) continue;
      const question = extractQuestionFromContainer(container);
      if (question && !questions.some(q => q.questionText === question.questionText)) {
        questions.push(question);
      }
    }

    return questions;
  }

  
// ── Strategy 4: Generic question detection ──────────────── ────────────────────────────────────────
// Strategy 4: Generic question detection ─────────────────
  function scanGenericQuestions() {
    const questions = [];

    const allElements = document.querySelectorAll('p, div, span, li, td, h1, h2, h3, h4, h5, h6, label');
    const questionPattern = /^(câu\s*\d+|question\s*\d+|\d+[\.\):])/i;

    for (const el of allElements) {
      const text = el.textContent.trim();
      if (questionPattern.test(text) && text.length > 10 && text.length < 2000) {
        if (!questions.some(q => q.element?.contains(el) || el.contains(q.element))) {
          const question = extractQuestionFromElement(el);
          if (question) questions.push(question);
        }
      }
    }

    return questions;
  }

  
// ── Navigate to Next Question ───────────────────────────── ────────────────────────────────────────
// Navigate to Next Question ──────────────────────────────
  function navigateNext() {
    // Strategy 1: Find button with text containing "Câu tiếp", "Tiếp theo", "Next"
    const allButtons = Array.from(document.querySelectorAll(
      'button, a, [role="button"], input[type="button"], input[type="submit"], div[class*="btn"], span[class*="btn"], [class*="btn-next"], [class*="next"]'
    ));

    for (const btn of allButtons) {
      if (btn.offsetParent === null && window.getComputedStyle(btn).display === 'none') continue;
      const text = btn.textContent.trim().toLowerCase();
      if (text.includes('câu tiếp') || text.includes('tiếp theo') ||
          text.includes('tiếp tục') || text === 'next' || text.startsWith('next') ||
          text.includes('câu sau')) {
        triggerClick(btn);
        return { success: true, action: 'clicked_next' };
      }
    }

    // Strategy 2: Check aria-label or title
    for (const btn of allButtons) {
      if (btn.offsetParent === null && window.getComputedStyle(btn).display === 'none') continue;
      const aria = (btn.getAttribute('aria-label') || '').toLowerCase();
      const title = (btn.getAttribute('title') || '').toLowerCase();
      if (aria.includes('tiếp') || aria.includes('next') || title.includes('tiếp') || title.includes('next')) {
        triggerClick(btn);
        return { success: true, action: 'clicked_aria_next' };
      }
    }

    // Strategy 3: Find pagination - click next number
    const pageButtons = Array.from(document.querySelectorAll(
      '[class*="pagination"] button, [class*="pagination"] a, [class*="paging"] button, [class*="paging"] a, [class*="page-"], li[class*="page"]'
    ));
    const activePageBtn = pageButtons.find(btn =>
      btn.classList.contains('active') || btn.classList.contains('current') ||
      btn.getAttribute('aria-current') === 'page'
    );

    if (activePageBtn) {
      const nextPageBtn = activePageBtn.nextElementSibling;
      if (nextPageBtn && (nextPageBtn.tagName === 'A' || nextPageBtn.tagName === 'BUTTON' || nextPageBtn.tagName === 'LI')) {
        triggerClick(nextPageBtn);
        return { success: true, action: 'clicked_page' };
      }
    }

    // Strategy 4: Find elements with arrow icon text
    for (const btn of allButtons) {
      if (btn.offsetParent === null && window.getComputedStyle(btn).display === 'none') continue;
      const text = btn.textContent.trim();
      if (text === '>' || text === '→' || text === '▶' || text === '❯' || text === '»') {
        triggerClick(btn);
        return { success: true, action: 'clicked_arrow' };
      }
    }

    return { error: 'Không tìm thấy nút chuyển câu tiếp theo.' };
  }

  
// Note: fillAnswer and fillWithStored are now modularized in fillers.js



  
// ── Capture current slide/page content for AI context ───────
  function captureSlideContent() {
    const contentTexts = [];

    // Strategy 0: Edux main presentation slide container (excluding sidebar and bottom toolbar)
    try {
      const toolbar = typeof getNavigationToolbar === 'function' ? getNavigationToolbar() : null;
      const sidebar = document.querySelector('aside, [class*="sidebar"], div.w-16, div[class*="w-14"], nav');
      const mainContainer = document.querySelector('main, [role="main"], div.flex-1.h-full, div.flex-1.flex-col, div[class*="flex-1"][class*="overflow"]');
      const root = mainContainer || document.body;
      const textNodes = [];
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT, null);
      let node;
      while ((node = walker.nextNode())) {
        if (sidebar && sidebar.contains(node)) continue;
        if (toolbar && toolbar.contains(node)) continue;
        if (node.closest && node.closest('[role="dialog"], [class*="modal"]')) continue; // Skip quiz modal
        if (['H1', 'H2', 'H3', 'H4', 'P', 'LI', 'SPAN', 'DIV'].includes(node.tagName)) {
          if (node.children.length === 0) {
            const t = (node.textContent || '').trim();
            if (t.length > 1 && !/^\d+$/.test(t)) {
              textNodes.push(t);
            }
          }
        }
      }
      if (textNodes.length > 0) {
        const fullSlideText = textNodes.join(' ');
        if (fullSlideText.length > 25) {
          contentTexts.push(fullSlideText);
        }
      }
    } catch (e) {}

    // Strategy 1: Look for main content area (right panel, article, main)
    const contentSelectors = [
      '[class*="content"] [class*="body"]',
      '[class*="lesson"] [class*="content"]',
      'article', 'main', '[role="main"]',
      '[class*="slide-content"]', '[class*="slide_content"]',
      '[class*="noi-dung"]', '[class*="bai-hoc"]',
      '[class*="reading"]', '[class*="passage"]', '[class*="context"]',
      '[class*="material"]', '[class*="resource"]', '[class*="document"]',
      '[class*="tailieu"]', '[class*="tai-lieu"]', '[class*="giao-trinh"]',
      '.prose', '[class*="ck-content"]', '[class*="tiptap"]',
      '[class*="description"]'
    ];

    for (const sel of contentSelectors) {
      try {
        const els = document.querySelectorAll(sel);
        for (const el of els) {
          if (el.offsetParent === null) continue;
          const text = (el.innerText || el.textContent || '').trim();
          if (text.length > 30 && text.length < 5000) {
            contentTexts.push(text);
          }
        }
      } catch (e) {}
    }

    // Strategy 2: Look for headings + following paragraphs
    if (contentTexts.length === 0) {
      const headings = document.querySelectorAll('h1, h2, h3, h4');
      for (const h of headings) {
        if (h.offsetParent === null) continue;
        const hText = h.textContent.trim();
        if (hText.length < 3 || hText.length > 200) continue;
        // Skip navigation/quiz headings
        if (/trang\s*(sau|trước)|câu\s*hỏi\s*trắc/i.test(hText)) continue;
        let text = hText;
        let sibling = h.nextElementSibling;
        while (sibling && ['P', 'DIV', 'UL', 'OL', 'SPAN', 'TABLE'].includes(sibling.tagName)) {
          const sibText = (sibling.innerText || sibling.textContent || '').trim();
          if (sibText.length > 5) text += '\n' + sibText;
          sibling = sibling.nextElementSibling;
          if (text.length > 2000) break;
        }
        if (text.length > 30) contentTexts.push(text);
      }
    }

    // Strategy 3: Broad body text extraction (fallback)
    if (contentTexts.length === 0) {
      const bodyText = (document.body.innerText || '').trim();
      if (bodyText.length > 50) {
        // Remove navigation/toolbar noise
        const cleaned = bodyText
          .replace(/Trang\s*trước.*?Trang\s*sau/gs, '')
          .replace(/\d+\s*\/\s*\d+/g, '')
          .trim();
        if (cleaned.length > 50) contentTexts.push(cleaned.substring(0, 3000));
      }
    }

    // Deduplicate and combine
    const combined = [...new Set(contentTexts)].join('\n---\n');
    return combined.substring(0, 4000);
  }

  
// ── Find "Bài giảng AI" button (Ảnh 1 - Nút màu xanh dương) ──
  function findAiLectureButton() {
    const buttons = Array.from(document.querySelectorAll('button, a, [role="button"]'));
    for (const btn of buttons) {
      if (btn.offsetParent === null && window.getComputedStyle(btn).display === 'none') continue;

      const text = (btn.textContent || '').trim().toLowerCase();
      const title = (btn.getAttribute('title') || btn.getAttribute('aria-label') || btn.parentElement?.getAttribute('label') || '').toLowerCase();
      const cls = (btn.className || '').toString().toLowerCase();

      // 1. TUYỆT ĐỐI BỎ QUA nút "Bài giảng" màu xanh lá cây (Ảnh 3)
      if (text === 'bài giảng' || text === '📖 bài giảng' || title === 'bài giảng') continue;
      if (cls.includes('bg-green') || cls.includes('bg-emerald')) continue;

      // 2. TẬP TRUNG TÌM nút "Bài giảng AI" màu xanh dương (Ảnh 1)
      if (
        text === 'bài giảng ai' || text.includes('bài giảng ai') ||
        title === 'bài giảng ai' || title.includes('bài giảng ai') ||
        (text.includes('ai') && text.includes('bài giảng')) ||
        (cls.includes('border-blue-500') && (text.includes('ai') || title.includes('ai')))
      ) {
        return btn.closest('button, a, [role="button"]') || btn;
      }
    }
    return null;
  }

// ── Get Classroom Quiz Button State (STRICTLY in Slide Viewer Ảnh 2) ──
  function getClassroomQuizButtonState() {
    // Only valid inside Slide Viewer
    if (typeof isInsideSlideViewer === 'function' && !isInsideSlideViewer()) {
      return { button: null, state: 'none' };
    }

    const toolbar = typeof getNavigationToolbar === 'function' ? getNavigationToolbar() : null;
    const root = toolbar || document;

    const eduxDirect = root.querySelector('button.text-green-500.border-green-500, button[class*="text-green-500"][class*="border-green"], button.border-green-500');
    if (eduxDirect) {
      const title = (eduxDirect.getAttribute('title') || eduxDirect.parentElement?.getAttribute('title') || eduxDirect.parentElement?.getAttribute('label') || '').toLowerCase();
      const text = (eduxDirect.textContent || '').toLowerCase();
      const disabled = eduxDirect.disabled === true || eduxDirect.classList.contains('disabled') || eduxDirect.getAttribute('aria-disabled') === 'true';

      // TUYỆT ĐỐI KHÔNG nhận nhầm "Bài giảng" (green) là nút quiz!
      if (text === 'bài giảng' || title === 'bài giảng' || text.includes('bài giảng') || title.includes('bài giảng')) {
        return { button: null, state: 'none' };
      }

      if (title.includes('đang kiểm tra') || text.includes('đang kiểm tra')) {
        return { button: eduxDirect, state: 'checking' };
      }
      if (title.includes('không có câu hỏi') || text.includes('không có câu hỏi')) {
        return { button: eduxDirect, state: 'no_quiz' };
      }
      if (!disabled && (title.includes('trả lời') || title.includes('hỏi') || text.includes('trả lời') || text.includes('hỏi') || eduxDirect.classList.contains('border-green-500'))) {
        return { button: eduxDirect, state: 'ready' };
      }
      return { button: eduxDirect, state: 'disabled' };
    }

    const quizBtn = findClassroomQuizButton();
    if (quizBtn) {
      return { button: quizBtn, state: isButtonEnabled(quizBtn) ? 'ready' : 'disabled' };
    }
    return { button: null, state: 'none' };
  }

// ── Find "Trả lời trên lớp" button (Ảnh 1 / Ảnh 2 - green quiz button) ──
  function findClassroomQuizButton() {
    const toolbar = typeof getNavigationToolbar === 'function' ? getNavigationToolbar() : null;
    if (!toolbar) return null; // STRICT: Only search inside slide viewer toolbar!

    // 0. Primary Direct Edux green button selector inside toolbar:
    const eduxDirect = toolbar.querySelector('button.text-green-500.border-green-500, button[class*="text-green-500"][class*="border-green"], button.border-green-500');
    if (eduxDirect) {
      const disabled = eduxDirect.disabled === true || eduxDirect.classList.contains('disabled') || eduxDirect.getAttribute('aria-disabled') === 'true';
      if (!disabled) {
        const title = (eduxDirect.getAttribute('title') || eduxDirect.parentElement?.getAttribute('title') || eduxDirect.parentElement?.getAttribute('label') || '').toLowerCase();
        const text = (eduxDirect.textContent || '').toLowerCase();
        if (text.includes('không có câu hỏi') || title.includes('không có câu hỏi') || title.includes('đang kiểm tra')) return null;
        if (text.includes('bài giảng') || title.includes('bài giảng')) return null;
        return eduxDirect;
      }
    }

    const quizTextPatterns = [
      'trả lời trên lớp',
      'trả lời câu hỏi trên lớp',
      'hỏi trên lớp',
      'câu hỏi trên lớp',
      'trả lời câu hỏi',
      'câu hỏi ôn tập',
      'làm bài tập',
      'bài tập trên lớp'
    ];

    function isQuizButtonMatch(el) {
      if (!el) return false;
      const t = (el.textContent || '').toLowerCase().trim();
      const title = (el.getAttribute('title') || '').toLowerCase().trim();
      const aria = (el.getAttribute('aria-label') || '').toLowerCase().trim();
      const parentTitle = (el.parentElement?.getAttribute('title') || el.parentElement?.getAttribute('label') || '').toLowerCase().trim();

      // NEVER match "Bài giảng" (green) or "Không có câu hỏi"!
      if (t.includes('bài giảng') || title.includes('bài giảng') || parentTitle.includes('bài giảng')) return false;
      if (t.includes('không có câu hỏi') || title.includes('không có câu hỏi') || parentTitle.includes('không có câu hỏi')) return false;
      if (t.includes('đang kiểm tra') || title.includes('đang kiểm tra') || parentTitle.includes('đang kiểm tra')) return false;

      for (const p of quizTextPatterns) {
        if (t.includes(p) || title.includes(p) || aria.includes(p) || parentTitle.includes(p)) {
          return true;
        }
      }

      const cls = (el.className || '').toString();
      if (cls.includes('text-green-500') && cls.includes('border-green-500')) {
        return true;
      }

      return false;
    }

    const candidates = Array.from(toolbar.querySelectorAll('button, a, [role="button"]'));
    for (const el of candidates) {
      if (el.disabled) continue;
      if (isQuizButtonMatch(el)) {
        return el.closest('button, a, [role="button"]') || el;
      }
    }

    return null;
  }

  // Specialized Question Scanner for Classroom Quiz UI (Ảnh 2 & Edux kje) ──
  function scanClassroomQuizQuestion() {
    try {
      // 1. Find question text: prioritize Edux question box (border-l blue, bg-blue, or prominent prompt card)
      let questionText = '';
      const eduxQBox = document.querySelector(
        'div[class*="border-l-"][class*="bg-blue"], ' +
        'div[class*="border-blue-500"], ' +
        'div[class*="border-blue-600"], ' +
        'div[class*="bg-blue-50"], ' +
        'div[class*="font-semibold"][class*="text-blue-800"]'
      );
      if (eduxQBox && (typeof isElementVisible === 'function' ? isElementVisible(eduxQBox) : eduxQBox.offsetParent !== null)) {
        questionText = (eduxQBox.innerText || eduxQBox.textContent || '').trim();
      }

      if (!questionText || questionText.length < 10) {
        const textBlocks = Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, [class*="question"], [class*="title"], [class*="prompt"], p, div'));
        for (const block of textBlocks) {
          const visible = typeof isElementVisible === 'function' ? isElementVisible(block) : block.offsetParent !== null;
          if (!visible) continue;
          const t = block.textContent.trim();
          const tLower = t.toLowerCase();
          if (
            t.length > 15 && t.length < 600 &&
            !tLower.includes('tiến độ:') &&
            !tLower.includes('mục tiêu học tập') &&
            !tLower.includes('câu hỏi trắc nghiệm') &&
            !tLower.includes('phản hồi') &&
            !tLower.includes('đổi câu hỏi') &&
            !/^[A-D][\.\:\)]/.test(t) &&
            (t.includes('?') || t.includes(':') || t.includes('nào') || t.includes('gì') || t.includes('đâu') || t.includes('chọn') || t.includes('sử dụng'))
          ) {
            questionText = t;
            break;
          }
        }
      }

      // 2. Collect options A, B, C, D
      const letterMap = new Map();

      // Strategy A: Scan card containers (div.rounded-xl.border-2, cards or labels)
      const cards = Array.from(document.querySelectorAll('div[class*="rounded-xl"][class*="border"], div[class*="rounded"][class*="border-2"], div[class*="rounded-lg"][class*="border"], label, [role="radio"]'));
      for (const card of cards) {
        const visible = typeof isElementVisible === 'function' ? isElementVisible(card) : card.offsetParent !== null;
        if (!visible) continue;
        const fullText = (card.innerText || card.textContent || '').trim();
        const m = fullText.match(/(?:^|[\r\n\s])\s*([A-D])[\.\:\)]\s*([\s\S]*)$/i);
        if (m) {
          const letter = m[1].toUpperCase();
          const optContent = m[2].trim().replace(/\s+/g, ' ');
          if (!letterMap.has(letter) && optContent.length > 0) {
            const input = card.querySelector('input[type="radio"], input[type="checkbox"]') || card.querySelector('input');
            letterMap.set(letter, {
              letter,
              cleanText: `${letter}. ${optContent}`,
              element: input || card,
              cardElement: card,
              inputElement: input,
              domNode: card
            });
          }
        }
      }

      // Strategy B: Fallback scan scoped candidate elements starting with A., B., C., D.
      if (letterMap.size < 2) {
        const candidateEls = Array.from(document.querySelectorAll('label, [role="radio"], div[class*="rounded"], div[class*="border"], div[class*="cursor"], p, span, li'));
        for (const el of candidateEls) {
          const visible = typeof isElementVisible === 'function' ? isElementVisible(el) : el.offsetParent !== null;
          if (!visible) continue;
          const t = el.textContent.trim();
          const m = t.match(/(?:^|[\r\n\s])\s*([A-D])[\.\:\)]\s*([\s\S]+)$/i);
          if (m) {
            const letter = m[1].toUpperCase();
            if (!letterMap.has(letter)) {
              const card = el.closest('label, [role="radio"], div[class*="border"], div[class*="rounded"], div') || el;
              const input = card.querySelector('input[type="radio"], input[type="checkbox"]') || el.querySelector('input');
              letterMap.set(letter, {
                letter,
                cleanText: `${letter}. ${m[2].trim().replace(/\s+/g, ' ')}`,
                element: input || card,
                cardElement: card,
                inputElement: input,
                domNode: el
              });
            }
          }
        }
      }

      if (letterMap.has('A') && letterMap.has('B')) {
        const sortedLetters = Array.from(letterMap.keys()).sort();
        const options = [];
        const inputElements = [];
        for (const l of sortedLetters) {
          const item = letterMap.get(l);
          options.push(item.cleanText);
          inputElements.push(item);
        }
        return [{
          questionText: questionText || 'Câu hỏi trắc nghiệm',
          questionType: 'multiple-choice',
          options,
          inputElements,
          element: document.body
        }];
      }
    } catch (e) {}
    return null;
  }
