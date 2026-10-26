import React, { useState, useEffect, useCallback } from 'react';
import { Store, User, Lock, Save, Loader2, RefreshCw, Printer, Eye, FileText, RotateCcw, Shield, Type } from 'lucide-react';
import AccessibilitySettings from './AccessibilitySettings';
import { toast } from 'sonner';
import settingsService from '../../services/settingsService';
import templateService from '../../services/templateService';
import MyProfile from './MyProfile';
import ChangePassword from './ChangePassword';
import PrinterSettings from './PrinterSettings';
import License from './License';
import { useTranslation } from 'react-i18next';

const inputClass = 'w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500';

const StoreSection = ({ title, description, cols = 'md:grid-cols-2', children }) => (
  <section className="grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-x-8 gap-y-3">
    <div>
      <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
      <p className="text-xs text-gray-500 mt-1">{description}</p>
    </div>
    <div className={`grid grid-cols-1 ${cols} gap-4 max-w-3xl`}>{children}</div>
  </section>
);

const Field = ({ label, hint, span = '', value, ...props }) => (
  <div className={`space-y-1.5 ${span}`}>
    <label className="text-sm font-medium text-gray-700">
      {label} {hint && <span className="text-gray-400 font-normal">({hint})</span>}
    </label>
    <input type="text" value={value || ''} className={inputClass} {...props} />
  </div>
);

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
    store_name: '',
    address_line1: '',
    address_line2: '',
    city: '',
    state: '',
    pincode: '',
    district: '',
    pan: '',
    phone: '',
    email: '',
    website: '',
    gstin: '',
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
        const loaded = response.data.config || {
          fontFamily: 'Helvetica',
          showTax: true,
          showDiscount: true,
          showGst: true,
          showHsn: false,
          showOutstanding: false,
          headerText: 'Tax Invoice',
          footerText: 'Thank you for your business!'
        };
        // English only: drop any previously saved Tamil invoice language / fonts
        const tamilFont = ['NotoSansTamil', 'MuktaMalar'].includes(loaded.fontFamily);
        setTemplateSettings({
          template_name: response.data.template_name || '80mm',
          config: {
            ...loaded,
            invoiceLanguage: 'en',
            fontFamily: tamilFont ? 'Helvetica' : loaded.fontFamily
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
        address: [storeDetails.address_line1, storeDetails.address_line2, storeDetails.city, [storeDetails.state, storeDetails.pincode].filter(Boolean).join(' - ')].filter(Boolean).join(', '),
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
      const isTaxInvoice = templateSettings.template_name === 'A4-Tax';

      let previewData;
      if (isGstInvoice || isNonGstInvoice || isTaxInvoice) {
        // Prepare invoice data for GST/Non-GST templates
        previewData = {
          company: {
            name: storeDetails.store_name || '',
            god_name: storeDetails.god_name || '',
            address: storeDetails.address_line1 || '',
            address2: storeDetails.address_line2 || '',
            city: storeDetails.city ? `${storeDetails.city}${storeDetails.pincode ? ' - ' + storeDetails.pincode : ''}` : '',
            district: storeDetails.district ? `DIST:${storeDetails.district}${storeDetails.state ? ', ' + storeDetails.state : ''}` : (storeDetails.state || ''),
            gstin: storeDetails.gstin || '',
            fassai_no: storeDetails.fassai_no || '',
            pan: storeDetails.pan || '',
            email: storeDetails.email || '',
            phone: storeDetails.phone || ''
          },
          invoiceNumber: 'INV-PREVIEW-001',
          orderDate: new Date().toISOString(),
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

  const navGroups = [
    {
      title: 'Business',
      items: [
        { id: 'store', icon: Store, label: t('settings.storeDetails') },
        { id: 'templates', icon: FileText, label: t('settings.printTemplates') },
        { id: 'printer', icon: Printer, label: t('settings.printerSettings') }
      ]
    },
    {
      title: 'Account',
      items: [
        { id: 'profile', icon: User, label: t('settings.myProfile.title') },
        { id: 'password', icon: Lock, label: t('settings.changePassword.title') }
      ]
    },
    {
      title: 'System',
      items: [
        { id: 'accessibility', icon: Type, label: t('settings.accessibility') },
        { id: 'license', icon: Shield, label: 'License' }
      ]
    }
  ];

  return (
    <div className="p-6 max-w-[1600px] mx-auto h-[calc(100vh-64px)] overflow-hidden flex flex-col">
      <div className="mb-5 flex-shrink-0">
        <h1 className="text-2xl font-bold text-gray-900">{t('settings.title')}</h1>
        <p className="text-sm text-gray-500 mt-1">Manage your store, invoices, printers and account.</p>
      </div>

      <div className="flex flex-col md:flex-row gap-6 flex-1 min-h-0">
        {/* Sidebar Navigation */}
        <nav className="w-full md:w-64 flex-shrink-0 md:overflow-y-auto">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-2 space-y-4">
            {navGroups.map(group => (
              <div key={group.title}>
                <p className="px-3 pt-1 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-gray-400">{group.title}</p>
                <div className="space-y-0.5">
                  {group.items.map(({ id, icon: Icon, label }) => {
                    const active = activeTab === id;
                    return (
                      <button
                        key={id}
                        onClick={() => setActiveTab(id)}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left text-sm transition-colors ${active
                          ? 'bg-blue-50 text-blue-700 font-semibold'
                          : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                          }`}
                      >
                        <span className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${active ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-500'}`}>
                          <Icon size={16} />
                        </span>
                        <span className="truncate">{label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </nav>

        {/* Content Area */}
        <div className="flex-1 flex min-h-0 bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          {activeTab === 'store' && (
            <div className="flex-1 flex flex-col h-full min-h-0">
              <div className="px-8 pt-6 pb-4 border-b border-gray-100">
                <h2 className="text-xl font-semibold text-gray-900">{t('settings.storeDetails')}</h2>
                <p className="text-gray-500 text-sm mt-1">{t('settings.store.subtitle')}</p>
              </div>

              {loading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                </div>
              ) : (
                <form onSubmit={handleSaveStoreDetails} className="flex-1 flex flex-col min-h-0">
                  <div className="flex-1 overflow-y-auto px-8 py-6 space-y-8">
                    <StoreSection title="Business identity" description="Shown at the top of every invoice.">
                      <Field label={`${t('settings.store.storeName')} *`} name="store_name" value={storeDetails.store_name} onChange={handleStoreChange} required placeholder={t('settings.store.placeholders.storeName')} />
                    </StoreSection>

                    <StoreSection title="Tax & licences" description="Registration numbers printed on tax invoices.">
                      <Field label={t('settings.store.gstin')} name="gstin" value={storeDetails.gstin} onChange={handleStoreChange} placeholder={t('settings.store.placeholders.gstin')} />
                      <Field label="PAN" name="pan" value={storeDetails.pan} onChange={handleStoreChange} placeholder="Enter PAN" />
                    </StoreSection>

                    <StoreSection title="Address" description="Your business location." cols="md:grid-cols-4">
                      <Field span="md:col-span-4" label={t('settings.store.addressLine1')} name="address_line1" value={storeDetails.address_line1} onChange={handleStoreChange} placeholder={t('settings.store.placeholders.addressLine1')} />
                      <Field span="md:col-span-4" label={t('settings.store.addressLine2')} name="address_line2" value={storeDetails.address_line2} onChange={handleStoreChange} placeholder={t('settings.store.placeholders.addressLine2')} />
                      <Field label={t('settings.store.city')} name="city" value={storeDetails.city} onChange={handleStoreChange} />
                      <Field label="District" name="district" value={storeDetails.district} onChange={handleStoreChange} placeholder="Enter District" />
                      <Field label={t('settings.store.state')} name="state" value={storeDetails.state} onChange={handleStoreChange} />
                      <Field label={t('settings.store.pincode')} name="pincode" value={storeDetails.pincode} onChange={handleStoreChange} />
                    </StoreSection>

                    <StoreSection title="Contact" description="How customers can reach you.">
                      <Field label={t('settings.store.phoneNumber')} name="phone" value={storeDetails.phone} onChange={handleStoreChange} />
                      <Field label={t('settings.store.email')} type="email" name="email" value={storeDetails.email} onChange={handleStoreChange} />
                      <Field span="md:col-span-2" label={t('settings.store.website')} type="url" name="website" value={storeDetails.website} onChange={handleStoreChange} placeholder={t('settings.store.placeholders.website')} />
                    </StoreSection>
                  </div>

                  <div className="px-8 py-3 border-t border-gray-200 bg-gray-50 flex justify-end">
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
                          <div className="grid grid-cols-3 gap-3">
                            {['A4-Tax'].map((type) => (
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
                                  A4 Tax Invoice
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
                              <option value="Helvetica">{t('settings.templates.helveticaDefault')}</option>
                              <option value="Courier">{t('settings.templates.courierMonospace')}</option>
                              <option value="Times-Roman">{t('settings.templates.timesRoman')}</option>
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

                    {/* Authorized Signatory Settings - A4 only */}
                    {templateSettings.template_name?.startsWith('A4') && (
                      <div className="space-y-4 pt-4 border-t border-gray-200">
                        <div>
                          <label className="text-sm font-medium text-gray-700">Authorized Signatory</label>
                          <p className="text-xs text-gray-500 mt-1">Configure the authorized signatory section text.</p>
                        </div>

                        <div className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            id="showSignatory"
                            checked={templateSettings.config.showSignatory !== false}
                            onChange={(e) => setTemplateSettings(prev => ({
                              ...prev,
                              config: { ...prev.config, showSignatory: e.target.checked }
                            }))}
                            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                          />
                          <label htmlFor="showSignatory" className="text-sm text-gray-700">Show authorized signatory on the bill</label>
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

                    {/* Bank Details - A4 and A4 Tax Invoice */}
                    {(templateSettings.template_name === 'A4' || templateSettings.template_name === 'A4-Tax') && (
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
                            ['A4-GST', 'A4-NonGST', 'A4-Tax'].includes(templateSettings.template_name) ? 'max-w-[600px]' :
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