// Sales Order Service
export const salesOrderService = {
  // Create a new sales order
  create: async (orderData) => {
    try {
      const response = await window.api.createSalesOrder(orderData);
      return response;
    } catch (error) {
      console.error('Error creating sales order:', error);
      return { success: false, message: 'Failed to create sales order' };
    }
  },

  // Get all sales orders with filters
  getAll: async (filterParams = {}) => {
    try {
      const response = await window.api.getSalesOrders(filterParams);
      return response;
    } catch (error) {
      console.error('Error fetching sales orders:', error);
      return { success: false, message: 'Failed to fetch sales orders', data: [] };
    }
  },

  // Get sales order by ID
  getById: async (orderId) => {
    try {
      const response = await window.api.getSalesOrderById(orderId);
      return response;
    } catch (error) {
      console.error('Error fetching sales order:', error);
      return { success: false, message: 'Failed to fetch sales order' };
    }
  },

  // Update sales order
  update: async (orderData) => {
    try {
      const response = await window.api.updateSalesOrder(orderData);
      return response;
    } catch (error) {
      console.error('Error updating sales order:', error);
      return { success: false, message: 'Failed to update sales order' };
    }
  },

  // Delete sales order
  delete: async (orderId) => {
    try {
      return await window.api.deleteSalesOrder(orderId);
    } catch (error) {
      console.error('Error deleting sales order:', error);
      return { success: false, message: error.message };
    }
  },

  // Cancel sales order
  cancel: async (orderId) => {
    try {
      const response = await window.api.cancelSalesOrder(orderId);
      return response;
    } catch (error) {
      console.error('Error cancelling sales order:', error);
      return { success: false, message: 'Failed to cancel sales order' };
    }
  },

  // Return sales order
  returnOrder: async (orderId) => {
    try {
      const response = await window.api.returnSalesOrder(orderId);
      return response;
    } catch (error) {
      console.error('Error returning sales order:', error);
      return { success: false, message: 'Failed to return sales order' };
    }
  },

  generatePDF: async (orderDataOrId, templateType) => {
    try {
      // Check if the first argument is an ID (string or number) or an object
      const payload = typeof orderDataOrId === 'object' 
        ? { orderData: orderDataOrId, templateType }
        : { orderId: orderDataOrId, templateType };
        
      return await window.api.generateInvoicePDF(payload.orderData, payload.templateType, payload.orderId);
    } catch (error) {
      console.error('Error generating PDF:', error);
      return { success: false, message: error.message };
    }
  },

  // Get sales order summary with payment info
  getSOSummary: async (filterParams = {}) => {
    try {
      const response = await window.api.getSOSummary(filterParams);
      return response;
    } catch (error) {
      console.error('Error fetching sales order summary:', error);
      return { success: false, message: 'Failed to fetch sales order summary', data: [] };
    }
  },

  // Get next order number
  getNextOrderNumber: async () => {
    try {
      const response = await window.api.getNextOrderNumber();
      return response;
    } catch (error) {
      console.error('Error fetching next order number:', error);
      return { success: false, message: 'Failed to fetch next order number' };
    }
  }
};

export default salesOrderService;
