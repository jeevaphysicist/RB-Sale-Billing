import { ipcMain } from 'electron';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

let globalDb = null;

// JWT secret key - in production, this should be stored securely
const JWT_SECRET = 'rabtoise-billing-secret-key-2024';
const JWT_EXPIRY = '7d'; // 7 days

export function initializeUserHandlers(db) {
  globalDb = db;

  // User Login
  ipcMain.handle('user:login', async (event, { username, password }) => {
    try {
      const user = await new Promise((resolve, reject) => {
        globalDb.get(
          `SELECT id, username, email, password, photo, role, account_status, is_active 
           FROM users 
           WHERE (username = ? OR email = ?) AND is_active = 1`,
          [username, username],
          (err, row) => {
            if (err) {
              console.error('❌ Login error:', err.message);
              reject(err);
            } else {
              resolve(row);
            }
          }
        );
      });

      if (!user) {
        return { success: false, message: 'User not found or inactive' };
      }

      if (user.account_status !== 'active') {
        return { success: false, message: 'Account is suspended or inactive' };
      }

      const passwordMatch = bcrypt.compareSync(password, user.password);
      if (!passwordMatch) {
        return { success: false, message: 'Invalid password' };
      }

      // Update last login
      await new Promise((resolve, reject) => {
        globalDb.run(
          `UPDATE users SET last_login = datetime('now', '+5 hours', '30 minutes') WHERE id = ?`,
          [user.id],
          (err) => {
            if (err) reject(err);
            else resolve();
          }
        );
      });

      // Generate JWT token
      const tokenPayload = {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role
      };
      
      const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: JWT_EXPIRY });

      // Return user data without password and include token
      const { password: _, ...userWithoutPassword } = user;
      return { 
        success: true, 
        message: 'Login successful',
        user: userWithoutPassword,
        token: token
      };
    } catch (error) {
      console.error('❌ Login error:', error);
      return { success: false, message: 'Login failed' };
    }
  });


  // Get all users (admin only)
  ipcMain.handle('user:get-all', async (event) => {
    try {
      const users = await new Promise((resolve, reject) => {
        globalDb.all(
          `SELECT id, username, email, photo, role, account_status, last_login, is_active, created_at, updated_at 
           FROM users 
           ORDER BY created_at DESC`,
          [],
          (err, rows) => {
            if (err) {
              console.error('❌ Get users error:', err.message);
              reject(err);
            } else {
              resolve(rows || []);
            }
          }
        );
      });

      return { success: true, users };
    } catch (error) {
      console.error('❌ Get users error:', error);
      return { success: false, message: 'Failed to fetch users' };
    }
  });

  // Create new user
  ipcMain.handle('user:create', async (event, userData) => {
    try {
      const { username, email, password, photo, role = 'user', account_status = 'active', created_by } = userData;
      
      // Enforce single super admin
      if (role === 'admin') {
        const adminExists = await new Promise((resolve, reject) => {
          globalDb.get(
            `SELECT id FROM users WHERE role = 'admin'`,
            [],
            (err, row) => {
              if (err) reject(err);
              else resolve(row);
            }
          );
        });

        if (adminExists) {
          return { success: false, message: 'A super admin already exists. Only one admin is allowed.' };
        }
      }

      // Validate required fields
      if (!username || !email || !password) {
        return { success: false, message: 'Username, email, and password are required' };
      }

      // Check if user already exists
      const existingUser = await new Promise((resolve, reject) => {
        globalDb.get(
          `SELECT id FROM users WHERE username = ? OR email = ?`,
          [username, email],
          (err, row) => {
            if (err) reject(err);
            else resolve(row);
          }
        );
      });

      if (existingUser) {
        return { success: false, message: 'Username or email already exists' };
      }

      // Hash password
      const hashedPassword = bcrypt.hashSync(password, 10);

      // Create user
      const result = await new Promise((resolve, reject) => {
        globalDb.run(
          `INSERT INTO users (username, email, password, photo, role, account_status, created_by) 
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [username, email, hashedPassword, photo, role, account_status, created_by],
          function(err) {
            if (err) {
              console.error('❌ Create user error:', err.message);
              reject(err);
            } else {
              resolve({ id: this.lastID });
            }
          }
        );
      });

      return { 
        success: true, 
        message: 'User created successfully',
        userId: result.id 
      };
    } catch (error) {
      console.error('❌ Create user error:', error);
      return { success: false, message: 'Failed to create user' };
    }
  });

  // Update user
  ipcMain.handle('user:update', async (event, userData) => {
    try {
      const { id, username, email, photo, role, account_status } = userData;

      if (!id) {
        return { success: false, message: 'User ID is required' };
      }

      // Check if username/email already exists for another user
      if (username || email) {
        const existingUser = await new Promise((resolve, reject) => {
          globalDb.get(
            `SELECT id FROM users WHERE (username = ? OR email = ?) AND id != ?`,
            [username || '', email || '', id],
            (err, row) => {
              if (err) reject(err);
              else resolve(row);
            }
          );
        });

        if (existingUser) {
          return { success: false, message: 'Username or email already exists' };
        }
      }

      // Build dynamic update query
      const updateFields = [];
      const updateValues = [];

      if (username) {
        updateFields.push('username = ?');
        updateValues.push(username);
      }
      if (email) {
        updateFields.push('email = ?');
        updateValues.push(email);
      }
      if (photo !== undefined) {
        updateFields.push('photo = ?');
        updateValues.push(photo);
      }
      if (role) {
        updateFields.push('role = ?');
        updateValues.push(role);
      }
      if (account_status) {
        updateFields.push('account_status = ?');
        updateValues.push(account_status);
      }

      updateFields.push(`updated_at = datetime('now', '+5 hours', '30 minutes')`);
      updateValues.push(id);

      if (updateFields.length === 1) {
        return { success: false, message: 'No fields to update' };
      }

      await new Promise((resolve, reject) => {
        globalDb.run(
          `UPDATE users SET ${updateFields.join(', ')} WHERE id = ?`,
          updateValues,
          (err) => {
            if (err) {
              console.error('❌ Update user error:', err.message);
              reject(err);
            } else {
              resolve();
            }
          }
        );
      });

      return { success: true, message: 'User updated successfully' };
    } catch (error) {
      console.error('❌ Update user error:', error);
      return { success: false, message: 'Failed to update user' };
    }
  });

  // Update user password
  ipcMain.handle('user:update-password', async (event, { id, currentPassword, newPassword }) => {
    try {
      if (!id || !currentPassword || !newPassword) {
        return { success: false, message: 'All password fields are required' };
      }

      // Get current user
      const user = await new Promise((resolve, reject) => {
        globalDb.get(
          `SELECT password FROM users WHERE id = ?`,
          [id],
          (err, row) => {
            if (err) reject(err);
            else resolve(row);
          }
        );
      });

      if (!user) {
        return { success: false, message: 'User not found' };
      }

      // Verify current password
      const passwordMatch = bcrypt.compareSync(currentPassword, user.password);
      if (!passwordMatch) {
        return { success: false, message: 'Current password is incorrect' };
      }

      // Hash new password
      const hashedPassword = bcrypt.hashSync(newPassword, 10);

      // Update password
      await new Promise((resolve, reject) => {
        globalDb.run(
          `UPDATE users SET password = ?, updated_at = datetime('now', '+5 hours', '30 minutes') WHERE id = ?`,
          [hashedPassword, id],
          (err) => {
            if (err) {
              console.error('❌ Update password error:', err.message);
              reject(err);
            } else {
              resolve();
            }
          }
        );
      });

      return { success: true, message: 'Password updated successfully' };
    } catch (error) {
      console.error('❌ Update password error:', error);
      return { success: false, message: 'Failed to update password' };
    }
  });

  // Delete user (soft delete)
  ipcMain.handle('user:delete', async (event, userId) => {
    try {
      if (!userId) {
        return { success: false, message: 'User ID is required' };
      }

      await new Promise((resolve, reject) => {
        globalDb.run(
          `UPDATE users SET is_active = 0, updated_at = datetime('now', '+5 hours', '30 minutes') WHERE id = ?`,
          [userId],
          (err) => {
            if (err) {
              console.error('❌ Delete user error:', err.message);
              reject(err);
            } else {
              resolve();
            }
          }
        );
      });

      return { success: true, message: 'User deleted successfully' };
    } catch (error) {
      console.error('❌ Delete user error:', error);
      return { success: false, message: 'Failed to delete user' };
    }
  });

  // Reset user password (admin only)
  ipcMain.handle('user:reset-password', async (event, { userId, newPassword }) => {
    try {
      if (!userId || !newPassword) {
        return { success: false, message: 'User ID and new password are required' };
      }

      // Get user to check if exists
      const user = await new Promise((resolve, reject) => {
        globalDb.get(
          `SELECT id, username FROM users WHERE id = ?`,
          [userId],
          (err, row) => {
            if (err) reject(err);
            else resolve(row);
          }
        );
      });

      if (!user) {
        return { success: false, message: 'User not found' };
      }

      // Hash new password
      const hashedPassword = bcrypt.hashSync(newPassword, 10);

      // Update password
      await new Promise((resolve, reject) => {
        globalDb.run(
          `UPDATE users SET password = ?, updated_at = datetime('now', '+5 hours', '30 minutes') WHERE id = ?`,
          [hashedPassword, userId],
          (err) => {
            if (err) {
              console.error('❌ Reset password error:', err.message);
              reject(err);
            } else {
              resolve();
            }
          }
        );
      });

      return { success: true, message: `Password reset successfully for user: ${user.username}` };
    } catch (error) {
      console.error('❌ Reset password error:', error);
      return { success: false, message: 'Failed to reset password' };
    }
  });

  // Get user by ID
  ipcMain.handle('user:get-by-id', async (event, userId) => {
    try {
      if (!userId) {
        return { success: false, message: 'User ID is required' };
      }

      const user = await new Promise((resolve, reject) => {
        globalDb.get(
          `SELECT id, username, email, photo, role, account_status, last_login, is_active, created_at, updated_at 
           FROM users 
           WHERE id = ?`,
          [userId],
          (err, row) => {
            if (err) {
              console.error('❌ Get user by ID error:', err.message);
              reject(err);
            } else {
              resolve(row);
            }
          }
        );
      });

      if (!user) {
        return { success: false, message: 'User not found' };
      }

      return { success: true, user };
    } catch (error) {
      console.error('❌ Get user by ID error:', error);
      return { success: false, message: 'Failed to fetch user' };
    }
  });

  // Verify JWT Token
  ipcMain.handle('user:verify-token', async (event, token) => {
    try {
      if (!token) {
        return { success: false, message: 'No token provided' };
      }

      // Verify and decode the token
      const decoded = jwt.verify(token, JWT_SECRET);
      
      // Fetch fresh user data from database
      const user = await new Promise((resolve, reject) => {
        globalDb.get(
          `SELECT id, username, email, photo, role, account_status, is_active 
           FROM users 
           WHERE id = ? AND is_active = 1`,
          [decoded.id],
          (err, row) => {
            if (err) {
              console.error('❌ Token verification error:', err.message);
              reject(err);
            } else {
              resolve(row);
            }
          }
        );
      });

      if (!user) {
        return { success: false, message: 'User not found or inactive' };
      }

      if (user.account_status !== 'active') {
        return { success: false, message: 'Account is suspended or inactive' };
      }

      return { 
        success: true, 
        user: user,
        decoded: decoded
      };
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        return { success: false, message: 'Token expired' };
      } else if (error.name === 'JsonWebTokenError') {
        return { success: false, message: 'Invalid token' };
      }
      console.error('❌ Token verification error:', error);
      return { success: false, message: 'Token verification failed' };
    }
  });

  // User Logout (client-side will handle token removal, this is just for logging)
  ipcMain.handle('user:logout', async (event, userId) => {
    try {
      console.log(`✅ User ${userId} logged out`);
      return { success: true, message: 'Logged out successfully' };
    } catch (error) {
      console.error('❌ Logout error:', error);
      return { success: false, message: 'Logout failed' };
    }
  });

  console.log('✅ User IPC handlers registered');
}
