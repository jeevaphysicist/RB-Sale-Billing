/**
 * Supplier Service
 * Centralized service for all supplier-related API calls
 */

/**
 * Get all suppliers with optional filters and pagination
 * @param {Object} filters - Filter, sort, and pagination options
 * @param {string} [filters.searchTerm] - Search term for supplier name, code, or contact
 * @param {string} [filters.sortKey=id] - Field to sort by
 * @param {string} [filters.sortDirection=DESC] - Sort direction (ASC or DESC)
 * @param {number} [filters.page=1] - Page number for pagination
 * @param {number} [filters.limit=10] - Number of items per page
 * @returns {Promise<Object>} - Object containing suppliers and pagination info
 */
export const getSuppliers = async (filters = {}) => {
  try {
    const response = await window.api.getSuppliers(filters);
    if (response.success) {  
      const suppliers = response.data.map((supplier, index) => ({
        ...supplier,
        sno: (filters.page - 1) * filters.limit + index + 1
      }));          
      return {
        success: true,
        data: suppliers,
        total: response.total,
        page: response.page,
        limit: response.limit
      };
    }
    throw new Error(response.message || 'Failed to fetch suppliers');
  } catch (error) {
    console.error('Error fetching suppliers:', error);
    throw error;
  }
};

/**
 * Get a single supplier by ID
 * @param {number|string} id - Supplier ID
 * @returns {Promise<Object>} - Supplier data
 */
export const getSupplierById = async (id) => {
  try {
    const response = await window.api.getSupplierById(id);
    if (response.success) {
      return response.supplier;
    }
    throw new Error(response.message || 'Supplier not found');
  } catch (error) {
    console.error(`Error fetching supplier ${id}:`, error);
    throw error;
  }
};

/**
 * Create a new supplier
 * @param {Object} supplierData - Supplier data
 * @returns {Promise<Object>} - Created supplier data
 */
export const createSupplier = async (supplierData) => {
  try {
    const response = await window.api.createSupplier(supplierData);
    if (response.success) {
      return response;
    }
    throw new Error(response.message || 'Failed to create supplier');
  } catch (error) {
    console.error('Error creating supplier:', error);
    throw error;
  }
};

/**
 * Update an existing supplier
 * @param {number|string} id - Supplier ID
 * @param {Object} updates - Supplier updates
 * @returns {Promise<Object>} - Updated supplier data
 */
export const updateSupplier = async (id, updates) => {
  try {
    const response = await window.api.updateSupplier({ id, ...updates });
    if (response.success) {
      return response;
    }
    throw new Error(response.message || 'Failed to update supplier');
  } catch (error) {
    console.error(`Error updating supplier ${id}:`, error);
    throw error;
  }
};

/**
 * Delete a supplier
 * @param {number|string} id - Supplier ID
 * @returns {Promise<Object>} - Response with success status and message
 */
export const deleteSupplier = async (id) => {
  try {
    const response = await window.api.deleteSupplier(id);
    if (response.success) {
      return {
        success: true,
        message: response.message || 'Supplier deleted successfully'
      };
    }
    throw new Error(response.message || 'Failed to delete supplier');
  } catch (error) {
    console.error(`Error deleting supplier ${id}:`, error);
    return {
      success: false,
      message: error.message || 'Failed to delete supplier'
    };
  }
};

/**
 * Import multiple suppliers from CSV
 * @param {Array} suppliers - Array of supplier data
 * @returns {Promise<Object>} - Import results with counts and errors
 */
export const importSuppliers = async (suppliers) => {
  try {
    const response = await window.api.importSuppliers(suppliers);
    if (response.success) {
      return response;
    }
    throw new Error(response.message || 'Failed to import suppliers');
  } catch (error) {
    console.error('Error importing suppliers:', error);
    throw error;
  }
};

// Export all supplier service functions as a single object
export const supplierService = {
  getSuppliers,
  getSupplierById,
  createSupplier,
  updateSupplier,
  deleteSupplier,
  importSuppliers
};

export default supplierService;
