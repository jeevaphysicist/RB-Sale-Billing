import { ipcMain } from 'electron';
import escpos from 'escpos';
import { globalDb } from '../Database/db.js';
import { generateEscPosCommands } from '../utils/escposGenerator.js';
import path from 'path';
import fs from 'fs';
import { exec } from 'child_process';
import util from 'util';
import os from 'os';
import { fileURLToPath } from 'url';

// Resolve __dirname shim
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize USB adapter
try {
  escpos.USB = require('escpos-usb');
} catch (e) {
  console.warn('escpos-usb not found, USB printing might fail', e);
}

const execPromise = util.promisify(exec);

// Embedded PowerShell Script for Raw Printing
const psScriptContent = `
param(
    [string]$PrinterName,
    [string]$FilePath
)

$code = @"
using System;
using System.IO;
using System.Runtime.InteropServices;

public class RawPrinterHelper
{
    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Ansi)]
    public class DOCINFOA
    {
        [MarshalAs(UnmanagedType.LPStr)]
        public string pDocName;
        [MarshalAs(UnmanagedType.LPStr)]
        public string pOutputFile;
        [MarshalAs(UnmanagedType.LPStr)]
        public string pDataType;
    }

    [DllImport("winspool.Drv", EntryPoint = "OpenPrinterA", SetLastError = true, CharSet = CharSet.Ansi, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    public static extern bool OpenPrinter([MarshalAs(UnmanagedType.LPStr)] string szPrinter, out IntPtr hPrinter, IntPtr pd);

    [DllImport("winspool.Drv", EntryPoint = "ClosePrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    public static extern bool ClosePrinter(IntPtr hPrinter);

    [DllImport("winspool.Drv", EntryPoint = "StartDocPrinterA", SetLastError = true, CharSet = CharSet.Ansi, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    public static extern bool StartDocPrinter(IntPtr hPrinter, Int32 level, [In, MarshalAs(UnmanagedType.LPStruct)] DOCINFOA di);

    [DllImport("winspool.Drv", EntryPoint = "EndDocPrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    public static extern bool EndDocPrinter(IntPtr hPrinter);

    [DllImport("winspool.Drv", EntryPoint = "StartPagePrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    public static extern bool StartPagePrinter(IntPtr hPrinter);

    [DllImport("winspool.Drv", EntryPoint = "EndPagePrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    public static extern bool EndPagePrinter(IntPtr hPrinter);

    [DllImport("winspool.Drv", EntryPoint = "WritePrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    public static extern bool WritePrinter(IntPtr hPrinter, IntPtr pBytes, Int32 dwCount, out Int32 dwWritten);

    public static bool SendFileToPrinter(string szPrinterName, string szFileName)
    {
        if (!File.Exists(szFileName)) return false;

        FileStream fs = new FileStream(szFileName, FileMode.Open);
        BinaryReader br = new BinaryReader(fs);
        Byte[] bytes = new Byte[fs.Length];
        bool bSuccess = false;
        IntPtr pUnmanagedBytes = new IntPtr(0);
        int nLength;

        nLength = Convert.ToInt32(fs.Length);
        bytes = br.ReadBytes(nLength);
        pUnmanagedBytes = Marshal.AllocCoTaskMem(nLength);
        Marshal.Copy(bytes, 0, pUnmanagedBytes, nLength);

        bSuccess = SendBytesToPrinter(szPrinterName, pUnmanagedBytes, nLength);

        Marshal.FreeCoTaskMem(pUnmanagedBytes);
        
        fs.Close();
        fs.Dispose();

        return bSuccess;
    }

    public static bool SendBytesToPrinter(string szPrinterName, IntPtr pBytes, Int32 dwCount)
    {
        Int32 dwError = 0, dwWritten = 0;
        IntPtr hPrinter = new IntPtr(0);
        DOCINFOA di = new DOCINFOA();
        bool bSuccess = false;

        di.pDocName = "RAW Document";
        di.pDataType = "RAW";

        if (OpenPrinter(szPrinterName.Normalize(), out hPrinter, IntPtr.Zero))
        {
            if (StartDocPrinter(hPrinter, 1, di))
            {
                if (StartPagePrinter(hPrinter))
                {
                    bSuccess = WritePrinter(hPrinter, pBytes, dwCount, out dwWritten);
                    EndPagePrinter(hPrinter);
                }
                EndDocPrinter(hPrinter);
            }
            ClosePrinter(hPrinter);
        }
        
        if (bSuccess == false)
        {
            dwError = Marshal.GetLastWin32Error();
        }
        return bSuccess;
    }
}
"@

Add-Type -TypeDefinition $code

try {
    $success = [RawPrinterHelper]::SendFileToPrinter($PrinterName, $FilePath)
    if ($success) {
        Write-Output "SUCCESS"
    } else {
        Write-Error "Failed to send to printer"
        exit 1
    }
} catch {
    Write-Error $_.Exception.Message
    exit 1
}
`;

export function registerPrinterHandlers(mainWindow) {
  
  // Scan System Printers
  ipcMain.handle('printer:scan-system', async () => {
      try {
          if (!mainWindow) return [];
          const printers = await mainWindow.webContents.getPrintersAsync();
          return printers.map(p => ({
              deviceName: p.name,
              systemName: p.name,
              isDefault: p.isDefault,
              status: p.status
          }));
      } catch (error) {
          console.error('System Scan Error:', error);
          return [];
      }
  });

  // Scan USB Devices
  ipcMain.handle('printer:scan-usb', async () => {
     try {
       const devices = escpos.USB.findPrinter().map(device => {
         const d = device.deviceDescriptor;
         return {
           deviceName: `USB Device (VID:${d.idVendor.toString(16)} PID:${d.idProduct.toString(16)})`,
           vendorId: `0x${d.idVendor.toString(16).toUpperCase()}`,
           productId: `0x${d.idProduct.toString(16).toUpperCase()}`
         };
       });
       
       return devices;
     } catch (error) {
       console.error('Scan Error:', error);
       return [];
     }
  });

  // Save Settings
  ipcMain.handle('printer:save-settings', async (event, settings) => {
    try {
      const { globalDb } = await import('../Database/db.js');
      const configStr = JSON.stringify(settings);
      
      await new Promise((resolve, reject) => {
        globalDb.get("SELECT * FROM settings WHERE key = 'printer_config'", [], (err, row) => {
            if (err) return reject(err);
            if (row) {
                globalDb.run("UPDATE settings SET value = ? WHERE key = 'printer_config'", [configStr], (err) => {
                    if (err) reject(err); else resolve();
                });
            } else {
                 globalDb.run("INSERT INTO settings (key, value) VALUES (?, ?)", ['printer_config', configStr], (err) => {
                    if (err) reject(err); else resolve();
                });
            }
        });
      });
      return { success: true };
    } catch (error) {
      console.error('Save Settings Error:', error);
      return { success: false, message: error.message };
    }
  });

  // Get Settings
  ipcMain.handle('printer:get-settings', async () => {
     try {
      const { globalDb } = await import('../Database/db.js');
      const row = await new Promise((resolve, reject) => {
          globalDb.get("SELECT value FROM settings WHERE key = 'printer_config'", [], (err, row) => {
             if (err) resolve(null); else resolve(row);
          });
      });
      
      if (row && row.value) {
          return JSON.parse(row.value);
      }
      return null;
     } catch (error) {
         return null;
     }
  });

  // Test Print
  ipcMain.handle('printer:test-print', async () => {
      try {
        const { globalDb } = await import('../Database/db.js');
        const row = await new Promise((resolve, reject) => {
            globalDb.get("SELECT value FROM settings WHERE key = 'printer_config'", [], (err, row) => {
               if (err) resolve(null); else resolve(row);
            });
        });

        if (!row || !row.value) throw new Error('Printer not configured');
        const config = JSON.parse(row.value);
        
        if (config.type === 'system') {
           // System Printer Test
           const testContent = "Test Print via System Driver\r\n--------------------------------\r\nSuccess!\r\n\r\n\x1D\x56\x42";
           
           const tempPath = path.join(os.tmpdir(), `test_print_${Date.now()}.bin`);
           fs.writeFileSync(tempPath, testContent);
           
           const psScriptPath = path.join(os.tmpdir(), `printRaw_${Date.now()}.ps1`);
           fs.writeFileSync(psScriptPath, psScriptContent);

           const cmd = `powershell -ExecutionPolicy Bypass -File "${psScriptPath}" -PrinterName "${config.systemName}" -FilePath "${tempPath}"`;
           
           console.log('Executing:', cmd);
           await execPromise(cmd);
           
           setTimeout(() => {
                try { 
                    fs.unlinkSync(tempPath); 
                    fs.unlinkSync(psScriptPath);
                } catch (e) {}
           }, 2000);
           return { success: true, message: 'Sent to system printer' };

        } else {
             // USB Direct Test
            let device;
            if (config.vid && config.pid) {
                const vid = parseInt(config.vid, 16);
                const pid = parseInt(config.pid, 16);
                device = new escpos.USB(vid, pid);
            } else {
                device = new escpos.USB();
            }

            const printer = new escpos.Printer(device);
            
            await new Promise((resolve, reject) => {
                device.open((error) => {
                    if (error) {
                        reject(error);
                        return;
                    }
                    printer
                    .text('Test Print via USB Direct')
                    .text('--------------------------------')
                    .feed(3)
                    .cut()
                    .close();
                    resolve();
                });
            });
            return { success: true, message: 'Test print sent to USB' };
        }
      } catch (error) {
          return { success: false, message: error.message };
      }
  });
  
  // Print ESC/POS
  ipcMain.handle('printer:print-escpos', async (event, orderId) => {
    try {
      console.log('🖨️ Starting ESC/POS print for Order ID:', orderId);
      
      const { globalDb } = await import('../Database/db.js');
      if (!globalDb) throw new Error('Database not initialized');

      // 0. Get Printer Config
      const settingsRow = await new Promise((resolve) => {
          globalDb.get("SELECT value FROM settings WHERE key = 'printer_config'", [], (err, row) => {
             if (err) resolve(null); else resolve(row);
          });
      });
      
      const config = (settingsRow && settingsRow.value) ? JSON.parse(settingsRow.value) : {};
      
      // 1. Fetch Order Data
       const order = await new Promise((resolve, reject) => {
         globalDb.get(`SELECT * FROM sales_orders WHERE id = ?`, [orderId], (err, row) => {
           if (err) reject(err); else resolve(row);
         });
       });
       if (!order) throw new Error('Order not found');

       const items = await new Promise((resolve, reject) => {
         globalDb.all(`SELECT * FROM sales_order_items WHERE order_id = ?`, [orderId], (err, rows) => {
           if (err) reject(err); else resolve(rows || []);
         });
       });

       const totals = await new Promise((resolve, reject) => {
         globalDb.get(`SELECT * FROM sales_order_totals WHERE order_id = ?`, [orderId], (err, row) => {
           if (err) reject(err); else resolve(row);
         });
       });

       const paymentRecords = await new Promise((resolve, reject) => {
         globalDb.all(`SELECT * FROM payment_records WHERE record_type = 'sales' AND reference_id = ?`, [orderId], (err, rows) => {
           if (err) reject(err); else resolve(rows || []);
         });
       });
       const totalPaid = paymentRecords.reduce((sum, record) => sum + (record.payment_amount || 0), 0);
       
       const fullOrder = {
         id: order.id,
         orderNumber: order.order_number,
         orderDate: order.order_date,
         orderTime: order.order_time,
         customer: { name: order.customer_name },
         storeDetails: { 
             store: order.store_name,
             cashier: order.cashier_name,
             address: '', 
             phone: ''
         },
         items: items.map(item => ({
             productName: item.product_name,
             quantity: item.quantity,
             unitPrice: item.unit_price,
             finalAmount: item.final_amount
         })),
         calculations: {
             subtotal: totals?.subtotal || 0,
             billDiscountAmount: totals?.bill_discount_amount || 0,
             taxDetails: { totalTaxAmount: totals?.total_tax_amount || 0 },
             roundOffAmount: totals?.round_off_amount || 0,
             grandTotal: totals?.grand_total || 0
         },
         payment: {
             receivedAmount: totalPaid,
             balanceAmount: (totals?.grand_total || 0) - totalPaid,
             paymentMethod: order.payment_method
         }
       };

       // Store Details
       const storeSettingsRes = await new Promise((resolve) => {
           globalDb.all("SELECT * FROM store_settings", [], (err, rows) => {
               if (err) resolve([]); else resolve(rows);
           });
       });
       const storeDetails = {};
       storeSettingsRes.forEach(row => { storeDetails[row.key] = row.value; });
       if (storeDetails.store_name) fullOrder.storeDetails.store = storeDetails.store_name;
       if (storeDetails.address_line1) fullOrder.storeDetails.address = storeDetails.address_line1 + (storeDetails.city ? `, ${storeDetails.city}` : '');
       if (storeDetails.phone) fullOrder.storeDetails.phone = storeDetails.phone;

       if (config.type === 'system') {
           // Generate Buffer
           const bufferChunks = [];
           const mockDevice = {
               open: (cb) => cb(),
               write: (data, cb) => {
                   bufferChunks.push(data);
                   if (cb) cb();
               },
               close: (cb) => { if (cb) cb(); },
               read: (cb) => {} 
           };
           
           await generateEscPosCommands(mockDevice, fullOrder);
           // Force a small delay or extra bytes if needed, but generator should be enough.
           
           const fullBuffer = Buffer.concat(bufferChunks);
           
           const tempPath = path.join(os.tmpdir(), `print_${Date.now()}.bin`);
           fs.writeFileSync(tempPath, fullBuffer);

           const psScriptPath = path.join(os.tmpdir(), `printRaw_${Date.now()}.ps1`);
           fs.writeFileSync(psScriptPath, psScriptContent);

           const cmd = `powershell -ExecutionPolicy Bypass -File "${psScriptPath}" -PrinterName "${config.systemName}" -FilePath "${tempPath}"`;
           
           console.log('Sending to System Printer:', config.systemName);
           await execPromise(cmd);
           
           setTimeout(() => { 
             try { 
                 fs.unlinkSync(tempPath); 
                 fs.unlinkSync(psScriptPath);
             } catch(e){} 
           }, 2000);

           return { success: true, message: 'Printed to system printer' };

       } else {
           // USB Direct Fallback
           let device;
           if (config.vid && config.pid) {
                const vid = parseInt(config.vid, 16);
                const pid = parseInt(config.pid, 16);
                device = new escpos.USB(vid, pid);
           } else {
                device = new escpos.USB();
           }
           await generateEscPosCommands(device, fullOrder);
           return { success: true, message: 'Printed to USB' };
       }

    } catch (error) {
      console.error('❌ Print Error:', error);
      return { success: false, message: error.message };
    }
  });

  ipcMain.handle('printer:generate-preview', async (event, { orderData, settings }) => {
    try {
      const { generateSalesOrderPDF } = await import('../utils/pdfGenerator.js');
      
      let templateType = settings.pageSize || '80mm';
      
      // If A4 is selected in printer settings, we must sync with the specialized A4 template (GST/Non-GST)
      // configured in template settings to ensure the preview is accurate.
      if (templateType === 'A4') {
        const templateSetting = await new Promise((resolve) => {
          globalDb.get(
            `SELECT template_name FROM template_settings WHERE document_type = 'sales_order'`,
            (err, row) => resolve(row)
          );
        });
        
        // If a specialized A4 template is active, use it
        if (templateSetting && (templateSetting.template_name === 'A4-GST' || templateSetting.template_name === 'A4-NonGST')) {
          templateType = templateSetting.template_name;
        }
      }

      const pdfResult = await generateSalesOrderPDF(orderData, templateType, settings);
      
      // Extract buffer from result (it returns object { buffer, height, width })
      const pdfBuffer = pdfResult.buffer || pdfResult;
      
      // Return as Base64 string
      return pdfBuffer.toString('base64');
    } catch (error) {
      console.error('Preview Generation Error:', error);
      throw error;
    }
  });


  // Print PDF Silently
  ipcMain.handle('printer:print-pdf', async (event, { pdfData, settings }) => {
    let tempPdfPath = null;
    let workerWindow = null;

    try {
      console.log('🖨️ Starting Silent PDF Print...');
      const { BrowserWindow } = await import('electron');

      // Write PDF to temporary file instead of using data URL
      // Data URLs don't render properly in BrowserWindow for PDF printing
      tempPdfPath = path.join(os.tmpdir(), `print_${Date.now()}.pdf`);
      const pdfBuffer = Buffer.from(pdfData, 'base64');
      fs.writeFileSync(tempPdfPath, pdfBuffer);
      console.log('PDF written to:', tempPdfPath);

      // Create a hidden window for printing
      workerWindow = new BrowserWindow({
        show: false,
        backgroundColor: '#FFFFFF', // Force white background for the window itself
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true,
          plugins: true // Enable PDF plugin
        }
      });

      // Load PDF file into window
      const fileUrl = `file:///${tempPdfPath.replace(/\\/g, '/')}`;
      console.log('Loading PDF from:', fileUrl);
      await workerWindow.loadURL(fileUrl);

      // Wait for PDF to fully render
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Define print options
      const printOptions = {
        silent: true,
        printBackground: settings.printBackground !== undefined ? settings.printBackground : false,
        color: true, // Ensure color printing is enabled
        deviceName: settings.deviceName,
        copies: settings.copies || 1,
      };

      if (settings.scaleFactor) {
        let scale = parseInt(settings.scaleFactor);
        // Robustness: If scale is 1-5, treat as 100-500%
        if (scale >= 1 && scale <= 5) scale = scale * 100;
        printOptions.scaleFactor = scale || 100;
      }
      
      // Handle page size - convert thermal sizes to custom dimensions
      if (settings.pageSize) {
        // Calculate dynamic height if provided (1 point = ~352.8 microns)
        // Add 10mm buffer (10000 microns) to ensure safe cutting
        let customHeight = 297000; // Default A4 length
        
        if (settings.contentHeight) {
          // For LabelRoll (Barcode Roll), we need EXACT height to match sensors (no buffer).
          // For Receipt rolls (80mm etc), we add 10mm buffer to ensure safe cutting.
          const buffer = (settings.pageSize === 'LabelRoll') ? 0 : 10000;
          customHeight = Math.ceil(settings.contentHeight * 352.8) + buffer;
          console.log(`Using dynamic thermal height: ${customHeight} microns (from ${settings.contentHeight} points) with ${buffer/1000}mm buffer`);
        }

        if (settings.pageSize === '80mm') {
          // 80mm thermal printer: width=80mm in microns
          printOptions.pageSize = {
            width: 80000,
            height: customHeight
          };
        } else if (settings.pageSize === '72mm') {
          // 72mm thermal printer
          printOptions.pageSize = {
            width: 72000,
            height: customHeight
          };
        } else if (settings.pageSize === 'LabelRoll') {
          // TVS/Barcode Roll: 105mm width, dynamic height
          printOptions.pageSize = {
            width: 105000,
            height: customHeight
          };
        } else if (settings.pageSize === '50mm') {
          // 50mm thermal printer
          printOptions.pageSize = {
            width: 50000,
            height: customHeight
          };
        } else {
          // Standard paper sizes (A4, Letter, Legal, etc.)
          // Sanitize specialized A4 templates for Electron (it only knows 'A4')
          let finalPageSize = settings.pageSize;
          if (finalPageSize === 'A4-GST' || finalPageSize === 'A4-NonGST') {
            finalPageSize = 'A4';
          }
          printOptions.pageSize = finalPageSize;
        }
      }

      // Thermal printers are always portrait (ignore landscape setting)
      
      
      // Handle vertical alignment by adjusting margins
      // Optimized for thermal printers (80mm, 72mm, 50mm) with continuous paper
      let topMargin = settings.margins?.top || 0;
      let bottomMargin = settings.margins?.bottom || 0;
      let leftMargin = settings.margins?.left || 0;
      let rightMargin = settings.margins?.right || 0;

      // Margins configuration
      // For thermal printers, 'top' alignment MUST use marginType: 'none' to prevent centering
      if (settings.verticalAlign === 'top') {
        // Use 'none' to eliminate all default margins and force top alignment
        // This prevents Electron from centering content on thermal paper
        printOptions.margins = {
          marginType: 'none'
        };
      } else {
        // For center and bottom, use custom margins
        if (settings.verticalAlign === 'center') {
          topMargin = Math.max(topMargin, 5); // 5mm minimum spacing
        } else if (settings.verticalAlign === 'bottom') {
          topMargin = Math.max(topMargin, 10); // 10mm spacing
        }
        
        printOptions.margins = {
          marginType: 'custom',
          top: topMargin,
          bottom: bottomMargin,
          left: leftMargin,
          right: rightMargin
        };
      }

      console.log('Print options:', printOptions);

      // Execute Print
      return new Promise((resolve, reject) => {
        workerWindow.webContents.print(printOptions, (success, errorType) => {
          // Clean up
          if (workerWindow) {
            workerWindow.close();
            workerWindow = null;
          }
          
          // Delete temp file after a delay
          setTimeout(() => {
            try {
              if (tempPdfPath && fs.existsSync(tempPdfPath)) {
                fs.unlinkSync(tempPdfPath);
                console.log('Temp PDF deleted');
              }
            } catch (e) {
              console.error('Failed to delete temp PDF:', e);
            }
          }, 2000);

          if (!success) {
            console.error('Print Failed:', errorType);
            resolve({ success: false, message: errorType });
          } else {
            console.log('✅ Print Success');
            resolve({ success: true });
          }
        });
      });

    } catch (error) {
      console.error('Print PDF Error:', error);
      
      // Clean up on error
      if (workerWindow) {
        workerWindow.close();
      }
      if (tempPdfPath && fs.existsSync(tempPdfPath)) {
        try {
          fs.unlinkSync(tempPdfPath);
        } catch (e) {}
      }
      
      return { success: false, message: error.message };
    }
  });

  // Save PDF to Temp File
  ipcMain.handle('printer:save-temp-pdf', async (event, pdfData) => {
    try {
      const tempPdfPath = path.join(os.tmpdir(), `print_${Date.now()}.pdf`);
      const pdfBuffer = Buffer.from(pdfData, 'base64');
      await fs.promises.writeFile(tempPdfPath, pdfBuffer);
      console.log('✅ PDF saved to temp:', tempPdfPath);
      return { success: true, filePath: tempPdfPath };
    } catch (error) {
      console.error('Save Temp PDF Error:', error);
      return { success: false, message: error.message };
    }
  });

  // Print PDF from File
  ipcMain.handle('printer:print-pdf-file', async (event, { filePath, settings }) => {
    let workerWindow = null;
    try {
      console.log('🖨️ Starting Print from File:', filePath);
      
      if (!fs.existsSync(filePath)) {
        throw new Error('File not found: ' + filePath);
      }

      const { BrowserWindow } = await import('electron');

      // Create a hidden window for printing
      workerWindow = new BrowserWindow({
        show: false,
        backgroundColor: '#FFFFFF', 
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true,
          plugins: true 
        }
      });

      // Load PDF file into window
      const fileUrl = `file:///${filePath.replace(/\\/g, '/')}`;
      console.log('Loading PDF from:', fileUrl);
      await workerWindow.loadURL(fileUrl);

      // Wait for PDF to fully render
      // Increased delay to ensure improved reliability
      await new Promise(resolve => setTimeout(resolve, 4000));

      // Define print options
      const printOptions = {
        silent: true,
        printBackground: settings.printBackground !== undefined ? settings.printBackground : false, // Default to false for PDFs
        color: settings.color !== undefined ? settings.color : true,
        deviceName: settings.deviceName,
        copies: settings.copies || 1,
      };

      if (settings.landscape) printOptions.landscape = true;

      if (settings.scaleFactor) {
        let scale = parseInt(settings.scaleFactor);
        // Robustness: If scale is 1-5, treat as 100-500%
        if (scale >= 1 && scale <= 5) scale = scale * 100;
        printOptions.scaleFactor = scale || 100;
      }
      
      // Handle page size
      if (settings.pageSize) {
        let customHeight = 297000; 
        
        if (settings.contentHeight) {
          const buffer = (settings.pageSize === 'LabelRoll') ? 0 : 10000;
          customHeight = Math.ceil(settings.contentHeight * 352.8) + buffer;
        }

        const widthMap = {
          '80mm': 80000,
          '72mm': 72000,
          '50mm': 50000,
          'LabelRoll': 105000
        };

        if (widthMap[settings.pageSize]) {
          printOptions.pageSize = { width: widthMap[settings.pageSize], height: customHeight };
        } else {
            let finalPageSize = settings.pageSize;
            if (finalPageSize === 'A4-GST' || finalPageSize === 'A4-NonGST') finalPageSize = 'A4';
            printOptions.pageSize = finalPageSize;
        }
      }

      // Margins - Optimized for Thermal Printers
      const isThermal = ['80mm', '72mm', '50mm', 'LabelRoll'].includes(settings.pageSize);
      
      if (isThermal && settings.verticalAlign === 'top') {
        // 'top' alignment on thermal rolls works best with 'none'
        printOptions.margins = { marginType: 'none' };
      } else {
        let topMargin = settings.margins?.top || 0;
        let bottomMargin = settings.margins?.bottom || 0;
        let leftMargin = settings.margins?.left || 0;
        let rightMargin = settings.margins?.right || 0;

        // Apply alignment adjustments
        if (settings.verticalAlign === 'center') topMargin = Math.max(topMargin, 5);
        else if (settings.verticalAlign === 'bottom') topMargin = Math.max(topMargin, 10);
        
        printOptions.margins = {
          marginType: 'custom',
          top: topMargin,
          bottom: bottomMargin,
          left: leftMargin,
          right: rightMargin
        };
      }

      console.log('Print options:', printOptions);

      // Execute Print
      return new Promise((resolve, reject) => {
        workerWindow.webContents.print(printOptions, (success, errorType) => {
          if (workerWindow) {
            workerWindow.close();
            workerWindow = null;
          }
          // Delete temp file after a delay to ensure printer spooler is done
          if (filePath && fs.existsSync(filePath)) {
            setTimeout(() => {
              try {
                fs.unlinkSync(filePath);
                console.log('✅ Temp PDF deleted:', filePath);
              } catch (e) {
                console.warn('Failed to delete temp PDF:', e.message);
              }
            }, 5000); // 5 second buffer to be safe
          }

          if (!success) {
            console.error('Print Failed:', errorType);
            resolve({ success: false, message: errorType });
          } else {
            console.log('✅ Print Success');
            resolve({ success: true });
          }
        });
      });

    } catch (error) {
      console.error('Print PDF File Error:', error);
      if (workerWindow) workerWindow.close();
      
      // Cleanup file if it exists even on error
      if (filePath && fs.existsSync(filePath)) {
        try { fs.unlinkSync(filePath); } catch (e) {}
      }
      
      return { success: false, message: error.message };
    }
  });

  // Print PDF Silently

  console.log('✅ Printer IPC handlers registered');
}
