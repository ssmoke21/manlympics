/*
  ==========================================================================
  EVENT 6 - BACK IT IN (parallel parking)
  ==========================================================================

  Spatial reasoning under pressure.

  WHAT THE PLAYER DOES
    UP drives forward, DOWN reverses, LEFT and RIGHT steer. You start alongside
    the car in front of the space; the space is behind you. Reverse into it.

    The steering is a proper bicycle model - the car swings about its REAR axle,
    the way a real one does. That is the whole event: you cannot slide sideways
    into the space, you have to cut hard, get the back end in, then straighten
    up. Reversing swings the nose the opposite way to going forward, which is
    the bit that catches people out.

    The space is about one and a half car lengths, so there is room to do it
    properly and not much more.

  WHAT COSTS YOU
    Clout either parked car and you get a horn and a HEY! from someone off
    screen, plus a points penalty. Put a wheel up on the kerb and that costs
    too, though less.

  SHUNTS INSTEAD OF A CLOCK
    The brief gives you 90 seconds and scores the time left over. There is no
    countdown here, in line with the other events - but a parking manoeuvre
    still needs a measure of "did you do that cleanly or did you saw at it".

    So the currency is SHUNTS: every time you swap between drive and reverse,
    that is one, exactly the way a driving examiner counts them. A tidy park
    takes two or three. You get a fixed allowance per attempt, the ones you did
    not use are worth points, and running out ends the attempt where it stands -
    which is also what guarantees the event finishes.

    TWO ATTEMPTS, best one counts, straight from the brief. SPACE ends an
    attempt and has it judged.

  WHERE THE DIFFICULTY KNOBS ARE
    BAY_LENGTH ......... how big the space is. Bigger = easier.
    SHUNTS ............. allowance per attempt. More = easier.
    MAX_STEER .......... how far the wheels turn. Bigger = tighter circle = easier.
    WHEELBASE .......... shorter turns tighter.
    MAX_SPEED_* ........ how fast it creeps.
    BUMP_PENALTY / KERB_PENALTY ... what a clout costs.
    CENTRE_POINTS / KERB_POINTS / ALIGN_POINTS / SHUNT_POINTS ... the score split.

  If it feels too hard, raise BAY_LENGTH and MAX_STEER first.
*/
window.ML = window.ML || {};
ML.events = ML.events || {};

ML.events.parking = (function () {
  var P = ML.palette;

  var CONFIG = {
    // ---- pacing
    RESULT_TIME: 3,
    JUDGE_TIME: 2.6,         // the verdict on an attempt
    ATTEMPTS: 2,

    // ---- the car
    CAR_LEN: 34, CAR_WID: 18,
    WHEELBASE: 22,           // rear axle to front axle
    REAR_OVERHANG: 6,        // how much car sticks out behind the rear axle
    MAX_SPEED_FWD: 52,
    MAX_SPEED_REV: 40,
    ACCEL: 105,
    FRICTION: 2.9,
    MAX_STEER: 34,           // degrees of lock
    STEER_RATE: 140,         // degrees per second of input
    STEER_RETURN: 95,        // how fast the wheel self-centres

    // ---- the street
    BAY_LENGTH: 58,          // a bit over one and a half car lengths - at 52 a
                             // clean manoeuvre was not actually possible
    PARK_A_X: 90,            // the car in front
    KERB_Y: 134,
    CAR_TOP: 116,
    ROAD_TOP: 20,
    START_Y: 96,

    // ---- shunts
    SHUNTS: 12,

    // ---- what a clout costs
    BUMP_PENALTY: 70,
    KERB_PENALTY: 35,
    BUMP_PUSH: 26,           // how hard it shoves you back off the other car

    // ---- score out of 1000
    CENTRE_POINTS: 250,
    KERB_POINTS: 250,
    ALIGN_POINTS: 200,
    SHUNT_POINTS: 300,
    IDEAL_KERB_GAP: 3        // pixels from the kerb is a perfect park
  };

  var TITLE = {
    number: 6,
    name: 'BACK IT IN',
    joke: [
      'RULE 22: ONE SHOT. EVERYONE IS WATCHING.',
      'THE SPACE IS BIG ENOUGH. THAT IS THE PROBLEM.'
    ],
    controls: [
      'UP AND DOWN DRIVE.  LEFT AND RIGHT STEER.',
      'SPACE WHEN YOU RECKON THAT WILL DO.'
    ]
  };

  // ================================================================= sprites
  var HEADINGS = 32;
  var CW = 44, CC = 22;
  var spritesReady = false;

  /*
     Cars are baked at 32 headings. Alignment is scored here, so the angle needs
     finer steps than the mower had, or a car that looks straight would score as
     crooked.
  */
  function makeCar(deg, body, roof) {
    var th = deg * Math.PI / 180;
    var cos = Math.cos(th), sin = Math.sin(th);
    var g = ML.sprites.grid(CW, CW);
    var hl = CONFIG.CAR_LEN / 2, hw = CONFIG.CAR_WID / 2;
    for (var y = 0; y < CW; y++) {
      for (var x = 0; x < CW; x++) {
        var wx = x - CC, wy = y - CC;
        var lx = wx * cos + wy * sin;          // into car space, nose at +x
        var ly = -wx * sin + wy * cos;
        if (Math.abs(lx) > hl || Math.abs(ly) > hw) continue;
        /*
           Paint order matters: the cabin and glass are INSET, so the body colour
           still shows along the flanks, nose and tail. Letting them span the
           whole width left every car a featureless grey slab.
        */
        var c = body;
        var inset = Math.abs(ly) <= hw - 3;
        if (inset && lx > -5 && lx < 6) c = roof;                       // roof
        else if (inset && lx >= 6 && lx < 11) c = '3';                  // windscreen
        else if (inset && lx <= -5 && lx > -10) c = '3';                // rear window
        if (lx > hl - 3 && Math.abs(ly) < hw - 2) c = 'c';              // headlights
        if (lx < -hl + 3 && Math.abs(ly) < hw - 2) c = 'd';             // tail lights
        if (Math.abs(lx) > hl - 1 || Math.abs(ly) > hw - 1) c = '0';    // panel edge
        g[y][x] = c;
      }
    }
    return ML.sprites.strings(g);
  }

  function ensureSprites() {
    if (spritesReady) return;
    for (var i = 0; i < HEADINGS; i++) {
      ML.sprites.add('pk_car' + i, makeCar((360 * i) / HEADINGS, 'd', '9'));
    }
    ML.sprites.add('pk_parkA', makeCar(180, '6', '2'));
    ML.sprites.add('pk_parkB', makeCar(180, '7', '2'));
    spritesReady = true;
  }

  // =================================================================== scene
  function scene(opts) {
    opts = opts || {};
    ensureSprites();

    var BAY_X0 = CONFIG.PARK_A_X + CONFIG.CAR_LEN;
    var BAY_X1 = BAY_X0 + CONFIG.BAY_LENGTH;
    var PARK_B_X = BAY_X1;
    var CAR_MID_Y = CONFIG.CAR_TOP + CONFIG.CAR_WID / 2;

    var s = {
      phase: 'title',        // title | park | judge | result
      phaseT: 0,
      t: 0,

      attempt: 0,
      best: 0,
      lastVerdict: null,

      x: 0, y: 0, heading: 180, speed: 0, steer: 0,
      gear: 'N',
      shunts: 0,
      bumps: 0, kerbs: 0,
      hey: 0,                // the HEY! popup timer
      flash: 0,

      finalScore: 0
    };

    function resetCar() {
      // alongside the car in front, one lane out, pointing up the street
      s.x = CONFIG.PARK_A_X + CONFIG.CAR_LEN - 4;
      s.y = CONFIG.START_Y;
      s.heading = 180;
      s.speed = 0; s.steer = 0; s.gear = 'N';
      s.shunts = 0; s.bumps = 0; s.kerbs = 0;
      s.hey = 0; s.flash = 0;
    }

    function startAttempt() {
      resetCar();
      s.phase = 'park'; s.phaseT = 0;
    }

    // --- the car body, as eight points around its outline
    function bodyPoints() {
      var h = s.heading * Math.PI / 180;
      var cos = Math.cos(h), sin = Math.sin(h);
      // (x,y) is the REAR AXLE; the body runs from -overhang to +len-overhang
      var back = -CONFIG.REAR_OVERHANG;
      var front = CONFIG.CAR_LEN - CONFIG.REAR_OVERHANG;
      var hw = CONFIG.CAR_WID / 2;
      var pts = [];
      var alongs = [back, back + (front - back) / 2, front];
      for (var i = 0; i < alongs.length; i++) {
        for (var side = -1; side <= 1; side += 2) {
          var lx = alongs[i], ly = side * hw;
          pts.push({
            x: s.x + lx * cos - ly * sin,
            y: s.y + lx * sin + ly * cos
          });
        }
      }
      return pts;
    }

    function carCentre() {
      var h = s.heading * Math.PI / 180;
      var d = CONFIG.CAR_LEN / 2 - CONFIG.REAR_OVERHANG;
      return { x: s.x + Math.cos(h) * d, y: s.y + Math.sin(h) * d };
    }

    function hitsParked(pts) {
      var boxes = [
        { x0: CONFIG.PARK_A_X, x1: CONFIG.PARK_A_X + CONFIG.CAR_LEN, y0: CONFIG.CAR_TOP, y1: CONFIG.KERB_Y },
        { x0: PARK_B_X, x1: PARK_B_X + CONFIG.CAR_LEN, y0: CONFIG.CAR_TOP, y1: CONFIG.KERB_Y }
      ];
      for (var i = 0; i < pts.length; i++) {
        for (var b = 0; b < boxes.length; b++) {
          var q = boxes[b];
          if (pts[i].x > q.x0 && pts[i].x < q.x1 && pts[i].y > q.y0 && pts[i].y < q.y1) return true;
        }
      }
      return false;
    }

    function hitsKerb(pts) {
      for (var i = 0; i < pts.length; i++) if (pts[i].y > CONFIG.KERB_Y) return true;
      return false;
    }

    function bump(kind) {
      if (s.flash > 0) return;                  // one clout per contact
      s.flash = 0.45;
      s.speed = -s.speed * 0.25;
      if (kind === 'car') {
        s.bumps++;
        s.hey = 1.4;
        ML.sfx.play('honk');
        ML.engine.shake(3, 0.28);
      } else {
        s.kerbs++;
        ML.sfx.play('thud');
        ML.engine.shake(2, 0.18);
      }
      ML.engine.burst(s.x, s.y, 8, {
        colors: [P.CREAM, P.STEEL], speedMin: 20, speedMax: 60,
        life: 0.4, spread: Math.PI * 2, size: 1
      });
    }

    // --------------------------------------------------------------- scoring
    function judge() {
      var c = carCentre();
      var bayMid = (BAY_X0 + BAY_X1) / 2;

      // how much of the car actually ended up in the space
      var inX = ML.clamp(1 - Math.abs(c.x - bayMid) / (CONFIG.BAY_LENGTH / 2), 0, 1);
      var inY = ML.clamp(1 - Math.abs(c.y - CAR_MID_Y) / 26, 0, 1);
      var parked = inX * inY;

      var centre = ML.clamp(1 - Math.abs(c.x - bayMid) / (CONFIG.BAY_LENGTH / 2 - 4), 0, 1);

      // the kerb-side edge of the car versus the kerb itself
      var edge = c.y + CONFIG.CAR_WID / 2;
      var gap = CONFIG.KERB_Y - edge;
      var kerb = (gap < 0) ? 0 : ML.clamp(1 - Math.abs(gap - CONFIG.IDEAL_KERB_GAP) / 13, 0, 1);

      // parallel to the kerb, either way round
      var off = Math.abs(((s.heading % 180) + 180) % 180 - 0);
      if (off > 90) off = 180 - off;
      var align = ML.clamp(1 - off / 26, 0, 1);

      var shuntsLeft = ML.clamp((CONFIG.SHUNTS - s.shunts) / CONFIG.SHUNTS, 0, 1);

      var raw = parked * (centre * CONFIG.CENTRE_POINTS
        + kerb * CONFIG.KERB_POINTS
        + align * CONFIG.ALIGN_POINTS)
        + shuntsLeft * CONFIG.SHUNT_POINTS
        - s.bumps * CONFIG.BUMP_PENALTY
        - s.kerbs * CONFIG.KERB_PENALTY;

      return {
        score: Math.round(ML.clamp(raw, 0, 1000)),
        parked: parked, centre: centre, kerb: kerb, align: align,
        shunts: s.shunts, bumps: s.bumps, kerbs: s.kerbs
      };
    }

    function endAttempt() {
      var v = judge();
      s.lastVerdict = v;
      if (v.score > s.best) s.best = v.score;
      s.phase = 'judge'; s.phaseT = 0;
      ML.sfx.play(v.score > 550 ? 'crowd_cheer' : 'crowd_groan');
    }

    // ---------------------------------------------------------------- update
    function updatePark(dt) {
      if (ML.input.justPressed('escape')) { ML.engine.push(ML.ui.pauseScene()); return; }
      if (ML.input.justPressed('space')) { endAttempt(); return; }

      if (s.flash > 0) s.flash -= dt;
      if (s.hey > 0) s.hey -= dt;

      // --- steering, with the wheel self-centring when you let go
      var st = 0;
      if (ML.input.isDown('left')) st -= 1;
      if (ML.input.isDown('right')) st += 1;
      if (st !== 0) s.steer += st * CONFIG.STEER_RATE * dt;
      else {
        if (s.steer > 0) s.steer = Math.max(0, s.steer - CONFIG.STEER_RETURN * dt);
        else s.steer = Math.min(0, s.steer + CONFIG.STEER_RETURN * dt);
      }
      s.steer = ML.clamp(s.steer, -CONFIG.MAX_STEER, CONFIG.MAX_STEER);

      // --- gear and throttle. Swapping between drive and reverse is a SHUNT.
      var want = 0;
      if (ML.input.isDown('up')) want = 1;
      else if (ML.input.isDown('down')) want = -1;

      if (want === 1 && s.gear !== 'D') {
        if (s.gear === 'R') s.shunts++;
        s.gear = 'D';
        if (s.shunts >= CONFIG.SHUNTS) { endAttempt(); return; }
      } else if (want === -1 && s.gear !== 'R') {
        if (s.gear === 'D') s.shunts++;
        s.gear = 'R';
        if (s.shunts >= CONFIG.SHUNTS) { endAttempt(); return; }
      }

      if (want === 1) s.speed += CONFIG.ACCEL * dt;
      else if (want === -1) s.speed -= CONFIG.ACCEL * dt;
      s.speed *= Math.pow(1 / (1 + CONFIG.FRICTION), dt);
      s.speed = ML.clamp(s.speed, -CONFIG.MAX_SPEED_REV, CONFIG.MAX_SPEED_FWD);

      /*
         The bicycle model, referenced to the REAR AXLE. This is what makes it
         behave like a car: the back wheels track the corner, the nose swings
         wide, and in reverse the whole thing swings the other way.
      */
      var h = s.heading * Math.PI / 180;
      var turn = (s.speed / CONFIG.WHEELBASE) * Math.tan(s.steer * Math.PI / 180);
      s.heading += turn * dt * 180 / Math.PI;
      var nx = s.x + Math.cos(h) * s.speed * dt;
      var ny = s.y + Math.sin(h) * s.speed * dt;

      var saveX = s.x, saveY = s.y;
      s.x = nx; s.y = ny;
      var pts = bodyPoints();

      if (hitsParked(pts)) {
        s.x = saveX; s.y = saveY;
        bump('car');
      } else if (hitsKerb(pts)) {
        s.x = saveX; s.y = saveY;
        bump('kerb');
      }

      // keep him on the street
      s.x = ML.clamp(s.x, 12, 308);
      s.y = ML.clamp(s.y, CONFIG.ROAD_TOP + 12, CONFIG.KERB_Y + 6);
    }

    function nextAttempt() {
      s.attempt++;
      if (s.attempt >= CONFIG.ATTEMPTS) {
        s.finalScore = s.best;
        s.phase = 'result'; s.phaseT = 0;
        ML.sfx.play(s.finalScore > 550 ? 'fanfare' : 'crowd_groan');
      } else {
        startAttempt();
      }
    }

    // ----------------------------------------------------------------- draw
    function drawStreet(ctx) {
      ML.engine.rect(0, 0, 320, 180, P.GRAY, ctx);
      ML.engine.rect(0, CONFIG.ROAD_TOP, 320, CONFIG.KERB_Y - CONFIG.ROAD_TOP, P.CHARCOAL, ctx);
      // centre line up the middle of the road
      for (var d = 4; d < 320; d += 22) {
        ML.engine.rect(d, CONFIG.ROAD_TOP + 26, 12, 2, P.AMBER, ctx);
      }
      // kerb and pavement
      ML.engine.rect(0, CONFIG.KERB_Y, 320, 3, P.CREAM, ctx);
      ML.engine.rect(0, CONFIG.KERB_Y + 3, 320, 180 - CONFIG.KERB_Y - 3, P.STEEL, ctx);
      for (var p = 0; p < 320; p += 26) {
        ML.engine.rect(p, CONFIG.KERB_Y + 3, 1, 180 - CONFIG.KERB_Y - 3, P.GRAY, ctx);
      }

      // the space itself, marked out so you can see what you are aiming at
      ML.engine.rect(BAY_X0, CONFIG.CAR_TOP - 1, 1, CONFIG.KERB_Y - CONFIG.CAR_TOP + 1, P.CREAM, ctx);
      ML.engine.rect(BAY_X1 - 1, CONFIG.CAR_TOP - 1, 1, CONFIG.KERB_Y - CONFIG.CAR_TOP + 1, P.CREAM, ctx);
    }

    function drawCars(ctx) {
      ML.drawSprite('pk_parkA', CONFIG.PARK_A_X + CONFIG.CAR_LEN / 2 - CC, CAR_MID_Y - CC, null, ctx);
      ML.drawSprite('pk_parkB', PARK_B_X + CONFIG.CAR_LEN / 2 - CC, CAR_MID_Y - CC, null, ctx);

      if (s.phase === 'park' || s.phase === 'judge') {
        var idx = Math.round((((s.heading % 360) + 360) % 360) / 360 * HEADINGS) % HEADINGS;
        var c = carCentre();
        ML.drawSprite('pk_car' + idx, c.x - CC, c.y - CC,
          s.flash > 0 ? { tint: P.CREAM } : null, ctx);
      }
    }

    function drawHud(ctx) {
      ML.engine.rect(0, 0, 320, 12, P.INK, ctx);
      ML.engine.rect(0, 12, 320, 1, P.CHARCOAL, ctx);
      ML.font.drawText('ATTEMPT ' + Math.min(s.attempt + 1, CONFIG.ATTEMPTS) + ' OF ' + CONFIG.ATTEMPTS,
        6, 3, P.CREAM, ctx);
      var left = CONFIG.SHUNTS - s.shunts;
      ML.font.drawText('SHUNTS ' + s.shunts + '/' + CONFIG.SHUNTS, 128, 3,
        left <= 3 ? P.ORANGE : P.CREAM, ctx);
      ML.font.drawText('BEST ' + s.best, 250, 3, P.AMBER, ctx);
    }

    function drawGearAndWheel(ctx) {
      // gear on the left, the wheel next to it, the prompt well clear on the
      // right - all three used to pile into each other
      ML.font.drawTextShadow('GEAR', 8, 146, P.STEEL, ctx);
      var g = s.gear === 'D' ? 'D' : (s.gear === 'R' ? 'R' : 'N');
      ML.font.drawTextShadow(g, 8, 158, s.gear === 'R' ? P.ACCENT : P.CREAM, ctx);

      var cx = 76, cy = 152;
      ML.engine.rect(cx - 28, cy - 1, 56, 4, P.CHARCOAL, ctx);
      ML.engine.rect(cx - 1, cy - 4, 2, 10, P.GRAY, ctx);        // straight-ahead notch
      var k = Math.round((s.steer / CONFIG.MAX_STEER) * 26);
      ML.engine.rect(cx + k - 2, cy - 4, 4, 10, P.ACCENT, ctx);
      ML.font.drawTextShadow('WHEEL', 61, 162, P.STEEL, ctx);
    }

    function drawJudge(ctx) {
      var v = s.lastVerdict;
      if (!v) return;
      ML.ui.dither(ctx, 46, 40, 228, 92);
      ML.engine.rect(48, 42, 224, 88, P.CHARCOAL, ctx);
      ML.engine.frameRect(48, 42, 224, 88, P.CREAM, ctx);
      ML.font.drawTextCentered('ATTEMPT ' + (s.attempt + 1), 160, 48, P.AMBER, ctx);
      ML.font.drawTextCentered('IN THE SPACE  ' + Math.round(v.parked * 100) + '%', 160, 62, P.CREAM, ctx);
      ML.font.drawTextCentered('CENTRED ' + Math.round(v.centre * 100)
        + '   KERB ' + Math.round(v.kerb * 100)
        + '   STRAIGHT ' + Math.round(v.align * 100), 160, 74, P.STEEL, ctx);
      ML.font.drawTextCentered('SHUNTS ' + v.shunts + '   BUMPS ' + v.bumps + '   KERBED ' + v.kerbs,
        160, 86, v.bumps ? P.ORANGE : P.STEEL, ctx);
      ML.ui.bigText(String(v.score), 160, 98, P.ACCENT, 2, ctx);
    }

    return {
      key: 'parking',
      name: TITLE.name,

      enter: function () { ML.engine.clearParticles(); resetCar(); },
      exit: function () { ML.sfx.stopAllLoops(); },

      update: function (dt) {
        s.t += dt;
        s.phaseT += dt;

        if (s.phase === 'title') {
          if (ML.ui.titleDone(s.phaseT)) {
            ML.sfx.play('confirm');
            startAttempt();
          }
          return;
        }

        if (s.phase === 'result') {
          if (s.phaseT >= CONFIG.RESULT_TIME || ML.input.justPressed('enter')) {
            ML.engine.replace(ML.ui.resultsScene({
              key: 'parking',
              name: TITLE.name,
              score: s.finalScore,
              lines: [
                'BEST OF ' + CONFIG.ATTEMPTS + ' ATTEMPTS',
                'THAT IS AS GOOD AS IT GOT'
              ]
            }));
          }
          return;
        }

        if (s.phase === 'judge') {
          if (s.phaseT >= CONFIG.JUDGE_TIME) nextAttempt();
          return;
        }

        updatePark(dt);
      },

      draw: function (ctx) {
        drawStreet(ctx);
        drawCars(ctx);
        ML.engine.drawParticles(ctx);

        if (s.phase === 'park') {
          drawGearAndWheel(ctx);
          ML.font.drawTextShadowCentered('SPACE WHEN THAT WILL DO', 224, 152, P.CREAM, ctx);
          if (s.hey > 0) {
            ML.font.drawTextWavyCentered('HEY!', 250, 30, P.ORANGE, s.t, 2, 0.8, ctx);
          }
        }

        drawHud(ctx);

        if (s.phase === 'judge') drawJudge(ctx);

        if (s.phase === 'title') {
          ML.ui.drawTitleCard(TITLE, s.t, ctx);
        } else if (s.phase === 'result') {
          ML.ui.drawResultCard({
            name: TITLE.name,
            score: s.finalScore,
            lines: ['BEST OF ' + CONFIG.ATTEMPTS + ' ATTEMPTS'],
            footer: 'ENTER SKIPS'
          }, s.phaseT, ctx);
        }
      }
    };
  }

  return { scene: scene, CONFIG: CONFIG, name: TITLE.name, key: 'parking' };
})();
