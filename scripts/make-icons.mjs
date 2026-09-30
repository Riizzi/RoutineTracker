// Gera o ícone (adaptativo + legado) e a splash a partir de um SVG. Uso: node scripts/make-icons.mjs
import sharp from 'sharp';
import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const RES = 'android/app/src/main/res';
const TERRACOTA = '#BC5A42';
const CREME = '#FAF7F2';

// Desenho do pin numa grade 108x108 (zona segura do ícone adaptativo: círculo central de 66).
const pin = `
  <ellipse cx="54" cy="77" rx="21" ry="6.5" fill="none" stroke="${CREME}" stroke-width="2.6" stroke-dasharray="4 3" opacity="0.85"/>
  <path d="M54 76 C54 76 38.5 59 38.5 46.5 A15.5 15.5 0 1 1 69.5 46.5 C69.5 59 54 76 54 76 Z" fill="${CREME}"/>
  <circle cx="54" cy="46.5" r="6.2" fill="${TERRACOTA}"/>`;

const fundo = (extra = '') => `<rect width="108" height="108" fill="${TERRACOTA}" ${extra}/>`;
const svg = (body, clip = '') =>
  Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 108 108">${clip}${body}</svg>`);

const foreground = svg(pin);
const legado = svg(`<g clip-path="url(#m)">${fundo()}${pin}</g>`, `<defs><clipPath id="m"><rect width="108" height="108" rx="24"/></clipPath></defs>`);
const redondo = svg(`<g clip-path="url(#m)">${fundo()}${pin}</g>`, `<defs><clipPath id="m"><circle cx="54" cy="54" r="54"/></clipPath></defs>`);

const dens = { mdpi: [48, 108], hdpi: [72, 162], xhdpi: [96, 216], xxhdpi: [144, 324], xxxhdpi: [192, 432] };
for (const [d, [legacy, adaptive]] of Object.entries(dens)) {
  const dir = join(RES, `mipmap-${d}`);
  await sharp(legado, { density: 384 }).resize(legacy, legacy).png().toFile(join(dir, 'ic_launcher.png'));
  await sharp(redondo, { density: 384 }).resize(legacy, legacy).png().toFile(join(dir, 'ic_launcher_round.png'));
  await sharp(foreground, { density: 384 }).resize(adaptive, adaptive).png().toFile(join(dir, 'ic_launcher_foreground.png'));
}

// Splash: fundo creme + ícone centralizado, mantendo as dimensões de cada arquivo existente.
const icone = await sharp(legado, { density: 384 }).resize(512, 512).png().toBuffer();
const splashes = [];
for (const dir of readdirSync(RES)) {
  if (!dir.startsWith('drawable') && !dir.startsWith('drawable-')) continue;
  const f = join(RES, dir, 'splash.png');
  try { statSync(f); splashes.push(f); } catch { /* sem splash nesta pasta */ }
}
for (const f of splashes) {
  const { width, height } = await sharp(f).metadata();
  const lado = Math.round(Math.min(width, height) * 0.22);
  const ic = await sharp(icone).resize(lado, lado).png().toBuffer();
  await sharp({ create: { width, height, channels: 3, background: CREME } })
    .composite([{ input: ic, gravity: 'center' }])
    .png()
    .toFile(f + '.tmp');
  await sharp(f + '.tmp').toFile(f);
  (await import('node:fs')).unlinkSync(f + '.tmp');
}
console.log(`ok: ${Object.keys(dens).length} densidades, ${splashes.length} splashes`);
