import PDFDocument from 'pdfkit';

export const generatePurchaseOrderPDF = (orderData, templateType = 'A4', config = {}) => {
  return new Promise((resolve, reject) => {
    try {
      const buffers = [];
      let doc;

      // Default config values
      const safeConfig = {
        fontFamily: 'Helvetica',
        showTax: true,
        showDiscount: true,
        showGst: true,
        showHsn: false,
        showOutstanding: false,
        headerText: 'Purchase Order',
        footerText: 'Authorized Signatory',
        ...config
      };

      const font = safeConfig.fontFamily || 'Helvetica';
      const fontBold = safeConfig.fontFamily === 'Courier' ? 'Courier-Bold' : 
                       safeConfig.fontFamily === 'Times-Roman' ? 'Times-Bold' : 
                       'Helvetica-Bold';

      // Initialize PDFDocument with autoFirstPage: false
      // Currently only supporting A4 for Purchase Orders
      doc = new PDFDocument({ autoFirstPage: false });
      doc.addPage({ size: 'A4', margin: 50 });

      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => {
        const pdfData = Buffer.concat(buffers);
        resolve(pdfData);
      });

      // --- Content Generation ---
      const startY = 50;
      let currentY = startY;

      // 1. Header
      doc.fontSize(20).font(fontBold).text(orderData.storeDetails?.store || 'My Store', { align: 'center' });
      currentY += 25;
      
      doc.fontSize(10).font(font).text(safeConfig.headerText || 'Purchase Order', { align: 'center' });
      currentY += 20;

      // 2. Details Section (Two Columns)
      const col1X = 50;
      const col2X = 300;
      
      // Buyer Details (Left - Store)
      doc.fontSize(10).font(fontBold).text('Buyer (Bill To):', col1X, currentY);
      doc.font(font).text(orderData.storeDetails?.store || '', col1X, currentY + 15);
      doc.text(orderData.storeDetails?.address || '', col1X, currentY + 30);
      if (orderData.storeDetails?.phone) doc.text(`Phone: ${orderData.storeDetails.phone}`, col1X, currentY + 45);
      if (orderData.storeDetails?.email) doc.text(`Email: ${orderData.storeDetails.email}`, col1X, currentY + 60);
      
      let buyerDetailsHeight = 75;
      if (safeConfig.showGst && orderData.storeDetails?.gstin) {
        doc.text(`GSTIN: ${orderData.storeDetails.gstin}`, col1X, currentY + buyerDetailsHeight);
        buyerDetailsHeight += 15;
      }

      // PO Details (Right)
      doc.font(fontBold).text('Order Details:', col2X, currentY);
      doc.font(font).text(`PO No: ${orderData.po_number || ''}`, col2X, currentY + 15);
      doc.text(`Date: ${orderData.po_date || ''}`, col2X, currentY + 30);
      doc.text(`Delivery Date: ${orderData.delivery_date || ''}`, col2X, currentY + 45);
      doc.text(`Status: ${orderData.status || ''}`, col2X, currentY + 60);

      currentY += Math.max(buyerDetailsHeight, 75) + 10;

      // Supplier Details (Left)
      doc.font(fontBold).text('Vendor (Supplier):', col1X, currentY);
      doc.font(font).text(orderData.supplier_name || '', col1X, currentY + 15);
      doc.text(orderData.supplier_address || '', col1X, currentY + 30);
      doc.text(`Contact: ${orderData.contact_person || ''}`, col1X, currentY + 45);
      doc.text(`Phone: ${orderData.contact_number || ''}`, col1X, currentY + 60);

      if (safeConfig.showGst && orderData.supplier_gst) {
        doc.text(`GSTIN: ${orderData.supplier_gst}`, col1X, currentY + 75);
        currentY += 15;
      }

      currentY += 90;

      // 3. Items Table
      const tableTop = currentY;
      
      const columns = [
        { id: 'item', label: 'Item Description', width: 220, align: 'left' },
        { id: 'hsn', label: 'HSN', width: 60, align: 'left' },
        { id: 'qty', label: 'Qty', width: 50, align: 'center' },
        { id: 'rate', label: 'Rate', width: 70, align: 'right' },
        { id: 'tax', label: 'Tax', width: 50, align: 'right' },
        { id: 'amount', label: 'Amount', width: 80, align: 'right' }
      ];

      // Filter columns based on config if needed, simplifying for PO standard
      // (Assuming we always show basics)

      let currentX = 50;
      const tableCols = columns.map(col => {
        const column = { ...col, x: currentX };
        currentX += col.width + 5;
        return column;
      });

      // Header
      doc.font(fontBold);
      tableCols.forEach(col => {
        doc.text(col.label, col.x, tableTop, { width: col.width, align: col.align });
      });

      currentY += 15;
      doc.strokeColor('#aaaaaa').lineWidth(1).moveTo(50, currentY).lineTo(550, currentY).stroke();
      currentY += 10;

      // Rows
      doc.font(font);
      (orderData.items || []).forEach(item => {
        const rowStart = currentY;
        const nameOptions = { width: tableCols[0].width };
        const nameHeight = doc.heightOfString(item.product_name || `Product #${item.product_id}`, nameOptions);
        
        // Col 1: Item
        doc.text(item.product_name || `Product #${item.product_id}`, tableCols[0].x, currentY, nameOptions);
        
        // Col 2: HSN
        if (safeConfig.showHsn || true) { // Always show HSN on PO usually
             doc.text(item.hsn_code || '-', tableCols[1].x, currentY, { width: tableCols[1].width, align: tableCols[1].align });
        }
        
        // Col 3: Qty
        doc.text(`${item.quantity} ${item.unit || ''}`, tableCols[2].x, currentY, { width: tableCols[2].width, align: tableCols[2].align });

        // Col 4: Rate
        doc.text((item.unit_price || 0).toFixed(2), tableCols[3].x, currentY, { width: tableCols[3].width, align: tableCols[3].align });

        // Col 5: Tax
        const taxText = item.tax ? `${item.tax}%` : '0%';
        doc.text(taxText, tableCols[4].x, currentY, { width: tableCols[4].width, align: tableCols[4].align });

        // Col 6: Amount
        doc.text((item.amount || 0).toFixed(2), tableCols[5].x, currentY, { width: tableCols[5].width, align: tableCols[5].align });

        currentY += Math.max(20, nameHeight + 10);
      });

      doc.moveTo(50, currentY).lineTo(550, currentY).stroke();
      currentY += 10;

      // 4. Totals
      const totalsX = 350;
      const valuesX = 450;
      const totalsFn = doc.font(fontBold);

      const totals = orderData.totals || {};

      totalsFn.text('Subtotal:', totalsX, currentY);
      doc.text((totals.subtotal_without_tax || 0).toFixed(2), valuesX, currentY, { align: 'right', width: 80 });
      currentY += 20;

      if (totals.total_tax > 0) {
        totalsFn.text('Total Tax:', totalsX, currentY);
        doc.text(totals.total_tax.toFixed(2), valuesX, currentY, { align: 'right', width: 80 });
        currentY += 20;
      }
      
      if (totals.order_discount_amount > 0) {
        totalsFn.text('Discount:', totalsX, currentY);
        doc.text(`-${totals.order_discount_amount.toFixed(2)}`, valuesX, currentY, { align: 'right', width: 80 });
        currentY += 20;
      }
      
      if (totals.freight > 0) {
        totalsFn.text('Freight:', totalsX, currentY);
        doc.text(totals.freight.toFixed(2), valuesX, currentY, { align: 'right', width: 80 });
        currentY += 20;
      }

       if (totals.insurance > 0) {
        totalsFn.text('Insurance:', totalsX, currentY);
        doc.text(totals.insurance.toFixed(2), valuesX, currentY, { align: 'right', width: 80 });
        currentY += 20;
      }

       if (totals.other_charges > 0) {
        totalsFn.text('Other Charges:', totalsX, currentY);
        doc.text(totals.other_charges.toFixed(2), valuesX, currentY, { align: 'right', width: 80 });
        currentY += 20;
      }

      // Grand Total
      currentY += 5;
      doc.fontSize(12).text('Net Payable:', totalsX, currentY);
      doc.text((totals.net_payable || 0).toFixed(2), valuesX, currentY, { align: 'right', width: 80 });
      doc.fontSize(10);
      currentY += 40;

      // 5. Terms & Footer
      doc.text('Terms & Conditions:', 50, currentY);
      doc.font(font).fontSize(9);
      doc.text(orderData.remarks || '1. Goods must be delivered in good condition.\n2. Invoice must accompany the delivery.', 50, currentY + 15);

      const footerText = safeConfig.footerText || 'Authorized Signatory';
      
      // Signature area
      doc.font(fontBold).fontSize(10).text(footerText, 350, 700, { align: 'center', width: 200 });
      doc.strokeColor('black').lineWidth(0.5).moveTo(350, 690).lineTo(550, 690).stroke();

      doc.end();

    } catch (error) {
       reject(error);
    }
  });
};
