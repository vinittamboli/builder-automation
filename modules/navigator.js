// modules/navigator.js
const { waitRandom } = require('../utils/helpers');

/** Bound any page.evaluate to avoid Runtime.callFunctionOn timeouts */
function safeEvaluate(page, fn, arg, timeoutMs = 15000) {
  return Promise.race([
    page.evaluate(fn, arg),
    new Promise((_, rej) => setTimeout(() => rej(new Error('evaluate timeout')), timeoutMs)),
  ]);
}

/** Small helper to re-try a selector wait once or twice on slow UIs */
async function waitForSelectorWithRetry(page, selector, attempts = 2, perTryTimeout = 8000) {
  let lastErr;
  for (let i = 0; i < attempts; i++) {
    try {
      await page.waitForSelector(selector, { timeout: perTryTimeout });
      return;
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr || new Error(`Timeout waiting for selector: ${selector}`);
}

async function navigateToAudit(page, url) {
  console.log("In navigateToAudit with URL:", url);
  const inputSelector = 'input.ux-text-entry-field[placeholder="Enter a domain"]';

  console.log("➡️ Navigating to site audit tool");

  // Wait for input field to appear (with a retry to reduce flakes)
  await waitForSelectorWithRetry(page, inputSelector, 2, 15000);

  // Type the domain
  const input = await page.$(inputSelector);
  if (!input) throw new Error("❌ Domain input not found on audit page");
  await input.click({ clickCount: 3 });
  await page.keyboard.type(url);
  console.log("✏️ Typing domain:", url);

  // Prevent new tab opening (just in case) — bounded evaluate
  await safeEvaluate(page, () => { window.open = () => null; });

  // Click "View Audit Results" — bounded evaluate
  await safeEvaluate(page, () => {
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

  // Ensure everything is in DOM (scroll to bottom once) — bounded evaluate
  await safeEvaluate(page, async () => {
    await new Promise(resolve => {
      let total = 0;
      const step = 800;
      const t = setInterval(() => {
        const sh = (document.documentElement && document.documentElement.scrollHeight) ||
                   (document.body && document.body.scrollHeight) || 0;
        window.scrollBy(0, step);
        total += step;
        if (total >= sh) { clearInterval(t); resolve(); }
      }, 80);
    });
  }, null, 20000);

  // Expand ALL failed sections (robust, multi-pass) — bounded evaluate
  console.log("✅ Attempting to expand failed sections...");
  const expandedCount = await safeEvaluate(page, async () => {
    const sleep = ms => new Promise(r => setTimeout(r, ms));

    const getFailedRows = () =>
      Array.from(document.querySelectorAll('.SiteAuditTable .ux-table tr'))
        .filter(tr => {
          const status = tr.querySelector('td:nth-child(2) .ux-tag');
          return status && /Failed/i.test((status.textContent || '').trim());
        });

    let totalExpanded = 0;
    for (let pass = 0; pass < 6; pass++) {
      let expandedThisPass = 0;
      const failedRows = getFailedRows();
      for (const row of failedRows) {
        const isExpanded = row.nextElementSibling &&
                           row.nextElementSibling.classList &&
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
  }, null, 20000);

  console.log(`   • Expanded ${expandedCount} failed sections`);
}

module.exports = { navigateToAudit };
