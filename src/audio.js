/* Optional mechanical sound only (no speech). WebAudio clicks/clanks/hiss. */
(function (global) {
'use strict';
function createAudio() {
  var ctx = null, enabled = true;
  function ensure() {
    if (!ctx) { try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { ctx = null; } }
    if (ctx && ctx.state === 'suspended') ctx.resume();
    return ctx;
  }
  function click(freq, dur, gain) {
    if (!enabled || !ensure()) return;
    var o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'square'; o.frequency.value = freq || 180;
    g.gain.setValueAtTime(gain || 0.08, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + (dur || 0.08));
    o.connect(g); g.connect(ctx.destination);
    o.start(); o.stop(ctx.currentTime + (dur || 0.08));
  }
  function hiss(dur, gain) {
    if (!enabled || !ensure()) return;
    var len = Math.floor(ctx.sampleRate * (dur || 0.3));
    var buf = ctx.createBuffer(1, len, ctx.sampleRate);
    var d = buf.getChannelData(0);
    for (var i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    var src = ctx.createBufferSource(); src.buffer = buf;
    var g = ctx.createGain(); g.gain.value = gain || 0.05;
    var f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 2000;
    src.connect(f); f.connect(g); g.connect(ctx.destination); src.start();
  }
  return {
    setEnabled: function (v) { enabled = !!v; },
    isEnabled: function () { return enabled; },
    clank: function () { click(120, 0.12, 0.1); },
    pin: function () { click(320, 0.06, 0.07); },
    brake: function () { hiss(0.25, 0.06); },
    dock: function () { click(90, 0.18, 0.12); hiss(0.15, 0.04); },
    bell: function () { click(880, 0.2, 0.05); },
    seam: function () { click(660, 0.15, 0.06); click(990, 0.2, 0.05); }
  };
}
global.CityAudio = { createAudio: createAudio };
if (typeof module !== 'undefined' && module.exports) module.exports = global.CityAudio;
})(typeof window !== 'undefined' ? window : globalThis);
