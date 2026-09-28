import React, { useState, useEffect } from 'react';
import { 
  AlertTriangle, Search, RefreshCw, ChevronLeft, ChevronRight, ArrowDown 
} from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';

const LowStockReport = () => {
  const { t } = useTranslation();
  const [isLoading, setIsLoading] = useState(true);
  const [stockList, setStockList] = useState([]);
  const [summary, setSummary] = useState(null);
  
  // Filters and Pagination
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, totalPages: 0, limit: 10 });

  useEffect(() => {
    fetchData();
  }, [currentPage, searchTerm]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      if (!window.api || !window.api.getStockList) {
        // Fallback for dev environment/first load check
        console.warn('API not ready');
        setIsLoading(false);
        return;
      }

      // Fetch Summary (to get total low stock count specifically)
      const summaryRes = await window.api.getStockSummary();
      if (summaryRes.success) setSummary(summaryRes.data);

      // Fetch Low Stock List
      const res = await window.api.getStockList({
        page: currentPage,
        limit: 10,
        searchTerm,
        stockStatus: 'low' // Explicitly fetch low stock items
      });
      
      if (res.success) {
        setStockList(res.data);
        setPagination(res.pagination);
      }
    } catch (error) {
      console.error('Error fetching low stock report:', error);
      toast.error('Failed to load low stock data');
    } finally {
      setIsLoading(false);
    }
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0
    }).format(value || 0);
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">{t('lowStockReport.title')}</h1>
          <p className="text-sm text-gray-600">{t('lowStockReport.subtitle')}</p>
        </div>
        <button 
          onClick={fetchData}
          className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors"
        >
          <RefreshCw size={18} />
          <span>{t('lowStockReport.refresh')}</span>
        </button>
      </div>

      {/* Summary Alert */}
      <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 flex items-start gap-3">
        <div className="p-2 bg-orange-100 rounded-full text-orange-600 mt-1">
          <AlertTriangle size={20} />
        </div>
        <div>
          <h4 className="font-bold text-orange-800 text-lg">
            {summary?.lowStock || 0} {t('lowStockReport.itemsNeedReordering')}
          </h4>
          <p className="text-orange-700 text-sm mt-1">
            {t('lowStockReport.alertMessage')}
          </p>
        </div>
      </div>

      {/* Table Section */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        {/* Search */}
        <div className="p-4 border-b border-gray-100">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input 
              type="text"
              placeholder={t('lowStockReport.searchPlaceholder')}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* List */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 text-gray-600 text-xs uppercase tracking-wider">
                <th className="p-4 font-semibold border-b">{t('lowStockReport.product')}</th>
                <th className="p-4 font-semibold border-b">{t('lowStockReport.category')}</th>
                <th className="p-4 font-semibold border-b text-center">{t('lowStockReport.currentStock')}</th>
                <th className="p-4 font-semibold border-b text-center">{t('lowStockReport.reorderLevel')}</th>
                <th className="p-4 font-semibold border-b text-center">{t('lowStockReport.shortage')}</th>
                <th className="p-4 font-semibold border-b text-right">{t('lowStockReport.unitCost')}</th>
                <th className="p-4 font-semibold border-b text-right">{t('lowStockReport.estReorderCost')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isLoading ? (
                <tr>
                  <td colSpan="7" className="p-8 text-center">
                    <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
                  </td>
                </tr>
              ) : stockList.length > 0 ? (
                stockList.map(item => {
                  const shortage = Math.max(0, item.reorder_level - item.current_stock);
                  const estCost = shortage * item.purchase_price;
                  
                  return (
                    <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                      <td className="p-4">
                        <div className="font-medium text-gray-800">{item.product_name}</div>
                        <div className="text-xs text-gray-500">{item.product_code}</div>
                      </td>
                      <td className="p-4 text-sm text-gray-600">{item.category_name || '-'}</td>
                      <td className="p-4 text-center font-bold text-orange-600">
                        {item.current_stock} <span className="text-xs font-normal text-gray-500">{item.unit}</span>
                      </td>
                      <td className="p-4 text-center text-sm text-gray-700">
                        {item.reorder_level}
                      </td>
                      <td className="p-4 text-center">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-orange-100 text-orange-800">
                          {shortage}
                        </span>
                      </td>
                      <td className="p-4 text-right text-sm text-gray-600">
                        {formatCurrency(item.purchase_price)}
                      </td>
                      <td className="p-4 text-right font-medium text-gray-800">
                        {formatCurrency(estCost)}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan="7" className="p-8 text-center text-gray-500">
                    <div className="flex flex-col items-center justify-center">
                      <div className="p-3 bg-green-50 rounded-full text-green-500 mb-2">
                         <RefreshCw size={24} />
                      </div>
                      <p>{t('lowStockReport.noLowStockFound')}</p>
                    </div>
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
              {t('lowStockReport.paginationText', {
                start: ((currentPage - 1) * pagination.limit) + 1,
                end: Math.min(currentPage * pagination.limit, pagination.total),
                total: pagination.total
              })}
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

export default LowStockReport;