import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Form, Input, Textarea, Select, AutocompleteSelect, AutocompleteMultiSelect, FileUpload } from '../../components/Form';
import Modal from '../../components/Modal';
import { Package, DollarSign, Box, Truck, Image as ImageIcon, Settings, ClipboardList, Plus, Trash2, CheckSquare, Square } from 'lucide-react';
import { toast } from 'sonner';
import { productService } from '../../services/productService';
import { getCategories } from '../../services/api';
import { getBrands } from '../../services/brandService';
import { getSuppliers } from '../../services/supplierService';
import { stockMovementService } from '../../services/stockMovementService';

const AddEditForm = ({ editMode, productModal, setProductModal, product, fetchData }) => {
  const { t } = useTranslation();
  const [activeSection, setActiveSection] = useState('basic');
  const [categories, setCategories] = useState([]);
  const [brands, setBrands] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [uploadedImage, setUploadedImage] = useState(null);
  const [stockHistory, setStockHistory] = useState([]);
  const [showAdjustStockModal, setShowAdjustStockModal] = useState(false);
  const [adjustmentData, setAdjustmentData] = useState({ type: 'add', quantity: '', reason: '' });
  const [notes, setNotes] = useState([]);
  const [newNote, setNewNote] = useState('');

  const {
    control,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { isSubmitting, errors }
  } = useForm({
    defaultValues: {
      product_name: '',
      product_code: '',
      hsn_code: '',
      barcode: '',
      category_id: '',
      brand_id: '',
      unit: 'Piece',
      purchase_price: '',
      selling_price: '',
      mrp: '',
      wholesale_price: '',
      dealer_price: '',
      discount: '',
      tax_rate: '',
      current_stock: '',
      minimum_stock: '',
      opening_stock: '',
      reorder_level: '',
      supplier_ids: [],
      product_image: null,
      description: '',
      tags: '',
      status: 'Active',
      product_type: 'Physical',
      warranty_period: '',
      expiry_date: '',
      batch_no: '',
      serial_no: '',
      notes: '',
      default_wastage: ''
    }
  });

  const purchasePrice = watch('purchase_price');
  const taxRate = watch('tax_rate');

  // Calculate landing price
  useEffect(() => {
    if (purchasePrice && taxRate) {
      const landing = parseFloat(purchasePrice) + (parseFloat(purchasePrice) * parseFloat(taxRate) / 100);
      // Landing price is auto-calculated in DB, just for display
    }
  }, [purchasePrice, taxRate]);

  // Fetch categories, brands, and suppliers
  useEffect(() => {
    const fetchDropdownData = async () => {
      try {
        const [catResponse, brandResponse, supplierResponse] = await Promise.all([
          getCategories({ limit: 1000 }),
          getBrands({ limit: 1000 }),
          getSuppliers({ limit: 1000 })
        ]);

        if (catResponse.success) {
          setCategories(catResponse.data);
        }
        if (brandResponse.success) {
          setBrands(brandResponse.data);
        }
        if (supplierResponse.success) {
          setSuppliers(supplierResponse.data);
        }
      } catch (error) {
        console.error('Error fetching dropdown data:', error);
      }
    };

    if (productModal) {
      fetchDropdownData();
    }
  }, [productModal]);

  // Load product data in edit mode
  useEffect(() => {
    const loadProductData = async () => {
      if (editMode && product && productModal) {
        // Parse supplier_ids if it's a JSON string
        let parsedSupplierIds = [];
        if (product.supplier_ids) {
          try {
            parsedSupplierIds = typeof product.supplier_ids === 'string'
              ? JSON.parse(product.supplier_ids)
              : product.supplier_ids;
          } catch (e) {
            console.error('Error parsing supplier_ids:', e);
            parsedSupplierIds = [];
          }
        }

        // Parse notes if it's a JSON string
        let parsedNotes = [];
        if (product.notes) {
          try {
            parsedNotes = typeof product.notes === 'string'
              ? JSON.parse(product.notes)
              : product.notes;
          } catch (e) {
            console.error('Error parsing notes:', e);
            parsedNotes = [];
          }
        }
        setNotes(parsedNotes);

        // Fetch product images
        let productImageFile = null;
        try {
          const imagesResponse = await window.api.getProductImages(product.id);
          if (imagesResponse.success && imagesResponse.data.length > 0) {
            // Get the primary image (first one)
            const primaryImage = imagesResponse.data[0];
            if (primaryImage.imageData) {
              // Convert base64 data URL to File object for the FileUpload component
              const response = await fetch(primaryImage.imageData);
              const blob = await response.blob();
              const file = new File([blob], primaryImage.image_name, { type: primaryImage.mime_type });
              productImageFile = [file];
              setUploadedImage(primaryImage.imageData);
            }
          }
        } catch (error) {
          console.error('Error loading product images:', error);
        }

        reset({
          ...product,
          purchase_price: product.purchase_price || '',
          selling_price: product.selling_price || '',
          mrp: product.mrp || '',
          wholesale_price: product.wholesale_price || '',
          dealer_price: product.dealer_price || '',
          discount: product.discount || '',
          tax_rate: product.tax_rate || '',
          current_stock: product.current_stock || '',
          minimum_stock: product.minimum_stock || '',
          opening_stock: product.opening_stock || '',
          reorder_level: product.reorder_level || '',
          supplier_ids: parsedSupplierIds,
          product_image: productImageFile,
          notes: product.notes || '',
          default_wastage: product.default_wastage || ''
        });
      } else if (!editMode && productModal) {
        reset({
          product_name: '',
          product_code: '',
          hsn_code: '',
          barcode: '',
          category_id: '',
          brand_id: '',
          unit: 'Piece',
          purchase_price: '',
          selling_price: '',
          mrp: '',
          wholesale_price: '',
          dealer_price: '',
          discount: '',
          tax_rate: '',
          current_stock: '',
          minimum_stock: '',
          opening_stock: '',
          reorder_level: '',
          supplier_ids: [],
          product_image: null,
          description: '',
          tags: '',
          status: 'Active',
          product_type: 'Physical',
          warranty_period: '',
          expiry_date: '',
          batch_no: '',
          notes: '',
          default_wastage: ''
        });
        setNotes([]);
      }
    };

    loadProductData();
  }, [editMode, product, productModal, reset]);



  const onSubmit = async (data) => {
    try {
      let productId = editMode ? product.id : null;

      // Prepare product data - exclude image and fix empty foreign keys
      const productData = {
        ...data,
        category_id: data.category_id || null,
        brand_id: data.brand_id || null,
        notes: JSON.stringify(notes)
      };

      // Remove product_image from product data (will be handled separately)
      delete productData.product_image;

      // Create or update product first
      if (editMode) {
        await productService.updateProduct(product.id, productData);
      } else {
        const response = await productService.createProduct(productData);
        productId = response.productId;
      }

      // Handle image upload if there's a file
      if (data.product_image && data.product_image[0] instanceof File) {
        const file = data.product_image[0];

        // Check if this is a new file (not the existing one loaded in edit mode)
        const isNewFile = !uploadedImage || file.size !== (await fetch(uploadedImage).then(r => r.blob()).then(b => b.size));

        if (isNewFile) {
          // In edit mode, delete old images first
          if (editMode) {
            try {
              const existingImages = await window.api.getProductImages(productId);
              if (existingImages.success && existingImages.data.length > 0) {
                for (const img of existingImages.data) {
                  await window.api.deleteProductImage(img.id);
                }
              }
            } catch (error) {
              console.error('Error deleting old images:', error);
            }
          }

          // Convert file to base64 using Promise
          const base64Data = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result.split(',')[1]);
            reader.onerror = reject;
            reader.readAsDataURL(file);
          });

          // Upload new image
          const uploadResponse = await window.api.uploadProductImage({
            fileData: base64Data,
            fileName: file.name,
            mimeType: file.type,
            productId: productId
          });

          if (uploadResponse.success) {
            console.log('✅ Image uploaded successfully:', uploadResponse.filePath);
            toast.success(editMode ? t('products.productImageUpdated') : t('products.productImageCreated'));
          } else {
            console.error('❌ Image upload failed:', uploadResponse.message);
            toast.warning(t('products.productSavedImageFailed'));
          }
        } else {
          toast.success(editMode ? t('products.productUpdated') : t('products.productCreated'));
        }
      } else {
        toast.success(editMode ? t('products.productUpdated') : t('products.productCreated'));
      }

      setProductModal(false);
      fetchData();
    } catch (error) {
      console.error('Error saving product:', error);
      toast.error(error.message || t('products.failedToSave'));
    }
  };

  const fetchStockHistory = async () => {
    if (product && product.id) {
      const response = await stockMovementService.getHistory({ productId: product.id });
      if (response.success) {
        setStockHistory(response.data);
      }
    }
  };

  useEffect(() => {
    if (activeSection === 'stock' && editMode) {
      fetchStockHistory();
    }
  }, [activeSection, editMode, product]);

  const handleAdjustStock = async () => {
    if (!adjustmentData.quantity || !adjustmentData.reason) {
      toast.error(t('products.fillAllFields'));
      return;
    }

    try {
      const response = await stockMovementService.adjustStock({
        productId: product.id,
        adjustmentType: adjustmentData.type,
        quantity: parseFloat(adjustmentData.quantity),
        reason: adjustmentData.reason
      });

      if (response.success) {
        toast.success(t('products.stockAdjusted'));
        setShowAdjustStockModal(false);
        setAdjustmentData({ type: 'add', quantity: '', reason: '' });
        fetchStockHistory();
        // Update current stock in form
        setValue('current_stock', response.newStock);
        fetchData(); // Refresh parent list
      } else {
        toast.error(response.message);
      }
    } catch (error) {
      console.error('Error adjusting stock:', error);
      toast.error(t('toasts.operationFailed'));
    }
  };

  const handleCancel = () => {
    setProductModal(false);
  };

  const categoryOptions = categories.map(cat => ({
    value: cat.id,
    label: cat.name
  }));

  const brandOptions = brands.map(brand => ({
    value: brand.id,
    label: brand.name
  }));

  const supplierOptions = suppliers.map(supplier => ({
    value: supplier.id,
    label: supplier.supplier_name,
    description: supplier.contact_person || supplier.phone
  }));

  const unitOptions = [
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
    { value: 'Active', label: t('common.active') },
    { value: 'Inactive', label: t('common.inactive') }
  ];

  const productTypeOptions = [
    { value: 'Physical', label: 'Physical' },
    { value: 'Digital', label: 'Digital' },
    { value: 'Service', label: 'Service' }
  ];

  const taxOptions = [
    { value: '0', label: '0%' },
    { value: '5', label: '5%' },
    { value: '12', label: '12%' },
    { value: '18', label: '18%' },
    { value: '28', label: '28%' }
  ];

  const sections = [
    { id: 'basic', label: t('products.basicInfo'), icon: Package },
    { id: 'stock', label: t('products.stockManagement'), icon: Box },
    { id: 'supplier', label: t('products.supplierDetails'), icon: Truck },
    { id: 'media', label: t('products.mediaDescription'), icon: ImageIcon },
    { id: 'notes', label: t('products.notes'), icon: ClipboardList },
    { id: 'advanced', label: t('products.additionalInfo'), icon: Settings }
  ];

  return (
    <Modal
      isOpen={productModal}
      onClose={handleCancel}
      title={editMode ? t('products.editProduct') : t('products.addNewProduct')}
      width="1000px"
      onSubmit={handleSubmit(onSubmit)}
    >
      <form className="space-y-6 ">
        {/* Section Tabs */}
        <div className="border-b border-gray-200">
          <div className="flex space-x-1 overflow-x-auto">
            {sections.map((section) => {
              const Icon = section.icon;
              return (
                <button
                  key={section.id}
                  type="button"
                  onClick={() => setActiveSection(section.id)}
                  className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${activeSection === section.id
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                >
                  <Icon size={16} />
                  {section.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Section Content */}
        <div className=" min-h-[60vh] max-h-[60vh] overflow-y-auto px-1">
          {/* Basic Information */}
          {activeSection === 'basic' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  name="product_name"
                  label={t('products.productName')}
                  control={control}
                  placeholder={t('products.enterProductName')}
                  rules={{ required: t('forms.required') }}
                  error={errors.product_name?.message}
                />

                {editMode && (
                  <Input
                    name="product_code"
                    label={t('products.productCodeSKU')}
                    control={control}
                    placeholder={t('products.autoGenerated')}
                    disabled
                    error={errors.product_code?.message}
                  />
                )}

                <Input
                  name="hsn_code"
                  label={t('products.hsnCode')}
                  control={control}
                  placeholder={t('products.enterHSN')}
                  error={errors.hsn_code?.message}
                />

                <Input
                  name="barcode"
                  label={t('products.barcodeQR')}
                  control={control}
                  placeholder={t('products.enterBarcode')}
                  error={errors.barcode?.message}
                />

                <AutocompleteSelect
                  name="category_id"
                  label={t('products.category')}
                  control={control}
                  options={categoryOptions}
                  placeholder={t('products.selectCategory')}
                  error={errors.category_id?.message}
                />

                <AutocompleteSelect
                  name="brand_id"
                  label={t('products.brand')}
                  control={control}
                  options={brandOptions}
                  placeholder={t('products.selectBrand')}
                  error={errors.brand_id?.message}
                />

                <Select
                  name="unit"
                  label={t('products.unit')}
                  control={control}
                  options={unitOptions}
                  placeholder={t('products.selectUnit')}
                  error={errors.unit?.message}
                />

                <Select
                  name="status"
                  label={t('common.status')}
                  control={control}
                  options={statusOptions}
                  error={errors.status?.message}
                />

                <div className="col-span-1 md:col-span-2 border-t border-gray-200 my-2 pt-4">
                  <h3 className="text-sm font-medium text-gray-700 mb-3">{t('products.pricingTax')}</h3>
                </div>

                <Input
                  name="purchase_price"
                  label={t('products.purchasePrice')}
                  type="number"
                  control={control}
                  placeholder="0.00"
                  step="0.01"
                  error={errors.purchase_price?.message}
                />

                <Input
                  name="selling_price"
                  label={t('products.sellingPrice')}
                  type="number"
                  control={control}
                  placeholder="0.00"
                  step="0.01"
                  error={errors.selling_price?.message}
                />

                <Input
                  name="mrp"
                  label={t('products.mrp')}
                  type="number"
                  control={control}
                  placeholder="0.00"
                  step="0.01"
                  error={errors.mrp?.message}
                />

                <Input
                  name="wholesale_price"
                  label="Wholesale Price"
                  type="number"
                  control={control}
                  placeholder="0.00"
                  step="0.01"
                  error={errors.wholesale_price?.message}
                />

                <Input
                  name="dealer_price"
                  label="Dealer/Customer Price"
                  type="number"
                  control={control}
                  placeholder="0.00"
                  step="0.01"
                  error={errors.dealer_price?.message}
                />

                <Input
                  name="discount"
                  label={t('products.discount')}
                  type="number"
                  control={control}
                  placeholder="0"
                  step="0.01"
                  error={errors.discount?.message}
                />

                <Select
                  name="tax_rate"
                  label={t('products.taxRate')}
                  control={control}
                  options={taxOptions}
                  placeholder={t('products.selectTaxRate')}
                  error={errors.tax_rate?.message}
                />

                <div className="flex flex-col">
                  <label className="text-sm font-medium text-gray-700 mb-1">
                    {t('products.landingPrice')}
                  </label>
                  <div className="px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg text-sm text-gray-600">
                    ₹{purchasePrice && taxRate ?
                      (parseFloat(purchasePrice) + (parseFloat(purchasePrice) * parseFloat(taxRate) / 100)).toFixed(2) :
                      '0.00'
                    }
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Pricing & Tax */}
          {/* Pricing & Tax - Merged into Basic Info */}
          {/* {activeSection === 'pricing' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 ... fields moved to basic info ...
              </div>
            </div>
          )} */}

          {/* Stock Management */}
          {activeSection === 'stock' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="relative">
                  <Input
                    name="current_stock"
                    label={t('products.currentStock')}
                    type="number"
                    control={control}
                    placeholder="0"
                    step="0.01"
                    disabled={editMode} // Disable direct edit in edit mode
                    error={errors.current_stock?.message}
                  />
                  {editMode && (
                    <button
                      type="button"
                      onClick={() => setShowAdjustStockModal(true)}
                      className="absolute top-8 right-2 px-2 py-1 text-xs bg-blue-50 text-blue-600 rounded hover:bg-blue-100"
                    >
                      {t('products.adjust')}
                    </button>
                  )}
                </div>

                <Input
                  name="default_wastage"
                  label={t('products.wastage')}
                  type="number"
                  control={control}
                  placeholder="0"
                  step="0.001"
                  error={errors.default_wastage?.message}
                />

                <Input
                  name="minimum_stock"
                  label={t('products.minimumStockAlert')}
                  type="number"
                  control={control}
                  placeholder="0"
                  step="0.01"
                  error={errors.minimum_stock?.message}
                />

                <Input
                  name="opening_stock"
                  label={t('products.openingStock')}
                  type="number"
                  control={control}
                  placeholder="0"
                  step="0.01"
                  disabled={editMode} // Opening stock typically shouldn't change
                  error={errors.opening_stock?.message}
                />

                <Input
                  name="reorder_level"
                  label={t('products.reorderLevel')}
                  type="number"
                  control={control}
                  placeholder="0"
                  step="0.01"
                  error={errors.reorder_level?.message}
                />
              </div>

              {/* Stock History Table */}
              {editMode && (
                <div className="mt-6">
                  <h3 className="text-sm font-medium text-gray-700 mb-3">{t('products.stockMovementHistory')}</h3>
                  <div className="border rounded-lg overflow-hidden">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">{t('common.date')}</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">{t('products.type')}</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">{t('products.ref')}</th>
                          <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">{t('products.qty')}</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">{t('products.reason')}</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {stockHistory.length > 0 ? (
                          stockHistory.map((movement) => (
                            <tr key={movement.id}>
                              <td className="px-4 py-2 text-xs text-gray-900">
                                {new Date(movement.created_at).toLocaleString()}
                              </td>
                              <td className="px-4 py-2 text-xs">
                                <span className={`px-2 py-0.5 rounded-full ${movement.transaction_type === 'IN'
                                    ? 'bg-green-100 text-green-800'
                                    : 'bg-red-100 text-red-800'
                                  }`}>
                                  {movement.transaction_type}
                                </span>
                              </td>
                              <td className="px-4 py-2 text-xs text-gray-500">
                                {movement.reference_number || '-'}
                                <div className="text-[10px] text-gray-400">{movement.reference_type}</div>
                              </td>
                              <td className="px-4 py-2 text-xs text-right font-medium">
                                {movement.quantity}
                              </td>
                              <td className="px-4 py-2 text-xs text-gray-500">
                                {movement.reason}
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan="5" className="px-4 py-4 text-center text-xs text-gray-500">
                              {t('products.noStockMovements')}
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Supplier Details */}
          {activeSection === 'supplier' && (
            <div className="space-y-4 min-h-[400px]">
              <AutocompleteMultiSelect
                name="supplier_ids"
                label={t('products.suppliers')}
                control={control}
                options={supplierOptions}
                placeholder={t('products.searchSelectSuppliers')}
                error={errors.supplier_ids?.message}
              />
              <p className="text-xs text-gray-500">
                {t('products.searchSelectMultiple')}
              </p>
            </div>
          )}

          {/* Media & Description */}
          {activeSection === 'media' && (
            <div className="space-y-4 ">
              <FileUpload
                name="product_image"
                label={t('products.productImage')}
                control={control}
                accept="image/*"
                maxFiles={1}
                maxSize={5 * 1024 * 1024}
                previews={true}
                className="mb-4"
              />
              <p className="text-xs text-gray-500 -mt-2">
                {t('products.uploadImage')}
              </p>

              <Textarea
                name="description"
                label={t('products.productDescription')}
                control={control}
                placeholder={t('products.enterDescription')}
                rows={4}
                error={errors.description?.message}
              />

              <Input
                name="tags"
                label={t('products.tagsKeywords')}
                control={control}
                placeholder={t('products.enterTags')}
                error={errors.tags?.message}
              />
            </div>
          )}

          {/* Additional Info */}
          {activeSection === 'advanced' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Select
                  name="product_type"
                  label={t('products.productType')}
                  control={control}
                  options={productTypeOptions}
                  error={errors.product_type?.message}
                />

                <Input
                  name="warranty_period"
                  label={t('products.warrantyPeriod')}
                  control={control}
                  placeholder={t('products.warrantyPlaceholder')}
                  error={errors.warranty_period?.message}
                />

                <Input
                  name="expiry_date"
                  label={t('products.expiryDate')}
                  type="date"
                  control={control}
                  error={errors.expiry_date?.message}
                />

                <Input
                  name="batch_no"
                  label={t('products.batchNumber')}
                  control={control}
                  placeholder={t('products.enterBatchNo')}
                  error={errors.batch_no?.message}
                />

                <Input
                  name="serial_no"
                  label={t('products.serialNumber')}
                  control={control}
                  placeholder={t('products.enterSerialNo')}
                  error={errors.serial_no?.message}
                />
              </div>
            </div>
          )}

          {/* Notes & To-Do */}
          {activeSection === 'notes' && (
            <div className="space-y-4">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  placeholder={t('products.writeNote')}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      if (newNote.trim()) {
                        setNotes([...notes, { id: Date.now(), text: newNote }]);
                        setNewNote('');
                      }
                    }
                  }}
                />
                <button
                  type="button"
                  onClick={() => {
                    if (newNote.trim()) {
                      setNotes([...notes, { id: Date.now(), text: newNote }]);
                      setNewNote('');
                    }
                  }}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
                >
                  <Plus size={18} />
                  {t('products.add')}
                </button>
              </div>

              <div className="space-y-2 mt-4">
                {notes.length === 0 ? (
                  <div className="text-center py-8 text-gray-500 border-2 border-dashed rounded-lg">
                    <ClipboardList className="mx-auto h-12 w-12 text-gray-400 mb-2" />
                    <p>{t('products.noNotes')}</p>
                  </div>
                ) : (
                  notes.map((note) => (
                    <div
                      key={note.id}
                      className="flex items-center gap-3 p-3 rounded-lg border bg-white border-gray-200"
                    >
                      <div className="flex-1">
                        <input
                          type="text"
                          value={note.text}
                          onChange={(e) => {
                            setNotes(notes.map(n =>
                              n.id === note.id ? { ...n, text: e.target.value } : n
                            ));
                          }}
                          className="w-full bg-transparent border-none focus:ring-0 p-0 text-gray-900"
                        />
                      </div>

                      <button
                        type="button"
                        onClick={() => setNotes(notes.filter(n => n.id !== note.id))}
                        className="text-gray-400 hover:text-red-500 transition-colors"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>


      </form>

      {/* Stock Adjustment Modal */}
      <Modal
        isOpen={showAdjustStockModal}
        onClose={() => setShowAdjustStockModal(false)}
        title={t('products.adjustStock')}
        width="500px"
        onSubmit={handleAdjustStock}
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('products.adjustmentType')}</label>
            <select
              value={adjustmentData.type}
              onChange={(e) => setAdjustmentData({ ...adjustmentData, type: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="add">{t('products.add')} (+)</option>
              <option value="subtract">{t('products.remove')} (-)</option>
              <option value="set">{t('common.set') || 'Set'} (=)</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('products.quantity')}</label>
            <input
              type="number"
              value={adjustmentData.quantity}
              onChange={(e) => setAdjustmentData({ ...adjustmentData, quantity: e.target.value })}
              placeholder={t('products.enterQuantity')}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('products.reason')}</label>
            <textarea
              value={adjustmentData.reason}
              onChange={(e) => setAdjustmentData({ ...adjustmentData, reason: e.target.value })}
              placeholder={t('products.enterReason')}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>
      </Modal>
    </Modal>
  );
};

export default AddEditForm;