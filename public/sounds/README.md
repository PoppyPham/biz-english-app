# Custom sound files — Quiz, Flashcard, Progress

By default every sound effect in the app (correct-answer chimes, streaks,
celebrations, etc.) is **synthesized in JavaScript** — no audio files at
all, built at runtime in `lib/sounds.ts`. To replace any of them with
your own recording, drop an audio file **in this folder** using one of
the exact names below. No code changes needed — the app checks for these
files on load and uses whichever it finds; anything missing keeps using
the built-in synthesized sound automatically.

(Phrase Racer's sounds are separate and customized the same way, in
`public/games/phrase-racer/sounds/` — see the README there.)

| File name          | Used for                                              |
|----------------------|--------------------------------------------------------|
| `neutral.mp3`        | Flashcard "still learning" self-assessment              |
| `flip.mp3`             | Card flip / navigation click                            |
| `complete.mp3`          | Finishing a Flashcard session                           |
| `streak.mp3`             | Quiz correct answer (same file plays at every streak level — a static file can't scale pitch with streak the way the built-in synthesis does) |
| `life-lost.mp3`           | Quiz wrong answer                                     |
| `extra-life.mp3`            | Quiz bonus life earned                              |
| `game-over.mp3`               | Quiz lives run out                                |
| `celebrate.mp3`                  | Flashcard "memorized" reward                   |
| `high-score.mp3`                   | Beating a saved high score                   |

## Format

- **MP3** recommended (plays everywhere, including iPhone Safari).
- Keep clips short and punchy — under ~1 second feels best against the
  app's pace.
- Keep files small (a few hundred KB) — fetched fresh on every page load.

## How to add one

1. Save/export your sound as an MP3.
2. Name it **exactly** as in the table above (case-sensitive).
3. Put it directly in this folder: `public/sounds/`.
4. Reload the page — no build step, no code edit.

You don't need to provide all of them — add just the ones you want to
change and leave the rest as the built-in sound.

## About the sample files currently in this folder

`streak.mp3` is a 4-note ascending percussion phrase from Kenney's "Music
Jingles" pack (CC0 / public domain — https://kenney.nl/assets/music-jingles).
`celebrate.mp3` and `high-score.mp3` layer one of those jingle phrases
(saxophone for celebrate, percussion for high-score) with a short real
crowd-applause clip (CC0, recorded by Joseph SARDIN —
https://bigsoundbank.com/applause-1-s1765.html) for a bigger reward
moment. Swap any of these for your own audio whenever you like — they're
a working starting point, not final sound design.
