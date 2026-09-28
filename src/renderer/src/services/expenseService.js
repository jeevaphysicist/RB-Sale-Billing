/**
 * API Service for Expense Management
 * Centralized service for all expense-related API calls
 */

/**
 * Get all expenses with optional filters and pagination
 * @param {Object} filters - Filter, sort, and pagination options
 * @param {string} [filters.searchTerm] - Search term for expense name or description
 * @param {string} [filters.sortKey=name] - Field to sort by
 * @param {string} [filters.sortDirection=ASC] - Sort direction (ASC or DESC)
 * @param {number} [filters.page=1] - Page number for pagination
 * @param {number} [filters.limit=10] - Number of items per page
 * @returns {Promise<Object>} - Object containing expenses and pagination info
 */
export const getExpenses = async (filters = {}) => {
  try {
    const response = await window.api.getExpenses(filters);
    if (response.success) {  
      const expenses = response.data.map((expense, index) => ({
        ...expense,
        sno: index + 1
      }));          
      // Return the paginated response with expenses and metadata
      return {
        success: true,
        data: expenses,
        total: response.total,
        page: response.page,
        limit: response.limit
      };
    }
    throw new Error(response.message || 'Failed to fetch expenses');
  } catch (error) {
    console.error('Error fetching expenses:', error);
    throw error;
  }
};

/**
 * Get a single expense by ID
 * @param {number|string} id - Expense ID
 * @returns {Promise<Object>} - Expense data
 */
export const getExpenseById = async (id) => {
  try {
    const response = await window.api.getExpenseById(id);
    if (response.success) {
      return response.expense;
    }
    throw new Error(response.message || 'Expense not found');
  } catch (error) {
    console.error(`Error fetching expense ${id}:`, error);
    throw error;
  }
};

/**
 * Create a new expense
 * @param {Object} expenseData - Expense data
 * @param {string} expenseData.name - Expense name
 * @param {string} [expenseData.description] - Expense description
 * @param {string} [expenseData.status=active] - Expense status
 * @returns {Promise<Object>} - Created expense data
 */
export const createExpense = async (expenseData) => {
  try {
    const response = await window.api.createExpense(expenseData);
    if (response.success) {
      return response;
    }
    throw new Error(response.message || 'Failed to create expense');
  } catch (error) {
    console.error('Error creating expense:', error);
    throw error;
  }
};

/**
 * Update an existing expense
 * @param {number|string} id - Expense ID
 * @param {Object} updates - Expense updates
 * @param {string} [updates.name] - Updated name
 * @param {string} [updates.description] - Updated description
 * @param {string} [updates.status] - Updated status
 * @returns {Promise<Object>} - Updated expense data
 */
export const updateExpense = async (id, updates) => {
  try {
    const response = await window.api.updateExpense({ id, ...updates });
    if (response.success) {
      return response;
    }
    throw new Error(response.message || 'Failed to update expense');
  } catch (error) {
    console.error(`Error updating expense ${id}:`, error);
    throw error;
  }
};

/**
 * Delete an expense
 * @param {number|string} id - Expense ID
 * @returns {Promise<Object>} - Response with success status and message
 */
export const deleteExpense = async (id) => {
  try {
    const response = await window.api.deleteExpense(id);
    if (response.success) {
      return {
        success: true,
        message: response.message || 'Expense deleted successfully'
      };
    }
    throw new Error(response.message || 'Failed to delete expense');
  } catch (error) {
    console.error(`Error deleting expense ${id}:`, error);
    return {
      success: false,
      message: error.message || 'Failed to delete expense'
    };
  }
};

// Export all expense service functions as a single object
export const expenseService = {
  getExpenses,
  getExpenseById,
  createExpense,
  updateExpense,
  deleteExpense
};

export default expenseService;
