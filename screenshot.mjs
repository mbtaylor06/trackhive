import puppeteer from 'puppeteer';
import { writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const screenshotDir = join(__dirname, 'temporary screenshots');

const url   = process.argv[2] || 'http://localhost:3000';
const label = process.argv[3] || '';

if (!existsSync(screenshotDir)) await mkdir(screenshotDir, { recursive: true });

// Find next available index
let i = 1;
while (existsSync(join(screenshotDir, label ? `screenshot-${i}-${label}.png` : `screenshot-${i}.png`))) i++;
const filename = label ? `screenshot-${i}-${label}.png` : `screenshot-${i}.png`;
const outPath  = join(screenshotDir, filename);

const browser = await puppeteer.launch({
  executablePath: 'C:/Users/matth/.cache/puppeteer/chrome/win64-147.0.7727.56/chrome-win64/chrome.exe',
  args: ['--no-sandbox', '--disable-setuid-sandbox'],
});

const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
await page.screenshot({ path: outPath, fullPage: true });
await browser.close();

console.log(outPath);
