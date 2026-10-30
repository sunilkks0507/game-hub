// Draws the hub PNG icons with plain Node (no dependencies).
//   node scripts/make-icons.mjs
// Output: src/icons/icon-192.png, icon-512.png, maskable-512.png, apple-touch-icon.png

import { writeFileSync, mkdirSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'icons');

const BG = [140, 59, 30]; // #8c3b1e
const FG = [250, 247, 242]; // #faf7f2

// The Ratha (chariot tower) in a 0..1 box: [x0, y0, x1, y1] rectangles.
const GLYPH = [
  [0.12, 0.82, 0.88, 0.92],
  [0.2, 0.7, 0.8, 0.82],
  [0.26, 0.3, 0.74, 0.7],
  [0.18, 0.22, 0.82, 0.3],
  [0.18, 0.08, 0.34, 0.22],
  [0.42, 0.08, 0.58, 0.22],
  [0.66, 0.08, 0.82, 0.22],
];
const DOOR = [0.44, 0.5, 0.56, 0.7];

function crcTable() {
  const table = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table.push(c >>> 0);
  }
  return table;
}
const CRC = crcTable();
function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}
function png(size, rgba) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8; // bit depth
  header[9] = 6; // RGBA
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function inRect(x, y, r) {
  return x >= r[0] && x <= r[2] && y >= r[1] && y <= r[3];
}

// Colour of one point in the unit square.
function colourAt(u, v, { rounded, glyphScale }) {
  if (rounded) {
    const radius = 0.18;
    const cx = Math.min(Math.max(u, radius), 1 - radius);
    const cy = Math.min(Math.max(v, radius), 1 - radius);
    if ((u - cx) ** 2 + (v - cy) ** 2 > radius ** 2) return null; // transparent corner
  }
  const gx = (u - 0.5) / glyphScale + 0.5;
  const gy = (v - 0.5) / glyphScale + 0.5;
  if (GLYPH.some((r) => inRect(gx, gy, r)) && !inRect(gx, gy, DOOR)) return FG;
  return BG;
}

function draw(size, options) {
  const rgba = Buffer.alloc(size * size * 4);
  const samples = 3; // 3x3 supersampling for smooth edges
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let sy = 0; sy < samples; sy++) {
        for (let sx = 0; sx < samples; sx++) {
          const c = colourAt((x + (sx + 0.5) / samples) / size, (y + (sy + 0.5) / samples) / size, options);
          if (c) {
            r += c[0]; g += c[1]; b += c[2]; a += 1;
          }
        }
      }
      const i = (y * size + x) * 4;
      const n = samples * samples;
      if (a > 0) {
        rgba[i] = Math.round(r / a);
        rgba[i + 1] = Math.round(g / a);
        rgba[i + 2] = Math.round(b / a);
      }
      rgba[i + 3] = Math.round((255 * a) / n);
    }
  }
  return rgba;
}

mkdirSync(OUT, { recursive: true });
const icons = [
  ['icon-192.png', 192, { rounded: true, glyphScale: 0.62 }],
  ['icon-512.png', 512, { rounded: true, glyphScale: 0.62 }],
  // Maskable icons are cropped by the phone, so fill the whole square and keep the glyph in the middle 60%.
  ['maskable-512.png', 512, { rounded: false, glyphScale: 0.5 }],
  ['apple-touch-icon.png', 180, { rounded: false, glyphScale: 0.56 }],
];
for (const [name, size, options] of icons) {
  writeFileSync(join(OUT, name), png(size, draw(size, options)));
  console.log('wrote', name);
}
