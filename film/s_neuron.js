'use strict';
// ---------- S4 : 2005 - ChR2 in a mammalian neuron, light-driven spikes ----------
var S4 = { t0: 44.9, t1: 62.62 };
(function () {
  var hero, bgs = [], cone = [];
  var FIB = [-17, 21, 9];
  var SOMA = [0, 0, 0];

  function rotAxis(v, k, a) { // Rodrigues
    var c = Math.cos(a), s = Math.sin(a), d = U.dot(k, v), x = U.cross(k, v);
    return [v[0] * c + x[0] * s + k[0] * d * (1 - c), v[1] * c + x[1] * s + k[1] * d * (1 - c), v[2] * c + x[2] * s + k[2] * d * (1 - c)];
  }
  function genNeuron(seed, simple) {
    var R = U.rng(seed), segs = [];
    function grow(p, dir, len, rad, depth, d0, type, trop, trunk) {
      var step = 0.7, n = Math.max(2, Math.ceil(len / step));
      var cur = p.slice(), dd = d0, pts = [cur.slice()], rs = [rad], ds = [dd];
      var nextOb = 8 + R() * 4;
      for (var i = 0; i < n; i++) {
        var nx = U.noise3(cur[0] * 0.06 + seed, cur[1] * 0.06, cur[2] * 0.06), ny = U.noise3(cur[0] * 0.06, cur[1] * 0.06 + seed + 7, cur[2] * 0.06), nz = U.noise3(cur[0] * 0.06, cur[1] * 0.06, cur[2] * 0.06 + seed + 13);
        dir = U.norm([dir[0] + nx * 0.14 + trop[0], dir[1] + ny * 0.14 + trop[1], dir[2] + nz * 0.09 + trop[2]]);
        cur = [cur[0] + dir[0] * step, cur[1] + dir[1] * step, cur[2] + dir[2] * step];
        dd += step; if (type !== 2) rad *= 0.994;
        pts.push(cur.slice()); rs.push(rad); ds.push(dd);
        if (trunk && dd > nextOb && dd < len - 8) {
          nextOb = dd + 7 + R() * 5;
          var side = U.norm([R() - 0.5, -0.2, R() - 0.5]);
          var od = U.norm(U.add(U.mul(side, 1.0), U.mul(dir, 0.5)));
          grow(cur, od, 12 + R() * 12, rad * 0.5, simple ? 0 : 1, dd, type, [0, 0.03, 0], false);
        }
        if (type === 2 && !simple && (Math.abs(dd - 32) < 0.35 || Math.abs(dd - 78) < 0.35)) {
          grow(cur, U.norm([dir[0] * 0.4, -1, (R() - 0.5)]), 26 + R() * 10, rad, 1, dd, 2, [0, -0.02, 0], false);
        }
      }
      segs.push({ pts: pts, rs: rs, ds: ds, type: type });
      if (depth > 0) {
        for (var b = 0; b < 2; b++) {
          var ax = U.norm(U.cross(dir, U.unit(R)));
          var nd = rotAxis(dir, ax, (0.3 + R() * 0.45) * (b ? 1 : -1));
          grow(cur, nd, len * (0.5 + R() * 0.3), rad * 0.72, depth - 1, dd, type, trop, false);
        }
      }
    }
    grow([0, 8.2, 0], [0.04, 1, 0.06], simple ? 45 : 62, 1.9, simple ? 2 : 3, 0, 1, [0, 0.05, 0], true);
    var nb = simple ? 4 : 6;
    for (var i = 0; i < nb; i++) {
      var a = i * 6.2832 / nb + (R() - 0.5) * 0.6;
      var dir = U.norm([Math.cos(a), -0.45 - R() * 0.4, Math.sin(a) * 0.55]);
      grow([dir[0] * 6.5, dir[1] * 7, dir[2] * 6.5], dir, 24 + R() * 14, 1.15, simple ? 1 : 2, 0, 1, [0, -0.01, 0], false);
    }
    grow([3.5, -6.8, 0.4], U.norm([0.55, -0.8, 0.1]), simple ? 90 : 165, 0.55, 0, 0, 2, [0.07, 0.02, 0], false);

    // sample to points: x,y,z,d,type,rad,rnd
    var out = [];
    var sp = simple ? 0.9 : 0.24;
    segs.forEach(function (sg) {
      for (var j = 0; j < sg.pts.length - 1; j++) {
        var a0 = sg.pts[j], a1 = sg.pts[j + 1], L = Math.hypot(a1[0] - a0[0], a1[1] - a0[1], a1[2] - a0[2]);
        var m = Math.max(1, Math.round(L / sp));
        var tdir = U.norm(U.sub(a1, a0)), pr = U.norm(U.cross(tdir, [0.3, 0.2, 1])), pr2 = U.cross(tdir, pr);
        for (var q = 0; q < m; q++) {
          var f = q / m, x = a0[0] + (a1[0] - a0[0]) * f, y = a0[1] + (a1[1] - a0[1]) * f, z = a0[2] + (a1[2] - a0[2]) * f;
          var d = sg.ds[j] + (sg.ds[j + 1] - sg.ds[j]) * f, r = sg.rs[j];
          out.push(x, y, z, d, sg.type, r, R());
          if (!simple && r > 0.45) {
            for (var rr = 0; rr < 2; rr++) {
              var an = R() * 6.2832, ca = Math.cos(an) * r, sa = Math.sin(an) * r;
              out.push(x + pr[0] * ca + pr2[0] * sa, y + pr[1] * ca + pr2[1] * sa, z + pr[2] * ca + pr2[2] * sa, d, sg.type, -1, R());
            }
          }
          if (!simple && sg.type === 1 && R() < 0.33) {
            var an2 = R() * 6.2832, l2 = r + 0.5 + R() * 0.7;
            out.push(x + (pr[0] * Math.cos(an2) + pr2[0] * Math.sin(an2)) * l2, y + (pr[1] * Math.cos(an2) + pr2[1] * Math.sin(an2)) * l2, z + (pr[2] * Math.cos(an2) + pr2[2] * Math.sin(an2)) * l2, d, 1, -2, R());
          }
        }
      }
    });
    // soma
    var ns = simple ? 500 : 3400;
    for (var s = 0; s < ns; s++) {
      var u = U.unit(R);
      var sy = u[1] > 0 ? 8.5 * (1 - 0.15 * u[1]) : 7.2;
      out.push(u[0] * 7 * (1 - 0.25 * Math.max(0, u[1])), u[1] * sy, u[2] * 6.6 * (1 - 0.25 * Math.max(0, u[1])), 0, 0, 7, R());
    }
    if (!simple) for (var s2 = 0; s2 < 500; s2++) { var u2 = U.unit(R); out.push(u2[0] * 3.1, u2[1] * 3.1 - 0.5, u2[2] * 3.1, 0, 3, 3, R()); }
    return new Float32Array(out);
  }

  S4.init = function () {
    hero = genNeuron(5, false);
    var R = U.rng(91);
    for (var i = 0; i < 7; i++) {
      var pos = [(R() - 0.5) * 330, (R() - 0.5) * 170, -130 - R() * 170];
      var times = [];
      var tt = 55.6 + R() * 1.5;
      while (tt < 62.4) { times.push(tt); tt += Math.max(0.12, (1.6 - (tt - 55) * 0.2) * (0.5 + R())); }
      bgs.push({ pts: genNeuron(100 + i, true), pos: pos, ry: R() * 6.28, rz: (R() - 0.5) * 0.6, times: times });
    }
    var ax = U.norm(U.sub(SOMA, FIB)), p1 = U.norm(U.cross(ax, [0, 0, 1])), p2 = U.cross(ax, p1);
    for (var c = 0; c < 2800; c++) {
      var s = Math.pow(R(), 0.8) * 36, rr = Math.sqrt(R()) * Math.tan(0.24) * s + 0.5, an = R() * 6.2832;
      cone.push([FIB[0] + ax[0] * s + (p1[0] * Math.cos(an) + p2[0] * Math.sin(an)) * rr, FIB[1] + ax[1] * s + (p1[1] * Math.cos(an) + p2[1] * Math.sin(an)) * rr, FIB[2] + ax[2] * s + (p1[2] * Math.cos(an) + p2[2] * Math.sin(an)) * rr, s / 36, R()]);
    }
  };

  function pulseEnv(t) {
    var v = 0, P = CUES.pulses;
    for (var i = 0; i < P.length; i++) {
      var a = t - P[i]; if (a < 0 || a > 0.5) continue;
      var e = a < 0.006 ? a / 0.006 : Math.exp(-(a - 0.006) / 0.05);
      if (e > v) v = e;
    }
    return v;
  }
  function apWave(a) { // normalized membrane potential deflection of a spike
    if (a < 0) return 0;
    if (a < 0.0012) return a / 0.0012;
    if (a < 0.0035) return 1 - (a - 0.0012) / 0.0023 * 1.28;
    return -0.28 * Math.exp(-(a - 0.0035) / 0.028);
  }
  S4.pulseEnv = pulseEnv;

  function camFor(t) {
    var D = U.lerp(122, 100, U.eio(U.remap(t, 45, 58)));
    var pull = U.eiX(U.remap(t, 60.0, 62.55));
    D += pull * 260;
    var az = U.lerp(-0.18, 0.14, U.eio(U.remap(t, 45, 62)));
    var tgt = [-14 * (1 - pull), -5 * (1 - pull), 0];
    var pos = U.orbit(tgt, D, az, 0.1 + pull * 0.1);
    return { pos: pos, target: tgt, fov: 36, focus: D, aperture: 38, maxCoc: 54, D: D };
  }

  S4.draw = function (t, P) {
    var cam = camFor(t);
    E.camera(cam);
    var gIn = U.ss(44.9, 46.2, t) * (1 - 0.75 * U.ss(62.2, 62.5, t));
    E.setGain(gIn);
    var pe = pulseEnv(t);
    var scopeVis = U.win(t, 49.4, 62.3, 0.8, 0.5);
    var spk = [], i;
    for (i = 0; i < CUES.pulses.length; i++) { var ts = CUES.pulses[i] + CUES.spikeLatency; if (t >= ts && t - ts < 2.4) spk.push(t - ts); }

    // background neurons
    for (var b = 0; b < bgs.length; b++) {
      var bn = bgs[b], pts = bn.pts, cy = Math.cos(bn.ry + t * 0.02), sy = Math.sin(bn.ry + t * 0.02);
      var fl = 0, ages = [];
      for (i = 0; i < bn.times.length; i++) { var ag = t - bn.times[i]; if (ag >= 0 && ag < 1.6) { ages.push(ag); fl += Math.exp(-ag / 0.12); } }
      for (var j = 0; j < pts.length; j += 7) {
        var x = pts[j], y = pts[j + 1], z = pts[j + 2], d = pts[j + 3];
        var X = x * cy + z * sy, Z = -x * sy + z * cy;
        var k = 0.07, gl = 0;
        for (var a2 = 0; a2 < ages.length; a2++) gl += Math.exp(-Math.pow((d - ages[a2] * 140) / 8, 2)) * (pts[j + 4] === 2 ? 1 : 0.4);
        gl += fl * (pts[j + 4] === 0 ? 1 : 0.2);
        E.p(X + bn.pos[0], y + bn.pos[1], Z + bn.pos[2], 1.0, (0.4 * k + gl * 0.5), (0.55 * k + gl * 0.42), (1.0 * k + gl * 0.3), 0);
      }
    }

    // hero neuron
    E.setMask([180, 845, 1760, 1035], 0.88 * scopeVis, 46);
    var ang = U.lerp(-0.25, 0.2, U.eio(U.remap(t, 45, 62.5)));
    var ca = Math.cos(ang), sa = Math.sin(ang);
    var exT = t - 47.6;
    for (var p = 0; p < hero.length; p += 7) {
      var hx = hero[p], hy = hero[p + 1], hz = hero[p + 2], hd = hero[p + 3], ty = hero[p + 4], hr = hero[p + 5], rn = hero[p + 6];
      var X2 = hx * ca + hz * sa, Z2 = -hx * sa + hz * ca;
      var ex = U.ss(0, 6, exT * 34 - hd);
      var base = ty === 3 ? 0.035 : (hr === -2 ? 0.1 : (ty === 0 ? 0.13 : 0.15));
      var r = U.lerp(0.42, 0.28, ex) * base, g = U.lerp(0.58, 0.95, ex) * base, bl = U.lerp(1.0, 0.92, ex) * base;
      // opsin sparkle
      if (rn < 0.14 && ex > 0) { var sp = Math.pow(0.5 + 0.5 * Math.sin(t * 5 + rn * 300), 10) * 0.6 * ex; r += 0.3 * sp; g += 1.0 * sp; bl += 0.9 * sp; }
      // light wash
      if (pe > 0.01) { var dsm = Math.hypot(hx, hy - 4, hz); var wsh = pe * 0.55 * Math.exp(-dsm / 22) * (0.3 + 0.7 * ex); r += 0.3 * wsh; g += 0.55 * wsh; bl += 1.2 * wsh; }
      // spikes
      var glow = 0;
      for (var s = 0; s < spk.length; s++) {
        var a = spk[s];
        if (ty === 0 || ty === 3) glow += Math.exp(-a / 0.08) * (ty === 3 ? 0.25 : 0.6);
        else if (ty === 2) { var fr = a * 165; var dx = (hd - fr) / 6; if (dx > -3 && dx < 3) glow += Math.exp(-dx * dx) * 1.5; }
        else { var fr2 = a * 75; var dx2 = (hd - fr2) / 4.5; if (dx2 > -3 && dx2 < 3) glow += Math.exp(-dx2 * dx2) * 0.8 * Math.exp(-hd / 70); }
      }
      if (glow > 0) { r += glow * 1.0; g += glow * 0.82; bl += glow * 0.55; }
      var sz = hr === -2 ? 0.32 : (ty === 0 ? 0.36 : 0.3);
      E.p(X2, hy, Z2, sz, r, g, bl, 0);
    }
    E.setMask([0, 0, 0, 0], 0);

    // DNA helix flying into the soma
    if (t < 48.6) {
      var gP = U.eio(U.remap(t, 45.0, 47.9));
      var P0 = [-160, 100, 10], P1 = [-95, 62, 22], P2 = [-36, 30, 10], P3 = [-2, 4, 0];
      var PL = 200, LEN = 44;
      var headPos = null;
      for (var sdn = 0; sdn < LEN; sdn += 0.11) {
        var u = gP * 1.05 - sdn / PL;
        if (u < 0) break;
        var uc = Math.min(u, 1);
        var c0 = U.bez3(P0, P1, P2, P3, uc), c1 = U.bez3(P0, P1, P2, P3, Math.min(1, uc + 0.01));
        var T = U.norm(U.sub(c1, c0)); if (u >= 1) T = U.norm(U.sub(P3, P2));
        var N = U.norm(U.cross(T, [0, 0, 1])), Bv = U.cross(T, N);
        var phi = sdn * 6.2832 / 9 + t * 2.4;
        var dis = u > 0.985 ? U.ss(0.985, 1.05, u) : 0;
        var fade = (1 - dis) * U.ss(0, 2, sdn) * U.ss(LEN, LEN - 4, sdn);
        if (headPos === null) headPos = c0;
        var scat = 1 + dis * 6;
        for (var st = 0; st < 2; st++) {
          var ph = phi + st * 2.4;
          var px = c0[0] + (N[0] * Math.cos(ph) + Bv[0] * Math.sin(ph)) * 2.7 * scat, py = c0[1] + (N[1] * Math.cos(ph) + Bv[1] * Math.sin(ph)) * 2.7 * scat, pz = c0[2] + (N[2] * Math.cos(ph) + Bv[2] * Math.sin(ph)) * 2.7 * scat;
          var kd = 0.5 * fade;
          E.p(px, py, pz, 0.42, 0.75 * kd, 0.72 * kd, 1.0 * kd, 0);
        }
        if (Math.abs((sdn % 0.66)) < 0.11) {
          for (var rg = 1; rg < 8; rg++) {
            var f = rg / 8;
            var a1 = phi, a3 = phi + 2.4;
            var qx = U.lerp(Math.cos(a1), Math.cos(a3), f), qy = U.lerp(Math.sin(a1), Math.sin(a3), f);
            var kr = 0.22 * fade * (0.6 + 0.4 * Math.sin(sdn * 3));
            E.p(c0[0] + (N[0] * qx + Bv[0] * qy) * 2.7 * scat, c0[1] + (N[1] * qx + Bv[1] * qy) * 2.7 * scat, c0[2] + (N[2] * qx + Bv[2] * qy) * 2.7 * scat, 0.26, 1.0 * kr, 0.78 * kr, 0.45 * kr, 0);
          }
        }
      }
      if (headPos) UI.anchors.gene = E.project(headPos[0], headPos[1], headPos[2]);
      // arrival bloom
      var arr = U.ss(47.3, 47.9, t) * (1 - U.ss(47.9, 48.8, t));
      E.p(0, 0, 0, 24, 0.0, 0.03 * arr, 0.03 * arr, 0);
    }

    // optical fiber + light cone
    var fin = U.eo(U.remap(t, CUES.fiberIn, CUES.fiberIn + 1.3));
    if (fin > 0) {
      var axd = U.norm(U.sub(SOMA, FIB));
      var tip = U.sub(FIB, U.mul(axd, (1 - fin) * 70));
      var p1 = U.norm(U.cross(axd, [0, 0, 1]));
      for (var fl2 = 0; fl2 < 110; fl2 += 0.35) {
        var bp = U.sub(tip, U.mul(axd, fl2));
        var kf = 0.14 * fin * U.ss(110, 80, fl2);
        E.p(bp[0] + p1[0] * 1.3, bp[1] + p1[1] * 1.3, bp[2] + p1[2] * 1.3, 0.25, 0.6 * kf, 0.68 * kf, 0.8 * kf, 0);
        E.p(bp[0] - p1[0] * 1.3, bp[1] - p1[1] * 1.3, bp[2] - p1[2] * 1.3, 0.25, 0.6 * kf, 0.68 * kf, 0.8 * kf, 0);
        var kc = (0.03 + 0.5 * pe * Math.exp(-fl2 / 25)) * fin;
        E.p(bp[0], bp[1], bp[2], 0.3, 0.3 * kc, 0.55 * kc, 1.2 * kc, 0);
      }
      var tk = (0.25 + 5 * pe) * fin;
      E.p(tip[0], tip[1], tip[2], 0.9, 0.35 * tk, 0.6 * tk, 1.3 * tk, 1);
      if (pe > 0.01) {
        for (var cc = 0; cc < cone.length; cc++) {
          var C = cone[cc];
          var kk = pe * 0.2 * Math.pow(1 - C[3], 1.2) * (0.5 + C[4]);
          E.p(C[0], C[1], C[2], 0.45, 0.3 * kk, 0.55 * kk, 1.2 * kk, 0);
        }
      }
      UI.anchors.fiber = E.project(tip[0], tip[1], tip[2]);
    }
    UI.anchors.somaS = E.project(0, 0, 0);

    // oscilloscope (screen space)
    if (scopeVis > 0.001) {
      E.camera({ ortho: true });
      E.setGain(scopeVis * gIn);
      var X0 = 230, X1 = 1730, WIN = 2.4, pps = (X1 - X0) / WIN, base = 986, amp = 84, ly = 873;
      var tStart = 49.6;
      // baseline dotted + light row line
      for (var bx = X0; bx <= X1; bx += 6) { E.p(bx, base + 30, 0, 1.4, 0.05, 0.06, 0.08, 0); }
      var prevMin = base, prevMax = base;
      for (var px2 = 0; px2 <= X1 - X0; px2++) {
        var tau0 = t - WIN + px2 / pps;
        if (tau0 < tStart) continue;
        var vmin = 1e9, vmax = -1e9;
        for (var sub = 0; sub < 4; sub++) {
          var tau = tau0 + sub / (4 * pps);
          var v = 0;
          for (var q2 = 0; q2 < CUES.pulses.length; q2++) {
            var aa = tau - CUES.pulses[q2] - CUES.spikeLatency;
            if (aa < -0.012 || aa > 0.25) continue;
            if (aa < 0) v += 0.18 * (1 + aa / 0.012);
            else v += apWave(aa);
          }
          v += 0.012 * Math.sin(tau * 377) + 0.01 * (U.hash(Math.floor(tau * 1600)) - 0.5);
          var yy = base - v * amp;
          if (yy < vmin) vmin = yy; if (yy > vmax) vmax = yy;
        }
        var age = 1 - px2 / (X1 - X0);
        var kt = (0.25 + 0.75 * Math.pow(1 - age, 0.6)) * 0.55;
        var lo = Math.min(vmin, prevMax), hi = Math.max(vmax, prevMin);
        if (hi - lo < 1) { lo = vmin; hi = vmax; }
        for (var yv = lo; yv <= hi + 0.01; yv += 1.2) E.p(X0 + px2, yv, 0, 1.8, 0.62 * kt, 0.85 * kt, 1.0 * kt, 0);
        prevMin = vmin; prevMax = vmax;
      }
      // write head
      E.p(X1, base, 0, 7, 0.4, 0.6, 1.0, 1);
      // light pulses row
      for (var q3 = 0; q3 < CUES.pulses.length; q3++) {
        var tp = CUES.pulses[q3];
        if (tp < t - WIN || tp > t) continue;
        var xx = X0 + (tp - (t - WIN)) * pps;
        var fresh = Math.exp(-(t - tp) / 0.25);
        for (var wy = 0; wy < 16; wy += 1.5) for (var wx = 0; wx < 4; wx += 1.3) {
          var kb = 0.45 + 1.4 * fresh;
          E.p(xx + wx, ly + wy, 0, 1.8, 0.3 * kb, 0.55 * kb, 1.15 * kb, 0);
        }
      }
      for (var lx = X0; lx <= X1; lx += 6) E.p(lx, ly + 22, 0, 1.3, 0.03, 0.045, 0.08, 0);
    }
    E.setGain(1);

    var w = U.ss(44.9, 45.6, t);
    var fibS = UI.anchors.fiber ? [UI.anchors.fiber[0] / 1920, 1 - UI.anchors.fiber[1] / 1080] : [0.2, 0.8];
    U.mixPost(P, { bg0: [0.0016, 0.0024, 0.0078], bg1: [0, 0, 0.001], bloom: 1.2, streak: 0.16, streakTint: [0.5, 0.7, 1.0], thresh: 0.6, vig: 0.66,
      lightPos: fibS, lightCol: [0.03 * pe, 0.06 * pe, 0.16 * pe], lightR: 0.22 }, w);
  };

  // --- text
  UI.text({ t0: 45.6, t1: 49.6, x: 132, y: 760, cls: 'shadow', stagger: 0.05, inDur: 1.0,
    lines: [{ t: '2005', c: 'year', mode: 'line', d: 0 }, { t: '戴瑟罗特团队将这段藻类基因', c: 'h1s', d: 0.2 }, { t: '导入了哺乳动物的神经元', c: 'h1s', d: 0.75 }, { t: 'Karl Deisseroth  ·  Stanford', c: 'en', mode: 'line', d: 1.6 }] });
  UI.text({ t0: 50.2, t1: 55.7, x: 132, y: 128, cls: 'shadow', stagger: 0.06, inDur: 1.0,
    lines: [{ t: '蓝光一闪', c: 'h1b', d: 0, st: 0.1 }, { t: '神经元随之放电', c: 'h1s', d: 0.8 }, { t: 'One flash  ·  one spike', c: 'en', mode: 'line', d: 1.6 }] });
  UI.text({ t0: 56.1, t1: 61.7, x: 132, y: 128, cls: 'shadow', stagger: 0.06, inDur: 1.0,
    lines: [{ t: '精确到毫秒', c: 'h1b', d: 0, st: 0.1 }, { t: '按需开关特定的神经元', c: 'h1s', d: 0.8 }, { t: 'Millisecond precision', c: 'en', mode: 'line', d: 1.6 }] });
  UI.callout({ t0: 45.7, t1: 47.9, anchor: 'gene', dx: 230, dy: -70, lines: [{ t: 'ChR2 基因', c: 'clzh' }, { t: 'Channelrhodopsin-2 gene', c: 'clen', d: 0.12 }] });
  UI.callout({ t0: 49.4, t1: 53.6, anchor: 'fiber', dx: 240, dy: -40, lines: [{ t: '光纤 · 蓝光', c: 'clzh' }, { t: 'Optical fiber  ·  470 nm', c: 'clen', d: 0.12 }] });

  // scope labels
  var lab1 = UI.el('div', 'scopezh', '蓝光脉冲'); lab1.style.cssText += 'left:96px;top:872px;display:none';
  var lab1e = UI.el('div', 'scopel', 'Light'); lab1e.style.cssText += 'left:96px;top:892px;display:none';
  var lab2 = UI.el('div', 'scopezh', '膜电位'); lab2.style.cssText += 'left:96px;top:952px;display:none';
  var lab2e = UI.el('div', 'scopel', 'Vm'); lab2e.style.cssText += 'left:96px;top:972px;display:none';
  var sbar = UI.el('div', ''); sbar.style.cssText += 'left:1605px;top:1036px;width:125px;height:1px;background:rgba(236,233,226,.55);display:none';
  var sbl = UI.el('div', 'scopel', '200 ms'); sbl.style.cssText += 'left:1605px;top:1046px;display:none';
  UI.hook(function (t) {
    var v = U.win(t, 49.6, 62.3, 0.9, 0.5);
    [lab1, lab1e, lab2, lab2e, sbar, sbl].forEach(function (e) { e.style.display = v > 0.001 ? 'block' : 'none'; e.style.opacity = v.toFixed(3); });
  });
})();
