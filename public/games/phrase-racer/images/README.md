# Phrase Racer — custom images

By default the ship and planets are drawn with plain Canvas code (shapes,
gradients — no image files at all). Drop PNGs in here to replace them.
Nothing added -> the game keeps drawing them as before. No code changes
needed either way.

## Ship (with score-based upgrades)

| File name     | Used when your best distance in this scope is... |
|----------------|----------------------------------------------------|
| `ship-1.png`   | 0 m or more (the default, starting ship)            |
| `ship-2.png`   | 500 m or more                                        |
| `ship-3.png`   | 2000 m or more                                       |

You only need to add the tiers you want — e.g. add just `ship-2.png` and
`ship-3.png` to keep the drawn ship as the starter look. "Best distance"
is your saved high score for whichever category/Your-Words/all-categories
run you're playing (the same number shown on the Leaderboard's Phrase
Racer tab).

**Orientation matters**: draw the ship facing **right** (nose/front on the
right edge of the image, engine/tail on the left) — that's the direction
it flies relative to the oncoming asteroids. A transparent PNG works best;
the image is stretched to fill the ship's bounding box, so keep it roughly
2:1 (width:height).

Note: the very brief red "hit" flash on crash still uses the drawn ship,
not your image — recoloring an arbitrary PNG on the fly isn't practical,
so that one moment falls back automatically.

## Planets

Put any number of PNGs (transparent background recommended, roughly
square) directly in `planets/`, named `planet-1.png`, `planet-2.png`, etc.
— up to 6 are checked (`planet-1.png` through `planet-6.png`). Whichever
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
