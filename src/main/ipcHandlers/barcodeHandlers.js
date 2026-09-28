import { ipcMain, BrowserWindow } from 'electron';
import { generateBarcodePDF } from '../utils/pdfGenerator.js';
import fs from 'fs';
import path from 'path';
import os from 'os';

export function initializeBarcodeHandlers(db) {
  console.log('✅ Barcode handlers initialized');

  // Generate Barcode PDF
  ipcMain.handle('barcode:generate-pdf', async (event, { products, settings, preview = false }) => {
    try {
      console.log('📥 Generating barcode PDF for', products.length, 'products');
      
      const { buffer: pdfBuffer, height } = await generateBarcodePDF(products, settings);
      
      // Save to temp file
      const tempDir = os.tmpdir();
      const fileName = `barcode-${Date.now()}.pdf`;
      const filePath = path.join(tempDir, fileName);
      
      await fs.promises.writeFile(filePath, pdfBuffer);
      console.log('✅ PDF saved to:', filePath);

      if (preview) {
        // Return buffer for preview (matching sales order pattern)
        return { success: true, filePath, pdfData: pdfBuffer, height };
      }
      
      // If not preview, trigger print immediately
      await printPDF(filePath);
      
      return { success: true, filePath };
      
    } catch (error) {
      console.error('❌ Barcode PDF generation error:', error);
      return { success: false, message: 'Failed to generate barcode PDF: ' + error.message };
    }
  });

  // Print existing PDF file
  ipcMain.handle('barcode:print-file', async (event, filePath) => {
    try {
      await printPDF(filePath);
      return { success: true };
    } catch (error) {
       console.error('❌ Print error:', error);
       return { success: false, message: error.message };
    }
  });

  // Start background PDF generation
  ipcMain.handle('barcode:start-generation', async (event, { products, settings }) => {
    // Start background process without blocking return
    Promise.resolve().then(async () => {
        try {
            console.log('🔄 Starting background generation for', products.length, 'products');
            const { buffer: pdfBuffer, height } = await generateBarcodePDF(products, settings);
            const tempDir = os.tmpdir();
            const fileName = `barcode-job-${Date.now()}.pdf`;
            const filePath = path.join(tempDir, fileName);
            await fs.promises.writeFile(filePath, pdfBuffer);
            console.log('✅ Background job finished. Saved to:', filePath);

            // Notify renderer
            if (!event.sender.isDestroyed()) {
                event.sender.send('barcode:job-completed', { 
                    success: true, 
                    filePath, 
                    height,
                    productCount: products.length 
                });
            }
        } catch (err) {
            console.error('❌ Background generation failed', err);
             if (!event.sender.isDestroyed()) {
                event.sender.send('barcode:job-completed', { success: false, message: err.message });
            }
        }
    });
    
    return { success: true, message: 'Background generation started' };
  });

  // Get PDF content for preview
  ipcMain.handle('barcode:get-pdf-content', async (event, filePath) => {
    try {
        const pdfBuffer = await fs.promises.readFile(filePath);
        return { success: true, pdfData: pdfBuffer };
    } catch (error) {
        console.error('❌ Error reading PDF content:', error);
        return { success: false, message: error.message };
    }
  });

  // ============================================
  // THERMAL LABEL HANDLERS (V2 - LP45 LITE)
  // ============================================

  // Generate thermal labels for LP45 LITE printer
  ipcMain.handle('barcode-v2:generate-labels', async (event, { products, settings }) => {
    try {
      console.log('📋 Generating thermal labels for', products.length, 'products');
      
      // Import thermal label generator
      const { generateThermalLabelPDF } = await import('../utils/pdf/barcodeLabelPDF.js');
      
      const { buffer: pdfBuffer, dimensions } = await generateThermalLabelPDF(products, settings);
      
      // Save to temp file
      const tempDir = os.tmpdir();
      const fileName = `thermal-labels-${Date.now()}.pdf`;
      const filePath = path.join(tempDir, fileName);
      
      await fs.promises.writeFile(filePath, pdfBuffer);
      console.log('✅ Thermal labels PDF saved:', filePath);
      console.log('📐 Dimensions:', dimensions);
      
      return { 
        success: true, 
        filePath, 
        pdfData: pdfBuffer,
        dimensions 
      };
      
    } catch (error) {
      console.error('❌ Thermal label generation error:', error);
      return { success: false, message: 'Failed to generate thermal labels: ' + error.message };
    }
  });

  // Print thermal labels with optimized settings
  ipcMain.handle('barcode-v2:print-labels', async (event, filePath) => {
    try {
      console.log('🖨️ Printing thermal labels:', filePath);
      await printThermalPDF(filePath);
      return { success: true };
    } catch (error) {
      console.error('❌ Thermal print error:', error);
      return { success: false, message: error.message };
    }
  });

  // Start background thermal label generation
  ipcMain.handle('barcode-v2:start-generation', async (event, { products, settings }) => {
    Promise.resolve().then(async () => {
      try {
        console.log('🔄 Starting background thermal label generation');
        const { generateThermalLabelPDF } = await import('../utils/pdf/barcodeLabelPDF.js');
        
        const { buffer: pdfBuffer, dimensions } = await generateThermalLabelPDF(products, settings);
        const tempDir = os.tmpdir();
        const fileName = `thermal-job-${Date.now()}.pdf`;
        const filePath = path.join(tempDir, fileName);
        await fs.promises.writeFile(filePath, pdfBuffer);
        
        console.log('✅ Background thermal generation completed');
        
        if (!event.sender.isDestroyed()) {
          event.sender.send('barcode-v2:job-completed', { 
            success: true, 
            filePath,
            dimensions,
            productCount: products.length,
            labelCount: dimensions.labelCount
          });
        }
      } catch (err) {
        console.error('❌ Background thermal generation failed', err);
        if (!event.sender.isDestroyed()) {
          event.sender.send('barcode-v2:job-completed', { 
            success: false, 
            message: err.message 
          });
        }
      }
    });
    
    return { success: true, message: 'Background thermal generation started' };
  });

  // Save thermal labels PDF to custom location
  ipcMain.handle('barcode-v2:save-pdf', async (event, { sourcePath, targetPath }) => {
    try {
      await fs.promises.copyFile(sourcePath, targetPath);
      console.log('✅ Thermal labels PDF saved to:', targetPath);
      return { success: true, filePath: targetPath };
    } catch (error) {
      console.error('❌ Save PDF error:', error);
      return { success: false, message: error.message };
    }
  });
}

// Helper function to print PDF
async function printPDF(filePath) {
    return new Promise((resolve, reject) => {
        const printWindow = new BrowserWindow({ 
            show: false,
            webPreferences: {
              nodeIntegration: false,
              contextIsolation: true,
              plugins: true // Enable PDF plugin to render PDF file
            }
        });
          
        const fileUrl = `file://${filePath.replace(/\\/g, '/')}`;
        console.log('🖨️ Loading print window with URL:', fileUrl);
          
        printWindow.loadURL(fileUrl).then(async () => {
             // Wait for PDF to fully render
             await new Promise(resolve => setTimeout(resolve, 2000));

             printWindow.webContents.print({ silent: false, printBackground: true }, (success, errorType) => {
                if (!success) {
                    console.error("❌ Print failed:", errorType);
                    reject(new Error("Print failed: " + errorType));
                } else {
                    console.log("✅ Print initiated successfully");
                    resolve();
                }
                // Close window after a short delay
                setTimeout(() => {
                    printWindow.close();
                }, 1000);
            });
        }).catch(err => {
            printWindow.close();
            reject(err);
        });
    });
}

// Helper function to print thermal labels (optimized for LP45 LITE)
async function printThermalPDF(filePath) {
    return new Promise((resolve, reject) => {
        const printWindow = new BrowserWindow({ 
            show: false,
            webPreferences: {
              nodeIntegration: false,
              contextIsolation: true,
              plugins: true
            }
        });
          
        const fileUrl = `file://${filePath.replace(/\\/g, '/')}`;
        console.log('🖨️ [THERMAL] Loading print window:', fileUrl);
          
        printWindow.loadURL(fileUrl).then(async () => {
             // Wait for PDF to render
             await new Promise(resolve => setTimeout(resolve, 2000));

             // Thermal printer optimized settings
             printWindow.webContents.print({
                silent: false,
                printBackground: true,
                color: false, // Black and white only for thermal
                margins: {
                  marginType: 'none' // Critical: No margins for thermal printing
                },
                // DO NOT set pageSize - let the PDF define its own dimensions
                // Setting pageSize can cause orientation issues
                scaleFactor: 100,  // Force 100% scale (no fit-to-page)
                landscape: false,  // Force portrait orientation
                preferCSSPageSize: true, // CRITICAL: Use PDF's page size, not printer default
                dpi: {
                  horizontal: 203,
                  vertical: 203
                }
             }, (success, errorType) => {
                if (!success) {
                    console.error("❌ Thermal print failed:", errorType);
                    reject(new Error("Thermal print failed: " + errorType));
                } else {
                    console.log("✅ Thermal print initiated successfully");
                    resolve();
                }
                setTimeout(() => {
                    printWindow.close();
                }, 1000);
            });
        }).catch(err => {
            printWindow.close();
            reject(err);
        });
    });
}
