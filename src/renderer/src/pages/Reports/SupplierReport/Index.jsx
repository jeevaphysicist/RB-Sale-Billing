import React, { useState, useEffect } from 'react';
import { 
  Truck, DollarSign, WalletCards, TrendingUp, Search, 
  ChevronLeft, ChevronRight, User, Phone, Package, Download,
  Award, ShoppingBag, Calendar, AlertTriangle, CreditCard
} from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
  PieChart, Pie, AreaChart, Area, Legend, LineChart, Line
} from 'recharts';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';

const SupplierReport = () => {
  const { t } = useTranslation();
  const [isLoading, setIsLoading] = useState(true);
  const [summary, setSummary] = useState(null);
  const [topSuppliers, setTopSuppliers] = useState([]);
  const [supplierList, setSupplierList] = useState([]);
  
  // New Analytics State
  const [growthTrends, setGrowthTrends] = useState([]);
  const [supplierSegments, setSupplierSegments] = useState([]);
  const [purchaseTrends, setPurchaseTrends] = useState([]);
  const [paymentBehavior, setPaymentBehavior] = useState(null);
  const [apvMetrics, setAPVMetrics] = useState(null);
  
  // Filters & Pagination
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, totalPages: 0, limit: 10 });

  useEffect(() => {
    fetchInitialData();
  }, []);

  useEffect(() => {
    fetchSupplierList();
  }, [currentPage, searchTerm]);

  const fetchInitialData = async () => {
    setIsLoading(true);
    try {
      if (!window.api || !window.api.getSupplierSummary) {
        console.warn('API not ready');
        setIsLoading(false);
        return;
      }
      
      const [
        summaryRes, 
        topRes,
        growthRes,
        segmentsRes,
        trendsRes,
        paymentRes,
        apvRes
      ] = await Promise.all([
        window.api.getSupplierSummary(),
        window.api.getTopSuppliers(5),
        window.api.getSupplierGrowthTrends(),
        window.api.getSupplierSegments(),
        window.api.getPurchaseTrends(),
        window.api.getSupplierPaymentBehavior(),
        window.api.getAPVMetrics()
      ]);

      if (summaryRes.success) setSummary(summaryRes.data);
      if (topRes.success) setTopSuppliers(topRes.data);
      if (growthRes.success) setGrowthTrends(growthRes.data);
      if (segmentsRes.success) setSupplierSegments(segmentsRes.data);
      if (trendsRes.success) setPurchaseTrends(trendsRes.data);
      if (paymentRes.success) setPaymentBehavior(paymentRes.data);
      if (apvRes.success) setAPVMetrics(apvRes.data);
      
      await fetchSupplierList();

    } catch (error) {
      console.error('Error initializing supplier report:', error);
      toast.error(t('supplierReport.loadFailed'));
    } finally {
      setIsLoading(false);
    }
  };

  const fetchSupplierList = async () => {
    try {
      const res = await window.api.getSupplierReportList({
        page: currentPage,
        limit: 10,
        searchTerm,
        sortBy: 'total_spent'
      });

      if (res.success) {
        setSupplierList(res.data);
        setPagination(res.pagination);
      }
    } catch (error) {
      console.error('Error fetching supplier list:', error);
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
      const headers = ['Supplier Name', 'Phone', 'Total Orders', 'Total Spent', 'Outstanding Balance', 'Last Purchase Date'];
      const csvData = [
        headers.join(','),
        ...supplierList.map(supplier => [
          supplier.name,
          supplier.phone || '',
          supplier.total_orders,
          supplier.total_spent,
          supplier.outstanding_balance,
          supplier.last_purchase_date ? new Date(supplier.last_purchase_date).toLocaleDateString('en-IN') : 'Never'
        ].join(','))
      ].join('\n');

      const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `supplier-report-${new Date().toISOString().split('T')[0]}.csv`;
      link.click();
      toast.success(t('supplierReport.exportSuccess'));
    } catch (error) {
      console.error('Export error:', error);
      toast.error(t('supplierReport.exportFailed'));
    }
  };

  const getSegmentColor = (segment) => {
    const colors = {
      'Premium': 'bg-purple-100 text-purple-700 border-purple-300',
      'Reliable': 'bg-blue-100 text-blue-700 border-blue-300',
      'Standard': 'bg-green-100 text-green-700 border-green-300',
      'New': 'bg-cyan-100 text-cyan-700 border-cyan-300',
      'At-Risk': 'bg-orange-100 text-orange-700 border-orange-300',
      'Inactive': 'bg-red-100 text-red-700 border-red-300'
    };
    return colors[segment] || 'bg-gray-100 text-gray-700 border-gray-300';
  };

  const getSegmentIcon = (segment) => {
    const icons = {
      'Premium': <Award size={18} />,
      'Reliable': <ShoppingBag size={18} />,
      'Standard': <Truck size={18} />,
      'New': <Calendar size={18} />,
      'At-Risk': <AlertTriangle size={18} />,
      'Inactive': <AlertTriangle size={18} />
    };
    return icons[segment] || <Truck size={18} />;
  };

  if (isLoading && !summary) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600"></div>
          <p className="mt-4 text-gray-600">{t('supplierReport.analyzingData')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-800">{t('supplierReport.title')}</h1>
        <p className="text-sm text-gray-600">{t('supplierReport.subtitle')}</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Total Suppliers */}
        <div className="bg-white p-5 rounded-lg shadow-sm border-l-4 border-orange-500">
           <div className="flex justify-between items-start">
            <div>
              <p className="text-gray-500 text-xs uppercase font-medium tracking-wider">{t('supplierReport.totalSuppliers')}</p>
              <h3 className="text-2xl font-bold text-gray-800 mt-1">{summary?.totalSuppliers || 0}</h3>
              <p className="text-xs text-gray-500 mt-1">{t('supplierReport.activeSupplierBase')}</p>
            </div>
            <div className="p-2 bg-orange-50 rounded-lg text-orange-600">
              <Truck size={20} />
            </div>
          </div>
        </div>

        {/* Total Purchases */}
        <div className="bg-white p-5 rounded-lg shadow-sm border-l-4 border-blue-500">
           <div className="flex justify-between items-start">
            <div>
              <p className="text-gray-500 text-xs uppercase font-medium tracking-wider">{t('supplierReport.totalPurchases')}</p>
              <h3 className="text-2xl font-bold text-gray-800 mt-1">{formatCurrency(summary?.totalPurchases)}</h3>
              <p className="text-xs text-gray-500 mt-1">{t('supplierReport.totalProcurementValue')}</p>
            </div>
            <div className="p-2 bg-blue-50 rounded-lg text-blue-600">
              <DollarSign size={20} />
            </div>
          </div>
        </div>

        {/* Total Outstanding */}
        <div className="bg-white p-5 rounded-lg shadow-sm border-l-4 border-red-500">
           <div className="flex justify-between items-start">
            <div>
              <p className="text-gray-500 text-xs uppercase font-medium tracking-wider">{t('supplierReport.totalPayables')}</p>
              <h3 className="text-2xl font-bold text-red-600 mt-1">{formatCurrency(summary?.totalOutstanding)}</h3>
              <p className="text-xs text-red-600 mt-1 font-medium">{t('supplierReport.outstandingBalances')}</p>
            </div>
            <div className="p-2 bg-red-50 rounded-lg text-red-600">
              <WalletCards size={20} />
            </div>
          </div>
        </div>
      </div>

      {/* Supplier Segmentation Cards */}
      {supplierSegments.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-gray-800 mb-3 flex items-center gap-2">
            <Truck size={18} className="text-orange-600" />
            {t('supplierReport.supplierSegmentation')}
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {supplierSegments.map((segment) => (
              <div key={segment.segment} className={`p-4 rounded-lg border-2 ${getSegmentColor(segment.segment)}`}>
                <div className="flex items-center gap-2 mb-2">
                  {getSegmentIcon(segment.segment)}
                  <span className="font-semibold text-sm">{segment.segment}</span>
                </div>
                <div className="text-2xl font-bold mb-1">{segment.count}</div>
                <div className="text-xs opacity-75">{segment.percentage}%{t('supplierReport.ofTotal')}</div>
                <div className="text-xs mt-2 pt-2 border-t border-current opacity-60">
                  {t('supplierReport.avg')}: {formatCurrency(segment.avg_spent)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Growth Trends & Purchase Volume Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Supplier Growth Trend */}
        {growthTrends.length > 0 && (
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp size={18} className="text-green-600" />
              <h2 className="text-lg font-semibold text-gray-800">{t('supplierReport.supplierGrowth')}</h2>
            </div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={growthTrends} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                  <defs>
                    <linearGradient id="colorGrowthSupplier" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" tick={{fontSize: 11}} />
                  <YAxis tick={{fontSize: 11}} />
                  <Tooltip />
                  <Area type="monotone" dataKey="new_suppliers" stroke="#10b981" fillOpacity={1} fill="url(#colorGrowthSupplier)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Purchase Volume Trends */}
        {purchaseTrends.length > 0 && (
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <div className="flex items-center gap-2 mb-4">
              <ShoppingBag size={18} className="text-blue-600" />
              <h2 className="text-lg font-semibold text-gray-800">{t('supplierReport.purchaseTrends')}</h2>
            </div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={purchaseTrends} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" tick={{fontSize: 11}} />
                  <YAxis tick={{fontSize: 11}} />
                  <Tooltip formatter={(value) => formatCurrency(value)} />
                  <Bar dataKey="total_amount" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>

      {/* Average Purchase Value */}
      {apvMetrics && (
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center gap-2 mb-4">
            <DollarSign size={18} className="text-purple-600" />
            <h2 className="text-lg font-semibold text-gray-800">{t('supplierReport.avgPurchaseValue')}</h2>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="text-center">
              <div className="text-4xl font-bold text-purple-600">
                {formatCurrency(apvMetrics.overall.overall_apv)}
              </div>
              <div className="text-sm text-gray-500 mt-1">
                {t('supplierReport.across')} {apvMetrics.overall.total_orders} {t('supplierReport.orders')}
              </div>
            </div>
            {apvMetrics.monthlyTrend.length > 0 && (
              <div className="h-40">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={apvMetrics.monthlyTrend} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" tick={{fontSize: 10}} />
                    <YAxis hide />
                    <Tooltip formatter={(value) => formatCurrency(value)} />
                    <Line type="monotone" dataKey="apv" stroke="#9333ea" strokeWidth={2} dot={{ r: 4 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Payment Behavior */}
      {paymentBehavior && paymentBehavior.paymentMethods.length > 0 && (
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center gap-2 mb-4">
            <CreditCard size={18} className="text-indigo-600" />
            <h2 className="text-lg font-semibold text-gray-800">{t('supplierReport.paymentBehavior')}</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Payment Method Pie Chart */}
            <div>
              <h3 className="text-sm font-medium text-gray-600 mb-3">{t('supplierReport.paymentMethodDistribution')}</h3>
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
              <h3 className="text-sm font-medium text-gray-600 mb-4">{t('supplierReport.payablesOutstanding')}</h3>
              <div className="space-y-4">
                <div className="p-4 bg-red-50 rounded-lg border border-red-200">
                  <div className="text-sm text-red-600 font-medium">{t('supplierReport.suppliersWithPayables')}</div>
                  <div className="text-2xl font-bold text-red-700 mt-1">
                    {paymentBehavior.outstanding.suppliers_with_payables || 0}
                  </div>
                </div>
                <div className="p-4 bg-orange-50 rounded-lg border border-orange-200">
                  <div className="text-sm text-orange-600 font-medium">{t('supplierReport.totalOutstandingAmount')}</div>
                  <div className="text-2xl font-bold text-orange-700 mt-1">
                    {formatCurrency(paymentBehavior.outstanding.total_outstanding)}
                  </div>
                </div>
                <div className="p-4 bg-yellow-50 rounded-lg border border-yellow-200">
                  <div className="text-sm text-yellow-600 font-medium">{t('supplierReport.averageOutstanding')}</div>
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
        {/* Top Suppliers Chart */}
        <div className="lg:col-span-1 bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp size={18} className="text-orange-600" />
            <h2 className="text-lg font-semibold text-gray-800">{t('supplierReport.topSuppliers')}</h2>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topSuppliers} layout="vertical" margin={{ top: 5, right: 30, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
                <XAxis type="number" hide />
                <YAxis dataKey="name" type="category" width={80} tick={{fontSize: 12}} />
                <Tooltip formatter={(value) => formatCurrency(value)} />
                <Bar dataKey="total_spent" fill="#ea580c" radius={[0, 4, 4, 0]} barSize={20}>
                  {topSuppliers.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={index === 0 ? '#c2410c' : '#fb923c'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Supplier List Table */}
        <div className="lg:col-span-2 bg-white rounded-lg shadow-sm border border-gray-200 flex flex-col">
          <div className="p-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-800">{t('supplierReport.supplierDirectory')}</h2>
            <div className="flex items-center gap-3">
              <button
                onClick={exportToCSV}
                className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors text-sm font-medium"
              >
                <Download size={16} />
                {t('supplierReport.exportCSV')}
              </button>
              <div className="relative w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                <input 
                  type="text"
                  placeholder={t('supplierReport.searchSuppliers')}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>
            </div>
          </div>
          
          <div className="overflow-x-auto flex-1">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 text-gray-600 text-xs uppercase tracking-wider">
                  <th className="p-4 font-semibold border-b">{t('supplierReport.supplier')}</th>
                  <th className="p-4 font-semibold border-b text-center">{t('supplierReport.orders')}</th>
                  <th className="p-4 font-semibold border-b text-right">{t('supplierReport.totalPurchased')}</th>
                  <th className="p-4 font-semibold border-b text-right">{t('supplierReport.payables')}</th>
                  <th className="p-4 font-semibold border-b text-center">{t('supplierReport.lastPurchase')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {supplierList.length > 0 ? (
                  supplierList.map(supplier => (
                    <tr key={supplier.id} className="hover:bg-gray-50 transition-colors">
                      <td className="p-4">
                        <div className="flex items-start gap-3">
                          <div className="p-2 bg-gray-100 rounded-full text-gray-500">
                            <Truck size={16} />
                          </div>
                          <div>
                            <div className="font-medium text-gray-800">{supplier.name}</div>
                            {supplier.phone && (
                              <div className="flex items-center gap-1 text-xs text-gray-500 mt-0.5">
                                <Phone size={10} />
                                {supplier.phone}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="p-4 text-center text-sm text-gray-600">
                        {supplier.total_orders}
                      </td>
                      <td className="p-4 text-right font-medium text-gray-800">
                        {formatCurrency(supplier.total_spent)}
                      </td>
                      <td className="p-4 text-right">
                        {supplier.outstanding_balance > 0 ? (
                           <span className="font-bold text-red-600 bg-red-50 px-2 py-1 rounded">
                             {formatCurrency(supplier.outstanding_balance)}
                           </span>
                        ) : (
                           <span className="text-gray-400 text-sm">-</span>
                        )}
                      </td>
                       <td className="p-4 text-center text-xs text-gray-500">
                        {supplier.last_purchase_date 
                          ? new Date(supplier.last_purchase_date).toLocaleDateString('en-IN') 
                          : t('supplierReport.never')}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="5" className="p-8 text-center text-gray-500">{t('supplierReport.noSuppliersFound')}</td>
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
                  {t('supplierReport.prev')}
                </button>
                <span className="text-sm text-gray-600">
                  {t('supplierReport.page')} {currentPage} {t('supplierReport.of')} {pagination.totalPages}
                </span>
                <button 
                  onClick={() => setCurrentPage(p => Math.min(pagination.totalPages, p + 1))}
                  disabled={currentPage === pagination.totalPages}
                  className="p-1 px-3 border rounded hover:bg-gray-50 disabled:opacity-50 text-sm"
                >
                  {t('supplierReport.next')}
                </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SupplierReport;