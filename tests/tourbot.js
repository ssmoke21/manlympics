/*
  Drives the REAL tournament flow in Node: the real ui.js, records.js,
  cutscene.js, opponents.js and tournament.js. Only rendering and audio are
  stubbed out.

  The eight events are replaced with stubs that hand back a scripted score,
  because what is under test here is the frame around them, not the events -
  each event has its own harness for that.

  Everything the bot knows, it reads off the tables and gauges the game draws.

  Run:  node tests/tour.js .
*/
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = process.argv[2] || path.join(__dirname, '..');
const load = f => vm.runInThisContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), { filename: f });

global.window = global;
global.document = {
  createElement: () => ({
    getContext: () => new Proxy({}, { get: () => () => {}, set: () => true }),
    width: 0, height: 0
  })
};
const __store = new Map();
global.localStorage = {
  getItem: k => (__store.has(k) ? __store.get(k) : null),
  setItem: (k, v) => { __store.set(k, String(v)); },
  removeItem: k => { __store.delete(k); },
  clear: () => __store.clear()
};
function resetStorage() { __store.clear(); }

load('js/palette.js');
load('js/engine.js');

const sfxLog = [];
ML.sfx = { play: n => sfxLog.push(n), stopAllLoops() {}, startLoop() {}, stopLoop() {}, unlock() {}, toggleMute() {} };

// ------------------------------------------------------- what the bot sees
let seen = {};
function clearSeen() { seen = { texts: [], centered: [], sprites: [], rects: [] }; }
clearSeen();

ML.font = {
  init() {},
  drawText(str, x, y) { seen.texts.push({ s: String(str), x, y }); },
  drawTextCentered(str, x, y) { seen.centered.push({ s: String(str), x, y }); },
  drawTextShadow(str, x, y) { seen.texts.push({ s: String(str), x, y }); },
  drawTextShadowCentered(str, x, y) { seen.centered.push({ s: String(str), x, y }); },
  drawTextWavy() {}, drawTextWavyCentered() {},
  width: s => String(s).length * 6
};

load('js/sprites.js');
ML.sprites.init = function () {};
ML.drawSprite = (name, x, y) => { seen.sprites.push({ name, x, y }); };

// --------------------------------------------------------- scene stack
let stack = [];
ML.engine.push = s => { stack.push(s); if (s.enter) s.enter(); };
ML.engine.pop = () => { const s = stack.pop(); if (s && s.exit) s.exit(); };
ML.engine.replace = s => { const o = stack.pop(); if (o && o.exit) o.exit(); stack.push(s); if (s.enter) s.enter(); };
ML.engine.reset = s => { while (stack.length) { const o = stack.pop(); if (o && o.exit) o.exit(); } stack.push(s); if (s.enter) s.enter(); };
ML.engine.top = () => stack[stack.length - 1];
ML.engine.depth = () => stack.length;
ML.engine.burst = () => {};
ML.engine.spawn = () => {};
ML.engine.drawParticles = () => {};
ML.engine.clearParticles = () => {};
ML.engine.shake = () => {};
ML.engine.hitstop = () => {};
ML.engine.wipe = () => {};
ML.engine.rect = (x, y, w, h, c) => { seen.rects.push({ x, y, w, h, c }); };
ML.engine.frameRect = () => {};

const ctx = new Proxy({}, { get: (t, k) => (k === 'canvas' ? {} : () => {}), set: () => true });

// ------------------------------------------------------------------ input
let downKeys = {}, pressed = {}, anyFlag = false;
ML.input = {
  isDown: k => !!downKeys[k],
  justPressed: k => !!pressed[k],
  justReleased: () => false,
  anyPressed: () => anyFlag,
  endFrame() { pressed = {}; anyFlag = false; }
};
function press(k) { pressed[k] = true; anyFlag = true; }
// lets the suite drive ML.input directly when testing a rule in isolation
function setKey(k) { pressed = {}; anyFlag = false; if (k) { pressed[k] = true; anyFlag = true; } }

load('js/ui.js');
load('js/records.js');
load('js/opponents.js');
load('js/cutscene.js');
load('js/tournament.js');

const T = ML.tournament;
const STEP = 1 / 60;

// ----------------------------------------------------- the event stubs
let scriptScore = () => 500;
const EVENT_NAMES = {
  pouring: 'THE POUR', grilling: 'GRILL SERGEANT', chopping: 'SPLITTING IMAGE',
  mowing: 'CUT ABOVE', jaropening: 'DEATH GRIP', parking: 'BACK IT IN',
  creampuffs: 'CHOUX BUSINESS', groceries: 'THE ONE-TRIPPER'
};
ML.events = {};
for (const key of T.CONFIG.EVENT_ORDER) {
  ML.events[key] = {
    key, name: EVENT_NAMES[key],
    scene: () => {
      let done = false;
      return {
        key: 'stub_' + key,
        enter() {}, exit() {}, draw() {},
        update() {
          if (done) return;
          done = true;
          ML.engine.replace(ML.ui.resultsScene({
            key, name: EVENT_NAMES[key], score: scriptScore(key), lines: []
          }));
        }
      };
    }
  };
}

// -------------------------------------------------- reading the screen
const ROSTER_NAMES = ['YOU', 'PLAYER 1', 'PLAYER 2', 'ARNOLD', 'HUGO STIGLITZ',
  'THE HULK', 'STALIN', 'DICK BUTKUS', 'DUKE SILVER'];

// Standings rows: name at x=34, points right-aligned to x=296.
function readStandings() {
  const names = seen.texts.filter(t => t.x === 34 && ROSTER_NAMES.indexOf(t.s) >= 0);
  if (!names.length) return null;
  const out = [];
  for (const n of names) {
    const pts = seen.texts.find(t => t.y === n.y && /^\d+$/.test(t.s)
      && Math.abs(t.x + t.s.length * 6 - 296) < 2);
    out.push({ name: n.s, y: n.y, points: pts ? +pts.s : null });
  }
  out.sort((a, b) => a.y - b.y);
  return out;
}

// Event-result rows: name at x=30, score right-aligned to x=236.
function readEventRows() {
  const names = seen.texts.filter(t => t.x === 30 && ROSTER_NAMES.indexOf(t.s) >= 0);
  if (!names.length) return null;
  const out = [];
  for (const n of names) {
    const sc = seen.texts.find(t => t.y === n.y && /^\d+$/.test(t.s)
      && Math.abs(t.x + t.s.length * 6 - 236) < 2);
    const note = seen.texts.find(t => t.y === n.y && t.x === 244);
    out.push({ name: n.s, score: sc ? +sc.s : null, note: note ? note.s : null });
  }
  return out;
}

function headerText() {
  const h = seen.centered.find(c => c.y === 10);
  return h ? h.s : null;
}
function centeredContains(re) { return seen.centered.some(c => re.test(c.s)); }

/*
  Plays one whole tournament.
    opts.score(key)   the score the player posts in each event
    opts.players      1 or 2
    opts.catchStalin  press a key on every standings screen, all the way through
    opts.catchAfter   one press, this many frames after the scoreboard tell
    opts.skipIntro    ENTER out of the opening cutscene
    opts.stepIntro    tap SPACE through the cutscene beat by beat
    opts.dwell        frames to sit on a standings screen before pressing on
*/
function playTournament(opts) {
  opts = opts || {};
  scriptScore = opts.score || (() => 500);
  sfxLog.length = 0;
  stack = [];
  downKeys = {}; pressed = {}; anyFlag = false;
  T.abandon();

  const log = {
    results: [], standings: [], podiumTop3: null, finalTable: null,
    caughtSeen: 0, headers: [], reachedTitle: false, frames: 0,
    announcements: 0, shouts: [], standings_lines: [],
    flickers: 0, tickOnFlicker: 0,
    introFrames: 0, introNames: [], introBeats: 0
  };
  const dwell = opts.dwell === undefined ? 200 : opts.dwell;

  T.begin(opts.players || 1);

  let frames = 0;
  const max = opts.maxFrames || 60 * 900;
  let lastHeader = null;

  while (frames < max) {
    clearSeen();
    const sc = ML.engine.top();
    if (!sc) break;
    if (sc.draw) sc.draw(ctx);

    const key = sc.key || '';
    const head = headerText();
    if (head && head !== lastHeader) { log.headers.push(head); lastHeader = head; }

    pressed = {}; anyFlag = false; downKeys = {};

    if (key === 'tournament_intro') {
      log.introFrames++;
      const nm = seen.centered.find(c => c.y === 130 && ROSTER_NAMES.indexOf(c.s) >= 0);
      if (nm && log.introNames.indexOf(nm.s) === -1) log.introNames.push(nm.s);
      const counter = seen.texts.find(t => /^THE FIELD\s+(\d+)\/(\d+)$/.test(t.s));
      if (counter) {
        const m = /^THE FIELD\s+(\d+)\/(\d+)$/.exec(counter.s);
        log.introBeats = Math.max(log.introBeats, +m[1]);
      }
      // ENTER the moment it is allowed, which is what a repeat player does
      if (opts.skipIntro && log.introFrames > 22) press('enter');
      else if (opts.stepIntro && log.introFrames % 4 === 0) press('space');

    } else if (key === 'tournament_announcer') {
      const dw = (sc.__dwell = (sc.__dwell || 0) + 1);
      if (dw === 1) {
        log.announcements++;
        const shout = seen.centered.find(c => c.y === 90);
        const standing = seen.centered.find(c => c.y === 112);
        log.shouts.push(shout && shout.s);
        log.standings_lines.push(standing && standing.s);
      }
      if (dw > 40) press('enter');

    } else if (key === 'tournament_handover') {
      const dw = (sc.__dwell = (sc.__dwell || 0) + 1);
      if (dw === 1) {
        const sc0 = seen.centered.find(c => /^PLAYER \d SCORED$/.test(c.s));
        const nxt = seen.centered.find(c => /^PLAYER \d, SAME EVENT$/.test(c.s));
        log.lastHandover = { scoredLine: sc0 && sc0.s, nextLine: nxt && nxt.s };
        log.handovers = (log.handovers || 0) + 1;
      }
      if (dw > 60) press('enter');

    } else if (key === 'tournament_result') {
      const rows = readEventRows();
      const verdict = seen.centered.find(c => /^YOU FINISHED /.test(c.s) || /^P1 \d/.test(c.s));
      if (verdict && rows && rows.every(r => r.score !== null)) {
        log.results.push({ header: head, rows, verdict: verdict.s });
        press('enter');
      }

    } else if (key === 'tournament_standings') {
      const rows = readStandings();
      if (centeredContains(/^CAUGHT$/) && !sc.__caughtLogged) { sc.__caughtLogged = true; log.caughtSeen++; }

      // The tell: one row drawn on a different ground for a few frames. The
      // player's own row is the same shape in STEEL, so colour separates them.
      const flick = seen.rects.find(r => r.w === 292 && r.h === 14 && r.c === ML.palette.WOOD_DARK);
      if (flick && sc.__flickAt === undefined) {
        sc.__flickAt = sc.__dwell || 0;
        log.flickers++;
        if (sfxLog[sfxLog.length - 1] === 'tick') log.tickOnFlicker++;
      }

      if (opts.catchStalin) press('left');
      sc.__dwell = (sc.__dwell || 0) + 1;
      if (opts.catchAfter !== undefined && sc.__flickAt !== undefined
        && (sc.__dwell || 0) === sc.__flickAt + opts.catchAfter) press('left');

      sc.__yTrack = sc.__yTrack || {};
      if (rows) for (const r of rows) {
        (sc.__yTrack[r.name] = sc.__yTrack[r.name] || new Set()).add(r.y);
      }
      if (seen.rects.find(r => r.w === 292 && r.h === 14 && r.c === ML.palette.STEEL)) {
        sc.__playerHighlight = true;
      }
      if (sc.__logged) press('enter');
      if (rows && sc.__dwell > dwell && !sc.__logged) {
        const entry = { header: head, rows, yTrack: sc.__yTrack, highlighted: !!sc.__playerHighlight };
        if (/FINAL/.test(head || '')) { log.finalTable = rows; log.finalEntry = entry; }
        else log.standings.push(entry);
        sc.__logged = true;
        press('enter');
      }

    } else if (key === 'tournament_podium') {
      const dw = (sc.__dwell = (sc.__dwell || 0) + 1);
      if (dw > 220) {
        const names = seen.centered.filter(c => c.y === 156 && ROSTER_NAMES.indexOf(c.s) >= 0);
        if (names.length === 3) {
          const byX = names.slice().sort((a, b) => a.x - b.x);
          log.podiumTop3 = [byX[1].s, byX[0].s, byX[2].s];   // 1st centre, 2nd left, 3rd right
        }
        press('enter');
      }

    } else if (/^stub_/.test(key)) {
      // nothing to do; it finishes itself
    } else {
      log.reachedTitle = true;
      break;
    }

    sc.update(STEP);
    ML.input.endFrame();
    frames++;
  }
  log.frames = frames;
  log.sfx = sfxLog.slice();
  return log;
}

module.exports = { ML, T, playTournament, ROSTER_NAMES, resetStorage, setKey };
