const SEARCH_TIMEOUT_MS = 2200; // tối đa ~6.6s/câu (3 request) — không để grounding làm đơ tiến trình Auto All
const MAX_SNIPPETS = 8;
const MIN_SNIPPETS_FOR_SECOND_PASS = 3;

// Từ chức vụ / stopword tiếng Việt + Anh khi trích từ khóa
const STOPWORDS = new Set([
  'và', 'của', 'các', 'được', 'không', 'trong', 'cho', 'là', 'một', 'với', 'theo', 'những', 'khi', 'này', 'đó',
  'hay', 'hoặc', 'từ', 'trên', 'vào', 'có', 'bị', 'sẽ', 'đã', 'thì', 'nên', 'phải', 'cần', 'nào', 'ra', 'đến',
  'the', 'and', 'for', 'with', 'that', 'this', 'from', 'are', 'not', 'when', 'then', 'all', 'any', 'which', 'what',
  'you', 'your', 'can', 'will', 'its', 'their', 'how', 'why', 'into', 'than', 'them', 'they',
]);

function cleanSearchQuery(rawQuery) {
  return rawQuery
    .replace(/^(?:câu|question)\s*\d+[\s\:\.\-]*/i, '')
    .replace(/\[[^\]]+\]/g, '')
    .replace(/____+|\[\.\.\.\]/g, '')
    .replace(/^(?:chọn|hãy\s*chọn|hãy\s*cho\s*biết|theo\s*bạn|theo\s*lý\s*thuyết)\s+/i, '')
    .replace(/(?:chọn\s+đáp\s+án\s+đúng|phát\s+biểu\s+nào\s+sau\s+đây|khẳng\s+định\s+nào\s+sau\s+đây)[\:\.\?]*/gi, '')
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function decodeHtmlEntities(s) {
  return s
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (m, d) => String.fromCharCode(parseInt(d, 10)));
}

function cleanExtractedText(s) {
  return decodeHtmlEntities(String(s).replace(/<[^>]+>/g, ''))
    .replace(/\u2026/g, '...')
    .replace(/\s+/g, ' ')
    .trim();
}

// Ghép cặp tiêu đề + snippet theo thứ tự kết quả (tiêu đề thường chứa trực tiếp đáp án)
function pairTitlesAndSnippets(titles, snippets) {
  const out = [];
  const total = Math.max(titles.length, snippets.length);
  for (let i = 0; i < total && out.length < MAX_SNIPPETS; i++) {
    const t = titles[i] || '';
    const s = snippets[i] || '';
    let entry = s;
    if (t && s) entry = `${s} (Nguồn: ${t.length > 80 ? t.substring(0, 80) + '...' : t})`;
    else if (t && !s) entry = t;
    if (entry && entry.length > 25 && !out.some(x => x.toLowerCase() === entry.toLowerCase())) {
      out.push(entry);
    }
  }
  return out;
}

// ── Parser: html.duckduckgo.com/html/ ────────────────────────
function parseHtmlResults(html) {
  const titles = [];
  const reA = /<a[^>]*class=["'][^"']*result__a[^"']*["'][^>]*>([\s\S]*?)<\/a>/gi;
  let m;
  while ((m = reA.exec(html)) !== null) {
    const t = cleanExtractedText(m[1]);
    if (t && t.length > 3) titles.push(t);
  }

  const snippets = [];
  const reS = /<a[^>]*class=["'][^"']*result__snippet[^"']*["'][^>]*>([\s\S]*?)<\/a>/gi;
  while ((m = reS.exec(html)) !== null) {
    const s = cleanExtractedText(m[1]);
    if (s.length > 25) snippets.push(s);
  }

  return pairTitlesAndSnippets(titles, snippets);
}

// ── Parser: lite.duckduckgo.com/lite/ (fallback) ─────────────
function parseLiteResults(html) {
  const titles = [];
  const reA = /<a[^>]*class=["'][^"']*result-link[^"']*["'][^>]*>([\s\S]*?)<\/a>/gi;
  let m;
  while ((m = reA.exec(html)) !== null) {
    const t = cleanExtractedText(m[1]);
    if (t && t.length > 3) titles.push(t);
  }

  const snippets = [];
  const reS = /<td[^>]*class=["'][^"']*result-snippet[^"']*["'][^>]*>([\s\S]*?)<\/td>/gi;
  while ((m = reS.exec(html)) !== null) {
    const s = cleanExtractedText(m[1]);
    if (s.length > 25) snippets.push(s);
  }

  return pairTitlesAndSnippets(titles, snippets);
}

async function searchDuckDuckGo(query, useLite = false) {
  const url = useLite
    ? 'https://lite.duckduckgo.com/lite/?q=' + encodeURIComponent(query)
    : 'https://html.duckduckgo.com/html/?q=' + encodeURIComponent(query);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), SEARCH_TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'vi,en-US;q=0.9,en;q=0.8'
      }
    });
    if (!res.ok) return [];
    const html = await res.text();
    return useLite ? parseLiteResults(html) : parseHtmlResults(html);
  } finally {
    clearTimeout(timeoutId);
  }
}

// Từ khóa phân biệt từ các phương án (từ dài, kỹ thuật, bỏ stopword) — dùng cho lượt tìm 2
function buildOptionFocusedQuery(cleanQuestion, options) {
  const base = cleanQuestion.split(/\s+/).filter(w => w.length > 2).slice(0, 8).join(' ');

  const words = [];
  for (const opt of (options || [])) {
    for (const w of String(opt).toLowerCase().split(/[^a-zà-ỹ0-9_.]+/i)) {
      if (w.length >= 4 && !STOPWORDS.has(w)) words.push(w);
    }
  }
  const distinctive = [...new Set(words)].sort((a, b) => b.length - a.length).slice(0, 4);

  const query = `${base} ${distinctive.join(' ')}`.trim();
  return query.length > 160 ? query.substring(0, 160) : query;
}

export async function searchWeb(rawQuery, options = []) {
  if (!rawQuery || rawQuery.length < 5) return [];

  try {
    const cleanQ = cleanSearchQuery(rawQuery);
    if (!cleanQ || cleanQ.length < 5) return [];

    const query = cleanQ.length > 160 ? cleanQ.substring(0, 160) : cleanQ;

    // Lượt 1: query chuẩn từ câu hỏi (nguồn chính, fallback lite nếu bị chặn/trống)
    let snippets = await searchDuckDuckGo(query);
    if (snippets.length === 0) {
      try {
        snippets = await searchDuckDuckGo(query, true);
      } catch (_) {}
    }

    // Lượt 2 (trắc nghiệm): kết quả quá mỏng → tìm thêm 1 lần duy nhất với từ khóa
    // câu hỏi + từ khóa phân biệt phương án (không fallback lite nữa — tránh bắn
    // 4 request liên tiếp vào DDG gây rate-limit và tích lũy timeout)
    if (snippets.length < MIN_SNIPPETS_FOR_SECOND_PASS && Array.isArray(options) && options.length >= 2) {
      try {
        const altQuery = buildOptionFocusedQuery(cleanQ, options);
        if (altQuery && altQuery !== query) {
          const extra = await searchDuckDuckGo(altQuery);
          for (const s of extra) {
            if (snippets.length >= MAX_SNIPPETS) break;
            if (!snippets.some(x => x.toLowerCase() === s.toLowerCase())) snippets.push(s);
          }
        }
      } catch (_) {}
    }

    return snippets.slice(0, MAX_SNIPPETS);
  } catch (err) {
    return [];
  }
}
