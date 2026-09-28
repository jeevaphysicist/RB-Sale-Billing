// Payment Service for Purchase Orders
export const paymentService = {
  // Get all payment records for a purchase order
  getPaymentsByPOId: async (poId) => {
    try {
      const response = await window.api.getPaymentsByPOId(poId);
      return response;
    } catch (error) {
      console.error('Error fetching payment records:', error);
      return { success: false, message: 'Failed to fetch payment records', data: [] };
    }
  },

  // Create a new payment record
  createPayment: async (paymentData) => {
    try {
      const response = await window.api.createPayment(paymentData);
      return response;
    } catch (error) {
      console.error('Error creating payment record:', error);
      return { success: false, message: 'Failed to create payment record' };
    }
  },

  // Update payment record
  updatePayment: async (paymentData) => {
    try {
      const response = await window.api.updatePayment(paymentData);
      return response;
    } catch (error) {
      console.error('Error updating payment record:', error);
      return { success: false, message: 'Failed to update payment record' };
    }
  },

  // Delete payment record
  deletePayment: async (paymentId) => {
    try {
      const response = await window.api.deletePayment(paymentId);
      return response;
    } catch (error) {
      console.error('Error deleting payment record:', error);
      return { success: false, message: 'Failed to delete payment record' };
    }
  }
};

export default paymentService;
