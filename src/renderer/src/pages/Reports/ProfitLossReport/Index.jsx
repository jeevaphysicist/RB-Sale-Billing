import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { format, subDays, startOfWeek, startOfMonth, startOfYear, parse } from 'date-fns';
import {
  AreaChart, Area, BarChart, Bar, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import { Calendar, DollarSign, TrendingUp, TrendingDown, ArrowUp, ArrowDown } from 'lucide-react';
import { toast } from 'sonner';

const ProfitLossReport = () => {
  const { t } = useTranslation();
  const [dateRange, setDateRange] = useState('thisMonth');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  // Data states
  const [summary, setSummary] = useState(null);
  const [dailyData, setDailyData] = useState([]);

  // Set default date range
  useEffect(() => {
    updateDateRange('thisMonth');
  }, []);

  // Fetch data when dates change
  useEffect(() => {
    if (startDate && endDate) {
      fetchData();
    }
  }, [startDate, endDate]);

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

  const fetchData = async () => {
    setIsLoading(true);
    try {
      if (!window.api || !window.api.getProfitLossSummary) {
        console.warn('API not ready, waiting for restart...');
        // Mock data or just return to avoid crash during dev hot-reload
        setIsLoading(false);
        return; 
      }

      const filters = { startDate, endDate };
      const [summaryRes, dailyRes] = await Promise.all([
        window.api.getProfitLossSummary(filters),
        window.api.getProfitLossDaily(filters)
      ]);

      if (summaryRes.success) setSummary(summaryRes.data);
      if (dailyRes.success) setDailyData(dailyRes.data);

    } catch (error) {
      console.error('Error fetching P&L data:', error);
      toast.error('Failed to load P&L report');
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

  if (isLoading && !summary) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="mt-4 text-gray-600">{t('profitLossReport.loading')}</p>
        </div>
      </div>
    );
  }

  // Calculate margin percentage
  const netMargin = summary?.revenue ? ((summary.netProfit / summary.revenue) * 100).toFixed(1) : 0;
  
  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">{t('profitLossReport.title')}</h1>
          <p className="text-sm text-gray-600">{t('profitLossReport.subtitle')}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
        <div className="flex flex-wrap gap-4">
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
        {/* Revenue */}
        <div className="bg-white p-6 rounded-lg shadow-sm border border-l-4 border-blue-500">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-gray-500 text-sm font-medium">{t('profitLossReport.totalRevenue')}</p>
              <h3 className="text-2xl font-bold text-gray-800 mt-1">{formatCurrency(summary?.revenue)}</h3>
              <p className="text-xs text-gray-500 mt-1">{t('profitLossReport.grossSales')}</p>
            </div>
            <div className="p-2 bg-blue-50 rounded-lg text-blue-600">
              <DollarSign size={24} />
            </div>
          </div>
        </div>

        {/* COGS */}
        <div className="bg-white p-6 rounded-lg shadow-sm border border-l-4 border-orange-500">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-gray-500 text-sm font-medium">{t('profitLossReport.cogs')}</p>
              <h3 className="text-2xl font-bold text-gray-800 mt-1">{formatCurrency(summary?.cogs)}</h3>
              <p className="text-xs text-gray-500 mt-1">{t('profitLossReport.estProductCost')}</p>
            </div>
            <div className="p-2 bg-orange-50 rounded-lg text-orange-600">
              <TrendingDown size={24} />
            </div>
          </div>
        </div>

        {/* Expenses */}
        <div className="bg-white p-6 rounded-lg shadow-sm border border-l-4 border-red-500">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-gray-500 text-sm font-medium">{t('profitLossReport.totalExpenses')}</p>
              <h3 className="text-2xl font-bold text-gray-800 mt-1">{formatCurrency(summary?.expenses)}</h3>
              <p className="text-xs text-gray-500 mt-1">{t('profitLossReport.operationalCosts')}</p>
            </div>
            <div className="p-2 bg-red-50 rounded-lg text-red-600">
              <TrendingDown size={24} />
            </div>
          </div>
        </div>

        {/* Net Profit */}
        <div className={`p-6 rounded-lg shadow-sm border border-l-4 ${summary?.netProfit >= 0 ? 'bg-green-50 border-green-500' : 'bg-red-50 border-red-500'}`}>
          <div className="flex justify-between items-start">
            <div>
              <p className={`${summary?.netProfit >= 0 ? 'text-green-800' : 'text-red-800'} text-sm font-medium`}>{t('profitLossReport.netProfit')}</p>
              <h3 className={`${summary?.netProfit >= 0 ? 'text-green-700' : 'text-red-700'} text-2xl font-bold mt-1`}>
                {formatCurrency(summary?.netProfit)}
              </h3>
              <div className="flex items-center mt-1">
                {summary?.netProfit >= 0 ? <ArrowUp size={14} className="text-green-600" /> : <ArrowDown size={14} className="text-red-600" />}
                <span className={`text-xs font-medium ml-1 ${summary?.netProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {netMargin}% {t('profitLossReport.margin')}
                </span>
              </div>
            </div>
            <div className={`p-2 rounded-lg ${summary?.netProfit >= 0 ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
              <TrendingUp size={24} />
            </div>
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Profit Trend */}
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">{t('profitLossReport.netProfitTrend')}</h2>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={dailyData}>
               <defs>
                <linearGradient id="colorProfit" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.8}/>
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip formatter={(value) => formatCurrency(value)} />
              <Area type="monotone" dataKey="netProfit" stroke="#10b981" fillOpacity={1} fill="url(#colorProfit)" name={t('profitLossReport.netProfit')} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Income vs Expenses Bar Chart */}
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">{t('profitLossReport.incomeVsCosts')}</h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={dailyData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip formatter={(value) => formatCurrency(value)} />
              <Legend />
              <Bar dataKey="revenue" fill="#3b82f6" name={t('profitLossReport.revenue')} stackId="a" />
              <Bar dataKey="cogs" fill="#f97316" name="COGS" stackId="b" />
              <Bar dataKey="expenses" fill="#ef4444" name={t('profitLossReport.expenses')} stackId="b" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
      
      {/* Detailed Breakdown Hint */}
      <div className="bg-blue-50 p-4 rounded-lg border border-blue-200 flex items-start gap-3">
        <div className="p-2 bg-blue-100 rounded-full text-blue-600 mt-1">
          <DollarSign size={16} />
        </div>
        <div>
        <div>
           <h4 className="font-semibold text-blue-800">{t('profitLossReport.understanding.title')}</h4>
           <div 
             className="text-sm text-blue-700 mt-1"
             dangerouslySetInnerHTML={{ __html: t('profitLossReport.understanding.text') }}
           />
        </div>
        </div>
      </div>

    </div>
  );
};

export default ProfitLossReport;
