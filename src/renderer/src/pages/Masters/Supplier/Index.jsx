import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { 
  Edit,
  Trash2,
  Plus,
  CheckCircle2,
  XCircle,
  Building2,
  Phone,
  Mail,
  Upload,
  Download
} from 'lucide-react';
import DataTable from '../../../components/DataTable';
import AddEditForm from './AddEditForm';
import { toast } from 'sonner';
import { supplierService } from '../../../services/api';
import AlertModal from '../../../components/AlertModal';

const Index = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [data, setData] = useState([]);
  const [totalRecords, setTotalRecords] = useState(0);
  const [loading, setLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState(null);
  const [deleteModal, setDeleteModal] = useState({
    isOpen: false,
    supplier: null,
    loading: false
  });
  const [filters, setFilters] = useState({
    search: '',
    sortBy: 'id',
    sortOrder: 'desc',
    page: 1,
    limit: 10
  });

  const fetchData = async (newFilters = {}) => {
    try {
      setLoading(true);
      
      const updatedFilters = { ...filters, ...newFilters };
      
      const apiFilters = {
        searchTerm: updatedFilters.search || '',
        sortKey: updatedFilters.sortBy === 'sno' ? 'id' : updatedFilters.sortBy,
        sortDirection: updatedFilters.sortOrder === 'desc' ? 'DESC' : 'ASC',
        page: updatedFilters.page || 1,
        limit: updatedFilters.limit || 10
      };

      const response = await supplierService.getSuppliers(apiFilters);
      
      if (response.success) {
        setData(response.data || []);
        setTotalRecords(response.total || 0);
        
        setFilters(prev => ({
          ...prev,
          ...updatedFilters,
          page: parseInt(updatedFilters.page, 10) || 1
        }));
      } else {
        toast.error(response.message || t('suppliers.failedToLoad'));
      }
    } catch (error) {
      console.error('Error fetching suppliers:', error);
      toast.error(t('suppliers.failedToLoad'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleDeleteClick = (supplier) => {
    setDeleteModal({
      isOpen: true,
      supplier,
      loading: false
    });
  };

  const handleConfirmDelete = async () => {
    if (!deleteModal.supplier) return;
    
    try {
      setDeleteModal(prev => ({ ...prev, loading: true }));
      
      const response = await supplierService.deleteSupplier(deleteModal.supplier.id);
      
      if (response && response.success) {
        toast.success(response.message || t('suppliers.deleteSuccess'));
        fetchData();
      } else {
        throw new Error(response?.message || t('suppliers.failedToSave'));
      }
    } catch (error) {
      console.error('Error deleting supplier:', error);
      toast.error(error.message || t('suppliers.failedToSave'));
    } finally {
      setDeleteModal({ isOpen: false, supplier: null, loading: false });
    }
  };

  const handleCancelDelete = () => {
    setDeleteModal({ isOpen: false, supplier: null, loading: false });
  };

  const columns = [
    { 
      key: 'sno',
      label: '#',
      width: '60px',
      sortable: false
    },
    { 
      key: 'supplier_code', 
      label: t('suppliers.supplierCode'), 
      width: '100px',
      sortable: true,
      render: (value) => (
        <span className="text-sm font-mono text-gray-700">{value}</span>
      )
    },
    { 
      key: 'supplier_name', 
      label: t('suppliers.supplierName'), 
      sortable: true,
      render: (value, row) => (
        <div className="flex items-center gap-2">
          <Building2 className="w-4 h-4 text-blue-500" />
          <span className="font-medium text-gray-900">{value}</span>
        </div>
      )
    },
    { 
      key: 'contact_person', 
      label: t('suppliers.contactPerson'), 
      sortable: true,
      render: (value) => (
        <span className="text-sm text-gray-600">{value || '-'}</span>
      )
    },
    { 
      key: 'phone', 
      label: t('common.phone'), 
      sortable: false,
      render: (value) => (
        <div className="flex items-center gap-1.5 text-sm text-gray-600">
          <Phone className="w-3.5 h-3.5" />
          {value}
        </div>
      )
    },
    { 
      key: 'email', 
      label: t('suppliers.email'), 
      sortable: false,
      render: (value) => {
        if (!value) return <span className="text-sm text-gray-400">-</span>;
        return (
          <div className="flex items-center gap-1.5 text-sm text-gray-600">
            <Mail className="w-3.5 h-3.5" />
            {value}
          </div>
        );
      }
    },
    { 
      key: 'city', 
      label: t('suppliers.city'), 
      sortable: true,
      render: (value) => (
        <span className="text-sm text-gray-600">{value}</span>
      )
    },
    { 
      key: 'status', 
      label: t('common.status'),
      sortable: true,
      width: '100px',
      render: (value) => (
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
      width: '100px',
      sortable: false,
      render: (_, row) => (
        <div className="flex items-center space-x-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleEditSupplier(row);
            }}
            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-full transition-colors"
            title={t('common.edit')}
          >
            <Edit className="w-4 h-4" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleDeleteClick(row);
            }}
            className="p-1.5 text-red-600 hover:bg-red-50 rounded-full transition-colors"
            title={t('common.delete')}
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      )
    }
  ];

  const handleEditSupplier = async (supplier) => {
    try {
      setLoading(true);
      setEditingSupplier(supplier);
      setIsModalOpen(true);     
    } catch (error) {
      console.error('Error fetching supplier:', error);
      toast.error(t('suppliers.failedToLoad'));
    } finally {
      setLoading(false);
    }
  };

  const handleAddSupplier = () => {
    setEditingSupplier(null);
    setIsModalOpen(true);
  };

  const handleRowClick = (row) => {
    console.log('Row clicked:', row);
  };

  return (
    <div className="p-6 bg-gray-50">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                <Building2 className="w-7 h-7 text-blue-600" />
                {t('suppliers.supplierManagement')}
              </h1>
              <p className="mt-1 text-sm text-gray-500">
                {t('suppliers.manageDescription')}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => navigate('/suppliers/import')}
                className="inline-flex items-center px-4 py-2.5 bg-white hover:bg-gray-50 text-gray-700 text-sm font-medium rounded-lg shadow-sm border border-gray-300 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                <Upload className="w-4 h-4 mr-2" />
                {t('common.import')}
              </button>
              <button
                onClick={handleAddSupplier}
                className="inline-flex items-center px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                <Plus className="w-4 h-4 mr-2" />
                {t('suppliers.addSupplier')}
              </button>
            </div>
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
                <Building2 className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <div className="text-gray-400 mb-2">{t('suppliers.noSuppliersFound')}</div>
                <button
                  onClick={handleAddSupplier}
                  className="text-blue-600 hover:text-blue-800 font-medium text-sm"
                >
                  {t('suppliers.createFirstSupplier')}
                </button>
              </div>
            }
            searchPlaceholder={t('suppliers.searchPlaceholder')}
          />
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      <AlertModal
        isVisible={deleteModal.isOpen}
        modeltitle={t('suppliers.deleteSupplier')}
        message={`${t('suppliers.deleteConfirmMessage')} "${deleteModal.supplier?.supplier_name || t('suppliers.thisSupplier')}"?`}
        onConfirm={handleConfirmDelete}
        onCancel={handleCancelDelete}
        loading={deleteModal.loading}
        buttonText="Delete"
      />

      {/* Add/Edit Supplier Modal */}
      <AddEditForm
        editMode={!!editingSupplier}
        supplierModal={isModalOpen}
        setSupplierModal={setIsModalOpen}
        supplierId={editingSupplier?.id}
        fetchData={fetchData}
      />
    </div>
  );
};

export default Index;