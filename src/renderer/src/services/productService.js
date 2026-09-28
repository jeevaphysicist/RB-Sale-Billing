/**
 * API Service for Product Management
 * Centralized service for all product-related API calls
 */

/**
 * Get all products with optional filters and pagination
 * @param {Object} filters - Filter, sort, and pagination options
 * @param {string} [filters.searchTerm] - Search term for product name, code, barcode, etc.
 * @param {string} [filters.sortKey=id] - Field to sort by
 * @param {string} [filters.sortDirection=DESC] - Sort direction (ASC or DESC)
 * @param {number} [filters.page=1] - Page number for pagination
 * @param {number} [filters.limit=10] - Number of items per page
 * @returns {Promise<Object>} - Object containing products and pagination info
 */
export const getProducts = async (filters = {}) => {
  try {
    console.log('Calling window.api.getProducts with filters:', filters);
    const response = await window.api.getProducts(filters);
    console.log('Product API response:', response);
    
    if (response && response.success) {
      const products = response.data.map((product, index) => ({
        ...product,
        sno: ((filters.page || 1) - 1) * (filters.limit || 10) + index + 1
      }));
      return {
        success: true,
        data: products,
        total: response.total,
        page: response.page,
        limit: response.limit
      };
    }
    throw new Error(response?.message || 'Failed to fetch products');
  } catch (error) {
    console.error('Error fetching products:', error);
    console.error('Error details:', error.message);
    throw error;
  }
};

/**
 * Get a single product by ID
 * @param {number|string} id - Product ID
 * @returns {Promise<Object>} - Product data
 */
export const getProductById = async (id) => {
  try {
    const response = await window.api.getProductById(id);
    if (response.success) {
      return response.data;
    }
    throw new Error(response.message || 'Product not found');
  } catch (error) {
    console.error('Error fetching product:', error);
    throw error;
  }
};

/**
 * Create a new product
 * @param {Object} productData - Product information
 * @returns {Promise<Object>} - Created product response
 */
export const createProduct = async (productData) => {
  try {
    const response = await window.api.createProduct(productData);
    if (response.success) {
      return response;
    }
    throw new Error(response.message || 'Failed to create product');
  } catch (error) {
    console.error('Error creating product:', error);
    throw error;
  }
};

/**
 * Update an existing product
 * @param {number|string} id - Product ID
 * @param {Object} productData - Updated product information
 * @returns {Promise<Object>} - Update response
 */
export const updateProduct = async (id, productData) => {
  try {
    const response = await window.api.updateProduct({ ...productData, id });
    if (response.success) {
      return response;
    }
    throw new Error(response.message || 'Failed to update product');
  } catch (error) {
    console.error('Error updating product:', error);
    throw error;
  }
};

/**
 * Delete a product
 * @param {number|string} id - Product ID
 * @returns {Promise<Object>} - Delete response
 */
export const deleteProduct = async (id) => {
  try {
    const response = await window.api.deleteProduct(id);
    if (response.success) {
      return response;
    }
    throw new Error(response.message || 'Failed to delete product');
  } catch (error) {
    console.error('Error deleting product:', error);
    throw error;
  }
};

/**
 * Import products in bulk
 * @param {Array} products - Array of product objects
 * @returns {Promise<Object>} - Import response
 */
export const importProducts = async (products) => {
  try {
    const response = await window.api.importProducts(products);
    if (response.success) {
      return response;
    }
    throw new Error(response.message || 'Failed to import products');
  } catch (error) {
    console.error('Error importing products:', error);
    throw error;
  }
};

/**
 * Export product price sheet as PDF (human-readable values)
 * @param {Object} payload - { rows, title, generatedAt }
 */
export const exportProductPriceSheetPdf = async (payload) => {
  try {
    const response = await window.api.exportProductPriceSheetPdf(payload);
    if (response?.canceled) {
      return { success: false, canceled: true };
    }
    if (response?.success) {
      return response;
    }
    throw new Error(response?.message || 'Failed to export PDF');
  } catch (error) {
    console.error('Error exporting product price sheet PDF:', error);
    throw error;
  }
};

export const productService = {
  getProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
  importProducts,
  exportProductPriceSheetPdf
};
