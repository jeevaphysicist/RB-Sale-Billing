import React, { useState, useEffect } from 'react';
import { DollarSign, Trash2, Eye } from 'lucide-react';
import { toast } from 'sonner';
import { paymentRecordService } from '../../../services/paymentRecordService';
import Modal from '../../../components/Modal';
import AlertModal from '../../../components/AlertModal';
import { useTranslation } from 'react-i18next';

const AddEditForm = ({ isOpen, onClose, purchaseOrder, onSuccess }) => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [paymentRecords, setPaymentRecords] = useState([]);
  const [loadingRecords, setLoadingRecords] = useState(false);
  const [deleteModal, setDeleteModal] = useState({
    isOpen: false,
    payment: null,
    loading: false
  });
  const [formData, setFormData] = useState({
    paymentDate: new Date().toISOString().split('T')[0],
    paymentAmount: '',
    paymentMethod: 'Cash',
    referenceNumber: '',
    bankName: '',
    chequeNumber: '',
    transactionId: '',
    notes: ''
  });

  const [errors, setErrors] = useState({});

  // Calculate balance amount
  const balanceAmount = purchaseOrder ? purchaseOrder.balance_amount : 0;

  // Fetch existing payment records
  useEffect(() => {
    const fetchPaymentRecords = async () => {
      if (!purchaseOrder?.id) return;
      
      try {
        setLoadingRecords(true);
        const records = await paymentRecordService.getPaymentRecordsByPO({
          recordType: 'purchase',
          referenceId: purchaseOrder.id
        });
        setPaymentRecords(records);
      } catch (error) {
        console.error('Error fetching payment records:', error);
      } finally {
        setLoadingRecords(false);
      }
    };

    if (isOpen) {
      fetchPaymentRecords();
    }
  }, [isOpen, purchaseOrder?.id]);

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

  // Handle input change
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    
    // Clear error for this field
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
  };

  // Validate form
  const validateForm = () => {
    const newErrors = {};

    if (!formData.paymentDate) {
      newErrors.paymentDate = 'Payment date is required';
    }

    if (!formData.paymentAmount || parseFloat(formData.paymentAmount) <= 0) {
      newErrors.paymentAmount = 'Valid payment amount is required';
    } else if (parseFloat(formData.paymentAmount) > balanceAmount) {
      newErrors.paymentAmount = `Amount cannot exceed balance (${formatCurrency(balanceAmount)})`;
    }

    if (!formData.paymentMethod) {
      newErrors.paymentMethod = 'Payment method is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handle submit
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) {
      toast.error('Please fix the errors in the form');
      return;
    }

    try {
      setLoading(true);

      const paymentData = {
        recordType: 'purchase',
        referenceId: purchaseOrder.id,
        paymentDate: formData.paymentDate,
        paymentAmount: parseFloat(formData.paymentAmount),
        paymentMethod: formData.paymentMethod,
        referenceNumber: formData.referenceNumber || null,
        bankName: formData.bankName || null,
        chequeNumber: formData.chequeNumber || null,
        transactionId: formData.transactionId || null,
        notes: formData.notes || null
      };

      const response = await paymentRecordService.createPaymentRecord(paymentData);

      if (response.success) {
        toast.success(t('toasts.saveSuccess'));
        
        // Reset form
        setFormData({
          paymentDate: new Date().toISOString().split('T')[0],
          paymentAmount: '',
          paymentMethod: 'Cash',
          referenceNumber: '',
          bankName: '',
          chequeNumber: '',
          transactionId: '',
          notes: ''
        });
        
        // Refresh payment records
        const records = await paymentRecordService.getPaymentRecordsByPO({
          recordType: 'purchase',
          referenceId: purchaseOrder.id
        });
        setPaymentRecords(records);
        
        // Notify parent to refresh
        onSuccess();
      } else {
        toast.error(response.message || t('purchases.payment.failedToAdd'));
      }
    } catch (error) {
      console.error('Error creating payment record:', error);
      toast.error(error.message || t('purchases.payment.failedToAdd'));
    } finally {
      setLoading(false);
    }
  };

  // Handle delete payment record
  const handleDeleteClick = (payment) => {
    setDeleteModal({
      isOpen: true,
      payment,
      loading: false
    });
  };

  const handleConfirmDelete = async () => {
    if (!deleteModal.payment) return;

    try {
      setDeleteModal(prev => ({ ...prev, loading: true }));
      
      const response = await paymentRecordService.deletePaymentRecord(deleteModal.payment.id);
      
      if (response.success) {
        toast.success(t('toasts.deleteSuccess'));
        
        // Refresh payment records
        const records = await paymentRecordService.getPaymentRecordsByPO({
          recordType: 'purchase',
          referenceId: purchaseOrder.id
        });
        setPaymentRecords(records);
        
        // Notify parent to refresh
        onSuccess();
      } else {
        toast.error(response.message || t('toasts.deleteFailed'));
      }
    } catch (error) {
      console.error('Error deleting payment record:', error);
      toast.error(error.message || t('toasts.deleteFailed'));
    } finally {
      setDeleteModal({ isOpen: false, payment: null, loading: false });
    }
  };

  const handleCancelDelete = () => {
    setDeleteModal({ isOpen: false, payment: null, loading: false });
  };

  // Format currency
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2
    }).format(amount || 0);
  };

  // Format date
  const formatDate = (dateString) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Payment Records - ${purchaseOrder?.po_number || ''}`}
      onSubmit={handleSubmit}
      isSubmitting={loading}
      submitText={t('purchases.payment.submit')}
      width="1000px"
    >
      <div className="space-y-6">
        {/* PO Summary */}
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-5">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div>
              <p className="text-xs text-blue-600 font-medium mb-1">{t('purchases.view.poNumber')}</p>
              <p className="text-sm font-bold text-blue-900">{purchaseOrder?.po_number}</p>
            </div>
            <div>
              <p className="text-xs text-gray-600 font-medium mb-1">{t('purchases.columns.supplier')}</p>
              <p className="text-sm font-bold text-gray-900">{purchaseOrder?.supplier_name}</p>
            </div>
            <div>
              <p className="text-xs text-blue-600 font-medium mb-1">{t('purchases.paymentRecords.paymentHistory.totalAmount')}</p>
              <p className="text-sm font-bold text-blue-900">{formatCurrency(purchaseOrder?.net_payable)}</p>
            </div>
            <div>
              <p className="text-xs text-green-600 font-medium mb-1">{t('purchases.paymentRecords.paymentHistory.amountPaid')}</p>
              <p className="text-sm font-bold text-green-900">{formatCurrency(purchaseOrder?.amount_paid)}</p>
            </div>
            <div>
              <p className="text-xs text-red-600 font-medium mb-1">{t('purchases.paymentRecords.paymentHistory.balance')}</p>
              <p className="text-sm font-bold text-red-900">{formatCurrency(balanceAmount)}</p>
            </div>
          </div>
        </div>

        {/* Existing Payment Records Table */}
        <div>
          <h3 className="text-lg font-semibold text-gray-800 mb-3">{t('purchases.paymentRecords.paymentHistory.title')}</h3>
          {loadingRecords ? (
            <div className="text-center py-8">
              <div className="inline-block w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
              <p className="text-sm text-gray-500 mt-2">{t('purchases.view.loadingPayments')}</p>
            </div>
          ) : paymentRecords.length === 0 ? (
            <div className="text-center py-8 bg-gray-50 rounded-lg border border-gray-200">
              <p className="text-gray-500">{t('purchases.paymentRecords.paymentHistory.noPayments')}</p>
            </div>
          ) : (
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('purchases.paymentRecords.paymentHistory.paymentDate')}</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('purchases.paymentRecords.paymentHistory.amount')}</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('purchases.paymentRecords.paymentHistory.method')}</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('purchases.paymentRecords.paymentHistory.reference')}</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('purchases.paymentRecords.paymentHistory.notes')}</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">{t('purchases.paymentRecords.paymentHistory.action')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {paymentRecords.map((record) => (
                    <tr key={record.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm text-gray-900">{formatDate(record.payment_date)}</td>
                      <td className="px-4 py-3 text-sm font-semibold text-green-600">{formatCurrency(record.payment_amount)}</td>
                      <td className="px-4 py-3 text-sm text-gray-900">{record.payment_method}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{record.reference_number || '-'}</td>
                      <td className="px-4 py-3 text-sm text-gray-600 max-w-xs truncate">{record.notes || '-'}</td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => handleDeleteClick(record)}
                          className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors"
                          title={t('common.delete')}
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Add New Payment Form */}
        <div className="border-t border-gray-200 pt-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">{t('purchases.payment.modalTitle')}</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Payment Date */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('purchases.payment.date')} <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                name="paymentDate"
                value={formData.paymentDate}
                onChange={handleChange}
                className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                  errors.paymentDate ? 'border-red-500' : 'border-gray-300'
                }`}
                disabled={loading}
              />
              {errors.paymentDate && (
                <p className="mt-1 text-sm text-red-500">{errors.paymentDate}</p>
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
                  name="paymentAmount"
                  value={formData.paymentAmount}
                  onChange={handleChange}
                  placeholder="0.00"
                  step="0.01"
                  min="0"
                  max={balanceAmount}
                  className={`w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                    errors.paymentAmount ? 'border-red-500' : 'border-gray-300'
                  }`}
                  disabled={loading}
                />
              </div>
              {errors.paymentAmount && (
                <p className="mt-1 text-sm text-red-500">{errors.paymentAmount}</p>
              )}
              <p className="mt-1 text-xs text-gray-500">
                {t('purchases.payment.maxAmount')}: {formatCurrency(balanceAmount)}
              </p>
            </div>

            {/* Payment Method */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('purchases.payment.method')} <span className="text-red-500">*</span>
              </label>
              <select
                name="paymentMethod"
                value={formData.paymentMethod}
                onChange={handleChange}
                className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                  errors.paymentMethod ? 'border-red-500' : 'border-gray-300'
                }`}
                disabled={loading}
              >
                {paymentMethods.map(method => (
                  <option key={method} value={method}>{method}</option>
                ))}
              </select>
              {errors.paymentMethod && (
                <p className="mt-1 text-sm text-red-500">{errors.paymentMethod}</p>
              )}
            </div>

            {/* Reference Number */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('purchases.payment.referenceNumber')}
              </label>
              <input
                type="text"
                name="referenceNumber"
                value={formData.referenceNumber}
                onChange={handleChange}
                placeholder={t('purchases.payment.enterReference')}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                disabled={loading}
              />
            </div>

            {/* Bank Details (conditional) */}
            {['Bank Transfer', 'Cheque', 'Net Banking'].includes(formData.paymentMethod) && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {t('purchases.payment.bankName')}
                  </label>
                  <input
                    type="text"
                    name="bankName"
                    value={formData.bankName}
                    onChange={handleChange}
                    placeholder={t('purchases.payment.enterBankName')}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    disabled={loading}
                  />
                </div>
                {formData.paymentMethod === 'Cheque' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {t('purchases.payment.chequeNumber')}
                    </label>
                    <input
                      type="text"
                      name="chequeNumber"
                      value={formData.chequeNumber}
                      onChange={handleChange}
                      placeholder={t('purchases.payment.enterChequeNumber')}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      disabled={loading}
                    />
                  </div>
                )}
              </div>
            )}

            {/* Transaction ID (for digital payments) */}
            {['UPI', 'Credit Card', 'Debit Card', 'Net Banking'].includes(formData.paymentMethod) && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t('purchases.payment.transactionId')}
                </label>
                <input
                  type="text"
                  name="transactionId"
                  value={formData.transactionId}
                  onChange={handleChange}
                  placeholder={t('purchases.payment.enterTransactionId')}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  disabled={loading}
                />
              </div>
            )}

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('purchases.payment.notes')}
              </label>
              <textarea
                name="notes"
                value={formData.notes}
                onChange={handleChange}
                placeholder={t('purchases.payment.addNotes')}
                rows={3}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                disabled={loading}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      <AlertModal
        isVisible={deleteModal.isOpen}
        modeltitle={t('purchases.paymentRecords.deleteModal.title')}
        message={`${t('purchases.paymentRecords.deleteModal.message')} ${formatCurrency(deleteModal.payment?.payment_amount)}?`}
        onConfirm={handleConfirmDelete}
        onCancel={handleCancelDelete}
        loading={deleteModal.loading}
        buttonText={t('common.delete')}
      />
    </Modal>
  );
};

export default AddEditForm;