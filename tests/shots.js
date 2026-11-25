/* Renders real frames of the game to PNG using @napi-rs/canvas, so the visuals can be
   inspected without a browser. Run: node tests/shots.js [outDir] */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { createCanvas } = require('@napi-rs/canvas');

const ROOT = path.join(__dirname, '..');
const OUT = process.argv[2] || path.join(ROOT, 'shots');
fs.mkdirSync(OUT, { recursive: true });

const W = 1280, H = 760;
const canvas = createCanvas(W, H);
const ctx = canvas.getContext('2d');

const sandbox = {
  console, Math, Date, JSON, Object, Array, Set, Number, String, Boolean,
  performance: { now: () => 0 },
  requestAnimationFrame() { return 0; },
  devicePixelRatio: 1
};
sandbox.window = sandbox;
sandbox.globalThis = sandbox;
sandbox.window.devicePixelRatio = 1;
sandbox.window.addEventListener = () => {};
sandbox.canvasEl = {
  width: W, height: H,
  getContext: () => ctx,
  getBoundingClientRect: () => ({ width: W, height: H, left: 0, top: 0 })
};
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(ROOT, 'src/sim.js'), 'utf8'), sandbox);
vm.runInContext(fs.readFileSync(path.join(ROOT, 'src/render.js'), 'utf8'), sandbox);

const CitySim = sandbox.CitySim;
const renderer = sandbox.CityRender.createRenderer(sandbox.canvasEl);

function shot(name, sim, selected) {
  renderer.draw(sim, selected || null);
  const file = path.join(OUT, name + '.png');
  fs.writeFileSync(file, canvas.toBuffer('image/png'));
  console.log('  wrote ' + path.relative(ROOT, file));
}
function advance(sim, seconds) {
  const n = Math.round(seconds * 60);
  for (let i = 0; i < n; i++) CitySim.step(sim);
}
function seek(sim, t) { while (sim.t < t && !sim.finished) CitySim.step(sim); }

console.log('Rendering inspection frames...');

// Cycle 1: normal dusk, sampled through the fold.
const normal = CitySim.create('normal');
seek(normal, 6);    shot('01-ordinary-day', normal);
seek(normal, 24);   shot('02-market-empties', normal);
seek(normal, 31);   shot('03-bridge-unpins', normal, 'BR-1');
seek(normal, 40);   shot('04-panels-travel', normal, 'RP-2');
seek(normal, 50);   shot('05-cold-front', normal);
seek(normal, 62);   shot('06-ducts-dock', normal, 'CD-2');
seek(normal, 71.5); shot('07-last-seam', normal);
seek(normal, 90);   shot('08-sealed-wide', normal);

// Cycle 2: delayed tram, held at the ravine.
const delayed = CitySim.create('delayed');
seek(delayed, 47); shot('09-delayed-held', delayed, 'TR-2');
CitySim.chooseStrategy(delayed, 'lift');
seek(delayed, 58); shot('10-lift-rescue', delayed, 'FL-1');
seek(delayed, 90); shot('11-rescue-outcome', delayed);

// Cycle 2 alternate: folded early, tram stranded.
const early = CitySim.create('delayed');
CitySim.chooseStrategy(early, 'early');
seek(early, 62); shot('12-stranded', early, 'TR-2');

// Tablet portrait framing.
const wide = createCanvas(768, 1024);
const wctx = wide.getContext('2d');
const tabletEl = { width: 768, height: 1024, getContext: () => wctx,
  getBoundingClientRect: () => ({ width: 768, height: 1024, left: 0, top: 0 }) };
const tabletR = sandbox.CityRender.createRenderer(tabletEl);
const tSim = CitySim.create('normal');
seek(tSim, 71.5);
tabletR.draw(tSim, null);
fs.writeFileSync(path.join(OUT, '13-tablet-768x1024.png'), wide.toBuffer('image/png'));
console.log('  wrote shots/13-tablet-768x1024.png');
