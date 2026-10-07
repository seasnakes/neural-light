'use strict';
// ---------- S6 : laureates ----------
var NODE_X = [-6.6, 0, 6.6], NODE_Y = 1.15, CAMZ = 22;
function lauCam(t) { return { pos: [0.25 * Math.sin(t * 0.21), 0.15 * Math.sin(t * 0.17), CAMZ], target: [0, 0, 0], fov: 35, focus: CAMZ, aperture: 26, maxCoc: 48 }; }
function nodePos(i, t) {
  var q = U.eio(U.remap(t, CUES.converge, CUES.finaleHit));
  var a = [NODE_X[i], NODE_Y, 0], c = [0, NODE_Y, 0];
  var ctrl = [NODE_X[i] * 0.6, NODE_Y + (i === 1 ? 2.6 : -2.2), 2.5];
  var u = 1 - q;
  return [u * u * a[0] + 2 * u * q * ctrl[0] + q * q * c[0], u * u * a[1] + 2 * u * q * ctrl[1] + q * q * c[1], u * u * a[2] + 2 * u * q * ctrl[2] + q * q * c[2]];
}
var S6 = { t0: 79.6, t1: 95.3 };
(function () {
  var halo = [];
  S6.init = function () {
    var R = U.rng(66);
    for (var i = 0; i < 3; i++) { var h = []; for (var j = 0; j < 160; j++) h.push({ ax: U.unit(R), r: 0.06 + Math.pow(R(), 1.6) * 0.5, w: (0.5 + R() * 1.4) * (R() < 0.5 ? -1 : 1), ph: R() * 6.28, k: 0.02 + R() * 0.05 }); halo.push(h); }
  };
  S6.draw = function (t, P) {
    E.camera(lauCam(t));
    var gIn = U.ss(79.6, 80.6, t);
    E.setGain(gIn);
    FX.dust(t, { seed: 61, n: 900, c: [0, 0, -6], s: [44, 26, 30], size: [0.03, 0.09], col: [1.0, 0.78, 0.48], k: 0.11, vel: [0.02, -0.12, 0], wob: 0.25, tw: 0.9 });
    var conv = U.eio(U.remap(t, CUES.converge, CUES.finaleHit));
    var lineFade = 1 - U.ss(CUES.converge, CUES.converge + 1.2, t);
    // great faint arc behind the laureates (echo of the title ring)
    var arcK = U.ss(80.0, 82.5, t) * (1 - 0.6 * conv);
    var Ra = U.rng(606);
    for (var ai = 0; ai < 3200; ai++) {
      var aa = Ra() * 6.2832, rr0 = 9.5 + U.gauss(Ra) * 0.05, kr = Ra();
      aa += t * 0.012;
      var ak = (0.05 + 0.05 * kr) * arcK * (0.7 + 0.3 * Math.sin(t * 1.3 + kr * 40));
      E.p(Math.cos(aa) * rr0, NODE_Y + Math.sin(aa) * rr0 * 0.42 - 0.6, -7 + Math.sin(aa) * 3, 0.02, 1.0 * ak, 0.78 * ak, 0.48 * ak, 0);
    }
    for (var i = 0; i < 3; i++) {
      var tr = CUES.names[i];
      var lp = U.eo(U.remap(t, tr - 0.65, tr + 0.08));
      if (lp <= 0) continue;
      var top = 7.6, ny = NODE_Y, nx = NODE_X[i];
      var yEnd = top - (top - ny) * lp;
      var after = U.ss(tr + 0.1, tr + 2.0, t);
      for (var y = top; y >= yEnd; y -= 0.018) {
        var head = Math.exp(-(y - yEnd) / 0.25) * (1 - after);
        var k = (0.16 - 0.06 * after + 1.6 * head) * lineFade;
        E.p(nx, y, 0, 0.026, 1.0 * k, 0.82 * k, 0.55 * k, 0);
        if (((y * 50) | 0) % 6 === 0) E.p(nx, y, 0, 0.7, 0.0075 * lineFade * (1 + after), 0.006 * lineFade * (1 + after), 0.004 * lineFade * (1 + after), 0);
      }
      // rising motes along the line
      for (var m = 0; m < 26; m++) {
        var my = ny + ((t * 0.6 + m * 0.37) % 1) * (top - ny);
        if (my > yEnd) continue;
        var mk = 0.25 * after * lineFade * Math.sin(Math.PI * ((my - ny) / (top - ny)));
        E.p(nx + 0.03 * Math.sin(m * 7 + t), my, 0, 0.03, 1.0 * mk, 0.85 * mk, 0.6 * mk, 0);
      }
      if (lp >= 1) {
        var np = nodePos(i, t);
        var age = t - tr - 0.08;
        var flare = Math.exp(-age * 3.5) * 5;
        var br = (1.0 + 0.18 * Math.sin(t * 3 + i)) + flare + conv * 1.5;
        E.p(np[0], np[1], np[2], 0.07, 2.2 * br, 1.85 * br, 1.35 * br, 1);
        E.p(np[0], np[1], np[2], 0.7, 0.05 * br, 0.04 * br, 0.026 * br, 0);
        E.p(np[0], np[1], np[2], 2.4, 0.008 * br, 0.0062 * br, 0.004 * br, 0);
        var H = halo[i];
        for (var j = 0; j < H.length; j++) {
          var h = H[j], ang = h.ph + t * h.w;
          var b0 = U.norm(U.cross(h.ax, [0.3, 0.9, 0.1])), b1 = U.cross(h.ax, b0);
          var rr = h.r * 1.5 * U.eo(U.remap(age, 0, 0.8)) * (1 - 0.6 * conv);
          var hk = h.k * 1.8 * (0.6 + 0.4 * Math.sin(t * 3 + h.ph * 4));
          E.p(np[0] + (b0[0] * Math.cos(ang) + b1[0] * Math.sin(ang)) * rr, np[1] + (b0[1] * Math.cos(ang) + b1[1] * Math.sin(ang)) * rr, np[2] + (b0[2] * Math.cos(ang) + b1[2] * Math.sin(ang)) * rr, 0.012, 1.0 * hk, 0.82 * hk, 0.55 * hk, 0);
        }
        // converge trails
        if (conv > 0 && conv < 1) {
          for (var tt = 1; tt < 50; tt++) {
            var pp = nodePos(i, t - tt * 0.012), f = Math.pow(1 - tt / 50, 2) * 0.8;
            E.p(pp[0], pp[1], pp[2], 0.03, 1.0 * f, 0.85 * f, 0.6 * f, 0);
          }
        }
      }
    }
    // links between laureates
    var lk = U.eio(U.remap(t, CUES.link, CUES.link + 1.1)) * lineFade;
    if (lk > 0) {
      for (var a = 0; a < 2; a++) {
        var p0 = [NODE_X[a], NODE_Y, 0], p2 = [NODE_X[a + 1], NODE_Y, 0], c = [(p0[0] + p2[0]) / 2, NODE_Y + 1.4, 0];
        for (var s = 0; s <= 1; s += 0.004) {
          var q = s * lk;
          var x = (1 - q) * (1 - q) * p0[0] + 2 * (1 - q) * q * c[0] + q * q * p2[0], y2 = (1 - q) * (1 - q) * p0[1] + 2 * (1 - q) * q * c[1] + q * q * p2[1];
          var pk = Math.exp(-Math.pow((q - ((t - CUES.link) * 0.45 % 1)) / 0.04, 2)) * 0.8;
          var kk = 0.045 + pk;
          E.p(x, y2, 0, 0.02, 1.0 * kk, 0.84 * kk, 0.6 * kk, 0);
        }
      }
    }
    E.setGain(1);
    var w = U.ss(79.6, 80.4, t);
    U.mixPost(P, { bg0: [0.0068, 0.0048, 0.0028], bg1: [0, 0, 0], bloom: 1.25, streak: 0.4, streakTint: [1.0, 0.8, 0.55], thresh: 0.4, vig: 0.7 }, w);
  };

  UI.text({ t0: 80.0, t1: 92.4, x: 960, y: 168, align: 'center', stagger: 0.04, inDur: 1.0,
    lines: [{ t: '2026 诺贝尔生理学或医学奖得主', c: 'kickzh' }, { t: 'Laureates', c: 'en2', mode: 'line', d: 0.6, style: 'margin-right:-.4em' }] });
  var L = [
    ['彼得·黑格曼', 'Peter Hegemann', 'b. 1954', '德国 · 柏林洪堡大学', 'Humboldt-Universität zu Berlin'],
    ['格奥尔格·纳格尔', 'Georg Nagel', 'b. 1953', '德国 · 维尔茨堡大学', 'Universität Würzburg'],
    ['卡尔·戴瑟罗特', 'Karl Deisseroth', 'b. 1971', '美国 · 斯坦福大学 / HHMI', 'Stanford University  ·  HHMI']
  ];
  L.forEach(function (l, i) {
    UI.text({ t0: CUES.names[i] + 0.12, t1: 92.6, x: 960 + NODE_X[i] * 1712.6 / CAMZ, y: 516, align: 'center', stagger: 0.07, inDur: 1.0, outDur: 0.8,
      lines: [{ t: l[0], c: 'lzh', d: 0 }, { t: l[1], c: 'len', mode: 'line', d: 0.45 }, { t: l[2], c: 'lyr', mode: 'line', d: 0.65 }, { t: l[3], c: 'laf', mode: 'line', d: 0.85 }, { t: l[4], c: 'lafen', mode: 'line', d: 1.0 }] });
  });
  UI.text({ t0: CUES.motivation, t1: 92.5, x: 960, y: 812, align: 'center', stagger: 0.045, inDur: 1.0, outDur: 0.8,
    lines: [{ t: '表彰他们在光门控离子通道与光遗传学领域的发现', c: 'mot' }, { t: 'Light-gated ion channels  ·  Optogenetics', c: 'moten', mode: 'line', d: 1.3 }, { t: '奖金 1200 万瑞典克朗  ·  三位得主平分', c: 'prizezh', mode: 'line', d: 1.8 }] });
})();

// ---------- S7 : finale ----------
var S7 = { t0: 94.8, t1: 102.6 };
(function () {
  var ring = [], halo = [];
  S7.init = function () {
    var R = U.rng(707);
    for (var i = 0; i < 4600; i++) { var a = R() * 6.2832; ring.push([a, 2.6 + U.gauss(R) * 0.01, U.unit(R), R() * 0.4, 0, R()]); }
    for (var j = 0; j < 1200; j++) { var a2 = R() * 6.2832; ring.push([a2, 2.47 + U.gauss(R) * 0.003, U.unit(R), R() * 0.4, 1, R()]); }
    for (var k = 0; k < 120; k++) { var a3 = k * 6.2832 / 120; for (var m = 0; m < 8; m++) ring.push([a3 + m * 0.0028, 2.8, U.unit(R), R() * 0.4, 2, R()]); }
    for (var k2 = 0; k2 < 96; k2++) { var a4 = k2 * 6.2832 / 96, ln = (k2 % 8 === 0) ? 0.16 : 0.06; for (var m2 = 0; m2 < 9; m2++) ring.push([a4, 2.92 + ln * m2 / 8, U.unit(R), R() * 0.4, 2, R()]); }
    for (var h = 0; h < 360; h++) halo.push({ ax: U.unit(R), r: 0.05 + Math.pow(R(), 1.7) * 0.6, w: (0.5 + R() * 1.6) * (R() < 0.5 ? -1 : 1), ph: R() * 6.28, k: 0.02 + R() * 0.05 });
  };
  S7.draw = function (t, P) {
    E.camera(lauCam(t));
    var u = t - CUES.finaleHit;
    E.setGain(U.ss(94.8, 95.0, t));
    FX.dust(t, { seed: 71, n: 700, c: [0, 0, -6], s: [44, 26, 30], size: [0.03, 0.09], col: [1.0, 0.78, 0.48], k: 0.09 * (1 - U.ss(99, 102, t)), vel: [0.02, -0.08, 0], wob: 0.25, tw: 0.9 });
    var cy = NODE_Y;
    if (u >= 0) {
      var heat = Math.exp(-u * 2.2);
      for (var i = 0; i < ring.length; i++) {
        var r = ring[i];
        var cp = 1 - Math.pow(1 - U.remap(u, 0.05 + r[3], 1.6 + r[3] * 1.5), 4);
        var bR = (2.5 + r[5] * 3) * (1 - Math.exp(-u * 6));
        var a = r[0] + u * (r[4] === 2 ? -0.05 : 0.04);
        var tx = Math.cos(a) * r[1], ty = Math.sin(a) * r[1];
        var bx = r[2][0] * bR, by = r[2][1] * bR, bz = r[2][2] * bR * 0.4;
        var x = bx + (tx - bx) * cp, y = by + (ty - by) * cp, z = bz * (1 - cp);
        var k = (r[4] === 0 ? 0.75 : (r[4] === 1 ? 0.4 : 0.5)) * (0.75 + 0.25 * Math.sin(u * 2 + r[5] * 20)) * (1 + heat * 2);
        E.p(x, y + cy, z, r[4] === 1 ? 0.009 : 0.013, (1.0) * k, (0.74 + 0.2 * heat) * k, (0.42 + 0.4 * heat) * k, 0);
      }
    }
    // central photon (bookend)
    var ci = (u < 0 ? 2 : 1.4 + 4 * Math.exp(-u * 3)) * (1 + 0.12 * Math.sin(t * 4.4));
    E.p(0, cy, 0, 0.06, 1.9 * ci, 2.2 * ci, 3.0 * ci, 1);
    E.p(0, cy, 0, 0.55, 0.04 * ci, 0.055 * ci, 0.11 * ci, 0);
    E.p(0, cy, 0, 2.6, 0.006 * ci, 0.007 * ci, 0.012 * ci, 0);
    for (var j = 0; j < halo.length; j++) {
      var h = halo[j], ang = h.ph + t * h.w;
      var b0 = U.norm(U.cross(h.ax, [0.3, 0.9, 0.1])), b1 = U.cross(h.ax, b0);
      var hk = h.k * 1.4 * (0.6 + 0.4 * Math.sin(t * 3 + h.ph * 4));
      E.p((b0[0] * Math.cos(ang) + b1[0] * Math.sin(ang)) * h.r, cy + (b0[1] * Math.cos(ang) + b1[1] * Math.sin(ang)) * h.r, (b0[2] * Math.cos(ang) + b1[2] * Math.sin(ang)) * h.r, 0.012, 0.6 * hk, 0.75 * hk, 1.3 * hk, 0);
    }
    E.setGain(1);
    U.mixPost(P, { bg0: [0.0055, 0.0042, 0.0032], bg1: [0, 0, 0], bloom: 1.3, streak: 0.5, streakTint: [0.75, 0.82, 1.0], thresh: 0.25, vig: 0.72 }, 1);
    if (u >= 0) { P.flash = Math.max(P.flash, 0.7 * Math.exp(-u * 9)); P.flashCol = [1.0, 0.95, 0.88]; P.bloom += 2.5 * Math.exp(-u * 2); }
    P.fade = U.ss(CUES.fadeOut, 102.2, t);
  };
  UI.text({ t0: 95.7, t1: 101.0, x: 960, y: 716, align: 'center', stagger: 0.11, inDur: 1.3, blur: 14, outDur: 1.1,
    lines: [{ t: '光，成了大脑的开关。', c: 'final' }, { t: 'And light became a switch for the brain.', c: 'finalen', mode: 'line', d: 1.4 }] });
  UI.text({ t0: 97.6, t1: 101.4, x: 960, y: 890, align: 'center', stagger: 0.03, inDur: 1.0, outDur: 1.2,
    lines: [{ t: 'The Nobel Prize in Physiology or Medicine  ·  2026', c: 'endc', mode: 'line' }, { t: 'Peter Hegemann  ·  Georg Nagel  ·  Karl Deisseroth', c: 'endn', mode: 'line', d: 0.4 }] });
  UI.text({ t0: 98.2, t1: 101.4, x: 960, y: 1026, align: 'center', stagger: 0.03, inDur: 1.0, outDur: 1.2,
    lines: [{ t: '资料来源：诺贝尔奖官方公告及 Nature、STAT News 等公开报道', c: 'src', mode: 'line' }] });
})();

// persistent broadcast-style watermark
(function () {
  var wm = UI.el('div', 'wm', 'Nobel Prize 2026  ·  Physiology or Medicine'); wm.style.cssText += 'right:64px;top:52px;display:none';
  UI.hook(function (t) {
    var o = U.win(t, 15.6, 79.4, 1.0, 0.8);
    wm.style.display = o > 0.001 ? 'block' : 'none'; wm.style.opacity = o.toFixed(3);
  });
})();
