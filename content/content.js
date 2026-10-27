window.__ahs_version = '3.3';

// Always update the active message handler so newly injected scripts immediately take effect
window.__ahs_message_handler = (message, sender, sendResponse) => {
  if (message.type === 'PING') {
    sendResponse({ pong: true, version: '3.3' });
    return true;
  }

  if (message.type === 'SCAN_QUESTIONS') {
    (async () => {
      try {
        const questions = scanQuestions();
        scannedQuestions = questions;
        const counter = getPageCounter(questions);
        const pageContent = capturePageContent();

        // Sanitize questions to pure serializable JSON (strip live DOM elements and circular pointers)
        const serializableQuestions = questions.map((q, idx) => ({
          index: idx,
          questionText: q.questionText,
          questionNumber: q.questionNumber,
          questionType: q.questionType,
          isMultiStatement: !!q.isMultiStatement,
          options: Array.isArray(q.options) ? q.options : [],
          statements: Array.isArray(q.statements) ? q.statements.map(s => ({
            index: s.index,
            text: s.text
          })) : []
        }));

        sendResponse({ questions: serializableQuestions, counter, pageContent });
      } catch (err) {
        sendResponse({ error: err.message });
      }
    })();
    return true;
  }

  if (message.type === 'FILL_ANSWER') {
    (async () => {
      try {
        const result = await fillAnswer(message.questionIndex, message.answer, message.answerLetter);
        sendResponse(result);
      } catch (err) {
        sendResponse({ error: err.message });
      }
    })();
    return true;
  }

  if (message.type === 'NAVIGATE_NEXT') {
    (async () => {
      try {
        const result = navigateNext();
        sendResponse(result);
      } catch (err) {
        sendResponse({ error: err.message });
      }
    })();
    return true;
  }

  if (message.type === 'START_AUTO_SLIDE') {
    const res = startAutoSlide(message.config);
    sendResponse(res);
    return true;
  }

  if (message.type === 'STOP_AUTO_SLIDE') {
    const res = stopAutoSlide();
    sendResponse(res);
    return true;
  }

  if (message.type === 'GET_SLIDE_STATUS') {
    sendResponse(getSlideStatus());
    return true;
  }

  if (message.type === 'START_AUTO_SOLVER') {
    (async () => {
      try {
        const starter = window.__ahs_startAutoSolver;
        const res = typeof starter === 'function' ? await starter(message.config) : { error: 'Engine not loaded' };
        sendResponse(res);
      } catch (err) {
        sendResponse({ error: err.message });
      }
    })();
    return true;
  }

  if (message.type === 'STOP_AUTO_SOLVER') {
    const stopper = window.__ahs_stopAutoSolver;
    const res = typeof stopper === 'function' ? stopper() : { error: 'Engine not loaded' };
    sendResponse(res);
    return true;
  }

  if (message.type === 'GET_AUTO_SOLVER_STATUS') {
    const getter = window.__ahs_getAutoSolverStatus;
    const res = typeof getter === 'function' ? getter() : { running: false };
    sendResponse(res);
    return true;
  }

  if (message.type === 'SOLVE_AND_FILL_QUESTION') {
    (async () => {
      try {
        const solver = window.__ahs_solveAndFillSpecific;
        const questions = typeof scanQuestions === 'function' ? scanQuestions() : [];
        const targetQ = questions[message.questionIndex || 0];
        if (!targetQ) {
          sendResponse({ error: 'Question not found' });
          return;
        }
        const res = typeof solver === 'function'
          ? await solver(message.questionIndex || 0, targetQ, message.config || {})
          : { error: 'Engine not loaded' };
        sendResponse(res);
      } catch (err) {
        sendResponse({ error: err.message });
      }
    })();
    return true;
  }
};

if (!window.__ahs_listener_registered) {
  window.__ahs_listener_registered = true;

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (typeof window.__ahs_message_handler === 'function') {
      return window.__ahs_message_handler(message, sender, sendResponse);
    }
  });
}


  
