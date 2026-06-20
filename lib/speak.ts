// Browser text-to-speech with a gentler, higher-quality default voice.
// The OS default voice is often harsh/robotic, so we prefer known-good natural
// voices and slow the rate slightly.

let cachedVoice: SpeechSynthesisVoice | null | undefined

function pickVoice(synth: SpeechSynthesis): SpeechSynthesisVoice | null {
  if (cachedVoice !== undefined) return cachedVoice
  const voices = synth.getVoices()
  if (voices.length === 0) return null // not loaded yet; use engine default

  const byName = (re: RegExp) =>
    voices.find((v) => re.test(v.name) && v.lang.toLowerCase().startsWith("en"))

  cachedVoice =
    byName(/Samantha|Google US English|Microsoft (Aria|Jenny|Michelle)|Karen|Daniel/i) ||
    voices.find((v) => v.lang === "en-US" && v.localService) ||
    voices.find((v) => v.lang.toLowerCase().startsWith("en")) ||
    null
  return cachedVoice
}

export function speakText(text: string, lang = "en-US") {
  if (typeof window === "undefined" || !window.speechSynthesis) return
  const synth = window.speechSynthesis

  const utterance = new SpeechSynthesisUtterance(text)
  utterance.lang = lang
  utterance.rate = 0.9 // a touch slower → clearer, less shrill
  utterance.pitch = 1
  utterance.volume = 0.85 // soften it a bit

  const voice = pickVoice(synth)
  if (voice) utterance.voice = voice

  synth.cancel()
  synth.speak(utterance)
}

// Voices load asynchronously in some browsers; refresh the cache when ready.
if (typeof window !== "undefined" && window.speechSynthesis) {
  window.speechSynthesis.onvoiceschanged = () => {
    cachedVoice = undefined
  }
}
