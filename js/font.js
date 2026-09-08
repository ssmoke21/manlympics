/*
  FONT - a 5x7 bitmap typeface, drawn from code. No web fonts, no ctx.fillText.

  Each glyph is 7 strings of 5 characters. '#' is a lit pixel, '.' is empty.
  Uppercase only; lowercase input is upper-cased automatically.

  On first use the whole alphabet is baked into a one-row atlas canvas per
  palette color (16 possible, built on demand). Drawing text is then just a
  handful of drawImage calls - no per-pixel work during gameplay.
*/
window.ML = window.ML || {};

ML.font = (function () {
  var W = 5, H = 7, GAP = 1;

  var G = {
    'A': ['.###.', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
    'B': ['####.', '#...#', '#...#', '####.', '#...#', '#...#', '####.'],
    'C': ['.###.', '#...#', '#....', '#....', '#....', '#...#', '.###.'],
    'D': ['####.', '#...#', '#...#', '#...#', '#...#', '#...#', '####.'],
    'E': ['#####', '#....', '#....', '####.', '#....', '#....', '#####'],
    'F': ['#####', '#....', '#....', '####.', '#....', '#....', '#....'],
    'G': ['.###.', '#...#', '#....', '#.###', '#...#', '#...#', '.###.'],
    'H': ['#...#', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
    'I': ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '#####'],
    'J': ['..###', '...#.', '...#.', '...#.', '...#.', '#..#.', '.##..'],
    'K': ['#...#', '#..#.', '#.#..', '##...', '#.#..', '#..#.', '#...#'],
    'L': ['#....', '#....', '#....', '#....', '#....', '#....', '#####'],
    'M': ['#...#', '##.##', '#.#.#', '#.#.#', '#...#', '#...#', '#...#'],
    'N': ['#...#', '##..#', '##..#', '#.#.#', '#..##', '#..##', '#...#'],
    'O': ['.###.', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
    'P': ['####.', '#...#', '#...#', '####.', '#....', '#....', '#....'],
    'Q': ['.###.', '#...#', '#...#', '#...#', '#.#.#', '#..#.', '.##.#'],
    'R': ['####.', '#...#', '#...#', '####.', '#.#..', '#..#.', '#...#'],
    'S': ['.####', '#....', '#....', '.###.', '....#', '....#', '####.'],
    'T': ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '..#..'],
    'U': ['#...#', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
    'V': ['#...#', '#...#', '#...#', '#...#', '#...#', '.#.#.', '..#..'],
    'W': ['#...#', '#...#', '#...#', '#.#.#', '#.#.#', '##.##', '#...#'],
    'X': ['#...#', '#...#', '.#.#.', '..#..', '.#.#.', '#...#', '#...#'],
    'Y': ['#...#', '#...#', '.#.#.', '..#..', '..#..', '..#..', '..#..'],
    'Z': ['#####', '....#', '...#.', '..#..', '.#...', '#....', '#####'],

    '0': ['.###.', '#...#', '#..##', '#.#.#', '##..#', '#...#', '.###.'],
    '1': ['..#..', '.##..', '..#..', '..#..', '..#..', '..#..', '.###.'],
    '2': ['.###.', '#...#', '....#', '...#.', '..#..', '.#...', '#####'],
    '3': ['####.', '....#', '....#', '.###.', '....#', '....#', '####.'],
    '4': ['#..#.', '#..#.', '#..#.', '#####', '...#.', '...#.', '...#.'],
    '5': ['#####', '#....', '####.', '....#', '....#', '#...#', '.###.'],
    '6': ['.###.', '#...#', '#....', '####.', '#...#', '#...#', '.###.'],
    '7': ['#####', '....#', '...#.', '..#..', '.#...', '.#...', '.#...'],
    '8': ['.###.', '#...#', '#...#', '.###.', '#...#', '#...#', '.###.'],
    '9': ['.###.', '#...#', '#...#', '.####', '....#', '#...#', '.###.'],

    '.': ['.....', '.....', '.....', '.....', '.....', '.##..', '.##..'],
    ',': ['.....', '.....', '.....', '.....', '.##..', '.##..', '.#...'],
    '!': ['..#..', '..#..', '..#..', '..#..', '..#..', '.....', '..#..'],
    '?': ['.###.', '#...#', '....#', '..##.', '..#..', '.....', '..#..'],
    "'": ['..#..', '..#..', '.....', '.....', '.....', '.....', '.....'],
    ':': ['.....', '.##..', '.##..', '.....', '.##..', '.##..', '.....'],
    '-': ['.....', '.....', '.....', '#####', '.....', '.....', '.....'],
    '%': ['##..#', '##.#.', '..#..', '.#...', '#..##', '.#.##', '#....'],
    '+': ['.....', '..#..', '..#..', '#####', '..#..', '..#..', '.....'],
    '(': ['...#.', '..#..', '.#...', '.#...', '.#...', '..#..', '...#.'],
    ')': ['.#...', '..#..', '...#.', '...#.', '...#.', '..#..', '.#...'],
    '/': ['....#', '....#', '...#.', '..#..', '.#...', '#....', '#....'],
    '*': ['.....', '#.#.#', '.###.', '#####', '.###.', '#.#.#', '.....'],
    '=': ['.....', '.....', '#####', '.....', '#####', '.....', '.....'],
    '<': ['...#.', '..#..', '.#...', '#....', '.#...', '..#..', '...#.'],
    '>': ['.#...', '..#..', '...#.', '....#', '...#.', '..#..', '.#...']
  };

  var order = [];      // atlas column -> char
  var slot = {};       // char -> atlas column
  var atlas = {};      // palette index -> baked canvas
  var ready = false;

  function buildAtlas(colorIndex) {
    var cv = document.createElement('canvas');
    cv.width = order.length * W;
    cv.height = H;
    var c = cv.getContext('2d');
    c.imageSmoothingEnabled = false;
    c.fillStyle = ML.palette.hex(colorIndex);
    for (var i = 0; i < order.length; i++) {
      var rows = G[order[i]];
      for (var y = 0; y < H; y++) {
        var row = rows[y];
        for (var x = 0; x < W; x++) {
          if (row.charAt(x) === '#') c.fillRect(i * W + x, y, 1, 1);
        }
      }
    }
    atlas[colorIndex] = cv;
    return cv;
  }

  function atlasFor(colorIndex) {
    return atlas[colorIndex] || buildAtlas(colorIndex);
  }

  return {
    W: W, H: H, GAP: GAP,
    glyphs: G,

    init: function () {
      if (ready) return;
      order = Object.keys(G);
      for (var i = 0; i < order.length; i++) slot[order[i]] = i;
      ready = true;
    },

    // Width in pixels of a string once drawn (includes inter-letter gaps).
    width: function (str) {
      str = String(str);
      if (!str.length) return 0;
      return str.length * (W + GAP) - GAP;
    },

    drawText: function (str, x, y, colorIndex, ctx) {
      ctx = ctx || ML.engine.ctx;
      if (colorIndex === undefined || colorIndex === null) colorIndex = ML.palette.CREAM;
      var a = atlasFor(colorIndex);
      str = String(str).toUpperCase();
      x = Math.round(x); y = Math.round(y);
      for (var i = 0; i < str.length; i++) {
        var ch = str.charAt(i);
        if (ch === ' ') continue;
        var s = slot[ch];
        if (s === undefined) continue;
        ctx.drawImage(a, s * W, 0, W, H, x + i * (W + GAP), y, W, H);
      }
    },

    drawTextCentered: function (str, cx, y, colorIndex, ctx) {
      ML.font.drawText(str, Math.round(cx - ML.font.width(str) / 2), y, colorIndex, ctx);
    },

    // Announcer flourish: every letter rides a sine wave.
    drawTextWavy: function (str, x, y, colorIndex, time, amp, freq, ctx) {
      ctx = ctx || ML.engine.ctx;
      amp = (amp === undefined) ? 2 : amp;
      freq = (freq === undefined) ? 0.6 : freq;
      var a = atlasFor(colorIndex === undefined ? ML.palette.CREAM : colorIndex);
      str = String(str).toUpperCase();
      x = Math.round(x);
      for (var i = 0; i < str.length; i++) {
        var ch = str.charAt(i);
        if (ch === ' ') continue;
        var s = slot[ch];
        if (s === undefined) continue;
        var dy = Math.round(Math.sin(time * 6 + i * freq) * amp);
        ctx.drawImage(a, s * W, 0, W, H, x + i * (W + GAP), Math.round(y) + dy, W, H);
      }
    },

    drawTextWavyCentered: function (str, cx, y, colorIndex, time, amp, freq, ctx) {
      ML.font.drawTextWavy(str, Math.round(cx - ML.font.width(str) / 2), y, colorIndex, time, amp, freq, ctx);
    },

    // Ink copy one pixel down-right first, so text stays readable on busy art.
    drawTextShadow: function (str, x, y, colorIndex, ctx) {
      ML.font.drawText(str, x + 1, y + 1, ML.palette.INK, ctx);
      ML.font.drawText(str, x, y, colorIndex, ctx);
    },

    drawTextShadowCentered: function (str, cx, y, colorIndex, ctx) {
      ML.font.drawTextShadow(str, Math.round(cx - ML.font.width(str) / 2), y, colorIndex, ctx);
    }
  };
})();
