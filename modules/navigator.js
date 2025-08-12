// modules/navigator.js
const { waitRandom } = require('../utils/helpers');

async function navigateToAudit(page, url) {
  console.log("In navigateToAudit with URL:", url);
  const inputSelector = 'input.ux-text-entry-field[placeholder="Enter a domain"]';

  console.log("➡️ Navigating to site audit tool");

  // Wait for input field to appear
  await page.waitForSelector(inputSelector, { timeout: 15000 });

  // Type the domain
  const input = await page.$(inputSelector);
  if (!input) throw new Error("❌ Domain input not found on audit page");
  await input.click({ clickCount: 3 });
  await page.keyboard.type(url);
  console.log("✏️ Typing domain:", url);

  // Prevent new tab opening (just in case)
  await page.evaluate(() => { window.open = () => null; });

  // Click "View Audit Results"
  await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button'));
    const viewButton = buttons.find(b => b.textContent && b.textContent.includes('View Audit Results'));
    if (viewButton) viewButton.click();
  });

  // Wait for the audit table to render
  await page.waitForFunction(() => {
    const table = document.querySelector('.SiteAuditTable .ux-table');
    if (!table) return false;
    const rows = table.querySelectorAll('tr');
    return rows && rows.length > 0;
  }, { timeout: 30000 });

  // Small settle wait
  await new Promise(r => setTimeout(r, 600));

  // Ensure everything is in DOM (scroll to bottom once)
  await page.evaluate(async () => {
    await new Promise(resolve => {
      let total = 0;
      const step = 800;
      const t = setInterval(() => {
        const sh = document.documentElement.scrollHeight || document.body.scrollHeight || 0;
        window.scrollBy(0, step);
        total += step;
        if (total >= sh) { clearInterval(t); resolve(); }
      }, 80);
    });
  });

  // Expand ALL failed sections (robust, multi-pass)
  console.log("✅ Attempting to expand failed sections...");
  const expandedCount = await page.evaluate(async () => {
    const sleep = ms => new Promise(r => setTimeout(r, ms));

    const getFailedRows = () =>
      Array.from(document.querySelectorAll('.SiteAuditTable .ux-table tr'))
        .filter(tr => {
          const status = tr.querySelector('td:nth-child(2) .ux-tag');
          return status && /Failed/i.test(status.textContent || '');
        });

    let totalExpanded = 0;
    for (let pass = 0; pass < 6; pass++) {
      let expandedThisPass = 0;
      const failedRows = getFailedRows();
      for (const row of failedRows) {
        const isExpanded = row.nextElementSibling && row.nextElementSibling.classList &&
                           row.nextElementSibling.classList.contains('SiteAuditTable-row-details');
        if (isExpanded) continue;
        const btn = row.querySelector('button');
        if (btn) { btn.click(); expandedThisPass++; }
      }
      totalExpanded += expandedThisPass;
      if (!expandedThisPass) break;
      await sleep(500); // let details rows attach
    }
    return totalExpanded;
  });

  console.log(`   • Expanded ${expandedCount} failed sections`);
}

module.exports = { navigateToAudit };
