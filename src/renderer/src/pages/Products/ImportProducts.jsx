import React, { useState, useCallback, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { useNavigate } from 'react-router-dom';
import { List, AutoSizer, ScrollSync, Grid } from 'react-virtualized';
import 'react-virtualized/styles.css';
import { 
  Upload, 
  FileSpreadsheet, 
  AlertCircle, 
  CheckCircle2, 
  X, 
  ArrowLeft,
  Download,
  Save,
  Loader2
} from 'lucide-react';
import { toast } from 'sonner';
import { productService } from '../../services/productService';
import { categoryService } from '../../services/api';
import { brandService } from '../../services/brandService';

const ImportProducts = () => {
  const navigate = useNavigate();
  const [file, setFile] = useState(null);
  const [previewData, setPreviewData] = useState([]);
  const [headers, setHeaders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [errors, setErrors] = useState([]);
  const [rowErrors, setRowErrors] = useState({});
  const [categories, setCategories] = useState([]);
  const [brands, setBrands] = useState([]);

  useEffect(() => {
    const fetchMetadata = async () => {
      try {
        const [catRes, brandRes] = await Promise.all([
          categoryService.getCategories({ limit: 1000 }),
          brandService.getBrands({ limit: 1000 })
        ]);

        if (catRes.success) setCategories(catRes.data);
        if (brandRes.success) setBrands(brandRes.data);
      } catch (error) {
        console.error('Error fetching metadata:', error);
        toast.error('Failed to load categories and brands');
      }
    };
    fetchMetadata();
  }, []);

  const onDrop = useCallback((acceptedFiles) => {
    const selectedFile = acceptedFiles[0];
    if (selectedFile) {
      if (selectedFile.type !== 'text/csv' && !selectedFile.name.endsWith('.csv')) {
        toast.error('Please upload a CSV file');
        return;
      }
      setFile(selectedFile);
      parseCSV(selectedFile);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/csv': ['.csv']
    },
    multiple: false
  });

  const parseCSV = (file) => {
    setLoading(true);
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const text = e.target.result;
        const lines = text.split(/\r\n|\n/);
        
        const nonEmptyLines = lines.filter(line => line.trim() !== '');
        
        if (nonEmptyLines.length < 2) {
          toast.error('File is empty or missing headers');
          setLoading(false);
          return;
        }

        const headers = nonEmptyLines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
        setHeaders(headers);

        const data = [];
        const parseErrors = [];

        for (let i = 1; i < nonEmptyLines.length; i++) {
          const line = nonEmptyLines[i];
          const values = line.split(',').map(val => val.trim().replace(/^"|"$/g, ''));
          
          if (values.length === headers.length) {
            const row = {
              category_id: '',
              brand_id: ''
            };
            headers.forEach((header, index) => {
              const key = mapHeaderToKey(header);
              let value = values[index];

              // Try to map Category Name to ID
              if (key === 'category_id') {
                const category = categories.find(c => c.name.toLowerCase() === value.toLowerCase());
                if (category) value = category.id;
              }

              // Try to map Brand Name to ID
              if (key === 'brand_id') {
                const brand = brands.find(b => b.name.toLowerCase() === value.toLowerCase());
                if (brand) value = brand.id;
              }

              row[key] = value;
            });
            data.push(row);
          } else {
            parseErrors.push(`Line ${i + 1}: Mismatch column count`);
          }
        }

        setPreviewData(data);
        if (parseErrors.length > 0) {
          setErrors(parseErrors);
          toast.warning(`Found ${parseErrors.length} issues in the file`);
        } else {
          setErrors([]);
        }
      } catch (error) {
        console.error('Error parsing CSV:', error);
        toast.error('Failed to parse CSV file');
      } finally {
        setLoading(false);
      }
    };

    reader.readAsText(file);
  };

  const mapHeaderToKey = (header) => {
    // Map common CSV headers to our internal keys
    const map = {
      'Product Name': 'product_name',
      'Product Code': 'product_code',
      'Code': 'product_code',
      'Barcode': 'barcode',
      'HSN': 'hsn_code',
      'Category': 'category_id', // Ideally this would be name and we'd lookup ID, but for now let's assume ID or handle name in backend? 
      // Actually backend expects IDs. Handling names would require looking up categories.
      // For simplicity, let's assume the user provides what we need or we map names later.
      // Let's stick to simple mapping for now.
      'Brand': 'brand_id',
      'Unit': 'unit',
      'Purchase Price': 'purchase_price',
      'Selling Price': 'selling_price',
      'MRP': 'mrp',
      'Discount': 'discount',
      'Tax Rate': 'tax_rate',
      'Stock': 'current_stock',
      'Min Stock': 'minimum_stock',
      'Description': 'description',
      'Status': 'status'
    };
    
    return map[header] || header.toLowerCase().replace(/\s+/g, '_');
  };

  const handleDownloadTemplate = () => {
    const headers = [
      'Product Name', 'Product Code', 'Category', 'Brand', 'Barcode', 'HSN', 'Unit', 
      'Purchase Price', 'Selling Price', 'MRP', 'Tax Rate', 
      'Stock', 'Min Stock', 'Description', 'Status'
    ];
    const csvContent = headers.join(',') + '\n' + 
      'Example Product,PROD001,General,Generic,123456789,1234,Piece,100,150,160,18,50,10,Sample Description,Active';
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', 'products_template.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const validateRows = () => {
    const errors = {};
    let hasErrors = false;
    
    previewData.forEach((row, index) => {
      const rowError = {};
      
      // Category and Brand are now optional
      
      if (Object.keys(rowError).length > 0) {
        errors[index] = rowError;
        hasErrors = true; // Fixed: update hasErrors if there are errors
      }
    });
    
    return { hasErrors, errors };
  };

  const handleDownloadErrors = () => {
    if (previewData.length === 0) return;

    // Create headers including the error message
    const errorHeaders = [...headers, 'Error Message'];
    
    // Create CSV content
    const csvContent = [
      errorHeaders.join(','),
      ...previewData.map((row, index) => {
        const rowError = rowErrors[index];
        // Get the error message from the rowErrors object if it exists
        // Since rowErrors is an object of objects { rowIndex: { field: error } }
        // We need to flatten the errors for that row into a single string
        let errorMessage = '';
        if (rowError) {
          errorMessage = Object.values(rowError).join('; ');
        } else {
          // If it's a backend error that was mapped back to rowErrors
          // We might need to check how we stored it. 
          // In handleImport we do: setRowErrors(newRowErrors) where newRowErrors[newIndex] = { general: error.message }
          // So the above Object.values join should work.
        }

        // Map row data back to CSV columns
        const values = headers.map(header => {
          const key = mapHeaderToKey(header);
          let value = row[key];
          
          // Handle cases where we mapped IDs back to names? 
          // Actually we only have IDs in the row data now.
          // Ideally we should export what the user sees or what they uploaded.
          // But we modified the data. 
          // Let's just dump the current row values. 
          // If we want to be perfect we should keep the original values but we didn't store them separately.
          // For now, let's just export the current state.
          
          // If it's a category/brand ID, maybe try to find the name?
          if (key === 'category_id' && value) {
             const cat = categories.find(c => c.id == value);
             if (cat) value = cat.name;
          }
          if (key === 'brand_id' && value) {
             const brand = brands.find(b => b.id == value);
             if (brand) value = brand.name;
          }

          return `"${value || ''}"`;
        });
        
        return [...values, `"${errorMessage}"`].join(',');
      })
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', 'import_errors.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // Reset the form after download
    toast.info('Error report downloaded. You can now upload the corrected file.');
    removeFile();
  };

  const handleImport = async () => {
    if (previewData.length === 0) return;

    // Validate all rows before importing
    const validation = validateRows();
    if (validation.hasErrors) {
      setRowErrors(validation.errors);
      const errorCount = Object.keys(validation.errors).length;
      toast.error(`Please fix validation errors in ${errorCount} row(s) before importing`);
      return;
    }

    setRowErrors({});
    setImporting(true);
    try {
      // Sanitize data: convert empty strings or invalid values to null
      const sanitizedData = previewData.map(row => {
        // Check if category_id is a valid ID (exists in categories list)
        const isValidCategory = row.category_id && categories.some(c => c.id == row.category_id);
        
        // Check if brand_id is a valid ID (exists in brands list)
        const isValidBrand = row.brand_id && brands.some(b => b.id == row.brand_id);

        return {
          ...row,
          category_id: isValidCategory ? row.category_id : null,
          brand_id: isValidBrand ? row.brand_id : null
        };
      });

      const response = await productService.importProducts(sanitizedData);
      
      if (response.success) {
        if (response.failedCount > 0) {
          toast.warning(`Imported ${response.importedCount} products. ${response.failedCount} failed.`);
          
          // Filter out successful rows, keep only failed ones
          // The backend returns errors with 'row' property which is 1-based index from the sent array
          const failedIndices = new Set(response.errors.map(e => e.row - 1));
          
          const failedRows = previewData.filter((_, index) => failedIndices.has(index));
          setPreviewData(failedRows);
          
          // Map backend errors to rowErrors for the new filtered list
          // We need to map the old indices to the new 0-based indices of the failedRows array
          // Since we preserved order, the first failed row in failedRows corresponds to the first error in response.errors (if sorted)
          // But response.errors might not be sorted or might skip rows.
          // Actually, response.errors has 'row' which is the index in the ORIGINAL array.
          // We need to construct the new rowErrors object for the NEW failedRows array.
          
          const newRowErrors = {};
          response.errors.forEach((error, newIndex) => {
             // The errors array from backend corresponds to the failed rows we kept.
             // Wait, we need to be careful. 
             // If we filter previewData, the indices change.
             // The backend errors list contains ALL errors.
             // If we assume response.errors is in the same order as the rows appear in the file...
             // Let's map the error message to the new index.
             // Since failedRows contains ONLY the rows that failed, and response.errors contains ONLY the errors for those rows...
             // And assuming the order is preserved...
             
             // Let's double check. 
             // Backend: for (const [index, product] of products.entries()) ... errors.push({ row: index + 1 ... })
             // So errors are pushed in order.
             // So the first item in failedRows corresponds to the first item in response.errors.
             
             newRowErrors[newIndex] = { general: error.message };
          });
          
          setRowErrors(newRowErrors);
          
          // Update general errors list for display at top
          setErrors(response.errors.map(e => `${e.product}: ${e.message}`));

        } else {
          toast.success(`Successfully imported all ${response.importedCount} products`);
          navigate('/products');
        }
      } else {
        toast.error(response.message);
      }
    } catch (error) {
      console.error('Import error:', error);
      toast.error('Failed to import products');
    } finally {
      setImporting(false);
    }
  };

  const removeFile = () => {
    setFile(null);
    setPreviewData([]);
    setErrors([]);
    setRowErrors({});
  };

  const handleDataChange = (index, key, value) => {
    const newData = [...previewData];
    newData[index][key] = value;
    setPreviewData(newData);
  };

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => navigate('/products')}
              className="p-2 hover:bg-gray-200 rounded-full transition-colors"
            >
              <ArrowLeft className="w-6 h-6 text-gray-600" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Import Products</h1>
              <p className="text-sm text-gray-500">Upload a CSV file to import products in bulk</p>
            </div>
          </div>
          <button
            onClick={handleDownloadTemplate}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <Download className="w-4 h-4" />
            Download Template
          </button>
        </div>

        {/* Upload Area */}
        {!file ? (
          <div 
            {...getRootProps()} 
            className={`border-2 border-dashed rounded-xl p-12 flex flex-col items-center justify-center text-center cursor-pointer transition-colors ${
              isDragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300 bg-white hover:border-gray-400'
            }`}
          >
            <input {...getInputProps()} />
            <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mb-4">
              <Upload className="w-8 h-8 text-blue-600" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-1">
              {isDragActive ? 'Drop the file here' : 'Click to upload or drag and drop'}
            </h3>
            <p className="text-sm text-gray-500">CSV files only</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-green-50 rounded-lg flex items-center justify-center">
                <FileSpreadsheet className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <p className="font-medium text-gray-900">{file.name}</p>
                <p className="text-sm text-gray-500">{(file.size / 1024).toFixed(2)} KB</p>
              </div>
            </div>
            <button 
              onClick={removeFile}
              className="p-2 hover:bg-red-50 text-gray-400 hover:text-red-500 rounded-full transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        )}

        {/* Preview & Errors */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          </div>
        ) : (
          <>
            {errors.length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="flex items-center gap-2 text-red-800 font-medium mb-2">
                  <AlertCircle className="w-5 h-5" />
                  Import Issues
                </div>
                <ul className="list-disc list-inside text-sm text-red-700 space-y-1">
                  {errors.slice(0, 5).map((err, index) => (
                    <li key={index}>{err}</li>
                  ))}
                  {errors.length > 5 && <li>...and {errors.length - 5} more issues</li>}
                </ul>
              </div>
            )}

            {previewData.length > 0 && (
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden flex flex-col">
                <div className="p-4 border-b border-gray-200 flex items-center justify-between">
                  <h3 className="font-medium text-gray-900">Preview ({previewData.length} items)</h3>
                  <div className="flex items-center gap-3">
                    {errors.length > 0 && (
                      <button
                        onClick={handleDownloadErrors}
                        className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-600 border border-red-200 rounded-lg hover:bg-red-100 transition-colors"
                      >
                        <Download className="w-4 h-4" />
                        Download Errors & Reset
                      </button>
                    )}
                    <button
                      onClick={handleImport}
                      disabled={importing}
                      className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {importing ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Save className="w-4 h-4" />
                      )}
                      Import Products
                    </button>
                  </div>
                </div>

                {/* Virtualized Table with ScrollSync */}
                <div style={{ height: Math.min(600, previewData.length * 80) + 50 }}>
                  <AutoSizer>
                    {({ width, height }) => {
                      const columns = [
                        { label: 'Product Name', width: 200 },
                        { label: 'Product Code', width: 150 },
                        { label: 'Category', width: 180 },
                        { label: 'Brand', width: 180 },
                        { label: 'Barcode', width: 150 },
                        { label: 'HSN', width: 120 },
                        { label: 'Unit', width: 100 },
                        { label: 'Purchase Price', width: 130 },
                        { label: 'Selling Price', width: 130 },
                        { label: 'MRP', width: 120 },
                        { label: 'Tax Rate', width: 100 },
                        { label: 'Stock', width: 100 },
                        { label: 'Min Stock', width: 100 },
                        { label: 'Description', width: 200 },
                        { label: 'Status', width: 100 }
                      ];
                      const totalWidth = columns.reduce((sum, col) => sum + col.width, 0);

                      return (
                        <ScrollSync>
                          {({ onScroll, scrollLeft }) => (
                            <div style={{ width, height }}>
                              {/* Table Header */}
                              <div 
                                className="overflow-hidden bg-gray-50 border-b border-gray-200"
                                style={{ width, height: 50 }}
                              >
                                <div 
                                  className="inline-flex"
                                  style={{ 
                                    width: totalWidth,
                                    transform: `translateX(-${scrollLeft}px)` 
                                  }}
                                >
                                  {columns.map((header) => (
                                    <div
                                      key={header.label}
                                      style={{ width: header.width }}
                                      className="px-4 py-3 font-medium text-gray-700 text-sm capitalize flex-shrink-0"
                                    >
                                      {header.label}
                                    </div>
                                  ))}
                                </div>
                              </div>

                              {/* Virtualized Table Body */}
                              <Grid
                                columnCount={1}
                                columnWidth={totalWidth}
                                height={height - 50}
                                rowCount={previewData.length}
                                rowHeight={80}
                                width={width}
                                onScroll={onScroll}
                                className="overflow-x-auto"
                                cellRenderer={({ columnIndex, key, rowIndex, style }) => {
                                  const row = previewData[rowIndex];
                                  const hasError = rowErrors[rowIndex];
                                  const errorMessage = hasError?.general;

                                  return (
                                    <div key={key} style={style} className={`border-b border-gray-200 hover:bg-gray-50 ${errorMessage ? 'bg-red-50 hover:bg-red-100' : ''}`}>
                                      {errorMessage && (
                                        <div className="absolute top-0 left-0 right-0 bg-red-100 text-red-700 text-xs px-2 py-0.5 border-b border-red-200 z-10 truncate">
                                          Error: {errorMessage}
                                        </div>
                                      )}
                                      <div className="inline-flex" style={{ width: totalWidth, paddingTop: errorMessage ? '16px' : '0' }}>
                                        {/* Product Name */}
                                        <div style={{ width: 200 }} className="px-4 py-3 text-sm text-gray-600 flex-shrink-0">
                                          {row.product_name}
                                        </div>

                                        {/* Product Code */}
                                        <div style={{ width: 150 }} className="px-4 py-3 text-sm text-gray-600 flex-shrink-0">
                                          {row.product_code}
                                        </div>

                                        {/* Category */}
                                        <div style={{ width: 180 }} className="px-4 py-3 flex-shrink-0">
                                          <select
                                            value={row.category_id || ''}
                                            onChange={(e) => {
                                              handleDataChange(rowIndex, 'category_id', e.target.value);
                                              // Clear error when user selects a value
                                              if (e.target.value) {
                                                const newErrors = { ...rowErrors };
                                                if (newErrors[rowIndex]) {
                                                  delete newErrors[rowIndex].category_id;
                                                  if (Object.keys(newErrors[rowIndex]).length === 0) {
                                                    delete newErrors[rowIndex];
                                                  }
                                                }
                                                setRowErrors(newErrors);
                                              }
                                            }}
                                            className={`block w-full rounded-md shadow-sm text-sm ${
                                              hasError?.category_id
                                                ? 'border-red-500 focus:border-red-500 focus:ring-red-500'
                                                : 'border-gray-300 focus:border-blue-500 focus:ring-blue-500'
                                            }`}
                                          >
                                            <option value="">Select</option>
                                            {categories.map(cat => (
                                              <option key={cat.id} value={cat.id}>{cat.name}</option>
                                            ))}
                                          </select>
                                          {hasError?.category_id && (
                                            <p className="mt-1 text-xs text-red-600">{hasError.category_id}</p>
                                          )}
                                        </div>

                                        {/* Brand */}
                                        <div style={{ width: 180 }} className="px-4 py-3 flex-shrink-0">
                                          <select
                                            value={row.brand_id || ''}
                                            onChange={(e) => {
                                              handleDataChange(rowIndex, 'brand_id', e.target.value);
                                              // Clear error when user selects a value
                                              if (e.target.value) {
                                                const newErrors = { ...rowErrors };
                                                if (newErrors[rowIndex]) {
                                                  delete newErrors[rowIndex].brand_id;
                                                  if (Object.keys(newErrors[rowIndex]).length === 0) {
                                                    delete newErrors[rowIndex];
                                                  }
                                                }
                                                setRowErrors(newErrors);
                                              }
                                            }}
                                            className={`block w-full rounded-md shadow-sm text-sm ${
                                              hasError?.brand_id
                                                ? 'border-red-500 focus:border-red-500 focus:ring-red-500'
                                                : 'border-gray-300 focus:border-blue-500 focus:ring-blue-500'
                                            }`}
                                          >
                                            <option value="">Select</option>
                                            {brands.map(brand => (
                                              <option key={brand.id} value={brand.id}>{brand.name}</option>
                                            ))}
                                          </select>
                                          {hasError?.brand_id && (
                                            <p className="mt-1 text-xs text-red-600">{hasError.brand_id}</p>
                                          )}
                                        </div>

                                        {/* Barcode */}
                                        <div style={{ width: 150 }} className="px-4 py-3 text-sm text-gray-600 flex-shrink-0">
                                          {row.barcode}
                                        </div>

                                        {/* HSN */}
                                        <div style={{ width: 120 }} className="px-4 py-3 text-sm text-gray-600 flex-shrink-0">
                                          {row.hsn_code}
                                        </div>

                                        {/* Unit */}
                                        <div style={{ width: 100 }} className="px-4 py-3 text-sm text-gray-600 flex-shrink-0">
                                          {row.unit}
                                        </div>

                                        {/* Purchase Price */}
                                        <div style={{ width: 130 }} className="px-4 py-3 text-sm text-gray-600 flex-shrink-0">
                                          {row.purchase_price}
                                        </div>

                                        {/* Selling Price */}
                                        <div style={{ width: 130 }} className="px-4 py-3 text-sm text-gray-600 flex-shrink-0">
                                          {row.selling_price}
                                        </div>

                                        {/* MRP */}
                                        <div style={{ width: 120 }} className="px-4 py-3 text-sm text-gray-600 flex-shrink-0">
                                          {row.mrp}
                                        </div>

                                        {/* Tax Rate */}
                                        <div style={{ width: 100 }} className="px-4 py-3 text-sm text-gray-600 flex-shrink-0">
                                          {row.tax_rate}
                                        </div>

                                        {/* Stock */}
                                        <div style={{ width: 100 }} className="px-4 py-3 text-sm text-gray-600 flex-shrink-0">
                                          {row.current_stock}
                                        </div>

                                        {/* Min Stock */}
                                        <div style={{ width: 100 }} className="px-4 py-3 text-sm text-gray-600 flex-shrink-0">
                                          {row.minimum_stock}
                                        </div>

                                        {/* Description */}
                                        <div style={{ width: 200 }} className="px-4 py-3 text-sm text-gray-600 flex-shrink-0 truncate">
                                          {row.description}
                                        </div>

                                        {/* Status */}
                                        <div style={{ width: 100 }} className="px-4 py-3 text-sm text-gray-600 flex-shrink-0">
                                          {row.status}
                                        </div>
                                      </div>
                                    </div>
                                  );
                                }}
                              />
                            </div>
                          )}
                        </ScrollSync>
                      );
                    }}
                  </AutoSizer>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default ImportProducts;
