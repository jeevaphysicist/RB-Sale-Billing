import React, { useState, useEffect } from 'react';
import { 
  DollarSign, 
  TrendingUp, 
  TrendingDown, 
  Calendar, 
  Search, 
  ArrowUpRight, 
  ArrowDownRight,
  Filter,
  CreditCard
} from 'lucide-react';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  BarChart,
  Bar,
  Legend
} from 'recharts';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';

const PaymentReport = () => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState({
    totalIn: 0,
    totalOut: 0,
    netCashFlow: 0,
    breakdown: { sales: 0, purchases: 0, expenses: 0 }
  });
  const [chartData, setChartData] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [totalTransactions, setTotalTransactions] = useState(0);
  
  // Filters
  const [dateRange, setDateRange] = useState('thisMonth'); // thisMonth, lastMonth, thisYear, all
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);

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
    let end = new Date(); // Today

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
        start = new Date(now.getFullYear(), now.getMonth(), 1); // Default to this month
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
      const summaryRes = await window.api.getPaymentSummary({ startDate, endDate });
      if (summaryRes.success) {
        setSummary(summaryRes.data);
      }

      // 2. Fetch Chart Data (Generic trend, usually longer term, but let's respect filters if possible or default to year)
      const chartRes = await window.api.getPaymentChartData({});
      if (chartRes.success) {
        setChartData(chartRes.data);
      }

      // 3. Fetch Transactions
      const transactionsRes = await window.api.getPaymentTransactions({
        page: currentPage,
        limit: itemsPerPage,
        searchTerm
        // For transactions list, we typically show all recent unless specific date filter applied strictly
        // For now, let's keep it simple and just show recent.
      });
      
      if (transactionsRes.success) {
        setTransactions(transactionsRes.data);
        setTotalTransactions(transactionsRes.total);
      }

    } catch (error) {
      console.error('Error fetching payment report:', error);
      toast.error('Failed to load payment report data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [dateRange, currentPage, searchTerm]);

  // Handle page change
  const totalPages = Math.ceil(totalTransactions / itemsPerPage);

  const getTypeColor = (type) => {
    switch (type) {
      case 'Sale': return 'text-emerald-600 bg-emerald-50';
      case 'Purchase': return 'text-blue-600 bg-blue-50';
      case 'Expense': return 'text-rose-600 bg-rose-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  if (loading && !summary.totalIn) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 pb-24">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">{t('paymentReport.title')}</h1>
          <p className="text-gray-500">{t('paymentReport.subtitle')}</p>
        </div>
        
        <div className="flex items-center gap-3 bg-white p-1 rounded-lg border border-gray-200 shadow-sm">
          {['thisMonth', 'lastMonth', 'last30Days', 'thisYear'].map((range) => (
            <button
              key={range}
              onClick={() => setDateRange(range)}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${
                dateRange === range
                  ? 'bg-emerald-50 text-emerald-700 shadow-sm'
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
        {/* Total In */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 relative overflow-hidden group hover:shadow-md transition-all">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <ArrowUpRight size={80} className="text-emerald-600" />
          </div>
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 bg-emerald-50 rounded-lg text-emerald-600">
              <TrendingUp size={24} />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">{t('paymentReport.totalReceived')}</p>
              <h3 className="text-2xl font-bold text-emerald-600">{formatCurrency(summary.totalIn)}</h3>
            </div>
          </div>
          <div className="text-xs text-gray-400">
            {t('paymentReport.fromSales')}: {formatCurrency(summary.breakdown.sales)}
          </div>
        </div>

        {/* Total Out */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 relative overflow-hidden group hover:shadow-md transition-all">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <ArrowDownRight size={80} className="text-rose-600" />
          </div>
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 bg-rose-50 rounded-lg text-rose-600">
              <TrendingDown size={24} />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">{t('paymentReport.totalPaid')}</p>
              <h3 className="text-2xl font-bold text-rose-600">{formatCurrency(summary.totalOut)}</h3>
            </div>
          </div>
          <div className="text-xs text-gray-400 flex gap-3">
            <span>{t('paymentReport.purchases')}: {formatCurrency(summary.breakdown.purchases)}</span>
            <span>{t('paymentReport.expenses')}: {formatCurrency(summary.breakdown.expenses)}</span>
          </div>
        </div>

        {/* Net Flow */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 relative overflow-hidden group hover:shadow-md transition-all">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <DollarSign size={80} className={summary.netCashFlow >= 0 ? "text-blue-600" : "text-amber-600"} />
          </div>
          <div className="flex items-center gap-4 mb-4">
            <div className={`p-3 rounded-lg ${summary.netCashFlow >= 0 ? "bg-blue-50 text-blue-600" : "bg-amber-50 text-amber-600"}`}>
              <DollarSign size={24} />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">{t('paymentReport.netCashInHand')}</p>
              <h3 className={`text-2xl font-bold ${summary.netCashFlow >= 0 ? "text-blue-600" : "text-amber-600"}`}>
                {formatCurrency(summary.netCashFlow)}
              </h3>
            </div>
          </div>
          <div className="text-xs text-gray-400">
            {t('paymentReport.balanceNote')}
          </div>
        </div>
      </div>

      {/* Chart Section */}
      <div className="glass-card rounded-xl border border-gray-100 p-6 bg-white shadow-sm">
        <h3 className="text-lg font-semibold text-gray-800 mb-6">{t('paymentReport.cashFlowTrend')}</h3>
        <div className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="colorIncome" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.1}/>
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="colorExpense" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.1}/>
                  <stop offset="95%" stopColor="#f43f5e" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <XAxis dataKey="month" stroke="#9ca3af" fontSize={12} tickLine={false} axisLine={false} />
              <YAxis 
                stroke="#9ca3af" 
                fontSize={12} 
                tickLine={false} 
                axisLine={false}
                tickFormatter={(value) => `₹${value/1000}k`}
              />
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
              <Tooltip 
                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                formatter={(value) => formatCurrency(value)}
              />
              <Legend />
              <Area 
                type="monotone" 
                dataKey="income" 
                name={t('paymentReport.income')}
                stroke="#10b981" 
                strokeWidth={2}
                fillOpacity={1} 
                fill="url(#colorIncome)" 
              />
              <Area 
                type="monotone" 
                dataKey="expense" 
                name={t('paymentReport.expense')}
                stroke="#f43f5e" 
                strokeWidth={2}
                fillOpacity={1} 
                fill="url(#colorExpense)" 
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
      
      {/* Recent Transactions */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-6 border-b border-gray-100 flex flex-col md:flex-row justify-between items-center gap-4">
          <h3 className="text-lg font-semibold text-gray-800">{t('paymentReport.recentTransactions')}</h3>
          <div className="relative">
            <input
              type="text"
              placeholder={t('paymentReport.searchPlaceholder')}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 w-64"
            />
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
             <thead className="bg-gray-50">
              <tr>
                <th className="text-left py-3 px-6 text-xs font-semibold text-gray-500 uppercase tracking-wider">{t('paymentReport.date')}</th>
                <th className="text-left py-3 px-6 text-xs font-semibold text-gray-500 uppercase tracking-wider">{t('paymentReport.type')}</th>
                <th className="text-left py-3 px-6 text-xs font-semibold text-gray-500 uppercase tracking-wider">{t('paymentReport.partyDescription')}</th>
                <th className="text-left py-3 px-6 text-xs font-semibold text-gray-500 uppercase tracking-wider">{t('paymentReport.refNo')}</th>
                <th className="text-left py-3 px-6 text-xs font-semibold text-gray-500 uppercase tracking-wider">{t('paymentReport.mode')}</th>
                <th className="text-right py-3 px-6 text-xs font-semibold text-gray-500 uppercase tracking-wider">{t('paymentReport.amount')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {transactions.length > 0 ? (
                transactions.map((tx) => (
                  <tr key={`${tx.type}-${tx.id}`} className="hover:bg-gray-50 transition-colors">
                    <td className="py-3 px-6 text-sm text-gray-600">
                      {new Date(tx.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </td>
                    <td className="py-3 px-6">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getTypeColor(tx.type)}`}>
                        {tx.type}
                      </span>
                    </td>
                    <td className="py-3 px-6 text-sm text-gray-800 font-medium max-w-xs truncate">
                      {tx.party_name || '-'}
                    </td>
                    <td className="py-3 px-6 text-sm text-gray-500 font-mono text-xs">
                      {tx.ref_no || '-'}
                    </td>
                    <td className="py-3 px-6 text-sm text-gray-600 capitalize">
                      {tx.mode || '-'}
                    </td>
                    <td className={`py-3 px-6 text-sm font-semibold text-right ${
                      tx.type === 'Sale' ? 'text-emerald-600' : 'text-rose-600'
                    }`}>
                      {tx.type === 'Sale' ? '+' : '-'} {formatCurrency(tx.amount)}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="6" className="py-8 text-center text-gray-500">
                    {t('paymentReport.noTransactions')}
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
              {t('paymentReport.page')} {currentPage} {t('paymentReport.of')} {totalPages}
            </span>
            <div className="flex gap-2">
              <button
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(curr => curr - 1)}
                className="px-3 py-1 text-sm border border-gray-200 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {t('paymentReport.previous')}
              </button>
              <button
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(curr => curr + 1)}
                className="px-3 py-1 text-sm border border-gray-200 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {t('paymentReport.next')}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PaymentReport;