// Purchase Order Service
export const purchaseOrderService = {
  // Create a new purchase order
  create: async (orderData) => {
    try {
      const response = await window.api.createPurchaseOrder(orderData);
      return response;
    } catch (error) {
      console.error('Error creating purchase order:', error);
      return { success: false, message: 'Failed to create purchase order' };
    }
  },

  // Get all purchase orders with filters
  getAll: async (filterParams = {}) => {
    try {
      const response = await window.api.getPurchaseOrders(filterParams);
      return response;
    } catch (error) {
      console.error('Error fetching purchase orders:', error);
      return { success: false, message: 'Failed to fetch purchase orders', data: [] };
    }
  },

  // Get purchase order by ID
  getById: async (poId) => {
    try {
      const response = await window.api.getPurchaseOrderById(poId);
      return response;
    } catch (error) {
      console.error('Error fetching purchase order:', error);
      return { success: false, message: 'Failed to fetch purchase order' };
    }
  },

  // Update purchase order
  update: async (orderData) => {
    try {
      const response = await window.api.updatePurchaseOrder(orderData);
      return response;
    } catch (error) {
      console.error('Error updating purchase order:', error);
      return { success: false, message: 'Failed to update purchase order' };
    }
  },

  // Delete purchase order
  delete: async (poId) => {
    try {
      const response = await window.api.deletePurchaseOrder(poId);
      return response;
    } catch (error) {
      console.error('Error deleting purchase order:', error);
      return { success: false, message: 'Failed to delete purchase order' };
    }
  },

  // Get next PO number
  getNextPONumber: async () => {
    try {
      const response = await window.api.getNextPONumber();
      return response;
    } catch (error) {
      console.error('Error fetching next PO number:', error);
      return { success: false, message: 'Failed to fetch next PO number' };
    }
  }
};

export default purchaseOrderService;
