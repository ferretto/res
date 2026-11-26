// mask.js: covers personal data with solid blocks before a screenshot of a production screen.
// Paste the whole file into the browser's JavaScript tool. It masks at once.
//   window.__re.mask.apply({ selectors: ['.customer-name'], names: ['Maria Silva'], avatars: true, placeholders: true })
//   window.__re.mask.clear()
// Selectors and placeholders: true become CSS rules that also cover elements
// rendered later (popovers, dropdowns, re-rendered lists) until clear().
// Patterns, names and avatars mark the elements on the page now: run apply()
// again right before each screenshot.
// Masks are opaque (text made transparent on a solid block, images turned black), not a
// blur: a blur of short text such as an email can be read back or reversed.
// Open shadow roots and same-origin iframes are masked too. Closed shadow roots (not detectable),
// cross-origin iframes and canvases cannot be read: the result counts them under
// "unmaskable", and the screenshot must crop them out.
// Playwright browser_evaluate: wrap as () => { <file>; return window.__re.last; }
(() => {
  const re = (window.__re = window.__re || {});
  const CLASS = '__re-masked';
  const PLACEHOLDER_CLASS = '__re-masked-placeholder';
  const STYLE_ID = '__re-mask-style';
  const BLOCK = 'color:transparent!important;background:#111!important;background-image:none!important;text-shadow:none!important;border-color:#111!important;caret-color:transparent!important';
  const BLOCK_MEDIA = 'filter:brightness(0)!important;background:#111!important';
  const PATTERNS = {
    email: /[^\s@<>()]+@[^\s@<>()]+\.[a-z]{2,}/i,
    phone: /(?:\+\d{1,3}[\s.-]?)?(?:\(?\d{2,3}\)?[\s.-]?)?\d{3,5}[\s.-]?\d{4}\b/,
    money: /(?:(?:R\$|US\$|\$|€|£)\s?\d[\d.,]*|\d[\d.,]*\s?(?:BRL|USD|EUR|GBP|R\$|€)\b)/,
    cpf: /\b\d{3}\.\d{3}\.\d{3}-\d{2}\b/,
    cnpj: /\b\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}\b/,
  };
  // Rules kept across apply() calls, and across pastes of this file before a reload.
  const rules = re.mask?.rules || { selectors: [], placeholders: false };

  const escapeRegExp = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  // Selectors are written into a stylesheet. Anything that could end the rule early, open
  // a comment or an at-rule would silently disable the masks after it, so it is refused.
  const validSelector = (selector) => {
    if (typeof selector !== 'string' || !selector.trim() || /[{};@<>\\]|\/\*|\*\//.test(selector)) return false;
    try {
      document.querySelector(selector);
      return true;
    } catch {
      return false;
    }
  };

  const css = () => {
    const covered = (selector) => `${selector},${selector} *`;
    const lines = [
      `${covered(`.${CLASS}`)}{${BLOCK}}`,
      `img.${CLASS},.${CLASS} img,video.${CLASS},.${CLASS} video,.${CLASS} svg,svg.${CLASS}{${BLOCK_MEDIA}}`,
      `.${PLACEHOLDER_CLASS}{background:#111!important}`,
      `.${PLACEHOLDER_CLASS}::placeholder{color:transparent!important}`,
    ];
    for (const selector of rules.selectors) {
      // :is() keeps a selector list (a, b) or :is(a, b) intact; each rule sits on its own line,
      // so one the browser rejects cannot take the others down with it.
      lines.push(`${covered(`:is(${selector})`)}{${BLOCK}}`);
      lines.push(`:is(${selector}) img,img:is(${selector}){${BLOCK_MEDIA}}`);
    }
    if (rules.placeholders) lines.push('input::placeholder,textarea::placeholder{color:transparent!important}');
    return lines.join('\n');
  };

  // Every document or shadow root the script can reach: the page, open shadow roots and
  // same-origin iframes, recursively. Counts what it cannot reach.
  function collectRoots(unmaskable) {
    const roots = [];
    const visit = (root) => {
      roots.push(root);
      for (const element of root.querySelectorAll('*')) {
        if (element.shadowRoot) visit(element.shadowRoot);
        if (element.localName === 'iframe' || element.localName === 'frame') {
          let inner = null;
          try {
            inner = element.contentDocument;
          } catch {
            inner = null;
          }
          if (inner?.body) visit(inner);
          else unmaskable.crossOriginFrames = (unmaskable.crossOriginFrames || 0) + 1;
        }
        if (element.localName === 'canvas') {
          const rect = element.getBoundingClientRect();
          if (rect.width > 40 && rect.height > 20) unmaskable.canvases = (unmaskable.canvases || 0) + 1;
        }
      }
    };
    visit(document);
    return roots;
  }

  function writeStyle(root) {
    const owner = root.ownerDocument || root;
    const parent = root.head || root;
    let style = root.getElementById ? root.getElementById(STYLE_ID) : root.querySelector(`#${STYLE_ID}`);
    if (!style) {
      style = owner.createElement('style');
      style.id = STYLE_ID;
    }
    if (!style.isConnected) parent.appendChild(style);
    style.textContent = css();
  }

  function apply(options = {}) {
    const patterns = { ...PATTERNS };
    for (const [i, name] of (options.names || []).entries()) {
      if (typeof name === 'string' && name.trim()) patterns[`name${i + 1}`] = new RegExp(escapeRegExp(name), 'i');
    }
    const invalid = (options.selectors || []).filter((selector) => !validSelector(selector));
    for (const selector of options.selectors || []) {
      if (!invalid.includes(selector) && !rules.selectors.includes(selector)) rules.selectors.push(selector);
    }
    if (options.placeholders) rules.placeholders = true;

    const unmaskable = {};
    const roots = collectRoots(unmaskable);
    const counts = {};
    const mark = (element, reason, className = CLASS) => {
      if (!element || element.localName === 'body' || element.localName === 'html') return;
      if (!element.classList.contains(className)) {
        element.classList.add(className);
        counts[reason] = (counts[reason] || 0) + 1;
      }
    };
    const matches = (text) => Object.entries(patterns).find(([, pattern]) => text && pattern.test(text))?.[0];

    for (const root of roots) {
      writeStyle(root);
      for (const selector of rules.selectors) {
        for (const element of root.querySelectorAll(selector)) mark(element, `selector ${selector}`);
      }
      const start = root.body || root;
      const owner = root.ownerDocument || root;
      const walker = owner.createTreeWalker(start, NodeFilter.SHOW_TEXT);
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        const text = node.nodeValue;
        if (!text || !text.trim()) continue;
        const reason = matches(text);
        if (reason) mark(node.parentElement, reason);
      }
      for (const field of root.querySelectorAll('input, textarea, select')) {
        const value = field.localName === 'select' ? field.selectedOptions?.[0]?.textContent : field.value;
        const reason = matches(value);
        if (reason) mark(field, reason);
        const placeholder = matches(field.getAttribute('placeholder'));
        if (placeholder) mark(field, `placeholder ${placeholder}`, PLACEHOLDER_CLASS);
      }
      if (options.avatars !== false) {
        for (const image of root.querySelectorAll('img, [role="img"]')) {
          const rect = image.getBoundingClientRect();
          const round = parseFloat(getComputedStyle(image).borderTopLeftRadius) >= rect.width / 3;
          const label = `${image.className?.baseVal ?? image.className} ${image.getAttribute('alt') || ''} ${image.getAttribute('aria-label') || ''}`;
          if (rect.width > 0 && rect.width <= 64 && (round || /avatar|profile|user/i.test(label))) mark(image, 'avatar');
        }
      }
    }
    const result = {
      masked: Object.values(counts).reduce((a, b) => a + b, 0),
      byReason: counts,
      rules: { selectors: rules.selectors.length, placeholders: rules.placeholders },
      roots: roots.length,
    };
    if (invalid.length) result.invalidSelectors = invalid;
    if (Object.keys(unmaskable).length) {
      result.unmaskable = unmaskable;
      result.warning = 'Some regions cannot be masked by this script. Crop them out of the screenshot or do not take it.';
    }
    re.last = result;
    return result;
  }

  function clear() {
    for (const root of collectRoots({})) {
      for (const element of root.querySelectorAll(`.${CLASS}, .${PLACEHOLDER_CLASS}`)) element.classList.remove(CLASS, PLACEHOLDER_CLASS);
      root.querySelector(`#${STYLE_ID}`)?.remove();
    }
    rules.selectors = [];
    rules.placeholders = false;
    re.last = { cleared: true };
    return re.last;
  }

  re.mask = { apply, clear, rules };
  return apply();
})();
