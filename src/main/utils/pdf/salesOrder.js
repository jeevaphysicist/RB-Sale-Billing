import PDFDocument from 'pdfkit';
import { translations, TAMIL_FONTS, mapOrderToInvoiceData, truncateString } from './utils.js';
import { generateGSTInvoicePDF } from './gstInvoice.js';
import { generateNonGSTInvoicePDF } from './nonGstInvoice.js';

export const generateSalesOrderPDF = (orderData, templateType = 'A4', config = {}) => {
  return new Promise(async (resolve, reject) => {
    try {
      const buffers = [];
      let doc;

      const language = config.invoiceLanguage || 'en';
      const t = translations[language] || translations.en;

      // Default config values
      const safeConfig = {
        fontFamily: 'Helvetica',
        showTax: true,
        showDiscount: true,
        showGst: true,
        showHsn: false,
        showOutstanding: false,
        headerText: t.taxInvoice,
        footerText: t.thankYou,
        margins: { top: 20, right: 20, bottom: 20, left: 20 },
        ...config
      };

      // Select fonts based on language
      let font, fontBold;
      if (language === 'ta') {
        // Use Tamil fonts for Tamil language
        const selectedFont = safeConfig.fontFamily || 'NotoSansTamil';
        if (selectedFont === 'MuktaMalar') {
          font = 'MuktaMalar';
          fontBold = 'MuktaMalarBold';
        } else {
          font = 'NotoSansTamil';
          fontBold = 'NotoSansTamilBold';
        }
      } else {
        // Use standard fonts for English - only accept valid English fonts
        const validEnglishFonts = ['Helvetica', 'Courier', 'Times-Roman'];
        const selectedFont = safeConfig.fontFamily;
        
        if (validEnglishFonts.includes(selectedFont)) {
          font = selectedFont;
          fontBold = selectedFont === 'Courier' ? 'Courier-Bold' : 
                     selectedFont === 'Times-Roman' ? 'Times-Bold' : 
                     'Helvetica-Bold';
        } else {
          // Default to Helvetica if invalid font (like MuktaMalar from Tamil)
          font = 'Helvetica';
          fontBold = 'Helvetica-Bold';
        }
      }

      // Define page size and margins based on template type
      let options = {};
      if (templateType === 'A4') {
        options = { size: 'A4', margin: 20 };
      } else if (templateType === '80mm' || templateType === '72mm' || templateType === '50mm') {
        // Calculate required height dynamically
        const height = calculateThermalHeight(orderData, templateType, safeConfig, language);
        const width = templateType === '80mm' ? 226 : templateType === '72mm' ? 204 : 164;
        // Minimal margins for thermal printers to reduce paper waste
        const margin = 2; // Very small margin - 2 points (~0.7mm)
        // Add small buffer
        options = { size: [width, height], margin: margin };
      }

      if (templateType === 'A4-GST' || templateType === 'A4-NonGST') {
        const mappedData = mapOrderToInvoiceData(orderData);
        const result = templateType === 'A4-GST' 
          ? await generateGSTInvoicePDF(mappedData, safeConfig)
          : await generateNonGSTInvoicePDF(mappedData, safeConfig);
        resolve(result);
        return;
      }

      // Initialize PDFDocument with autoFirstPage: false
      doc = new PDFDocument({ autoFirstPage: false });

      // Add the single page with calculated dimensions
      doc.addPage(options);
      doc.fillColor('#000000');
      // Register Tamil fonts AFTER creating document (if Tamil language selected)
      if (language === 'ta') {
        try {
          const selectedFont = safeConfig.fontFamily || 'NotoSansTamil';
          if (selectedFont === 'MuktaMalar') {
            doc.registerFont('MuktaMalar', TAMIL_FONTS.MuktaMalar.regular);
            doc.registerFont('MuktaMalarBold', TAMIL_FONTS.MuktaMalar.bold);
          } else {
            doc.registerFont('NotoSansTamil', TAMIL_FONTS.NotoSansTamil.regular);
            doc.registerFont('NotoSansTamilBold', TAMIL_FONTS.NotoSansTamil.bold);
          }
        } catch (error) {
          console.error('Error registering Tamil fonts:', error);
          // Fallback to Helvetica if Tamil fonts fail
          font = 'Helvetica';
          fontBold = 'Helvetica-Bold';
        }
      }

      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => {
        const pdfData = Buffer.concat(buffers);
        
        // Return object with buffer and dimensions for thermal printers
        if (templateType === '80mm' || templateType === '72mm' || templateType === '50mm') {
           resolve({
             buffer: pdfData,
             height: options.size[1],
             width: options.size[0]
           });
        } else {
           resolve({
             buffer: pdfData,
             height: null, 
             width: null
           });
        }
      });

      if (templateType === 'A4') {
        generateA4Invoice(doc, orderData, font, fontBold, safeConfig, t, language);
      } else {
        generateThermalReceipt(doc, orderData, templateType, font, fontBold, safeConfig, t, language);
      }

      doc.end();

    } catch (error) {
      reject(error);
    }
  });
};

export const calculateThermalHeight = (order, type, config, language) => {
  const width = type === '80mm' ? 226 : type === '72mm' ? 204 : 164;
  const margin = 2; // Minimal margin to match PDF generation
  const safeConfig = config || {};
  const lang = language || config.invoiceLanguage || 'en';
  const t = translations[lang] || translations.en;
  
  // Select fonts based on language
  let font, fontBold;
  if (lang === 'ta') {
    const selectedFont = safeConfig.fontFamily || 'NotoSansTamil';
    if (selectedFont === 'MuktaMalar') {
      font = 'MuktaMalar';
      fontBold = 'MuktaMalarBold';
    } else {
      font = 'NotoSansTamil';
      fontBold = 'NotoSansTamilBold';
    }
  } else {
    // Use standard fonts for English - only accept valid English fonts
    const validEnglishFonts = ['Helvetica', 'Courier', 'Times-Roman'];
    const selectedFont = safeConfig.fontFamily;
    
    if (validEnglishFonts.includes(selectedFont)) {
      font = selectedFont;
      fontBold = selectedFont === 'Courier' ? 'Courier-Bold' : 
                 selectedFont === 'Times-Roman' ? 'Times-Bold' : 
                 'Helvetica-Bold';
    } else {
      font = 'Helvetica';
      fontBold = 'Helvetica-Bold';
    }
  }
                   
  // Create a dummy document for calculation with large height
  const dummyDoc = new PDFDocument({ size: [width, 10000], margin: margin });
  
  // Register Tamil fonts if needed for height calculation
  if (lang === 'ta') {
    try {
      const selectedFont = safeConfig.fontFamily || 'NotoSansTamil';
      if (selectedFont === 'MuktaMalar') {
        dummyDoc.registerFont('MuktaMalar', TAMIL_FONTS.MuktaMalar.regular);
        dummyDoc.registerFont('MuktaMalarBold', TAMIL_FONTS.MuktaMalar.bold);
      } else {
        dummyDoc.registerFont('NotoSansTamil', TAMIL_FONTS.NotoSansTamil.regular);
        dummyDoc.registerFont('NotoSansTamilBold', TAMIL_FONTS.NotoSansTamil.bold);
      }
    } catch (error) {
      console.error('Error registering fonts in height calc:', error);
      font = 'Helvetica';
      fontBold = 'Helvetica-Bold';
    }
  }
  
  return generateThermalReceipt(dummyDoc, order, type, font, fontBold, safeConfig, t, lang);
};

export function generateA4Invoice(doc, order, font, fontBold, config, t, language = 'en') {
  // A4 dimensions: 210mm x 297mm = 595.28pt x 841.89pt
  const pageWidth = 595.28;
  const pageHeight = 841.89;
  // REDESIGN: Consistent reduced margins
  const margin = 20; 
  const contentWidth = pageWidth - (margin * 2);
  
  let currentY = margin;

  // Helper functions (Consistent with GST Template)
  const drawBorderedBox = (x, y, width, height, lineWidth = 0.5) => {
    doc.strokeColor('#333333')
       .lineWidth(lineWidth)
       .rect(x, y, width, height)
       .stroke();
  };
  
  const drawGridCell = (x, y, width, height, text, options = {}) => {
    const {
      align = 'left',
      fontSize = 10,
      bold = false,
      bgColor = null,
      border = { top: true, right: true, bottom: true, left: true },
      textColor = '#000000'
    } = options;
    
    if (bgColor) {
      doc.rect(x, y, width, height).fill(bgColor);
    }
    
    // Draw borders
    doc.strokeColor('#333333').lineWidth(0.5);
    if (border.top) doc.moveTo(x, y + 0.5).lineTo(x + width, y + 0.5).stroke();
    if (border.right) doc.moveTo(x + width - 0.5, y).lineTo(x + width - 0.5, y + height).stroke();
    if (border.bottom) doc.moveTo(x, y + height - 0.5).lineTo(x + width, y + height - 0.5).stroke();
    if (border.left) doc.moveTo(x + 0.5, y).lineTo(x + 0.5, y + height).stroke();
    
    // Draw text
    if (text) {
      doc.fillColor(textColor)
         .fontSize(fontSize)
         .font(bold ? fontBold : font);
      
      const padding = 5;
      const textY = y + (height / 2) - (fontSize / 2);
      const textWidth = width - (padding * 2);
      
      doc.text(text, x + padding, textY, {
        width: textWidth,
        align: align,
        lineGap: 0
      });
    }
  };

  // Currency formatter
  const formatCurrency = (amount) => {
    const prefix = language === 'ta' ? '₹' : 'Rs.';
    return `${prefix}${parseFloat(amount || 0).toFixed(2)}`;
  };

  // ===== 1. HEADER SECTION (GST STYLE) =====
  // 1.1 Header Title
  drawGridCell(margin, currentY, contentWidth, 25, config.headerText || 'TAX INVOICE', { 
    align: 'center', 
    bold: true, 
    fontSize: 14 
  });
  currentY += 25;

  // 1.2 Company Info Header
  const companyInfoHeight = 110;
  drawBorderedBox(margin, currentY, contentWidth, companyInfoHeight);
  
  // Left side: Company details
  let companyY = currentY + 8;
  // God Name (above store name)
  if (order.storeDetails.god_name) {
    doc.fillColor('#000000').fontSize(10).font(font)
       .text(order.storeDetails.god_name, margin + 8, companyY, { width: 300 });
    companyY += 14;
  }
  doc.fillColor('#000000').fontSize(14).font(fontBold)
     .text(order.storeDetails.store || 'STORE NAME', margin + 8, companyY);
  companyY += 18;

  doc.fontSize(9).font(font);
  if (order.storeDetails.address) {
    doc.text(order.storeDetails.address, margin + 8, companyY, { width: 300 });
    companyY += doc.heightOfString(order.storeDetails.address, { width: 300 }) + 2;
  }
  if (order.storeDetails.phone) {
    doc.text(`${t.phone}: ${order.storeDetails.phone}`, margin + 8, companyY);
    companyY += 12;
  }
  if (order.storeDetails.gstin) {
    doc.text(`${t.gstin}: ${order.storeDetails.gstin}`, margin + 8, companyY);
    companyY += 12;
  }
  if (order.storeDetails.fassai_no) {
    doc.text(`FSSAI No: ${order.storeDetails.fassai_no}`, margin + 8, companyY);
    companyY += 12;
  }
  if (order.storeDetails.pan) {
    doc.text(`PAN: ${order.storeDetails.pan}`, margin + 8, companyY);
    companyY += 12;
  }
  if (order.storeDetails.email) {
    doc.text(`${t.email}: ${order.storeDetails.email}`, margin + 8, companyY);
  }

  // Right side: Invoice Details Grid (within company header)
  const detailColWidth = contentWidth * 0.35;
  const detailColX = margin + contentWidth - detailColWidth;
  
  drawGridCell(detailColX, currentY, detailColWidth * 0.4, 25, t.invoiceNo, { border: { left: true, bottom: true } });
  drawGridCell(detailColX + (detailColWidth * 0.4), currentY, detailColWidth * 0.6, 25, order.orderNumber, { bold: true, border: { left: true, bottom: true } });
  
  drawGridCell(detailColX, currentY + 25, detailColWidth * 0.4, 25, t.date, { border: { left: true, bottom: true } });
  drawGridCell(detailColX + (detailColWidth * 0.4), currentY + 25, detailColWidth * 0.6, 25, `${new Date(order.orderDate).toLocaleDateString()} ${order.orderTime}`, { border: { left: true, bottom: true } });

  currentY += companyInfoHeight;

  // ===== 2. CUSTOMER & ADDITIONAL DETAILS =====
  const customerBoxHeight = 120;
  const halfWidth = contentWidth / 2;
  
  // Bill To Label
  drawGridCell(margin, currentY, halfWidth, 20, t.billTo, { bold: true, bgColor: '#f0f0f0' });
  drawGridCell(margin + halfWidth, currentY, halfWidth, 20, t.invoiceDetails, { bold: true, bgColor: '#f0f0f0' });
  currentY += 20;

  // Bill To Content
  drawBorderedBox(margin, currentY, halfWidth, customerBoxHeight);
  let billToY = currentY + 8;
  doc.fontSize(10).font(fontBold).text(order.customer.name, margin + 8, billToY);
  billToY += 14;
  doc.fontSize(8).font(font);
  if (order.customer.address) {
    doc.text(order.customer.address, margin + 8, billToY, { width: halfWidth - 16 });
    billToY += doc.heightOfString(order.customer.address, { width: halfWidth - 16 }) + 4;
  }
  if (order.customer.phone) {
    doc.text(`${t.phone}: ${order.customer.phone}`, margin + 8, billToY);
    billToY += 11;
  }
  if (order.customer.gstin) {
    doc.text(`${t.gstin}: ${order.customer.gstin}`, margin + 8, billToY);
  }

  // Invoice Details Content
  drawBorderedBox(margin + halfWidth, currentY, halfWidth, customerBoxHeight);
  let detailsY = currentY + 8;
  doc.fontSize(8).font(font).fillColor('#333333');
  doc.text(`${t.counter}: ${order.storeDetails.counter}`, margin + halfWidth + 8, detailsY);
  detailsY += 12;
  doc.text(`${t.cashier}: ${order.storeDetails.cashier}`, margin + halfWidth + 8, detailsY);
  detailsY += 12;
  if (order.payment && order.payment.paymentMethod) {
    doc.text(`${t.payment}: ${order.payment.paymentMethod}`, margin + halfWidth + 8, detailsY);
  }

  currentY += customerBoxHeight + 10;

  // ===== 3. ITEMS TABLE =====
  // Define columns
  let columns = [
    { id: 'sl', label: config.headerSl || 'Sl.', width: 30, align: 'center' },
    { id: 'desc', label: config.headerDescription || t.description, width: 220, align: 'left' }
  ];

  if (config.showHsn && config.showGst) {
    columns.push({ id: 'hsn', label: t.hsn, width: 50, align: 'center' });
  }

  columns.push({ id: 'qty', label: t.qty, width: 40, align: 'center' });
  columns.push({ id: 'price', label: t.price, width: 70, align: 'right' });

  if (config.showDiscount) {
    columns.push({ id: 'disc', label: t.disc, width: 60, align: 'right' });
  }

  if (config.showTax) {
    columns.push({ id: 'tax', label: config.headerTax || `${t.tax}%`, width: 45, align: 'right' });
  }

  columns.push({ id: 'total', label: config.headerAmount || t.amount, width: contentWidth - 0, align: 'right' });
  // Dynamic width adjustment for last column
  let allocatedWidth = 0;
  columns.forEach((c, idx) => { if(idx < columns.length - 1) allocatedWidth += c.width; });
  columns[columns.length - 1].width = contentWidth - allocatedWidth;

  const drawTableHeaders = () => {
    let startX = margin;
    columns.forEach(col => {
      drawGridCell(startX, currentY, col.width, 25, col.label, { 
        bold: true, 
        align: 'center', 
        bgColor: '#f0f0f0' 
      });
      startX += col.width;
    });
    currentY += 25;
  };

  // Initial header
  drawTableHeaders();

  // Rows
  const rowHeight = 22;
  
  order.items.forEach((item, index) => {
    // Check for overflow
    if (currentY + rowHeight > pageHeight - margin - 50) {
      doc.addPage({ size: 'A4', margin: 20 });
      doc.rect(0, 0, 595.28, 841.89).fill('#FFFFFF');
      doc.fillColor('#000000');
      currentY = margin;
      drawTableHeaders();
    }

    let startX = margin;
    columns.forEach(col => {
      let text = '';
      switch (col.id) {
        case 'sl': text = (index + 1).toString(); break;
        case 'desc': text = truncateString(item.productName, config.descLimit || 40); break;
        case 'hsn': text = item.hsnCode || '-'; break;
        case 'qty': text = item.quantity.toString(); break;
        case 'price': text = parseFloat(item.unitPrice).toFixed(2); break;
        case 'disc': {
          let discAmt = item.discount_amount || item.discountAmount || 0;
          text = discAmt > 0 ? parseFloat(discAmt).toFixed(2) : '-';
          break;
        }
        case 'tax': {
           const rate = item.tax_rate || item.taxRate || item.gstPercentage || 0;
           text = rate > 0 ? `${rate}%` : '-';
           break;
        }
        case 'total': text = parseFloat(item.finalAmount).toFixed(2); break;
      }

      drawGridCell(startX, currentY, col.width, rowHeight, text, { align: col.align, fontSize: 9 });
      startX += col.width;
    });
    currentY += rowHeight;
  });

  // check if totals section fits
  if (currentY + 120 > pageHeight - margin) {
    doc.addPage({ size: 'A4', margin: 20 });
    doc.rect(0, 0, 595.28, 841.89).fill('#FFFFFF');
    doc.fillColor('#000000');
    currentY = margin;
  }

  // ===== 4. TOTALS SECTION =====
  const totalsWidth = 180;
  const labelsX = margin + contentWidth - totalsWidth;
  
  const drawTotalLine = (label, value, bold = false) => {
    drawGridCell(labelsX, currentY, totalsWidth * 0.6, 20, label, { align: 'right', bold });
    drawGridCell(labelsX + (totalsWidth * 0.6), currentY, totalsWidth * 0.4, 20, value, { align: 'right', bold });
    currentY += 20;
  };

  drawTotalLine(t.subtotal, formatCurrency(order.calculations.subtotal));
  if (order.calculations.taxDetails && order.calculations.taxDetails.totalTaxAmount > 0) {
    if (order.calculations.taxDetails.totalCgst > 0) drawTotalLine(`${t.cgst}`, formatCurrency(order.calculations.taxDetails.totalCgst));
    if (order.calculations.taxDetails.totalSgst > 0) drawTotalLine(`${t.sgst}`, formatCurrency(order.calculations.taxDetails.totalSgst));
  }
  if (order.calculations.billDiscountAmount > 0) drawTotalLine(t.discount, `-${formatCurrency(order.calculations.billDiscountAmount)}`);
  drawTotalLine(t.total, formatCurrency(order.calculations.grandTotal), true);

  // ===== 5. FOOTER & DECLARATION =====
  currentY = pageHeight - margin - 110;
  
  // Declaration Box
  const footerBoxWidth = contentWidth * 0.6;
  drawBorderedBox(margin, currentY, footerBoxWidth, 70);
  doc.fontSize(8).font(fontBold).text('Declaration:', margin + 5, currentY + 5);
  doc.font(font).fontSize(7).text('We declare that this invoice shows the actual price of the goods described and that all particulars are true and correct.', margin + 5, currentY + 18, { width: footerBoxWidth - 10 });
  
  // Authorized Signatory Box
  const signatoryWidth = contentWidth - footerBoxWidth - 10;
  const signatoryX = margin + footerBoxWidth + 10;
  drawBorderedBox(signatoryX, currentY, signatoryWidth, 70);
  
  const signatoryName = config.authorizedSignatoryFor || (order.storeDetails.store ? `for ${order.storeDetails.store}` : '');
  doc.fontSize(8).font(fontBold).text(signatoryName, signatoryX + 5, currentY + 5, { width: signatoryWidth - 10, align: 'right' });
  
  doc.fontSize(8).font(fontBold).text(config.authorizedSignatoryLabel || 'Authorised Signatory', signatoryX + 5, currentY + 55, { width: signatoryWidth - 10, align: 'right' });

  // Thank you note
  currentY += 80;
  doc.fontSize(10).font(fontBold).text(config.footerText || 'Thank you for your business!', margin, currentY, { align: 'center', width: contentWidth });
  
  // E. & O. E.
  if (config.showEOE !== false) {
    doc.fontSize(8).text('E. & O. E.', margin + contentWidth - 50, currentY + 15, { width: 50, align: 'right' });
  }
}

export function generateThermalReceipt(doc, order, type, font, fontBold, config, t, language = 'en') {
  const width = type === '80mm' ? 226 : type === '72mm' ? 204 : 164;
  const margin = 2; // Minimal margin to reduce white space
  const printableWidth = width - (margin * 2);
  
  // Currency formatter based on language (Tamil fonts support ₹, standard fonts use Rs.)
  const formatCurrency = (amount) => {
    const prefix = language ===  'ta' ? '₹' : 'Rs.';
    return `${prefix}${parseFloat(amount).toFixed(2)}`;
  };
  
  let currentY = 2; // Start at top with minimal spacing (was 10)

  // --- Helper Functions ---
  
  const centerText = (text, size = 10, fontName = font, options = {}) => {
    doc.font(fontName).fontSize(size).text(text, margin, currentY, { width: printableWidth, align: 'center', ...options });
    currentY += doc.heightOfString(text, { width: printableWidth, ...options }) + 2;
  };

  const drawDashedLine = () => {
    doc.strokeColor('#000000')
       .lineWidth(1)
       .dash(3, { space: 3 })
       .moveTo(margin, currentY)
       .lineTo(width - margin, currentY)
       .stroke()
       .undash(); // Reset dash
    currentY += 5;
  };

  const drawSolidLine = () => {
    doc.strokeColor('#000000')
       .lineWidth(1.5) // Slightly thicker for solid lines in design
       .moveTo(margin, currentY)
       .lineTo(width - margin, currentY)
       .stroke();
    currentY += 5;
  };

  const row = (label, value, boldLabel = false, boldValue = false, size = 9) => {
    const labelFont = boldLabel ? fontBold : font;
    const valueFont = boldValue ? fontBold : font;
    
    doc.fontSize(size);
    
    // Label
    doc.font(labelFont).text(label, margin, currentY);
    
    // Value (Right aligned)
    doc.font(valueFont).text(value, margin, currentY, { width: printableWidth, align: 'right' });
    
    currentY += doc.heightOfString(value, { width: printableWidth }) + 2;
  };

  const twoColRow = (left, right, fontName = font, size = 9, bold = false) => {
    doc.font(bold ? fontBold : fontName).fontSize(size);
    doc.text(left, margin, currentY);
    doc.text(right, margin, currentY, { width: printableWidth, align: 'right' });
    currentY += doc.heightOfString(left, { width: printableWidth }) + 2;
  };

  // --- 1. Header ---
  // God Name (above store name)
  if (order.storeDetails.god_name) {
    centerText(order.storeDetails.god_name, 10, font);
  }
  // Store Name
  centerText(order.storeDetails.store || 'SUPERMART', 16, fontBold);

  // Store Info
  doc.font(font).fontSize(8);
  const storeAddress = order.storeDetails.address || '123 Main Street, City Center';
  const storePhone = order.storeDetails.phone ? `Tel: ${order.storeDetails.phone}` : 'Tel: (555) 123-4567';

  centerText(storeAddress, 8);
  centerText(storePhone, 8);

  if (config.showGst) {
    const storeGst = order.storeDetails.gstin ? `${t.gstin}: ${order.storeDetails.gstin}` : `${t.gstin}: 22AAAAA0000A1Z5`;
    centerText(storeGst, 8);
  }

  if (order.storeDetails.fassai_no) {
    centerText(`FSSAI No: ${order.storeDetails.fassai_no}`, 8);
  }
  
  // Custom Header Text
  if (config.headerText) {
    currentY += 5;
    centerText(config.headerText, 10, fontBold);
  }

  currentY += 5;
  drawDashedLine();
  currentY += 2;

  // --- 2. Receipt Info ---
  // Bill No (Left Label, Right Value - Bold)
  row(`${t.billNo}:`, order.orderNumber, false, true, 9);
  
  // Date (Left Label, Right Value)
  const dateStr = new Date(order.orderDate).toLocaleDateString('en-GB'); // DD/MM/YYYY format
  const timeStr = order.orderTime;
  row(`${t.date}:`, `${dateStr} ${timeStr}`, false, false, 9);
  
  row(`${t.cashier}:`, order.storeDetails.cashier || 'Admin', false, false, 9);
  
  // --- 2.5 Customer Info ---
  if (order.customer && order.customer.name) {
    currentY += 2;
    row(`${t.billTo}:`, order.customer.name, false, true, 9);
    if (order.customer.phone) {
      row(`${t.phone}:`, order.customer.phone, false, false, 9);
    }
    if (config.showGst && order.customer.gstin) {
      row(`${t.gstin}:`, order.customer.gstin, false, false, 9);
    }
  }

  currentY += 2;
  drawDashedLine();
  currentY += 2;

  // --- 3. Items Header ---
  // Adjust column widths based on language (Tamil needs more space)
  const headerFontSize = language === 'ta' ? 8 : 9; // Smaller font for Tamil
  
  doc.font(fontBold).fontSize(headerFontSize);
  
  // Column widths adjusted for Tamil text
  const col0W = printableWidth * 0.08; // S.No column
  let col1W, col2W, col3W, col4W;
  if (language === 'ta') {
    // Tamil text is wider, adjust proportions
    col1W = printableWidth * 0.27;
    col2W = printableWidth * 0.18;
    col3W = printableWidth * 0.22;
    col4W = printableWidth * 0.25;
  } else {
    // English proportions
    col1W = printableWidth * 0.32;
    col2W = printableWidth * 0.15;
    col3W = printableWidth * 0.20;
    col4W = printableWidth * 0.25;
  }

  const col0X = margin;
  const col1X = margin + col0W;
  const col2X = col1X + col1W;
  const col3X = col2X + col2W;
  const col4X = col3X + col3W;

  doc.text('#', col0X, currentY, { width: col0W });
  doc.text(t.item, col1X, currentY, { width: col1W });
  doc.text(t.qty, col2X, currentY, { width: col2W, align: 'right' });
  doc.text(t.rate, col3X, currentY, { width: col3W, align: 'right' });
  doc.text(t.amt, col4X, currentY, { width: col4W, align: 'right' });
  
  currentY += 12;
  drawSolidLine();
  currentY += 2;

  // --- 4. Items List ---
  doc.font(font).fontSize(9);

  order.items.forEach((item, idx) => {
    // Item Name wraps
    const nameOptions = { width: col1W };
    const nameHeight = doc.heightOfString(item.productName, nameOptions);

    doc.text((idx + 1).toString(), col0X, currentY, { width: col0W });
    doc.text(item.productName, col1X, currentY, nameOptions);
    
    // Track total row height including HSN if present
    let totalItemHeight = nameHeight;
    
    // If HSN is enabled and GST is enabled, show HSN below name
    if (config.showGst && config.showHsn && item.hsnCode) {
      const hsnY = currentY + totalItemHeight;
      doc.fontSize(7).text(`HSN:${item.hsnCode}`, col1X, hsnY, { width: col1W });
      totalItemHeight += 9;
    }

    doc.fontSize(9); // Reset size

    doc.text(item.quantity.toString(), col2X, currentY, { width: col2W, align: 'right' });
    doc.text(item.unitPrice.toFixed(2), col3X, currentY, { width: col3W, align: 'right' });
    doc.text(item.finalAmount.toFixed(2), col4X, currentY, { width: col4W, align: 'right' });
    
    let rowHeight = Math.max(totalItemHeight, 12) + 4;
    currentY += rowHeight;
    
    // Calculate discount amount (either from item.discount_amount or calculate it)
    const expectedAmount = item.unitPrice * item.quantity;
    const actualDiscount = item.discount_amount || (expectedAmount - item.finalAmount);
    
    // Show item discount inline if discount exists
    if (actualDiscount && actualDiscount > 0.01) { // Use 0.01 to handle floating point precision
      currentY -= 5; // Move up slightly to reduce gap above discount
      doc.fontSize(7).font(font);
      const discountText = `Disc: -${formatCurrency(actualDiscount)}`;
      doc.text(discountText, col1X, currentY, { width: col1W + col2W });
      currentY += 10; // More spacing below discount line
      doc.fontSize(9); // Reset size
    }
  });

  drawDashedLine();
  currentY += 2;

  // --- 5. Totals ---
  // Amount before tax (subtotal)
  const subtotalLabel = (order.calculations.taxDetails && order.calculations.taxDetails.totalTaxAmount > 0) 
    ? `${t.subtotalBeforeTax}:` 
    : `${t.subtotal}:`;
  twoColRow(subtotalLabel, formatCurrency(order.calculations.amountBeforeTax), font, 9);
  
  // Tax breakdown (only if tax is applicable)
  if (config.showTax && order.calculations.taxDetails && order.calculations.taxDetails.totalTaxAmount > 0) {
    if (order.calculations.taxDetails.totalIgst > 0) {
      twoColRow(`${t.igst}:`, formatCurrency(order.calculations.taxDetails.totalIgst), font, 9);
    } else {
      if (order.calculations.taxDetails.totalSgst > 0) {
        twoColRow(`${t.sgst}:`, formatCurrency(order.calculations.taxDetails.totalSgst), font, 9);
      }
      if (order.calculations.taxDetails.totalCgst > 0) {
        twoColRow(`${t.cgst}:`, formatCurrency(order.calculations.taxDetails.totalCgst), font, 9);
      }
    }
    twoColRow(`${t.taxAmount}:`, formatCurrency(order.calculations.taxDetails.totalTaxAmount), font, 9);
    
    // Amount after tax
    const afterTaxAmount = order.calculations.amountBeforeTax + order.calculations.taxDetails.totalTaxAmount;
    currentY += 2;
    drawDashedLine();
    currentY += 2;
    twoColRow(`${t.amountAfterTax}:`, formatCurrency(afterTaxAmount), font, 9);
  }
  
  // Bill-level Discount
  if (config.showDiscount && order.calculations.billDiscountAmount > 0) {
    const discountLabel = order.calculations.billDiscountType === 'percentage' 
      ? `${t.billDiscount} (${order.calculations.billDiscount}%):` 
      : `${t.billDiscount}:`;
    twoColRow(discountLabel, `-${formatCurrency(order.calculations.billDiscountAmount)}`, font, 9);
  }
  
  // Loyalty Points Discount (if applicable)
  const loyaltyPointsUsedVal = order.calculations?.loyaltyPointsUsed || order.loyalty_points_used || order.payment?.loyaltyPointsUsed || 0;
  const loyaltyAmountVal = order.calculations?.loyaltyPointsValue || order.loyalty_points_amount || order.payment?.loyaltyDiscountAmount || 0;

  if (loyaltyPointsUsedVal > 0 && loyaltyAmountVal > 0) {
    twoColRow(`${t.loyaltyPointsApplied}:`, `-${formatCurrency(loyaltyAmountVal)}`, font, 9);
  }
  
  // Round off (if any)
  if (order.calculations.roundOffAmount && Math.abs(order.calculations.roundOffAmount) > 0.01) {
    const roundOffLabel = order.calculations.roundOffAmount > 0 ? `${t.roundOff} (+):` : `${t.roundOff} (-):`;
    twoColRow(roundOffLabel, formatCurrency(Math.abs(order.calculations.roundOffAmount)), font, 9);
  }

  currentY += 2;
  // Total Line (Solid borders top and bottom)
  drawSolidLine();
  currentY += 2;
  
  doc.font(fontBold).fontSize(13);
  doc.text(`${t.total}:`, margin, currentY);
  doc.text(formatCurrency(order.calculations.grandTotal), margin, currentY, { width: printableWidth, align: 'right' });
  currentY += 18;
  
  drawSolidLine();
  currentY += 5;

  // --- 6. Payment Info ---
  const paidAmount = order.payment.receivedAmount || 0;
  
  // Only show payment mode if paid amount is greater than zero
  if (paidAmount > 0) {
    const paymentMode = order.payment.paymentType === 'split' ? 'SPLIT' : (order.payment.paymentMethod || 'CASH').toUpperCase();
    twoColRow(`${t.paymentMode}:`, paymentMode, font, 9);
  }
  
  // Always show Paid Amount (Bold) - from payment records
  row(`${t.paidAmount}:`, formatCurrency(paidAmount), false, true, 9);
  
  // Outstanding Amount - Only show if balance > 0
  const balanceAmount = order.payment.balanceAmount || 0;
  if (balanceAmount > 0) {
    currentY += 2;
    drawDashedLine();
    currentY += 2;
    row(`${t.outstanding}:`, formatCurrency(balanceAmount), true, true, 10);
  }

  currentY += 5;
  drawDashedLine();
  currentY += 5;

  // --- 7. Barcode (Text representation) ---
  // Center the order number with spacing
  doc.font(font).fontSize(9).text(order.orderNumber.replace(/-/g, ''), margin, currentY, { width: printableWidth, align: 'center', characterSpacing: 2 });
  currentY += 15;

  // --- 8. Footer ---
  // Top decorative line
  drawDashedLine();
  currentY += 3;
  
  // Custom footer text (Thank you message)
  const footerText = config.footerText || 'Thank you for your business!';
  doc.font(fontBold).fontSize(11);
  const footerHeight = doc.heightOfString(footerText, { width: printableWidth, align: 'center' });
  doc.text(footerText, margin, currentY, { width: printableWidth, align: 'center' });
  currentY += footerHeight + 5;
  
  // "Visit Again" message with emoji-like characters
  doc.font(font).fontSize(9);
  centerText(t.visitAgain, 9);
  
  currentY += 2;
  
  // Separator stars
  doc.fontSize(8);
  const starsLine = '* * * * * * * * * *';
  doc.text(starsLine, margin, currentY, { width: printableWidth, align: 'center' });
  currentY += 12;
  
  // Marketing Link (Fixed) - Styled
  doc.font(fontBold).fontSize(9);
  doc.text('Powered by', margin, currentY, { width: printableWidth, align: 'center' });
  currentY += 12;
  
  doc.font(fontBold).fontSize(10);
  doc.text('www.rabtoise.org', margin, currentY, { width: printableWidth, align: 'center' });
  currentY += 20;
  
  // Bottom decorative line
  drawDashedLine();
  
  return currentY + 20; // Return total height with some bottom padding
}
