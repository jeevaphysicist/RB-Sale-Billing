import PDFDocument from 'pdfkit';
import { truncateString, numberToWords } from './utils.js';

// Generate Non-GST Invoice PDF (A4 format matching HTML template)
export const generateNonGSTInvoicePDF = (invoiceData, config = {}) => {
  return new Promise((resolve, reject) => {
    try {
      const buffers = [];
      const doc = new PDFDocument({ 
        size: 'A4', 
        margin: 0,
        autoFirstPage: false 
      });
      
      doc.addPage({ size: 'A4', margin: 0 });
      
      // Draw white background to prevent black renders in some viewers/printers
      doc.rect(0, 0, 595.28, 841.89).fill('#FFFFFF');
      doc.fillColor('#000000');
      
      // A4 dimensions: 210mm x 297mm = 595.28pt x 841.89pt
      const pageWidth = 595.28;
      const pageHeight = 841.89;
      // REDESIGN: Standardized reduced margins
      const margin = 20; 
      const contentWidth = pageWidth - (margin * 2);
      
      let currentY = margin;
      
      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => {
        const pdfData = Buffer.concat(buffers);
        resolve({ buffer: pdfData });
      });
      
      // Helper function to draw bordered box
      const drawBorderedBox = (x, y, width, height, lineWidth = 0.75) => {
        doc.strokeColor('#000000')
           .lineWidth(lineWidth)
           .rect(x, y, width, height)
           .stroke();
      };
      
      // Helper function to draw grid cell
      const drawGridCell = (x, y, width, height, text, options = {}) => {
        const {
          align = 'left',
          fontSize = 10,
          bold = false,
          bgColor = null,
          border = { top: true, right: true, bottom: true, left: true }
        } = options;
        
        if (bgColor) {
          doc.rect(x, y, width, height).fill(bgColor);
        }
        
        // Draw borders
        doc.strokeColor('#000000').lineWidth(0.75);
        if (border.top) doc.moveTo(x, y).lineTo(x + width, y).stroke();
        if (border.right) doc.moveTo(x + width, y).lineTo(x + width, y + height).stroke();
        if (border.bottom) doc.moveTo(x, y + height).lineTo(x + width, y + height).stroke();
        if (border.left) doc.moveTo(x, y).lineTo(x, y + height).stroke();
        
        // Draw text
        if (text) {
          doc.fillColor('#000000')
             .fontSize(fontSize)
             .font(bold ? 'Helvetica-Bold' : 'Helvetica');
          
          const padding = 5; // Reduced from 8
          const textY = y + (height / 2) - (fontSize / 2); // Center more accurately
          const textWidth = width - (padding * 2);
          
          doc.text(text, x + padding, textY, {
            width: textWidth,
            align: align,
            lineGap: 0
          });
        }
      };
      
      // Template Title
      const titleHeight = 30;
      drawBorderedBox(margin, currentY, contentWidth, titleHeight, 1);
      doc.fillColor('#000000')
         .fontSize(14)
         .font('Helvetica-Bold')
         .text(config.headerText || 'TAX INVOICE (NON-GST)', margin, currentY + 9, {
           width: contentWidth,
           align: 'center'
         });
      currentY += titleHeight;
      
      // Company Header
      const companyDetails = [
        invoiceData.company?.address || '',
        invoiceData.company?.address2 || '',
        invoiceData.company?.city || '',
        invoiceData.company?.district || '',
        invoiceData.company?.fassai_no ? `FSSAI No: ${invoiceData.company.fassai_no}` : '',
        invoiceData.company?.pan ? `PAN: ${invoiceData.company.pan}` : '',
        invoiceData.company?.email ? `E-mail: ${invoiceData.company.email}` : ''
      ].filter(Boolean);

      // Calculate extra height for god name line if present
      const godNameExtraHeight = invoiceData.company?.god_name ? 16 : 0;
      // FIX: Dynamic height
      const requiredHeaderHeight = (companyDetails.length * 13) + 30 + godNameExtraHeight;
      const headerHeight = Math.max(55, requiredHeaderHeight);

      drawBorderedBox(margin, currentY, contentWidth, headerHeight);

      let headerY = currentY + 8;
      // God Name (above store name)
      if (invoiceData.company?.god_name) {
        doc.fillColor('#000000')
           .fontSize(11)
           .font('Helvetica')
           .text(invoiceData.company.god_name, margin + 10, headerY, {
             width: contentWidth - 20,
             align: 'center',
             lineGap: 2
           });
        headerY += 16;
      }
      doc.fillColor('#000000')
         .fontSize(14)
         .font('Helvetica-Bold')
         .text(invoiceData.company?.name || '', margin + 10, headerY, {
           width: contentWidth - 20,
           lineGap: 3
         });

      let detailY = headerY + 20;
      doc.fontSize(10).font('Helvetica');
      companyDetails.forEach((detail, idx) => {
        doc.text(detail, margin + 10, detailY, {
          width: contentWidth - 20,
          lineGap: 2
        });
        detailY += 13;
      });
      
      currentY += headerHeight;
      
      // Invoice Details Grid (same as GST)
      const gridLeftWidth = contentWidth * 0.5;
      const gridRightWidth = contentWidth * 0.5;
      
      const gridHeight = 100;
      
      // Draw a single outer box and then divider lines to avoid overlap
      drawBorderedBox(margin, currentY, contentWidth, gridHeight);
      doc.lineWidth(0.75).moveTo(margin + gridLeftWidth, currentY).lineTo(margin + gridLeftWidth, currentY + gridHeight).stroke();
      
      // Populate Left Box (Bill To)
      const billToX = margin + 10;
      let billToY = currentY + 15;
      
      doc.fontSize(11).font('Helvetica-Bold').text('Bill To:', billToX, billToY);
      billToY += 20;
      
      if (invoiceData.buyer) {
          doc.font('Helvetica-Bold').fontSize(10).text(invoiceData.buyer.name || '', billToX, billToY);
          billToY += 14;
          
          doc.font('Helvetica').fontSize(9);
          if (invoiceData.buyer.address) {
              doc.text(invoiceData.buyer.address, billToX, billToY, { width: gridLeftWidth - 20, lineGap: 3 });
              billToY += doc.heightOfString(invoiceData.buyer.address, { width: gridLeftWidth - 20, lineGap: 3 }) + 6;
          }
          if (invoiceData.buyer.phone) {
              doc.text(`Phone: ${invoiceData.buyer.phone}`, billToX, billToY);
              billToY += 13;
          }
      }
      
      // Right column - Invoice details
      const detailRows = [
        { label: 'Invoice No', value: invoiceData.invoiceNumber || '' },
        { label: 'Dated', value: invoiceData.date || '' }
      ];
      
      const rowHeight = 28;
      detailRows.forEach((row, idx) => {
        const cellY = currentY + (idx * rowHeight);
        // REDESIGN: Adjust label/value ratio within right box
        const labelWidth = gridRightWidth * 0.40;
        const valueWidth = gridRightWidth * 0.60;
        
        drawGridCell(margin + gridLeftWidth, cellY, labelWidth, rowHeight, row.label, {
          fontSize: 9, 
          align: 'left',
          bgColor: '#f9f9f9',
          border: { top: idx === 0, right: true, bottom: idx !== detailRows.length - 1, left: true } // Enable left border
        });
        
        drawGridCell(margin + gridLeftWidth + labelWidth, cellY, valueWidth, rowHeight, row.value, {
          fontSize: 9,
          align: 'left',
          border: { top: idx === 0, right: false, bottom: true, left: true },
          bold: true
        });
      });
      
      currentY += gridHeight;
      
      // Items Table (simpler - no HSN, GST columns)
      const tableStartY = currentY;
      const colWidths = {
        sno: contentWidth * 0.05,
        desc: contentWidth * 0.47,   // Reduced
        qty: contentWidth * 0.12,
        rate: contentWidth * 0.12,
        per: contentWidth * 0.08,
        amount: contentWidth * 0.16
      };
      
      const headers = [
        { text: config.headerSl || 'S.No', width: colWidths.sno },
        { text: config.headerDescription || 'Description of Goods', width: colWidths.desc },
        { text: config.headerQty || 'Quantity', width: colWidths.qty },
        { text: config.headerRate || 'Rate', width: colWidths.rate },
        { text: config.headerPer || 'per', width: colWidths.per },
        { text: config.headerAmount || 'Amount', width: colWidths.amount }
      ];
      
      // Table header moved into drawTableHeaders
      
      const drawTableHeaders = () => {
        let headerX = margin;
        const headerHeight_tbl = 30;
        doc.lineWidth(0.75);
        doc.rect(margin, currentY, contentWidth, headerHeight_tbl)
           .fillAndStroke('#f0f0f0', '#000000');
        
        doc.fillColor('#000000').fontSize(10).font('Helvetica-Bold');
        headers.forEach(header => {
          doc.text(header.text, headerX + 5, currentY + 10, {
            width: header.width - 10,
            align: 'center'
          });
          headerX += header.width;
        });
        currentY += headerHeight_tbl;
      };

      drawTableHeaders();

      // Table Rows
      const items = invoiceData.items || [];
      const rowHeight_tbl = 28;
      items.forEach((item, idx) => {
        // Check for overflow
        if (currentY + rowHeight_tbl > pageHeight - 50) {
          // Draw outer border for the items on the PREVIOUS page before adding new page
          drawBorderedBox(margin, tableStartY, contentWidth, currentY - tableStartY);
          
          doc.addPage({ size: 'A4', margin: 0 });
          doc.rect(0, 0, 595.28, 841.89).fill('#FFFFFF');
          doc.fillColor('#000000');
          currentY = 20;
          drawTableHeaders();
          tableStartY = currentY; // Reset table start for the next page
        }

        let colX = margin;
        const rowY = currentY;
        
        // S.No
        drawGridCell(colX, rowY, colWidths.sno, rowHeight_tbl, (idx + 1).toString(), {
          fontSize: 10,
          align: 'center',
          border: { top: false, right: true, bottom: true, left: true }
        });
        colX += colWidths.sno;
        
        // Description
        const truncatedDesc = truncateString(item.description || '', config.descLimit || 45);
        drawGridCell(colX, rowY, colWidths.desc, rowHeight_tbl, truncatedDesc, {
          fontSize: 10,
          align: 'left',
          border: { top: false, right: true, bottom: true, left: false }
        });
        colX += colWidths.desc;
        
        // Quantity
        drawGridCell(colX, rowY, colWidths.qty, rowHeight_tbl, item.quantity || '', {
          fontSize: 10,
          align: 'center',
          border: { top: false, right: true, bottom: true, left: false }
        });
        colX += colWidths.qty;
        
        // Rate
        drawGridCell(colX, rowY, colWidths.rate, rowHeight_tbl, item.rate || '', {
          fontSize: 10,
          align: 'right',
          border: { top: false, right: true, bottom: true, left: false }
        });
        colX += colWidths.rate;
        
        // per
        drawGridCell(colX, rowY, colWidths.per, rowHeight_tbl, item.per || '', {
          fontSize: 10,
          align: 'center',
          border: { top: false, right: true, bottom: true, left: false }
        });
        colX += colWidths.per;
        
        // Amount
        drawGridCell(colX, rowY, colWidths.amount, rowHeight_tbl, item.amount || '', {
          fontSize: 10,
          align: 'right',
          border: { top: false, right: true, bottom: true, left: false }
        });
        
        currentY += rowHeight_tbl;
      });

      // Check if totals fit on the same page
      // Total row height (28) + Spacing (15) + Total section (60) + PAN/Note (30) + Declaration (100) + Signature (40) + Footer (30) = ~300
      if (currentY + 300 > pageHeight - 50) {
        // Finish borders for current page
        drawBorderedBox(margin, tableStartY, contentWidth, currentY - tableStartY);
        
        doc.addPage({ size: 'A4', margin: 0 });
        doc.rect(0, 0, 595.28, 841.89).fill('#FFFFFF');
        doc.fillColor('#000000');
        currentY = 20;
        drawTableHeaders();
        tableStartY = currentY; 
      }
      
      // Total amount row
      drawGridCell(margin + colWidths.desc + colWidths.qty + colWidths.rate + colWidths.per, currentY, colWidths.amount, rowHeight_tbl, invoiceData.total || '', {
        fontSize: 10,
        align: 'right',
        bold: true,
        border: { top: false, right: false, bottom: true, left: true }
      });
      
      doc.lineWidth(0.75);
      doc.rect(margin, currentY, colWidths.desc + colWidths.qty + colWidths.rate + colWidths.per, rowHeight_tbl)
         .stroke();
      doc.fillColor('#000000').fontSize(10).font('Helvetica-Bold')
         .text('Total', margin + colWidths.desc + colWidths.qty - 60, currentY + 10, {
           width: 50,
           align: 'right'
         });
         
      currentY += rowHeight_tbl;
      
      // Final border for the table part on the last page
      drawBorderedBox(margin, tableStartY, contentWidth, currentY - tableStartY);
      currentY += 15; // Increased spacing before Total Section
      
      // Total Section
      const totalSectionY = currentY;
      const totalSectionHeight = 70;
      drawBorderedBox(margin, currentY, contentWidth, totalSectionHeight);
      
      currentY += 10;
      
      // Amount in words
      const totalAmount = invoiceData.total || 0;
      const amountInWords = invoiceData.amountInWords || 
        (totalAmount ? `${numberToWords(Math.floor(totalAmount))} Rupees Only` : '');
      doc.fontSize(10).font('Helvetica-Bold')
         .text('Amount Chargeable (in words)', margin + 10, currentY + 10, {
           width: contentWidth - 20,
           lineGap: 5
         });
      currentY += 28; // Increased from 15 to 28 for proper spacing
      doc.font('Helvetica')
         .text(amountInWords, margin + 10, currentY, {
           width: contentWidth - 20
         });
      
      // Calculate proper Y position after amount in words text
      // Use the maximum of: current position after text OR position after total section
      const afterAmountY = currentY + 15; // Add padding after amount text
      const afterTotalY = totalSectionY + totalSectionHeight + 2;
      currentY = Math.max(afterAmountY, afterTotalY);

      if (config.showEOE !== false) {
        doc.fontSize(8).font('Helvetica-Bold')
            .text('E. & O. E', margin + contentWidth - 60, currentY + 5, {
              width: 50,
              align: 'right'
            });
        currentY += 15;
      }
      
      // Tax Details
      currentY += 15;
      doc.fontSize(9).font('Helvetica');
      doc.font('Helvetica-Bold').text('PAN: ', margin + 10, currentY);
      doc.font('Helvetica').text(invoiceData.company?.pan || 'AAXXP1791H', margin + 45, currentY);
      currentY += 15;
      doc.font('Helvetica-Bold').text('Note: ', margin + 10, currentY);
      doc.font('Helvetica').text('This invoice is for non-GST applicable products', margin + 45, currentY);
      
      currentY += 25;
      
      // Declaration
      const declarationY = currentY;
      const declarationHeight = 100;
      drawBorderedBox(margin, currentY, contentWidth, declarationHeight);
      
      currentY += 15; // Increased from 10 to 15 for more spacing from border
      doc.fontSize(9).font('Helvetica-Bold')
         .text('Declaration', margin + 10, currentY, {
           width: contentWidth - 20
         });
      currentY += 18; // Increased from 12 to 18 for better spacing
      doc.font('Helvetica')
         .text('We declare that this Invoice shows the actual price of the goods described and that all particulars are true and correct.', 
               margin + 10, currentY, {
                 width: contentWidth - 20,
                 lineGap: 5
               });
      
      // Signature section
      const signatureY = declarationY + declarationHeight - 40;
      const forText = config.authorizedSignatoryFor || `for ${invoiceData.company?.name || 'LUCTUS INDIA'}`;
      
      doc.fontSize(10).font('Helvetica-Bold')
         .text(forText, margin + contentWidth - 120, signatureY, {
           width: 110,
           align: 'right'
         });
      doc.fontSize(10).font('Helvetica')
         .text(config.authorizedSignatoryLabel || 'Authorised Signatory', margin + contentWidth - 120, signatureY + 20, {
           width: 110,
           align: 'right'
         });
      
      currentY = declarationY + declarationHeight + 2;
      
      // Footer
      currentY += 15;
      doc.fontSize(9).font('Helvetica-Oblique')
         .text('This is a Computer Generated Invoice', margin, currentY, {
           width: contentWidth,
           align: 'center'
         });
      
      doc.end();
    } catch (error) {
      reject(error);
    }
  });
};
