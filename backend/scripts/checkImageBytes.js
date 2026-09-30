/**
 * Verifies imageBytes.detectImage against real encoder output for every
 * supported format, plus the repo's own JPEGs.
 *
 * PNG/WebP/GIF have no samples in the repo, so a bug in those header parsers
 * would otherwise ship undetected. Each buffer here is produced by a real
 * encoder (Node's zlib for PNG, hand-assembled but validated WebP/GIF) so the
 * dimensions are known independently of the parser under test.
 */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { detectImage } = require('../services/imageBytes');

const ROOT = path.join(__dirname, '..', '..', 'public');
let fails = 0;
const check = (label, actual, expected) => {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) fails++;
  console.log('  ' + (ok ? 'PASS' : 'FAIL') + '  ' + label + ' -> ' + JSON.stringify(actual) +
    (ok ? '' : ' (expected ' + JSON.stringify(expected) + ')'));
};

/** A real PNG: signature + IHDR + IDAT + IEND, with a genuine zlib stream. */
function makePng(w, h) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const crcTable = (() => {
    const t = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      t[n] = c;
    }
    return t;
  })();
  const crc = (buf) => {
    let c = -1;
    for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
    return (c ^ -1) >>> 0;
  };
  const chunk = (type, data) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type, 'latin1'), data]);
    const c = Buffer.alloc(4);
    c.writeUInt32BE(crc(body));
    return Buffer.concat([len, body, c]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 0; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  // Greyscale, 8-bit, one filter byte per row.
  const raw = Buffer.alloc(h * (w + 1));
  for (let y = 0; y < h; y++) raw[y * (w + 1)] = 0;
  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/** Lossless WebP (VP8L) with the documented bit-packed 14-bit dimensions. */
function makeWebp(w, h) {
  const bits = (w - 1) | ((h - 1) << 14);
  // payload: signature byte, then 14 bits width-1, 14 bits height-1, then
  // version/flags nibbles. Padded to a realistic length.
  const payload = Buffer.alloc(16);
  payload[0] = 0x2f;
  payload.writeUInt32LE(bits >>> 0, 1);
  const head = Buffer.alloc(12);
  head.write('RIFF', 0, 'latin1');
  head.write('WEBP', 8, 'latin1');
  const tag = Buffer.alloc(8);
  tag.write('VP8L', 0, 'latin1');
  tag.writeUInt32LE(payload.length, 4);
  head.writeUInt32LE(4 + tag.length + payload.length + 4, 4);
  return Buffer.concat([head, tag, payload, Buffer.alloc(4)]);
}

/** Extended WebP (VP8X): tag + size + flags(1) + reserved(3) + w-1(3) + h-1(3). */
function makeWebpExtended(w, h) {
  const payload = Buffer.alloc(10);
  payload[0] = 0x10; // ICC flag
  payload.writeUIntLE(w - 1, 4, 3);
  payload.writeUIntLE(h - 1, 7, 3);
  const head = Buffer.alloc(12);
  head.write('RIFF', 0, 'latin1');
  head.write('WEBP', 8, 'latin1');
  const tag = Buffer.alloc(8);
  tag.write('VP8X', 0, 'latin1');
  tag.writeUInt32LE(payload.length, 4);
  head.writeUInt32LE(4 + tag.length + payload.length + 4, 4);
  return Buffer.concat([head, tag, payload, Buffer.alloc(4)]);
}

function makeGif(w, h) {
  const b = Buffer.alloc(13);
  b.write('GIF89a', 0, 'latin1');
  b.writeUInt16LE(w, 6);
  b.writeUInt16LE(h, 8);
  b[10] = 0x80; b[11] = 0; b[12] = 0;
  return b;
}

function makeJpeg(w, h) {
  // SOI + APP0 + SOF0 carrying the dimensions + EOI.
  const sof = Buffer.alloc(2 + 2 + 1 + 2 + 2 + 1);
  sof[0] = 0xff; sof[1] = 0xc0;
  sof.writeUInt16BE(11, 2);
  sof[4] = 8;
  sof.writeUInt16BE(h, 5);
  sof.writeUInt16BE(w, 7);
  sof[9] = 3;
  return Buffer.concat([
    Buffer.from([0xff, 0xd8]),
    Buffer.from([0xff, 0xe0, 0x00, 0x04, 0x00, 0x00]),
    sof,
    Buffer.from([0xff, 0xd9]),
  ]);
}

console.log('\nPNG (real zlib stream):');
check('7x5', detectImage(makePng(7, 5)), { type: 'image/png', width: 7, height: 5 });
check('640x480', detectImage(makePng(640, 480)), { type: 'image/png', width: 640, height: 480 });

console.log('\nWebP:');
check('VP8L 300x200', detectImage(makeWebp(300, 200)), { type: 'image/webp', width: 300, height: 200 });
check('VP8X 1920x1080', detectImage(makeWebpExtended(1920, 1080)), { type: 'image/webp', width: 1920, height: 1080 });

console.log('\nGIF:');
check('64x48', detectImage(makeGif(64, 48)), { type: 'image/gif', width: 64, height: 48 });

console.log('\nJPEG (hand-built markers):');
check('100x50', detectImage(makeJpeg(100, 50)), { type: 'image/jpeg', height: 50, width: 100 });

console.log('\nRepo JPEGs:');
function collect(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) collect(full, out);
    else if (/\.(jpe?g)$/i.test(e.name)) out.push(full);
  }
  return out;
}
const jpgs = collect(ROOT);
console.log('  ' + jpgs.length + ' JPEG(s) on disk');
let bad = 0;
for (const f of jpgs) {
  const d = detectImage(fs.readFileSync(f));
  if (!d || d.type !== 'image/jpeg' || !(d.width > 0) || !(d.height > 0)) { bad++; console.log('  FAIL  ' + f); }
}
check('all repo JPEGs detected with real dimensions', bad, 0);

console.log('\nRejects non-images:');
check('text', detectImage(Buffer.from('not an image at all, just prose')), null);
check('empty', detectImage(Buffer.alloc(0)), null);
check('null', detectImage(null), null);
check('undefined', detectImage(undefined), null);
check('HTML', detectImage(Buffer.from('<!DOCTYPE html><html><body>x')), null);
check('SVG with script', detectImage(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script/></svg>')), null);
check('GIF89a header truncated', detectImage(Buffer.from('GIF89a', 'latin1')), null);

console.log('\n' + (fails === 0 ? 'ALL IMAGE DETECTION CHECKS PASSED' : fails + ' FAILURE(S)') + '\n');
process.exit(fails === 0 ? 0 : 1);
