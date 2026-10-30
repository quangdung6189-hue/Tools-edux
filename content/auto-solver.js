// ── Auto Solver Engine — Background Persistent Content Script ──
// Ensures automatic homework solving continues uninterrupted
// even when the sidepanel is closed or the user switches tabs.

(function () {
  var isAutoSolverRunning = window.__ahs_isAutoSolverRunning || false;
  var currentSolverConfig = window.__ahs_currentSolverConfig || {
    autoNext: true,
    fastMode: true,
    refContext: ''
  };
  var solverHistory = window.__ahs_solverHistory || [];

  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  function isOnlyTrueFalseWords(arr) {
    if (!arr || arr.length === 0) return true;
    return arr.length === 2 && arr.every(o => /^(?:đúng|sai|true|false|đ|s)$/i.test((o || '').trim()));
  }

  function broadcastProgress(data) {
    try {
      chrome.runtime.sendMessage({
        type: 'SOLVER_PROGRESS_EVENT',
        ...data
      });
    } catch (_) {
      // Sidepanel is closed or not listening, safe to ignore
    }
  }

  async function updateStorageState(updates = {}) {
    try {
      const existing = await new Promise(resolve => {
        chrome.storage.local.get(['ahs_solver_state'], res => resolve(res?.ahs_solver_state || {}));
      });
      const newState = {
        ...existing,
        running: isAutoSolverRunning,
        lastUpdated: Date.now(),
        url: window.location.href,
        ...updates
      };
      await chrome.storage.local.set({ ahs_solver_state: newState });
    } catch (_) {}
  }

  function getAutoSolverStatus() {
    return {
      running: isAutoSolverRunning,
      config: currentSolverConfig,
      history: solverHistory,
      url: window.location.href
    };
  }

  function stopAutoSolver() {
    isAutoSolverRunning = false;
    window.__ahs_isAutoSolverRunning = false;
    updateStorageState({ running: false, stopped: true });
    broadcastProgress({ status: 'stopped', message: 'Đã dừng tự động giải bài tập.' });
    return { success: true };
  }

  // ── Wait for question DOM to transition ──────────────────────
  async function waitForNextQuestion(previousText, maxWaitMs = 6000) {
    const start = Date.now();
    let bestResponse = null;

    const normalize = (txt) => (txt || '')
      .replace(/^(?:câu|question)\s*\d+[\s\:\.\-]*/i, '')
      .replace(/^[:\s]+/, '')
      .replace(/\s+/g, ' ')
      .trim().toLowerCase();

    const cleanPrev = normalize(previousText);

    while (Date.now() - start < maxWaitMs) {
      if (!isAutoSolverRunning) return null;

      try {
        const questions = typeof scanQuestions === 'function' ? scanQuestions() : [];
        if (questions && questions.length > 0) {
          const q = questions[0];
          const counter = typeof getPageCounter === 'function' ? getPageCounter(questions) : null;
          bestResponse = { questions, counter };

          const cleanCurr = normalize(q.questionText || '');

          // Check if this is still the previous question
          const isSameText = cleanPrev && cleanCurr && (cleanPrev === cleanCurr || (cleanPrev.length > 70 && cleanCurr.startsWith(cleanPrev.slice(0, 70))));

          // Never solve the previous question again while navigation is pending.
          if (isSameText) {
            await sleep(200);
            continue;
          }

          // If question has options or statements or is a text question, return immediately
          const hasOptions = q.options && q.options.length >= 2;
          const hasStatements = q.statements && q.statements.length >= 2;
          const isTextQ = q.questionType === 'fill-in-the-blank' || q.questionType === 'short-answer';

          if (hasOptions || hasStatements || isTextQ || (Date.now() - start > 800)) {
            return bestResponse;
          }
        }
      } catch (_) {}

      await sleep(200);
    }

    return null;
  }

  // ── Main Background Auto Solver Engine ───────────────────────
  async function startAutoSolver(config = {}) {
    if (isAutoSolverRunning) {
      return { success: true, message: 'Already running' };
    }

    isAutoSolverRunning = true;
    window.__ahs_isAutoSolverRunning = true;
    currentSolverConfig = {
      autoNext: true, // Auto All always auto-navigates
      fastMode: config.fastMode !== false,
      refContext: config.refContext || ''
    };

    console.log('[AutoSolver Engine] Bắt đầu chạy ngầm với cấu hình:', currentSolverConfig);
    updateStorageState({
      running: true,
      config: currentSolverConfig,
      startedAt: Date.now()
    });

    // Run engine asynchronously in background
    runSolverLoop().catch(err => {
      console.error('[AutoSolver Engine] Lỗi tiến trình ngầm:', err);
      isAutoSolverRunning = false;
      window.__ahs_isAutoSolverRunning = false;
      updateStorageState({ running: false, error: err.message });
      broadcastProgress({ status: 'error', error: err.message });
    });

    return { success: true, running: true };
  }

  async function runSolverLoop() {
    let consecutiveErrors = 0;
    const MAX_ERRORS = 8;
    let processedCount = 0;
    let lastProcessedText = '';
    let totalQuestions = 40;

    broadcastProgress({ status: 'starting', message: '🚀 Khởi động giải bài tập ngầm...' });

    // Initial scan
    let initialScan = typeof scanQuestions === 'function' ? scanQuestions() : [];
    let initialCounter = typeof getPageCounter === 'function' ? getPageCounter(initialScan) : null;

    if (initialCounter && initialCounter.total > 0) {
      totalQuestions = initialCounter.total;
    } else if (initialScan.length > 1) {
      totalQuestions = initialScan.length;
    }

    // CASE A: Single Page with multiple questions (all questions rendered on 1 page)
    if (initialScan.length > 1) {
      console.log(`[AutoSolver Engine] Phát hiện đề thi 1 trang với ${initialScan.length} câu hỏi.`);
      totalQuestions = initialScan.length;

      for (let idx = 0; idx < initialScan.length; idx++) {
        if (!isAutoSolverRunning) break;

        const q = initialScan[idx];
        broadcastProgress({
          status: 'solving',
          current: idx + 1,
          total: totalQuestions,
          message: `Đang giải câu ${idx + 1}/${totalQuestions}...`
        });

        const result = await solveAndFillSpecific(idx, q, currentSolverConfig);
        if (!result?.success) {
          broadcastProgress({ status: 'error', current: idx + 1, message: `Không điền được câu ${idx + 1}: ${result?.error || 'Lỗi không xác định'}. Đã dừng để tránh bỏ câu.` });
          break;
        }
        processedCount++;

        updateStorageState({
          completedCount: processedCount,
          current: idx + 1,
          total: totalQuestions
        });

        broadcastProgress({
          status: 'filled',
          current: idx + 1,
          total: totalQuestions,
          message: `Đã điền câu ${idx + 1}/${totalQuestions}`
        });

        await sleep(currentSolverConfig.fastMode ? 300 : 700);
      }

      finishSolver(totalQuestions, processedCount);
      return;
    }

    // CASE B: Paginated questions (1 question per page/step)
    for (let loopIdx = 0; loopIdx < totalQuestions; loopIdx++) {
      if (!isAutoSolverRunning) break;

      broadcastProgress({
        status: 'scanning',
        current: loopIdx + 1,
        total: totalQuestions,
        message: `Đang quét câu ${loopIdx + 1}/${totalQuestions}...`
      });

      const scanResult = await waitForNextQuestion(lastProcessedText, 5000);

      if (!scanResult || !scanResult.questions || scanResult.questions.length === 0) {
        consecutiveErrors++;
        console.warn(`[AutoSolver Engine] Quét câu hỏi chưa có kết quả (lần ${consecutiveErrors}/${MAX_ERRORS}).`);
        // Try scrolling down to trigger lazy loading
        try { window.scrollBy(0, 300); } catch (_) {}
        if (consecutiveErrors >= MAX_ERRORS) {
          console.warn('[AutoSolver Engine] Đạt giới hạn thử quét câu hỏi. Tạm dừng.');
          break;
        }
        await sleep(1000);
        continue;
      }

      consecutiveErrors = 0;
      const currentQ = scanResult.questions[0];

      if (scanResult.counter && scanResult.counter.total > 0) {
        totalQuestions = scanResult.counter.total;
      }

      // Sync active question number
      let activeNum = currentQ.questionNumber;
      if (!activeNum && currentQ.questionText) {
        const m = currentQ.questionText.match(/(?:câu|question)\s*(\d+)/i);
        if (m) activeNum = parseInt(m[1], 10);
      }
      if (activeNum && activeNum > 0) {
        loopIdx = activeNum - 1;
      } else if (scanResult.counter && scanResult.counter.current > 0) {
        loopIdx = scanResult.counter.current - 1;
      }

      const displayNum = loopIdx + 1;
      lastProcessedText = currentQ.questionText || '';

      broadcastProgress({
        status: 'solving',
        current: displayNum,
        total: totalQuestions,
        questionText: currentQ.questionText,
        options: currentQ.options,
        message: `Đang hỏi AI câu ${displayNum}/${totalQuestions}...`
      });

      // Solve and fill current question
      const solveResult = await solveAndFillSpecific(0, currentQ, currentSolverConfig);

      if (solveResult?.success) {
        processedCount++;
        broadcastProgress({
          status: 'filled',
          current: displayNum,
          total: totalQuestions,
          answer: solveResult.answer,
          answerLetter: solveResult.answerLetter,
          message: `Đã điền câu ${displayNum}/${totalQuestions}`
        });
      } else {
        broadcastProgress({
          status: 'error',
          current: displayNum,
          total: totalQuestions,
          message: `Không điền được câu ${displayNum}: ${solveResult?.error || 'Lỗi không xác định'}. Đã dừng để tránh bỏ câu.`
        });
        break;
      }

      updateStorageState({
        completedCount: processedCount,
        current: displayNum,
        total: totalQuestions,
        lastAnswer: solveResult?.answer || null
      });

      // Navigate to next question if not on last question
      if (loopIdx < totalQuestions - 1) {
        await sleep(currentSolverConfig.fastMode ? 350 : 700);

        broadcastProgress({
          status: 'navigating',
          current: displayNum,
          total: totalQuestions,
          message: `Chuyển sang câu ${displayNum + 1}...`
        });

        // Navigation with up to 3 retries
        let navSuccess = false;
        let navResult = typeof navigateNext === 'function' ? navigateNext() : { error: 'No navigateNext' };
        if (navResult?.success) {
          navSuccess = true;
        } else {
          // Retry 1: Scroll to bottom in case next button is below fold
          try { window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' }); } catch (_) {}
          await sleep(500);
          navResult = typeof navigateNext === 'function' ? navigateNext() : { error: 'No navigateNext' };
          if (navResult?.success) {
            navSuccess = true;
          } else {
            // Retry 2: Wait 800ms and try one more time
            await sleep(800);
            navResult = typeof navigateNext === 'function' ? navigateNext() : { error: 'No navigateNext' };
            if (navResult?.success) navSuccess = true;
          }
        }

        if (!navSuccess) {
          console.warn('[AutoSolver Engine] Không tìm thấy nút chuyển câu sau 3 lần thử:', navResult?.error);
          broadcastProgress({
            status: 'warn',
            current: displayNum,
            total: totalQuestions,
            message: `⚠️ Không tìm thấy nút chuyển tiếp sau câu ${displayNum}. Dừng lại.`
          });
          break;
        }

        await sleep(currentSolverConfig.fastMode ? 500 : 1000);
      } else {
        await sleep(600);
        break; // Finished last question
      }
    }

    finishSolver(totalQuestions, processedCount);
  }

  async function finishSolver(total, processed) {
    isAutoSolverRunning = false;
    window.__ahs_isAutoSolverRunning = false;

    updateStorageState({
      running: false,
      completed: true,
      finishedAt: Date.now(),
      totalQuestions: total,
      completedCount: processed
    });

    broadcastProgress({
      status: 'completed',
      total: total,
      completedCount: processed,
      message: `🎉 Hoàn thành tự động giải bài! (Đã làm: ${processed}/${total})`
    });

    console.log(`[AutoSolver Engine] 🎉 Hoàn thành! Đã giải xong ${processed}/${total} câu hỏi.`);
  }

  // ── Helper: Solve and fill a specific question object ────────
  async function solveAndFillSpecific(domIndex, q, config) {
    try {
      let qOptions = (q.options && q.options.length > 0 && !isOnlyTrueFalseWords(q.options))
        ? q.options
        : (q.statements && q.statements.length > 0 ? q.statements.map(s => s.text) : []);

      // If True/False question indicates multiple statements
      if (/đúng[\s\/\-]*sai|cho\s+từng\s+mệnh\s+đề/i.test(q.questionText || '')) {
        q.questionType = 'true-false';
      }

      // Parse numbered statements if missing
      if (q.questionType === 'true-false' && (!qOptions || qOptions.length < 2 || isOnlyTrueFalseWords(qOptions)) && q.questionText) {
        const numberedLineRegex = /(?:^|[\r\n]+|\s+)(\d+)[\.\)\:\-–—]\s*(.{8,})/g;
        let match;
        const extracted = [];
        while ((match = numberedLineRegex.exec(q.questionText)) !== null) {
          let stmt = match[2].split(/(?:\s+\d+[\.\)\:\-–—]\s*)/)[0].replace(/\s*(đúng|sai|true|false)\s*$/gi, '').trim();
          if (stmt.length >= 8) extracted.push(`${match[1]}. ${stmt}`);
        }
        if (extracted.length >= 2) {
          qOptions = extracted;
          q.options = extracted;
          q.isMultiStatement = true;
        }
      }

      const refContext = config.refContext || (typeof capturePageContent === 'function' ? capturePageContent() : '');

      const aiResponse = await new Promise(resolve => {
        const timer = setTimeout(() => {
          resolve({ error: 'AI request timed out after 25s' });
        }, 25000);

        try {
          chrome.runtime.sendMessage({
            type: 'ASK_GEMINI',
            question: q.questionText,
            options: qOptions,
            questionType: q.questionType,
            slideContext: refContext,
            fastMode: config.fastMode !== false
          }, (res) => {
            clearTimeout(timer);
            resolve(res || { error: 'Empty response from AI engine' });
          });
        } catch (err) {
          clearTimeout(timer);
          resolve({ error: err.message });
        }
      });

      if (aiResponse?.error) {
        console.warn('[AutoSolver Engine] AI Error:', aiResponse.error);
        return { success: false, error: aiResponse.error };
      }

      const answer = aiResponse.answer;
      const isMultiTF = q.isMultiStatement || (q.questionType === 'true-false' && qOptions && qOptions.length >= 2 && !isOnlyTrueFalseWords(qOptions));
      const isChoice = (q.questionType === 'multiple-choice' || q.questionType === 'multiple-select' || (q.questionType === 'true-false' && !isMultiTF));
      const letter = isChoice ? (typeof extractAnswerLetter === 'function' ? extractAnswerLetter(answer) : '') : null;

      // Save History
      try {
        chrome.runtime.sendMessage({
          type: 'SAVE_HISTORY',
          question: q.questionText,
          answer: answer,
          questionType: q.questionType,
          url: window.location.href,
          pageTitle: document.title
        });
      } catch (_) {}

      // Fill Answer directly into the page DOM
      if (typeof fillAnswer !== 'function') return { success: false, error: 'Bộ điền đáp án chưa tải.' };
      let fillRes = await fillAnswer(domIndex, answer, letter);
      if (!fillRes?.success) {
        await sleep(350);
        fillRes = await fillAnswer(domIndex, answer, letter);
      }
      if (!fillRes?.success) return { success: false, error: fillRes?.error || 'Không thể điền đáp án.' };

      return {
        success: true,
        answer,
        answerLetter: letter
      };
    } catch (e) {
      console.warn('[AutoSolver Engine] solveAndFillSpecific error:', e);
      return { success: false, error: e.message };
    }
  }

  // ── Auto-Resume on Page Load ─────────────────────────────────
  try {
    chrome.storage.local.get(['ahs_solver_state'], res => {
      const state = res?.ahs_solver_state;
      if (state && state.running && (Date.now() - (state.lastUpdated || 0) < 600000)) {
        console.log('[AutoSolver Engine] Phát hiện tác vụ giải bài đang chạy ngầm, tự động tiếp tục...');
        setTimeout(() => {
          if (!isAutoSolverRunning) {
            startAutoSolver(state.config || {});
          }
        }, 1200);
      }
    });
  } catch (_) {}

  // Expose to window
  window.__ahs_startAutoSolver = startAutoSolver;
  window.__ahs_stopAutoSolver = stopAutoSolver;
  window.__ahs_getAutoSolverStatus = getAutoSolverStatus;
  window.__ahs_solveAndFillSpecific = solveAndFillSpecific;

})();
