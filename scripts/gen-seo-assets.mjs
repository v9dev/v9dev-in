import { readFile, mkdir } from 'node:fs/promises';
import { writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import { COLORS, ICONS, OG, SOURCE_LOGO } from './seo-assets.config.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, SOURCE_LOGO);
const PUBLIC = join(ROOT, 'public');

/** Build the inline HTML for one lime-tile icon. White is knocked out
 *  via mix-blend-mode: multiply over a solid lime layer (white*lime=lime,
 *  black*lime=black -> clean black V9 on a lime tile). */
function iconHtml(dataUri, size, maskable) {
  const inner = maskable ? 60 : 78; // % of tile occupied by the mark
  return `<!doctype html><html><head><meta charset="utf-8">
  <style>
    html,body{margin:0;padding:0}
    .tile{width:${size}px;height:${size}px;background:${COLORS.lime};
      display:flex;align-items:center;justify-content:center;overflow:hidden}
    .tile img{width:${inner}%;height:${inner}%;object-fit:contain;
      mix-blend-mode:multiply}
  </style></head>
  <body><div class="tile"><img src="${dataUri}" alt=""></div></body></html>`;
}

async function main() {
  const jpg = await readFile(SRC);
  const dataUri = `data:image/jpeg;base64,${jpg.toString('base64')}`;

  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();

    for (const icon of ICONS) {
      await page.setViewportSize({ width: icon.size, height: icon.size });
      await page.setContent(iconHtml(dataUri, icon.size, icon.maskable), {
        waitUntil: 'load',
      });
      const out = join(PUBLIC, icon.file);
      await mkdir(dirname(out), { recursive: true });
      await page.locator('.tile').screenshot({ path: out });
      console.log(`wrote ${icon.file} (${icon.size}x${icon.size})`);
    }
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
