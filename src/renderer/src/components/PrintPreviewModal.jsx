import React, { useState, useEffect } from 'react';
import {
  X,
  Printer,
  Settings,
  Maximize,
  Minimize,
  Minus,
  Plus,
  Loader2,
  Check,
  Download
} from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';

const PrintPreviewModal = React.forwardRef(({ isOpen, onClose, pdfUrl, title, pdfBase64, contentHeight = null, contentWidth = null, autoPrint = false, initialPaperSize = null }, ref) => {
  const { t } = useTranslation();
  const isBarcode = initialPaperSize === 'LabelRoll';
  const displayTitle = title || (isBarcode ? t('barcode.stickerRoller.title') : t('printModal.title'));
  const successMessage = isBarcode ? t('printModal.barcodesReady') : t('printModal.successMessage');
  const [loading, setLoading] = useState(false);
  const [printers, setPrinters] = useState([]);
  const [isPrinting, setIsPrinting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [savedSettings, setSavedSettings] = useState(null);

  // Print Settings State
  const [settings, setSettings] = useState({
    printer: '',
    copies: 1,
    paperSize: '80mm', // 80mm or 50mm thermal printer
    orientation: 'portrait', // portrait, landscape
    scale: 100, // percentage
    verticalAlign: 'top', // top, center, bottom

    // Margins (mm)
    margins: {
      top: 0,
      bottom: 0,
      left: 0,
      right: 0
    }
  });

  // Load Printers when modal opens
  useEffect(() => {
    if (isOpen) {
      loadPrinters();
    }
  }, [isOpen]);

  const loadPrinters = async () => {
    try {
      // Fetch system printers
      const deviceList = await window.api.scanSystemPrinters();

      // Fetch saved printer settings for defaults
      const savedSettings = await window.api.getPrinterSettings();

      if (deviceList && deviceList.length > 0) {
        setPrinters(deviceList);

        // Determine default printer:
        // 1. Prefer saved systemName from settings
        // 2. Fallback to OS default printer
        // 3. Fallback to first printer in list
        const savedPrinterName = savedSettings?.systemName;
        const defaultPrinter = deviceList.find(p => p.systemName === savedPrinterName) ||
          deviceList.find(p => p.isDefault) ||
          deviceList[0];

        setSettings(prev => ({
          ...prev,
          printer: defaultPrinter.systemName,
          paperSize: initialPaperSize || savedSettings?.pageSize || prev.paperSize
        }));
        setSavedSettings(savedSettings);
      } else {
        toast.warning(t('printModal.messages.noPrinters'));
      }
    } catch (error) {
      console.error('Failed to load printers:', error);
      toast.error(t('printModal.messages.loadPrintersFailed'));
    }
  };

  const handlePrint = async () => {
    if (!settings.printer) {
      toast.error(t('printModal.messages.selectPrinter'));
      return;
    }

    if (!pdfBase64 && !pdfUrl) {
      toast.error(t('printModal.messages.noDocument'));
      return;
    }

    try {
      setIsPrinting(true);

      // If we only have URL (blob), we might need base64 for the IPC handler
      let dataToPrint = pdfBase64;

      if (!dataToPrint && pdfUrl) {
        // Fetch blob from URL and convert to base64
        const blob = await fetch(pdfUrl).then(r => r.blob());
        dataToPrint = await new Promise((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result.split(',')[1]);
          reader.readAsDataURL(blob);
        });
      }

      const printPayload = {
        pdfData: dataToPrint,
        settings: {
          deviceName: settings.printer,
          copies: parseInt(settings.copies),
          pageSize: settings.paperSize,
          contentHeight: contentHeight,
          landscape: settings.orientation === 'landscape',
          scaleFactor: parseInt(settings.scale),
          verticalAlign: settings.verticalAlign,
          printBackground: false, // Fix for black layout artifacts
          margins: {
            top: parseFloat(settings.margins.top),
            bottom: parseFloat(settings.margins.bottom),
            left: parseFloat(settings.margins.left),
            right: parseFloat(settings.margins.right)
          }
        }
      };

      // New Flow: Save to Temp -> Print File
      const saveResult = await window.api.saveTempPDF(printPayload.pdfData);

      let result;
      if (saveResult.success) {
        console.log("Preview Modal: Printing from file:", saveResult.filePath);
        result = await window.api.printPDFFile(saveResult.filePath, printPayload.settings);
      } else {
        console.error("Preview Modal: Save temp failed, falling back");
        result = await window.api.printPDF(printPayload.pdfData, printPayload.settings);
      }

      if (result.success) {
        toast.success(t('printModal.messages.printSuccess'));
        onClose();
      } else {
        toast.error(t('printModal.messages.printFailed', { message: result.message }));
      }

    } catch (error) {
      console.error('Print Error:', error);
      toast.error(t('printModal.messages.printError'));
    } finally {
      setIsPrinting(false);
    }
  };

  // Auto-print when modal opens if autoPrint is true
  useEffect(() => {
    if (isOpen && autoPrint && pdfBase64 && settings.printer) {
      // Small delay to ensure modal is fully rendered
      const timer = setTimeout(() => {
        handlePrint();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [isOpen, autoPrint, pdfBase64, settings.printer]);

  // Expose handlePrint to parent via ref
  React.useImperativeHandle(ref, () => ({
    print: handlePrint
  }));

  const handleSaveSettings = async () => {
    try {
      setIsSaving(true);

      // Fetch current full settings from DB to make sure we don't overwrite margins/others
      const currentFullSettings = await window.api.getPrinterSettings() || {};

      const updatedSettings = {
        ...currentFullSettings,
        systemName: settings.printer,
        pageSize: settings.paperSize,
        // Update name for UI display in settings page
        name: printers.find(p => p.systemName === settings.printer)?.deviceName || currentFullSettings.name
      };

      const res = await window.api.savePrinterSettings(updatedSettings);

      if (res.success) {
        toast.success(t('printModal.messages.settingsSaved'));
        setSavedSettings(updatedSettings);
      } else {
        toast.error(t('printModal.messages.saveFailed'));
      }
    } catch (error) {
      console.error('Save settings error:', error);
      toast.error(t('printModal.messages.saveError'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleDownload = () => {
    if (!pdfUrl) {
      toast.error(t('printModal.messages.noDownload'));
      return;
    }

    try {
      // Create a temporary anchor element to trigger download
      const link = document.createElement('a');
      link.href = pdfUrl;
      link.download = `${displayTitle.replace(/\s+/g, '_')}_${Date.now()}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast.success(t('printModal.messages.downloadStarted'));
    } catch (error) {
      console.error('Download Error:', error);
      toast.error(t('printModal.messages.downloadFailed'));
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white w-[95vw] h-[90vh] rounded-xl shadow-2xl flex flex-col overflow-hidden">

        {/* Header */}
        <div className="bg-gray-900 text-white px-6 py-4 flex justify-between items-center shrink-0">
          <div className="flex items-center gap-3">
            <div className="bg-white/10 p-2 rounded-lg">
              <Printer size={20} className="text-blue-300" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">{displayTitle}</h2>
              <p className="text-xs text-gray-400">{t('printModal.subtitle')}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-full transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Success Banner */}
        <div className="bg-green-50 border-b border-green-100 px-6 py-2 flex items-center justify-center gap-2 text-green-700 text-sm font-medium animate-in slide-in-from-top-2">
          <div className="bg-green-100 p-1 rounded-full">
            <Check size={14} className="text-green-600" />
          </div>
          {successMessage}
        </div>

        {/* Body */}
        <div className="flex-1 flex overflow-hidden">

          {/* Left Sidebar: Settings */}
          <div className="w-80 bg-gray-50 border-r border-gray-200 flex flex-col overflow-y-auto">
            <div className="p-6 space-y-8">

              {/* Printer Selection */}
              <div className="space-y-3">
                <label className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                  <Printer size={16} /> {t('printModal.printer')}
                </label>
                <select
                  value={settings.printer}
                  onChange={(e) => setSettings({ ...settings, printer: e.target.value })}
                  className="w-full p-2.5 bg-white border border-gray-300 rounded-lg text-sm text-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all shadow-sm"
                >
                  <option value="" disabled>{t('printModal.selectPrinter')}</option>
                  {printers.map((p, idx) => (
                    <option key={idx} value={p.systemName}>
                      {p.deviceName}
                    </option>
                  ))}
                </select>
                {/* Status Indicator (Mock) */}
                {settings.printer && (
                  <div className="flex items-center gap-2 text-xs text-green-600 bg-green-50 px-2 py-1 rounded w-fit">
                    <div className="w-1.5 h-1.5 bg-green-500 rounded-full"></div>
                    {t('printModal.ready')}
                  </div>
                )}
              </div>

              <div className="h-px bg-gray-200"></div>

              {/* Basic Settings */}
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">{t('printModal.paper')}</label>
                  <select
                    value={settings.paperSize}
                    onChange={(e) => setSettings({ ...settings, paperSize: e.target.value })}
                    className="w-full p-2 bg-white border border-gray-300 rounded-lg text-sm outline-none focus:border-blue-500"
                  >
                    <option value="A4">{t('printModal.paperA4') || 'A4'}</option>
                    <option value="LabelRoll">{t('printModal.paperLabelRoll') || 'Barcode Sticker Roller (105mm)'}</option>
                    <option value="80mm">{t('printModal.paper80')}</option>
                    <option value="72mm">{t('printModal.paper72')}</option>
                    <option value="50mm">{t('printModal.paper50')}</option>
                  </select>
                </div>

                <div className="pt-2">
                  <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">{t('printModal.copies') || 'Copies'}</label>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    value={settings.copies}
                    onChange={(e) => setSettings({ ...settings, copies: parseInt(e.target.value) || 1 })}
                    className="w-full mt-1 p-2 bg-white border border-gray-300 rounded-lg text-sm outline-none focus:border-blue-500"
                  />
                </div>

                <div className="pt-2">
                  <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">{t('printModal.scale') || 'Scale'}</label>
                  <div className="flex items-center gap-2 mt-1">
                    <input
                      type="range"
                      min="50"
                      max="200"
                      step="5"
                      value={settings.scale}
                      onChange={(e) => setSettings({ ...settings, scale: parseInt(e.target.value) })}
                      className="flex-1 h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                    />
                    <span className="text-xs font-mono w-10 text-right text-gray-500">
                      {settings.scale}%
                    </span>
                  </div>
                </div>
              </div>

              {/* Conditional Save Settings Button */}
              {(settings.printer !== savedSettings?.systemName || settings.paperSize !== savedSettings?.pageSize) && (
                <div className="px-6 pb-4 animate-in fade-in slide-in-from-top-2">
                  <button
                    onClick={handleSaveSettings}
                    disabled={isSaving || !settings.printer}
                    className="w-full py-2 bg-blue-50 text-blue-600 hover:bg-blue-100 border border-blue-200 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-all"
                  >
                    {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Settings size={14} />}
                    {t('printModal.setDefault')}
                  </button>
                  <p className="text-[10px] text-gray-400 mt-1.5 text-center">{t('printModal.saveSettingsHelp')}</p>
                </div>
              )}

            </div>

            {/* Action Buttons */}
            <div className="mt-auto p-4 border-t border-gray-200 bg-white sticky bottom-0">
              <button
                onClick={handlePrint}
                disabled={isPrinting}
                className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold shadow-lg shadow-blue-200 flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {isPrinting ? <Loader2 size={20} className="animate-spin" /> : <Printer size={20} />}
                {isPrinting ? t('printModal.printing') : t('printModal.printDocument')}
              </button>
              <button
                onClick={handleDownload}
                disabled={isPrinting}
                className="w-full mt-3 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold shadow-lg shadow-green-200 flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed"
              >
                <Download size={20} />
                {t('printModal.downloadPdf')}
              </button>
              <button
                onClick={onClose}
                disabled={isPrinting}
                className="w-full mt-3 py-2 text-gray-500 hover:text-gray-800 font-medium text-sm transition-colors"
              >
                {t('printModal.close')}
              </button>
            </div>
          </div>

          {/* Right Preview */}
          <div className="flex-1 bg-gray-100/50 p-8 flex flex-col items-center relative overflow-y-auto">

            {/* Preview Container simulating paper */}
            <div
              className="bg-white shadow-xl transition-all duration-300 origin-top relative group shrink-0"
              style={{
                // Basic simulation of scale
                transform: `scale(${settings.scale / 100})`,
                marginBottom: '2rem', // Add bottom spacing
                // Thermal receipt aspect ratio vs A4
                // If contentHeight is provided (pts), convert to px (approx 1.33 px/pt at 96dpi)
                height: settings.paperSize === 'A4' ? '841.89pt' : (contentHeight ? `${contentHeight * (96 / 72)}px` : '100%'),
                minHeight: settings.paperSize === 'A4' ? '841.89pt' : (contentHeight ? `${contentHeight * (96 / 72)}px` : '500px'),
                width: settings.paperSize === 'A4' ? '595.28pt' : (settings.paperSize === 'LabelRoll' ? '105mm' : settings.paperSize === '50mm' ? '50mm' : settings.paperSize === '72mm' ? '72mm' : '80mm')
              }}
            >
              {pdfUrl ? (
                <iframe
                  src={`${pdfUrl}#toolbar=0&navpanes=0&view=FitH`}
                  className="w-full h-full" // Removed pointer-events-none to allow scrolling
                  title="Preview Interface"
                  style={{
                    // Apply margins visually if possible? 
                    // It's hard to modify iframe contents margins from here without regenerating PDF.
                    // So we just show the PDF as is. The user margins are adding WHITE SPACE around it by printer driver.
                    // We can simulate that by adding padding to the container to show "printer margins".
                    // Let's try adding padding to the container to show "printer margins".
                    // Assuming 1mm ~ 3.78px
                    paddingTop: `${settings.margins.top * 3.78}px`,
                    paddingBottom: `${settings.margins.bottom * 3.78}px`,
                    paddingLeft: `${settings.margins.left * 3.78}px`,
                    paddingRight: `${settings.margins.right * 3.78}px`,
                    boxSizing: 'border-box'
                  }}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-400">
                  <Loader2 size={40} className="animate-spin text-blue-200" />
                </div>
              )}

            </div>


          </div>

        </div>
      </div>
    </div>
  );
});

export default PrintPreviewModal;
