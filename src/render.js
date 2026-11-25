/* THE CITY THAT FOLDS AT DUSK — isometric Canvas 2D renderer.
   Everything is drawn from simulation state: part positions, cable tension,
   brake shoes, window lights, snow, steam. No sprite swaps; a module is drawn
   at its real x/y/z/rot every frame. */
(function (global) {
'use strict';

var TW = 40, TH = 20;                 // tile size at scale 1
var WX = 24, WY = 14;                 // world size in tiles
var GIRDER_Z = 7.4;                   // gantry girder height
var NIGHT = 0;                        // 0 = daylight, 1 = full night grade
function grade(c) {
  if (NIGHT <= 0.001) return c;
  return mix(c, '#101a2c', NIGHT * 0.50);
}

function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
function cl01(v) { return v < 0 ? 0 : (v > 1 ? 1 : v); }
function lerp(a, b, f) { return a + (b - a) * f; }
function hex(h) {
  if (h.charAt(0) === '#') {
    if (h.length === 4) h = '#' + h[1] + h[1] + h[2] + h[2] + h[3] + h[3];
    return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  }
  var m = h.match(/[\d.]+/g) || [0, 0, 0];
  return [+m[0], +m[1], +m[2]];
}
function mix(a, b, f) {
  var ca = hex(a), cb = hex(b);
  return 'rgb(' + Math.round(lerp(ca[0], cb[0], f)) + ',' + Math.round(lerp(ca[1], cb[1], f)) + ',' + Math.round(lerp(ca[2], cb[2], f)) + ')';
}
function rgba(c, a) { var x = hex(c); return 'rgba(' + x[0] + ',' + x[1] + ',' + x[2] + ',' + a + ')'; }
function shade(c, amt) {
  var x = hex(c);
  return 'rgb(' + Math.round(clamp(x[0] + amt, 0, 255)) + ',' + Math.round(clamp(x[1] + amt, 0, 255)) + ',' + Math.round(clamp(x[2] + amt, 0, 255)) + ')';
}

/* Deterministic per-object pseudo random (window lights, snow seeds). */
function hash2(a, b) {
  var h = (a * 374761393 + b * 668265263) | 0;
  h = (h ^ (h >> 13)) * 1274126177 | 0;
  return ((h ^ (h >> 16)) >>> 0) / 4294967295;
}

function createRenderer(canvas) {
  var ctx = canvas.getContext('2d');
  var W = 0, H = 0, DPR = 1;
  var cam = { s: 1, ox: 0, oy: 0, zoom: 1, zoomT: 1, shake: 0 };
  var particles = [], hit = [], lastT = 0, tAcc = 0;
  var selPulse = 0;

  function resize() {
    DPR = Math.min((global.devicePixelRatio || 1), 2);
    var rect = canvas.getBoundingClientRect ? canvas.getBoundingClientRect() : { width: 1024, height: 640 };
    W = Math.max(320, rect.width || 1024);
    H = Math.max(260, rect.height || 640);
    canvas.width = Math.floor(W * DPR);
    canvas.height = Math.floor(H * DPR);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    var worldW = (WX + WY) * TW / 2 + 0.8 * TW;
    var worldH = (WX + WY) * TH / 2 + 11 * TH;
    cam.s = Math.min(W / worldW, H / worldH) * 1.06;
    // centre the occupied diamond (plus building height) in the viewport
    cam.ox = W * 0.5 - (5 * TW / 2) * cam.s;
    cam.oy = H * 0.50 - (13.0 * TH / 2) * cam.s;
  }
  if (global.addEventListener) global.addEventListener('resize', resize);
  resize();

  function iso(x, y, z) {
    var k = cam.s * cam.zoom;
    return {
      sx: cam.ox + ((x - y) * TW / 2) * k,
      sy: cam.oy + ((x + y) * TH / 2 - (z || 0) * TH) * k
    };
  }
  function S(v) { return v * cam.s * cam.zoom; }

  /* ---------------- primitives ---------------- */
  function poly(pts, fill, stroke, lw) {
    ctx.beginPath();
    ctx.moveTo(pts[0].sx, pts[0].sy);
    for (var i = 1; i < pts.length; i++) ctx.lineTo(pts[i].sx, pts[i].sy);
    ctx.closePath();
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw || 1; ctx.stroke(); }
  }
  function rectFill(a, b, c, d, fill, stroke) { poly([a, b, c, d], fill, stroke); }

  /* Box with 3 lit faces. (x,y,z) is the min corner in world tiles. */
  function box(x, y, z, w, d, h, col, opts) {
    opts = opts || {};
    col = opts.lit ? col : grade(col);
    var top = shade(col, opts.topUp === undefined ? 26 : opts.topUp);
    var fR = shade(col, opts.rightDown === undefined ? -16 : opts.rightDown);
    var fL = shade(col, opts.leftDown === undefined ? -34 : opts.leftDown);
    var p1 = iso(x, y, z), p2 = iso(x + w, y, z), p3 = iso(x + w, y + d, z), p4 = iso(x, y + d, z);
    var q1 = iso(x, y, z + h), q2 = iso(x + w, y, z + h), q3 = iso(x + w, y + d, z + h), q4 = iso(x, y + d, z + h);
    var edge = opts.edge === undefined ? 'rgba(30,26,24,0.55)' : opts.edge;
    // +y face (left-front), +x face (right-front), roof
    if (h > 0) {
      rectFill(p4, p3, q3, q4, fL, edge);
      rectFill(p3, p2, q2, q3, fR, edge);
    }
    rectFill(q1, q2, q3, q4, top, edge);
    if (opts.after) opts.after({ p1: p1, p2: p2, p3: p3, p4: p4, q1: q1, q2: q2, q3: q3, q4: q4 });
    return { p1: p1, p2: p2, p3: p3, p4: p4, q1: q1, q2: q2, q3: q3, q4: q4 };
  }

  /* Pitched roof: ridge along x. */
  function pitchedRoof(x, y, z, w, d, rise, col, rot) {
    rot = rot || 0;
    col = grade(col);
    var cx = x + w / 2, cy = y + d / 2;
    var r = rot * Math.PI / 180;
    function P(px, py, pz) { // rotate around centre in plan
      var dx = px - cx, dy = py - cy;
      var rx = dx * Math.cos(r) - dy * Math.sin(r);
      var ry = dx * Math.sin(r) + dy * Math.cos(r);
      return iso(cx + rx, cy + ry, pz);
    }
    var a = P(x, y, z), b = P(x + w, y, z), c = P(x + w, y + d, z), e = P(x, y + d, z);
    var r1 = P(x, cy, z + rise), r2 = P(x + w, cy, z + rise);
    poly([a, b, r2, r1], shade(col, 10), 'rgba(25,22,20,0.6)');   // far slope
    poly([e, c, r2, r1], shade(col, -22), 'rgba(25,22,20,0.6)');  // near slope
    // ridge cap
    ctx.beginPath(); ctx.moveTo(r1.sx, r1.sy); ctx.lineTo(r2.sx, r2.sy);
    ctx.strokeStyle = 'rgba(40,34,30,0.7)'; ctx.lineWidth = Math.max(1, S(0.09)); ctx.stroke();
  }

  function line2(a, b, col, w, dash) {
    ctx.beginPath(); ctx.moveTo(a.sx, a.sy); ctx.lineTo(b.sx, b.sy);
    ctx.strokeStyle = col; ctx.lineWidth = w || 1;
    if (dash) ctx.setLineDash(dash);
    ctx.stroke(); ctx.setLineDash([]);
  }
  function circle(p, r, fill, stroke) {
    ctx.beginPath(); ctx.arc(p.sx, p.sy, r, 0, 6.2832);
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 1; ctx.stroke(); }
  }
  function glow(p, r, col, a) {
    var g = ctx.createRadialGradient(p.sx, p.sy, 0, p.sx, p.sy, r);
    g.addColorStop(0, rgba(col, a));
    g.addColorStop(1, rgba(col, 0));
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(p.sx, p.sy, r, 0, 6.2832); ctx.fill();
  }
  function text(str, p, col, size, align, weight) {
    ctx.font = (weight || '600') + ' ' + (size || 10) + 'px ui-sans-serif, system-ui, sans-serif';
    ctx.textAlign = align || 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(12,16,24,0.55)';
    ctx.fillText(str, p.sx + 1, p.sy + 1);
    ctx.fillStyle = col;
    ctx.fillText(str, p.sx, p.sy);
  }
  function chip(str, p, col, bg) {
    ctx.font = '600 10px ui-sans-serif, system-ui, sans-serif';
    var w = ctx.measureText(str).width + 12;
    var h = 16;
    ctx.fillStyle = bg || 'rgba(12,16,24,0.78)';
    var x = p.sx - w / 2, y = p.sy - h / 2, r = 5;
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = col; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(str, p.sx, p.sy + 0.5);
  }

  /* ---------------- particles ---------------- */
  function spawn(kind, x, y, z, vx, vy, vz, life) {
    if (particles.length > 420) return;
    particles.push({ kind: kind, x: x, y: y, z: z, vx: vx, vy: vy, vz: vz, life: life || 1, age: 0 });
  }
  function updateParticles(dt) {
    for (var i = particles.length - 1; i >= 0; i--) {
      var p = particles[i];
      p.age += dt;
      if (p.age > p.life) { particles.splice(i, 1); continue; }
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      if (p.kind === 'steam') { p.vz += dt * 0.6; p.vx *= 0.99; p.vy *= 0.99; }
      if (p.kind === 'spark') { p.vz -= dt * 4; }
      if (p.kind === 'snow') { p.vx += Math.sin((p.age + p.y) * 3) * dt * 0.6; }
      if (p.z < 0) { p.z = 0; p.vz *= -0.3; }
    }
  }
  function drawParticles() {
    for (var i = 0; i < particles.length; i++) {
      var p = particles[i], a = 1 - p.age / p.life, q = iso(p.x, p.y, p.z);
      if (p.kind === 'snow') {
        ctx.fillStyle = 'rgba(232,244,255,' + (0.25 + a * 0.6) + ')';
        ctx.fillRect(q.sx, q.sy, Math.max(1, S(0.05)), Math.max(1, S(0.05)));
      } else if (p.kind === 'steam') {
        var r = S(0.12 + p.age * 0.5);
        ctx.fillStyle = 'rgba(226,232,240,' + (a * 0.34) + ')';
        ctx.beginPath(); ctx.arc(q.sx, q.sy, r, 0, 6.2832); ctx.fill();
      } else if (p.kind === 'spark') {
        ctx.fillStyle = 'rgba(255,206,120,' + a + ')';
        ctx.fillRect(q.sx, q.sy, S(0.05), S(0.05));
      }
    }
  }

  /* ---------------- static city description ---------------- */
  // Buildings: x, y, w, d, h, wall colour, roof style, roof colour, id
  var BUILDINGS = [
    // north row (the market's back wall)
    { x: 0.6, y: 0.15, w: 2.5, d: 1.5, h: 3.4, wall: '#8d7f6d', rise: 1.0, roof: '#8c4a3c', tag: 'N1' },
    { x: 3.4, y: 0.15, w: 3.1, d: 1.5, h: 4.6, wall: '#9a8b78', rise: 1.2, roof: '#4f5566', tag: 'N2' },
    { x: 6.8, y: 0.15, w: 2.6, d: 1.5, h: 3.9, wall: '#8a7d6c', rise: 1.0, roof: '#8c4a3c', tag: 'N3' },
    // west row
    { x: 0.4, y: 2.0, w: 1.7, d: 2.2, h: 2.7, wall: '#94836f', rise: 0.9, roof: '#55596a', tag: 'W1' },
    { x: 0.4, y: 4.6, w: 1.7, d: 2.0, h: 3.1, wall: '#9d8d79', rise: 0.9, roof: '#8c4a3c', tag: 'W2' },
    // east row (thin, between market and ravine)
    { x: 9.7, y: 2.0, w: 1.0, d: 2.1, h: 3.6, wall: '#8f816e', rise: 0.7, roof: '#55596a', tag: 'E1' },
    { x: 9.7, y: 4.5, w: 1.0, d: 2.1, h: 2.9, wall: '#9a8874', rise: 0.7, roof: '#8c4a3c', tag: 'E2' },
    // south of the tram line
    { x: 1.2, y: 10.3, w: 2.6, d: 2.0, h: 2.3, wall: '#8b7c69', rise: 0.8, roof: '#8c4a3c', tag: 'S1' },
    { x: 5.4, y: 10.6, w: 2.8, d: 2.2, h: 2.6, wall: '#9c8b75', rise: 0.9, roof: '#4f5566', tag: 'S2' },
    { x: 8.8, y: 10.4, w: 2.2, d: 1.9, h: 2.2, wall: '#90826f', rise: 0.7, roof: '#8c4a3c', tag: 'S3' },
    // east district across the ravine
    { x: 15.2, y: 1.6, w: 2.6, d: 2.2, h: 3.6, wall: '#8e806c', rise: 1.0, roof: '#4f5566', tag: 'F1' },
    { x: 18.6, y: 1.9, w: 2.2, d: 2.0, h: 2.9, wall: '#9b8a76', rise: 0.9, roof: '#8c4a3c', tag: 'F2' },
    { x: 15.6, y: 5.4, w: 2.3, d: 2.4, h: 4.4, wall: '#93836f', rise: 1.1, roof: '#8c4a3c', tag: 'F3' },
    { x: 18.9, y: 5.8, w: 2.0, d: 2.0, h: 3.2, wall: '#9c8c78', rise: 0.9, roof: '#55596a', tag: 'F4' },
    { x: 15.2, y: 11.2, w: 2.2, d: 1.6, h: 1.7, wall: '#8c7e6b', rise: 0.6, roof: '#4f5566', tag: 'F5' },
    { x: 21.4, y: 2.6, w: 1.8, d: 2.6, h: 3.1, wall: '#918374', rise: 0.9, roof: '#55596a', tag: 'F7' },
    { x: 21.6, y: 7.0, w: 1.7, d: 2.4, h: 3.5, wall: '#96866f', rise: 0.9, roof: '#8c4a3c', tag: 'F8' }
  ];

  function windowGrid(b, dark, lit, warm) {
    // Draw a few windows on the two visible faces; lights come on after dusk.
    var rows = Math.max(1, Math.floor(b.h / 1.15));
    var cols = Math.max(2, Math.floor(b.w / 0.55));
    for (var r = 0; r < rows; r++) {
      for (var c = 0; c < cols; c++) {
        var litOn = warm > 0 && hash2(b.tag.charCodeAt(0) + b.tag.charCodeAt(1) * 7, r * 11 + c * 3) < warm;
        var wz = 0.55 + r * 1.15;
        var hh = Math.min(0.32, b.h - wz - 0.2);
        if (hh <= 0.05) continue;
        // +x face windows
        var wx = b.x + b.w, wy = b.y + 0.22 + c * (b.d - 0.44) / cols;
        var a = iso(wx, wy, wz), bb = iso(wx, wy + (b.d - 0.44) / cols * 0.62, wz);
        var cc = iso(wx, wy + (b.d - 0.44) / cols * 0.62, wz + hh), dd = iso(wx, wy, wz + hh);
        rectFill(a, bb, cc, dd, litOn ? (lit ? '#ffce7a' : dark) : (lit ? 'rgba(255,206,122,0.10)' : dark));
      }
    }
  }

  function drawBuilding(b, warm, snow) {
    var wall = grade(snow ? mix(b.wall, '#dfe9f2', 0.28) : b.wall);
    box(b.x, b.y, 0, b.w, b.d, b.h, wall, { topUp: 0 });
    // windows on both front faces
    var rows = Math.max(1, Math.floor(b.h / 1.2));
    for (var r = 0; r < rows; r++) {
      var wz = 0.7 + r * 1.2;
      if (wz + 0.3 > b.h) continue;
      var n = Math.max(2, Math.floor(b.w / 0.62));
      for (var c = 0; c < n; c++) {
        var on = warm > 0 && hash2(b.tag.charCodeAt(0) * 131 + b.tag.charCodeAt(1), r * 17 + c * 5) < warm * 1.15;
        var wx = b.x + 0.28 + c * (b.w - 0.56) / n;
        var q1 = iso(wx, b.y + b.d, wz), q2 = iso(wx + 0.22, b.y + b.d, wz);
        var q3 = iso(wx + 0.22, b.y + b.d, wz + 0.34), q4 = iso(wx, b.y + b.d, wz + 0.34);
        rectFill(q1, q2, q3, q4, on ? '#ffcb72' : '#3a3d47', on ? 'rgba(255,220,150,0.5)' : 'rgba(20,22,28,0.4)');
        if (on) { var mid = iso(wx + 0.11, b.y + b.d, wz + 0.17); glow(mid, S(0.7), '#ffce7a', 0.18); }
      }
      var m = Math.max(2, Math.floor(b.w / 0.62));
      for (var c2 = 0; c2 < m; c2++) {
        var on2 = warm > 0 && hash2(b.tag.charCodeAt(0) * 71 + b.tag.charCodeAt(1), r * 23 + c2 * 7 + 3) < warm * 1.15;
        var wy2 = b.y + 0.3 + c2 * (b.d - 0.6) / m;
        var p1 = iso(b.x + b.w, wy2, wz), p2 = iso(b.x + b.w, wy2 + 0.22, wz);
        var p3 = iso(b.x + b.w, wy2 + 0.22, wz + 0.34), p4 = iso(b.x + b.w, wy2, wz + 0.34);
        rectFill(p1, p2, p3, p4, on2 ? '#ffcb72' : '#3a3d47');
        if (on2) { var mid2 = iso(b.x + b.w, wy2 + 0.11, wz + 0.17); glow(mid2, S(0.6), '#ffce7a', 0.15); }
      }
    }
    // roof
    pitchedRoof(b.x, b.y, b.h, b.w, b.d, b.rise, b.roof);
    // door
    var d1 = iso(b.x + b.w * 0.35, b.y + b.d, 0), d2 = iso(b.x + b.w * 0.35 + 0.4, b.y + b.d, 0);
    var d3 = iso(b.x + b.w * 0.35 + 0.4, b.y + b.d, 0.9), d4 = iso(b.x + b.w * 0.35, b.y + b.d, 0.9);
    rectFill(d1, d2, d3, d4, '#3b3229');
  }

  /* ---------------- ground ---------------- */
  function islandPath() {
    var a = iso(0, 0, 0), b = iso(WX, 0, 0), c = iso(WX, WY, 0), d = iso(0, WY, 0);
    ctx.beginPath();
    ctx.moveTo(a.sx, a.sy); ctx.lineTo(b.sx, b.sy); ctx.lineTo(c.sx, c.sy); ctx.lineTo(d.sx, d.sy);
    ctx.closePath();
  }
  function drawGround(sim) {
    ctx.save();
    islandPath(); ctx.clip();
    var cold = sim.t > 52 ? cl01((sim.t - 52) / 20) : 0;
    var snowA = cold * 0.72 + (sim.shelter.seamTime !== null ? 0.18 : 0);
    for (var gx = 0; gx < WX; gx++) {
      for (var gy = 0; gy < WY; gy++) {
        if (gx >= 11 && gx <= 12 && gy >= 5) continue; // ravine
        var p = iso(gx, gy, 0), p2 = iso(gx + 1, gy, 0), p3 = iso(gx + 1, gy + 1, 0), p4 = iso(gx, gy + 1, 0);
        var inMarket = (gx >= 2 && gx <= 9 && gy >= 2 && gy <= 7);
        var onTrack = (gy === 8);
        var base;
        if (inMarket) base = ((gx + gy) % 2) ? '#c0a279' : '#b7976f';
        else if (onTrack) base = '#8d8578';
        else base = ((gx + gy) % 2) ? '#6e7d58' : '#677650';
        if (snowA > 0 && !inMarket) base = mix(base, '#cfdde9', snowA * 0.55);
        else if (snowA > 0) base = mix(base, '#cfdae4', snowA * 0.18);
        if (!inMarket) base = grade(base); else base = mix(base, '#0f1626', NIGHT * 0.28);
        rectFill(p, p2, p3, p4, base, 'rgba(60,54,46,0.10)');
      }
    }
    // ravine: a cut trench with layered rock and a dark floor
    var x0 = 11, x1 = 13, DEPTH = 3.4, RY0 = 5.2;
    // floor
    var fa = iso(x0, RY0, -DEPTH), fb = iso(x1, RY0, -DEPTH), fc = iso(x1, WY, -DEPTH), fd = iso(x0, WY, -DEPTH);
    rectFill(fa, fb, fc, fd, '#181410');
    // near (west) wall — lit face
    var wg = ctx.createLinearGradient(0, iso(x0, RY0, 0).sy, 0, iso(x0, RY0, -DEPTH).sy);
    wg.addColorStop(0, '#7a6a52'); wg.addColorStop(0.35, '#4a3f31'); wg.addColorStop(1, '#141009');
    var a = iso(x0, RY0, 0), b = iso(x0, WY, 0), c = iso(x0, WY, -DEPTH), d = iso(x0, RY0, -DEPTH);
    poly([a, b, c, d], wg, 'rgba(16,12,9,0.8)', 1);
    // far (east) wall — darker
    var a2 = iso(x1, RY0, 0), b2 = iso(x1, WY, 0), c2 = iso(x1, WY, -DEPTH), d2 = iso(x1, RY0, -DEPTH);
    var eg = ctx.createLinearGradient(0, iso(x1, RY0, 0).sy, 0, iso(x1, RY0, -DEPTH).sy);
    eg.addColorStop(0, '#4a3f31'); eg.addColorStop(1, '#0e0b07');
    poly([a2, b2, c2, d2], eg, 'rgba(16,12,9,0.8)', 1);
    // strata: a few soft bands on each wall
    for (var k = 1; k <= 4; k++) {
      var zz = -k * (DEPTH / 5);
      ctx.globalAlpha = 0.16;
      line2(iso(x0, RY0, zz), iso(x0, WY, zz), '#c8b294', Math.max(1, S(0.05)));
      line2(iso(x1, RY0, zz), iso(x1, WY, zz), '#8a7458', 1);
      ctx.globalAlpha = 1;
    }
    // rock outcrops on the rim so the edge is not a clean cut
    for (var ro = 0; ro < 9; ro++) {
      var ry = RY0 + 0.4 + ro * 0.95;
      var rp = iso(x0 + 0.05, ry, 0.02);
      ctx.beginPath();
      ctx.moveTo(rp.sx - S(0.18), rp.sy);
      ctx.lineTo(rp.sx, rp.sy - S(0.16));
      ctx.lineTo(rp.sx + S(0.18), rp.sy);
      ctx.closePath();
      ctx.fillStyle = 'rgba(126,110,90,0.85)'; ctx.fill();
    }
    // rim edges
    line2(iso(x0, RY0, 0), iso(x0, WY, 0), 'rgba(210,196,170,0.35)', Math.max(1, S(0.05)));
    line2(iso(x1, RY0, 0), iso(x1, WY, 0), 'rgba(210,196,170,0.25)', Math.max(1, S(0.05)));
    // canyon head: a rock face closing the north end
    var ha = iso(x0, RY0, 0), hb = iso(x1, RY0, 0), hc = iso(x1, RY0, -DEPTH), hd = iso(x0, RY0, -DEPTH);
    poly([ha, hb, hc, hd], '#4a3f31', 'rgba(20,16,12,0.7)', 1);
    // mist in the trench
    var mc = iso(12, 9.5, -1.6);
    glow(mc, S(3.4), '#9fc6de', 0.10);
    // stone abutments at the crossing
    [[x0 - 0.5, 7.3], [x1, 7.3]].forEach(function (ab) {
      box(ab[0], ab[1], -0.6, 0.5, 1.5, 0.75, '#7c7263', { topUp: 14 });
    });
    // service struts across the trench (they carry the lift cables)
    for (var sy2 = 6.0; sy2 < WY; sy2 += 3.5) {
      line2(iso(x0, sy2, 0), iso(x1, sy2, -0.1), 'rgba(140,128,110,0.45)', Math.max(1, S(0.05)));
    }
    // tram track (ballast, sleepers, rails) both sides of the ravine
    var track = '#8d8578';
    for (var seg = 0; seg < 2; seg++) {
      var sx0 = seg === 0 ? 0 : 13, sx1 = seg === 0 ? 11 : 24;
      for (var tx = sx0; tx < sx1; tx += 0.5) {
        var sa = iso(tx, 7.65, 0.02), sb = iso(tx + 0.16, 7.65, 0.02);
        var sc = iso(tx + 0.16, 8.35, 0.02), sd = iso(tx, 8.35, 0.02);
        rectFill(sa, sb, sc, sd, 'rgba(70,62,52,0.35)');
      }
      line2(iso(sx0, 7.78, 0.06), iso(sx1, 7.78, 0.06), '#b9b3a6', Math.max(1, S(0.06)));
      line2(iso(sx0, 8.22, 0.06), iso(sx1, 8.22, 0.06), '#b9b3a6', Math.max(1, S(0.06)));
    }
    ctx.restore();
    // island rim: a thin rock edge so the block reads as a cut-away model
    var e = [iso(0, 0, 0), iso(WX, 0, 0), iso(WX, WY, 0), iso(0, WY, 0)];
    var e2 = [iso(0, 0, -1.1), iso(WX, 0, -1.1), iso(WX, WY, -1.1), iso(0, WY, -1.1)];
    poly([e[2], e[3], e2[3], e2[2]], '#3d3529', 'rgba(20,16,12,0.6)');
    poly([e[1], e[2], e2[2], e2[1]], '#332c22', 'rgba(20,16,12,0.6)');
    poly([e[0], e[1], e2[1], e2[0]], '#2b251d', 'rgba(20,16,12,0.6)');
    poly([e[3], e[0], e2[0], e2[3]], '#2b251d', 'rgba(20,16,12,0.6)');
  }

  /* ---------------- market: stalls, canopies sit on posts ---------------- */
  function drawMarketBase(sim, warm) {
    // low stone kerb around the courtyard
    var k = 2.5, k2 = 9.5, ky = 1.9, ky2 = 7.2;
    box(k, ky, 0, 0.28, ky2 - ky, 0.34, '#8d8172', { topUp: 12 });
    box(k2 - 0.28, ky, 0, 0.28, ky2 - ky, 0.34, '#8d8172', { topUp: 12 });
    box(k, ky2 - 0.28, 0, k2 - k, 0.28, 0.34, '#8d8172', { topUp: 12 });

    // four stall rows under the awnings (x = 2.65, 4.55, 6.45, 8.35)
    var rowsX = [2.65, 4.55, 6.45, 8.35];
    for (var i = 0; i < rowsX.length; i++) {
      var x = rowsX[i];
      // counter
      box(x - 0.3, 1.9, 0, 0.6, 2.9, 0.72, '#a8763f', { topUp: 20, lit: true });
      // goods on the counter
      for (var g = 0; g < 5; g++) {
        var gy = 2.15 + g * 0.6;
        var col = ['#c8563f', '#d9a13c', '#7f9b52', '#b9703c', '#8c5a8f'][g % 5];
        var gp = iso(x, gy, 0.72);
        circle(gp, S(0.13), col);
      }
      // awning posts (empty sockets once the panel has gone)
      var mod = sim.modules['RP-' + (i + 1)];
      var gone = mod && mod.pos.z > 3.0;
      for (var pp = 0; pp < 2; pp++) {
        var py = 1.75 + pp * 3.1;
        line2(iso(x - 0.38, py, 0), iso(x - 0.38, py, 2.5), '#5a5145', Math.max(1.4, S(0.09)));
        line2(iso(x + 0.38, py, 0), iso(x + 0.38, py, 2.5), '#4a423a', Math.max(1.4, S(0.09)));
        if (gone) {
          circle(iso(x - 0.38, py, 2.5), Math.max(1.5, S(0.06)), '#241f19');
          circle(iso(x + 0.38, py, 2.5), Math.max(1.5, S(0.06)), '#241f19');
        }
      }
      // hanging bulbs under the awning while it is still there
      if (!gone) {
        for (var lb = 0; lb < 3; lb++) {
          var lp = iso(x, 2.3 + lb * 0.9, 2.25);
          if (warm > 0.05) glow(lp, S(0.7), '#ffcf82', 0.4 * warm);
          circle(lp, Math.max(1.2, S(0.055)), warm > 0.05 ? '#ffe3a8' : '#8d8271');
        }
      }
    }
    // open market well in the south half of the plaza
    var wc = iso(6.0, 6.05, 0);
    ctx.beginPath(); ctx.ellipse(wc.sx, wc.sy, S(0.85), S(0.42), 0, 0, 6.2832);
    ctx.fillStyle = '#7d7364'; ctx.fill();
    ctx.strokeStyle = 'rgba(40,34,26,0.6)'; ctx.lineWidth = Math.max(1, S(0.05)); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(wc.sx, wc.sy - S(0.05), S(0.62), S(0.3), 0, 0, 6.2832);
    ctx.fillStyle = '#3b4a52'; ctx.fill();
    // crates + barrels around the plaza
    var props = [[3.4, 6.4], [3.9, 6.6], [7.9, 6.5], [8.3, 6.1], [5.0, 5.5], [7.1, 6.7]];
    props.forEach(function (pp, i) {
      if (i % 2 === 0) box(pp[0], pp[1], 0, 0.4, 0.4, 0.38, '#9a7a4e', { topUp: 18 });
      else {
        var bp = iso(pp[0], pp[1], 0.22);
        ctx.beginPath(); ctx.ellipse(bp.sx, bp.sy, S(0.2), S(0.12), 0, 0, 6.2832);
        ctx.fillStyle = '#8a5f3c'; ctx.fill();
        ctx.strokeStyle = 'rgba(50,36,24,0.7)'; ctx.stroke();
      }
    });
    // lanterns on poles
    for (var L = 0; L < 6; L++) {
      var lx = 3.0 + L * 1.15, ly = 7.0;
      var bp = iso(lx, ly, 0), tp = iso(lx, ly, 2.1);
      line2(bp, tp, '#4d463c', Math.max(1, S(0.05)));
      var on = warm > 0.15;
      if (on) {
        glow(tp, S(1.5), '#ffb85e', 0.35);
        circle(tp, Math.max(2, S(0.12)), '#ffd98a');
      } else circle(tp, Math.max(1.6, S(0.1)), '#6b6252');
    }
    // bunting between stalls during the day
    if (sim.marketOpen) {
      for (var bb2 = 0; bb2 < 3; bb2++) {
        var xa = 2.6 + bb2 * 1.8, xb = xa + 1.8;
        var sag = 0.25;
        ctx.beginPath();
        var s0 = iso(xa, 3.2, 2.4), s1 = iso(xb, 3.2, 2.4), s2 = iso((xa + xb) / 2, 3.2, 2.4 - sag);
        ctx.moveTo(s0.sx, s0.sy); ctx.quadraticCurveTo(s2.sx, s2.sy + S(0.2), s1.sx, s1.sy);
        ctx.strokeStyle = 'rgba(210,180,120,0.6)'; ctx.lineWidth = 1; ctx.stroke();
        for (var fl = 0; fl < 5; fl++) {
          var f = fl / 5 + 0.1;
          var fx = lerp(s0.sx, s1.sx, f), fy = lerp(s0.sy, s1.sy, f) + S(0.22) * Math.sin(Math.PI * f);
          ctx.fillStyle = ['#d9563f', '#e5b23c', '#5d8fbe'][fl % 3];
          ctx.beginPath(); ctx.moveTo(fx, fy); ctx.lineTo(fx + 3, fy); ctx.lineTo(fx + 1.5, fy + 5); ctx.closePath(); ctx.fill();
        }
      }
    }
  }

  /* ---------------- modules ---------------- */
  function drawPanel(sim, m, selected) {
    var p = m.pos;
    var cut = m.docked;
    if (cut) ctx.globalAlpha = 0.62;
    var swinging = m.attachedTo === 'gantry';
    var sway = swinging ? Math.sin(sim.t * 2.6 + m.pos.x) * 0.045 : 0;
    var rot = p.rot + sway * 12;
    var x = p.x - 0.78, y = p.y - 1.8, z = p.z;
    var w = 1.56, d = 3.6, th = 0.22;
    var tints = { 'RP-1': '#b4763f', 'RP-2': '#a96e3b', 'RP-3': '#bd8047', 'RP-4': '#a26839' };
    var col = tints[m.id] || '#b4763f';
    ctx.save();
    // rigging cables to the hook when carried
    if (swinging) {
      var hook = iso(sim.gantry.jib, sim.gantry.x, sim.gantry.hookZ);
      [[x, y], [x + w, y], [x, y + d], [x + w, y + d]].forEach(function (c) {
        var cp = iso(c[0], c[1], z + th);
        line2(cp, hook, 'rgba(230,226,210,0.65)', Math.max(1, S(0.03)));
      });
    }
    box(x, y, z, w, d, th, col, { topUp: 34, rightDown: -10, leftDown: -30, edge: 'rgba(28,18,12,0.8)' });
    // under-truss so the panel reads as structure, not a slab
    var tz = z - 0.16;
    line2(iso(x, y + 0.2, tz), iso(x + w, y + 0.2, tz), 'rgba(58,40,26,0.8)', Math.max(1, S(0.05)));
    line2(iso(x, y + d - 0.2, tz), iso(x + w, y + d - 0.2, tz), 'rgba(58,40,26,0.8)', Math.max(1, S(0.05)));
    for (var tq = 0; tq < 4; tq++) {
      var tx = x + w * (tq + 0.5) / 4;
      line2(iso(tx, y + 0.2, tz), iso(tx, y + d - 0.2, tz), 'rgba(58,40,26,0.45)', 1);
    }
    // coffer ribs on the top face
    for (var i = 1; i < 4; i++) {
      var ry = y + d * i / 4;
      line2(iso(x, ry, z + th + 0.01), iso(x + w, ry, z + th + 0.01), 'rgba(70,45,26,0.35)', 1);
    }
    line2(iso(x + w / 2, y, z + th + 0.01), iso(x + w / 2, y + d, z + th + 0.01), 'rgba(70,45,26,0.3)', 1);
    // underside glow when docked (the ceiling that keeps heat in)
    if (m.docked) {
      var uc = iso(x + w / 2, y + d / 2, z - 0.05);
      glow(uc, S(1.9), '#ffb45e', 0.16);
    }
    ctx.restore();
    if (selected) selectBox(x, y, z, w, d, th + 0.1);
    ctx.globalAlpha = 1;
  }

  function drawDuct(sim, m, selected) {
    var p = m.pos, r = 0.42, h = 3.3;
    var base = iso(p.x, p.y, p.z), top = iso(p.x, p.y, p.z + h);
    // cylinder: two ellipses + sides
    var rx = S(r * 1.35), ry = S(r * 0.68);
    ctx.beginPath();
    ctx.moveTo(base.sx - rx, base.sy);
    ctx.lineTo(top.sx - rx, top.sy);
    ctx.ellipse(top.sx, top.sy, rx, ry, 0, 0, 6.2832);
    ctx.lineTo(base.sx + rx, base.sy);
    ctx.ellipse(base.sx, base.sy, rx, ry, 0, Math.PI, 0, true);
    var g = ctx.createLinearGradient(base.sx - rx, 0, base.sx + rx, 0);
    g.addColorStop(0, '#7d4a34'); g.addColorStop(0.45, '#a8613f'); g.addColorStop(1, '#5e3626');
    ctx.fillStyle = g; ctx.fill();
    ctx.strokeStyle = 'rgba(30,22,18,0.6)'; ctx.lineWidth = 1; ctx.stroke();
    // brick bands
    for (var i = 1; i < 6; i++) {
      var bz = p.z + h * i / 6;
      var bp = iso(p.x, p.y, bz);
      ctx.beginPath(); ctx.ellipse(bp.sx, bp.sy, rx, ry, 0, 0, Math.PI); ctx.strokeStyle = 'rgba(45,30,22,0.35)'; ctx.stroke();
    }
    // flue mouth
    ctx.beginPath(); ctx.ellipse(top.sx, top.sy, rx * 0.62, ry * 0.62, 0, 0, 6.2832);
    ctx.fillStyle = m.docked ? '#2a1a14' : '#140d0a'; ctx.fill();
    if (m.attachedTo === 'gantry') {
      var hook = iso(sim.gantry.jib, sim.gantry.x, sim.gantry.hookZ);
      line2(top, hook, 'rgba(230,226,210,0.7)', Math.max(1, S(0.03)));
    }
    // docked: vent louvres open in the wall
    if (m.docked) {
      for (var v = 0; v < 3; v++) {
        var vz = 1.2 + v * 0.5;
        var vv = iso(p.x + 0.42, p.y, vz);
        line2({ sx: vv.sx, sy: vv.sy }, { sx: vv.sx + S(0.5), sy: vv.sy - S(0.14) }, 'rgba(240,200,140,0.75)', Math.max(1, S(0.05)));
      }
    }
    if (selected) selectCircle(p, 1.1);
  }

  function drawBridge(sim, m, selected) {
    var B = m, p = B.pos;
    var len = 4.0, wid = 1.1;
    // deck spans x (before rotation) — rotated 90° it runs along y in plan
    var rot = p.rot || 0;
    var rad = rot * Math.PI / 180;
    var cx = p.x, cy = p.y;
    function P(ox, oy, oz) {
      var dx = ox, dy = oy;
      var rx = dx * Math.cos(rad) - dy * Math.sin(rad);
      var ry = dx * Math.sin(rad) + dy * Math.cos(rad);
      return iso(cx + rx, cy + ry, p.z + oz);
    }
    var hw = len / 2, hd = wid / 2;
    // deck slab
    poly([P(-hw, -hd, 0), P(hw, -hd, 0), P(hw, hd, 0), P(-hw, hd, 0)], '#6d747f', 'rgba(25,22,20,0.6)');
    poly([P(-hw, -hd, 0.28), P(hw, -hd, 0.28), P(hw, hd, 0.28), P(-hw, hd, 0.28)], '#8a929c', 'rgba(25,22,20,0.6)');
    // kerb rails along the deck
    [-hd, hd].forEach(function (sy) {
      line2(P(-hw, sy, 0.34), P(hw, sy, 0.34), '#c9ced8', Math.max(1.2, S(0.05)));
    });
    // end bearings
    [-hw, hw].forEach(function (sx) {
      poly([P(sx - 0.12, -hd, 0), P(sx + 0.12, -hd, 0), P(sx + 0.12, hd, 0), P(sx - 0.12, hd, 0)], '#545b66', 'rgba(20,18,16,0.7)');
    });
    // side trusses
    [-hd, hd].forEach(function (sy) {
      var pts = [P(-hw, sy, 0), P(hw, sy, 0), P(hw, sy, 1.25), P(-hw, sy, 1.25)];
      poly(pts, 'rgba(0,0,0,0)', 'rgba(70,78,90,0.95)', Math.max(1, S(0.06)));
      for (var i = 0; i <= 8; i++) {
        var fx = -hw + len * i / 8;
        var a = P(fx, sy, 0.05), b = P(fx, sy, 1.2);
        line2(a, b, 'rgba(96,104,116,0.85)', Math.max(1, S(0.035)));
        if (i < 8) {
          var n1 = P(fx, sy, 1.2), n2 = P(fx + len / 8, sy, 0.05);
          line2(n1, n2, 'rgba(96,104,116,0.5)', Math.max(1, S(0.025)));
        }
      }
    });
    // pins retracting during unpinning
    if (B.state === 'UNPINNING') {
      var f = clamp(B.timer / 3, 0, 1);
      for (var i2 = 0; i2 < 4; i2++) {
        var px = -hw + 0.35 + i2 * (len - 0.7) / 3;
        var pp = P(px, 0, -0.02 - f * 0.5);
        circle(pp, Math.max(1.5, S(0.07)), '#d8b070');
      }
    }
    // travel carriage + cables when moving
    if (B.state === 'LIFTING' || B.state === 'TRAVELING' || B.state === 'ROTATING') {
      var top = P(0, 0, 1.3);
      line2(P(-hw + 0.4, 0, 1.25), top, 'rgba(235,230,215,0.7)', Math.max(1, S(0.03)));
      line2(P(hw - 0.4, 0, 1.25), top, 'rgba(235,230,215,0.7)', Math.max(1, S(0.03)));
      // brake shoes glow as it holds
      glow(P(0, 0, 0.1), S(0.9), '#ff9a4a', 0.25);
    }
    if (B.docked) {
      // as a rib it now carries the shell wall
      var mid = P(0, 0, 0.7);
      glow(mid, S(1.6), '#ffb45e', 0.12);
    }
    if (selected) selectBox(cx - 2, cy - 0.6, p.z, 4, 1.2, 1.4);
  }

  function selectBox(x, y, z, w, d, h) {
    var a = iso(x, y, z + h), b = iso(x + w, y, z + h), c = iso(x + w, y + d, z + h), e = iso(x, y + d, z + h);
    var a2 = iso(x, y, z), b2 = iso(x + w, y, z), c2 = iso(x + w, y + d, z), e2 = iso(x, y + d, z);
    ctx.save();
    ctx.setLineDash([5, 4]);
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(255,214,106,' + (0.55 + 0.35 * Math.sin(selPulse)) + ')';
    poly([a, b, c, e], null, ctx.strokeStyle, 2);
    [a, b, c, e].forEach(function (p, i) {
      var q = [a2, b2, c2, e2][i];
      ctx.beginPath(); ctx.moveTo(p.sx, p.sy); ctx.lineTo(q.sx, q.sy); ctx.stroke();
    });
    ctx.restore();
  }
  function selectCircle(p, r) {
    ctx.save();
    ctx.setLineDash([5, 4]);
    ctx.strokeStyle = 'rgba(255,214,106,' + (0.55 + 0.35 * Math.sin(selPulse)) + ')';
    ctx.lineWidth = 2;
    var q = iso(p.x, p.y, 0);
    ctx.beginPath(); ctx.ellipse(q.sx, q.sy, S(r), S(r * 0.5), 0, 0, 6.2832); ctx.stroke();
    ctx.restore();
  }

  /* ---------------- gantry crane ---------------- */
  function drawGantry(sim, selected) {
    var G = sim.gantry;
    var zA = GIRDER_Z;
    var xA = G.railA, xB = G.railB, by = G.x;   // rails run in y at x=xA/xB; bridge sits at y=by
    // rails on the ground
    [-1, 1].forEach(function (side) {
      var x = side < 0 ? xA : xB;
      line2(iso(x, 0.4, 0.1), iso(x, WY - 0.6, 0.1), '#8e949c', Math.max(1, S(0.08)));
      for (var i = 0; i < 8; i++) {
        var yy = 0.8 + i * 1.6;
        line2(iso(x - 0.12, yy, 0.05), iso(x + 0.12, yy, 0.05), 'rgba(90,96,104,0.6)', 1);
      }
    });
    // two portal legs straddling the yard
    [xA, xB].forEach(function (x, side) {
      var foot = iso(x, by, 0), head = iso(x, by, zA);
      // base pad + bogies
      box(x - 0.42, by - 0.34, 0, 0.84, 0.68, 0.22, '#5a626c', { topUp: 8 });
      // twin posts
      line2(iso(x - 0.26, by, 0.2), { sx: head.sx - S(0.26), sy: head.sy }, '#586270', Math.max(2, S(0.11)));
      line2(iso(x + 0.26, by, 0.2), { sx: head.sx + S(0.26), sy: head.sy }, '#4c5563', Math.max(2, S(0.11)));
      // cross bracing
      var n = 7;
      for (var i = 1; i <= n; i++) {
        var z1 = zA * (i - 1) / n, z2 = zA * i / n;
        var a = iso(x, by, z1), b = iso(x, by, z2);
        line2({ sx: a.sx - S(0.26), sy: a.sy }, { sx: b.sx + S(0.26), sy: b.sy }, 'rgba(122,134,148,0.85)', 1);
        line2({ sx: a.sx + S(0.26), sy: a.sy }, { sx: b.sx - S(0.26), sy: b.sy }, 'rgba(122,134,148,0.85)', 1);
      }
      // brake shoe on the rail
      if (G.brake) {
        var bp = iso(x, by, 0.12);
        glow(bp, S(0.6), '#ff8a3c', 0.4);
        circle(bp, Math.max(1.5, S(0.06)), '#ffb066');
      }
    });
    // bridge girder: a deep truss running left-right across the view
    var ga = iso(xA, by, zA), gb = iso(xB, by, zA);
    var ga2 = iso(xA, by, zA - 0.75), gb2 = iso(xB, by, zA - 0.75);
    poly([ga, gb, gb2, ga2], 'rgba(132,142,156,0.96)', 'rgba(40,46,54,0.85)', 1.1);
    var ga3 = iso(xA, by, zA + 0.22), gb3 = iso(xB, by, zA + 0.22);
    poly([ga, gb, gb3, ga3], 'rgba(170,180,192,0.96)', 'rgba(40,46,54,0.85)', 1.1);
    var bays = 10;
    for (var i2 = 0; i2 <= bays; i2++) {
      var f = i2 / bays;
      var t1 = { sx: lerp(ga.sx, gb.sx, f), sy: lerp(ga.sy, gb.sy, f) };
      var t2 = { sx: lerp(ga2.sx, gb2.sx, f), sy: lerp(ga2.sy, gb2.sy, f) };
      line2(t1, t2, 'rgba(64,72,84,0.75)', 1);
      if (i2 < bays) {
        var f2 = (i2 + 1) / bays;
        line2(t1, { sx: lerp(ga2.sx, gb2.sx, f2), sy: lerp(ga2.sy, gb2.sy, f2) }, 'rgba(64,72,84,0.45)', 1);
      }
    }
    // trolley + hoist
    var tx = G.jib;
    var tp = iso(tx, by, zA - 0.5);
    box(tx - 0.42, by - 0.36, zA - 0.95, 0.84, 0.72, 0.42, '#c9822c', { topUp: 18, lit: true });
    // twin cables with tension sag
    var hook = iso(tx, by, G.hookZ);
    var sag = (1 - G.cableTension) * 0.45;
    ctx.beginPath();
    ctx.moveTo(tp.sx - S(0.24), tp.sy);
    ctx.quadraticCurveTo((tp.sx - S(0.24) + hook.sx) / 2 - S(sag), (tp.sy + hook.sy) / 2, hook.sx, hook.sy);
    ctx.moveTo(tp.sx + S(0.24), tp.sy);
    ctx.quadraticCurveTo((tp.sx + S(0.24) + hook.sx) / 2 + S(sag), (tp.sy + hook.sy) / 2, hook.sx, hook.sy);
    ctx.strokeStyle = 'rgba(228,232,240,0.9)'; ctx.lineWidth = Math.max(1, S(0.035)); ctx.stroke();
    // hook block + spreader bar
    box(tx - 0.15, by - 0.15, G.hookZ - 0.22, 0.3, 0.3, 0.22, '#c9ced6', { topUp: 20 });
    line2(iso(tx - 0.7, by, G.hookZ - 0.24), iso(tx + 0.7, by, G.hookZ - 0.24), '#aab2bc', Math.max(1.5, S(0.05)));
    // counterweight trolley rides opposite the load
    var cw = iso(xA + 0.9, by, zA - 0.55 - G.counterZ * 0.5);
    box(xA + 0.55, by - 0.2, zA - 0.7 - G.counterZ * 0.5, 0.7, 0.4, 0.5, '#6f7783', { topUp: 10 });
    if (selected) chip('GN-1 · ' + Math.round(G.cableTension * 100) + '% cable', iso(tx, by, zA + 0.7), '#ffd76a');
    hit.push({ id: 'GN-1', sx: tp.sx, sy: tp.sy, r: S(1.2) });
  }

  /* ---------------- ravine lift ---------------- */
  function drawLift(sim, selected) {
    var L = sim.lift;
    var westX = 10.2, eastX = 13.8, y = 8;
    // towers
    [[westX, '#5d6670'], [eastX, '#5d6670']].forEach(function (t) {
      var f = iso(t[0], y, -3.0), h = iso(t[0], y, 5.2);
      line2(f, h, t[1], Math.max(2, S(0.16)));
      for (var i = 1; i < 8; i++) {
        var z = -3 + (8.2 * i / 8);
        var p1 = iso(t[0], y - 0.35, z), p2 = iso(t[0], y + 0.35, z);
        line2(p1, p2, 'rgba(130,140,152,0.55)', 1);
      }
      var cap = iso(t[0], y, 5.3);
      box(t[0] - 0.3, y - 0.3, 5.2, 0.6, 0.6, 0.3, '#8e969f', { topUp: 20 });
    });
    // catenary cable
    var a = iso(westX, y, 5.2), b = iso(eastX, y, 5.2);
    var sag = 0.6 - L.cableTension * 0.35;
    ctx.beginPath(); ctx.moveTo(a.sx, a.sy);
    ctx.quadraticCurveTo((a.sx + b.sx) / 2, (a.sy + b.sy) / 2 + S(sag), b.sx, b.sy);
    ctx.strokeStyle = 'rgba(230,232,238,0.75)'; ctx.lineWidth = Math.max(1, S(0.04)); ctx.stroke();
    // carriage
    var cxp = L.x, cz = 0.15;
    var cab = iso(cxp, y, cz);
    box(cxp - 0.62, y - 0.55, cz, 1.24, 1.1, 1.05, '#b6803a', { topUp: 22 });
    // carriage glazing
    var g1 = iso(cxp - 0.5, y + 0.55, cz + 0.35), g2 = iso(cxp + 0.5, y + 0.55, cz + 0.35);
    var g3 = iso(cxp + 0.5, y + 0.55, cz + 0.85), g4 = iso(cxp - 0.5, y + 0.55, cz + 0.85);
    rectFill(g1, g2, g3, g4, L.carrying === 'passengers' ? 'rgba(255,206,122,0.9)' : 'rgba(120,150,170,0.5)');
    // hanger to cable
    var topCab = iso(cxp, y, cz + 1.05);
    var cableAt = { sx: topCab.sx, sy: lerp(a.sy, b.sy, (cxp - westX) / (eastX - westX)) + S(sag * 0.6) };
    line2(topCab, cableAt, 'rgba(235,238,244,0.8)', Math.max(1, S(0.035)));
    // counterweight on the west tower
    var cwz = 5.0 - L.counterZ * 1.6;
    box(westX - 0.9, y - 0.3, cwz, 0.45, 0.6, 0.8, '#7b838e', { topUp: 12 });
    // passengers riding
    if (L.carrying === 'passengers' && L.load > 0) {
      for (var i = 0; i < Math.min(4, L.load); i++) {
        var pp = iso(cxp - 0.4 + i * 0.25, y + 0.1, cz + 1.15);
        circle(pp, Math.max(1.5, S(0.07)), '#ffe1a8');
      }
    }
    if (L.brake) {
      var bp = iso(cxp, y, cz);
      glow(bp, S(0.7), '#ff9a4a', 0.2);
    }
    if (selected) chip('FL-1 · ' + L.carrying + ' · ' + L.missionStep, iso(cxp, y, cz + 1.6), '#ffd76a');
    hit.push({ id: 'FL-1', sx: cab.sx, sy: cab.sy, r: S(1.1) });
  }

  /* ---------------- trams ---------------- */
  function drawTram(sim, tr, id) {
    var x = tr.x, y = 8, z = 0.12;
    var len = 2.9, wid = 1.15;
    var moving = tr.state === 'RUN';
    // headlight cone
    if (tr.state !== 'DOCKED') {
      var hp = iso(x + tr.dir * len / 2, y, 0.7);
      glow(hp, S(1.6), '#ffe9b0', 0.35);
    }
    // body
    box(x - len / 2, y - wid / 2, z, len, wid, 1.15, '#b8483c', { topUp: 24 });
    // roof
    box(x - len / 2 + 0.12, y - wid / 2 + 0.1, z + 1.15, len - 0.24, wid - 0.2, 0.12, '#6d4c3a', { topUp: 16 });
    // window band on the near face
    var n = 5;
    for (var i = 0; i < n; i++) {
      var wx = x - len / 2 + 0.25 + i * (len - 0.5) / n;
      var a = iso(wx, y + wid / 2, z + 0.45), b = iso(wx + 0.34, y + wid / 2, z + 0.45);
      var c = iso(wx + 0.34, y + wid / 2, z + 0.95), d = iso(wx, y + wid / 2, z + 0.95);
      var lit = tr.pax > 0 || tr.state === 'DOCKED';
      rectFill(a, b, c, d, lit ? '#ffd98a' : '#5a6a74', 'rgba(30,24,20,0.5)');
    }
    // pantograph
    var px = x, pz = z + 1.27;
    var p1 = iso(px - 0.4, y, pz), p2 = iso(px, y, pz + 0.5), p3 = iso(px + 0.4, y, pz);
    ctx.beginPath(); ctx.moveTo(p1.sx, p1.sy); ctx.lineTo(p2.sx, p2.sy); ctx.lineTo(p3.sx, p3.sy);
    ctx.strokeStyle = '#4a5058'; ctx.lineWidth = Math.max(1, S(0.04)); ctx.stroke();
    line2(iso(0, y, pz + 0.52), iso(24, y, pz + 0.52), 'rgba(70,78,86,0.55)', 1);
    // wheels + brake glow
    for (var w = 0; w < 3; w++) {
      var wxp = x - 1.0 + w * 1.0;
      circle(iso(wxp, y + wid / 2, 0.02), Math.max(1.4, S(0.09)), '#2b2f36');
    }
    if (tr.brake > 0.5) {
      var bp = iso(x, y + wid / 2, 0.1);
      glow(bp, S(0.9), '#ff8a3c', 0.3);
    }
    if (tr.state === 'HELD') {
      chip('TR-2 HELD — signal red', iso(x, y, 2.0), '#ff9a9a', 'rgba(40,12,14,0.85)');
    }
    if (tr.frozen) {
      chip('frozen', iso(x, y, 1.9), '#bfe6ff');
    }
    if (moving) {
      for (var g = 0; g < 1; g++) {
        if (Math.abs(x - 12) < 1.2) spawn('spark', x, y, 1.5, (Math.random() - 0.5) * 0.4, 0, 0.8, 0.5);
      }
    }
    hit.push({ id: id, sx: iso(x, y, 0.6).sx, sy: iso(x, y, 0.6).sy, r: S(1.0) });
  }

  /* ---------------- people ---------------- */
  function drawPerson(sim, p) {
    var bob = Math.sin(sim.t * 7 + p.bob * 6) * 0.05;
    var z = 0.14 + Math.abs(bob);
    if (p.sheltered) {
      var wp = iso(p.x, p.y, z + 0.3);
      glow(wp, S(0.55), '#ffb060', 0.22);
    }
    var base = iso(p.x, p.y, 0);
    // shadow
    ctx.fillStyle = 'rgba(20,18,16,0.22)';
    ctx.beginPath(); ctx.ellipse(base.sx, base.sy, S(0.16), S(0.07), 0, 0, 6.2832); ctx.fill();
    var body = p.exposed ? '#bfe2f5' : (p.sheltered ? '#e2b06a' : (p.state === 'WAIT' ? '#d99a9a' : '#6d8fb8'));
    if (p.exposed) body = mix('#9fc6e0', '#dceaf5', 0.4);
    var top = iso(p.x, p.y, z + 0.42);
    // coat
    ctx.fillStyle = body;
    var w = S(0.15), h = S(0.46);
    ctx.fillRect(top.sx - w / 2, top.sy - h * 0.18, w, h);
    // head
    circle({ sx: top.sx, sy: top.sy - h * 0.5 }, Math.max(1.8, S(0.095)), p.exposed ? '#e6f2fb' : '#f0d3b0');
    if (p.state === 'WAIT') chip('!', { sx: top.sx, sy: top.sy - S(0.75) }, '#ff9a9a', 'rgba(40,14,14,0.8)');
  }

  /* ---------------- signals, gates, crossing ---------------- */
  function drawSignals(sim) {
    // signal masts either side of the ravine crossing
    [[9.6, 'SIG1'], [14.3, 'SIG2']].forEach(function (s) {
      var x = s[0], y = 7.2;
      var base = iso(x, y, 0), top = iso(x, y, 3.0);
      line2(base, top, '#3f444b', Math.max(1.4, S(0.07)));
      var col = sim.signals[s[1]] === 'G' ? '#5fd47a' : '#ef5f5f';
      var head = iso(x, y, 2.65);
      box(x - 0.14, y - 0.14, 2.5, 0.28, 0.28, 0.42, '#2c3037', { topUp: 10, edge: 'rgba(0,0,0,0.7)' });
      glow(head, S(0.9), col, 0.5);
      circle(head, Math.max(1.5, S(0.075)), col);
      hit.push({ id: s[1], sx: top.sx, sy: top.sy, r: S(0.4) });
    });
    // crossing gates at the ravine
    var gate = sim.crossings.gate;
    [[10.2, 1], [13.8, -1]].forEach(function (g) {
      var x = g[0], y = 8.6;
      var base = iso(x, y, 0), top = iso(x, y, 1.5);
      line2(base, top, '#575d66', Math.max(1.4, S(0.06)));
      var ang = gate ? 0.0 : 1.0;
      var armA = iso(x, y, 1.35);
      var armB = iso(x + g[1] * 1.7 * (1 - ang), y, 1.35 + ang * 1.2);
      line2(armA, armB, '#e04f4f', Math.max(2, S(0.09)));
      circle(armA, Math.max(1.6, S(0.08)), '#ff8b8b');
    });
    // ravine warning lamps
    for (var i = 0; i < 4; i++) {
      var rp = iso(11 + (i % 2) * 2, 1.5 + Math.floor(i / 2) * 9.5, 0.5);
      glow(rp, S(0.5), '#ff6b6b', 0.25 + 0.15 * Math.sin(sim.t * 3 + i));
    }
  }

  /* ---------------- shell (grows as modules dock) ---------------- */
  var SHELL = { x0: 2.5, x1: 9.5, y0: 1.95, y1: 7.15, wallH: 5.0 };

  /* One shell wall. `h` is the current height; walls rise as modules dock. */
  function drawShellWall(sim, ax, ay, bx, by, h, warm, isNorth) {
    if (h <= 0.04) return;
    var p1 = iso(ax, ay, 0), p2 = iso(bx, by, 0), q1 = iso(ax, ay, h), q2 = iso(bx, by, h);
    var sealed = sim.shelter.sealedFrac;
    var g = ctx.createLinearGradient(p1.sx, q1.sy, p1.sx, q1.sy + S(h));
    var wm = cl01(sealed * 1.2);           // warm mix: the room lights the glass
    g.addColorStop(0, 'rgba(' + Math.round(lerp(196, 255, wm)) + ',' + Math.round(lerp(226, 196, wm)) + ',' + Math.round(lerp(240, 140, wm)) + ',' + (0.09 + 0.14 * sealed) + ')');
    g.addColorStop(0.5, 'rgba(255,' + Math.round(lerp(198, 168, wm)) + ',' + Math.round(lerp(130, 92, wm)) + ',' + (0.06 + 0.20 * sealed) + ')');
    g.addColorStop(1, 'rgba(' + Math.round(lerp(226, 255, wm)) + ',' + Math.round(lerp(240, 206, wm)) + ',' + Math.round(lerp(250, 156, wm)) + ',' + (0.12 + 0.22 * sealed) + ')');
    poly([p1, p2, q2, q1], g, 'rgba(' + Math.round(lerp(214, 255, wm)) + ',' + Math.round(lerp(238, 226, wm)) + ',' + Math.round(lerp(250, 180, wm)) + ',' + (0.28 + 0.30 * sealed) + ')', 1);
    // a single mullion per bay keeps the glass legible
    var bays = Math.max(2, Math.round(Math.hypot(bx - ax, by - ay) / 1.6));
    for (var i = 1; i < bays; i++) {
      var f = i / bays;
      var rx = lerp(ax, bx, f), ry = lerp(ay, by, f);
      line2(iso(rx, ry, 0), iso(rx, ry, h), 'rgba(220,240,250,' + (0.14 + 0.20 * sealed) + ')', 1);
    }
    // bright top edge (the frame the roof panels land on)
    line2(q1, q2, 'rgba(255,222,164,' + (0.35 + 0.45 * sealed) + ')', Math.max(1, S(0.07)));
    // warm light climbing the inside of the shell
    var lb = iso((ax + bx) / 2, (ay + by) / 2, h * 0.35);
    glow(lb, S(h * 1.5), '#ff9a44', 0.10 + 0.16 * sealed);
    // frost creeping up from the bottom as it gets cold
    if (sim.t > 52) {
      var fa = cl01((sim.t - 52) / 20);
      line2(iso(ax, ay, 0.04), iso(bx, by, 0.04), 'rgba(235,246,255,' + (0.4 * fa) + ')', Math.max(1, S(0.1)));
    }
  }

  function shellHeight(sim) {
    var f = sim.shelter.sealedFrac;
    return SHELL.wallH * Math.pow(f, 0.7);
  }

  /* Membrane ceiling: fills the bays the four panels do not cover. */
  function drawCeiling(sim, warm) {
    var f = sim.shelter.sealedFrac;
    if (f < 0.55) return;
    var a = cl01((f - 0.55) / 0.45);
    var z = 5.34;
    var p1 = iso(SHELL.x0, 4.9, z), p2 = iso(SHELL.x1, 4.9, z), p3 = iso(SHELL.x1, SHELL.y1, z), p4 = iso(SHELL.x0, SHELL.y1, z);
    poly([p1, p2, p3, p4], 'rgba(176,204,220,' + (0.62 * a) + ')', 'rgba(226,242,250,' + (0.55 * a) + ')', 1);
    var q1 = iso(SHELL.x0, SHELL.y0, z), q2 = iso(SHELL.x1, SHELL.y0, z), q3 = iso(SHELL.x1, 1.9, z), q4 = iso(SHELL.x0, 1.9, z);
    poly([q1, q2, q3, q4], 'rgba(176,204,220,' + (0.5 * a) + ')', 'rgba(226,242,250,' + (0.45 * a) + ')', 1);
    // snow load
    if (sim.shelter.seamTime !== null) {
      for (var i = 0; i < 26; i++) {
        var sx = SHELL.x0 + hash2(i, 7) * (SHELL.x1 - SHELL.x0);
        var sy = 4.9 + hash2(i, 11) * (SHELL.y1 - 4.9);
        var sp = iso(sx, sy, z + 0.03);
        ctx.fillStyle = 'rgba(242,250,255,0.55)';
        ctx.fillRect(sp.sx, sp.sy, Math.max(1, S(0.1)), Math.max(1, S(0.04)));
      }
    }
  }

  /* The warm heart of the block: light pooling on the market floor. */
  function drawWarmth(sim, warm) {
    var f = sim.shelter.sealedFrac;
    if (f < 0.15) return;
    // warm air filling the shell: brightest at the floor, spilling out of the glass
    // warm air filling the shell, brightest just above the floor
    var c = iso(6.0, 5.0, 1.3);
    glow(c, S(6.4), '#ff8f38', 0.20 + 0.34 * f);
    var c2 = iso(6.0, 5.3, 0.15);
    glow(c2, S(3.6), '#ffcb7d', 0.20 + 0.28 * f);
    var c3 = iso(6.0, 5.0, 3.6);
    glow(c3, S(4.4), '#ffab52', 0.12 * f);
    // lantern-lit paving
    ctx.globalAlpha = 0.30 + 0.28 * f;
    var f1 = iso(2.7, 4.9, 0.02), f2 = iso(9.3, 4.9, 0.02), f3 = iso(9.3, 7.05, 0.02), f4 = iso(2.7, 7.05, 0.02);
    var fg = ctx.createRadialGradient(c2.sx, c2.sy, 0, c2.sx, c2.sy, S(4.2));
    fg.addColorStop(0, 'rgba(255,176,92,0.85)');
    fg.addColorStop(0.6, 'rgba(255,150,70,0.42)');
    fg.addColorStop(1, 'rgba(255,140,60,0.05)');
    poly([f1, f2, f3, f4], fg);
    ctx.globalAlpha = 1;
  }

  /* ---------------- cold front ---------------- */
  function drawColdFront(sim, coldA) {
    if (coldA <= 0.01) return;
    var fx = sim.cold.frontX;
    if (fx > WX + 2) return;
    // a wall of frost sweeping west across the block
    var steps = 16;
    ctx.save();
    ctx.globalAlpha = 0.55 * coldA;
    var grd = ctx.createLinearGradient(iso(fx, 0, 0).sx, 0, iso(fx - 5, 0, 0).sx, 0);
    grd.addColorStop(0, 'rgba(190,225,245,0.55)');
    grd.addColorStop(1, 'rgba(190,225,245,0)');
    ctx.fillStyle = grd;
    for (var i = 0; i < steps; i++) {
      var y0 = -1 + i * (WY + 2) / steps, y1 = y0 + (WY + 2) / steps;
      var a = iso(fx, y0, 0), b = iso(fx, y1, 0);
      ctx.beginPath();
      ctx.moveTo(a.sx, a.sy);
      ctx.lineTo(b.sx, b.sy);
      ctx.lineTo(b.sx, b.sy - S(9));
      ctx.lineTo(a.sx, a.sy - S(9));
      ctx.closePath();
      ctx.fill();
    }
    // frost crystals along the leading edge
    for (var c = 0; c < 40; c++) {
      var yy = -1 + hash2(c, 3) * (WY + 2);
      var p = iso(fx, yy, hash2(c, 9) * 6);
      var s = S(0.12 + hash2(c, 5) * 0.2);
      ctx.fillStyle = 'rgba(228,244,255,' + (0.35 * coldA) + ')';
      ctx.beginPath();
      ctx.moveTo(p.sx, p.sy - s); ctx.lineTo(p.sx + s * 0.6, p.sy); ctx.lineTo(p.sx, p.sy + s);
      ctx.lineTo(p.sx - s * 0.6, p.sy); ctx.closePath(); ctx.fill();
    }
    ctx.restore();
  }

  /* ---------------- labels + selection ---------------- */
  function moduleAnchor(sim, id) {
    var m = sim.modules[id];
    if (!m) return null;
    if (id === 'GN-1') return iso(sim.gantry.jib, sim.gantry.x, GIRDER_Z + 0.6);
    if (id === 'FL-1') return iso(sim.lift.x, 8, 3.6);
    if (id === 'TR-1' || id === 'TR-2') return iso(sim.trams[id].x, 8, 2.3);
    return iso(m.pos.x, m.pos.y, m.pos.z + (m.kind === 'duct' ? 3.5 : 0.9));
  }

  /* ---------------- main draw ---------------- */
  function draw(sim, selectedId) {
    var t = sim.t;
    var dt = Math.max(0, Math.min(0.05, t - lastT));
    lastT = t;
    tAcc += dt;
    selPulse += 0.12;

    var sealed = sim.shelter.seamTime !== null;
    cam.zoomT = sealed ? 0.93 : 1.0;
    cam.zoom += (cam.zoomT - cam.zoom) * 0.03;

    var dusk = cl01((t - 6) / 34);
    var coldA = cl01((t - 50) / 22);
    var warm = cl01((t - 20) / 26);
    NIGHT = cl01((t - 12) / 40) * 0.85 + coldA * 0.15;

    // --- sky ---
    var skyTop = mix('#20365c', '#171a2e', dusk);
    var skyMid = mix('#5d86b0', '#7a4a55', dusk);
    var skyLow = mix('#c7d9d3', '#c9773f', dusk);
    if (coldA > 0) { skyMid = mix(skyMid, '#2b3550', coldA * 0.8); skyLow = mix(skyLow, '#41506b', coldA * 0.85); }
    var g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, skyTop); g.addColorStop(0.55, skyMid); g.addColorStop(1, skyLow);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

    // stars
    if (dusk > 0.55) {
      ctx.globalAlpha = (dusk - 0.55) * 1.6;
      for (var s = 0; s < 70; s++) {
        var sx = hash2(s, 1) * W, sy = hash2(s, 2) * H * 0.55;
        var tw = 0.5 + 0.5 * Math.sin(tAcc * 1.5 + s);
        ctx.fillStyle = 'rgba(230,240,255,' + (0.25 + 0.5 * tw) + ')';
        ctx.fillRect(sx, sy, 1.6, 1.6);
      }
      ctx.globalAlpha = 1;
    }

    // sun / moon low on the horizon
    var sunX = W * (0.72 - dusk * 0.12), sunY = H * (0.34 + dusk * 0.22);
    var sunR = S(1.6);
    var sg = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, sunR * 6);
    sg.addColorStop(0, dusk > 0.6 ? 'rgba(255,240,210,0.95)' : 'rgba(255,238,180,0.95)');
    sg.addColorStop(0.25, dusk > 0.6 ? 'rgba(255,190,150,0.45)' : 'rgba(255,214,140,0.45)');
    sg.addColorStop(1, 'rgba(255,190,140,0)');
    ctx.fillStyle = sg;
    ctx.beginPath(); ctx.arc(sunX, sunY, sunR * 6, 0, 6.2832); ctx.fill();
    ctx.fillStyle = dusk > 0.6 ? '#ffe6c8' : '#fff3c4';
    ctx.beginPath(); ctx.arc(sunX, sunY, sunR * 0.55, 0, 6.2832); ctx.fill();

    // distant skyline silhouette (depth)
    ctx.fillStyle = rgba(mix('#2a3550', '#4a5a72', 1 - dusk), 0.55);
    for (var i = 0; i < 26; i++) {
      var bx = (i / 26) * W + hash2(i, 4) * 18;
      var bw = 26 + hash2(i, 5) * 46;
      var bh = 40 + hash2(i, 6) * 150;
      ctx.fillRect(bx, H * 0.52 - bh, bw, bh + 10);
    }

    hit = [];
    drawGround(sim);
    drawMarketBase(sim, warm);

    // ---- depth-sorted object list ----
    var items = [];
    function add(x, y, fn, z) { items.push({ d: x + y + (z || 0) * 0.001, fn: fn }); }

    BUILDINGS.forEach(function (b) {
      add(b.x + b.w / 2, b.y + b.d / 2, function () { drawBuilding(b, warm, coldA > 0.4); });
    });

    var roofPass = [];
    // shell walls, each sorted at its own place in the scene
    var sh = shellHeight(sim);
    add(6.0, SHELL.y0, function () { drawShellWall(sim, SHELL.x0, SHELL.y0, SHELL.x1, SHELL.y0, sh * 0.9, warm, true); });
    add(SHELL.x0, 4.5, function () { drawShellWall(sim, SHELL.x0, SHELL.y0, SHELL.x0, SHELL.y1, sh, warm); });
    add(SHELL.x1, 4.5, function () { drawShellWall(sim, SHELL.x1, SHELL.y0, SHELL.x1, SHELL.y1, sh, warm); });
    add(SHELL.x0, SHELL.y1, function () { drawShellWall(sim, SHELL.x0, SHELL.y1, SHELL.x1, SHELL.y1, sh, warm); });
    add(6.0, 5.2, function () { drawWarmth(sim, warm); });
    roofPass.push(function () { drawCeiling(sim, warm); });

    // roof panels fly in the depth-sorted pass; once docked they are drawn
    // again in a translucent cutaway pass so the warm room stays visible.
    ['RP-1', 'RP-2', 'RP-3', 'RP-4'].forEach(function (id) {
      var m = sim.modules[id];
      if (m.docked) { roofPass.push(function () { drawPanel(sim, m, selectedId === id); }); }
      else add(m.pos.x, m.pos.y, function () { drawPanel(sim, m, selectedId === id); });
    });
    ['CD-1', 'CD-2', 'CD-3'].forEach(function (id) {
      var m = sim.modules[id];
      add(m.pos.x, m.pos.y, function () { drawDuct(sim, m, selectedId === id); });
    });

    // bridge
    var B = sim.modules['BR-1'];
    add(B.pos.x - 1.6, B.pos.y, function () { drawBridge(sim, B, selectedId === 'BR-1'); });

    // stations
    var labels = [];
    add(4.2, 8, function () {
      box(3.4, 7.35, 0, 1.7, 0.5, 0.55, '#8a8f98', { topUp: 18 });
      labels.push({ p: iso(4.25, 7.35, 1.0), t: 'WEST STATION' });
    });
    add(19.5, 8, function () {
      box(18.7, 7.35, 0, 1.7, 0.5, 0.55, '#8a8f98', { topUp: 18 });
      labels.push({ p: iso(19.55, 7.35, 1.0), t: 'EAST STATION' });
    });

    // trams
    add(sim.trams['TR-1'].x, 8.4, function () { drawTram(sim, sim.trams['TR-1'], 'TR-1'); });
    add(sim.trams['TR-2'].x, 8.4, function () { drawTram(sim, sim.trams['TR-2'], 'TR-2'); });

    // people
    sim.people.forEach(function (p, i) {
      add(p.x, p.y, function () { drawPerson(sim, p); }, 0.5);
    });

    // machines
    add(sim.gantry.jib, sim.gantry.x, function () { drawGantry(sim, selectedId === 'GN-1'); }, 1);
    add(sim.lift.x, 8, function () { drawLift(sim, selectedId === 'FL-1'); }, 0.6);
    add(9.6, 7.2, function () { drawSignals(sim); });

    items.sort(function (a, b) { return a.d - b.d; });
    items.forEach(function (it) { it.fn(); });
    // interior haze: warm light in the air of the sealed market
    var sfr = sim.shelter.sealedFrac;
    if (sfr > 0.05) {
      var hz = iso(6.0, 5.0, 2.2);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      glow(hz, S(5.0), '#ff9a40', 0.10 + 0.22 * sfr);
      glow(iso(6.0, 5.6, 0.6), S(3.4), '#ffb45e', 0.08 + 0.16 * sfr);
      ctx.restore();
    }
    // cutaway pass: roof + ceiling over the sealed market
    roofPass.forEach(function (fn) { fn(); });

    // labels last, nudged apart so none are clipped by geometry
    labels.sort(function (a, b) { return a.p.sy - b.p.sy; });
    var placed = [];
    labels.forEach(function (l) {
      var y = l.p.sy, guard = 0;
      while (placed.some(function (q) { return Math.abs(q.sx - l.p.sx) < 78 && Math.abs(q.sy - y) < 18; }) && guard++ < 8) y -= 19;
      placed.push({ sx: l.p.sx, sy: y });
      chip(l.t, { sx: l.p.sx, sy: y }, '#dfe8f2', 'rgba(14,19,29,0.82)');
    });

    // --- ambient particles ---
    if (coldA > 0.05) {
      for (var n = 0; n < 3; n++) {
        if (Math.random() < 0.9) spawn('snow', Math.random() * WX, Math.random() * WY, 5 + Math.random() * 4, -0.5, 0.05, -0.8, 4);
      }
    }
    // steam from working chimneys / tram
    if (Math.random() < (warm > 0.4 ? 0.5 : 0.15)) {
      spawn('steam', 2.2 + Math.random() * 0.2, 6.4, 4.2, 0.1, 0, 0.7, 2.2);
    }
    if (sim.gantry.state === 'LIFTING' || sim.gantry.state === 'LOWER2') {
      if (Math.random() < 0.4) spawn('steam', sim.gantry.jib, sim.gantry.x, 1.2, 0.05, 0, 0.5, 1.4);
    }
    updateParticles(dt > 0 ? dt : 1 / 60);
    drawParticles();

    // cold front over everything behind UI
    drawColdFront(sim, coldA);

    // --- selection readout ---
    if (selectedId && sim.modules[selectedId]) {
      var anchor = moduleAnchor(sim, selectedId);
      if (anchor) {
        var m = sim.modules[selectedId];
        chip('◈ ' + selectedId + ' · ' + m.state, { sx: anchor.sx, sy: anchor.sy - 14 }, '#ffd76a');
        ctx.beginPath();
        ctx.moveTo(anchor.sx, anchor.sy - 6); ctx.lineTo(anchor.sx - 5, anchor.sy + 2); ctx.lineTo(anchor.sx + 5, anchor.sy + 2);
        ctx.closePath(); ctx.fillStyle = '#ffd76a'; ctx.fill();
      }
    }

    // --- vignette + frost at the edges when cold ---
    if (coldA > 0.2) {
      var vg = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.75);
      vg.addColorStop(0, 'rgba(180,215,240,0)');
      vg.addColorStop(1, 'rgba(150,190,225,' + (0.17 * coldA) + ')');
      ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
    }

    // --- caption ---
    var phase = t < 20 ? 'ORDINARY DAY' : t < 30 ? 'DUSK · FOLD BEGINS' : t < 52 ? 'ASSEMBLING THE SHELL' : t < 72 ? 'COLD FRONT · RACE THE SEAM' : 'SEALED';
    text(phase, { sx: W / 2, sy: 22 }, 'rgba(240,246,255,0.92)', 12, 'center', '700');
    text((t).toFixed(1) + 's / 90s', { sx: W / 2, sy: 40 }, 'rgba(200,214,232,0.75)', 10, 'center', '600');

    if (sim.shelter.seamTime !== null) {
      var p = iso(6, 4.5, 6.2);
      glow(p, S(7), '#ffb45e', 0.10);
    }
  }

  return {
    draw: draw, resize: resize,
    hitTest: function (mx, my) {
      var best = null, bd = 1e9;
      hit.forEach(function (h) {
        var d = Math.hypot(h.sx - mx, h.sy - my);
        if (d < Math.max(h.r, 14) && d < bd) { bd = d; best = h.id; }
      });
      return best;
    },
    size: function () { return { W: W, H: H }; }
  };
}

global.CityRender = { createRenderer: createRenderer };
if (typeof module !== 'undefined' && module.exports) module.exports = global.CityRender;
})(typeof window !== 'undefined' ? window : globalThis);
