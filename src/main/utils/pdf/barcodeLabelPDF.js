/**
 * Thermal Label PDF Generator for LP45 LITE Barcode Printer
 * 
 * Specifications:
 * - Printer: LP45 LITE, 203 DPI
 * - Roll Width: 105mm (fixed)
 * - Label Size: 25mm × 25mm (fixed)
 * - Labels Per Row: 4 (fixed)
 * - Barcode: Code128 (vector graphics)
 * - Scaling: 100% only (no fit-to-page)
 */

import PDFDocument from 'pdfkit';
import bwipjs from 'bwip-js';

// === CONSTANTS ===
// Precise conversion: 1 inch = 25.4mm, 1 inch = 72 points
const MM_TO_PT = 72 / 25.4; 
// 1mm ~ 2.834645669... points

// Fixed printer specifications (LP45 LITE)
const PRINTER_CONFIG = {
  ROLL_WIDTH_MM: 105,
  LABEL_WIDTH_MM: 25,
  LABEL_HEIGHT_MM: 25,
  LABELS_PER_ROW: 4,
  DPI: 203
};

// Convert to PDF points
const LABEL_WIDTH_PT = PRINTER_CONFIG.LABEL_WIDTH_MM * MM_TO_PT;
const LABEL_HEIGHT_PT = PRINTER_CONFIG.LABEL_HEIGHT_MM * MM_TO_PT;
const ROLL_WIDTH_PT = PRINTER_CONFIG.ROLL_WIDTH_MM * MM_TO_PT;

/**
 * Generate thermal label PDF for LP45 LITE printer
 * 
 * @param {Array} products - Array of product objects with labelQuantity
 * @param {Object} settings - Label configuration settings
 * @param {number} settings.gap - Gap between labels in mm (default: 2)
 * @param {boolean} settings.showName - Show product name (default: true)
 * @param {boolean} settings.showPrice - Show price (default: true)
 * @param {boolean} settings.showBarcodeText - Show barcode value text (default: true)
 * @param {number} settings.fontSize - Font size in points (5-7, default: 6)
 * @param {boolean} settings.showBorder - Show label borders for testing (default: false)
 * @returns {Promise<{buffer: Buffer, dimensions: Object}>}
 */
export const generateThermalLabelPDF = async (products, settings = {}) => {
  return new Promise(async (resolve, reject) => {
    try {
      // === SETTINGS ===
      const {
        gap = 1.5, // mm (Fits 4x25mm labels on 105mm roll: 100 + 3*1.5 = 104.5mm)
        showName = true,
        showPrice = true,
        showBarcodeText = true,
        fontSize = 6, // pt
        showBorder = false
      } = settings;

      // Validate fontSize range
      const validFontSize = Math.max(5, Math.min(7, fontSize));

      // === FLATTEN PRODUCTS BY QUANTITY ===
      const labels = [];
      products.forEach(product => {
        const quantity = product.labelQuantity || 1;
        for (let i = 0; i < quantity; i++) {
          labels.push({
            productName: product.product_name || '',
            price: product.selling_price || 0,
            barcode: product.barcode || product.product_code || '',
            sku: product.product_code || ''
          });
        }
      });

      if (labels.length === 0) {
        throw new Error('No labels to generate');
      }

      // === CALCULATE DIMENSIONS ===
      const gapPt = gap * MM_TO_PT;
      const numRows = Math.ceil(labels.length / PRINTER_CONFIG.LABELS_PER_ROW);
      
      // Page dimensions
      const pageWidth = ROLL_WIDTH_PT; // Fixed to roll width
      const pageHeight = (numRows * LABEL_HEIGHT_PT) + ((numRows - 1) * gapPt);
      
      // No margins for thermal printing
      const margin = 0;

      console.log(`📋 Thermal Label PDF Generation:`);
      console.log(`   - Labels: ${labels.length} (${numRows} rows × ${PRINTER_CONFIG.LABELS_PER_ROW} cols)`);
      console.log(`   - Page: ${(pageWidth / MM_TO_PT).toFixed(1)}mm × ${(pageHeight / MM_TO_PT).toFixed(1)}mm`);
      console.log(`   - Label: ${PRINTER_CONFIG.LABEL_WIDTH_MM}mm × ${PRINTER_CONFIG.LABEL_HEIGHT_MM}mm`);
      console.log(`   - Gap: ${gap}mm`);

      // === CREATE PDF DOCUMENT ===
      const doc = new PDFDocument({
        autoFirstPage: false,
        margin: margin,
        size: [pageWidth, pageHeight],
        bufferPages: true
      });

      const buffers = [];
      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => {
        const pdfData = Buffer.concat(buffers);
        resolve({
          buffer: pdfData,
          dimensions: {
            width: pageWidth,
            height: pageHeight,
            widthMM: pageWidth / MM_TO_PT,
            heightMM: pageHeight / MM_TO_PT,
            labelCount: labels.length,
            rows: numRows
          }
        });
      });

      // Add single page (thermal roll is continuous)
      doc.addPage({
        size: [pageWidth, pageHeight],
        margin: margin
      });

      // White background
      doc.rect(0, 0, pageWidth, pageHeight).fill('#FFFFFF');
      doc.fillColor('#000000');

      // === RENDER LABELS ===
      for (let i = 0; i < labels.length; i++) {
        const label = labels[i];
        
        // Calculate grid position
        const column = i % PRINTER_CONFIG.LABELS_PER_ROW;
        const row = Math.floor(i / PRINTER_CONFIG.LABELS_PER_ROW);
        
        // Calculate exact X, Y coordinates
        // labelsAreaWidth = (LABELS_PER_ROW * LABEL_WIDTH_PT) + ((LABELS_PER_ROW - 1) * gapPt)
        const labelsAreaWidth = (PRINTER_CONFIG.LABELS_PER_ROW * LABEL_WIDTH_PT) + ((PRINTER_CONFIG.LABELS_PER_ROW - 1) * gapPt);
        
        // Horizontal centering offset
        const offsetX = Math.max(0, (ROLL_WIDTH_PT - labelsAreaWidth) / 2);
        
        const x = offsetX + (column * (LABEL_WIDTH_PT + gapPt));
        const y = row * (LABEL_HEIGHT_PT + gapPt);

        // Optional border for testing
        if (showBorder) {
          doc.lineWidth(0.5)
            .strokeColor('#cccccc')
            .rect(x, y, LABEL_WIDTH_PT, LABEL_HEIGHT_PT)
            .stroke();
          doc.fillColor('#000000');
        }

        // Content padding
        const paddingX = 2 * MM_TO_PT; // 2mm horizontal padding
        const paddingY = 1 * MM_TO_PT; // 1mm vertical padding
        const contentWidth = LABEL_WIDTH_PT - (2 * paddingX);
        
        let contentY = y + paddingY;

        // === 1. PRODUCT NAME (Optional, max 2 lines) ===
        if (showName && label.productName) {
          doc.font('Courier')
            .fontSize(validFontSize)
            .text(label.productName, x + paddingX, contentY, {
              width: contentWidth,
              height: validFontSize * 2.2, // Max 2 lines
              align: 'center',
              ellipsis: true,
              lineGap: 0
            });
          contentY += validFontSize * 2.5; // Move down
        }

        // === 2. BARCODE (Mandatory, Vector Graphics) ===
        const barcodeValue = label.barcode || label.sku || '000000';
        
        try {
          // Generate barcode as PNG buffer using bwip-js
          const barcodeBuffer = await bwipjs.toBuffer({
            bcid: 'code128',           // Code128 format (fixed)
            text: barcodeValue,        // Barcode value
            scale: 3,                  // High resolution scale
            height: 10,                // 10mm barcode height
            includetext: showBarcodeText, // Show text below barcode
            textxalign: 'center',      // Center text
            textsize: validFontSize,   // Font size for barcode text
            textmargin: 2,             // Margin between bars and text
            backgroundcolor: 'ffffff', // White background
            barcolor: '000000'         // Black bars
          });

          // Calculate barcode dimensions (80-85% of label width)
          const barcodeWidth = contentWidth * 0.85;
          const barcodeHeight = 10 * MM_TO_PT; // 10mm height
          const barcodeX = x + paddingX + ((contentWidth - barcodeWidth) / 2); // Center horizontally

          // Embed barcode image
          doc.image(barcodeBuffer, barcodeX, contentY, {
            width: barcodeWidth,
            height: barcodeHeight,
            fit: [barcodeWidth, barcodeHeight],
            align: 'center'
          });

          contentY += barcodeHeight + (1 * MM_TO_PT);
        } catch (barcodeError) {
          console.error(`❌ Barcode generation failed for "${barcodeValue}":`, barcodeError.message);
          // Fallback: Display error text
          doc.font('Courier')
            .fontSize(5)
            .fillColor('#ff0000')
            .text(`Barcode Error: ${barcodeValue}`, x + paddingX, contentY, {
              width: contentWidth,
              align: 'center'
            });
          doc.fillColor('#000000');
          contentY += 6 * MM_TO_PT;
        }

        // === 3. PRICE (Optional) ===
        if (showPrice) {
          const priceText = `Rs.${parseFloat(label.price || 0).toFixed(2)}`;
          doc.font('Courier-Bold')
            .fontSize(validFontSize + 1) // Slightly larger for price
            .text(priceText, x + paddingX, contentY, {
              width: contentWidth,
              align: 'center'
            });
        }

        // Check for content overflow (debugging)
        const labelBottom = y + LABEL_HEIGHT_PT;
        if (contentY > labelBottom) {
          console.warn(`⚠️  Label ${i + 1}: Content overflow detected (${((contentY - labelBottom) / MM_TO_PT).toFixed(1)}mm)`);
        }
      }

      // Finalize PDF
      doc.end();

    } catch (error) {
      console.error('❌ Thermal Label PDF Generation Error:', error);
      reject(error);
    }
  });
};

/**
 * Validate barcode value for Code128 format
 * 
 * @param {string} value - Barcode value to validate
 * @returns {{valid: boolean, error?: string}}
 */
export const validateBarcodeValue = (value) => {
  if (!value || value.trim() === '') {
    return { valid: false, error: 'Barcode value is required' };
  }

  if (value.length < 4) {
    return { valid: false, error: 'Barcode too short (min 4 characters)' };
  }

  if (value.length > 80) {
    return { valid: false, error: 'Barcode too long (max 80 characters)' };
  }

  // Code128 supports ASCII characters
  // Restrict to alphanumeric and common symbols for safety
  const validPattern = /^[A-Z0-9\-_.\/\s]+$/i;
  if (!validPattern.test(value)) {
    return { valid: false, error: 'Invalid characters (use A-Z, 0-9, -, _, ., /, space)' };
  }

  return { valid: true };
};

/**
 * Auto-generate barcode from SKU if missing
 * 
 * @param {string} sku - Product SKU/code
 * @returns {string} - Generated barcode value
 */
export const generateBarcodeFromSKU = (sku) => {
  if (!sku || sku.trim() === '') {
    // Generate random 12-digit barcode
    return Math.floor(100000000000 + Math.random() * 900000000000).toString();
  }
  
  // Use SKU as-is if valid
  const validation = validateBarcodeValue(sku);
  if (validation.valid) {
    return sku;
  }
  
  // Sanitize SKU to make it valid
  const sanitized = sku
    .toUpperCase()
    .replace(/[^A-Z0-9\-_.\/]/g, '') // Remove invalid characters
    .substring(0, 80); // Limit length
  
  return sanitized || Math.floor(100000000000 + Math.random() * 900000000000).toString();
};
