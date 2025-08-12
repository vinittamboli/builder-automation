// modules/auth.js
const puppeteer = require('puppeteer');

async function loginOrRestoreSession() {
  const browserURL = 'http://127.0.0.1:9222';
  const browser = await puppeteer.connect({
    browserURL,
    protocolTimeout: 120000,   // ⬅️ was default ~30s; give CDP more headroom
  });

  const pages = await browser.pages();
  const page = pages[0] || await browser.newPage();

  // sensible timeouts (don’t overdo; too high hides real bugs)
  page.setDefaultTimeout(45000);
  page.setDefaultNavigationTimeout(60000);

  await page.bringToFront();
  console.log("✅ Attached to manually launched Chrome. Proceeding...");
  return { browser, page };
}

module.exports = { loginOrRestoreSession };
