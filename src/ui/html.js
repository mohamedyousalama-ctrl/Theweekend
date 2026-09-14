/** HTML helpers. Untrusted contract strings are escaped; never interpolate raw customer text. */

export function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function attr(name, value) {
  if (value === false || value == null) return '';
  if (value === true) return escapeHtml(name);
  return `${escapeHtml(name)}="${escapeHtml(value)}"`;
}

export function attrs(map) {
  return Object.entries(map)
    .filter(([, v]) => v !== false && v !== undefined && v !== null)
    .map(([k, v]) => attr(k, v))
    .filter(Boolean)
    .join(' ');
}

export function el(tag, map, children = '') {
  const a = attrs(map);
  const inner = Array.isArray(children) ? children.join('') : children;
  return `<${tag}${a ? ` ${a}` : ''}>${inner}</${tag}>`;
}

export function newTurnId() {
  return crypto.randomUUID();
}
