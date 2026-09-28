import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { Plus, Trash2, Calendar } from 'lucide-react';
import { Link } from 'react-router-dom';
import DataTable from '../../components/DataTable';
import AlertModal from '../../components/AlertModal';

const WastageIndex = () => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState([]);
  const [totalRecords, setTotalRecords] = useState(0);
  const [filters, setFilters] = useState({
    startDate: format(new Date(), 'yyyy-MM-dd'),
    endDate: format(new Date(), 'yyyy-MM-dd'),
    search: '',
    sortBy: 'created_at',
    sortOrder: 'desc',
    page: 1,
    limit: 10
  });

  const [deleteModal, setDeleteModal] = useState({
    isOpen: false,
    id: null,
    loading: false
  });

  const fetchWastage = async (newFilters = {}) => {
    setLoading(true);
    try {
      // Merge new filters with existing filters
      const updatedFilters = { ...filters, ...newFilters };
      
      // Prepare API filters - map DataTable standard filters to API expectation
      const apiFilters = {
        startDate: updatedFilters.startDate,
        endDate: updatedFilters.endDate,
        searchTerm: updatedFilters.search || '',
        sortKey: updatedFilters.sortBy,
        sortDirection: updatedFilters.sortOrder === 'desc' ? 'DESC' : 'ASC',
        page: updatedFilters.page || 1,
        pageSize: updatedFilters.limit || 10
      };

      const response = await window.api.invoke('wastage:get-all', apiFilters);
      
      if (response.success) {
        setData(response.data || []);
        setTotalRecords(response.pagination?.total || 0);
        
        // Update local filters state
        setFilters(prev => ({
          ...prev,
          ...updatedFilters
        }));
      } else {
        toast.error(t('wastage.toasts.fetchFailed'));
      }
    } catch (error) {
      console.error('Error fetching wastage:', error);
      toast.error(t('wastage.toasts.fetchError'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWastage();
  }, []); // Initial load

  const handleDateChange = (e) => {
    const { name, value } = e.target;
    // When date changes, reset to page 1 and fetch
    fetchWastage({ [name]: value, page: 1 });
  };

  const handleDeleteClick = (row) => {
    setDeleteModal({
      isOpen: true,
      id: row.id,
      loading: false
    });
  };

  const handleConfirmDelete = async () => {
    if (!deleteModal.id) return;
    
    try {
      setDeleteModal(prev => ({ ...prev, loading: true }));
      const response = await window.api.invoke('wastage:delete', deleteModal.id);
      
      if (response.success) {
        toast.success(t('wastage.toasts.deleteSuccess'));
        fetchWastage(); // Refresh list
      } else {
        toast.error(t('wastage.toasts.deleteFailed'));
      }
    } catch (error) {
       console.error('Error deleting wastage:', error);
       toast.error(t('wastage.toasts.deleteError'));
    } finally {
      setDeleteModal({ isOpen: false, id: null, loading: false });
    }
  };

  const columns = [
    {
      key: 'date',
      label: t('wastage.date'),
      sortable: true,
      render: (_, row) => (
        <span className="text-sm text-slate-600">
          {format(new Date(row.wastage_date || row.created_at), 'dd MMM yyyy')}
        </span>
      )
    },
    {
      key: 'product_name',
      label: t('wastage.product'),
      sortable: true,
      render: (value, row) => (
        <div>
          <div className="text-sm font-medium text-slate-800">{value}</div>
          <div className="text-xs text-slate-500">{row.product_code}</div>
        </div>
      )
    },
    {
      key: 'quantity',
      label: t('wastage.quantity'),
      sortable: true,
      className: 'text-right',
      render: (value) => (
        <span className="text-sm font-medium text-slate-800">{value}</span>
      )
    },
    {
      key: 'reason',
      label: t('wastage.reason'),
      sortable: false, // Usually reasons are not sorted, but can be enabled if backend supports
      render: (value) => (
        <span className="text-sm text-slate-600">{value}</span>
      )
    },
    {
      key: 'created_by',
      label: t('wastage.createdBy'),
      sortable: false,
      render: (value) => (
        <span className="text-sm text-slate-500">{value || '-'}</span>
      )
    },
    {
      key: 'actions',
      label: t('common.actions'),
      width: '100px',
      sortable: false,
      render: (_, row) => (
        <div className="flex items-center justify-center">
          <button 
            onClick={(e) => {
              e.stopPropagation();
              handleDeleteClick(row);
            }}
            className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-full transition-colors"
            title={t('common.delete')}
          >
            <Trash2 size={16} />
          </button>
        </div>
      )
    }
  ];

  return (
    <div className="p-6 bg-slate-50 min-h-full">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-800 tracking-tight">
              {t('wastage.title')}
            </h1>
            <p className="text-slate-500 mt-1">
              {t('wastage.subtitle')}
            </p>
          </div>
          <Link 
            to="/wastage/new" 
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl font-medium transition-all shadow-sm hover:shadow-md active:scale-95"
          >
            <Plus size={18} />
            <span>{t('wastage.addWastage')}</span>
          </Link>
        </div>

         {/* Filters - Keeping Date Range outside DataTable as strict requirement */}
         <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-wrap gap-4 items-center">
          <div className="flex items-center gap-4">
              <div className='flex items-center gap-2'>
                  <Calendar size={18} className="text-slate-400" />
                  <span className="text-sm font-medium text-slate-600">{t('common.dateRanges.from') || 'From'}:</span>
                  <input 
                      type="date"
                      name="startDate"
                      value={filters.startDate}
                      onChange={handleDateChange}
                      className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                  />
              </div>
              <div className='flex items-center gap-2'>
                  <span className="text-sm font-medium text-slate-600">{t('common.dateRanges.to') || 'To'}:</span>
                  <input 
                      type="date"
                      name="endDate"
                      value={filters.endDate}
                      onChange={handleDateChange}
                      className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                  />
              </div>
          </div>
        </div>

        {/* DataTable */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <DataTable
            data={data}
            columns={columns}
            totalRecords={totalRecords}
            loading={loading}
            onFilterChange={(newFilters) => {
               // Update filters and fetch
               fetchWastage(newFilters);
            }}
            initialFilters={{
                search: filters.search,
                sortBy: filters.sortBy,
                sortOrder: filters.sortOrder,
                page: filters.page,
                limit: filters.limit
            }}
            searchable={true}
            sortable={true}
            pagination={true}
            currentPage={filters.page}
            emptyMessage={
              <div className="py-12 text-center text-slate-500">
                {t('wastage.noRecordsFound')}
              </div>
            }
            searchPlaceholder={t('wastage.searchPlaceholder')}
          />
        </div>
      </div>

      <AlertModal
        isVisible={deleteModal.isOpen}
        modeltitle={t('common.confirmDelete')}
        message={t('wastage.deleteConfirm')}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteModal({ isOpen: false, id: null, loading: false })}
        loading={deleteModal.loading}
        buttonText={t('common.delete')}
      />
    </div>
  );
};

export default WastageIndex;
