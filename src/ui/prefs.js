import { createRakanUi } from './app.js';

const root = document.getElementById('rakan-root');
const ui = createRakanUi(root, {
  initialSurface: root.getAttribute('data-initial-surface') || 'preferences',
  shell: 'staff',
});
ui.paint();
void ui.refreshHealth();
