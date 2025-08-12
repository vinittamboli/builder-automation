// index.js
const { loginOrRestoreSession } = require('./modules/auth');
const { navigateToAudit } = require('./modules/navigator');
const { scrapeAuditResults } = require('./modules/scraper');
const { checkUrlAccessibility } = require('./modules/accessibility');
const { takeAuditScreenshot } = require('./modules/screenshot');
const { uploadToCloudinary } = require('./modules/uploader');
const { readInputSheet, updateInputSheet, saveWorkbook } = require('./modules/spreadsheet');

const TARGET_SECTIONS = new Set([
  'Page has broken internal links',
  'Page has broken external links',
  'Page has broken internal images',
  'Page has broken external images',
  'Page’s images are too large',
]);

const SECTION_SKIP_ACCESSIBILITY = new Set([
  'Page’s images are too large', // skip accessibility for this one
]);

(async () => {
  try {
    const { browser, page } = await loginOrRestoreSession();

    const { workbook, sheet, data } = await readInputSheet();

    let rowIndex = 0;
    for (const rowData of data) {
      rowIndex++;
      try {
        const urlCell = rowData['URL'];
        const domain = typeof urlCell === 'object' ? urlCell.text : urlCell;
        if (!domain || typeof domain !== 'string') continue;

        // 1) Navigate + run
        await page.goto('https://searchenginevisibility.godaddy.com/v2/admin/difysiteaudit', {
          waitUntil: 'networkidle2',
          timeout: 60000,
        });
        await navigateToAudit(page, domain);

        // 2) Scrape
        const { sectionTotals = {}, linksMap = {} } = await scrapeAuditResults(page);

        // 3) Total count across TARGET_SECTIONS
        const totalCount = Object.entries(sectionTotals)
          .filter(([section]) => TARGET_SECTIONS.has(section))
          .reduce((sum, [, n]) => sum + (Number(n) || 0), 0);

        console.log(`Total link count: ${totalCount}`);

        // 4) Accessibility on UNIQUE links only (excluding "images too large")
        // Build a map: section -> [unique hrefs]
        const uniquePerSection = {};
        for (const [section, hrefCounts] of Object.entries(linksMap)) {
          if (!TARGET_SECTIONS.has(section)) continue;
          if (SECTION_SKIP_ACCESSIBILITY.has(section)) continue;
          uniquePerSection[section] = Object.keys(hrefCounts || {});
        }

        // Flatten for checking
        const allUnique = new Set();
        Object.values(uniquePerSection).forEach(arr => arr.forEach(u => allUnique.add(u)));

        let inaccessibleBySection = {};
        if (allUnique.size > 0) {
          const accessibility = await checkUrlAccessibility([...allUnique]);
          // Rebuild per-section, but keep only inaccessible ones
          for (const [section, urls] of Object.entries(uniquePerSection)) {
            const bad = urls.filter(u => accessibility[u] === false);
            if (bad.length) {
              inaccessibleBySection[section] = bad;
            }
          }
        }

        // Only print sections with inaccessible links
        const sectionsWithInaccessible = Object.keys(inaccessibleBySection);
        if (sectionsWithInaccessible.length > 0) {
          for (const sec of sectionsWithInaccessible) {
            console.log(`Inaccessible in "${sec}":`);
            for (const u of inaccessibleBySection[sec]) {
              console.log(`  - ${u}`);
            }
          }
        }

        // 5) Screenshot + upload
        const screenshotPath = await takeAuditScreenshot(page, domain);
        // const imageUrl = await uploadToCloudinary(screenshotPath);

        // 6) Update sheet (U: total count, AH: screenshot URL)
        await updateInputSheet(sheet, rowData, "imageUrl", totalCount);

      } catch (err) {
        console.error(`❌ Error processing domain for row ${rowIndex}:`, err);
      }
    }

    await saveWorkbook(workbook);
    await browser.disconnect();
  } catch (err) {
    console.error('🚨 Fatal error:', err);
  }
})();
