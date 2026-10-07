import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const cues = require('./timeline.js');
const dir = path.dirname(fileURLToPath(import.meta.url));
const args = Object.fromEntries(process.argv.slice(2).map(arg => {
  const equal = arg.indexOf('=');
  return equal < 0 ? [arg.replace(/^--/, ''), '1'] : [arg.slice(2, equal), arg.slice(equal + 1)];
}));
const fps = cues.fps;
const total = Math.round(cues.dur * fps);
const from = Number(args.from ?? 0);
const to = Number(args.to ?? total);
if (!Number.isInteger(from) || !Number.isInteger(to) || from < 0 || to <= from || to > total) {
  throw new Error(`Frame range must satisfy 0 <= from < to <= ${total}`);
}
const encoder = args.encoder ?? (process.platform === 'darwin' ? 'h264_videotoolbox' : 'libx264');
if (!['libx264', 'h264_videotoolbox'].includes(encoder)) throw new Error('Unsupported encoder');
const output = path.resolve(args.out ?? path.join(dir, '..', 'renders', 'picture-4k.mp4'));
fs.mkdirSync(path.dirname(output), { recursive: true });
const launchArgs = [
  `--use-angle=${args.angle ?? (process.platform === 'darwin' ? 'metal' : 'swiftshader')}`,
  '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--disable-gpu-vsync', '--force-color-profile=srgb',
];
const browser = await chromium.launch({
  ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}),
  args: launchArgs,
});
let ff;
try {
  const page = await browser.newPage({ viewport: { width: 3840, height: 2160 }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', error => { errors.push(String(error)); console.error('PAGEERROR', String(error)); });
  await page.goto(pathToFileURL(path.join(dir, 'index.html')).href);
  await page.waitForFunction(() => window.READY === true, null, { timeout: 120000 });
  await page.evaluate(async () => {
    await Promise.all([
      document.fonts.load('300 54px "Noto Serif CJK SC"', '光一切始于一个单细胞绿藻'),
      document.fonts.load('300 24px "Noto Sans CJK SC"', '神经元中文'),
      document.fonts.load('300 15px "Inter"', 'NOBEL PRIZE 2026'),
      document.fonts.load('italic 400 30px "TeX Gyre Pagella"', 'Chlamydomonas'),
    ]);
    await document.fonts.ready;
  });
  const cdp = await page.context().newCDPSession(page);
  async function grab() {
    const result = await cdp.send('Page.captureScreenshot', { format: 'jpeg', quality: 98 });
    return Buffer.from(result.data, 'base64');
  }
  if (args.stills) {
    const outdir = path.resolve(args.outdir ?? path.join(dir, '..', 'renders', 'stills'));
    fs.mkdirSync(outdir, { recursive: true });
    for (const timestamp of args.stills.split(',')) {
      const t = Number(timestamp);
      if (!Number.isFinite(t) || t < 0 || t >= cues.dur) throw new Error(`Invalid timestamp: ${timestamp}`);
      await page.evaluate(time => window.renderFrame(time), t);
      fs.writeFileSync(path.join(outdir, `t${t.toFixed(2).padStart(6, '0')}.jpg`), await grab());
      console.log(`Saved frame at ${t}s`);
    }
  } else {
    const codecArgs = encoder === 'libx264'
      ? ['-c:v', encoder, '-preset', args.preset ?? 'fast', '-crf', args.crf ?? '20',
        '-maxrate', '60M', '-bufsize', '120M', '-threads', '6', '-g', '60']
      : ['-c:v', encoder, '-b:v', args.bitrate ?? '60M', '-maxrate', '65M', '-bufsize', '120M',
        '-profile:v', 'high', '-level:v', '5.1', '-g', '60'];
    ff = spawn(process.env.FFMPEG_PATH ?? 'ffmpeg', [
      '-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'mjpeg', '-i', '-',
      ...codecArgs, '-pix_fmt', 'yuv420p', '-color_primaries', 'bt709', '-color_trc', 'bt709',
      '-colorspace', 'bt709', '-movflags', '+faststart', output,
    ], { stdio: ['pipe', 'inherit', 'inherit'] });
    let encoderError;
    ff.on('error', error => { encoderError = error; });
    ff.stdin.on('error', error => { encoderError = error; });
    const closed = new Promise(resolve => ff.once('close', resolve));
    const started = Date.now();
    for (let frame = from; frame < to; frame++) {
      if (encoderError) throw encoderError;
      await page.evaluate(t => window.renderFrame(t), frame / fps);
      const buffer = await grab();
      if (encoderError) throw encoderError;
      if (!ff.stdin.write(buffer)) await new Promise((resolve, reject) => {
        const cleanup = () => { ff.stdin.off('drain', drained); ff.stdin.off('error', failed); };
        const drained = () => { cleanup(); resolve(); };
        const failed = error => { cleanup(); reject(error); };
        ff.stdin.once('drain', drained); ff.stdin.once('error', failed);
      });
      if ((frame - from) % fps === 0) console.log(`Frame ${frame}/${to}; elapsed ${((Date.now() - started) / 1000).toFixed(0)}s`);
    }
    ff.stdin.end();
    const code = await closed;
    if (encoderError) throw encoderError;
    if (code !== 0) throw new Error(`Encoder exited with code ${code}`);
    console.log(`Written ${output}`);
  }
  if (errors.length) throw new Error(errors.join('\n'));
} finally {
  if (ff && ff.exitCode === null) ff.kill();
  await browser.close();
}
