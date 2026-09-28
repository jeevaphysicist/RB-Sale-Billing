/**
 * Payment Record Service
 * Centralized service for all payment record-related API calls
 */

/**
 * Get all payment records with optional filters and pagination
 * @param {Object} filters - Filter, sort, and pagination options
 * @returns {Promise<Object>} - Object containing payment records and pagination info
 */
export const getPaymentRecords = async (filters = {}) => {
  try {
    const response = await window.api.getPaymentRecords(filters);
    if (response.success) {
      const records = response.data.map((record, index) => ({
        ...record,
        sno: (filters.page - 1) * filters.limit + index + 1
      }));
      return {
        success: true,
        data: records,
        total: response.total,
        page: response.page,
        limit: response.limit
      };
    }
    throw new Error(response.message || 'Failed to fetch payment records');
  } catch (error) {
    console.error('Error fetching payment records:', error);
    throw error;
  }
};

/**
 * Get a single payment record by ID
 * @param {number|string} id - Payment Record ID
 * @returns {Promise<Object>} - Payment record data
 */
export const getPaymentRecordById = async (id) => {
  try {
    const response = await window.api.getPaymentRecordById(id);
    if (response.success) {
      return response.data;
    }
    throw new Error(response.message || 'Payment record not found');
  } catch (error) {
    console.error(`Error fetching payment record ${id}:`, error);
    throw error;
  }
};

/**
 * Get payment records for a sales order
 * @param {Object} params - { recordType: 'sales', referenceId }
 * @returns {Promise<Object>} - Payment records for the sales order
 */
export const getPaymentRecordsByPO = async (params) => {
  try {
    const response = await window.api.getPaymentRecordsByPO(params);
    if (response.success) {
      return response.data;
    }
    throw new Error(response.message || 'Failed to fetch payment records');
  } catch (error) {
    console.error(`Error fetching payment records for order:`, error);
    throw error;
  }
};

/**
 * Create a new payment record
 * @param {Object} paymentData - Payment record data
 * @returns {Promise<Object>} - Created payment record data
 */
export const createPaymentRecord = async (paymentData) => {
  try {
    const response = await window.api.createPaymentRecord(paymentData);
    if (response.success) {
      return response;
    }
    throw new Error(response.message || 'Failed to create payment record');
  } catch (error) {
    console.error('Error creating payment record:', error);
    throw error;
  }
};

/**
 * Update an existing payment record
 * @param {number|string} id - Payment Record ID
 * @param {Object} updates - Payment record updates
 * @returns {Promise<Object>} - Updated payment record data
 */
export const updatePaymentRecord = async (id, updates) => {
  try {
    const response = await window.api.updatePaymentRecord({ id, ...updates });
    if (response.success) {
      return response;
    }
    throw new Error(response.message || 'Failed to update payment record');
  } catch (error) {
    console.error(`Error updating payment record ${id}:`, error);
    throw error;
  }
};

/**
 * Delete a payment record
 * @param {number|string} id - Payment Record ID
 * @returns {Promise<Object>} - Response with success status and message
 */
export const deletePaymentRecord = async (id) => {
  try {
    const response = await window.api.deletePaymentRecord(id);
    if (response.success) {
      return {
        success: true,
        message: response.message || 'Payment record deleted successfully'
      };
    }
    throw new Error(response.message || 'Failed to delete payment record');
  } catch (error) {
    console.error(`Error deleting payment record ${id}:`, error);
    return {
      success: false,
      message: error.message || 'Failed to delete payment record'
    };
  }
};

// Export all payment record service functions as a single object
export const paymentRecordService = {
  getPaymentRecords,
  getPaymentRecordById,
  getPaymentRecordsByPO,
  createPaymentRecord,
  updatePaymentRecord,
  deletePaymentRecord
};

export default paymentRecordService;
