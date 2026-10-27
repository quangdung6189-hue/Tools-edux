// Test the new rock-solid scanTrueFalseStatements implementation
function testScanTF(container) {
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

  const results = [];

  // STRATEGY 1: Card / Row container detection (Edux, LMS, Quiz patterns)
  // Find containers that house BOTH a True button and a False button
  const candidateCards = Array.from((container || document.body).querySelectorAll(
    'div[class*="border"], div[class*="rounded"], div[class*="bg-gray"], tr, li, div[class*="item"], div[class*="statement"], div[class*="question"], div[class*="card"]'
  ));

  for (const card of candidateCards) {
    if (card.closest('[class*="ahs-"], [id*="ahs-"]')) continue;
    // Don't inspect top-level large containers that contain multiple cards
    if (candidateCards.some(childCard => childCard !== card && card.contains(childCard))) continue;

    const clickables = Array.from(card.querySelectorAll('button, [role="button"], input[type="button"], label, a, div, span'));
    let trueBtn = null;
    let falseBtn = null;

    for (const el of clickables) {
      if (el.children.length > 3) continue;
      const text = (el.textContent || '').trim();
      if (!trueBtn && isTrueText(text)) {
        trueBtn = el.closest('button, [role="button"], input[type="button"], label') || el;
      } else if (!falseBtn && isFalseText(text)) {
        falseBtn = el.closest('button, [role="button"], input[type="button"], label') || el;
      }
    }

    if (trueBtn && falseBtn && trueBtn !== falseBtn) {
      // Extract statement text from card
      let stmtText = '';

      // Try text column or elements excluding buttons
      const textEls = Array.from(card.querySelectorAll('div, p, span')).filter(el =>
        !el.contains(trueBtn) && !el.contains(falseBtn) && el !== trueBtn && el !== falseBtn
      );

      for (const el of textEls) {
        const t = (el.textContent || '').normalize('NFC').replace(/\s+/g, ' ').trim();
        if (t.length >= 8 && !isTrueText(t) && !isFalseText(t) && !/^(?:chọn\s+đúng|đúng\s+sai)/i.test(t)) {
          if (!stmtText || t.length > stmtText.length) {
            stmtText = t;
          }
        }
      }

      const pairIndex = results.length + 1;
      stmtText = (stmtText || '').replace(/^(?:đúng|sai)\s*[:\.]?\s*/gi, '').trim();
      if (!/^\d+[\.\:\)]/.test(stmtText) && stmtText) {
        stmtText = `${pairIndex}. ${stmtText}`;
      } else if (!stmtText) {
        stmtText = `Mệnh đề ${pairIndex}`;
      }

      results.push({
        index: pairIndex,
        text: stmtText,
        trueElement: trueBtn,
        falseElement: falseBtn,
        cardElement: card
      });
    }
  }

  return results;
}

console.log('Testing testScanTF logic loaded');
