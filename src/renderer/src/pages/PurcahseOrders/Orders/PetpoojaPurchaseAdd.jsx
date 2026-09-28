import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { productService } from '../../../services/productService';
import { purchaseOrderService } from '../../../services/purchaseOrderService';
import { getCategories } from '../../../services/api';
import { getSuppliers } from '../../../services/supplierService';
import { toast } from 'sonner';
import { useAuth } from '../../../contexts/authContext';
import WindowControls from '../../../components/WindowControls';
import Modal from '../../../components/Modal';
import SupplierAddEditForm from '../../Masters/Supplier/AddEditForm';
import { useTranslation } from 'react-i18next';
import * as LucideIcons from 'lucide-react';
import { Grid2X2, Search, UserPlus, Star, Percent, Tag, Trash2, Clock, Plus, Minus, Truck, ShieldCheck, Receipt } from 'lucide-react';

const PetpoojaPurchaseAdd = () => {
    const navigate = useNavigate();
    const { currentUser } = useAuth();
    const { t } = useTranslation();

    // State management
    const [categories, setCategories] = useState([]);
    const [selectedCategoryId, setSelectedCategoryId] = useState('all');
    const [products, setProducts] = useState([]);
    const [filteredProducts, setFilteredProducts] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [cart, setCart] = useState([]);
    const [currentTime, setCurrentTime] = useState(new Date().toLocaleTimeString());
    const [poNo, setPoNo] = useState('');
    const [isFullscreen, setIsFullscreen] = useState(false);

    // Supplier State
    const [selectedSupplier, setSelectedSupplier] = useState(null);
    const [supplierSearchQuery, setSupplierSearchQuery] = useState('');
    const [supplierSearchResults, setSupplierSearchResults] = useState([]);
    const [isSearchingSupplier, setIsSearchingSupplier] = useState(false);
    const [showSupplierModal, setShowSupplierModal] = useState(false);

    // Purchase Logic State
    const [taxSettings, setTaxSettings] = useState({
        enableTax: true,
        taxType: 'SGST', // 'SGST' or 'IGST'
        taxIncludedInPrice: false
    });
    const [additionalCharges, setAdditionalCharges] = useState({
        freight: 0,
        insurance: 0,
        other: 0
    });
    const [orderDiscount, setOrderDiscount] = useState({ type: 'flat', value: 0 });
    const [status, setStatus] = useState('Draft');
    const [showSaveModal, setShowSaveModal] = useState(false);
    const [isSubmittingOrder, setIsSubmittingOrder] = useState(false);

    const productSearchRef = useRef(null);
    const supplierSearchRef = useRef(null);

    // Load initial data
    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date().toLocaleTimeString()), 1000);
        fetchCategories();
        fetchProducts();
        fetchNextPONo();

        if (window.api && window.api.onWindowFullscreen) {
            window.api.isFullscreen().then(setIsFullscreen);
            window.api.onWindowFullscreen(() => setIsFullscreen(true));
            window.api.onWindowUnfullscreen(() => setIsFullscreen(false));
        }

        return () => clearInterval(timer);
    }, []);

    const fetchCategories = async () => {
        try {
            const resp = await getCategories();
            if (resp.success) setCategories(resp.data);
        } catch (e) { console.error(e); }
    };

    const fetchProducts = async () => {
        try {
            const resp = await productService.getAll({ status: 'Active' });
            if (resp.success) {
                setProducts(resp.data);
                setFilteredProducts(resp.data);
            }
        } catch (e) { console.error(e); }
    };

    const fetchNextPONo = async () => {
        try {
            const resp = await purchaseOrderService.getNextPONumber();
            if (resp.success) setPoNo(resp.data);
        } catch (e) { console.error(e); }
    };

    // Filter products
    useEffect(() => {
        let filtered = products;
        if (selectedCategoryId !== 'all') {
            filtered = filtered.filter(p => p.category_id === parseInt(selectedCategoryId));
        }
        if (searchQuery) {
            filtered = filtered.filter(p =>
                p.product_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                p.sku?.toLowerCase().includes(searchQuery.toLowerCase())
            );
        }
        setFilteredProducts(filtered);
    }, [selectedCategoryId, searchQuery, products]);

    // Supplier Search
    useEffect(() => {
        const delayDebounceFn = setTimeout(async () => {
            if (supplierSearchQuery.length >= 2) {
                setIsSearchingSupplier(true);
                try {
                    const resp = await getSuppliers({ search: supplierSearchQuery, limit: 10 });
                    if (resp.success) setSupplierSearchResults(resp.data);
                } catch (e) { console.error(e); }
                finally { setIsSearchingSupplier(false); }
            } else {
                setSupplierSearchResults([]);
            }
        }, 300);
        return () => clearTimeout(delayDebounceFn);
    }, [supplierSearchQuery]);

    // Cart Operations
    const addToCart = (product) => {
        const existing = cart.find(item => item.id === product.id);
        if (existing) {
            updateQty(product.id, existing.qty + 1);
        } else {
            setCart([...cart, {
                ...product,
                qty: 1,
                // Use purchase_price if available, fallback to price
                purchasePrice: product.purchase_price || product.price || 0,
                taxRate: product.tax_rate || 0,
                unit: product.unit || 'Piece'
            }]);
        }
    };

    const updateQty = (id, newQty) => {
        if (newQty < 1) return;
        setCart(cart.map(item => item.id === id ? { ...item, qty: newQty } : item));
    };

    const updatePrice = (id, newPrice) => {
        setCart(cart.map(item => item.id === id ? { ...item, purchasePrice: newPrice } : item));
    };

    const removeFromCart = (id) => {
        setCart(cart.filter(item => item.id !== id));
    };

    const clearCart = () => {
        setCart([]);
        setSelectedSupplier(null);
        setSupplierSearchQuery('');
    };

    // Calculations
    const calculateTotals = () => {
        const subtotal = cart.reduce((sum, item) => sum + (item.purchasePrice * item.qty), 0);

        // Item-wise Tax
        let totalTax = 0;
        cart.forEach(item => {
            const itemSubtotal = item.purchasePrice * item.qty;
            if (taxSettings.enableTax) {
                if (taxSettings.taxIncludedInPrice) {
                    const taxable = itemSubtotal / (1 + (item.taxRate / 100));
                    totalTax += (itemSubtotal - taxable);
                } else {
                    totalTax += (itemSubtotal * (item.taxRate / 100));
                }
            }
        });

        const amountBeforeCharges = taxSettings.taxIncludedInPrice ? subtotal : (subtotal + totalTax);

        const discountAmount = orderDiscount.type === 'percentage'
            ? (amountBeforeCharges * (orderDiscount.value / 100))
            : orderDiscount.value;

        const charges = parseFloat(additionalCharges.freight || 0) +
            parseFloat(additionalCharges.insurance || 0) +
            parseFloat(additionalCharges.other || 0);

        const grandTotal = Math.max(0, amountBeforeCharges - discountAmount + charges);

        return {
            subtotal,
            totalTax,
            discountAmount,
            charges,
            grandTotal
        };
    };

    const totals = calculateTotals();

    const submitOrder = async () => {
        if (!selectedSupplier) {
            toast.error("Please select a supplier");
            return;
        }
        if (cart.length === 0) {
            toast.error("Cart is empty");
            return;
        }

        setIsSubmittingOrder(true);
        try {
            const orderData = {
                po_number: poNo,
                po_date: new Date().toISOString().split('T')[0],
                supplier_id: selectedSupplier.id,
                supplier_name: selectedSupplier.supplier_name,
                supplier_address: `${selectedSupplier.address_line_1 || ''}, ${selectedSupplier.city || ''}`,
                supplier_gst: selectedSupplier.gst_number,
                contact_person: selectedSupplier.contact_person,
                contact_number: selectedSupplier.phone,
                status: status,
                items: cart.map(item => ({
                    product_id: item.id,
                    quantity: item.qty,
                    unit_price: item.purchasePrice,
                    tax: item.taxRate,
                    amount: item.purchasePrice * item.qty
                })),
                freight: additionalCharges.freight,
                insurance: additionalCharges.insurance,
                other_charges: additionalCharges.other,
                order_discount: orderDiscount.value,
                order_discount_type: orderDiscount.type,
                net_payable: totals.grandTotal,
                // Add metadata for POS style
                store_name: "RABTOISE",
                cashier: currentUser?.username || "Admin"
            };

            const resp = await purchaseOrderService.create(orderData);
            if (resp.success) {
                toast.success("Purchase Order " + status + " successfully");
                clearCart();
                fetchNextPONo();
                setShowSaveModal(false);
                navigate('/purchases');
            } else {
                toast.error(resp.message || "Failed to create order");
            }
        } catch (e) {
            console.error(e);
            toast.error("Error creating purchase order");
        } finally {
            setIsSubmittingOrder(false);
        }
    };

    return (
        <div className="h-screen flex flex-col bg-slate-50 overflow-hidden font-sans text-slate-900">
            {/* Window Header */}
            <div className="flex-none bg-emerald-600 px-4 py-2 flex items-center justify-between text-white border-b border-emerald-700 shadow-sm relative z-50">
                <div className="flex items-center gap-6">
                    <div className="flex items-center gap-3">
                        <div className="bg-white/20 p-2 rounded-lg">
                            <LucideIcons.ShoppingBag className="size-5" />
                        </div>
                        <div>
                            <h1 className="text-lg font-black tracking-tight leading-none uppercase">RABTOISE</h1>
                            <span className="text-[10px] font-bold opacity-80 uppercase tracking-widest">Purchase Inventory</span>
                        </div>
                    </div>
                </div>

                <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-2 bg-emerald-700/50 px-4 py-1.5 rounded-full border border-white/10 backdrop-blur-md">
                    <Clock className="size-3.5 opacity-70" />
                    <span className="text-sm font-black tabular-nums">{currentTime}</span>
                    <div className="w-px h-3 bg-white/20 mx-1" />
                    <span className="text-xs font-bold uppercase tracking-wider">{poNo}</span>
                </div>

                <div className="flex items-center gap-3">
                    <WindowControls isDark={true} />
                </div>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 flex overflow-hidden p-3 gap-3">
                {/* Left Side: Product Selection */}
                <div className="flex-1 flex flex-col gap-3 min-w-0">
                    {/* Search & Categories Bar */}
                    <div className="bg-white rounded-2xl p-3 shadow-sm border border-slate-200 flex items-center gap-4">
                        <div className="relative flex-1 group">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 size-5 text-slate-400 group-focus-within:text-emerald-500 transition-colors" />
                            <input
                                ref={productSearchRef}
                                type="text"
                                placeholder="Search products (F2)..."
                                className="w-full pl-12 pr-4 py-3 bg-slate-50 border-none rounded-xl focus:ring-2 focus:ring-emerald-500 font-medium transition-all"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>

                        <div className="flex items-center gap-2 max-w-[50%] overflow-x-auto pb-1 no-scrollbar">
                            <button
                                onClick={() => setSelectedCategoryId('all')}
                                className={`px-4 py-2 rounded-xl text-sm font-bold whitespace-nowrap transition-all ${selectedCategoryId === 'all' ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-200' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                            >
                                All Items
                            </button>
                            {categories.map(cat => (
                                <button
                                    key={cat.id}
                                    onClick={() => setSelectedCategoryId(cat.id.toString())}
                                    className={`px-4 py-2 rounded-xl text-sm font-bold whitespace-nowrap transition-all ${selectedCategoryId === cat.id.toString() ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-200' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                                >
                                    {cat.category_name}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Product Grid */}
                    <div className="flex-1 overflow-y-auto pr-1 custom-scrollbar">
                        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3">
                            {filteredProducts.map(product => (
                                <div
                                    key={product.id}
                                    onClick={() => addToCart(product)}
                                    className="group relative bg-white p-4 rounded-2xl border border-slate-200 hover:border-emerald-500 hover:shadow-xl hover:shadow-emerald-500/10 transition-all cursor-pointer flex flex-col items-center text-center gap-3 overflow-hidden"
                                >
                                    <div className="absolute inset-0 bg-emerald-50 opacity-0 group-hover:opacity-100 transition-opacity" />
                                    <div className="size-16 rounded-2xl bg-slate-50 flex items-center justify-center group-hover:bg-white transition-colors relative z-10 shadow-sm">
                                        <LucideIcons.Package className="size-8 text-slate-400 group-hover:text-emerald-500 transition-colors" />
                                    </div>
                                    <div className="relative z-10 w-full">
                                        <h3 className="font-bold text-slate-800 text-sm leading-tight mb-1 line-clamp-2 min-h-[40px] flex items-center justify-center">
                                            {product.product_name}
                                        </h3>
                                        <p className="text-emerald-600 font-black text-base">₹{parseFloat(product.purchase_price || 0).toFixed(2)}</p>
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{product.unit || 'Piece'}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Right Side: Cart & Checkout */}
                <div className="w-[450px] flex flex-col gap-3">
                    {/* Supplier Selector */}
                    <div className="bg-[#1e293b] rounded-2xl p-4 shadow-xl border border-white/5 relative overflow-hidden group">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl group-hover:bg-emerald-500/20 transition-all" />

                        <div className="relative z-10">
                            <div className="flex justify-between items-center mb-4">
                                <div className="flex items-center gap-2">
                                    <LucideIcons.Store className="size-4 text-emerald-400" />
                                    <span className="text-xs font-black text-emerald-400 uppercase tracking-widest">Supplier Selection</span>
                                </div>
                                <button
                                    onClick={() => setShowSupplierModal(true)}
                                    className="p-1.5 hover:bg-white/10 rounded-lg text-white/50 hover:text-white transition-all"
                                >
                                    <UserPlus className="size-4" />
                                </button>
                            </div>

                            {!selectedSupplier ? (
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-500" />
                                    <input
                                        ref={supplierSearchRef}
                                        type="text"
                                        placeholder="Search Supplier (F4)..."
                                        className="w-full bg-slate-900/50 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-white placeholder:text-slate-600 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all font-bold"
                                        value={supplierSearchQuery}
                                        onChange={(e) => setSupplierSearchQuery(e.target.value)}
                                    />
                                    {isSearchingSupplier && (
                                        <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                            <LucideIcons.Loader2 className="size-4 text-emerald-500 animate-spin" />
                                        </div>
                                    )}

                                    {supplierSearchResults.length > 0 && (
                                        <div className="absolute top-full left-0 w-full mt-2 bg-slate-900 border border-white/10 rounded-xl shadow-2xl z-[60] overflow-hidden backdrop-blur-xl">
                                            {supplierSearchResults.map(s => (
                                                <div
                                                    key={s.id}
                                                    onClick={() => {
                                                        setSelectedSupplier(s);
                                                        setSupplierSearchResults([]);
                                                        setSupplierSearchQuery('');
                                                    }}
                                                    className="p-3 hover:bg-emerald-600 transition-all cursor-pointer border-b border-white/5 last:border-0 group/item"
                                                >
                                                    <p className="text-white font-black group-hover/item:scale-[1.02] transition-transform">{s.supplier_name}</p>
                                                    <p className="text-xs text-slate-500 group-hover/item:text-white/80">{s.phone} | {s.city}</p>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="flex items-center justify-between bg-emerald-600 p-4 rounded-xl border border-white/20 shadow-inner group/card">
                                    <div className="flex items-center gap-4">
                                        <div className="size-12 rounded-xl bg-white/20 flex items-center justify-center backdrop-blur-sm group-hover/card:scale-110 transition-transform">
                                            <LucideIcons.Briefcase className="size-6 text-white" />
                                        </div>
                                        <div>
                                            <p className="text-xs font-black text-white/70 uppercase tracking-widest leading-none mb-1">Active Supplier</p>
                                            <h4 className="text-white font-black text-lg line-clamp-1">{selectedSupplier.supplier_name}</h4>
                                            <p className="text-[10px] font-bold text-white/60 tracking-wider uppercase leading-none">{selectedSupplier.phone}</p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => setSelectedSupplier(null)}
                                        className="p-2 hover:bg-black/20 rounded-lg text-white/50 hover:text-white transition-all shadow-sm"
                                    >
                                        <X className="size-5" />
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Cart Items */}
                    <div className="flex-1 bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden flex flex-col relative">
                        <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                            <div className="flex items-center gap-2">
                                <Receipt className="size-4 text-emerald-600" />
                                <h3 className="font-black text-slate-800 uppercase tracking-widest text-xs">Items Cart</h3>
                            </div>
                            <button
                                onClick={clearCart}
                                className="text-[10px] font-black text-slate-400 hover:text-red-500 uppercase tracking-widest transition-colors flex items-center gap-1.5"
                            >
                                <Trash2 className="size-3" />
                                Clear All
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3 custom-scrollbar">
                            {cart.length === 0 ? (
                                <div className="h-full flex flex-col items-center justify-center text-slate-300 opacity-50 select-none">
                                    <LucideIcons.ShoppingCart className="size-16 mb-4 stroke-1" />
                                    <p className="font-black italic uppercase tracking-widest text-sm">Cart is Empty</p>
                                </div>
                            ) : cart.map(item => (
                                <div key={item.id} className="group/item flex flex-col gap-2 p-3 bg-slate-50 hover:bg-white rounded-xl border border-transparent hover:border-emerald-200 hover:shadow-lg transition-all">
                                    <div className="flex items-start justify-between">
                                        <div className="flex-1 min-w-0">
                                            <h4 className="font-bold text-slate-800 text-sm line-clamp-1 group-hover/item:text-emerald-700 transition-colors">{item.product_name}</h4>
                                            <div className="flex items-center gap-2 mt-1">
                                                <input
                                                    type="number"
                                                    value={item.purchasePrice}
                                                    onChange={(e) => updatePrice(item.id, parseFloat(e.target.value) || 0)}
                                                    className="w-20 bg-transparent border-b border-dashed border-slate-300 focus:border-emerald-500 focus:ring-0 p-0 text-xs font-bold text-emerald-600"
                                                />
                                                <span className="text-[10px] text-slate-400 uppercase font-black tracking-widest">per {item.unit}</span>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => removeFromCart(item.id)}
                                            className="p-1 text-slate-300 hover:text-red-500 opacity-0 group-hover/item:opacity-100 transition-all"
                                        >
                                            <Trash2 className="size-4" />
                                        </button>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center bg-white border border-slate-200 rounded-lg p-1 shadow-sm group-hover/item:border-emerald-200 transition-colors">
                                            <button
                                                onClick={() => updateQty(item.id, item.qty - 1)}
                                                className="p-1 hover:bg-slate-50 text-slate-400 hover:text-emerald-600 rounded-md transition-all"
                                            >
                                                <Minus className="size-3.5" />
                                            </button>
                                            <input
                                                type="number"
                                                className="w-12 text-center text-xs font-bold bg-transparent border-none focus:ring-0 tabular-nums"
                                                value={item.qty}
                                                onChange={(e) => updateQty(item.id, parseInt(e.target.value) || 1)}
                                            />
                                            <button
                                                onClick={() => updateQty(item.id, item.qty + 1)}
                                                className="p-1 hover:bg-slate-50 text-slate-400 hover:text-emerald-600 rounded-md transition-all"
                                            >
                                                <Plus className="size-3.5" />
                                            </button>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest leading-none mb-1">Subtotal</p>
                                            <p className="font-black text-slate-800 tabular-nums leading-none">₹{(item.purchasePrice * item.qty).toFixed(2)}</p>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Bill Summary */}
                        <div className="p-4 bg-slate-900 text-white rounded-t-3xl shadow-2xl">
                            <div className="space-y-2 mb-4">
                                <div className="flex justify-between items-center text-xs font-bold text-white/50 uppercase tracking-widest">
                                    <span>Item Subtotal</span>
                                    <span className="text-white tabular-nums">₹{totals.subtotal.toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between items-center text-xs font-bold text-white/50 uppercase tracking-widest">
                                    <div className="flex items-center gap-2">
                                        <span>Total Tax</span>
                                        <button
                                            onClick={() => setTaxSettings(t => ({ ...t, enableTax: !t.enableTax }))}
                                            className={`px-2 py-0.5 rounded text-[10px] ${taxSettings.enableTax ? 'bg-emerald-500 text-white' : 'bg-white/10 text-white/50'}`}
                                        >
                                            {taxSettings.enableTax ? 'ON' : 'OFF'}
                                        </button>
                                    </div>
                                    <span className="text-white tabular-nums">₹{totals.totalTax.toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between items-center text-xs font-bold text-white/50 uppercase tracking-widest">
                                    <span>Shipping & Charges</span>
                                    <span className="text-white tabular-nums">₹{totals.charges.toFixed(2)}</span>
                                </div>
                                <div className="h-px bg-white/10 my-2" />
                                <div className="flex justify-between items-end">
                                    <div>
                                        <p className="text-[10px] font-black text-emerald-400 uppercase tracking-[0.2em] leading-none mb-2">Total Payable</p>
                                        <h2 className="text-3xl font-black tabular-nums leading-none tracking-tight">₹{Math.round(totals.grandTotal).toFixed(2)}</h2>
                                    </div>
                                    <button
                                        onClick={() => setShowSaveModal(true)}
                                        disabled={cart.length === 0 || !selectedSupplier}
                                        className="bg-emerald-500 hover:bg-emerald-400 text-white px-8 py-4 rounded-2xl font-black uppercase tracking-widest transition-all shadow-lg shadow-emerald-500/20 active:scale-[0.98] disabled:opacity-50 disabled:grayscale disabled:cursor-not-allowed group"
                                    >
                                        <span className="flex items-center gap-3">
                                            Place Order
                                            <LucideIcons.ArrowRight className="size-5 group-hover:translate-x-1 transition-transform" />
                                        </span>
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Quick Add Supplier Modal */}
            <SupplierAddEditForm
                editMode={false}
                supplierModal={showSupplierModal}
                setSupplierModal={setShowSupplierModal}
                fetchData={() => { }} // Handle post-save
                onSuccess={(result, data) => {
                    setSelectedSupplier({ ...data, id: result.id });
                    setShowSupplierModal(false);
                }}
            />

            {/* Save Order Modal */}
            <Modal
                isOpen={showSaveModal}
                onClose={() => setShowSaveModal(false)}
                title="Save Purchase Order"
                width="600px"
                footer={(
                    <div className="flex gap-3">
                        <button
                            onClick={() => setShowSaveModal(false)}
                            disabled={isSubmittingOrder}
                            className="flex-1 px-4 py-3 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl font-medium transition-colors disabled:opacity-50"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={() => { setStatus('Draft'); submitOrder(); }}
                            disabled={isSubmittingOrder}
                            className="flex-1 px-4 py-3 text-[#10b981] bg-[#10b981]/10 hover:bg-[#10b981]/20 rounded-xl font-bold transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                            {isSubmittingOrder && <LucideIcons.Loader2 className="animate-spin size-4" />}
                            Save Draft
                        </button>
                        <button
                            onClick={() => { setStatus('Completed'); submitOrder(); }}
                            disabled={isSubmittingOrder}
                            className="flex-[2] px-4 py-3 text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl font-bold shadow-lg shadow-emerald-500/30 transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                            {isSubmittingOrder && <LucideIcons.Loader2 className="animate-spin size-4" />}
                            Complete Order
                        </button>
                    </div>
                )}
            >
                <div className="space-y-6">
                    {/* Totals Preview */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.1em] block mb-1">Total Items</span>
                            <span className="text-2xl font-black text-slate-800 tabular-nums">{cart.length}</span>
                        </div>
                        <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-100">
                            <span className="text-[10px] font-black text-emerald-600 uppercase tracking-[0.1em] block mb-1">Net Payable</span>
                            <span className="text-2xl font-black text-emerald-700 tabular-nums">₹{Math.round(totals.grandTotal).toFixed(2)}</span>
                        </div>
                    </div>

                    {/* Advanced Settings */}
                    <div className="space-y-4">
                        <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-2">Purchase Configuration</h4>

                        <div className="grid grid-cols-2 gap-6">
                            <div className="space-y-3">
                                <label className="flex items-center gap-3 cursor-pointer group">
                                    <div className={`size-5 rounded border-2 transition-all flex items-center justify-center ${taxSettings.enableTax ? 'bg-emerald-600 border-emerald-600' : 'border-slate-300'}`}>
                                        {taxSettings.enableTax && <LucideIcons.Check className="size-3 text-white" />}
                                    </div>
                                    <input type="checkbox" className="hidden" checked={taxSettings.enableTax} onChange={e => setTaxSettings(p => ({ ...p, enableTax: e.target.checked }))} />
                                    <span className="text-sm font-bold text-slate-600">Enable Tax Calculation</span>
                                </label>

                                {taxSettings.enableTax && (
                                    <div className="flex bg-slate-100 p-1 rounded-lg">
                                        <button
                                            onClick={() => setTaxSettings(p => ({ ...p, taxType: 'SGST' }))}
                                            className={`flex-1 py-1.5 rounded-md text-[10px] font-black uppercase tracking-wider transition-all ${taxSettings.taxType === 'SGST' ? 'bg-white shadow-sm text-emerald-600' : 'text-slate-500'}`}
                                        >
                                            SGST/CGST
                                        </button>
                                        <button
                                            onClick={() => setTaxSettings(p => ({ ...p, taxType: 'IGST' }))}
                                            className={`flex-1 py-1.5 rounded-md text-[10px] font-black uppercase tracking-wider transition-all ${taxSettings.taxType === 'IGST' ? 'bg-white shadow-sm text-emerald-600' : 'text-slate-500'}`}
                                        >
                                            IGST
                                        </button>
                                    </div>
                                )}
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2 px-1">Freight / Shipping</label>
                                    <div className="relative group/input">
                                        <Truck className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-slate-400 group-focus-within/input:text-emerald-500" />
                                        <input
                                            type="number"
                                            className="w-full bg-slate-50 border-slate-200 rounded-xl pl-9 pr-4 py-2.5 text-sm font-bold focus:ring-emerald-500 focus:border-emerald-500 transition-all"
                                            value={additionalCharges.freight}
                                            onChange={e => setAdditionalCharges(p => ({ ...p, freight: parseFloat(e.target.value) || 0 }))}
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </Modal>
        </div>
    );
};

export default PetpoojaPurchaseAdd;
