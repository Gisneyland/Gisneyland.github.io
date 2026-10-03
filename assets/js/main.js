document.addEventListener('DOMContentLoaded', function() {
  initializeQuestionnaireFields();

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
    initializeQuestionnaire(questionnaireForm);
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
          language: document.documentElement.dataset.contentLanguage || 'zh-TW',
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
    if (!element.name || element.matches(':disabled')) {
      return;
    }

    if (element.type === 'checkbox') {
      if (element.name.endsWith('[]')) {
        const name = element.name.slice(0, -2);
        data[name] ??= [];
        if (element.checked) {
          data[name].push(element.value);
        }
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

function initializeQuestionnaireFields() {
  const birthYear = document.getElementById('birth');
  if (birthYear) {
    const currentYear = new Date().getFullYear();
    for (let year = currentYear; year >= 1900; year -= 1) {
      birthYear.add(new Option(String(year), String(year)));
    }
  }

  const adminOptions = document.getElementById('taiwan-admin-options');
  if (adminOptions) {
    const citiesAndCounties = [
      '基隆市', '臺北市', '新北市', '桃園市', '新竹市', '新竹縣', '苗栗縣',
      '臺中市', '彰化縣', '南投縣', '雲林縣', '嘉義市', '嘉義縣', '臺南市',
      '高雄市', '屏東縣', '宜蘭縣', '花蓮縣', '臺東縣', '澎湖縣', '金門縣', '連江縣', '其他'
    ];
    citiesAndCounties.forEach(name => adminOptions.append(new Option(name, name)));
  }

  initializeNationalityPicker();
}

function initializeNationalityPicker() {
  const options = document.getElementById('nationality-options');
  const search = document.getElementById('nationality-search');
  if (!options || !search) {
    return;
  }

    const countryCodes = `AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS XK YE YT ZA ZM ZW`.split(/\s+/);
  const restrictedDualCitizenship = new Set([
    'AE', 'AF', 'AT', 'BH', 'BN', 'CN', 'ID', 'IN', 'IR', 'JP', 'KW', 'LA',
    'MM', 'MY', 'NP', 'OM', 'QA', 'SA', 'SG', 'VN'
  ]);
  const regionNames = new Intl.DisplayNames(['zh-TW'], { type: 'region' });
  const selected = new Map();

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
    selected.clear();
    options.querySelectorAll('input:checked').forEach(checkbox => {
      selected.set(checkbox.value, checkbox.dataset.nationalityName);
    });
    selectedContainer.replaceChildren();
    selected.forEach((name, code) => {
      const removeButton = document.createElement('button');
      removeButton.type = 'button';
      removeButton.className = 'selected-value';
      removeButton.dataset.removeNationality = code;
      removeButton.setAttribute('aria-label', `移除國籍 ${name}`);
      removeButton.textContent = `${name} ×`;
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
    if (checkbox.type !== 'checkbox') {
      return;
    }

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
    if (!code) return;
    const checkbox = options.querySelector(`input[value="${code}"]`);
    if (checkbox) {
      checkbox.checked = false;
      checkbox.dispatchEvent(new Event('change', { bubbles: true }));
    }
  });
}

function initializeQuestionnaire(form) {
  const steps = Array.from(form.querySelectorAll('.question-step, .question-group'));
  if (!steps.length) {
    return;
  }

  const conditionalOptions = [
    ['gender_select', 'gender_others', 'gender_others_field'],
    ['orientation_select', 'orientation_others', 'orientation_others_field']
  ];
  conditionalOptions.forEach(([selectId, otherValue, fieldId]) => {
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
    if (!visible) {
      panel.querySelectorAll('input').forEach(input => {
        if (input.type === 'checkbox' || input.type === 'radio') input.checked = false;
        else input.value = '';
        input.required = false;
      });
    }
  };

  const updateDrugBranches = () => {
    const drugYes = form.querySelector('input[name="usage_drug"][value="yes"]')?.checked;
    const amphetamine = form.querySelector('input[name="drug_amphetamine"]')?.checked;
    const otherDrug = form.querySelector('input[name="drug_other_choice"]')?.checked;
    toggleConditional(document.getElementById('usage-drug-details'), Boolean(drugYes));
    toggleConditional(document.getElementById('amphetamine-routes'), Boolean(drugYes && amphetamine));
    toggleConditional(document.getElementById('drug-others-field'), Boolean(drugYes && otherDrug));
  };

  const updateStdBranches = () => {
    const stdYes = form.querySelector('input[name="frequency_std"][value="yes"]')?.checked;
    const aids = form.querySelector('input[name="std_aids"]')?.checked;
    const otherStd = form.querySelector('input[name="std_other_choice"]')?.checked;
    toggleConditional(document.getElementById('std-details'), Boolean(stdYes));
    toggleConditional(document.getElementById('std-aids-reason-field'), Boolean(stdYes && aids));
    toggleConditional(document.getElementById('std-others-field'), Boolean(stdYes && otherStd));
  };

  form.querySelectorAll('input[name="usage_drug"], input[name^="drug_"]').forEach(input => {
    input.addEventListener('change', updateDrugBranches);
  });
  form.querySelectorAll('input[name="frequency_std"], input[name^="std_"]').forEach(input => {
    input.addEventListener('change', updateStdBranches);
  });
  updateDrugBranches();
  updateStdBranches();

  const privacyCopy = form.querySelector('.privacy-copy');
  const consentOptions = form.querySelector('.consent-options');
  if (privacyCopy && consentOptions) {
    const unlockConsent = () => {
      consentOptions.disabled = false;
      privacyCopy.dataset.read = 'true';
    };
    const unlockWhenRead = () => {
      const contentFits = privacyCopy.scrollHeight <= privacyCopy.clientHeight + 1;
      const reachedBottom = privacyCopy.scrollTop + privacyCopy.clientHeight >= privacyCopy.scrollHeight - 2;
      if (contentFits || reachedBottom) unlockConsent();
    };
    privacyCopy.addEventListener('scroll', unlockWhenRead, { passive: true });
    unlockWhenRead();
  }

  const frequency = document.getElementById('frequency_screening');
  const frequencyOutput = form.querySelector('.frequency-screening-value');
  if (frequency && frequencyOutput) {
    const labelElements = form.querySelectorAll('.frequency-labels span');
    const labels = new Map([
      [-1, labelElements[0]?.textContent.trim() || '從未篩檢'],
      [0, labelElements[1]?.textContent.trim() || '偶爾篩檢'],
      [1, labelElements[2]?.textContent.trim() || '定期篩檢']
    ]);
    const updateFrequency = () => {
      const label = labels.get(Number(frequency.value));
      frequencyOutput.value = label;
      frequencyOutput.textContent = label;
      frequency.setAttribute('aria-valuetext', label);
    };
    frequency.addEventListener('input', updateFrequency);
    updateFrequency();
  }

  let currentStep = 0;
  const sectionButtons = Array.from(document.querySelectorAll('[data-questionnaire-section]'));
  let furthestSectionIndex = 0;

  const sectionIndexForStep = step => {
    const heading = step.closest('.card')?.querySelector('h2[id^="questionnaire-"]');
    return sectionButtons.findIndex(button => button.dataset.questionnaireSection === String(
      ['questionnaire-notice', 'questionnaire-risk', 'questionnaire-profile', 'questionnaire-screening'].indexOf(heading?.id)
    ));
  };

  const updateSectionProgress = () => {
    const currentSectionIndex = sectionIndexForStep(steps[currentStep]);
    if (currentSectionIndex >= 0) {
      furthestSectionIndex = Math.max(furthestSectionIndex, currentSectionIndex);
    }

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

  steps.forEach((step, index) => {
    if (index === 0) return;
    const backButton = document.createElement('button');
    backButton.type = 'button';
    backButton.className = 'btn-flat question-back';
    backButton.dataset.questionBack = '';
    backButton.textContent = '上一題';
    const legend = step.matches('fieldset') ? step.querySelector(':scope > legend') : null;
    if (legend) legend.after(backButton);
    else step.prepend(backButton);
  });

  const showStep = (index, shouldScroll = false) => {
    currentStep = index;
    steps.forEach((step, stepIndex) => {
      step.hidden = stepIndex !== index;
    });
    updateSectionProgress();
    if (shouldScroll && steps[index]) {
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
    const requiredGroup = step.querySelector('[data-required-group="nationality"]');
    if (requiredGroup && !requiredGroup.querySelector('input:checked')) {
      const message = document.getElementById('nationality-message');
      message.textContent = '請至少選擇一個國家或地區。';
      document.getElementById('nationality-search').focus();
      return false;
    }

    const locationInput = step.querySelector('input[list="taiwan-admin-options"]');
    if (locationInput?.value) {
      const options = Array.from(document.getElementById('taiwan-admin-options').options);
      const isKnownLocation = options.some(option => option.value === locationInput.value.trim());
      locationInput.setCustomValidity(isKnownLocation ? '' : '請從台灣縣市候選清單中選擇。');
    }

    const invalid = step.querySelector(':invalid');
    if (invalid) {
      invalid.reportValidity();
      return false;
    }
    return true;
  };

  const advance = () => {
    if (!validateStep(steps[currentStep])) return;
    if (currentStep < steps.length - 1) showStep(currentStep + 1, true);
  };

  form.addEventListener('click', event => {
    if (event.target.closest('[data-question-back]')) {
      showStep(Math.max(currentStep - 1, 0), true);
      return;
    }

    if (event.target.closest('[data-question-next]')) {
      advance();
      return;
    }

    if (event.target.closest('#profile-review-button')) {
      document.getElementById('profile-review-message').hidden = false;
      advance();
    }
  });

  form.addEventListener('change', event => {
    const input = event.target;
    const step = input.closest('.question-step, .question-group');
    if (!step || steps[currentStep] !== step) return;

    if (input.type === 'radio' && step.matches('.question-group')) {
      const detailsId = input.name === 'usage_drug' ? 'usage-drug-details'
        : input.name === 'frequency_std' ? 'std-details'
          : null;
      if (input.value === 'yes' && detailsId) {
        (input.name === 'usage_drug' ? updateDrugBranches : updateStdBranches)();
        return;
      }
      if (input.value === 'no' && detailsId) {
        (input.name === 'usage_drug' ? updateDrugBranches : updateStdBranches)();
      }
      advance();
      return;
    }

    if (input.type === 'checkbox' && step.matches('.question-group')) return;
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

    if (input.matches('input[list="taiwan-admin-options"]')) {
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
