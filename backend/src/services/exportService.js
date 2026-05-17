'use strict';

const ExcelJS = require('exceljs');

/**
 * Generates a CSV string from an array of flat objects.
 * Headers are derived from the keys of the first row.
 *
 * @param {object[]} data - Array of flat objects
 * @returns {string} CSV string
 */
function generateCSV(data) {
  if (!Array.isArray(data) || data.length === 0) {
    return '';
  }

  const headers = Object.keys(data[0]);
  const escape = (val) => {
    if (val === null || val === undefined) return '';
    const str = String(val);
    // Quote fields that contain commas, quotes, or newlines
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const lines = [
    headers.map(escape).join(','),
    ...data.map((row) => headers.map((h) => escape(row[h])).join(',')),
  ];

  return lines.join('\n');
}

/**
 * Generates an XLSX buffer from an array of flat objects.
 * Applies styled headers and auto-width columns.
 *
 * @param {object[]} data - Array of flat objects
 * @param {string} [sheetName='Report'] - Worksheet name
 * @returns {Promise<Buffer>} XLSX buffer
 */
async function generateXLSX(data, sheetName = 'Achievement Report') {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'AtomQuest Portal';
  workbook.lastModifiedBy = 'AtomQuest';
  workbook.created = new Date();
  workbook.modified = new Date();

  const worksheet = workbook.addWorksheet(sheetName, {
    pageSetup: {
      paperSize: 9, // A4
      orientation: 'landscape',
      fitToPage: true,
    },
  });

  if (!Array.isArray(data) || data.length === 0) {
    worksheet.addRow(['No data available']);
    return workbook.xlsx.writeBuffer();
  }

  const headers = Object.keys(data[0]);

  // Header row styling
  worksheet.columns = headers.map((header) => ({
    header: header
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase()), // title-case
    key: header,
    width: Math.max(header.length + 4, 14),
  }));

  const headerRow = worksheet.getRow(1);
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF6366F1' }, // indigo
  };
  headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
  headerRow.height = 24;

  // Add data rows
  data.forEach((row, index) => {
    const dataRow = worksheet.addRow(row);
    dataRow.alignment = { vertical: 'middle' };
    // Alternate row coloring
    if (index % 2 === 1) {
      dataRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFF5F3FF' }, // light indigo tint
      };
    }
  });

  // Auto-size columns based on content
  worksheet.columns.forEach((column) => {
    let maxLength = column.header ? column.header.length : 10;
    column.eachCell({ includeEmpty: false }, (cell) => {
      const cellLength = cell.value ? String(cell.value).length : 0;
      if (cellLength > maxLength) maxLength = cellLength;
    });
    column.width = Math.min(maxLength + 4, 50);
  });

  // Freeze header row
  worksheet.views = [{ state: 'frozen', ySplit: 1 }];

  // Auto-filter on headers
  worksheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: headers.length },
  };

  const buffer = await workbook.xlsx.writeBuffer();
  return buffer;
}

/**
 * Streams an XLSX report to an Express response.
 * Sets appropriate Content-Type and Content-Disposition headers.
 *
 * @param {import('express').Response} res
 * @param {object[]} data
 * @param {string} filename - without extension
 */
async function streamXLSXResponse(res, data, filename = 'report') {
  const buffer = await generateXLSX(data, filename);

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}.xlsx"`);
  res.setHeader('Content-Length', buffer.length);
  res.setHeader('Cache-Control', 'no-cache');

  res.end(buffer);
}

/**
 * Streams a CSV report to an Express response.
 *
 * @param {import('express').Response} res
 * @param {object[]} data
 * @param {string} filename - without extension
 */
function streamCSVResponse(res, data, filename = 'report') {
  const csv = generateCSV(data);

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}.csv"`);
  res.setHeader('Cache-Control', 'no-cache');

  // UTF-8 BOM for Excel compatibility
  res.write('\uFEFF');
  res.end(csv);
}

module.exports = { generateCSV, generateXLSX, streamXLSXResponse, streamCSVResponse };
