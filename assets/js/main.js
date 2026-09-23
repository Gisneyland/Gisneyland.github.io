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
  const modeToggle = document.getElementById('mode-toggle');
  if (modeToggle) {
    modeToggle.addEventListener('change', event => {
      setMode(event.target.value);
    });
  }

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
    questionnaireForm.addEventListener('submit', async function(event) {
      event.preventDefault();
      const status = document.getElementById('form-status');

      if (!window.questionnaireSupabase) {
        showFormStatus(status, '資料服務尚未完成設定，請聯絡網站管理員。', true);
        return;
      }

      if (!questionnaireForm.checkValidity()) {
        questionnaireForm.reportValidity();
        return;
      }

      const submitButton = questionnaireForm.querySelector('button[type="submit"]');
      submitButton.disabled = true;
      showFormStatus(status, '資料傳送中，請稍候。');

      try {
        const payload = {
          response_data: collectFormData(questionnaireForm),
          language: document.documentElement.lang || 'zh-TW',
          schema_version: 1
        };
        let error;

        if (window.SUPABASE_FUNCTION_NAME) {
          const result = await window.questionnaireSupabase.functions.invoke(
            window.SUPABASE_FUNCTION_NAME,
            { body: payload }
          );
          error = result.error;
        } else {
          const result = await window.questionnaireSupabase
            .from('questionnaire_responses')
            .insert(payload);
          error = result.error;
        }

        if (error) {
          throw error;
        }

        questionnaireForm.reset();
        showFormStatus(status, '問卷已送出，謝謝您的填答。');
      } catch (error) {
        console.error('問卷送出失敗:', error);
        showFormStatus(status, '問卷送出失敗，請確認網路連線後再試一次。', true);
      } finally {
        submitButton.disabled = false;
      }
    });
  }
});

function collectFormData(form) {
  const data = {};

  Array.from(form.elements).forEach(element => {
    if (!element.name || element.disabled) {
      return;
    }

    if (element.type === 'checkbox') {
      data[element.name] = element.checked;
    } else if (element.type === 'radio') {
      if (!(element.name in data)) {
        data[element.name] = null;
      }
      if (element.checked) {
        data[element.name] = element.value || true;
      }
    } else if (element.tagName === 'SELECT' && element.multiple) {
      data[element.name] = Array.from(element.selectedOptions).map(option => option.value);
    } else {
      data[element.name] = element.value.trim();
    }
  });

  return data;
}

function showFormStatus(status, message, isError = false) {
  if (!status) {
    return;
  }

  status.textContent = message;
  status.classList.toggle('red-text', isError);
  status.classList.toggle('green-text', !isError);
  status.hidden = false;
}

// 模式切換
function setMode(mode) {
  const html = document.documentElement;
  const validModes = ['auto', 'light', 'dark'];
  const selectedMode = validModes.includes(mode) ? mode : 'auto';
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const theme = selectedMode === 'auto'
    ? (prefersDark ? 'dark' : 'light')
    : selectedMode;

  html.dataset.theme = theme;
  html.dataset.mode = selectedMode;
  localStorage.setItem('site-mode', selectedMode);

  const modeToggle = document.getElementById('mode-toggle');
  if (modeToggle) {
    modeToggle.value = selectedMode;
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
