// Som procedural via Web Audio API — sem dependências, sem arquivos externos.
// Sintetiza SFX de batalha e uma trilha ambiente em loop.

type SoundKind =
  | "hit"
  | "crit"
  | "heal"
  | "skill"
  | "buff"
  | "debuff"
  | "victory"
  | "defeat"
  | "click";

const SETTINGS_KEY = "arenapet:sound";

type Settings = { muted: boolean; volume: number; musicMuted: boolean; musicVolume: number };

function loadSettings(): Settings {
  if (typeof window === "undefined") return { muted: false, volume: 0.6, musicMuted: false, musicVolume: 0.25 };
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) {
      const s = JSON.parse(raw);
      return {
        muted: !!s.muted,
        volume: typeof s.volume === "number" ? s.volume : 0.6,
        musicMuted: !!s.musicMuted,
        musicVolume: typeof s.musicVolume === "number" ? s.musicVolume : 0.25,
      };
    }
  } catch {}
  return { muted: false, volume: 0.6, musicMuted: false, musicVolume: 0.25 };
}

let settings: Settings = loadSettings();

function saveSettings() {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch {}
  if (sfxGain) sfxGain.gain.value = settings.muted ? 0 : settings.volume;
  if (musicGain) musicGain.gain.value = settings.musicMuted ? 0 : settings.musicVolume * 0.6;
}

let ctx: AudioContext | null = null;
let sfxGain: GainNode | null = null;
let musicGain: GainNode | null = null;

function ensureCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const Ctx = (window.AudioContext || (window as any).webkitAudioContext) as typeof AudioContext | undefined;
    if (!Ctx) return null;
    ctx = new Ctx();
    sfxGain = ctx.createGain();
    sfxGain.gain.value = settings.muted ? 0 : settings.volume;
    sfxGain.connect(ctx.destination);
    musicGain = ctx.createGain();
    musicGain.gain.value = settings.musicMuted ? 0 : settings.musicVolume * 0.6;
    musicGain.connect(ctx.destination);
  }
  if (ctx.state === "suspended") ctx.resume().catch(() => {});
  return ctx;
}

// Destrava o áudio no primeiro gesto do usuário (políticas de autoplay).
if (typeof window !== "undefined") {
  const unlock = () => { ensureCtx(); };
  window.addEventListener("pointerdown", unlock, { once: true });
  window.addEventListener("keydown", unlock, { once: true });
  window.addEventListener("touchstart", unlock, { once: true });
}

function tone(opts: {
  freq: number;
  type?: OscillatorType;
  duration: number;
  attack?: number;
  release?: number;
  gain?: number;
  freqEnd?: number;
  delay?: number;
}) {
  const c = ensureCtx();
  if (!c || !sfxGain) return;
  const now = c.currentTime + (opts.delay ?? 0);
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = opts.type ?? "sine";
  osc.frequency.setValueAtTime(opts.freq, now);
  if (opts.freqEnd !== undefined) {
    osc.frequency.exponentialRampToValueAtTime(Math.max(0.01, opts.freqEnd), now + opts.duration);
  }
  const peak = opts.gain ?? 0.25;
  const attack = opts.attack ?? 0.005;
  const release = opts.release ?? Math.max(0.05, opts.duration * 0.5);
  g.gain.setValueAtTime(0, now);
  g.gain.linearRampToValueAtTime(peak, now + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, now + opts.duration + release);
  osc.connect(g);
  g.connect(sfxGain);
  osc.start(now);
  osc.stop(now + opts.duration + release + 0.05);
}

function noise(opts: { duration: number; gain?: number; freq?: number; delay?: number }) {
  const c = ensureCtx();
  if (!c || !sfxGain) return;
  const now = c.currentTime + (opts.delay ?? 0);
  const bufferSize = Math.floor(c.sampleRate * opts.duration);
  const buffer = c.createBuffer(1, bufferSize, c.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
  const src = c.createBufferSource();
  src.buffer = buffer;
  const filter = c.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.value = opts.freq ?? 800;
  filter.Q.value = 1.2;
  const g = c.createGain();
  g.gain.value = opts.gain ?? 0.2;
  src.connect(filter);
  filter.connect(g);
  g.connect(sfxGain);
  src.start(now);
}

export function playSfx(kind: SoundKind) {
  if (settings.muted) return;
  switch (kind) {
    case "hit":
      noise({ duration: 0.12, gain: 0.35, freq: 600 });
      tone({ freq: 220, type: "square", duration: 0.08, gain: 0.18, freqEnd: 90 });
      break;
    case "crit":
      noise({ duration: 0.18, gain: 0.45, freq: 900 });
      tone({ freq: 660, type: "sawtooth", duration: 0.12, gain: 0.25, freqEnd: 220 });
      tone({ freq: 880, type: "square", duration: 0.18, gain: 0.18, freqEnd: 330, delay: 0.05 });
      break;
    case "heal":
      tone({ freq: 523, type: "sine", duration: 0.18, gain: 0.22 });
      tone({ freq: 784, type: "sine", duration: 0.22, gain: 0.18, delay: 0.08 });
      tone({ freq: 1046, type: "sine", duration: 0.25, gain: 0.16, delay: 0.16 });
      break;
    case "skill":
      tone({ freq: 180, type: "sawtooth", duration: 0.15, gain: 0.22, freqEnd: 520 });
      tone({ freq: 90, type: "triangle", duration: 0.2, gain: 0.18, freqEnd: 260, delay: 0.04 });
      noise({ duration: 0.1, gain: 0.18, freq: 1200, delay: 0.12 });
      break;
    case "buff":
      tone({ freq: 440, type: "triangle", duration: 0.12, gain: 0.18 });
      tone({ freq: 660, type: "triangle", duration: 0.16, gain: 0.18, delay: 0.08 });
      break;
    case "debuff":
      tone({ freq: 320, type: "sawtooth", duration: 0.2, gain: 0.18, freqEnd: 140 });
      noise({ duration: 0.15, gain: 0.12, freq: 400, delay: 0.05 });
      break;
    case "victory":
      tone({ freq: 523, type: "triangle", duration: 0.18, gain: 0.28 });
      tone({ freq: 659, type: "triangle", duration: 0.18, gain: 0.28, delay: 0.18 });
      tone({ freq: 784, type: "triangle", duration: 0.22, gain: 0.3, delay: 0.36 });
      tone({ freq: 1046, type: "triangle", duration: 0.5, gain: 0.32, delay: 0.56 });
      break;
    case "defeat":
      tone({ freq: 392, type: "sawtooth", duration: 0.3, gain: 0.22 });
      tone({ freq: 311, type: "sawtooth", duration: 0.3, gain: 0.22, delay: 0.25 });
      tone({ freq: 196, type: "sawtooth", duration: 0.7, gain: 0.25, delay: 0.5, freqEnd: 110 });
      break;
    case "click":
      tone({ freq: 880, type: "square", duration: 0.04, gain: 0.12 });
      break;
  }
}

// --- Trilha épica de batalha: tambores graves + baixo + lead heroico ---
let musicStarted = false;
let musicTimer: number | null = null;

// Progressão em Lá menor — épica/marcial
// Cada compasso: [tônica do baixo, notas do lead]
const BARS: { bass: number; lead: number[] }[] = [
  { bass: 110.00, lead: [440.00, 523.25, 659.25, 523.25] }, // Am
  { bass: 87.31,  lead: [392.00, 523.25, 587.33, 523.25] }, // F
  { bass: 98.00,  lead: [392.00, 493.88, 587.33, 493.88] }, // G
  { bass: 110.00, lead: [440.00, 523.25, 659.25, 880.00] }, // Am
];

const BEAT = 0.42; // ~143 BPM
const BAR_DURATION = BEAT * 4;

function kick(time: number) {
  const c = ctx!;
  const mg = musicGain!;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = "sine";
  osc.frequency.setValueAtTime(140, time);
  osc.frequency.exponentialRampToValueAtTime(40, time + 0.15);
  g.gain.setValueAtTime(0, time);
  g.gain.linearRampToValueAtTime(0.6, time + 0.005);
  g.gain.exponentialRampToValueAtTime(0.001, time + 0.25);
  osc.connect(g);
  g.connect(mg);
  osc.start(time);
  osc.stop(time + 0.3);
}

function snare(time: number) {
  const c = ctx!;
  const mg = musicGain!;
  const bufferSize = Math.floor(c.sampleRate * 0.2);
  const buffer = c.createBuffer(1, bufferSize, c.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
  const src = c.createBufferSource();
  src.buffer = buffer;
  const filter = c.createBiquadFilter();
  filter.type = "highpass";
  filter.frequency.value = 1200;
  const g = c.createGain();
  g.gain.value = 0.3;
  src.connect(filter);
  filter.connect(g);
  g.connect(mg);
  src.start(time);
}

function bassNote(time: number, freq: number, duration: number) {
  const c = ctx!;
  const mg = musicGain!;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = "sawtooth";
  osc.frequency.value = freq;
  const filter = c.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = 500;
  g.gain.setValueAtTime(0, time);
  g.gain.linearRampToValueAtTime(0.28, time + 0.02);
  g.gain.linearRampToValueAtTime(0.2, time + duration - 0.05);
  g.gain.linearRampToValueAtTime(0, time + duration);
  osc.connect(filter);
  filter.connect(g);
  g.connect(mg);
  osc.start(time);
  osc.stop(time + duration + 0.05);
}

function leadNote(time: number, freq: number, duration: number) {
  const c = ctx!;
  const mg = musicGain!;
  const osc = c.createOscillator();
  const osc2 = c.createOscillator();
  const g = c.createGain();
  osc.type = "square";
  osc2.type = "triangle";
  osc.frequency.value = freq;
  osc2.frequency.value = freq * 1.005; // leve detune épico
  g.gain.setValueAtTime(0, time);
  g.gain.linearRampToValueAtTime(0.14, time + 0.05);
  g.gain.linearRampToValueAtTime(0.1, time + duration - 0.08);
  g.gain.linearRampToValueAtTime(0, time + duration);
  osc.connect(g);
  osc2.connect(g);
  g.connect(mg);
  osc.start(time);
  osc2.start(time);
  osc.stop(time + duration + 0.05);
  osc2.stop(time + duration + 0.05);
}

function playBar(bar: { bass: number; lead: number[] }) {
  const c = ensureCtx();
  if (!c || !musicGain) return;
  const now = c.currentTime + 0.05;
  // Tambores: kick em 1 e 3, snare em 2 e 4
  kick(now);
  snare(now + BEAT);
  kick(now + BEAT * 2);
  snare(now + BEAT * 3);
  // Kick extra de "build" na metade
  kick(now + BEAT * 3.5);
  // Baixo segurando o compasso
  bassNote(now, bar.bass, BAR_DURATION * 0.95);
  bassNote(now, bar.bass * 0.5, BAR_DURATION * 0.95);
  // Lead heroico — uma nota por beat
  bar.lead.forEach((f, i) => {
    leadNote(now + BEAT * i, f, BEAT * 0.9);
  });
}

export function startMusic() {
  if (typeof window === "undefined") return;
  if (musicStarted) return;
  ensureCtx();
  musicStarted = true;
  let i = 0;
  const step = () => {
    if (!musicStarted) return;
    if (!settings.musicMuted) playBar(BARS[i % BARS.length]);
    i++;
    musicTimer = window.setTimeout(step, BAR_DURATION * 1000);
  };
  step();
}

export function stopMusic() {
  musicStarted = false;
  if (musicTimer !== null) {
    clearTimeout(musicTimer);
    musicTimer = null;
  }
}

export function getSoundSettings(): Settings {
  return { ...settings };
}

export function setSoundSettings(next: Partial<Settings>) {
  settings = { ...settings, ...next };
  saveSettings();
}
