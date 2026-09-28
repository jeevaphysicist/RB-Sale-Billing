
/**
 * Generates ESC/POS commands for a sales order.
 * @param {object} printer - The escpos.Printer instance (or compatible mock).
 * @param {object} order - The validated order object including items and calculations.
 */
export async function generateEscPosCommands(printer, order) {
  try {
    // 1. Header (Store Info)
    printer
      .align('ct')
      .font('a')
      .style('b')
      .size(1, 1)
      .text(order.storeDetails.store || 'Store Name')
      .size(0, 0) // Reset size
      .style('normal');
      
    if (order.storeDetails.address) {
      printer.text(order.storeDetails.address);
    }
    if (order.storeDetails.phone) {
      printer.text(`Phone: ${order.storeDetails.phone}`);
    }
    
    printer.text('--------------------------------');

    // 2. Order Info
    printer.align('lt');
    printer.text(`Order: ${order.orderNumber}`);
    printer.text(`Date: ${new Date(order.orderDate).toLocaleDateString()} ${order.orderTime || ''}`);
    if (order.customer && order.customer.name) {
       printer.text(`Customer: ${order.customer.name}`);
    }
    printer.text('--------------------------------');

    // 3. Items Header
    // Using simple spacing since tableCustom requires specific width tuning
    // Layout: Item (left) ... Qty x Price (right)
    // Actually, let's use a simple format:
    // Item Name
    //   Qty x Price         Total
    
    printer.align('lt');
    
    order.items.forEach(item => {
        // Item Name
        printer.text(item.productName);
        
        // Details line
        const quantity = item.quantity;
        const price = item.unitPrice.toFixed(2);
        const total = item.finalAmount.toFixed(2);
        
        const details = `   ${quantity} x ${price}`;
        const totalStr = total;
        
        // Manual spacing for right align of total (assuming ~32 chars width for 58mm or 42/48 for 80mm)
        // We'll just separate with spaces. For better alignment, tableCustom is preferred but complex without knowing paper width.
        // Let's assume standard behavior: text + spacing.
        
        // Simple approach:
        printer.tableCustom([
            { text: details, align: 'LEFT', width: 0.60 },
            { text: totalStr, align: 'RIGHT', width: 0.40 }
        ]);
    });

    printer.text('--------------------------------');

    // 4. Totals
    const formatRow = (label, value, bold = false) => {
         if (bold) printer.style('b');
         printer.tableCustom([
            { text: label, align: 'LEFT', width: 0.50 },
            { text: value, align: 'RIGHT', width: 0.50 }
        ]);
        if (bold) printer.style('normal');
    };

    formatRow('Subtotal:', order.calculations.subtotal.toFixed(2));
    
    if (order.calculations.billDiscountAmount > 0) {
        formatRow('Discount:', `-${order.calculations.billDiscountAmount.toFixed(2)}`);
    }
    
    if (order.calculations.taxDetails && order.calculations.taxDetails.totalTaxAmount > 0) {
        formatRow('Tax:', order.calculations.taxDetails.totalTaxAmount.toFixed(2));
    }

    if (order.calculations.roundOffAmount !== 0) {
        formatRow('Round Off:', order.calculations.roundOffAmount.toFixed(2));
    }

    printer.text('--------------------------------');
    
    formatRow('Grand Total:', order.calculations.grandTotal.toFixed(2), true);
    
    printer.feed(1);
    
    // 5. Footer
    printer.align('ct');
    printer.text('Thank you for shopping!');
    printer.text('Visit Again');
    printer.feed(2);
    
    // 6. Cut
    printer.cut();

  } catch (error) {
    console.error('Error in generateEscPosCommands:', error);
    // Even if error, ensure we try to close or cut
    printer.text('Error printing receipt');
    printer.feed(3);
    printer.cut();
  }
}
