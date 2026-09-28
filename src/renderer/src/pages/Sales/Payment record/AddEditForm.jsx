import React, { useState, useEffect } from 'react';
import { DollarSign, Trash2, Eye } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { paymentRecordService } from '../../../services/paymentRecordService';
import Modal from '../../../components/Modal';
import AlertModal from '../../../components/AlertModal';

const AddEditForm = ({ isOpen, onClose, salesOrder, onSuccess }) => {
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
  const balanceAmount = salesOrder ? salesOrder.balance_amount : 0;

  // Fetch existing payment records
  useEffect(() => {
    const fetchPaymentRecords = async () => {
      if (!salesOrder?.id) return;
      
      try {
        setLoadingRecords(true);
        const records = await paymentRecordService.getPaymentRecordsByPO({
          recordType: 'sales',
          referenceId: salesOrder.id
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
  }, [isOpen, salesOrder?.id]);

  // Payment methods with translations
  const paymentMethods = [
    { value: 'Cash', label: t('sales.paymentTracking.methods.cash') },
    { value: 'Cheque', label: t('sales.paymentTracking.methods.cheque') },
    { value: 'Bank Transfer', label: t('sales.paymentTracking.methods.bankTransfer') },
    { value: 'UPI', label: t('sales.paymentTracking.methods.upi') },
    { value: 'Credit Card', label: t('sales.paymentTracking.methods.creditCard') },
    { value: 'Debit Card', label: t('sales.paymentTracking.methods.debitCard') },
    { value: 'Net Banking', label: t('sales.paymentTracking.methods.netBanking') }
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
      newErrors.paymentDate = t('sales.paymentTracking.validation.paymentDateRequired');
    }

    if (!formData.paymentAmount || parseFloat(formData.paymentAmount) <= 0) {
      newErrors.paymentAmount = t('sales.paymentTracking.validation.validAmountRequired');
    } else if (parseFloat(formData.paymentAmount) > balanceAmount) {
      newErrors.paymentAmount = `${t('sales.paymentTracking.validation.amountExceedsBalance')} (${formatCurrency(balanceAmount)})`;
    }

    if (!formData.paymentMethod) {
      newErrors.paymentMethod = t('sales.paymentTracking.validation.paymentMethodRequired');
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handle submit
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) {
      toast.error(t('sales.paymentTracking.validation.fixErrors'));
      return;
    }

    try {
      setLoading(true);

      const paymentData = {
        recordType: 'sales',
        referenceId: salesOrder.id,
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
        toast.success(t('sales.paymentTracking.messages.paymentCreated'));
        
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
          recordType: 'sales',
          referenceId: salesOrder.id
        });
        setPaymentRecords(records);
        
        // Notify parent to refresh
        onSuccess();
      } else {
        toast.error(response.message || t('sales.paymentTracking.messages.paymentCreateFailed'));
      }
    } catch (error) {
      console.error('Error creating payment record:', error);
      toast.error(error.message || t('sales.paymentTracking.messages.paymentCreateFailed'));
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
        toast.success(t('sales.paymentTracking.messages.paymentDeleted'));
        
        // Refresh payment records
        const records = await paymentRecordService.getPaymentRecordsByPO({
          recordType: 'sales',
          referenceId: salesOrder.id
        });
        setPaymentRecords(records);
        
        // Notify parent to refresh
        onSuccess();
      } else {
        toast.error(response.message || t('sales.paymentTracking.messages.paymentDeleteFailed'));
      }
    } catch (error) {
      console.error('Error deleting payment record:', error);
      toast.error(error.message || t('sales.paymentTracking.messages.paymentDeleteFailed'));
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
      title={`${t('sales.paymentTracking.addPaymentModal.title')} - ${salesOrder?.order_number || ''}`}
      onSubmit={handleSubmit}
      isSubmitting={loading}
      submitText={t('sales.paymentTracking.addPaymentModal.submitButton')}
      width="1000px"
    >
      <div className="space-y-6">
        {/* SO Summary */}
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-5">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div>
              <p className="text-xs text-blue-600 font-medium mb-1">{t('sales.paymentTracking.addPaymentModal.orderNumber')}</p>
              <p className="text-sm font-bold text-blue-900">{salesOrder?.order_number}</p>
            </div>
            <div>
              <p className="text-xs text-gray-600 font-medium mb-1">{t('sales.paymentTracking.addPaymentModal.customer')}</p>
              <p className="text-sm font-bold text-gray-900">{salesOrder?.customer_name}</p>
            </div>
            <div>
              <p className="text-xs text-blue-600 font-medium mb-1">{t('sales.paymentTracking.paymentHistoryModal.totalAmount')}</p>
              <p className="text-sm font-bold text-blue-900">{formatCurrency(salesOrder?.grand_total)}</p>
            </div>
            <div>
              <p className="text-xs text-green-600 font-medium mb-1">{t('sales.paymentTracking.paymentHistoryModal.amountPaid')}</p>
              <p className="text-sm font-bold text-green-900">{formatCurrency(salesOrder?.amount_paid)}</p>
            </div>
            <div>
              <p className="text-xs text-red-600 font-medium mb-1">{t('sales.paymentTracking.paymentHistoryModal.balance')}</p>
              <p className="text-sm font-bold text-red-900">{formatCurrency(balanceAmount)}</p>
            </div>
          </div>
        </div>

        {/* Existing Payment Records Table */}
        <div>
          <h3 className="text-lg font-semibold text-gray-800 mb-3">{t('sales.paymentTracking.addPaymentModal.paymentHistory')}</h3>
          {loadingRecords ? (
            <div className="text-center py-8">
              <div className="inline-block w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
              <p className="text-sm text-gray-500 mt-2">{t('sales.paymentTracking.addPaymentModal.loadingRecords')}</p>
            </div>
          ) : paymentRecords.length === 0 ? (
            <div className="text-center py-8 bg-gray-50 rounded-lg border border-gray-200">
              <p className="text-gray-500">{t('sales.paymentTracking.addPaymentModal.noRecords')}</p>
            </div>
          ) : (
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('sales.paymentTracking.paymentHistoryModal.tableHeaders.paymentDate')}</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('sales.paymentTracking.paymentHistoryModal.tableHeaders.amount')}</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('sales.paymentTracking.paymentHistoryModal.tableHeaders.method')}</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('sales.paymentTracking.paymentHistoryModal.tableHeaders.reference')}</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('sales.paymentTracking.paymentHistoryModal.tableHeaders.notes')}</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">{t('sales.paymentTracking.paymentHistoryModal.tableHeaders.action')}</th>
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
                          title={t('sales.paymentTracking.actions.delete')}
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
          <h3 className="text-lg font-semibold text-gray-800 mb-4">{t('sales.paymentTracking.addPaymentModal.addNewPayment')}</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Payment Date */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('sales.paymentTracking.form.paymentDate')} <span className="text-red-500">*</span>
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
                {t('sales.paymentTracking.form.paymentAmount')} <span className="text-red-500">*</span>
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
                {t('sales.paymentTracking.form.maximum')}: {formatCurrency(balanceAmount)}
              </p>
            </div>

            {/* Payment Method */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('sales.paymentTracking.form.paymentMethod')} <span className="text-red-500">*</span>
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
                  <option key={method.value} value={method.value}>{method.label}</option>
                ))}
              </select>
              {errors.paymentMethod && (
                <p className="mt-1 text-sm text-red-500">{errors.paymentMethod}</p>
              )}
            </div>

            {/* Reference Number */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('sales.paymentTracking.form.referenceNumber')}
              </label>
              <input
                type="text"
                name="referenceNumber"
                value={formData.referenceNumber}
                onChange={handleChange}
                placeholder={t('sales.paymentTracking.form.referenceNumberPlaceholder')}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                disabled={loading}
              />
            </div>

            {/* Bank Details (conditional) */}
            {['Bank Transfer', 'Cheque', 'Net Banking'].includes(formData.paymentMethod) && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {t('sales.paymentTracking.form.bankName')}
                  </label>
                  <input
                    type="text"
                    name="bankName"
                    value={formData.bankName}
                    onChange={handleChange}
                    placeholder={t('sales.paymentTracking.form.bankNamePlaceholder')}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    disabled={loading}
                  />
                </div>
                {formData.paymentMethod === 'Cheque' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {t('sales.paymentTracking.form.chequeNumber')}
                    </label>
                    <input
                      type="text"
                      name="chequeNumber"
                      value={formData.chequeNumber}
                      onChange={handleChange}
                      placeholder={t('sales.paymentTracking.form.chequeNumberPlaceholder')}
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
                  {t('sales.paymentTracking.form.transactionId')}
                </label>
                <input
                  type="text"
                  name="transactionId"
                  value={formData.transactionId}
                  onChange={handleChange}
                  placeholder={t('sales.paymentTracking.form.transactionIdPlaceholder')}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  disabled={loading}
                />
              </div>
            )}

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('sales.paymentTracking.form.notes')}
              </label>
              <textarea
                name="notes"
                value={formData.notes}
                onChange={handleChange}
                placeholder={t('sales.paymentTracking.form.notesPlaceholder')}
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
        modeltitle={t('sales.paymentTracking.deleteModal.title')}
        message={`${t('sales.paymentTracking.deleteModal.message')} ${formatCurrency(deleteModal.payment?.payment_amount)}?`}
        onConfirm={handleConfirmDelete}
        onCancel={handleCancelDelete}
        loading={deleteModal.loading}
        buttonText={t('sales.paymentTracking.deleteModal.buttonText')}
      />
    </Modal>
  );
};

export default AddEditForm;