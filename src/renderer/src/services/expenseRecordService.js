/**
 * API Service for Expense Record Management
 * Centralized service for all expense record-related API calls
 */

/**
 * Get all expense records with optional filters and pagination
 * @param {Object} filters - Filter, sort, and pagination options
 * @param {string} [filters.searchTerm] - Search term
 * @param {string} [filters.startDate] - Filter by start date
 * @param {string} [filters.endDate] - Filter by end date
 * @param {number} [filters.categoryId] - Filter by category
 * @param {string} [filters.sortKey=expense_date] - Field to sort by
 * @param {string} [filters.sortDirection=DESC] - Sort direction
 * @param {number} [filters.page=1] - Page number
 * @param {number} [filters.limit=10] - Number of items per page
 * @returns {Promise<Object>} - Object containing expense records and pagination info
 */
export const getExpenseRecords = async (filters = {}) => {
  try {
    const response = await window.api.invoke('expense-record:get-all', filters);
    if (response.success) {
      const expenses = response.data.map((expense, index) => ({
        ...expense,
        sno: (response.page - 1) * response.limit + index + 1
      }));
      return {
        success: true,
        data: expenses,
        total: response.total,
        page: response.page,
        limit: response.limit
      };
    }
    throw new Error(response.message || 'Failed to fetch expense records');
  } catch (error) {
    console.error('Error fetching expense records:', error);
    throw error;
  }
};

/**
 * Get a single expense record by ID
 * @param {number|string} id - Expense Record ID
 * @returns {Promise<Object>} - Expense record data
 */
export const getExpenseRecordById = async (id) => {
  try {
    const response = await window.api.invoke('expense-record:get-by-id', id);
    if (response.success) {
      return response.data;
    }
    throw new Error(response.message || 'Expense record not found');
  } catch (error) {
    console.error(`Error fetching expense record ${id}:`, error);
    throw error;
  }
};

/**
 * Create a new expense record
 * @param {Object} expenseData - Expense record data
 * @returns {Promise<Object>} - Created expense record data
 */
export const createExpenseRecord = async (expenseData) => {
  try {
    const response = await window.api.invoke('expense-record:create', expenseData);
    if (response.success) {
      return response;
    }
    throw new Error(response.message || 'Failed to create expense record');
  } catch (error) {
    console.error('Error creating expense record:', error);
    throw error;
  }
};

/**
 * Update an existing expense record
 * @param {number|string} id - Expense Record ID
 * @param {Object} updates - Expense record updates
 * @returns {Promise<Object>} - Updated expense record data
 */
export const updateExpenseRecord = async (id, updates) => {
  try {
    const response = await window.api.invoke('expense-record:update', { id, ...updates });
    if (response.success) {
      return response;
    }
    throw new Error(response.message || 'Failed to update expense record');
  } catch (error) {
    console.error(`Error updating expense record ${id}:`, error);
    throw error;
  }
};

/**
 * Delete an expense record
 * @param {number|string} id - Expense Record ID
 * @returns {Promise<Object>} - Response with success status and message
 */
export const deleteExpenseRecord = async (id) => {
  try {
    const response = await window.api.invoke('expense-record:delete', id);
    if (response.success) {
      return {
        success: true,
        message: response.message || 'Expense record deleted successfully'
      };
    }
    throw new Error(response.message || 'Failed to delete expense record');
  } catch (error) {
    console.error(`Error deleting expense record ${id}:`, error);
    return {
      success: false,
      message: error.message || 'Failed to delete expense record'
    };
  }
};

/**
 * Get the next expense number
 * @returns {Promise<Object>} - Response with next expense number
 */
export const getNextExpenseNumber = async () => {
  try {
    const response = await window.api.invoke('expense-record:get-next-number');
    if (response.success) {
      return response;
    }
    throw new Error(response.message || 'Failed to get next expense number');
  } catch (error) {
    console.error('Error getting next expense number:', error);
    throw error;
  }
};

export const expenseRecordService = {
  getExpenseRecords,
  getExpenseRecordById,
  createExpenseRecord,
  updateExpenseRecord,
  deleteExpenseRecord,
  getNextExpenseNumber
};

export default expenseRecordService;
