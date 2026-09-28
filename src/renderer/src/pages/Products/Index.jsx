import React, { useState, useEffect } from 'react';
import { 
  Package,
  Edit,
  Trash2,
  Plus,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Upload,
  FileSpreadsheet,
  Loader2
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { format } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import DataTable from '../../components/DataTable';
import AddEditForm from './AddEditForm';
import { toast } from 'sonner';
import { productService } from '../../services/productService';
import AlertModal from '../../components/AlertModal';
import {
  buildPriceSheetRows
} from '../../utils/productPriceSheetExport';

const Index = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [data, setData] = useState([]);
  const [totalRecords, setTotalRecords] = useState(0);
  const [loading, setLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [deleteModal, setDeleteModal] = useState({
    isOpen: false,
    product: null,
    loading: false
  });
  const [filters, setFilters] = useState({
    search: '',
    sortBy: 'id',
    sortOrder: 'desc',
    page: 1,
    limit: 10
  });
  const [exporting, setExporting] = useState(null);

  const fetchData = async (newFilters = {}) => {
    try {
      setLoading(true);
      
      const updatedFilters = { ...filters, ...newFilters };
      
      const apiFilters = {
        searchTerm: updatedFilters.search || '',
        sortKey: updatedFilters.sortBy === 'sno' ? 'id' : updatedFilters.sortBy,
        sortDirection: updatedFilters.sortOrder === 'desc' ? 'DESC' : 'ASC',
        page: updatedFilters.page || 1,
        limit: updatedFilters.limit || 10
      };

      console.log('Fetching with filters:', apiFilters);
      
      const response = await productService.getProducts(apiFilters);
      
      if (response.success) {
        setData(response.data || []);
        setTotalRecords(response.total || 0);
        
        setFilters(prev => ({
          ...prev,
          ...updatedFilters,
          page: parseInt(updatedFilters.page, 10) || 1
        }));
      } else {
        toast.error(response.message || t('toasts.dataLoadFailed'));
      }
    } catch (error) {
      console.error('Error fetching products:', error);
      toast.error(t('toasts.dataLoadFailed'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleDeleteClick = (product) => {
    setDeleteModal({
      isOpen: true,
      product,
      loading: false
    });
  };

  const handleConfirmDelete = async () => {
    if (!deleteModal.product) return;
    
    try {
      setDeleteModal(prev => ({ ...prev, loading: true }));
      
      const response = await productService.deleteProduct(deleteModal.product.id);
      
      if (response && response.success) {
        toast.success(response.message || t('toasts.deleteSuccess'));
        fetchData();
      } else {
        throw new Error(response?.message || t('toasts.deleteFailed'));
      }
    } catch (error) {
      console.error('Error deleting product:', error);
      toast.error(error.message || t('toasts.deleteFailed'));
    } finally {
      setDeleteModal({ isOpen: false, product: null, loading: false });
    }
  };

  const handleCancelDelete = () => {
    setDeleteModal({ isOpen: false, product: null, loading: false });
  };

  const columns = [
    { 
      key: 'sno',
      label: t('common.sNo'),
      width: '80px',
      sortable: false
    },
    { 
      key: 'product_code', 
      label: t('products.productCode'), 
      sortable: true,
      render: (value) => (
        <span className="text-sm font-medium text-gray-900">{value || '-'}</span>
      )
    },
    { 
      key: 'product_name', 
      label: t('products.productName'), 
      sortable: true,
      render: (value) => (
        <span className="text-sm font-semibold text-gray-900">{value}</span>
      )
    },
    { 
      key: 'category_name', 
      label: t('products.category'), 
      sortable: false,
      render: (value) => (
        <span className="text-sm text-gray-600">{value || '-'}</span>
      )
    },
    { 
      key: 'brand_name', 
      label: t('products.brand'), 
      sortable: false,
      render: (value) => (
        <span className="text-sm text-gray-600">{value || '-'}</span>
      )
    },
    { 
      key: 'selling_price', 
      label: t('products.price'), 
      sortable: true,
      render: (value) => (
        <span className="text-sm font-medium text-green-700">₹{parseFloat(value || 0).toFixed(2)}</span>
      )
    },
    { 
      key: 'current_stock', 
      label: t('products.stock'), 
      sortable: true,
      render: (value, row) => {
        const stock = parseFloat(value || 0);
        const minStock = parseFloat(row.minimum_stock || 0);
        const isLow = stock <= minStock && minStock > 0;
        
        return (
          <div className="flex items-center gap-1.5">
            {isLow && <AlertTriangle className="w-4 h-4 text-orange-500" />}
            <span className={`text-sm font-medium ${
              isLow ? 'text-orange-700' : 'text-gray-900'
            }`}>
              {stock} {row.unit || 'Piece'}
            </span>
          </div>
        );
      }
    },
    { 
      key: 'status', 
      label: t('common.status'),
      sortable: true,
      render: (value) => (
        <div className="flex items-center">
          {value === 'Active' ? (
            <>
              <CheckCircle2 className="w-4 h-4 text-green-500 mr-1.5" />
              <span className="text-sm font-medium text-green-700">{t('common.active')}</span>
            </>
          ) : (
            <>
              <XCircle className="w-4 h-4 text-red-500 mr-1.5" />
              <span className="text-sm font-medium text-red-700">{t('common.inactive')}</span>
            </>
          )}
        </div>
      )
    },
    {
      key: 'actions',
      label: t('common.actions'),
      width: '120px',
      sortable: false,
      render: (_, row) => (
        <div className="flex items-center space-x-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleEditProduct(row);
            }}
            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-full transition-colors"
            title={t('common.edit')}
          >
            <Edit className="w-4 h-4" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleDeleteClick(row);
            }}
            className="p-1.5 text-red-600 hover:bg-red-50 rounded-full transition-colors"
            title={t('common.delete')}
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      )
    }
  ];

  const handleEditProduct = async (product) => {
    try {
      setLoading(true);
      setEditingProduct(product);
      setIsModalOpen(true);     
    } catch (error) {
      console.error('Error fetching product:', error);
      toast.error(t('toasts.dataLoadFailed'));
    } finally {
      setLoading(false);
    }
  };

  const handleAddProduct = () => {
    setEditingProduct(null);
    setIsModalOpen(true);
  };

  const fetchAllProductsForExport = async () => {
    const response = await productService.getProducts({
      searchTerm: filters.search || '',
      sortKey: 'product_name',
      sortDirection: 'ASC',
      page: 1,
      limit: 100000
    });

    if (!response.success || !response.data?.length) {
      return null;
    }

    return response.data;
  };

  const handleExportExcel = async () => {
    try {
      setExporting('excel');
      const products = await fetchAllProductsForExport();

      if (!products?.length) {
        toast.error(t('products.noProductsToExport'));
        return;
      }

      const exportData = buildPriceSheetRows(products, t);
      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, t('products.priceSheet'));

      const colWidths = Object.keys(exportData[0] || {}).map((key) => ({
        wch: Math.max(key.length + 2, 14)
      }));
      ws['!cols'] = colWidths;

      const dateStamp = format(new Date(), 'dd-MM-yyyy');
      XLSX.writeFile(wb, `Product_Price_Sheet_${dateStamp}.xlsx`);
      toast.success(t('products.priceSheetExported'));
    } catch (error) {
      console.error('Error exporting product price sheet to Excel:', error);
      toast.error(t('products.priceSheetExportFailed'));
    } finally {
      setExporting(null);
    }
  };

  const handleRowClick = (row) => {
    console.log('Row clicked:', row);
  };

  return (
    <div className="p-6 bg-gray-50">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{t('products.productList')}</h1>
              <p className="mt-1 text-sm text-gray-500">
                {t('homepage.manageInventory')}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={handleExportExcel}
                disabled={!!exporting}
                className="inline-flex items-center px-4 py-2.5 bg-white border border-gray-300 text-gray-700 text-sm font-medium rounded-lg shadow-sm hover:bg-gray-50 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {exporting === 'excel' ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <FileSpreadsheet className="w-4 h-4 mr-2 text-green-600" />
                )}
                {t('products.exportToExcel')}
              </button>
              <button
                onClick={() => navigate('/products/import')}
                className="inline-flex items-center px-4 py-2.5 bg-white border border-gray-300 text-gray-700 text-sm font-medium rounded-lg shadow-sm hover:bg-gray-50 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                <Upload className="w-4 h-4 mr-2" />
                {t('common.import')}
              </button>
              <button
                onClick={handleAddProduct}
                className="inline-flex items-center px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                <Plus className="w-4 h-4 mr-2" />
                {t('products.addProduct')}
              </button>
            </div>
          </div>
        </div>

        {/* DataTable */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <DataTable
            data={data}
            columns={columns}
            totalRecords={totalRecords}
            loading={loading}
            onFilterChange={(newFilters) => {
              fetchData({ ...filters, ...newFilters });
            }}
            initialFilters={filters}
            onRowClick={handleRowClick}
            searchable={true}
            sortable={true}
            pagination={true}
            currentPage={filters.page}
            emptyMessage={
              <div className="py-12 text-center">
                <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <div className="text-gray-400 mb-2">{t('common.noDataAvailable')}</div>
                <button
                  onClick={handleAddProduct}
                  className="text-blue-600 hover:text-blue-800 font-medium text-sm"
                >
                  {t('products.addProduct')}
                </button>
              </div>
            }
            searchPlaceholder={t('products.searchPlaceholder') || "Search products..."}
          />
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      <AlertModal
        isVisible={deleteModal.isOpen}
        modeltitle={t('common.delete') + ' ' + t('products.product')}
        message={`${t('common.confirmDelete')} "${deleteModal.product?.product_name || t('products.product')}"?`}
        onConfirm={handleConfirmDelete}
        onCancel={handleCancelDelete}
        loading={deleteModal.loading}
        buttonText={t('common.delete')}
      />

      {/* Add/Edit Product Modal */}
      <AddEditForm
        editMode={!!editingProduct}
        productModal={isModalOpen}
        setProductModal={setIsModalOpen}
        product={editingProduct}
        fetchData={fetchData}
      />
    </div>
  );
};

export default Index;