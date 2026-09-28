/**
 * Brand Service Functions
 * Centralized service for all brand-related API calls
 */

/**
 * Get all brands with optional filters and pagination
 * @param {Object} filters - Filter, sort, and pagination options
 * @param {string} [filters.searchTerm] - Search term for brand name or description
 * @param {string} [filters.sortKey=name] - Field to sort by
 * @param {string} [filters.sortDirection=ASC] - Sort direction (ASC or DESC)
 * @param {number} [filters.page=1] - Page number for pagination
 * @param {number} [filters.limit=10] - Number of items per page
 * @returns {Promise<Object>} - Object containing brands and pagination info
 */
export const getBrands = async (filters = {}) => {
  try {
    const response = await window.api.getBrands(filters);
    if (response.success) {
      const brands = response.brands.map((brand, index) => ({
        ...brand,
        sno: (response.page - 1) * response.limit + index + 1,
      }));

      return {
        success: true,
        data: brands,
        total: response.totalCount,
        page: response.page,
        limit: response.limit,
      };
    }
    throw new Error(response.message || 'Failed to fetch brands');
  } catch (error) {
    console.error('Error fetching brands:', error);
    throw error;
  }
};

/**
 * Get a single brand by ID
 * @param {number|string} id - Brand ID
 * @returns {Promise<Object>} - Brand data
 */
export const getBrandById = async (id) => {
  try {
    const response = await window.api.getBrandById(id);
    if (response.success) {
      return response.brand;
    }
    throw new Error(response.message || 'Brand not found');
  } catch (error) {
    console.error(`Error fetching brand with ID ${id}:`, error);
    throw error;
  }
};

/**
 * Create a new brand
 * @param {Object} brandData - Brand data
 * @param {string} brandData.name - Brand name
 * @param {string} [brandData.description] - Brand description
 * @param {string} [brandData.website] - Brand website URL
 * @param {string} [brandData.status=active] - Brand status
 * @returns {Promise<Object>} - Created brand data
 */
export const createBrand = async (brandData) => {
  try {
    const response = await window.api.createBrand(brandData);
    if (response.success) {
      return response;
    }
    throw new Error(response.message || 'Failed to create brand');
  } catch (error) {
    console.error('Error creating brand:', error);
    throw error;
  }
};

/**
 * Update an existing brand
 * @param {number|string} id - Brand ID
 * @param {Object} updates - Brand updates
 * @param {string} [updates.name] - Updated name
 * @param {string} [updates.description] - Updated description
 * @param {string} [updates.website] - Updated website URL
 * @param {string} [updates.status] - Updated status
 * @returns {Promise<Object>} - Updated brand data
 */
export const updateBrand = async (id, updates) => {
  try {
    const response = await window.api.updateBrand({ id, ...updates });
    if (response.success) {
      return response;
    }
    throw new Error(response.message || 'Failed to update brand');
  } catch (error) {
    console.error(`Error updating brand with ID ${id}:`, error);
    throw error;
  }
};

/**
 * Delete a brand
 * @param {number|string} id - Brand ID
 * @returns {Promise<Object>} - Response with success status and message
 */
export const deleteBrand = async (id) => {
  try {
    const response = await window.api.deleteBrand(id);
    if (response.success) {
      return response;
    }
    throw new Error(response.message || 'Failed to delete brand');
  } catch (error) {
    console.error(`Error deleting brand with ID ${id}:`, error);
    throw error;
  }
};

// Export all brand service functions as a single object
export const brandService = {
  getBrands,
  getBrandById,
  createBrand,
  updateBrand,
  deleteBrand,
};

export default brandService;
