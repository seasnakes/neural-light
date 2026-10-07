'use strict';
var UI = (function () {
  var root = document.getElementById('ui'), svg = document.getElementById('svg');
  var NS = 'http://www.w3.org/2000/svg';
  var items = [], callouts = [], hooks = [];
  var anchors = {};

  function mkLines(el, lines, mode, stagger) {
    var spans = [];
    lines.forEach(function (L, li) {
      var d = document.createElement('div');
      d.className = 'ln ' + (L.c || '');
      if (L.style) d.setAttribute('style', L.style);
      el.appendChild(d);
      var delay = L.d !== undefined ? L.d : li * 0.2;
      var m = L.mode || mode;
      if (m === 'chars') {
        Array.from(L.t).forEach(function (ch, ci) {
          var s = document.createElement('span'); s.className = 'ch' + (L.cc ? ' ' + L.cc : ''); s.textContent = ch; d.appendChild(s);
          spans.push({ el: s, d: delay + ci * (L.st !== undefined ? L.st : stagger), k: '' });
        });
      } else {
        var s = document.createElement('span'); s.className = 'ch'; s.innerHTML = L.t; d.appendChild(s);
        spans.push({ el: s, d: delay, k: '' });
      }
    });
    return spans;
  }

  function text(o) {
    var el = document.createElement('div');
    el.className = 'tb ' + (o.align || '') + ' ' + (o.cls || '');
    el.style.left = o.x + 'px'; el.style.top = o.y + 'px';
    if (o.align === 'center') el.style.transform = 'translateX(-50%)';
    if (o.align === 'right') el.style.transform = 'translateX(-100%)';
    root.appendChild(el);
    var spans = mkLines(el, o.lines, o.mode || 'chars', o.stagger !== undefined ? o.stagger : 0.04);
    var it = { o: o, el: el, spans: spans, vis: false };
    items.push(it);
    return it;
  }

  function styleSpan(sp, op, bl, ty, sc) {
    var k = op.toFixed(3) + '|' + bl.toFixed(2) + '|' + ty.toFixed(2) + '|' + sc.toFixed(3);
    if (k === sp.k) return;
    sp.k = k;
    sp.el.style.opacity = op.toFixed(3);
    sp.el.style.filter = bl > 0.05 ? 'blur(' + bl.toFixed(2) + 'px)' : 'none';
    sp.el.style.transform = (Math.abs(ty) > 0.01 || Math.abs(sc - 1) > 0.0005) ? 'translateY(' + ty.toFixed(2) + 'px) scale(' + sc.toFixed(4) + ')' : 'none';
  }

  function updText(it, t) {
    var o = it.o;
    if (t < o.t0 || t > o.t1) { if (it.vis) { it.el.style.display = 'none'; it.vis = false; } return; }
    if (!it.vis) { it.el.style.display = 'block'; it.vis = true; }
    var inDur = o.inDur || 1.0, outDur = o.outDur || 0.8;
    var q = U.clamp((t - (o.t1 - outDur)) / outDur);
    var eq = q * q * (3 - 2 * q);
    var blurIn = o.blur !== undefined ? o.blur : 10, rise = o.rise !== undefined ? o.rise : 14;
    var zoom = o.zoom || 0;
    for (var i = 0; i < it.spans.length; i++) {
      var sp = it.spans[i];
      var p = U.clamp((t - o.t0 - sp.d) / inDur);
      var e = 1 - Math.pow(1 - p, 3);
      var op = e * (1 - eq) * (o.op !== undefined ? o.op : 1);
      var bl = (1 - e) * blurIn + eq * 7;
      var ty = (1 - e) * rise - eq * 6;
      var sc = 1 + (1 - e) * zoom + eq * 0.0;
      styleSpan(sp, op, bl, ty, sc);
    }
    if (o.onUpdate) o.onUpdate(it, t);
  }

  function callout(o) {
    var g = document.createElementNS(NS, 'g'); g.style.display = 'none'; svg.appendChild(g);
    var ring = document.createElementNS(NS, 'circle'); ring.setAttribute('fill', 'none'); ring.setAttribute('stroke', 'rgba(232,200,140,0.95)'); ring.setAttribute('stroke-width', '1.3'); g.appendChild(ring);
    var dot = document.createElementNS(NS, 'circle'); dot.setAttribute('fill', 'rgba(255,236,200,1)'); g.appendChild(dot);
    var path = document.createElementNS(NS, 'path'); path.setAttribute('fill', 'none'); path.setAttribute('stroke', 'rgba(236,228,212,0.72)'); path.setAttribute('stroke-width', '1.1'); g.appendChild(path);
    var lab = document.createElement('div'); lab.className = 'cl'; root.appendChild(lab);
    var spans = mkLines(lab, o.lines, 'line', 0);
    var c = { o: o, g: g, ring: ring, dot: dot, path: path, lab: lab, spans: spans, vis: false };
    callouts.push(c);
    return c;
  }

  function updCallout(c, t) {
    var o = c.o, A = anchors[o.anchor];
    if (t < o.t0 || t > o.t1 || !A) { if (c.vis) { c.g.style.display = 'none'; c.lab.style.display = 'none'; c.vis = false; } return; }
    if (!c.vis) { c.g.style.display = 'block'; c.lab.style.display = 'block'; c.vis = true; }
    var outDur = o.outDur || 0.6;
    var fo = 1 - U.ss(o.t1 - outDur, o.t1, t);
    var p1 = U.eo(U.remap(t, o.t0, o.t0 + 0.5));
    var p2 = U.eio(U.remap(t, o.t0 + 0.2, o.t0 + 0.95));
    var ax = A[0], ay = A[1];
    var dx = o.dx, dy = o.dy;
    var s = dx >= 0 ? 1 : -1;
    var kx = Math.min(Math.abs(dy), Math.abs(dx) * 0.4) * s;
    var bx = ax + kx, by = ay + dy, cx = ax + dx, cy = ay + dy;
    var r0 = 10;
    var ux = kx, uy = dy, ul = Math.hypot(ux, uy) || 1;
    var sx = ax + ux / ul * (r0 + 3), sy = ay + uy / ul * (r0 + 3);
    var l1 = Math.hypot(bx - sx, by - sy), l2 = Math.abs(cx - bx), L = l1 + l2;
    c.path.setAttribute('d', 'M' + sx.toFixed(1) + ' ' + sy.toFixed(1) + ' L' + bx.toFixed(1) + ' ' + by.toFixed(1) + ' L' + cx.toFixed(1) + ' ' + cy.toFixed(1));
    c.path.setAttribute('stroke-dasharray', L.toFixed(1) + ' ' + (L + 10).toFixed(1));
    c.path.setAttribute('stroke-dashoffset', (L * (1 - p2)).toFixed(1));
    c.ring.setAttribute('cx', ax.toFixed(1)); c.ring.setAttribute('cy', ay.toFixed(1)); c.ring.setAttribute('r', (r0 * (0.4 + 0.6 * p1) + (1 - p1) * 18).toFixed(2));
    c.ring.setAttribute('opacity', (p1 * fo).toFixed(3));
    c.dot.setAttribute('cx', ax.toFixed(1)); c.dot.setAttribute('cy', ay.toFixed(1)); c.dot.setAttribute('r', (2.4 * p1).toFixed(2));
    c.dot.setAttribute('opacity', fo.toFixed(3));
    c.path.setAttribute('opacity', fo.toFixed(3));
    // label
    var lw = c.lab.offsetWidth;
    var lx = s > 0 ? cx + 16 : cx - 16 - lw;
    c.lab.style.left = lx.toFixed(1) + 'px'; c.lab.style.top = (cy - 13).toFixed(1) + 'px';
    for (var i = 0; i < c.spans.length; i++) {
      var sp = c.spans[i];
      var p = U.clamp((t - o.t0 - 0.75 - sp.d) / 0.7);
      var e = 1 - Math.pow(1 - p, 3);
      styleSpan(sp, e * fo, (1 - e) * 6 + (1 - fo) * 5, (1 - e) * 8, 1);
    }
  }

  function hook(fn) { hooks.push(fn); }

  function update(t) {
    for (var i = 0; i < items.length; i++) updText(items[i], t);
    for (var j = 0; j < callouts.length; j++) updCallout(callouts[j], t);
    for (var k = 0; k < hooks.length; k++) hooks[k](t);
  }

  function el(tag, cls, html) {
    var e = document.createElement(tag); if (cls) e.className = cls; if (html !== undefined) e.innerHTML = html;
    e.style.position = 'absolute'; root.appendChild(e); return e;
  }
  function svgEl(tag, attrs) {
    var e = document.createElementNS(NS, tag);
    for (var k in attrs) e.setAttribute(k, attrs[k]);
    svg.appendChild(e); return e;
  }

  return { text: text, callout: callout, hook: hook, update: update, anchors: anchors, el: el, svgEl: svgEl, root: root, svg: svg };
})();
