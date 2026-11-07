const localeOrder = ['zh-TW', 'en', 'id', 'th', 'vi', 'my', 'tl', 'km', 'bn'];

// Locale data lives in assets/js/i18n/<locale>.js (generated from _data/i18n.json).
// zh-TW ships with the page; other locales load on demand through loadLocale().
const i18n = {};
const i18nScriptUrl = new URL(document.currentScript.src, document.baseURI);
const localePromises = new Map();

function loadLocale(locale) {
  if (i18n[locale]) return Promise.resolve(true);
  if (!localeOrder.includes(locale)) return Promise.resolve(false);
  if (!localePromises.has(locale)) {
    localePromises.set(locale, new Promise(resolve => {
      const script = document.createElement('script');
      script.src = new URL(`i18n/${locale}.js${i18nScriptUrl.search}`, i18nScriptUrl).href;
      script.onload = () => resolve(Boolean(i18n[locale]));
      script.onerror = () => { localePromises.delete(locale); resolve(false); };
      document.head.append(script);
    }));
  }
  return localePromises.get(locale);
}

function setLanguage(language) {
  const selectedLanguage = Object.hasOwn(i18n, language) ? language : 'zh-TW';
  const translations = i18n[selectedLanguage];
  document.querySelectorAll('[data-i18n]').forEach(element => {
    const translation = translations[element.dataset.i18n];
    if (!translation) return;

    element.classList.add('notranslate');
    const icons = Array.from(element.children)
      .filter(child => child.classList.contains('material-icons'))
      .map(icon => icon.cloneNode(true));
    element.replaceChildren(document.createTextNode(translation));
    icons.forEach(icon => {
      icon.lang = selectedLanguage;
      element.append(' ', icon);
    });
    element.lang = selectedLanguage;
  });

  document.querySelectorAll('[data-i18n-aria-label]').forEach(element => {
    const translation = translations[element.dataset.i18nAriaLabel];
    if (translation) element.setAttribute('aria-label', translation);
  });
  document.querySelectorAll('[data-i18n-placeholder]').forEach(element => {
    const translation = translations[element.dataset.i18nPlaceholder];
    if (translation) element.placeholder = translation;
  });
  document.querySelectorAll('[data-i18n-title]').forEach(element => {
    const translation = translations[element.dataset.i18nTitle];
    if (translation) element.title = translation;
  });
  const staffIndicator = document.querySelector('.staff-session-tool');
  const staffStatus = document.getElementById('staff-session-status');
  const staffStatusKeys = {
    checking: 'staff_status_checking',
    'signed-in': 'staff_status_signed_in',
    'signed-out': 'staff_status_signed_out',
    unbound: 'staff_status_unbound',
    'not-staff': 'staff_status_not_authorized',
    error: 'staff_status_error',
    unknown: 'staff_status_error'
  };
  const staffStatusKey = staffIndicator && staffStatusKeys[staffIndicator.dataset.state];
  if (staffStatus && staffStatusKey && translations[staffStatusKey]) {
    staffStatus.textContent = translations[staffStatusKey];
  }
  document.documentElement.lang = selectedLanguage;
  document.documentElement.dataset.contentLanguage = selectedLanguage;
}
