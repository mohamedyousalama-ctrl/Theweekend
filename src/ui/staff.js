import { createRakanUi } from './app.js';

const root = document.getElementById('rakan-root');
const ui = createRakanUi(root, { initialSurface: root.getAttribute('data-initial-surface') });
ui.paint();
void ui.refreshHealth();
