'use strict';
// ---------- S3 : membrane + channelrhodopsin ----------
var S3 = { t0: 29.95, t1: 45.85 };
(function () {
  var heads = [], tails = [], prots = [], ions = [], amb = [];
  var PROTS = [[0, 0], [-8.5, -5], [7.5, -9], [-15, -17], [14, -21], [-3, -27], [19, -4], [-20, -7]];
  var HY = 2.25; // head-group height
  S3.init = function () {
    var R = U.rng(303);
    // lipid heads on a jittered hex lattice
    var sp = 0.86;
    for (var leaf = 0; leaf < 2; leaf++) {
      for (var gz = -48; gz <= 11; gz++) for (var gx = -32; gx <= 32; gx++) {
        var x = gx * sp + (gz & 1) * sp * 0.5 + (R() - 0.5) * 0.25, z = gz * sp * 0.866 + (R() - 0.5) * 0.25;
        var skip = false;
        for (var p = 0; p < PROTS.length; p++) { var dx = x - PROTS[p][0], dz = z - PROTS[p][1]; if (dx * dx + dz * dz < 2.3 * 2.3) { skip = true; break; } }
        if (skip) continue;
        heads.push({ x: x, z: z, leaf: leaf, k: 0.7 + R() * 0.3, ph: R() * 6.28 });
        if (Math.abs(x) < 10 && z > -10 && z < 7) {
          for (var tl = 0; tl < 2; tl++) {
            var ox = (tl - 0.5) * 0.22, oz = (R() - 0.5) * 0.15, kink = (R() - 0.5) * 0.5;
            for (var m = 1; m <= 7; m++) {
              var f = m / 7;
              tails.push({ hi: heads.length - 1, dx: ox + Math.sin(f * 3 + kink) * 0.1 + (m > 4 ? kink * 0.3 : 0), dz: oz + Math.cos(f * 2.5 + kink) * 0.08, dy: f * 1.85, k: 1 - f * 0.4 });
            }
          }
        }
      }
    }
    // proteins
    for (var q = 0; q < PROTS.length; q++) {
      prots.push({ x: PROTS[q][0], z: PROTS[q][1], rot: R() * 6.28, hero: q === 0, M: q === 0 ? 200 : 80, alpha: [0, 1, 2, 3, 4, 5, 6].map(function (i) { return i * 6.2832 / 7 + (R() - 0.5) * 0.18; }) });
    }
    // ion paths per hero event
    for (var e = 0; e < CUES.chrHits.length; e++) {
      var list = [];
      for (var k = 0; k < 90; k++) {
        var a = R() * 6.2832, r0 = 2.5 + R() * 7, a2 = R() * 6.2832, r2 = 2 + R() * 9;
        list.push({ s: [Math.cos(a) * r0, 3.2 + R() * 7, Math.sin(a) * r0], end: [Math.cos(a2) * r2, -4 - R() * 6, Math.sin(a2) * r2], d: 0.04 + Math.pow(R(), 1.3) * 0.75, T: 1.0 + R() * 0.6, c: R() });
      }
      ions.push(list);
    }
    for (var j = 0; j < 320; j++) amb.push({ x: (R() - 0.5) * 30, y: 3.3 + R() * 9, z: -14 + R() * 20, ph: R() * 100, c: R() });
  };

  function und(x, z, t) { return 0.22 * U.noise3(x * 0.09, z * 0.09, t * 0.18); }
  function openState(t) {
    var o = 0;
    for (var i = 0; i < CUES.chrHits.length; i++) {
      var dt = t - CUES.chrHits[i];
      if (dt < 0 || dt > 1.6) continue;
      var v = U.ss(0, 0.07, dt) * (1 - U.ss(0.75, 1.4, dt));
      if (v > o) o = v;
    }
    return o;
  }
  function bgOpen(t, pi) {
    var o = 0;
    for (var i = 0; i < CUES.chrBg.length; i++) {
      if (CUES.chrBg[i][1] !== pi) continue;
      var dt = t - CUES.chrBg[i][0];
      if (dt < 0 || dt > 1.4) continue;
      o = Math.max(o, U.ss(0, 0.07, dt) * (1 - U.ss(0.5, 1.2, dt)));
    }
    return o;
  }
  function retinalPos(P) {
    var a = P.alpha[6] + P.rot;
    return [P.x + Math.cos(a) * 0.62, 0.25, P.z + Math.sin(a) * 0.62];
  }

  function drawProtein(P, t, open, kb) {
    var rh = 1.35 + 0.45 * open, tw = 0.28 + 0.12 * open;
    var base = P.hero ? 0.5 : 0.28;
    var kk = (base + (P.hero ? 0.75 : 0.7) * open) * kb;
    var cr = 0.28 + 0.4 * open, cg = 0.82 + 0.1 * open, cb = 1.0;
    var ends = [];
    for (var h = 0; h < 7; h++) {
      var a = P.alpha[h] + P.rot;
      var B = [P.x + rh * Math.cos(a), -2.75, P.z + rh * Math.sin(a)];
      var T = [P.x + rh * Math.cos(a + tw), 2.75, P.z + rh * Math.sin(a + tw)];
      ends.push([B, T]);
      var ax = U.norm(U.sub(T, B));
      var rad = U.norm([Math.cos(a), 0, Math.sin(a)]);
      var e1 = U.norm(U.cross(ax, rad)), e2 = U.cross(ax, e1);
      var M = P.M, strands = P.hero ? 2 : 1;
      for (var st = 0; st < strands; st++) {
        for (var m = 0; m < M; m++) {
          var s = m / (M - 1);
          var phi = s * 10 * 6.2832 + h * 1.3 + st * 0.55 + t * 0.15;
          var r = st ? 0.19 : 0.24;
          var cx = B[0] + (T[0] - B[0]) * s, cy = B[1] + (T[1] - B[1]) * s, cz = B[2] + (T[2] - B[2]) * s;
          var ox = r * (Math.cos(phi) * e1[0] + Math.sin(phi) * e2[0]), oy = r * (Math.cos(phi) * e1[1] + Math.sin(phi) * e2[1]), oz = r * (Math.cos(phi) * e1[2] + Math.sin(phi) * e2[2]);
          var k = kk * (st ? 0.6 : 1) * (0.75 + 0.25 * Math.cos(phi));
          E.p(cx + ox, cy + oy, cz + oz, 0.085, cr * k, cg * k, cb * k, 0);
        }
        // faint axis core
      }
    }
    // loops between helices
    for (var l = 0; l < 6; l++) {
      var top = l % 2 === 0;
      var p0 = top ? ends[l][1] : ends[l][0], p3 = top ? ends[l + 1][1] : ends[l + 1][0];
      var mid = U.mul(U.add(p0, p3), 0.5), outw = U.norm([mid[0] - P.x, 0, mid[2] - P.z]);
      var lift = top ? 0.9 : -0.9;
      var p1 = U.add(p0, [outw[0] * 0.6, lift, outw[2] * 0.6]), p2 = U.add(p3, [outw[0] * 0.6, lift, outw[2] * 0.6]);
      var LN = P.hero ? 46 : 20;
      for (var j = 0; j < LN; j++) {
        var q = U.bez3(p0, p1, p2, p3, j / (LN - 1));
        E.p(q[0], q[1], q[2], 0.07, cr * kk * 0.55, cg * kk * 0.55, cb * kk * 0.55, 0);
      }
    }
  }

  S3.draw = function (t, P) {
    var d0 = U.lerp(7, 21, U.eo(U.remap(t, 30, 33.4)));
    var dist = d0 - 3.8 * U.eio(U.remap(t, 33.4, 43.6));
    var ex = U.eio(U.remap(t, 43.7, 45.8));
    dist = dist + ex * 55;
    var az = U.lerp(-0.42, 0.3, U.eio(U.remap(t, 30, 44)));
    var el = U.lerp(0.36, 1.25, ex);
    var shift = 3.1 * (1 - ex);
    var tgt = [-shift * Math.cos(az), 0.5, shift * Math.sin(az)];
    var pos = U.orbit(tgt, dist, az, el);
    E.camera({ pos: pos, target: tgt, fov: 38, focus: dist, aperture: 26, maxCoc: 52 });
    var gIn = U.ss(29.95, 30.25, t) * (1 - U.ss(44.6, 45.8, t));
    E.setGain(gIn);
    var o = openState(t);

    // cumulative depolarization
    var nHit = 0; for (var hi = 0; hi < CUES.chrHits.length; hi++) if (t > CUES.chrHits[hi]) nHit++;
    var vm = Math.min(1, nHit / 5);

    // lipid heads
    for (var i = 0; i < heads.length; i++) {
      var h = heads[i];
      var y = (h.leaf ? -HY : HY) + und(h.x, h.z, t);
      var hr = Math.hypot(h.x, h.z);
      var k = 0.06 * h.k * Math.exp(-Math.max(0, hr - 10) / 12);
      var r = 0.42, g = 0.52, b = 1.0;
      if (h.leaf === 1) {
        var dd = Math.hypot(h.x, h.z), wv = 0;
        for (var e2 = 0; e2 < CUES.chrHits.length; e2++) {
          var dt = t - CUES.chrHits[e2] - 0.35;
          if (dt < 0 || dt > 2.5) continue;
          var R0 = dt * 9;
          wv += Math.exp(-Math.pow((dd - R0) / 1.6, 2)) * (1 - dt / 2.5);
        }
        var warm = Math.min(1.5, wv * 1.4 + vm * 0.55 * Math.exp(-dd / 8));
        r += warm * 0.9; g += warm * 0.35; b -= warm * 0.45; k *= 1 + warm * 1.6;
      }
      E.p(h.x, y, h.z, 0.3, r * k, g * k, b * k, 0);
    }
    for (var j = 0; j < tails.length; j++) {
      var tl = tails[j], hh = heads[tl.hi];
      var yy = (hh.leaf ? -HY : HY) + und(hh.x, hh.z, t);
      var sgn = hh.leaf ? 1 : -1;
      var kt = 0.022 * tl.k;
      E.p(hh.x + tl.dx, yy + sgn * tl.dy, hh.z + tl.dz, 0.11, 0.5 * kt, 0.55 * kt, 1.0 * kt, 0);
    }
    // proteins
    for (var p = 0; p < prots.length; p++) {
      var PR = prots[p];
      var op = PR.hero ? o : bgOpen(t, p);
      drawProtein(PR, t, op, 1);
      // retinal
      var rp = retinalPos(PR);
      var rk = (PR.hero ? 0.9 : 0.45) * (1 + 3 * op);
      var ta = PR.alpha[6] + PR.rot + 1.7;
      for (var c = 0; c < 11; c++) {
        var f = (c - 5) * 0.14;
        E.p(rp[0] + Math.cos(ta) * f, rp[1] + ((c & 1) ? 0.06 : -0.06), rp[2] + Math.sin(ta) * f, 0.1, 1.0 * rk, 0.62 * rk, 0.16 * rk, 0);
      }
      for (var rr = 0; rr < 6; rr++) {
        var aa = rr * 1.047;
        E.p(rp[0] + Math.cos(ta) * 0.95 + Math.cos(aa) * 0.16, rp[1] + Math.sin(aa) * 0.16, rp[2] + Math.sin(ta) * 0.95, 0.1, 1.0 * rk, 0.62 * rk, 0.16 * rk, 0);
      }
      if (PR.hero) UI.anchors.retinal = E.project(rp[0], rp[1], rp[2]);
    }
    UI.anchors.membrane = E.project(-6.3, HY + und(-6.3, 1.5, t), 1.5);
    UI.anchors.cations = E.project(0, -4.2, 0);
    var r0b = retinalPos(prots[0]); UI.anchors.blue = E.project(r0b[0] - 3.5 * 0.3, r0b[1] + 15 * 0.3, r0b[2] + 5 * 0.3);

    // photons
    var hero = prots[0], R0p = retinalPos(hero);
    var allHits = CUES.chrHits.map(function (x) { return [x, 0]; }).concat(CUES.chrBg);
    for (var ph = 0; ph < allHits.length; ph++) {
      var th = allHits[ph][0], pi = allHits[ph][1];
      var trg = retinalPos(prots[pi]);
      var S = [trg[0] - 3.5, trg[1] + 15, trg[2] + 5];
      var T = CUES.photonTravel;
      var u = (t - (th - T)) / T;
      if (u > 0 && u <= 1.0) {
        var dir = U.norm(U.sub(trg, S)), perp = U.norm(U.cross(dir, [0, 0, 1]));
        var L = Math.hypot(trg[0] - S[0], trg[1] - S[1], trg[2] - S[2]);
        for (var k2 = 0; k2 < 110; k2++) {
          var uu = u - k2 * 0.0045; if (uu < 0) break;
          var sd = uu * L;
          var env = Math.exp(-Math.pow(k2 / 45, 2));
          var wig = 0.22 * Math.sin(sd * 4.2) * env;
          var x = S[0] + dir[0] * sd + perp[0] * wig, y2 = S[1] + dir[1] * sd + perp[1] * wig, z = S[2] + dir[2] * sd + perp[2] * wig;
          var kk = (k2 === 0 ? 4.5 : 1.1 * env) * (pi === 0 ? 1 : 0.6);
          E.p(x, y2, z, k2 === 0 ? 0.2 : 0.09, 0.5 * kk, 0.72 * kk, 1.3 * kk, k2 === 0 ? 1 : 0);
        }
      }
      // hit flash + shockwave
      var dh = t - th;
      if (dh >= 0 && dh < 1.2) {
        var fk = Math.exp(-dh * 9) * (pi === 0 ? 7 : 3);
        E.p(trg[0], trg[1], trg[2], 0.35, 0.8 * fk, 0.9 * fk, 1.3 * fk, 1);
        E.p(trg[0], trg[1], trg[2], 2.4, 0.02 * fk, 0.03 * fk, 0.06 * fk, 0);
        var rad = dh * 7.5, sk = Math.pow(1 - dh / 1.2, 2) * (pi === 0 ? 0.5 : 0.25);
        var NN = pi === 0 ? 220 : 110;
        for (var sw = 0; sw < NN; sw++) {
          var a = sw / NN * 6.2832;
          var sx = trg[0] + Math.cos(a) * rad, sz = trg[2] + Math.sin(a) * rad;
          E.p(sx, HY + 0.35 + und(sx, sz, t), sz, 0.12, 0.4 * sk, 0.65 * sk, 1.2 * sk, 0);
        }
      }
    }
    // ions
    var ic = [[1.0, 0.6, 0.28], [1.0, 0.82, 0.48], [1.0, 0.48, 0.55]];
    var entry = [0, 3.1, 0], exit = [0, -3.1, 0];
    for (var ev = 0; ev < CUES.chrHits.length; ev++) {
      var te = CUES.chrHits[ev], list = ions[ev];
      if (t < te || t > te + 3.2) continue;
      for (var n = 0; n < list.length; n++) {
        var I = list[n];
        var uu2 = (t - te - I.d) / I.T;
        if (uu2 < -0.3 || uu2 > 1) continue;
        var col = ic[I.c < 0.6 ? 0 : (I.c < 0.85 ? 1 : 2)];
        for (var tr = 0; tr < 6; tr++) {
          var v = uu2 - tr * 0.012;
          var pos3;
          if (v < 0) { pos3 = [I.s[0] + 0.15 * Math.sin(t * 3 + n), I.s[1], I.s[2]]; }
          else if (v < 0.45) { var a3 = U.ei(v / 0.45); pos3 = U.bez3(I.s, [I.s[0] * 0.5, I.s[1] + 0.5, I.s[2] * 0.5], [0, 5.5, 0], entry, a3); }
          else if (v < 0.6) { pos3 = U.mix3(entry, exit, (v - 0.45) / 0.15); }
          else { var a4 = U.eo((v - 0.6) / 0.4); pos3 = U.bez3(exit, [0, -5, 0], [I.end[0] * 0.5, I.end[1], I.end[2] * 0.5], I.end, a4); }
          var fade = U.ss(-0.3, 0, uu2) * (1 - U.ss(0.8, 1, uu2));
          var ki = (tr === 0 ? 1.3 : 0.35 * (1 - tr / 6)) * fade;
          E.p(pos3[0], pos3[1], pos3[2], tr === 0 ? 0.15 : 0.1, col[0] * ki, col[1] * ki, col[2] * ki, 0);
        }
      }
    }
    // ambient ions above the membrane
    for (var m = 0; m < amb.length; m++) {
      var A = amb[m];
      var ax = A.x + 1.2 * U.noise3(A.ph, t * 0.25, 0), ay = A.y + 0.8 * U.noise3(A.ph, 7, t * 0.25), az = A.z + 1.2 * U.noise3(A.ph, 13, t * 0.25);
      var ka = 0.2 * (0.6 + 0.4 * Math.sin(t * 2 + A.ph));
      var cl = ic[A.c < 0.6 ? 0 : (A.c < 0.85 ? 1 : 2)];
      E.p(ax, ay, az, 0.12, cl[0] * ka, cl[1] * ka, cl[2] * ka, 0);
    }
    E.setGain(1);

    var w = U.ss(29.95, 30.3, t);
    U.mixPost(P, { bg0: [0.0022, 0.0032, 0.010], bg1: [0.0, 0.0, 0.0012], bloom: 1.2, streak: 0.4, streakTint: [0.5, 0.7, 1.0], thresh: 0.3, vig: 0.66,
      lightPos: [0.42, 1.08], lightCol: [0.012, 0.02, 0.05], lightR: 0.5 }, w);
    if (t >= 30.0) { P.flash = Math.max(P.flash * (1 - w), 0.95 * Math.exp(-(t - 30.05) * 3.2) * U.ss(30.0, 30.05, t)); P.flashCol = [1.0, 0.62, 0.32]; }
  };

  // --- text
  UI.text({ t0: 31.0, t1: 36.7, x: 132, y: 128, cls: 'shadow', stagger: 0.06, inDur: 1.1,
    lines: [{ t: '2002 — 2003', c: 'year', mode: 'line', d: 0 }, { t: '黑格曼与纳格尔发现了', c: 'h1s', d: 0.25 }, { t: '通道视紫红质', c: 'h1b', d: 0.9, st: 0.11 }, { t: 'Channelrhodopsin', c: 'en', mode: 'line', d: 1.9 }] });
  UI.text({ t0: 37.0, t1: 43.55, x: 132, y: 128, cls: 'shadow', stagger: 0.05, inDur: 1.0,
    lines: [{ t: '一种被光直接打开的', c: 'h1s', d: 0 }, { t: '离子通道', c: 'h1b', d: 0.6, st: 0.11 }, { t: 'A light-gated ion channel', c: 'en', mode: 'line', d: 1.5 }] });
  UI.callout({ t0: 31.8, t1: 36.6, anchor: 'membrane', dx: -150, dy: 150, lines: [{ t: '细胞膜', c: 'clzh' }, { t: 'Cell membrane', c: 'clen', d: 0.12 }] });
  UI.callout({ t0: 33.0, t1: 38.4, anchor: 'retinal', dx: 260, dy: -110, lines: [{ t: '视黄醛', c: 'clzh' }, { t: 'Retinal', c: 'clen', d: 0.12 }, { t: '吸收光子的“开关”分子', c: 'clsub', d: 0.25 }] });
  UI.callout({ t0: 35.7, t1: 40.6, anchor: 'cations', dx: 280, dy: 90, lines: [{ t: '阳离子涌入', c: 'clzh' }, { t: 'Na⁺  ·  H⁺  ·  Ca²⁺', c: 'clen', d: 0.12 }] });
  UI.callout({ t0: 34.55, t1: 37.3, anchor: 'blue', dx: 210, dy: -60, lines: [{ t: '蓝光光子', c: 'clzh' }, { t: 'λ ≈ 470 nm', c: 'clen', d: 0.12 }] });

  // flow tokens: 光 → 通道开启 → 离子涌入 → 电信号
  var flow = UI.el('div', ''); flow.style.cssText += 'left:960px;top:972px;transform:translateX(-50%);white-space:nowrap;display:none';
  var toks = ['光', '通道开启', '离子涌入', '电信号'], tokEls = [];
  toks.forEach(function (tk, i) {
    if (i) { var ar = document.createElement('span'); ar.className = 'arrow'; ar.textContent = '→'; flow.appendChild(ar); tokEls.push(ar); }
    var s = document.createElement('span'); s.className = 'flow'; s.textContent = tk; flow.appendChild(s); tokEls.push(s);
  });
  var tokT = [37.5, 37.58, 37.62, 37.85, 37.9, 38.3, 38.35];
  UI.hook(function (t) {
    var on = t > 36.6 && t < 43.6;
    flow.style.display = on ? 'block' : 'none';
    if (!on) return;
    flow.style.opacity = U.win(t, 36.6, 43.6, 0.7, 0.6).toFixed(3);
    for (var i = 0; i < tokEls.length; i++) {
      var a = U.ss(tokT[i], tokT[i] + 0.25, t);
      var isArrow = (i % 2) === 1;
      if (isArrow) tokEls[i].style.color = 'rgba(217,180,110,' + (0.3 + 0.6 * a).toFixed(3) + ')';
      else {
        tokEls[i].style.color = 'rgba(' + Math.round(236 + (240 - 236) * a) + ',' + Math.round(233 + (215 - 233) * a) + ',' + Math.round(226 + (158 - 226) * a) + ',' + (0.32 + 0.68 * a).toFixed(3) + ')';
        tokEls[i].style.textShadow = a > 0.01 ? '0 0 ' + (18 * a).toFixed(1) + 'px rgba(240,200,120,' + (0.55 * a).toFixed(3) + ')' : 'none';
      }
    }
  });
})();
