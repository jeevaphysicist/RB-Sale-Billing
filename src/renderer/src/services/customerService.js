/**
 * Customer Service
 * Centralized service for all customer-related API calls
 */

/**
 * Get all customers with optional filters and pagination
 * @param {Object} filters - Filter, sort, and pagination options
 * @returns {Promise<Object>} - Object containing customers and pagination info
 */
export const getCustomers = async (filters = {}) => {
  try {
    const response = await window.api.getCustomers(filters);
    if (response.success) {  
      const customers = response.data.map((customer, index) => ({
        ...customer,
        sno: (filters.page - 1) * filters.limit + index + 1
      }));          
      return {
        success: true,
        data: customers,
        total: response.total,
        page: response.page,
        limit: response.limit
      };
    }
    throw new Error(response.message || 'Failed to fetch customers');
  } catch (error) {
    console.error('Error fetching customers:', error);
    throw error;
  }
};

/**
 * Get a single customer by ID
 * @param {number|string} id - Customer ID
 * @returns {Promise<Object>} - Customer data
 */
export const getCustomerById = async (id) => {
  try {
    const response = await window.api.getCustomerById(id);
    if (response.success) {
      return response.customer;
    }
    throw new Error(response.message || 'Customer not found');
  } catch (error) {
    console.error(`Error fetching customer ${id}:`, error);
    throw error;
  }
};

/**
 * Create a new customer
 * @param {Object} customerData - Customer data
 * @returns {Promise<Object>} - Created customer data
 */
export const createCustomer = async (customerData) => {
  try {
    const response = await window.api.createCustomer(customerData);
    if (response.success) {
      return response;
    }
    throw new Error(response.message || 'Failed to create customer');
  } catch (error) {
    console.error('Error creating customer:', error);
    // Ensure the error message is properly propagated
    throw new Error(error.message || 'Failed to create customer');
  }
};

/**
 * Update an existing customer
 * @param {number|string} id - Customer ID
 * @param {Object} updates - Customer updates
 * @returns {Promise<Object>} - Updated customer data
 */
export const updateCustomer = async (id, updates) => {
  try {
    const response = await window.api.updateCustomer({ id, ...updates });
    if (response.success) {
      return response;
    }
    throw new Error(response.message || 'Failed to update customer');
  } catch (error) {
    console.error(`Error updating customer ${id}:`, error);
    // Ensure the error message is properly propagated
    throw new Error(error.message || 'Failed to update customer');
  }
};

/**
 * Delete a customer
 * @param {number|string} id - Customer ID
 * @returns {Promise<Object>} - Response with success status and message
 */
export const deleteCustomer = async (id) => {
  try {
    const response = await window.api.deleteCustomer(id);
    if (response.success) {
      return {
        success: true,
        message: response.message || 'Customer deleted successfully'
      };
    }
    throw new Error(response.message || 'Failed to delete customer');
  } catch (error) {
    console.error(`Error deleting customer ${id}:`, error);
    return {
      success: false,
      message: error.message || 'Failed to delete customer'
    };
  }
};

/**
 * Import customers in bulk
 * @param {Array} customers - Array of customer objects
 * @returns {Promise<Object>} - Import response
 */
export const importCustomers = async (customers) => {
  try {
    const response = await window.api.importCustomers(customers);
    if (response.success) {
      return response;
    }
    throw new Error(response.message || 'Failed to import customers');
  } catch (error) {
    console.error('Error importing customers:', error);
    throw error;
  }
};

// Export all customer service functions as a single object
export const customerService = {
  getCustomers,
  getCustomerById,
  createCustomer,
  updateCustomer,
  deleteCustomer,
  importCustomers
};

export default customerService;
