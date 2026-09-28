import React, { useState, useEffect } from 'react';
import { 
  Package, 
  TrendingUp, 
  ShoppingCart, 
  Search, 
  Filter,
  BarChart as BarIcon,
  ArrowUp,
  ArrowDown
} from 'lucide-react';
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
import { useTranslation } from 'react-i18next';

const ProductPerformanceReport = () => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState({
    inventoryValue: 0,
    periodRevenue: 0,
    periodUnits: 0,
    topProduct: { product_name: 'N/A', revenue: 0 }
  });
  const [topProducts, setTopProducts] = useState([]);
  const [productsList, setProductsList] = useState([]);
  const [totalProducts, setTotalProducts] = useState(0);
  
  // Filters
  const [dateRange, setDateRange] = useState('thisMonth');
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [sortBy, setSortBy] = useState('revenue'); // revenue, units_sold, current_stock
  const [sortDirection, setSortDirection] = useState('DESC');

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
      const summaryRes = await window.api.getProductPerformanceSummary({ startDate, endDate });
      if (summaryRes.success) {
        setSummary(summaryRes.data);
      }

      // 2. Fetch Top Products (Chart)
      const topRes = await window.api.getTopSellingProducts({ 
        startDate, 
        endDate, 
        limit: 10,
        sortBy: 'revenue' 
      });
      if (topRes.success) {
        setTopProducts(topRes.data);
      }

      // 3. Fetch List
      const listRes = await window.api.getProductPerformanceList({
        page: currentPage,
        limit: itemsPerPage,
        searchTerm,
        startDate, 
        endDate,
        sortBy,
        sortDirection
      });
      
      if (listRes.success) {
        setProductsList(listRes.data);
        setTotalProducts(listRes.total);
      }

    } catch (error) {
      console.error('Error fetching product report:', error);
      toast.error('Failed to load product report data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [dateRange, currentPage, searchTerm, sortBy, sortDirection]);

  const handleSort = (key) => {
    if (sortBy === key) {
      setSortDirection(sortDirection === 'DESC' ? 'ASC' : 'DESC');
    } else {
      setSortBy(key);
      setSortDirection('DESC');
    }
  };

  const totalPages = Math.ceil(totalProducts / itemsPerPage);

  if (loading && !summary.inventoryValue) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 pb-24">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">{t('productReport.title')}</h1>
          <p className="text-gray-500">{t('productReport.subtitle')}</p>
        </div>
        
        <div className="flex items-center gap-3 bg-white p-1 rounded-lg border border-gray-200 shadow-sm">
          {['thisMonth', 'lastMonth', 'last30Days', 'thisYear'].map((range) => (
            <button
              key={range}
              onClick={() => setDateRange(range)}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${
                dateRange === range
                  ? 'bg-indigo-50 text-indigo-700 shadow-sm'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              {t(`common.dateRanges.${range}`)}
            </button>
          ))}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {/* Inventory Value (Static) */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 flex flex-col justify-between">
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 bg-blue-50 rounded-lg text-blue-600">
              <Package size={24} />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">{t('productReport.inventoryValue')}</p>
              <h3 className="text-2xl font-bold text-gray-800">{formatCurrency(summary.inventoryValue)}</h3>
            </div>
          </div>
          <p className="text-xs text-gray-400">{t('productReport.inventoryValueNote')}</p>
        </div>

        {/* Period Revenue */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 flex flex-col justify-between">
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 bg-green-50 rounded-lg text-green-600">
              <TrendingUp size={24} />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">{t('productReport.salesRevenue')}</p>
              <h3 className="text-2xl font-bold text-gray-800">{formatCurrency(summary.periodRevenue)}</h3>
            </div>
          </div>
          <p className="text-xs text-gray-400">{t('productReport.revenueNote')}</p>
        </div>

        {/* Period Units */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 flex flex-col justify-between">
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 bg-purple-50 rounded-lg text-purple-600">
              <ShoppingCart size={24} />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">{t('productReport.unitsSold')}</p>
              <h3 className="text-2xl font-bold text-gray-800">{summary.periodUnits}</h3>
            </div>
          </div>
          <p className="text-xs text-gray-400">{t('productReport.unitsSoldNote')}</p>
        </div>

        {/* Top Product */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 flex flex-col justify-between">
          <div>
            <p className="text-sm font-medium text-gray-500 mb-1">{t('productReport.topPerformer')}</p>
            <h3 className="text-lg font-bold text-gray-800 truncate" title={summary.topProduct.product_name}>
              {summary.topProduct.product_name || t('productReport.noSales')}
            </h3>
          </div>
          <p className="text-sm font-semibold text-indigo-600 mt-2">
            {formatCurrency(summary.topProduct.revenue)} <span className="text-xs font-normal text-gray-400">{t('productReport.inRevenue')}</span>
          </p>
        </div>
      </div>

      {/* Chart Section */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-6 flex items-center gap-2">
          <BarIcon size={18} className="text-gray-400" />
          {t('productReport.top10Products')}
        </h3>
        <div className="h-[350px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart 
              data={topProducts} 
              layout="vertical" 
              margin={{ top: 5, right: 30, left: 40, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f3f4f6" />
              <XAxis type="number" hide />
              <YAxis 
                dataKey="name" 
                type="category" 
                width={150} 
                tick={{ fontSize: 12, fill: '#6b7280' }} 
                tickLine={false}
                axisLine={false}
              />
              <Tooltip 
                cursor={{ fill: '#f9fafb' }}
                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                formatter={(value) => formatCurrency(value)}
              />
              <Bar dataKey="revenue" radius={[0, 4, 4, 0]} barSize={20}>
                {topProducts.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={index < 3 ? '#4f46e5' : '#818cf8'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Detailed List */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-6 border-b border-gray-100 flex flex-col md:flex-row justify-between items-center gap-4">
          <h3 className="text-lg font-semibold text-gray-800">{t('productReport.productList')}</h3>
          <div className="relative">
            <input
              type="text"
              placeholder={t('productReport.searchPlaceholder')}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 w-64"
            />
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th 
                  className="text-left py-3 px-6 text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
                  onClick={() => handleSort('product_name')}
                >
                  <div className="flex items-center gap-1">
                    {t('productReport.productName')}
                    {sortBy === 'product_name' && (sortDirection === 'ASC' ? <ArrowUp size={14} /> : <ArrowDown size={14} />)}
                  </div>
                </th>
                <th 
                  className="text-left py-3 px-6 text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
                  onClick={() => handleSort('current_stock')}
                >
                  <div className="flex items-center gap-1">
                    {t('productReport.currentStock')}
                    {sortBy === 'current_stock' && (sortDirection === 'ASC' ? <ArrowUp size={14} /> : <ArrowDown size={14} />)}
                  </div>
                </th>
                <th 
                  className="text-right py-3 px-6 text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
                  onClick={() => handleSort('units_sold')}
                >
                  <div className="flex items-center justify-end gap-1">
                    {t('productReport.unitsSold')}
                    {sortBy === 'units_sold' && (sortDirection === 'ASC' ? <ArrowUp size={14} /> : <ArrowDown size={14} />)}
                  </div>
                </th>
                <th 
                  className="text-right py-3 px-6 text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
                  onClick={() => handleSort('revenue')}
                >
                  <div className="flex items-center justify-end gap-1">
                    {t('productReport.revenue')}
                    {sortBy === 'revenue' && (sortDirection === 'ASC' ? <ArrowUp size={14} /> : <ArrowDown size={14} />)}
                  </div>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {productsList.length > 0 ? (
                productsList.map((product) => (
                  <tr key={product.id} className="hover:bg-gray-50 transition-colors">
                    <td className="py-3 px-6 text-sm text-gray-800 font-medium">
                      {product.product_name}
                      <span className="block text-xs text-gray-400 font-normal">{product.product_code}</span>
                    </td>
                    <td className="py-3 px-6 text-sm text-gray-600">
                      {product.current_stock} <span className="text-xs text-gray-400">{product.unit}</span>
                    </td>
                    <td className="py-3 px-6 text-sm text-gray-600 text-right">
                      {product.units_sold}
                    </td>
                    <td className="py-3 px-6 text-sm font-semibold text-indigo-600 text-right">
                      {formatCurrency(product.revenue)}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="4" className="py-8 text-center text-gray-500">
                    {t('productReport.noProductsFound')}
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
              {t('productReport.page')} {currentPage} {t('productReport.of')} {totalPages}
            </span>
            <div className="flex gap-2">
              <button
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(curr => curr - 1)}
                className="px-3 py-1 text-sm border border-gray-200 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {t('productReport.previous')}
              </button>
              <button
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(curr => curr + 1)}
                className="px-3 py-1 text-sm border border-gray-200 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {t('productReport.next')}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProductPerformanceReport;