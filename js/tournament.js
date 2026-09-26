/*
  ==========================================================================
  TOURNAMENT - the eight events run back to back against the six rivals
  ==========================================================================

  One player or two. With two it is pass-and-play: player one plays the event,
  hands the keyboard over, player two plays the same event, and only then do the
  six rivals post their scores. Both humans use the SAME controls - arrows and
  space - because they never play at the same time, which is also why not one
  event file needed changing to support a second player.

  HOW SCORING WORKS
    Every event hands back a raw score out of 1000. Everyone in the field is
    ranked on that raw score and awarded medal points 10-8-6-5-4-3-2-1. Seven
    compete with one human, eight with two - which is exactly why the points
    table runs to eight places.

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

    // ---- the announcer between events
    ANNOUNCE_TIME: 2.0,      // how long the shout stays up
    ANNOUNCE_MIN: 0.45,      // ENTER cannot skip it before this

    // ---- handing the keyboard over
    HANDOVER_DWELL: 0.8,     // so nobody skips past it by accident

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
    REVISE_WINDOW: 45,       // frames you have to react in. Half a second was
                             // tight for a thing you are not expecting; this
                             // is three quarters of one.
    REVISE_FLICKER: 3,       // frames the row changes colour for. One frame is
                             // 16ms, which nobody catches unless they already
                             // know to watch that row - so it is three.
    REVISE_MAX_PER_RUN: 1,   // Left uncapped he helped himself on most boards,
                             // worth three medal points a tournament on average
                             // and up to nine, which made him the strongest
                             // rival in the game rather than a running joke.
                             // Getting caught does not use the allowance up.

    // ---- podium
    PODIUM_STEP: 0.9
  };

  // A second dad, so the two humans are not the same silhouette on the podium.
  // Registered at load; ML.sprites.init() in main.js bakes it with the rest.
  if (ML.sprites && ML.sprites.addFigure) {
    ML.sprites.addFigure('player2', {
      skin: 'e', hair: '1', shirt: '7', shirtAlt: '8', pants: '1',
      shoe: '0', hat: 'visor', hatColor: 'f', build: 0, beard: true
    });
  }

  // ------------------------------------------------------------------ state
  var state = null;

  function humanName(i) {
    if (!state || state.humans.length === 1) return 'YOU';
    return 'PLAYER ' + (i + 1);
  }

  function competitors() {
    var out = [], i;
    var humans = state ? state.humans : ['p1'];
    for (i = 0; i < humans.length; i++) {
      out.push({ id: humans[i], name: humanName(i), isPlayer: true, seat: i });
    }
    var r = ML.opponents.roster;
    for (i = 0; i < r.length; i++) {
      out.push({ id: r[i].id, name: r[i].name, isPlayer: false });
    }
    return out;
  }

  function begin(players) {
    var n = (players === 2) ? 2 : 1;
    state = {
      players: n,
      humans: n === 2 ? ['p1', 'p2'] : ['p1'],
      turn: 0,                 // which human is at the keyboard
      round: 0,
      order: CONFIG.EVENT_ORDER.slice(),
      raw: {},            // id -> array of raw scores, one per round
      flags: {},          // id -> array of flag objects from opponents.js
      recs: {},           // id -> array of record results, for the BEST! flag
      rolled: {},         // rounds where the rivals have already posted
      revisedRounds: {},  // rounds already meddled with, so it happens once
      revisions: 0,       // how many have STOOD this run
      caught: 0,
      stood: 0
    };
    var c = competitors();
    for (var i = 0; i < c.length; i++) {
      state.raw[c[i].id] = [];
      state.flags[c[i].id] = [];
      state.recs[c[i].id] = [];
    }
    if (ML.cutscene && ML.cutscene.introScene) {
      ML.engine.replace(ML.cutscene.introScene({ players: n, then: launchNext }));
    } else {
      launchNext();
    }
  }

  function active() { return !!state; }
  function abandon() { state = null; }
  function snapshot() { return state; }
  function players() { return state ? state.players : 1; }

  function launchEvent() {
    ML.engine.replace(ML.events[state.order[state.round]].scene({ mode: 'tournament' }));
  }

  function launchNext() {
    if (!state) return;
    while (state.round < state.order.length && !ML.events[state.order[state.round]]) {
      state.round++;                       // an event that is not built yet
    }
    if (state.round >= state.order.length) {
      ML.engine.replace(podiumScene());
      return;
    }
    state.turn = 0;
    ML.engine.replace(announcerScene());
  }

  function rollOpponents() {
    var r = state.round;
    if (state.rolled[r]) return;
    state.rolled[r] = true;
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
        id: c[i].id, name: c[i].name, isPlayer: c[i].isPlayer, seat: c[i].seat,
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
      if (!state.rolled[r]) continue;
      var rows = rankOf(r);
      for (i = 0; i < rows.length; i++) {
        totals[rows[i].id] += rows[i].points;
        rawTotals[rows[i].id] += rows[i].score;
      }
    }
    var out = [];
    for (i = 0; i < c.length; i++) {
      out.push({
        id: c[i].id, name: c[i].name, isPlayer: c[i].isPlayer, seat: c[i].seat,
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

  function ordinal(n) {
    return n + (n === 1 ? 'ST' : n === 2 ? 'ND' : n === 3 ? 'RD' : 'TH');
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

  function seatColour(seat) { return seat === 1 ? P.ORANGE : P.ACCENT; }

  // A short word for whatever dramatic thing opponents.js flagged.
  function noteFor(flags) {
    if (!flags) return null;
    if (flags.catastrophe) return { text: 'SMASH!', col: P.ORANGE };
    if (flags.choke) return { text: 'CHOKED', col: P.ORANGE };
    if (flags.unstoppable) return { text: 'EASY', col: P.AMBER };
    return null;
  }

  // ============================================== THE HOOK FROM THE EVENTS
  /*
     Every event ends by calling ML.ui.resultsScene, which routes here when a
     tournament is running. With two players this is where the keyboard changes
     hands: the first human's score is banked and the same event is set up
     again, and only when the last human has played do the rivals post.
  */
  function eventResultScene(payload, rec) {
    var id = state.humans[state.turn];
    state.raw[id][state.round] = Math.round(ML.clamp(payload.score || 0, 0, 1000));
    state.flags[id][state.round] = {};
    state.recs[id][state.round] = rec || null;

    if (state.turn + 1 < state.humans.length) {
      var justPlayed = state.turn;
      state.turn++;
      return handoverScene(justPlayed);
    }

    rollOpponents();
    return resultScene();
  }

  // ===================================================== PASS THE KEYBOARD
  function handoverScene(justPlayed) {
    var t = 0;
    var r = state.round;
    var score = state.raw[state.humans[justPlayed]][r];
    var nextSeat = justPlayed + 1;

    return {
      key: 'tournament_handover',
      enter: function () { ML.engine.clearParticles(); ML.sfx.play('confirm'); },
      exit: function () { ML.sfx.stopAllLoops(); },

      update: function (dt) {
        t += dt;
        if (ML.input.justPressed('escape')) { ML.engine.push(ML.ui.pauseScene()); return; }
        if (t > CONFIG.HANDOVER_DWELL
          && (ML.input.justPressed('enter') || ML.input.justPressed('space'))) {
          ML.sfx.play('confirm');
          launchEvent();
        }
      },

      draw: function (ctx) {
        ML.ui.backdrop(ctx, t, 124);
        ML.ui.dither(ctx);
        panel(ctx, 34, 30, 252, 120);

        ML.font.drawTextCentered(eventName(state.order[r]), W / 2, 38, P.STEEL, ctx);
        ML.font.drawTextCentered('PLAYER ' + (justPlayed + 1) + ' SCORED',
          W / 2, 50, P.CREAM, ctx);
        ML.ui.bigText(String(score), W / 2, 60, seatColour(justPlayed), 2, ctx);

        ML.engine.rect(50, 88, 220, 1, P.GRAY, ctx);
        ML.font.drawTextCentered('PASS THE KEYBOARD', W / 2, 96, P.AMBER, ctx);
        ML.font.drawTextCentered('PLAYER ' + (nextSeat + 1) + ', SAME EVENT',
          W / 2, 108, seatColour(nextSeat), ctx);
        ML.font.drawTextCentered('SAME CONTROLS - ARROWS AND SPACE',
          W / 2, 120, P.STEEL, ctx);

        if (t > CONFIG.HANDOVER_DWELL && Math.floor(t * 1.6) % 2 === 0) {
          ML.font.drawTextCentered('PRESS ENTER WHEN YOU ARE READY', W / 2, 136, P.CREAM, ctx);
        }
      }
    };
  }

  // ================================================== EVENT RESULTS SCREEN
  function resultScene() {
    var r = state.round;
    var key = state.order[r];
    var t = 0;
    var order = competitors();                  // humans first, then the roster
    var humanCount = state.humans.length;
    var opponentsOnly = order.slice(humanCount);
    var ranked = rankOf(r);
    var placeOf = {}, pointsOf = {};
    for (var i = 0; i < ranked.length; i++) {
      placeOf[ranked[i].id] = ranked[i].place;
      pointsOf[ranked[i].id] = ranked[i].points;
    }
    var landed = {}, saxPlayed = false;
    var allInAt = CONFIG.REVEAL_START + opponentsOnly.length * CONFIG.REVEAL_GAP;
    var ROW_SP = 12;

    function revealState(idx) {
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
          if (t >= landAt && !landed[i]) {
            landed[i] = true;
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
          else if (placeOf.p1 === 1 || placeOf.p2 === 1) ML.sfx.play('fanfare');
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
          var y = 36 + i * ROW_SP;
          var isPlayer = c.isPlayer;
          var st = isPlayer ? 'shown' : revealState(i - humanCount);

          if (isPlayer) ML.engine.rect(14, y - 2, 292, 10, P.STEEL, ctx);

          ML.font.drawText(c.name, 30, y, isPlayer ? P.INK : P.CREAM, ctx);

          if (st === 'hidden') {
            ML.font.drawText('- - -', 200, y, P.GRAY, ctx);
          } else if (st === 'ticking') {
            rightText(String((Math.random() * 1000) | 0), 236, y, P.STEEL, ctx);
          } else {
            rightText(String(state.raw[c.id][r]), 236, y, isPlayer ? P.INK : P.ACCENT, ctx);

            // medals only once everything is in, or they would be a lie
            if (t >= allInAt) {
              var m = medalFor(placeOf[c.id]);
              if (m) ML.drawSprite(m, 16, y - 3, null, ctx);
              else ML.font.drawText(String(placeOf[c.id]), 18, y, P.GRAY, ctx);
              var rec = isPlayer ? state.recs[c.id][r] : null;
              if (rec && rec.isNew) {
                ML.font.drawText('BEST!', 244, y, P.ACCENT, ctx);
              } else {
                var note = noteFor(state.flags[c.id][r]);
                if (note) ML.font.drawText(note.text, 244, y, note.col, ctx);
              }
            }
          }
        }

        ML.engine.rect(18, 138, 284, 1, P.GRAY, ctx);

        if (t >= allInAt + CONFIG.VERDICT_DELAY) {
          if (humanCount === 1) {
            ML.font.drawTextCentered(
              'YOU FINISHED ' + ordinal(placeOf.p1) + '   PLUS ' + pointsOf.p1 + ' POINTS',
              W / 2, 146, placeOf.p1 <= 3 ? P.ACCENT : P.CREAM, ctx);
          } else {
            ML.font.drawTextCentered(
              'P1 ' + ordinal(placeOf.p1) + ' PLUS ' + pointsOf.p1
              + '     P2 ' + ordinal(placeOf.p2) + ' PLUS ' + pointsOf.p2,
              W / 2, 144, P.CREAM, ctx);
            var lead = placeOf.p1 < placeOf.p2 ? 'PLAYER 1 TAKES THE EVENT'
              : placeOf.p2 < placeOf.p1 ? 'PLAYER 2 TAKES THE EVENT' : 'DEAD HEAT';
            ML.font.drawTextCentered(lead, W / 2, 155,
              placeOf.p1 < placeOf.p2 ? seatColour(0) : seatColour(1), ctx);
          }
          if (Math.floor(t * 1.6) % 2 === 0) {
            ML.font.drawTextCentered('PRESS ENTER', W / 2, 166, P.AMBER, ctx);
          }
        } else {
          ML.font.drawTextCentered('THE FIELD IS COMING IN...', W / 2, 148, P.STEEL, ctx);
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

    // After event one there is no previous order to have moved from - the
    // "before" table is everyone on nought points, which sorts into roster
    // order and makes every arrow a lie. So the first board just states itself.
    var firstBoard = (state.round === 0);
    var before = firstBoard ? standingsThrough(state.round) : standingsThrough(state.round - 1);
    var beforeIdx = {}, i;
    for (i = 0; i < before.length; i++) beforeIdx[before[i].id] = i;

    var ROW_SP = 15;

    // the meddle
    var reviseAt = null, revision = null, flickerFrame = -1, windowFrames = -1;
    var verdict = null;                      // 'caught' | 'stood'
    var frame = 0;
    if (!isFinal && state.round >= 1
      && state.revisions < CONFIG.REVISE_MAX_PER_RUN
      && Math.random() < CONFIG.REVISE_CHANCE) {
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
      var to = 0;
      for (var k = 0; k < now.length; k++) if (now[k].id === id) { to = k; break; }
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
          // A tick, quiet and short. You cannot watch seven rows at once, and
          // three frames of colour on one of them is not something anybody
          // spots unless they already know which row to stare at. This says
          // SOMETHING happened without saying what - which is the whole
          // point: the mechanic stays unexplained, but it stops being a
          // thing you can only catch by already knowing about it.
          ML.sfx.play('tick');
          state.raw.stalin[revision.round] = Math.round(ML.clamp(
            state.raw.stalin[revision.round] + revision.amount, 0, 1000));
          state.revisedRounds[revision.round] = true;
          state.revisions++;
        }

        if (windowFrames > 0) {
          windowFrames--;
          if (ML.input.anyPressed()) {
            state.raw.stalin[revision.round] -= revision.amount;
            state.revisedRounds[revision.round] = false;
            state.revisions--;          // caught does not spend the allowance
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
          var y = Math.round(26 + slot(row.id, list) * ROW_SP);
          var moved = (beforeIdx[row.id] === undefined ? i : beforeIdx[row.id]) - i;

          // the one frame of colour
          var flicker = (flickerFrame >= 0 && row.id === 'stalin'
            && frame >= flickerFrame && frame < flickerFrame + CONFIG.REVISE_FLICKER);
          if (row.isPlayer) ML.engine.rect(14, y - 3, 292, 14, P.STEEL, ctx);
          else if (flicker) ML.engine.rect(14, y - 3, 292, 14, P.WOOD_DARK, ctx);

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
          ML.engine.rect(150, y + 2, bw, 7,
            row.isPlayer ? seatColour(row.seat) : P.STEEL, ctx);
          rightText(String(row.points), 296, y + 2, row.isPlayer ? P.INK : P.AMBER, ctx);
        }

        ML.engine.rect(18, 152, 284, 1, P.GRAY, ctx);

        if (verdict === 'caught') {
          ML.font.drawTextCentered('CAUGHT', W / 2, 158, P.ORANGE, ctx);
        } else if (!isFinal) {
          var nextKey = state.order[state.round + 1];
          ML.font.drawTextCentered(
            nextKey ? 'NEXT: ' + eventName(nextKey) : 'NEXT: THE PODIUM',
            W / 2, 158, P.STEEL, ctx);
        }

        if (Math.floor(t * 1.6) % 2 === 0) {
          ML.font.drawTextCentered(isFinal ? 'PRESS ENTER FOR THE TITLE' : 'PRESS ENTER',
            W / 2, 168, P.AMBER, ctx);
        }
      }
    };
  }

  // ========================================================= PODIUM SCREEN
  function podiumScene() {
    var t = 0;
    var finalTable = standingsThrough(state.order.length - 1);
    var top3 = finalTable.slice(0, 3);
    var shown = 0;
    var chime = {};
    var tourRec = null;

    // 2nd on the left, 1st in the middle and highest, 3rd on the right
    var SLOTS = [
      { place: 2, cx: 74, h: 30 },
      { place: 1, cx: 160, h: 44 },
      { place: 3, cx: 246, h: 20 }
    ];
    var GROUND = 152;
    var REVEAL_ORDER = [3, 2, 1];

    function rowFor(place) { return top3[place - 1]; }
    function spriteFor(row) {
      var base = row.isPlayer ? (row.seat === 1 ? 'player2' : 'player') : row.id;
      // Arnold flexes. Everyone else just enjoys it.
      if (row.id === 'arnold') return base + (Math.floor(t * 4) % 2 ? '_strain' : '_win');
      return base + '_win';
    }

    return {
      key: 'tournament_podium',
      enter: function () {
        ML.engine.clearParticles();
        ML.sfx.play('crowd_cheer');
        // The best-placed human is what goes on the board. With two players
        // that is a shared household record, which is the point of it.
        if (ML.records) {
          var bestHuman = null;
          for (var i = 0; i < finalTable.length; i++) {
            if (finalTable[i].isPlayer) { bestHuman = finalTable[i]; break; }
          }
          if (bestHuman) {
            tourRec = ML.records.submitTournament(bestHuman.points, bestHuman.place);
          }
        }
      },

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

          ML.drawSprite(spriteFor(row), s.cx - 12, top - 32, null, ctx);
          var m = medalFor(s.place);
          if (m) ML.drawSprite(m, s.cx - 4, top - 46, null, ctx);

          ML.font.drawTextShadowCentered(row.name, s.cx, GROUND + 4,
            row.isPlayer ? seatColour(row.seat) : P.CREAM, ctx);
          ML.font.drawTextShadowCentered(row.points + ' PTS', s.cx, GROUND + 14, P.STEEL, ctx);
        }

        ML.engine.drawParticles(ctx);

        if (shown >= 3) {
          var champ = top3[0];
          var line;
          if (!champ.isPlayer) line = champ.name + ' TAKES IT';
          else if (state.players === 1) line = 'CHAMPION OF THE SUBURBS';
          else line = champ.name + ' - CHAMPION OF THE SUBURBS';
          ML.font.drawTextShadowCentered(line, W / 2, 24,
            champ.isPlayer ? P.AMBER : P.CREAM, ctx);
          if (tourRec && tourRec.isNew) {
            ML.font.drawTextShadowCentered('NEW BEST: ' + tourRec.points + ' POINTS',
              W / 2, 36, P.ACCENT, ctx);
          }
          if (Math.floor(t * 1.6) % 2 === 0) {
            ML.font.drawTextShadowCentered('PRESS ENTER', W / 2, 170, P.AMBER, ctx);
          }
        }
      }
    };
  }

  // ======================================================= THE ANNOUNCER
  /*
     A short shout before each event. It exists to stop the tournament reading
     as eight unrelated minigames stapled together - it names the event, says
     something about it, and tells you where you stand before you play it.
  */
  var SHOUTS = {
    pouring: ['A CLEAN HEAD AND A CLEAN CHIN.', 'THE TAP IS OPEN.'],
    grilling: ['SIX PATTIES AND NO METERS.', 'READ THE MEAT.'],
    chopping: ['TEN SWINGS. THAT IS ALL.', 'WOOD DOES NOT SPLIT ITSELF.'],
    mowing: ['ONE TANK. ONE LAWN.', 'MIND THE GNOME.'],
    jaropening: ['THE LID IS WINNING.', 'ALL IN THE WRIST.'],
    parking: ['REVERSE. STRAIGHTEN. BREATHE.', 'THE KERB IS WATCHING.'],
    creampuffs: ['TWELVE OF THE SAME.', 'MATCHING BEATS PERFECT.'],
    groceries: ['ONE TRIP OR NOTHING.', 'EVERY BAG PAST SIX IS A BAG PAST SENSE.']
  };

  function standingLine() {
    if (state.round === 0) return 'EIGHT EVENTS. ONE DRIVEWAY.';
    var table = standingsThrough(state.round - 1);
    var best = null, i;
    for (i = 0; i < table.length; i++) if (table[i].isPlayer) { best = table[i]; break; }
    if (!best) return '';
    var last = (state.round === state.order.length - 1);
    if (best.place === 1) return last ? 'TOP OF THE TABLE. ONE TO GO.' : 'YOU ARE TOP OF THE TABLE.';
    var gap = table[0].points - best.points;
    if (best.place === table.length) return 'SOMEBODY HAS TO BE LAST.';
    if (gap <= 6) return gap + ' POINTS OFF THE LEAD.';
    if (last) return 'LAST EVENT OF THE DAY.';
    return table[0].name + ' LEADS BY ' + gap + '.';
  }

  function announcerScene() {
    var t = 0;
    var key = state.order[state.round];
    var lines = SHOUTS[key] || [''];
    var shout = lines[(Math.random() * lines.length) | 0];
    var standing = standingLine();

    return {
      key: 'tournament_announcer',
      enter: function () { ML.engine.clearParticles(); ML.sfx.play('reveal'); },

      update: function (dt) {
        t += dt;
        if (ML.input.justPressed('escape')) { ML.engine.push(ML.ui.pauseScene()); return; }
        var skipped = t > CONFIG.ANNOUNCE_MIN
          && (ML.input.justPressed('enter') || ML.input.justPressed('space'));
        if (t >= CONFIG.ANNOUNCE_TIME || skipped) launchEvent();
      },

      draw: function (ctx) {
        ML.ui.backdrop(ctx, t, 124);
        ML.ui.dither(ctx);

        // A solid band across the middle. Dither alone left the standings line
        // sitting on top of the fence, which was almost unreadable.
        var top = 34, h = state.players === 2 ? 108 : 96;
        ML.engine.rect(0, top, W, h, P.CHARCOAL, ctx);
        ML.engine.rect(0, top, W, 1, P.CREAM, ctx);
        ML.engine.rect(0, top + h - 1, W, 1, P.CREAM, ctx);
        ML.engine.rect(0, top + 2, W, 1, P.GRAY, ctx);

        ML.font.drawTextCentered('EVENT ' + (state.round + 1)
          + ' OF ' + state.order.length, W / 2, top + 10, P.AMBER, ctx);
        ML.ui.bigTextWavy(eventName(key), W / 2, top + 24, P.ACCENT, 2, t, 1.4, ctx);
        ML.font.drawTextCentered(shout, W / 2, top + 56, P.CREAM, ctx);
        if (standing) {
          ML.engine.rect(60, top + 70, 200, 1, P.GRAY, ctx);
          ML.font.drawTextCentered(standing, W / 2, top + 78, P.STEEL, ctx);
        }
        if (state.players === 2) {
          ML.font.drawTextCentered('PLAYER 1 FIRST', W / 2, top + 92, seatColour(0), ctx);
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
    players: players,
    competitors: competitors,
    rankOf: rankOf,
    standingsThrough: standingsThrough,
    eventResultScene: eventResultScene,
    announcerScene: announcerScene,
    standingsScene: standingsScene,
    podiumScene: podiumScene
  };
})();
