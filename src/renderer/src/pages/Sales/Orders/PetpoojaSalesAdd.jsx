import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { salesOrderService } from '../../../services/salesOrderService';
import { customerService } from '../../../services/customerService';
import { toast } from 'sonner';
import { useAuth } from '../../../contexts/authContext';
import WindowControls from '../../../components/WindowControls';
import Modal from '../../../components/Modal';
import PrintPreviewModal from '../../../components/PrintPreviewModal';
import CustomerAddEditForm from '../../Masters/Customer/AddEditForm';
import { useTranslation } from 'react-i18next';
import * as LucideIcons from 'lucide-react';
import { Search, UserPlus, Star, Tag, Trash2, Clock, Plus, Minus, PackagePlus } from 'lucide-react';

const PetpoojaSalesAdd = () => {
    const navigate = useNavigate();
    const { currentUser } = useAuth();
    const { t } = useTranslation();

    // State management
    const [cart, setCart] = useState([]);
    const [itemName, setItemName] = useState('');
    const [itemQty, setItemQty] = useState(1);
    const [itemPrice, setItemPrice] = useState('');
    const [currentTime, setCurrentTime] = useState(new Date().toLocaleTimeString());
    const [billNo, setBillNo] = useState('');
    const [isFullscreen, setIsFullscreen] = useState(false);

    // Payment Modal State
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [paymentMode, setPaymentMode] = useState('single'); // 'single' | 'split'
    const [selectedPaymentMethod, setSelectedPaymentMethod] = useState('cash');
    const [receivedAmount, setReceivedAmount] = useState(0);
    const [splitPayments, setSplitPayments] = useState({
        cash: 0,
        card: 0,
        upi: 0,
        credit: 0 // Used for remaining balance / pay later
    });

    // Customer & Order Mode State
    const [orderType, setOrderType] = useState('takeaway'); // 'takeaway' | 'dinein' | 'online'
    const [selectedCustomer, setSelectedCustomer] = useState(null);
    const [customerSearchQuery, setCustomerSearchQuery] = useState('');
    const [customerSearchResults, setCustomerSearchResults] = useState([]);
    const [isSearchingCustomer, setIsSearchingCustomer] = useState(false);
    const [showCustomerModal, setShowCustomerModal] = useState(false);

    // Discount & Loyalty State
    const [discount, setDiscount] = useState({ type: 'flat', value: 0 }); // { type: 'flat'|'percentage', value: number }
    const [redeemPoints, setRedeemPoints] = useState(false);
    const [showDiscountModal, setShowDiscountModal] = useState(false);

    // Printing State
    const [showPrintModal, setShowPrintModal] = useState(false);
    const [pdfUrl, setPdfUrl] = useState(null);
    const [pdfBase64, setPdfBase64] = useState(null);
    const [pdfHeight, setPdfHeight] = useState(null);
    const printModalRef = useRef(null);
    const itemNameRef = useRef(null);
    const customerSearchRef = useRef(null);
    const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
    const [isSubmittingOrder, setIsSubmittingOrder] = useState(false);

    // Load initial data
    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date().toLocaleTimeString()), 1000);
        fetchBillNo();

        // Check initial fullscreen state and auto-enter
        if (window.api && window.api.isFullscreen) {
            window.api.isFullscreen().then(fs => {
                setIsFullscreen(fs);
                if (!fs && window.api.toggleFullscreen) {
                    // Auto-enter fullscreen for POS experience
                    window.api.toggleFullscreen();
                }
            });
        }

        // Listen for fullscreen events
        let unsubscribeFs;
        let unsubscribeUnFs;
        if (window.api && window.api.onWindowFullscreen) {
            unsubscribeFs = window.api.onWindowFullscreen(() => setIsFullscreen(true));
            unsubscribeUnFs = window.api.onWindowUnfullscreen(() => setIsFullscreen(false));
        }

        return () => {
            clearInterval(timer);
            if (unsubscribeFs) unsubscribeFs();
            if (unsubscribeUnFs) unsubscribeUnFs();
        };
    }, []);

    const toggleFullscreen = () => {
        if (window.api && window.api.toggleFullscreen) {
            window.api.toggleFullscreen();
        }
    };


    const orderTypeLabels = {
        takeaway: 'Take Away',
        dinein: 'Dine In',
        online: 'Online'
    };

    const fetchBillNo = async () => {
        try {
            const resp = await salesOrderService.getNextOrderNumber();
            if (resp.success) setBillNo(resp.data);
        } catch (e) {
            console.error('Failed to fetch bill no', e);
        }
    };

    // Customer Search Effect
    useEffect(() => {
        const timer = setTimeout(async () => {
            if (customerSearchQuery.trim().length >= 2) {
                setIsSearchingCustomer(true);
                try {
                    const resp = await customerService.getCustomers({
                        search: customerSearchQuery,
                        limit: 5
                    });
                    if (resp.success) {
                        setCustomerSearchResults(resp.data);
                    }
                } catch (e) {
                    console.error('Customer search failed', e);
                } finally {
                    setIsSearchingCustomer(false);
                }
            } else {
                setCustomerSearchResults([]);
            }
        }, 300);
        return () => clearTimeout(timer);
    }, [customerSearchQuery]);

    // Cart operations
    const addManualItem = () => {
        const name = itemName.trim();
        const qty = parseFloat(itemQty) || 0;
        const price = parseFloat(itemPrice) || 0;

        if (!name) {
            toast.error('Item name is required');
            itemNameRef.current?.focus();
            return;
        }
        if (qty <= 0) {
            toast.error('Quantity must be greater than 0');
            return;
        }

        setCart([...cart, {
            id: `manual-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            name,
            price,
            qty
        }]);

        // Reset the entry form for the next item
        setItemName('');
        setItemQty(1);
        setItemPrice('');
        itemNameRef.current?.focus();
    };

    const updateQty = (id, delta) => {
        setCart(cart.map(item => {
            if (item.id === id) {
                const newQty = Math.max(0, parseFloat(item.qty || 0) + delta);
                if (newQty <= 0) return null; // Remove if zero or less
                return { ...item, qty: newQty };
            }
            return item;
        }).filter(Boolean));
    };

    const setQty = (id, value) => {
        const newQty = parseFloat(value) || 0;
        setCart(cart.map(item => {
            if (item.id === id) {
                return { ...item, qty: newQty };
            }
            return item;
        }));
    };

    const setPrice = (id, value) => {
        const newPrice = parseFloat(value) || 0;
        setCart(cart.map(item => {
            if (item.id === id) {
                return { ...item, price: newPrice };
            }
            return item;
        }));
    };

    const removeFromCart = (id) => setCart(cart.filter(item => item.id !== id));
    const clearCart = () => setCart([]);

    // Calculations
    const subtotal = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
    const discountAmount = discount.type === 'percentage'
        ? (subtotal * parseFloat(discount.value || 0) / 100)
        : parseFloat(discount.value || 0);

    const taxableAmount = Math.max(0, subtotal - discountAmount);
    const loyaltyValue = redeemPoints && selectedCustomer ? (selectedCustomer.points || 0) : 0;
    const grandTotal = Math.max(0, taxableAmount - loyaltyValue);

    // Handle checkout
    const handlePaymentClick = () => {
        if (cart.length === 0) {
            toast.error("Cart is empty");
            return;
        }
        setReceivedAmount(Math.round(grandTotal));
        setSplitPayments({
            cash: Math.round(grandTotal),
            card: 0,
            upi: 0,
            credit: 0
        });
        setPaymentMode('single');
        setSelectedPaymentMethod('cash');
        setShowPaymentModal(true);
    };

    const handleSplitChange = (method, value) => {
        const val = parseFloat(value) || 0;
        setSplitPayments(prev => ({ ...prev, [method]: val }));
    };

    const calculateBalance = () => {
        if (paymentMode === 'single') {
            if (selectedPaymentMethod === 'credit') return Math.round(grandTotal);
            return Math.max(0, Math.round(grandTotal) - receivedAmount);
        }
        const totalPaid = Object.entries(splitPayments).reduce((sum, [k, v]) => k !== 'credit' ? sum + v : sum, 0);
        return Math.max(0, Math.round(grandTotal) - totalPaid);
    };

    const calculateChange = () => {
        if (paymentMode === 'single' && selectedPaymentMethod !== 'credit') {
            return Math.max(0, receivedAmount - Math.round(grandTotal));
        }
        return 0;
    };

    // Generate PDF for printing
    const handleGeneratePDF = async (orderId, template = null) => {
        try {
            setIsGeneratingPdf(true);
            setPdfHeight(null);

            const response = await salesOrderService.generatePDF(orderId, template);

            if (response.success) {
                const blob = new Blob([response.data], { type: 'application/pdf' });
                const url = URL.createObjectURL(blob);
                setPdfUrl(url);

                if (response.height) {
                    setPdfHeight(response.height);
                }

                const base64data = await new Promise((resolve) => {
                    const reader = new FileReader();
                    reader.readAsDataURL(blob);
                    reader.onloadend = () => {
                        const b64 = reader.result.split(',')[1];
                        setPdfBase64(b64);
                        resolve(b64);
                    };
                });

                return { success: true, base64: base64data, height: response.height };
            } else {
                toast.error('Failed to generate receipt PDF');
                return { success: false };
            }
        } catch (error) {
            console.error('PDF Generation Error:', error);
            toast.error('Error generating PDF');
            return { success: false, error };
        } finally {
            setIsGeneratingPdf(false);
        }
    };

    // Final checkout submission
    const submitOrder = async (shouldPrint = true) => {
        if (isSubmittingOrder) return;
        setIsSubmittingOrder(true);
        const balance = calculateBalance();

        let finalPaymentStatus = 'paid';
        let finalReceivedAmount = 0;
        let finalPaymentMethod = paymentMode === 'single' ? selectedPaymentMethod : 'split';
        let finalSplitPayments = { ...splitPayments };

        if (paymentMode === 'single') {
            if (selectedPaymentMethod === 'credit') {
                finalPaymentStatus = 'pending';
                finalReceivedAmount = 0;
            } else {
                finalReceivedAmount = receivedAmount;
                if (balance > 0) finalPaymentStatus = 'partial'; // Should not happen for single unless partial cash logic used
                // For single payment, change is returned, so received is effectively capped at grandTotal for database
            }
        } else {
            // Split payment
            const totalCashCardUpi = splitPayments.cash + splitPayments.card + splitPayments.upi;
            finalReceivedAmount = totalCashCardUpi;
            finalSplitPayments.credit = balance; // Assign remaining to credit

            if (balance > 0) {
                finalPaymentStatus = totalCashCardUpi > 0 ? 'partial' : 'pending';
            }
        }

        const orderData = {
            orderDate: new Date().toISOString().split('T')[0],
            orderTime: new Date().toLocaleTimeString('en-GB'),
            customer: selectedCustomer ? {
                id: selectedCustomer.id,
                name: selectedCustomer.customer_name,
                phone: selectedCustomer.mobile_number || "",
                email: selectedCustomer.email || "",
                address: selectedCustomer.address_line_1 || "",
                gstin: selectedCustomer.gstin || ""
            } : {
                id: 0,
                name: "Walk-in Customer",
                phone: "",
                email: "",
                address: "",
                gstin: ""
            },
            items: cart.map(item => ({
                productName: item.name,
                quantity: item.qty,
                unitPrice: item.price,
                taxRate: 0,
                totalTaxAmount: 0,
                finalAmount: item.price * item.qty
            })),
            calculations: {
                subtotal,
                billDiscount: discount.value,
                billDiscountType: discount.type,
                billDiscountAmount: discountAmount,
                taxDetails: {
                    totalTaxAmount: 0,
                    taxableAmount: taxableAmount,
                    totalSgst: 0,
                    totalCgst: 0,
                    totalIgst: 0
                },
                grandTotal: Math.round(grandTotal),
                roundOffAmount: Math.round(grandTotal) - grandTotal,
                itemCount: cart.length,
                totalQuantity: cart.reduce((acc, item) => acc + item.qty, 0),
                totalItemDiscounts: 0,
                amountBeforeTax: taxableAmount,
                amountAfterTax: grandTotal,
                loyaltyPointsUsed: redeemPoints && selectedCustomer ? (selectedCustomer.points || 0) : 0,
                loyaltyPointsValue: loyaltyValue
            },
            payment: {
                paymentType: paymentMode,
                paymentMethod: finalPaymentMethod,
                receivedAmount: finalReceivedAmount,
                changeAmount: calculateChange(),
                splitPayments: paymentMode === 'split' ? finalSplitPayments : null,
                balanceAmount: balance
            },
            status: {
                orderStatus: 'completed',
                paymentStatus: finalPaymentStatus,
                deliveryStatus: 'delivered',
                orderType: orderType // takeaway, dinein, online
            },
            storeDetails: {
                store: "RABTOISE",
                counter: "POS-1",
                cashier: currentUser?.username || "Admin",
                cashierId: currentUser?.id || 1
            },
            additionalInfo: {
                customerNotes: "",
                termsAndConditions: ""
            }
        };

        try {
            const resp = await salesOrderService.create(orderData);
            if (resp.success) {
                toast.success("Order created successfully");
                clearCart();
                fetchBillNo();

                if (!shouldPrint) {
                    setShowPaymentModal(false);
                }

                // Start Printing Process
                if (shouldPrint) {
                    try {
                        // 1. Get printer settings first to determine template size
                        const printerConfig = await window.api.getPrinterSettings();

                        // 2. Determine template based on printer settings or fallback
                        let template = 'A4';
                        if (printerConfig && printerConfig.pageSize) {
                            template = printerConfig.pageSize;
                        }

                        // 3. Generate PDF with correct template
                        const pdfResult = await handleGeneratePDF(resp.orderId, template);

                        if (pdfResult && pdfResult.success) {
                            if (printerConfig && printerConfig.systemName) {
                                // Construct print payload - Align exactly with Modal Pattern
                                const printPayload = {
                                    pdfData: pdfResult.base64,
                                    settings: {
                                        deviceName: printerConfig.systemName,
                                        copies: parseInt(printerConfig.copies || 1),
                                        pageSize: printerConfig.pageSize || '80mm',
                                        contentHeight: pdfResult.height,
                                        landscape: printerConfig.orientation === 'landscape',
                                        scaleFactor: parseInt(printerConfig.scale || 100),
                                        verticalAlign: printerConfig.verticalAlign || 'top',
                                        printBackground: false, // Fix for black layout artifacts
                                        margins: {
                                            top: parseFloat(printerConfig.margins?.top || 0),
                                            bottom: parseFloat(printerConfig.margins?.bottom || 0),
                                            left: parseFloat(printerConfig.margins?.left || 0),
                                            right: parseFloat(printerConfig.margins?.right || 0)
                                        }
                                    }
                                };

                                // Save to Temp -> Print File (Modal Pattern)
                                const saveResult = await window.api.saveTempPDF(printPayload.pdfData);

                                let result;
                                if (saveResult.success) {
                                    console.log("Direct Print: Printing from file:", saveResult.filePath);
                                    result = await window.api.printPDFFile(saveResult.filePath, printPayload.settings);
                                } else {
                                    console.error("Direct Print: Save temp failed, falling back to direct buffer print");
                                    result = await window.api.printPDF(printPayload.pdfData, printPayload.settings);
                                }

                                if (result.success) {
                                    toast.success(t('printModal.messages.printSuccess') || 'Printing...');
                                    setShowPaymentModal(false);
                                } else {
                                    console.error("Print failed:", result.message);
                                    toast.error('Printing failed. Opening modal...');
                                    setShowPrintModal(true);
                                    setShowPaymentModal(false);
                                }
                            } else {
                                setShowPrintModal(true); // No printer set, show modal
                                setShowPaymentModal(false);
                            }
                        } else {
                            // If PDF generation failed but order created, show modal to try again or view failure
                            setShowPrintModal(true);
                            setShowPaymentModal(false);
                        }
                    } catch (printErr) {
                        console.error("Printing error:", printErr);
                        setShowPrintModal(true);
                        setShowPaymentModal(false);
                    }
                }

            } else {
                toast.error(resp.message || "Checkout failed");
            }
        } catch (e) {
            toast.error("Error creating order");
            console.error(e);
        } finally {
            setIsSubmittingOrder(false);
        }
    };

    // Keyboard Shortcuts
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'F2') {
                e.preventDefault();
                itemNameRef.current?.focus();
            } else if (e.key === 'F4') {
                e.preventDefault();
                customerSearchRef.current?.focus();
            } else if (e.key === 'F10') {
                e.preventDefault();
                handlePaymentClick();
            } else if (e.key === 'Escape') {
                if (showPaymentModal) setShowPaymentModal(false);
                if (showDiscountModal) setShowDiscountModal(false);
                if (showCustomerModal) setShowCustomerModal(false);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [showPaymentModal, showDiscountModal, showCustomerModal, grandTotal, cart]);

    return (
        <div className="fixed inset-0 bg-[#f8fafc] font-sans text-[#1b160d] overflow-hidden h-screen flex flex-col z-50">
            <WindowControls title={t('sales.pos.windowTitle') || "POS - Billing"} />
            {/* Header */}
            <header className="flex items-center justify-between h-14 px-4 bg-white border-b border-[#e5e7eb] shrink-0">
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                        {/* <div className="bg-[#10b981] p-1 rounded-lg text-white">
                            <span className="material-symbols-outlined text-xl">bakery_dining</span>
                        </div> */}
                        <h2 className="text-base font-bold tracking-tight">RABTOISE</h2>
                    </div>
                    <div className="h-6 w-[1px] bg-[#e5e7eb]"></div>
                    <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1.5 px-2 py-1 bg-[#f8fafc] rounded-lg">
                            <Clock className="text-[#10b981]" size={12} />
                            <span className="text-xs font-medium">{currentTime}</span>
                        </div>
                    </div>
                </div>

                {/* Global Order Type & Customer Search Group */}
                <div className="flex-1 flex items-center justify-center gap-4 mx-4">
                    {/* Order Type Switcher */}
                    <div className="hidden xl:flex bg-[#f8fafc] p-1 rounded-xl w-72 shrink-0 border border-slate-200">
                        {['takeaway', 'dinein', 'online'].map(type => (
                            <button
                                key={type}
                                onClick={() => setOrderType(type)}
                                className={`flex-1 py-2 text-xs font-bold uppercase rounded-lg transition-all ${orderType === type
                                    ? 'bg-white shadow-sm text-[#10b981]'
                                    : 'text-slate-500 hover:text-slate-700'
                                    }`}
                            >
                                {orderTypeLabels[type]}
                            </button>
                        ))}
                    </div>

                    {/* Header Customer Search */}
                    <div className="flex-1 max-w-lg relative hidden sm:flex items-center gap-3">
                        <div className="relative flex-1">
                            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                            <input
                                ref={customerSearchRef}
                                type="text"
                                placeholder="Search Customer (F4)..."
                                value={customerSearchQuery}
                                onChange={(e) => setCustomerSearchQuery(e.target.value)}
                                className="w-full pl-11 pr-4 py-2.5 bg-[#f8fafc] border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-[#10b981] transition-all"
                            />

                            {customerSearchResults.length > 0 && (
                                <div className="absolute z-[60] w-full top-full mt-2 bg-white border border-slate-200 rounded-xl shadow-2xl max-h-80 overflow-y-auto left-0 overflow-hidden">
                                    {customerSearchResults.map(customer => (
                                        <button
                                            key={customer.id}
                                            onClick={() => {
                                                setSelectedCustomer(customer);
                                                setCustomerSearchQuery('');
                                                setCustomerSearchResults([]);
                                            }}
                                            className="w-full text-left px-5 py-3.5 hover:bg-slate-50 border-b border-slate-50 last:border-0 transition-colors"
                                        >
                                            <div className="font-bold text-sm text-slate-800">{customer.customer_name}</div>
                                            <div className="text-xs text-slate-500 mt-0.5">{customer.mobile_number}</div>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                        <button
                            onClick={() => setShowCustomerModal(true)}
                            className="size-10 bg-[#10b981] text-white rounded-xl flex items-center justify-center hover:bg-[#059669] shadow-lg shadow-[#4f46e5]/20 active:scale-95 transition-all shrink-0"
                        >
                            <UserPlus size={18} />
                        </button>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                        <span className="text-xs font-medium">Operator: <span className="text-[#10b981] font-bold">{currentUser?.username || 'Admin'}</span></span>
                        <div className="size-6 bg-[#10b981]/20 rounded-full flex items-center justify-center text-[#10b981]">
                            <span className="material-symbols-outlined text-sm">person</span>
                        </div>
                    </div>
                    <button
                        className={`flex items-center justify-center size-8 rounded-lg transition-colors ${isFullscreen ? 'bg-[#10b981] text-white' : 'bg-[#f8fafc] hover:bg-gray-200'}`}
                        onClick={toggleFullscreen}
                        title={isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
                    >
                        <span className="material-symbols-outlined text-lg">{isFullscreen ? 'fullscreen_exit' : 'fullscreen'}</span>
                    </button>
                    <button className="flex items-center justify-center size-8 bg-[#f8fafc] rounded-lg hover:bg-gray-200" onClick={() => navigate('/settings')}>
                        <span className="material-symbols-outlined text-lg">settings</span>
                    </button>
                    <button className="flex items-center justify-center size-8 bg-[#f8fafc] rounded-lg hover:bg-red-50 text-red-600" onClick={() => navigate('/sales')}>
                        <span className="material-symbols-outlined text-lg">close</span>
                    </button>
                </div>
            </header>

            <main className="flex flex-1 overflow-hidden">
                {/* Add Item */}
                <section className="flex-1 bg-[#f8fafc] flex flex-col min-w-0">
                    <div className="p-4 border-b border-[#e5e7eb] bg-white flex items-center gap-4">
                        <div className="flex items-center gap-2 flex-1">
                            <PackagePlus className="text-[#10b981]" size={20} />
                            <h2 className="text-base font-bold text-slate-700">Add Item</h2>
                        </div>

                        {/* Loyalty Points Section */}
                        {selectedCustomer ? (
                            <div className="flex items-center gap-4 px-4 py-2 bg-[#f8fafc] rounded-xl border border-[#e5e7eb]">
                                <div className="flex flex-col">
                                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Loyalty Points</span>
                                    <div className="flex items-center gap-1.5">
                                        <Star fill="#10b981" className="text-[#10b981]" size={14} />
                                        <span className="text-sm font-bold">{selectedCustomer.points || 0} <span className="text-gray-400 font-medium text-xs">Points</span></span>
                                    </div>
                                </div>
                                <label className="flex items-center gap-2 cursor-pointer group">
                                    <span className="text-xs font-medium text-gray-600 group-hover:text-[#10b981] transition-colors">Redeem Points</span>
                                    <input
                                        type="checkbox"
                                        checked={redeemPoints}
                                        onChange={(e) => setRedeemPoints(e.target.checked)}
                                        className="rounded border-gray-300 text-[#10b981] focus:ring-[#10b981] size-4"
                                    />
                                </label>
                            </div>
                        ) : (
                            <div className="px-4 py-2 bg-[#f8fafc] rounded-xl border border-[#e5e7eb]">
                                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">No Customer Selected</span>
                            </div>
                        )}
                    </div>
                    <div className="flex-1 overflow-y-auto p-6">
                        <div className="max-w-xl mx-auto bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                            <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.15em] mb-4">Item Details</h3>
                            <div className="flex flex-col gap-4">
                                <div>
                                    <label className="text-sm text-gray-500 font-medium mb-1 block">Item Name</label>
                                    <input
                                        ref={itemNameRef}
                                        type="text"
                                        value={itemName}
                                        onChange={(e) => setItemName(e.target.value)}
                                        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addManualItem(); } }}
                                        placeholder="Enter item name (F2)"
                                        className="w-full px-4 py-3 bg-[#f8fafc] border border-slate-200 rounded-xl text-base focus:ring-2 focus:ring-[#10b981] focus:border-[#10b981]"
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-sm text-gray-500 font-medium mb-1 block">Quantity</label>
                                        <input
                                            type="number"
                                            step="any"
                                            value={itemQty}
                                            onChange={(e) => setItemQty(e.target.value)}
                                            className="w-full px-4 py-3 bg-[#f8fafc] border border-slate-200 rounded-xl text-base focus:ring-2 focus:ring-[#10b981] focus:border-[#10b981]"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-sm text-gray-500 font-medium mb-1 block">Unit Price</label>
                                        <div className="relative">
                                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold">₹</span>
                                            <input
                                                type="number"
                                                step="any"
                                                value={itemPrice}
                                                onChange={(e) => setItemPrice(e.target.value)}
                                                className="w-full pl-8 pr-4 py-3 bg-[#f8fafc] border border-slate-200 rounded-xl text-base focus:ring-2 focus:ring-[#10b981] focus:border-[#10b981]"
                                            />
                                        </div>
                                    </div>
                                </div>
                                <button
                                    onClick={addManualItem}
                                    className="w-full py-3 bg-[#10b981] text-white rounded-xl font-bold uppercase tracking-wide hover:bg-[#059669] shadow-lg shadow-[#10b981]/20 active:scale-[0.98] transition-all"
                                >
                                    Add to Cart
                                </button>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Cart */}
                {/* Cart & Billing Sidebar */}
                <aside className="w-[420px] bg-white border-l border-[#e5e7eb] flex flex-col shrink-0">
                    <div className="px-5 py-4 border-b border-[#e5e7eb] flex items-center justify-between bg-white">
                        <div>
                            <h2 className="text-lg font-bold tracking-tight">Bill #{billNo}</h2>
                            {selectedCustomer && (
                                <p className="text-xs text-[#10b981] font-bold">{selectedCustomer.customer_name}</p>
                            )}
                        </div>
                        <button
                            onClick={clearCart}
                            className="size-9 bg-[#f8fafc] rounded-lg flex items-center justify-center text-red-500 hover:bg-red-50 transition-colors"
                        >
                            <Trash2 size={20} />
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto">
                        {cart.map(item => (
                            <div key={item.id} className="flex items-center gap-4 px-5 py-6 border-b border-[#f3f4f6] hover:bg-[#f8fafc]/50">

                                <div className="flex-1 min-w-0">
                                    <h4 className="text-base font-bold line-clamp-1">{item.name}</h4>
                                    <div className="flex items-center gap-1 mt-0.5">
                                        <span className="text-xs text-slate-400 font-bold">₹</span>
                                        <input
                                            type="number"
                                            value={item.price}
                                            onChange={(e) => setPrice(item.id, e.target.value)}
                                            className="w-16 bg-transparent border-none p-0 text-sm font-bold text-slate-600 focus:ring-0"
                                        />
                                        <span className="text-xs text-slate-400 font-medium">x {item.qty}</span>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className="flex items-center bg-slate-50 rounded-lg p-0.5 border border-slate-200">
                                        <button
                                            onClick={(e) => { e.stopPropagation(); updateQty(item.id, -1); }}
                                            className="size-7 flex items-center justify-center bg-white rounded-md shadow-sm text-slate-400 hover:text-[#10b981] hover:bg-emerald-50 transition-colors active:scale-95"
                                        >
                                            <Minus size={14} strokeWidth={3} />
                                        </button>
                                        <input
                                            type="number"
                                            step="any"
                                            value={item.qty}
                                            onChange={(e) => setQty(item.id, e.target.value)}
                                            onClick={(e) => e.stopPropagation()}
                                            className="w-10 bg-transparent border-none text-center font-bold text-xs focus:ring-0 p-0 text-slate-700"
                                        />
                                        <button
                                            onClick={(e) => { e.stopPropagation(); updateQty(item.id, 1); }}
                                            className="size-7 flex items-center justify-center bg-white rounded-md shadow-sm text-slate-400 hover:text-[#10b981] hover:bg-emerald-50 transition-colors active:scale-95"
                                        >
                                            <Plus size={14} strokeWidth={3} />
                                        </button>
                                    </div>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); removeFromCart(item.id); }}
                                        className="text-slate-300 hover:text-red-500 transition-colors"
                                    >
                                        <span className="material-symbols-outlined text-lg">close</span>
                                    </button>
                                </div>
                            </div>
                        ))}
                        {cart.length === 0 && (
                            <div className="flex flex-col items-center justify-center h-full text-gray-400 gap-2">
                                <span className="material-symbols-outlined text-5xl">shopping_cart</span>
                                <p>Your cart is empty</p>
                            </div>
                        )}
                    </div>

                    <div className="p-5 bg-[#f8fafc]/30 border-t border-[#e5e7eb]">
                        <div className="flex flex-col gap-2">
                            <div className="flex justify-between text-sm">
                                <span className="text-gray-500">Subtotal</span>
                                <span className="font-medium">₹{subtotal.toFixed(2)}</span>
                            </div>

                            <button
                                onClick={() => setShowDiscountModal(true)}
                                className="flex justify-between items-center py-2 px-3 border border-dashed border-[#10b981]/50 bg-[#10b981]/5 text-[#10b981] font-bold text-xs hover:bg-[#10b981]/10 transition-colors uppercase tracking-wide"
                            >
                                <div className="flex items-center gap-2">
                                    <Tag size={16} />
                                    {discount.value > 0 ? `Discount (${discount.type === 'percentage' ? discount.value + '%' : '₹' + discount.value})` : 'Add Discount'}
                                </div>
                                <span className="bg-[#10b981] text-white px-2 py-0.5 rounded text-[10px]">
                                    {discount.value > 0 ? 'Edit' : 'Add'}
                                </span>
                            </button>



                            <div className="mt-4 p-4 border-[#10b981] rounded-xl bg-[#10b981]/5 flex justify-between items-center">
                                <span className="text-lg font-bold text-gray-700">Grand Total</span>
                                <span className="text-2xl font-black text-[#10b981]">₹{Math.round(grandTotal).toFixed(2)}</span>
                            </div>
                        </div>
                    </div>

                    <div className="p-4 grid grid-cols-3 gap-2 bg-white">
                        <button
                            onClick={handlePaymentClick}
                            className="col-span-3 h-16 bg-[#10b981] shadow-[#10b981]/30 hover:bg-[#059669] transition-all active:scale-[0.98]"
                        >
                            <span className="text-xl font-black tracking-widest uppercase">Pay & Print</span>
                            <span className="material-symbols-outlined">chevron_right</span>
                        </button>
                    </div>
                </aside>
            </main>

            {/* Payment Modal */}
            <Modal
                isOpen={showPaymentModal}
                onClose={() => setShowPaymentModal(false)}
                title="Process Payment"
                width="600px"
                footer={(
                    <div className="flex gap-3">
                        <button
                            onClick={() => setShowPaymentModal(false)}
                            disabled={isSubmittingOrder}
                            className="flex-1 px-4 py-3 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl font-medium transition-colors disabled:opacity-50"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={() => submitOrder(false)}
                            disabled={isSubmittingOrder}
                            className="flex-1 px-4 py-3 text-[#10b981] bg-[#10b981]/10 hover:bg-[#10b981]/20 rounded-xl font-bold transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                            {isSubmittingOrder && <LucideIcons.Loader2 className="animate-spin size-4" />}
                            Save Only
                        </button>
                        <button
                            onClick={() => submitOrder(true)}
                            disabled={isSubmittingOrder}
                            className="flex-[2] px-4 py-3 text-white bg-[#10b981] hover:bg-[#059669] rounded-xl font-bold shadow-lg shadow-[#10b981]/30 transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                            {isSubmittingOrder && <LucideIcons.Loader2 className="animate-spin size-4" />}
                            Save & Print
                        </button>
                    </div>
                )}
            >
                <div className="flex flex-col gap-6">
                    {/* Amount Display */}
                    <div className="bg-[#f8fafc] p-4 rounded-xl flex justify-between items-center">
                        <span className="text-gray-500 font-medium">Total Payable</span>
                        <span className="text-3xl font-black text-[#10b981]">₹{Math.round(grandTotal).toFixed(2)}</span>
                    </div>

                    {/* Mode Toggle */}
                    <div className="flex bg-[#f8fafc] p-1 rounded-lg">
                        <button
                            onClick={() => setPaymentMode('single')}
                            className={`flex-1 py-2 rounded-md text-sm font-bold transition-all ${paymentMode === 'single' ? 'bg-white shadow-sm text-[#10b981]' : 'text-gray-500'}`}
                        >
                            Single Pay
                        </button>
                        <button
                            onClick={() => setPaymentMode('split')}
                            className={`flex-1 py-2 rounded-md text-sm font-bold transition-all ${paymentMode === 'split' ? 'bg-white shadow-sm text-[#10b981]' : 'text-gray-500'}`}
                        >
                            Split Pay
                        </button>
                    </div>

                    {paymentMode === 'single' ? (
                        <div className="flex flex-col gap-4">
                            <div className="grid grid-cols-2 gap-3">
                                {['cash', 'upi', 'card', 'credit'].map(method => (
                                    <button
                                        key={method}
                                        onClick={() => {
                                            setSelectedPaymentMethod(method);
                                            // Reset received amount for credit/paylater
                                            if (method === 'credit') setReceivedAmount(0);
                                            else setReceivedAmount(Math.round(grandTotal));
                                        }}
                                        className={`p-3 rounded-xl border-2 flex items-center gap-3 transition-all ${selectedPaymentMethod === method ? 'border-[#10b981] bg-[#10b981]/5 text-[#10b981]' : 'border-gray-200 hover:border-gray-300'}`}
                                    >
                                        <span className="material-symbols-outlined">
                                            {method === 'cash' ? 'payments' : method === 'upi' ? 'qr_code_2' : method === 'card' ? 'credit_card' : 'schedule'}
                                        </span>
                                        <span className="font-bold uppercase text-sm">
                                            {method === 'credit' ? 'Pay Later' : method}
                                        </span>
                                    </button>
                                ))}
                            </div>

                            {selectedPaymentMethod !== 'credit' && (
                                <div className="space-y-4">
                                    <div>
                                        <label className="text-sm text-gray-500 font-medium mb-1 block">Received Amount</label>
                                        <div className="relative">
                                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold">₹</span>
                                            <input
                                                type="number"
                                                value={receivedAmount}
                                                onChange={(e) => setReceivedAmount(parseFloat(e.target.value) || 0)}
                                                onFocus={(e) => e.target.select()}
                                                className="w-full pl-8 pr-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#10b981] focus:border-[#10b981] text-xl font-bold"
                                            />
                                        </div>
                                    </div>
                                    {calculateBalance() > 0 ? (
                                        <div className="flex justify-between items-center p-3 bg-red-50 rounded-xl border border-red-100">
                                            <span className="font-medium text-red-800">Due Amount</span>
                                            <span className="text-xl font-black text-red-700">₹{calculateBalance().toFixed(2)}</span>
                                        </div>
                                    ) : (
                                        <div className="flex justify-between items-center p-3 bg-green-50 rounded-xl border border-green-100">
                                            <span className="font-medium text-green-800">Change Return</span>
                                            <span className="text-xl font-black text-green-700">₹{calculateChange().toFixed(2)}</span>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="flex flex-col gap-3">
                            {['cash', 'card', 'upi'].map(method => (
                                <div key={method} className="flex items-center gap-3">
                                    <div className="w-24">
                                        <span className="font-bold uppercase text-sm text-gray-600">{method}</span>
                                    </div>
                                    <div className="relative flex-1">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">₹</span>
                                        <input
                                            type="number"
                                            value={splitPayments[method]}
                                            onChange={(e) => handleSplitChange(method, e.target.value)}
                                            onFocus={(e) => e.target.select()}
                                            className="w-full pl-7 pr-3 py-2 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#10b981] font-bold"
                                        />
                                    </div>
                                </div>
                            ))}
                            <div className="mt-2 pt-3 border-t border-dashed border-gray-200 flex justify-between items-center">
                                <span className="font-medium text-gray-500">Remaining (Pay Later)</span>
                                <span className="text-lg font-bold text-red-500">₹{calculateBalance().toFixed(2)}</span>
                            </div>
                        </div>
                    )}
                </div>
            </Modal>

            {/* Print Preview Modal */}
            <PrintPreviewModal
                ref={printModalRef}
                isOpen={showPrintModal}
                onClose={() => setShowPrintModal(false)}
                pdfUrl={pdfUrl}
                pdfBase64={pdfBase64}
                contentHeight={pdfHeight}
                title="Print Receipt"
                autoPrint={false}
            />

            {/* Discount Modal */}
            <Modal
                isOpen={showDiscountModal}
                onClose={() => setShowDiscountModal(false)}
                title="Apply Bill Discount"
                width="400px"
                submitText="Apply Discount"
                onSubmit={() => setShowDiscountModal(false)}
            >
                <div className="space-y-6">
                    <div className="flex bg-[#f8fafc] p-1 rounded-lg">
                        <button
                            onClick={() => setDiscount(prev => ({ ...prev, type: 'flat' }))}
                            className={`flex-1 py-2 rounded-md text-sm font-bold transition-all ${discount.type === 'flat' ? 'bg-white shadow-sm text-[#10b981]' : 'text-gray-500'}`}
                        >
                            Flat (₹)
                        </button>
                        <button
                            onClick={() => setDiscount(prev => ({ ...prev, type: 'percentage' }))}
                            className={`flex-1 py-2 rounded-md text-sm font-bold transition-all ${discount.type === 'percentage' ? 'bg-white shadow-sm text-[#10b981]' : 'text-gray-500'}`}
                        >
                            Percent (%)
                        </button>
                    </div>

                    <div className="space-y-4">
                        <div>
                            <label className="text-sm text-gray-500 font-medium mb-1 block">
                                {discount.type === 'flat' ? 'Discount Amount (₹)' : 'Discount Percentage (%)'}
                            </label>
                            <div className="relative">
                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold">
                                    {discount.type === 'flat' ? '₹' : '%'}
                                </span>
                                <input
                                    type="number"
                                    value={discount.value}
                                    onChange={(e) => setDiscount(prev => ({ ...prev, value: parseFloat(e.target.value) || 0 }))}
                                    className="w-full pl-8 pr-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#10b981] focus:border-[#10b981] text-xl font-bold"
                                    placeholder="0"
                                    autoFocus
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-4 gap-2">
                            {[0, 5, 10, 20, 50, 100, 200, 500].map(val => (
                                <button
                                    key={val}
                                    onClick={() => setDiscount(prev => ({ ...prev, value: val }))}
                                    className="py-2 bg-gray-50 hover:bg-gray-100 rounded-lg text-sm font-bold text-gray-600 transition-colors"
                                >
                                    {val === 0 ? 'Clear' : val}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </Modal>

            {/* Quick Add Customer Modal */}
            <CustomerAddEditForm
                editMode={false}
                customerModal={showCustomerModal}
                setCustomerModal={setShowCustomerModal}
                fetchData={() => { }}
                onSuccess={(result, data) => {
                    setSelectedCustomer({ ...data, id: result.id });
                    setShowCustomerModal(false);
                }}
            />
        </div>
    );
};

export default PetpoojaSalesAdd;
