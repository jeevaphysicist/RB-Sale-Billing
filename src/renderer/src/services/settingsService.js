export const settingsService = {
  getStoreDetails: async () => {
    try {
      const response = await window.api.invoke('settings:get-store-details');
      return response;
    } catch (error) {
      console.error('Error fetching store details:', error);
      return { success: false, message: 'Failed to fetch store details' };
    }
  },

  updateStoreDetails: async (details) => {
    try {
      const response = await window.api.invoke('settings:update-store-details', details);
      return response;
    } catch (error) {
      console.error('Error updating store details:', error);
      return { success: false, message: 'Failed to update store details' };
    }
  }
};

export default settingsService;
