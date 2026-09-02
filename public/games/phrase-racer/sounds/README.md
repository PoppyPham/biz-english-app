# Phrase Racer — custom sound files

By default every sound in Phrase Racer (engine, impacts, nitro, etc.) is
**synthesized in JavaScript** — there are no audio files at all, it's all
oscillators and filtered noise built at runtime in
`public/games/phrase-racer/engine.js`.

To replace any of them with your own recording, just drop an audio file
**in this folder** using one of the exact names below. No code changes
needed — the game checks for these files every time it loads and uses
whichever ones it finds; anything missing keeps using the built-in
synthesized sound automatically.

| File name           | When it plays                                   |
|----------------------|--------------------------------------------------|
| `engine-loop.mp3`    | Looping ambient sound the whole time you're flying (volume + pitch rise with speed) |
| `correct.mp3`        | You answer correctly                              |
| `wrong.mp3`           | The instant a wrong answer is submitted (before impact) |
| `crash.mp3`           | The asteroid impact itself                        |
| `nitro.mp3`            | NITRO triggers (3-answer streak)                  |
| `extra-life.mp3`       | Extra life earned (10-answer streak)              |
| `game-over.mp3`         | Lives reach 0                                      |

## Format

- **MP3** is recommended (plays everywhere, including iPhone Safari).
- One-shot sounds (everything except `engine-loop.mp3`): keep them short
  and punchy — under ~1 second feels best against the game's pace.
- `engine-loop.mp3`: needs to loop cleanly (no click/gap when it repeats).
  A few seconds long is plenty since it plays on a loop.
- Keep files reasonably small (a few hundred KB) — they're fetched fresh
  on every page load.

## How to add one

1. Find or record the sound you want.
2. Save/export it as an MP3.
3. Name it **exactly** as in the table above (case-sensitive).
4. Put it directly in this folder: `public/games/phrase-racer/sounds/`.
5. Reload the Phrase Racer page — that's it, no build step, no code edit.

You don't need to provide all seven — add just the ones you want to
change and leave the rest as-is.

## About the sample files currently in this folder

`wrong.mp3`, `nitro.mp3`, and `crash.mp3` are sound effects from Kenney's
"Space Shooter Redux" pack (CC0 / public domain, no attribution required
— https://kenney.nl/assets/space-shooter-extension). `correct.mp3` is a
4-note ascending percussion phrase from Kenney's "Music Jingles" pack
(also CC0 — https://kenney.nl/assets/music-jingles). All were converted
from the packs' `.ogg` format to WAV so Safari/iOS can decode them too
(they keep the `.mp3` extension for consistency with the naming above,
but the browser decodes by content, not extension, so this works fine —
export your own replacements as real MP3s as usual). Swap them for your
own recordings whenever you like — they're a working starting point, not
final audio. `engine-loop.mp3`, `extra-life.mp3`, and `game-over.mp3`
aren't provided, so those three still use the built-in synthesis.
