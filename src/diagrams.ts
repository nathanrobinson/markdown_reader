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

const MIN_ZOOM = 0.25;
const MAX_ZOOM = 4;
const BUTTON_ZOOM_FACTOR = 1.25;
const WHEEL_ZOOM_SENSITIVITY = 0.01;

const MIN_FRAME_WIDTH = 240;
const MIN_FRAME_HEIGHT = 160;
const MAX_FRAME_HEIGHT_RATIO = 0.9;
const PAGE_GUTTER = 32;

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));
const clampZoom = (zoom: number): number => clamp(zoom, MIN_ZOOM, MAX_ZOOM);

const makeButton = (label: string, title: string): HTMLButtonElement => {
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = label;
  button.title = title;
  button.setAttribute('aria-label', title);
  return button;
};

const mountCanvas = (block: HTMLElement, svg: string): void => {
  block.classList.remove('error');

  const toolbar = document.createElement('div');
  toolbar.className = 'mermaid-toolbar';
  const zoomOut = makeButton('−', 'Zoom out');
  const readout = document.createElement('span');
  readout.className = 'mermaid-zoom-readout';
  const zoomIn = makeButton('+', 'Zoom in');
  const reset = makeButton('Reset', 'Reset zoom');
  toolbar.append(zoomOut, readout, zoomIn, reset);

  const viewport = document.createElement('div');
  viewport.className = 'mermaid-viewport';
  const content = document.createElement('div');
  content.className = 'mermaid-content';
  content.innerHTML = svg;
  viewport.append(content);

  let zoom = 1;

  const applyZoom = (next: number, anchorX: number, anchorY: number): void => {
    const clamped = clampZoom(next);
    const ratio = clamped / zoom;
    const contentX = viewport.scrollLeft + anchorX;
    const contentY = viewport.scrollTop + anchorY;
    zoom = clamped;
    content.style.width = `${zoom * 100}%`;
    readout.textContent = `${Math.round(zoom * 100)}%`;
    viewport.scrollLeft = contentX * ratio - anchorX;
    viewport.scrollTop = contentY * ratio - anchorY;
  };

  const zoomAtCenter = (factor: number): void => {
    applyZoom(zoom * factor, viewport.clientWidth / 2, viewport.clientHeight / 2);
  };

  zoomOut.addEventListener('click', () => zoomAtCenter(1 / BUTTON_ZOOM_FACTOR));
  zoomIn.addEventListener('click', () => zoomAtCenter(BUTTON_ZOOM_FACTOR));
  reset.addEventListener('click', () => {
    zoom = 1;
    content.style.width = '100%';
    readout.textContent = '100%';
    viewport.scrollLeft = 0;
    viewport.scrollTop = 0;
  });

  viewport.addEventListener('wheel', (event: WheelEvent) => {
    if (!event.ctrlKey && !event.metaKey) return;
    event.preventDefault();
    const rect = viewport.getBoundingClientRect();
    const factor = Math.exp(-event.deltaY * WHEEL_ZOOM_SENSITIVITY);
    applyZoom(zoom * factor, event.clientX - rect.left, event.clientY - rect.top);
  }, { passive: false });

  let drag: { x: number; y: number; left: number; top: number } | null = null;

  viewport.addEventListener('pointerdown', (event: PointerEvent) => {
    if (event.button !== 0) return;
    drag = { x: event.clientX, y: event.clientY, left: viewport.scrollLeft, top: viewport.scrollTop };
    viewport.classList.add('dragging');
    viewport.setPointerCapture(event.pointerId);
  });

  viewport.addEventListener('pointermove', (event: PointerEvent) => {
    if (!drag) return;
    viewport.scrollLeft = drag.left - (event.clientX - drag.x);
    viewport.scrollTop = drag.top - (event.clientY - drag.y);
  });

  const endDrag = (): void => {
    drag = null;
    viewport.classList.remove('dragging');
  };
  viewport.addEventListener('pointerup', endDrag);
  viewport.addEventListener('pointercancel', endDrag);

  const frame = document.createElement('div');
  frame.className = 'mermaid-frame';
  const grip = document.createElement('div');
  grip.className = 'mermaid-resize';
  grip.title = 'Drag to resize';
  grip.setAttribute('aria-label', 'Resize diagram');
  frame.append(viewport, grip);

  let resize: { x: number; y: number; width: number; height: number } | null = null;

  grip.addEventListener('pointerdown', (event: PointerEvent) => {
    if (event.button !== 0) return;
    event.preventDefault();
    resize = {
      x: event.clientX,
      y: event.clientY,
      width: frame.getBoundingClientRect().width,
      height: viewport.getBoundingClientRect().height,
    };
    grip.setPointerCapture(event.pointerId);
  });

  grip.addEventListener('pointermove', (event: PointerEvent) => {
    if (!resize) return;
    const width = clamp(resize.width + event.clientX - resize.x, MIN_FRAME_WIDTH, window.innerWidth - PAGE_GUTTER);
    const height = clamp(resize.height + event.clientY - resize.y, MIN_FRAME_HEIGHT, window.innerHeight * MAX_FRAME_HEIGHT_RATIO);
    frame.style.setProperty('--frame-width', `${width}px`);
    viewport.style.height = `${height}px`;
    viewport.style.maxHeight = 'none';
  });

  const endResize = (): void => {
    resize = null;
  };
  grip.addEventListener('pointerup', endResize);
  grip.addEventListener('pointercancel', endResize);

  readout.textContent = '100%';
  block.replaceChildren(toolbar, frame);
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
      mountCanvas(block, svg);
    } catch (err) {
      showError(block, err);
    }
  }
};
