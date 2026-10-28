import React, { useState, useEffect } from 'react';
import { Download, RefreshCw, Search, Loader2, Wrench, ShoppingCart, Banknote, Clock } from 'lucide-react';
import * as XLSX from 'xlsx';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { getPresetRange, formatMoney, formatAmount, formatDate, CUSTOMER_PRESETS } from './reportUtils';

// Mechanic Ledger: one row per mechanic with the bills they referred in the period
const MechanicReport = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [preset, setPreset] = useState('allTime');
  const [range, setRange] = useState(getPresetRange('allTime'));
  const [balanceOnly, setBalanceOnly] = useState(false);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
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
      const response = await window.api.getMechanicLedgerSummary({
        startDate: range.startDate,
        endDate: range.endDate,
        balanceOnly,
        searchTerm: debouncedSearch
      });
      if (response?.success) {
        setRows(response.data || []);
        setTotals(response.totals || null);
      } else {
        toast.error(response?.message || 'Failed to load mechanic ledger');
      }
    } catch (error) {
      console.error('Error loading mechanic ledger:', error);
      toast.error('Failed to load mechanic ledger');
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

  const rangeLabel = preset === 'allTime' ? t('auditSalesReport.presets.allTime') : `${formatDate(range.startDate)} → ${formatDate(range.endDate)}`;

  const handleExport = () => {
    if (!rows.length) {
      toast.error('No data to export');
      return;
    }
    const sheet = rows.map((row) => ({
      '#': row.sno,
      Code: row.mechanic_code,
      Mechanic: row.mechanic_name,
      Mobile: row.mobile,
      Bills: row.bills,
      'First Sale': formatDate(row.first_sale),
      'Last Sale': formatDate(row.last_sale),
      'Total Sale': row.total_sale,
      'Avg Bill': row.avg_bill,
      Paid: row.paid,
      'Balance Due': row.balance_due
    }));
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(sheet), 'Mechanic Ledger');
    XLSX.writeFile(workbook, `Mechanic_Ledger_${range.startDate}_to_${range.endDate}.xlsx`);
  };

  const cards = [
    { label: 'Mechanics', value: totals?.mechanics ?? 0, icon: Wrench, tone: 'bg-slate-100 text-slate-600', isCount: true },
    { label: 'Total Sale', value: totals?.total_sale, icon: ShoppingCart, tone: 'bg-green-50 text-green-600' },
    { label: 'Collected', value: totals?.paid, icon: Banknote, tone: 'bg-emerald-50 text-emerald-600' },
    { label: 'Outstanding', value: totals?.balance_due, icon: Clock, tone: 'bg-amber-50 text-amber-600' }
  ];

  const openMechanic = (row) => navigate(`/reports/mechanics/${row.mechanic_id}`, { state: { preset, range } });

  const thClass = 'px-3 py-2.5 text-xs font-semibold text-gray-600 uppercase tracking-wide bg-gray-50 border-b border-gray-200 whitespace-nowrap';
  const tdClass = 'px-3 py-2.5 text-sm text-gray-800 border-b border-gray-100 whitespace-nowrap';

  return (
    <div className="p-6 bg-gray-50 min-h-full flex flex-col gap-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Mechanic Ledger</h1>
          <p className="text-sm text-gray-500 mt-1">Sales bills referred by each mechanic. Cancelled and returned bills are not counted. Click a mechanic to see their bills.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={fetchReport} className="flex items-center gap-2 px-3 py-2 text-sm bg-white border border-gray-200 rounded-lg hover:bg-gray-50">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
          <button onClick={handleExport} className="flex items-center gap-2 px-3 py-2 text-sm bg-white border border-gray-200 rounded-lg hover:bg-gray-50">
            <Download size={14} /> Export
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {cards.map(({ label, value, icon: Icon, tone, isCount }) => (
          <div key={label} className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 flex items-center gap-4">
            <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${tone}`}><Icon size={20} /></div>
            <div>
              <div className="text-sm text-gray-500">{label}</div>
              <div className="text-xl font-bold text-gray-900">{isCount ? value : formatMoney(value)}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap gap-1.5">
          {CUSTOMER_PRESETS.map((value) => (
            <button
              key={value}
              onClick={() => handlePreset(value)}
              className={`px-3.5 py-1.5 text-sm rounded-full transition-colors ${preset === value ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
            >
              {t(`auditSalesReport.presets.${value}`)}
            </button>
          ))}
        </div>
        {preset === 'custom' && (
          <div className="flex items-center gap-2">
            <input type="date" value={range.startDate} max={range.endDate} onChange={(e) => setRange((p) => ({ ...p, startDate: e.target.value }))} className="px-2 py-1.5 text-sm border border-gray-300 rounded-lg" />
            <span className="text-gray-400">→</span>
            <input type="date" value={range.endDate} min={range.startDate} onChange={(e) => setRange((p) => ({ ...p, endDate: e.target.value }))} className="px-2 py-1.5 text-sm border border-gray-300 rounded-lg" />
          </div>
        )}
        <div className="relative ml-auto w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, mobile, code..."
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer select-none">
          <input type="checkbox" checked={balanceOnly} onChange={(e) => setBalanceOnly(e.target.checked)} className="w-4 h-4 text-blue-600 rounded border-gray-300" />
          Balance due only
        </label>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-4 py-2.5 text-sm text-gray-500 border-b border-gray-100">{rangeLabel} · {rows.length} mechanic{rows.length === 1 ? '' : 's'}</div>
        <div className="overflow-auto">
          {loading ? (
            <div className="py-16 text-center text-gray-400"><Loader2 className="w-6 h-6 animate-spin inline-block" /></div>
          ) : rows.length === 0 ? (
            <div className="py-16 text-center text-gray-400">
              <Wrench className="w-10 h-10 mx-auto mb-2 text-gray-300" />
              <p className="text-sm">No bills with a mechanic referrer for {rangeLabel}</p>
            </div>
          ) : (
            <table className="w-full text-left">
              <thead>
                <tr>
                  <th className={thClass}>#</th>
                  <th className={thClass}>Mechanic</th>
                  <th className={thClass}>Mobile</th>
                  <th className={`${thClass} text-right`}>Bills</th>
                  <th className={thClass}>First Sale</th>
                  <th className={thClass}>Last Sale</th>
                  <th className={`${thClass} text-right`}>Total Sale</th>
                  <th className={`${thClass} text-right`}>Avg Bill</th>
                  <th className={`${thClass} text-right`}>Paid</th>
                  <th className={`${thClass} text-right`}>Balance Due</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.mechanic_id} onClick={() => openMechanic(row)} className="hover:bg-blue-50 cursor-pointer">
                    <td className={tdClass}>{row.sno}</td>
                    <td className={tdClass}>
                      <span className="font-medium text-gray-900">{row.mechanic_name}</span>
                      {row.mechanic_status === 'Inactive' && <span className="ml-2 text-[11px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">Inactive</span>}
                      <div className="text-xs text-gray-400">{row.mechanic_code}</div>
                    </td>
                    <td className={tdClass}>{row.mobile || '-'}</td>
                    <td className={`${tdClass} text-right`}>{row.bills}</td>
                    <td className={tdClass}>{formatDate(row.first_sale)}</td>
                    <td className={tdClass}>{formatDate(row.last_sale)}</td>
                    <td className={`${tdClass} text-right font-semibold`}>{formatAmount(row.total_sale)}</td>
                    <td className={`${tdClass} text-right`}>{formatAmount(row.avg_bill)}</td>
                    <td className={`${tdClass} text-right`}>{formatAmount(row.paid)}</td>
                    <td className={`${tdClass} text-right ${row.balance_due > 0 ? 'text-red-600 font-medium' : ''}`}>{formatAmount(row.balance_due)}</td>
                  </tr>
                ))}
              </tbody>
              {totals && (
                <tfoot>
                  <tr className="bg-gray-50 font-semibold">
                    <td className={tdClass} colSpan={3}>Total</td>
                    <td className={`${tdClass} text-right`}>{totals.bills}</td>
                    <td className={tdClass} colSpan={2}></td>
                    <td className={`${tdClass} text-right`}>{formatAmount(totals.total_sale)}</td>
                    <td className={tdClass}></td>
                    <td className={`${tdClass} text-right`}>{formatAmount(totals.paid)}</td>
                    <td className={`${tdClass} text-right`}>{formatAmount(totals.balance_due)}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          )}
        </div>
      </div>
    </div>
  );
};

export default MechanicReport;
