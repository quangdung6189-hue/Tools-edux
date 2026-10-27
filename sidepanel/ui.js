/* ============================================================
   Side Panel — UI Rendering & View Handlers
   ============================================================ */

// ── Reference / Attachment Handlers ──────────────────────────
function updateReferenceUI() {
  if (!referenceSummary) return;

  if (attachedFileContent) {
    const charCount = attachedFileContent.length;
    const wordEst = Math.round(charCount / 5);
    const title = attachedFileName ? `📄 ${escapeHtml(attachedFileName)}` : '📝 Ghi chú bài giảng';
    referenceSummary.innerHTML = `<span>${title} <strong>(~${wordEst.toLocaleString()} từ)</strong></span>`;
    referenceSummary.classList.remove('hidden');
    if (btnClearRef) btnClearRef.classList.remove('hidden');
    if (referenceStatusText) referenceStatusText.textContent = 'Đã có tài liệu tham khảo';
  } else if (pageContentContext) {
    const charCount = pageContentContext.length;
    const wordEst = Math.round(charCount / 5);
    referenceSummary.innerHTML = `<span>🌐 Bài giảng từ trang web <strong>(~${wordEst.toLocaleString()} từ)</strong></span>`;
    referenceSummary.classList.remove('hidden');
    if (btnClearRef) btnClearRef.classList.remove('hidden');
    if (referenceStatusText) referenceStatusText.textContent = 'Đã lấy tài liệu từ trang';
  } else {
    referenceSummary.classList.add('hidden');
    if (btnClearRef) btnClearRef.classList.add('hidden');
    if (referenceStatusText) referenceStatusText.textContent = 'Tài liệu tham khảo / File đính kèm';
  }
}

function handleFileAttachment(e) {
  const file = e.target.files?.[0];
  if (!file) return;

  const reader = new FileReader();

  if (file.name.match(/\.(txt|md|json|html|htm|csv|xml|js|py)$/i) || file.type.startsWith('text/')) {
    reader.onload = (event) => {
      attachedFileContent = event.target.result || '';
      attachedFileName = file.name;
      if (refTextInput) refTextInput.value = attachedFileContent.substring(0, 1000);
      updateReferenceUI();
    };
    reader.readAsText(file);
  } else if (file.name.match(/\.pdf$/i)) {
    reader.onload = (event) => {
      try {
        const buffer = new Uint8Array(event.target.result);
        const raw = new TextDecoder('utf-8').decode(buffer);
        const textChunks = raw.match(/\(([^)]+)\)\s*Tj/g) || raw.match(/\[([^\]]+)\]\s*TJ/g);
        if (textChunks && textChunks.length > 0) {
          attachedFileContent = textChunks
            .map(c => c.replace(/^[\(\[]/, '').replace(/[\)\]]\s*T[jJ]$/, ''))
            .join(' ')
            .replace(/\\(\d{3})/g, (m, oct) => String.fromCharCode(parseInt(oct, 8)))
            .replace(/\\([\\()])/g, '$1');
        } else {
          const wordChunks = raw.match(/[a-zA-ZÀ-ỹ0-9\s\,\.\-\:]{4,}/g) || [];
          attachedFileContent = wordChunks.join(' ').substring(0, 8000);
        }
        attachedFileName = file.name;
        updateReferenceUI();
      } catch (err) {
        attachedFileContent = `[Tài liệu đính kèm: ${file.name}]`;
        attachedFileName = file.name;
        updateReferenceUI();
      }
    };
    reader.readAsArrayBuffer(file);
  } else {
    reader.onload = (event) => {
      try {
        const raw = new TextDecoder('utf-8').decode(new Uint8Array(event.target.result));
        const words = raw.match(/[a-zA-ZÀ-ỹ0-9\s\,\.\-\:]{4,}/g) || [];
        attachedFileContent = words.join(' ').substring(0, 8000);
        attachedFileName = file.name;
        updateReferenceUI();
      } catch (err) {
        attachedFileContent = `[Tài liệu đính kèm: ${file.name}]`;
        attachedFileName = file.name;
        updateReferenceUI();
      }
    };
    reader.readAsArrayBuffer(file);
  }
}

function handleSavePastedText() {
  if (!refTextInput) return;
  const text = refTextInput.value.trim();
  if (text) {
    attachedFileContent = text;
    attachedFileName = 'Văn bản dán vào';
  } else {
    attachedFileContent = '';
    attachedFileName = '';
  }
  if (referencePasteArea) referencePasteArea.classList.add('hidden');
  updateReferenceUI();
}

function handleClearReference() {
  attachedFileContent = '';
  attachedFileName = '';
  pageContentContext = '';
  if (refTextInput) refTextInput.value = '';
  if (inputRefFile) inputRefFile.value = '';
  if (refUrlInput) refUrlInput.value = '';
  if (referencePasteArea) referencePasteArea.classList.add('hidden');
  if (referenceUrlArea) referenceUrlArea.classList.add('hidden');
  if (openTabsDropdown) openTabsDropdown.classList.add('hidden');
  hideUrlStatus();
  updateReferenceUI();
}

// ── URL & Tab Reference Handlers ─────────────────────────────
function handleToggleUrlArea() {
  if (!referenceUrlArea) return;
  referenceUrlArea.classList.toggle('hidden');
  if (!referenceUrlArea.classList.contains('hidden')) {
    if (referencePasteArea) referencePasteArea.classList.add('hidden');
    if (refUrlInput) refUrlInput.focus();
  }
}

function showUrlStatus(msg, type = 'loading') {
  if (!refUrlStatus) return;
  refUrlStatus.className = `ref-url-status ${type}`;
  refUrlStatus.innerHTML = msg;
  refUrlStatus.classList.remove('hidden');
}

function hideUrlStatus() {
  if (refUrlStatus) refUrlStatus.classList.add('hidden');
}

function extractPdfBuffer(buffer) {
  try {
    const raw = new TextDecoder('utf-8').decode(buffer);
    const textChunks = raw.match(/\(([^)]+)\)\s*Tj/g) || raw.match(/\[([^\]]+)\]\s*TJ/g);
    if (textChunks && textChunks.length > 0) {
      return textChunks
        .map(c => c.replace(/^[\(\[]/, '').replace(/[\)\]]\s*T[jJ]$/, ''))
        .join(' ')
        .replace(/\\(\d{3})/g, (m, oct) => String.fromCharCode(parseInt(oct, 8)))
        .replace(/\\([\\()])/g, '$1');
    }
    const wordChunks = raw.match(/[a-zA-ZÀ-ỹ0-9\s\,\.\-\:]{4,}/g) || [];
    return wordChunks.join(' ');
  } catch (e) {
    return '';
  }
}

function setReferenceFromExtractedText(text, title) {
  const clean = text.substring(0, 20000).trim();
  attachedFileContent = clean;
  attachedFileName = title || 'Tài liệu từ URL';
  if (refTextInput) refTextInput.value = clean.substring(0, 1000);
  updateReferenceUI();
  const wordCount = Math.round(clean.length / 5);
  showUrlStatus(`✅ Đã đọc thành công <strong>~${wordCount.toLocaleString()} từ</strong> từ "${escapeHtml(attachedFileName)}"!`, 'success');
}

async function handleFetchUrlContent() {
  if (!refUrlInput) return;
  let url = refUrlInput.value.trim();
  if (!url) {
    showUrlStatus('⚠️ Vui lòng nhập đường link URL hợp lệ.', 'error');
    return;
  }

  if (!/^https?:\/\//i.test(url)) {
    url = 'https://' + url;
    refUrlInput.value = url;
  }

  showUrlStatus('⏳ Đang tải và trích xuất dữ liệu từ đường link...', 'loading');
  if (btnFetchUrl) btnFetchUrl.disabled = true;
  if (btnFetchUrlText) btnFetchUrlText.textContent = '⏳ Đang tải...';

  try {
    // 1. Google Docs export link
    if (url.includes('docs.google.com/document/d/')) {
      const docIdMatch = url.match(/\/document\/d\/([a-zA-Z0-9_-]+)/);
      if (docIdMatch) {
        const exportUrl = `https://docs.google.com/document/d/${docIdMatch[1]}/export?format=txt`;
        try {
          const docResp = await fetch(exportUrl);
          if (docResp.ok) {
            const docTxt = await docResp.text();
            if (docTxt && docTxt.trim().length > 30) {
              setReferenceFromExtractedText(docTxt, `Google Docs: ${docIdMatch[1].substring(0, 8)}`);
              return;
            }
          }
        } catch (_) {}
      }
    }

    // 2. Google Slides export link
    if (url.includes('docs.google.com/presentation/d/')) {
      const presIdMatch = url.match(/\/presentation\/d\/([a-zA-Z0-9_-]+)/);
      if (presIdMatch) {
        const exportUrl = `https://docs.google.com/presentation/d/${presIdMatch[1]}/export/txt`;
        try {
          const presResp = await fetch(exportUrl);
          if (presResp.ok) {
            const presTxt = await presResp.text();
            if (presTxt && presTxt.trim().length > 30) {
              setReferenceFromExtractedText(presTxt, `Google Slides: ${presIdMatch[1].substring(0, 8)}`);
              return;
            }
          }
        } catch (_) {}
      }
    }

    // 3. Special handling for SharePoint / OneDrive / Office 365
    const isSharePointOrOffice = /sharepoint\.com|office\.com|live\.com|onedrive\.live\.com/i.test(url);
    if (isSharePointOrOffice) {
      // Find open tab that belongs to this SharePoint / Office URL
      const allTabs = await chrome.tabs.query({});
      let matchingTab = null;
      try {
        const parsed = new URL(url);
        matchingTab = allTabs.find(t => t.url && (t.url.includes(parsed.pathname) || t.url.includes(parsed.hostname)));
      } catch (_) {}

      if (!matchingTab) {
        // Fallback: look for any open tab on sharepoint.com or office.com
        matchingTab = allTabs.find(t => t.url && /sharepoint\.com|office\.com/i.test(t.url));
      }

      if (matchingTab) {
        await extractFromTab(matchingTab);
        return;
      }
      throw new Error('Slide PowerPoint / SharePoint yêu cầu quyền đăng nhập Microsoft 365. Bạn hãy mở link slide này trên một tab trình duyệt rồi nhấn "🌐 Lấy Tab hiện tại" hoặc "📑 Chọn từ Tab khác" bên dưới!');
    }

    // 4. Direct HTTP fetch for public pages, blogs, and documentation
    let response;
    try {
      response = await fetch(url, { headers: { 'Accept': 'text/html,text/plain,application/json,application/pdf,*/*' } });
    } catch (netErr) {
      // If direct fetch fails (CORS, intranet or requires auth), check if matching tab is already open
      try {
        const parsed = new URL(url);
        const openMatchingTabs = await chrome.tabs.query({ url: `*://${parsed.hostname}/*` });
        if (openMatchingTabs && openMatchingTabs.length > 0) {
          await extractFromTab(openMatchingTabs[0]);
          return;
        }
      } catch (_) {}
      throw new Error('Không thể tải URL trực tiếp (do trang web chặn hoặc yêu cầu đăng nhập). Hãy mở trang đó trên 1 tab trình duyệt rồi nhấn "🌐 Lấy Tab hiện tại" bên dưới!');
    }

    if (!response.ok) {
      throw new Error(`Trang web phản hồi mã lỗi HTTP ${response.status} (${response.statusText})`);
    }

    const contentType = response.headers.get('content-type') || '';
    let extractedText = '';
    let pageTitle = '';

    if (contentType.includes('application/pdf')) {
      const buffer = new Uint8Array(await response.arrayBuffer());
      extractedText = extractPdfBuffer(buffer);
      pageTitle = url.split('/').pop() || 'Tài liệu PDF';
    } else {
      const rawText = await response.text();
      if (contentType.includes('text/plain') || contentType.includes('application/json') || contentType.includes('text/markdown')) {
        extractedText = rawText;
        pageTitle = url.split('/').pop() || 'Tài liệu Text';
      } else {
        // Parse HTML DOM
        const parser = new DOMParser();
        const doc = parser.parseFromString(rawText, 'text/html');
        pageTitle = doc.title || '';
        
        doc.querySelectorAll('script, style, noscript, nav, footer, header, iframe, aside, [class*="ad"], [class*="banner"], [class*="cookie"]').forEach(el => el.remove());
        
        // Extract SVG text inside public HTML
        const svgTexts = [];
        doc.querySelectorAll('svg text, svg tspan').forEach(el => {
          const t = (el.textContent || '').trim();
          if (t) svgTexts.push(t);
        });

        const mainEl = doc.querySelector('main, article, [role="main"], [class*="slide"], [class*="lesson"], [class*="content"], [class*="document"]') || doc.body;
        const mainText = (mainEl ? (mainEl.innerText || mainEl.textContent || '') : '').trim();
        extractedText = `${svgTexts.join(' ')}\n\n${mainText}`.trim();
      }
    }

    extractedText = extractedText.replace(/[ \t]+/g, ' ').replace(/\n\s*\n\s*\n+/g, '\n\n').trim();

    if (!extractedText || extractedText.length < 20) {
      throw new Error('Nội dung trang web quá ngắn hoặc được tạo bằng JavaScript. Hãy mở trang đó trên 1 tab rồi bấm "🌐 Lấy Tab hiện tại".');
    }

    setReferenceFromExtractedText(extractedText, `Link: ${pageTitle || new URL(url).hostname}`);
  } catch (err) {
    showUrlStatus(`❌ ${err.message}`, 'error');
  } finally {
    if (btnFetchUrl) btnFetchUrl.disabled = false;
    if (btnFetchUrlText) btnFetchUrlText.textContent = '📥 Đọc link';
  }
}

async function handleFetchFromCurrentTab() {
  showUrlStatus('⏳ Đang lấy dữ liệu từ tab đang mở...', 'loading');
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const tab = tabs[0];
    if (!tab || !tab.id) {
      throw new Error('Không tìm thấy tab đang kích hoạt.');
    }
    await extractFromTab(tab);
  } catch (err) {
    showUrlStatus(`❌ ${err.message}`, 'error');
  }
}

async function extractFromTab(tab) {
  if (!tab || !tab.id) return;
  if (tab.url?.startsWith('chrome://') || tab.url?.startsWith('chrome-extension://')) {
    throw new Error('Không thể đọc trang hệ thống của trình duyệt.');
  }

  showUrlStatus(`⏳ Đang trích xuất slide từ tab: <strong>${escapeHtml(truncate(tab.title || tab.url, 40))}</strong>...`, 'loading');

  let results = [];
  try {
    // 1. Run across ALL frames (crucial for PowerPoint Online inside WopiFrame / WebApplicationFrame)
    results = await chrome.scripting.executeScript({
      target: { tabId: tab.id, allFrames: true },
      func: () => {
        const textChunks = [];

        // A. Accessibility slide labels (PowerPoint Online & Google Slides assign aria-label to thumbnails, slides, shapes)
        const ariaElements = document.querySelectorAll(
          '[aria-roledescription="slide"], [role="region"][aria-label], [data-automation-id*="slide"], [data-automation-id*="Slide"], [class*="thumbnail"][aria-label], [class*="Thumbnail"][aria-label], [class*="SlideThumb"][aria-label], [class*="slideList"] [aria-label], [class*="SlideList"] [aria-label], [role="listitem"][aria-label]'
        );
        ariaElements.forEach(el => {
          const label = el.getAttribute('aria-label') || '';
          if (label && label.length > 5 && !label.includes('Ribbon') && !label.includes('Toolbar') && !label.includes('Command')) {
            textChunks.push(label.trim());
          }
        });

        // B. SVG text elements (CRITICAL for PowerPoint Online & Google Slides text shapes)
        // PowerPoint Online renders all slide content inside <svg><text><tspan>
        const svgTexts = document.querySelectorAll('svg text, svg tspan');
        if (svgTexts.length > 0) {
          const svgLines = [];
          svgTexts.forEach(el => {
            const t = (el.textContent || '').trim();
            if (t && t.length > 0 && !svgLines.includes(t)) {
              svgLines.push(t);
            }
          });
          if (svgLines.length > 0) {
            textChunks.push(svgLines.join('\n'));
          }
        }

        // C. Slide shape text containers (PowerPoint Online, Google Slides, Canva)
        const shapeElements = document.querySelectorAll(
          '[class*="shape"], [class*="Shape"], [class*="TextRun"], [class*="textRun"], [class*="Paragraph"], [class*="paragraph"], [class*="text-content"], [class*="textContent"], [class*="punch-viewer"], [class*="slide-content"], [class*="SlideContent"], [class*="sketchy-text"]'
        );
        shapeElements.forEach(el => {
          const t = (el.innerText || el.textContent || '').trim();
          if (t && t.length > 0 && !textChunks.includes(t)) {
            textChunks.push(t);
          }
        });

        // D. Embedded PDF textLayer
        const pdfTextSpans = document.querySelectorAll('.textLayer span, [class*="textLayer"] span');
        if (pdfTextSpans.length > 0) {
          const pdfLines = [];
          pdfTextSpans.forEach(span => {
            const t = (span.textContent || '').trim();
            if (t) pdfLines.push(t);
          });
          if (pdfLines.length > 0) {
            textChunks.push(pdfLines.join(' '));
          }
        }

        // E. Thumbnails panel (left sidebar on PowerPoint / Slides)
        const thumbnailPanels = document.querySelectorAll(
          '[class*="Thumbnail"], [class*="thumbnail"], [class*="filmstrip"], [class*="slide-nav"], [class*="slideList"], [class*="SlideList"]'
        );
        thumbnailPanels.forEach(panel => {
          const t = (panel.innerText || '').trim();
          if (t && t.length > 10) {
            textChunks.push(t);
          }
        });

        // F. Main / Article / Reading containers
        const mainContent = document.querySelector('main, article, [role="main"], [class*="reading"], [class*="lesson"], [class*="content"]');
        if (mainContent) {
          const cloneMain = mainContent.cloneNode(true);
          cloneMain.querySelectorAll('script, style, noscript, nav, footer, header').forEach(e => e.remove());
          const t = (cloneMain.innerText || cloneMain.textContent || '').trim();
          if (t && t.length > 20) {
            textChunks.push(t);
          }
        }

        // G. General body fallback (DO NOT remove SVG!)
        if (textChunks.length === 0) {
          const clone = document.body.cloneNode(true);
          clone.querySelectorAll('script, style, noscript, nav, footer, header, [role="navigation"], [class*="ribbon"], [class*="Ribbon"], [class*="toolbar"], [class*="Toolbar"]').forEach(el => el.remove());
          const t = (clone.innerText || clone.textContent || '').trim();
          if (t && t.length > 10) {
            textChunks.push(t);
          }
        }

        return {
          title: document.title || '',
          chunks: textChunks,
          url: window.location.href
        };
      }
    });
  } catch (injectErr) {
    // If allFrames fails, fallback to top frame only
    results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {
        const textChunks = [];
        document.querySelectorAll('svg text, svg tspan').forEach(el => {
          const t = (el.textContent || '').trim();
          if (t) textChunks.push(t);
        });
        document.querySelectorAll('[aria-roledescription="slide"], [role="listitem"][aria-label], [role="region"][aria-label]').forEach(el => {
          const l = el.getAttribute('aria-label');
          if (l) textChunks.push(l);
        });
        const b = document.body.innerText || '';
        if (b) textChunks.push(b);
        return { title: document.title || '', chunks: textChunks, url: window.location.href };
      }
    });
  }

  // Office UI ribbon noise to exclude
  const officeNoise = new Set([
    'tệp', 'trang đầu', 'chèn', 'vẽ', 'thiết kế', 'chuyển tiếp', 'hoạt hình',
    'trình chiếu', 'xem xét', 'xem', 'trợ giúp', 'tìm kiếm', 'chia sẻ',
    'file', 'home', 'insert', 'draw', 'design', 'transitions', 'animations',
    'slide show', 'review', 'view', 'help', 'search', 'share', 'comments',
    'bình luận', 'chỉnh sửa', 'editing', 'undo', 'redo', 'hoàn tác', 'lưu', 'save'
  ]);

  const allChunks = [];
  let detectedTitle = tab.title || '';

  if (Array.isArray(results)) {
    for (const frameResult of results) {
      const data = frameResult?.result;
      if (data) {
        if (data.title && (!detectedTitle || detectedTitle.includes('Loading') || detectedTitle.length < 5)) {
          detectedTitle = data.title;
        }
        if (Array.isArray(data.chunks)) {
          allChunks.push(...data.chunks);
        }
      }
    }
  }

  // Deduplicate lines and filter noise
  const uniqueLines = [];
  const seen = new Set();
  const rawCombined = allChunks.join('\n\n');
  const lines = rawCombined.split('\n').map(l => l.trim()).filter(Boolean);

  for (const line of lines) {
    const lower = line.toLowerCase();
    if (officeNoise.has(lower)) continue;
    if (line.length < 2) continue;
    if (!seen.has(line)) {
      seen.add(line);
      uniqueLines.push(line);
    }
  }

  const finalText = uniqueLines.join('\n').trim();

  if (!finalText || finalText.length < 15) {
    throw new Error('Không tìm thấy nội dung slide trên trang này. Hãy đảm bảo slide đã tải xong trên màn hình.');
  }

  setReferenceFromExtractedText(finalText, `Slide: ${detectedTitle || truncate(tab.url, 30)}`);
  if (openTabsDropdown) openTabsDropdown.classList.add('hidden');
}

async function handleShowOpenTabsList() {
  if (!openTabsDropdown || !openTabsList) return;
  
  if (!openTabsDropdown.classList.contains('hidden')) {
    openTabsDropdown.classList.add('hidden');
    return;
  }

  openTabsList.innerHTML = '<div style="padding:10px;text-align:center;font-size:11px;color:var(--text-muted);">Đang tải danh sách tab...</div>';
  openTabsDropdown.classList.remove('hidden');

  try {
    const tabs = await chrome.tabs.query({ currentWindow: true });
    const validTabs = tabs.filter(t => t.url && !t.url.startsWith('chrome://') && !t.url.startsWith('chrome-extension://') && !t.url.startsWith('edge://'));

    if (validTabs.length === 0) {
      openTabsList.innerHTML = '<div style="padding:10px;text-align:center;font-size:11px;color:var(--text-muted);">Không có tab trang web nào khác đang mở.</div>';
      return;
    }

    openTabsList.innerHTML = '';
    for (const tab of validTabs) {
      const item = document.createElement('div');
      item.className = 'open-tab-item';
      
      const iconUrl = tab.favIconUrl || 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="%2394a3b8" stroke-width="2"><circle cx="12" cy="12" r="10"/></svg>';
      
      item.innerHTML = `
        <img class="open-tab-icon" src="${escapeHtml(iconUrl)}" onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2214%22 height=%2214%22 viewBox=%220 0 24 24%22 fill=%22none%22 stroke=%22%2394a3b8%22 stroke-width=%222%22><circle cx=%2212%22 cy=%2212%22 r=%2210%22/></svg>'" />
        <div class="open-tab-info">
          <div class="open-tab-title">${escapeHtml(tab.title || 'Tab không tên')}</div>
          <div class="open-tab-url">${escapeHtml(tab.url)}</div>
        </div>
      `;

      item.addEventListener('click', async () => {
        try {
          await extractFromTab(tab);
        } catch (err) {
          showUrlStatus(`❌ ${err.message}`, 'error');
        }
      });

      openTabsList.appendChild(item);
    }
  } catch (err) {
    openTabsList.innerHTML = `<div style="padding:10px;font-size:11px;color:var(--danger);">${escapeHtml(err.message)}</div>`;
  }
}

function getActiveReferenceContext() {
  const parts = [];
  if (attachedFileContent && attachedFileContent.trim()) {
    const label = attachedFileName ? `[TÀI LIỆU ĐÍNH KÈM: ${attachedFileName}]` : '[TÀI LIỆU ĐÍNH KÈM]';
    parts.push(`${label}\n${attachedFileContent.trim()}`);
  }
  if (pageContentContext && pageContentContext.trim()) {
    parts.push(`[BÀI GIẢNG / BÀI ĐỌC TỪ TRANG WEB]\n${pageContentContext.trim()}`);
  }
  return parts.join('\n\n---\n\n').substring(0, 20000);
}

// ── Render Questions ─────────────────────────────────────────
function renderQuestions() {
  if (questions.length === 0) {
    showEmptyState();
    return;
  }

  questionsContainer.innerHTML = '';

  // Questions Toolbar with Count & Clear Session Action
  const toolbar = document.createElement('div');
  toolbar.className = 'questions-toolbar';
  toolbar.innerHTML = `
    <span class="questions-count-label">📝 ${questions.length} câu hỏi</span>
    <button id="btn-clear-session" class="link-btn link-btn-sm" title="Dọn dẹp câu hỏi và bài giảng để làm bài mới">🧹 Dọn bài cũ</button>
  `;
  const clearBtn = toolbar.querySelector('#btn-clear-session');
  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      if (typeof clearCurrentSessionData === 'function') {
        clearCurrentSessionData(true);
      }
    });
  }
  questionsContainer.appendChild(toolbar);

  for (const q of questions) {
    const card = createQuestionCard(q);
    questionsContainer.appendChild(card);
  }
}

function createQuestionCard(q) {
  const card = document.createElement('div');
  card.className = 'question-card';
  card.id = `question-${q.index}`;
  card.style.animationDelay = `${q.index * 0.05}s`;

  const typeBadge = getTypeBadge(q.questionType);
  const statusBadge = getStatusBadge(q.status);

  let displayOptions = (q.options && q.options.length > 0) ? q.options : (q.statements && q.statements.length > 0 ? q.statements.map(s => s.text) : []);
  if ((!displayOptions || displayOptions.length === 0) && (q.questionType === 'true-false' || /(?:đúng[\s\/\-]*sai|từng\s+mệnh\s+đề|các\s+phát\s+biểu)/i.test(q.questionText || '')) && q.questionText) {
    const regex = /(?:^|[\r\n]+|\s+)(\d+)[\.\)\:\-–—]\s*(.+?)(?=(?:\s+\d+[\.\)\:\-–—]\s*)|$)/g;
    const extracted = [];
    let m;
    while ((m = regex.exec(q.questionText)) !== null) {
      const t = m[2].replace(/\s*(?:đúng|sai|true|false)\s*$/gi, '').trim();
      if (t.length >= 6) {
        extracted.push(`${m[1]}. ${t}`);
      }
    }
    if (extracted.length >= 2) {
      displayOptions = extracted;
    }
  }

  const isSimpleTF = displayOptions && displayOptions.length === 2 &&
    displayOptions.some(o => /^(?:đúng|true)$/i.test(o.trim())) &&
    displayOptions.some(o => /^(?:sai|false)$/i.test(o.trim()));
  const isMultiTF = q.isMultiStatement || (q.questionType === 'true-false' && !isSimpleTF && displayOptions && displayOptions.length >= 1);

  let optionsHtml = '';
  if (displayOptions && displayOptions.length > 0) {
    optionsHtml = `
      <div class="question-options">
        ${displayOptions.map((opt, i) => {
          if (isMultiTF) {
            const cleanOpt = opt.replace(/^\d+[\.\:\)]\s*/i, '').replace(/^[A-F][\.\:\)]\s*/i, '');
            return `
            <div class="question-option">
              <span class="option-letter">${i + 1}.</span>
              <span>${escapeHtml(cleanOpt)}</span>
            </div>
            `;
          }
          const cleanOpt = opt.replace(/^[A-F][\.\:\)]\s*/i, '');
          return `
          <div class="question-option">
            <span class="option-letter">${String.fromCharCode(65 + i)}.</span>
            <span>${escapeHtml(cleanOpt)}</span>
          </div>
          `;
        }).join('')}
      </div>
    `;
  }

  let answerHtml = '';
  if (q.answer) {
    const letterBadge = (q.answerLetter && !isMultiTF) ? `<span class="answer-letter-pill">Đáp án: ${escapeHtml(q.answerLetter)}</span>` : '';
    answerHtml = `
      <div class="answer-section">
        <div class="answer-header-row">
          <div class="answer-label">
            <span>✨ Câu trả lời AI</span>
          </div>
          ${letterBadge}
        </div>
        <div class="answer-text">${escapeHtml(q.answer)}</div>
        <div class="answer-actions">
          <button class="btn btn-success btn-sm" data-action="fill" data-index="${q.index}">
            <span>📝 Điền đáp án</span>
          </button>
          <button class="btn btn-accent btn-sm" data-action="copy" data-index="${q.index}">
            <span>📋 Copy</span>
          </button>
        </div>
      </div>
    `;
  } else if (q.status === 'loading') {
    answerHtml = `
      <div class="answer-section">
        <div class="answer-label loading-text" style="color: #38bdf8;">
          <span class="spinner"></span> Đang hỏi Gemini AI suy luận...
        </div>
      </div>
    `;
  } else if (q.status === 'error') {
    answerHtml = `
      <div class="answer-section">
        <div class="answer-label" style="color:var(--danger);">❌ Lỗi khi giải</div>
        <div class="answer-text" style="color:var(--danger);border-color:var(--danger-border);">${escapeHtml(q.errorMsg || 'Không rõ lỗi')}</div>
        <div class="answer-actions">
          <button class="btn btn-danger btn-sm" data-action="retry" data-index="${q.index}">
            <span>🔄 Thử lại</span>
          </button>
        </div>
      </div>
    `;
  } else {
    answerHtml = `
      <div class="answer-actions" style="margin-top:10px;">
        <button class="btn btn-primary btn-sm" data-action="solve" data-index="${q.index}">
          <span>🧠 Trả lời ngay</span>
        </button>
      </div>
    `;
  }

  card.innerHTML = `
    <div class="question-header">
      <div class="question-number">${q.index + 1}</div>
      <div class="question-meta">
        <div class="question-badges-row">
          ${typeBadge}
          ${statusBadge}
          ${(q.hasReference || getActiveReferenceContext()) ? '<span class="question-type-badge" style="background:rgba(139,92,246,0.15);color:#d8b4fe;border:1px solid rgba(139,92,246,0.35);">📚 Có tài liệu</span>' : ''}
        </div>
        <div class="question-text">${escapeHtml(truncate(q.questionText, 300))}</div>
        ${optionsHtml}
      </div>
    </div>
    ${answerHtml}
  `;

  // Event delegation
  card.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;

    const action = btn.dataset.action;
    const index = parseInt(btn.dataset.index);

    if (action === 'solve' || action === 'retry') solveQuestion(index);
    else if (action === 'fill') fillAnswer(index);
    else if (action === 'copy') copyAnswer(index);
  });

  return card;
}

// ── Update Single Question Card ──────────────────────────────
function updateQuestionCard(index) {
  const existing = document.getElementById(`question-${index}`);
  if (!existing) return;

  const newCard = createQuestionCard(questions[index]);
  existing.replaceWith(newCard);

  // Scroll to card if auto-next
  if (toggleAutoNext && toggleAutoNext.checked) {
    newCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
}

// ── Progress Bar ─────────────────────────────────────────────
function showProgress(current, total, customText) {
  if (!progressContainer) return;
  progressContainer.classList.remove('hidden');
  if (progressText) progressText.textContent = customText || `Đang xử lý câu ${current + 1}/${total}...`;
  if (progressCount) progressCount.textContent = `${current}/${total}`;
  const pct = total > 0 ? (current / total) * 100 : 0;
  if (progressFill) progressFill.style.width = `${pct}%`;
}

function hideProgress() {
  if (progressText) progressText.textContent = '✨ Hoàn tất quét!';
  if (progressFill) progressFill.style.width = '100%';
  setTimeout(() => {
    if (progressContainer) progressContainer.classList.add('hidden');
  }, 2200);
}

// ── Slide Activity Log UI ────────────────────────────────────
function appendSlideLog(msg, type = 'info') {
  if (!slideLogContainer) return;
  const item = document.createElement('div');
  item.className = `slide-log-item ${type}`;

  const time = new Date().toLocaleTimeString('vi-VN', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
  
  let tagClass = 'tag-sys';
  let tagText = 'SYS';
  if (type === 'success') { tagClass = 'tag-ok'; tagText = 'OK'; }
  else if (type === 'warning') { tagClass = 'tag-quiz'; tagText = 'QUIZ'; }
  else if (type === 'danger') { tagClass = 'tag-err'; tagText = 'ERR'; }
  
  item.innerHTML = `
    <span class="log-time">[${time}]</span>
    <span class="log-tag ${tagClass}">${tagText}</span>
    <span class="log-msg">${escapeHtml(msg)}</span>
  `;

  slideLogContainer.appendChild(item);
  slideLogContainer.scrollTop = slideLogContainer.scrollHeight;
}

function handleSlideLogEvent(event) {
  if (event.text) {
    appendSlideLog(event.text, event.level || 'info');
    if (slideStatusText) slideStatusText.textContent = event.text;
  }
  if (event.badge && slideBadge) {
    if (event.badge === 'running') {
      slideBadge.textContent = 'Đang đọc slide';
      slideBadge.className = 'slide-badge running';
      updateSlideButtons(true);
    } else if (event.badge === 'quiz') {
      slideBadge.textContent = 'Giải bài trên lớp';
      slideBadge.className = 'slide-badge quiz';
      updateSlideButtons(true);
    } else if (event.badge === 'done') {
      slideBadge.textContent = 'Hoàn thành';
      slideBadge.className = 'slide-badge done';
      updateSlideButtons(false);
      showToast('🎉 Hoàn thành học toàn bộ Slide!');
    } else if (event.badge === 'ready') {
      slideBadge.textContent = 'Sẵn sàng';
      slideBadge.className = 'slide-badge';
      updateSlideButtons(false);
    }
  }
  if (event.counter && slideCounter) {
    slideCounter.textContent = event.counter;
  }
}
