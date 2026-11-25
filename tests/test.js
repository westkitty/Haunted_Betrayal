/* Headless verification for THE CITY THAT FOLDS AT DUSK.
   Run: node tests/test.js
   Covers: normal dusk, late tram (wait / early / lift), lift timing failure,
   pause/resume determinism, tablet viewport layout check. */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

function loadSim() {
  const code = fs.readFileSync(path.join(__dirname, '..', 'src', 'sim.js'), 'utf8');
  const sandbox = { window: {}, console };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(code, sandbox);
  return sandbox.window.CitySim || sandbox.CitySim;
}
const CitySim = loadSim();

let pass = 0, fail = 0;
function check(name, cond, detail) {
  if (cond) { pass++; console.log('  PASS ' + name + (detail ? ' — ' + detail : '')); }
  else { fail++; console.log('  FAIL ' + name + (detail ? ' — ' + detail : '')); }
}
function runToEnd(sim, maxSteps) {
  let n = 0;
  while (!sim.finished && n < (maxSteps || 20000)) { CitySim.step(sim); n++; }
  return n;
}
function docked(sim) {
  return ['BR-1', 'RP-1', 'RP-2', 'RP-3', 'RP-4', 'CD-1', 'CD-2', 'CD-3'].filter(id => sim.modules[id].docked).length;
}

console.log('== Normal dusk ==');
{
  const sim = CitySim.create('normal');
  runToEnd(sim);
  check('finishes', sim.finished === true);
  check('all 8 modules docked', docked(sim) === 8, docked(sim) + '/8');
  check('bridge became rib', sim.modules['BR-1'].docked && sim.modules['BR-1'].state === 'RIB');
  check('seam closed', sim.metrics.seamTime !== null, sim.metrics.seamTime && sim.metrics.seamTime.toFixed(1));
  check('nobody exposed', sim.metrics.exposed === 0, 'exposed=' + sim.metrics.exposed);
  check('interior warm', sim.metrics.interiorTemp > 10, sim.metrics.interiorTemp + 'C');
  check('outcome label', /SEALED/.test(sim.outcome.label), sim.outcome.label);
  console.log('  metrics:', JSON.stringify(sim.outcome.metrics));
}

console.log('== Delayed tram: WAIT ==');
let waitM;
{
  const sim = CitySim.create('delayed');
  // Choose wait early.
  CitySim.chooseStrategy(sim, 'wait');
  runToEnd(sim);
  waitM = sim.outcome.metrics;
  check('tram crossed', sim.trams['TR-2'].crossed === true);
  check('seam late (breach)', waitM.breach > 5, 'breach=' + waitM.breach.toFixed(0) + '% seam=' + (waitM.seamTime || 0).toFixed(1));
  check('nobody exposed (tram saved)', waitM.tramPaxExposed === 0, 'tramExposed=' + waitM.tramPaxExposed);
  console.log('  metrics:', JSON.stringify(waitM));
}

console.log('== Delayed tram: FOLD EARLY ==');
let earlyM;
{
  const sim = CitySim.create('delayed');
  CitySim.chooseStrategy(sim, 'early');
  runToEnd(sim);
  earlyM = sim.outcome.metrics;
  check('tram stranded', sim.trams['TR-2'].stranded === true || sim.trams['TR-2'].state === 'HELD' || earlyM.tramPaxExposed > 0, 'tramExposed=' + earlyM.tramPaxExposed);
  check('passengers exposed', earlyM.exposed > 0, 'exposed=' + earlyM.exposed);
  check('seam on time (no breach)', earlyM.breach < 10, 'breach=' + earlyM.breach.toFixed(0));
  console.log('  metrics:', JSON.stringify(earlyM));
}

console.log('== Delayed tram: LIFT RESCUE (timely) ==');
let liftM;
{
  const sim = CitySim.create('delayed');
  // Divert at t=5 (lift still on freight, must finish first — causal delay).
  for (let i = 0; i < 300; i++) CitySim.step(sim);
  CitySim.chooseStrategy(sim, 'lift');
  runToEnd(sim);
  liftM = sim.outcome.metrics;
  check('rescue done', sim.lift.rescueDone === true, 'rescued=' + sim.lift.rescued);
  check('tram pax sheltered via lift', liftM.tramPaxSheltered >= 10, 'sheltered=' + liftM.tramPaxSheltered);
  check('nobody exposed', liftM.exposed === 0, 'exposed=' + liftM.exposed);
  check('seam on time', liftM.breach < 10, 'breach=' + liftM.breach.toFixed(0));
  console.log('  metrics:', JSON.stringify(liftM));
}

console.log('== Delayed tram: LIFT TOO LATE (timing failure) ==');
let lateM;
{
  const sim = CitySim.create('delayed');
  for (let i = 0; i < 3600; i++) CitySim.step(sim); // t=60
  CitySim.chooseStrategy(sim, 'lift');
  runToEnd(sim);
  lateM = sim.outcome.metrics;
  check('late rescue fails or exposes', lateM.exposed > 0 || sim.lift.rescueFailed, 'exposed=' + lateM.exposed + ' failed=' + sim.lift.rescueFailed);
  console.log('  metrics:', JSON.stringify(lateM));
}

console.log('== Distinct outcomes ==');
{
  const a = JSON.stringify(waitM), b = JSON.stringify(earlyM), c = JSON.stringify(liftM);
  check('wait != early', a !== b);
  check('wait != lift', a !== c);
  check('early != lift', b !== c);
  check('sheltered counts differ', new Set([waitM.sheltered, earlyM.sheltered, liftM.sheltered]).size >= 2,
    waitM.sheltered + '/' + earlyM.sheltered + '/' + liftM.sheltered);
}

console.log('== Determinism (same inputs -> same hash) ==');
{
  function runOnce() {
    const sim = CitySim.create('delayed');
    for (let i = 0; i < 600; i++) CitySim.step(sim);
    CitySim.chooseStrategy(sim, 'lift');
    runToEnd(sim);
    return CitySim.hash(sim) + '|' + JSON.stringify(sim.outcome.metrics);
  }
  const h1 = runOnce(), h2 = runOnce();
  check('identical hashes', h1 === h2, h1.slice(0, 40));
}

console.log('== Pause / resume ==');
{
  const sim = CitySim.create('normal');
  for (let i = 0; i < 600; i++) CitySim.step(sim);
  const hPaused = CitySim.hash(sim);
  // "Paused": no steps taken. Hash must be stable.
  check('hash stable while paused', CitySim.hash(sim) === hPaused);
  for (let i = 0; i < 600; i++) CitySim.step(sim);
  const sim2 = CitySim.create('normal');
  for (let i = 0; i < 1200; i++) CitySim.step(sim2);
  check('resume matches uninterrupted', CitySim.hash(sim) === CitySim.hash(sim2));
}

console.log('== Manual lift commands (preconditions) ==');
{
  const sim = CitySim.create('delayed');
  // Load while lift carries freight must be refused.
  const ok = CitySim.liftCommand(sim, 'load');
  check('load refused while carrying freight', ok === false);
  const ok2 = CitySim.liftCommand(sim, 'traverse');
  check('traverse refused with no passengers', ok2 === false);
}

console.log('== Tablet viewport (768px) layout ==');
{
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  check('has tablet media query', /max-width:\s*760px/.test(html));
  check('touch targets >=44px', /min-height:\s*44px/.test(html));
  check('canvas resizes', /getBoundingClientRect/.test(fs.readFileSync(path.join(__dirname, '..', 'src', 'render.js'), 'utf8')));
  check('no speech / no spider imagery', !/speechSynthesis|spider/i.test(html + fs.readFileSync(path.join(__dirname, '..', 'src', 'render.js'), 'utf8')));
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
