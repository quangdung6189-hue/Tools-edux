
var scannedQuestions = window.__ahs_scannedQuestions = window.__ahs_scannedQuestions || [];
var autoSlideInterval = window.__ahs_autoSlideInterval || null;
var slideConfig = window.__ahs_slideConfig || { slideDelayMs: 2000, maxRetries: 3 };
var currentSlideRetry = window.__ahs_currentSlideRetry || 0;
var isWaitingForQuiz = window.__ahs_isWaitingForQuiz || false;
var slideStatus = window.__ahs_slideStatus || 'idle';

// ──  ────────────────────────────────────────
/* ============================================================
   Content Script — Auto Homework Solver
   Handles: scanning questions from the page, filling answers,
            navigating between questions
   ============================================================ */

  
// ── Clean Question Text Helper ───────────────────────────── ────────────────────────────────────────
// Clean Question Text Helper ──────────────────────────────
  function cleanQuestionText(rawText) {
    if (!rawText) return { number: '', text: '', rawBody: '', declaredType: null };
    let text = (rawText || '').normalize('NFC').trim();

    // Remove noise: timer, "0/40 câu", note text
    text = text.replace(/Thời gian còn lại[:\s]*[\d:]+/gi, '');
    text = text.replace(/\d+\/\d+\s*câu/gi, '');
    text = text.replace(/\*\s*Lưu ý[:\s]*[^]*$/gi, '');

    // Detect declared question type from tags like [Trắc nghiệm], [Điền chỗ trống], [Đúng/Sai]
    let declaredType = null;
    if (/(?:\[|\()?\s*(?:trắc\s*nghiệm|multiple-choice|chọn\s*một)\s*(?:\]|\))?/i.test(text)) declaredType = 'multiple-choice';
    else if (/(?:\[|\()?\s*(?:chọn\s*nhiều|multiple-select)\s*(?:\]|\))?/i.test(text)) declaredType = 'multiple-select';
    else if (/(?:\[|\()?\s*(?:đúng[\s\/\-]*sai|true[\s\/\-]*false)\s*(?:\]|\))?/i.test(text)) declaredType = 'true-false';
    else if (/(?:\[|\()?\s*(?:điền\s*(?:chỗ\s*)?trống|điền\s*khuyết|điền\s*từ|fill[-_\s]*in)\s*(?:\]|\))?/i.test(text)) declaredType = 'fill-in-the-blank';
    else if (/(?:\[|\()?\s*(?:tự\s*luận|essay)\s*(?:\]|\))?/i.test(text)) declaredType = 'text';

    // Match pattern: "Câu 1 [Trắc nghiệm] : [Question text]" or "Câu 33 [Điền chỗ trống] : [Question text]"
    const fullMatch = text.match(/(?:câu|question)\s*(\d+)\s*(?:[\[\(]?\s*(?:trắc\s*nghiệm|tự\s*luận|đúng[\s\/\-]*sai|chọn\s*nhiều|chọn\s*một|điền\s*(?:chỗ\s*)?trống|điền\s*khuyết|điền\s*từ|fill[-_\s]*in|short-answer|multiple-choice)\s*[\]\)]?)?\s*[:：\.\-]?\s*([^]+)/i);
    if (fullMatch && fullMatch[2] && fullMatch[2].trim().length > 3) {
      const qNum = fullMatch[1];
      const qBody = fullMatch[2].trim();
      return { number: qNum, text: `Câu ${qNum}: ${qBody}`, rawBody: qBody, declaredType };
    }

    // Match "Câu N"
    const numMatch = text.match(/(?:câu|question)\s*(\d+)/i);
    const qNum = numMatch ? numMatch[1] : '';

    // Strip prefixes
    let body = text
      .replace(/^(?:câu|question)\s*\d+[\s\:\.\-]*/i, '')
      .replace(/^\[?\s*(?:trắc\s*nghiệm|tự\s*luận|đúng[\s\/\-]*sai|chọn\s*nhiều|chọn\s*một|điền\s*(?:chỗ\s*)?trống|điền\s*khuyết|điền\s*từ|fill[-_\s]*in|short-answer|multiple-choice)\s*\]?[\s\:\.\-]*/i, '')
      .replace(/^[:：\.\-]+\s*/, '')
      .replace(/^(?:câu|question)\s*\d+[\s\:\.\-]*/i, '')
      .replace(/^[:：\.\-]+\s*/, '')
      .trim();

    if (body.length > 3) {
      return {
        number: qNum,
        text: qNum ? `Câu ${qNum}: ${body}` : body,
        rawBody: body,
        declaredType
      };
    }

    return { number: qNum, text: text, rawBody: text, declaredType };
  }

  
// ── Get Text Before Element (TreeWalker) ──────────────────── ────────────────────────────────────────
// Get Text Before Element (TreeWalker) ─────────────────────
  function getTextBeforeElement(container, stopElement) {
    if (!container || !stopElement) return '';

    let text = '';
    const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, null);

    while (walker.nextNode()) {
      const node = walker.currentNode;
      if (stopElement.contains(node)) break;
      const pos = stopElement.compareDocumentPosition(node);
      if ((pos & Node.DOCUMENT_POSITION_FOLLOWING) !== 0) break;

      const parent = node.parentElement;
      if (parent) {
        if (window.getComputedStyle(parent).display === 'none') continue;
        if (['SCRIPT', 'STYLE', 'NOSCRIPT'].includes(parent.tagName)) continue;
      }

      const t = node.textContent.trim();
      if (t) text += t + ' ';
    }

    return text.trim();
  }

  
// ── Hunt Options On Page Fallback ───────────────────────────────────────────────────────────
  function huntOptionsOnPage(headerEl) {
    const letterRegex = /^\s*\(?([A-F])\)?(?:\.|\:|\)|\s*[-–—])\s*(.+)$/;
    const allEls = Array.from(document.querySelectorAll('label, [role="radio"], div[class*="rounded"], div[class*="border"], div[class*="cursor"], p, span, li'));
    let startIdx = 0;
    if (headerEl) {
      const idx = allEls.indexOf(headerEl);
      if (idx >= 0) startIdx = idx;
    }

    const letterMap = new Map();
    for (let i = startIdx; i < allEls.length; i++) {
      const el = allEls[i];
      if (el.closest('[class*="dropdown"], [class*="popover"], [class*="popup"], [class*="tooltip"]')) continue;
      if (el.offsetParent === null && window.getComputedStyle(el).display === 'none') continue;
      if (el.children.length > 8) continue;

      const text = el.textContent.trim();
      const match = text.match(letterRegex);
      if (match) {
        const letter = match[1];
        const lettersInText = getOptionLettersInText(text);
        if (lettersInText.size > 1) continue;

        if (!letterMap.has(letter)) {
          const card = el.closest('label, [role="radio"], [class*="option"], [class*="choice"], [class*="radio"], [class*="item"], [class*="answer"]') || el;
          const input = (card && card.querySelector('input[type="radio"], input[type="checkbox"]')) || el.querySelector('input');
          letterMap.set(letter, {
            letter,
            cleanText: `${letter}. ${match[2].trim()}`,
            element: input || card,
            cardElement: card,
            inputElement: input,
            domNode: el,
          });
        }
      }
    }

    if (letterMap.has('A') && letterMap.has('B')) {
      const sortedLetters = Array.from(letterMap.keys()).sort();
      const options = [];
      const inputElements = [];
      let firstOptionElement = null;

      for (const l of sortedLetters) {
        const item = letterMap.get(l);
        options.push(item.cleanText);
        inputElements.push(item);
        if (!firstOptionElement) firstOptionElement = item.domNode;
      }

      return {
        options,
        inputElements,
        firstOptionElement,
        questionType: 'multiple-choice',
      };
    }

    return null;
  }

// ── Extract paginated question given header ──────────────────────────────────────────────────
  function extractPaginatedQuestion(headerEl) {
    let container = headerEl;
    let optionData = null;

    const headerBlock = headerEl.closest('.flex.items-start, div[class*="items-start"], div[class*="header"], div[class*="question"]') || headerEl.parentElement || headerEl;
    const nextSib = headerBlock ? headerBlock.nextElementSibling : null;
    const headerFullText = (headerEl ? headerEl.textContent : '') + ' ' +
      (headerBlock ? headerBlock.textContent : '') + ' ' +
      (headerBlock.parentElement ? headerBlock.parentElement.textContent.substring(0, 300) : '') + ' ' +
      (nextSib ? nextSib.textContent.substring(0, 300) : '');
    const isDeclaredTF = /(?:đúng[\s\/\-]*sai|true[\s\/\-]*false|chọn\s+đúng\s+hoặc\s+sai|từng\s+mệnh\s+đề)/i.test(headerFullText.normalize('NFC'));

    // If declared True/False, try scanning statements first
    if (isDeclaredTF) {
      const tfTargets = [
        headerBlock,
        headerBlock.parentElement,
        headerBlock.nextElementSibling,
        headerBlock.parentElement ? headerBlock.parentElement.nextElementSibling : null,
        headerBlock.closest('form, [class*="quiz"], [class*="question"], [class*="modal"], [role="dialog"], div.space-y-3, div.space-y-4, div[class*="border"], div.p-4, div.p-6'),
        document.body
      ];

      for (const target of tfTargets) {
        if (!target) continue;
        const tfStatements = scanTrueFalseStatements(target);
        if (tfStatements && tfStatements.length > 0) {
          optionData = {
            options: tfStatements.map(s => s.text),
            inputElements: tfStatements.flatMap(s => [s.trueElement, s.falseElement]),
            firstOptionElement: tfStatements[0].cardElement || tfStatements[0].trueElement,
            questionType: 'true-false',
            isMultiStatement: tfStatements.length > 1 || tfStatements.some(s => /^\d+[\.\)]/.test(s.text)),
            statements: tfStatements
          };
          break;
        }
      }
    }

    // Walk up to find a container with options
    if (!optionData || optionData.options.length < 2) {
      for (let level = 0; level < 10; level++) {
        if (!container || container === document.body) break;
        optionData = extractOptionsFromContainer(container);
        if (optionData && optionData.options.length >= 2) {
          break;
        }
        container = container.parentElement;
      }
    }

    // Sibling fallback
    if (!optionData || optionData.options.length < 2) {
      let sibling = headerEl.parentElement ? headerEl.parentElement.nextElementSibling : null;
      while (sibling) {
        optionData = extractOptionsFromContainer(sibling);
        if (optionData && optionData.options.length >= 2) {
          container = sibling.parentElement;
          break;
        }
        sibling = sibling.nextElementSibling;
      }
    }

    // Check for True/False statement question (multi-statement or single True/False with buttons)
    if (!optionData || optionData.options.length < 2) {
      const candidatesToSearch = [
        headerBlock,
        headerBlock.parentElement,
        headerBlock.nextElementSibling,
        headerBlock.parentElement ? headerBlock.parentElement.nextElementSibling : null,
        headerBlock.closest('form, [class*="quiz"], [class*="question"], [class*="modal"], [role="dialog"], div.space-y-3, div.space-y-4, div[class*="border"], div.p-4, div.p-6'),
        container && container !== document.body ? container : null,
        document.body
      ];

      for (const target of candidatesToSearch) {
        if (!target) continue;
        const tfStatements = scanTrueFalseStatements(target);
        if (tfStatements && tfStatements.length > 0) {
          optionData = {
            options: tfStatements.map(s => s.text),
            inputElements: tfStatements.flatMap(s => [s.trueElement, s.falseElement]),
            firstOptionElement: tfStatements[0].cardElement || tfStatements[0].trueElement,
            questionType: 'true-false',
            isMultiStatement: tfStatements.length > 1 || tfStatements.some(s => /^\d+[\.\)]/.test(s.text)),
            statements: tfStatements
          };
          break;
        }
      }
    }

    // Never classify a text editor as multiple-choice using unrelated page buttons.
    const hasNearbyEditor = [headerBlock?.parentElement, headerEl?.parentElement?.parentElement]
      .some(scope => scope && scope !== document.body && scope.querySelector('textarea, input[type="text"], input:not([type])'));
    // Global fallback for options
    if ((!optionData || optionData.options.length < 2) && !hasNearbyEditor) {
      optionData = extractOptionsFromContainer(document.body);
    }

    // Active hunt fallback if still < 2 options
    if ((!optionData || optionData.options.length < 2) && !hasNearbyEditor) {
      optionData = huntOptionsOnPage(headerEl);
    }


    let options = optionData ? optionData.options : [];
    let inputElements = optionData ? optionData.inputElements : [];
    let questionType = optionData ? optionData.questionType : 'text';
    let isMultiStatement = optionData ? !!optionData.isMultiStatement : false;
    let statements = optionData ? (optionData.statements || []) : [];

    // Extract Question Text
    let rawQuestionText = '';

    // Priority 1: Check headerBlock (Edux / modern LMS standard: flex items-start container)
    if (headerBlock) {
      const promptEl = headerBlock.querySelector('.flex-1, [class*="min-w-0"], p');
      if (promptEl && promptEl.textContent.trim().length > 5) {
        rawQuestionText = headerBlock.textContent.trim();
      }
    }

    if (!rawQuestionText && headerEl && headerEl.textContent.trim().length > 10) {
      rawQuestionText = headerEl.textContent.trim();
    }
    if (!rawQuestionText && optionData && optionData.firstOptionElement && container && container !== document.body) {
      rawQuestionText = getTextBeforeElement(container, optionData.firstOptionElement);
    }

    if (!rawQuestionText || rawQuestionText.length < 10) {
      rawQuestionText = (headerEl ? headerEl.textContent.trim() : '');
      if (headerEl && headerEl.parentElement && headerEl.parentElement !== document.body) {
        if (headerEl.parentElement.children.length <= 6) {
          const pText = headerEl.parentElement.textContent.trim();
          if (pText.length > rawQuestionText.length && pText.length < 500) {
            rawQuestionText = pText;
          }
        }
      }
      let sib = headerEl ? headerEl.nextElementSibling : null;
      while (sib && (!optionData || !optionData.firstOptionElement || !sib.contains(optionData.firstOptionElement))) {
        rawQuestionText += ' ' + sib.textContent.trim();
        sib = sib.nextElementSibling;
      }
    }

    const cleaned = cleanQuestionText(rawQuestionText);

    if (optionData && optionData.statements && optionData.statements.length > 0) {
      let finalBody = cleaned.text;
      finalBody = finalBody.replace(/chọn\s+đúng\s+hoặc\s+sai\s+cho\s+từng\s+mệnh\s+đề\s*[:\.]?/gi, '').trim();

      return {
        questionText: finalBody,
        questionNumber: cleaned.number ? parseInt(cleaned.number, 10) : null,
        questionType: 'true-false',
        isMultiStatement: optionData.isMultiStatement,
        options: optionData.options,
        statements: optionData.statements,
        element: container || headerEl,
        inputElements: optionData.inputElements,
      };
    }

    if (options.length >= 2) {
      if (options.length === 2 && isTrueFalse(options)) {
        questionType = 'true-false';
      } else {
        questionType = cleaned.declaredType || 'multiple-choice';
      }
    } else {
      // If declared as multiple-choice but DOM search found < 2 elements
      if (cleaned.declaredType === 'multiple-choice' || cleaned.declaredType === 'multiple-select' || /trắc\s*nghiệm/i.test(rawQuestionText)) {
        questionType = cleaned.declaredType || 'multiple-choice';
      } else {
         // Header-only containers are common on paginated LMS pages: editor lives
         // in the next sibling, not inside the question heading.
         const editorScope = [container, headerBlock?.parentElement, headerEl?.parentElement?.parentElement]
           .find(scope => scope && scope !== document.body && scope.querySelector('textarea, input[type="text"], input:not([type])'));
         const textarea = editorScope?.querySelector('textarea');
         const textInput = editorScope?.querySelector('input[type="text"], input:not([type])');
        if (textarea) {
          questionType = 'text';
          inputElements.push(textarea);
         } else if (textInput) {
          questionType = 'short-answer';
          inputElements.push(textInput);
        } else {
          questionType = cleaned.declaredType || 'text';
        }
      }
    }

    // Ultimate safety check for True/False question: if declared type is true-false but options are empty, scan document.body
    if ((questionType === 'true-false' || cleaned.declaredType === 'true-false' || isDeclaredTF) && (!options || options.length === 0)) {
      const globalTF = scanTrueFalseStatements(document.body);
      if (globalTF && globalTF.length > 0) {
        let finalBody = cleaned.text;
        finalBody = finalBody.replace(/chọn\s+đúng\s+hoặc\s+sai\s+cho\s+từng\s+mệnh\s+đề\s*[:\.]?/gi, '').trim();

        return {
          questionText: finalBody,
          questionNumber: cleaned.number ? parseInt(cleaned.number, 10) : null,
          questionType: 'true-false',
          isMultiStatement: globalTF.length > 1 || globalTF.some(s => /^\d+[\.\)]/.test(s.text)),
          options: globalTF.map(s => s.text),
          statements: globalTF,
          element: container || headerEl,
          inputElements: globalTF.flatMap(s => [s.trueElement, s.falseElement]),
        };
      }

      // Additional fallback: extract numbered statements from the question's parent container text
      const qBox = headerEl.closest('form, [class*="quiz"], [class*="question"], main, article, div.space-y-4, div.space-y-3') || (headerEl.parentElement ? headerEl.parentElement.parentElement : null) || headerEl.parentElement;
      if (qBox) {
        const text = qBox.innerText || qBox.textContent || '';
        const lines = text.split(/[\r\n]+/).map(l => l.trim()).filter(l => /^\d+[\.\)]\s*.{8,}/.test(l));
        if (lines.length >= 2) {
          options = lines;
          questionType = 'true-false';
          isMultiStatement = true;
          statements = lines.map((line, idx) => ({
            index: idx + 1,
            text: line
          }));

          return {
            questionText: cleaned.text.replace(/chọn\s+đúng\s+hoặc\s+sai\s+cho\s+từng\s+mệnh\s+đề\s*[:\.]?/gi, '').trim(),
            questionNumber: cleaned.number ? parseInt(cleaned.number, 10) : null,
            questionType: 'true-false',
            isMultiStatement: true,
            options,
            statements,
            element: container || headerEl,
            inputElements,
          };
        }
      }
    }

    return {
      questionText: cleaned.text,
      questionNumber: cleaned.number ? parseInt(cleaned.number, 10) : null,
      questionType,
      isMultiStatement,
      options,
      statements,
      element: container || headerEl,
      inputElements,
    };
  }

  
// ── Extract Options From Container ───────────────────────── ────────────────────────────────────────
// Extract Options From Container ──────────────────────────
  function extractOptionsFromContainer(container) {
    if (!container) return null;

    function isOverlay(el) {
      return !!el.closest('[class*="dropdown"], [class*="popover"], [class*="popup"], [class*="tooltip"]');
    }

    // Helper: count how many distinct option letters (A., B., C., etc.) appear in a string
    function getOptionLettersInText(str) {
      if (!str) return new Set();
      // Match genuine option prefix: uppercase A-F preceded by start or whitespace,
      // followed by punctuation (. : ) - – —) and whitespace. NEVER match inside words or code like (int id).
      const regex = /(?:^|[\r\n]+|^\s*|[\s\t]{2,}|\b)\(?([A-F])\)?(?:\.|\:|\)|\s*[-–—])(?:\s+|$)/g;
      const letters = new Set();
      let m;
      while ((m = regex.exec(str)) !== null) {
        letters.add(m[1]);
      }
      return letters;
    }

    // Method A: Look for option rows starting with A., B., C., D.
    const letterRegex = /^\s*\(?([A-F])\)?(?:\.|\:|\)|\s*[-–—])\s*(.*)$/;
    const allEls = Array.from(container.querySelectorAll('*'));
    const letterMap = new Map();

    for (const el of allEls) {
      if (isOverlay(el)) continue;
      if (el.offsetParent === null && window.getComputedStyle(el).display === 'none') continue;

      const fullText = el.textContent.trim();
      if (!fullText) continue;

      // Handle standalone letter badge (e.g. <span class="letter">A.</span>)
      const isSoloLetter = /^\s*\(?([A-F])\)?(?:\.|\:|\)|\s*[-–—])?\s*$/.test(fullText);
      if (isSoloLetter) {
        const letter = fullText.match(/([A-F])/)[1];
        if (!letterMap.has(letter)) {
          const parent = el.parentElement;
          const nextSib = el.nextElementSibling;
          let body = '';
          if (nextSib && nextSib.textContent.trim()) {
            body = nextSib.textContent.trim();
          } else if (parent && parent.textContent.trim().length > fullText.length) {
            body = parent.textContent.trim().replace(/^\s*\(?[A-F]\)?(?:\.|\:|\)|\s*[-–—])\s*/, '').trim();
          }
          if (body) {
            const card = el.closest('label, [role="radio"], [class*="option"], [class*="choice"], [class*="radio"], [class*="item"], [class*="answer"]') || parent || el;
            const input = (card && card.querySelector('input[type="radio"], input[type="checkbox"]')) || el.querySelector('input');
            letterMap.set(letter, {
              letter,
              cleanText: `${letter}. ${body}`,
              element: input || card,
              cardElement: card,
              inputElement: input,
              domNode: card,
            });
          }
        }
        continue;
      }

      const match = fullText.match(letterRegex);
      if (match) {
        const letter = match[1];

        // If this element contains 2 or more distinct option letters, it is a parent container holding multiple options
        const lettersInText = getOptionLettersInText(fullText);
        if (lettersInText.size > 1) continue;

        // Also check if any child element starts with another letter
        const hasOtherLetterChildren = Array.from(el.querySelectorAll('*')).some(child => {
          const cText = child.textContent.trim();
          const cMatch = cText.match(/^\s*\(?([A-F])\)?(?:\.|\:|\)|\s*[-–—])(?:\s+|$)/);
          return cMatch && cMatch[1] !== letter;
        });
        if (hasOtherLetterChildren) continue;

        let optionBody = match[2].trim();
        // Truncate if another letter pattern appears in text
        const cutIdx = optionBody.search(/(?:[\r\n]+|[\s\t]{2,}|\b)[B-F](?:\.|\:|\)|\s*[-–—])\s+/);
        if (cutIdx > 0) {
          optionBody = optionBody.substring(0, cutIdx + 1).trim();
        }

        if (!letterMap.has(letter)) {
          const card = el.closest('label, [role="radio"], [class*="option"], [class*="choice"], [class*="radio"], [class*="item"], [class*="answer"]') || el;
          const input = (card && card.querySelector('input[type="radio"], input[type="checkbox"]')) || el.querySelector('input');

          letterMap.set(letter, {
            letter,
            cleanText: `${letter}. ${optionBody}`,
            element: input || card,
            cardElement: card,
            inputElement: input,
            domNode: el,
          });
        }
      }
    }

    if (letterMap.has('A') && letterMap.has('B')) {
      const sortedLetters = Array.from(letterMap.keys()).sort();
      const options = [];
      const inputElements = [];
      let firstOptionElement = null;

      for (const l of sortedLetters) {
        const item = letterMap.get(l);
        options.push(item.cleanText);
        inputElements.push(item);
        if (!firstOptionElement) firstOptionElement = item.domNode;
      }

      return {
        options,
        inputElements,
        firstOptionElement,
        questionType: 'multiple-choice',
      };
    }

    // Method B: Native input[type="radio"] or input[type="checkbox"]
    const radios = Array.from(container.querySelectorAll('input[type="radio"]')).filter(r => !isOverlay(r));
    const checkboxes = Array.from(container.querySelectorAll('input[type="checkbox"]')).filter(c => !isOverlay(c));
    const inputs = radios.length >= 2 ? radios : (checkboxes.length >= 2 ? checkboxes : []);

    if (inputs.length >= 2) {
      const options = extractOptions(inputs, container);
      if (options.length >= 2) {
        return {
          options,
          inputElements: inputs,
          firstOptionElement: inputs[0].closest('label, div, li') || inputs[0],
          questionType: radios.length >= 2 ? 'multiple-choice' : 'multiple-select',
        };
      }
    }

    // Method C: Custom role="radio"
    const roleRadios = Array.from(container.querySelectorAll('[role="radio"]')).filter(r => !isOverlay(r));
    if (roleRadios.length >= 2) {
      const options = [];
      for (let i = 0; i < roleRadios.length; i++) {
        const r = roleRadios[i];
        let t = r.textContent.trim().replace(/^[A-F][\.\:\)\-–—]\s*/i, '');
        const letter = String.fromCharCode(65 + i);
        options.push(`${letter}. ${t}`);
      }
      return {
        options,
        inputElements: roleRadios,
        firstOptionElement: roleRadios[0],
        questionType: 'multiple-choice',
      };
    }

    // Method D: Custom radio elements (e.g. Ant Design, Bootstrap, custom div choices)
    const customChoices = Array.from(container.querySelectorAll(
      '[class*="ant-radio-wrapper"], [class*="radio-item"], [class*="radio_item"], [class*="choice-item"], [class*="answer-item"], [class*="option-item"], [class*="answer_item"]'
    )).filter(c => !isOverlay(c));

    if (customChoices.length >= 2 && customChoices.length <= 8) {
      const options = [];
      const inputElements = [];
      for (let i = 0; i < customChoices.length; i++) {
        const c = customChoices[i];
        let t = c.textContent.trim();
        const letter = String.fromCharCode(65 + i);
        t = t.replace(/^[A-F][\.\:\)\-–—]\s*/i, '').trim();
        if (t) {
          options.push(`${letter}. ${t}`);
          const input = c.querySelector('input') || c;
          inputElements.push({
            letter,
            cleanText: `${letter}. ${t}`,
            element: input,
            cardElement: c,
            inputElement: c.querySelector('input'),
            domNode: c
          });
        }
      }
      if (options.length >= 2) {
        return {
          options,
          inputElements,
          firstOptionElement: customChoices[0],
          questionType: 'multiple-choice'
        };
      }
    }

    return null;
  }

  
// ── Extract Question By Options Pattern (Fallback) ───────── ────────────────────────────────────────
// Extract Question By Options Pattern (Fallback) ──────────
  function extractByOptionsPattern() {
    const optData = extractOptionsFromContainer(document.body);
    if (!optData || optData.options.length < 2) return null;

    const firstEl = optData.firstOptionElement;
    let parent = firstEl.parentElement;
    let rawQuestion = '';

    for (let i = 0; i < 6 && parent && parent !== document.body; i++) {
      rawQuestion = getTextBeforeElement(parent, firstEl);
      if (rawQuestion && rawQuestion.length > 10) break;
      parent = parent.parentElement;
    }

    if (!rawQuestion || rawQuestion.length < 5) return null;

    const cleaned = cleanQuestionText(rawQuestion);
    return {
      questionText: cleaned.text,
      questionType: optData.questionType,
      options: optData.options,
      element: parent || firstEl,
      inputElements: optData.inputElements,
    };
  }

  
// ── True/False Checker Helper ───────────────────────────────
  function isTrueFalse(options) {
    if (options.length !== 2) return false;
    const joined = options.join(' ').toLowerCase();
    return (
      (joined.includes('đúng') && joined.includes('sai')) ||
      (joined.includes('true') && joined.includes('false')) ||
      (joined.includes('yes') && joined.includes('no')) ||
      (joined.includes('có') && joined.includes('không'))
    );
  }

  // ── Scan True/False Statement Rows Helper ────────────────────────
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

    function hasBothTFButtons(el) {
      if (!el || ['BUTTON', 'INPUT', 'LABEL'].includes(el.tagName)) return false;
      const clickables = Array.from(el.querySelectorAll('button, [role="button"], input[type="button"], label'));
      const hasT = clickables.some(b => isTrueText(b.textContent));
      const hasF = clickables.some(b => isFalseText(b.textContent));
      return hasT && hasF;
    }

    const trueFalsePairs = [];

    // ── STRATEGY 1: Dedicated Statement Card / Row Detection ─────────
    // Directly identifies each statement card containing 1 Đúng and 1 Sai button and statement text
    function analyzeCard(el) {
      if (!el || ['BUTTON', 'INPUT', 'LABEL', 'A'].includes(el.tagName)) return null;
      if (el.closest && el.closest('[class*="ahs-"], [id*="ahs-"]')) return null;
      if (el.offsetParent === null && window.getComputedStyle(el).display === 'none') return null;

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

    const allRowCandidates = Array.from(container.querySelectorAll(
      'div[class*="border"], div[class*="rounded"], div[class*="bg-gray"], tr, li, div[class*="item"], div[class*="statement"], div[class*="question"], div[class*="card"], div[class*="flex"]'
    ));

    const validCards = [];
    for (const el of allRowCandidates) {
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

    // Deduplicate cards in case multiple selectors matched
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
        return (pos & Node.DOCUMENT_POSITION_FOLLOWING) ? -1 : 1;
      }
      return 0;
    });

    uniqueCards.forEach((item, idx) => {
      const pairIndex = idx + 1;
      let stmtText = '';

      // Look for clean text element inside card that does not contain buttons
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

    // ── STRATEGY 2: Proximity Button Pairing (Fallback) ───────────────
    if (trueFalsePairs.length === 0) {
      const allEls = Array.from(container.querySelectorAll(
        'button, [role="button"], input[type="button"], label, a, div, span, p'
      ));

      const trueCandidates = [];
      const falseCandidates = [];
      const visitedElements = new Set();

      for (const el of allEls) {
        if (el.closest('[class*="ahs-"], [id*="ahs-"]')) continue;
        if (el.offsetParent === null && window.getComputedStyle(el).display === 'none') continue;
        if (el.children.length > 4) continue;

        const text = (el.textContent || '').trim();
        if (!text) continue;

        if (isTrueText(text)) {
          const btn = el.closest('button, [role="button"], input[type="button"], label') || el;
          if (!visitedElements.has(btn)) {
            visitedElements.add(btn);
            trueCandidates.push(btn);
          }
        } else if (isFalseText(text)) {
          const btn = el.closest('button, [role="button"], input[type="button"], label') || el;
          if (!visitedElements.has(btn)) {
            visitedElements.add(btn);
            falseCandidates.push(btn);
          }
        }
      }

      const usedFalse = new Set();
      const paired = [];

      for (const tBtn of trueCandidates) {
        let bestFalse = null;
        let minDistance = Infinity;

        for (const fBtn of falseCandidates) {
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
          paired.push({ trueBtn: tBtn, falseBtn: bestFalse });
        }
      }

      paired.sort((a, b) => {
        try {
          const aRect = a.trueBtn.getBoundingClientRect();
          const bRect = b.trueBtn.getBoundingClientRect();
          if (Math.abs(aRect.top - bRect.top) > 5) return aRect.top - bRect.top;
        } catch (e) {}
        const pos = a.trueBtn.compareDocumentPosition(b.trueBtn);
        return (pos & Node.DOCUMENT_POSITION_FOLLOWING) ? -1 : 1;
      });

      paired.forEach((pair, idx) => {
        let lca = pair.trueBtn.parentElement;
        if (pair.falseBtn.parentElement !== lca) {
          let p = pair.trueBtn.parentElement;
          while (p && !p.contains(pair.falseBtn)) p = p.parentElement;
          lca = p || pair.trueBtn.parentElement;
        }

        let stmtText = '';
        if (lca && lca.previousElementSibling) {
          let prev = lca.previousElementSibling;
          while (prev) {
            const pt = (prev.textContent || '').normalize('NFC').replace(/\s+/g, ' ').trim();
            if (pt.length >= 5 && !isTrueText(pt) && !isFalseText(pt)) {
              stmtText = pt;
              break;
            }
            prev = prev.previousElementSibling;
          }
        }

        let row = lca ? lca.closest('tr, li, div[class*="border"], div[class*="rounded"], div[class*="item"], div[class*="statement"], div[class*="card"]') : null;

        const pairIndex = idx + 1;
        stmtText = (stmtText || '')
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
          trueElement: pair.trueBtn,
          falseElement: pair.falseBtn,
          cardElement: row || lca
        });
      });
    }

    // ── STRATEGY 3: Radio groups fallback ─────────────────────────────
    if (trueFalsePairs.length === 0) {
      const radioGroups = new Map();
      const radios = Array.from(container.querySelectorAll('input[type="radio"]'));
      for (const r of radios) {
        const name = r.name || r.getAttribute('data-name') || 'unnamed';
        if (!radioGroups.has(name)) radioGroups.set(name, []);
        radioGroups.get(name).push(r);
      }

      for (const [name, rList] of radioGroups) {
        if (rList.length === 2) {
          let trueR = null, falseR = null;
          for (const r of rList) {
            const label = r.closest('label') || (r.id ? container.querySelector(`label[for="${CSS.escape(r.id)}"]`) : null) || r.parentElement;
            const lt = (label ? label.textContent : r.value).trim().toLowerCase();
            if (isTrueText(lt) || r.value === '1' || r.value === 'true') {
              trueR = r;
            } else if (isFalseText(lt) || r.value === '0' || r.value === 'false') {
              falseR = r;
            }
          }
          if (trueR && falseR) {
            const row = trueR.closest('tr, li, div') || container;
            let stmtText = row ? row.textContent.replace(/(?:^|\s+)(?:đúng|sai|true|false)(?:\s+|$)/gi, ' ').replace(/\s+/g, ' ').trim() : '';
            const pairIndex = trueFalsePairs.length + 1;
            if (!/^\d+[\.\:\)]/.test(stmtText)) {
              stmtText = `${pairIndex}. ${stmtText}`;
            }
            trueFalsePairs.push({
              index: pairIndex,
              text: stmtText,
              trueElement: trueR,
              falseElement: falseR,
              cardElement: row
            });
          }
        }
      }
    }

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

    console.log(`[AutoSolver TF Scan] Total ${trueFalsePairs.length} True/False pairs detected`);
    if (trueFalsePairs.length > 0) {
      trueFalsePairs.forEach((p, i) => console.log(`[AutoSolver TF Scan] Pair ${i + 1}: "${p.text.substring(0, 70)}..."`));
    }
    return trueFalsePairs;
  }

// ── Extract question from container element ────────────────
  function extractQuestionFromContainer(container) {
    let questionText = '';

    const textSelectors = [
      '.qtext', '.question-text', '.question-title', '.question-body',
      '.formulation', '.prompt', 'legend', 'label[class*="question"]',
      '.stem', '.question_text', 'h3', 'h4', 'p:first-of-type',
    ];

    for (const selector of textSelectors) {
      const el = container.querySelector(selector);
      if (el) {
        questionText = el.textContent.trim();
        break;
      }
    }

    if (!questionText) {
      questionText = getQuestionTextFromContainer(container);
    }

    if (!questionText || questionText.length < 5) return null;

    const radios = container.querySelectorAll('input[type="radio"]');
    const checkboxes = container.querySelectorAll('input[type="checkbox"]');
    const textareas = container.querySelectorAll('textarea');
    const textInputs = container.querySelectorAll('input[type="text"], input:not([type])');
    const selects = container.querySelectorAll('select');

    let questionType = 'text';
    let options = [];
    let inputElements = [];

    if (radios.length >= 2) {
      questionType = 'multiple-choice';
      options = extractOptions(radios, container);
      inputElements = Array.from(radios);
    } else if (checkboxes.length >= 2) {
      questionType = 'multiple-select';
      options = extractOptions(checkboxes, container);
      inputElements = Array.from(checkboxes);
    } else if (selects.length > 0) {
      questionType = 'dropdown';
      const select = selects[0];
      options = Array.from(select.options)
        .filter(o => o.value)
        .map(o => o.textContent.trim());
      inputElements = [select];
    } else if (textareas.length > 0) {
      questionType = 'text';
      inputElements = Array.from(textareas);
    } else if (textInputs.length > 0) {
      questionType = 'short-answer';
      inputElements = Array.from(textInputs);
    }

    if (questionType === 'multiple-choice' && options.length === 2) {
      const normalized = options.map(o => o.toLowerCase().trim());
      if (
        (normalized.includes('true') && normalized.includes('false')) ||
        (normalized.includes('đúng') && normalized.includes('sai'))
      ) {
        questionType = 'true-false';
      }
    }

    // Check for multi-statement True/False if no options found or was treated as plain text or true-false
    if (options.length === 0 || questionType === 'true-false' || questionType === 'text' || questionType === 'short-answer') {
      const tfStatements = scanTrueFalseStatements(container);
      if (tfStatements && tfStatements.length > 0) {
        questionType = 'true-false';
        options = tfStatements.map(s => s.text);
        inputElements = tfStatements.flatMap(s => [s.trueElement, s.falseElement]);
        return {
          questionText: questionText.substring(0, 2000),
          questionType,
          isMultiStatement: tfStatements.length > 1 || tfStatements.some(s => /^\d+[\.\)]/.test(s.text)),
          options,
          statements: tfStatements,
          element: container,
          inputElements,
        };
      }
    }

    return {
      questionText: questionText.substring(0, 2000),
      questionType,
      options,
      element: container,
      inputElements,
    };
  }

  
// ── Extract question from a single element ──────────────── ────────────────────────────────────────
// Extract question from a single element ─────────────────
  function extractQuestionFromElement(el) {
    const questionText = el.textContent.trim();
    const parent = el.parentElement;
    const scope = parent || document.body;

    const radios = scope.querySelectorAll('input[type="radio"]');
    const textareas = scope.querySelectorAll('textarea');
    const textInputs = scope.querySelectorAll('input[type="text"]');

    let questionType = 'text';
    let options = [];
    let inputElements = [];

    if (radios.length >= 2) {
      questionType = 'multiple-choice';
      options = extractOptions(radios, scope);
      inputElements = Array.from(radios);
    } else if (textareas.length > 0) {
      questionType = 'text';
      inputElements = Array.from(textareas);
    } else if (textInputs.length > 0) {
      questionType = 'short-answer';
      inputElements = Array.from(textInputs);
    }

    if (options.length === 0) {
      const tfStatements = scanTrueFalseStatements(scope);
      if (tfStatements && tfStatements.length > 0) {
        questionType = 'true-false';
        options = tfStatements.map(s => s.text);
        inputElements = tfStatements.flatMap(s => [s.trueElement, s.falseElement]);
        return {
          questionText: questionText.substring(0, 2000),
          questionType,
          isMultiStatement: tfStatements.length > 1 || tfStatements.some(s => /^\d+[\.\)]/.test(s.text)),
          options,
          statements: tfStatements,
          element: el,
          inputElements,
        };
      }
    }

    return {
      questionText: questionText.substring(0, 2000),
      questionType,
      options,
      element: el,
      inputElements,
    };
  }

  
// ── Extract option texts from radio/checkbox inputs ─────── ────────────────────────────────────────
  // Extract option texts from radio/checkbox inputs ────────
  function extractOptions(inputs, container) {
    const options = [];

    for (let idx = 0; idx < inputs.length; idx++) {
      const input = inputs[idx];
      let optionText = '';

      // 1. Try: associated label by for="id"
      if (input.id) {
        const label = (container || document).querySelector(`label[for="${CSS.escape(input.id)}"]`);
        if (label) optionText = label.textContent.trim();
      }

      // 2. Try: parent label
      if (!optionText) {
        const parentLabel = input.closest('label');
        if (parentLabel) {
          optionText = parentLabel.textContent.trim();
        }
      }

      // 3. Try: outer option wrapper (Ant Design, Bootstrap, custom divs)
      if (!optionText) {
        const row = input.closest('[class*="radio-wrapper"], [class*="radio-item"], [class*="radio_item"], [class*="option"], [class*="choice"], [class*="item"], [class*="answer"], li, tr');
        if (row) {
          const clone = row.cloneNode(true);
          const inputClone = clone.querySelector('input');
          if (inputClone) inputClone.remove();
          optionText = clone.textContent.trim();
        }
      }

      // 4. Try: parent element's next sibling (Ant Design: <span class="ant-radio"><input></span><span>Label</span>)
      if (!optionText && input.parentElement) {
        let sib = input.parentElement.nextElementSibling;
        while (sib) {
          const t = sib.textContent.trim();
          if (t) {
            optionText += (optionText ? ' ' : '') + t;
          }
          sib = sib.nextElementSibling;
        }
      }

      // 5. Try: direct next sibling
      if (!optionText) {
        let next = input.nextSibling;
        while (next) {
          const t = next.textContent ? next.textContent.trim() : '';
          if (t) optionText += (optionText ? ' ' : '') + t;
          next = next.nextSibling;
        }
      }

      // 6. Try: parent element text excluding input
      if (!optionText && input.parentElement) {
        const clone = input.parentElement.cloneNode(true);
        const inputClone = clone.querySelector('input');
        if (inputClone) inputClone.remove();
        optionText = clone.textContent.trim();
      }

      // 7. Try: closest li, div, td option container
      if (!optionText) {
        const optContainer = input.closest('li, div, td');
        if (optContainer) {
          const clone = optContainer.cloneNode(true);
          const inputClone = clone.querySelector('input');
          if (inputClone) inputClone.remove();
          optionText = clone.textContent.trim();
        }
      }

      // Ensure proper letter prefix A., B., C., D.
      const expectedLetter = String.fromCharCode(65 + idx);
      optionText = optionText.replace(/^[A-F][\.\:\)\-–—]\s*/i, '').trim();

      if (optionText) {
        options.push(`${expectedLetter}. ${optionText}`);
      }
    }

    return options;
  }

  
// ── Get direct text content of element (not children) ───── ────────────────────────────────────────
// Get direct text content of element (not children) ──────
  function getDirectTextContent(el) {
    let text = '';
    for (const node of el.childNodes) {
      if (node.nodeType === Node.TEXT_NODE) {
        text += node.textContent;
      }
    }
    return text.trim();
  }

  
// ── Get question text from container ────────────────────── ────────────────────────────────────────
// Get question text from container ───────────────────────
  function getQuestionTextFromContainer(container) {
    const inputs = container.querySelectorAll('input, textarea, select');
    if (inputs.length === 0) {
      return container.textContent.trim().substring(0, 500);
    }

    const firstInput = inputs[0];
    const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, null);
    let text = '';

    while (walker.nextNode()) {
      const node = walker.currentNode;
      if (firstInput.contains(node) || isAfterElement(container, node, firstInput)) {
        break;
      }
      const t = node.textContent.trim();
      if (t) text += t + ' ';
    }

    return text.trim();
  }

  
// ── Check if node comes after element in DOM order ──────── ────────────────────────────────────────
// Check if node comes after element in DOM order ─────────
  function isAfterElement(root, node, element) {
    const position = element.compareDocumentPosition(node);
    return (position & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;
  }

  
// ── Find common ancestor of elements ────────────────────── ────────────────────────────────────────
// Find common ancestor of elements ───────────────────────
  function findCommonAncestor(elements) {
    if (elements.length === 0) return null;
    let ancestor = elements[0].parentElement;
    while (ancestor && ancestor !== document.body) {
      if (Array.from(elements).every(el => ancestor.contains(el))) {
        return ancestor;
      }
      ancestor = ancestor.parentElement;
    }
    return ancestor;
  }

  
// ── Click Option Helper (Framework-aware) ────────────────── ────────────────────────────────────────
// Click Option Helper (Framework-aware) ───────────────────
  function clickOptionElement(target) {
    if (!target) return false;

    // Resolve target elements
    let mainEl = target.element || target.domNode || target;
    let cardEl = target.cardElement || 
                 (mainEl && mainEl.closest ? mainEl.closest('label, [role="radio"], [class*="option"], [class*="choice"], [class*="item"], [class*="answer"], div[class*="rounded-xl"][class*="border"], div[class*="border-2"]') : null) || 
                 mainEl;

    let input = target.inputElement || 
                (cardEl && cardEl.querySelector ? cardEl.querySelector('input[type="radio"], input[type="checkbox"]') : null) ||
                (mainEl && mainEl.tagName === 'INPUT' ? mainEl : null);

    if (!input && mainEl && mainEl.querySelector) {
      input = mainEl.querySelector('input');
    }

    // 1. React/Vue native prototype setter for input.checked
    if (input) {
      try {
        const proto = window.HTMLInputElement.prototype;
        const setter = Object.getOwnPropertyDescriptor(proto, 'checked')?.set;
        if (setter) {
          setter.call(input, true);
        } else {
          input.checked = true;
        }
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
      } catch (e) {}
    }

    // 2. Click with coordinates on the card and the input
    if (cardEl) {
      simulateRealClick(cardEl);
    }
    if (input && input !== cardEl) {
      simulateRealClick(input);
    }

    // 3. Click any custom radio circle / button element inside
    if (cardEl && cardEl.querySelector) {
      const circle = cardEl.querySelector('[class*="radio"], [role="radio"], [class*="circle"], svg');
      if (circle && circle !== input && circle !== cardEl) {
        simulateRealClick(circle);
      }
    }

    // 4. Click associated label if any
    if (input && input.id) {
      const label = document.querySelector(`label[for="${CSS.escape(input.id)}"]`);
      if (label && label !== cardEl) {
        simulateRealClick(label);
      }
    }

    return true;
  }

  
// ── Simulate Real Click With Coordinates ────────────────── ────────────────────────────────────────
// ── Simulate Real Click With Coordinates ───────────────────
  function simulateRealClick(element) {
    if (!element) return;

    try {
      element.scrollIntoView({ behavior: 'instant', block: 'nearest' });
      if (typeof element.focus === 'function') element.focus();

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
        buttons: 1
      };

      // Pointer & mouse events for modern frameworks (React 18 / Tailwind / Radix)
      const eventTypes = ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click'];
      for (const evtType of eventTypes) {
        try {
          let evt;
          if (evtType.startsWith('pointer') && typeof PointerEvent !== 'undefined') {
            evt = new PointerEvent(evtType, {
              ...eventOpts,
              pointerId: 1,
              pointerType: 'mouse',
              isPrimary: true
            });
          } else {
            evt = new MouseEvent(evtType, eventOpts);
          }
          element.dispatchEvent(evt);
        } catch (e) {}
      }

      if (typeof element.click === 'function') {
        element.click();
      }

      // React Fiber / Props direct onClick invocation fallback (React 16, 17, 18, 19)
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

      // Also trigger on child SVG or span if present
      const child = element.querySelector('span, svg, div');
      if (child) {
        try {
          child.dispatchEvent(new MouseEvent('click', eventOpts));
        } catch (e) {}
      }
    } catch (err) {
      if (typeof element.click === 'function') {
        element.click();
      }
    }
  }

  
// ── Trigger Click (generic) ─────────────────────────────── ────────────────────────────────────────
// Trigger Click (generic) ────────────────────────────────
  function triggerClick(element) {
    simulateRealClick(element);
  }

  
// ── Get accumulated slide context for AI (delegates to getAccumulatedSlideContext) ──
  function getSlideContext() {
    try {
      if (typeof getAccumulatedSlideContext === 'function') {
        return getAccumulatedSlideContext();
      }
      if (typeof captureSlideContent === 'function') {
        return captureSlideContent();
      }
    } catch (e) {}
    return '';
  }

  
// ── Check if currently inside Slide Viewer UI (Ảnh 2 / Modal Bài giảng AI) ──
  function isInsideSlideViewer() {
    // 0. Direct Edux Slide Dialog check (matches modal in user HTML: role="dialog" with title "Bài giảng AI" or button "Thoát bài giảng")
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

    // 1. Check if slide counter exists (e.g. 15 / 15)
    if (getSlideCounter() !== null) {
      return true;
    }

    // 2. Legacy check: slide counter (span.text-blue-600 with number)
    const eduxBlue = document.querySelector('span.text-blue-600, span[class*="text-blue-600"]');
    if (eduxBlue && /^\d+$/.test(eduxBlue.textContent.trim())) {
      return true;
    }

    // 3. Legacy Edux bottom slide toolbar exists
    const eduxBar = document.querySelector('div.h-20.shrink-0, div[class*="h-20"][class*="shadow-lg"]');
    if (eduxBar) {
      const text = (eduxBar.textContent || '').toLowerCase();
      if (text.includes('trang sau') || text.includes('trang trước')) {
        return true;
      }
    }
    return false;
  }

// ── Get Navigation Toolbar Container (STRICTLY in Slide Viewer) ──
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

    const selectors = [
      'div.h-20.bg-white',
      'div[class*="slide-toolbar"]',
      'footer[class*="slide"]'
    ];

    for (const sel of selectors) {
      const container = document.querySelector(sel);
      if (container && isElementVisible(container)) return container;
    }

    // STRICT: Return null if not in slide viewer. NEVER return document.body or course card bottoms!
    return null;
  }

// ── Safe Element Visibility Check ──────────────────────────
  function isElementVisible(el) {
    if (!el) return false;
    if (el.offsetParent !== null) return true;
    try {
      const style = window.getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden') return false;
      const rect = el.getBoundingClientRect();
      return rect.width > 0 || rect.height > 0;
    } catch (e) {
      return false;
    }
  }

// ── Detect if inside Classroom Quiz view (Ảnh 2) ──────────
  function isInsideClassroomQuiz() {
    // 1. High confidence: progress indicator "tiến độ: X/Y câu đúng" exists
    if (getQuizProgress() !== null) return true;

    // 2. "Kiểm tra" button is present on screen
    if (findCheckQuizButton() !== null) return true;

    // 3. Button "Đổi câu hỏi" or "Thử lại" is present (Ảnh 2)
    if (findQuizRetryButton() !== null || findChangeQuestionButton() !== null) return true;

    // 4. Quiz dialog container exists with actual quiz content
    const quizContainer = getQuizDialogContainer();
    if (quizContainer) {
      const qText = (quizContainer.textContent || '').toLowerCase();
      if (qText.includes('câu hỏi trắc nghiệm') || qText.includes('câu hỏi ôn tập') || qText.includes('chọn đáp án')) {
        return true;
      }
    }

    // 5. Question with options A, B found on screen
    const questions = scanClassroomQuizQuestion();
    if (questions && questions.length > 0 && questions[0].options && questions[0].options.length >= 2) {
      return true;
    }

    return false;
  }

// ── Get only direct text nodes of an element (not children) ──
  function getDirectTextOnly(el) {
    let text = '';
    for (const node of el.childNodes) {
      if (node.nodeType === Node.TEXT_NODE) {
        text += node.textContent;
      }
    }
    return text.trim();
  }

// ── Find any green-colored clickable button in the bottom toolbar (last resort) ──
  function findGreenButtonInToolbar() {
    const toolbar = getNavigationToolbar();
    if (!toolbar) return null;
    const buttons = Array.from(toolbar.querySelectorAll('button, a, [role="button"]'));

    for (const el of buttons) {
      if (!isElementVisible(el)) continue;
      const t = (el.textContent || '').trim().toLowerCase();
      const title = (el.getAttribute('title') || el.getAttribute('aria-label') || el.parentElement?.getAttribute('label') || '').toLowerCase();

      // STRICT: Skip navigation buttons, counter, and NEVER match "Bài giảng" (green) or "Không có câu hỏi"!
      if (t.includes('trang trước') || t.includes('trang sau') || t.includes('chat') || t.includes('chưa hiểu')) continue;
      if (t.includes('không có câu hỏi') || title.includes('không có câu hỏi')) continue;
      if (t.includes('bài giảng') || title.includes('bài giảng')) continue;
      if (/^\d+\s*\/\s*\d+$/.test(t)) continue;

      const cls = (el.className || '').toString().toLowerCase();
      if (
        (cls.includes('text-green-500') && cls.includes('border-green-500')) ||
        (cls.includes('border-green') && (t.includes('trả lời') || t.includes('hỏi') || title.includes('trả lời') || title.includes('hỏi')))
      ) {
        return el.closest('button, a, [role="button"]') || el;
      }
    }
    return null;
  }

  
// ── Check if button is enabled & clickable ─────────────────
  function isButtonEnabled(btn) {
    if (!btn) return false;

    // 1. Native HTML disabled property or attribute
    if (btn.disabled === true) return false;
    const disabledAttr = btn.getAttribute('disabled');
    if (disabledAttr !== null && disabledAttr !== 'false') return false;
    if (btn.getAttribute('aria-disabled') === 'true') return false;

    // 2. Class check - MUST NOT match Tailwind pseudo-classes with colon (e.g. disabled:pointer-events-none, disabled:opacity-50)
    const classStr = (btn.className || '').toString().toLowerCase();
    const classTokens = classStr.split(/\s+/);
    for (const token of classTokens) {
      if (token.includes(':')) continue; // Ignore Tailwind variant prefixes like disabled:opacity-50
      if (token === 'disabled' || token === 'is-disabled' || token === 'btn-disabled') {
        return false;
      }
    }

    // 3. Computed style check (active visual / pointer state applied by the browser)
    try {
      const style = window.getComputedStyle(btn);
      if (style.display === 'none' || style.visibility === 'hidden') return false;
      if (style.pointerEvents === 'none') return false;
      if (parseFloat(style.opacity) < 0.15) return false;
      if (style.cursor === 'not-allowed' && (btn.getAttribute('aria-disabled') === 'true' || parseFloat(style.opacity) < 0.8)) {
        return false;
      }
    } catch (e) {}

    return true;
  }

// ── Find "Kiểm tra" button (Ảnh 2) ─────────────────────────
  function findCheckQuizButton() {
    // 0. Primary Edux button (matches Edux React source code: className="bg-primary hover:bg-primary/90 text-white")
    const primaryBtns = Array.from(document.querySelectorAll('button.bg-primary, button[class*="bg-primary"], button[data-slot="button"], button'));
    for (const btn of primaryBtns) {
      const text = (btn.textContent || '').trim().toLowerCase();
      if (text === 'kiểm tra' || text.startsWith('kiểm tra')) {
        return btn;
      }
    }

    // 1. Fallback: all clickable elements on page with text, title or aria-label
    const all = Array.from(document.querySelectorAll('button, a, [role="button"], input[type="button"], div[class*="btn"]'));
    for (const btn of all) {
      const text = (btn.textContent || '').trim().toLowerCase();
      const title = (btn.getAttribute('title') || '').toLowerCase();
      const aria = (btn.getAttribute('aria-label') || '').toLowerCase();
      if (
        text === 'kiểm tra' || text.startsWith('kiểm tra') ||
        title === 'kiểm tra' || aria === 'kiểm tra'
      ) {
        return btn.closest('button, a, [role="button"]') || btn;
      }
    }
    return null;
  }

  // ── Find "Thử lại" button (Ảnh 2 / Edux orange retry button) ──
  function findQuizRetryButton() {
    // 0. Direct Edux orange retry button (matches Edux React source: className="bg-orange-600 hover:bg-orange-700 text-white")
    const directOrange = document.querySelector('button.bg-orange-600, button[class*="bg-orange-600"], button.bg-amber-600');
    if (directOrange && isButtonEnabled(directOrange) && isElementVisible(directOrange)) {
      const text = (directOrange.textContent || '').trim().toLowerCase();
      if (text.includes('thử') || text.includes('lại') || text.includes('retry')) {
        return directOrange;
      }
    }

    const buttons = Array.from(document.querySelectorAll('button, a, [role="button"], input[type="button"], div[class*="btn"]'));
    for (const btn of buttons) {
      if (!isButtonEnabled(btn) || !isElementVisible(btn)) continue;
      const text = (btn.textContent || '').trim().toLowerCase();
      const title = (btn.getAttribute('title') || '').toLowerCase();
      const cls = (btn.className || '').toString().toLowerCase();

      if (
        text.includes('thử lại') || title.includes('thử lại') ||
        text.includes('làm lại') || title.includes('làm lại') ||
        (cls.includes('orange') && (text.includes('thử') || text.includes('lại')))
      ) {
        return btn.closest('button, a, [role="button"]') || btn;
      }
    }
    return null;
  }

  // ── Find "Đổi câu hỏi" button (Ảnh 2 - when answer is wrong and user wants different Q) ──
  function findChangeQuestionButton() {
    const buttons = Array.from(document.querySelectorAll('button, a, [role="button"], input[type="button"], div[class*="btn"]'));
    for (const btn of buttons) {
      const text = (btn.textContent || '').trim().toLowerCase();
      const title = (btn.getAttribute('title') || '').toLowerCase();
      if (
        text === 'đổi câu hỏi' ||
        text.startsWith('đổi câu') ||
        text.includes('câu khác') ||
        text.includes('thay câu') ||
        text === 'change question' ||
        title.includes('đổi câu')
      ) {
        return btn.closest('button, a, [role="button"]') || btn;
      }
    }
    return null;
  }

  // ── Find the Option Letter revealed as CORRECT by Edux (when wrong answer is evaluated) ──
  function findRevealedCorrectOptionLetter() {
    // 0. Direct Edux explanation span: e.g. <span class="font-semibold shrink-0">B.</span>
    const semiboldSpan = document.querySelector('span.font-semibold.shrink-0, span[class*="font-semibold"][class*="shrink-0"]');
    if (semiboldSpan) {
      const sm = (semiboldSpan.textContent || '').trim().match(/^([A-F])[\.\:\)]?$/i);
      if (sm) return sm[1].toUpperCase();
    }

    // 0b. Direct Edux green option letter: <span class="font-bold mr-3 shrink-0 text-green-600">B.</span>
    const greenLetterSpan = document.querySelector('span.text-green-600, span[class*="text-green-600"]');
    if (greenLetterSpan) {
      const gm = (greenLetterSpan.textContent || '').trim().match(/^([A-F])[\.\:\)]?$/i);
      if (gm) return gm[1].toUpperCase();
    }

    // 1. Check for Edux explicit text banner "Đáp án đúng: B."
    const bodyText = (document.body.innerText || document.body.textContent || '');
    const correctBannerMatch = bodyText.match(/đáp\s*án\s*đúng\s*[:\s]*([A-F])[\.\:\)\s]/i);
    if (correctBannerMatch) {
      return correctBannerMatch[1].toUpperCase();
    }

    // 2. Look for option cards styled green by Edux Q0 function (border-green-500 bg-green-50 or text-green-700)
    const greenCards = Array.from(document.querySelectorAll('div[class*="border-green"], div[class*="bg-green-50"], [class*="text-green-700"]'));
    for (const el of greenCards) {
      const text = (el.textContent || '').trim();
      const match = text.match(/^\s*([A-F])[\.\:\)\s]/i) || text.match(/\b([A-F])\b/);
      if (match) {
        return match[1].toUpperCase();
      }
      const p = el.querySelector('span, p, div');
      if (p) {
        const pm = (p.textContent || '').trim().match(/^([A-F])[\.\:\)\s]?/i);
        if (pm) return pm[1].toUpperCase();
      }
    }

    return null;
  }

  
// ── Find Quiz Back button (< button at top left of modal - Ảnh 2) ──
  function findQuizBackButton() {
    // 1. Direct Edux button with standard back/exit titles or aria-labels
    const directBtn = document.querySelector(
      'button[title*="Quay lại" i], button[aria-label*="Quay lại" i], ' +
      'button[title*="Thoát" i], button[aria-label*="Thoát" i], ' +
      'button[title*="Trở lại" i], button[aria-label*="Trở lại" i], ' +
      'button[title*="Trở về" i], button[aria-label*="Trở về" i], ' +
      'button[title*="Back" i], button[aria-label*="Back" i], ' +
      'button[title*="Close" i], button[aria-label*="Close" i], ' +
      'button[title*="Đóng" i], button[aria-label*="Đóng" i]'
    );
    if (directBtn && isButtonEnabled(directBtn) && isElementVisible(directBtn)) {
      const rect = directBtn.getBoundingClientRect();
      if (rect.top < window.innerHeight - 100) {
        return directBtn;
      }
    }

    // 2. Button containing Lucide chevron-left icon / SVG path in top-left area
    const candidates = Array.from(document.querySelectorAll('button, a, [role="button"]'));
    for (const btn of candidates) {
      if (!isButtonEnabled(btn) || !isElementVisible(btn)) continue;
      const hasChevronLeft = btn.querySelector(
        'svg.lucide-chevron-left, svg[class*="chevron-left"], svg[class*="arrow-left"], ' +
        'svg path[d*="m15 18"], svg path[d*="M15 18"], svg path[d*="15 18-6-6 6-6"], svg path[d*="15 18"], svg path[d*="m14 18"]'
      );
      const text = btn.textContent.trim();
      const isChevronText = ['<', '❮', '←', '‹'].includes(text);

      if (hasChevronLeft || isChevronText) {
        const rect = btn.getBoundingClientRect();
        // Quiz back button is ALWAYS at top-left of viewport / modal (top < 220, left < 300)
        // And NOT in the bottom navigation toolbar
        if (rect.top < 220 && rect.left < 300 && rect.bottom < window.innerHeight - 80) {
          return btn;
        }
      }
    }

    // 3. Look in the same flex header container as "Câu hỏi trắc nghiệm" / "câu hỏi ôn tập"
    const quizHeading = Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, span, p, div')).find(el => {
      if (el.children.length > 2) return false;
      const t = (el.textContent || '').trim().toLowerCase();
      return t === 'câu hỏi trắc nghiệm' || t.includes('câu hỏi trắc nghiệm') || t.includes('câu hỏi ôn tập');
    });
    if (quizHeading) {
      let row = quizHeading.closest('header, [class*="header"], div.flex, div[class*="flex"]');
      if (!row) row = quizHeading.parentElement;
      if (row) {
        const btns = Array.from(row.querySelectorAll('button, [role="button"]'));
        for (const b of btns) {
          if (isButtonEnabled(b) && isElementVisible(b)) {
            const rect = b.getBoundingClientRect();
            if (rect.left <= quizHeading.getBoundingClientRect().left + 50) {
              return b;
            }
          }
        }
        const parentRow = row.parentElement;
        if (parentRow) {
          const parentBtns = Array.from(parentRow.querySelectorAll('button, [role="button"]'));
          for (const b of parentBtns) {
            if (isButtonEnabled(b) && isElementVisible(b)) {
              const rect = b.getBoundingClientRect();
              if (rect.top < 200 && rect.left < 250) {
                return b;
              }
            }
          }
        }
      }
    }

    // 4. Look inside Quiz Dialog Container for top-left button (e.g. h-9 w-9 rounded-lg)
    const dialog = typeof getQuizDialogContainer === 'function' ? getQuizDialogContainer() : document.querySelector('[role="dialog"]');
    if (dialog) {
      const dialogBtns = Array.from(dialog.querySelectorAll('button, [role="button"]'));
      for (const btn of dialogBtns) {
        if (!isButtonEnabled(btn) || !isElementVisible(btn)) continue;
        const rect = btn.getBoundingClientRect();
        const dRect = dialog.getBoundingClientRect();
        if (rect.top - dRect.top < 150 && rect.left - dRect.left < 150 && rect.width < 70 && rect.height < 70) {
          return btn;
        }
      }
    }

    // 5. General fallback: Small icon button in top-left quadrant of screen
    const allBtns = Array.from(document.querySelectorAll('button'));
    for (const btn of allBtns) {
      if (!isButtonEnabled(btn) || !isElementVisible(btn)) continue;
      const rect = btn.getBoundingClientRect();
      if (rect.top >= 0 && rect.top < 160 && rect.left >= 0 && rect.left < 200 && rect.width >= 24 && rect.width <= 60 && rect.height >= 24 && rect.height <= 60) {
        if (btn.closest('#ahs-floating-dock, #ahs-floating-host')) continue;
        return btn;
      }
    }

    return null;
  }

  // ── Find "Bỏ qua" button during auto countdown in Classroom Quiz ──
  function findQuizSkipCountdownButton() {
    // Buttons MUST explicitly contain "bỏ qua" or "skip" (e.g. "Bỏ qua", "Bỏ qua (3s)", "Skip")
    // NEVER match empty text buttons (such as back icon < or radio buttons)!
    const buttons = Array.from(document.querySelectorAll('button, a, [role="button"]'));
    for (const btn of buttons) {
      if (!isButtonEnabled(btn) || !isElementVisible(btn)) continue;
      const text = (btn.textContent || '').trim().toLowerCase();
      if (text.includes('bỏ qua') || text.includes('bo qua') || (text.startsWith('skip') && text.length < 15)) {
        return btn.closest('button, a, [role="button"]') || btn;
      }
    }
    return null;
  }

// ── Get Quiz Dialog Container element if active ────────────
  function getQuizDialogContainer() {
    // 1. Direct modal/dialog element
    const dialogs = document.querySelectorAll('[role="dialog"], [class*="modal"], [class*="dialog"], div.fixed.inset-0, div[class*="fixed"][class*="inset-0"]');
    for (const d of dialogs) {
      if (isElementVisible(d)) return d;
    }

    // 2. Locate container via Quiz Heading or Progress text
    const headings = Array.from(document.querySelectorAll('h1, h2, h3, h4, span, div, p'));
    for (const h of headings) {
      if (h.children.length > 2) continue;
      const t = (h.textContent || '').trim().toLowerCase();
      if (t === 'câu hỏi trắc nghiệm' || t.includes('câu hỏi trắc nghiệm') || /tiến\s*độ\s*[:\s]*\d+\s*\/\s*\d+/i.test(t)) {
        const container = h.closest('[role="dialog"], [class*="sheet"], [class*="modal"], [class*="dialog"], div.fixed, div[class*="fixed"], div[class*="overflow-y"]');
        if (container && container !== document.body) return container;
      }
    }
    return null;
  }

// ── Find "Trang sau" button inside Classroom Quiz view (Ảnh 2 / Edux completed quiz) ─
  function findQuizNextSlideButton() {
    const toolbar = getNavigationToolbar();

    // 0. Direct Edux completed button selector (matches Edux React source: className="bg-green-600 hover:bg-green-700")
    const greenBtns = Array.from(document.querySelectorAll('button.bg-green-600, button[class*="bg-green-600"], button.bg-emerald-600'));
    for (const btn of greenBtns) {
      if (toolbar && toolbar.contains(btn)) continue;
      if (isButtonEnabled(btn) && isElementVisible(btn)) return btn;
    }

    // 1. Check all buttons for "Trang sau", "Tiếp tục", "Hoàn thành"
    const buttons = Array.from(document.querySelectorAll('button, a, [role="button"], div[class*="btn"], input[type="button"]'));
    for (const btn of buttons) {
      if (toolbar && toolbar.contains(btn)) continue;
      if (btn.closest('div.h-20, footer[class*="slide"]')) continue;
      if (!isElementVisible(btn) || !isButtonEnabled(btn)) continue;
      const text = (btn.textContent || '').trim().toLowerCase();
      if (
        text === 'trang sau' || text === 'trang sau >' || text.startsWith('trang sau') ||
        text.includes('trang sau') || text === 'next slide' || text.includes('tiếp tục bài học') ||
        text.includes('hoàn thành bài') || text === 'tiếp tục'
      ) {
        return btn.closest('button, a, [role="button"], div') || btn;
      }
    }
    return null;
  }

// ── Find "Tiếp theo / Câu tiếp theo" button inside Classroom Quiz view ────────
  function findQuizNextQuestionButton() {
    // 0. Direct Edux next question button selector (matches Edux React: className="bg-blue-600 hover:bg-blue-700")
    const blueBtns = Array.from(document.querySelectorAll('button.bg-blue-600, button[class*="bg-blue-600"], button[class*="bg-cyan"], button.bg-primary'));
    for (const btn of blueBtns) {
      if (isButtonEnabled(btn) && isElementVisible(btn)) {
        const text = (btn.textContent || '').trim().toLowerCase();
        if (text.includes('câu tiếp') || text.includes('tiếp theo') || text.includes('tiếp tục')) {
          return btn;
        }
      }
    }

    const buttons = Array.from(document.querySelectorAll('button, a, [role="button"], div[class*="btn"], input[type="button"]'));
    for (const btn of buttons) {
      if (!isElementVisible(btn) || !isButtonEnabled(btn)) continue;
      const text = btn.textContent.trim().toLowerCase();
      if (
        (text === 'câu tiếp theo' || text === 'tiếp theo' || text === 'câu tiếp' || text === 'câu tiếp >' ||
        text === 'tiếp tục' || text === 'câu sau' || text === 'next' || text === 'next question' || text.includes('câu tiếp')) &&
        isButtonEnabled(btn)
      ) {
        return btn.closest('button, a, [role="button"], div') || btn;
      }
    }
    return null;
  }

  
// ── RGB Color Parser & Hue Detectors ───────────────────── ────────────────────────────────────────
// RGB Color Parser & Hue Detectors ──────────────────────
  function parseRgbColor(colorStr) {
    if (!colorStr) return null;
    const m = colorStr.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
    return m ? { r: parseInt(m[1], 10), g: parseInt(m[2], 10), b: parseInt(m[3], 10) } : null;
  }

  function isRedTone(rgb) {
    if (!rgb) return false;
    // Red must dominate over green and blue
    return rgb.r > 150 && rgb.g < 110 && rgb.b < 110;
  }

  function isGreenTone(rgb) {
    if (!rgb) return false;
    // Green must dominate over red and blue
    return rgb.g > 120 && rgb.g > rgb.r * 1.15 && rgb.g > rgb.b * 1.15;
  }

  
// ── Determine if an element / option is styled RED (wrong) or GREEN (correct) ─ ────────────────────────────────────────
  // Determine if an element / option is styled RED (wrong) or GREEN (correct) ──
  function getOptionResultState(el) {
    if (!el) return null;

    // 1. Check CSS classes
    const cls = (el.className || '').toString().toLowerCase();
    if (
      cls.includes('border-red') || cls.includes('bg-red') || cls.includes('text-red') ||
      cls.includes('border-rose') || cls.includes('bg-rose') || cls.includes('danger') ||
      cls.includes('incorrect') || cls.includes('wrong') || cls.includes('is-invalid') ||
      cls.includes('border-destructive')
    ) {
      return 'wrong';
    }

    if (
      cls.includes('border-green') || cls.includes('bg-green') || cls.includes('text-green') ||
      cls.includes('border-emerald') || cls.includes('bg-emerald') || cls.includes('success') ||
      cls.includes('correct') || cls.includes('is-valid')
    ) {
      return 'correct';
    }

    // 2. Check computed styles of the element itself
    try {
      const style = window.getComputedStyle(el);
      const borderRgb = parseRgbColor(style.borderColor) || parseRgbColor(style.borderTopColor);
      const bgRgb = parseRgbColor(style.backgroundColor);
      const textRgb = parseRgbColor(style.color);

      if (isRedTone(borderRgb) || isRedTone(bgRgb) || (isRedTone(textRgb) && textRgb.r > 180)) {
        return 'wrong';
      }
      if (isGreenTone(borderRgb) || isGreenTone(bgRgb) || (isGreenTone(textRgb) && textRgb.g > 140)) {
        return 'correct';
      }
    } catch (e) {}

    // 3. Check child elements (radio icon, indicator, SVG circle/path)
    const indicators = el.querySelectorAll('[class*="border"], [class*="bg"], [class*="text"], [class*="radio"], svg, circle, path');
    for (const ind of indicators) {
      const indCls = (ind.className || '').toString().toLowerCase();
      if (indCls.includes('red') || indCls.includes('rose') || indCls.includes('danger') || indCls.includes('wrong')) {
        return 'wrong';
      }
      if (indCls.includes('green') || indCls.includes('emerald') || indCls.includes('success') || indCls.includes('correct')) {
        return 'correct';
      }
      try {
        const indStyle = window.getComputedStyle(ind);
        const fillRgb = parseRgbColor(indStyle.fill);
        const strokeRgb = parseRgbColor(indStyle.stroke);
        const bgRgb = parseRgbColor(indStyle.backgroundColor);
        const borderRgb = parseRgbColor(indStyle.borderColor);

        if (isRedTone(fillRgb) || isRedTone(strokeRgb) || isRedTone(bgRgb) || isRedTone(borderRgb)) return 'wrong';
        if (isGreenTone(fillRgb) || isGreenTone(strokeRgb) || isGreenTone(bgRgb) || isGreenTone(borderRgb)) return 'correct';
      } catch (e) {}
    }

    return null;
  }

  
  // Get Quiz Answer Status: 'wrong' | 'correct' | 'unanswered' ──
  function getQuizAnswerStatus() {
    // 0. If "Kiểm tra" button is present and visible on screen, question has NOT been submitted yet!
    const checkBtn = findCheckQuizButton();
    if (checkBtn && checkBtn.offsetParent !== null) {
      const text = (checkBtn.textContent || '').trim().toLowerCase();
      if (text.includes('kiểm tra')) {
        return 'unanswered';
      }
    }

    // 1. Check for Edux explicit result banner (div.border-l-4.rounded-xl rendered when Q exists)
    const eduxResultBanner = document.querySelector('div[class*="border-l-4"][class*="rounded-xl"]');
    if (eduxResultBanner && eduxResultBanner.offsetParent !== null) {
      const bannerText = (eduxResultBanner.textContent || '').toLowerCase();
      const bannerCls = (eduxResultBanner.className || '').toLowerCase();
      if (bannerCls.includes('border-red') || bannerCls.includes('bg-red') || bannerText.includes('chưa đúng') || bannerText.includes('chưa chính xác') || bannerText.includes('đáp án đúng')) {
        return 'wrong';
      }
      if (bannerCls.includes('border-green') || bannerCls.includes('bg-green') || bannerText.includes('chính xác') || bannerText.includes('đúng')) {
        return 'correct';
      }
    }

    // 2. Check for presence of "Thử lại" button (rendered by Edux ONLY when answer is evaluated as wrong)
    const retryBtn = typeof findQuizRetryButton === 'function' ? findQuizRetryButton() : null;
    if (retryBtn) {
      return 'wrong';
    }

    // 3. Check for presence of "Câu tiếp theo" button (rendered by Edux ONLY when answer is evaluated as correct)
    const nextQBtn = Array.from(document.querySelectorAll('button')).find(b => {
      if (b.offsetParent === null) return false;
      const t = (b.textContent || '').trim().toLowerCase();
      return t === 'câu tiếp theo' || t === 'tiếp theo';
    });
    if (nextQBtn) {
      return 'correct';
    }

    // 4. Check option cards explicitly styled by Edux Q0 function (evaluated state)
    const wrongCard = document.querySelector('div[class*="border-red-500"][class*="bg-red-50"], [class*="text-red-700"][class*="border-red"]');
    if (wrongCard && wrongCard.offsetParent !== null) {
      return 'wrong';
    }

    const correctCard = document.querySelector('div[class*="border-green-500"][class*="bg-green-50"]');
    if (correctCard && correctCard.offsetParent !== null) {
      return 'correct';
    }

    return 'unanswered';
  }

  
  // Get Page Counter / Progress ─────────────────────────────
  function getPageCounter(questions) {
    const quizDialog = typeof getQuizDialogContainer === 'function' ? getQuizDialogContainer() : null;

    // 0. Exact leaf counter 'X / Y' (matches Edux span.font-medium: '15 / 15', '1 / 15' etc.)
    const leafSpans = Array.from(document.querySelectorAll('span, p, div, b, strong'));
    for (const el of leafSpans) {
      if (el.children.length > 0) continue;
      // CRITICAL: Never mistake quiz dialog progress or question counters for slide counter
      if (quizDialog && quizDialog.contains(el)) continue;
      const parentText = (el.parentElement?.textContent || '').toLowerCase();
      if (parentText.includes('tiến độ') || parentText.includes('câu đúng')) continue;

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

    // 1. Edux CMC AI Slide Counter Detection
    const eduxBlue = document.querySelector('span.text-blue-600, span[class*="text-blue-600"]');
    if (eduxBlue && isElementVisible(eduxBlue)) {
      const curText = eduxBlue.textContent.trim();
      const curNum = parseInt(curText, 10);
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

    const bodyText = document.body.innerText || document.body.textContent || '';

    let activeQNum = null;
    if (questions && questions.length > 0) {
      const q = questions[0];
      if (q.questionNumber) {
        activeQNum = q.questionNumber;
      } else if (q.questionText) {
        const m = q.questionText.match(/(?:câu|question)\s*(\d+)/i);
        if (m) activeQNum = parseInt(m[1], 10);
      }
    }

    const quizRegexes = [
      /(\d+)\s*\/\s*(\d+)\s*câu(?:\s*hỏi)?/i,
      /(?:câu|question)\s*(\d+)\s*\/\s*(\d+)/i,
      /tiến\s*độ\s*[:\s]*(\d+)\s*\/\s*(\d+)/i,
      /hoàn\s*thành\s*[:\s]*(\d+)\s*\/\s*(\d+)/i,
      /(\d+)\s*\/\s*(\d+)\s*(?:slide|trang|bài)/i,
    ];

    for (const reg of quizRegexes) {
      const match = bodyText.match(reg);
      if (match) {
        const num1 = parseInt(match[1], 10);
        const num2 = parseInt(match[2], 10);
        if (num2 > 0 && num1 <= num2 && num2 <= 500) {
          const current = activeQNum || (num1 === num2 ? num1 : num1 + 1);
          return { completed: num1, total: num2, current, text: `${num1} / ${num2}` };
        }
      }
    }

    const progressSelectors = [
      '[class*="progress"]', '[class*="counter"]', '[class*="paging"]',
      '[class*="pagination"]', '[class*="status"]', '[class*="quiz-info"]',
      '[class*="exam-info"]', '[role="progressbar"]',
    ];

    for (const sel of progressSelectors) {
      try {
        const els = document.querySelectorAll(sel);
        for (const el of els) {
          if (el.children.length > 6) continue;
          const txt = (el.innerText || el.textContent || '').trim();
          const m = txt.match(/(\d+)\s*\/\s*(\d+)/);
          if (m) {
            const num1 = parseInt(m[1], 10);
            const num2 = parseInt(m[2], 10);
            if (num2 > 0 && num1 <= num2 && num2 <= 500) {
              const current = activeQNum || (num1 === num2 ? num1 : num1 + 1);
              return { completed: num1, total: num2, current, text: `${num1} / ${num2}` };
            }
          }
        }
      } catch {}
    }

    const chuaLamMatch = bodyText.match(/(?:chưa\s*làm|còn\s*lại)\s*\(?(\d+)\)?/i);
    if (chuaLamMatch && activeQNum && activeQNum > 0) {
      const remaining = parseInt(chuaLamMatch[1], 10);
      if (remaining > 0 && remaining < 500) {
        const total = (activeQNum - 1) + remaining;
        if (total > 0 && total <= 500) {
          return { completed: activeQNum - 1, total, current: activeQNum, text: `${activeQNum - 1} / ${total}` };
        }
      }
    }

    const allSlashRegex = /(\d+)\s*\/\s*(\d+)/g;
    let match;
    let bestMatch = null;
    let highestScore = -1;

    while ((match = allSlashRegex.exec(bodyText)) !== null) {
      const num1 = parseInt(match[1], 10);
      const num2 = parseInt(match[2], 10);
      if (num2 <= 0 || num2 > 500 || num1 > num2) continue;

      const start = Math.max(0, match.index - 35);
      const end = Math.min(bodyText.length, match.index + match[0].length + 35);
      const ctx = bodyText.substring(start, end).toLowerCase();

      if (/ngày|tháng|năm|date|\/\s*202\d|\d{4}/.test(ctx)) continue;

      let score = 0;
      if (/câu|hỏi|question|quiz/.test(ctx)) score += 50;
      if (/tiến\s*độ|progress|hoàn\s*thành/.test(ctx)) score += 40;
      if (/slide|trang|bài/.test(ctx)) score += 25;
      if (num2 >= 5 && num2 <= 150) score += 10;

      if (score > highestScore) {
        highestScore = score;
        const current = activeQNum || (num1 === num2 ? num1 : num1 + 1);
        bestMatch = { completed: num1, total: num2, current, text: `${num1} / ${num2}` };
      }
    }

    if (bestMatch && highestScore > 0) return bestMatch;
    return null;
  }

  // Get Slide Counter (backwards compatible wrapper)
  function getSlideCounter() {
    return getPageCounter();
  }

  
// ── Get Quiz Progress ("tiến độ: X/Y câu đúng") ────────────
  function getQuizProgress() {
    // 1. Fast direct leaf scan for "tiến độ: X/Y"
    const elements = document.querySelectorAll('span, p, div, b, strong');
    for (const el of elements) {
      if (el.children.length > 2) continue;
      const text = el.textContent || '';
      if (text.length > 80) continue;
      const m = text.match(/tiến\s*độ\s*[:\s]*(\d+)\s*\/\s*(\d+)(?:\s*câu\s*đúng)?/i);
      if (m) {
        const correct = parseInt(m[1], 10);
        const total = parseInt(m[2], 10);
        return { correct, total, done: correct >= total && total > 0 };
      }
    }

    // 2. Scoped to active quiz dialog
    const container = getQuizDialogContainer();
    if (container) {
      const text = container.textContent || '';
      const match = text.match(/tiến\s*độ\s*[:\s]*(\d+)\s*\/\s*(\d+)(?:\s*câu\s*đúng)?/i);
      if (match) {
        const correct = parseInt(match[1], 10);
        const total = parseInt(match[2], 10);
        return { correct, total, done: correct >= total && total > 0 };
      }
    }
    return null;
  }

// ── Check if quiz is fully completed ───────────────────────
  function isQuizCompleted() {
    // 1. If progress indicator exists (e.g. "Tiến độ: 0/2 câu đúng"), STRICTLY require correct >= total!
    const progress = getQuizProgress();
    if (progress && progress.total > 0) {
      if (progress.correct >= progress.total) return true;
      // When progress is not yet achieved (e.g. 0/2 or 1/2), quiz is definitely NOT complete!
      return false;
    }

    // 2. If button has transformed into "Trang sau" in quiz view (user: "đến khi nút kiểm tra hiện Trang sau")
    const nextSlideBtn = findQuizNextSlideButton();
    if (nextSlideBtn && isButtonEnabled(nextSlideBtn)) {
      return true;
    }

    // 3. If "Kiểm tra" button is present and visible on screen, question has not even been submitted -> NEVER completed!
    const checkBtn = findCheckQuizButton();
    if (checkBtn && isElementVisible(checkBtn)) {
      return false;
    }

    // 4. If retry or change question button is visible -> NOT completed!
    if (findQuizRetryButton() !== null || findChangeQuestionButton() !== null) {
      return false;
    }

    // 5. If there are active questions or options on screen, quiz is DEFINITELY NOT completed!
    const questions = scanClassroomQuizQuestion();
    if (questions && questions.length > 0 && questions[0].options && questions[0].options.length >= 2) {
      return false;
    }

    // 6. Only declare completed if quiz container explicitly shows a completion screen/banner
    const container = getQuizDialogContainer();
    if (container && container !== document.body) {
      const text = (container.innerText || container.textContent || '').toLowerCase();
      if (
        text.includes('bạn đã hoàn thành') ||
        (text.includes('chúc mừng') && (text.includes('hoàn thành') || text.includes('vượt qua'))) ||
        (text.includes('hoàn thành') && text.includes('100%'))
      ) {
        return true;
      }
    }

    return false;
  }

  
// ── Extract letter helper ───────────────────────────────── ────────────────────────────────────────
// Extract letter helper ──────────────────────────────────
  function extractAnswerLetter(text) {
    if (!text) return '';
    const match = text.match(/^(?:đáp\s*án\s*[\:\.]*|[\[\(])?\s*([A-D])[\.\:\)\s]/i) || text.match(/\b([A-D])\b/);
    return match ? match[1].toUpperCase() : '';
  }

  
