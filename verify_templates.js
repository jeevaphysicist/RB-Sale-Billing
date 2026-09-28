
import { generateSalesOrderPDF } from './src/main/utils/pdfGenerator.js';
import fs from 'fs';

const dummyOrder = {
  orderNumber: 'VERIFY-001',
  orderDate: '2026-01-12',
  orderTime: '10:00 PM',
  customer: { name: 'Test Customer', phone: '123' },
  items: [{ productName: 'Test Item', unitPrice: 100, quantity: 1, finalAmount: 100 }],
  calculations: { subtotal: 100, grandTotal: 100, taxDetails: { totalTaxAmount: 0 } },
  payment: { paymentMethod: 'Cash' }
};

async function verify() {
  console.log('Testing A4 (Generic)...');
  const resA4 = await generateSalesOrderPDF(dummyOrder, 'A4');
  console.log('A4 Result:', !!resA4.buffer || !!resA4);

  console.log('Testing A4-GST...');
  const resGST = await generateSalesOrderPDF(dummyOrder, 'A4-GST');
  console.log('A4-GST Result:', !!resGST.buffer);

  console.log('Testing A4-NonGST...');
  const resNonGST = await generateSalesOrderPDF(dummyOrder, 'A4-NonGST');
  console.log('A4-NonGST Result:', !!resNonGST.buffer);
  
  if (resGST.buffer && resNonGST.buffer) {
     console.log('VERIFICATION SUCCESSFUL');
  } else {
     console.log('VERIFICATION FAILED');
  }
}

verify().catch(console.error);
