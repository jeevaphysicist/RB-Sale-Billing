import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Users, Plus, Edit, Trash2, CheckCircle2, XCircle, Upload } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import DataTable from '../../../components/DataTable';
import { toast } from 'sonner';
import AddEditForm from './AddEditForm';
import AlertModal from '../../../components/AlertModal';
import { customerService } from '../../../services/customerService';

const Index = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [customers, setCustomers] = useState([]);
  const [totalRecords, setTotalRecords] = useState(0);
  const [loading, setLoading] = useState(false);
  const [customerModal, setCustomerModal] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [deleteModal, setDeleteModal] = useState({
    isOpen: false,
    customer: null,
    loading: false
  });
  const [filters, setFilters] = useState({
    search: '',
    sortBy: 'id',
    sortOrder: 'desc',
    page: 1,
    limit: 10
  });

  // Fetch customers
  const fetchCustomers = async (newFilters = {}) => {
    try {
      setLoading(true);

      // Merge new filters with existing filters
      const updatedFilters = { ...filters, ...newFilters };

      // Prepare API filters
      const apiFilters = {
        searchTerm: updatedFilters.search || '',
        sortKey: updatedFilters.sortBy === 'sno' ? 'id' : updatedFilters.sortBy,
        sortDirection: updatedFilters.sortOrder === 'desc' ? 'DESC' : 'ASC',
        page: updatedFilters.page || 1,
        limit: updatedFilters.limit || 10
      };

      console.log('Fetching with filters:', apiFilters);

      const response = await customerService.getCustomers(apiFilters);

      if (response.success) {
        setCustomers(response.data || []);
        setTotalRecords(response.total || 0);

        // Update filters state with the new values
        setFilters(prev => ({
          ...prev,
          ...updatedFilters,
          page: parseInt(updatedFilters.page, 10) || 1
        }));
      } else {
        toast.error(response.message || t('customers.failedToLoad'));
      }
    } catch (error) {
      console.error('Error fetching customers:', error);
      toast.error(t('customers.failedToLoad'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomers();
  }, []);

  // Handle add customer
  const handleAdd = () => {
    setEditingCustomer(null);
    setCustomerModal(true);
  };

  // Handle edit customer
  const handleEdit = (customer) => {
    setEditingCustomer(customer);
    setCustomerModal(true);
  };

  // Handle delete customer
  const handleDeleteClick = (customer) => {
    setDeleteModal({
      isOpen: true,
      customer,
      loading: false
    });
  };

  const handleConfirmDelete = async () => {
    if (!deleteModal.customer) return;

    try {
      setDeleteModal(prev => ({ ...prev, loading: true }));

      const response = await customerService.deleteCustomer(deleteModal.customer.id);

      if (response && response.success) {
        toast.success(response.message || t('customers.deleteSuccess'));
        fetchCustomers();
      } else {
        throw new Error(response?.message || t('customers.failedToSave'));
      }
    } catch (error) {
      console.error('Error deleting customer:', error);
      toast.error(error.message || t('customers.failedToSave'));
    } finally {
      setDeleteModal({ isOpen: false, customer: null, loading: false });
    }
  };

  const handleCancelDelete = () => {
    setDeleteModal({ isOpen: false, customer: null, loading: false });
  };

  // Handle form success
  const handleFormSuccess = () => {
    setCustomerModal(false);
    setEditingCustomer(null);
    fetchCustomers();
  };

  // Table columns
  const columns = [
    {
      key: 'sno',
      label: t('common.sNo'),
      sortable: false,
      width: '60px'
    },
    {
      key: 'customer_code',
      label: t('customers.customerCode'),
      sortable: true,
      render: (value) => (
        <span className="text-sm text-gray-600">{value || '-'}</span>
      )
    },
    {
      key: 'customer_name',
      label: t('customers.customerName'),
      sortable: true,
      render: (value) => (
        <span className="text-sm text-gray-600">{value || '-'}</span>
      )
    },

    {
      key: 'mobile_number',
      label: t('customers.mobileNumber'),
      sortable: true,
      render: (value) => (
        <span className="text-sm text-gray-600">{value || '-'}</span>
      )
    },
    {
      key: 'email',
      label: t('customers.email'),
      sortable: true,
      render: (value) => (
        <span className="text-sm text-gray-600">{value || '-'}</span>
      )
    },
    {
      key: 'city',
      label: t('customers.city'),
      sortable: true,
      render: (value) => (
        <span className="text-sm text-gray-600">{value || '-'}</span>
      )
    },
    {
      key: 'customer_type',
      label: t('products.type'),
      sortable: true,
      render: (value) => (
        <span className="text-sm text-gray-600">{value || '-'}</span>
      )
    },
    {
      key: 'customer_status',
      label: t('common.status'),
      sortable: true,
      render: (value, row) => (
        <div className="flex items-center">
          {value === 'Active' ? (
            <>
              <CheckCircle2 className="w-4 h-4 text-green-500 mr-1.5" />
              <span className="text-sm font-medium text-green-700">{t('common.active')}</span>
            </>
          ) : (
            <>
              <XCircle className="w-4 h-4 text-red-500 mr-1.5" />
              <span className="text-sm font-medium text-red-700">{t('common.inactive')}</span>
            </>
          )}
        </div>
      )
    },
    {
      key: 'actions',
      label: t('common.actions'),
      sortable: false,
      render: (value, row) => (
        <div className="flex gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleEdit(row);
            }}
            disabled={row.id === 0 || row.customer_code === 'WALK-IN'}
            className={`p-1.5 rounded transition-colors ${row.id === 0 || row.customer_code === 'WALK-IN'
                ? 'text-gray-400 cursor-not-allowed'
                : 'text-blue-600 hover:bg-blue-50'
              }`}
            title={row.id === 0 || row.customer_code === 'WALK-IN' ? t('customers.cannotEditWalkIn') : t('common.edit')}
          >
            <Edit size={16} />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleDeleteClick(row);
            }}
            disabled={row.id === 0 || row.customer_code === 'WALK-IN'}
            className={`p-1.5 rounded transition-colors ${row.id === 0 || row.customer_code === 'WALK-IN'
                ? 'text-gray-400 cursor-not-allowed'
                : 'text-red-600 hover:bg-red-50'
              }`}
            title={row.id === 0 || row.customer_code === 'WALK-IN' ? t('customers.cannotDeleteWalkIn') : t('common.delete')}
          >
            <Trash2 size={16} />
          </button>
        </div>
      )
    }
  ];

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Users className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-800">{t('customers.customerManagement')}</h1>
              <p className="text-sm text-gray-500">{t('customers.manageDescription')}</p>
            </div>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => navigate('/customers/import')}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <Upload size={20} />
              {t('common.import')}
            </button>
            <button
              onClick={handleAdd}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus size={20} />
              Add Customer
            </button>
          </div>
        </div>

      </div>

      {/* Data Table */}
      <DataTable
        data={customers}
        columns={columns}
        totalRecords={totalRecords}
        loading={loading}
        onFilterChange={(newFilters) => {
          fetchCustomers({ ...filters, ...newFilters });
        }}
        initialFilters={filters}
        searchable={true}
        sortable={true}
        pagination={true}
        currentPage={filters.page}
        emptyMessage={
          <div className="py-12 text-center">
            <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">{t('customers.noCustomersFound')}</h3>
            <p className="text-gray-500 mb-4">{t('customers.createFirstCustomer')}</p>
            <button
              onClick={handleAdd}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus size={20} />
              {t('customers.addCustomer')}
            </button>
          </div>
        }
        searchPlaceholder={t('customers.searchPlaceholder')}
      />

      {/* Add/Edit Modal */}
      {customerModal && (
        <AddEditForm
          customerModal={customerModal}
          setCustomerModal={setCustomerModal}
          editingCustomer={editingCustomer}
          onSuccess={handleFormSuccess}
        />
      )}

      {/* Delete Confirmation Modal */}
      <AlertModal
        isVisible={deleteModal.isOpen}
        modeltitle={t('customers.deleteCustomer')}
        message={`${t('customers.deleteConfirmMessage')} "${deleteModal.customer?.customer_name || t('customers.thisCustomer')}"?`}
        onConfirm={handleConfirmDelete}
        onCancel={handleCancelDelete}
        loading={deleteModal.loading}
        buttonText="Delete"
      />
    </div>
  );
};

export default Index;