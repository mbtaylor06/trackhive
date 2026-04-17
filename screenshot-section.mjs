// Takes a viewport (non-fullpage) screenshot at a given Y scroll position
import puppeteer from 'puppeteer';
import { writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const screenshotDir = join(__dirname, 'temporary screenshots');

const url    = process.argv[2] || 'http://localhost:3000';
const label  = process.argv[3] || 'section';
const scrollY = parseInt(process.argv[4] || '0', 10);

if (!existsSync(screenshotDir)) await mkdir(screenshotDir, { recursive: true });

let i = 1;
while (existsSync(join(screenshotDir, `screenshot-${i}-${label}.png`))) i++;
const outPath = join(screenshotDir, `screenshot-${i}-${label}.png`);

const browser = await puppeteer.launch({
  executablePath: 'C:/Users/matth/.cache/puppeteer/chrome/win64-147.0.7727.56/chrome-win64/chrome.exe',
  args: ['--no-sandbox'],
});
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1.5 });
await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
if (scrollY) await page.evaluate(y => window.scrollTo(0, y), scrollY);
await page.screenshot({ path: outPath, fullPage: false });
await browser.close();
console.log(outPath);
