import React, { useState, useEffect, useMemo } from 'react';
import {
  Download,
  RefreshCw,
  Search,
  Loader2,
  Users,
  ShoppingCart,
  Banknote,
  Clock,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  AlertTriangle
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { getPresetRange, formatMoney, formatAmount, formatDate, CUSTOMER_PRESETS } from './reportUtils';

const CustomerReport = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [preset, setPreset] = useState('allTime');
  const [range, setRange] = useState(getPresetRange('allTime'));
  const [balanceOnly, setBalanceOnly] = useState(false);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [sort, setSort] = useState({ key: 'total_purchase', direction: 'desc' });
  const [pageSize, setPageSize] = useState(25);
  const [page, setPage] = useState(1);

  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState([]);
  const [totals, setTotals] = useState(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 400);
    return () => clearTimeout(timer);
  }, [search]);

  const fetchReport = async () => {
    if (!range.startDate || !range.endDate) return;
    try {
      setLoading(true);
      const response = await window.api.getCustomerSummaryReport({
        startDate: range.startDate,
        endDate: range.endDate,
        balanceOnly,
        searchTerm: debouncedSearch
      });
      if (response?.success) {
        setRows(response.data || []);
        setTotals(response.totals || null);
        setPage(1);
      } else {
        toast.error(response?.message || t('customerHistoryReport.loadFailed'));
      }
    } catch (error) {
      console.error('Error loading customer report:', error);
      toast.error(t('customerHistoryReport.loadFailed'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range.startDate, range.endDate, balanceOnly, debouncedSearch]);

  const handlePreset = (value) => {
    setPreset(value);
    if (value !== 'custom') setRange(getPresetRange(value));
  };

  const sortedRows = useMemo(() => {
    const { key, direction } = sort;
    const factor = direction === 'asc' ? 1 : -1;
    return [...rows].sort((a, b) => {
      const av = a[key] ?? '';
      const bv = b[key] ?? '';
      if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * factor;
      return String(av).localeCompare(String(bv)) * factor;
    });
  }, [rows, sort]);

  const totalPages = Math.max(1, Math.ceil(sortedRows.length / pageSize));
  const pageRows = sortedRows.slice((page - 1) * pageSize, page * pageSize);

  const toggleSort = (key) => {
    setSort((prev) => ({
      key,
      direction: prev.key === key && prev.direction === 'desc' ? 'asc' : 'desc'
    }));
  };

  const columns = [
    { key: 'sno', label: '#' },
    { key: 'customer_name', label: t('customerHistoryReport.columns.customer'), sortable: true },
    { key: 'gstin', label: 'GSTIN' },
    { key: 'bills', label: t('customerHistoryReport.columns.bills'), numeric: true, sortable: true },
    { key: 'first_purchase', label: t('customerHistoryReport.columns.firstPurchase'), sortable: true },
    { key: 'last_purchase', label: t('customerHistoryReport.columns.lastPurchase'), sortable: true },
    { key: 'days_since_last', label: t('customerHistoryReport.columns.daysSince'), numeric: true, sortable: true },
    { key: 'total_purchase', label: t('customerHistoryReport.columns.totalPurchase'), money: true, bold: true, sortable: true },
    { key: 'avg_bill', label: t('customerHistoryReport.columns.avgBill'), money: true, sortable: true },
    { key: 'paid', label: t('customerHistoryReport.columns.paid'), money: true, sortable: true },
    { key: 'balance_due', label: t('customerHistoryReport.columns.balanceDue'), money: true, sortable: true }
  ];

  const renderCell = (col, row, index) => {
    const value = row[col.key];
    if (col.key === 'balance_due') {
      return row.over_limit ? (
        <span className="inline-flex items-center gap-1 text-red-600 font-semibold" title={t('customerHistoryReport.overLimit', { limit: formatMoney(row.credit_limit) })}>
          <AlertTriangle className="w-3.5 h-3.5" />
          {formatAmount(value)}
        </span>
      ) : (
        <span className={value > 0 ? 'text-red-600 font-medium' : ''}>{formatAmount(value)}</span>
      );
    }
    if (col.money) return formatAmount(value);
    switch (col.key) {
      case 'sno':
        return (page - 1) * pageSize + index + 1;
      case 'customer_name':
        return (
          <div>
            <div className="font-medium text-blue-600">
              {row.is_walk_in ? t('customerHistoryReport.walkIn') : value}
            </div>
            {row.mobile && !row.is_walk_in && <div className="text-xs text-gray-500">{row.mobile}</div>}
          </div>
        );
      case 'first_purchase':
      case 'last_purchase':
        return formatDate(value);
      case 'days_since_last':
        return value === null ? '-' : value;
      default:
        return value || '-';
    }
  };

  const openHistory = (row) => {
    navigate(`/reports/customers/${row.customer_id}`, { state: { preset, range } });
  };

  const handleExport = () => {
    if (!rows.length) {
      toast.error(t('customerHistoryReport.noDataToExport'));
      return;
    }
    const sheetRows = sortedRows.map((row, index) => ({
      '#': index + 1,
      [t('customerHistoryReport.columns.customer')]: row.is_walk_in ? t('customerHistoryReport.walkIn') : row.customer_name,
      [t('customerHistoryReport.columns.mobile')]: row.is_walk_in ? '' : row.mobile,
      GSTIN: row.gstin,
      [t('customerHistoryReport.columns.bills')]: row.bills,
      [t('customerHistoryReport.columns.firstPurchase')]: formatDate(row.first_purchase),
      [t('customerHistoryReport.columns.lastPurchase')]: formatDate(row.last_purchase),
      [t('customerHistoryReport.columns.daysSince')]: row.days_since_last,
      [t('customerHistoryReport.columns.totalPurchase')]: row.total_purchase,
      [t('customerHistoryReport.columns.avgBill')]: row.avg_bill,
      [t('customerHistoryReport.columns.paid')]: row.paid,
      [t('customerHistoryReport.columns.balanceDue')]: row.balance_due,
      [t('customerHistoryReport.columns.creditLimit')]: row.credit_limit
    }));
    if (totals) {
      sheetRows.push({
        '#': '',
        [t('customerHistoryReport.columns.customer')]: t('customerHistoryReport.total'),
        [t('customerHistoryReport.columns.bills')]: totals.bills,
        [t('customerHistoryReport.columns.totalPurchase')]: totals.total_purchase,
        [t('customerHistoryReport.columns.paid')]: totals.paid,
        [t('customerHistoryReport.columns.balanceDue')]: totals.balance_due
      });
    }
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(sheetRows), 'Customer Purchases');
    XLSX.writeFile(workbook, `Customer_Purchase_Report_${range.startDate}_to_${range.endDate}.xlsx`);
  };

  const summaryCards = [
    { label: t('customerHistoryReport.cards.customers'), value: totals?.customers ?? 0, icon: Users, tone: 'bg-slate-100 text-slate-600', isCount: true },
    { label: t('customerHistoryReport.cards.totalPurchase'), value: totals?.total_purchase, icon: ShoppingCart, tone: 'bg-green-50 text-green-600' },
    { label: t('customerHistoryReport.cards.collected'), value: totals?.paid, icon: Banknote, tone: 'bg-emerald-50 text-emerald-600' },
    { label: t('customerHistoryReport.cards.outstanding'), value: totals?.balance_due, icon: Clock, tone: 'bg-amber-50 text-amber-600' }
  ];

  const rangeLabel = preset === 'allTime' ? t('auditSalesReport.presets.allTime') : `${formatDate(range.startDate)} → ${formatDate(range.endDate)}`;

  const sortIcon = (col) => {
    if (!col.sortable) return null;
    if (sort.key !== col.key) return <ArrowUpDown className="w-3 h-3 inline ml-1 opacity-40" />;
    return sort.direction === 'asc'
      ? <ArrowUp className="w-3 h-3 inline ml-1 text-blue-600" />
      : <ArrowDown className="w-3 h-3 inline ml-1 text-blue-600" />;
  };

  return (
    <div className="p-6 bg-gray-50 min-h-full flex flex-col">
      <div className="w-full flex-1 flex flex-col">
        {/* Header */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 mb-5">
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{t('customerHistoryReport.title')}</h1>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleExport}
                className="inline-flex items-center px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg shadow-sm transition-colors"
              >
                <Download className="w-4 h-4 mr-2" />
                Excel
              </button>
              <button
                onClick={fetchReport}
                className="inline-flex items-center px-4 py-2 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 text-sm font-medium rounded-lg transition-colors"
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                {t('auditSalesReport.refresh')}
              </button>
            </div>
          </div>

          {/* Summary cards */}
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {summaryCards.map(({ label, value, icon: Icon, tone, isCount }) => (
              <div key={label} className="bg-white rounded-xl border border-gray-200 p-4 flex items-start gap-3">
                <div className={`p-2.5 rounded-lg ${tone}`}>
                  <Icon className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-sm text-gray-500">{label}</div>
                  <div className="text-xl font-bold text-gray-900">{isCount ? value : formatMoney(value)}</div>
                </div>
              </div>
            ))}
          </div>

          <p className="mt-3 text-sm text-gray-500">
            {rangeLabel} · {t('customerHistoryReport.customerCount', { count: rows.length })}
          </p>

          {/* Filters */}
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <div className="flex flex-wrap gap-1.5">
              {CUSTOMER_PRESETS.map((value) => (
                <button
                  key={value}
                  onClick={() => handlePreset(value)}
                  className={`px-3.5 py-1.5 text-sm rounded-full transition-colors ${
                    preset === value ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {t(`auditSalesReport.presets.${value}`)}
                </button>
              ))}
            </div>

            {preset === 'custom' && (
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={range.startDate}
                  max={range.endDate}
                  onChange={(e) => setRange((prev) => ({ ...prev, startDate: e.target.value }))}
                  className="px-2 py-1.5 text-sm border border-gray-300 rounded-lg"
                />
                <span className="text-gray-400">→</span>
                <input
                  type="date"
                  value={range.endDate}
                  min={range.startDate}
                  onChange={(e) => setRange((prev) => ({ ...prev, endDate: e.target.value }))}
                  className="px-2 py-1.5 text-sm border border-gray-300 rounded-lg"
                />
              </div>
            )}

            <label className="inline-flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
              <input
                type="checkbox"
                checked={balanceOnly}
                onChange={(e) => setBalanceOnly(e.target.checked)}
                className="rounded border-gray-300"
              />
              {t('customerHistoryReport.balanceOnly')}
            </label>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex-1 flex flex-col">
          {/* Search Bar and Items Per Page */}
          <div className="p-4 border-b border-gray-200 flex items-center justify-between gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t('customerHistoryReport.searchPlaceholder')}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setPage(1);
              }}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {[25, 50, 100].map((size) => (
                <option key={size} value={size}>{size}/{t('auditSalesReport.page')}</option>
              ))}
            </select>
          </div>

          <div className="overflow-auto flex-1">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 sticky top-0 z-10">
                <tr>
                  {columns.map((col) => (
                    <th
                      key={col.key}
                      onClick={col.sortable ? () => toggleSort(col.key) : undefined}
                      className={`px-3 py-3 text-xs font-semibold uppercase text-gray-500 whitespace-nowrap select-none ${
                        col.money || col.numeric ? 'text-right' : 'text-left'
                      } ${col.sortable ? 'cursor-pointer hover:text-gray-800' : ''}`}
                    >
                      {col.label}
                      {sortIcon(col)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr>
                    <td colSpan={columns.length} className="py-16 text-center text-gray-400">
                      <Loader2 className="w-6 h-6 animate-spin inline-block" />
                    </td>
                  </tr>
                ) : pageRows.length === 0 ? (
                  <tr>
                    <td colSpan={columns.length} className="py-16 text-center text-gray-400">
                      <Users className="w-10 h-10 mx-auto mb-3 text-gray-200" />
                      {t('customerHistoryReport.empty', { range: rangeLabel })}
                    </td>
                  </tr>
                ) : (
                  pageRows.map((row, index) => (
                    <tr
                      key={row.customer_id}
                      onClick={() => openHistory(row)}
                      className={`cursor-pointer hover:bg-blue-50/50 text-gray-700 ${row.over_limit ? 'bg-red-50/40' : ''}`}
                    >
                      {columns.map((col) => (
                        <td
                          key={col.key}
                          className={`px-3 py-2.5 whitespace-nowrap ${col.money || col.numeric ? 'text-right tabular-nums' : ''} ${col.bold ? 'font-semibold' : ''}`}
                        >
                          {renderCell(col, row, index)}
                        </td>
                      ))}
                    </tr>
                  ))
                )}
              </tbody>
              {!loading && totals && rows.length > 0 && (
                <tfoot className="bg-gray-100 sticky bottom-0 font-semibold text-gray-900">
                  <tr>
                    {columns.map((col, index) => {
                      let content = '';
                      if (index === 1) content = t('customerHistoryReport.total');
                      else if (col.key === 'bills') content = totals.bills;
                      else if (col.key === 'avg_bill') content = formatAmount(totals.bills ? totals.total_purchase / totals.bills : 0);
                      else if (col.money) content = formatAmount(totals[col.key]);
                      return (
                        <td key={col.key} className={`px-3 py-3 whitespace-nowrap ${col.money || col.numeric ? 'text-right tabular-nums' : ''}`}>
                          {content}
                        </td>
                      );
                    })}
                  </tr>
                </tfoot>
              )}
            </table>
          </div>

          {/* Pagination */}
          {sortedRows.length > pageSize && (
            <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100 text-sm text-gray-600">
              <span>
                {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, sortedRows.length)} / {sortedRows.length}
              </span>
              <div className="flex gap-2">
                <button
                  disabled={page === 1}
                  onClick={() => setPage((p) => p - 1)}
                  className="px-3 py-1 border border-gray-300 rounded-lg disabled:opacity-40"
                >
                  ‹
                </button>
                <span className="px-2 py-1">{page} / {totalPages}</span>
                <button
                  disabled={page === totalPages}
                  onClick={() => setPage((p) => p + 1)}
                  className="px-3 py-1 border border-gray-300 rounded-lg disabled:opacity-40"
                >
                  ›
                </button>
              </div>
            </div>
          )}
        </div>

        <p className="mt-3 text-xs text-gray-400">{t('customerHistoryReport.note')}</p>
      </div>
    </div>
  );
};

export default CustomerReport;
