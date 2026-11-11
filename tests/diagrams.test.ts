import { describe, it, expect, vi, beforeEach } from 'vitest';
import { THEMES, DEFAULT_THEME } from '../src/themes';
import { renderDiagrams } from '../src/diagrams';

vi.mock('mermaid', () => ({
  default: {
    initialize: vi.fn(),
    render: vi.fn(async () => ({ svg: '<svg viewBox="0 0 100 50"></svg>' })),
  },
}));

const theme = THEMES[DEFAULT_THEME];

const makeRoot = (): HTMLElement => {
  const root = document.createElement('div');
  root.innerHTML = '<div class="mermaid-block" data-source="erDiagram\n  A ||--o{ B : has"></div>';
  document.body.append(root);
  return root;
};

const contentWidth = (root: HTMLElement): string =>
  (root.querySelector<HTMLElement>('.mermaid-content')?.style.width) ?? '';

const readout = (root: HTMLElement): string =>
  root.querySelector('.mermaid-zoom-readout')?.textContent ?? '';

const button = (root: HTMLElement, label: string): HTMLButtonElement => {
  const match = Array.from(root.querySelectorAll('button')).find(b => b.textContent === label);
  if (!match) throw new Error(`Missing ${label} button`);
  return match;
};

describe('renderDiagrams canvas', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('wraps the rendered svg in a scrollable viewport with zoom controls', async () => {
    const root = makeRoot();
    await renderDiagrams(root, theme);

    const viewport = root.querySelector<HTMLElement>('.mermaid-viewport');
    expect(viewport?.querySelector('svg')).not.toBeNull();
    expect(readout(root)).toBe('100%');
  });

  it('zooms in and out with the toolbar buttons and clamps the range', async () => {
    const root = makeRoot();
    await renderDiagrams(root, theme);

    button(root, '+').click();
    expect(readout(root)).toBe('125%');
    expect(contentWidth(root)).toBe('125%');

    button(root, '−').click();
    button(root, '−').click();
    expect(readout(root)).toBe('80%');

    for (let i = 0; i < 20; i++) button(root, '−').click();
    expect(readout(root)).toBe('25%');

    for (let i = 0; i < 40; i++) button(root, '+').click();
    expect(readout(root)).toBe('400%');
  });

  it('resets to fit-width zoom', async () => {
    const root = makeRoot();
    await renderDiagrams(root, theme);

    button(root, '+').click();
    button(root, '+').click();
    button(root, 'Reset').click();

    expect(readout(root)).toBe('100%');
    expect(contentWidth(root)).toBe('100%');
  });

  it('zooms with ctrl+wheel and leaves plain wheel scrolling alone', async () => {
    const root = makeRoot();
    await renderDiagrams(root, theme);
    const viewport = root.querySelector<HTMLElement>('.mermaid-viewport')!;

    const plain = new WheelEvent('wheel', { deltaY: -100, bubbles: true, cancelable: true });
    viewport.dispatchEvent(plain);
    expect(plain.defaultPrevented).toBe(false);
    expect(readout(root)).toBe('100%');

    const pinch = new WheelEvent('wheel', { deltaY: -100, ctrlKey: true, bubbles: true, cancelable: true });
    viewport.dispatchEvent(pinch);
    expect(pinch.defaultPrevented).toBe(true);
    expect(readout(root)).not.toBe('100%');
  });

  it('shows an error in place of the canvas when rendering fails', async () => {
    const mermaid = (await import('mermaid')).default;
    vi.mocked(mermaid.render).mockRejectedValueOnce(new Error('Parse error'));

    const root = makeRoot();
    await renderDiagrams(root, theme);

    expect(root.querySelector('.mermaid-block')?.classList.contains('error')).toBe(true);
    expect(root.querySelector('.mermaid-viewport')).toBeNull();
    expect(root.textContent).toContain('Parse error');
  });
});
