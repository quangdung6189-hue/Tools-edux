import { searchWeb } from './search.js';

const DEFAULT_9ROUTER_ENDPOINT = 'http://localhost:20128/v1';
const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';

// ── Local Router Detection (9Router vs Onimi / router local khác) ──
// 9Router chạy ở cổng 20128 và dùng model prefix ag/. Onimi (hoặc router local
// khác) thường chạy cổng khác và KHÔNG hiểu model ag/... cũng như các tham số
// reasoning_effort / extra_body.thinking_budget. Ép sai sẽ gây HTTP 400 vài câu
// đầu rồi dừng cả loạt Auto.
function isNineRouterEndpoint(baseUrl) {
  const u = (baseUrl || '').toLowerCase();
  return u.includes('20128') || u.includes('9router');
}

// ── Provider Resolution ──────────────────────────────────────
// Hỗ trợ: '9router' (router local: 9Router hoặc Onimi) | 'gemini' | 'custom:<id>'
function normalize9RouterModel(raw, baseUrl) {
  // Router lạ (Onimi...) → giữ nguyên model người dùng nhập, KHÔNG ép ag/...
  if (baseUrl && !isNineRouterEndpoint(baseUrl)) {
    const m = (raw || '').trim();
    return m || 'gemini-auto';
  }
  let model = (raw || '').trim();
  if (!model) {
    return 'ag/gemini-3.8-flash-low';
  }
  if (model.startsWith('ag/') || model.includes('/')) {
    return model;
  }
  // User typed or selected a name without prefix
  const clean = model.toLowerCase().replace(/\s+/g, '-').replace(/[()]/g, '');
  if (clean.includes('3.8') && clean.includes('low')) return 'ag/gemini-3.8-flash-low';
  if (clean.includes('3.8') && clean.includes('medium')) return 'ag/gemini-3.8-flash-medium';
  if (clean.includes('3.8')) return 'ag/gemini-3.8-flash-high';
  if (clean.includes('3.7') && clean.includes('low')) return 'ag/gemini-3.7-flash-low';
  if (clean.includes('3.7') && clean.includes('medium')) return 'ag/gemini-3.7-flash-medium';
  if (clean.includes('3.7')) return 'ag/gemini-3.7-flash-high';
  if (clean.includes('3.6') && clean.includes('low')) return 'ag/gemini-3.6-flash-low';
  if (clean.includes('3.6') && clean.includes('medium')) return 'ag/gemini-3.6-flash-medium';
  if (clean.includes('3.6')) return 'ag/gemini-3.6-flash-high';
  if (clean.includes('3.5') && clean.includes('extra')) return 'ag/gemini-3.5-flash-extra-low';
  if (clean.includes('3.5') && clean.includes('low')) return 'ag/gemini-3.5-flash-low';
  if (clean.includes('3.5')) return 'ag/gemini-3.5-flash-high';
  if (clean.includes('pro') && clean.includes('agent')) return 'ag/gemini-pro-agent';
  if (clean.includes('3.1') && clean.includes('pro')) return 'ag/gemini-3.1-pro-low';
  if (clean.includes('claude') && clean.includes('opus')) return 'ag/claude-opus-4-6-thinking';
  if (clean.includes('claude')) return 'ag/claude-sonnet-4-6';
  if (clean.includes('gpt') || clean.includes('120b')) return 'ag/gpt-oss-120b-medium';
  if (clean === 'gemini-auto') return 'gemini-auto';
  return `ag/${clean}`;
}

async function resolveProviderConfig() {
  const store = await chrome.storage.local.get([
    'apiKey', 'geminiModel', 'apiProvider', 'apiEndpoint', 'ahs_custom_providers'
  ]);

  let providerId = (store.apiProvider || '').trim();
  if (!providerId) providerId = '9router';

  // 1) Nguồn tùy chỉnh do người dùng thêm
  if (providerId.startsWith('custom:')) {
    const cp = (store.ahs_custom_providers || []).find(p => p && p.id === providerId.slice(7));
    if (!cp) {
      return { error: 'Nguồn API tùy chọn không còn tồn tại (có thể đã bị xóa). Mở Cài đặt và chọn lại nguồn AI.' };
    }
    const kind = cp.kind === 'gemini' ? 'gemini' : 'openai';
    const apiKey = (cp.apiKey || '').trim();
    const model = (cp.model || '').trim() || (kind === 'gemini' ? 'gemini-3.6-flash' : 'gpt-4o-mini');
    const baseUrl = (cp.baseUrl || '').trim();

    if (kind === 'openai' && !baseUrl) {
      return { error: `Nguồn "${cp.name}" chưa có Base URL. Vui lòng mở Cài đặt để sửa.` };
    }
    if (kind === 'gemini' && !apiKey) {
      return { error: `Nguồn "${cp.name}" chưa có Google Gemini API key. Vui lòng mở Cài đặt để sửa.` };
    }

    return {
      kind,
      providerId,
      providerName: cp.name || 'Nguồn tùy chỉnh',
      apiKey,
      model,
      baseUrl: kind === 'gemini' ? GEMINI_BASE_URL : baseUrl.replace(/\/+$/, ''),
      fastModeRouting: false, // Không tự ý thay model của nguồn tùy chỉnh
    };
  }

  // 2) Google Gemini trực tiếp
  if (providerId === 'gemini') {
    const apiKey = (store.apiKey || '').trim();
    if (!apiKey) {
      return { error: 'Chưa cài đặt Google Gemini API key. Vui lòng dán API key từ Google AI Studio trong cài đặt.' };
    }
    let model = (store.geminiModel || '').trim();
    if (!model || model.includes('2.0-flash') || model.startsWith('ag/')) {
      // Model của 9Router (ag/...) không dùng được với Google API trực tiếp
      model = 'gemini-3.6-flash';
    }
    return {
      kind: 'gemini',
      providerId: 'gemini',
      providerName: 'Google Gemini',
      apiKey,
      model,
      baseUrl: GEMINI_BASE_URL,
      fastModeRouting: false,
    };
  }

  // 3) Router local (9Router mặc định, hoặc Onimi / router local khác qua apiEndpoint)
  // Onimi thường chạy cổng khác 20128, không cần key, không hiểu model ag/... —
  // phải giữ nguyên model người dùng nhập và bỏ các tham số reasoning riêng của 9Router.
  const rawBaseUrl = ((store.apiEndpoint || '').trim() || DEFAULT_9ROUTER_ENDPOINT).replace(/\/+$/, '');
  const is9R = isNineRouterEndpoint(rawBaseUrl);
  const apiKey = (store.apiKey || '').trim();
  if (!apiKey && is9R) {
    return { error: 'Chưa cài đặt API key. Vui lòng dán API key từ 9Router hoặc Gemini trong cài đặt.' };
  }
  return {
    kind: 'openai',
    providerId: '9router',
    providerName: is9R ? '9Router' : 'Router local (Onimi)',
    apiKey,
    model: normalize9RouterModel(store.geminiModel, rawBaseUrl),
    baseUrl: rawBaseUrl,
    fastModeRouting: is9R, // Chỉ 9Router mới tự route -high → -low
  };
}

export async function handleAskAI(message, sendResponse) {
  try {
    const config = await resolveProviderConfig();
    if (config.error) {
      sendResponse({ error: config.error });
      return;
    }

    let model = config.model;

    // In fast mode for short questions, automatically map -high models to -low models to prevent 10s thinking delay
    if (message.fastMode && config.fastModeRouting && model.endsWith('-high')) {
      model = model.replace(/-high$/, '-low');
      console.log('[AutoSolver] Fast mode active: Auto-routed model to low-thinking variant:', model);
    }

    const { question, options, questionType, slideContext, fastMode = true } = message;
    const enableWebGrounding = await getWebGroundingEnabled();

    // Academic Exam Grounding:
    // Tra cứu đối chiếu mở rộng bên ngoài khi:
    // 1) Người dùng bật toggle "Tra cứu mở rộng" (enableWebGrounding)
    // 2) HOẶC không ở chế độ siêu tốc (!fastMode) và thiếu ngữ cảnh tài liệu slide/đính kèm
    let webSnippets = [];
    const isFillBlankQuestion = questionType === 'fill-in-the-blank' ||
                                /điền|chỗ\s*trống|chỗ\s*khuyết|fill[-_\s]*in/i.test(question);
    const hasEnoughContext = slideContext && slideContext.trim().length >= 60;
    const shouldGround = enableWebGrounding === true || (!fastMode && (isFillBlankQuestion || !hasEnoughContext));

    if (shouldGround && question && question.trim().length > 10) {
      try {
        console.log('[AutoSolver] 🌐 Kích hoạt Academic Grounding tra cứu mở rộng:', question.substring(0, 50));
        webSnippets = await searchWeb(question, options);
      } catch (e) {
        console.warn('Academic Grounding search error:', e);
      }
    }

    const prompt = buildPrompt(question, options, questionType, slideContext, webSnippets);

    const isDeclaredMulti = /cho\s+từng\s+mệnh\s+đề|mỗi\s+mệnh\s+đề|các\s+mệnh\s+đề|các\s+phát\s+biểu|tính\s+chất\s+của|mỗi\s+nhận\s+định/i.test(question);
    const isSimpleTF = !isDeclaredMulti && options && options.length === 2 &&
      options.some(o => /^(?:đúng|true)$/i.test(o.trim())) &&
      options.some(o => /^(?:sai|false)$/i.test(o.trim()));
    const hasEmbeddedStatements = questionType === 'true-false' && (!options || options.length === 0 || isSimpleTF) &&
      (question.match(/(?:^|\n)\s*\d+[\.\)\:\-–—]\s*.{8,}/g) || []).length >= 2;
    const isMultiTF = (questionType === 'true-false' && options && options.length >= 2 && !isSimpleTF) || hasEmbeddedStatements || (questionType === 'true-false' && isDeclaredMulti);

    // Phân biệt câu tự luận (ô textarea = cần trả lời CHI TIẾT) với câu điền ngắn
    const isEssayQuestion = isEssayLikeQuestion(question, questionType, options);

    // Token budget theo dạng bài:
    // - Trắc nghiệm 1 lựa chọn: 64 — đủ cho "A. <nội dung phương án>" nhưng KHÔNG đủ chỗ
    //   viết quá trình suy luận (budget lớn khiến model viết lan man → chữ cái bị cắt/nhầm)
    // - Đúng/Sai: 200 | Câu ngắn/điền khuyết: 180 | Tự luận câu dài: 1024
    const isSimpleChoice = questionType === 'multiple-choice' || (questionType === 'true-false' && !isMultiTF);
    let tokenLimit;
    if (isMultiTF) tokenLimit = 200;
    else if (isSimpleChoice) tokenLimit = 64;
    else if (isEssayQuestion) tokenLimit = 1024;
    else tokenLimit = 180;

    const result = config.kind === 'gemini'
      ? await callGeminiDirect(config, model, prompt, tokenLimit, fastMode)
      : await callOpenAICompatible(config, model, prompt, tokenLimit, fastMode);

    if (result.error) {
      sendResponse({ error: result.error });
    } else if (!result.answer) {
      sendResponse({ error: `${config.providerName} không trả về câu trả lời.` });
    } else {
      sendResponse({ answer: result.answer });
    }
  } catch (err) {
    sendResponse({ error: `Lỗi kết nối: ${err.message}` });
  }
}

async function getWebGroundingEnabled() {
  try {
    const store = await chrome.storage.local.get('enableWebGrounding');
    return store.enableWebGrounding;
  } catch (_) {
    return undefined;
  }
}

// ── Mode A: OpenAI-compatible (9Router, Onimi, OpenRouter, Groq, Ollama...) ──
async function callOpenAICompatible(config, model, prompt, tokenLimit, fastMode) {
  const url = `${config.baseUrl}/chat/completions`;
  const is9R = isNineRouterEndpoint(config.baseUrl);

  console.log(`[AutoSolver] Calling ${config.providerName} (${config.kind}) with model:`, model, '| fastMode:', fastMode);

  const requestPayload = {
    model: model,
    messages: [
      { role: 'user', content: prompt }
    ],
    temperature: 0.1,
    max_tokens: tokenLimit,
    stream: false
  };

  if (fastMode && is9R) {
    // Chỉ 9Router hiểu 2 tham số này. Onimi / router lạ sẽ HTTP 400 nếu gửi kèm.
    requestPayload.reasoning_effort = 'low';
    requestPayload.extra_body = { thinking_budget: 0 };
  }

  const headers = { 'Content-Type': 'application/json' };
  if (config.apiKey) {
    headers['Authorization'] = `Bearer ${config.apiKey}`;
  }

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(requestPayload)
  });

  const responseText = await response.text();

  if (!response.ok) {
    let errorMsg = `HTTP ${response.status}`;
    try {
      const errorData = JSON.parse(responseText);
      errorMsg = errorData?.error?.message || errorData?.message || errorMsg;
    } catch (e) {}

    // Router local la (Onimi...) tu choi tham so reasoning rieng cua 9Router - tu dong thu lai payload toi gian.
    if (response.status === 400 && /reasoning_effort|extra_body|thinking_budget|unsupported|unrecogn|unexpected|invalid/i.test(errorMsg)) {
      const retryPayload = { model, messages: requestPayload.messages, temperature: 0.1, max_tokens: tokenLimit };
      return callOpenAIRetry(config, retryPayload);
    }

    // Mot so endpoint moi (OpenAI o-series/MMODIARY...) tu choi max_tokens - thu lai voi max_completion_tokens
    if (response.status === 400 && /max_tokens/i.test(errorMsg)) {
      const retryPayload2 = { ...requestPayload };
      delete retryPayload2.max_tokens;
      delete retryPayload2.extra_body;
      retryPayload2.max_completion_tokens = tokenLimit;
      return callOpenAIRetry(config, retryPayload2);
    }
    return { error: `${config.providerName} lỗi (${response.status}): ${errorMsg}` };
  }

  let answer = '';
  try {
    const data = JSON.parse(responseText);
    answer = data?.choices?.[0]?.message?.content;
  } catch (err) {
    // Handle SSE format if the endpoint ignores stream: false
    if (responseText.includes('data: {')) {
      const lines = responseText.split('\n');
      for (const line of lines) {
        if (line.startsWith('data: ') && !line.includes('[DONE]')) {
          try {
            const chunk = JSON.parse(line.slice(6));
            answer += chunk.choices?.[0]?.delta?.content || chunk.choices?.[0]?.message?.content || '';
          } catch (e) {}
        }
      }
    } else {
      return { error: `Lỗi parse JSON: ${err.message}` };
    }
  }

  return { answer };
}

async function callOpenAIRetry(config, retryPayload) {
  const url = `${config.baseUrl}/chat/completions`;
  const headers = { 'Content-Type': 'application/json' };
  if (config.apiKey) headers['Authorization'] = `Bearer ${config.apiKey}`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(retryPayload)
    });
    const responseText = await response.text();
    if (!response.ok) {
      let errorMsg = `HTTP ${response.status}`;
      try {
        const errorData = JSON.parse(responseText);
        errorMsg = errorData?.error?.message || errorData?.message || errorMsg;
      } catch (e) {}
      return { error: `${config.providerName} lỗi (${response.status}): ${errorMsg}` };
    }
    const data = JSON.parse(responseText);
    return { answer: data?.choices?.[0]?.message?.content };
  } catch (err) {
    return { error: `${config.providerName} lỗi: ${err.message}` };
  }
}

// ── Mode B: Google Gemini Direct API ─────────────────────────
async function callGeminiDirect(config, model, prompt, tokenLimit, fastMode) {
  const url = `${config.baseUrl}/models/${model}:generateContent?key=${config.apiKey}`;

  const generationConfig = {
    temperature: 0.1,
    maxOutputTokens: tokenLimit,
  };

  if (fastMode) {
    generationConfig.thinkingConfig = {
      thinkingBudget: 0
    };
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{
        parts: [{ text: prompt }]
      }],
      generationConfig: generationConfig
    })
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const errorMsg = errorData?.error?.message || `HTTP ${response.status}`;
    return { error: `Gemini API lỗi: ${errorMsg}` };
  }

  const data = await response.json();
  const answer = data?.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!answer) {
    return { error: 'Gemini không trả về kết quả.' };
  }

  return { answer };
}

// ── Question mode detection (dùng chung cho token budget & prompt) ──
function isFillBlankLike(question, questionType) {
  return questionType === 'fill-in-the-blank' ||
    /điền|chỗ\s*trống|chỗ\s*khuyết|hoàn\s*thành\s*câu|____+|\[\.\.\.\]/i.test(question) ||
    /điền\s*(?:từ|cụm\s*từ)\s*phù\s*hợp/i.test(question);
}

// Câu tự luận / câu hỏi cần trả lời DÀI: ô textarea ('text') hoặc đề yêu cầu trình bày, phân tích...
function isEssayLikeQuestion(question, questionType, options) {
  if (!question) return false;
  if (options && options.length >= 2) return false; // có phương án lựa chọn thì không phải tự luận
  if (isFillBlankLike(question, questionType)) return false;
  if (questionType === 'text') return true;
  return question.trim().length > 120 &&
    /trình\s*bày|phân\s*tích|so\s*sánh|giải\s*thích|nêu\s*(?:các\s*)?(?:đặc\s*điểm|ưu\s*điểm|nhược\s*điểm|vai\s*trò|ý\s*nghĩa)|explain|describe|compare/i.test(question);
}

function buildPrompt(question, options, questionType, slideContext, webSnippets = []) {
  let prompt = '';

  // 1. Context block from slide / attached document / page content
  let contextBlock = '';
  if (slideContext && slideContext.trim().length > 20) {
    contextBlock += `\n\n=== TÀI LIỆU BÀI GIẢNG / TÀI LIỆU ĐÍNH KÈM ===\n"""\n${slideContext.trim().substring(0, 20000)}\n"""\n* Ưu tiên số 1: Trích xuất đúng từ ngữ/thuật ngữ theo tài liệu bài giảng ở trên.\n`;
  }

  // 2. Web search grounding snippets (if available)
  if (webSnippets && webSnippets.length > 0) {
    contextBlock += `\n\n=== THÔNG TIN ĐỐI CHIẾU LÝ THUYẾT & DỮ LIỆU CHUẨN XÁC (ACADEMIC GROUNDING) ===\n"""\n${webSnippets.map((s, i) => `[Tài liệu ${i+1}] ${s}`).join('\n')}\n"""\n* Hãy đối chiếu kỹ thông tin lý thuyết chuẩn mực từ các nguồn trên để chọn đáp án/từ ngữ chính xác nhất.\n`;
  }

  const isFillBlank = isFillBlankLike(question, questionType);

  if (isFillBlank) {
    prompt = `Bạn là chuyên gia giải đề thi. Hãy điền từ hoặc cụm từ/câu lệnh chính xác nhất vào chỗ trống.${contextBlock}

CÂU HỎI:
${question}

YÊU CẦU TRẢ LỜI SIÊU TỐC, CHUẨN XÁC:
- Dòng 1: CHỈ ghi DUY NHẤT nội dung/từ/câu lệnh cần điền vào chỗ trống.
  + Giữ NGUYÊN dạng viết hoa/thường chuẩn xác (PascalCase, camelCase, UPPERCASE, từ viết tắt, tên hàm, class).
  + NẾU LÀ CÂU HỎI LẬP TRÌNH / CNTT (C#, ASP.NET, Java, C++, JS, SQL...):
    * Với câu hỏi yêu cầu lệnh / câu lệnh cấu hình (statement): Phải viết ĐẦY ĐỦ cú pháp gồm cặp ngoặc tròn và dấu chấm phẩy ; ở cuối nếu ngôn ngữ đó yêu cầu dấu chấm phẩy khi gọi lệnh (Ví dụ: app.UseStaticFiles(); hoặc builder.Services.AddControllersWithViews();).
    * Với tên phương thức / hàm / thuộc tính: Viết đúng dạng hàm (Ví dụ: UseStaticFiles() hoặc RenderBody()).
    * TUYỆT ĐỐI KHÔNG tự ý lược bỏ dấu ngoặc đơn (), dấu chấm, dấu chấm phẩy ; hay các ký tự cú pháp.
  + Không viết tiền tố thừa ("Đáp án là:", "Từ cần điền:"), không in đậm (**), không đặt trong dấu ngoặc kép.
  + Tuyệt đối không thêm ghi chú, giải thích hay từ đồng nghĩa trong ngoặc.
- TUYỆT ĐỐI không đưa ra nhiều lựa chọn, không giải thích dài dòng.`;
  } else if ((questionType === 'multiple-choice' || questionType === 'multiple-select') && options && options.length > 0) {
    const formattedOptions = options.map((opt, i) => {
      const letter = String.fromCharCode(65 + i);
      const cleanOpt = opt.replace(/^[A-F][\.\:\)\-–—]\s*/i, '').trim();
      return `${letter}. ${cleanOpt}`;
    }).join('\n');

    const isMultiSelect = questionType === 'multiple-select';

    prompt = `Bạn là chuyên gia giải đề thi trắc nghiệm. Hãy chọn đáp án chính xác nhất.${contextBlock}

CÂU HỎI:
${question}

DANH SÁCH PHƯƠNG ÁN:
${formattedOptions}

YÊU CẦU TRẢ LỜI (QUAN TRỌNG NHẤT):
- CHỈ TRẢ VỀ ĐÚNG 1 DÒNG DUY NHẤT: chữ cái đáp án kèm nội dung phương án (Ví dụ: A. for...of).${isMultiSelect ? ' Câu này chọn NHIỀU đáp án: liệt kê tất cả chữ cái đúng cách nhau dấu phẩy (Ví dụ: A, C, D).' : ''}
- TUYỆT ĐỐI KHÔNG giải thích, KHÔNG liệt kê bước suy luận, KHÔNG lặp lại đề bài, KHÔNG viết bất kỳ dòng nào khác.

Gợi ý suy nghĩ NGẦM trước khi kết luận (không được ghi các gợi ý này ra output):
- Đề phủ định ("Đâu KHÔNG phải...", "phát biểu SAI...", "ngoại trừ...") → chọn phương án SAI nhất, không phải đúng nhất.
- Đối chiếu từng phương án với TÀI LIỆU BÀI GIẢNG và nguồn tra cứu bên trên (nếu có): nguồn rõ ràng ủng hộ phương án nào thì chọn phương án đó.
- Cảnh giác bẫy ngôn từ "luôn luôn", "không bao giờ", "chỉ khi", "tất cả đều".
- Soát lại số liệu, đơn vị, tên hàm, cú pháp của phương án được chọn.`;
  } else if (questionType === 'true-false') {
    const isDeclaredMulti = /cho\s+từng\s+mệnh\s+đề|mỗi\s+mệnh\s+đề|các\s+mệnh\s+đề|các\s+phát\s+biểu|tính\s+chất\s+của|mỗi\s+nhận\s+định/i.test(question);
    const isSimpleTF = !isDeclaredMulti && options && options.length === 2 &&
      options.some(o => /^(?:đúng|true)$/i.test(o.trim())) &&
      options.some(o => /^(?:sai|false)$/i.test(o.trim()));

    // When options are empty or only contains words Đúng/Sai, extract statements from question text
    let effectiveOptions = (options && options.length > 0 && !isSimpleTF) ? options : [];
    if (effectiveOptions.length === 0 || isDeclaredMulti) {
      // Try to parse numbered lines from the question text itself
      const numberedLineRegex = /(?:^|\n)\s*(\d+)[\.\)\:\-–—]\s*(.{8,})/g;
      let match;
      const extractedStatements = [];
      while ((match = numberedLineRegex.exec(question)) !== null) {
        const stmtText = match[2].replace(/\s*(đúng|sai|true|false)\s*$/gi, '').trim();
        if (stmtText.length >= 8) {
          extractedStatements.push(stmtText);
        }
      }
      if (extractedStatements.length >= 2) {
        effectiveOptions = extractedStatements;
      }
    }

    if (effectiveOptions.length > 0) {
      const formattedStatements = effectiveOptions.map((opt, i) => {
        const cleanOpt = opt.replace(/^\d+[\.\:\)]\s*/i, '').trim();
        return `${i + 1}. ${cleanOpt}`;
      }).join('\n');

      prompt = `Bạn là chuyên gia giải đề thi. Hãy xác định ĐÚNG hoặc SAI cho từng mệnh đề sau.${contextBlock}

CÂU HỎI:
${question}

DANH SÁCH MỆNH ĐỀ:
${formattedStatements}

YÊU CẦU TRẢ LỜI CHUẨN XÁC:
- Với mỗi mệnh đề, hãy xác định Đúng hoặc Sai.
- BẮT BUỘC trả về đầy đủ ${effectiveOptions.length} dòng cho ${effectiveOptions.length} mệnh đề theo định dạng:
1. Đúng (hoặc 1. Sai)
2. Đúng (hoặc 2. Sai)
3. Đúng (hoặc 3. Sai)
...
- TUYỆT ĐỐI KHÔNG chỉ trả lời 1 mệnh đề, KHÔNG giải thích, không mở bài, không chào hỏi.`;
    } else if (!isSimpleTF) {
      // Modern exam True/False questions (Edux, CMCU, high school graduation exams, IT exams)
      // Almost all are multi-statement True/False questions
      prompt = `Bạn là chuyên gia giải đề thi. Đây là câu hỏi ĐÚNG / SAI gồm nhiều mệnh đề/phát biểu cần đánh giá.${contextBlock}

CÂU HỎI:
${question}

YÊU CẦU TRẢ LỜI CHUẨN XÁC:
- Đọc kỹ toàn bộ nội dung đề bài và xác định ĐÚNG hoặc SAI cho từng ý / mệnh đề.
- BẮT BUỘC trả về kết quả theo từng dòng có đánh số thứ tự:
1. Đúng (hoặc 1. Sai)
2. Đúng (hoặc 2. Sai)
3. Đúng (hoặc 3. Sai)
4. Đúng (hoặc 4. Sai)
- TUYỆT ĐỐI KHÔNG chỉ trả lời duy nhất 1 từ nếu đề có nhiều ý! Không giải thích dài dòng.`;
    } else {
      prompt = `Bạn là chuyên gia giải đề thi. Hãy trả lời câu hỏi ĐÚNG / SAI sau.${contextBlock}

CÂU HỎI:
${question}

YÊU CẦU:
- CHỈ TRẢ VỀ DUY NHẤT: ĐÚNG hoặc SAI trên 1 dòng. Không giải thích.`;
    }
  } else if (isEssayLikeQuestion(question, questionType, options)) {
    // ── Tự luận / câu trả lời dài (ô textarea): trả lời CHI TIẾT, ĐẦY ĐỦ ──
    prompt = `Bạn là chuyên gia học thuật. Hãy trả lời CHI TIẾT, ĐẦY ĐỦ câu hỏi tự luận sau.${contextBlock}

CÂU HỎI:
${question}

YÊU CẦU TRẢ LỜI:
- Câu đầu tiên đi thẳng vào trọng tâm câu hỏi, sau đó trình bày chi tiết, đầy đủ các ý chính.
- Giải thích rõ ràng từng ý, dùng đúng thuật ngữ/chuyên ngữ chuẩn của môn học.
- Nếu là câu hỏi lập trình: kèm code/ví dụ hoàn chỉnh, đúng cú pháp (đủ ngoặc (), dấu chấm phẩy ;).
- Có thể dùng gạch đầu dòng hoặc đánh số để trình bày rõ ràng; độ dài khoảng 150–300 từ hoặc dài hơn nếu đề yêu cầu.
- Ưu tiên TUYỆT ĐỐI nội dung đúng theo TÀI LIỆU BÀI GIẢNG (nếu có) và nguồn đối chiếu bên dưới.
- KHÔNG mở bài xã giao (VD: "Trong thời đại hiện nay..."), KHÔNG lặp lại đề bài, KHÔNG chào hỏi, KHÔNG kết thúc bằng lời cảm ơn hay nhận xét ngoài lề.`;
  } else {
    // ── Câu trả lời ngắn: trọng tâm, chính xác tuyệt đối ──
    prompt = `Bạn là chuyên gia giải đề thi. Hãy trả lời câu hỏi sau.${contextBlock}

CÂU HỎI:
${question}

YÊU CẦU TRẢ LỜI NGẮN, CHUẨN XÁC:
- Trả lời TRỌNG TÂM: chỉ 1 cụm từ / 1 con số / 1 thuật ngữ / tối đa 1 câu ngắn chính xác nhất.
- Giữ NGUYÊN dạng viết hoa/thường chuẩn xác (PascalCase, camelCase, UPPERCASE, từ viết tắt, tên hàm, class, đơn vị).
- Nếu là câu lệnh lập trình: viết ĐẦY ĐỦ cú pháp gồm cặp ngoặc tròn () và dấu chấm phẩy ; ở cuối nếu ngôn ngữ yêu cầu (VD: app.UseStaticFiles();).
- Không viết tiền tố thừa ("Đáp án là:", "Câu trả lời:"), không in đậm (**), không đặt trong ngoặc kép, không thêm ghi chú hay giải thích.
- TUYỆT ĐỐI không trả lời dàn trải, không đưa ra nhiều phương án.`;
  }

  return prompt;
}

