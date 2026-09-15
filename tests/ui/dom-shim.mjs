// Minimal DOM shim sized to what src/ui/app.js bind() uses (compound selectors, innerHTML, insertAdjacentHTML, listeners), so the
// real createRakanUi() can be driven in node:test without a browser or a dependency. Written by the integrator's audit of PR #21.

// Minimal DOM shim, sized exactly to what src/ui/app.js's bind() needs, so we can
// run createRakanUi() for real and simulate an actual click -> count real listener firings.
// Only supports what el()/attrs() in src/ui/html.js ever emits (always-balanced tags,
// double-quoted, HTML-entity-escaped attribute values) and the compound (no-descendant)
// selectors bind() actually uses.

class FakeElement {
  constructor(tag) {
    this.tagName = (tag || '').toLowerCase();
    this.attrs = new Map();
    this.children = [];
    this.parent = null;
    this.listeners = new Map();
    this._text = '';
    this._value = undefined;
    this.files = null;
  }
  getAttribute(name) {
    return this.attrs.has(name) ? this.attrs.get(name) : null;
  }
  hasAttribute(name) {
    return this.attrs.has(name);
  }
  addEventListener(type, fn) {
    if (!this.listeners.has(type)) this.listeners.set(type, []);
    this.listeners.get(type).push(fn);
  }
  focus() {
    let node = this;
    while (node.parent) node = node.parent;
    node._activeElement = this;
  }
  get value() {
    if (this._value !== undefined) return this._value;
    if (this.tagName === 'select') {
      const opts = this.children.filter((c) => c instanceof FakeElement && c.tagName === 'option');
      const selected = opts.find((o) => o.hasAttribute('selected')) || opts[0];
      return selected ? (selected.getAttribute('value') || '') : '';
    }
    if (this.tagName === 'textarea') {
      return this.children.map((c) => (c instanceof FakeElement ? '' : (c.text || ''))).join('');
    }
    if (this.tagName === 'input') return this.getAttribute('value') || '';
    return this.getAttribute('value') || '';
  }
  set value(next) {
    this._value = String(next ?? '');
  }
  // Simulate ONE physical user click: a real browser fires every registered
  // 'click' listener, in registration order, synchronously, for a single click.
  click() {
    return this.fire('click');
  }
  // Generic single-dispatch of one DOM event type (click, submit, ...): every
  // listener registered via addEventListener(type, fn) fires once, in order.
  fire(type) {
    const fns = this.listeners.get(type) || [];
    const calls = fns.length;
    for (const fn of fns.slice()) {
      fn({ target: this, type, preventDefault() { this._defaultPrevented = true; } });
    }
    return calls;
  }
  querySelectorAll(selector) {
    const out = [];
    walk(this, (el) => { if (el !== this && matches(el, selector)) out.push(el); });
    return out;
  }
  querySelector(selector) {
    return this.querySelectorAll(selector)[0] || null;
  }
  set innerHTML(html) {
    const nodes = parseFragment(html, this);
    for (const child of nodes) {
      if (child instanceof FakeElement) child.parent = this;
    }
    this.children = nodes;
  }
  get innerHTML() {
    return this.children.map(serialize).join('');
  }
  insertAdjacentHTML(_position, html) {
    const nodes = parseFragment(html, this);
    this.children = [...nodes, ...this.children];
  }
}

function walk(el, cb) {
  cb(el);
  for (const c of el.children) if (c instanceof FakeElement) walk(c, cb);
}

function serialize(node) {
  if (!(node instanceof FakeElement)) return node.text || '';
  const attrStr = [...node.attrs.entries()].map(([k, v]) => (v === true ? k : `${k}="${v}"`)).join(' ');
  const inner = node.children.map(serialize).join('');
  return `<${node.tagName}${attrStr ? ` ${attrStr}` : ''}>${inner}</${node.tagName}>`;
}

// Parse a compound CSS selector (no descendant combinator) into predicate tokens.
function parseSelector(selector) {
  const tokens = [];
  const re = /#([-\w]+)|\.([-\w]+)|\[([-\w:]+)(?:="([^"]*)")?\]|^([-\w]+)/g;
  let m;
  while ((m = re.exec(selector))) {
    if (m[1]) tokens.push({ type: 'id', value: m[1] });
    else if (m[2]) tokens.push({ type: 'class', value: m[2] });
    else if (m[3]) tokens.push({ type: 'attr', name: m[3], value: m[4] !== undefined ? m[4] : undefined });
    else if (m[5]) tokens.push({ type: 'tag', value: m[5].toLowerCase() });
  }
  return tokens;
}

function matches(el, selector) {
  const tokens = parseSelector(selector);
  return tokens.every((tok) => {
    if (tok.type === 'tag') return el.tagName === tok.value;
    if (tok.type === 'id') return el.getAttribute('id') === tok.value;
    if (tok.type === 'class') {
      const cls = (el.getAttribute('class') || '').split(/\s+/);
      return cls.includes(tok.value);
    }
    if (tok.type === 'attr') {
      if (!el.hasAttribute(tok.name)) return false;
      if (tok.value === undefined) return true;
      return el.getAttribute(tok.name) === tok.value;
    }
    return false;
  });
}

// Balanced-tag parser: el() always emits <tag ...>...</tag>, never self-closing,
// so a simple stack-based parser is sufficient (no void-element special-casing needed).
function parseFragment(html, ownerRootForOrphan) {
  const root = new FakeElement('#fragment');
  const stack = [root];
  let i = 0;
  const n = html.length;
  const attrRe = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)(?:="([^"]*)")?/y;
  while (i < n) {
    const lt = html.indexOf('<', i);
    if (lt === -1) {
      if (i < n) stack[stack.length - 1].children.push({ text: html.slice(i) });
      break;
    }
    if (lt > i) stack[stack.length - 1].children.push({ text: html.slice(i, lt) });
    if (html[lt + 1] === '/') {
      const gt = html.indexOf('>', lt);
      stack.pop();
      i = gt + 1;
      continue;
    }
    // opening tag
    let j = lt + 1;
    let tagEnd = j;
    while (tagEnd < n && !/[\s>]/.test(html[tagEnd])) tagEnd++;
    const tag = html.slice(j, tagEnd);
    const el = new FakeElement(tag);
    el.parent = stack[stack.length - 1];
    j = tagEnd;
    attrRe.lastIndex = 0;
    // parse attributes until we hit '>'
    while (true) {
      while (html[j] === ' ') j++;
      if (html[j] === '>') { j++; break; }
      attrRe.lastIndex = j;
      const am = attrRe.exec(html);
      if (!am || am.index !== j) { j++; continue; }
      const name = am[1];
      const value = am[2] !== undefined ? am[2] : true;
      el.attrs.set(name, value);
      j = attrRe.lastIndex;
    }
    stack[stack.length - 1].children.push(el);
    stack.push(el);
    i = j;
  }
  return root.children;
}

export function createRoot() {
  return new FakeElement('root');
}
