document.addEventListener('DOMContentLoaded', function() {
  // 初始化 Materialize 元件
  if (window.M) {
    M.FloatingActionButton.init(document.querySelectorAll('.fixed-action-btn'));
    M.Tooltip.init(document.querySelectorAll('.tooltipped'));
    M.FormSelect.init(document.querySelectorAll('select'));
  }

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

  const questionnaireForm = document.getElementById('questionnaire-form');
  if (questionnaireForm) {
    questionnaireForm.addEventListener('submit', function(event) {
      event.preventDefault();
      const status = document.getElementById('form-status');
      if (status) {
        status.textContent = '目前網站尚未連接資料服務，問卷資料不會被傳送。請將畫面交給篩檢人員處理。';
        status.hidden = false;
      }
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
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  if (mode === 'dark' || (mode === 'auto' && prefersDark)) {
    html.classList.add('dark');
  } else {
    html.classList.remove('dark');
  }
  localStorage.setItem('site-mode', mode);
  const modeToggle = document.querySelector('.mode-toggle');
  if (modeToggle) {
    modeToggle.value = mode;
  }
}

window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function() {
  if (localStorage.getItem('site-mode') === 'auto') {
    setMode('auto');
  }
});

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
function scrollToTop(event) {
  if (event) {
    event.preventDefault();
  }
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
