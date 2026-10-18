const taiwanAdminLocations = [
  '基隆市', '臺北市', '新北市', '桃園市', '新竹市', '新竹縣', '苗栗縣',
  '臺中市', '彰化縣', '南投縣', '雲林縣', '嘉義市', '嘉義縣', '臺南市',
  '高雄市', '屏東縣', '宜蘭縣', '花蓮縣', '臺東縣', '澎湖縣', '金門縣', '連江縣', '其他'
];
let selectedPageLanguage = 'zh-TW';
let googleMachineTranslationActive = false;
const screeningPhotos = new Map();
const maxScreeningPhotoBytes = 2_500_000;

document.addEventListener('DOMContentLoaded', function() {
  initializeAmbientRainbow();
  initializeQuestionnaireFields();
  const staffSessionReady = initializeStaffSessionIndicator();
  initializeSiteNavigation();

  // 初始化 Materialize 元件
  if (window.M) {
    M.Tooltip.init(document.querySelectorAll('.tooltipped'));
    const siteSelects = Array.from(document.querySelectorAll('select'))
      .filter(select => !select.closest('#questionnaire-form') && !select.classList.contains('utility-select'));
    M.FormSelect.init(siteSelects);
  }

  // 模式初始化
  const savedMode = localStorage.getItem('site-mode') || 'auto';
  setMode(savedMode);

  const themeButton = document.getElementById('theme-toggle-button');
  if (themeButton) {
    themeButton.addEventListener('click', () => {
      const currentMode = localStorage.getItem('site-mode') || 'auto';
      const effectiveTheme = document.documentElement.dataset.theme || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
      const nextMode = currentMode === 'auto' ? (effectiveTheme === 'dark' ? 'light' : 'dark') : (effectiveTheme === 'dark' ? 'light' : 'dark');
      setMode(nextMode);
    });
  }

  const languageButton = document.getElementById('language-button');
  const languageMenu = document.getElementById('language-menu');
  if (languageButton && languageMenu) {
    languageButton.addEventListener('click', () => {
      const isOpen = !languageMenu.hidden;
      languageMenu.hidden = isOpen;
      languageButton.setAttribute('aria-expanded', String(!isOpen));
    });
    document.addEventListener('click', event => {
      if (!languageMenu.contains(event.target) && !languageButton.contains(event.target)) {
        languageMenu.hidden = true;
        languageButton.setAttribute('aria-expanded', 'false');
      }
    });
  }
  document.querySelectorAll('.language-option').forEach(option => {
    option.addEventListener('click', () => {
      const value = option.dataset.language;
      const langSelect = document.getElementById('language-select');
      if (langSelect) {
        langSelect.value = value;
        langSelect.dispatchEvent(new Event('change', { bubbles: true }));
      }
      if (languageMenu) {
        languageMenu.hidden = true;
      }
      if (languageButton) {
        languageButton.setAttribute('aria-expanded', 'false');
      }
    });
  });

  // 語言初始化
  const langSelect = document.getElementById("language-select");
  const browserLanguage = (navigator.language || navigator.userLanguage || 'zh-TW').split('-')[0].toLowerCase();
  const languageAliases = {
    zh: 'zh-TW', en: 'en', id: 'id', th: 'th', vi: 'vi', my: 'my', tl: 'tl', km: 'km', bn: 'bn'
  };
  const browserDefaultLanguage = languageAliases[browserLanguage] || 'zh-TW';
  const savedLanguage = localStorage.getItem('site-language');
  const defaultLanguage = Object.hasOwn(i18n, savedLanguage)
    ? savedLanguage
    : browserDefaultLanguage;
  if (langSelect) {
    langSelect.value = defaultLanguage;
    langSelect.addEventListener('change', event => {
      setPageLanguage(event.target.value);
    });
  }
  setPageLanguage(defaultLanguage);

  const questionnaireForm = document.getElementById('questionnaire-form');
  if (questionnaireForm) {
    const screenerNumberReady = initializeScreenerNumber(questionnaireForm, staffSessionReady);
    initializeQuestionnaire(questionnaireForm);
    initializeAnonymousConsult(questionnaireForm);
    questionnaireForm.addEventListener('submit', async function(event) {
      event.preventDefault();
      const status = document.getElementById('form-status');
      await screenerNumberReady;
      if (!validateScreenerNumber(questionnaireForm)) return;
      if (!validateScreeningInterpretation(questionnaireForm)) return;

      if (!window.questionnaireSupabase) {
        showFormStatus(status, '資料服務尚未完成設定，請聯絡網站管理員。', true);
        return;
      }

      const invalidContact = referralContactState.validate();
      if (invalidContact) {
        invalidContact.focus();
        invalidContact.reportValidity();
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
        const responseData = collectFormData(questionnaireForm);
        const referralContacts = document.getElementById('hiv-positive-referral')?.disabled
          ? []
          : referralContactState.collect();
        if (referralContacts.length) responseData.hiv_positive_contacts = referralContacts;
        const payload = {
          response_data: responseData,
          language: document.documentElement.dataset.contentLanguage || 'zh-TW',
          schema_version: 1
        };
        let error;
        let body = payload;
        if (screeningPhotos.size) {
          body = new FormData();
          body.append('payload', JSON.stringify(payload));
          screeningPhotos.forEach(({ blob }, kind) => body.append(`photo_${kind}`, blob, `${kind}.jpg`));
        }

        if (window.SUPABASE_FUNCTION_NAME) {
          const result = await window.questionnaireSupabase.functions.invoke(
            window.SUPABASE_FUNCTION_NAME,
            { body }
          );
          error = result.error;
        } else {
          if (screeningPhotos.size) throw new Error('Photo upload requires the submit function');
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

/* 匿名諮詢網（hiva.cdc.gov.tw）風險評估第一頁的題目對照 */
function buildAnonymousConsultAnswers(data) {
  const yn = value => (value === 'yes' ? '是 Yes' : value === 'no' ? '否 No' : '');
  const noSex = data.frequency_sex === 'no';
  const skipped = '沒有發生 Did not happen（該題會被停用，不需選擇）';
  const dependent = value => (noSex ? skipped : yn(value));
  const partner = data.frequency_closed_relationship === 'none'
    ? '否 No（本站答「沒有固定性伴侶」）'
    : yn(data.frequency_closed_relationship);
  const drug = data.frequency_drug;
  return [
    ['最近一年是否有與他人發生過性行為（肛交、口交或陰道交）？', yn(data.frequency_sex)],
    ['最近一年每次性行為時都有全程使用保險套？', dependent(data.frequency_condom)],
    ['最近一年發生性行為時，是否都是跟固定性伴侶？', noSex ? skipped : partner],
    ['性行為的前後或過程中是否有用酒？', dependent(data.frequency_alcohol)],
    ['性行為的前後或過程中是否有用藥？', dependent(drug)]
  ];
}

function initializeAnonymousConsult(form) {
  const list = document.getElementById('anonymous-consult-answers');
  const copyButton = document.getElementById('anonymous-consult-copy');
  const copyStatus = document.getElementById('anonymous-consult-copy-status');
  if (!list) return;
  const render = () => {
    const rows = buildAnonymousConsultAnswers(collectFormData(form));
    list.replaceChildren(...rows.map(([question, answer]) => {
      const item = document.createElement('li');
      item.textContent = `${question} → ${answer || '（受檢者尚未填答）'}`;
      return item;
    }));
    return rows;
  };
  render();
  form.addEventListener('change', render);
  form.addEventListener('click', event => {
    if (event.target.closest('#handoff-screening-button')) render();
  });
  copyButton?.addEventListener('click', async () => {
    const text = render().map(([question, answer], index) => `${index + 1}. ${question} ${answer}`).join('\n');
    let message = '已複製。';
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      message = '無法自動複製，請手動選取上方文字。';
    }
    copyStatus.textContent = message;
    copyStatus.hidden = false;
  });
}

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

function collectFormData(form) {
  const data = {};

  Array.from(form.elements).forEach(element => {
    if (!element.name || element.matches(':disabled')) {
      return;
    }

    if (element.type === 'checkbox') {
      if (element.name.endsWith('[]')) {
        const name = element.name.slice(0, -2);
        data[name] ??= [];
        if (element.checked) data[name].push(element.value);
      } else {
        data[element.name] = element.checked;
      }
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

function initializeQuestionnaireFields() {
  const birthYear = document.getElementById('birth');
  if (birthYear) {
    const currentYear = new Date().getFullYear();
    for (let year = currentYear; year >= 1900; year -= 1) {
      birthYear.add(new Option(String(year), String(year)));
    }
  }

  initializeLocationPickers(taiwanAdminLocations);

  initializeNationalityPicker();
  initializeScreeningDate();
  initializeScreeningPlace();
  applyPreferredScreeningPlace(staffSessionReady);
  const resetReferralAddressPicker = initializeScreeningPlace('hiv_positive_address', 'hiv-positive-address', 'hiv-positive-address-locate-button');
  const resetReferralContacts = initializeReferralContacts();
  initializeScreeningInterpretation(resetReferralAddressPicker, resetReferralContacts);
  initializeScreeningPhotos();
}

function initializeScreeningDate() {
  const input = document.getElementById('screening_at');
  if (!input || input.value) return;
  const now = new Date();
  input.value = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

const referralContactState = { collect: () => [], validate: () => null };
const maxReferralContacts = 8;

const normalizeInternationalPhone = value => {
  const compact = value.replace(/[\s().-]/g, '');
  return /^09\d{8}$/.test(compact) ? `+886${compact.slice(1)}` : compact;
};

const referralContactRules = {
  mobile: {
    type: 'tel', autocomplete: 'tel', placeholder: '0912345678', maxLength: 20,
    hint: '請輸入 09 開頭的 10 碼手機號碼。',
    error: '手機號碼需為 09 開頭的 10 碼數字。',
    normalize: value => value.replace(/[\s().-]/g, '').replace(/^\+8860?/, '0'),
    test: value => /^09\d{8}$/.test(value)
  },
  landline: {
    type: 'tel', autocomplete: 'tel', placeholder: '035237969', maxLength: 24,
    hint: '請含區碼，例如 035237969；有分機請加 #123。',
    error: '市話需含區碼（共 9–10 碼），分機請以 # 加數字。',
    normalize: value => value.replace(/[\s().-]/g, '').replace(/^\+886/, '0').replace(/分機|ext\.?/i, '#'),
    test: value => /^0[2-8]\d{7,8}(#\d{1,6})?$/.test(value)
  },
  email: {
    type: 'email', autocomplete: 'email', placeholder: 'name@example.com', maxLength: 254,
    hint: '請輸入完整的電子郵件地址。',
    error: '請輸入正確的電子郵件格式，例如 name@example.com。',
    normalize: value => value.replace(/\s/g, ''),
    test: value => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value)
  },
  line: {
    type: 'text', autocomplete: 'off', placeholder: 'LINE ID', maxLength: 30,
    hint: '請輸入 LINE ID（4–20 碼英數字、點、底線或連字號）。',
    error: 'LINE ID 需為 4–20 碼英數字、點、底線或連字號。',
    normalize: value => value.replace(/\s/g, ''),
    test: value => /^@?[A-Za-z0-9._-]{4,20}$/.test(value)
  },
  facebook: {
    type: 'text', autocomplete: 'off', placeholder: 'facebook.com/帳號', maxLength: 200,
    hint: '請輸入 Facebook 個人檔案網址，或 5 碼以上的英數字帳號。',
    error: '請輸入 facebook.com 或 fb.com 網址，或英數字帳號（5–50 碼）。',
    normalize: value => value.replace(/\s/g, ''),
    test: value => /^(https?:\/\/)?((www|m|web)\.)?(facebook|fb)\.com\/\S+$/i.test(value) || /^[A-Za-z0-9.]{5,50}$/.test(value)
  },
  instagram: {
    type: 'text', autocomplete: 'off', placeholder: '@帳號', maxLength: 120,
    hint: '請輸入 Instagram 帳號或個人檔案網址。',
    error: 'Instagram 帳號需為 1–30 碼英數字、點或底線，或 instagram.com 網址。',
    normalize: value => value.replace(/\s/g, '').replace(/^@/, ''),
    test: value => /^[A-Za-z0-9._]{1,30}$/.test(value)
      || /^(https?:\/\/)?(www\.)?instagram\.com\/[A-Za-z0-9._]{1,30}\/?(\?.*)?$/i.test(value)
  },
  threads: {
    type: 'text', autocomplete: 'off', placeholder: '@帳號', maxLength: 120,
    hint: '請輸入 Threads 帳號或個人檔案網址。',
    error: 'Threads 帳號需為 1–30 碼英數字、點或底線，或 threads.net 網址。',
    normalize: value => value.replace(/\s/g, '').replace(/^@/, ''),
    test: value => /^[A-Za-z0-9._]{1,30}$/.test(value)
      || /^(https?:\/\/)?(www\.)?threads\.(net|com)\/@?[A-Za-z0-9._]{1,30}\/?(\?.*)?$/i.test(value)
  },
  whatsapp: {
    type: 'tel', autocomplete: 'tel', placeholder: '+886912345678', maxLength: 20,
    hint: '請包含國碼，例如 +886912345678；09 開頭的台灣手機會自動轉換。',
    error: '請輸入含國碼的手機號碼，例如 +886912345678。',
    normalize: normalizeInternationalPhone,
    test: value => /^\+[1-9]\d{7,14}$/.test(value)
  },
  telegram: {
    type: 'text', autocomplete: 'off', placeholder: '@帳號', maxLength: 120,
    hint: '請輸入 Telegram 帳號（5–32 碼）、t.me 網址，或含國碼的手機號碼。',
    error: 'Telegram 帳號需以英文字母開頭（5–32 碼），或輸入 t.me 網址、含國碼的手機號碼。',
    normalize: value => {
      const compact = value.replace(/\s/g, '');
      return /^\+?[\d().-]{8,}$/.test(compact) ? normalizeInternationalPhone(compact) : compact;
    },
    test: value => /^@?[A-Za-z][A-Za-z0-9_]{4,31}$/.test(value)
      || /^(https?:\/\/)?(t|telegram)\.me\/[A-Za-z][A-Za-z0-9_]{4,31}\/?$/i.test(value)
      || /^\+[1-9]\d{7,14}$/.test(value)
  },
  address: {
    maxLength: 240,
    hint: '請輸入完整通訊地址，可從建議清單選擇並在地圖確認。',
    error: '請輸入完整地址（至少 6 個字）。',
    normalize: value => value,
    test: value => value.length >= 6
  }
};

function translateContactRow(row) {
  const translations = i18n[selectedPageLanguage] || i18n['zh-TW'];
  row.querySelectorAll('[data-i18n]').forEach(element => {
    const translation = translations[element.dataset.i18n];
    if (!translation) return;
    element.classList.add('notranslate');
    element.textContent = translation;
    element.lang = selectedPageLanguage;
  });
  row.querySelectorAll('[data-i18n-aria-label]').forEach(element => {
    const translation = translations[element.dataset.i18nAriaLabel];
    if (translation) element.setAttribute('aria-label', translation);
  });
  row.querySelectorAll('[data-i18n-title]').forEach(element => {
    const translation = translations[element.dataset.i18nTitle];
    if (translation) element.title = translation;
  });
}

function initializeReferralContacts() {
  const list = document.getElementById('hiv-contact-list');
  const addButton = document.getElementById('hiv-contact-add');
  const template = document.getElementById('hiv-contact-template');
  if (!list || !addButton || !template) return () => {};

  const appointment = document.getElementById('hiv_positive_appointment');
  if (appointment) {
    const now = new Date();
    appointment.min = `${new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10)}T00:00`;
  }

  let rowCounter = 0;
  const pickers = new Map();
  const rows = () => Array.from(list.children);
  const typeOf = row => row.querySelector('[data-contact-type]').value;
  const ruleKeyOf = row => (typeOf(row) === 'phone' ? row.querySelector('[data-contact-phone-kind]').value : typeOf(row));
  const inputOf = row => row.querySelector(typeOf(row) === 'address' ? '[data-contact-address-input]' : '[data-contact-value]');
  const rawValueOf = row => inputOf(row).value.normalize('NFKC').trim();

  const setHint = (row, message, isError = false) => {
    const hint = row.querySelector('[data-contact-hint]');
    hint.textContent = message;
    hint.classList.toggle('is-error', isError);
    hint.setAttribute('role', isError ? 'alert' : 'note');
  };

  const applyRule = row => {
    const rule = referralContactRules[ruleKeyOf(row)];
    const isAddress = typeOf(row) === 'address';
    row.querySelector('[data-contact-phone-kind]').hidden = typeOf(row) !== 'phone';
    row.querySelector('[data-contact-plain]').hidden = isAddress;
    row.querySelector('[data-contact-address]').hidden = !isAddress;
    if (!isAddress) {
      const input = row.querySelector('[data-contact-value]');
      input.type = rule.type;
      input.maxLength = rule.maxLength;
      input.placeholder = rule.placeholder;
      input.autocomplete = rule.autocomplete;
      input.inputMode = rule.type === 'tel' ? 'tel' : rule.type === 'email' ? 'email' : 'text';
      input.setCustomValidity('');
    } else {
      row.querySelector('[data-contact-address-input]').setCustomValidity('');
    }
    setHint(row, rule.hint);
  };

  const validateRow = row => {
    const input = inputOf(row);
    const rule = referralContactRules[ruleKeyOf(row)];
    const raw = rawValueOf(row);
    input.setCustomValidity('');
    setHint(row, rule.hint);
    if (!raw) return null;
    const value = rule.normalize(raw);
    if (!rule.test(value)) {
      input.setCustomValidity(rule.error);
      setHint(row, rule.error, true);
      return input;
    }
    input.value = value;
    return null;
  };

  const destroyPicker = row => {
    pickers.get(row)?.destroy();
    pickers.delete(row);
  };

  const updateControls = () => {
    const single = list.children.length <= 1;
    list.querySelectorAll('[data-contact-remove]').forEach(button => { button.hidden = single; });
    addButton.disabled = list.children.length >= maxReferralContacts;
  };

  const addRow = (translate = true) => {
    if (list.children.length >= maxReferralContacts) return;
    const row = template.content.firstElementChild.cloneNode(true);
    const prefix = `hiv-contact-${++rowCounter}`;
    const assign = (selector, id) => { row.querySelector(selector).id = id; };
    assign('[data-contact-address-input]', `${prefix}-input`);
    assign('[data-contact-locate]', `${prefix}-locate`);
    assign('[data-contact-suggestions]', `${prefix}-suggestions`);
    assign('[data-contact-status]', `${prefix}-status`);
    assign('[data-contact-map]', `${prefix}-map`);
    assign('[data-contact-map-canvas]', `${prefix}-map-canvas`);
    assign('[data-contact-info-button]', `${prefix}-info-button`);
    assign('[data-contact-info-popover]', `${prefix}-info-popover`);
    const addressInput = row.querySelector('[data-contact-address-input]');
    addressInput.setAttribute('aria-controls', `${prefix}-suggestions`);
    row.querySelector('[data-contact-info-button]').setAttribute('aria-controls', `${prefix}-info-popover`);
    list.append(row);

    const plainInput = row.querySelector('[data-contact-value]');
    const clearFeedback = () => {
      inputOf(row).setCustomValidity('');
      setHint(row, referralContactRules[ruleKeyOf(row)].hint);
    };

    row.querySelector('[data-contact-type]').addEventListener('change', () => {
      plainInput.value = '';
      addressInput.value = '';
      if (typeOf(row) === 'address') {
        if (!pickers.has(row)) {
          const reset = initializeScreeningPlace(addressInput.id, prefix, `${prefix}-locate`);
          if (reset) pickers.set(row, reset);
        }
      } else {
        destroyPicker(row);
      }
      applyRule(row);
    });
    row.querySelector('[data-contact-phone-kind]').addEventListener('change', () => {
      applyRule(row);
      if (rawValueOf(row)) validateRow(row);
    });
    [plainInput, addressInput].forEach(input => {
      input.addEventListener('input', clearFeedback);
      input.addEventListener('change', () => validateRow(row));
    });
    row.querySelector('[data-contact-remove]').addEventListener('click', () => {
      destroyPicker(row);
      row.remove();
      updateControls();
    });

    applyRule(row);
    updateControls();
    if (translate) translateContactRow(row);
  };

  addButton.addEventListener('click', () => {
    addRow();
    list.lastElementChild?.querySelector('[data-contact-type]').focus();
  });

  const reset = () => {
    rows().forEach(destroyPicker);
    list.replaceChildren();
    addRow();
  };

  referralContactState.validate = () => {
    let firstInvalid = null;
    rows().forEach(row => {
      const invalid = validateRow(row);
      if (invalid && !firstInvalid) firstInvalid = invalid;
    });
    return firstInvalid;
  };
  referralContactState.collect = () => rows().flatMap(row => {
    const raw = rawValueOf(row);
    if (!raw) return [];
    const type = typeOf(row);
    const entry = { type, value: referralContactRules[ruleKeyOf(row)].normalize(raw) };
    if (type === 'phone') entry.phone_kind = row.querySelector('[data-contact-phone-kind]').value;
    return [entry];
  });

  addRow(false);
  return reset;
}

function initializeScreeningInterpretation(resetReferralAddressPicker, resetReferralContacts) {
  const inputs = Array.from(document.querySelectorAll('input[name="screening_interpretation[]"]'));
  const message = document.getElementById('screening-interpretation-message');
  const hivInputs = inputs.filter(input => input.value.startsWith('hiv_'));
  const hivPositiveInput = inputs.find(input => input.value === 'hiv_positive');
  const windowPeriodField = document.getElementById('hiv-window-period-field');
  const windowPeriodSelect = document.querySelector('select[name="hiv_window_period"]');
  const referralField = document.getElementById('hiv-positive-referral');
  const referralInputs = referralField
    ? Array.from(referralField.querySelectorAll('input, textarea, select'))
      .filter(input => !input.closest('.hiv-contact-methods'))
    : [];
  const updateHivWindowPeriod = () => {
    const showWindowPeriod = hivInputs.some(input => input.checked);
    if (windowPeriodField) windowPeriodField.hidden = !showWindowPeriod;
    if (windowPeriodSelect) {
      windowPeriodSelect.required = showWindowPeriod;
      if (!showWindowPeriod) windowPeriodSelect.value = '3_months';
    }
  };
  const updatePositiveReferral = () => {
    const showReferral = hivPositiveInput?.checked === true;
    if (referralField) {
      referralField.hidden = !showReferral;
      referralField.disabled = !showReferral;
    }
    if (!showReferral) {
      referralInputs.forEach(input => {
        input.value = '';
      });
      resetReferralAddressPicker?.();
      resetReferralContacts?.();
    }
  };

  inputs.forEach(input => {
    const updateSelection = () => input.closest('label')?.classList.toggle('is-selected', input.checked);
    input.addEventListener('change', () => {
      if (input.checked) {
        input.closest('[data-interpretation-pair]')?.querySelectorAll('input[type="checkbox"]').forEach(other => {
          if (other !== input) {
            other.checked = false;
            other.closest('label')?.classList.remove('is-selected');
          }
        });
      }
      updateSelection();
      updateHivWindowPeriod();
      updatePositiveReferral();
      if (inputs.some(option => option.checked) && message) {
        message.hidden = true;
        message.textContent = '';
      }
    });
    updateSelection();
  });
  updateHivWindowPeriod();
  updatePositiveReferral();

  const form = document.getElementById('questionnaire-form');
  form?.addEventListener('reset', () => {
    window.setTimeout(() => {
      inputs.forEach(input => input.closest('label')?.classList.toggle('is-selected', input.checked));
      updateHivWindowPeriod();
      updatePositiveReferral();
    }, 0);
  });
}

function initializeScreeningPhotos() {
  const form = document.getElementById('questionnaire-form');
  const fields = Array.from(document.querySelectorAll('.screening-photo-field'));
  if (!form || !fields.length) return;

  const setStatus = (field, message) => {
    const status = field.querySelector('[data-photo-status]');
    status.textContent = message;
    status.hidden = !message;
  };
  const clearPhoto = field => {
    const kind = field.dataset.photoKind;
    const entry = screeningPhotos.get(kind);
    if (entry) URL.revokeObjectURL(entry.url);
    screeningPhotos.delete(kind);
    field.querySelector('[data-photo-input]').value = '';
    field.querySelector('[data-photo-preview]').hidden = true;
    field.querySelector('[data-photo-image]').removeAttribute('src');
    setStatus(field, '');
  };
  const syncVisibility = () => {
    fields.forEach(field => {
      const trigger = form.querySelector(`input[name="screening_interpretation[]"][value="${field.dataset.photoRequires}"]`);
      const isVisible = trigger?.checked === true;
      field.hidden = !isVisible;
      if (!isVisible) clearPhoto(field);
    });
  };

  fields.forEach(field => {
    const input = field.querySelector('[data-photo-input]');
    field.querySelector('[data-photo-pick]').addEventListener('click', () => input.click());
    field.querySelector('[data-photo-clear]').addEventListener('click', () => clearPhoto(field));
    input.addEventListener('change', async () => {
      const file = input.files?.[0];
      if (!file) return;
      setStatus(field, '正在處理照片…');
      try {
        const blob = await compressScreeningPhoto(file);
        const kind = field.dataset.photoKind;
        const previous = screeningPhotos.get(kind);
        if (previous) URL.revokeObjectURL(previous.url);
        const url = URL.createObjectURL(blob);
        screeningPhotos.set(kind, { blob, url });
        field.querySelector('[data-photo-image]').src = url;
        field.querySelector('[data-photo-preview]').hidden = false;
        setStatus(field, '');
      } catch (error) {
        clearPhoto(field);
        setStatus(field, error.message || '無法處理這張照片，請改選另一張。');
      } finally {
        input.value = '';
      }
    });
  });

  form.addEventListener('change', event => {
    if (event.target.matches('input[name="screening_interpretation[]"]')) {
      window.setTimeout(syncVisibility, 0);
    }
  });
  form.addEventListener('reset', () => {
    window.setTimeout(() => {
      fields.forEach(clearPhoto);
      syncVisibility();
    }, 0);
  });
  syncVisibility();
}

// 重新編碼為 JPEG 會一併移除 EXIF（含定位）資訊。
async function compressScreeningPhoto(file) {
  if (!file.type.startsWith('image/')) throw new Error('請選擇圖片檔案。');
  if (file.size > 25_000_000) throw new Error('照片檔案過大，請改選另一張。');

  let bitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error('此照片格式無法處理，請改用拍照或 JPEG／PNG 圖片。');
  }

  const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const context = canvas.getContext('2d');
  context.fillStyle = '#fff';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close?.();

  for (const quality of [0.82, 0.7, 0.55]) {
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', quality));
    if (blob && blob.size <= maxScreeningPhotoBytes) return blob;
  }
  throw new Error('照片檔案過大，請改選另一張。');
}

function validateScreeningInterpretation(form) {
  const inputs = Array.from(form.querySelectorAll('input[name="screening_interpretation[]"]'));
  const message = document.getElementById('screening-interpretation-message');
  const hasSelection = inputs.some(input => input.checked);
  if (message) {
    message.hidden = hasSelection;
    message.textContent = hasSelection ? '' : '請至少選擇一項篩檢判讀。';
  }
  if (!hasSelection) inputs[0]?.focus();
  return hasSelection;
}

async function initializeStaffSessionIndicator() {
  const indicator = document.querySelector('.staff-session-tool');
  const indicatorButton = document.getElementById('staff-session-button');
  const label = document.getElementById('staff-session-status');
  const menu = document.getElementById('staff-session-menu');
  const signoutButton = document.getElementById('staff-signout-button');
  const adminLink = document.getElementById('staff-admin-link');
  const loginForm = document.getElementById('staff-login-form');
  const loginEmail = document.getElementById('staff-login-email');
  const loginPassword = document.getElementById('staff-login-password');
  const loginPasswordField = document.getElementById('staff-login-password-field');
  const loginOtpField = document.getElementById('staff-login-otp-field');
  const loginOtpInput = document.getElementById('staff-login-otp');
  const loginOtpResendButton = document.getElementById('staff-login-otp-resend');
  const loginModeButtons = [...document.querySelectorAll('[data-staff-login-mode]')];
  const loginButton = document.getElementById('staff-login-submit');
  const loginFeedback = document.getElementById('staff-login-feedback');
  if (!indicator || !indicatorButton || !label || !menu) return { state: 'unknown' };
  let loginMode = 'password';
  let otpSentFor = '';

  const translate = (key, fallback) => i18n[selectedPageLanguage]?.[key] || fallback;
  const updateLoginMode = () => {
    const usingOtp = loginMode === 'otp';
    const otpReady = usingOtp && otpSentFor !== '' && otpSentFor === loginEmail.value.trim();
    loginPasswordField.hidden = usingOtp;
    loginPassword.required = !usingOtp;
    loginOtpField.hidden = !otpReady;
    loginOtpInput.required = otpReady;
    loginOtpResendButton.hidden = !otpReady;
    loginModeButtons.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.staffLoginMode === loginMode)));
    const labelNode = [...loginButton.childNodes].find(node => node.nodeType === Node.TEXT_NODE);
    if (labelNode) labelNode.textContent = ` ${!usingOtp ? translate('staff_login', '登入') : otpReady ? translate('staff_verify_otp', '驗證並登入') : translate('staff_send_otp', '寄送驗證碼')}`;
  };

  loginModeButtons.forEach(button => button.addEventListener('click', () => {
    loginMode = button.dataset.staffLoginMode;
    loginFeedback.hidden = true;
    updateLoginMode();
  }));
  loginEmail.addEventListener('input', () => {
    if (otpSentFor && otpSentFor !== loginEmail.value.trim()) {
      otpSentFor = '';
      loginOtpInput.value = '';
      updateLoginMode();
    }
  });

  const sendStaffOtp = async () => {
    if (!loginEmail.reportValidity()) return false;
    const email = loginEmail.value.trim();
    const { error } = await window.StaffAccess.requestEmailOtp(
      window.questionnaireSupabase,
      email,
      `${window.location.origin}${window.location.pathname}`
    );
    if (error) {
      loginFeedback.textContent = window.StaffAccess.otpErrorMessage(error);
      loginFeedback.hidden = false;
      return false;
    }
    otpSentFor = email;
    loginFeedback.textContent = translate('staff_otp_sent', '驗證碼已寄出，請查看信箱。');
    loginFeedback.hidden = false;
    updateLoginMode();
    return true;
  };

  const setState = (state, key, fallback, hasSession = false) => {
    indicator.dataset.state = state;
    label.textContent = i18n[selectedPageLanguage]?.[key] || fallback;
    if (loginForm) loginForm.hidden = state !== 'signed-out';
    if (adminLink) adminLink.hidden = !['signed-in', 'unbound'].includes(state);
    if (signoutButton) signoutButton.hidden = !hasSession;
  };

  if (!indicator.dataset.ready) {
    indicatorButton.addEventListener('click', () => {
      const isOpen = !menu.hidden;
      menu.hidden = isOpen;
      indicatorButton.setAttribute('aria-expanded', String(!isOpen));
    });
    document.addEventListener('click', event => {
      if (!indicator.contains(event.target)) {
        menu.hidden = true;
        indicatorButton.setAttribute('aria-expanded', 'false');
      }
    });
    indicatorButton.addEventListener('keydown', event => {
      if (event.key === 'Escape') {
        menu.hidden = true;
        indicatorButton.setAttribute('aria-expanded', 'false');
        indicatorButton.focus();
      }
    });
    indicator.dataset.ready = 'true';
  }

  if (signoutButton && window.questionnaireSupabase) {
    signoutButton.addEventListener('click', async () => {
      try {
        await window.questionnaireSupabase.auth.signOut();
        if (menu) menu.hidden = true;
        window.location.reload();
      } catch (error) {
        console.error('登出失敗', error);
      }
    });
  }

  if (loginForm && window.questionnaireSupabase) {
    loginForm.addEventListener('submit', async event => {
      event.preventDefault();
      if (!loginForm.reportValidity()) return;

      loginFeedback.hidden = true;
      loginButton.disabled = true;
      try {
        const email = loginEmail.value.trim();
        let error;
        if (loginMode === 'otp' && (!otpSentFor || otpSentFor !== email)) {
          await sendStaffOtp();
          return;
        }
        if (loginMode === 'otp') {
          ({ error } = await window.StaffAccess.verifyEmailOtp(window.questionnaireSupabase, email, loginOtpInput.value));
        } else {
          ({ error } = await window.questionnaireSupabase.auth.signInWithPassword({
            email,
            password: loginPassword.value
          }));
        }
        if (error) {
          loginFeedback.textContent = loginMode === 'otp'
            ? window.StaffAccess.otpErrorMessage(error, true)
            : '登入失敗，請確認帳號與密碼。';
          loginFeedback.hidden = false;
          return;
        }
        loginPassword.value = '';
        loginOtpInput.value = '';
        window.location.reload();
      } catch {
        loginFeedback.textContent = '目前無法連線登入服務，請稍後再試。';
        loginFeedback.hidden = false;
      } finally {
        loginButton.disabled = false;
        updateLoginMode();
      }
    });
    loginOtpResendButton.addEventListener('click', async () => {
      loginOtpResendButton.disabled = true;
      try {
        await sendStaffOtp();
      } catch {
        loginFeedback.textContent = '目前無法寄送驗證碼，請稍後重試。';
        loginFeedback.hidden = false;
      } finally {
        loginOtpResendButton.disabled = false;
      }
    });
    updateLoginMode();
  }

  if (!window.questionnaireSupabase) {
    setState('error', 'staff_status_error', '無法確認登入狀態');
    return { state: 'error' };
  }

  setState('checking', 'staff_status_checking', '確認工作人員登入狀態');
  let sessionData;
  let sessionError;
  try {
    ({ data: sessionData, error: sessionError } = await window.questionnaireSupabase.auth.getSession());
  } catch (error) {
    sessionError = error;
  }

  if (sessionError) {
    setState('error', 'staff_status_error', '無法確認登入狀態');
    return { state: 'error' };
  }
  if (!sessionData.session) {
    setState('signed-out', 'staff_status_signed_out', '工作人員未登入');
    return { state: 'signed-out' };
  }

  try {
    const { data: profile, error } = await window.questionnaireSupabase
      .from('admin_profiles')
      .select('screener_number, approval_status, privacy_consent_at')
      .eq('user_id', sessionData.session.user.id)
      .maybeSingle();

    if (error) {
      setState('error', 'staff_status_error', '無法確認工作人員權限', true);
      return { state: 'error', session: sessionData.session };
    }
    if (!profile || profile.approval_status !== 'approved' || !profile.privacy_consent_at) {
      setState('not-staff', 'staff_status_not_authorized', '目前帳號不是授權工作人員', true);
      return { state: 'not-staff', session: sessionData.session };
    }

    const screenerNumber = String(profile.screener_number || '').trim();
    if (!screenerNumber) {
      setState('unbound', 'staff_status_unbound', '工作人員已登入，編號尚未綁定', true);
      return { state: 'unbound', session: sessionData.session };
    }

    setState('signed-in', 'staff_status_signed_in', '工作人員已登入', true);
    return {
      state: 'staff',
      session: sessionData.session,
      screenerNumber,
      screeningPreferences: sessionData.session.user.user_metadata?.screening_preferences || null
    };
  } catch {
    setState('error', 'staff_status_error', '無法確認工作人員權限', true);
    return { state: 'error', session: sessionData.session };
  }
}

async function initializeScreenerNumber(form, staffSessionReady) {
  const input = form.querySelector('#screener');
  const status = document.getElementById('screener-status');
  if (!input || !window.questionnaireSupabase) return;

  form.addEventListener('reset', () => {
    window.setTimeout(() => {
      if (input.dataset.bindingReady === 'true') {
        input.value = input.dataset.boundScreenerNumber || '';
      }
    }, 0);
  });

  const staffState = await staffSessionReady;
  if (staffState.state === 'signed-out') return;
  input.dataset.accountBindingRequired = 'true';
  input.dataset.bindingReady = 'false';
  input.readOnly = true;
  input.value = '';

  if (staffState.state !== 'staff') {
    const messages = {
      unbound: '此帳號尚未綁定篩檢員編號。請先至管理後台完成綁定。',
      'not-staff': '目前登入帳號未列入工作人員名單，無法完成篩檢。',
      error: '無法確認工作人員登入狀態，請重新整理或聯絡管理員。'
    };
    setScreenerNumberStatus(status, messages[staffState.state] || messages.error, true);
    return;
  }

  input.value = staffState.screenerNumber;
  input.dataset.bindingReady = 'true';
  input.dataset.boundScreenerNumber = staffState.screenerNumber;
  setScreenerNumberStatus(status, `已自動帶入篩檢員編號：${staffState.screenerNumber}`);
}

function validateScreenerNumber(form) {
  const input = form.querySelector('#screener');
  const status = document.getElementById('screener-status');
  const hasNumber = Boolean(input?.value.trim());
  const accountBindingReady = input?.dataset.accountBindingRequired !== 'true'
    || input.dataset.bindingReady === 'true';

  if (hasNumber && accountBindingReady) return true;

  const message = !hasNumber
    ? '篩檢員編號為必填，請先完成綁定或填寫編號。'
    : '此登入帳號尚未綁定篩檢員編號，請先至管理後台完成設定。';
  setScreenerNumberStatus(status, message, true);
  input?.focus();
  return false;
}

function setScreenerNumberStatus(status, message, isError = false) {
  if (!status) return;
  status.textContent = message;
  status.setAttribute('role', isError ? 'alert' : 'status');
  status.setAttribute('aria-live', isError ? 'assertive' : 'polite');
  status.hidden = !message;
}

function applyPreferredScreeningPlace(staffSessionReady) {
  const input = document.getElementById('screening_place');
  const status = document.getElementById('screening-place-status');
  if (!input) return;
  staffSessionReady.then(staffState => {
    const preferences = staffState.screeningPreferences;
    if (staffState.state !== 'staff' || !preferences?.place?.label
      || !Array.isArray(preferences.weekdays) || !preferences.weekdays.length
      || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(preferences.startTime || '')
      || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(preferences.endTime || '')
      || preferences.weekdays.some(day => !Number.isInteger(day) || day < 0 || day > 6)
      || input.value.trim()) return;

    const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Taipei', weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
    }).formatToParts(new Date()).filter(part => part.type !== 'literal').map(part => [part.type, part.value]));
    const weekdayNumbers = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
    const currentMinutes = Number(parts.hour) * 60 + Number(parts.minute);
    const startMinutes = Number(preferences.startTime.slice(0, 2)) * 60 + Number(preferences.startTime.slice(3, 5));
    const endMinutes = Number(preferences.endTime.slice(0, 2)) * 60 + Number(preferences.endTime.slice(3, 5));
    if (startMinutes >= endMinutes) return;
    if (!preferences.weekdays.includes(weekdayNumbers[parts.weekday])
      || currentMinutes < startMinutes || currentMinutes >= endMinutes) return;

    input.value = preferences.place.label;
    if (status) {
      status.textContent = '已依目前時段帶入常用地點；你仍可修改。';
      status.hidden = false;
    }
  }).catch(() => {});
}

function initializeScreeningPlace(inputId = 'screening_place', idPrefix = 'screening-place', locateButtonId = 'screening-locate-button') {
  const input = document.getElementById(inputId);
  const locateButton = document.getElementById(locateButtonId);
  const suggestions = document.getElementById(`${idPrefix}-suggestions`);
  const status = document.getElementById(`${idPrefix}-status`);
  const map = document.getElementById(`${idPrefix}-map`);
  const mapCanvas = document.getElementById(`${idPrefix}-map-canvas`);
  const infoButton = document.getElementById(`${idPrefix}-info-button`);
  const infoPopover = document.getElementById(`${idPrefix}-info-popover`);
  if (!input || !locateButton || !suggestions || !status || !map || !mapCanvas || !infoButton || !infoPopover) return;
  let localPlaces = [];
  try {
    localPlaces = JSON.parse(document.getElementById('screening-place-local-data')?.textContent || '[]');
  } catch {
    localPlaces = [];
  }

  let currentPosition = null;
  let debounceTimer = null;
  let nominatimTimer = null;
  let photonRequest = null;
  let nominatimRequest = null;
  let searchRevision = 0;
  let lastLocatedLabel = '';
  let leafletMap = null;
  let placeMarker = null;
  const infoContainer = infoButton.parentElement;
  let infoPointerType = 'mouse';

  const showLocationError = message => {
    status.textContent = message;
    status.hidden = false;
  };

  const clearLocationError = () => {
    status.textContent = '';
    status.hidden = true;
  };

  const setInfoOpen = isOpen => {
    infoPopover.hidden = !isOpen;
    infoButton.setAttribute('aria-expanded', String(isOpen));
  };

  const featureLabel = feature => {
    const properties = feature?.properties || {};
    const parts = [properties.name, properties.housenumber, properties.street, properties.district, properties.city, properties.county, properties.state]
      .map(value => String(value || '').trim())
      .filter((value, index, values) => value && values.indexOf(value) === index);
    return parts.join('、');
  };

  const reverseGeocode = async coordinates => {
    const [longitude, latitude] = coordinates || [];
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return '';
    try {
      const params = new URLSearchParams({ lat: String(latitude), lon: String(longitude) });
      const response = await fetch(`https://photon.komoot.io/reverse?${params}`);
      if (response.ok) {
        const result = await response.json();
        const label = featureLabel(result.features?.[0]);
        if (label) return label;
      }
    } catch {
    }
    try {
      const params = new URLSearchParams({
        lat: String(latitude),
        lon: String(longitude),
        format: 'jsonv2',
        addressdetails: '1',
        'accept-language': 'zh-TW'
      });
      const response = await fetch(`https://nominatim.openstreetmap.org/reverse?${params}`);
      if (!response.ok) return '';
      return nominatimLabel(await response.json());
    } catch {
      return '';
    }
  };

  const showMap = coordinates => {
    const [longitude, latitude] = coordinates || [];
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return;
    map.hidden = false;
    if (!window.L) return;
    if (!leafletMap) {
      leafletMap = window.L.map(mapCanvas, { scrollWheelZoom: false }).setView([latitude, longitude], 16);
      window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      }).addTo(leafletMap);
      placeMarker = window.L.marker([latitude, longitude], { draggable: true }).addTo(leafletMap);
      const updateFromMap = async position => {
        currentPosition = [position.lng, position.lat];
        const label = await reverseGeocode(currentPosition);
        if (label) {
          input.value = label;
          lastLocatedLabel = label;
        }
      };
      placeMarker.on('dragend', () => updateFromMap(placeMarker.getLatLng()));
      leafletMap.on('click', event => {
        placeMarker.setLatLng(event.latlng);
        updateFromMap(event.latlng);
      });
    } else {
      leafletMap.setView([latitude, longitude], 16);
      placeMarker.setLatLng([latitude, longitude]);
    }
    window.requestAnimationFrame(() => leafletMap.invalidateSize());
  };

  const closeSuggestions = () => {
    suggestions.hidden = true;
    input.setAttribute('aria-expanded', 'false');
  };

  const renderSuggestions = places => {
    suggestions.replaceChildren();
    places.forEach(place => {
      const option = document.createElement('button');
      option.type = 'button';
      option.className = 'screening-place-option';
      option.setAttribute('role', 'option');
      const label = document.createElement('span');
      label.className = 'screening-place-option-name';
      label.textContent = place.label;
      const source = document.createElement('small');
      source.className = 'screening-place-option-source';
      source.textContent = place.sources.join(' + ');
      option.append(label, source);
      option.addEventListener('pointerdown', event => event.preventDefault());
      option.addEventListener('click', () => {
        input.value = place.label;
        lastLocatedLabel = '';
        currentPosition = place.coordinates;
        if (currentPosition) showMap(currentPosition);
        clearLocationError();
        closeSuggestions();
      });
      suggestions.append(option);
    });
    suggestions.hidden = suggestions.childElementCount === 0;
    input.setAttribute('aria-expanded', String(!suggestions.hidden));
  };

  const photonPlacesFrom = features => features.map(feature => ({
    label: featureLabel(feature),
    coordinates: feature.geometry?.coordinates,
    sources: ['Photon']
  })).filter(place => place.label && place.coordinates?.length === 2);

  const nominatimLabel = item => {
    const address = item.address || {};
    const street = [address.road, address.house_number].filter(Boolean).join(' ');
    const parts = [item.name, street, address.neighbourhood, address.suburb,
      address.city || address.town || address.village || address.municipality,
      address.county, address.state]
      .map(value => String(value || '').trim())
      .filter((value, index, values) => value && values.indexOf(value) === index);
    return parts.join('、') || item.display_name || '';
  };

  const nominatimPlacesFrom = items => items.map(item => ({
    label: nominatimLabel(item),
    coordinates: [Number(item.lon), Number(item.lat)],
    sources: ['Nominatim']
  })).filter(place => place.label && place.coordinates.every(Number.isFinite));

  const localPlacesFor = query => {
    const normalizedQuery = query.toLocaleLowerCase().replace(/[\s、,，.-]/g, '');
    if (normalizedQuery.length < 2) return [];
    return localPlaces.filter(place => [place.name, place.label, ...(place.aliases || [])].some(alias =>
      String(alias || '').toLocaleLowerCase().replace(/[\s、,，.-]/g, '').includes(normalizedQuery)
    )).map(place => ({
      label: place.label || place.name,
      coordinates: place.coordinates.map(Number),
      sources: place.sources || ['在地地標']
    }));
  };

  const mergePlaces = (photonPlaces, nominatimPlaces, localCandidates = []) => {
    const merged = photonPlaces.map(place => ({ ...place, sources: [...place.sources] }));
    [...nominatimPlaces, ...localCandidates].forEach(place => {
      const key = place.label.toLocaleLowerCase().replace(/[\s、,，.-]/g, '');
      const nameKey = place.label.split('、')[0].toLocaleLowerCase().replace(/[\s,，.-]/g, '');
      const matchingPlace = merged.find(candidate => {
        const distance = Math.hypot(
            (candidate.coordinates[1] - place.coordinates[1]) * 111000,
            (candidate.coordinates[0] - place.coordinates[0]) * 111000 * Math.cos(place.coordinates[1] * Math.PI / 180)
          );
        const localMatch = (candidate.sources.includes('在地地標') || place.sources.includes('在地地標')) && distance < 80;
        return candidate.label.toLocaleLowerCase().replace(/[\s、,，.-]/g, '') === key
          || localMatch
          || (candidate.label.split('、')[0].toLocaleLowerCase().replace(/[\s,，.-]/g, '') === nameKey && distance < 80);
      });
      if (matchingPlace) {
        matchingPlace.sources = [...new Set([...matchingPlace.sources, ...place.sources])];
        if (place.sources.includes('在地地標')) {
          matchingPlace.label = place.label;
          matchingPlace.coordinates = place.coordinates;
        }
      }
      else merged.push(place);
    });
    return merged.slice(0, 8);
  };

  const searchPlaces = async query => {
    const revision = ++searchRevision;
    clearTimeout(nominatimTimer);
    photonRequest?.abort();
    nominatimRequest?.abort();
    if (query.length < 2) {
      closeSuggestions();
      return;
    }
    let photonPlaces = [];
    let nominatimPlaces = [];
    const localCandidates = localPlacesFor(query);
    renderSuggestions(mergePlaces(photonPlaces, nominatimPlaces, localCandidates));
    photonRequest = new AbortController();
    const params = new URLSearchParams({ q: query, limit: '6' });
    const searchOrigin = currentPosition || [120.9718535, 24.8035879];
    params.set('lon', String(searchOrigin[0]));
    params.set('lat', String(searchOrigin[1]));
    const photonLookup = (async () => {
      try {
        const response = await fetch(`https://photon.komoot.io/api/?${params}`, { signal: photonRequest.signal });
        if (response.ok && revision === searchRevision) {
          const result = await response.json();
          photonPlaces = photonPlacesFrom(result.features || []);
          renderSuggestions(mergePlaces(photonPlaces, nominatimPlaces, localCandidates));
        }
      } catch (error) {
        if (error.name !== 'AbortError' && revision === searchRevision) closeSuggestions();
      }
    })();

    nominatimTimer = setTimeout(async () => {
      nominatimRequest = new AbortController();
      const params = new URLSearchParams({
        q: query,
        format: 'jsonv2',
        addressdetails: '1',
        limit: '6',
        countrycodes: 'tw',
        'accept-language': 'zh-TW'
      });
      try {
        const response = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, { signal: nominatimRequest.signal });
        if (!response.ok || revision !== searchRevision) return;
        nominatimPlaces = nominatimPlacesFrom(await response.json());
        renderSuggestions(mergePlaces(photonPlaces, nominatimPlaces, localCandidates));
      } catch (error) {
        if (error.name !== 'AbortError' && revision === searchRevision && photonPlaces.length) {
          renderSuggestions(photonPlaces);
        }
      }
    }, 1200);
    await photonLookup;
  };

  input.addEventListener('input', () => {
    if (input.value !== lastLocatedLabel) lastLocatedLabel = '';
    clearTimeout(nominatimTimer);
    photonRequest?.abort();
    nominatimRequest?.abort();
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => searchPlaces(input.value.trim()), 350);
  });
  input.addEventListener('keydown', event => {
    if (event.key === 'ArrowDown' && !suggestions.hidden) {
      event.preventDefault();
      suggestions.querySelector('button')?.focus();
    } else if (event.key === 'Escape') closeSuggestions();
  });
  input.addEventListener('focus', () => {
    if (currentPosition) showMap(currentPosition);
  });

  locateButton.addEventListener('click', () => {
    if (!navigator.geolocation) {
      showLocationError('此瀏覽器不支援定位，請直接輸入地點。');
      return;
    }
    clearLocationError();
    locateButton.disabled = true;
    navigator.geolocation.getCurrentPosition(async position => {
      currentPosition = [position.coords.longitude, position.coords.latitude];
      showMap(currentPosition);
      locateButton.disabled = false;
      const label = await reverseGeocode(currentPosition);
      if (label && (!input.value.trim() || input.value === lastLocatedLabel)) {
        input.value = label;
        lastLocatedLabel = label;
      }
    }, error => {
      locateButton.disabled = false;
      showLocationError(error.code === 1
        ? '未取得定位權限，仍可直接輸入或搜尋地點。'
        : '目前無法取得位置，請直接輸入或搜尋地點。');
    }, { enableHighAccuracy: false, maximumAge: 60000, timeout: 10000 });
  });

  infoContainer.addEventListener('pointerenter', event => {
    if (event.pointerType === 'mouse') setInfoOpen(true);
  });
  infoContainer.addEventListener('pointerleave', event => {
    if (event.pointerType === 'mouse') setInfoOpen(false);
  });
  infoButton.addEventListener('pointerdown', event => {
    infoPointerType = event.pointerType;
  });
  infoButton.addEventListener('focus', () => setInfoOpen(true));
  infoButton.addEventListener('click', event => {
    if (infoPointerType === 'touch' || infoPointerType === 'pen') {
      setInfoOpen(infoPopover.hidden);
    } else if (event.detail === 0) {
      setInfoOpen(true);
    }
  });
  const onDocumentKeydown = event => {
    if (event.key === 'Escape') {
      closeSuggestions();
      setInfoOpen(false);
    }
  };
  const onDocumentPointerdown = event => {
    if (!input.contains(event.target) && !suggestions.contains(event.target)) closeSuggestions();
    if (!infoContainer.contains(event.target)) setInfoOpen(false);
  };
  document.addEventListener('keydown', onDocumentKeydown);
  document.addEventListener('pointerdown', onDocumentPointerdown);

  const reset = () => {
    clearTimeout(debounceTimer);
    clearTimeout(nominatimTimer);
    photonRequest?.abort();
    nominatimRequest?.abort();
    searchRevision += 1;
    currentPosition = null;
    lastLocatedLabel = '';
    closeSuggestions();
    clearLocationError();
    map.hidden = true;
    setInfoOpen(false);
  };
  // 動態新增／移除的欄位需要解除全域監聽並釋放地圖。
  reset.destroy = () => {
    reset();
    document.removeEventListener('keydown', onDocumentKeydown);
    document.removeEventListener('pointerdown', onDocumentPointerdown);
    leafletMap?.remove();
    leafletMap = null;
  };
  return reset;
}

function initializeLocationPickers(locations) {
  ['hometown', 'residence'].forEach(inputId => {
    const input = document.getElementById(inputId);
    if (!input) return;

    const listbox = document.createElement('div');
    listbox.id = `${inputId}-options`;
    listbox.className = 'location-options';
    listbox.setAttribute('role', 'listbox');
    listbox.hidden = true;
    document.body.append(listbox);

    let activeIndex = -1;
    const getOptions = () => Array.from(listbox.querySelectorAll('[role="option"]'));
    const close = () => {
      listbox.hidden = true;
      input.setAttribute('aria-expanded', 'false');
      input.removeAttribute('aria-activedescendant');
      activeIndex = -1;
    };
    const positionListbox = () => {
      if (listbox.hidden) return;
      const rect = input.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom - 8;
      const spaceAbove = rect.top - 8;
      const openAbove = spaceBelow < 180 && spaceAbove > spaceBelow;
      const availableSpace = openAbove ? spaceAbove : spaceBelow;
      const maxHeight = Math.max(96, Math.min(240, availableSpace));
      listbox.style.left = `${rect.left}px`;
      listbox.style.width = `${rect.width}px`;
      listbox.style.maxHeight = `${maxHeight}px`;
      listbox.style.top = openAbove ? `${Math.max(8, rect.top - maxHeight - 4)}px` : `${rect.bottom + 4}px`;
    };
    const choose = value => {
      input.value = value;
      input.setCustomValidity('');
      input.dispatchEvent(new Event('change', { bubbles: true }));
      close();
    };
    const render = query => {
      const normalizedQuery = query.trim().toLocaleLowerCase();
      const matches = locations.filter(location => location.toLocaleLowerCase().includes(normalizedQuery));
      listbox.replaceChildren();
      activeIndex = -1;
      matches.forEach((location, index) => {
        const option = document.createElement('button');
        option.type = 'button';
        option.id = `${inputId}-option-${index}`;
        option.className = 'location-option';
        option.setAttribute('role', 'option');
        option.setAttribute('aria-selected', 'false');
        option.textContent = location;
        option.addEventListener('pointerdown', event => event.preventDefault());
        option.addEventListener('click', () => choose(location));
        listbox.append(option);
      });
      if (!matches.length) {
        const emptyMessage = document.createElement('span');
        emptyMessage.className = 'location-no-results';
        emptyMessage.textContent = '沒有符合的縣市';
        listbox.append(emptyMessage);
      }
      listbox.hidden = false;
      input.setAttribute('aria-expanded', 'true');
      positionListbox();
    };

    input.addEventListener('focus', () => render(input.value));
    input.addEventListener('pointerdown', () => render(input.value));
    input.addEventListener('input', () => {
      input.setCustomValidity('');
      render(input.value);
    });
    input.addEventListener('change', close);
    input.addEventListener('keydown', event => {
      const options = getOptions();
      if (event.key === 'Escape') close();
      else if (event.key === 'ArrowDown' && options.length) {
        event.preventDefault();
        activeIndex = Math.min(activeIndex + 1, options.length - 1);
      } else if (event.key === 'ArrowUp' && options.length) {
        event.preventDefault();
        activeIndex = Math.max(activeIndex - 1, 0);
      } else if (event.key === 'Enter' && !listbox.hidden && activeIndex >= 0) {
        event.preventDefault();
        choose(options[activeIndex].textContent);
        return;
      } else return;

      options.forEach((option, index) => {
        const isActive = index === activeIndex;
        option.classList.toggle('is-active', isActive);
        option.setAttribute('aria-selected', String(isActive));
      });
      if (activeIndex >= 0) input.setAttribute('aria-activedescendant', options[activeIndex].id);
      else input.removeAttribute('aria-activedescendant');
    });
    document.addEventListener('pointerdown', event => {
      if (!input.contains(event.target) && !listbox.contains(event.target)) close();
    });
    window.addEventListener('resize', positionListbox);
    window.addEventListener('scroll', positionListbox, true);
  });
}

function initializeNationalityPicker() {
  const options = document.getElementById('nationality-options');
  const search = document.getElementById('nationality-search');
  if (!options || !search) return;

  const countryCodes = `AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS XK YE YT ZA ZM ZW`.split(/\s+/);
  const restrictedDualCitizenship = new Set([
    'AE', 'AF', 'AT', 'BH', 'BN', 'CN', 'ID', 'IN', 'IR', 'JP', 'KW', 'LA',
    'MM', 'MY', 'NP', 'OM', 'QA', 'SA', 'SG', 'VN'
  ]);
  const regionNames = new Intl.DisplayNames(['zh-TW'], { type: 'region' });

  countryCodes.forEach(code => {
    const countryName = regionNames.of(code) || code;
    const label = document.createElement('label');
    const checkbox = document.createElement('input');
    const text = document.createElement('span');
    checkbox.type = 'checkbox';
    checkbox.name = 'nationality[]';
    checkbox.value = code;
    checkbox.dataset.nationalityName = countryName;
    text.textContent = countryName;
    label.dataset.searchText = `${countryName} ${code}`.toLocaleLowerCase();
    label.append(checkbox, text);
    options.append(label);
  });

  const selectedContainer = document.getElementById('nationality-selected');
  const message = document.getElementById('nationality-message');
  const updateSelected = () => {
    selectedContainer.replaceChildren();
    options.querySelectorAll('input:checked').forEach(checkbox => {
      const removeButton = document.createElement('button');
      removeButton.type = 'button';
      removeButton.className = 'selected-value';
      removeButton.dataset.removeNationality = checkbox.value;
      removeButton.setAttribute('aria-label', `移除國籍 ${checkbox.dataset.nationalityName}`);
      removeButton.textContent = `${checkbox.dataset.nationalityName} ×`;
      selectedContainer.append(removeButton);
    });
  };

  search.addEventListener('input', () => {
    const query = search.value.trim().toLocaleLowerCase();
    options.querySelectorAll('label').forEach(label => {
      label.hidden = query !== '' && !label.dataset.searchText.includes(query);
    });
  });

  options.addEventListener('change', event => {
    const checkbox = event.target;
    if (checkbox.type !== 'checkbox') return;
    const exclusiveSelected = Array.from(options.querySelectorAll('input:checked'))
      .find(item => item !== checkbox && restrictedDualCitizenship.has(item.value));
    if (checkbox.checked && restrictedDualCitizenship.has(checkbox.value)) {
      options.querySelectorAll('input:checked').forEach(item => {
        if (item !== checkbox) item.checked = false;
      });
      message.textContent = `${checkbox.dataset.nationalityName} 已設為唯一國籍。`;
    } else if (checkbox.checked && exclusiveSelected) {
      checkbox.checked = false;
      message.textContent = `請先移除 ${exclusiveSelected.dataset.nationalityName}，再選擇其他國籍。`;
    } else {
      message.textContent = '';
    }
    updateSelected();
  });

  selectedContainer.addEventListener('click', event => {
    const code = event.target.dataset.removeNationality;
    const checkbox = code && options.querySelector(`input[value="${code}"]`);
    if (checkbox) {
      checkbox.checked = false;
      checkbox.dispatchEvent(new Event('change', { bubbles: true }));
    }
  });
}

function initializeQuestionnaire(form) {
  const steps = Array.from(form.querySelectorAll('.question-step, .question-group'));
  if (!steps.length) return;

  [['gender_select', 'gender_others', 'gender_others_field'],
    ['orientation_select', 'orientation_others', 'orientation_others_field']].forEach(([selectId, otherValue, fieldId]) => {
    const select = document.getElementById(selectId);
    const field = document.getElementById(fieldId);
    const input = field?.querySelector('input');
    if (!select || !field || !input) return;
    const update = () => {
      const visible = select.value === otherValue;
      field.hidden = !visible;
      input.required = visible;
      if (!visible) input.value = '';
    };
    select.addEventListener('change', update);
    update();
  });

  [['hometown', 'hometown-others-field'], ['residence', 'residence-others-field']].forEach(([inputId, fieldId]) => {
    const input = document.getElementById(inputId);
    const field = document.getElementById(fieldId);
    const otherInput = field?.querySelector('input');
    if (!input || !field || !otherInput) return;
    input.addEventListener('change', () => {
      const isOther = input.value === '其他';
      field.hidden = !isOther;
      otherInput.required = isOther;
      if (!isOther) otherInput.value = '';
    });
  });

  const toggleConditional = (panel, visible) => {
    if (!panel) return;
    panel.hidden = !visible;
    if (!visible) panel.querySelectorAll('input').forEach(input => {
      if (input.type === 'checkbox' || input.type === 'radio') input.checked = false;
      else input.value = '';
      input.required = false;
    });
  };
  const updateDrugBranches = () => {
    const yes = form.querySelector('input[name="usage_drug"][value="yes"]')?.checked;
    const amphetamine = form.querySelector('input[name="drug_amphetamine"]')?.checked;
    const other = form.querySelector('input[name="drug_other_choice"]')?.checked;
    toggleConditional(document.getElementById('usage-drug-details'), Boolean(yes));
    toggleConditional(document.getElementById('amphetamine-routes'), Boolean(yes && amphetamine));
    toggleConditional(document.getElementById('drug-others-field'), Boolean(yes && other));
  };
  const updateStdBranches = () => {
    const yes = form.querySelector('input[name="frequency_std"][value="yes"]')?.checked;
    const aids = form.querySelector('input[name="std_aids"]')?.checked;
    const other = form.querySelector('input[name="std_other_choice"]')?.checked;
    toggleConditional(document.getElementById('std-details'), Boolean(yes));
    toggleConditional(document.getElementById('std-aids-reason-field'), Boolean(yes && aids));
    toggleConditional(document.getElementById('std-others-field'), Boolean(yes && other));
  };
  form.querySelectorAll('input[name="usage_drug"], input[name^="drug_"]').forEach(input => input.addEventListener('change', updateDrugBranches));
  form.querySelectorAll('input[name="frequency_std"], input[name^="std_"]').forEach(input => input.addEventListener('change', updateStdBranches));
  updateDrugBranches();
  updateStdBranches();

  const privacyCopy = form.querySelector('.privacy-copy');
  const consentOptions = form.querySelector('.consent-options');
  if (privacyCopy && consentOptions) {
    const unlock = () => {
      consentOptions.disabled = false;
      privacyCopy.dataset.read = 'true';
    };
    const unlockWhenRead = () => {
      const contentFits = privacyCopy.scrollHeight <= privacyCopy.clientHeight + 1;
      const reachedBottom = privacyCopy.scrollTop + privacyCopy.clientHeight >= privacyCopy.scrollHeight - 2;
      if (contentFits || reachedBottom) unlock();
    };
    privacyCopy.addEventListener('scroll', unlockWhenRead, { passive: true });
    unlockWhenRead();
  }

  const frequency = document.getElementById('frequency_screening');
  const output = form.querySelector('.frequency-screening-value');
  if (frequency && output) {
    const labels = form.querySelectorAll('.frequency-labels span');
    const values = new Map([[-1, labels[0]?.textContent.trim() || '從未篩檢'], [0, labels[1]?.textContent.trim() || '偶爾篩檢'], [1, labels[2]?.textContent.trim() || '定期篩檢']]);
    const update = () => {
      const value = Number(frequency.value);
      output.value = values.get(value);
      output.textContent = output.value;
      frequency.setAttribute('aria-valuetext', output.value);
      const progress = ((value - Number(frequency.min)) / (Number(frequency.max) - Number(frequency.min))) * 100;
      frequency.style.setProperty('--range-progress', `${progress}%`);
      labels.forEach(label => {
        const isActive = Number(label.dataset.frequencyValue) === value;
        label.classList.toggle('is-active', isActive);
        if (isActive) label.setAttribute('aria-current', 'true');
        else label.removeAttribute('aria-current');
      });
      if (value === -1) form.querySelector('#last_screening_at').value = '';
    };
    frequency.addEventListener('input', update);
    update();
  }

  let currentStep = 0;
  const sectionButtons = Array.from(document.querySelectorAll('[data-questionnaire-section]'));
  let furthestSectionIndex = 0;
  let editReturnStep = null;
  let editGroupRange = null;
  let editingSummary = null;

  const sectionIndexForStep = step => {
    const heading = step.closest('.card')?.querySelector('h2[id^="questionnaire-"]');
    return ['questionnaire-notice', 'questionnaire-risk', 'questionnaire-profile', 'questionnaire-screening']
      .indexOf(heading?.id);
  };

  const updateSectionProgress = () => {
    const currentSectionIndex = sectionIndexForStep(steps[currentStep]);
    if (currentSectionIndex >= 0) furthestSectionIndex = Math.max(furthestSectionIndex, currentSectionIndex);
    sectionButtons.forEach((button, index) => {
      const isCurrent = index === currentSectionIndex;
      const isComplete = index < furthestSectionIndex;
      button.disabled = isCurrent || index >= furthestSectionIndex;
      button.dataset.state = isCurrent ? 'current' : isComplete ? 'complete' : 'upcoming';
      if (isCurrent) button.setAttribute('aria-current', 'step');
      else button.removeAttribute('aria-current');
      const marker = button.querySelector('.progress-marker');
      if (marker) marker.textContent = isComplete ? '\u2713' : String(index + 1);
    });
  };

  const updateRiskSubheadings = () => {
    const riskCard = form.querySelector('#questionnaire-risk')?.closest('.card');
    const activeContent = steps[currentStep].closest('.card-content');
    riskCard?.querySelectorAll(':scope > .card-content').forEach(content => {
      const isTitle = Boolean(content.querySelector(':scope > #questionnaire-risk'));
      content.hidden = !isTitle && content !== activeContent;
    });
  };

  steps.forEach((step, index) => {
    if (index === 0) return;
    const back = document.createElement('button');
    back.type = 'button';
    back.className = 'btn-flat question-back';
    back.dataset.questionBack = '';
    back.textContent = '上一題';
    const legend = step.matches('fieldset') ? step.querySelector(':scope > legend') : null;
    if (legend) legend.after(back);
    else step.prepend(back);
  });

  steps.forEach(step => {
    if (step.id === 'screener-panel' || step.querySelector('#profile-review-button')) return;
    if (step.querySelector('[data-question-next]')) return;
    const needsManualAdvance = step.matches('.consent-options') || step.querySelector(
      'select:not([multiple]), input[type="date"], input[type="month"], input[type="search"][role="combobox"], input[type="text"][required]'
    );
    if (!needsManualAdvance) return;
    const nextButton = document.createElement('button');
    nextButton.type = 'button';
    nextButton.className = 'btn-flat question-next';
    nextButton.dataset.questionNext = '';
    nextButton.textContent = '下一題';
    step.append(nextButton);
  });

  const showStep = (index, scroll = false) => {
    currentStep = index;
    steps.forEach((step, stepIndex) => {
      step.querySelector('.answer-edit-done')?.remove();
      step.hidden = stepIndex !== index;
      const backButton = step.querySelector('[data-question-back]');
      if (backButton) backButton.hidden = Boolean(editGroupRange && stepIndex === editGroupRange.start);
    });
    if (editGroupRange && index >= editGroupRange.start && index <= editGroupRange.end) {
      const doneButton = document.createElement('button');
      doneButton.type = 'button';
      doneButton.className = 'btn-flat answer-edit-done';
      doneButton.dataset.finishAnswerEdit = '';
      doneButton.textContent = '完成修改並返回';
      steps[index].append(doneButton);
    }
    updateSectionProgress();
    updateRiskSubheadings();
    if (scroll && steps[index]) {
      steps[index].scrollIntoView({ behavior: 'smooth', block: 'center' });
      steps[index].querySelector('input:not([type="hidden"]), select, button:not(.question-back)')?.focus({ preventScroll: true });
    }
  };

  sectionButtons.forEach(button => {
    button.addEventListener('click', () => {
      const sectionIndex = Number(button.dataset.questionnaireSection);
      if (sectionIndex >= furthestSectionIndex) return;
      const firstStepInSection = steps.findIndex(step => sectionIndexForStep(step) === sectionIndex);
      if (firstStepInSection >= 0) showStep(firstStepInSection, true);
    });
  });
  const validateStep = step => {
    const group = step.querySelector('[data-required-group="nationality"]');
    if (group && !group.querySelector('input:checked')) {
      document.getElementById('nationality-message').textContent = '請至少選擇一個國家或地區。';
      document.getElementById('nationality-search').focus();
      return false;
    }
    const location = step.querySelector('#hometown, #residence');
    if (location?.value) {
      const known = taiwanAdminLocations.includes(location.value.trim());
      location.setCustomValidity(known ? '' : '請從台灣縣市候選清單中選擇。');
    }
    const invalid = step.querySelector(':invalid');
    if (invalid) {
      invalid.reportValidity();
      return false;
    }
    return true;
  };
  const isStepAvailable = step => {
    const condition = step.dataset.showIf;
    if (!condition) return true;
    const [fieldName, expectedValue] = condition.split(':');
    const expectedValues = expectedValue.split(',');
    return Array.from(form.querySelectorAll('input, select, textarea')).some(input => {
      if (input.name !== fieldName) return false;
      const value = input.type === 'radio' || input.type === 'checkbox'
        ? input.checked && input.value
        : input.value;
      return expectedValues.includes(String(value));
    });
  };

  const handleRadioAnswer = input => {
    const step = input.closest('.question-group');
    if (!step || steps[currentStep] !== step) return;
    const branch = input.name === 'usage_drug' ? updateDrugBranches
      : input.name === 'frequency_std' ? updateStdBranches
        : null;
    if (input.value === 'yes' && branch) {
      branch();
      return;
    }
    if (input.value === 'no' && branch) branch();
    advance();
  };

  let answerGroups = new Map();

  const buildQuestionnaireAnswerGroups = () => {
    const groups = new Map();
    const selectedText = id => {
      const select = document.getElementById(id);
      const option = select?.selectedOptions[0];
      return option && !option.disabled ? option.textContent.trim() : '';
    };
    const otherText = (selectId, inputId) => {
      const value = selectedText(selectId);
      const other = document.getElementById(inputId)?.value.trim();
      return value === '其他' && other ? `${value}（${other}）` : value;
    };
    const locationText = (inputId, otherId) => {
      const value = document.getElementById(inputId)?.value.trim();
      const other = document.getElementById(otherId)?.value.trim();
      return value === '其他' && other ? `${value}（${other}）` : value;
    };
    const add = (key, title, step, question, answer, fallback = '尚未填答') => {
      const stepIndex = steps.indexOf(step);
      if (stepIndex < 0) return;
      if (!groups.has(key)) groups.set(key, { key, title, start: stepIndex, end: stepIndex, rows: [] });
      const group = groups.get(key);
      group.start = Math.min(group.start, stepIndex);
      group.end = Math.max(group.end, stepIndex);
      group.rows.push([question, String(answer ?? '').trim() || fallback]);
    };
    const stepFor = selector => form.querySelector(selector)?.closest('.question-step');
    add('nickname', '暱稱', stepFor('#nickname'), '暱稱', document.getElementById('nickname')?.value, '未提供');
    add('profile', '基本資料', stepFor('#gender_select'), '性別', otherText('gender_select', 'gender_others'));
    add('profile', '基本資料', stepFor('#orientation_select'), '性傾向', otherText('orientation_select', 'orientation_others'));
    add('profile', '基本資料', stepFor('#birth'), '出生年份', selectedText('birth'));
    add('profile', '基本資料', stepFor('#nationality-search'), '國籍', Array.from(form.querySelectorAll('input[name="nationality[]"]:checked')).map(input => input.dataset.nationalityName).join('、'));
    add('profile', '基本資料', stepFor('#hometown'), '成年前居住地', locationText('hometown', 'hometown_others'));
    add('profile', '基本資料', stepFor('#residence'), '目前居住地', locationText('residence', 'residence_others'));
    add('profile', '基本資料', stepFor('#education'), '教育程度', selectedText('education'));
    const profileGroup = groups.get('profile');
    const profileSteps = steps.map((step, index) => ({ step, index })).filter(({ step }) =>
      step.closest('.profile-fields')
    );
    if (profileGroup && profileSteps.length) {
      profileGroup.start = profileSteps[0].index;
      profileGroup.end = profileSteps.at(-1).index;
    }
    form.querySelectorAll('.consent-options label').forEach(label => {
      const checkbox = label.querySelector('input[type="checkbox"]');
      const statement = label.querySelector('span')?.textContent.trim();
      if (checkbox && statement) add('notice', '篩檢須知', checkbox.closest('.question-step'), '同意確認', `${checkbox.checked ? '已同意' : '未勾選'}：${statement}`);
    });
    add('notice', '篩檢須知', stepFor('#frequency_screening'), '篩檢頻率', document.getElementById('frequency_screening')?.getAttribute('aria-valuetext'));
    if (Number(document.getElementById('frequency_screening')?.value) !== -1) {
      add('notice', '篩檢須知', stepFor('#last_screening_at'), '最近一次篩檢日期', document.getElementById('last_screening_at')?.value);
    }
    const noticeGroup = groups.get('notice');
    const noticeSteps = steps.map((step, index) => ({ step, index })).filter(({ step }) =>
      step.closest('.card')?.querySelector('#questionnaire-notice') && !step.querySelector('#nickname')
    );
    if (noticeGroup && noticeSteps.length) {
      noticeGroup.start = noticeSteps[0].index;
      noticeGroup.end = noticeSteps.at(-1).index;
    }
    const riskCard = form.querySelector('#questionnaire-risk')?.closest('.card');
    const riskContents = Array.from(riskCard?.querySelectorAll(':scope > .card-content') || []);
    form.querySelectorAll('.question-group').forEach(group => {
      const stepIndex = steps.indexOf(group);
      if (stepIndex < 0) return;
      const content = group.closest('.card-content');
      const contentIndex = riskContents.indexOf(content);
      if (contentIndex < 0) return;
      const heading = content.querySelector(':scope > h3')?.textContent.trim() || '風險評估';
      const key = `risk-${contentIndex}`;
      const groupRange = steps.map((step, index) => ({ step, index })).filter(({ step }) => step.closest('.card-content') === content);
      if (groupRange.length) {
        if (!groups.has(key)) groups.set(key, { key, title: heading, start: groupRange[0].index, end: groupRange.at(-1).index, rows: [] });
        const currentGroup = groups.get(key);
        currentGroup.start = Math.min(currentGroup.start, groupRange[0].index);
        currentGroup.end = Math.max(currentGroup.end, groupRange.at(-1).index);
      }
      if (!isStepAvailable(group)) return;
      const question = group.querySelector(':scope > legend')?.textContent.trim().replace(/\s+/g, ' ');
      if (!question) return;
      const radios = Array.from(group.querySelectorAll('input[type="radio"]'));
      const checkedRadio = radios.find(input => input.checked);
      const radioAnswer = checkedRadio?.closest('label')?.querySelector('span')?.textContent.trim();
      const checkedBoxes = Array.from(group.querySelectorAll('input[type="checkbox"]:checked')).map(input => input.closest('label')?.querySelector('span')?.textContent.trim()).filter(Boolean);
      const textAnswers = Array.from(group.querySelectorAll('input[type="text"], textarea')).filter(input => input.value.trim()).map(input => {
        const label = input.id && form.querySelector(`label[for="${input.id}"]`);
        return `${label?.textContent.trim() || '其他'}：${input.value.trim()}`;
      });
      const answers = [];
      if (radios.length) answers.push(radioAnswer || '尚未回答');
      if (checkedBoxes.length) answers.push(checkedBoxes.join('、'));
      else if (checkedRadio?.value === 'yes' && group.querySelector('input[type="checkbox"]')) answers.push('尚未勾選項目');
      answers.push(...textAnswers);
      add(key, heading, group, question, answers.join('；'), '未回答');
    });
    return Array.from(groups.values()).sort((first, second) => first.start - second.start);
  };

  const renderQuestionnaireAnswerSummary = summary => {
    if (!summary) return;
    answerGroups = new Map(buildQuestionnaireAnswerGroups().map(group => [group.key, group]));
    summary.replaceChildren();
    Array.from(answerGroups.values()).forEach((group, index) => {
      const details = document.createElement('details');
      details.className = 'answer-summary-group';
      details.open = index === 0;
      const heading = document.createElement('summary');
      heading.textContent = group.title;
      const answers = document.createElement('dl');
      answers.className = 'answer-summary-rows';
      group.rows.forEach(([question, answer]) => {
        const term = document.createElement('dt');
        const description = document.createElement('dd');
        term.textContent = question;
        description.textContent = answer;
        answers.append(term, description);
      });
      const editButton = document.createElement('button');
      editButton.type = 'button';
      editButton.className = 'btn-flat answer-summary-edit';
      editButton.dataset.editAnswerGroup = group.key;
      editButton.textContent = '修改此區段';
      editButton.hidden = summary.dataset.editMode !== 'true';
      details.append(heading, answers, editButton);
      summary.append(details);
    });
  };

  const finishAnswerEdit = () => {
    const returnStep = editReturnStep;
    const summary = editingSummary;
    editReturnStep = null;
    editGroupRange = null;
    editingSummary = null;
    if (summary) {
      summary.dataset.editMode = 'false';
      const toggle = summary.closest('.screening-answer-summary, .profile-confirmation')
        ?.querySelector('[data-toggle-answer-edit]');
      if (toggle) {
        toggle.textContent = '返回修改';
        toggle.setAttribute('aria-pressed', 'false');
      }
      renderQuestionnaireAnswerSummary(summary);
    }
    if (returnStep !== null) showStep(returnStep, true);
  };

  const advance = () => {
    if (!validateStep(steps[currentStep])) return;
    if (editReturnStep !== null && editGroupRange) {
      let nextEditStep = currentStep + 1;
      while (nextEditStep <= editGroupRange.end && !isStepAvailable(steps[nextEditStep])) nextEditStep += 1;
      if (nextEditStep <= editGroupRange.end) showStep(nextEditStep, true);
      else finishAnswerEdit();
      return;
    }
    let nextStep = currentStep + 1;
    while (nextStep < steps.length && !isStepAvailable(steps[nextStep])) nextStep += 1;
    if (nextStep < steps.length) showStep(nextStep, true);
  };
  form.addEventListener('click', event => {
    if (event.target.closest('[data-question-back]')) {
      let previousStep = currentStep - 1;
      const lowerBound = editGroupRange?.start ?? 0;
      while (previousStep >= lowerBound && !isStepAvailable(steps[previousStep])) previousStep -= 1;
      if (previousStep >= 0) showStep(previousStep, true);
      return;
    }
    if (event.target.closest('[data-finish-answer-edit]')) {
      if (!validateStep(steps[currentStep])) return;
      finishAnswerEdit();
      return;
    }

    const toggleEditButton = event.target.closest('[data-toggle-answer-edit]');
    if (toggleEditButton) {
      const summary = toggleEditButton.closest('.screening-answer-summary, .profile-confirmation')
        ?.querySelector('.answer-summary');
      if (!summary) return;
      const editing = summary.dataset.editMode !== 'true';
      summary.dataset.editMode = String(editing);
      toggleEditButton.textContent = editing ? '取消修改' : '返回修改';
      toggleEditButton.setAttribute('aria-pressed', String(editing));
      renderQuestionnaireAnswerSummary(summary);
      return;
    }

    const editGroupButton = event.target.closest('[data-edit-answer-group]');
    if (editGroupButton) {
      const summary = editGroupButton.closest('.answer-summary');
      const group = answerGroups.get(editGroupButton.dataset.editAnswerGroup);
      if (!summary || !group) return;
      editReturnStep = currentStep;
      editGroupRange = group;
      editingSummary = summary;
      let firstAvailable = group.start;
      while (firstAvailable <= group.end && !isStepAvailable(steps[firstAvailable])) firstAvailable += 1;
      if (firstAvailable <= group.end) showStep(firstAvailable, true);
      return;
    }
    const radio = event.target.closest('input[type="radio"]')
      || event.target.closest('label')?.querySelector('input[type="radio"]');
    if (radio?.checked) {
      handleRadioAnswer(radio);
      return;
    }
    if (event.target.closest('[data-question-next]')) {
      advance();
      return;
    }
    if (event.target.closest('#profile-review-button')) {
      renderQuestionnaireAnswerSummary(document.getElementById('profile-review-answers'));
      document.getElementById('profile-review-message').hidden = false;
      advance();
      return;
    }
    if (event.target.closest('#handoff-screening-button')) {
      renderQuestionnaireAnswerSummary(document.getElementById('screening-response-answers'));
      advance();
    }
  });
  form.addEventListener('change', event => {
    const input = event.target;
    const step = input.closest('.question-step, .question-group');
    if (!step || steps[currentStep] !== step) return;
    if (input.type === 'radio' && step.matches('.question-group')) {
      handleRadioAnswer(input);
      return;
    }
    if (input.type === 'checkbox') {
      if (step.matches('.question-group') || step.classList.contains('nationality-question')) return;
      if (step.classList.contains('consent-options')) {
        const required = Array.from(step.querySelectorAll('input[type="checkbox"][required]'));
        if (required.length && required.every(checkbox => checkbox.checked)) advance();
        return;
      }
    }
    if (input.matches('input[type="text"][required]')) {
      if (input.value.trim() && input.checkValidity()) advance();
      return;
    }
    if (input.tagName === 'SELECT') {
      if (input.value === 'gender_others' || input.value === 'orientation_others') {
        step.querySelector('.conditional-field:not([hidden]) input')?.focus();
        return;
      }
      advance();
      return;
    }
    if (input.matches('#hometown, #residence')) {
      if (input.value === '其他') {
        step.querySelector('.conditional-field:not([hidden]) input')?.focus();
        return;
      }
      if (validateStep(step)) advance();
      return;
    }
    if (input.matches('input[type="date"], input[type="month"]') && input.value) advance();
  });
  showStep(0);
}

function showFormStatus(status, message, isError = false) {
  if (!status) {
    return;
  }

  status.textContent = message;
  status.setAttribute('role', isError ? 'alert' : 'status');
  status.setAttribute('aria-live', isError ? 'assertive' : 'polite');
  status.classList.toggle('red-text', isError);
  status.classList.toggle('green-text', !isError);
  status.hidden = false;
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
  window.setTimeout(() => applyGoogleTranslation(selectedPageLanguage), 0);
}

function setPageLanguage(language) {
  selectedPageLanguage = language;
  localStorage.setItem('site-language', language);
  syncGoogleTranslationCookie(language);
  document.dispatchEvent(new CustomEvent('site-language-change', { detail: { language } }));
  const languageSelect = document.getElementById('language-select');
  if (languageSelect && languageSelect.value !== language) {
    languageSelect.value = language;
  }
  const label = document.getElementById('language-button-label');
  const languageLabelMap = {
    'zh-TW': '台灣華文',
    en: 'English',
    id: 'Bahasa Indonesia',
    th: 'ไทย',
    vi: 'Tiếng Việt',
    my: 'မြန်မာ',
    tl: 'Filipino',
    km: 'ភាសាខ្មែរ',
    bn: 'বাংলা'
  };
  if (label) {
    label.textContent = languageLabelMap[language] || '台灣華文';
  }
  setLanguage(language);
  const noticeParagraph = document.querySelector('[data-i18n="notice_paragraph"]');
  if (noticeParagraph) {
    noticeParagraph.textContent = noticeParagraph.textContent.replace(/\s*Taiwan AIDS Organization\s*$/, '');
  }
  const organizationName = document.getElementById('notice-org-name');
  if (organizationName) {
    organizationName.textContent = language === 'zh-TW'
      ? '財團法人紅絲帶基金會'
      : 'Taiwan AIDS Organization';
  }
  document.documentElement.lang = language;
  applyGoogleTranslation(language);
}

function syncGoogleTranslationCookie(language) {
  const googleCookie = document.cookie.match(/(?:^|;\s*)googtrans=\/([^/;]+)\/[^;]*/);
  const sourceLanguage = googleCookie?.[1] || 'zh-CN';

  if (language === 'zh-TW') {
    document.cookie = 'googtrans=; Max-Age=0; path=/; SameSite=Lax';
    return;
  }

  document.cookie = `googtrans=/${sourceLanguage}/${language}; path=/; SameSite=Lax`;
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
  if (button) {
    button.dataset.siteMode = selectedMode;
    const icon = button.querySelector('.material-icons');
    const iconName = selectedMode === 'auto' ? 'brightness_auto' : resolvedMode === 'dark' ? 'dark_mode' : 'light_mode';
    if (icon) icon.textContent = iconName;
    button.setAttribute('aria-label', selectedMode === 'auto' ? '自動主題' : resolvedMode === 'dark' ? '暗黑主題' : '明亮主題');
    button.title = selectedMode === 'auto' ? '自動主題' : resolvedMode === 'dark' ? '暗黑主題' : '明亮主題';
  }

}

window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function() {
  if (localStorage.getItem('site-mode') === 'auto') {
    setMode('auto');
  }
});

function applyGoogleTranslation(language, attempts = 20, menuOpened = false) {
  if (language !== selectedPageLanguage) return;

  const frames = Array.from(document.querySelectorAll('iframe'));
  const frameDocument = frame => {
    try {
      return frame.contentDocument;
    } catch {
      return null;
    }
  };
  const isFrameVisible = frame => {
    if (!frame) return false;
    const rect = frame.getBoundingClientRect();
    const style = window.getComputedStyle(frame);
    return style.display !== 'none'
      && style.visibility !== 'hidden'
      && rect.width > 0
      && rect.height > 0;
  };
  const isTranslationApplied = () => ['translated-ltr', 'translated-rtl'].some(className =>
    document.documentElement.classList.contains(className)
    || document.body.classList.contains(className)
  );
  const translatedToolbar = frames
    .map(frameDocument)
    .find(frame => frame?.body?.innerText.includes('顯示原文'));

  if (language === 'zh-TW') {
    const showOriginalButton = Array.from(translatedToolbar?.querySelectorAll('button') || [])
      .find(button => button.textContent.includes('顯示原文'));
    if (showOriginalButton) {
      showOriginalButton.click();
      googleMachineTranslationActive = false;
    } else if (googleMachineTranslationActive && attempts > 0) {
      window.setTimeout(() => applyGoogleTranslation(language, attempts - 1), 250);
    }
    return;
  }

  const googleLanguageNames = {
    id: '印尼文', bn: '孟加拉文', en: '英文', th: '泰文',
    km: '高棉文', tl: '菲律賓文', vi: '越南文', my: '緬甸文'
  };
  const targetLanguageName = googleLanguageNames[language];
  if (!targetLanguageName) return;

  const menuFrame = frames.find(frame => {
    const body = frameDocument(frame)?.body;
    return isFrameVisible(frame) && body?.innerText.includes(targetLanguageName);
  });
  const languageLink = Array.from(frameDocument(menuFrame)?.querySelectorAll('a') || [])
    .find(link => link.textContent.includes(targetLanguageName));

  if (languageLink) {
    languageLink.click();
    window.setTimeout(() => {
      if (language !== selectedPageLanguage) return;
      if (isTranslationApplied()) {
        googleMachineTranslationActive = true;
        return;
      }
      googleMachineTranslationActive = false;
      if (attempts > 0) applyGoogleTranslation(language, attempts - 1);
    }, 750);
    return;
  }

  const menuButton = document.querySelector('#google_translate_element a[aria-haspopup="true"]');
  if (menuButton && !menuOpened) {
    menuButton.click();
    menuOpened = true;
  }
  if (attempts > 0) {
    window.setTimeout(() => applyGoogleTranslation(language, attempts - 1, menuOpened), 250);
  }
}

