/*
  ENGINE - the machinery every screen and event sits on top of.

  * 320x180 internal resolution, scaled up by a whole number only (2x, 3x, 4x).
    Black letterbox bars fill the rest of the window.
  * Fixed 60 FPS timestep with an accumulator, so a 144Hz monitor plays the same
    speed as a 60Hz one.
  * Scene stack. A scene is { enter(), update(dt), draw(ctx), exit() }. Menus,
    events and the pause overlay are all just scenes.
  * Input manager: ML.input.isDown / justPressed / justReleased.
  * 300 pre-allocated particles. Nothing is allocated inside the game loop.
  * ML.engine.shake(intensity, seconds) and ML.engine.hitstop(frames).
*/
window.ML = window.ML || {};

// ------------------------------------------------------------------ INPUT

ML.input = (function () {
  // Physical key -> the name the game uses.
  var MAP = {
    'ArrowUp': 'up', 'ArrowDown': 'down', 'ArrowLeft': 'left', 'ArrowRight': 'right',
    'Space': 'space', 'Enter': 'enter', 'NumpadEnter': 'enter', 'Escape': 'escape',
    'KeyW': 'w', 'KeyA': 'a', 'KeyS': 's', 'KeyD': 'd',
    'ShiftLeft': 'shift', 'KeyM': 'm', 'KeyP': 'p',
    'Backspace': 'back'
  };
  // Fallback for events that arrive without a physical `code` (some remapped
  // layouts, and anything synthesised by a script).
  var KEYMAP = {
    'ArrowUp': 'up', 'ArrowDown': 'down', 'ArrowLeft': 'left', 'ArrowRight': 'right',
    ' ': 'space', 'Spacebar': 'space', 'Enter': 'enter', 'Escape': 'escape', 'Esc': 'escape',
    'w': 'w', 'a': 'a', 's': 's', 'd': 'd',
    'W': 'w', 'A': 'a', 'S': 's', 'D': 'd',
    'Shift': 'shift', 'm': 'm', 'M': 'm', 'p': 'p', 'P': 'p'
  };

  // Keys whose browser default (scrolling, page nav) we swallow.
  var SWALLOW = {
    'ArrowUp': 1, 'ArrowDown': 1, 'ArrowLeft': 1, 'ArrowRight': 1,
    'Space': 1, 'Enter': 1, 'Backspace': 1
  };

  var down = {}, pressed = {}, released = {}, anyPressedFlag = false;

  function nameOf(e) {
    return MAP[e.code] || KEYMAP[e.key] || null;
  }

  function onDown(e) {
    var k = nameOf(e);
    if (SWALLOW[e.code] || k === 'space' || k === 'enter') e.preventDefault();
    if (!k) return;
    ML.sfx.unlock();
    if (!down[k]) { pressed[k] = true; anyPressedFlag = true; }
    down[k] = true;
    if (k === 'm') ML.sfx.toggleMute();
  }

  function onUp(e) {
    var k = nameOf(e);
    if (!k) return;
    down[k] = false;
    released[k] = true;
  }

  return {
    // Player 1 uses arrows + space, player 2 uses WASD + left shift.
    P1: { up: 'up', down: 'down', left: 'left', right: 'right', action: 'space' },
    P2: { up: 'w', down: 's', left: 'a', right: 'd', action: 'shift' },

    init: function () {
      window.addEventListener('keydown', onDown);
      window.addEventListener('keyup', onUp);
      window.addEventListener('blur', function () { down = {}; });
    },

    isDown: function (k) { return !!down[k]; },
    justPressed: function (k) { return !!pressed[k]; },
    justReleased: function (k) { return !!released[k]; },
    anyPressed: function () { return anyPressedFlag; },

    // Called at the end of every fixed update step.
    endFrame: function () {
      pressed = {}; released = {}; anyPressedFlag = false;
    }
  };
})();

// ------------------------------------------------------------------ ENGINE

ML.engine = (function () {
  var W = 320, H = 180;
  var STEP = 1 / 60;
  var MAX_PARTICLES = 300;

  var canvas = null, ctx = null, scale = 1;
  var scenes = [];
  var acc = 0, last = 0, running = false;
  var shakeI = 0, shakeT = 0, shakeDur = 0;
  var freezeFrames = 0;
  var particles = [];
  var pIndex = 0;

  function initParticles() {
    for (var i = 0; i < MAX_PARTICLES; i++) {
      particles.push({
        active: false, x: 0, y: 0, vx: 0, vy: 0,
        life: 0, maxLife: 1, color: 4, size: 1,
        grav: 0, drag: 1, shrink: false, fade: true
      });
    }
  }

  function resize() {
    var s = Math.floor(Math.min(window.innerWidth / W, window.innerHeight / H));
    if (s < 1) s = 1;
    scale = s;
    canvas.style.width = (W * s) + 'px';
    canvas.style.height = (H * s) + 'px';
  }

  function step(dt) {
    if (freezeFrames > 0) { freezeFrames--; ML.input.endFrame(); return; }

    var top = scenes[scenes.length - 1];
    if (top && top.update) top.update(dt);

    // particles keep moving even while a scene is paused underneath
    for (var i = 0; i < particles.length; i++) {
      var p = particles[i];
      if (!p.active) continue;
      p.life -= dt;
      if (p.life <= 0) { p.active = false; continue; }
      p.vy += p.grav * dt;
      p.vx *= Math.pow(p.drag, dt * 60);
      p.vy *= Math.pow(p.drag, dt * 60);
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }

    if (shakeT > 0) shakeT -= dt;
    ML.input.endFrame();
  }

  function render() {
    ctx.save();
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H);

    if (shakeT > 0) {
      var k = shakeT / shakeDur;
      var amt = shakeI * k;
      ctx.translate(
        Math.round((Math.random() * 2 - 1) * amt),
        Math.round((Math.random() * 2 - 1) * amt)
      );
    }

    // draw from the lowest scene that fully covers the screen
    var start = 0;
    for (var i = scenes.length - 1; i >= 0; i--) {
      if (scenes[i].opaque !== false) { start = i; break; }
    }
    for (var j = start; j < scenes.length; j++) {
      if (scenes[j].draw) scenes[j].draw(ctx);
    }
    ctx.restore();
  }

  function frame(ts) {
    if (!running) return;
    var t = ts / 1000;
    var dt = t - last;
    last = t;
    if (dt > 0.25) dt = 0.25;      // after a tab switch, don't fast-forward
    acc += dt;
    var guard = 0;
    while (acc >= STEP && guard < 5) { step(STEP); acc -= STEP; guard++; }
    if (guard >= 5) acc = 0;
    render();
    requestAnimationFrame(frame);
  }

  return {
    W: W, H: H, STEP: STEP,
    get ctx() { return ctx; },
    get canvas() { return canvas; },
    get scale() { return scale; },
    time: 0,

    init: function (cv) {
      canvas = cv;
      canvas.width = W; canvas.height = H;
      ctx = canvas.getContext('2d', { alpha: false });
      ctx.imageSmoothingEnabled = false;
      initParticles();
      ML.input.init();
      window.addEventListener('resize', resize);
      resize();
    },

    start: function () {
      if (running) return;
      running = true;
      last = performance.now() / 1000;
      requestAnimationFrame(frame);
    },

    // --- scene stack
    push: function (s) {
      var top = scenes[scenes.length - 1];
      if (top && top.pause) top.pause();
      scenes.push(s);
      if (s.enter) s.enter();
    },
    pop: function () {
      var s = scenes.pop();
      if (s && s.exit) s.exit();
      var top = scenes[scenes.length - 1];
      if (top && top.resume) top.resume();
      return s;
    },
    replace: function (s) {
      var old = scenes.pop();
      if (old && old.exit) old.exit();
      scenes.push(s);
      if (s.enter) s.enter();
    },
    // Throw away everything and start fresh (used by "quit to title").
    reset: function (s) {
      while (scenes.length) { var o = scenes.pop(); if (o && o.exit) o.exit(); }
      scenes.push(s);
      if (s.enter) s.enter();
    },
    top: function () { return scenes[scenes.length - 1]; },
    depth: function () { return scenes.length; },

    // --- juice
    // A new shake only wins if nothing is shaking, or if it hits harder.
    shake: function (intensity, duration) {
      if (duration === undefined) duration = 0.25;
      if (shakeT <= 0 || intensity >= shakeI) {
        shakeI = intensity;
        shakeDur = duration;
        shakeT = duration;
      }
    },
    hitstop: function (frames) {
      freezeFrames = Math.max(freezeFrames, frames | 0);
    },

    // --- particles
    spawn: function (o) {
      var tries = 0, p = null;
      while (tries < MAX_PARTICLES) {
        var cand = particles[pIndex];
        pIndex = (pIndex + 1) % MAX_PARTICLES;
        tries++;
        if (!cand.active) { p = cand; break; }
      }
      if (!p) { p = particles[pIndex]; pIndex = (pIndex + 1) % MAX_PARTICLES; }
      p.active = true;
      p.x = o.x; p.y = o.y;
      p.vx = o.vx || 0; p.vy = o.vy || 0;
      p.maxLife = p.life = (o.life === undefined ? 0.6 : o.life);
      p.color = (o.color === undefined ? 4 : o.color);
      p.size = o.size || 1;
      p.grav = (o.grav === undefined ? 0 : o.grav);
      p.drag = (o.drag === undefined ? 1 : o.drag);
      p.shrink = !!o.shrink;
      p.fade = o.fade !== false;
      return p;
    },

    burst: function (x, y, count, o) {
      o = o || {};
      var spread = o.spread === undefined ? Math.PI * 2 : o.spread;
      var dir = o.dir === undefined ? 0 : o.dir;
      var spdMin = o.speedMin === undefined ? 20 : o.speedMin;
      var spdMax = o.speedMax === undefined ? 70 : o.speedMax;
      for (var i = 0; i < count; i++) {
        var a = dir + (Math.random() - 0.5) * spread;
        var sp = spdMin + Math.random() * (spdMax - spdMin);
        ML.engine.spawn({
          x: x, y: y,
          vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
          life: (o.life === undefined ? 0.5 : o.life) * (0.6 + Math.random() * 0.7),
          color: Array.isArray(o.colors) ? o.colors[(Math.random() * o.colors.length) | 0] : (o.color === undefined ? 4 : o.color),
          size: o.size || 1,
          grav: o.grav === undefined ? 0 : o.grav,
          drag: o.drag === undefined ? 1 : o.drag,
          shrink: !!o.shrink
        });
      }
    },

    clearParticles: function () {
      for (var i = 0; i < particles.length; i++) particles[i].active = false;
    },

    drawParticles: function (c) {
      c = c || ctx;
      for (var i = 0; i < particles.length; i++) {
        var p = particles[i];
        if (!p.active) continue;
        var t = p.life / p.maxLife;
        if (p.fade && t < 0.25 && ((p.life * 60) | 0) % 2 === 0) continue;  // flicker out
        var s = p.shrink ? Math.max(1, Math.round(p.size * t)) : p.size;
        c.fillStyle = ML.palette.hex(p.color);
        c.fillRect(Math.round(p.x), Math.round(p.y), s, s);
      }
    },

    // --- small helpers scenes use constantly
    rect: function (x, y, w, h, colorIndex, c) {
      c = c || ctx;
      c.fillStyle = ML.palette.hex(colorIndex);
      c.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
    },
    frameRect: function (x, y, w, h, colorIndex, c) {
      ML.engine.rect(x, y, w, 1, colorIndex, c);
      ML.engine.rect(x, y + h - 1, w, 1, colorIndex, c);
      ML.engine.rect(x, y, 1, h, colorIndex, c);
      ML.engine.rect(x + w - 1, y, 1, h, colorIndex, c);
    },
    panel: function (x, y, w, h, fill, border, c) {
      ML.engine.rect(x, y, w, h, fill === undefined ? 1 : fill, c);
      ML.engine.frameRect(x, y, w, h, border === undefined ? 4 : border, c);
    }
  };
})();

// Handy math used all over the place.
ML.clamp = function (v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); };
ML.lerp = function (a, b, t) { return a + (b - a) * t; };
ML.rand = function (a, b) { return a + Math.random() * (b - a); };
