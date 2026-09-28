import React, { useState, useEffect } from 'react';
import {
    Search,
    Printer,
    RefreshCw,
    Save,
    Download,
    Loader2,
    FileText,
    CheckSquare,
    Square,
    Settings,
    X,
    Eye,
    CheckCircle
} from 'lucide-react';
import { toast } from 'sonner';
import { productService } from '../../services/api';
import Barcode from 'react-barcode';
import { useGlobalJob } from '../../contexts/GlobalJobContext';
import { AutoSizer, List } from 'react-virtualized';
import { useTranslation } from 'react-i18next';
import PrintPreviewModal from '../../components/PrintPreviewModal';

const BarcodeGenerator = () => {
    const { t } = useTranslation();
    const { lastBarcodePdf, clearLastBarcodePdf, isGenerating, startBarcodeGeneration } = useGlobalJob();
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedProducts, setSelectedProducts] = useState([]);

    // Preview Modal State
    const [showPreviewModal, setShowPreviewModal] = useState(false);
    const [previewPdfUrl, setPreviewPdfUrl] = useState(null);
    const [previewPdfBase64, setPreviewPdfBase64] = useState(null);
    const [previewFilePath, setPreviewFilePath] = useState(null);
    const [previewPdfHeight, setPreviewPdfHeight] = useState(null);

    const [printSettings, setPrintSettings] = useState({
        showPrice: true,
        showName: true,
        showStoreName: true,
        storeName: 'My Store',
        paperSize: 'LabelRoll',
        copies: 1
    });

    // Fetch products
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
                })));
            }
        } catch (error) {
            console.error('Error fetching products:', error);
            toast.error(t('barcode.messages.loadFailed'));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        const timer = setTimeout(() => {
            fetchProducts();
        }, 500);
        return () => clearTimeout(timer);
    }, [searchTerm]);

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

    const generateRandomBarcode = () => {
        return Math.floor(100000000000 + Math.random() * 900000000000).toString();
    };

    /* 
       Fix 2: Auto-Generate Condition
       - Previously checked (!p.barcode && !p.tempBarcode), which skipped products that *originally* had a barcode 
       but were cleared by the user.
       - New logic: Just check (!p.tempBarcode). If the current input is empty, generate one.
    */
    const handleGenerateAll = () => {
        const updatedProducts = products.map(p => {
            // If the temporary barcode field is empty (even if it had one originally), generate a new one
            if (!p.tempBarcode) {
                return { ...p, tempBarcode: generateRandomBarcode() };
            }
            return p;
        });

        setProducts(updatedProducts);
        toast.success(t('barcode.messages.generatedEmpty'));
    };

    const handleSaveBarcodes = async () => {
        const productsToUpdate = products.filter(p =>
            p.tempBarcode && p.tempBarcode !== p.barcode
        );

        if (productsToUpdate.length === 0) {
            toast.info(t('barcode.messages.noChanges'));
            return;
        }

        setLoading(true);
        try {
            let successCount = 0;
            for (const product of productsToUpdate) {
                /* 
                   Fix 1: Selective Update Issue
                   - Previously passed only { product_name, barcode }. 
                   - The backend performs a full update, so missing fields became null/default (e.g. status -> Inactive).
                   - Now passing { ...product, barcode: tempBarcode } to preserve all existing data.
                */
                await productService.updateProduct(product.id, {
                    ...product,
                    barcode: product.tempBarcode
                });
                successCount++;
            }
            toast.success(t('barcode.messages.updateSuccess', { count: successCount }));
            fetchProducts();
        } catch (error) {
            console.error('Error saving barcodes:', error);
            toast.error(t('barcode.messages.saveFailed'));
        } finally {
            setLoading(false);
        }
    };

    const getBarcodeValue = (product) => {
        // If barcode is missing, use product_code as the barcode value (Better practice than 000000)
        return product.tempBarcode || product.barcode || product.product_code || '';
    };

    // Direct Print (optional, now we primarily specific Preview)
    const handlePrint = async () => {
        if (selectedProducts.length === 0) {
            toast.error(t('barcode.messages.selectToPrint'));
            return;
        }

        // Suggest using preview
        handlePreviewPDF();
    };

    // View Generated PDF (from card)
    const handleViewFile = async (filePath) => {
        if (!filePath) return;

        const toastId = toast.loading(t('barcode.messages.loadingPreview'));
        try {
            const response = await window.api.invoke('barcode:get-pdf-content', filePath);

            toast.dismiss(toastId);
            if (response.success && response.pdfData) {
                setPreviewFilePath(filePath);

                const blob = new Blob([response.pdfData], { type: 'application/pdf' });
                const url = URL.createObjectURL(blob);
                setPreviewPdfUrl(url);

                const reader = new FileReader();
                reader.readAsDataURL(blob);
                reader.onloadend = () => {
                    const base64data = reader.result.split(',')[1];
                    setPreviewPdfBase64(base64data);
                };

                // Sync height from the job if available
                if (lastBarcodePdf && lastBarcodePdf.filePath === filePath) {
                    setPreviewPdfHeight(lastBarcodePdf.height);
                } else {
                    setPreviewPdfHeight(null);
                }

                setShowPreviewModal(true);
            } else {
                toast.error(response.message || t('barcode.messages.loadPdfFailed'));
            }
        } catch (error) {
            toast.dismiss(toastId);
            console.error('Preview error:', error);
            toast.error(t('barcode.messages.previewFailed'));
        }
    };

    const handlePreviewPDF = async () => {
        if (selectedProducts.length === 0) {
            toast.error(t('barcode.messages.selectToPreview'));
            return;
        }

        // Start background job
        const response = await startBarcodeGeneration({
            products: selectedProducts.map(p => ({
                ...p,
                barcode: getBarcodeValue(p)
            })),
            settings: printSettings
        });

        // Optionally handle immediate error here, but success is handled by global context
    };



    const handlePrintFile = async (filePath) => {
        if (!filePath) return;
        const toastId = toast.loading(t('barcode.messages.sendingToPrinter'));
        try {
            await window.api.invoke('barcode:print-file', filePath);
            toast.dismiss(toastId);
            toast.success(t('barcode.messages.printInitiated'));
        } catch (error) {
            toast.dismiss(toastId);
            console.error('Print error:', error);
            toast.error(t('barcode.messages.printFailed'));
        }
    };

    const closePreview = () => {
        setShowPreviewModal(false);
        // Revoke the blob URL to free memory
        if (previewPdfUrl) {
            URL.revokeObjectURL(previewPdfUrl);
        }
        setPreviewPdfUrl(null);
        setPreviewPdfBase64(null);
        setPreviewPdfHeight(null);
        setPreviewFilePath(null);
    };


    // Render Helper for Last Generated Card
    const renderLastGeneratedCard = () => {
        if (!lastBarcodePdf) return null;

        return (
            <div className="bg-white p-4 mx-6 mt-4 rounded-lg shadow-sm border border-green-200 flex justify-between items-center animate-in fade-in slide-in-from-top-4">
                <div className="flex items-center gap-3">
                    <div className="bg-green-100 p-2 rounded-full">
                        <CheckCircle className="w-6 h-6 text-green-600" />
                    </div>
                    <div>
                        <h3 className="font-semibold text-gray-800">{t('barcode.labelsReady')}</h3>
                        <p className="text-sm text-gray-500">
                            {t('barcode.generatedStatus', { time: new Date(lastBarcodePdf.generatedAt).toLocaleTimeString(), count: lastBarcodePdf.productCount })}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => handleViewFile(lastBarcodePdf.filePath)}
                        className="flex items-center gap-1 px-3 py-1.5 bg-blue-50 text-blue-600 rounded hover:bg-blue-100 text-sm font-medium transition-colors"
                    >
                        <Eye size={16} /> {t('barcode.preview')}
                    </button>
                    <button
                        onClick={() => handlePrintFile(lastBarcodePdf.filePath)}
                        className="flex items-center gap-1 px-3 py-1.5 bg-gray-50 text-gray-700 rounded hover:bg-gray-100 text-sm font-medium transition-colors"
                    >
                        <Printer size={16} /> {t('barcode.print')}
                    </button>
                    <button
                        onClick={clearLastBarcodePdf}
                        className="p-1.5 text-gray-400 hover:text-red-500 rounded hover:bg-red-50 transition-colors"
                        title={t('barcode.dismiss')}
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
                <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">{t('barcode.title')}</h1>
                        <p className="text-sm text-gray-500">{t('barcode.subtitle')}</p>
                    </div>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={handleGenerateAll}
                            className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium transition-colors flex items-center gap-2"
                        >
                            <RefreshCw className="w-4 h-4" />
                            {t('barcode.autoGenerate')}
                        </button>
                        <button
                            onClick={handleSaveBarcodes}
                            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium transition-colors flex items-center gap-2 shadow-sm"
                        >
                            <Save className="w-4 h-4" />
                            {t('barcode.saveChanges')}
                        </button>
                    </div>
                </div>

                {/* Toolbar */}
                <div className="px-6 py-4 grid gap-4 grid-cols-1 md:grid-cols-2 items-center">
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

                {/* Virtualized List Container */}
                <div className="flex-1 px-6 pb-6 overflow-hidden flex flex-col">
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
                            <div className="px-6 py-3 flex-1 flex items-center">{t('barcode.productInfo')}</div>
                            <div className="px-6 py-3 w-[250px] flex items-center">{t('barcode.barcodeEditable')}</div>
                            <div className="px-6 py-3 w-[150px] text-right flex items-center justify-end">{t('barcode.price')}</div>
                        </div>

                        {/* Virtualized Body */}
                        <div className="flex-1">
                            {loading ? (
                                <div className="h-full flex flex-col items-center justify-center">
                                    <Loader2 className="w-8 h-8 animate-spin text-blue-600 mb-2" />
                                    <p className="text-gray-500">{t('barcode.loading')}</p>
                                </div>
                            ) : products.length === 0 ? (
                                <div className="h-full flex items-center justify-center text-gray-500">
                                    {t('barcode.noProducts')}
                                </div>
                            ) : (
                                <AutoSizer>
                                    {({ height, width }) => (
                                        <List
                                            width={width}
                                            height={height}
                                            rowCount={products.length}
                                            rowHeight={80} // increased height for better touch/scan targets
                                            rowRenderer={({ index, key, style }) => {
                                                const product = products[index];
                                                const isSelected = selectedProducts.some(p => p.id === product.id);

                                                // Row Renderer
                                                return (
                                                    <div
                                                        key={key}
                                                        style={style}
                                                        className={`elem-row flex items-center border-b border-gray-100 hover:bg-gray-50 transition-colors ${isSelected ? 'bg-blue-50/50' : ''}`}
                                                    >
                                                        {/* Checkbox Column */}
                                                        <div className="px-6 py-2 w-[80px] flex items-center justify-center border-r border-gray-100 h-full">
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    handleSelectProduct(product);
                                                                }}
                                                                className="flex items-center justify-center w-full h-full"
                                                            >
                                                                {isSelected ? (
                                                                    <CheckSquare className="w-5 h-5 text-blue-600" />
                                                                ) : (
                                                                    <Square className="w-5 h-5 text-gray-300 hover:text-gray-400" />
                                                                )}
                                                            </button>
                                                        </div>

                                                        {/* Product Info Column */}
                                                        <div className="px-6 py-2 flex-1 min-w-0">
                                                            <div className="font-medium text-gray-900 truncate" title={product.product_name}>{product.product_name}</div>
                                                            <div className="text-xs text-gray-500 mt-0.5">{product.product_code}</div>
                                                        </div>

                                                        {/* Barcode Input Column */}
                                                        <div className="px-6 py-2 w-[250px]">
                                                            <input
                                                                type="text"
                                                                value={product.tempBarcode}
                                                                onClick={(e) => e.stopPropagation()} // Prevent row selection if we add click-to-select later
                                                                onChange={(e) => {
                                                                    const newProducts = [...products];
                                                                    newProducts[index] = { ...product, tempBarcode: e.target.value };
                                                                    setProducts(newProducts);
                                                                }}
                                                                className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 outline-none transition-shadow font-mono"
                                                                placeholder={t('barcode.scanOrEnter')}
                                                            />
                                                        </div>

                                                        {/* Price Column */}
                                                        <div className="px-6 py-2 w-[150px] text-right font-medium text-gray-900">
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

            {/* Sidebar Settings - Fixed Right */}
            <div className="w-96 bg-white border-l border-gray-200 flex flex-col shadow-xl z-10">
                <div className="p-5 border-b border-gray-200 bg-gray-50">
                    <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                        <Settings className="w-5 h-5 text-gray-500" />
                        {t('barcode.printSettings')}
                    </h2>
                </div>

                <div className="flex-1 overflow-y-auto p-5 space-y-6">
                    {/* Preview Section */}
                    <div className="bg-gray-100 rounded-xl p-4 border border-gray-200">
                        <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 text-center">
                            {t('barcode.layoutPreview', { size: printSettings.paperSize })}
                        </h4>

                        <div className="flex justify-center min-h-[160px] items-center bg-white rounded-lg shadow-sm border border-gray-300 p-4 relative overflow-hidden">
                            {/* Dynamic Preview Card */}
                            <div className={`flex flex-col items-center justify-center text-center transition-all duration-300 ${printSettings.paperSize === 'LabelRoll' ? 'w-[100px]' : 'w-[150px]'
                                }`}>
                                {printSettings.showStoreName && (
                                    <div className={`${printSettings.paperSize === 'LabelRoll' ? 'text-[8px]' : 'text-xs'} font-bold mb-1 truncate w-full`}>{printSettings.storeName}</div>
                                )}
                                {printSettings.showName && (
                                    <div className={`${printSettings.paperSize === 'LabelRoll' ? 'text-[8px] min-h-[20px]' : 'text-xs min-h-[32px]'} mb-2 line-clamp-2 w-full px-1 flex items-center justify-center`}>
                                        {selectedProducts.length > 0 ? selectedProducts[0].product_name : t('products.productName')}
                                    </div>
                                )}

                                <div className="my-1">
                                    <Barcode
                                        value={
                                            selectedProducts.length > 0
                                                ? getBarcodeValue(selectedProducts[0])
                                                : '123456789'
                                        }
                                        width={printSettings.paperSize === 'LabelRoll' ? 1.0 : 1.5}
                                        height={printSettings.paperSize === 'LabelRoll' ? 25 : 40}
                                        fontSize={printSettings.paperSize === 'LabelRoll' ? 8 : 12}
                                        margin={2}
                                        textMargin={printSettings.paperSize === 'LabelRoll' ? 4 : 10}
                                        displayValue={true}
                                    />
                                </div>

                                {printSettings.showPrice && (
                                    <div className={`${printSettings.paperSize === 'LabelRoll' ? 'text-xs' : 'text-sm'} font-bold mt-1`}>
                                        ₹{
                                            selectedProducts.length > 0
                                                ? parseFloat(selectedProducts[0].selling_price || 0).toFixed(2)
                                                : '999.00'
                                        }
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">{t('barcode.paperType')}</label>
                            <div className="grid grid-cols-2 gap-2">
                                <button
                                    onClick={() => setPrintSettings({ ...printSettings, paperSize: 'LabelRoll' })}
                                    className={`px-3 py-2 text-sm font-medium rounded-lg border transition-all ${printSettings.paperSize === 'LabelRoll'
                                        ? 'bg-blue-50 border-blue-500 text-blue-700 ring-1 ring-blue-500'
                                        : 'bg-white border-gray-300 text-gray-700 hover:border-gray-400'
                                        }`}
                                >
                                    {t('barcode.labelRoll') || 'Barcode Sticker Roller (105mm)'}
                                </button>
                                <button
                                    onClick={() => setPrintSettings({ ...printSettings, paperSize: 'A4' })}
                                    className={`px-3 py-2 text-sm font-medium rounded-lg border transition-all ${printSettings.paperSize === 'A4'
                                        ? 'bg-blue-50 border-blue-500 text-blue-700 ring-1 ring-blue-500'
                                        : 'bg-white border-gray-300 text-gray-700 hover:border-gray-400'
                                        }`}
                                >
                                    {t('barcode.a4Sheet')}
                                </button>
                            </div>
                        </div>

                        <div className="space-y-3 pt-2">
                            <label className="flex items-center gap-2 cursor-pointer group">
                                <input
                                    type="checkbox"
                                    checked={printSettings.showStoreName}
                                    onChange={(e) => setPrintSettings({ ...printSettings, showStoreName: e.target.checked })}
                                    className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-gray-300"
                                />
                                <span className="text-sm text-gray-700 group-hover:text-gray-900">{t('barcode.showStoreName')}</span>
                            </label>

                            {printSettings.showStoreName && (
                                <input
                                    type="text"
                                    value={printSettings.storeName}
                                    onChange={(e) => setPrintSettings({ ...printSettings, storeName: e.target.value })}
                                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                    placeholder={t('barcode.enterStoreName')}
                                />
                            )}

                            <label className="flex items-center gap-2 cursor-pointer group">
                                <input
                                    type="checkbox"
                                    checked={printSettings.showName}
                                    onChange={(e) => setPrintSettings({ ...printSettings, showName: e.target.checked })}
                                    className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-gray-300"
                                />
                                <span className="text-sm text-gray-700 group-hover:text-gray-900">{t('barcode.showProductName')}</span>
                            </label>

                            <label className="flex items-center gap-2 cursor-pointer group">
                                <input
                                    type="checkbox"
                                    checked={printSettings.showPrice}
                                    onChange={(e) => setPrintSettings({ ...printSettings, showPrice: e.target.checked })}
                                    className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-gray-300"
                                />
                                <span className="text-sm text-gray-700 group-hover:text-gray-900">{t('barcode.showPrice')}</span>
                            </label>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">{t('barcode.copiesPerProduct')}</label>
                            <input
                                type="number"
                                min="1"
                                max="100"
                                value={printSettings.copies}
                                onChange={(e) => setPrintSettings({ ...printSettings, copies: parseInt(e.target.value) || 1 })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                            />
                        </div>
                    </div>
                </div>

                <div className="p-5 border-t border-gray-200 bg-gray-50 flex gap-3">
                    <button
                        onClick={handlePreviewPDF}
                        disabled={selectedProducts.length === 0 || isGenerating}
                        className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center gap-2 shadow-lg shadow-blue-200"
                    >
                        {isGenerating ? (
                            <>
                                <Loader2 className="w-5 h-5 animate-spin" />
                                {t('barcode.generating')}
                            </>
                        ) : (
                            <>
                                <FileText className="w-5 h-5" />
                                {t('barcode.generatePdf')}
                            </>
                        )}
                    </button>
                </div>
            </div>

            {/* Standard Print Preview Modal (Matching Sales Order Pattern) */}
            <PrintPreviewModal
                isOpen={showPreviewModal}
                onClose={closePreview}
                pdfUrl={previewPdfUrl}
                pdfBase64={previewPdfBase64}
                contentHeight={previewPdfHeight}
                initialPaperSize={printSettings.paperSize}
                title={t('barcode.pdfPreview')}
            />
        </div>
    );
};

export default BarcodeGenerator;
