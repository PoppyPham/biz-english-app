// Lightweight synthesized game SFX (Web Audio API — no audio assets needed).

const STORAGE_KEY = "biz-english:sound-enabled"

export function isSoundEnabled(): boolean {
  if (typeof window === "undefined") return true
  return window.localStorage.getItem(STORAGE_KEY) !== "off"
}

export function setSoundEnabled(enabled: boolean) {
  if (typeof window === "undefined") return
  window.localStorage.setItem(STORAGE_KEY, enabled ? "on" : "off")
}

let ctx: AudioContext | null = null

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null
  const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!Ctor) return null
  if (!ctx) ctx = new Ctor()
  if (ctx.state === "suspended") void ctx.resume()
  return ctx
}

// iOS Safari only allows an AudioContext to actually produce sound if it was
// created/resumed synchronously inside a real user-gesture event (tap,
// click, key press) — not from a setTimeout/setInterval callback. The quiz
// timer auto-submits an answer when time runs out, and if THAT happens to
// be the very first sound triggered in a session, the shared AudioContext
// gets created outside any gesture and silently never works again, even
// though later taps call resume() on it. Priming it eagerly on the first
// real interaction anywhere on the page (which almost always precedes any
// timer-driven sound) avoids that trap entirely.
let primed = false
function primeAudioContext() {
  if (primed) return
  const audio = getCtx()
  if (!audio) return
  primed = true
  try {
    // Actually playing a silent buffer (not just resume()) is the belt-
    // and-suspenders unlock older WebKit versions need.
    const buffer = audio.createBuffer(1, 1, 22050)
    const src = audio.createBufferSource()
    src.buffer = buffer
    src.connect(audio.destination)
    src.start(0)
  } catch {
    // Non-fatal — resume() above already ran.
  }
}

if (typeof window !== "undefined") {
  const unlockEvents = ["touchend", "mousedown", "keydown"] as const
  const onFirstInteraction = () => {
    primeAudioContext()
    unlockEvents.forEach((e) => window.removeEventListener(e, onFirstInteraction))
  }
  unlockEvents.forEach((e) =>
    window.addEventListener(e, onFirstInteraction, { passive: true })
  )
}

function tone(
  freq: number,
  startTime: number,
  duration: number,
  { type = "sine" as OscillatorType, gain = 0.15, glideTo }: { type?: OscillatorType; gain?: number; glideTo?: number } = {}
) {
  if (!isSoundEnabled()) return
  const audio = getCtx()
  if (!audio) return

  const osc = audio.createOscillator()
  const amp = audio.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(freq, startTime)
  if (glideTo) osc.frequency.exponentialRampToValueAtTime(glideTo, startTime + duration)

  amp.gain.setValueAtTime(0, startTime)
  amp.gain.linearRampToValueAtTime(gain, startTime + 0.01)
  amp.gain.exponentialRampToValueAtTime(0.0001, startTime + duration)

  osc.connect(amp).connect(audio.destination)
  osc.start(startTime)
  osc.stop(startTime + duration + 0.02)
}

/** Soft neutral tone for a non-punishing "still learning" self-assessment. */
export function playNeutral() {
  const audio = getCtx()
  if (!audio) return
  tone(330, audio.currentTime, 0.15, { type: "sine", gain: 0.12 })
}

/** Tiny click for card flips / navigation. */
export function playFlip() {
  const audio = getCtx()
  if (!audio) return
  tone(440, audio.currentTime, 0.05, { type: "square", gain: 0.06 })
}

/** Fun little ascending arpeggio for finishing a session. */
export function playComplete() {
  const audio = getCtx()
  if (!audio) return
  const t = audio.currentTime
  ;[523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => {
    tone(freq, t + i * 0.11, 0.2, { gain: 0.15 })
  })
}

/**
 * Correct-answer chime that gets brighter/higher as a streak grows — the
 * "combo" hit. A three-note ascending hit with a glide on the last note so
 * a single correct answer already feels satisfying, with extra sparkle and
 * a couple of claps layered on for a hot streak.
 */
export function playStreak(streak: number) {
  const audio = getCtx()
  if (!audio) return
  const t = audio.currentTime
  const tier = Math.min(streak, 12)
  const base = 523.25 * Math.pow(2, tier / 24) // climbs up to ~1 octave

  // A crisp little "pop" on the front of every hit, for extra punch.
  noiseBurst(t, 0.07, { gain: 0.13, filterType: "bandpass", freq: 3200, q: 1.3 })

  tone(base, t, 0.1, { type: "triangle", gain: 0.18 })
  tone(base * 1.26, t + 0.07, 0.12, { type: "triangle", gain: 0.19 })
  tone(base * 1.5, t + 0.15, 0.22, { gain: 0.2, glideTo: base * 1.9 })
  clap(t + 0.16) // every correct answer gets at least one clap

  if (streak >= 3) {
    tone(base * 2.5, t + 0.22, 0.16, { gain: 0.11 })
    clap(t + 0.26)
  }
  if (streak >= 5) {
    tone(base * 3, t + 0.28, 0.18, { gain: 0.12 })
    clap(t + 0.32)
    clap(t + 0.38)
  }
}

/**
 * Impactful hit when a life is lost — a sharp buzz followed by a heavier,
 * descending "womp womp womp" so it reads as a real setback, not a blip.
 */
export function playLifeLost() {
  const audio = getCtx()
  if (!audio) return
  const t = audio.currentTime
  tone(200, t, 0.16, { type: "sawtooth", gain: 0.2, glideTo: 100 })
  tone(150, t + 0.17, 0.22, { type: "sawtooth", gain: 0.18, glideTo: 80 })
  tone(110, t + 0.36, 0.32, { type: "triangle", gain: 0.16, glideTo: 55 })
}

/** Triumphant "1UP"-style jingle for earning a bonus life. */
export function playExtraLife() {
  const audio = getCtx()
  if (!audio) return
  const t = audio.currentTime
  ;[659.25, 783.99, 987.77, 1318.51].forEach((freq, i) => {
    tone(freq, t + i * 0.09, 0.16, { gain: 0.17 })
  })
}

/** Somber descending tone when lives run out. */
export function playGameOver() {
  const audio = getCtx()
  if (!audio) return
  const t = audio.currentTime
  ;[392, 349.23, 293.66, 261.63].forEach((freq, i) => {
    tone(freq, t + i * 0.14, 0.28, { type: "triangle", gain: 0.14 })
  })
}

/**
 * General-purpose filtered-noise burst — the raw material behind claps,
 * pops, explosion "bangs", and crowd-noise swells below.
 */
function noiseBurst(
  startTime: number,
  duration: number,
  {
    gain = 0.15,
    filterType = "bandpass" as BiquadFilterType,
    freq = 2000,
    freqEnd,
    q = 1,
  }: {
    gain?: number
    filterType?: BiquadFilterType
    freq?: number
    freqEnd?: number
    q?: number
  } = {}
) {
  if (!isSoundEnabled()) return
  const audio = getCtx()
  if (!audio) return

  const sampleRate = audio.sampleRate
  const buffer = audio.createBuffer(1, Math.floor(sampleRate * duration), sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1

  const src = audio.createBufferSource()
  src.buffer = buffer

  const filter = audio.createBiquadFilter()
  filter.type = filterType
  filter.frequency.setValueAtTime(freq, startTime)
  if (freqEnd) filter.frequency.exponentialRampToValueAtTime(freqEnd, startTime + duration)
  filter.Q.value = q

  const amp = audio.createGain()
  amp.gain.setValueAtTime(0, startTime)
  amp.gain.linearRampToValueAtTime(gain, startTime + Math.min(0.02, duration / 4))
  amp.gain.exponentialRampToValueAtTime(0.0001, startTime + duration)

  src.connect(filter).connect(amp).connect(audio.destination)
  src.start(startTime)
  src.stop(startTime + duration + 0.02)
}

/** A short filtered-noise "clap" — building block for an applause swell. */
function clap(startTime: number) {
  noiseBurst(startTime, 0.05, {
    gain: 0.13,
    filterType: "bandpass",
    freq: 2200 + Math.random() * 1500,
    q: 1,
  })
}

/** A rising "whistle" — the firework-launch sound, before the burst lands. */
function whistleUp(startTime: number, duration: number) {
  if (!isSoundEnabled()) return
  const audio = getCtx()
  if (!audio) return
  const osc = audio.createOscillator()
  const amp = audio.createGain()
  osc.type = "sine"
  osc.frequency.setValueAtTime(320, startTime)
  osc.frequency.exponentialRampToValueAtTime(1900, startTime + duration)
  amp.gain.setValueAtTime(0, startTime)
  amp.gain.linearRampToValueAtTime(0.13, startTime + duration * 0.7)
  amp.gain.exponentialRampToValueAtTime(0.0001, startTime + duration)
  osc.connect(amp).connect(audio.destination)
  osc.start(startTime)
  osc.stop(startTime + duration + 0.02)
}

/** A firework "BANG" — a punchy low burst plus a sub-bass thump for weight. */
function boom(startTime: number) {
  noiseBurst(startTime, 0.35, {
    gain: 0.32,
    filterType: "lowpass",
    freq: 1200,
    freqEnd: 200,
    q: 0.7,
  })
  tone(85, startTime, 0.3, { type: "sine", gain: 0.22, glideTo: 45 })
}

/** A scatter of high, randomly-pitched twinkles — firework sparks raining down. */
function sparkleShower(startTime: number, count: number, spreadSeconds: number) {
  const pitches = [1567.98, 1760, 1864.66, 2093, 2349.32, 2489.02, 2793.83, 3135.96]
  for (let i = 0; i < count; i++) {
    const freq = pitches[Math.floor(Math.random() * pitches.length)]
    tone(freq, startTime + Math.random() * spreadSeconds, 0.12 + Math.random() * 0.08, {
      gain: 0.05 + Math.random() * 0.05,
    })
  }
}

/** A big, roaring round of applause — a sustained cheer bed plus dense claps. */
function crowdCheer(startTime: number, duration: number) {
  noiseBurst(startTime, duration, {
    gain: 0.15,
    filterType: "bandpass",
    freq: 1200,
    freqEnd: 2600,
    q: 0.6,
  })
  const clapCount = Math.round(duration * 16)
  for (let i = 0; i < clapCount; i++) clap(startTime + Math.random() * duration)
}

/**
 * Big fireworks-style celebration — launch whistle, BANG, a shower of
 * sparkles, and a roaring round of applause, with a bright chord landing
 * on the burst so it still feels musical. Used for the flashcard
 * "memorized" reward, which should feel like a genuine prize, not a chime.
 */
export function playCelebrate() {
  const audio = getCtx()
  if (!audio) return
  const t = audio.currentTime

  whistleUp(t, 0.3) // launch
  boom(t + 0.3) // BANG!

  // bright chord landing right on the burst
  tone(659.25, t + 0.32, 0.4, { type: "triangle", gain: 0.19 })
  tone(1046.5, t + 0.35, 0.55, { gain: 0.23, glideTo: 1318.51 })

  sparkleShower(t + 0.42, 22, 1.0) // sparks raining down
  crowdCheer(t + 0.45, 1.5) // the crowd goes wild
}

/** Big celebratory fanfare for beating a high score. */
export function playHighScore() {
  const audio = getCtx()
  if (!audio) return
  const t = audio.currentTime
  ;[523.25, 659.25, 783.99, 1046.5, 1318.51].forEach((freq, i) => {
    tone(freq, t + i * 0.08, 0.3, { gain: 0.18 })
  })
  tone(1567.98, t + 0.4, 0.35, { gain: 0.16, glideTo: 2093 })
}
