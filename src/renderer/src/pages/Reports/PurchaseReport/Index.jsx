import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { format, subDays, startOfWeek, startOfMonth, startOfYear, parse } from 'date-fns';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import { Download, Calendar, Search, TrendingUp, ShoppingCart, DollarSign, Package } from 'lucide-react';
import * as XLSX from 'xlsx';
import { toast } from 'sonner';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

const PurchaseReport = () => {
  const { t } = useTranslation();
  const [dateRange, setDateRange] = useState('thisMonth');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(25);
  
  // Data states
  const [summary, setSummary] = useState(null);
  const [dailyPurchases, setDailyPurchases] = useState([]);
  const [topProducts, setTopProducts] = useState([]);
  const [categoryBreakdown, setCategoryBreakdown] = useState([]);
  const [paymentBreakdown, setPaymentBreakdown] = useState([]);
  const [detailedPurchases, setDetailedPurchases] = useState({ purchases: [], totalCount: 0, totalPages: 0 });
  const [isDashboardLoading, setIsDashboardLoading] = useState(true);
  const [isTableLoading, setIsTableLoading] = useState(true);

  // Set default date range
  useEffect(() => {
    updateDateRange('thisMonth');
  }, []);

  // Debounce search term
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 500);

    return () => {
      clearTimeout(handler);
    };
  }, [searchTerm]);

  // Fetch dashboard data when dates change
  useEffect(() => {
    if (startDate && endDate) {
      fetchDashboardData();
      fetchTableData(); // Initial load for table
    }
  }, [startDate, endDate]);

  // Fetch table data when search or page changes
  useEffect(() => {
    if (startDate && endDate) {
      fetchTableData();
    }
  }, [debouncedSearchTerm, currentPage]);

  const updateDateRange = (range) => {
    const today = new Date();
    let start, end;

    switch (range) {
      case 'today':
        start = end = format(today, 'dd-MM-yyyy');
        break;
      case 'yesterday':
        const yesterday = subDays(today, 1);
        start = end = format(yesterday, 'dd-MM-yyyy');
        break;
      case 'thisWeek':
        start = format(startOfWeek(today), 'dd-MM-yyyy');
        end = format(today, 'dd-MM-yyyy');
        break;
      case 'thisMonth':
        start = format(startOfMonth(today), 'dd-MM-yyyy');
        end = format(today, 'dd-MM-yyyy');
        break;
      case 'thisYear':
        start = format(startOfYear(today), 'dd-MM-yyyy');
        end = format(today, 'dd-MM-yyyy');
        break;
      case 'custom':
        setStartDate('');
        setEndDate('');
        setDateRange(range);
        return;
      default:
        return;
    }

    setStartDate(start);
    setEndDate(end);
    setDateRange(range);
  };

  const fetchDashboardData = async () => {
    setIsDashboardLoading(true);
    try {
      const filters = { startDate, endDate };
      const [summaryRes, dailyRes, topProdRes, categoryRes, paymentRes] = await Promise.all([
        window.api.getPurchaseSummary(filters),
        window.api.getDailyPurchases(filters),
        window.api.getPurchaseTopProducts({ ...filters, limit: 10 }),
        window.api.getPurchaseCategoryBreakdown(filters),
        window.api.getPurchasePaymentBreakdown(filters)
      ]);

      if (summaryRes.success) setSummary(summaryRes.data);
      if (dailyRes.success) setDailyPurchases(dailyRes.data);
      if (topProdRes.success) setTopProducts(topProdRes.data);
      if (categoryRes.success) setCategoryBreakdown(categoryRes.data);
      if (paymentRes.success) setPaymentBreakdown(paymentRes.data);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      toast.error('Failed to load dashboard data');
    } finally {
      setIsDashboardLoading(false);
    }
  };

  const fetchTableData = async () => {
    setIsTableLoading(true);
    try {
      const filters = { startDate, endDate };
      const detailedRes = await window.api.getDetailedPurchases({ 
        ...filters, 
        searchTerm: debouncedSearchTerm, 
        page: currentPage, 
        pageSize 
      });

      if (detailedRes.success) setDetailedPurchases(detailedRes.data);
    } catch (error) {
      console.error('Error fetching table data:', error);
      toast.error('Failed to load table data');
    } finally {
      setIsTableLoading(false);
    }
  };

  const exportToExcel = () => {
    try {
      const exportData = detailedPurchases.purchases.map(po => ({
        [t('purchaseReport.table.poNumber')]: po.po_number,
        [t('purchaseReport.table.date')]: po.po_date,
        [t('purchaseReport.table.supplier')]: po.supplier_name || '',
        [t('purchaseReport.table.contact')]: po.contact_number || '',
        [t('purchaseReport.table.items')]: po.itemCount,
        [t('purchaseReport.table.subtotal')]: po.subtotal?.toFixed(2) || 0,
        [t('purchaseReport.table.discount')]: po.discount_amount?.toFixed(2) || 0,
        [t('purchaseReport.table.tax')]: po.tax_total?.toFixed(2) || 0,
        [t('purchaseReport.table.total')]: po.grand_total?.toFixed(2) || 0,
        [t('purchaseReport.table.paymentTerms')]: po.payment_terms || '',
        [t('purchaseReport.table.paymentStatus')]: po.payment_status,
        [t('purchaseReport.table.status')]: po.status
      }));

      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Purchase Report');

      // Auto-fit columns
      const maxWidth = exportData.reduce((w, r) => Math.max(w, Object.keys(r).length), 10);
      ws['!cols'] = Array(maxWidth).fill({ wch: 15 });

      const filename = `Purchase_Report_${startDate}_to_${endDate}.xlsx`;
      XLSX.writeFile(wb, filename);
      toast.success('Excel file downloaded successfully');
    } catch (error) {
      console.error('Error exporting to Excel:', error);
      toast.error('Failed to export to Excel');
    }
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0
    }).format(value || 0);
  };

  if (isDashboardLoading && !summary) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="mt-4 text-gray-600">Loading dashboard data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">{t('purchaseReport.title')}</h1>
          <p className="text-sm text-gray-600">{t('purchaseReport.subtitle')}</p>
        </div>
        <button
          onClick={exportToExcel}
          className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
        >
          <Download size={18} />
          <span>{t('purchaseReport.exportToExcel')}</span>
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
        <div className="flex flex-wrap gap-4">
          {/* Date Range Selector */}
          <div className="flex items-center gap-2">
            <Calendar size={18} className="text-gray-500" />
            <select
              value={dateRange}
              onChange={(e) => updateDateRange(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            >
              <option value="today">{t('salesReport.dateRanges.today')}</option>
              <option value="yesterday">{t('salesReport.dateRanges.yesterday')}</option>
              <option value="thisWeek">{t('salesReport.dateRanges.thisWeek')}</option>
              <option value="thisMonth">{t('salesReport.dateRanges.thisMonth')}</option>
              <option value="thisYear">{t('salesReport.dateRanges.thisYear')}</option>
              <option value="custom">{t('salesReport.dateRanges.custom')}</option>
            </select>
          </div>

          {/* Custom Date Inputs */}
          {dateRange === 'custom' && (
            <>
              <input
                type="date"
                value={startDate ? format(parse(startDate, 'dd-MM-yyyy', new Date()), 'yyyy-MM-dd') : ''}
                onChange={(e) => {
                  if (e.target.value) {
                    setStartDate(format(parse(e.target.value, 'yyyy-MM-dd', new Date()), 'dd-MM-yyyy'));
                  } else {
                    setStartDate('');
                  }
                }}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              />
              <input
                type="date"
                value={endDate ? format(parse(endDate, 'dd-MM-yyyy', new Date()), 'yyyy-MM-dd') : ''}
                onChange={(e) => {
                  if (e.target.value) {
                    setEndDate(format(parse(e.target.value, 'yyyy-MM-dd', new Date()), 'dd-MM-yyyy'));
                  } else {
                    setEndDate('');
                  }
                }}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 p-6 rounded-lg shadow-lg text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-blue-100 text-sm">{t('purchaseReport.totalSpend')}</p>
              <p className="text-2xl font-bold mt-1">{formatCurrency(summary?.totalSpend)}</p>
            </div>
            <DollarSign size={40} className="opacity-30" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-green-500 to-green-600 p-6 rounded-lg shadow-lg text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-green-100 text-sm">{t('purchaseReport.totalPOs')}</p>
              <p className="text-2xl font-bold mt-1">{summary?.totalOrders || 0}</p>
            </div>
            <ShoppingCart size={40} className="opacity-30" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-purple-500 to-purple-600 p-6 rounded-lg shadow-lg text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-purple-100 text-sm">{t('purchaseReport.avgPOValue')}</p>
              <p className="text-2xl font-bold mt-1">{formatCurrency(summary?.averageOrderValue)}</p>
            </div>
            <TrendingUp size={40} className="opacity-30" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-orange-500 to-orange-600 p-6 rounded-lg shadow-lg text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-orange-100 text-sm">{t('purchaseReport.totalItems')}</p>
              <p className="text-2xl font-bold mt-1">{summary?.totalItems || 0}</p>
            </div>
            <Package size={40} className="opacity-30" />
          </div>
        </div>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Purchase Trend Chart */}
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">{t('purchaseReport.purchaseTrend')}</h2>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={dailyPurchases}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip formatter={(value) => formatCurrency(value)} />
              <Area type="monotone" dataKey="spend" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.6} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Top Products Chart */}
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">{t('purchaseReport.topProducts')}</h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={topProducts} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" />
              <YAxis dataKey="name" type="category" width={100} />
              <Tooltip formatter={(value) => formatCurrency(value)} />
              <Bar dataKey="spend" fill="#10b981" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Category Breakdown */}
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">{t('purchaseReport.purchasesByCategory')}</h2>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={categoryBreakdown}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {categoryBreakdown.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(value) => formatCurrency(value)} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Payment Method Breakdown */}
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">{t('purchaseReport.paymentMethods')}</h2>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={paymentBreakdown}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {paymentBreakdown.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(value) => formatCurrency(value)} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Data Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-800">{t('purchaseReport.detailedTransactions')}</h2>
            
            {/* Search Input in Table Section */}
            <div className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg w-64 bg-gray-50">
              <Search size={18} className="text-gray-500" />
              <input
                type="text"
                placeholder={t('purchaseReport.searchPlaceholder')}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="flex-1 outline-none bg-transparent"
              />
            </div>
          </div>
          
          {isTableLoading ? (
            <div className="flex justify-center p-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">{t('purchaseReport.table.poNumber')}</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">{t('purchaseReport.table.date')}</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">{t('purchaseReport.table.supplier')}</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase">{t('purchaseReport.table.items')}</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase">{t('purchaseReport.table.subtotal')}</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase">{t('purchaseReport.table.tax')}</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase">{t('purchaseReport.table.total')}</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">{t('purchaseReport.table.paymentStatus')}</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">{t('purchaseReport.table.status')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {detailedPurchases.purchases.map((po) => (
                  <tr key={po.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium text-blue-600">{po.po_number}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">{po.po_date}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">{po.supplier_name || '-'}</td>
                    <td className="px-4 py-3 text-sm text-gray-700 text-right">{po.itemCount}</td>
                    <td className="px-4 py-3 text-sm text-gray-700 text-right">{formatCurrency(po.subtotal)}</td>
                    <td className="px-4 py-3 text-sm text-gray-700 text-right">{formatCurrency(po.tax_total)}</td>
                    <td className="px-4 py-3 text-sm font-semibold text-gray-800 text-right">{formatCurrency(po.grand_total)}</td>
                    <td className="px-4 py-3 text-sm">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        po.payment_status === 'paid' ? 'bg-green-100 text-green-800' :
                        po.payment_status === 'partial' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {po.payment_status?.toUpperCase() || 'PENDING'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        po.status === 'received' ? 'bg-green-100 text-green-800' :
                        po.status === 'ordered' ? 'bg-blue-100 text-blue-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {po.status?.toUpperCase() || '-'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
              <div className="mt-4 flex items-center justify-between">
                <p className="text-sm text-gray-600">
                  {t('common.showing')} {((currentPage - 1) * pageSize) + 1} {t('common.to')} {Math.min(currentPage * pageSize, detailedPurchases.totalCount)} {t('common.of')} {detailedPurchases.totalCount} {t('common.entries')}
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                    className="px-3 py-1 border border-gray-300 rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                  >
                    Previous
                  </button>
                  <span className="px-3 py-1 border border-gray-300 rounded bg-blue-50 text-blue-600">
                    {currentPage} / {detailedPurchases.totalPages}
                  </span>
                  <button
                    onClick={() => setCurrentPage(prev => Math.min(detailedPurchases.totalPages, prev + 1))}
                    disabled={currentPage === detailedPurchases.totalPages}
                    className="px-3 py-1 border border-gray-300 rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                  >
                    Next
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default PurchaseReport;
