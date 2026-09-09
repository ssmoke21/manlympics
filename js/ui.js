/*
  UI - the screens that are not events, plus a few drawing helpers every event
  reuses (the backyard backdrop, the 3-second title card, the 3-second result
  card, the pause overlay).

  Title screen, mode select, event select, the Free Play result screen and the
  pause overlay. The tournament's own screens live in tournament.js; the only
  join between them is resultsScene() below, which hands the payload over when
  a tournament is running.
*/
window.ML = window.ML || {};

ML.ui = (function () {
  var P = ML.palette;
  var W = 320, H = 180;

  // --------------------------------------------------------------- helpers

  // 50% checkerboard of ink - darkens the screen behind a panel without using
  // alpha, so we never invent a colour that is not in the palette.
  var ditherFill = null;
  function dither(ctx, x, y, w, h) {
    if (!ditherFill) {
      var cv = document.createElement('canvas');
      cv.width = 2; cv.height = 2;
      var c = cv.getContext('2d');
      c.fillStyle = P.hex(P.INK);
      c.fillRect(0, 0, 1, 1);
      c.fillRect(1, 1, 1, 1);
      ditherFill = ctx.createPattern(cv, 'repeat');   // built once, reused forever
    }
    ctx.save();
    ctx.fillStyle = ditherFill;
    ctx.fillRect(x || 0, y || 0, w || W, h || H);
    ctx.restore();
  }

  // Text drawn at a whole-number scale. Still pixel crisp.
  function bigText(str, cx, y, color, s, ctx) {
    ctx = ctx || ML.engine.ctx;
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.scale(s, s);
    ML.font.drawTextCentered(str, cx / s, y / s, color, ctx);
    ctx.restore();
  }

  function bigTextWavy(str, cx, y, color, s, time, amp, ctx) {
    ctx = ctx || ML.engine.ctx;
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.scale(s, s);
    ML.font.drawTextWavyCentered(str, cx / s, y / s, color, time, amp, 0.55, ctx);
    ctx.restore();
  }

  // ------------------------------------------------------- backyard backdrop

  var clouds = [
    { x: 30, y: 18, sp: 3.0, s: 'cloud_b' },
    { x: 140, y: 30, sp: 2.0, s: 'cloud_a' },
    { x: 250, y: 14, sp: 2.6, s: 'cloud_a' },
    { x: 200, y: 44, sp: 1.4, s: 'cloud_b' }
  ];

  function backdrop(ctx, t, groundY) {
    groundY = groundY === undefined ? 118 : groundY;

    ML.engine.rect(0, 0, W, groundY, P.SKY, ctx);
    ML.engine.rect(0, 0, W, 26, P.SKY_DEEP, ctx);
    ML.engine.rect(0, 26, W, 4, P.SKY_DEEP, ctx);          // soft band
    ML.engine.rect(0, 30, W, 2, P.SKY, ctx);

    ML.drawSprite('sun', 268, 16, null, ctx);

    for (var i = 0; i < clouds.length; i++) {
      var c = clouds[i];
      var x = (c.x + t * c.sp) % (W + 60) - 40;
      ML.drawSprite(c.s, x, c.y, null, ctx);
    }

    // hedge line and fence behind the action
    for (var b = -10; b < W + 20; b += 26) {
      ML.drawSprite('bush', b, groundY - 26, null, ctx);
    }
    for (var f = 0; f < W + 64; f += 64) {
      ML.drawSprite('fence', f, groundY - 18, null, ctx);
    }

    ML.engine.rect(0, groundY, W, H - groundY, P.GRASS, ctx);
    ML.engine.rect(0, groundY, W, 3, P.GRASS_DARK, ctx);

    // scattered tufts, fixed positions so they do not shimmer
    var tufts = [14, 47, 83, 122, 168, 205, 241, 279, 305];
    for (var k = 0; k < tufts.length; k++) {
      ML.drawSprite('tuft', tufts[k], groundY + 6 + ((k * 7) % 26), null, ctx);
    }
  }

  // ------------------------------------------------------ event title/result

  /*
     Both cards are drawn by the event scenes themselves, so an event file never
     has to know about menus - it just calls these two.
  */
  function drawTitleCard(info, t, ctx) {
    dither(ctx);
    var x = 22, y = 32, w = W - 44, h = 116;
    ML.engine.rect(x + 2, y + 2, w, h, P.INK, ctx);
    ML.engine.rect(x, y, w, h, P.CHARCOAL, ctx);
    ML.engine.frameRect(x, y, w, h, P.CREAM, ctx);
    ML.engine.rect(x + 3, y + 3, w - 6, 1, P.GRAY, ctx);

    ML.font.drawTextCentered('EVENT ' + (info.number || '?'), W / 2, y + 8, P.AMBER, ctx);
    bigTextWavy(info.name, W / 2, y + 20, P.ACCENT, 2, t, 1.2, ctx);

    var joke = info.joke || [];
    for (var i = 0; i < joke.length; i++) {
      ML.font.drawTextCentered(joke[i], W / 2, y + 46 + i * 10, P.CREAM, ctx);
    }

    ML.engine.rect(x + 12, y + 70, w - 24, 1, P.GRAY, ctx);
    var ctrl = info.controls || [];
    for (var j = 0; j < ctrl.length; j++) {
      ML.font.drawTextCentered(ctrl[j], W / 2, y + 76 + j * 9, P.STEEL, ctx);
    }

    // countdown, inside the card so it never fights with the HUD
    var left = Math.ceil(info.remaining);
    ML.font.drawTextCentered(left > 0 ? String(left) : 'GO!', W / 2, y + h - 12,
      left > 0 ? P.CREAM : P.ACCENT, ctx);
  }

  function drawResultCard(info, t, ctx) {
    dither(ctx);
    var x = 40, y = 34, w = W - 80, h = 110;
    ML.engine.rect(x + 2, y + 2, w, h, P.INK, ctx);
    ML.engine.rect(x, y, w, h, P.CHARCOAL, ctx);
    ML.engine.frameRect(x, y, w, h, P.CREAM, ctx);

    ML.font.drawTextCentered(info.name, W / 2, y + 8, P.AMBER, ctx);
    ML.font.drawTextCentered('YOUR SCORE', W / 2, y + 22, P.STEEL, ctx);

    // score ticks up over the first second
    var shown = Math.round(ML.clamp(t / 0.9, 0, 1) * info.score);
    bigText(String(shown), W / 2, y + 32, P.ACCENT, 2, ctx);

    var lines = info.lines || [];
    for (var i = 0; i < lines.length; i++) {
      ML.font.drawTextCentered(lines[i], W / 2, y + 56 + i * 10, P.CREAM, ctx);
    }
    if (info.footer) ML.font.drawTextCentered(info.footer, W / 2, y + h - 12, P.STEEL, ctx);
  }

  // ------------------------------------------------------------ pause overlay

  function pauseScene(opts) {
    opts = opts || {};
    var sel = 0;
    var items = ['RESUME', 'QUIT TO TITLE'];
    return {
      opaque: false,
      enter: function () { ML.sfx.play('back'); ML.sfx.stopAllLoops(); },
      update: function () {
        if (ML.input.justPressed('up') || ML.input.justPressed('down')) {
          sel = 1 - sel; ML.sfx.play('blip');
        }
        if (ML.input.justPressed('escape')) { ML.engine.pop(); return; }
        if (ML.input.justPressed('enter') || ML.input.justPressed('space')) {
          if (sel === 0) { ML.sfx.play('confirm'); ML.engine.pop(); }
          else {
            ML.sfx.play('back');
            if (ML.tournament) ML.tournament.abandon();
            ML.engine.reset(titleScene());
          }
        }
      },
      draw: function (ctx) {
        dither(ctx);
        var w = 140, h = 70, x = (W - w) / 2, y = (H - h) / 2;
        ML.engine.rect(x + 2, y + 2, w, h, P.INK, ctx);
        ML.engine.rect(x, y, w, h, P.CHARCOAL, ctx);
        ML.engine.frameRect(x, y, w, h, P.CREAM, ctx);
        ML.font.drawTextCentered('PAUSED', W / 2, y + 10, P.AMBER, ctx);
        for (var i = 0; i < items.length; i++) {
          var c = (i === sel) ? P.ACCENT : P.CREAM;
          ML.font.drawTextCentered(items[i], W / 2, y + 28 + i * 12, c, ctx);
          if (i === sel) ML.font.drawText('>', x + 12, y + 28 + i * 12, P.ACCENT, ctx);
        }
        ML.font.drawTextCentered('ESC RESUMES', W / 2, y + h - 12, P.GRAY, ctx);
      }
    };
  }

  // --------------------------------------------------------------- menu bits

  function menu(items) {
    return {
      sel: 0,
      items: items,
      move: function (d) {
        var n = this.items.length;
        this.sel = (this.sel + d + n) % n;
        ML.sfx.play('blip');
      },
      handle: function () {
        if (ML.input.justPressed('up')) this.move(-1);
        if (ML.input.justPressed('down')) this.move(1);
        if (ML.input.justPressed('enter') || ML.input.justPressed('space')) {
          var it = this.items[this.sel];
          if (it.locked) { ML.sfx.play('back'); return 'locked'; }
          ML.sfx.play('confirm');
          return 'go';
        }
        return null;
      }
    };
  }

  function drawMenu(m, cx, top, ctx, spacing) {
    spacing = spacing || 13;
    for (var i = 0; i < m.items.length; i++) {
      var it = m.items[i];
      var c = it.locked ? P.GRAY : (i === m.sel ? P.ACCENT : P.CREAM);
      ML.font.drawTextShadowCentered(it.label, cx, top + i * spacing, c, ctx);
      if (i === m.sel) {
        var w = ML.font.width(it.label);
        ML.font.drawText('>', cx - w / 2 - 10, top + i * spacing, P.ACCENT, ctx);
        ML.font.drawText('<', cx + w / 2 + 5, top + i * spacing, P.ACCENT, ctx);
      }
    }
  }

  // -------------------------------------------------------------- TITLE SCENE

  function titleScene() {
    var t = 0;
    return {
      enter: function () { t = 0; ML.engine.clearParticles(); },
      update: function (dt) {
        t += dt;
        if (ML.input.justPressed('enter') || ML.input.justPressed('space')) {
          ML.sfx.play('confirm');
          ML.engine.replace(modeScene());
        }
      },
      draw: function (ctx) {
        backdrop(ctx, t, 124);

        // logo
        bigTextWavy('MAN-LYMPICS', W / 2, 30, P.ACCENT, 3, t, 1.6, ctx);
        ML.font.drawTextShadowCentered('THE GAMES OF THE SUBURBAN DAD', W / 2, 58, P.CREAM, ctx);

        // a log with an axe left in it, and a dad idling beside it
        var f = Math.floor(t * 3) % 2;
        ML.drawSprite('block', 110, 136, null, ctx);
        ML.drawSprite('log_whole', 103, 122, null, ctx);
        ML.drawSprite('axe_hit', 121, 113, null, ctx);
        ML.drawSprite('player_idle' + f, 204, 124, null, ctx);

        if (Math.floor(t * 1.6) % 2 === 0) {
          ML.font.drawTextShadowCentered('PRESS ENTER', W / 2, 150, P.AMBER, ctx);
        }
        ML.font.drawTextShadowCentered('M MUTES.  ESC PAUSES.', W / 2, 166, P.CREAM, ctx);
      }
    };
  }

  // --------------------------------------------------------- MODE SELECT

  function modeScene() {
    var t = 0, note = 0;
    var m = menu([
      { label: 'TOURNAMENT', locked: false, hint: 'ALL EIGHT EVENTS AGAINST ALL SIX RIVALS' },
      { label: 'FREE PLAY', locked: false, hint: 'ONE EVENT, CHASE A PERSONAL BEST' },
      { label: 'VERSUS', locked: true, hint: 'TWO ON ONE KEYBOARD - ARRIVES IN PHASE 5' }
    ]);
    m.sel = 0;
    return {
      enter: function () { t = 0; },
      update: function (dt) {
        t += dt;
        if (note > 0) note -= dt;
        var r = m.handle();
        if (r === 'locked') note = 1.6;
        if (r === 'go') {
          if (m.sel === 0) ML.tournament.begin();
          else ML.engine.replace(eventSelectScene());
        }
        if (ML.input.justPressed('escape')) { ML.sfx.play('back'); ML.engine.replace(titleScene()); }
      },
      draw: function (ctx) {
        backdrop(ctx, t, 124);
        dither(ctx);
        var x = 40, y = 22, w = W - 80, h = 118;
        ML.engine.rect(x + 2, y + 2, w, h, P.INK, ctx);
        ML.engine.rect(x, y, w, h, P.CHARCOAL, ctx);
        ML.engine.frameRect(x, y, w, h, P.CREAM, ctx);

        ML.font.drawTextCentered('CHOOSE YOUR EVENT FORMAT', W / 2, y + 8, P.AMBER, ctx);
        ML.engine.rect(x + 10, y + 18, w - 20, 1, P.GRAY, ctx);
        drawMenu(m, W / 2, y + 28, ctx, 18);
        ML.font.drawTextCentered(m.items[m.sel].hint, W / 2, y + 90, P.STEEL, ctx);
        if (note > 0) {
          ML.font.drawTextCentered('NOT IN THIS BUILD YET', W / 2, y + 102, P.ACCENT, ctx);
        }
        ML.font.drawTextShadowCentered('ENTER SELECTS.  ESC GOES BACK.', W / 2, 160, P.CREAM, ctx);
      }
    };
  }

  // -------------------------------------------------------- EVENT SELECT

  // The full roster. Phase 1 only has chopping wired up; the rest are listed so
  // you can see the shape of the tournament, and unlock as they get built.
  var EVENT_LIST = [
    { key: 'pouring', label: '1 THE POUR' },
    { key: 'grilling', label: '2 GRILL SERGEANT' },
    { key: 'chopping', label: '3 SPLITTING IMAGE' },
    { key: 'mowing', label: '4 CUT ABOVE' },
    { key: 'jaropening', label: '5 DEATH GRIP' },
    { key: 'parking', label: '6 BACK IT IN' },
    { key: 'creampuffs', label: '7 CHOUX BUSINESS' },
    { key: 'groceries', label: '8 THE ONE-TRIPPER' }
  ];

  function eventSelectScene() {
    var t = 0, note = 0;
    var items = EVENT_LIST.map(function (e) {
      var built = !!(ML.events && ML.events[e.key]);
      return { label: e.label, locked: !built, key: e.key };
    });
    var m = menu(items);
    for (var i = 0; i < items.length; i++) if (!items[i].locked) { m.sel = i; break; }

    return {
      enter: function () { t = 0; },
      update: function (dt) {
        t += dt;
        if (note > 0) note -= dt;
        var r = m.handle();
        if (r === 'locked') note = 1.6;
        if (r === 'go') {
          var key = m.items[m.sel].key;
          ML.engine.replace(ML.events[key].scene({ mode: 'freeplay' }));
        }
        if (ML.input.justPressed('escape')) { ML.sfx.play('back'); ML.engine.replace(modeScene()); }
      },
      draw: function (ctx) {
        backdrop(ctx, t, 124);
        dither(ctx);
        var x = 52, y = 8, w = W - 104, h = 148;
        ML.engine.rect(x + 2, y + 2, w, h, P.INK, ctx);
        ML.engine.rect(x, y, w, h, P.CHARCOAL, ctx);
        ML.engine.frameRect(x, y, w, h, P.CREAM, ctx);

        ML.font.drawTextCentered('FREE PLAY', W / 2, y + 6, P.AMBER, ctx);
        ML.engine.rect(x + 10, y + 16, w - 20, 1, P.GRAY, ctx);
        drawMenu(m, W / 2, y + 24, ctx, 13);
        ML.font.drawTextCentered(note > 0 ? 'THAT EVENT IS NOT BUILT YET' : 'ENTER SELECTS.  ESC GOES BACK.',
          W / 2, y + h - 12, note > 0 ? P.ACCENT : P.STEEL, ctx);
      }
    };
  }

  // ------------------------------------------------- PLACEHOLDER RESULTS

  /*
     Phase 1 stand-in for the real results screen. Phase 2 replaces this with
     opponent score reveals and the standings table.
  */
  function resultsScene(payload) {
    // If a tournament is running, the score goes to the tournament instead.
    // This is the ONLY place the two flows meet, which is why no event file
    // has to know which mode it is being played in.
    if (ML.tournament && ML.tournament.active()) {
      return ML.tournament.eventResultScene(payload);
    }
    var t = 0;
    var best = null;
    return {
      enter: function () {
        t = 0;
        ML.sfx.play('fanfare');
        try {
          var k = 'ml_best_' + payload.key;
          var prev = parseInt(window.localStorage.getItem(k) || '0', 10);
          if (payload.score > prev) {
            window.localStorage.setItem(k, String(payload.score));
            best = { value: payload.score, isNew: true };
          } else {
            best = { value: prev, isNew: false };
          }
        } catch (e) { best = null; }
      },
      update: function (dt) {
        t += dt;
        if (t > 0.4 && (ML.input.justPressed('enter') || ML.input.justPressed('space'))) {
          ML.sfx.play('confirm');
          ML.engine.reset(titleScene());
        }
      },
      draw: function (ctx) {
        backdrop(ctx, t, 124);
        dither(ctx);
        var x = 30, y = 16, w = W - 60, h = 140;
        ML.engine.rect(x + 2, y + 2, w, h, P.INK, ctx);
        ML.engine.rect(x, y, w, h, P.CHARCOAL, ctx);
        ML.engine.frameRect(x, y, w, h, P.CREAM, ctx);

        ML.font.drawTextCentered('OFFICIAL RESULT', W / 2, y + 8, P.AMBER, ctx);
        ML.font.drawTextCentered(payload.name, W / 2, y + 20, P.CREAM, ctx);

        var shown = Math.round(ML.clamp(t / 1.0, 0, 1) * payload.score);
        bigText(String(shown) + ' / 1000', W / 2, y + 34, P.ACCENT, 2, ctx);

        var lines = payload.lines || [];
        for (var i = 0; i < lines.length; i++) {
          ML.font.drawTextCentered(lines[i], W / 2, y + 60 + i * 10, P.CREAM, ctx);
        }

        if (best) {
          var msg = best.isNew ? 'NEW PERSONAL BEST!' : 'PERSONAL BEST: ' + best.value;
          ML.font.drawTextCentered(msg, W / 2, y + h - 34, best.isNew ? P.ACCENT : P.STEEL, ctx);
        }
        ML.font.drawTextCentered('FREE PLAY - NO OPPONENTS', W / 2, y + h - 22, P.GRAY, ctx);
        if (Math.floor(t * 1.6) % 2 === 0) {
          ML.font.drawTextCentered('PRESS ENTER', W / 2, y + h - 11, P.AMBER, ctx);
        }
      }
    };
  }

  return {
    backdrop: backdrop,
    dither: dither,
    bigText: bigText,
    bigTextWavy: bigTextWavy,
    drawTitleCard: drawTitleCard,
    drawResultCard: drawResultCard,
    menu: menu,
    drawMenu: drawMenu,
    pauseScene: pauseScene,
    titleScene: titleScene,
    modeScene: modeScene,
    eventSelectScene: eventSelectScene,
    resultsScene: resultsScene,
    EVENT_LIST: EVENT_LIST
  };
})();
