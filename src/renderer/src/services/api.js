/**
 * API Service for Category Management
 * Centralized service for all category-related API calls
 */

/**
 * Get all categories with optional filters and pagination
 * @param {Object} filters - Filter, sort, and pagination options
 * @param {string} [filters.searchTerm] - Search term for category name or description
 * @param {string} [filters.sortKey=name] - Field to sort by
 * @param {string} [filters.sortDirection=ASC] - Sort direction (ASC or DESC)
 * @param {number} [filters.page=1] - Page number for pagination
 * @param {number} [filters.limit=10] - Number of items per page
 * @returns {Promise<Object>} - Object containing categories and pagination info
 */
export const getCategories = async (filters = {}) => {
  try {
    const response = await window.api.getCategories(filters);
    if (response.success) {  
      const categories = response.data.map((category, index) => ({
        ...category,
        sno: index + 1
      }));          
      // Return the paginated response with categories and metadata
      return {
        success: true,
        data: categories,
        total: response.total,
        page: response.page,
        limit: response.limit
      };
    }
    throw new Error(response.message || 'Failed to fetch categories');
  } catch (error) {
    console.error('Error fetching categories:', error);
    throw error;
  }
};

/**
 * Get a single category by ID
 * @param {number|string} id - Category ID
 * @returns {Promise<Object>} - Category data
 */
export const getCategoryById = async (id) => {
  try {
    const response = await window.api.getCategoryById(id);
    if (response.success) {
      return response.category;
    }
    throw new Error(response.message || 'Category not found');
  } catch (error) {
    console.error(`Error fetching category ${id}:`, error);
    throw error;
  }
};

/**
 * Create a new category
 * @param {Object} categoryData - Category data
 * @param {string} categoryData.name - Category name
 * @param {string} [categoryData.description] - Category description
 * @param {string} [categoryData.status=active] - Category status
 * @returns {Promise<Object>} - Created category data
 */
export const createCategory = async (categoryData) => {
  try {
    const response = await window.api.createCategory(categoryData);
    if (response.success) {
      return response;
    }
    throw new Error(response.message || 'Failed to create category');
  } catch (error) {
    console.error('Error creating category:', error);
    throw error;
  }
};

/**
 * Update an existing category
 * @param {number|string} id - Category ID
 * @param {Object} updates - Category updates
 * @param {string} [updates.name] - Updated name
 * @param {string} [updates.description] - Updated description
 * @param {string} [updates.status] - Updated status
 * @returns {Promise<Object>} - Updated category data
 */
export const updateCategory = async (id, updates) => {
  try {
    const response = await window.api.updateCategory({ id, ...updates });
    if (response.success) {
      return response;
    }
    throw new Error(response.message || 'Failed to update category');
  } catch (error) {
    console.error(`Error updating category ${id}:`, error);
    throw error;
  }
};

/**
 * Delete a category
 * @param {number|string} id - Category ID
 * @returns {Promise<Object>} - Response with success status and message
 */
export const deleteCategory = async (id) => {
  try {
    const response = await window.api.deleteCategory(id);
    if (response.success) {
      return {
        success: true,
        message: response.message || 'Category deleted successfully'
      };
    }
    throw new Error(response.message || 'Failed to delete category');
  } catch (error) {
    console.error(`Error deleting category ${id}:`, error);
    return {
      success: false,
      message: error.message || 'Failed to delete category'
    };
  }
};

// Export all category service functions as a single object
export const categoryService = {
  getCategories,
  getCategoryById,
  createCategory,
  updateCategory,
  deleteCategory
};

// Import and re-export supplier, customer, and expense services
export { supplierService } from './supplierService';
export { customerService } from './customerService';
export { expenseService, getExpenses, getExpenseById, createExpense, updateExpense, deleteExpense } from './expenseService';
export { expenseRecordService, getExpenseRecords, getExpenseRecordById, createExpenseRecord, updateExpenseRecord, deleteExpenseRecord, getNextExpenseNumber } from './expenseRecordService';
export { productService } from './productService';
export { userService } from './userService';

export default categoryService;
