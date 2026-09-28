import { ipcMain } from 'electron';
import { globalDb } from '../Database/db.js';

export function registerTemplateHandlers() {
  // Get Template Settings
  ipcMain.handle('template:get-settings', async (event, documentType) => {
    try {
      return new Promise((resolve, reject) => {
        globalDb.get(
          `SELECT * FROM template_settings WHERE document_type = ?`,
          [documentType],
          (err, row) => {
            if (err) reject(err);
            else {
              if (row) {
                // Parse config JSON
                try {
                  row.config = JSON.parse(row.config);
                } catch (e) {
                  row.config = {};
                }
              }
              resolve({ success: true, data: row });
            }
          }
        );
      });
    } catch (error) {
      console.error('Error fetching template settings:', error);
      return { success: false, message: error.message };
    }
  });

  // Save Template Settings
  ipcMain.handle('template:save-settings', async (event, settings) => {
    try {
      const { documentType, templateName, config } = settings;
      const configStr = JSON.stringify(config);

      return new Promise((resolve, reject) => {
        globalDb.run(
          `INSERT INTO template_settings (document_type, template_name, config, is_active)
           VALUES (?, ?, ?, 1)
           ON CONFLICT(document_type) DO UPDATE SET
           template_name = excluded.template_name,
           config = excluded.config,
           updated_at = datetime('now', '+5 hours', '30 minutes')`,
          [documentType, templateName, configStr],
          function (err) {
            if (err) reject(err);
            else resolve({ success: true, message: 'Settings saved successfully' });
          }
        );
      });
    } catch (error) {
      console.error('Error saving template settings:', error);
      return { success: false, message: error.message };
    }
  });

  // Reset Template Settings
  ipcMain.handle('template:reset-settings', async (event, documentType) => {
    try {
      const defaultConfig = JSON.stringify({
        fontFamily: 'Helvetica',
        showTax: true,
        showDiscount: true,
        showGst: true,
        showHsn: false,
        showOutstanding: false,
        headerText: 'Tax Invoice',
        footerText: 'Thank you for your business!',
        headerDescription: '',
        headerHsn: '',
        headerQty: '',
        headerRate: '',
        headerPer: '',
        headerGst: '',
        headerAmount: '',
        headerSl: '',
        headerTax: '',
        descLimit: 45
      });

      return new Promise((resolve, reject) => {
        globalDb.run(
          `UPDATE template_settings 
           SET template_name = '80mm', config = ?, updated_at = datetime('now', '+5 hours', '30 minutes')
           WHERE document_type = ?`,
          [defaultConfig, documentType],
          function (err) {
            if (err) reject(err);
            else resolve({ success: true, message: 'Settings reset to default' });
          }
        );
      });
    } catch (error) {
      console.error('Error resetting template settings:', error);
      return { success: false, message: error.message };
    }
  });

  // Generate Preview (No DB Save)
  ipcMain.handle('template:generate-preview', async (event, { data, templateName, config }) => {
    try {
      const { generateSalesOrderPDF, generatePurchaseOrderPDF, generateGSTInvoicePDF, generateNonGSTInvoicePDF } = await import('../utils/pdfGenerator.js');
      
      // Check if this is a barcode label roll template
      if (templateName === 'LabelRoll') {
        console.log('🎯 Generating barcode labels for template:', templateName);
        const { generateThermalLabelPDF } = await import('../utils/pdf/barcodeLabelPDF.js');
        
        // Settings page sends data as a sales order mock, we need to extract items
        const products = (data.items || []).map(item => ({
          product_name: item.product_name || item.productName || 'Demo Product',
          product_code: item.product_code || item.productCode || 'DEMO001',
          barcode: item.barcode || item.productCode || '12345678',
          selling_price: item.unit_price || item.unitPrice || 0,
          labelQuantity: 1
        }));

        const pdfResult = await generateThermalLabelPDF(products, config);
        const pdfBuffer = pdfResult.buffer || pdfResult;
        console.log('✅ Barcode PDF generated successfully, buffer size:', pdfBuffer?.length);
        return { success: true, data: pdfBuffer, dimensions: pdfResult.dimensions };
      }

      // Check if this is an A4 GST or Non-GST invoice template
      if (templateName === 'A4-GST' || templateName === 'A4-NonGST') {
        console.log('🎯 Generating invoice PDF for template:', templateName);
        let pdfResult;
        try {
          if (templateName === 'A4-GST') {
            pdfResult = await generateGSTInvoicePDF(data, config);
          } else {
            pdfResult = await generateNonGSTInvoicePDF(data, config);
          }
          const pdfBuffer = pdfResult.buffer || pdfResult;
          console.log('✅ Invoice PDF generated successfully, buffer size:', pdfBuffer?.length);
          return { success: true, data: pdfBuffer };
        } catch (invoiceError) {
          console.error('❌ Error generating invoice PDF:', invoiceError);
          console.error('Invoice data:', JSON.stringify(data, null, 2));
          throw invoiceError;
        }
      }
      
      // Pass the temporary config to the generator
      // We merge it into the data object or pass as a separate arg. 
      // Let's pass it as a separate arg to generateSalesOrderPDF.
      // Note: We need to update pdfGenerator.js to accept this config.
      
      let pdfBuffer;
      // Infer document type from data or check templateSettings in DB if not provided
      // For now, let's assume if it has 'po_number' it's a PO
      if (data.po_number || (data.documentType === 'purchase_order')) {
          const pdfResult = await generatePurchaseOrderPDF(data, templateName, config);
          pdfBuffer = pdfResult.buffer || pdfResult;
      } else {
        // Default to Sales Order
          const pdfResult = await generateSalesOrderPDF(data, templateName, config);
          pdfBuffer = pdfResult.buffer || pdfResult;
      }
      return { success: true, data: pdfBuffer };
    } catch (error) {
      console.error('Error generating preview:', error);
      return { success: false, message: error.message };
    }
  });

  console.log('✅ Template IPC handlers registered');
}
