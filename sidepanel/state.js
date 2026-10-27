/* ============================================================
   Side Panel — State, DOM Elements & Shared Helpers
   ============================================================ */

// ── State Variables ──────────────────────────────────────────
let questions = [];
let isProcessing = false;
let processedCount = 0;
let detectedTotalCount = null;
let isSlideRunningState = false;

let attachedFileContent = '';
let attachedFileName = '';
let pageContentContext = '';

// ── DOM Elements ─────────────────────────────────────────────
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

const btnScan = $('#btn-scan');
const btnAutoAll = $('#btn-auto-all');
const btnSettings = $('#btn-settings');
const btnCloseSettings = $('#btn-close-settings');
const btnSaveKey = $('#btn-save-key');
const btnToggleKey = $('#btn-toggle-key');
const btnClearHistory = $('#btn-clear-history');
const providerSelect = $('#provider-select');
const groupEndpoint = $('#group-endpoint');
const endpointInput = $('#endpoint-input');
const apiKeyInput = $('#api-key-input');
const labelApiKey = $('#label-api-key');
const linkHelpKey = $('#link-help-key');
const modelInput = $('#model-input') || $('#model-select');
const customNameInput = $('#custom-name-input');
const customKindSelect = $('#custom-kind-select');
const providerPresetsWrap = $('#provider-presets');
const groupCustomEditor = $('#group-custom-editor');
const btnDeleteProvider = $('#btn-delete-provider');
const btnCancelProvider = $('#btn-cancel-provider');
const btnLoadModels = $('#btn-load-models');
const keyStatus = $('#key-status');
const settingsPanel = $('#settings-panel');
const toggleAutoNext = $('#toggle-auto-next');
const toggleFastMode = $('#toggle-fast-mode');
const toggleAutoClear = $('#toggle-auto-clear');
const btnToggleFloatingBar = $('#btn-toggle-floating-bar');
const toggleFloatingBar = $('#toggle-floating-bar');
const toggleSlideFloatingBar = $('#toggle-slide-floating-bar');
const toggleWebGrounding = $('#toggle-web-grounding');
const progressContainer = $('#progress-container');
const progressText = $('#progress-text');
const progressCount = $('#progress-count');
const progressFill = $('#progress-fill');
const questionsContainer = $('#questions-container');
const historyContainer = $('#history-container');
const tabs = $$('.tab');
const tabContents = $$('.tab-content');

// Slide Tab Elements
const btnStartSlide = $('#btn-start-slide');
const btnStopSlide = $('#btn-stop-slide');
const slideDelaySelect = $('#slide-delay-select');
const toggleSlideAutoQuiz = $('#toggle-slide-auto-quiz');
const slideBadge = $('#slide-badge');
const slideCounter = $('#slide-counter');
const slideStatusText = $('#slide-status-text');
const slideLogContainer = $('#slide-log-container');
const btnClearSlideLog = $('#btn-clear-slide-log');

// Reference / Attached File Elements
const referenceBox = $('#reference-box');
const referenceStatusText = $('#reference-status-text');
const referenceSummary = $('#reference-summary');
const btnAttachFile = $('#btn-attach-file');
const inputRefFile = $('#input-ref-file');
const btnPasteContext = $('#btn-paste-context');
const btnClearRef = $('#btn-clear-ref');
const referencePasteArea = $('#reference-paste-area');
const refTextInput = $('#ref-text-input');
const refCharCount = $('#ref-char-count');
const btnSaveRefText = $('#btn-save-ref-text');

// URL & Tab Picker Elements
const btnAddUrl = $('#btn-add-url');
const referenceUrlArea = $('#reference-url-area');
const refUrlInput = $('#ref-url-input');
const btnFetchUrl = $('#btn-fetch-url');
const btnFetchUrlText = $('#btn-fetch-url-text');
const btnFetchCurrentTab = $('#btn-fetch-current-tab');
const btnSelectOpenTab = $('#btn-select-open-tab');
const openTabsDropdown = $('#open-tabs-dropdown');
const openTabsList = $('#open-tabs-list');
const btnCloseTabsDropdown = $('#btn-close-tabs-dropdown');
const refUrlStatus = $('#ref-url-status');

// ── Shared Helpers ───────────────────────────────────────────
function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function truncate(str, maxLen) {
  if (!str) return '';
  return str.length > maxLen ? str.substring(0, maxLen) + '...' : str;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function showToast(msg) {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.innerHTML = msg;
  container.appendChild(toast);
  setTimeout(() => {
    toast.remove();
  }, 2400);
}

function getTypeBadge(type) {
  const map = {
    'multiple-choice': '<span class="question-type-badge badge-mc">🎯 Trắc nghiệm</span>',
    'multiple-select': '<span class="question-type-badge badge-mc">🎯 Nhiều đáp án</span>',
    'true-false': '<span class="question-type-badge badge-tf">⚖️ Đúng / Sai</span>',
    'text': '<span class="question-type-badge badge-text">📝 Tự luận</span>',
    'short-answer': '<span class="question-type-badge badge-text">✍️ Trả lời ngắn</span>',
    'dropdown': '<span class="question-type-badge badge-dropdown">🔽 Dropdown</span>',
  };
  return map[type] || '<span class="question-type-badge badge-text">Câu hỏi</span>';
}

function getStatusBadge(status) {
  const map = {
    'pending': '<span class="status-badge status-pending">⏸️ Chờ</span>',
    'loading': '<span class="status-badge status-loading"><span class="spinner"></span> Đang giải...</span>',
    'done': '<span class="status-badge status-done">✨ Đã giải</span>',
    'error': '<span class="status-badge status-error">❌ Lỗi</span>',
    'filled': '<span class="status-badge status-filled">📝 Đã điền</span>',
  };
  return map[status] || '';
}

function getBadgeClass(type) {
  const map = {
    'multiple-choice': 'mc',
    'multiple-select': 'mc',
    'true-false': 'tf',
    'text': 'text',
    'short-answer': 'text',
    'dropdown': 'dropdown',
  };
  return map[type] || 'text';
}

function extractAnswerLetter(answer) {
  if (!answer) return null;
  const clean = answer.trim();

  // AI có khi trả lời nhiều dòng (quá trình + kết luận) — ưu tiên dòng CUỐI (dòng kết luận)
  // trước khi quét toàn bộ, tránh nhặt nhầm chữ cái được nhắc trong phần phân tích phía trên.
  const lines = clean.split('\n').map(l => l.trim()).filter(Boolean);
  const candidates = lines.length > 1 ? [lines[lines.length - 1], clean] : [clean];

  const patterns = [
    /^(?:\*\*|\*|)?(?:đáp\s*án(?:\s*(?:đúng|chính\s*xác)?(?:[\s:]*))?|chọn[:\s]*)?\*?\*?([A-F](?:\s*,\s*[A-F])*)\b/i,
    /\b(?:đáp\s*án|chọn)(?:\s*(?:đúng|chính\s*xác)?)?[:\s]+(?:\*\*|\*|)?([A-F](?:\s*,\s*[A-F])*)\b/i,
    /^(?:\*\*|\*|)?([A-F])(?:\.|\)|\:|\b)/i,
  ];

  for (const text of candidates) {
    for (const pat of patterns) {
      const match = text.match(pat);
      if (match && match[1]) {
        return match[1].toUpperCase();
      }
    }
  }

  // Fallback: quét từng dòng TỪ DƯỚI LÊN — dòng cuối gần như luôn là kết luận
  for (let i = lines.length - 1; i >= 0; i--) {
    const m = lines[i].match(/(?:^|[\s\(\[])([A-F])(?:$|[\s\.\,\)\]:])/);
    if (m) return m[1].toUpperCase();
  }
  return null;
}

function showEmptyState(msg) {
  if (!questionsContainer) return;
  questionsContainer.innerHTML = `
    <div class="empty-state">
      <div class="empty-icon-wrapper">
        <div class="empty-icon-glow"></div>
        <div class="empty-icon">${msg ? '🔍' : '📚'}</div>
      </div>
      <h3 class="empty-title">${msg ? 'Không tìm thấy câu hỏi' : 'Chưa có câu hỏi'}</h3>
      <p class="empty-desc">${msg || 'Mở trang bài tập trên trình duyệt và nhấn <strong class="highlight-text">"Quét câu hỏi"</strong> để bắt đầu.'}</p>
    </div>
  `;
}

function showKeyStatus(msg, type) {
  if (!keyStatus) return;
  keyStatus.textContent = msg;
  keyStatus.className = `status-msg ${type}`;
  showToast(type === 'success' ? '✅ Đã lưu cài đặt AI!' : '⚠️ ' + msg);
  setTimeout(() => { keyStatus.textContent = ''; }, 4000);
}

function updateSlideButtons(running) {
  if (btnStartSlide) btnStartSlide.classList.toggle('hidden', running);
  if (btnStopSlide) btnStopSlide.classList.toggle('hidden', !running);
  if (slideDelaySelect) slideDelaySelect.disabled = running;
  if (toggleSlideAutoQuiz) toggleSlideAutoQuiz.disabled = running;
}

// ── Session Data Cleanup ─────────────────────────────────────
let autoClearTimer = null;

function clearCurrentSessionData(manual = false) {
  if (autoClearTimer) {
    clearTimeout(autoClearTimer);
    autoClearTimer = null;
  }

  questions = [];
  detectedTotalCount = null;
  processedCount = 0;

  // Clear lecture context extracted from page
  pageContentContext = '';
  if (typeof updateReferenceUI === 'function') {
    updateReferenceUI();
  }

  // Show clean empty state ready for new quiz
  showEmptyState('✨ Đã hoàn thành! Mở bài mới và nhấn <strong class="highlight-text">"Quét câu hỏi"</strong> để bắt đầu.');

  showToast(manual ? '🧹 Đã dọn dẹp câu hỏi vừa dùng!' : '🧹 Đã tự động dọn dẹp dữ liệu để chuẩn bị cho bài mới!');
}

function scheduleAutoClearData(delayMs = 3000) {
  const isEnabled = toggleAutoClear ? toggleAutoClear.checked : true;
  if (!isEnabled) return;

  if (autoClearTimer) clearTimeout(autoClearTimer);

  autoClearTimer = setTimeout(() => {
    if (isProcessing) return;
    const hasQuestions = questions.length > 0;
    const allDone = hasQuestions && questions.every(q => q.status === 'done' || q.status === 'filled');
    if (allDone || hasQuestions) {
      clearCurrentSessionData(false);
    }
  }, delayMs);
}
