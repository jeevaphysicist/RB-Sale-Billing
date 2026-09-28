import React, { useState, useEffect } from 'react';
import {
  Eye,
  Edit,
  Trash2,
  Download,
  Plus,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  AlertCircle,
  Printer,
  RotateCcw,
  X
} from 'lucide-react';
import DataTable from '../../../components/DataTable';
import { toast } from 'sonner';
import { salesOrderService } from '../../../services/salesOrderService';
import AlertModal from '../../../components/AlertModal';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import PrintPreviewModal from '../../../components/PrintPreviewModal';

const Index = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [data, setData] = useState([]);
  const [totalRecords, setTotalRecords] = useState(0);
  const [loading, setLoading] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [deleteModal, setDeleteModal] = useState({
    isOpen: false,
    order: null,
    loading: false
  });
  const [cancelModal, setCancelModal] = useState({
    isOpen: false,
    order: null,
    loading: false
  });
  const [returnModal, setReturnModal] = useState({
    isOpen: false,
    order: null,
    loading: false
  });
  const [filters, setFilters] = useState({
    search: '',
    sortBy: 'order_date',
    sortOrder: 'desc',
    page: 1,
    limit: 10
  });

  // Print Modal State
  const [printModal, setPrintModal] = useState({
    isOpen: false,
    order: null,
    loading: false
  });
  const [pdfUrl, setPdfUrl] = useState(null);
  const [pdfBase64, setPdfBase64] = useState(null); // Store base64 for direct printing
  const [printingTemplate, setPrintingTemplate] = useState('A4'); // 'A4', '80mm', '50mm'
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  const fetchData = async (newFilters = {}) => {
    try {
      setLoading(true);

      const updatedFilters = { ...filters, ...newFilters };

      const apiFilters = {
        searchTerm: updatedFilters.search || '',
        sortKey: updatedFilters.sortBy,
        sortDirection: updatedFilters.sortOrder === 'desc' ? 'DESC' : 'ASC',
        page: updatedFilters.page || 1,
        limit: updatedFilters.limit || 10
      };

      console.log('Fetching sales orders with filters:', apiFilters);

      const response = await salesOrderService.getAll(apiFilters);

      if (response.success) {
        setData(response.data || []);
        setTotalRecords(response.total || 0);

        setFilters(prev => ({
          ...prev,
          ...updatedFilters,
          page: parseInt(updatedFilters.page, 10) || 1
        }));
      } else {
        toast.error(response.message || t('sales.messages.loadFailed'));
      }
    } catch (error) {
      console.error('Error fetching sales orders:', error);
      toast.error(t('sales.messages.loadFailed'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleDeleteClick = (order) => {
    setDeleteModal({
      isOpen: true,
      order,
      loading: false
    });
  };

  const handleConfirmDelete = async () => {
    if (!deleteModal.order) return;

    try {
      setDeleteModal(prev => ({ ...prev, loading: true }));

      const response = await salesOrderService.delete(deleteModal.order.id);

      if (response && response.success) {
        toast.success(response.message || t('sales.messages.deleteSuccess'));
        fetchData();
      } else {
        throw new Error(response?.message || t('sales.messages.deleteFailed'));
      }
    } catch (error) {
      console.error('Error deleting sales order:', error);
      toast.error(error.message || t('sales.messages.deleteFailed'));
    } finally {
      setDeleteModal({ isOpen: false, order: null, loading: false });
    }
  };

  const handleCancelDelete = () => {
    setDeleteModal({ isOpen: false, order: null, loading: false });
  };

  const handleCancelClick = (order) => {
    setCancelModal({
      isOpen: true,
      order,
      loading: false
    });
  };

  const handleConfirmCancel = async () => {
    if (!cancelModal.order) return;

    try {
      setCancelModal(prev => ({ ...prev, loading: true }));
      const response = await salesOrderService.cancel(cancelModal.order.id);

      if (response && response.success) {
        toast.success(response.message || t('sales.messages.cancelSuccess'));
        fetchData();
      } else {
        throw new Error(response?.message || t('sales.messages.cancelFailed'));
      }
    } catch (error) {
      console.error('Error cancelling sales order:', error);
      toast.error(error.message || t('sales.messages.cancelFailed'));
    } finally {
      setCancelModal({ isOpen: false, order: null, loading: false });
    }
  };

  const handleReturnClick = (order) => {
    setReturnModal({
      isOpen: true,
      order,
      loading: false
    });
  };

  const handleConfirmReturn = async () => {
    if (!returnModal.order) return;

    try {
      setReturnModal(prev => ({ ...prev, loading: true }));
      const response = await salesOrderService.returnOrder(returnModal.order.id);

      if (response && response.success) {
        toast.success(response.message || t('sales.messages.returnSuccess'));
        fetchData();
      } else {
        throw new Error(response?.message || t('sales.messages.returnFailed'));
      }
    } catch (error) {
      console.error('Error returning sales order:', error);
      toast.error(error.message || t('sales.messages.returnFailed'));
    } finally {
      setReturnModal({ isOpen: false, order: null, loading: false });
    }
  };

  const handleEditOrder = (order) => {
    navigate(`/sales/edit/${order.id}`);
  };

  const handleViewClick = (order) => {
    navigate(`/sales/view/${order.id}`);
  };

  const handleAddOrder = () => {
    navigate('/sales/new');
  };

  const handleRowClick = (row) => {
    console.log('Row clicked:', row);
  };

  // Print Functions
  const handlePrintClick = (order) => {
    setPrintModal({
      isOpen: true,
      order: order,
      loading: false
    });
    // Changed from 'A4' or '80mm' to null to use the template configured in settings
    handleGeneratePDF(order.id, null);
  };

  const handleClosePrintModal = () => {
    setPrintModal({ isOpen: false, order: null, loading: false });
    setPdfUrl(null);
    setPdfBase64(null);
  };

  // State for dynamic PDF height (for thermal printers)
  const [pdfHeight, setPdfHeight] = useState(null);

  const handleGeneratePDF = async (orderId, template) => {
    try {
      setIsGeneratingPdf(true);
      setPrintingTemplate(template);
      setPdfHeight(null); // Reset height

      // Pass the ID directly to the service
      const response = await salesOrderService.generatePDF(orderId, template);

      if (response.success) {
        // Create blob from buffer
        const blob = new Blob([response.data], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        setPdfUrl(url);

        // Store dynamic height if returned (for thermal printers)
        if (response.height) {
          console.log(`Received dynamic PDF height: ${response.height} points`);
          setPdfHeight(response.height);
        }

        // Convert to base64 for print handler
        // Assuming response.data is an ArrayBuffer/Buffer. 
        // We can convert Blob to base64 or Buffer to base64.
        // salesOrderService.generatePDF returns { data: ArrayBuffer ... } usually.
        // Let's create a reader to be safe/consistent with browser APIs
        const reader = new FileReader();
        reader.readAsDataURL(blob);
        reader.onloadend = () => {
          const base64data = reader.result.split(',')[1];
          setPdfBase64(base64data);
        }

      } else {
        toast.error(t('sales.messages.pdfGenerateFailed'));
      }
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast.error(t('sales.messages.pdfError'));
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const columns = [
    {
      key: 'sno',
      label: t('purchases.paymentRecords.columns.sNo'),
      width: '80px',
      sortable: false
    },
    {
      key: 'order_date',
      label: t('sales.orderDate'),
      sortable: true,
      render: (value) => new Date(value).toLocaleDateString('en-IN')
    },
    {
      key: 'order_number',
      label: t('sales.orderNumber'),
      sortable: true,
      render: (value) => <span className="font-medium text-blue-600">{value}</span>
    },
    {
      key: 'customer_name',
      label: t('sales.customerName'),
      sortable: true,
      render: (value, row) => (
        <div>
          <div className="font-medium text-gray-900">{value}</div>
          <div className="text-xs text-gray-500">{row.customer_phone}</div>
        </div>
      )
    },
    {
      key: 'grand_total',
      label: t('sales.totalAmount'),
      sortable: true,
      render: (value) => <span className="font-bold">₹{parseFloat(value).toFixed(2)}</span>
    },
    {
      key: 'status',
      label: t('sales.paymentTracking.columns.orderStatus'),
      sortable: true,
      render: (value) => {
        const statusStyles = {
          completed: 'bg-green-100 text-green-800',
          pending: 'bg-yellow-100 text-yellow-800',
          cancelled: 'bg-red-100 text-red-800',
          returned: 'bg-orange-100 text-orange-800',
          draft: 'bg-gray-100 text-gray-800'
        };
        return (
          <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusStyles[value.toLowerCase()] || 'bg-gray-100 text-gray-800'}`}>
            {t(`purchases.paymentRecords.status.${value.toLowerCase()}`) || value}
          </span>
        );
      }
    },
    {
      key: 'payment_status',
      label: t('sales.paymentTracking.columns.paymentStatus'),
      sortable: true,
      render: (value) => {
        const statusStyles = {
          pending: 'bg-yellow-100 text-yellow-800',
          partial: 'bg-blue-100 text-blue-800',
          paid: 'bg-green-100 text-green-800',
          refunded: 'bg-orange-100 text-orange-800'
        };
        return (
          <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusStyles[value?.toLowerCase()] || 'bg-gray-100 text-gray-800'}`}>
            {t(`sales.paymentTracking.status.${value?.toLowerCase()}`) || value}
          </span>
        );
      }
    },
    {
      key: 'actions',
      label: t('purchases.paymentRecords.columns.actions'),
      width: '180px',
      sortable: false,
      render: (_, row) => (
        <div className="flex items-center space-x-1">
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleViewClick(row);
            }}
            className="p-1 px-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
            title={t('common.view')}
          >
            <Eye className="w-4 h-4" />
          </button>

          <button
            onClick={(e) => {
              e.stopPropagation();
              handlePrintClick(row);
            }}
            className="p-1 px-1.5 text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
            title={t('sales.actions.print')}
          >
            <Printer className="w-4 h-4" />
          </button>

          {row.status.toLowerCase() !== 'cancelled' && row.status.toLowerCase() !== 'returned' && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleEditOrder(row);
              }}
              className="p-1 px-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
              title={t('sales.actions.viewEdit')}
            >
              <Edit className="w-4 h-4" />
            </button>
          )}

          {(row.status.toLowerCase() === 'completed' || row.status.toLowerCase() === 'pending') && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleReturnClick(row);
              }}
              className="p-1 px-1.5 text-orange-600 hover:bg-orange-50 rounded-lg transition-colors"
              title={t('sales.actions.return')}
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          )}

          {row.status.toLowerCase() !== 'cancelled' && row.status.toLowerCase() !== 'returned' && row.status.toLowerCase() !== 'draft' && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleCancelClick(row);
              }}
              className="p-1 px-1.5 text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
              title={t('sales.actions.cancel')}
            >
              <XCircle className="w-4 h-4" />
            </button>
          )}

          <button
            onClick={(e) => {
              e.stopPropagation();
              handleDeleteClick(row);
            }}
            className="p-1 px-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            title={t('sales.actions.delete')}
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      )
    }
  ];

  return (
    <div className="p-6 bg-gray-50 min-h-full flex flex-col">
      <div className="max-w-7xl mx-auto w-full flex-1 flex flex-col">
        {/* Header */}
        <div className="mb-8">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{t('sales.salesOrders')}</h1>
              <p className="mt-1 text-sm text-gray-500">
                {t('sales.manageOrders')}
              </p>
            </div>
            <button
              onClick={handleAddOrder}
              className="inline-flex items-center px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              <Plus className="w-4 h-4 mr-2" />
              {t('sales.createOrder')}
            </button>
          </div>
        </div>

        {/* DataTable */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex-1 flex flex-col">
          <DataTable
            data={data}
            columns={columns}
            totalRecords={totalRecords}
            loading={loading}
            onFilterChange={(newFilters) => {
              fetchData({ ...filters, ...newFilters });
            }}
            initialFilters={filters}
            onRowClick={handleRowClick}
            searchable={true}
            sortable={true}
            pagination={true}
            currentPage={filters.page}
            emptyMessage={
              <div className="py-12 text-center">
                <div className="text-gray-400 mb-2">{t('sales.noOrders')}</div>
                <button
                  onClick={handleAddOrder}
                  className="text-blue-600 hover:text-blue-800 font-medium text-sm"
                >
                  {t('sales.createFirstOrder')}
                </button>
              </div>
            }
            searchPlaceholder={t('sales.searchPlaceholder')}
          />
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      <AlertModal
        isVisible={deleteModal.isOpen}
        modeltitle={t('sales.deleteTitle')}
        message={t('sales.deleteMessage', { orderNumber: deleteModal.order?.order_number || '' })}
        onConfirm={handleConfirmDelete}
        onCancel={handleCancelDelete}
        loading={deleteModal.loading}
        buttonText={t('sales.actions.delete')}
      />

      {/* Cancel Confirmation Modal */}
      <AlertModal
        isVisible={cancelModal.isOpen}
        modeltitle={t('sales.cancelTitle')}
        message={t('sales.cancelMessage', { orderNumber: cancelModal.order?.order_number || '' })}
        onConfirm={handleConfirmCancel}
        onCancel={() => setCancelModal({ isOpen: false, order: null, loading: false })}
        loading={cancelModal.loading}
        buttonText={t('sales.actions.cancel')}
        variant="warning"
      />

      {/* Return Confirmation Modal */}
      <AlertModal
        isVisible={returnModal.isOpen}
        modeltitle={t('sales.returnTitle')}
        message={t('sales.returnMessage', { orderNumber: returnModal.order?.order_number || '' })}
        onConfirm={handleConfirmReturn}
        onCancel={() => setReturnModal({ isOpen: false, order: null, loading: false })}
        loading={returnModal.loading}
        buttonText={t('sales.actions.return')}
        variant="warning"
      />

      {/* New Print Preview Modal */}
      <PrintPreviewModal
        isOpen={printModal.isOpen}
        onClose={handleClosePrintModal}
        pdfUrl={pdfUrl}
        pdfBase64={pdfBase64}
        contentHeight={pdfHeight}
        title={`Print Invoice #${printModal.order?.order_number || ''}`}
      />

    </div>
  )
}

export default Index