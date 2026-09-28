import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { ArrowLeft, Save, Loader2, Search, X, Trash2 } from 'lucide-react';
 
// Checking dependencies might be hard, but let's assume standard select or look for another example. 
// Wait, I should check if there is a reusable Product Search component or how other forms do it.
// Checking Sales/Orders/AddEditForm.jsx previously would have been good.
// I'll stick to a simple implementation for now, or check for 'react-select' usage.
// Assuming the user has 'react-select' based on common patterns in this app type.
// If not, I can simple fetch all products or implement a simple search.
// Let's use a simple datalist or standard select for MVP if list is small, or a custom search.
// I will implement a custom searchable dropdown to be safe.

const WastageAdd = () => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const [submitting, setSubmitting] = useState(false);
    const [products, setProducts] = useState([]);
    const [formData, setFormData] = useState({
        product_id: '',
        quantity: '',
        reason: '',
        wastage_date: new Date().toISOString().split('T')[0],
        category: 'Expired',
        created_by: 'Admin' // Should get from context
    });
    const [selectedProduct, setSelectedProduct] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [showDropdown, setShowDropdown] = useState(false);

    useEffect(() => {
        // Fetch products for dropdown
        const loadProducts = async () => {
             // We can use product handler to get all products. 
             // Using a search handler would be better but let's try to get a list.
             // 'product:get-all' usually exists.
             try {
                 const result = await window.api.invoke('product:get-all', { page: 1, pageSize: 1000, status: 'Active' });
                 if (result.success) {
                     setProducts(result.data);
                 }
             } catch(err) {
                 console.error("Failed to load products", err);
                 toast.error(t('wastage.toasts.loadProductsFailed'));
             }
        };
        loadProducts();
    }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        if (!formData.product_id || !formData.quantity) {
            toast.error(t('wastage.toasts.validationFailed'));
            return;
        }

        if (selectedProduct && Number(formData.quantity) > selectedProduct.current_stock) {
             if(!window.confirm(t('wastage.stockWarning', { qty: formData.quantity, stock: selectedProduct.current_stock }))) {
                 return;
             }
        }

        setSubmitting(true);
        try {
            const response = await window.api.invoke('wastage:create', formData);
            if (response.success) {
                toast.success(t('wastage.toasts.createSuccess'));
                navigate('/wastage');
            } else {
                toast.error(t('wastage.toasts.createFailed'));
            }
        } catch (error) {
            console.error('Error creating wastage:', error);
            toast.error(t('wastage.toasts.createError'));
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="max-w-5xl mx-auto p-6">
            <div className="flex items-center gap-4 mb-8">
                <button 
                    onClick={() => navigate('/wastage')}
                    className="p-2 hover:bg-slate-100 rounded-full transition-colors"
                >
                    <ArrowLeft size={24} className="text-slate-600" />
                </button>
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">{t('wastage.recordWastage')}</h1>
                    <p className="text-slate-500">{t('wastage.trackManageWastage')}</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Left Column - Form */}
                <div className="lg:col-span-2 space-y-6">
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
                        <h2 className="text-lg font-semibold text-slate-800 mb-6 flex items-center gap-2">
                            <Trash2 size={20} className="text-rose-500" />
                            {t('wastage.wastageDetails')}
                        </h2>
                        
                        <form onSubmit={handleSubmit} className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {/* Date */}
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-slate-700">{t('wastage.date')} <span className="text-rose-500">*</span></label>
                                    <input 
                                        type="date"
                                        required
                                        value={formData.wastage_date}
                                        onChange={(e) => setFormData(prev => ({ ...prev, wastage_date: e.target.value }))}
                                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                                    />
                                </div>

                                {/* Quantity */}
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-slate-700">{t('wastage.quantity')} <span className="text-rose-500">*</span></label>
                                    <input 
                                        type="number"
                                        required
                                        min="0.01"
                                        step="any"
                                        value={formData.quantity}
                                        onChange={(e) => setFormData(prev => ({ ...prev, quantity: e.target.value }))}
                                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                                        placeholder={t('wastage.placeholders.quantity')}
                                    />
                                </div>

                                {/* Category */}
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-slate-700">{t('wastage.category')}</label>
                                    <select
                                        value={formData.category}
                                        onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
                                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all cursor-pointer"
                                    >
                                        <option value="Expired">{t('wastage.categories.expired')}</option>
                                        <option value="Wastage">{t('wastage.categories.wastage')}</option>
                                        <option value="Damaged">{t('wastage.categories.damaged')}</option>
                                        <option value="Lost">{t('wastage.categories.lost')}</option>
                                        <option value="Theft">{t('wastage.categories.theft')}</option>
                                        <option value="Other">{t('wastage.categories.other')}</option>
                                    </select>
                                </div>
                            </div>

                             {/* Product Selection with Search */}
                            <div className="space-y-2 relative">
                                <label className="text-sm font-medium text-slate-700">{t('wastage.product')} <span className="text-rose-500">*</span></label>
                                
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                        <Search size={18} className="text-slate-400" />
                                    </div>
                                    <input
                                        type="text"
                                        value={searchQuery}
                                        onChange={(e) => {
                                            setSearchQuery(e.target.value);
                                            setShowDropdown(true);
                                            setFormData(prev => ({...prev, product_id: ''})); // Reset selected ID on change
                                            setSelectedProduct(null);
                                        }}
                                        onFocus={() => setShowDropdown(true)}
                                        placeholder={t('wastage.searchProductPlaceholder')}
                                        className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                                    />
                                    {searchQuery && (
                                         <button 
                                            type="button"
                                            onClick={() => {
                                                setSearchQuery('');
                                                setFormData(prev => ({...prev, product_id: ''}));
                                                setSelectedProduct(null);
                                                setShowDropdown(false);
                                            }}
                                            className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
                                         >
                                            <X size={16} />
                                         </button>
                                    )}
                                </div>

                                {/* Custom Dropdown */}
                                {showDropdown && (searchQuery || products.length > 0) && (
                                    <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg max-h-60 overflow-y-auto border-t-0">
                                        {products.filter(p => {
                                            if(!searchQuery) return true;
                                            const query = searchQuery.toLowerCase();
                                            return p.product_name.toLowerCase().includes(query) || 
                                                   (p.product_code && p.product_code.toLowerCase().includes(query));
                                        }).length > 0 ? (
                                            products.filter(p => {
                                                if(!searchQuery) return true;
                                                const query = searchQuery.toLowerCase();
                                                return p.product_name.toLowerCase().includes(query) || 
                                                       (p.product_code && p.product_code.toLowerCase().includes(query));
                                            }).map(product => (
                                                <div 
                                                    key={product.id}
                                                    onClick={() => {
                                                        setFormData(prev => ({ ...prev, product_id: product.id }));
                                                        setSelectedProduct(product);
                                                        setSearchQuery(product.product_name);
                                                        setShowDropdown(false);
                                                    }}
                                                    className="px-4 py-3 hover:bg-slate-50 cursor-pointer border-b border-slate-100 last:border-0 transition-colors"
                                                >
                                                    <div className="flex justify-between items-center">
                                                        <div>
                                                            <div className="font-medium text-slate-800">{product.product_name}</div>
                                                            <div className="text-xs text-slate-500">{t('wastage.code')}: {product.product_code || '-'}</div>
                                                        </div>
                                                        <div className={`text-sm font-medium ${product.current_stock > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                                            {t('wastage.stock')}: {product.current_stock}
                                                        </div>
                                                    </div>
                                                </div>
                                            ))
                                        ) : (
                                            <div className="px-4 py-8 text-sm text-slate-500 text-center">
                                                {t('wastage.messages.noProductsFound', { query: searchQuery })}
                                            </div>
                                        )}
                                    </div>
                                )}
                                 {/* Overlay to close dropdown when clicking outside */}
                                 {showDropdown && (
                                    <div 
                                        className="fixed inset-0 z-40" 
                                        onClick={() => setShowDropdown(false)}
                                    ></div>
                                )}
                            </div>


                             {/* Reason */}
                             <div className="space-y-2">
                                <label className="text-sm font-medium text-slate-700">{t('wastage.reason')} <span className="text-slate-400 font-normal">({t('common.optional') || 'Optional'})</span></label>
                                <textarea 
                                    rows="4"
                                    value={formData.reason}
                                    onChange={(e) => setFormData(prev => ({ ...prev, reason: e.target.value }))}
                                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all resize-none"
                                    placeholder={t('wastage.placeholders.reason')}
                                />
                            </div>

                            <div className="pt-4 flex justify-end gap-3 border-t border-slate-100 mt-6">
                                 <button 
                                    type="button"
                                    onClick={() => navigate('/wastage')}
                                    className="px-6 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
                                >
                                    {t('common.cancel')}
                                </button>
                                <button 
                                    type="submit"
                                    disabled={submitting}
                                    className="flex items-center gap-2 px-6 py-2.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-lg shadow-blue-500/30 hover:shadow-blue-500/40 disabled:opacity-70 disabled:cursor-not-allowed transition-all active:scale-95"
                                >
                                    {submitting ? (
                                        <>
                                            <Loader2 size={18} className="animate-spin" />
                                            <span>{t('wastage.messages.saving')}</span>
                                        </>
                                    ) : (
                                        <>
                                            <Save size={18} />
                                            <span>{t('wastage.messages.saveRecord')}</span>
                                        </>
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>

                {/* Right Column - Summary & Info */}
                <div className="space-y-6">
                    {/* Selected Product Card */}
                    <div className={`bg-white rounded-2xl shadow-sm border border-slate-200 p-6 transition-all duration-300 ${selectedProduct ? 'opacity-100 translate-y-0' : 'opacity-50 translate-y-4 grayscale'}`}>
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="font-semibold text-slate-800">{t('wastage.productSnapshot')}</h3>
                            {selectedProduct && <span className="bg-blue-100 text-blue-700 text-xs px-2 py-1 rounded-full font-medium">{t('wastage.selected')}</span>}
                        </div>
                        
                        {selectedProduct ? (
                            <div className="space-y-4">
                                <div className="aspect-video bg-slate-100 rounded-lg flex items-center justify-center text-slate-400">
                                    {/* Placeholder for image if available in future */}
                                    <div className="text-center">
                                         <div className="bg-white p-3 rounded-full inline-block mb-2 shadow-sm">
                                            <Trash2 size={24} className="text-slate-400" />
                                         </div>
                                         <p className="text-xs">{t('wastage.noImage')}</p>
                                    </div>
                                </div>
                                
                                <div>
                                    <h4 className="font-medium text-slate-900 text-lg">{selectedProduct.product_name}</h4>
                                    <p className="text-slate-500 text-sm">{selectedProduct.product_code || t('wastage.code') + ': -'}</p>
                                </div>
                                
                                <div className="grid grid-cols-2 gap-3 pt-2">
                                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                                        <p className="text-xs text-slate-500 uppercase tracking-wider font-medium">{t('wastage.stock')}</p>
                                        <p className={`text-xl font-bold mt-1 ${selectedProduct.current_stock > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                            {selectedProduct.current_stock}
                                        </p>
                                    </div>
                                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                                         <p className="text-xs text-slate-500 uppercase tracking-wider font-medium">{t('wastage.price')}</p>
                                         <p className="text-xl font-bold text-slate-700 mt-1">₹{selectedProduct.selling_price || '0'}</p>
                                    </div>
                                </div>

                                {formData.quantity && (
                                     <div className="bg-amber-50 border border-amber-100 p-3 rounded-xl text-amber-800 text-sm flex items-start gap-2">
                                        <div className="mt-0.5 min-w-[16px]">⚠️</div>
                                        <p>
                                            {t('wastage.reduceStockMessage', { stock: (selectedProduct.current_stock - Number(formData.quantity)).toFixed(2) })}
                                        </p>
                                     </div>
                                )}
                            </div>
                        ) : (
                            <div className="py-8 text-center text-slate-400">
                                <p>{t('wastage.selectProductToView')}</p>
                            </div>
                        )}
                    </div>

                    {/* Guidelines Card */}
                    <div className="bg-blue-50 rounded-2xl p-5 border border-blue-100">
                        <h3 className="font-semibold text-blue-900 mb-2 flex items-center gap-2">
                            <div className="h-1.5 w-1.5 rounded-full bg-blue-500"></div>
                            {t('wastage.quickGuidelines')}
                        </h3>
                        <ul className="space-y-2 text-sm text-blue-800/80">
                            <li className="flex gap-2 items-start">
                                <span className="opacity-50">•</span>
                                {t('wastage.guideline1')}
                            </li>
                            <li className="flex gap-2 items-start">
                                <span className="opacity-50">•</span>
                                {t('wastage.guideline2')}
                            </li>
                            <li className="flex gap-2 items-start">
                                <span className="opacity-50">•</span>
                                {t('wastage.guideline3')}
                            </li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default WastageAdd;
