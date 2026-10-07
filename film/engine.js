'use strict';
var W = 1920, H = 1080, RS = 2, RW = W * RS, RH = H * RS;
var E = (function () {
  var canvas = document.getElementById('gl');
  var gl = canvas.getContext('webgl2', { antialias: false, alpha: false, depth: false, stencil: false, preserveDrawingBuffer: true, premultipliedAlpha: false });
  if (!gl) throw new Error('WebGL2 unavailable');
  gl.getExtension('EXT_color_buffer_float');
  gl.getExtension('EXT_color_buffer_half_float');

  function compile(type, src) {
    var s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) + '\n' + src);
    return s;
  }
  function program(vs, fs) {
    var p = gl.createProgram();
    gl.attachShader(p, compile(gl.VERTEX_SHADER, vs)); gl.attachShader(p, compile(gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    var u = {}, n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (var i = 0; i < n; i++) { var info = gl.getActiveUniform(p, i); u[info.name.replace('[0]', '')] = gl.getUniformLocation(p, info.name); }
    return { p: p, u: u };
  }
  function target(w, h) {
    var t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, w, h, 0, gl.RGBA, gl.HALF_FLOAT, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    var f = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, f);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0);
    return { t: t, f: f, w: w, h: h };
  }

  var PTS_VS = '#version 300 es\n' +
    'layout(location=0) in vec4 aP; layout(location=1) in vec4 aC;\n' +
    'uniform mat4 uVP; uniform mat4 uV;\n' +
    'uniform float uScale, uProj, uFocus, uAperture, uMaxCoc, uOrtho, uMaskK, uMaskSoft;\n' +
    'uniform vec4 uMask;\n' +
    'out vec3 vC; out float vShape; out float vBok;\n' +
    'void main(){\n' +
    '  vec4 clip; float sp; float coc=0.;\n' +
    '  if(uOrtho>0.5){ clip=vec4(aP.x/960.-1., 1.-aP.y/540., 0., 1.); sp=aP.w*uScale; }\n' +
    '  else {\n' +
    '    vec4 vp=uV*vec4(aP.xyz,1.); float d=-vp.z;\n' +
    '    if(d<0.03){ gl_Position=vec4(9.,9.,9.,1.); gl_PointSize=1.; vC=vec3(0.); vShape=0.; vBok=0.; return; }\n' +
    '    clip=uVP*vec4(aP.xyz,1.); sp=aP.w*uProj/d; coc=min(uAperture*abs(d-uFocus)/d, uMaxCoc);\n' +
    '  }\n' +
    '  float msz=1.7*uScale; float sz=sqrt(sp*sp+coc*coc);\n' +
    '  float sub = sp<msz ? (sp*sp)/(msz*msz) : 1.;\n' +
    '  float spe=max(sp,msz); float szf=max(sz,msz);\n' +
    '  float e=sub*(spe*spe)/(szf*szf);\n' +
    '  vec3 col=aC.rgb*e;\n' +
    '  vec2 sc=vec2((clip.x/clip.w*0.5+0.5)*1920., (0.5-clip.y/clip.w*0.5)*1080.);\n' +
    '  float mx=smoothstep(uMask.x-uMaskSoft,uMask.x+uMaskSoft,sc.x)*(1.-smoothstep(uMask.z-uMaskSoft,uMask.z+uMaskSoft,sc.x));\n' +
    '  float my=smoothstep(uMask.y-uMaskSoft,uMask.y+uMaskSoft,sc.y)*(1.-smoothstep(uMask.w-uMaskSoft,uMask.w+uMaskSoft,sc.y));\n' +
    '  col*=1.-uMaskK*mx*my;\n' +
    '  gl_Position=clip; gl_PointSize=min(szf,96.*uScale); vC=col; vShape=aC.a; vBok=clamp((coc-1.5*uScale)/szf*1.15,0.,1.);\n' +
    '}\n';
  var PTS_FS = '#version 300 es\nprecision highp float;\n' +
    'in vec3 vC; in float vShape; in float vBok; out vec4 o;\n' +
    'void main(){\n' +
    '  vec2 q=gl_PointCoord*2.-1.; float r2=dot(q,q); if(r2>1.) discard; float r=sqrt(r2);\n' +
    '  float g=exp(-r2*5.);\n' +
    '  float disk=(1.-smoothstep(0.78,1.,r))*(0.5+0.5*smoothstep(0.5,0.93,r));\n' +
    '  float k=mix(g, disk*0.34, vBok);\n' +
    '  k+=vShape*exp(-r2*36.)*2.2;\n' +
    '  o=vec4(vC*k,1.);\n' +
    '}\n';
  var QUAD_VS = '#version 300 es\nout vec2 uv; void main(){ vec2 p=vec2(float((gl_VertexID<<1)&2), float(gl_VertexID&2)); uv=p; gl_Position=vec4(p*2.-1.,0.,1.); }\n';
  var DOWN_FS = '#version 300 es\nprecision highp float; in vec2 uv; uniform sampler2D uTex; uniform vec2 uHp; out vec4 o;\n' +
    'void main(){ vec3 s=texture(uTex,uv).rgb*4.; s+=texture(uTex,uv-uHp).rgb; s+=texture(uTex,uv+uHp).rgb; s+=texture(uTex,uv+vec2(uHp.x,-uHp.y)).rgb; s+=texture(uTex,uv-vec2(uHp.x,-uHp.y)).rgb; o=vec4(s/8.,1.); }\n';
  var UP_FS = '#version 300 es\nprecision highp float; in vec2 uv; uniform sampler2D uTex; uniform vec2 uHp; uniform float uW; out vec4 o;\n' +
    'void main(){ vec3 s=texture(uTex,uv+vec2(-uHp.x*2.,0.)).rgb; s+=texture(uTex,uv+vec2(-uHp.x,uHp.y)).rgb*2.; s+=texture(uTex,uv+vec2(0.,uHp.y*2.)).rgb; s+=texture(uTex,uv+vec2(uHp.x,uHp.y)).rgb*2.;' +
    ' s+=texture(uTex,uv+vec2(uHp.x*2.,0.)).rgb; s+=texture(uTex,uv+vec2(uHp.x,-uHp.y)).rgb*2.; s+=texture(uTex,uv+vec2(0.,-uHp.y*2.)).rgb; s+=texture(uTex,uv+vec2(-uHp.x,-uHp.y)).rgb*2.; o=vec4(s/12.*uW,1.); }\n';
  var STREAK_FS = '#version 300 es\nprecision highp float; in vec2 uv; uniform sampler2D uTex; uniform float uStep; uniform float uTh; out vec4 o;\n' +
    'void main(){ vec3 s=vec3(0.); float ws=0.; for(int i=-7;i<=7;i++){ float fi=float(i); float w=exp(-fi*fi/22.); vec3 c=texture(uTex,uv+vec2(fi*uStep,0.)).rgb; c=max(c-uTh,0.); s+=c*w; ws+=w; } o=vec4(s/ws,1.); }\n';
  var FINAL_FS = '#version 300 es\nprecision highp float; in vec2 uv; out vec4 o;\n' +
    'uniform sampler2D uScene, uBloomTex, uStreakTex;\n' +
    'uniform float uTime, uBloom, uExposure, uCA, uVig, uGrain, uFade, uFlash, uStreak, uSat, uLightR, uContrast;\n' +
    'uniform vec3 uBg0, uBg1, uStreakTint, uFlashCol, uLightCol, uTint;\n' +
    'uniform vec2 uLightPos;\n' +
    'vec3 aces(vec3 x){ const float a=2.51,b=0.03,c=2.43,d=0.59,e=0.14; return clamp((x*(a*x+b))/(x*(c*x+d)+e),0.,1.); }\n' +
    'float hash(vec3 p){ p=fract(p*0.1031); p+=dot(p,p.zyx+31.32); return fract((p.x+p.y)*p.z); }\n' +
    'void main(){\n' +
    '  vec2 d=uv-0.5; vec2 da=d*vec2(1.7778,1.); float r2=dot(da,da);\n' +
    '  vec2 off=d*uCA*(0.4+r2*1.6);\n' +
    '  vec3 c; c.r=texture(uScene,uv-off).r; c.g=texture(uScene,uv).g; c.b=texture(uScene,uv+off).b;\n' +
    '  vec3 b=texture(uBloomTex,uv).rgb; vec3 s=texture(uStreakTex,uv).rgb;\n' +
    '  vec3 bg=mix(uBg0,uBg1,smoothstep(0.,1.15,sqrt(r2)));\n' +
    '  vec2 lp=(uv-uLightPos)*vec2(1.7778,1.); bg+=uLightCol*exp(-length(lp)/max(uLightR,1e-3));\n' +
    '  vec3 col=c+b*uBloom+s*uStreak*uStreakTint+bg;\n' +
    '  col*=uExposure*uTint;\n' +
    '  col=aces(col);\n' +
    '  float l=dot(col,vec3(0.2126,0.7152,0.0722)); col=mix(vec3(l),col,uSat);\n' +
    '  col=mix(col, col*col*(3.-2.*col), uContrast);\n' +
    '  col*=1.-uVig*smoothstep(0.15,1.25,r2);\n' +
    '  col=pow(max(col,0.),vec3(1./2.2));\n' +
    '  col=mix(col,vec3(0.),uFade);\n' +
    '  col+=uFlash*uFlashCol;\n' +
    '  float fr=floor(uTime*30.+0.5);\n' +
    '  float n=hash(vec3(gl_FragCoord.xy,fr*1.618))+hash(vec3(gl_FragCoord.yx*1.37+11.,fr*2.71))-1.;\n' +
    '  col+=n*(uGrain*(0.55+0.45*(1.-l))+0.0025);\n' +
    '  o=vec4(col,1.);\n' +
    '}\n';

  var pts = program(PTS_VS, PTS_FS);
  var down = program(QUAD_VS, DOWN_FS), up = program(QUAD_VS, UP_FS), streak = program(QUAD_VS, STREAK_FS), fin = program(QUAD_VS, FINAL_FS);

  var MAXP = 1 << 18, STRIDE = 8;
  var data = new Float32Array(MAXP * STRIDE), n = 0;
  var vao = gl.createVertexArray(); gl.bindVertexArray(vao);
  var vbo = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, vbo); gl.bufferData(gl.ARRAY_BUFFER, data.byteLength, gl.DYNAMIC_DRAW);
  gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 4, gl.FLOAT, false, 32, 0);
  gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 4, gl.FLOAT, false, 32, 16);
  var qvao = gl.createVertexArray();

  var scene = target(RW, RH);
  var levels = [];
  (function () { var w = RW >> 1, h = RH >> 1; for (var i = 0; i < 6; i++) { levels.push(target(w, h)); w = Math.max(1, w >> 1); h = Math.max(1, h >> 1); } })();
  var sA = target(levels[2].w, levels[2].h), sB = target(levels[2].w, levels[2].h);

  var cam = null, VP = null, V = null, proj = 1;
  var gain = 1;
  var mask = [0, 0, 0, 0], maskK = 0, maskSoft = 40;
  var stats = { points: 0 };

  function mat4mul(a, b) {
    var o = new Float32Array(16);
    for (var c = 0; c < 4; c++) for (var r = 0; r < 4; r++) {
      o[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
    }
    return o;
  }
  function lookAt(e, t, up) {
    var z = U.norm(U.sub(e, t)), x = U.norm(U.cross(up, z)), y = U.cross(z, x);
    return new Float32Array([x[0], y[0], z[0], 0, x[1], y[1], z[1], 0, x[2], y[2], z[2], 0, -U.dot(x, e), -U.dot(y, e), -U.dot(z, e), 1]);
  }
  function persp(fovy, asp, near, far) {
    var f = 1 / Math.tan(fovy / 2), nf = 1 / (near - far);
    return new Float32Array([f / asp, 0, 0, 0, 0, f, 0, 0, 0, 0, (far + near) * nf, -1, 0, 0, 2 * far * near * nf, 0]);
  }

  function setCamera(c) {
    flush();
    cam = c;
    if (c.ortho) { VP = new Float32Array(16); V = new Float32Array(16); proj = 1; return; }
    var fov = (c.fov || 35) * Math.PI / 180;
    V = lookAt(c.pos, c.target, c.up || [0, 1, 0]);
    var P = persp(fov, W / H, c.near || 0.05, c.far || 5000);
    VP = mat4mul(P, V);
    proj = H / (2 * Math.tan(fov / 2));
  }
  function p(x, y, z, s, r, g, b, shape) {
    if (n >= MAXP) flush();
    var o = n * 8;
    data[o] = x; data[o + 1] = y; data[o + 2] = z; data[o + 3] = s;
    data[o + 4] = r * gain; data[o + 5] = g * gain; data[o + 6] = b * gain; data[o + 7] = shape || 0;
    n++;
  }
  function flush() {
    if (!n || !cam) { n = 0; return; }
    gl.bindFramebuffer(gl.FRAMEBUFFER, scene.f); gl.viewport(0, 0, RW, RH);
    gl.useProgram(pts.p);
    var u = pts.u;
    gl.uniformMatrix4fv(u.uVP, false, VP); gl.uniformMatrix4fv(u.uV, false, V);
    gl.uniform1f(u.uScale, RS); gl.uniform1f(u.uProj, proj * RS); gl.uniform1f(u.uFocus, cam.focus || 10); gl.uniform1f(u.uAperture, (cam.aperture || 0) * RS);
    gl.uniform1f(u.uMaxCoc, (cam.maxCoc || 56) * RS); gl.uniform1f(u.uOrtho, cam.ortho ? 1 : 0);
    gl.uniform4f(u.uMask, mask[0], mask[1], mask[2], mask[3]); gl.uniform1f(u.uMaskK, maskK); gl.uniform1f(u.uMaskSoft, maskSoft);
    gl.bindVertexArray(vao); gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, data, 0, n * 8);
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE);
    gl.drawArrays(gl.POINTS, 0, n);
    gl.disable(gl.BLEND);
    stats.points += n;
    n = 0;
  }
  function begin() {
    stats.points = 0;
    gl.bindFramebuffer(gl.FRAMEBUFFER, scene.f); gl.viewport(0, 0, RW, RH);
    gl.clearColor(0, 0, 0, 1); gl.clear(gl.COLOR_BUFFER_BIT);
    gain = 1; maskK = 0; cam = null;
  }
  function quad(prog, dst) {
    gl.bindFramebuffer(gl.FRAMEBUFFER, dst ? dst.f : null);
    gl.viewport(0, 0, dst ? dst.w : RW, dst ? dst.h : RH);
    gl.bindVertexArray(qvao); gl.drawArrays(gl.TRIANGLES, 0, 3);
  }
  function end(P, t) {
    flush();
    gl.activeTexture(gl.TEXTURE0);
    // bloom down chain
    gl.useProgram(down.p); gl.uniform1i(down.u.uTex, 0);
    var src = scene;
    for (var i = 0; i < levels.length; i++) {
      var L = levels[i];
      gl.bindTexture(gl.TEXTURE_2D, src.t); gl.uniform2f(down.u.uHp, 1 / src.w, 1 / src.h);
      quad(down, L); src = L;
    }
    gl.useProgram(up.p); gl.uniform1i(up.u.uTex, 0); gl.uniform1f(up.u.uW, 1.0);
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE);
    for (var j = levels.length - 2; j >= 0; j--) {
      gl.bindTexture(gl.TEXTURE_2D, levels[j + 1].t); gl.uniform2f(up.u.uHp, 1 / levels[j + 1].w, 1 / levels[j + 1].h);
      quad(up, levels[j]);
    }
    gl.disable(gl.BLEND);
    // anamorphic streak
    gl.useProgram(streak.p); gl.uniform1i(streak.u.uTex, 0);
    gl.bindTexture(gl.TEXTURE_2D, levels[1].t); gl.uniform1f(streak.u.uStep, 1.5 / levels[1].w); gl.uniform1f(streak.u.uTh, P.thresh);
    quad(streak, sA);
    gl.bindTexture(gl.TEXTURE_2D, sA.t); gl.uniform1f(streak.u.uStep, 5.0 / sA.w); gl.uniform1f(streak.u.uTh, 0);
    quad(streak, sB);
    gl.bindTexture(gl.TEXTURE_2D, sB.t); gl.uniform1f(streak.u.uStep, 16.0 / sA.w);
    quad(streak, sA);
    // final
    gl.useProgram(fin.p); var u = fin.u;
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, scene.t); gl.uniform1i(u.uScene, 0);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, levels[0].t); gl.uniform1i(u.uBloomTex, 1);
    gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, sA.t); gl.uniform1i(u.uStreakTex, 2);
    gl.uniform1f(u.uTime, t); gl.uniform1f(u.uBloom, P.bloom / 6); gl.uniform1f(u.uExposure, P.exposure);
    gl.uniform1f(u.uCA, P.ca); gl.uniform1f(u.uVig, P.vig); gl.uniform1f(u.uGrain, P.grain); gl.uniform1f(u.uFade, P.fade);
    gl.uniform1f(u.uFlash, P.flash); gl.uniform1f(u.uStreak, P.streak); gl.uniform1f(u.uSat, P.sat); gl.uniform1f(u.uLightR, P.lightR);
    gl.uniform1f(u.uContrast, P.contrast);
    gl.uniform3fv(u.uBg0, P.bg0); gl.uniform3fv(u.uBg1, P.bg1); gl.uniform3fv(u.uStreakTint, P.streakTint);
    gl.uniform3fv(u.uFlashCol, P.flashCol); gl.uniform3fv(u.uLightCol, P.lightCol); gl.uniform3fv(u.uTint, P.tint);
    gl.uniform2fv(u.uLightPos, P.lightPos);
    quad(fin, null);
    gl.activeTexture(gl.TEXTURE0);
  }
  function project(x, y, z) {
    if (!cam || cam.ortho) return [x, y, 1];
    var m = VP;
    var cx = m[0] * x + m[4] * y + m[8] * z + m[12], cy = m[1] * x + m[5] * y + m[9] * z + m[13], cw = m[3] * x + m[7] * y + m[11] * z + m[15];
    return [(cx / cw * 0.5 + 0.5) * W, (0.5 - cy / cw * 0.5) * H, cw];
  }
  function pxPerUnit(dist) { return proj / dist; }
  return {
    gl: gl, p: p, flush: flush, camera: setCamera, begin: begin, end: end, project: project, pxPerUnit: pxPerUnit,
    setGain: function (g) { gain = g; }, getGain: function () { return gain; },
    setMask: function (rect, k, soft) { flush(); mask = rect; maskK = k; maskSoft = soft || 40; },
    stats: stats
  };
})();

// default post-processing state
function defaultPost() {
  return {
    exposure: 1.0, bloom: 1.0, streak: 0.0, streakTint: [0.55, 0.72, 1.0], thresh: 0.25,
    ca: 0.0035, vig: 0.6, grain: 0.03, fade: 0, flash: 0, flashCol: [1, 1, 1],
    bg0: [0.0, 0.0, 0.0], bg1: [0, 0, 0], lightPos: [0, 1], lightCol: [0, 0, 0], lightR: 0.3,
    sat: 1.0, contrast: 0.0, tint: [1, 1, 1]
  };
}
