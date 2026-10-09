const taiwanAdminLocations = [
  '基隆市', '臺北市', '新北市', '桃園市', '新竹市', '新竹縣', '苗栗縣',
  '臺中市', '彰化縣', '南投縣', '雲林縣', '嘉義市', '嘉義縣', '臺南市',
  '高雄市', '屏東縣', '宜蘭縣', '花蓮縣', '臺東縣', '澎湖縣', '金門縣', '連江縣', '其他'
];

document.addEventListener('DOMContentLoaded', function() {
  initializeQuestionnaireFields();

  // 初始化 Materialize 元件
  if (window.M) {
    M.FloatingActionButton.init(document.querySelectorAll('.fixed-action-btn'));
    M.Tooltip.init(document.querySelectorAll('.tooltipped'));
    const siteSelects = Array.from(document.querySelectorAll('select'))
      .filter(select => !select.closest('#questionnaire-form'));
    M.FormSelect.init(siteSelects);
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
        if (!validateScreeningInterpretation(questionnaireForm)) return;
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

  initializeLocationPickers(taiwanAdminLocations);

  initializeNationalityPicker();
  initializeScreeningDate();
  initializeScreeningInterpretation();
  initializeScreeningPlace();
}

function initializeScreeningDate() {
  const input = document.getElementById('screening_at');
  if (!input || input.value) return;
  const now = new Date();
  input.value = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

function initializeScreeningInterpretation() {
  const inputs = Array.from(document.querySelectorAll('input[name="screening_interpretation[]"]'));
  const message = document.getElementById('screening-interpretation-message');
  const hivInputs = inputs.filter(input => input.value.startsWith('hiv_'));
  const windowPeriodField = document.getElementById('hiv-window-period-field');
  const windowPeriodSelect = document.querySelector('select[name="hiv_window_period"]');
  const updateHivWindowPeriod = () => {
    const showWindowPeriod = hivInputs.some(input => input.checked);
    if (windowPeriodField) windowPeriodField.hidden = !showWindowPeriod;
    if (windowPeriodSelect) {
      windowPeriodSelect.required = showWindowPeriod;
      if (!showWindowPeriod) windowPeriodSelect.value = '3_months';
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
      if (inputs.some(option => option.checked) && message) {
        message.hidden = true;
        message.textContent = '';
      }
    });
    updateSelection();
  });
  updateHivWindowPeriod();
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

function initializeScreeningPlace() {
  const input = document.getElementById('screening_place');
  const locateButton = document.getElementById('screening-locate-button');
  const suggestions = document.getElementById('screening-place-suggestions');
  const status = document.getElementById('screening-place-status');
  const map = document.getElementById('screening-place-map');
  const mapCanvas = document.getElementById('screening-place-map-canvas');
  const infoButton = document.getElementById('screening-place-info-button');
  const infoPopover = document.getElementById('screening-place-info-popover');
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
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      closeSuggestions();
      setInfoOpen(false);
    }
  });

  document.addEventListener('pointerdown', event => {
    if (!input.contains(event.target) && !suggestions.contains(event.target)) closeSuggestions();
    if (!infoContainer.contains(event.target)) setInfoOpen(false);
  });
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
      listbox.style.top = openAbove
        ? `${Math.max(8, rect.top - maxHeight - 4)}px`
        : `${rect.bottom + 4}px`;
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
      if (event.key === 'Escape') {
        close();
      } else if (event.key === 'ArrowDown' && options.length) {
        event.preventDefault();
        activeIndex = Math.min(activeIndex + 1, options.length - 1);
      } else if (event.key === 'ArrowUp' && options.length) {
        event.preventDefault();
        activeIndex = Math.max(activeIndex - 1, 0);
      } else if (event.key === 'Enter' && listbox.hidden === false && activeIndex >= 0) {
        event.preventDefault();
        choose(options[activeIndex].textContent);
        return;
      } else {
        return;
      }

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
      const value = Number(frequency.value);
      const label = labels.get(value);
      frequencyOutput.value = label;
      frequencyOutput.textContent = label;
      frequency.setAttribute('aria-valuetext', label);
      const progress = ((value - Number(frequency.min)) / (Number(frequency.max) - Number(frequency.min))) * 100;
      frequency.style.setProperty('--range-progress', `${progress}%`);
      labelElements.forEach(labelElement => {
        const isActive = Number(labelElement.dataset.frequencyValue) === value;
        labelElement.classList.toggle('is-active', isActive);
        if (isActive) labelElement.setAttribute('aria-current', 'true');
        else labelElement.removeAttribute('aria-current');
      });
      if (value === -1) form.querySelector('#last_screening_at').value = '';
    };
    frequency.addEventListener('input', updateFrequency);
    updateFrequency();
  }

  let currentStep = 0;
  const sectionButtons = Array.from(document.querySelectorAll('[data-questionnaire-section]'));
  let furthestSectionIndex = 0;
  let editReturnStep = null;
  let editGroupRange = null;
  let editingSummary = null;

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
    const backButton = document.createElement('button');
    backButton.type = 'button';
    backButton.className = 'btn-flat question-back';
    backButton.dataset.questionBack = '';
    backButton.textContent = '上一題';
    const legend = step.matches('fieldset') ? step.querySelector(':scope > legend') : null;
    if (legend) legend.after(backButton);
    else step.prepend(backButton);
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

  const showStep = (index, shouldScroll = false) => {
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

    const locationInput = step.querySelector('#hometown, #residence');
    if (locationInput?.value) {
      const isKnownLocation = taiwanAdminLocations.includes(locationInput.value.trim());
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
    if (editReturnStep !== null && editGroupRange) {
      let nextEditStep = currentStep + 1;
      while (nextEditStep <= editGroupRange.end && !isStepAvailable(steps[nextEditStep])) {
        nextEditStep += 1;
      }
      if (nextEditStep <= editGroupRange.end) showStep(nextEditStep, true);
      else finishAnswerEdit();
      return;
    }
    let nextStep = currentStep + 1;
    while (nextStep < steps.length && !isStepAvailable(steps[nextStep])) {
      nextStep += 1;
    }
    if (nextStep < steps.length) showStep(nextStep, true);
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

    const genderStep = stepFor('#gender_select');
    const nationalityStep = stepFor('#nationality-search');
    const hometownStep = stepFor('#hometown');
    const residenceStep = stepFor('#residence');
    const educationStep = stepFor('#education');
    add('nickname', '暱稱', stepFor('#nickname'), '暱稱', form.querySelector('#nickname')?.value, '未提供');
    add('profile', '基本資料', genderStep, '性別', otherText('gender_select', 'gender_others'));
    add('profile', '基本資料', stepFor('#orientation_select'), '性傾向', otherText('orientation_select', 'orientation_others'));
    add('profile', '基本資料', stepFor('#birth'), '出生年份', selectedText('birth'));
    const nationalities = Array.from(form.querySelectorAll('input[name="nationality[]"]:checked'))
      .map(input => input.dataset.nationalityName);
    add('profile', '基本資料', nationalityStep, '國籍', nationalities.join('、'));
    add('profile', '基本資料', hometownStep, '成年前居住地', locationText('hometown', 'hometown_others'));
    add('profile', '基本資料', residenceStep, '目前居住地', locationText('residence', 'residence_others'));
    add('profile', '基本資料', educationStep, '教育程度', selectedText('education'));
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
      add('notice', '篩檢須知', stepFor('#last_screening_at'), '最近一次篩檢日期', form.querySelector('#last_screening_at')?.value);
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
      const groupRange = steps.map((step, index) => ({ step, index })).filter(({ step }) =>
        step.closest('.card-content') === content
      );
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
      const checkedBoxes = Array.from(group.querySelectorAll('input[type="checkbox"]:checked'))
        .map(input => input.closest('label')?.querySelector('span')?.textContent.trim()).filter(Boolean);
      const textAnswers = Array.from(group.querySelectorAll('input[type="text"], textarea'))
        .filter(input => input.value.trim())
        .map(input => {
          const label = input.id && form.querySelector(`label[for="${input.id}"]`);
          return `${label?.textContent.trim() || '其他'}：${input.value.trim()}`;
        });
      const answerParts = [];
      if (radios.length) answerParts.push(radioAnswer || '尚未回答');
      if (checkedBoxes.length) answerParts.push(checkedBoxes.join('、'));
      else if (checkedRadio?.value === 'yes' && group.querySelector('input[type="checkbox"]')) answerParts.push('尚未勾選項目');
      answerParts.push(...textAnswers);
      add(key, heading, group, question, answerParts.join('；'), '未回答');
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

    const toggleEditButton = event.target.closest('[data-toggle-answer-edit]');
    if (toggleEditButton) {
      const summary = toggleEditButton.closest('.screening-answer-summary, .profile-confirmation')
        ?.querySelector('.answer-summary');
      if (!summary) return;
      if (summary.dataset.editMode === 'true') {
        summary.dataset.editMode = 'false';
        toggleEditButton.textContent = '返回修改';
        toggleEditButton.setAttribute('aria-pressed', 'false');
        renderQuestionnaireAnswerSummary(summary);
      } else {
        summary.dataset.editMode = 'true';
        toggleEditButton.textContent = '取消修改';
        toggleEditButton.setAttribute('aria-pressed', 'true');
        renderQuestionnaireAnswerSummary(summary);
      }
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

    if (input.matches('#hometown, #residence')) {
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
