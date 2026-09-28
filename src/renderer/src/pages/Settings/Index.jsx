import React, { useState, useEffect, useCallback } from 'react';
import { Store, User, Lock, Save, Loader2, RefreshCw, Printer, Eye, FileText, RotateCcw, LayoutTemplate, Shield, Type } from 'lucide-react';
import AccessibilitySettings from './AccessibilitySettings';
import { toast } from 'sonner';
import settingsService from '../../services/settingsService';
import templateService from '../../services/templateService';
import MyProfile from './MyProfile';
import ChangePassword from './ChangePassword';
import PrinterSettings from './PrinterSettings';
import License from './License';
import { useTranslation } from 'react-i18next';

const Settings = () => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState('store');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Template States
  const [templateTab, setTemplateTab] = useState('sales_order'); // 'sales_order'
  const [templateSettings, setTemplateSettings] = useState({
    template_name: '80mm',
    config: {
      fontFamily: 'Helvetica',
      showTax: true,
      showDiscount: true,
      showGst: true,
      showHsn: false,
      showOutstanding: false,
      headerText: 'Tax Invoice',
      footerText: 'Thank you for your business!',
      // Custom Table Headers
      headerDescription: '',
      headerHsn: '',
      headerQty: '',
      headerRate: '',
      headerPer: '',
      headerGst: '',
      headerAmount: '',
      headerSl: '',
      headerTax: '',
      descLimit: 45,
      bankDetails: {
        bankName: '',
        accountHolder: '',
        accountNumber: '',
        ifscCode: '',
        branch: ''
      },
      netPayableDays: 30
    }
  });
  const [templateLoading, setTemplateLoading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewDimensions, setPreviewDimensions] = useState(null);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  const [storeDetails, setStoreDetails] = useState({
    store_name: 'Rabtoise Technologies',
    address_line1: '70c main, road - 621297, New Data, Trichy City, TN State - 123456',
    address_line2: 'K.VADAMADURAI CHATIRAM',
    city: 'ERODE',
    state: 'TAMIL NADU',
    pincode: '638316',
    district: 'ERODE',
    pan: 'AAXXP1791H',
    phone: '',
    email: 'support@rabtoise.org',
    website: '',
    gstin: '22AAAAA0000A1Z5',
    god_name: '',
    fassai_no: ''
  });

  // Mock Order Data for Preview
  const mockOrder = {
    id: 999,
    orderNumber: 'PREVIEW-001',
    orderDate: new Date().toISOString(),
    orderTime: '10:30 AM',
    customer: {
      id: 'walk-in',
      name: 'Walk-in Customer',
      phone: '9876543210',
      email: 'customer@example.com',
      address: '456 Customer St, City',
      gstin: '',
      balance: 0
    },
    items: [
      {
        product_id: 1,
        product_name: 'Premium Basmati Rice',
        product_code: 'RICE001',
        hsnCode: '1006',
        quantity: 2,
        unit_price: 150.00,
        mrp: 180.00,
        discount_percent: 0,
        discount_amount: 0,
        tax_rate: 5,
        sgst_amount: 7.50,
        cgst_amount: 7.50,
        igst_amount: 0,
        tax_amount: 15.00,
        final_amount: 315.00
      },
      {
        product_id: 2,
        product_name: 'Sunflower Oil 1L',
        product_code: 'OIL001',
        hsnCode: '1507',
        quantity: 1,
        unit_price: 120.00,
        mrp: 140.00,
        discount_percent: 5,
        discount_amount: 6.00,
        tax_rate: 5,
        sgst_amount: 2.85,
        cgst_amount: 2.85,
        igst_amount: 0,
        tax_amount: 5.70,
        final_amount: 119.70
      }
    ],
    calculations: {
      subtotal: 420.00,
      amountBeforeTax: 414.00,
      billDiscountAmount: 0,
      billDiscount: 0,
      billDiscountType: 'flat',
      roundOffAmount: 0,
      taxDetails: {
        totalTaxAmount: 20.70,
        totalSgst: 10.35,
        totalCgst: 10.35,
        totalIgst: 0
      },
      grandTotal: 434.70
    },
    payment: {
      paymentType: 'single',
      paymentMethod: 'cash',
      receivedAmount: 500.00,
      changeAmount: 65.30,
      balanceAmount: 0
    },
    status: 'completed',
    payment_status: 'paid'
  };

  useEffect(() => {
    if (activeTab === 'store') {
      fetchStoreDetails();
    } else if (activeTab === 'templates') {
      fetchStoreDetails(); // Need store details for preview
      fetchTemplateSettings();
    }
  }, [activeTab, templateTab]);

  // Debounced preview generation
  useEffect(() => {
    if (activeTab === 'templates') {
      const timer = setTimeout(() => {
        generatePreview();
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [storeDetails, templateSettings, activeTab]);

  const fetchStoreDetails = async () => {
    try {
      setLoading(true);
      const response = await settingsService.getStoreDetails();
      if (response.success && response.data) {
        // Merge DB data into defaults so any missing columns stay as empty strings
        setStoreDetails(prev => ({
          ...prev,
          ...response.data,
          god_name: response.data.god_name ?? '',
          fassai_no: response.data.fassai_no ?? ''
        }));
      }
    } catch (error) {
      console.error('Error fetching store details:', error);
      toast.error(t('settings.messages.loadStoreFailed'));
    } finally {
      setLoading(false);
    }
  };

  const fetchTemplateSettings = async () => {
    try {
      setTemplateLoading(true);
      const response = await templateService.getSettings(templateTab);
      if (response.success && response.data) {
        setTemplateSettings({
          template_name: response.data.template_name || '80mm',
          config: response.data.config || {
            fontFamily: 'Helvetica',
            showTax: true,
            showDiscount: true,
            showGst: true,
            showHsn: false,
            showOutstanding: false,
            headerText: 'Tax Invoice',
            footerText: 'Thank you for your business!'
          }
        });
      }
    } catch (error) {
      console.error('Error fetching template settings:', error);
      toast.error(t('settings.messages.loadTemplateFailed'));
    } finally {
      setTemplateLoading(false);
    }
  };

  const generatePreview = async () => {
    try {
      setPreviewLoading(true);

      // Clone mock order
      const previewOrder = JSON.parse(JSON.stringify(mockOrder));

      // Apply current store details
      previewOrder.storeDetails = {
        store: storeDetails.store_name || 'Your Store Name',
        address: `${storeDetails.address_line1 || ''}${storeDetails.address_line2 ? ', ' + storeDetails.address_line2 : ''}, ${storeDetails.city || ''}, ${storeDetails.state || ''} - ${storeDetails.pincode || ''}`,
        phone: storeDetails.phone || '',
        email: storeDetails.email || '',
        website: storeDetails.website || '',
        gstin: storeDetails.gstin || '',
        god_name: storeDetails.god_name || '',
        fassai_no: storeDetails.fassai_no || '',
        counter: 'Counter 1',
        cashier: 'Admin'
      };

      // Map items to match pdfGenerator expectations for Sales Order
      previewOrder.items = previewOrder.items.map(item => ({
        ...item,
        productName: item.product_name,
        productCode: item.product_code,
        unitPrice: item.unit_price,
        finalAmount: item.final_amount
      }));

      // Apply Preview Options Logic (Shared logic for toggle effects)
      if (!templateSettings.config.showTax) {
        previewOrder.items.forEach(item => {
          item.tax_rate = 0;
          item.tax_amount = 0;
          item.sgst_amount = 0;
          item.cgst_amount = 0;
          item.igst_amount = 0;
        });
        previewOrder.calculations.taxDetails = {
          totalTaxAmount: 0,
          totalSgst: 0,
          totalCgst: 0,
          totalIgst: 0
        };
        previewOrder.calculations.grandTotal = previewOrder.calculations.subtotal - previewOrder.calculations.billDiscountAmount;
      }

      if (!templateSettings.config.showDiscount) {
        previewOrder.items.forEach(item => {
          item.discount_amount = 0;
          item.discount_percent = 0;
        });
        previewOrder.calculations.billDiscountAmount = 0;
        previewOrder.calculations.billDiscount = 0;
        previewOrder.calculations.grandTotal = previewOrder.calculations.subtotal + (templateSettings.config.showTax ? 20.70 : 0);
      }

      // Check if this is an A4 GST or Non-GST invoice template
      const isGstInvoice = templateSettings.template_name === 'A4-GST';
      const isNonGstInvoice = templateSettings.template_name === 'A4-NonGST';

      let previewData;
      if (isGstInvoice || isNonGstInvoice) {
        // Prepare invoice data for GST/Non-GST templates
        previewData = {
          company: {
            name: storeDetails.store_name || 'LUCTUS INDIA',
            god_name: storeDetails.god_name || '',
            address: storeDetails.address_line1 || 'NO.1, MANICKCAM PALAYAM',
            address2: storeDetails.address_line2 || 'K.VADAMADURAI CHATIRAM',
            city: `${storeDetails.city || 'ERODE'} - ${storeDetails.pincode || '638316'}`,
            district: `DIST:${storeDetails.city || 'ERODE'}, ${storeDetails.state || 'TAMIL NADU'}`,
            gstin: storeDetails.gstin || '33ASZPK7ROPIZM',
            fassai_no: storeDetails.fassai_no || '',
            pan: storeDetails.pan || 'AAXXP1791H',
            email: storeDetails.email || 'info@luctusindia.com'
          },
          invoiceNumber: 'INV-PREVIEW-001',
          date: new Date().toLocaleDateString('en-GB'),
          items: previewOrder.items.map(item => ({
            description: item.product_name,
            hsn: item.hsnCode || '',
            quantity: item.quantity.toString(),
            rate: item.unit_price.toFixed(2),
            per: 'PCS',
            gst: item.tax_rate ? `${item.tax_rate}%` : '',
            amount: item.final_amount.toFixed(2)
          })),
          total: previewOrder.calculations.grandTotal.toFixed(2),
          buyer: {
            name: previewOrder.customer.name || 'Walk-in Customer',
            address: previewOrder.customer.address || '456 Customer St, Business District, City - 123456',
            phone: previewOrder.customer.phone || '9876543210',
            gstin: previewOrder.customer.gstin || '33BBCCDD1234E1Z'
          }
        };

        // Add GST breakdown for GST invoice
        if (isGstInvoice) {
          previewData.gstBreakdown = [
            {
              hsn: '1006',
              taxableValue: previewOrder.calculations.amountBeforeTax.toFixed(2),
              cgstRate: '2.5%',
              cgstAmount: previewOrder.calculations.taxDetails.totalCgst.toFixed(2),
              sgstRate: '2.5%',
              sgstAmount: previewOrder.calculations.taxDetails.totalSgst.toFixed(2)
            }
          ];
          previewData.gstTotal = {
            taxableValue: previewOrder.calculations.amountBeforeTax.toFixed(2),
            cgstRate: '2.5%',
            cgstAmount: previewOrder.calculations.taxDetails.totalCgst.toFixed(2),
            sgstRate: '2.5%',
            sgstAmount: previewOrder.calculations.taxDetails.totalSgst.toFixed(2)
          };
        }
      } else {
        previewData = previewOrder;
      }

      console.log('📄 Generating preview for template:', templateSettings.template_name);
      console.log('📄 Preview data type:', isGstInvoice ? 'GST Invoice' : isNonGstInvoice ? 'Non-GST Invoice' : 'Sales Order');

      const response = await templateService.generatePreview(
        previewData,
        templateSettings.template_name,
        templateSettings.config
      );

      console.log('📄 Preview response:', response.success ? 'Success' : 'Failed', response.message || '');

      if (response.success && response.data) {
        const blob = new Blob([response.data], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        setPreviewUrl(url);
        setPreviewDimensions(response.dimensions || null);
      } else {
        console.error('Preview generation failed:', response.message);
        toast.error(response.message || 'Failed to generate preview');
      }
    } catch (error) {
      console.error('Error generating preview:', error);
      toast.error('Error generating preview: ' + error.message);
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleStoreChange = (e) => {
    const { name, value } = e.target;
    setStoreDetails(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSaveStoreDetails = async (e) => {
    e.preventDefault();
    try {
      setSaving(true);
      const response = await settingsService.updateStoreDetails(storeDetails);
      if (response.success) {
        toast.success(t('settings.messages.storeUpdateSuccess'));
      } else {
        toast.error(response.message || t('settings.messages.storeUpdateFailed'));
      }
    } catch (error) {
      console.error('Error updating store details:', error);
      toast.error(t('settings.messages.saveError'));
    } finally {
      setSaving(false);
    }
  };

  const handleSaveTemplateSettings = async () => {
    try {
      setSaving(true);
      const response = await templateService.saveSettings({
        documentType: templateTab,
        templateName: templateSettings.template_name,
        config: templateSettings.config
      });

      if (response.success) {
        toast.success(t('settings.messages.templateSaveSuccess'));
      } else {
        toast.error(response.message || t('settings.messages.templateSaveFailed'));
      }
    } catch (error) {
      console.error('Error saving template settings:', error);
      toast.error(t('settings.messages.saveError'));
    } finally {
      setSaving(false);
    }
  };

  const handleResetTemplateSettings = async () => {
    setShowResetConfirm(false);

    try {
      setSaving(true);
      const response = await templateService.resetSettings(templateTab);
      if (response.success) {
        toast.success(t('settings.messages.resetSuccess'));
        fetchTemplateSettings(); // Reload defaults
      } else {
        toast.error(response.message || t('settings.messages.resetFailed'));
      }
    } catch (error) {
      console.error('Error resetting template settings:', error);
      toast.error(t('settings.messages.resetError'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-6 max-w-[1600px] mx-auto h-[calc(100vh-64px)] overflow-hidden flex flex-col">
      <h1 className="text-2xl font-bold mb-6 text-gray-800 flex-shrink-0">{t('settings.title')}</h1>

      <div className="flex flex-col md:flex-row gap-6 flex-1 min-h-0">
        {/* Sidebar Navigation */}
        <div className="w-full md:w-64 flex-shrink-0">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            <button
              onClick={() => setActiveTab('store')}
              className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${activeTab === 'store'
                ? 'bg-blue-50 text-blue-600 border-l-4 border-blue-600 font-medium'
                : 'text-gray-600 hover:bg-gray-50'
                }`}
            >
              <Store size={20} />
              <span>{t('settings.storeDetails')}</span>
            </button>
            <button
              onClick={() => setActiveTab('templates')}
              className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${activeTab === 'templates'
                ? 'bg-blue-50 text-blue-600 border-l-4 border-blue-600 font-medium'
                : 'text-gray-600 hover:bg-gray-50'
                }`}
            >
              <FileText size={20} />
              <span>{t('settings.printTemplates')}</span>
            </button>
            <button
              onClick={() => setActiveTab('profile')}
              className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${activeTab === 'profile'
                ? 'bg-blue-50 text-blue-600 border-l-4 border-blue-600 font-medium'
                : 'text-gray-600 hover:bg-gray-50'
                }`}
            >
              <User size={20} />
              <span>{t('settings.myProfile.title')}</span>
            </button>
            <button
              onClick={() => setActiveTab('password')}
              className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${activeTab === 'password'
                ? 'bg-blue-50 text-blue-600 border-l-4 border-blue-600 font-medium'
                : 'text-gray-600 hover:bg-gray-50'
                }`}
            >
              <Lock size={20} />
              <span>{t('settings.changePassword.title')}</span>
            </button>
            <button
              onClick={() => setActiveTab('accessibility')}
              className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${activeTab === 'accessibility'
                ? 'bg-blue-50 text-blue-600 border-l-4 border-blue-600 font-medium'
                : 'text-gray-600 hover:bg-gray-50'
                }`}
            >
              <Type size={20} />
              <span>{t('settings.accessibility')}</span>
            </button>
            <button
              onClick={() => setActiveTab('printer')}
              className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${activeTab === 'printer'
                ? 'bg-blue-50 text-blue-600 border-l-4 border-blue-600 font-medium'
                : 'text-gray-600 hover:bg-gray-50'
                }`}
            >
              <Printer size={20} />
              <span>{t('settings.printerSettings')}</span>
            </button>
            <button
              onClick={() => setActiveTab('license')}
              className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${activeTab === 'license'
                ? 'bg-blue-50 text-blue-600 border-l-4 border-blue-600 font-medium'
                : 'text-gray-600 hover:bg-gray-50'
                }`}
            >
              <Shield size={20} />
              <span>License</span>
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 flex min-h-0 bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          {activeTab === 'store' && (
            <div className="flex-1 flex flex-col h-full overflow-y-auto p-6">
              <div className="mb-6">
                <h2 className="text-xl font-semibold text-gray-800">{t('settings.storeDetails')}</h2>
                <p className="text-gray-500 text-sm mt-1">{t('settings.store.subtitle')}</p>
              </div>

              {loading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                </div>
              ) : (
                <form onSubmit={handleSaveStoreDetails} className="space-y-6 max-w-4xl">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-700">{t('settings.store.storeName')} *</label>
                      <input
                        type="text"
                        name="store_name"
                        value={storeDetails.store_name}
                        onChange={handleStoreChange}
                        required
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder={t('settings.store.placeholders.storeName')}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-700">God Name <span className="text-gray-400 font-normal">(shown above store name)</span></label>
                      <input
                        type="text"
                        name="god_name"
                        value={storeDetails.god_name || ''}
                        onChange={handleStoreChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="e.g. Jai Ganesh, Sri Rama"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-700">{t('settings.store.gstin')}</label>
                      <input
                        type="text"
                        name="gstin"
                        value={storeDetails.gstin || ''}
                        onChange={handleStoreChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder={t('settings.store.placeholders.gstin')}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-700">FSSAI No.</label>
                      <input
                        type="text"
                        name="fassai_no"
                        value={storeDetails.fassai_no || ''}
                        onChange={handleStoreChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Enter FSSAI licence number"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-700">PAN</label>
                      <input
                        type="text"
                        name="pan"
                        value={storeDetails.pan || ''}
                        onChange={handleStoreChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Enter PAN"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">{t('settings.store.addressLine1')}</label>
                    <input
                      type="text"
                      name="address_line1"
                      value={storeDetails.address_line1 || ''}
                      onChange={handleStoreChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder={t('settings.store.placeholders.addressLine1')}
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">{t('settings.store.addressLine2')}</label>
                    <input
                      type="text"
                      name="address_line2"
                      value={storeDetails.address_line2 || ''}
                      onChange={handleStoreChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder={t('settings.store.placeholders.addressLine2')}
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-700">{t('settings.store.city')}</label>
                      <input
                        type="text"
                        name="city"
                        value={storeDetails.city || ''}
                        onChange={handleStoreChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-700">{t('settings.store.state')}</label>
                      <input
                        type="text"
                        name="state"
                        value={storeDetails.state || ''}
                        onChange={handleStoreChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-700">{t('settings.store.pincode')}</label>
                      <input
                        type="text"
                        name="pincode"
                        value={storeDetails.pincode || ''}
                        onChange={handleStoreChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-700">District</label>
                      <input
                        type="text"
                        name="district"
                        value={storeDetails.district || ''}
                        onChange={handleStoreChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Enter District"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-700">{t('settings.store.phoneNumber')}</label>
                      <input
                        type="text"
                        name="phone"
                        value={storeDetails.phone || ''}
                        onChange={handleStoreChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-700">{t('settings.store.email')}</label>
                      <input
                        type="email"
                        name="email"
                        value={storeDetails.email || ''}
                        onChange={handleStoreChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">{t('settings.store.website')}</label>
                    <input
                      type="url"
                      name="website"
                      value={storeDetails.website || ''}
                      onChange={handleStoreChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder={t('settings.store.placeholders.website')}
                    />
                  </div>

                  <div className="pt-4 border-t border-gray-100 flex justify-end">
                    <button
                      type="submit"
                      disabled={saving}
                      className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium flex items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed transition-colors"
                    >
                      {saving ? (
                        <>
                          <Loader2 size={18} className="animate-spin" />
                          {t('settings.buttons.saving')}
                        </>
                      ) : (
                        <>
                          <Save size={18} />
                          {t('settings.buttons.saveChanges')}
                        </>
                      )}
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}

          {activeTab === 'templates' && (
            <div className="flex-1 flex flex-col lg:flex-row h-full">
              {/* Settings Panel (Left) */}
              <div className="flex-1 p-6 overflow-y-auto border-b lg:border-b-0 lg:border-r border-gray-200">
                <div className="mb-6">
                  <h2 className="text-xl font-semibold text-gray-800">{t('settings.printTemplates')}</h2>
                  <p className="text-gray-500 text-sm mt-1">{t('settings.templates.subtitle')}</p>
                </div>

                {/* Document Type Tabs */}
                <div className="flex border-b border-gray-200 mb-6">
                  <button
                    onClick={() => setTemplateTab('sales_order')}
                    className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${templateTab === 'sales_order'
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                      }`}
                  >
                    {t('settings.templates.salesOrder')}
                  </button>
                </div>

                {templateLoading ? (
                  <div className="flex justify-center py-12">
                    <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                  </div>
                ) : (
                  <div className="space-y-8">
                    {/* Template Style Selector */}
                    <div className="space-y-3">
                      <label className="text-sm font-medium text-gray-700">{t('settings.templates.templateStyle')}</label>
                      {/* Thermal Templates - Only show for sales_order */}
                      {templateTab === 'sales_order' && (
                        <div className="space-y-2">
                          <label className="text-xs text-gray-500 font-medium">Thermal Receipts</label>
                          <div className="grid grid-cols-3 gap-3">
                            {['80mm', '72mm', '50mm'].map((type) => (
                              <button
                                key={type}
                                onClick={() => setTemplateSettings(prev => ({ ...prev, template_name: type }))}
                                className={`flex flex-col items-center justify-center p-4 rounded-lg border-2 transition-all ${templateSettings.template_name === type
                                  ? 'border-blue-600 bg-blue-50 text-blue-700'
                                  : 'border-gray-200 hover:border-gray-300 text-gray-600'
                                  }`}
                              >
                                <FileText size={24} className="mb-2" />
                                <span className="text-sm font-medium">
                                  {type === '80mm' ? t('settings.templates.thermal80mm') :
                                    type === '72mm' ? 'Thermal (72mm)' :
                                      t('settings.templates.thermal50mm')}
                                </span>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* A4 Invoice Templates */}
                      {templateTab === 'sales_order' && (
                        <div className="space-y-2 pt-4 border-t border-gray-200">
                          <label className="text-xs text-gray-500 font-medium">A4 Invoice Templates</label>
                          <div className="grid grid-cols-2 gap-3">
                            {['A4-GST', 'A4-NonGST'].map((type) => (
                              <button
                                key={type}
                                onClick={() => setTemplateSettings(prev => ({ ...prev, template_name: type }))}
                                className={`flex flex-col items-center justify-center p-4 rounded-lg border-2 transition-all ${templateSettings.template_name === type
                                  ? 'border-blue-600 bg-blue-50 text-blue-700'
                                  : 'border-gray-200 hover:border-gray-300 text-gray-600'
                                  }`}
                              >
                                <FileText size={24} className="mb-2" />
                                <span className="text-sm font-medium">
                                  {type === 'A4-GST' ? 'A4 GST Invoice' : 'A4 Non-GST Invoice'}
                                </span>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                    </div>

                    {/* Font Settings - Hide for A4 Templates */}
                    {!templateSettings.template_name?.startsWith('A4') && (
                      <div className="space-y-3">
                        <label className="text-sm font-medium text-gray-700">{t('settings.templates.typography')}</label>
                        <div className="grid grid-cols-1 gap-4">
                          <div>
                            <label className="text-xs text-gray-500 mb-1 block">{t('settings.templates.fontFamily')}</label>
                            <select
                              value={templateSettings.config.fontFamily}
                              onChange={(e) => setTemplateSettings(prev => ({
                                ...prev,
                                config: { ...prev.config, fontFamily: e.target.value }
                              }))}
                              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                              {/* Show Tamil fonts when Tamil is selected, English fonts otherwise */}
                              {templateSettings.config.invoiceLanguage === 'ta' ? (
                                <>
                                  <option value="NotoSansTamil">{t('settings.templates.notoSansTamil') || 'Noto Sans Tamil'}</option>
                                  <option value="MuktaMalar">{t('settings.templates.muktaMalar') || 'Mukta Malar'}</option>
                                </>
                              ) : (
                                <>
                                  <option value="Helvetica">{t('settings.templates.helveticaDefault')}</option>
                                  <option value="Courier">{t('settings.templates.courierMonospace')}</option>
                                  <option value="Times-Roman">{t('settings.templates.timesRoman')}</option>
                                </>
                              )}
                            </select>
                          </div>
                          <div>
                            <label className="text-xs text-gray-500 mb-1 block">{t('settings.templates.invoiceLanguage')}</label>
                            <select
                              value={templateSettings.config.invoiceLanguage || 'en'}
                              onChange={(e) => setTemplateSettings(prev => ({
                                ...prev,
                                config: { ...prev.config, invoiceLanguage: e.target.value }
                              }))}
                              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                              <option value="en">{t('settings.templates.english')}</option>
                              <option value="ta">{t('settings.templates.tamil')}</option>
                            </select>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Display Options - Hide for A4 Templates */}
                    {!templateSettings.template_name?.startsWith('A4') && (
                      <div className="space-y-3">
                        <label className="text-sm font-medium text-gray-700">{t('settings.templates.displayOptions')}</label>
                        <div className="space-y-3">
                          <label className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50">
                            <input
                              type="checkbox"
                              checked={templateSettings.config.showHsn}
                              onChange={(e) => setTemplateSettings(prev => ({
                                ...prev,
                                config: {
                                  ...prev.config,
                                  showHsn: e.target.checked,
                                  // If both HSN and Tax are false, disable GST
                                  showGst: (e.target.checked || prev.config.showTax)
                                    ? prev.config.showGst
                                    : false
                                }
                              }))}
                              className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                            />
                            <div>
                              <span className="text-sm font-medium text-gray-900 block">{t('settings.templates.showHsnCode')}</span>
                              <span className="text-xs text-gray-500">{t('settings.templates.showHsnDesc')}</span>
                            </div>
                          </label>

                          <label className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50">
                            <input
                              type="checkbox"
                              checked={templateSettings.config.showTax}
                              onChange={(e) => setTemplateSettings(prev => ({
                                ...prev,
                                config: {
                                  ...prev.config,
                                  showTax: e.target.checked,
                                  // If both HSN and Tax are false, disable GST
                                  showGst: (e.target.checked || prev.config.showHsn)
                                    ? prev.config.showGst
                                    : false
                                }
                              }))}
                              className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                            />
                            <div>
                              <span className="text-sm font-medium text-gray-900 block">{t('settings.templates.showTaxBreakdown')}</span>
                              <span className="text-xs text-gray-500">{t('settings.templates.showTaxDesc')}</span>
                            </div>
                          </label>

                          <label className={`flex items-center gap-3 p-3 border border-gray-200 rounded-lg cursor-pointer ${!(templateSettings.config.showHsn || templateSettings.config.showTax)
                            ? 'opacity-50 cursor-not-allowed hover:bg-gray-50'
                            : 'hover:bg-gray-50'
                            }`}>
                            <input
                              type="checkbox"
                              checked={templateSettings.config.showGst}
                              disabled={!(templateSettings.config.showHsn || templateSettings.config.showTax)}
                              onChange={(e) => setTemplateSettings(prev => ({
                                ...prev,
                                config: {
                                  ...prev.config,
                                  showGst: e.target.checked
                                }
                              }))}
                              className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                            />
                            <div>
                              <span className="text-sm font-medium text-gray-900 block">{t('settings.templates.showGstin')}</span>
                              <span className="text-xs text-gray-500">{t('settings.templates.showGstinDesc')}</span>
                            </div>
                          </label>
                        </div>
                      </div>
                    )}

                    {/* Header & Footer Text */}
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-700">{t('settings.templates.headerText')}</label>
                        <input
                          type="text"
                          value={templateSettings.config.headerText || ''}
                          onChange={(e) => setTemplateSettings(prev => ({
                            ...prev,
                            config: { ...prev.config, headerText: e.target.value }
                          }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder={t('settings.templates.placeholders.headerText')}
                        />
                      </div>

                      {!templateSettings.template_name?.startsWith('A4') && (
                        <div className="space-y-2">
                          <label className="text-sm font-medium text-gray-700">{t('settings.templates.footerText')}</label>
                          <textarea
                            value={templateSettings.config.footerText || ''}
                            onChange={(e) => setTemplateSettings(prev => ({
                              ...prev,
                              config: { ...prev.config, footerText: e.target.value }
                            }))}
                            rows={3}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder={t('settings.templates.placeholders.footerText')}
                          />
                          <p className="text-xs text-gray-500">
                            {t('settings.templates.footerNote')}
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Custom Table Headers - A4 only */}
                    {templateSettings.template_name?.startsWith('A4') && (
                      <div className="space-y-6 pt-6 border-t border-gray-200 animate-in fade-in slide-in-from-top-4 duration-500">
                        <div className="flex items-center justify-between">
                          <div>
                            <h4 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
                              <LayoutTemplate size={18} className="text-blue-500" />
                              {t('settings.templates.customHeaders')}
                            </h4>
                            <p className="text-[11px] text-gray-500 mt-0.5">{t('settings.templates.customHeadersDesc')}</p>
                          </div>
                        </div>

                        <div className="space-y-4 max-w-2xl">
                          <div className="grid grid-cols-2 items-center gap-4 py-1 border-b border-gray-50 last:border-0">
                            <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-tight">{t('settings.templates.headerSl')}</label>
                            <input
                              type="text"
                              maxLength={10}
                              placeholder="Sl."
                              value={templateSettings.config.headerSl || ''}
                              onChange={(e) => setTemplateSettings(prev => ({
                                ...prev,
                                config: { ...prev.config, headerSl: e.target.value }
                              }))}
                              className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-100 focus:border-blue-500 outline-none transition-all placeholder:text-gray-300"
                            />
                          </div>

                          <div className="grid grid-cols-2 items-center gap-4 py-1 border-b border-gray-50 last:border-0">
                            <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-tight">{t('settings.templates.headerDesc')}</label>
                            <input
                              type="text"
                              maxLength={40}
                              placeholder="Description of Goods"
                              value={templateSettings.config.headerDescription || ''}
                              onChange={(e) => setTemplateSettings(prev => ({
                                ...prev,
                                config: { ...prev.config, headerDescription: e.target.value }
                              }))}
                              className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-100 focus:border-blue-500 outline-none transition-all placeholder:text-gray-300"
                            />
                          </div>

                          <div className="grid grid-cols-2 items-center gap-4 py-1 border-b border-gray-50 last:border-0">
                            <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-tight">{t('settings.templates.headerHsn')}</label>
                            <input
                              type="text"
                              maxLength={15}
                              placeholder="HSN/SAC"
                              value={templateSettings.config.headerHsn || ''}
                              onChange={(e) => setTemplateSettings(prev => ({
                                ...prev,
                                config: { ...prev.config, headerHsn: e.target.value }
                              }))}
                              className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-100 focus:border-blue-500 outline-none transition-all placeholder:text-gray-300"
                            />
                          </div>

                          <div className="grid grid-cols-2 items-center gap-4 py-1 border-b border-gray-50 last:border-0">
                            <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-tight">{t('settings.templates.headerQty')}</label>
                            <input
                              type="text"
                              maxLength={15}
                              placeholder="Quantity"
                              value={templateSettings.config.headerQty || ''}
                              onChange={(e) => setTemplateSettings(prev => ({
                                ...prev,
                                config: { ...prev.config, headerQty: e.target.value }
                              }))}
                              className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-100 focus:border-blue-500 outline-none transition-all placeholder:text-gray-300"
                            />
                          </div>

                          <div className="grid grid-cols-2 items-center gap-4 py-1 border-b border-gray-50 last:border-0">
                            <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-tight">{t('settings.templates.headerRate')}</label>
                            <input
                              type="text"
                              maxLength={15}
                              placeholder="Rate"
                              value={templateSettings.config.headerRate || ''}
                              onChange={(e) => setTemplateSettings(prev => ({
                                ...prev,
                                config: { ...prev.config, headerRate: e.target.value }
                              }))}
                              className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-100 focus:border-blue-500 outline-none transition-all placeholder:text-gray-300"
                            />
                          </div>

                          <div className="grid grid-cols-2 items-center gap-4 py-1 border-b border-gray-50 last:border-0">
                            <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-tight">{t('settings.templates.headerPer')}</label>
                            <input
                              type="text"
                              maxLength={12}
                              placeholder="per"
                              value={templateSettings.config.headerPer || ''}
                              onChange={(e) => setTemplateSettings(prev => ({
                                ...prev,
                                config: { ...prev.config, headerPer: e.target.value }
                              }))}
                              className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-100 focus:border-blue-500 outline-none transition-all placeholder:text-gray-300"
                            />
                          </div>

                          <div className="grid grid-cols-2 items-center gap-4 py-1 border-b border-gray-50 last:border-0">
                            <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-tight">{t('settings.templates.headerGst')}</label>
                            <input
                              type="text"
                              maxLength={12}
                              placeholder="GST%"
                              value={templateSettings.config.headerGst || ''}
                              onChange={(e) => setTemplateSettings(prev => ({
                                ...prev,
                                config: { ...prev.config, headerGst: e.target.value }
                              }))}
                              className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-100 focus:border-blue-500 outline-none transition-all placeholder:text-gray-300"
                            />
                          </div>

                          <div className="grid grid-cols-2 items-center gap-4 py-1 border-b border-gray-50 last:border-0">
                            <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-tight">{t('settings.templates.headerTax')}</label>
                            <input
                              type="text"
                              maxLength={12}
                              placeholder="Tax%"
                              value={templateSettings.config.headerTax || ''}
                              onChange={(e) => setTemplateSettings(prev => ({
                                ...prev,
                                config: { ...prev.config, headerTax: e.target.value }
                              }))}
                              className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-100 focus:border-blue-500 outline-none transition-all placeholder:text-gray-300"
                            />
                          </div>

                          <div className="grid grid-cols-2 items-center gap-4 py-1 border-b border-gray-50 last:border-0">
                            <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-tight">{t('settings.templates.headerAmount')}</label>
                            <input
                              type="text"
                              maxLength={15}
                              placeholder="Amount"
                              value={templateSettings.config.headerAmount || ''}
                              onChange={(e) => setTemplateSettings(prev => ({
                                ...prev,
                                config: { ...prev.config, headerAmount: e.target.value }
                              }))}
                              className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-100 focus:border-blue-500 outline-none transition-all placeholder:text-gray-300"
                            />
                          </div>

                          <div className="grid grid-cols-2 items-center gap-4 py-3 border-t border-gray-100 mt-2">
                            <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-tight">{t('settings.templates.descLimit')}</label>
                            <div className="space-y-1">
                              <input
                                type="number"
                                value={templateSettings.config.descLimit || 45}
                                onChange={(e) => setTemplateSettings(prev => ({
                                  ...prev,
                                  config: { ...prev.config, descLimit: parseInt(e.target.value) }
                                }))}
                                className="w-24 px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-100 focus:border-blue-500 outline-none transition-all"
                              />
                              <p className="text-[10px] text-gray-400 italic">{t('settings.templates.descLimitHelp')}</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Authorized Signatory Settings - A4 only */}
                    {templateSettings.template_name?.startsWith('A4') && (
                      <div className="space-y-4 pt-4 border-t border-gray-200">
                        <div>
                          <label className="text-sm font-medium text-gray-700">Authorized Signatory</label>
                          <p className="text-xs text-gray-500 mt-1">Configure the authorized signatory section text.</p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <label className="text-xs text-gray-600">Dynamic Name Text (Defaults to Store Name)</label>
                            <input
                              type="text"
                              value={templateSettings.config.authorizedSignatoryFor || ''}
                              onChange={(e) => setTemplateSettings(prev => ({
                                ...prev,
                                config: { ...prev.config, authorizedSignatoryFor: e.target.value }
                              }))}
                              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                              placeholder={`for ${storeDetails.store_name || 'STORE NAME'}`}
                            />
                            <p className="text-[10px] text-gray-400">Leave empty to use store name automatically e.g., "for [Store Name]"</p>
                          </div>

                          <div className="space-y-4">
                            <div className="space-y-2">
                              <label className="text-xs text-gray-600">Label (Defaults to "Authorised Signatory")</label>
                              <input
                                type="text"
                                value={templateSettings.config.authorizedSignatoryLabel || ''}
                                onChange={(e) => setTemplateSettings(prev => ({
                                  ...prev,
                                  config: { ...prev.config, authorizedSignatoryLabel: e.target.value }
                                }))}
                                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="Authorised Signatory"
                              />
                            </div>

                            <div className="flex items-center space-x-2">
                              <input
                                type="checkbox"
                                id="showEOE"
                                checked={templateSettings.config.showEOE !== false}
                                onChange={(e) => setTemplateSettings(prev => ({
                                  ...prev,
                                  config: { ...prev.config, showEOE: e.target.checked }
                                }))}
                                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                              />
                              <label htmlFor="showEOE" className="text-sm text-gray-700">Show "E. & O. E" text</label>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Bank Details - A4 Only */}
                    {templateSettings.template_name === 'A4' && (
                      <div className="space-y-4 pt-4 border-t border-gray-200">
                        <div>
                          <label className="text-sm font-medium text-gray-700">{t('settings.templates.paymentDetails')}</label>
                          <p className="text-xs text-gray-500 mt-1">{t('settings.templates.paymentDetailsDesc')}</p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <label className="text-xs text-gray-600">{t('settings.templates.bankName')}</label>
                            <input
                              type="text"
                              value={templateSettings.config.bankDetails?.bankName || ''}
                              onChange={(e) => setTemplateSettings(prev => ({
                                ...prev,
                                config: {
                                  ...prev.config,
                                  bankDetails: {
                                    ...prev.config.bankDetails,
                                    bankName: e.target.value
                                  }
                                }
                              }))}
                              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                              placeholder={t('settings.templates.placeholders.bankName')}
                            />
                          </div>

                          <div className="space-y-2">
                            <label className="text-xs text-gray-600">{t('settings.templates.accountHolderName')}</label>
                            <input
                              type="text"
                              value={templateSettings.config.bankDetails?.accountHolder || ''}
                              onChange={(e) => setTemplateSettings(prev => ({
                                ...prev,
                                config: {
                                  ...prev.config,
                                  bankDetails: {
                                    ...prev.config.bankDetails,
                                    accountHolder: e.target.value
                                  }
                                }
                              }))}
                              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                              placeholder={t('settings.templates.placeholders.accountHolder')}
                            />
                          </div>

                          <div className="space-y-2">
                            <label className="text-xs text-gray-600">{t('settings.templates.accountNumber')}</label>
                            <input
                              type="text"
                              value={templateSettings.config.bankDetails?.accountNumber || ''}
                              onChange={(e) => setTemplateSettings(prev => ({
                                ...prev,
                                config: {
                                  ...prev.config,
                                  bankDetails: {
                                    ...prev.config.bankDetails,
                                    accountNumber: e.target.value
                                  }
                                }
                              }))}
                              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                              placeholder={t('settings.templates.placeholders.accountNumber')}
                            />
                          </div>

                          <div className="space-y-2">
                            <label className="text-xs text-gray-600">{t('settings.templates.ifscCode')}</label>
                            <input
                              type="text"
                              value={templateSettings.config.bankDetails?.ifscCode || ''}
                              onChange={(e) => setTemplateSettings(prev => ({
                                ...prev,
                                config: {
                                  ...prev.config,
                                  bankDetails: {
                                    ...prev.config.bankDetails,
                                    ifscCode: e.target.value.toUpperCase()
                                  }
                                }
                              }))}
                              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                              placeholder={t('settings.templates.placeholders.ifscCode')}
                            />
                          </div>

                          <div className="space-y-2 md:col-span-2">
                            <label className="text-xs text-gray-600">{t('settings.templates.branch')}</label>
                            <input
                              type="text"
                              value={templateSettings.config.bankDetails?.branch || ''}
                              onChange={(e) => setTemplateSettings(prev => ({
                                ...prev,
                                config: {
                                  ...prev.config,
                                  bankDetails: {
                                    ...prev.config.bankDetails,
                                    branch: e.target.value
                                  }
                                }
                              }))}
                              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                              placeholder={t('settings.templates.placeholders.branch')}
                            />
                          </div>
                        </div>

                        <div className="space-y-2">
                          <label className="text-xs text-gray-600">{t('settings.templates.netPayableDays')}</label>
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              min="0"
                              max="365"
                              value={templateSettings.config.netPayableDays || 30}
                              onChange={(e) => setTemplateSettings(prev => ({
                                ...prev,
                                config: { ...prev.config, netPayableDays: parseInt(e.target.value) || 0 }
                              }))}
                              className="w-24 px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                            <span className="text-sm text-gray-600">{t('settings.templates.daysLabel')}</span>
                          </div>
                          <p className="text-xs text-gray-500">
                            {t('settings.templates.dueDateNote')}
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Action Buttons */}
                    <div className="pt-6 border-t border-gray-100 flex items-center justify-between">
                      <button
                        onClick={() => setShowResetConfirm(true)}
                        disabled={saving}
                        className="text-red-600 hover:text-red-700 text-sm font-medium flex items-center gap-2 px-3 py-2 rounded-md hover:bg-red-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <RotateCcw size={16} />
                        {t('settings.templates.resetToDefault')}
                      </button>

                      <button
                        onClick={handleSaveTemplateSettings}
                        disabled={saving}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium flex items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed transition-colors"
                      >
                        {saving ? (
                          <>
                            <Loader2 size={18} className="animate-spin" />
                            {t('settings.buttons.saving')}
                          </>
                        ) : (
                          <>
                            <Save size={18} />
                            {t('settings.buttons.saveChanges')}
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Preview Section (Right) */}
              <div className="w-full lg:w-[500px] bg-gray-50 flex flex-col border-l border-gray-200">
                <div className="p-4 border-b border-gray-200 bg-white flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Eye size={18} className="text-blue-600" />
                    <h3 className="font-semibold text-gray-800">{t('settings.templates.livePreview')}</h3>
                  </div>
                  <div className="flex items-center gap-2">
                    {previewLoading && <Loader2 size={16} className="animate-spin text-gray-400" />}
                    <button
                      onClick={generatePreview}
                      className="p-1.5 hover:bg-gray-100 rounded-full text-gray-500 transition-colors"
                      title={t('settings.templates.refreshPreview')}
                    >
                      <RefreshCw size={16} />
                    </button>
                  </div>
                </div>

                <div className="flex-1 overflow-hidden bg-gray-100 relative p-4 flex items-center justify-center">
                  {previewLoading && !previewUrl ? (
                    <div className="text-center text-gray-500">
                      <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2" />
                      <p>{t('settings.templates.generatingPreview')}</p>
                    </div>
                  ) : previewUrl ? (
                    <div className="relative w-full h-full flex items-center justify-center">
                      <iframe
                        src={`${previewUrl}#toolbar=0&view=FitH`}
                        className={`w-full h-full rounded shadow-lg bg-white ${templateSettings.template_name === '80mm' ? 'max-w-[300px]' :
                          templateSettings.template_name === '50mm' ? 'max-w-[200px]' :
                            (templateSettings.template_name === 'A4-GST' || templateSettings.template_name === 'A4-NonGST') ? 'max-w-[600px]' :
                              'max-w-full'
                          }`}
                        title="Invoice Preview"
                      />

                      {/* Dimension Indicator Overlay (Internal) */}
                      {previewDimensions && (
                        <div className="absolute bottom-4 right-4 bg-black/70 text-white px-3 py-1.5 rounded-lg text-[10px] font-mono backdrop-blur-md border border-white/10 shadow-lg pointer-events-none">
                          <span className="text-gray-400">PDF Size: </span>
                          <span>
                            {previewDimensions.widthMM ? previewDimensions.widthMM.toFixed(1) : '80.0'}mm × {previewDimensions.heightMM ? previewDimensions.heightMM.toFixed(1) : '...'}mm
                          </span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-center text-gray-400">
                      <Printer className="w-12 h-12 mx-auto mb-2 opacity-20" />
                      <p>{t('settings.templates.previewNotAvailable')}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'profile' && (
            <div className="flex-1 w-[100%] p-6 flex  flex-col items-center justify-center text-gray-500">
              {/* <User size={48} className="mb-4 opacity-20" /> */}
              <MyProfile />
            </div>
          )}

          {activeTab === 'password' && (
            <div className="flex-1 p-6 flex flex-col items-center justify-center text-gray-500">
              {/* <Lock size={48} className="mb-4 opacity-20" /> */}
              <ChangePassword />
            </div>
          )}

          {activeTab === 'accessibility' && <AccessibilitySettings />}

          {activeTab === 'printer' && (
            <PrinterSettings />
          )}

          {activeTab === 'license' && (
            <License />
          )}
        </div>
      </div>

      {/* Confirmation Modal for Template Reset */}
      {showResetConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6 animate-in fade-in zoom-in duration-200">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0">
                <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                  <RotateCcw className="w-5 h-5 text-red-600" />
                </div>
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  {t('settings.templates.resetToDefault')}
                </h3>
                <p className="text-sm text-gray-600">
                  {t('settings.messages.confirmReset')}
                </p>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                onClick={() => setShowResetConfirm(false)}
                disabled={saving}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={handleResetTemplateSettings}
                disabled={saving}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {saving ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    {t('settings.buttons.saving')}
                  </>
                ) : (
                  <>
                    <RotateCcw size={16} />
                    {t('common.confirm')}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Settings;