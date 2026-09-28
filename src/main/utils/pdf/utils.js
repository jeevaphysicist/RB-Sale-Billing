import path from 'path';
import { app } from 'electron';

// Determine the base path for resources
// In production (packaged), resources are in process.resourcesPath
// In development, they are in process.cwd()/resources
export const getResourcesPath = () => {
  return app.isPackaged
    ? path.join(process.resourcesPath, 'resources')
    : path.join(process.cwd(), 'resources');
};

export const RESOURCES_PATH = getResourcesPath();

// Tamil font paths
export const TAMIL_FONTS = {
  NotoSansTamil: {
    regular: path.join(RESOURCES_PATH, 'Noto_Sans_Tamil/static/NotoSansTamil-Regular.ttf'),
    bold: path.join(RESOURCES_PATH, 'Noto_Sans_Tamil/static/NotoSansTamil-Bold.ttf')
  },
  MuktaMalar: {
    regular: path.join(RESOURCES_PATH, 'Mukta_Malar/MuktaMalar-Regular.ttf'),
    bold: path.join(RESOURCES_PATH, 'Mukta_Malar/MuktaMalar-Bold.ttf')
  }
};

// Translation object for invoice/receipt labels
export const translations = {
  en: {
    // Headers
    taxInvoice: 'TAX INVOICE',
    invoice: 'INVOICE',
    billTo: 'BILL TO',
    invoiceDetails: 'INVOICE DETAILS',
    
    // Labels
    phone: 'Phone',
    email: 'Email',
    gstin: 'GSTIN',
    invoiceNo: 'Invoice #',
    date: 'Date',
    counter: 'Counter',
    cashier: 'Cashier',
    payment: 'Payment',
    
    // Table headers
    code: 'Code',
    description: 'Description',
    hsn: 'HSN',
    qty: 'Qty',
    price: 'Price',
    disc: 'Disc',
    tax: 'Tax %',
    amount: 'Amount',
    item: 'ITEM',
    rate: 'RATE',
    amt: 'AMT',
    wastage: 'Wastage',
    
    // Totals
    subtotal: 'Subtotal',
    subtotalBeforeTax: 'Subtotal (Before Tax)',
    discount: 'Discount',
    billDiscount: 'Bill Discount',
    loyaltyDiscount: 'Loyalty Discount',
    loyaltyPointsApplied: 'Loyalty Points Applied',
    roundOff: 'Round Off',
    total: 'TOTAL',
    grandTotal: 'TOTAL',
    taxAmount: 'Tax Amount',
    amountAfterTax: 'Amount After Tax',
    
    // Tax labels
    cgst: 'CGST',
    sgst: 'SGST',
    igst: 'IGST',
    
    // Payment
    paymentInformation: 'PAYMENT INFORMATION',
    bank: 'Bank',
    accountName: 'Account Name',
    accountNumber: 'Account Number',
    ifscCode: 'IFSC Code',
    branch: 'Branch',
    dueDate: 'Due Date',
    net: 'Net',
    days: 'Days',
    paymentMode: 'Payment Mode',
    paidAmount: 'Paid Amount',
    outstanding: 'Outstanding',
    previousBalance: 'Previous Balance',
    
    // Receipt
    billNo: 'Bill No',
    
    // Footer
    thankYou: 'Thank you for your business!',
    visitAgain: 'Visit Again',
    computerGenerated: 'This is a computer-generated invoice and is valid without signature.',
    poweredBy: 'Powered by www.rabtoise.org'
  },
  ta: {
    // Headers
    taxInvoice: 'வரி விலைப்பட்டியல்',
    invoice: 'விலைப்பட்டியல்',
    billTo: 'பில் செலுத்த வேண்டியவர்',
    invoiceDetails: 'விலைப்பட்டியல் விவரங்கள்',
    
    // Labels
    phone: 'தொலைபேசி',
    email: 'மின்னஞ்சல்',
    gstin: 'GSTIN',
    invoiceNo: 'விலைப்பட்டியல் எண்',
    date: 'தேதி',
    counter: 'கவுண்டர்',
    cashier: 'காசாளர்',
    payment: 'கட்டணம்',
    
    // Table headers
    code: 'குறியீடு',
    description: 'விளக்கம்',
    hsn: 'HSN',
    qty: 'அளவு',
    price: 'விலை',
    disc: 'தள்ளுபடி',
    tax: 'வரி %',
    amount: 'தொகை',
    item: 'பொருள்',
    rate: 'விலை',
    amt: 'தொகை',
    wastage: 'விரயம்',
    
    // Totals
    subtotal: 'சிறு மொத்தம்',
    subtotalBeforeTax: 'வரிக்குப் முன் தொகை',
    discount: 'தள்ளுபடி',
    billDiscount: 'பில் தள்ளுபடி',
    loyaltyDiscount: 'விசுவாச தள்ளுபடி',
    loyaltyPointsApplied: 'ரிவார்டு புள்ளிகள்',
    roundOff: 'ரவுண்ட் ஆஃப்',
    total: 'மொத்தம்',
    grandTotal: 'மொத்தம்',
    taxAmount: 'வரித் தொகை',
    amountAfterTax: 'வரிக்குப் பின் தொகை',
    
    // Tax labels
    cgst: 'CGST',
    sgst: 'SGST',
    igst: 'IGST',
    
    // Payment
    paymentInformation: 'கட்டண தகவல்',
    bank: 'வங்கி',
    accountName: 'கணக்கு பெயர்',
    accountNumber: 'கணக்கு எண்',
    ifscCode: 'IFSC குறியீடு',
    branch: 'கிளை',
    dueDate: 'செலுத்த வேண்டிய தேதி',
    net: 'நிகர',
    days: 'நாட்கள்',
    paymentMode: 'கட்டண முறை',
    paidAmount: 'செலுத்திய தொகை',
    outstanding: 'நிலுவையில் உள்ளது',
    previousBalance: 'முந்தைய இருப்பு',
    
    // Receipt
    billNo: 'பில் எண்',
    
    // Footer
    thankYou: 'உங்கள் வணிகத்திற்கு நன்றி!',
    visitAgain: 'மீண்டும் வருக',
    computerGenerated: 'இது கணினி உருவாக்கிய விலைப்பட்டியல் மற்றும் கையொப்பம் இல்லாமல் செல்லுபடியாகும்.',
    poweredBy: 'www.rabtoise.org மூலம் இயக்கப்படுகிறது'
  }
};

// Helper function to convert number to words (Indian numbering system)
export function numberToWords(num) {
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  const teens = ['Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  
  if (num === 0) return 'Zero';
  if (num < 0) return 'Minus ' + numberToWords(Math.abs(num));
  
  let words = '';
  
  if (Math.floor(num / 10000000) > 0) {
    words += numberToWords(Math.floor(num / 10000000)) + ' Crore ';
    num %= 10000000;
  }
  
  if (Math.floor(num / 100000) > 0) {
    words += numberToWords(Math.floor(num / 100000)) + ' Lakh ';
    num %= 100000;
  }
  
  if (Math.floor(num / 1000) > 0) {
    words += numberToWords(Math.floor(num / 1000)) + ' Thousand ';
    num %= 1000;
  }
  
  if (Math.floor(num / 100) > 0) {
    words += numberToWords(Math.floor(num / 100)) + ' Hundred ';
    num %= 100;
  }
  
  if (num > 0) {
    if (words !== '') words += 'and ';
    
    if (num < 10) {
      words += ones[num];
    } else if (num < 20) {
      words += teens[num - 10];
    } else {
      words += tens[Math.floor(num / 10)];
      if (num % 10 > 0) {
        words += ' ' + ones[num % 10];
      }
    }
  }
  
  return words.trim();
}

export const truncateString = (str, limit) => {
  if (!str) return '';
  if (limit && str.length > limit) {
    return str.substring(0, limit) + '...';
  }
  return str;
};

export const mapOrderToInvoiceData = (order) => {
  // POS items have properties like productName, unitPrice, finalAmount
  // Specialized A4 templates expect description, rate, amount
  const mappedItems = (order.items || []).map(item => ({
    description: item.productName || item.product_name || '',
    hsn: item.hsnCode || item.hsn_code || '',
    quantity: item.quantity || 0,
    rate: (item.unitPrice || item.unit_price || 0).toFixed(2),
    per: item.unit || 'PCS', // Dynamic unit
    gst: (item.taxRate || item.tax_rate || 0).toString() + '%',
    amount: (item.finalAmount || item.final_amount || 0).toFixed(2),
    // Extra details for GST breakdown
    taxableValue: (item.netAmount || item.net_amount || (item.finalAmount - item.totalTaxAmount) || 0),
    cgstRate: ((item.taxRate || item.tax_rate || 0) / 2).toString() + '%',
    cgstAmount: (item.cgstAmount || item.cgst_amount || 0).toFixed(2),
    sgstRate: ((item.taxRate || item.tax_rate || 0) / 2).toString() + '%',
    sgstAmount: (item.sgstAmount || item.sgst_amount || 0).toFixed(2),
    igstRate: (item.taxRate || item.tax_rate || 0).toString() + '%',
    igstAmount: (item.igstAmount || item.igst_amount || 0).toFixed(2)
  }));

  // Aggregate GST breakdown by HSN or Tax Rate
  const gstBreakdownMap = {};
  mappedItems.forEach(item => {
    const key = item.hsn || 'General';
    if (!gstBreakdownMap[key]) {
      gstBreakdownMap[key] = {
        hsn: key,
        taxableValue: 0,
        cgstRate: item.cgstRate,
        cgstAmount: 0,
        sgstRate: item.sgstRate,
        sgstAmount: 0,
        igstRate: item.igstRate,
        igstAmount: 0
      };
    }
    gstBreakdownMap[key].taxableValue += parseFloat(item.taxableValue);
    gstBreakdownMap[key].cgstAmount += parseFloat(item.cgstAmount);
    gstBreakdownMap[key].sgstAmount += parseFloat(item.sgstAmount);
    gstBreakdownMap[key].igstAmount += parseFloat(item.igstAmount);
  });

  const gstBreakdown = Object.values(gstBreakdownMap).map(row => ({
    ...row,
    taxableValue: row.taxableValue.toFixed(2),
    cgstAmount: row.cgstAmount.toFixed(2),
    sgstAmount: row.sgstAmount.toFixed(2),
    igstAmount: row.igstAmount.toFixed(2)
  }));

  const grandTotal = order.calculations?.grandTotal || order.calculations?.grand_total || order.grand_total || 0;

  return {
    company: {
      name: order.storeDetails?.store || order.store_name || '',
      // For A4 templates, we need individual address components
      // Parse from storeDetails if available, otherwise use fallback
      address: order.storeDetails?.address_line1 || order.storeDetails?.address || '',
      address2: order.storeDetails?.address_line2 || '',
      city: order.storeDetails?.city ? `${order.storeDetails.city}${order.storeDetails?.pincode ? ' - ' + order.storeDetails.pincode : ''}` : '',
      district: order.storeDetails?.district ? `DIST:${order.storeDetails.district}, ${order.storeDetails?.state || ''}` : '',
      gstin: order.storeDetails?.gstin || '',
      pan: order.storeDetails?.pan || '',
      phone: order.storeDetails?.phone || '',
      email: order.storeDetails?.email || ''
    },
    buyer: {
      name: order.customer?.name || order.customer_name || 'Walk-in Customer',
      address: order.customer?.address || order.customer_address || '',
      phone: order.customer?.phone || order.customer_phone || '',
      gstin: order.customer?.gstin || order.customer_gstin || ''
    },
    invoiceNumber: order.orderNumber || order.order_number || '',
    date: (order.orderDate || order.order_date) ? `${new Date(order.orderDate || order.order_date).toLocaleDateString('en-IN')} ${order.orderTime || order.order_time || ''}` : '',
    items: mappedItems,
    gstBreakdown: gstBreakdown,
    total: grandTotal.toFixed(2),
    amountInWords: numberToWords(Math.floor(grandTotal)) + ' Rupees Only',
    gstTotal: {
      taxableValue: (order.calculations?.taxDetails?.taxableAmount || 0).toFixed(2),
      cgstAmount: (order.calculations?.taxDetails?.totalCgst || 0).toFixed(2),
      sgstAmount: (order.calculations?.taxDetails?.totalSgst || 0).toFixed(2),
      igstAmount: (order.calculations?.taxDetails?.totalIgst || 0).toFixed(2)
    },
    // Keep these for potential future use or backward compatibility within this file
    grandTotal: grandTotal.toFixed(2),
    grandTotalInWords: numberToWords(Math.floor(grandTotal)) + ' Only'
  };
};
