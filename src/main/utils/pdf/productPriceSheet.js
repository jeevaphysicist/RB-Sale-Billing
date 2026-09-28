import PDFDocument from 'pdfkit';

const PAGE_MARGIN = 36;
const HEADER_ROW_HEIGHT = 22;
const DATA_ROW_MIN_HEIGHT = 16;
const FOOTER_RESERVED = 40;

/**
 * @param {Object} payload
 * @param {Array<Object>} payload.rows - Pre-formatted row objects (human-readable values)
 * @param {Object} payload.store - Store settings from database
 * @param {string} payload.title
 * @param {string} payload.generatedAt
 * @param {string[]} payload.columnKeys - Column header keys in display order
 */
export const generateProductPriceSheetPDF = (payload) => {
  return new Promise((resolve, reject) => {
    try {
      const { rows = [], store = {}, title = 'Product Price List', generatedAt = '', columnKeys = [] } = payload;

      const buffers = [];
      const doc = new PDFDocument({
        autoFirstPage: false,
        size: 'A4',
        layout: 'landscape',
        margin: PAGE_MARGIN
      });

      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', reject);

      const pageWidth = doc.page.width;
      const pageHeight = doc.page.height;
      const contentWidth = pageWidth - PAGE_MARGIN * 2;

      const keys = columnKeys.length > 0
        ? columnKeys
        : (rows[0] ? Object.keys(rows[0]) : []);

      const colWeights = keys.map((key) => {
        const k = key.toLowerCase();
        if (k.includes('name')) return 2.2;
        if (k.includes('category') || k.includes('brand')) return 1.2;
        if (k.includes('code') || k.includes('barcode') || k.includes('hsn')) return 1.1;
        if (k.includes('price') || k.includes('mrp')) return 1;
        if (k.includes('s.no') || k === 'sno' || k.includes('s no')) return 0.45;
        return 0.85;
      });
      const weightSum = colWeights.reduce((a, b) => a + b, 0);
      const colWidths = colWeights.map((w) => (contentWidth * w) / weightSum);

      const drawPageHeader = () => {
        doc.addPage({ size: 'A4', layout: 'landscape', margin: PAGE_MARGIN });
        let y = PAGE_MARGIN;

        doc.font('Helvetica-Bold').fontSize(16).text(store.store_name || 'Store', PAGE_MARGIN, y, {
          width: contentWidth,
          align: 'center'
        });
        y += 22;

        const address = [
          store.address_line1,
          store.address_line2,
          [store.city, store.district].filter(Boolean).join(', '),
          [store.state, store.pincode].filter(Boolean).join(' - ')
        ].filter(Boolean).join(', ');

        if (address) {
          doc.font('Helvetica').fontSize(9).text(address, PAGE_MARGIN, y, {
            width: contentWidth,
            align: 'center'
          });
          y += 14;
        }

        const contactParts = [];
        if (store.phone) contactParts.push(`Phone: ${store.phone}`);
        if (store.email) contactParts.push(`Email: ${store.email}`);
        if (store.gstin) contactParts.push(`GSTIN: ${store.gstin}`);

        if (contactParts.length) {
          doc.fontSize(8).text(contactParts.join('  |  '), PAGE_MARGIN, y, {
            width: contentWidth,
            align: 'center'
          });
          y += 14;
        }

        doc.moveTo(PAGE_MARGIN, y).lineTo(pageWidth - PAGE_MARGIN, y).strokeColor('#cccccc').stroke();
        y += 12;

        doc.font('Helvetica-Bold').fontSize(13).text(title, PAGE_MARGIN, y);
        y += 18;

        doc.font('Helvetica').fontSize(8).fillColor('#555555').text(`Generated: ${generatedAt}`, PAGE_MARGIN, y);
        doc.fillColor('#000000');
        y += 16;

        return y;
      };

      let tableTopY = drawPageHeader();

      const drawTableHeader = (startY) => {
        let x = PAGE_MARGIN;
        doc.font('Helvetica-Bold').fontSize(7).fillColor('#ffffff');
        doc.rect(PAGE_MARGIN, startY, contentWidth, HEADER_ROW_HEIGHT).fill('#2563eb');

        keys.forEach((key, i) => {
          doc.fillColor('#ffffff').text(String(key), x + 3, startY + 6, {
            width: colWidths[i] - 6,
            align: i === 0 ? 'center' : 'left',
            ellipsis: true
          });
          x += colWidths[i];
        });

        doc.fillColor('#000000');
        return startY + HEADER_ROW_HEIGHT;
      };

      let currentY = drawTableHeader(tableTopY);
      const bottomLimit = pageHeight - PAGE_MARGIN - FOOTER_RESERVED;

      rows.forEach((row, rowIndex) => {
        let x = PAGE_MARGIN;
        let maxCellHeight = DATA_ROW_MIN_HEIGHT;

        keys.forEach((key, i) => {
          const cellText = row[key] != null ? String(row[key]) : '—';
          const cellHeight = doc.heightOfString(cellText, {
            width: colWidths[i] - 6,
            align: 'left'
          });
          maxCellHeight = Math.max(maxCellHeight, cellHeight + 8);
        });

        if (currentY + maxCellHeight > bottomLimit) {
          tableTopY = drawPageHeader();
          currentY = drawTableHeader(tableTopY);
        }

        const fill = rowIndex % 2 === 0 ? '#f8fafc' : '#ffffff';
        doc.rect(PAGE_MARGIN, currentY, contentWidth, maxCellHeight).fill(fill);

        x = PAGE_MARGIN;
        doc.font('Helvetica').fontSize(7).fillColor('#111827');

        keys.forEach((key, i) => {
          const cellText = row[key] != null ? String(row[key]) : '—';
          doc.text(cellText, x + 3, currentY + 4, {
            width: colWidths[i] - 6,
            align: i === 0 ? 'center' : 'left'
          });
          x += colWidths[i];
        });

        doc.fillColor('#000000');
        currentY += maxCellHeight;
      });

      const footerY = pageHeight - PAGE_MARGIN - 20;
      doc.font('Helvetica').fontSize(7).fillColor('#666666').text(
        `Total products: ${rows.length}`,
        PAGE_MARGIN,
        footerY,
        { width: contentWidth, align: 'center' }
      );

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
};
