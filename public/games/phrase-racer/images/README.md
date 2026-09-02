# Phrase Racer — custom images

By default the ship and planets are drawn with plain Canvas code (shapes,
gradients — no image files at all). Drop PNGs in here to replace them.
Nothing added -> the game keeps drawing them as before. No code changes
needed either way.

## Ship (with score-based upgrades)

| File name     | Used when your best distance in this scope is... |
|----------------|----------------------------------------------------|
| `ship-1.png`   | 0 m or more (the default, starting ship)            |
| `ship-2.png`   | 2000 m or more                                       |
| `ship-3.png`   | 5000 m or more                                       |

You only need to add the tiers you want — e.g. add just `ship-2.png` and
`ship-3.png` to keep the drawn ship as the starter look. "Best distance"
is whichever is further: your saved high score for this category/
Your-Words/all-categories scope (the same number shown on the
Leaderboard's Phrase Racer tab), or how far you've already flown in the
*current* run — so crossing a tier's threshold upgrades the ship
immediately, mid-run, not just retroactively in a future run once that
run's score gets saved as a new best.

**Orientation matters**: draw the ship facing **right** (nose/front on the
right edge of the image, engine/tail on the left) — that's the direction
it flies relative to the oncoming asteroids. A transparent PNG works best.
The image is scaled to *fit* the ship's bounding box (never stretched/
distorted, any aspect ratio works) and is anchored to the **left edge**
(the tail) so the engine glow — drawn separately, always at the box's
left edge — lines up with your art regardless of its exact proportions.
**Reference size: 200×100px (a 2:1 width:height box)** — matching that
ratio uses the full box with no empty margin; anything narrower just
leaves empty space on the right (toward the nose), which is harmless.

Note: the very brief red "hit" flash on crash still uses the drawn ship,
not your image — recoloring an arbitrary PNG on the fly isn't practical,
so that one moment falls back automatically.

## Planets

Put any number of PNGs (transparent background recommended, roughly
square) directly in `planets/`, named `planet-1.png`, `planet-2.png`, etc.
— up to 9 are checked (`planet-1.png` through `planet-9.png`). Whichever
of those exist get used, picked at random as you fly past.

### Per-category theming

To use a *different* set of planets for one specific category (e.g. space
imagery for a "Sci-Fi Vocabulary" category vs. something else for another),
put them in a subfolder named after that category's URL slug (the same
slug you see in `/games/phrase-racer?category=<slug>`):

```
planets/
  daily-communication/
    planet-1.png
    planet-2.png
  planet-1.png   <- shared fallback used by every other category
  planet-2.png
```

A category with its own subfolder uses only those images; every other
category (and "all categories" / "Your Words") uses the shared ones
directly in `planets/`. If neither exists, planets fall back to the
built-in drawn variety (colors, rings, bands).

## About the sample files currently in this folder

`ship-1/2/3.png` are Kenney's "Space Shooter Redux" pack
(CC0 / public domain, no attribution required — https://kenney.nl/assets/space-shooter-extension),
rotated 90° to face right.

`planets/planet-1.png` through `planet-9.png` are all real NASA
photographs, public domain via Wikimedia Commons — the full classic
nine-planet set:

1. [Jupiter (transparent)](https://commons.wikimedia.org/wiki/File:Jupiter_(transparent).png)
2. [Mars transparent background](https://commons.wikimedia.org/wiki/File:Mars_transparent_background.png)
3. [Planet Mercury (GPN-2000-000465, transparent)](https://commons.wikimedia.org/wiki/File:Planet_Mercury_-_GPN-2000-000465_-_transparent.png)
4. [Venus globe (transparent background)](https://commons.wikimedia.org/wiki/File:Venus_globe_-_transparent_background.png)
5. [Earth Western Hemisphere (transparent background)](https://commons.wikimedia.org/wiki/File:Earth_Western_Hemisphere_transparent_background.png)
6. [Saturnx (Voyager 2, transparent)](https://commons.wikimedia.org/wiki/File:Saturnx.png)
7. [Uranus2 (Voyager 2, transparent)](https://commons.wikimedia.org/wiki/File:Uranus2-transparent.png)
8. [Neptune with rings (transparent background)](https://commons.wikimedia.org/wiki/File:Neptune_with_rings_(transparent_background).png)
9. [Pluto — New Horizons flyby (transparent)](https://commons.wikimedia.org/wiki/File:PIA19873-Pluto-NewHorizons-FlyingPastImage-20150714-transparent.png)

Swap any of these for your own art whenever you like — they're a working
starting point, not final assets.
