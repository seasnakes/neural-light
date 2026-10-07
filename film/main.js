'use strict';
var SCENES = [S0, S1].concat(typeof S2 !== 'undefined' ? [S2] : []).concat(typeof S3 !== 'undefined' ? [S3] : [])
  .concat(typeof S4 !== 'undefined' ? [S4] : []).concat(typeof S5 !== 'undefined' ? [S5] : []).concat(typeof S5E !== 'undefined' ? [S5E] : [])
  .concat(typeof S6 !== 'undefined' ? [S6] : []).concat(typeof S7 !== 'undefined' ? [S7] : []);
SCENES.forEach(function (s) { if (s.init) s.init(); });
window.renderFrame = function (t) {
  var P = defaultPost();
  E.begin();
  for (var i = 0; i < SCENES.length; i++) {
    var s = SCENES[i];
    if (t >= s.t0 && t < s.t1) { E.setGain(1); s.draw(t, P); E.flush(); E.setMask([0, 0, 0, 0], 0); E.setGain(1); }
  }
  E.end(P, t);
  UI.update(t);
  return E.stats.points;
};
window.READY = true;
