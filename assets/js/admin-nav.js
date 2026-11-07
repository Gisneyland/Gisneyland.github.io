(function () {
  'use strict';
  const nav = document.getElementById('admin-nav');
  const toggle = document.getElementById('admin-nav-toggle');
  if (!nav || !toggle) return;
  const KEY = 'admin-nav-collapsed';
  const wide = window.matchMedia('(min-width: 900px)');
  const label = toggle.querySelector('.admin-nav-toggle-label');
  const icon = toggle.querySelector('.material-icons');
  // Desktop and mobile remember their collapsed state separately.
  const storageKey = () => `${KEY}:${wide.matches ? 'wide' : 'narrow'}`;
  nav.querySelectorAll('.admin-tab').forEach(tab => {
    const text = tab.querySelector('.admin-tab-label')?.textContent.trim();
    if (text) tab.setAttribute('aria-label', text);
  });
  function read() {
    try { return localStorage.getItem(storageKey()) === '1'; } catch { return false; }
  }
  function apply(collapsed, save) {
    nav.classList.toggle('is-collapsed', collapsed);
    document.documentElement.classList.toggle('admin-nav-collapsed', collapsed);
    toggle.setAttribute('aria-expanded', String(!collapsed));
    const text = collapsed ? '展開導覽列' : '收合導覽列';
    toggle.setAttribute('aria-label', text);
    toggle.title = text;
    label.textContent = collapsed ? '展開' : '收合';
    icon.textContent = wide.matches ? (collapsed ? 'menu' : 'menu_open') : (collapsed ? 'keyboard_arrow_up' : 'keyboard_arrow_down');
    if (save) { try { localStorage.setItem(storageKey(), collapsed ? '1' : '0'); } catch { /* storage unavailable */ } }
  }
  toggle.addEventListener('click', () => apply(!nav.classList.contains('is-collapsed'), true));
  wide.addEventListener('change', () => apply(read(), false));
  apply(read(), false);
})();
