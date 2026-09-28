import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { 
  Plus, 
  Edit, 
  Trash2, 
  Search, 
  Filter, 
  Calendar,
  CheckCircle2,
  XCircle,
  Download
} from 'lucide-react';
import { toast } from 'sonner';
import DataTable from '../../components/DataTable';
import AlertModal from '../../components/AlertModal';
import { Input, Select } from '../../components/Form';
import { expenseRecordService, expenseService } from '../../services/api';

const Index = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [data, setData] = useState([]);
  const [totalRecords, setTotalRecords] = useState(0);
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [filters, setFilters] = useState({
    search: '',
    startDate: '',
    endDate: '',
    categoryId: '',
    sortBy: 'expense_date',
    sortOrder: 'desc',
    page: 1,
    limit: 10
  });

  const [deleteModal, setDeleteModal] = useState({
    isOpen: false,
    expense: null,
    loading: false
  });

  // Fetch Categories for Filter
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const response = await expenseService.getExpenses({ limit: 1000, status: 'active' });
        if (response.success) {
          setCategories(response.data.map(cat => ({
            value: cat.id,
            label: cat.name
          })));
        }
      } catch (error) {
        console.error('Error fetching categories:', error);
      }
    };
    fetchCategories();
  }, []);

  const fetchData = async (newFilters = {}) => {
    setLoading(true);
    try {
      const updatedFilters = { ...filters, ...newFilters };
      
      const apiFilters = {
        searchTerm: updatedFilters.search,
        startDate: updatedFilters.startDate,
        endDate: updatedFilters.endDate,
        categoryId: updatedFilters.categoryId,
        sortKey: updatedFilters.sortBy === 'sno' ? 'expense_date' : updatedFilters.sortBy,
        sortDirection: updatedFilters.sortOrder === 'asc' ? 'ASC' : 'DESC',
        page: updatedFilters.page,
        limit: updatedFilters.limit
      };

      const response = await expenseRecordService.getExpenseRecords(apiFilters);
      
      if (response.success) {
        setData(response.data);
        setTotalRecords(response.total);
        setFilters(updatedFilters);
      }
    } catch (error) {
      console.error('Error fetching expenses:', error);
      toast.error(t('expenses.records.messages.loadFailed'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Debounce Search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchTerm !== filters.search) {
        fetchData({ search: searchTerm, page: 1 });
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [searchTerm]);

  const handleSearch = (value) => {
    setSearchTerm(value);
  };

  const handleFilterChange = (key, value) => {
    fetchData({ [key]: value, page: 1 });
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
    
    setDeleteModal(prev => ({ ...prev, loading: true }));
    try {
      const response = await expenseRecordService.deleteExpenseRecord(deleteModal.expense.id);
      if (response.success) {
        toast.success(t('expenses.records.messages.deleteSuccess'));
        fetchData();
      } else {
        toast.error(response.message || t('expenses.records.messages.deleteFailed'));
      }
    } catch (error) {
      console.error('Error deleting expense:', error);
      toast.error(t('expenses.records.messages.deleteFailed'));
    } finally {
      setDeleteModal({ isOpen: false, expense: null, loading: false });
    }
  };

  const columns = [
    { key: 'sno', label: t('expenses.records.columns.hash'), width: '60px', sortable: false },
    { 
      key: 'expense_date', 
      label: t('expenses.records.columns.date'), 
      sortable: true,
      render: (value) => new Date(value).toLocaleDateString('en-IN', {
        day: '2-digit', month: 'short', year: 'numeric'
      })
    },
    { key: 'expense_number', label: t('expenses.records.columns.expenseNo'), sortable: true },
    { key: 'category_name', label: t('expenses.records.columns.category'), sortable: false },
    { 
      key: 'amount', 
      label: t('expenses.records.columns.amount'), 
      sortable: true,
      render: (value) => (
        <span className="font-medium text-gray-900">
          ₹{parseFloat(value).toFixed(2)}
        </span>
      )
    },
    { key: 'payment_mode', label: t('expenses.records.columns.paymentMode'), sortable: true },
    { key: 'paid_by', label: t('expenses.records.columns.paidBy'), sortable: true },
    { 
      key: 'status', 
      label: t('expenses.records.columns.status'), 
      sortable: true,
      render: (value) => (
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
          value === 'Active' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
        }`}>
          {value === 'Active' ? <CheckCircle2 className="w-3 h-3 mr-1" /> : <XCircle className="w-3 h-3 mr-1" />}
          {value === 'Active' ? t('expenses.records.status.active') : t('expenses.records.status.cancelled')}
        </span>
      )
    },
    {
      key: 'actions',
      label: t('expenses.records.columns.actions'),
      width: '100px',
      sortable: false,
      render: (_, row) => (
        <div className="flex items-center gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/expense-management/edit/${row.id}`);
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

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{t('expenses.records.title')}</h1>
            <p className="text-sm text-gray-500 mt-1">{t('expenses.records.subtitle')}</p>
          </div>
          <button
            onClick={() => navigate('/expense-management/new')}
            className="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4 mr-2" />
            {t('expenses.records.addExpense')}
          </button>
        </div>

        {/* Filters */}
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder={t('expenses.records.filters.searchPlaceholder')}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                value={searchTerm}
                onChange={(e) => handleSearch(e.target.value)}
              />
            </div>
            
            <select
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white"
              value={filters.categoryId}
              onChange={(e) => handleFilterChange('categoryId', e.target.value)}
            >
              <option value="">{t('expenses.records.filters.allCategories')}</option>
              {categories.map(cat => (
                <option key={cat.value} value={cat.value}>{cat.label}</option>
              ))}
            </select>

            <input
              type="date"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              value={filters.startDate}
              onChange={(e) => handleFilterChange('startDate', e.target.value)}
              placeholder="Start Date"
            />

            <input
              type="date"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              value={filters.endDate}
              onChange={(e) => handleFilterChange('endDate', e.target.value)}
              placeholder="End Date"
            />
          </div>
        </div>

        {/* Data Table */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <DataTable
            data={data}
            columns={columns}
            totalRecords={totalRecords}
            loading={loading}
            onFilterChange={(newFilters) => fetchData(newFilters)}
            initialFilters={filters}
            searchable={false} // We have custom search
            sortable={true}
            pagination={true}
            currentPage={filters.page}
            emptyMessage={
              <div className="py-12 text-center">
                <div className="text-gray-400 mb-2">{t('expenses.records.empty.noExpenses')}</div>
                <button
                  onClick={() => navigate('/expense-management/new')}
                  className="text-blue-600 hover:text-blue-800 font-medium text-sm"
                >
                  {t('expenses.records.empty.createFirst')}
                </button>
              </div>
            }
          />
        </div>
      </div>

      <AlertModal
        isVisible={deleteModal.isOpen}
        modeltitle={t('expenses.records.deleteModal.title')}
        message={`${t('expenses.records.deleteModal.message')} "${deleteModal.expense?.expense_number}"?`}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteModal({ isOpen: false, expense: null, loading: false })}
        loading={deleteModal.loading}
        buttonText={t('common.delete')}
      />
    </div>
  );
};

export default Index;