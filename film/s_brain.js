'use strict';
// ---------- S5 : the brain lights up ----------
var S5 = { t0: 62.4, t1: 75.9 };
(function () {
  var surf, tracts = [], REG;
  function ell(p, c, r) {
    var x = (p[0] - c[0]) / r[0], y = (p[1] - c[1]) / r[1], z = (p[2] - c[2]) / r[2];
    var k0 = Math.sqrt(x * x + y * y + z * z), k1 = Math.sqrt(x * x / (r[0] * r[0]) + y * y / (r[1] * r[1]) + z * z / (r[2] * r[2]));
    return k0 * (k0 - 1) / (k1 || 1e-6);
  }
  function smin(a, b, k) { var h = U.clamp(0.5 + 0.5 * (b - a) / k); return U.lerp(b, a, h) - k * h * (1 - h); }
  function hemi(p, s) {
    var d = ell(p, [-0.3, 0.9, s * 3.0], [7.4, 5.0, 3.2]);
    d = smin(d, ell(p, [4.6, 0.3, s * 2.9], [3.6, 3.7, 2.9]), 1.2);
    d = smin(d, ell(p, [1.0, -2.4, s * 3.35], [4.4, 2.1, 2.5]), 1.0);
    d = smin(d, ell(p, [-5.6, 0.1, s * 2.6], [2.9, 3.2, 2.5]), 1.2);
    return Math.max(d, 0.18 - s * p[2]);
  }
  function cereb(p) { return ell(p, [-5.0, -3.75, 0], [2.7, 1.55, 4.1]); }
  function stem(p) {
    var a = [-2.0, -2.6, 0], b = [-3.1, -8.5, 0], ab = U.sub(b, a), ap = U.sub(p, a);
    var h = U.clamp(U.dot(ap, ab) / U.dot(ab, ab)); var q = U.sub(ap, U.mul(ab, h));
    return Math.hypot(q[0], q[1], q[2]) - 1.15 + 0.25 * h;
  }
  function project(f, p) {
    for (var it = 0; it < 6; it++) {
      var e = 0.01, d = f(p);
      var g = [(f([p[0] + e, p[1], p[2]]) - f([p[0] - e, p[1], p[2]])) / (2 * e), (f([p[0], p[1] + e, p[2]]) - f([p[0], p[1] - e, p[2]])) / (2 * e), (f([p[0], p[1], p[2] + e]) - f([p[0], p[1], p[2] - e])) / (2 * e)];
      var gl = Math.hypot(g[0], g[1], g[2]) || 1;
      p = [p[0] - d * g[0] / gl, p[1] - d * g[1] / gl, p[2] - d * g[2] / gl];
      if (Math.abs(d) < 0.01) return [p, [g[0] / gl, g[1] / gl, g[2] / gl]];
    }
    return null;
  }
  S5.init = function () {
    var R = U.rng(512), out = [], i;
    var parts = [
      { f: function (p) { return hemi(p, 1); }, n: 17000, box: [[-9, 9], [-5.5, 6.5], [0, 7]], ty: 0 },
      { f: function (p) { return hemi(p, -1); }, n: 15000, box: [[-9, 9], [-5.5, 6.5], [-7, 0]], ty: 0 },
      { f: cereb, n: 5200, box: [[-8, -2], [-6, -2], [-4.5, 4.5]], ty: 1 },
      { f: stem, n: 800, box: [[-4.5, -1], [-9, -2], [-1.5, 1.5]], ty: 2 }
    ];
    parts.forEach(function (pt) {
      var c = 0, guard = 0;
      while (c < pt.n && guard++ < pt.n * 6) {
        var p0 = [U.lerp(pt.box[0][0], pt.box[0][1], R()), U.lerp(pt.box[1][0], pt.box[1][1], R()), U.lerp(pt.box[2][0], pt.box[2][1], R())];
        var r = project(pt.f, p0); if (!r) continue;
        var p = r[0], n = r[1];
        if (pt.ty === 1 && (hemi(p, 1) < 0 || hemi(p, -1) < 0)) continue;
        if (pt.ty === 2 && cereb(p) < 0) continue;
        var crest;
        if (pt.ty === 0) {
          var nn = U.noise3(p[0] * 0.5, p[1] * 0.5, p[2] * 0.5) + 0.45 * U.noise3(p[0] * 1.05 + 9, p[1] * 1.05, p[2] * 1.05);
          crest = Math.pow(1 - Math.min(1, Math.abs(nn) * 1.6), 2.5);
        } else if (pt.ty === 1) {
          crest = Math.pow(0.5 + 0.5 * Math.sin((p[1] + 3.75) * 9 + p[0] * 1.2), 3);
        } else crest = 0.5;
        var disp = 0.16 * crest;
        out.push(p[0] + n[0] * disp, p[1] + n[1] * disp, p[2] + n[2] * disp, crest, pt.ty, R(), n[2]);
        c++;
      }
    });
    surf = new Float32Array(out);
    // fibre tracts
    function surfPt(side, R) { for (var g = 0; g < 50; g++) { var k = Math.floor(R() * (surf.length / 7)) * 7; if (surf[k + 4] === 0 && (surf[k + 2] * side > 0.5)) return [surf[k], surf[k + 1], surf[k + 2]]; } return [0, 2, side * 3]; }
    for (i = 0; i < 260; i++) {
      var kind = i < 80 ? 0 : (i < 200 ? 1 : 2);
      var a, b, c1, c2;
      if (kind === 0) { a = surfPt(1, R); b = surfPt(-1, R); b[0] = a[0] + (R() - 0.5) * 3; c1 = [a[0] * 0.7, 1.2 + R() * 0.8, a[2] * 0.25]; c2 = [b[0] * 0.7, 1.2 + R() * 0.8, b[2] * 0.25]; }
      else if (kind === 1) { var sd = R() < 0.6 ? 1 : -1; a = surfPt(sd, R); b = surfPt(sd, R); c1 = U.mul(a, 0.45); c2 = U.mul(b, 0.45); c1[2] = a[2] * 0.6; c2[2] = b[2] * 0.6; }
      else { var sd2 = R() < 0.6 ? 1 : -1; a = surfPt(sd2, R); b = [-2.9 + (R() - 0.5) * 0.6, -6.5 - R(), (R() - 0.5) * 0.8]; c1 = [a[0] * 0.5, a[1] * 0.5, sd2 * 1.6]; c2 = [0.3, -1.0, sd2 * 1.2]; }
      var pts = [];
      for (var s = 0; s <= 70; s++) pts.push(U.bez3(a, c1, c2, b, s / 70));
      tracts.push({ pts: pts, a: a, b: b, ph: R() });
    }
    REG = [
      { p: [-0.6, -2.2, 2.7], t: CUES.apps[0] },  // hippocampus
      { p: [1.7, -2.6, 3.0], t: CUES.apps[1] },   // amygdala
      { p: [1.0, 0.3, 2.3], t: CUES.apps[2] },    // striatum / basal ganglia
      { p: [7.0, 1.6, 2.5], t: CUES.apps[3] },    // prefrontal
      { p: [-8.2, 0.6, 1.7], t: CUES.apps[4] }    // visual cortex
    ];
    tracts.forEach(function (tr) {
      tr.reg = -1; tr.fromA = true;
      for (var r = 0; r < REG.length; r++) {
        var da = Math.hypot(tr.a[0] - REG[r].p[0], tr.a[1] - REG[r].p[1], tr.a[2] - REG[r].p[2]);
        var db = Math.hypot(tr.b[0] - REG[r].p[0], tr.b[1] - REG[r].p[1], tr.b[2] - REG[r].p[2]);
        if (da < 4.2) { tr.reg = r; tr.fromA = true; break; }
        if (db < 4.2) { tr.reg = r; tr.fromA = false; break; }
      }
    });
  };

  S5.draw = function (t, P) {
    var dist = U.lerp(40, 31.5, U.eio(U.remap(t, 62.5, 75.5)));
    var az = U.lerp(0.55, -0.42, U.eio(U.remap(t, 62.5, 75.5)));
    var tgt = [0, -0.9, 0];
    var pos = U.orbit(tgt, dist, az, 0.2);
    E.camera({ pos: pos, target: tgt, fov: 32, focus: dist, aperture: 22, maxCoc: 40 });
    var gOut = 1 - U.ss(74.6, 75.8, t);
    E.setGain(U.ss(62.4, 62.5, t) * gOut);
    var u = t - CUES.drop;
    var Rv = 15 * U.eoX(U.remap(t, 62.5, 64.2));
    var dim = 1 - 0.35 * U.win(t, 62.9, 67.2, 0.6, 0.8);
    var act = REG.map(function (r) { return t >= r.t ? t - r.t : -1; });
    // surface
    for (var i = 0; i < surf.length; i += 7) {
      var x = surf[i], y = surf[i + 1], z = surf[i + 2], cr = surf[i + 3], ty = surf[i + 4], rn = surf[i + 5];
      var rr = Math.hypot(x, y + 0.5, z);
      if (rr > Rv + 1.0) continue;
      var front = Math.exp(-Math.pow((rr - Rv) / 0.9, 2)) * (Rv < 14.5 ? 1 : 0);
      var k = (0.03 + 0.24 * cr) * dim * (ty === 2 ? 0.45 : 1);
      var r = 0.35, g = 0.55, b = 1.0;
      if (ty === 1) { r = 0.45; g = 0.5; b = 1.0; k *= 0.8; }
      var sp = Math.pow(Math.max(0, Math.sin(t * (1.5 + rn * 2.5) + rn * 60)), 60) * 0.9;
      var hot = front * 1.6 + sp * 0.5;
      for (var a = 0; a < 5; a++) {
        if (act[a] < 0) continue;
        var dx = x - REG[a].p[0], dy = y - REG[a].p[1], dz = z - REG[a].p[2];
        var d2 = dx * dx + dy * dy + dz * dz;
        if (d2 > 30) continue;
        var age = act[a];
        var ring = Math.exp(-Math.pow((Math.sqrt(d2) - age * 5) / 0.7, 2)) * Math.exp(-age * 1.2);
        hot += Math.exp(-d2 / 3.2) * (0.35 + 1.4 * Math.exp(-age / 0.5)) + ring * 1.1;
      }
      E.p(x, y, z, 0.065, r * k + hot * 1.0, g * k + hot * 0.78, b * k + hot * 0.5, 0);
    }
    // tracts
    var pal = [[0.78, 0.55, 1.0], [0.3, 0.72, 1.0], [0.3, 1.0, 0.78]];
    for (var j = 0; j < tracts.length; j++) {
      var tr = tracts[j], pts = tr.pts;
      var pk = -1;
      if (tr.reg >= 0 && act[tr.reg] >= 0) pk = ((act[tr.reg] * 0.9 + tr.ph * 0.6) % 1.3);
      var base = pk >= 0 ? 0.05 : 0.028;
      for (var s = 0; s < pts.length; s++) {
        var q = pts[s];
        var rr2 = Math.hypot(q[0], q[1] + 0.5, q[2]);
        if (rr2 > Rv) continue;
        var nx = s < pts.length - 1 ? pts[s + 1] : pts[s - 1];
        var tx = Math.abs(nx[0] - q[0]), ty2 = Math.abs(nx[1] - q[1]), tz = Math.abs(nx[2] - q[2]), tl = tx + ty2 + tz + 1e-6;
        var cr2 = (pal[0][0] * tz + pal[1][0] * tx + pal[2][0] * ty2) / tl, cg = (pal[0][1] * tz + pal[1][1] * tx + pal[2][1] * ty2) / tl, cb = (pal[0][2] * tz + pal[1][2] * tx + pal[2][2] * ty2) / tl;
        var k2 = base * dim;
        var hk = 0;
        if (pk >= 0) { var f = tr.fromA ? s / 70 : 1 - s / 70; hk = Math.exp(-Math.pow((f - pk) / 0.05, 2)) * 1.4; }
        E.p(q[0], q[1], q[2], 0.06, cr2 * k2 + hk, cg * k2 + hk * 0.85, cb * k2 + hk * 0.6, 0);
      }
    }
    // optogenetic fibres into each region
    for (var a2 = 0; a2 < 5; a2++) {
      var R0 = REG[a2].p;
      var appear = U.eo(U.remap(t, REG[a2].t - 0.55, REG[a2].t));
      if (appear <= 0) continue;
      var top = [R0[0] + 2.0, R0[1] + 13, R0[2] + 4];
      var tip = U.mix3(top, R0, appear);
      for (var l = 0; l < 1; l += 0.006) {
        var fp = U.mix3(top, tip, l);
        var kf = 0.05 * U.ss(0, 0.3, l);
        E.p(fp[0], fp[1], fp[2], 0.06, 0.55 * kf, 0.65 * kf, 0.9 * kf, 0);
      }
      var on = act[a2] >= 0 ? (0.6 + 0.4 * Math.sin(act[a2] * 14)) * (1 + 3 * Math.exp(-act[a2] / 0.25)) : 0.3;
      E.p(tip[0], tip[1], tip[2], 0.22, 0.4 * on, 0.65 * on, 1.4 * on, 1);
      E.p(tip[0], tip[1], tip[2], 1.6, 0.012 * on, 0.025 * on, 0.06 * on, 0);
      UI.anchors['reg' + a2] = E.project(R0[0], R0[1], R0[2]);
    }
    E.setGain(1);

    U.mixPost(P, { bg0: [0.0022, 0.0028, 0.008], bg1: [0, 0, 0.001], bloom: 1.25, streak: 0.22, streakTint: [0.55, 0.7, 1.0], thresh: 0.5, vig: 0.62 }, U.ss(62.4, 62.5, t));
    if (t >= 62.5) { P.bloom += 3 * Math.exp(-(t - 62.5) * 2.5); P.flash = Math.max(P.flash, 0.75 * Math.exp(-(t - 62.5) * 9)); P.flashCol = [0.85, 0.92, 1.0]; }
  };

  UI.text({ t0: 62.75, t1: 67.2, x: 960, y: 390, align: 'center', cls: 'shadow', stagger: 0.14, inDur: 1.3, blur: 18, zoom: 0.08, rise: 0,
    lines: [{ t: '光遗传学', c: 'hero' }, { t: 'Optogenetics', c: 'titleen', mode: 'line', d: 1.0 }, { t: '一门新学科，由此诞生', c: 'sub', mode: 'line', d: 1.8, style: 'margin-top:26px' }] });
  var apps = [
    ['记忆', 'Memory', '海马体', -300, 150],
    ['情绪', 'Emotion', '杏仁核', 260, 170],
    ['运动 · 帕金森病', 'Movement · Parkinson’s', '基底神经节', -320, -190],
    ['抑郁', 'Depression', '前额叶皮层', 240, -150],
    ['视觉', 'Vision', '视觉皮层', -230, -90]
  ];
  apps.forEach(function (ap, i) {
    UI.callout({ t0: CUES.apps[i] + 0.05, t1: 74.7, anchor: 'reg' + i, dx: ap[3], dy: ap[4], outDur: 0.7,
      lines: [{ t: ap[0], c: 'clzh' }, { t: ap[1], c: 'clen', d: 0.1 }, { t: ap[2], c: 'clsub', d: 0.2 }] });
  });
  UI.text({ t0: 67.8, t1: 74.7, x: 960, y: 958, align: 'center', cls: 'shadow', stagger: 0.035, inDur: 0.9,
    lines: [{ t: '科学家从此能用光，精确开关特定的神经环路', c: 'sub' }, { t: 'Switching specific neural circuits on and off — with light', c: 'en2', mode: 'line', d: 1.2 }] });
})();

// ---------- S5E : the eye (2021, partial recovery of vision) ----------
var S5E = { t0: 74.8, t1: 80.85 };
(function () {
  var fib = [], catchL = [];
  S5E.init = function () {
    var R = U.rng(808);
    for (var i = 0; i < 1150; i++) {
      var th = R() * 6.2832, w = (R() - 0.5) * 0.08, wf = 2 + R() * 3, k = 0.6 + R() * 0.4;
      fib.push([th, w, wf, k, R(), 0.3 + R() * 0.7]);
    }
    for (var c = 0; c < 60; c++) { var a = R() * 6.2832, rr = Math.sqrt(R()); catchL.push([Math.cos(a) * rr * 0.55, Math.sin(a) * rr * 0.38]); }
  };
  S5E.draw = function (t, P) {
    var D = U.lerp(21, 28, U.eio(U.remap(t, 74.8, 80.8)));
    var px = 1330, ppu = 1712.6 / D, ox = -(px - 960) / ppu;
    var tgt = [ox, 0, 0];
    E.camera({ pos: [ox + 0.8 * Math.sin(t * 0.3), 0.3, D], target: tgt, fov: 35, focus: D, aperture: 18, maxCoc: 36 });
    var g = U.ss(74.8, 75.8, t) * (1 - U.ss(79.9, 80.8, t));
    E.setGain(g);
    var lt = t - CUES.eyeLight;
    var lit = lt > 0 ? 1 : 0;
    var pupil = 2.05 - 0.3 * U.eo(U.remap(lt, 0.2, 1.6));
    var wave = lt > 0 ? lt * 5.5 : -10;
    for (var i = 0; i < fib.length; i++) {
      var F = fib[i];
      var n = 38, r0 = pupil + (F[5] < 0.5 ? 0 : 0.4 * F[4]), r1 = 6.1 - (F[5] < 0.65 ? 0 : 1.6 * F[5]);
      for (var s = 0; s < n; s++) {
        var r = r0 + (r1 - r0) * ((s + F[4]) / n);
        var th = F[0] + F[1] * Math.sin(r * F[2] + F[4] * 6);
        var crypt = 0.35 + 0.65 * U.ss(-0.25, 0.35, U.noise3(Math.cos(F[0]) * 2.4, Math.sin(F[0]) * 2.4, r * 0.55));
        var inner = 1 - U.ss(2.6, 3.9, r);
        var cr = U.lerp(0.28, 1.0, inner), cg = U.lerp(0.58, 0.66, inner), cb = U.lerp(1.0, 0.3, inner);
        var k = 0.085 * F[3] * crypt * (r > 5.75 ? 0.45 : 1);
        if (Math.abs(r - 3.25) < 0.18) k *= 1.6;
        var hot = Math.exp(-Math.pow((r - wave) / 0.6, 2)) * 1.2 * Math.exp(-Math.max(0, lt) * 0.5) * lit;
        k *= 1 + 0.6 * U.ss(0, 1.5, lt) * lit;
        var z = 0.35 * (6.1 - r) / 4;
        E.p(Math.cos(th) * r, Math.sin(th) * r, z, 0.06, cr * k + hot * 1.0, cg * k + hot * 0.7, cb * k + hot * 0.35, 0);
      }
    }
    // limbal ring
    for (var l = 0; l < 900; l++) { var a = l / 900 * 6.2832; E.p(Math.cos(a) * 6.3, Math.sin(a) * 6.3, -0.1, 0.12, 0.02, 0.04, 0.09, 0); }
    // catchlight
    for (var c = 0; c < catchL.length; c++) E.p(-1.9 + catchL[c][0], 2.0 + catchL[c][1], 1.2, 0.45, 0.022, 0.024, 0.028, 0);
    // amber light entering the pupil
    if (lt > -0.35 && lt < 0.05) {
      var q = U.clamp((lt + 0.35) / 0.35);
      var zz = U.lerp(D - 3, -0.5, U.ei(q));
      E.p(0, 0, zz, 0.25, 3.0, 1.9, 0.6, 1);
    }
    if (lt > 0) {
      var gl = U.eo(U.remap(lt, 0, 0.9)) * (0.75 + 0.25 * Math.sin(lt * 3));
      E.p(0, 0, -1.2, 3.2, 0.12 * gl, 0.07 * gl, 0.022 * gl, 0);
      E.p(0, 0, -1.0, 1.0, 0.6 * gl, 0.36 * gl, 0.1 * gl, 0);
      E.p(0, 0, -0.8, 0.2, 2.2 * gl * Math.exp(-lt * 1.2), 1.5 * gl * Math.exp(-lt * 1.2), 0.5 * gl * Math.exp(-lt * 1.2), 1);
    }
    E.setGain(1);
    var w = U.ss(74.8, 75.6, t);
    U.mixPost(P, { bg0: [0.0028, 0.0024, 0.0032], bg1: [0, 0, 0.0006], bloom: 1.2, streak: 0.3, streakTint: [1.0, 0.75, 0.45], thresh: 0.5, vig: 0.7 }, w);
    if (lt >= 0) { P.flash = Math.max(P.flash, 0.12 * Math.exp(-lt * 4)); P.flashCol = [1.0, 0.75, 0.45]; }
  };
  UI.text({ t0: 75.4, t1: 80.4, x: 132, y: 392, cls: 'shadow', stagger: 0.045, inDur: 1.0,
    lines: [{ t: '2021', c: 'year', mode: 'line', d: 0 }, { t: '一位因视网膜色素变性失明的患者', c: 'h1m', d: 0.2 }, { t: '借助光遗传疗法，部分恢复了视觉', c: 'h1m', d: 1.0 }, { t: 'Partial recovery of vision after optogenetic therapy', c: 'en2', mode: 'line', d: 1.9 }] });
})();
