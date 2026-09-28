import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { format, subDays, startOfWeek, startOfMonth, startOfYear, parse } from 'date-fns';
import { Download, Calendar, Search, TrendingUp, AlertTriangle, Package } from 'lucide-react';
import * as XLSX from 'xlsx';
import { toast } from 'sonner';

const WastageReport = () => {
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
  const [detailedReport, setDetailedReport] = useState({ items: [], totalCount: 0, totalPages: 0 });
  const [isLoading, setIsLoading] = useState(true);

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

  // Fetch data when dates change
  useEffect(() => {
    if (startDate && endDate) {
      fetchData();
    }
  }, [startDate, endDate, debouncedSearchTerm, currentPage]);

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
      const filters = { 
        startDate, 
        endDate,
        searchTerm: debouncedSearchTerm,
        page: currentPage,
        pageSize
      };

      const [summaryRes, detailedRes] = await Promise.all([
        window.api.getWastageReportSummary({ startDate, endDate }),
        window.api.getWastageReportDetailed(filters)
      ]);

      if (summaryRes.success) setSummary(summaryRes.data);
      if (detailedRes.success) setDetailedReport(detailedRes.data);
    } catch (error) {
      console.error('Error fetching wastage report data:', error);
      toast.error(t('wastageReport.messages.loadFailed'));
    } finally {
      setIsLoading(false);
    }
  };

  const exportToExcel = () => {
    try {
      const exportData = detailedReport.items.map(item => ({
        [t('wastageReport.table.date')]: item.wastage_date,
        [t('wastageReport.table.product')]: item.product_name,
        [t('wastageReport.table.category')]: item.category,
        [t('wastageReport.table.wastageQty')]: item.wastage_qty,
        [t('wastageReport.table.reason')]: item.reason,
        [t('wastageReport.table.createdBy')]: item.created_by,
        [t('wastageReport.table.unitCost')]: item.unit_price,
        [t('wastageReport.table.wastageValue')]: item.wastage_value
      }));

      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Wastage Report');

      // Auto-fit columns
      const maxWidth = exportData.reduce((w, r) => Math.max(w, Object.keys(r).length), 10);
      ws['!cols'] = Array(maxWidth).fill({ wch: 15 });

      const filename = `Wastage_Report_${startDate}_to_${endDate}.xlsx`;
      XLSX.writeFile(wb, filename);
      toast.success(t('wastageReport.messages.exportSuccess'));
    } catch (error) {
      console.error('Error exporting to Excel:', error);
      toast.error(t('wastageReport.messages.exportFailed'));
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">{t('wastageReport.title')}</h1>
          <p className="text-sm text-gray-600">{t('wastageReport.subtitle')}</p>
        </div>
        <button
          onClick={exportToExcel}
          className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
        >
          <Download size={18} />
          <span>{t('wastageReport.exportToExcel')}</span>
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
              <option value="today">{t('wastageReport.dateRanges.today')}</option>
              <option value="yesterday">{t('wastageReport.dateRanges.yesterday')}</option>
              <option value="thisWeek">{t('wastageReport.dateRanges.thisWeek')}</option>
              <option value="thisMonth">{t('wastageReport.dateRanges.thisMonth')}</option>
              <option value="thisYear">{t('wastageReport.dateRanges.thisYear')}</option>
              <option value="custom">{t('wastageReport.dateRanges.custom')}</option>
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
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-gradient-to-br from-red-500 to-red-600 p-6 rounded-lg shadow-lg text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-red-100 text-sm">{t('wastageReport.totalWastageValue')}</p>
              <p className="text-2xl font-bold mt-1">{formatCurrency(summary?.totalWastageValue)}</p>
            </div>
            <TrendingUp size={40} className="opacity-30" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-orange-500 to-orange-600 p-6 rounded-lg shadow-lg text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-orange-100 text-sm">{t('wastageReport.totalWastageQty')}</p>
              <p className="text-2xl font-bold mt-1">{summary?.totalWastageQty ? summary.totalWastageQty.toFixed(3) : '0.000'}</p>
            </div>
            <AlertTriangle size={40} className="opacity-30" />
          </div>
        </div>

        {/* <div className="bg-gradient-to-br from-blue-500 to-blue-600 p-6 rounded-lg shadow-lg text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-blue-100 text-sm">{t('wastageReport.totalItemsWasted')}</p>
              <p className="text-2xl font-bold mt-1">{summary?.totalItems || 0}</p>
            </div>
            <Package size={40} className="opacity-30" />
          </div>
        </div> */}
      </div>

      {/* Data Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-800">{t('wastageReport.detailedReport')}</h2>
            
            <div className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg w-64 bg-gray-50">
              <Search size={18} className="text-gray-500" />
              <input
                type="text"
                placeholder={t('wastageReport.searchPlaceholder')}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="flex-1 outline-none bg-transparent"
              />
            </div>
          </div>
          
          {isLoading ? (
            <div className="flex justify-center p-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200 bg-gray-50">
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">{t('wastageReport.table.date')}</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">{t('wastageReport.table.product')}</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">{t('wastageReport.table.category')}</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase">{t('wastageReport.table.wastageQty')}</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">{t('wastageReport.table.reason')}</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">{t('wastageReport.table.createdBy')}</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase">{t('wastageReport.table.unitCost')}</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase">{t('wastageReport.table.wastageValue')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {detailedReport.items.map((item, index) => (
                      <tr key={index} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm text-gray-700">
                          {format(new Date(item.wastage_date), 'dd MMM yyyy')}
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-sm font-medium text-gray-900">{item.product_name}</div>
                          <div className="text-xs text-gray-500">{item.product_code}</div>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700">{item.category}</td>
                        <td className="px-4 py-3 text-sm font-medium text-red-600 text-right">{item.wastage_qty}</td>
                        <td className="px-4 py-3 text-sm text-gray-700">{item.reason}</td>
                        <td className="px-4 py-3 text-sm text-gray-500">{item.created_by || '-'}</td>
                        <td className="px-4 py-3 text-sm text-gray-700 text-right">{formatCurrency(item.unit_price)}</td>
                        <td className="px-4 py-3 text-sm font-semibold text-gray-800 text-right">{formatCurrency(item.wastage_value)}</td>
                      </tr>
                    ))}
                    {detailedReport.items.length === 0 && (
                        <tr>
                            <td colSpan="8" className="px-4 py-8 text-center text-gray-500">
                                {t('wastageReport.messages.noRecords') || 'No wastage records found for the selected period.'}
                            </td>
                        </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {detailedReport.totalCount > 0 && (
                <div className="mt-4 flex items-center justify-between">
                    <p className="text-sm text-gray-600">
                    {t('common.showing')} {((currentPage - 1) * pageSize) + 1} {t('common.to')} {Math.min(currentPage * pageSize, detailedReport.totalCount)} {t('common.of')} {detailedReport.totalCount} {t('common.entries')}
                    </p>
                    <div className="flex gap-2">
                    <button
                        onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                        disabled={currentPage === 1}
                        className="px-3 py-1 border border-gray-300 rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                    >
                        {t('common.previous')}
                    </button>
                    <span className="px-3 py-1 border border-gray-300 rounded bg-blue-50 text-blue-600">
                        {currentPage} / {detailedReport.totalPages}
                    </span>
                    <button
                        onClick={() => setCurrentPage(prev => Math.min(detailedReport.totalPages, prev + 1))}
                        disabled={currentPage === detailedReport.totalPages}
                        className="px-3 py-1 border border-gray-300 rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                    >
                        {t('common.next')}
                    </button>
                    </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default WastageReport;
