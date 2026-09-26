/*
  The tournament frame: the opening cutscene, the announcer, the per-event
  results, the standings arithmetic, the podium, the records board, two player
  pass-and-play, and the rival who keeps his own records.

  Run:  node tests/tour.js .
*/
const { ML, T, playTournament, ROSTER_NAMES, resetStorage, setKey } = require('./tourbot.js');

let fails = 0;
const ok = (c, m, e) => { if (!c) { fails++; console.log('  FAIL  ' + m + (e ? '  ' + e : '')); } else console.log('  ok    ' + m + (e ? '  ' + e : '')); };
const mean = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0;
const MEDALS = T.CONFIG.MEDAL_POINTS;

// What the standings SHOULD say, using only the scores the results screens
// actually showed us.
function expectedPoints(results) {
  const totals = {};
  for (const res of results) for (const row of res.rows) totals[row.name] = 0;
  for (const res of results) {
    const rows = res.rows.slice().sort((a, b) => b.score - a.score);
    rows.forEach((r, i) => { totals[r.name] += MEDALS[i] === undefined ? 0 : MEDALS[i]; });
  }
  return totals;
}
function drift(r) {
  const exp = expectedPoints(r.results);
  const got = {};
  for (const row of r.finalTable) got[row.name] = row.points;
  let d = 0;
  for (const n of Object.keys(got)) d += Math.abs(exp[n] - got[n]);
  return d;
}

console.log('\n--- meeting the field ---');
{
  const full = playTournament({ score: () => 700 });
  ok(full.introFrames > 60, 'a tournament opens with the cutscene',
     '(' + full.introFrames + ' frames)');
  ok(full.introNames.length === 6, 'every rival gets a beat of his own',
     '(' + full.introNames.length + ': ' + full.introNames.join(', ') + ')');
  ok(full.introBeats === 6, 'and the counter agrees', '(got to ' + full.introBeats + '/6)');
  ok(full.results.length === 8 && full.reachedTitle,
     'and the tournament still runs start to finish afterwards');

  const tapped = playTournament({ score: () => 700, stepIntro: true });
  ok(tapped.introNames.length === 6, 'SPACE walks through them without missing one',
     '(' + tapped.introNames.length + ')');
  ok(tapped.introFrames < full.introFrames, 'and gets there quicker',
     '(' + tapped.introFrames + ' vs ' + full.introFrames + ' frames)');

  const skipped = playTournament({ score: () => 700, skipIntro: true });
  ok(skipped.introFrames < 40, 'ENTER gets you straight out of it',
     '(' + skipped.introFrames + ' frames)');
  ok(skipped.results.length === 8 && skipped.standings.length === 8
     && skipped.podiumTop3 && skipped.reachedTitle,
     'and skipping it costs the tournament nothing');
}

console.log('\n--- a tournament runs start to finish ---');
const runs = [];
for (let i = 0; i < 10; i++) runs.push(playTournament({ score: () => 550 + Math.random() * 200, skipIntro: true }));
ok(runs.every(r => r.results.length === 8), 'all eight events are played',
   '(' + runs.map(r => r.results.length).join(',') + ')');
ok(runs.every(r => r.standings.length === 8), 'a standings screen after each one');
ok(runs.every(r => r.podiumTop3 && r.podiumTop3.length === 3), 'and a podium at the end');
ok(runs.every(r => r.finalTable && r.finalTable.length === 7), 'then the full final table');
ok(runs.every(r => r.reachedTitle), 'and it hands you back to the title screen');
ok(JSON.stringify(T.CONFIG.EVENT_ORDER) === JSON.stringify(
   ['pouring', 'grilling', 'chopping', 'mowing', 'jaropening', 'parking', 'creampuffs', 'groceries']),
   'in the order the brief asks for');

console.log('\n--- medal points ---');
ok(JSON.stringify(MEDALS) === JSON.stringify([10, 8, 6, 5, 4, 3, 2, 1]),
   'the table is 10-8-6-5-4-3-2-1');
let vOk = 0, vTotal = 0;
for (const r of runs) for (const res of r.results) {
  vTotal++;
  const rows = res.rows.slice().sort((a, b) => b.score - a.score);
  const place = rows.findIndex(x => x.name === 'YOU') + 1;
  const m = /^YOU FINISHED (\d+)(?:ST|ND|RD|TH)\s+PLUS (\d+) POINTS$/.exec(res.verdict);
  if (m && +m[1] === place && +m[2] === MEDALS[place - 1]) vOk++;
}
ok(vOk === vTotal, 'the place and points you are told match the scores on screen',
   '(' + vOk + '/' + vTotal + ')');

console.log('\n--- the standings add up ---');
const clean = [];
for (let i = 0; i < 12; i++) clean.push(playTournament({ score: () => 550 + Math.random() * 200, catchStalin: true, skipIntro: true }));
ok(clean.every(r => drift(r) === 0), 'every final table equals the sum of the eight events shown',
   '(' + clean.filter(r => drift(r) === 0).length + '/' + clean.length + ')');
ok(clean.every(r => r.finalTable.every((row, i, arr) => i === 0 || arr[i - 1].points >= row.points)),
   'and the table is sorted by points');
ok(runs.concat(clean).every(r => JSON.stringify(r.podiumTop3)
   === JSON.stringify(r.finalTable.slice(0, 3).map(x => x.name))),
   'the podium is the top of the final table');

console.log('\n--- the standings animate rather than snap ---');
let slid = 0, screens = 0, highlighted = 0;
for (const r of runs) for (const s of r.standings) {
  screens++;
  if (s.highlighted) highlighted++;
  for (const n of Object.keys(s.yTrack)) if (s.yTrack[n].size > 1) slid++;
}
ok(slid > screens, 'rows are drawn at in-between positions on the way',
   '(' + slid + ' rows slid across ' + screens + ' screens)');
ok(highlighted === screens, 'your own row is highlighted on every standings screen',
   '(' + highlighted + '/' + screens + ')');

console.log('\n--- the rivals behave the way the brief says ---');
const allRows = [];
for (const r of runs.concat(clean)) r.results.forEach((res, i) => allRows.push({ round: i, rows: res.rows }));
const scoresOf = name => allRows.map(e => {
  const row = e.rows.find(x => x.name === name);
  return row ? { round: e.round, score: row.score, note: row.note } : null;
}).filter(Boolean);

const TUN = ML.opponents.TUNING;
const duke = scoresOf('DUKE SILVER');
ok(duke.every(d => d.score >= TUN.DUKE_MIN && d.score <= TUN.DUKE_MAX),
   'DUKE SILVER never leaves his band',
   '(' + Math.min(...duke.map(d => d.score)) + '-' + Math.max(...duke.map(d => d.score))
   + ', band ' + TUN.DUKE_MIN + '-' + TUN.DUKE_MAX + ')');
const arnoldJars = allRows.filter(e => T.CONFIG.EVENT_ORDER[e.round] === 'jaropening')
  .map(e => e.rows.find(x => x.name === 'ARNOLD').score);
ok(arnoldJars.every(s => s >= 720), 'ARNOLD never fails to open a jar',
   '(lowest ' + Math.min(...arnoldJars) + ')');
const delicate = { pouring: 1, creampuffs: 1, parking: 1 };
const hulk = scoresOf('THE HULK');
const hulkDelicate = hulk.filter(h => delicate[T.CONFIG.EVENT_ORDER[h.round]]);
const hulkBangs = hulkDelicate.filter(h => h.note === 'SMASH!');
ok(hulkBangs.length / hulkDelicate.length > 0.15 && hulkBangs.length / hulkDelicate.length < 0.55,
   'THE HULK detonates on roughly a third of the delicate events',
   '(' + Math.round(100 * hulkBangs.length / hulkDelicate.length) + '% of ' + hulkDelicate.length + ')');
ok(hulk.filter(h => !delicate[T.CONFIG.EVENT_ORDER[h.round]]).every(h => h.note !== 'SMASH!'),
   'and never on the rough ones');
ok(hulkBangs.every(h => h.score === 0), 'and a detonation really is a nought');
const chokes = scoresOf('HUGO STIGLITZ').filter(h => h.note === 'CHOKED');
ok(chokes.every(h => h.round >= 4), 'HUGO STIGLITZ only chokes after the fourth event',
   '(' + chokes.length + ' chokes)');

console.log('\n--- the rival who keeps his own records ---');
{
  const loose = [];
  for (let i = 0; i < 30; i++) loose.push(playTournament({ score: () => 640, skipIntro: true }));
  ok(loose.filter(r => drift(r) > 0).length > 6,
     'left alone, the table quietly stops matching the scores you were shown',
     '(' + loose.filter(r => drift(r) > 0).length + '/' + loose.length + ' runs)');
  ok(loose.every(r => r.caughtSeen === 0 || r.flickers > 0), 'and is never accused without a tell');

  const withTell = loose.filter(r => r.flickers > 0);
  ok(withTell.length > 10, 'he has a go on most runs', '(' + withTell.length + '/30)');
  ok(withTell.every(r => r.tickOnFlicker === r.flickers),
     'the tell is a sound as well as a flicker - you cannot watch seven rows at once',
     '(' + withTell.reduce((a, r) => a + r.tickOnFlicker, 0) + ' ticks on '
     + withTell.reduce((a, r) => a + r.flickers, 0) + ' flickers)');

  const quick = [];
  for (let i = 0; i < 20; i++) quick.push(playTournament({ score: () => 640, catchAfter: 20, dwell: 300, skipIntro: true }));
  const q = quick.filter(r => r.flickers > 0);
  ok(q.length > 0 && q.every(r => drift(r) === 0),
     'one press inside the window and the table is straight again',
     '(' + q.filter(r => drift(r) === 0).length + '/' + q.length + ')');
  ok(q.every(r => r.caughtSeen > 0), 'and you are told you caught him');

  const W = T.CONFIG.REVISE_WINDOW;
  const late = [];
  for (let i = 0; i < 20; i++) late.push(playTournament({ score: () => 640, catchAfter: W + 25, dwell: 300, skipIntro: true }));
  const lt = late.filter(r => r.flickers > 0);
  ok(lt.length > 0 && lt.filter(r => drift(r) > 0).length > lt.length / 2,
     'a press after the window has closed does not help',
     '(' + lt.filter(r => drift(r) > 0).length + '/' + lt.length + ' still drifted)');
  ok(lt.every(r => r.caughtSeen === 0), 'and it does not claim you caught him');
  ok(T.CONFIG.REVISE_MAX_PER_RUN === 1, 'and he only gets one go a tournament');
}

console.log('\n--- the announcer ---');
{
  const a = playTournament({ score: () => 700, skipIntro: true });
  ok(a.announcements === 8, 'a shout before every event', '(' + a.announcements + ')');
  ok(a.shouts.every(x => typeof x === 'string' && x.length > 0), 'and it always has something to say');
  ok(a.standings_lines[0] === 'EIGHT EVENTS. ONE DRIVEWAY.',
     'the first one sets the scene rather than quoting a table that does not exist',
     '(' + a.standings_lines[0] + ')');
  ok(a.standings_lines.slice(1).every(x => typeof x === 'string' && x.length > 0),
     'and the rest tell you where you stand', '(e.g. ' + a.standings_lines[3] + ')');
}

console.log('\n--- the title card waits for you ---');
{
  const press = k => setKey(k), nothing = () => setKey(null);
  nothing();
  ok(ML.ui.titleDone(5) === false, 'it does not pass on its own, however long it sits');
  press('space'); ok(ML.ui.titleDone(1.0) === true, 'SPACE dismisses it');
  press('enter'); ok(ML.ui.titleDone(1.0) === true, 'and so does ENTER');
  press('space'); ok(ML.ui.titleDone(0.0) === false,
    'but the press that started the event cannot skip its own instructions');
  press('left'); ok(ML.ui.titleDone(1.0) === false, 'and an arrow key is not a dismissal');
  nothing();
}

console.log('\n--- records ---');
{
  resetStorage();
  const R = ML.records;
  ok(R.available(), 'storage is reachable');
  ok(!R.any(), 'and starts empty');
  let sub = R.submit('chopping', 480);
  ok(sub.isNew && sub.value === 480, 'the first score sets it');
  sub = R.submit('chopping', 300);
  ok(!sub.isNew && sub.value === 480, 'a worse one does not');
  sub = R.submit('chopping', 700);
  ok(sub.isNew && sub.previous === 480, 'a better one does');
  ok(R.submit('chopping', 99999).value === 1000, 'and nothing can exceed 1000');

  resetStorage();
  const played = playTournament({ score: () => 640, skipIntro: true });
  ok(R.eventKeys().filter(k => R.bestFor(k) !== null).length === 8,
     'a tournament sets a record on all eight events');
  const tot = R.totalOfBests();
  ok(tot.of === 8000 && tot.total === R.eventKeys().reduce((a, k) => a + (R.bestFor(k) || 0), 0),
     'the overall total is the sum of the eight bests, out of 8000', '(' + tot.total + '/8000)');
  const bt = R.bestTournament();
  ok(bt && bt.runs === 1 && bt.points === played.finalTable.find(x => x.name === 'YOU').points,
     'and the tournament itself is recorded', '(' + bt.points + ' pts, ' + bt.place + ' place)');
  const before = R.bestFor('chopping');
  playTournament({ score: () => 200, skipIntro: true });
  ok(R.bestFor('chopping') === before, 'a bad run never lowers a record');
  ok(R.bestTournament().runs === 2, 'but it still counts as a run played');
  R.wipe();
  ok(!R.any(), 'and the board can be wiped');
  resetStorage();
}

console.log('\n--- two players, pass and play ---');
{
  const two = [];
  for (let i = 0; i < 8; i++) two.push(playTournament({ players: 2, score: () => 550 + Math.random() * 250, skipIntro: true }));
  ok(two.every(r => r.results.length === 8), 'all eight events are still played');
  ok(two.every(r => r.handovers === 8), 'the keyboard changes hands once per event',
     '(' + two.map(r => r.handovers).join(',') + ')');
  ok(two.every(r => r.results.every(res => res.rows.length === 8)),
     'eight in the field instead of seven');
  ok(two.every(r => r.finalTable.length === 8), 'and eight rows in the final table');
  let differed = 0, compared = 0;
  for (const r of two) for (const res of r.results) {
    compared++;
    if (res.rows.find(x => x.name === 'PLAYER 1').score
      !== res.rows.find(x => x.name === 'PLAYER 2').score) differed++;
  }
  ok(differed > compared * 0.9, 'they post their own separate scores',
     '(' + differed + '/' + compared + ')');
  ok(two.every(r => JSON.stringify(r.podiumTop3)
     === JSON.stringify(r.finalTable.slice(0, 3).map(x => x.name))),
     'the podium matches the eight way table');
  const hand = two.map(r => r.lastHandover).filter(Boolean);
  ok(hand.length > 0 && hand.every(h => h.scoredLine === 'PLAYER 1 SCORED'
     && h.nextLine === 'PLAYER 2, SAME EVENT'),
     'the handover names who just played and who is up');

  const solo = playTournament({ score: () => 700, skipIntro: true });
  ok(solo.results.every(res => res.rows.length === 7), 'one player is still a seven strong field');
  ok(!solo.handovers, 'and has no keyboard to pass');
  ok(solo.results[0].rows.some(x => x.name === 'YOU'), 'and is still called YOU');
}

console.log('\n--- how good do you have to be? ---');
/*
   These three profiles are not guesses about how a person plays. Each number is
   what a bot driving the REAL event scored in that event's own harness - the
   bottom, middle and upper tiers of the skill curves those harnesses print.
*/
{
  const CASUAL = { chopping: 327, grilling: 468, pouring: 414, mowing: 593,
    jaropening: 268, parking: 384, creampuffs: 598, groceries: 328 };
  const DECENT = { chopping: 475, grilling: 813, pouring: 610, mowing: 652,
    jaropening: 526, parking: 519, creampuffs: 736, groceries: 521 };
  const GOOD = { chopping: 604, grilling: 997, pouring: 742, mowing: 745,
    jaropening: 820, parking: 705, creampuffs: 854, groceries: 658 };
  const scorer = p => key => Math.round(Math.max(0, Math.min(1000,
    p[key] + (Math.random() * 2 - 1) * 0.09 * p[key])));

  const rate = (p, n) => {
    let wins = 0, podium = 0, places = [];
    for (let i = 0; i < n; i++) {
      const r = playTournament({ score: scorer(p), dwell: 45, skipIntro: true });
      const place = r.finalTable.findIndex(x => x.name === 'YOU') + 1;
      places.push(place);
      if (place === 1) wins++;
      if (place <= 3) podium++;
    }
    return { win: wins / n, podium: podium / n, place: mean(places) };
  };

  const rates = {};
  for (const [nm, p] of [['casual', CASUAL], ['decent', DECENT], ['good', GOOD]]) {
    const r = rate(p, 40);
    rates[nm] = r;
    console.log('  ' + nm.padEnd(8) + '(avg ' + Math.round(mean(Object.values(p))) + ')'
      + '   wins ' + String(Math.round(r.win * 100)).padStart(3) + '%'
      + '   podium ' + String(Math.round(r.podium * 100)).padStart(3) + '%'
      + '   average place ' + r.place.toFixed(1));
  }
  ok(rates.casual.win <= 0.05, 'a careless run does not win');
  ok(rates.decent.win >= 0.3 && rates.decent.win <= 0.72,
     'a decent player wins roughly half the time - the brief target',
     '(' + Math.round(rates.decent.win * 100) + '%)');
  ok(rates.good.win >= 0.85, 'and a good one nearly always does');
  ok(rates.casual.win < rates.decent.win && rates.decent.win < rates.good.win,
     'so the ladder runs the right way');
}

console.log(fails ? '\n' + fails + ' FAILURE(S)\n' : '\nall assertions passed\n');
process.exit(fails ? 1 : 0);
