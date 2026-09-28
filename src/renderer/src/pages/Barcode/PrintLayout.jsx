import React from 'react';
import Barcode from 'react-barcode';

const PrintLayout = React.forwardRef(({ products, settings = {} }, ref) => {
  const {
    showPrice = true,
    showName = true,
    showStoreName = false,
    storeName = 'My Store',
    paperSize = 'LabelRoll'
  } = settings;

  const isRoll = paperSize === 'LabelRoll';

  return (
    <div ref={ref} className="print-layout p-4 bg-white">
      <style type="text/css" media="print">
        {`
          @page { size: auto; margin: 0mm; }
          @media print {
            body { -webkit-print-color-adjust: exact; }
            .print-hidden { display: none !important; }
            .print-layout { 
              display: grid !important;
              grid-template-columns: ${isRoll ? 'repeat(4, 25mm)' : 'repeat(auto-fill, minmax(150px, 1fr))'};
              gap: ${isRoll ? '1mm' : '10px'};
              padding: ${isRoll ? '1mm' : '10px'};
              width: ${isRoll ? '105mm' : '100%'};
              justify-content: center;
            }
            .barcode-item {
              break-inside: avoid;
              page-break-inside: avoid;
              border: ${isRoll ? 'none' : '1px solid #eee'};
              padding: ${isRoll ? '2mm 1mm' : '10px 8px'};
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: flex-start;
              text-align: center;
              min-height: ${isRoll ? '25mm' : '120px'};
              height: ${isRoll ? '25mm' : 'auto'};
              overflow: hidden;
            }
          }
        `}
      </style>

      <div className="grid grid-cols-4 gap-4 print:grid-cols-4">
        {products.map((product, index) => (
          <div key={`${product.id}-${index}`} className="barcode-item border rounded p-2 flex flex-col items-center justify-center text-center bg-white">
            {showStoreName && (
              <div className="text-xs font-bold mb-1 truncate w-full">{storeName}</div>
            )}

            {showName && (
              <div className="text-xs mb-2 line-clamp-2 w-full px-1 min-h-[32px] flex items-center justify-center" title={product.product_name}>
                {product.product_name}
              </div>
            )}

            <div className="w-full flex justify-center overflow-hidden mb-1">
              <Barcode
                value={product.barcode || product.product_code || '000000'}
                width={1.5}
                height={paperSize === 'Thermal' ? 30 : 40}
                fontSize={12}
                margin={2}
                textMargin={10}
                displayValue={true}
              />
            </div>

            {showPrice && (
              <div className="text-sm font-bold mt-1">
                ₹{parseFloat(product.selling_price || 0).toFixed(2)}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
});

PrintLayout.displayName = 'PrintLayout';

export default PrintLayout;
