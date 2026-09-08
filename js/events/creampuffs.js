/*
  ==========================================================================
  EVENT 7 - CHOUX BUSINESS (cream puffs)
  ==========================================================================

  Precision and restraint. Two rounds over the same twelve puffs.

  ROUND ONE - PIPING
    A piping bag hovers over a tray of twelve marked spots. HOLD SPACE to pipe;
    the mound grows while you hold it. Let go to finish that one and move on.

    The target size is shown as a ghost outline for two seconds at the start and
    then it is gone. You are not scored on hitting it, though - you are scored
    on whether all twelve MATCH EACH OTHER.

    TWELVE IDENTICAL PUFFS OF THE WRONG SIZE BEAT TWELVE INCONSISTENT ONES
    SITTING ON THE TARGET. That is stated on the title card too, because
    discovering it afterwards would feel like a swindle.

    The puffs you have already piped stay on the tray, so you can eye the next
    one against its neighbours. That is the intended way to play it.

  ROUND TWO - FILLING
    A nozzle slides back and forth over each puff. Press SPACE to stick it in -
    how close to the middle you were counts - and HOLD to pump the cream in.
    Let go when it is full. Hold too long and it bursts, and a burst puff is
    worth nothing.

  NO CLOCK AT ALL. This one never had one in the brief either. (There is a
  long idle bail-out on each puff purely so the event cannot hang for ever if
  nobody touches the keyboard - it is not a timer you can lose to.)

  WHERE THE DIFFICULTY KNOBS ARE
    PIPE_RATE .......... how fast the mound grows. Slower = easier to control.
    SD_ZERO ............ the spread of sizes at which consistency scores zero.
                         Bigger = more forgiving.
    ACC_ZERO ........... how far the average can be off target before accuracy
                         scores zero.
    GHOST_TIME ......... how long you get to look at the target.
    NOZZLE_SPEED ....... how fast the filling nozzle sweeps. Slower = easier.
    FILL_RATE / BURST_AT how quickly cream goes in and when it lets go.
    CONSISTENCY_WEIGHT / ACCURACY_WEIGHT ... the brief's 70/30 split.
    PIPE_POINTS / FILL_POINTS ... how the two rounds divide the 1000.

  If it feels too hard, raise SD_ZERO and lower PIPE_RATE first.
*/
window.ML = window.ML || {};
ML.events = ML.events || {};

ML.events.creampuffs = (function () {
  var P = ML.palette;

  var CONFIG = {
    // ---- pacing
    TITLE_TIME: 3,
    RESULT_TIME: 3,
    GHOST_TIME: 2.0,         // how long the target outline is up for
    ROUND_CARD: 2.0,         // the beat between piping and filling
    SETTLE: 0.28,            // pause after each puff before the next
    IDLE_BAIL: 12,           // safety only: a puff nobody touches moves on

    // ---- the tray
    PUFFS: 12, COLS: 6, ROWS: 2,
    COL_X: [58, 98, 138, 178, 218, 258],
    ROW_Y: [86, 126],

    // ---- piping
    PIPE_RATE: 0.55,         // size units per second while held
    TARGET_SIZE: 0.62,       // where the ghost outline sits
    MAX_SIZE: 1.0,           // past this it has spread everywhere
    SD_ZERO: 0.22,           // spread of sizes at which consistency scores zero
    ACC_ZERO: 0.34,          // how far off target before accuracy scores zero

    // ---- filling
    NOZZLE_SPEED: 1.45,      // sweeps per second
    NOZZLE_RANGE: 26,        // how far either side of the puff it travels
    FILL_RATE: 0.95,         // fill units per second
    BURST_AT: 1.28,          // hold past this and it goes everywhere
    PLACE_ZERO: 20,          // pixels off centre at which placement scores zero

    // ---- score out of 1000
    PIPE_POINTS: 600,
    FILL_POINTS: 400,
    CONSISTENCY_WEIGHT: 0.7, // the brief's split, inside the piping score
    ACCURACY_WEIGHT: 0.3
  };

  var TITLE = {
    number: 7,
    name: 'CHOUX BUSINESS',
    joke: [
      'JUDGED ON MATCHING, NOT ON SIZE.',
      'TWELVE IDENTICAL WRONG ONES BEAT TWELVE MESSY RIGHT ONES.'
    ],
    controls: [
      'HOLD SPACE TO PIPE.  LET GO TO STOP.',
      'THE TARGET SHOWS FOR TWO SECONDS ONLY.'
    ]
  };

  // ================================================================= sprites
  var SIZE_STEPS = 18;
  var PUFF_MAX_R = 15;
  var PW = 38, PC = 19;
  var spritesReady = false;

  function makePuff(step, filled) {
    var g = ML.sprites.grid(PW, PW);
    var r = 2 + (PUFF_MAX_R - 2) * (step / (SIZE_STEPS - 1));
    if (r < 1.2) return ML.sprites.strings(g);
    // a squat mound rather than a ball - it is sitting on a tray
    var ry = r * 0.78;
    for (var y = 0; y < PW; y++) {
      for (var x = 0; x < PW; x++) {
        var dx = (x - PC) / r, dy = (y - PC) / ry;
        var d = dx * dx + dy * dy;
        if (d > 1) continue;
        var c = 'b';                                   // choux
        if (d < 0.34 && dy < 0) c = '4';               // the shine on top
        else if (dy > 0.45) c = 'a';                   // shadow underneath
        if (filled && d < 0.2) c = '4';                // cream showing through
        g[y][x] = c;
      }
    }
    ML.sprites.outline(g);
    return ML.sprites.strings(g);
  }

  function makeBurst() {
    var g = ML.sprites.grid(PW, PW);
    ML.sprites.ellipse(g, PC, PC + 2, 15, 6, '4');
    ML.sprites.ellipse(g, PC - 7, PC + 3, 5, 3, 'b');
    ML.sprites.ellipse(g, PC + 8, PC + 2, 4, 3, 'b');
    ML.sprites.rect(g, PC - 3, PC - 3, 7, 4, 'a');
    ML.sprites.outline(g);
    return ML.sprites.strings(g);
  }

  function makeBag() {
    var g = ML.sprites.grid(16, 24);
    ML.sprites.rect(g, 2, 0, 12, 12, '4');            // the bag
    ML.sprites.rect(g, 3, 1, 4, 9, '3');              // highlight
    ML.sprites.rect(g, 5, 12, 6, 5, '2');             // collar
    ML.sprites.rect(g, 6, 17, 4, 5, '3');             // nozzle
    ML.sprites.outline(g);
    return ML.sprites.strings(g);
  }

  function makeNozzle() {
    var g = ML.sprites.grid(10, 18);
    ML.sprites.rect(g, 2, 0, 6, 10, '2');
    ML.sprites.rect(g, 3, 1, 2, 8, '3');
    ML.sprites.rect(g, 4, 10, 2, 8, '3');
    ML.sprites.outline(g);
    return ML.sprites.strings(g);
  }

  function makeTray(w, h) {
    var g = ML.sprites.grid(w, h);
    ML.sprites.rect(g, 0, 0, w, h, '2');
    ML.sprites.rect(g, 2, 2, w - 4, h - 4, '3');
    ML.sprites.rect(g, 3, 3, w - 6, h - 6, '2');
    ML.sprites.rect(g, 0, 0, w, 2, '3');
    ML.sprites.outline(g);
    return ML.sprites.strings(g);
  }

  function ensureSprites() {
    if (spritesReady) return;
    for (var i = 0; i < SIZE_STEPS; i++) {
      ML.sprites.add('cp_puff' + i, makePuff(i, false));
      ML.sprites.add('cp_full' + i, makePuff(i, true));
    }
    ML.sprites.add('cp_burst', makeBurst());
    ML.sprites.add('cp_bag', makeBag());
    ML.sprites.add('cp_nozzle', makeNozzle());
    ML.sprites.add('cp_tray', makeTray(248, 88));
    spritesReady = true;
  }

  // =================================================================== scene
  function scene(opts) {
    opts = opts || {};
    ensureSprites();

    var s = {
      phase: 'title',       // title | ghost | pipe | roundcard | fill | result
      phaseT: 0,
      t: 0,

      idx: 0,               // which puff we are on
      size: 0,              // the mound currently being piped
      piping: false,
      sizes: [],            // finished sizes
      settle: 0,
      idle: 0,

      nozzleT: 0,
      fill: 0,
      filling: false,
      fills: [],            // {amount, place, burst}
      placeOff: 0,

      pipeScore: 0, fillScore: 0, consistency: 0, accuracy: 0,
      finalScore: 0
    };

    function px(i) { return CONFIG.COL_X[i % CONFIG.COLS]; }
    function py(i) { return CONFIG.ROW_Y[(i / CONFIG.COLS) | 0]; }
    function stepOf(size) {
      return ML.clamp(Math.round(size * (SIZE_STEPS - 1)), 0, SIZE_STEPS - 1);
    }

    // ------------------------------------------------------------ piping
    function finishPuff() {
      s.sizes.push(s.size);
      ML.sfx.play('blip');
      ML.engine.burst(px(s.idx), py(s.idx) + 4, 5, {
        colors: [P.WOOD_LIGHT, P.CREAM], speedMin: 10, speedMax: 34,
        life: 0.3, grav: 90, spread: Math.PI, dir: -Math.PI / 2, size: 1
      });
      s.size = 0;
      s.piping = false;
      s.idle = 0;
      s.settle = CONFIG.SETTLE;
      s.idx++;
      if (s.idx >= CONFIG.PUFFS) scorePiping();
    }

    function scorePiping() {
      var n = s.sizes.length, i;
      var mean = 0;
      for (i = 0; i < n; i++) mean += s.sizes[i];
      mean /= Math.max(1, n);
      var v = 0;
      for (i = 0; i < n; i++) v += (s.sizes[i] - mean) * (s.sizes[i] - mean);
      var sd = Math.sqrt(v / Math.max(1, n));

      s.consistency = ML.clamp(1 - sd / CONFIG.SD_ZERO, 0, 1);
      s.accuracy = ML.clamp(1 - Math.abs(mean - CONFIG.TARGET_SIZE) / CONFIG.ACC_ZERO, 0, 1);
      s.pipeScore = CONFIG.PIPE_POINTS
        * (s.consistency * CONFIG.CONSISTENCY_WEIGHT + s.accuracy * CONFIG.ACCURACY_WEIGHT);

      s.idx = 0;
      s.phase = 'roundcard'; s.phaseT = 0;
      ML.sfx.play(s.consistency > 0.7 ? 'crowd_cheer' : 'crowd_groan');
    }

    function updatePipe(dt) {
      if (s.settle > 0) { s.settle -= dt; return; }

      var held = ML.input.isDown('space');
      if (held) {
        s.idle = 0;
        s.piping = true;
        s.size += CONFIG.PIPE_RATE * dt;
        if (Math.random() < 0.4) {
          ML.engine.spawn({
            x: px(s.idx) + ML.rand(-2, 2), y: py(s.idx) - 12,
            vx: 0, vy: 26, life: 0.2, color: P.WOOD_LIGHT, size: 1
          });
        }
        if (s.size >= CONFIG.MAX_SIZE) {          // it has spread off the spot
          s.size = CONFIG.MAX_SIZE;
          ML.sfx.play('back');
          finishPuff();
        }
      } else if (s.piping) {
        finishPuff();
      } else {
        s.idle += dt;
        if (s.idle > CONFIG.IDLE_BAIL) { s.size = 0; finishPuff(); }
      }
    }

    // ------------------------------------------------------------ filling
    function nozzleX() {
      var tri = Math.abs(((s.nozzleT * CONFIG.NOZZLE_SPEED) % 1) * 2 - 1);
      return px(s.idx) - CONFIG.NOZZLE_RANGE + tri * CONFIG.NOZZLE_RANGE * 2;
    }

    function finishFill(burst) {
      var place = ML.clamp(1 - Math.abs(s.placeOff) / CONFIG.PLACE_ZERO, 0, 1);
      var amount = burst ? 0 : ML.clamp(1 - Math.abs(s.fill - 1) / 0.75, 0, 1);
      s.fills.push({ amount: amount, place: place, burst: !!burst });
      if (burst) {
        ML.sfx.play('fizz');
        ML.engine.shake(2, 0.2);
        ML.engine.burst(px(s.idx), py(s.idx), 16, {
          colors: [P.CREAM, P.WOOD_LIGHT], speedMin: 30, speedMax: 100,
          life: 0.7, grav: 220, spread: Math.PI * 2, size: 1
        });
      } else {
        ML.sfx.play('blip');
      }
      s.fill = 0; s.filling = false; s.idle = 0;
      s.settle = CONFIG.SETTLE;
      s.idx++;
      if (s.idx >= CONFIG.PUFFS) scoreFilling();
    }

    function scoreFilling() {
      var total = 0;
      for (var i = 0; i < s.fills.length; i++) {
        var f = s.fills[i];
        total += f.burst ? 0 : (f.amount * 0.65 + f.place * 0.35);
      }
      s.fillScore = CONFIG.FILL_POINTS * (total / Math.max(1, s.fills.length));
      s.finalScore = Math.round(ML.clamp(s.pipeScore + s.fillScore, 0, 1000));
      s.phase = 'result'; s.phaseT = 0;
      ML.sfx.play(s.finalScore > 550 ? 'fanfare' : 'crowd_groan');
    }

    function updateFill(dt) {
      if (s.settle > 0) { s.settle -= dt; return; }
      s.nozzleT += dt;

      var held = ML.input.isDown('space');
      if (held && !s.filling) {
        s.filling = true;
        s.placeOff = nozzleX() - px(s.idx);      // where he stuck it in
        s.idle = 0;
        ML.sfx.play('pour');
      }
      if (s.filling) {
        s.fill += CONFIG.FILL_RATE * dt;
        if (s.fill >= CONFIG.BURST_AT) { finishFill(true); return; }
        if (!held) { finishFill(false); return; }
      } else {
        s.idle += dt;
        if (s.idle > CONFIG.IDLE_BAIL) { s.placeOff = 99; s.fill = 0; finishFill(false); }
      }
    }

    // ----------------------------------------------------------------- draw
    function drawTray(ctx) {
      ML.drawSprite('cp_tray', 36, 58, null, ctx);
      // the twelve marked spots
      for (var i = 0; i < CONFIG.PUFFS; i++) {
        var done = i < s.sizes.length;
        if (!done) {
          ML.engine.rect(px(i) - 9, py(i) + 8, 18, 1, P.GRAY, ctx);
        }
      }
    }

    function drawPuffs(ctx) {
      for (var i = 0; i < s.sizes.length; i++) {
        var st = stepOf(s.sizes[i]);
        var f = s.fills[i];
        if (f && f.burst) {
          ML.drawSprite('cp_burst', px(i) - PC, py(i) - PC, null, ctx);
        } else {
          var name = (f ? 'cp_full' : 'cp_puff') + st;
          ML.drawSprite(name, px(i) - PC, py(i) - PC, null, ctx);
        }
      }
      // the one being piped right now
      if (s.phase === 'pipe' && s.idx < CONFIG.PUFFS && s.size > 0) {
        ML.drawSprite('cp_puff' + stepOf(s.size), px(s.idx) - PC, py(s.idx) - PC, null, ctx);
      }
    }

    function drawGhost(ctx) {
      // the target, as an outline, for two seconds and then never again
      var r = 2 + (PUFF_MAX_R - 2) * CONFIG.TARGET_SIZE;
      var cx = px(0), cy = py(0);
      for (var a = 0; a < 24; a++) {
        var th = (a / 24) * Math.PI * 2;
        ML.engine.rect(Math.round(cx + Math.cos(th) * r),
          Math.round(cy + Math.sin(th) * r * 0.78), 1, 1, P.ACCENT, ctx);
      }
      ML.font.drawTextShadowCentered('THIS BIG', cx, cy - 30, P.ACCENT, ctx);
    }

    function drawHud(ctx) {
      ML.engine.rect(0, 0, 320, 12, P.INK, ctx);
      ML.engine.rect(0, 12, 320, 1, P.CHARCOAL, ctx);
      var round = (s.phase === 'fill') ? 'FILLING' : 'PIPING';
      ML.font.drawText(round, 6, 3, P.CREAM, ctx);
      var n = Math.min(s.idx + 1, CONFIG.PUFFS);
      ML.font.drawText('PUFF ' + n + '/' + CONFIG.PUFFS, 118, 3, P.CREAM, ctx);
      if (s.phase === 'fill') {
        var burst = 0;
        for (var i = 0; i < s.fills.length; i++) if (s.fills[i].burst) burst++;
        ML.font.drawText('BURST ' + burst, 250, 3, burst ? P.ORANGE : P.STEEL, ctx);
      }
    }

    return {
      key: 'creampuffs',
      name: TITLE.name,

      enter: function () { ML.engine.clearParticles(); },
      exit: function () { ML.sfx.stopAllLoops(); },

      update: function (dt) {
        s.t += dt;
        s.phaseT += dt;

        if (s.phase === 'title') {
          if (s.phaseT >= CONFIG.TITLE_TIME || ML.input.justPressed('enter')) {
            s.phase = 'ghost'; s.phaseT = 0;
            ML.sfx.play('confirm');
          }
          return;
        }

        if (s.phase === 'result') {
          if (s.phaseT >= CONFIG.RESULT_TIME || ML.input.justPressed('enter')) {
            var burst = 0;
            for (var i = 0; i < s.fills.length; i++) if (s.fills[i].burst) burst++;
            ML.engine.replace(ML.ui.resultsScene({
              key: 'creampuffs',
              name: TITLE.name,
              score: s.finalScore,
              lines: [
                'MATCHING: ' + Math.round(s.consistency * 100) + '%',
                'ON TARGET: ' + Math.round(s.accuracy * 100) + '%',
                'BURST: ' + burst
              ]
            }));
          }
          return;
        }

        if (ML.input.justPressed('escape')) { ML.engine.push(ML.ui.pauseScene()); return; }

        if (s.phase === 'ghost') {
          if (s.phaseT >= CONFIG.GHOST_TIME) { s.phase = 'pipe'; s.phaseT = 0; s.idle = 0; }
          return;
        }
        if (s.phase === 'roundcard') {
          if (s.phaseT >= CONFIG.ROUND_CARD) { s.phase = 'fill'; s.phaseT = 0; s.idle = 0; }
          return;
        }
        if (s.phase === 'pipe') { updatePipe(dt); return; }
        if (s.phase === 'fill') { updateFill(dt); return; }
      },

      draw: function (ctx) {
        // a kitchen, from above
        ML.engine.rect(0, 0, 320, 180, P.WOOD, ctx);
        ML.engine.rect(0, 0, 320, 180, P.WOOD, ctx);
        for (var w = 0; w < 320; w += 46) ML.engine.rect(w, 0, 2, 180, P.WOOD_DARK, ctx);
        drawTray(ctx);
        drawPuffs(ctx);

        if (s.phase === 'ghost') drawGhost(ctx);

        if (s.phase === 'pipe' && s.idx < CONFIG.PUFFS) {
          var bob = s.piping ? 0 : Math.round(Math.sin(s.t * 5));
          // just above the mound - any higher and it sits on the row behind
          ML.drawSprite('cp_bag', px(s.idx) - 8, py(s.idx) - 26 + bob, null, ctx);
        }
        if (s.phase === 'fill' && s.idx < CONFIG.PUFFS) {
          var nx = s.filling ? px(s.idx) + s.placeOff : nozzleX();
          ML.drawSprite('cp_nozzle', Math.round(nx) - 5, py(s.idx) - 26, null, ctx);
        }

        ML.engine.drawParticles(ctx);
        drawHud(ctx);

        if (s.phase === 'pipe') {
          ML.font.drawTextShadowCentered(
            s.piping ? 'PIPING...' : 'HOLD SPACE TO PIPE', 160, 160,
            s.piping ? P.AMBER : P.CREAM, ctx);
          ML.font.drawTextShadowCentered('MATCH THE OTHERS', 160, 170, P.STEEL, ctx);
        } else if (s.phase === 'fill') {
          ML.font.drawTextShadowCentered(
            s.filling ? 'FILLING - LET GO BEFORE IT GOES' : 'SPACE TO STICK IT IN',
            160, 160, s.filling ? P.AMBER : P.CREAM, ctx);
        } else if (s.phase === 'roundcard') {
          ML.ui.dither(ctx, 50, 60, 220, 60);
          ML.engine.rect(52, 62, 216, 56, P.CHARCOAL, ctx);
          ML.engine.frameRect(52, 62, 216, 56, P.CREAM, ctx);
          ML.font.drawTextCentered('MATCHING ' + Math.round(s.consistency * 100) + '%'
            + '    ON TARGET ' + Math.round(s.accuracy * 100) + '%', 160, 72, P.CREAM, ctx);
          ML.font.drawTextCentered('NOW FILL THEM', 160, 90, P.AMBER, ctx);
          ML.font.drawTextCentered('SPACE TO INJECT, LET GO BEFORE IT BURSTS', 160, 104, P.STEEL, ctx);
        }

        if (s.phase === 'title') {
          TITLE.remaining = CONFIG.TITLE_TIME - s.phaseT;
          ML.ui.drawTitleCard(TITLE, s.t, ctx);
        } else if (s.phase === 'result') {
          ML.ui.drawResultCard({
            name: TITLE.name,
            score: s.finalScore,
            lines: ['MATCHING: ' + Math.round(s.consistency * 100) + '%'],
            footer: 'ENTER SKIPS'
          }, s.phaseT, ctx);
        }
      }
    };
  }

  return { scene: scene, CONFIG: CONFIG, name: TITLE.name, key: 'creampuffs' };
})();
