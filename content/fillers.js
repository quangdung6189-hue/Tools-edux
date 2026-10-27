// ── Fillers Module — Auto Homework Solver ──────────────────────────
// Handles all question filling logic: Multiple Choice, Multiple Select,
// Fill-in-the-blank (Text), Dropdown, and True/False Statements (Edux/CMCU/LMS)

(function () {
  // ── Helper: Execute bulletproof click on any button/element ────────
  async function executeBulletproofClick(element) {
    if (!element) return false;
    console.log('[AutoSolver Click] Target:', element.tagName, element.textContent.trim(), element.className);

    try {
      if (typeof element.scrollIntoView === 'function') {
        element.scrollIntoView({ behavior: 'instant', block: 'nearest' });
      }
      if (typeof element.focus === 'function') {
        element.focus();
      }

      const rect = element.getBoundingClientRect();
      const x = rect.left + Math.min(25, Math.max(5, rect.width / 2));
      const y = rect.top + Math.max(5, rect.height / 2);

      const eventOpts = {
        bubbles: true,
        cancelable: true,
        view: window,
        clientX: x,
        clientY: y,
        screenX: x,
        screenY: y,
      };

      // 1. Dispatch pointer events if supported
      if (typeof PointerEvent !== 'undefined') {
        try {
          element.dispatchEvent(new PointerEvent('pointerdown', eventOpts));
          element.dispatchEvent(new PointerEvent('pointerup', eventOpts));
        } catch (_) {}
      }

      // 2. Dispatch mouse events
      try {
        element.dispatchEvent(new MouseEvent('mousedown', eventOpts));
        element.dispatchEvent(new MouseEvent('mouseup', eventOpts));
        element.dispatchEvent(new MouseEvent('click', eventOpts));
      } catch (_) {}

      // 3. Native DOM click
      if (typeof element.click === 'function') {
        element.click();
      }

      // 4. React Fiber / Props direct onClick invocation fallback (React 16, 17, 18)
      try {
        const reactKey = Object.keys(element).find(k =>
          k.startsWith('__reactProps') || k.startsWith('__reactEvents') || k.startsWith('__reactFiber')
        );
        if (reactKey) {
          const props = element[reactKey];
          const onClick = props?.onClick || props?.memoizedProps?.onClick;
          if (typeof onClick === 'function') {
            onClick({
              preventDefault: () => {},
              stopPropagation: () => {},
              target: element,
              currentTarget: element,
              bubbles: true
            });
          }
        }
      } catch (_) {}

      return true;
    } catch (err) {
      if (typeof element.click === 'function') {
        element.click();
        return true;
      }
      return false;
    }
  }

  // ── Helper: Scan live True/False statement rows on the page ────────
  function scanLiveTrueFalseRows(root = document.body) {
    const container = root || document.body;
    if (!container) return [];

    function isTrue(t) {
      if (!t) return false;
      const clean = (t || '').normalize('NFC').replace(/[\u200B-\u200D\uFEFF\u00A0]/g, ' ').trim().toLowerCase();
      return /^(?:\(?\s*(?:đúng|true|đ)\s*\)?[:\.]?|1[\.:\)]\s*đúng)$/i.test(clean) || clean === 'đúng' || clean === 'true';
    }

    function isFalse(t) {
      if (!t) return false;
      const clean = (t || '').normalize('NFC').replace(/[\u200B-\u200D\uFEFF\u00A0]/g, ' ').trim().toLowerCase();
      return /^(?:\(?\s*(?:sai|false|s)\s*\)?[:\.]?|2[\.:\)]\s*sai)$/i.test(clean) || clean === 'sai' || clean === 'false';
    }

    const rows = [];

    // Strategy 1: Find dedicated statement card/row containers with 1 True & 1 False button
    const candidates = Array.from(container.querySelectorAll(
      'div[class*="border"], div[class*="rounded"], div[class*="bg-gray"], tr, li, div[class*="item"], div[class*="statement"], div[class*="card"], div[class*="flex"]'
    ));

    for (const el of candidates) {
      if (['BUTTON', 'INPUT', 'LABEL', 'A'].includes(el.tagName)) continue;
      if (el.closest && el.closest('[class*="ahs-"], [id*="ahs-"]')) continue;
      if (el.offsetParent === null && window.getComputedStyle(el).display === 'none') continue;

      const clickables = Array.from(el.querySelectorAll('button, [role="button"], input[type="button"], label'));
      const tBtns = clickables.filter(b => isTrue(b.textContent));
      const fBtns = clickables.filter(b => isFalse(b.textContent));

      if (tBtns.length === 1 && fBtns.length === 1 && tBtns[0] !== fBtns[0]) {
        const textWithoutBtns = (el.textContent || '')
          .replace(tBtns[0].textContent, '')
          .replace(fBtns[0].textContent, '')
          .replace(/\s+/g, ' ')
          .trim();

        if (textWithoutBtns.length >= 8 && !/^chọn\s+đúng\s+hoặc\s+sai/i.test(textWithoutBtns)) {
          // Check if any child of el is ALSO a valid card (we want the innermost container)
          const childCandidates = Array.from(el.querySelectorAll(
            'div[class*="border"], div[class*="rounded"], div[class*="bg-gray"], tr, li, div[class*="item"], div[class*="statement"], div[class*="card"]'
          ));
          const hasChildRow = childCandidates.some(c => {
            if (c === el) return false;
            const cClickables = Array.from(c.querySelectorAll('button, [role="button"], input[type="button"], label'));
            const ct = cClickables.filter(b => isTrue(b.textContent));
            const cf = cClickables.filter(b => isFalse(b.textContent));
            return ct.length === 1 && cf.length === 1;
          });

          if (!hasChildRow) {
            rows.push({
              rowElement: el,
              trueBtn: tBtns[0],
              falseBtn: fBtns[0],
              text: textWithoutBtns
            });
          }
        }
      }
    }

    // Deduplicate cards: if any card contains another card, keep innermost
    const uniqueRows = [];
    const seen = new Set();
    for (const r of rows) {
      if (!seen.has(r.rowElement) && !uniqueRows.some(u => u.rowElement.contains(r.rowElement) || r.rowElement.contains(u.rowElement))) {
        seen.add(r.rowElement);
        uniqueRows.push(r);
      }
    }

    // Sort top-to-bottom
    uniqueRows.sort((a, b) => {
      try {
        const aRect = a.rowElement.getBoundingClientRect();
        const bRect = b.rowElement.getBoundingClientRect();
        if (Math.abs(aRect.top - bRect.top) > 5) return aRect.top - bRect.top;
      } catch (e) {}
      if (typeof a.rowElement.compareDocumentPosition === 'function') {
        const pos = a.rowElement.compareDocumentPosition(b.rowElement);
        return (pos & Node.DOCUMENT_POSITION_FOLLOWING) ? -1 : 1;
      }
      return 0;
    });

    if (uniqueRows.length > 0) {
      return uniqueRows;
    }

    // Strategy 2: Proximity Button Pairing Fallback
    const allClickables = Array.from(container.querySelectorAll('button, [role="button"], input[type="button"], label'));
    const allTrue = allClickables.filter(b => isTrue(b.textContent));
    const allFalse = allClickables.filter(b => isFalse(b.textContent));

    const usedFalse = new Set();
    const paired = [];
    for (const tBtn of allTrue) {
      let bestFalse = null;
      let minDistance = Infinity;
      for (const fBtn of allFalse) {
        if (usedFalse.has(fBtn)) continue;
        let p = tBtn.parentElement;
        let dist = 1;
        while (p && p !== document.body && dist <= 5) {
          if (p.contains(fBtn)) {
            if (dist < minDistance) {
              minDistance = dist;
              bestFalse = fBtn;
            }
            break;
          }
          p = p.parentElement;
          dist++;
        }
      }
      if (bestFalse) {
        usedFalse.add(bestFalse);
        paired.push({
          rowElement: tBtn.parentElement || tBtn,
          trueBtn: tBtn,
          falseBtn: bestFalse,
          text: `Mệnh đề ${paired.length + 1}`
        });
      }
    }

    return paired;
  }

  // ── Fill verification helper ─────────────────────────────────
  // React SPAs hay nuốt sự kiện click/input — phải poll DOM xác nhận trạng thái thật
  // đã thay đổi trước khi báo success, nếu không Auto sẽ chuyển câu khi điền chưa ăn.
  async function waitForInputState(el, predicate, timeoutMs = 700) {
    const start = Date.now();
    const getInput = () => {
      if (!el || !el.tagName) return null;
      if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT') return el;
      if (el.control && el.control.tagName === 'INPUT') return el.control;
      try {
        return el.querySelector?.('input[type="radio"], input[type="checkbox"], input:not([type]), textarea, select') || null;
      } catch (_) {
        return null;
      }
    };

    // Không tìm thấy input liên quan (option tùy chỉnh không có input) → không xác minh được,
    // giữ hành vi cũ: coi như thành công (best-effort).
    if (!getInput()) return true;

    while (Date.now() - start < timeoutMs) {
      try {
        if (predicate(getInput())) return true;
      } catch (_) {}
      await new Promise(r => setTimeout(r, 70));
    }
    return false;
  }

  // ── Fill Multiple Choice ─────────────────────────────────────────
  async function fillMultipleChoice(inputs, options, answerText, answerLetter) {
    let letter = answerLetter;
    if (!letter && answerText) {
      letter = typeof extractAnswerLetter === 'function' ? extractAnswerLetter(answerText) : '';
    }

    let targetIndex = -1;

    // 1. Match by letter (A, B, C, D)
    if (letter) {
      const letters = letter.split(/[,\s]+/).map(l => l.trim().toUpperCase());
      const firstLetter = letters[0];
      const index = firstLetter.charCodeAt(0) - 65; // A=0, B=1, ...
      if (inputs && index >= 0 && index < inputs.length) {
        targetIndex = index;
      }
    }

    // 2. Match by text content
    if (targetIndex === -1 && answerText && options && options.length > 0) {
      const answerLower = answerText.toLowerCase();
      for (let i = 0; i < options.length; i++) {
        const optClean = options[i].toLowerCase().replace(/^[a-f][\.:\)\-–—]\s*/i, '').trim();
        if (optClean && (answerLower.includes(optClean) || optClean.includes(answerLower))) {
          if (inputs && i < inputs.length) {
            targetIndex = i;
            break;
          }
        }
      }
    }

    // 3. Click target if found in inputs — XÁC MINH click được ghi nhận trước khi báo success
    if (targetIndex >= 0 && inputs && targetIndex < inputs.length) {
      const el = inputs[targetIndex];
      const expectedLetter = String.fromCharCode(65 + targetIndex);

      if (typeof clickOptionElement === 'function') {
        clickOptionElement(el);
      } else {
        executeBulletproofClick(el);
      }

      // React SPA có thể nuốt click lần 1 — poll xem input thật sự được check chưa
      if (await waitForInputState(el, (inp) => inp.checked)) {
        return { success: true, filled: expectedLetter };
      }

      // Thử lại lần 2 với bulletproof click
      executeBulletproofClick(el);
      if (await waitForInputState(el, (inp) => inp.checked)) {
        return { success: true, filled: expectedLetter };
      }

      console.warn(`[AutoSolver Fill] Click phương án ${expectedLetter} không được trang ghi nhận sau 2 lần thử.`);
      return { error: `Click phương án ${expectedLetter} không được ghi nhận (đã thử 2 lần).` };
    }

    // 4. Fallback: Search directly on page by letter (A, B, C, D) if inputs didn't match
    if (letter) {
      const targetLetter = letter.trim().toUpperCase()[0];
      const letterRegex = new RegExp(`^\\s*\\(?${targetLetter}\\)?(?:\\.|\\:|\\)|\\s*[-–—])\\s*`, 'i');
      const candidates = Array.from(document.querySelectorAll('label, [role="radio"], [class*="option"], [class*="choice"], [class*="radio"], [class*="item"], div, span'));
      for (const el of candidates) {
        if (el.closest('[class*="dropdown"], [class*="popover"], [class*="popup"], [class*="tooltip"]')) continue;
        if (el.offsetParent === null && window.getComputedStyle(el).display === 'none') continue;
        if (el.children.length > 6) continue;

        const text = el.textContent.trim();
        if (letterRegex.test(text)) {
          if (typeof clickOptionElement === 'function') {
            clickOptionElement(el);
          } else {
            executeBulletproofClick(el);
          }
          return { success: true, filled: targetLetter };
        }
      }
    }

    return { error: 'Không thể tìm đáp án phù hợp để điền.' };
  }

  // ── Fill Multiple Select (checkboxes) ────────────────────────────
  async function fillMultipleSelect(inputs, options, answerText, answerLetter) {
    if (!inputs || inputs.length === 0) {
      return { error: 'Không tìm thấy input element.' };
    }

    const filled = [];
    const failedLetters = [];

    if (answerLetter) {
      const letters = answerLetter.split(/[,\s]+/).map(l => l.trim().toUpperCase());
      for (const letter of letters) {
        const index = letter.charCodeAt(0) - 65;
        if (index >= 0 && index < inputs.length) {
          const el = inputs[index];
          if (typeof clickOptionElement === 'function') {
            clickOptionElement(el);
          } else {
            executeBulletproofClick(el);
          }

          if (await waitForInputState(el, (inp) => inp.checked)) {
            filled.push(letter);
          } else {
            executeBulletproofClick(el);
            if (await waitForInputState(el, (inp) => inp.checked)) {
              filled.push(letter);
            } else {
              failedLetters.push(letter);
            }
          }
        }
      }
    }

    if (filled.length > 0 && failedLetters.length === 0) {
      return { success: true, filled: filled.join(', ') };
    }
    if (filled.length > 0) {
      return { error: `Chỉ điền được ${filled.join(', ')}, các phương án ${failedLetters.join(', ')} không được trang ghi nhận.` };
    }

    return { error: 'Không thể tìm đáp án phù hợp để điền.' };
  }

  // ── Fill Dropdown ────────────────────────────────────────────────
  async function fillDropdown(select, options, answerText, answerLetter) {
    if (!select) {
      return { error: 'Không tìm thấy dropdown.' };
    }

    const applySelect = (target, setter) => {
      setter(target);
      target.dispatchEvent(new Event('change', { bubbles: true }));
    };

    const verifySelected = async (target, expectedValue, timeoutMs = 700) => {
      return await waitForInputState(target, (inp) => inp.selectedIndex > 0 && (!expectedValue || inp.value === expectedValue), timeoutMs);
    };

    if (answerLetter) {
      const index = answerLetter.charCodeAt(0) - 65;
      if (index >= 0 && index < select.options.length) {
        applySelect(select, (s) => { s.selectedIndex = index; });
        if (await verifySelected(select, select.options[index].value)) {
          return { success: true, filled: select.options[index].text };
        }
        applySelect(select, (s) => { s.selectedIndex = index; });
        if (await verifySelected(select, select.options[index].value)) {
          return { success: true, filled: select.options[index].text };
        }
        return { error: `Dropdown không ghi nhận lựa chọn ${answerLetter}.` };
      }
    }

    for (const option of select.options) {
      if (option.text.toLowerCase().includes(answerText.toLowerCase())) {
        applySelect(select, (s) => { s.value = option.value; });
        if (await verifySelected(select, option.value)) {
          return { success: true, filled: option.text };
        }
        applySelect(select, (s) => { s.value = option.value; });
        if (await verifySelected(select, option.value)) {
          return { success: true, filled: option.text };
        }
        return { error: 'Dropdown không ghi nhận lựa chọn theo nội dung.' };
      }
    }

    return { error: 'Không tìm thấy lựa chọn phù hợp.' };
  }

  // ── Helper: Clean Fill-in-the-blank answer (single exact phrase) ─
  function cleanFillInTheBlankAnswer(answerText) {
    if (!answerText) return '';
    let text = answerText.trim();

    // 1. Remove leading prefixes
    text = text.replace(/^(?:từ\s*cần\s*điền|đáp\s*án\s*(?:là|đúng)?|câu\s*trả\s*lời|kết\s*quả|từ\s*thích\s*hợp|cụm\s*từ\s*cần\s*điền|lệnh\s*cần\s*dùng)\s*[:\-\.]*\s*/i, '');

    // 2. If code backticks or bold markers wrap answer
    const codeBacktickMatch = text.match(/^`([^`]+)`/);
    if (codeBacktickMatch) return codeBacktickMatch[1].trim();

    const boldMatch = text.match(/^\*\*([^*]+)\*\*/);
    if (boldMatch) return boldMatch[1].trim();

    // 3. Take first line and clean prefixes
    let line = text.split('\n')[0].trim();
    line = line.replace(/^[-*•]\s+/, '').replace(/^\d+[\.]\s+/, '');
    line = line.replace(/^(?:từ\s*cần\s*điền|đáp\s*án\s*(?:là|đúng)?|câu\s*trả\s*lời|kết\s*quả|từ\s*thích\s*hợp|cụm\s*từ\s*cần\s*điền|lệnh\s*cần\s*dùng)\s*[:\-\.]*\s*/i, '');

    const inlineCodeMatch = line.match(/`([^`]+)`/);
    if (inlineCodeMatch) return inlineCodeMatch[1].trim();

    const inlineBoldMatch = line.match(/\*\*([^*]+)\*\*/);
    if (inlineBoldMatch) return inlineBoldMatch[1].trim();

    // 4. Strip quotes
    line = line.replace(/^["'""`]+|["'""`]+$/g, '').trim();

    // 5. Remove explanatory parentheses
    line = line.replace(/\s*\((?:hoặc|hay|tuỳ\s*chọn|tùy\s*chọn|ví\s*dụ|vd|giải\s*thích|lưu\s*ý|tạm\s*dịch|tiếng\s*anh)[^)]*\)/gi, '');

    // 6. Multiple alternatives separated by "hoặc", "hay"
    if (!/[(){};=<>"]/.test(line)) {
      const orParts = line.split(/\s+(?:hoặc|hay)\s+/i);
      if (orParts.length > 1 && orParts[0].trim().length > 0) {
        line = orParts[0].trim();
      }
    }

    // 7. Trailing period only for natural language
    if (!/[();{}=<>\-\$]/.test(line)) {
      line = line.replace(/\.$/, '').trim();
    }

    return line.trim();
  }

  // ── Fill Text Input ──────────────────────────────────────────────
  // ── Fill Text Input ──────────────────────────────────────────────
  async function fillTextInput(inputs, answerText) {
    if (!inputs || inputs.length === 0) {
      return { error: 'Không tìm thấy ô nhập liệu.' };
    }

    function setInputValue(target, value) {
      const proto = target.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
      const nativeSetter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;

      target.focus();
      if (nativeSetter) {
        nativeSetter.call(target, value);
      } else {
        target.value = value;
      }

      target.dispatchEvent(new Event('input', { bubbles: true }));
      target.dispatchEvent(new Event('change', { bubbles: true }));
      target.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true }));
    }

    // Xác minh giá trị thật sự được giữ trong DOM (React controlled input có thể reset lại)
    const verifyValue = async (target, expected, timeoutMs = 600) => {
      return await waitForInputState(target, (inp) => (inp.value || '').trim() === expected, timeoutMs);
    };

    const retrySet = async (target, value) => {
      setInputValue(target, value);
      if ((target.value || '').trim() === value) return true;
      if (await verifyValue(target, value)) return true;
      // React reset giá trị → set lại lần 2 rồi poll
      setInputValue(target, value);
      return await verifyValue(target, value);
    };

    const firstTarget = inputs[0];
    const isSingleLine = firstTarget.tagName === 'INPUT';

    if (inputs.length === 1) {
      const cleanValue = isSingleLine ? cleanFillInTheBlankAnswer(answerText) : answerText.trim();
      if (await retrySet(firstTarget, cleanValue)) {
        return { success: true, filled: cleanValue };
      }
      return { error: 'Trang không ghi nhận nội dung đã điền (thử 2 lần).' };
    }

    // If multiple inputs on the page
    const cleanLines = answerText.split('\n').map(l => cleanFillInTheBlankAnswer(l)).filter(Boolean);
    const filledValues = [];
    const failedIdx = [];
    for (let idx = 0; idx < inputs.length; idx++) {
      const input = inputs[idx];
      const isInputSingleLine = input.tagName === 'INPUT';
      const val = isInputSingleLine
        ? ((idx < cleanLines.length) ? cleanLines[idx] : cleanFillInTheBlankAnswer(answerText))
        : answerText.trim();
      if (await retrySet(input, val)) {
        filledValues.push(val);
      } else {
        failedIdx.push(idx + 1);
      }
    }

    if (failedIdx.length === 0) {
      return { success: true, filled: filledValues.join(', ') };
    }
    return { error: `Trang không ghi nhận nội dung ở ô nhập thứ ${failedIdx.join(', ')}.` };
  }

  // ── Parse True/False Statements Answer ───────────────────────────
  function parseTrueFalseStatementsAnswer(answerText, totalStatements = 4) {
    if (!answerText) return {};

    const results = {};
    const normalizedText = answerText.replace(/[*_`]/g, '');

    // Strategy 1: Look for numbered matches globally: "1. Đúng", "1: Sai", "1 - Đ", "1. Đ, 2. S..."
    const globalNumberedRegex = /(?:mệnh\s*đề|phát\s*biểu|ý|câu)?\s*(\d+)[\.:\)\s\-–—]+\s*(đúng|sai|true|false|đ|s)(?![a-zA-Z0-9_à-ỹđ])/gi;
    let match;
    while ((match = globalNumberedRegex.exec(normalizedText)) !== null) {
      const num = parseInt(match[1], 10);
      const val = /^(?:đúng|true|đ)$/i.test(match[2]);
      results[num] = val;
    }

    // Strategy 1b: Numbered line with verdict at the end: "1. Product backlog...: Đúng" or "1. ... -> Sai"
    if (Object.keys(results).length === 0) {
      const lineEndRegex = /(?:^|[\r\n]+)\s*(?:mệnh\s*đề|phát\s*biểu|ý|câu)?\s*(\d+)[\.:\)\s\-–—].*?[:\-\s\>\=]\s*(đúng|sai|true|false|đ|s)\s*$/gmi;
      let lineMatch;
      while ((lineMatch = lineEndRegex.exec(normalizedText)) !== null) {
        const num = parseInt(lineMatch[1], 10);
        const val = /^(?:đúng|true|đ)$/i.test(lineMatch[2]);
        results[num] = val;
      }
    }

    // Strategy 2: If lettered matches globally: "a. Đúng", "b. Sai", "c) Đúng", "d: Sai"
    if (Object.keys(results).length === 0) {
      const globalLetterRegex = /(?:mệnh\s*đề|phát\s*biểu|ý)?\s*\(?([a-d])\)?[\.:\)\s\-–—]+\s*(đúng|sai|true|false|đ|s)(?![a-zA-Z0-9_à-ỹđ])/gi;
      while ((match = globalLetterRegex.exec(normalizedText)) !== null) {
        const num = match[1].toLowerCase().charCodeAt(0) - 96; // a=1, b=2...
        const val = /^(?:đúng|true|đ)$/i.test(match[2]);
        results[num] = val;
      }
    }

    // Strategy 3: Sequential lines with just "Đúng", "Sai", "Đ", "S"
    if (Object.keys(results).length === 0) {
      const lines = normalizedText.split(/[\r\n]+/).map(l => l.trim()).filter(Boolean);
      let currentIdx = 1;
      for (const line of lines) {
        if (currentIdx > totalStatements) break;
        const cleanLine = line.replace(/^[\d\w\.:\)\s\-–—]+/, '').trim();
        const word = cleanLine || line;
        if (/^(?:đúng|true|đ)$/i.test(word)) {
          results[currentIdx++] = true;
        } else if (/^(?:sai|false|s)$/i.test(word)) {
          results[currentIdx++] = false;
        }
      }
    }

    // Strategy 4: Comma / Dash separated list: e.g. "Đúng, Sai, Đúng, Sai" or "Đ - S - Đ - S"
    if (Object.keys(results).length === 0) {
      const tokens = normalizedText.split(/[,;\-\/]+/).map(t => t.trim()).filter(Boolean);
      if (tokens.length >= 2) {
        let currentIdx = 1;
        for (const token of tokens) {
          if (currentIdx > totalStatements) break;
          if (/^(?:đúng|true|đ)$/i.test(token)) {
            results[currentIdx++] = true;
          } else if (/^(?:sai|false|s)$/i.test(token)) {
            results[currentIdx++] = false;
          }
        }
      }
    }

    // Strategy 5: Single True/False fallback (if only 1 statement)
    if (Object.keys(results).length === 0) {
      if (/^(?:đúng|true|đ)$/i.test(normalizedText.trim())) {
        results[1] = true;
      } else if (/^(?:sai|false|s)$/i.test(normalizedText.trim())) {
        results[1] = false;
      }
    }

    return results;
  }

  // ── Fill True/False Statements (Bulletproof Live React Engine) ─────
  async function fillTrueFalseStatements(statements, answerText) {
    const parsedAnswers = parseTrueFalseStatementsAnswer(answerText, statements ? statements.length : 4);
    console.log('[AutoSolver TF Fill] answerText:', answerText);
    console.log('[AutoSolver TF Fill] parsedAnswers:', JSON.stringify(parsedAnswers));

    const totalToFill = Math.max(statements ? statements.length : 0, Object.keys(parsedAnswers).length);
    if (totalToFill === 0) {
      return { error: 'Không tìm thấy mệnh đề hoặc đáp án Đúng/Sai.' };
    }

    function isTrueText(t) {
      if (!t) return false;
      const clean = (t || '').normalize('NFC').replace(/[\u200B-\u200D\uFEFF\u00A0]/g, ' ').trim().toLowerCase();
      return /^(?:\(?\s*(?:đúng|true|đ)\s*\)?[:\.]?|1[\.:\)]\s*đúng)$/i.test(clean) || clean === 'đúng' || clean === 'true';
    }

    function isFalseText(t) {
      if (!t) return false;
      const clean = (t || '').normalize('NFC').replace(/[\u200B-\u200D\uFEFF\u00A0]/g, ' ').trim().toLowerCase();
      return /^(?:\(?\s*(?:sai|false|s)\s*\)?[:\.]?|2[\.:\)]\s*sai)$/i.test(clean) || clean === 'sai' || clean === 'false';
    }

    function isButtonActuallyActive(btn, isTrue) {
      if (!btn) return false;
      if (btn.tagName === 'INPUT') return btn.checked;
      if (btn.getAttribute('aria-checked') === 'true') return true;
      if (btn.getAttribute('aria-pressed') === 'true') return true;

      const cls = (btn.className || '');
      if (typeof cls === 'string') {
        const classList = cls.split(/\s+/);
        if (isTrue) {
          if (classList.some(c => c === 'bg-green-500' || c === 'bg-green-600' || c === 'border-green-500' || c === 'bg-emerald-500')) return true;
        } else {
          if (classList.some(c => c === 'bg-red-500' || c === 'bg-red-600' || c === 'border-red-500' || c === 'bg-rose-500')) return true;
        }
        if (classList.includes('active') || classList.includes('selected') || classList.includes('checked')) return true;
      }
      return false;
    }

    const filled = [];

    // Process each statement sequentially with fresh DOM re-querying
    // Crucial for React 18: each click modifies state, so we must query the fresh DOM
    // to avoid clicking unmounted nodes or overwriting previous statements in Edux!
    for (let i = 0; i < totalToFill; i++) {
      const stmtIndex = i + 1;
      const targetVal = parsedAnswers[stmtIndex];

      if (targetVal === undefined) {
        console.warn(`[AutoSolver TF Fill] No answer for statement ${stmtIndex}, skipping`);
        continue;
      }

      let targetBtn = null;

      // 1. FRESH DOM QUERY: Find live statement rows on page
      const liveRows = scanLiveTrueFalseRows(document.body);
      if (liveRows && liveRows.length > i) {
        const row = liveRows[i];
        targetBtn = targetVal ? row.trueBtn : row.falseBtn;
      }

      // 2. Fallback to stored statement references if live row missed
      if (!targetBtn || !document.body.contains(targetBtn)) {
        if (statements && statements.length > i) {
          const stmt = statements[i];
          const rawBtn = targetVal ? stmt.trueElement : stmt.falseElement;
          if (rawBtn && document.body.contains(rawBtn)) {
            targetBtn = rawBtn;
          } else if (stmt.cardElement && document.body.contains(stmt.cardElement)) {
            const btns = Array.from(stmt.cardElement.querySelectorAll('button, [role="button"], label'));
            targetBtn = btns.find(b => targetVal ? isTrueText(b.textContent) : isFalseText(b.textContent));
          }
        }
      }

      // 3. Fallback to sequential global Đúng / Sai buttons on the page
      if (!targetBtn || !document.body.contains(targetBtn)) {
        const allTrueBtns = Array.from(document.querySelectorAll('button, [role="button"], label')).filter(b => isTrueText(b.textContent));
        const allFalseBtns = Array.from(document.querySelectorAll('button, [role="button"], label')).filter(b => isFalseText(b.textContent));
        if (targetVal && allTrueBtns.length > i && document.body.contains(allTrueBtns[i])) {
          targetBtn = allTrueBtns[i];
        } else if (!targetVal && allFalseBtns.length > i && document.body.contains(allFalseBtns[i])) {
          targetBtn = allFalseBtns[i];
        }
      }

      if (targetBtn && document.body.contains(targetBtn)) {
        // Handle radio input if applicable
        const radioInput = targetBtn.tagName === 'INPUT' ? targetBtn : targetBtn.querySelector('input[type="radio"]');
        if (radioInput) {
          try {
            const proto = window.HTMLInputElement.prototype;
            const setter = Object.getOwnPropertyDescriptor(proto, 'checked')?.set;
            if (setter) setter.call(radioInput, true);
            else radioInput.checked = true;
            radioInput.dispatchEvent(new Event('input', { bubbles: true }));
            radioInput.dispatchEvent(new Event('change', { bubbles: true }));
          } catch (_) {}
        }

        // Ensure bulletproof click runs on target button
        console.log(`[AutoSolver TF Fill] Clicking button for stmt ${stmtIndex}: ${targetVal ? 'Đúng' : 'Sai'}`);
        await executeBulletproofClick(targetBtn);

        // Actively wait for button to become active (giving React 18 time to re-render & update closure state)
        let becameActive = false;
        const pollStart = Date.now();
        while (Date.now() - pollStart < 350) {
          await new Promise(r => setTimeout(r, 60));
          const freshRows = scanLiveTrueFalseRows(document.body);
          const freshBtn = freshRows && freshRows.length > i ? (targetVal ? freshRows[i].trueBtn : freshRows[i].falseBtn) : targetBtn;
          if (isButtonActuallyActive(freshBtn, targetVal) || isButtonActuallyActive(targetBtn, targetVal)) {
            becameActive = true;
            break;
          }
        }

        // If still not active after 350ms, try a secondary direct native click
        if (!becameActive) {
          try {
            targetBtn.click();
          } catch (_) {}
          await new Promise(r => setTimeout(r, 120));
        }

        filled.push(`${stmtIndex}: ${targetVal ? 'Đúng' : 'Sai'}`);
        console.log(`[AutoSolver TF Fill] ✅ Successfully filled stmt ${stmtIndex}: ${targetVal ? 'Đúng' : 'Sai'}`);
      } else {
        console.warn(`[AutoSolver TF Fill] ⚠️ Could not find live button for stmt ${stmtIndex}`);
      }
    }

    if (filled.length > 0) {
      return { success: true, filled: filled.join(', ') };
    }

    return { error: 'Không thể tìm thấy nút Đúng/Sai phù hợp để điền.' };
  }

  // ── Helper: Detect if answer text looks like True/False response ──
  function detectTrueFalseAnswer(answerText) {
    if (!answerText || typeof answerText !== 'string') return false;
    const text = answerText.normalize('NFC').replace(/[*_`]/g, '').trim();

    // Pattern 1: Numbered "1. Đúng", "2. Sai", "1: Đ", "2) S"
    if (/(?:^|[\r\n]+)\s*\d+[\.:\)\s\-–—]+\s*(?:đúng|sai|true|false|đ|s)\b/i.test(text)) return true;

    // Pattern 2: Standalone single word "Đúng" or "Sai"
    if (/^(?:đúng|sai|true|false)$/i.test(text.trim())) return true;

    // Pattern 3: Comma/dash separated list "Đúng, Sai, Đúng, Sai" or "Đ - S - Đ - S"
    if (/^(?:đúng|sai|đ|s|true|false)(?:\s*[,;\-\/]\s*(?:đúng|sai|đ|s|true|false)){1,}/i.test(text)) return true;

    // Pattern 4: Lettered "a. Đúng", "b. Sai", "c) Đúng", "d: Sai"
    if (/(?:^|[\r\n]+)\s*\(?[a-d]\)?[\.:\)\s\-–—]+\s*(?:đúng|sai|true|false|đ|s)\b/i.test(text)) return true;

    // Pattern 5: "Mệnh đề 1: Đúng", "Phát biểu 2: Sai", "Ý 1 - Đúng"
    if (/(?:mệnh\s*đề|phát\s*biểu|ý|câu)\s*\d+\s*[\.:\)\-–—]+\s*(?:đúng|sai|true|false|đ|s)\b/i.test(text)) return true;

    // Pattern 6: Line ends with verdict "...: Đúng" or "... -> Sai"
    if (/[:\-\s>\=]\s*(?:đúng|sai|true|false)\s*$/im.test(text)) return true;

    // Pattern 7: Multiple lines each just "Đúng" or "Sai"
    const lines = text.split(/[\r\n]+/).map(l => l.trim()).filter(Boolean);
    if (lines.length >= 2) {
      const tfLines = lines.filter(l => /^(?:đúng|sai|true|false|đ|s)$/i.test(l.replace(/^[\d\w\.:\)\s\-–—]+/, '').trim()));
      if (tfLines.length >= 2) return true;
    }

    return false;
  }

  // ── Helper: Try to find and fill TF statements on the page ──────
  async function tryFillTrueFalse(answerText, questionElement) {
    console.log('[AutoSolver TF] Attempting True/False fill...');

    // 1. Primary: Use scanTrueFalseStatements from utils.js (most reliable)
    let liveStatements = null;
    if (typeof scanTrueFalseStatements === 'function') {
      liveStatements = scanTrueFalseStatements(document.body);
      console.log(`[AutoSolver TF] scanTrueFalseStatements(body) found ${liveStatements ? liveStatements.length : 0} statements`);
    }

    // 2. Try scoped scan if global returned nothing
    if ((!liveStatements || liveStatements.length === 0) && questionElement && questionElement !== document.body) {
      if (typeof scanTrueFalseStatements === 'function') {
        liveStatements = scanTrueFalseStatements(questionElement);
        console.log(`[AutoSolver TF] scanTrueFalseStatements(element) found ${liveStatements ? liveStatements.length : 0} statements`);

        if (!liveStatements || liveStatements.length === 0) {
          const parent = questionElement.parentElement || questionElement;
          liveStatements = scanTrueFalseStatements(parent);
          console.log(`[AutoSolver TF] scanTrueFalseStatements(parent) found ${liveStatements ? liveStatements.length : 0} statements`);
        }
      }
    }

    // 3. Fallback: Use scanLiveTrueFalseRows (fillers.js internal scanner)
    if (!liveStatements || liveStatements.length === 0) {
      const liveRows = scanLiveTrueFalseRows(document.body);
      console.log(`[AutoSolver TF] scanLiveTrueFalseRows(body) found ${liveRows ? liveRows.length : 0} rows`);
      if (liveRows && liveRows.length > 0) {
        liveStatements = liveRows.map((r, i) => ({
          index: i + 1,
          text: r.text,
          trueElement: r.trueBtn,
          falseElement: r.falseBtn,
          cardElement: r.rowElement
        }));
      }
    }

    if (liveStatements && liveStatements.length > 0) {
      console.log(`[AutoSolver TF] Filling ${liveStatements.length} TF statements...`);
      return await fillTrueFalseStatements(liveStatements, answerText);
    }

    console.warn('[AutoSolver TF] No TF statements found on page at all.');
    return null; // Signal caller that TF fill didn't work
  }

  // ── Main Fill Answer Orchestrator ────────────────────────────────
  async function fillAnswer(questionIndex, answerText, answerLetter) {
    console.log(`[AutoSolver Fill] fillAnswer called: index=${questionIndex}, answerLetter=${answerLetter}, answer="${(answerText || '').substring(0, 80)}..."`);

    // 1. Re-scan current page to get fresh question & elements
    let currentQuestions = typeof scanQuestions === 'function' ? scanQuestions() : [];
    if (!currentQuestions || currentQuestions.length === 0) {
      if (typeof scanClassroomQuizQuestion === 'function') {
        currentQuestions = scanClassroomQuizQuestion();
      }
    }

    // 2. Select appropriate question: match index if multi-question page, else take active
    let question = null;
    if (currentQuestions && currentQuestions.length > 0) {
      if (questionIndex !== undefined && questionIndex >= 0 && questionIndex < currentQuestions.length) {
        question = currentQuestions[questionIndex];
      } else {
        question = currentQuestions[0];
      }
    }

    if (!question) {
      // Fallback: use stored question if available
      const stored = window.__ahs_scannedQuestions || (typeof scannedQuestions !== 'undefined' ? scannedQuestions : []);
      if (stored && questionIndex !== undefined && questionIndex < stored.length) {
        return await fillWithStored(stored[questionIndex], answerText, answerLetter);
      }
      return { error: 'Không tìm thấy câu hỏi trên trang.' };
    }

    // Remove previous visual highlights
    document.querySelectorAll('.ahs-highlight').forEach(el => el.classList.remove('ahs-highlight'));

    // Highlight current question
    if (question.element && question.element !== document.body) {
      question.element.classList.add('ahs-highlight');
      try { question.element.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch(e) {}
    }

    const { questionType, inputElements, options } = question;
    console.log(`[AutoSolver Fill] questionType="${questionType}", options=${options ? options.length : 0}, statements=${question.statements ? question.statements.length : 0}`);

    // ── CRITICAL: Detect True/False from BOTH question metadata AND answer content ──
    const isTFFromAnswer = detectTrueFalseAnswer(answerText);
    const isTFFromQuestion = questionType === 'true-false' || (question.statements && question.statements.length > 0);
    const isTFFromQuestionText = typeof question.questionText === 'string' &&
      /đúng[\s\/\-]*sai|cho\s+từng\s+mệnh\s+đề|các\s+phát\s+biểu|mỗi\s+nhận\s+định|xem\s+xét\s+các|true[\s\/\-]*false/i.test(question.questionText);
    const isTFQuestion = isTFFromQuestion || isTFFromAnswer || isTFFromQuestionText;

    console.log(`[AutoSolver Fill] TF detection: fromQuestion=${isTFFromQuestion}, fromAnswer=${isTFFromAnswer}, fromQuestionText=${isTFFromQuestionText}, final=${isTFQuestion}`);

    // ── True/False filling path (HIGHEST PRIORITY when detected) ──
    if (isTFQuestion) {
      // First try TF fill with live DOM scanning
      const tfResult = await tryFillTrueFalse(answerText, question.element);
      if (tfResult) {
        return tfResult;
      }

      // If TF fill failed but question has stored statements, try those
      if (question.statements && question.statements.length > 0) {
        console.log(`[AutoSolver TF] Trying stored statements (${question.statements.length})...`);
        const storedResult = await fillTrueFalseStatements(question.statements, answerText);
        if (storedResult && storedResult.success) {
          return storedResult;
        }
      }

      // Last resort: try multiple choice
      console.log('[AutoSolver TF] All TF strategies exhausted, falling back to multiple choice...');
      return fillMultipleChoice(inputElements, options, answerText, answerLetter);
    } else if (questionType === 'multiple-choice') {
      return fillMultipleChoice(inputElements, options, answerText, answerLetter);
    } else if (questionType === 'multiple-select') {
      return fillMultipleSelect(inputElements, options, answerText, answerLetter);
    } else if (questionType === 'dropdown') {
      return fillDropdown(inputElements[0], options, answerText, answerLetter);
    } else if (questionType === 'text' || questionType === 'short-answer' || questionType === 'fill-in-the-blank') {
      return fillTextInput(inputElements, answerText);
    }

    // ── SAFETY NET: Even for unknown question types, check if answer looks like TF ──
    if (isTFFromAnswer) {
      console.log('[AutoSolver Fill] Unknown questionType but answer looks TF, trying TF fill...');
      const tfResult = await tryFillTrueFalse(answerText, question.element);
      if (tfResult) return tfResult;
    }

    return { error: 'Không hỗ trợ loại câu hỏi này.' };
  }

  // ── Fill with Stored Question Fallback ────────────────────────────
  async function fillWithStored(question, answerText, answerLetter) {
    if (!question) return { error: 'Không tìm thấy câu hỏi.' };
    const { questionType, inputElements, options } = question;

    const isTFFromAnswer = detectTrueFalseAnswer(answerText);
    const isTFFromQuestion = questionType === 'true-false' || (question.statements && question.statements.length > 0);
    const isTFFromQuestionText = typeof question.questionText === 'string' &&
      /đúng[\s\/\-]*sai|cho\s+từng\s+mệnh\s+đề|các\s+phát\s+biểu|mỗi\s+nhận\s+định|xem\s+xét\s+các|true[\s\/\-]*false/i.test(question.questionText);
    const isTFQuestion = isTFFromQuestion || isTFFromAnswer || isTFFromQuestionText;

    if (isTFQuestion) {
      const tfResult = await tryFillTrueFalse(answerText, question.element);
      if (tfResult) return tfResult;

      if (question.statements && question.statements.length > 0) {
        const storedResult = await fillTrueFalseStatements(question.statements, answerText);
        if (storedResult && storedResult.success) return storedResult;
      }

      return fillMultipleChoice(inputElements, options, answerText, answerLetter);
    } else if (questionType === 'multiple-choice') {
      return fillMultipleChoice(inputElements, options, answerText, answerLetter);
    } else if (questionType === 'text' || questionType === 'short-answer' || questionType === 'fill-in-the-blank') {
      return fillTextInput(inputElements, answerText);
    }

    // Safety net
    if (isTFFromAnswer) {
      const tfResult = await tryFillTrueFalse(answerText, question.element);
      if (tfResult) return tfResult;
    }

    return { error: 'Không hỗ trợ.' };
  }

  // Export functions to global scope
  const globalScope = typeof window !== 'undefined' ? window : global;
  globalScope.fillAnswer = fillAnswer;
  globalScope.fillWithStored = fillWithStored;
  globalScope.fillMultipleChoice = fillMultipleChoice;
  globalScope.fillMultipleSelect = fillMultipleSelect;
  globalScope.fillDropdown = fillDropdown;
  globalScope.cleanFillInTheBlankAnswer = cleanFillInTheBlankAnswer;
  globalScope.fillTextInput = fillTextInput;
  globalScope.parseTrueFalseStatementsAnswer = parseTrueFalseStatementsAnswer;
  globalScope.fillTrueFalseStatements = fillTrueFalseStatements;
  globalScope.scanLiveTrueFalseRows = scanLiveTrueFalseRows;
  globalScope.executeBulletproofClick = executeBulletproofClick;
  globalScope.detectTrueFalseAnswer = detectTrueFalseAnswer;
  globalScope.tryFillTrueFalse = tryFillTrueFalse;


  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      fillAnswer,
      fillWithStored,
      fillMultipleChoice,
      fillMultipleSelect,
      fillDropdown,
      cleanFillInTheBlankAnswer,
      fillTextInput,
      parseTrueFalseStatementsAnswer,
      fillTrueFalseStatements,
      scanLiveTrueFalseRows,
      executeBulletproofClick,
      detectTrueFalseAnswer,
      tryFillTrueFalse,
    };
  }
})();
