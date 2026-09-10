/*
  ==========================================================================
  EVENT 3 - SPLITTING IMAGE (chopping wood)
  ==========================================================================

  WHAT THE PLAYER DOES
  Every swing of the axe costs two presses of SPACE.

    Press 1 - POWER. A bar on the left fills bottom-to-top, then falls back
              down, over and over. Press SPACE to freeze it. Higher is better,
              but it moves fast and once it tips over the top it is falling.

    Press 2 - AIM. The moment power is locked, a marker starts sweeping across
              a bar at the bottom of the screen. The bright zone in the middle
              is the centre of the log. You get a couple of seconds; letting
              that run out counts as a wild miss, and burns a swing.

  WHAT HAPPENS
    high power + dead centre ....... PERFECT. Full points, combo +1, the works.
    high power + inside the spot ... clean split. Combo +1. Scores a little less
                                     the further off centre you were.
    high power + off centre ........ crooked. The log comes apart but it is worth
                                     almost nothing, and it breaks the combo.
    low power  + inside the spot ... the axe bites. It takes a SECOND SWING out
                                     of your ten to finish that log.
    low power  + off centre ........ the axe sticks. Swing wasted, combo lost.

  AIM IS WHERE THE POINTS ARE. Power only decides WHICH of those happens; how
  centred you were decides what it is worth. A perfect hit is worth roughly
  three crooked ones, and only a clean hit builds combo - which is the biggest
  single chunk of the final score.

  TEN SWINGS. NO CLOCK.
  The event is exactly ten swings long. Nothing is timed except the aim window,
  so you can take as long as you like lining up each one. Every swing counts
  against the ten, whether it splits the log, bites, sticks or misses entirely.

  FATIGUE
  He gets tired. Over the ten swings two things creep in, both of them visible
  on screen rather than hidden:

    * His arms give out. The power bar stops reaching the top - by the last
      swing it tops out around 85%, and the greyed-out cap on the bar shows you
      exactly where. The window for a hard swing gets narrower every time.
    * His hands start to shake. The aim marker drifts on a slow wave that grows
      as he tires. It is a smooth drift, not randomness, so it can still be read
      and timed - it just punishes a lazy press.

  Combo pressure stacks on top of fatigue: every step of combo shrinks the sweet
  spot, speeds up the aim marker and speeds up the power bar. Getting stuck,
  chopping crooked, or letting the aim window expire resets the combo to zero.

  WHERE THE DIFFICULTY KNOBS ARE
  Everything tweakable is in the CONFIG block directly below. In plain English:

    TOTAL_SWINGS ........... how many swings the whole event lasts.
    POWER_CYCLE_SPEED ...... how fast the power bar goes up and down.
                             Bigger = harder.
    FATIGUE_POWER_FLOOR .... how far the power bar can still reach on the LAST
                             swing (0.85 = 85% of full). Smaller = harder.
                             Set it to 1 to switch arm fatigue off entirely.
    FATIGUE_WOBBLE ......... how much his aim drifts when spent. Bigger = harder.
                             Set it to 0 to switch hand shake off entirely.
    POWER_HIGH ............. how full the bar must be to count as a hard swing
                             (0.70 = 70% of the way up). Bigger = harder.
    STRIKE_WINDOW .......... seconds you get for the aim press. Smaller = harder.
    STRIKE_SPEED ........... how fast the aim marker sweeps. Bigger = harder.
    SWEET_HALF ............. half the width of the sweet spot, as a fraction of
                             the bar (0.15 = the middle 30%). Smaller = harder.
    PERFECT_FRACTION ....... how much of the sweet spot counts as a PERFECT hit
                             (the amber core on the bar). Smaller = harder.
    COMBO_* ................ how much each of the three gets harder per combo step.
    QUALITY_* .............. what each kind of hit is worth. Widen the gap
                             between QUALITY_PERFECT and QUALITY_CROOKED to make
                             aiming matter even more.
    SCORE_PER_LOG etc. ..... how the final score out of 1000 is put together.

  If AIMING feels too hard, raise SWEET_HALF and lower STRIKE_SPEED.
  If aiming feels like it does not MATTER, lower QUALITY_CROOKED and raise
  COMBO_BONUS.
  If FATIGUE feels too punishing, raise FATIGUE_POWER_FLOOR towards 1 and lower
  FATIGUE_WOBBLE towards 0. Either one can be switched off on its own.
*/
window.ML = window.ML || {};
ML.events = ML.events || {};

ML.events.chopping = (function () {
  var P = ML.palette;

  var CONFIG = {
    // ---- length of the event
    TOTAL_SWINGS: 10,        // the whole event. There is no clock.

    // ---- pacing (feel only - none of these cost you anything any more,
    //      because with no clock the only currency is swings)
    RESULT_TIME: 3,          // result card
    SWING_TIME: 0.24,        // axe travel animation
    REACT_TIME: 0.45,        // how long the outcome message hangs around
    RESET_TIME: 0.35,        // pause before the next log rolls on
    POP_TIME: 0.9,           // how long a floating score number hangs around
    STUCK_TIME: 1.2,         // how long he wrestles the axe back out
    MISS_STALL: 0.6,         // how long he stands there after a wild miss

    // ---- fatigue: ten swings takes it out of a man
    FATIGUE_CURVE: 1.15,     // >1 = stays fresh a while, then falls off a cliff
    FATIGUE_POWER_FLOOR: 0.85, // power bar tops out here on the LAST swing (1 = off)
    FATIGUE_WOBBLE: 0.038,   // how far his aim drifts when spent (0 = off)
    FATIGUE_WOBBLE_SPEED: 3.1,

    // ---- press 1: power
    POWER_CYCLE_SPEED: 1.5,  // up-and-down cycles per second
    POWER_HIGH: 0.70,        // at or above this counts as a hard swing

    // ---- press 2: aim
    STRIKE_WINDOW: 1.8,      // seconds to make the aim press
    STRIKE_SPEED: 1.45,      // left-right-left sweeps per second
    SWEET_HALF: 0.15,        // half-width of the sweet spot (fraction of bar)
    PERFECT_FRACTION: 0.45,  // the middle 45% OF THE SWEET SPOT is a PERFECT hit

    // ---- combo pressure
    COMBO_SWEET_SHRINK: 0.96, // sweet spot x0.96 per combo step
    COMBO_STRIKE_SPEEDUP: 1.05,
    COMBO_POWER_SPEEDUP: 1.04,
    SWEET_MIN: 0.055,         // never shrink past this, or it becomes a coin flip

    // ---- how a split is graded. THIS is what makes aim worth anything.
    // A clean split slides between these two depending on how centred it was.
    QUALITY_PERFECT: 1.0,     // dead centre
    QUALITY_CLEAN_EDGE: 0.8,  // clean, but scraping the edge of the sweet spot
    QUALITY_CROOKED: 0.3,     // high power, missed the spot - barely worth points
    QUALITY_BITE: 0.75,
    CROOKED_RECOVERY: 1.15,   // how long he spends gathering up the mess (feel only)

    // ---- score out of 1000
    // With the clock gone this is a fixed ten swings, so the brief's 55 points
    // per log works exactly as written again: ten perfect splits is 550 from
    // logs, and the combo bonus carries the rest up to 1000.
    SCORE_PER_LOG: 55,       // multiplied by the quality of each split
    COMBO_BONUS: 58,         // per step of the best combo reached
    POWER_BONUS: 45,         // multiplied by average power of successful splits

    // ---- layout (change only if you move things around on screen)
    LOG_X: 143, LOG_Y: 120,       // the log, resting on the block
    BLOCK_X: 150, BLOCK_Y: 134,   // the chopping block
    PLAYER_X: 100, PLAYER_Y: 122, // he stands to the left of it, in full view
    AXE_X: 106, AXE_Y: 107,       // axe at rest, overhead, in his hands
    AXE_HIT_X: 161, AXE_HIT_Y: 115, // axe buried in the log
    GROUND_Y: 118,
    POWER_BAR: { x: 14, y: 42, w: 12, h: 84 },
    STRIKE_BAR: { x: 84, y: 160, w: 152, h: 10 }
  };

  var TITLE = {
    number: 3,
    name: 'SPLITTING IMAGE',
    joke: [
      'RULE 4.1: THE LOG IS ALREADY DEAD.',
      'TEN SWINGS. NO CLOCK. TAKE YOUR TIME.'
    ],
    controls: [
      'SPACE ONCE FOR POWER, AGAIN TO AIM',
      'HE TIRES. THE LAST FEW ARE THE HARD ONES.'
    ]
  };

  function triangle(u) {
    u = u - Math.floor(u);
    return u < 0.5 ? u * 2 : 2 - u * 2;
  }

  function scene(opts) {
    opts = opts || {};

    // ---------------------------------------------------------------- state
    var s = {
      phase: 'title',        // title | power | strike | swing | react | stuck | reset | result
      phaseT: 0,
      t: 0,
      swingsUsed: 0,         // every committed swing counts, however it went

      power: 0,              // live value of the power bar
      lockedPower: 0,
      marker: 0.5,           // live position of the aim marker
      lockedMarker: 0.5,

      combo: 0,
      maxCombo: 0,
      logsSplit: 0,
      qualitySum: 0,
      powerSum: 0,
      powerCount: 0,

      bites: 0,              // bites taken out of the CURRENT log
      outcome: '',
      message: '',
      messageColor: P.CREAM,

      halves: null,          // flying log halves after a split
      pops: [],              // floating "+55" score numbers, pre-allocated below
      finalScore: 0
    };

    for (var i = 0; i < 6; i++) {
      s.pops.push({ active: false, x: 0, y: 0, life: 0, text: '', color: P.CREAM });
    }

    // A floating number above the log, so the value of a swing is never a
    // mystery - a perfect hit reads +55, a crooked one reads +17.
    function pop(text, color) {
      var slot = null;
      for (var i = 0; i < s.pops.length; i++) {
        if (!s.pops[i].active) { slot = s.pops[i]; break; }
      }
      if (!slot) slot = s.pops[0];
      slot.active = true;
      slot.x = CONFIG.LOG_X + 22;
      slot.y = CONFIG.LOG_Y - 6;
      slot.life = CONFIG.POP_TIME;
      slot.text = text;
      slot.color = color;
    }

    // ----------------------------------------------------------------- fatigue
    // 0 on the first swing, 1 on the last. Everything tiring reads off this.
    function fatigue() {
      if (CONFIG.TOTAL_SWINGS <= 1) return 0;
      var raw = s.swingsUsed / (CONFIG.TOTAL_SWINGS - 1);
      return Math.pow(ML.clamp(raw, 0, 1), CONFIG.FATIGUE_CURVE);
    }

    // His arms give out: the power bar can no longer reach the top.
    function powerCeiling() {
      return ML.lerp(1, CONFIG.FATIGUE_POWER_FLOOR, fatigue());
    }

    // His hands shake: a slow drift added to the aim marker. Smooth, not random,
    // so a patient player can still read it.
    function aimWobble() {
      return Math.sin(s.t * CONFIG.FATIGUE_WOBBLE_SPEED) * CONFIG.FATIGUE_WOBBLE * fatigue();
    }

    function swingsLeft() { return CONFIG.TOTAL_SWINGS - s.swingsUsed; }

    // ------------------------------------------------------- difficulty ramp
    function sweetHalf() {
      return Math.max(CONFIG.SWEET_MIN,
        CONFIG.SWEET_HALF * Math.pow(CONFIG.COMBO_SWEET_SHRINK, s.combo));
    }
    function strikeSpeed() {
      return CONFIG.STRIKE_SPEED * Math.pow(CONFIG.COMBO_STRIKE_SPEEDUP, s.combo);
    }
    function powerSpeed() {
      return CONFIG.POWER_CYCLE_SPEED * Math.pow(CONFIG.COMBO_POWER_SPEEDUP, s.combo);
    }

    function setPhase(p) { s.phase = p; s.phaseT = 0; }

    function say(msg, color) { s.message = msg; s.messageColor = color; }

    // ------------------------------------------------------------- outcomes
    function chips(n, spread) {
      ML.engine.burst(CONFIG.LOG_X + 22, CONFIG.LOG_Y + 6, n, {
        colors: [P.WOOD_LIGHT, P.WOOD, P.WOOD_DARK, P.CREAM],
        speedMin: 30, speedMax: 130, life: 0.7, grav: 260, drag: 0.98,
        spread: spread === undefined ? Math.PI * 1.1 : spread, dir: -Math.PI / 2, size: 2
      });
    }

    function splitLog() {
      s.halves = {
        t: 0,
        lx: CONFIG.LOG_X, ly: CONFIG.LOG_Y,
        rx: CONFIG.LOG_X, ry: CONFIG.LOG_Y + 7,
        lvx: -55 - Math.random() * 25, lvy: -70,
        rvx: 55 + Math.random() * 25, rvy: -60
      };
      s.bites = 0;
    }

    // Bank a split and show the player exactly what it was worth.
    function bank(quality, color) {
      s.logsSplit++;
      s.qualitySum += quality;
      s.powerSum += s.lockedPower; s.powerCount++;
      pop('+' + Math.round(quality * CONFIG.SCORE_PER_LOG), color);
    }

    function resolveSwing() {
      s.swingsUsed++;

      // How far off centre was the strike, as a fraction of the sweet spot?
      // 0 = dead centre, 1 = right on the edge, above 1 = missed it.
      var off = Math.abs(s.lockedMarker - 0.5) / sweetHalf();
      var onSweet = off <= 1;
      var high = s.lockedPower >= CONFIG.POWER_HIGH;

      if (high && onSweet) {
        // A clean split is graded on how centred it was, so there is always
        // something left to aim for even once you can hit the zone reliably.
        var perfect = off <= CONFIG.PERFECT_FRACTION;
        var quality = perfect ? CONFIG.QUALITY_PERFECT
          : ML.lerp(CONFIG.QUALITY_PERFECT, CONFIG.QUALITY_CLEAN_EDGE,
                    (off - CONFIG.PERFECT_FRACTION) / (1 - CONFIG.PERFECT_FRACTION));

        s.outcome = 'clean';
        s.combo++;
        if (s.combo > s.maxCombo) s.maxCombo = s.combo;
        bank(quality, perfect ? P.ACCENT : P.AMBER);

        var tag = perfect ? 'PERFECT!' : 'CLEAN SPLIT!';
        say(s.combo >= 2 ? tag + '  X' + s.combo : tag, perfect ? P.ACCENT : P.CREAM);
        ML.sfx.play('chop');
        ML.engine.shake(perfect ? 5 : 3, perfect ? 0.32 : 0.22);
        ML.engine.hitstop(perfect ? 8 : 5);
        chips(perfect ? 26 : 16);
        splitLog();
        if (perfect) ML.sfx.play('confirm');
        if (s.combo > 0 && s.combo % 3 === 0) ML.sfx.play('crowd_cheer');

      } else if (high && !onSweet) {
        // It still comes apart - but for almost nothing, it takes him over a
        // second to gather up the mess, and IT BREAKS THE COMBO. Without that
        // last part, holding high power and never aiming can never be punished,
        // because a high-power swing can never get the axe stuck.
        s.outcome = 'crooked';
        s.combo = 0;
        bank(CONFIG.QUALITY_CROOKED, P.GRAY);
        say('CROOKED. COMBO LOST.', P.ORANGE);
        ML.sfx.play('thud');
        ML.engine.shake(1, 0.12);
        chips(7);
        splitLog();

      } else if (!high && onSweet) {
        s.bites++;
        if (s.bites >= 2) {
          s.outcome = 'bitesplit';
          bank(CONFIG.QUALITY_BITE, P.CREAM);
          say('THERE IT GOES.', P.CREAM);
          ML.sfx.play('chop');
          ML.engine.shake(2, 0.15);
          chips(14);
          splitLog();
        } else {
          s.outcome = 'bite';
          say('BIT IN. SWING AGAIN.', P.CREAM);
          ML.sfx.play('thud');
          chips(6, Math.PI * 0.6);
        }

      } else {
        s.outcome = 'stuck';
        s.combo = 0;
        say('STUCK!', P.ORANGE);
        ML.sfx.play('stick');
        ML.engine.shake(1, 0.1);
      }
    }

    function missWindow() {
      s.swingsUsed++;
      s.outcome = 'miss';
      s.combo = 0;
      say('WILD MISS.', P.ORANGE);
      ML.sfx.play('whiff');
      ML.engine.burst(CONFIG.LOG_X + 22, CONFIG.LOG_Y + 12, 6, {
        colors: [P.GRASS, P.GRASS_DARK], speedMin: 20, speedMax: 70,
        life: 0.4, grav: 200, spread: Math.PI, dir: -Math.PI / 2, size: 1
      });
    }

    function computeScore() {
      var avgPower = s.powerCount ? (s.powerSum / s.powerCount) : 0;
      var raw = s.qualitySum * CONFIG.SCORE_PER_LOG
        + s.maxCombo * CONFIG.COMBO_BONUS
        + avgPower * CONFIG.POWER_BONUS;
      return Math.round(ML.clamp(raw, 0, 1000));
    }

    function finish() {
      s.finalScore = computeScore();
      setPhase('result');
      ML.sfx.play(s.finalScore >= 500 ? 'crowd_cheer' : 'crowd_groan');
    }

    // ------------------------------------------------------------- updating
    function updatePlay(dt) {
      if (ML.input.justPressed('escape')) {
        ML.engine.push(ML.ui.pauseScene());
        return;
      }

      for (var i = 0; i < s.pops.length; i++) {
        var pp = s.pops[i];
        if (!pp.active) continue;
        pp.life -= dt;
        pp.y -= 20 * dt;
        if (pp.life <= 0) pp.active = false;
      }

      if (s.halves) {
        s.halves.t += dt;
        s.halves.lvy += 420 * dt; s.halves.rvy += 420 * dt;
        s.halves.lx += s.halves.lvx * dt; s.halves.ly += s.halves.lvy * dt;
        s.halves.rx += s.halves.rvx * dt; s.halves.ry += s.halves.rvy * dt;
        if (s.halves.t > 1.2) s.halves = null;
      }

      switch (s.phase) {
        case 'power':
          // tired arms cannot drive the bar to the top any more
          s.power = triangle(s.phaseT * powerSpeed()) * powerCeiling();
          if (ML.input.justPressed('space')) {
            s.lockedPower = s.power;
            ML.sfx.play('blip');
            setPhase('strike');
          }
          break;

        case 'strike':
          // tired hands drift; the wobble is part of the real value, not decoration
          s.marker = ML.clamp(triangle(s.phaseT * strikeSpeed()) + aimWobble(), 0, 1);
          if (ML.input.justPressed('space')) {
            s.lockedMarker = s.marker;
            setPhase('swing');
          } else if (s.phaseT >= CONFIG.STRIKE_WINDOW) {
            missWindow();
            setPhase('react');
          }
          break;

        case 'swing':
          if (s.phaseT >= CONFIG.SWING_TIME) {
            resolveSwing();
            setPhase(s.outcome === 'stuck' ? 'stuck' : 'react');
          }
          break;

        case 'react':
          var wait = CONFIG.REACT_TIME;
          if (s.outcome === 'miss') wait = CONFIG.MISS_STALL;
          else if (s.outcome === 'crooked') wait = CONFIG.CROOKED_RECOVERY;
          if (s.phaseT >= wait) {
            if (swingsLeft() <= 0) { finish(); }
            else if (s.outcome === 'bite') { setPhase('power'); }  // same log, next swing
            else { setPhase('reset'); }
          }
          break;

        case 'stuck':
          // wrestling it back out - cosmetic now, the swing is already spent
          if (s.phaseT >= CONFIG.STUCK_TIME) {
            if (swingsLeft() <= 0) finish(); else setPhase('power');
          }
          break;

        case 'reset':
          if (s.phaseT >= CONFIG.RESET_TIME) { s.message = ''; setPhase('power'); }
          break;
      }
    }

    // -------------------------------------------------------------- drawing
    function drawPowerBar(ctx) {
      var b = CONFIG.POWER_BAR;
      ML.engine.rect(b.x - 2, b.y - 2, b.w + 4, b.h + 4, P.INK, ctx);
      ML.engine.rect(b.x, b.y, b.w, b.h, P.CHARCOAL, ctx);

      // the part of the bar his arms can no longer reach, greyed off the top
      var ceil = powerCeiling();
      var ch = Math.round((1 - ceil) * b.h);
      if (ch > 0) {
        ML.engine.rect(b.x, b.y, b.w, ch, P.GRAY, ctx);
        ML.engine.rect(b.x, b.y + ch, b.w, 1, P.STEEL, ctx);
      }

      var show = (s.phase === 'power') ? s.power : s.lockedPower;
      var fh = Math.round(show * b.h);
      var col = show >= CONFIG.POWER_HIGH ? P.ORANGE : P.AMBER;
      ML.engine.rect(b.x, b.y + b.h - fh, b.w, fh, col, ctx);

      // the "hard swing" line
      var ty = b.y + b.h - Math.round(CONFIG.POWER_HIGH * b.h);
      ML.engine.rect(b.x - 3, ty, b.w + 6, 1, P.ACCENT, ctx);

      ML.engine.frameRect(b.x, b.y, b.w, b.h, P.CREAM, ctx);
      ML.font.drawTextShadow('PWR', b.x - 3, b.y - 10, s.phase === 'power' ? P.ACCENT : P.STEEL, ctx);

      // how spent he is, right under the bar
      var f = fatigue();
      if (f > 0.02) {
        ML.font.drawTextShadow('TIRED', b.x - 8, b.y + b.h + 6,
          f > 0.66 ? P.ORANGE : P.STEEL, ctx);
        ML.engine.rect(b.x - 8, b.y + b.h + 15, 28, 3, P.CHARCOAL, ctx);
        ML.engine.rect(b.x - 8, b.y + b.h + 15, Math.round(28 * f), 3,
          f > 0.66 ? P.ORANGE : P.AMBER, ctx);
      }
    }

    function drawStrikeBar(ctx) {
      var b = CONFIG.STRIKE_BAR;
      var active = (s.phase === 'strike');
      ML.engine.rect(b.x - 2, b.y - 2, b.w + 4, b.h + 4, P.INK, ctx);
      ML.engine.rect(b.x, b.y, b.w, b.h, P.CHARCOAL, ctx);

      // sweet spot, with a brighter core in the middle for a PERFECT hit
      var half = sweetHalf();
      var sx = Math.round(b.x + (0.5 - half) * b.w);
      var sw = Math.round(half * 2 * b.w);
      ML.engine.rect(sx, b.y, sw, b.h, active ? P.GRASS : P.GRASS_DARK, ctx);

      var core = half * CONFIG.PERFECT_FRACTION;
      var cx = Math.round(b.x + (0.5 - core) * b.w);
      var cw = Math.max(3, Math.round(core * 2 * b.w));
      ML.engine.rect(cx, b.y, cw, b.h, active ? P.AMBER : P.WOOD, ctx);
      ML.engine.rect(b.x + b.w / 2 - 1, b.y, 1, b.h, P.CREAM, ctx);

      if (active || s.phase === 'swing') {
        var m = (s.phase === 'swing') ? s.lockedMarker : s.marker;
        var mx = Math.round(b.x + m * b.w) - 1;
        ML.engine.rect(mx, b.y - 3, 3, b.h + 6, P.ACCENT, ctx);
      }
      ML.engine.frameRect(b.x, b.y, b.w, b.h, P.CREAM, ctx);

      // the aim window draining away, drawn above the bar
      if (active) {
        var left = 1 - ML.clamp(s.phaseT / CONFIG.STRIKE_WINDOW, 0, 1);
        ML.engine.rect(b.x, b.y - 6, Math.round(b.w * left), 2, P.ORANGE, ctx);
      }
    }

    function drawHud(ctx) {
      ML.engine.rect(0, 0, 320, 12, P.INK, ctx);
      ML.engine.rect(0, 12, 320, 1, P.CHARCOAL, ctx);

      // which swing he is on, out of ten
      var n = Math.min(s.swingsUsed + 1, CONFIG.TOTAL_SWINGS);
      var last = swingsLeft() <= 1;
      ML.font.drawText('SWING ' + n + '/' + CONFIG.TOTAL_SWINGS, 6, 3,
        last ? P.ORANGE : P.CREAM, ctx);

      ML.font.drawText('LOGS ' + s.logsSplit, 122, 3, P.CREAM, ctx);

      if (s.combo >= 2) {
        ML.font.drawText('COMBO X' + s.combo, 236, 3, P.ACCENT, ctx);
      } else {
        ML.font.drawText('COMBO --', 236, 3, P.GRAY, ctx);
      }
    }

    function drawScene(ctx) {
      ML.ui.backdrop(ctx, s.t, CONFIG.GROUND_Y);

      // the competitor
      var sprite = 'player_idle0';
      if (s.phase === 'power' || s.phase === 'strike') {
        sprite = 'player_up';
      } else if (s.phase === 'swing') {
        sprite = s.phaseT > CONFIG.SWING_TIME * 0.5 ? 'player_swing' : 'player_up';
      } else if (s.phase === 'stuck') {
        sprite = 'player_strain';
      } else if (s.phase === 'react') {
        sprite = (s.outcome === 'clean') ? 'player_win' : 'player_swing';
      } else {
        sprite = 'player_idle' + (Math.floor(s.t * 3) % 2);
      }
      var pjitter = (s.phase === 'stuck') ? (Math.floor(s.t * 30) % 2 ? 1 : -1) : 0;
      ML.drawSprite(sprite, CONFIG.PLAYER_X + pjitter, CONFIG.PLAYER_Y, null, ctx);

      // the log (or the two halves flying off)
      if (s.halves) {
        ML.drawSprite('log_half_l', s.halves.lx, s.halves.ly, null, ctx);
        ML.drawSprite('log_half_r', s.halves.rx, s.halves.ry, null, ctx);
      } else if (s.phase !== 'reset') {
        ML.drawSprite(s.bites > 0 ? 'log_cracked' : 'log_whole', CONFIG.LOG_X, CONFIG.LOG_Y, null, ctx);
      }

      ML.drawSprite('block', CONFIG.BLOCK_X, CONFIG.BLOCK_Y, null, ctx);

      // the axe
      drawAxe(ctx);

      ML.engine.drawParticles(ctx);

      for (var i = 0; i < s.pops.length; i++) {
        var pp = s.pops[i];
        if (pp.active) ML.font.drawTextShadowCentered(pp.text, pp.x, pp.y, pp.color, ctx);
      }
    }

    function drawAxe(ctx) {
      var ax = CONFIG.AXE_X, ay = CONFIG.AXE_Y;

      if (s.phase === 'power' || s.phase === 'strike' || s.phase === 'reset') {
        var wobble = Math.round(Math.sin(s.t * 7) * 1);
        ML.drawSprite('axe_up', ax, ay + wobble, null, ctx);

      } else if (s.phase === 'swing') {
        // overhead -> arcing across -> buried in the log, in a quarter second
        var k = ML.clamp(s.phaseT / CONFIG.SWING_TIME, 0, 1);
        if (k < 0.4) {
          ML.drawSprite('axe_up', ax, ay + k * 30, null, ctx);
        } else if (k < 0.72) {
          ML.drawSprite('axe_mid', ML.lerp(ax, CONFIG.AXE_HIT_X - 6, k), ay + 14 + k * 20, null, ctx);
        } else {
          ML.drawSprite('axe_hit', CONFIG.AXE_HIT_X, CONFIG.AXE_HIT_Y, null, ctx);
        }

      } else if (s.phase === 'stuck') {
        var j = (Math.floor(s.t * 24) % 2) ? 1 : 0;
        ML.drawSprite('axe_hit', CONFIG.AXE_HIT_X + j, CONFIG.AXE_HIT_Y + j, null, ctx);

      } else if (s.phase === 'react') {
        if (s.outcome === 'miss') {
          ML.drawSprite('axe_hit', CONFIG.AXE_HIT_X + 14, CONFIG.AXE_HIT_Y + 24, null, ctx); // into the grass
        } else if (s.outcome === 'bite') {
          ML.drawSprite('axe_hit', CONFIG.AXE_HIT_X, CONFIG.AXE_HIT_Y, null, ctx);
        } else {
          ML.drawSprite('axe_hit', CONFIG.AXE_HIT_X, CONFIG.AXE_HIT_Y + 12, null, ctx);      // straight through
        }
      }
    }

    // ---------------------------------------------------------------- scene
    return {
      key: 'chopping',
      name: TITLE.name,

      enter: function () {
        ML.engine.clearParticles();
      },

      exit: function () {
        ML.sfx.stopAllLoops();
      },

      update: function (dt) {
        s.t += dt;
        s.phaseT += dt;

        if (s.phase === 'title') {
          if (ML.ui.titleDone(s.phaseT)) {
            setPhase('power');
            ML.sfx.play('confirm');
          }
          return;
        }

        if (s.phase === 'result') {
          if (s.phaseT >= CONFIG.RESULT_TIME || ML.input.justPressed('enter')) {
            var avgPower = s.powerCount ? Math.round((s.powerSum / s.powerCount) * 100) : 0;
            ML.engine.replace(ML.ui.resultsScene({
              key: 'chopping',
              name: TITLE.name,
              score: s.finalScore,
              lines: [
                'LOGS SPLIT: ' + s.logsSplit + ' OF ' + CONFIG.TOTAL_SWINGS + ' SWINGS',
                'BEST COMBO: X' + s.maxCombo,
                'AVERAGE POWER: ' + avgPower + '%'
              ]
            }));
          }
          return;
        }

        updatePlay(dt);
      },

      draw: function (ctx) {
        drawScene(ctx);
        drawHud(ctx);

        // The bars and prompts only belong on screen while the event is live.
        var live = (s.phase !== 'title' && s.phase !== 'result');
        if (live) {
          drawPowerBar(ctx);
          drawStrikeBar(ctx);
          if (s.phase === 'power') {
            ML.font.drawTextShadowCentered('SPACE: LOCK POWER', 160, 172, P.CREAM, ctx);
          } else if (s.phase === 'strike') {
            ML.font.drawTextShadowCentered('SPACE: STRIKE', 160, 172, P.ACCENT, ctx);
          }
          if (s.message) {
            ML.font.drawTextWavyCentered(s.message, 160, 30, s.messageColor, s.t, 1.5, 0.7, ctx);
          }
        }

        if (s.phase === 'title') {
          ML.ui.drawTitleCard(TITLE, s.t, ctx);
        } else if (s.phase === 'result') {
          ML.ui.drawResultCard({
            name: TITLE.name,
            score: s.finalScore,
            lines: [
              'LOGS SPLIT: ' + s.logsSplit + ' OF ' + CONFIG.TOTAL_SWINGS,
              'BEST COMBO: X' + s.maxCombo
            ],
            footer: 'ENTER SKIPS'
          }, s.phaseT, ctx);
        }
      }
    };
  }

  return { scene: scene, CONFIG: CONFIG, name: TITLE.name, key: 'chopping' };
})();
