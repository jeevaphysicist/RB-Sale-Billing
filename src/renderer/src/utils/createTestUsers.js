/**
 * Helper Script to Create Admin User
 * 
 * This script creates an admin user in the database for testing authentication.
 * Username: admin
 * Password: admin123
 * 
 * Run this from the renderer console or create a temporary route to execute it.
 */

const createAdminUser = async () => {
  const userData = {
    username: 'admin',
    email: 'admin@rabtoise.com',
    password: 'admin123',
    role: 'admin',
    account_status: 'active'
  };

  try {
    const result = await window.api.createUser(userData);
    console.log('Admin user created:', result);
    return result;
  } catch (error) {
    console.error('Error creating admin user:', error);
    return { success: false, error: error.message };
  }
};

// Uncomment to execute:
// createAdminUser();

/**
 * Alternative: Create Regular User for Testing
 */
const createTestUser = async () => {
  const userData = {
    username: 'testuser',
    email: 'test@rabtoise.com',
    password: 'test123',
    role: 'user',
    account_status: 'active'
  };

  try {
    const result = await window.api.createUser(userData);
    console.log('Test user created:', result);
    return result;
  } catch (error) {
    console.error('Error creating test user:', error);
    return { success: false, error: error.message };
  }
};

// Export for use in components if needed
window.createAdminUser = createAdminUser;
window.createTestUser = createTestUser;

console.log('Helper functions loaded. Use:');
console.log('- window.createAdminUser() to create admin user (admin/admin123)');
console.log('- window.createTestUser() to create test user (testuser/test123)');
