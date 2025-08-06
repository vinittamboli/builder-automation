const path = require('path');

async function takeAuditScreenshot(page, url) {
  const safeName = url.replace(/[^a-zA-Z0-9]/g, '_');
  const filePath = path.join(__dirname, `../screenshots/${safeName}.png`);
  console.log(`📸 Capturing screenshot for: ${url}`);

  // 🔍 Set device scale factor for high resolution
  await page.emulateMediaFeatures([
    { name: 'prefers-color-scheme', value: 'light' }
  ]);

  await page.setViewport({
    width: 1280,
    height: 800,
    deviceScaleFactor: 2 // Retina-like resolution
  });

  // 📜 Auto-scroll to ensure lazy-loaded content loads
  await page.evaluate(async () => {
    await new Promise(resolve => {
      let totalHeight = 0;
      const distance = 800;
      const timer = setInterval(() => {
        const scrollHeight = document.body.scrollHeight;
        window.scrollBy(0, distance);
        totalHeight += distance;

        if (totalHeight >= scrollHeight - window.innerHeight) {
          clearInterval(timer);
          resolve();
        }
      }, 100);
    });
  });

  // 🖼 Take full page screenshot
  await page.screenshot({ path: filePath, fullPage: true });
  console.log(`✅ Screenshot saved to: ${filePath}`);
  return filePath;
}

module.exports = { takeAuditScreenshot };
