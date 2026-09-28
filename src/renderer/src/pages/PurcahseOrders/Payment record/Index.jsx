import React, { useState, useEffect } from 'react';
import { Receipt, Plus, Eye, Edit, Trash2, CheckCircle2, AlertCircle } from 'lucide-react';
import DataTable from '../../../components/DataTable';
import { toast } from 'sonner';
import AddEditForm from './AddEditForm';
import AlertModal from '../../../components/AlertModal';
import Modal from '../../../components/Modal';
import { paymentRecordService } from '../../../services/paymentRecordService';
import { useTranslation } from 'react-i18next';

const Index = () => {
  const { t } = useTranslation();
  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [totalRecords, setTotalRecords] = useState(0);
  const [loading, setLoading] = useState(false);
  const [paymentModal, setPaymentModal] = useState(false);
  const [selectedPO, setSelectedPO] = useState(null);
  const [viewPaymentsModal, setViewPaymentsModal] = useState(false);
  const [paymentRecords, setPaymentRecords] = useState([]);
  const [deleteModal, setDeleteModal] = useState({
    isOpen: false,
    payment: null,
    loading: false
  });
  const [filters, setFilters] = useState({
    search: '',
    sortBy: 'po_date',
    sortOrder: 'desc',
    page: 1,
    limit: 10
  });

  // Fetch purchase orders with payment summary
  const fetchPurchaseOrders = async (newFilters = {}) => {
    try {
      setLoading(true);
      
      const updatedFilters = { ...filters, ...newFilters };
      
      const apiFilters = {
        recordType: 'purchase',
        searchTerm: updatedFilters.search || '',
        sortKey: updatedFilters.sortBy === 'sno' ? 'id' : updatedFilters.sortBy,
        sortDirection: updatedFilters.sortOrder === 'desc' ? 'DESC' : 'ASC',
        page: updatedFilters.page || 1,
        limit: updatedFilters.limit || 10
      };

      console.log('Fetching PO summary with filters:', apiFilters);
      
      const response = await paymentRecordService.getPOSummary(apiFilters);

      if (response.success) {
        setPurchaseOrders(response.data || []);
        setTotalRecords(response.total || 0);
        
        setFilters(prev => ({
          ...prev,
          ...updatedFilters,
          page: parseInt(updatedFilters.page, 10) || 1
        }));
      } else {
        toast.error(response.message || t('purchases.paymentRecords.messages.loadFailed'));
      }
    } catch (error) {
      console.error('Error fetching purchase orders:', error);
      toast.error(t('purchases.paymentRecords.messages.loadFailed'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPurchaseOrders();
  }, []);

  // Handle add payment
  const handleAddPayment = (po) => {
    setSelectedPO(po);
    setPaymentModal(true);
  };

  // Handle view payments
  const handleViewPayments = async (po) => {
    try {
      setSelectedPO(po);
      const records = await paymentRecordService.getPaymentRecordsByPO({
        recordType: 'purchase',
        referenceId: po.id
      });
      setPaymentRecords(records);
      setViewPaymentsModal(true);
    } catch (error) {
      console.error('Error fetching payment records:', error);
      toast.error(t('purchases.paymentRecords.messages.paymentLoadFailed'));
    }
  };

  // Handle delete payment
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
      
      if (response && response.success) {
        toast.success(response.message || t('purchases.paymentRecords.messages.deleteSuccess'));
        fetchPurchaseOrders();
        
        // Refresh payment records if viewing them
        if (viewPaymentsModal && selectedPO) {
          const records = await paymentRecordService.getPaymentRecordsByPO({
            recordType: 'purchase',
            referenceId: selectedPO.id
          });
          setPaymentRecords(records);
        }
      } else {
        throw new Error(response?.message || 'Failed to delete payment record');
      }
    } catch (error) {
      console.error('Error deleting payment record:', error);
      toast.error(error.message || t('purchases.paymentRecords.messages.deleteFailed'));
    } finally {
      setDeleteModal({ isOpen: false, payment: null, loading: false });
    }
  };

  const handleCancelDelete = () => {
    setDeleteModal({ isOpen: false, payment: null, loading: false });
  };

  // Handle form success
  const handleFormSuccess = () => {
    setPaymentModal(false);
    setSelectedPO(null);
    fetchPurchaseOrders();
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

  // Table columns
  const columns = [
    {
      key: 'sno',
      label: t('purchases.paymentRecords.columns.sNo'),
      sortable: false,
      width: '60px'
    },
    {
      key: 'po_number',
      label: t('purchases.paymentRecords.columns.poNumber'),
      sortable: true,
      render: (value) => (
        <span className="text-sm font-medium text-blue-600">{value || '-'}</span>
      )
    },
    {
      key: 'po_date',
      label: t('purchases.paymentRecords.columns.poDate'),
      sortable: true,
      render: (value) => (
        <span className="text-sm text-gray-900">{formatDate(value)}</span>
      )
    },
    {
      key: 'supplier_name',
      label: t('purchases.paymentRecords.columns.supplier'),
      sortable: true,
      render: (value) => (
        <span className="text-sm text-gray-900">{value || '-'}</span>
      )
    },
    {
      key: 'item_count',
      label: t('purchases.paymentRecords.columns.items'),
      sortable: false,
      render: (value) => (
        <span className="text-sm text-gray-600">{value || 0}</span>
      )
    },
    {
      key: 'payment_status',
      label: t('purchases.paymentRecords.columns.paymentStatus'),
      sortable: true,
      render: (value) => {
        const statusColors = {
          'pending': 'bg-yellow-100 text-yellow-700',
          'partial': 'bg-blue-100 text-blue-700',
          'paid': 'bg-green-100 text-green-700'
        };
        return (
          <span className={`px-2 py-1 text-xs font-medium rounded-full ${statusColors[value] || 'bg-gray-100 text-gray-700'}`}>
            {value ? t(`purchases.paymentRecords.status.${value}`) : t('purchases.paymentRecords.status.pending')}
          </span>
        );
      }
    },
    {
      key: 'status',
      label: t('purchases.paymentRecords.columns.orderStatus'),
      sortable: true,
      render: (value) => {
        const statusColors = {
          'Draft': 'bg-gray-100 text-gray-700',
          'Pending': 'bg-yellow-100 text-yellow-700',
          'Approved': 'bg-blue-100 text-blue-700',
          'Completed': 'bg-green-100 text-green-700',
          'Cancelled': 'bg-red-100 text-red-700'
        };
        const statusKey = value ? value.toLowerCase() : 'draft';
        return (
          <span className={`px-2 py-1 text-xs font-medium rounded-full ${statusColors[value] || 'bg-gray-100 text-gray-700'}`}>
            {t(`purchases.paymentRecords.status.${statusKey}`)}
          </span>
        );
      }
    },
    {
      key: 'net_payable',
      label: t('purchases.paymentRecords.columns.totalAmount'),
      sortable: true,
      render: (value) => (
        <span className="text-sm font-medium text-gray-900">{formatCurrency(value)}</span>
      )
    },
    {
      key: 'amount_paid',
      label: t('purchases.paymentRecords.columns.amountPaid'),
      sortable: false,
      render: (value) => (
        <span className="text-sm font-medium text-green-600">{formatCurrency(value)}</span>
      )
    },
    {
      key: 'balance_amount',
      label: t('purchases.paymentRecords.columns.balance'),
      sortable: false,
      render: (value, row) => {
        const isFullyPaid = value <= 0;
        return (
          <div className="flex items-center gap-2">
            <span className={`text-sm font-medium ${isFullyPaid ? 'text-green-600' : 'text-red-600'}`}>
              {formatCurrency(value)}
            </span>
            {isFullyPaid && <CheckCircle2 className="w-4 h-4 text-green-500" />}
          </div>
        );
      }
    },
    {
      key: 'actions',
      label: t('purchases.paymentRecords.columns.actions'),
      sortable: false,
      render: (value, row) => {
        const isFullyPaid = row.balance_amount <= 0;
        return (
          <div className="flex gap-2">
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleViewPayments(row);
              }}
              className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-colors"
              title={t('purchases.paymentRecords.actions.viewPayments')}
            >
              <Eye size={16} />
            </button>
            {!isFullyPaid && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleAddPayment(row);
                }}
                className="p-1.5 text-green-600 hover:bg-green-50 rounded transition-colors"
                title={t('purchases.paymentRecords.actions.addPayment')}
              >
                <Plus size={16} />
              </button>
            )}
          </div>
        );
      }
    }
  ];

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Receipt className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-800">{t('purchases.paymentRecords.title')}</h1>
              <p className="text-sm text-gray-500">{t('purchases.paymentRecords.subtitle')}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Data Table */}
      <DataTable
        data={purchaseOrders}
        columns={columns}
        totalRecords={totalRecords}
        loading={loading}
        onFilterChange={(newFilters) => {
          fetchPurchaseOrders({ ...filters, ...newFilters });
        }}
        initialFilters={filters}
        searchable={true}
        sortable={true}
        pagination={true}
        currentPage={filters.page}
        emptyMessage={
          <div className="py-12 text-center">
            <Receipt className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">{t('purchases.paymentRecords.messages.noOrdersFound')}</h3>
            <p className="text-gray-500">{t('purchases.paymentRecords.messages.ordersWillAppear')}</p>
          </div>
        }
        searchPlaceholder={t('purchases.paymentRecords.searchPlaceholder')}
      />

      {/* Add Payment Modal */}
      {paymentModal && selectedPO && (
        <AddEditForm
          isOpen={paymentModal}
          onClose={() => {
            setPaymentModal(false);
            setSelectedPO(null);
          }}
          purchaseOrder={selectedPO}
          onSuccess={handleFormSuccess}
        />
      )}

      {/* View Payments Modal */}
      {viewPaymentsModal && selectedPO && (
        <Modal
          isOpen={viewPaymentsModal}
          onClose={() => {
            setViewPaymentsModal(false);
            setSelectedPO(null);
            setPaymentRecords([]);
          }}
          title={`${t('purchases.paymentRecords.paymentHistory.title')} - ${selectedPO.po_number}`}
          width="900px"
        >
          <div className="space-y-6">
            {/* PO Summary */}
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-5">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <p className="text-xs text-blue-600 font-medium mb-1">{t('purchases.paymentRecords.paymentHistory.totalAmount')}</p>
                  <p className="text-sm font-bold text-blue-900">{formatCurrency(selectedPO.net_payable)}</p>
                </div>
                <div>
                  <p className="text-xs text-green-600 font-medium mb-1">{t('purchases.paymentRecords.paymentHistory.amountPaid')}</p>
                  <p className="text-sm font-bold text-green-900">{formatCurrency(selectedPO.amount_paid)}</p>
                </div>
                <div>
                  <p className="text-xs text-red-600 font-medium mb-1">{t('purchases.paymentRecords.paymentHistory.balance')}</p>
                  <p className={`text-sm font-bold ${selectedPO.balance_amount <= 0 ? 'text-green-900' : 'text-red-900'}`}>
                    {formatCurrency(selectedPO.balance_amount)}
                  </p>
                </div>
              </div>
            </div>

            {/* Payment Records */}
            <div>
              {paymentRecords.length === 0 ? (
                <div className="text-center py-12">
                  <AlertCircle className="w-16 h-16 text-gray-300 mx-auto mb-4" />
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
                      {paymentRecords.map((payment) => (
                        <tr key={payment.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-sm text-gray-900">{formatDate(payment.payment_date)}</td>
                          <td className="px-4 py-3 text-sm font-semibold text-green-600">{formatCurrency(payment.payment_amount)}</td>
                          <td className="px-4 py-3 text-sm text-gray-900">{payment.payment_method}</td>
                          <td className="px-4 py-3 text-sm text-gray-600">{payment.reference_number || '-'}</td>
                          <td className="px-4 py-3 text-sm text-gray-600 max-w-xs truncate">{payment.notes || '-'}</td>
                          <td className="px-4 py-3 text-center">
                            <button
                              onClick={() => handleDeleteClick(payment)}
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

            {/* Summary Footer */}
            <div className="border-t border-gray-200 pt-4">
              <div className="flex items-center justify-between bg-gray-50 rounded-lg p-4">
                <div className="text-sm text-gray-600">
                  {t('purchases.paymentRecords.paymentHistory.totalPayments')}: <span className="font-semibold text-gray-900">{paymentRecords.length}</span>
                </div>
                <div className="flex gap-8">
                  <div className="text-right">
                    <p className="text-xs text-gray-500 mb-1">{t('purchases.paymentRecords.paymentHistory.amountPaid')}</p>
                    <p className="text-lg font-bold text-green-600">{formatCurrency(selectedPO.amount_paid)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-500 mb-1">{t('purchases.paymentRecords.paymentHistory.balance')}</p>
                    <p className={`text-lg font-bold ${selectedPO.balance_amount <= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {formatCurrency(selectedPO.balance_amount)}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Modal>
      )}

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
    </div>
  );
};

export default Index;