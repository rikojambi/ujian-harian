import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = resolve(root, 'public', 'icons');

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([length, body, crc]);
}

function encodePng(width, height, rgba) {
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y += 1) {
    const rowStart = y * (stride + 1);
    raw[rowStart] = 0;
    for (let x = 0; x < width; x += 1) {
      const src = (y * width + x) * 4;
      const dst = rowStart + 1 + x * 4;
      raw[dst] = rgba[src];
      raw[dst + 1] = rgba[src + 1];
      raw[dst + 2] = rgba[src + 2];
      raw[dst + 3] = rgba[src + 3];
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0))
  ]);
}

function insideRoundedRect(x, y, w, h, radius) {
  const cx = Math.min(Math.max(x, radius), w - radius);
  const cy = Math.min(Math.max(y, radius), h - radius);
  const dx = x - cx;
  const dy = y - cy;
  return dx * dx + dy * dy <= radius * radius;
}

function renderIcon(size, maskable) {
  const px = Buffer.alloc(size * size * 4, 0);
  const set = (x, y, [r, g, b, a = 255]) => {
    if (x < 0 || y < 0 || x >= size || y >= size) return;
    const i = (y * size + x) * 4;
    if (a === 255) {
      px[i] = r; px[i + 1] = g; px[i + 2] = b; px[i + 3] = 255;
    } else {
      const na = a / 255;
      px[i] = Math.round(px[i] * (1 - na) + r * na);
      px[i + 1] = Math.round(px[i + 1] * (1 - na) + g * na);
      px[i + 2] = Math.round(px[i + 2] * (1 - na) + b * na);
      px[i + 3] = Math.max(px[i + 3], a);
    }
  };

  const navy = [15, 37, 71];
  const white = [255, 255, 255];
  const accent = [14, 165, 233];
  const pad = maskable ? Math.round(size * 0.18) : 0;
  const radius = maskable ? size : Math.round(size * 0.22);

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      if (insideRoundedRect(x, y, size, size, radius)) set(x, y, [...navy, 255]);
    }
  }

  const left = Math.round(size * (maskable ? 0.30 : 0.25));
  const right = Math.round(size * (maskable ? 0.70 : 0.75));
  const top = Math.round(size * (maskable ? 0.32 : 0.28));
  const bottom = Math.round(size * (maskable ? 0.68 : 0.72));
  const stroke = Math.max(2, Math.round(size * 0.085));

  // Huruf U: dua batang vertikal dan dasar melengkung sederhana.
  const arcCx = (left + right) / 2;
  const arcCy = bottom - (right - left) / 2;
  const outerR = (right - left) / 2;
  const innerR = outerR - stroke;
  for (let y = top; y <= bottom; y += 1) {
    for (let x = left; x <= right; x += 1) {
      const vertical = y <= arcCy && ((x >= left && x < left + stroke) || (x > right - stroke && x <= right));
      const dist = Math.hypot(x - arcCx, y - arcCy);
      const arc = y >= arcCy && dist <= outerR && dist >= innerR;
      if (vertical || arc) set(x, y, [...white, 255]);
    }
  }

  // Garis aksen di bagian atas melambangkan "harian".
  const barW = Math.round(size * (maskable ? 0.18 : 0.24));
  const barH = Math.max(2, Math.round(size * 0.035));
  const barX = Math.round(size / 2 - barW / 2);
  const barY = Math.round(size * (maskable ? 0.24 : 0.18));
  for (let y = barY; y < barY + barH; y += 1) {
    for (let x = barX; x < barX + barW; x += 1) set(x, y, [...accent, 255]);
  }

  if (pad > 0) {
    // Pastikan area aman maskable tetap berada di dalam background.
    for (let y = 0; y < size; y += 1) {
      for (let x = 0; x < size; x += 1) {
        if (x < pad || y < pad || x >= size - pad || y >= size - pad) {
          const i = (y * size + x) * 4;
          if (insideRoundedRect(x, y, size, size, radius)) {
            px[i] = navy[0]; px[i + 1] = navy[1]; px[i + 2] = navy[2]; px[i + 3] = 255;
          }
        }
      }
    }
  }

  return encodePng(size, size, px);
}

mkdirSync(outDir, { recursive: true });
const targets = [
  ['icon-192.png', 192, false],
  ['icon-512.png', 512, false],
  ['icon-maskable-192.png', 192, true],
  ['icon-maskable-512.png', 512, true]
];
for (const [name, size, maskable] of targets) {
  writeFileSync(resolve(outDir, name), renderIcon(size, maskable));
  console.log(`Dibuat ${name} (${size}x${size})`);
}
