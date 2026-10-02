#!/usr/bin/env node
/**
 * Draws the Fold mark (design/favicon.svg: a Dress Blues sheet with its top-right corner
 * folded down in Apricot Illusion, a linen crease between) into the icon files Tauri needs,
 * with nothing but Node: icon.png, 32x32.png, 128x128.png, 128x128@2x.png, icon.ico and
 * icon.icns. `npx tauri icon` produces a fuller set; this keeps `cargo check`, `tauri dev`
 * and `tauri build` working on a fresh clone without it.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { deflateSync, crc32 as zcrc32 } from "node:zlib";

const out = join(dirname(fileURLToPath(import.meta.url)), "..", "src-tauri", "icons");
mkdirSync(out, { recursive: true });

const NAVY = [0x2a, 0x32, 0x44];
const APRICOT = [0xe2, 0xc4, 0xa6];
const LINEN = [0xf3, 0xee, 0xe7];

/** The favicon's 64-unit geometry: rounded square r=14, fold from (34,0) to (64,30). */
function colourAt(x, y) {
  const r = 14;
  const cx = Math.max(r - x, 0, x - (64 - r));
  const cy = Math.max(r - y, 0, y - (64 - r));
  if (cx * cx + cy * cy > r * r) return null;
  // Distance to the crease segment (34,0)-(64,30), round caps.
  const t = Math.max(0, Math.min(1, ((x - 34) * 30 + y * 30) / 1800));
  const dx = x - (34 + 30 * t);
  const dy = y - 30 * t;
  if (dx * dx + dy * dy < 1.25 * 1.25) return LINEN;
  if (y < x - 34) return APRICOT;
  return NAVY;
}

function raster(size) {
  const ss = 4;
  const px = Buffer.alloc(size * size * 4);
  for (let j = 0; j < size; j++)
    for (let i = 0; i < size; i++) {
      let a = 0;
      let rr = 0;
      let gg = 0;
      let bb = 0;
      for (let sj = 0; sj < ss; sj++)
        for (let si = 0; si < ss; si++) {
          const c = colourAt(
            ((i + (si + 0.5) / ss) * 64) / size,
            ((j + (sj + 0.5) / ss) * 64) / size,
          );
          if (!c) continue;
          a += 1;
          rr += c[0];
          gg += c[1];
          bb += c[2];
        }
      const o = (j * size + i) * 4;
      if (a) {
        px[o] = Math.round(rr / a);
        px[o + 1] = Math.round(gg / a);
        px[o + 2] = Math.round(bb / a);
        px[o + 3] = Math.round((a * 255) / (ss * ss));
      }
    }
  return px;
}

const crc32 = (buf) => {
  if (typeof zcrc32 === "function") return zcrc32(buf) >>> 0;
  let c = 0xffffffff;
  for (const b of buf) {
    c ^= b;
    for (let k = 0; k < 8; k++) c = c & 1 ? (c >>> 1) ^ 0xedb88320 : c >>> 1;
  }
  return (c ^ 0xffffffff) >>> 0;
};

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "latin1"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function png(size) {
  const px = raster(size);
  const rows = Buffer.alloc((size * 4 + 1) * size);
  for (let j = 0; j < size; j++) {
    rows[j * (size * 4 + 1)] = 0;
    px.copy(rows, j * (size * 4 + 1) + 1, j * size * 4, (j + 1) * size * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(rows, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

/** One PNG-compressed 256px entry; every Windows since Vista reads it. */
function ico(p256) {
  const head = Buffer.alloc(22);
  head.writeUInt16LE(0, 0);
  head.writeUInt16LE(1, 2);
  head.writeUInt16LE(1, 4);
  head[6] = 0; // 256 wide
  head[7] = 0; // 256 high
  head[8] = 0;
  head[9] = 0;
  head.writeUInt16LE(1, 10);
  head.writeUInt16LE(32, 12);
  head.writeUInt32LE(p256.length, 14);
  head.writeUInt32LE(22, 18);
  return Buffer.concat([head, p256]);
}

/** ic08 (256) and ic09 (512) PNG entries, the two macOS reads for Dock, Finder and About. */
function icns(entries) {
  const parts = entries.map(([type, data]) => {
    const h = Buffer.alloc(8);
    h.write(type, 0, "latin1");
    h.writeUInt32BE(8 + data.length, 4);
    return Buffer.concat([h, data]);
  });
  const body = Buffer.concat(parts);
  const h = Buffer.alloc(8);
  h.write("icns", 0, "latin1");
  h.writeUInt32BE(8 + body.length, 4);
  return Buffer.concat([h, body]);
}

const p512 = png(512);
const p256 = png(256);
const files = {
  "icon.png": p512,
  "32x32.png": png(32),
  "128x128.png": png(128),
  "128x128@2x.png": p256,
  "icon.ico": ico(p256),
  "icon.icns": icns([
    ["ic08", p256],
    ["ic09", p512],
  ]),
};
for (const [name, data] of Object.entries(files)) {
  writeFileSync(join(out, name), data);
  console.log(`${name}\t${data.length} bytes`);
}
