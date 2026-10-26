import React, { useState, useEffect, useMemo } from 'react';
import {
  Download,
  RefreshCw,
  Search,
  Loader2,
  Receipt,
  Banknote,
  CreditCard,
  Clock,
  ShoppingCart,
  AlertTriangle
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { getPresetRange, formatMoney, formatAmount, formatDate, PRESETS } from './reportUtils';

const SalesReport = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [preset, setPreset] = useState('today');
  const [range, setRange] = useState(getPresetRange('today'));
  const [billType, setBillType] = useState('all');
  const [status, setStatus] = useState('all');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [pageSize, setPageSize] = useState(25);
  const [page, setPage] = useState(1);

  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState([]);
  const [totals, setTotals] = useState(null);
  const [missingBillNumbers, setMissingBillNumbers] = useState([]);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 400);
    return () => clearTimeout(timer);
  }, [search]);

  const fetchReport = async () => {
    if (!range.startDate || !range.endDate) return;
    try {
      setLoading(true);
      const response = await window.api.getSalesReport({
        startDate: range.startDate,
        endDate: range.endDate,
        billType,
        status,
        searchTerm: debouncedSearch
      });
      if (response?.success) {
        setRows(response.data || []);
        setTotals(response.totals || null);
        setMissingBillNumbers(response.missingBillNumbers || []);
        setPage(1);
      } else {
        toast.error(response?.message || t('auditSalesReport.loadFailed'));
      }
    } catch (error) {
      console.error('Error loading sales report:', error);
      toast.error(t('auditSalesReport.loadFailed'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range.startDate, range.endDate, billType, status, debouncedSearch]);

  const handlePreset = (value) => {
    setPreset(value);
    if (value !== 'custom') setRange(getPresetRange(value));
  };

  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const pageRows = useMemo(
    () => rows.slice((page - 1) * pageSize, page * pageSize),
    [rows, page, pageSize]
  );

  const columns = [
    { key: 'sno', label: '#', align: 'left' },
    { key: 'order_number', label: t('auditSalesReport.columns.billNo'), align: 'left' },
    { key: 'order_date', label: t('auditSalesReport.columns.date'), align: 'left' },
    { key: 'order_time', label: t('auditSalesReport.columns.time'), align: 'left' },
    { key: 'customer_name', label: t('auditSalesReport.columns.customer'), align: 'left' },
    { key: 'customer_gstin', label: t('auditSalesReport.columns.gstin'), align: 'left' },
    { key: 'taxable_amount', label: t('auditSalesReport.columns.taxable'), money: true },
    { key: 'non_taxable', label: t('auditSalesReport.columns.nonTaxable'), money: true },
    { key: 'discount', label: t('auditSalesReport.columns.discount'), money: true },
    { key: 'cgst', label: 'CGST', money: true },
    { key: 'sgst', label: 'SGST', money: true },
    { key: 'igst', label: 'IGST', money: true },
    { key: 'round_off', label: t('auditSalesReport.columns.roundOff'), money: true },
    { key: 'net_amount', label: t('auditSalesReport.columns.netAmount'), money: true, bold: true },
    { key: 'cash', label: t('auditSalesReport.columns.cash'), money: true },
    { key: 'card', label: t('auditSalesReport.columns.card'), money: true },
    { key: 'upi', label: 'UPI', money: true },
    { key: 'other', label: t('auditSalesReport.columns.other'), money: true },
    { key: 'credit', label: t('auditSalesReport.columns.credit'), money: true },
    { key: 'balance_due', label: t('auditSalesReport.columns.balanceDue'), money: true },
    { key: 'status', label: t('auditSalesReport.columns.status'), align: 'left' },
    { key: 'billing_user', label: t('auditSalesReport.columns.billingUser'), align: 'left' }
  ];

  const statusBadge = (value) => {
    const styles = {
      completed: 'bg-green-100 text-green-800',
      cancelled: 'bg-red-100 text-red-800',
      returned: 'bg-orange-100 text-orange-800'
    };
    return (
      <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${styles[value] || 'bg-gray-100 text-gray-700'}`}>
        {t(`auditSalesReport.status.${value}`, value)}
      </span>
    );
  };

  const renderCell = (col, row) => {
    const value = row[col.key];
    if (col.key === 'balance_due') {
      return <span className={value > 0 ? 'text-red-600 font-medium' : ''}>{formatAmount(value)}</span>;
    }
    if (col.money) return formatAmount(value);
    switch (col.key) {
      case 'order_number':
        return <span className="font-medium text-blue-600">{value}</span>;
      case 'order_date':
        return formatDate(value);
      case 'customer_name':
        return (
          <div>
            <div className="text-gray-900">{value || '-'}</div>
            {row.customer_phone && <div className="text-xs text-gray-500">{row.customer_phone}</div>}
          </div>
        );
      case 'customer_gstin':
        return value || <span className="text-gray-400">B2C</span>;
      case 'status':
        return statusBadge(value);
      default:
        return value || '-';
    }
  };

  const handleExport = () => {
    if (!rows.length) {
      toast.error(t('auditSalesReport.noDataToExport'));
      return;
    }
    const sheetRows = rows.map((row) => ({
      '#': row.sno,
      [t('auditSalesReport.columns.billNo')]: row.order_number,
      [t('auditSalesReport.columns.date')]: formatDate(row.order_date),
      [t('auditSalesReport.columns.time')]: row.order_time || '',
      [t('auditSalesReport.columns.customer')]: row.customer_name || '',
      [t('auditSalesReport.columns.mobile')]: row.customer_phone || '',
      [t('auditSalesReport.columns.gstin')]: row.customer_gstin || '',
      [t('auditSalesReport.columns.taxable')]: row.taxable_amount,
      [t('auditSalesReport.columns.nonTaxable')]: row.non_taxable,
      [t('auditSalesReport.columns.discount')]: row.discount,
      CGST: row.cgst,
      SGST: row.sgst,
      IGST: row.igst,
      [t('auditSalesReport.columns.roundOff')]: row.round_off,
      [t('auditSalesReport.columns.netAmount')]: row.net_amount,
      [t('auditSalesReport.columns.cash')]: row.cash,
      [t('auditSalesReport.columns.card')]: row.card,
      UPI: row.upi,
      [t('auditSalesReport.columns.other')]: row.other,
      [t('auditSalesReport.columns.credit')]: row.credit,
      [t('auditSalesReport.columns.balanceDue')]: row.balance_due,
      [t('auditSalesReport.columns.status')]: row.status,
      [t('auditSalesReport.columns.billingUser')]: row.billing_user || ''
    }));

    if (totals) {
      sheetRows.push({
        '#': '',
        [t('auditSalesReport.columns.billNo')]: t('auditSalesReport.total'),
        [t('auditSalesReport.columns.taxable')]: totals.taxable_amount,
        [t('auditSalesReport.columns.nonTaxable')]: totals.non_taxable,
        [t('auditSalesReport.columns.discount')]: totals.discount,
        CGST: totals.cgst,
        SGST: totals.sgst,
        IGST: totals.igst,
        [t('auditSalesReport.columns.roundOff')]: totals.round_off,
        [t('auditSalesReport.columns.netAmount')]: totals.net_amount,
        [t('auditSalesReport.columns.cash')]: totals.cash,
        [t('auditSalesReport.columns.card')]: totals.card,
        UPI: totals.upi,
        [t('auditSalesReport.columns.other')]: totals.other,
        [t('auditSalesReport.columns.credit')]: totals.credit,
        [t('auditSalesReport.columns.balanceDue')]: totals.balance_due
      });
    }

    const worksheet = XLSX.utils.json_to_sheet(sheetRows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Sales Report');

    if (missingBillNumbers.length) {
      const gapSheet = XLSX.utils.json_to_sheet(
        missingBillNumbers.map((number) => ({ [t('auditSalesReport.missingBillNo')]: number }))
      );
      XLSX.utils.book_append_sheet(workbook, gapSheet, 'Missing Bill Nos');
    }

    XLSX.writeFile(workbook, `Sales_Report_${range.startDate}_to_${range.endDate}.xlsx`);
  };

  const summaryCards = [
    { label: t('auditSalesReport.cards.bills'), value: totals?.bills ?? 0, sub: totals?.cancelledBills ? t('auditSalesReport.cards.cancelled', { count: totals.cancelledBills }) : null, icon: Receipt, tone: 'bg-slate-100 text-slate-600', isCount: true },
    { label: t('auditSalesReport.cards.netSales'), value: totals?.net_amount, icon: ShoppingCart, tone: 'bg-green-50 text-green-600' },
    { label: t('auditSalesReport.columns.cash'), value: totals?.cash, icon: Banknote, tone: 'bg-emerald-50 text-emerald-600' },
    { label: `${t('auditSalesReport.columns.card')} / UPI`, value: (totals?.card || 0) + (totals?.upi || 0), icon: CreditCard, tone: 'bg-blue-50 text-blue-600' },
    { label: t('auditSalesReport.columns.balanceDue'), value: totals?.balance_due, icon: Clock, tone: 'bg-amber-50 text-amber-600' }
  ];

  const rangeLabel = `${formatDate(range.startDate)} → ${formatDate(range.endDate)}`;

  return (
    <div className="p-6 bg-gray-50 min-h-full flex flex-col">
      <div className="w-full flex-1 flex flex-col">
        {/* Header */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 mb-5">
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold text-gray-900">{t('auditSalesReport.title')}</h1>
              </div>
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
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {summaryCards.map(({ label, value, sub, icon: Icon, tone, isCount }) => (
              <div key={label} className="bg-white rounded-xl border border-gray-200 p-4 flex items-start gap-3">
                <div className={`p-2.5 rounded-lg ${tone}`}>
                  <Icon className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-sm text-gray-500">{label}</div>
                  <div className="text-xl font-bold text-gray-900">{isCount ? value : formatMoney(value)}</div>
                  {sub && <div className="text-xs text-red-500">{sub}</div>}
                </div>
              </div>
            ))}
          </div>

          <p className="mt-3 text-sm text-gray-500">
            {rangeLabel} · {t('auditSalesReport.recordCount', { count: rows.length })}
          </p>

          {/* Filters */}
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <div className="flex flex-wrap gap-1.5">
              {PRESETS.map((value) => (
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

            <div className="inline-flex rounded-lg border border-gray-300 overflow-hidden">
              {['all', 'b2b', 'b2c'].map((value) => (
                <button
                  key={value}
                  onClick={() => setBillType(value)}
                  className={`px-3.5 py-1.5 text-sm ${billType === value ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'}`}
                >
                  {value === 'all' ? t('auditSalesReport.all') : value.toUpperCase()}
                </button>
              ))}
            </div>

            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg bg-white"
            >
              <option value="all">{t('auditSalesReport.statusFilter.all')}</option>
              <option value="active">{t('auditSalesReport.statusFilter.active')}</option>
              <option value="cancelled">{t('auditSalesReport.statusFilter.cancelled')}</option>
            </select>
          </div>
        </div>

        {/* Missing bill numbers */}
        {missingBillNumbers.length > 0 && (
          <div className="mb-5 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
            <div>
              <div className="font-medium">
                {t('auditSalesReport.missingBillsTitle', { count: missingBillNumbers.length })}
              </div>
              <div className="mt-1 break-words">{missingBillNumbers.slice(0, 30).join(', ')}{missingBillNumbers.length > 30 ? ' …' : ''}</div>
            </div>
          </div>
        )}

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
                placeholder={t('auditSalesReport.searchPlaceholder')}
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
                      className={`px-3 py-3 text-xs font-semibold uppercase text-gray-500 whitespace-nowrap ${col.money ? 'text-right' : 'text-left'}`}
                    >
                      {col.label}
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
                      <ShoppingCart className="w-10 h-10 mx-auto mb-3 text-gray-200" />
                      {t('auditSalesReport.empty', { range: rangeLabel })}
                    </td>
                  </tr>
                ) : (
                  pageRows.map((row) => (
                    <tr
                      key={row.id}
                      onClick={() => navigate(`/sales/view/${row.id}`)}
                      className={`cursor-pointer hover:bg-blue-50/50 ${row.excluded ? 'bg-red-50/40 text-gray-400' : 'text-gray-700'}`}
                    >
                      {columns.map((col) => (
                        <td
                          key={col.key}
                          className={`px-3 py-2.5 whitespace-nowrap ${col.money ? 'text-right tabular-nums' : ''} ${col.bold ? 'font-semibold' : ''}`}
                        >
                          {renderCell(col, row)}
                        </td>
                      ))}
                    </tr>
                  ))
                )}
              </tbody>
              {!loading && totals && rows.length > 0 && (
                <tfoot className="bg-gray-100 sticky bottom-0 font-semibold text-gray-900">
                  <tr>
                    {columns.map((col, index) => (
                      <td key={col.key} className={`px-3 py-3 whitespace-nowrap ${col.money ? 'text-right tabular-nums' : ''}`}>
                        {index === 1 ? t('auditSalesReport.total') : col.money ? formatAmount(totals[col.key]) : ''}
                      </td>
                    ))}
                  </tr>
                </tfoot>
              )}
            </table>
          </div>

          {/* Pagination */}
          {rows.length > pageSize && (
            <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100 text-sm text-gray-600">
              <span>
                {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, rows.length)} / {rows.length}
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

        <p className="mt-3 text-xs text-gray-400">{t('auditSalesReport.note')}</p>
      </div>
    </div>
  );
};

export default SalesReport;
