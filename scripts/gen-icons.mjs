// Generates PWA icons from the 일 mark (dev only; outputs are committed).
// Run: npm run gen:icons
import { execFileSync } from 'node:child_process';
import { writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const BRAND = '#d4532b';
const glyph = (stroke = '#fff') => `
  <g fill="none" stroke="${stroke}" stroke-width="36" stroke-linecap="round" stroke-linejoin="round" transform="translate(6 -12)">
    <circle cx="196" cy="168" r="60"/>
    <path d="M346 98v176"/>
    <path d="M160 318h186v52H160v58h190"/>
  </g>`;
const svg = (body) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">${body}</svg>`;

const variants = {
  'mark.svg': svg(`<rect width="512" height="512" rx="112" fill="${BRAND}"/>${glyph()}`),
  any: svg(`<rect width="512" height="512" rx="112" fill="${BRAND}"/>${glyph()}`),
  // Maskable: full bleed, glyph inside the 80% safe zone.
  maskable: svg(`<rect width="512" height="512" fill="${BRAND}"/><g transform="translate(51.2 51.2) scale(0.8)">${glyph()}</g>`),
  apple: svg(`<rect width="512" height="512" fill="${BRAND}"/><g transform="translate(38.4 38.4) scale(0.85)">${glyph()}</g>`),
  badge: svg(glyph('#fff')),
};

const out = new URL('../public/icons/', import.meta.url).pathname;
writeFileSync(join(out, 'mark.svg'), variants['mark.svg'] + '\n');
const tmp = mkdtempSync(join(tmpdir(), 'eehl-icons-'));
const render = (name, file, size) => {
  const src = join(tmp, name + '.svg');
  writeFileSync(src, variants[name]);
  execFileSync('node', [new URL('./render-svg.mjs', import.meta.url).pathname, src, join(out, file), String(size)]);
};
render('any', 'icon-192.png', 192);
render('any', 'icon-512.png', 512);
render('maskable', 'icon-maskable-512.png', 512);
render('maskable', 'icon-maskable-192.png', 192);
render('apple', 'apple-touch-icon.png', 180);
render('badge', 'badge-96.png', 96);
console.log('icons written to public/icons');
