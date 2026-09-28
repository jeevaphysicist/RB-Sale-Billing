import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  BarChart, Bar, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import { 
  Package, DollarSign, AlertTriangle, AlertCircle, ShoppingBag, 
  Search, Filter, ArrowUp, ArrowDown, ChevronLeft, ChevronRight 
} from 'lucide-react';
import { toast } from 'sonner';

const StockReport = () => {
  const { t } = useTranslation();
  const [isLoading, setIsLoading] = useState(true);
  const [categories, setCategories] = useState([]);
  
  // Filters
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [stockStatusFilter, setStockStatusFilter] = useState('all'); // all, low, out, available
  const [searchTerm, setSearchTerm] = useState('');
  
  // Data
  const [summary, setSummary] = useState(null);
  const [categoryData, setCategoryData] = useState([]);
  const [stockList, setStockList] = useState([]);
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, totalPages: 0, limit: 10 });

  // Initial Data Load
  useEffect(() => {
    fetchInitialData();
  }, []);

  // Fetch data when filters change
  useEffect(() => {
    fetchStockList();
  }, [currentPage, selectedCategory, stockStatusFilter, searchTerm]);

  // Fetch Summary when category changes
  useEffect(() => {
    fetchSummary();
  }, [selectedCategory]);

  const fetchInitialData = async () => {
    setIsLoading(true);
    try {
      if (!window.api || !window.api.getCategories) {
        console.warn('API not ready');
        setIsLoading(false);
        return;
      }

      // Load Categories
      const catRes = await window.api.getCategories();
      if (catRes.success) setCategories(catRes.data);

      // Load Summary and Breakdown
      await Promise.all([
        fetchSummary(),
        fetchCategoryBreakdown(),
        fetchStockList()
      ]);

    } catch (error) {
      console.error('Error initializing report:', error);
      toast.error('Failed to load report data');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchSummary = async () => {
    try {
      const res = await window.api.getStockSummary({ categoryId: selectedCategory });
      if (res.success) setSummary(res.data);
    } catch (error) {
      console.error('Error fetching summary:', error);
    }
  };

  const fetchCategoryBreakdown = async () => {
    try {
      const res = await window.api.getStockCategoryBreakdown();
      if (res.success) {
        // limit to top 10 categories by value for chart clarity
        const sorted = res.data.sort((a, b) => b.stock_value - a.stock_value).slice(0, 10);
        setCategoryData(sorted);
      }
    } catch (error) {
      console.error('Error fetching breakdown:', error);
    }
  };

  const fetchStockList = async () => {
    try {
      const res = await window.api.getStockList({
        page: currentPage,
        limit: 10,
        searchTerm,
        categoryId: selectedCategory,
        stockStatus: stockStatusFilter
      });
      
      if (res.success) {
        setStockList(res.data);
        setPagination(res.pagination);
      }
    } catch (error) {
      console.error('Error fetching stock list:', error);
    }
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value || 0);
  };

  if (isLoading && !summary) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="mt-4 text-gray-600">{t('stockReport.loading')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">{t('stockReport.title')}</h1>
          <p className="text-sm text-gray-600">{t('stockReport.subtitle')}</p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Stock Value */}
        <div className="bg-white p-5 rounded-lg shadow-sm border-l-4 border-blue-500">
           <div className="flex justify-between items-start">
            <div>
              <p className="text-gray-500 text-xs uppercase font-medium tracking-wider">{t('stockReport.totalValueCost')}</p>
              <h3 className="text-2xl font-bold text-gray-800 mt-1">{formatCurrency(summary?.totalValueCost)}</h3>
              <p className="text-xs text-gray-500 mt-1">
                 {t('stockReport.estSalesValue')}: <span className="text-green-600 font-medium">{formatCurrency(summary?.totalValueSales)}</span>
              </p>
            </div>
            <div className="p-2 bg-blue-50 rounded-lg text-blue-600">
              <DollarSign size={20} />
            </div>
          </div>
        </div>

        {/* Total Items */}
        <div className="bg-white p-5 rounded-lg shadow-sm border-l-4 border-purple-500">
           <div className="flex justify-between items-start">
            <div>
              <p className="text-gray-500 text-xs uppercase font-medium tracking-wider">{t('stockReport.totalProducts')}</p>
              <h3 className="text-2xl font-bold text-gray-800 mt-1">{summary?.totalItems || 0}</h3>
              <p className="text-xs text-gray-500 mt-1">{t('stockReport.activeItems')}</p>
            </div>
            <div className="p-2 bg-purple-50 rounded-lg text-purple-600">
              <Package size={20} />
            </div>
          </div>
        </div>

        {/* Low Stock */}
        <div className="bg-white p-5 rounded-lg shadow-sm border-l-4 border-orange-500 cursor-pointer hover:bg-orange-50 transition-colors"
             onClick={() => setStockStatusFilter('low')}>
           <div className="flex justify-between items-start">
            <div>
              <p className="text-gray-500 text-xs uppercase font-medium tracking-wider">{t('stockReport.lowStockItems')}</p>
              <h3 className="text-2xl font-bold text-orange-600 mt-1">{summary?.lowStock || 0}</h3>
              <p className="text-xs text-orange-600 mt-1">{t('stockReport.belowReorderLevel')}</p>
            </div>
            <div className="p-2 bg-orange-100 rounded-lg text-orange-600">
              <AlertTriangle size={20} />
            </div>
          </div>
        </div>

        {/* Out of Stock */}
        <div className="bg-white p-5 rounded-lg shadow-sm border-l-4 border-red-500 cursor-pointer hover:bg-red-50 transition-colors"
             onClick={() => setStockStatusFilter('out')}>
           <div className="flex justify-between items-start">
            <div>
              <p className="text-gray-500 text-xs uppercase font-medium tracking-wider">{t('stockReport.outOfStock')}</p>
              <h3 className="text-2xl font-bold text-red-600 mt-1">{summary?.outOfStock || 0}</h3>
              <p className="text-xs text-red-600 mt-1">{t('stockReport.immediateAttention')}</p>
            </div>
            <div className="p-2 bg-red-100 rounded-lg text-red-600">
              <AlertCircle size={20} />
            </div>
          </div>
        </div>
      </div>

      {/* Chart */}
      <div className="bg-white p-6 rounded-lg shadow-sm">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">{t('stockReport.chartTitle')}</h2>
        <div className="h-80 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={categoryData} layout="vertical" margin={{ top: 5, right: 30, left: 40, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
              <XAxis type="number" tickFormatter={(value) => `₹${(value/1000).toFixed(0)}k`} />
              <YAxis dataKey="category_name" type="category" width={100} />
              <Tooltip 
                formatter={(value) => formatCurrency(value)}
                cursor={{ fill: 'transparent' }}
              />
              <Bar dataKey="stock_value" fill="#3b82f6" name={t('stockReport.stockValue')} radius={[0, 4, 4, 0]} barSize={20} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Detailed Table Section */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        {/* Table Filters */}
        <div className="p-4 border-b border-gray-100 flex flex-col sm:flex-row gap-4 justify-between items-center">
          <div className="flex items-center gap-2 w-full sm:w-auto">
             <div className="relative flex-1 sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input 
                  type="text"
                  placeholder={t('stockReport.searchPlaceholder')}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
             </div>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto overflow-x-auto pb-2 sm:pb-0">
             <select 
               value={selectedCategory}
               onChange={(e) => setSelectedCategory(e.target.value)}
               className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
             >
               <option value="all">{t('stockReport.allCategories')}</option>
               {categories.map(cat => (
                 <option key={cat.id} value={cat.id}>{cat.name}</option>
               ))}
             </select>

             <select 
               value={stockStatusFilter}
               onChange={(e) => setStockStatusFilter(e.target.value)}
               className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
             >
               <option value="all">{t('stockReport.allStatus')}</option>
               <option value="available">{t('stockReport.available')}</option>
               <option value="low">{t('stockReport.lowStock')}</option>
               <option value="out">{t('stockReport.outOfStock')}</option>
             </select>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 text-gray-600 text-xs uppercase tracking-wider">
                <th className="p-4 font-semibold border-b">{t('stockReport.table.product')}</th>
                <th className="p-4 font-semibold border-b">{t('stockReport.table.category')}</th>
                <th className="p-4 font-semibold border-b text-center">{t('stockReport.table.stockLevel')}</th>
                <th className="p-4 font-semibold border-b text-right">{t('stockReport.table.unitCost')}</th>
                <th className="p-4 font-semibold border-b text-right">{t('stockReport.table.totalValue')}</th>
                <th className="p-4 font-semibold border-b text-center">{t('stockReport.table.status')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {stockList.length > 0 ? (
                stockList.map(item => {
                  const isLow = item.current_stock > 0 && item.current_stock <= item.reorder_level;
                  const isOut = item.current_stock <= 0;
                  
                  return (
                    <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                      <td className="p-4">
                        <div className="font-medium text-gray-800">{item.product_name}</div>
                        <div className="text-xs text-gray-500">{item.product_code}</div>
                      </td>
                      <td className="p-4 text-sm text-gray-600">{item.category_name || '-'}</td>
                      <td className="p-4 text-center">
                        <span className={`font-semibold ${isOut ? 'text-red-600' : isLow ? 'text-orange-600' : 'text-gray-700'}`}>
                          {item.current_stock}
                        </span>
                        <span className="text-gray-400 text-xs ml-1">{item.unit}</span>
                      </td>
                      <td className="p-4 text-right text-sm text-gray-600">{formatCurrency(item.purchase_price)}</td>
                      <td className="p-4 text-right font-medium text-gray-800">{formatCurrency(item.total_value)}</td>
                      <td className="p-4 text-center">
                        {isOut ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                            {t('stockReport.outOfStock')}
                          </span>
                        ) : isLow ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                            {t('stockReport.lowStock')}
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            {t('stockReport.inStock')}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan="6" className="p-8 text-center text-gray-500">
                    {t('stockReport.noProductsFound')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="p-4 border-t border-gray-100 flex items-center justify-between">
            <p className="text-sm text-gray-500">
              {t('common.showing')} {((currentPage - 1) * pagination.limit) + 1} {t('common.to')} {Math.min(currentPage * pagination.limit, pagination.total)} {t('common.of')} {pagination.total} {t('common.entries')}
            </p>
            <div className="flex gap-2">
              <button 
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="p-2 border rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronLeft size={16} />
              </button>
              <button 
                onClick={() => setCurrentPage(p => Math.min(pagination.totalPages, p + 1))}
                disabled={currentPage === pagination.totalPages}
                className="p-2 border rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default StockReport;