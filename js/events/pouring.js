/*
  ==========================================================================
  EVENT 1 - THE POUR (beer pouring and drinking)
  ==========================================================================

  Fine analog control, then frantic alternation. Three beers, each one harder
  than the last because he is getting drunk.

  EVERY BEER IS TWO PHASES

  POUR PHASE
    Hold SPACE to pour from the tap. LEFT and RIGHT tilt the glass between 0 and
    60 degrees. Tilting well means the beer runs down the inside of the glass and
    you get liquid; tilting badly means it splashes and you get FOAM.

    The catch: the right angle CHANGES as the glass fills. While the glass is
    under a third full you want it right over, around 45 degrees. As the level
    comes up you have to straighten it gradually towards vertical. The green
    zone on the gauge slides as you pour - follow it.

    Foam collapses back down when you stop pouring, but most of it is air, so it
    collapses to much less beer than it took to make. A sloppy pour cannot be
    fixed by waiting; you just end up short.

    Let it overflow and it goes all over the bar, which costs you.

    Stop pouring for a moment and the beer is judged: you want it about 90% full
    with a thin head on top.

  CHUG PHASE
    The glass comes up and you drink by ALTERNATING LEFT and RIGHT as fast as
    you can. Clean alternation drains it. Hitting the same key twice in a row,
    or hammering faster than a human swallows, and it goes down your chin: the
    drain stalls and you lose points. Fast alternation, not blind mashing.

  GETTING DRUNK
    Beer 1 is clean, no impairment.
    Beer 2 the room sways gently, the glass answers the controls a beat late,
      and it takes more alternations to drain.
    Beer 3 the sway gets worse, the glass drifts on its own so you have to keep
      correcting it, the ideal angle wanders a few degrees, and the window for
      alternating without spilling gets tighter.

    Note that nothing is ever inverted or randomised - that reads as a broken
    game rather than a funny one. Only drift, lag and sway.

  NO CLOCK. Three beers is three beers. How fast you CHUG is worth points (that
  is the event), but nothing is counting down at you while you pour.

  WHERE THE DIFFICULTY KNOBS ARE
    POUR_RATE ........... how fast beer comes out of the tap.
    FOAM_SPLIT .......... how much of a badly-angled pour froths up instead of
                          becoming beer. Bigger = harder.
    FOAM_EXPAND ......... how much room that froth takes up. Bigger = harder.
    TILT_TOLERANCE ...... how far off the ideal angle you can be and still be
                          pouring cleanly. Bigger = easier.
    SETTLE_RATE ......... how fast foam collapses when you stop pouring.
    FOAM_TO_LIQUID ...... how much beer you get back from collapsed foam.
                          Raise it towards 1 to make sloppy pours recoverable.
    TARGET_LIQUID/HEAD .. what a perfect glass looks like.
    CHUG_DRAIN .......... how much one clean alternation drains.
    CHUG_MIN_GAP ........ press faster than this and it counts as mashing.
    CHUG_PAR / CHUG_SLOW  the times that score full marks and zero.
    DRUNK ............... the whole escalation table, one row per beer.

  If it feels too hard, raise TILT_TOLERANCE and lower FOAM_SPLIT first.
*/
window.ML = window.ML || {};
ML.events = ML.events || {};

ML.events.pouring = (function () {
  var P = ML.palette;

  var CONFIG = {
    // ---- pacing
    TITLE_TIME: 3,
    RESULT_TIME: 3,
    TALLY_TIME: 2.0,         // the per-beer verdict card
    POUR_END_DELAY: 1.1,     // stop pouring this long and the glass is judged
    RAISE_TIME: 0.7,         // glass coming up to his mouth

    BEERS: 3,

    // ---- the pour
    POUR_RATE: 0.40,         // glass-fractions per second at full flow
    FOAM_SPLIT: 0.60,        // at the worst angle, this much of the pour froths
                             // up instead of becoming beer. Bigger = harsher.
    FOAM_EXPAND: 1.9,        // how much room that froth takes up vs the beer it
                             // came from. Bigger = the glass fills with nothing.
    SETTLE_RATE: 0.085,      // foam collapsing per second when not pouring
    FOAM_TO_LIQUID: 0.15,    // collapsing froth gives back only a fraction of the
                             // beer that made it. Raise it to forgive bad pours.
    TILT_MAX: 60,            // degrees
    TILT_SPEED: 62,          // degrees per second of input
    IDEAL_HIGH: 45,          // ideal angle while the glass is nearly empty
    IDEAL_LOW: 12,           // ideal angle once it is full (never 0 - holding it
                             // dead upright must never be a winning strategy)
    IDEAL_SHIFT_AT: 0.33,    // level where the ideal starts straightening up
    TILT_TOLERANCE: 16,      // degrees either side of ideal that still pours clean
    /*
       There is exactly this much beer in the tap per glass, counting everything
       that comes out of it - beer, foam and anything you slop over the side.
       A clean glass costs about 1.0, so there is slack for a wobble but not for
       a disaster. Waste it on foam and the tap runs dry with the glass short,
       which is the whole point of the foam mechanic. It also guarantees the
       pour phase always ends.
    */
    POUR_ALLOWANCE: 1.2,
    TARGET_LIQUID: 0.90,
    TARGET_HEAD: 0.08,
    LIQUID_SLACK: 0.34,      // how far off TARGET_LIQUID before it scores zero
    HEAD_SLACK: 0.17,
    OVERFLOW_COST: 1.1,      // score cost per glass-fraction spilled on the bar

    // ---- the chug
    CHUG_DRAIN: 0.085,       // drained per clean alternation
    CHUG_MIN_GAP: 0.055,     // presses closer together than this = mashing
    CHUG_SPILL_STALL: 0.40,  // drain stalls this long after a spill
    CHUG_SPILL_COST: 0.055,  // quality lost per spill
    CHUG_GIVE_UP: 10,        // spill this many times and he abandons the glass
                             // (also guarantees the chug phase always ends)
    CHUG_PAR: 2.6,           // drain it this fast for full marks
    CHUG_SLOW: 8.0,          // take this long and the chug scores nothing

    // ---- score out of 1000
    SCORE_PER_BEER: 333,
    POUR_WEIGHT: 0.6,
    CHUG_WEIGHT: 0.4,

    /*
       ---- the escalation table. One row per beer.
       sway         how far the room drifts, in pixels
       swaySpeed    how fast it sways
       tiltLag      how far behind your input the glass runs (seconds-ish)
       tiltDrift    degrees per second the glass wanders on its own
       idealWander  degrees the ideal angle drifts around by
       chugGapMin   the mashing threshold for this beer (tighter = harder)
       drainMul     how much of a normal drain each alternation gives
    */
    DRUNK: [
      { sway: 0.0, swaySpeed: 0.0, tiltLag: 0.00, tiltDrift: 0, idealWander: 0, chugGapMin: 0.055, drainMul: 1.00 },
      { sway: 2.5, swaySpeed: 0.9, tiltLag: 0.20, tiltDrift: 0, idealWander: 0, chugGapMin: 0.078, drainMul: 0.78 },
      { sway: 5.0, swaySpeed: 1.3, tiltLag: 0.32, tiltDrift: 16, idealWander: 10, chugGapMin: 0.098, drainMul: 0.60 }
    ],

    // ---- layout
    GLASS_X: 160, GLASS_Y: 140,     // where the base of the glass sits
    CHUG_RISE: 26,                  // how far it comes up to his mouth
    TAP_X: 160, TAP_Y: 48,
    COUNTER_Y: 140,
    PLAYER_X: 58, PLAYER_Y: 108,
    GAUGE: { x: 94, y: 16, w: 132, h: 9 },
    POP_TIME: 0.9
  };

  var TITLE = {
    number: 1,
    name: 'THE POUR',
    joke: [
      'RULE 1: THE HEAD IS NOT A MISTAKE.',
      'A HEAD THAT SIZE IS, THOUGH.'
    ],
    controls: [
      'HOLD SPACE TO POUR.  ARROWS TILT.',
      'THEN ALTERNATE LEFT AND RIGHT TO DRINK.'
    ]
  };

  // =========================================================== glass geometry
  /*
     The glass is baked at nine tilt angles. For each one we work out, row by
     row, which pixels are inside the glass. Filling it then means filling whole
     rows from the bottom up until we have used the right number of pixels -
     which makes the beer surface stay LEVEL while the glass leans over, exactly
     as it should, and keeps everything on the pixel grid.
  */
  var POSES = [];
  var POSE_COUNT = 9;
  var GW = 56, GH = 44, BX = 17, BY = 42;   // sprite size and where the base sits
  var GLASS_H = 31, GLASS_HALF_BOT = 8, GLASS_HALF_TOP = 10, WALL = 2;

  function buildPose(deg) {
    var th = deg * Math.PI / 180;
    var cos = Math.cos(th), sin = Math.sin(th);
    var g = ML.sprites.grid(GW, GH);
    var spans = [];

    for (var gy = 0; gy < GH; gy++) {
      var x0 = -1, x1 = -1;
      for (var gx = 0; gx < GW; gx++) {
        var wx = gx - BX, wy = BY - gy;              // world offset from the base
        var lx = wx * cos - wy * sin;                // rotate back into glass space
        var ly = wx * sin + wy * cos;
        if (ly < 0 || ly > GLASS_H) continue;
        var half = GLASS_HALF_BOT + (GLASS_HALF_TOP - GLASS_HALF_BOT) * (ly / GLASS_H);
        var ax = Math.abs(lx);
        if (ax > half) continue;
        var inside = (ax < half - WALL) && (ly > WALL) && (ly < GLASS_H);
        if (inside) {
          if (x0 < 0) x0 = gx;
          x1 = gx;
        } else {
          g[gy][gx] = '3';                            // the glass itself
        }
      }
      if (x0 >= 0) spans.push({ y: gy, x0: x0, x1: x1, n: x1 - x0 + 1 });
    }

    var total = 0;
    for (var i = 0; i < spans.length; i++) total += spans[i].n;
    // bottom-up, so filling walks the array in order
    spans.sort(function (a, b) { return b.y - a.y; });
    return { deg: deg, rows: ML.sprites.strings(g), spans: spans, total: total };
  }

  var spritesReady = false;
  function ensureSprites() {
    if (spritesReady) return;
    for (var i = 0; i < POSE_COUNT; i++) {
      var deg = (CONFIG.TILT_MAX * i) / (POSE_COUNT - 1);
      var pose = buildPose(deg);
      pose.idx = i;
      ML.sprites.add('bp_glass' + i, pose.rows);
      POSES.push(pose);
    }
    ML.sprites.add('bp_tap', makeTap());
    ML.sprites.add('bp_counter', makeCounter(320, 40));
    spritesReady = true;
  }

  function makeTap() {
    var g = ML.sprites.grid(22, 46);
    ML.sprites.rect(g, 8, 0, 6, 30, '2');        // the column
    ML.sprites.rect(g, 9, 0, 2, 30, '3');
    ML.sprites.rect(g, 4, 6, 14, 5, '2');        // the handle block
    ML.sprites.rect(g, 0, 2, 6, 6, 'd');         // the handle itself
    ML.sprites.rect(g, 7, 30, 8, 8, '2');        // the spout
    ML.sprites.rect(g, 9, 38, 4, 4, '3');
    ML.sprites.outline(g);
    return ML.sprites.strings(g);
  }

  function makeCounter(w, h) {
    var g = ML.sprites.grid(w, h);
    ML.sprites.rect(g, 0, 0, w, 3, 'b');          // polished top
    ML.sprites.rect(g, 0, 3, w, h - 3, 'a');
    for (var x = 0; x < w; x += 23) ML.sprites.rect(g, x, 4, 1, h - 4, '9');
    ML.sprites.rect(g, 0, h - 4, w, 4, '9');
    return ML.sprites.strings(g);
  }

  function poseFor(angle) {
    var i = Math.round((angle / CONFIG.TILT_MAX) * (POSE_COUNT - 1));
    return POSES[ML.clamp(i, 0, POSE_COUNT - 1)];
  }

  // ================================================================== scoring
  function idealAngle(level, wander) {
    var t = ML.clamp((level - CONFIG.IDEAL_SHIFT_AT) / (1 - CONFIG.IDEAL_SHIFT_AT), 0, 1);
    return ML.lerp(CONFIG.IDEAL_HIGH, CONFIG.IDEAL_LOW, t) + (wander || 0);
  }

  function tiltQuality(angle, level, wander) {
    var off = Math.abs(angle - idealAngle(level, wander));
    return ML.clamp(1 - off / CONFIG.TILT_TOLERANCE, 0, 1);
  }

  function pourQuality(liquid, foam, spilled) {
    var lq = ML.clamp(1 - Math.abs(liquid - CONFIG.TARGET_LIQUID) / CONFIG.LIQUID_SLACK, 0, 1);
    var hq = ML.clamp(1 - Math.abs(foam - CONFIG.TARGET_HEAD) / CONFIG.HEAD_SLACK, 0, 1);
    return ML.clamp(lq * 0.7 + hq * 0.3 - spilled * CONFIG.OVERFLOW_COST, 0, 1);
  }

  function chugQuality(seconds, spills) {
    var q = ML.clamp(1 - (seconds - CONFIG.CHUG_PAR) / (CONFIG.CHUG_SLOW - CONFIG.CHUG_PAR), 0, 1);
    return ML.clamp(q - spills * CONFIG.CHUG_SPILL_COST, 0, 1);
  }

  // ==================================================================== scene
  function scene(opts) {
    opts = opts || {};
    ensureSprites();

    var s = {
      phase: 'title',       // title | pour | raise | chug | tally | result
      phaseT: 0,
      t: 0,

      beer: 0,              // 0..2
      liquid: 0, foam: 0, spilled: 0, dispensed: 0,
      angle: 0,             // what the glass is actually doing
      angleWanted: 0,       // what the player has asked for
      notPouring: 0,
      pouring: false,
      wander: 0,

      chugT: 0, chugSpills: 0, lastKey: null, lastPressT: -99, stall: 0,
      chinT: 0,
      judgedPour: 0,        // the pour grade, locked in when the glass comes up
      judgedPourBeer: -1,

      beerScores: [],       // {pour, chug, total}
      lastVerdict: null,
      finalScore: 0,
      pops: []
    };

    for (var i = 0; i < 5; i++) s.pops.push({ active: false, x: 0, y: 0, life: 0, text: '', color: P.CREAM });

    function drunk() { return CONFIG.DRUNK[ML.clamp(s.beer, 0, CONFIG.DRUNK.length - 1)]; }

    function pop(text, color, x, y) {
      var slot = null;
      for (var i = 0; i < s.pops.length; i++) if (!s.pops[i].active) { slot = s.pops[i]; break; }
      if (!slot) slot = s.pops[0];
      slot.active = true; slot.x = x; slot.y = y;
      slot.life = CONFIG.POP_TIME; slot.text = text; slot.color = color;
    }

    function setPhase(p) { s.phase = p; s.phaseT = 0; }

    function startBeer() {
      s.liquid = 0; s.foam = 0; s.spilled = 0; s.dispensed = 0;
      s.angle = 0; s.angleWanted = 0; s.notPouring = 0; s.pouring = false;
      s.chugT = 0; s.chugSpills = 0; s.lastKey = null; s.lastPressT = -99; s.stall = 0;
      setPhase('pour');
    }

    // ------------------------------------------------------------ pour phase
    function updatePour(dt) {
      var d = drunk();

      // the ideal angle wanders a few degrees once he is properly drunk
      if (d.idealWander > 0) {
        s.wander = (Math.sin(s.t * 0.7) * 0.6 + Math.sin(s.t * 1.9 + 1.3) * 0.4) * d.idealWander;
      } else s.wander = 0;

      // --- tilt input
      var dir = 0;
      if (ML.input.isDown('left')) dir -= 1;
      if (ML.input.isDown('right')) dir += 1;
      s.angleWanted = ML.clamp(s.angleWanted + dir * CONFIG.TILT_SPEED * dt, 0, CONFIG.TILT_MAX);

      // he cannot hold it steady any more: it drifts back towards upright
      if (d.tiltDrift > 0) {
        s.angleWanted = ML.clamp(s.angleWanted - d.tiltDrift * dt * Math.sin(s.t * 0.9 + 2), 0, CONFIG.TILT_MAX);
      }

      // and the glass answers late
      if (d.tiltLag > 0) {
        s.angle += (s.angleWanted - s.angle) * ML.clamp(dt / d.tiltLag, 0, 1);
      } else {
        s.angle = s.angleWanted;
      }

      // --- pouring (only while there is beer left in the tap)
      var dry = s.dispensed >= CONFIG.POUR_ALLOWANCE;
      s.pouring = ML.input.isDown('space') && !dry;
      if (s.pouring) {
        s.notPouring = 0;
        var q = tiltQuality(s.angle, s.liquid + s.foam, s.wander);
        var poured = Math.min(CONFIG.POUR_RATE * dt, CONFIG.POUR_ALLOWANCE - s.dispensed);
        s.dispensed += poured;
        /*
           The beer coming out of the tap is SPLIT between beer and froth - what
           foams up is beer you do not get. (Adding foam on top of full liquid
           would mean a bad pour costs you nothing but tidiness.) And foam takes
           up far more room than the beer it came from, so it fills the glass
           without filling the glass.
        */
        var toFoam = poured * (1 - q) * CONFIG.FOAM_SPLIT;
        s.liquid += poured - toFoam;
        s.foam += toFoam * CONFIG.FOAM_EXPAND;
        if (s.dispensed >= CONFIG.POUR_ALLOWANCE) {
          ML.sfx.play('back');
          pop('TAP IS DRY', P.ORANGE, CONFIG.GLASS_X, CONFIG.GLASS_Y - 56);
        }

        if (Math.random() < 0.5) {
          ML.engine.spawn({
            x: CONFIG.TAP_X + ML.rand(-2, 2), y: CONFIG.GLASS_Y - 30,
            vx: ML.rand(-8, 8), vy: ML.rand(10, 30),
            life: 0.3, color: P.AMBER, size: 1
          });
        }
      } else {
        s.notPouring += dt;
        // foam collapses - but most of it was air, so you get little back
        if (s.foam > 0) {
          var settled = Math.min(s.foam, CONFIG.SETTLE_RATE * dt);
          s.foam -= settled;
          s.liquid += settled * CONFIG.FOAM_TO_LIQUID;
        }
      }

      // --- overflow
      var total = s.liquid + s.foam;
      if (total > 1) {
        var over = total - 1;
        s.spilled += over;
        // take it off the foam first, that is what is on top
        var fromFoam = Math.min(s.foam, over);
        s.foam -= fromFoam;
        s.liquid -= (over - fromFoam);
        ML.engine.spawn({
          x: CONFIG.GLASS_X + ML.rand(-10, 10), y: CONFIG.GLASS_Y - 30,
          vx: ML.rand(-25, 25), vy: ML.rand(0, 20),
          life: 0.7, color: Math.random() < 0.5 ? P.CREAM : P.AMBER,
          size: 1, grav: 160
        });
      }

      // --- judged once he stops pouring
      if (!s.pouring && s.notPouring >= CONFIG.POUR_END_DELAY && (s.liquid + s.foam) > 0.05) {
        ML.sfx.play('fizz');
        setPhase('raise');
      }
    }

    // ------------------------------------------------------------ chug phase
    function updateChug(dt) {
      var d = drunk();
      s.chugT += dt;
      if (s.stall > 0) s.stall -= dt;
      if (s.chinT > 0) s.chinT -= dt;

      var hitL = ML.input.justPressed('left');
      var hitR = ML.input.justPressed('right');
      if (!hitL && !hitR) return;

      var key = hitL ? 'left' : 'right';
      var gap = s.t - s.lastPressT;

      // same key twice, or hammering faster than a man can swallow
      if (key === s.lastKey || gap < d.chugGapMin) {
        s.chugSpills++;
        s.stall = CONFIG.CHUG_SPILL_STALL;
        s.chinT = 0.45;
        ML.sfx.play('crowd_groan');
        pop(key === s.lastKey ? 'SAME KEY!' : 'TOO FAST!', P.ORANGE,
            CONFIG.GLASS_X, CONFIG.GLASS_Y - 56);
        ML.engine.burst(CONFIG.GLASS_X, CONFIG.GLASS_Y - 40, 8, {
          colors: [P.AMBER, P.CREAM], speedMin: 20, speedMax: 60,
          life: 0.6, grav: 220, spread: 1.6, dir: Math.PI / 2, size: 1
        });
        // enough is enough - he puts it down
        if (s.chugSpills >= CONFIG.CHUG_GIVE_UP) {
          pop('HE GIVES UP', P.ORANGE, CONFIG.GLASS_X, CONFIG.GLASS_Y - 68);
          finishBeer();
          return;
        }
      } else if (s.stall <= 0) {
        s.liquid = Math.max(0, s.liquid - CONFIG.CHUG_DRAIN * d.drainMul);
        ML.sfx.play('pour');
      }

      s.lastKey = key;
      s.lastPressT = s.t;

      if (s.liquid <= 0.001) {
        s.liquid = 0;
        finishBeer();
      }
    }

    function finishBeer() {
      // the pour was graded when he picked the glass up, before a drop was drunk
      var pq = s.judgedPour;
      var cq = chugQuality(s.chugT, s.chugSpills);
      var total = Math.round(CONFIG.SCORE_PER_BEER * (pq * CONFIG.POUR_WEIGHT + cq * CONFIG.CHUG_WEIGHT));
      s.beerScores.push({ pour: pq, chug: cq, total: total, secs: s.chugT, spills: s.chugSpills });
      s.lastVerdict = { pour: pq, chug: cq, total: total };
      ML.sfx.play(total > CONFIG.SCORE_PER_BEER * 0.6 ? 'crowd_cheer' : 'crowd_groan');
      setPhase('tally');
    }

    function computeScore() {
      var t = 0;
      for (var i = 0; i < s.beerScores.length; i++) t += s.beerScores[i].total;
      return Math.round(ML.clamp(t, 0, 1000));
    }

    // ================================================================ drawing
    function sway() {
      var d = drunk();
      if (!d.sway) return { x: 0, y: 0 };
      return {
        x: Math.sin(s.t * d.swaySpeed) * d.sway,
        y: Math.sin(s.t * d.swaySpeed * 0.6 + 1.1) * d.sway * 0.35
      };
    }

    function glassScreenY() {
      if (s.phase === 'raise') {
        return CONFIG.GLASS_Y - CONFIG.CHUG_RISE * ML.clamp(s.phaseT / CONFIG.RAISE_TIME, 0, 1);
      }
      if (s.phase === 'chug' || s.phase === 'tally') return CONFIG.GLASS_Y - CONFIG.CHUG_RISE;
      return CONFIG.GLASS_Y;
    }

    // Fill the glass by whole rows from the bottom up, so the surface of the
    // beer stays level even when the glass is leaning.
    function drawContents(ctx, pose, ox, oy) {
      var liquidPx = Math.round(pose.total * ML.clamp(s.liquid, 0, 1));
      var foamPx = Math.round(pose.total * ML.clamp(s.foam, 0, 1));
      var used = 0, i;

      for (i = 0; i < pose.spans.length && liquidPx > 0; i++) {
        var sp = pose.spans[i];
        if (liquidPx >= sp.n) {
          ML.engine.rect(ox + sp.x0, oy + sp.y, sp.n, 1, P.AMBER, ctx);
          liquidPx -= sp.n; used = i + 1;
        } else break;
      }
      for (var j = used; j < pose.spans.length && foamPx > 0; j++) {
        var fs = pose.spans[j];
        if (foamPx >= fs.n) {
          ML.engine.rect(ox + fs.x0, oy + fs.y, fs.n, 1, P.CREAM, ctx);
          foamPx -= fs.n;
        } else break;
      }
    }

    function drawGauge(ctx) {
      var g = CONFIG.GAUGE;
      ML.engine.rect(g.x - 2, g.y - 2, g.w + 4, g.h + 4, P.INK, ctx);
      ML.engine.rect(g.x, g.y, g.w, g.h, P.CHARCOAL, ctx);

      // the zone you want to be in, which slides as the glass fills
      var ideal = idealAngle(s.liquid + s.foam, s.wander);
      var zx = g.x + (ideal - CONFIG.TILT_TOLERANCE) / CONFIG.TILT_MAX * g.w;
      var zw = (CONFIG.TILT_TOLERANCE * 2) / CONFIG.TILT_MAX * g.w;
      zx = Math.max(g.x, zx);
      if (zx + zw > g.x + g.w) zw = g.x + g.w - zx;
      ML.engine.rect(zx, g.y, zw, g.h, P.GRASS_DARK, ctx);

      var cw = Math.max(3, (CONFIG.TILT_TOLERANCE * 0.5) / CONFIG.TILT_MAX * g.w);
      var cx = g.x + (ideal / CONFIG.TILT_MAX) * g.w - cw / 2;
      ML.engine.rect(ML.clamp(cx, g.x, g.x + g.w - cw), g.y, cw, g.h, P.GRASS, ctx);

      // where the glass actually is
      var mx = g.x + (s.angle / CONFIG.TILT_MAX) * g.w;
      ML.engine.rect(ML.clamp(mx - 1, g.x, g.x + g.w - 2), g.y - 3, 2, g.h + 6, P.ACCENT, ctx);

      ML.engine.frameRect(g.x, g.y, g.w, g.h, P.CREAM, ctx);
      ML.font.drawTextShadow('TILT', g.x - 32, g.y + 1, P.STEEL, ctx);
    }

    // How much beer is left in the tap for this glass. Not a hidden rule -
    // you can watch it run out.
    function drawTapLevel(ctx) {
      var left = ML.clamp(1 - s.dispensed / CONFIG.POUR_ALLOWANCE, 0, 1);
      var x = CONFIG.TAP_X + 16, y = CONFIG.TAP_Y + 2, h = 38;
      ML.engine.rect(x - 1, y - 1, 6, h + 2, P.INK, ctx);
      ML.engine.rect(x, y, 4, h, P.CHARCOAL, ctx);
      var fh = Math.round(h * left);
      ML.engine.rect(x, y + h - fh, 4, fh, left < 0.25 ? P.ORANGE : P.AMBER, ctx);
      ML.engine.frameRect(x, y, 4, h, P.STEEL, ctx);
    }

    function drawHud(ctx) {
      ML.engine.rect(0, 0, 320, 12, P.INK, ctx);
      ML.engine.rect(0, 12, 320, 1, P.CHARCOAL, ctx);
      ML.font.drawText('BEER ' + (s.beer + 1) + ' OF ' + CONFIG.BEERS, 6, 3, P.CREAM, ctx);
      var d = drunk();
      if (d.sway > 0) {
        ML.font.drawText(s.beer === 1 ? 'FEELING IT' : 'QUITE DRUNK', 226, 3,
          s.beer === 2 ? P.ORANGE : P.AMBER, ctx);
      }
    }

    function drawScene(ctx) {
      var sw = sway();
      ctx.save();
      ctx.translate(Math.round(sw.x), Math.round(sw.y));

      // --- the bar
      ML.engine.rect(0, 0, 320, CONFIG.COUNTER_Y, P.CHARCOAL, ctx);
      ML.engine.rect(0, 0, 320, 30, P.INK, ctx);
      for (var b = 20; b < 320; b += 37) {                    // bottles on the back shelf
        ML.engine.rect(b, 44, 5, 16, (b % 74 === 20) ? P.WOOD_DARK : P.GRASS_DARK, ctx);
        ML.engine.rect(b + 1, 40, 3, 5, P.WOOD_DARK, ctx);
      }
      ML.engine.rect(0, 62, 320, 2, P.WOOD_DARK, ctx);
      ML.drawSprite('bp_counter', 0, CONFIG.COUNTER_Y, null, ctx);

      // --- him
      var pose = (s.phase === 'chug') ? 'player_strain'
        : (s.phase === 'tally' ? 'player_win' : 'player_idle' + (Math.floor(s.t * 3) % 2));
      ML.drawSprite(pose, CONFIG.PLAYER_X, CONFIG.PLAYER_Y, null, ctx);

      // --- tap
      ML.drawSprite('bp_tap', CONFIG.TAP_X - 11, CONFIG.TAP_Y, null, ctx);

      // --- the stream
      if (s.pouring && s.phase === 'pour') {
        var top = CONFIG.TAP_Y + 42;
        var rimY = glassScreenY() - Math.round(GLASS_H * Math.cos(s.angle * Math.PI / 180));
        ML.engine.rect(CONFIG.TAP_X - 1, top, 2, Math.max(0, rimY - top), P.AMBER, ctx);
      }

      // --- glass and contents
      // Tilting swings the rim sideways, so slide the glass to keep the rim
      // under the tap - which is what a person actually does.
      var gp = poseFor(s.angle);
      var rimShift = Math.round(GLASS_H * Math.sin(s.angle * Math.PI / 180));
      var gx = CONFIG.GLASS_X - BX - rimShift, gy = glassScreenY() - BY;
      drawContents(ctx, gp, gx, gy);
      ML.drawSprite('bp_glass' + gp.idx, gx, gy, null, ctx);

      // --- beer down the chin
      if (s.chinT > 0) {
        ML.engine.rect(CONFIG.GLASS_X - 3, glassScreenY() - 18, 2, 14, P.AMBER, ctx);
        ML.engine.rect(CONFIG.GLASS_X + 3, glassScreenY() - 14, 2, 10, P.AMBER, ctx);
      }

      ML.engine.drawParticles(ctx);
      ctx.restore();
    }

    function drawChugPrompt(ctx) {
      var next = (s.lastKey === 'left') ? 'RIGHT' : (s.lastKey === 'right' ? 'LEFT' : 'EITHER');
      ML.font.drawTextShadowCentered('ALTERNATE  LEFT - RIGHT', 160, 152, P.CREAM, ctx);
      var c = s.stall > 0 ? P.ORANGE : P.ACCENT;
      ML.font.drawTextShadowCentered(s.stall > 0 ? 'DOWN YOUR CHIN' : 'NEXT: ' + next, 160, 164, c, ctx);
    }

    function drawTally(ctx) {
      var v = s.lastVerdict;
      if (!v) return;
      ML.ui.dither(ctx, 40, 44, 240, 84);
      ML.engine.rect(42, 46, 236, 80, P.CHARCOAL, ctx);
      ML.engine.frameRect(42, 46, 236, 80, P.CREAM, ctx);
      ML.font.drawTextCentered('BEER ' + (s.beer + 1), 160, 52, P.AMBER, ctx);
      ML.font.drawTextCentered('POUR  ' + Math.round(v.pour * 100) + '%', 160, 68, P.CREAM, ctx);
      ML.font.drawTextCentered('CHUG  ' + Math.round(v.chug * 100) + '%', 160, 80, P.CREAM, ctx);
      ML.ui.bigText('+' + v.total, 160, 94, P.ACCENT, 2, ctx);
    }

    // =================================================================== API
    return {
      key: 'pouring',
      name: TITLE.name,

      enter: function () { ML.engine.clearParticles(); },
      exit: function () { ML.sfx.stopAllLoops(); },

      update: function (dt) {
        s.t += dt;
        s.phaseT += dt;

        for (var i = 0; i < s.pops.length; i++) {
          var pp = s.pops[i];
          if (!pp.active) continue;
          pp.life -= dt; pp.y -= 16 * dt;
          if (pp.life <= 0) pp.active = false;
        }

        if (s.phase === 'title') {
          if (s.phaseT >= CONFIG.TITLE_TIME || ML.input.justPressed('enter')) {
            ML.sfx.play('confirm');
            startBeer();
          }
          return;
        }

        if (s.phase === 'result') {
          if (s.phaseT >= CONFIG.RESULT_TIME || ML.input.justPressed('enter')) {
            var best = 0, spills = 0;
            for (var b = 0; b < s.beerScores.length; b++) {
              best += s.beerScores[b].pour; spills += s.beerScores[b].spills;
            }
            ML.engine.replace(ML.ui.resultsScene({
              key: 'pouring',
              name: TITLE.name,
              score: s.finalScore,
              lines: [
                'AVERAGE POUR: ' + Math.round(best / Math.max(1, s.beerScores.length) * 100) + '%',
                'SPILLED DOWN THE CHIN: ' + spills
              ]
            }));
          }
          return;
        }

        if (ML.input.justPressed('escape')) { ML.engine.push(ML.ui.pauseScene()); return; }

        switch (s.phase) {
          case 'pour':
            updatePour(dt);
            break;

          case 'raise':
            // lock in what the pour was worth before a drop is drunk
            if (s.judgedPourBeer !== s.beer) {
              s.judgedPour = pourQuality(s.liquid, s.foam, s.spilled);
              s.judgedPourBeer = s.beer;
            }
            if (s.phaseT >= CONFIG.RAISE_TIME) { s.chugT = 0; setPhase('chug'); }
            break;

          case 'chug':
            updateChug(dt);
            break;

          case 'tally':
            if (s.phaseT >= CONFIG.TALLY_TIME) {
              s.beer++;
              if (s.beer >= CONFIG.BEERS) {
                s.finalScore = computeScore();
                setPhase('result');
                ML.sfx.play('fanfare');
              } else {
                startBeer();
              }
            }
            break;
        }
      },

      draw: function (ctx) {
        drawScene(ctx);
        drawHud(ctx);

        if (s.phase === 'pour') {
          drawGauge(ctx);
          drawTapLevel(ctx);
          ML.font.drawTextShadowCentered(
            s.pouring ? 'POURING' : 'HOLD SPACE TO POUR', 160, 152,
            s.pouring ? P.AMBER : P.CREAM, ctx);
          if (!s.pouring && (s.liquid + s.foam) > 0.05) {
            var left = CONFIG.POUR_END_DELAY - s.notPouring;
            ML.font.drawTextShadowCentered('LETTING IT SETTLE...', 160, 164, P.STEEL, ctx);
            ML.engine.rect(120, 172, Math.round(80 * ML.clamp(left / CONFIG.POUR_END_DELAY, 0, 1)), 2, P.STEEL, ctx);
          }
        } else if (s.phase === 'chug') {
          drawChugPrompt(ctx);
        }

        for (var j = 0; j < s.pops.length; j++) {
          var pp = s.pops[j];
          if (pp.active) ML.font.drawTextShadowCentered(pp.text, pp.x, pp.y, pp.color, ctx);
        }

        if (s.phase === 'tally') drawTally(ctx);

        if (s.phase === 'title') {
          TITLE.remaining = CONFIG.TITLE_TIME - s.phaseT;
          ML.ui.drawTitleCard(TITLE, s.t, ctx);
        } else if (s.phase === 'result') {
          ML.ui.drawResultCard({
            name: TITLE.name,
            score: s.finalScore,
            lines: ['THREE BEERS. ONE MAN.'],
            footer: 'ENTER SKIPS'
          }, s.phaseT, ctx);
        }
      }
    };
  }

  return { scene: scene, CONFIG: CONFIG, name: TITLE.name, key: 'pouring' };
})();
