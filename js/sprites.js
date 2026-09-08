/*
  SPRITES - every image in the game, defined as text and baked once at startup.

  A sprite is an array of equal-length strings. Each character is a palette
  index ('0'-'9', 'a'-'f') and a SPACE is transparent:

      ML.sprites.def.axe = [
        "  33  ",
        "  33  ",
        " 5555 ",
        "555555",
        " 5555 "
      ];

  Some sprites are typed out by hand (small props). The bigger ones - the 24x32
  characters, the logs, the chopping block - are ASSEMBLED by little helper
  functions below that draw rectangles and circles into a character grid and
  then return exactly that same array-of-strings format. Same data, fewer typos.

  At startup ML.sprites.init() bakes every definition into an offscreen canvas.
  After that, drawing is one drawImage call. Nothing is drawn pixel-by-pixel
  during gameplay.

  drawSprite(name, x, y, {flipX, tint, alpha})
*/
window.ML = window.ML || {};

ML.sprites = (function () {

  // ---------------------------------------------------------------- grid tools

  function grid(w, h) {
    var g = [];
    for (var y = 0; y < h; y++) {
      var row = [];
      for (var x = 0; x < w; x++) row.push(' ');
      g.push(row);
    }
    g.w = w; g.h = h;
    return g;
  }

  function px(g, x, y, c) {
    x = Math.round(x); y = Math.round(y);
    if (x < 0 || y < 0 || y >= g.length || x >= g[0].length) return;
    g[y][x] = c;
  }

  function rect(g, x, y, w, h, c) {
    for (var j = 0; j < h; j++) for (var i = 0; i < w; i++) px(g, x + i, y + j, c);
  }

  function ellipse(g, cx, cy, rx, ry, c) {
    for (var y = Math.floor(cy - ry); y <= cy + ry; y++) {
      for (var x = Math.floor(cx - rx); x <= cx + rx; x++) {
        var dx = (x - cx) / (rx + 0.0001), dy = (y - cy) / (ry + 0.0001);
        if (dx * dx + dy * dy <= 1.0) px(g, x, y, c);
      }
    }
  }

  // Thick line, used for arms and legs.
  function limb(g, x0, y0, x1, y1, w, c) {
    var steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
    if (steps === 0) steps = 1;
    for (var i = 0; i <= steps; i++) {
      var t = i / steps;
      rect(g, Math.round(x0 + (x1 - x0) * t), Math.round(y0 + (y1 - y0) * t), w, w, c);
    }
  }

  // Put a 1px ink border around everything solid. Instant strong silhouette.
  function outline(g) {
    var h = g.length, w = g[0].length, i, j;
    var marks = [];
    for (j = 0; j < h; j++) {
      for (i = 0; i < w; i++) {
        if (g[j][i] !== ' ') continue;
        var near =
          (j > 0 && g[j - 1][i] !== ' ' && g[j - 1][i] !== '0') ||
          (j < h - 1 && g[j + 1][i] !== ' ' && g[j + 1][i] !== '0') ||
          (i > 0 && g[j][i - 1] !== ' ' && g[j][i - 1] !== '0') ||
          (i < w - 1 && g[j][i + 1] !== ' ' && g[j][i + 1] !== '0');
        if (near) marks.push([i, j]);
      }
    }
    for (i = 0; i < marks.length; i++) g[marks[i][1]][marks[i][0]] = '0';
    return g;
  }

  function strings(g) {
    var out = [];
    for (var y = 0; y < g.length; y++) out.push(g[y].join(''));
    return out;
  }

  // ------------------------------------------------------------ figure builder
  /*
     Every competitor is a chunky 24x32 figure assembled from the same parts, so
     they all sit in the same world - but hat, build, hair and pose give each one
     a silhouette you can read from across the screen.

     look = { skin, hair, shirt, shirtAlt, pants, shoe, hat, hatColor, build,
              beard, mustache }
     pose = { arms: 'down'|'up'|'v'|'out'|'slump'|'fore', bob: 0|1, slouch: 0..3 }
  */
  function figure(look, pose) {
    pose = pose || {};
    var g = grid(24, 32);

    var skin = look.skin || 'e';
    var hair = look.hair || '9';
    var shirt = look.shirt || 'd';
    var shirtAlt = look.shirtAlt || shirt;
    var pants = look.pants || '6';
    var shoe = look.shoe || '1';
    var hat = look.hat || 'none';
    var hatC = look.hatColor || shirt;
    var build = look.build || 0;

    var bob = (pose.bob || 0) + (pose.slouch || 0);
    var headTop = 4 + bob;
    var hx = 7, hw = 10, hh = 9;

    // --- head
    rect(g, hx, headTop, hw, hh, skin);
    px(g, hx - 1, headTop + 4, skin);            // ears
    px(g, hx + hw, headTop + 4, skin);

    if (hat !== 'bald') {
      rect(g, hx, headTop, hw, 2, hair);
      px(g, hx, headTop + 2, hair);
      px(g, hx + hw - 1, headTop + 2, hair);
    } else {
      px(g, hx, headTop + 2, hair);
      px(g, hx + hw - 1, headTop + 2, hair);
      px(g, hx, headTop + 3, hair);
      px(g, hx + hw - 1, headTop + 3, hair);
    }

    // eyes
    rect(g, hx + 2, headTop + 4, 1, 2, '0');
    rect(g, hx + 6, headTop + 4, 1, 2, '0');
    if (look.brow) {
      rect(g, hx + 1, headTop + 3, 3, 1, hair);
      rect(g, hx + 6, headTop + 3, 3, 1, hair);
    }
    if (look.mustache) rect(g, hx + 2, headTop + 6, 6, 1, hair);
    if (look.beard) {
      rect(g, hx, headTop + 6, hw, 3, hair);
      rect(g, hx + 3, headTop + 7, 4, 1, '1');
    }

    // --- hat
    if (hat === 'cap') {
      rect(g, hx, headTop - 3, hw, 5, hatC);
      rect(g, hx - 2, headTop + 2, hw + 4, 1, hatC);
      rect(g, hx + 3, headTop - 4, 4, 1, hatC);
    } else if (hat === 'beanie') {
      rect(g, hx, headTop - 4, hw, 6, hatC);
      rect(g, hx, headTop + 2, hw, 1, shirtAlt);
      rect(g, hx + 4, headTop - 6, 2, 2, '4');
    } else if (hat === 'hardhat') {
      ellipse(g, hx + hw / 2 - 0.5, headTop - 1, 5, 4, hatC);
      rect(g, hx - 3, headTop + 2, hw + 6, 1, hatC);
    } else if (hat === 'visor') {
      rect(g, hx, headTop, hw, 2, hatC);
      rect(g, hx - 3, headTop + 2, hw + 6, 1, hatC);
    }

    // --- torso
    var tw = 10 + build * 2;
    var tx = 12 - Math.floor(tw / 2);
    var torsoTop = headTop + hh + 2;
    rect(g, 10, headTop + hh, 4, 2, skin);                 // neck
    rect(g, tx, torsoTop, tw, 8, shirt);
    rect(g, tx, torsoTop + 3, tw, 2, shirtAlt);            // chest stripe
    if (build >= 1) rect(g, tx - 1, torsoTop + 4, tw + 2, 4, shirt); // gut

    // --- arms
    var shoulderY = torsoTop + 1;
    var lx = tx - 3, rx2 = tx + tw;
    var arms = pose.arms || 'down';
    if (arms === 'down') {
      limb(g, lx, shoulderY, lx - 1, shoulderY + 7, 3, skin);
      limb(g, rx2, shoulderY, rx2 + 1, shoulderY + 7, 3, skin);
      rect(g, lx - 1, shoulderY, 4, 3, shirt);
      rect(g, rx2, shoulderY, 4, 3, shirt);
    } else if (arms === 'up') {
      limb(g, lx + 1, shoulderY, 8, headTop - 5, 3, skin);
      limb(g, rx2 - 1, shoulderY, 13, headTop - 5, 3, skin);
      rect(g, lx, shoulderY, 4, 3, shirt);
      rect(g, rx2 - 1, shoulderY, 4, 3, shirt);
    } else if (arms === 'v') {
      limb(g, lx + 1, shoulderY, lx - 4, headTop - 2, 3, skin);
      limb(g, rx2 - 1, shoulderY, rx2 + 4, headTop - 2, 3, skin);
      rect(g, lx, shoulderY, 4, 3, shirt);
      rect(g, rx2 - 1, shoulderY, 4, 3, shirt);
    } else if (arms === 'out') {
      limb(g, lx + 1, shoulderY, lx - 5, shoulderY + 2, 3, skin);
      limb(g, rx2 - 1, shoulderY, rx2 + 5, shoulderY + 2, 3, skin);
      rect(g, lx, shoulderY, 4, 3, shirt);
      rect(g, rx2 - 1, shoulderY, 4, 3, shirt);
    } else if (arms === 'slump') {
      limb(g, lx, shoulderY + 1, lx - 1, shoulderY + 9, 3, skin);
      limb(g, rx2, shoulderY + 1, rx2 + 1, shoulderY + 9, 3, skin);
      rect(g, lx - 1, shoulderY + 1, 4, 3, shirt);
      rect(g, rx2, shoulderY + 1, 4, 3, shirt);
    } else if (arms === 'fore') {
      limb(g, lx + 1, shoulderY, 9, torsoTop + 9, 3, skin);
      limb(g, rx2 - 1, shoulderY, 12, torsoTop + 9, 3, skin);
      rect(g, lx, shoulderY, 4, 3, shirt);
      rect(g, rx2 - 1, shoulderY, 4, 3, shirt);
    }

    // --- legs, socks, shoes
    var legTop = torsoTop + 8;
    rect(g, tx + 1, legTop, tw - 2, 3, pants);
    var llx = 7, rlx = 13;
    rect(g, llx, legTop + 3, 4, 30 - (legTop + 3), skin);
    rect(g, rlx, legTop + 3, 4, 30 - (legTop + 3), skin);
    rect(g, llx, 28, 4, 2, '4');
    rect(g, rlx, 28, 4, 2, '4');
    rect(g, llx - 1, 30, 5, 2, shoe);
    rect(g, rlx, 30, 5, 2, shoe);

    outline(g);
    return strings(g);
  }

  // -------------------------------------------------------------- prop builders

  // The log is deliberately PALE, because it sits on a DARK block. Two brown
  // things of the same brown just read as one crate.
  function makeLog(w, h, cracked) {
    var g = grid(w, h);
    for (var y = 0; y < h; y++) {
      var inset = (y === 0 || y === h - 1) ? 2 : (y === 1 || y === h - 2) ? 1 : 0;
      rect(g, inset, y, w - inset * 2, 1, 'b');
    }
    // bark shading top and bottom, so it reads as a cylinder
    rect(g, 3, 1, w - 6, 1, '4');
    rect(g, 4, h - 2, w - 8, 1, 'a');
    rect(g, 6, h - 3, w - 12, 1, 'a');
    // grain streaks
    for (var x = 8; x < w - 8; x += 9) rect(g, x, 4, 5, 1, 'a');
    for (x = 12; x < w - 8; x += 11) rect(g, x, h - 5, 4, 1, 'a');
    // end grain rings, both ends
    rect(g, 0, 2, 5, h - 4, 'a');
    rect(g, w - 5, 2, 5, h - 4, 'a');
    ellipse(g, 2, h / 2 - 0.5, 2, h / 2 - 2, '9');
    ellipse(g, w - 3, h / 2 - 0.5, 2, h / 2 - 2, '9');
    px(g, 2, h / 2 - 0.5, 'b'); px(g, w - 3, h / 2 - 0.5, 'b');
    if (cracked) {
      var cx = Math.floor(w / 2);
      for (var j = 0; j < h; j++) px(g, cx + (j % 3 === 0 ? 1 : 0), j, '9');
      for (j = 1; j < h - 1; j += 2) px(g, cx - 1, j, '0');
    }
    outline(g);
    return strings(g);
  }

  function makeLogHalf(w, h, flip) {
    var g = grid(w, h);
    for (var y = 0; y < h; y++) {
      var inset = (y === 0) ? 2 : (y === 1) ? 1 : 0;
      rect(g, inset, y, w - inset * 2, 1, 'b');
    }
    // splintered face along the bottom edge
    for (var x = 0; x < w; x++) {
      if ((x + (flip ? 1 : 0)) % 3 === 0) px(g, x, h - 1, ' ');
      else px(g, x, h - 1, '9');
    }
    rect(g, 0, 1, 4, h - 2, 'a');
    rect(g, w - 4, 1, 4, h - 2, 'a');
    rect(g, 5, 1, w - 10, 1, '4');
    outline(g);
    return strings(g);
  }

  // Dark stump, so the pale log on top of it pops.
  function makeBlock(w, h) {
    var g = grid(w, h);
    rect(g, 2, 3, w - 4, h - 3, '9');       // body, deep brown
    rect(g, 0, 0, w, 4, 'a');               // lit top face - MID brown, never
    ellipse(g, w / 2 - 0.5, 1.5, w / 2 - 2, 2, 'a');   // the same tone as the log
    ellipse(g, w / 2 - 0.5, 1.5, 5, 1, '9');           // rings in the cut face
    for (var x = 4; x < w - 4; x += 5) rect(g, x, 5, 1, h - 7, '1');   // bark grooves
    rect(g, 2, h - 2, w - 4, 2, '1');
    outline(g);
    return strings(g);
  }

  function makeCloud(w, h) {
    var g = grid(w, h);
    ellipse(g, w * 0.35, h * 0.6, w * 0.3, h * 0.4, '4');
    ellipse(g, w * 0.6, h * 0.45, w * 0.28, h * 0.45, '4');
    ellipse(g, w * 0.8, h * 0.65, w * 0.2, h * 0.32, '4');
    return strings(g);
  }

  function makeBush(w, h) {
    var g = grid(w, h);
    ellipse(g, w * 0.3, h * 0.65, w * 0.3, h * 0.35, '7');
    ellipse(g, w * 0.62, h * 0.5, w * 0.33, h * 0.45, '7');
    ellipse(g, w * 0.5, h * 0.42, w * 0.25, h * 0.3, '8');
    ellipse(g, w * 0.75, h * 0.6, w * 0.16, h * 0.2, '8');
    outline(g);
    return strings(g);
  }

  // Picket fence. The gaps matter - solid planks just read as a brown stripe.
  function makeFence(w, h) {
    var g = grid(w, h);
    for (var x = 0; x < w; x += 8) {          // 8 divides 64 evenly, so tiles seamlessly
      rect(g, x + 1, 2, 5, h - 2, 'a');
      rect(g, x + 1, 2, 1, h - 2, 'b');
      rect(g, x + 5, 2, 1, h - 2, '9');
      rect(g, x + 2, 1, 3, 1, 'a');           // pointed tops
      px(g, x + 3, 0, 'a');
    }
    rect(g, 0, 6, w, 1, '9');                 // rails
    rect(g, 0, h - 6, w, 1, '9');
    return strings(g);
  }

  function makeSun(r) {
    var g = grid(r * 2 + 2, r * 2 + 2);
    ellipse(g, r, r, r, r, 'c');
    ellipse(g, r - 1, r - 1, r - 2, r - 2, '4');
    return strings(g);
  }

  function makeTuft() {
    var g = grid(7, 4);
    rect(g, 3, 0, 1, 4, '7');
    rect(g, 1, 1, 1, 3, '7');
    rect(g, 5, 1, 1, 3, '7');
    px(g, 0, 2, '8'); px(g, 6, 2, '8'); px(g, 2, 0, '8');
    return strings(g);
  }

  function makeMedal(colorChar) {
    var g = grid(9, 12);
    rect(g, 2, 0, 2, 5, 'd');
    rect(g, 5, 0, 2, 5, 'd');
    ellipse(g, 4, 8, 4, 4, colorChar);
    ellipse(g, 4, 8, 2, 2, '4');
    outline(g);
    return strings(g);
  }

  // ---------------------------------------------------------------- definitions

  var def = {};

  // --- hand-typed props (the format, straight from the spec) ---
  def.axe_up = [
    '   333333   ',
    '  33333333  ',
    ' 3333333333 ',
    ' 3333333333 ',
    ' 33333aa333 ',
    '  333aaaa3  ',
    '    aaaa    ',
    '     aa     ',
    '     aa     ',
    '     aa     ',
    '     aa     ',
    '     aa     ',
    '     aa     ',
    '     aa     ',
    '     99     ',
    '     99     '
  ];

  def.axe_mid = [
    '            333 ',
    '           33333',
    '          333333',
    '          333333',
    '        aa 3333 ',
    '       aa   33  ',
    '      aa        ',
    '     aa         ',
    '    aa          ',
    '   aa           ',
    '  aa            ',
    ' aa             ',
    ' 99             ',
    '                '
  ];

  // Head down, handle straight up: the axe buried in the log.
  def.axe_hit = [
    '    aa    ',
    '    aa    ',
    '    aa    ',
    '    aa    ',
    '    aa    ',
    '  333333  ',
    ' 33333333 ',
    ' 33333333 ',
    ' 33333333 ',
    '  333333  ',
    '   3333   '
  ];

  def.axe_down = [
    '                  ',
    '   3333           ',
    '  333333          ',
    ' 33333333aaaaaaa9 ',
    ' 33333333aaaaaaa9 ',
    '  333333          ',
    '   3333           ',
    '                  '
  ];

  def.chip = [
    'ba',
    'a9'
  ];

  // --- assembled props ---
  def.log_whole = makeLog(44, 14, false);
  def.log_cracked = makeLog(44, 14, true);
  def.log_half_l = makeLogHalf(44, 7, false);
  def.log_half_r = makeLogHalf(44, 7, true);
  def.block = makeBlock(30, 20);
  def.cloud_a = makeCloud(26, 10);
  def.cloud_b = makeCloud(34, 12);
  def.bush = makeBush(28, 16);
  def.fence = makeFence(64, 20);
  def.sun = makeSun(9);
  def.tuft = makeTuft();
  def.medal_gold = makeMedal('c');
  def.medal_silver = makeMedal('3');
  def.medal_bronze = makeMedal('a');

  // --- the player: a dad in a ball cap ---
  var PLAYER_LOOK = {
    skin: 'e', hair: '9', shirt: '4', shirtAlt: 'd', pants: '6',
    shoe: '1', hat: 'cap', hatColor: 'd', build: 0,
    mustache: true, brow: true
  };
  ML_addFigure('player', PLAYER_LOOK);

  function ML_addFigure(name, look) {
    def[name + '_idle0'] = figure(look, { arms: 'down', bob: 0 });
    def[name + '_idle1'] = figure(look, { arms: 'down', bob: 1 });
    def[name + '_up'] = figure(look, { arms: 'up', bob: 0 });
    def[name + '_swing'] = figure(look, { arms: 'fore', bob: 1 });
    def[name + '_win'] = figure(look, { arms: 'v', bob: 0 });
    def[name + '_lose'] = figure(look, { arms: 'slump', bob: 0, slouch: 2 });
    def[name + '_strain'] = figure(look, { arms: 'out', bob: 1 });
  }

  // ------------------------------------------------------------------- baking

  var cache = {};   // name -> canvas
  var tinted = {};  // name + '#' + colorIndex -> canvas
  var sizes = {};

  function bakeOne(rows) {
    var w = 0, y, x;
    for (y = 0; y < rows.length; y++) w = Math.max(w, rows[y].length);
    var h = rows.length;
    var cv = document.createElement('canvas');
    cv.width = Math.max(1, w); cv.height = Math.max(1, h);
    var c = cv.getContext('2d');
    c.imageSmoothingEnabled = false;
    for (y = 0; y < h; y++) {
      var row = rows[y];
      for (x = 0; x < row.length; x++) {
        var idx = ML.palette.indexFromChar(row.charAt(x));
        if (idx < 0) continue;
        c.fillStyle = ML.palette.hex(idx);
        c.fillRect(x, y, 1, 1);
      }
    }
    return cv;
  }

  function tintOf(name, colorIndex) {
    var key = name + '#' + colorIndex;
    if (tinted[key]) return tinted[key];
    var src = cache[name];
    var cv = document.createElement('canvas');
    cv.width = src.width; cv.height = src.height;
    var c = cv.getContext('2d');
    c.imageSmoothingEnabled = false;
    c.drawImage(src, 0, 0);
    c.globalCompositeOperation = 'source-in';
    c.fillStyle = ML.palette.hex(colorIndex);
    c.fillRect(0, 0, cv.width, cv.height);
    tinted[key] = cv;
    return cv;
  }

  return {
    def: def,
    figure: figure,
    addFigure: ML_addFigure,
    grid: grid, rect: rect, ellipse: ellipse, limb: limb, outline: outline, strings: strings,

    init: function () {
      for (var name in def) {
        if (!def.hasOwnProperty(name)) continue;
        cache[name] = bakeOne(def[name]);
        sizes[name] = { w: cache[name].width, h: cache[name].height };
      }
    },

    // Register + bake a sprite after startup (used by later phases).
    add: function (name, rows) {
      def[name] = rows;
      cache[name] = bakeOne(rows);
      sizes[name] = { w: cache[name].width, h: cache[name].height };
    },

    size: function (name) { return sizes[name] || { w: 0, h: 0 }; },
    has: function (name) { return !!cache[name]; },

    draw: function (name, x, y, opts, ctx) {
      ctx = ctx || ML.engine.ctx;
      var img = cache[name];
      if (!img) return;
      opts = opts || {};
      if (opts.tint !== undefined && opts.tint !== null) img = tintOf(name, opts.tint);
      x = Math.round(x); y = Math.round(y);
      var oldAlpha = ctx.globalAlpha;
      if (opts.alpha !== undefined) ctx.globalAlpha = opts.alpha;
      if (opts.flipX) {
        ctx.save();
        ctx.translate(x + img.width, y);
        ctx.scale(-1, 1);
        ctx.drawImage(img, 0, 0);
        ctx.restore();
      } else {
        ctx.drawImage(img, x, y);
      }
      ctx.globalAlpha = oldAlpha;
    }
  };
})();

// Shorthand used everywhere: ML.drawSprite(name, x, y, opts)
ML.drawSprite = function (name, x, y, opts, ctx) { ML.sprites.draw(name, x, y, opts, ctx); };
