/* ============================================================
   Side Panel — API, Solving Engine & Chrome Background Bridge
   ============================================================ */

// ── Settings Management ──────────────────────────────────────
async function loadSettings() {
  const response = await chrome.runtime.sendMessage({ type: 'GET_API_KEY' });

  // Rebuild danh sách nguồn AI (nguồn tích hợp + nguồn tùy chỉnh của người dùng)
  const customProviders = response?.customProviders || [];
  if (typeof setCustomProvidersCache === 'function') {
    setCustomProvidersCache(customProviders);
    rebuildProviderOptions(customProviders);
  }

  let provider = response?.apiProvider || '9router';
  const isValidProvider = provider === '9router' || provider === 'gemini' || provider.startsWith('custom:');
  if (!isValidProvider) provider = '9router';

  if (endpointInput && response?.apiEndpoint) {
    endpointInput.value = response.apiEndpoint;
  }
  if (response?.apiKey) {
    apiKeyInput.value = response.apiKey;
  }
  if (response?.geminiModel && modelInput) {
    modelInput.value = response.geminiModel;
  }

  if (providerSelect) {
    providerSelect.value = provider;
  }
  updateProviderUI(provider);

  // Nguồn tùy chỉnh: applyProviderUIState đã điền dữ liệu riêng của nguồn vào form
  const activeCustom = (typeof findCustomProvider === 'function') ? findCustomProvider(provider) : null;

  // No usable key set — auto-open settings (API local không bắt buộc key)
  const hasUsableKey = activeCustom
    ? (activeCustom.kind === 'openai' ? true : !!activeCustom.apiKey)
    : !!response?.apiKey;
  if (!hasUsableKey && settingsPanel) settingsPanel.classList.remove('hidden');

  // Load floating bar & web grounding visibility preference
  try {
    const store = await chrome.storage.local.get(['ahs_floating_bar_visible', 'enableWebGrounding']);
    const isVisible = store && typeof store.ahs_floating_bar_visible !== 'undefined'
      ? store.ahs_floating_bar_visible === true
      : true; // Default: true (hiện ngay trên web)
    updateFloatingBarToggles(isVisible);

    if (toggleWebGrounding) {
      toggleWebGrounding.checked = store && typeof store.enableWebGrounding !== 'undefined'
        ? store.enableWebGrounding === true
        : true; // Default: true (mặc định bật tra cứu mở rộng)
    }
  } catch (_) {}
}

function updateFloatingBarToggles(visible) {
  if (toggleFloatingBar) toggleFloatingBar.checked = visible;
  if (toggleSlideFloatingBar) toggleSlideFloatingBar.checked = visible;
  if (btnToggleFloatingBar) {
    btnToggleFloatingBar.classList.toggle('active', visible);
    btnToggleFloatingBar.title = visible
      ? 'Đang bật Thanh nổi trên web (Nhấn để tắt)'
      : 'Đang tắt Thanh nổi trên web (Nhấn để bật)';
  }
}

async function setFloatingBarVisibility(visible) {
  updateFloatingBarToggles(visible);
  try {
    await chrome.storage.local.set({ ahs_floating_bar_visible: visible });

    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) return;

    if (!visible) {
      // Forcefully remove / hide all floating bar hosts in the tab DOM directly
      try {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: () => {
            try {
              if (typeof window.__ahs_cleanup_floating_bar === 'function') {
                window.__ahs_cleanup_floating_bar();
              }
              const hosts = document.querySelectorAll('#ahs-floating-bar-host, .ahs-dock, .ahs-mini-bar');
              hosts.forEach(el => {
                el.style.display = 'none';
                el.remove();
              });
            } catch (_) {}
          }
        });
      } catch (_) {}
    }

    // Ping or auto-inject content script if needed
    let isConnected = false;
    try {
      const pingRes = await chrome.tabs.sendMessage(tab.id, { type: 'PING' });
      isConnected = pingRes && pingRes.success;
    } catch (_) {}

    if (!isConnected && visible) {
      try {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: [
            'content/utils.js',
            'content/scanners.js',
            'content/fillers.js',
            'content/navigation.js',
            'content/auto-solver.js',
            'content/floating-bar.js',
            'content/content.js'
          ]
        });
      } catch (injectErr) {
        console.warn('Script injection failed (non-web page or restricted URL):', injectErr);
        return;
      }
    }

    await chrome.tabs.sendMessage(tab.id, {
      type: 'SET_FLOATING_BAR_VISIBILITY',
      visible: visible
    }).catch(() => {});
  } catch (err) {
    console.error('Error toggling floating bar:', err);
  }
}

async function toggleFloatingBarVisibility() {
  const store = await chrome.storage.local.get(['ahs_floating_bar_visible']);
  const current = store && typeof store.ahs_floating_bar_visible !== 'undefined'
    ? store.ahs_floating_bar_visible === true
    : true;
  await setFloatingBarVisibility(!current);
}

async function saveSettings() {
  const providerId = providerSelect ? providerSelect.value : '9router';
  const isGroundingEnabled = toggleWebGrounding ? toggleWebGrounding.checked : true;
  await chrome.storage.local.set({ enableWebGrounding: isGroundingEnabled });

  // ── 1) Thêm nguồn API tùy chỉnh mới ──
  if (typeof ADD_PROVIDER_OPTION !== 'undefined' && providerId === ADD_PROVIDER_OPTION) {
    const result = await createCustomProviderFromForm();
    if (result.error) {
      showKeyStatus('❌ ' + result.error, 'error');
      return;
    }
    rebuildProviderOptions();
    const newProviderId = 'custom:' + result.entry.id;
    providerSelect.value = newProviderId;
    updateProviderUI(newProviderId);
    await chrome.runtime.sendMessage({ type: 'SAVE_API_KEY', apiProvider: newProviderId });
    showKeyStatus(`✅ Đã thêm nguồn "${result.entry.name}" và đặt làm nguồn đang dùng!`, 'success');
    setTimeout(() => {
      if (settingsPanel) settingsPanel.classList.add('hidden');
    }, 1500);
    return;
  }

  // ── 2) Cập nhật nguồn API tùy chỉnh có sẵn ──
  if (providerId.startsWith('custom:')) {
    const result = await updateCustomProviderFromForm(providerId);
    if (result.error) {
      showKeyStatus('❌ ' + result.error, 'error');
      return;
    }
    await chrome.runtime.sendMessage({ type: 'SAVE_API_KEY', apiProvider: providerId });
    showKeyStatus(`✅ Đã lưu nguồn "${result.entry.name}"!`, 'success');
    setTimeout(() => {
      if (settingsPanel) settingsPanel.classList.add('hidden');
    }, 1500);
    return;
  }

  // ── 3) Nguồn tích hợp (9Router / Gemini trực tiếp) ──
  const key = apiKeyInput.value.trim();
  if (!key) {
    showKeyStatus('Vui lòng nhập API key.', 'error');
    return;
  }

  const endpoint = endpointInput ? endpointInput.value.trim() : 'http://localhost:20128/v1';
  const selectedModel = (modelInput ? modelInput.value.trim() : '') || 'ag/gemini-3.8-flash-low';

  const response = await chrome.runtime.sendMessage({
    type: 'SAVE_API_KEY',
    apiKey: key,
    apiProvider: providerId,
    apiEndpoint: endpoint,
    geminiModel: selectedModel,
    enableWebGrounding: isGroundingEnabled
  });

  if (response?.success) {
    showKeyStatus('✅ Đã lưu cài đặt AI thành công!', 'success');
    setTimeout(() => {
      if (settingsPanel) settingsPanel.classList.add('hidden');
    }, 1500);
  } else {
    showKeyStatus('❌ Lỗi: ' + (response?.error || 'Không rõ'), 'error');
  }
}

// ── Scan Page ────────────────────────────────────────────────
async function scanPage() {
  if (typeof autoClearTimer !== 'undefined' && autoClearTimer) {
    clearTimeout(autoClearTimer);
    autoClearTimer = null;
  }

  if (!btnScan) return;
  btnScan.disabled = true;
  btnScan.innerHTML = '<span class="spinner"></span> Đang quét...';

  try {
    let response = await chrome.runtime.sendMessage({ type: 'SCAN_PAGE' });

    // If it's a True/False or Multiple Choice question with 0 options or only words Đúng/Sai,
    // wait 500ms and re-scan once (in case DOM was still settling during transition)
    if (response?.questions?.[0]) {
      const firstQ = response.questions[0];
      const isSuspectedTF = firstQ.questionType === 'true-false' ||
        /(?:đúng[\s\/\-]*sai|true[\s\/\-]*false|chọn\s+đúng\s+hoặc\s+sai|từng\s+mệnh\s+đề)/i.test(firstQ.questionText || '');
      const hasOnlySimpleWords = firstQ.options && firstQ.options.length === 2 &&
        firstQ.options.every(o => /^(?:đúng|sai|true|false|đ|s)$/i.test((o || '').trim()));

      if ((isSuspectedTF || firstQ.questionType === 'multiple-choice') &&
          (!firstQ.options || firstQ.options.length < 2 || hasOnlySimpleWords)) {
        await sleep(500);
        try {
          const retryRes = await chrome.runtime.sendMessage({ type: 'SCAN_PAGE' });
          if (retryRes?.questions?.[0]?.options?.length >= 2 && !retryRes.questions[0].options.every(o => /^(?:đúng|sai|true|false|đ|s)$/i.test((o || '').trim()))) {
            response = retryRes;
          }
        } catch (_) {}
      }
    }

    if (response?.error) {
      showEmptyState(`❌ ${response.error}`);
      return;
    }

    if (!response?.questions || response.questions.length === 0) {
      showEmptyState('Không tìm thấy câu hỏi nào trên trang này. Hãy thử mở trang bài tập cụ thể.');
      return;
    }

    if (response.counter && response.counter.total > 0) {
      detectedTotalCount = response.counter.total;
    }

    if (response.pageContent) {
      pageContentContext = response.pageContent;
      updateReferenceUI();
    }

    questions = response.questions.map((q, i) => ({
      ...q,
      index: i,
      status: 'pending',
      answer: null,
      answerLetter: null,
    }));

    renderQuestions();
    if (btnAutoAll) btnAutoAll.disabled = false;

    // If single paginated question, auto-solve and fill immediately
    if (questions.length === 1 && questions[0].status === 'pending') {
      solveQuestion(0);
    }

  } catch (err) {
    showEmptyState(`❌ Lỗi: ${err.message}`);
  } finally {
    btnScan.disabled = false;
    btnScan.innerHTML = `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
      Quét câu hỏi
    `;
  }
}

// ── Solve Single Question ────────────────────────────────────
async function solveQuestion(index) {
  const q = questions[index];
  if (!q || q.status === 'loading') return;

  q.status = 'loading';
  updateQuestionCard(index);

  try {
    const refContext = getActiveReferenceContext();
    const isOnlyTrueFalseWords = (arr) => {
      if (!arr || arr.length === 0) return true;
      return arr.length === 2 && arr.every(o => /^(?:đúng|sai|true|false|đ|s)$/i.test((o || '').trim()));
    };

    // If question text indicates True/False, ensure questionType is set properly
    if (/đúng[\s\/\-]*sai|cho\s+từng\s+mệnh\s+đề/i.test(q.questionText || '')) {
      q.questionType = 'true-false';
    }

    let qOptions = (q.options && q.options.length > 0 && !isOnlyTrueFalseWords(q.options))
      ? q.options
      : (q.statements && q.statements.length > 0 ? q.statements.map(s => s.text) : []);
    
    // Safety check for True/False questions: if options are empty or only contains words "Đúng"/"Sai", query page for live statements NOW!
    if (q.questionType === 'true-false' && (!qOptions || qOptions.length < 2 || isOnlyTrueFalseWords(qOptions))) {
      try {
        const liveRes = await chrome.runtime.sendMessage({ type: 'SCAN_PAGE' });
        if (liveRes?.questions?.[0]) {
          const freshQ = liveRes.questions[0];
          if (freshQ.options && freshQ.options.length >= 2 && !isOnlyTrueFalseWords(freshQ.options)) {
            q.options = freshQ.options;
            q.statements = freshQ.statements;
            q.isMultiStatement = freshQ.isMultiStatement;
            qOptions = freshQ.options;
          }
        }
      } catch (_) {}
    }

    // If TF question still has no extracted options or only words Đúng/Sai, parse numbered statements from question text
    if (q.questionType === 'true-false' && (!qOptions || qOptions.length < 2 || isOnlyTrueFalseWords(qOptions)) && q.questionText) {
      const numberedLineRegex = /(?:^|[\r\n]+|\s+)(\d+)[\.\)\:\-–—]\s*(.{8,})/g;
      let match;
      const extractedStatements = [];
      while ((match = numberedLineRegex.exec(q.questionText)) !== null) {
        let stmtText = match[2].split(/(?:\s+\d+[\.\)\:\-–—]\s*)/)[0].replace(/\s*(đúng|sai|true|false)\s*$/gi, '').trim();
        if (stmtText.length >= 8) {
          extractedStatements.push(`${match[1]}. ${stmtText}`);
        }
      }
      if (extractedStatements.length >= 2) {
        qOptions = extractedStatements;
        q.options = extractedStatements;
        q.statements = extractedStatements.map((text, idx) => ({ index: idx + 1, text }));
        q.isMultiStatement = true;
        updateQuestionCard(index);
        console.log('[AutoSolver] Extracted', extractedStatements.length, 'TF statements from question text');
      }
    }
    
    const isFast = toggleFastMode ? toggleFastMode.checked : true;
    const response = await chrome.runtime.sendMessage({
      type: 'ASK_GEMINI',
      question: q.questionText,
      options: qOptions,
      questionType: q.questionType,
      slideContext: refContext,
      fastMode: isFast,
    });

    if (response?.error) {
      q.status = 'error';
      q.errorMsg = response.error;
      updateQuestionCard(index);
      return;
    }

    q.answer = response.answer;
    const isMultiTF = q.isMultiStatement || (q.questionType === 'true-false' && qOptions && qOptions.length >= 2);
    q.isMultiStatement = isMultiTF;
    const isChoiceQuestion = (q.questionType === 'multiple-choice' || q.questionType === 'multiple-select' || (q.questionType === 'true-false' && !isMultiTF));
    q.answerLetter = isChoiceQuestion ? extractAnswerLetter(response.answer) : null;
    q.hasReference = !!refContext;
    q.status = 'done';
    updateQuestionCard(index);

    // Save to history
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    await chrome.runtime.sendMessage({
      type: 'SAVE_HISTORY',
      question: q.questionText,
      answer: q.answer,
      questionType: q.questionType,
      url: tab?.url || '',
      pageTitle: tab?.title || '',
    });

    // Automatically fill answer into the webpage as soon as AI finishes answering!
    try {
      await fillAnswer(index);
    } catch (fillErr) {
      console.warn('[AutoSolver] Auto-fill after solve failed:', fillErr);
    }

    // If all questions are finished and not in auto-all loop, schedule clean up
    if (!isProcessing && typeof scheduleAutoClearData === 'function') {
      const allFinished = questions.length > 0 && questions.every(item => item.status === 'done' || item.status === 'filled');
      if (allFinished) {
        scheduleAutoClearData(3500);
      }
    }

  } catch (err) {
    q.status = 'error';
    q.errorMsg = err.message;
    updateQuestionCard(index);
  }
}

// ── Helper: Wait for question DOM to settle (active polling for React SPAs) ────
async function waitForQuestionReady(previousQuestionText = '', maxWaitMs = 5000) {
  const startTime = Date.now();
  let bestResponse = null;

  while (Date.now() - startTime < maxWaitMs) {
    if (!isProcessing) break;
    try {
      const res = await chrome.runtime.sendMessage({ type: 'SCAN_PAGE' });
      if (res?.questions?.length > 0) {
        bestResponse = res;
        const q = res.questions[0];

        // Ensure we are not looking at the old question while the SPA is transitioning
        const cleanPrev = (previousQuestionText || '')
          .replace(/^(?:câu|question)\s*\d+[\s\:\.\-]*/i, '')
          .replace(/^[:\s]+/, '')
          .substring(0, 40).trim().toLowerCase();
        const cleanCurr = (q.questionText || '')
          .replace(/^(?:câu|question)\s*\d+[\s\:\.\-]*/i, '')
          .replace(/^[:\s]+/, '')
          .substring(0, 40).trim().toLowerCase();

        const isSameQuestion = previousQuestionText && cleanPrev && cleanCurr && cleanPrev === cleanCurr;

        if (isSameQuestion) {
          // Still showing old question that hasn't unmounted yet, wait
          await sleep(300);
          continue;
        }

        const isTF = q.questionType === 'true-false' ||
          /đúng[\s\/\-]*sai|cho\s+từng\s+mệnh\s+đề|các\s+phát\s+biểu|tính\s+chất\s+của|mỗi\s+nhận\s+định|xem\s+xét\s+các/i.test(q.questionText || '');
        const isChoice = q.questionType === 'multiple-choice' || q.questionType === 'multiple-select';

        // For True/False questions, wait until statements are mounted (at least 2 statements, not just the words Đúng/Sai)
        if (isTF) {
          const hasRealOptions = q.options && q.options.length >= 2 && !q.options.every(o => /^(?:đúng|sai|true|false|đ|s)$/i.test((o || '').trim()));
          const hasStatements = q.statements && q.statements.length >= 2;
          if (hasRealOptions || hasStatements) {
            return res;
          }
          await sleep(250);
          continue;
        } else if (isChoice) {
          if (q.options && q.options.length >= 2) {
            return res;
          }
          await sleep(250);
          continue;
        } else {
          return res;
        }
      }
    } catch (_) {}

    await sleep(250);

  }

  return bestResponse;
}

// ── Auto Solve All (runs persistently in Content Script on the LMS page) ──
async function autoSolveAll() {
  if (isProcessing) {
    await stopAutoSolveAll();
    return;
  }

  isProcessing = true;
  processedCount = 0;

  if (btnAutoAll) {
    btnAutoAll.disabled = false;
    btnAutoAll.innerHTML = '⏹️ Dừng lại';
    btnAutoAll.classList.add('btn-danger');
  }
  if (btnScan) btnScan.disabled = true;

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) {
      showToast('❌ Không tìm thấy tab đang mở!');
      throw new Error('No active tab');
    }

    // Ensure content script is loaded
    try {
      await chrome.tabs.sendMessage(tab.id, { type: 'PING' });
    } catch (_) {
      await chrome.runtime.sendMessage({ type: 'SCAN_PAGE' });
    }

    const config = {
      autoNext: toggleAutoNext ? toggleAutoNext.checked : true,
      fastMode: toggleFastMode ? toggleFastMode.checked : true,
      refContext: getActiveReferenceContext()
    };

    // Start background persistent engine in content script
    const res = await chrome.tabs.sendMessage(tab.id, {
      type: 'START_AUTO_SOLVER',
      config
    });

    if (res?.success) {
      showProgress(0, detectedTotalCount || 40, '🚀 Đang giải bài tập tự động trong nền...');
      showToast('⚡ Đã bắt đầu tự động giải! Bạn có thể tắt tool/chuyển tab, bài vẫn tiếp tục giải!');
    } else {
      throw new Error(res?.error || 'Không thể khởi động tiến trình ngầm');
    }
  } catch (err) {
    console.warn('[AutoSolver] Content script start failed, running local runner:', err);
    runLocalAutoSolveAll();
  }
}

async function stopAutoSolveAll() {
  isProcessing = false;
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id) {
      await chrome.tabs.sendMessage(tab.id, { type: 'STOP_AUTO_SOLVER' });
    }
  } catch (_) {}

  hideProgress();
  if (btnAutoAll) {
    btnAutoAll.disabled = false;
    btnAutoAll.innerHTML = '<span class="spark-icon">⚡</span><span>Auto All</span>';
    btnAutoAll.classList.remove('btn-danger');
  }
  if (btnScan) btnScan.disabled = false;
  showToast('⏹️ Đã dừng tự động giải bài tập.');
}

// ── Handle live progress events from background engine ────────
function handleSolverProgressEvent(event) {
  if (!event) return;

  if (event.status === 'starting' || event.status === 'scanning' || event.status === 'solving') {
    isProcessing = true;
    if (btnAutoAll) {
      btnAutoAll.disabled = false;
      btnAutoAll.innerHTML = '⏹️ Dừng lại';
      btnAutoAll.classList.add('btn-danger');
    }
    if (btnScan) btnScan.disabled = true;

    const curr = (event.current || 1) - 1;
    const total = event.total || detectedTotalCount || 40;
    showProgress(curr, total, event.message || `Đang giải câu ${event.current}/${total}...`);

    if (event.questionText) {
      const existingIdx = questions.findIndex(q =>
        q.questionText && q.questionText.substring(0, 60) === event.questionText.substring(0, 60)
      );
      if (existingIdx === -1) {
        questions.push({
          index: questions.length,
          questionText: event.questionText,
          options: event.options || [],
          status: 'loading',
          answer: null,
          answerLetter: null
        });
        renderQuestions();
      } else {
        questions[existingIdx].status = 'loading';
        updateQuestionCard(existingIdx);
      }
    }
  } else if (event.status === 'filled') {
    const curr = event.current || 1;
    const total = event.total || detectedTotalCount || 40;
    showProgress(curr, total, event.message || `Đã điền câu ${curr}/${total}`);

    if (questions.length > 0) {
      const lastQ = questions[questions.length - 1];
      if (lastQ) {
        lastQ.status = 'filled';
        lastQ.answer = event.answer || lastQ.answer;
        lastQ.answerLetter = event.answerLetter || lastQ.answerLetter;
        updateQuestionCard(questions.length - 1);
      }
    }
  } else if (event.status === 'navigating') {
    const curr = event.current || 1;
    const total = event.total || detectedTotalCount || 40;
    showProgress(curr, total, event.message || `Chuyển sang câu ${curr + 1}...`);
  } else if (event.status === 'completed') {
    isProcessing = false;
    hideProgress();
    if (btnAutoAll) {
      btnAutoAll.disabled = false;
      btnAutoAll.innerHTML = '<span class="spark-icon">⚡</span><span>Auto All</span>';
      btnAutoAll.classList.remove('btn-danger');
    }
    if (btnScan) btnScan.disabled = false;
    showToast(`🎉 Tự động giải hoàn tất! (${event.completedCount || event.total}/${event.total || 40} câu)`);
    if (typeof scheduleAutoClearData === 'function') {
      scheduleAutoClearData(3500);
    }
  } else if (event.status === 'stopped') {
    isProcessing = false;
    hideProgress();
    if (btnAutoAll) {
      btnAutoAll.disabled = false;
      btnAutoAll.innerHTML = '<span class="spark-icon">⚡</span><span>Auto All</span>';
      btnAutoAll.classList.remove('btn-danger');
    }
    if (btnScan) btnScan.disabled = false;
  }
}

// ── Synchronize background tasks on tool open ────────────────
async function syncBackgroundTasks() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) return;

    // 1. Sync Auto Solver Status
    try {
      const solverRes = await chrome.tabs.sendMessage(tab.id, { type: 'GET_AUTO_SOLVER_STATUS' });
      if (solverRes?.running) {
        isProcessing = true;
        if (btnAutoAll) {
          btnAutoAll.disabled = false;
          btnAutoAll.innerHTML = '⏹️ Dừng lại';
          btnAutoAll.classList.add('btn-danger');
        }
        if (btnScan) btnScan.disabled = true;
        showProgress(0, 40, '⚡ Tiến trình giải bài đang tiếp tục chạy ngầm...');
      }
    } catch (_) {}

    // 2. Sync Auto Slide Status
    try {
      const slideRes = await chrome.tabs.sendMessage(tab.id, { type: 'GET_SLIDE_STATUS' });
      if (slideRes?.running) {
        isSlideRunningState = true;
        updateSlideButtons(true);
        if (slideBadge) {
          slideBadge.textContent = 'Đang đọc slide';
          slideBadge.className = 'slide-badge running';
        }
        if (slideRes.slideInfo && slideCounter) {
          slideCounter.textContent = `${slideRes.slideInfo.current} / ${slideRes.slideInfo.total}`;
        }
        appendSlideLog('🔄 Đã kết nối lại tiến trình đọc slide đang chạy ngầm...', 'info');
      }
    } catch (_) {}
  } catch (_) {}
}

// ── Fallback Local Auto Solver ────────────────────────────────
async function runLocalAutoSolveAll() {
  processedCount = 0;
  try {
    let totalQuestions = questions.length;
    if (totalQuestions <= 1) {
      totalQuestions = (detectedTotalCount && detectedTotalCount > 1) ? detectedTotalCount : 40;
    }

    showProgress(0, totalQuestions);

    let consecutiveErrors = 0;
    const MAX_ERRORS = 3;
    let lastProcessedQuestionText = '';

    for (let i = 0; i < totalQuestions; i++) {
      if (!isProcessing) break;

      showProgress(i, totalQuestions, `Đang quét câu ${i + 1}/${totalQuestions}...`);

      let scanResponse = await waitForQuestionReady(lastProcessedQuestionText, 4500);

      if (!scanResponse || scanResponse.error || !scanResponse.questions?.length) {
        consecutiveErrors++;
        if (consecutiveErrors >= MAX_ERRORS) break;
        await sleep(1500);
        continue;
      }

      if (scanResponse.counter && scanResponse.counter.total > 0) {
        totalQuestions = scanResponse.counter.total;
        detectedTotalCount = totalQuestions;
      }

      consecutiveErrors = 0;
      if (scanResponse?.pageContent) {
        pageContentContext = scanResponse.pageContent;
        updateReferenceUI();
      }
      let currentQ = scanResponse.questions[0];

      let activeQNum = currentQ.questionNumber;
      if (!activeQNum && currentQ.questionText) {
        const m = currentQ.questionText.match(/(?:câu|question)\s*(\d+)/i);
        if (m) activeQNum = parseInt(m[1], 10);
      }

      if (activeQNum && activeQNum > 0) {
        i = activeQNum - 1;
      } else if (scanResponse.counter && scanResponse.counter.current > 0) {
        i = scanResponse.counter.current - 1;
      }

      let completedCount = i;
      if (scanResponse.counter && typeof scanResponse.counter.completed === 'number') {
        completedCount = scanResponse.counter.completed;
      }

      const existingIdx = questions.findIndex(q =>
        q.questionText.substring(0, 80) === currentQ.questionText.substring(0, 80)
      );

      let qIndex;
      let shouldSolve = true;

      if (existingIdx >= 0) {
        qIndex = existingIdx;
        const existing = questions[qIndex];
        if (currentQ.options && currentQ.options.length > 0) {
          existing.options = currentQ.options;
          existing.statements = currentQ.statements;
          existing.questionType = currentQ.questionType;
          existing.isMultiStatement = currentQ.isMultiStatement;
        }

        const isTF = (existing.questionType === 'true-false' || existing.isMultiStatement);
        const isBadTFAnswer = isTF && (
          !existing.answer ||
          /^(?:đúng|sai|true|false)$/i.test(existing.answer.trim()) ||
          (!existing.options || existing.options.length < 2 || existing.options.every(o => /^(?:đúng|sai|true|false|đ|s)$/i.test((o || '').trim())))
        );

        const isCompleted = (existing.status === 'done' || existing.status === 'filled') && existing.answer && !isBadTFAnswer;

        if (isCompleted) {
          if (existing.status !== 'filled') {
            showProgress(completedCount, totalQuestions, `Đang điền đáp án câu ${i + 1}/${totalQuestions}...`);
            await fillAnswer(qIndex);
          }
          shouldSolve = false;
        } else {
          existing.status = 'pending';
          existing.answer = null;
          existing.answerLetter = null;
          shouldSolve = true;
        }
      } else {
        qIndex = questions.length;
        questions.push({
          ...currentQ,
          index: qIndex,
          status: 'pending',
          answer: null,
          answerLetter: null,
        });
        shouldSolve = true;
      }

      renderQuestions();

      if (shouldSolve) {
        showProgress(completedCount, totalQuestions, `Đang hỏi Gemini câu ${i + 1}/${totalQuestions}...`);
        await solveQuestion(qIndex);

        if ((questions[qIndex].status === 'done' || questions[qIndex].status === 'filled') && questions[qIndex].answer) {
          if (questions[qIndex].status !== 'filled') {
            showProgress(completedCount, totalQuestions, `Đang điền đáp án câu ${i + 1}/${totalQuestions}...`);
            await fillAnswer(qIndex);
          }

          if (questions[qIndex].status !== 'filled') {
            await sleep(500);
            await fillAnswer(qIndex);
          }

          if (questions[qIndex].status === 'filled') {
            processedCount++;
            showProgress(completedCount + 1, totalQuestions, `Đã điền câu ${i + 1}/${totalQuestions}`);
            await sleep(800);
          } else {
            showProgress(completedCount, totalQuestions, `⚠️ Chưa điền được câu ${i + 1}`);
            await sleep(1000);
          }
        }
      }

      lastProcessedQuestionText = currentQ.questionText || '';

      if (toggleAutoNext && toggleAutoNext.checked && i < totalQuestions - 1) {
        // Fix Onimi/9Router chập chờn: chưa điền được 1 câu thì BỎ QUA chạy tiếp,
        // không break cả loạt (chỉ dừng khi lỗi quét liên tiếp quá nhiều).
        if (questions[qIndex].status !== 'filled') {
          showProgress(completedCount, totalQuestions, `⚠️ Bỏ qua câu ${i + 1} (chưa điền được), chạy tiếp...`);
          await sleep(1000);
        } else {
          await sleep(800);
        }
        const navResult = await navigateToNext();
        if (!navResult?.success) {
          // Không chuyển câu được (hết đề / không có nút Next) thì nghỉ
          if (consecutiveErrors >= MAX_ERRORS) break;
          consecutiveErrors++;
          showProgress(completedCount, totalQuestions, `⚠️ Không chuyển được sang câu tiếp theo, thử lại...`);
          await sleep(1500);
          continue;
        }
        await sleep(1200);
      } else {
        await sleep(1000);
      }
    }
  } catch (err) {
    console.error('[AutoSolver] Local Auto All error:', err);
  } finally {
    hideProgress();
    isProcessing = false;
    if (btnAutoAll) {
      btnAutoAll.disabled = false;
      btnAutoAll.innerHTML = '<span class="spark-icon">⚡</span><span>Auto All</span>';
      btnAutoAll.classList.remove('btn-danger');
    }
    if (btnScan) btnScan.disabled = false;

    if (typeof scheduleAutoClearData === 'function') {
      scheduleAutoClearData(2800);
    }
  }
}

// ── Navigate to next question ────────────────────────────────
async function navigateToNext() {
  try {
    return await chrome.runtime.sendMessage({ type: 'NAVIGATE_NEXT' });
  } catch (err) {
    return { error: err.message };
  }
}

// ── Fill Answer ──────────────────────────────────────────────
async function fillAnswer(index) {
  const q = questions[index];
  if (!q || !q.answer) return;

  try {
    const response = await chrome.runtime.sendMessage({
      type: 'FILL_ANSWER',
      questionIndex: index,
      answer: q.answer,
      answerLetter: q.answerLetter,
    });

    if (response?.success) {
      q.status = 'filled';
      updateQuestionCard(index);
      showToast(`📝 Đã điền câu ${index + 1} vào trang làm bài!`);
    } else if (response?.error) {
      showToast(`⚠️ Không thể điền: ${response.error}`);
      console.warn('Fill error:', response.error);
    }
  } catch (err) {
    showToast(`⚠️ Lỗi điền: ${err.message}`);
    console.warn('Fill error:', err.message);
  }
}

// ── Copy Answer ──────────────────────────────────────────────
async function copyAnswer(index) {
  const q = questions[index];
  if (!q || !q.answer) return;

  try {
    await navigator.clipboard.writeText(q.answer);
    showToast(`📋 Đã sao chép câu ${index + 1}!`);
    const btn = document.querySelector(`[data-action="copy"][data-index="${index}"]`);
    if (btn) {
      const original = btn.innerHTML;
      btn.innerHTML = '<span>✅ Đã copy!</span>';
      setTimeout(() => { btn.innerHTML = original; }, 1500);
    }
  } catch (err) {
    console.warn('Copy error:', err.message);
  }
}

// ── History ──────────────────────────────────────────────────
async function loadHistory() {
  try {
    const response = await chrome.runtime.sendMessage({ type: 'GET_HISTORY' });
    const history = response?.history || [];

    if (!historyContainer) return;

    if (history.length === 0) {
      historyContainer.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">📋</div>
          <p>Chưa có lịch sử</p>
        </div>
      `;
      return;
    }

    historyContainer.innerHTML = '';
    for (const item of history) {
      const el = document.createElement('div');
      el.className = 'history-item';

      const time = new Date(item.timestamp).toLocaleString('vi-VN');

      el.innerHTML = `
        <div class="history-meta">
          <span>🕐 ${time}</span>
          <span class="question-type-badge badge-${getBadgeClass(item.questionType)}">${item.questionType}</span>
        </div>
        <div class="history-question">${escapeHtml(truncate(item.question, 200))}</div>
        <div class="history-answer">${escapeHtml(truncate(item.answer, 300))}</div>
      `;

      historyContainer.appendChild(el);
    }
  } catch (err) {
    console.warn('History load error:', err.message);
  }
}

async function clearHistory() {
  if (!confirm('Bạn có chắc muốn xóa toàn bộ lịch sử?')) return;

  await chrome.runtime.sendMessage({ type: 'CLEAR_HISTORY' });
  await loadHistory();
}

// ── Slide Reader Automation (Sidepanel Controller) ───────────
async function startSlideAutomation() {
  const delayMs = parseInt(slideDelaySelect ? slideDelaySelect.value : 500);
  const autoQuiz = toggleSlideAutoQuiz ? toggleSlideAutoQuiz.checked : true;

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) {
      appendSlideLog('❌ Không tìm thấy tab đang mở!', 'danger');
      return;
    }

    // Ensure content script is ready
    try {
      await chrome.tabs.sendMessage(tab.id, { type: 'PING' });
    } catch (e) {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: [
          'content/utils.js',
          'content/scanners.js',
          'content/fillers.js',
          'content/navigation.js',
          'content/auto-solver.js',
          'content/floating-bar.js',
          'content/content.js'
        ]
      });
    }

    const res = await chrome.tabs.sendMessage(tab.id, {
      type: 'START_AUTO_SLIDE',
      config: { delayMs, autoQuiz }
    });

    if (res?.success) {
      isSlideRunningState = true;
      updateSlideButtons(true);
      if (slideBadge) {
        slideBadge.textContent = 'Đang chạy';
        slideBadge.className = 'slide-badge running';
      }
      appendSlideLog('🚀 Đã bắt đầu tiến trình tự động học slide & giải bài tập...', 'info');
    } else {
      appendSlideLog('❌ Không thể khởi động tiến trình!', 'danger');
    }
  } catch (err) {
    appendSlideLog(`❌ Lỗi kết nối tab: ${err.message}`, 'danger');
  }
}

async function stopSlideAutomation() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id) {
      await chrome.tabs.sendMessage(tab.id, { type: 'STOP_AUTO_SLIDE' });
    }
  } catch (e) {}

  isSlideRunningState = false;
  updateSlideButtons(false);
  if (slideBadge) {
    slideBadge.textContent = 'Đã dừng';
    slideBadge.className = 'slide-badge';
  }
  if (slideStatusText) slideStatusText.textContent = 'Tiến trình tự động đã dừng.';
  appendSlideLog('⏹️ Đã dừng tự động đọc slide.', 'warning');
}
