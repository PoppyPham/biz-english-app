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

/** Cheerful two-note rising chime for a correct answer. */
export function playCorrect() {
  const audio = getCtx()
  if (!audio) return
  const t = audio.currentTime
  tone(523.25, t, 0.12, { gain: 0.16 }) // C5
  tone(783.99, t + 0.09, 0.18, { gain: 0.18 }) // G5
}

/** Soft low buzz for a wrong answer — noticeable but not harsh. */
export function playWrong() {
  const audio = getCtx()
  if (!audio) return
  const t = audio.currentTime
  tone(180, t, 0.22, { type: "triangle", gain: 0.14, glideTo: 110 })
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
 * "combo" hit. Pitch climbs with the streak (capped) so a hot streak
 * audibly feels more exciting than a single correct answer.
 */
export function playStreak(streak: number) {
  const audio = getCtx()
  if (!audio) return
  const t = audio.currentTime
  const tier = Math.min(streak, 12)
  const base = 523.25 * Math.pow(2, tier / 24) // climbs up to ~1 octave
  tone(base, t, 0.1, { gain: 0.16 })
  tone(base * 1.5, t + 0.07, 0.16, { gain: 0.18 })
  if (streak >= 5) tone(base * 2, t + 0.14, 0.18, { gain: 0.14 })
}

/** Punchy hit when a life is lost — more consequential than a wrong buzz. */
export function playLifeLost() {
  const audio = getCtx()
  if (!audio) return
  const t = audio.currentTime
  tone(220, t, 0.1, { type: "sawtooth", gain: 0.16, glideTo: 140 })
  tone(160, t + 0.09, 0.2, { type: "triangle", gain: 0.15, glideTo: 80 })
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
