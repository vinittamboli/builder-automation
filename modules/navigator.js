// modules/navigator.js
const { waitRandom } = require('../utils/helpers');

async function navigateToAudit(page, url) {
  console.log("In navigateToAudit with URL:", url);
  const inputSelector = 'input.ux-text-entry-field[placeholder="Enter a domain"]';

  console.log("➡️ Navigating to site audit tool");

  // Wait for input field to appear
  await page.waitForSelector(inputSelector, { timeout: 5000 });

  // Find and focus input field
  const input = await page.$(inputSelector);
  if (!input) throw new Error("❌ Domain input not found on audit page");

  await input.click({ clickCount: 3 });
  await page.keyboard.type(url);
  console.log("✏️ Typing domain:", url);

  // Prevent new tab opening
  await page.evaluate(() => {
    window.open = () => null;
  });

  // Click "View Audit Results" button
  await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button'));
    const viewButton = buttons.find(b => b.textContent.includes('View Audit Results'));
    if (viewButton) {
      console.log("🖱️ Clicking 'View Audit Results'");
      viewButton.click();
    } else {
      console.error("❌ View Audit Results button not found");
    }
  });

  console.log("⏳ Waiting 10 seconds for audit results to appear...");
  await new Promise(resolve => setTimeout(resolve, 5000));

  // Expand failed sections
  console.log("✅ Attempting to expand failed sections...");
  const rows = await page.$$('tr');
  for (const row of rows) {
    const text = await row.evaluate(el => el.innerText);
    if (text.includes('Details') && text.includes('Failed')) {
      const btn = await row.$('button');
      if (btn) {
        console.log("🔽 Expanding section:", text.split('\n')[0]);
        await btn.evaluate(b => b.scrollIntoView({ behavior: 'smooth' }));
        await waitRandom(500, 1000);
        await btn.click();
        await waitRandom(500, 1200);
      }
    }
  }
}

module.exports = { navigateToAudit };
