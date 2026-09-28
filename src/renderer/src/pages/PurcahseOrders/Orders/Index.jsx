import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Edit,
  Trash2,
  Plus,
  Loader2,
  CheckCircle2,
  XCircle,
  Eye,
  FileText
} from 'lucide-react';
import DataTable from '../../../components/DataTable';
import { toast } from 'sonner';
import AlertModal from '../../../components/AlertModal';
import purchaseOrderService from '../../../services/purchaseOrderService';

const Index = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [data, setData] = useState([]);
  const [totalRecords, setTotalRecords] = useState(0);
  const [loading, setLoading] = useState(false);
  const [deleteModal, setDeleteModal] = useState({
    isOpen: false,
    order: null,
    loading: false
  });
  const [filters, setFilters] = useState({
    search: '',
    sortBy: 'poDate',
    sortOrder: 'desc',
    page: 1,
    limit: 10
  });

  // Map column keys to database field names
  const mapSortKeyToDbField = (key) => {
    const mapping = {
      'poNumber': 'po_number',
      'poDate': 'po_date',
      'supplierName': 'supplier_name',
      'deliveryDate': 'delivery_date',
      'totalAmount': 'net_payable',
      'status': 'status'
    };
    return mapping[key] || key;
  };

  const fetchData = async (newFilters = {}) => {
    try {
      setLoading(true);

      // Merge new filters with existing filters
      const updatedFilters = { ...filters, ...newFilters };

      // Map sortBy to database field name
      const dbSortKey = mapSortKeyToDbField(updatedFilters.sortBy || 'poDate');

      // Prepare API params
      const apiParams = {
        searchTerm: updatedFilters.search || '',
        sortKey: dbSortKey,
        sortDirection: updatedFilters.sortOrder?.toUpperCase() || 'DESC',
        page: parseInt(updatedFilters.page, 10) || 1,
        limit: parseInt(updatedFilters.limit, 10) || 10
      };

      // Call API
      const response = await purchaseOrderService.getAll(apiParams);

      if (response.success) {
        // Format data for display
        const formattedData = response.data.map((order, index) => ({
          id: order.id,
          sno: (apiParams.page - 1) * apiParams.limit + index + 1,
          poNumber: order.po_number,
          poDate: order.po_date,
          supplierName: order.supplier_name,
          deliveryDate: order.delivery_date,
          totalAmount: order.net_payable || 0,
          status: order.status
        }));

        setData(formattedData);
        setTotalRecords(response.total);
        setFilters(prev => ({
          ...prev,
          ...updatedFilters,
          page: response.page
        }));
      } else {
        toast.error(response.message || t('purchases.failedToLoad'));
      }

      setLoading(false);
    } catch (error) {
      console.error('Error fetching purchase orders:', error);
      toast.error(t('purchases.failedToLoad'));
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleEditOrder = async (order) => {
    navigate(`/purchases/edit/${order.id}`);
  };

  const handleViewOrder = async (order) => {
    navigate(`/purchases/view/${order.id}`);
  };

  const handleAddOrder = () => {
    navigate('/purchases/new');
  };

  const handleRowClick = (row) => {
    console.log('Row clicked:', row);
  };

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

      // Call delete API
      const response = await purchaseOrderService.delete(deleteModal.order.id);

      if (response.success) {
        toast.success(t('purchases.deleteSuccess'));
        fetchData(); // Refresh the list
        setDeleteModal({ isOpen: false, order: null, loading: false });
      } else {
        toast.error(response.message || t('purchases.failedToDelete'));
        setDeleteModal(prev => ({ ...prev, loading: false }));
      }

    } catch (error) {
      console.error('Error deleting order:', error);
      toast.error(error.message || t('purchases.failedToDelete'));
      setDeleteModal(prev => ({ ...prev, loading: false }));
    }
  };

  const handleCancelDelete = () => {
    setDeleteModal({ isOpen: false, order: null, loading: false });
  };

  const columns = [
    {
      key: 'sno',
      label: '#',
      width: '80px',
      sortable: false
    },
    {
      key: 'poNumber',
      label: t('purchases.poNumber'),
      sortable: true
    },
    {
      key: 'poDate',
      label: t('purchases.poDate'),
      sortable: true,
      render: (value) => new Date(value).toLocaleDateString('en-IN')
    },
    {
      key: 'supplierName',
      label: t('purchases.supplierName'),
      sortable: true
    },
    {
      key: 'deliveryDate',
      label: t('purchases.expectedDeliveryDate'),
      sortable: true,
      render: (value) => new Date(value).toLocaleDateString('en-IN')
    },
    {
      key: 'totalAmount',
      label: t('purchases.totalAmount'),
      sortable: true,
      render: (value) => `₹${value.toLocaleString('en-IN')}`
    },
    {
      key: 'status',
      label: t('common.status'),
      sortable: true,
      render: (value) => (
        <div className="flex items-center">
          {value === 'Completed' ? (
            <>
              <CheckCircle2 className="w-4 h-4 text-green-500 mr-1.5" />
              <span className="text-sm font-medium text-green-700">{t('common.completed')}</span>
            </>
          ) : value === 'Draft' ? (
            <>
              <FileText className="w-4 h-4 text-gray-500 mr-1.5" />
              <span className="text-sm font-medium text-gray-700">{t('common.draft')}</span>
            </>
          ) : value === 'Pending' ? (
            <>
              <Loader2 className="w-4 h-4 text-yellow-500 mr-1.5" />
              <span className="text-sm font-medium text-yellow-700">{t('common.pending')}</span>
            </>
          ) : (
            <>
              <XCircle className="w-4 h-4 text-red-500 mr-1.5" />
              <span className="text-sm font-medium text-red-700">{t('common.cancelled')}</span>
            </>
          )}
        </div>
      )
    },
    {
      key: 'actions',
      label: t('common.actions'),
      width: '120px',
      sortable: false,
      render: (_, row) => (
        <div className="flex items-center space-x-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleViewOrder(row);
            }}
            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-full transition-colors"
            title="View"
          >
            <Eye className="w-4 h-4" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleEditOrder(row);
            }}
            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-full transition-colors"
            title="Edit"
          >
            <Edit className="w-4 h-4" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleDeleteClick(row);
            }}
            className="p-1.5 text-red-600 hover:bg-red-50 rounded-full transition-colors"
            title="Delete"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      )
    }
  ];

  return (
    <div className="p-6 bg-gray-50">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{t('purchases.purchaseOrders')}</h1>
              <p className="mt-1 text-sm text-gray-500">
                {t('purchases.manageDescription')}
              </p>
            </div>
            <button
              onClick={handleAddOrder}
              className="inline-flex items-center px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              <Plus className="w-4 h-4 mr-2" />
              {t('purchases.createPurchaseOrder')}
            </button>
          </div>
        </div>

        {/* DataTable */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
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
                <div className="text-gray-400 mb-2">{t('purchases.noOrdersFound')}</div>
                <button
                  onClick={handleAddOrder}
                  className="text-blue-600 hover:text-blue-800 font-medium text-sm"
                >
                  {t('purchases.createFirstOrder')}
                </button>
              </div>
            }
            searchPlaceholder={t('purchases.searchPlaceholder')}
          />
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      <AlertModal
        isVisible={deleteModal.isOpen}
        modeltitle={t('purchases.deleteOrder')}
        message={`${t('purchases.deleteConfirmMessage')} "${deleteModal.order?.poNumber || t('purchases.thisOrder')}"?`}
        onConfirm={handleConfirmDelete}
        onCancel={handleCancelDelete}
        loading={deleteModal.loading}
        buttonText={t('common.delete')}
      />
    </div>
  );
};

export default Index;
