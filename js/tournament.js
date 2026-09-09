/*
  ==========================================================================
  TOURNAMENT - the eight events run back to back against the six rivals
  ==========================================================================

  All eight events in a fixed order. After each one you get a results screen
  where the opponents' scores tick in one at a time, then a standings screen
  showing cumulative medal points. After the eighth, a podium.

  HOW SCORING WORKS
    Every event hands back a raw score out of 1000. All seven competitors are
    ranked on that raw score and awarded medal points 10-8-6-5-4-3-2-1 for
    first through eighth. (Seven compete in Tournament; the eighth slot is
    there for Versus, which adds a second human.)

    Cumulative points are always RECOMPUTED from the stored raw scores rather
    than added up as we go. That matters, because one of the rivals edits his
    earlier scores, and the table has to be able to answer for itself.

  HOW THE EVENTS PLUG IN
    Not one event file knows this screen exists. Every event finishes by
    calling ML.ui.resultsScene(payload), and that function asks this module
    whether a tournament is running. If it is, the payload comes here instead
    of going to the Free Play result screen. So adding or fixing an event never
    involves touching the tournament, and vice versa.

  WHERE THE KNOBS ARE
    MEDAL_POINTS ....... the points table.
    EVENT_ORDER ........ which events, in what order.
    REVEAL_GAP ......... seconds between opponent scores landing.
    TICKER_TIME ........ how long each score spins before it settles.
    ROW_SLIDE .......... how long a standings row takes to move position.
    PODIUM_STEP ........ seconds between third, second and first appearing.

  Opponent strength lives in js/opponents.js, not here - BASE and PER_POINT at
  the top of that file are the dials for "the field is too easy / too hard".
*/
window.ML = window.ML || {};

ML.tournament = (function () {
  var P = ML.palette;
  var W = 320, H = 180;

  var CONFIG = {
    MEDAL_POINTS: [10, 8, 6, 5, 4, 3, 2, 1],
    EVENT_ORDER: [
      'pouring', 'grilling', 'chopping', 'mowing',
      'jaropening', 'parking', 'creampuffs', 'groceries'
    ],

    // ---- results screen
    REVEAL_START: 0.9,       // beat before the first opponent lands
    REVEAL_GAP: 0.44,        // between one landing and the next starting
    TICKER_TIME: 0.30,       // how long a score spins before it settles
    VERDICT_DELAY: 0.5,      // beat after the last one before the verdict

    // ---- standings screen
    ROW_SLIDE: 0.55,         // how long a row takes to move to its new place
    SLIDE_DELAY: 0.45,       // how long the old order sits there first
    MIN_DWELL: 0.6,          // ENTER does nothing before this

    // ---- the revision (see below)
    REVISE_CHANCE: 0.25,
    REVISE_MIN: 100,
    REVISE_MAX: 200,
    REVISE_AT_MIN: 0.9,      // when the flicker happens, after the rows settle
    REVISE_AT_MAX: 2.1,
    REVISE_WINDOW: 30,       // frames you have to react in

    // ---- podium
    PODIUM_STEP: 0.9
  };

  // ------------------------------------------------------------------ state
  var state = null;

  function competitors() {
    var out = [{ id: 'player', name: 'YOU', isPlayer: true }];
    var r = ML.opponents.roster;
    for (var i = 0; i < r.length; i++) {
      out.push({ id: r[i].id, name: r[i].name, isPlayer: false });
    }
    return out;
  }

  function begin() {
    state = {
      round: 0,
      order: CONFIG.EVENT_ORDER.slice(),
      raw: {},            // id -> array of raw scores, one per round
      flags: {},          // id -> array of flag objects from opponents.js
      revisedRounds: {},  // rounds already meddled with, so it happens once
      caught: 0,
      stood: 0
    };
    var c = competitors();
    for (var i = 0; i < c.length; i++) {
      state.raw[c[i].id] = [];
      state.flags[c[i].id] = [];
    }
    launchNext();
  }

  function active() { return !!state; }
  function abandon() { state = null; }
  function snapshot() { return state; }

  function launchNext() {
    if (!state) return;
    while (state.round < state.order.length && !ML.events[state.order[state.round]]) {
      state.round++;                       // an event that is not built yet
    }
    if (state.round >= state.order.length) {
      ML.engine.replace(podiumScene());
      return;
    }
    ML.engine.replace(ML.events[state.order[state.round]].scene({ mode: 'tournament' }));
  }

  // Called from ML.ui.resultsScene when a tournament is running.
  function record(payload) {
    var r = state.round;
    state.raw.player[r] = Math.round(ML.clamp(payload.score || 0, 0, 1000));
    state.flags.player[r] = {};
    var rolled = ML.opponents.generateAll(state.order[r], r);
    for (var i = 0; i < rolled.length; i++) {
      state.raw[rolled[i].id][r] = rolled[i].score;
      state.flags[rolled[i].id][r] = rolled[i].flags || {};
    }
  }

  // ------------------------------------------------------------------ maths
  function rankOf(r) {
    var c = competitors(), rows = [];
    for (var i = 0; i < c.length; i++) {
      rows.push({
        id: c[i].id, name: c[i].name, isPlayer: c[i].isPlayer,
        score: state.raw[c[i].id][r] === undefined ? 0 : state.raw[c[i].id][r],
        flags: state.flags[c[i].id][r] || {}
      });
    }
    rows.sort(function (a, b) { return b.score - a.score; });
    for (var j = 0; j < rows.length; j++) {
      rows[j].place = j + 1;
      rows[j].points = CONFIG.MEDAL_POINTS[j] === undefined ? 0 : CONFIG.MEDAL_POINTS[j];
    }
    return rows;
  }

  /*
     Cumulative points through round `last`, rebuilt from the raw scores every
     single time. Nothing is banked, so if an earlier score changes the table
     simply tells the truth about the new numbers.
  */
  function standingsThrough(last) {
    var c = competitors(), totals = {}, rawTotals = {}, i, r;
    for (i = 0; i < c.length; i++) { totals[c[i].id] = 0; rawTotals[c[i].id] = 0; }
    for (r = 0; r <= last; r++) {
      if (state.raw.player[r] === undefined) continue;
      var rows = rankOf(r);
      for (i = 0; i < rows.length; i++) {
        totals[rows[i].id] += rows[i].points;
        rawTotals[rows[i].id] += rows[i].score;
      }
    }
    var out = [];
    for (i = 0; i < c.length; i++) {
      out.push({
        id: c[i].id, name: c[i].name, isPlayer: c[i].isPlayer,
        points: totals[c[i].id], raw: rawTotals[c[i].id]
      });
    }
    out.sort(function (a, b) { return (b.points - a.points) || (b.raw - a.raw); });
    for (i = 0; i < out.length; i++) out[i].place = i + 1;
    return out;
  }

  function eventName(key) {
    var list = ML.ui.EVENT_LIST;
    for (var i = 0; i < list.length; i++) {
      if (list[i].key === key) return list[i].label.replace(/^\d+\s+/, '');
    }
    return (ML.events[key] && ML.events[key].name) || key.toUpperCase();
  }

  // ------------------------------------------------------------- draw bits
  function panel(ctx, x, y, w, h) {
    ML.engine.rect(x + 2, y + 2, w, h, P.INK, ctx);
    ML.engine.rect(x, y, w, h, P.CHARCOAL, ctx);
    ML.engine.frameRect(x, y, w, h, P.CREAM, ctx);
  }

  function rightText(str, rightX, y, col, ctx) {
    ML.font.drawText(str, rightX - ML.font.width(str), y, col, ctx);
  }

  function medalFor(place) {
    return place === 1 ? 'medal_gold' : place === 2 ? 'medal_silver'
      : place === 3 ? 'medal_bronze' : null;
  }

  // A short word for whatever dramatic thing opponents.js flagged.
  function noteFor(flags) {
    if (!flags) return null;
    if (flags.catastrophe) return { text: 'SMASH!', col: P.ORANGE };
    if (flags.choke) return { text: 'CHOKED', col: P.ORANGE };
    if (flags.unstoppable) return { text: 'EASY', col: P.AMBER };
    return null;
  }

  // ================================================== EVENT RESULTS SCREEN
  function eventResultScene(payload) {
    record(payload);

    var r = state.round;
    var key = state.order[r];
    var t = 0;
    var order = competitors();                  // player first, then the roster
    var revealed = 0;                           // how many OPPONENTS have landed
    var opponentsOnly = order.slice(1);
    var ranked = rankOf(r);
    var placeOf = {}, pointsOf = {};
    for (var i = 0; i < ranked.length; i++) {
      placeOf[ranked[i].id] = ranked[i].place;
      pointsOf[ranked[i].id] = ranked[i].points;
    }
    var shakeDone = {}, saxPlayed = false;
    var allInAt = CONFIG.REVEAL_START + opponentsOnly.length * CONFIG.REVEAL_GAP;

    function revealState(idx) {
      // idx is an index into opponentsOnly
      var startAt = CONFIG.REVEAL_START + idx * CONFIG.REVEAL_GAP;
      if (t < startAt) return 'hidden';
      if (t < startAt + CONFIG.TICKER_TIME) return 'ticking';
      return 'shown';
    }

    return {
      key: 'tournament_result',
      enter: function () { ML.engine.clearParticles(); },
      exit: function () { ML.sfx.stopAllLoops(); },

      update: function (dt) {
        t += dt;

        // land each opponent's score with a noise, and dramatise the flags
        for (var i = 0; i < opponentsOnly.length; i++) {
          var landAt = CONFIG.REVEAL_START + i * CONFIG.REVEAL_GAP + CONFIG.TICKER_TIME;
          if (t >= landAt && !shakeDone[i]) {
            shakeDone[i] = true;
            revealed = Math.max(revealed, i + 1);
            var id = opponentsOnly[i].id;
            var fl = state.flags[id][r] || {};
            if (fl.catastrophe) { ML.sfx.play('crash'); ML.engine.shake(4, 0.35); }
            else if (fl.choke) { ML.sfx.play('crowd_groan'); }
            else { ML.sfx.play('reveal'); }
          }
        }

        if (!saxPlayed && t >= allInAt) {
          saxPlayed = true;
          if (placeOf.duke <= 3) ML.sfx.play('sax_riff');   // his party trick
          else if (placeOf.player === 1) ML.sfx.play('fanfare');
        }

        if (ML.input.justPressed('escape')) { ML.engine.push(ML.ui.pauseScene()); return; }

        if (t > allInAt + CONFIG.VERDICT_DELAY
          && (ML.input.justPressed('enter') || ML.input.justPressed('space'))) {
          ML.sfx.play('confirm');
          ML.engine.replace(standingsScene());
        }
      },

      draw: function (ctx) {
        ML.ui.backdrop(ctx, t, 124);
        ML.ui.dither(ctx);
        panel(ctx, 8, 4, 304, 172);

        ML.font.drawTextCentered('EVENT ' + (r + 1) + ' OF ' + state.order.length,
          W / 2, 10, P.AMBER, ctx);
        ML.font.drawTextCentered(eventName(key), W / 2, 20, P.CREAM, ctx);
        ML.engine.rect(18, 30, 284, 1, P.GRAY, ctx);

        for (var i = 0; i < order.length; i++) {
          var c = order[i];
          var y = 36 + i * 13;
          var isPlayer = c.isPlayer;
          var st = isPlayer ? 'shown' : revealState(i - 1);

          if (isPlayer) ML.engine.rect(14, y - 2, 292, 11, P.STEEL, ctx);

          var nameCol = isPlayer ? P.INK : P.CREAM;
          ML.font.drawText(c.name, 30, y, nameCol, ctx);

          if (st === 'hidden') {
            ML.font.drawText('- - -', 200, y, P.GRAY, ctx);
          } else if (st === 'ticking') {
            rightText(String((Math.random() * 1000) | 0), 236, y, P.STEEL, ctx);
          } else {
            var sc = state.raw[c.id][r];
            rightText(String(sc), 236, y, isPlayer ? P.INK : P.ACCENT, ctx);

            // medals only once everything is in, or they would be a lie
            if (t >= allInAt) {
              var m = medalFor(placeOf[c.id]);
              if (m) ML.drawSprite(m, 16, y - 3, null, ctx);
              else ML.font.drawText(String(placeOf[c.id]), 18, y, P.GRAY, ctx);
              var note = noteFor(state.flags[c.id][r]);
              if (note) ML.font.drawText(note.text, 244, y, note.col, ctx);
            }
          }
        }

        ML.engine.rect(18, 128, 284, 1, P.GRAY, ctx);

        if (t >= allInAt + CONFIG.VERDICT_DELAY) {
          var pl = placeOf.player, pts = pointsOf.player;
          var suffix = pl === 1 ? 'ST' : pl === 2 ? 'ND' : pl === 3 ? 'RD' : 'TH';
          ML.font.drawTextCentered('YOU FINISHED ' + pl + suffix + '   PLUS ' + pts + ' POINTS',
            W / 2, 136, pl <= 3 ? P.ACCENT : P.CREAM, ctx);
          if (Math.floor(t * 1.6) % 2 === 0) {
            ML.font.drawTextCentered('PRESS ENTER', W / 2, 160, P.AMBER, ctx);
          }
        } else {
          ML.font.drawTextCentered('THE FIELD IS COMING IN...', W / 2, 136, P.STEEL, ctx);
        }
      }
    };
  }

  // ====================================================== STANDINGS SCREEN
  /*
     Cumulative medal points. Rows start in the order they were in BEFORE this
     event and slide to their new places, so you can see who you just passed.

     One of the rivals also keeps his own records here. That behaviour is
     deliberately not described to the player anywhere, in the game or on
     screen - the only thing it ever puts in front of them is a single frame
     of a differently coloured row.
  */
  function standingsScene(opts) {
    opts = opts || {};
    var isFinal = !!opts.final;
    var t = 0;

    var firstBoard = (state.round === 0);
    var before = firstBoard ? standingsThrough(state.round) : standingsThrough(state.round - 1);
    var beforeIdx = {}, i;
    for (i = 0; i < before.length; i++) beforeIdx[before[i].id] = i;

    // the meddle
    var reviseAt = null, revision = null, flickerFrame = -1, windowFrames = -1;
    var verdict = null;                      // 'caught' | 'stood'
    var frame = 0;
    if (!isFinal && state.round >= 1 && Math.random() < CONFIG.REVISE_CHANCE) {
      var options = [];
      for (i = 0; i < state.round; i++) {
        if (!state.revisedRounds[i] && state.raw.stalin[i] !== undefined
          && state.raw.stalin[i] < 1000) options.push(i);
      }
      if (options.length) {
        revision = {
          round: options[(Math.random() * options.length) | 0],
          amount: Math.round(CONFIG.REVISE_MIN
            + Math.random() * (CONFIG.REVISE_MAX - CONFIG.REVISE_MIN))
        };
        reviseAt = CONFIG.SLIDE_DELAY + CONFIG.ROW_SLIDE
          + CONFIG.REVISE_AT_MIN + Math.random() * (CONFIG.REVISE_AT_MAX - CONFIG.REVISE_AT_MIN);
      }
    }

    // rows are re-read every frame, because the table can change underneath us
    function rows() { return standingsThrough(state.round); }

    function slot(id, now) {
      var to = 0, list = now;
      for (var k = 0; k < list.length; k++) if (list[k].id === id) { to = k; break; }
      var from = beforeIdx[id] === undefined ? to : beforeIdx[id];
      var p = ML.clamp((t - CONFIG.SLIDE_DELAY) / CONFIG.ROW_SLIDE, 0, 1);
      p = p * p * (3 - 2 * p);                        // ease
      return ML.lerp(from, to, p);
    }

    return {
      key: 'tournament_standings',
      enter: function () { ML.engine.clearParticles(); if (isFinal) ML.sfx.play('fanfare'); },

      update: function (dt) {
        t += dt;
        frame++;

        if (revision && reviseAt !== null && t >= reviseAt && flickerFrame < 0) {
          // applied straight away and quietly; the only tell is one frame of colour
          flickerFrame = frame;
          windowFrames = CONFIG.REVISE_WINDOW;
          state.raw.stalin[revision.round] = Math.round(ML.clamp(
            state.raw.stalin[revision.round] + revision.amount, 0, 1000));
          state.revisedRounds[revision.round] = true;
        }

        if (windowFrames > 0) {
          windowFrames--;
          if (ML.input.anyPressed()) {
            state.raw.stalin[revision.round] -= revision.amount;
            state.revisedRounds[revision.round] = false;
            verdict = 'caught';
            state.caught++;
            windowFrames = 0;
            ML.sfx.play('crowd_groan');
            ML.engine.shake(2, 0.2);
            return;                          // that keypress is spent on catching him
          }
          if (windowFrames === 0) { verdict = 'stood'; state.stood++; }
        }

        if (ML.input.justPressed('escape')) { ML.engine.push(ML.ui.pauseScene()); return; }

        if (t > CONFIG.MIN_DWELL
          && (ML.input.justPressed('enter') || ML.input.justPressed('space'))) {
          ML.sfx.play('confirm');
          if (isFinal) { abandon(); ML.engine.reset(ML.ui.titleScene()); return; }
          state.round++;
          launchNext();
        }
      },

      draw: function (ctx) {
        var list = rows();
        ML.ui.backdrop(ctx, t, 124);
        ML.ui.dither(ctx);
        panel(ctx, 8, 4, 304, 172);

        var header = isFinal ? 'FINAL STANDINGS'
          : 'STANDINGS - AFTER EVENT ' + (state.round + 1) + ' OF ' + state.order.length;
        ML.font.drawTextCentered(header, W / 2, 10, P.AMBER, ctx);
        ML.engine.rect(18, 20, 284, 1, P.GRAY, ctx);

        var maxPts = 1;
        for (var i = 0; i < list.length; i++) maxPts = Math.max(maxPts, list[i].points);

        for (i = 0; i < list.length; i++) {
          var row = list[i];
          var y = Math.round(28 + slot(row.id, list) * 17);
          var moved = (beforeIdx[row.id] === undefined ? i : beforeIdx[row.id]) - i;

          // the one frame of colour
          var flicker = (flickerFrame >= 0 && frame === flickerFrame && row.id === 'stalin');
          if (row.isPlayer) ML.engine.rect(14, y - 3, 292, 15, P.STEEL, ctx);
          else if (flicker) ML.engine.rect(14, y - 3, 292, 15, P.WOOD_DARK, ctx);

          var place = i + 1;
          var m = medalFor(place);
          if (m) ML.drawSprite(m, 18, y - 1, null, ctx);
          else ML.font.drawText(String(place), 20, y + 2, P.GRAY, ctx);

          ML.font.drawText(row.name, 34, y + 2, row.isPlayer ? P.INK : P.CREAM, ctx);

          if (!firstBoard && moved > 0) ML.font.drawText('+', 128, y + 2, P.GRASS, ctx);
          else if (!firstBoard && moved < 0) ML.font.drawText('-', 128, y + 2, P.ORANGE, ctx);

          // a bar so the gaps are readable at a glance
          var bw = Math.round(96 * (row.points / maxPts));
          ML.engine.rect(150, y + 2, 96, 7, P.INK, ctx);
          ML.engine.rect(150, y + 2, bw, 7, row.isPlayer ? P.ACCENT : P.STEEL, ctx);
          rightText(String(row.points), 296, y + 2, row.isPlayer ? P.INK : P.AMBER, ctx);
        }

        ML.engine.rect(18, 146, 284, 1, P.GRAY, ctx);

        if (verdict === 'caught') {
          ML.font.drawTextCentered('CAUGHT', W / 2, 152, P.ORANGE, ctx);
        } else if (!isFinal) {
          var nextKey = state.order[state.round + 1];
          ML.font.drawTextCentered(
            nextKey ? 'NEXT: ' + eventName(nextKey) : 'NEXT: THE PODIUM',
            W / 2, 152, P.STEEL, ctx);
        }

        if (Math.floor(t * 1.6) % 2 === 0) {
          ML.font.drawTextCentered(isFinal ? 'PRESS ENTER FOR THE TITLE' : 'PRESS ENTER',
            W / 2, 164, P.AMBER, ctx);
        }
      }
    };
  }

  // ========================================================= PODIUM SCREEN
  function podiumScene() {
    var t = 0;
    var final = standingsThrough(state.order.length - 1);
    var top3 = final.slice(0, 3);
    var shown = 0;
    var chime = {};

    // 2nd on the left, 1st in the middle and highest, 3rd on the right
    var SLOTS = [
      { place: 2, cx: 74, h: 30 },
      { place: 1, cx: 160, h: 44 },
      { place: 3, cx: 246, h: 20 }
    ];
    var GROUND = 152;
    var REVEAL_ORDER = [3, 2, 1];

    function rowFor(place) { return top3[place - 1]; }
    function spriteFor(row, place) {
      var base = row.isPlayer ? 'player' : row.id;
      // Arnold flexes. Everyone else just enjoys it.
      if (row.id === 'arnold') {
        return base + (Math.floor(t * 4) % 2 ? '_strain' : '_win');
      }
      return base + '_win';
    }

    return {
      key: 'tournament_podium',
      enter: function () { ML.engine.clearParticles(); ML.sfx.play('crowd_cheer'); },

      update: function (dt) {
        t += dt;
        var want = ML.clamp(Math.floor(t / CONFIG.PODIUM_STEP), 0, 3);
        while (shown < want) {
          shown++;
          var place = REVEAL_ORDER[shown - 1];
          if (!chime[place]) {
            chime[place] = true;
            ML.sfx.play(place === 1 ? 'fanfare' : 'reveal');
            if (place === 1) {
              ML.engine.burst(160, 90, 40, {
                colors: [P.AMBER, P.ACCENT, P.CREAM], speedMin: 30, speedMax: 130,
                life: 1.4, grav: 60, spread: Math.PI * 2, size: 1
              });
            }
            var row = rowFor(place);
            if (row && row.id === 'duke') ML.sfx.play('sax_riff');
          }
        }

        if (ML.input.justPressed('escape')) { ML.engine.push(ML.ui.pauseScene()); return; }
        if (shown >= 3 && (ML.input.justPressed('enter') || ML.input.justPressed('space'))) {
          ML.sfx.play('confirm');
          state.round = state.order.length - 1;      // so the final table reads right
          ML.engine.replace(standingsScene({ final: true }));
        }
      },

      draw: function (ctx) {
        ML.ui.backdrop(ctx, t, GROUND);
        ML.font.drawTextShadowCentered('THE PODIUM', W / 2, 10, P.ACCENT, ctx);

        for (var i = 0; i < SLOTS.length; i++) {
          var s = SLOTS[i];
          var revealIdx = REVEAL_ORDER.indexOf(s.place);
          if (shown <= revealIdx) continue;
          var row = rowFor(s.place);
          if (!row) continue;

          var top = GROUND - s.h;
          ML.engine.rect(s.cx - 22, top, 44, s.h, P.WOOD, ctx);
          ML.engine.rect(s.cx - 22, top, 44, 3, P.WOOD_LIGHT, ctx);
          ML.engine.frameRect(s.cx - 22, top, 44, s.h, P.WOOD_DARK, ctx);
          ML.font.drawTextCentered(String(s.place), s.cx, top + 8, P.CREAM, ctx);

          ML.drawSprite(spriteFor(row, s.place), s.cx - 12, top - 32, null, ctx);
          var m = medalFor(s.place);
          if (m) ML.drawSprite(m, s.cx - 4, top - 46, null, ctx);

          ML.font.drawTextShadowCentered(row.name, s.cx, GROUND + 4,
            row.isPlayer ? P.ACCENT : P.CREAM, ctx);
          ML.font.drawTextShadowCentered(row.points + ' PTS', s.cx, GROUND + 14, P.STEEL, ctx);
        }

        ML.engine.drawParticles(ctx);

        if (shown >= 3) {
          var champ = top3[0];
          ML.font.drawTextShadowCentered(
            champ.isPlayer ? 'CHAMPION OF THE SUBURBS' : champ.name + ' TAKES IT',
            W / 2, 24, champ.isPlayer ? P.AMBER : P.CREAM, ctx);
          if (Math.floor(t * 1.6) % 2 === 0) {
            ML.font.drawTextShadowCentered('PRESS ENTER', W / 2, 170, P.AMBER, ctx);
          }
        }
      }
    };
  }

  return {
    CONFIG: CONFIG,
    begin: begin,
    active: active,
    abandon: abandon,
    snapshot: snapshot,
    competitors: competitors,
    rankOf: rankOf,
    standingsThrough: standingsThrough,
    eventResultScene: eventResultScene,
    standingsScene: standingsScene,
    podiumScene: podiumScene
  };
})();
