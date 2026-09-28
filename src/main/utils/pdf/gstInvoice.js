import PDFDocument from 'pdfkit';
import { truncateString, numberToWords } from './utils.js';

// Generate GST Invoice PDF (A4 format matching HTML template)
export const generateGSTInvoicePDF = (invoiceData, config = {}) => {
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
      // REDESIGN: Standardized reduced margins (20pt = ~7mm)
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
         .text(config.headerText || 'GST TAX INVOICE', margin, currentY + 9, {
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
        invoiceData.company?.gstin ? `GSTIN: ${invoiceData.company.gstin}` : '',
        invoiceData.company?.fassai_no ? `FSSAI No: ${invoiceData.company.fassai_no}` : '',
        invoiceData.company?.pan ? `PAN: ${invoiceData.company.pan}` : '',
        invoiceData.company?.email ? `E-mail: ${invoiceData.company.email}` : ''
      ].filter(Boolean);

      // Calculate extra height for god name line if present
      const godNameExtraHeight = invoiceData.company?.god_name ? 16 : 0;
      // FIX: Calculate height dynamically BEFORE drawing
      const requiredHeaderHeight = (companyDetails.length * 13) + 30 + godNameExtraHeight;
      const headerHeight = Math.max(60, requiredHeaderHeight);

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

      let detailY = headerY + 20; // Start below name
      doc.fontSize(10).font('Helvetica');
      companyDetails.forEach((detail, idx) => {
        doc.text(detail, margin + 10, detailY, {
          width: contentWidth - 20,
          lineGap: 2
        });
        detailY += 13;
      });
      
      currentY += headerHeight;
      
      // Invoice Details Grid
      // REDESIGN: 50/50 Split for better balance
      const gridLeftWidth = contentWidth * 0.5;
      const gridRightWidth = contentWidth * 0.5;
      
      // Calculate dynamic height for details plus some padding
      const gridHeight = 100;
      
      // Draw a single outer box and then divider lines to avoid overlap
      drawBorderedBox(margin, currentY, contentWidth, gridHeight);
      doc.lineWidth(0.75).moveTo(margin + gridLeftWidth, currentY).lineTo(margin + gridLeftWidth, currentY + gridHeight).stroke();

      // Populate Left Box (Bill To)
      const billToX = margin + 10;
      let billToY = currentY + 15; // Increased padding from top border
      
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
           if (invoiceData.buyer.gstin) {
              doc.text(`GSTIN: ${invoiceData.buyer.gstin}`, billToX, billToY);
              billToY += 13;
          }
      }
      
      // Right column - Invoice details
      const detailRows = [
        { label: 'Invoice No', value: invoiceData.invoiceNumber || '' },
        { label: 'Dated', value: invoiceData.date || '' }
      ];
      
      const rowHeight = 28; // Fixed height for rows
      detailRows.forEach((row, idx) => {
        const cellY = currentY + (idx * rowHeight);
        // REDESIGN: Adjust label/value ratio within right box
        const labelWidth = gridRightWidth * 0.40;
        const valueWidth = gridRightWidth * 0.60;
        
        drawGridCell(margin + gridLeftWidth, cellY, labelWidth, rowHeight, row.label, {
          fontSize: 9, // Slightly smaller for better fit
          align: 'left',
          bgColor: '#f9f9f9',
          border: { top: idx === 0, right: true, bottom: idx !== detailRows.length - 1, left: true } // Enable left border
        });
        
        drawGridCell(margin + gridLeftWidth + labelWidth, cellY, valueWidth, rowHeight, row.value, {
          fontSize: 9,
          align: 'left',
          border: { top: idx === 0, right: false, bottom: true, left: true }, // Always show bottom border for these 2 rows
          bold: true // Make values bold
        });
      });
      
      currentY += gridHeight;

      
      // Items Table
      const tableStartY = currentY;
      // REDESIGN: Refined width percentages to fix wrapping
      const colWidths = {
        sno: contentWidth * 0.05,
        desc: contentWidth * 0.35,   // Reduced slightly
        hsn: contentWidth * 0.11,
        qty: contentWidth * 0.10,
        rate: contentWidth * 0.10,
        per: contentWidth * 0.07,
        gst: contentWidth * 0.07,
        amount: contentWidth * 0.15
      };
      
      const headers = [
        { text: config.headerSl || 'S.No', width: colWidths.sno },
        { text: config.headerDescription || 'Description of Goods', width: colWidths.desc },
        { text: config.headerHsn || 'HSN/SAC', width: colWidths.hsn },
        { text: config.headerQty || 'Quantity', width: colWidths.qty },
        { text: config.headerRate || 'Rate', width: colWidths.rate },
        { text: config.headerPer || 'per', width: colWidths.per },
        { text: config.headerGst || 'GST%', width: colWidths.gst },
        { text: config.headerAmount || 'Amount', width: colWidths.amount }
      ];
      
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
      const rowHeight_tbl = 30;
      items.forEach((item, idx) => {
        // Check for overflow
        if (currentY + rowHeight_tbl > pageHeight - 50) {
          // Draw outer border for the items on the PREVIOUS page before adding new page
          drawBorderedBox(margin, tableStartY, contentWidth, currentY - tableStartY);
          
          doc.addPage({ size: 'A4', margin: 0 });
          doc.rect(0, 0, 595.28, 841.89).fill('#FFFFFF');
          doc.fillColor('#000000');
          currentY = 20; // reset to top margin
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
        const truncatedDesc = truncateString(item.description || '', config.descLimit || 40);
        drawGridCell(colX, rowY, colWidths.desc, rowHeight_tbl, truncatedDesc, {
          fontSize: 10,
          align: 'left',
          border: { top: false, right: true, bottom: true, left: false }
        });
        colX += colWidths.desc;
        
        // HSN/SAC
        drawGridCell(colX, rowY, colWidths.hsn, rowHeight_tbl, item.hsn || '', {
          fontSize: 10,
          align: 'center',
          border: { top: false, right: true, bottom: true, left: false }
        });
        colX += colWidths.hsn;
        
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
        
        // GST%
        drawGridCell(colX, rowY, colWidths.gst, rowHeight_tbl, item.gst || '', {
          fontSize: 10,
          align: 'center',
          border: { top: false, right: true, bottom: true, left: false }
        });
        colX += colWidths.gst;
        
        // Amount
        drawGridCell(colX, rowY, colWidths.amount, rowHeight_tbl, item.amount || '', {
          fontSize: 10,
          align: 'right',
          border: { top: false, right: true, bottom: true, left: false }
        });
        
        currentY += rowHeight_tbl;
      });

      // Check if GST Breakdown fits, otherwise move to new page
      const gstData = invoiceData.gstBreakdown || [];
      const gstTableHeight = (gstData.length + 2) * 30; // 30 is gstRowHeight
      
      if (currentY + gstTableHeight + 20 > pageHeight - 50) {
        // Finish borders for current page
        drawBorderedBox(margin, tableStartY, contentWidth, currentY - tableStartY);
        
        doc.addPage({ size: 'A4', margin: 0 });
        doc.rect(0, 0, 595.28, 841.89).fill('#FFFFFF');
        doc.fillColor('#000000');
        currentY = 20;
        drawTableHeaders();
        tableStartY = currentY; 
      }
      
      // Draw final border for the items table part
      drawBorderedBox(margin, tableStartY, contentWidth, currentY - tableStartY);
      currentY += 10; // Spacing before GST Breakdown
      
      // GST Breakdown Table
      const gstColWidth = contentWidth / 6;
      const gstRowHeight = 30;
      
      // GST Header
      doc.lineWidth(0.75);
      doc.rect(margin, currentY, contentWidth, gstRowHeight)
         .fillAndStroke('#f0f0f0', '#000000');
      
      const gstHeaders = ['HSN/SAC', 'Taxable Value', 'CGST Rate', 'CGST Amount', 'SGST Rate', 'SGST Amount'];
      doc.fillColor('#000000').fontSize(9).font('Helvetica-Bold');
      gstHeaders.forEach((header, idx) => {
        doc.text(header, margin + (idx * gstColWidth) + 5, currentY + 10, {
          width: gstColWidth - 10,
          align: 'center'
        });
      });
      currentY += gstRowHeight;
      
      // GST Data Row
      gstData.forEach(item => {
        let colX = margin;
        const rowY = currentY;
        
        drawGridCell(colX, rowY, gstColWidth, gstRowHeight, item.hsn || '', {
          fontSize: 9,
          align: 'center',
          border: { top: false, right: true, bottom: true, left: false }
        });
        colX += gstColWidth;
        
        drawGridCell(colX, rowY, gstColWidth, gstRowHeight, item.taxableValue || '', {
          fontSize: 9,
          align: 'center',
          border: { top: false, right: true, bottom: true, left: false }
        });
        colX += gstColWidth;
        
        drawGridCell(colX, rowY, gstColWidth, gstRowHeight, item.cgstRate || '', {
          fontSize: 9,
          align: 'center',
          border: { top: false, right: true, bottom: true, left: false }
        });
        colX += gstColWidth;
        
        drawGridCell(colX, rowY, gstColWidth, gstRowHeight, item.cgstAmount || '', {
          fontSize: 9,
          align: 'center',
          border: { top: false, right: true, bottom: true, left: false }
        });
        colX += gstColWidth;
        
        drawGridCell(colX, rowY, gstColWidth, gstRowHeight, item.sgstRate || '', {
          fontSize: 9,
          align: 'center',
          border: { top: false, right: true, bottom: true, left: false }
        });
        colX += gstColWidth;
        
        drawGridCell(colX, rowY, gstColWidth, gstRowHeight, item.sgstAmount || '', {
          fontSize: 9,
          align: 'center',
          border: { top: false, right: false, bottom: true, left: false }
        });
        
        currentY += gstRowHeight;
      });
      
      // GST Total Row
      doc.lineWidth(0.75);
      doc.rect(margin, currentY, contentWidth, gstRowHeight)
         .fillAndStroke('#f9f9f9', '#000000');
      doc.fillColor('#000000').fontSize(9).font('Helvetica-Bold');
      doc.text('Total', margin + 5, currentY + 10, { width: gstColWidth - 10, align: 'center' });
      doc.text(invoiceData.gstTotal?.taxableValue || '', margin + gstColWidth + 5, currentY + 10, { width: gstColWidth - 10, align: 'center' });
      doc.text(invoiceData.gstTotal?.cgstRate || '', margin + (gstColWidth * 2) + 5, currentY + 10, { width: gstColWidth - 10, align: 'center' });
      doc.text(invoiceData.gstTotal?.cgstAmount || '', margin + (gstColWidth * 3) + 5, currentY + 10, { width: gstColWidth - 10, align: 'center' });
      doc.text(invoiceData.gstTotal?.sgstRate || '', margin + (gstColWidth * 4) + 5, currentY + 10, { width: gstColWidth - 10, align: 'center' });
      doc.text(invoiceData.gstTotal?.sgstAmount || '', margin + (gstColWidth * 5) + 5, currentY + 10, { width: gstColWidth - 10, align: 'center' });
      currentY += gstRowHeight + 2;
      
      // Check if Footer sections fit (Totals, Declaration, Signature, Footer message)
      // Approx 80 (total part) + 25 (tax details) + 100 (declaration) + 40 (sign) + 30 (footer) = ~275
      if (currentY + 275 > pageHeight - 50) {
         doc.addPage({ size: 'A4', margin: 0 });
         doc.rect(0, 0, 595.28, 841.89).fill('#FFFFFF');
         doc.fillColor('#000000');
         currentY = 20;
      }
      
      // Total Section
      const totalSectionY = currentY;
      const totalSectionHeight = 80;
      drawBorderedBox(margin, currentY, contentWidth, totalSectionHeight);
      
      doc.fillColor('#000000').fontSize(10);
      const totalAmount = invoiceData.total || 0;
      doc.font('Helvetica-Bold')
         .text(`Total: ${totalAmount}`, margin + contentWidth - 150, currentY + 10, {
           width: 140,
           align: 'right'
         });
      
      currentY += 25;
      
      // Amount in words
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
      doc.font('Helvetica-Bold').text('Company\'s GSTIN: ', margin + 10, currentY);
      doc.font('Helvetica').text(invoiceData.company?.gstin || '', margin + 90, currentY);
      currentY += 15;
      doc.font('Helvetica-Bold').text('Buyer\'s GSTIN: ', margin + 10, currentY);
      doc.font('Helvetica').text(invoiceData.buyer?.gstin || '___________________________', margin + 90, currentY);
      
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
