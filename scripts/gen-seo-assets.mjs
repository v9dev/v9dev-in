import { readFile, mkdir, writeFile } from 'node:fs/promises';
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

/** OG card: dark canvas, V9 mark knocked to off-white via invert+screen
 *  (black-on-white source -> light mark on dark), lime accent rule. */
function ogHtml(dataUri) {
  return `<!doctype html><html><head><meta charset="utf-8">
  <style>
    html,body{margin:0;padding:0}
    .card{width:${OG.width}px;height:${OG.height}px;background:${COLORS.canvas};
      box-sizing:border-box;padding:80px;display:flex;flex-direction:column;
      justify-content:space-between;
      font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
      color:${COLORS.text}}
    .label{font:600 24px/1 monospace;letter-spacing:.25em;
      text-transform:uppercase;color:${COLORS.lime}}
    .mark{height:150px;display:flex;align-items:flex-start}
    .mark img{height:100%;filter:invert(1);mix-blend-mode:screen}
    .name{font-size:84px;font-weight:800;margin:0}
    .role{font-size:34px;color:${COLORS.muted};margin:8px 0 0}
    .rule{width:120px;height:4px;background:${COLORS.lime};margin:28px 0}
    .tag{font-size:26px;line-height:1.45;color:${COLORS.muted};
      max-width:920px;margin:0}
  </style></head>
  <body><div class="card">
    <div style="display:flex;justify-content:space-between;align-items:flex-start">
      <span class="label">${OG.label}</span>
      <div class="mark"><img src="${dataUri}" alt=""></div>
    </div>
    <div>
      <p class="name">${OG.name}</p>
      <p class="role">${OG.role}</p>
      <div class="rule"></div>
      <p class="tag">${OG.tagline}</p>
    </div>
  </div></body></html>`;
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
    // OG card -> PNG
    await page.setViewportSize({ width: OG.width, height: OG.height });
    await page.setContent(ogHtml(dataUri), { waitUntil: 'load' });
    const ogPng = join(PUBLIC, OG.png);
    await mkdir(dirname(ogPng), { recursive: true });
    await page.locator('.card').screenshot({ path: ogPng });
    console.log(`wrote ${OG.png} (${OG.width}x${OG.height})`);

    // OG card -> WebP (Chromium canvas; sips has no WebP on this OS)
    const pngB64 = (await readFile(ogPng)).toString('base64');
    const webpBytes = await page.evaluate(async (b64) => {
      const img = new Image();
      img.src = `data:image/png;base64,${b64}`;
      await img.decode();
      const c = document.createElement('canvas');
      c.width = img.naturalWidth;
      c.height = img.naturalHeight;
      c.getContext('2d').drawImage(img, 0, 0);
      const blob = await new Promise((r) =>
        c.toBlob(r, 'image/webp', 0.9),
      );
      if (!blob) throw new Error('toBlob returned null (webp encode failed)');
      const buf = await blob.arrayBuffer();
      return Array.from(new Uint8Array(buf));
    }, pngB64);
    await writeFile(join(PUBLIC, OG.webp), Buffer.from(webpBytes));
    console.log(`wrote ${OG.webp} (webp ${webpBytes.length} bytes)`);
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
