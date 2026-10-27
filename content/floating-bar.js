// ============================================================
// Auto Solver AI PRO — Floating Webpage Tabbar (Thanh công cụ nổi)
// Draggable, Collapsible & Glassmorphism Overlay directly on Page
// ============================================================

(function () {
  // Always clean up any existing floating bar hosts in DOM first
  // (prevents duplicate zombie bars from previous extension injections/reloads)
  try {
    if (typeof window.__ahs_cleanup_floating_bar === 'function') {
      window.__ahs_cleanup_floating_bar();
    }
    var oldHosts = document.querySelectorAll('#ahs-floating-bar-host, .ahs-dock, .ahs-mini-bar');
    for (var i = 0; i < oldHosts.length; i++) {
      oldHosts[i].style.display = 'none';
      oldHosts[i].remove();
    }
  } catch (_) {}

  // Prevent loading in sub-iframes / non-top windows
  if (window.self !== window.top) return;

  // Unique Instance ID to kill zombie observers / intervals from earlier runs
  var currentInstanceId = 'ahs_bar_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  window.__ahs_active_floating_instance_id = currentInstanceId;

  var isSlideRunning = window.__ahs_isSlideRunning || false;
  var isAutoSolverRunning = window.__ahs_isAutoSolverRunning || false;
  var isCollapsed = localStorage.getItem('ahs_float_collapsed') === 'true';
  var isVisible = true; // Synced with chrome.storage.local

  // Create isolated container
  var host = document.createElement('div');
  host.id = 'ahs-floating-bar-host';
  host.style.cssText = 'all: initial; position: fixed; z-index: 2147483647; top: 0; left: 0; pointer-events: none;';

  // Attach to active dialog if already open, else documentElement
  var activeDlg = document.querySelector('div[role="dialog"][data-state="open"]') ||
                  document.querySelector('div[role="dialog"]');
  (activeDlg || document.documentElement).appendChild(host);

  var shadow = host.attachShadow({ mode: 'open' });

  // CSS Stylesheet
  var style = document.createElement('style');
  style.textContent = `
    :host *, .ahs-dock *, .ahs-mini-bar * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; user-select: none; }
    .ahs-dock {
      pointer-events: auto;
      position: fixed;
      width: 320px;
      background: rgba(15, 23, 42, 0.94);
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      border: 1px solid rgba(139, 92, 246, 0.35);
      border-radius: 16px;
      box-shadow: 0 16px 40px -8px rgba(0, 0, 0, 0.65), 0 0 20px rgba(99, 102, 241, 0.18);
      transition: box-shadow 0.25s ease, border-color 0.25s ease;
      overflow: hidden;
      color: #f1f5f9;
      font-size: 13px;
    }
    .ahs-dock:hover {
      border-color: rgba(168, 85, 247, 0.55);
      box-shadow: 0 20px 48px -8px rgba(0, 0, 0, 0.75), 0 0 28px rgba(168, 85, 247, 0.25);
    }
    .ahs-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 10px 14px;
      background: rgba(30, 41, 59, 0.6);
      border-bottom: 1px solid rgba(255, 255, 255, 0.08);
      cursor: grab;
      touch-action: none;
    }
    .ahs-header:active { cursor: grabbing; }
    .ahs-brand { display: flex; align-items: center; gap: 7px; }
    .ahs-logo-icon {
      display: inline-flex; align-items: center; justify-content: center;
      width: 22px; height: 22px; border-radius: 6px;
      background: linear-gradient(135deg, #3b82f6, #8b5cf6);
      font-size: 13px; box-shadow: 0 0 10px rgba(139, 92, 246, 0.5);
    }
    .ahs-brand-name {
      font-weight: 700; font-size: 13px; letter-spacing: 0.2px;
      background: linear-gradient(135deg, #ffffff, #cbd5e1);
      -webkit-background-clip: text; -webkit-text-fill-color: transparent;
      display: flex; align-items: center; gap: 6px;
    }
    .ahs-pro-pill {
      font-size: 9px; font-weight: 800; padding: 1px 5px; border-radius: 9999px;
      background: linear-gradient(135deg, #ec4899, #8b5cf6); color: #fff;
      -webkit-text-fill-color: initial; letter-spacing: 0.5px;
    }
    .ahs-header-actions { display: flex; align-items: center; gap: 4px; }
    .ahs-icon-btn {
      display: inline-flex; align-items: center; justify-content: center;
      width: 24px; height: 24px; border-radius: 6px;
      background: rgba(255, 255, 255, 0.06); border: 1px solid rgba(255, 255, 255, 0.1);
      color: #94a3b8; font-size: 13px; cursor: pointer; transition: all 0.15s ease;
    }
    .ahs-icon-btn:hover { background: rgba(255, 255, 255, 0.14); color: #fff; border-color: rgba(255, 255, 255, 0.25); }
    .ahs-btn-close:hover {
      background: rgba(239, 68, 68, 0.25) !important;
      color: #ef4444 !important;
      border-color: rgba(239, 68, 68, 0.4) !important;
    }
    .ahs-drag-grip {
      display: inline-flex; align-items: center; justify-content: center;
      width: 18px; height: 24px; color: #64748b; font-size: 14px; cursor: grab;
      touch-action: none;
    }
    .ahs-body { padding: 12px 14px 14px; display: flex; flex-direction: column; gap: 10px; }
    .ahs-status-strip { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
    .ahs-status-badge {
      display: inline-flex; align-items: center; gap: 6px; padding: 3px 8px; border-radius: 9999px;
      font-size: 11px; font-weight: 600; background: rgba(100, 116, 139, 0.2); color: #94a3b8;
      border: 1px solid rgba(100, 116, 139, 0.3); transition: all 0.25s ease;
    }
    .ahs-dot { width: 6px; height: 6px; border-radius: 50%; background: #94a3b8; display: inline-block; }
    .ahs-status-badge.running { background: rgba(59, 130, 246, 0.18); color: #60a5fa; border-color: rgba(59, 130, 246, 0.4); }
    .ahs-status-badge.running .ahs-dot { background: #3b82f6; box-shadow: 0 0 8px #3b82f6; animation: ahs-blink 1.2s infinite; }
    .ahs-status-badge.quiz { background: rgba(16, 185, 129, 0.18); color: #34d399; border-color: rgba(16, 185, 129, 0.4); }
    .ahs-status-badge.quiz .ahs-dot { background: #10b981; box-shadow: 0 0 8px #10b981; animation: ahs-blink 1.2s infinite; }
    .ahs-counter-badge {
      font-size: 11px; font-weight: 700; color: #cbd5e1; background: rgba(255, 255, 255, 0.07);
      padding: 3px 8px; border-radius: 6px; border: 1px solid rgba(255, 255, 255, 0.08);
    }
    .ahs-actions-row { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
    .ahs-btn {
      display: inline-flex; align-items: center; justify-content: center; gap: 6px;
      padding: 8px 10px; border-radius: 8px; border: none; font-weight: 600; font-size: 12px;
      cursor: pointer; transition: all 0.18s ease; box-shadow: 0 2px 6px rgba(0, 0, 0, 0.2);
    }
    .ahs-btn:hover { transform: translateY(-1px); filter: brightness(1.1); }
    .ahs-btn:active { transform: translateY(0); filter: brightness(0.95); }
    .ahs-btn-primary { background: linear-gradient(135deg, #2563eb, #7c3aed); color: #fff; box-shadow: 0 2px 10px rgba(124, 58, 237, 0.35); }
    .ahs-btn-stop { background: linear-gradient(135deg, #ef4444, #dc2626) !important; color: #fff !important; box-shadow: 0 2px 10px rgba(239, 68, 68, 0.4) !important; }
    .ahs-btn-success { background: linear-gradient(135deg, #059669, #10b981); color: #fff; box-shadow: 0 2px 10px rgba(16, 185, 129, 0.3); }
    .ahs-btn-secondary {
      grid-column: span 2; background: rgba(255, 255, 255, 0.07);
      border: 1px solid rgba(255, 255, 255, 0.12); color: #cbd5e1;
    }
    .ahs-btn-secondary:hover { background: rgba(255, 255, 255, 0.13); color: #fff; border-color: rgba(255, 255, 255, 0.25); }
    .ahs-controls-row {
      display: flex; align-items: center; justify-content: space-between; padding: 6px 8px;
      background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(255, 255, 255, 0.06);
      border-radius: 8px; gap: 8px;
    }
    .ahs-control-group { display: flex; align-items: center; gap: 5px; }
    .ahs-label { font-size: 11px; color: #94a3b8; font-weight: 500; }
    .ahs-select {
      background: rgba(15, 23, 42, 0.85); border: 1px solid rgba(255, 255, 255, 0.15);
      color: #f1f5f9; border-radius: 6px; font-size: 11px; padding: 2px 4px; outline: none; cursor: pointer;
    }
    .ahs-toggle-label { display: inline-flex; align-items: center; gap: 5px; cursor: pointer; font-size: 11px; color: #94a3b8; }
    .ahs-toggle-label input { display: none; }
    .ahs-toggle-switch {
      width: 26px; height: 14px; border-radius: 9999px; background: rgba(255, 255, 255, 0.2);
      position: relative; transition: background-color 0.2s ease;
    }
    .ahs-toggle-switch::after {
      content: ''; position: absolute; top: 2px; left: 2px; width: 10px; height: 10px;
      border-radius: 50%; background: #fff; transition: transform 0.2s ease;
    }
    .ahs-toggle-label input:checked + .ahs-toggle-switch { background: #8b5cf6; }
    .ahs-toggle-label input:checked + .ahs-toggle-switch::after { transform: translateX(12px); }
    .ahs-ticker {
      display: flex; align-items: center; gap: 6px; padding: 6px 8px;
      background: rgba(0, 0, 0, 0.35); border-radius: 6px; border: 1px solid rgba(255, 255, 255, 0.05);
      overflow: hidden; font-size: 11px;
    }
    .ahs-ticker-icon { font-size: 12px; flex-shrink: 0; }
    .ahs-ticker-text { color: #94a3b8; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; flex: 1; }
    .ahs-mini-bar {
      display: flex; align-items: center; gap: 6px; padding: 6px 10px;
      background: rgba(15, 23, 42, 0.94); cursor: grab; border-radius: 9999px;
      border: 1px solid rgba(139, 92, 246, 0.35); box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);
      touch-action: none;
    }
    .ahs-mini-bar:active { cursor: grabbing; }
    .ahs-mini-counter { font-size: 11px; font-weight: 700; color: #cbd5e1; margin: 0 4px; }
    .ahs-mini-btn {
      display: inline-flex; align-items: center; justify-content: center;
      width: 26px; height: 26px; border-radius: 6px; background: linear-gradient(135deg, #2563eb, #7c3aed);
      color: #fff; border: none; font-size: 11px; cursor: pointer; transition: all 0.15s ease;
    }
    .ahs-mini-btn:hover { transform: scale(1.08); }
    .ahs-mini-btn-stop { background: linear-gradient(135deg, #ef4444, #dc2626) !important; }
    .ahs-mini-btn-solve { background: linear-gradient(135deg, #059669, #10b981); }
    .ahs-mini-expand {
      display: inline-flex; align-items: center; justify-content: center;
      width: 22px; height: 22px; border-radius: 6px; background: rgba(255, 255, 255, 0.08);
      border: 1px solid rgba(255, 255, 255, 0.12); color: #94a3b8; font-size: 14px; cursor: pointer; margin-left: 2px;
    }
    .ahs-mini-expand:hover { background: rgba(255, 255, 255, 0.18); color: #fff; }
    .ahs-mini-close {
      display: inline-flex; align-items: center; justify-content: center;
      width: 22px; height: 22px; border-radius: 6px; background: rgba(255, 255, 255, 0.08);
      border: 1px solid rgba(255, 255, 255, 0.12); color: #94a3b8; font-size: 11px; cursor: pointer; margin-left: 2px;
    }
    .ahs-mini-close:hover {
      background: rgba(239, 68, 68, 0.25) !important;
      color: #ef4444 !important;
      border-color: rgba(239, 68, 68, 0.4) !important;
    }
    @keyframes ahs-blink { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.4; transform: scale(0.85); } }
  `;
  shadow.appendChild(style);

  // Wrapper element
  var dock = document.createElement('div');
  dock.className = 'ahs-dock';
  dock.id = 'ahs-dock';

  dock.innerHTML = `
    <!-- Header / Drag area -->
    <div class="ahs-header" id="ahs-drag-header">
      <div class="ahs-brand">
        <span class="ahs-logo-icon">⚡</span>
        <span class="ahs-brand-name">Auto Solver <span class="ahs-pro-pill">PRO</span></span>
      </div>
      <div class="ahs-header-actions">
        <button class="ahs-icon-btn" id="ahs-btn-minimize" title="Thu nhỏ / Mở rộng">—</button>
        <button class="ahs-icon-btn ahs-btn-close" id="ahs-btn-close" title="Đóng thanh nổi">✕</button>
        <div class="ahs-drag-grip" title="Kéo để di chuyển">⠿</div>
      </div>
    </div>

    <!-- Body (Expanded) -->
    <div class="ahs-body" id="ahs-body">
      <div class="ahs-status-strip">
        <div class="ahs-status-badge ready" id="ahs-status-badge">
          <span class="ahs-dot"></span>
          <span id="ahs-status-text">Sẵn sàng</span>
        </div>
        <div class="ahs-counter-badge" id="ahs-counter-badge">Slide: -- / --</div>
      </div>

      <div class="ahs-actions-row">
        <button class="ahs-btn ahs-btn-primary" id="ahs-btn-slide">
          <span class="ahs-btn-icon" id="ahs-slide-icon">▶</span>
          <span id="ahs-slide-label">Đọc Slide</span>
        </button>
        <button class="ahs-btn ahs-btn-success" id="ahs-btn-solve-now" title="Giải câu hỏi trên màn hình hiện tại">
          <span class="ahs-btn-icon">🎯</span>
          <span>Giải câu này</span>
        </button>
        <button class="ahs-btn ahs-btn-secondary" id="ahs-btn-auto-all" title="Tự động giải toàn bộ đề thi / bài tập LMS">
          <span class="ahs-btn-icon" id="ahs-auto-icon">⚡</span>
          <span id="ahs-auto-label">Tự giải đề</span>
        </button>
      </div>

      <div class="ahs-controls-row">
        <div class="ahs-control-group">
          <label class="ahs-label">⏱ Tốc độ:</label>
          <select class="ahs-select" id="ahs-speed-select">
            <option value="500">0.5s</option>
            <option value="1000">1.0s</option>
            <option value="2000">2.0s</option>
            <option value="3000">3.0s</option>
          </select>
        </div>
        <label class="ahs-toggle-label" title="Tự động mở bài tập khi slide yêu cầu">
          <input type="checkbox" id="ahs-auto-quiz-toggle" checked />
          <span class="ahs-toggle-switch"></span>
          <span class="ahs-toggle-text">Tự giải bài</span>
        </label>
      </div>

      <div class="ahs-ticker">
        <span class="ahs-ticker-icon" id="ahs-ticker-icon">ℹ️</span>
        <span class="ahs-ticker-text" id="ahs-ticker-text">Hệ thống sẵn sàng tự động học slide & giải bài.</span>
      </div>
    </div>

    <!-- Mini Bar (Collapsed mode) -->
    <div class="ahs-mini-bar" id="ahs-mini-bar" style="display: none;">
      <div class="ahs-drag-grip" title="Kéo để di chuyển">⠿</div>
      <span class="ahs-logo-icon" style="width: 18px; height: 18px; font-size: 11px;">⚡</span>
      <span class="ahs-mini-counter" id="ahs-mini-counter">-- / --</span>
      <button class="ahs-mini-btn" id="ahs-mini-btn-slide" title="Bắt đầu / Dừng đọc slide">▶</button>
      <button class="ahs-mini-btn ahs-mini-btn-solve" id="ahs-mini-btn-solve" title="Giải câu này">🎯</button>
      <button class="ahs-mini-expand" id="ahs-mini-expand" title="Mở rộng">+</button>
      <button class="ahs-mini-close" id="ahs-mini-close" title="Đóng thanh nổi">✕</button>
    </div>
  `;

  shadow.appendChild(dock);

  // DYNAMIC HOST MOUNTING:
  // If an active Radix UI dialog (lecture or quiz modal) is present, mount `host` INSIDE it!
  // When `host` is a child of the dialog, Radix UI's `DismissableLayer` evaluates `dialog.contains(target) === true`.
  // Therefore, it NEVER considers clicking or dragging the toolbar as an outside click, completely
  // preventing the lecture dialog from exiting!
  function findActiveLectureOrQuizDialog() {
    try {
      var dialogs = document.querySelectorAll('div[role="dialog"]');
      for (var i = dialogs.length - 1; i >= 0; i--) {
        var dlg = dialogs[i];
        if (dlg.getAttribute('data-state') === 'closed') continue;
        if (dlg.offsetWidth > 0 || dlg.offsetHeight > 0 || (dlg.getClientRects && dlg.getClientRects().length > 0)) {
          return dlg;
        }
        var style = window.getComputedStyle(dlg);
        if (style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0') {
          return dlg;
        }
      }
    } catch (_) {}
    return null;
  }

  function ensureHostMounted() {
    if (!host) return;
    if (window.__ahs_active_floating_instance_id !== currentInstanceId) return;
    if (!isVisible) {
      if (host.style.display !== 'none') host.style.display = 'none';
      return;
    }
    try {
      var activeDialog = findActiveLectureOrQuizDialog();
      var targetParent = activeDialog || document.body || document.documentElement;

      if (targetParent && host.parentElement !== targetParent) {
        targetParent.appendChild(host);
      }
    } catch (_) {}
  }

  // Cleanup hook to tear down observers and rogue elements if re-injected
  window.__ahs_cleanup_floating_bar = function () {
    try {
      if (dialogObserver) dialogObserver.disconnect();
      if (statusInterval) clearInterval(statusInterval);
      if (host && host.parentElement) host.remove();
      var rogue = document.querySelectorAll('#ahs-floating-bar-host, .ahs-dock, .ahs-mini-bar');
      for (var j = 0; j < rogue.length; j++) {
        rogue[j].style.display = 'none';
        rogue[j].remove();
      }
    } catch (_) {}
  };

  // Observer to automatically move host into dialog the instant dialog opens or closes
  try {
    var dialogObserver = new MutationObserver(function () {
      if (window.__ahs_active_floating_instance_id !== currentInstanceId) {
        dialogObserver.disconnect();
        return;
      }
      if (!isVisible) return;
      ensureHostMounted();
    });
    dialogObserver.observe(document.documentElement || document.body, {
      childList: true,
      subtree: true
    });
  } catch (_) {}

  // Helper: check if any event path / target is inside our floating bar
  function isEventInsideBar(e) {
    if (!e) return false;
    try {
      var path = (typeof e.composedPath === 'function') ? e.composedPath() : [];
      for (var i = 0; i < path.length; i++) {
        var el = path[i];
        if (!el) continue;
        if (el === host || el === dock || el === miniBarEl) return true;
        if (el.id === 'ahs-floating-bar-host' || el.id === 'ahs-dock' || el.id === 'ahs-mini-bar') return true;
        if (el.classList && typeof el.classList.contains === 'function') {
          if (el.classList.contains('ahs-dock') || el.classList.contains('ahs-mini-bar')) return true;
        }
      }
      var t = e.target;
      if (t) {
        if (t === host || t === dock || t === miniBarEl) return true;
        if (t.id === 'ahs-floating-bar-host') return true;
        if (host && host.contains && host.contains(t)) return true;
        if (shadow && shadow.contains && shadow.contains(t)) return true;
      }
    } catch (_) {}
    return false;
  }

  // WINDOW & DOCUMENT CAPTURE INTERCEPTOR (First listener in browser before Document or React):
  // Ensures host is inside active dialog before Radix UI inspects contains()
  var blockerEvents = ['pointerdown', 'mousedown', 'touchstart', 'touchend', 'click'];
  blockerEvents.forEach(function (evtName) {
    window.addEventListener(evtName, function (e) {
      if (isEventInsideBar(e)) {
        ensureHostMounted();
      }
    }, true); // TRUE = CAPTURE PHASE on Window

    document.addEventListener(evtName, function (e) {
      if (isEventInsideBar(e)) {
        ensureHostMounted();
      }
    }, true); // TRUE = CAPTURE PHASE on Document
  });

  // PREVENT RADIX UI / OUTSIDE CLICK DISMISSAL
  // Radix UI Dialog DismissableLayer listens for pointerdown / mousedown / click on document.
  // Stopping propagation here guarantees these events NEVER escape the floating bar to document/window,
  // preventing the lecture dialog from unexpectedly closing when the user interacts with or drags the toolbar.
  var stopOutsidePropagation = function (e) {
    if (typeof e.stopPropagation === 'function') e.stopPropagation();
  };

  var outsideBlockerEvents = [
    'pointerdown', 'mousedown', 'mouseup', 'click', 'dblclick',
    'touchstart', 'touchend', 'touchcancel', 'pointerup',
    'pointercancel', 'contextmenu'
  ];

  outsideBlockerEvents.forEach(function (evtName) {
    dock.addEventListener(evtName, stopOutsidePropagation);
    host.addEventListener(evtName, stopOutsidePropagation);
  });

  // Prevent focus theft on buttons so Radix FocusScope does not blur or dismiss
  shadow.querySelectorAll('button').forEach(function (btn) {
    btn.setAttribute('tabindex', '-1');
    btn.addEventListener('mousedown', function (e) {
      if (e.cancelable) e.preventDefault();
    });
  });

  // DOM Elements
  var dragHeader = shadow.getElementById('ahs-drag-header');
  var bodyEl = shadow.getElementById('ahs-body');
  var miniBarEl = shadow.getElementById('ahs-mini-bar');
  var btnMinimize = shadow.getElementById('ahs-btn-minimize');
  var btnClose = shadow.getElementById('ahs-btn-close');
  var miniExpand = shadow.getElementById('ahs-mini-expand');
  var miniClose = shadow.getElementById('ahs-mini-close');

  var statusBadge = shadow.getElementById('ahs-status-badge');
  var statusText = shadow.getElementById('ahs-status-text');
  var counterBadge = shadow.getElementById('ahs-counter-badge');
  var miniCounter = shadow.getElementById('ahs-mini-counter');

  var btnSlide = shadow.getElementById('ahs-btn-slide');
  var slideIcon = shadow.getElementById('ahs-slide-icon');
  var slideLabel = shadow.getElementById('ahs-slide-label');
  var miniBtnSlide = shadow.getElementById('ahs-mini-btn-slide');

  var btnSolveNow = shadow.getElementById('ahs-btn-solve-now');
  var miniBtnSolve = shadow.getElementById('ahs-mini-btn-solve');
  var btnAutoAll = shadow.getElementById('ahs-btn-auto-all');
  var autoIcon = shadow.getElementById('ahs-auto-icon');
  var autoLabel = shadow.getElementById('ahs-auto-label');

  var speedSelect = shadow.getElementById('ahs-speed-select');
  var autoQuizToggle = shadow.getElementById('ahs-auto-quiz-toggle');
  var tickerText = shadow.getElementById('ahs-ticker-text');
  var tickerIcon = shadow.getElementById('ahs-ticker-icon');

  // Load preferences
  var savedSpeed = localStorage.getItem('ahs_float_speed');
  if (savedSpeed && speedSelect) speedSelect.value = savedSpeed;

  var savedAutoQuiz = localStorage.getItem('ahs_float_auto_quiz');
  if (savedAutoQuiz !== null && autoQuizToggle) autoQuizToggle.checked = savedAutoQuiz === 'true';

  // Restore position
  function restorePosition() {
    try {
      var pos = JSON.parse(localStorage.getItem('ahs_float_pos') || 'null');
      if (pos && typeof pos.top === 'number' && typeof pos.left === 'number') {
        var maxLeft = Math.max(10, window.innerWidth - (isCollapsed ? 180 : 330));
        var maxTop = Math.max(10, window.innerHeight - (isCollapsed ? 50 : 220));
        dock.style.left = Math.min(Math.max(10, pos.left), maxLeft) + 'px';
        dock.style.top = Math.min(Math.max(10, pos.top), maxTop) + 'px';
        return;
      }
    } catch (_) {}

    // Default: Top-right corner
    dock.style.left = Math.max(10, window.innerWidth - 340) + 'px';
    dock.style.top = '20px';
  }

  // Restore collapsed state
  function updateCollapsedUI() {
    if (!isVisible) {
      dock.style.display = 'none';
      miniBarEl.style.display = 'none';
      return;
    }
    if (isCollapsed) {
      bodyEl.style.display = 'none';
      dragHeader.style.display = 'none';
      miniBarEl.style.display = 'flex';
      dock.style.display = 'block';
      dock.style.width = 'auto';
      dock.style.borderRadius = '9999px';
      dock.style.border = 'none';
      dock.style.background = 'transparent';
      dock.style.boxShadow = 'none';
    } else {
      bodyEl.style.display = 'flex';
      dragHeader.style.display = 'flex';
      miniBarEl.style.display = 'none';
      dock.style.display = 'block';
      dock.style.width = '320px';
      dock.style.borderRadius = '16px';
      dock.style.background = 'rgba(15, 23, 42, 0.94)';
      dock.style.border = '1px solid rgba(139, 92, 246, 0.35)';
      dock.style.boxShadow = '0 16px 40px -8px rgba(0, 0, 0, 0.65), 0 0 20px rgba(99, 102, 241, 0.18)';
    }
  }

  function setFloatingBarVisible(visible) {
    isVisible = !!visible;
    if (isVisible) {
      if (host) host.style.display = 'block';
      updateCollapsedUI();
      restorePosition();
      ensureHostMounted();
    } else {
      if (host) host.style.display = 'none';
      if (dock) dock.style.display = 'none';
      if (miniBarEl) miniBarEl.style.display = 'none';
      try {
        var allHosts = document.querySelectorAll('#ahs-floating-bar-host, .ahs-dock, .ahs-mini-bar');
        for (var i = 0; i < allHosts.length; i++) {
          if (allHosts[i] !== host) {
            allHosts[i].style.display = 'none';
            allHosts[i].remove();
          }
        }
      } catch (_) {}
    }
  }

  function handleCloseFloatingBar(e) {
    if (e) {
      if (typeof e.stopPropagation === 'function') e.stopPropagation();
      if (e.cancelable) e.preventDefault();
    }
    setFloatingBarVisible(false);
    try {
      chrome.storage.local.set({ ahs_floating_bar_visible: false });
      chrome.runtime.sendMessage({
        type: 'FLOATING_BAR_VISIBILITY_CHANGED',
        visible: false
      });
    } catch (_) {}
  }

  if (btnClose) btnClose.addEventListener('click', handleCloseFloatingBar);
  if (miniClose) miniClose.addEventListener('click', handleCloseFloatingBar);

  btnMinimize.addEventListener('click', function (e) {
    e.stopPropagation();
    isCollapsed = true;
    localStorage.setItem('ahs_float_collapsed', 'true');
    updateCollapsedUI();
    restorePosition();
  });

  miniExpand.addEventListener('click', function (e) {
    e.stopPropagation();
    isCollapsed = false;
    localStorage.setItem('ahs_float_collapsed', 'false');
    updateCollapsedUI();
    restorePosition();
  });

  // Dragging Implementation (Pointer Events + Mouse & Touch Fallbacks)
  var isDragging = false;
  var dragStartX = 0;
  var dragStartY = 0;
  var initialLeft = 0;
  var initialTop = 0;
  var activePointerId = null;

  function onDragStart(e) {
    if (e.target && e.target.closest && e.target.closest('button, select, input, a')) return;
    if (e.button !== undefined && e.button !== 0) return;

    isDragging = true;
    activePointerId = e.pointerId !== undefined ? e.pointerId : null;

    var clientX = e.clientX;
    var clientY = e.clientY;
    if (clientX === undefined && e.touches && e.touches[0]) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    }

    dragStartX = clientX;
    dragStartY = clientY;

    var rect = dock.getBoundingClientRect();
    initialLeft = rect.left;
    initialTop = rect.top;

    if (e.target && typeof e.target.setPointerCapture === 'function' && e.pointerId !== undefined) {
      try {
        e.target.setPointerCapture(e.pointerId);
      } catch (_) {}
    }

    if (e.cancelable) e.preventDefault();
    if (typeof e.stopPropagation === 'function') e.stopPropagation();
  }

  function onDragMove(e) {
    if (!isDragging) return;

    var clientX = e.clientX;
    var clientY = e.clientY;
    if (clientX === undefined && e.touches && e.touches[0]) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    }
    if (clientX === undefined || clientY === undefined) return;

    var deltaX = clientX - dragStartX;
    var deltaY = clientY - dragStartY;

    var newLeft = initialLeft + deltaX;
    var newTop = initialTop + deltaY;

    var dockW = dock.offsetWidth || (isCollapsed ? 180 : 320);
    var dockH = dock.offsetHeight || (isCollapsed ? 44 : 200);

    newLeft = Math.max(10, Math.min(newLeft, window.innerWidth - dockW - 10));
    newTop = Math.max(10, Math.min(newTop, window.innerHeight - dockH - 10));

    dock.style.left = newLeft + 'px';
    dock.style.top = newTop + 'px';

    if (e.cancelable) e.preventDefault();
    if (typeof e.stopPropagation === 'function') e.stopPropagation();
  }

  function onDragEnd(e) {
    if (!isDragging) return;
    isDragging = false;

    if (e && e.target && typeof e.target.releasePointerCapture === 'function' && activePointerId !== null) {
      try {
        e.target.releasePointerCapture(activePointerId);
      } catch (_) {}
    }
    activePointerId = null;

    try {
      var rect = dock.getBoundingClientRect();
      localStorage.setItem('ahs_float_pos', JSON.stringify({ top: rect.top, left: rect.left }));
    } catch (_) {}

    if (e) {
      if (e.cancelable) e.preventDefault();
      if (typeof e.stopPropagation === 'function') e.stopPropagation();
    }
  }

  // Bind drag listeners to dragHeader and miniBarEl (Pointer Events)
  dragHeader.addEventListener('pointerdown', onDragStart);
  miniBarEl.addEventListener('pointerdown', onDragStart);

  // Mouse & Touch Fallbacks
  dragHeader.addEventListener('mousedown', onDragStart);
  miniBarEl.addEventListener('mousedown', onDragStart);
  dragHeader.addEventListener('touchstart', onDragStart, { passive: false });
  miniBarEl.addEventListener('touchstart', onDragStart, { passive: false });

  window.addEventListener('pointermove', onDragMove);
  window.addEventListener('mousemove', onDragMove);
  window.addEventListener('touchmove', onDragMove, { passive: false });

  window.addEventListener('pointerup', onDragEnd);
  window.addEventListener('pointercancel', onDragEnd);
  window.addEventListener('mouseup', onDragEnd);
  window.addEventListener('touchend', onDragEnd);

  dock.addEventListener('pointerup', onDragEnd);
  dock.addEventListener('mouseup', onDragEnd);
  dock.addEventListener('touchend', onDragEnd);
  window.addEventListener('resize', restorePosition);

  // Settings changes
  speedSelect.addEventListener('change', function () {
    localStorage.setItem('ahs_float_speed', speedSelect.value);
  });
  autoQuizToggle.addEventListener('change', function () {
    localStorage.setItem('ahs_float_auto_quiz', autoQuizToggle.checked ? 'true' : 'false');
  });

  // UI State Updater
  function updateSlideButtonUI(running) {
    isSlideRunning = running;
    if (running) {
      btnSlide.className = 'ahs-btn ahs-btn-stop';
      slideIcon.textContent = '⏹';
      slideLabel.textContent = 'Dừng Slide';
      miniBtnSlide.className = 'ahs-mini-btn ahs-mini-btn-stop';
      miniBtnSlide.textContent = '⏹';
      statusBadge.className = 'ahs-status-badge running';
      statusText.textContent = 'Đang đọc slide';
    } else {
      btnSlide.className = 'ahs-btn ahs-btn-primary';
      slideIcon.textContent = '▶';
      slideLabel.textContent = 'Đọc Slide';
      miniBtnSlide.className = 'ahs-mini-btn';
      miniBtnSlide.textContent = '▶';
      statusBadge.className = 'ahs-status-badge ready';
      statusText.textContent = 'Sẵn sàng';
    }
  }

  function updateAutoSolverButtonUI(running) {
    isAutoSolverRunning = running;
    if (running) {
      btnAutoAll.className = 'ahs-btn ahs-btn-secondary ahs-btn-stop';
      autoIcon.textContent = '⏹';
      autoLabel.textContent = 'Dừng tự giải';
      statusBadge.className = 'ahs-status-badge solving';
      statusText.textContent = 'Đang tự giải đề';
    } else {
      btnAutoAll.className = 'ahs-btn ahs-btn-secondary';
      autoIcon.textContent = '⚡';
      autoLabel.textContent = 'Tự giải đề';
      if (!isSlideRunning) {
        statusBadge.className = 'ahs-status-badge ready';
        statusText.textContent = 'Sẵn sàng';
      }
    }
  }

  // Action: Toggle Slide
  function toggleSlideAutomation() {
    if (isSlideRunning) {
      if (typeof window.__ahs_stopAutoSlide === 'function') {
        window.__ahs_stopAutoSlide();
      }
      updateSlideButtonUI(false);
      setTicker('⏹️ Đã dừng tự động đọc slide.', 'ready');
    } else {
      var delayMs = parseInt(speedSelect.value, 10) || 500;
      var autoQuiz = autoQuizToggle.checked;
      if (typeof window.__ahs_startAutoSlide === 'function') {
        window.__ahs_startAutoSlide({ delayMs: delayMs, autoQuiz: autoQuiz });
      }
      updateSlideButtonUI(true);
      setTicker('🚀 Đang tự động đọc slide & giải bài tập...', 'running');
    }
  }

  btnSlide.addEventListener('click', toggleSlideAutomation);
  miniBtnSlide.addEventListener('click', toggleSlideAutomation);

  // Action: Solve Current Question Now
  async function solveCurrentQuestionNow() {
    setTicker('🤔 Đang quét câu hỏi trên màn hình...', 'solving');
    statusBadge.className = 'ahs-status-badge solving';
    statusText.textContent = 'Đang giải...';

    try {
      var inQuiz = typeof isInsideClassroomQuiz === 'function' ? isInsideClassroomQuiz() : false;

      // 1. If inside Classroom Quiz
      if (inQuiz && typeof window.__ahs_solveSingleQuizQuestion === 'function') {
        await window.__ahs_solveSingleQuizQuestion();
        setTicker('✔️ Đã gửi câu trả lời!', 'success');
        statusBadge.className = 'ahs-status-badge ready';
        statusText.textContent = 'Đã giải xong';
        return;
      }

      // 2. Standard scan
      var questions = typeof scanQuestions === 'function' ? scanQuestions() : [];
      if (!questions || questions.length === 0) {
        if (typeof scanClassroomQuizQuestion === 'function') {
          questions = scanClassroomQuizQuestion();
        }
      }

      if (!questions || questions.length === 0) {
        setTicker('⚠️ Không tìm thấy câu hỏi nào trên màn hình!', 'warning');
        statusBadge.className = 'ahs-status-badge ready';
        statusText.textContent = 'Không có câu';
        return;
      }

      var q = questions[0];
      setTicker(`🤔 Đang gửi AI: "${q.questionText.slice(0, 35)}..."`, 'solving');

      var slideContext = (typeof getAccumulatedSlideContext === 'function' ? getAccumulatedSlideContext(1500) : '') ||
                         (typeof captureSlideContent === 'function' ? captureSlideContent() : '');

      chrome.runtime.sendMessage({
        type: 'ASK_GEMINI',
        question: q.questionText,
        options: q.options,
        questionType: q.questionType,
        slideContext: slideContext
      }, async function (res) {
        if (res && res.answer) {
          var letter = typeof extractAnswerLetter === 'function' ? extractAnswerLetter(res.answer) : '';
          setTicker(`💡 AI chọn: [${letter || 'X'}] -> Đang điền...`, 'success');
          if (typeof fillAnswer === 'function') {
            await fillAnswer(0, res.answer, letter);
          }
          // Click check button if active
          if (typeof findCheckQuizButton === 'function') {
            var checkBtn = findCheckQuizButton();
            if (checkBtn && isButtonEnabled(checkBtn)) {
              triggerClick(checkBtn);
            }
          }
          setTicker(`✔️ Đã điền đáp án [${letter || 'X'}] thành công!`, 'success');
          statusBadge.className = 'ahs-status-badge ready';
          statusText.textContent = 'Xong câu';
        } else {
          setTicker(`❌ Lỗi AI: ${res ? res.error : 'Không có phản hồi'}`, 'danger');
          statusBadge.className = 'ahs-status-badge ready';
          statusText.textContent = 'Lỗi';
        }
      });
    } catch (e) {
      setTicker(`❌ Lỗi: ${e.message}`, 'danger');
      statusBadge.className = 'ahs-status-badge ready';
      statusText.textContent = 'Lỗi';
    }
  }

  btnSolveNow.addEventListener('click', solveCurrentQuestionNow);
  miniBtnSolve.addEventListener('click', solveCurrentQuestionNow);

  // Action: Toggle Auto Solver All
  function toggleAutoSolverAll() {
    if (isAutoSolverRunning) {
      if (typeof window.__ahs_stopAutoSolver === 'function') {
        window.__ahs_stopAutoSolver();
      }
      updateAutoSolverButtonUI(false);
      setTicker('⏹️ Đã dừng tự giải đề.', 'ready');
    } else {
      if (typeof window.__ahs_startAutoSolver === 'function') {
        window.__ahs_startAutoSolver({ autoNext: true, fastMode: true });
        updateAutoSolverButtonUI(true);
        setTicker('🚀 Đang tự động giải toàn bộ đề thi...', 'solving');
      } else {
        setTicker('⚠️ Trình tự giải đề chưa tải, hãy mở trang làm bài!', 'warning');
      }
    }
  }

  btnAutoAll.addEventListener('click', toggleAutoSolverAll);

  // Helper: set ticker text & icon
  function setTicker(text, level) {
    if (!tickerText) return;
    tickerText.textContent = text;
    if (level === 'danger' || level === 'error') tickerIcon.textContent = '❌';
    else if (level === 'warning') tickerIcon.textContent = '⚠️';
    else if (level === 'success') tickerIcon.textContent = '🎉';
    else tickerIcon.textContent = 'ℹ️';
  }

  // Global update hook invoked by navigation.js sendSlideLog
  window.__ahs_updateFloatingBar = function (event) {
    if (!event) return;
    if (event.text) {
      setTicker(event.text, event.level);
    }
    if (event.counter) {
      if (counterBadge) counterBadge.textContent = event.counter;
      if (miniCounter) miniCounter.textContent = event.counter.replace('Slide:', '').trim();
    }
    if (event.badge) {
      if (event.badge === 'running') {
        updateSlideButtonUI(true);
      } else if (event.badge === 'quiz') {
        isSlideRunning = true;
        statusBadge.className = 'ahs-status-badge quiz';
        statusText.textContent = 'Giải bài trên lớp';
      } else if (event.badge === 'ready') {
        updateSlideButtonUI(false);
      } else if (event.badge === 'done') {
        updateSlideButtonUI(false);
        statusBadge.className = 'ahs-status-badge ready';
        statusText.textContent = 'Hoàn thành';
      }
    }
  };

  // Periodic lightweight status sync (counters & running state)
  var statusInterval = setInterval(function () {
    if (window.__ahs_active_floating_instance_id !== currentInstanceId) {
      clearInterval(statusInterval);
      return;
    }
    if (!isVisible) return;

    // 1. Sync Slide Counter
    if (typeof getSlideCounter === 'function') {
      var slideInfo = getSlideCounter();
      if (slideInfo && slideInfo.total > 0) {
        var str = `Slide: ${slideInfo.current} / ${slideInfo.total}`;
        if (counterBadge && counterBadge.textContent !== str) {
          counterBadge.textContent = str;
        }
        if (miniCounter) {
          miniCounter.textContent = `${slideInfo.current} / ${slideInfo.total}`;
        }
      }
    }

    // 2. Sync Quiz Progress
    if (typeof getQuizProgress === 'function') {
      var prog = getQuizProgress();
      if (prog && prog.total > 0 && typeof isInsideClassroomQuiz === 'function' && isInsideClassroomQuiz()) {
        statusBadge.className = 'ahs-status-badge quiz';
        statusText.textContent = `Đúng ${prog.correct}/${prog.total}`;
      }
    }

    // 3. Sync Running states from window globals
    var curSlideRun = window.__ahs_isSlideRunning || false;
    if (curSlideRun !== isSlideRunning) {
      updateSlideButtonUI(curSlideRun);
    }

    var curSolverRun = window.__ahs_isAutoSolverRunning || false;
    if (curSolverRun !== isAutoSolverRunning) {
      updateAutoSolverButtonUI(curSolverRun);
    }
  }, 1000);

  // Chrome message listener for runtime events
  chrome.runtime.onMessage.addListener(function (message, sender, sendResponse) {
    if (message.type === 'SET_FLOATING_BAR_VISIBILITY') {
      setFloatingBarVisible(message.visible);
      if (sendResponse) sendResponse({ success: true, visible: isVisible });
      return true;
    } else if (message.type === 'TOGGLE_FLOATING_BAR') {
      setFloatingBarVisible(!isVisible);
      try {
        chrome.storage.local.set({ ahs_floating_bar_visible: isVisible });
      } catch (_) {}
      if (sendResponse) sendResponse({ success: true, visible: isVisible });
      return true;
    } else if (message.type === 'GET_FLOATING_BAR_STATUS') {
      if (sendResponse) sendResponse({ visible: isVisible, collapsed: isCollapsed });
      return true;
    } else if (message.type === 'SLIDE_LOG_EVENT') {
      if (typeof window.__ahs_updateFloatingBar === 'function') {
        window.__ahs_updateFloatingBar(message);
      }
    } else if (message.type === 'START_AUTO_SLIDE') {
      updateSlideButtonUI(true);
    } else if (message.type === 'STOP_AUTO_SLIDE') {
      updateSlideButtonUI(false);
    }
  });

  // Initial render with storage preference
  try {
    chrome.storage.local.get(['ahs_floating_bar_visible'], function (res) {
      var shouldShow = res && typeof res.ahs_floating_bar_visible !== 'undefined'
        ? res.ahs_floating_bar_visible === true
        : true; // Default is true: shows immediately on page
      setFloatingBarVisible(shouldShow);
    });
  } catch (_) {
    setFloatingBarVisible(true);
  }
})();
