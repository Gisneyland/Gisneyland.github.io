(function (global) {
  'use strict';
  const MAX_TEXT = 12000;
  function administrator(profile) {
    return Boolean(profile && profile.account_role === 'administrator'
      && profile.approval_status === 'approved' && profile.privacy_consent_at);
  }
  function safeURL(value) {
    if (typeof value !== 'string' || value.length > 2048 || /[\u0000-\u0020\u007f\\]/.test(value)) return null;
    if (/^(\/(?!\/)|#|\?)/.test(value)) return value;
    if (/^(https?:\/\/|mailto:|tel:)/i.test(value)) {
      try {
        const url = new URL(value);
        if (url.username || url.password) return null;
        return value;
      } catch { return null; }
    }
    return null;
  }
  function empty() { return { version: 1, patches: {}, orders: {}, blocks: [], navigation: null }; }
  function publicPage(value) {
    return typeof value === 'string' && /^\/(?:[a-zA-Z0-9_.-]+\/)*[a-zA-Z0-9_.-]*$/.test(value)
      && !value.split('/').some(part => part === '.' || part === '..')
      && !/^\/admin(?:\/|$)/.test(value);
  }
  function plain(value) { return value && typeof value === 'object' && !Array.isArray(value); }
  function keys(value, allowed) {
    if (!plain(value) || Object.keys(value).some(key => !allowed.includes(key))) throw new Error('不支援的內容格式');
  }
  function text(value, max = MAX_TEXT) {
    if (typeof value !== 'string' || value.length > max || value.includes('\u0000')) throw new Error('文字過長或格式錯誤');
    return value;
  }
  function key(value) {
    if (typeof value !== 'string' || !/^[a-zA-Z0-9_./:#-]{1,240}$/.test(value)
      || ['__proto__', 'prototype', 'constructor'].includes(value)) throw new Error('內容識別碼錯誤');
    return value;
  }
  function link(value) {
    if (!safeURL(value)) throw new Error('連結僅限 /站內路徑、#錨點、https、http、mailto 或 tel（不可含空白）');
    return value;
  }
  function normalize(value) {
    keys(value, ['version', 'patches', 'orders', 'blocks', 'navigation']);
    if (value.version !== 1) throw new Error('內容版本不相容');
    const result = empty();
    if (!plain(value.patches) || Object.keys(value.patches).length > 2500) throw new Error('內容修改過多');
    for (const [id, patch] of Object.entries(value.patches)) {
      key(id); keys(patch, ['text', 'href', 'deleted']);
      const safe = {};
      if ('text' in patch) safe.text = text(patch.text);
      if ('href' in patch) safe.href = link(patch.href);
      if ('deleted' in patch) {
        if (typeof patch.deleted !== 'boolean') throw new Error('刪除標記錯誤');
        safe.deleted = patch.deleted;
      }
      result.patches[id] = safe;
    }
    if (!plain(value.orders) || Object.keys(value.orders).length > 500) throw new Error('排序格式錯誤');
    for (const [id, order] of Object.entries(value.orders)) {
      key(id);
      if (!Array.isArray(order) || order.length > 500 || new Set(order).size !== order.length) throw new Error('排序項目重複或過多');
      result.orders[id] = order.map(key);
    }
    if (!Array.isArray(value.blocks) || value.blocks.length > 200) throw new Error('新增區塊過多');
    const ids = new Set();
    result.blocks = value.blocks.map(block => {
      keys(block, ['id', 'parent', 'before', 'title', 'body', 'url', 'label']);
      key(block.id); key(block.parent);
      if (ids.has(block.id)) throw new Error('區塊識別碼重複');
      ids.add(block.id);
      const safe = { id: block.id, parent: block.parent, title: text(block.title, 300),
        body: text(block.body), url: block.url ? link(block.url) : '', label: text(block.label, 300) };
      if ('before' in block) safe.before = block.before === '' ? '' : key(block.before);
      return safe;
    });
    if (value.navigation !== null) {
      keys(value.navigation, ['main', 'more']);
      result.navigation = {};
      const navIds = new Set();
      for (const group of ['main', 'more']) {
        if (!Array.isArray(value.navigation[group]) || value.navigation[group].length > 30) throw new Error('導覽項目過多');
        result.navigation[group] = value.navigation[group].map(item => {
          keys(item, ['id', 'label', 'url']);
          key(item.id);
          if (navIds.has(item.id)) throw new Error('導覽識別碼重複');
          navIds.add(item.id);
          return { id: item.id, label: text(item.label, 100), url: link(item.url) };
        });
      }
    }
    if (JSON.stringify(result).length > 300000) throw new Error('頁面內容過大');
    return result;
  }
  function fingerprint(value) {
    let hash = 2166136261;
    for (let i = 0; i < value.length; i += 1) hash = Math.imul(hash ^ value.charCodeAt(i), 16777619);
    return (hash >>> 0).toString(36);
  }
  global.SiteEditorModel = Object.freeze({ administrator, safeURL, publicPage, empty, normalize, fingerprint });
})(globalThis);
