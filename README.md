# MAN-LYMPICS

A pixel-art arcade game where you compete against six opponents across eight
short events. Every event is a suburban dad chore, treated with the gravity of
an Olympic final.

**Build status: finished.** All eight events, all the modes, and a records
board. The engine, art system, sound, title screen and menus are done, along
with every event: *The Pour*, *Grill Sergeant*, *Splitting Image*, *Cut Above*,
*Death Grip*, *Back It In*, *Choux Business* and *The One-Tripper*. Tournament
mode runs all eight against the six rivals - on your own, or two of you passing
the keyboard - with an announcer before each event, standings between them and
a podium at the end.

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
| Move / aim | Arrow keys | Arrow keys |
| Action | Space | Space |

In the two player tournament the players take turns, so they share one set of
controls rather than splitting the keyboard.

`Enter` confirms on menus. `Escape` pauses. `M` mutes.

Each event opens with a card giving its rules and controls. It **waits for**
**Space** rather than timing out, so there is as long as you like to read it.

No event needs anything beyond the direction keys plus one action button.

---

## What's built

- **Tournament mode, one or two players.** All eight events in order against the
  six rivals. After each one the opponents' scores tick in one at a time, then a
  standings screen shows cumulative medal points (10-8-6-5-4-3-2-1) with your row
  highlighted and the rows sliding to their new places rather than snapping. A
  podium closes it out. The rivals never actually play the minigames - their
  scores are rolled from four stats against per-event weights, in
  `js/opponents.js`.
- **Two player tournament.** Pass and play. Player one plays an event, hands the
  keyboard over, player two plays the same event, and only then do the rivals
  post their scores - so it is an eight way table, which is why the points run
  down to 1 for eighth. **Both players use the same controls**, arrows and space,
  because they never play at once. The two are told apart by colour throughout:
  player one pink, player two orange.
- **Free Play.** Pick any single event and chase a personal best. The result
  screen drops you straight back on the event list, because in Free Play you
  are almost always going again.
- **Records.** A top score for every event, the sum of those eight bests out of
  8000, and the best tournament you have ever finished - points, placing, and
  how many you have won. Records are set from **both** modes, because a good
  score is a good score, and in a two player tournament either player can take
  the machine's record. Hold Backspace on the records screen to wipe it.
- **An announcer** before every event: what it is, a line about it, and where
  you stand in the table before you play it.
- **Scene transitions.** Every screen change retracts a set of horizontal bands
  rather than hard-cutting. It costs the scenes nothing - the engine does it on
  `replace()` and `reset()`.
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
- **Cut Above**, the mowing event: a top-down yard, and a mower with momentum
  and a real turning radius. One tank of petrol instead of a clock, so a wasteful
  route costs you — and space shuts the engine off to bank what is left, making
  "go back for that missed strip or take the petrol" a real decision. Sprinkler
  heads, a solid garden gnome and a wandering dog get in the way, and every
  patch you missed flashes at the end.
- **Death Grip**, the jar event and the shortest in the game: three jars, each
  a sequence of arrow/space prompts to hit in order before his grip gives out.
  A wrong key and it slips - back to the start of that jar with the grip still
  going. The olives hide the prompts you have already pressed. This is the one
  event that kept its timer, because here the timer IS the mechanic; it is just
  dressed as his grip failing rather than a stopwatch.
- **Back It In**, the parallel parking event: a proper bicycle-model car that
  swings about its rear axle, so you have to cut hard, get the back end in and
  straighten up rather than sliding sideways. Clout a parked car and you get a
  horn and a HEY! from off screen. Shunts stand in for the clock - every swap
  between drive and reverse counts, the way an examiner counts them, and the
  ones you did not use are worth points. Two attempts, best one counts.
- **Choux Business**, the cream puff event: pipe twelve puffs, then fill them.
  The target size shows as a ghost outline for two seconds and is then gone -
  but you are judged on whether the twelve MATCH EACH OTHER, not on hitting the
  target. Twelve identical wrong-sized puffs genuinely beat twelve scattered
  ones on target, and the title card says so up front. Then a nozzle sweeps over
  each puff you HOLD SPACE and let go when it is full. There is nothing to aim
  at - what makes it hard is that **how much cream a puff wants is the size you
  piped it at**, so the mark moves from puff to puff and round one decides
  where. A gauge shows the cream going in, with a green band for this puff and
  red where it lets go; the shell swells and shudders before it goes. That is
  the second reason matching pays: one learned hold works twelve times on
  matching puffs and is wrong twelve times on scattered ones.
- **The One-Tripper**, the grocery carry: pick four to twelve bags, then keep him
  upright all the way to the front door. Balance is an inverted pendulum, so the
  further he is already tipped the harder it pulls him over - small early
  corrections work, panicking at the last moment does not. A kerb, a coiled hose
  and a cat that darts out each shove him, and each is drawn on the path ahead
  with an arrow showing which way, so the skill is leaning into it BEFORE you get
  there. Then the screen door costs him a hand for the last few steps. The right
  number of bags genuinely depends on how good you are: steady hands should take
  ten, clumsy ones should take seven, and a tall tower sheds a whole row when it
  goes rather than one bag. Egg bags are worth double and nothing at all if they
  hit the path.
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
| Cut Above | `js/events/mowing.js` | `FUEL_MAX` (bigger = easier), `BURN_DRIVE` (smaller = easier), `CUT_RADIUS` (wider deck = easier), `TURN_RATE`/`TURN_LOW` (how tightly it corners). `FUEL_NEEDS_COVERAGE` stops "mow half, keep the petrol". **Straight lines are not scored** - see below |
| Death Grip | `js/events/jaropening.js` | The `JARS` table is the whole difficulty dial — how many inputs each jar needs and how many seconds of grip you get. Then `READY_TIME` (longer look at the sequence) and `SLIP_STALL` |
| Back It In | `js/events/parking.js` | `BAY_LENGTH` (bigger = easier), `MAX_STEER` (more lock = tighter circle = easier), `WHEELBASE`, `SHUNTS` (allowance per attempt). `BUMP_PENALTY`/`KERB_PENALTY` for what a clout costs |
| Choux Business | `js/events/creampuffs.js` | `SD_ZERO` (bigger = consistency judged more kindly), `PIPE_RATE` (slower = easier to control), `GHOST_TIME`. Filling: `FILL_RATE` (slower = easier to stop well), `FILL_TOLERANCE` (width of the green band), `BURST_MARGIN` (how far you can overfill). The 70/30 split is `CONSISTENCY_WEIGHT`/`ACCURACY_WEIGHT` |
| *the rivals* | `js/opponents.js` | Everything is in the `TUNING` block. `BASE` is the blunt dial for the whole field. `DUKE_MIN`/`DUKE_MAX` are his flat band and **must move with `BASE`**, or he wins by default once the others come down. `WEIGHTS` says which stats each event rewards (each row must total 1.0); quirks are one small function each in `QUIRKS` |
| *records* | `js/records.js` | Which keys are kept and what the overall total is out of |
| *the tournament* | `js/tournament.js` | `MEDAL_POINTS`, `EVENT_ORDER`, the pacing of the reveals (`REVEAL_GAP`, `TICKER_TIME`, `ROW_SLIDE`) and the announcer (`ANNOUNCE_TIME`, and the `SHOUTS` table) |
| The One-Tripper | `js/events/groceries.js` | `DRIFT_EXP` decides whether greed is punished - at 1 the cost of extra bags is a straight line and taking the lot is always correct, above 1 every player has a load they cannot hold. Then `TIP_GAIN` (how eagerly he falls), `CORRECT_FORCE`, `DRIFT_BASE` (the wobble with six or fewer). `MULT_STEP` is deliberately small so extra bags pay by BEING extra bags |

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
  records.js    top scores per event and per tournament, in localStorage
  opponents.js  the six rivals and the maths that rolls their scores
  tournament.js mode flow, announcer, standings, medal points, podium
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

## Notes

**Does Cut Above want straight lines?** No. The score is coverage out of 800
plus banked petrol out of 200, and nothing measures how tidy your route was.
The stripes in the cut grass are decoration. Straight lanes are simply the
cheapest way to cover a rectangle on one tank, so they win on fuel rather than
on neatness - overlap the same strip twice and you pay for it in petrol, not in
style marks.

Note on the brief: it listed *Versus* as a third mode, described as "two humans
on one keyboard, taking turns, with the six AI opponents also competing and
eight-way standings". That is a two player tournament, so rather than build a
separate mode beside Tournament it became a player count on it. Nothing in the
description was dropped.

## How the difficulty was set

Not by feel. Every event has a headless test harness that drives the real scene
with a bot and prints a skill curve - what a careless bot, a mid-table bot and a
good bot actually score on it. Those three profiles were then played through
whole tournaments while the strength of the field was swept:

| | average score | wins | podium |
|---|---|---|---|
| careless | 423 | 0% | 0% |
| **mid-table** | **607** | **~45%** | 100% |
| good | 766 | 100% | 100% |

which is the brief's target of a decent player winning roughly half the time.
The field averages **507** across the eight events at this setting.

Two things came out of doing it this way rather than guessing:

- **Hugo Stiglitz was unbeatable**, and it had nothing to do with the overall
  level of the field - he won four tournaments in five at *any* setting of
  `BASE`. His +200 "precision events" bonus was landing on four of the eight,
  grilling included, and stacking on top of a precision stat that the event
  weights already paid him for. The brief calls grilling divided attention and
  says outright that grilling and mowing are mixed, so it came off the list.
- **Duke Silver's flat 600-780 band** had to come down with the field. His rule
  is "never fails and never dominates"; once everyone else was tuned beatable,
  an untouched Duke simply won by default. The band is now `DUKE_MIN`/
  `DUKE_MAX` in `TUNING`, and it has to move whenever `BASE` does.

Re-run the sweep if you change how an event scores.

Not every event is equally stiff. The rivals are strongest at *The One-Tripper*
and *Splitting Image* (both weight power, which most of the roster has) and
weakest at *Choux Business* and *Back It In* (both weight precision, which most
of them do not). Those two are where a tournament is won.
