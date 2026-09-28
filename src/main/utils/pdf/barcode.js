import PDFDocument from 'pdfkit';
import bwipjs from 'bwip-js';

export const generateBarcodePDF = (products, settings = {}) => {
  return new Promise(async (resolve, reject) => {
    try {
      const {
        showPrice = true,
        showName = true,
        showStoreName = false,
        storeName = 'My Store',
        copies = 1,
        paperSize = 'LabelRoll'
      } = settings;

      const allProducts = [];
      products.forEach(p => {
        const count = p.copies || copies;
        for (let i = 0; i < count; i++) {
          allProducts.push(p);
        }
      });

      const mmToPt = 72 / 25.4;
      let pageWidth, pageHeight, margin, startX, startY, cellWidth, cellHeight, cols, rows, colGap, rowGap;

      if (paperSize === 'LabelRoll') {
        cols = 4;
        rows = Math.ceil(allProducts.length / cols);
        pageWidth = 105 * mmToPt;
        cellWidth = 25 * mmToPt;
        cellHeight = 25 * mmToPt;
        colGap = 1 * mmToPt;
        rowGap = 1 * mmToPt;
        const contentWidth = (cols * cellWidth) + ((cols - 1) * colGap);
        startX = (pageWidth - contentWidth) / 2;
        startY = 0;
        margin = 0;
        pageHeight = Math.max(cellHeight, (rows * cellHeight) + ((rows - 1) * rowGap));
      } else {
        cols = 4;
        pageWidth = 595.28; // A4
        pageHeight = 841.89; // A4
        margin = 20;
        cellWidth = (pageWidth - (margin * 2)) / 4;
        cellHeight = 120;
        startX = margin;
        startY = margin;
        colGap = 0;
        rowGap = 0;
        rows = Math.floor((pageHeight - (margin * 2)) / cellHeight);
      }

      console.log(`📏 Barcode PDF Generation - Size: ${(pageWidth / mmToPt).toFixed(1)}mm x ${(pageHeight / mmToPt).toFixed(1)}mm, Labels: ${allProducts.length}`);

      const doc = new PDFDocument({ 
        autoFirstPage: false,
        margin: margin,
        size: [pageWidth, pageHeight]
      });

      const buffers = [];
      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => {
        const pdfData = Buffer.concat(buffers);
        resolve({
          buffer: pdfData,
          height: pageHeight
        });
      });

      // Add the first (and only, for LabelRoll) page
      doc.addPage({
        size: [pageWidth, pageHeight],
        margin: margin
      });

      doc.rect(0, 0, pageWidth, pageHeight).fill('#FFFFFF');
      doc.fillColor('#000000');

      let currentX = startX;
      let currentY = startY;
      let colIndex = 0;
      let rowIndex = 0;

      for (const product of allProducts) {
        // Handle multi-page for A4
        if (colIndex === 0 && paperSize !== 'LabelRoll' && rowIndex >= rows) {
          doc.addPage({ size: [pageWidth, pageHeight], margin: margin });
          doc.rect(0, 0, pageWidth, pageHeight).fill('#FFFFFF');
          doc.fillColor('#000000');
          currentX = startX;
          currentY = startY;
          rowIndex = 0;
        }

        // Draw Cell Border (Optional/Debug)
        if (paperSize === 'A4') {
          doc.lineWidth(0.2).strokeColor('#e0e0e0')
            .rect(currentX, currentY, cellWidth, cellHeight)
            .stroke();
        }

        let contentY = currentY + (paperSize === 'LabelRoll' ? 2 : 10);

        // 1. Store Name
        if (showStoreName) {
          doc.font('Helvetica-Bold').fontSize(paperSize === 'LabelRoll' ? 6 : 8)
            .text(storeName, currentX + 1, contentY, { width: cellWidth - 2, align: 'center', ellipsis: true });
          contentY += (paperSize === 'LabelRoll' ? 7 : 12);
        }

        // 2. Product Name
        if (showName) {
          doc.font('Helvetica').fontSize(paperSize === 'LabelRoll' ? 6 : 8);
          doc.text(product.product_name, currentX + 2, contentY, {
            width: cellWidth - 4,
            height: (paperSize === 'LabelRoll' ? 12 : 22),
            align: 'center',
            ellipsis: true
          });
          contentY += (paperSize === 'LabelRoll' ? 13 : 25);
        }

        // 3. Barcode Image
        const barcodeValue = product.barcode || product.product_code || '000000';
        try {
          const png = await bwipjs.toBuffer({
            bcid: 'code128',
            text: barcodeValue,
            scale: (paperSize === 'LabelRoll' ? 1 : 3),
            height: (paperSize === 'LabelRoll' ? 8 : 10),
            includetext: true,
            textxalign: 'center',
            textmargin: (paperSize === 'LabelRoll' ? 2 : 12),
            font: 'Helvetica',
            fontsize: (paperSize === 'LabelRoll' ? 8 : 10)
          });

          const imgWidth = cellWidth - (paperSize === 'LabelRoll' ? 4 : 20);
          const imgHeight = (paperSize === 'LabelRoll' ? 22 : 45);
          const imgX = currentX + (paperSize === 'LabelRoll' ? 2 : 10);

          doc.image(png, imgX, contentY, { width: imgWidth, height: imgHeight, fit: [imgWidth, imgHeight], align: 'center' });
          contentY += imgHeight + (paperSize === 'LabelRoll' ? 2 : 8);
        } catch (e) {
          doc.font('Helvetica').fontSize(6).text('Error', currentX, contentY, { width: cellWidth, align: 'center' });
          contentY += 10;
        }

        // 4. Price
        if (showPrice) {
          doc.font('Helvetica-Bold').fontSize(paperSize === 'LabelRoll' ? 7 : 10)
            .text(`Rs. ${parseFloat(product.selling_price || 0).toFixed(2)}`, currentX + 1, contentY, { width: cellWidth - 2, align: 'center' });
        }

        // Update coordinates for next label
        colIndex++;
        if (colIndex < cols) {
          currentX += cellWidth + colGap;
        } else {
          colIndex = 0;
          currentX = startX;
          rowIndex++;
          currentY += cellHeight + rowGap;
        }
      }

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
};
