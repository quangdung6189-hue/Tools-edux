// ── Slide Reader Automation Module ─────────────────────────
  var isSlideRunning = window.__ahs_isSlideRunning || false;
  var slideTimer = window.__ahs_slideTimer || null;
  var slideDelayMs = window.__ahs_slideDelayMs || 500;
  var slideAutoQuiz = window.__ahs_slideAutoQuiz !== undefined ? window.__ahs_slideAutoQuiz : true;
  var currentLectureUrl = window.__ahs_currentLectureUrl || '';
  var slideKnowledgeCache = window.__ahs_slideKnowledgeCache = window.__ahs_slideKnowledgeCache || new Map();
  var completedQuizSlides = window.__ahs_completedQuizSlides = window.__ahs_completedQuizSlides || new Set();
  var lastActiveSlideNumber = window.__ahs_lastActiveSlideNumber || null;
  var lastQuizExitTime = 0;
  var lastRevealedCorrectAnswer = window.__ahs_lastRevealedCorrectAnswer || null;
  var lastRevealedQuestionText = window.__ahs_lastRevealedQuestionText || '';
  var MAX_SLIDE_CONTEXT_LENGTH = 4000;

  function getLectureKey() {
    try {
      return (window.location.origin + window.location.pathname + window.location.search).split('#')[0];
    } catch (e) {
      return '';
    }
  }

  function checkAndSyncLectureContext() {
    const key = getLectureKey();
    if (key && currentLectureUrl && key !== currentLectureUrl) {
      sendSlideLog('🔄 Chuyển sang bài giảng mới -> Tự động dọn sạch bộ nhớ bài học cũ!', 'info', 'running');
      slideKnowledgeCache.clear();
      completedQuizSlides.clear();
      lastRevealedCorrectAnswer = null;
      lastRevealedQuestionText = '';
    }
    currentLectureUrl = key;
  }

  function accumulateSlideKnowledge(slideNum) {
    if (!slideNum) return;
    try {
      const content = captureSlideContent();
      if (content && content.length > 20) {
        if (!slideKnowledgeCache.has(slideNum)) {
          slideKnowledgeCache.set(slideNum, content);
          sendSlideLog(`📚 Đã lưu kiến thức Slide ${slideNum} vào bộ nhớ bài học (tổng ${slideKnowledgeCache.size} slides)`, 'info', 'running');
        }
      }
    } catch (e) {}
  }

  function clearLectureKnowledge() {
    slideKnowledgeCache.clear();
    completedQuizSlides.clear();
    lastRevealedCorrectAnswer = null;
    lastRevealedQuestionText = '';
    sendSlideLog('🧹 Đã hoàn thành toàn bộ bài học và tự động dọn sạch bộ nhớ bài giảng cũ!', 'success', 'done');
  }

  function getAccumulatedSlideContext(maxChars = 4000) {
    if (slideKnowledgeCache.size === 0) return '';
    const sortedNums = Array.from(slideKnowledgeCache.keys()).sort((a, b) => a - b);
    let result = '';
    // Iterate from newest slides backwards to stay within token budget
    for (let i = sortedNums.length - 1; i >= 0; i--) {
      const num = sortedNums[i];
      const text = slideKnowledgeCache.get(num);
      const chunk = `[Slide ${num}]\n${text}\n\n`;
      if (result.length + chunk.length > maxChars) break;
      result = chunk + result;
    }
    return result.trim();
  }

// ── Capture current page content (for sidepanel non-slide mode) ──
  function capturePageContent() {
    return captureSlideContent(); // Same logic
  }

  function sendSlideLog(text, level = 'info', badge = 'running', counter = '') {
    try {
      chrome.runtime.sendMessage({
        type: 'SLIDE_LOG_EVENT',
        text,
        level,
        badge,
        counter
      });
    } catch (e) {}

    // Real-time synchronization with floating toolbar on page
    if (typeof window.__ahs_updateFloatingBar === 'function') {
      try {
        window.__ahs_updateFloatingBar({ text, level, badge, counter });
      } catch (_) {}
    }
  }

  function startAutoSlide(config = {}) {
    if (isSlideRunning) stopAutoSlide();
    isSlideRunning = true;
    window.__ahs_isSlideRunning = true;
    slideDelayMs = config.delayMs || 500;
    slideAutoQuiz = config.autoQuiz !== false;
    checkAndSyncLectureContext();

    try {
      chrome.storage.local.set({
        ahs_slide_task: {
          running: true,
          delayMs: slideDelayMs,
          autoQuiz: slideAutoQuiz,
          url: window.location.href,
          startedAt: Date.now()
        }
      });
    } catch (_) {}

    const slideInfo = getSlideCounter();
    if (slideInfo && slideInfo.current === 1) {
      slideKnowledgeCache.clear();
      completedQuizSlides.clear();
      sendSlideLog('🔄 Bắt đầu từ Slide 1 -> Đã làm mới bộ nhớ bài học!', 'info', 'running');
    }

    sendSlideLog('🚀 Bắt đầu tiến trình tự động học Slide...', 'info', 'running');
    runSlideStep();
    return { success: true };
  }

  function stopAutoSlide() {
    isSlideRunning = false;
    window.__ahs_isSlideRunning = false;
    if (slideTimer) {
      clearTimeout(slideTimer);
      slideTimer = null;
    }
    try {
      chrome.storage.local.set({
        ahs_slide_task: { running: false }
      });
    } catch (_) {}
    sendSlideLog('⏹️ Đã dừng tự động đọc Slide.', 'warning', 'ready');
    return { success: true };
  }

  function getSlideStatus() {
    return {
      running: isSlideRunning,
      inQuiz: isInsideClassroomQuiz(),
      slideInfo: getSlideCounter()
    };
  }

  // Auto-resume slide automation on page reload if previously running
  try {
    chrome.storage.local.get(['ahs_slide_task'], (res) => {
      const task = res?.ahs_slide_task;
      if (task && task.running && (Date.now() - (task.startedAt || 0) < 7200000)) {
        console.log('[AutoSlide] Phát hiện tiến trình đọc slide đang chạy, tiếp tục...');
        setTimeout(() => {
          if (!isSlideRunning) {
            startAutoSlide({ delayMs: task.delayMs, autoQuiz: task.autoQuiz });
          }
        }, 1200);
      }
    });
  } catch (_) {}

  
// ── Detect if Slide requires answering questions (Ảnh 1 & 3) ──
  function isNextSlideGatedByQuiz() {
    // Only valid inside Slide Viewer
    if (typeof isInsideSlideViewer === 'function' && !isInsideSlideViewer()) {
      return false;
    }

    const slideInfo = getSlideCounter();
    if (slideInfo && completedQuizSlides.has(slideInfo.current)) {
      return false; // Quiz on this slide was already completed!
    }

    // 1. Instant check: Classroom Quiz Button State (from scanners.js)
    if (typeof getClassroomQuizButtonState === 'function') {
      const qs = getClassroomQuizButtonState();
      if (qs.state === 'ready') return true;
      if (qs.state === 'checking') return true; // Edux is loading questions -> slide is waiting
      if (qs.state === 'no_quiz') return false; // Explicitly confirmed no quiz on this slide
    }

    // 2. Direct check: Green "Trả lời trên lớp" button is present and enabled
    const quizBtn = findClassroomQuizButton();
    if (quizBtn && isButtonEnabled(quizBtn)) return true;

    // 3. Instant check: "Trang sau" button is disabled on non-last slide (Edux locks slide via disabled attribute)
    const nextBtn = findNextSlideButton();
    const isLastSlide = slideInfo && slideInfo.current >= slideInfo.total && slideInfo.total > 0;
    if (nextBtn && !isButtonEnabled(nextBtn) && !isLastSlide) {
      return true;
    }

    // 4. Fast Tooltip check (NO document.body.innerText! Query specific tooltip elements only)
    const tooltips = document.querySelectorAll('[role="tooltip"], div[class*="tooltip"], div[class*="popover"], div[class*="bg-black"], div[class*="bg-gray-800"]');
    for (const tip of tooltips) {
      const txt = (tip.textContent || '').toLowerCase();
      if (txt.includes('cần trả lời') || txt.includes('để chuyển trang') || txt.includes('trả lời câu hỏi') || txt.includes('hoàn thành câu hỏi')) {
        return true;
      }
    }

    return false;
  }

// ── Edux Native Keyboard & Sidebar Navigation Helpers ─────
  function dispatchEduxNextKey() {
    try {
      const opts = { key: 'ArrowRight', code: 'ArrowRight', keyCode: 39, which: 39, bubbles: true, cancelable: true };
      window.dispatchEvent(new KeyboardEvent('keydown', opts));
      document.dispatchEvent(new KeyboardEvent('keydown', opts));
    } catch (e) {}
  }

  function clickNextSidebarSlideItem() {
    try {
      const slideInfo = getSlideCounter();
      if (slideInfo && slideInfo.current < slideInfo.total) {
        const nextNum = String(slideInfo.current + 1);
        const sidebar = document.querySelector('aside, [class*="sidebar"], div.w-16, div[class*="w-14"], nav');
        const root = sidebar || document;
        const candidates = Array.from(root.querySelectorAll('button, [role="button"], div, span, a'));
        for (const el of candidates) {
          if (el.children.length > 1) continue;
          if (el.textContent.trim() === nextNum && el.offsetParent !== null) {
            const clickable = el.closest('button, [role="button"], div[class*="cursor"], li') || el;
            triggerClick(clickable);
            return true;
          }
        }
      }

      const activeSlide = document.querySelector('[class*="border-blue"][class*="text-blue"], [class*="bg-blue-100"], [class*="text-blue-700"]');
      if (activeSlide) {
        const activeItem = activeSlide.closest('button, [role="button"], div[class*="cursor-pointer"], li') || activeSlide;
        const parentContainer = activeItem.parentElement;
        if (parentContainer) {
          const items = Array.from(parentContainer.children);
          const activeIdx = items.indexOf(activeItem);
          if (activeIdx !== -1 && activeIdx + 1 < items.length) {
            const nextItem = items[activeIdx + 1];
            const clickable = nextItem.querySelector('button, [role="button"]') || nextItem;
            triggerClick(clickable);
            return true;
          }
        }
      }
    } catch (e) {}
    return false;
  }

// ── Find "Trang sau" (Next Slide) button ────────────────────
  function findNextSlideButton() {
    const toolbar = typeof getNavigationToolbar === 'function' ? getNavigationToolbar() : null;
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
        if (btn.offsetParent === null && window.getComputedStyle(btn).display === 'none') continue;

        const text = (btn.textContent || '').trim().toLowerCase();
        const title = (btn.getAttribute('title') || btn.getAttribute('aria-label') || btn.parentElement?.getAttribute('label') || '').toLowerCase();

        if (
          text === 'trang sau' || text === 'trang sau >' || text.startsWith('trang sau') || text === 'sau' || text === 'next' ||
          title.includes('trang sau') || title.includes('chuyển trang')
        ) {
          return btn.closest('button, a, [role="button"]') || btn;
        }
      }

      // 4. Legacy Edux specific layout: Button following slide counter "span.text-blue-600"
      const eduxBlue = toolbar.querySelector('span.text-blue-600, span[class*="text-blue-600"]');
      if (eduxBlue) {
        const counterContainer = eduxBlue.closest('div');
        if (counterContainer) {
          let nextEl = counterContainer.nextElementSibling;
          while (nextEl) {
            const innerBtn = nextEl.tagName === 'BUTTON' ? nextEl : nextEl.querySelector('button, [role="button"]');
            if (innerBtn && !innerBtn.classList.contains('text-green-500') && !innerBtn.classList.contains('border-green-500')) {
              return innerBtn;
            }
            nextEl = nextEl.nextElementSibling;
          }
        }
      }
    }

    // Direct fallback selector
    const directFallback = document.querySelector('button[title*="Trang sau"], button[aria-label*="Trang sau"]');
    if (directFallback) return directFallback;

    // Chevron right in dialog fallback
    const dialog = document.querySelector('div[role="dialog"][data-state="open"], div[role="dialog"]');
    if (dialog) {
      const chevronBtn = Array.from(dialog.querySelectorAll('button')).find(b => 
        !b.classList.contains('text-green-500') && !b.classList.contains('border-green-500') &&
        b.querySelector('svg.lucide-chevron-right, svg[class*="chevron-right"], svg path[d*="m9 18"]')
      );
      if (chevronBtn) return chevronBtn;
    }

    return null;
  }

// ── Main Slide Step Runner ──────────────────────────────────
  async function runSlideStep() {
    if (!isSlideRunning) return;

    try {
      checkAndSyncLectureContext();

      // ── CASE A: Inside Classroom Quiz (Ảnh 2) ────────────────
      if (isInsideClassroomQuiz()) {
        const progress = getQuizProgress();
        const progText = progress ? ` (${progress.correct}/${progress.total} câu đúng)` : '';

        // A1: Quiz fully completed (Tiến độ đủ e.g. 2/2 hoặc hiện nút "Trang sau")
        // User: "Fix lỗi điền đáp án trong phải nhấn kiểm tra đến khi tiến độ đủ , đến khi nút kiểm tra hiện Trang sau"
        if (isQuizCompleted()) {
          const slideInfo = getSlideCounter();
          const targetSlide = lastActiveSlideNumber || (slideInfo && slideInfo.current);
          if (targetSlide) {
            completedQuizSlides.add(targetSlide);
          }

          // Debounce: prevent duplicate exit log spam within 800ms
          const now = Date.now();
          if (now - lastQuizExitTime < 800) {
            slideTimer = setTimeout(runSlideStep, 250);
            return;
          }
          lastQuizExitTime = now;

          sendSlideLog(`🎉 Đã hoàn thành toàn bộ bài tập${progText}! Đang quay lại bài giảng để sang slide tiếp theo...`, 'success', 'running');

          // Priority 1: Click "Trang sau" button inside the quiz (Edux transforms "Kiểm tra" into "Trang sau")
          const quizNextSlideBtn = findQuizNextSlideButton();
          if (quizNextSlideBtn && isButtonEnabled(quizNextSlideBtn)) {
            triggerClick(quizNextSlideBtn);
            slideTimer = setTimeout(runSlideStep, 350);
            return;
          }

          // Fallback 1: Click "Bỏ qua" countdown if present
          const skipBtn = typeof findQuizSkipCountdownButton === 'function' ? findQuizSkipCountdownButton() : null;
          if (skipBtn && isButtonEnabled(skipBtn)) {
            triggerClick(skipBtn);
            slideTimer = setTimeout(runSlideStep, 150);
            return;
          }

          // Fallback 2: Click quiz back button (< at top left of modal - Ảnh người dùng)
          const backBtn = findQuizBackButton();
          if (backBtn && isButtonEnabled(backBtn)) {
            triggerClick(backBtn);
            // Backup fallback: if modal still active after 350ms, dispatch Escape
            setTimeout(() => {
              if (isInsideClassroomQuiz()) {
                document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', keyCode: 27, which: 27, bubbles: true, cancelable: true }));
              }
            }, 350);
            slideTimer = setTimeout(runSlideStep, 450);
            return;
          }

          // Fallback 3: Modal dismissal via Escape key event
          document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', keyCode: 27, which: 27, bubbles: true, cancelable: true }));
          slideTimer = setTimeout(runSlideStep, 450);
          return;
        }

        // A2: Check if current answer outcome was evaluated as WRONG ("Thử lại" / "Đổi câu hỏi")
        // User: "( còn nếu làm sau hiện thử lại thì nhấn vào đó làm lại rồi tiếp tục vòng tuần hoàn như thế )"
        const answerStatus = getQuizAnswerStatus();
        const retryBtn = typeof findQuizRetryButton === 'function' ? findQuizRetryButton() : null;
        if (answerStatus === 'wrong' || (retryBtn && isButtonEnabled(retryBtn))) {
          // 1. Detect if Edux highlighted the correct answer in GREEN (e.g. Option B in screenshot)
          const revealedCorrect = typeof findRevealedCorrectOptionLetter === 'function' ? findRevealedCorrectOptionLetter() : null;
          if (revealedCorrect) {
            lastRevealedCorrectAnswer = revealedCorrect;
            const currentQ = (scanQuestions() || scanClassroomQuizQuestion() || [])[0];
            lastRevealedQuestionText = currentQ ? currentQ.questionText : '';
            sendSlideLog(`🎯 Phát hiện đáp án đúng hệ thống vừa chỉ ra: [${revealedCorrect}]!`, 'success', 'quiz');
          }

          // 2. PRIORITY 1: Click "Thử lại" button to retry this question
          if (retryBtn && isButtonEnabled(retryBtn)) {
            sendSlideLog(`🔄 Đáp án chưa đúng${progText} — Đang tự động nhấn nút "Thử lại" để làm lại...`, 'warning', 'quiz');
            triggerClick(retryBtn);
            slideTimer = setTimeout(runSlideStep, 200);
            return;
          }

          // 3. PRIORITY 2: Fallback to "Đổi câu hỏi" if "Thử lại" is not present
          const changeBtn = typeof findChangeQuestionButton === 'function' ? findChangeQuestionButton() : null;
          if (changeBtn && isButtonEnabled(changeBtn)) {
            sendSlideLog(`🔄 Không có nút "Thử lại" — Đang nhấn "Đổi câu hỏi"${progText}...`, 'warning', 'quiz');
            triggerClick(changeBtn);
            slideTimer = setTimeout(runSlideStep, 200);
            return;
          }
        }

        // A3: If countdown "Bỏ qua" or "Câu tiếp theo" button is present (after answering correctly, moving to next Q)
        const skipBtn = typeof findQuizSkipCountdownButton === 'function' ? findQuizSkipCountdownButton() : null;
        if (skipBtn && isButtonEnabled(skipBtn)) {
          sendSlideLog(`⚡ Nhấn "Bỏ qua" đếm ngược để chuyển câu siêu tốc${progText}...`, 'info', 'quiz');
          triggerClick(skipBtn);
          slideTimer = setTimeout(runSlideStep, 150);
          return;
        }

        const nextQBtn = findQuizNextQuestionButton();
        if (nextQBtn && isButtonEnabled(nextQBtn)) {
          sendSlideLog(`✅ Đang chuyển sang câu hỏi tiếp theo${progText}...`, 'info', 'quiz');
          triggerClick(nextQBtn);
          slideTimer = setTimeout(runSlideStep, 150);
          return;
        }

        // A4: DIRECT CHECK: Is "Kiểm tra" button active and ready to submit?
        // User: "Fix lỗi điền đáp án trong phải nhấn kiểm tra đến khi tiến độ đủ"
        const checkBtnDirect = findCheckQuizButton();
        if (checkBtnDirect && isButtonEnabled(checkBtnDirect)) {
          sendSlideLog(`✔️ Đã có đáp án được chọn${progText} -> Đang nhấn nút "Kiểm tra"...`, 'info', 'quiz');
          triggerClick(checkBtnDirect);
          await new Promise(r => setTimeout(r, 600));
          // If "Kiểm tra" button is still enabled after 400ms, click once more to ensure submit registered
          const checkBtnStill = findCheckQuizButton();
          if (checkBtnStill && isButtonEnabled(checkBtnStill)) {
            triggerClick(checkBtnStill);
            await new Promise(r => setTimeout(r, 300));
          }
          slideTimer = setTimeout(runSlideStep, 200);
          return;
        }

        // A5: Unanswered question (waiting for answer selection + "Kiểm tra")
        sendSlideLog(`📝 Đang trong bài tập trên lớp${progText}. AI đang phân tích và chọn đáp án...`, 'info', 'quiz');
        await solveSingleQuizQuestion();
        slideTimer = setTimeout(runSlideStep, 250);
        return;
      }

      // ── CASE B: Slide View (Ảnh 2) ──────────────────────────
      const insideSlide = typeof isInsideSlideViewer === 'function' ? isInsideSlideViewer() : (getSlideCounter() !== null);
      if (insideSlide) {
        const slideInfo = getSlideCounter();
        const counterStr = slideInfo ? `Slide: ${slideInfo.current} / ${slideInfo.total}` : '';

        if (slideInfo && slideInfo.current) {
          lastActiveSlideNumber = window.__ahs_lastActiveSlideNumber = slideInfo.current;
        }

        // B1: Last slide reached
        if (slideInfo && slideInfo.current >= slideInfo.total && slideInfo.total > 0) {
          sendSlideLog(`🎉 Đã đọc xong toàn bộ bài giảng (${slideInfo.total}/${slideInfo.total})!`, 'success', 'done', counterStr);
          clearLectureKnowledge();
          stopAutoSlide();
          return;
        }

        // B2: Check Classroom Quiz Button State on this slide
        const quizBtnState = typeof getClassroomQuizButtonState === 'function'
          ? getClassroomQuizButtonState()
          : { button: findClassroomQuizButton(), state: 'none' };

        // Check if quiz on THIS slide has ALREADY been completed!
        const isQuizAlreadyDoneOnThisSlide = slideInfo && slideInfo.current && completedQuizSlides.has(slideInfo.current);

        // If quiz button is READY (has questions and enabled) AND NOT ALREADY DONE -> Click IMMEDIATELY! (< 1ms, zero stutter!)
        if (!isQuizAlreadyDoneOnThisSlide && quizBtnState.state === 'ready' && quizBtnState.button && isButtonEnabled(quizBtnState.button)) {
          sendSlideLog('🎯 Phát hiện "Trả lời trên lớp" — Đang mở bài tập ngay lập tức...', 'warning', 'quiz', counterStr);
          triggerClick(quizBtnState.button);
          slideTimer = setTimeout(runSlideStep, 200);
          return;
        }

        // If Edux is still checking questions for this slide -> wait brief 100ms and re-check smoothly
        if (!isQuizAlreadyDoneOnThisSlide && quizBtnState.state === 'checking') {
          slideTimer = setTimeout(runSlideStep, 100);
          return;
        }

        // B3: Check if slide requires answering questions (tooltip or gated signal)
        if (!isQuizAlreadyDoneOnThisSlide && isNextSlideGatedByQuiz()) {
          if (quizBtnState.button && isButtonEnabled(quizBtnState.button)) {
            sendSlideLog('🎯 Phát hiện yêu cầu bài tập — Đang mở "Trả lời trên lớp"...', 'warning', 'quiz', counterStr);
            triggerClick(quizBtnState.button);
            slideTimer = setTimeout(runSlideStep, 200);
            return;
          }
          const greenBtn = findGreenButtonInToolbar();
          if (greenBtn && isButtonEnabled(greenBtn)) {
            sendSlideLog('🎯 Tìm thấy nút "Trả lời trên lớp" → Đang mở bài tập...', 'warning', 'quiz', counterStr);
            triggerClick(greenBtn);
            slideTimer = setTimeout(runSlideStep, 200);
            return;
          }
          // Gated, but button not yet ready -> wait 100ms
          slideTimer = setTimeout(runSlideStep, 100);
          return;
        }

        // B4: Normal slide → read slide, capture content, then smoothly advance
        const nextBtn = findNextSlideButton();
        if (nextBtn && isButtonEnabled(nextBtn)) {
          sendSlideLog(`📖 Đang xem slide (${counterStr || 'tiếp theo'}). Tự động chuyển sau ${slideDelayMs / 1000}s...`, 'info', 'running', counterStr);

          // Accumulate knowledge of this slide into cache in background
          if (slideInfo && slideInfo.current && !slideKnowledgeCache.has(slideInfo.current)) {
            setTimeout(() => accumulateSlideKnowledge(slideInfo.current), 30);
          }

          slideTimer = setTimeout(() => {
            if (!isSlideRunning) return;

            // Double check if quiz became ready during reading delay
            if (!isQuizAlreadyDoneOnThisSlide) {
              const freshQuizState = typeof getClassroomQuizButtonState === 'function' ? getClassroomQuizButtonState() : null;
              if (freshQuizState && freshQuizState.state === 'ready' && freshQuizState.button && isButtonEnabled(freshQuizState.button)) {
                sendSlideLog('🎯 Slide bị khóa bởi câu hỏi — Đang mở "Trả lời trên lớp"...', 'warning', 'quiz', counterStr);
                triggerClick(freshQuizState.button);
                slideTimer = setTimeout(runSlideStep, 200);
                return;
              }
            }

            sendSlideLog(`➡️ Chuyển slide...`, 'info', 'running', counterStr);
            const currentSlideNumBefore = slideInfo ? slideInfo.current : null;
            triggerClick(nextBtn);

            // Smooth check after slide transition (160ms for React DOM update)
            setTimeout(() => {
              if (!isSlideRunning) return;

              // 1. Check if quiz modal popped up immediately
              if (isInsideClassroomQuiz()) {
                slideTimer = setTimeout(runSlideStep, 60);
                return;
              }

              // 2. Check if quiz is ready on new slide
              const afterQuizState = typeof getClassroomQuizButtonState === 'function' ? getClassroomQuizButtonState() : null;
              if (afterQuizState && afterQuizState.state === 'ready' && afterQuizState.button && isButtonEnabled(afterQuizState.button)) {
                sendSlideLog('🎯 Phát hiện "Trả lời trên lớp" — Đang mở bài tập...', 'warning', 'quiz', counterStr);
                triggerClick(afterQuizState.button);
                slideTimer = setTimeout(runSlideStep, 200);
                return;
              }

              // 3. Check if slide actually advanced
              const newSlideInfo = getSlideCounter();
              if (newSlideInfo && currentSlideNumBefore && newSlideInfo.current === currentSlideNumBefore) {
                // Click on nextBtn didn't change slide -> check if gated by quiz (and not already done)
                if (!isQuizAlreadyDoneOnThisSlide && isNextSlideGatedByQuiz()) {
                  const quizBtn = findClassroomQuizButton();
                  if (quizBtn && isButtonEnabled(quizBtn)) {
                    sendSlideLog('🎯 Slide bị khóa bởi câu hỏi — Đang nhấn "Trả lời trên lớp"...', 'warning', 'quiz', counterStr);
                    triggerClick(quizBtn);
                    slideTimer = setTimeout(runSlideStep, 200);
                    return;
                  }
                }
                // Try sidebar item click fallback
                const sidebarOk = clickNextSidebarSlideItem();
                if (sidebarOk) {
                  slideTimer = setTimeout(runSlideStep, 150);
                  return;
                }
                // Try keyboard shortcut ArrowRight
                dispatchEduxNextKey();
                slideTimer = setTimeout(runSlideStep, 180);
                return;
              }

              // Seamlessly advance to next step
              slideTimer = setTimeout(runSlideStep, 40);
            }, 160);

          }, slideDelayMs);
          return;
        }

        // B5: "Trang sau" is DISABLED on a non-last slide → 100% quiz gate on Edux!
        if (!isQuizAlreadyDoneOnThisSlide && quizBtnState.button && isButtonEnabled(quizBtnState.button)) {
          sendSlideLog('🎯 "Trang sau" bị khóa — Phát hiện "Trả lời trên lớp" → Đang mở bài tập...', 'warning', 'quiz', counterStr);
          triggerClick(quizBtnState.button);
          slideTimer = setTimeout(runSlideStep, 200);
          return;
        }

        if (!isQuizAlreadyDoneOnThisSlide) {
          const greenBtn = findGreenButtonInToolbar();
          if (greenBtn && isButtonEnabled(greenBtn)) {
            sendSlideLog('🎯 Tìm thấy nút "Trả lời trên lớp" → Đang mở bài tập...', 'warning', 'quiz', counterStr);
            triggerClick(greenBtn);
            slideTimer = setTimeout(runSlideStep, 200);
            return;
          }
        }

        // If quiz button is checking, wait 100ms
        if (quizBtnState.state === 'checking') {
          slideTimer = setTimeout(runSlideStep, 100);
          return;
        }

        // Fallback: sidebar click
        const sidebarNavigated = clickNextSidebarSlideItem();
        if (sidebarNavigated) {
          sendSlideLog('⏭️ Đã chuyển sang slide kế tiếp từ danh sách!', 'success', 'running', counterStr);
          slideTimer = setTimeout(runSlideStep, 180);
          return;
        }

        // Last resort: brief wait then re-check
        slideTimer = setTimeout(runSlideStep, 150);
        return;
      }

      // ── CASE C: Outside Slide Viewer (Course List Page) ──────
      // Looking strictly for BLUE "Bài giảng AI" button (Ảnh 1)
      // TUYỆT ĐỐI BỎ QUA nút "Bài giảng" màu xanh lá cây (Ảnh 3)
      const aiLectureBtn = typeof findAiLectureButton === 'function' ? findAiLectureButton() : null;
      if (aiLectureBtn && isButtonEnabled(aiLectureBtn)) {
        sendSlideLog('📺 Phát hiện nút "Bài giảng AI" màu xanh (Ảnh 1) → Đang nhấn để vào slide bài giảng...', 'success', 'running');
        triggerClick(aiLectureBtn);
        slideTimer = setTimeout(runSlideStep, 600);
        return;
      }

      sendSlideLog('⏳ Đang đợi vào trang slide bài giảng (Ảnh 2)...', 'info', 'running');
      slideTimer = setTimeout(runSlideStep, 500);

    } catch (err) {
      sendSlideLog(`❌ Lỗi trong tiến trình: ${err.message}`, 'danger', 'ready');
      stopAutoSlide();
    }
  }

  // Solve single question in Quiz mode
  async function solveSingleQuizQuestion() {
    let questions = scanQuestions();
    if (!questions || questions.length === 0) {
      questions = scanClassroomQuizQuestion();
    }
    if (!questions || questions.length === 0) {
      sendSlideLog('⏳ Đang đợi câu hỏi tải lên...', 'info', 'quiz');
      return;
    }

    const q = questions[0];
    const preview = q.questionText.length > 40 ? q.questionText.slice(0, 40) + '...' : q.questionText;

    try {
      let letter = null;

      // Fast check: If we already have the confirmed correct answer from Edux's green highlight
      if (lastRevealedCorrectAnswer && (!lastRevealedQuestionText || lastRevealedQuestionText === q.questionText)) {
        letter = lastRevealedCorrectAnswer;
        lastRevealedCorrectAnswer = null; // Clear once consumed
        lastRevealedQuestionText = '';
        sendSlideLog(`💡 Tự động chọn lại đáp án đúng [${letter}] đã được hệ thống chỉ ra!`, 'success', 'quiz');
        await fillAnswer(0, letter, letter);
      } else {
        lastRevealedCorrectAnswer = null;
        lastRevealedQuestionText = '';

        sendSlideLog(`🤔 Đang gửi câu hỏi cho AI: "${preview}"`, 'info', 'quiz');

        const slideContext = (typeof getAccumulatedSlideContext === 'function' ? getAccumulatedSlideContext(MAX_SLIDE_CONTEXT_LENGTH) : '') ||
                             (typeof captureSlideContent === 'function' ? captureSlideContent() : '');
        if (slideContext) {
          sendSlideLog(`📚 Kèm kiến thức từ các slide đã học (${slideKnowledgeCache.size} slides) cho AI`, 'info', 'quiz');
        }

        const res = await new Promise((resolve) => {
          chrome.runtime.sendMessage({
            type: 'ASK_GEMINI',
            question: q.questionText,
            options: q.options,
            questionType: q.questionType,
            slideContext: slideContext
          }, resolve);
        });

        if (res?.error) {
          sendSlideLog(`❌ AI lỗi: ${res.error}`, 'danger', 'quiz');
          return;
        }

        letter = extractAnswerLetter(res.answer);
        sendSlideLog(`💡 AI chọn: [${letter || 'X'}] -> Đang tự động điền đáp án...`, 'success', 'quiz');
        await fillAnswer(0, res.answer, letter);
      }

      // CRITICAL: Wait for Edux / React state to update and enable "Kiểm tra" button
      // Poll every 75ms for up to 1500ms (20 attempts)
      let checkBtn = null;
      for (let attempt = 0; attempt < 20; attempt++) {
        const btn = findCheckQuizButton();
        if (btn) {
          checkBtn = btn;
          if (isButtonEnabled(btn)) {
            break;
          }
        }
        await new Promise(r => setTimeout(r, 75));
      }

      if (checkBtn) {
        sendSlideLog('✔️ Đã chọn đáp án -> Đang nhấn nút "Kiểm tra"...', 'info', 'quiz');
        triggerClick(checkBtn);

        // Verification & Retry: If "Kiểm tra" button remains active after 400ms, click again
        await new Promise(r => setTimeout(r, 400));
        const checkBtnStillThere = findCheckQuizButton();
        if (checkBtnStillThere && isButtonEnabled(checkBtnStillThere)) {
          triggerClick(checkBtnStillThere);
        }

        // Wait for Edux backend evaluation result
        await new Promise(r => setTimeout(r, 500));
      } else {
        sendSlideLog('⚠️ Không tìm thấy nút "Kiểm tra" trên trang.', 'warning', 'quiz');
      }

    } catch (e) {
      sendSlideLog(`❌ Lỗi khi giải câu hỏi: ${e.message}`, 'danger', 'quiz');
    }
  }

  // Export navigation & slide automation methods to global window for floating toolbar & controllers
  window.__ahs_startAutoSlide = startAutoSlide;
  window.__ahs_stopAutoSlide = stopAutoSlide;
  window.__ahs_getSlideStatus = getSlideStatus;
  window.__ahs_solveSingleQuizQuestion = solveSingleQuizQuestion;
  window.__ahs_runSlideStep = runSlideStep;


