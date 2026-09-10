/*
  ==========================================================================
  EVENT 2 - GRILL SERGEANT (grilling)
  ==========================================================================

  WHAT THE PLAYER DOES
  Six patties are on the grill at once. ARROWS move the tongs between them,
  SPACE flips whichever one is selected. Every patty has to be flipped TWICE:
  once to turn it over, once to take it off onto the plate. The event ends when
  all six are off the grill, one way or another.

  THE WHOLE POINT: THERE ARE NO METERS.
  Nothing on screen tells you how cooked anything is. You read it off the patty
  itself, and there are four tells, layered so there is always something to go on:

    1. COLOUR. Pink -> tan -> golden brown -> dark brown -> black. The golden
       brown stage is roughly where you want to flip.
    2. JUICES. Little bubbles well up on top of the patty as it approaches the
       flip window, thickest right when it is ready. This is the precise tell -
       colour gets you close, juices tell you NOW.
    3. SMOKE. Wisps start coming off a patty that has gone too far. If you can
       see smoke you are already late.
    4. SIZZLE. The sizzle rises in pitch as the hottest thing on the grill
       approaches burnt.

  The patties do NOT all come due at once - each one cooks at its own rate and
  goes on at a different moment, so they queue up. Divided attention is the
  event; if they all peaked together it would just be unplayable.

  There is no clock. Time passes (that IS the event - things cook), but nothing
  is counting down at you and dawdling costs you nothing except a burnt patty.

  WHERE THE DIFFICULTY KNOBS ARE
  Everything tweakable is in the CONFIG block below. In plain English:

    COOK_RATE .......... how fast patties cook. Bigger = harder.
    RATE_SPREAD ........ how differently each patty cooks, so they do not all
                         come due together. Bigger = more spread out = easier.
    START_STAGGER ...... seconds between patties going on the grill.
                         Bigger = more spread out = easier.
    PERFECT / BAND ..... the flip target (50) and how wide the perfect window
                         is either side of it. Bigger BAND = easier.
    FALLOFF ............ how forgiving it is outside the perfect window.
                         Bigger = easier.
    BURN_AT ............ past this a side scores NEGATIVE.
    RUIN_AT ............ past this the patty is a write-off (it sits there as a
                         cinder, which is the point).
    SMOKE_RATE ......... how obvious the smoke tell is.
    BUBBLE_* ........... when the juices tell appears. Widening
                         BUBBLE_AT..BUBBLE_END makes the tell easier to read.
    SCORE_PER_PATTY .... six perfect patties = 1000.

  If it feels too hard, the two knobs that help most are COOK_RATE (lower it)
  and PERFECT_BAND (raise it).
*/
window.ML = window.ML || {};
ML.events = ML.events || {};

ML.events.grilling = (function () {
  var P = ML.palette;

  var CONFIG = {
    // ---- pacing
    RESULT_TIME: 3,
    END_PAUSE: 1.0,          // beat after the last patty comes off

    // ---- the grill
    COLS: 3, ROWS: 2,        // six patties
    COOK_RATE: 4.2,          // cook points per second (a side is "done" at 50)
    RATE_SPREAD: 0.30,       // each patty cooks at 1 +/- this
    START_STAGGER: 1.6,      // seconds between patties going on

    // ---- what counts as a good flip
    PERFECT: 50,             // the ideal cook value to flip at
    PERFECT_BAND: 4,         // anything within +/- this is a perfect flip
    FALLOFF: 30,             // quality fades to zero this far outside the band
    BURN_AT: 85,             // past this the side scores negative
    RUIN_AT: 112,            // past this it is a write-off and stops cooking

    // ---- the tells
    BUBBLE_AT: 38,           // juices start welling up
    BUBBLE_PEAK: 50,         // thickest right on the money
    BUBBLE_END: 68,          // and dry up again once it is overdone
    SMOKE_AT: 68,            // wisps start
    SMOKE_RATE: 0.026,       // how thick the smoke gets past that. Bigger = more obvious
    SIZZLE_EVERY: 0.55,      // seconds between sizzle ticks

    // ---- score out of 1000
    SCORE_PER_PATTY: 167,    // six perfect patties = 1002, clamped to 1000
    BURN_PENALTY: -0.35,     // a burnt or binned side, as a fraction of a patty

    // ---- layout
    GRILL: { x: 44, y: 62, w: 232, h: 92 },
    COL_X: [92, 160, 228],
    ROW_Y: [92, 124],
    POP_TIME: 0.9
  };

  var TITLE = {
    number: 2,
    name: 'GRILL SERGEANT',
    joke: [
      'RULE 7: A MAN COOKS WITH HIS EYES.',
      'THERE IS NO TIMER. THERE IS NEVER A TIMER.'
    ],
    controls: [
      'ARROWS SELECT.  SPACE FLIPS.',
      'FLIP EACH TWICE. WATCH FOR THE JUICES.'
    ]
  };

  // ------------------------------------------------------------------ sprites
  /*
     Ten doneness stages, dithered between neighbouring palette colours so the
     ramp reads as smooth even though there are only sixteen colours in the
     whole game. Stage 4 is the golden brown you are aiming for.
  */
  var STAGES = [
    ['e', 'e'],   // 0  raw pink
    ['e', 'b'],   // 1  pink going tan
    ['b', 'b'],   // 2  tan
    ['b', 'a'],   // 3  tan going brown
    ['a', 'a'],   // 4  GOLDEN BROWN - the target
    ['a', '9'],   // 5  browning off
    ['9', '9'],   // 6  dark brown
    ['9', '1'],   // 7  very dark
    ['1', '1'],   // 8  charcoal
    ['0', '0']    // 9  cinder
  ];
  var RIM = ['b', 'a', 'a', '9', '9', '1', '1', '0', '0', '0'];

  var spritesReady = false;

  function makePatty(stage, seared) {
    var W = 26, H = 13;
    var g = ML.sprites.grid(W, H);
    var pair = STAGES[stage], rim = RIM[stage];
    // patties shrink and tighten up as they cook
    var shrink = stage * 0.16;
    var cx = (W - 1) / 2, cy = (H - 1) / 2;
    var rx = W / 2 - 1 - shrink, ry = H / 2 - 1 - shrink * 0.45;

    for (var y = 0; y < H; y++) {
      for (var x = 0; x < W; x++) {
        var dx = (x - cx) / rx, dy = (y - cy) / ry;
        var d = dx * dx + dy * dy;
        if (d > 1) continue;
        g[y][x] = (d > 0.62) ? rim : (((x + y) % 2) ? pair[1] : pair[0]);
      }
    }
    // grate marks branded across a patty that has been turned over
    if (seared) {
      for (var i = -1; i <= 1; i++) {
        var by = Math.round(cy + i * 3);
        for (var bx = 4; bx < W - 4; bx++) {
          if (g[by] && g[by][bx] !== ' ' && g[by][bx] !== '0') g[by][bx] = RIM[Math.min(9, stage + 2)];
        }
      }
    }
    ML.sprites.outline(g);
    return ML.sprites.strings(g);
  }

  /*
     The grill is deliberately DARK and low contrast. Reading the patty is the
     entire skill of this event, so the thing the patty sits on must stay out of
     the way - a busy bed of bright coals makes the patties impossible to judge.
     Near-black pit, charcoal bars, and only a handful of dim embers.
  */
  function makeGrill(w, h) {
    var g = ML.sprites.grid(w, h);
    ML.sprites.rect(g, 0, 0, w, h, '1');              // body
    ML.sprites.rect(g, 2, 3, w - 4, h - 6, '0');      // the pit, near black

    // a few embers glowing down in the coals - sparse, and never bright
    for (var i = 0; i < w - 14; i += 17) {
      var ey = 6 + ((i * 5) % (h - 14));
      ML.sprites.rect(g, i + 7, ey, 2, 1, (((i / 17) | 0) % 3 === 0) ? 'd' : '9');
    }

    // grate bars: charcoal on near-black, so they read as texture not clutter
    for (var b = 5; b < h - 5; b += 5) ML.sprites.rect(g, 2, b, w - 4, 2, '1');

    // steel frame around the outside
    ML.sprites.rect(g, 0, 0, w, 3, '3');
    ML.sprites.rect(g, 0, 0, 2, h, '2');
    ML.sprites.rect(g, w - 2, 0, 2, h, '2');
    ML.sprites.rect(g, 0, h - 3, w, 3, '2');
    ML.sprites.outline(g);
    return ML.sprites.strings(g);
  }

  function makeTongs() {
    var g = ML.sprites.grid(11, 14);
    ML.sprites.rect(g, 4, 0, 3, 6, '3');
    ML.sprites.limb(g, 4, 5, 1, 12, 2, '3');
    ML.sprites.limb(g, 6, 5, 9, 12, 2, '3');
    ML.sprites.outline(g);
    return ML.sprites.strings(g);
  }

  function ensureSprites() {
    if (spritesReady) return;
    for (var i = 0; i < STAGES.length; i++) {
      ML.sprites.add('gs_patty' + i, makePatty(i, false));
      ML.sprites.add('gs_seared' + i, makePatty(i, true));
    }
    ML.sprites.add('gs_grill', makeGrill(CONFIG.GRILL.w, CONFIG.GRILL.h));
    ML.sprites.add('gs_tongs', makeTongs());
    spritesReady = true;
  }

  // --------------------------------------------------------------- scoring
  function sideQuality(cook) {
    if (cook >= CONFIG.BURN_AT) return CONFIG.BURN_PENALTY;
    var off = Math.abs(cook - CONFIG.PERFECT);
    if (off <= CONFIG.PERFECT_BAND) return 1;
    return ML.clamp(1 - (off - CONFIG.PERFECT_BAND) / CONFIG.FALLOFF, 0, 1);
  }

  // The word the player sees on a flip. This is the only feedback about a side,
  // and it only appears once that side is already committed - so it teaches the
  // visual language without ever telling you about a patty still cooking.
  function verdict(cook, q) {
    if (q < 0) return { word: 'BURNT!', color: P.ORANGE };
    if (q >= 0.98) return { word: 'PERFECT!', color: P.ACCENT };
    if (q >= 0.65) return { word: cook < CONFIG.PERFECT ? 'GOOD, A TOUCH EARLY' : 'GOOD, A TOUCH LATE', color: P.AMBER };
    if (q >= 0.3) return { word: cook < CONFIG.PERFECT ? 'UNDERDONE' : 'OVERDONE', color: P.CREAM };
    return { word: cook < CONFIG.PERFECT ? 'RAW' : 'WAY OVERDONE', color: P.STEEL };
  }

  /*
     Cook value -> colour stage. NOT a straight division: the bands are tight
     around the flip window and loose at the extremes, so the colour changes
     most decisively exactly where the player has to make the decision. Stage 4
     (golden brown) lines up with the 45-55 perfect window.
  */
  var STAGE_AT = [15, 28, 38, 45, 55, 64, 74, 85, 100];
  function stageOf(cook) {
    for (var i = 0; i < STAGE_AT.length; i++) if (cook < STAGE_AT[i]) return i;
    return STAGES.length - 1;
  }

  // ------------------------------------------------------------------ scene
  function scene(opts) {
    opts = opts || {};
    ensureSprites();

    var s = {
      phase: 'title',
      phaseT: 0,
      t: 0,
      sel: 0,
      patties: [],
      plated: 0,
      resolved: 0,
      sizzleT: 0,
      message: '',
      messageColor: P.CREAM,
      messageT: 0,
      pops: [],
      finalScore: 0,
      endT: 0
    };

    for (var i = 0; i < 6; i++) {
      s.pops.push({ active: false, x: 0, y: 0, life: 0, text: '', color: P.CREAM });
    }

    var n = CONFIG.COLS * CONFIG.ROWS;
    var nextDelay = 0;
    for (var k = 0; k < n; k++) {
      var col = k % CONFIG.COLS, row = (k / CONFIG.COLS) | 0;
      // Cumulative gaps, so there is always a real pause between two patties
      // going on. (Randomising each delay independently let them collide.)
      nextDelay += CONFIG.START_STAGGER * (0.72 + Math.random() * 0.56);
      s.patties.push({
        cx: CONFIG.COL_X[col],
        cy: CONFIG.ROW_Y[row],
        cook: 0,
        side: 0,                  // 0 = first side down, 1 = turned over
        state: 'waiting',         // waiting | cooking | plated | ruined
        delay: nextDelay,
        rate: CONFIG.COOK_RATE * (1 + (Math.random() * 2 - 1) * CONFIG.RATE_SPREAD),
        qA: 0, qB: 0,
        seed: Math.random() * 100,
        flash: 0
      });
    }

    function pop(text, color, x, y) {
      var slot = null;
      for (var i = 0; i < s.pops.length; i++) if (!s.pops[i].active) { slot = s.pops[i]; break; }
      if (!slot) slot = s.pops[0];
      slot.active = true;
      slot.x = x; slot.y = y;
      slot.life = CONFIG.POP_TIME;
      slot.text = text; slot.color = color;
    }

    function say(msg, color) { s.message = msg; s.messageColor = color; s.messageT = 1.1; }

    function hottest() {
      var h = 0;
      for (var i = 0; i < s.patties.length; i++) {
        var p = s.patties[i];
        if (p.state === 'cooking' && p.cook > h) h = p.cook;
      }
      return h;
    }

    function moveSel(dx, dy) {
      var col = s.sel % CONFIG.COLS, row = (s.sel / CONFIG.COLS) | 0;
      col = (col + dx + CONFIG.COLS) % CONFIG.COLS;
      row = (row + dy + CONFIG.ROWS) % CONFIG.ROWS;
      s.sel = row * CONFIG.COLS + col;
      ML.sfx.play('blip');
    }

    function flip() {
      var p = s.patties[s.sel];
      if (p.state === 'waiting') { ML.sfx.play('back'); return; }
      if (p.state !== 'cooking') { ML.sfx.play('back'); return; }

      var q = sideQuality(p.cook);
      var v = verdict(p.cook, q);
      ML.sfx.play('flip');
      p.flash = 0.18;

      ML.engine.burst(p.cx, p.cy - 4, 7, {
        colors: [P.AMBER, P.ORANGE, P.CREAM], speedMin: 15, speedMax: 55,
        life: 0.35, grav: 90, spread: Math.PI, dir: -Math.PI / 2, size: 1
      });

      if (p.side === 0) {
        p.qA = q;
        p.side = 1;
        p.cook = 0;                       // the raw side goes down
        say(v.word, v.color);
        pop(v.word, v.color, p.cx, p.cy - 12);
      } else {
        p.qB = q;
        p.state = 'plated';
        s.plated++; s.resolved++;
        var patty = (p.qA + p.qB) / 2;
        var pts = Math.round(patty * CONFIG.SCORE_PER_PATTY);
        say(v.word, v.color);
        pop((pts >= 0 ? '+' : '') + pts, pts > 100 ? P.ACCENT : (pts > 0 ? P.AMBER : P.ORANGE), p.cx, p.cy - 12);
        ML.sfx.play(patty >= 0.9 ? 'confirm' : 'thud');
        if (patty >= 0.9) ML.engine.shake(1, 0.1);
      }
    }

    function computeScore() {
      var total = 0;
      for (var i = 0; i < s.patties.length; i++) {
        var p = s.patties[i];
        if (p.state === 'ruined') total += CONFIG.BURN_PENALTY;
        else total += (p.qA + p.qB) / 2;
      }
      return Math.round(ML.clamp(total * CONFIG.SCORE_PER_PATTY, 0, 1000));
    }

    function finish() {
      s.finalScore = computeScore();
      s.phase = 'result'; s.phaseT = 0;
      ML.sfx.play(s.finalScore >= 500 ? 'crowd_cheer' : 'crowd_groan');
    }

    // ---------------------------------------------------------------- update
    function updatePlay(dt) {
      if (ML.input.justPressed('escape')) { ML.engine.push(ML.ui.pauseScene()); return; }

      if (s.messageT > 0) s.messageT -= dt;

      for (var i = 0; i < s.pops.length; i++) {
        var pp = s.pops[i];
        if (!pp.active) continue;
        pp.life -= dt; pp.y -= 16 * dt;
        if (pp.life <= 0) pp.active = false;
      }

      // --- cook everything
      for (var k = 0; k < s.patties.length; k++) {
        var p = s.patties[k];
        if (p.flash > 0) p.flash -= dt;

        if (p.state === 'waiting') {
          p.delay -= dt;
          if (p.delay <= 0) { p.state = 'cooking'; ML.sfx.play('sizzle', { pitch: 1 }); }
          continue;
        }
        if (p.state !== 'cooking') continue;

        p.cook += p.rate * dt;

        // Smoke off anything that has gone too far. This is a TELL, so it has
        // to be unmissable against the dark grill - pale, and enough of it.
        if (p.cook > CONFIG.SMOKE_AT && Math.random() < (p.cook - CONFIG.SMOKE_AT) * CONFIG.SMOKE_RATE) {
          var bad = p.cook > CONFIG.BURN_AT;
          ML.engine.spawn({
            x: p.cx + ML.rand(-7, 7), y: p.cy - 4,
            vx: ML.rand(-5, 5), vy: ML.rand(-26, -14),
            life: ML.rand(0.9, 1.7), color: bad ? P.CREAM : P.STEEL,
            size: bad ? 2 : 1, drag: 0.99, shrink: bad
          });
        }

        if (p.cook >= CONFIG.RUIN_AT) {
          p.state = 'ruined'; s.resolved++;
          if (p.side === 0) { p.qA = CONFIG.BURN_PENALTY; p.qB = CONFIG.BURN_PENALTY; }
          else p.qB = CONFIG.BURN_PENALTY;
          say('THAT ONE IS GONE.', P.ORANGE);
          pop('RUINED', P.ORANGE, p.cx, p.cy - 12);
          ML.sfx.play('crowd_groan');
          ML.engine.burst(p.cx, p.cy - 3, 10, {
            colors: [P.GRAY, P.CHARCOAL], speedMin: 10, speedMax: 40,
            life: 1.0, spread: Math.PI, dir: -Math.PI / 2, size: 1
          });
        }
      }

      // --- the sizzle tell: pitch tracks the hottest thing on the grill
      s.sizzleT -= dt;
      if (s.sizzleT <= 0) {
        s.sizzleT = CONFIG.SIZZLE_EVERY;
        var h = hottest();
        if (h > 0) ML.sfx.play('sizzle', { pitch: 1 + ML.clamp(h / CONFIG.BURN_AT, 0, 1.3) });
      }

      // --- input
      if (ML.input.justPressed('left')) moveSel(-1, 0);
      if (ML.input.justPressed('right')) moveSel(1, 0);
      if (ML.input.justPressed('up')) moveSel(0, -1);
      if (ML.input.justPressed('down')) moveSel(0, 1);
      if (ML.input.justPressed('space')) flip();

      // --- done?
      if (s.resolved >= s.patties.length) {
        s.endT += dt;
        if (s.endT >= CONFIG.END_PAUSE) finish();
      }
    }

    // ----------------------------------------------------------------- draw
    function drawGrill(ctx) {
      var G = CONFIG.GRILL;
      ML.drawSprite('gs_grill', G.x, G.y, null, ctx);
    }

    function drawPatty(ctx, p) {
      if (p.state === 'plated') return;
      if (p.state === 'waiting') {
        // an empty spot on the grate, waiting for the next one
        ML.engine.rect(p.cx - 10, p.cy - 1, 20, 1, P.CHARCOAL, ctx);
        return;
      }

      var st = stageOf(p.cook);
      var name = (p.side === 1 ? 'gs_seared' : 'gs_patty') + st;
      var sz = ML.sprites.size(name);
      ML.drawSprite(name, p.cx - sz.w / 2, p.cy - sz.h / 2, p.flash > 0 ? { tint: P.CREAM } : null, ctx);

      if (p.state === 'ruined') return;

      // --- the JUICES tell. Bubbles well up as the side approaches the flip
      //     window and dry off again once it is overdone.
      var b = 0;
      if (p.cook > CONFIG.BUBBLE_AT && p.cook < CONFIG.BUBBLE_END) {
        b = p.cook <= CONFIG.BUBBLE_PEAK
          ? (p.cook - CONFIG.BUBBLE_AT) / (CONFIG.BUBBLE_PEAK - CONFIG.BUBBLE_AT)
          : 1 - (p.cook - CONFIG.BUBBLE_PEAK) / (CONFIG.BUBBLE_END - CONFIG.BUBBLE_PEAK);
      }
      var count = Math.round(b * 7);
      for (var i = 0; i < count; i++) {
        var a = p.seed + i * 2.4;
        var bx = p.cx + Math.round(Math.cos(a) * 7);
        var by = p.cy + Math.round(Math.sin(a * 1.7) * 3);
        // each bubble swells and pops on its own little cycle
        var life = (s.t * 1.6 + i * 0.37 + p.seed) % 1;
        if (life > 0.75) continue;
        var big = life > 0.35;
        ML.engine.rect(bx, by, big ? 2 : 1, big ? 2 : 1,
          big ? P.CREAM : P.AMBER, ctx);
      }
    }

    function drawCursor(ctx) {
      var p = s.patties[s.sel];
      var pulse = (Math.sin(s.t * 8) > 0) ? 1 : 0;
      var x = p.cx - 16, y = p.cy - 10, w = 32, h = 20;
      var c = P.ACCENT;
      // corner brackets
      ML.engine.rect(x, y - pulse, 5, 1, c, ctx);
      ML.engine.rect(x, y - pulse, 1, 5, c, ctx);
      ML.engine.rect(x + w - 5, y - pulse, 5, 1, c, ctx);
      ML.engine.rect(x + w - 1, y - pulse, 1, 5, c, ctx);
      ML.engine.rect(x, y + h - 5 + pulse, 1, 5, c, ctx);
      ML.engine.rect(x, y + h - 1 + pulse, 5, 1, c, ctx);
      ML.engine.rect(x + w - 1, y + h - 5 + pulse, 1, 5, c, ctx);
      ML.engine.rect(x + w - 5, y + h - 1 + pulse, 5, 1, c, ctx);
      ML.drawSprite('gs_tongs', p.cx - 5, p.cy - 27 - pulse, null, ctx);
    }

    function drawHud(ctx) {
      ML.engine.rect(0, 0, 320, 12, P.INK, ctx);
      ML.engine.rect(0, 12, 320, 1, P.CHARCOAL, ctx);
      ML.font.drawText('PLATED ' + s.plated + '/' + s.patties.length, 6, 3, P.CREAM, ctx);

      var onGrill = 0;
      for (var i = 0; i < s.patties.length; i++) if (s.patties[i].state === 'cooking') onGrill++;
      ML.font.drawText('ON THE GRILL ' + onGrill, 190, 3, P.CREAM, ctx);
    }

    return {
      key: 'grilling',
      name: TITLE.name,

      enter: function () { ML.engine.clearParticles(); },
      exit: function () { ML.sfx.stopAllLoops(); },

      update: function (dt) {
        s.t += dt;
        s.phaseT += dt;

        if (s.phase === 'title') {
          if (ML.ui.titleDone(s.phaseT)) {
            s.phase = 'play'; s.phaseT = 0;
            ML.sfx.play('confirm');
          }
          return;
        }

        if (s.phase === 'result') {
          if (s.phaseT >= CONFIG.RESULT_TIME || ML.input.justPressed('enter')) {
            var perfect = 0, burnt = 0;
            for (var i = 0; i < s.patties.length; i++) {
              var p = s.patties[i];
              if (p.state === 'ruined') { burnt++; continue; }
              if (p.qA >= 0.98 && p.qB >= 0.98) perfect++;
              if (p.qA < 0 || p.qB < 0) burnt++;
            }
            ML.engine.replace(ML.ui.resultsScene({
              key: 'grilling',
              name: TITLE.name,
              score: s.finalScore,
              lines: [
                'PLATED: ' + s.plated + ' OF ' + s.patties.length,
                'COOKED PERFECTLY: ' + perfect,
                'BURNT: ' + burnt
              ]
            }));
          }
          return;
        }

        updatePlay(dt);
      },

      draw: function (ctx) {
        ML.ui.backdrop(ctx, s.t, 150);
        drawGrill(ctx);

        for (var i = 0; i < s.patties.length; i++) drawPatty(ctx, s.patties[i]);

        var live = (s.phase !== 'title' && s.phase !== 'result');
        if (live) drawCursor(ctx);

        ML.engine.drawParticles(ctx);

        for (var j = 0; j < s.pops.length; j++) {
          var pp = s.pops[j];
          if (pp.active) ML.font.drawTextShadowCentered(pp.text, pp.x, pp.y, pp.color, ctx);
        }

        drawHud(ctx);

        if (live) {
          if (s.messageT > 0) {
            ML.font.drawTextWavyCentered(s.message, 160, 20, s.messageColor, s.t, 1.2, 0.7, ctx);
          }
          ML.font.drawTextShadowCentered('ARROWS SELECT   SPACE FLIPS', 160, 170, P.CREAM, ctx);
        }

        if (s.phase === 'title') {
          ML.ui.drawTitleCard(TITLE, s.t, ctx);
        } else if (s.phase === 'result') {
          ML.ui.drawResultCard({
            name: TITLE.name,
            score: s.finalScore,
            lines: ['PLATED: ' + s.plated + ' OF ' + s.patties.length],
            footer: 'ENTER SKIPS'
          }, s.phaseT, ctx);
        }
      }
    };
  }

  return { scene: scene, CONFIG: CONFIG, name: TITLE.name, key: 'grilling' };
})();
