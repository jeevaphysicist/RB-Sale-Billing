import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { 
  Eye,
  Edit,
  Trash2,
  Download,
  Plus,
  Loader2,
  CheckCircle2,
  XCircle
} from 'lucide-react';
import DataTable from '../../../components/DataTable';
import AddEditForm from './AddEditForm';
import { toast } from 'sonner';
import { getExpenses, deleteExpense } from '../../../services/api';
import AlertModal from '../../../components/AlertModal';


const Index = () => {
  const { t } = useTranslation();
  const [data, setData] = useState([]);
  const [totalRecords, setTotalRecords] = useState(0);
  const [loading, setLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState(null);
  const [deleteModal, setDeleteModal] = useState({
    isOpen: false,
    expense: null,
    loading: false
  });
  const [filters, setFilters] = useState({
    search: '',
    sortBy: 'id',
    sortOrder: 'asc',
    page: 1,
    limit: 10
  });

  // Update the fetchData function
  const fetchData = async (newFilters = {}) => {
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
      
      // Call the API with filters
      const response = await getExpenses(apiFilters);
      
      if (response.success) {
        // Update state with the API response
        setData(response.data || []);
        setTotalRecords(response.total || 0);
        
        // Update filters state with the new values
        setFilters(prev => ({
          ...prev,
          ...updatedFilters,
          page: parseInt(updatedFilters.page, 10) || 1
        }));
      } else {
        toast.error(response.message || 'Failed to load expenses');
      }
  } catch (error) {
    console.error('Error fetching expenses:', error);
    toast.error('Failed to load expenses');
  } finally {
    setLoading(false);
  }
};

  useEffect(() => {
    fetchData();
  }, []);

  const handleSearch = (searchTerm) => {
    fetchData({ 
      search: searchTerm,
      page: 1 // Reset to first page on search
    });
  };

  const handleSort = (sortBy, sortOrder) => {
    fetchData({ sortBy, sortOrder });
  };

  const handlePageChange = (page) => {
    fetchData({ page });
  };

  const handleLimitChange = (limit) => {
    fetchData({ 
      limit,
      page: 1 // Reset to first page when changing limit
    });
  };

  const handleEditExpense = async (expense) => {
    try {
        setLoading(true);
        setEditingExpense(expense);
        setIsModalOpen(true);     
    } catch (error) {
      console.error('Error fetching expense:', error);
      toast.error(t('expenses.failedToLoad'));
    } finally {
      setLoading(false);
    }
  };

  const handleAddExpense = () => {
    setEditingExpense(null);
    setIsModalOpen(true);
  };

  const handleRowClick = (row) => {
    // Handle row click if needed
    console.log('Row clicked:', row);
  };

  const handleView = (expense) => {
    // Implement view functionality
    console.log('View expense:', expense);
  };

  const handleDeleteClick = (expense) => {
    setDeleteModal({
      isOpen: true,
      expense,
      loading: false
    });
  };

  const handleConfirmDelete = async () => {
    if (!deleteModal.expense) return;
    
    try {
      setDeleteModal(prev => ({ ...prev, loading: true }));
      
      const response = await deleteExpense(deleteModal.expense.id);
      
      if (response && response.success) {
        toast.success(response.message || t('expenses.deleteSuccess'));
        fetchData();
      } else {
        throw new Error(response?.message || t('expenses.failedToDelete'));
      }
    } catch (error) {
      console.error('Error deleting expense:', error);
      toast.error(error.message || t('expenses.failedToDelete'));
    } finally {
      setDeleteModal({ isOpen: false, expense: null, loading: false });
    }
  };

  const handleCancelDelete = () => {
    setDeleteModal({ isOpen: false, expense: null, loading: false });
  };

  const handleExport = () => {
    // Implement export functionality
    console.log('Export data');
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
      label: t('expenses.expenseName'), 
      sortable: true 
    },
    { 
      key: 'description', 
      label: t('expenses.description'), 
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
              handleEditExpense(row);
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
              <h1 className="text-2xl font-bold text-gray-900">{t('expenses.expenseManagement')}</h1>
              <p className="mt-1 text-sm text-gray-500">
                {t('expenses.manageDescription')}
              </p>
            </div>
            <button
              onClick={handleAddExpense}
              className="inline-flex items-center px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              <Plus className="w-4 h-4 mr-2" />
              {t('expenses.addExpense')}
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
              // Reset to page 1 when filters change
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
                <div className="text-gray-400 mb-2">{t('expenses.noExpensesFound')}</div>
                <button
                  onClick={handleAddExpense}
                  className="text-blue-600 hover:text-blue-800 font-medium text-sm"
                >
                  {t('expenses.createFirstExpense')}
                </button>
              </div>
            }
            searchPlaceholder={t('expenses.searchPlaceholder')}
          />
        </div>
      </div>

      <AddEditForm
        editMode={!!editingExpense}
        expenseModal={isModalOpen}
        setExpenseModal={setIsModalOpen}
        expenseId={editingExpense?.id}
        fetchData={fetchData}
      />

      {/* Delete Confirmation Modal */}
      <AlertModal
        isVisible={deleteModal.isOpen}
        modeltitle={t('expenses.deleteExpense')}
        message={`${t('expenses.deleteConfirmMessage')} "${deleteModal.expense?.name || t('expenses.thisExpense')}"?`}
        onConfirm={handleConfirmDelete}
        onCancel={handleCancelDelete}
        loading={deleteModal.loading}
        buttonText={t('common.delete')}
      />
    </div>
  );
};

export default Index;