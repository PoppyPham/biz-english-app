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
    skyTop: "#0f1512",
    skyBottom: "#0c100e",
    treeFar: "#1c2420",
    treeNear: "#233028",
    road: "#1b201d",
    roadLine: "#3a4a3f",
    primary: "#22c55e",
    amber: "#f59e0b",
    destructive: "#ef4444",
    chrome: "#c7cdd1",
    glass: "#0a1a22",
    stripe: "#e8e6df",
    tire: "#111315",
    rim: "#8b9096",
    headlight: "#fff4c9",
    taillight: "#e0362e",
  };

  var TREE_FAR_SPACING = 140;
  var TREE_NEAR_SPACING = 90;
  var ROAD_DASH = 40;
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

  function unlockAudio() {
    try {
      var ctx = getCtx();
      var buf = ctx.createBuffer(1, 1, 22050);
      var src = ctx.createBufferSource();
      src.buffer = buf;
      src.connect(ctx.destination);
      src.start(0);
      holdPlaybackAudioSession();
    } catch (e) { /* game still playable without sound */ }
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
    var ctx = getCtx(); var t = ctx.currentTime;
    noiseBurst(t, 0.5, { gain: 0.22, filterType: "bandpass", freq: 2900, freqEnd: 1300, q: 16 });
    noiseBurst(t + 0.03, 0.4, { gain: 0.15, filterType: "bandpass", freq: 3400, freqEnd: 1600, q: 20 });
  }

  // Distorted sub-bass thump + metal-crunch noise: the impact itself.
  function sfxImpactCrash() {
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
    var ctx = getCtx(); var t = ctx.currentTime;
    tone(660, t, 0.12, { type: "square", gain: 0.12 });
    tone(660, t + 0.15, 0.16, { type: "square", gain: 0.12 });
  }

  function sfxGameOver() {
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

    var cssW = 0, cssH = 0;

    // ── Continuous engine drone + road noise (runs the whole PLAYING
    // session, not a one-shot effect like the sfx* functions above) ──────
    var engineLoop = null;
    function startEngineLoop() {
      if (engineLoop) return;
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
        var baseFreq = 42 + revs * 95;
        engineLoop.osc1.frequency.setTargetAtTime(baseFreq, now, 0.08);
        engineLoop.osc2.frequency.setTargetAtTime(baseFreq * 1.004, now, 0.08);
        engineLoop.filter.frequency.setTargetAtTime(450 + revs * 2000, now, 0.12);
        var playing = phase === "PLAYING";
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
        engineLoop.roadGain.gain.setTargetAtTime(0, now, 0.05);
        engineLoop.osc1.stop(now + 0.3);
        engineLoop.osc2.stop(now + 0.3);
        engineLoop.noiseSrc.stop(now + 0.3);
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
      loadQuestion(false);
    }

    function resolveWrong() {
      state.streak = 0;
      state.lives = Math.max(0, state.lives - 1);
      state.speed = Math.max(CONFIG.SPEED_MIN, state.speed - CONFIG.SPEED_DOWN);
      state.phase = "CRASHING";
      state.crashMs = 0;
      state.crashImpactPlayed = false;
      state.crashPhraseText = state.run.q.answer.join(" ");
      state.crashApproachSpeed = effectiveSpeed();
      sfxTireScreech();
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
    function carFlashOn(crashMs) {
      var c = CONFIG.CRASH;
      if (crashMs < c.APPROACH || crashMs > c.APPROACH + c.SHAKE) return false;
      var t = crashMs - c.APPROACH;
      return Math.floor(t / 90) % 2 === 0;
    }
    function barricadeAlpha(crashMs) {
      var c = CONFIG.CRASH;
      if (crashMs < c.HOLD) return 1;
      var t = (crashMs - c.HOLD) / c.FADE;
      return Math.max(0, 1 - t);
    }
    function barricadeX(carX, crashMs) {
      var c = CONFIG.CRASH;
      var startX = carX + 260;
      var endX = carX + 90;
      if (crashMs >= c.APPROACH) return endX;
      var t = crashMs / c.APPROACH;
      return startX + (endX - startX) * t;
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
        if (state.crashMs >= c.TOTAL) finishCrash();
      }
    }

    // ── Canvas drawing: classic muscle-car silhouette ──────────────────
    function roundRect(x, y, w, h, r) {
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.arcTo(x + w, y, x + w, y + h, r);
      ctx.arcTo(x + w, y + h, x, y + h, r);
      ctx.arcTo(x, y + h, x, y, r);
      ctx.arcTo(x, y, x + w, y, r);
      ctx.closePath();
    }

    function drawTreeShape(x, baseY, r, height) {
      ctx.beginPath();
      ctx.moveTo(x, baseY);
      ctx.lineTo(x - r, baseY);
      ctx.lineTo(x, baseY - height);
      ctx.lineTo(x + r, baseY);
      ctx.closePath();
      ctx.fill();
    }

    function drawSky(w, roadTop) {
      var g = ctx.createLinearGradient(0, 0, 0, roadTop);
      g.addColorStop(0, COLORS.skyTop);
      g.addColorStop(1, COLORS.skyBottom);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, roadTop);
    }

    function drawTrees(w, roadTop) {
      ctx.fillStyle = COLORS.treeFar;
      var farY = roadTop - 6;
      for (var x = -state.scroll.far; x < w + TREE_FAR_SPACING; x += TREE_FAR_SPACING) drawTreeShape(x, farY, 24, 42);
      ctx.fillStyle = COLORS.treeNear;
      var nearY = roadTop + 6;
      for (var x2 = -state.scroll.near; x2 < w + TREE_NEAR_SPACING; x2 += TREE_NEAR_SPACING) drawTreeShape(x2, nearY, 17, 32);
    }

    function drawRoad(w, roadTop, roadHeight) {
      ctx.fillStyle = COLORS.road;
      ctx.fillRect(0, roadTop, w, roadHeight);
      ctx.strokeStyle = COLORS.roadLine;
      ctx.lineWidth = 4;
      ctx.setLineDash([ROAD_DASH * 0.5, ROAD_DASH * 0.5]);
      ctx.lineDashOffset = -state.scroll.road;
      var laneY = roadTop + roadHeight * 0.5;
      ctx.beginPath();
      ctx.moveTo(0, laneY);
      ctx.lineTo(w, laneY);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    function carHeightFor(h) { return h * 0.17; }

    function drawWheel(cx, cy, r, angle) {
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fillStyle = COLORS.tire;
      ctx.fill();
      ctx.beginPath();
      ctx.arc(cx, cy, r * 0.55, 0, Math.PI * 2);
      ctx.fillStyle = COLORS.rim;
      ctx.fill();
      ctx.strokeStyle = "#3a3d40";
      ctx.lineWidth = 2;
      for (var s = 0; s < 5; s++) {
        var a = angle + (s * Math.PI * 2) / 5;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + Math.cos(a) * r * 0.5, cy + Math.sin(a) * r * 0.5);
        ctx.stroke();
      }
    }

    // Long-hood fastback muscle-car silhouette, drawn in a local (0..W, 0..H)
    // box then translated into place.
    function drawCarBody(W, H, flashOn) {
      var bodyColor = flashOn ? COLORS.destructive : COLORS.primary;
      var glassColor = flashOn ? "#4a0f0f" : COLORS.glass;

      ctx.beginPath();
      ctx.moveTo(0, H * 0.5);
      ctx.lineTo(0, H * 0.38);
      ctx.quadraticCurveTo(W * 0.02, H * 0.30, W * 0.05, H * 0.30);
      ctx.lineTo(W * 0.16, H * 0.28);
      ctx.lineTo(W * 0.38, H * 0.28);
      ctx.quadraticCurveTo(W * 0.42, H * 0.24, W * 0.45, H * 0.10);
      ctx.lineTo(W * 0.65, H * 0.07);
      ctx.quadraticCurveTo(W * 0.71, H * 0.08, W * 0.73, H * 0.24);
      ctx.lineTo(W * 0.90, H * 0.27);
      ctx.quadraticCurveTo(W * 0.97, H * 0.30, W * 1.00, H * 0.40);
      ctx.lineTo(W * 1.00, H * 0.50);
      ctx.lineTo(W * 1.00, H * 0.58);
      ctx.lineTo(0, H * 0.58);
      ctx.closePath();
      ctx.fillStyle = bodyColor;
      ctx.fill();

      // side accent stripe along hood + roof
      ctx.fillStyle = COLORS.stripe;
      ctx.globalAlpha = 0.85;
      ctx.fillRect(W * 0.14, H * 0.185, W * 0.58, H * 0.045);
      ctx.globalAlpha = 1;

      // cabin glass (windshield + rear window)
      ctx.beginPath();
      ctx.moveTo(W * 0.40, H * 0.27);
      ctx.quadraticCurveTo(W * 0.44, H * 0.14, W * 0.47, H * 0.13);
      ctx.lineTo(W * 0.64, H * 0.10);
      ctx.quadraticCurveTo(W * 0.69, H * 0.11, W * 0.70, H * 0.22);
      ctx.lineTo(W * 0.71, H * 0.26);
      ctx.closePath();
      ctx.fillStyle = glassColor;
      ctx.fill();

      // hood scoop
      ctx.fillStyle = flashOn ? "#7f1d1d" : "#116b34";
      roundRect(W * 0.21, H * 0.22, W * 0.10, H * 0.05, 3);
      ctx.fill();

      // chrome bumpers
      ctx.fillStyle = COLORS.chrome;
      roundRect(0, H * 0.42, W * 0.05, H * 0.08, 3); ctx.fill();
      roundRect(W * 0.95, H * 0.40, W * 0.05, H * 0.08, 3); ctx.fill();

      // headlight + taillight
      ctx.beginPath();
      ctx.arc(W * 0.015, H * 0.40, H * 0.05, 0, Math.PI * 2);
      ctx.fillStyle = COLORS.headlight;
      ctx.fill();
      ctx.fillStyle = COLORS.taillight;
      roundRect(W * 0.965, H * 0.36, W * 0.03, H * 0.08, 2);
      ctx.fill();
    }

    function drawCar(x, y, h, flashOn) {
      var carH = carHeightFor(h);
      var carW = carH * 2.7;
      var wheelR = carH * 0.26;
      var bounce = Math.sin(performance.now() / 120) * carH * (state.phase === "PLAYING" ? 0.025 : 0.008);
      var hop = state.hopMs != null
        ? -Math.sin(Math.min(1, state.hopMs / CONFIG.HOP) * Math.PI) * carH * 0.18
        : 0;

      ctx.save();
      ctx.translate(x, y + bounce + hop);

      var wheelY = carH * 0.80;
      drawWheel(carW * 0.19, wheelY, wheelR, state.wheelAngle);
      drawWheel(carW * 0.83, wheelY, wheelR, state.wheelAngle);
      drawCarBody(carW, carH, flashOn);

      ctx.restore();
    }

    function drawNitroFlame(x, y, h) {
      var carH = carHeightFor(h);
      var flicker = 0.7 + Math.random() * 0.3;
      ctx.save();
      ctx.translate(x - carH * 0.05, y + carH * 0.5);
      ctx.fillStyle = "rgba(56,189,248,0.85)";
      ctx.beginPath();
      ctx.moveTo(0, -carH * 0.12);
      ctx.lineTo(-carH * 0.95 * flicker, 0);
      ctx.lineTo(0, carH * 0.12);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "rgba(191,219,254,0.9)";
      ctx.beginPath();
      ctx.moveTo(0, -carH * 0.06);
      ctx.lineTo(-carH * 0.55 * flicker, 0);
      ctx.lineTo(0, carH * 0.06);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    function drawSpeedLines(w, h) {
      ctx.strokeStyle = "rgba(255,255,255,0.35)";
      ctx.lineWidth = 2;
      for (var i = 0; i < 10; i++) {
        var y = (i / 10) * h * 0.6 + h * 0.08 + Math.sin(performance.now() / 300 + i) * 4;
        var len = 40 + Math.random() * 60;
        var xEnd = w * 0.15 + Math.random() * w * 0.7;
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

    function drawBarricade(w, h, carX, roadTop, crashMs) {
      var alpha = barricadeAlpha(crashMs);
      if (alpha <= 0) return;
      var bx = barricadeX(carX, crashMs);
      var bw = Math.min(w * 0.42, 220);
      var bh = h * 0.24;
      var by = roadTop - bh - 4;

      ctx.save();
      ctx.globalAlpha = alpha;

      ctx.save();
      roundRect(bx, by, bw, bh, 6);
      ctx.clip();
      ctx.fillStyle = "#111";
      ctx.fillRect(bx, by, bw, bh);
      ctx.fillStyle = COLORS.amber;
      var stripeW = 18;
      for (var sx = -bh; sx < bw + bh; sx += stripeW * 2) {
        ctx.beginPath();
        ctx.moveTo(bx + sx, by + bh);
        ctx.lineTo(bx + sx + stripeW, by + bh);
        ctx.lineTo(bx + sx + stripeW + bh, by);
        ctx.lineTo(bx + sx + bh, by);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();

      ctx.strokeStyle = "#000";
      ctx.lineWidth = 3;
      roundRect(bx, by, bw, bh, 6);
      ctx.stroke();

      ctx.fillStyle = "#fff";
      ctx.font = "bold " + Math.max(12, bh * 0.17) + "px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      wrapText(state.crashPhraseText.toUpperCase(), bx + bw / 2, by + bh / 2, bw - 16, bh * 0.24);

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

    function render() {
      var w = cssW, h = cssH;
      if (!w || !h) return;
      ctx.clearRect(0, 0, w, h);

      var roadTop = h * 0.68;
      var roadHeight = h - roadTop;

      drawSky(w, roadTop);
      drawTrees(w, roadTop);
      drawRoad(w, roadTop, roadHeight);

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
        flashOn = carFlashOn(cm);
      }

      ctx.save();
      ctx.translate(shakeX, shakeY);

      var carX = w * 0.22;
      var carY = roadTop - carHeightFor(h);
      drawCar(carX, carY, h, flashOn);

      if (nitroActive() && state.phase === "PLAYING") {
        drawNitroFlame(carX, carY, h);
        drawSpeedLines(w, h);
      }

      if (state.phase === "CRASHING") drawBarricade(w, h, carX, roadTop, state.crashMs);

      ctx.restore();

      if (showVignette) drawRedVignette(w, h);

      syncHud();
      syncTimerBar();
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
      ".pr-slot{min-width:56px;height:30px;padding:0 8px;border:1.5px dashed var(--pr-border);border-radius:8px;background:transparent;color:var(--pr-fg);font-size:14px;font-weight:600;font-family:inherit;cursor:pointer;}",
      ".pr-slot.pr-filled{border-style:solid;border-color:var(--pr-primary);background:rgba(34,197,94,0.12);color:var(--pr-primary);}",
      ".pr-pool{display:flex;flex-wrap:wrap;gap:8px;padding-top:2px;}",
      ".pr-pool-word{border:1px solid var(--pr-border);background:#1d2320;color:var(--pr-fg);border-radius:999px;padding:7px 14px;font-size:14px;font-weight:600;font-family:inherit;cursor:pointer;}",
      ".pr-pool-word:active{transform:scale(0.96);}",
      ".pr-pool-word.pr-used{opacity:0.25;pointer-events:none;}",
      ".pr-empty{display:flex;height:100%;align-items:center;justify-content:center;color:#8a8f8c;font-size:14px;}",
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
