import { markdownToHtml } from './markdown';
import { DEFAULT_THEME, THEMES, applyTheme } from './themes';
import { SpeechReader } from './speech';

const byId = <T extends HTMLElement>(id: string): T => {
  const node = document.getElementById(id);
  if (!node) throw new Error(`Missing element #${id}`);
  return node as T;
};

const srcInput = byId<HTMLTextAreaElement>('src');
const output = byId<HTMLElement>('out');
const statusEl = byId<HTMLElement>('status');
const renderBtn = byId<HTMLButtonElement>('render');
const themeSelect = byId<HTMLSelectElement>('theme');

for (const name of Object.keys(THEMES)) {
  const isDefault = name === DEFAULT_THEME;
  themeSelect.add(new Option(name, name, isDefault, isDefault));
}
themeSelect.addEventListener('change', () => applyTheme(themeSelect.value));
applyTheme(DEFAULT_THEME);

const reader = new SpeechReader(output, {
  playBtn: byId<HTMLButtonElement>('play'),
  voiceSelect: byId<HTMLSelectElement>('voice'),
  speedRange: byId<HTMLInputElement>('speed'),
  speedLabel: byId<HTMLElement>('speed-label'),
  statusEl,
});

const renderMarkdown = (): void => {
  const text = srcInput.value;
  reader.reset();
  if (!text.trim()) {
    output.innerHTML = '';
    reader.wrap();
    statusEl.textContent = '';
    return;
  }
  output.innerHTML = markdownToHtml(text);
  reader.wrap();
  statusEl.textContent = `${text.split('\n').length} lines rendered`;
  window.scrollTo(0, 0);
};

renderBtn.addEventListener('click', renderMarkdown);
srcInput.addEventListener('paste', () => setTimeout(renderMarkdown, 0));
