(function () {
  'use strict';

  function initializeAmbientRainbow() {
    const root = document.documentElement;
    let nextX = 50;
    let nextY = 42;
    let framePending = false;

    const updateFromPointer = event => {
      if (!event.isPrimary || !window.innerWidth || !window.innerHeight) return;
      nextX = Math.max(0, Math.min(100, (event.clientX / window.innerWidth) * 100));
      nextY = Math.max(0, Math.min(100, (event.clientY / window.innerHeight) * 100));
      if (framePending) return;

      framePending = true;
      window.requestAnimationFrame(() => {
        root.style.setProperty('--ambient-x', `${nextX.toFixed(2)}%`);
        root.style.setProperty('--ambient-y', `${nextY.toFixed(2)}%`);
        framePending = false;
      });
    };

    document.addEventListener('pointermove', updateFromPointer, { passive: true });
    document.addEventListener('pointerdown', updateFromPointer, { passive: true });
  }

  function initializeSiteNavigation() {
    const navigation = document.querySelector('.site-navigation');
    const toggle = document.getElementById('navigation-more-button');
    const menu = document.getElementById('navigation-more-menu');
    if (!navigation || !toggle || !menu) return;
    let openedByHover = false;
    let pinnedOpen = false;

    const closeMenu = () => {
      menu.hidden = true;
      toggle.setAttribute('aria-expanded', 'false');
      openedByHover = false;
      pinnedOpen = false;
    };

    const openMenu = byHover => {
      menu.hidden = false;
      toggle.setAttribute('aria-expanded', 'true');
      openedByHover = byHover;
      pinnedOpen = !byHover;
    };

    toggle.addEventListener('click', () => {
      if (menu.hidden) {
        openMenu(false);
      } else if (openedByHover) {
        openedByHover = false;
        pinnedOpen = true;
      } else {
        closeMenu();
      }
    });

    toggle.addEventListener('pointerenter', event => {
      if (event.pointerType === 'mouse' && menu.hidden) openMenu(true);
    });

    navigation.addEventListener('pointerleave', event => {
      if (event.pointerType === 'mouse' && openedByHover && !pinnedOpen) closeMenu();
    });

    navigation.addEventListener('click', event => {
      if (event.target.closest('#navigation-more-menu a')) closeMenu();
    });

    document.addEventListener('click', event => {
      if (!navigation.contains(event.target)) closeMenu();
    });

    document.addEventListener('keydown', event => {
      if (event.key === 'Escape' && !menu.hidden) {
        closeMenu();
        toggle.focus();
      }
    });

    menu.querySelector('[data-scroll-to-top]')?.addEventListener('click', () => {
      closeMenu();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  function initializeBottomNavProgress() {
    const navigation = document.querySelector('.bottom-nav');
    if (!navigation) return;

    let updateScheduled = false;
    const update = () => {
      const documentHeight = Math.max(document.documentElement.scrollHeight, document.body.scrollHeight);
      const maximumScroll = Math.max(0, documentHeight - window.innerHeight);
      const progress = maximumScroll > 0 ? Math.min(1, Math.max(0, window.scrollY / maximumScroll)) : 0;
      navigation.style.setProperty('--reading-progress', String(progress));
      updateScheduled = false;
    };
    const scheduleUpdate = () => {
      if (updateScheduled) return;
      updateScheduled = true;
      window.requestAnimationFrame(update);
    };

    update();
    window.addEventListener('scroll', scheduleUpdate, { passive: true });
    window.addEventListener('resize', scheduleUpdate);
  }

  function setMode(mode) {
    const allowedModes = ['auto', 'light', 'dark'];
    const selectedMode = allowedModes.includes(mode) ? mode : 'auto';
    const resolvedMode = selectedMode === 'auto'
      ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
      : selectedMode;

    document.documentElement.dataset.theme = resolvedMode;
    document.documentElement.dataset.mode = selectedMode;
    localStorage.setItem('site-mode', selectedMode);

    const button = document.getElementById('theme-toggle-button');
    if (!button) return;
    button.dataset.siteMode = selectedMode;
    const icon = button.querySelector('.material-icons');
    const iconName = selectedMode === 'auto' ? 'brightness_auto' : resolvedMode === 'dark' ? 'dark_mode' : 'light_mode';
    if (icon) icon.textContent = iconName;
    const label = selectedMode === 'auto' ? '自動主題' : resolvedMode === 'dark' ? '暗黑主題' : '明亮主題';
    button.setAttribute('aria-label', label);
    button.title = label;
  }

  function initializeThemeToggle() {
    setMode(localStorage.getItem('site-mode') || 'auto');
    const themeButton = document.getElementById('theme-toggle-button');
    themeButton?.addEventListener('click', () => {
      const currentMode = localStorage.getItem('site-mode') || 'auto';
      const effectiveTheme = document.documentElement.dataset.theme
        || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
      const nextMode = currentMode === 'auto'
        ? (effectiveTheme === 'dark' ? 'light' : 'dark')
        : (effectiveTheme === 'dark' ? 'light' : 'dark');
      setMode(nextMode);
    });
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
      if (localStorage.getItem('site-mode') === 'auto') setMode('auto');
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    initializeAmbientRainbow();
    initializeSiteNavigation();
    initializeBottomNavProgress();
    initializeThemeToggle();
  });
})();