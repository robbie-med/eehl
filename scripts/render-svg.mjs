// Rasterizes an SVG to PNG with the preinstalled Chromium (dev only).
import { chromium } from '@playwright/test';
import { existsSync, readFileSync } from 'node:fs';
const [, , input, output, size = '512'] = process.argv;
const svg = readFileSync(input, 'utf8');
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || (existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined) });
const page = await browser.newPage({ viewport: { width: +size, height: +size } });
await page.setContent(`<html><body style="margin:0;background:transparent">${svg.replace('<svg ', `<svg width="${size}" height="${size}" `)}</body></html>`);
await page.screenshot({ path: output, omitBackground: true });
await browser.close();
