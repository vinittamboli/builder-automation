// modules/screenshot.js
const fs = require('fs');
const path = require('path');

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function waitForHeightStable(page, { poll = 250, steady = 3, timeout = 20000 } = {}) {
  const start = Date.now();
  let last = -1, same = 0;
  while (Date.now() - start < timeout) {
    const h = await page.evaluate(() => {
      const d = document.documentElement, b = document.body || {};
      return Math.max(
        d?.scrollHeight||0, b?.scrollHeight||0,
        d?.offsetHeight||0,  b?.offsetHeight||0,
        d?.clientHeight||0,  b?.clientHeight||0
      );
    });
    if (h === last) { if (++same >= steady) return h; }
    else { same = 0; last = h; }
    await sleep(poll);
  }
  return last;
}

async function takeAuditScreenshot(page, url) {
  const safeName = url.replace(/[^a-zA-Z0-9]/g, '_');
  const filePath = path.join(__dirname, `../screenshots/${safeName}.png`);
  console.log(`📸 Capturing screenshot for: ${url}`);

  // Make sure fonts/layout done and sections expanded height is stable
  await page.evaluate(() => document.fonts && document.fonts.ready).catch(()=>{});
  await waitForHeightStable(page, { poll: 300, steady: 4, timeout: 20000 });

  // High-DPI viewport (does not affect full doc size capture)
  await page.setViewport({ width: 1300, height: 900, deviceScaleFactor: 2 }).catch(()=>{});

  // Unstick fixed/sticky elements to avoid “layered header” artifacts
  await page.evaluate(() => {
    const unstuck = [];
    const all = document.querySelectorAll('*');
    all.forEach(el => {
      const s = getComputedStyle(el);
      if (s && (s.position === 'fixed' || s.position === 'sticky')) {
        unstuck.push([el, el.getAttribute('style')]);
        el.style.position = 'static';
        el.style.top = 'auto';
      }
    });
    // store to restore later
    window.__unstuck = unstuck;
    // avoid smooth scrolling/animations during capture
    const css = document.createElement('style');
    css.id = '__capture_css_patch';
    css.textContent = `
      * { scroll-behavior: auto !important; animation: none !important; transition: none !important; }
      html, body { overflow: visible !important; }
    `;
    document.documentElement.appendChild(css);
  });

  // Use CDP to capture the full content size (no scroll/tiling)
  const client = await page.createCDPSession();
  try {
    const { contentSize } = await client.send('Page.getLayoutMetrics');
    const width  = Math.ceil(contentSize.width  || 0);
    const height = Math.ceil(contentSize.height || 0);

    if (!width || !height) throw new Error('Content size is 0x0');

    const { data } = await client.send('Page.captureScreenshot', {
      format: 'png',
      fromSurface: true,
      captureBeyondViewport: true,
      clip: { x: 0, y: 0, width, height, scale: 1 }
    });

    fs.writeFileSync(filePath, Buffer.from(data, 'base64'));
    console.log(`✅ Screenshot saved to: ${filePath}`);
    return filePath;
  } finally {
    // restore any changed elements
    await page.evaluate(() => {
      try {
        (window.__unstuck || []).forEach(([el, prev]) => {
          if (!el) return;
          if (prev == null) el.removeAttribute('style');
          else el.setAttribute('style', prev);
        });
        const css = document.getElementById('__capture_css_patch');
        if (css) css.remove();
      } catch {}
      delete window.__unstuck;
    }).catch(()=>{});
    await client.detach().catch(()=>{});
  }
}

module.exports = { takeAuditScreenshot };
