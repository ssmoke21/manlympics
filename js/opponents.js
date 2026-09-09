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
    Everything that decides how hard the field is sits in TUNING, below.
    BASE / PER_POINT ... raising either makes every opponent harder to beat.
                         BASE is the blunt one: it moves the whole field.
    DUKE_MIN / DUKE_MAX  his flat band, which has to move with BASE or he wins
                         by default once the others come down.
    NOISE_BASE ......... how random everyone is before composure is considered.
    WEIGHTS ............ which stats each event rewards. Each row must add up
                         to 1.0.
    The quirk numbers are in QUIRKS, one small function per opponent.

  HOW THESE NUMBERS WERE SET
    Not by feel. Each event has a headless harness that drives the real scene
    with a bot, and those harnesses print a skill curve - what a careless bot,
    a mid-table bot and a good bot actually score. Those three score profiles
    were then played through whole tournaments against this field while BASE
    was swept, and the values above are the ones where a mid-table player wins
    about half the time. Re-run the sweep if you change an event's scoring.
*/
window.ML = window.ML || {};

ML.opponents = (function () {
  /*
     The whole field's strength lives in this one object, so it can be tuned in
     one place - and measured, which is how the numbers below were arrived at
     rather than guessed. See the note under TUNING for what they were set from.
  */
  var TUNING = {
    BASE: 195,             // what a competitor with all-1 stats scores
    PER_POINT: 55,         // how much each point of weighted stat is worth
    NOISE_BASE: 40,        // spread before composure
    NOISE_PER_COMPOSURE: 12,

    // Duke's flat band. The brief fixes him at 600-780; that was written when
    // the rest of the field sat higher, and left alone he simply wins by
    // default once everyone else comes down. His RULE is "never fails and
    // never dominates", so the band moves with the field to keep meaning that.
    DUKE_MIN: 400,
    DUKE_MAX: 550
  };

  // Lets the calibration harness sweep these without rewriting the file.
  function setTuning(o) {
    for (var k in o) if (o.hasOwnProperty(k)) TUNING[k] = o[k];
  }

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
  /*
     The precision three. Grilling used to be in here, which made Hugo's +200
     land on FOUR of the eight events - and since the stat weights already pay
     him for precision, the bonus was stacking on top of an advantage he had
     anyway. He won better than four tournaments in five no matter how the rest
     of the field was tuned. The brief calls grilling divided attention and
     says outright that grilling and mowing are mixed, so it does not belong
     here. Arnold's matching -200 comes off the same list.
  */
  var PRECISION_EVENTS = { creampuffs: 1, parking: 1, pouring: 1 };
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
      return TUNING.DUKE_MIN + Math.random() * (TUNING.DUKE_MAX - TUNING.DUKE_MIN);
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

    var base = TUNING.BASE + TUNING.PER_POINT * weighted;
    var sd = TUNING.NOISE_BASE + (11 - o.composure) * TUNING.NOISE_PER_COMPOSURE;
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
    TUNING: TUNING,
    setTuning: setTuning,
    roster: ROSTER,
    weightsFor: weightsFor,
    byId: byId,
    generate: generate,
    generateAll: generateAll,
    gaussian: gaussian,
    WEIGHTS: WEIGHTS
  };
})();
