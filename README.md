# MAN-LYMPICS

A pixel-art arcade game where you compete against six opponents across eight
short events. Every event is a suburban dad chore, treated with the gravity of
an Olympic final.

**Build status: foundation plus three events.** The engine, art system, sound,
title screen and menus are done, along with *The Pour*, *Grill Sergeant* and
*Splitting Image*. The tournament frame, the six opponents and the remaining
five events are still to come.

---

## How to run it

**The easy way:** double-click `index.html`. That's it. No install, no build
step, no server, no internet connection.

**If you'd rather use a local server** (not required, but some browsers are
fussier about `localStorage` on `file://`) — any static server will do:

```bash
npx serve .
```

Then open the address it prints.

## Controls

| | Player 1 | Player 2 |
|---|---|---|
| Move / aim | Arrow keys | W A S D |
| Action | Space | Left Shift |

`Enter` confirms on menus. `Escape` pauses. `M` mutes.

No event needs anything beyond the direction keys plus one action button.

---

## What's built

- **Title screen → mode select → event select → event → result screen.**
  Tournament and Versus are visible but locked; Free Play works and saves a
  personal best per event to `localStorage`.
- **The Pour**, the beer event: three beers, each poured then chugged. Hold
  space to pour and tilt the glass with the arrows — the right angle slides
  towards vertical as the glass fills, and beer that froths up is beer you do
  not get. Then alternate left and right to drink it, cleanly: same key twice
  or hammering too fast and it goes down your chin. He gets drunker every beer
  — the room sways, the glass answers late, then drifts on its own.
- **Splitting Image**, the wood-chopping event: ten swings, no clock. Four
  different swing outcomes, combo escalation, and fatigue — his arms give out so
  the power bar stops reaching the top, and his hands start to shake, both shown
  on screen rather than hidden. Wood chips, screen shake and freeze frames.
- **Grill Sergeant**, the grilling event: six patties, flip each one twice,
  **no meters of any kind**. You judge doneness from four layered visual and
  audio tells — the colour of the patty, juices welling up right as it comes
  due, smoke once it has gone too far, and a sizzle that rises in pitch. The
  patties go on staggered so they queue up rather than all coming due at once.
- The engine underneath: 320×180 at a whole-number scale, fixed 60 FPS, scene
  stack, particle pool, screen shake, hit-stop.
- Every sprite, letter and sound generated in code. There is not a single image
  or audio file in this project.

## Where to change each event's difficulty

Every event file starts with a plain-English comment explaining the mechanic,
followed by a `CONFIG` block holding every timer, speed, threshold and score
weight it uses. There are no tuning numbers buried anywhere else.

| Event | File | Biggest knobs |
|---|---|---|
| Splitting Image (chopping) | `js/events/chopping.js` | `TOTAL_SWINGS` (how long the event is). **Too hard to aim?** `SWEET_HALF` (bigger = easier), `STRIKE_SPEED` (smaller = easier). **Aim not mattering enough?** `QUALITY_CROOKED` (smaller = harsher), `COMBO_BONUS`. **Fatigue too punishing?** `FATIGUE_POWER_FLOOR` towards `1`, `FATIGUE_WOBBLE` towards `0` — either switches off on its own |
| The Pour | `js/events/pouring.js` | `TILT_TOLERANCE` (bigger = easier), `FOAM_SPLIT` (smaller = easier), `POUR_ALLOWANCE` (more beer in the tap = easier). Chug: `CHUG_DRAIN`, `CHUG_PAR`. The whole drunkenness ramp is the `DRUNK` table, one row per beer |
| Grill Sergeant | `js/events/grilling.js` | `COOK_RATE` (lower = easier), `PERFECT_BAND` (bigger = easier), `START_STAGGER` (bigger = less overlap = easier). Make the tells more obvious with `BUBBLE_AT`/`BUBBLE_END` and `SMOKE_RATE` |
| Cut Above | `js/events/mowing.js` | *not built yet (Phase 3)* |
| Death Grip | `js/events/jaropening.js` | *not built yet (Phase 3)* |
| Back It In | `js/events/parking.js` | *not built yet (Phase 4)* |
| Choux Business | `js/events/creampuffs.js` | *not built yet (Phase 4)* |
| The One-Tripper | `js/events/groceries.js` | *not built yet (Phase 4)* |

Changing one event never requires touching another one. Each event file is
self-contained and registers itself on `ML.events`.

### Other things you might want to change

| What | Where |
|---|---|
| The 16 colours of the whole game | `js/palette.js` |
| Overall sound volume | `MASTER_VOLUME` at the top of `js/audio.js` |
| How a sound is made | the `SOUNDS` table in `js/audio.js` |
| The look of the player and opponents | `PLAYER_LOOK` and `figure()` in `js/sprites.js` |
| Menu wording, title cards, result cards | `js/ui.js` |

---

## How the code is arranged

Everything hangs off one global object, `ML`, so nothing collides. Script order
in `index.html` matters — dependencies first, `main.js` last.

```
index.html
style.css
js/
  palette.js    the 16 colours, referenced by index everywhere
  font.js       5x7 bitmap font + drawText / drawTextCentered / drawTextWavy
  sprites.js    every sprite, as text; baked to canvases once at startup
  audio.js      WebAudio sound effects, all synthesized
  engine.js     game loop, scene stack, input, particles, shake, hit-stop
  ui.js         title screen, menus, title/result cards, pause overlay
  events/
    chopping.js one file per event
  main.js       boots everything
```

### Sprites are text

A sprite is an array of equal-length strings. Each character is a palette index
(`0`–`9`, `a`–`f`) and a space is transparent:

```js
ML.sprites.def.axe_hit = [
  '    aa    ',
  '    aa    ',
  '  333333  ',
  ' 33333333 ',
  '   3333   '
];
```

The larger sprites — the 24×32 characters, the logs, the chopping block — are
assembled by small helper functions (`figure()`, `makeLog()`, `makeBlock()`)
that draw rectangles and circles into a grid of those same characters. Same
format, far fewer typos. All of them are baked into offscreen canvases at
startup and drawn from that cache; nothing is drawn pixel-by-pixel while the
game is running.

---

## Deploying

The game is a static site with no build step, so both of these are zero-config.

### GitHub Pages

Already done for this repository — it is live at
<https://ssmoke21.github.io/manlympics/> and every push to `main` redeploys it.

To set it up again from scratch, or on a fork:

1. Push the repository to GitHub with `index.html` at the root.
2. Repository → **Settings** → **Pages**.
3. Under *Build and deployment*, set **Source** to `Deploy from a branch`,
   pick your branch (`main`) and folder `/ (root)`, then **Save**.
4. Wait a minute. The game is at
   `https://<your-username>.github.io/<repo-name>/`.

### Vercel

1. Go to <https://vercel.com/new> and import the repository.
2. Framework preset: **Other**. Leave the build command empty and set the output
   directory to the folder containing `index.html`.
3. **Deploy.**

No configuration file is needed for either. There is nothing to install and
nothing to compile.

---

## Notes for the next phase

Phase 2 adds `js/opponents.js` and `js/tournament.js`: the six AI competitors
(whose scores are generated statistically rather than by actually playing),
medal points, the standings screen and the podium ceremony. Remember to add the
new `<script>` tags to `index.html` in dependency order.
