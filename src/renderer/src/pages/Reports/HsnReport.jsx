import React, { useState, useEffect, useMemo } from 'react';
import {
  Download,
  RefreshCw,
  Search,
  Loader2,
  Hash,
  Package,
  TrendingUp,
  Landmark,
  ShoppingCart,
  AlertTriangle,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  ChevronDown,
  ChevronRight
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { getPresetRange, formatMoney, formatAmount, formatDate, PRESETS } from './reportUtils';

const HsnReport = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [preset, setPreset] = useState('thisMonth');
  const [range, setRange] = useState(getPresetRange('thisMonth'));
  const [billType, setBillType] = useState('all');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [sort, setSort] = useState({ key: 'hsn_code', direction: 'asc' });

  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState([]);
  const [totals, setTotals] = useState(null);
  const [invalidHsnLines, setInvalidHsnLines] = useState(0);
  // Bills per expanded HSN line, keyed by `${hsn_code}-${tax_rate}`
  const [expanded, setExpanded] = useState({});

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 400);
    return () => clearTimeout(timer);
  }, [search]);

  const fetchReport = async () => {
    if (!range.startDate || !range.endDate) return;
    try {
      setLoading(true);
      const response = await window.api.getHsnReport({
        startDate: range.startDate,
        endDate: range.endDate,
        billType,
        searchTerm: debouncedSearch
      });
      if (response?.success) {
        setRows(response.data || []);
        setTotals(response.totals || null);
        setInvalidHsnLines(response.invalidHsnLines || 0);
        setExpanded({});
      } else {
        toast.error(response?.message || t('hsnReport.loadFailed'));
      }
    } catch (error) {
      console.error('Error loading HSN report:', error);
      toast.error(t('hsnReport.loadFailed'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range.startDate, range.endDate, billType, debouncedSearch]);

  const rowKey = (row) => `${row.hsn_code}-${row.tax_rate}`;

  // Bills with an invalid HSN open in the edit form so the code can be corrected
  const openBill = (billId, hsnValid) => navigate(`/sales/${hsnValid ? 'view' : 'edit'}/${billId}`);

  const toggleHsn = async (row) => {
    const key = rowKey(row);
    if (!row.hsn_valid && row.bills === 1 && !expanded[key]) {
      // Single bill: go straight to editing it
      try {
        const response = await window.api.getHsnBills({
          startDate: range.startDate,
          endDate: range.endDate,
          billType,
          searchTerm: debouncedSearch,
          hsnCode: row.hsn_code,
          taxRate: row.tax_rate
        });
        const bill = response?.success && response.data?.[0];
        if (bill) return openBill(bill.id, false);
      } catch (error) {
        console.error('Error loading HSN bills:', error);
      }
    }
    if (expanded[key]) {
      setExpanded(({ [key]: _, ...rest }) => rest);
      return;
    }
    setExpanded((prev) => ({ ...prev, [key]: { loading: true, bills: [] } }));
    try {
      const response = await window.api.getHsnBills({
        startDate: range.startDate,
        endDate: range.endDate,
        billType,
        searchTerm: debouncedSearch,
        hsnCode: row.hsn_code,
        taxRate: row.tax_rate
      });
      if (!response?.success) throw new Error(response?.message);
      setExpanded((prev) => (prev[key] ? { ...prev, [key]: { loading: false, bills: response.data || [] } } : prev));
    } catch (error) {
      console.error('Error loading HSN bills:', error);
      toast.error(t('hsnReport.loadFailed'));
      setExpanded(({ [key]: _, ...rest }) => rest);
    }
  };

  const handlePreset = (value) => {
    setPreset(value);
    if (value !== 'custom') setRange(getPresetRange(value));
  };

  const sortedRows = useMemo(() => {
    const { key, direction } = sort;
    const factor = direction === 'asc' ? 1 : -1;
    return [...rows].sort((a, b) => {
      const av = a[key];
      const bv = b[key];
      if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * factor;
      // Blank HSN codes always go last
      if (key === 'hsn_code' && (av === '' || bv === '')) return av === '' ? 1 : -1;
      return String(av).localeCompare(String(bv)) * factor;
    });
  }, [rows, sort]);

  const toggleSort = (key) => {
    setSort((prev) => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const columns = [
    { key: 'sno', label: '#' },
    { key: 'hsn_code', label: t('hsnReport.columns.hsnCode'), sortable: true },
    { key: 'products', label: t('hsnReport.columns.products'), sortable: true },
    { key: 'units', label: t('hsnReport.columns.unit') },
    { key: 'tax_rate', label: t('hsnReport.columns.taxRate'), numeric: true, sortable: true },
    { key: 'quantity', label: t('hsnReport.columns.qty'), numeric: true, sortable: true },
    { key: 'taxable_amount', label: t('hsnReport.columns.taxable'), money: true, sortable: true },
    { key: 'cgst', label: 'CGST', money: true },
    { key: 'sgst', label: 'SGST', money: true },
    { key: 'igst', label: 'IGST', money: true },
    { key: 'total_tax', label: t('hsnReport.columns.totalTax'), money: true, sortable: true },
    { key: 'labour', label: t('hsnReport.columns.labour'), money: true },
    { key: 'net_value', label: t('hsnReport.columns.netValue'), money: true, bold: true, sortable: true },
    { key: 'bills', label: t('hsnReport.columns.bills'), numeric: true, sortable: true }
  ];

  const renderCell = (col, row, index) => {
    const value = row[col.key];
    if (col.money) return formatAmount(value);
    switch (col.key) {
      case 'sno':
        return index + 1;
      case 'hsn_code': {
        const Chevron = expanded[rowKey(row)] ? ChevronDown : ChevronRight;
        return (
          <button
            onClick={() => toggleHsn(row)}
            className="inline-flex items-center gap-1 hover:underline"
            title={row.hsn_valid ? t('hsnReport.showBills') : t('hsnReport.fixHsn')}
          >
            <Chevron className="w-4 h-4 text-gray-400" />
            {row.hsn_valid ? (
              <span className="font-medium text-blue-600">{value}</span>
            ) : (
              <span className="inline-flex items-center gap-1 font-medium text-amber-700">
                <AlertTriangle className="w-3.5 h-3.5" />
                {value || t('hsnReport.noHsn')}
              </span>
            )}
          </button>
        );
      }
      case 'products':
        return (
          <span className="block max-w-xs truncate" title={value}>
            {(value || '').split(',').join(', ')}
          </span>
        );
      case 'tax_rate':
        return `${value}%`;
      case 'quantity':
        return Number(value).toLocaleString('en-IN', { maximumFractionDigits: 3 });
      default:
        return value || '-';
    }
  };

  const handleExport = () => {
    if (!rows.length) {
      toast.error(t('hsnReport.noDataToExport'));
      return;
    }
    const sheetRows = sortedRows.map((row, index) => ({
      '#': index + 1,
      [t('hsnReport.columns.hsnCode')]: row.hsn_code,
      [t('hsnReport.columns.products')]: (row.products || '').split(',').join(', '),
      [t('hsnReport.columns.unit')]: row.units,
      [t('hsnReport.columns.taxRate')]: row.tax_rate,
      [t('hsnReport.columns.qty')]: row.quantity,
      [t('hsnReport.columns.taxable')]: row.taxable_amount,
      CGST: row.cgst,
      SGST: row.sgst,
      IGST: row.igst,
      [t('hsnReport.columns.totalTax')]: row.total_tax,
      [t('hsnReport.columns.labour')]: row.labour,
      [t('hsnReport.columns.netValue')]: row.net_value,
      [t('hsnReport.columns.bills')]: row.bills
    }));

    if (totals) {
      sheetRows.push({
        '#': '',
        [t('hsnReport.columns.hsnCode')]: t('hsnReport.total'),
        [t('hsnReport.columns.qty')]: totals.quantity,
        [t('hsnReport.columns.taxable')]: totals.taxable_amount,
        CGST: totals.cgst,
        SGST: totals.sgst,
        IGST: totals.igst,
        [t('hsnReport.columns.totalTax')]: totals.total_tax,
        [t('hsnReport.columns.labour')]: totals.labour,
        [t('hsnReport.columns.netValue')]: totals.net_value,
        [t('hsnReport.columns.bills')]: totals.bills
      });
    }

    const worksheet = XLSX.utils.json_to_sheet(sheetRows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'HSN Summary');
    XLSX.writeFile(workbook, `HSN_Report_${range.startDate}_to_${range.endDate}.xlsx`);
  };

  const summaryCards = [
    { label: t('hsnReport.cards.hsnLines'), value: totals?.lines ?? 0, icon: Hash, tone: 'bg-slate-100 text-slate-600', isCount: true },
    { label: t('hsnReport.cards.totalQty'), value: totals?.quantity ?? 0, icon: Package, tone: 'bg-blue-50 text-blue-600', isCount: true },
    { label: t('hsnReport.cards.taxableValue'), value: totals?.taxable_amount, icon: TrendingUp, tone: 'bg-emerald-50 text-emerald-600' },
    { label: t('hsnReport.cards.taxAmount'), value: totals?.total_tax, icon: Landmark, tone: 'bg-amber-50 text-amber-600' },
    { label: t('hsnReport.cards.netSales'), value: totals?.net_value, icon: ShoppingCart, tone: 'bg-green-50 text-green-600' }
  ];

  const rangeLabel = `${formatDate(range.startDate)} → ${formatDate(range.endDate)}`;

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
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold text-gray-900">{t('hsnReport.title')}</h1>
                <span className="px-2 py-0.5 text-xs font-medium rounded-md bg-indigo-50 text-indigo-700">
                  {t('hsnReport.badge')}
                </span>
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
            {summaryCards.map(({ label, value, icon: Icon, tone, isCount }) => (
              <div key={label} className="bg-white rounded-xl border border-gray-200 p-4 flex items-start gap-3">
                <div className={`p-2.5 rounded-lg ${tone}`}>
                  <Icon className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-sm text-gray-500">{label}</div>
                  <div className="text-xl font-bold text-gray-900">
                    {isCount ? Number(value).toLocaleString('en-IN', { maximumFractionDigits: 3 }) : formatMoney(value)}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <p className="mt-3 text-sm text-gray-500">
            {rangeLabel} · {t('hsnReport.lineCount', { count: rows.length })}
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
          </div>
        </div>

        {/* Invalid HSN warning */}
        {invalidHsnLines > 0 && (
          <div className="mb-5 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
            <div>
              <div className="font-medium">{t('hsnReport.invalidHsnTitle', { count: invalidHsnLines })}</div>
              <div className="mt-0.5">{t('hsnReport.invalidHsnHint')}</div>
            </div>
          </div>
        )}

        {/* Table */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex-1 flex flex-col">
          {/* Search Bar */}
          <div className="p-4 border-b border-gray-200 flex items-center justify-between gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t('hsnReport.searchPlaceholder')}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
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
                ) : sortedRows.length === 0 ? (
                  <tr>
                    <td colSpan={columns.length} className="py-16 text-center text-gray-400">
                      {t('hsnReport.empty')}
                    </td>
                  </tr>
                ) : (
                  sortedRows.map((row, index) => {
                    const detail = expanded[rowKey(row)];
                    return (
                      <React.Fragment key={rowKey(row)}>
                        <tr className={`hover:bg-blue-50/50 ${row.hsn_valid ? 'text-gray-700' : 'bg-amber-50/40 text-gray-700'}`}>
                          {columns.map((col) => (
                            <td
                              key={col.key}
                              className={`px-3 py-2.5 whitespace-nowrap ${col.money || col.numeric ? 'text-right tabular-nums' : ''} ${col.bold ? 'font-semibold' : ''}`}
                            >
                              {renderCell(col, row, index)}
                            </td>
                          ))}
                        </tr>
                        {detail && (
                          <tr className="bg-gray-50/70">
                            <td />
                            <td colSpan={columns.length - 1} className="px-3 py-2">
                              {detail.loading ? (
                                <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
                              ) : (
                                <table className="w-full max-w-4xl text-xs">
                                  <thead>
                                    <tr className="text-gray-500">
                                      <th className="text-left py-1 pr-3 font-medium">{t('auditSalesReport.columns.date')}</th>
                                      <th className="text-left py-1 pr-3 font-medium">{t('auditSalesReport.columns.billNo')}</th>
                                      <th className="text-left py-1 pr-3 font-medium">{t('customerHistoryReport.columns.customer')}</th>
                                      <th className="text-right py-1 pr-3 font-medium">{t('hsnReport.columns.qty')}</th>
                                      <th className="text-right py-1 pr-3 font-medium">{t('hsnReport.columns.totalTax')}</th>
                                      <th className="text-right py-1 font-medium">{t('hsnReport.columns.netValue')}</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {detail.bills.map((bill) => (
                                      <tr key={bill.id} className="text-gray-700">
                                        <td className="py-1 pr-3">{formatDate(bill.order_date)}</td>
                                        <td className="py-1 pr-3">
                                          <button
                                            onClick={() => openBill(bill.id, row.hsn_valid)}
                                            className={`font-medium hover:underline ${row.hsn_valid ? 'text-blue-600' : 'text-amber-700'}`}
                                            title={row.hsn_valid ? t('customerHistoryReport.openBill') : t('hsnReport.fixHsn')}
                                          >
                                            {bill.order_number}
                                          </button>
                                        </td>
                                        <td className="py-1 pr-3">{bill.customer_name}</td>
                                        <td className="py-1 pr-3 text-right tabular-nums">
                                          {Number(bill.quantity).toLocaleString('en-IN', { maximumFractionDigits: 3 })}
                                        </td>
                                        <td className="py-1 pr-3 text-right tabular-nums">{formatAmount(bill.total_tax)}</td>
                                        <td className="py-1 text-right tabular-nums">{formatAmount(bill.net_value)}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              )}
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })
                )}
              </tbody>
              {!loading && totals && rows.length > 0 && (
                <tfoot className="bg-gray-100 sticky bottom-0 font-semibold text-gray-900">
                  <tr>
                    {columns.map((col, index) => {
                      let content = '';
                      if (index === 1) content = t('hsnReport.total');
                      else if (col.money) content = formatAmount(totals[col.key]);
                      else if (col.key === 'quantity') content = Number(totals.quantity).toLocaleString('en-IN', { maximumFractionDigits: 3 });
                      else if (col.key === 'bills') content = totals.bills;
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
        </div>

        <p className="mt-3 text-xs text-gray-400">{t('hsnReport.note')}</p>
      </div>
    </div>
  );
};

export default HsnReport;
