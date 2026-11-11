export interface FakeVoice {
  voiceURI: string;
  name: string;
  lang: string;
}

export const FAKE_VOICES: FakeVoice[] = [
  { voiceURI: 'uri-google', name: 'Google US English', lang: 'en-US' },
  { voiceURI: 'uri-david', name: 'Microsoft David - English (United States)', lang: 'en-US' },
  { voiceURI: 'uri-thomas', name: 'Thomas', lang: 'fr-FR' },
];

export class FakeUtterance {
  text: string;
  rate = 1;
  lang = '';
  voice: FakeVoice | null = null;
  onboundary: ((ev: { name: string; charIndex: number }) => void) | null = null;
  onend: (() => void) | null = null;
  onerror: (() => void) | null = null;

  constructor(text: string) {
    this.text = text;
  }
}

export class FakeSynth {
  paused = false;
  speaking = false;
  readonly utterances: FakeUtterance[] = [];
  private readonly voices: FakeVoice[];

  constructor(voices: FakeVoice[]) {
    this.voices = voices;
  }

  getVoices(): FakeVoice[] {
    return this.voices;
  }

  speak(u: FakeUtterance): void {
    this.utterances.push(u);
    this.speaking = true;
  }

  cancel(): void {
    this.speaking = false;
  }

  pause(): void {
    this.paused = true;
  }

  resume(): void {
    this.paused = false;
  }

  addEventListener(): void {}
}

const globals = globalThis as unknown as Record<string, unknown>;

export const installSpeech = (voices: FakeVoice[]): FakeSynth => {
  const synth = new FakeSynth(voices);
  globals.speechSynthesis = synth;
  globals.SpeechSynthesisUtterance = FakeUtterance;
  return synth;
};

export const uninstallSpeech = (): void => {
  delete globals.speechSynthesis;
  delete globals.SpeechSynthesisUtterance;
};
