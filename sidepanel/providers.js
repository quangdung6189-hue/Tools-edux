/* ============================================================
   Side Panel — Provider Registry, Custom API Sources & Presets
   Hỗ trợ thêm không giới hạn nguồn API tùy chỉnh:
   - OpenAI-compatible (chat/completions): 9Router, OpenRouter,
     Groq, DeepSeek, OpenAI, Together, Mistral, Ollama, LM Studio...
   - Google Gemini (generateContent) trực tiếp
   ============================================================ */

// ── Constants ────────────────────────────────────────────────
const ADD_PROVIDER_OPTION = '__add_new_provider__';
const CUSTOM_PROVIDERS_STORAGE_KEY = 'ahs_custom_providers';

// Gợi ý model cho nguồn tích hợp (nguồn tùy chỉnh dùng gợi ý của preset hoặc tự do nhập)
const MODEL_CATALOG = {
  '9router': [
    ['ag/gemini-3.8-flash-low', '⚡ Siêu Tốc ~0.5s - Khuyên dùng ⭐'],
    ['ag/gemini-3.7-flash-low', '⚡ Siêu Tốc ~0.5s - Gemini 3.7 ⭐'],
    ['ag/gemini-3.8-flash-medium', '⚖️ Cân bằng 3.8'],
    ['ag/gemini-3.7-flash-medium', '⚖️ Cân bằng 3.7'],
    ['ag/gemini-3.8-flash-high', '🧠 Suy luận sâu 3.8 - Chậm hơn'],
    ['ag/gemini-3.7-flash-high', '🧠 Suy luận sâu 3.7 - Chậm hơn'],
    ['ag/gemini-3.6-flash-low', '⚡ Tiết kiệm Token 3.6'],
    ['ag/gemini-3.6-flash-medium', '⚖️ Cân bằng 3.6'],
    ['ag/gemini-3.6-flash-high', '🧠 Suy luận cao 3.6'],
    ['ag/gemini-3-flash', '⚡ Nhanh - Gemini 3'],
    ['ag/gemini-3-flash-agent', 'Gemini 3 Agent'],
    ['ag/gemini-3.1-pro-low', 'Pro Low'],
    ['ag/gemini-pro-agent', 'Pro Agent'],
    ['ag/claude-sonnet-4-6', 'Claude Sonnet 4.6'],
    ['ag/claude-opus-4-6-thinking', 'Claude Opus 4.6'],
    ['ag/gpt-oss-120b-medium', 'GPT-OSS 120B Medium'],
  ],
  'gemini': [
    ['gemini-3.6-flash', '⚡ Gemini 3.6 Flash (Khuyên dùng ⭐)'],
    ['gemini-2.5-flash', '⚡ Gemini 2.5 Flash'],
    ['gemini-2.5-pro', '🧠 Gemini 2.5 Pro - Suy luận sâu'],
    ['gemini-2.0-flash', '⚡ Gemini 2.0 Flash'],
  ],
};

// Mẫu nguồn API có sẵn — điền nhanh 1 click khi thêm nguồn tùy chỉnh
const CUSTOM_PROVIDER_PRESETS = [
  {
    id: 'openrouter', icon: '🔀', name: 'OpenRouter', kind: 'openai',
    baseUrl: 'https://openrouter.ai/api/v1', keyUrl: 'https://openrouter.ai/settings/keys',
    keyOptional: false,
    models: ['openai/gpt-4o-mini', 'anthropic/claude-3.5-sonnet', 'google/gemini-2.0-flash-001', 'deepseek/deepseek-chat', 'meta-llama/llama-3.3-70b-instruct'],
  },
  {
    id: 'groq', icon: '⚡', name: 'Groq (Siêu tốc)', kind: 'openai',
    baseUrl: 'https://api.groq.com/openai/v1', keyUrl: 'https://console.groq.com/keys',
    keyOptional: false,
    models: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'deepseek-r1-distill-llama-70b', 'gemma2-9b-it'],
  },
  {
    id: 'deepseek', icon: '🐳', name: 'DeepSeek', kind: 'openai',
    baseUrl: 'https://api.deepseek.com/v1', keyUrl: 'https://platform.deepseek.com/api_keys',
    keyOptional: false,
    models: ['deepseek-chat', 'deepseek-reasoner'],
  },
  {
    id: 'openai', icon: '🤖', name: 'OpenAI (ChatGPT)', kind: 'openai',
    baseUrl: 'https://api.openai.com/v1', keyUrl: 'https://platform.openai.com/api-keys',
    keyOptional: false,
    models: ['gpt-4o-mini', 'gpt-4o', 'gpt-4.1-mini', 'o4-mini'],
  },
  {
    id: 'gemini-openai', icon: '✨', name: 'Gemini API (OpenAI-compat)', kind: 'openai',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai', keyUrl: 'https://aistudio.google.com/apikey',
    keyOptional: false,
    models: ['gemini-3.6-flash', 'gemini-2.5-flash', 'gemini-2.5-pro'],
  },
  {
    id: 'gemini-direct', icon: '🌐', name: 'Gemini API (Trực tiếp)', kind: 'gemini',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta', keyUrl: 'https://aistudio.google.com/apikey',
    keyOptional: false,
    models: ['gemini-3.6-flash', 'gemini-2.5-flash', 'gemini-2.5-pro'],
  },
  {
    id: 'ollama', icon: '🦙', name: 'Ollama (Local)', kind: 'openai',
    baseUrl: 'http://localhost:11434/v1', keyUrl: 'https://ollama.com',
    keyOptional: true,
    models: ['llama3.2', 'qwen2.5', 'gemma2', 'phi4'],
  },
  {
    id: 'lmstudio', icon: '🖥️', name: 'LM Studio (Local)', kind: 'openai',
    baseUrl: 'http://localhost:1234/v1', keyUrl: 'https://lmstudio.ai',
    keyOptional: true,
    models: ['local-model'],
  },
  {
    id: 'cerebras', icon: '🧠', name: 'Cerebras', kind: 'openai',
    baseUrl: 'https://api.cerebras.ai/v1', keyUrl: 'https://cloud.cerebras.ai',
    keyOptional: false,
    models: ['llama-3.3-70b', 'llama3.1-8b'],
  },
  {
    id: 'together', icon: '🤝', name: 'Together AI', kind: 'openai',
    baseUrl: 'https://api.together.xyz/v1', keyUrl: 'https://api.together.ai/settings/api-keys',
    keyOptional: false,
    models: ['meta-llama/Llama-3.3-70B-Instruct-Turbo', 'deepseek-ai/DeepSeek-V3', 'Qwen/Qwen2.5-72B-Instruct-Turbo'],
  },
  {
    id: 'mistral', icon: '🌬️', name: 'Mistral AI', kind: 'openai',
    baseUrl: 'https://api.mistral.ai/v1', keyUrl: 'https://console.mistral.ai/api-keys',
    keyOptional: false,
    models: ['mistral-small-latest', 'mistral-large-latest', 'open-mistral-nemo'],
  },
  {
    id: 'blank', icon: '⚙️', name: 'Nguồn tùy chỉnh khác', kind: 'openai',
    baseUrl: '', keyUrl: '', keyOptional: false, models: [],
  },
];

// ── Module state ─────────────────────────────────────────────
let customProvidersCache = [];
let lastStableProviderId = '9router'; // Nguộn hợp lệ gần nhất để "Hủy" quay về
let currentUIProviderId = null;       // Nguồn đang hiển thị trên form
const providerFieldStash = {};        // Giữ giá trị form theo từng nguồn khi chuyển qua lại

function stashProviderFields(providerId) {
  if (!providerId) return;
  providerFieldStash[providerId] = {
    endpoint: endpointInput ? endpointInput.value : '',
    model: modelInput ? modelInput.value : '',
    key: apiKeyInput ? apiKeyInput.value : '',
  };
}

function restoreProviderFields(providerId) {
  const stash = providerFieldStash[providerId];
  if (!stash) return false;
  if (endpointInput) endpointInput.value = stash.endpoint || '';
  if (modelInput) modelInput.value = stash.model || '';
  if (apiKeyInput) apiKeyInput.value = stash.key || '';
  return true;
}

// ── Storage helpers ──────────────────────────────────────────
async function getCustomProviders() {
  try {
    const store = await chrome.storage.local.get(CUSTOM_PROVIDERS_STORAGE_KEY);
    return Array.isArray(store[CUSTOM_PROVIDERS_STORAGE_KEY]) ? store[CUSTOM_PROVIDERS_STORAGE_KEY] : [];
  } catch (_) {
    return [];
  }
}

async function persistCustomProviders(list) {
  customProvidersCache = list;
  await chrome.storage.local.set({ [CUSTOM_PROVIDERS_STORAGE_KEY]: list });
}

function setCustomProvidersCache(list) {
  customProvidersCache = Array.isArray(list) ? list : [];
}

function findCustomProvider(providerId) {
  if (!providerId || !providerId.startsWith('custom:')) return null;
  const id = providerId.slice(7);
  return customProvidersCache.find(p => p && p.id === id) || null;
}

// ── Dropdown rendering ───────────────────────────────────────
function rebuildProviderOptions(customProviders = customProvidersCache) {
  if (!providerSelect) return;
  setCustomProvidersCache(customProviders);

  let html = '';
  html += '<option value="9router">9Router Proxy (Khuyên dùng - Local)</option>';
  html += '<option value="gemini">Google Gemini Trực Tiếp</option>';

  if (customProviders.length > 0) {
    html += '<optgroup label="⭐ Nguồn API của bạn">';
    for (const p of customProviders) {
      const label = `${p.name || 'Nguồn không tên'}${p.kind === 'gemini' ? ' 🌐' : ''}`;
      html += `<option value="custom:${p.id}">${escapeHtml(label)}</option>`;
    }
    html += '</optgroup>';
  }

  html += `<option value="${ADD_PROVIDER_OPTION}">➕ Thêm nguồn API tùy chỉnh...</option>`;
  providerSelect.innerHTML = html;
}

function setModelSuggestions(entries) {
  const datalist = document.getElementById('model-options');
  if (!datalist) return;
  datalist.innerHTML = (entries || [])
    .map(([value, label]) => `<option value="${escapeHtml(value)}">${escapeHtml(label || '')}</option>`)
    .join('');
}

// ── UI state machine ─────────────────────────────────────────
function isProviderAddMode() {
  return !!providerSelect && providerSelect.value === ADD_PROVIDER_OPTION;
}

function isProviderCustomMode() {
  return !!providerSelect && providerSelect.value.startsWith('custom:');
}

function renderProviderPresetChips() {
  const wrap = document.getElementById('provider-presets');
  if (!wrap) return;
  wrap.innerHTML = CUSTOM_PROVIDER_PRESETS.map((preset, idx) => `
    <button type="button" class="preset-chip${idx === 0 ? ' selected' : ''}" data-preset-id="${preset.id}"
      title="${escapeHtml(preset.baseUrl || 'Nhập URL của riêng bạn')}">
      <span class="preset-chip-icon">${preset.icon}</span>${escapeHtml(preset.name)}
    </button>
  `).join('');
}

function applyPresetToForm(preset) {
  if (!preset) return;
  if (customKindSelect) customKindSelect.value = preset.kind;
  if (customNameInput && (!customNameInput.value.trim() || isPresetNamedField())) {
    customNameInput.value = preset.id === 'blank' ? '' : preset.name;
  }
  if (endpointInput) endpointInput.value = preset.baseUrl || '';
  if (modelInput && preset.models && preset.models.length > 0 && shouldFillModel()) {
    modelInput.value = preset.models[0];
  }
  if (linkHelpKey) {
    linkHelpKey.textContent = preset.keyUrl ? '→ Lấy API key của nguồn này' : '→ Trang chủ nguồn API';
    linkHelpKey.href = preset.keyUrl || preset.baseUrl || '#';
  }
  setModelSuggestions(preset.models.map(m => [m, '']));
  applyKindVisibility(preset.kind, preset.keyOptional);
  markSelectedPresetChip(preset.id);
  customPresetState = preset;
  if (customNameInput) customNameInput.dataset.presetName = preset.name;
  if (apiKeyInput) apiKeyInput.placeholder = preset.keyOptional
    ? 'API key (tùy chọn với API local)...'
    : 'Dán API key của nguồn này vào đây...';
}

let customPresetState = null;

function isPresetNamedField() {
  return customNameInput && customNameInput.dataset.presetName &&
    customNameInput.value.trim() === customNameInput.dataset.presetName;
}

function shouldFillModel() {
  if (!modelInput) return false;
  const current = modelInput.value.trim();
  // Chỉ tự điền model khi ô đang trống hoặc đang là gợi ý của preset trước đó
  if (!current) return true;
  const prevModels = (customPresetState && customPresetState.models) || [];
  return prevModels.includes(current);
}

function markSelectedPresetChip(presetId) {
  const wrap = document.getElementById('provider-presets');
  if (!wrap) return;
  wrap.querySelectorAll('.preset-chip').forEach(chip => {
    chip.classList.toggle('selected', chip.dataset.presetId === presetId);
  });
}

function applyKindVisibility(kind, keyOptional) {
  const isGemini = kind === 'gemini';
  if (groupEndpoint) groupEndpoint.style.display = isGemini ? 'none' : 'block';
  if (labelApiKey) {
    labelApiKey.textContent = isGemini
      ? '🔑 Google Gemini API Key'
      : `🔑 API Key${keyOptional ? ' (tùy chọn với API local)' : ''}`;
  }
  if (linkHelpKey && isGemini && !isProviderAddOrEditMode()) {
    linkHelpKey.textContent = '→ Lấy API key miễn phí tại Google AI Studio';
    linkHelpKey.href = 'https://aistudio.google.com/apikey';
  }
}

function isProviderAddOrEditMode() {
  return isProviderAddMode() || isProviderCustomMode();
}

// Trạng thái UI tổng theo nguồn đang chọn trong dropdown
function applyProviderUIState(providerId) {
  if (!providerSelect) return;

  const btnLoadModels = document.getElementById('btn-load-models');
  const groupEditor = document.getElementById('group-custom-editor');
  const btnDeleteProvider = document.getElementById('btn-delete-provider');
  const btnCancelProvider = document.getElementById('btn-cancel-provider');
  const btnSaveKey = document.getElementById('btn-save-key');
  const saveKeyLabel = btnSaveKey ? btnSaveKey.querySelector('span') : null;

  // Lưu lại giá trị form của nguồn trước đó để không lẫn dữ liệu giữa các nguồn
  stashProviderFields(currentUIProviderId);
  currentUIProviderId = providerId;

  // ── Trường hợp 1: Nguồn tích hợp (9Router / Gemini) ──
  if (providerId === '9router' || providerId === 'gemini') {
    lastStableProviderId = providerId;
    if (groupEditor) groupEditor.style.display = 'none';
    if (btnDeleteProvider) btnDeleteProvider.classList.add('hidden');
    if (btnCancelProvider) btnCancelProvider.classList.add('hidden');
    if (btnLoadModels) btnLoadModels.classList.add('hidden');
    customPresetState = null;

    if (saveKeyLabel) saveKeyLabel.textContent = '💾 Lưu cài đặt';
    restoreProviderFields(providerId);

    if (providerId === 'gemini') {
      if (groupEndpoint) groupEndpoint.style.display = 'none';
      if (labelApiKey) labelApiKey.textContent = '🔑 Google Gemini API Key';
      if (apiKeyInput) apiKeyInput.placeholder = 'Dán API key từ Google AI Studio (AIzaSy...)';
      // Model dạng ag/... chỉ tồn tại trong 9Router — đổi sang model Gemini trực tiếp
      if (modelInput && modelInput.value.trim().startsWith('ag/')) {
        modelInput.value = 'gemini-3.6-flash';
      }
      if (linkHelpKey) {
        linkHelpKey.textContent = '→ Lấy API key miễn phí tại Google AI Studio';
        linkHelpKey.href = 'https://aistudio.google.com/apikey';
      }
      setModelSuggestions(MODEL_CATALOG['gemini']);
    } else {
      if (groupEndpoint) groupEndpoint.style.display = 'block';
      if (labelApiKey) labelApiKey.textContent = '🔑 9Router API Key (sk-...)';
      if (apiKeyInput) apiKeyInput.placeholder = 'Dán key sk-... từ 9Router vào đây...';
      if (linkHelpKey) {
        linkHelpKey.textContent = '→ Mở bảng điều khiển 9Router';
        linkHelpKey.href = 'http://localhost:20128';
      }
      setModelSuggestions(MODEL_CATALOG['9router']);
    }
    return;
  }

  // ── Trường hợp 2: Thêm nguồn mới ──
  if (providerId === ADD_PROVIDER_OPTION) {
    if (groupEditor) groupEditor.style.display = 'block';
    if (btnDeleteProvider) btnDeleteProvider.classList.add('hidden');
    if (btnCancelProvider) btnCancelProvider.classList.remove('hidden');
    if (btnLoadModels) btnLoadModels.classList.remove('hidden');
    if (saveKeyLabel) saveKeyLabel.textContent = '💾 Lưu & thêm nguồn mới';

    // Khôi phục dữ liệu đang soạn dở (nếu có) rồi mới áp preset mặc định
    const resumed = restoreProviderFields(ADD_PROVIDER_OPTION);
    renderProviderPresetChips();
    if (!resumed && customNameInput && !customNameInput.value.trim()) {
      applyPresetToForm(CUSTOM_PROVIDER_PRESETS[0]);
    } else {
      applyKindVisibility(customKindSelect ? customKindSelect.value : 'openai', false);
    }
    if (customNameInput) customNameInput.focus();
    return;
  }

  // ── Trường hợp 3: Chỉnh sửa nguồn tùy chỉnh có sẵn ──
  const cp = findCustomProvider(providerId);
  if (!cp) {
    // Nguồn không còn tồn tại — quay về 9Router
    providerSelect.value = '9router';
    applyProviderUIState('9router');
    return;
  }

  lastStableProviderId = providerId;
  if (groupEditor) groupEditor.style.display = 'block';
  if (btnDeleteProvider) btnDeleteProvider.classList.remove('hidden');
  if (btnCancelProvider) btnCancelProvider.classList.add('hidden');
  if (btnLoadModels) btnLoadModels.classList.remove('hidden');
  if (saveKeyLabel) saveKeyLabel.textContent = '💾 Lưu nguồn này';

  renderProviderPresetChips();
  if (customNameInput) {
    customNameInput.value = cp.name || '';
    customNameInput.dataset.presetName = cp.name || '';
  }
  if (customKindSelect) customKindSelect.value = cp.kind === 'gemini' ? 'gemini' : 'openai';
  if (endpointInput) endpointInput.value = cp.baseUrl || '';
  if (modelInput) modelInput.value = cp.model || '';
  if (apiKeyInput) apiKeyInput.value = cp.apiKey || '';

  // Gợi ý model theo preset khớp baseUrl (nếu có)
  const matchedPreset = CUSTOM_PROVIDER_PRESETS.find(p => p.baseUrl && p.baseUrl === (cp.baseUrl || ''));
  setModelSuggestions(matchedPreset ? matchedPreset.models.map(m => [m, '']) : []);
  markSelectedPresetChip(matchedPreset ? matchedPreset.id : '');
  customPresetState = matchedPreset || null;

  applyKindVisibility(cp.kind === 'gemini' ? 'gemini' : 'openai', matchedPreset ? matchedPreset.keyOptional : false);
  if (apiKeyInput) apiKeyInput.placeholder = (matchedPreset && matchedPreset.keyOptional)
    ? 'API key (tùy chọn với API local)...'
    : 'Dán API key của nguồn này vào đây...';
  if (linkHelpKey) {
    let origin = 'trang chủ nguồn API';
    try { origin = new URL(cp.baseUrl).origin; } catch (_) {}
    linkHelpKey.textContent = (matchedPreset && matchedPreset.keyUrl)
      ? '→ Lấy API key của nguồn này'
      : `→ Mở ${origin}`;
    if (matchedPreset && matchedPreset.keyUrl) linkHelpKey.href = matchedPreset.keyUrl;
  }
}

// ── Model list loader (kiểm tra kết nối nhanh) ───────────────
async function handleLoadModelList() {
  if (!endpointInput && !modelInput) return;

  const providerId = providerSelect ? providerSelect.value : '9router';
  const isGeminiKind = providerId === 'gemini' ||
    (isProviderAddOrEditMode() && customKindSelect && customKindSelect.value === 'gemini');

  const baseUrl = (endpointInput ? endpointInput.value.trim() : '') || 'http://localhost:20128/v1';
  const key = apiKeyInput ? apiKeyInput.value.trim() : '';
  const btn = document.getElementById('btn-load-models');
  const btnSpan = btn ? btn.querySelector('span') : null;
  const originalText = btnSpan ? btnSpan.textContent : '';

  if (btn) btn.disabled = true;
  if (btnSpan) btnSpan.textContent = '⏳ Đang tải...';

  try {
    let modelIds = [];

    if (isGeminiKind) {
      if (!key) throw new Error('Cần API key của Google AI Studio để tải danh sách model.');
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(key)}&pageSize=100`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error?.message || `HTTP ${res.status}`);
      modelIds = (data.models || [])
        .filter(m => Array.isArray(m.supportedGenerationMethods) ? m.supportedGenerationMethods.includes('generateContent') : true)
        .map(m => (m.name || '').replace(/^models\//, ''))
        .filter(n => n && !/embedding|aqa|imagen|veo|tts/i.test(n));
    } else {
      const base = baseUrl.replace(/\/+$/, '');
      const headers = { 'Accept': 'application/json' };
      if (key) headers['Authorization'] = `Bearer ${key}`;
      const res = await fetch(`${base}/models`, { headers });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error?.message || data?.message || `HTTP ${res.status}`);
      const rawList = Array.isArray(data.data) ? data.data : (Array.isArray(data.models) ? data.models : (Array.isArray(data) ? data : []));
      modelIds = rawList.map(m => (typeof m === 'string' ? m : (m.id || m.name || ''))).filter(Boolean);
    }

    modelIds = [...new Set(modelIds)].sort();

    if (modelIds.length === 0) {
      throw new Error('Endpoint kết nối được nhưng không trả về model nào. Bạn vẫn có thể gõ tên model thủ công.');
    }

    setModelSuggestions(modelIds.map(id => [id, '']));
    showKeyStatus(`✅ Kết nối thành công! Tìm thấy ${modelIds.length} model. Bấm ô Model để chọn.`, 'success');
  } catch (err) {
    const hint = /Failed to fetch|NetworkError|load failed/i.test(err.message)
      ? 'Không kết nối được endpoint (kiểm tra URL / server đang chạy?).'
      : err.message;
    showKeyStatus(`⚠️ ${hint} Bạn vẫn có thể gõ tên model thủ công.`, 'error');
  } finally {
    if (btn) btn.disabled = false;
    if (btnSpan) btnSpan.textContent = originalText;
  }
}

// ── CRUD nguồn tùy chỉnh (gọi từ api.js saveSettings) ────────
async function createCustomProviderFromForm() {
  const name = customNameInput ? customNameInput.value.trim() : '';
  const kind = customKindSelect ? customKindSelect.value : 'openai';
  const baseUrl = endpointInput ? endpointInput.value.trim() : '';
  const model = modelInput ? modelInput.value.trim() : '';
  const key = apiKeyInput ? apiKeyInput.value.trim() : '';

  if (!name) return { error: 'Vui lòng đặt tên cho nguồn API (VD: OpenRouter của tôi).' };
  if (kind === 'openai' && !baseUrl) return { error: 'Vui lòng nhập Base URL của nguồn API (VD: https://api.groq.com/openai/v1).' };
  if (!model) return { error: 'Vui lòng nhập Model mặc định cho nguồn này.' };
  if (kind === 'gemini' && !key) return { error: 'Nguồn Gemini trực tiếp cần API key.' };

  const entry = {
    id: 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    name, kind,
    baseUrl: kind === 'gemini' ? 'https://generativelanguage.googleapis.com/v1beta' : baseUrl.replace(/\/+$/, ''),
    model, apiKey: key,
    createdAt: new Date().toISOString(),
  };

  const list = await getCustomProviders();
  list.push(entry);
  await persistCustomProviders(list);
  return { entry };
}

async function updateCustomProviderFromForm(providerId) {
  const cp = findCustomProvider(providerId);
  if (!cp) return { error: 'Nguồn không còn tồn tại.' };

  const name = customNameInput ? customNameInput.value.trim() : '';
  const kind = customKindSelect ? customKindSelect.value : 'openai';
  const baseUrl = endpointInput ? endpointInput.value.trim() : '';
  const model = modelInput ? modelInput.value.trim() : '';
  const key = apiKeyInput ? apiKeyInput.value.trim() : '';

  if (!name) return { error: 'Vui lòng đặt tên cho nguồn API.' };
  if (kind === 'openai' && !baseUrl) return { error: 'Vui lòng nhập Base URL của nguồn API.' };
  if (!model) return { error: 'Vui lòng nhập Model mặc định cho nguồn này.' };
  if (kind === 'gemini' && !key) return { error: 'Nguồn Gemini trực tiếp cần API key.' };

  cp.name = name;
  cp.kind = kind;
  cp.baseUrl = kind === 'gemini' ? 'https://generativelanguage.googleapis.com/v1beta' : baseUrl.replace(/\/+$/, '');
  cp.model = model;
  cp.apiKey = key;

  const list = await getCustomProviders();
  const idx = list.findIndex(p => p.id === cp.id);
  if (idx !== -1) list[idx] = cp;
  await persistCustomProviders(list);
  rebuildProviderOptions();
  providerSelect.value = providerId;
  return { entry: cp };
}

async function deleteCustomProvider(providerId) {
  const cp = findCustomProvider(providerId);
  if (!cp) return;
  if (!confirm(`Xóa nguồn API "${cp.name}"?`)) return;

  const list = (await getCustomProviders()).filter(p => p.id !== cp.id);
  await persistCustomProviders(list);
  rebuildProviderOptions();

  // Quay về 9Router với dữ liệu thật từ storage (không giữ lại field của nguồn vừa xóa)
  const response = await chrome.runtime.sendMessage({ type: 'GET_API_KEY' }).catch(() => null);
  if (endpointInput && response?.apiEndpoint) endpointInput.value = response.apiEndpoint;
  if (modelInput && response?.geminiModel) modelInput.value = response.geminiModel;
  if (apiKeyInput) apiKeyInput.value = response?.apiKey || '';
  delete providerFieldStash['9router'];

  lastStableProviderId = '9router';
  providerSelect.value = '9router';
  applyProviderUIState('9router');
  showKeyStatus(`🗑️ Đã xóa nguồn "${cp.name}".`, 'success');
}

// Hủy chế độ thêm/sửa — quay về nguồn hợp lệ gần nhất
function cancelProviderEdit() {
  if (!providerSelect) return;
  const target = lastStableProviderId || '9router';
  providerSelect.value = target;
  applyProviderUIState(target);
  // Điền lại dữ liệu của nguồn đang chọn
  const cp = findCustomProvider(target);
  if (cp) {
    if (endpointInput) endpointInput.value = cp.baseUrl || '';
    if (modelInput) modelInput.value = cp.model || '';
    if (apiKeyInput) apiKeyInput.value = cp.apiKey || '';
  }
}
