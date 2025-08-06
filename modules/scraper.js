// modules/scraper.js

const TARGET_SECTIONS = [
  'Page has broken internal links',
  'Page has broken external links',
  'Page has broken internal images',
  'Page has broken external images',
  'Page’s images are too large',
  'Page’s images are missing alt text',
  'Pages with duplicate descriptions',
  'Pages with duplicate titles',
  'Page’s description has invalid characters',
  'Page’s description has invalid length', 
  'Page’s title has invalid characters',
  'Page’s title has invalid length',
  'Page is missing a title',
  'Page is missing a description'

];

async function scrapeAuditResults(page) {
  console.log("🔍 Looking for audit issues...");

  const results = await page.evaluate(async (TARGET_SECTIONS) => {
    const linkMap = {};
    const rows = Array.from(document.querySelectorAll('tr'));

    for (const row of rows) {
      const labelCell = row.querySelector('td div span');
      const statusCell = row.querySelector('td:nth-child(2) span');

      if (!labelCell || !statusCell) continue;

      const sectionName = labelCell.textContent.trim();
      const status = statusCell.textContent.trim();

      if (TARGET_SECTIONS.includes(sectionName) && status === 'Failed') {
        console.log(`➡️ Expanding section: ${sectionName}`);
        const button = row.querySelector('button');
        if (button) button.click();

        await new Promise(resolve => setTimeout(resolve, 1000)); // wait for expansion

        const expandedRow = row.nextElementSibling;
        if (expandedRow && expandedRow.querySelectorAll('td').length === 2) {
          const detailCell = expandedRow.querySelector('td:first-child');
          const links = Array.from(detailCell.querySelectorAll('a'));
          for (const a of links) {
            const href = a.href;
            if (!linkMap[sectionName]) linkMap[sectionName] = {};
            linkMap[sectionName][href] = (linkMap[sectionName][href] || 0) + 1;
          }
        }
      }
    }

    return { linksMap: linkMap };
  }, TARGET_SECTIONS);

  console.log("✅ Audit issues processed");
  return results;
}

module.exports = { scrapeAuditResults };
