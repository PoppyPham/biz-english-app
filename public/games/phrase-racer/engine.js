/*
 * Phrase Racer engine — pure vanilla JS, mountable inside any container.
 * Exposes window.PhraseRacer.mount(container, { questions, categoryName, onGameOver })
 * -> { unmount() }.
 *
 * Top 2/3 of the mounted area is an HTML5 Canvas endless runner; bottom 1/3
 * is a DOM word-matching puzzle. All state lives inside the mount() closure
 * so multiple mounts (e.g. across client-side route changes) never collide.
 */
(function () {
  "use strict";
  if (window.PhraseRacer) return;

  // ── Config ────────────────────────────────────────────────────────────
  var CONFIG = {
    QUESTION_MS: 30000,
    START_LIVES: 3,
    START_SPEED: 20,
    SPEED_UP: 5,
    SPEED_DOWN: 5,
    SPEED_MIN: 10,
    NITRO_STREAK: 3,
    NITRO_MULT: 2,
    EXTRA_LIFE_STREAK: 10,
    DISTANCE_K: 0.277,
    PX_PER_KMH: 6,
    MAX_SCROLL_PX_S: 900,
    MAX_DT_MS: 50,
    CRASH: { APPROACH: 180, SHAKE: 520, HOLD: 1700, FADE: 300, TOTAL: 2000 },
    HOP: 350,
  };

  var COLORS = {
    spaceTop: "#05070a",
    spaceBottom: "#0c100e",
    starDim: "#48534d",
    starBright: "#eef1ee",
    primary: "#22c55e",
    amber: "#f59e0b",
    destructive: "#ef4444",
    hull: "#22c55e",
    hullDark: "#15803d",
    cockpit: "#0a1a22",
    chrome: "#c7cdd1",
    engineCore: "#e8f7ff",
    engineGlow: "#38bdf8",
    rockLight: "#8a7660",
    rockDark: "#2e251c",
  };

  // Wrap periods for the three scroll offsets advanceScroll() maintains —
  // unchanged from before (still just "how many px before this parallax
  // layer's offset resets to 0"); every drawing spacing below is chosen to
  // evenly divide its layer's wrap period so recycling stays seamless.
  var TREE_FAR_SPACING = 140;
  var TREE_NEAR_SPACING = 90;
  var ROAD_DASH = 40;

  var STAR_FAR_SPACING = TREE_FAR_SPACING / 4; // 35
  var STAR_NEAR_SPACING = TREE_NEAR_SPACING / 3; // 30
  var DUST_SPACING = ROAD_DASH / 2; // 20
  var PLANET_SPACING = TREE_FAR_SPACING * 2; // 280 — more planets in view
  var NEBULA_SPACING = TREE_FAR_SPACING * 6; // 840

  // Picked per-planet via a hashed pseudo-random index (not k % length), so
  // consecutive planets don't fall into an obvious short repeating cycle.
  var PLANET_PALETTES = [
    { body: "#c2694a", shade: "#7a3f2a", ring: false, bands: false },
    { body: "#3b82c4", shade: "#1f4e78", ring: false, bands: false },
    { body: "#caa15a", shade: "#7d6236", ring: true, bands: true },
    { body: "#7c6a9e", shade: "#453a5c", ring: false, bands: true },
    { body: "#22c55e", shade: "#0f5c33", ring: false, bands: false },
    { body: "#e2789a", shade: "#8a3c56", ring: true, bands: false },
    { body: "#2dd4bf", shade: "#0f6b60", ring: false, bands: true },
    { body: "#f59e0b", shade: "#8a5406", ring: true, bands: true },
    { body: "#94a3b8", shade: "#475569", ring: false, bands: false },
    { body: "#ef4444", shade: "#7f1d1d", ring: false, bands: true },
  ];
  var NEBULA_COLORS = ["rgba(34,197,94,0.10)", "rgba(14,165,233,0.10)", "rgba(124,58,237,0.09)"];

  function pseudoRandom(seed) {
    var x = Math.sin(seed * 12.9898) * 43758.5453;
    return x - Math.floor(x);
  }
  var FALLBACK_WORDS = ["quickly", "meeting", "project", "budget", "deadline", "client", "carefully", "tomorrow"];

  function normalizeWord(w) { return w.toLowerCase().replace(/[^a-z]/g, ""); }

  function shuffle(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = a[i]; a[i] = a[j]; a[j] = tmp;
    }
    return a;
  }

  // ── Shared audio context (one per page, reused across mounts) ───────────
  var audioCtx = null;
  function getCtx() {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === "suspended") audioCtx.resume();
    return audioCtx;
  }

  var sessionAudioEl = null;
  function holdPlaybackAudioSession() {
    if (sessionAudioEl) return;
    try {
      sessionAudioEl = new Audio(
        "data:audio/wav;base64,UklGRiwAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQgAAACAgICAgICAgA=="
      );
      sessionAudioEl.loop = true;
      sessionAudioEl.volume = 0.01;
      sessionAudioEl.play().catch(function () {});
    } catch (e) { /* audio unavailable, non-essential */ }
  }

  // Speaks the full (un-blanked) example sentence after every answer, right
  // or wrong, so the player hears the phrase used correctly regardless.
  // Voice-picking logic ported verbatim from lib/speak.ts (the pronunciation
  // speaker button already used across Quiz/Flashcard/phrase pages) rather
  // than reinvented here — that one is proven to sound natural, whereas an
  // independent pick risks landing on one of macOS's "novelty" voices
  // (Albert, Zarvox, ...) that sort in ahead of the real ones by name.
  var cachedVoice; // undefined = not yet resolved, null = resolved to "none"
  function pickVoice() {
    if (cachedVoice !== undefined) return cachedVoice;
    if (!window.speechSynthesis) return null;
    var voices = window.speechSynthesis.getVoices();
    if (!voices || voices.length === 0) return null;
    function byName(re) {
      return voices.find(function (v) { return re.test(v.name) && v.lang.toLowerCase().indexOf("en") === 0; });
    }
    cachedVoice =
      byName(/Samantha|Google US English|Microsoft (Aria|Jenny|Michelle)|Karen|Daniel/i) ||
      voices.find(function (v) { return v.lang === "en-US" && v.localService; }) ||
      voices.find(function (v) { return v.lang.toLowerCase().indexOf("en") === 0; }) ||
      null;
    return cachedVoice;
  }
  if (window.speechSynthesis) {
    window.speechSynthesis.onvoiceschanged = function () { cachedVoice = undefined; };
  }

  function speakText(text) {
    try {
      if (!text || !window.speechSynthesis) return;
      var u = new SpeechSynthesisUtterance(text);
      u.lang = "en-US";
      u.rate = 0.9;
      u.pitch = 1;
      u.volume = 0.85;
      var voice = pickVoice();
      if (voice) u.voice = voice;
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(u);
    } catch (e) { /* ignore */ }
  }

  var PRAISE_WORDS = ["Awesome!", "Excellent!", "Fantastic!"];

  function unlockAudio() {
    try {
      var ctx = getCtx();
      var buf = ctx.createBuffer(1, 1, 22050);
      var src = ctx.createBufferSource();
      src.buffer = buf;
      src.connect(ctx.destination);
      src.start(0);
      holdPlaybackAudioSession();
      decodeSoundFiles();
    } catch (e) { /* game still playable without sound */ }
  }

  // ── Optional user-supplied sound files ──────────────────────────────────
  // Drop an audio file into public/games/phrase-racer/sounds/ using one of
  // the exact names below to replace that synthesized effect with your own
  // recording. Anything not provided (or that fails to load) silently keeps
  // using the built-in synthesis — nothing to configure in code.
  var SOUND_DIR = "/games/phrase-racer/sounds/";
  var SOUND_FILES = {
    engineLoop: "engine-loop.mp3", // looping ambient sound while flying
    correct: "correct.mp3", // right answer
    wrong: "wrong.mp3", // the instant a wrong answer is submitted
    crash: "crash.mp3", // asteroid impact
    nitro: "nitro.mp3", // NITRO triggers
    extraLife: "extra-life.mp3", // streak of 10
    gameOver: "game-over.mp3", // lives reach 0
  };
  // Fetching (network) has no user-gesture requirement, so it's kicked off
  // as soon as the game mounts. decodeAudioData needs an AudioContext
  // though, and creating that context outside a real user gesture is what
  // silently breaks Web Audio forever on iOS Safari — so decoding itself is
  // deferred to decodeSoundFiles(), called from inside unlockAudio() (the
  // Start-button click handler), never from preloadSoundFiles() below.
  var soundArrayBufferCache = {};
  var soundDecodedCache = {};
  function preloadSoundFiles() {
    Object.keys(SOUND_FILES).forEach(function (key) {
      if (soundArrayBufferCache[key] !== undefined) return;
      soundArrayBufferCache[key] = fetch(SOUND_DIR + SOUND_FILES[key])
        .then(function (res) { if (!res.ok) throw new Error("missing"); return res.arrayBuffer(); })
        .catch(function () { return null; });
    });
  }
  function decodeSoundFiles() {
    var ctx = getCtx();
    Object.keys(SOUND_FILES).forEach(function (key) {
      Promise.resolve(soundArrayBufferCache[key]).then(function (arrBuf) {
        if (!arrBuf) { soundDecodedCache[key] = null; return; }
        ctx.decodeAudioData(arrBuf.slice(0))
          .then(function (decoded) { soundDecodedCache[key] = decoded; })
          .catch(function () { soundDecodedCache[key] = null; });
      });
    });
  }
  function getSoundBuffer(key) {
    var v = soundDecodedCache[key];
    return v && typeof v.duration === "number" ? v : null;
  }
  function playSoundBuffer(buffer, gainVal) {
    try {
      var ctx = getCtx();
      var src = ctx.createBufferSource();
      src.buffer = buffer;
      var g = ctx.createGain();
      g.gain.value = gainVal != null ? gainVal : 0.9;
      src.connect(g); g.connect(ctx.destination);
      src.start(0);
      return src;
    } catch (e) { return null; }
  }

  // ── Race-y sound design: distorted engine growl, tire screech, turbo ────
  var distortionCurve = null;
  function getDistortionCurve(amount) {
    var k = amount || 22;
    if (distortionCurve && distortionCurve.k === k) return distortionCurve.curve;
    var n = 4096;
    var curve = new Float32Array(n);
    var deg = Math.PI / 180;
    for (var i = 0; i < n; i++) {
      var x = (i * 2) / n - 1;
      curve[i] = ((3 + k) * x * 20 * deg) / (Math.PI + k * Math.abs(x));
    }
    distortionCurve = { k: k, curve: curve };
    return curve;
  }

  function tone(freq, startTime, duration, opts) {
    opts = opts || {};
    var type = opts.type || "sine";
    var gainVal = opts.gain != null ? opts.gain : 0.15;
    try {
      var ctx = getCtx();
      var osc = ctx.createOscillator();
      var g = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, startTime);
      if (opts.glideTo != null) osc.frequency.exponentialRampToValueAtTime(opts.glideTo, startTime + duration);
      g.gain.setValueAtTime(0, startTime);
      g.gain.linearRampToValueAtTime(gainVal, startTime + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);
      osc.connect(g); g.connect(ctx.destination);
      osc.start(startTime); osc.stop(startTime + duration + 0.02);
    } catch (e) { /* ignore */ }
  }

  function noiseBurst(startTime, duration, opts) {
    opts = opts || {};
    var gainVal = opts.gain != null ? opts.gain : 0.15;
    var filterType = opts.filterType || "bandpass";
    var freq = opts.freq != null ? opts.freq : 2000;
    var q = opts.q != null ? opts.q : 1;
    try {
      var ctx = getCtx();
      var bufSize = Math.max(1, Math.floor(ctx.sampleRate * duration));
      var buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
      var data = buf.getChannelData(0);
      for (var i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;
      var src = ctx.createBufferSource();
      src.buffer = buf;
      var filter = ctx.createBiquadFilter();
      filter.type = filterType;
      filter.frequency.setValueAtTime(freq, startTime);
      filter.Q.value = q;
      if (opts.freqEnd != null) filter.frequency.exponentialRampToValueAtTime(opts.freqEnd, startTime + duration);
      var g = ctx.createGain();
      var attack = Math.min(0.02, duration / 4);
      g.gain.setValueAtTime(0, startTime);
      g.gain.linearRampToValueAtTime(gainVal, startTime + attack);
      g.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);
      src.connect(filter); filter.connect(g); g.connect(ctx.destination);
      src.start(startTime); src.stop(startTime + duration + 0.02);
    } catch (e) { /* ignore */ }
  }

  // Detuned sawtooth+square pair through distortion+lowpass: a revving V8.
  function sfxEngineRev() {
    var fileBuf = getSoundBuffer("correct");
    if (fileBuf) { playSoundBuffer(fileBuf, 0.9); return; }
    try {
      var ctx = getCtx(); var t = ctx.currentTime;
      var osc1 = ctx.createOscillator();
      var osc2 = ctx.createOscillator();
      osc1.type = "sawtooth"; osc2.type = "square";
      osc1.frequency.setValueAtTime(85, t);
      osc1.frequency.exponentialRampToValueAtTime(240, t + 0.26);
      osc2.frequency.setValueAtTime(85.7, t);
      osc2.frequency.exponentialRampToValueAtTime(241, t + 0.26);
      var shaper = ctx.createWaveShaper();
      shaper.curve = getDistortionCurve(24);
      shaper.oversample = "4x";
      var filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.setValueAtTime(700, t);
      filter.frequency.exponentialRampToValueAtTime(2400, t + 0.26);
      var g = ctx.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.2, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
      osc1.connect(shaper); osc2.connect(shaper);
      shaper.connect(filter); filter.connect(g); g.connect(ctx.destination);
      osc1.start(t); osc2.start(t);
      osc1.stop(t + 0.32); osc2.stop(t + 0.32);
    } catch (e) { /* ignore */ }
  }

  // High-Q bandpass sweep: screeching tires, fired the instant a wrong
  // answer is decided (before the impact boom lands).
  function sfxTireScreech() {
    var fileBuf = getSoundBuffer("wrong");
    if (fileBuf) { playSoundBuffer(fileBuf, 0.9); return; }
    var ctx = getCtx(); var t = ctx.currentTime;
    noiseBurst(t, 0.5, { gain: 0.22, filterType: "bandpass", freq: 2900, freqEnd: 1300, q: 16 });
    noiseBurst(t + 0.03, 0.4, { gain: 0.15, filterType: "bandpass", freq: 3400, freqEnd: 1600, q: 20 });
  }

  // Distorted sub-bass thump + metal-crunch noise: the impact itself.
  function sfxImpactCrash() {
    var fileBuf = getSoundBuffer("crash");
    if (fileBuf) { playSoundBuffer(fileBuf, 0.9); return; }
    try {
      var ctx = getCtx(); var t = ctx.currentTime;
      var osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.setValueAtTime(70, t);
      osc.frequency.exponentialRampToValueAtTime(28, t + 0.35);
      var shaper = ctx.createWaveShaper();
      shaper.curve = getDistortionCurve(32);
      var g = ctx.createGain();
      g.gain.setValueAtTime(0.32, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.4);
      osc.connect(shaper); shaper.connect(g); g.connect(ctx.destination);
      osc.start(t); osc.stop(t + 0.42);
    } catch (e) { /* ignore */ }
    var ctx2 = getCtx(); var t2 = ctx2.currentTime;
    noiseBurst(t2, 0.22, { gain: 0.3, filterType: "highpass", freq: 1600, q: 0.6 });
    noiseBurst(t2, 0.4, { gain: 0.26, filterType: "lowpass", freq: 500, freqEnd: 80, q: 1 });
  }

  // Rising filtered noise + sawtooth glide: turbo spool-up.
  function sfxNitroBoost() {
    var fileBuf = getSoundBuffer("nitro");
    if (fileBuf) { playSoundBuffer(fileBuf, 0.9); return; }
    var ctx = getCtx(); var t = ctx.currentTime;
    noiseBurst(t, 0.5, { gain: 0.18, filterType: "bandpass", freq: 350, freqEnd: 3200, q: 0.8 });
    try {
      var osc = ctx.createOscillator();
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(140, t);
      osc.frequency.exponentialRampToValueAtTime(1300, t + 0.45);
      var g = ctx.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.15, t + 0.05);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
      osc.connect(g); g.connect(ctx.destination);
      osc.start(t); osc.stop(t + 0.52);
    } catch (e) { /* ignore */ }
  }

  function sfxExtraLife() {
    var fileBuf = getSoundBuffer("extraLife");
    if (fileBuf) { playSoundBuffer(fileBuf, 0.9); return; }
    var ctx = getCtx(); var t = ctx.currentTime;
    tone(660, t, 0.12, { type: "square", gain: 0.12 });
    tone(660, t + 0.15, 0.16, { type: "square", gain: 0.12 });
  }

  function sfxGameOver() {
    var fileBuf = getSoundBuffer("gameOver");
    if (fileBuf) { playSoundBuffer(fileBuf, 0.9); return; }
    try {
      var ctx = getCtx(); var t = ctx.currentTime;
      var osc = ctx.createOscillator();
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(170, t);
      osc.frequency.exponentialRampToValueAtTime(38, t + 0.9);
      var shaper = ctx.createWaveShaper();
      shaper.curve = getDistortionCurve(15);
      var g = ctx.createGain();
      g.gain.setValueAtTime(0.2, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.95);
      osc.connect(shaper); shaper.connect(g); g.connect(ctx.destination);
      osc.start(t); osc.stop(t + 1.0);
    } catch (e) { /* ignore */ }
  }

  // Seamless-looping white noise buffer, used as the bed for the
  // continuous road/wind sound under the engine drone.
  function createNoiseLoopBuffer(ctx, seconds) {
    var bufSize = Math.floor(ctx.sampleRate * seconds);
    var buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
    var data = buf.getChannelData(0);
    for (var i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;
    return buf;
  }

  // ── Puzzle data helpers ───────────────────────────────────────────────
  function parseSentence(q) {
    var parts = q.sentence.split(" ");
    var ai = 0;
    var tokens = parts.map(function (p) {
      if (p.charAt(0) === "_") return { type: "blank", answerIndex: ai++, suffix: p.slice(1) };
      return { type: "text", text: p };
    });
    return { tokens: tokens, blankCount: ai };
  }

  function pickDecoy(answer, wordPool) {
    var answerNorm = {};
    answer.forEach(function (w) { answerNorm[normalizeWord(w)] = true; });
    var candidates = wordPool.filter(function (w) { return !answerNorm[normalizeWord(w)]; });
    if (candidates.length === 0) return "quickly";
    return candidates[Math.floor(Math.random() * candidates.length)];
  }

  function buildRun(q, decoyWord) {
    var parsed = parseSentence(q);
    if (parsed.blankCount !== q.answer.length) return null;
    var items = q.answer.map(function (w) { return { word: w, isDecoy: false }; });
    items.push({ word: decoyWord, isDecoy: true });
    var shuffled = shuffle(items);
    var pool = shuffled.map(function (it, i) {
      return { id: i, word: it.word, isDecoy: it.isDecoy, used: false };
    });
    return {
      q: q, tokens: parsed.tokens, blankCount: parsed.blankCount,
      decoyWord: decoyWord, pool: pool, slots: new Array(parsed.blankCount).fill(null),
    };
  }

  // ── mount() ──────────────────────────────────────────────────────────
  function mount(container, opts) {
    opts = opts || {};
    var validQuestions = (opts.questions || []).filter(function (q) {
      var parsed = parseSentence(q);
      return parsed.blankCount === q.answer.length && q.answer.length > 0;
    });
    if (validQuestions.length === 0) {
      container.innerHTML = '<div class="pr-empty">No questions available.</div>';
      return { unmount: function () { container.innerHTML = ""; } };
    }

    var wordPool = (function () {
      var set = {};
      var out = [];
      function add(w) { var n = normalizeWord(w); if (n && !set[n]) { set[n] = true; out.push(w); } }
      validQuestions.forEach(function (q) { q.answer.forEach(add); });
      FALLBACK_WORDS.forEach(add);
      return out;
    })();

    preloadSoundFiles();

    // ── Optional user-supplied images (ship + planets) ───────────────────
    // Drop PNGs into public/games/phrase-racer/images/ to replace the
    // canvas-drawn ship/planets. Nothing found -> keeps drawing them as
    // before. See images/README.md for exact file names.
    var IMAGE_DIR = "/games/phrase-racer/images/";
    var SHIP_TIERS = [
      { file: "ship-1.png", minDistance: 0 },
      { file: "ship-2.png", minDistance: 500 },
      { file: "ship-3.png", minDistance: 2000 },
    ];
    var shipImages = {}; // tier file -> { img, ready }
    function preloadShipImages() {
      SHIP_TIERS.forEach(function (tier) {
        var img = new Image();
        var entry = { img: img, ready: false };
        img.onload = function () { entry.ready = true; };
        img.src = IMAGE_DIR + tier.file;
        shipImages[tier.file] = entry;
      });
    }
    function pickShipTierFile(bestDistanceM) {
      var chosen = SHIP_TIERS[0].file;
      for (var i = 0; i < SHIP_TIERS.length; i++) {
        if (bestDistanceM >= SHIP_TIERS[i].minDistance) chosen = SHIP_TIERS[i].file;
      }
      return chosen;
    }

    var PLANET_IMAGE_CANDIDATE_COUNT = 6;
    var readyPlanetImages = [];
    function preloadPlanetImages(categorySlug) {
      var urls = [];
      if (categorySlug) {
        for (var i = 1; i <= PLANET_IMAGE_CANDIDATE_COUNT; i++) {
          urls.push(IMAGE_DIR + "planets/" + categorySlug + "/planet-" + i + ".png");
        }
      }
      for (var j = 1; j <= PLANET_IMAGE_CANDIDATE_COUNT; j++) {
        urls.push(IMAGE_DIR + "planets/planet-" + j + ".png");
      }
      urls.forEach(function (url) {
        var img = new Image();
        img.onload = function () { readyPlanetImages.push(img); };
        img.src = url;
      });
    }
    preloadShipImages();
    preloadPlanetImages(opts.categorySlug);

    injectStyles();
    container.classList.add("pr-mount");
    container.innerHTML = buildMarkup(opts.categoryName || "");

    var sentenceEl = container.querySelector(".pr-sentence");
    var poolEl = container.querySelector(".pr-pool");
    var canvas = container.querySelector(".pr-canvas");
    var ctx = canvas.getContext("2d");
    var canvasWrap = container.querySelector(".pr-canvas-wrap");
    var hudLives = container.querySelector(".pr-hud-lives");
    var hudSpeed = container.querySelector(".pr-hud-speed");
    var hudDistance = container.querySelector(".pr-hud-distance");
    var nitroBadge = container.querySelector(".pr-nitro-badge");
    var timerBar = container.querySelector(".pr-timer-bar");
    var startScreen = container.querySelector(".pr-start-screen");
    var gameoverScreen = container.querySelector(".pr-gameover-screen");
    var finalDistanceEl = container.querySelector(".pr-final-distance");
    var startBtn = container.querySelector(".pr-start-btn");
    var restartBtn = container.querySelector(".pr-restart-btn");
    var celebrateEl = container.querySelector(".pr-celebrate");
    var continueBtn = container.querySelector(".pr-continue-btn");

    var cssW = 0, cssH = 0;

    // ── Continuous engine drone + road noise (runs the whole PLAYING
    // session, not a one-shot effect like the sfx* functions above) ──────
    var engineLoop = null;
    function startEngineLoop() {
      if (engineLoop) return;
      var fileBuf = getSoundBuffer("engineLoop");
      if (fileBuf) {
        try {
          var actxFile = getCtx();
          var fileSrc = actxFile.createBufferSource();
          fileSrc.buffer = fileBuf;
          fileSrc.loop = true;
          var fileGain = actxFile.createGain();
          fileGain.gain.value = 0;
          fileSrc.connect(fileGain); fileGain.connect(actxFile.destination);
          fileSrc.start();
          engineLoop = { mode: "file", source: fileSrc, gain: fileGain };
          return;
        } catch (e) { /* fall through to synth below */ }
      }
      try {
        var actx = getCtx();
        var osc1 = actx.createOscillator();
        var osc2 = actx.createOscillator();
        osc1.type = "sawtooth";
        osc2.type = "sawtooth";
        osc2.detune.setValueAtTime(13, actx.currentTime);
        var shaper = actx.createWaveShaper();
        shaper.curve = getDistortionCurve(18);
        shaper.oversample = "2x";
        var engineFilter = actx.createBiquadFilter();
        engineFilter.type = "lowpass";
        engineFilter.frequency.value = 500;
        var engineGain = actx.createGain();
        engineGain.gain.value = 0;
        osc1.connect(shaper); osc2.connect(shaper);
        shaper.connect(engineFilter); engineFilter.connect(engineGain); engineGain.connect(actx.destination);
        osc1.start(); osc2.start();

        var noiseSrc = actx.createBufferSource();
        noiseSrc.buffer = createNoiseLoopBuffer(actx, 2);
        noiseSrc.loop = true;
        var roadFilter = actx.createBiquadFilter();
        roadFilter.type = "bandpass";
        roadFilter.frequency.value = 600;
        roadFilter.Q.value = 0.6;
        var roadGain = actx.createGain();
        roadGain.gain.value = 0;
        noiseSrc.connect(roadFilter); roadFilter.connect(roadGain); roadGain.connect(actx.destination);
        noiseSrc.start();

        engineLoop = {
          mode: "synth",
          osc1: osc1, osc2: osc2, filter: engineFilter, gain: engineGain,
          roadFilter: roadFilter, roadGain: roadGain, noiseSrc: noiseSrc,
        };
      } catch (e) { /* game still playable without sound */ }
    }
    function updateEngineLoop(speedKmh, phase) {
      if (!engineLoop) return;
      try {
        var actx = getCtx();
        var now = actx.currentTime;
        var revs = Math.max(0, Math.min(1, speedKmh / 150));
        var playing = phase === "PLAYING";
        if (engineLoop.mode === "file") {
          engineLoop.gain.gain.setTargetAtTime(playing ? 0.5 + revs * 0.4 : 0, now, playing ? 0.2 : 0.08);
          engineLoop.source.playbackRate.setTargetAtTime(0.85 + revs * 0.5, now, 0.15);
          return;
        }
        var baseFreq = 42 + revs * 95;
        engineLoop.osc1.frequency.setTargetAtTime(baseFreq, now, 0.08);
        engineLoop.osc2.frequency.setTargetAtTime(baseFreq * 1.004, now, 0.08);
        engineLoop.filter.frequency.setTargetAtTime(450 + revs * 2000, now, 0.12);
        engineLoop.gain.gain.setTargetAtTime(playing ? 0.07 + revs * 0.08 : 0, now, playing ? 0.2 : 0.08);
        engineLoop.roadFilter.frequency.setTargetAtTime(400 + revs * 900, now, 0.15);
        engineLoop.roadGain.gain.setTargetAtTime(playing ? 0.02 + revs * 0.035 : 0, now, playing ? 0.25 : 0.1);
      } catch (e) { /* ignore */ }
    }
    function stopEngineLoop() {
      if (!engineLoop) return;
      try {
        var actx = getCtx();
        var now = actx.currentTime;
        engineLoop.gain.gain.setTargetAtTime(0, now, 0.05);
        if (engineLoop.mode === "file") {
          engineLoop.source.stop(now + 0.3);
        } else {
          engineLoop.roadGain.gain.setTargetAtTime(0, now, 0.05);
          engineLoop.osc1.stop(now + 0.3);
          engineLoop.osc2.stop(now + 0.3);
          engineLoop.noiseSrc.stop(now + 0.3);
        }
      } catch (e) { /* ignore */ }
      engineLoop = null;
    }

    function buildDeck() { return shuffle(validQuestions); }

    function initialState() {
      return {
        phase: "READY",
        lives: CONFIG.START_LIVES,
        speed: CONFIG.START_SPEED,
        streak: 0,
        distanceM: 0,
        deck: buildDeck(),
        deckIndex: 0,
        questionSerial: 0,
        nitroSerial: 0,
        timeLeftMs: CONFIG.QUESTION_MS,
        crashMs: 0,
        crashImpactPlayed: false,
        crashApproachSpeed: 0,
        crashPhraseText: "",
        crashAsteroidShape: null,
        hopMs: null,
        wheelAngle: 0,
        run: null,
        scroll: { far: 0, near: 0, road: 0 },
        reducedMotion:
          typeof window.matchMedia === "function" &&
          window.matchMedia("(prefers-reduced-motion: reduce)").matches,
      };
    }

    var state = initialState();

    function nitroActive() { return state.questionSerial > 0 && state.nitroSerial >= state.questionSerial; }
    function effectiveSpeed() { return state.speed * (nitroActive() ? CONFIG.NITRO_MULT : 1); }
    function remainingSeconds() { return Math.ceil(state.timeLeftMs / 1000); }
    function isNitroTrigger(streak) { return streak === CONFIG.NITRO_STREAK; }
    function isExtraLifeTrigger(streak) { return streak === CONFIG.EXTRA_LIFE_STREAK; }

    function freshRun(q) { return buildRun(q, pickDecoy(q.answer, wordPool)); }
    function retryRun(run) { return buildRun(run.q, run.decoyWord); }

    function firstEmptySlot() { return state.run.slots.findIndex(function (s) { return s == null; }); }

    function renderPuzzle() {
      var run = state.run;
      sentenceEl.innerHTML = "";
      run.tokens.forEach(function (tok) {
        if (tok.type === "text") {
          var span = document.createElement("span");
          span.className = "pr-word-text";
          span.textContent = tok.text;
          sentenceEl.appendChild(span);
          return;
        }
        var filledId = run.slots[tok.answerIndex];
        var btn = document.createElement("button");
        btn.type = "button";
        btn.className = "pr-slot" + (filledId != null ? " pr-filled" : "");
        btn.dataset.answerIndex = String(tok.answerIndex);
        btn.textContent = filledId != null ? run.pool.filter(function (p) { return p.id === filledId; })[0].word : "";
        sentenceEl.appendChild(btn);
        if (tok.suffix) {
          var suf = document.createElement("span");
          suf.className = "pr-word-text";
          suf.textContent = tok.suffix;
          sentenceEl.appendChild(suf);
        }
      });

      poolEl.innerHTML = "";
      run.pool.forEach(function (item) {
        var btn = document.createElement("button");
        btn.type = "button";
        btn.className = "pr-pool-word" + (item.used ? " pr-used" : "");
        btn.textContent = item.word;
        btn.dataset.id = String(item.id);
        poolEl.appendChild(btn);
      });
    }

    function onPoolClick(id) {
      if (state.phase !== "PLAYING") return;
      var matches = state.run.pool.filter(function (p) { return p.id === id; });
      var item = matches[0];
      if (!item || item.used) return;
      var idx = firstEmptySlot();
      if (idx === -1) return;
      state.run.slots[idx] = id;
      item.used = true;
      renderPuzzle();
      if (state.run.slots.every(function (s) { return s != null; })) validate();
    }

    function onSlotClick(answerIndex) {
      if (state.phase !== "PLAYING") return;
      var id = state.run.slots[answerIndex];
      if (id == null) return;
      var item = state.run.pool.filter(function (p) { return p.id === id; })[0];
      item.used = false;
      state.run.slots[answerIndex] = null;
      renderPuzzle();
    }

    function validate() {
      var guess = state.run.slots.map(function (id) {
        return state.run.pool.filter(function (p) { return p.id === id; })[0].word;
      });
      var answer = state.run.q.answer;
      var correct = guess.length === answer.length && guess.every(function (w, i) { return w === answer[i]; });
      if (correct) resolveCorrect(); else resolveWrong();
    }

    function loadQuestion(retry) {
      state.questionSerial++;
      if (retry) {
        state.run = retryRun(state.run);
      } else {
        if (state.deckIndex >= state.deck.length) {
          state.deck = buildDeck();
          state.deckIndex = 0;
        }
        var q = state.deck[state.deckIndex++];
        state.run = freshRun(q);
      }
      state.timeLeftMs = CONFIG.QUESTION_MS;
      state.phase = "PLAYING";
      renderPuzzle();
    }

    function resolveCorrect() {
      state.streak += 1;
      state.speed += CONFIG.SPEED_UP;
      var scoringSpeed = effectiveSpeed();
      state.distanceM += scoringSpeed * remainingSeconds() * CONFIG.DISTANCE_K;
      state.hopMs = 0;
      sfxEngineRev();
      if (isNitroTrigger(state.streak)) {
        state.nitroSerial = state.questionSerial + 1;
        sfxNitroBoost();
      }
      if (isExtraLifeTrigger(state.streak)) {
        state.lives += 1;
        sfxExtraLife();
      }
      showCelebration(effectiveSpeed());
      speakText(state.run.q.fullSentence);
      loadQuestion(false);
    }

    function resolveWrong() {
      speakText(state.run.q.fullSentence);
      state.streak = 0;
      state.lives = Math.max(0, state.lives - 1);
      state.speed = Math.max(CONFIG.SPEED_MIN, state.speed - CONFIG.SPEED_DOWN);
      state.phase = "CRASHING";
      state.crashMs = 0;
      state.crashImpactPlayed = false;
      state.crashPhraseText = state.run.q.answer.join(" ");
      state.crashApproachSpeed = effectiveSpeed();
      state.crashAsteroidShape = makeAsteroidShape();
      sfxTireScreech();
    }

    // Reached once the crash animation's HOLD window ends — the game
    // freezes here (asteroid + phrase fully visible, no timer) until the
    // player taps Continue, so they can read the phrase at their own pace.
    function enterReview() {
      state.phase = "REVIEW";
    }

    function continueAfterReview() {
      if (state.phase !== "REVIEW") return;
      finishCrash();
    }

    function finishCrash() {
      if (state.lives > 0) loadQuestion(true);
      else gameOver();
    }

    function gameOver() {
      state.phase = "GAMEOVER";
      finalDistanceEl.textContent = String(Math.round(state.distanceM));
      gameoverScreen.classList.remove("pr-hidden");
      sfxGameOver();
      if (typeof opts.onGameOver === "function") opts.onGameOver(state.distanceM);
    }

    function startGame() {
      unlockAudio();
      startEngineLoop();
      startScreen.classList.add("pr-hidden");
      gameoverScreen.classList.add("pr-hidden");
      loadQuestion(false);
      ensureLoopRunning();
    }

    function restart() {
      state = initialState();
      gameoverScreen.classList.add("pr-hidden");
      celebrateEl.classList.add("pr-hidden");
      celebrateEl.classList.remove("pr-show");
      startGame();
    }

    // ── Canvas setup ────────────────────────────────────────────────────
    function resizeCanvas() {
      cssW = canvasWrap.clientWidth;
      cssH = canvasWrap.clientHeight;
      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(cssW * dpr);
      canvas.height = Math.round(cssH * dpr);
      canvas.style.width = cssW + "px";
      canvas.style.height = cssH + "px";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function advanceScroll(speedKmh, dt) {
      var pxPerSec = Math.min(speedKmh * CONFIG.PX_PER_KMH, CONFIG.MAX_SCROLL_PX_S);
      var d = (pxPerSec * dt) / 1000;
      state.scroll.road = (state.scroll.road + d) % ROAD_DASH;
      state.scroll.near = (state.scroll.near + d * 0.6) % TREE_NEAR_SPACING;
      state.scroll.far = (state.scroll.far + d * 0.3) % TREE_FAR_SPACING;
    }

    function shakeOffset(crashMs) {
      var c = CONFIG.CRASH;
      if (crashMs < c.APPROACH) return { x: 0, y: 0 };
      var t = (crashMs - c.APPROACH) / c.SHAKE;
      if (t >= 1) return { x: 0, y: 0 };
      var amp = 8 * (1 - t);
      return { x: (Math.random() * 2 - 1) * amp, y: (Math.random() * 2 - 1) * amp };
    }
    function shipFlashOn(crashMs) {
      var c = CONFIG.CRASH;
      if (crashMs < c.APPROACH || crashMs > c.APPROACH + c.SHAKE) return false;
      var t = crashMs - c.APPROACH;
      return Math.floor(t / 90) % 2 === 0;
    }
    function asteroidAlpha(crashMs) {
      var c = CONFIG.CRASH;
      if (crashMs < c.HOLD) return 1;
      var t = (crashMs - c.HOLD) / c.FADE;
      return Math.max(0, 1 - t);
    }
    function asteroidX(shipX, crashMs) {
      var c = CONFIG.CRASH;
      var startX = shipX + 260;
      var endX = shipX + 90;
      if (crashMs >= c.APPROACH) return endX;
      var t = crashMs / c.APPROACH;
      return startX + (endX - startX) * t;
    }
    // Jagged rock silhouette + crater layout, generated ONCE per crash
    // (in resolveWrong) and stored on state — render() must stay pure, so
    // the random shape can't be regenerated every frame or it would jitter.
    function makeAsteroidShape() {
      var n = 9 + Math.floor(Math.random() * 3);
      var radii = [];
      for (var i = 0; i < n; i++) radii.push(0.72 + Math.random() * 0.38);
      var craters = [];
      var craterCount = 3 + Math.floor(Math.random() * 3);
      for (var j = 0; j < craterCount; j++) {
        craters.push({
          angle: Math.random() * Math.PI * 2,
          dist: 0.15 + Math.random() * 0.5,
          r: 0.08 + Math.random() * 0.1,
        });
      }
      return { radii: radii, craters: craters };
    }

    function update(dt) {
      updateEngineLoop(effectiveSpeed(), state.phase);
      if (state.phase === "PLAYING") {
        state.wheelAngle += effectiveSpeed() * 0.0025 * dt;
        advanceScroll(effectiveSpeed(), dt);
        if (state.hopMs != null) {
          state.hopMs += dt;
          if (state.hopMs > CONFIG.HOP) state.hopMs = null;
        }
        state.timeLeftMs -= dt;
        if (state.timeLeftMs <= 0) {
          state.timeLeftMs = 0;
          resolveWrong();
        }
      } else if (state.phase === "CRASHING") {
        var c = CONFIG.CRASH;
        var prevMs = state.crashMs;
        state.crashMs += dt;
        if (state.crashMs < c.APPROACH) {
          var t = state.crashMs / c.APPROACH;
          advanceScroll(state.crashApproachSpeed * (1 - t), dt);
        }
        if (prevMs < c.APPROACH && state.crashMs >= c.APPROACH && !state.crashImpactPlayed) {
          state.crashImpactPlayed = true;
          sfxImpactCrash();
        }
        if (state.crashMs >= c.HOLD) {
          state.crashMs = c.HOLD;
          enterReview();
        }
      }
    }

    // ── Canvas drawing: deep-space flight ───────────────────────────────
    function roundRect(x, y, w, h, r) {
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.arcTo(x + w, y, x + w, y + h, r);
      ctx.arcTo(x + w, y + h, x, y + h, r);
      ctx.arcTo(x, y + h, x, y, r);
      ctx.arcTo(x, y, x + w, y, r);
      ctx.closePath();
    }

    function drawSpace(w, h) {
      var g = ctx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, COLORS.spaceTop);
      g.addColorStop(1, COLORS.spaceBottom);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    }

    // Soft, sparse, very-slow-moving color washes for depth. Spacing is a
    // clean multiple of TREE_FAR_SPACING so it recycles in step with
    // advanceScroll()'s wrap of scroll.far, with no visible seam.
    function drawNebulae(w, h) {
      for (var x = -state.scroll.far; x < w + NEBULA_SPACING; x += NEBULA_SPACING) {
        var k = Math.round((x + state.scroll.far) / NEBULA_SPACING);
        var color = NEBULA_COLORS[Math.abs(k) % NEBULA_COLORS.length];
        var y = h * (0.1 + pseudoRandom(k * 2.7) * 0.5);
        var r = h * (0.35 + pseudoRandom(k * 8.8) * 0.25);
        var g = ctx.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0, color);
        g.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    function drawOnePlanet(x, y, r, pal, seedK) {
      ctx.save();
      ctx.translate(x, y);

      if (pal.ring) {
        var tilt = -0.5 + pseudoRandom(seedK * 11.3) * 0.4;
        ctx.save();
        ctx.rotate(tilt);
        ctx.strokeStyle = pal.body;
        ctx.globalAlpha = 0.55;
        ctx.lineWidth = Math.max(1.5, r * 0.14);
        ctx.beginPath();
        ctx.ellipse(0, 0, r * 1.85, r * 0.55, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 0.3;
        ctx.lineWidth = Math.max(1, r * 0.06);
        ctx.beginPath();
        ctx.ellipse(0, 0, r * 2.1, r * 0.64, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      ctx.save();
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.clip();
      var g = ctx.createRadialGradient(-r * 0.3, -r * 0.3, r * 0.1, 0, 0, r);
      g.addColorStop(0, pal.body);
      g.addColorStop(1, pal.shade);
      ctx.fillStyle = g;
      ctx.fillRect(-r, -r, r * 2, r * 2);

      if (pal.bands) {
        ctx.globalAlpha = 0.22;
        ctx.fillStyle = pal.shade;
        var bandCount = 3 + Math.floor(pseudoRandom(seedK * 6.6) * 3);
        for (var bi = 0; bi < bandCount; bi++) {
          var by = -r + ((r * 2) / bandCount) * bi + pseudoRandom(seedK * 3.3 + bi) * r * 0.3;
          var bh = r * 0.1 + pseudoRandom(seedK * 2.1 + bi) * r * 0.12;
          ctx.fillRect(-r, by, r * 2, bh);
        }
        ctx.globalAlpha = 1;
      }
      ctx.restore();

      ctx.restore();
    }

    function drawPlanets(w, h) {
      if (readyPlanetImages.length > 0) {
        for (var xi = -state.scroll.far; xi < w + PLANET_SPACING; xi += PLANET_SPACING) {
          var ki = Math.round((xi + state.scroll.far) / PLANET_SPACING);
          var img = readyPlanetImages[Math.floor(pseudoRandom(ki * 17.3) * readyPlanetImages.length)];
          var yi = h * (0.08 + pseudoRandom(ki * 9.1) * 0.62);
          var size = h * (0.09 + pseudoRandom(ki * 4.4) * 0.22);
          ctx.drawImage(img, xi - size / 2, yi - size / 2, size, size);
        }
        return;
      }
      for (var x = -state.scroll.far; x < w + PLANET_SPACING; x += PLANET_SPACING) {
        var k = Math.round((x + state.scroll.far) / PLANET_SPACING);
        var palIdx = Math.floor(pseudoRandom(k * 17.3) * PLANET_PALETTES.length);
        var pal = PLANET_PALETTES[palIdx];
        var y = h * (0.08 + pseudoRandom(k * 9.1) * 0.62);
        var r = h * (0.035 + pseudoRandom(k * 4.4) * 0.095);
        drawOnePlanet(x, y, r, pal, k);
      }
    }

    function drawStars(w, h) {
      ctx.fillStyle = COLORS.starDim;
      for (var x = -state.scroll.far; x < w + STAR_FAR_SPACING; x += STAR_FAR_SPACING) {
        var k = Math.round((x + state.scroll.far) / STAR_FAR_SPACING);
        var y = pseudoRandom(k * 3.1) * h;
        var r = 1 + pseudoRandom(k * 7.7) * 1.1;
        ctx.globalAlpha = 0.3 + pseudoRandom(k * 5.3) * 0.35;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = COLORS.starBright;
      for (var x2 = -state.scroll.near; x2 < w + STAR_NEAR_SPACING; x2 += STAR_NEAR_SPACING) {
        var k2 = Math.round((x2 + state.scroll.near) / STAR_NEAR_SPACING);
        var y2 = pseudoRandom(k2 * 2.3 + 99) * h;
        var r2 = 1.3 + pseudoRandom(k2 * 4.1) * 1.5;
        ctx.globalAlpha = 0.55 + pseudoRandom(k2 * 6.6) * 0.45;
        ctx.beginPath();
        ctx.arc(x2, y2, r2, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    // Fastest, foreground parallax layer — small streaking dust flecks.
    function drawForegroundDust(w, h) {
      ctx.strokeStyle = "rgba(255,255,255,0.4)";
      ctx.lineWidth = 1;
      for (var x = -state.scroll.road; x < w + DUST_SPACING; x += DUST_SPACING) {
        var k = Math.round((x + state.scroll.road) / DUST_SPACING);
        var y = h * (0.08 + pseudoRandom(k * 13.3) * 0.84);
        var len = 4 + pseudoRandom(k * 17.1) * 6;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x - len, y);
        ctx.stroke();
      }
    }

    function shipHeightFor(h) { return h * 0.22; }

    // Bulkier cruiser-style hull (not a thin missile) — nose pointing right
    // (toward oncoming asteroids), twin engine nozzles at the tail (left).
    // Drawn in a local (0..W, 0..H) box then translated into place.
    function drawShipBody(W, H, flashOn) {
      var hullColor = flashOn ? COLORS.destructive : COLORS.hull;
      var hullDark = flashOn ? "#7f1d1d" : COLORS.hullDark;
      var hullDarker = flashOn ? "#4a0d0d" : "#0d3820";
      var cockpitColor = flashOn ? "#4a0f0f" : COLORS.cockpit;

      // main hull — nose is two smooth curves converging to a point, not a
      // hard-angled wedge, for an aerodynamic cone rather than an arrow tip
      ctx.beginPath();
      ctx.moveTo(0, H * 0.34);
      ctx.lineTo(0, H * 0.66);
      ctx.quadraticCurveTo(W * 0.06, H * 0.75, W * 0.20, H * 0.76);
      ctx.quadraticCurveTo(W * 0.42, H * 0.72, W * 0.58, H * 0.62);
      ctx.quadraticCurveTo(W * 0.82, H * 0.545, W * 1.00, H * 0.50);
      ctx.quadraticCurveTo(W * 0.82, H * 0.455, W * 0.58, H * 0.38);
      ctx.quadraticCurveTo(W * 0.42, H * 0.28, W * 0.20, H * 0.24);
      ctx.quadraticCurveTo(W * 0.06, H * 0.25, 0, H * 0.34);
      ctx.closePath();
      var hullGrad = ctx.createLinearGradient(0, H * 0.24, 0, H * 0.76);
      hullGrad.addColorStop(0, flashOn ? "#f87171" : "#4ade80");
      hullGrad.addColorStop(0.55, hullColor);
      hullGrad.addColorStop(1, hullDark);
      ctx.fillStyle = hullGrad;
      ctx.fill();

      // lower-hull shade for a rounded, more three-dimensional feel
      ctx.fillStyle = hullDark;
      ctx.beginPath();
      ctx.moveTo(W * 0.02, H * 0.50);
      ctx.quadraticCurveTo(W * 0.08, H * 0.70, W * 0.22, H * 0.75);
      ctx.quadraticCurveTo(W * 0.42, H * 0.70, W * 0.58, H * 0.60);
      ctx.lineTo(W * 0.58, H * 0.50);
      ctx.quadraticCurveTo(W * 0.40, H * 0.58, W * 0.20, H * 0.60);
      ctx.quadraticCurveTo(W * 0.08, H * 0.58, W * 0.02, H * 0.50);
      ctx.closePath();
      ctx.fill();

      // delta wings — sized to actually read as wings against the now-bulkier hull
      ctx.fillStyle = hullDark;
      ctx.beginPath();
      ctx.moveTo(W * 0.15, H * 0.30);
      ctx.lineTo(W * 0.23, H * 0.08);
      ctx.lineTo(W * 0.40, H * 0.13);
      ctx.lineTo(W * 0.36, H * 0.32);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(W * 0.15, H * 0.70);
      ctx.lineTo(W * 0.23, H * 0.92);
      ctx.lineTo(W * 0.40, H * 0.87);
      ctx.lineTo(W * 0.36, H * 0.68);
      ctx.closePath();
      ctx.fill();

      // panel-line greebles for detail
      ctx.strokeStyle = hullDarker;
      ctx.globalAlpha = 0.6;
      ctx.lineWidth = Math.max(1, H * 0.012);
      ctx.beginPath();
      ctx.moveTo(W * 0.30, H * 0.32); ctx.lineTo(W * 0.56, H * 0.36);
      ctx.moveTo(W * 0.30, H * 0.68); ctx.lineTo(W * 0.56, H * 0.64);
      ctx.moveTo(W * 0.46, H * 0.40); ctx.lineTo(W * 0.46, H * 0.60);
      ctx.stroke();
      ctx.globalAlpha = 1;

      // accent stripe
      ctx.fillStyle = COLORS.chrome;
      ctx.globalAlpha = 0.85;
      ctx.fillRect(W * 0.10, H * 0.475, W * 0.62, H * 0.05);
      ctx.globalAlpha = 1;

      // cockpit canopy — glassy vertical gradient instead of a flat fill
      ctx.beginPath();
      ctx.ellipse(W * 0.63, H * 0.43, W * 0.12, H * 0.13, 0, 0, Math.PI * 2);
      var cockpitGrad = ctx.createLinearGradient(0, H * 0.30, 0, H * 0.56);
      cockpitGrad.addColorStop(0, flashOn ? "#7a2020" : "#1c4a5c");
      cockpitGrad.addColorStop(1, cockpitColor);
      ctx.fillStyle = cockpitGrad;
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.3)";
      ctx.lineWidth = Math.max(1, H * 0.012);
      ctx.stroke();
      ctx.beginPath();
      ctx.ellipse(W * 0.67, H * 0.39, W * 0.035, H * 0.03, -0.4, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(255,255,255,0.65)";
      ctx.fill();

      // nose — a soft highlight streak along the top edge (catches the
      // "light") plus a small beacon at the very tip, instead of a flat
      // triangle stuck onto the point.
      ctx.strokeStyle = "rgba(255,255,255,0.45)";
      ctx.lineWidth = Math.max(1, H * 0.018);
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(W * 0.56, H * 0.41);
      ctx.quadraticCurveTo(W * 0.80, H * 0.465, W * 0.965, H * 0.495);
      ctx.stroke();
      ctx.lineCap = "butt";

      var beaconGlow = ctx.createRadialGradient(W, H * 0.5, 0, W, H * 0.5, W * 0.05);
      beaconGlow.addColorStop(0, flashOn ? "rgba(255,180,180,0.9)" : "rgba(191,255,224,0.9)");
      beaconGlow.addColorStop(1, "rgba(191,255,224,0)");
      ctx.fillStyle = beaconGlow;
      ctx.beginPath();
      ctx.arc(W, H * 0.5, W * 0.05, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(W * 0.995, H * 0.5, Math.max(1.2, H * 0.015), 0, Math.PI * 2);
      ctx.fill();

      // twin engine nozzles at the tail
      ctx.fillStyle = "#111315";
      roundRect(-W * 0.03, H * 0.32, W * 0.08, H * 0.15, 3);
      ctx.fill();
      roundRect(-W * 0.03, H * 0.53, W * 0.08, H * 0.15, 3);
      ctx.fill();
    }

    function drawShip(x, y, h, flashOn) {
      var shipH = shipHeightFor(h);
      var shipW = shipH * 2.0;
      var bob = Math.sin(performance.now() / 500) * shipH * (state.phase === "PLAYING" ? 0.05 : 0.015);
      var hop = state.hopMs != null
        ? -Math.sin(Math.min(1, state.hopMs / CONFIG.HOP) * Math.PI) * shipH * 0.18
        : 0;

      ctx.save();
      ctx.translate(x, y + bob + hop);
      var bestDistanceM = typeof opts.getBestDistanceM === "function" ? opts.getBestDistanceM() : 0;
      var shipImgEntry = shipImages[pickShipTierFile(bestDistanceM)];
      if (shipImgEntry && shipImgEntry.ready && !flashOn) {
        ctx.drawImage(shipImgEntry.img, 0, 0, shipW, shipH);
      } else {
        drawShipBody(shipW, shipH, flashOn);
      }
      ctx.restore();
    }

    function drawOneThruster(x, cy, shipH, intense) {
      var flicker = 0.75 + Math.random() * 0.25;
      var scale = (intense ? 1.9 : 1) * flicker;
      var baseAlpha = intense ? 0.95 : 0.6;

      ctx.save();
      ctx.translate(x, cy);

      var g = ctx.createRadialGradient(0, 0, 0, 0, 0, shipH * 0.34 * scale);
      g.addColorStop(0, "rgba(232,247,255," + baseAlpha + ")");
      g.addColorStop(0.4, "rgba(56,189,248,0.55)");
      g.addColorStop(1, "rgba(56,189,248,0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(0, 0, shipH * 0.34 * scale, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = intense ? "rgba(232,247,255,0.92)" : "rgba(232,247,255,0.7)";
      ctx.beginPath();
      ctx.moveTo(0, -shipH * 0.06 * (intense ? 1.3 : 1));
      ctx.lineTo(-shipH * (intense ? 1.15 : 0.5) * flicker, 0);
      ctx.lineTo(0, shipH * 0.06 * (intense ? 1.3 : 1));
      ctx.closePath();
      ctx.fill();

      ctx.restore();
    }

    // Twin thruster glow at the tail — always on while flying, flared up
    // during NITRO (bigger, brighter).
    function drawEngineGlow(x, y, h, intense) {
      var shipH = shipHeightFor(h);
      var nozzleX = x - shipH * 0.02;
      drawOneThruster(nozzleX, y + shipH * 0.395, shipH, intense);
      drawOneThruster(nozzleX, y + shipH * 0.605, shipH, intense);
    }

    // Warp-speed star streaks during NITRO — the stars "moving faster".
    function drawStarStreaks(w, h) {
      ctx.strokeStyle = "rgba(255,255,255,0.5)";
      ctx.lineWidth = 1.5;
      for (var i = 0; i < 14; i++) {
        var y = Math.random() * h;
        var len = 60 + Math.random() * 100;
        var xEnd = Math.random() * w;
        ctx.beginPath();
        ctx.moveTo(xEnd + len, y);
        ctx.lineTo(xEnd, y);
        ctx.stroke();
      }
    }

    function wrapText(text, cx, cy, maxWidth, lineHeight) {
      var words = text.split(" ");
      var lines = [];
      var line = "";
      for (var i = 0; i < words.length; i++) {
        var test = line ? line + " " + words[i] : words[i];
        if (ctx.measureText(test).width > maxWidth && line) {
          lines.push(line);
          line = words[i];
        } else {
          line = test;
        }
      }
      if (line) lines.push(line);
      var totalH = lines.length * lineHeight;
      var y = cy - totalH / 2 + lineHeight / 2;
      for (var j = 0; j < lines.length; j++) {
        ctx.fillText(lines[j], cx, y);
        y += lineHeight;
      }
    }

    // Tumbling asteroid carrying the correct phrase — spawns ahead of the
    // ship, gets hit, then drifts/falls away as it fades out.
    function drawAsteroid(w, h, shipX, shipCenterY, crashMs) {
      var alpha = asteroidAlpha(crashMs);
      if (alpha <= 0) return;
      var ax = asteroidX(shipX, crashMs);
      var size = Math.min(w * 0.15, h * 0.2);

      var c = CONFIG.CRASH;
      var fallT = crashMs > c.HOLD ? (crashMs - c.HOLD) / (c.TOTAL - c.HOLD) : 0;
      var fallY = fallT * size * 1.6;
      var rot = fallT * 0.7;

      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(ax, shipCenterY + fallY);
      ctx.rotate(rot);

      var shape = state.crashAsteroidShape;
      ctx.beginPath();
      shape.radii.forEach(function (rr, i) {
        var angle = (i / shape.radii.length) * Math.PI * 2;
        var px = Math.cos(angle) * size * rr;
        var py = Math.sin(angle) * size * rr * 0.85;
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      });
      ctx.closePath();
      var g = ctx.createRadialGradient(-size * 0.3, -size * 0.3, size * 0.1, 0, 0, size);
      g.addColorStop(0, COLORS.rockLight);
      g.addColorStop(1, COLORS.rockDark);
      ctx.fillStyle = g;
      ctx.fill();
      ctx.strokeStyle = "rgba(0,0,0,0.5)";
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.fillStyle = "rgba(0,0,0,0.35)";
      shape.craters.forEach(function (cr) {
        var cx = Math.cos(cr.angle) * size * cr.dist;
        var cy = Math.sin(cr.angle) * size * cr.dist * 0.85;
        ctx.beginPath();
        ctx.arc(cx, cy, size * cr.r, 0, Math.PI * 2);
        ctx.fill();
      });

      ctx.fillStyle = "#fff";
      ctx.font = "bold " + Math.max(11, size * 0.16) + "px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.shadowColor = "rgba(0,0,0,0.85)";
      ctx.shadowBlur = 4;
      wrapText(state.crashPhraseText.toUpperCase(), 0, 0, size * 1.5, size * 0.26);
      ctx.shadowBlur = 0;

      ctx.restore();
    }

    function drawRedVignette(w, h) {
      ctx.save();
      ctx.fillStyle = "rgba(239,68,68,0.25)";
      ctx.fillRect(0, 0, w, h);
      ctx.restore();
    }

    function syncHud() {
      var heartCount = Math.min(state.lives, 5);
      var heartsText = "";
      for (var i = 0; i < heartCount; i++) heartsText += "❤️";
      if (state.lives > 5) heartsText += " x" + state.lives;
      hudLives.textContent = heartsText || "—";
      hudSpeed.textContent = Math.round(effectiveSpeed()) + " km/h";
      hudDistance.textContent = Math.round(state.distanceM) + " m";
      nitroBadge.classList.toggle("pr-hidden", !nitroActive());
    }

    function syncTimerBar() {
      var pct = Math.max(0, Math.min(1, state.timeLeftMs / CONFIG.QUESTION_MS));
      timerBar.style.transform = "scaleX(" + pct + ")";
      timerBar.style.background = pct > 0.5 ? "var(--pr-primary)" : pct > 0.2 ? "var(--pr-amber)" : "var(--pr-red)";
    }

    function syncContinueButton() {
      continueBtn.classList.toggle("pr-hidden", state.phase !== "REVIEW");
    }

    var celebrateTimeout = null;
    function showCelebration(speedKmh) {
      var word = PRAISE_WORDS[Math.floor(Math.random() * PRAISE_WORDS.length)];
      celebrateEl.innerHTML =
        '<div class="pr-celebrate-word">' + word + "</div>" +
        '<div class="pr-celebrate-sub">Speed increased to ' + Math.round(speedKmh) + " km/h!</div>";
      celebrateEl.classList.remove("pr-hidden");
      // restart the CSS pop-in animation even if it's already mid-fade
      celebrateEl.classList.remove("pr-show");
      void celebrateEl.offsetWidth;
      celebrateEl.classList.add("pr-show");
      if (celebrateTimeout) clearTimeout(celebrateTimeout);
      celebrateTimeout = setTimeout(function () {
        celebrateEl.classList.remove("pr-show");
      }, 900);
    }

    function render() {
      var w = cssW, h = cssH;
      if (!w || !h) return;
      ctx.clearRect(0, 0, w, h);

      drawSpace(w, h);
      drawNebulae(w, h);
      drawPlanets(w, h);
      drawStars(w, h);
      drawForegroundDust(w, h);

      var shakeX = 0, shakeY = 0, flashOn = false, showVignette = false;
      if (state.phase === "CRASHING") {
        var cm = state.crashMs;
        if (!state.reducedMotion) {
          var s = shakeOffset(cm);
          shakeX = s.x; shakeY = s.y;
        } else {
          var c = CONFIG.CRASH;
          showVignette = cm >= c.APPROACH && cm <= c.APPROACH + c.SHAKE;
        }
        flashOn = shipFlashOn(cm);
      }

      ctx.save();
      ctx.translate(shakeX, shakeY);

      var shipX = w * 0.22;
      var shipY = h * 0.55 - shipHeightFor(h) * 0.5;
      var shipCenterY = shipY + shipHeightFor(h) * 0.5;

      if (state.phase === "PLAYING") drawEngineGlow(shipX, shipY, h, nitroActive());
      drawShip(shipX, shipY, h, flashOn);

      if (state.phase === "PLAYING" && nitroActive()) drawStarStreaks(w, h);

      if (state.phase === "CRASHING" || state.phase === "REVIEW") {
        drawAsteroid(w, h, shipX, shipCenterY, state.crashMs);
      }

      ctx.restore();

      if (showVignette) drawRedVignette(w, h);

      syncHud();
      syncTimerBar();
      syncContinueButton();
    }

    // ── Main loop ───────────────────────────────────────────────────────
    var rafId = null;
    var lastT = null;

    function frame(now) {
      if (lastT == null) lastT = now;
      var dt = now - lastT;
      lastT = now;
      if (dt > CONFIG.MAX_DT_MS) dt = CONFIG.MAX_DT_MS;
      update(dt);
      render();
      rafId = requestAnimationFrame(frame);
    }

    function ensureLoopRunning() {
      if (rafId != null) return;
      lastT = null;
      rafId = requestAnimationFrame(frame);
    }

    // ── Wire up + init ──────────────────────────────────────────────────
    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);
    window.addEventListener("orientationchange", resizeCanvas);
    var ro = null;
    if (window.ResizeObserver) {
      ro = new ResizeObserver(resizeCanvas);
      ro.observe(canvasWrap);
    }

    render();

    startBtn.addEventListener("click", startGame);
    restartBtn.addEventListener("click", restart);
    continueBtn.addEventListener("click", continueAfterReview);
    poolEl.addEventListener("click", function (e) {
      var btn = e.target.closest(".pr-pool-word");
      if (btn) onPoolClick(Number(btn.dataset.id));
    });
    sentenceEl.addEventListener("click", function (e) {
      var btn = e.target.closest(".pr-slot");
      if (btn) onSlotClick(Number(btn.dataset.answerIndex));
    });

    return {
      unmount: function () {
        if (rafId != null) cancelAnimationFrame(rafId);
        rafId = null;
        stopEngineLoop();
        window.removeEventListener("resize", resizeCanvas);
        window.removeEventListener("orientationchange", resizeCanvas);
        if (ro) ro.disconnect();
        container.innerHTML = "";
        container.classList.remove("pr-mount");
      },
    };
  }

  // ── Markup + styles (namespaced under pr-, injected once) ──────────────
  var STYLE_ID = "phrase-racer-engine-styles";
  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    var style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = [
      ".pr-mount{--pr-bg:#0c100e;--pr-card:#171c19;--pr-primary:#22c55e;--pr-primary-fg:#0c100e;--pr-border:#272e29;--pr-muted:#8a8f8c;--pr-fg:#e9ece9;--pr-amber:#f59e0b;--pr-red:#ef4444;height:100%;width:100%;}",
      ".pr-root{display:flex;flex-direction:column;height:100%;width:100%;background:var(--pr-bg);color:var(--pr-fg);font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;}",
      ".pr-canvas-wrap{position:relative;flex:2 1 0;min-height:0;overflow:hidden;background:var(--pr-bg);}",
      ".pr-canvas{position:absolute;inset:0;display:block;}",
      ".pr-hud{position:absolute;inset:0;pointer-events:none;padding:10px 10px 8px;display:flex;flex-direction:column;gap:6px;}",
      ".pr-hud-top{display:flex;align-items:center;justify-content:space-between;gap:8px;}",
      ".pr-hud-chip{background:rgba(12,16,14,0.72);border:1px solid var(--pr-border);border-radius:999px;padding:4px 10px;font-size:13px;font-weight:600;white-space:nowrap;}",
      ".pr-hud-lives{color:var(--pr-red);letter-spacing:1px;}",
      ".pr-hud-distance{color:var(--pr-amber);}",
      ".pr-nitro-badge{align-self:center;background:linear-gradient(90deg,#38bdf8,#22c55e);color:#06170e;font-weight:800;font-size:12px;letter-spacing:1.5px;padding:3px 12px;border-radius:999px;transition:opacity .15s ease;}",
      ".pr-nitro-badge.pr-hidden{opacity:0;}",
      ".pr-timer-bar-wrap{height:6px;border-radius:999px;background:rgba(255,255,255,0.1);overflow:hidden;}",
      ".pr-timer-bar{height:100%;width:100%;background:var(--pr-primary);transform-origin:left center;transform:scaleX(1);}",
      ".pr-overlay{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;text-align:center;padding:24px;background:rgba(12,16,14,0.92);}",
      ".pr-overlay.pr-hidden{display:none;}",
      ".pr-overlay h1{margin:0;font-size:26px;letter-spacing:-0.02em;}",
      ".pr-overlay h1 span{color:var(--pr-primary);}",
      ".pr-overlay p{margin:0;font-size:13px;color:var(--pr-muted);max-width:320px;line-height:1.5;}",
      ".pr-overlay button{margin-top:8px;background:var(--pr-primary);color:var(--pr-primary-fg);border:none;border-radius:999px;padding:12px 28px;font-size:15px;font-weight:700;cursor:pointer;}",
      ".pr-overlay button:active{transform:scale(0.97);}",
      ".pr-final-distance{color:var(--pr-amber);font-weight:800;}",
      ".pr-puzzle-wrap{flex:1 1 0;min-height:0;background:var(--pr-card);border-top:1px solid var(--pr-border);padding:10px 14px 14px;display:flex;flex-direction:column;gap:10px;overflow-y:auto;}",
      ".pr-puzzle-label{font-size:10px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:var(--pr-muted);}",
      ".pr-sentence{display:flex;flex-wrap:wrap;align-items:center;gap:6px 5px;font-size:15px;line-height:1.4;}",
      ".pr-word-text{color:var(--pr-fg);}",
      ".pr-slot{min-width:56px;height:30px;padding:0 8px;border:1.5px dashed rgba(233,236,233,0.45);border-radius:8px;background:rgba(233,236,233,0.04);color:var(--pr-fg);font-size:14px;font-weight:600;font-family:inherit;cursor:pointer;}",
      ".pr-slot.pr-filled{border-style:solid;border-color:var(--pr-primary);background:rgba(34,197,94,0.12);color:var(--pr-primary);}",
      ".pr-pool{display:flex;flex-wrap:wrap;gap:8px;padding-top:2px;}",
      ".pr-pool-word{border:1px solid var(--pr-border);background:#1d2320;color:var(--pr-fg);border-radius:999px;padding:7px 14px;font-size:14px;font-weight:600;font-family:inherit;cursor:pointer;}",
      ".pr-pool-word:active{transform:scale(0.96);}",
      ".pr-pool-word.pr-used{opacity:0.25;pointer-events:none;}",
      ".pr-empty{display:flex;height:100%;align-items:center;justify-content:center;color:#8a8f8c;font-size:14px;}",
      ".pr-celebrate{position:absolute;top:38%;left:50%;transform:translate(-50%,-50%) scale(0.7);text-align:center;pointer-events:none;opacity:0;transition:opacity .25s ease,transform .25s ease;z-index:5;}",
      ".pr-celebrate.pr-hidden{display:none;}",
      ".pr-celebrate.pr-show{opacity:1;transform:translate(-50%,-50%) scale(1);}",
      ".pr-celebrate-word{font-size:26px;font-weight:800;color:var(--pr-primary);text-shadow:0 2px 12px rgba(34,197,94,0.6);}",
      ".pr-celebrate-sub{margin-top:2px;font-size:13px;font-weight:700;color:#fff;text-shadow:0 2px 8px rgba(0,0,0,0.8);}",
      ".pr-continue-btn{position:absolute;left:50%;bottom:14px;transform:translateX(-50%);background:var(--pr-primary);color:var(--pr-primary-fg);border:none;border-radius:999px;padding:10px 24px;font-size:14px;font-weight:700;cursor:pointer;z-index:5;box-shadow:0 4px 16px rgba(0,0,0,0.4);}",
      ".pr-continue-btn.pr-hidden{display:none;}",
      ".pr-continue-btn:active{transform:translateX(-50%) scale(0.96);}",
    ].join("\n");
    document.head.appendChild(style);
  }

  function buildMarkup(categoryName) {
    var subtitle = categoryName
      ? "Racing through: " + categoryName
      : "";
    return (
      '<div class="pr-root">' +
        '<div class="pr-canvas-wrap">' +
          '<canvas class="pr-canvas"></canvas>' +
          '<div class="pr-hud">' +
            '<div class="pr-hud-top">' +
              '<div class="pr-hud-lives pr-hud-chip">❤️❤️❤️</div>' +
              '<div class="pr-hud-distance pr-hud-chip">0 m</div>' +
              '<div class="pr-hud-speed pr-hud-chip">20 km/h</div>' +
            '</div>' +
            '<div class="pr-nitro-badge pr-hidden">⚡ NITRO</div>' +
            '<div class="pr-timer-bar-wrap"><div class="pr-timer-bar"></div></div>' +
          '</div>' +
          '<div class="pr-celebrate pr-hidden"></div>' +
          '<button type="button" class="pr-continue-btn pr-hidden">Continue ▶</button>' +
          '<div class="pr-overlay pr-start-screen">' +
            '<h1>Phrase <span>Racer</span></h1>' +
            (subtitle ? '<p style="color:#22c55e;font-weight:600;">' + escapeHtml(subtitle) + '</p>' : '') +
            '<p>Fill in the missing words before the clock runs out. Get it right to speed up, get it wrong and you crash. 3 in a row triggers NITRO. 10 in a row earns an extra life.</p>' +
            '<button type="button" class="pr-start-btn">Start Race</button>' +
          '</div>' +
          '<div class="pr-overlay pr-gameover-screen pr-hidden">' +
            '<h1>Game <span>Over</span></h1>' +
            '<p>Final distance: <span class="pr-final-distance">0</span> m</p>' +
            '<button type="button" class="pr-restart-btn">Play Again</button>' +
          '</div>' +
        '</div>' +
        '<div class="pr-puzzle-wrap">' +
          '<div class="pr-puzzle-label">Fill in the blanks</div>' +
          '<div class="pr-sentence"></div>' +
          '<div class="pr-puzzle-label">Word bank</div>' +
          '<div class="pr-pool"></div>' +
        '</div>' +
      '</div>'
    );
  }

  function escapeHtml(s) {
    return s.replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  window.PhraseRacer = { mount: mount };
})();
