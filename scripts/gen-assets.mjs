// Generates the Leadexpa brand assets (logo, mark, favicon, PWA icons) from assets/brand/leadexpa-original.png,
// and a short alert tone. Run: node scripts/gen-assets.mjs
import { mkdirSync, writeFileSync } from "node:fs";

import sharp from "sharp";

// --- Brand ----------------------------------------------------------------------------------------
// The original logo sits on a light grid; light, near-grey pixels become transparent (the logo's maroon, bronze
// and gold are all saturated), then the lockup and the mark (its left part) are trimmed out.
const IVORY = "#fbf7f1"; // --c-bg
const { data: raw, info } = await sharp("assets/brand/leadexpa-original.png")
  .ensureAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true });
const px = Buffer.from(raw);
for (let i = 0; i < px.length; i += 4) {
  const max = Math.max(px[i], px[i + 1], px[i + 2]);
  const min = Math.min(px[i], px[i + 1], px[i + 2]);
  const bg = Math.min(1, Math.max(0, 1 - (max - min) / 40) * Math.min(1, Math.max(0, (min - 140) / 50)));
  let a = Math.round(255 * (1 - bg));
  if (a < 24) a = px[i] = px[i + 1] = px[i + 2] = 0;
  px[i + 3] = a;
}
const clean = await sharp(px, { raw: { width: info.width, height: info.height, channels: 4 } })
  .png()
  .toBuffer();
const logo = await sharp(clean).trim({ threshold: 1 }).png().toBuffer();
const mark = await sharp(
  await sharp(clean).extract({ left: 0, top: 0, width: 390, height: info.height }).png().toBuffer(),
)
  .trim({ threshold: 1 })
  .png()
  .toBuffer();

mkdirSync("public/brand", { recursive: true });
const small = { compressionLevel: 9, palette: true, quality: 90 };
await sharp(logo).resize({ width: 720 }).png(small).toFile("public/brand/leadexpa-logo.png");
await sharp(mark).resize({ width: 160 }).png(small).toFile("public/brand/leadexpa-mark.png");

const transparent = { r: 0, g: 0, b: 0, alpha: 0 };
async function icon(size, pad, out, radius) {
  const inner = Math.round(size * (1 - 2 * pad));
  const m = await sharp(mark).resize(inner, inner, { fit: "contain", background: transparent }).png().toBuffer();
  const bg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"><rect width="${size}" height="${size}" rx="${Math.round(size * radius)}" fill="${IVORY}"/></svg>`;
  await sharp(Buffer.from(bg))
    .composite([{ input: m, gravity: "center" }])
    .png({ compressionLevel: 9 })
    .toFile(out);
}
for (const size of [192, 512]) {
  await icon(size, 0.1, `public/icons/icon-${size}.png`, 0.22);
  await icon(size, 0.2, `public/icons/maskable-${size}.png`, 0); // full bleed; the mark stays in the safe zone
}
await icon(180, 0.12, "public/icons/apple-touch-icon.png", 0);
// Favicon: an SVG wrapping a 64 px PNG of the mark (sharp at tab sizes, one request).
const fav = await sharp(mark)
  .resize(64, 64, { fit: "contain", background: transparent })
  .png({ compressionLevel: 9 })
  .toBuffer();
writeFileSync(
  "public/icons/icon.svg",
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><image width="64" height="64" href="data:image/png;base64,${fav.toString("base64")}"/></svg>`,
);

// 0.35 s two-tone chime, 16-bit mono PCM WAV.
const rate = 22050;
const samples = Math.round(rate * 0.35);
const data = Buffer.alloc(samples * 2);
for (let i = 0; i < samples; i++) {
  const t = i / rate;
  const f = t < 0.17 ? 880 : 1175;
  const env = Math.min(1, t * 80) * Math.max(0, 1 - t / 0.35);
  data.writeInt16LE(Math.round(Math.sin(2 * Math.PI * f * t) * env * 0.35 * 32767), i * 2);
}
const header = Buffer.alloc(44);
header.write("RIFF", 0);
header.writeUInt32LE(36 + data.length, 4);
header.write("WAVEfmt ", 8);
header.writeUInt32LE(16, 16);
header.writeUInt16LE(1, 20);
header.writeUInt16LE(1, 22);
header.writeUInt32LE(rate, 24);
header.writeUInt32LE(rate * 2, 28);
header.writeUInt16LE(2, 32);
header.writeUInt16LE(16, 34);
header.write("data", 36);
header.writeUInt32LE(data.length, 40);
writeFileSync("public/sounds/alert.wav", Buffer.concat([header, data]));
console.log("assets written");
