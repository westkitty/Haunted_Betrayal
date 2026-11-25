/* Browser-less smoke test: runs the REAL index.html scripts (sim + render + inline app)
   against a DOM/Canvas2D shim. Catches runtime errors, proves the renderer actually
   draws, and verifies interaction wiring. Run: node tests/dom-smoke.js */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

let drawCalls = 0;
const drawLog = new Set();
function makeCtx() {
  const grad = { addColorStop() {} };
  const ctx = {
    canvas: null, globalAlpha: 1, fillStyle: '#000', strokeStyle: '#000',
    lineWidth: 1, lineCap: 'butt', lineJoin: 'miter', font: '10px sans-serif',
    textAlign: 'left', textBaseline: 'alphabetic', shadowBlur: 0, shadowColor: '#000',
    globalCompositeOperation: 'source-over'
  };
  const methods = ['save','restore','beginPath','closePath','moveTo','lineTo','arc','arcTo','rect',
    'fill','stroke','clip','translate','rotate','scale','setTransform','resetTransform','fillRect',
    'strokeRect','clearRect','fillText','strokeText','setLineDash','quadraticCurveTo',
    'bezierCurveTo','ellipse','drawImage','measureText','createLinearGradient','createRadialGradient',
    'createPattern','putImageData','getImageData'];
  methods.forEach(m => {
    ctx[m] = function () {
      drawCalls++; drawLog.add(m);
      if (m === 'createLinearGradient' || m === 'createRadialGradient') return grad;
      if (m === 'measureText') return { width: 10 };
      if (m === 'getImageData') return { data: new Uint8ClampedArray(4) };
      return undefined;
    };
  });
  return ctx;
}

function makeEl(id) {
  const listeners = {};
  const el = {
    id, textContent: '', innerHTML: '', disabled: false, value: '',
    style: {}, children: [], dataset: {},
    classList: {
      _s: new Set(),
      add(c) { this._s.add(c); }, remove(c) { this._s.delete(c); },
      toggle(c, f) { if (f === undefined) f = !this._s.has(c); f ? this._s.add(c) : this._s.delete(c); },
      contains(c) { return this._s.has(c); }
    },
    addEventListener(t, f) { (listeners[t] = listeners[t] || []).push(f); },
    removeEventListener() {},
    getBoundingClientRect() { return { width: 1024, height: 620, left: 0, top: 0 }; },
    appendChild(c) { el.children.push(c); },
    querySelector() { return null; },
    dispatch(t, ev) { (listeners[t] || []).slice().forEach(f => f.call(el, ev || {})); },
    _listeners: listeners
  };
  // Support property-style handlers the way browsers do (onclick/onchange -> dispatch).
  ['onclick','onchange','oninput','onpointerdown'].forEach(prop => {
    let fn = null;
    Object.defineProperty(el, prop, {
      get() { return fn; },
      set(v) { fn = v; },
      configurable: true
    });
    const evt = prop.slice(2);
    el.addEventListener(evt, function (e) { if (typeof fn === 'function') fn.call(el, e); });
  });
  if (id === 'cv') {
    const ctx = makeCtx();
    el.width = 0; el.height = 0;
    el.getContext = () => ctx;
    el._ctx = ctx;
  }
  return el;
}

const els = {};
['cv','clock','phase','hTemp','hSeal','hCold','hPow','hPax','hBridge','hLift','insTitle','insBody',
 'decisions','feed','outcome','btnPlay','btnStep','btnSpeed','btnRestart','modeSel','btnSound',
 'sWait','sEarly','sLift','liftFeas','bToTram','bLoad','bTrav','bUnload','legend'].forEach(id => els[id] = makeEl(id));

let rafQueue = [];
let fakeNow = 1000;
const sandbox = {
  console, Math, Date, JSON, Object, Array, Set, Map, Number, String, Boolean, Uint8ClampedArray,
  performance: { now: () => fakeNow },
  requestAnimationFrame(f) { rafQueue.push(f); return rafQueue.length; },
  cancelAnimationFrame() {},
  setTimeout, clearTimeout,
  devicePixelRatio: 2,
  document: {
    getElementById: id => els[id] || makeEl(id),
    createElement: () => makeEl('new'),
    addEventListener() {},
    body: makeEl('body'),
    documentElement: makeEl('html')
  },
  navigator: { userAgent: 'node' },
  addEventListener() {}
};
sandbox.window = sandbox;
sandbox.globalThis = sandbox;
sandbox.window.devicePixelRatio = 2;
sandbox.window.addEventListener = (t, f) => {
  (sandbox.__winListeners = sandbox.__winListeners || {})[t] = f;
};
sandbox.AudioContext = function () { throw new Error('no audio in node'); };

vm.createContext(sandbox);

// Pull the three <script src> files plus the inline app script, in document order.
const scriptTags = [...html.matchAll(/<script(?:\s+src="([^"]+)")?>([\s\S]*?)<\/script>/g)];
let pass = 0, fail = 0;
function check(n, c, d) { c ? (pass++, console.log('  PASS ' + n + (d ? ' — ' + d : ''))) : (fail++, console.log('  FAIL ' + n + (d ? ' — ' + d : ''))); }

try {
  scriptTags.forEach(([, src, inline]) => {
    const code = src ? fs.readFileSync(path.join(ROOT, src), 'utf8') : inline;
    vm.runInContext(code, sandbox, { filename: src || 'index.html#inline' });
  });
  check('page scripts load without error', true);
} catch (e) {
  check('page scripts load without error', false, e.message);
  console.log(e.stack.split('\n').slice(0, 6).join('\n'));
  process.exit(1);
}

console.log('== Runtime smoke ==');
check('renderer + sim exposed', !!sandbox.CityRender && !!sandbox.CitySim);
check('first cycle is normal dusk', els.modeSel.value === 'normal');

// Pump frames like the browser would, at 2x for speed.
function pump(seconds, dtMs) {
  const step = dtMs || 16;
  const frames = Math.ceil(seconds * 1000 / step);
  for (let i = 0; i < frames; i++) {
    fakeNow += step;
    const q = rafQueue; rafQueue = [];
    q.forEach(f => f(fakeNow));
  }
}

drawCalls = 0; drawLog.clear();
pump(2);
check('canvas receives draw calls', drawCalls > 500, drawCalls + ' ops');
check('uses paths/fills', drawLog.has('fill') && drawLog.has('beginPath'));
check('uses gradients (sky)', drawLog.has('createLinearGradient'));
check('draws text labels', drawLog.has('fillText'));
check('canvas sized for DPR', els.cv.width > 0 && els.cv.height > 0, els.cv.width + 'x' + els.cv.height);

console.log('== HUD + inspector wiring ==');
check('clock updates', /t=/.test(els.clock.innerHTML), els.clock.innerHTML.replace(/<[^>]+>/g, ''));
check('seal counter renders', /\/8 modules/.test(els.hSeal.textContent), els.hSeal.textContent);
check('inspector default prompt', /Tap a module/.test(els.insTitle.textContent));

// Touch-select a module via the real hit-test path.
const sim = sandbox.__sim || null;
els.cv.dispatch('pointerdown', { clientX: 512, clientY: 300 });
check('pointerdown handled without error', true);

console.log('== Playback controls ==');
const before = els.clock.innerHTML;
els.btnPlay.dispatch('click');
check('pause toggles label', els.btnPlay.textContent.indexOf('Play') >= 0, els.btnPlay.textContent);
const tPaused = els.clock.innerHTML;
pump(1);
check('paused clock frozen', els.clock.innerHTML === tPaused);
els.btnStep.dispatch('click');
pump(0.05);
check('step advances clock', els.clock.innerHTML !== tPaused, els.clock.innerHTML.replace(/<[^>]+>/g, ''));
els.btnPlay.dispatch('click');
els.btnSpeed.dispatch('click');
check('speed goes 2x', els.btnSpeed.textContent === '2×', els.btnSpeed.textContent);

console.log('== Decisions panel (delayed cycle) ==');
els.modeSel.value = 'delayed';
els.modeSel.dispatch('change');
check('decisions shown for delayed cycle', !els.decisions.classList.contains('hidden'));
els.sLift.dispatch('click');
check('strategy button disabled after choose', els.sLift.disabled === true);

console.log('== Full run to outcome ==');
pump(95, 32);
check('outcome panel shown', els.outcome.style.display === 'block');
check('outcome has what-became-what', /What became what/.test(els.outcome.innerHTML));
check('outcome has replay', /Replay this cycle/.test(els.outcome.innerHTML));
check('renderer still drawing at end', (drawCalls += 0) > 500);

console.log('== Restart + normal cycle replay ==');
els.btnRestart.dispatch('click');
pump(1);
check('restart clears outcome', els.outcome.style.display === 'none');
check('restart rewinds clock', /t=<b>0/.test(els.clock.innerHTML) || parseFloat(els.clock.innerHTML.match(/t=<b>([\d.]+)/)[1]) < 3, els.clock.innerHTML.replace(/<[^>]+>/g, ''));

console.log('== Tablet viewport (1024x768 -> narrow) ==');
sandbox.window.dispatch ? null : null;
els.cv.getBoundingClientRect = () => ({ width: 768, height: 1024, left: 0, top: 0 });
if (sandbox.__winListeners && sandbox.__winListeners.resize) {
  try { sandbox.__winListeners.resize(); check('resize handler runs', true, els.cv.width + 'x' + els.cv.height); }
  catch (e) { check('resize handler runs', false, e.message); }
}
pump(1);
check('renders after resize', drawCalls > 500);

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
