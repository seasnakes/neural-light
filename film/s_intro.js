'use strict';
// ---------- shared effects ----------
var FX = {};
// drifting dust / bokeh field, wrapped in a box around o.c
FX.dust = function (t, o) {
  var R = U.rng(o.seed);
  var sx = o.s[0], sy = o.s[1], sz = o.s[2];
  var vel = o.vel || [0, 0, 0], wob = o.wob || 0, col = o.col, K = o.k;
  if (K <= 0.0005) return;
  for (var i = 0; i < o.n; i++) {
    var x = (R() - 0.5) * sx, y = (R() - 0.5) * sy, z = (R() - 0.5) * sz;
    var s = o.size[0] + R() * (o.size[1] - o.size[0]);
    var ph = R() * 6.2832, sp = 0.5 + R();
    var kk = 0.35 + 0.65 * R();
    x += vel[0] * t * sp + Math.sin(t * 0.31 * sp + ph) * wob;
    y += vel[1] * t * sp + Math.cos(t * 0.27 * sp + ph * 1.3) * wob;
    z += vel[2] * t * sp;
    if (o.off) { x -= o.off[0]; y -= o.off[1]; z -= o.off[2]; }
    x = U.wrap(x, sx); y = U.wrap(y, sy); z = U.wrap(z, sz);
    if (o.off) { x += o.off[0]; y += o.off[1]; z += o.off[2]; }
    var k = K * kk * (o.tw ? (0.55 + 0.45 * Math.sin(t * o.tw * sp + ph * 5)) : 1);
    E.p(x + o.c[0], y + o.c[1], z + o.c[2], s, col[0] * k, col[1] * k, col[2] * k, 0);
  }
};

// ---------- S0 : the photon ----------
var S0 = { t0: 0, t1: 7.72 };
(function () {
  var halo = [];
  S0.init = function () {
    var R = U.rng(5);
    for (var i = 0; i < 520; i++) {
      halo.push({ ax: U.unit(R), r: 0.04 + Math.pow(R(), 1.8) * 0.5, w: (0.5 + R() * 1.8) * (R() < 0.5 ? -1 : 1), ph: R() * 6.2832, k: 0.015 + R() * 0.05, s: 0.006 + R() * 0.01 });
    }
  };
  function photonPos(t) {
    var m = U.remap(t, 5.35, 7.55);
    var a = U.eiX(m);
    var z = a * 8.9;
    var ang = t * 2.4, rad = 0.22 * Math.sin(Math.PI * Math.min(1, a * 1.15));
    return [Math.cos(ang) * rad, Math.sin(ang) * rad, z];
  }
  S0.draw = function (t, P) {
    var push = U.eio(U.remap(t, 0, 7.6));
    var camZ = 10 - 0.9 * push;
    var pp = photonPos(t);
    E.camera({ pos: [0, 0, camZ], target: [0, 0, -1], fov: 35, focus: Math.max(0.6, camZ - pp[2]), aperture: 30, maxCoc: 48 });
    FX.dust(t, { seed: 3, n: 1100, c: [0, 0, -12], s: [34, 20, 40], size: [0.015, 0.05], col: [0.38, 0.55, 1.0], k: 0.55 * U.ss(0, 3, t), vel: [0.015, 0.025, 0.25], wob: 0.1, tw: 0.8 });
    var a = U.ss(0.45, 2.4, t);
    var breath = 1 + 0.16 * Math.sin(t * 4.4) * (1 - U.remap(t, 5.4, 6.0));
    var near = U.eiX(U.remap(t, 5.35, 7.55));
    // trail
    if (t > 5.35) {
      for (var i = 1; i < 90; i++) {
        var tt = t - i * 0.006; if (tt < 5.35) break;
        var q = photonPos(tt), f = Math.pow(1 - i / 90, 2);
        E.p(q[0], q[1], q[2], 0.02, 0.5 * f, 0.75 * f, 1.6 * f, 0);
      }
    }
    // halo cloud
    for (var j = 0; j < halo.length; j++) {
      var h = halo[j];
      var ang = h.ph + t * h.w;
      var b0 = U.norm(U.cross(h.ax, [0.3, 0.9, 0.1])), b1 = U.cross(h.ax, b0);
      var rr = h.r * (1 + 0.15 * Math.sin(t * 1.3 + h.ph)) * (1 - 0.7 * near);
      var x = pp[0] + (b0[0] * Math.cos(ang) + b1[0] * Math.sin(ang)) * rr;
      var y = pp[1] + (b0[1] * Math.cos(ang) + b1[1] * Math.sin(ang)) * rr;
      var z = pp[2] + (b0[2] * Math.cos(ang) + b1[2] * Math.sin(ang)) * rr;
      var k = h.k * a * (0.6 + 0.4 * Math.sin(t * 3 + h.ph * 4));
      E.p(x, y, z, h.s, 0.45 * k, 0.7 * k, 1.5 * k, 0);
    }
    // core
    var ci = a * breath * (1 + 2.5 * near);
    E.p(pp[0], pp[1], pp[2], 0.03, 2.2 * ci, 2.7 * ci, 4.0 * ci, 1);
    E.p(pp[0], pp[1], pp[2], 0.32, 0.03 * ci, 0.06 * ci, 0.16 * ci, 0);
    E.p(pp[0], pp[1], pp[2], 1.2, 0.006 * ci, 0.012 * ci, 0.035 * ci, 0);
    UI.anchors.photon = E.project(pp[0], pp[1], pp[2]);

    U.mixPost(P, { bg0: [0.0028, 0.0042, 0.010], bg1: [0.0, 0.0, 0.0008], bloom: 1.25, streak: 0.55, streakTint: [0.5, 0.7, 1.0], vig: 0.7, thresh: 0.12 }, 1);
    P.fade = 1 - U.ss(0.0, 1.2, t);
    P.flash = Math.pow(U.remap(t, 7.05, 7.5), 3) * 1.1; P.flashCol = [0.86, 0.93, 1.0];
  };

  UI.text({ t0: 1.5, t1: 5.75, x: 960, y: 700, align: 'center', cls: 'shadow', stagger: 0.075, inDur: 1.3, outDur: 0.9, blur: 12,
    lines: [{ t: '如果，光可以成为大脑的开关', c: 'h1s' }, { t: 'What if light could become a switch for the brain?', c: 'enq', mode: 'line', d: 1.4 }] });
})();

// ---------- S1 : title ring ----------
var S1 = { t0: 7.45, t1: 15.72 };
(function () {
  var N = 0, tg, dir, kind, meta;
  S1.init = function () {
    var R = U.rng(77), T = [], D = [], K = [], M = [];
    function add(x, y, z, kd, k) {
      T.push(x, y, z); var d = U.unit(R); D.push(d[0], d[1] * 0.85, d[2] * 0.5); K.push(kd);
      M.push(R() * 6.2832, R() * 0.5, k, 2.2 + R() * 3.8);
    }
    var i, a, r, j;
    for (i = 0; i < 3600; i++) { a = R() * 6.2832; r = 1.55 + U.gauss(R) * 0.009; add(r * Math.cos(a), r * Math.sin(a), U.gauss(R) * 0.01, 0, 0.55 + R() * 0.45); }
    for (i = 0; i < 1100; i++) { a = R() * 6.2832; r = 1.47 + U.gauss(R) * 0.003; add(r * Math.cos(a), r * Math.sin(a), 0, 1, 0.35); }
    for (i = 0; i < 120; i++) { var a0 = i * 6.2832 / 120; for (j = 0; j < 9; j++) { a = a0 + j * 0.0036; add(1.74 * Math.cos(a), 1.74 * Math.sin(a), 0, 2, 0.55); } }
    for (i = 0; i < 96; i++) { a = i * 6.2832 / 96; var len = (i % 8 === 0) ? 0.14 : 0.055; for (j = 0; j < 10; j++) { r = 1.84 + len * j / 9; add(r * Math.cos(a), r * Math.sin(a), 0, 3, 0.5); } }
    for (i = 0; i < 1000; i++) { r = Math.sqrt(R()) * 1.35; a = R() * 6.2832; add(r * Math.cos(a), r * Math.sin(a), U.gauss(R) * 0.06, 4, 0.25 + R() * 0.75); }
    tg = new Float32Array(T); dir = new Float32Array(D); kind = new Uint8Array(K); meta = new Float32Array(M); N = K.length;
  };
  S1.draw = function (t, P) {
    var u = t - 7.5;
    var exitP = U.eiX(U.remap(t, 13.75, 15.7));
    var camZ = 9.6 - Math.max(0, u) * 0.11 - 9.4 * exitP;
    var cy = -0.36;
    E.camera({ pos: [0, cy, camZ], target: [0, cy, camZ - 10], fov: 35, focus: Math.max(0.4, camZ), aperture: 24, maxCoc: 52 });
    var g = U.ss(7.45, 7.56, t);
    E.setGain(g);
    var rx = 0.28 * (1 - U.eo(U.remap(u, 0, 4.5))) + 0.04 * Math.sin(u * 0.5), ry = 0.1 * Math.sin(u * 0.33 + 0.4);
    var crx = Math.cos(rx), srx = Math.sin(rx), cry = Math.cos(ry), sry = Math.sin(ry);
    var heat = Math.exp(-Math.max(0, u) * 2.2);
    var gold = [1.0, 0.72, 0.38];
    for (var i = 0; i < N; i++) {
      var ph = meta[i * 4], del = meta[i * 4 + 1], kk = meta[i * 4 + 2], br = meta[i * 4 + 3];
      var kd = kind[i];
      var cp = U.remap(u, 0.06 + del, 1.75 + del * 1.6);
      var ce = 1 - Math.pow(1 - cp, 4);
      var bR = br * (1 - Math.exp(-Math.max(0, u) * 6));
      var bx = dir[i * 3] * bR, by = dir[i * 3 + 1] * bR, bz = dir[i * 3 + 2] * bR;
      var rot = (kd === 2 || kd === 3) ? -u * 0.05 : (kd === 4 ? u * 0.11 + 0.2 * Math.sin(u * 0.4 + ph) : u * 0.04);
      var cr = Math.cos(rot), sr = Math.sin(rot);
      var tx = tg[i * 3] * cr - tg[i * 3 + 1] * sr, ty = tg[i * 3] * sr + tg[i * 3 + 1] * cr, tz = tg[i * 3 + 2];
      var x = bx + (tx - bx) * ce, y = by + (ty - by) * ce, z = bz + (tz - bz) * ce;
      if (exitP > 0) { var sp = 1 + exitP * 0.35 * (0.5 + del); x *= sp; y *= sp; z += exitP * (del - 0.25) * 2; }
      // tilt
      var y2 = y * crx - z * srx, z2 = y * srx + z * crx;
      var x3 = x * cry + z2 * sry, z3 = -x * sry + z2 * cry;
      var tw = 0.72 + 0.28 * Math.sin(u * 2.3 + ph * 3);
      var k = kk * tw;
      var r, gg, b, s = 0.011;
      if (kd === 4) { r = 0.3; gg = 0.5; b = 1.0; k *= 0.22; s = 0.014; }
      else if (kd === 3 || kd === 2) { r = 1.0; gg = 0.84; b = 0.6; k *= 0.7; }
      else if (kd === 1) { r = 1.0; gg = 0.8; b = 0.55; k *= 0.6; s = 0.008; }
      else { r = gold[0]; gg = gold[1]; b = gold[2]; k *= 0.62; }
      var hk = heat * (1 - ce * 0.6);
      r = r + (1.0 - r) * hk; gg = gg + (0.95 - gg) * hk; b = b + (0.9 - b) * hk;
      k *= 1 + hk * 2.5;
      E.p(x3, y2, z3, s, r * k, gg * k, b * k, 0);
    }
    // soft centre warmth
    var cw = U.ss(7.6, 9.5, t) * (1 - exitP);
    E.p(0, 0, 0, 3.2, 0.012 * cw, 0.009 * cw, 0.005 * cw, 0);
    E.setGain(1);
    var w = U.ss(7.45, 7.55, t);
    U.mixPost(P, { bg0: [0.0075, 0.005, 0.0025], bg1: [0.0, 0.0, 0.0], bloom: 1.3, streak: 0.3, streakTint: [1.0, 0.78, 0.5], vig: 0.68, thresh: 0.2 }, w);
    if (t >= 7.5) { P.bloom += 3 * Math.exp(-(t - 7.5) * 2.5); P.flash = 0.85 * Math.exp(-(t - 7.5) * 9); P.flashCol = [1.0, 0.94, 0.84]; }
  };
  UI.text({ t0: 8.15, t1: 13.85, x: 960, y: 412, align: 'center', stagger: 0.12, inDur: 1.4, blur: 16, rise: 0, zoom: 0.06, outDur: 0.9,
    lines: [{ t: '2026', c: '', cc: 'y2026' }] });
  UI.text({ t0: 8.8, t1: 13.95, x: 960, y: 798, align: 'center', stagger: 0.07, inDur: 1.2, blur: 12, outDur: 0.9,
    lines: [{ t: '诺贝尔生理学或医学奖', c: 'title' }, { t: 'The Nobel Prize in Physiology or Medicine', c: 'titleen', mode: 'line', d: 1.1 }] });
})();
