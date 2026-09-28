/**
 * Barcode Label Generator V2 - Thermal Printer Edition
 * Optimized for LP45 LITE thermal barcode printer (203 DPI, 105mm roll)
 * 
 * Features:
 * - Fixed label size: 25mm × 25mm
 * - 4 labels per row (fixed)
 * - Vector barcode generation (Code128)
 * - Multi-quantity support
 * - Real-time preview
 * - Thermal printer-optimized PDF output
 */

import React, { useState, useEffect } from 'react';
import {
    Search,
    Printer,
    Save,
    Download,
    Loader2,
    FileText,
    CheckSquare,
    Square,
    Settings as SettingsIcon,
    X,
    Eye,
    CheckCircle,
    AlertCircle,
    Info,
    Zap
} from 'lucide-react';
import { toast } from 'sonner';
import { productService } from '../../services/api';
import { AutoSizer, List } from 'react-virtualized';
import { useTranslation } from 'react-i18next';
import PrintPreviewModal from '../../components/PrintPreviewModal';
import templateService from '../../services/templateService';

const BarcodeLabelGenerator = () => {
    const { t } = useTranslation();

    // === STATE ===
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedProducts, setSelectedProducts] = useState([]);
    const [generating, setGenerating] = useState(false);

    // Preview Modal State
    const [showPreviewModal, setShowPreviewModal] = useState(false);
    const [previewPdfUrl, setPreviewPdfUrl] = useState(null);
    const [previewPdfBase64, setPreviewPdfBase64] = useState(null);
    const [previewFilePath, setPreviewFilePath] = useState(null);
    const [previewDimensions, setPreviewDimensions] = useState(null);

    // Last Generated PDF State
    const [lastGeneratedPdf, setLastGeneratedPdf] = useState(null);

    // Label Settings
    const [settings, setSettings] = useState({
        gap: 2,              // mm between labels
        showName: true,      // Show product name
        showPrice: true,     // Show price
        showBarcodeText: true, // Show barcode value text
        fontSize: 6,         // Font size in points (5-7)
        showBorder: false    // Show label borders (testing only)
    });

    // === FETCH PRODUCTS ===
    const fetchProducts = async () => {
        setLoading(true);
        try {
            const response = await productService.getProducts({
                limit: 1000,
                status: 'Active',
                searchTerm: searchTerm
            });

            if (response.success) {
                setProducts(response.data.map(p => ({
                    ...p,
                    tempBarcode: p.barcode || p.product_code || '',
                    labelQuantity: 1 // Default quantity
                })));
            }
        } catch (error) {
            console.error('Error fetching products:', error);
            toast.error('Failed to load products');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        const fetchStoredSettings = async () => {
            try {
                const response = await templateService.getSettings('barcode');
                if (response.success && response.data?.config) {
                    const config = response.data.config;
                    setSettings(prev => ({
                        ...prev,
                        gap: config.gap ?? prev.gap,
                        showName: config.showName ?? prev.showName,
                        showPrice: config.showPrice ?? prev.showPrice,
                        showBarcodeText: config.showBarcodeText ?? prev.showBarcodeText,
                        fontSize: config.fontSize ?? prev.fontSize
                    }));
                }
            } catch (error) {
                console.error('Error fetching barcode settings:', error);
            }
        };
        fetchStoredSettings();
    }, []);

    useEffect(() => {
        const timer = setTimeout(() => {
            fetchProducts();
        }, 500);
        return () => clearTimeout(timer);
    }, [searchTerm]);

    // === PRODUCT SELECTION ===
    const handleSelectProduct = (product) => {
        if (selectedProducts.find(p => p.id === product.id)) {
            setSelectedProducts(selectedProducts.filter(p => p.id !== product.id));
        } else {
            setSelectedProducts([...selectedProducts, product]);
        }
    };

    const handleSelectAll = () => {
        if (selectedProducts.length === products.length) {
            setSelectedProducts([]);
        } else {
            setSelectedProducts([...products]);
        }
    };

    // === BARCODE VALIDATION ===
    const validateBarcode = (value) => {
        if (!value || value.trim() === '') {
            return { valid: false, error: 'Missing' };
        }
        if (value.length < 4) {
            return { valid: false, error: 'Too short' };
        }
        if (!/^[A-Z0-9\-_.\/\s]+$/i.test(value)) {
            return { valid: false, error: 'Invalid chars' };
        }
        return { valid: true };
    };

    // === QUANTITY UPDATE ===
    const updateQuantity = (productId, quantity) => {
        const qty = Math.max(1, Math.min(100, parseInt(quantity) || 1));
        setProducts(products.map(p =>
            p.id === productId ? { ...p, labelQuantity: qty } : p
        ));
        // Update selected products too
        setSelectedProducts(selectedProducts.map(p =>
            p.id === productId ? { ...p, labelQuantity: qty } : p
        ));
    };

    // === BARCODE UPDATE ===
    const updateBarcode = (productId, barcode) => {
        setProducts(products.map(p =>
            p.id === productId ? { ...p, tempBarcode: barcode } : p
        ));
        setSelectedProducts(selectedProducts.map(p =>
            p.id === productId ? { ...p, tempBarcode: barcode } : p
        ));
    };

    // === CALCULATE TOTAL LABELS ===
    const getTotalLabels = () => {
        return selectedProducts.reduce((sum, p) => sum + (p.labelQuantity || 1), 0);
    };

    // === GENERATE PDF ===
    const handleGeneratePDF = async () => {
        if (selectedProducts.length === 0) {
            toast.error('Please select at least one product');
            return;
        }

        // Validate all barcodes
        const invalidProducts = selectedProducts.filter(p => !validateBarcode(p.tempBarcode).valid);
        if (invalidProducts.length > 0) {
            toast.error(`${invalidProducts.length} product(s) have invalid barcodes`);
            return;
        }

        setGenerating(true);
        const toastId = toast.loading('Generating thermal labels...');

        try {
            // Prepare products for PDF generation
            const productsForPdf = selectedProducts.map(p => ({
                product_name: p.product_name,
                product_code: p.product_code,
                barcode: p.tempBarcode,
                selling_price: p.selling_price,
                labelQuantity: p.labelQuantity || 1
            }));

            const response = await window.api.invoke('barcode-v2:generate-labels', {
                products: productsForPdf,
                settings: settings
            });

            toast.dismiss(toastId);

            if (response.success) {
                toast.success(`Generated ${response.dimensions.labelCount} labels successfully!`);

                // Store last generated PDF info
                setLastGeneratedPdf({
                    filePath: response.filePath,
                    dimensions: response.dimensions,
                    generatedAt: new Date()
                });

                // Auto-open preview
                handleViewPdf(response.filePath, response.pdfData, response.dimensions);
            } else {
                toast.error(response.message || 'Failed to generate labels');
            }
        } catch (error) {
            toast.dismiss(toastId);
            console.error('Generation error:', error);
            toast.error('Failed to generate labels');
        } finally {
            setGenerating(false);
        }
    };

    // === VIEW PDF PREVIEW ===
    const handleViewPdf = async (filePath, pdfData = null, dimensions = null) => {
        if (!filePath) return;

        try {
            let pdfBuffer = pdfData;

            // If pdfData not provided, fetch it
            if (!pdfBuffer) {
                const response = await window.api.invoke('barcode:get-pdf-content', filePath);
                if (response.success) {
                    pdfBuffer = response.pdfData;
                } else {
                    toast.error('Failed to load PDF preview');
                    return;
                }
            }

            const blob = new Blob([pdfBuffer], { type: 'application/pdf' });
            const url = URL.createObjectURL(blob);
            setPreviewPdfUrl(url);

            const reader = new FileReader();
            reader.readAsDataURL(blob);
            reader.onloadend = () => {
                const base64data = reader.result.split(',')[1];
                setPreviewPdfBase64(base64data);
            };

            setPreviewFilePath(filePath);
            setPreviewDimensions(dimensions);
            setShowPreviewModal(true);
        } catch (error) {
            console.error('Preview error:', error);
            toast.error('Failed to open preview');
        }
    };

    // === PRINT PDF ===
    const handlePrintPdf = async (filePath) => {
        if (!filePath) return;

        const toastId = toast.loading('Sending to printer...');
        try {
            await window.api.invoke('barcode-v2:print-labels', filePath);
            toast.dismiss(toastId);
            toast.success('Print job initiated successfully!');
        } catch (error) {
            toast.dismiss(toastId);
            console.error('Print error:', error);
            toast.error('Failed to print');
        }
    };

    // === CLOSE PREVIEW ===
    const closePreview = () => {
        setShowPreviewModal(false);
        if (previewPdfUrl) {
            URL.revokeObjectURL(previewPdfUrl);
        }
        setPreviewPdfUrl(null);
        setPreviewPdfBase64(null);
        setPreviewFilePath(null);
        setPreviewDimensions(null);
    };

    // === SAVE PDF ===
    const handleSavePdf = async () => {
        if (!lastGeneratedPdf) {
            toast.error('No PDF to save');
            return;
        }

        try {
            const result = await window.api.invoke('dialog:showSaveDialog', {
                defaultPath: `thermal-labels-${new Date().getTime()}.pdf`,
                filters: [{ name: 'PDF Files', extensions: ['pdf'] }]
            });

            if (result.canceled || !result.filePath) {
                return;
            }

            const saveResponse = await window.api.invoke('barcode-v2:save-pdf', {
                sourcePath: lastGeneratedPdf.filePath,
                targetPath: result.filePath
            });

            if (saveResponse.success) {
                toast.success('PDF saved successfully!');
            } else {
                toast.error('Failed to save PDF');
            }
        } catch (error) {
            console.error('Save error:', error);
            toast.error('Failed to save PDF');
        }
    };

    // === RENDER LAST GENERATED CARD ===
    const renderLastGeneratedCard = () => {
        if (!lastGeneratedPdf) return null;

        return (
            <div className="bg-white p-4 mx-6 mt-4 rounded-lg shadow-sm border border-green-200 flex justify-between items-center animate-in fade-in slide-in-from-top-4">
                <div className="flex items-center gap-3">
                    <div className="bg-green-100 p-2 rounded-full">
                        <CheckCircle className="w-6 h-6 text-green-600" />
                    </div>
                    <div>
                        <h3 className="font-semibold text-gray-800">Labels Ready</h3>
                        <p className="text-sm text-gray-500">
                            {lastGeneratedPdf.dimensions.labelCount} labels • Generated at {lastGeneratedPdf.generatedAt.toLocaleTimeString()}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => handleViewPdf(lastGeneratedPdf.filePath, null, lastGeneratedPdf.dimensions)}
                        className="flex items-center gap-1 px-3 py-1.5 bg-blue-50 text-blue-600 rounded hover:bg-blue-100 text-sm font-medium transition-colors"
                    >
                        <Eye size={16} /> Preview
                    </button>
                    <button
                        onClick={() => handlePrintPdf(lastGeneratedPdf.filePath)}
                        className="flex items-center gap-1 px-3 py-1.5 bg-gray-50 text-gray-700 rounded hover:bg-gray-100 text-sm font-medium transition-colors"
                    >
                        <Printer size={16} /> Print
                    </button>
                    <button
                        onClick={handleSavePdf}
                        className="flex items-center gap-1 px-3 py-1.5 bg-gray-50 text-gray-700 rounded hover:bg-gray-100 text-sm font-medium transition-colors"
                    >
                        <Download size={16} /> Save
                    </button>
                    <button
                        onClick={() => setLastGeneratedPdf(null)}
                        className="p-1.5 text-gray-400 hover:text-red-500 rounded hover:bg-red-50 transition-colors"
                        title="Dismiss"
                    >
                        <X size={16} />
                    </button>
                </div>
            </div>
        );
    };

    return (
        <div className="flex h-screen bg-gray-50 overflow-hidden">
            {/* Main Content */}
            <div className="flex-1 flex flex-col min-w-0">
                {/* Header */}
                <div className="bg-white border-b border-gray-200 px-6 py-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900">{t('barcode.stickerRoller.title')}</h1>
                            <p className="text-sm text-gray-500">{t('barcode.stickerRoller.subtitle')}</p>
                        </div>
                        <div className="flex items-center gap-3">
                            <div className="text-right">
                                <div className="text-xs text-gray-500">{t('barcode.stickerRoller.totalLabels')}</div>
                                <div className="text-xl font-bold text-blue-600">{getTotalLabels()}</div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Toolbar */}
                <div className="px-6 py-4 grid gap-4 grid-cols-1 md:grid-cols-2 items-center bg-white border-b">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                        <input
                            type="text"
                            placeholder={t('barcode.searchPlaceholder')}
                            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <div className="flex justify-end gap-2">
                        <div className="flex items-center bg-white border border-gray-300 rounded-lg px-3 py-2 shadow-sm">
                            <span className="text-sm text-gray-600 mr-2">{t('barcode.selected')}:</span>
                            <span className="font-bold text-gray-900 bg-gray-100 px-2 py-0.5 rounded text-xs">{selectedProducts.length}</span>
                            {selectedProducts.length > 0 && (
                                <button
                                    onClick={() => setSelectedProducts([])}
                                    className="ml-2 text-xs text-red-600 hover:text-red-700 font-medium"
                                >
                                    {t('barcode.clear')}
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                {/* Status Card */}
                {renderLastGeneratedCard()}

                {/* Info Banner */}
                <div className="mx-6 mt-4 bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-start gap-2">
                    <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                    <div className="text-sm text-blue-800">
                        <strong>{t('barcode.stickerRoller.fixedConfig')}:</strong> {t('barcode.stickerRoller.fixedConfigDesc')}
                        Adjust gap spacing and label content in the settings panel.
                    </div>
                </div>

                {/* Virtualized Product List */}
                <div className="flex-1 px-6 pb-6 mt-4 overflow-hidden flex flex-col">
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col h-full overflow-hidden">
                        {/* Fixed Header */}
                        <div className="flex bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                            <div className="px-6 py-3 w-[80px] text-center flex items-center justify-center border-r border-gray-100">
                                <button onClick={handleSelectAll} className="flex items-center justify-center text-gray-400 hover:text-gray-600">
                                    {selectedProducts.length > 0 && selectedProducts.length === products.length ? (
                                        <CheckSquare className="w-5 h-5 text-blue-600" />
                                    ) : (
                                        <Square className="w-5 h-5" />
                                    )}
                                </button>
                            </div>
                            <div className="px-6 py-3 flex-1 flex items-center">Product</div>
                            <div className="px-6 py-3 w-[250px] flex items-center">Barcode</div>
                            <div className="px-6 py-3 w-[100px] flex items-center justify-center">Quantity</div>
                            <div className="px-6 py-3 w-[120px] text-right flex items-center justify-end">Price</div>
                        </div>

                        {/* Virtualized Body */}
                        <div className="flex-1">
                            {loading ? (
                                <div className="h-full flex flex-col items-center justify-center">
                                    <Loader2 className="w-8 h-8 animate-spin text-blue-600 mb-2" />
                                    <p className="text-gray-500">Loading products...</p>
                                </div>
                            ) : products.length === 0 ? (
                                <div className="h-full flex items-center justify-center text-gray-500">
                                    No products found
                                </div>
                            ) : (
                                <AutoSizer>
                                    {({ height, width }) => (
                                        <List
                                            width={width}
                                            height={height}
                                            rowCount={products.length}
                                            rowHeight={80}
                                            rowRenderer={({ index, key, style }) => {
                                                const product = products[index];
                                                const isSelected = selectedProducts.some(p => p.id === product.id);
                                                const barcodeValidation = validateBarcode(product.tempBarcode);

                                                return (
                                                    <div
                                                        key={key}
                                                        style={style}
                                                        className={`flex items-center border-b border-gray-100 hover:bg-gray-50 transition-colors ${isSelected ? 'bg-blue-50/50' : ''}`}
                                                    >
                                                        {/* Checkbox */}
                                                        <div className="px-6 py-2 w-[80px] flex items-center justify-center border-r border-gray-100 h-full">
                                                            <button
                                                                onClick={() => handleSelectProduct(product)}
                                                                className="flex items-center justify-center w-full h-full"
                                                            >
                                                                {isSelected ? (
                                                                    <CheckSquare className="w-5 h-5 text-blue-600" />
                                                                ) : (
                                                                    <Square className="w-5 h-5 text-gray-300 hover:text-gray-400" />
                                                                )}
                                                            </button>
                                                        </div>

                                                        {/* Product Info */}
                                                        <div className="px-6 py-2 flex-1 min-w-0">
                                                            <div className="font-medium text-gray-900 truncate" title={product.product_name}>
                                                                {product.product_name}
                                                            </div>
                                                            <div className="text-xs text-gray-500 mt-0.5">{product.product_code}</div>
                                                        </div>

                                                        {/* Barcode Input */}
                                                        <div className="px-6 py-2 w-[250px]">
                                                            <div className="relative">
                                                                <input
                                                                    type="text"
                                                                    value={product.tempBarcode}
                                                                    onClick={(e) => e.stopPropagation()}
                                                                    onChange={(e) => updateBarcode(product.id, e.target.value)}
                                                                    className={`w-full px-3 py-1.5 text-sm border rounded focus:ring-2 focus:ring-blue-500 outline-none transition-shadow font-mono ${barcodeValidation.valid ? 'border-gray-300' : 'border-red-300 bg-red-50'
                                                                        }`}
                                                                    placeholder="Enter barcode"
                                                                />
                                                                {!barcodeValidation.valid && isSelected && (
                                                                    <div className="absolute right-2 top-1/2 -translate-y-1/2">
                                                                        <AlertCircle className="w-4 h-4 text-red-500" title={barcodeValidation.error} />
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>

                                                        {/* Quantity */}
                                                        <div className="px-6 py-2 w-[100px]">
                                                            <input
                                                                type="number"
                                                                min="1"
                                                                max="100"
                                                                value={product.labelQuantity}
                                                                onClick={(e) => e.stopPropagation()}
                                                                onChange={(e) => updateQuantity(product.id, e.target.value)}
                                                                className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 outline-none text-center"
                                                            />
                                                        </div>

                                                        {/* Price */}
                                                        <div className="px-6 py-2 w-[120px] text-right font-medium text-gray-900">
                                                            ₹{parseFloat(product.selling_price || 0).toFixed(2)}
                                                        </div>
                                                    </div>
                                                );
                                            }}
                                        />
                                    )}
                                </AutoSizer>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Sidebar Settings */}
            <div className="w-96 bg-white border-l border-gray-200 flex flex-col shadow-xl z-10">
                <div className="p-5 border-b border-gray-200 bg-gray-50">
                    <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                        <SettingsIcon className="w-5 h-5 text-gray-500" />
                        {t('barcode.stickerRoller.labelSettings')}
                    </h2>
                </div>

                <div className="flex-1 overflow-y-auto p-5 space-y-6">
                    {/* Label Options */}
                    <div className="space-y-4">
                        <div className="space-y-1.5">
                            <label className="text-xs font-semibold text-gray-500 uppercase tracking-tight">{t('barcode.stickerRoller.labelGap')} (mm)</label>
                            <input
                                type="number"
                                min="0"
                                max="10"
                                step="0.5"
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                value={settings.gap}
                                onChange={(e) => setSettings({ ...settings, gap: parseFloat(e.target.value) || 0 })}
                            />
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-xs font-semibold text-gray-500 uppercase tracking-tight">{t('barcode.stickerRoller.fontSize')} (pt)</label>
                            <select
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                                value={settings.fontSize}
                                onChange={(e) => setSettings({ ...settings, fontSize: parseInt(e.target.value) })}
                            >
                                <option value="5">5pt</option>
                                <option value="6">6pt</option>
                                <option value="7">7pt</option>
                            </select>
                        </div>

                        <div className="space-y-3 pt-2">
                            <label className="flex items-center gap-2 cursor-pointer group">
                                <input
                                    type="checkbox"
                                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                    checked={settings.showName}
                                    onChange={(e) => setSettings({ ...settings, showName: e.target.checked })}
                                />
                                <span className="text-sm text-gray-700 group-hover:text-gray-900 transition-colors">{t('barcode.stickerRoller.showProductName')}</span>
                            </label>

                            <label className="flex items-center gap-2 cursor-pointer group">
                                <input
                                    type="checkbox"
                                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                    checked={settings.showPrice}
                                    onChange={(e) => setSettings({ ...settings, showPrice: e.target.checked })}
                                />
                                <span className="text-sm text-gray-700 group-hover:text-gray-900 transition-colors">{t('barcode.stickerRoller.showPrice')}</span>
                            </label>

                            <label className="flex items-center gap-2 cursor-pointer group">
                                <input
                                    type="checkbox"
                                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                    checked={settings.showBarcodeText}
                                    onChange={(e) => setSettings({ ...settings, showBarcodeText: e.target.checked })}
                                />
                                <span className="text-sm text-gray-700 group-hover:text-gray-900 transition-colors">{t('barcode.stickerRoller.showBarcodeText')}</span>
                            </label>

                            <label className="flex items-center gap-2 cursor-pointer group">
                                <input
                                    type="checkbox"
                                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                    checked={settings.showBorder}
                                    onChange={(e) => setSettings({ ...settings, showBorder: e.target.checked })}
                                />
                                <span className="text-sm text-gray-700 group-hover:text-gray-900 transition-colors">{t('barcode.stickerRoller.showBorder')}</span>
                            </label>
                        </div>
                    </div>

                    {/* Printer Info (Read-Only) */}
                    <div className="bg-gray-100 rounded-lg p-4 border border-gray-200">
                        <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">{t('barcode.stickerRoller.printerConfig')}</h4>
                        <div className="space-y-1 text-sm text-gray-700">
                            <div className="flex justify-between">
                                <span className="text-gray-500">{t('barcode.stickerRoller.model')}:</span>
                                <span className="font-medium">LP45 LITE</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-500">{t('barcode.stickerRoller.dpi')}:</span>
                                <span className="font-medium">203 DPI</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-500">{t('barcode.stickerRoller.rollWidth')}:</span>
                                <span className="font-medium">105mm ({t('barcode.stickerRoller.fixed')})</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-500">{t('barcode.stickerRoller.labelSize')}:</span>
                                <span className="font-medium">25×25mm ({t('barcode.stickerRoller.fixed')})</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-500">{t('barcode.stickerRoller.perRow')}:</span>
                                <span className="font-medium">4 labels ({t('barcode.stickerRoller.fixed')})</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Action Buttons */}
                <div className="p-5 border-t border-gray-200 bg-gray-50 space-y-2">
                    <button
                        onClick={handleGeneratePDF}
                        disabled={selectedProducts.length === 0 || generating}
                        className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center gap-2 shadow-lg shadow-blue-200"
                    >
                        {generating ? (
                            <>
                                <Loader2 className="w-5 h-5 animate-spin" />
                                {t('barcode.stickerRoller.generating')}
                            </>
                        ) : (
                            <>
                                <Zap className="w-5 h-5" />
                                {t('barcode.stickerRoller.generatePreview')}
                            </>
                        )}
                    </button>
                </div>
            </div>

            {/* Print Preview Modal */}
            <PrintPreviewModal
                isOpen={showPreviewModal}
                onClose={closePreview}
                pdfUrl={previewPdfUrl}
                pdfBase64={previewPdfBase64}
                contentHeight={previewDimensions?.height}
                contentWidth={previewDimensions?.widthMM}
                initialPaperSize="LabelRoll"
                title={t('barcode.stickerRoller.title')}
            />
        </div>
    );
};

export default BarcodeLabelGenerator;
