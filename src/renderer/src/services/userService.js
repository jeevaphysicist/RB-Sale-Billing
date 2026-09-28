/**
 * API Service for User Management
 */

export const getUsers = async () => {
  try {
    const response = await window.api.invoke('user:get-all');
    if (response.success) {
      return {
        success: true,
        data: response.users
      };
    }
    throw new Error(response.message || 'Failed to fetch users');
  } catch (error) {
    console.error('Error fetching users:', error);
    throw error;
  }
};

export const getUserById = async (id) => {
  try {
    const response = await window.api.getUserById(id);
    if (response.success) {
      return response.user;
    }
    throw new Error(response.message || 'User not found');
  } catch (error) {
    console.error(`Error fetching user ${id}:`, error);
    throw error;
  }
};

export const createUser = async (userData) => {
  try {
    const response = await window.api.createUser(userData);
    if (response.success) {
      return response;
    }
    throw new Error(response.message || 'Failed to create user');
  } catch (error) {
    console.error('Error creating user:', error);
    throw error;
  }
};

export const updateUser = async (userData) => {
  try {
    const response = await window.api.updateUser(userData);
    if (response.success) {
      return response;
    }
    throw new Error(response.message || 'Failed to update user');
  } catch (error) {
    console.error('Error updating user:', error);
    throw error;
  }
};

export const deleteUser = async (id) => {
  try {
    // Assuming deleteUser is exposed as invoke('user:delete', id)
    // Checking preload/index.js, it seems deleteUser is not explicitly exposed as a function but invoke is available.
    // Wait, let me check preload again.
    // In preload: deleteUser is NOT explicitly exposed, but 'invoke' is.
    // Actually, let's check preload/index.js again.
    // It has: userLogin, createUser, updateUser, updateUserPassword, getUserById, resetUserPassword, getAppPassword...
    // It does NOT have deleteUser or getUsers explicitly.
    // So I should use window.api.invoke for those.
    
    const response = await window.api.invoke('user:delete', id);
    if (response.success) {
      return response;
    }
    throw new Error(response.message || 'Failed to delete user');
  } catch (error) {
    console.error('Error deleting user:', error);
    throw error;
  }
};

export const updateUserPassword = async (data) => {
  try {
    const response = await window.api.updateUserPassword(data);
    if (response.success) {
      return response;
    }
    throw new Error(response.message || 'Failed to update password');
  } catch (error) {
    console.error('Error updating password:', error);
    throw error;
  }
};

export const userService = {
  getUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
  updateUserPassword
};
