import type { Theme } from './themes';

type MermaidApi = (typeof import('mermaid'))['default'];

let mermaidPromise: Promise<MermaidApi> | null = null;
let renderCount = 0;

const loadMermaid = (): Promise<MermaidApi> => {
  mermaidPromise ??= import('mermaid')
    .then(module => module.default)
    .catch((err: unknown) => {
      mermaidPromise = null;
      throw err;
    });
  return mermaidPromise;
};

const configure = (mermaid: MermaidApi, theme: Theme): void => {
  mermaid.initialize({
    startOnLoad: false,
    securityLevel: 'strict',
    theme: 'base',
    themeVariables: {
      background: theme.bg,
      mainBkg: theme.code,
      primaryColor: theme.code,
      primaryTextColor: theme.fg,
      primaryBorderColor: theme.accent,
      secondaryColor: theme.bg,
      tertiaryColor: theme.bg,
      lineColor: theme.muted,
      textColor: theme.fg,
      nodeBorder: theme.accent,
      edgeLabelBackground: theme.bg,
      attributeBackgroundColorOdd: theme.code,
      attributeBackgroundColorEven: theme.bg,
    },
  });
};

const showError = (block: HTMLElement, err: unknown): void => {
  block.classList.add('error');
  const pre = document.createElement('pre');
  pre.textContent = err instanceof Error ? err.message : String(err);
  block.replaceChildren(pre);
};

export const renderDiagrams = async (root: HTMLElement, theme: Theme): Promise<void> => {
  const blocks = Array.from(root.querySelectorAll<HTMLElement>('.mermaid-block'));
  if (blocks.length === 0) return;

  let mermaid: MermaidApi;
  try {
    mermaid = await loadMermaid();
  } catch (err) {
    for (const block of blocks) showError(block, err);
    return;
  }
  configure(mermaid, theme);

  for (const block of blocks) {
    const source = block.dataset.source ?? '';
    try {
      renderCount += 1;
      const { svg } = await mermaid.render(`diagram-${renderCount}`, source);
      block.classList.remove('error');
      block.innerHTML = svg;
    } catch (err) {
      showError(block, err);
    }
  }
};
