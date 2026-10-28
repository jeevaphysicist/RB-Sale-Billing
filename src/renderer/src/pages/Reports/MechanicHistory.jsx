import React, { useState, useEffect, useMemo } from 'react';
import { ArrowLeft, Download, RefreshCw, Search, Loader2, Receipt, ShoppingCart, Banknote, Clock, Phone, MapPin } from 'lucide-react';
import * as XLSX from 'xlsx';
import { toast } from 'sonner';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { getPresetRange, formatMoney, formatAmount, formatDate, CUSTOMER_PRESETS } from './reportUtils';

const statusStyles = {
  completed: 'bg-green-100 text-green-800',
  pending: 'bg-yellow-100 text-yellow-800',
  cancelled: 'bg-red-100 text-red-800',
  returned: 'bg-orange-100 text-orange-800'
};

// Ledger of one mechanic: every bill that names them as the referrer
const MechanicHistory = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id } = useParams();
  const location = useLocation();

  const [preset, setPreset] = useState(location.state?.preset || 'allTime');
  const [range, setRange] = useState(location.state?.range || getPresetRange('allTime'));
  const [search, setSearch] = useState('');
  const [outstandingOnly, setOutstandingOnly] = useState(false);
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState(null);

  const fetchHistory = async () => {
    if (!range.startDate || !range.endDate) return;
    try {
      setLoading(true);
      const response = await window.api.getMechanicLedgerHistory({ mechanicId: id, startDate: range.startDate, endDate: range.endDate });
      if (response?.success) {
        setReport(response);
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
    fetchHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, range.startDate, range.endDate]);

  const handlePreset = (value) => {
    setPreset(value);
    if (value !== 'custom') setRange(getPresetRange(value));
  };

  const mechanic = report?.mechanic;
  const summary = report?.summary;
  const rangeLabel = preset === 'allTime' ? t('auditSalesReport.presets.allTime') : `${formatDate(range.startDate)} → ${formatDate(range.endDate)}`;

  const bills = useMemo(() => {
    if (!report) return [];
    const term = search.trim().toLowerCase();
    return report.bills.filter((bill) => {
      if (outstandingOnly && !(bill.balance_due > 0.01)) return false;
      if (!term) return true;
      return [bill.order_number, bill.customer_name, bill.customer_phone, bill.status].some((v) => String(v ?? '').toLowerCase().includes(term));
    });
  }, [report, search, outstandingOnly]);

  const handleExport = () => {
    if (!report?.bills.length) {
      toast.error('No data to export');
      return;
    }
    const sheet = report.bills.map((bill) => ({
      Date: formatDate(bill.order_date),
      'Bill No': bill.order_number,
      Customer: bill.customer_name,
      Mobile: bill.customer_phone,
      Items: bill.item_count,
      Amount: bill.net_amount,
      Paid: bill.paid,
      'Balance Due': bill.balance_due,
      Status: bill.status
    }));
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(sheet), 'Bills');
    const safeName = String(mechanic?.mechanic_name || 'Mechanic').replace(/[^a-z0-9]+/gi, '_');
    XLSX.writeFile(workbook, `Mechanic_Ledger_${safeName}_${range.startDate}_to_${range.endDate}.xlsx`);
  };

  const cards = [
    { label: 'Bills', value: summary?.bills ?? 0, sub: summary?.cancelledBills ? `${summary.cancelledBills} cancelled` : null, icon: Receipt, tone: 'bg-slate-100 text-slate-600', isCount: true },
    { label: 'Total Sale', value: summary?.total_sale, sub: summary?.bills ? `Avg bill: ${formatMoney(summary.avg_bill)}` : null, icon: ShoppingCart, tone: 'bg-green-50 text-green-600' },
    { label: 'Paid', value: summary?.paid, icon: Banknote, tone: 'bg-emerald-50 text-emerald-600' },
    { label: 'Balance Due', value: summary?.balance_due, icon: Clock, tone: 'bg-amber-50 text-amber-600' }
  ];

  const thClass = 'px-3 py-2.5 text-xs font-semibold text-gray-600 uppercase tracking-wide bg-gray-50 border-b border-gray-200 whitespace-nowrap';
  const tdClass = 'px-3 py-2.5 text-sm text-gray-800 border-b border-gray-100 whitespace-nowrap';

  return (
    <div className="p-6 bg-gray-50 min-h-full flex flex-col gap-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <button onClick={() => navigate('/reports/mechanics')} className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700 mb-2">
            <ArrowLeft size={14} /> Back to mechanics
          </button>
          <h1 className="text-2xl font-bold text-gray-900">
            {mechanic ? mechanic.mechanic_name : 'Mechanic'} <span className="text-gray-400 font-normal text-lg">· Ledger</span>
          </h1>
          {mechanic && (
            <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-gray-500 mt-1">
              <span>{mechanic.mechanic_code}</span>
              {mechanic.mobile_number && <span className="flex items-center gap-1"><Phone size={12} /> {mechanic.mobile_number}</span>}
              {mechanic.address && <span className="flex items-center gap-1"><MapPin size={12} /> {mechanic.address}</span>}
              {mechanic.status === 'Inactive' && <span className="px-1.5 rounded bg-gray-100 text-gray-500">Inactive</span>}
            </div>
          )}
        </div>
        <div className="flex gap-2">
          <button onClick={fetchHistory} className="flex items-center gap-2 px-3 py-2 text-sm bg-white border border-gray-200 rounded-lg hover:bg-gray-50">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
          <button onClick={handleExport} className="flex items-center gap-2 px-3 py-2 text-sm bg-white border border-gray-200 rounded-lg hover:bg-gray-50">
            <Download size={14} /> Export
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {cards.map(({ label, value, sub, icon: Icon, tone, isCount }) => (
          <div key={label} className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 flex items-center gap-4">
            <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${tone}`}><Icon size={20} /></div>
            <div>
              <div className="text-sm text-gray-500">{label}</div>
              <div className="text-xl font-bold text-gray-900">{isCount ? value : formatMoney(value)}</div>
              {sub && <div className="text-xs text-gray-500">{sub}</div>}
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
            placeholder="Search bill no, customer, mobile..."
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer select-none">
          <input type="checkbox" checked={outstandingOnly} onChange={(e) => setOutstandingOnly(e.target.checked)} className="w-4 h-4 text-blue-600 rounded border-gray-300" />
          Outstanding bills only
        </label>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-4 py-2.5 text-sm text-gray-500 border-b border-gray-100">{rangeLabel} · {bills.length} bill{bills.length === 1 ? '' : 's'}</div>
        <div className="overflow-auto">
          {loading || !report ? (
            <div className="py-16 text-center text-gray-400"><Loader2 className="w-6 h-6 animate-spin inline-block" /></div>
          ) : bills.length === 0 ? (
            <div className="py-16 text-center text-gray-400 text-sm">No bills for {rangeLabel}</div>
          ) : (
            <table className="w-full text-left">
              <thead>
                <tr>
                  <th className={thClass}>Date</th>
                  <th className={thClass}>Bill No</th>
                  <th className={thClass}>Customer</th>
                  <th className={`${thClass} text-right`}>Items</th>
                  <th className={`${thClass} text-right`}>Amount</th>
                  <th className={`${thClass} text-right`}>Paid</th>
                  <th className={`${thClass} text-right`}>Balance Due</th>
                  <th className={thClass}>Status</th>
                </tr>
              </thead>
              <tbody>
                {bills.map((bill) => (
                  <tr key={bill.id} onClick={() => navigate(`/sales/view/${bill.id}`)} className={`hover:bg-blue-50 cursor-pointer ${bill.excluded ? 'text-gray-400' : ''}`}>
                    <td className={tdClass}>{formatDate(bill.order_date)}</td>
                    <td className={`${tdClass} text-blue-600 font-medium`}>{bill.order_number}</td>
                    <td className={tdClass}>
                      {bill.customer_name || '-'}
                      {bill.customer_phone && <div className="text-xs text-gray-400">{bill.customer_phone}</div>}
                    </td>
                    <td className={`${tdClass} text-right`}>{bill.item_count}</td>
                    <td className={`${tdClass} text-right font-semibold`}>{formatAmount(bill.net_amount)}</td>
                    <td className={`${tdClass} text-right`}>{formatAmount(bill.paid)}</td>
                    <td className={`${tdClass} text-right ${bill.balance_due > 0 ? 'text-red-600 font-medium' : ''}`}>{formatAmount(bill.balance_due)}</td>
                    <td className={tdClass}>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${statusStyles[bill.status] || 'bg-gray-100 text-gray-700'}`}>{bill.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <div className="px-4 py-2.5 text-xs text-gray-500 border-t border-gray-100">
          Cancelled and returned bills are listed but not counted in the totals.
        </div>
      </div>
    </div>
  );
};

export default MechanicHistory;
