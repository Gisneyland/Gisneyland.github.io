(function (root, factory) {
  const model = factory();
  if (typeof module === 'object' && module.exports) module.exports = model;
  else root.AdminResponseFormat = model;
})(typeof globalThis === 'object' ? globalThis : this, function () {
  const RESPONSE_DETAIL_GROUPS = [
    { title: '填答者基本資料', fields: ['nickname', 'gender', 'gender_others', 'orientation', 'orientation_others', 'birth', 'nationality', 'hometown', 'hometown_others', 'residence', 'residence_others', 'education'] },
    { title: '同意與過往篩檢', fields: ['agreement', 'needle_consent', 'privacy_consent', 'privacy_notice_version', 'frequency_screening', 'last_screening_at'] },
    { title: '性行為風險', fields: ['frequency_sex', 'frequency_condom', 'frequency_closed_relationship', 'closed_relationship_aids', 'frequency_online_dating', 'frequency_public_dating', 'frequency_sex_service', 'frequency_sex_consumption'] },
    { title: '物質使用', fields: ['frequency_alcohol', 'frequency_drug', 'usage_drug', 'drug_amphetamine', 'drug_amphetamine_inhalant', 'drug_amphetamine_injection', 'drug_amphetamine_oral', 'drug_ghb', 'drug_mdma', 'drug_ketamine', 'drug_rush', 'drug_mephedrone', 'drug_heroin', 'drug_weed', 'drug_other_choice', 'drug_others', 'frequency_drug_now'] },
    { title: '性病與預防措施', fields: ['frequency_std', 'std_aids', 'std_aids_reason', 'std_genital_warts', 'std_syphilis', 'std_chlamydia', 'std_gonorrhea', 'std_genital_herpes', 'std_hepatitis_a', 'std_hepatitis_c', 'std_other_choice', 'std_others', 'frequency_pep', 'frequency_pep_willingness', 'frequency_prep', 'frequency_prep_willingness'] },
    { title: '篩檢結果與陽性轉介', fields: ['screener', 'screening_at', 'screening_place', 'screening_interpretation', 'hiv_window_period', 'anonymous_consult_code', 'hiv_positive_contacts', 'hiv_positive_contact_phone', 'hiv_positive_appointment', 'hiv_positive_address', 'hiv_positive_notes', 'screening_photos'] }
  ];

  const RESPONSE_FIELD_LABELS = {
    nickname: '暱稱', gender: '性別', gender_others: '其他性別', orientation: '性傾向',
    orientation_others: '其他性傾向', birth: '出生年份', nationality: '國籍',
    hometown: '成年前居住地', hometown_others: '其他成年前居住地', residence: '目前居住地',
    residence_others: '其他居住地', education: '教育程度', agreement: '同意篩檢諮詢與陽性轉介',
    needle_consent: '同意針具採血', privacy_consent: '同意個人資料使用',
    privacy_notice_version: '個資告知版本', frequency_screening: '篩檢頻率',
    last_screening_at: '最近一次篩檢日期', frequency_sex: '一年內有性行為',
    frequency_condom: '全程正確使用保險套', frequency_closed_relationship: '僅與固定性伴侶發生性行為',
    closed_relationship_aids: '固定性伴侶為 HIV 感染者', frequency_online_dating: '透過網路認識性伴侶並發生性行為',
    frequency_public_dating: '透過娛樂場所認識性伴侶並發生性行為', frequency_sex_service: '提供性交易服務',
    frequency_sex_consumption: '性消費或買春', frequency_alcohol: '性行為前後飲酒',
    frequency_drug: '性行為前後使用娛樂性藥物', usage_drug: '曾使用成癮藥物',
    drug_amphetamine: '安非他命／甲基安非他命', drug_amphetamine_inhalant: '安非他命使用方式：吸入',
    drug_amphetamine_injection: '安非他命使用方式：注射', drug_amphetamine_oral: '安非他命使用方式：口服',
    drug_ghb: '神仙水（GHB）', drug_mdma: '搖頭丸（MDMA）', drug_ketamine: '愷他命',
    drug_rush: '快樂水（Rush）', drug_mephedrone: '合成卡西酮類物質', drug_heroin: '海洛因',
    drug_weed: '大麻', drug_other_choice: '使用其他成癮藥物', drug_others: '其他成癮藥物內容',
    frequency_drug_now: '目前仍持續使用成癮藥物', frequency_std: '一年內曾感染性病',
    std_aids: '愛滋', std_aids_reason: '再次篩檢原因', std_genital_warts: '菜花（尖形濕疣）',
    std_syphilis: '梅毒', std_chlamydia: '披衣菌', std_gonorrhea: '淋病', std_genital_herpes: '性皰疹',
    std_hepatitis_a: 'A 型肝炎', std_hepatitis_c: 'C 型肝炎', std_other_choice: '其他性病',
    std_others: '其他性病內容', frequency_pep: '使用過 PEP',
    frequency_pep_willingness: '有意願使用 PEP', frequency_prep: '聽過 PrEP',
    frequency_prep_willingness: '有意願使用 PrEP', screener: '篩檢員編號',
    screening_at: '篩檢日期', screening_place: '篩檢地點', screening_interpretation: '篩檢判讀',
    hiv_window_period: 'HIV 空窗期', anonymous_consult_code: '匿名諮詢代碼', hiv_positive_contacts: '陽性轉介聯絡方式', hiv_positive_contact_phone: '陽性轉介聯絡電話',
    hiv_positive_appointment: '預約門診', hiv_positive_address: '就診地址', hiv_positive_notes: '陽性轉介備註',
    screening_photos: '陽性試劑照片'
  };

  const SCREENING_PHOTO_LABELS = { hiv: 'HIV 陽性試劑照片', syphilis: '梅毒陽性試劑照片' };

  const RESPONSE_VALUE_LABELS = {
    gender: { cisman: '順性別男性', transman: '跨性別男性', ciswoman: '順性別女性', transwoman: '跨性別女性', gender_others: '其他（非二元／其他性別認同）', gender_undisclosed: '未提供' },
    orientation: { heterosexual: '異性戀', homosexual: '同性戀', bisexual: '雙性戀', orientation_others: '其他' },
    education: { illiterate: '不識字', primary: '小學', junior_high: '國中', senior_high: '高中', university: '大學', master: '碩士', phd: '博士' },
    frequency_screening: { '-1': '從未篩檢', '0': '偶爾篩檢', '1': '定期篩檢' },
    screening_interpretation: { hiv_positive: 'HIV 陽性', hiv_negative: 'HIV 陰性', syphilis_positive: '梅毒陽性', syphilis_negative: '梅毒陰性' },
    hiv_window_period: { '1_month': '一個月空窗期', '3_months': '三個月空窗期' }
  };

  const RESPONSE_YES_NO_FIELDS = new Set([
    'agreement', 'needle_consent', 'privacy_consent', 'frequency_sex', 'frequency_condom',
    'frequency_closed_relationship', 'closed_relationship_aids', 'frequency_online_dating',
    'frequency_public_dating', 'frequency_sex_service', 'frequency_sex_consumption',
    'frequency_alcohol', 'frequency_drug', 'usage_drug', 'frequency_drug_now', 'frequency_std',
    'std_aids', 'std_genital_warts', 'std_syphilis', 'std_chlamydia', 'std_gonorrhea',
    'std_genital_herpes', 'std_hepatitis_a', 'std_hepatitis_c', 'std_other_choice',
    'frequency_pep', 'frequency_pep_willingness', 'frequency_prep', 'frequency_prep_willingness',
    'drug_amphetamine', 'drug_amphetamine_inhalant', 'drug_amphetamine_injection',
    'drug_amphetamine_oral', 'drug_ghb', 'drug_mdma', 'drug_ketamine', 'drug_rush',
    'drug_mephedrone', 'drug_heroin', 'drug_weed', 'drug_other_choice'
  ]);

  const GENDER_UNDISCLOSED_HINT = '受檢者未提供性別。請在外站先詢問受檢者意願，無法確認時選外站最接近的「其他／不確定」選項；此處僅供外站填寫，本站紀錄與統計仍維持「未提供」，不會被改動。';

  const RESPONSE_CONDITIONAL_GROUPS = [
    { parent: 'gender', children: ['gender_others'], isActive: data => data.gender === 'gender_others' },
    { parent: 'orientation', children: ['orientation_others'], isActive: data => data.orientation === 'orientation_others' },
    { parent: 'hometown', children: ['hometown_others'], isActive: data => String(data.hometown || '').startsWith('其他') },
    { parent: 'residence', children: ['residence_others'], isActive: data => String(data.residence || '').startsWith('其他') },
    { parent: 'frequency_screening', children: ['last_screening_at'], isActive: data => ['0', '1'].includes(String(data.frequency_screening)) },
    { parent: 'frequency_closed_relationship', children: ['closed_relationship_aids'], isActive: data => ['yes', 'no'].includes(data.frequency_closed_relationship) },
    {
      parent: 'usage_drug',
      children: ['drug_amphetamine', 'drug_ghb', 'drug_mdma', 'drug_ketamine', 'drug_rush', 'drug_mephedrone', 'drug_heroin', 'drug_weed', 'drug_other_choice', 'frequency_drug_now'],
      isActive: data => data.usage_drug === 'yes'
    },
    { parent: 'drug_amphetamine', children: ['drug_amphetamine_inhalant', 'drug_amphetamine_injection', 'drug_amphetamine_oral'], isActive: data => data.drug_amphetamine === true },
    { parent: 'drug_other_choice', children: ['drug_others'], isActive: data => data.drug_other_choice === true },
    {
      parent: 'frequency_std',
      children: ['std_aids', 'std_genital_warts', 'std_syphilis', 'std_chlamydia', 'std_gonorrhea', 'std_genital_herpes', 'std_hepatitis_a', 'std_hepatitis_c', 'std_other_choice'],
      isActive: data => data.frequency_std === 'yes'
    },
    { parent: 'std_aids', children: ['std_aids_reason'], isActive: data => data.std_aids === true },
    { parent: 'std_other_choice', children: ['std_others'], isActive: data => data.std_other_choice === true },
    {
      parent: 'screening_interpretation',
      children: ['hiv_window_period'],
      isActive: data => {
        const results = Array.isArray(data.screening_interpretation)
          ? data.screening_interpretation
          : [data.screening_interpretation];
        return results.includes('hiv_positive') || results.includes('hiv_negative');
      }
    },
    {
      parent: 'screening_interpretation',
      children: ['hiv_positive_contacts', 'hiv_positive_contact_phone', 'hiv_positive_appointment', 'hiv_positive_address', 'hiv_positive_notes'],
      isActive: data => (Array.isArray(data.screening_interpretation)
        ? data.screening_interpretation
        : [data.screening_interpretation]).includes('hiv_positive')
    }
  ];

  const RESPONSE_EDIT_SKIP_FIELDS = new Set(['screening_photos', 'hiv_positive_contacts', 'anonymous_consult_code']);
  const RESPONSE_EDIT_INPUT_TYPES = {
    screening_at: 'date', last_screening_at: 'month', hiv_positive_appointment: 'datetime-local', birth: 'number'
  };
  const RESPONSE_EDIT_TEXTAREA_FIELDS = new Set(['hiv_positive_notes']);
  const RESPONSE_BOOLEAN_FIELD_PATTERN = /^(agreement|needle_consent|privacy_consent|std_(?!aids_reason|others)|drug_(?!others)).*/;
  const RESPONSE_EXTRA_OPTIONS = {
    frequency_closed_relationship: { yes: '是', no: '否', none: '沒有固定性伴侶' }
  };

  function formatDate(value) {
    return new Intl.DateTimeFormat('zh-TW', {
      dateStyle: 'medium',
      timeStyle: 'short'
    }).format(new Date(value));
  }

  function hasResponseValue(value) {
    if (Array.isArray(value)) return value.length > 0;
    if (value === null || value === undefined) return false;
    return typeof value !== 'string' || value.trim() !== '';
  }

  function formatResponseValue(key, value) {
    if (key === 'hiv_positive_contacts' && Array.isArray(value)) {
      return value.map(formatReferralContact).filter(Boolean).join('；');
    }
    if (key === 'screening_photos' && value && typeof value === 'object') {
      return Object.keys(value).map(kind => SCREENING_PHOTO_LABELS[kind] || kind).join('、');
    }
    if (Array.isArray(value)) {
      return value.map(item => formatResponseScalar(key, item)).join('、');
    }
    if (typeof value === 'boolean') {
      return value ? '是' : '否';
    }
    return formatResponseScalar(key, value);
  }

  function formatReferralContact(contact) {
    if (!contact || typeof contact !== 'object' || !contact.value) return '';
    const labels = {
      email: 'Mail', line: 'LINE', facebook: 'FB', instagram: 'IG', threads: 'Threads',
      whatsapp: 'WhatsApp', telegram: 'Telegram', address: '通訊地址'
    };
    const phoneLabels = { mobile: '手機', landline: '市話' };
    const label = contact.type === 'phone'
      ? phoneLabels[contact.phone_kind] || '電話'
      : labels[contact.type] || String(contact.type || '其他');
    return `${label}：${contact.value}`;
  }

  function formatResponseScalar(key, value) {
    const stringValue = String(value);
    if (key === 'hiv_positive_appointment' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(stringValue)) {
      const [datePart, timePart] = stringValue.split('T');
      const [year, month, day] = datePart.split('-');
      return `${year}年${Number(month)}月${Number(day)}日 ${timePart}`;
    }
    const fieldLabels = RESPONSE_VALUE_LABELS[key];
    if (fieldLabels && Object.hasOwn(fieldLabels, stringValue)) return fieldLabels[stringValue];
    if (key === 'nationality' && /^[A-Z]{2}$/.test(stringValue)) {
      try {
        return new Intl.DisplayNames(['zh-TW'], { type: 'region' }).of(stringValue) || stringValue;
      } catch {
        return stringValue;
      }
    }
    if (RESPONSE_YES_NO_FIELDS.has(key)) {
      const commonLabels = { yes: '是', no: '否', none: '無', unknown: '不知道', accepted: '已同意' };
      if (Object.hasOwn(commonLabels, stringValue)) return commonLabels[stringValue];
    }
    if (key === 'screening_at' && /^\d{4}-\d{2}-\d{2}$/.test(stringValue)) {
      const [year, month, day] = stringValue.split('-');
      return `${year}年${Number(month)}月${Number(day)}日`;
    }
    if (key === 'last_screening_at' && /^\d{4}-\d{2}$/.test(stringValue)) {
      const [year, month] = stringValue.split('-');
      return `${year}年${Number(month)}月`;
    }
    if (typeof value === 'object' && value !== null) return JSON.stringify(value);
    return stringValue;
  }

  function humanizeFieldName(key) {
    return key.replaceAll('_', ' ').replace(/\b[a-z]/g, letter => letter.toUpperCase());
  }

  function csvCell(value) {
    const text = String(value);
    const safeText = /^[\t\r ]*[=+\-@]/.test(text) ? `'${text}` : text;
    return `"${safeText.replaceAll('"', '""')}"`;
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  return {
    RESPONSE_DETAIL_GROUPS, RESPONSE_FIELD_LABELS, SCREENING_PHOTO_LABELS, RESPONSE_VALUE_LABELS,
    RESPONSE_YES_NO_FIELDS, GENDER_UNDISCLOSED_HINT, RESPONSE_CONDITIONAL_GROUPS,
    RESPONSE_EDIT_SKIP_FIELDS, RESPONSE_EDIT_INPUT_TYPES, RESPONSE_EDIT_TEXTAREA_FIELDS,
    RESPONSE_BOOLEAN_FIELD_PATTERN, RESPONSE_EXTRA_OPTIONS,
    formatDate, hasResponseValue, formatResponseValue, humanizeFieldName, escapeHtml, csvCell
  };
});
