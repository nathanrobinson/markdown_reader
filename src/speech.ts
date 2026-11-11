export interface SpeechControls {
  playBtn: HTMLButtonElement;
  voiceSelect: HTMLSelectElement;
  speedRange: HTMLInputElement;
  speedLabel: HTMLElement;
  statusEl: HTMLElement;
}

interface WordEntry {
  el: HTMLSpanElement;
  spoken: string;
  pause: boolean;
  start: number;
}

const HEADING_SEL = 'h1,h2,h3,h4,h5,h6';

const EXACT_SYMBOLS: Record<string, string> = {
  '+': 'plus',
  '=': 'equals',
  '-': 'minus',
  '/': 'slash',
  '@': 'at',
  '*': 'times',
  '<': 'less than',
  '>': 'greater than',
};

const SYMBOL_RULES: Array<[RegExp, string]> = [
  [/<->|↔/g, ' double arrow '],
  [/->|=>|→|⇒/g, ' arrow '],
  [/<-|←|⇐/g, ' left arrow '],
  [/>=|≥/g, ' greater than or equal to '],
  [/<=|≤/g, ' less than or equal to '],
  [/!=|≠/g, ' not equal to '],
  [/≈/g, ' approximately equal to '],
  [/±/g, ' plus or minus '],
  [/×/g, ' times '],
  [/÷/g, ' divided by '],
  [/✓|✔/g, ' check mark '],
  [/✗|✘|✕|✖/g, ' cross '],
  [/™/g, ' trademark '],
  [/©/g, ' copyright '],
  [/®/g, ' registered '],
  [/°/g, ' degrees '],
  [/%/g, ' percent '],
  [/&/g, ' and '],
  [/…/g, '. '],
  [/—/g, ', '],
];

const PRONUNCIATIONS: Array<[RegExp, string]> = [
  [/\bjsonb\b/gi, 'jason bee'],
  [/\bjsons\b/gi, 'jasons'],
  [/\bjson\b/gi, 'jason'],
];

export const speakable = (tok: string): string => {
  if (Object.prototype.hasOwnProperty.call(EXACT_SYMBOLS, tok)) return EXACT_SYMBOLS[tok];
  let s = tok;
  for (const [re, rep] of PRONUNCIATIONS) s = s.replace(re, rep);
  for (const [re, rep] of SYMBOL_RULES) s = s.replace(re, rep);
  return s;
};

const sameLang = (lang: string, target: string): boolean =>
  lang.replace('_', '-').toLowerCase() === target.toLowerCase();

export class SpeechReader {
  private words: WordEntry[] = [];
  private speechText = '';
  private current = 0;
  private active: SpeechSynthesisUtterance | null = null;
  private readonly synth: SpeechSynthesis | null;
  private readonly browserLang: string;
  private readonly baseLang: string;

  constructor(private readonly container: HTMLElement, private readonly ui: SpeechControls) {
    const supported = 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;
    this.synth = supported ? window.speechSynthesis : null;
    this.browserLang = (navigator.language || 'en-US').replace('_', '-');
    this.baseLang = this.browserLang.split('-')[0].toLowerCase();

    ui.speedLabel.textContent = `${ui.speedRange.value}x`;
    ui.speedRange.addEventListener('input', () => {
      ui.speedLabel.textContent = `${ui.speedRange.value}x`;
    });
    ui.speedRange.addEventListener('change', () => this.restart());
    ui.voiceSelect.addEventListener('change', () => this.restart());
    ui.playBtn.addEventListener('click', e => {
      this.togglePlay();
      if (e.detail > 0) ui.playBtn.blur();
    });
    document.addEventListener('keydown', e => this.onSpaceKey(e));
    container.addEventListener('click', e => this.onWordClick(e));

    if (this.synth) {
      this.populateVoices();
      this.synth.addEventListener('voiceschanged', () => this.populateVoices());
    } else {
      ui.playBtn.disabled = true;
      ui.voiceSelect.disabled = true;
      ui.speedRange.disabled = true;
      ui.statusEl.textContent = 'Text-to-speech is not supported in this browser';
    }
  }

  reset(): void {
    this.synth?.cancel();
    this.active = null;
    this.current = 0;
    this.setPlaying(false);
  }

  wrap(): void {
    this.words = [];
    const walker = document.createTreeWalker(this.container, NodeFilter.SHOW_TEXT);
    const nodes: Text[] = [];
    while (walker.nextNode()) nodes.push(walker.currentNode as Text);

    for (const node of nodes) {
      const tokens = (node.textContent ?? '').split(/(\s+)/).filter(Boolean);
      if (!tokens.some(t => t.trim())) continue;
      const frag = document.createDocumentFragment();
      for (const tok of tokens) {
        if (!tok.trim()) {
          frag.appendChild(document.createTextNode(tok));
          continue;
        }
        const el = document.createElement('span');
        el.className = 'w';
        el.dataset.i = String(this.words.length);
        el.textContent = tok;
        this.words.push({ el, spoken: speakable(tok), pause: false, start: 0 });
        frag.appendChild(el);
      }
      node.replaceWith(frag);
    }

    this.words.forEach((w, i) => {
      const heading = w.el.closest(HEADING_SEL);
      const next = this.words[i + 1];
      w.pause = heading !== null && (next === undefined || next.el.closest(HEADING_SEL) !== heading);
    });

    let pos = 0;
    let text = '';
    for (const w of this.words) {
      w.start = pos;
      const sep = w.pause && !/[.!?:;,]$/.test(w.spoken.trim()) ? '. ' : ' ';
      const piece = w.spoken + sep;
      text += piece;
      pos += piece.length;
    }
    this.speechText = text;
  }

  private setPlaying(playing: boolean): void {
    this.ui.playBtn.textContent = playing ? 'Pause' : 'Play';
  }

  private clearHighlight(): void {
    this.container.querySelector('.w.hl')?.classList.remove('hl');
  }

  private highlight(k: number): void {
    this.clearHighlight();
    const w = this.words[k];
    if (!w) return;
    w.el.classList.add('hl');
    w.el.scrollIntoView({ block: 'nearest' });
  }

  private finish(): void {
    this.active = null;
    this.current = 0;
    this.clearHighlight();
    this.setPlaying(false);
  }

  private speakFrom(index: number): void {
    const synth = this.synth;
    if (!synth) return;
    synth.cancel();
    if (this.words.length === 0) return;

    this.current = Math.max(0, Math.min(index, this.words.length - 1));
    const base = this.words[this.current].start;
    const u = new SpeechSynthesisUtterance(this.speechText.slice(base));
    u.rate = Number(this.ui.speedRange.value);
    u.lang = this.browserLang;
    const voice = synth.getVoices().find(v => v.voiceURI === this.ui.voiceSelect.value);
    if (voice) u.voice = voice;

    u.onboundary = (ev: SpeechSynthesisEvent) => {
      if (ev.name && ev.name !== 'word') return;
      const pos = base + ev.charIndex;
      let k = this.current;
      while (k + 1 < this.words.length && this.words[k + 1].start <= pos) k++;
      this.current = k;
      this.highlight(k);
    };

    const done = (): void => {
      if (this.active === u) this.finish();
    };
    u.onend = done;
    u.onerror = done;

    this.active = u;
    this.highlight(this.current);
    synth.speak(u);
  }

  private restart(): void {
    if (!this.active || !this.synth) return;
    const wasPaused = this.synth.paused;
    this.speakFrom(this.current);
    if (wasPaused) {
      this.synth.pause();
      this.setPlaying(false);
    } else {
      this.setPlaying(true);
    }
  }

  private togglePlay(): void {
    const synth = this.synth;
    if (!synth) return;
    if (this.words.length === 0) {
      this.ui.statusEl.textContent = 'Render some markdown first';
      return;
    }
    if (this.active) {
      if (synth.paused) {
        synth.resume();
        this.setPlaying(true);
      } else {
        synth.pause();
        this.setPlaying(false);
      }
      return;
    }
    this.speakFrom(this.current);
    this.setPlaying(true);
  }

  private onSpaceKey(e: KeyboardEvent): void {
    if (e.key !== ' ' || e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
    const target = e.target;
    if (target instanceof HTMLElement) {
      if (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT|BUTTON)$/.test(target.tagName)) return;
    }
    if (!this.synth || this.words.length === 0) return;
    e.preventDefault();
    this.togglePlay();
  }

  private onWordClick(e: Event): void {
    const target = e.target;
    if (!(target instanceof Element)) return;
    const w = target.closest<HTMLElement>('.w');
    if (!w || w.closest('summary')) return;
    this.current = Number(w.dataset.i);
    this.highlight(this.current);
    this.restart();
  }

  private populateVoices(): void {
    const synth = this.synth;
    if (!synth) return;
    const all = synth.getVoices();
    const exact = all.filter(v => sameLang(v.lang, this.browserLang));
    const matched = exact.length > 0 ? exact : all.filter(v => sameLang(v.lang.split(/[-_]/)[0], this.baseLang));
    const isMicrosoft = (v: SpeechSynthesisVoice): boolean => /microsoft/i.test(v.name);
    const voices = [...matched.filter(isMicrosoft), ...matched.filter(v => !isMicrosoft(v))];

    const select = this.ui.voiceSelect;
    const previous = select.value;
    select.innerHTML = '';

    if (voices.length === 0) {
      const opt = new Option(`No voices for ${this.browserLang}`, '', true, true);
      opt.disabled = true;
      select.add(opt);
      return;
    }

    for (const v of voices) {
      select.add(new Option(`${v.name} (${v.lang})`, v.voiceURI));
    }
    select.value = voices.some(v => v.voiceURI === previous) ? previous : voices[0].voiceURI;
  }
}
