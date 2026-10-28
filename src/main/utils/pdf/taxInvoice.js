import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';
import { TAMIL_FONTS, RESOURCES_PATH } from './utils.js';

// Client logo printed at the top-left of the invoice (skipped when the file is missing)
const LOGO_PATH = path.join(RESOURCES_PATH, 'invoice-logo.png');

// Generate Tax Invoice PDF (A4, green/yellow layout with bank details and GST totals)
export const generateTaxInvoicePDF = (invoiceData, config = {}) => {
  return new Promise((resolve, reject) => {
    try {
      const buffers = [];
      const doc = new PDFDocument({ size: 'A4', margin: 0, autoFirstPage: false });
      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => resolve({ buffer: Buffer.concat(buffers) }));

      // Noto Sans has the ₹ glyph; Helvetica does not
      let font = 'Helvetica';
      let fontBold = 'Helvetica-Bold';
      let rupee = 'Rs.';
      try {
        doc.registerFont('InvoiceSans', TAMIL_FONTS.NotoSansTamil.regular);
        doc.registerFont('InvoiceSansBold', TAMIL_FONTS.NotoSansTamil.bold);
        font = 'InvoiceSans';
        fontBold = 'InvoiceSansBold';
        rupee = '₹';
      } catch (error) {
        console.error('Tax invoice font fallback to Helvetica:', error);
      }

      const GREEN = '#2E9E3E';
      const YELLOW = '#F5D020';
      const LIGHT = '#DCE6F1';
      const pageWidth = 595.28;
      const pageHeight = 841.89;
      const margin = 24;
      const frameX = margin;
      const frameW = pageWidth - margin * 2;
      const pad = 14;
      const left = frameX + pad;
      const contentW = frameW - pad * 2;
      const right = left + contentW;

      const num = (value) => {
        const n = parseFloat(String(value ?? '').replace(/[^0-9.-]/g, ''));
        return Number.isFinite(n) ? n : 0;
      };
      const money = (value) =>
        `${rupee} ${num(value).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      const formatDate = (value) => {
        // A bare YYYY-MM-DD is already the local bill date; only full timestamps need converting
        const plain = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ''));
        if (plain) return `${plain[3]}-${plain[2]}-${plain[1]}`;
        const d = value ? new Date(value) : null;
        if (!d || Number.isNaN(d.getTime())) return String(invoiceData.date || '').split(' ')[0];
        return `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`;
      };

      const company = invoiceData.company || {};
      const buyer = invoiceData.buyer || {};
      const bank = config.bankDetails || {};

      // Taxable value = line total minus the GST charged on it (derived from the rate when no split is saved)
      const items = (invoiceData.items || []).map((item) => {
        const totalValue = num(item.amount);
        const rate = num(item.gst);
        const cgstAmt = num(item.cgstAmount);
        const sgstAmt = num(item.sgstAmount);
        const igstAmt = num(item.igstAmount);
        const savedTax = cgstAmt + sgstAmt + igstAmt;
        const taxable = savedTax > 0
          ? totalValue - savedTax
          : rate > 0 ? totalValue / (1 + rate / 100) : totalValue;
        return {
          description: item.description || '',
          hsn: item.hsn || '',
          unitPrice: num(item.rate),
          quantity: item.quantity ?? '',
          totalValue,
          taxable,
          rate,
          cgst: cgstAmt,
          sgst: sgstAmt,
          igst: igstAmt
        };
      });

      const subtotal = items.reduce((sum, item) => sum + item.taxable, 0);
      let cgst = items.reduce((sum, item) => sum + item.cgst, 0);
      let sgst = items.reduce((sum, item) => sum + item.sgst, 0);
      const igst = items.reduce((sum, item) => sum + item.igst, 0);
      // Lines without a CGST/SGST split (e.g. preview data) share their tax equally
      if (!cgst && !sgst && !igst) {
        const tax = items.reduce((sum, item) => sum + (item.totalValue - item.taxable), 0);
        cgst = tax / 2;
        sgst = tax / 2;
      }
      const total = num(invoiceData.total) || subtotal + cgst + sgst + igst;
      const rates = [...new Set(items.filter((item) => item.rate > 0).map((item) => item.rate))];
      const rateLabel = (divisor) => (rates.length === 1 ? ` @ ${+(rates[0] / divisor).toFixed(2)}%` : '');

      const billType = buyer.gstin ? 'B2B' : 'B2C';
      const placeOfSupply = igst > 0 ? 'Inter State' : 'Within State';

      const newPage = () => {
        doc.addPage({ size: 'A4', margin: 0 });
        doc.rect(0, 0, pageWidth, pageHeight).fill('#FFFFFF');
        doc.fillColor('#000000');
      };

      const frameTop = margin + 16;
      newPage();
      let y = frameTop + 14;

      // Row 1: logo on the left, TAX INVOICE title on the right
      // Logo is transparent and cropped, so it sits directly on the page (about 1.6 : 1)
      const logoW = fs.existsSync(LOGO_PATH) ? 62 : 0;
      const logoH = logoW ? 39 : 0;
      if (logoW) {
        doc.image(LOGO_PATH, left, y, { fit: [logoW, logoH] });
      }
      doc.font(fontBold).fontSize(15).fillColor(GREEN)
        .text(config.headerText && config.headerText !== 'Tax Invoice' ? config.headerText : 'TAX INVOICE', left, y + Math.max(0, (logoH - 18) / 2), { width: contentW, align: 'right' });
      y += logoH + (logoH ? 4 : 0);

      // Row 2: store details on the left, invoice details on the right
      const companyW = contentW * 0.56;
      doc.font(fontBold).fontSize(14).fillColor(GREEN).text((company.name || '').toUpperCase(), left, y, { width: companyW });
      let leftY = doc.y + 2;
      if (company.gstin) {
        doc.font(fontBold).fontSize(11).fillColor(GREEN).text(`GSTIN: ${company.gstin}`, left, leftY, { width: companyW });
        leftY = doc.y + 4;
      }
      doc.font(font).fontSize(10).fillColor('#000000');
      [company.address, company.address2, company.city, company.district].filter(Boolean).forEach((line) => {
        doc.text(line, left + 4, leftY, { width: companyW - 4 });
        leftY = doc.y + 1;
      });

      // Invoice details (right)
      const labelW = 105;
      const valueW = 110;
      const valueX = right - valueW;
      let rightY = y + 2;
      [
        { label: 'BILL TYPE :', value: billType },
        { label: 'PLACE OF SUPPLY :', value: placeOfSupply, highlight: true },
        { label: 'DATE :', value: formatDate(invoiceData.orderDate) },
        { label: 'INVOICE. NO :', value: invoiceData.invoiceNumber || '', highlight: true }
      ].forEach(({ label, value, highlight }) => {
        if (highlight) doc.rect(valueX, rightY - 2, valueW, 16).fill(YELLOW);
        doc.font(font).fontSize(9.5).fillColor('#000000')
          .text(label, valueX - labelW - 4, rightY + 1, { width: labelW, align: 'right' });
        doc.font(fontBold).fontSize(9.5).text(value, valueX + 4, rightY + 1, { width: valueW - 8 });
        rightY += 20;
      });

      y = Math.max(leftY, rightY) + 8;

      // Bill To
      // The whole width is available (nothing sits to the right), so the address stays on one line
      const billW = contentW;
      const billLabelW = 62;
      const rowH = 16;
      doc.rect(left, y, billW, rowH).fill(GREEN);
      doc.font(fontBold).fontSize(10).fillColor('#FFFFFF').text('BILL TO', left + 6, y + 3);
      y += rowH;

      // One address line (wraps only if it is longer than the box)
      const addressLines = [String(buyer.address || '')
        .split(/[\n,]/)
        .map((line) => line.trim())
        .filter(Boolean)
        .join(', ')];
      const billRows = [
        { label: 'T.Name :', value: (buyer.name || '').toUpperCase() },
        ...(buyer.gstin ? [{ label: 'GSTIN :', value: buyer.gstin.toUpperCase() }] : []),
        ...(buyer.phone ? [{ label: 'Phone :', value: buyer.phone }] : []),
        ...(addressLines.length ? addressLines : ['']).map((line, idx) => ({ label: idx === 0 ? 'Address :' : '', value: line.toUpperCase() }))
      ];
      const billTop = y;
      billRows.forEach(({ label, value }) => {
        doc.font(font).fontSize(9);
        const valueW2 = billW - billLabelW - 8;
        const thisRowH = Math.max(rowH, Math.ceil(doc.heightOfString(value || ' ', { width: valueW2 })) + 6);
        doc.rect(left, y, billW, thisRowH).fill(YELLOW);
        doc.font(fontBold).fontSize(9).fillColor('#000000')
          .text(label, left + 2, y + 3, { width: billLabelW - 6, align: 'right' });
        doc.font(font).fontSize(9).text(value, left + billLabelW + 4, y + 3, { width: valueW2 });
        doc.strokeColor('#000000').lineWidth(0.5).moveTo(left, y + thisRowH).lineTo(left + billW, y + thisRowH).stroke();
        y += thisRowH;
      });
      doc.strokeColor('#000000').lineWidth(0.5)
        .rect(left, billTop - rowH, billW, y - billTop + rowH).stroke()
        .moveTo(left + billLabelW, billTop).lineTo(left + billLabelW, y).stroke();
      y += 10;

      // Items table
      const cols = [
        { key: 'sno', label: 'S.No', width: contentW * 0.06, align: 'center' },
        { key: 'description', label: 'PRODUCT & DESCRIPTION', width: contentW * 0.34, align: 'left' },
        { key: 'hsn', label: 'HSN CODE', width: contentW * 0.1, align: 'center' },
        { key: 'quantity', label: 'QTY', width: contentW * 0.07, align: 'center' },
        { key: 'unitPrice', label: 'UNIT PRICE', width: contentW * 0.13, align: 'right' },
        { key: 'totalValue', label: 'TOTAL VALUE', width: contentW * 0.15, align: 'right' },
        { key: 'taxable', label: 'TAXABLE VALUE', width: contentW * 0.15, align: 'right' }
      ];
      const headerH = 18;
      const itemH = 15;

      const drawHeader = () => {
        doc.rect(left, y, contentW, headerH).fill(GREEN);
        let x = left;
        doc.font(fontBold).fontSize(9.5).fillColor('#FFFFFF');
        cols.forEach((col) => {
          doc.text(col.label, x + 3, y + 4, { width: col.width - 6, align: 'center' });
          x += col.width;
        });
        y += headerH;
      };

      const drawGrid = (top, bottom) => {
        doc.strokeColor('#000000').lineWidth(0.5).rect(left, top, contentW, bottom - top).stroke();
        let x = left;
        cols.slice(0, -1).forEach((col) => {
          x += col.width;
          doc.moveTo(x, top).lineTo(x, bottom).stroke();
        });
      };

      drawHeader();
      let tableTop = y;
      // Only the bill's own items are listed (no blank rows, saves paper)
      const minRows = items.length;
      for (let index = 0; index < minRows; index += 1) {
        const item = items[index];
        const description = item ? item.description.toUpperCase() : '';
        // A long description wraps onto further lines and the row grows to fit it
        doc.font(font).fontSize(9);
        const descHeight = item ? doc.heightOfString(description, { width: cols[1].width - 8 }) : 0;
        const rowH = Math.max(itemH, Math.ceil(descHeight) + 4);
        // Items fill the whole printable area; if the totals block then does not fit it moves to the next page on its own
        if (y + rowH > pageHeight - margin - 20) {
          if (index >= items.length) break;
          drawGrid(tableTop, y);
          newPage();
          y = margin + 16;
          drawHeader();
          tableTop = y;
        }
        if (item) {
          const values = {
            sno: String(index + 1),
            description,
            hsn: String(item.hsn),
            quantity: String(item.quantity),
            unitPrice: money(item.unitPrice),
            totalValue: money(item.totalValue),
            taxable: money(item.taxable)
          };
          let x = left;
          doc.font(font).fontSize(9).fillColor('#000000');
          cols.forEach((col) => {
            doc.text(values[col.key], x + 4, y + 3, col.key === 'description'
              ? { width: col.width - 8, align: col.align }
              : { width: col.width - 8, align: col.align, lineBreak: false, ellipsis: true });
            x += col.width;
          });
        }
        doc.strokeColor('#000000').lineWidth(0.5).moveTo(left, y + rowH).lineTo(right, y + rowH).stroke();
        y += rowH;
      }
      drawGrid(tableTop, y);
      y += 6; // small gap so the totals box does not touch the table edge

      // The closing blocks flow onto the page one by one, so unused space on a page stays small
      const ensureSpace = (height) => {
        if (y + height > pageHeight - margin) {
          newPage();
          y = margin + 16;
        }
      };
      ensureSpace(100); // totals + payment details

      // Totals (right)
      // Labels span the Unit Price + Total Value columns, amounts sit under Taxable Value
      const totalsLabelW = cols[4].width + cols[5].width;
      const totalsValueW = cols[6].width;
      const totalsX = right - totalsLabelW - totalsValueW;
      const totalsTop = y;
      const totalRows = [
        { label: 'SUBTOTAL', value: money(subtotal), bold: true },
        { label: `IGST${rateLabel(1)}`, value: igst ? money(igst) : '0' },
        { label: `CGST${rateLabel(2)}`, value: cgst ? money(cgst) : '0' },
        { label: `SGST${rateLabel(2)}`, value: sgst ? money(sgst) : '0' },
        { label: 'TOTAL', value: money(total), bold: true, fill: LIGHT }
      ];
      totalRows.forEach(({ label, value, bold, fill }) => {
        doc.rect(totalsX, y, totalsLabelW + totalsValueW, itemH).fill(fill || LIGHT);
        doc.font(bold ? fontBold : font).fontSize(bold ? 10 : 9.5).fillColor('#000000')
          .text(label, totalsX + 4, y + 3, { width: totalsLabelW - 8, align: 'right' })
          .text(value, totalsX + totalsLabelW + 4, y + 3, { width: totalsValueW - 8, align: 'right' });
        doc.strokeColor('#000000').lineWidth(0.5).rect(totalsX, y, totalsLabelW + totalsValueW, itemH).stroke()
          .moveTo(totalsX + totalsLabelW, y).lineTo(totalsX + totalsLabelW, y + itemH).stroke();
        y += itemH;
      });
      doc.font(fontBold).fontSize(9).fillColor('#000000')
        .text('(Round off)', totalsX, y + 3, { width: totalsLabelW, align: 'center' });
      if (config.showEOE !== false) {
        doc.font(fontBold).fontSize(8).text('E. & O. E', totalsX + totalsLabelW, y + 4, { width: totalsValueW - 4, align: 'right' });
      }
      y += 16;

      // Bank details (left)
      const bankRows = [
        { label: 'NAME', value: bank.accountHolder },
        { label: 'A/C NO', value: bank.accountNumber },
        { label: 'IFSC', value: bank.ifscCode },
        { label: 'BANK', value: bank.bankName },
        { label: 'BRANCH', value: bank.branch }
      ].filter((row) => row.value);
      if (bankRows.length) {
        let bankY = totalsTop + itemH;
        const bankW = totalsX - left - 10;
        doc.rect(left - 4, bankY, bankW + 4, itemH).fill(GREEN);
        doc.font(fontBold).fontSize(10).fillColor('#FFFFFF').text('FOR PAYMENT A/C DETAILS', left + 2, bankY + 3);
        bankY += itemH + 2;
        bankRows.forEach(({ label, value }) => {
          doc.font(fontBold).fontSize(9.5).fillColor('#000000')
            .text(`${label} :`, left, bankY, { width: 68, align: 'right' });
          doc.font(font).text(String(value).toUpperCase(), left + 74, bankY, { width: bankW - 74 });
          bankY += 14;
        });
        y = Math.max(y, bankY);
      }

      // Authorised signatory (right)
      if (config.showSignatory !== false) {
        ensureSpace(60);
        const signW = contentW * 0.6;
        const signX = right - signW;
        y += 8;
        doc.font(fontBold).fontSize(10).fillColor('#000000')
          .text(config.authorizedSignatoryFor || `for ${(company.name || '').toUpperCase()}`, signX, y, { width: signW, align: 'right' });
        y = doc.y + 16;
        doc.font(font).fontSize(10)
          .text(config.authorizedSignatoryLabel || 'Authorised Signatory', signX, y, { width: signW, align: 'right' });
        y = doc.y;
      }

      // Contact line
      ensureSpace(72);
      y += 6;
      doc.font(font).fontSize(10).fillColor('#000000')
        .text('If you have any questions about this invoice, please contact', left, y, { width: contentW, align: 'center' });
      y = doc.y + 1;
      // Phone and email share one line to save height
      const contactLine = [company.phone && `Cell: ${company.phone}`, company.email && `Email: ${company.email}`].filter(Boolean).join('     ');
      if (contactLine) {
        doc.text(contactLine, left, y, { width: contentW, align: 'center' });
        y = doc.y;
      }

      // Footer band
      y += 6;
      doc.strokeColor(GREEN).lineWidth(2).moveTo(frameX, y).lineTo(frameX + frameW, y).stroke();
      y += 6;
      doc.font(fontBold).fontSize(11).fillColor('#000000')
        .text(config.footerText && config.footerText !== 'Thank you for your business!' ? config.footerText : 'Thank You For Your Business with us!', left, y, { width: contentW, align: 'center' });
      y = doc.y + 6;

      // Outer frame on the last page
      doc.strokeColor(GREEN).lineWidth(2).rect(frameX, frameTop, frameW, y - frameTop).stroke();

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
};
