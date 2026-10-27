import { handleAskAI } from './api.js';

/* ============================================================
   Service Worker — Auto Homework Solver
   Handles: side panel open, Gemini API calls, message routing,
            history storage, API key management
   ============================================================ */

// Open side panel when extension icon is clicked
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });

// ── Message Router ──────────────────────────────────────────
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const handlers = {
    ASK_GEMINI: () => handleAskAI(message, sendResponse),
    SAVE_API_KEY: () => handleSaveSettings(message, sendResponse),
    GET_API_KEY: () => handleGetSettings(sendResponse),
    SAVE_HISTORY: () => handleSaveHistory(message, sendResponse),
    GET_HISTORY: () => handleGetHistory(sendResponse),
    CLEAR_HISTORY: () => handleClearHistory(sendResponse),
    SCAN_PAGE: () => handleScanPage(message, sendResponse),
    FILL_ANSWER: () => handleFillAnswer(message, sendResponse),
    NAVIGATE_NEXT: () => handleNavigateNext(message, sendResponse),
  };

  const handler = handlers[message.type];
  if (handler) {
    handler();
    return true; // Keep channel open for async responses
  }
});

// ── API Key Management ──────────────────────────────────────
async function handleSaveSettings(message, sendResponse) {
  try {
    // Chỉ ghi đè trường được gửi lên — để không xóa nhầm key/model của nguồn tích hợp
    // khi người dùng chỉ chọn/lưu một nguồn API tùy chỉnh
    const dataToSave = {};
    if (message.apiKey !== undefined) dataToSave.apiKey = message.apiKey;
    if (message.geminiModel !== undefined) dataToSave.geminiModel = message.geminiModel;
    if (message.apiProvider !== undefined) dataToSave.apiProvider = message.apiProvider;
    if (message.apiEndpoint !== undefined) dataToSave.apiEndpoint = message.apiEndpoint;
    if (message.enableWebGrounding !== undefined) dataToSave.enableWebGrounding = message.enableWebGrounding;
    await chrome.storage.local.set(dataToSave);
    sendResponse({ success: true });
  } catch (err) {
    sendResponse({ error: err.message });
  }
}

async function handleGetSettings(sendResponse) {
  try {
    const { apiKey, geminiModel, apiProvider, apiEndpoint, ahs_custom_providers } = await chrome.storage.local.get([
      'apiKey', 'geminiModel', 'apiProvider', 'apiEndpoint', 'ahs_custom_providers'
    ]);

    // Auto-detect provider if not explicitly set
    let detectedProvider = apiProvider;
    if (!detectedProvider) {
      detectedProvider = (apiKey && apiKey.trim().startsWith('sk-')) ? '9router' : '9router';
    }

    // Với nguồn tùy chỉnh, model được lưu riêng trong nguồn — không đụng vào model toàn cục
    let model = geminiModel;
    if (!detectedProvider.startsWith('custom:')) {
      if (!model || model === 'gemini-2.5-flash' || model.includes('2.0-flash')) {
        model = detectedProvider === '9router' ? 'gemini-3.8-flash-high' : 'gemini-3.6-flash';
      }
    }

    sendResponse({
      apiKey: apiKey || '',
      geminiModel: model,
      apiProvider: detectedProvider,
      apiEndpoint: apiEndpoint || 'http://localhost:20128/v1',
      customProviders: Array.isArray(ahs_custom_providers) ? ahs_custom_providers : []
    });
  } catch (err) {
    sendResponse({ error: err.message });
  }
}

// ── History Management ──────────────────────────────────────
async function handleSaveHistory(message, sendResponse) {
  try {
    const { history = [] } = await chrome.storage.local.get('history');
    const entry = {
      id: Date.now(),
      timestamp: new Date().toISOString(),
      url: message.url || '',
      pageTitle: message.pageTitle || '',
      question: message.question,
      answer: message.answer,
      questionType: message.questionType || 'text',
    };
    history.unshift(entry);
    // Keep only last 200 entries
    if (history.length > 200) history.length = 200;
    await chrome.storage.local.set({ history });
    sendResponse({ success: true });
  } catch (err) {
    sendResponse({ error: err.message });
  }
}

async function handleGetHistory(sendResponse) {
  try {
    const { history = [] } = await chrome.storage.local.get('history');
    sendResponse({ history });
  } catch (err) {
    sendResponse({ error: err.message });
  }
}

async function handleClearHistory(sendResponse) {
  try {
    await chrome.storage.local.set({ history: [] });
    sendResponse({ success: true });
  } catch (err) {
    sendResponse({ error: err.message });
  }
}

// ── Ensure content script is injected ────────────────────────
async function ensureContentScript(tabId) {
  try {
    const res = await chrome.tabs.sendMessage(tabId, { type: 'PING' });
    if (!res || res.version !== '3.3') {
      throw new Error('Outdated content script');
    }
  } catch {
    // Content script not injected or outdated — inject it now
    await chrome.scripting.executeScript({
      target: { tabId },
      files: [
        'content/utils.js',
        'content/scanners.js',
        'content/fillers.js',
        'content/navigation.js',
        'content/auto-solver.js',
        'content/content.js'
      ]
    });
    await chrome.scripting.insertCSS({
      target: { tabId },
      files: ['content/content.css']
    });
    // Wait a moment for the script to initialize
    await new Promise(r => setTimeout(r, 300));
  }
}

// ── Scan Page (forward to content script) ───────────────────
async function handleScanPage(message, sendResponse) {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) {
      sendResponse({ error: 'Không tìm thấy tab đang mở.' });
      return;
    }
    await ensureContentScript(tab.id);
    const response = await chrome.tabs.sendMessage(tab.id, { type: 'SCAN_QUESTIONS' });
    sendResponse(response);
  } catch (err) {
    sendResponse({ error: `Không thể quét trang: ${err.message}` });
  }
}

// ── Fill Answer (forward to content script) ─────────────────
async function handleFillAnswer(message, sendResponse) {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) {
      sendResponse({ error: 'Không tìm thấy tab đang mở.' });
      return;
    }
    await ensureContentScript(tab.id);
    const response = await chrome.tabs.sendMessage(tab.id, {
      type: 'FILL_ANSWER',
      questionIndex: message.questionIndex,
      answer: message.answer,
      answerLetter: message.answerLetter,
    });
    sendResponse(response);
  } catch (err) {
    sendResponse({ error: `Không thể điền đáp án: ${err.message}` });
  }
}

// ── Navigate to Next Question ───────────────────────────────
async function handleNavigateNext(message, sendResponse) {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) {
      sendResponse({ error: 'Không tìm thấy tab.' });
      return;
    }
    await ensureContentScript(tab.id);
    const response = await chrome.tabs.sendMessage(tab.id, { type: 'NAVIGATE_NEXT' });
    sendResponse(response);
  } catch (err) {
    sendResponse({ error: err.message });
  }
}
