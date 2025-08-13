const ExcelJS = require('exceljs');
const path = require('path');

const INPUT_FILE = path.join(__dirname, '../data/sheet.xlsx');

/**
 * Reads the input Excel sheet and returns workbook, sheet and row data.
 */
async function readInputSheet() {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(INPUT_FILE);
  const sheet = workbook.worksheets[0];

  const headers = sheet.getRow(1).values;
  const data = [];

  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return; // Skip header
    const rowData = {};
    row.values.forEach((cell, idx) => {
      if (headers[idx]) rowData[headers[idx]] = cell;
    });

    // Attach actual Excel row reference for update
    rowData._row = row;
    data.push(rowData);
  });

  return { workbook, sheet, data };
}

/**
 * Updates the input Excel sheet for one row:
 * - Column 21 (U) → link count
 * - Column 34 (AH) → Cloudinary screenshot URL
 */
async function updateInputSheet(sheet, rowData, cloudinaryUrl, linkCount) {

  console.log(`Updating row ${rowData._row.number} with link count: ${linkCount}, screenshot URL: ${cloudinaryUrl}`);
  const row = rowData._row;

  row.getCell(6).value = linkCount; 
  console.log(row.getCell(6).value)       // ✅ Column S: Link Count
  row.getCell(7).value = cloudinaryUrl;    // ✅ Column AH: Screenshot URL
  console.log(row.getCell(7).value)       // ✅ Column AH: Screenshot URL
  console.log(`📝 Updated row ${row.number}: Link Count → ${linkCount}, Screenshot URL → ${cloudinaryUrl}`);
}

/**
 * Saves the workbook to the original input file.
 */
async function saveWorkbook(workbook) {
  await workbook.xlsx.writeFile(INPUT_FILE); // Overwrite input file
  console.log(`✅ Saved workbook changes to ${INPUT_FILE}`);
}

module.exports = { readInputSheet, updateInputSheet, saveWorkbook };
