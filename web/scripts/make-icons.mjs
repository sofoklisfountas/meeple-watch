// Generates the app icons (a die with five pips) as PNGs. Run: node scripts/make-icons.mjs
import fs from 'node:fs';
import zlib from 'node:zlib';

function crc32(buf) {
  let crc = 0xffffffff;
  for (const b of buf) {
    let c = (crc ^ b) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = c ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function png(size, px) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6;
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    px.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0)),
  ]);
}

const TOP = [99, 102, 241], BOT = [79, 70, 229]; // indigo gradient
function draw(size, { fullBleed }) {
  const px = Buffer.alloc(size * size * 4);
  const SS = 4;
  const m = fullBleed ? 0 : size * 0.06, r = fullBleed ? 0 : size * 0.22;
  const scale = fullBleed ? 0.62 : 1; // smaller die inside maskable safe zone
  const pipR = size * 0.075 * scale;
  const c = size / 2, d = size * 0.19 * scale;
  const pips = [[-d, -d], [d, -d], [0, 0], [-d, d], [d, d]].map(([x, y]) => [c + x, c + y]);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    let a = 0, rr = 0, gg = 0, bb = 0;
    for (let sy = 0; sy < SS; sy++) for (let sx = 0; sx < SS; sx++) {
      const X = x + (sx + 0.5) / SS, Y = y + (sy + 0.5) / SS;
      const hw = size / 2 - m;
      const qx = Math.abs(X - c) - (hw - r), qy = Math.abs(Y - c) - (hw - r);
      const dist = Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r;
      if (dist > 0) continue;
      const t = Y / size;
      let col = TOP.map((v, i) => v + (BOT[i] - v) * t);
      if (pips.some(([px_, py]) => Math.hypot(X - px_, Y - py) <= pipR)) col = [255, 255, 255];
      a++; rr += col[0]; gg += col[1]; bb += col[2];
    }
    const i = (y * size + x) * 4;
    if (a) { px[i] = rr / a; px[i + 1] = gg / a; px[i + 2] = bb / a; px[i + 3] = (a / (SS * SS)) * 255; }
  }
  return png(size, px);
}

const out = new URL('../public/', import.meta.url);
fs.writeFileSync(new URL('pwa-192.png', out), draw(192, { fullBleed: false }));
fs.writeFileSync(new URL('pwa-512.png', out), draw(512, { fullBleed: false }));
fs.writeFileSync(new URL('pwa-maskable-512.png', out), draw(512, { fullBleed: true }));
fs.writeFileSync(new URL('apple-touch-icon.png', out), draw(180, { fullBleed: true }));
fs.writeFileSync(new URL('favicon-64.png', out), draw(64, { fullBleed: false }));
console.log('icons written');
