(function (global) {
  const Model = global.RichContentModel;
  if (!Model) return;

  const LABELS = { mastodon: 'Mastodon', facebook: 'Facebook', twitter: 'X / Twitter', youtube: 'YouTube', link: '外部連結' };
  const el = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text) node.textContent = text;
    return node;
  };

  function externalLink(url, text) {
    const link = el('a', 'sd-link', text);
    link.href = url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    return link;
  }

  function frame(src, title, className) {
    const iframe = el('iframe', className);
    iframe.src = src;
    iframe.title = title;
    iframe.loading = 'lazy';
    iframe.referrerPolicy = 'no-referrer';
    iframe.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-popups allow-presentation');
    iframe.setAttribute('allowfullscreen', '');
    return iframe;
  }

  async function loadMastodon(item, list, status) {
    const origin = new URL(item.url).origin;
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 10000);
      const response = await fetch(`${origin}/api/v1/statuses/${item.id}/context`, { headers: { Accept: 'application/json' }, signal: controller.signal, credentials: 'omit', referrerPolicy: 'no-referrer' });
      clearTimeout(timer);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      const replies = (data.descendants || []).filter(reply => reply.visibility === 'public' || reply.visibility === 'unlisted').slice(0, 50);
      status.textContent = replies.length ? `${replies.length} 則回覆` : '目前還沒有回覆。';
      replies.forEach(reply => {
        const card = el('li', 'sd-reply');
        const head = el('div', 'sd-reply-head');
        const avatar = RichContent.safeUrl(reply.account?.avatar_static || '', { media: true });
        if (/^https:/.test(avatar)) {
          const img = el('img', 'sd-avatar');
          img.src = avatar; img.alt = ''; img.loading = 'lazy'; img.referrerPolicy = 'no-referrer';
          head.append(img);
        }
        const name = el('strong', '', String(reply.account?.display_name || reply.account?.username || '').slice(0, 80));
        const handle = el('span', 'sd-handle', `@${String(reply.account?.acct || '').slice(0, 80)}`);
        const time = el('time', 'sd-time', reply.created_at ? new Date(reply.created_at).toLocaleString('zh-TW', { dateStyle: 'medium', timeStyle: 'short' }) : '');
        head.append(name, handle, time);
        const body = el('div', 'sd-reply-body rc-content');
        body.append(RichContent.sanitize(String(reply.content || '')));
        card.append(head, body);
        const source = RichContent.safeUrl(reply.url || '');
        if (source) card.append(externalLink(source, '查看原文'));
        list.append(card);
      });
    } catch {
      status.textContent = '暫時無法載入回覆（該伺服器可能未開放公開讀取）。';
    }
  }

  function render(container, urls) {
    container.replaceChildren();
    const items = Model.parseDiscussionUrls(urls).map(Model.classifyDiscussion).filter(Boolean);
    container.hidden = !items.length;
    if (!items.length) return;
    container.classList.add('sd-discussion');
    container.append(el('h4', 'sd-title', '社群討論'));
    items.forEach(item => {
      const block = el('section', `sd-item sd-${item.kind}`);
      block.append(el('h5', 'sd-platform', LABELS[item.kind]));
      if (item.kind === 'mastodon') {
        const status = el('p', 'sd-status', '載入回覆中…');
        status.setAttribute('role', 'status');
        const list = el('ol', 'sd-replies');
        block.append(status, list, externalLink(item.url, '在 Mastodon 查看或回覆'));
        loadMastodon(item, list, status);
      } else if (item.kind === 'link') {
        block.append(externalLink(item.url, `前往討論：${item.host}`));
      } else {
        block.append(frame(item.src, `${LABELS[item.kind]} 貼文`, `sd-frame sd-frame-${item.kind}`));
        block.append(externalLink(item.url, item.kind === 'youtube' ? '在 YouTube 查看留言' : `在 ${LABELS[item.kind]} 查看完整討論`));
      }
      container.append(block);
    });
  }

  global.SocialDiscussion = Object.freeze({ render });
})(window);
