/*
  ==========================================================================
  EVENT 4 - CUT ABOVE (lawn mowing)
  ==========================================================================

  Route planning. A 40x22 tile yard, and a mower that handles like a mower.

  WHAT THE PLAYER DOES
    UP drives forward, DOWN reverses, LEFT and RIGHT steer. The mower has
    momentum and a real turning radius - it only turns while it is rolling, so
    there are no instant 90 degree corners. Everything the deck passes over
    gets cut.

  WHAT IS IN THE WAY
    SPRINKLER HEADS  clip one and it stalls you for a moment in a spray of water.
    GARDEN GNOME     solid. You cannot drive through him. Route around.
    THE DOG          wanders about. Hit him and he barks, you stall for longer,
                     and the steering does not answer for a moment while you
                     shoo him off. (It goes unresponsive, never inverted.)

  A TANK OF PETROL INSTEAD OF A CLOCK
    The brief scores this on the clock: coverage plus time remaining. There is
    no countdown here, for the same reason the other events lost theirs - but
    route planning needs SOME budget or you would just wander around until the
    lawn happened to be finished.

    So the budget is the tank. The mower holds one tank of petrol and burns it
    while the engine runs - faster while driving, slower while you are stalled
    or idling. Every metre you drive over grass you already cut is petrol you do
    not get back. It scores exactly like the brief's formula, with fuel in the
    place of time, and it rewards a tidy route far more sharply than a clock
    does: under a clock you can just drive faster, but you cannot out-drive a
    wasteful route.

    Run dry and that is the end of it - which is also what guarantees the event
    always finishes.

  THE WALK OF SHAME
    When you stop, every patch you missed flashes before the score comes up.

  WHERE THE DIFFICULTY KNOBS ARE
    FUEL_MAX ........... size of the tank. Bigger = easier.
    BURN_DRIVE ......... petrol per second while driving. Smaller = easier.
    FUEL_NEEDS_COVERAGE  how much lawn you must cut before saved petrol counts
                         for anything at all.
    PAR_FUEL ........... how much petrol a tidy route ought to use. Only
                         affects the bonus, not whether you can finish.
    MAX_SPEED / ACCEL .. how the mower drives.
    TURN_RATE .......... how tightly it corners. Bigger = easier.
    CUT_RADIUS ......... how wide a swath it cuts. Bigger = easier.
    SPRINKLER_STALL .... how long a sprinkler costs you.
    DOG_STALL / DOG_DAZE how long the dog costs you, and how long the steering
                         stays unresponsive afterwards.
    COVERAGE_POINTS / FUEL_POINTS ... the 800/200 split from the brief.

  If it feels too hard, raise FUEL_MAX and CUT_RADIUS first.
*/
window.ML = window.ML || {};
ML.events = ML.events || {};

ML.events.mowing = (function () {
  var P = ML.palette;

  var CONFIG = {
    // ---- pacing
    TITLE_TIME: 3,
    RESULT_TIME: 3,
    SHAME_TIME: 2.6,         // how long the missed patches flash

    // ---- the yard
    COLS: 40, ROWS: 22,
    TILE: 7,
    YARD_X: 20, YARD_Y: 16,

    // ---- the mower
    MAX_SPEED: 95,           // pixels per second
    REVERSE_SPEED: 46,
    ACCEL: 200,
    FRICTION: 2.4,           // how fast it coasts to a stop
    TURN_RATE: 200,          // degrees per second, at full speed
    TURN_LOW: 0.35,          // share of that swing rate it keeps when crawling.
                             // Raise it and the mower pivots more like a cursor.
    TURN_MIN_SPEED: 0,       // unused now: he can pivot on the spot (slowly)
    CUT_RADIUS: 8,           // half the width of the cut swath, in pixels
    CUT_AHEAD: 2,            // the deck sits this far in front of the middle

    // ---- the tank
    FUEL_MAX: 100,
    BURN_DRIVE: 1.60,        // petrol per second while rolling
    BURN_IDLE: 0.55,         // petrol per second while stalled or sitting still
    PAR_FUEL: 66,            // what a tidy route ought to spend
    FUEL_NEEDS_COVERAGE: 0.80, // below this much lawn cut, leftover petrol is
                             // worth nothing. Stops "mow half, keep the fuel".

    // ---- what is in the way
    SPRINKLERS: 5,
    SPRINKLER_STALL: 1.5,
    GNOMES: 2,
    DOG_STALL: 3.0,
    DOG_DAZE: 0.8,           // steering unresponsive for this long afterwards
    DOG_SPEED: 34,

    // ---- score out of 1000
    COVERAGE_POINTS: 800,
    FUEL_POINTS: 200
  };

  var TITLE = {
    number: 4,
    name: 'CUT ABOVE',
    joke: [
      'RULE 12: THE STRIPES MUST BE STRAIGHT.',
      'ONE TANK OF PETROL. NO SECOND LAP.'
    ],
    controls: [
      'UP DRIVES.  DOWN REVERSES.  ARROWS STEER.',
      'SPACE STOPS AND BANKS THE PETROL LEFT.'
    ]
  };

  // ================================================================= sprites
  var HEADINGS = 16;
  var MW = 21, MC = 10;      // mower sprite size and centre
  var spritesReady = false;

  /*
     The mower is baked at sixteen headings by rotating each pixel back into
     the mower's own space and asking what is there. Nearest-neighbour, so it
     stays perfectly crisp instead of going soft the way canvas rotation does.
  */
  function makeMower(deg) {
    var th = deg * Math.PI / 180;
    var cos = Math.cos(th), sin = Math.sin(th);
    var g = ML.sprites.grid(MW, MW);
    for (var y = 0; y < MW; y++) {
      for (var x = 0; x < MW; x++) {
        var wx = x - MC, wy = y - MC;
        var lx = wx * cos + wy * sin;         // into mower space (nose is -y)
        var ly = -wx * sin + wy * cos;
        var c = ' ';
        // Dark deck, bright orange engine. A big pale steel slab reads as an
        // anonymous blob on green - the orange is what makes it findable.
        if (lx >= -7 && lx <= 7 && ly >= -7 && ly <= 3) c = '1';        // the deck
        if (lx >= -6 && lx <= 6 && ly >= -7 && ly <= -5) c = '2';       // front lip
        if (lx >= -4 && lx <= 4 && ly >= -3 && ly <= 2) c = 'd';        // engine
        if (lx >= -2 && lx <= 2 && ly >= -2 && ly <= 1) c = 'c';        // hot bit on top
        if ((lx >= -7 && lx <= -5 || lx >= 5 && lx <= 7) && ly >= 1 && ly <= 4) c = '0'; // wheels
        if (lx >= -5 && lx <= 5 && ly >= 4 && ly <= 5) c = '3';         // handle bar
        if (c !== ' ') g[y][x] = c;
      }
    }
    return ML.sprites.strings(g);
  }

  function makeGnome() {
    var g = ML.sprites.grid(11, 15);
    ML.sprites.rect(g, 3, 0, 5, 2, 'd');            // hat
    ML.sprites.rect(g, 2, 2, 7, 2, 'd');
    ML.sprites.rect(g, 3, 4, 5, 3, 'e');            // face
    ML.sprites.rect(g, 3, 6, 5, 3, '4');            // beard
    ML.sprites.rect(g, 2, 9, 7, 4, '6');            // coat
    ML.sprites.rect(g, 3, 13, 5, 2, '9');
    ML.sprites.outline(g);
    return ML.sprites.strings(g);
  }

  function makeSprinkler() {
    var g = ML.sprites.grid(7, 5);
    ML.sprites.rect(g, 1, 1, 5, 3, '2');
    ML.sprites.rect(g, 2, 0, 3, 2, '3');
    ML.sprites.outline(g);
    return ML.sprites.strings(g);
  }

  function makeDog(frame) {
    var g = ML.sprites.grid(15, 11);
    ML.sprites.rect(g, 2, 3, 9, 4, 'b');            // body
    ML.sprites.rect(g, 9, 1, 4, 4, 'b');            // head
    ML.sprites.rect(g, 12, 2, 2, 2, '9');           // snout
    ML.sprites.rect(g, 9, 0, 2, 2, '9');            // ear
    ML.sprites.rect(g, 0, 1, 2, 3, 'b');            // tail
    ML.sprites.rect(g, 3, 7, 2, frame ? 3 : 2, '9');
    ML.sprites.rect(g, 8, 7, 2, frame ? 2 : 3, '9');
    ML.sprites.outline(g);
    return ML.sprites.strings(g);
  }

  function ensureSprites() {
    if (spritesReady) return;
    for (var i = 0; i < HEADINGS; i++) {
      ML.sprites.add('mw_mower' + i, makeMower((360 * i) / HEADINGS));
    }
    ML.sprites.add('mw_gnome', makeGnome());
    ML.sprites.add('mw_sprink', makeSprinkler());
    ML.sprites.add('mw_dog0', makeDog(0));
    ML.sprites.add('mw_dog1', makeDog(1));
    spritesReady = true;
  }

  // =================================================================== scene
  function scene(opts) {
    opts = opts || {};
    ensureSprites();

    var COLS = CONFIG.COLS, ROWS = CONFIG.ROWS, T = CONFIG.TILE;
    var YW = COLS * T, YH = ROWS * T;

    var s = {
      phase: 'title',        // title | mow | shame | result
      phaseT: 0,
      t: 0,

      x: CONFIG.YARD_X + 14, y: CONFIG.YARD_Y + 14,
      heading: 90,           // degrees; 0 is up the screen, so 90 faces right
                             // along the first lane rather than into the fence
      speed: 0,
      fuel: CONFIG.FUEL_MAX,

      stall: 0,              // engine stalled, no control
      daze: 0,               // steering unresponsive (the dog)
      bumpFlash: 0,

      tiles: null,           // 0 = long grass, 1 = cut, 2 = blocked by a gnome
      mowable: 0,
      mown: 0,

      sprinklers: [],
      gnomes: [],
      dog: null,

      lawn: null,            // offscreen canvas, so we never redraw 880 tiles
      lawnCtx: null,

      finalScore: 0,
      coverage: 0
    };

    // ---------------------------------------------------------------- setup
    s.tiles = new Uint8Array(COLS * ROWS);

    function tileAt(cx, cy) { return s.tiles[cy * COLS + cx]; }
    function setTile(cx, cy, v) { s.tiles[cy * COLS + cx] = v; }

    // gnomes first - they take tiles out of play
    for (var gi = 0; gi < CONFIG.GNOMES; gi++) {
      var gx = 6 + Math.floor(Math.random() * (COLS - 12));
      var gy = 4 + Math.floor(Math.random() * (ROWS - 8));
      s.gnomes.push({ cx: gx, cy: gy });
      for (var by = gy - 1; by <= gy + 1; by++) {
        for (var bx = gx - 1; bx <= gx + 1; bx++) {
          if (bx >= 0 && bx < COLS && by >= 0 && by < ROWS) setTile(bx, by, 2);
        }
      }
    }
    for (var i = 0; i < s.tiles.length; i++) if (s.tiles[i] === 0) s.mowable++;

    for (var si = 0; si < CONFIG.SPRINKLERS; si++) {
      s.sprinklers.push({
        x: CONFIG.YARD_X + 20 + Math.random() * (YW - 40),
        y: CONFIG.YARD_Y + 20 + Math.random() * (YH - 40),
        hit: 0
      });
    }

    s.dog = {
      x: CONFIG.YARD_X + YW * 0.7, y: CONFIG.YARD_Y + YH * 0.5,
      tx: 0, ty: 0, retarget: 0, frame: 0
    };

    // the lawn is painted once onto its own canvas and only touched up where
    // the mower has actually been - never 880 rectangles a frame
    s.lawn = document.createElement('canvas');
    s.lawn.width = YW; s.lawn.height = YH;
    s.lawnCtx = s.lawn.getContext('2d');
    s.lawnCtx.imageSmoothingEnabled = false;

    function paintTile(cx, cy) {
      var v = tileAt(cx, cy);
      var c = s.lawnCtx;
      if (v === 1) {
        // cut grass, with a mowing stripe every few rows
        c.fillStyle = P.hex(P.GRASS);
        c.fillRect(cx * T, cy * T, T, T);
        if ((cy % 4) < 2) {
          c.fillStyle = P.hex(P.GRASS_DARK);
          c.fillRect(cx * T, cy * T + T - 1, T, 1);
        }
      } else {
        c.fillStyle = P.hex(P.GRASS_DARK);
        c.fillRect(cx * T, cy * T, T, T);
        if (((cx + cy) % 3) === 0) {
          c.fillStyle = P.hex(P.GRASS);
          c.fillRect(cx * T + 2, cy * T + 2, 1, 1);
        }
      }
    }
    for (var py = 0; py < ROWS; py++) for (var px = 0; px < COLS; px++) paintTile(px, py);

    // ------------------------------------------------------------- helpers
    function fwd() {
      var r = s.heading * Math.PI / 180;
      return { x: Math.sin(r), y: -Math.cos(r) };
    }

    function blockedAt(px, py) {
      for (var i = 0; i < s.gnomes.length; i++) {
        var g = s.gnomes[i];
        var gx = CONFIG.YARD_X + g.cx * T + T / 2;
        var gy = CONFIG.YARD_Y + g.cy * T + T / 2;
        if (Math.abs(px - gx) < 11 && Math.abs(py - gy) < 13) return true;
      }
      return false;
    }

    function cut() {
      var f = fwd();
      var cx = s.x + f.x * CONFIG.CUT_AHEAD, cy = s.y + f.y * CONFIG.CUT_AHEAD;
      var r = CONFIG.CUT_RADIUS;
      var c0 = Math.max(0, Math.floor((cx - r - CONFIG.YARD_X) / T));
      var c1 = Math.min(COLS - 1, Math.floor((cx + r - CONFIG.YARD_X) / T));
      var r0 = Math.max(0, Math.floor((cy - r - CONFIG.YARD_Y) / T));
      var r1 = Math.min(ROWS - 1, Math.floor((cy + r - CONFIG.YARD_Y) / T));
      for (var ty = r0; ty <= r1; ty++) {
        for (var tx = c0; tx <= c1; tx++) {
          if (tileAt(tx, ty) !== 0) continue;
          /*
             Cut a tile if the deck overlaps ANY of it, not just its centre.
             Testing the centre made the working swath narrower than the deck
             looks, so tiles the mower plainly drove over were left standing
             and a tidy route still could not finish the lawn.
          */
          var tl = CONFIG.YARD_X + tx * T, tt = CONFIG.YARD_Y + ty * T;
          var qx = ML.clamp(cx, tl, tl + T), qy = ML.clamp(cy, tt, tt + T);
          var dx = qx - cx, dy = qy - cy;
          if (dx * dx + dy * dy > r * r) continue;
          setTile(tx, ty, 1);
          s.mown++;
          paintTile(tx, ty);
        }
      }
    }

    function stallOn(kind, px, py) {
      if (s.stall > 0) return;
      s.speed = 0;
      s.bumpFlash = 0.3;
      if (kind === 'sprinkler') {
        s.stall = CONFIG.SPRINKLER_STALL;
        ML.sfx.play('fizz');
        ML.engine.burst(px, py, 16, {
          colors: [P.SKY, P.CREAM, P.STEEL], speedMin: 25, speedMax: 90,
          life: 0.8, grav: 130, spread: Math.PI * 1.2, dir: -Math.PI / 2, size: 1
        });
      } else {
        s.stall = CONFIG.DOG_STALL;
        s.daze = CONFIG.DOG_STALL + CONFIG.DOG_DAZE;
        ML.sfx.play('bark');
        ML.engine.shake(2, 0.25);
        ML.engine.burst(px, py, 10, {
          colors: [P.WOOD_LIGHT, P.CREAM], speedMin: 20, speedMax: 70,
          life: 0.6, grav: 100, spread: Math.PI * 2, size: 1
        });
      }
    }

    function finish() {
      s.coverage = s.mowable ? (s.mown / s.mowable) : 1;
      var cov = s.coverage * CONFIG.COVERAGE_POINTS;
      var slack = CONFIG.FUEL_MAX - CONFIG.PAR_FUEL;
      var bonus = CONFIG.FUEL_POINTS * ML.clamp(slack > 0 ? s.fuel / slack : 0, 0, 1);
      /*
         Petrol you saved only counts if you actually did the job. Without this
         the best strategy is to mow three quarters of the lawn, switch off, and
         pocket a fat fuel bonus - which scored BETTER than finishing properly.
      */
      bonus *= ML.clamp((s.coverage - CONFIG.FUEL_NEEDS_COVERAGE)
        / (1 - CONFIG.FUEL_NEEDS_COVERAGE), 0, 1);
      s.finalScore = Math.round(ML.clamp(cov + bonus, 0, 1000));
      s.phase = 'shame'; s.phaseT = 0;
      ML.sfx.stopLoop('mow');
      ML.sfx.play(s.coverage > 0.95 ? 'crowd_cheer' : 'crowd_groan');
    }

    // -------------------------------------------------------------- update
    function updateMow(dt) {
      if (ML.input.justPressed('escape')) { ML.engine.push(ML.ui.pauseScene()); return; }

      /*
         SPACE shuts the engine off and banks whatever is left in the tank.
         This is what makes the brief's 800/200 split mean anything: without it
         you would always keep hunting for the last missed patch until you ran
         dry, so the fuel half of the score could never be paid. Now it is a
         real decision - go back for that strip you missed, or take the petrol.
      */
      if (ML.input.justPressed('space')) { finish(); return; }

      if (s.bumpFlash > 0) s.bumpFlash -= dt;
      if (s.daze > 0) s.daze -= dt;

      // --- the dog wanders
      var d = s.dog;
      d.retarget -= dt;
      if (d.retarget <= 0) {
        d.retarget = 1.4 + Math.random() * 2.2;
        d.tx = CONFIG.YARD_X + 10 + Math.random() * (YW - 20);
        d.ty = CONFIG.YARD_Y + 10 + Math.random() * (YH - 20);
      }
      var ddx = d.tx - d.x, ddy = d.ty - d.y;
      var dl = Math.sqrt(ddx * ddx + ddy * ddy) || 1;
      d.x += (ddx / dl) * CONFIG.DOG_SPEED * dt;
      d.y += (ddy / dl) * CONFIG.DOG_SPEED * dt;
      d.frame = (Math.floor(s.t * 8) % 2);

      // --- stalled? engine still burns petrol while he sorts himself out
      if (s.stall > 0) {
        s.stall -= dt;
        s.fuel -= CONFIG.BURN_IDLE * dt;
        if (s.fuel <= 0) { s.fuel = 0; finish(); }
        return;
      }

      // --- driving
      var throttle = 0;
      if (ML.input.isDown('up')) throttle = 1;
      else if (ML.input.isDown('down')) throttle = -1;

      var steer = 0;
      if (s.daze <= 0) {                       // the dog leaves him swiping at air
        if (ML.input.isDown('left')) steer -= 1;
        if (ML.input.isDown('right')) steer += 1;
      }

      if (throttle > 0) s.speed += CONFIG.ACCEL * dt;
      else if (throttle < 0) s.speed -= CONFIG.ACCEL * dt;
      s.speed *= Math.pow(1 / (1 + CONFIG.FRICTION), dt);
      s.speed = ML.clamp(s.speed, -CONFIG.REVERSE_SPEED, CONFIG.MAX_SPEED);

      /*
         It only turns while it is rolling - that is the turning radius. The
         floor matters: without it the swing rate would scale exactly with speed
         and the radius would come out the same however slowly you went, so
         easing off for a corner would do nothing. With it, a slow mower pivots
         tightly and a fast one runs wide, which is how a mower actually behaves
         and makes throttle control part of the route.
      */
      var roll = Math.abs(s.speed);
      var authority = ML.clamp(roll / CONFIG.MAX_SPEED, 0, 1);
      var swing = CONFIG.TURN_RATE * (CONFIG.TURN_LOW + (1 - CONFIG.TURN_LOW) * authority);
      // He can heave it round on the spot, slowly. Without that, nosing into a
      // fence would pin you there for good: no speed means no steering means no
      // way of getting off the fence.
      s.heading += steer * swing * dt * (s.speed < 0 ? -1 : 1);
      s.heading = (s.heading + 360) % 360;

      var f = fwd();
      var nx = s.x + f.x * s.speed * dt;
      var ny = s.y + f.y * s.speed * dt;

      // The fence. Clamping rather than reverting means he SLIDES along it
      // instead of stopping dead, so a glancing blow costs a little speed
      // rather than the whole run.
      var pad = 8;
      var minX = CONFIG.YARD_X + pad, maxX = CONFIG.YARD_X + YW - pad;
      var minY = CONFIG.YARD_Y + pad, maxY = CONFIG.YARD_Y + YH - pad;
      if (nx < minX) nx = minX; else if (nx > maxX) nx = maxX;
      if (ny < minY) ny = minY; else if (ny > maxY) ny = maxY;

      if (blockedAt(nx, ny)) { nx = s.x; ny = s.y; s.bumpFlash = 0.2; }

      /*
         Bleed speed in proportion to how much movement the obstruction actually
         cost us. Running square into the fence scrubs most of it; sliding ALONG
         the fence costs next to nothing - which matters, because the edge lane
         has to be mown and a flat per-frame penalty there would grind the mower
         to a halt and drink the tank.
      */
      var wanted = Math.abs(s.speed) * dt;
      if (wanted > 0.0001) {
        var gotX = nx - s.x, gotY = ny - s.y;
        var got = Math.sqrt(gotX * gotX + gotY * gotY);
        s.speed *= ML.clamp(0.3 + 0.7 * (got / wanted), 0, 1);
      }
      s.x = nx; s.y = ny;

      // --- petrol
      var burning = (roll > 2) ? CONFIG.BURN_DRIVE : CONFIG.BURN_IDLE;
      s.fuel -= burning * dt;

      if (roll > 2) {
        cut();
        if (Math.random() < 0.35) {
          ML.engine.spawn({
            x: s.x - f.x * 8 + ML.rand(-4, 4), y: s.y - f.y * 8 + ML.rand(-4, 4),
            vx: ML.rand(-14, 14), vy: ML.rand(-22, -6),
            life: 0.4, color: P.GRASS, size: 1, grav: 60
          });
        }
      }

      // --- what did we hit
      for (var i = 0; i < s.sprinklers.length; i++) {
        var sp = s.sprinklers[i];
        if (sp.hit > 0) { sp.hit -= dt; continue; }
        if (Math.abs(sp.x - s.x) < 9 && Math.abs(sp.y - s.y) < 9) {
          sp.hit = 3;
          stallOn('sprinkler', sp.x, sp.y);
        }
      }
      if (Math.abs(d.x + 7 - s.x) < 11 && Math.abs(d.y + 5 - s.y) < 10) {
        stallOn('dog', d.x + 7, d.y + 5);
        d.tx = CONFIG.YARD_X + 10 + Math.random() * (YW - 20);
        d.ty = CONFIG.YARD_Y + 10 + Math.random() * (YH - 20);
      }

      // --- done?
      if (s.fuel <= 0) { s.fuel = 0; finish(); return; }
      if (s.mown >= s.mowable) finish();
    }

    // --------------------------------------------------------------- draw
    function drawYard(ctx) {
      ML.engine.rect(CONFIG.YARD_X - 3, CONFIG.YARD_Y - 3, YW + 6, YH + 6, P.WOOD_DARK, ctx);
      ML.engine.rect(CONFIG.YARD_X - 2, CONFIG.YARD_Y - 2, YW + 4, YH + 4, P.WOOD, ctx);
      ctx.drawImage(s.lawn, CONFIG.YARD_X, CONFIG.YARD_Y);
    }

    function drawShame(ctx) {
      // every patch he missed, flashing
      if (Math.floor(s.phaseT * 6) % 2) return;
      ctx.fillStyle = P.hex(P.ORANGE);
      for (var cy = 0; cy < ROWS; cy++) {
        for (var cx = 0; cx < COLS; cx++) {
          if (tileAt(cx, cy) !== 0) continue;
          ctx.fillRect(CONFIG.YARD_X + cx * T, CONFIG.YARD_Y + cy * T, T, T);
        }
      }
    }

    function drawHud(ctx) {
      ML.engine.rect(0, 0, 320, 12, P.INK, ctx);
      ML.engine.rect(0, 12, 320, 1, P.CHARCOAL, ctx);

      var pct = Math.floor((s.mowable ? s.mown / s.mowable : 0) * 100);
      ML.font.drawText('CUT ' + pct + '%', 6, 3, P.CREAM, ctx);

      // the tank
      var fw = 74, fx = 232, fy = 3;
      ML.font.drawText('FUEL', fx - 30, fy, s.fuel < 25 ? P.ORANGE : P.STEEL, ctx);
      ML.engine.rect(fx - 1, fy - 1, fw + 2, 8, P.CHARCOAL, ctx);
      var frac = ML.clamp(s.fuel / CONFIG.FUEL_MAX, 0, 1);
      ML.engine.rect(fx, fy, Math.round(fw * frac), 6,
        frac < 0.25 ? P.ORANGE : P.AMBER, ctx);
      ML.engine.frameRect(fx - 1, fy - 1, fw + 2, 8, P.CREAM, ctx);
    }

    return {
      key: 'mowing',
      name: TITLE.name,

      enter: function () { ML.engine.clearParticles(); },
      exit: function () { ML.sfx.stopAllLoops(); },

      update: function (dt) {
        s.t += dt;
        s.phaseT += dt;

        if (s.phase === 'title') {
          if (s.phaseT >= CONFIG.TITLE_TIME || ML.input.justPressed('enter')) {
            s.phase = 'mow'; s.phaseT = 0;
            ML.sfx.play('confirm');
            ML.sfx.startLoop('mow');
          }
          return;
        }

        if (s.phase === 'shame') {
          if (s.phaseT >= CONFIG.SHAME_TIME) { s.phase = 'result'; s.phaseT = 0; }
          return;
        }

        if (s.phase === 'result') {
          if (s.phaseT >= CONFIG.RESULT_TIME || ML.input.justPressed('enter')) {
            ML.engine.replace(ML.ui.resultsScene({
              key: 'mowing',
              name: TITLE.name,
              score: s.finalScore,
              lines: [
                'LAWN CUT: ' + Math.round(s.coverage * 100) + '%',
                'PETROL LEFT: ' + Math.round(s.fuel) + '%'
              ]
            }));
          }
          return;
        }

        updateMow(dt);
      },

      draw: function (ctx) {
        ML.engine.rect(0, 0, 320, 180, P.SKY_DEEP, ctx);
        drawYard(ctx);

        // sprinklers sit flat in the grass
        for (var i = 0; i < s.sprinklers.length; i++) {
          var sp = s.sprinklers[i];
          ML.drawSprite('mw_sprink', Math.round(sp.x - 3), Math.round(sp.y - 2), null, ctx);
        }

        var d = s.dog;
        ML.drawSprite('mw_dog' + d.frame, Math.round(d.x), Math.round(d.y), null, ctx);

        for (var gi = 0; gi < s.gnomes.length; gi++) {
          var g = s.gnomes[gi];
          ML.drawSprite('mw_gnome',
            CONFIG.YARD_X + g.cx * T - 2, CONFIG.YARD_Y + g.cy * T - 7, null, ctx);
        }

        if (s.phase === 'mow' || s.phase === 'shame') {
          var hi = Math.round((s.heading / 360) * HEADINGS) % HEADINGS;
          ML.drawSprite('mw_mower' + hi, Math.round(s.x) - MC, Math.round(s.y) - MC,
            s.bumpFlash > 0 ? { tint: P.CREAM } : null, ctx);
        }

        ML.engine.drawParticles(ctx);

        if (s.phase === 'shame') {
          drawShame(ctx);
          // The missed patches flash ORANGE, so the caption cannot be orange
          // too - ink underneath, cream on top, readable against both.
          ML.font.drawTextWavyCentered('YOU MISSED A BIT', 161, 85, P.INK, s.t, 2, 0.6, ctx);
          ML.font.drawTextWavyCentered('YOU MISSED A BIT', 160, 84, P.CREAM, s.t, 2, 0.6, ctx);
        }

        drawHud(ctx);

        if (s.phase === 'mow') {
          if (s.daze > 0) {
            ML.font.drawTextShadowCentered('GET OUT OF IT!', 160, 172, P.ORANGE, ctx);
          } else if (s.stall > 0) {
            ML.font.drawTextShadowCentered('...', 160, 172, P.STEEL, ctx);
          } else {
            ML.font.drawTextShadowCentered('UP DRIVES   ARROWS STEER   SPACE STOPS', 160, 172, P.CREAM, ctx);
          }
        }

        if (s.phase === 'title') {
          TITLE.remaining = CONFIG.TITLE_TIME - s.phaseT;
          ML.ui.drawTitleCard(TITLE, s.t, ctx);
        } else if (s.phase === 'result') {
          ML.ui.drawResultCard({
            name: TITLE.name,
            score: s.finalScore,
            lines: ['LAWN CUT: ' + Math.round(s.coverage * 100) + '%'],
            footer: 'ENTER SKIPS'
          }, s.phaseT, ctx);
        }
      }
    };
  }

  return { scene: scene, CONFIG: CONFIG, name: TITLE.name, key: 'mowing' };
})();
