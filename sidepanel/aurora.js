/* ============================================================
   Aurora Glass FX — interaction layer for the side panel.
   Purely visual: never touches solver state or business logic.
   - Pointer spotlight / 3D tilt / magnetic hero buttons (rAF-throttled)
   - Click ripples (event delegation)
   - Sliding tab indicator
   - Question-card state transitions + particle bursts
   - Pauses animations when the panel is hidden
   ============================================================ */
(() => {
  'use strict';

  const root = document.documentElement;
  const reduceMQ = window.matchMedia('(prefers-reduced-motion: reduce)');
  let reduceMotion = reduceMQ.matches;
  reduceMQ.addEventListener('change', (e) => { reduceMotion = e.matches; });

  const SPOT_SELECTOR = '.question-card, .reference-box, .slide-status-card, .slide-settings-card, .history-item, .toggle-switch-card, .settings-card-glow, .btn-hero';
  const TILT_SELECTOR = '.question-card, .history-item';
  const MAGNET_SELECTOR = '.btn-hero';
  const RIPPLE_SELECTOR = '.btn, .icon-btn, .tab, .btn-ref-pill, .btn-ref-clear, .btn-url-quick, .link-btn, .toggle-switch-card, .open-tab-item';

  const MAX_TILT_DEG = 2.2;
  const MAGNET_X = 7;
  const MAGNET_Y = 4;

  // ── Pointer tracking (one listener, rAF-throttled) ──────────
  let pendingEvent = null;
  let rafId = 0;
  let tiltEl = null;
  let magnetEl = null;

  function resetTilt(el) {
    el.style.removeProperty('--tilt-x');
    el.style.removeProperty('--tilt-y');
  }

  function resetMagnet(el) {
    el.style.removeProperty('--mag-x');
    el.style.removeProperty('--mag-y');
  }

  function flushPointer() {
    rafId = 0;
    const e = pendingEvent;
    pendingEvent = null;
    if (!e) return;

    const target = e.target instanceof Element ? e.target : null;

    // Spotlight
    const spotEl = target ? target.closest(SPOT_SELECTOR) : null;
    if (spotEl) {
      const r = spotEl.getBoundingClientRect();
      spotEl.style.setProperty('--spot-x', `${(e.clientX - r.left).toFixed(1)}px`);
      spotEl.style.setProperty('--spot-y', `${(e.clientY - r.top).toFixed(1)}px`);
    }

    // 3D tilt
    const nextTilt = (!reduceMotion && target) ? target.closest(TILT_SELECTOR) : null;
    if (tiltEl && tiltEl !== nextTilt) resetTilt(tiltEl);
    tiltEl = nextTilt;
    if (tiltEl) {
      const r = tiltEl.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width - 0.5;
      const py = (e.clientY - r.top) / r.height - 0.5;
      tiltEl.style.setProperty('--tilt-x', `${(-py * MAX_TILT_DEG * 2).toFixed(2)}deg`);
      tiltEl.style.setProperty('--tilt-y', `${(px * MAX_TILT_DEG * 2).toFixed(2)}deg`);
    }

    // Magnetic hero buttons
    const nextMagnet = (!reduceMotion && target) ? target.closest(MAGNET_SELECTOR) : null;
    if (magnetEl && magnetEl !== nextMagnet) resetMagnet(magnetEl);
    magnetEl = (nextMagnet && !nextMagnet.disabled) ? nextMagnet : null;
    if (magnetEl) {
      const r = magnetEl.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width - 0.5;
      const py = (e.clientY - r.top) / r.height - 0.5;
      magnetEl.style.setProperty('--mag-x', `${(px * MAGNET_X * 2).toFixed(1)}px`);
      magnetEl.style.setProperty('--mag-y', `${(py * MAGNET_Y * 2).toFixed(1)}px`);
    }
  }

  document.addEventListener('pointermove', (e) => {
    if (e.pointerType === 'touch') return;
    pendingEvent = e;
    if (!rafId) rafId = requestAnimationFrame(flushPointer);
  }, { passive: true });

  document.addEventListener('pointerout', (e) => {
    if (e.relatedTarget) return; // still inside the document
    if (tiltEl) { resetTilt(tiltEl); tiltEl = null; }
    if (magnetEl) { resetMagnet(magnetEl); magnetEl = null; }
  }, { passive: true });

  // ── Ripple ─────────────────────────────────────────────────
  document.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    const host = e.target instanceof Element ? e.target.closest(RIPPLE_SELECTOR) : null;
    if (!host || host.disabled) return;

    const r = host.getBoundingClientRect();
    const d = Math.max(r.width, r.height) * 2.2;
    const ripple = document.createElement('i');
    ripple.className = 'aurora-ripple';
    ripple.setAttribute('aria-hidden', 'true');
    ripple.style.width = ripple.style.height = `${d}px`;
    ripple.style.left = `${e.clientX - r.left - d / 2}px`;
    ripple.style.top = `${e.clientY - r.top - d / 2}px`;
    host.appendChild(ripple);

    if (host.classList.contains('btn-hero')) {
      burst(e.clientX, e.clientY, ['#67e8f9', '#c4b5fd', '#f0abfc', '#ffffff'], 10, 34);
    }
  }, { passive: true });

  // Removes ripples even if some code captured/restored innerHTML mid-animation.
  document.addEventListener('animationend', (e) => {
    const el = e.target;
    if (el instanceof Element && (el.classList.contains('aurora-ripple') || el.classList.contains('aurora-particle'))) {
      el.remove();
    }
  });

  // ── Particle burst ─────────────────────────────────────────
  function burst(x, y, colors, count = 16, spread = 46) {
    if (reduceMotion) return;
    const frag = document.createDocumentFragment();
    for (let i = 0; i < count; i++) {
      const p = document.createElement('i');
      p.className = 'aurora-particle';
      p.setAttribute('aria-hidden', 'true');
      const angle = (Math.PI * 2 * i) / count + Math.random() * 0.5;
      const dist = spread * (0.55 + Math.random() * 0.6);
      p.style.left = `${x}px`;
      p.style.top = `${y}px`;
      p.style.setProperty('--dx', `${(Math.cos(angle) * dist).toFixed(1)}px`);
      p.style.setProperty('--dy', `${(Math.sin(angle) * dist).toFixed(1)}px`);
      p.style.setProperty('--c', colors[i % colors.length]);
      p.style.setProperty('--s', `${(3 + Math.random() * 4).toFixed(1)}px`);
      frag.appendChild(p);
    }
    document.body.appendChild(frag);
  }

  // ── Sliding tab indicator ──────────────────────────────────
  function initTabIndicator() {
    const tabsEl = document.querySelector('.tabs');
    if (!tabsEl) return;

    const indicator = document.createElement('span');
    indicator.className = 'tab-indicator no-anim';
    indicator.setAttribute('aria-hidden', 'true');
    tabsEl.prepend(indicator);
    tabsEl.classList.add('has-indicator');

    const move = () => {
      const active = tabsEl.querySelector('.tab.active');
      if (!active) return;
      indicator.style.width = `${active.offsetWidth}px`;
      indicator.style.transform = `translateX(${active.offsetLeft}px)`;
    };

    const moveInstant = () => {
      indicator.classList.add('no-anim');
      move();
      void indicator.offsetWidth; // commit position before re-enabling transitions
      indicator.classList.remove('no-anim');
    };

    moveInstant();
    new MutationObserver(move).observe(tabsEl, { subtree: true, attributes: true, attributeFilter: ['class'] });
    new ResizeObserver(moveInstant).observe(tabsEl);
  }

  // ── Question-card state transitions ────────────────────────
  function celebrate(card) {
    card.classList.add('just-solved');
    setTimeout(() => card.classList.remove('just-solved'), 1400);
    const num = card.querySelector('.question-number');
    if (num) {
      const r = num.getBoundingClientRect();
      burst(r.left + r.width / 2, r.top + r.height / 2, ['#34d399', '#6ee7b7', '#a78bfa', '#67e8f9', '#fde68a']);
    }
  }

  function initQuestionObserver() {
    const container = document.getElementById('questions-container');
    if (!container) return;

    new MutationObserver((records) => {
      for (const rec of records) {
        if (!rec.removedNodes.length || !rec.addedNodes.length) continue;

        const removedById = new Map();
        rec.removedNodes.forEach((n) => {
          if (n instanceof HTMLElement && n.id) removedById.set(n.id, n);
        });

        rec.addedNodes.forEach((n) => {
          if (!(n instanceof HTMLElement) || !n.classList.contains('question-card')) return;
          const previous = removedById.get(n.id);
          if (!previous) return; // full re-render → keep staggered entrance

          n.classList.add('no-enter');
          const wasLoading = !!previous.querySelector('.spinner');
          if (!wasLoading) return;

          if (n.querySelector('.status-error')) {
            n.classList.add('just-failed');
            setTimeout(() => n.classList.remove('just-failed'), 600);
          } else if (n.querySelector('.answer-text')) {
            celebrate(n);
          }
        });
      }
    }).observe(container, { childList: true });
  }

  // ── Slide counter bump ─────────────────────────────────────
  function initSlideCounter() {
    const counter = document.getElementById('slide-counter');
    if (!counter) return;
    new MutationObserver(() => {
      counter.classList.remove('bump');
      void counter.offsetWidth;
      counter.classList.add('bump');
    }).observe(counter, { childList: true, characterData: true, subtree: true });
  }

  // ── Pause animations when the panel isn't visible ──────────
  document.addEventListener('visibilitychange', () => {
    root.classList.toggle('aurora-paused', document.hidden);
  });

  function init() {
    initTabIndicator();
    initQuestionObserver();
    initSlideCounter();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
