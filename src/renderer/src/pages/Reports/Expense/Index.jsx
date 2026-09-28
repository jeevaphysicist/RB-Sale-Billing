import React, { useState, useEffect } from 'react';
import { 
  CreditCard, 
  TrendingUp, 
  TrendingDown, 
  Calendar, 
  Search, 
  Filter,
  PieChart as PieIcon,
  BarChart as BarIcon,
  Tags
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend
} from 'recharts';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';

const ExpenseReport = () => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState({
    totalExpenses: 0,
    avgExpense: 0,
    topCategory: { category_name: 'N/A', total: 0 }
  });
  const [trendData, setTrendData] = useState([]);
  const [categoryData, setCategoryData] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [totalTransactions, setTotalTransactions] = useState(0);
  
  // Filters
  const [dateRange, setDateRange] = useState('thisMonth');
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);

  const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#6366f1'];

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(amount);
  };

  const calculateDateRange = (range) => {
    const now = new Date();
    let start = new Date();
    let end = new Date();

    switch (range) {
      case 'thisMonth':
        start = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case 'lastMonth':
        start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        end = new Date(now.getFullYear(), now.getMonth(), 0);
        break;
      case 'thisYear':
        start = new Date(now.getFullYear(), 0, 1);
        break;
      case 'last30Days':
        start.setDate(now.getDate() - 30);
        break;
      default:
        start = new Date(now.getFullYear(), now.getMonth(), 1);
    }
    
    return {
      startDate: start.toISOString().split('T')[0],
      endDate: end.toISOString().split('T')[0]
    };
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      const { startDate, endDate } = calculateDateRange(dateRange);
      
      // 1. Fetch Summary
      const summaryRes = await window.api.getExpenseReportSummary({ startDate, endDate });
      if (summaryRes.success) {
        setSummary(summaryRes.data);
      }

      // 2. Fetch Charts
      const [trendRes, catRes] = await Promise.all([
        window.api.getExpenseTrend({}),
        window.api.getExpenseCategoryBreakdown({ startDate, endDate })
      ]);

      if (trendRes.success) setTrendData(trendRes.data);
      if (catRes.success) setCategoryData(catRes.data);

      // 3. Fetch List
      const listRes = await window.api.getExpenseReportList({
        page: currentPage,
        limit: itemsPerPage,
        searchTerm,
        startDate, // Filter list by selected range too? Usually yes for reports.
        endDate
      });
      
      if (listRes.success) {
        setTransactions(listRes.data);
        setTotalTransactions(listRes.total);
      }

    } catch (error) {
      console.error('Error fetching expense report:', error);
      toast.error('Failed to load expense report data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [dateRange, currentPage, searchTerm]);

  const totalPages = Math.ceil(totalTransactions / itemsPerPage);

  if (loading && !summary.totalExpenses) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-rose-600"></div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 pb-24">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">{t('expenseReport.title')}</h1>
          <p className="text-gray-500">{t('expenseReport.subtitle')}</p>
        </div>
        
        <div className="flex items-center gap-3 bg-white p-1 rounded-lg border border-gray-200 shadow-sm">
          {['thisMonth', 'lastMonth', 'last30Days', 'thisYear'].map((range) => (
            <button
              key={range}
              onClick={() => setDateRange(range)}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${
                dateRange === range
                  ? 'bg-rose-50 text-rose-700 shadow-sm'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              {t(`common.dateRanges.${range}`)}
            </button>
          ))}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Total Expenses */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 flex flex-col justify-between">
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 bg-rose-50 rounded-lg text-rose-600">
              <CreditCard size={24} />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">{t('expenseReport.totalExpenses')}</p>
              <h3 className="text-2xl font-bold text-gray-800">{formatCurrency(summary.totalExpenses)}</h3>
            </div>
          </div>
          <p className="text-xs text-gray-400">{t('expenseReport.totalCostsNote')}</p>
        </div>

        {/* Avg Expense */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 flex flex-col justify-between">
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 bg-blue-50 rounded-lg text-blue-600">
              <TrendingUp size={24} />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">{t('expenseReport.avgExpense')}</p>
              <h3 className="text-2xl font-bold text-gray-800">{formatCurrency(summary.avgExpense)}</h3>
            </div>
          </div>
          <p className="text-xs text-gray-400">{t('expenseReport.avgSpendNote')}</p>
        </div>

        {/* Top Category */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 flex flex-col justify-between">
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 bg-amber-50 rounded-lg text-amber-600">
              <Tags size={24} />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">{t('expenseReport.topCategory')}</p>
              <h3 className="text-xl font-bold text-gray-800 truncate max-w-[180px]" title={summary.topCategory.category_name}>
                {summary.topCategory.category_name || 'N/A'}
              </h3>
            </div>
          </div>
          <p className="text-xs text-gray-400">
            {formatCurrency(summary.topCategory.total)} {t('expenseReport.spentInCategoryNote')}
          </p>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Monthly Trend */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-6 flex items-center gap-2">
            <BarIcon size={18} className="text-gray-400" />
            {t('expenseReport.monthlySpendingTrend')}
          </h3>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={trendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                <XAxis dataKey="month" stroke="#9ca3af" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#9ca3af" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `₹${value/1000}k`} />
                <Tooltip 
                  cursor={{ fill: '#f3f4f6' }}
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  formatter={(value) => formatCurrency(value)}
                />
                <Bar dataKey="total" fill="#f43f5e" radius={[4, 4, 0, 0]} maxBarSize={50} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Category Distribution */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-6 flex items-center gap-2">
            <PieIcon size={18} className="text-gray-400" />
            {t('expenseReport.categoryDistribution')}
          </h3>
          <div className="h-[300px] flex items-center justify-center">
             {categoryData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={categoryData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {categoryData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => formatCurrency(value)} />
                  <Legend verticalAlign="bottom" height={36} iconType="circle" />
                </PieChart>
              </ResponsiveContainer>
             ) : (
               <div className="text-gray-400 text-sm">{t('expenseReport.noCategoryData')}</div>
             )}
          </div>
        </div>
      </div>

      {/* Detailed List */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-6 border-b border-gray-100 flex flex-col md:flex-row justify-between items-center gap-4">
          <h3 className="text-lg font-semibold text-gray-800">{t('expenseReport.expenseHistory')}</h3>
          <div className="relative">
            <input
              type="text"
              placeholder={t('expenseReport.searchPlaceholder')}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 w-64"
            />
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left py-3 px-6 text-xs font-semibold text-gray-500 uppercase tracking-wider">{t('expenseReport.date')}</th>
                <th className="text-left py-3 px-6 text-xs font-semibold text-gray-500 uppercase tracking-wider">{t('expenseReport.expNo')}</th>
                <th className="text-left py-3 px-6 text-xs font-semibold text-gray-500 uppercase tracking-wider">{t('expenseReport.category')}</th>
                <th className="text-left py-3 px-6 text-xs font-semibold text-gray-500 uppercase tracking-wider">{t('expenseReport.description')}</th>
                <th className="text-left py-3 px-6 text-xs font-semibold text-gray-500 uppercase tracking-wider">{t('expenseReport.paidBy')}</th>
                <th className="text-right py-3 px-6 text-xs font-semibold text-gray-500 uppercase tracking-wider">{t('expenseReport.amount')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {transactions.length > 0 ? (
                transactions.map((tx) => (
                  <tr key={tx.id} className="hover:bg-gray-50 transition-colors">
                    <td className="py-3 px-6 text-sm text-gray-600">
                      {new Date(tx.expense_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </td>
                    <td className="py-3 px-6 text-sm text-gray-500 font-mono text-xs">
                      {tx.expense_number}
                    </td>
                    <td className="py-3 px-6">
                      <span className="px-2 py-1 bg-amber-50 text-amber-700 rounded-full text-xs font-medium">
                        {tx.category_name}
                      </span>
                    </td>
                    <td className="py-3 px-6 text-sm text-gray-600 max-w-xs truncate">
                      {tx.description || '-'}
                    </td>
                    <td className="py-3 px-6 text-sm text-gray-600">
                      {tx.paid_by}
                    </td>
                    <td className="py-3 px-6 text-sm font-semibold text-gray-800 text-right">
                      {formatCurrency(tx.amount)}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="6" className="py-8 text-center text-gray-500">
                    {t('expenseReport.noExpenseRecords')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="p-4 border-t border-gray-100 flex items-center justify-between">
            <span className="text-sm text-gray-500">
              {t('expenseReport.page')} {currentPage} {t('expenseReport.of')} {totalPages}
            </span>
            <div className="flex gap-2">
              <button
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(curr => curr - 1)}
                className="px-3 py-1 text-sm border border-gray-200 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {t('expenseReport.previous')}
              </button>
              <button
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(curr => curr + 1)}
                className="px-3 py-1 text-sm border border-gray-200 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {t('expenseReport.next')}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ExpenseReport;