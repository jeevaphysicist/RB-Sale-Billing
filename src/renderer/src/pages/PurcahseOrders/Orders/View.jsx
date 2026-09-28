import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { FileText, Package, DollarSign, Truck, Calendar, User, Mail, Phone, MapPin, CheckCircle, Clock, XCircle, ChevronDown, ChevronUp, Plus, Download, Printer, ArrowLeft, Loader2, X, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import purchaseOrderService from '../../../services/purchaseOrderService';
import { paymentRecordService } from '../../../services/paymentRecordService';
import settingsService from '../../../services/settingsService';
import Modal from '../../../components/Modal';

const View = () => {
  const { t } = useTranslation();
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [expandedSections, setExpandedSections] = useState({
    supplier: true,
    items: true,
    delivery: true,
    totals: true,
    payment: true
  });

  const [poData, setPoData] = useState({
    po_number: "",
    po_date: "",
    supplier_id: "",
    supplier_name: "",
    supplier_address: "",
    supplier_gst: "",
    contact_person: "",
    contact_number: "",
    email: "",
    payment_terms: "",
    delivery_date: "",
    delivery_location: "",
    remarks: "",
    status: "",
    items: [],
    freight: 0,
    insurance: 0,
    other_charges: 0,
    order_discount: 0,
    enable_tax: 1,
    tax_type: "SGST",
    totals: {
      subtotal_without_tax: 0,
      total_tax: 0,
      sgst: 0,
      cgst: 0,
      igst: 0,
      subtotal: 0,
      order_discount_amount: 0,
      subtotal_after_discount: 0,
      freight: 0,
      insurance: 0,
      other_charges: 0,
      round_off: 0,
      net_payable: 0
    }
  });

  const [paymentRecords, setPaymentRecords] = useState([]);
  const [loadingPayments, setLoadingPayments] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Payment form state
  const [paymentFormData, setPaymentFormData] = useState({
    payment_date: new Date().toISOString().split('T')[0],
    payment_amount: '',
    payment_method: 'Cash',
    reference_number: '',
    bank_name: '',
    cheque_number: '',
    transaction_id: '',
    notes: ''
  });

  const [paymentErrors, setPaymentErrors] = useState({});

  // Print functionality state
  const [printModal, setPrintModal] = useState({
    isOpen: false,
    loading: false
  });
  const [pdfUrl, setPdfUrl] = useState(null);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [storeDetails, setStoreDetails] = useState(null);

  // Payment methods
  const paymentMethods = [
    'Cash',
    'Cheque',
    'Bank Transfer',
    'UPI',
    'Credit Card',
    'Debit Card',
    'Net Banking'
  ];

  // Fetch purchase order data
  useEffect(() => {
    const fetchPurchaseOrder = async () => {
      if (!id) {
        toast.error(t('purchases.failedToLoad'));
        navigate('/purchase-orders');
        return;
      }

      try {
        setLoading(true);
        const response = await purchaseOrderService.getById(id);

        if (response.success && response.data) {
          setPoData(response.data);
          // Fetch payment records
          fetchPaymentRecords(id);
        } else {
          toast.error(response.message || t('purchases.failedToLoad'));
          navigate('/purchase-orders');
        }
      } catch (error) {
        console.error('Error fetching purchase order:', error);
        toast.error(t('purchases.failedToLoad'));
        navigate('/purchase-orders');
      } finally {
        setLoading(false);
      }
    };

    fetchPurchaseOrder();
    fetchStoreDetails();
  }, [id, navigate]);

  const fetchStoreDetails = async () => {
    try {
      const response = await settingsService.getStoreDetails();
      if (response.success && response.data) {
        setStoreDetails(response.data);
      }
    } catch (error) {
      console.error('Error fetching store details:', error);
    }
  };

  // Fetch payment records
  const fetchPaymentRecords = async (poId) => {
    try {
      setLoadingPayments(true);
      const response = await paymentRecordService.getPaymentRecordsByPO({
        recordType: 'purchase',
        referenceId: poId
      });

      if (response) {
        setPaymentRecords(response);
      }
    } catch (error) {
      console.error('Error fetching payment records:', error);
    } finally {
      setLoadingPayments(false);
    }
  };

  const toggleSection = (section) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'Completed': return 'bg-green-100 text-green-700 border-green-300';
      case 'Pending': return 'bg-yellow-100 text-yellow-700 border-yellow-300';
      case 'Rejected': return 'bg-red-100 text-red-700 border-red-300';
      case 'Cancelled': return 'bg-red-100 text-red-700 border-red-300';
      default: return 'bg-gray-100 text-gray-700 border-gray-300';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'Completed': return <CheckCircle className="w-4 h-4" />;
      case 'Pending': return <Clock className="w-4 h-4" />;
      case 'Rejected': return <XCircle className="w-4 h-4" />;
      default: return <Clock className="w-4 h-4" />;
    }
  };

  const totalPaid = paymentRecords.reduce((sum, record) =>
    sum + (parseFloat(record.payment_amount) || 0), 0
  );
  const balanceDue = (poData.totals?.net_payable || 0) - totalPaid;

  // Handle payment form change
  const handlePaymentChange = (e) => {
    const { name, value } = e.target;
    setPaymentFormData(prev => ({
      ...prev,
      [name]: value
    }));

    // Clear error for this field
    if (paymentErrors[name]) {
      setPaymentErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
  };

  // Validate payment form
  const validatePaymentForm = () => {
    const newErrors = {};

    if (!paymentFormData.payment_date) {
      newErrors.payment_date = t('purchases.payment.date') + ' is required';
    }

    if (!paymentFormData.payment_amount || parseFloat(paymentFormData.payment_amount) <= 0) {
      newErrors.payment_amount = 'Valid payment amount is required';
    } else if (parseFloat(paymentFormData.payment_amount) > balanceDue) {
      newErrors.payment_amount = `Amount cannot exceed balance (₹${balanceDue.toFixed(2)})`;
    }

    if (!paymentFormData.payment_method) {
      newErrors.payment_method = t('purchases.payment.method') + ' is required';
    }

    setPaymentErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const addPaymentRecord = async (e) => {
    e.preventDefault();

    if (!validatePaymentForm()) {
      toast.error('Please fix the errors in the form');
      return;
    }

    try {
      setIsSubmitting(true);
      const paymentData = {
        recordType: 'purchase',
        referenceId: parseInt(id),
        paymentDate: paymentFormData.payment_date,
        paymentAmount: parseFloat(paymentFormData.payment_amount),
        paymentMethod: paymentFormData.payment_method,
        referenceNumber: paymentFormData.reference_number || null,
        bankName: paymentFormData.bank_name || null,
        chequeNumber: paymentFormData.cheque_number || null,
        transactionId: paymentFormData.transaction_id || null,
        notes: paymentFormData.notes || null
      };

      const response = await paymentRecordService.createPaymentRecord(paymentData);

      if (response.success) {
        toast.success('Payment added successfully');
        // Refresh payment records
        fetchPaymentRecords(id);
        // Reset form
        setPaymentFormData({
          payment_date: new Date().toISOString().split('T')[0],
          payment_amount: '',
          payment_method: 'Cash',
          reference_number: '',
          bank_name: '',
          cheque_number: '',
          transaction_id: '',
          notes: ''
        });
        setPaymentErrors({});
        setShowPaymentModal(false);
      } else {
        toast.error(response.message || t('purchases.payment.failedToAdd'));
      }
    } catch (error) {
      console.error('Error adding payment record:', error);
      toast.error(t('purchases.payment.failedToAdd'));
    } finally {
      setIsSubmitting(false);
    }
  };

  // Show loading state
  if (loading) {
    return (
      <div className="min-h-full bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100 p-6 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-blue-600 animate-spin mx-auto mb-4" />
          <p className="text-slate-600 text-lg">{t('common.loading')}</p>
        </div>
      </div>
    );
  }

  // Print functionality


  // 1. Open Modal and Trigger Generation
  const handlePrint = () => {
    setPrintModal({ isOpen: true, loading: false });
    handleGeneratePDF();
  };

  const handleClosePrintModal = () => {
    setPrintModal({ isOpen: false, loading: false });
    if (pdfUrl) {
      URL.revokeObjectURL(pdfUrl);
      setPdfUrl(null);
    }
  };

  const handleGeneratePDF = async () => {
    try {
      setIsGeneratingPdf(true);

      // Get Template Settings
      const settingsResponse = await window.api.invoke('template:get-settings', 'purchase_order');
      let templateSettings = {
        template_name: 'A4',
        config: {
          fontFamily: 'Helvetica',
          headerText: 'Purchase Order',
          footerText: 'Authorized Signatory',
          showGst: true,
          showHsn: true,
          showTax: true,
          showDiscount: true
        }
      };

      if (settingsResponse.success && settingsResponse.data) {
        templateSettings = {
          template_name: settingsResponse.data.template_name || 'A4',
          config: settingsResponse.data.config || templateSettings.config
        };
      }


      // Format store details for PDF generator
      const formattedStoreDetails = storeDetails ? {
        store: storeDetails.store_name || 'My Store',
        address: `${storeDetails.address_line1 || ''}${storeDetails.address_line2 ? ', ' + storeDetails.address_line2 : ''}, ${storeDetails.city || ''}, ${storeDetails.state || ''} - ${storeDetails.pincode || ''}`,
        phone: storeDetails.phone || '',
        email: storeDetails.email || '',
        gstin: storeDetails.gstin || '',
        website: storeDetails.website || ''
      } : { store: 'My Store' };

      // Generate PDF
      const pdfData = {
        ...poData,
        documentType: 'purchase_order',
        storeDetails: formattedStoreDetails
      };
      const pdfResponse = await window.api.invoke('template:generate-preview', {
        data: pdfData,
        templateName: templateSettings.template_name,
        config: templateSettings.config
      });

      if (pdfResponse.success) {
        const blob = new Blob([pdfResponse.data], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        setPdfUrl(url);
      } else {
        toast.error('Failed to generate PDF');
      }
    } catch (error) {
      console.error('Print error:', error);
      toast.error('Error generating print document');
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  return (
    <div className="min-h-full bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-6 border border-slate-200">
          <div className="flex justify-between items-start mb-4">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <button
                  onClick={() => navigate('/purchases')}
                  className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  <ArrowLeft className="w-6 h-6 text-slate-600" />
                </button>
                <FileText className="w-8 h-8 text-blue-600" />
                <h1 className="text-3xl font-bold text-slate-800">{t('purchases.view.title')}</h1>
              </div>
              <p className="text-slate-600 ml-14">{t('purchases.view.subtitle')}</p>
            </div>
            <div className="text-right">
              <div className="text-sm text-slate-600 mb-1">{t('purchases.view.poNumber')}</div>
              <div className="text-2xl font-bold text-blue-600">{poData.po_number || '-'}</div>
              <div className="text-sm text-slate-600 mt-2">{t('purchases.view.date')}: {poData.po_date || '-'}</div>
            </div>
          </div>

          <div className="flex gap-3 items-center justify-between">
            <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg border ${getStatusColor(poData.status)}`}>
              {getStatusIcon(poData.status)}
              <span className="font-semibold">{poData.status}</span>
            </div>
            <div className="flex gap-2">
              {/* Print Button - Hidden for now */}
              {/* <button 
                onClick={handlePrint}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
              >
                <Printer className="w-4 h-4" />
                <span>{t('purchases.view.print')}</span>
              </button> */}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Supplier Information */}
            <div className="bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden">
              <div
                className="flex justify-between items-center p-5 bg-gradient-to-r from-blue-600 to-blue-700 text-white cursor-pointer"
                onClick={() => toggleSection('supplier')}
              >
                <div className="flex items-center gap-3">
                  <User className="w-5 h-5" />
                  <h2 className="text-lg font-semibold">{t('purchases.view.supplierInfo')}</h2>
                </div>
                {expandedSections.supplier ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
              </div>

              {expandedSections.supplier && (
                <div className="p-5 space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <div className="text-sm font-semibold text-slate-600 mb-1">{t('purchases.supplierName')}</div>
                      <div className="text-slate-800 font-medium">{poData.supplier_name}</div>
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-slate-600 mb-1">{t('purchases.view.supplierId')}</div>
                      <div className="text-slate-800">{poData.supplier_id}</div>
                    </div>
                  </div>

                  <div className="flex items-start gap-2 p-3 bg-slate-50 rounded-lg">
                    <MapPin className="w-5 h-5 text-slate-500 mt-1 flex-shrink-0" />
                    <div>
                      <div className="text-sm font-semibold text-slate-600 mb-1">{t('purchases.view.address')}</div>
                      <div className="text-slate-800">{poData.supplier_address}</div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4 text-slate-500" />
                      <div>
                        <div className="text-sm text-slate-600">{t('purchases.contactPerson')}</div>
                        <div className="text-slate-800 font-medium">{poData.contact_person}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Phone className="w-4 h-4 text-slate-500" />
                      <div>
                        <div className="text-sm text-slate-600">{t('purchases.view.phone')}</div>
                        <div className="text-slate-800 font-medium">{poData.contact_number}</div>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4 text-slate-500" />
                    <div>
                      <div className="text-sm text-slate-600">{t('purchases.view.email')}</div>
                      <div className="text-slate-800 font-medium">{poData.email}</div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Items */}
            <div className="bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden">
              <div
                className="flex justify-between items-center p-5 bg-gradient-to-r from-green-600 to-green-700 text-white cursor-pointer"
                onClick={() => toggleSection('items')}
              >
                <div className="flex items-center gap-3">
                  <Package className="w-5 h-5" />
                  <h2 className="text-lg font-semibold">{t('purchases.view.orderItems')}</h2>
                </div>
                {expandedSections.items ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
              </div>

              {expandedSections.items && (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="text-left p-4 text-sm font-semibold text-slate-700">{t('purchases.table.product')}</th>
                        <th className="text-left p-4 text-sm font-semibold text-slate-700">{t('purchases.table.hsnCode')}</th>
                        <th className="text-center p-4 text-sm font-semibold text-slate-700">{t('purchases.table.quantity')}</th>
                        <th className="text-right p-4 text-sm font-semibold text-slate-700">{t('purchases.table.rate')}</th>
                        <th className="text-right p-4 text-sm font-semibold text-slate-700">{t('purchases.table.tax')}</th>
                        <th className="text-right p-4 text-sm font-semibold text-slate-700">{t('purchases.table.amount')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {poData.items?.length > 0 ? (
                        poData.items.map((item, idx) => (
                          <tr key={idx} className="border-t border-slate-100 hover:bg-slate-50">
                            <td className="p-4">
                              <div className="font-medium text-slate-800">{item.product_name || `Product #${item.product_id}`}</div>
                              <div className="text-sm text-slate-600">{item.unit}</div>
                            </td>
                            <td className="p-4 text-slate-700">{item.hsn_code}</td>
                            <td className="p-4 text-center font-medium text-slate-800">{item.quantity}</td>
                            <td className="p-4 text-right text-slate-700">₹{item.unit_price?.toFixed(2) || '0.00'}</td>
                            <td className="p-4 text-right text-slate-700">{item.tax}%</td>
                            <td className="p-4 text-right font-semibold text-slate-800">₹{item.amount?.toFixed(2) || '0.00'}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan="6" className="p-8 text-center text-slate-500">
                            {t('purchases.view.noItems')}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Delivery Information */}
            <div className="bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden">
              <div
                className="flex justify-between items-center p-5 bg-gradient-to-r from-purple-600 to-purple-700 text-white cursor-pointer"
                onClick={() => toggleSection('delivery')}
              >
                <div className="flex items-center gap-3">
                  <Truck className="w-5 h-5" />
                  <h2 className="text-lg font-semibold">{t('purchases.view.deliveryDetails')}</h2>
                </div>
                {expandedSections.delivery ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
              </div>

              {expandedSections.delivery && (
                <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-slate-500" />
                    <div>
                      <div className="text-sm text-slate-600">{t('purchases.view.deliveryDate')}</div>
                      <div className="text-slate-800 font-medium">{poData.delivery_date}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-slate-500" />
                    <div>
                      <div className="text-sm text-slate-600">{t('purchases.view.deliveryLocation')}</div>
                      <div className="text-slate-800 font-medium">{poData.delivery_location}</div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Totals */}
            <div className="bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden">
              <div
                className="flex justify-between items-center p-5 bg-gradient-to-r from-orange-600 to-orange-700 text-white cursor-pointer"
                onClick={() => toggleSection('totals')}
              >
                <div className="flex items-center gap-3">
                  <DollarSign className="w-5 h-5" />
                  <h2 className="text-lg font-semibold">{t('purchases.view.orderSummary')}</h2>
                </div>
                {expandedSections.totals ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
              </div>

              {expandedSections.totals && (
                <div className="p-5 space-y-3">
                  <div className="flex justify-between text-slate-700">
                    <span>{t('purchases.view.subtotalExclTax')}</span>
                    <span className="font-medium">₹{poData.totals?.subtotal_without_tax?.toFixed(2) || '0.00'}</span>
                  </div>

                  {poData.tax_type === 'SGST' && (
                    <>
                      <div className="flex justify-between text-slate-600 text-sm">
                        <span>SGST</span>
                        <span>₹{poData.totals?.sgst?.toFixed(2) || '0.00'}</span>
                      </div>
                      <div className="flex justify-between text-slate-600 text-sm">
                        <span>CGST</span>
                        <span>₹{poData.totals?.cgst?.toFixed(2) || '0.00'}</span>
                      </div>
                    </>
                  )}

                  <div className="flex justify-between text-slate-700">
                    <span>{t('purchases.view.totalTax')}</span>
                    <span className="font-medium">₹{poData.totals?.total_tax?.toFixed(2) || '0.00'}</span>
                  </div>

                  <div className="border-t border-slate-200 pt-3 mt-3">
                    <div className="flex justify-between text-slate-900 text-lg font-bold">
                      <span>{t('purchases.view.netPayable')}</span>
                      <span className="text-orange-600">₹{poData.totals?.net_payable?.toFixed(2) || '0.00'}</span>
                    </div>
                  </div>

                  <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                    <div className="text-sm text-slate-600 mb-1">{t('purchases.paymentTerms')}</div>
                    <div className="text-slate-800 font-medium">{poData.payment_terms}</div>
                  </div>
                </div>
              )}
            </div>

            {/* Payment Tracking */}
            <div className="bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden">
              <div
                className="flex justify-between items-center p-5 bg-gradient-to-r from-teal-600 to-teal-700 text-white cursor-pointer"
                onClick={() => toggleSection('payment')}
              >
                <div className="flex items-center gap-3">
                  <DollarSign className="w-5 h-5" />
                  <h2 className="text-lg font-semibold">{t('purchases.view.paymentTracking')}</h2>
                </div>
                {expandedSections.payment ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
              </div>

              {expandedSections.payment && (
                <div className="p-5 space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 bg-green-50 rounded-lg border border-green-200">
                      <div className="text-xs text-green-700 font-semibold mb-1">{t('purchases.view.totalPaid')}</div>
                      <div className="text-lg font-bold text-green-700">₹{totalPaid?.toFixed(2)}</div>
                    </div>
                    <div className="p-3 bg-red-50 rounded-lg border border-red-200">
                      <div className="text-xs text-red-700 font-semibold mb-1">{t('purchases.view.balanceDue')}</div>
                      <div className="text-lg font-bold text-red-700">₹{balanceDue?.toFixed(2)}</div>
                    </div>
                  </div>
                  {balanceDue > 0 && (
                    <button
                      onClick={() => setShowPaymentModal(true)}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                      <span>{t('purchases.view.addPayment')}</span>
                    </button>
                  )}

                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {loadingPayments ? (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className="w-6 h-6 text-teal-600 animate-spin" />
                        <span className="ml-2 text-slate-600">{t('purchases.view.loadingPayments')}</span>
                      </div>
                    ) : paymentRecords.length > 0 ? (
                      paymentRecords.map((record) => (
                        <div key={record.id} className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                          <div className="flex justify-between items-start mb-2">
                            <div>
                              <div className="font-medium text-slate-800">₹{parseFloat(record.payment_amount)?.toFixed(2)}</div>
                              <div className="text-xs text-slate-600">{new Date(record.payment_date).toLocaleDateString('en-IN')}</div>
                            </div>
                            <div className="text-xs px-2 py-1 rounded bg-green-100 text-green-700 border-green-300">
                              Completed
                            </div>
                          </div>
                          <div className="text-xs text-slate-600">
                            <div>{record.payment_method}</div>
                            <div>Ref: {record.reference_number || '-'}</div>
                            {record.notes && <div className="mt-1 text-slate-500">{record.notes}</div>}
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-8 text-slate-500">
                        <p>{t('purchases.view.noPayments')}</p>
                        <p className="text-sm mt-1">{t('purchases.view.clickToAddPayment')}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Payment Modal */}
      <Modal
        isOpen={showPaymentModal}
        onClose={() => {
          setShowPaymentModal(false);
          setPaymentFormData({
            payment_date: new Date().toISOString().split('T')[0],
            payment_amount: '',
            payment_method: 'Cash',
            reference_number: '',
            bank_name: '',
            cheque_number: '',
            transaction_id: '',
            notes: ''
          });
          setPaymentErrors({});
        }}
        title={t('purchases.payment.modalTitle')}
        onSubmit={addPaymentRecord}
        isSubmitting={isSubmitting}
        submitText={t('purchases.payment.submit')}
        width="600px"
      >
        <form onSubmit={addPaymentRecord} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Payment Date */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('purchases.payment.date')} <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                name="payment_date"
                value={paymentFormData.payment_date}
                onChange={handlePaymentChange}
                className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${paymentErrors.payment_date ? 'border-red-500' : 'border-gray-300'
                  }`}
                disabled={isSubmitting}
              />
              {paymentErrors.payment_date && (
                <p className="mt-1 text-sm text-red-500">{paymentErrors.payment_date}</p>
              )}
            </div>

            {/* Payment Amount */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('purchases.payment.amount')} <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <DollarSign className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="number"
                  name="payment_amount"
                  value={paymentFormData.payment_amount}
                  onChange={handlePaymentChange}
                  placeholder="0.00"
                  step="0.01"
                  min="0"
                  max={balanceDue}
                  className={`w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${paymentErrors.payment_amount ? 'border-red-500' : 'border-gray-300'
                    }`}
                  disabled={isSubmitting}
                />
              </div>
              {paymentErrors.payment_amount && (
                <p className="mt-1 text-sm text-red-500">{paymentErrors.payment_amount}</p>
              )}
              <p className="mt-1 text-xs text-gray-500">
                {t('purchases.payment.maxAmount')}: ₹{balanceDue.toFixed(2)}
              </p>
            </div>

            {/* Payment Method */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('purchases.payment.method')} <span className="text-red-500">*</span>
              </label>
              <select
                name="payment_method"
                value={paymentFormData.payment_method}
                onChange={handlePaymentChange}
                className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${paymentErrors.payment_method ? 'border-red-500' : 'border-gray-300'
                  }`}
                disabled={isSubmitting}
              >
                {paymentMethods.map(method => (
                  <option key={method} value={method}>{method}</option>
                ))}
              </select>
              {paymentErrors.payment_method && (
                <p className="mt-1 text-sm text-red-500">{paymentErrors.payment_method}</p>
              )}
            </div>

            {/* Reference Number */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('purchases.payment.referenceNumber')}
              </label>
              <input
                type="text"
                name="reference_number"
                value={paymentFormData.reference_number}
                onChange={handlePaymentChange}
                placeholder={t('purchases.payment.enterReference')}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                disabled={isSubmitting}
              />
            </div>

            {/* Bank Details (conditional) */}
            {['Bank Transfer', 'Cheque', 'Net Banking'].includes(paymentFormData.payment_method) && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {t('purchases.payment.bankName')}
                  </label>
                  <input
                    type="text"
                    name="bank_name"
                    value={paymentFormData.bank_name}
                    onChange={handlePaymentChange}
                    placeholder={t('purchases.payment.enterBankName')}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    disabled={isSubmitting}
                  />
                </div>
                {paymentFormData.payment_method === 'Cheque' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {t('purchases.payment.chequeNumber')}
                    </label>
                    <input
                      type="text"
                      name="cheque_number"
                      value={paymentFormData.cheque_number}
                      onChange={handlePaymentChange}
                      placeholder={t('purchases.payment.enterChequeNumber')}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      disabled={isSubmitting}
                    />
                  </div>
                )}
              </>
            )}

            {/* Transaction ID (for digital payments) */}
            {['UPI', 'Credit Card', 'Debit Card', 'Net Banking'].includes(paymentFormData.payment_method) && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t('purchases.payment.transactionId')}
                </label>
                <input
                  type="text"
                  name="transaction_id"
                  value={paymentFormData.transaction_id}
                  onChange={handlePaymentChange}
                  placeholder={t('purchases.payment.enterTransactionId')}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  disabled={isSubmitting}
                />
              </div>
            )}

            {/* Notes */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('purchases.payment.notes')}
              </label>
              <textarea
                name="notes"
                value={paymentFormData.notes}
                onChange={handlePaymentChange}
                placeholder={t('purchases.payment.addNotes')}
                rows={3}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                disabled={isSubmitting}
              />
            </div>
          </div>
        </form>
      </Modal>
      {/* Print Modal */}
      {printModal.isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-lg shadow-2xl w-[90vw] h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200">
            {/* Modal Header */}
            <div className="bg-gray-900 text-white px-6 py-4 flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div className="bg-white/20 p-2 rounded-full">
                  <Printer size={20} />
                </div>
                <div>
                  <h2 className="text-xl font-bold">{t('purchases.view.printTitle') || 'Purchase Order Print'}</h2>
                  <p className="text-gray-400 text-sm">
                    {t('purchases.view.poNumber')}: #{poData.po_number || ''}
                  </p>
                </div>
              </div>
              <button
                onClick={handleClosePrintModal}
                className="bg-white/20 hover:bg-white/30 p-2 rounded-full transition-colors"
              >
                <X size={24} />
              </button>
            </div>

            {/* Modal Content */}
            <div className="flex-1 flex overflow-hidden">
              {/* Left Sidebar - Options */}
              <div className="w-80 bg-gray-50 border-r border-gray-200 p-6 flex flex-col gap-6 overflow-y-auto">
                {/* Order Summary Card */}
                <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm space-y-4">
                  <h3 className="font-semibold text-gray-900 border-b pb-3 flex items-center gap-2">
                    <FileText size={16} className="text-blue-500" />
                    {t('purchases.view.orderSummary') || 'Order Summary'}
                  </h3>

                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-500">{t('purchases.view.date') || 'Date'}</span>
                      <span className="font-medium text-gray-900">{poData.po_date || '-'}</span>
                    </div>

                    <div className="flex justify-between items-center">
                      <span className="text-gray-500">{t('purchases.view.supplier') || 'Supplier'}</span>
                      <span className="font-medium text-gray-900 text-right truncate max-w-[120px]" title={poData.supplier_name}>
                        {poData.supplier_name || '-'}
                      </span>
                    </div>

                    <div className="flex justify-between items-center pt-3 border-t border-dashed">
                      <span className="text-gray-500">{t('purchases.view.totalAmount') || 'Total Amount'}</span>
                      <span className="font-bold text-green-600 text-base">
                        ₹{(parseFloat(poData.totals?.net_payable || poData.totals?.grand_total || 0)).toFixed(2)}
                      </span>
                    </div>

                    <div className="flex justify-between items-center pt-2">
                      <span className="text-gray-500">{t('purchases.view.status') || 'Status'}</span>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(poData.status)}`}>
                        {poData.status}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="space-y-3 mt-auto">
                  <button
                    onClick={() => {
                      if (!pdfUrl) return;
                      const link = document.createElement('a');
                      link.href = pdfUrl;
                      link.download = `PO-${poData.po_number || 'document'}.pdf`;
                      document.body.appendChild(link);
                      link.click();
                      document.body.removeChild(link);
                    }}
                    disabled={!pdfUrl || isGeneratingPdf}
                    className="w-full py-3 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 rounded-lg font-semibold shadow-sm flex items-center justify-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Download size={20} />
                    {t('purchases.view.downloadPdf') || 'Download PDF'}
                  </button>

                  <button
                    onClick={() => {
                      const iframe = document.getElementById('po-preview-frame');
                      if (iframe) iframe.contentWindow.print();
                    }}
                    disabled={!pdfUrl || isGeneratingPdf}
                    className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold shadow-md flex items-center justify-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Printer size={20} />
                    {t('purchases.view.printNow') || 'Print Now'}
                  </button>
                </div>
              </div>

              {/* Right Content - PDF Preview */}
              <div className="flex-1 bg-gray-100 p-8 flex items-center justify-center overflow-hidden">
                {isGeneratingPdf ? (
                  <div className="text-center bg-white p-8 rounded-xl shadow-sm border border-gray-100">
                    <Loader2 className="w-12 h-12 text-blue-600 animate-spin mx-auto mb-4" />
                    <p className="text-gray-600 font-medium text-lg">{t('purchases.view.generatingPreview') || 'Generating Preview...'}</p>
                    <p className="text-gray-400 text-sm mt-2">Please wait while we prepare your document</p>
                  </div>
                ) : pdfUrl ? (
                  <div className="w-full h-full bg-white rounded-lg shadow-xl overflow-hidden animate-in fade-in zoom-in duration-300">
                    <iframe
                      id="po-preview-frame"
                      src={`${pdfUrl}#toolbar=0&view=FitH`}
                      className="w-full h-full"
                      title="PO Preview"
                    />
                  </div>
                ) : (
                  <div className="text-center text-gray-500">
                    <AlertCircle size={48} className="mx-auto mb-4 text-gray-300" />
                    <p>{t('purchases.view.previewUnavailable') || 'Preview unavailable'}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default View;