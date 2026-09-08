/*
  PALETTE — the single source of truth for every color in the game.

  Sixteen colors, no more. Sprites, text, backgrounds and particles all refer to
  colors by INDEX (0-15), never by hex. If you want to change the look of the
  whole game, change a hex string here and everything follows.

  Sprite strings use one character per pixel: '0'-'9' then 'a'-'f' are indexes
  0-15, and a SPACE means transparent.
*/
window.ML = window.ML || {};

ML.palette = {
  // index: 0        1          2          3          4
  //        ink      charcoal   gray       steel      cream
  colors: [
    '#12101c', // 0  INK        outlines, deepest shadow
    '#2c2740', // 1  CHARCOAL   grill iron, night shadow
    '#5a5470', // 2  GRAY       dark metal, asphalt
    '#a9aec2', // 3  STEEL      axe blade, chrome, highlights
    '#f2ead6', // 4  CREAM      whites, foam, most text
    '#63b3e8', // 5  SKY        late afternoon sky
    '#2f6ea8', // 6  SKY DEEP   sky shading, denim
    '#376b38', // 7  GRASS DARK shadowed lawn
    '#6fbf4a', // 8  GRASS      lit lawn
    '#4a2f1c', // 9  WOOD DARK  bark, hair, deep wood
    '#8a5a2b', // a  WOOD       logs, fences, handles
    '#c98c4a', // b  WOOD LIGHT sawdust, tan, lit wood
    '#f0b429', // c  AMBER      beer, sunlight, gold medal
    '#e8622a', // d  ORANGE     sunset, ball caps, fire
    '#e0a077', // e  FLESH      skin
    '#ff5ea8'  // f  ACCENT     UI highlight, "look here" pink
  ],

  // Handy names so code reads better than magic numbers.
  INK: 0, CHARCOAL: 1, GRAY: 2, STEEL: 3, CREAM: 4,
  SKY: 5, SKY_DEEP: 6, GRASS_DARK: 7, GRASS: 8,
  WOOD_DARK: 9, WOOD: 10, WOOD_LIGHT: 11,
  AMBER: 12, ORANGE: 13, FLESH: 14, ACCENT: 15,

  // hex for a palette index
  hex: function (i) {
    return ML.palette.colors[i & 15];
  },

  // '0'-'9','a'-'f' -> 0..15 ; anything else -> -1 (transparent)
  indexFromChar: function (ch) {
    if (ch >= '0' && ch <= '9') return ch.charCodeAt(0) - 48;
    if (ch >= 'a' && ch <= 'f') return ch.charCodeAt(0) - 87;
    if (ch >= 'A' && ch <= 'F') return ch.charCodeAt(0) - 55;
    return -1;
  }
};
