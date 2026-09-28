
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    X,
    Printer,
    RotateCcw,
    Receipt,
    Package,
    User,
    CreditCard,
    Calendar,
    AlertCircle,
    Clock,
    ArrowLeft,
    ChevronRight,
    Download
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { salesOrderService } from '../../../services/salesOrderService';
import { paymentRecordService } from '../../../services/paymentRecordService';
import { toast } from 'sonner';
import Modal from '../../../components/Modal';
import AlertModal from '../../../components/AlertModal';

const ViewOrderPage = () => {
    const { t } = useTranslation();
    const { id } = useParams();
    const navigate = useNavigate();
    const [order, setOrder] = useState(null);
    const [loading, setLoading] = useState(true);
    const [showRefundModal, setShowRefundModal] = useState(false);
    const [refundData, setRefundData] = useState({
        amount: 0,
        method: 'Cash',
        notes: ''
    });
    const [refundLoading, setRefundLoading] = useState(false);

    useEffect(() => {
        if (id) {
            fetchOrderDetails();
        }
    }, [id]);

    const fetchOrderDetails = async () => {
        try {
            setLoading(true);
            const response = await salesOrderService.getById(id);
            if (response.success) {
                setOrder(response.data);
                if (response.data.status === 'returned') {
                    setRefundData(prev => ({
                        ...prev,
                        amount: response.data.amount_paid || 0
                    }));
                }
            } else {
                toast.error(t('sales.messages.loadFailed'));
                navigate('/sales');
            }
        } catch (error) {
            console.error('Error fetching order details:', error);
            toast.error(t('sales.messages.loadFailed'));
            navigate('/sales');
        } finally {
            setLoading(false);
        }
    };

    const handleRefundClick = () => {
        setShowRefundModal(true);
    };

    const handleConfirmRefund = async () => {
        if (refundData.amount <= 0) {
            toast.error(t('sales.paymentTracking.validation.validAmountRequired'));
            return;
        }

        if (refundData.amount > order.amount_paid) {
            toast.error(t('sales.refundAmountExceedsPayment') || `Refund amount cannot exceed paid amount of ${formatCurrency(order.amount_paid)}`);
            return;
        }

        try {
            setRefundLoading(true);

            const paymentData = {
                recordType: 'sales',
                referenceId: order.id,
                paymentDate: new Date().toISOString().split('T')[0],
                paymentAmount: -Math.abs(refundData.amount),
                paymentMethod: refundData.method,
                notes: refundData.notes || 'Order Refund'
            };

            const response = await paymentRecordService.createPaymentRecord(paymentData);

            if (response.success) {
                toast.success(t('sales.messages.refundSuccess') || 'Refund processed successfully');
                setShowRefundModal(false);
                fetchOrderDetails();
            } else {
                toast.error(response.message || 'Failed to process refund');
            }
        } catch (error) {
            console.error('Error processing refund:', error);
            toast.error('Error processing refund');
        } finally {
            setRefundLoading(false);
        }
    };

    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            minimumFractionDigits: 2
        }).format(amount || 0);
    };

    const statusStyles = {
        completed: 'bg-green-100 text-green-800',
        pending: 'bg-yellow-100 text-yellow-800',
        cancelled: 'bg-red-100 text-red-800',
        returned: 'bg-orange-100 text-orange-800',
        draft: 'bg-gray-100 text-gray-800'
    };

    const paymentStatusStyles = {
        paid: 'bg-green-100 text-green-800',
        partial: 'bg-blue-100 text-blue-800',
        pending: 'bg-yellow-100 text-yellow-800',
        refunded: 'bg-orange-100 text-orange-800'
    };

    return (
        <div className="min-h-full bg-gray-50">
            {/* Header */}
            <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between sticky top-0 z-10 shadow-sm">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => navigate('/sales')}
                        className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-500"
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    <div>
                        <div className="flex items-center gap-2 text-xs text-gray-500 font-medium">
                            <span>{t('nav.sales')}</span>
                            <ChevronRight className="w-3 h-3" />
                            <span>{order?.order_number || t('sales.orderSummary')}</span>
                        </div>
                        <h1 className="text-xl font-bold text-gray-900 mt-1">
                            {t('sales.orderSummary')} - {order?.order_number}
                        </h1>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <button
                        onClick={() => {/* Print logic */ }}
                        className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-bold text-gray-700 hover:bg-gray-50 transition-all shadow-sm"
                    >
                        <Printer className="w-4 h-4" />
                        {t('sales.actions.print')}
                    </button>
                    {order?.status === 'returned' && order?.amount_paid > 0 && (
                        <button
                            onClick={handleRefundClick}
                            className="flex items-center gap-2 px-4 py-2 bg-orange-600 rounded-lg text-sm font-bold text-white hover:bg-orange-700 transition-all shadow-lg shadow-orange-100"
                        >
                            <RotateCcw className="w-4 h-4" />
                            {t('sales.actions.refund') || 'Refund'}
                        </button>
                    )}
                </div>
            </div>

            <div className="p-6">
                <div className="max-w-6xl mx-auto space-y-6">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-20 bg-white rounded-2xl border border-gray-200 shadow-sm">
                            <Clock className="w-12 h-12 text-blue-500 animate-spin mb-4" />
                            <p className="text-gray-500 font-medium">{t('sales.loadingDetails')}</p>
                        </div>
                    ) : order ? (
                        <>
                            {/* Info Grid */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                {/* Customer Section */}
                                <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm transition-all hover:shadow-md group">
                                    <div className="flex items-center gap-3 mb-4">
                                        <div className="p-2.5 bg-blue-50 rounded-xl group-hover:bg-blue-100 transition-colors">
                                            <User className="w-5 h-5 text-blue-600" />
                                        </div>
                                        <h3 className="font-bold text-gray-800">{t('sales.customerName')}</h3>
                                    </div>
                                    <div className="space-y-2">
                                        <p className="text-lg font-bold text-gray-900">{order.customer_name || 'Walk-in Customer'}</p>
                                        <p className="text-sm text-gray-500 flex items-center gap-2">
                                            <span className="w-2 h-2 rounded-full bg-blue-400"></span>
                                            {order.customer_phone || '-'}
                                        </p>
                                        {order.customer_email && (
                                            <p className="text-xs text-gray-400">{order.customer_email}</p>
                                        )}
                                    </div>
                                </div>

                                {/* Order Status Section */}
                                <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm transition-all hover:shadow-md group">
                                    <div className="flex items-center gap-3 mb-4">
                                        <div className="p-2.5 bg-purple-50 rounded-xl group-hover:bg-purple-100 transition-colors">
                                            <Receipt className="w-5 h-5 text-purple-600" />
                                        </div>
                                        <h3 className="font-bold text-gray-800">{t('sales.orderSummary')}</h3>
                                    </div>
                                    <div className="space-y-3">
                                        <div className="flex justify-between items-center">
                                            <span className="text-sm text-gray-500">{t('sales.orderDate')}</span>
                                            <span className="text-sm font-bold text-gray-900">{new Date(order.order_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <span className="text-sm text-gray-500">{t('sales.orderStatus')}</span>
                                            <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider ${statusStyles[order.status.toLowerCase()] || 'bg-gray-100 text-gray-800'}`}>
                                                {t(`purchases.paymentRecords.status.${order.status.toLowerCase()}`)}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {/* Financial Summary Section */}
                                <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm transition-all hover:shadow-md group">
                                    <div className="flex items-center gap-3 mb-4">
                                        <div className="p-2.5 bg-green-50 rounded-xl group-hover:bg-green-100 transition-colors">
                                            <CreditCard className="w-5 h-5 text-green-600" />
                                        </div>
                                        <div className="flex items-center justify-between flex-1">
                                            <h3 className="font-bold text-gray-800">{t('sales.paymentStatus')}</h3>
                                            <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider ${paymentStatusStyles[order.payment_status?.toLowerCase()] || 'bg-gray-100 text-gray-800'}`}>
                                                {t(`sales.paymentTracking.status.${order.payment_status?.toLowerCase()}`) || order.payment_status}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="space-y-3">
                                        <div className="flex justify-between items-center">
                                            <span className="text-sm text-gray-500">{t('sales.totalAmount')}</span>
                                            <span className="text-lg font-black text-gray-900">{formatCurrency(order.grand_total)}</span>
                                        </div>
                                        <div className="flex justify-between items-center pb-2 border-b border-gray-50">
                                            <span className="text-sm text-green-600 font-medium">{t('sales.paidAmount')}</span>
                                            <span className="text-sm font-bold text-green-700">{formatCurrency(order.amount_paid)}</span>
                                        </div>
                                        {order.status === 'returned' && order.amount_paid > 0 && (
                                            <div className="flex justify-between items-center">
                                                <span className="text-sm text-orange-600 font-medium">{t('sales.refundDue') || 'To be Refunded'}</span>
                                                <span className="text-sm font-bold text-orange-700">{formatCurrency(order.amount_paid)}</span>
                                            </div>
                                        )}
                                        {order.status !== 'returned' && order.status !== 'cancelled' && order.balance_amount > 0 && (
                                            <div className="flex justify-between items-center">
                                                <span className="text-sm text-red-600 font-medium">{t('sales.outstanding')}</span>
                                                <span className="text-sm font-bold text-red-700">{formatCurrency(order.balance_amount)}</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Items Section */}
                            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                                <div className="px-6 py-4 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <Package className="w-5 h-5 text-gray-400" />
                                        <h3 className="font-bold text-gray-700">{t('sales.items')}</h3>
                                    </div>
                                    <span className="text-xs font-bold text-gray-500 uppercase px-2 py-1 bg-white border border-gray-200 rounded-lg">
                                        {order.items.length} {t('sales.items')}
                                    </span>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="bg-white border-b border-gray-100 text-gray-400 uppercase text-[10px] font-black tracking-widest">
                                                <th className="px-6 py-4 text-left">{t('sales.productName')}</th>
                                                <th className="px-6 py-4 text-center">{t('sales.quantity')}</th>
                                                <th className="px-6 py-4 text-right">{t('sales.unitPrice')}</th>
                                                <th className="px-6 py-4 text-right">{t('sales.totalAmount')}</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-50">
                                            {order.items.map((item, idx) => (
                                                <tr key={idx} className="hover:bg-gray-50 transition-colors">
                                                    <td className="px-6 py-4">
                                                        <div className="flex flex-col">
                                                            <span className="font-bold text-gray-900">{item.product_name}</span>
                                                            <span className="text-[10px] font-medium text-gray-400 mt-0.5">{item.product_code}</span>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4 text-center">
                                                        <span className="px-3 py-1 bg-gray-100 rounded-full font-bold text-gray-700">
                                                            {item.quantity} {item.unit}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4 text-right text-gray-500 font-medium">
                                                        {formatCurrency(item.unit_price)}
                                                    </td>
                                                    <td className="px-6 py-4 text-right font-black text-gray-900">
                                                        {formatCurrency(item.final_amount)}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                        <tfoot className="bg-gray-50 font-black border-t-2 border-gray-100">
                                            <tr>
                                                <td colSpan="3" className="px-6 py-5 text-right text-gray-500 uppercase tracking-wider">{t('sales.totalAmount')}</td>
                                                <td className="px-6 py-5 text-right text-xl text-blue-600">{formatCurrency(order.grand_total)}</td>
                                            </tr>
                                        </tfoot>
                                    </table>
                                </div>
                            </div>

                            {/* Payment History Section */}
                            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                                <div className="px-6 py-4 bg-gray-50 border-b border-gray-200 flex items-center gap-2">
                                    <Clock className="w-5 h-5 text-gray-400" />
                                    <h3 className="font-bold text-gray-700">{t('sales.paymentTracking.paymentHistoryModal.title')}</h3>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="bg-white border-b border-gray-100 text-gray-400 uppercase text-[10px] font-black tracking-widest">
                                                <th className="px-6 py-4 text-left">{t('sales.paymentTracking.paymentHistoryModal.tableHeaders.paymentDate')}</th>
                                                <th className="px-6 py-4 text-left">{t('sales.paymentTracking.paymentHistoryModal.tableHeaders.method')}</th>
                                                <th className="px-6 py-4 text-right">{t('sales.paymentTracking.paymentHistoryModal.tableHeaders.amount')}</th>
                                                <th className="px-6 py-4 text-left">{t('sales.paymentTracking.paymentHistoryModal.tableHeaders.notes')}</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-50">
                                            {order.paymentRecords && order.paymentRecords.length > 0 ? (
                                                order.paymentRecords.map((payment, idx) => (
                                                    <tr key={idx} className="hover:bg-gray-50 transition-colors">
                                                        <td className="px-6 py-4 text-gray-900 font-medium">
                                                            {new Date(payment.payment_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                                                        </td>
                                                        <td className="px-6 py-4">
                                                            <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 text-[10px] font-black uppercase tracking-tight">
                                                                {payment.payment_method}
                                                            </span>
                                                        </td>
                                                        <td className={`px-6 py-4 text-right font-black ${payment.payment_amount < 0 ? 'text-red-600 uppercase tracking-tight' : 'text-green-600'}`}>
                                                            {formatCurrency(payment.payment_amount)}
                                                        </td>
                                                        <td className="px-6 py-4 text-xs text-gray-400 italic">
                                                            {payment.notes || '-'}
                                                        </td>
                                                    </tr>
                                                ))
                                            ) : (
                                                <tr>
                                                    <td colSpan="4" className="px-6 py-12 text-center text-gray-400 font-medium bg-gray-50/50 italic">
                                                        {t('sales.paymentTracking.paymentHistoryModal.noRecords')}
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </>
                    ) : null}
                </div>
            </div>

            {/* Refund Modal */}
            <Modal
                isOpen={showRefundModal}
                onClose={() => setShowRefundModal(false)}
                title={t('sales.actions.refund') || 'Process Refund'}
                width="500px"
                onSubmit={handleConfirmRefund}
                submitText={t('common.confirm')}
                isSubmitting={refundLoading}
            >
                <div className="space-y-5 text-left">
                    <div className="p-4 bg-orange-50 rounded-xl border border-orange-100">
                        <p className="text-sm text-orange-800 font-medium leading-relaxed">
                            {t('sales.refundConfirmation')}
                        </p>
                    </div>

                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                {t('sales.paymentTracking.form.paymentAmount')}
                            </label>
                            <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-gray-400">₹</span>
                                <input
                                    type="number"
                                    className={`w-full pl-7 pr-4 py-2 border rounded-lg focus:ring-2 transition-all font-bold ${refundData.amount > order?.amount_paid
                                            ? 'border-red-300 focus:ring-red-500 focus:border-red-500 text-red-900'
                                            : 'border-gray-300 focus:ring-blue-500 focus:border-blue-500 text-gray-900'
                                        }`}
                                    value={refundData.amount}
                                    onChange={(e) => {
                                        const value = parseFloat(e.target.value) || 0;
                                        setRefundData({ ...refundData, amount: value });
                                    }}
                                    max={order?.amount_paid}
                                    step="0.01"
                                    min="0"
                                />
                            </div>
                            <div className="flex items-center justify-between mt-2">
                                <span className="text-xs text-gray-500">
                                    {t('sales.paymentTracking.form.maximum')}: {formatCurrency(order?.amount_paid || 0)}
                                </span>
                                {refundData.amount > order?.amount_paid && (
                                    <span className="text-xs text-red-600 font-medium">
                                        {t('sales.refundExceedsMaximum') || 'Exceeds maximum'}
                                    </span>
                                )}
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                {t('sales.paymentTracking.form.paymentMethod')}
                            </label>
                            <select
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all font-medium text-gray-900 appearance-none bg-white"
                                value={refundData.method}
                                onChange={(e) => setRefundData({ ...refundData, method: e.target.value })}
                            >
                                <option value="Cash">Cash</option>
                                <option value="Card">Card</option>
                                <option value="UPI">UPI</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                {t('sales.paymentTracking.form.notes')}
                            </label>
                            <textarea
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-sm font-medium text-gray-900 resize-none"
                                rows="3"
                                value={refundData.notes}
                                onChange={(e) => setRefundData({ ...refundData, notes: e.target.value })}
                                placeholder="Reference for this refund..."
                            ></textarea>
                        </div>
                    </div>
                </div>
            </Modal>
        </div>
    );
};

export default ViewOrderPage;
