import React, { useState, useEffect } from 'react';
import {
  Users, DollarSign, WalletCards, TrendingUp, Search,
  ChevronLeft, ChevronRight, User, Phone, AlertTriangle,
  Download, Award, ShoppingBag, CreditCard, Calendar
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
  PieChart, Pie, AreaChart, Area, Legend, LineChart, Line
} from 'recharts';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';

const CustomerReport = () => {
  const { t } = useTranslation();
  const [isLoading, setIsLoading] = useState(true);
  const [summary, setSummary] = useState(null);
  const [topCustomers, setTopCustomers] = useState([]);
  const [customerList, setCustomerList] = useState([]);

  // New Analytics State
  const [growthTrends, setGrowthTrends] = useState([]);
  const [atRiskCustomers, setAtRiskCustomers] = useState([]);
  const [customerSegments, setCustomerSegments] = useState([]);
  const [paymentBehavior, setPaymentBehavior] = useState(null);
  const [aovMetrics, setAOVMetrics] = useState(null);

  // Filters & Pagination
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, totalPages: 0, limit: 10 });

  useEffect(() => {
    fetchInitialData();
  }, []);

  useEffect(() => {
    fetchCustomerList();
  }, [currentPage, searchTerm]);

  const fetchInitialData = async () => {
    setIsLoading(true);
    try {
      if (!window.api || !window.api.getCustomerSummary) {
        console.warn('API not ready');
        setIsLoading(false);
        return;
      }

      const [
        summaryRes,
        topRes,
        growthRes,
        atRiskRes,
        segmentsRes,
        paymentRes,
        aovRes
      ] = await Promise.all([
        window.api.getCustomerSummary(),
        window.api.getTopCustomers(5),
        window.api.getCustomerGrowthTrends(),
        window.api.getAtRiskCustomers({ days: 60, limit: 10 }),
        window.api.getCustomerSegments(),
        window.api.getPaymentBehavior(),
        window.api.getAOVMetrics()
      ]);

      if (summaryRes.success) setSummary(summaryRes.data);
      if (topRes.success) setTopCustomers(topRes.data);
      if (growthRes.success) setGrowthTrends(growthRes.data);
      if (atRiskRes.success) setAtRiskCustomers(atRiskRes.data);
      if (segmentsRes.success) setCustomerSegments(segmentsRes.data);
      if (paymentRes.success) setPaymentBehavior(paymentRes.data);
      if (aovRes.success) setAOVMetrics(aovRes.data);

      await fetchCustomerList();

    } catch (error) {
      console.error('Error initializing customer report:', error);
      toast.error(t('customerReport.loadFailed'));
    } finally {
      setIsLoading(false);
    }
  };

  const fetchCustomerList = async () => {
    try {
      const res = await window.api.getCustomerList({
        page: currentPage,
        limit: 10,
        searchTerm,
        sortBy: 'total_spent' // Default sort
      });

      if (res.success) {
        setCustomerList(res.data);
        setPagination(res.pagination);
      }
    } catch (error) {
      console.error('Error fetching customer list:', error);
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

  const exportToCSV = () => {
    try {
      const headers = ['Customer Name', 'Phone', 'Email', 'Total Sales', 'Total Spent', 'Outstanding Balance', 'Last Purchase Date'];
      const csvData = [
        headers.join(','),
        ...customerList.map(customer => [
          customer.name,
          customer.phone || '',
          customer.email || '',
          customer.total_orders,
          customer.total_spent,
          customer.outstanding_balance,
          customer.last_purchase_date ? new Date(customer.last_purchase_date).toLocaleDateString('en-IN') : 'Never'
        ].join(','))
      ].join('\n');

      const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `customer-report-${new Date().toISOString().split('T')[0]}.csv`;
      link.click();
      toast.success(t('customerReport.exportSuccess'));
    } catch (error) {
      console.error('Export error:', error);
      toast.error(t('customerReport.exportFailed'));
    }
  };

  const getSegmentColor = (segment) => {
    const colors = {
      'VIP': 'bg-purple-100 text-purple-700 border-purple-300',
      'Loyal': 'bg-blue-100 text-blue-700 border-blue-300',
      'Regular': 'bg-green-100 text-green-700 border-green-300',
      'New': 'bg-cyan-100 text-cyan-700 border-cyan-300',
      'At-Risk': 'bg-orange-100 text-orange-700 border-orange-300',
      'Lost': 'bg-red-100 text-red-700 border-red-300'
    };
    return colors[segment] || 'bg-gray-100 text-gray-700 border-gray-300';
  };

  const getSegmentIcon = (segment) => {
    const icons = {
      'VIP': <Award size={18} />,
      'Loyal': <ShoppingBag size={18} />,
      'Regular': <User size={18} />,
      'New': <Calendar size={18} />,
      'At-Risk': <AlertTriangle size={18} />,
      'Lost': <AlertTriangle size={18} />
    };
    return icons[segment] || <User size={18} />;
  };

  if (isLoading && !summary) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
          <p className="mt-4 text-gray-600">{t('customerReport.analyzingData')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-800">{t('customerReport.title')}</h1>
        <p className="text-sm text-gray-600">{t('customerReport.subtitle')}</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Total Customers */}
        <div className="bg-white p-5 rounded-lg shadow-sm border-l-4 border-indigo-500">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-gray-500 text-xs uppercase font-medium tracking-wider">{t('customerReport.totalCustomers')}</p>
              <h3 className="text-2xl font-bold text-gray-800 mt-1">{summary?.totalCustomers || 0}</h3>
              <p className="text-xs text-gray-500 mt-1">{t('customerReport.activeCustomerBase')}</p>
            </div>
            <div className="p-2 bg-indigo-50 rounded-lg text-indigo-600">
              <Users size={20} />
            </div>
          </div>
        </div>

        {/* Total Revenue */}
        <div className="bg-white p-5 rounded-lg shadow-sm border-l-4 border-green-500">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-gray-500 text-xs uppercase font-medium tracking-wider">{t('customerReport.totalRevenue')}</p>
              <h3 className="text-2xl font-bold text-gray-800 mt-1">{formatCurrency(summary?.totalRevenue)}</h3>
              <p className="text-xs text-gray-500 mt-1">{t('customerReport.lifetimeValue')}</p>
            </div>
            <div className="p-2 bg-green-50 rounded-lg text-green-600">
              <DollarSign size={20} />
            </div>
          </div>
        </div>

        {/* Total Outstanding */}
        <div className="bg-white p-5 rounded-lg shadow-sm border-l-4 border-red-500">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-gray-500 text-xs uppercase font-medium tracking-wider">{t('customerReport.totalReceivables')}</p>
              <h3 className="text-2xl font-bold text-red-600 mt-1">{formatCurrency(summary?.totalOutstanding)}</h3>
              <p className="text-xs text-red-600 mt-1 font-medium">{t('customerReport.outstandingBalances')}</p>
            </div>
            <div className="p-2 bg-red-50 rounded-lg text-red-600">
              <WalletCards size={20} />
            </div>
          </div>
        </div>
      </div>

      {/* Customer Segmentation Cards */}
      {customerSegments.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-gray-800 mb-3 flex items-center gap-2">
            <Users size={18} className="text-indigo-600" />
            {t('customerReport.customerSegmentation')}
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {customerSegments.map((segment) => (
              <div key={segment.segment} className={`p-4 rounded-lg border-2 ${getSegmentColor(segment.segment)}`}>
                <div className="flex items-center gap-2 mb-2">
                  {getSegmentIcon(segment.segment)}
                  <span className="font-semibold text-sm">{segment.segment}</span>
                </div>
                <div className="text-2xl font-bold mb-1">{segment.count}</div>
                <div className="text-xs opacity-75">{segment.percentage}{t('customerReport.ofTotal')}</div>
                <div className="text-xs mt-2 pt-2 border-t border-current opacity-60">
                  {t('customerReport.avg')}: {formatCurrency(segment.avg_revenue)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* At-Risk Customers Alert */}
      {atRiskCustomers.length > 0 && (
        <div className="bg-orange-50 border-l-4 border-orange-500 p-4 rounded-lg">
          <div className="flex items-start gap-3">
            <AlertTriangle className="text-orange-600 mt-1" size={20} />
            <div className="flex-1">
              <h3 className="font-semibold text-orange-900 mb-2">⚠️ {t('customerReport.atRiskCustomers')} ({atRiskCustomers.length})</h3>
              <p className="text-sm text-orange-800 mb-3">{t('customerReport.atRiskDescription')}</p>
              <div className="bg-white rounded-lg overflow-hidden border border-orange-200">
                <table className="w-full text-sm">
                  <thead className="bg-orange-100">
                    <tr className="text-orange-900">
                      <th className="p-2 text-left font-semibold">{t('customerReport.customer')}</th>
                      <th className="p-2 text-center font-semibold">{t('customerReport.lastPurchase')}</th>
                      <th className="p-2 text-center font-semibold">{t('customerReport.daysAgo')}</th>
                      <th className="p-2 text-right font-semibold">Lifetime Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {atRiskCustomers.slice(0, 5).map((customer) => (
                      <tr key={customer.id} className="border-t border-orange-100 hover:bg-orange-50">
                        <td className="p-2">
                          <div className="font-medium text-gray-900">{customer.name}</div>
                          <div className="text-xs text-gray-500">{customer.phone}</div>
                        </td>
                        <td className="p-2 text-center text-gray-700">
                          {new Date(customer.last_purchase_date).toLocaleDateString('en-IN')}
                        </td>
                        <td className="p-2 text-center">
                          <span className="bg-orange-200 text-orange-900 px-2 py-1 rounded text-xs font-semibold">
                            {customer.days_since_purchase} {t('customerReport.days')}
                          </span>
                        </td>
                        <td className="p-2 text-right font-medium text-gray-900">
                          {formatCurrency(customer.total_spent)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Growth Trends & AOV Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Customer Growth Trend */}
        {growthTrends.length > 0 && (
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp size={18} className="text-green-600" />
              <h2 className="text-lg font-semibold text-gray-800">{t('customerReport.customerGrowth')}</h2>
            </div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={growthTrends} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                  <defs>
                    <linearGradient id="colorGrowth" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Area type="monotone" dataKey="new_customers" stroke="#10b981" fillOpacity={1} fill="url(#colorGrowth)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Average Order Value */}
        {aovMetrics && (
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <div className="flex items-center gap-2 mb-4">
              <DollarSign size={18} className="text-blue-600" />
              <h2 className="text-lg font-semibold text-gray-800">{t('customerReport.avgOrderValue')}</h2>
            </div>
            <div className="text-center mb-4">
              <div className="text-4xl font-bold text-blue-600">
                {formatCurrency(aovMetrics.overall.overall_aov)}
              </div>
              <div className="text-sm text-gray-500 mt-1">
                {t('customerReport.across')} {aovMetrics.overall.total_orders} {t('customerReport.orders')}
              </div>
            </div>
            {aovMetrics.monthlyTrend.length > 0 && (
              <div className="h-40">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={aovMetrics.monthlyTrend} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                    <YAxis hide />
                    <Tooltip formatter={(value) => formatCurrency(value)} />
                    <Line type="monotone" dataKey="aov" stroke="#3b82f6" strokeWidth={2} dot={{ r: 4 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Payment Behavior */}
      {paymentBehavior && paymentBehavior.paymentMethods.length > 0 && (
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center gap-2 mb-4">
            <CreditCard size={18} className="text-purple-600" />
            <h2 className="text-lg font-semibold text-gray-800">{t('customerReport.paymentBehavior')}</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Payment Method Pie Chart */}
            <div>
              <h3 className="text-sm font-medium text-gray-600 mb-3">{t('customerReport.paymentMethodDistribution')}</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={paymentBehavior.paymentMethods}
                      dataKey="transaction_count"
                      nameKey="payment_method"
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      label={({ payment_method, percentage }) => `${payment_method} (${percentage}%)`}
                      labelLine={false}
                    >
                      {paymentBehavior.paymentMethods.map((entry, index) => {
                        const colors = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];
                        return <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />;
                      })}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Outstanding Summary */}
            <div className="flex flex-col justify-center">
              <h3 className="text-sm font-medium text-gray-600 mb-4">{t('customerReport.creditOutstanding')}</h3>
              <div className="space-y-4">
                <div className="p-4 bg-red-50 rounded-lg border border-red-200">
                  <div className="text-sm text-red-600 font-medium">{t('customerReport.customersWithOutstanding')}</div>
                  <div className="text-2xl font-bold text-red-700 mt-1">
                    {paymentBehavior.outstanding.customers_with_outstanding || 0}
                  </div>
                </div>
                <div className="p-4 bg-orange-50 rounded-lg border border-orange-200">
                  <div className="text-sm text-orange-600 font-medium">{t('customerReport.totalOutstandingAmount')}</div>
                  <div className="text-2xl font-bold text-orange-700 mt-1">
                    {formatCurrency(paymentBehavior.outstanding.total_outstanding)}
                  </div>
                </div>
                <div className="p-4 bg-yellow-50 rounded-lg border border-yellow-200">
                  <div className="text-sm text-yellow-600 font-medium">{t('customerReport.averageOutstanding')}</div>
                  <div className="text-2xl font-bold text-yellow-700 mt-1">
                    {formatCurrency(paymentBehavior.outstanding.avg_outstanding)}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Top Customers Chart */}
        <div className="lg:col-span-1 bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp size={18} className="text-indigo-600" />
            <h2 className="text-lg font-semibold text-gray-800">{t('customerReport.topCustomers')}</h2>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topCustomers} layout="vertical" margin={{ top: 5, right: 30, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
                <XAxis type="number" hide />
                <YAxis dataKey="name" type="category" width={80} tick={{ fontSize: 12 }} />
                <Tooltip formatter={(value) => formatCurrency(value)} />
                <Bar dataKey="total_spent" fill="#6366f1" radius={[0, 4, 4, 0]} barSize={20}>
                  {topCustomers.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={index === 0 ? '#4f46e5' : '#818cf8'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Customer List Table */}
        <div className="lg:col-span-2 bg-white rounded-lg shadow-sm border border-gray-200 flex flex-col">
          <div className="p-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-800">{t('customerReport.customerDirectory')}</h2>
            <div className="flex items-center gap-3">
              <button
                onClick={exportToCSV}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm font-medium"
              >
                <Download size={16} />
                {t('customerReport.exportCSV')}
              </button>
              <div className="relative w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                <input
                  type="text"
                  placeholder={t('customerReport.searchCustomers')}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>
          </div>

          <div className="overflow-x-auto flex-1">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 text-gray-600 text-xs uppercase tracking-wider">
                  <th className="p-4 font-semibold border-b">Customer</th>
                  <th className="p-4 font-semibold border-b text-center">{t('customerReport.orders')}</th>
                  <th className="p-4 font-semibold border-b text-right">{t('customerReport.totalSpent')}</th>
                  <th className="p-4 font-semibold border-b text-right">{t('customerReport.outstanding')}</th>
                  <th className="p-4 font-semibold border-b text-center">{t('customerReport.lastPurchaseDate')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {customerList.length > 0 ? (
                  customerList.map(customer => (
                    <tr key={customer.id} className="hover:bg-gray-50 transition-colors">
                      <td className="p-4">
                        <div className="flex items-start gap-3">
                          <div className="p-2 bg-gray-100 rounded-full text-gray-500">
                            <User size={16} />
                          </div>
                          <div>
                            <div className="font-medium text-gray-800">{customer.name}</div>
                            {customer.phone && (
                              <div className="flex items-center gap-1 text-xs text-gray-500 mt-0.5">
                                <Phone size={10} />
                                {customer.phone}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="p-4 text-center text-sm text-gray-600">
                        {customer.total_orders}
                      </td>
                      <td className="p-4 text-right font-medium text-gray-800">
                        {formatCurrency(customer.total_spent)}
                      </td>
                      <td className="p-4 text-right">
                        {customer.outstanding_balance > 0 ? (
                          <span className="font-bold text-red-600 bg-red-50 px-2 py-1 rounded">
                            {formatCurrency(customer.outstanding_balance)}
                          </span>
                        ) : (
                          <span className="text-gray-400 text-sm">-</span>
                        )}
                      </td>
                      <td className="p-4 text-center text-xs text-gray-500">
                        {customer.last_purchase_date
                          ? new Date(customer.last_purchase_date).toLocaleDateString('en-IN')
                          : t('customerReport.never')}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="5" className="p-8 text-center text-gray-500">{t('customerReport.noCustomersFound')}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className="p-4 border-t border-gray-100 flex items-center justify-end gap-2">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="p-1 px-3 border rounded hover:bg-gray-50 disabled:opacity-50 text-sm"
              >
                {t('customerReport.prev')}
              </button>
              <span className="text-sm text-gray-600">
                {t('customerReport.page')} {currentPage} of {pagination.totalPages}
              </span>
              <button
                onClick={() => setCurrentPage(p => Math.min(pagination.totalPages, p + 1))}
                disabled={currentPage === pagination.totalPages}
                className="p-1 px-3 border rounded hover:bg-gray-50 disabled:opacity-50 text-sm"
              >
                {t('customerReport.next')}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CustomerReport;