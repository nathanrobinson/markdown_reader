export interface Theme {
  bg: string;
  fg: string;
  muted: string;
  border: string;
  code: string;
  link: string;
  accent: string;
  strong: string;
  codeText: string;
}

export const THEMES: Record<string, Theme> = {
  'Dracula':        { bg: '#282a36', fg: '#f8f8f2', muted: '#6272a4', border: '#44475a', code: '#343746', link: '#8be9fd', accent: '#bd93f9', strong: '#ff79c6', codeText: '#50fa7b' },
  'One Dark':       { bg: '#282c34', fg: '#abb2bf', muted: '#5c6370', border: '#3e4451', code: '#21252b', link: '#61afef', accent: '#c678dd', strong: '#e5c07b', codeText: '#98c379' },
  'Nord':           { bg: '#2e3440', fg: '#d8dee9', muted: '#4c566a', border: '#3b4252', code: '#3b4252', link: '#88c0d0', accent: '#81a1c1', strong: '#ebcb8b', codeText: '#a3be8c' },
  'GitHub Dark':    { bg: '#0d1117', fg: '#e6edf3', muted: '#8b949e', border: '#30363d', code: '#161b22', link: '#58a6ff', accent: '#79c0ff', strong: '#ffa657', codeText: '#a5d6ff' },
  'Solarized Dark': { bg: '#002b36', fg: '#93a1a1', muted: '#586e75', border: '#073642', code: '#073642', link: '#268bd2', accent: '#b58900', strong: '#cb4b16', codeText: '#2aa198' },
  'Monokai':        { bg: '#272822', fg: '#f8f8f2', muted: '#75715e', border: '#49483e', code: '#3e3d32', link: '#66d9ef', accent: '#a6e22e', strong: '#fd971f', codeText: '#e6db74' },
  'Tokyo Night':    { bg: '#1a1b26', fg: '#c0caf5', muted: '#565f89', border: '#292e42', code: '#24283b', link: '#7aa2f7', accent: '#bb9af7', strong: '#ff9e64', codeText: '#9ece6a' },
};

export const DEFAULT_THEME = 'Dracula';

export function applyTheme(name: string): void {
  const theme = THEMES[name];
  if (!theme) return;
  const style = document.documentElement.style;
  for (const [key, value] of Object.entries(theme)) {
    style.setProperty(`--${key}`, value);
  }
}
