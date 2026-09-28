import React, { useEffect, useState, useRef, Fragment } from 'react';
import { useForm, useWatch, useFieldArray } from 'react-hook-form';
import { useNavigate, useParams } from 'react-router-dom';
import { Form, Input, Textarea, Select, AutocompleteSelect } from '../../../components/Form';
import { Plus, Trash2, Save, Check, Printer, Send, X, ShoppingCart, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import ConfirmationDialog from '../../../components/ConfirmationDialog';
import { getSuppliers } from '../../../services/supplierService';
import { getProducts } from '../../../services/productService';
import purchaseOrderService from '../../../services/purchaseOrderService';
import SupplierAddEditForm from '../../Masters/Supplier/AddEditForm';
import ProductAddEditForm from '../../Products/AddEditForm';

import { useTranslation } from 'react-i18next';

const AddEditForm = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id } = useParams();
  const editMode = !!id;
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [initialValues, setInitialValues] = useState(null);
  const [taxSettings, setTaxSettings] = useState({
    enableTax: true,
    taxType: 'SGST', // 'SGST' or 'IGST'
    taxIncludedInPrice: false // Whether tax is already included in the price
  });
  const [orderDiscountType, setOrderDiscountType] = useState('percentage'); // 'percentage' or 'fixed'
  const [suppliers, setSuppliers] = useState([]);
  const [products, setProducts] = useState([]);
  const [loadingSuppliers, setLoadingSuppliers] = useState(false);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [showSupplierModal, setShowSupplierModal] = useState(false);
  const [showProductModal, setShowProductModal] = useState(false);
  const formValues = useRef(null);
  const ignoreNextSupplierUpdate = useRef(false);

  const {
    control,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { isSubmitting, errors }
  } = useForm({
    defaultValues: {
      poNumber: 'PO-2025-001', // Temporary placeholder
      poDate: new Date().toISOString().split('T')[0],
      supplierId: '',
      supplierName: '',
      supplierAddress: '',
      supplierGst: '',
      contactPerson: '',
      contactNumber: '',
      email: '',
      paymentTerms: 'Net 30 days',
      deliveryDate: '',
      deliveryLocation: '',
      remarks: '',
      status: 'Draft',
      items: [{
        product: '',
        hsnCode: '',
        quantity: 1,
        unit: 'Piece',
        unitPrice: 0,
        discount: 0,
        tax: 18,
        amount: 0
      }],
      freight: 0,
      insurance: 0,
      otherCharges: 0,
      orderDiscount: 0
    }
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'items'
  });

  // Watch all form values
  const watchedValues = watch();
  const items = watch('items') || [];
  const freight = watch('freight') || 0;
  const insurance = watch('insurance') || 0;
  const otherCharges = watch('otherCharges') || 0;
  const orderDiscount = watch('orderDiscount') || 0;

  // Fetch suppliers from API
  const fetchSuppliersData = async () => {
    setLoadingSuppliers(true);
    try {
      const response = await getSuppliers({ limit: 1000 }); // Fetch all suppliers
      if (response.success) {
        const formattedSuppliers = response.data.map(supplier => ({
          value: supplier.id.toString(),
          label: (supplier.supplier_name || '').toString(),
          address: `${supplier.address_line_1 || ''}, ${supplier.city || ''}, ${supplier.state || ''}, ${supplier.pincode || ''}`.trim(),
          gst: (supplier.gst_number || '').toString(),
          contact: (supplier.contact_person || '').toString(),
          phone: (supplier.phone || supplier.alternate_phone || '').toString(),
          email: (supplier.email || '').toString()
        }));
        setSuppliers(formattedSuppliers);
      }
    } catch (error) {
      console.error('Error fetching suppliers:', error);
      toast.error(t('purchases.failedToLoad'));
    } finally {
      setLoadingSuppliers(false);
    }
  };

  useEffect(() => {
    fetchSuppliersData();
  }, []);

  // Fetch products from API
  const fetchProductsData = async () => {
    setLoadingProducts(true);
    try {
      const response = await getProducts({ limit: 1000, status: 'Active' }); // Fetch only active products
      if (response.success) {
        const formattedProducts = response.data
          .filter(product => product.status === 'Active') // Additional client-side filter for active products
          .map(product => ({
            value: product.id.toString(),
            label: (product.product_name || '').toString(),
            description: (product.description || '').toString(),
            hsnCode: (product.hsn_code || '').toString(),
            price: parseFloat(product.purchase_price || 0),
            unit: (product.unit || 'Piece').toString(),
            discount: parseFloat(product.discount || 0),
            tax: parseFloat(product.tax_rate || 18)
          }));
        setProducts(formattedProducts);
      }
    } catch (error) {
      console.error('Error fetching products:', error);
      toast.error(t('purchases.failedToLoad'));
    } finally {
      setLoadingProducts(false);
    }
  };

  useEffect(() => {
    fetchProductsData();
  }, []);

  // Load purchase order data in edit mode
  useEffect(() => {
    const loadPurchaseOrder = async () => {
      if (editMode && id) {
        try {
          const response = await purchaseOrderService.getById(id);
          if (response.success) {
            const po = response.data;

            // Format form values
            const formattedValues = {
              poNumber: po.po_number,
              poDate: po.po_date,
              supplierId: po.supplier_id?.toString() || '',
              supplierName: po.supplier_name || '',
              supplierAddress: po.supplier_address || '',
              supplierGst: po.supplier_gst || '',
              contactPerson: po.contact_person || '',
              contactNumber: po.contact_number || '',
              email: po.email || '',
              paymentTerms: po.payment_terms || 'Net 30 days',
              deliveryDate: po.delivery_date || '',
              deliveryLocation: po.delivery_location || '',
              remarks: po.remarks || '',
              status: po.status || 'Draft',
              items: po.items.map(item => ({
                product: item.product_id?.toString() || '',
                hsnCode: item.hsn_code || '',
                quantity: item.quantity || 1,
                unit: item.unit || 'Piece',
                unitPrice: item.unit_price || 0,
                discount: item.discount || 0,
                tax: item.tax || 0,
                amount: item.amount || 0
              })),
              freight: po.freight || 0,
              insurance: po.insurance || 0,
              otherCharges: po.other_charges || 0,
              orderDiscount: po.order_discount || 0
            };

            // Set flag to ignore the next supplier update effect
            ignoreNextSupplierUpdate.current = true;

            // Set form values
            reset(formattedValues);

            // Set tax settings
            setTaxSettings({
              enableTax: po.enable_tax === 1,
              taxType: po.tax_type || 'SGST',
              taxIncludedInPrice: po.tax_included_in_price === 1
            });

            // Set discount type
            setOrderDiscountType(po.order_discount_type || 'percentage');

            // Store initial values for change detection
            setInitialValues(formattedValues);
          } else {
            toast.error(t('purchases.failedToLoad'));
            navigate('/purchases');
          }
        } catch (error) {
          console.error('Error loading purchase order:', error);
          toast.error(t('purchases.failedToLoad'));
          navigate('/purchases');
        }
      }
    };

    loadPurchaseOrder();
  }, [editMode, id, reset, navigate]);

  // Fetch initial PO number on mount for new orders
  useEffect(() => {
    const fetchInitialPONumber = async () => {
      if (!editMode) {
        try {
          const response = await purchaseOrderService.getNextPONumber();
          if (response.success) {
            setValue('poNumber', response.data);
          }
        } catch (error) {
          console.error('Failed to fetch initial PO number:', error);
        }
      }
    };

    fetchInitialPONumber();
  }, [editMode, setValue]);

  const paymentTermsOptions = [
    { value: 'Net 30 days', label: 'Net 30 days' },
    { value: 'Net 60 days', label: 'Net 60 days' },
    { value: 'Advance Payment', label: 'Advance Payment' },
    { value: 'COD', label: 'COD' },
    { value: '50% Advance', label: '50% Advance' }
  ];



  const units = [
    { value: 'Piece', label: 'Piece' },
    { value: 'Kg', label: 'Kilogram (Kg)' },
    { value: 'Gram', label: 'Gram (g)' },
    { value: 'Litre', label: 'Litre (L)' },
    { value: 'Millilitre', label: 'Millilitre (ml)' },
    { value: 'Pack', label: 'Pack' },
    { value: 'Box', label: 'Box' },
    { value: 'Meter', label: 'Meter (m)' },
    { value: 'Foot', label: 'Foot (ft)' },
    { value: 'Dozen', label: 'Dozen' }
  ];

  const statusOptions = [
    { value: 'Draft', label: t('common.draft') },
    { value: 'Pending', label: t('common.pending') },
    { value: 'Completed', label: t('common.completed') },
    { value: 'Cancelled', label: t('common.cancelled') }
  ];

  // Watch for supplier changes and auto-populate fields
  const supplierId = watch('supplierId');

  useEffect(() => {
    // Skip update if flagged (e.g. during initial load)
    if (ignoreNextSupplierUpdate.current) {
      ignoreNextSupplierUpdate.current = false;
      return;
    }

    if (supplierId) {
      const supplier = suppliers.find(s => s.value === supplierId);
      if (supplier) {
        setValue('supplierName', supplier.label);
        setValue('supplierAddress', supplier.address);
        setValue('supplierGst', supplier.gst);
        setValue('contactPerson', supplier.contact);
        setValue('contactNumber', supplier.phone);
        setValue('email', supplier.email);
      }
    } else {
      // Reset all supplier fields when supplier is unselected
      setValue('supplierName', '');
      setValue('supplierAddress', '');
      setValue('supplierGst', '');
      setValue('contactPerson', '');
      setValue('contactNumber', '');
      setValue('email', '');
    }
  }, [supplierId]);

  // Get available products for a specific row (excluding already selected products in other rows)
  const getAvailableProducts = (currentIndex) => {
    const selectedProductIds = items
      .map((item, index) => index !== currentIndex ? item.product : null)
      .filter(Boolean);

    return products.filter(product => !selectedProductIds.includes(product.value));
  };

  // Handle product change
  const handleProductChange = (index, productId) => {
    const product = products.find(p => p.value === productId);
    if (product) {
      setValue(`items.${index}.hsnCode`, product.hsnCode);
      setValue(`items.${index}.unitPrice`, product.price);
      setValue(`items.${index}.discount`, product.discount);
      setValue(`items.${index}.unit`, product.unit);
      setValue(`items.${index}.tax`, product.tax);
      calculateItemAmount(index);
    }
  };

  // Calculate item amount
  const calculateItemAmount = (index) => {
    const item = items[index];
    if (!item) return;

    const subtotal = (item.quantity || 0) * (item.unitPrice || 0);
    const discountAmount = (subtotal * (item.discount || 0)) / 100;
    const priceAfterDiscount = subtotal - discountAmount;

    if (!taxSettings.enableTax) {
      setValue(`items.${index}.amount`, priceAfterDiscount);
      return;
    }

    if (taxSettings.taxIncludedInPrice) {
      // Tax is already included in the price
      setValue(`items.${index}.amount`, priceAfterDiscount);
    } else {
      // Tax needs to be added on top
      const taxAmount = (priceAfterDiscount * (item.tax || 0)) / 100;
      setValue(`items.${index}.amount`, priceAfterDiscount + taxAmount);
    }
  };

  // Calculate totals
  const calculateTotals = () => {
    let subtotalWithoutTax = 0;
    let totalTax = 0;

    items.forEach((item) => {
      const itemSubtotal = (item.quantity || 0) * (item.unitPrice || 0);
      const discountAmount = (itemSubtotal * (item.discount || 0)) / 100;
      const priceAfterDiscount = itemSubtotal - discountAmount;

      if (taxSettings.enableTax) {
        const taxRate = item.tax || 0;

        if (taxSettings.taxIncludedInPrice) {
          // Extract tax from the price (reverse calculation)
          const taxableAmount = priceAfterDiscount / (1 + taxRate / 100);
          const taxAmount = priceAfterDiscount - taxableAmount;
          subtotalWithoutTax += taxableAmount;
          totalTax += taxAmount;
        } else {
          // Tax is added on top
          subtotalWithoutTax += priceAfterDiscount;
          const taxAmount = (priceAfterDiscount * taxRate) / 100;
          totalTax += taxAmount;
        }
      } else {
        subtotalWithoutTax += priceAfterDiscount;
      }
    });

    const subtotal = subtotalWithoutTax + totalTax;

    // Calculate order discount with validation
    let orderDiscountValue = parseFloat(orderDiscount) || 0;
    let orderDiscountAmount = 0;

    if (orderDiscountType === 'percentage') {
      // Ensure percentage doesn't exceed 100
      orderDiscountValue = Math.min(orderDiscountValue, 100);
      orderDiscountAmount = (subtotal * orderDiscountValue) / 100;
    } else {
      // Ensure fixed amount doesn't exceed subtotal
      orderDiscountValue = Math.min(orderDiscountValue, subtotal);
      orderDiscountAmount = orderDiscountValue;
    }

    const subtotalAfterDiscount = subtotal - orderDiscountAmount;
    const freightAmount = parseFloat(freight) || 0;
    const insuranceAmount = parseFloat(insurance) || 0;
    const otherChargesAmount = parseFloat(otherCharges) || 0;
    const beforeRoundOff = subtotalAfterDiscount + freightAmount + insuranceAmount + otherChargesAmount;
    const roundOff = Math.round(beforeRoundOff) - beforeRoundOff;
    const netPayable = beforeRoundOff + roundOff;

    // Calculate SGST/CGST or IGST
    let sgst = 0, cgst = 0, igst = 0;

    if (taxSettings.enableTax) {
      if (taxSettings.taxType === 'SGST') {
        sgst = totalTax / 2;
        cgst = totalTax / 2;
      } else {
        igst = totalTax;
      }
    }

    return {
      subtotalWithoutTax,
      totalTax,
      sgst,
      cgst,
      igst,
      subtotal,
      orderDiscountAmount,
      subtotalAfterDiscount,
      freight: freightAmount,
      insurance: insuranceAmount,
      otherCharges: otherChargesAmount,
      roundOff,
      netPayable
    };
  };

  const totals = calculateTotals();

  // Watch for product changes and auto-populate fields
  useEffect(() => {
    items.forEach((item, index) => {
      if (item.product) {
        console.log("item.product", item.product);
        const product = products.find(p => p.value === item.product);
        console.log("product", product);

        if (product && item.hsnCode !== product.hsnCode) {
          handleProductChange(index, item.product);
        }
      } else {
        // Reset row when product is unselected
        setValue(`items.${index}.hsnCode`, '');
        setValue(`items.${index}.unitPrice`, 0);
        setValue(`items.${index}.unit`, 'Piece');
        setValue(`items.${index}.tax`, 18);
        setValue(`items.${index}.discount`, 0);
        setValue(`items.${index}.amount`, 0);
      }
    });
  }, [items.map(item => item.product).join(',')]);

  // Recalculate amounts when items change
  useEffect(() => {
    items.forEach((_, index) => {
      calculateItemAmount(index);
    });
  }, [items.length, taxSettings.enableTax, taxSettings.taxType]);

  // Reset all tax fields to 0 when tax is disabled
  useEffect(() => {
    if (!taxSettings.enableTax) {
      items.forEach((_, index) => {
        setValue(`items.${index}.tax`, 0);
      });
    }
  }, [taxSettings.enableTax]);

  // Validate order discount when type changes or subtotal changes
  useEffect(() => {
    const currentDiscount = parseFloat(orderDiscount) || 0;
    const subtotal = totals.subtotal;

    if (currentDiscount > 0) {
      if (orderDiscountType === 'percentage' && currentDiscount > 100) {
        setValue('orderDiscount', 100);
        toast.warning(t('purchases.discountPercentageMax'));
      } else if (orderDiscountType === 'fixed' && currentDiscount > subtotal) {
        setValue('orderDiscount', subtotal);
        toast.warning(`Discount amount cannot exceed ₹${subtotal.toFixed(2)}`);
      }
    }
  }, [orderDiscountType, orderDiscount, totals.subtotal]);


  const hasFormChanged = (currentValues) => {
    if (!initialValues) return false;
    return JSON.stringify(currentValues) !== JSON.stringify(initialValues);
  };

  const handleCancel = () => {
    formValues.current = watch();
    if (hasFormChanged(formValues.current)) {
      setShowConfirmDialog(true);
    } else {
      navigate('/purchases');
    }
  };

  const handleConfirmClose = () => {
    setShowConfirmDialog(false);
    navigate('/purchases');
  };

  const handleContinueEditing = () => {
    setShowConfirmDialog(false);
  };

  const onSubmit = async (data) => {
    try {
      // Validate supplier
      if (!data.supplierId) {
        toast.error(t('purchases.supplierRequired'));
        return;
      }

      // Validate items
      if (!data.items || data.items.length === 0 || data.items.every(item => !item.product)) {
        toast.error(t('purchases.itemRequired'));
        return;
      }

      const orderData = {
        ...data,
        totals: calculateTotals(),
        taxSettings,
        orderDiscountType
      };

      console.log('Saving purchase order:', orderData);

      if (editMode && id) {
        const response = await purchaseOrderService.update({ ...orderData, id });
        if (response.success) {
          toast.success(t('purchases.updateSuccess'));
          navigate('/purchases');
        } else {
          toast.error(response.message || t('purchases.failedToSave'));
        }
      } else {
        const response = await purchaseOrderService.create(orderData);
        if (response.success) {
          toast.success(t('purchases.createSuccess'));
          navigate('/purchases');
        } else {
          toast.error(response.message || t('purchases.failedToSave'));
        }
      }
    } catch (error) {
      console.error('Error saving purchase order:', error);
      toast.error(error.message || t('purchases.failedToSave'));
    }
  };

  const handleSaveCompleted = () => {
    setValue('status', 'Completed');
    handleSubmit((data) => onSubmit({ ...data, status: 'Completed' }))();
  };

  return (
    <div className="min-h-full bg-gray-50 p-6 flex flex-col">
      <div className="max-w-7xl mx-auto w-full flex-1 flex flex-col">
        {/* Back Button */}
        <button
          onClick={handleCancel}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          <span className="font-medium">{t('purchases.backToOrders')}</span>
        </button>

        {/* Loading Indicator */}
        {(loadingSuppliers || loadingProducts) && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4 flex items-center gap-3">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
            <span className="text-sm text-blue-800">
              {loadingSuppliers && loadingProducts ? t('purchases.loadingSuppliersProducts') : loadingSuppliers ? t('purchases.loadingSuppliers') : t('purchases.loadingProducts')}...
            </span>
          </div>
        )}

        {/* Main Form Card */}
        <div className="bg-white shadow-sm border border-gray-200 overflow-hidden flex-1 flex flex-col">
          {/* Scrollable Form Content */}
          <div className="flex-1 overflow-y-auto">
            <form className="p-6 space-y-6">
              {/* Header Info */}
              <div className="flex items-center justify-between pb-4 border-b border-gray-300">
                <div className="flex items-center gap-4">
                  <ShoppingCart className="w-6 h-6 text-blue-600" />
                  <div>
                    <h2 className="text-xl font-semibold text-gray-800">{t('purchases.purchaseOrder')}</h2>
                    <p className="text-sm text-gray-500">{t('purchases.poNumber')}: {watch('poNumber')}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${watch('status') === 'Completed' ? 'bg-green-100 text-green-800' :
                      watch('status') === 'Draft' ? 'bg-gray-100 text-gray-800' :
                        watch('status') === 'Pending' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-red-100 text-red-800'
                    }`}>
                    {watch('status')}
                  </span>
                </div>
              </div>

              {/* Supplier & Order Details */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Supplier Details */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-gray-700">{t('purchases.supplierDetails')}</h3>

                  <div className="flex gap-2 items-end">
                    <div className="flex-1">
                      <AutocompleteSelect
                        name="supplierId"
                        label={t('purchases.supplierName')}
                        control={control}
                        options={suppliers}
                        placeholder={loadingSuppliers ? t('purchases.loadingSuppliers') : t('purchases.selectSupplier')}
                        rules={{ required: t('purchases.supplierRequired') }}
                        disabled={loadingSuppliers}
                        emptyRender={() => (
                          <div className="p-4 text-center">
                            <div className="text-gray-500 mb-2">No suppliers found</div>
                            <div className="text-xs text-gray-400">
                              Try a different search term or add a new supplier
                            </div>
                          </div>
                        )}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowSupplierModal(true)}
                      className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition flex items-center gap-2 h-[42px] mb-4"
                      title={t('common.add')}
                    >
                      <Plus size={18} />
                      <span>{t('common.add')}</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-x-4">
                    <Input
                      name="contactPerson"
                      label={t('purchases.contactPerson')}
                      control={control}
                      rules={{ required: t('purchases.contactPersonRequired') }}
                      error={errors.contactPerson?.message}
                      placeholder={t('purchases.enterContactPerson')}
                    />
                    <Input
                      name="contactNumber"
                      label={t('purchases.contactNumber')}
                      control={control}
                      rules={{ required: t('purchases.contactNumberRequired') }}
                      error={errors.contactNumber?.message}
                      placeholder={t('purchases.enterContactNumber')}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-x-4">
                    <Input
                      name="email"
                      label={t('purchases.emailId')}
                      type="email"
                      control={control}
                      rules={{
                        pattern: {
                          value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                          message: t('common.invalidEmail')
                        }
                      }}
                      error={errors.email?.message}
                      placeholder={t('purchases.enterEmailId')}
                    />
                    <Input
                      name="supplierGst"
                      label={t('purchases.gstNumber')}
                      control={control}
                      placeholder={t('purchases.enterGstNumber')}
                    />
                  </div>
                  <Textarea
                    name="supplierAddress"
                    label={t('purchases.supplierAddress')}
                    control={control}
                    rows={2}
                    textareaClassName='resize-none'
                    rules={{ required: t('purchases.supplierAddressRequired') }}
                    error={errors.supplierAddress?.message}
                    placeholder={t('purchases.enterSupplierAddress')}
                  />
                </div>

                {/* Order Details */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-gray-700">{t('purchases.orderDetails')}</h3>

                  <Input
                    name="poDate"
                    label={t('purchases.poDate')}
                    type="date"
                    control={control}
                    rules={{ required: t('purchases.poDateRequired') }}
                    error={errors.poDate?.message}
                  />

                  <Select
                    name="paymentTerms"
                    label={t('purchases.paymentTerms')}
                    control={control}
                    options={paymentTermsOptions}
                    rules={{ required: t('purchases.paymentTermsRequired') }}
                    error={errors.paymentTerms?.message}
                  />

                  <Input
                    name="deliveryDate"
                    label={t('purchases.expectedDeliveryDate')}
                    type="date"
                    control={control}
                    rules={{ required: t('purchases.deliveryDateRequired') }}
                    error={errors.deliveryDate?.message}
                  />
                </div>
              </div>

              {/* Items Section */}
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-4">
                    <h3 className="text-lg font-semibold text-gray-700">{t('purchases.orderItems')}</h3>

                    <button
                      type="button"
                      onClick={() => setShowProductModal(true)}
                      className="px-3 py-1.5 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 transition flex items-center gap-1.5"
                      title={t('purchases.addProduct')}
                    >
                      <Plus size={16} />
                      <span>{t('purchases.addProduct')}</span>
                    </button>


                  </div>
                  {/* Tax Settings */}
                  <div className="flex items-center gap-3  pl-4">
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={taxSettings.enableTax}
                        onChange={(e) => setTaxSettings({ ...taxSettings, enableTax: e.target.checked })}
                        className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                      />
                      <span className="font-medium text-gray-700">{t('purchases.enableTax')}</span>
                    </label>

                    {taxSettings.enableTax && (
                      <>
                        <div className="flex items-center gap-2">
                          <label className="flex items-center gap-1 text-sm">
                            <input
                              type="radio"
                              name="taxType"
                              value="SGST"
                              checked={taxSettings.taxType === 'SGST'}
                              onChange={(e) => setTaxSettings({ ...taxSettings, taxType: e.target.value })}
                              className="w-4 h-4"
                            />
                            <span className="text-gray-700">SGST/CGST</span>
                          </label>

                          <label className="flex items-center gap-1 text-sm">
                            <input
                              type="radio"
                              name="taxType"
                              value="IGST"
                              checked={taxSettings.taxType === 'IGST'}
                              onChange={(e) => setTaxSettings({ ...taxSettings, taxType: e.target.value })}
                              className="w-4 h-4"
                            />
                            <span className="text-gray-700">IGST</span>
                          </label>
                        </div>

                        <label className="flex items-center gap-2 text-sm border-l pl-3">
                          <input
                            type="checkbox"
                            checked={taxSettings.taxIncludedInPrice}
                            onChange={(e) => setTaxSettings({ ...taxSettings, taxIncludedInPrice: e.target.checked })}
                            className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                          />
                          <span className="text-gray-700">{t('purchases.taxIncluded')}</span>
                        </label>
                      </>
                    )}
                  </div>


                </div>

                {/* Items Table */}
                <div className="overflow-x-auto border border-gray-300">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="bg-gray-100">
                        <th className="border border-gray-300 px-2 py-2 text-left text-xs font-semibold">{t('common.sno')}</th>
                        <th className="border border-gray-300 px-2 py-2 text-left text-xs font-semibold">{t('purchases.table.product')}</th>
                        <th className="border border-gray-300 px-2 py-2 text-left text-xs font-semibold">{t('purchases.table.hsnCode')}</th>
                        <th className="border border-gray-300 px-2 py-2 text-left text-xs font-semibold">{t('purchases.table.quantity')}</th>
                        <th className="border border-gray-300 px-2 py-2 text-left text-xs font-semibold">{t('purchases.table.unit')}</th>
                        <th className="border border-gray-300 px-2 py-2 text-left text-xs font-semibold">{t('purchases.table.rate')}</th>
                        <th className="border border-gray-300 px-2 py-2 text-left text-xs font-semibold">{t('purchases.table.discount')}</th>
                        <th className="border border-gray-300 px-2 py-2 text-left text-xs font-semibold">{t('purchases.table.tax')}</th>
                        <th className="border border-gray-300 px-2 py-2 text-left text-xs font-semibold">{t('purchases.table.amount')}</th>
                        <th className="border border-gray-300 px-2 py-2 text-center text-xs font-semibold w-16">{t('purchases.table.action')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {fields.map((field, index) => (
                        <tr key={field.id} className="hover:bg-gray-50">
                          <td className="border border-gray-300 px-2 py-2 text-sm">{index + 1}</td>
                          <td className="border border-gray-300 px-2 py-2">
                            <AutocompleteSelect
                              name={`items.${index}.product`}
                              control={control}
                              options={getAvailableProducts(index)}
                              placeholder={loadingProducts ? t('purchases.loadingProducts') : t('common.searchProduct')}
                              className="mb-0"
                              inputClassName="text-sm py-1.5"
                              disabled={loadingProducts}
                              emptyRender={() => (
                                <div className="p-4 text-center">
                                  <div className="text-gray-500 mb-2">{t('common.noProductsFound')}</div>
                                  <div className="text-xs text-gray-400">
                                    {t('common.tryDifferentSearch')}
                                  </div>
                                </div>
                              )}
                            />
                          </td>
                          <td className="border border-gray-300 px-2 py-2">
                            <Input
                              name={`items.${index}.hsnCode`}
                              control={control}
                              className="w-24 text-sm"
                              placeholder={t('purchases.table.hsnCode')}
                            />
                          </td>
                          <td className="border border-gray-300 px-2 py-2">
                            <Input
                              name={`items.${index}.quantity`}
                              type="number"
                              control={control}
                              className="w-20 text-sm"
                              min="1"
                              onBlur={() => calculateItemAmount(index)}
                            />
                          </td>
                          <td className="border border-gray-300 px-2 py-2">
                            <Select
                              name={`items.${index}.unit`}
                              control={control}
                              options={units}
                              className="w-20 text-sm"
                            />
                          </td>
                          <td className="border border-gray-300 px-2 py-2">
                            <Input
                              name={`items.${index}.unitPrice`}
                              type="number"
                              control={control}
                              className="w-24 text-sm"
                              min="0"
                              step="0.01"
                              onBlur={() => calculateItemAmount(index)}
                            />
                          </td>
                          <td className="border border-gray-300 px-2 py-2">
                            <Input
                              name={`items.${index}.discount`}
                              type="number"
                              control={control}
                              className="w-16 text-sm"
                              min="0"
                              max="100"
                              step="0.01"
                              onBlur={() => calculateItemAmount(index)}
                            />
                          </td>
                          <td className="border border-gray-300 px-2 py-2">
                            <Input
                              name={`items.${index}.tax`}
                              type="number"
                              control={control}
                              className="w-16 text-sm"
                              min="0"
                              max="100"
                              step="0.01"
                              onBlur={() => calculateItemAmount(index)}
                              disabled={!taxSettings.enableTax}
                            />
                          </td>
                          <td className="border border-gray-300 px-2 py-2 text-right text-sm font-medium">
                            ₹{(items[index]?.amount || 0).toFixed(2)}
                          </td>
                          <td className="border border-gray-300 px-2 py-2 text-center">
                            <button
                              type="button"
                              onClick={() => remove(index)}
                              className="text-red-600 hover:text-red-800 disabled:text-gray-400"
                              disabled={fields.length === 1}
                            >
                              <Trash2 size={16} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <button
                  type="button"
                  onClick={() => append({
                    product: '',
                    hsnCode: '',
                    quantity: 1,
                    unit: 'Piece',
                    unitPrice: 0,
                    discount: 0,
                    tax: 18,
                    amount: 0
                  })}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition text-sm mt-3"
                >
                  <Plus size={16} /> {t('purchases.addItem')}
                </button>
              </div>

              {/* Summary Section */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Remarks */}
                <div>
                  <Textarea
                    name="remarks"
                    label={t('purchases.remarks')}
                    control={control}
                    rows={4}
                    placeholder={t('common.enterRemarks')}
                  />
                </div>

                {/* Financial Summary */}
                <div className="bg-gray-50 p-4 rounded-md">
                  <h3 className="text-lg font-semibold text-gray-700 mb-3">{t('common.summary')}</h3>

                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>{t('purchases.financials.subtotalBeforeTax')}:</span>
                      <span className="font-medium">₹{totals.subtotalWithoutTax.toFixed(2)}</span>
                    </div>

                    {taxSettings.enableTax && (
                      <>
                        {taxSettings.taxType === 'SGST' ? (
                          <>
                            <div className="flex justify-between text-sm">
                              <span>{t('purchases.financials.sgst')}:</span>
                              <span className="font-medium">₹{totals.sgst.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                              <span>{t('purchases.financials.cgst')}:</span>
                              <span className="font-medium">₹{totals.cgst.toFixed(2)}</span>
                            </div>
                          </>
                        ) : (
                          <div className="flex justify-between text-sm">
                            <span>{t('purchases.financials.igst')}:</span>
                            <span className="font-medium">₹{totals.igst.toFixed(2)}</span>
                          </div>
                        )}
                        <div className="flex justify-between text-sm border-t border-gray-300 pt-1">
                          <span>{t('purchases.financials.totalTax')}:</span>
                          <span className="font-medium">₹{totals.totalTax.toFixed(2)}</span>
                        </div>
                      </>
                    )}

                    <div className="flex justify-between text-sm border-t border-gray-300 pt-2">
                      <span>{t('purchases.financials.subtotalAfterTax')}:</span>
                      <span className="font-semibold">₹{totals.subtotal.toFixed(2)}</span>
                    </div>

                    {/* Order Discount */}
                    <div className="bg-white p-3 rounded border border-gray-200">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm font-medium text-gray-700">{t('purchases.orderDiscount')}:</span>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setOrderDiscountType('percentage')}
                            className={`px-2 py-1 text-xs rounded transition ${orderDiscountType === 'percentage'
                                ? 'bg-blue-600 text-white'
                                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                              }`}
                          >
                            %
                          </button>
                          <button
                            type="button"
                            onClick={() => setOrderDiscountType('fixed')}
                            className={`px-2 py-1 text-xs rounded transition ${orderDiscountType === 'fixed'
                                ? 'bg-blue-600 text-white'
                                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                              }`}
                          >
                            ₹
                          </button>
                        </div>
                      </div>
                      <div className="flex justify-between items-center gap-2">
                        <Input
                          name="orderDiscount"
                          type="number"
                          control={control}
                          className="flex-1 text-sm text-right"
                          min="0"
                          max={orderDiscountType === 'percentage' ? 100 : totals.subtotal}
                          step="0.01"
                          placeholder={orderDiscountType === 'percentage' ? t('common.enterPercentage') : t('common.enterAmount')}
                        />
                        <span className="text-sm font-medium text-red-600 min-w-[80px] text-right">
                          -₹{totals.orderDiscountAmount.toFixed(2)}
                        </span>
                      </div>
                    </div>

                    <div className="flex justify-between text-sm border-t border-gray-300 pt-2">
                      <span className="font-medium">{t('purchases.financials.subtotalAfterDiscount')}:</span>
                      <span className="font-semibold text-green-600">₹{totals.subtotalAfterDiscount.toFixed(2)}</span>
                    </div>

                    <div className="flex justify-between items-center text-sm">
                      <span>{t('purchases.freight')}:</span>
                      <Input
                        name="freight"
                        type="number"
                        control={control}
                        className="w-32 text-sm text-right"
                        min="0"
                        step="0.01"
                      />
                    </div>

                    <div className="flex justify-between items-center text-sm">
                      <span>{t('purchases.insurance')}:</span>
                      <Input
                        name="insurance"
                        type="number"
                        control={control}
                        className="w-32 text-sm text-right"
                        min="0"
                        step="0.01"
                      />
                    </div>

                    <div className="flex justify-between items-center text-sm">
                      <span>{t('purchases.otherCharges')}:</span>
                      <Input
                        name="otherCharges"
                        type="number"
                        control={control}
                        className="w-32 text-sm text-right"
                        min="0"
                        step="0.01"
                      />
                    </div>

                    <div className="flex justify-between text-sm">
                      <span>{t('purchases.financials.roundOff')}:</span>
                      <span className="font-medium">₹{totals.roundOff.toFixed(2)}</span>
                    </div>

                    <div className="border-t border-gray-300 pt-2 mt-2">
                      <div className="flex justify-between text-lg font-bold">
                        <span>{t('purchases.financials.netPayable')}:</span>
                        <span className="text-blue-600">₹{totals.netPayable.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

            </form>
          </div>

          {/* Sticky Action Buttons Footer */}
          <div className="flex flex-wrap gap-3 justify-end border-t border-gray-300 p-4 bg-white">
            <button
              type="button"
              onClick={handleCancel}
              className="flex items-center gap-2 px-6 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition"
            >
              <X size={16} /> {t('common.close')}
            </button>

            <button
              type="button"
              onClick={handleSaveCompleted}
              disabled={isSubmitting}
              className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition disabled:bg-blue-400 disabled:cursor-not-allowed"
            >
              <Save size={16} /> {isSubmitting ? t('common.saving') : t('common.save')}
            </button>
          </div>
        </div>
      </div>

      <ConfirmationDialog
        isOpen={showConfirmDialog}
        onClose={() => setShowConfirmDialog(false)}
        onConfirm={handleConfirmClose}
        onCancel={handleContinueEditing}
        title={t('common.discardChanges')}
        message={t('common.discardChangesMessage')}
        confirmText={t('common.discard')}
        cancelText={t('common.continueEditing')}
      />

      {/* Supplier Add Modal */}
      {showSupplierModal && (
        <SupplierAddEditForm
          editMode={false}
          supplierModal={showSupplierModal}
          setSupplierModal={setShowSupplierModal}
          supplierId={null}
          fetchData={fetchSuppliersData}
        />
      )}

      {/* Product Add Modal */}
      {showProductModal && (
        <ProductAddEditForm
          editMode={false}
          productModal={showProductModal}
          setProductModal={setShowProductModal}
          product={null}
          fetchData={fetchProductsData}
        />
      )}
    </div>
  );
};

export default AddEditForm;