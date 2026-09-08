/*
  ==========================================================================
  EVENT 5 - DEATH GRIP (jar opening)
  ==========================================================================

  Pure reaction and sequence memory. The shortest event in the game.

  WHAT THE PLAYER DOES
    Three jars, one at a time. Each one shows a row of key prompts - arrow keys
    and SPACE - and you press them in the order shown before his grip gives out.

      Jar 1, the pickles ............ 5 inputs
      Jar 2, the spaghetti sauce .... 7 inputs
      Jar 3, the olives ............. 9 inputs, and the prompts you have already
                                      pressed FADE AWAY, so you cannot just read
                                      the row back - you have to remember it.

    Press the wrong key and his grip slips: the jar jerks, you lose a beat, and
    the sequence starts again from the beginning of that jar. His grip keeps
    going the whole time.

    Get it open and the lid pops with a proper vacuum-seal thunk. Run out of
    grip and he hands it to someone off-screen, which is worth nothing at all.

  ABOUT THE CLOCK
    This is the one event that KEPT its timer, because here the timer IS the
    mechanic - the whole event is "can you do this fast enough". Taking it away
    would leave you tapping out a sequence at your leisure, which is not a
    contest. It is dressed as his GRIP giving out rather than a stopwatch, and
    the leftover grip is what pays the bonus, but underneath it is the brief's
    per-jar time limit exactly as written.

  WHERE THE DIFFICULTY KNOBS ARE
    JARS ............... one row per jar: how many inputs and how many seconds
                         of grip. This is the main difficulty dial.
    SLIP_STALL ......... how long a fumble costs you.
    READY_TIME ......... how long you get to look at the sequence before his
                         grip starts going.
    SCORE_PER_JAR ...... 250 a jar, per the brief.
    GRIP_BONUS ......... up to 250 more, scaled by the grip left across all three.

  If it feels too hard, raise the `grip` numbers in JARS and READY_TIME first.
*/
window.ML = window.ML || {};
ML.events = ML.events || {};

ML.events.jaropening = (function () {
  var P = ML.palette;

  var CONFIG = {
    // ---- pacing
    TITLE_TIME: 3,
    RESULT_TIME: 3,
    READY_TIME: 1.3,         // look at the sequence before his grip starts going
    POP_TIME: 1.5,           // lid coming off
    FAIL_TIME: 1.8,          // handing it to someone else
    SLIP_STALL: 1.0,         // how long a fumble costs (grip still draining)

    /*
       One row per jar. `inputs` is how long the sequence is, `grip` is how many
       seconds of grip he has for it, `fade` hides the prompts you have already
       pressed so you have to remember the rest.
    */
    JARS: [
      { name: 'PICKLES', inputs: 5, grip: 6.0, content: '7', lid: '2', fade: false },
      { name: 'SPAGHETTI SAUCE', inputs: 7, grip: 6.0, content: 'd', lid: '3', fade: false },
      { name: 'OLIVES', inputs: 9, grip: 5.5, content: '1', lid: 'c', fade: true }
    ],

    // ---- score out of 1000
    SCORE_PER_JAR: 250,
    GRIP_BONUS: 250,

    // ---- layout
    // The jar sits on the worktop and his hands meet the lid: the jar bottom
    // lands on the counter line, and PLAYER_Y is set so the 'out' arms are at
    // lid height rather than waving in the air above it.
    JAR_X: 160, JAR_Y: 56,
    PLAYER_X: 148, PLAYER_Y: 43,
    ROW_Y: 118,
    KEY_W: 17, KEY_H: 15, KEY_GAP: 3, SPACE_W: 30,
    GRIP_BAR: { x: 90, y: 140, w: 140, h: 8 }
  };

  var TITLE = {
    number: 5,
    name: 'DEATH GRIP',
    joke: [
      'RULE 9: NOBODY ELSE TRIES IT FIRST.',
      'THREE JARS. ONE PAIR OF HANDS.'
    ],
    controls: [
      'PRESS THE KEYS IN THE ORDER SHOWN.',
      'A WRONG ONE AND YOU START THAT JAR AGAIN.'
    ]
  };

  var KEYS = ['up', 'down', 'left', 'right', 'space'];

  // ================================================================= sprites
  var spritesReady = false;

  function makeArrow(dir) {
    var g = ML.sprites.grid(9, 9);
    // a solid triangle plus a stalk, built once and pointed four ways
    for (var y = 0; y < 9; y++) {
      for (var x = 0; x < 9; x++) {
        var lx = x, ly = y;
        if (dir === 'down') { lx = 8 - x; ly = 8 - y; }
        else if (dir === 'left') { lx = y; ly = 8 - x; }
        else if (dir === 'right') { lx = 8 - y; ly = x; }
        var head = (ly <= 4) && (Math.abs(lx - 4) <= ly);
        var stalk = (ly > 4) && (Math.abs(lx - 4) <= 1);
        if (head || stalk) g[y][x] = '4';
      }
    }
    return ML.sprites.strings(g);
  }

  function makeBar() {                       // the SPACE glyph
    var g = ML.sprites.grid(19, 7);
    ML.sprites.rect(g, 0, 2, 19, 3, '4');
    ML.sprites.rect(g, 0, 1, 2, 5, '4');
    ML.sprites.rect(g, 17, 1, 2, 5, '4');
    return ML.sprites.strings(g);
  }

  function makeJar(content, lidCol) {
    var W = 30, H = 40;
    var g = ML.sprites.grid(W, H);
    ML.sprites.rect(g, 3, 8, 24, 30, '3');          // glass
    ML.sprites.rect(g, 5, 10, 20, 26, content);     // what is in it
    ML.sprites.rect(g, 4, 9, 2, 28, '4');           // highlight down the side
    ML.sprites.rect(g, 6, 20, 18, 8, '4');          // the label
    ML.sprites.rect(g, 7, 22, 16, 4, content);
    ML.sprites.rect(g, 5, 4, 20, 6, lidCol);        // the lid
    ML.sprites.rect(g, 5, 4, 20, 2, '4');
    for (var x = 6; x < 24; x += 3) ML.sprites.rect(g, x, 6, 1, 3, '2');  // knurling
    ML.sprites.outline(g);
    return ML.sprites.strings(g);
  }

  /*
     His hands are drawn IN FRONT of the jar. The jar is wider than the figure's
     whole arm span, so with him behind it you never see him holding anything -
     which rather undercuts an event about grip.
  */
  function makeHand(flip) {
    var g = ML.sprites.grid(8, 9);
    ML.sprites.rect(g, flip ? 1 : 2, 1, 5, 7, 'e');     // the fist
    ML.sprites.rect(g, flip ? 1 : 2, 3, 5, 1, '9');     // knuckles
    ML.sprites.rect(g, flip ? 5 : 1, 0, 2, 3, 'e');     // thumb over the lid
    ML.sprites.rect(g, flip ? 0 : 6, 4, 2, 4, 'e');     // wrist back to the arm
    ML.sprites.outline(g);
    return ML.sprites.strings(g);
  }

  function makeLid(lidCol) {
    var g = ML.sprites.grid(22, 8);
    ML.sprites.rect(g, 1, 1, 20, 6, lidCol);
    ML.sprites.rect(g, 1, 1, 20, 2, '4');
    for (var x = 2; x < 20; x += 3) ML.sprites.rect(g, x, 3, 1, 3, '2');
    ML.sprites.outline(g);
    return ML.sprites.strings(g);
  }

  function ensureSprites() {
    if (spritesReady) return;
    ML.sprites.add('dg_up', makeArrow('up'));
    ML.sprites.add('dg_down', makeArrow('down'));
    ML.sprites.add('dg_left', makeArrow('left'));
    ML.sprites.add('dg_right', makeArrow('right'));
    ML.sprites.add('dg_space', makeBar());
    ML.sprites.add('dg_handL', makeHand(false));
    ML.sprites.add('dg_handR', makeHand(true));
    for (var i = 0; i < CONFIG.JARS.length; i++) {
      ML.sprites.add('dg_jar' + i, makeJar(CONFIG.JARS[i].content, CONFIG.JARS[i].lid));
      ML.sprites.add('dg_lid' + i, makeLid(CONFIG.JARS[i].lid));
    }
    spritesReady = true;
  }

  // =================================================================== scene
  function scene(opts) {
    opts = opts || {};
    ensureSprites();

    var s = {
      phase: 'title',      // title | ready | grip | slip | pop | fail | result
      phaseT: 0,
      t: 0,

      jar: 0,
      seq: [],
      pos: 0,
      grip: 0,
      gripMax: 0,
      slipT: 0,
      shake: 0,

      opened: 0,
      gripLeft: 0,         // summed across jars, for the bonus
      gripTotal: 0,
      lid: null,           // the lid flying off
      finalScore: 0
    };

    for (var j = 0; j < CONFIG.JARS.length; j++) s.gripTotal += CONFIG.JARS[j].grip;

    function jarDef() { return CONFIG.JARS[ML.clamp(s.jar, 0, CONFIG.JARS.length - 1)]; }

    function startJar() {
      var d = jarDef();
      s.seq = [];
      for (var i = 0; i < d.inputs; i++) {
        s.seq.push(KEYS[(Math.random() * KEYS.length) | 0]);
      }
      s.pos = 0;
      s.grip = d.grip;
      s.gripMax = d.grip;
      s.lid = null;
      s.phase = 'ready'; s.phaseT = 0;
    }

    function slip() {
      s.phase = 'slip'; s.phaseT = 0;
      s.pos = 0;                       // right back to the beginning of this jar
      s.shake = 0.4;
      ML.sfx.play('stick');
      ML.engine.shake(3, 0.25);
      ML.engine.burst(CONFIG.JAR_X, CONFIG.JAR_Y + 20, 8, {
        colors: [P.STEEL, P.CREAM], speedMin: 20, speedMax: 60,
        life: 0.5, grav: 180, spread: Math.PI, dir: -Math.PI / 2, size: 1
      });
    }

    function popLid() {
      s.opened++;
      s.gripLeft += s.grip;
      s.lid = { x: CONFIG.JAR_X - 11, y: CONFIG.JAR_Y + 2, vy: -95, vx: ML.rand(-18, 18) };
      s.phase = 'pop'; s.phaseT = 0;
      ML.sfx.play('thunk');
      ML.sfx.play('crowd_cheer');
      ML.engine.shake(2, 0.2);
      ML.engine.hitstop(5);
      ML.engine.burst(CONFIG.JAR_X, CONFIG.JAR_Y + 6, 20, {
        colors: [P.CREAM, P.STEEL, P.AMBER], speedMin: 30, speedMax: 110,
        life: 0.7, grav: 200, spread: Math.PI * 1.3, dir: -Math.PI / 2, size: 1
      });
    }

    function failJar() {
      s.phase = 'fail'; s.phaseT = 0;
      ML.sfx.play('crowd_groan');
    }

    function nextJar() {
      s.jar++;
      if (s.jar >= CONFIG.JARS.length) {
        var bonus = CONFIG.GRIP_BONUS * ML.clamp(s.gripLeft / s.gripTotal, 0, 1);
        s.finalScore = Math.round(ML.clamp(s.opened * CONFIG.SCORE_PER_JAR + bonus, 0, 1000));
        s.phase = 'result'; s.phaseT = 0;
        ML.sfx.play(s.opened === CONFIG.JARS.length ? 'fanfare' : 'crowd_groan');
      } else {
        startJar();
      }
    }

    // ---------------------------------------------------------------- update
    function pressedKey() {
      for (var i = 0; i < KEYS.length; i++) if (ML.input.justPressed(KEYS[i])) return KEYS[i];
      return null;
    }

    function updateGrip(dt) {
      s.grip -= dt;
      if (s.grip <= 0) { s.grip = 0; failJar(); return; }

      var k = pressedKey();
      if (!k) return;

      if (k === s.seq[s.pos]) {
        s.pos++;
        ML.sfx.play('blip');
        ML.engine.burst(keyX(s.pos - 1) + 8, CONFIG.ROW_Y + 7, 4, {
          colors: [P.ACCENT, P.CREAM], speedMin: 15, speedMax: 45,
          life: 0.3, spread: Math.PI * 2, size: 1
        });
        if (s.pos >= s.seq.length) popLid();
      } else {
        slip();
      }
    }

    // ----------------------------------------------------------------- draw
    // widths differ because SPACE gets a wider cap
    function keyW(i) { return s.seq[i] === 'space' ? CONFIG.SPACE_W : CONFIG.KEY_W; }
    function rowW() {
      var w = 0;
      for (var i = 0; i < s.seq.length; i++) w += keyW(i) + CONFIG.KEY_GAP;
      return w - CONFIG.KEY_GAP;
    }
    function keyX(i) {
      var x = CONFIG.JAR_X - rowW() / 2;
      for (var j = 0; j < i; j++) x += keyW(j) + CONFIG.KEY_GAP;
      return Math.round(x);
    }

    function drawRow(ctx) {
      var d = jarDef();
      for (var i = 0; i < s.seq.length; i++) {
        var done = i < s.pos;
        // on the olives, everything you have pressed vanishes
        if (done && d.fade) continue;

        var x = keyX(i), w = keyW(i), y = CONFIG.ROW_Y;
        var cur = (i === s.pos) && (s.phase === 'grip' || s.phase === 'ready');
        var bob = cur ? Math.round(Math.sin(s.t * 9) * 1) : 0;

        var cap = done ? P.GRAY : (cur ? P.ACCENT : P.CHARCOAL);
        var ink = done ? P.CHARCOAL : (cur ? P.INK : P.CREAM);

        ML.engine.rect(x, y + bob + 1, w, CONFIG.KEY_H, P.INK, ctx);
        ML.engine.rect(x, y + bob, w, CONFIG.KEY_H, cap, ctx);
        ML.engine.frameRect(x, y + bob, w, CONFIG.KEY_H, done ? P.GRAY : P.CREAM, ctx);

        var name = s.seq[i];
        if (name === 'space') {
          ML.drawSprite('dg_space', x + (w - 19) / 2, y + bob + 4, { tint: ink }, ctx);
        } else {
          ML.drawSprite('dg_' + name, x + (w - 9) / 2, y + bob + 3, { tint: ink }, ctx);
        }
      }
    }

    function drawGripBar(ctx) {
      var b = CONFIG.GRIP_BAR;
      var frac = s.gripMax ? ML.clamp(s.grip / s.gripMax, 0, 1) : 0;
      ML.engine.rect(b.x - 1, b.y - 1, b.w + 2, b.h + 2, P.INK, ctx);
      ML.engine.rect(b.x, b.y, b.w, b.h, P.CHARCOAL, ctx);
      ML.engine.rect(b.x, b.y, Math.round(b.w * frac), b.h,
        frac < 0.3 ? P.ORANGE : P.AMBER, ctx);
      ML.engine.frameRect(b.x - 1, b.y - 1, b.w + 2, b.h + 2, P.CREAM, ctx);
      ML.font.drawTextShadow('GRIP', b.x - 32, b.y + 1, frac < 0.3 ? P.ORANGE : P.STEEL, ctx);
    }

    function drawHud(ctx) {
      ML.engine.rect(0, 0, 320, 12, P.INK, ctx);
      ML.engine.rect(0, 12, 320, 1, P.CHARCOAL, ctx);
      ML.font.drawText('JAR ' + Math.min(s.jar + 1, CONFIG.JARS.length) + ' OF ' + CONFIG.JARS.length,
        6, 3, P.CREAM, ctx);
      ML.font.drawText('OPENED ' + s.opened, 240, 3, P.CREAM, ctx);
    }

    return {
      key: 'jaropening',
      name: TITLE.name,

      enter: function () { ML.engine.clearParticles(); },
      exit: function () { ML.sfx.stopAllLoops(); },

      update: function (dt) {
        s.t += dt;
        s.phaseT += dt;
        if (s.shake > 0) s.shake -= dt;

        if (s.lid) {
          s.lid.vy += 300 * dt;
          s.lid.x += s.lid.vx * dt;
          s.lid.y += s.lid.vy * dt;
        }

        if (s.phase === 'title') {
          if (s.phaseT >= CONFIG.TITLE_TIME || ML.input.justPressed('enter')) {
            ML.sfx.play('confirm');
            startJar();
          }
          return;
        }

        if (s.phase === 'result') {
          if (s.phaseT >= CONFIG.RESULT_TIME || ML.input.justPressed('enter')) {
            ML.engine.replace(ML.ui.resultsScene({
              key: 'jaropening',
              name: TITLE.name,
              score: s.finalScore,
              lines: [
                'JARS OPENED: ' + s.opened + ' OF ' + CONFIG.JARS.length,
                'GRIP TO SPARE: ' + Math.round(ML.clamp(s.gripLeft / s.gripTotal, 0, 1) * 100) + '%'
              ]
            }));
          }
          return;
        }

        if (ML.input.justPressed('escape')) { ML.engine.push(ML.ui.pauseScene()); return; }

        switch (s.phase) {
          case 'ready':
            if (s.phaseT >= CONFIG.READY_TIME) { s.phase = 'grip'; s.phaseT = 0; }
            break;
          case 'grip':
            updateGrip(dt);
            break;
          case 'slip':
            // his grip carries on going while he re-seats his hands
            s.grip -= dt;
            if (s.grip <= 0) { s.grip = 0; failJar(); break; }
            if (s.phaseT >= CONFIG.SLIP_STALL) { s.phase = 'grip'; s.phaseT = 0; }
            break;
          case 'pop':
            if (s.phaseT >= CONFIG.POP_TIME) nextJar();
            break;
          case 'fail':
            if (s.phaseT >= CONFIG.FAIL_TIME) nextJar();
            break;
        }
      },

      draw: function (ctx) {
        // a kitchen worktop rather than the backyard
        ML.engine.rect(0, 0, 320, 180, P.CHARCOAL, ctx);
        ML.engine.rect(0, 0, 320, 96, P.SKY_DEEP, ctx);
        for (var t = 0; t < 320; t += 40) {
          ML.engine.rect(t, 0, 2, 96, P.CHARCOAL, ctx);          // tiled splashback
        }
        ML.engine.rect(0, 46, 320, 2, P.CHARCOAL, ctx);
        ML.engine.rect(0, 96, 320, 6, P.WOOD_LIGHT, ctx);        // the worktop
        ML.engine.rect(0, 102, 320, 78, P.WOOD, ctx);
        for (var c = 24; c < 320; c += 64) ML.engine.rect(c, 104, 2, 76, P.WOOD_DARK, ctx);

        var jitter = (s.shake > 0) ? (Math.floor(s.t * 40) % 2 ? 2 : -2) : 0;

        var pose = (s.phase === 'slip') ? 'player_swing'
          : (s.phase === 'pop') ? 'player_win'
            : (s.phase === 'fail') ? 'player_lose' : 'player_strain';
        ML.drawSprite(pose, CONFIG.PLAYER_X + jitter, CONFIG.PLAYER_Y, null, ctx);

        if (s.phase !== 'fail') {
          ML.drawSprite('dg_jar' + ML.clamp(s.jar, 0, CONFIG.JARS.length - 1),
            CONFIG.JAR_X - 15 + jitter, CONFIG.JAR_Y, null, ctx);
          // hands over the top of the jar, at lid height
          var hy = CONFIG.JAR_Y + 3 + (s.phase === 'slip' ? 3 : 0);
          ML.drawSprite('dg_handL', CONFIG.JAR_X - 21 + jitter, hy, null, ctx);
          ML.drawSprite('dg_handR', CONFIG.JAR_X + 13 + jitter, hy, null, ctx);
        }
        if (s.lid) {
          ML.drawSprite('dg_lid' + ML.clamp(s.jar, 0, CONFIG.JARS.length - 1),
            s.lid.x, s.lid.y, null, ctx);
        }

        ML.engine.drawParticles(ctx);

        var live = (s.phase === 'ready' || s.phase === 'grip' || s.phase === 'slip');
        if (live) {
          drawRow(ctx);
          drawGripBar(ctx);
          ML.font.drawTextShadowCentered(jarDef().name, 160, 106, P.AMBER, ctx);
        }

        if (s.phase === 'ready') {
          ML.font.drawTextShadowCentered('GET A GRIP...', 160, 156, P.CREAM, ctx);
        } else if (s.phase === 'slip') {
          ML.font.drawTextWavyCentered('IT SLIPPED! START AGAIN', 160, 156, P.ORANGE, s.t, 1.5, 0.7, ctx);
        } else if (s.phase === 'grip') {
          ML.font.drawTextShadowCentered('PRESS THEM IN ORDER', 160, 156, P.STEEL, ctx);
        } else if (s.phase === 'pop') {
          ML.font.drawTextWavyCentered('THAT IS WHY THEY ASK HIM', 160, 130, P.ACCENT, s.t, 2, 0.6, ctx);
        } else if (s.phase === 'fail') {
          ML.font.drawTextWavyCentered('HE HANDS IT TO SOMEONE ELSE', 160, 118, P.ORANGE, s.t, 2, 0.6, ctx);
          ML.font.drawTextShadowCentered('NO POINTS FOR THAT ONE', 160, 134, P.STEEL, ctx);
        }

        drawHud(ctx);

        if (s.phase === 'title') {
          TITLE.remaining = CONFIG.TITLE_TIME - s.phaseT;
          ML.ui.drawTitleCard(TITLE, s.t, ctx);
        } else if (s.phase === 'result') {
          ML.ui.drawResultCard({
            name: TITLE.name,
            score: s.finalScore,
            lines: ['JARS OPENED: ' + s.opened + ' OF ' + CONFIG.JARS.length],
            footer: 'ENTER SKIPS'
          }, s.phaseT, ctx);
        }
      }
    };
  }

  return { scene: scene, CONFIG: CONFIG, name: TITLE.name, key: 'jaropening' };
})();
