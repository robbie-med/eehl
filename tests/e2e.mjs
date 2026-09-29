// End-to-end smoke test: drives the built app in Chromium through the main
// flows. Run after `npm run build`:  node tests/e2e.mjs
import { chromium } from '@playwright/test';
import { createServer } from 'node:http';
import { existsSync, readFileSync } from 'node:fs';
import { extname, join } from 'node:path';
import assert from 'node:assert/strict';

const root = new URL('../dist/', import.meta.url).pathname;
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };
const server = createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p.endsWith('/')) p += 'index.html';
  const f = join(root, p);
  if (!existsSync(f)) return res.writeHead(404).end();
  res.writeHead(200, { 'content-type': types[extname(f)] ?? 'application/octet-stream' }).end(readFileSync(f));
}).listen(0);
const base = `http://localhost:${server.address().port}/`;

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || (existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined) });
const ctx = await browser.newContext({ viewport: { width: 400, height: 860 }, locale: 'en-US', timezoneId: 'Asia/Seoul', acceptDownloads: true });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));

// Dates relative to today so the test never goes stale: the couple started
// 250 days ago, so "300 days" is 50 days ahead.
const iso = (d) => d.toISOString().slice(0, 10);
const started = iso(new Date(Date.now() - 250 * 86400000));

const step = async (name, fn) => {
  process.stdout.write(`• ${name} … `);
  await fn();
  console.log('ok');
};

try {
  await page.goto(base);
  await page.evaluate(() => localStorage.setItem('eehl:data:v1', JSON.stringify({ version: 1, events: [], lists: [], settings: { locale: 'en' } })));
  await page.reload();

  await step('empty state offers presets', async () => {
    await page.getByText('Nothing counted yet').waitFor();
    assert.equal(await page.locator('.preset-tile').count(), 8);
  });

  await step('create a couple event from the preset', async () => {
    await page.locator('.preset-tile', { hasText: 'Couple' }).click();
    await page.getByRole('textbox', { name: 'Title' }).fill('Us');
    await page.locator('input[type=date]').first().fill(started);
    await page.locator('.topbar .btn.primary').click();
    await page.locator('.hero-title', { hasText: 'Us' }).waitFor();
    const main = await page.locator('.hero-number .big').textContent();
    assert.match(main, /^D\+\d+$/);
  });

  await step('explain sheet lists the rules', async () => {
    await page.locator('.readout-row').first().click();
    await page.getByText('How this was computed').waitFor();
    assert.ok(await page.getByText('Day-one counting').count());
    await page.keyboard.press('Escape');
  });

  await step('refuses to save without a title', async () => {
    await page.goto(base + '#/new/custom');
    await page.locator('.topbar .btn.primary').click();
    await page.getByRole('alert').getByText('Give it a title.').waitFor();
  });

  await step('create a lunar birthday (음력)', async () => {
    await page.goto(base + '#/new/birthday');
    await page.getByRole('textbox', { name: 'Title' }).fill('Mom');
    await page.getByRole('radio', { name: 'Lunar 음력 (Korea)' }).click();
    await page.getByRole('spinbutton', { name: 'Lunar year' }).fill('1966');
    await page.locator('.lunar-row select').nth(0).selectOption('3');
    await page.locator('.lunar-row select').nth(1).selectOption('5');
    await page.getByText('Solar date: Sat, Mar 26, 1966').waitFor();
    await page.locator('.topbar .btn.primary').click();
    await page.locator('.hero-title', { hasText: 'Mom' }).waitFor();
    assert.match(await page.locator('.hero-date').textContent(), /음력 3\/5/);
  });

  await step('home lists both events', async () => {
    await page.goto(base);
    await page.locator('.card').nth(1).waitFor();
    assert.equal(await page.locator('.card').count(), 2);
  });

  await step('tapping the number cycles readouts', async () => {
    const card = page.locator('.card', { hasText: 'Us' });
    const before = await card.locator('.readout-btn .big').textContent();
    await card.locator('.readout-btn').click();
    const after = await card.locator('.readout-btn .big').textContent();
    assert.notEqual(before, after);
  });

  await step('edit keeps the event and changes the title', async () => {
    await page.locator('.card', { hasText: 'Mom' }).click();
    await page.getByLabel('Edit').click();
    await page.getByRole('textbox', { name: 'Title' }).fill("Mom's birthday");
    await page.locator('.topbar .btn.primary').click();
    await page.locator('.hero-title', { hasText: "Mom's birthday" }).waitFor();
  });

  await step('archive from the menu, restore from the archive', async () => {
    await page.goto(base);
    await page.locator('.card', { hasText: 'Us' }).click({ button: 'right' });
    await page.locator('.menu button', { hasText: 'Archive' }).click();
    await page.getByText('Archive (1)').waitFor();
    await page.getByText('Archive (1)').click();
    await page.locator('.card', { hasText: 'Us' }).click({ button: 'right' });
    await page.locator('.menu button', { hasText: 'Unarchive' }).click();
    await page.goto(base);
    assert.equal(await page.locator('.card').count(), 2);
  });

  await step('backup exports and re-imports', async () => {
    await page.goto(base + '#/settings');
    const [download] = await Promise.all([page.waitForEvent('download'), page.getByText('Export backup (.json)').click()]);
    const file = await download.path();
    const backup = JSON.parse(readFileSync(file, 'utf8'));
    assert.equal(backup.app, 'eehl');
    assert.equal(backup.data.events.length, 2);
    await page.evaluate(() => localStorage.setItem('eehl:data:v1', JSON.stringify({ version: 1, events: [], lists: [], settings: { locale: 'en' } })));
    await page.reload();
    const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.getByText('Import backup').click()]);
    await chooser.setFiles(file);
    await page.getByText('Imported 2 events').waitFor();
    await page.goto(base);
    assert.equal(await page.locator('.card').count(), 2);
  });

  await step('upcoming shows milestones', async () => {
    await page.goto(base + '#/upcoming');
    await page.getByRole('radio', { name: '365 days' }).click();
    await page.getByText('300 days', { exact: true }).first().waitFor();
  });

  await step('language switch to Korean', async () => {
    await page.goto(base + '#/settings');
    await page.locator('select').first().selectOption('ko');
    await page.getByText('설정').first().waitFor();
    await page.goto(base);
    await page.getByText('다가오는 날').waitFor();
  });

  assert.deepEqual(errors, [], 'no page errors');
  console.log('\nall e2e checks passed');
} catch (e) {
  console.log('FAILED');
  console.error(e);
  await page.screenshot({ path: 'e2e-failure.png', fullPage: true }).catch(() => {});
  if (errors.length) console.error('page errors:', errors);
  process.exitCode = 1;
} finally {
  await browser.close();
  server.close();
}
