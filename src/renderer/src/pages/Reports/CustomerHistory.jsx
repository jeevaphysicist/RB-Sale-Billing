import React, { useState, useEffect, useMemo } from 'react';
import {
  ArrowLeft,
  Download,
  RefreshCw,
  Search,
  Loader2,
  Receipt,
  ShoppingCart,
  Banknote,
  Clock,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Plus,
  Phone,
  MapPin
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { toast } from 'sonner';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { getPresetRange, formatMoney, formatAmount, formatDate, PRESETS } from './reportUtils';
import PaymentRecordForm from '../Sales/Payment record/AddEditForm';

const TABS = ['bills', 'products', 'statement'];

const statusStyles = {
  completed: 'bg-green-100 text-green-800',
  cancelled: 'bg-red-100 text-red-800',
  returned: 'bg-orange-100 text-orange-800'
};

const CustomerHistory = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id } = useParams();
  const location = useLocation();

  // Start with the period chosen on the summary page, if any
  const [preset, setPreset] = useState(location.state?.preset || 'thisYear');
  const [range, setRange] = useState(location.state?.range || getPresetRange('thisYear'));
  const [tab, setTab] = useState('bills');
  const [expandedBills, setExpandedBills] = useState({});
  const [search, setSearch] = useState('');
  const [paymentBill, setPaymentBill] = useState(null);

  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState(null);

  const fetchHistory = async () => {
    if (!range.startDate || !range.endDate) return;
    try {
      setLoading(true);
      const response = await window.api.getCustomerHistory({
        customerId: id,
        startDate: range.startDate,
        endDate: range.endDate
      });
      if (response?.success) {
        setReport(response);
      } else {
        toast.error(response?.message || t('customerHistoryReport.loadFailed'));
      }
    } catch (error) {
      console.error('Error loading customer history:', error);
      toast.error(t('customerHistoryReport.loadFailed'));
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

  const toggleBill = (billId) => {
    setExpandedBills((prev) => ({ ...prev, [billId]: !prev[billId] }));
  };

  const customer = report?.customer;
  const summary = report?.summary;
  const customerName = customer ? (customer.is_walk_in ? t('customerHistoryReport.walkIn') : customer.customer_name) : '';
  const rangeLabel = `${formatDate(range.startDate)} → ${formatDate(range.endDate)}`;

  // Client-side search over the active tab's rows
  const { bills, products, statement } = useMemo(() => {
    if (!report) return { bills: [], products: [], statement: [] };
    const term = search.trim().toLowerCase();
    if (!term) return report;
    const has = (...values) => values.some((v) => String(v ?? '').toLowerCase().includes(term));
    return {
      bills: report.bills.filter((bill) =>
        has(bill.order_number, bill.status) || bill.items.some((item) => has(item.product_name, item.hsn_code))
      ),
      products: report.products.filter((p) => has(p.product_name, p.hsn_code)),
      statement: report.statement.filter((entry) => has(entry.reference, entry.method))
    };
  }, [report, search]);

  const handleExport = () => {
    if (!report) return;
    const workbook = XLSX.utils.book_new();

    const billSheet = report.bills.map((bill) => ({
      [t('auditSalesReport.columns.date')]: formatDate(bill.order_date),
      [t('auditSalesReport.columns.billNo')]: bill.order_number,
      [t('customerHistoryReport.columns.items')]: bill.item_count,
      [t('auditSalesReport.columns.netAmount')]: bill.net_amount,
      [t('customerHistoryReport.columns.paid')]: bill.paid,
      [t('customerHistoryReport.columns.balanceDue')]: bill.balance_due,
      [t('auditSalesReport.columns.status')]: bill.status
    }));
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(billSheet), 'Bills');

    const productSheet = report.products.map((p) => ({
      [t('customerHistoryReport.columns.product')]: p.product_name,
      HSN: p.hsn_code,
      [t('hsnReport.columns.unit')]: p.units,
      [t('hsnReport.columns.qty')]: p.quantity,
      [t('customerHistoryReport.columns.totalValue')]: p.total_value,
      [t('customerHistoryReport.columns.timesBought')]: p.times_bought,
      [t('customerHistoryReport.columns.lastBought')]: formatDate(p.last_bought)
    }));
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(productSheet), 'Products');

    const statementSheet = [
      {
        [t('auditSalesReport.columns.date')]: formatDate(range.startDate),
        [t('customerHistoryReport.columns.particulars')]: t('customerHistoryReport.openingBalance'),
        [t('customerHistoryReport.columns.balance')]: report.statementTotals.opening_balance
      },
      ...report.statement.map((entry) => ({
        [t('auditSalesReport.columns.date')]: formatDate(entry.date),
        [t('customerHistoryReport.columns.particulars')]: entry.type === 'bill'
          ? `${t('customerHistoryReport.billEntry')} ${entry.reference}`
          : `${t('customerHistoryReport.paymentEntry')} (${entry.method}) - ${entry.reference}`,
        [t('customerHistoryReport.columns.debit')]: entry.debit || '',
        [t('customerHistoryReport.columns.credit')]: entry.credit || '',
        [t('customerHistoryReport.columns.balance')]: entry.balance
      })),
      {
        [t('customerHistoryReport.columns.particulars')]: t('customerHistoryReport.closingBalance'),
        [t('customerHistoryReport.columns.debit')]: report.statementTotals.debit,
        [t('customerHistoryReport.columns.credit')]: report.statementTotals.credit,
        [t('customerHistoryReport.columns.balance')]: report.statementTotals.closing_balance
      }
    ];
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(statementSheet), 'Statement');

    const safeName = (customerName || 'Customer').replace(/[^\w]+/g, '_');
    XLSX.writeFile(workbook, `Customer_History_${safeName}_${range.startDate}_to_${range.endDate}.xlsx`);
  };

  const summaryCards = [
    { label: t('customerHistoryReport.columns.bills'), value: summary?.bills ?? 0, sub: summary?.cancelledBills ? t('auditSalesReport.cards.cancelled', { count: summary.cancelledBills }) : null, icon: Receipt, tone: 'bg-slate-100 text-slate-600', isCount: true },
    { label: t('customerHistoryReport.cards.totalPurchase'), value: summary?.total_purchase, sub: summary?.bills ? `${t('customerHistoryReport.columns.avgBill')}: ${formatMoney(summary.avg_bill)}` : null, icon: ShoppingCart, tone: 'bg-green-50 text-green-600' },
    { label: t('customerHistoryReport.columns.paid'), value: summary?.paid, icon: Banknote, tone: 'bg-emerald-50 text-emerald-600' },
    { label: t('customerHistoryReport.columns.balanceDue'), value: summary?.balance_due, icon: Clock, tone: 'bg-amber-50 text-amber-600' }
  ];

  const thClass = (right) => `px-3 py-3 text-xs font-semibold uppercase text-gray-500 whitespace-nowrap ${right ? 'text-right' : 'text-left'}`;
  const tdClass = (right) => `px-3 py-2.5 whitespace-nowrap ${right ? 'text-right tabular-nums' : ''}`;

  const renderEmpty = (colSpan) => (
    <tr>
      <td colSpan={colSpan} className="py-14 text-center text-gray-400">
        {t('customerHistoryReport.emptyHistory', { range: rangeLabel })}
      </td>
    </tr>
  );

  const renderBills = () => (
    <table className="min-w-full text-sm">
      <thead className="bg-gray-50 sticky top-0 z-10">
        <tr>
          <th className={thClass()} />
          <th className={thClass()}>{t('auditSalesReport.columns.date')}</th>
          <th className={thClass()}>{t('auditSalesReport.columns.billNo')}</th>
          <th className={thClass(true)}>{t('customerHistoryReport.columns.items')}</th>
          <th className={thClass(true)}>{t('auditSalesReport.columns.netAmount')}</th>
          <th className={thClass(true)}>{t('customerHistoryReport.columns.paid')}</th>
          <th className={thClass(true)}>{t('customerHistoryReport.columns.balanceDue')}</th>
          <th className={thClass()}>{t('auditSalesReport.columns.status')}</th>
          <th className={thClass()}>{t('customerHistoryReport.columns.action')}</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-100">
        {bills.length === 0 && renderEmpty(9)}
        {bills.map((bill) => (
          <React.Fragment key={bill.id}>
            <tr
              onClick={() => toggleBill(bill.id)}
              className={`cursor-pointer hover:bg-blue-50/50 ${bill.excluded ? 'bg-red-50/40 text-gray-400' : 'text-gray-700'}`}
            >
              <td className="pl-3 py-2.5 w-6 text-gray-400">
                {expandedBills[bill.id] ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              </td>
              <td className={tdClass()}>
                {formatDate(bill.order_date)}
                {bill.order_time && <span className="ml-2 text-xs text-gray-400">{bill.order_time}</span>}
              </td>
              <td className={tdClass()}><span className="font-medium text-blue-600">{bill.order_number}</span></td>
              <td className={tdClass(true)}>{bill.item_count}</td>
              <td className={`${tdClass(true)} font-semibold`}>{formatAmount(bill.net_amount)}</td>
              <td className={tdClass(true)}>{formatAmount(bill.paid)}</td>
              <td className={`${tdClass(true)} ${bill.balance_due > 0 ? 'text-red-600 font-medium' : ''}`}>{formatAmount(bill.balance_due)}</td>
              <td className={tdClass()}>
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusStyles[bill.status] || 'bg-gray-100 text-gray-700'}`}>
                  {t(`auditSalesReport.status.${bill.status}`, bill.status)}
                </span>
              </td>
              <td className={tdClass()}>
                <div className="flex items-center gap-1">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/sales/view/${bill.id}`);
                    }}
                    className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                    title={t('customerHistoryReport.openBill')}
                  >
                    <ExternalLink className="w-4 h-4" />
                  </button>
                  {!bill.excluded && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setPaymentBill(bill);
                      }}
                      className="p-1 text-green-600 hover:bg-green-50 rounded"
                      title={t('customerHistoryReport.addPayment')}
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </td>
            </tr>
            {expandedBills[bill.id] && (
              <tr className="bg-gray-50/70">
                <td />
                <td colSpan={8} className="px-3 py-2">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-gray-500">
                        <th className="text-left py-1 pr-3 font-medium">{t('customerHistoryReport.columns.product')}</th>
                        <th className="text-left py-1 pr-3 font-medium">HSN</th>
                        <th className="text-right py-1 pr-3 font-medium">{t('hsnReport.columns.qty')}</th>
                        <th className="text-right py-1 pr-3 font-medium">{t('customerHistoryReport.columns.rate')}</th>
                        <th className="text-right py-1 pr-3 font-medium">{t('hsnReport.columns.taxRate')}</th>
                        <th className="text-right py-1 font-medium">{t('customerHistoryReport.columns.amount')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {bill.items.map((item, index) => (
                        <tr key={index} className="text-gray-700">
                          <td className="py-1 pr-3">{item.product_name}</td>
                          <td className="py-1 pr-3">{item.hsn_code || '-'}</td>
                          <td className="py-1 pr-3 text-right tabular-nums">{item.quantity} {item.unit}</td>
                          <td className="py-1 pr-3 text-right tabular-nums">{formatAmount(item.unit_price)}</td>
                          <td className="py-1 pr-3 text-right tabular-nums">{item.tax_rate}%</td>
                          <td className="py-1 text-right tabular-nums">{formatAmount(item.final_amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </td>
              </tr>
            )}
          </React.Fragment>
        ))}
      </tbody>
    </table>
  );

  const renderProducts = () => (
    <table className="min-w-full text-sm">
      <thead className="bg-gray-50 sticky top-0 z-10">
        <tr>
          <th className={thClass()}>#</th>
          <th className={thClass()}>{t('customerHistoryReport.columns.product')}</th>
          <th className={thClass()}>HSN</th>
          <th className={thClass(true)}>{t('hsnReport.columns.qty')}</th>
          <th className={thClass(true)}>{t('customerHistoryReport.columns.totalValue')}</th>
          <th className={thClass(true)}>{t('customerHistoryReport.columns.timesBought')}</th>
          <th className={thClass()}>{t('customerHistoryReport.columns.lastBought')}</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-100">
        {products.length === 0 && renderEmpty(7)}
        {products.map((p, index) => (
          <tr key={`${p.product_name}-${p.hsn_code}`} className="text-gray-700 hover:bg-blue-50/50">
            <td className={tdClass()}>{index + 1}</td>
            <td className={`${tdClass()} font-medium text-gray-900`}>{p.product_name}</td>
            <td className={tdClass()}>{p.hsn_code || '-'}</td>
            <td className={tdClass(true)}>{p.quantity} {p.units}</td>
            <td className={`${tdClass(true)} font-semibold`}>{formatAmount(p.total_value)}</td>
            <td className={tdClass(true)}>{p.times_bought}</td>
            <td className={tdClass()}>{formatDate(p.last_bought)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );

  const renderStatement = () => {
    const { statementTotals } = report;
    return (
      <table className="min-w-full text-sm">
        <thead className="bg-gray-50 sticky top-0 z-10">
          <tr>
            <th className={thClass()}>{t('auditSalesReport.columns.date')}</th>
            <th className={thClass()}>{t('customerHistoryReport.columns.particulars')}</th>
            <th className={thClass(true)}>{t('customerHistoryReport.columns.debit')}</th>
            <th className={thClass(true)}>{t('customerHistoryReport.columns.credit')}</th>
            <th className={thClass(true)}>{t('customerHistoryReport.columns.balance')}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          <tr className="bg-gray-50/70 font-medium text-gray-700">
            <td className={tdClass()}>{formatDate(range.startDate)}</td>
            <td className={tdClass()}>{t('customerHistoryReport.openingBalance')}</td>
            <td className={tdClass(true)} />
            <td className={tdClass(true)} />
            <td className={tdClass(true)}>{formatMoney(statementTotals.opening_balance)}</td>
          </tr>
          {statement.map((entry) => (
            <tr key={`${entry.type}-${entry.id}`} className="text-gray-700 hover:bg-blue-50/50">
              <td className={tdClass()}>{formatDate(entry.date)}</td>
              <td className={tdClass()}>
                {entry.type === 'bill' ? (
                  <span>{t('customerHistoryReport.billEntry')} <span className="text-blue-600 font-medium">{entry.reference}</span></span>
                ) : (
                  <span className="text-emerald-700">
                    {t('customerHistoryReport.paymentEntry')} <span className="capitalize">({entry.method})</span> · {entry.reference}
                  </span>
                )}
              </td>
              <td className={tdClass(true)}>{formatAmount(entry.debit)}</td>
              <td className={tdClass(true)}>{formatAmount(entry.credit)}</td>
              <td className={`${tdClass(true)} font-medium`}>{formatMoney(entry.balance)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot className="bg-gray-100 sticky bottom-0 font-semibold text-gray-900">
          <tr>
            <td className={tdClass()} />
            <td className={tdClass()}>{t('customerHistoryReport.closingBalance')}</td>
            <td className={tdClass(true)}>{formatAmount(statementTotals.debit)}</td>
            <td className={tdClass(true)}>{formatAmount(statementTotals.credit)}</td>
            <td className={tdClass(true)}>{formatMoney(statementTotals.closing_balance)}</td>
          </tr>
        </tfoot>
      </table>
    );
  };

  return (
    <div className="p-6 bg-gray-50 min-h-full flex flex-col">
      <div className="w-full flex-1 flex flex-col">
        {/* Header */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 mb-5">
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
            <div className="flex items-start gap-3">
              <button
                onClick={() => navigate('/reports/customers')}
                className="mt-1 p-1.5 rounded-lg text-gray-500 hover:bg-gray-100"
                title={t('customerHistoryReport.back')}
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">{customerName || t('customerHistoryReport.historyTitle')}</h1>
                {customer && !customer.is_walk_in && (
                  <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-500">
                    {customer.mobile && (
                      <span className="inline-flex items-center gap-1"><Phone className="w-3.5 h-3.5" />{customer.mobile}</span>
                    )}
                    {customer.gstin && <span>GSTIN: {customer.gstin}</span>}
                    {customer.customer_type && <span>{customer.customer_type}</span>}
                    {customer.credit_limit > 0 && (
                      <span>{t('customerHistoryReport.columns.creditLimit')}: {formatMoney(customer.credit_limit)}</span>
                    )}
                    {customer.address && (
                      <span className="inline-flex items-center gap-1"><MapPin className="w-3.5 h-3.5" />{customer.address}</span>
                    )}
                  </div>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleExport}
                disabled={!report}
                className="inline-flex items-center px-4 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg shadow-sm transition-colors"
              >
                <Download className="w-4 h-4 mr-2" />
                Excel
              </button>
              <button
                onClick={fetchHistory}
                className="inline-flex items-center px-4 py-2 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 text-sm font-medium rounded-lg transition-colors"
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                {t('auditSalesReport.refresh')}
              </button>
            </div>
          </div>

          {/* Summary cards */}
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {summaryCards.map(({ label, value, sub, icon: Icon, tone, isCount }) => (
              <div key={label} className="bg-white rounded-xl border border-gray-200 p-4 flex items-start gap-3">
                <div className={`p-2.5 rounded-lg ${tone}`}>
                  <Icon className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-sm text-gray-500">{label}</div>
                  <div className="text-xl font-bold text-gray-900">{isCount ? value : formatMoney(value)}</div>
                  {sub && <div className="text-xs text-gray-500">{sub}</div>}
                </div>
              </div>
            ))}
          </div>

          <p className="mt-3 text-sm text-gray-500">{t('customerHistoryReport.historyTitle')} · {rangeLabel}</p>

          {/* Period */}
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
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex-1 flex flex-col">
          <div className="flex border-b border-gray-200 px-3">
            {TABS.map((value) => (
              <button
                key={value}
                onClick={() => setTab(value)}
                className={`px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors ${
                  tab === value ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-800'
                }`}
              >
                {t(`customerHistoryReport.tabs.${value}`)}
                {report && value === 'bills' && <span className="ml-1.5 text-xs text-gray-400">({bills.length})</span>}
                {report && value === 'products' && <span className="ml-1.5 text-xs text-gray-400">({products.length})</span>}
              </button>
            ))}
          </div>

          {/* Search Bar */}
          <div className="p-4 border-b border-gray-200 flex items-center justify-between gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t('customerHistoryReport.historySearchPlaceholder')}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          <div className="overflow-auto flex-1">
            {loading || !report ? (
              <div className="py-16 text-center text-gray-400">
                <Loader2 className="w-6 h-6 animate-spin inline-block" />
              </div>
            ) : tab === 'bills' ? (
              renderBills()
            ) : tab === 'products' ? (
              renderProducts()
            ) : (
              renderStatement()
            )}
          </div>
        </div>

        <p className="mt-3 text-xs text-gray-400">{t('customerHistoryReport.historyNote')}</p>
      </div>

      <PaymentRecordForm
        isOpen={!!paymentBill}
        onClose={() => setPaymentBill(null)}
        salesOrder={paymentBill && {
          id: paymentBill.id,
          order_number: paymentBill.order_number,
          customer_name: customerName,
          grand_total: paymentBill.net_amount,
          amount_paid: paymentBill.paid,
          balance_amount: paymentBill.balance_due
        }}
        onSuccess={() => {
          setPaymentBill(null);
          fetchHistory();
        }}
      />
    </div>
  );
};

export default CustomerHistory;
