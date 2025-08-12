// modules/scraper.js

// Sections to COUNT (total occurrences, including duplicates)
const COUNT_SECTIONS = [
  'Page has broken internal links',
  'Page has broken external links',
  'Page has broken internal images',
  'Page has broken external images',
  'Page’s images are too large'
];

// Unique-links accessibility excludes “images too large”
const ACCESSIBILITY_SECTIONS = COUNT_SECTIONS.filter(
  s => s !== 'Page’s images are too large'
);

async function scrapeAuditResults(page) {
  console.log('🔍 Scraping audit results (expand ALL failed, count LEFT column only, no per-cell dupes)…');

  const results = await page.evaluate((COUNT_SECTIONS, ACCESSIBILITY_SECTIONS) => {
    const looksLikeUrl = (s) => {
      if (!s || typeof s !== 'string') return false;
      return /^https?:\/\/[^\s<>"')]+$/i.test(s.trim());
    };

    // Resolve section name by matching the known labels within the first cell text
    const resolveSectionName = (firstCellText) => {
      const t = (firstCellText || '').trim();
      for (const name of COUNT_SECTIONS) {
        if (t.includes(name)) return name;
      }
      return null;
    };

    const countsBySection = {}; // total occurrences per section (incl. duplicates across rows)
    const linksMap = {};        // unique links per section (for accessibility)

    const rows = Array.from(document.querySelectorAll('.SiteAuditTable .ux-table tr'));
    for (const row of rows) {
      const firstCell = row.querySelector('td:first-child');
      const statusCell = row.querySelector('td:nth-child(2) .ux-tag');
      if (!firstCell || !statusCell) continue;

      const statusText = (statusCell.textContent || '').trim();
      if (!/Failed/i.test(statusText)) continue;

      const sectionName = resolveSectionName(firstCell.textContent);
      if (!sectionName) continue;
      if (!COUNT_SECTIONS.includes(sectionName)) continue;

      // Details are in the next row
      const detailsRow = row.nextElementSibling;
      if (!detailsRow || !detailsRow.classList || !detailsRow.classList.contains('SiteAuditTable-row-details')) {
        continue; // not expanded
      }

      const detailLines = Array.from(detailsRow.querySelectorAll('.SiteAuditTable-detail-row'));
      let sectionLinks = []; // accumulate (with duplicates across lines)

      for (const line of detailLines) {
        // LEFT column = first direct child <div> of the line
        const directDivs = line.querySelectorAll(':scope > div');
        const leftCell = directDivs[0] || line.firstElementChild;
        if (!leftCell) continue;

        // ---- PER-CELL DEDUPE FIX ----
        // We collect URLs per left cell into a Set, so we don't count the same
        // URL twice if it appears both as an <a> href AND as the anchor's visible text.
        const cellSet = new Set();

        // 1) Add anchor HREFs in LEFT cell
        leftCell.querySelectorAll('a[href]').forEach(a => {
          const href = a.href && a.href.trim();
          if (looksLikeUrl(href)) {
            cellSet.add(href);
          }
        });

        // 2) Add plain-text URLs in LEFT cell (but skip ones already added from anchors)
        const textNodes = [];
        leftCell.querySelectorAll('span, p, code').forEach(n => {
          const t = (n.textContent || '').trim();
          if (t) textNodes.push(t);
        });
        const whole = (leftCell.textContent || '').trim();
        if (whole) textNodes.push(whole);

        const hay = textNodes.join(' ');
        const re = /\bhttps?:\/\/[^\s<>"')]+/gi;
        let m;
        while ((m = re.exec(hay)) !== null) {
          const url = m[0].trim();
          if (looksLikeUrl(url) && !cellSet.has(url)) {
            cellSet.add(url);
          }
        }

        // push this cell's (de-duped) URLs into sectionLinks
        if (cellSet.size) {
          sectionLinks = sectionLinks.concat(Array.from(cellSet));
        }
      }

      // Totals with duplicates (across lines/cells)
      countsBySection[sectionName] = (countsBySection[sectionName] || 0) + sectionLinks.length;

      // Unique per section for accessibility (except images-too-large)
      if (ACCESSIBILITY_SECTIONS.includes(sectionName)) {
        const map = linksMap[sectionName] || {};
        for (const u of sectionLinks) {
          map[u] = (map[u] || 0) + 1;
        }
        linksMap[sectionName] = map;
      }
    }

    return { sectionTotals: countsBySection, linksMap };
  }, COUNT_SECTIONS, ACCESSIBILITY_SECTIONS);

  console.log('✅ Audit issues processed');
  return results;
}

module.exports = { scrapeAuditResults };
