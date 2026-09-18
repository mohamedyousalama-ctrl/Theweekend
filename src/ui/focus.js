/** Remember which control had keyboard focus before a full innerHTML paint, then restore it. */

const FOCUS_ATTRS = [
  'data-handoff-control',
  'data-action-id',
  'data-consent-grant',
  'data-consent-revoke',
  'data-consent-dismiss',
  'data-action',
  'data-surface',
  'data-brief-id',
  'data-component',
  'data-photo-input',
];

function pickActive(root) {
  if (root && root._activeElement) return root._activeElement;
  if (typeof document !== 'undefined' && document.activeElement) return document.activeElement;
  return null;
}

function isInside(root, node) {
  if (!root || !node) return false;
  if (typeof root.contains === 'function') {
    try {
      if (root.contains(node)) return true;
    } catch {
      /* FakeElement has no native contains */
    }
  }
  let current = node;
  while (current) {
    if (current === root) return true;
    current = current.parent || current.parentNode || null;
  }
  return false;
}

export function captureFocusKey(root) {
  const active = pickActive(root);
  if (!active || typeof active.getAttribute !== 'function') return null;
  if (!isInside(root, active)) return null;
  const id = active.getAttribute('id');
  if (id) return { kind: 'id', value: id };
  const name = active.getAttribute('name');
  if (name) return { kind: 'name', value: name };
  for (const attr of FOCUS_ATTRS) {
    const value = active.getAttribute(attr);
    if (value) return { kind: 'attr', attr, value };
  }
  return null;
}

export function restoreFocus(root, key) {
  if (!root || !key) return;
  let el = null;
  switch (key.kind) {
    case 'id':
      el = root.querySelector(`#${key.value}`);
      break;
    case 'name':
      el = root.querySelector(`[name="${key.value}"]`);
      break;
    case 'attr':
      el = root.querySelector(`[${key.attr}="${key.value}"]`);
      break;
    default: {
      const _never = key.kind;
      void _never;
    }
  }
  if (el && typeof el.focus === 'function') el.focus();
}
