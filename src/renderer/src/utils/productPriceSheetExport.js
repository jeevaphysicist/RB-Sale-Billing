/**
 * Human-readable formatters and row mapping for product price sheet exports.
 */

export const formatCurrency = (value) => {
  const amount = parseFloat(value);
  if (Number.isNaN(amount) || amount === 0) return '—';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount);
};

export const formatPercent = (value) => {
  const num = parseFloat(value);
  if (Number.isNaN(num) || num === 0) return '—';
  return `${num % 1 === 0 ? num : num.toFixed(2)}%`;
};

export const formatStatus = (status) => {
  if (!status) return '—';
  const normalized = String(status).trim();
  if (normalized.toLowerCase() === 'active') return 'Active';
  if (normalized.toLowerCase() === 'inactive') return 'Inactive';
  return normalized;
};

export const formatText = (value) => {
  if (value === null || value === undefined || value === '') return '—';
  return String(value).trim();
};

export const formatStock = (quantity, unit) => {
  const qty = parseFloat(quantity);
  if (Number.isNaN(qty)) return '—';
  const unitLabel = unit && String(unit).trim() ? String(unit).trim() : 'Piece';
  const formattedQty = qty % 1 === 0 ? String(qty) : qty.toFixed(2);
  return `${formattedQty} ${unitLabel}`;
};

export const formatProductType = (type) => {
  if (!type) return '—';
  const normalized = String(type).trim();
  if (normalized.toLowerCase() === 'physical') return 'Physical';
  if (normalized.toLowerCase() === 'service') return 'Service';
  return normalized;
};

export const formatGeneratedDate = () => {
  return new Date().toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });
};

export const buildPriceSheetColumnLabels = (t) => ({
  sno: t('common.sNo'),
  productCode: t('products.productCode'),
  productName: t('products.productName'),
  category: t('products.category'),
  brand: t('products.brand'),
  unit: t('products.unit'),
  hsnCode: t('products.hsnCode'),
  barcode: t('products.barcodeQR'),
  mrp: t('products.mrp'),
  sellingPrice: t('products.sellingPrice'),
  wholesalePrice: t('products.wholesalePrice'),
  dealerPrice: t('products.dealerPrice'),
  discount: t('products.discount'),
  taxRate: t('products.taxRate'),
  stock: t('products.stock'),
  productType: t('products.productType'),
  status: t('common.status')
});

export const mapProductToPriceSheetRow = (product, index, labels) => ({
  [labels.sno]: index + 1,
  [labels.productCode]: formatText(product.product_code),
  [labels.productName]: formatText(product.product_name),
  [labels.category]: formatText(product.category_name),
  [labels.brand]: formatText(product.brand_name),
  [labels.unit]: formatText(product.unit || 'Piece'),
  [labels.hsnCode]: formatText(product.hsn_code),
  [labels.barcode]: formatText(product.barcode),
  [labels.mrp]: formatCurrency(product.mrp),
  [labels.sellingPrice]: formatCurrency(product.selling_price),
  [labels.wholesalePrice]: formatCurrency(product.wholesale_price),
  [labels.dealerPrice]: formatCurrency(product.dealer_price),
  [labels.discount]: formatPercent(product.discount),
  [labels.taxRate]: formatPercent(product.tax_rate),
  [labels.stock]: formatStock(product.current_stock, product.unit),
  [labels.productType]: formatProductType(product.product_type),
  [labels.status]: formatStatus(product.status)
});

export const buildPriceSheetRows = (products, t) => {
  const labels = buildPriceSheetColumnLabels(t);
  return products.map((product, index) => mapProductToPriceSheetRow(product, index, labels));
};

export const formatStoreAddress = (store) => {
  if (!store) return '';
  const parts = [
    store.address_line1,
    store.address_line2,
    [store.city, store.district].filter(Boolean).join(', '),
    [store.state, store.pincode].filter(Boolean).join(' - ')
  ].filter((part) => part && String(part).trim());
  return parts.join('\n');
};
