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

// --- Música ambiente: progressão de pads em loop ---
let musicStarted = false;
let musicTimer: number | null = null;

const CHORDS: number[][] = [
  [220.00, 261.63, 329.63], // Am
  [196.00, 246.94, 293.66], // G
  [174.61, 220.00, 261.63], // F
  [261.63, 329.63, 392.00], // C
];

function playChord(freqs: number[], duration: number) {
  const c = ensureCtx();
  if (!c || !musicGain) return;
  const now = c.currentTime;
  freqs.forEach((f, i) => {
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = i === 0 ? "triangle" : "sine";
    osc.frequency.value = f;
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(0.18, now + 0.6);
    g.gain.linearRampToValueAtTime(0.14, now + duration - 0.6);
    g.gain.linearRampToValueAtTime(0, now + duration);
    osc.connect(g);
    g.connect(musicGain);
    osc.start(now);
    osc.stop(now + duration + 0.05);
  });
  // melodia simples por cima
  const lead = c.createOscillator();
  const lg = c.createGain();
  lead.type = "sine";
  lead.frequency.value = freqs[2] * 2;
  lg.gain.setValueAtTime(0, now);
  lg.gain.linearRampToValueAtTime(0.06, now + 0.4);
  lg.gain.linearRampToValueAtTime(0, now + duration);
  lead.connect(lg);
  lg.connect(musicGain);
  lead.start(now + 0.2);
  lead.stop(now + duration);
}

export function startMusic() {
  if (typeof window === "undefined") return;
  if (musicStarted) return;
  ensureCtx();
  musicStarted = true;
  let i = 0;
  const step = () => {
    if (!musicStarted) return;
    if (!settings.musicMuted) playChord(CHORDS[i % CHORDS.length], 3.6);
    i++;
    musicTimer = window.setTimeout(step, 3500);
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
