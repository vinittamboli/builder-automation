const puppeteer = require('puppeteer');

async function loginOrRestoreSession() {
  const browserURL = 'http://127.0.0.1:9222';
  const browser = await puppeteer.connect({ browserURL });
  const pages = await browser.pages();
  const page = pages[0] || await browser.newPage();
  await page.bringToFront();
  console.log("✅ Attached to manually launched Chrome. Proceeding...");
  return { browser, page };
}

module.exports = { loginOrRestoreSession };