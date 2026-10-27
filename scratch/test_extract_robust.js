const jsdom = (() => {
  try {
    return require('jsdom');
  } catch (e) {
    return null;
  }
})();

console.log('jsdom available:', !!jsdom);
