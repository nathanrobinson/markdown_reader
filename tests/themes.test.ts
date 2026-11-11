import { describe, it, expect } from 'vitest';
import { DEFAULT_THEME, THEMES, applyTheme } from '../src/themes';

const TOKENS = ['bg', 'fg', 'muted', 'border', 'code', 'link', 'accent', 'strong', 'codeText'] as const;

describe('themes', () => {
  it('includes the default theme', () => {
    expect(THEMES[DEFAULT_THEME]).toBeDefined();
  });

  it('gives every theme a six-digit hex value for each color token', () => {
    for (const [name, theme] of Object.entries(THEMES)) {
      for (const token of TOKENS) {
        expect(theme[token], `${name}.${token}`).toMatch(/^#[0-9a-f]{6}$/i);
      }
    }
  });

  it('sets custom properties on the root element', () => {
    applyTheme('Nord');
    expect(document.documentElement.style.getPropertyValue('--bg')).toBe('#2e3440');
    expect(document.documentElement.style.getPropertyValue('--codeText')).toBe('#a3be8c');
  });

  it('ignores unknown theme names', () => {
    applyTheme('Nord');
    applyTheme('Not a theme');
    expect(document.documentElement.style.getPropertyValue('--bg')).toBe('#2e3440');
  });
});
