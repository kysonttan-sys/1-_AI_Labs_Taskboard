// One-shot script: generates a clean Taskboard logo (no 1%) and writes
// it to public/logo.png, then builds src/app/favicon.ico from it.
// Run with: node scripts/build-taskboard-assets.mjs
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import toIco from 'to-ico';

function crc32(buf) {
  let c;
  const table = [];
  for (let n = 0; n < 256; n++) {
    c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}

// Build a 256x256 RGBA "T" mark: purple rounded square + white "T".
function buildPixels(size, theme) {
  const px = Buffer.alloc(size * size * 4);
  // Brand colors
  const bg = theme === 'light' ? [255, 255, 255, 0] : [10, 10, 15, 0]; // transparent for light theme
  const fill = [124, 58, 237, 255];   // purple
  const t = [255, 255, 255, 255];    // white

  // Rounded square: 16px corner radius
  const r = Math.round(size * 0.22);
  // T shape
  const topY = Math.round(size * 0.30);
  const botY = Math.round(size * 0.78);
  const stemX1 = Math.round(size * 0.42);
  const stemX2 = Math.round(size * 0.58);
  const capX1 = Math.round(size * 0.25);
  const capX2 = Math.round(size * 0.75);
  const capH = Math.round(size * 0.13);
  const stemW = stemX2 - stemX1;

  function inRoundRect(x, y) {
    // Test if (x,y) is in a rounded rectangle covering the full size.
    const dx = Math.max(r - x, x - (size - 1 - r), 0);
    const dy = Math.max(r - y, y - (size - 1 - r), 0);
    return dx * dx + dy * dy <= r * r;
  }

  function inT(x, y) {
    // Top bar of T: rect from (capX1, topY) to (capX2, topY + capH)
    if (y >= topY && y < topY + capH && x >= capX1 && x < capX2) return true;
    // Stem: rect from (stemX1, topY) to (stemX2, botY)
    if (y >= topY && y < botY && x >= stemX1 && x < stemX2) return true;
    return false;
  }

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let rgba;
      if (inT(x, y)) {
        rgba = t;
      } else if (inRoundRect(x, y)) {
        rgba = fill;
      } else {
        rgba = bg;
      }
      const off = (y * size + x) * 4;
      px[off] = rgba[0];
      px[off + 1] = rgba[1];
      px[off + 2] = rgba[2];
      px[off + 3] = rgba[3];
    }
  }
  return px;
}

function encodePNG(pixels, width, height) {
  // PNG signature
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  // IHDR
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;   // bit depth
  ihdr[9] = 6;   // color type RGBA
  ihdr[10] = 0;  // compression
  ihdr[11] = 0;  // filter
  ihdr[12] = 0;  // interlace
  // IDAT: each row prefixed with filter byte 0
  const rowSize = width * 4;
  const raw = Buffer.alloc((rowSize + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (rowSize + 1)] = 0;
    pixels.copy(raw, y * (rowSize + 1) + 1, y * rowSize, (y + 1) * rowSize);
  }
  const compressed = zlib.deflateSync(raw);
  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', compressed),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const root = path.resolve(process.cwd());
const publicDir = path.join(root, 'public');
const appDir = path.join(root, 'src/app');

const sizes = [16, 32, 48, 64, 128, 256];

// Main logo (light/dark-friendly: transparent background, purple T).
const logo256 = encodePNG(buildPixels(256, 'light'), 256, 256);
fs.writeFileSync(path.join(publicDir, 'logo.png'), logo256);
console.log('Wrote public/logo.png (256x256)');

// Build favicon .ico (16, 32, 48).
const faviconSizes = [16, 32, 48];
const pngBuffers = faviconSizes.map((s) => encodePNG(buildPixels(s, 'light'), s, s));
const ico = await toIco(pngBuffers);
fs.writeFileSync(path.join(appDir, 'favicon.ico'), ico);
console.log(`Wrote src/app/favicon.ico (sizes: ${faviconSizes.join(', ')})`);
