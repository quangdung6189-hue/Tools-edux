const { JSDOM } = require('jsdom');
const dom = new JSDOM(`<!DOCTYPE html><html><body><div id="host"></div></body></html>`);
const { window } = dom;
const { document } = window;
const host = document.getElementById('host');
const shadow = host.attachShadow({ mode: 'open' });
const btn = document.createElement('button');
shadow.appendChild(btn);

let eventsFiredOnBtn = [];
['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click'].forEach(evt => {
  btn.addEventListener(evt, (e) => eventsFiredOnBtn.push(evt));
});

let docPointerDownDefaultPrevented = false;
document.addEventListener('pointerdown', (e) => {
  docPointerDownDefaultPrevented = e.defaultPrevented;
});

// Intercept on window capture: only call preventDefault, DO NOT call stopPropagation
window.addEventListener('pointerdown', (e) => {
  const path = e.composedPath ? e.composedPath() : [];
  if (path.includes(host) || path.includes(btn)) {
    e.preventDefault();
  }
}, true);

btn.dispatchEvent(new window.PointerEvent('pointerdown', { bubbles: true, composed: true, cancelable: true }));
btn.dispatchEvent(new window.MouseEvent('click', { bubbles: true, composed: true }));

console.log('Events on btn:', eventsFiredOnBtn);
console.log('Doc pointerdown defaultPrevented:', docPointerDownDefaultPrevented);
