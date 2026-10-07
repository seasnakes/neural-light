#!/usr/bin/env python3
"""Original procedural score + sound design for the optogenetics film.
Everything is synthesized from scratch (no samples). Timeline is shared with the renderer."""
import json, subprocess, sys
from pathlib import Path
import numpy as np
from scipy import signal
from scipy.io import wavfile
from scipy.ndimage import minimum_filter1d, maximum_filter1d

SR = 48000
TIMELINE = Path(__file__).resolve().parents[1] / 'film' / 'timeline.js'
C = json.loads(subprocess.check_output([
    'node', '-e', 'process.stdout.write(JSON.stringify(require(process.argv[1])))', str(TIMELINE)
]))
DUR = C['dur']
N = int(SR * DUR)
BAR, BEAT = C['bar'], C['beat']
E8, E16 = BEAT / 2, BEAT / 4
rng = np.random.default_rng(2026)
TT = np.arange(N) / SR

def mtof(m): return 440.0 * 2 ** ((m - 69) / 12)
def sos_lp(fc, o=2): return signal.butter(o, min(fc, SR * 0.45), 'low', fs=SR, output='sos')
def sos_hp(fc, o=2): return signal.butter(o, max(fc, 10), 'high', fs=SR, output='sos')
def sos_bp(lo, hi, o=2): return signal.butter(o, [max(lo, 10), min(hi, SR * 0.45)], 'band', fs=SR, output='sos')
def lp(x, fc, o=2): return signal.sosfilt(sos_lp(fc, o), x, axis=-1)
def hp(x, fc, o=2): return signal.sosfilt(sos_hp(fc, o), x, axis=-1)
def bp(x, lo, hi, o=2): return signal.sosfilt(sos_bp(lo, hi, o), x, axis=-1)

def tv_filter(x, design, block=256):
    """time-varying filter; design(t_seconds) -> sos. x: (n,) or (2,n)"""
    x2 = np.atleast_2d(x).astype(np.float64)
    y = np.zeros_like(x2)
    zi = None
    for i in range(0, x2.shape[1], block):
        sos = design(i / SR)
        if zi is None or zi.shape[0] != sos.shape[0]:
            zi = np.zeros((x2.shape[0], sos.shape[0], 2))
        for c in range(x2.shape[0]):
            y[c, i:i + block], zi[c] = signal.sosfilt(sos, x2[c, i:i + block], zi=zi[c])
    return y if x.ndim == 2 else y[0]

# ------------------------------------------------------------------ buses
class Bus:
    def __init__(s):
        s.dry = np.zeros((2, N)); s.hall = np.zeros((2, N)); s.plate = np.zeros((2, N))
BUS = {k: Bus() for k in ['pad', 'mus', 'perc', 'sfx', 'bass']}

def panlr(p):
    a = (np.clip(p, -1, 1) + 1) * np.pi / 4
    return np.cos(a), np.sin(a)

def add(bus, x, t, g=1.0, pan=0.0, hall=0.0, plate=0.0):
    i0 = int(round(t * SR))
    if x.ndim == 1:
        l, r = panlr(pan); xs = np.stack([x * l, x * r])
    else:
        xs = x.copy()
        if pan: l, r = panlr(pan); xs[0] *= l * 1.414; xs[1] *= r * 1.414
    if i0 < 0: xs = xs[:, -i0:]; i0 = 0
    n = min(xs.shape[1], N - i0)
    if n <= 0: return
    seg = xs[:, :n] * g
    edge = min(int(0.003 * SR), n // 2)
    if edge > 0:
        ramp = 0.5 - 0.5 * np.cos(np.linspace(0, np.pi, edge))
        seg[:, :edge] *= ramp
        seg[:, -edge:] *= ramp[::-1]
    b = BUS[bus]
    b.dry[:, i0:i0 + n] += seg
    if hall: b.hall[:, i0:i0 + n] += seg * hall
    if plate: b.plate[:, i0:i0 + n] += seg * plate

# ------------------------------------------------------------------ oscillators / instruments
def saw(f, n, ph0=0.0):
    dt = np.broadcast_to(np.asarray(f, dtype=np.float64) / SR, (n,)).copy()
    ph = (ph0 + np.cumsum(dt)) % 1.0
    y = 2 * ph - 1
    m = ph < dt; x = ph[m] / dt[m]; y[m] -= x + x - x * x - 1
    m = ph > 1 - dt; x = (ph[m] - 1) / dt[m]; y[m] -= x * x + x + x + 1
    return 0.45 * y + 0.55 * np.sin(2 * np.pi * ph)

def tline(n): return np.arange(n) / SR

def smooth_att(t, a): return 0.5 - 0.5 * np.cos(np.pi * np.clip(t / a, 0, 1))

def pad_note(m, dur, att=1.2, rel=2.4, voices=3, det=8.0, vib=0.0, wid=3.0):
    n = int((dur + rel) * SR); t = tline(n); f0 = mtof(m)
    out = np.zeros((2, n))
    for ch in range(2):
        for v in range(voices):
            c = (v - (voices - 1) / 2) * det + (ch * 2 - 1) * wid
            f = f0 * 2 ** (c / 1200)
            if vib: f = f * (1 + vib * np.sin(2 * np.pi * (5.0 + 0.35 * v + 0.2 * ch) * t + rng.random() * 6.28))
            out[ch] += saw(f, n, rng.random())
    env = smooth_att(t, att) * np.where(t < dur, 1.0, np.exp(-(t - dur) / (rel / 4.5)))
    return out * env / voices

def piano(m, vel=0.6, dur=None, T=None):
    f0 = mtof(m)
    T = T or (6.0 if m < 60 else (4.5 if m < 76 else 3.2))
    n = int(T * SR); t = tline(n); y = np.zeros(n)
    Bk = 0.00032
    for k in range(1, 16):
        fk = k * f0 * np.sqrt(1 + Bk * k * k)
        if fk > 10000: break
        amp = (1 / k ** 1.3) * np.exp(-(k - 1) * (1.1 - vel) * 0.45)
        tau = (3.2 if m < 60 else 2.4) / (1 + 0.28 * (k - 1)) * (1.25 - 0.007 * (m - 48))
        for d in (-0.7, 0.7):
            y += amp * 0.5 * np.sin(2 * np.pi * fk * 2 ** (d / 1200) * t + rng.random() * 6.28) * np.exp(-t / max(0.12, tau))
    hn = int(0.008 * SR)
    y[:hn] += lp(rng.standard_normal(hn) * np.hanning(hn), 1800) * 0.08 * vel
    y *= np.clip(t / 0.0025, 0, 1) * vel
    if dur is not None: y *= np.where(t < dur, 1.0, np.exp(-(t - dur) / 0.35))
    return lp(y, 2200 + 3500 * vel)

def bell(m, vel=0.5, T=4.5, ratio=3.5, idx=2.2, tau=1.7, itau=0.5):
    f = mtof(m); n = int(T * SR); t = tline(n)
    I = idx * np.exp(-t / itau)
    y = np.sin(2 * np.pi * f * t + I * np.sin(2 * np.pi * f * ratio * t))
    y = y * np.exp(-t / tau) + 0.22 * np.sin(2 * np.pi * f * 2.0 * t + 0.3) * np.exp(-t / (tau * 0.35))
    y *= np.clip(t / 0.002, 0, 1)
    return y * vel

def celesta(m, vel=0.5, T=3.2):
    f = mtof(m); n = int(T * SR); t = tline(n)
    y = np.sin(2 * np.pi * f * t + 0.9 * np.exp(-t / 0.15) * np.sin(2 * np.pi * f * t))
    y += 0.25 * np.sin(2 * np.pi * f * 4.0 * t) * np.exp(-t / 0.12)
    y += 0.08 * np.sin(2 * np.pi * f * 6.9 * t) * np.exp(-t / 0.05)
    y *= np.exp(-t / 1.1) * np.clip(t / 0.0015, 0, 1)
    return y * vel

def pluck(m, vel=0.5, T=1.1, bright=0.6):
    f = mtof(m); n = int(T * SR); t = tline(n); y = np.zeros(n)
    for k in range(1, 14):
        fk = k * f
        if fk > 12000: break
        y += (1 / k ** 1.1) * np.sin(2 * np.pi * fk * t + rng.random() * 6.28) * np.exp(-t * (2.6 + (k - 1) ** 1.6 * (1.25 - bright) * 2.2))
    y *= np.clip(t / 0.0012, 0, 1)
    return y * vel

def sine_bass(m, dur, vel=0.6, att=0.02, rel=0.4, drive=1.6):
    f = mtof(m); n = int((dur + rel) * SR); t = tline(n)
    y = np.sin(2 * np.pi * f * t) + 0.18 * np.sin(4 * np.pi * f * t + 0.5)
    y = np.tanh(drive * y) / np.tanh(drive)
    env = smooth_att(t, att) * np.where(t < dur, 1.0, np.exp(-(t - dur) / (rel / 4)))
    return lp(y * env * vel, 420)

def kick(vel=1.0, T=0.7, low=44):
    n = int(T * SR); t = tline(n)
    f = low + 95 * np.exp(-t / 0.032)
    y = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.3)
    y += lp(rng.standard_normal(n) * np.exp(-t / 0.0025), 3500) * 0.22
    return np.tanh(1.4 * y) * vel

def taiko(vel=1.0, T=1.6):
    n = int(T * SR); t = tline(n)
    f = 62 + 110 * np.exp(-t / 0.045)
    y = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.55)
    y += lp(rng.standard_normal(n), 900) * np.exp(-t / 0.07) * 0.5
    y += bp(rng.standard_normal(n), 150, 400) * np.exp(-t / 0.25) * 0.4
    return np.tanh(1.3 * y) * vel

def tok(vel=0.5):
    n = int(0.25 * SR); t = tline(n)
    y = (np.sin(2 * np.pi * 820 * t) * 0.7 + np.sin(2 * np.pi * 1390 * t) * 0.4) * np.exp(-t / 0.028)
    y += bp(rng.standard_normal(n), 1500, 5000) * np.exp(-t / 0.012) * 0.5
    return y * vel

def sub_boom(vel=1.0, T=4.0, f1=30, f0=95):
    n = int(T * SR); t = tline(n)
    f = f1 + f0 * np.exp(-t / 0.14)
    y = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 1.4)
    y = np.tanh(1.8 * y)
    y += lp(rng.standard_normal(n), 260) * np.exp(-t / 0.35) * 0.6
    y += bp(rng.standard_normal(n), 300, 3000) * np.exp(-t / 0.05) * 0.25
    return y * vel

def noise_st(n, color='white'):
    x = rng.standard_normal((2, n))
    if color == 'pink':
        b, a = [0.049922035, -0.095993537, 0.050612699, -0.004408786], [1, -2.494956002, 2.017265875, -0.522189400]
        x = signal.lfilter(b, a, x, axis=-1) * 6
    elif color == 'brown':
        x = signal.lfilter([1], [1, -0.995], x, axis=-1) * 0.08
    return x

def whoosh(T, f0, f1, peak=0.65, q=0.9, pan0=-0.6, pan1=0.6, color='pink'):
    n = int(T * SR); t = tline(n)
    x = noise_st(n, color)
    def design(ts):
        u = min(1, ts / T)
        fc = f0 * (f1 / f0) ** u
        return sos_bp(fc / (1 + q), fc * (1 + q))
    y = tv_filter(x, design)
    u = t / T
    env = np.where(u < peak, (u / peak) ** 2.2, np.exp(-((u - peak) / (1 - peak)) * 4))
    pan = pan0 + (pan1 - pan0) * u
    l, r = panlr(pan)
    return np.stack([y[0] * env * l, y[1] * env * r]) * 1.4

def riser(T, f0=200, f1=7000, tonal=True, base=50):
    n = int(T * SR); t = tline(n); u = t / T
    x = noise_st(n, 'white')
    def design(ts):
        uu = min(1, ts / T)
        fc = f0 * (f1 / f0) ** (uu ** 1.5)
        return sos_bp(fc * 0.6, fc * 1.6)
    y = tv_filter(x, design) * (u ** 2.5)
    if tonal:
        ph = 2 * np.pi * np.cumsum(mtof(base) * 2 ** (u ** 1.8 * 2.0)) / SR
        tone = (np.sin(ph) + 0.5 * np.sin(2 * ph) + 0.3 * np.sin(3 * ph)) * u ** 3 * 0.25
        y = y + np.stack([tone, tone])
    return y

def glitter(T, density=180, fmin=2500, fmax=9000, decay=True, conv=False):
    n = int(T * SR); out = np.zeros((2, n))
    cnt = int(density * T)
    for i in range(cnt):
        u = rng.random()
        if decay: u = u ** 1.8
        if conv: u = 1 - (1 - u) ** 0.5
        st = int(u * (n - 2000))
        gl = int(rng.uniform(0.006, 0.03) * SR)
        if st + gl >= n: continue
        f = np.exp(rng.uniform(np.log(fmin), np.log(fmax)))
        tg = tline(gl)
        g = np.sin(2 * np.pi * f * tg) * np.hanning(gl) * rng.uniform(0.2, 1.0)
        p = rng.uniform(-0.9, 0.9); l, r = panlr(p)
        amp = (1 - u * 0.7) if decay else 1
        out[0, st:st + gl] += g * l * amp; out[1, st:st + gl] += g * r * amp
    return out

def bubble(vel=0.3):
    n = int(0.07 * SR); t = tline(n)
    f0 = rng.uniform(380, 900)
    f = f0 * (1 + 1.4 * t / 0.07)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.018) * np.clip(t / 0.002, 0, 1) * vel

def spike_click(vel=1.0):
    n = int(0.03 * SR); t = tline(n)
    y = np.exp(-t / 0.0007) * np.sin(2 * np.pi * 3100 * t) - 0.55 * np.exp(-t / 0.0022) * np.sin(2 * np.pi * 1150 * t + 0.4)
    y += rng.standard_normal(n) * np.exp(-t / 0.0006) * 0.4
    return hp(y, 350) * vel

def tick(vel=0.25):
    n = int(0.06 * SR); t = tline(n)
    y = np.sin(2 * np.pi * 2350 * t) * np.exp(-t / 0.008) + 0.4 * np.sin(2 * np.pi * 4700 * t) * np.exp(-t / 0.004)
    return y * vel

def zap(vel=0.2):
    n = int(0.09 * SR); t = tline(n)
    f = 5200 - 2600 * t / 0.09
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.02) * vel

# ------------------------------------------------------------------ harmony
CH = {
    'Dsus2': (38, [50, 57, 62, 64, 69]),
    'D':     (38, [50, 57, 62, 64, 66, 69]),
    'Dmaj9': (38, [50, 57, 61, 64, 66, 69]),
    'Dlyd':  (38, [50, 57, 61, 64, 66, 68, 73]),
    'Bm':    (35, [47, 54, 57, 61, 62, 66]),
    'G':     (31, [43, 50, 54, 57, 61, 62]),
    'A':     (33, [45, 52, 57, 59, 62, 64]),
    'Asus':  (33, [45, 52, 57, 59, 62, 64]),
    'D/F#':  (42, [50, 57, 62, 64, 66, 69]),
    'A/C#':  (37, [45, 52, 57, 61, 64, 66]),
    'GA':    (31, [43, 50, 55, 57, 59, 62]),
}
PROG = [
    (0.0, 'Dsus2'), (7.5, 'Dmaj9'), (10.0, 'Bm'), (12.5, 'G'),
    (15.0, 'D'), (17.5, 'Bm'), (20.0, 'G'), (22.5, 'A'), (25.0, 'D/F#'), (27.5, 'G'),
    (30.0, 'Bm'), (32.5, 'G'), (35.0, 'D'), (37.5, 'A'), (40.0, 'Bm'), (42.5, 'G'), (43.75, 'A'),
    (45.0, 'Bm'), (50.0, 'G'), (52.5, 'D'), (55.0, 'A'), (57.5, 'Bm'), (60.0, 'G'), (61.25, 'A'),
    (62.5, 'D'), (65.0, 'Bm'), (67.5, 'G'), (70.0, 'A'), (72.5, 'D/F#'),
    (75.0, 'G'), (77.5, 'Asus'),
    (80.0, 'D'), (82.5, 'A/C#'), (85.0, 'Bm'), (87.5, 'G'), (90.0, 'Asus'),
    (92.5, 'GA'), (95.0, 'Dlyd'), (103.0, None)
]
def chord_at(t):
    c = PROG[0][1]
    for s, nm in PROG:
        if nm is None: break
        if t >= s: c = nm
    return c

def chord_tones(name, lo, hi):
    bass, v = CH[name]
    pcs = sorted(set(m % 12 for m in v))
    return [m for m in range(lo, hi + 1) if m % 12 in pcs]

# ------------------------------------------------------------------ PADS (one track, filtered as a whole)
print('pads...', flush=True)
pad = np.zeros((2, N))
pad_lvl = lambda t: np.interp(t, [0, 3, 7.4, 7.5, 9, 15, 30, 45, 55, 62.3, 62.5, 74, 75, 80, 92.5, 95, 99, 103],
                              [0.0, 0.35, 0.45, 0.8, 0.65, 0.42, 0.45, 0.5, 0.6, 0.75, 1.0, 0.9, 0.55, 0.5, 0.6, 1.0, 0.8, 0.0])
for i in range(len(PROG) - 1):
    s, nm = PROG[i]; e = PROG[i + 1][0]
    if nm is None: continue
    bass, v = CH[nm]
    for m in v:
        x = pad_note(m, e - s + 0.25, att=0.9 if s > 0 else 3.0, rel=2.6, voices=3, det=9)
        i0 = int(s * SR); n = min(x.shape[1], N - i0)
        pad[:, i0:i0 + n] += x[:, :n] * 0.17
    xb = pad_note(bass + 12, e - s + 0.25, att=0.9, rel=2.0, voices=2, det=4)
    i0 = int(s * SR); n = min(xb.shape[1], N - i0)
    pad[:, i0:i0 + n] += xb[:, :n] * 0.12
cut_k = [0, 7.4, 7.5, 10, 15, 30, 44, 50, 62.3, 62.5, 74, 75, 80, 92.5, 95, 98, 103]
cut_v = [420, 700, 2600, 1300, 800, 900, 1500, 1200, 2600, 3600, 3000, 1200, 1100, 2400, 3400, 1700, 700]
pad = tv_filter(pad, lambda ts: sos_lp(np.interp(ts, cut_k, cut_v), 2), block=512)
pad *= pad_lvl(TT)
add('pad', pad, 0, 0.9, hall=0.45)

# ------------------------------------------------------------------ STRINGS (laureates, climax, finale)
print('strings...', flush=True)
strg = np.zeros((2, N))
str_sections = [(62.5, 75.0), (80.0, 92.5), (92.5, 103.0)]
for i in range(len(PROG) - 1):
    s, nm = PROG[i]; e = PROG[i + 1][0]
    if nm is None: continue
    if not any(a <= s < b for a, b in str_sections): continue
    bass, v = CH[nm]
    for m in v[2:] + [v[-1] + 12]:
        x = pad_note(m + 12 if m < 62 else m, e - s + 0.3, att=1.6, rel=3.0, voices=4, det=11, vib=0.0028, wid=6)
        i0 = int(s * SR); n = min(x.shape[1], N - i0)
        strg[:, i0:i0 + n] += x[:, :n] * 0.12
strg = lp(hp(strg, 220), 3800)
str_lvl = np.interp(TT, [62.4, 63.5, 74, 75.2, 80, 82, 92, 95, 99, 103], [0, 0.8, 0.8, 0, 0.0, 0.75, 0.85, 1.0, 0.8, 0])
add('mus', strg * str_lvl, 0, 0.75, hall=0.55)

# ------------------------------------------------------------------ CHOIR ("aah" formants)
print('choir...', flush=True)
choir = np.zeros((2, N))
for i in range(len(PROG) - 1):
    s, nm = PROG[i]; e = PROG[i + 1][0]
    if nm is None or not (62.5 <= s < 75 or s >= 85.0): continue
    bass, v = CH[nm]
    for m in v[1:5]:
        x = pad_note(m, e - s + 0.4, att=1.3, rel=3.0, voices=3, det=14, vib=0.006, wid=8)
        i0 = int(s * SR); n = min(x.shape[1], N - i0)
        choir[:, i0:i0 + n] += x[:, :n] * 0.2
form = np.zeros_like(choir)
for (f, g, q) in [(730, 1.0, 0.18), (1100, 0.55, 0.14), (2550, 0.22, 0.1)]:
    form += signal.sosfilt(sos_bp(f * (1 - q), f * (1 + q)), choir, axis=-1) * g
ch_lvl = np.interp(TT, [62.4, 64, 74, 75.5, 85, 88, 92.5, 95, 100, 103], [0, 0.9, 0.9, 0, 0, 0.55, 0.6, 1.0, 0.7, 0])
add('mus', form * ch_lvl, 0, 1.3, hall=0.7)

# ------------------------------------------------------------------ BASS
print('bass...', flush=True)
for i in range(len(PROG) - 1):
    s, nm = PROG[i]; e = PROG[i + 1][0]
    if nm is None or s < 20.0: continue
    bass, v = CH[nm]
    b = bass if bass < 40 else bass - 12
    if 55.0 <= s < 62.5:
        st = s
        while st < e - 1e-6:
            if st < 62.38: add('bass', sine_bass(b, E8 * 0.8, vel=0.55, att=0.005, rel=0.12), st, 1.0)
            st += E8
    elif 62.5 <= s < 75:
        add('bass', sine_bass(b, e - s, vel=0.55, att=0.02, rel=0.6), s, 1.0)
        st = s
        while st < e - 1e-6:
            add('bass', sine_bass(b + 12, E8 * 0.6, vel=0.18, att=0.004, rel=0.1), st + E8, 1.0)
            st += BEAT
    elif s >= 75:
        add('bass', sine_bass(b, e - s, vel=0.45 if s < 95 else 0.6, att=0.4, rel=2.5 if s >= 95 else 0.8), s, 1.0)
    else:
        add('bass', sine_bass(b, e - s, vel=0.38 if s < 30 else 0.45, att=0.3, rel=0.8), s, 1.0)

# ------------------------------------------------------------------ PIANO
print('piano...', flush=True)
def arp_bar(s, nm, vel, pattern, lo=57, hi=81, step=E8, count=8, hall=0.5):
    tones = chord_tones(nm, lo, hi)
    for k in range(count):
        idx = pattern[k % len(pattern)] % len(tones)
        jt = rng.normal(0, 0.006)
        vv = vel * (1.0 if k % 4 == 0 else 0.78) * rng.uniform(0.9, 1.05)
        add('mus', piano(tones[idx], vv), s + k * step + jt, 0.5, pan=np.interp(tones[idx], [lo, hi], [-0.35, 0.35]), hall=hall)
# alga: flowing arpeggios
pat = [0, 2, 4, 6, 5, 3, 4, 2]
for s in [15.0, 17.5, 20.0, 22.5, 25.0, 27.5]:
    nm = chord_at(s + 0.01)
    v = 0.32 if s == 15.0 else 0.42
    arp_bar(s, nm, v, pat if s % 5 == 0 else [1, 3, 5, 6, 4, 5, 3, 2])
    bass, vv = CH[nm]
    add('mus', piano(bass + 12 if bass < 40 else bass, 0.4), s, 0.5, pan=-0.2, hall=0.5)
# piano fade-in to membrane (one bar)
arp_bar(30.0, 'Bm', 0.25, [0, 2, 4, 6, 4, 2], step=E8, count=6)
# eye
for s, notes in [(75.0, [74, 78, 81]), (76.25, [73, 76, 81, 85]), (77.5, [76, 81]), (78.75, [74, 78])]:
    for j, m in enumerate(notes): add('mus', piano(m, 0.38), s + j * 0.11, 0.55, pan=0.1 * j - 0.15, hall=0.7)
# laureates: gentle 8ths
for s in [80.0, 82.5, 85.0, 87.5, 90.0]:
    arp_bar(s, chord_at(s + 0.01), 0.3, [0, 2, 3, 5, 4, 3, 2, 1], lo=62, hi=86, hall=0.6)
    bass, vv = CH[chord_at(s + 0.01)]
    add('mus', piano(bass + 12 if bass < 40 else bass, 0.42), s, 0.55, hall=0.6)

# ------------------------------------------------------------------ CELESTA / BELLS (melody)
print('melody...', flush=True)
title_motif = [(8.125, 81), (8.75, 86), (9.375, 85), (10.0, 78), (11.25, 81), (11.875, 83), (12.5, 90), (13.125, 88), (13.75, 86)]
for t0, m in title_motif: add('mus', celesta(m, 0.5), t0, 0.42, pan=rng.uniform(-0.3, 0.3), hall=0.7)
add('mus', celesta(81, 0.35), 0.5, 0.35, pan=0.0, hall=0.9)           # the photon appears
add('mus', celesta(88, 0.25), 3.0, 0.3, pan=0.2, hall=0.9)
add('mus', celesta(86, 0.25), 4.25, 0.3, pan=-0.2, hall=0.9)
# climax melody (bell + celesta doubling); app pings are part of it
clim = [(62.5, 81, 0.6), (63.4375, 86, 0.45), (63.75, 88, 0.55), (65.0, 90, 0.6), (66.25, 88, 0.45), (66.875, 86, 0.45),
        (67.5, 83, 0.65), (68.75, 86, 0.65), (70.0, 88, 0.7), (71.25, 90, 0.7), (72.5, 93, 0.75), (73.75, 90, 0.5), (74.375, 88, 0.45)]
for t0, m, v in clim:
    add('mus', bell(m - 12, v, ratio=3.5, idx=1.6, tau=1.8), t0, 0.3, pan=rng.uniform(-0.25, 0.25), hall=0.6)
    add('mus', celesta(m, v * 0.8), t0, 0.32, pan=rng.uniform(-0.3, 0.3), hall=0.6)
# 16th celesta sparkle arpeggio in the climax
for s in np.arange(62.5, 74.4, E16):
    nm = chord_at(s + 1e-3); tones = chord_tones(nm, 81, 98)
    k = int(round((s - 62.5) / E16))
    m = tones[[0, 1, 2, 3, 2, 1][k % 6] % len(tones)]
    add('mus', celesta(m, 0.16 + 0.05 * (k % 4 == 0), T=1.2), s, 0.3, pan=0.5 * np.sin(k * 0.7), hall=0.35)
# names
for t0, m in zip(C['names'], [74, 78, 81]):
    add('mus', bell(m, 0.7, T=6, ratio=3.5, idx=1.8, tau=2.6), t0, 0.32, pan=[-0.5, 0, 0.5][C['names'].index(t0)], hall=0.8)
    add('mus', celesta(m + 12, 0.45), t0, 0.3, hall=0.8)
# finale motif
for t0, m in [(95.0, 86), (95.0, 93), (96.25, 93), (96.875, 90), (97.5, 88), (98.125, 85), (98.75, 86)]:
    add('mus', celesta(m, 0.5 if t0 > 95 else 0.6, T=4.0), t0, 0.42, pan=rng.uniform(-0.25, 0.25), hall=0.85)
add('mus', bell(62, 0.8, T=8, ratio=3.5, idx=2.0, tau=3.5), 95.0, 0.35, hall=0.8)
add('mus', bell(74, 0.6, T=8, ratio=3.5, idx=1.6, tau=3.0), 95.0, 0.3, hall=0.8)

# ------------------------------------------------------------------ RHYTHM: membrane plucks, neuron spikes, drums
print('rhythm...', flush=True)
for s in np.arange(32.5, 45.0, E8):
    nm = chord_at(s + 1e-3); tones = chord_tones(nm, 69, 86)
    k = int(round((s - 32.5) / E8))
    m = tones[[0, 2, 1, 3, 2, 4, 3, 1][k % 8] % len(tones)]
    vel = 0.14 + 0.1 * min(1, (s - 32.5) / 10)
    add('mus', pluck(m, vel, bright=0.45), s, 0.45, pan=0.35 * np.sin(k * 1.3), hall=0.3, plate=0.2)
for s in np.arange(35.0, 44.9, BEAT * 2):
    add('perc', kick(0.35, low=46), s, 0.8, hall=0.1)
for s in np.arange(40.0, 44.9, BEAT):
    if (s - 40.0) % (BEAT * 2) > 0.01: add('perc', kick(0.22, low=50), s, 0.8, hall=0.1)

# neuron: every light pulse -> spike click + arpeggiated pluck
spk_seq = []
for i, tp in enumerate(C['pulses']):
    ts = tp + C['spikeLatency']
    nm = chord_at(tp + 1e-3)
    tones = chord_tones(nm, 66, 90)
    up = [0, 1, 2, 3, 4, 5, 6, 5, 4, 3, 2, 1]
    m = tones[up[i % len(up)] % len(tones)]
    prog = (tp - 50.0) / 12.0
    add('sfx', spike_click(0.55 + 0.25 * prog), ts, 0.055, pan=rng.uniform(-0.25, 0.25), plate=0.12)
    add('mus', pluck(m, 0.3 + 0.25 * prog, T=0.9, bright=0.55 + 0.3 * prog), ts, 0.5, pan=0.4 * np.sin(i * 0.9), hall=0.25, plate=0.25)
    add('sfx', zap(0.12), tp, 0.055, pan=-0.3, plate=0.1)
    spk_seq.append(ts)
for s in np.arange(52.5, 62.4, BEAT):
    v = 0.45 if s < 57.5 else 0.62
    add('perc', kick(v, low=44), s, 0.85, hall=0.08)
for s in np.arange(57.5 + BEAT, 62.4, BEAT * 2):
    add('perc', tok(0.35), s, 0.7, pan=0.15, hall=0.25)
for s in np.arange(61.25, 62.35, E16):
    add('perc', taiko(0.25 + 0.4 * (s - 61.25) / 1.1, T=0.6), s, 0.6, pan=rng.uniform(-0.4, 0.4), hall=0.3)
# climax drums
for s in np.arange(62.5, 74.4, BEAT * 2):
    add('perc', kick(0.75, low=42), s, 0.9, hall=0.12)
for s in np.arange(62.5, 74.4, BAR):
    add('perc', taiko(0.8), s, 0.6, pan=-0.2, hall=0.45)
    add('perc', taiko(0.5), s + BEAT * 1.5, 0.5, pan=0.25, hall=0.45)
for s in np.arange(62.5 + BEAT, 74.4, BEAT * 2):
    add('perc', tok(0.28), s, 0.6, pan=-0.1, hall=0.4)
# finale approach: low rumble roll
for s in np.arange(92.5, 94.95, E16):
    u = (s - 92.5) / 2.5
    add('perc', taiko(0.08 + 0.4 * u ** 2, T=0.5), s, 0.55, pan=rng.uniform(-0.5, 0.5), hall=0.5)

# ------------------------------------------------------------------ SOUND DESIGN
print('sfx...', flush=True)
# opening: air + photon
air = hp(noise_st(N, 'white'), 7000) * 0.006
air *= np.interp(TT, [0, 2, 7.4, 7.5, 15, 30, 62, 75, 103], [0, 1, 1.4, 0.6, 0.5, 0.5, 0.6, 0.5, 0.2])
add('sfx', air, 0, 0.0)
drone_t = tline(int(9 * SR))
dr = np.sin(2 * np.pi * mtof(38) * drone_t) * 0.4 + np.sin(2 * np.pi * mtof(45) * drone_t + 1) * 0.25 + np.sin(2 * np.pi * mtof(50) * drone_t + 2) * 0.12
dr *= smooth_att(drone_t, 3.0) * np.exp(-np.maximum(0, drone_t - 7.45) / 0.05)
add('sfx', dr, 0, 0.1, hall=0.3)
# photon "glint" at appearance
add('sfx', glitter(1.6, density=60, fmin=3500, fmax=8000), 0.45, 0.07, hall=0.6)
# approach: riser + doppler whistle
add('sfx', riser(2.15, 300, 9000, tonal=True, base=62), 5.33, 0.22, hall=0.2)
wt = tline(int(2.15 * SR)); wu = wt / 2.15
wh = np.sin(2 * np.pi * np.cumsum(700 * 2 ** (wu ** 3 * 2.2)) / SR) * wu ** 3 * 0.12
add('sfx', wh, 5.33, 0.5, hall=0.3)
# title impact
add('sfx', sub_boom(1.0), C['titleHit'], 0.75, hall=0.15)
add('sfx', whoosh(1.2, 4000, 300, peak=0.08, pan0=0, pan1=0), C['titleHit'], 0.12, hall=0.3)
add('sfx', glitter(2.2, density=220, fmin=3000, fmax=10000, conv=True), C['titleHit'] + 0.05, 0.08, hall=0.5)
# reverse swell into the title
sw = pad_note(62, 1.5, att=1.4, rel=0.1, voices=3) + pad_note(69, 1.5, att=1.4, rel=0.1, voices=3) + pad_note(73, 1.5, att=1.4, rel=0.1, voices=3)
add('sfx', lp(sw, 3000) * 0.18, 5.95, 1.0, hall=0.2)
# fly-through the ring
add('sfx', whoosh(2.0, 250, 3500, peak=0.75, pan0=-0.7, pan1=0.7), 13.7, 0.32, hall=0.25)
# underwater bed + bubbles (alga)
wb = hp(lp(noise_st(N, 'brown'), 900), 110) * 0.9
wb *= (0.7 + 0.3 * np.sin(2 * np.pi * 0.13 * TT))[None, :] * np.interp(TT, [14.8, 16.5, 28, 30.0, 30.5], [0, 1, 1, 1.3, 0])[None, :]
add('sfx', wb, 0, 0.04)
bt = 15.6
while bt < 29.5:
    add('sfx', bubble(rng.uniform(0.1, 0.3)), bt, 0.25, pan=rng.uniform(-0.7, 0.7), hall=0.3)
    bt += rng.uniform(0.15, 0.9)
# light switches on
lt = tline(int(3.0 * SR))
lon = sum(np.sin(2 * np.pi * mtof(m) * lt + rng.random() * 6) for m in [74, 81, 86, 88, 93]) * smooth_att(lt, 1.2) * np.exp(-lt / 1.6) * 0.05
add('sfx', lon, C['lightOn'], 1.0, hall=0.8)
add('sfx', glitter(2.0, density=50, fmin=4000, fmax=9000), C['lightOn'] + 0.2, 0.05, hall=0.6)
# dive into the eyespot
add('sfx', whoosh(1.9, 200, 5000, peak=0.92, pan0=0.3, pan1=-0.1), 28.15, 0.4, hall=0.2)
add('sfx', riser(1.8, 400, 6000, tonal=True, base=57), 28.2, 0.12)
add('sfx', lp(sub_boom(0.8, T=3.0, f1=34, f0=70), 900), C['dive'], 0.6, hall=0.3)
add('sfx', glitter(1.6, density=140, fmin=2000, fmax=7000), C['dive'], 0.06, hall=0.5)
# callout ticks
for t0 in [23.2, 31.8, 33.0, 34.55, 35.7, 45.7, 49.4]:
    add('sfx', tick(0.22), t0, 0.5, pan=0.3, plate=0.3)
for t0 in C['apps']:
    add('sfx', tick(0.2), t0 + 0.05, 0.4, pan=-0.2, plate=0.3)
# photons hitting channelrhodopsin
for i, th in enumerate(C['chrHits']):
    T = C['photonTravel']
    add('sfx', whoosh(T + 0.05, 2500, 7000, peak=0.95, q=0.5, pan0=-0.3, pan1=0.1, color='white'), th - T, 0.09)
    hit_m = [93, 90, 88, 86, 93, 95, 98, 100][i]
    add('sfx', bell(hit_m, 0.5, T=2.5, ratio=2.76, idx=1.5, tau=0.9), th, 0.14, pan=0.1, hall=0.6)
    add('sfx', glitter(1.4, density=170, fmin=1800, fmax=6500), th + 0.05, 0.075, hall=0.35, plate=0.3)
    add('sfx', lp(sub_boom(0.35, T=1.2, f1=50, f0=60), 500), th, 0.35)
for th, pi in C['chrBg']:
    add('sfx', bell(98 + (pi % 3) * 2, 0.25, T=1.5, ratio=2.76, idx=1.2, tau=0.5), th, 0.08, pan=rng.uniform(-0.7, 0.7), hall=0.6)
# pull back from the membrane + DNA swirl
add('sfx', whoosh(2.2, 3000, 250, peak=0.35, pan0=0.4, pan1=-0.4), 43.6, 0.25, hall=0.3)
dn = whoosh(2.8, 600, 2600, peak=0.6, q=0.6, pan0=-0.8, pan1=0.2)
dn *= (0.75 + 0.25 * np.sin(2 * np.pi * 3.0 * tline(dn.shape[1])))[None, :]
add('sfx', dn, 45.0, 0.16, hall=0.4)
add('sfx', glitter(1.8, density=90, fmin=3000, fmax=9000), 47.4, 0.06, hall=0.6)
add('mus', celesta(86, 0.4), 47.8, 0.35, hall=0.8)
# fibre slides in (soft servo)
ft = tline(int(1.4 * SR))
fz = np.sin(2 * np.pi * (170 + 40 * ft) * ft + 2 * np.sin(2 * np.pi * 31 * ft)) * smooth_att(ft, 0.2) * np.exp(-ft / 0.6) * 0.06
add('sfx', bp(fz, 120, 1500), C['fiberIn'], 0.15, pan=-0.4, hall=0.2)
# build to the drop
add('sfx', riser(2.4, 250, 10000, tonal=True, base=50), 60.0, 0.3, hall=0.2)
add('sfx', sub_boom(1.0, T=5.0), C['drop'], 0.85, hall=0.2)
add('sfx', whoosh(1.6, 5000, 200, peak=0.06, pan0=0, pan1=0), C['drop'], 0.2, hall=0.4)
add('sfx', glitter(3.0, density=260, fmin=2500, fmax=10000), C['drop'] + 0.05, 0.075, hall=0.5)
# brain -> eye
rs = pad_note(67, 1.2, att=1.1, rel=0.05, voices=3) + pad_note(74, 1.2, att=1.1, rel=0.05, voices=3)
add('sfx', lp(rs, 2500) * 0.15, 73.85, 1.0, hall=0.3)
add('sfx', whoosh(1.6, 300, 2500, peak=0.8), 74.0, 0.18, hall=0.3)
# amber light enters the eye
et = tline(int(4 * SR))
eg = sum(np.sin(2 * np.pi * mtof(m) * et + rng.random() * 6) for m in [69, 76, 81, 85, 88]) * smooth_att(et, 0.4) * np.exp(-et / 1.8) * 0.06
add('sfx', eg, C['eyeLight'] - 0.3, 1.0, hall=0.8)
add('sfx', glitter(2.0, density=70, fmin=3000, fmax=8000), C['eyeLight'], 0.06, hall=0.6)
# laureate pillars: soft downward shimmer before each name
for t0 in C['names']:
    add('sfx', whoosh(0.75, 6000, 1500, peak=0.85, q=0.5, pan0=0, pan1=0, color='white'), t0 - 0.65, 0.07, hall=0.5)
add('sfx', glitter(1.6, density=60, fmin=3000, fmax=8000), C['link'], 0.05, hall=0.6)
# converge + finale
add('sfx', riser(2.5, 200, 7000, tonal=True, base=50), 92.5, 0.2, hall=0.3)
add('sfx', sub_boom(0.9, T=6.0, f1=29, f0=80), C['finaleHit'], 0.8, hall=0.25)
add('sfx', glitter(3.5, density=200, fmin=3000, fmax=11000, conv=True), C['finaleHit'], 0.07, hall=0.6)

# ------------------------------------------------------------------ REVERBS
print('reverb...', flush=True)
def make_ir(rt, length, pre=0.02, hi_damp=0.45, seed=1, er=True):
    n = int(length * SR); t = tline(n); r = np.random.default_rng(seed)
    ir = np.zeros((2, n))
    for ch in range(2):
        x = r.standard_normal(n)
        lo = signal.sosfilt(sos_lp(450), x); hi = signal.sosfilt(sos_hp(3500), x); mid = x - lo - hi
        dec = lambda T: np.exp(-6.91 * t / T)
        ir[ch] = lo * dec(rt * 1.2) + mid * dec(rt) + hi * dec(rt * hi_damp)
        ir[ch] *= np.clip(t / 0.04, 0, 1) ** 1.5
        if er:
            for k in range(10):
                d = int(r.uniform(0.008, 0.07) * SR); ir[ch, d] += r.uniform(-1, 1) * 2.5 * np.exp(-d / SR / 0.08)
    ir = np.concatenate([np.zeros((2, int(pre * SR))), ir], axis=1)
    ir /= np.sqrt(np.sum(ir ** 2) / 2)
    return ir
BUS['sfx'].dry = lp(BUS['sfx'].dry, 6500, 2)
BUS['sfx'].hall = lp(BUS['sfx'].hall, 6500, 2)
BUS['sfx'].plate = lp(BUS['sfx'].plate, 6500, 2)
IR_H = make_ir(4.8, 6.0, pre=0.03, seed=11)
IR_P = make_ir(1.6, 2.5, pre=0.008, hi_damp=0.7, seed=12)
hall_send = sum(b.hall for b in BUS.values())
plate_send = sum(b.plate for b in BUS.values())
hall_send = hp(hall_send, 180)
wet_h = np.stack([signal.fftconvolve(hall_send[c], IR_H[c])[:N] for c in range(2)]) * 0.55
wet_p = np.stack([signal.fftconvolve(plate_send[c], IR_P[c])[:N] for c in range(2)]) * 0.5

# ------------------------------------------------------------------ SIDECHAIN + MIX
print('mix...', flush=True)
duck = np.ones(N)
def duck_at(t0, depth, rel):
    i0 = int(t0 * SR); n = min(int(rel * 5 * SR), N - i0); tt = tline(n)
    duck[i0:i0 + n] = np.minimum(duck[i0:i0 + n], 1 - depth * np.exp(-tt / rel))
for s in np.arange(52.5, 62.4, BEAT): duck_at(s, 0.28, 0.12)
for s in np.arange(62.5, 74.4, BEAT * 2): duck_at(s, 0.3, 0.16)
for s in [C['titleHit'], C['drop'], C['finaleHit']]: duck_at(s, 0.5, 0.35)
# pre-drop silence
gap = np.ones(N); i0, i1 = int(62.36 * SR), int(62.5 * SR); gap[i0:i1] = np.linspace(1, 0.05, i1 - i0) ** 2
gap7 = np.ones(N); j0, j1 = int(7.38 * SR), int(7.5 * SR); gap7[j0:j1] = np.linspace(1, 0.1, j1 - j0) ** 2

mix = (BUS['pad'].dry * duck * 1.6 + BUS['bass'].dry * duck * 0.2 + BUS['mus'].dry + BUS['perc'].dry * 0.5 + BUS['sfx'].dry)
mix = mix * gap * gap7 + wet_h * 1.5 + wet_p * 1.2
mix = hp(mix, 24, 2)
# section dynamics (dramatic arc)
arc_k = [0, 7.4, 7.5, 14.5, 16.0, 27.5, 29.5, 30.5, 44.5, 46.0, 50.0, 59.5, 62.3, 62.5, 74.3, 75.5, 79.5, 81.0, 92.0, 94.9, 95.0, 100.0, 103.0]
arc_v = [0, 0, 0.5, 0, -4, -4, -2, -3, -3, -4.5, -3.5, -1, 0, 1.8, 1.8, -5, -5, -2.5, -2, 0, 1.2, 0.5, 0]
mix *= (10 ** (np.interp(TT, arc_k, arc_v) / 20))[None, :]

# gentle glue compression
def compress(x, thr_db=-13, ratio=1.7, att=0.015, rel=0.3):
    lvl = np.sqrt(signal.lfilter([0.002], [1, -0.998], np.mean(x ** 2, axis=0)) + 1e-12)
    db = 20 * np.log10(lvl + 1e-9)
    over = np.maximum(0, db - thr_db)
    gr = -over * (1 - 1 / ratio)
    a_a, a_r = np.exp(-1 / (att * SR)), np.exp(-1 / (rel * SR))
    g = np.empty_like(gr); prev = 0.0
    # vectorised-ish smoothing by blocks
    blk = 64
    gb = gr[::blk]; sm = np.empty_like(gb); p = 0.0
    for i, v in enumerate(gb):
        c = a_a ** blk if v < p else a_r ** blk
        p = c * p + (1 - c) * v; sm[i] = p
    g = np.interp(np.arange(x.shape[1]), np.arange(len(sm)) * blk, sm)
    return x * (10 ** (g / 20))[None, :]
mix = compress(mix)

# normalise to loudness-ish level then lookahead limiter
def limiter(x, ceil=0.89, la=0.005):
    from scipy.ndimage import uniform_filter1d
    peak = np.max(np.abs(x), axis=0)
    need = np.minimum(1.0, ceil / (peak + 1e-9))
    w = int(la * SR)
    need = minimum_filter1d(need, size=4 * w + 1)
    g = uniform_filter1d(need, size=2 * w + 1)
    return x * g[None, :]
def lufs(x):
    # ITU-R BS.1770 K-weighting
    b1, a1 = [1.53512485958697, -2.69169618940638, 1.19839281085285], [1.0, -1.69065929318241, 0.73248077421585]
    b2, a2 = [1.0, -2.0, 1.0], [1.0, -1.99004745483398, 0.99007225036621]
    y = signal.lfilter(b2, a2, signal.lfilter(b1, a1, x, axis=-1), axis=-1)
    blk, hop = int(0.4 * SR), int(0.1 * SR)
    ms = np.array([np.sum(np.mean(y[:, i:i + blk] ** 2, axis=1)) for i in range(0, y.shape[1] - blk, hop)])
    L = -0.691 + 10 * np.log10(ms + 1e-12)
    g1 = ms[L > -70]
    rel = -0.691 + 10 * np.log10(np.mean(g1)) - 10
    g2 = ms[(L > -70) & (L > rel)]
    return -0.691 + 10 * np.log10(np.mean(g2))
def tp_limiter(x, ceil_db=-1.3, la=0.005):
    from scipy.ndimage import uniform_filter1d
    os_ = signal.resample_poly(x, 4, 1, axis=-1)
    pk = np.max(np.abs(os_), axis=0).reshape(-1, 4).max(axis=1)[:x.shape[1]]
    ceil = 10 ** (ceil_db / 20)
    need = np.minimum(1.0, ceil / (pk + 1e-9))
    w = int(la * SR)
    need = minimum_filter1d(need, size=4 * w + 1)
    g = uniform_filter1d(need, size=2 * w + 1)
    return x * g[None, :]
for it in range(3):
    L0 = lufs(mix)
    mix *= 10 ** ((-14.3 - L0) / 20)
    mix = tp_limiter(mix)
print('LUFS', lufs(mix))
# fades
fi = np.clip(TT / 0.02, 0, 1); fo = np.clip((DUR - TT) / 0.6, 0, 1)
mix *= (fi * fo)[None, :]
out = sys.argv[1] if len(sys.argv) > 1 else str(Path(__file__).with_name('score.wav'))
Path(out).parent.mkdir(parents=True, exist_ok=True)
wavfile.write(out, SR, mix.T.astype(np.float32))
print('peak', np.max(np.abs(mix)), 'rms', np.sqrt(np.mean(mix ** 2)), 'written', out)
