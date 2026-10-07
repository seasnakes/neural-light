'use strict';
var U = {};
U.clamp = function (x, a, b) { if (a === undefined) { a = 0; b = 1; } return x < a ? a : x > b ? b : x; };
U.lerp = function (a, b, t) { return a + (b - a) * t; };
U.remap = function (x, a, b) { return U.clamp((x - a) / (b - a)); };
U.ss = function (a, b, x) { var t = U.clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
U.eio = function (t) { t = U.clamp(t); return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
U.eio5 = function (t) { t = U.clamp(t); return t < 0.5 ? 16 * t * t * t * t * t : 1 - Math.pow(-2 * t + 2, 5) / 2; };
U.eo = function (t) { t = U.clamp(t); return 1 - Math.pow(1 - t, 3); };
U.ei = function (t) { t = U.clamp(t); return t * t * t; };
U.eoX = function (t) { t = U.clamp(t); return t >= 1 ? 1 : 1 - Math.pow(2, -10 * t); };
U.eiX = function (t) { t = U.clamp(t); return t <= 0 ? 0 : Math.pow(2, 10 * t - 10); };
U.win = function (t, a, b, fi, fo) { // trapezoid window
  return U.ss(a, a + fi, t) * (1 - U.ss(b - fo, b, t));
};
U.rng = function (seed) {
  var a = seed >>> 0;
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    var t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
};
U.hash = function (n) { var x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
U.gauss = function (R) { var u = Math.max(1e-9, R()), v = R(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(6.2831853 * v); };
U.unit = function (R) { var z = R() * 2 - 1, a = R() * 6.2831853, r = Math.sqrt(1 - z * z); return [r * Math.cos(a), r * Math.sin(a), z]; };
U.wrap = function (v, s) { return ((v + s / 2) % s + s) % s - s / 2; };
U.norm = function (v) { var l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
U.cross = function (a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; };
U.dot = function (a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; };
U.add = function (a, b) { return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]; };
U.sub = function (a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; };
U.mul = function (a, s) { return [a[0] * s, a[1] * s, a[2] * s]; };
U.mix3 = function (a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; };
U.rotY = function (p, a) { var c = Math.cos(a), s = Math.sin(a); return [c * p[0] + s * p[2], p[1], -s * p[0] + c * p[2]]; };
U.rotX = function (p, a) { var c = Math.cos(a), s = Math.sin(a); return [p[0], c * p[1] - s * p[2], s * p[1] + c * p[2]]; };
U.rotZ = function (p, a) { var c = Math.cos(a), s = Math.sin(a); return [c * p[0] - s * p[1], s * p[0] + c * p[1], p[2]]; };
U.bez3 = function (a, b, c, d, t) {
  var u = 1 - t, w0 = u * u * u, w1 = 3 * u * u * t, w2 = 3 * u * t * t, w3 = t * t * t;
  return [a[0] * w0 + b[0] * w1 + c[0] * w2 + d[0] * w3, a[1] * w0 + b[1] * w1 + c[1] * w2 + d[1] * w3, a[2] * w0 + b[2] * w1 + c[2] * w2 + d[2] * w3];
};
U.orbit = function (target, dist, az, el) {
  return [target[0] + dist * Math.cos(el) * Math.sin(az), target[1] + dist * Math.sin(el), target[2] + dist * Math.cos(el) * Math.cos(az)];
};

// 3D simplex noise (after Stefan Gustavson)
U.noise3 = (function () {
  var grad3 = [1, 1, 0, -1, 1, 0, 1, -1, 0, -1, -1, 0, 1, 0, 1, -1, 0, 1, 1, 0, -1, -1, 0, -1, 0, 1, 1, 0, -1, 1, 0, 1, -1, 0, -1, -1];
  var perm = new Uint8Array(512), pm12 = new Uint8Array(512);
  var R = U.rng(1337), p = new Uint8Array(256), i;
  for (i = 0; i < 256; i++) p[i] = i;
  for (i = 255; i > 0; i--) { var j = Math.floor(R() * (i + 1)); var tmp = p[i]; p[i] = p[j]; p[j] = tmp; }
  for (i = 0; i < 512; i++) { perm[i] = p[i & 255]; pm12[i] = perm[i] % 12; }
  var F3 = 1 / 3, G3 = 1 / 6;
  return function (xin, yin, zin) {
    var n0, n1, n2, n3;
    var s = (xin + yin + zin) * F3;
    var i = Math.floor(xin + s), j = Math.floor(yin + s), k = Math.floor(zin + s);
    var t = (i + j + k) * G3;
    var x0 = xin - (i - t), y0 = yin - (j - t), z0 = zin - (k - t);
    var i1, j1, k1, i2, j2, k2;
    if (x0 >= y0) {
      if (y0 >= z0) { i1 = 1; j1 = 0; k1 = 0; i2 = 1; j2 = 1; k2 = 0; }
      else if (x0 >= z0) { i1 = 1; j1 = 0; k1 = 0; i2 = 1; j2 = 0; k2 = 1; }
      else { i1 = 0; j1 = 0; k1 = 1; i2 = 1; j2 = 0; k2 = 1; }
    } else {
      if (y0 < z0) { i1 = 0; j1 = 0; k1 = 1; i2 = 0; j2 = 1; k2 = 1; }
      else if (x0 < z0) { i1 = 0; j1 = 1; k1 = 0; i2 = 0; j2 = 1; k2 = 1; }
      else { i1 = 0; j1 = 1; k1 = 0; i2 = 1; j2 = 1; k2 = 0; }
    }
    var x1 = x0 - i1 + G3, y1 = y0 - j1 + G3, z1 = z0 - k1 + G3;
    var x2 = x0 - i2 + 2 * G3, y2 = y0 - j2 + 2 * G3, z2 = z0 - k2 + 2 * G3;
    var x3 = x0 - 1 + 3 * G3, y3 = y0 - 1 + 3 * G3, z3 = z0 - 1 + 3 * G3;
    var ii = i & 255, jj = j & 255, kk = k & 255;
    var gi0 = pm12[ii + perm[jj + perm[kk]]] * 3;
    var gi1 = pm12[ii + i1 + perm[jj + j1 + perm[kk + k1]]] * 3;
    var gi2 = pm12[ii + i2 + perm[jj + j2 + perm[kk + k2]]] * 3;
    var gi3 = pm12[ii + 1 + perm[jj + 1 + perm[kk + 1]]] * 3;
    var t0 = 0.6 - x0 * x0 - y0 * y0 - z0 * z0;
    if (t0 < 0) n0 = 0; else { t0 *= t0; n0 = t0 * t0 * (grad3[gi0] * x0 + grad3[gi0 + 1] * y0 + grad3[gi0 + 2] * z0); }
    var t1 = 0.6 - x1 * x1 - y1 * y1 - z1 * z1;
    if (t1 < 0) n1 = 0; else { t1 *= t1; n1 = t1 * t1 * (grad3[gi1] * x1 + grad3[gi1 + 1] * y1 + grad3[gi1 + 2] * z1); }
    var t2 = 0.6 - x2 * x2 - y2 * y2 - z2 * z2;
    if (t2 < 0) n2 = 0; else { t2 *= t2; n2 = t2 * t2 * (grad3[gi2] * x2 + grad3[gi2 + 1] * y2 + grad3[gi2 + 2] * z2); }
    var t3 = 0.6 - x3 * x3 - y3 * y3 - z3 * z3;
    if (t3 < 0) n3 = 0; else { t3 *= t3; n3 = t3 * t3 * (grad3[gi3] * x3 + grad3[gi3 + 1] * y3 + grad3[gi3 + 2] * z3); }
    return 32 * (n0 + n1 + n2 + n3);
  };
})();

// post-parameter mixing helper
U.mixPost = function (P, vals, w) {
  if (w <= 0) return;
  for (var k in vals) {
    var v = vals[k];
    if (Array.isArray(v)) { var a = P[k]; P[k] = [a[0] + (v[0] - a[0]) * w, a[1] + (v[1] - a[1]) * w, a[2] + (v[2] - a[2]) * w]; if (v.length === 2) P[k] = [a[0] + (v[0] - a[0]) * w, a[1] + (v[1] - a[1]) * w]; }
    else P[k] = P[k] + (v - P[k]) * w;
  }
};
