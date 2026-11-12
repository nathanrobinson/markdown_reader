import { describe, it, expect, beforeEach } from 'vitest';
import { markdownToHtml } from '../src/markdown';
import { SpeechReader, speakable } from '../src/speech';
import { FAKE_VOICES, FakeSynth, installSpeech, uninstallSpeech } from './helpers';

interface Mounted {
  reader: SpeechReader;
  out: HTMLElement;
  playBtn: HTMLButtonElement;
  voice: HTMLSelectElement;
  speed: HTMLInputElement;
  status: HTMLElement;
}

const mount = (markdown: string): Mounted => {
  document.body.innerHTML = `
    <button id="play" type="button">Play</button>
    <select id="voice"></select>
    <input id="speed" type="range" min="0.5" max="2" step="0.25" value="1">
    <span id="speed-label">1x</span>
    <span id="status"></span>
    <textarea id="src"></textarea>
    <main id="out"></main>`;

  const byId = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T;
  const out = byId<HTMLElement>('out');
  out.innerHTML = markdownToHtml(markdown);

  const playBtn = byId<HTMLButtonElement>('play');
  const voice = byId<HTMLSelectElement>('voice');
  const speed = byId<HTMLInputElement>('speed');
  const status = byId<HTMLElement>('status');

  const reader = new SpeechReader(out, {
    playBtn,
    voiceSelect: voice,
    speedRange: speed,
    speedLabel: byId<HTMLElement>('speed-label'),
    statusEl: status,
  });
  reader.wrap();

  return { reader, out, playBtn, voice, speed, status };
};

const wordEls = (out: HTMLElement): HTMLElement[] => Array.from(out.querySelectorAll<HTMLElement>('.w'));

const highlightedText = (out: HTMLElement): string | null | undefined => out.querySelector('.w.hl')?.textContent;

const pressSpace = (target: HTMLElement): void => {
  target.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true }));
};

const lastUtterance = (synth: FakeSynth) => synth.utterances[synth.utterances.length - 1];

let synth: FakeSynth;

beforeEach(() => {
  synth = installSpeech(FAKE_VOICES);
});

describe('speakable', () => {
  it('reads arrows by name', () => {
    expect(speakable('->').trim()).toBe('arrow');
  });

  it('reads standalone operators by name', () => {
    expect(speakable('+')).toBe('plus');
  });

  it('reads json as jason', () => {
    expect(speakable('json')).toBe('jason');
  });

  it('reads jsonb as jason bee, ignoring case', () => {
    expect(speakable('JSONB')).toBe('jason bee');
  });

  it('reads json plurals', () => {
    expect(speakable('jsons')).toBe('jasons');
  });

  it('reads parentheses aloud', () => {
    expect(speakable('(x)')).toBe('open paren x close paren');
    expect(speakable('max(a,')).toBe('max open paren a,');
  });

  it('reads percent signs', () => {
    expect(speakable('50%').trim()).toBe('50 percent');
  });

  it('leaves ordinary words unchanged', () => {
    expect(speakable('hello')).toBe('hello');
  });

  it('does not treat symbols inside words as operators', () => {
    expect(speakable('C++')).toBe('C++');
  });
});

describe('SpeechReader voices', () => {
  it('lists only voices in the browser language, with Microsoft voices first', () => {
    const { voice } = mount('Hello');
    const values = Array.from(voice.options).map(o => o.value);
    expect(values).toEqual(['uri-david', 'uri-google']);
  });

  it('disables playback when speech synthesis is unavailable', () => {
    uninstallSpeech();
    const { playBtn, status } = mount('Hello');
    expect(playBtn.disabled).toBe(true);
    expect(status.textContent).toContain('not supported');
  });
});

describe('SpeechReader playback', () => {
  it('speaks the text and highlights the first word', () => {
    const { playBtn, out } = mount('Hello world.');
    playBtn.click();
    expect(synth.utterances).toHaveLength(1);
    expect(lastUtterance(synth).text.trim()).toBe('Hello world.');
    expect(playBtn.textContent).toBe('Pause');
    expect(highlightedText(out)).toBe('Hello');
  });

  it('pauses and resumes when the button is clicked', () => {
    const { playBtn } = mount('Hello world.');
    playBtn.click();
    playBtn.click();
    expect(synth.paused).toBe(true);
    expect(playBtn.textContent).toBe('Play');
    playBtn.click();
    expect(synth.paused).toBe(false);
    expect(playBtn.textContent).toBe('Pause');
  });

  it('toggles with the space bar when focus is on the page', () => {
    const { out, playBtn } = mount('Hello world.');
    pressSpace(document.body);
    expect(synth.utterances).toHaveLength(1);
    expect(playBtn.textContent).toBe('Pause');
    expect(highlightedText(out)).toBe('Hello');
    pressSpace(document.body);
    expect(synth.paused).toBe(true);
  });

  it('ignores the space bar while typing in the text box', () => {
    mount('Hello world.');
    const textarea = document.getElementById('src') as HTMLTextAreaElement;
    pressSpace(textarea);
    expect(synth.utterances).toHaveLength(0);
  });

  it('does nothing when there is no text to read', () => {
    const { playBtn, status } = mount('');
    playBtn.click();
    expect(synth.utterances).toHaveLength(0);
    expect(status.textContent).toBe('Render some markdown first');
  });

  it('pauses briefly after a heading', () => {
    const { playBtn } = mount('# Intro\n\nBody text');
    playBtn.click();
    expect(lastUtterance(synth).text).toContain('Intro. Body text');
  });

  it('speaks symbols and json by name', () => {
    const { playBtn } = mount('Parse JSON -> done');
    playBtn.click();
    expect(lastUtterance(synth).text).toContain('Parse jason arrow done');
  });
});

describe('SpeechReader word selection', () => {
  it('moves the highlight to a clicked word', () => {
    const { out } = mount('Hello world.');
    wordEls(out)[1].click();
    expect(highlightedText(out)).toBe('world.');
  });

  it('keeps playing from the clicked word while playing', () => {
    const { out, playBtn } = mount('Hello world.');
    playBtn.click();
    wordEls(out)[1].click();
    expect(synth.utterances).toHaveLength(2);
    expect(lastUtterance(synth).text.trim()).toBe('world.');
    expect(synth.paused).toBe(false);
    expect(playBtn.textContent).toBe('Pause');
  });

  it('stays paused when a word is clicked while paused', () => {
    const { out, playBtn } = mount('Hello world.');
    playBtn.click();
    playBtn.click();
    wordEls(out)[1].click();
    expect(synth.paused).toBe(true);
    expect(playBtn.textContent).toBe('Play');
    expect(highlightedText(out)).toBe('world.');
  });

  it('does not start playback when a heading word is clicked', () => {
    const { out } = mount('# Intro\n\nBody');
    wordEls(out)[0].click();
    expect(synth.utterances).toHaveLength(0);
  });
});

describe('SpeechReader voice and speed controls', () => {
  it('restarts from the current word at the new speed', () => {
    const { speed, playBtn } = mount('Hello world.');
    playBtn.click();
    speed.value = '1.5';
    speed.dispatchEvent(new Event('change'));
    expect(synth.utterances).toHaveLength(2);
    expect(lastUtterance(synth).rate).toBe(1.5);
    expect(synth.paused).toBe(false);
  });

  it('keeps the reader paused when the speed changes while paused', () => {
    const { speed, playBtn } = mount('Hello world.');
    playBtn.click();
    playBtn.click();
    speed.value = '1.5';
    speed.dispatchEvent(new Event('change'));
    expect(synth.paused).toBe(true);
    expect(playBtn.textContent).toBe('Play');
  });

  it('keeps the reader paused when the voice changes while paused', () => {
    const { voice, playBtn } = mount('Hello world.');
    playBtn.click();
    playBtn.click();
    voice.value = 'uri-google';
    voice.dispatchEvent(new Event('change'));
    expect(synth.paused).toBe(true);
    expect(playBtn.textContent).toBe('Play');
  });

  it('applies the selected voice to new utterances', () => {
    const { voice, playBtn } = mount('Hello world.');
    voice.value = 'uri-google';
    playBtn.click();
    expect(lastUtterance(synth).voice?.voiceURI).toBe('uri-google');
  });
});

describe('SpeechReader tables', () => {
  const TABLE = '| Name | Age |\n|---|---|\n| Ann | 3 |\n| Bob | 5 |';

  it('reads each row as header then value, column by column', () => {
    const { playBtn } = mount(TABLE);
    playBtn.click();
    expect(lastUtterance(synth).text).toContain('Name, Ann, Age, 3, Name, Bob, Age, 5');
  });

  it('pauses between a header and its value', () => {
    const { playBtn } = mount('| Item | Price |\n|---|---|\n| Tea | 4 |');
    playBtn.click();
    expect(lastUtterance(synth).text).toContain('Item, Tea, Price, 4');
  });

  it('starts reading from a clicked body cell', () => {
    const { out, playBtn } = mount(TABLE);
    playBtn.click();
    const bob = wordEls(out).find(el => el.textContent === 'Bob')!;
    bob.click();
    expect(highlightedText(out)).toBe('Bob');
    expect(lastUtterance(synth).text.trim()).toMatch(/^Bob, Age, 5/);
  });
});
