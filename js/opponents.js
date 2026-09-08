/*
  OPPONENTS - the six rivals, and the maths that produces their scores.

  IMPORTANT: none of these characters actually play the minigames. That would be
  a huge amount of work for very little payoff. Instead each one has four stats,
  every event says which stats it cares about, and a score is rolled from that:

      weighted = the event's stat weights applied to this opponent's stats
      base     = 300 + 55 * weighted
      noise    = gaussian(0, 40 + (11 - composure) * 12)
      score    = clamp(base + noise, 0, 1000)
      then their personal quirk is applied on top

  So a composed opponent (Duke Silver) lands near his average every time, and a
  chaotic one (The Hulk) sprays all over the place.

  WHERE THE DIFFICULTY KNOBS ARE
    BASE / PER_POINT ... the 300 and the 55. Raising either makes every
                         opponent harder to beat across the board.
    NOISE_BASE ......... how random everyone is before composure is considered.
    WEIGHTS ............ which stats each event rewards. Each row must add up
                         to 1.0.
    The quirk numbers are in QUIRKS, one small function per opponent.
*/
window.ML = window.ML || {};

ML.opponents = (function () {
  var BASE = 300;          // what a competitor with all-1 stats scores
  var PER_POINT = 55;      // how much each point of weighted stat is worth
  var NOISE_BASE = 40;     // spread before composure
  var NOISE_PER_COMPOSURE = 12;

  // ---------------------------------------------------------------- the roster
  var ROSTER = [
    {
      id: 'arnold', name: 'ARNOLD',
      power: 10, precision: 3, composure: 8, chaos: 2,
      blurb: 'ENORMOUS. NOT SUBTLE.',
      look: {
        skin: 'e', hair: '9', shirt: 'd', shirtAlt: 'c', pants: '1',
        shoe: '1', hat: 'none', build: 2, brow: true
      }
    },
    {
      id: 'hugo', name: 'HUGO STIGLITZ',
      power: 6, precision: 10, composure: 3, chaos: 7,
      blurb: 'SURGICAL, UNTIL HE IS NOT.',
      look: {
        skin: 'e', hair: '9', shirt: '7', shirtAlt: '4', pants: '1',
        shoe: '0', hat: 'beanie', hatColor: '6', build: -1, beard: true
      }
    },
    {
      id: 'hulk', name: 'THE HULK',
      power: 10, precision: 1, composure: 2, chaos: 10,
      blurb: 'ALL GAS. NO STEERING.',
      look: {
        skin: '8', hair: '7', shirt: '2', shirtAlt: '1', pants: '6',
        shoe: '0', hat: 'none', build: 2, brow: true
      }
    },
    {
      id: 'stalin', name: 'STALIN',
      power: 5, precision: 6, composure: 9, chaos: 8,
      blurb: 'KEEPS HIS OWN RECORDS.',
      look: {
        skin: 'e', hair: '1', shirt: '2', shirtAlt: '3', pants: '1',
        shoe: '0', hat: 'visor', hatColor: '2', build: 0,
        mustache: true, brow: true
      }
    },
    {
      id: 'butkus', name: 'DICK BUTKUS',
      power: 9, precision: 4, composure: 7, chaos: 5,
      blurb: 'DOES NOT SLOW DOWN. EVER.',
      look: {
        skin: 'e', hair: '9', shirt: '4', shirtAlt: '6', pants: '4',
        shoe: '1', hat: 'hardhat', hatColor: '6', build: 1, brow: true
      }
    },
    {
      id: 'duke', name: 'DUKE SILVER',
      power: 6, precision: 8, composure: 10, chaos: 1,
      blurb: 'SMOOTH. RELENTLESSLY SMOOTH.',
      look: {
        skin: 'e', hair: '9', shirt: '3', shirtAlt: '4', pants: '1',
        shoe: '1', hat: 'none', build: 0, mustache: true
      }
    }
  ];

  // --------------------------------------------------------- event stat weights
  // Each row must add up to 1.0.
  var WEIGHTS = {
    pouring:    { power: 0.35, precision: 0.45, composure: 0.15, chaos: 0.05 },
    grilling:   { power: 0.15, precision: 0.35, composure: 0.40, chaos: 0.10 },
    chopping:   { power: 0.55, precision: 0.30, composure: 0.10, chaos: 0.05 },
    mowing:     { power: 0.30, precision: 0.30, composure: 0.30, chaos: 0.10 },
    jaropening: { power: 0.45, precision: 0.15, composure: 0.35, chaos: 0.05 },
    parking:    { power: 0.05, precision: 0.45, composure: 0.45, chaos: 0.05 },
    creampuffs: { power: 0.05, precision: 0.70, composure: 0.20, chaos: 0.05 },
    groceries:  { power: 0.50, precision: 0.15, composure: 0.25, chaos: 0.10 }
  };
  var DEFAULT_WEIGHT = { power: 0.25, precision: 0.25, composure: 0.25, chaos: 0.25 };

  // Which events count as what, for the quirks below.
  var POWER_EVENTS = { chopping: 1, groceries: 1, jaropening: 1 };
  var PRECISION_EVENTS = { creampuffs: 1, parking: 1, pouring: 1, grilling: 1 };
  var DELICATE_EVENTS = { pouring: 1, creampuffs: 1, parking: 1 };
  var CAREFUL_EVENTS = { pouring: 1, creampuffs: 1, parking: 1, grilling: 1 };

  // ------------------------------------------------------------------- quirks
  /*
     Each takes the rolled score and hands back a new one, plus any flags the
     results screen should dramatise (a Hulk smash, a Hugo choke).
  */
  var QUIRKS = {
    arnold: function (score, key, round, flags) {
      if (POWER_EVENTS[key]) score += 150;
      if (PRECISION_EVENTS[key]) score -= 200;
      // "never fails to open a jar"
      if (key === 'jaropening') { score = Math.max(score, 720); flags.unstoppable = true; }
      return score;
    },
    hugo: function (score, key, round, flags) {
      if (PRECISION_EVENTS[key]) score += 200;
      // 25% chance to choke on any event after the fourth
      if (round >= 4 && Math.random() < 0.25) { score *= 0.5; flags.choke = true; }
      return score;
    },
    hulk: function (score, key, round, flags) {
      // 35% chance of total catastrophe on anything delicate
      if (DELICATE_EVENTS[key] && Math.random() < 0.35) { flags.catastrophe = true; return 0; }
      return score;
    },
    stalin: function (score) {
      // His quirk is not in the maths - it happens on the scoreboard. See
      // tournament.js. Never explain it anywhere in the game.
      return score;
    },
    butkus: function (score, key, round, flags) {
      if (key === 'mowing' || key === 'groceries') score += 180;
      if (CAREFUL_EVENTS[key]) score -= 150;
      return score;
    },
    duke: function (score, key, round, flags) {
      // never fails and never dominates
      flags.steady = true;
      return 600 + Math.random() * 180;
    }
  };

  // ------------------------------------------------------------------- maths
  var spare = null;
  function gaussian(mean, sd) {
    if (spare !== null) { var v = spare; spare = null; return mean + v * sd; }
    var u, w, s2;
    do {
      u = Math.random() * 2 - 1;
      w = Math.random() * 2 - 1;
      s2 = u * u + w * w;
    } while (s2 >= 1 || s2 === 0);
    var m = Math.sqrt(-2 * Math.log(s2) / s2);
    spare = w * m;
    return mean + u * m * sd;
  }

  function weightsFor(key) { return WEIGHTS[key] || DEFAULT_WEIGHT; }

  function byId(id) {
    for (var i = 0; i < ROSTER.length; i++) if (ROSTER[i].id === id) return ROSTER[i];
    return null;
  }

  /*
     Roll one opponent's score for one event.
     `round` is zero-based, so round 4 is the fifth event (Hugo's choke rule).
  */
  function generate(o, key, round) {
    var w = weightsFor(key);
    var weighted = o.power * w.power + o.precision * w.precision
      + o.composure * w.composure + o.chaos * w.chaos;

    var base = BASE + PER_POINT * weighted;
    var sd = NOISE_BASE + (11 - o.composure) * NOISE_PER_COMPOSURE;
    var score = base + gaussian(0, sd);

    var flags = {};
    var q = QUIRKS[o.id];
    if (q) score = q(score, key, round, flags);

    return { id: o.id, name: o.name, score: Math.round(ML.clamp(score, 0, 1000)), flags: flags };
  }

  function generateAll(key, round) {
    var out = [];
    for (var i = 0; i < ROSTER.length; i++) out.push(generate(ROSTER[i], key, round));
    return out;
  }

  // Register a 24x32 figure for each of them (idle x2, victory, defeat, etc).
  // These only fill in the sprite table; ML.sprites.init() bakes them at boot.
  for (var i = 0; i < ROSTER.length; i++) {
    ML.sprites.addFigure(ROSTER[i].id, ROSTER[i].look);
  }

  return {
    roster: ROSTER,
    weightsFor: weightsFor,
    byId: byId,
    generate: generate,
    generateAll: generateAll,
    gaussian: gaussian,
    WEIGHTS: WEIGHTS
  };
})();
