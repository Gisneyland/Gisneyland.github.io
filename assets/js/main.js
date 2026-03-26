document.addEventListener('DOMContentLoaded', function() {
  // 初始化 Materialize 元件
  M.FloatingActionButton.init(document.querySelectorAll('.fixed-action-btn'));
  M.Tooltip.init(document.querySelectorAll('.tooltipped'));
  var elems = document.querySelectorAll('select');
  M.FormSelect.init(elems);

  // 模式初始化
  const savedMode = localStorage.getItem('site-mode') || 'auto';
  setMode(savedMode);

  // 語言初始化
  const userLang = navigator.language || navigator.userLanguage;
  const defaultLang = userLang.startsWith("en") ? "en" : "zh-TW";
  setLanguage(defaultLang);
  const langSelect = document.getElementById("language-select");
  if (langSelect) {
    langSelect.value = defaultLang;
    langSelect.addEventListener("change", e => {
      setLanguage(e.target.value);
    });
  }
});

// 模式切換
/*
  function setMode(mode) {
  document.body.classList.remove('auto-mode', 'light-mode', 'dark-mode');
  document.body.classList.add(mode + '-mode');
  localStorage.setItem('site-mode', mode);
  const modeToggle = document.querySelector('.mode-toggle');
  if (modeToggle) modeToggle.value = mode;
}
*/

function setMode(mode) {
  const html = document.documentElement;
  if (mode === 'dark') {
    html.classList.add('dark');
  } else {
    html.classList.remove('dark');
  }
  localStorage.setItem('site-mode', mode);
}

// Google Translate 初始化
function googleTranslateElementInit() {
  new google.translate.TranslateElement(
    {
      pageLanguage: 'zh-TW',
      includedLanguages: 'id,th,vi,my,tl,km,bn,en,zh-TW',
      layout: google.translate.TranslateElement.InlineLayout.SIMPLE
    },
    'google_translate_element'
  );
}

// 快速回到頂端
function scrollToTop() {
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
