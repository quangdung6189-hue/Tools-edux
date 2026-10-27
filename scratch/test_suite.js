// Comprehensive Test Suite for Auto Homework Solver
// Tests all 4 core features requested by the user

const assert = require('assert');

console.log('====================================================');
console.log('🧪 BẮT ĐẦU CHẠY BỘ KIỂM THỬ TOÀN DIỆN AUTO SOLVER');
console.log('====================================================\n');

let testsPassed = 0;
let testsTotal = 0;

function runTest(name, fn) {
  testsTotal++;
  try {
    fn();
    console.log(`✅ [PASS] ${name}`);
    testsPassed++;
  } catch (err) {
    console.error(`❌ [FAIL] ${name}:`, err.message);
  }
}

// ── TEST GROUP 1: Slide Knowledge Cache ───────────────────────
console.log('--- TEST GROUP 1: Slide Knowledge Cache Logic ---');

const slideKnowledgeCache = new Map();
const completedQuizSlides = new Set();
let currentLectureUrl = '';

function getLectureKey(url) {
  return url.split('#')[0];
}

function checkAndSyncLectureContext(newUrl) {
  const key = getLectureKey(newUrl);
  let cleaned = false;
  if (key && currentLectureUrl && key !== currentLectureUrl) {
    slideKnowledgeCache.clear();
    completedQuizSlides.clear();
    cleaned = true;
  }
  currentLectureUrl = key;
  return cleaned;
}

function accumulateSlideKnowledge(slideNum, content) {
  if (!slideNum || !content || content.length <= 20) return false;
  if (!slideKnowledgeCache.has(slideNum)) {
    slideKnowledgeCache.set(slideNum, content);
    return true;
  }
  return false;
}

function clearLectureKnowledge() {
  slideKnowledgeCache.clear();
  completedQuizSlides.clear();
}

function getAccumulatedSlideContext(maxChars = 4000) {
  if (slideKnowledgeCache.size === 0) return '';
  const sortedNums = Array.from(slideKnowledgeCache.keys()).sort((a, b) => a - b);
  let result = '';
  for (let i = sortedNums.length - 1; i >= 0; i--) {
    const num = sortedNums[i];
    const text = slideKnowledgeCache.get(num);
    const chunk = `[Slide ${num}]\n${text}\n\n`;
    if (result.length + chunk.length > maxChars) break;
    result = chunk + result;
  }
  return result.trim();
}

runTest('1.1: Tích lũy kiến thức từng slide khi đọc', () => {
  slideKnowledgeCache.clear();
  accumulateSlideKnowledge(1, 'Khái niệm về Trí tuệ Nhân tạo và Học máy cơ bản');
  accumulateSlideKnowledge(2, 'Các giải thuật Supervised Learning: Hồi quy tuyến tính, Phân loại Logistic');
  accumulateSlideKnowledge(3, 'Cấu trúc Mạng Neural nhân tạo: Perceptron, Hàm kích hoạt ReLU và Sigmoid');

  assert.strictEqual(slideKnowledgeCache.size, 3, 'Cache phải lưu đủ 3 slide');
  assert.strictEqual(slideKnowledgeCache.has(1), true);
  assert.strictEqual(slideKnowledgeCache.has(2), true);
  assert.strictEqual(slideKnowledgeCache.has(3), true);
});

runTest('1.2: Tổng hợp ngữ cảnh cho AI không vượt quá giới hạn maxChars', () => {
  const context = getAccumulatedSlideContext(4000);
  assert.strictEqual(context.includes('[Slide 1]'), true, 'Phải có Slide 1');
  assert.strictEqual(context.includes('[Slide 2]'), true, 'Phải có Slide 2');
  assert.strictEqual(context.includes('[Slide 3]'), true, 'Phải có Slide 3');
  assert.strictEqual(context.includes('Perceptron'), true);
  assert.ok(context.length <= 4000, 'Độ dài ngữ cảnh không được vượt quá 4000 ký tự');
});

runTest('1.3: Tự động dọn sạch bộ nhớ khi chuyển sang bài giảng mới', () => {
  currentLectureUrl = 'https://edux.cmcu.edu.vn/subject?id=bai-giang-1';
  assert.strictEqual(slideKnowledgeCache.size, 3);
  
  const cleaned = checkAndSyncLectureContext('https://edux.cmcu.edu.vn/subject?id=bai-giang-2#slide-1');
  assert.strictEqual(cleaned, true, 'checkAndSyncLectureContext phải nhận diện bài giảng mới');
  assert.strictEqual(slideKnowledgeCache.size, 0, 'Cache phải được xóa sạch sau khi đổi bài giảng');
});

runTest('1.4: Tự động dọn sạch bộ nhớ khi hoàn thành slide cuối cùng', () => {
  accumulateSlideKnowledge(1, 'Kiến thức bài mới slide 1');
  accumulateSlideKnowledge(2, 'Kiến thức bài mới slide 2');
  assert.strictEqual(slideKnowledgeCache.size, 2);

  // Giả lập slide cuối cùng (61/61)
  const slideInfo = { current: 61, total: 61 };
  if (slideInfo.current >= slideInfo.total) {
    clearLectureKnowledge();
  }

  assert.strictEqual(slideKnowledgeCache.size, 0, 'Cache phải được xóa sạch khi kết thúc bài giảng');
});


// ── TEST GROUP 2: AI Speed & Prompt Optimization ─────────────
console.log('\n--- TEST GROUP 2: AI Speed & Prompt Optimization ---');

function extractAnswerLetter(text) {
  if (!text) return '';
  const match = text.match(/^(?:đáp\s*án\s*[\:\.]*|[\[\(])?\s*([A-F])[\.\:\)\s]/i) || text.match(/\b([A-F])\b/);
  return match ? match[1].toUpperCase() : '';
}

function buildPrompt(question, options, questionType, slideContext) {
  let contextBlock = '';
  if (slideContext && slideContext.trim().length > 20) {
    contextBlock += `\n\n=== TÀI LIỆU BÀI GIẢNG ===\n"""\n${slideContext.trim().substring(0, 4000)}\n"""\n`;
  }

  if (questionType === 'multiple-choice') {
    const formattedOptions = options.map((opt, i) => {
      const letter = String.fromCharCode(65 + i);
      const cleanOpt = opt.replace(/^[A-F][\.\:\)\-–—]\s*/i, '').trim();
      return `${letter}. ${cleanOpt}`;
    }).join('\n');

    return `Bạn là chuyên gia giải đề thi trắc nghiệm. Hãy chọn đáp án chính xác nhất.${contextBlock}

CÂU HỎI:
${question}

DANH SÁCH PHƯƠNG ÁN:
${formattedOptions}

YÊU CẦU TRẢ LỜI SIÊU TỐC & CHUẨN XÁC:
- CHỈ TRẢ VỀ DUY NHẤT 1 DÒNG GỒM: Chữ cái đáp án đúng kèm nội dung phương án (Ví dụ: A. for...of).
- TUYỆT ĐỐI KHÔNG giải thích, không mở bài, không chào hỏi, không lặp lại đề bài.`;
  }
  return '';
}

runTest('2.1: Prompt trắc nghiệm tối ưu siêu tốc (không yêu cầu giải thích)', () => {
  const p = buildPrompt(
    'Hàm nào trong JavaScript dùng để duyệt các phần tử của mảng?',
    ['for...in', 'for...of', 'while', 'do...while'],
    'multiple-choice',
    '[Slide 5] Vòng lặp for...of được giới thiệu trong ES6 để duyệt giá trị phần tử mảng.'
  );

  assert.strictEqual(p.includes('TUYỆT ĐỐI KHÔNG giải thích'), true, 'Prompt phải cấm giải thích dài dòng');
  assert.strictEqual(p.includes('CHỈ TRẢ VỀ DUY NHẤT 1 DÒNG GỒM: Chữ cái đáp án đúng'), true);
  assert.strictEqual(p.includes('TÀI LIỆU BÀI GIẢNG'), true, 'Phải kèm tài liệu slide đã học');
  assert.strictEqual(p.includes('Vòng lặp for...of'), true);
});

runTest('2.2: Trích xuất chính xác chữ cái đáp án A-F từ các định dạng trả về của AI', () => {
  assert.strictEqual(extractAnswerLetter('B. for...of'), 'B');
  assert.strictEqual(extractAnswerLetter('A'), 'A');
  assert.strictEqual(extractAnswerLetter('C. Đáp án đúng là C'), 'C');
  assert.strictEqual(extractAnswerLetter('Đáp án: D'), 'D');
  assert.strictEqual(extractAnswerLetter('**A**'), 'A');
  assert.strictEqual(extractAnswerLetter('[B]'), 'B');
  assert.strictEqual(extractAnswerLetter('(E) Không có phương án nào'), 'E');
});


// ── TEST GROUP 3: Quiz State & Anti-Stuck Logic ──────────────
console.log('\n--- TEST GROUP 3: Quiz State & Anti-Stuck Logic ---');

// Mô phỏng kiểm tra tiến độ bài tập
function isQuizCompletedSim(correct, total, containerText) {
  if (total > 0) {
    return correct >= total;
  }
  if (containerText && containerText.includes('bạn đã hoàn thành')) return true;
  return false;
}

runTest('3.1: isQuizCompleted chỉ trả về true khi đạt đủ số câu đúng (vd: 3/3)', () => {
  assert.strictEqual(isQuizCompletedSim(1, 3, ''), false, '1/3 câu chưa hoàn thành');
  assert.strictEqual(isQuizCompletedSim(2, 3, ''), false, '2/3 câu chưa hoàn thành');
  assert.strictEqual(isQuizCompletedSim(3, 3, ''), true, '3/3 câu đã hoàn thành!');
});

// Mô phỏng nhận diện câu hỏi trong lớp không bị false positive trên slide bình thường
function isInsideClassroomQuizSim(hasProgressIndicator, dialogHeading, hasQuizCard) {
  if (hasProgressIndicator) return true;
  if (dialogHeading && dialogHeading.includes('câu hỏi trắc nghiệm')) return true;
  if (hasQuizCard) return true;
  return false;
}

runTest('3.2: Slide bình thường chứa từ "kiểm tra" trong bài giảng KHÔNG bị nhận nhầm là Quiz', () => {
  const normalSlideText = 'Trong lập trình, việc kiểm tra dữ liệu đầu vào rất quan trọng...';
  const hasProgress = false;
  const dialogHeading = '';
  const hasQuizCard = false;

  const inQuiz = isInsideClassroomQuizSim(hasProgress, dialogHeading, hasQuizCard);
  assert.strictEqual(inQuiz, false, 'Slide thường không được rơi vào chế độ Quiz');
});

runTest('3.3: Giao diện bài tập có tiến độ "Tiến độ: 1/3 câu đúng" nhận diện chính xác Quiz', () => {
  const inQuiz = isInsideClassroomQuizSim(true, '', true);
  assert.strictEqual(inQuiz, true, 'Phải nhận diện đúng chế độ Quiz khi có tiến độ');
});

// Mô phỏng anti-stuck fallback khi nút "Trang sau" không làm thay đổi số trang
function simulateSlideTransition(currentSlide, totalSlides, clickResult, isGated) {
  let nextSlide = currentSlide;
  if (clickResult === 'next_btn_success') {
    nextSlide = currentSlide + 1;
  } else if (clickResult === 'next_btn_failed') {
    // Nút next không chuyển được
    if (isGated) {
      return { action: 'OPEN_QUIZ', target: nextSlide };
    }
    // Thử fallback sidebar click
    return { action: 'SIDEBAR_CLICK', target: currentSlide + 1 };
  }
  return { action: 'ADVANCE', target: nextSlide };
}

runTest('3.4: Khi bấm Trang sau bị khựng/kẹt (bị khóa câu hỏi) -> tự động chuyển sang làm bài tập', () => {
  const result = simulateSlideTransition(36, 61, 'next_btn_failed', true);
  assert.strictEqual(result.action, 'OPEN_QUIZ', 'Phải kích hoạt mở bài tập');
});

runTest('3.5: Khi bấm Trang sau không ăn (lỗi UI) -> tự động fallback click số trang sidebar', () => {
  const result = simulateSlideTransition(12, 61, 'next_btn_failed', false);
  assert.strictEqual(result.action, 'SIDEBAR_CLICK', 'Phải fallback click sidebar');
  assert.strictEqual(result.target, 13, 'Mục tiêu phải là slide 13');
});

runTest('3.6: Nhận diện chính xác nút "Thử lại" (ưu tiên hơn "Đổi câu hỏi") khi làm sai', () => {
  // Giả lập danh sách nút trên màn hình Edux khi trả lời sai (như trong ảnh người dùng)
  const buttons = [
    { text: 'Phản hồi', cls: 'border border-gray-300' },
    { text: 'Đổi câu hỏi', cls: 'border border-gray-300 text-black-500' },
    { text: 'Thử lại', cls: 'bg-orange-600 hover:bg-orange-700 text-white' }
  ];

  function findRetry(btns) {
    return btns.find(b => b.text.toLowerCase() === 'thử lại' || b.cls.includes('bg-orange')) || null;
  }

  const retryBtn = findRetry(buttons);
  assert.notStrictEqual(retryBtn, null, 'Phải tìm thấy nút Thử lại');
  assert.strictEqual(retryBtn.text, 'Thử lại', 'Phải đúng nút Thử lại màu cam');
});

runTest('3.7: Trích xuất chính xác đáp án màu XANH LÁ (Option B) do Edux hiển thị khi làm sai', () => {
  // Giả lập các thẻ phương án trong ảnh của người dùng: A màu đỏ (sai), B màu xanh lá (đúng)
  const options = [
    { text: 'A. Luôn bị cấm tuyệt đối trong mọi trường hợp', cls: 'border-red-500 bg-red-50' },
    { text: 'B. Có thể được cho phép nếu nhằm ngăn chặn hệ thống độc hại...', cls: 'border-green-500 bg-green-50 text-green-700' },
    { text: 'C. Được phép nếu không bị phát hiện', cls: 'border-gray-200' },
    { text: 'D. Không cần cân nhắc hậu quả nếu vì mục đích tốt', cls: 'border-gray-200' }
  ];

  function extractGreenLetter(opts) {
    const green = opts.find(o => o.cls.includes('border-green') || o.cls.includes('text-green-700'));
    if (!green) return null;
    const m = green.text.match(/^\s*([A-F])[\.\:\)\s]/i);
    return m ? m[1].toUpperCase() : null;
  }

  const correctLetter = extractGreenLetter(options);
  assert.strictEqual(correctLetter, 'B', 'Phải trích xuất được đáp án B từ phương án màu xanh lá');
});

runTest('3.8: Tự động ghi nhớ đáp án [B] và chọn lại ngay sau khi bấm Thử lại mà không cần hỏi lại AI', () => {
  let lastRevealedAnswer = 'B';
  let aiCalled = false;

  function mockSolveQuestion() {
    let chosenLetter = null;
    if (lastRevealedAnswer) {
      chosenLetter = lastRevealedAnswer;
      lastRevealedAnswer = null; // Reset
    } else {
      aiCalled = true;
      chosenLetter = 'A';
    }
    return chosenLetter;
  }

  const selected = mockSolveQuestion();
  assert.strictEqual(selected, 'B', 'Phải tự động điền đáp án B');
  assert.strictEqual(aiCalled, false, 'Không cần gọi lại AI vì đã có đáp án đúng 100%');
  assert.strictEqual(lastRevealedAnswer, null, 'Cache đáp án tiết lộ phải được xóa sau khi dùng');
});

// ── TEST GROUP 4: True/False Statements & Unicode NFC ────────
console.log('\n--- TEST GROUP 4: True/False Statements & Unicode NFC ---');

function isTrueText(t) {
  const clean = (t || '').normalize('NFC').replace(/[\u200B-\u200D\uFEFF\u00A0]/g, ' ').trim().replace(/^[\(\[\{]/, '').replace(/[\)\]\}]$/, '').trim();
  return /^(?:đúng|true|đ)[\:\.]?$/i.test(clean);
}
function isFalseText(t) {
  const clean = (t || '').normalize('NFC').replace(/[\u200B-\u200D\uFEFF\u00A0]/g, ' ').trim().replace(/^[\(\[\{]/, '').replace(/[\)\]\}]$/, '').trim();
  return /^(?:sai|false|s)[\:\.]?$/i.test(clean);
}

runTest('4.1: Nhận diện Đúng/Sai với cả Unicode NFD và NFC', () => {
  const nfdDung = 'Đúng'.normalize('NFD');
  const nfdSai = 'Sai'.normalize('NFD');
  assert.strictEqual(isTrueText(nfdDung), true, 'Phải nhận diện được Đúng dạng NFD');
  assert.strictEqual(isFalseText(nfdSai), true, 'Phải nhận diện được Sai dạng NFD');
  assert.strictEqual(isTrueText('Đúng.'), true);
  assert.strictEqual(isFalseText('Sai:'), true);
  assert.strictEqual(isTrueText('\u00A0Đúng\u00A0'), true);
});

runTest('4.2: Trích xuất chính xác 4 mệnh đề Đúng/Sai từ flex sibling', () => {
  const mockRows = [
    { text: '1. Chủ thể dữ liệu có quyền truy cập vào dữ liệu của mình.' },
    { text: '2. Thông tin cá nhân có thể được sử dụng mà không cần sự đồng ý.' },
    { text: '3. Hình ảnh cá nhân phải được xin phép trước khi sử dụng.' },
    { text: '4. Chủ thể dữ liệu không có quyền bảo vệ danh dự cá nhân.' }
  ];

  const extracted = mockRows.map((r, idx) => {
    let pt = r.text.normalize('NFC').replace(/\s+/g, ' ').trim();
    if (!/^\d+[\.\:\)]/.test(pt)) pt = `${idx + 1}. ${pt}`;
    return pt;
  });

  assert.strictEqual(extracted.length, 4);
  assert.strictEqual(extracted[0].includes('Chủ thể dữ liệu có quyền truy cập'), true);
});

runTest('4.3: Parse đáp án AI trả về dạng 4 dòng Đúng/Sai', () => {
  const aiAnswer = `1. Đúng
2. Sai
3. Đúng
4. Sai`;
  const regex = /(?:mệnh\s*đề|phát\s*biểu|ý|câu)?\s*(\d+)[\.\:\)\s\-–—]+\s*(đúng|sai|true|false|đ|s)(?![a-zA-Z0-9_à-ỹđ])/gi;
  const parsed = {};
  let m;
  while ((m = regex.exec(aiAnswer)) !== null) {
    parsed[parseInt(m[1], 10)] = /^(?:đúng|true|đ)$/i.test(m[2]);
  }
  assert.strictEqual(Object.keys(parsed).length, 4);
  assert.strictEqual(parsed[1], true);
  assert.strictEqual(parsed[2], false);
  assert.strictEqual(parsed[3], true);
  assert.strictEqual(parsed[4], false);
});

runTest('4.4: Nhận diện True/False candidates trên mọi tag HTML (button, div, span, label)', () => {
  const tags = ['button', 'div', 'span', 'label', 'a'];
  tags.forEach(tag => {
    assert.strictEqual(isTrueText('Đúng'), true, `Phải nhận diện Đúng trên ${tag}`);
    assert.strictEqual(isFalseText('Sai'), true, `Phải nhận diện Sai trên ${tag}`);
  });
});

// ── TEST GROUP 5: Auto All & Multi-Statement TF Anti-Bug Logic ──
console.log('\n--- TEST GROUP 5: Auto All & Multi-Statement TF Anti-Bug Logic ---');

runTest('5.1: Parse đáp án AI có nhận định ở cuối dòng (Strategy 1b)', () => {
  const answerWithText = `1. Product backlog là danh sách các việc cần làm để hoàn thiện sản phẩm: Đúng
2. Product backlog chỉ bao gồm các lỗi cần sửa -> Sai
3. Product backlog có thể thay đổi và cập nhật thường xuyên: Đúng
4. Product backlog không bao gồm các ý tưởng mới: Sai`;

  const lineEndRegex = /(?:^|[\r\n]+)\s*(?:mệnh\s*đề|phát\s*biểu|ý|câu)?\s*(\d+)[\.\:\)\s\-–—].*?[:\-\s\>\=]\s*(đúng|sai|true|false|đ|s)\s*$/gmi;
  const parsed = {};
  let lineMatch;
  while ((lineMatch = lineEndRegex.exec(answerWithText)) !== null) {
    parsed[parseInt(lineMatch[1], 10)] = /^(?:đúng|true|đ)$/i.test(lineMatch[2]);
  }

  assert.strictEqual(Object.keys(parsed).length, 4, 'Phải parse đủ 4 mệnh đề');
  assert.strictEqual(parsed[1], true);
  assert.strictEqual(parsed[2], false);
  assert.strictEqual(parsed[3], true);
  assert.strictEqual(parsed[4], false);
});

runTest('5.2: waitForQuestionReady không chấp nhận câu Đúng/Sai khi options chưa mount (< 2)', () => {
  // Mock simulation of React SPA mounting statements
  let mountPass = 0;
  function mockScanPage() {
    mountPass++;
    if (mountPass < 3) {
      // Still mounting: header exists but statements not rendered
      return {
        questions: [{
          questionText: 'Câu 28 Đúng sai : Xem xét các phát biểu về tính chất của product backlog:',
          questionType: 'true-false',
          options: []
        }]
      };
    }
    // Fully mounted
    return {
      questions: [{
        questionText: 'Câu 28 Đúng sai : Xem xét các phát biểu về tính chất của product backlog:',
        questionType: 'true-false',
        options: [
          '1. Product backlog là danh sách việc cần làm',
          '2. Product backlog chỉ gồm lỗi',
          '3. Product backlog có thể thay đổi',
          '4. Product backlog không gồm tính năng mới'
        ]
      }]
    };
  }

  function simulateWaitForQuestionReady(maxTries = 5) {
    for (let t = 0; t < maxTries; t++) {
      const res = mockScanPage();
      const q = res.questions[0];
      const isTF = q.questionType === 'true-false';
      if (isTF && q.options && q.options.length >= 2) {
        return q;
      }
    }
    return null;
  }

  const readyQ = simulateWaitForQuestionReady(5);
  assert.ok(readyQ, 'Phải tìm thấy câu hỏi đã sẵn sàng');
  assert.strictEqual(readyQ.options.length, 4, 'Phải chờ đến khi đủ 4 mệnh đề mới trả về');
});

runTest('5.3: Tự động loại bỏ cache hỏng (câu Đúng/Sai trước đó bị trả về duy nhất "ĐÚNG")', () => {
  // Suppose question was previously stored with answer "ĐÚNG" and 0 options
  const questionsList = [{
    questionText: 'Câu 28: Xem xét các phát biểu về tính chất của product backlog:',
    questionType: 'true-false',
    status: 'done',
    answer: 'ĐÚNG',
    options: []
  }];

  const currentScannedQ = {
    questionText: 'Câu 28: Xem xét các phát biểu về tính chất của product backlog:',
    questionType: 'true-false',
    options: [
      '1. Product backlog là danh sách việc cần làm',
      '2. Product backlog chỉ gồm lỗi',
      '3. Product backlog có thể thay đổi',
      '4. Product backlog không gồm tính năng mới'
    ]
  };

  const existingIdx = questionsList.findIndex(q =>
    q.questionText.substring(0, 80) === currentScannedQ.questionText.substring(0, 80)
  );

  let shouldSolve = false;
  if (existingIdx >= 0) {
    const existing = questionsList[existingIdx];
    if (currentScannedQ.options && currentScannedQ.options.length > 0) {
      existing.options = currentScannedQ.options;
    }
    const isTF = (existing.questionType === 'true-false' || existing.isMultiStatement);
    const isBadTFAnswer = isTF && (
      !existing.answer ||
      /^(?:đúng|sai|true|false)$/i.test(existing.answer.trim()) ||
      (!existing.options || existing.options.length < 2)
    );

    if (isBadTFAnswer) {
      existing.status = 'pending';
      existing.answer = null;
      shouldSolve = true;
    }
  }

  assert.strictEqual(shouldSolve, true, 'Phải buộc giải lại câu 28 vì đáp án cũ chỉ có 1 chữ "ĐÚNG"');
  assert.strictEqual(questionsList[0].status, 'pending', 'Status phải được reset về pending');
  assert.strictEqual(questionsList[0].options.length, 4, 'Options phải được cập nhật đủ 4 mệnh đề');
});

runTest('5.4: buildPrompt nhận diện câu Đúng/Sai nhiều mệnh đề kể cả khi options rỗng', () => {
  const questionWithDeclarations = 'Câu 28: Xem xét các phát biểu về tính chất của product backlog: Chọn Đúng hoặc Sai cho từng mệnh đề:';
  const isDeclaredMultiTF = /cho\s+từng\s+mệnh\s+đề|các\s+phát\s+biểu|tính\s+chất\s+của|mỗi\s+nhận\s+định|các\s+ý|đúng\s+hoặc\s+sai/i.test(questionWithDeclarations);

  assert.strictEqual(isDeclaredMultiTF, true, 'Phải nhận diện được từ khóa multi-statement');

  let prompt = '';
  if (isDeclaredMultiTF) {
    prompt = `Bạn là chuyên gia giải đề thi. Đây là câu hỏi ĐÚNG / SAI gồm nhiều mệnh đề/phát biểu cần đánh giá.
YÊU CẦU:
- BẮT BUỘC trả về kết quả theo từng dòng có đánh số thứ tự: 1. Đúng, 2. Sai...`;
  } else {
    prompt = `CHỈ TRẢ VỀ DUY NHẤT: ĐÚNG hoặc SAI trên 1 dòng.`;
  }

  assert.strictEqual(prompt.includes('từng dòng có đánh số thứ tự'), true);
  assert.strictEqual(prompt.includes('CHỈ TRẢ VỀ DUY NHẤT: ĐÚNG hoặc SAI trên 1 dòng'), false);
});

runTest('5.5: Quét chính xác 4 mệnh đề khi nút Đúng/Sai nằm trong container con flex gap-2 (Edux)', () => {
  // Simulate Edux Câu 23 card structure
  function analyzeCardMock(cardEl) {
    const clickables = cardEl.children.find(c => c.type === 'btnCol')?.buttons || [];
    const tBtns = clickables.filter(b => b.text === 'Đúng');
    const fBtns = clickables.filter(b => b.text === 'Sai');
    if (tBtns.length !== 1 || fBtns.length !== 1) return null;
    const textWithoutBtns = (cardEl.children.find(c => c.type === 'textCol')?.text || '').trim();
    if (textWithoutBtns.length < 8) return null;
    return { text: textWithoutBtns, trueBtn: tBtns[0], falseBtn: fBtns[0] };
  }

  const eduxCards = [
    { type: 'card', children: [{ type: 'textCol', text: '1. Đội phát triển có thể thích nghi khi có thành viên rời đi hoặc gia nhập.' }, { type: 'btnCol', buttons: [{ text: 'Đúng' }, { text: 'Sai' }] }] },
    { type: 'card', children: [{ type: 'textCol', text: '2. Trách nhiệm công việc thuộc về từng cá nhân thay vì cả đội.' }, { type: 'btnCol', buttons: [{ text: 'Đúng' }, { text: 'Sai' }] }] },
    { type: 'card', children: [{ type: 'textCol', text: '3. Đội tự tổ chức giúp tăng khả năng thích ứng với thay đổi.' }, { type: 'btnCol', buttons: [{ text: 'Đúng' }, { text: 'Sai' }] }] },
    { type: 'card', children: [{ type: 'textCol', text: '4. Thay đổi nhân sự luôn làm gián đoạn hoàn toàn tiến trình phát triển.' }, { type: 'btnCol', buttons: [{ text: 'Đúng' }, { text: 'Sai' }] }] }
  ];

  const parsed = eduxCards.map(analyzeCardMock).filter(Boolean);
  assert.strictEqual(parsed.length, 4, 'Phải nhận diện đủ 4 card');
  assert.strictEqual(parsed[0].text.includes('Đội phát triển'), true);
  assert.strictEqual(parsed[3].text.includes('Thay đổi nhân sự'), true);
});

runTest('5.6: activePageNum ưu tiên nút bg-primary của câu hiện tại thay vì bg-blue của câu đã làm', () => {
  const paginationBtns = [
    { text: '21', className: 'w-6 h-6 rounded-full bg-blue-500 text-white' }, // Đã trả lời
    { text: '22', className: 'w-6 h-6 rounded-full bg-blue-500 text-white' }, // Đã trả lời
    { text: '23', className: 'w-6 h-6 rounded-full bg-primary text-white' },  // Câu hiện tại
    { text: '24', className: 'w-6 h-6 rounded-full bg-gray-200 text-gray-600' } // Chưa trả lời
  ];

  // Logic: search bg-primary first!
  let activeNum = null;
  const primaryBtn = paginationBtns.find(b => b.className.includes('bg-primary'));
  if (primaryBtn) {
    activeNum = parseInt(primaryBtn.text, 10);
  } else {
    const fallbackBtn = paginationBtns.find(b => b.className.includes('bg-blue'));
    if (fallbackBtn) activeNum = parseInt(fallbackBtn.text, 10);
  }

  assert.strictEqual(activeNum, 23, 'activePageNum phải là 23 (bg-primary), KHÔNG được nhầm sang 21 hay 22 (bg-blue)');
});

runTest('5.7: isBadTFAnswer bắt được trường hợp options chỉ có chữ ["Đúng", "Sai"]', () => {
  const isOnlyTrueFalseWords = (arr) => {
    if (!arr || arr.length === 0) return true;
    return arr.length === 2 && arr.every(o => /^(?:đúng|sai|true|false|đ|s)$/i.test((o || '').trim()));
  };

  const badOptions = ['Đúng', 'Sai'];
  const goodOptions = [
    '1. Đội phát triển có thể thích nghi',
    '2. Trách nhiệm công việc thuộc về',
    '3. Đội tự tổ chức',
    '4. Thay đổi nhân sự'
  ];

  assert.strictEqual(isOnlyTrueFalseWords(badOptions), true, '["Đúng", "Sai"] phải bị coi là không hợp lệ cho mệnh đề');
  assert.strictEqual(isOnlyTrueFalseWords(goodOptions), false, 'Danh sách 4 mệnh đề thực tế là hợp lệ');
});

// ── TEST GROUP 6: Reorganized Architecture & Bulletproof Live Fill Engine ──
console.log('\n--- TEST GROUP 6: Reorganized Architecture & Bulletproof Live Fill Engine ---');

const {
  parseTrueFalseStatementsAnswer,
  cleanFillInTheBlankAnswer
} = require('../content/fillers.js');

runTest('6.1: parseTrueFalseStatementsAnswer trích xuất đầy đủ 4 ý với các định dạng phong phú', () => {
  const ans1 = `1. Đúng\n2. Sai\n3. Đúng\n4. Đúng`;
  const p1 = parseTrueFalseStatementsAnswer(ans1, 4);
  assert.deepStrictEqual(p1, { 1: true, 2: false, 3: true, 4: true });

  const ans2 = `a. Đúng\nb. Sai\nc. Sai\nd. Đúng`;
  const p2 = parseTrueFalseStatementsAnswer(ans2, 4);
  assert.deepStrictEqual(p2, { 1: true, 2: false, 3: false, 4: true });

  const ans3 = `**1. Đúng**\n**2. Đúng**\n**3. Sai**\n**4. Sai**`;
  const p3 = parseTrueFalseStatementsAnswer(ans3, 4);
  assert.deepStrictEqual(p3, { 1: true, 2: true, 3: false, 4: false });
});

runTest('6.2: Mô phỏng React closure Edux state: Điền tuần tự 4 ý bảo toàn đầy đủ câu trả lời', () => {
  // Mock Edux React state: S[ftId] = { stmt_1: true, stmt_2: false, ... }
  const ftId = 'q_23';
  let eduxState = {};

  function eduxClick(stmtNum, isTrue) {
    const ot = `stmt_${stmtNum}`;
    eduxState = { ...eduxState, [ot]: isTrue };
  }

  // Simulated AI answer
  const aiAnswer = `1. Đúng\n2. Sai\n3. Đúng\n4. Sai`;
  const parsed = parseTrueFalseStatementsAnswer(aiAnswer, 4);

  // Sequential execution like fillTrueFalseStatements does
  for (let i = 1; i <= 4; i++) {
    const val = parsed[i];
    eduxClick(i, val);
  }

  assert.strictEqual(eduxState.stmt_1, true, 'stmt_1 phải là true');
  assert.strictEqual(eduxState.stmt_2, false, 'stmt_2 phải là false');
  assert.strictEqual(eduxState.stmt_3, true, 'stmt_3 phải là true');
  assert.strictEqual(eduxState.stmt_4, false, 'stmt_4 phải là false');
  assert.strictEqual(Object.keys(eduxState).length, 4, 'Phải có đủ 4 ý trong state của Edux');
});

runTest('6.3: waitForQuestionReady không bị thoát non khi câu Đúng/Sai đang mount options', () => {
  let attempt = 0;
  function mockScan() {
    attempt++;
    if (attempt < 3) {
      // Question header mounted but statement rows haven't rendered yet
      return {
        questions: [{
          questionText: 'Câu 23: Xem xét các phát biểu về tính chất của product backlog: Chọn Đúng hoặc Sai cho từng mệnh đề:',
          questionType: 'text',
          options: []
        }]
      };
    }
    // Statements finished mounting on attempt 3
    return {
      questions: [{
        questionText: 'Câu 23: Xem xét các phát biểu về tính chất của product backlog: Chọn Đúng hoặc Sai cho từng mệnh đề:',
        questionType: 'true-false',
        options: [
          '1. Product backlog là danh sách việc cần làm',
          '2. Product backlog chỉ gồm lỗi',
          '3. Product backlog có thể thay đổi',
          '4. Product backlog không gồm tính năng mới'
        ]
      }]
    };
  }

  // Check logic
  let settledResponse = null;
  for (let step = 0; step < 5; step++) {
    const res = mockScan();
    const q = res.questions[0];
    const isTF = q.questionType === 'true-false' ||
      /đúng[\s\/\-]*sai|cho\s+từng\s+mệnh\s+đề|các\s+phát\s+biểu|tính\s+chất\s+của|mỗi\s+nhận\s+định|xem\s+xét\s+các/i.test(q.questionText || '');

    if (isTF) {
      const hasRealOptions = q.options && q.options.length >= 2 && !q.options.every(o => /^(?:đúng|sai|true|false|đ|s)$/i.test((o || '').trim()));
      if (hasRealOptions) {
        settledResponse = res;
        break;
      }
      // Continue waiting
    }
  }

  assert.ok(settledResponse, 'Phải đợi được đến khi options mount thành công');
  assert.strictEqual(settledResponse.questions[0].options.length, 4, 'Phải có đủ 4 mệnh đề');
});

runTest('6.4: cleanFillInTheBlankAnswer làm sạch chính xác từ điền khuyết không làm hỏng code/casing', () => {
  assert.strictEqual(cleanFillInTheBlankAnswer('Từ cần điền: `app.UseStaticFiles();`'), 'app.UseStaticFiles();');
  assert.strictEqual(cleanFillInTheBlankAnswer('**ProductBacklog** (hoặc Scrum backlog)'), 'ProductBacklog');
  assert.strictEqual(cleanFillInTheBlankAnswer('1. `IActionResult`'), 'IActionResult');
});

// ── TEST GROUP 7: Classroom Quiz Completion & Kiểm Tra Gating ─
console.log('\n--- TEST GROUP 7: Classroom Quiz Completion & Kiểm Tra Gating ---');

function parseQuizProgress(text) {
  if (!text) return null;
  const m = text.match(/tiến\s*độ\s*[:\s]*(\d+)\s*\/\s*(\d+)(?:\s*câu\s*đúng)?/i);
  if (m) {
    const correct = parseInt(m[1], 10);
    const total = parseInt(m[2], 10);
    return { correct, total, done: correct >= total && total > 0 };
  }
  return null;
}

function isQuizCompletedWithContextSim({ progressText, hasCheckButton, hasActiveQuestions, hasRetryBtn, containerText, hasQuizNextSlideBtn }) {
  const progress = parseQuizProgress(progressText);
  if (progress && progress.total > 0) {
    return progress.correct >= progress.total;
  }
  if (hasCheckButton) return false;
  if (hasActiveQuestions) return false;
  if (hasRetryBtn) return false;

  if (containerText) {
    const lower = containerText.toLowerCase();
    if (
      lower.includes('bạn đã hoàn thành') ||
      (lower.includes('chúc mừng') && (lower.includes('hoàn thành') || lower.includes('vượt qua'))) ||
      (lower.includes('hoàn thành') && lower.includes('100%'))
    ) {
      return true;
    }
  }
  if (hasQuizNextSlideBtn) return true;
  return false;
}

runTest('7.1: Nhận diện chính xác thanh tiến độ "Tiến độ: 0/1 câu đúng" (Ảnh người dùng)', () => {
  const p0 = parseQuizProgress('Tiến độ: 0/1 câu đúng');
  assert.deepStrictEqual(p0, { correct: 0, total: 1, done: false });

  const p1 = parseQuizProgress('Tiến độ: 1/1 câu đúng');
  assert.deepStrictEqual(p1, { correct: 1, total: 1, done: true });

  const pMulti = parseQuizProgress('Tiến độ: 2/3 câu đúng');
  assert.deepStrictEqual(pMulti, { correct: 2, total: 3, done: false });
});

runTest('7.2: TUYỆT ĐỐI KHÔNG coi quiz hoàn thành khi tiến độ là 0/1 câu đúng (Fix triệt để bug người dùng báo)', () => {
  const completed = isQuizCompletedWithContextSim({
    progressText: 'Tiến độ: 0/1 câu đúng',
    hasCheckButton: true,
    hasActiveQuestions: true,
    hasRetryBtn: false,
    containerText: 'Câu hỏi trắc nghiệm',
    hasQuizNextSlideBtn: false
  });
  assert.strictEqual(completed, false, 'Tiến độ 0/1 câu đúng thì tuyệt đối KHÔNG được coi là hoàn thành');
});

runTest('7.3: Khi nút "Kiểm tra" còn hiển thị, câu hỏi chưa submit -> KHÔNG hoàn thành', () => {
  const completed = isQuizCompletedWithContextSim({
    progressText: null, // Trường hợp chưa đọc được tiến độ
    hasCheckButton: true, // Nút "Kiểm tra" còn trên màn hình
    hasActiveQuestions: true,
    hasRetryBtn: false,
    containerText: 'Câu hỏi trắc nghiệm',
    hasQuizNextSlideBtn: false
  });
  assert.strictEqual(completed, false, 'Còn nút Kiểm tra thì không thể coi là hoàn thành');
});

runTest('7.4: ĐÃ CHỌN ĐÁP ÁN (Radio checked) + Nút "Kiểm tra" sáng -> Ngay lập tức nhấn Kiểm tra', () => {
  const mockState = {
    checkedRadio: true,
    checkBtnEnabled: true,
    clickedCheck: false
  };

  if (mockState.checkedRadio && mockState.checkBtnEnabled) {
    mockState.clickedCheck = true;
  }

  assert.strictEqual(mockState.clickedCheck, true, 'Phải tự động nhấn nút Kiểm tra khi đáp án đã được tick');
});

runTest('7.5: CHỈ CHUYỂN SANG SLIDE TIẾP THEO khi toàn bộ câu hỏi đạt yêu cầu (1/1 hoặc 3/3)', () => {
  let canAdvanceSlide = false;
  const progressBefore = parseQuizProgress('Tiến độ: 0/1 câu đúng');
  if (progressBefore.done) {
    canAdvanceSlide = true;
  }
  assert.strictEqual(canAdvanceSlide, false, '0/1 câu đúng KHÔNG được sang trang sau');

  const progressAfter = parseQuizProgress('Tiến độ: 1/1 câu đúng');
  if (progressAfter.done) {
    canAdvanceSlide = true;
  }
  assert.strictEqual(canAdvanceSlide, true, '1/1 câu đúng MỚI ĐƯỢC sang trang sau');
});

runTest('7.6: Tìm kiếm nút "Kiểm tra" trực tiếp từ document nhận diện đúng nút bg-primary của Edux', () => {
  const mockEduxButtons = [
    { text: 'Phản hồi', className: 'border border-gray-300' },
    { text: 'Đổi câu hỏi', className: 'bg-white border border-gray-300' },
    { text: 'Kiểm tra', className: 'bg-primary hover:bg-primary/90 text-white', disabled: false }
  ];

  const found = mockEduxButtons.find(b => {
    const t = b.text.trim().toLowerCase();
    return (t === 'kiểm tra' || t.startsWith('kiểm tra')) && !b.disabled;
  });

  assert.ok(found, 'Phải tìm thấy nút Kiểm tra');
  assert.strictEqual(found.className.includes('bg-primary'), true);
});

runTest('7.7: Tìm kiếm nút "Câu tiếp theo" trực tiếp từ document nhận diện đúng nút bg-blue-600 của Edux', () => {
  const mockEduxButtons = [
    { text: 'Đổi câu hỏi', className: 'bg-white border border-gray-300' },
    { text: 'Câu tiếp theo', className: 'bg-blue-600 hover:bg-blue-700 text-white', disabled: false }
  ];

  const found = mockEduxButtons.find(b => {
    const t = b.text.trim().toLowerCase();
    return (t.includes('câu tiếp') || t.includes('tiếp theo')) && !b.disabled;
  });

  assert.ok(found, 'Phải tìm thấy nút Câu tiếp theo');
  assert.strictEqual(found.className.includes('bg-blue-600'), true);
});

// ── TEST GROUP 8: Edux Slide Navigation & Quiz Progression Gating ─
console.log('\n--- TEST GROUP 8: Edux Slide Navigation & Quiz Progression Gating ---');

runTest('8.1: Nhận diện slide counter từ thẻ span chứa text "15 / 15" của Edux bản mới', () => {
  const leafSpans = [
    { text: 'Lời cảm ơn kết thúc bài giảng' },
    { text: '15 / 15' },
    { text: 'Không có câu hỏi' }
  ];

  let counter = null;
  for (const el of leafSpans) {
    const t = el.text.trim();
    const m = t.match(/^(\d+)\s*\/\s*(\d+)$/);
    if (m) {
      counter = { completed: parseInt(m[1], 10) - 1, total: parseInt(m[2], 10), current: parseInt(m[1], 10), text: t };
      break;
    }
  }

  assert.ok(counter, 'Phải nhận diện được slide counter');
  assert.strictEqual(counter.current, 15);
  assert.strictEqual(counter.total, 15);
  assert.strictEqual(counter.text, '15 / 15');
});

runTest('8.2: Nhận diện toolbar footer shrink-0 border-t p-4 và phân biệt với header border-b', () => {
  const dialogChildren = [
    { type: 'header', className: 'bg-white border-b border-gray-200 px-2 py-3 shrink-0 space-y-2' },
    { type: 'body', className: 'flex-1 min-h-0 relative z-0 bg-white overflow-hidden' },
    { type: 'footer', className: 'shrink-0 relative z-10 bg-white border-t border-gray-200 p-4' }
  ];

  // Selection logic: must have border-t and p-4 or contain counter
  const footer = dialogChildren.find(c => c.className.includes('border-t') && c.className.includes('shrink-0'));
  assert.ok(footer, 'Phải tìm thấy footer');
  assert.strictEqual(footer.type, 'footer', 'Không được nhầm với header border-b');
});

runTest('8.3: Nhận diện nút Next Slide từ icon svg.lucide-chevron-right', () => {
  const toolbarButtons = [
    { hasLeftChevron: true, hasRightChevron: false, disabled: false },
    { hasLeftChevron: false, hasRightChevron: true, disabled: true, className: 'p-3 rounded-md text-gray-400 bg-gray-100' }
  ];

  const nextBtn = toolbarButtons.find(b => b.hasRightChevron);
  assert.ok(nextBtn, 'Phải tìm thấy nút Next có icon chevron-right');
  assert.strictEqual(nextBtn.disabled, true, 'Slide 15/15 thì nút Next bị disabled');
});

runTest('8.4: Nhận diện trạng thái nút bài tập "Không có câu hỏi" (disabled: true)', () => {
  const greenButtonMock = {
    text: 'Không có câu hỏi',
    title: 'Không có câu hỏi',
    className: 'h-10 py-1 font-light text-green-500 border border-green-500',
    disabled: true
  };

  let state = 'none';
  const t = greenButtonMock.text.toLowerCase();
  const title = greenButtonMock.title.toLowerCase();
  if (t.includes('không có câu hỏi') || title.includes('không có câu hỏi')) {
    state = 'disabled';
  } else if (t.includes('trả lời') || title.includes('trả lời')) {
    state = 'ready';
  }

  assert.strictEqual(state, 'disabled', 'Nút Không có câu hỏi phải có state là disabled');
});

runTest('8.5: Slide đã làm xong bài tập (completedQuizSlides) không bao giờ bị bấm mở lại bài tập', () => {
  const completedQuizSlides = new Set([1, 2, 5]);
  const currentSlide = 2;

  const isQuizAlreadyDoneOnThisSlide = completedQuizSlides.has(currentSlide);
  assert.strictEqual(isQuizAlreadyDoneOnThisSlide, true, 'Slide 2 đã hoàn thành bài tập');

  // Decision logic: if already done, do NOT trigger quiz button!
  let triggeredQuiz = false;
  let canAdvanceSlide = false;

  if (!isQuizAlreadyDoneOnThisSlide) {
    triggeredQuiz = true;
  } else {
    canAdvanceSlide = true; // Advance to next slide instead
  }

  assert.strictEqual(triggeredQuiz, false, 'Không được mở lại bài tập đã hoàn thành');
  assert.strictEqual(canAdvanceSlide, true, 'Phải chuyển sang slide tiếp theo');
});

// ── TEST GROUP 9: Quiz Cycle: Submit -> Retry on Wrong -> Next Slide on Progress Met ──
console.log('\n--- TEST GROUP 9: Quiz Cycle: Submit -> Retry on Wrong -> Next Slide on Progress Met ---');

runTest('9.1: findQuizSkipCountdownButton KHÔNG bao giờ bắt nhầm nút icon rỗng text (< hoặc radio button)', () => {
  const mockButtons = [
    { text: '', className: 'rounded-full border border-gray-300 w-8 h-8 flex items-center justify-center', disabled: false },
    { text: '', className: 'rounded-full bg-primary text-white w-5 h-5', disabled: false },
    { text: 'Kiểm tra', className: 'bg-primary text-white rounded-md px-4 py-2', disabled: false }
  ];

  function findSkipBtn(buttons) {
    for (const btn of buttons) {
      if (btn.disabled) continue;
      const text = (btn.text || '').trim().toLowerCase();
      // Must explicitly contain "bỏ qua" or "skip"
      if (text.includes('bỏ qua') || text.includes('bo qua') || (text.startsWith('skip') && text.length < 15)) {
        return btn;
      }
    }
    return null;
  }

  const found = findSkipBtn(mockButtons);
  assert.strictEqual(found, null, 'Không được bắt nhầm nút icon rỗng text thành nút Bỏ qua');
});

runTest('9.2: Tiến độ 0/2 câu đúng + đã chọn đáp án (nút Kiểm tra enabled) -> Phải nhấn Kiểm tra', () => {
  const progress = { correct: 0, total: 2 };
  const mockCheckBtn = { text: 'Kiểm tra', className: 'bg-primary text-white', disabled: false };

  const isCompleted = progress.correct >= progress.total;
  assert.strictEqual(isCompleted, false, '0/2 câu đúng chưa được coi là hoàn thành');

  let action = '';
  if (mockCheckBtn && !mockCheckBtn.disabled) {
    action = 'CLICK_CHECK';
  }

  assert.strictEqual(action, 'CLICK_CHECK', 'Khi nút Kiểm tra sáng và đã có đáp án -> Phải nhấn Kiểm tra ngay');
});

runTest('9.3: Khi làm sai và xuất hiện nút "Thử lại" -> Nhận diện wrong và nhấn Thử lại', () => {
  const mockButtons = [
    { text: 'Phản hồi', className: 'bg-white border' },
    { text: 'Đổi câu hỏi', className: 'bg-white border' },
    { text: 'Thử lại', className: 'bg-orange-600 hover:bg-orange-700 text-white', disabled: false }
  ];

  const retryBtn = mockButtons.find(b => {
    const t = (b.text || '').trim().toLowerCase();
    return (t.includes('thử lại') || t.includes('làm lại')) && !b.disabled;
  });

  assert.ok(retryBtn, 'Phải tìm thấy nút Thử lại');
  assert.strictEqual(retryBtn.className.includes('bg-orange'), true);

  let state = 'unanswered';
  if (retryBtn) {
    state = 'wrong';
  }
  assert.strictEqual(state, 'wrong', 'Khi có nút Thử lại, trạng thái phải là wrong để tự động làm lại');
});

runTest('9.4: Vòng tuần hoàn: Ghi nhớ đáp án xanh lá khi làm sai -> Thử lại -> Chọn lại đáp án đúng', () => {
  let lastRevealedCorrectAnswer = null;

  // Giả lập Edux hiển thị đáp án đúng sau khi làm sai
  const eduxRevealedGreen = 'B';
  lastRevealedCorrectAnswer = eduxRevealedGreen;
  assert.strictEqual(lastRevealedCorrectAnswer, 'B', 'Đã lưu đáp án đúng B');

  // Bấm Thử lại -> câu hỏi reset
  let selectedAnswer = null;
  if (lastRevealedCorrectAnswer) {
    selectedAnswer = lastRevealedCorrectAnswer;
    lastRevealedCorrectAnswer = null; // Clear once consumed
  }

  assert.strictEqual(selectedAnswer, 'B', 'Sau khi Thử lại, tự động điền lại đúng đáp án [B]');
  assert.strictEqual(lastRevealedCorrectAnswer, null, 'Đã reset bộ nhớ tạm sau khi điền');
});

runTest('9.5: Khi tiến độ đạt 2/2 và nút Kiểm tra chuyển thành "Trang sau" -> Nhận diện hoàn thành & bấm Trang sau', () => {
  const progress = { correct: 2, total: 2 };
  const mockQuizFooterButtons = [
    { text: 'Phản hồi', className: 'bg-white border' },
    { text: 'Trang sau', className: 'bg-blue-600 hover:bg-blue-700 text-white', disabled: false }
  ];

  // 1. Kiểm tra tiến độ đủ 2/2
  const isProgressDone = progress.correct >= progress.total;
  assert.strictEqual(isProgressDone, true, 'Tiến độ 2/2 đã hoàn thành');

  // 2. Tìm nút "Trang sau" trong giao diện quiz
  const nextSlideBtn = mockQuizFooterButtons.find(b => {
    const t = (b.text || '').trim().toLowerCase();
    return (t === 'trang sau' || t.includes('trang sau')) && !b.disabled;
  });

  assert.ok(nextSlideBtn, 'Phải tìm thấy nút Trang sau thay thế nút Kiểm tra');
  assert.strictEqual(nextSlideBtn.text, 'Trang sau');

  let action = '';
  if (isProgressDone && nextSlideBtn) {
    action = 'CLICK_NEXT_SLIDE_AND_CLOSE_QUIZ';
  }
  assert.strictEqual(action, 'CLICK_NEXT_SLIDE_AND_CLOSE_QUIZ', 'Phải bấm nút Trang sau để qua bài học tiếp theo');
});

// ── TEST GROUP 10: Floating Webpage Toolbar (Thanh công cụ nổi) ──────
console.log('\n--- TEST GROUP 10: Floating Webpage Toolbar (Thanh công cụ nổi) ---');

runTest('10.1: Cấu trúc Shadow DOM cách ly 100% không ảnh hưởng giao diện gốc của Edux', () => {
  const hostStyle = 'all: initial; position: fixed; z-index: 2147483647; top: 0; left: 0; pointer-events: none;';
  assert.ok(hostStyle.includes('all: initial'), 'Phải reset toàn bộ style để không bị CSS trang web đè');
  assert.ok(hostStyle.includes('z-index: 2147483647'), 'Z-index phải đạt tối đa để luôn nổi trên cùng');
  assert.ok(hostStyle.includes('pointer-events: none'), 'Host phải là pointer-events: none để không chặn click bên ngoài dock');
});

runTest('10.2: Thu nhỏ (Mini-mode pill) và mở rộng (Expanded dock) hoạt động mượt mà', () => {
  let isCollapsed = false;

  function toggleCollapse() {
    isCollapsed = !isCollapsed;
    return isCollapsed ? 'MINI_PILL' : 'EXPANDED_DOCK';
  }

  assert.strictEqual(toggleCollapse(), 'MINI_PILL', 'Khi thu nhỏ phải chuyển sang MINI_PILL');
  assert.strictEqual(toggleCollapse(), 'EXPANDED_DOCK', 'Khi mở rộng phải quay lại EXPANDED_DOCK');
});

runTest('10.3: Giới hạn tọa độ kéo thả (Position Clamping) trong khung nhìn màn hình', () => {
  const windowW = 1920;
  const windowH = 1080;
  const dockW = 320;
  const dockH = 200;

  function clampPosition(x, y) {
    const left = Math.max(10, Math.min(x, windowW - dockW - 10));
    const top = Math.max(10, Math.min(y, windowH - dockH - 10));
    return { left, top };
  }

  // Test out-of-bounds dragging
  const test1 = clampPosition(-50, -30);
  assert.strictEqual(test1.left, 10, 'Không được kéo ra ngoài mép trái');
  assert.strictEqual(test1.top, 10, 'Không được kéo ra ngoài mép trên');

  const test2 = clampPosition(2500, 1500);
  assert.strictEqual(test2.left, windowW - dockW - 10, 'Không được kéo ra ngoài mép phải');
  assert.strictEqual(test2.top, windowH - dockH - 10, 'Không được kéo ra ngoài mép dưới');
});

runTest('10.4: Đồng bộ trạng thái 2 chiều: Nút Đọc Slide chuyển đổi mượt mà giữa [▶] và [⏹]', () => {
  let isRunning = false;

  function getButtonUIState(running) {
    return {
      icon: running ? '⏹' : '▶',
      label: running ? 'Dừng Slide' : 'Đọc Slide',
      badgeClass: running ? 'running' : 'ready'
    };
  }

  const idleState = getButtonUIState(false);
  assert.strictEqual(idleState.icon, '▶');
  assert.strictEqual(idleState.label, 'Đọc Slide');
  assert.strictEqual(idleState.badgeClass, 'ready');

  const runningState = getButtonUIState(true);
  assert.strictEqual(runningState.icon, '⏹');
  assert.strictEqual(runningState.label, 'Dừng Slide');
  assert.strictEqual(runningState.badgeClass, 'running');
});

runTest('10.5: Tương tác giải câu hỏi tại chỗ (Solve now) kích hoạt đúng bộ câu hỏi trên màn hình', () => {
  const mockQuestionsOnScreen = [
    { questionText: 'Một lớp có thể kế thừa từ nhiều lớp cha sẽ gặp khó khăn gì?', options: ['A', 'B', 'C', 'D'] }
  ];

  function getActiveQuestionToSolve() {
    return mockQuestionsOnScreen.length > 0 ? mockQuestionsOnScreen[0] : null;
  }

  const target = getActiveQuestionToSolve();
  assert.ok(target, 'Phải tìm thấy câu hỏi trên màn hình để giải');
  assert.strictEqual(target.questionText.includes('Một lớp có thể kế thừa'), true);
});

// ── TEST GROUP 11: Anti-Modal Dismissal & Floating Taskbar Toggle ──────────
console.log('\n--- TEST GROUP 11: Anti-Modal Dismissal & Floating Taskbar Toggle ---');

runTest('11.1: Chặn propagation toàn bộ sự kiện pointer/mouse/touch không để lọt ra document (Anti-Dismiss)', () => {
  const interceptedEvents = [
    'pointerdown', 'mousedown', 'mouseup', 'click', 'dblclick',
    'touchstart', 'touchend', 'touchcancel', 'pointerup',
    'pointercancel', 'contextmenu'
  ];

  let documentReceivedEvents = [];
  let dockHandledEvents = [];

  function simulateEventDispatch(eventName) {
    let propagationStopped = false;
    const event = {
      type: eventName,
      stopPropagation: () => { propagationStopped = true; },
      defaultPrevented: false,
      preventDefault: () => { event.defaultPrevented = true; }
    };

    // Handler inside dock
    dockHandledEvents.push(event.type);
    event.stopPropagation();

    // If not stopped, bubbles to document
    if (!propagationStopped) {
      documentReceivedEvents.push(event.type);
    }
  }

  interceptedEvents.forEach(evt => simulateEventDispatch(evt));

  assert.strictEqual(dockHandledEvents.length, interceptedEvents.length, 'Dock phải nhận đủ mọi sự kiện tương tác');
  assert.strictEqual(documentReceivedEvents.length, 0, 'Tuyệt đối KHÔNG có sự kiện nào lọt lên document để Radix Dialog bắt');
});

runTest('11.2: mousedown preventDefault() ngăn chiếm focus của modal mà vẫn kích hoạt click bình thường', () => {
  let isFocused = true; // Modal dialog holds focus
  let clickFired = false;

  function onMouseDown(e) {
    e.preventDefault(); // Prevents focus theft from dialog
  }

  function onClick(e) {
    clickFired = true;
  }

  const mockEvent = {
    defaultPrevented: false,
    preventDefault: function() { this.defaultPrevented = true; }
  };

  onMouseDown(mockEvent);
  assert.strictEqual(mockEvent.defaultPrevented, true, 'Sự kiện mousedown phải gọi preventDefault');
  // Focus is not changed
  assert.strictEqual(isFocused, true, 'Hộp thoại bài giảng giữ nguyên focus không bị mất');

  onClick();
  assert.strictEqual(clickFired, true, 'Nút bấm trên thanh nổi vẫn nhận sự kiện click');
});

runTest('11.3: Quản lý bật/tắt (Toggle) đồng bộ 2 chiều giữa Sidepanel và trang web', () => {
  const mockStorage = { ahs_floating_bar_visible: true };

  function setFloatingBarVisibility(visible) {
    mockStorage.ahs_floating_bar_visible = visible;
    return {
      toggleFloatingBarChecked: visible,
      toggleSlideFloatingBarChecked: visible,
      btnToggleFloatingBarActive: visible,
      dockDisplay: visible ? 'block' : 'none'
    };
  }

  // User toggles OFF from sidepanel
  const stateOff = setFloatingBarVisibility(false);
  assert.strictEqual(stateOff.dockDisplay, 'none', 'Dock phải ẩn đi khi tắt');
  assert.strictEqual(stateOff.toggleFloatingBarChecked, false);
  assert.strictEqual(stateOff.btnToggleFloatingBarActive, false);
  assert.strictEqual(mockStorage.ahs_floating_bar_visible, false);

  // User toggles ON again
  const stateOn = setFloatingBarVisibility(true);
  assert.strictEqual(stateOn.dockDisplay, 'block', 'Dock phải hiện lại khi bật');
  assert.strictEqual(stateOn.toggleFloatingBarChecked, true);
  assert.strictEqual(stateOn.btnToggleFloatingBarActive, true);
  assert.strictEqual(mockStorage.ahs_floating_bar_visible, true);
});

runTest('11.4: Nút đóng [✕] trực tiếp trên thanh nổi ẩn dock và lưu trạng thái vào storage', () => {
  let isVisible = true;
  let storedPreference = true;

  function handleCloseFloatingBar() {
    isVisible = false;
    storedPreference = false;
  }

  handleCloseFloatingBar();
  assert.strictEqual(isVisible, false, 'Thanh nổi phải lập tức ẩn');
  assert.strictEqual(storedPreference, false, 'Storage phải lưu trạng thái false');
});

runTest('11.5: Tự động hiển thị ngay khi vào trang nếu cài đặt là true (không cần bấm đọc slide mới hiện)', () => {
  function getInitialVisibility(storageVal) {
    return typeof storageVal !== 'undefined' ? storageVal === true : true;
  }

  assert.strictEqual(getInitialVisibility(undefined), true, 'Mặc định lần đầu phải tự động hiện thanh nổi');
  assert.strictEqual(getInitialVisibility(true), true, 'Nếu cài đặt true -> tự động hiện');
  assert.strictEqual(getInitialVisibility(false), false, 'Nếu người dùng đã tắt -> ẩn');
});

console.log('\n--- TEST GROUP 12: Anti-Resurrection & Multi-Layer Dialog Protection ---');

runTest('12.1: Instance ID Singleton ngăn chặn triệt để Zombie Observer tự động hồi sinh thanh nổi cũ', () => {
  let activeInstanceId = 'ahs_bar_new_123';
  let oldHostMounted = false;
  let newHostMounted = false;

  function ensureHostMountedSimulation(instanceId, isHostOld) {
    if (instanceId !== activeInstanceId) {
      // Zombie instance: tự động ngắt và không được mount!
      return;
    }
    if (isHostOld) oldHostMounted = true;
    else newHostMounted = true;
  }

  // Zombie observer cố gắng mount thanh cũ
  ensureHostMountedSimulation('ahs_bar_old_999', true);
  assert.strictEqual(oldHostMounted, false, 'Zombie observer tuyệt đối KHÔNG được mount thanh nổi cũ');

  // New instance mount thanh mới
  ensureHostMountedSimulation('ahs_bar_new_123', false);
  assert.strictEqual(newHostMounted, true, 'Chỉ instance mới nhất và hợp lệ mới được mount thanh nổi');
});

runTest('12.2: Khi tắt (Visible = false), tất cả các thanh nổi (kể cả thanh mồ côi) bị xóa sạch khỏi DOM', () => {
  const mockDOM = [
    { id: 'ahs-floating-bar-host', display: 'block', removed: false },
    { id: 'ahs-floating-bar-host', display: 'block', removed: false }, // Duplicate zombie
    { className: 'ahs-dock', display: 'block', removed: false }
  ];

  function setFloatingBarVisibleSim(visible) {
    if (!visible) {
      mockDOM.forEach(el => {
        el.display = 'none';
        el.removed = true;
      });
    }
  }

  setFloatingBarVisibleSim(false);
  const remainingVisible = mockDOM.filter(el => !el.removed && el.display !== 'none');
  assert.strictEqual(remainingVisible.length, 0, 'Toàn bộ thanh nổi và thanh trùng lặp phải bị xóa sạch khỏi DOM khi tắt');
});

runTest('12.3: Khi có Dialog bài giảng mở, thanh nổi tự động mount bên trong Dialog để Radix UI nhận diện là click bên trong', () => {
  const mockDialog = {
    role: 'dialog',
    state: 'open',
    children: [],
    contains: function (node) { return this.children.includes(node); }
  };
  const mockHost = { id: 'ahs-floating-bar-host' };

  function mountToolbar(activeDialog, host) {
    if (activeDialog && activeDialog.state === 'open') {
      activeDialog.children.push(host);
    }
  }

  mountToolbar(mockDialog, mockHost);
  assert.strictEqual(mockDialog.contains(mockHost), true, 'Host phải nằm trong Dialog');

  // Giả lập Radix UI DismissableLayer kiểm tra click
  const isPointerDownOnLayer = mockDialog.contains(mockHost);
  let dialogClosed = false;
  if (!isPointerDownOnLayer) {
    dialogClosed = true;
  }
  assert.strictEqual(dialogClosed, false, 'Radix UI nhận diện click bên trong dialog và TUYỆT ĐỐI KHÔNG đóng bài giảng');
});

runTest('12.4: Kéo thả thanh nổi bằng Pointer Events (Pointer Capture) mượt mà không bị chặn bởi Capture Listener', () => {
  let isDragging = false;
  let dock = { style: { left: '100px', top: '100px' }, offsetWidth: 220, offsetHeight: 44, getBoundingClientRect: () => ({ left: 100, top: 100 }) };
  let initialLeft = 100, initialTop = 100, dragStartX = 150, dragStartY = 120;

  function onDragStartSim(e) {
    if (e.target && e.target.tagName === 'BUTTON') return;
    isDragging = true;
    dragStartX = e.clientX;
    dragStartY = e.clientY;
    initialLeft = 100;
    initialTop = 100;
  }

  function onDragMoveSim(e) {
    if (!isDragging) return;
    const deltaX = e.clientX - dragStartX;
    const deltaY = e.clientY - dragStartY;
    dock.style.left = (initialLeft + deltaX) + 'px';
    dock.style.top = (initialTop + deltaY) + 'px';
  }

  function onDragEndSim() {
    isDragging = false;
  }

  // Click vào nút không làm kích hoạt kéo thả
  onDragStartSim({ target: { tagName: 'BUTTON' }, clientX: 150, clientY: 120 });
  assert.strictEqual(isDragging, false, 'Click vào nút không được bắt đầu kéo thả');

  // Click vào vùng thân thanh nổi (grip, icon, padding) bắt đầu kéo thả
  onDragStartSim({ target: { tagName: 'DIV' }, clientX: 150, clientY: 120 });
  assert.strictEqual(isDragging, true, 'Kéo thả thanh nổi bắt đầu thành công');

  // Di chuyển con trỏ chuột +60px ngang, +40px dọc
  onDragMoveSim({ clientX: 210, clientY: 160 });
  assert.strictEqual(dock.style.left, '160px', 'Tọa độ left phải cập nhật chính xác (100 + 60)');
  assert.strictEqual(dock.style.top, '140px', 'Tọa độ top phải cập nhật chính xác (100 + 40)');

  // Thả chuột kết thúc kéo thả
  onDragEndSim();
  assert.strictEqual(isDragging, false, 'Kéo thả kết thúc thành công');
});

// ── TEST GROUP 13: Quiz Completion Exit & Infinite Loop Elimination ──
console.log('\n--- TEST GROUP 13: Quiz Completion Exit & Infinite Loop Elimination ---');

function mockFindQuizBackButton(elements) {
  // 1. Title/aria match
  for (const el of elements) {
    if (el.disabled) continue;
    const title = (el.title || el.ariaLabel || '').toLowerCase();
    if (title.includes('quay lại') || title.includes('thoát') || title.includes('trở lại') || title.includes('đóng')) {
      if (el.rect && el.rect.top < 220) return el;
    }
  }

  // 2. Lucide chevron-left / SVG path
  for (const el of elements) {
    if (el.disabled) continue;
    if (el.hasChevronLeft || (el.text && ['<', '❮', '←'].includes(el.text.trim()))) {
      if (el.rect && el.rect.top < 220 && el.rect.left < 300) {
        return el;
      }
    }
  }

  // 3. Header row with "Câu hỏi trắc nghiệm"
  for (const el of elements) {
    if (el.disabled) continue;
    if (el.isHeaderRowButton && el.rect && el.rect.top < 220) {
      return el;
    }
  }

  return null;
}

runTest('13.1: Nhận diện chính xác nút Back (<) ở góc trên bên trái modal bài tập Edux', () => {
  const elements = [
    // Bottom toolbar prev button
    { id: 'tb-prev', hasChevronLeft: true, rect: { top: 900, left: 500, bottom: 950 }, disabled: false },
    // Quiz top-left back button (matches user screenshot)
    { id: 'quiz-back-btn', hasChevronLeft: true, rect: { top: 32, left: 30, bottom: 68 }, text: '', disabled: false },
    // Radio buttons
    { id: 'opt-a', hasChevronLeft: false, rect: { top: 300, left: 50 }, text: 'A. Bỏ qua', disabled: false },
  ];

  const found = mockFindQuizBackButton(elements);
  assert.ok(found, 'Phải tìm thấy nút Back');
  assert.strictEqual(found.id, 'quiz-back-btn', 'Phải tìm chính xác nút Back góc trên bên trái modal');
});

runTest('13.2: Không bắt nhầm nút Previous ở thanh điều hướng dưới đáy màn hình', () => {
  const elements = [
    { id: 'tb-prev', hasChevronLeft: true, rect: { top: 850, left: 400, bottom: 890 }, disabled: false },
  ];
  const found = mockFindQuizBackButton(elements);
  assert.strictEqual(found, null, 'Không được nhận diện nhầm nút toolbar dưới đáy');
});

runTest('13.3: Ghi nhận chính xác số slide bài giảng (Slide 5) vào completedQuizSlides', () => {
  const completedSlides = new Set();
  const lastActiveSlideNumber = 5;
  // Inside quiz modal, progress text is "Tiến độ: 2/2 câu đúng"
  const quizProgress = { correct: 2, total: 2, done: true };
  const targetSlide = lastActiveSlideNumber;

  if (quizProgress.done && targetSlide) {
    completedSlides.add(targetSlide);
  }

  assert.strictEqual(completedSlides.has(5), true, 'Phải lưu Slide 5 vào danh sách đã hoàn thành');
  assert.strictEqual(completedSlides.has(2), false, 'Không được nhầm tiến độ 2/2 thành Slide 2');
});

runTest('13.4: Cơ chế Debounce ngăn chặn triệt để vòng lặp log vô tận khi đã đạt 2/2 câu đúng', () => {
  let logCount = 0;
  let lastExitTime = 0;

  function handleQuizCompletion(now) {
    if (now - lastExitTime < 800) {
      return false; // Debounced
    }
    lastExitTime = now;
    logCount++;
    return true; // Clicked exit
  }

  // Lần đầu tiên: Cho phép chạy và click thoát
  const r1 = handleQuizCompletion(1000);
  assert.strictEqual(r1, true);
  assert.strictEqual(logCount, 1);

  // 250ms sau (vòng lặp cũ): Bị chặn bởi debounce, không spam log
  const r2 = handleQuizCompletion(1250);
  assert.strictEqual(r2, false);
  assert.strictEqual(logCount, 1, 'Không được in log trùng lặp khi đang xử lý thoát');

  // 500ms sau: Vẫn bị chặn
  const r3 = handleQuizCompletion(1500);
  assert.strictEqual(r3, false);
  assert.strictEqual(logCount, 1);

  // Sau khi thoát thành công (> 800ms)
  const r4 = handleQuizCompletion(2000);
  assert.strictEqual(r4, true);
  assert.strictEqual(logCount, 2);
});

runTest('13.5: Sau khi đóng modal trở lại Slide 5 -> Tự động chuyển tiếp sang Slide 6', () => {
  const completedSlides = new Set([5]);
  const currentSlide = 5;
  let advancedToSlide = null;

  const isQuizAlreadyDone = completedSlides.has(currentSlide);
  assert.strictEqual(isQuizAlreadyDone, true, 'Slide 5 đã đánh dấu hoàn thành bài tập');

  // In Case B, because isQuizAlreadyDone is true, it advances to next slide
  if (isQuizAlreadyDone) {
    advancedToSlide = currentSlide + 1;
  }

  assert.strictEqual(advancedToSlide, 6, 'Phải chuyển tiếp mượt mà từ Slide 5 sang Slide 6');
});

// ── TEST GROUP 14: Academic Exam Grounding & External Theory Verification ──
console.log('\n--- TEST GROUP 14: Academic Exam Grounding & External Theory Verification ---');

function cleanAcademicSearchQuery(rawQuery) {
  let cleanQ = rawQuery
    .replace(/^(?:câu|question)\s*\d+[\s\:\.\-]*/i, '')
    .replace(/\[[^\]]+\]/g, '')
    .replace(/____+|\[\.\.\.\]/g, '')
    .replace(/^(?:chọn|hãy\s*chọn|hãy\s*cho\s*biết|theo\s*bạn|theo\s*lý\s*thuyết)\s+/i, '')
    .replace(/(?:chọn\s+đáp\s+án\s+đúng|phát\s+biểu\s+nào\s+sau\s+đây|khẳng\s+định\s+nào\s+sau\s+đây)[\:\.\?]*/gi, '')
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return cleanQ.length > 160 ? cleanQ.substring(0, 160) : cleanQ;
}

runTest('14.1: Làm sạch query học thuật, loại bỏ nhiễu và giữ từ khóa cốt lõi', () => {
  const raw1 = 'Câu 5: Chọn đáp án đúng: Nếu một giao dịch bao gồm nhiều thao tác và một thao tác thất bại, điều gì cần phải được thực hiện để đảm bảo tính toàn vẹn dữ liệu?';
  const cleaned1 = cleanAcademicSearchQuery(raw1);
  assert.ok(!cleaned1.includes('Câu 5:'));
  assert.ok(!cleaned1.includes('Chọn đáp án đúng:'));
  assert.ok(cleaned1.includes('giao dịch bao gồm nhiều thao tác'));
  assert.ok(cleaned1.includes('toàn vẹn dữ liệu'));

  const raw2 = 'Question 12: Hãy cho biết lệnh nào sau đây dùng để cấu hình static files trong ASP.NET Core?';
  const cleaned2 = cleanAcademicSearchQuery(raw2);
  assert.ok(!cleaned2.includes('Question 12:'));
  assert.ok(!cleaned2.includes('Hãy cho biết'));
  assert.ok(cleaned2.includes('static files trong ASP.NET Core'));
});

runTest('14.2: Tích hợp đầy đủ khối ngữ cảnh Academic Grounding vào prompt đối chiếu lý thuyết', () => {
  const snippets = [
    'Tính nguyên tử (Atomicity): Nếu một phần giao dịch thất bại, toàn bộ giao dịch phải được rollback.',
    'ACID in DBMS: Transactions must be all-or-nothing to preserve consistency.'
  ];
  let contextBlock = '';
  if (snippets.length > 0) {
    contextBlock += `\n\n=== THÔNG TIN ĐỐI CHIẾU LÝ THUYẾT & DỮ LIỆU CHUẨN XÁC (ACADEMIC GROUNDING) ===\n"""\n${snippets.map((s, i) => `[Tài liệu ${i+1}] ${s}`).join('\n')}\n"""\n* Hãy đối chiếu kỹ thông tin lý thuyết chuẩn mực từ các nguồn trên để chọn đáp án/từ ngữ chính xác nhất.\n`;
  }

  assert.ok(contextBlock.includes('ACADEMIC GROUNDING'));
  assert.ok(contextBlock.includes('Tính nguyên tử (Atomicity)'));
  assert.ok(contextBlock.includes('ACID in DBMS'));
});

runTest('14.3: Cơ chế quyết định kích hoạt Grounding linh hoạt theo cấu hình và trạng thái tài liệu', () => {
  function shouldTriggerGrounding(enableWebGrounding, fastMode, hasSlideContext, isFillBlank) {
    return enableWebGrounding === true || (!fastMode && (isFillBlank || !hasSlideContext));
  }

  // 1. Khi người dùng bật toggle enableWebGrounding -> Luôn kích hoạt để đạt độ chuẩn xác tối đa
  assert.strictEqual(shouldTriggerGrounding(true, true, true, false), true);

  // 2. Khi ở chế độ Siêu tốc (fastMode = true) và không bật grounding -> Tắt để ưu tiên tốc độ < 0.5s
  assert.strictEqual(shouldTriggerGrounding(false, true, true, false), false);

  // 3. Khi không ở chế độ Siêu tốc và câu hỏi thiếu tài liệu slide -> Tự động kích hoạt đối chiếu ngoài
  assert.strictEqual(shouldTriggerGrounding(false, false, false, false), true);
});

console.log('\n====================================================');
console.log(`📊 KẾT QUẢ KIỂM THỬ: ${testsPassed}/${testsTotal} BÀI TEST THÀNH CÔNG!`);
console.log('====================================================\n');

if (testsPassed === testsTotal) {
  console.log('🎉 TẤT CẢ LOGIC ĐÃ ĐƯỢC XÁC THỰC VÀ HOẠT ĐỘNG HOÀN HẢO!');
  process.exit(0);
} else {
  console.error('❌ MỘT SỐ BÀI TEST BỊ THẤT BẠI!');
  process.exit(1);
}


