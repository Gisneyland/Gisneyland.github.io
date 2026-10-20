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
const SCREENING_PHOTO_BUCKET = 'screening-test-photos';
const SCREENING_PHOTO_PATH = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/(hiv|syphilis)\.(jpg|png|webp)$/;

const RESPONSE_VALUE_LABELS = {
  gender: { cisman: '順性別男性', transman: '跨性別男性', ciswoman: '順性別女性', transwoman: '跨性別女性', gender_others: '其他' },
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

const STAFF_PRIVACY_NOTICE_VERSION = 'staff-privacy-2026-10-v1';

document.addEventListener('DOMContentLoaded', () => {
  const loginPanel = document.getElementById('admin-login');
  const dashboard = document.getElementById('admin-dashboard');
  const loginForm = document.getElementById('login-form');
  const loginEmailInput = document.getElementById('admin-email');
  const loginPasswordInput = document.getElementById('admin-password');
  const loginPasswordField = document.getElementById('admin-login-password-field');
  const loginOtpField = document.getElementById('admin-login-otp-field');
  const loginOtpInput = document.getElementById('admin-login-otp');
  const loginOtpResendButton = document.getElementById('admin-login-otp-resend');
  const loginModeButtons = [...document.querySelectorAll('[data-admin-login-mode]')];
  const loginSubmitButton = loginForm.querySelector('button[type="submit"]');
  const loginSubmitLabel = document.getElementById('admin-login-submit-label');
  const signupForm = document.getElementById('signup-form');
  const passwordResetForm = document.getElementById('password-reset-form');
  const passwordUpdateForm = document.getElementById('password-update-form');
  const authForms = [loginForm, signupForm, passwordResetForm, passwordUpdateForm];
  const backFromPasswordUpdateButton = document.getElementById('back-from-password-update');
  const loginStatus = document.getElementById('login-status');
  const dashboardStatus = document.getElementById('dashboard-status');
  const staffAccessGate = document.getElementById('staff-access-gate');
  const staffGateTitle = document.getElementById('staff-gate-title');
  const staffGateMessage = document.getElementById('staff-gate-message');
  const acceptStaffPrivacyButton = document.getElementById('accept-staff-privacy');
  const signOutButton = document.getElementById('sign-out-button');
  const openQuestionnaireButton = document.getElementById('open-questionnaire-button');
  const refreshButton = document.getElementById('refresh-button');
  const exportButton = document.getElementById('export-button');
  const adminTabs = [...document.querySelectorAll('.admin-tab')];
  const placeDataElement = document.getElementById('admin-screening-place-data');
  let screeningPlaces = [];
  try {
    screeningPlaces = JSON.parse(placeDataElement?.textContent || '[]');
  } catch {
    screeningPlaces = [];
  }
  screeningPlaces.push(
    {
      name: '尖筆山（竹南鎮）',
      label: '尖筆山（竹南鎮）',
      coordinates: [120.8981701, 24.7216328],
      aliases: ['尖筆山', 'Jianbishan']
    },
    {
      name: '埔頂（新屋區）',
      label: '埔頂（新屋區，位置約略）',
      coordinates: [121.12, 24.96],
      aliases: ['埔頂', 'Puding Village']
    }
  );
  let screeningMap = null;
  let screeningHotspotLayer = null;
  const mapModeControls = [...document.querySelectorAll('input[name="screening-map-mode"]')];
  const screeningRangeStart = document.getElementById('screening-range-start');
  const screeningRangeEnd = document.getElementById('screening-range-end');
  const resetScreeningRangeButton = document.getElementById('reset-screening-range');
  const screeningMapSummary = document.getElementById('screening-map-summary');
  const screeningVolumeLegend = document.getElementById('screening-volume-scale');
  let screeningDateBounds = null;
  let screeningDateRangeInitialized = false;
  const previousPageButton = document.getElementById('previous-page');
  const nextPageButton = document.getElementById('next-page');
  const pageStatus = document.getElementById('page-status');
  const searchInput = document.getElementById('search-responses');
  const nationalitySearch = document.getElementById('nationality-filter-search');
  const nationalityOptions = document.getElementById('nationality-filter-options');
  const selectedNationalityContainer = document.getElementById('nationality-filter-selected');
  const consultationFilter = document.getElementById('consultation-filter');
  const responseBody = document.getElementById('responses-body');
  const emptyState = document.getElementById('empty-state');
  const dialog = document.getElementById('response-dialog');
  const closeDialogButton = document.getElementById('close-dialog-button');
  const responseDetails = document.getElementById('response-details');
  const accountProfileForm = document.getElementById('account-profile-form');
  const accountNicknameInput = document.getElementById('account-nickname');
  const accountEmailInput = document.getElementById('account-email');
  const saveAccountProfileButton = document.getElementById('save-account-profile');
  const accountProfileStatus = document.getElementById('account-profile-status');
  const accountEmailLabel = document.getElementById('admin-account-email');
  const screeningPlanForm = document.getElementById('screening-plan-form');
  const screeningPlanRulesContainer = document.getElementById('screening-plan-rules');
  const screeningPlanRuleTemplate = document.getElementById('screening-plan-rule-template');
  const addScreeningPlanRuleButton = document.getElementById('add-screening-plan-rule');
  const screeningPlanInfoButton = document.getElementById('screening-plan-info-button');
  const screeningPlanInfoDialog = document.getElementById('screening-plan-info-dialog');
  const screeningPlanStatus = document.getElementById('screening-plan-status');
  const screeningPlanNext = document.getElementById('screening-plan-next');
  const screeningPlanWeather = document.getElementById('screening-plan-weather');
  const screeningPlanDisasters = document.getElementById('screening-plan-disasters');
  const screeningPlanAdvice = document.getElementById('screening-plan-advice');
  const refreshScreeningOutlookButton = document.getElementById('refresh-screening-outlook');
  const saveScreeningPlanButton = document.getElementById('save-screening-plan');
  const screenerNumberForm = document.getElementById('screener-number-form');
  const screenerNumberInput = document.getElementById('screener-number-input');
  const screenerNumberStatus = document.getElementById('screener-number-status');
  const saveScreenerNumberButton = document.getElementById('save-screener-number');
  let activeStaffProfile = null;
  let loginMode = 'password';
  let otpSentFor = '';
  let responses = [];
  const selectedNationalities = new Set();
  let currentPage = 1;
  let screenerNumberUserId = null;
  let activeUser = null;
  let savedScreeningPreferences = null;
  let screeningOutlookKey = '';
  let screeningOutlookRequest = 0;
  let screeningOutlookLoadedAt = 0;
  let screeningOutlookPending = false;
  let screeningPlanEditable = false;
  let screeningPlanRuleSequence = 0;
  const weekdayLabels = ['日', '一', '二', '三', '四', '五', '六'];
  const pageSize = 25;

  let screeningPlanPlaces = [];
  try {
    screeningPlanPlaces = JSON.parse(document.getElementById('admin-screening-place-data')?.textContent || '[]')
      .filter(place => Array.isArray(place.coordinates) && place.coordinates.length === 2
        && place.coordinates.every(coordinate => Number.isFinite(Number(coordinate))))
      .map(place => ({
        name: String(place.name || place.label || '').trim(),
        label: String(place.label || place.name || '').trim(),
        aliases: Array.isArray(place.aliases) ? place.aliases.map(alias => String(alias || '').trim()) : [],
        coordinates: place.coordinates.map(Number)
      }))
      .filter(place => place.label);
  } catch {
    screeningPlanPlaces = [];
  }
  const screeningPlanRuleStates = new WeakMap();
  const placeLabel = window.AdminPlaceSearch.label;
  function createScreeningPlanRule(rule = {}) {
    const fragment = screeningPlanRuleTemplate.content.cloneNode(true);
    const row = fragment.querySelector('.screening-plan-rule');
    const frequency = row.querySelector('.screening-plan-rule-frequency');
    const weeklyPanel = row.querySelector('.screening-plan-rule-weekly');
    const monthlyPanel = row.querySelector('.screening-plan-rule-monthly');
    const monthlyOrdinal = row.querySelector('.screening-plan-rule-ordinal');
    const monthlyWeekday = row.querySelector('.screening-plan-rule-monthly-weekday');
    const ruleName = row.querySelector('.screening-plan-rule-name');
    const ruleSummary = row.querySelector('.screening-plan-rule-summary');
    const ruleFields = row.querySelector('.screening-plan-rule-fields');
    const moveUpButton = row.querySelector('.screening-plan-rule-move-up');
    const moveDownButton = row.querySelector('.screening-plan-rule-move-down');
    const collapseButton = row.querySelector('.screening-plan-rule-collapse');
    const placeInput = row.querySelector('.screening-plan-rule-place');
    const options = row.querySelector('.screening-plan-place-options');
    const searchButton = row.querySelector('.screening-plan-rule-search');
    const mapToggle = row.querySelector('.screening-plan-rule-map-toggle');
    const geolocateButton = row.querySelector('.screening-plan-rule-geolocate');
    const mapContainer = row.querySelector('.screening-plan-rule-map');
    const mapCanvas = row.querySelector('.screening-plan-rule-map-canvas');
    const placeStatus = row.querySelector('.screening-plan-rule-place-status');
    ruleName.value = rule.name || '';
    ruleFields.id = `screening-plan-rule-fields-${++screeningPlanRuleSequence}`;
    collapseButton.setAttribute('aria-controls', ruleFields.id);
    const state = {
      place: rule.place || null,
      map: null,
      marker: null,
      searchRequest: null,
      reverseRequest: null,
      revision: 0
    };
    screeningPlanRuleStates.set(row, state);
    const renderRuleSummary = () => {
      const weekdays = [...weeklyPanel.querySelectorAll('input:checked')].map(input => Number(input.value));
      const ordinal = Number(monthlyOrdinal.value);
      const monthlyOrdinalLabel = ordinal === -1 ? '最後一個' : `第 ${ordinal} 個`;
      const monthlyWeekdayLabel = weekdayLabels[Number(monthlyWeekday.value)];
      const cadence = frequency.value === 'weekly'
        ? `每週${weekdays.length ? `・週${weekdays.map(day => weekdayLabels[day]).join('、')}` : '・尚未選星期'}`
        : `每月・${monthlyOrdinalLabel}星期${monthlyWeekdayLabel}`;
      const startTime = row.querySelector('.screening-plan-rule-start').value;
      const endTime = row.querySelector('.screening-plan-rule-end').value;
      const previewPlace = state.place || {
        label: placeInput.value.trim() || '尚未設定地點',
        coordinates: [0, 0]
      };
      const previewRule = {
        frequency: frequency.value,
        weekdays,
        ordinal,
        weekday: Number(monthlyWeekday.value),
        startTime,
        endTime,
        place: previewPlace
      };
      const nextSlot = getNextScreeningSlot({ rules: [previewRule] });
      ruleSummary.replaceChildren();
      const appendPart = (iconName, text) => {
        const part = document.createElement('span');
        part.className = 'screening-plan-rule-summary-part';
        const icon = document.createElement('span');
        icon.className = 'material-icons notranslate';
        icon.setAttribute('translate', 'no');
        icon.setAttribute('aria-hidden', 'true');
        icon.textContent = iconName;
        part.append(icon, document.createTextNode(text));
        ruleSummary.append(part);
      };
      appendPart('repeat', cadence);
      appendPart('event', nextSlot ? `下次 ${nextSlot.dateLabel}` : '日期未設定');
      appendPart('schedule', startTime && endTime ? `${startTime}–${endTime}` : '時間未設定');
      appendPart('place', previewPlace.label);
      ruleSummary.hidden = !ruleFields.hidden;
    };
    frequency.value = rule.frequency === 'monthly' ? 'monthly' : 'weekly';
    weeklyPanel.querySelectorAll('input[type="checkbox"]').forEach(input => {
      input.checked = Array.isArray(rule.weekdays) && rule.weekdays.includes(Number(input.value));
    });
    monthlyOrdinal.value = String(rule.ordinal || 2);
    monthlyWeekday.value = String(Number.isInteger(rule.weekday) ? rule.weekday : 5);
    row.querySelector('.screening-plan-rule-start').value = rule.startTime || '14:00';
    row.querySelector('.screening-plan-rule-end').value = rule.endTime || '16:00';
    placeInput.value = rule.place?.label || '';
    const closeOptions = () => {
      options.hidden = true;
      placeInput.setAttribute('aria-expanded', 'false');
    };
    const showOptions = places => {
      options.replaceChildren();
      places.forEach(place => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'screening-plan-place-option';
        button.setAttribute('role', 'option');
        button.textContent = place.label;
        button.addEventListener('pointerdown', event => event.preventDefault());
        button.addEventListener('click', () => setPlace(place));
        options.append(button);
      });
      options.hidden = places.length === 0;
      placeInput.setAttribute('aria-expanded', String(places.length > 0));
    };
    const matchingLocalPlaces = () => {
      const query = placeInput.value.trim().toLocaleLowerCase().replace(/[\s、,，.-]/g, '');
      return screeningPlanPlaces.filter(place => !query
        || [place.name, place.label, ...place.aliases].some(value =>
          value.toLocaleLowerCase().replace(/[\s、,，.-]/g, '').includes(query)));
    };
    const localOptions = () => showOptions(matchingLocalPlaces());
    const ensureMap = () => {
      if (!window.L) {
        placeStatus.textContent = 'Leaflet 地圖無法載入，仍可輸入地址後儲存。';
        placeStatus.hidden = false;
        return false;
      }
      mapContainer.hidden = false;
      mapToggle.setAttribute('aria-expanded', 'true');
      if (!state.map) {
        const center = state.place?.coordinates
          ? [state.place.coordinates[1], state.place.coordinates[0]]
          : [24.8036, 120.9719];
        state.map = window.L.map(mapCanvas, { scrollWheelZoom: false }).setView(center, 13);
        window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19,
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        }).addTo(state.map);
        state.map.on('click', event => chooseMapPoint(event.latlng.lat, event.latlng.lng));
      }
      window.requestAnimationFrame(() => state.map?.invalidateSize());
      return true;
    };
    const moveMarker = (latitude, longitude) => {
      if (!ensureMap()) return;
      state.map.setView([latitude, longitude], 16);
      if (!state.marker) {
        state.marker = window.L.marker([latitude, longitude], { draggable: true }).addTo(state.map);
        state.marker.on('dragend', () => {
          const point = state.marker.getLatLng();
          chooseMapPoint(point.lat, point.lng);
        });
      } else state.marker.setLatLng([latitude, longitude]);
    };
    const setPlace = place => {
      state.revision += 1;
      state.searchRequest?.abort();
      state.reverseRequest?.abort();
      state.place = { ...place, coordinates: place.coordinates.map(Number) };
      placeInput.value = place.label;
      closeOptions();
      if (state.place.coordinates?.length === 2) moveMarker(state.place.coordinates[1], state.place.coordinates[0]);
      placeStatus.textContent = `已選位置：${place.label}`;
      placeStatus.hidden = false;
      renderRuleSummary();
    };
    const chooseMapPoint = async (latitude, longitude) => {
      state.revision += 1;
      const revision = state.revision;
      state.searchRequest?.abort();
      state.reverseRequest?.abort();
      moveMarker(latitude, longitude);
      const coordinates = [longitude, latitude];
      const coordinateLabel = `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
      state.place = { name: '地圖選點', label: coordinateLabel, coordinates };
      placeInput.value = coordinateLabel;
      placeStatus.textContent = '已標記位置，正在查詢地址…';
      placeStatus.hidden = false;
      const request = new AbortController();
      state.reverseRequest = request;
      try {
        const [feature] = await window.AdminPlaceSearch.reverse(latitude, longitude, { signal: request.signal });
        const label = feature && placeLabel(feature);
        if (revision !== state.revision) return;
        if (label) {
          state.place = { name: feature.properties?.name || label, label, coordinates };
          placeInput.value = label;
          placeStatus.textContent = `已選位置：${label}`;
        } else placeStatus.textContent = `已標記座標：${coordinateLabel}`;
        renderRuleSummary();
      } catch {
        if (revision === state.revision) placeStatus.textContent = `地址查詢未完成，已保留座標：${coordinateLabel}`;
      }
    };
    const searchPlace = async () => {
      const query = placeInput.value.trim();
      if (!query) {
        placeStatus.textContent = '請先輸入地點名稱或地址。';
        placeStatus.hidden = false;
        placeInput.focus();
        return;
      }
      state.searchRequest?.abort();
      closeOptions();
      const request = new AbortController();
      state.searchRequest = request;
      searchButton.disabled = true;
      placeStatus.textContent = '正在搜尋地點…';
      placeStatus.hidden = false;
      const localPlaces = matchingLocalPlaces();
      try {
        const features = await window.AdminPlaceSearch.search(query, { signal: request.signal });
        if (state.searchRequest !== request || request.signal.aborted) return;
        const remotePlaces = features
          .map(feature => ({
            name: feature.properties?.name || query,
            label: placeLabel(feature) || query,
            coordinates: feature.geometry.coordinates.map(Number)
          }))
          .filter(place => place.coordinates.length === 2 && place.coordinates.every(Number.isFinite));
        const places = [...localPlaces, ...remotePlaces].filter((place, index, all) =>
          all.findIndex(other => other.label === place.label) === index);
        ensureMap();
        showOptions(places);
        placeStatus.textContent = places.length
          ? `找到 ${places.length} 個地點，請選擇結果或在地圖上點選。`
          : '找不到搜尋結果，可直接在地圖上點選位置。';
        if (!places.length) closeOptions();
      } catch {
        if (state.searchRequest === request && !request.signal.aborted) {
          ensureMap();
          showOptions(localPlaces);
          placeStatus.textContent = localPlaces.length
            ? '線上搜尋暫時無法使用，可選擇常用地點或在地圖上點選位置。'
            : '搜尋服務暫時無法使用，可在地圖上點選位置。';
        }
      } finally {
        if (state.searchRequest === request) searchButton.disabled = !screeningPlanEditable;
      }
    };
    frequency.addEventListener('change', () => {
      weeklyPanel.hidden = frequency.value !== 'weekly';
      monthlyPanel.hidden = frequency.value !== 'monthly';
      renderRuleSummary();
    });
    collapseButton.addEventListener('click', () => {
      const expanded = collapseButton.getAttribute('aria-expanded') === 'true';
      collapseButton.setAttribute('aria-expanded', String(!expanded));
      collapseButton.setAttribute('aria-label', expanded ? '展開此安排' : '收合此安排');
      collapseButton.title = expanded ? '展開此安排' : '收合此安排';
      collapseButton.querySelector('.material-icons').textContent = expanded ? 'expand_more' : 'expand_less';
      ruleFields.hidden = expanded;
      ruleSummary.hidden = !expanded;
      if (expanded) renderRuleSummary();
      if (!expanded) state.map && window.requestAnimationFrame(() => state.map.invalidateSize());
    });
    moveUpButton.addEventListener('click', () => {
      const previous = row.previousElementSibling;
      if (!previous) return;
      screeningPlanRulesContainer.insertBefore(row, previous);
      updateScreeningPlanRuleNumbers();
      row.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    });
    moveDownButton.addEventListener('click', () => {
      const next = row.nextElementSibling;
      if (!next) return;
      screeningPlanRulesContainer.insertBefore(next, row);
      updateScreeningPlanRuleNumbers();
      row.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    });
    frequency.dispatchEvent(new Event('change'));
    placeInput.addEventListener('focus', localOptions);
    placeInput.addEventListener('input', () => {
      state.revision += 1;
      state.place = null;
      state.searchRequest?.abort();
      state.searchRequest = null;
      searchButton.disabled = !screeningPlanEditable;
      state.reverseRequest?.abort();
      localOptions();
      renderRuleSummary();
    });
    row.querySelectorAll('.screening-plan-rule-fields input, .screening-plan-rule-fields select').forEach(control => {
      control.addEventListener('input', renderRuleSummary);
      control.addEventListener('change', renderRuleSummary);
    });
    placeInput.addEventListener('keydown', event => {
      if (event.key === 'ArrowDown' && !options.hidden) {
        event.preventDefault();
        options.querySelector('button')?.focus();
      } else if (event.key === 'Enter') {
        event.preventDefault();
        searchPlace();
      } else if (event.key === 'Escape') closeOptions();
    });
    options.addEventListener('keydown', event => {
      const buttons = [...options.querySelectorAll('button')];
      const index = buttons.indexOf(document.activeElement);
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        buttons[Math.max(0, Math.min(buttons.length - 1, index + (event.key === 'ArrowDown' ? 1 : -1)))]?.focus();
      } else if (event.key === 'Escape') {
        closeOptions();
        placeInput.focus();
      }
    });
    row.querySelector('.screening-plan-rule-search').addEventListener('click', searchPlace);
    row.querySelector('.screening-plan-rule-map-toggle').addEventListener('click', () => {
      const toggle = row.querySelector('.screening-plan-rule-map-toggle');
      const shouldOpen = mapContainer.hidden;
      if (shouldOpen) ensureMap();
      else mapContainer.hidden = true;
      toggle.setAttribute('aria-expanded', String(shouldOpen));
      if (shouldOpen && state.place?.coordinates) moveMarker(state.place.coordinates[1], state.place.coordinates[0]);
    });
    row.querySelector('.screening-plan-rule-geolocate').addEventListener('click', () => {
      if (!navigator.geolocation) {
        placeStatus.textContent = '此瀏覽器不支援目前位置定位。';
        placeStatus.hidden = false;
        return;
      }
      const button = row.querySelector('.screening-plan-rule-geolocate');
      button.disabled = true;
      placeStatus.textContent = '正在取得目前位置…';
      placeStatus.hidden = false;
      navigator.geolocation.getCurrentPosition(position => {
        button.disabled = !screeningPlanEditable;
        ensureMap();
        chooseMapPoint(position.coords.latitude, position.coords.longitude);
      }, () => {
        button.disabled = !screeningPlanEditable;
        placeStatus.textContent = '無法取得目前位置；請確認瀏覽器定位權限，或在地圖上選點。';
      }, { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 });
    });
    row.querySelector('.screening-plan-rule-remove').addEventListener('click', () => {
      state.searchRequest?.abort();
      state.reverseRequest?.abort();
      state.map?.remove();
      row.remove();
      updateScreeningPlanRuleNumbers();
    });
    row.querySelectorAll('input, select, button').forEach(control => {
      if (control.classList.contains('screening-plan-rule-remove')) return;
      control.disabled = !screeningPlanEditable;
    });
    row.querySelector('.screening-plan-rule-monthly').hidden = frequency.value !== 'monthly';
    row.querySelector('.screening-plan-rule-weekly').hidden = frequency.value !== 'weekly';
    ruleSummary.hidden = true;
    screeningPlanRulesContainer.append(row);
    renderRuleSummary();
    updateScreeningPlanRuleNumbers();
    return row;
  }
  function updateScreeningPlanRuleNumbers() {
    [...screeningPlanRulesContainer.children].forEach((row, index) => {
      row.querySelector('.screening-plan-rule-name').placeholder = '自訂名稱（選填）';
      row.querySelector('.screening-plan-rule-name').setAttribute('aria-label', `安排 ${index + 1} 名稱`);
      row.querySelector('.screening-plan-rule-move-up').disabled = !screeningPlanEditable || index === 0;
      row.querySelector('.screening-plan-rule-move-down').disabled = !screeningPlanEditable
        || index === screeningPlanRulesContainer.children.length - 1;
    });
    addScreeningPlanRuleButton.disabled = !screeningPlanEditable || screeningPlanRulesContainer.children.length >= 16;
  }
  addScreeningPlanRuleButton.addEventListener('click', () => {
    const row = createScreeningPlanRule();
    row.querySelector('.screening-plan-rule-name').focus();
    row.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  });
    function closeScreeningPlanPlaceOptions(event) {
      if (event?.target?.closest('.screening-plan-place-picker')) return;
      screeningPlanRulesContainer.querySelectorAll('.screening-plan-place-options').forEach(options => {
        options.hidden = true;
        options.closest('.screening-plan-rule')?.querySelector('.screening-plan-rule-place')?.setAttribute('aria-expanded', 'false');
      });
    }
    document.addEventListener('pointerdown', closeScreeningPlanPlaceOptions);

    renderScreeningVolumeLegend();

    if (!window.questionnaireSupabase) {
      showStatus(loginStatus, '資料服務尚未設定，請聯絡系統管理員。', true);
      loginSubmitButton.disabled = true;
      return;
    }

    function updateLoginMode() {
      const usingOtp = loginMode === 'otp';
      const otpReady = usingOtp && otpSentFor !== '' && otpSentFor === loginEmailInput.value.trim();
      loginPasswordField.hidden = usingOtp;
      loginPasswordInput.required = !usingOtp;
      loginOtpField.hidden = !otpReady;
      loginOtpInput.required = otpReady;
      loginOtpResendButton.hidden = !otpReady;
      loginModeButtons.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.adminLoginMode === loginMode)));
      loginSubmitLabel.textContent = loginMode === 'password' ? '登入後台' : otpReady ? '驗證並登入' : '寄送驗證碼';
    }

    loginModeButtons.forEach(button => button.addEventListener('click', () => {
      loginMode = button.dataset.adminLoginMode;
      loginStatus.hidden = true;
      updateLoginMode();
    }));
    loginEmailInput.addEventListener('input', () => {
      if (otpSentFor && otpSentFor !== loginEmailInput.value.trim()) {
        otpSentFor = '';
        loginOtpInput.value = '';
        updateLoginMode();
      }
    });

    async function sendLoginOtp() {
      const email = loginEmailInput.value.trim();
      if (!loginEmailInput.reportValidity()) return false;
      const { error } = await window.StaffAccess.requestEmailOtp(
        window.questionnaireSupabase,
        email,
        getAdminRedirectUrl()
      );
      if (error) {
        showStatus(loginStatus, window.StaffAccess.otpErrorMessage(error), true);
        return false;
      }
      otpSentFor = email;
      loginOtpInput.value = '';
      updateLoginMode();
      showStatus(loginStatus, `驗證碼已寄至 ${email}，請查看收件匣與垃圾郵件。`);
      return true;
    }
  loginOtpResendButton.addEventListener('click', async () => {
    loginOtpResendButton.disabled = true;
    try {
      await sendLoginOtp();
    } catch {
      showStatus(loginStatus, '目前無法寄送驗證碼，請稍後重試。', true);
    } finally {
      loginOtpResendButton.disabled = false;
    }
  });
  updateLoginMode();

  loginForm.addEventListener('submit', async event => {
    event.preventDefault();
    if (!loginForm.reportValidity()) return;
    const formData = new FormData(loginForm);
    const email = String(formData.get('email') || '').trim();
    setButtonBusy(loginSubmitButton, true, loginMode === 'otp' ? '驗證中' : '登入中');
    showStatus(loginStatus, loginMode === 'otp' ? '正在處理信箱驗證。' : '登入中，請稍候。');

    let error;
    if (loginMode === 'otp' && (!otpSentFor || otpSentFor !== email)) {
      try {
        await sendLoginOtp();
      } catch {
        showStatus(loginStatus, '目前無法寄送驗證碼，請稍後重試。', true);
      } finally {
        setButtonBusy(loginSubmitButton, false, loginMode === 'otp' ? '寄送驗證碼' : '登入後台');
        updateLoginMode();
      }
      return;
    }

    if (loginMode === 'otp') {
      ({ error } = await window.StaffAccess.verifyEmailOtp(window.questionnaireSupabase, email, loginOtpInput.value));
    } else {
      ({ error } = await window.questionnaireSupabase.auth.signInWithPassword({
        email,
        password: formData.get('password')
      }));
    }

    setButtonBusy(loginSubmitButton, false, loginMode === 'otp' ? '驗證並登入' : '登入後台');
    if (error) {
      showStatus(loginStatus, loginMode === 'otp'
        ? window.StaffAccess.otpErrorMessage(error, true)
        : '登入失敗，請確認帳號與密碼。', true);
      return;
    }

    loginPasswordInput.value = '';
    loginOtpInput.value = '';
    await loadSession();
  });

  document.getElementById('show-signup').addEventListener('click', () => showAuthForm(signupForm));
  const searchParams = new URLSearchParams(window.location.search);
  const openSignupAfterLoad = searchParams.get('signup') === '1';
  if (openSignupAfterLoad) {
    searchParams.delete('signup');
    const cleanUrl = new URL(window.location.href);
    cleanUrl.search = searchParams.toString();
    window.history.replaceState(null, '', cleanUrl);
  }
  document.getElementById('show-password-reset').addEventListener('click', () => {
    document.getElementById('reset-email').value = document.getElementById('admin-email').value;
    showAuthForm(passwordResetForm);
  });
  document.querySelectorAll('[data-back-to-login]').forEach(button => {
    button.addEventListener('click', () => showAuthForm(loginForm));
  });
  backFromPasswordUpdateButton.addEventListener('click', async () => {
    await window.questionnaireSupabase.auth.signOut();
    showAuthForm(loginForm);
  });

  signupForm.addEventListener('submit', async event => {
    event.preventDefault();
    const formData = new FormData(signupForm);
    const password = formData.get('password');
    if (password !== formData.get('password-confirm')) {
      showStatus(loginStatus, '兩次輸入的密碼不一致。', true);
      return;
    }

    const submitButton = signupForm.querySelector('button[type="submit"]');
    setButtonBusy(submitButton, true, '送出中');
    const { data, error } = await window.questionnaireSupabase.auth.signUp({
      email: formData.get('email'),
      password,
      options: {
        emailRedirectTo: getAdminRedirectUrl(),
        data: {
          nickname: formData.get('nickname'),
          full_name: formData.get('full_name'),
          phone: formData.get('phone'),
          privacy_consent: true,
          privacy_notice_version: STAFF_PRIVACY_NOTICE_VERSION
        }
      }
    });
    setButtonBusy(submitButton, false, '送出帳號申請');
    if (error) {
      showStatus(loginStatus, window.StaffAccess.signupErrorMessage(error), true);
      return;
    }

    signupForm.reset();
    if (data.session) {
      await loadSession();
    } else {
      showAuthForm(loginForm);
      showStatus(loginStatus, '申請已送出。請依電子郵件完成驗證，並等待管理員核准。');
    }
  });

  passwordResetForm.addEventListener('submit', async event => {
    event.preventDefault();
    const submitButton = passwordResetForm.querySelector('button[type="submit"]');
    setButtonBusy(submitButton, true, '寄送中');
    const { error } = await window.questionnaireSupabase.auth.resetPasswordForEmail(
      new FormData(passwordResetForm).get('email'),
      { redirectTo: getAdminRedirectUrl() }
    );
    setButtonBusy(submitButton, false, '寄送重設連結');
    if (error) {
      showStatus(loginStatus, '目前無法寄送重設連結，請稍後再試或聯絡管理員。', true);
      return;
    }

    showStatus(loginStatus, '若此電子郵件已註冊，您將收到密碼重設連結。請檢查收件匣與垃圾郵件。');
  });

  passwordUpdateForm.addEventListener('submit', async event => {
    event.preventDefault();
    const formData = new FormData(passwordUpdateForm);
    const password = formData.get('password');
    if (password !== formData.get('password-confirm')) {
      showStatus(loginStatus, '兩次輸入的密碼不一致。', true);
      return;
    }

    const submitButton = passwordUpdateForm.querySelector('button[type="submit"]');
    setButtonBusy(submitButton, true, '更新中');
    const { error } = await window.questionnaireSupabase.auth.updateUser({ password });
    setButtonBusy(submitButton, false, '更新密碼');
    if (error) {
      showStatus(loginStatus, '密碼更新失敗，請重新開啟重設連結後再試。', true);
      return;
    }

    passwordUpdateForm.reset();
    const cleanUrl = new URL(window.location.href);
    cleanUrl.hash = '';
    cleanUrl.searchParams.delete('type');
    window.history.replaceState(null, '', cleanUrl);
    await loadSession();
    if (!dashboard.hidden) {
      showStatus(dashboardStatus, '密碼已更新。');
    }
  });

  signOutButton.addEventListener('click', async () => {
    await window.questionnaireSupabase.auth.signOut();
    showLogin();
  });

  acceptStaffPrivacyButton.addEventListener('click', async () => {
    acceptStaffPrivacyButton.disabled = true;
    const { error } = await window.questionnaireSupabase.rpc('accept_staff_privacy_notice', {
      notice_version: STAFF_PRIVACY_NOTICE_VERSION
    });
    acceptStaffPrivacyButton.disabled = false;
    if (error) {
      staffGateMessage.textContent = '同意紀錄無法儲存，請稍後重試或聯絡管理員。';
      return;
    }
    await loadSession();
  });
  document.addEventListener('staff-profile-refresh', loadSession);

  refreshButton.addEventListener('click', loadResponses);
  exportButton.addEventListener('click', exportResponses);
  adminTabs.forEach(tab => {
    tab.addEventListener('click', () => selectAdminTab(tab));
    tab.addEventListener('keydown', event => {
      const availableTabs = adminTabs.filter(item => !item.hidden && !item.disabled);
      const currentIndex = availableTabs.indexOf(tab);
      let nextIndex;

      if (event.key === 'ArrowRight') nextIndex = (currentIndex + 1) % availableTabs.length;
      else if (event.key === 'ArrowLeft') nextIndex = (currentIndex - 1 + availableTabs.length) % availableTabs.length;
      else if (event.key === 'Home') nextIndex = 0;
      else if (event.key === 'End') nextIndex = availableTabs.length - 1;
      else return;

      event.preventDefault();
      const nextTab = availableTabs[nextIndex];
      selectAdminTab(nextTab);
      nextTab.focus();
    });
  });
  previousPageButton.addEventListener('click', () => changePage(-1));
  nextPageButton.addEventListener('click', () => changePage(1));
  searchInput.addEventListener('input', () => { currentPage = 1; renderResponses(); });
  nationalitySearch.addEventListener('input', filterNationalityOptions);
  nationalityOptions.addEventListener('change', event => {
    const checkbox = event.target;
    if (!checkbox.matches('input[data-nationality-option]')) return;
    if (checkbox.checked) selectedNationalities.add(checkbox.value);
    else selectedNationalities.delete(checkbox.value);
    renderSelectedNationalities();
    currentPage = 1;
    renderResponses();
  });
  selectedNationalityContainer.addEventListener('click', event => {
    const removeButton = event.target.closest('[data-remove-nationality]');
    if (!removeButton) return;
    selectedNationalities.delete(removeButton.dataset.removeNationality);
    const checkbox = [...nationalityOptions.querySelectorAll('input[data-nationality-option]')]
      .find(option => option.value === removeButton.dataset.removeNationality);
    if (checkbox) checkbox.checked = false;
    renderSelectedNationalities();
    currentPage = 1;
    renderResponses();
  });
  consultationFilter.addEventListener('change', () => { currentPage = 1; loadResponses(); });
  mapModeControls.forEach(control => control.addEventListener('change', () => {
    renderScreeningAnalytics(getFilteredResponses());
  }));
  [screeningRangeStart, screeningRangeEnd].forEach(input => {
    input.addEventListener('change', () => renderScreeningAnalytics(getFilteredResponses()));
  });
  resetScreeningRangeButton.addEventListener('click', () => {
    resetScreeningDateRange();
    renderScreeningAnalytics(getFilteredResponses());
  });
  closeDialogButton.addEventListener('click', () => dialog.close());
  accountProfileForm.addEventListener('submit', saveAccountProfile);
  screeningPlanForm.addEventListener('submit', saveScreeningPlan);
  screeningPlanInfoButton.addEventListener('click', () => screeningPlanInfoDialog.showModal());
  screeningPlanInfoDialog.querySelectorAll('[data-close-screening-plan-info]').forEach(button => {
    button.addEventListener('click', () => screeningPlanInfoDialog.close());
  });
  screeningPlanInfoDialog.addEventListener('click', event => {
    if (event.target === screeningPlanInfoDialog) screeningPlanInfoDialog.close();
  });
  refreshScreeningOutlookButton.addEventListener('click', () => refreshScreeningPlanOutlook(true));
  screenerNumberForm.addEventListener('submit', saveScreenerNumber);
  dialog.addEventListener('click', event => {
    if (event.target === dialog) {
      dialog.close();
    }
  });

  window.questionnaireSupabase.auth.onAuthStateChange(event => {
    if (event === 'PASSWORD_RECOVERY') {
      showAuthForm(passwordUpdateForm);
      backFromPasswordUpdateButton.hidden = false;
    }
  });

  loadSession();

  function selectAdminTab(selectedTab) {
    if (selectedTab.hidden || selectedTab.disabled) return;

    adminTabs.forEach(tab => {
      const isSelected = tab === selectedTab;
      tab.setAttribute('aria-selected', String(isSelected));
      tab.tabIndex = isSelected ? 0 : -1;
      document.getElementById(tab.getAttribute('aria-controls')).hidden = !isSelected;
    });
    if (selectedTab.id === 'admin-tab-questionnaire') {
      window.requestAnimationFrame(() => screeningMap?.invalidateSize());
    }
    if (selectedTab.id === 'admin-tab-settings') refreshScreeningPlanOutlook();
  }

  async function loadSession() {
    if (isPasswordRecovery()) {
      showAuthForm(passwordUpdateForm);
      backFromPasswordUpdateButton.hidden = false;
      return;
    }
    const { data } = await window.questionnaireSupabase.auth.getSession();
    if (!data.session) {
      document.dispatchEvent(new CustomEvent('staff-profile-ready', { detail: null }));
      showLogin();
      if (openSignupAfterLoad) showAuthForm(signupForm);
      return;
    }

    const { data: profile, error } = await window.questionnaireSupabase
      .from('admin_profiles')
      .select('user_id, nickname, approval_status, account_role, permissions, privacy_consent_at, privacy_notice_version')
      .eq('user_id', data.session.user.id)
      .maybeSingle();

    if (error || !profile) {
      document.dispatchEvent(new CustomEvent('staff-profile-ready', { detail: null }));
      await window.questionnaireSupabase.auth.signOut();
      showLogin();
      showStatus(loginStatus, '無法確認工作人員申請資料，請聯絡管理員。', true);
      return;
    }

    showDashboard(data.session, profile);
    document.dispatchEvent(new CustomEvent('staff-profile-ready', { detail: profile }));
    if (profile.approval_status !== 'approved' || !profile.privacy_consent_at) return;
    await loadScreenerNumber(data.session);
    if (window.StaffAccess.canAccess(profile, 'questionnaire.read')) await loadResponses();
  }

  function showAuthForm(activeForm) {
    authForms.forEach(form => { form.hidden = form !== activeForm; });
    document.getElementById('show-signup').hidden = activeForm !== loginForm;
    document.getElementById('show-password-reset').hidden = activeForm !== loginForm;
    backFromPasswordUpdateButton.hidden = activeForm !== passwordUpdateForm;
    loginStatus.hidden = true;
    loginStatus.textContent = '';
  }

  function getAdminRedirectUrl() {
    return `${window.location.origin}${window.location.pathname}`;
  }

  function isPasswordRecovery() {
    const hashParams = new URLSearchParams(window.location.hash.slice(1));
    const searchParams = new URLSearchParams(window.location.search);
    return hashParams.get('type') === 'recovery' || searchParams.get('type') === 'recovery';
  }

  function showDashboard(session, profile) {
    activeStaffProfile = profile;
    loginPanel.hidden = true;
    dashboard.hidden = false;
    signOutButton.hidden = false;
    openQuestionnaireButton.hidden = false;
    activeUser = session.user;
    const pendingEmail = activeUser.new_email || '';
    accountNicknameInput.value = profile.nickname || activeUser.user_metadata?.nickname || '';
    accountEmailInput.value = pendingEmail || activeUser.email || '';
    accountNicknameInput.disabled = false;
    accountEmailInput.disabled = false;
    saveAccountProfileButton.disabled = false;
    accountEmailLabel.textContent = activeUser.email
      ? `目前登入：${activeUser.email}${pendingEmail ? `（待確認：${pendingEmail}）` : ''}`
      : '已登入管理員';
    accountProfileStatus.hidden = true;
    loadScreeningPlan(activeUser, profile.approval_status === 'approved' && Boolean(profile.privacy_consent_at));

    const hasConsent = Boolean(profile.privacy_consent_at);
    const isApproved = profile.approval_status === 'approved';
    const canRead = isApproved && hasConsent && window.StaffAccess.canAccess(profile, 'questionnaire.read');
    const canManageContent = isApproved && hasConsent && window.StaffAccess.canAccess(profile, 'site_content.manage');
    const canManageStaff = isApproved && hasConsent && window.StaffAccess.canAccess(profile, 'staff.manage');
    const access = new Map([
      ['admin-tab-questionnaire', canRead],
      ['admin-tab-content', canManageContent],
      ['admin-tab-settings', isApproved && hasConsent]
    ]);
    adminTabs.forEach(tab => { tab.hidden = !access.get(tab.id); });

    acceptStaffPrivacyButton.hidden = hasConsent;
    staffAccessGate.hidden = isApproved && hasConsent;
    if (!hasConsent) {
      staffGateTitle.textContent = '請先閱讀員工帳號個資告知';
      staffGateMessage.textContent = '同意後才能繼續使用工作人員帳號。';
    } else if (!isApproved) {
      const statusMessage = {
        pending: '帳號申請尚待管理員審核。核准前無法使用後台功能。',
        rejected: '帳號申請未獲核准。如需了解原因，請聯絡系統管理員。',
        suspended: '此帳號目前已停用。如需協助，請聯絡系統管理員。'
      };
      staffGateTitle.textContent = '工作人員帳號狀態';
      staffGateMessage.textContent = statusMessage[profile.approval_status] || '此帳號目前無法使用後台。';
    }

    if (!isApproved || !hasConsent) {
      adminTabs.forEach(tab => {
        const panel = document.getElementById(tab.getAttribute('aria-controls'));
        if (panel) panel.hidden = true;
      });
      return;
    }

    const selected = adminTabs.find(tab => !tab.hidden && tab.id === 'admin-tab-questionnaire')
      || adminTabs.find(tab => !tab.hidden);
    if (selected) selectAdminTab(selected);
    if (!canRead) showStatus(dashboardStatus, canManageStaff ? '你可以從「設定」管理工作人員帳號與權限。' : '帳號已核准，請聯絡管理員設定後台權限。');
  }

  async function saveAccountProfile(event) {
    event.preventDefault();
    if (!activeUser) return;

    const nickname = accountNicknameInput.value.trim();
    const email = accountEmailInput.value.trim();
    accountNicknameInput.value = nickname;
    accountEmailInput.value = email;
    if (!accountEmailInput.reportValidity()) return;

    const currentNickname = activeStaffProfile.nickname || activeUser.user_metadata?.nickname || '';
    const currentEmail = activeUser.new_email || activeUser.email || '';
    const nicknameChanged = nickname !== currentNickname;
    const emailChanged = email !== currentEmail;
    const updates = {};
    if (nicknameChanged) updates.data = { nickname };
    if (emailChanged) updates.email = email;
    if (!Object.keys(updates).length) {
      showStatus(accountProfileStatus, '帳號資料沒有變更。');
      return;
    }

    setButtonBusy(saveAccountProfileButton, true, '儲存中');
    const { data, error } = await window.questionnaireSupabase.auth.updateUser(updates, {
      emailRedirectTo: getAdminRedirectUrl()
    });
    if (error) {
      setButtonBusy(saveAccountProfileButton, false, '儲存帳號資料');
      showStatus(accountProfileStatus, '帳號資料更新失敗，請確認信箱格式或稍後再試。', true);
      return;
    }

    activeUser = data.user || activeUser;
    if (updates.data) {
      activeUser.user_metadata = { ...activeUser.user_metadata, nickname };
    }
    if (emailChanged && !activeUser.new_email) {
      activeUser.new_email = email;
    }
    if (nicknameChanged) {
      const { data: profileData, error: profileError } = await window.questionnaireSupabase
        .from('admin_profiles')
        .update({ nickname })
        .eq('user_id', activeUser.id)
        .select('nickname')
        .maybeSingle();
      if (profileError || !profileData) {
        setButtonBusy(saveAccountProfileButton, false, '儲存帳號資料');
        showStatus(accountProfileStatus, '登入資料已更新，但暱稱同步失敗，請重新整理後再試。', true);
        return;
      }
      activeStaffProfile = { ...activeStaffProfile, nickname: profileData.nickname };
    }
    setButtonBusy(saveAccountProfileButton, false, '儲存帳號資料');
    accountNicknameInput.value = activeUser.user_metadata?.nickname || nickname;
    accountEmailInput.value = activeUser.new_email || activeUser.email || email;
    accountEmailLabel.textContent = activeUser.email
      ? `目前登入：${activeUser.email}${activeUser.new_email ? `（待確認：${activeUser.new_email}）` : ''}`
      : '已登入管理員';
    showStatus(accountProfileStatus, emailChanged
      ? `${nicknameChanged ? '暱稱已更新。' : ''}信箱變更已送出，請依確認信完成驗證後生效。`
      : '暱稱已更新。');
  }

  function setScreeningPlanDisabled(disabled) {
    screeningPlanEditable = !disabled;
    addScreeningPlanRuleButton.disabled = disabled || screeningPlanRulesContainer.children.length >= 16;
    screeningPlanRulesContainer.querySelectorAll('input, select, button').forEach(control => {
      control.disabled = disabled;
    });
    updateScreeningPlanRuleNumbers();
    saveScreeningPlanButton.disabled = disabled;
    refreshScreeningOutlookButton.disabled = disabled;
  }

  function loadScreeningPlan(user, canEdit) {
    const stored = user.user_metadata?.screening_preferences || {};
    const rules = Array.isArray(stored.rules)
      ? stored.rules
      : stored.place && Array.isArray(stored.weekdays)
        ? [{
          frequency: 'weekly',
          weekdays: stored.weekdays,
          place: stored.place,
          startTime: stored.startTime,
          endTime: stored.endTime
        }]
        : [];
    [...screeningPlanRulesContainer.children].forEach(row => screeningPlanRuleStates.get(row)?.map?.remove());
    screeningPlanRulesContainer.replaceChildren();
    savedScreeningPreferences = { version: 2, rules };
    screeningPlanEditable = canEdit;
    if (Array.isArray(stored.rules) || rules.length) rules.forEach(rule => createScreeningPlanRule(rule));
    else createScreeningPlanRule();
    setScreeningPlanDisabled(!canEdit);
    screeningPlanOutlookKey = '';
    renderNextScreeningSlot(savedScreeningPreferences);
  }

  function findScreeningPlanConflict(rules) {
    const now = getTaipeiParts();
    const today = Date.UTC(Number(now.year), Number(now.month) - 1, Number(now.day));
    const currentMinutes = Number(now.hour) * 60 + Number(now.minute);
    const matchesDate = (rule, date) => {
      const weekday = date.getUTCDay();
      if (rule.frequency === 'weekly') return rule.weekdays.includes(weekday);
      if (rule.frequency !== 'monthly' || Number(rule.weekday) !== weekday) return false;
      const day = date.getUTCDate();
      const monthEnd = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
      return Number(rule.ordinal) === -1
        ? day + 7 > monthEnd
        : Math.floor((day - 1) / 7) + 1 === Number(rule.ordinal);
    };
    for (let offset = 0; offset <= 366; offset += 1) {
      const date = new Date(today + offset * 86400000);
      const active = rules.map((rule, index) => ({ rule, index }))
        .filter(({ rule }) => matchesDate(rule, date))
        .filter(({ rule }) => offset > 0
          || Number(rule.endTime.slice(0, 2)) * 60 + Number(rule.endTime.slice(3, 5)) > currentMinutes);
      for (let leftIndex = 0; leftIndex < active.length; leftIndex += 1) {
        const left = active[leftIndex];
        const leftStart = Number(left.rule.startTime.slice(0, 2)) * 60 + Number(left.rule.startTime.slice(3, 5));
        const leftEnd = Number(left.rule.endTime.slice(0, 2)) * 60 + Number(left.rule.endTime.slice(3, 5));
        for (let rightIndex = leftIndex + 1; rightIndex < active.length; rightIndex += 1) {
          const right = active[rightIndex];
          const rightStart = Number(right.rule.startTime.slice(0, 2)) * 60 + Number(right.rule.startTime.slice(3, 5));
          const rightEnd = Number(right.rule.endTime.slice(0, 2)) * 60 + Number(right.rule.endTime.slice(3, 5));
          const overlaps = Math.max(leftStart, rightStart) < Math.min(leftEnd, rightEnd);
          if (!overlaps) continue;
          const leftCoordinates = left.rule.place.coordinates;
          const rightCoordinates = right.rule.place.coordinates;
          const samePlace = left.rule.place.label === right.rule.place.label
            && leftCoordinates.length === rightCoordinates.length
            && leftCoordinates.every((coordinate, index) => Math.abs(coordinate - rightCoordinates[index]) < 0.00001);
          if (samePlace) continue;
          const year = date.getUTCFullYear();
          return {
            dateLabel: new Intl.DateTimeFormat('zh-TW', {
              timeZone: 'UTC', month: 'long', day: 'numeric'
            }).format(new Date(Date.UTC(year, date.getUTCMonth(), date.getUTCDate(), 12))),
            startTime: `${String(Math.floor(Math.max(leftStart, rightStart) / 60)).padStart(2, '0')}:${String(Math.max(leftStart, rightStart) % 60).padStart(2, '0')}`,
            endTime: `${String(Math.floor(Math.min(leftEnd, rightEnd) / 60)).padStart(2, '0')}:${String(Math.min(leftEnd, rightEnd) % 60).padStart(2, '0')}`,
            left,
            right
          };
        }
      }
    }
    return null;
  }

  async function saveScreeningPlan(event) {
    event.preventDefault();
    if (!activeUser || !screeningPlanForm.reportValidity()) return;
    const rows = [...screeningPlanRulesContainer.querySelectorAll('.screening-plan-rule')];

    setButtonBusy(saveScreeningPlanButton, true, '儲存中');
    try {
      const rules = [];
      for (const [index, row] of rows.entries()) {
        const frequency = row.querySelector('.screening-plan-rule-frequency').value;
        const weekdays = [...row.querySelectorAll('.screening-plan-rule-weekly input:checked')]
          .map(input => Number(input.value))
          .sort((left, right) => left - right);
        const startTime = row.querySelector('.screening-plan-rule-start').value;
        const endTime = row.querySelector('.screening-plan-rule-end').value;
        const placeInput = row.querySelector('.screening-plan-rule-place');
        const placeQuery = placeInput.value.trim();
        if (frequency === 'weekly' && !weekdays.length) {
          showStatus(screeningPlanStatus, `安排 ${index + 1}：每週請至少選一個星期。`, true);
          row.querySelector('.screening-plan-rule-weekly input')?.focus();
          return;
        }
        if (startTime >= endTime) {
          showStatus(screeningPlanStatus, `安排 ${index + 1}：結束時間需晚於開始時間。`, true);
          row.querySelector('.screening-plan-rule-end').focus();
          return;
        }
        const state = screeningPlanRuleStates.get(row);
        const place = await resolveScreeningPlanPlace(placeQuery, state?.place);
        if (!place) {
          showStatus(screeningPlanStatus, `安排 ${index + 1}：無法定位地點，請輸入較完整地址或在地圖選點。`, true);
          placeInput.focus();
          return;
        }
        rules.push(frequency === 'monthly'
          ? {
            frequency,
            ordinal: Number(row.querySelector('.screening-plan-rule-ordinal').value),
            weekday: Number(row.querySelector('.screening-plan-rule-monthly-weekday').value),
            name: row.querySelector('.screening-plan-rule-name').value.trim(),
            place,
            startTime,
            endTime
          }
          : { frequency, weekdays, name: row.querySelector('.screening-plan-rule-name').value.trim(), place, startTime, endTime });
      }
      const conflict = findScreeningPlanConflict(rules);
      if (conflict) {
        const leftName = conflict.left.rule.name || `安排 ${conflict.left.index + 1}`;
        const rightName = conflict.right.rule.name || `安排 ${conflict.right.index + 1}`;
        showStatus(screeningPlanStatus,
          `${conflict.dateLabel} ${conflict.startTime}–${conflict.endTime}：${leftName} 與 ${rightName} 時段重疊，但地點不同。請調整時間或地點。`, true);
        const conflictedRow = rows[conflict.right.index];
        conflictedRow.querySelector('.screening-plan-rule-fields').hidden = false;
        conflictedRow.querySelector('.screening-plan-rule-summary').hidden = true;
        const collapseButton = conflictedRow.querySelector('.screening-plan-rule-collapse');
        collapseButton.setAttribute('aria-expanded', 'true');
        collapseButton.setAttribute('aria-label', '收合此安排');
        collapseButton.title = '收合此安排';
        collapseButton.querySelector('.material-icons').textContent = 'expand_less';
        conflictedRow.querySelector('.screening-plan-rule-start').focus();
        return;
      }
      const preferences = {
        version: 2,
        rules
      };
      const { data, error } = await window.questionnaireSupabase.auth.updateUser({
        data: { screening_preferences: preferences }
      });
      if (error) {
        showStatus(screeningPlanStatus, '篩檢安排儲存失敗，請稍後再試。', true);
        return;
      }
      activeUser = data.user || activeUser;
      activeUser.user_metadata = {
        ...activeUser.user_metadata,
        screening_preferences: preferences
      };
      savedScreeningPreferences = preferences;
      screeningOutlookKey = '';
      renderNextScreeningSlot(preferences);
      showStatus(screeningPlanStatus, rules.length
        ? `已儲存 ${rules.length} 筆篩檢安排。符合日期與時段時，問卷會預填對應地點。`
        : '已儲存：目前沒有固定篩檢排程（未安排或休假）。問卷不會預填排程地點。');
      refreshScreeningPlanOutlook(true);
    } catch {
      showStatus(screeningPlanStatus, '目前無法連線儲存，請稍後再試。', true);
    } finally {
      setButtonBusy(saveScreeningPlanButton, false, '儲存篩檢安排');
    }
  }

  async function resolveScreeningPlanPlace(query, chosenPlace) {
    if (!query) return null;
    if (chosenPlace?.label === query
      && Array.isArray(chosenPlace.coordinates)
      && chosenPlace.coordinates.length === 2
      && chosenPlace.coordinates.every(Number.isFinite)) return chosenPlace;
    const savedPlace = screeningPlanPlaces.find(place => place.label === query || place.name === query);
    if (savedPlace) return savedPlace;
    try {
      const [feature] = await window.AdminPlaceSearch.search(query);
      const coordinates = feature?.geometry?.coordinates?.map(Number);
      if (!Array.isArray(coordinates) || coordinates.length !== 2 || !coordinates.every(Number.isFinite)) return null;
      const properties = feature.properties || {};
      const label = placeLabel(feature) || query;
      return { name: properties.name || query, label, coordinates };
    } catch {
      return null;
    }
  }

  function getTaipeiParts(date = new Date()) {
    return Object.fromEntries(new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Taipei',
      weekday: 'short',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23'
    }).formatToParts(date).filter(part => part.type !== 'literal').map(part => [part.type, part.value]));
  }

  function getNextScreeningSlot(preferences) {
    if (!Array.isArray(preferences?.rules) || !preferences.rules.length) return null;
    const now = getTaipeiParts();
    const today = Date.UTC(Number(now.year), Number(now.month) - 1, Number(now.day));
    const currentMinutes = Number(now.hour) * 60 + Number(now.minute);
    for (let offset = 0; offset <= 370; offset += 1) {
      const date = new Date(today + offset * 86400000);
      const weekday = date.getUTCDay();
      const dayOfMonth = date.getUTCDate();
      const daysInMonth = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
      const candidates = preferences.rules.filter(rule => {
        if (!rule.place?.label || !Array.isArray(rule.place.coordinates)
          || rule.place.coordinates.length !== 2 || !rule.place.coordinates.every(Number.isFinite)
          || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(rule.startTime || '')
          || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(rule.endTime || '')
          || rule.startTime >= rule.endTime) return false;
        if (rule.frequency === 'weekly') return Array.isArray(rule.weekdays) && rule.weekdays.includes(weekday);
        if (rule.frequency !== 'monthly' || Number(rule.weekday) !== weekday) return false;
        if (Number(rule.ordinal) === -1) return dayOfMonth + 7 > daysInMonth;
        return Number.isInteger(Number(rule.ordinal))
          && Math.floor((dayOfMonth - 1) / 7) + 1 === Number(rule.ordinal);
      }).filter(rule => offset > 0 || currentMinutes < Number(rule.endTime.slice(0, 2)) * 60 + Number(rule.endTime.slice(3, 5)));
      if (!candidates.length) continue;
      candidates.sort((left, right) => left.startTime.localeCompare(right.startTime));
      const rule = candidates[0];
      const year = date.getUTCFullYear();
      const month = String(date.getUTCMonth() + 1).padStart(2, '0');
      const day = String(date.getUTCDate()).padStart(2, '0');
      return {
        dateKey: `${year}-${month}-${day}`,
        dateLabel: new Intl.DateTimeFormat('zh-TW', {
          timeZone: 'UTC', weekday: 'long', month: 'long', day: 'numeric'
        }).format(new Date(Date.UTC(year, date.getUTCMonth(), date.getUTCDate(), 12))),
        startTime: rule.startTime,
        endTime: rule.endTime,
        name: rule.name || '',
        place: rule.place
      };
    }
    return null;
  }

  function renderNextScreeningSlot(preferences) {
    const slot = getNextScreeningSlot(preferences);
    screeningPlanNext.replaceChildren();
    if (!slot) {
      appendScreeningPlanFact(screeningPlanNext, 'event_busy', '尚未設定有效排程');
      return;
    }
    appendScreeningPlanFact(screeningPlanNext, 'event', slot.dateLabel);
    appendScreeningPlanFact(screeningPlanNext, 'schedule', `${slot.startTime}–${slot.endTime}`);
    if (slot.name) appendScreeningPlanFact(screeningPlanNext, 'label', slot.name);
    appendScreeningPlanFact(screeningPlanNext, 'place', slot.place.label);
  }

  function appendScreeningPlanFact(container, iconName, text, tone = '') {
    const fact = document.createElement('span');
    fact.className = 'screening-plan-fact';
    if (tone) fact.dataset.tone = tone;
    const icon = document.createElement('span');
    icon.className = 'material-icons notranslate';
    icon.setAttribute('translate', 'no');
    icon.setAttribute('aria-hidden', 'true');
    icon.textContent = iconName;
    fact.append(icon, document.createTextNode(text));
    container.append(fact);
  }

  function renderScreeningWeather(weather) {
    screeningPlanWeather.replaceChildren();
    if (!weather.available) {
      appendScreeningPlanFact(screeningPlanWeather, 'cloud_off', weather.message, 'warning');
      return;
    }
    const tone = weather.maxProbability >= 50 ? 'warning' : '';
    appendScreeningPlanFact(screeningPlanWeather, 'umbrella', `${Math.round(weather.maxProbability)}% 降雨`, tone);
    appendScreeningPlanFact(screeningPlanWeather, 'water_drop', `${weather.totalPrecipitation.toFixed(1)} mm`);
  }

  function renderScreeningPlanAdvice(weather, disasters) {
    const items = [];
    if (!weather.available) {
      items.push(['cloud_off', '天氣資料暫缺', 'warning']);
    } else if (weather.maxProbability >= 50) {
      items.push(['umbrella', '高降雨：備雨具與室內備案', 'warning']);
    } else if (weather.maxProbability >= 25) {
      items.push(['umbrella', '可能降雨：準備雨具', 'warning']);
    } else {
      items.push(['wb_sunny', '降雨機率低', '']);
    }
    if (disasters.nearby.length) {
      items.push(['warning', '附近有災害：查看官方公告', 'danger']);
    } else if (!disasters.usgsAvailable || disasters.failedSources.length) {
      items.push(['error_outline', '災害資料不完整，風險未知', 'warning']);
    } else {
      items.push(['verified_user', '出發前仍請留意官方警報', '']);
    }
    screeningPlanAdvice.replaceChildren();
    items.forEach(([iconName, text, tone]) => appendScreeningPlanFact(screeningPlanAdvice, iconName, text, tone));
    screeningPlanAdvice.hidden = false;
  }

  async function refreshScreeningPlanOutlook(force = false) {
    const slot = getNextScreeningSlot(savedScreeningPreferences);
    if (!slot) {
      screeningOutlookKey = '';
      renderScreeningWeather({ available: false, message: '尚未設定有效排程' });
      screeningPlanDisasters.textContent = '設定排程後顯示';
      screeningPlanAdvice.hidden = true;
      return;
    }
    const requestKey = `${slot.dateKey}|${slot.place.coordinates.join(',')}|${slot.startTime}|${slot.endTime}`;
    if (!force && requestKey === screeningOutlookKey
      && (screeningOutlookPending || Date.now() - screeningOutlookLoadedAt < 600000)) return;
    screeningOutlookKey = requestKey;
    const requestId = ++screeningOutlookRequest;
    screeningOutlookPending = true;
    refreshScreeningOutlookButton.disabled = true;
    renderScreeningWeather({ available: false, message: '查詢中…' });
    screeningPlanDisasters.textContent = '查詢中…';
    screeningPlanAdvice.hidden = true;

    const [weather, disasters] = await Promise.all([
      loadScreeningWeather(slot),
      loadNearbyDisasters(slot.place.coordinates)
    ]);
    if (requestId !== screeningOutlookRequest) return;
    screeningOutlookPending = false;
    screeningOutlookLoadedAt = Date.now();
    refreshScreeningOutlookButton.disabled = !screeningPlanEditable;
    renderScreeningWeather(weather);
    renderScreeningDisasters(disasters);
    renderScreeningPlanAdvice(weather, disasters);
  }

  async function loadScreeningWeather(slot) {
    const today = getTaipeiParts();
    const todayUtc = Date.UTC(Number(today.year), Number(today.month) - 1, Number(today.day));
    const slotUtc = Date.parse(`${slot.dateKey}T00:00:00Z`);
    if (slotUtc - todayUtc > 15 * 86400000) {
      return {
        available: false,
        maxProbability: null,
        message: '此時段超出目前約 16 日的預報範圍，接近篩檢日期後可重新查詢。'
      };
    }
    try {
      const params = new URLSearchParams({
        latitude: String(slot.place.coordinates[1]),
        longitude: String(slot.place.coordinates[0]),
        hourly: 'precipitation_probability,precipitation',
        forecast_days: '16',
        timezone: 'Asia/Taipei'
      });
      const response = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`, {
        signal: AbortSignal.timeout(15000)
      });
      if (!response.ok) throw new Error('Weather feed unavailable');
      const payload = await response.json();
      if (!Array.isArray(payload.hourly?.time) || !Array.isArray(payload.hourly?.precipitation_probability)
        || !Array.isArray(payload.hourly?.precipitation)) throw new Error('Invalid weather feed');
      const startHour = Number(slot.startTime.slice(0, 2));
      const endHour = Number(slot.endTime.slice(0, 2)) + (Number(slot.endTime.slice(3, 5)) > 0 ? 1 : 0);
      const indices = payload.hourly.time.map((time, index) => ({ time, index }))
        .filter(item => item.time.startsWith(`${slot.dateKey}T`))
        .filter(item => Number(item.time.slice(11, 13)) >= startHour && Number(item.time.slice(11, 13)) < endHour);
      if (!indices.length) throw new Error('Forecast time unavailable');
      const probabilities = indices.map(item => Number(payload.hourly.precipitation_probability[item.index])).filter(Number.isFinite);
      const precipitation = indices.map(item => Number(payload.hourly.precipitation[item.index])).filter(Number.isFinite);
      if (!probabilities.length) throw new Error('Forecast values unavailable');
      const maxProbability = Math.max(...probabilities);
      const totalPrecipitation = precipitation.reduce((total, amount) => total + amount, 0);
      return {
        available: true,
        maxProbability,
        totalPrecipitation,
        message: `時段最高降雨機率 ${Math.round(maxProbability)}%，預估累積雨量約 ${totalPrecipitation.toFixed(1)} mm（Open-Meteo）。`
      };
    } catch {
      return { available: false, maxProbability: null, message: '目前無法取得此時段降雨預報，請稍後重試或查看官方天氣資訊。' };
    }
  }

  async function loadNearbyDisasters(coordinates) {
    const result = { usgsAvailable: false, failedSources: [], nearby: [], globalAdvisories: [] };
    const earthquakeRequest = (async () => {
      try {
        const response = await fetch('https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_week.geojson', {
          signal: AbortSignal.timeout(15000)
        });
        if (!response.ok) throw new Error('USGS unavailable');
        const payload = await response.json();
        if (payload.type !== 'FeatureCollection' || !Array.isArray(payload.features)) throw new Error('Invalid USGS feed');
        result.usgsAvailable = true;
        payload.features.forEach(feature => {
          const [longitude, latitude] = feature.geometry?.coordinates || [];
          if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return;
          const distance = distanceBetweenKm(coordinates[1], coordinates[0], latitude, longitude);
          if (distance > 300) return;
          result.nearby.push({
            title: `地震 M${Number(feature.properties.mag).toFixed(1)} · ${feature.properties.place || '位置未提供'}`,
            distance,
            time: feature.properties.time,
            url: feature.properties.url,
            source: 'USGS'
          });
        });
      } catch {
        result.failedSources.push('USGS 地震資料');
      }
    })();
    const advisoryRequest = (async () => {
      try {
        const { data, error } = await window.questionnaireSupabase.functions.invoke('environment-feeds', {
          body: {},
          timeout: 20000
        });
        if (error || !Array.isArray(data?.sources)) throw new Error('Disaster feeds unavailable');
        data.sources.forEach(source => {
          if (!source.ok || !source.xml) {
            result.failedSources.push(source.id || 'GDACS／海嘯資料');
            return;
          }
          const entries = parseScreeningDisasterFeed(source);
          entries.forEach(entry => {
            if (Number.isFinite(entry.latitude) && Number.isFinite(entry.longitude)) {
              const distance = distanceBetweenKm(coordinates[1], coordinates[0], entry.latitude, entry.longitude);
              if (distance <= 500) result.nearby.push({ ...entry, distance });
            } else if (source.id === 'ptwc' || source.id === 'ntwc') {
              result.globalAdvisories.push(entry);
            }
          });
        });
      } catch {
        result.failedSources.push('GDACS／海嘯資料');
      }
    })();
    await Promise.allSettled([earthquakeRequest, advisoryRequest]);
    result.nearby.sort((left, right) => left.distance - right.distance);
    result.nearby = result.nearby.slice(0, 5);
    result.globalAdvisories = result.globalAdvisories.slice(0, 3);
    result.failedSources = [...new Set(result.failedSources)];
    return result;
  }

  function parseScreeningDisasterFeed(source) {
    if (/<!DOCTYPE|<!ENTITY/i.test(source.xml)) return [];
    const xml = new DOMParser().parseFromString(source.xml, 'application/xml');
    if (xml.querySelector('parsererror')) return [];
    const text = (element, tag) => element.getElementsByTagNameNS('*', tag)[0]?.textContent?.trim() || '';
    const gdacs = source.id === 'gdacs';
    const nodes = [...xml.getElementsByTagNameNS('*', gdacs ? 'item' : 'entry')];
    return nodes.map(node => {
      const point = text(node, 'point').split(/\s+/).map(Number);
      const link = gdacs
        ? text(node, 'link')
        : [...node.getElementsByTagNameNS('*', 'link')].find(item => ['alternate', ''].includes(item.getAttribute('rel') || ''))?.getAttribute('href');
      const eventType = text(node, 'eventtype');
      const title = `${gdacs ? `${eventType || 'GDACS'} · ` : `${source.id.toUpperCase()} · `}${text(node, 'title')}`;
      const time = Date.parse(text(node, gdacs ? 'datemodified' : 'updated') || text(node, 'pubDate'));
      return {
        title,
        time: Number.isFinite(time) ? time : Date.now(),
        latitude: point.length === 2 ? point[0] : NaN,
        longitude: point.length === 2 ? point[1] : NaN,
        url: link,
        source: source.id.toUpperCase()
      };
    }).filter(entry => entry.title.length > source.id.length + 3);
  }

  function distanceBetweenKm(latitudeA, longitudeA, latitudeB, longitudeB) {
    const radians = degrees => degrees * Math.PI / 180;
    const latitudeDelta = radians(latitudeB - latitudeA);
    const longitudeDelta = radians(longitudeB - longitudeA);
    const factor = Math.sin(latitudeDelta / 2) ** 2
      + Math.cos(radians(latitudeA)) * Math.cos(radians(latitudeB)) * Math.sin(longitudeDelta / 2) ** 2;
    return 6371 * 2 * Math.atan2(Math.sqrt(factor), Math.sqrt(1 - factor));
  }

  function renderScreeningDisasters(result) {
    screeningPlanDisasters.replaceChildren();
    if (result.nearby.length) {
      const list = document.createElement('ul');
      result.nearby.forEach(entry => {
        const item = document.createElement('li');
        const link = document.createElement('a');
        link.textContent = `${entry.title} · 約 ${Math.round(entry.distance)} 公里`;
        if (/^https:\/\//i.test(entry.url || '')) {
          link.href = entry.url;
          link.target = '_blank';
          link.rel = 'noopener noreferrer';
        }
        item.append(link);
        list.append(item);
      });
      screeningPlanDisasters.append(list);
    } else if (result.usgsAvailable) {
      const noNearby = document.createElement('p');
      noNearby.textContent = '近 7 日 300 公里內未查到 M2.5 以上地震（USGS）。';
      screeningPlanDisasters.append(noNearby);
    }
    result.globalAdvisories.forEach(entry => {
      const advisory = document.createElement('p');
      advisory.textContent = `${entry.title}（來源未提供座標，無法判斷是否影響此地點）`;
      screeningPlanDisasters.append(advisory);
    });
    if (result.failedSources.length) {
      const unavailable = document.createElement('p');
      unavailable.textContent = `資料來源不可用：${result.failedSources.join('、')}（風險未知）`;
      screeningPlanDisasters.append(unavailable);
    }
    if (!result.usgsAvailable && !result.globalAdvisories.length && !result.nearby.length && !result.failedSources.length) {
      screeningPlanDisasters.textContent = '目前沒有可用的災害資料。';
    }
  }

  async function loadScreenerNumber(session) {
    screenerNumberUserId = session.user.id;
    screenerNumberInput.value = '';
    screenerNumberInput.disabled = true;
    saveScreenerNumberButton.disabled = true;
    showStatus(screenerNumberStatus, '正在讀取帳號綁定資料。');

    const { data, error } = await window.questionnaireSupabase
      .from('admin_profiles')
      .select('screener_number')
      .eq('user_id', screenerNumberUserId)
      .maybeSingle();

    if (error || !data) {
      showStatus(screenerNumberStatus, error
        ? '無法載入篩檢員編號。請確認資料庫已更新並聯絡系統管理員。'
        : '此帳號不在管理員名單中，無法設定篩檢員編號。', true);
      return;
    }

    screenerNumberInput.disabled = false;
    saveScreenerNumberButton.disabled = false;
    screenerNumberInput.value = data.screener_number || '';
    showStatus(screenerNumberStatus, data.screener_number
      ? `目前綁定編號：${data.screener_number}`
      : '尚未綁定編號。請輸入已分配給此帳號的篩檢員編號。');
  }

  async function saveScreenerNumber(event) {
    event.preventDefault();
    const screenerNumber = screenerNumberInput.value.trim();
    screenerNumberInput.value = screenerNumber;
    if (!screenerNumberInput.reportValidity() || !screenerNumberUserId) return;

    setButtonBusy(saveScreenerNumberButton, true, '儲存中');
    const { data, error } = await window.questionnaireSupabase
      .from('admin_profiles')
      .update({ screener_number: screenerNumber })
      .eq('user_id', screenerNumberUserId)
      .select('screener_number')
      .maybeSingle();
    setButtonBusy(saveScreenerNumberButton, false, '儲存編號');

    if (error || !data) {
      const message = error?.code === '23505'
        ? '此篩檢員編號已綁定其他帳號，請確認編號後再試。'
        : '儲存失敗。請確認資料庫已更新，或聯絡系統管理員。';
      showStatus(screenerNumberStatus, message, true);
      return;
    }

    screenerNumberInput.value = data.screener_number;
    showStatus(screenerNumberStatus, `已綁定篩檢員編號：${data.screener_number}`);
  }

  function showLogin() {
    activeStaffProfile = null;
    loginPanel.hidden = false;
    dashboard.hidden = true;
    signOutButton.hidden = true;
    openQuestionnaireButton.hidden = true;
    screenerNumberUserId = null;
    activeUser = null;
    accountNicknameInput.value = '';
    accountEmailInput.value = '';
    accountNicknameInput.disabled = true;
    accountEmailInput.disabled = true;
    saveAccountProfileButton.disabled = true;
    accountEmailLabel.textContent = '';
    accountProfileStatus.hidden = true;
    screenerNumberInput.value = '';
    screenerNumberInput.disabled = true;
    saveScreenerNumberButton.disabled = true;
    screenerNumberStatus.hidden = true;
    loginForm.reset();
    showAuthForm(loginForm);
  }

  async function loadResponses() {
    showStatus(dashboardStatus, '資料載入中。');
    const fields = 'id, created_at, language, schema_version, response_data, anonymous_consult_code';
    const isPendingView = consultationFilter.value === 'pending';
    let loadedResponses = [];

    if (isPendingView) {
      const batchSize = 200;
      for (let offset = 0; ; offset += batchSize) {
        const { data, error } = await window.questionnaireSupabase
          .from('questionnaire_responses')
          .select(fields)
          .is('anonymous_consult_code', null)
          .order('created_at', { ascending: true })
          .order('id', { ascending: true })
          .range(offset, offset + batchSize - 1);

        if (error) {
          showStatus(dashboardStatus, '無法載入資料，請確認資料庫已更新且帳號具管理權限。', true);
          return;
        }

        loadedResponses.push(...(data || []));
        if ((data || []).length < batchSize) break;
      }
    } else {
      let query = window.questionnaireSupabase
        .from('questionnaire_responses')
        .select(fields)
        .order('created_at', { ascending: false })
        .order('id', { ascending: false })
        .limit(200);
      if (consultationFilter.value === 'completed') {
        query = query.not('anonymous_consult_code', 'is', null);
      }
      const { data, error } = await query;

      if (error) {
        showStatus(dashboardStatus, '無法載入資料，請確認資料庫已更新且帳號具管理權限。', true);
        return;
      }
      loadedResponses = data || [];
    }

    responses = loadedResponses;
    renderNationalityOptions();
    initializeScreeningDateRange(responses);
    currentPage = 1;
    renderResponses();
    showStatus(dashboardStatus, `已載入 ${responses.length} 筆資料。`);
  }

  function renderResponses() {
    const filtered = getFilteredResponses();
    renderScreeningAnalytics(filtered);

    const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
    currentPage = Math.min(currentPage, totalPages);
    const visibleResponses = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

    pageStatus.textContent = `第 ${currentPage} / ${totalPages} 頁`;
    previousPageButton.disabled = currentPage <= 1;
    nextPageButton.disabled = currentPage >= totalPages;

    responseBody.replaceChildren();
    emptyState.hidden = filtered.length !== 0;
    visibleResponses.forEach(response => {
      const data = response.response_data || {};
      const nationalities = getResponseNationalities(response).map(formatNationalityLabel);
      const consultationCodes = getConsultationCode(response).split(',').map(code => code.trim()).filter(Boolean);
      const consultationCode = consultationCodes.join('、');
      const row = document.createElement('tr');
      row.tabIndex = 0;
      row.setAttribute('aria-label', `${formatDate(response.created_at)}，${consultationCode ? `諮詢代碼 ${consultationCode}` : '諮詢待處理'}。雙擊或按 Enter 查看詳細資料。`);
      row.classList.add(consultationCode ? 'is-consultation-complete' : 'is-consultation-pending');
      const consultationCodeCell = consultationCode
        ? `<span class="consultation-code-badge is-complete">${escapeHtml(consultationCode)}</span>`
        : '<span class="consultation-code-badge is-pending">待處理</span>';
      row.innerHTML = `
        <td>${escapeHtml(formatDate(response.created_at))}</td>
        <td>${consultationCodeCell}</td>
        <td>${escapeHtml(data.screener || '未填寫')}</td>
        <td>${escapeHtml(data.screening_place || '未填寫')}</td>
        <td>${escapeHtml(nationalities.join('、') || '未填寫')}</td>
      `;
      let lastPointerType = '';
      const openDetails = () => {
        if (!dialog.open) showResponse(response);
      };
      row.addEventListener('pointerdown', event => { lastPointerType = event.pointerType; });
      row.addEventListener('click', () => {
        if (lastPointerType === 'touch' || window.matchMedia('(pointer: coarse)').matches) openDetails();
      });
      row.addEventListener('dblclick', openDetails);
      row.addEventListener('keydown', event => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        openDetails();
      });
      responseBody.appendChild(row);
    });
  }

  function getFilteredResponses() {
    const keyword = searchInput.value.trim().toLowerCase();
    return responses.filter(response => {
      const data = response.response_data || {};
      const nationalities = getResponseNationalities(response);
      const nationalityNames = nationalities.map(formatNationalityLabel);
      const searchable = [getConsultationCode(response), data.screener, data.screening_place, ...nationalities, ...nationalityNames]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      const hasConsultCode = Boolean(getConsultationCode(response));
      const matchesNationality = selectedNationalities.size === 0
        || nationalities.some(country => selectedNationalities.has(country));
      return (!keyword || searchable.includes(keyword))
        && matchesNationality
        && (consultationFilter.value === 'all'
          || (consultationFilter.value === 'completed' && hasConsultCode)
          || (consultationFilter.value === 'pending' && !hasConsultCode));
    });
  }

  function getResponseNationalities(response) {
    const value = response.response_data?.nationality;
    const values = Array.isArray(value) ? value : value === null || value === undefined ? [] : [value];
    return [...new Set(values.map(country => String(country).trim())
      .filter(Boolean)
      .map(country => /^[a-z]{2}$/i.test(country) ? country.toUpperCase() : country))];
  }

  function formatNationalityLabel(country) {
    return formatResponseValue('nationality', country);
  }

  function renderNationalityOptions() {
    const countryCounts = new Map();
    responses.forEach(response => getResponseNationalities(response).forEach(country => {
      countryCounts.set(country, (countryCounts.get(country) || 0) + 1);
    }));
    selectedNationalities.forEach(country => {
      if (!countryCounts.has(country)) countryCounts.set(country, 0);
    });

    const countries = [...countryCounts.keys()].sort((left, right) =>
      formatNationalityLabel(left).localeCompare(formatNationalityLabel(right), 'zh-TW')
    );
    nationalityOptions.replaceChildren();
    if (!countries.length) {
      const empty = document.createElement('p');
      empty.className = 'admin-nationality-empty';
      empty.textContent = '目前載入的紀錄沒有國籍資料。';
      nationalityOptions.append(empty);
      renderSelectedNationalities();
      return;
    }

    countries.forEach(country => {
      const label = document.createElement('label');
      label.className = 'admin-nationality-option';
      label.dataset.searchText = `${formatNationalityLabel(country)} ${country}`.toLocaleLowerCase();
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.value = country;
      checkbox.dataset.nationalityOption = 'true';
      checkbox.checked = selectedNationalities.has(country);
      const name = document.createElement('span');
      name.className = 'admin-nationality-option-name';
      name.textContent = formatNationalityLabel(country);
      const count = document.createElement('small');
      count.className = 'admin-nationality-option-count';
      count.textContent = String(countryCounts.get(country));
      label.append(checkbox, name, count);
      nationalityOptions.append(label);
    });
    filterNationalityOptions();
    renderSelectedNationalities();
  }

  function filterNationalityOptions() {
    const query = nationalitySearch.value.trim().toLocaleLowerCase();
    nationalityOptions.querySelectorAll('.admin-nationality-option').forEach(option => {
      option.hidden = query !== '' && !option.dataset.searchText.includes(query);
    });
  }

  function renderSelectedNationalities() {
    selectedNationalityContainer.replaceChildren();
    selectedNationalities.forEach(country => {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'selected-value';
      chip.dataset.removeNationality = country;
      chip.setAttribute('aria-label', `移除國籍篩選 ${formatNationalityLabel(country)}`);
      chip.textContent = `${formatNationalityLabel(country)} ×`;
      selectedNationalityContainer.append(chip);
    });
  }

  function renderScreeningAnalytics(filteredResponses) {
    const screeningCounts = {
      hivScreenings: 0,
      hivPositive: 0,
      syphilisScreenings: 0,
      syphilisPositive: 0
    };

    filteredResponses.forEach(response => {
      const data = response.response_data || {};
      const interpretationValues = Array.isArray(data.screening_interpretation)
        ? data.screening_interpretation
        : [data.screening_interpretation];
      const interpretations = new Set(interpretationValues.filter(value => typeof value === 'string'));
      const hasHivResult = interpretations.has('hiv_positive') || interpretations.has('hiv_negative');
      const hasSyphilisResult = interpretations.has('syphilis_positive') || interpretations.has('syphilis_negative');

      if (hasHivResult) screeningCounts.hivScreenings += 1;
      if (interpretations.has('hiv_positive')) screeningCounts.hivPositive += 1;
      if (hasSyphilisResult) screeningCounts.syphilisScreenings += 1;
      if (interpretations.has('syphilis_positive')) screeningCounts.syphilisPositive += 1;
    });

    const consultationFilledCount = filteredResponses.filter(response => Boolean(getConsultationCode(response))).length;
    document.getElementById('hiv-screening-ratio').textContent = `${screeningCounts.hivPositive} / ${screeningCounts.hivScreenings}`;
    document.getElementById('syphilis-screening-ratio').textContent = `${screeningCounts.syphilisPositive} / ${screeningCounts.syphilisScreenings}`;
    document.getElementById('consultation-fill-ratio').textContent = `${consultationFilledCount} / ${filteredResponses.length}`;

    const mapMode = document.querySelector('input[name="screening-map-mode"]:checked')?.value || 'all';
    const mapResponses = filterResponsesForMap(filteredResponses, mapMode);
    if (!mapResponses) {
      renderScreeningMap([]);
      return;
    }

    const locationCounts = new Map();
    const totalPositiveCount = mapResponses.reduce(
      (total, response) => total + getPositiveResultCountForMap(response, mapMode),
      0
    );
    mapResponses.forEach(response => {
      const location = String(response.response_data?.screening_place || '').trim();
      const normalizedLocation = normalizePlace(location);
      const matchedPlace = normalizedLocation && screeningPlaces.find(place => {
        const aliases = [place.name, place.label, ...(place.aliases || [])]
          .map(normalizePlace)
          .filter(Boolean);
        return aliases.some(alias => normalizedLocation.includes(alias));
      });

      if (!matchedPlace) return;
      const positiveCount = getPositiveResultCountForMap(response, mapMode);
      const previousLocation = locationCounts.get(matchedPlace.name);
      locationCounts.set(matchedPlace.name, {
        place: matchedPlace,
        count: (previousLocation?.count || 0) + 1,
        positiveCount: (previousLocation?.positiveCount || 0) + positiveCount
      });
    });

    const mappedCount = [...locationCounts.values()].reduce((total, location) => total + location.count, 0);
    const modeLabels = { all: '總篩檢', hiv: 'HIV', syphilis: '梅毒' };
    screeningMapSummary.textContent = `${modeLabels[mapMode]}：${mapResponses.length} 筆紀錄，陽性 ${totalPositiveCount} 件，${mappedCount} 筆可定位`;
    renderScreeningMap([...locationCounts.values()], totalPositiveCount, mapResponses.length);
  }

  function getPositiveResultCountForMap(response, mapMode) {
    const values = Array.isArray(response.response_data?.screening_interpretation)
      ? response.response_data.screening_interpretation
      : [response.response_data?.screening_interpretation];
    const results = new Set(values.filter(value => typeof value === 'string'));
    const hivPositive = results.has('hiv_positive');
    const syphilisPositive = results.has('syphilis_positive');
    if (mapMode === 'hiv') return Number(hivPositive);
    if (mapMode === 'syphilis') return Number(syphilisPositive);
    return Number(hivPositive) + Number(syphilisPositive);
  }

  function filterResponsesForMap(filteredResponses, mapMode) {
    const rangeStart = parseTaipeiDateTime(screeningRangeStart.value, false);
    const rangeEnd = parseTaipeiDateTime(screeningRangeEnd.value, true);
    screeningRangeStart.removeAttribute('aria-invalid');
    screeningRangeEnd.removeAttribute('aria-invalid');

    if (rangeStart === null || rangeEnd === null || rangeEnd < rangeStart) {
      screeningRangeStart.setAttribute('aria-invalid', 'true');
      screeningRangeEnd.setAttribute('aria-invalid', 'true');
      screeningMapSummary.textContent = '請輸入有效的開始與結束時間範圍。';
      return null;
    }

    return filteredResponses.filter(response => {
      const submittedAt = new Date(response.created_at).getTime();
      if (!Number.isFinite(submittedAt) || submittedAt < rangeStart || submittedAt > rangeEnd) return false;

      const values = Array.isArray(response.response_data?.screening_interpretation)
        ? response.response_data.screening_interpretation
        : [response.response_data?.screening_interpretation];
      const results = new Set(values.filter(value => typeof value === 'string'));
      const hasHivResult = results.has('hiv_positive') || results.has('hiv_negative');
      const hasSyphilisResult = results.has('syphilis_positive') || results.has('syphilis_negative');
      if (mapMode === 'hiv') return hasHivResult;
      if (mapMode === 'syphilis') return hasSyphilisResult;
      return hasHivResult || hasSyphilisResult;
    });
  }

  function initializeScreeningDateRange(items) {
    if (screeningDateRangeInitialized) return;
    const submittedTimes = items
      .map(response => new Date(response.created_at).getTime())
      .filter(Number.isFinite);
    const now = Date.now();
    screeningDateBounds = submittedTimes.length
      ? { start: Math.min(...submittedTimes), end: Math.max(...submittedTimes) }
      : { start: now - 30 * 24 * 60 * 60 * 1000, end: now };
    resetScreeningDateRange();
    screeningDateRangeInitialized = true;
  }

  function resetScreeningDateRange() {
    if (!screeningDateBounds) return;
    screeningRangeStart.value = formatTaipeiDateTime(screeningDateBounds.start);
    screeningRangeEnd.value = formatTaipeiDateTime(screeningDateBounds.end);
  }

  function formatTaipeiDateTime(timestamp) {
    const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Taipei',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23'
    }).formatToParts(new Date(timestamp)).map(part => [part.type, part.value]));
    return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
  }

  function parseTaipeiDateTime(value, endOfMinute) {
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return null;
    const timestamp = Date.parse(`${value}:${endOfMinute ? '59' : '00'}+08:00`);
    return Number.isFinite(timestamp) ? timestamp : null;
  }

  function renderScreeningMap(locations, totalPositiveCount = 0, totalScreeningCount = 0) {
    const mapElement = document.getElementById('screening-map');
    const emptyState = document.getElementById('screening-map-empty');
    if (!window.L) {
      mapElement.textContent = '地圖目前無法載入。';
      mapElement.classList.add('screening-map-unavailable');
      emptyState.hidden = true;
      return;
    }

    if (!screeningMap) {
      mapElement.replaceChildren();
      screeningMap = window.L.map(mapElement, { scrollWheelZoom: false, attributionControl: true })
        .setView([24.75, 120.93], 10);
      screeningHotspotLayer = window.L.featureGroup().addTo(screeningMap);
      window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      }).addTo(screeningMap);
    }

    mapElement.classList.remove('screening-map-unavailable');
    screeningHotspotLayer.clearLayers();
    emptyState.hidden = locations.length > 0;
    locations.forEach(({ place, count, positiveCount }) => {
      const [longitude, latitude] = place.coordinates.map(Number);
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return;
      const screeningShare = totalScreeningCount ? count / totalScreeningCount : 0;
      const positiveShare = totalPositiveCount ? positiveCount / totalPositiveCount : 0;
      const fillColor = interpolateHeatColor(positiveShare);

      const marker = window.L.circleMarker([latitude, longitude], {
        radius: 30 * Math.sqrt(screeningShare),
        color: '#ffffff',
        weight: 2,
        fillColor,
        fillOpacity: 0.52 + positiveShare * 0.4
      });
      const popup = document.createElement('div');
      const placeName = document.createElement('strong');
      const placeCount = document.createElement('p');
      placeName.textContent = place.label || place.name;
      placeCount.textContent = `${positiveCount} 件陽性 / ${count} 筆篩檢；篩檢量占比 ${Math.round(screeningShare * 100)}%，陽性占比 ${Math.round(positiveShare * 100)}%`;
      popup.append(placeName, placeCount);
      marker.bindPopup(popup).addTo(screeningHotspotLayer);
    });

    if (locations.length === 1) {
      const [longitude, latitude] = locations[0].place.coordinates.map(Number);
      screeningMap.setView([latitude, longitude], 12);
    } else if (locations.length > 1) {
      screeningMap.fitBounds(screeningHotspotLayer.getBounds().pad(0.2), { maxZoom: 12 });
    }
    window.requestAnimationFrame(() => screeningMap.invalidateSize());
  }

  function renderScreeningVolumeLegend() {
    if (!screeningVolumeLegend) return;
    screeningVolumeLegend.replaceChildren();
    for (let step = 0; step <= 10; step += 1) {
      const share = step / 10;
      const diameter = 16 * Math.sqrt(share);
      const circle = document.createElement('span');
      circle.className = 'map-size-example';
      circle.style.width = `${diameter}px`;
      circle.style.height = `${diameter}px`;
      circle.title = `${step * 10}%`;
      screeningVolumeLegend.append(circle);
    }
  }

  function interpolateHeatColor(share) {
    const stops = [
      { position: 0, color: '#70b7a7' },
      { position: 0.25, color: '#a2b85a' },
      { position: 0.5, color: '#e0bd52' },
      { position: 0.75, color: '#e78b46' },
      { position: 1, color: '#c8505d' }
    ];
    const upperIndex = stops.findIndex(stop => share <= stop.position);
    const upperStop = stops[Math.max(0, upperIndex)];
    const lowerStop = stops[Math.max(0, upperIndex - 1)];
    const ratio = upperStop.position === lowerStop.position
      ? 0
      : (share - lowerStop.position) / (upperStop.position - lowerStop.position);
    const lowerChannels = lowerStop.color.slice(1).match(/.{2}/g).map(channel => parseInt(channel, 16));
    const upperChannels = upperStop.color.slice(1).match(/.{2}/g).map(channel => parseInt(channel, 16));
    const blendedChannels = lowerChannels.map((channel, index) =>
      Math.round(channel + (upperChannels[index] - channel) * ratio)
    );
    return `#${blendedChannels.map(channel => channel.toString(16).padStart(2, '0')).join('')}`;
  }

  function normalizePlace(value) {
    return String(value || '').normalize('NFKC').toLocaleLowerCase().replace(/[\s、，,。.]/g, '');
  }

  function changePage(direction) {
    currentPage += direction;
    renderResponses();
  }

  function exportResponses() {
    const filtered = getFilteredResponses();
    const knownFields = new Set(RESPONSE_DETAIL_GROUPS.flatMap(group => group.fields));
    const exportFields = [
      ...RESPONSE_DETAIL_GROUPS.flatMap(group => group.fields.map(key => ({
        key,
        label: `${group.title} - ${RESPONSE_FIELD_LABELS[key] || humanizeFieldName(key)}`
      }))),
      ...Array.from(new Set(filtered.flatMap(response => Object.keys(response.response_data || {}))))
        .filter(key => !knownFields.has(key))
        .sort((left, right) => left.localeCompare(right, 'zh-TW'))
        .map(key => ({ key, label: `其他資料 - ${humanizeFieldName(key)}` }))
    ];
    const rows = [[
      '資料編號', '送出時間', '填答語言', '問卷版本',
      ...exportFields.map(field => field.label)
    ]];
    filtered.forEach(response => {
      const data = response.response_data || {};
      rows.push([
        response.id,
        formatDate(response.created_at),
        response.language === 'en' ? 'English' : '繁體中文',
        response.schema_version ? `第 ${response.schema_version} 版` : '',
        ...exportFields.map(({ key }) => {
          const value = key === 'anonymous_consult_code' ? getConsultationCode(response) : data[key];
          return hasResponseValue(value) ? formatResponseValue(key, value) : '';
        })
      ]);
    });
    const csv = rows.map(row => row.map(csvCell).join(',')).join('\r\n');
    const blob = new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8' });
    const link = document.createElement('a');
    const objectUrl = URL.createObjectURL(blob);
    link.href = objectUrl;
    link.download = `questionnaire-responses-${new Date().toISOString().slice(0, 10)}.csv`;
    link.hidden = true;
    document.body.append(link);
    link.click();
    window.setTimeout(() => {
      link.remove();
      URL.revokeObjectURL(objectUrl);
    }, 1000);
    showStatus(dashboardStatus, `已匯出 ${filtered.length} 筆資料。`);
  }

  function csvCell(value) {
    const text = String(value);
    const safeText = /^[\t\r ]*[=+\-@]/.test(text) ? `'${text}` : text;
    return `"${safeText.replaceAll('"', '""')}"`;
  }

  function showResponse(response) {
    responseDetails.replaceChildren();
    const data = response.response_data || {};
    appendConsultationWorkflow(response);
    const knownFields = new Set(RESPONSE_DETAIL_GROUPS.flatMap(group => group.fields));
    const groups = [
      {
        title: '提交資訊',
        fields: [
          ['record_id', '資料編號', response.id],
          ['created_at', '送出時間', formatDate(response.created_at)],
          ['language', '填答語言', response.language === 'en' ? 'English' : '繁體中文'],
          ['schema_version', '問卷版本', response.schema_version ? `第 ${response.schema_version} 版` : '']
        ]
      },
      ...RESPONSE_DETAIL_GROUPS.map(group => ({
        title: group.title,
        fields: group.fields.map(key => [key, RESPONSE_FIELD_LABELS[key] || humanizeFieldName(key), data[key]])
      })),
      {
        title: '其他資料',
        fields: Object.entries(data)
          .filter(([key]) => !knownFields.has(key))
          .sort(([left], [right]) => left.localeCompare(right, 'zh-TW'))
          .map(([key, value]) => [key, humanizeFieldName(key), value])
      }
    ];

    let sectionIndex = 0;
    groups.forEach(group => {
      const conditionalRules = new Map();
      const conditionalChildren = new Map();
      RESPONSE_CONDITIONAL_GROUPS.forEach(rule => {
        rule.children.forEach(key => conditionalRules.set(key, rule));
      });
      const visibleFields = group.fields.filter(([key, , value]) => {
        if (key === 'screening_photos' || key === 'anonymous_consult_code' || !hasResponseValue(value)) return false;
        const rule = conditionalRules.get(key);
        return !rule || rule.isActive(data);
      });
      if (!visibleFields.length) return;

      visibleFields.forEach(field => {
        const rule = conditionalRules.get(field[0]);
        if (!rule) return;
        const children = conditionalChildren.get(rule.parent) || [];
        children.push(field);
        conditionalChildren.set(rule.parent, children);
      });

      const section = document.createElement('details');
      section.className = 'response-section';
      section.setAttribute('aria-labelledby', `response-section-${sectionIndex}`);
      const heading = document.createElement('summary');
      heading.id = `response-section-${sectionIndex}`;
      heading.className = 'response-section-title';
      heading.textContent = group.title;
      const fieldsList = document.createElement('dl');
      fieldsList.className = 'response-details';

      const appendConditionalChildren = (container, parentKey, depth = 0) => {
        const children = conditionalChildren.get(parentKey);
        if (!children?.length) return;

        const relatedGroup = document.createElement('div');
        relatedGroup.className = 'response-related-fields';
        if (depth === 0) {
          const relatedHeading = document.createElement('p');
          relatedHeading.className = 'response-related-heading';
          relatedHeading.textContent = '條件式追問';
          relatedGroup.append(relatedHeading);
        }

        children.forEach(([childKey, childLabel, childValue]) => {
          const relatedAnswer = document.createElement('div');
          relatedAnswer.className = 'response-related-answer';
          const relatedLabel = document.createElement('span');
          const relatedValue = document.createElement('span');
          relatedLabel.className = 'response-related-label';
          relatedLabel.textContent = childLabel;
          relatedValue.textContent = formatResponseValue(childKey, childValue);
          relatedAnswer.append(relatedLabel, relatedValue);
          appendConditionalChildren(relatedAnswer, childKey, depth + 1);
          relatedGroup.append(relatedAnswer);
        });

        container.append(relatedGroup);
      };

      visibleFields.filter(([key]) => !conditionalRules.has(key)).forEach(([key, label, value]) => {
        const term = document.createElement('dt');
        const description = document.createElement('dd');
        term.textContent = label;
        description.textContent = key === 'created_at' ? value : formatResponseValue(key, value);
        appendConditionalChildren(description, key);
        fieldsList.append(term, description);
      });

      section.append(heading, fieldsList);
      responseDetails.append(section);
      sectionIndex += 1;
    });
    dialog.showModal();
    appendScreeningPhotos(data.screening_photos).catch(() => {});
  }

  function getConsultationCode(response) {
    if (Object.hasOwn(response, 'anonymous_consult_code')) {
      return response.anonymous_consult_code || '';
    }
    return response.response_data?.anonymous_consult_code || '';
  }

  function appendConsultationWorkflow(response) {
    if (!window.StaffAccess.canAccess(activeStaffProfile, 'questionnaire.consultation')) return;

    const data = response.response_data || {};
    const section = document.createElement('section');
    section.className = 'consultation-workflow';

    const heading = document.createElement('h3');
    heading.textContent = '匿名諮詢處理';
    const headingRow = document.createElement('div');
    headingRow.className = 'consultation-workflow-heading';
    const note = document.createElement('p');
    note.textContent = '以下依匿名諮詢網題目順序整理本站可對照答案。外站未詢問或本站未收集的資料會明確標示，請依受檢者意願在外站補填；完成後將諮詢代碼存回此筆紀錄。';

    const answerFor = key => {
      if (key === 'frequency_closed_relationship' && data[key] === 'none') return '沒有固定性伴侶';
      return hasResponseValue(data[key]) ? formatResponseValue(key, data[key]) : '未填答';
    };
    const answerWithOther = (key, otherKey) => hasResponseValue(data[otherKey])
      ? `${answerFor(key)}（${data[otherKey]}）`
      : answerFor(key);
    const yesNo = key => typeof data[key] === 'boolean'
      ? (data[key] ? '是' : '否')
      : answerFor(key);
    const responseGroup = (title, fields) => ({
      title,
      rows: fields.map(([label, key, value]) => [label, value ?? answerFor(key)])
    });
    const stdFields = [
      ['HIV', 'std_aids'], ['菜花', 'std_genital_warts'], ['梅毒', 'std_syphilis'],
      ['淋病', 'std_gonorrhea'], ['披衣菌', 'std_chlamydia'], ['疱疹', 'std_genital_herpes'],
      ['A 型肝炎', 'std_hepatitis_a'], ['C 型肝炎', 'std_hepatitis_c']
    ].map(([label, key]) => [label, key, yesNo(key)]);
    if (data.std_aids) stdFields.push(['HIV 再次篩檢原因', 'std_aids_reason', answerFor('std_aids_reason')]);
    if (data.std_other_choice) stdFields.push(['其他性病', 'std_others', answerFor('std_others')]);

    const drugFields = [
      ['G 水（GHB）', 'drug_ghb'], ['搖頭丸（MDMA）', 'drug_mdma'], ['愷他命', 'drug_ketamine'],
      ['Rush', 'drug_rush'], ['喵喵／合成卡西酮', 'drug_mephedrone'], ['海洛因', 'drug_heroin'],
      ['大麻', 'drug_weed']
    ].map(([label, key]) => [label, key, yesNo(key)]);
    const amphetamineRoutes = [
      ['吸入', data.drug_amphetamine_inhalant],
      ['注射', data.drug_amphetamine_injection],
      ['口服', data.drug_amphetamine_oral]
    ].filter(([, selected]) => selected).map(([label]) => label);
    drugFields.unshift([
      '安非他命／甲基安非他命',
      'drug_amphetamine',
      data.drug_amphetamine
        ? `是${amphetamineRoutes.length ? `（${amphetamineRoutes.join('、')}）` : ''}`
        : yesNo('drug_amphetamine')
    ]);
    if (data.drug_other_choice) drugFields.push(['其他藥物', 'drug_others', answerFor('drug_others')]);

    const noSex = data.frequency_sex === 'no';
    const riskRows = [
      ['1. 最近一年是否有性行為', 'frequency_sex'],
      ['2. 每次性行為是否全程使用保險套', 'frequency_condom', noSex ? '未發生性行為' : undefined],
      ['3. 是否只與固定性伴侶發生性行為', 'frequency_closed_relationship', noSex ? '未發生性行為' : undefined],
      ['4. 性行為前後或過程中是否飲酒', 'frequency_alcohol', noSex ? '未發生性行為' : undefined],
      ['5. 性行為前後或過程中是否使用藥物', 'frequency_drug', noSex ? '未發生性行為' : undefined],
      ['6. 最近一年是否曾感染性病', 'frequency_std'],
      ...(data.frequency_std === 'yes' ? stdFields : []),
      ['7. 最近一年是否曾使用成癮藥物', 'usage_drug'],
      ...(data.usage_drug === 'yes' ? drugFields : []),
      ...(data.usage_drug === 'yes' ? [['目前是否仍持續使用藥物', 'frequency_drug_now']] : []),
      ['8a. 透過網路認識非固定伴侶並發生性行為', 'frequency_online_dating', noSex ? '未發生性行為' : undefined],
      ['8b. 在娛樂場所認識非固定伴侶並發生性行為', 'frequency_public_dating', noSex ? '未發生性行為' : undefined],
      ['8c. 提供性交易服務', 'frequency_sex_service', noSex ? '未發生性行為' : undefined],
      ['8d. 性消費／買春', 'frequency_sex_consumption', noSex ? '未發生性行為' : undefined],
      ['9. 固定性伴侶是否為 HIV 感染者', 'closed_relationship_aids', noSex || data.frequency_closed_relationship === 'none' ? '目前沒有固定性伴侶' : undefined],
      ['10. 最近一年是否使用過 PEP', 'frequency_pep'],
      ['11. 是否有意願使用 PEP', 'frequency_pep_willingness'],
      ['12. 是否聽過 PrEP', 'frequency_prep'],
      ['13. 是否有意願使用 PrEP', 'frequency_prep_willingness']
    ];
    const hometown = answerWithOther('hometown', 'hometown_others');
    const residence = answerWithOther('residence', 'residence_others');
    const gender = answerWithOther('gender', 'gender_others');
    const orientation = answerWithOther('orientation', 'orientation_others');
    const answerGroups = [
      {
        title: '一、風險評估',
        rows: riskRows.map(([label, key, value]) => [label, value ?? answerFor(key)])
      },
      responseGroup('二、基本資料', [
        ['性別', 'gender', gender], ['國籍', 'nationality'], ['出生年份', 'birth'],
        ['18 歲以前居住地', 'hometown', hometown], ['目前居住地', 'residence', residence],
        ['性傾向', 'orientation', orientation], ['教育程度', 'education']
      ]),
      {
        title: '三、篩檢習慣與聯絡資料',
        rows: [
          ['是否定期接受 HIV 篩檢', ({ '-1': '從未篩檢', '0': '否（偶爾篩檢）', '1': '是' })[String(data.frequency_screening)] || '未填答'],
          ['最近一次篩檢日期（本站補充，外站未詢問）', answerFor('last_screening_at')],
          ['外站選填聯絡方式', '本站未收集；如受檢者同意，請在外站另行詢問並填寫']
        ]
      }
    ];
    const answerList = document.createElement('div');
    answerList.className = 'consultation-answer-groups';
    answerGroups.forEach(group => {
      const groupSection = document.createElement('details');
      groupSection.className = 'consultation-answer-group';
      const groupHeading = document.createElement('summary');
      groupHeading.textContent = group.title;
      const details = document.createElement('dl');
      details.className = 'consultation-answers';
      group.rows.forEach(([label, value]) => {
        const term = document.createElement('dt');
        const description = document.createElement('dd');
        term.textContent = label;
        description.textContent = value;
        details.append(term, description);
      });
      groupSection.append(groupHeading, details);
      answerList.append(groupSection);
    });

    const openLink = document.createElement('a');
    openLink.className = 'admin-button secondary';
    openLink.href = 'https://hiva.cdc.gov.tw/';
    openLink.target = '_blank';
    openLink.rel = 'noopener noreferrer';
    openLink.textContent = '匿名諮詢網';
    const copyButton = document.createElement('button');
    copyButton.className = 'admin-button secondary icon-only';
    copyButton.type = 'button';
    copyButton.setAttribute('aria-label', '複製對照答案');
    copyButton.title = '複製對照答案';
    const copyIcon = document.createElement('span');
    copyIcon.className = 'material-icons notranslate';
    copyIcon.setAttribute('translate', 'no');
    copyIcon.setAttribute('aria-hidden', 'true');
    copyIcon.textContent = 'content_copy';
    copyButton.append(copyIcon);
    const copyStatus = document.createElement('p');
    copyStatus.className = 'admin-status';
    copyStatus.setAttribute('role', 'status');
    copyStatus.hidden = true;
    copyButton.addEventListener('click', async () => {
      try {
        const copyText = answerGroups.flatMap(group => [
          group.title,
          ...group.rows.map(([label, value]) => `${label}：${value}`)
        ]).join('\n');
        await navigator.clipboard.writeText(copyText);
        showStatus(copyStatus, '對照答案已複製。');
      } catch {
        showStatus(copyStatus, '無法複製答案，請確認瀏覽器剪貼簿權限。', true);
      }
    });
    headingRow.append(heading, copyButton);

    const codeForm = document.createElement('form');
    codeForm.className = 'consultation-code-form';
    const codeLabel = document.createElement('label');
    codeLabel.textContent = '諮詢代碼';
    codeLabel.htmlFor = 'consultation-code-input';
    const codeField = document.createElement('div');
    codeField.className = 'consultation-code-field';
    const codeTags = document.createElement('div');
    codeTags.className = 'consultation-code-tags';
    codeTags.setAttribute('aria-label', '已加入的諮詢代碼');
    codeTags.setAttribute('aria-live', 'polite');
    const codeEntry = document.createElement('div');
    codeEntry.className = 'consultation-code-entry';
    const codeInput = document.createElement('input');
    codeInput.type = 'text';
    codeInput.id = 'consultation-code-input';
    codeInput.maxLength = 32;
    codeInput.placeholder = '輸入代碼後按 Enter／逗號';
    codeInput.autocomplete = 'off';
    let consultationCodes = [...new Set(getConsultationCode(response).split(',').map(code => code.trim()).filter(Boolean))];

    const renderConsultationCodeTags = () => {
      codeTags.replaceChildren();
      codeTags.hidden = consultationCodes.length === 0;
      consultationCodes.forEach((code, index) => {
        const chip = document.createElement('button');
        chip.type = 'button';
        chip.className = 'selected-value consultation-code-chip';
        chip.dataset.codeIndex = index;
        chip.setAttribute('aria-label', `移除諮詢代碼 ${code}`);
        chip.textContent = `${code} ×`;
        codeTags.append(chip);
      });
    };

    const addConsultationCodes = value => {
      const incomingCodes = value.split(/[\r\n,，;；]+/).map(code => code.trim()).filter(Boolean);
      const invalidCode = incomingCodes.find(code => !/^[A-Za-z0-9-]{4,32}$/.test(code));
      const nextCodes = [...new Set([...consultationCodes, ...incomingCodes])];
      if (invalidCode) codeInput.setCustomValidity('每組代碼需為 4–32 個英數字或連字號。');
      else if (nextCodes.length > 20) codeInput.setCustomValidity('每筆紀錄最多可輸入 20 組諮詢代碼。');
      else codeInput.setCustomValidity('');
      if (codeInput.validationMessage) {
        codeInput.reportValidity();
        return false;
      }
      consultationCodes = nextCodes;
      renderConsultationCodeTags();
      codeInput.value = '';
      return true;
    };

    const commitCodeInput = () => {
      if (!codeInput.value.trim()) return false;
      return addConsultationCodes(codeInput.value);
    };

    codeInput.addEventListener('input', () => codeInput.setCustomValidity(''));
    codeInput.addEventListener('keydown', event => {
      if (event.isComposing) return;
      if (event.key === 'Enter' || event.key === ',' || event.key === '，' || event.key === ';' || event.key === '；') {
        if (!codeInput.value.trim() && event.key === 'Enter') return;
        event.preventDefault();
        commitCodeInput();
      } else if (event.key === 'Backspace' && !codeInput.value && consultationCodes.length) {
        consultationCodes.pop();
        renderConsultationCodeTags();
      }
    });
    codeInput.addEventListener('paste', event => {
      const pastedText = event.clipboardData?.getData('text') || '';
      if (!/[\r\n,，;；]/.test(pastedText)) return;
      event.preventDefault();
      addConsultationCodes(pastedText);
    });
    codeTags.addEventListener('click', event => {
      const chip = event.target.closest('[data-code-index]');
      if (!chip) return;
      consultationCodes.splice(Number(chip.dataset.codeIndex), 1);
      renderConsultationCodeTags();
      codeInput.focus();
    });
    renderConsultationCodeTags();
    const saveButton = document.createElement('button');
    saveButton.className = 'admin-button icon-only';
    saveButton.type = 'submit';
    saveButton.setAttribute('aria-label', '儲存代碼');
    saveButton.title = '儲存代碼';
    const saveIcon = document.createElement('span');
    saveIcon.className = 'material-icons notranslate';
    saveIcon.setAttribute('translate', 'no');
    saveIcon.setAttribute('aria-hidden', 'true');
    saveIcon.textContent = 'save';
    saveButton.append(saveIcon);
    codeEntry.append(codeInput, saveButton);
    codeField.append(codeTags, codeEntry);
    const saveStatus = document.createElement('p');
    saveStatus.className = 'admin-status';
    saveStatus.setAttribute('role', 'status');
    saveStatus.hidden = true;
    openLink.classList.add('consultation-code-link');
    codeForm.append(codeLabel, codeField, openLink);
    codeForm.addEventListener('submit', async event => {
      event.preventDefault();
      if (codeInput.value.trim() && !commitCodeInput()) return;
      const codes = consultationCodes;
      if (!codes.length) codeInput.setCustomValidity('請至少輸入一組諮詢代碼。');
      else codeInput.setCustomValidity('');
      if (!codeInput.reportValidity()) return;

      const code = codes.join(',');
      setButtonBusy(saveButton, true, '儲存中');
      const { data: updated, error } = await window.questionnaireSupabase
        .from('questionnaire_responses')
        .update({ anonymous_consult_code: code })
        .eq('id', response.id)
        .select('id')
        .maybeSingle();
      setButtonBusy(saveButton, false, '儲存代碼');

      if (error || !updated) {
        showStatus(saveStatus, '儲存失敗。請確認資料庫已更新且帳號具管理權限。', true);
        return;
      }

      response.anonymous_consult_code = code;
      response.response_data = { ...response.response_data, anonymous_consult_code: code };
      renderResponses();
      showStatus(saveStatus, `已儲存 ${codes.length} 組諮詢代碼。`);
    });

    section.append(headingRow, copyStatus, note, codeForm, saveStatus, answerList);
    responseDetails.append(section);
  }

  async function appendScreeningPhotos(photos) {
    if (!photos || typeof photos !== 'object') return;
    const entries = Object.entries(photos)
      .filter(([kind, path]) => SCREENING_PHOTO_LABELS[kind] && SCREENING_PHOTO_PATH.test(String(path)) && String(path).includes(`/${kind}.`));
    if (!entries.length) return;

    const section = document.createElement('details');
    section.className = 'response-section';
    const heading = document.createElement('summary');
    heading.className = 'response-section-title';
    heading.textContent = '陽性試劑照片';
    const content = document.createElement('div');
    content.className = 'response-photos';
    content.textContent = '照片載入中。';
    section.append(heading, content);
    responseDetails.append(section);

    const { data, error } = await window.questionnaireSupabase.storage
      .from(SCREENING_PHOTO_BUCKET)
      .createSignedUrls(entries.map(([, path]) => path), 300);
    if (!section.isConnected) return;
    if (error || !data) {
      content.textContent = '無法載入照片，請確認資料庫已更新且帳號具管理權限。';
      return;
    }

    content.replaceChildren();
    entries.forEach(([kind], index) => {
      const signedUrl = data[index]?.signedUrl;
      if (!signedUrl) return;
      const figure = document.createElement('figure');
      figure.className = 'response-photo';
      const link = document.createElement('a');
      link.href = signedUrl;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      const image = document.createElement('img');
      image.src = signedUrl;
      image.alt = SCREENING_PHOTO_LABELS[kind];
      image.loading = 'lazy';
      image.referrerPolicy = 'no-referrer';
      link.append(image);
      const caption = document.createElement('figcaption');
      caption.textContent = SCREENING_PHOTO_LABELS[kind];
      figure.append(link, caption);
      content.append(figure);
    });
    if (!content.children.length) content.textContent = '無法載入照片。';
  }

  function showStatus(element, message, isError = false) {
    element.textContent = message;
    element.classList.toggle('error', isError);
    element.hidden = false;
  }

  function setButtonBusy(button, busy, label) {
    button.disabled = busy;
    button.querySelector('.material-icons')?.classList.toggle('spin', busy);
    const labelElement = button.querySelector('[data-button-label]');
    const textNodes = Array.from(button.childNodes).filter(node => node.nodeType === Node.TEXT_NODE);
    const text = textNodes[textNodes.length - 1];
    if (labelElement) {
      labelElement.textContent = label;
    } else if (text) {
      text.textContent = ` ${label}`;
    }
  }

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

  function escapeHtml(value) {
    return String(value)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }
});
