/*
  ==========================================================================
  EVENT 8 - THE ONE-TRIPPER (grocery carry)
  ==========================================================================

  Greed, then balance. Two phases.

  LOADING
    LEFT and RIGHT pick how many bags to carry, four to twelve. SPACE loads up.

    Every bag is worth points AND raises the multiplier on the whole trip, so
    more is better - but every bag past six makes him wobble harder and walk
    slower, and slower means more seconds of wobbling before he reaches the
    door. Bags with a white egg on them are worth DOUBLE if they arrive and
    NOTHING if they hit the ground.

    The tower is built bottom up and it always sheds from the TOP, so where the
    egg bags are sitting in the stack tells you exactly how much slack you have.
    That is on purpose: the gamble should be readable before you take it.

  THE WALK
    He walks to the front door on his own. LEFT and RIGHT are not steering -
    they are the only thing keeping him upright.

    Balance is an inverted pendulum, not a tug of war: the further he is already
    tipped, the harder it pulls him further over. Small early corrections work.
    Waiting until he is nearly gone does not.

    Tip all the way and bags come off the top. A sensible load sheds one. A
    tower sheds the whole unsupported row on top of it, so the bigger the
    stack, the more one stumble costs - which is what makes the choice back at
    the car a real gamble rather than a free upgrade.

  WHAT IS IN THE WAY
    A kerb, a coiled hose and a cat that darts out. Each one shoves him, and
    each one is drawn on the path ahead with an arrow over it showing WHICH WAY
    it is going to shove him - so the skill is leaning into it before you get
    there, not reacting after.

    Then the screen door. Opening it costs him a hand: for the last few steps
    the drift doubles and his corrections are much weaker.

  NO CLOCK. The distance to the door is the whole budget, and being slow is
  already punished by spending longer under the drift.

  WHERE THE DIFFICULTY KNOBS ARE
    TIP_GAIN ........... how eagerly he falls once he is leaning. The big one.
    CORRECT_FORCE ...... how hard LEFT/RIGHT push back.
    DRIFT_BASE ......... the wobble with six bags or fewer. Keep it gentle.
    DRIFT_PER_BAG ...... what each bag past six adds to that.
    DRIFT_EXP .......... how those extra bags compound. This is the one that
                         decides whether greed is punished: at 1 the cost is a
                         straight line and taking the lot is always correct,
                         above 1 every player has a load they cannot hold.
    SLOW_PER_BAG ....... how much each bag past six slows him down.
    SHOVE .............. what a kerb, a hose or a cat costs you.
    DROP_RECOVER / DROP_KICK ... how much of a reprieve a dropped bag buys
                         him. Generous values here let a man who never touches
                         the keys still arrive with half the shopping.
    DOOR_DRIFT_MUL / DOOR_HAND ... the one-handed penalty at the end.
    MULT_STEP .......... how much ambition pays. Raise it and twelve bags
                         always wins; lower it and nobody bothers over six.
    SCORE_PER_BAG ...... the points a delivered bag is worth.

  Note that the drift and the walking speed are set by the number he PICKED,
  not by what is left in his arms. Dropping a bag does not make him steady
  again - if it did, overloading would cost nothing, because he would simply
  shed down to whatever he can hold and still bank the bigger multiplier.

  If it feels too hard, lower TIP_GAIN and DRIFT_BASE first - in that order.
*/
window.ML = window.ML || {};
ML.events = ML.events || {};

ML.events.groceries = (function () {
  var P = ML.palette;

  var CONFIG = {
    // ---- pacing
    TITLE_TIME: 3,
    RESULT_TIME: 3,
    LOAD_IDLE: 25,           // safety only: loads up on its own if nobody picks
    DOOR_IDLE: 9,            // safety only: the door opens on its own

    // ---- the load
    MIN_BAGS: 4,
    MAX_BAGS: 12,
    START_BAGS: 8,
    FREE_BAGS: 6,            // the brief's line in the sand
    EGG_CHANCE: 0.18,        // per bag, rolled once at the start of the scene
    BAGS_PER_ROW: 3,
    SHED_PER_ROW: 3,         // bags of tower per EXTRA bag shed in one stumble

    // ---- the walk
    START_X: 40,
    DOOR_X: 470,
    END_X: 524,
    WORLD_W: 560,
    DAD_SCREEN_X: 100,
    GROUND_Y: 140,
    BASE_SPEED: 46,          // pixels a second with a sensible load
    SLOW_PER_BAG: 0.045,     // each bag past six, as a fraction of BASE_SPEED

    // ---- balance
    TIP_GAIN: 1.15,          // the inverted pendulum: lean feeds on itself
    CORRECT_FORCE: 3.8,     // what LEFT/RIGHT are worth
    DAMPING: 1.6,
    DRIFT_BASE: 0.45,        // the wobble with a sensible load: gentle
    DRIFT_PER_BAG: 0.18,     // and what EACH bag past six adds to it. Steep.
    DRIFT_EXP: 1.9,         // and the curve those extra bags follow. Above 1
                             // it accelerates, which is what gives every player
                             // their own ceiling instead of one shared cliff.
    DRIFT_SPEED_A: 1.70,
    DRIFT_SPEED_B: 3.90,
    DRIFT_RANDOM: 2.60,      // the slow unpredictable wander on top of the sines
    DROP_RECOVER: 0.7,      // where the lean lands after he sheds a bag
    DROP_KICK: 0.25,         // the lurch back towards upright a drop buys him
    DROP_GRACE: 0.15,        // seconds of no drift while he gathers himself
    LEAN_PX: 11,             // how far over he leans on screen at full tip

    // ---- what is in the way   (dir: -1 shoves him left, +1 right)
    SHOVE: 2.4,
    SHOVE_PER_BAG: 0.09,     // a shove lands harder the more he is carrying
    KERB_X: 140, KERB_DIR: -1,
    HOSE_X: 250, HOSE_DIR: 1,
    HOSE_STALL: 0.40,        // his foot snags and he stops dead for a moment
    CAT_X: 358, CAT_DIR: -1,
    CAT_LEAD: 88,            // how far ahead of him it bolts
    CAT_SPEED: 150,

    // ---- the screen door
    DOOR_PULL: 0.65,         // how long he spends hauling it open
    DOOR_DRIFT_MUL: 2.0,     // the brief: doubled drift for the last few steps
    DOOR_HAND: 0.55,         // and his corrections with one hand on the door

    // ---- score out of 1000
    SCORE_PER_BAG: 52,
    EGG_MULT: 2,             // an egg bag that arrives is worth double
    MULT_STEP: 0.045         // per bag attempted above MIN_BAGS
  };

  var TITLE = {
    number: 8,
    name: 'THE ONE-TRIPPER',
    joke: [
      'TWO TRIPS IS AN ADMISSION OF DEFEAT.',
      'EVERY BAG PAST SIX IS A BAG PAST SENSE.'
    ],
    controls: [
      'LEFT / RIGHT PICK THE LOAD, THEN KEEP HIM UPRIGHT.',
      'SPACE LOADS UP, AND OPENS THE SCREEN DOOR.'
    ]
  };

  // ================================================================= sprites
  var TILT_STEPS = 13;          // lean -1..+1 baked as discrete poses
  var PAD = 12;                 // so every tilt pose is the same width
  var DAD_W = 24 + PAD * 2, DAD_H = 32;
  var BAG_W = 9, BAG_H = 11, BAG_GAPX = 10, BAG_GAPY = 11;
  var spritesReady = false;

  // Shear a baked sprite: the feet stay put, the head swings. Whole pixels
  // only, so it stays as crisp as everything else.
  function skewRows(rows, amount) {
    var h = rows.length, w = 0, y, x;
    for (y = 0; y < h; y++) w = Math.max(w, rows[y].length);
    var out = [];
    for (y = 0; y < h; y++) {
      var f = (h - 1 - y) / (h - 1);            // 0 at the shoes, 1 at the hat
      var sh = Math.round(amount * f);
      var row = rows[y];
      var line = '';
      for (x = 0; x < w + PAD * 2; x++) {
        var sx = x - PAD - sh;
        line += (sx >= 0 && sx < w && sx < row.length) ? row.charAt(sx) : ' ';
      }
      out.push(line);
    }
    return out;
  }

  function makeBag(egg) {
    var g = ML.sprites.grid(BAG_W, BAG_H);
    ML.sprites.rect(g, 0, 2, BAG_W, BAG_H - 2, 'a');        // the sack
    ML.sprites.rect(g, 0, 2, 2, BAG_H - 2, 'b');            // lit edge
    ML.sprites.rect(g, 0, 2, BAG_W, 1, 'b');                // folded rim
    ML.sprites.rect(g, 2, 0, 2, 3, '9');                    // handles
    ML.sprites.rect(g, 5, 0, 2, 3, '9');
    ML.sprites.rect(g, 1, BAG_H - 2, BAG_W - 2, 1, '9');    // shadow underneath
    if (egg) {
      ML.sprites.ellipse(g, 4, 7, 2, 2.6, '4');             // the tell
      ML.sprites.rect(g, 3, 5, 1, 1, '4');
    }
    ML.sprites.outline(g);
    return ML.sprites.strings(g);
  }

  function makeCat() {
    var g = ML.sprites.grid(14, 9);
    ML.sprites.rect(g, 3, 3, 8, 4, 'd');                    // body
    ML.sprites.rect(g, 1, 2, 4, 4, 'd');                    // head
    ML.sprites.rect(g, 1, 0, 1, 2, 'd');                    // ears
    ML.sprites.rect(g, 3, 0, 1, 2, 'd');
    ML.sprites.rect(g, 5, 3, 1, 4, 'c');                    // tabby stripes
    ML.sprites.rect(g, 8, 3, 1, 4, 'c');
    ML.sprites.rect(g, 2, 4, 1, 1, '4');                    // eye
    ML.sprites.rect(g, 10, 0, 2, 4, 'd');                   // tail, up
    ML.sprites.rect(g, 3, 7, 2, 2, 'c');                    // legs
    ML.sprites.rect(g, 8, 7, 2, 2, 'c');
    ML.sprites.outline(g);
    return ML.sprites.strings(g);
  }

  function makeHose() {
    var g = ML.sprites.grid(26, 8);
    ML.sprites.ellipse(g, 13, 5, 12, 3, '7');
    ML.sprites.ellipse(g, 13, 5, 8, 2, '8');
    ML.sprites.ellipse(g, 13, 5, 4, 1, '7');
    ML.sprites.rect(g, 22, 1, 4, 2, '2');                   // the brass end
    ML.sprites.outline(g);
    return ML.sprites.strings(g);
  }

  function makeCar() {
    var g = ML.sprites.grid(46, 22);
    ML.sprites.rect(g, 2, 9, 42, 9, 'd');                   // body
    ML.sprites.rect(g, 10, 2, 24, 8, 'd');                  // cabin
    ML.sprites.rect(g, 12, 4, 9, 5, '5');                   // glass
    ML.sprites.rect(g, 23, 4, 9, 5, '5');
    ML.sprites.rect(g, 2, 12, 42, 2, 'c');                  // trim
    ML.sprites.ellipse(g, 11, 18, 4, 4, '1');               // wheels
    ML.sprites.ellipse(g, 35, 18, 4, 4, '1');
    ML.sprites.ellipse(g, 11, 18, 2, 2, '2');
    ML.sprites.ellipse(g, 35, 18, 2, 2, '2');
    ML.sprites.rect(g, 44, 10, 2, 2, 'c');                  // lights
    ML.sprites.rect(g, 0, 10, 2, 2, 'c');
    ML.sprites.outline(g);
    return ML.sprites.strings(g);
  }

  function makeDoor(open) {
    var g = ML.sprites.grid(26, 44);
    var w = open ? 10 : 26;                                 // swung towards us
    ML.sprites.rect(g, 0, 0, w, 44, '3');                   // the screen frame
    ML.sprites.rect(g, 1, 1, w - 2, 42, '2');               // the mesh
    for (var y = 2; y < 42; y += 2) ML.sprites.rect(g, 1, y, w - 2, 1, '3');
    ML.sprites.rect(g, 0, 20, w, 2, '3');                   // the middle rail
    if (!open) ML.sprites.rect(g, 21, 21, 3, 2, 'c');       // the handle
    ML.sprites.outline(g);
    return ML.sprites.strings(g);
  }

  function ensureSprites() {
    if (spritesReady) return;
    var look = { skin: 'e', hair: '9', shirt: '4', shirtAlt: 'd', pants: '6',
      shoe: '1', hat: 'cap', hatColor: 'd', build: 0, mustache: true, brow: true };
    var walkA = ML.sprites.figure(look, { arms: 'fore', bob: 0 });
    var walkB = ML.sprites.figure(look, { arms: 'fore', bob: 1 });
    var oneHand = ML.sprites.figure(look, { arms: 'out', bob: 0 });
    for (var i = 0; i < TILT_STEPS; i++) {
      var amt = ((i / (TILT_STEPS - 1)) * 2 - 1) * CONFIG.LEAN_PX;
      ML.sprites.add('gr_walkA' + i, skewRows(walkA, amt));
      ML.sprites.add('gr_walkB' + i, skewRows(walkB, amt));
      ML.sprites.add('gr_hand' + i, skewRows(oneHand, amt));
    }
    ML.sprites.add('gr_bag', makeBag(false));
    ML.sprites.add('gr_egg', makeBag(true));
    ML.sprites.add('gr_cat', makeCat());
    ML.sprites.add('gr_hose', makeHose());
    ML.sprites.add('gr_car', makeCar());
    ML.sprites.add('gr_door', makeDoor(false));
    ML.sprites.add('gr_dooropen', makeDoor(true));
    spritesReady = true;
  }

  function multiplier(n) { return 1 + (n - CONFIG.MIN_BAGS) * CONFIG.MULT_STEP; }

  // =================================================================== scene
  function scene(opts) {
    opts = opts || {};
    ensureSprites();

    // The egg bags are rolled ONCE, before he picks a number, so that changing
    // his mind on the loading screen does not reshuffle the risk.
    var eggMask = [];
    var anyEarly = false;
    for (var e = 0; e < CONFIG.MAX_BAGS; e++) {
      var isEgg = Math.random() < CONFIG.EGG_CHANCE;
      eggMask.push(isEgg);
      if (isEgg && e < CONFIG.MIN_BAGS) anyEarly = true;
    }
    if (!anyEarly) eggMask[2] = true;      // even the cautious load has stakes

    var s = {
      phase: 'title',        // title | load | walk | doorpull | result
      phaseT: 0,
      t: 0,
      idle: 0,

      sel: CONFIG.START_BAGS,
      attempted: 0,
      bags: [],              // bottom of the tower first; drops come off the top

      x: CONFIG.START_X,
      stepT: 0,
      stall: 0,

      lean: 0, leanVel: 0,
      d1: Math.random() * Math.PI * 2,
      d2: Math.random() * Math.PI * 2,
      d3: 0,
      grace: 0,

      hitKerb: false, hitHose: false,
      catOn: false, catDone: false, catX: 0,

      oneHanded: false,
      doorOpen: false,

      dropped: 0, eggsLost: 0,
      finalScore: 0, delivered: 0, units: 0
    };

    // Everything below keys off ATTEMPTED, not what is left in his arms.
    // Shedding a bag must NOT make him steady again - otherwise overloading
    // costs nothing, because he just sheds down to whatever he can handle and
    // still collects the bigger multiplier. The load he committed to at the
    // car is the load he is fighting all the way to the door.
    function over() { return Math.max(0, s.attempted - CONFIG.FREE_BAGS); }
    function driftForce() {
      return CONFIG.DRIFT_BASE
        + CONFIG.DRIFT_PER_BAG * Math.pow(over(), CONFIG.DRIFT_EXP);
    }
    function walkSpeed() {
      return CONFIG.BASE_SPEED * Math.max(0.35, 1 - over() * CONFIG.SLOW_PER_BAG);
    }
    function tiltStep() {
      return ML.clamp(Math.round((s.lean + 1) / 2 * (TILT_STEPS - 1)), 0, TILT_STEPS - 1);
    }

    // ------------------------------------------------------------ loading
    function confirmLoad() {
      s.attempted = s.sel;
      s.bags = [];
      for (var i = 0; i < s.attempted; i++) s.bags.push({ egg: !!eggMask[i] });
      s.phase = 'walk'; s.phaseT = 0; s.idle = 0;
      ML.sfx.play('confirm');
    }

    function updateLoad(dt) {
      var moved = false;
      if (ML.input.justPressed('left') && s.sel > CONFIG.MIN_BAGS) { s.sel--; moved = true; }
      if (ML.input.justPressed('right') && s.sel < CONFIG.MAX_BAGS) { s.sel++; moved = true; }
      if (moved) { ML.sfx.play('blip'); s.idle = 0; }
      else s.idle += dt;
      if (ML.input.justPressed('space') || ML.input.justPressed('enter')) { confirmLoad(); return; }
      if (s.idle > CONFIG.LOAD_IDLE) confirmLoad();
    }

    // --------------------------------------------------------------- walk
    // How many come off in one go. One bag if he is carrying a sensible load -
    // but a tower has a whole unsupported row on top of it, and when that goes
    // over, it all goes. This is the thing that makes greed genuinely
    // dangerous: without it a big load can never shed faster than it gained,
    // so taking the lot would always be correct no matter how bad you are.
    // It reads off the tower he is CURRENTLY holding, so you can see it coming.
    function shedCount() {
      var tall = Math.max(0, s.bags.length - CONFIG.FREE_BAGS);
      return 1 + Math.floor(tall / CONFIG.SHED_PER_ROW);
    }

    function dropBag() {
      if (!s.bags.length) return;
      var n = Math.min(shedCount(), s.bags.length);
      for (var d = 0; d < n; d++) shedOne();
      var dir0 = s.lean >= 0 ? 1 : -1;
      s.lean = dir0 * CONFIG.DROP_RECOVER;
      s.leanVel = -dir0 * CONFIG.DROP_KICK;
      s.grace = CONFIG.DROP_GRACE;
    }

    function shedOne() {
      var bag = s.bags.pop();                 // always the one off the top
      s.dropped++;
      var slot = s.bags.length;               // where it was sitting
      var col = slot % CONFIG.BAGS_PER_ROW;
      var row = (slot / CONFIG.BAGS_PER_ROW) | 0;
      var bx = CONFIG.DAD_SCREEN_X + 3 + (col - 1) * BAG_GAPX;
      var by = CONFIG.GROUND_Y - 18 - row * BAG_GAPY - BAG_H;

      if (bag.egg) {
        s.eggsLost++;
        ML.sfx.play('splat');
        ML.engine.shake(3, 0.3);
        ML.engine.hitstop(6);
        ML.engine.burst(bx, by + 6, 16, {
          colors: [P.CREAM, P.AMBER, P.WOOD_LIGHT], speedMin: 24, speedMax: 92,
          life: 0.7, grav: 260, spread: Math.PI * 2, size: 1
        });
      } else {
        ML.sfx.play('bagdrop');
        ML.engine.shake(2, 0.2);
        ML.engine.burst(bx, by + 6, 9, {
          colors: [P.WOOD, P.WOOD_LIGHT], speedMin: 18, speedMax: 62,
          life: 0.6, grav: 240, spread: Math.PI * 2, size: 1
        });
      }

    }

    function shove(dir) {
      s.leanVel += dir * CONFIG.SHOVE * (1 + over() * CONFIG.SHOVE_PER_BAG);
      ML.engine.shake(2, 0.18);
      ML.sfx.play('thud');
    }

    function updateBalance(dt) {
      var handMul = s.oneHanded ? CONFIG.DOOR_HAND : 1;
      var driftMul = s.oneHanded ? CONFIG.DOOR_DRIFT_MUL : 1;

      // the pendulum: already over means going further over
      s.leanVel += CONFIG.TIP_GAIN * s.lean * dt;

      if (s.grace > 0) s.grace -= dt;
      else {
        s.d1 += dt * CONFIG.DRIFT_SPEED_A;
        s.d2 += dt * CONFIG.DRIFT_SPEED_B;
        s.d3 = ML.clamp(s.d3 + (Math.random() - 0.5) * CONFIG.DRIFT_RANDOM * dt, -1, 1);
        var drift = Math.sin(s.d1) * 0.55 + Math.sin(s.d2) * 0.30 + s.d3 * 0.45;
        s.leanVel += drift * driftForce() * driftMul * dt;
      }

      if (ML.input.isDown('left')) s.leanVel -= CONFIG.CORRECT_FORCE * handMul * dt;
      if (ML.input.isDown('right')) s.leanVel += CONFIG.CORRECT_FORCE * handMul * dt;

      s.leanVel -= s.leanVel * CONFIG.DAMPING * dt;
      s.lean += s.leanVel * dt;

      if (s.lean <= -1 || s.lean >= 1) {
        s.lean = ML.clamp(s.lean, -1, 1);
        dropBag();
      }
    }

    function updateCat(dt) {
      if (s.catDone) return;
      if (!s.catOn) {
        if (s.x >= CONFIG.CAT_X - CONFIG.CAT_LEAD) {
          s.catOn = true;
          s.catX = s.x + CONFIG.CAT_LEAD;
          ML.sfx.play('bark');
        }
        return;
      }
      var prev = s.catX;
      s.catX -= CONFIG.CAT_SPEED * dt;
      if (prev > s.x && s.catX <= s.x) shove(CONFIG.CAT_DIR);
      if (s.catX < s.x - 90) s.catDone = true;
    }

    function updateWalk(dt) {
      updateBalance(dt);
      updateCat(dt);

      if (s.stall > 0) { s.stall -= dt; return; }

      var atDoor = s.x >= CONFIG.DOOR_X && !s.doorOpen;
      if (atDoor) {
        s.x = CONFIG.DOOR_X;
        s.idle += dt;
        if (ML.input.justPressed('space') || s.idle > CONFIG.DOOR_IDLE) {
          s.doorOpen = true;
          s.oneHanded = true;
          s.phase = 'doorpull'; s.phaseT = 0;
          ML.sfx.play('creak');
        }
        return;
      }

      var prevX = s.x;
      s.x += walkSpeed() * dt;
      s.stepT += dt;

      if (prevX < CONFIG.KERB_X && s.x >= CONFIG.KERB_X && !s.hitKerb) {
        s.hitKerb = true; shove(CONFIG.KERB_DIR);
      }
      if (prevX < CONFIG.HOSE_X && s.x >= CONFIG.HOSE_X && !s.hitHose) {
        s.hitHose = true; shove(CONFIG.HOSE_DIR);
        s.stall = CONFIG.HOSE_STALL;
        ML.sfx.play('stick');
      }

      if (s.x >= CONFIG.END_X) finish();
      else if (!s.bags.length) finish();       // nothing left to carry in
    }

    function finish() {
      s.delivered = s.bags.length;
      var units = 0;
      for (var i = 0; i < s.bags.length; i++) units += s.bags[i].egg ? CONFIG.EGG_MULT : 1;
      s.units = units;
      s.finalScore = Math.round(ML.clamp(
        units * CONFIG.SCORE_PER_BAG * multiplier(s.attempted), 0, 1000));
      s.phase = 'result'; s.phaseT = 0;
      ML.sfx.play(s.dropped === 0 ? 'crowd_cheer' : 'crowd_groan');
    }

    // ----------------------------------------------------------------- draw
    function camera() {
      return ML.clamp(s.x - CONFIG.DAD_SCREEN_X, 0, CONFIG.WORLD_W - 320);
    }

    function drawWorld(ctx, cam) {
      ML.engine.rect(0, 0, 320, 96, P.SKY, ctx);
      ML.engine.rect(0, 0, 320, 40, P.SKY_DEEP, ctx);
      ML.engine.rect(0, 96, 320, 84, P.GRASS, ctx);
      ML.engine.rect(0, 96, 320, 6, P.GRASS_DARK, ctx);

      // the house, growing out of the right hand end of the world
      var hx = 392 - cam;
      if (hx < 320) {
        ML.engine.rect(hx, 26, 320 - hx + 10, 124, P.WOOD, ctx);
        ML.engine.rect(hx, 26, 320 - hx + 10, 4, P.WOOD_DARK, ctx);
        for (var b = 34; b < 150; b += 10) {
          ML.engine.rect(hx, b, 320 - hx + 10, 1, P.WOOD_DARK, ctx);
        }
        ML.engine.rect(hx + 14, 44, 22, 20, P.SKY_DEEP, ctx);      // a window
        ML.engine.frameRect(hx + 14, 44, 22, 20, P.CREAM, ctx);
        ML.engine.rect(hx, 20, 320 - hx + 10, 7, P.CHARCOAL, ctx); // the porch roof
      }

      // the path, and the kerb it steps up onto
      ML.engine.rect(0, 126, 320, 24, P.GRAY, ctx);
      ML.engine.rect(0, 126, 320, 2, P.STEEL, ctx);
      for (var j = -(cam % 40); j < 320; j += 40) {
        ML.engine.rect(j, 126, 1, 24, P.STEEL, ctx);
      }

      var kx = CONFIG.KERB_X - cam;
      if (kx > -30 && kx < 330) {
        ML.engine.rect(kx - 4, 120, 26, 8, P.CREAM, ctx);
        ML.engine.rect(kx - 4, 120, 26, 2, P.STEEL, ctx);
        ML.engine.rect(kx - 4, 126, 26, 2, P.CHARCOAL, ctx);
      }

      ML.drawSprite('gr_car', 8 - cam, 118, null, ctx);
      ML.drawSprite('gr_hose', CONFIG.HOSE_X - 13 - cam, 132, null, ctx);

      // the arrow over each obstacle: which way it is going to throw you
      drawWarn(ctx, CONFIG.KERB_X - cam, CONFIG.KERB_DIR, s.hitKerb);
      drawWarn(ctx, CONFIG.HOSE_X - cam, CONFIG.HOSE_DIR, s.hitHose);
      drawWarn(ctx, CONFIG.CAT_X - cam, CONFIG.CAT_DIR, s.catDone);

      // the screen door
      var dx = CONFIG.DOOR_X + 4 - cam;
      ML.engine.rect(dx - 4, 104, 34, 46, P.CHARCOAL, ctx);
      ML.drawSprite(s.doorOpen ? 'gr_dooropen' : 'gr_door', dx, 106, null, ctx);
    }

    function drawWarn(ctx, sx, dir, done) {
      if (done || sx < -20 || sx > 330) return;
      var ch = dir < 0 ? '<<' : '>>';
      var bob = Math.round(Math.sin(s.t * 4) * 1);
      ML.font.drawTextShadowCentered(ch, sx, 112 + bob, P.ACCENT, ctx);
    }

    // The tower is drawn in front of him - he cannot see over it either, which
    // is the entire premise of the event.
    function drawTower(ctx, cx, feetY, bags, tilt) {
      for (var i = 0; i < bags.length; i++) {
        var col = i % CONFIG.BAGS_PER_ROW;
        var row = (i / CONFIG.BAGS_PER_ROW) | 0;
        var by = feetY - 18 - row * BAG_GAPY - BAG_H;
        // higher up the stack means it swings further than he does
        var lever = (feetY - (by + BAG_H / 2)) / 32;
        var bx = cx + 3 + (col - 1) * BAG_GAPX - BAG_W / 2 + tilt * lever;
        ML.drawSprite(bags[i].egg ? 'gr_egg' : 'gr_bag', Math.round(bx), by, null, ctx);
      }
    }

    function drawDad(ctx, cx, feetY, bags, walking) {
      var tilt = s.lean * CONFIG.LEAN_PX;
      var step = tiltStep();
      var name;
      if (s.oneHanded) name = 'gr_hand' + step;
      else name = ((walking && (s.stepT * 5) % 1 > 0.5) ? 'gr_walkB' : 'gr_walkA') + step;
      ML.drawSprite(name, cx - DAD_W / 2, feetY - DAD_H, null, ctx);
      drawTower(ctx, cx, feetY, bags, tilt);
    }

    function drawMeter(ctx) {
      var w = 128, x = 160 - w / 2, y = 166;
      ML.engine.rect(x - 2, y - 2, w + 4, 10, P.INK, ctx);
      ML.engine.rect(x, y, w, 6, P.CHARCOAL, ctx);
      ML.engine.rect(x + w / 2 - 1, y, 2, 6, P.STEEL, ctx);      // upright
      var m = Math.abs(s.lean);
      var col = m > 0.78 ? P.ORANGE : (m > 0.5 ? P.AMBER : P.ACCENT);
      var mx = Math.round(x + w / 2 + s.lean * (w / 2 - 3));
      ML.engine.rect(mx - 2, y - 2, 5, 10, col, ctx);
      ML.font.drawText('<', x - 12, y - 1, P.STEEL, ctx);
      ML.font.drawText('>', x + w + 6, y - 1, P.STEEL, ctx);
      if (m > 0.78) {
        ML.font.drawTextShadowCentered(s.lean > 0 ? 'PRESS LEFT' : 'PRESS RIGHT',
          160, 154, P.ORANGE, ctx);
      }
    }

    function drawHud(ctx) {
      ML.engine.rect(0, 0, 320, 12, P.INK, ctx);
      ML.engine.rect(0, 12, 320, 1, P.CHARCOAL, ctx);
      ML.font.drawText('BAGS ' + s.bags.length + '/' + s.attempted, 6, 3, P.CREAM, ctx);
      ML.font.drawText('X' + multiplier(s.attempted).toFixed(2), 122, 3, P.AMBER, ctx);
      if (s.eggsLost) ML.font.drawText('EGGS LOST ' + s.eggsLost, 178, 3, P.ORANGE, ctx);
      // how far to the door
      var f = ML.clamp((s.x - CONFIG.START_X) / (CONFIG.END_X - CONFIG.START_X), 0, 1);
      ML.engine.rect(262, 4, 52, 5, P.CHARCOAL, ctx);
      ML.engine.rect(262, 4, Math.round(52 * f), 5, P.GRASS, ctx);
      ML.engine.frameRect(262, 4, 52, 5, P.STEEL, ctx);
    }

    function drawLoad(ctx) {
      ML.engine.rect(0, 0, 320, 96, P.SKY, ctx);
      ML.engine.rect(0, 0, 320, 40, P.SKY_DEEP, ctx);
      ML.engine.rect(0, 96, 320, 84, P.GRASS, ctx);
      ML.engine.rect(0, 96, 320, 6, P.GRASS_DARK, ctx);
      ML.engine.rect(0, 126, 320, 24, P.GRAY, ctx);
      ML.engine.rect(0, 126, 320, 2, P.STEEL, ctx);
      ML.drawSprite('gr_car', 6, 118, null, ctx);

      var preview = [];
      for (var i = 0; i < s.sel; i++) preview.push({ egg: !!eggMask[i] });
      ML.drawSprite('gr_walkA' + (((TILT_STEPS - 1) / 2) | 0), 224 - DAD_W / 2,
        CONFIG.GROUND_Y - DAD_H, null, ctx);
      drawTower(ctx, 224, CONFIG.GROUND_Y, preview, 0);

      ML.engine.rect(0, 0, 320, 12, P.INK, ctx);
      ML.font.drawText('HOW MANY ARE YOU TAKING?', 6, 3, P.CREAM, ctx);

      // wide enough for the longest line it can hold - THIS IS NOT ADVISABLE
      var bx = 8, by = 26, bw = 150, bh = 76;
      ML.engine.rect(bx + 2, by + 2, bw, bh, P.INK, ctx);
      ML.engine.rect(bx, by, bw, bh, P.CHARCOAL, ctx);
      ML.engine.frameRect(bx, by, bw, bh, P.CREAM, ctx);

      ML.ui.bigText(String(s.sel), bx + bw / 2, by + 6, P.ACCENT, 2, ctx);
      ML.font.drawTextCentered('BAGS', bx + bw / 2, by + 24, P.STEEL, ctx);
      ML.font.drawTextCentered('MULTIPLIER X' + multiplier(s.sel).toFixed(2),
        bx + bw / 2, by + 36, P.AMBER, ctx);

      var over = Math.max(0, s.sel - CONFIG.FREE_BAGS);
      var verdict = over === 0 ? 'STEADY AS A ROCK'
        : over <= 2 ? 'A BIT OF A WOBBLE'
        : over <= 4 ? 'HE CANNOT SEE THE PATH'
        : 'THIS IS NOT ADVISABLE';
      ML.font.drawTextCentered(verdict, bx + bw / 2, by + 50,
        over === 0 ? P.GRASS : (over <= 2 ? P.AMBER : P.ORANGE), ctx);

      var eggs = 0;
      for (var k = 0; k < s.sel; k++) if (eggMask[k]) eggs++;
      ML.font.drawTextCentered('EGG BAGS: ' + eggs + '  (DOUBLE)',
        bx + bw / 2, by + 62, P.CREAM, ctx);

      var pulse = Math.sin(s.t * 5) > 0 ? P.ACCENT : P.CREAM;
      ML.font.drawTextShadowCentered('LEFT / RIGHT TO CHANGE THE LOAD', 160, 156, P.CREAM, ctx);
      ML.font.drawTextShadowCentered('SPACE TO PICK IT ALL UP', 160, 168, pulse, ctx);
    }

    return {
      key: 'groceries',
      name: TITLE.name,

      enter: function () { ML.engine.clearParticles(); },
      exit: function () { ML.sfx.stopAllLoops(); },

      update: function (dt) {
        s.t += dt;
        s.phaseT += dt;

        if (s.phase === 'title') {
          if (s.phaseT >= CONFIG.TITLE_TIME || ML.input.justPressed('enter')) {
            s.phase = 'load'; s.phaseT = 0; s.idle = 0;
            ML.sfx.play('confirm');
          }
          return;
        }

        if (s.phase === 'result') {
          if (s.phaseT >= CONFIG.RESULT_TIME || ML.input.justPressed('enter')) {
            ML.engine.replace(ML.ui.resultsScene({
              key: 'groceries',
              name: TITLE.name,
              score: s.finalScore,
              lines: [
                'DELIVERED: ' + s.delivered + '/' + s.attempted,
                'DROPPED: ' + s.dropped,
                'EGGS LOST: ' + s.eggsLost
              ]
            }));
          }
          return;
        }

        if (ML.input.justPressed('escape')) { ML.engine.push(ML.ui.pauseScene()); return; }

        if (s.phase === 'load') { updateLoad(dt); return; }

        if (s.phase === 'doorpull') {
          updateBalance(dt);                    // he still has to stay upright
          if (s.phaseT >= CONFIG.DOOR_PULL) { s.phase = 'walk'; s.idle = 0; }
          return;
        }

        if (s.phase === 'walk') { updateWalk(dt); return; }
      },

      draw: function (ctx) {
        if (s.phase === 'load' || s.phase === 'title') {
          drawLoad(ctx);
          ML.engine.drawParticles(ctx);
          if (s.phase === 'title') {
            TITLE.remaining = CONFIG.TITLE_TIME - s.phaseT;
            ML.ui.drawTitleCard(TITLE, s.t, ctx);
          }
          return;
        }

        var cam = camera();
        drawWorld(ctx, cam);

        drawDad(ctx, s.x - cam, CONFIG.GROUND_Y, s.bags,
          s.phase === 'walk' && s.stall <= 0 && !(s.x >= CONFIG.DOOR_X && !s.doorOpen));

        // in FRONT of him - it goes between his feet, and it is the only
        // obstacle that moves, so it has to be the one you cannot miss
        if (s.catOn && !s.catDone) {
          ML.drawSprite('gr_cat', Math.round(s.catX - cam - 7), CONFIG.GROUND_Y - 9, null, ctx);
        }

        ML.engine.drawParticles(ctx);
        drawHud(ctx);

        if (s.phase === 'walk' || s.phase === 'doorpull') {
          drawMeter(ctx);
          if (s.x >= CONFIG.DOOR_X && !s.doorOpen) {
            ML.font.drawTextShadowCentered('SPACE OPENS THE SCREEN DOOR', 160, 142, P.ACCENT, ctx);
            ML.font.drawTextShadowCentered('IT COSTS YOU A HAND', 160, 152, P.STEEL, ctx);
          } else if (s.oneHanded) {
            ML.font.drawTextShadowCentered('ONE HAND ON THE DOOR', 160, 142, P.ORANGE, ctx);
          }
        }

        if (s.phase === 'result') {
          ML.ui.drawResultCard({
            name: TITLE.name,
            score: s.finalScore,
            lines: ['DELIVERED: ' + s.delivered + '/' + s.attempted],
            footer: 'ENTER SKIPS'
          }, s.phaseT, ctx);
        }
      }
    };
  }

  return { scene: scene, CONFIG: CONFIG, name: TITLE.name, key: 'groceries' };
})();
