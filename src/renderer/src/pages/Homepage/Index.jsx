import React, { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  ShoppingBasket,
  FileText,
  Banknote,
  Users,
  BarChart3,
  Hash,
  History,
  Settings,
  TrendingUp,
  Receipt,
  CalendarDays,
  AlertCircle,
  ChevronRight,
  Loader2,
  RefreshCw,
  CheckCircle2
} from 'lucide-react'
import { getPresetRange, formatMoney, ALL_TIME_RANGE } from '../Reports/reportUtils'

const OUTSTANDING_LIST_LIMIT = 8

const Index = () => {
  const navigate = useNavigate()
  const { t } = useTranslation()

  const [loading, setLoading] = useState(true)
  const [today, setToday] = useState(null)
  const [month, setMonth] = useState(null)
  const [outstanding, setOutstanding] = useState({ rows: [], total: 0, count: 0 })

  const loadDashboard = useCallback(async () => {
    try {
      setLoading(true)
      const day = getPresetRange('today')
      const monthRange = getPresetRange('thisMonth')
      const [todayRes, monthRes, dueRes] = await Promise.all([
        window.api.getSalesReport({ ...day }),
        window.api.getSalesReport({ ...monthRange }),
        window.api.getCustomerSummaryReport({ balanceOnly: true })
      ])
      if (todayRes?.success) setToday(todayRes.totals)
      if (monthRes?.success) setMonth(monthRes.totals)
      if (dueRes?.success) {
        const rows = [...dueRes.data].sort((a, b) => b.balance_due - a.balance_due)
        setOutstanding({ rows, total: dueRes.totals.balance_due, count: rows.length })
      }
    } catch (error) {
      console.error('Error loading dashboard:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadDashboard()
  }, [loadDashboard])

  const openOutstandingBills = (customerId) =>
    navigate(`/reports/customers/${customerId}`, {
      state: { outstandingOnly: true, preset: 'allTime', range: ALL_TIME_RANGE }
    })

  const stats = [
    { label: "Today's Sales", value: formatMoney(today?.net_amount), icon: TrendingUp, tone: 'bg-emerald-50 text-emerald-600' },
    { label: "Today's Bills", value: today?.bills ?? 0, icon: Receipt, tone: 'bg-blue-50 text-blue-600' },
    { label: 'This Month', value: formatMoney(month?.net_amount), icon: CalendarDays, tone: 'bg-violet-50 text-violet-600' },
    {
      label: 'Customer Outstanding',
      value: formatMoney(outstanding.total),
      sub: `${outstanding.count} customer${outstanding.count === 1 ? '' : 's'}`,
      icon: AlertCircle,
      tone: 'bg-red-50 text-red-600'
    }
  ]

  const quickLinks = [
    { label: t('common.newSale'), path: '/sales/new', icon: ShoppingBasket, tone: 'bg-emerald-100 text-emerald-700', primary: true },
    { label: t('nav.salesList'), path: '/sales', icon: FileText, tone: 'bg-blue-100 text-blue-700' },
    { label: t('nav.paymentTracking'), path: '/sales/payments', icon: Banknote, tone: 'bg-amber-100 text-amber-700' },
    { label: t('nav.customers'), path: '/customers', icon: Users, tone: 'bg-purple-100 text-purple-700' },
    { label: t('nav.salesReport'), path: '/reports/sales', icon: BarChart3, tone: 'bg-indigo-100 text-indigo-700' },
    { label: t('nav.hsnReport'), path: '/reports/hsn', icon: Hash, tone: 'bg-cyan-100 text-cyan-700' },
    { label: t('nav.customerHistory'), path: '/reports/customers', icon: History, tone: 'bg-pink-100 text-pink-700' },
    { label: t('nav.settings'), path: '/settings', icon: Settings, tone: 'bg-gray-200 text-gray-700' }
  ]

  const visibleDue = outstanding.rows.slice(0, OUTSTANDING_LIST_LIMIT)

  return (
    <div className="p-6 h-full overflow-y-auto bg-gray-50">
      <div className="max-w-[1400px] mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{t('homepage.welcomeBack')}</h1>
            <p className="text-gray-500 text-sm mt-1">
              {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
          </div>
          <button
            onClick={loadDashboard}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-60"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
        </div>

        {/* Overview */}
        <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {stats.map(({ label, value, sub, icon: Icon, tone }) => (
            <div key={label} className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 flex items-center gap-4">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${tone}`}>
                <Icon size={22} />
              </div>
              <div className="min-w-0">
                <p className="text-sm text-gray-500">{label}</p>
                <p className="text-xl font-bold text-gray-900 truncate">{value}</p>
                {sub && <p className="text-xs text-gray-500">{sub}</p>}
              </div>
            </div>
          ))}
        </section>

        <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
          {/* Quick navigation */}
          <section className="xl:col-span-2 bg-white rounded-xl border border-gray-200 shadow-sm p-5">
            <h2 className="text-base font-semibold text-gray-900 mb-4">Quick navigation</h2>
            <div className="grid grid-cols-2 gap-3">
              {quickLinks.map(({ label, path, icon: Icon, tone, primary }) => (
                <button
                  key={path}
                  onClick={() => navigate(path)}
                  className={`flex items-center gap-3 p-3 rounded-xl border text-left transition-all hover:shadow-md hover:-translate-y-0.5 ${primary ? 'col-span-2 border-emerald-200 bg-emerald-50' : 'border-gray-200 bg-white hover:border-gray-300'
                    }`}
                >
                  <span className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${tone}`}>
                    <Icon size={20} />
                  </span>
                  <span className="text-sm font-medium text-gray-800">{label}</span>
                </button>
              ))}
            </div>
          </section>

          {/* Customer outstanding */}
          <section className="xl:col-span-3 bg-white rounded-xl border border-gray-200 shadow-sm flex flex-col">
            <div className="p-5 pb-3 flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold text-gray-900">Customer outstanding</h2>
                <p className="text-xs text-gray-500 mt-0.5">Click a customer to see their unpaid bills</p>
              </div>
              <button
                onClick={() => navigate('/reports/customers')}
                className="text-sm text-blue-600 hover:text-blue-700 font-medium"
              >
                View all
              </button>
            </div>

            {loading ? (
              <div className="py-16 text-center text-gray-400">
                <Loader2 className="w-6 h-6 animate-spin inline-block" />
              </div>
            ) : visibleDue.length === 0 ? (
              <div className="py-16 text-center text-gray-400">
                <CheckCircle2 className="w-10 h-10 mx-auto mb-2 text-emerald-400" />
                <p className="text-sm">No outstanding balances. All customers are settled.</p>
              </div>
            ) : (
              <ul className="divide-y divide-gray-100 border-t border-gray-100">
                {visibleDue.map((row) => (
                  <li key={row.customer_id}>
                    <button
                      onClick={() => openOutstandingBills(row.customer_id)}
                      className="w-full flex items-center gap-4 px-5 py-3 text-left hover:bg-gray-50 transition-colors"
                    >
                      <span className="w-9 h-9 rounded-full bg-red-50 text-red-600 flex items-center justify-center text-sm font-semibold flex-shrink-0">
                        {(row.customer_name || '?').charAt(0).toUpperCase()}
                      </span>
                      <span className="flex-1 min-w-0">
                        <span className="block text-sm font-medium text-gray-900 truncate">{row.customer_name}</span>
                        <span className="block text-xs text-gray-500">
                          {row.mobile || 'No mobile'}
                          {row.days_since_last != null && ` · last bill ${row.days_since_last}d ago`}
                        </span>
                      </span>
                      <span className="text-right">
                        <span className="block text-sm font-bold text-red-600">{formatMoney(row.balance_due)}</span>
                        {row.over_limit && <span className="block text-[11px] text-orange-600 font-medium">Over credit limit</span>}
                      </span>
                      <ChevronRight size={16} className="text-gray-400 flex-shrink-0" />
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {!loading && outstanding.count > OUTSTANDING_LIST_LIMIT && (
              <div className="px-5 py-3 border-t border-gray-100 text-xs text-gray-500">
                Showing top {OUTSTANDING_LIST_LIMIT} of {outstanding.count} customers by amount due
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  )
}

export default Index
