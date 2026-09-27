/*
  ==========================================================================
  CUTSCENE - the opening of a tournament
  ==========================================================================

  Before event one you meet the field. Each rival gets a beat: him, doing
  something around his own house that tells you who he is, with his name, his
  one line and his four stats. Then a loudhailer goes off somewhere down the
  street, and everybody falls in.

  It is not only flavour. By the time the first event starts you have been told
  which of them is strong, which is precise and which is a liability, which is
  the information you need to know whose events to worry about.

  PACING AND SKIPPING
    Every beat runs itself out after a couple of seconds. SPACE moves on early;
    ENTER skips the whole thing and starts the tournament. Both are on screen,
    because the second time you play a tournament you do not want to sit
    through this, and a cutscene you cannot get out of is worse than none.

  WHERE THE KNOBS ARE
    BEAT ............... seconds a rival's introduction holds for.
    CALL_BEAT / FALL_IN  the two closing beats.
    MIN_SKIP ........... how long before a keypress is allowed to skip, so the
                         press that started the tournament does not eat the
                         first beat.
    The order of the introductions follows js/opponents.js, so adding a rival
    there gives him a beat here without touching this file.

  Everything is drawn from the figures opponents.js already registers plus a
  handful of props baked at the bottom of this file. No new art anywhere else.
*/
window.ML = window.ML || {};

ML.cutscene = (function () {
  var P = ML.palette;
  var W = 320, H = 180;

  var CONFIG = {
    BEAT: 2.6,               // seconds per rival
    CALL_BEAT: 3.0,          // the loudhailer
    FALL_IN: 3.4,            // everybody in a line
    MIN_SKIP: 0.35,          // so the keypress that got you here is not spent
    GROUND_Y: 118
  };

  /*
     What each of them is doing. The pose is one of the figures opponents.js
     registers; the prop is drawn by the named function below. Anyone in the
     roster without an entry here still gets a beat, just standing there.
  */
  var DOING = {
    arnold: { pose: '_up', prop: 'grillOverhead',
      caption: 'HE DOES NOT NEED THE TROLLEY.' },
    hugo: { pose: '_swing', prop: 'hedge',
      caption: 'THE HEDGE IS A PERFECT CUBE.' },
    hulk: { pose: '_up', prop: 'wreckage',
      caption: 'THE FENCE WAS THERE THIS MORNING.' },
    stalin: { pose: '_idle0', prop: 'clipboard',
      caption: 'HE IS MEASURING SOMETHING AGAIN.' },
    butkus: { pose: '_swing', prop: 'flowerbed',
      caption: 'HE DID NOT SEE THE FLOWERBED.' },
    duke: { pose: '_idle0', prop: 'sax',
      caption: 'NOBODY ASKED HIM TO PLAY.' }
  };

  // ================================================================= sprites
  var spritesReady = false;

  function makeGrill() {
    var g = ML.sprites.grid(28, 22);
    ML.sprites.ellipse(g, 14, 9, 13, 8, '1');           // the kettle
    ML.sprites.ellipse(g, 14, 8, 11, 6, '2');
    ML.sprites.rect(g, 13, 2, 2, 4, '2');               // handle
    ML.sprites.rect(g, 5, 16, 2, 6, '1');               // legs
    ML.sprites.rect(g, 21, 16, 2, 6, '1');
    ML.sprites.rect(g, 13, 16, 2, 6, '1');
    ML.sprites.outline(g);
    return ML.sprites.strings(g);
  }

  function makeHedge() {
    var g = ML.sprites.grid(34, 26);
    ML.sprites.rect(g, 0, 4, 34, 22, '7');
    ML.sprites.rect(g, 0, 4, 34, 3, '8');               // the flat top he is proud of
    ML.sprites.rect(g, 2, 8, 30, 1, '8');
    ML.sprites.rect(g, 0, 24, 34, 2, '9');
    ML.sprites.outline(g);
    return ML.sprites.strings(g);
  }

  function makeShears() {
    var g = ML.sprites.grid(16, 12);
    ML.sprites.limb(g, 1, 2, 12, 5, 2, '3');
    ML.sprites.limb(g, 1, 9, 12, 6, 2, '3');
    ML.sprites.rect(g, 12, 4, 4, 4, '9');
    ML.sprites.outline(g);
    return ML.sprites.strings(g);
  }

  function makeClipboard() {
    var g = ML.sprites.grid(14, 18);
    ML.sprites.rect(g, 0, 0, 14, 18, '9');
    ML.sprites.rect(g, 1, 2, 12, 15, '4');
    ML.sprites.rect(g, 5, 0, 4, 2, '2');                // the clip
    for (var y = 5; y < 15; y += 3) ML.sprites.rect(g, 3, y, 8, 1, '2');
    ML.sprites.outline(g);
    return ML.sprites.strings(g);
  }

  function makeSax() {
    var g = ML.sprites.grid(14, 22);
    ML.sprites.rect(g, 6, 0, 3, 10, 'c');
    ML.sprites.rect(g, 4, 9, 5, 6, 'c');
    ML.sprites.ellipse(g, 6, 17, 5, 4, 'c');
    ML.sprites.ellipse(g, 6, 17, 3, 2, '9');
    ML.sprites.rect(g, 9, 3, 1, 1, '4');                // keys
    ML.sprites.rect(g, 9, 6, 1, 1, '4');
    ML.sprites.outline(g);
    return ML.sprites.strings(g);
  }

  function makeHorn() {
    var g = ML.sprites.grid(24, 18);
    ML.sprites.rect(g, 0, 7, 8, 4, '2');
    for (var i = 0; i < 10; i++) {
      var h = 2 + i * 1.4;
      ML.sprites.rect(g, 8 + i, Math.round(9 - h / 2), 1, Math.round(h), '3');
    }
    ML.sprites.rect(g, 2, 11, 3, 6, '2');               // the grip
    ML.sprites.outline(g);
    return ML.sprites.strings(g);
  }

  function makePlank() {
    var g = ML.sprites.grid(18, 6);
    ML.sprites.rect(g, 0, 0, 18, 6, 'a');
    ML.sprites.rect(g, 0, 0, 18, 2, 'b');
    ML.sprites.outline(g);
    return ML.sprites.strings(g);
  }

  function ensureSprites() {
    if (spritesReady) return;
    ML.sprites.add('cs_grill', makeGrill());
    ML.sprites.add('cs_hedge', makeHedge());
    ML.sprites.add('cs_shears', makeShears());
    ML.sprites.add('cs_clipboard', makeClipboard());
    ML.sprites.add('cs_sax', makeSax());
    ML.sprites.add('cs_horn', makeHorn());
    ML.sprites.add('cs_plank', makePlank());
    spritesReady = true;
  }

  // ================================================================== props
  /*
     Each of these draws whatever is going on around one rival. `fx` is the
     centre line his feet stand on and `gy` is the ground, so a prop never has
     to know where on the screen the beat put him.
  */
  var PROPS = {
    grillOverhead: function (ctx, fx, gy, t) {
      // held over his head, wobbling slightly, because of course it is
      var wob = Math.round(Math.sin(t * 4) * 1);
      ML.drawSprite('cs_grill', fx - 14 + wob, gy - 50, null, ctx);
    },
    hedge: function (ctx, fx, gy, t) {
      ML.drawSprite('cs_hedge', fx + 14, gy - 26, null, ctx);
      var snip = Math.round(Math.sin(t * 9) * 2);
      ML.drawSprite('cs_shears', fx + 8, gy - 30 + snip, null, ctx);
      if (Math.random() < 0.25) {
        ML.engine.spawn({
          x: fx + 20 + ML.rand(-6, 6), y: gy - 26,
          vx: ML.rand(-10, 10), vy: -16, life: 0.5, color: P.GRASS, size: 1, grav: 90
        });
      }
    },
    wreckage: function (ctx, fx, gy, t) {
      // the fence, minus several of its planks
      ML.drawSprite('fence', fx + 12, gy - 20, null, ctx);
      ML.engine.rect(fx + 30, gy - 20, 10, 20, P.SKY, ctx);
      ML.engine.rect(fx + 52, gy - 20, 8, 20, P.SKY, ctx);
      ML.drawSprite('cs_plank', fx + 26, gy - 4, null, ctx);
      ML.drawSprite('cs_plank', fx + 48, gy - 2, null, ctx);
      if (Math.random() < 0.3) {
        ML.engine.spawn({
          x: fx + ML.rand(20, 60), y: gy - ML.rand(4, 18),
          vx: ML.rand(-20, 20), vy: ML.rand(-30, -8),
          life: 0.6, color: P.WOOD, size: 1, grav: 180
        });
      }
    },
    clipboard: function (ctx, fx, gy, t) {
      ML.drawSprite('cs_clipboard', fx + 12, gy - 26, null, ctx);
      // a tape measure across the grass, which he keeps re-reading
      ML.engine.rect(fx - 40, gy - 2, 80, 1, P.CREAM, ctx);
      for (var i = -40; i <= 40; i += 8) {
        ML.engine.rect(fx + i, gy - 4, 1, 3, P.CREAM, ctx);
      }
    },
    flowerbed: function (ctx, fx, gy, t) {
      ML.drawSprite('bush', fx + 16, gy - 16, null, ctx);
      ML.drawSprite('bush', fx + 40, gy - 16, null, ctx);
      // straight through the middle of it
      ML.engine.rect(fx + 8, gy - 3, 56, 3, P.WOOD_DARK, ctx);
      if (Math.random() < 0.4) {
        ML.engine.spawn({
          x: fx + ML.rand(14, 58), y: gy - ML.rand(6, 16),
          vx: ML.rand(-24, 24), vy: ML.rand(-34, -12),
          life: 0.7, color: Math.random() < 0.5 ? P.ACCENT : P.AMBER, size: 1, grav: 140
        });
      }
    },
    sax: function (ctx, fx, gy, t) {
      ML.drawSprite('cs_sax', fx + 10, gy - 30, null, ctx);
      // a couple of notes drifting off, because he is not going to stop
      for (var i = 0; i < 3; i++) {
        var ph = t * 1.4 + i * 0.7;
        var nx = fx + 24 + (ph % 2) * 22;
        var ny = gy - 34 - (ph % 2) * 18 + Math.sin(ph * 5) * 2;
        ML.engine.rect(Math.round(nx), Math.round(ny), 2, 3, P.CREAM, ctx);
        ML.engine.rect(Math.round(nx) + 2, Math.round(ny) - 3, 1, 4, P.CREAM, ctx);
      }
    }
  };

  // =================================================================== scene
  /*
     opts.then      called once the cutscene is over (or skipped)
     opts.players   1 or 2, so the last beat lines up the right number of dads
  */
  function introScene(opts) {
    opts = opts || {};
    ensureSprites();

    var roster = ML.opponents.roster;
    var players = opts.players === 2 ? 2 : 1;
    var t = 0, beat = 0, beatT = 0, chimed = false;

    // one beat per rival, then the call, then everybody falls in
    var BEATS = roster.length + 2;
    var callIdx = roster.length;
    var fallIdx = roster.length + 1;

    function lengthOf(i) {
      if (i === callIdx) return CONFIG.CALL_BEAT;
      if (i === fallIdx) return CONFIG.FALL_IN;
      return CONFIG.BEAT;
    }

    function done() { if (opts.then) opts.then(); }

    function statLine(o) {
      return [['POW', o.power], ['PRE', o.precision],
        ['COM', o.composure], ['CHA', o.chaos]];
    }

    // -------------------------------------------------------------- drawing
    function drawRivalBeat(ctx, o) {
      var gy = CONFIG.GROUND_Y;
      var fx = 108;                          // where his feet are
      var doing = DOING[o.id] || { pose: '_idle0', caption: '' };

      var prop = PROPS[doing.prop];
      if (prop) prop(ctx, fx, gy, t);

      var pose = o.id + doing.pose;
      if (!ML.sprites.has(pose)) pose = o.id + '_idle0';
      ML.drawSprite(pose, fx - 12, gy - 32, null, ctx);

      ML.engine.drawParticles(ctx);

      // his card
      ML.engine.rect(0, 124, W, 56, P.INK, ctx);
      ML.engine.rect(0, 124, W, 1, P.CREAM, ctx);
      ML.font.drawTextCentered(o.name, W / 2, 130, P.ACCENT, ctx);
      ML.font.drawTextCentered(o.blurb, W / 2, 142, P.CREAM, ctx);
      if (doing.caption) {
        ML.font.drawTextCentered(doing.caption, W / 2, 152, P.STEEL, ctx);
      }

      // the four stats, with whatever he is best at picked out
      var stats = statLine(o), i, best = 0;
      for (i = 0; i < stats.length; i++) if (stats[i][1] > stats[best][1]) best = i;
      var gap = 66, x0 = W / 2 - gap * 1.5;
      for (i = 0; i < stats.length; i++) {
        var col = (i === best) ? P.AMBER : P.GRAY;
        ML.font.drawTextCentered(stats[i][0] + ' ' + stats[i][1],
          x0 + gap * i, 166, col, ctx);
      }
    }

    function drawCallBeat(ctx) {
      var gy = CONFIG.GROUND_Y;
      // a loudhailer over the fence, two doors down
      var shake = Math.round(Math.sin(t * 30) * 1);
      ML.drawSprite('cs_horn', 150 + shake, gy - 34, null, ctx);
      ML.drawSprite('fence', 40, gy - 20, null, ctx);
      ML.drawSprite('fence', 104, gy - 20, null, ctx);
      ML.drawSprite('fence', 168, gy - 20, null, ctx);
      ML.drawSprite('fence', 232, gy - 20, null, ctx);

      ML.engine.rect(0, 124, W, 56, P.INK, ctx);
      ML.engine.rect(0, 124, W, 1, P.CREAM, ctx);
      ML.ui.bigTextWavy('ATTENTION', W / 2, 130, P.ACCENT, 2, t, 1.2, ctx);
      ML.font.drawTextCentered('ALL MEN TO THE DRIVEWAY.', W / 2, 152, P.CREAM, ctx);
      ML.font.drawTextCentered('BRING YOUR OWN TONGS.', W / 2, 164, P.STEEL, ctx);
    }

    function drawFallInBeat(ctx) {
      var gy = CONFIG.GROUND_Y + 6;
      var line = [];
      var i;
      for (i = 0; i < players; i++) line.push(i === 1 ? 'player2' : 'player');
      for (i = 0; i < roster.length; i++) line.push(roster[i].id);

      // they arrive one after another, left to right
      var per = CONFIG.FALL_IN / (line.length + 1);
      var span = W - 40;
      var step = span / line.length;
      for (i = 0; i < line.length; i++) {
        if (beatT < per * i) continue;
        var x = 20 + step * i + (step - 24) / 2;
        var bob = Math.floor((t * 3 + i) % 2);
        var nm = line[i] + '_idle' + bob;
        if (!ML.sprites.has(nm)) nm = line[i] + '_idle0';
        ML.drawSprite(nm, Math.round(x), gy - 32, null, ctx);
      }

      ML.engine.rect(0, 124, W, 56, P.INK, ctx);
      ML.engine.rect(0, 124, W, 1, P.CREAM, ctx);
      ML.ui.bigTextWavy('THE MAN-LYMPICS', W / 2, 128, P.AMBER, 2, t, 1.4, ctx);
      ML.font.drawTextCentered((players + roster.length) + ' COMPETITORS.  EIGHT EVENTS.',
        W / 2, 150, P.CREAM, ctx);
      ML.font.drawTextCentered('ONE AFTERNOON.', W / 2, 162, P.STEEL, ctx);
    }

    return {
      key: 'tournament_intro',

      enter: function () { ML.engine.clearParticles(); },
      exit: function () { ML.sfx.stopAllLoops(); },

      update: function (dt) {
        t += dt;
        beatT += dt;

        if (!chimed) {
          chimed = true;
          if (beat === callIdx) { ML.sfx.play('honk'); ML.engine.shake(2, 0.3); }
          else if (beat === fallIdx) ML.sfx.play('crowd_cheer');
          else if (beat < roster.length) {
            ML.sfx.play(roster[beat].id === 'duke' ? 'sax_riff' : 'reveal');
          }
        }

        if (ML.input.justPressed('escape')) { ML.engine.push(ML.ui.pauseScene()); return; }

        var canSkip = t > CONFIG.MIN_SKIP;
        if (canSkip && ML.input.justPressed('enter')) { done(); return; }
        if ((canSkip && ML.input.justPressed('space')) || beatT >= lengthOf(beat)) {
          beat++;
          beatT = 0;
          chimed = false;
          ML.engine.clearParticles();
          if (beat >= BEATS) { done(); return; }
        }
      },

      draw: function (ctx) {
        ML.ui.backdrop(ctx, t, CONFIG.GROUND_Y);

        if (beat === callIdx) drawCallBeat(ctx);
        else if (beat === fallIdx) drawFallInBeat(ctx);
        else if (beat < roster.length) drawRivalBeat(ctx, roster[beat]);

        // top strip: where you are in the introductions, and how to get out
        ML.engine.rect(0, 0, W, 12, P.INK, ctx);
        ML.engine.rect(0, 12, W, 1, P.CHARCOAL, ctx);
        if (beat < roster.length) {
          ML.font.drawText('THE FIELD  ' + (beat + 1) + '/' + roster.length, 6, 3, P.STEEL, ctx);
        } else {
          ML.font.drawText('THE FIELD', 6, 3, P.STEEL, ctx);
        }
        if (t > CONFIG.MIN_SKIP) {
          ML.font.drawText('SPACE NEXT   ENTER SKIPS', 158, 3, P.GRAY, ctx);
        }
      }
    };
  }

  return { CONFIG: CONFIG, introScene: introScene, DOING: DOING };
})();
