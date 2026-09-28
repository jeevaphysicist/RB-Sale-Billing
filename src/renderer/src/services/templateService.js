const templateService = {
  // Get template settings for a document type (sales_order)
  getSettings: async (documentType) => {
    try {
      return await window.api.invoke('template:get-settings', documentType);
    } catch (error) {
      console.error('Error fetching template settings:', error);
      return { success: false, message: error.message };
    }
  },

  // Save template settings
  saveSettings: async (settings) => {
    try {
      return await window.api.invoke('template:save-settings', settings);
    } catch (error) {
      console.error('Error saving template settings:', error);
      return { success: false, message: error.message };
    }
  },

  // Reset template settings to default
  resetSettings: async (documentType) => {
    try {
      return await window.api.invoke('template:reset-settings', documentType);
    } catch (error) {
      console.error('Error resetting template settings:', error);
      return { success: false, message: error.message };
    }
  },

  // Generate a preview PDF (does not save settings)
  generatePreview: async (data, templateName, config) => {
    try {
      return await window.api.invoke('template:generate-preview', { data, templateName, config });
    } catch (error) {
      console.error('Error generating preview:', error);
      return { success: false, message: error.message };
    }
  }
};

export default templateService;
