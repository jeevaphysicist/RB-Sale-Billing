import React, { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ShoppingCart, Trash2, User, CreditCard, ShoppingBag, Plus, Save, ChevronLeft, Calendar, FileText, Truck, PenTool } from 'lucide-react';
import { customerService } from '../../../services/customerService';
import { salesOrderService } from '../../../services/salesOrderService';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../../contexts/authContext';
// import { transliterateToTamil, createSearchTerms } from '../../../utils/transliteration';

const SalesOrderForm = () => {
    const { t } = useTranslation();
    const { id } = useParams();
    const navigate = useNavigate();
    const { currentUser } = useAuth();
    const [isEditing, setIsEditing] = useState(false);

    const [formData, setFormData] = useState({
        orderNumber: '',
        orderDate: new Date().toISOString().split('T')[0]
    });

    const [billItems, setBillItems] = useState([]);
    const [selectedCustomer, setSelectedCustomer] = useState(null);
    const [billDiscount, setBillDiscount] = useState(0);
    const [discountType, setDiscountType] = useState('flat'); // 'flat' or 'percentage'
    const [paymentMethod, setPaymentMethod] = useState('cash');
    const [paymentType, setPaymentType] = useState('single');
    const [receivedAmount, setReceivedAmount] = useState(0);
    const [splitPayments, setSplitPayments] = useState({ cash: 0, card: 0, upi: 0, credit: 0, loyaltyPoints: 0 });

    // Tax Settings
    const [taxSettings, setTaxSettings] = useState({
        enableTax: true,
        taxType: 'SGST',
        taxIncludedInPrice: true
    });


    // Manual Item Entry State
    const [itemForm, setItemForm] = useState({
        name: '',
        code: '',
        hsnCode: '',
        category: '',
        unit: 'Piece',
        qty: 1,
        price: 0,
        mrp: 0,
        taxRate: 0
    });

    // Search States
    const [customers, setCustomers] = useState([]);
    const [filteredCustomers, setFilteredCustomers] = useState([]);
    const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
    const [customerSearchQuery, setCustomerSearchQuery] = useState('');

    const itemNameInputRef = useRef(null);
    const nextItemId = useRef(1);

    // Initialize Loading
    useEffect(() => {
        const initialize = async () => {
            // Load next order number
            if (!id) {
                try {
                    const response = await salesOrderService.getNextOrderNumber();
                    if (response.success) {
                        setFormData(prev => ({ ...prev, orderNumber: response.data }));
                    }
                } catch (error) {
                    console.error('Failed to get order number', error);
                }
            }

            // Load customers
            fetchCustomers();
        };

        initialize();
    }, [id]);

    const fetchCustomers = async () => {
        try {
            const response = await customerService.getCustomers({ limit: 100, status: 'Active' });
            if (response.success) {
                setCustomers(response.data);
            }
        } catch (error) {
            console.error('Error fetching customers', error);
        }
    };

    // Customer Search
    useEffect(() => {
        const query = customerSearchQuery.toLowerCase();
        const filtered = customers.filter(c =>
            (c.customer_name && c.customer_name.toLowerCase().includes(query)) ||
            (c.mobile_number && c.mobile_number.includes(query))
        ).slice(0, 10);
        setFilteredCustomers(filtered);
        // Don't show dropdown unless typing
        if (customerSearchQuery) setShowCustomerDropdown(true);
    }, [customerSearchQuery, customers]);


    const handleItemFormChange = (field, value) => {
        setItemForm(prev => ({ ...prev, [field]: value }));
    };

    const handleAddItem = () => {
        const name = itemForm.name.trim();
        if (!name) {
            toast.error("Please enter an item name");
            itemNameInputRef.current?.focus();
            return;
        }
        const qty = parseFloat(itemForm.qty);
        if (!qty || qty <= 0) {
            toast.error("Quantity must be greater than 0");
            return;
        }
        const price = parseFloat(itemForm.price) || 0;

        setBillItems([...billItems, {
            id: `manual-${nextItemId.current++}`,
            name,
            code: itemForm.code.trim(),
            price,
            mrp: parseFloat(itemForm.mrp) || 0,
            qty,
            unit: itemForm.unit || 'Piece',
            tax: parseFloat(itemForm.taxRate) || 0,
            discount: 0,
            hsnCode: itemForm.hsnCode.trim(),
            category: itemForm.category.trim()
        }]);

        setItemForm({
            name: '',
            code: '',
            hsnCode: '',
            category: '',
            unit: 'Piece',
            qty: 1,
            price: 0,
            mrp: 0,
            taxRate: 0
        });
        itemNameInputRef.current?.focus();
    };

    const updateItemQty = (id, newQty) => {
        const item = billItems.find(i => i.id === id);
        if (!item) return;

        // Enforce a reasonable hard limit (1,000,000)
        const validQty = Math.min(newQty, 1000000);

        setBillItems(billItems.map(i => i.id === id ? { ...i, qty: Math.max(1, validQty) } : i));
    };

    const updateItemPrice = (id, newPrice) => {
        setBillItems(billItems.map(item => item.id === id ? { ...item, price: newPrice } : item));
    };

    const removeItem = (id) => {
        setBillItems(billItems.filter(item => item.id !== id));
    };

    const handleBillDiscountChange = (value) => {
        const numValue = parseFloat(value) || 0;
        const amountAfterTax = totals.amountBeforeTax + totals.totalTax;

        if (discountType === 'percentage') {
            if (numValue > 100) {
                toast.warning("Discount percentage cannot exceed 100%");
                setBillDiscount(100);
            } else {
                setBillDiscount(Math.max(0, numValue));
            }
        } else {
            if (numValue > amountAfterTax) {
                toast.warning("Discount amount cannot exceed total amount");
                setBillDiscount(amountAfterTax);
            } else {
                setBillDiscount(Math.max(0, numValue));
            }
        }
    };

    // Calculation Helpers (POS Pattern)
    const calculateItemTotal = (item) => {
        const basePrice = item.price * item.qty;
        const discountAmount = (basePrice * (item.discount || 0)) / 100;
        const priceAfterDiscount = basePrice - discountAmount;

        if (taxSettings.enableTax && taxSettings.taxIncludedInPrice && item.tax > 0) {
            // Extract tax: taxableAmount = price / (1 + taxRate/100)
            return priceAfterDiscount / (1 + item.tax / 100);
        }
        return priceAfterDiscount;
    };

    const calculateItemTaxAmounts = (item) => {
        const basePrice = item.price * item.qty;
        const discountAmount = (basePrice * (item.discount || 0)) / 100;
        const priceAfterDiscount = basePrice - discountAmount;
        const taxRate = item.tax || 0;

        let taxAmount = 0;
        let sgstAmount = 0;
        let cgstAmount = 0;
        let igstAmount = 0;

        if (taxSettings.enableTax && taxRate > 0) {
            if (taxSettings.taxIncludedInPrice) {
                const taxableAmount = priceAfterDiscount / (1 + taxRate / 100);
                taxAmount = priceAfterDiscount - taxableAmount;
            } else {
                taxAmount = (priceAfterDiscount * taxRate) / 100;
            }

            if (taxSettings.taxType === 'SGST') {
                sgstAmount = taxAmount / 2;
                cgstAmount = taxAmount / 2;
            } else {
                igstAmount = taxAmount;
            }
        }

        return { taxAmount, sgstAmount, cgstAmount, igstAmount, taxRate };
    };

    const calculateTaxBreakdown = () => {
        let taxableAmount = 0;
        let totalSgst = 0;
        let totalCgst = 0;
        let totalIgst = 0;

        billItems.forEach(item => {
            const itemTotal = calculateItemTotal(item);
            const taxDetails = calculateItemTaxAmounts(item);

            taxableAmount += itemTotal;
            totalSgst += taxDetails.sgstAmount;
            totalCgst += taxDetails.cgstAmount;
            totalIgst += taxDetails.igstAmount;
        });

        return {
            taxableAmount,
            totalSgst,
            totalCgst,
            totalIgst,
            totalTax: totalSgst + totalCgst + totalIgst
        };
    };

    const calculateTotals = () => {
        const subtotal = billItems.reduce((sum, item) => sum + (item.price * item.qty), 0);
        const amountBeforeTax = billItems.reduce((sum, item) => sum + calculateItemTotal(item), 0);
        const taxBreakdown = calculateTaxBreakdown();
        const totalTax = taxBreakdown.totalTax;
        const amountAfterTax = amountBeforeTax + totalTax;

        const billDiscountAmount = discountType === 'percentage'
            ? (amountAfterTax * billDiscount) / 100
            : billDiscount;

        const amountBeforeRounding = amountAfterTax - billDiscountAmount;
        const grandTotal = Math.round(amountBeforeRounding);
        const finalRoundOff = grandTotal - amountBeforeRounding;

        return {
            subtotal,
            amountBeforeTax,
            totalTax,
            taxBreakdown,
            billDiscountAmount,
            grandTotal,
            roundOff: finalRoundOff
        };
    };

    const totals = calculateTotals();

    const handleSave = async () => {
        if (!selectedCustomer) {
            toast.error("Please select a customer");
            return;
        }
        if (billItems.length === 0) {
            toast.error("Please add items to order");
            return;
        }

        // Structure data to match backend expectations
        const orderData = {
            orderDate: formData.orderDate,
            orderTime: new Date().toLocaleTimeString('en-US', { hour12: false }),

            customer: {
                id: selectedCustomer.id,
                name: selectedCustomer.customer_name,
                phone: selectedCustomer.mobile_number || '',
                email: selectedCustomer.email || '',
                address: selectedCustomer.address_line_1 || '',
                gstin: selectedCustomer.gstin || ''
            },

            storeDetails: {
                store: currentUser?.store_name || 'Main Store',
                counter: currentUser?.counter || 'Counter 1',
                cashier: currentUser?.username || 'Admin',
                cashierId: currentUser?.id || 1
            },

            items: billItems.map(item => {
                const taxDetails = calculateItemTaxAmounts(item);
                const itemTotal = calculateItemTotal(item);
                const grossAmount = item.price * item.qty;
                const discountAmount = (grossAmount * (item.discount || 0)) / 100;

                return {
                    productName: item.name,
                    productCode: item.code || '',
                    hsnCode: item.hsnCode || '',
                    category: item.category || '',
                    unit: item.unit,
                    quantity: item.qty,
                    unitPrice: item.price,
                    mrp: item.mrp || item.price,
                    itemDiscount: item.discount || 0,
                    itemDiscountAmount: discountAmount,
                    taxRate: taxDetails.taxRate,
                    sgstAmount: taxDetails.sgstAmount,
                    cgstAmount: taxDetails.cgstAmount,
                    igstAmount: taxDetails.igstAmount,
                    totalTaxAmount: taxDetails.taxAmount,
                    grossAmount: grossAmount,
                    netAmount: grossAmount - discountAmount,
                    finalAmount: taxSettings.taxIncludedInPrice ? (grossAmount - discountAmount) : (grossAmount - discountAmount + taxDetails.taxAmount)
                };
            }),

            calculations: {
                itemCount: billItems.length,
                totalQuantity: billItems.reduce((sum, item) => sum + item.qty, 0),
                subtotal: totals.subtotal,
                totalItemDiscounts: billItems.reduce((sum, item) => sum + (item.price * item.qty * (item.discount || 0)) / 100, 0),
                billDiscount: billDiscount,
                billDiscountType: discountType,
                billDiscountAmount: totals.billDiscountAmount,
                taxDetails: {
                    taxableAmount: totals.amountBeforeTax,
                    totalSgst: totals.taxBreakdown.totalSgst,
                    totalCgst: totals.taxBreakdown.totalCgst,
                    totalIgst: totals.taxBreakdown.totalIgst,
                    totalTaxAmount: totals.totalTax
                },
                amountBeforeTax: totals.amountBeforeTax,
                amountAfterTax: totals.amountBeforeTax + totals.totalTax,
                roundOffAmount: totals.roundOff,
                grandTotal: totals.grandTotal,
                loyaltyPointsUsed: 0,
                loyaltyPointsValue: 0
            },

            payment: {
                paymentType: paymentType,
                paymentMethod: paymentMethod,
                receivedAmount: receivedAmount || totals.grandTotal,
                changeAmount: Math.max(0, (receivedAmount || totals.grandTotal) - totals.grandTotal),
                balanceAmount: Math.max(0, totals.grandTotal - (receivedAmount || totals.grandTotal)),
                splitPayments: splitPayments
            },

            // Invoice Data
            status: {
                orderStatus: 'completed',
                paymentStatus: (receivedAmount || totals.grandTotal) >= totals.grandTotal ? 'paid' : 'pending',
                deliveryStatus: 'pending'
            }
        };

        try {
            console.log('Submitting order data:', orderData);
            const result = await salesOrderService.create(orderData);
            if (result.success) {
                toast.success("Order Created Successfully");
                navigate('/sales');
            } else {
                toast.error(result.message || "Failed to create order");
            }
        } catch (e) {
            console.error('Order creation error:', e);
            toast.error("Error creating order: " + (e.message || 'Unknown error'));
        }
    };

    return (
        <div className="bg-white min-h-screen flex flex-col">
            {/* Sticky Header */}
            <div className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-gray-200 px-6 py-4 flex items-center gap-4 shadow-sm">
                <button onClick={() => navigate('/sales')} className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-600">
                    <ChevronLeft size={24} />
                </button>
                <h1 className="text-xl font-bold text-gray-800">{isEditing ? 'Edit Sales Order' : 'New Sales Invoice'}</h1>
            </div>

            <div className="flex-1 p-4 lg:p-8 bg-gray-50/50">
                <div className="max-w-[1600px] mx-auto pb-24">

                    {/* Top Section: Customer & Invoice Details */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
                        {/* Customer Selection */}
                        <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 lg:col-span-1">
                            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4 flex items-center">
                                <User size={16} className="mr-2" /> Customer Details
                            </h2>

                            <div className="relative mb-3">
                                <input
                                    type="text"
                                    placeholder="Search Customer (Name/Phone)..."
                                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                                    value={customerSearchQuery}
                                    onChange={(e) => setCustomerSearchQuery(e.target.value)}
                                    onFocus={() => setShowCustomerDropdown(true)}
                                    onBlur={() => setTimeout(() => setShowCustomerDropdown(false), 200)}
                                />
                                {showCustomerDropdown && filteredCustomers.length > 0 && (
                                    <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                                        {filteredCustomers.map(customer => (
                                            <div
                                                key={customer.id}
                                                className="p-3 hover:bg-blue-50 cursor-pointer border-b border-gray-50 last:border-0"
                                                onClick={() => {
                                                    setSelectedCustomer(customer);
                                                    setCustomerSearchQuery(customer.customer_name);
                                                    setShowCustomerDropdown(false);
                                                }}
                                            >
                                                <div className="font-medium text-gray-800">{customer.customer_name}</div>
                                                <div className="text-xs text-gray-500">{customer.mobile_number}</div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {selectedCustomer && (
                                <div className="bg-blue-50 p-3 rounded-lg border border-blue-100 mt-3">
                                    <div className="font-bold text-blue-900">{selectedCustomer.customer_name}</div>
                                    <div className="text-sm text-blue-700 mt-1">{selectedCustomer.mobile_number}</div>
                                    <div className="text-xs text-blue-600 mt-1 opacity-75">{selectedCustomer.address_line_1}</div>
                                    {selectedCustomer.gstin && <div className="text-xs font-mono bg-blue-100 text-blue-800 inline-block px-2 py-0.5 rounded mt-2">GST: {selectedCustomer.gstin}</div>}
                                </div>
                            )}
                        </div>

                        {/* Invoice Meta Data - 2 Columns */}
                        <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 lg:col-span-2">
                            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4 flex items-center">
                                <FileText size={16} className="mr-2" /> Invoice Details
                            </h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                <div>
                                    <label className="block text-xs font-medium text-gray-700 mb-1">Invoice No</label>
                                    <input type="text" className="w-full p-2 border border-gray-300 rounded bg-gray-50" value={formData.orderNumber} readOnly />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-gray-700 mb-1">Invoice Date</label>
                                    <input
                                        type="date"
                                        className="w-full p-2 border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
                                        value={formData.orderDate}
                                        onChange={(e) => setFormData({ ...formData, orderDate: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-gray-700 mb-1">Payment Method</label>
                                    <select
                                        className="w-full p-2 border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
                                        value={paymentMethod}
                                        onChange={(e) => setPaymentMethod(e.target.value)}
                                    >
                                        <option value="cash">Cash</option>
                                        <option value="card">Card</option>
                                        <option value="upi">UPI</option>
                                        <option value="bank_transfer">Bank Transfer</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                    </div>



                    {/* Tax Settings - Compact Design */}
                    <div className="bg-white px-5 py-3 rounded-xl shadow-sm border border-gray-100 mb-6 flex items-center justify-between">
                        <div className="flex items-center gap-6">
                            <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest mr-2">Tax Settings</h2>
                            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 cursor-pointer hover:text-blue-600 transition-colors">
                                <input
                                    type="checkbox"
                                    className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                                    checked={taxSettings.enableTax}
                                    onChange={(e) => setTaxSettings({ ...taxSettings, enableTax: e.target.checked })}
                                />
                                <span>{t('sales.pos.billItems.tax')}</span>
                            </label>

                            {taxSettings.enableTax && (
                                <>
                                    <div className="h-4 w-px bg-gray-200 mx-2"></div>
                                    <div className="flex items-center gap-4">
                                        <label className="flex items-center gap-1.5 text-sm text-gray-600 cursor-pointer hover:text-blue-500">
                                            <input
                                                type="radio"
                                                name="taxType"
                                                value="SGST"
                                                className="w-3.5 h-3.5 text-blue-600 focus:ring-blue-500"
                                                checked={taxSettings.taxType === 'SGST'}
                                                onChange={(e) => setTaxSettings({ ...taxSettings, taxType: e.target.value })}
                                            />
                                            <span>{t('sales.pos.billItems.sgstCgst')}</span>
                                        </label>
                                        <label className="flex items-center gap-1.5 text-sm text-gray-600 cursor-pointer hover:text-blue-500">
                                            <input
                                                type="radio"
                                                name="taxType"
                                                value="IGST"
                                                className="w-3.5 h-3.5 text-blue-600 focus:ring-blue-500"
                                                checked={taxSettings.taxType === 'IGST'}
                                                onChange={(e) => setTaxSettings({ ...taxSettings, taxType: e.target.value })}
                                            />
                                            <span>{t('sales.pos.billItems.igst')}</span>
                                        </label>
                                    </div>
                                    <div className="h-4 w-px bg-gray-200 mx-2"></div>
                                    <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer hover:text-blue-500">
                                        <input
                                            type="checkbox"
                                            className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                                            checked={taxSettings.taxIncludedInPrice}
                                            onChange={(e) => setTaxSettings({ ...taxSettings, taxIncludedInPrice: e.target.checked })}
                                        />
                                        <span>{t('sales.pos.billItems.incPrice')}</span>
                                    </label>
                                </>
                            )}
                        </div>
                    </div>

                    {/* Item Entry & Table */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-100 min-h-[400px] flex flex-col">
                        {/* Add Item Form */}
                        <div className="p-4 border-b border-gray-200 bg-gray-50/50">
                            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-9 gap-3 items-end">
                                <div className="col-span-2 lg:col-span-2">
                                    <label className="block text-xs font-medium text-gray-700 mb-1">Item Name *</label>
                                    <input
                                        ref={itemNameInputRef}
                                        type="text"
                                        placeholder="Enter item name"
                                        className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm"
                                        value={itemForm.name}
                                        onChange={(e) => handleItemFormChange('name', e.target.value)}
                                        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddItem(); } }}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-gray-700 mb-1">Code</label>
                                    <input
                                        type="text"
                                        className="w-full p-2 border border-gray-300 rounded-lg outline-none text-sm"
                                        value={itemForm.code}
                                        onChange={(e) => handleItemFormChange('code', e.target.value)}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-gray-700 mb-1">HSN Code</label>
                                    <input
                                        type="text"
                                        className="w-full p-2 border border-gray-300 rounded-lg outline-none text-sm"
                                        value={itemForm.hsnCode}
                                        onChange={(e) => handleItemFormChange('hsnCode', e.target.value)}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-gray-700 mb-1">Category</label>
                                    <input
                                        type="text"
                                        className="w-full p-2 border border-gray-300 rounded-lg outline-none text-sm"
                                        value={itemForm.category}
                                        onChange={(e) => handleItemFormChange('category', e.target.value)}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-gray-700 mb-1">Unit</label>
                                    <input
                                        type="text"
                                        className="w-full p-2 border border-gray-300 rounded-lg outline-none text-sm"
                                        value={itemForm.unit}
                                        onChange={(e) => handleItemFormChange('unit', e.target.value)}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-gray-700 mb-1">Qty</label>
                                    <input
                                        type="number"
                                        min="0"
                                        step="1"
                                        className="w-full p-2 border border-gray-300 rounded-lg outline-none text-sm"
                                        value={itemForm.qty}
                                        onChange={(e) => handleItemFormChange('qty', e.target.value)}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-gray-700 mb-1">Price</label>
                                    <input
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        className="w-full p-2 border border-gray-300 rounded-lg outline-none text-sm"
                                        value={itemForm.price}
                                        onChange={(e) => handleItemFormChange('price', e.target.value)}
                                    />
                                </div>
                                <div>
                                    <button
                                        onClick={handleAddItem}
                                        className="w-full bg-blue-600 hover:bg-blue-700 text-white p-2 rounded-lg flex items-center justify-center font-semibold text-sm transition-colors"
                                    >
                                        <Plus size={16} className="mr-1" /> Add
                                    </button>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 items-end mt-3">
                                <div>
                                    <label className="block text-xs font-medium text-gray-700 mb-1">MRP</label>
                                    <input
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        className="w-full p-2 border border-gray-300 rounded-lg outline-none text-sm"
                                        value={itemForm.mrp}
                                        onChange={(e) => handleItemFormChange('mrp', e.target.value)}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-gray-700 mb-1">Tax Rate %</label>
                                    <input
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        className="w-full p-2 border border-gray-300 rounded-lg outline-none text-sm"
                                        value={itemForm.taxRate}
                                        onChange={(e) => handleItemFormChange('taxRate', e.target.value)}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Items Table */}
                        <div className="flex-1">
                            <table className="w-full text-left border-collapse">
                                <thead className="bg-gray-50 text-xs font-semibold text-gray-600 uppercase tracking-wider sticky top-0">
                                    <tr>
                                        <th className="px-4 py-3 w-12 text-center text-xs font-semibold uppercase tracking-wider">#</th>
                                        <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider">Item Description</th>
                                        <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider w-20">HSN</th>
                                        <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider w-24">Unit</th>
                                        <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider w-24">Qty</th>
                                        <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider w-32">Price</th>
                                        <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider w-24">Disc %</th>
                                        {taxSettings.enableTax && <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider w-32">Tax ({taxSettings.taxType === 'SGST' ? 'SGST+CGST' : 'IGST'})</th>}
                                        <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider w-32">Final Amt</th>
                                        <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider w-16">Act</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {billItems.length === 0 ? (
                                        <tr>
                                            <td colSpan="9" className="px-4 py-12 text-center text-gray-400">
                                                <ShoppingBag size={48} className="mx-auto mb-3 opacity-20" />
                                                <p>No items added yet. Use the form above to add an item.</p>
                                            </td>
                                        </tr>
                                    ) : (
                                        billItems.map((item, index) => {
                                            const taxDetails = calculateItemTaxAmounts(item);
                                            const itemTotal = calculateItemTotal(item);
                                            const finalItemAmount = taxSettings.taxIncludedInPrice
                                                ? (item.price * item.qty - (item.price * item.qty * item.discount / 100))
                                                : (item.price * item.qty - (item.price * item.qty * item.discount / 100) + taxDetails.taxAmount);

                                            return (
                                                <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                                                    <td className="px-4 py-3 text-gray-500 text-center">{index + 1}</td>
                                                    <td className="px-4 py-3">
                                                        <div className="font-medium text-gray-800">{item.name}</div>
                                                        <div className="text-[10px] text-gray-400 font-mono">{item.code}</div>
                                                    </td>
                                                    <td className="px-4 py-3 text-center text-sm text-gray-600 font-mono">{item.hsnCode || '-'}</td>
                                                    <td className="px-4 py-3 text-right text-gray-600 text-sm">{item.unit}</td>
                                                    <td className="px-4 py-3 text-center">
                                                        <input
                                                            type="number"
                                                            min="1"
                                                            className="w-16 p-1 border border-gray-300 rounded text-center focus:border-blue-500 outline-none text-sm"
                                                            value={item.qty}
                                                            onChange={(e) => {
                                                                const val = parseInt(e.target.value) || 0;
                                                                updateItemQty(item.id, val);
                                                            }}
                                                        />
                                                    </td>
                                                    <td className="px-4 py-3 text-right">
                                                        <div className="flex items-center justify-end">
                                                            <span className="text-gray-400 mr-1 text-xs">₹</span>
                                                            <input
                                                                type="number"
                                                                step="0.01"
                                                                className="w-20 p-1 border border-gray-300 rounded text-right focus:border-blue-500 outline-none text-sm"
                                                                value={item.price}
                                                                onChange={(e) => updateItemPrice(item.id, parseFloat(e.target.value) || 0)}
                                                            />
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-3 text-right text-gray-700 text-sm">
                                                        <input
                                                            type="number"
                                                            min="0"
                                                            max="100"
                                                            className="w-16 p-1 border border-gray-200 rounded text-right text-sm outline-none focus:border-blue-300"
                                                            value={item.discount}
                                                            onChange={(e) => {
                                                                const val = Math.min(100, Math.max(0, parseFloat(e.target.value) || 0));
                                                                setBillItems(billItems.map(i => i.id === item.id ? { ...i, discount: val } : i));
                                                            }}
                                                        />
                                                    </td>
                                                    {taxSettings.enableTax && (
                                                        <td className="px-4 py-3 text-right text-gray-600">
                                                            <div className="text-xs font-semibold text-purple-700">₹{taxDetails.taxAmount.toFixed(2)}</div>
                                                            <div className="text-[9px] text-gray-400">{taxDetails.taxRate}% ({taxSettings.taxIncludedInPrice ? 'Inc' : 'Exc'})</div>
                                                        </td>
                                                    )}
                                                    <td className="px-4 py-3 text-right font-bold text-gray-800 whitespace-nowrap">₹{finalItemAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                                    <td className="px-4 py-3 text-center">
                                                        <button onClick={() => removeItem(item.id)} className="text-red-400 hover:text-red-600 p-1 rounded-full hover:bg-red-50">
                                                            <Trash2 size={16} />
                                                        </button>
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {/* Summary Footer */}
                        <div className="bg-gray-50 border-t border-gray-200 p-6 rounded-b-xl">
                            <div className="flex justify-end">
                                <div className="w-full md:w-[450px] space-y-3">
                                    <div className="flex justify-between items-center text-sm text-gray-600">
                                        <span className="font-medium">Before Tax:</span>
                                        <span className="font-semibold text-gray-900">₹{totals.amountBeforeTax.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                    </div>
                                    {taxSettings.enableTax && (
                                        <>
                                            {taxSettings.taxType === 'SGST' ? (
                                                <>
                                                    <div className="flex justify-between text-xs text-gray-500">
                                                        <span>SGST:</span>
                                                        <span>₹{totals.taxBreakdown.totalSgst.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                                    </div>
                                                    <div className="flex justify-between text-xs text-gray-500">
                                                        <span>CGST:</span>
                                                        <span>₹{totals.taxBreakdown.totalCgst.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                                    </div>
                                                </>
                                            ) : (
                                                <div className="flex justify-between text-xs text-gray-500">
                                                    <span>IGST:</span>
                                                    <span>₹{totals.taxBreakdown.totalIgst.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                                </div>
                                            )}
                                            <div className="flex justify-between text-sm text-purple-700 font-medium">
                                                <span>Total Tax:</span>
                                                <span>₹{totals.totalTax.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                            </div>
                                        </>
                                    )}
                                    <div className="flex justify-between items-center text-sm text-gray-600 bg-yellow-50 p-1 rounded">
                                        <span className="font-medium">Bill Discount:</span>
                                        <div className="flex items-center space-x-1">
                                            <input
                                                type="number"
                                                min="0"
                                                max={discountType === 'percentage' ? 100 : totals.amountBeforeTax + totals.totalTax}
                                                className="w-14 p-1 text-right text-xs border border-yellow-200 rounded outline-none focus:ring-1 focus:ring-yellow-400"
                                                value={billDiscount}
                                                onChange={(e) => handleBillDiscountChange(e.target.value)}
                                            />
                                            <select
                                                className="p-1 text-[10px] border border-yellow-200 rounded bg-white outline-none"
                                                value={discountType}
                                                onChange={(e) => setDiscountType(e.target.value)}
                                            >
                                                <option value="flat">₹</option>
                                                <option value="percentage">%</option>
                                            </select>
                                        </div>
                                    </div>
                                    <div className="flex justify-between text-xs text-gray-500 px-1">
                                        <span>Discount Amt:</span>
                                        <span>-₹{totals.billDiscountAmount.toFixed(2)}</span>
                                    </div>
                                    <div className="flex justify-between text-xs text-gray-400 px-1 italic">
                                        <span>Round Off:</span>
                                        <span>{totals.roundOff >= 0 ? '+' : ''}₹{totals.roundOff.toFixed(2)}</span>
                                    </div>
                                    <div className="border-t-2 border-blue-200 pt-3 flex justify-between items-center font-bold text-2xl text-blue-900">
                                        <span className="text-lg whitespace-nowrap mr-8">Net Payable:</span>
                                        <span className="text-right">₹{totals.grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                </div>
            </div>

            {/* Sticky Bottom Action Bar */}
            <div className="sticky bottom-0 z-40 bg-white border-t border-gray-200 px-8 py-4 flex justify-between items-center shadow-[0_-4px_10px_rgba(0,0,0,0.03)] mt-auto">
                <div className="text-sm text-gray-500">
                    <span className="font-medium">{billItems.length}</span> Items in Invoice
                </div>
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => navigate('/sales')}
                        className="px-6 py-2.5 border border-gray-300 rounded-lg text-gray-700 font-semibold hover:bg-gray-50 transition-all"
                    >
                        {t('common.cancel') || 'Cancel'}
                    </button>
                    <button
                        onClick={handleSave}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-10 py-2.5 rounded-lg flex items-center shadow-lg font-bold text-lg transition-all hover:scale-[1.02] active:scale-[0.98]"
                    >
                        <Save size={22} className="mr-2" />
                        {t('common.save')}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default SalesOrderForm;
