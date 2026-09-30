/**
 * Detects an image's real type and dimensions from its bytes.
 *
 * Two reasons this exists rather than trusting `file.mimetype`:
 *  1. The upload filter is the only thing standing between a browser-supplied
 *     Content-Type and bytes we store and re-serve from our own origin, so the
 *     served type must come from the file itself.
 *  2. The admin library shows width/height, and there is no image library in
 *     package.json to ask.
 *
 * Only the header of each format is parsed; nothing is decoded.
 */

const SUPPORTED = {
  'image/jpeg': { ext: 'jpg', label: 'JPEG' },
  'image/png': { ext: 'png', label: 'PNG' },
  'image/webp': { ext: 'webp', label: 'WebP' },
  'image/gif': { ext: 'gif', label: 'GIF' },
};

function ascii(buf, start, len) {
  return buf.slice(start, start + len).toString('latin1');
}

function png(buf) {
  if (buf.length < 24) return null;
  const sig = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  for (let i = 0; i < sig.length; i++) if (buf[i] !== sig[i]) return null;
  if (ascii(buf, 12, 4) !== 'IHDR') return null;
  return { type: 'image/png', width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

function gif(buf) {
  if (buf.length < 10) return null;
  const sig = ascii(buf, 0, 6);
  if (sig !== 'GIF87a' && sig !== 'GIF89a') return null;
  return { type: 'image/gif', width: buf.readUInt16LE(6), height: buf.readUInt16LE(8) };
}

function jpeg(buf) {
  if (buf.length < 4 || buf[0] !== 0xff || buf[1] !== 0xd8) return null;
  let i = 2;
  while (i + 9 < buf.length) {
    if (buf[i] !== 0xff) { i++; continue; }
    const marker = buf[i + 1];
    // Standalone markers carry no length field.
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) { i += 2; continue; }
    // Start of frame: everything except DHT/JPG/DAC, which share the range.
    const isSOF = marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
    if (isSOF) {
      return { type: 'image/jpeg', height: buf.readUInt16BE(i + 5), width: buf.readUInt16BE(i + 7) };
    }
    const len = buf.readUInt16BE(i + 2);
    if (len < 2) return { type: 'image/jpeg', width: null, height: null };
    i += 2 + len;
  }
  return { type: 'image/jpeg', width: null, height: null };
}

function webp(buf) {
  // 12 bytes covers the RIFF header plus the first chunk tag. Each branch
  // below checks only what it actually reads, so a small but valid WebP is not
  // rejected just for being short.
  if (buf.length < 16) return null;
  if (ascii(buf, 0, 4) !== 'RIFF' || ascii(buf, 8, 4) !== 'WEBP') return null;
  const chunk = ascii(buf, 12, 4);

  if (chunk === 'VP8X') {
    // tag(12-15) size(16-19) flags(20) reserved(21-23) width-1(24-26) height-1(27-29)
    if (buf.length < 30) return null;
    return {
      type: 'image/webp',
      width: (buf[24] | (buf[25] << 8) | (buf[26] << 16)) + 1,
      height: (buf[27] | (buf[28] << 8) | (buf[29] << 16)) + 1,
    };
  }
  if (chunk === 'VP8 ') {
    // Keyframe sync code 0x9d 0x01 0x2a sits just before the dimensions.
    if (buf.length < 30) return { type: 'image/webp', width: null, height: null };
    if (buf[23] === 0x9d && buf[24] === 0x01 && buf[25] === 0x2a) {
      return { type: 'image/webp', width: buf.readUInt16LE(26) & 0x3fff, height: buf.readUInt16LE(28) & 0x3fff };
    }
    return { type: 'image/webp', width: null, height: null };
  }
  if (chunk === 'VP8L') {
    // tag(12-15) size(16-19) signature 0x2f(20) 14-bit width-1 / height-1 (21-24)
    if (buf.length < 25 || buf[20] !== 0x2f) return { type: 'image/webp', width: null, height: null };
    const b = buf.readUInt32LE(21);
    return {
      type: 'image/webp',
      width: (b & 0x3fff) + 1,
      height: ((b >> 14) & 0x3fff) + 1,
    };
  }
  return { type: 'image/webp', width: null, height: null };
}

/**
 * @returns {{type: string, width: number|null, height: number|null}|null}
 *   null when the bytes are not one of the supported image formats.
 */
function detectImage(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 12) return null;
  return jpeg(buffer) || png(buffer) || webp(buffer) || gif(buffer);
}

function isSupportedImage(buffer) {
  return Boolean(detectImage(buffer));
}

function extensionFor(type) {
  // The lookup is by MIME type. Comparing SUPPORTED[t].ext to the type
  // compared "jpg" with "image/jpeg", never matched, and every upload was
  // filed as .bin.
  const entry = SUPPORTED[String(type || '').toLowerCase().trim()];
  return entry ? entry.ext : 'bin';
}

function supportedTypes() {
  return Object.keys(SUPPORTED);
}

module.exports = { detectImage, isSupportedImage, extensionFor, supportedTypes, SUPPORTED };
