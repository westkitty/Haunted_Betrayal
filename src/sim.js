/* THE CITY THAT FOLDS AT DUSK — deterministic simulation core.
   No DOM, no Math.random. Same inputs -> same result (fixed DT, seeded RNG).
   Works in browser (window.CitySim) and Node (module.exports). */
(function (global) {
'use strict';

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    var t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

var DT = 1 / 60;
var T = { DAY_END: 20, BRIDGE: 30, COLD: 52, SEAM: 72, END: 90 };
var RAVINE_X = 12;          // ravine centre line (world x)
var BRIDGE_Y = 8;           // tram line y
var LIFT_WEST = 10.2, LIFT_EAST = 13.8;
var LIFT_CAPACITY = 12;     // passengers
var TRAM2_PASSENGERS = 12;

function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
function lerp(a, b, f) { return a + (b - a) * f; }
function dist2(ax, ay, bx, by) { var dx = ax - bx, dy = ay - by; return Math.sqrt(dx * dx + dy * dy); }

/* ---------- module factory ---------- */
function mkModule(id, name, kind, home, dock, load, deps, destLabel) {
  return {
    id: id, name: name, kind: kind,
    home: { x: home.x, y: home.y, z: home.z || 0 },
    dock: { x: dock.x, y: dock.y, z: dock.z || 0 },
    pos: { x: home.x, y: home.y, z: home.z || 0, rot: 0 },
    target: null, speed: 3.2, state: 'HOME', timer: 0,
    load: load, deps: deps.slice(), dest: destLabel,
    attachedTo: null, // 'gantry' | 'lift' | null
    docked: false, unpinned: false, brake: 0, cableTension: 0
  };
}

function create(mode) {
  var delayed = (mode === 'delayed');
  var rng = mulberry32(delayed ? 67890 : 12345);

  // --- Block layout (world 24 x 14) -------------------------------------
  //   y=8   tram line / ravine crossing      x=11..13 ravine
  //   y=2..7 market courtyard (warm room)     x=3..9
  //   y=4   crane aisle: four stall roofs become the shell ceiling
  var modules = {};
  function add(m) { modules[m.id] = m; return m; }

  // Ravine bridge BR-1: spans the ravine, then travels west and becomes the
  // north shell rib. Same steel, different job.
  add(mkModule('BR-1', 'Ravine Bridge', 'bridge',
    { x: 12, y: 8, z: 0 }, { x: 5.0, y: 1.75, z: 3.6 },
    '4.2 t steel', ['TR-2 crossing', 'GN-1', 'PIN-1..4'], 'Shell rib RIB-A (north wall)'));

  // Roof panels RP-1..4: the four market stall roofs -> stepped ceiling vault.
  add(mkModule('RP-1', 'Stall Roof Panel 1', 'panel',
    { x: 2.65, y: 3.2, z: 2.5 }, { x: 3.30, y: 4.00, z: 5.02 },
    '1.1 t', ['GN-1', 'STALL-1'], 'Market ceiling, west bay'));
  add(mkModule('RP-2', 'Stall Roof Panel 2', 'panel',
    { x: 4.55, y: 3.2, z: 2.5 }, { x: 5.10, y: 4.00, z: 5.10 },
    '1.1 t', ['GN-1', 'STALL-2'], 'Market ceiling, mid-west bay'));
  add(mkModule('RP-3', 'Stall Roof Panel 3', 'panel',
    { x: 6.45, y: 3.2, z: 2.5 }, { x: 6.90, y: 4.00, z: 5.18 },
    '1.2 t', ['GN-1', 'STALL-3'], 'Market ceiling, mid-east bay'));
  add(mkModule('RP-4', 'Stall Roof Panel 4', 'panel',
    { x: 8.35, y: 3.2, z: 2.5 }, { x: 8.70, y: 4.00, z: 5.26 },
    '1.1 t', ['GN-1', 'STALL-4'], 'Market ceiling, east bay'));

  // Chimney ducts CD-1..3: brick stacks -> shell piers with vents.
  add(mkModule('CD-1', 'Chimney Duct 1', 'duct',
    { x: 2.2, y: 6.4, z: 0.9 }, { x: 2.6, y: 4.4, z: 0.0 },
    '0.6 t', ['GN-1', 'HOUSE-W'], 'West shell pier + vent'));
  add(mkModule('CD-2', 'Chimney Duct 2', 'duct',
    { x: 9.4, y: 6.2, z: 0.9 }, { x: 9.4, y: 4.4, z: 0.0 },
    '0.6 t', ['GN-1', 'HOUSE-E'], 'East shell pier + vent'));
  add(mkModule('CD-3', 'Chimney Duct 3', 'duct',
    { x: 5.0, y: 9.7, z: 0.9 }, { x: 6.0, y: 6.95, z: 0.0 },
    '0.6 t', ['GN-1', 'HOUSE-S'], 'South shell pier + vent'));

  // BR-1 starts life spanning the ravine (not in a lift bay).
  modules['BR-1'].state = 'SPANNING';

  // Machines that persist through the fold.
  add(mkModule('GN-1', 'Gantry Crane', 'gantry',
    { x: 5, y: 2, z: 0 }, { x: 5, y: 2, z: 0 },
    'rated 3.0 t', ['POWER bus', 'RAIL-N', 'RAIL-S'], 'Rides rails, builds the shell'));
  add(mkModule('FL-1', 'Ravine Freight Lift', 'lift',
    { x: 10.2, y: 8, z: 0 }, { x: 10.2, y: 8, z: 0 },
    'rated 12 pax / 2.0 t', ['POWER bus', 'CABLE-C1', 'TR-2 platform'], 'Crosses the ravine, cargo or people'));

  // Gantry + lift runtime state
  var gantry = { x: 4.0, y: 2, jib: 6.0, hookZ: 6.9, state: 'IDLE', carrying: null, targetX: 4.0, targetJib: 6.0, counterZ: 0, brake: 0, queue: [], railA: 1.6, railB: 10.4, girderZ: 6.9 };
  var lift = {
    x: LIFT_WEST, y: 8, z: 0, state: 'FREIGHT', carrying: 'freight', load: 0,
    mission: 'freight', missionStep: 'deliver', timer: 0,
    counterZ: 0, brake: 0, cableTension: 0, trips: 0, rescued: 0, rescueDone: false, rescueFailed: false
  };

  // Trams runtime
  var trams = {
    'TR-1': { x: 5, y: 8, dir: 1, speed: 2.2, state: 'RUN', pax: 6, brake: 0, docked: false, frozen: false, temp: 18 },
    'TR-2': { x: 22, y: 8, dir: -1, speed: delayed ? 0.18 : 1.9, state: 'RUN', pax: TRAM2_PASSENGERS, brake: 0, docked: false, frozen: false, temp: 18, crossed: false, stranded: false }
  };

  // People: 20 agents with walking routes (waypoint lists).
  var people = [];
  var routes = [
    // market stall row -> the sheltered heart of the market (the warm room)
    [{ x: 4.6, y: 6.0 }, { x: 5.6, y: 6.3 }, { x: 6.4, y: 6.1 }],
    // west houses -> market through the west gate
    [{ x: 2.8, y: 3.0 }, { x: 3.6, y: 5.4 }, { x: 5.0, y: 6.2 }],
    // east district -> east platform, waits for the lift or the crossing
    [{ x: 19.0, y: 5.0 }, { x: 16.0, y: 6.6 }, { x: 14.2, y: 7.6 }],
    // east -> west over the ravine bridge (needs BR-1 still spanning)
    [{ x: 15.4, y: 7.4 }, { x: 13.2, y: 7.9 }, { x: 11.0, y: 7.9 }, { x: 8.6, y: 7.0 }, { x: 6.8, y: 6.2 }]
  ];
  var routeKinds = ['market', 'house', 'east', 'cross'];
  for (var i = 0; i < 20; i++) {
    var ri = i % 4;
    var rt = routes[ri];
    people.push({
      id: 'P-' + (i + 1), x: rt[0].x, y: rt[0].y, route: rt, idx: 0,
      speed: 0.9 + rng() * 0.5, state: 'SHOP', wait: 0, temp: 18,
      exposed: false, sheltered: false, kind: routeKinds[ri], bob: rng() * 6.28
    });
  }

  var sim = {
    mode: delayed ? 'delayed' : 'normal',
    t: 0, finished: false, outcome: null,
    modules: modules, gantry: gantry, lift: lift, trams: trams, people: people,
    rng: rng,
    bridgeSpanning: true, bridgeFoldTime: T.BRIDGE,
    cold: { frontX: 30, temp: -38, arrived: false },
    shelter: { interiorTemp: 18, sealedFrac: 0, breach: 0, seamTime: null, power: 100 },
    decisions: { strategy: null, divertTime: null, liftCommands: [] },
    metrics: { sheltered: 0, exposed: 0, tramPaxSheltered: 0, tramPaxExposed: 0, liftTrips: 0, seamTime: null, breach: 0, interiorTemp: 18 },
    events: [],
    signals: { SIG1: 'G', SIG2: 'G' }, // G green, R red
    crossings: { gate: 0 }, // 0 open, 1 closed
    marketOpen: true, shutters: 0, windowLights: 0,
    selected: null
  };

  log(sim, 0, 'Ordinary day. Market open, trams running.');
  if (delayed) log(sim, 0, 'TR-2 delayed on the ravine line. Bridge fold still scheduled at t=30.');
  return sim;
}

function log(sim, t, msg) { sim.events.push({ t: Math.round(t * 10) / 10, msg: msg }); }

/* ---------- helpers ---------- */
function bridgeUp(sim) { return !sim.bridgeSpanning; }
function moduleDocked(sim, id) { return sim.modules[id].docked; }
function dockedCount(sim) {
  var n = 0, ids = ['BR-1', 'RP-1', 'RP-2', 'RP-3', 'RP-4', 'CD-1', 'CD-2', 'CD-3'];
  for (var i = 0; i < ids.length; i++) if (sim.modules[ids[i]].docked) n++;
  return n;
}
function moveToward(obj, tx, ty, tz, speed, dt) {
  var dx = tx - obj.x, dy = ty - obj.y, dz = (tz || 0) - (obj.z || 0);
  var d = Math.sqrt(dx * dx + dy * dy + dz * dz);
  if (d < 0.08) return true;
  var step = Math.min(d, speed * dt);
  obj.x += (dx / d) * step; obj.y += (dy / d) * step; obj.z = (obj.z || 0) + (dz / d) * step;
  return false;
}

/* ---------- strategy / decisions ---------- */
function chooseStrategy(sim, s) {
  if (sim.decisions.strategy) return false;
  sim.decisions.strategy = s;
  sim.decisions.divertTime = sim.t;
  if (s === 'wait') {
    // Hold the bridge until TR-2 has crossed (or t=65, then fold anyway).
    sim.bridgeFoldTime = 65;
    log(sim, sim.t, 'DECISION: WAIT — bridge fold held for TR-2. Seam will close late.');
  } else if (s === 'early') {
    // Fold ahead of schedule: the crane is free, so the rib starts travelling sooner.
    // The tram is still east of the ravine, so the crossing is gone before it arrives.
    sim.bridgeFoldTime = 24;
    log(sim, sim.t, 'DECISION: FOLD EARLY — bridge lifts at t=24, before TR-2 reaches the ravine.');
  } else if (s === 'lift') {
    sim.bridgeFoldTime = T.BRIDGE;
    sim.lift.mission = 'rescue';
    sim.lift.missionStep = 'toTram';
    log(sim, sim.t, 'DECISION: DIVERT VIA FREIGHT LIFT — FL-1 tasked to TR-2 platform. Rescue depends on lift position, load and timing.');
  }
  return true;
}

/* Manual lift commands (each checks real preconditions). Returns true if accepted. */
function liftCommand(sim, cmd) {
  var L = sim.lift, T2 = sim.trams['TR-2'];
  sim.decisions.liftCommands.push({ t: sim.t, cmd: cmd });
  if (cmd === 'toTram') {
    if (L.carrying === 'freight') { log(sim, sim.t, 'FL-1 cannot go to tram: still carrying freight. Finish delivery first.'); return false; }
    if (L.mission === 'rescue') { log(sim, sim.t, 'FL-1 already tasked to tram.'); return false; }
    L.mission = 'rescue'; L.missionStep = 'toTram';
    log(sim, sim.t, 'FL-1 ordered to TR-2 platform.');
    return true;
  }
  if (cmd === 'load') {
    if (Math.abs(L.x - LIFT_EAST) > 0.6) { log(sim, sim.t, 'LOAD refused: lift not at tram platform.'); return false; }
    if (!T2.docked && Math.abs(T2.x - LIFT_EAST) > 1.2) { log(sim, sim.t, 'LOAD refused: TR-2 not docked at platform.'); return false; }
    if (L.carrying === 'freight') { log(sim, sim.t, 'LOAD refused: lift still loaded with freight.'); return false; }
    L.missionStep = 'loading'; L.timer = 0;
    log(sim, sim.t, 'Loading TR-2 passengers onto FL-1 (12 pax).');
    return true;
  }
  if (cmd === 'traverse') {
    if (L.carrying !== 'passengers') { log(sim, sim.t, 'TRAVERSE refused: no passengers loaded.'); return false; }
    if (L.load > LIFT_CAPACITY) { log(sim, sim.t, 'TRAVERSE refused: overloaded (' + L.load + '/' + LIFT_CAPACITY + ').'); return false; }
    L.missionStep = 'traversing';
    log(sim, sim.t, 'FL-1 traversing ravine with ' + L.load + ' passengers.');
    return true;
  }
  if (cmd === 'unload') {
    if (Math.abs(L.x - LIFT_WEST) > 0.6) { log(sim, sim.t, 'UNLOAD refused: lift not at shelter side.'); return false; }
    if (L.carrying !== 'passengers') { log(sim, sim.t, 'UNLOAD refused: nothing to unload.'); return false; }
    L.missionStep = 'unloading'; L.timer = 0;
    log(sim, sim.t, 'Unloading passengers into west shelter.');
    return true;
  }
  return false;
}

/* ---------- per-system updates ---------- */
function updateTrams(sim, dt) {
  var T1 = sim.trams['TR-1'], T2 = sim.trams['TR-2'];
  // TR-1: runs west loop, docks west at t=25.
  if (T1.state === 'RUN') {
    T1.x += T1.dir * T1.speed * dt;
    if (T1.x > 9) T1.dir = -1; if (T1.x < 3) T1.dir = 1;
    if (sim.t >= 25) { T1.state = 'DOCK'; }
  } else if (T1.state === 'DOCK') {
    if (moveToward(T1, 5, 8, 0, 2.0, dt)) { T1.state = 'DOCKED'; T1.docked = true; T1.pax = 0; log(sim, sim.t, 'TR-1 docked west. 6 passengers to shelter.'); sim.metrics.tramPaxSheltered += 6; }
  }
  // TR-2
  if (T2.state === 'RUN') {
    var atBridge = (T2.x < 13.6 && T2.x > 10.4);
    var blocked = atBridge && !sim.bridgeSpanning;
    if (blocked) {
      T2.state = 'HELD'; T2.brake = 1; T2.stranded = true;
      sim.signals.SIG2 = 'R';
      log(sim, sim.t, 'TR-2 held at ravine: bridge no longer spanning. Brake shoes on, SIG-2 red.');
    } else {
      T2.brake = 0;
      T2.x += T2.dir * T2.speed * dt;
      if (T2.x <= 10.4 && !T2.crossed) {
        T2.crossed = true; T2.speed = 1.9; // hurries after crossing
        log(sim, sim.t, 'TR-2 crossed the ravine.');
        if (sim.decisions.strategy === 'wait') sim.bridgeFoldTime = sim.t;
      }
      if (T2.x <= 5.4) { T2.state = 'DOCK'; }
      if (T2.x < 2) T2.x = 2;
    }
  } else if (T2.state === 'HELD') {
    T2.brake = 1;
    if (sim.bridgeSpanning) { T2.state = 'RUN'; T2.brake = 0; sim.signals.SIG2 = 'G'; }
    // If lift rescue picks passengers up, tram empties (handled in lift update).
  } else if (T2.state === 'DOCK') {
    if (moveToward(T2, 5, 8, 0, 2.0, dt)) {
      T2.state = 'DOCKED'; T2.docked = true;
      if (T2.pax > 0) { sim.metrics.tramPaxSheltered += T2.pax; log(sim, sim.t, 'TR-2 docked west. ' + T2.pax + ' passengers sheltered.'); T2.pax = 0; }
    }
  }
  // Tram temperature / freezing
  [T1, T2].forEach(function (tr) {
    var inCold = sim.cold.frontX < tr.x + 2 && sim.t > T.COLD;
    if (inCold && !tr.docked) { tr.temp = Math.max(-30, tr.temp - dt * 2.5); if (tr.temp < -12 && !tr.frozen) { tr.frozen = true; log(sim, sim.t, 'A tram froze in the cold front.'); } }
    else if (tr.docked) tr.temp = 18;
  });
}

function updatePeople(sim, dt) {
  sim.people.forEach(function (p) {
    if (p.sheltered || p.exposed) return;
    // Market closes at DAY_END: shoppers start walking.
    if (p.state === 'SHOP' && sim.t >= T.DAY_END) { p.state = 'WALK'; }
    if (p.state !== 'WALK') return;
    var wp = p.route[p.idx];
    if (!wp) { p.sheltered = true; p.state = 'SHELTER'; return; }
    // Bridge check: segment crossing ravine needs spanning bridge.
    var crosses = (p.x < RAVINE_X && wp.x > RAVINE_X) || (p.x > RAVINE_X && wp.x < RAVINE_X);
    if (crosses && !sim.bridgeSpanning) {
      p.state = 'WAIT'; p.wait = 0;
      return;
    }
    if (moveToward(p, wp.x, wp.y, 0, p.speed, dt)) { p.idx++; if (p.idx >= p.route.length) { p.sheltered = true; p.state = 'SHELTER'; } }
  });
  // Waiting people: if bridge returns (never) or cold arrives, they shelter in place (exposed if cold hits).
  sim.people.forEach(function (p) {
    if (p.state === 'WAIT') {
      p.wait += dt;
      if (sim.cold.frontX < p.x + 2 && sim.t > T.COLD) {
        p.temp = Math.max(-30, p.temp - dt * 3);
        if (p.temp < -10 && !p.exposed) { p.exposed = true; log(sim, sim.t, p.id + ' exposed at the ravine in the cold front.'); }
      }
    } else if (!p.sheltered && !p.exposed) {
      var inCold = sim.cold.frontX < p.x + 2 && sim.t > T.COLD;
      if (inCold) { p.temp = Math.max(-30, p.temp - dt * 3); if (p.temp < -10) { p.exposed = true; log(sim, sim.t, p.id + ' caught by the cold front.'); } }
    }
  });
}

function updateGantry(sim, dt) {
  var G = sim.gantry;
  G.brake = (G.state === 'MOVING_TO' || G.state === 'MOVING_WITH' || G.state === 'TROLLEY') ? 0 : 1;
  // Fetch order: stall roofs first, then chimney ducts (fold order).
  if (G.queue.length === 0) {
    var order = ['RP-1', 'RP-2', 'RP-3', 'RP-4', 'CD-1', 'CD-2', 'CD-3'];
    for (var i = 0; i < order.length; i++) {
      var m = sim.modules[order[i]];
      if (m.state === 'HOME' && sim.t >= T.DAY_END + 2 + i * 5.4) G.queue.push(order[i]);

    }
  }
  var REACH = { girderZ: 6.9, top: 6.4, hookGap: 1.15 };
  G.girderZ = REACH.girderZ;

  if (G.state === 'IDLE' && G.queue.length > 0) {
    var id = G.queue[0], mod = sim.modules[id];
    if (mod.state === 'HOME') {
      G.carrying = id; G.targetX = mod.home.y; G.targetJib = mod.home.x;
      mod.state = 'PENDING'; G.state = 'TRAVEL_EMPTY';
      log(sim, sim.t, 'GN-1 travelling to ' + id + ' (' + mod.load + ').');
    } else G.queue.shift();
  }

  function move2(ax, ay, bx, by, sp) {
    var dx = bx - ax, dy = by - ay, d = Math.sqrt(dx * dx + dy * dy);
    if (d < 0.02) return true;
    var step = Math.min(d, sp * dt);
    ax += dx / d * step; ay += dy / d * step;
    G.x = ax; G.jib = ay;
    return d - step < 0.02;
  }

  if (G.state === 'TRAVEL_EMPTY') {
    if (move2(G.x, G.jib, G.targetX, G.targetJib, 3.4)) G.state = 'LOWERING';
  } else if (G.state === 'LOWERING') {
    var target = sim.modules[G.carrying].home.z + REACH.hookGap;
    G.hookZ = Math.max(target, G.hookZ - dt * 2.8);
    if (G.hookZ <= target + 0.03) G.state = 'ATTACH';
  } else if (G.state === 'ATTACH') {
    var m2 = sim.modules[G.carrying];
    m2.attachedTo = 'gantry'; m2.state = 'RIGGING';
    G.state = 'LIFTING';
    log(sim, sim.t, 'GN-1 hooked ' + G.carrying + ' (' + m2.load + ').');
  } else if (G.state === 'LIFTING') {
    G.hookZ = Math.min(REACH.top, G.hookZ + dt * 2.8);
    var m3 = sim.modules[G.carrying];
    m3.pos.x = G.jib; m3.pos.y = G.x; m3.pos.z = G.hookZ - REACH.hookGap;
    m3.state = 'LIFTING';
    if (G.hookZ >= REACH.top - 0.03) {
      G.state = 'MOVING_WITH'; G.targetX = m3.dock.y; G.targetJib = m3.dock.x;
      m3.state = 'TRAVELING';
    }
  } else if (G.state === 'MOVING_WITH') {
    if (move2(G.x, G.jib, G.targetX, G.targetJib, 2.6)) G.state = 'LOWER2';
    var m4 = sim.modules[G.carrying];
    m4.pos.x = G.jib; m4.pos.y = G.x; m4.pos.z = G.hookZ - REACH.hookGap;
  } else if (G.state === 'LOWER2') {
    var dest = sim.modules[G.carrying].dock.z + REACH.hookGap;
    G.hookZ = Math.max(dest, G.hookZ - dt * 2.8);
    var m5 = sim.modules[G.carrying];
    m5.pos.x = G.jib; m5.pos.y = G.x; m5.pos.z = G.hookZ - REACH.hookGap;
    m5.state = 'DOCKING';
    if (G.hookZ <= dest + 0.03) G.state = 'RELEASE';
  } else if (G.state === 'RELEASE') {
    var m6 = sim.modules[G.carrying];
    m6.attachedTo = null;
    m6.pos.x = m6.dock.x; m6.pos.y = m6.dock.y; m6.pos.z = m6.dock.z;
    m6.state = 'DOCKED'; m6.docked = true;
    log(sim, sim.t, G.carrying + ' docked at ' + m6.dest + '.');
    G.queue.shift(); G.carrying = null; G.state = 'IDLE'; G.hookZ = REACH.top;
  }
  // Cable tension + counterweight from load and motion.
  var loadT = G.carrying ? 0.5 : 0.1;
  G.cableTension = clamp(loadT + (G.state === 'MOVING_WITH' ? 0.3 : 0) + (G.state === 'LIFTING' ? 0.2 : 0), 0, 1);
  G.counterZ = clamp(1 - G.cableTension, 0, 1) * 2;
}

function updateBridge(sim, dt) {
  var B = sim.modules['BR-1'];
  B.brake = (B.state === 'UNPINNING') ? 1 : 0;
  if (B.state === 'SPANNING' && sim.t >= sim.bridgeFoldTime) {
    // WAIT strategy: only fold once TR-2 crossed (or forced at 65).
    if (sim.decisions.strategy === 'wait' && !sim.trams['TR-2'].crossed && sim.t < 65) return;
    B.state = 'UNPINNING'; B.timer = 0;
    sim.signals.SIG2 = 'R'; sim.crossings.gate = 1;
    log(sim, sim.t, 'BR-1 unpinning: pins PIN-1..4 out, brake shoes set, crossing gates closed.');
  } else if (B.state === 'UNPINNING') {
    B.timer += dt;
    if (B.timer >= 3) { B.state = 'LIFTING'; B.unpinned = true; sim.bridgeSpanning = false; log(sim, sim.t, 'BR-1 unpinned. Ravine crossing closed.'); }
  } else if (B.state === 'LIFTING') {
    B.pos.z = Math.min(4.5, B.pos.z + dt * 1.5);
    if (B.pos.z >= 4.5) { B.state = 'TRAVELING'; }
  } else if (B.state === 'TRAVELING') {
    if (moveToward(B.pos, B.dock.x, B.dock.y, 4.5, 2.2, dt)) B.state = 'ROTATING';
  } else if (B.state === 'ROTATING') {
    B.pos.rot = Math.min(90, B.pos.rot + dt * 45);
    B.pos.z = lerp(B.pos.z, B.dock.z, dt * 2);
    if (B.pos.rot >= 90) { B.state = 'DOCKING'; }
  } else if (B.state === 'DOCKING') {
    if (moveToward(B.pos, B.dock.x, B.dock.y, B.dock.z, 1.6, dt)) {
      B.state = 'RIB'; B.docked = true;
      log(sim, sim.t, 'BR-1 docked as shell rib RIB-A (north wall).');
    }
  }
}

function updateLift(sim, dt) {
  var L = sim.lift, T2 = sim.trams['TR-2'];
  L.brake = (L.state === 'TRAVERSE' || L.state === 'MOVE') ? 0 : 1;
  L.cableTension = clamp((L.carrying === 'passengers' ? 0.85 : (L.carrying === 'freight' ? 0.5 : 0.15)) + (L.state === 'TRAVERSE' ? 0.15 : 0), 0, 1);
  L.counterZ = clamp(1 - L.cableTension, 0, 1) * 2;

  if (L.mission === 'freight') {
    // Freight loop: carry crates west<->east until t=36 or rescue tasked.
    L.carrying = 'freight'; L.load = 0;
    if (L.state === 'IDLE') L.state = 'MOVE';
    var dest = (L.x < 12) ? LIFT_EAST : LIFT_WEST;
    if (moveToward(L, dest, 8, 0, 1.8, dt)) { L.state = 'IDLE'; L.timer += dt; if (L.timer > 2) { L.timer = 0; L.trips++; } }
    if (sim.t >= 36 && sim.decisions.strategy !== 'lift') { L.mission = 'standby'; L.carrying = null; log(sim, sim.t, 'FL-1 freight window closed. Lift standing by at west platform.'); }
    return;
  }
  if (L.mission === 'standby') {
    if (L.state !== 'IDLE') { if (moveToward(L, LIFT_WEST, 8, 0, 1.8, dt)) L.state = 'IDLE'; }
    L.carrying = null; L.load = 0;
    return;
  }
  // Rescue mission steps (auto-advance when preconditions met; manual commands also work).
  if (L.missionStep === 'toTram') {
    if (L.carrying === 'freight') { L.missionStep = 'finishFreight'; log(sim, sim.t, 'FL-1 finishing freight delivery before rescue (load constraint).'); }
    else {
      L.state = 'MOVE';
      if (moveToward(L, LIFT_EAST, 8, 0, 1.8, dt)) {
        // Dock tram at platform if held nearby.
        if (T2.state === 'HELD' && Math.abs(T2.x - LIFT_EAST) < 2.5) { T2.x = LIFT_EAST; T2.state = 'DOCKED'; T2.docked = true; }
        L.missionStep = 'loading'; L.timer = 0;
        log(sim, sim.t, 'FL-1 at TR-2 platform. Loading passengers…');
      }
    }
  } else if (L.missionStep === 'finishFreight') {
    var d2 = (L.x < 12) ? LIFT_WEST : LIFT_EAST;
    if (moveToward(L, d2, 8, 0, 1.8, dt)) { L.carrying = null; L.missionStep = 'toTram'; log(sim, sim.t, 'Freight delivered. FL-1 free for rescue.'); }
  } else if (L.missionStep === 'loading') {
    // Causal: passengers can only board when TR-2 is actually at the platform.
    if (Math.abs(T2.x - LIFT_EAST) > 1.6 && T2.state !== 'DOCKED') { L.timer = 0; return; }
    L.timer += dt;
    if (L.timer >= 4) {
      if (T2.pax <= 0) { L.missionStep = 'toTram'; log(sim, sim.t, 'No passengers left on TR-2.'); }
      else {
        L.carrying = 'passengers'; L.load = Math.min(T2.pax, LIFT_CAPACITY);
        T2.pax -= L.load;
        log(sim, sim.t, 'FL-1 loaded ' + L.load + ' passengers (' + L.load + '/' + LIFT_CAPACITY + ').');
        L.missionStep = 'traversing';
      }
    }
  } else if (L.missionStep === 'traversing') {
    L.state = 'TRAVERSE';
    if (moveToward(L, LIFT_WEST, 8, 0, 1.8, dt)) { L.missionStep = 'unloading'; L.timer = 0; L.state = 'IDLE'; }
  } else if (L.missionStep === 'unloading') {
    L.timer += dt;
    if (L.timer >= 3) {
      // Timing check: if cold front already reached the platform, passengers were exposed in transit.
      var late = sim.cold.frontX < LIFT_EAST + 2 && sim.t > T.COLD;
      if (late) {
        sim.metrics.tramPaxExposed += L.load;
        log(sim, sim.t, 'FL-1 arrived after the cold front: ' + L.load + ' passengers exposed in transit.');
        L.rescueFailed = true;
      } else {
        sim.metrics.tramPaxSheltered += L.load;
        L.rescued += L.load;
        log(sim, sim.t, 'FL-1 delivered ' + L.load + ' passengers to west shelter.');
        L.rescueDone = true;
      }
      L.carrying = null; L.load = 0; L.trips++;
      // Second trip if passengers remain.
      if (T2.pax > 0 && sim.t < T.COLD + 6) { L.missionStep = 'toTram'; }
      else { L.mission = 'standby'; L.missionStep = 'done'; }
    }
  }
}

function updateColdShelter(sim, dt) {
  // Cold front sweeps west from t=55.
  if (sim.t >= T.COLD) {
    sim.cold.frontX = Math.max(-2, 30 - (sim.t - T.COLD) * 1.1);
    sim.cold.arrived = sim.cold.frontX < 14;
  }
  var dc = dockedCount(sim);
  sim.shelter.sealedFrac = dc / 8;
  // Seam closes when all 8 docked; breach if seam after t=72.
  if (dc === 8 && sim.shelter.seamTime === null) {
    sim.shelter.seamTime = sim.t;
    sim.metrics.seamTime = sim.t;
    log(sim, sim.t, 'LAST SEAM CLOSED. Thermal shell complete.');
  }
  // A late seam keeps leaking: the breach widens the longer the gap stays open.
  var seamLate = sim.shelter.seamTime !== null && sim.shelter.seamTime > T.SEAM;
  sim.shelter.breach = seamLate ? clamp((sim.shelter.seamTime - T.SEAM) * 4 + (sim.t - sim.shelter.seamTime) * 1.3, 8, 60) : 0;
  sim.metrics.breach = sim.shelter.breach;
  // Interior temp: sealed modules + power vs cold leak.
  var sealedBonus = sim.shelter.sealedFrac * 6;
  var leak = (sim.t > T.COLD ? (1 - sim.shelter.sealedFrac) * 14 : 0) + sim.shelter.breach * 0.85;
  sim.shelter.interiorTemp = clamp(18 + sealedBonus - leak, -30, 24);
  sim.metrics.interiorTemp = Math.round(sim.shelter.interiorTemp * 10) / 10;
  // Power: moving machinery draws; sealed shell conserves.
  var moving = 0;
  if (sim.gantry.state !== 'IDLE') moving += 25;
  if (sim.lift.state === 'MOVE' || sim.lift.state === 'TRAVERSE') moving += 20;
  if (sim.modules['BR-1'].state !== 'SPANNING' && sim.modules['BR-1'].state !== 'RIB') moving += 15;
  sim.shelter.power = clamp(100 - moving + sim.shelter.sealedFrac * 10, 20, 100);
  // Dusk visuals
  sim.shutters = clamp((sim.t - T.DAY_END) / 8, 0, 1);
  sim.windowLights = clamp((sim.t - T.DAY_END) / 10, 0, 1);
  sim.marketOpen = sim.t < T.DAY_END;
  // Signals: SIG-1 green while trams run, red when docked/fold.
  sim.signals.SIG1 = (sim.t < 25) ? 'G' : 'R';
  if (sim.bridgeSpanning && sim.t < sim.bridgeFoldTime) sim.signals.SIG2 = 'G';
  else if (!sim.trams['TR-2'].crossed && sim.t >= sim.bridgeFoldTime) sim.signals.SIG2 = 'R';
}

function finalize(sim) {
  // Count people.
  var sh = 0, ex = 0;
  sim.people.forEach(function (p) {
    if (p.sheltered) sh++;
    else if (p.exposed) ex++;
    else {
      // Still walking at end: sheltered if inside sealed area (x<10), else exposed.
      if (p.x < 10) sh++; else ex++;
    }
  });
  // Tram passengers not yet sheltered/exposed: judge by tram position & cold.
  var T2 = sim.trams['TR-2'];
  if (T2.pax > 0) {
    if (T2.docked && T2.x < 10) sim.metrics.tramPaxSheltered += T2.pax;
    else sim.metrics.tramPaxExposed += T2.pax;
    T2.pax = 0;
  }
  sim.metrics.sheltered = sh + sim.metrics.tramPaxSheltered;
  sim.metrics.exposed = ex + sim.metrics.tramPaxExposed;
  sim.metrics.liftTrips = sim.lift.trips;
  sim.finished = true;

  var m = sim.metrics;
  var label;
  var dc = 0;
  Object.keys(sim.modules).forEach(function (k) { if (sim.modules[k].docked && sim.modules[k].kind !== 'gantry' && sim.modules[k].kind !== 'lift') dc++; });
  m.docked = dc;
  sim.shelter.seamTime = sim.shelter.seamTime;
  if (dc < 8) m.breach = Math.max(m.breach, (8 - dc) * 9);
  if (sim.decisions.strategy === 'lift' && sim.lift.rescueDone && m.exposed === 0 && m.breach < 10 && dc === 8)
    label = 'LIFT RESCUE — passengers carried across, shell sealed on time';
  else if (m.exposed === 0 && m.breach < 10 && dc === 8) label = 'SEALED WARM — full fold, everyone sheltered';
  else if (sim.decisions.strategy === 'wait' || (m.breach >= 10 && m.exposed === 0))
    label = 'WAITED — tram saved, but the seam closed late and the cold got in';
  else if (sim.decisions.strategy === 'early') label = 'FOLDED EARLY — tram stranded east in the cold';
  else if (sim.lift.rescueFailed) label = 'LIFT TOO LATE — passengers exposed in transit';
  else if (m.exposed > 0) label = 'PARTIAL SHELTER — some exposed to the cold front';
  else if (dc < 8) label = 'INCOMPLETE SHELL — ' + dc + ' of 8 modules docked';
  else label = 'SEALED — fold complete';
  sim.outcome = { label: label, metrics: JSON.parse(JSON.stringify(m)) };
  log(sim, sim.t, 'OUTCOME: ' + label + ' | sheltered ' + m.sheltered + ' exposed ' + m.exposed + ' seam ' + (m.seamTime ? m.seamTime.toFixed(1) : '—') + ' breach ' + m.breach.toFixed(0) + '% interior ' + m.interiorTemp + '°C');
}

/* ---------- main step ---------- */
function step(sim) {
  if (sim.finished) return;
  sim.t += DT;
  updateTrams(sim, DT);
  updatePeople(sim, DT);
  updateGantry(sim, DT);
  updateBridge(sim, DT);
  updateLift(sim, DT);
  updateColdShelter(sim, DT);
  if (sim.t >= T.END) finalize(sim);
}

function hash(sim) {
  var s = sim.t.toFixed(2) + '|' + sim.trams['TR-2'].x.toFixed(3) + '|' + sim.lift.x.toFixed(3) +
    '|' + sim.modules['BR-1'].state + '|' + dockedCount(sim) + '|' +
    sim.people.map(function (p) { return p.x.toFixed(2) + ',' + p.y.toFixed(2) + ',' + p.state; }).join(';') +
    '|' + sim.metrics.sheltered + ',' + sim.metrics.exposed;
  var h = 0;
  for (var i = 0; i < s.length; i++) { h = ((h << 5) - h + s.charCodeAt(i)) | 0; }
  return (h >>> 0).toString(16);
}

global.CitySim = { create: create, step: step, hash: hash, chooseStrategy: chooseStrategy, liftCommand: liftCommand, DT: DT, T: T, LIFT_CAPACITY: LIFT_CAPACITY };
if (typeof module !== 'undefined' && module.exports) module.exports = global.CitySim;
})(typeof window !== 'undefined' ? window : globalThis);
