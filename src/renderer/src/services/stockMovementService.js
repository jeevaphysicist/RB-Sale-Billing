const { ipcRenderer } = window.electron;

export const stockMovementService = {
  getHistory: async (filterParams) => {
    try {
      const response = await window.api.invoke('stock-movement:get-history', filterParams);
      return response;
    } catch (error) {
      console.error('Error fetching stock history:', error);
      return { success: false, message: error.message };
    }
  },

  adjustStock: async (adjustmentData) => {
    try {
      const response = await window.api.invoke('product:adjust-stock', adjustmentData);
      return response;
    } catch (error) {
      console.error('Error adjusting stock:', error);
      return { success: false, message: error.message };
    }
  }
};
