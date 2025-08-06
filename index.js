const path = require('path');
const { loginOrRestoreSession } = require('./modules/auth');
const { navigateToAudit } = require('./modules/navigator');
const { scrapeAuditResults } = require('./modules/scraper');
const { checkUrlAccessibility } = require('./modules/accessibility');
const { takeAuditScreenshot } = require('./modules/screenshot');
const { uploadToCloudinary } = require('./modules/uploader');
const { readInputSheet, updateInputSheet, saveWorkbook } = require('./modules/spreadsheet');

(async () => {
  try {
    console.log('🚀 Starting audit automation...');

    const { browser, page } = await loginOrRestoreSession();

    console.log('📖 Reading input sheet...');
    const { workbook, sheet, data } = await readInputSheet();
    console.log(`📄 ${data.length} records found in sheet`);

    for (const rowData of data) {
      try {
        const urlCell = rowData['URL'];
        const domain = typeof urlCell === 'object' ? urlCell.text : urlCell;
        if (!domain || typeof domain !== 'string') {
          console.warn('⚠️ Skipping row due to invalid or missing domain:', rowData);
          continue;
        }

        console.log(`\n🌐 Auditing domain: ${domain}`);

        // Step 1: Navigate and trigger audit
        await page.goto('https://searchenginevisibility.godaddy.com/v2/admin/difysiteaudit', {
          waitUntil: 'networkidle2',
          timeout: 60000
        });
        await navigateToAudit(page, domain);

        // Step 2: Scrape audit results
        console.log('🔍 Scraping audit results...');
        const { linksMap } = await scrapeAuditResults(page);

        // Step 3: Flatten & deduplicate links
        const allLinks = new Set();
        for (const section in linksMap) {
          for (const link in linksMap[section]) {
            allLinks.add(link);
          }
        }
        console.log(`🔗 ${allLinks.size} unique links found`);

        // Step 4: Check accessibility
        console.log('🌐 Checking accessibility of links...');
        const accessibility = await checkUrlAccessibility([...allLinks]);

        // Step 5: Count inaccessible links
        let inaccessibleCount = 0;
        for (const link of allLinks) {
          if (!accessibility[link]) inaccessibleCount++;
        }
        console.log(`❌ Inaccessible links: ${inaccessibleCount}`);

        // Step 6: Take screenshot
        const screenshotPath = await takeAuditScreenshot(page, domain);

        // Step 7: Upload to Cloudinary
        console.log('☁️ Uploading screenshot...');
        // const imageUrl = await uploadToCloudinary(screenshotPath);
        // console.log(`📎 Uploaded: ${imageUrl}`);

        // Step 8: Update spreadsheet
        await updateInputSheet(sheet, rowData, "Test", inaccessibleCount);
        console.log('📊 Sheet updated');

      } catch (err) {
        console.error(`❌ Error processing domain ${rowData['URL']}:`, err);
      }
    }

    // Final step: Save workbook
    await saveWorkbook(workbook);
    console.log('\n✅ All records processed and input file updated.');
    await browser.disconnect();

  } catch (err) {
    console.error('🚨 Fatal error:', err);
  }
})();
