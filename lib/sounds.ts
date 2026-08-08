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
