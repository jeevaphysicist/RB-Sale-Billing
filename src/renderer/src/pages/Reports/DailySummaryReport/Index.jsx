import React, { useState, useEffect } from 'react';
import { 
  Calendar, 
  DollarSign, 
  ShoppingBag, 
  CreditCard,
  TrendingUp,
  Clock,
  Wallet,
  AlertCircle
} from 'lucide-react';
import { useTranslation, Trans } from 'react-i18next';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Cell
} from 'recharts';
import { toast } from 'sonner';

const DailySummaryReport = () => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date().toLocaleDateString('en-CA')); // YYYY-MM-DD in local time
  const [summary, setSummary] = useState({
    date: '',
    sales: { orders: 0, revenue: 0, discount: 0, itemsSold: 0 },
    collections: { Cash: 0, Card: 0, UPI: 0, Total: 0 },
    expenses: 0,
    netCash: 0
  });
  const [hourlyData, setHourlyData] = useState([]);

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(amount);
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      
      const [summaryRes, hourlyRes] = await Promise.all([
        window.api.getDailySummary(selectedDate),
        window.api.getDailyHourlyTrend(selectedDate)
      ]);

      if (summaryRes.success) {
        setSummary(summaryRes.data);
      }

      if (hourlyRes.success) {
        // Format hourly data for chart with hour ranges (9-10, 10-11, etc.)
        const formatted = hourlyRes.data.map(item => {
          const hourNum = parseInt(item.hour, 10);
          const nextHour = hourNum + 1;
          return {
            ...item,
            hourLabel: `${hourNum}-${nextHour}`
          };
        });
        setHourlyData(formatted);
      }

    } catch (error) {
      console.error('Error fetching daily report:', error);
      toast.error('Failed to load daily report data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [selectedDate]);

  const CollectionCard = ({ title, amount, icon: Icon, colorClass, bgClass }) => (
    <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex items-center justify-between">
      <div>
        <p className="text-gray-500 text-sm font-medium">{title}</p>
        <h3 className="text-xl font-bold text-gray-800 mt-1">{formatCurrency(amount)}</h3>
      </div>
      <div className={`p-3 rounded-lg ${bgClass} ${colorClass}`}>
        <Icon size={20} />
      </div>
    </div>
  );

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 pb-24">
      {/* Header & Date Picker */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">{t('dailyReport.title')}</h1>
          <p className="text-gray-500">{t('dailyReport.subtitle')}</p>
        </div>
        
        <div className="flex items-center gap-2 bg-white p-2 rounded-lg border border-gray-200 shadow-sm">
          <Calendar size={18} className="text-gray-500 ml-2" />
          <input 
            type="date" 
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="border-none focus:ring-0 text-sm font-medium text-gray-700 bg-transparent outline-none"
          />
        </div>
      </div>

      {/* Main KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {/* Total Revenue */}
        <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm relative overflow-hidden">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-emerald-50 text-emerald-600 rounded-lg">
              <DollarSign size={24} />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">{t('dailyReport.totalRevenue')}</p>
              <h3 className="text-2xl font-bold text-emerald-600">{formatCurrency(summary.sales.revenue)}</h3>
            </div>
          </div>
          <div className="mt-4 text-xs text-gray-400">
            {summary.sales.orders} {t('dailyReport.orders')} • {summary.sales.itemsSold} {t('dailyReport.items')}
          </div>
        </div>

        {/* Total Expenses */}
        <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
           <div className="flex items-center gap-4">
            <div className="p-3 bg-rose-50 text-rose-600 rounded-lg">
              <Wallet size={24} />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">{t('dailyReport.expenses')}</p>
              <h3 className="text-2xl font-bold text-rose-600">{formatCurrency(summary.expenses)}</h3>
            </div>
          </div>
          <div className="mt-4 text-xs text-gray-400">
            {t('dailyReport.operationalCosts')}
          </div>
        </div>

        {/* Net Cash Flow */}
        <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
           <div className="flex items-center gap-4">
            <div className={`p-3 rounded-lg ${summary.netCash >= 0 ? 'bg-blue-50 text-blue-600' : 'bg-amber-50 text-amber-600'}`}>
              <TrendingUp size={24} />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">{t('dailyReport.netCashInHand')}</p>
              <h3 className={`text-2xl font-bold ${summary.netCash >= 0 ? 'text-blue-600' : 'text-amber-600'}`}>
                {formatCurrency(summary.netCash)}
              </h3>
            </div>
          </div>
          <div className="mt-4 text-xs text-gray-400">
            {t('dailyReport.collectionsMinusExpenses')}
          </div>
        </div>
        
        {/* Avg Order Value */}
        <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
           <div className="flex items-center gap-4">
            <div className="p-3 bg-purple-50 text-purple-600 rounded-lg">
              <ShoppingBag size={24} />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">{t('dailyReport.avgOrderValue')}</p>
              <h3 className="text-2xl font-bold text-gray-800">
                {formatCurrency(summary.sales.orders ? summary.sales.revenue / summary.sales.orders : 0)}
              </h3>
            </div>
          </div>
          <div className="mt-4 text-xs text-gray-400">
            {t('dailyReport.perTransaction')}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Payment Collections Breakdown */}
        <div className="lg:col-span-1 space-y-6">
          <h3 className="text-lg font-semibold text-gray-800">{t('dailyReport.paymentCollections')}</h3>
          <div className="grid gap-4">
            <CollectionCard 
              title={t('dailyReport.cashCollected')}
              amount={summary.collections.Cash} 
              icon={DollarSign}
              bgClass="bg-green-50"
              colorClass="text-green-600"
            />
            <CollectionCard 
              title={t('dailyReport.upiPayments')}
              amount={summary.collections.UPI} 
              icon={CreditCard} // Using Generic card icon for UPI
              bgClass="bg-orange-50"
              colorClass="text-orange-600"
            />
            <CollectionCard 
              title={t('dailyReport.cardPayments')}
              amount={summary.collections.Card} 
              icon={CreditCard}
              bgClass="bg-blue-50"
              colorClass="text-blue-600"
            />
             <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 flex items-center justify-between">
              <p className="text-gray-600 font-semibold">{t('dailyReport.totalCollected')}</p>
              <p className="text-gray-800 font-bold text-lg">{formatCurrency(summary.collections.Total)}</p>
            </div>
          </div>

          <div className="bg-amber-50 rounded-lg p-4 border border-amber-100 flex gap-3">
             <AlertCircle className="text-amber-600 shrink-0 mt-0.5" size={18} />
             <div>
               <h4 className="text-sm font-semibold text-amber-800">{t('dailyReport.reconciliationTip')}</h4>
               <p className="text-xs text-amber-700 mt-1">
                 <Trans i18nKey="dailyReport.reconciliationText" values={{ amount: formatCurrency(summary.netCash) }}>
                   Ensure your physical cash drawer has exactly <strong>{formatCurrency(summary.netCash)}</strong> (Opening + Sales - Expenses).
                 </Trans>
               </p>
             </div>
          </div>
        </div>

        {/* Hourly Trend Chart */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-100 shadow-sm p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-6 flex items-center gap-2">
            <Clock size={18} className="text-gray-400" />
            {t('dailyReport.hourlySalesPerformance')}
          </h3>
          
          {hourlyData.length > 0 ? (
            <div className="h-[350px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={hourlyData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                  <XAxis dataKey="hourLabel" stroke="#9ca3af" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis yAxisId="left" stroke="#9ca3af" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `₹${value/1000}k`} />
                  <YAxis yAxisId="right" orientation="right" stroke="#9ca3af" fontSize={12} tickLine={false} axisLine={false} hide />
                  <Tooltip 
                    cursor={{ fill: '#f3f4f6' }}
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                    formatter={(value, name) => [name === 'revenue' ? formatCurrency(value) : value, name === 'revenue' ? t('dailyReport.revenue') : t('dailyReport.orders')]}
                  />
                  <Bar yAxisId="left" dataKey="revenue" name="revenue" fill="#10b981" radius={[4, 4, 0, 0]} barSize={40} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-[350px] flex items-center justify-center text-gray-400">
              {t('dailyReport.noSalesData')}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DailySummaryReport;