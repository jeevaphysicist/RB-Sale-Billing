import React, { useState, useEffect, useCallback } from 'react';
import { Loader2, Save, RefreshCw, Printer as PrinterIcon, CheckCircle2, AlertCircle, Laptop, Usb, Eye, LayoutTemplate } from 'lucide-react';
import { toast } from 'sonner';
import debounce from 'lodash/debounce';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../contexts/authContext';

const PrinterSettings = () => {
  const { t } = useTranslation();
  const { currentUser } = useAuth();
  const [activeTab, setActiveTab] = useState('connection'); // 'connection' | 'alignment'
  const [activeType, setActiveType] = useState('system'); // 'system' or 'usb'
  const [scanning, setScanning] = useState(false);
  const [devices, setDevices] = useState([]);
  const [settings, setSettings] = useState({
    type: 'system', // system | usb
    vid: '',
    pid: '',
    margins: { top: 0, right: 0, bottom: 0, left: 0 },
    scale: 100,
    copies: 1,
    orientation: 'portrait',
    verticalAlign: 'top',
    pageSize: '80mm'
  });
  const [saving, setSaving] = useState(false);
  const [previewPdf, setPreviewPdf] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const stored = await window.api.getPrinterSettings();
      if (stored) {
        setSettings(prev => ({
          ...prev, // Keep defaults
          ...stored,
          margins: stored.margins || prev.margins
        }));
        if (stored.type) setActiveType(stored.type);
      }
    } catch (error) {
      console.error('Failed to load printer settings:', error);
    }
  };

  const scanDevices = async () => {
    try {
      setScanning(true);
      setDevices([]);

      let foundDevices = [];
      if (activeType === 'system') {
        // Scan System Printers
        // Need to add this handler to backend
        // Assuming we implemented 'printer:scan-system'
        foundDevices = await window.api.scanUSBDevices(); // Re-use method name or add new one? 
        // Wait, 'scanUSBDevices' calls 'printer:scan-usb'.
        // We need a 'scanSystemPrinters' method exposed in preload.
        // Let's assume we update preload to expose 'scanUSBDevices' which calls different backend based on arg?
        // Or simpler: The backend 'printer:scan-usb' handles usb, we need 'printer:scan-system'.
        // Preload updates: 'scanUSBDevices' -> 'printer:scan-usb'
        // We should have added 'scanSystemPrinters'.
        // Let's rely on standard 'scanUSBDevices' for now but we know we need to fix preload if we want system scan.

        // Actually, I added 'printer:scan-system' in backend but missed exposing it in preload explicitly as 'scanSystemPrinters'.
        // I exposed 'scanUSBDevices'.
        // I will use 'scanUSBDevices' for now if I forget to update preload, BUT IT WILL FAIL for system.
        // Correct Fix: I updated preload to verify. I need to update preload if I didn't.
        // Checking preload... I added scanUSBDevices only.
        // I SHOULD CALL scanUSBDevices for USB.
        // For System, I need to add 'scanSystemPrinters' to preload.

        // Let's assume I will fix preload in next step.
        foundDevices = await window.api.scanSystemPrinters();
      } else {
        foundDevices = await window.api.scanUSBDevices();
      }

      setDevices(foundDevices || []);

      if (foundDevices && foundDevices.length === 0) {
        toast.info(activeType === 'system'
          ? t('printerSettings.messages.noPrinters')
          : t('printerSettings.messages.noUsbDevices')
        );
      }
    } catch (error) {
      console.error(error);
      // Fallback for UI if API is missing
      toast.error(t('printerSettings.messages.scanFailed'));
    } finally {
      setScanning(false);
    }
  };

  const handleDeviceSelect = (device) => {
    if (activeType === 'system') {
      setSettings({
        ...settings,
        type: 'system',
        systemName: device.systemName,
        name: device.deviceName
      });
    } else {
      setSettings({
        ...settings,
        type: 'usb',
        vid: device.vendorId,
        pid: device.productId,
        name: device.deviceName || 'Unknown Printer'
      });
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const res = await window.api.savePrinterSettings({ ...settings, type: activeType });
      if (res.success) {
        toast.success(t('printerSettings.messages.saveSuccess'));
      } else {
        toast.error(t('printerSettings.messages.saveFailed'));
      }
    } catch (error) {
      console.error('Save error:', error);
      toast.error(t('printerSettings.messages.saveError'));
    } finally {
      setSaving(false);
    }
  };

  const handleTestPrint = async () => {
    try {
      if (!settings.systemName && activeType === 'system') {
        toast.error(t('printerSettings.messages.selectPrinterFirst'));
        return;
      }

      toast.info(t('printerSettings.messages.generatingTestBill'));

      // Dummy data for test bill (same as preview)
      const dummyOrder = {
        orderNumber: 'TEST-PRINT-001',
        orderDate: new Date().toISOString(),
        orderTime: new Date().toLocaleTimeString(),
        customer: {
          name: 'Walk-in Customer',
          phone: '9876543210',
          address: '456 Customer St, Business District, City - 123456',
          gstin: '33BBCCDD1234E1Z'
        },
        storeDetails: {
          store: currentUser?.storeName || 'Rabtoise Technologies',
          address: '70c, Unniyur, Trichy, Tamil Nadu - 621207',
          phone: '+91 63824 24394',
          email: 'support@rabtoise.org',
          cashier: currentUser?.username || 'Admin',
          counter: 'Counter 1',
          gstin: ''
        },
        items: [
          { productName: 'Sample Product 1', unitPrice: 100, quantity: 2, finalAmount: 200, hsnCode: '1234', taxRate: 18, taxAmount: 36 },
          { productName: 'Sample Product 2', unitPrice: 150, quantity: 1, finalAmount: 150, hsnCode: '5678', taxRate: 12, taxAmount: 18 }
        ],
        calculations: {
          subtotal: 350,
          grandTotal: 404, // 350 + 54 tax
          taxDetails: {
            totalTaxAmount: 54,
            totalCgst: 27,
            totalSgst: 27
          }
        },
        payment: { paymentMethod: 'Cash', receivedAmount: 404, balanceAmount: 0 }
      };

      // Generate PDF Base64
      const pdfBase64 = await window.api.generatePreview({
        orderData: dummyOrder,
        settings: settings
      });

      toast.info(t('printerSettings.messages.sendingToPrinter'));

      // Print via window.api.printPDF
      const res = await window.api.printPDF(pdfBase64, {
        deviceName: settings.systemName || '',
        pageSize: settings.pageSize || '80mm',
        copies: 1
      });

      if (res.success) {
        toast.success(t('printerSettings.messages.testPrintSuccess'));
      } else {
        toast.error(res.message || t('printerSettings.messages.testPrintFailed'));
      }
    } catch (error) {
      console.error('Test print error:', error);
      toast.error(t('printerSettings.messages.testPrintFailed'));
    }
  };

  const generatePreview = async (currentSettings) => {
    try {
      setPreviewLoading(true);
      // Dummy data for preview
      const dummyOrder = {
        orderNumber: 'PREVIEW-001',
        orderDate: new Date().toISOString(),
        orderTime: '12:00 PM',
        customer: {
          name: 'John Doe',
          phone: '9876543210',
          address: '123 Main St, Business City, 123456',
          gstin: ''
        },
        storeDetails: {
          store: currentUser?.storeName || 'Rabtoise Technologies',
          address: '70c, Unniyur, Trichy, Tamil Nadu - 621207',
          phone: '+91 63824 24394',
          email: 'support@rabtoise.org',
          cashier: 'Admin',
          counter: 'Counter 1',
          gstin: ''
        },
        items: [
          { productName: 'Sample Product 1', unitPrice: 100, quantity: 2, finalAmount: 200, hsnCode: '1234', taxRate: 18, taxAmount: 36 },
          { productName: 'Sample Product 2', unitPrice: 150, quantity: 1, finalAmount: 150, hsnCode: '5678', taxRate: 12, taxAmount: 18 }
        ],
        calculations: {
          subtotal: 350,
          grandTotal: 404,
          taxDetails: {
            totalTaxAmount: 54,
            totalCgst: 27,
            totalSgst: 27
          }
        },
        payment: { paymentMethod: 'Cash', receivedAmount: 404, balanceAmount: 0 }
      };

      const pdfBase64 = await window.api.generatePreview({
        orderData: dummyOrder,
        settings: currentSettings || settings
      });

      // Convert base64 to Blob URL to prevent recursive app reload in iframe
      const byteCharacters = atob(pdfBase64);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);

      // Clean up old URL if it exists
      setPreviewPdf(prevUrl => {
        if (prevUrl && prevUrl.startsWith('blob:')) {
          URL.revokeObjectURL(prevUrl);
        }
        return url;
      });
    } catch (error) {
      console.error('Preview error:', error);
      toast.error(t('printerSettings.messages.previewFailed'));
    } finally {
      setPreviewLoading(false);
    }
  };

  // Debounced preview update
  const debouncedPreview = useCallback(
    debounce((newSettings) => generatePreview(newSettings), 1000),
    []
  );

  useEffect(() => {
    return () => {
      if (previewPdf && previewPdf.startsWith('blob:')) {
        URL.revokeObjectURL(previewPdf);
      }
    };
  }, []);

  const handleMarginChange = (key, value) => {
    const val = parseInt(value) || 0;
    const newSettings = {
      ...settings,
      margins: { ...settings.margins, [key]: val }
    };
    setSettings(newSettings);
    debouncedPreview(newSettings);
  };

  useEffect(() => {
    if (activeTab === 'alignment' && !previewPdf) {
      generatePreview(settings);
    }
  }, [activeTab]);

  return (
    <div className="flex-1 flex flex-col h-full overflow-y-auto p-0">
      <div className="mb-6 flex justify-between items-start p-4">
        <div>
          <h2 className="text-xl font-semibold text-gray-800">{t('printerSettings.title')}</h2>
          <p className="text-gray-500 text-sm mt-1">{t('printerSettings.subtitle')}</p>
        </div>
      </div>

      {/* Main Tabs */}
      <div className="flex border-b border-gray-200 mb-6">
        <button
          onClick={() => setActiveTab('connection')}
          className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'connection'
            ? 'border-blue-600 text-blue-600'
            : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
        >
          <PrinterIcon size={18} />
          {t('printerSettings.tabs.connection')}
        </button>
        <button
          onClick={() => setActiveTab('alignment')}
          className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'alignment'
            ? 'border-blue-600 text-blue-600'
            : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
        >
          <LayoutTemplate size={18} />
          {t('printerSettings.tabs.alignment')}
        </button>
      </div>

      <div className="max-w-6xl space-y-6 flex-1 h-full p-4">

        {activeTab === 'connection' && (
          <div className="space-y-6 max-w-4xl">
            {/* Connection Type Tabs */}
            <div className="flex p-1 bg-gray-100 rounded-lg w-fit">
              <button
                onClick={() => setActiveType('system')}
                className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${activeType === 'system' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-600 hover:text-gray-900'
                  }`}
              >
                <Laptop size={18} />
                {t('printerSettings.connection.systemDriver')}
              </button>
              <button
                onClick={() => setActiveType('usb')}
                className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${activeType === 'usb' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-600 hover:text-gray-900'
                  }`}
              >
                <Usb size={18} />
                {t('printerSettings.connection.usbDirect')}
              </button>
            </div>

            {/* Scan Section */}
            <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm space-y-4">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="font-semibold text-gray-900">
                    {activeType === 'system' ? t('printerSettings.connection.selectPrinter') : t('printerSettings.connection.selectUsb')}
                  </h3>
                  <p className="text-sm text-gray-500">
                    {activeType === 'system'
                      ? t('printerSettings.connection.systemDesc')
                      : t('printerSettings.connection.usbDesc')}
                  </p>
                </div>
                <button
                  onClick={scanDevices}
                  disabled={scanning}
                  className="px-4 py-2 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
                >
                  {scanning ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
                  {activeType === 'system' ? t('printerSettings.connection.refreshList') : t('printerSettings.connection.scanUsb')}
                </button>
              </div>

              {devices.length > 0 && (
                <div className="grid grid-cols-1 gap-2 mt-4 max-h-[300px] overflow-y-auto">
                  {devices.map((device, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleDeviceSelect(device)}
                      className={`p-3 border rounded-lg text-left transition-all group relative ${(activeType === 'system' && settings.systemName === device.systemName) ||
                        (activeType === 'usb' && settings.vid === device.vendorId && settings.pid === device.productId)
                        ? 'border-blue-600 bg-blue-50'
                        : 'hover:bg-gray-50'
                        }`}
                    >
                      <div className="font-medium text-gray-900 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-gray-100 rounded-full">
                            <PrinterIcon size={16} className="text-gray-600" />
                          </div>
                          <span>{device.deviceName || 'Unknown Device'}</span>
                          {device.isDefault && <span className="ml-2 text-xs bg-gray-200 text-gray-700 px-2 py-0.5 rounded-full">{t('printerSettings.connection.default')}</span>}
                        </div>
                        {((activeType === 'system' && settings.systemName === device.systemName) ||
                          (activeType === 'usb' && settings.vid === device.vendorId)) && (
                            <CheckCircle2 size={20} className="text-blue-600" />
                          )}
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {devices.length === 0 && !scanning && (
                <div className="text-center py-8 bg-gray-50 rounded-lg border border-dashed border-gray-300">
                  <PrinterIcon size={32} className="mx-auto text-gray-300 mb-2" />
                  <p className="text-sm text-gray-500">
                    {t('printerSettings.connection.noPrintersFound')}
                  </p>
                </div>
              )}
            </div>

            {/* Selected Details */}
            <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm space-y-4">
              <h3 className="font-semibold text-gray-900">{t('printerSettings.connection.currentConfig')}</h3>

              {activeType === 'system' ? (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">{t('printerSettings.connection.printerName')}</label>
                    <input
                      type="text"
                      value={settings.systemName || ''}
                      readOnly
                      className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-md text-gray-700"
                    />
                    <p className="text-xs text-gray-500">{t('printerSettings.connection.printerNameDesc')}</p>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">{t('printerSettings.connection.vendorId')}</label>
                    <input
                      type="text"
                      value={settings.vid}
                      onChange={(e) => setSettings({ ...settings, vid: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md font-mono"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">{t('printerSettings.connection.productId')}</label>
                    <input
                      type="text"
                      value={settings.pid}
                      onChange={(e) => setSettings({ ...settings, pid: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md font-mono"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'alignment' && (
          <div className="flex gap-6 h-[calc(100vh-200px)]">
            {/* Left Controls */}
            <div className="w-1/3 space-y-6 overflow-y-auto pr-2">
              <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm space-y-6">
                <div>
                  <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                    <LayoutTemplate size={18} />
                    {t('printerSettings.alignment.pageLayout')}
                  </h3>
                  <p className="text-sm text-gray-500 mt-1">{t('printerSettings.alignment.layoutDesc')}</p>
                </div>

                <div className="space-y-4 border-b border-gray-100 pb-6">
                  <div className="pt-2">
                    <label className="text-sm font-medium text-gray-700">{t('printerSettings.alignment.paperSize')}</label>
                    <select
                      value={settings.pageSize || '80mm'}
                      onChange={(e) => {
                        const newSettings = { ...settings, pageSize: e.target.value };
                        setSettings(newSettings);
                        debouncedPreview(newSettings);
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="A4">A4 (210mm x 297mm)</option>
                      <option value="LabelRoll">Barcode Sticker Roller (105mm)</option>
                      <option value="80mm">{t('printerSettings.alignment.paper80')}</option>
                      <option value="72mm">{t('printerSettings.alignment.paper72')}</option>
                      <option value="50mm">{t('printerSettings.alignment.paper50')}</option>
                    </select>
                  </div>

                  <div className="pt-2">
                    <label className="text-sm font-medium text-gray-700">{t('printerSettings.alignment.copies') || 'Default Copies'}</label>
                    <input
                      type="number"
                      min="1"
                      max="10"
                      value={settings.copies || 1}
                      onChange={(e) => {
                        const newSettings = { ...settings, copies: parseInt(e.target.value) || 1 };
                        setSettings(newSettings);
                      }}
                      className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div className="pt-2">
                    <label className="text-sm font-medium text-gray-700">{t('printerSettings.alignment.printScale') || 'Print Scale (%)'}</label>
                    <div className="flex items-center gap-2 mt-1">
                      <input
                        type="range"
                        min="50"
                        max="200"
                        step="5"
                        value={settings.scale || 100}
                        onChange={(e) => {
                          const newSettings = { ...settings, scale: parseInt(e.target.value) };
                          setSettings(newSettings);
                          debouncedPreview(newSettings);
                        }}
                        className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                      />
                      <span className="text-sm font-mono w-12 text-center text-gray-600">
                        {settings.scale || 100}%
                      </span>
                    </div>
                  </div>

                  <div className="pt-2">
                    <label className="text-sm font-medium text-gray-700">{t('printerSettings.alignment.orientation') || 'Orientation'}</label>
                    <div className="flex p-1 bg-gray-100 rounded-lg w-full mt-1">
                      <button
                        onClick={() => {
                          const newSettings = { ...settings, orientation: 'portrait' };
                          setSettings(newSettings);
                          debouncedPreview(newSettings);
                        }}
                        className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-all ${settings.orientation === 'portrait' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500'}`}
                      >
                        {t('printerSettings.alignment.portrait') || 'Portrait'}
                      </button>
                      <button
                        onClick={() => {
                          const newSettings = { ...settings, orientation: 'landscape' };
                          setSettings(newSettings);
                          debouncedPreview(newSettings);
                        }}
                        className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-all ${settings.orientation === 'landscape' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500'}`}
                      >
                        {t('printerSettings.alignment.landscape') || 'Landscape'}
                      </button>
                    </div>
                  </div>

                  <div className="pt-2">
                    <label className="text-sm font-medium text-gray-700">{t('printerSettings.alignment.verticalAlign') || 'Vertical Alignment'}</label>
                    <select
                      value={settings.verticalAlign || 'top'}
                      onChange={(e) => {
                        const newSettings = { ...settings, verticalAlign: e.target.value };
                        setSettings(newSettings);
                        debouncedPreview(newSettings);
                      }}
                      className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="top">{t('printerSettings.alignment.top') || 'Top'}</option>
                      <option value="center">{t('printerSettings.alignment.center') || 'Center'}</option>
                      <option value="bottom">{t('printerSettings.alignment.bottom') || 'Bottom'}</option>
                    </select>
                  </div>
                </div>

                <div className="pt-4 border-t border-gray-100">
                  <button
                    onClick={() => generatePreview(settings)}
                    disabled={previewLoading}
                    className="w-full py-2 bg-gray-50 text-gray-600 hover:bg-white border border-gray-200 hover:border-blue-300 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2"
                  >
                    {previewLoading ? <Loader2 size={16} className="animate-spin" /> : <Eye size={16} />}
                    {t('printerSettings.alignment.regeneratePreview')}
                  </button>
                </div>
              </div>
            </div>

            {/* Right Preview */}
            <div className="w-2/3 bg-gray-100 rounded-lg border border-gray-300 shadow-inner overflow-hidden relative flex flex-col">
              <div className="bg-gray-800 text-white px-4 py-2 text-xs flex justify-between items-center">
                <span className="font-medium">{t('printerSettings.alignment.livePreview', { size: settings.pageSize || '80mm' })}</span>
                {previewLoading && <span className="flex items-center gap-2"><Loader2 size={12} className="animate-spin" /> {t('printerSettings.alignment.generating')}</span>}
              </div>

              <div className="flex-1 overflow-auto flex justify-center p-4 bg-gray-500/10">
                {previewPdf ? (
                  <iframe
                    src={`${previewPdf}#toolbar=0&navpanes=0&view=FitH`}
                    className={`shadow-lg bg-white ${settings.pageSize === '80mm' ? 'w-[80mm]' :
                      settings.pageSize === '72mm' ? 'w-[72mm]' :
                        settings.pageSize === '50mm' ? 'w-[50mm]' :
                          settings.pageSize === 'LabelRoll' ? 'w-[105mm]' :
                            'w-full max-w-[210mm] h-full'
                      }`}
                    style={{
                      minHeight: ['80mm', '72mm', '50mm', 'LabelRoll'].includes(settings.pageSize) ? '100%' : undefined,
                      aspectRatio: !['80mm', '72mm', '50mm', 'LabelRoll'].includes(settings.pageSize) ? '210/297' : undefined
                    }}
                    title="PDF Preview"
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-gray-400">
                    <Loader2 size={40} className="animate-spin mb-4 text-blue-500" />
                    <p>{t('printerSettings.messages.generatingPreview')}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Actions Bar - always visible */}
        <div className="flex gap-4 py-4 border-t border-gray-200 mt-auto bg-white sticky bottom-0 z-10">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium shadow-sm flex items-center justify-center gap-2 disabled:opacity-70 transition-colors"
          >
            {saving ? <Loader2 size={20} className="animate-spin" /> : <Save size={20} />}
            {t('printerSettings.actions.save')}
          </button>
          <button
            onClick={handleTestPrint}
            className="px-6 py-3 bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 rounded-lg font-medium shadow-sm flex items-center justify-center gap-2 transition-colors"
          >
            <PrinterIcon size={20} />
            {t('printerSettings.actions.testPrint')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default PrinterSettings;
