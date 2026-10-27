const assert = require('assert');

// Simulate the dragging mathematics and logic
let dock = {
  style: { left: '100px', top: '100px' },
  getBoundingClientRect: () => ({ left: 100, top: 100, width: 220, height: 44 }),
  offsetWidth: 220,
  offsetHeight: 44
};

let isDragging = false;
let dragStartX = 0;
let dragStartY = 0;
let initialLeft = 0;
let initialTop = 0;
let activePointerId = null;
let savedPosition = null;

const windowWidth = 1920;
const windowHeight = 1080;

function onDragStart(e) {
  if (e.target && e.target.closest && e.target.closest('button, select, input, a')) return;
  if (e.button !== undefined && e.button !== 0) return;

  isDragging = true;
  activePointerId = e.pointerId;

  var clientX = e.clientX;
  var clientY = e.clientY;

  dragStartX = clientX;
  dragStartY = clientY;

  var rect = dock.getBoundingClientRect();
  initialLeft = rect.left;
  initialTop = rect.top;
}

function onDragMove(e) {
  if (!isDragging) return;

  var clientX = e.clientX;
  var clientY = e.clientY;
  if (clientX === undefined || clientY === undefined) return;

  var deltaX = clientX - dragStartX;
  var deltaY = clientY - dragStartY;

  var newLeft = initialLeft + deltaX;
  var newTop = initialTop + deltaY;

  var dockW = dock.offsetWidth || 220;
  var dockH = dock.offsetHeight || 44;

  newLeft = Math.max(10, Math.min(newLeft, windowWidth - dockW - 10));
  newTop = Math.max(10, Math.min(newTop, windowHeight - dockH - 10));

  dock.style.left = newLeft + 'px';
  dock.style.top = newTop + 'px';
}

function onDragEnd(e) {
  if (!isDragging) return;
  isDragging = false;
  activePointerId = null;

  savedPosition = {
    left: parseInt(dock.style.left, 10),
    top: parseInt(dock.style.top, 10)
  };
}

// 1. Test clicking a button inside toolbar (e.g. Play, Close, Expand)
const mockButton = { tagName: 'BUTTON', closest: (sel) => sel.includes('button') ? mockButton : null };
onDragStart({ target: mockButton, clientX: 120, clientY: 110, pointerId: 1, button: 0 });
assert.strictEqual(isDragging, false, 'Clicking button must not start drag');

// 2. Test clicking drag grip or header area
const mockDragGrip = { tagName: 'DIV', closest: () => null };
onDragStart({ target: mockDragGrip, clientX: 120, clientY: 110, pointerId: 1, button: 0 });
assert.strictEqual(isDragging, true, 'Clicking drag grip must start drag');
assert.strictEqual(initialLeft, 100);
assert.strictEqual(initialTop, 100);

// 3. Test moving cursor by +50px right and +30px down
onDragMove({ clientX: 170, clientY: 140 });
assert.strictEqual(dock.style.left, '150px', 'Dock should move to left 150px (100 + 50)');
assert.strictEqual(dock.style.top, '130px', 'Dock should move to top 130px (100 + 30)');

// 4. Test dragging beyond right screen edge (clamping)
onDragMove({ clientX: 2500, clientY: 140 });
const expectedMaxLeft = windowWidth - dock.offsetWidth - 10;
assert.strictEqual(dock.style.left, expectedMaxLeft + 'px', 'Dock left should be clamped to viewport edge');

// 5. Release pointer
onDragEnd({});
assert.strictEqual(isDragging, false, 'Drag must end');
assert.strictEqual(savedPosition.left, expectedMaxLeft, 'Position must be saved properly');

console.log('✅ All drag logic tests passed successfully!');
