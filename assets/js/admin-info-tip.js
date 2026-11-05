(function (global) {
  let counter = 0;
  let openTip = null;

  function place(tip) {
    const margin = 8;
    const button = tip.button.getBoundingClientRect();
    tip.body.style.maxWidth = `${Math.min(352, window.innerWidth - margin * 2)}px`;
    const body = tip.body.getBoundingClientRect();
    const left = Math.max(margin, Math.min(button.left, window.innerWidth - body.width - margin));
    const below = button.bottom + 6;
    const top = below + body.height > window.innerHeight - margin && button.top - body.height - 6 > margin
      ? button.top - body.height - 6
      : below;
    tip.body.style.left = `${left}px`;
    tip.body.style.top = `${top}px`;
    // A transformed or contained ancestor makes fixed positioning relative to it; correct the offset.
    const actual = tip.body.getBoundingClientRect();
    if (Math.abs(actual.left - left) > 1 || Math.abs(actual.top - top) > 1) {
      tip.body.style.left = `${left + left - actual.left}px`;
      tip.body.style.top = `${top + top - actual.top}px`;
    }
  }

  function setOpen(tip, open) {
    if (open) {
      if (openTip && openTip !== tip) setOpen(openTip, false);
      tip.body.hidden = false;
      // The top layer keeps the tip from being clipped by the scrolling dialog.
      if (tip.body.popover === 'manual') { try { tip.body.showPopover(); } catch { /* already open */ } }
      tip.button.setAttribute('aria-expanded', 'true');
      place(tip);
      openTip = tip;
    } else {
      if (tip.body.popover === 'manual') { try { tip.body.hidePopover(); } catch { /* already closed */ } }
      tip.body.hidden = true;
      tip.button.setAttribute('aria-expanded', 'false');
      if (openTip === tip) openTip = null;
    }
  }

  // Hover and focus show the text; a tap or click pins it open (touch has no hover).
  function create(text, label = '說明') {
    counter += 1;
    const wrapper = document.createElement('span');
    wrapper.className = 'info-tip';
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'info-tip-button';
    button.setAttribute('aria-label', label);
    button.setAttribute('aria-expanded', 'false');
    button.setAttribute('aria-controls', `info-tip-${counter}`);
    button.textContent = 'i';
    const body = document.createElement('span');
    body.id = `info-tip-${counter}`;
    body.className = 'info-tip-body';
    body.setAttribute('role', 'tooltip');
    body.hidden = true;
    if ('popover' in body) body.popover = 'manual';
    body.textContent = text;
    wrapper.append(button, body);
    const tip = { button, body, pinned: false };

    wrapper.addEventListener('mouseenter', () => setOpen(tip, true));
    wrapper.addEventListener('mouseleave', () => { if (!tip.pinned) setOpen(tip, false); });
    button.addEventListener('focus', () => setOpen(tip, true));
    button.addEventListener('blur', () => { if (!tip.pinned) setOpen(tip, false); });
    button.addEventListener('click', event => {
      event.preventDefault();
      event.stopPropagation();
      tip.pinned = body.hidden || !tip.pinned;
      setOpen(tip, tip.pinned);
    });
    button.addEventListener('keydown', event => {
      if (event.key !== 'Escape' || body.hidden) return;
      event.stopPropagation();
      tip.pinned = false;
      setOpen(tip, false);
    });
    tip.close = () => { tip.pinned = false; setOpen(tip, false); };
    wrapper.tip = tip;
    return wrapper;
  }

  function closeAll() {
    if (openTip) openTip.close();
  }

  // <p data-info-note data-info-target="#heading-id"> becomes an info button beside the target.
  function enhance(root = document) {
    root.querySelectorAll('[data-info-note]').forEach(note => {
      const text = note.textContent.trim();
      if (!text) return;
      const targetSelector = note.dataset.infoTarget;
      let target = targetSelector ? document.querySelector(targetSelector) : null;
      if (!target) {
        for (let node = note.previousElementSibling; node; node = node.previousElementSibling) {
          if (node.matches('h2, h3, h4, legend')) { target = node; break; }
        }
      }
      const tip = create(text);
      if (target) {
        target.append(' ', tip);
        note.remove();
      } else {
        note.replaceWith(tip);
      }
    });
  }

  document.addEventListener('click', event => {
    if (openTip && !event.target.closest('.info-tip')) closeAll();
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && openTip) {
      event.preventDefault();
      event.stopPropagation();
      closeAll();
    }
  }, true);
  window.addEventListener('scroll', () => { if (openTip && !openTip.pinned) closeAll(); }, true);
  window.addEventListener('resize', closeAll);

  global.AdminInfoTip = { create, enhance, closeAll };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => enhance());
  else enhance();
})(window);
