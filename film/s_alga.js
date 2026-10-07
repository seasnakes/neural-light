'use strict';
// ---------- S2 : Chlamydomonas swimming toward light ----------
var S2 = { t0: 15.0, t1: 30.45 };
(function () {
  var A = 5.0, B = 3.9, FL = 11.0;
  var wall, chl, org, eyeG; // body-frame point sets
  var path = null; // precomputed swim path
  var DT = 1 / 240, TS = 14.9;
  var L3 = U.norm([-0.86, 0.47, 0.18]); // direction toward the light source

  function rad(x) { var u = x / A; if (Math.abs(u) >= 1) return 0; return B * Math.sqrt(1 - u * u) * (1 - 0.07 * u); }

  S2.init = function () {
    var R = U.rng(21), i, d, x, y, z, rr;
    // cell wall: [x,y,z,nx,ny,nz,k]
    var w = [];
    for (i = 0; i < 6200; i++) {
      d = U.unit(R);
      var sc = 1 - 0.07 * d[0];
      x = A * d[0]; y = B * d[1] * sc; z = B * d[2] * sc;
      var n = U.norm([d[0] / A, d[1] / B, d[2] / B]);
      w.push(x, y, z, n[0], n[1], n[2], 0.6 + R() * 0.4);
    }
    // anterior papilla
    for (i = 0; i < 120; i++) { d = U.unit(R); w.push(A + 0.12 + d[0] * 0.3, d[1] * 0.35, d[2] * 0.35, d[0], d[1], d[2], 0.8); }
    wall = new Float32Array(w);
    // chloroplast cup: [x,y,z,k]
    var c = [];
    for (i = 0; c.length < 9000 * 4 && i < 200000; i++) {
      d = U.unit(R);
      var rho = 0.3 + R() * 0.64;
      x = A * rho * d[0] * 0.97; y = B * rho * d[1] * 0.97; z = B * rho * d[2] * 0.97;
      var minR = x < -1.4 ? 0.3 : 0.62;
      if (rho < minR) continue;
      if (x > 2.3 - (0.94 - rho) * 2.5) continue;
      var lam = 0.5 + 0.5 * Math.sin(rho * 58 + 2.6 * U.noise3(x * 0.55, y * 0.55, z * 0.55));
      c.push(x, y, z, 0.18 + 0.82 * Math.pow(lam, 3));
    }
    chl = new Float32Array(c);
    // organelles: [x,y,z,type,k]  type 0 pyrenoid,1 starch,2 nucleus,3 nucleolus,4 vacuole1,5 vacuole2
    var o = [];
    for (i = 0; i < 520; i++) { d = U.unit(R); rr = 0.95; o.push(-2.45 + d[0] * rr, d[1] * rr, d[2] * rr, 0, 0.7 + R() * 0.3); }
    for (i = 0; i < 180; i++) { d = U.unit(R); rr = R() * 0.85; o.push(-2.45 + d[0] * rr, d[1] * rr, d[2] * rr, 0, 0.35); }
    for (i = 0; i < 320; i++) { d = U.unit(R); rr = 1.12 + R() * 0.12; if (U.noise3(d[0] * 2.5, d[1] * 2.5, d[2] * 2.5) < 0.1) continue; o.push(-2.45 + d[0] * rr, d[1] * rr, d[2] * rr, 1, 0.6); }
    for (i = 0; i < 700; i++) { d = U.unit(R); rr = 1.28; o.push(1.05 + d[0] * rr, d[1] * rr * 0.95, d[2] * rr * 0.95, 2, 0.5 + R() * 0.5); }
    for (i = 0; i < 140; i++) { d = U.unit(R); rr = Math.cbrt(R()) * 0.42; o.push(1.15 + d[0] * rr, 0.2 + d[1] * rr, 0.1 + d[2] * rr, 3, 1); }
    for (i = 0; i < 110; i++) { d = U.unit(R); o.push(3.85 + d[0] * 0.42, 0.85 + d[1] * 0.42, 0.45 + d[2] * 0.42, 4, 1); }
    for (i = 0; i < 110; i++) { d = U.unit(R); o.push(3.85 + d[0] * 0.42, -0.85 + d[1] * 0.42, 0.45 + d[2] * 0.42, 5, 1); }
    org = new Float32Array(o);
    // eyespot: carotenoid globule layers on the +y side, at x=0.4
    var e = [], ex = 0.4, ey = rad(0.4) - 0.16;
    for (var L = 0; L < 3; L++) {
      for (var gx = -6; gx <= 6; gx++) for (var gz = -6; gz <= 6; gz++) {
        var px = gx * 0.1 + (gz & 1) * 0.05, pz = gz * 0.087;
        if ((px * px) / (0.58 * 0.58) + (pz * pz) / (0.46 * 0.46) > 1) continue;
        e.push(ex + px, ey - L * 0.075 - (px * px + pz * pz) * 0.12, pz, L);
      }
    }
    eyeG = new Float32Array(e);
    buildPath();
  };

  // swimming path integration
  function beatPhase(t) { return ((t - 15) * 1.65) % 1; }
  function hFree(t) { return 0.28 + 0.32 * Math.sin(0.62 * (t - 15)) + 0.1 * Math.sin(1.7 * (t - 15)); }
  var hL = Math.atan2(L3[1], L3[0]);
  function heading(t) { return U.lerp(hFree(t), hL + 0.12 * Math.sin(1.1 * t), U.eio(U.remap(t, 19.9, 23.0))); }
  function speed(t) { return U.lerp(1.3, 3.0, U.ss(21.0, 23.5, t)) * (1 - 0.75 * U.ss(27.6, 28.8, t)); }
  function buildPath() {
    var n = Math.ceil((31 - TS) / DT) + 2;
    path = { x: new Float32Array(n), y: new Float32Array(n), h: new Float32Array(n), cx: new Float32Array(n), cy: new Float32Array(n) };
    var x = 0, y = 0, cx = 0, cy = 0;
    for (var i = 0; i < n; i++) {
      var t = TS + i * DT;
      var h = heading(t), ph = beatPhase(t);
      var pw = ph < 0.42 ? Math.sin(Math.PI * ph / 0.42) : -0.18 * Math.sin(Math.PI * (ph - 0.42) / 0.58);
      var v = speed(t) * (0.3 + 1.55 * pw);
      x += Math.cos(h) * v * DT; y += Math.sin(h) * v * DT;
      var k = 1 - Math.exp(-DT / 0.9);
      if (i === 0) { cx = x; cy = y; }
      cx += (x - cx) * k; cy += (y - cy) * k;
      path.x[i] = x; path.y[i] = y; path.h[i] = h; path.cx[i] = cx; path.cy[i] = cy;
    }
  }
  function at(arr, t) { var f = (t - TS) / DT, i = Math.floor(f), a = f - i; i = Math.max(0, Math.min(arr.length - 2, i)); return arr[i] + (arr[i + 1] - arr[i]) * a; }

  // spin angle about the long axis; freezes with the eyespot facing the camera before the dive
  function spin(t) {
    var raw = 6.2832 * 0.42 * (t - 15) + 1.3;
    var tgt = 6.2832 * Math.round((6.2832 * 0.42 * (28.4 - 15) + 1.3) / 6.2832);
    return U.lerp(raw, tgt, U.eio(U.remap(t, 26.6, 28.4)));
  }

  // flagellum shape in body (x,z) plane; returns flat [x,z,...]
  function flag(ph, side, out) {
    var P = 0.42, N = 140, ds = FL / N, th0, x = A - 0.05, z = side * 0.26, idx = 0;
    var back = 2.75;
    var q;
    if (ph < P) { q = U.eio(ph / P); th0 = U.lerp(0.38, back, q); }
    else { q = U.eio((ph - P) / (1 - P)); th0 = U.lerp(back, 0.38, q); }
    var front = (FL + 4) * q - 2;
    for (var i = 0; i < N; i++) {
      var s = i * ds, th;
      if (ph < P) th = th0 + 0.42 * (s / FL) * Math.sin(Math.PI * q);
      else th = th0 + (back - th0) / (1 + Math.exp(-(s - front) / 1.1));
      out[idx++] = x; out[idx++] = z;
      x += Math.cos(th) * ds; z += side * Math.sin(th) * ds;
    }
    return N;
  }
  var fbuf = new Float32Array(400);

  function cellFrame(t) {
    var h = at(path.h, t), ps = spin(t);
    var f = [Math.cos(h), Math.sin(h), 0];
    var u0 = [0, 0, 1], w0 = U.cross(f, u0);
    var c = Math.cos(ps), s = Math.sin(ps);
    var u = [c * u0[0] + s * w0[0], c * u0[1] + s * w0[1], c * u0[2] + s * w0[2]];
    var w = [-s * u0[0] + c * w0[0], -s * u0[1] + c * w0[1], -s * u0[2] + c * w0[2]];
    var cx = at(path.x, t), cy = at(path.y, t);
    return { c: [cx, cy, 0], f: f, u: u, w: w };
  }
  function toW(F, x, y, z) {
    return [F.c[0] + x * F.f[0] + y * F.u[0] + z * F.w[0], F.c[1] + x * F.f[1] + y * F.u[1] + z * F.w[1], F.c[2] + x * F.f[2] + y * F.u[2] + z * F.w[2]];
  }

  S2.draw = function (t, P) {
    var F = cellFrame(t);
    var light = U.ss(19.5, 21.3, t);
    var D = 44, hw = D * Math.tan(17.5 * Math.PI / 180);
    var scx = at(path.cx, t), scy = at(path.cy, t);
    var tgt = [scx - 0.2 * hw * 1.7778 * 0.5, scy - 0.2 * hw * 0.5 * 1.1, 0];
    var camPos = [tgt[0] + 7 * Math.sin(0.17 * t), tgt[1] - 3.5 + 1.2 * Math.sin(0.11 * t), D];
    var focus = D, ap = 46;
    // dive into the eyespot
    var es = toW(F, 0.4, rad(0.4) - 0.1, 0), en = F.u;
    var q1 = U.eio(U.remap(t, 28.2, 29.2));
    var q2 = U.eiX(U.remap(t, 29.0, 30.3));
    if (q1 > 0) {
      var dd = U.lerp(16, 0.35, q2);
      var swoopPos = [es[0] + en[0] * dd + 0.6, es[1] + en[1] * dd - 0.4, es[2] + en[2] * dd];
      camPos = U.mix3(camPos, swoopPos, q1);
      tgt = U.mix3(tgt, es, q1);
      focus = U.lerp(D, dd, q1);
      ap = U.lerp(46, 70, q1);
    }
    E.camera({ pos: camPos, target: tgt, fov: 35, focus: focus, aperture: ap, maxCoc: 60 });
    var gIn = U.ss(15.0, 16.4, t);
    E.setGain(gIn);
    var view = U.norm(U.sub(camPos, F.c));

    // --- environment: debris & far cells
    var off = [tgt[0], tgt[1], 0];
    FX.dust(t, { seed: 31, n: 1500, c: [0, 0, -6], off: [-off[0], -off[1], 0], s: [110, 70, 60], size: [0.18, 0.55], col: [0.55, 0.78, 0.82], k: 0.075, vel: [0.12, 0.05, 0.02], wob: 0.4 });
    // light rays (haze aligned with light direction)
    if (light > 0) {
      var R = U.rng(44), ld = [0.88, -0.48], lp = [0.48, 0.88];
      for (var i = 0; i < 2600; i++) {
        var x = (R() - 0.5) * 120, y = (R() - 0.5) * 80, z = (R() - 0.5) * 50 - 8, ph = R() * 6.28;
        x += ld[0] * t * 5; y += ld[1] * t * 5;
        x = U.wrap(x - off[0], 120) + off[0]; y = U.wrap(y - off[1], 80) + off[1];
        var band = 0.5 + 0.5 * Math.sin((x * lp[0] + y * lp[1]) * 0.21 + 2.2 * U.noise3(x * 0.03, y * 0.03, 0.2));
        var k = Math.pow(band, 7) * 0.09 * light * (0.6 + 0.4 * Math.sin(t * 2 + ph));
        E.p(x, y, z, 0.25 + R() * 0.35, 0.55 * k, 0.75 * k, 1.0 * k, 0);
      }
    }
    // far blurred cells
    var Rf = U.rng(9);
    for (var fc = 0; fc < 5; fc++) {
      var bx = (Rf() - 0.5) * 140 + 0, by = (Rf() - 0.5) * 80, bz = -70 - Rf() * 90;
      bx = U.wrap(bx - off[0] * 0.6 + t * 0.8, 160) + off[0]; by = U.wrap(by - off[1] * 0.6, 100) + off[1];
      for (var j = 0; j < 30; j++) { var dj = U.unit(Rf); E.p(bx + dj[0] * 4, by + dj[1] * 3, bz + dj[2] * 3, 1.2, 0.02, 0.07, 0.035, 0); }
    }

    // --- the cell
    var lit = 1 + 0.35 * light;
    // wall rim
    for (var a = 0; a < wall.length; a += 7) {
      var p = toW(F, wall[a], wall[a + 1], wall[a + 2]);
      var nw = [wall[a + 3] * F.f[0] + wall[a + 4] * F.u[0] + wall[a + 5] * F.w[0], wall[a + 3] * F.f[1] + wall[a + 4] * F.u[1] + wall[a + 5] * F.w[1], wall[a + 3] * F.f[2] + wall[a + 4] * F.u[2] + wall[a + 5] * F.w[2]];
      var nd = Math.abs(U.dot(nw, view));
      var rim = Math.pow(1 - nd, 3);
      var kk = (0.035 + 0.75 * rim) * wall[a + 6] * lit;
      var lk = light * Math.max(0, U.dot(nw, L3)) * 0.35;
      E.p(p[0], p[1], p[2], 0.1, (0.55 + lk) * kk, (0.85 + lk) * kk, (0.95 + lk * 1.2) * kk, 0);
    }
    // chloroplast
    var cg = 0.11 * lit;
    for (var b = 0; b < chl.length; b += 4) {
      var pc = toW(F, chl[b], chl[b + 1], chl[b + 2]);
      var kc = chl[b + 3] * cg;
      E.p(pc[0], pc[1], pc[2], 0.12, 0.16 * kc, 0.95 * kc, 0.42 * kc, 0);
    }
    // organelles
    var vp = 0.75 + 0.25 * Math.sin(t * 2.4);
    for (var o = 0; o < org.length; o += 5) {
      var ty = org[o + 3], ko = org[o + 4], xx = org[o], yy = org[o + 1], zz = org[o + 2];
      var r, gg, bb, s = 0.1;
      if (ty === 0) { r = 0.55; gg = 1.0; bb = 0.7; ko *= 0.22; }
      else if (ty === 1) { r = 0.85; gg = 1.0; bb = 0.8; ko *= 0.18; s = 0.14; }
      else if (ty === 2) { r = 0.55; gg = 0.65; bb = 1.0; ko *= 0.12; }
      else if (ty === 3) { r = 0.7; gg = 0.75; bb = 1.0; ko *= 0.3; }
      else { var sc4 = ty === 4 ? vp : 1.75 - vp; var cx4 = 3.85, cy4 = ty === 4 ? 0.85 : -0.85; xx = cx4 + (xx - cx4) * sc4; yy = cy4 + (yy - cy4) * sc4; zz = 0.45 + (zz - 0.45) * sc4; r = 0.5; gg = 0.85; bb = 1.0; ko *= 0.14; }
      var po = toW(F, xx, yy, zz);
      E.p(po[0], po[1], po[2], s, r * ko * lit, gg * ko * lit, bb * ko * lit, 0);
    }
    // eyespot
    var face = Math.max(0, U.dot(F.u, L3)) * light;
    var ek = 0.85 * (1 + 1.6 * face) * lit;
    for (var e = 0; e < eyeG.length; e += 4) {
      var pe = toW(F, eyeG[e], eyeG[e + 1], eyeG[e + 2]);
      var lk2 = eyeG[e + 3] === 0 ? 1 : 0.6;
      E.p(pe[0], pe[1], pe[2], 0.085, 1.0 * ek * lk2, 0.3 * ek * lk2, 0.07 * ek * lk2, 0);
    }
    E.p(es[0], es[1], es[2], 1.1, 0.06 * ek, 0.016 * ek, 0.004 * ek, 0);
    UI.anchors.eyespot = E.project(es[0], es[1], es[2]);
    // flagella (with motion blur)
    var ph0 = beatPhase(t);
    for (var side = -1; side <= 1; side += 2) {
      for (var mb = 0; mb < 3; mb++) {
        var ph = ph0 - mb * 0.014; if (ph < 0) ph += 1;
        var N = flag(ph, side, fbuf), km = [1, 0.45, 0.2][mb] * 0.75 * lit;
        for (var fi = 0; fi < N; fi++) {
          var tip = fi / N;
          var pf = toW(F, fbuf[fi * 2], 0, fbuf[fi * 2 + 1]);
          var kf = km * (1 - 0.35 * tip);
          E.p(pf[0], pf[1], pf[2], 0.11, 0.7 * kf, 0.92 * kf, 1.0 * kf, 0);
        }
      }
    }
    E.setGain(1);
    UI.anchors.scale = E.pxPerUnit(D);

    var w = U.ss(15.0, 15.8, t);
    U.mixPost(P, { bg0: [0.0, 0.0065, 0.0075], bg1: [0.0, 0.0012, 0.0016], bloom: 1.05, streak: 0.12, streakTint: [0.6, 0.85, 1.0], thresh: 0.35, vig: 0.66,
      lightPos: [-0.02, 1.02], lightCol: [0.09 * light, 0.14 * light, 0.22 * light], lightR: 0.42 }, w);
    // dive flash
    var fl = U.ss(29.75, 30.1, t);
    P.flash = Math.max(P.flash, fl * 0.95); P.flashCol = [1.0, 0.62, 0.32];
  };

  // --- text & callouts
  UI.text({ t0: 16.0, t1: 21.6, x: 132, y: 742, cls: 'shadow', stagger: 0.06, inDur: 1.1,
    lines: [{ t: '起点  ·  ORIGIN', c: 'kick', mode: 'line', d: 0 }, { t: '一切，始于一个单细胞绿藻', c: 'h1', d: 0.2 }, { t: 'Chlamydomonas reinhardtii  ·  莱茵衣藻', c: 'sci', mode: 'line', d: 1.3 }] });
  UI.text({ t0: 22.4, t1: 28.1, x: 132, y: 742, cls: 'shadow', stagger: 0.055, inDur: 1.0,
    lines: [{ t: '它用一个红色的“眼点”感知光', c: 'h1s', d: 0 }, { t: '然后，朝着光游去', c: 'h1s', d: 0.9 }, { t: 'Phototaxis  ·  趋光运动', c: 'en', mode: 'line', d: 1.9 }] });
  UI.callout({ t0: 23.2, t1: 27.9, anchor: 'eyespot', dx: 250, dy: -120,
    lines: [{ t: '眼点', c: 'clzh' }, { t: 'Eyespot', c: 'clen', d: 0.12 }, { t: '感光蛋白就分布在这里', c: 'clsub', d: 0.25 }] });

  // scale bar
  var sb = UI.el('div', ''); sb.style.cssText += 'left:1580px;top:984px;height:1px;background:rgba(236,233,226,.7);display:none';
  var sbl = UI.el('div', 'scalel', '5 µm'); sbl.style.cssText += 'top:998px;display:none';
  var tag = UI.el('div', 'wm', 'Dark-field  ·  Live cell'); tag.style.cssText += 'left:1580px;top:956px;display:none';
  UI.hook(function (t) {
    var on = t > 16.2 && t < 28.2;
    var o = U.win(t, 16.2, 28.2, 0.8, 0.6);
    [sb, sbl, tag].forEach(function (e) { e.style.display = on ? 'block' : 'none'; e.style.opacity = o.toFixed(3); });
    if (on) { var w = 5 * (UI.anchors.scale || 39); sb.style.width = w.toFixed(1) + 'px'; sb.style.left = (1788 - w).toFixed(1) + 'px'; sbl.style.left = (1788 - w).toFixed(1) + 'px'; tag.style.left = (1788 - w).toFixed(1) + 'px'; }
  });
})();
