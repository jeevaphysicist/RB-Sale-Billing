import React, { useState, useEffect } from 'react';
import { Receipt, Plus, Eye, Edit, Trash2, CheckCircle2, AlertCircle } from 'lucide-react';
import DataTable from '../../../components/DataTable';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import AddEditForm from './AddEditForm';
import AlertModal from '../../../components/AlertModal';
import Modal from '../../../components/Modal';
import { paymentRecordService } from '../../../services/paymentRecordService';
import { salesOrderService } from '../../../services/salesOrderService';

const Index = () => {
  const { t } = useTranslation();
  const [salesOrders, setSalesOrders] = useState([]);
  const [totalRecords, setTotalRecords] = useState(0);
  const [loading, setLoading] = useState(false);
  const [paymentModal, setPaymentModal] = useState(false);
  const [selectedSO, setSelectedSO] = useState(null);
  const [viewPaymentsModal, setViewPaymentsModal] = useState(false);
  const [paymentRecords, setPaymentRecords] = useState([]);
  const [deleteModal, setDeleteModal] = useState({
    isOpen: false,
    payment: null,
    loading: false
  });
  const [filters, setFilters] = useState({
    search: '',
    sortBy: 'order_date',
    sortOrder: 'desc',
    page: 1,
    limit: 10
  });

  // Fetch sales orders with payment summary
  const fetchSalesOrders = async (newFilters = {}) => {
    try {
      setLoading(true);

      const updatedFilters = { ...filters, ...newFilters };

      const apiFilters = {
        recordType: 'sales',
        searchTerm: updatedFilters.search || '',
        sortKey: updatedFilters.sortBy === 'sno' ? 'id' : updatedFilters.sortBy,
        sortDirection: updatedFilters.sortOrder === 'desc' ? 'DESC' : 'ASC',
        page: updatedFilters.page || 1,
        limit: updatedFilters.limit || 10
      };

      console.log('Fetching SO summary with filters:', apiFilters);

      const response = await salesOrderService.getSOSummary(apiFilters);

      if (response.success) {
        setSalesOrders(response.data || []);
        setTotalRecords(response.total || 0);

        setFilters(prev => ({
          ...prev,
          ...updatedFilters,
          page: parseInt(updatedFilters.page, 10) || 1
        }));
      } else {
        toast.error(response.message || t('sales.paymentTracking.messages.loadFailed'));
      }
    } catch (error) {
      console.error('Error fetching sales orders:', error);
      toast.error(t('sales.paymentTracking.messages.loadFailed'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSalesOrders();
  }, []);

  // Handle add payment
  const handleAddPayment = (so) => {
    setSelectedSO(so);
    setPaymentModal(true);
  };

  // Handle view payments
  const handleViewPayments = async (so) => {
    try {
      setSelectedSO(so);
      const records = await paymentRecordService.getPaymentRecordsByPO({
        recordType: 'sales',
        referenceId: so.id
      });
      setPaymentRecords(records);
      setViewPaymentsModal(true);
    } catch (error) {
      console.error('Error fetching payment records:', error);
      toast.error(t('sales.paymentTracking.messages.paymentRecordsLoadFailed'));
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
        toast.success(response.message || t('sales.paymentTracking.messages.paymentDeleted'));
        fetchSalesOrders();

        // Refresh payment records if viewing them
        if (viewPaymentsModal && selectedSO) {
          const records = await paymentRecordService.getPaymentRecordsByPO({
            recordType: 'sales',
            referenceId: selectedSO.id
          });
          setPaymentRecords(records);
        }
      } else {
        throw new Error(response?.message || t('sales.paymentTracking.messages.paymentDeleteFailed'));
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

  // Handle form success
  const handleFormSuccess = () => {
    setPaymentModal(false);
    setSelectedSO(null);
    fetchSalesOrders();
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

  // Get translated status
  const getTranslatedStatus = (status) => {
    const statusMap = {
      'pending': t('sales.paymentTracking.status.pending'),
      'partial': t('sales.paymentTracking.status.partial'),
      'paid': t('sales.paymentTracking.status.paid'),
      'refunded': t('sales.paymentTracking.status.refunded')
    };
    return statusMap[status] || status;
  };

  // Get translated order status
  const getTranslatedOrderStatus = (status) => {
    const statusMap = {
      'completed': t('sales.paymentTracking.status.completed'),
      'pending': t('sales.paymentTracking.status.pending'),
      'returned': t('sales.paymentTracking.status.returned'),
      'cancelled': t('sales.paymentTracking.status.cancelled')
    };
    return statusMap[status] || status;
  };

  // Table columns
  const columns = [
    {
      key: 'sno',
      label: t('sales.paymentTracking.columns.hash'),
      width: '80px',
      sortable: false
    },
    {
      key: 'order_number',
      label: t('sales.paymentTracking.columns.orderNumber'),
      sortable: true,
      render: (value) => (
        <span className="text-sm font-medium text-blue-600">{value || '-'}</span>
      )
    },
    {
      key: 'order_date',
      label: t('sales.paymentTracking.columns.orderDate'),
      sortable: true,
      render: (value) => (
        <span className="text-sm text-gray-900">{formatDate(value)}</span>
      )
    },
    {
      key: 'customer_name',
      label: t('sales.paymentTracking.columns.customer'),
      sortable: true,
      render: (value) => (
        <span className="text-sm text-gray-900">{value || '-'}</span>
      )
    },
    {
      key: 'item_count',
      label: t('sales.paymentTracking.columns.items'),
      sortable: false,
      render: (value) => (
        <span className="text-sm text-gray-600">{value || 0}</span>
      )
    },
    {
      key: 'payment_status',
      label: t('sales.paymentTracking.columns.paymentStatus'),
      sortable: true,
      render: (value) => {
        const statusColors = {
          'pending': 'bg-yellow-100 text-yellow-700',
          'partial': 'bg-blue-100 text-blue-700',
          'paid': 'bg-green-100 text-green-700',
          'refunded': 'bg-orange-100 text-orange-700'
        };
        return (
          <span className={`px-2 py-1 text-xs font-medium rounded-full ${statusColors[value] || 'bg-gray-100 text-gray-700'}`}>
            {getTranslatedStatus(value)}
          </span>
        );
      }
    },
    {
      key: 'status',
      label: t('sales.paymentTracking.columns.orderStatus'),
      sortable: true,
      render: (value) => {
        const statusColors = {
          'pending': 'bg-yellow-100 text-yellow-700',
          'completed': 'bg-green-100 text-green-700',
          'returned': 'bg-orange-100 text-orange-700',
          'cancelled': 'bg-red-100 text-red-700'
        };
        return (
          <span className={`px-2 py-1 text-xs font-medium rounded-full ${statusColors[value] || 'bg-gray-100 text-gray-700'}`}>
            {getTranslatedOrderStatus(value)}
          </span>
        );
      }
    },
    {
      key: 'grand_total',
      label: t('sales.paymentTracking.columns.totalAmount'),
      sortable: true,
      render: (value) => (
        <span className="text-sm font-medium text-gray-900">{formatCurrency(value)}</span>
      )
    },
    {
      key: 'amount_paid',
      label: t('sales.paymentTracking.columns.amountPaid'),
      sortable: false,
      render: (value) => (
        <span className="text-sm font-medium text-green-600">{formatCurrency(value)}</span>
      )
    },
    {
      key: 'balance_amount',
      label: t('sales.paymentTracking.columns.balance'),
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
      label: t('common.actions'),
      sortable: false,
      render: (value, row) => {
        const isFullyPaid = row.balance_amount <= 0;
        const isInactive = row.status === 'cancelled' || row.status === 'returned';
        return (
          <div className="flex gap-2">
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleViewPayments(row);
              }}
              className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-colors"
              title={t('sales.paymentTracking.actions.viewPayments')}
            >
              <Eye size={16} />
            </button>
            {!isFullyPaid && !isInactive && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleAddPayment(row);
                }}
                className="p-1.5 text-green-600 hover:bg-green-50 rounded transition-colors"
                title={t('sales.paymentTracking.actions.addPayment')}
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
              <h1 className="text-2xl font-bold text-gray-800">{t('sales.paymentTracking.title')}</h1>
              <p className="text-sm text-gray-500">{t('sales.paymentTracking.subtitle')}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Data Table */}
      <DataTable
        data={salesOrders}
        columns={columns}
        totalRecords={totalRecords}
        loading={loading}
        onFilterChange={(newFilters) => {
          fetchSalesOrders({ ...filters, ...newFilters });
        }}
        initialFilters={filters}
        searchable={true}
        sortable={true}
        pagination={true}
        currentPage={filters.page}
        emptyMessage={
          <div className="py-12 text-center">
            <Receipt className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">{t('sales.paymentTracking.noOrders')}</h3>
            <p className="text-gray-500">{t('sales.paymentTracking.ordersAppear')}</p>
          </div>
        }
        searchPlaceholder={t('sales.paymentTracking.searchPlaceholder')}
      />

      {/* Add Payment Modal */}
      {paymentModal && selectedSO && (
        <AddEditForm
          isOpen={paymentModal}
          onClose={() => {
            setPaymentModal(false);
            setSelectedSO(null);
          }}
          salesOrder={selectedSO}
          onSuccess={handleFormSuccess}
        />
      )}

      {/* View Payments Modal */}
      {viewPaymentsModal && selectedSO && (
        <Modal
          isOpen={viewPaymentsModal}
          onClose={() => {
            setViewPaymentsModal(false);
            setSelectedSO(null);
            setPaymentRecords([]);
          }}
          title={`${t('sales.paymentTracking.paymentHistoryModal.title')} - ${selectedSO.order_number}`}
          width="900px"
        >
          <div className="space-y-6">
            {/* SO Summary */}
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-5">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <p className="text-xs text-blue-600 font-medium mb-1">{t('sales.paymentTracking.paymentHistoryModal.totalAmount')}</p>
                  <p className="text-sm font-bold text-blue-900">{formatCurrency(selectedSO.grand_total)}</p>
                </div>
                <div>
                  <p className="text-xs text-green-600 font-medium mb-1">{t('sales.paymentTracking.paymentHistoryModal.amountPaid')}</p>
                  <p className="text-sm font-bold text-green-900">{formatCurrency(selectedSO.amount_paid)}</p>
                </div>
                <div>
                  <p className="text-xs text-red-600 font-medium mb-1">{t('sales.paymentTracking.paymentHistoryModal.balance')}</p>
                  <p className={`text-sm font-bold ${selectedSO.balance_amount <= 0 ? 'text-green-900' : 'text-red-900'}`}>
                    {formatCurrency(selectedSO.balance_amount)}
                  </p>
                </div>
              </div>
            </div>

            {/* Payment Records */}
            <div>
              {paymentRecords.length === 0 ? (
                <div className="text-center py-12">
                  <AlertCircle className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500">{t('sales.paymentTracking.paymentHistoryModal.noRecords')}</p>
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

            {/* Summary Footer */}
            <div className="border-t border-gray-200 pt-4">
              <div className="flex items-center justify-between bg-gray-50 rounded-lg p-4">
                <div className="text-sm text-gray-600">
                  {t('sales.paymentTracking.paymentHistoryModal.totalPayments')}: <span className="font-semibold text-gray-900">{paymentRecords.length}</span>
                </div>
                <div className="flex gap-8">
                  <div className="text-right">
                    <p className="text-xs text-gray-500 mb-1">{t('sales.paymentTracking.paymentHistoryModal.amountPaid')}</p>
                    <p className="text-lg font-bold text-green-600">{formatCurrency(selectedSO.amount_paid)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-500 mb-1">{t('sales.paymentTracking.paymentHistoryModal.balance')}</p>
                    <p className={`text-lg font-bold ${selectedSO.balance_amount <= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {formatCurrency(selectedSO.balance_amount)}
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
        modeltitle={t('sales.paymentTracking.deleteModal.title')}
        message={`${t('sales.paymentTracking.deleteModal.message')} ${formatCurrency(deleteModal.payment?.payment_amount)}?`}
        onConfirm={handleConfirmDelete}
        onCancel={handleCancelDelete}
        loading={deleteModal.loading}
        buttonText={t('sales.paymentTracking.deleteModal.buttonText')}
      />
    </div>
  );
};

export default Index;