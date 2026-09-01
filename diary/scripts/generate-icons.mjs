// Generates the placeholder app icons: dark navy square, white tick.
// Pure Node (zlib only) so there is no image dependency to install.
import { deflateSync } from 'node:zlib'
import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'icons')
const NAVY = [11, 18, 32]
const WHITE = [255, 255, 255]

function crc32(buf) {
  let c, table = []
  for (let n = 0; n < 256; n++) {
    c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c >>> 0
  }
  let crc = 0xffffffff
  for (const b of buf) crc = table[(crc ^ b) & 0xff] ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([len, body, crc])
}

function png(size, pixels) {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 2 // colour type: truecolour
  const raw = Buffer.alloc(size * (size * 3 + 1))
  let p = 0
  for (let y = 0; y < size; y++) {
    raw[p++] = 0 // filter: none
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 3
      raw[p++] = pixels[i]
      raw[p++] = pixels[i + 1]
      raw[p++] = pixels[i + 2]
    }
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

// Distance from point to a line segment, for a round-capped stroke.
function distToSegment(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay
  const len2 = dx * dx + dy * dy
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2))
  const cx = ax + t * dx, cy = ay + t * dy
  return Math.hypot(px - cx, py - cy)
}

// `inset` shrinks the tick towards the middle. Android's maskable icons crop
// to a circle, so the maskable variant needs the tick inside the safe zone.
function render(size, inset = 1) {
  const strokes = [
    [0.245, 0.525, 0.42, 0.70],
    [0.42, 0.70, 0.765, 0.315],
  ].map(([ax, ay, bx, by]) => [
    0.5 + (ax - 0.5) * inset,
    0.5 + (ay - 0.5) * inset,
    0.5 + (bx - 0.5) * inset,
    0.5 + (by - 0.5) * inset,
  ])
  const half = 0.055 * size * inset // half the stroke width
  const pixels = Buffer.alloc(size * size * 3)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const px = x + 0.5, py = y + 0.5
      let d = Infinity
      for (const [ax, ay, bx, by] of strokes) {
        d = Math.min(d, distToSegment(px, py, ax * size, ay * size, bx * size, by * size))
      }
      // 1px feather so the tick is not jagged.
      const a = Math.max(0, Math.min(1, half + 0.5 - d))
      const i = (y * size + x) * 3
      for (let c = 0; c < 3; c++) pixels[i + c] = Math.round(NAVY[c] + (WHITE[c] - NAVY[c]) * a)
    }
  }
  return png(size, pixels)
}

mkdirSync(OUT, { recursive: true })
const ICONS = [
  ['icon-192.png', 192, 1],
  ['icon-512.png', 512, 1],
  ['icon-512-maskable.png', 512, 0.62],
  ['apple-touch-icon.png', 180, 1],
]
for (const [name, size, inset] of ICONS) {
  writeFileSync(join(OUT, name), render(size, inset))
  console.log('wrote', name, size)
}
