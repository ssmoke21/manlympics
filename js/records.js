/*
  ==========================================================================
  RECORDS - the top score for each event, and for a whole tournament
  ==========================================================================

  Everything is kept in localStorage, one key per thing, so a browser that
  refuses storage (a private window, a file:// URL with cookies off) just means
  no records rather than a broken game. Every read and write is wrapped.

  WHAT IS KEPT
    ml_best_<event>   the best raw score anyone has posted on that event
    ml_tour_points    the best medal-point total from a finished tournament
    ml_tour_place     where that total finished
    ml_tour_wins      how many tournaments have been won outright
    ml_tour_runs      how many have been finished

  Event records are set from BOTH modes. A good score is a good score, and it
  would be odd for a blinder posted in the tournament not to count. In a two
  player tournament that means either player can take the machine's record -
  which is the right way round for a scoreboard sitting in a living room.

  THE OVERALL NUMBER is the sum of the eight event bests, out of 8000. It is
  deliberately NOT an average: a nought on one event should be visible.
*/
window.ML = window.ML || {};

ML.records = (function () {
  var EVENT_PREFIX = 'ml_best_';
  var TOUR_POINTS = 'ml_tour_points';
  var TOUR_PLACE = 'ml_tour_place';
  var TOUR_WINS = 'ml_tour_wins';
  var TOUR_RUNS = 'ml_tour_runs';
  var MAX_PER_EVENT = 1000;

  function read(key) {
    try {
      var v = window.localStorage.getItem(key);
      if (v === null || v === undefined || v === '') return null;
      var n = parseInt(v, 10);
      return isNaN(n) ? null : n;
    } catch (e) { return null; }
  }

  function write(key, value) {
    try { window.localStorage.setItem(key, String(value)); return true; }
    catch (e) { return false; }
  }

  function remove(key) {
    try { window.localStorage.removeItem(key); } catch (e) { /* nothing to do */ }
  }

  function eventKeys() {
    var out = [];
    var list = (ML.ui && ML.ui.EVENT_LIST) || [];
    for (var i = 0; i < list.length; i++) out.push(list[i].key);
    return out;
  }

  // ------------------------------------------------------------- per event
  function bestFor(key) { return read(EVENT_PREFIX + key); }

  /*
     Offer a score. Hands back what the record is now and whether this beat it,
     so the results screens can say NEW BEST without asking twice.
  */
  function submit(key, score) {
    if (!key) return { value: null, isNew: false, previous: null };
    var n = Math.round(score || 0);
    if (n < 0) n = 0;
    if (n > MAX_PER_EVENT) n = MAX_PER_EVENT;
    var prev = bestFor(key);
    if (prev === null || n > prev) {
      write(EVENT_PREFIX + key, n);
      return { value: n, isNew: true, previous: prev };
    }
    return { value: prev, isNew: false, previous: prev };
  }

  // ------------------------------------------------------------ the whole day
  function totalOfBests() {
    var keys = eventKeys(), sum = 0, have = 0;
    for (var i = 0; i < keys.length; i++) {
      var b = bestFor(keys[i]);
      if (b !== null) { sum += b; have++; }
    }
    return { total: sum, of: keys.length * MAX_PER_EVENT, eventsSet: have, events: keys.length };
  }

  function bestTournament() {
    var pts = read(TOUR_POINTS);
    if (pts === null) return null;
    return { points: pts, place: read(TOUR_PLACE), wins: read(TOUR_WINS) || 0, runs: read(TOUR_RUNS) || 0 };
  }

  function submitTournament(points, place) {
    var runs = (read(TOUR_RUNS) || 0) + 1;
    write(TOUR_RUNS, runs);
    if (place === 1) write(TOUR_WINS, (read(TOUR_WINS) || 0) + 1);
    var prev = read(TOUR_POINTS);
    if (prev === null || points > prev) {
      write(TOUR_POINTS, points);
      write(TOUR_PLACE, place);
      return { points: points, place: place, isNew: true, previous: prev };
    }
    return { points: prev, place: read(TOUR_PLACE), isNew: false, previous: prev };
  }

  // Is there anything worth showing at all?
  function any() {
    if (read(TOUR_POINTS) !== null) return true;
    var keys = eventKeys();
    for (var i = 0; i < keys.length; i++) if (bestFor(keys[i]) !== null) return true;
    return false;
  }

  function wipe() {
    var keys = eventKeys();
    for (var i = 0; i < keys.length; i++) remove(EVENT_PREFIX + keys[i]);
    remove(TOUR_POINTS); remove(TOUR_PLACE); remove(TOUR_WINS); remove(TOUR_RUNS);
  }

  // Does storage actually work here? Used to tell the player why the board is
  // empty rather than letting them think their scores are being thrown away.
  function available() {
    try {
      window.localStorage.setItem('ml_probe', '1');
      window.localStorage.removeItem('ml_probe');
      return true;
    } catch (e) { return false; }
  }

  return {
    bestFor: bestFor,
    submit: submit,
    totalOfBests: totalOfBests,
    bestTournament: bestTournament,
    submitTournament: submitTournament,
    eventKeys: eventKeys,
    any: any,
    wipe: wipe,
    available: available,
    MAX_PER_EVENT: MAX_PER_EVENT
  };
})();
