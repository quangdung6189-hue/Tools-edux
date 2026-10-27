// ── Initialize ──────────────────────────────────────────────────────────────────────────────────────
  async function init() {
    setupEventListeners();
    await loadSettings();
    await loadHistory();
    await syncBackgroundTasks();
  }

  
// ── Event Listeners ─────────────────────────────────────────────────────────────────────────────────
  function setupEventListeners() {
    // Tab switching
    tabs.forEach(tab => {
      tab.addEventListener('click', () => switchTab(tab.dataset.tab));
    });

    // Settings
    btnSettings.addEventListener('click', () => {
      settingsPanel.classList.toggle('hidden');
    });

    btnCloseSettings.addEventListener('click', () => {
      settingsPanel.classList.add('hidden');
    });

    if (providerSelect) {
      providerSelect.addEventListener('change', () => {
        updateProviderUI(providerSelect.value);
      });
    }

    // Custom API source editor (providers.js)
    if (providerPresetsWrap) {
      providerPresetsWrap.addEventListener('click', (e) => {
        const chip = e.target.closest('.preset-chip');
        if (!chip) return;
        const preset = (typeof CUSTOM_PROVIDER_PRESETS !== 'undefined')
          ? CUSTOM_PROVIDER_PRESETS.find(p => p.id === chip.dataset.presetId)
          : null;
        if (preset && typeof applyPresetToForm === 'function') {
          applyPresetToForm(preset);
        }
      });
    }
    if (customKindSelect) {
      customKindSelect.addEventListener('change', () => {
        if (typeof applyKindVisibility === 'function') {
          applyKindVisibility(customKindSelect.value, false);
        }
      });
    }
    if (btnLoadModels) {
      btnLoadModels.addEventListener('click', () => {
        if (typeof handleLoadModelList === 'function') handleLoadModelList();
      });
    }
    if (btnDeleteProvider) {
      btnDeleteProvider.addEventListener('click', () => {
        if (providerSelect && typeof deleteCustomProvider === 'function') {
          deleteCustomProvider(providerSelect.value);
        }
      });
    }
    if (btnCancelProvider) {
      btnCancelProvider.addEventListener('click', () => {
        if (typeof cancelProviderEdit === 'function') cancelProviderEdit();
      });
    }

    // API Key & Settings
    btnSaveKey.addEventListener('click', saveSettings);
    btnToggleKey.addEventListener('click', () => {
      apiKeyInput.type = apiKeyInput.type === 'password' ? 'text' : 'password';
      btnToggleKey.textContent = apiKeyInput.type === 'password' ? '👁️' : '🙈';
    });

    // Floating Toolbar Toggles
    if (btnToggleFloatingBar) {
      btnToggleFloatingBar.addEventListener('click', toggleFloatingBarVisibility);
    }
    if (toggleFloatingBar) {
      toggleFloatingBar.addEventListener('change', () => {
        setFloatingBarVisibility(toggleFloatingBar.checked);
      });
    }
    if (toggleSlideFloatingBar) {
      toggleSlideFloatingBar.addEventListener('change', () => {
        setFloatingBarVisibility(toggleSlideFloatingBar.checked);
      });
    }

    // Academic Exam Grounding Toggle
    if (toggleWebGrounding) {
      toggleWebGrounding.addEventListener('change', async () => {
        await chrome.storage.local.set({ enableWebGrounding: toggleWebGrounding.checked });
      });
    }

    // Main actions
    btnScan.addEventListener('click', scanPage);
    btnAutoAll.addEventListener('click', () => {
      if (isProcessing) {
        stopAutoSolveAll();
      } else {
        autoSolveAll();
      }
    });

    // History
    btnClearHistory.addEventListener('click', clearHistory);

    // Reference / Attachment listeners
    if (btnAttachFile && inputRefFile) {
      btnAttachFile.addEventListener('click', () => inputRefFile.click());
      inputRefFile.addEventListener('change', handleFileAttachment);
    }
    if (btnPasteContext && referencePasteArea) {
      btnPasteContext.addEventListener('click', () => {
        referencePasteArea.classList.toggle('hidden');
        if (!referencePasteArea.classList.contains('hidden') && refTextInput) {
          refTextInput.focus();
        }
      });
    }
    if (refTextInput && refCharCount) {
      refTextInput.addEventListener('input', () => {
        refCharCount.textContent = `${refTextInput.value.length} ký tự`;
      });
    }
    if (btnSaveRefText && refTextInput) {
      btnSaveRefText.addEventListener('click', handleSavePastedText);
    }
    if (btnClearRef) {
      btnClearRef.addEventListener('click', handleClearReference);
    }

    // URL & Tab Reference Listeners
    if (btnAddUrl) {
      btnAddUrl.addEventListener('click', handleToggleUrlArea);
    }
    if (btnFetchUrl) {
      btnFetchUrl.addEventListener('click', handleFetchUrlContent);
    }
    if (refUrlInput) {
      refUrlInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          handleFetchUrlContent();
        }
      });
    }
    if (btnFetchCurrentTab) {
      btnFetchCurrentTab.addEventListener('click', handleFetchFromCurrentTab);
    }
    if (btnSelectOpenTab) {
      btnSelectOpenTab.addEventListener('click', handleShowOpenTabsList);
    }
    if (btnCloseTabsDropdown) {
      btnCloseTabsDropdown.addEventListener('click', () => {
        if (openTabsDropdown) openTabsDropdown.classList.add('hidden');
      });
    }

    // Slide Automation
    if (btnStartSlide) btnStartSlide.addEventListener('click', startSlideAutomation);
    if (btnStopSlide) btnStopSlide.addEventListener('click', stopSlideAutomation);
    if (btnClearSlideLog) {
      btnClearSlideLog.addEventListener('click', () => {
        if (slideLogContainer) slideLogContainer.innerHTML = '';
      });
    }

    // Listen for slide log events and solver progress events from content script
    chrome.runtime.onMessage.addListener((message) => {
      if (message.type === 'SLIDE_LOG_EVENT') {
        handleSlideLogEvent(message);
      }
      if (message.type === 'SOLVER_PROGRESS_EVENT') {
        handleSolverProgressEvent(message);
      }
      if (message.type === 'FLOATING_BAR_VISIBILITY_CHANGED') {
        updateFloatingBarToggles(message.visible);
      }
    });
  }

  function updateProviderUI(provider) {
    // Nguồn tùy chỉnh / thêm mới: state machine đầy đủ nằm ở providers.js
    if (typeof applyProviderUIState === 'function') {
      applyProviderUIState(provider);
      return;
    }

    // Fallback (providers.js chưa tải): hành vi cũ cho 2 nguồn tích hợp
    if (provider === 'gemini') {
      if (groupEndpoint) groupEndpoint.style.display = 'none';
      if (labelApiKey) labelApiKey.textContent = '🔑 Google Gemini API Key';
      if (apiKeyInput) apiKeyInput.placeholder = 'Dán API key từ Google AI Studio (AIzaSy...)';
      if (linkHelpKey) {
        linkHelpKey.textContent = '→ Lấy API key miễn phí tại Google AI Studio';
        linkHelpKey.href = 'https://aistudio.google.com/apikey';
      }
    } else {
      if (groupEndpoint) groupEndpoint.style.display = 'block';
      if (labelApiKey) labelApiKey.textContent = '🔑 9Router API Key (sk-...)';
      if (apiKeyInput) apiKeyInput.placeholder = 'Dán key sk-... từ 9Router vào đây...';
      if (linkHelpKey) {
        linkHelpKey.textContent = '→ Mở bảng điều khiển 9Router';
        linkHelpKey.href = 'http://localhost:20128';
      }
    }
  }

  
// ── Tab Switching ───────────────────────────────────────────────────────────────────────────────────
  function switchTab(tabName) {
    tabs.forEach(t => t.classList.toggle('active', t.dataset.tab === tabName));
    tabContents.forEach(tc => {
      tc.classList.toggle('active', tc.id === `tab-${tabName}`);
    });

    if (tabName === 'history') {
      loadHistory();
    }
  }

  
// ── Boot ────────────────────────────────────────────────────────────────────────────────────────────
  init();


