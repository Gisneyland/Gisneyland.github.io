(function () {
  'use strict';
  const preference = window.matchMedia('(prefers-color-scheme: dark)');
  let mode = 'auto';
  function readMode() {
    try {
      const saved = localStorage.getItem('site-mode');
      return ['light', 'dark'].includes(saved) ? saved : 'auto';
    } catch { return 'auto'; }
  }
  function apply(value) {
    mode = value;
    const theme = mode === 'auto' ? (preference.matches ? 'dark' : 'light') : mode;
    document.documentElement.dataset.mode = mode;
    document.documentElement.dataset.theme = theme;
    const button = document.getElementById('theme-toggle-button');
    if (!button) return;
    const label = mode === 'auto'
      ? '切換主題（目前：自動跟隨系統）'
      : `切換主題（目前：${theme === 'dark' ? '暗黑' : '明亮'}）`;
    button.setAttribute('aria-label', label);
    button.title = label;
    button.dataset.siteMode = mode;
    button.querySelector('.material-icons').textContent = mode === 'auto' ? 'brightness_auto' : `${theme}_mode`;
  }
  apply(readMode());
  preference.addEventListener('change', () => { if (mode === 'auto') apply(mode); });
  window.addEventListener('storage', event => {
    if (event.key === 'site-mode' || event.key === null) apply(readMode());
  });
  document.addEventListener('DOMContentLoaded', () => {
    apply(mode);
    document.getElementById('theme-toggle-button')?.addEventListener('click', () => {
      const theme = document.documentElement.dataset.theme;
      const next = theme === 'dark' ? 'light' : 'dark';
      try { localStorage.setItem('site-mode', next); } catch { /* Theme switching works without storage. */ }
      apply(next);
    });
  });
})();
