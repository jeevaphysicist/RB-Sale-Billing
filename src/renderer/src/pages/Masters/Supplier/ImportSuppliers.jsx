import React, { useState, useCallback } from 'react';
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
import { supplierService } from '../../../services/supplierService';

const ImportSuppliers = () => {
  const navigate = useNavigate();
  const [file, setFile] = useState(null);
  const [previewData, setPreviewData] = useState([]);
  const [headers, setHeaders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [errors, setErrors] = useState([]);
  const [rowErrors, setRowErrors] = useState({});

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
            const row = {};
            headers.forEach((header, index) => {
              const key = mapHeaderToKey(header);
              row[key] = values[index];
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
    const map = {
      'Supplier Name': 'supplier_name',
      'Phone': 'phone',
      'Email': 'email',
      'Contact Person': 'contact_person',
      'City': 'city',
      'State': 'state',
      'Pincode': 'pincode',
      'GSTIN': 'gstin',
      'Address': 'address_line_1',
      'Status': 'status',
      'Opening Balance': 'opening_balance'
    };
    
    return map[header] || header.toLowerCase().replace(/\s+/g, '_');
  };

  const handleDownloadTemplate = () => {
    const headers = [
      'Supplier Name', 'Phone', 'Email', 'Contact Person', 'City', 'State', 'Pincode',
      'GSTIN', 'Address', 'Status', 'Opening Balance'
    ];
    const csvContent = headers.join(',') + '\n' + 
      'ABC Suppliers,9876543210,abc@example.com,John Manager,Mumbai,Maharashtra,400001,27ABCDE1234F1Z5,123 Main St,Active,0';
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', 'suppliers_template.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDownloadErrors = () => {
    if (previewData.length === 0) return;

    const errorHeaders = [...headers, 'Error Message'];
    
    const csvContent = [
      errorHeaders.join(','),
      ...previewData.map((row, index) => {
        const rowError = rowErrors[index];
        let errorMessage = '';
        if (rowError) {
          errorMessage = Object.values(rowError).join('; ');
        }

        const values = headers.map(header => {
          const key = mapHeaderToKey(header);
          let value = row[key];
          return `"${value || ''}"`;
        });
        
        return [...values, `"${errorMessage}"`].join(',');
      })
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', 'supplier_import_errors.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast.info('Error report downloaded. You can now upload the corrected file.');
    removeFile();
  };

  const handleImport = async () => {
    if (previewData.length === 0) return;

    setImporting(true);
    try {
      const response = await supplierService.importSuppliers(previewData);
      
      if (response.success) {
        if (response.failedCount > 0) {
          toast.warning(`Imported ${response.importedCount} suppliers. ${response.failedCount} failed.`);
          
          const failedIndices = new Set(response.errors.map(e => e.row - 1));
          const failedRows = previewData.filter((_, index) => failedIndices.has(index));
          setPreviewData(failedRows);
          
          const newRowErrors = {};
          response.errors.forEach((error, newIndex) => {
            newRowErrors[newIndex] = { general: error.message };
          });
          
          setRowErrors(newRowErrors);
          setErrors(response.errors.map(e => `${e.supplier}: ${e.message}`));
        } else {
          toast.success(`Successfully imported all ${response.importedCount} suppliers`);
          navigate('/suppliers');
        }
      } else {
        toast.error(response.message);
      }
    } catch (error) {
      console.error('Import error:', error);
      toast.error('Failed to import suppliers');
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

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => navigate('/suppliers')}
              className="p-2 hover:bg-gray-200 rounded-full transition-colors"
            >
              <ArrowLeft className="w-6 h-6 text-gray-600" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Import Suppliers</h1>
              <p className="text-sm text-gray-500">Upload a CSV file to import suppliers in bulk</p>
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
                      Import Suppliers
                    </button>
                  </div>
                </div>

                {/* Virtualized Table with ScrollSync */}
                <div style={{ height: Math.min(600, previewData.length * 80) + 50 }}>
                  <AutoSizer>
                    {({ width, height }) => {
                      const columns = [
                        { label: 'Supplier Name', width: 200 },
                        { label: 'Phone', width: 150 },
                        { label: 'Email', width: 200 },
                        { label: 'Contact Person', width: 180 },
                        { label: 'City', width: 150 },
                        { label: 'State', width: 150 },
                        { label: 'Pincode', width: 120 },
                        { label: 'GSTIN', width: 180 },
                        { label: 'Address', width: 250 },
                        { label: 'Status', width: 100 },
                        { label: 'Opening Balance', width: 150 }
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
                                className="border-t-0"
                                cellRenderer={({ key, rowIndex, style }) => {
                                  const row = previewData[rowIndex];
                                  const hasError = rowErrors[rowIndex];
                                  const errorMessage = hasError?.general;

                                  return (
                                    <div 
                                      key={key} 
                                      style={style}
                                      className={`border-b border-gray-200 hover:bg-gray-50 ${errorMessage ? 'bg-red-50' : ''}`}
                                    >
                                      <div className="inline-flex items-center h-full" style={{ width: totalWidth }}>
                                        <div style={{ width: columns[0].width }} className="px-4 py-3 text-gray-900 text-sm flex-shrink-0">
                                          <div>{row.supplier_name}</div>
                                          {errorMessage && (
                                            <div className="text-xs text-red-600 mt-1">Error: {errorMessage}</div>
                                          )}
                                        </div>
                                        <div style={{ width: columns[1].width }} className="px-4 py-3 text-gray-600 text-sm flex-shrink-0">{row.phone}</div>
                                        <div style={{ width: columns[2].width }} className="px-4 py-3 text-gray-600 text-sm flex-shrink-0 truncate">{row.email}</div>
                                        <div style={{ width: columns[3].width }} className="px-4 py-3 text-gray-600 text-sm flex-shrink-0">{row.contact_person}</div>
                                        <div style={{ width: columns[4].width }} className="px-4 py-3 text-gray-600 text-sm flex-shrink-0">{row.city}</div>
                                        <div style={{ width: columns[5].width }} className="px-4 py-3 text-gray-600 text-sm flex-shrink-0">{row.state}</div>
                                        <div style={{ width: columns[6].width }} className="px-4 py-3 text-gray-600 text-sm flex-shrink-0">{row.pincode}</div>
                                        <div style={{ width: columns[7].width }} className="px-4 py-3 text-gray-600 text-sm flex-shrink-0">{row.gstin}</div>
                                        <div style={{ width: columns[8].width }} className="px-4 py-3 text-gray-600 text-sm flex-shrink-0 truncate">{row.address_line_1}</div>
                                        <div style={{ width: columns[9].width }} className="px-4 py-3 text-gray-600 text-sm flex-shrink-0">{row.status}</div>
                                        <div style={{ width: columns[10].width }} className="px-4 py-3 text-gray-600 text-sm flex-shrink-0">{row.opening_balance}</div>
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

export default ImportSuppliers;
