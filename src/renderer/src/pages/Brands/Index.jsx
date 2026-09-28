import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { 
  Edit,
  Trash2,
  Plus,
  Loader2,
  CheckCircle2,
  XCircle,
  Globe
} from 'lucide-react';
import DataTable from '../../components/DataTable';
import AddEditForm from './AddEditForm';
import { toast } from 'sonner';
import { brandService } from '../../services/brandService';
import AlertModal from '../../components/AlertModal';

const Index = () => {
  const { t } = useTranslation();
  const [data, setData] = useState([]);
  const [totalRecords, setTotalRecords] = useState(0);
  const [loading, setLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBrand, setEditingBrand] = useState(null);
  const [deleteModal, setDeleteModal] = useState({
    isOpen: false,
    brand: null,
    loading: false
  });
  const [filters, setFilters] = useState({
    search: '',
    sortBy: 'id',
    sortOrder: 'asc',
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

      const response = await brandService.getBrands(apiFilters);
      
      if (response.success) {
        setData(response.data || []);
        setTotalRecords(response.total || 0);
        
        setFilters(prev => ({
          ...prev,
          ...updatedFilters,
          page: parseInt(updatedFilters.page, 10) || 1
        }));
      } else {
        toast.error(response.message || t('brands.failedToLoad'));
      }
  } catch (error) {
    console.error('Error fetching brands:', error);
    toast.error(t('brands.failedToLoad'));
  } finally {
    setLoading(false);
  }
};

  useEffect(() => {
    fetchData();
  }, []);

  const handleDeleteClick = (brand) => {
    setDeleteModal({
      isOpen: true,
      brand,
      loading: false
    });
  };

  const handleConfirmDelete = async () => {
    if (!deleteModal.brand) return;
    
    try {
      setDeleteModal(prev => ({ ...prev, loading: true }));
      
      const response = await brandService.deleteBrand(deleteModal.brand.id);
      
      if (response && response.success) {
        toast.success(response.message || t('brands.deleteSuccess'));
        fetchData();
      } else {
        throw new Error(response?.message || t('brands.failedToSave'));
      }
    } catch (error) {
      console.error('Error deleting brand:', error);
      toast.error(error.message || t('brands.failedToSave'));
    } finally {
      setDeleteModal({ isOpen: false, brand: null, loading: false });
    }
  };

  const handleCancelDelete = () => {
    setDeleteModal({ isOpen: false, brand: null, loading: false });
  };

  const columns = [
    { 
    key: 'sno',
    label: '#',
    width: '80px',
    sortable: false
  },
    { 
      key: 'name', 
      label: t('brands.brandName'), 
      sortable: true 
    },
    {
      key: 'website',
      label: t('brands.website'),
      sortable: false,
      render: (value) => {
        if (!value) {
          return <span className="text-sm text-gray-500">-</span>;
        }

        const url = value.startsWith('http') ? value : `https://${value}`;
        return (
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center text-sm text-blue-600 hover:text-blue-800"
          >
            <Globe className="w-4 h-4 mr-1" />
            {value}
          </a>
        );
      }
    },
    { 
      key: 'description', 
      label: t('common.description'), 
      sortable: false,
      render: (value) => {
        if (!value) return <span className="text-sm text-gray-600">-</span>;
        const truncated = value.length > 60 ? `${value.substring(0, 60)}...` : value;
        return (
          <span className="text-sm text-gray-600 w-[200px] line-clamp-5" title={value}>
            {truncated}
          </span>
        );
      }
    },
    {
      key: 'status', 
      label: t('common.status'),
      sortable: true,
      render: (value) => (
        <div className="flex items-center">
          {value === 'active' ? (
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
      width: '120px',
      sortable: false,
      render: (_, row) => (
        <div className="flex items-center space-x-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleEditBrand(row);
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

  const handleEditBrand = async (brand) => {
    try {
        setLoading(true);
        setEditingBrand(brand);
        setIsModalOpen(true);     
    } catch (error) {
      console.error('Error fetching brand:', error);
      toast.error(t('brands.failedToLoad'));
    } finally {
      setLoading(false);
    }
  };

  const handleAddBrand = () => {
    setEditingBrand(null);
    setIsModalOpen(true);
  };

  const handleRowClick = (row) => {
    console.log('Row clicked:', row);
  };

  return (
    <div className="p-6 bg-gray-50">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{t('brands.brandManagement')}</h1>
              <p className="mt-1 text-sm text-gray-500">
                {t('brands.manageDescription')}
              </p>
            </div>
            <button
              onClick={handleAddBrand}
              className="inline-flex items-center px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              <Plus className="w-4 h-4 mr-2" />
              {t('brands.addBrand')}
            </button>
          </div>
        </div>

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
                <div className="text-gray-400 mb-2">{t('brands.noBrandsFound')}</div>
                <button
                  onClick={handleAddBrand}
                  className="text-blue-600 hover:text-blue-800 font-medium text-sm"
                >
                  {t('brands.createFirstBrand')}
                </button>
              </div>
            }
            searchPlaceholder={t('brands.searchPlaceholder')}
          />
        </div>
      </div>

      <AlertModal
        isVisible={deleteModal.isOpen}
        modeltitle={t('brands.deleteBrand')}
        message={`${t('brands.deleteConfirmMessage')} "${deleteModal.brand?.name || t('brands.thisBrand')}"?`}
        onConfirm={handleConfirmDelete}
        onCancel={handleCancelDelete}
        loading={deleteModal.loading}
        buttonText="Delete"
      />

      <AddEditForm
        editMode={!!editingBrand}
        brandModal={isModalOpen}
        setBrandModal={setIsModalOpen}
        brandId={editingBrand?.id}
        fetchData={fetchData}
      />
    </div>
  )
}

export default Index