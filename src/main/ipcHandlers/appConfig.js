// src/main/ipcHandlers.js
import { ipcMain } from 'electron'
import bcrypt from 'bcryptjs'

let globalDb = null;

export function appConfig(mainWindow, app, db = null) {
  if (db) {
    globalDb = db;
  }
  // Window control handlers
  ipcMain.handle('window-minimize', () => {
    if (mainWindow) {
      mainWindow.minimize()
    }
  })

  ipcMain.handle('window-maximize', () => {
    if (mainWindow) {
      if (mainWindow.isMaximized()) {
        mainWindow.unmaximize()
      } else {
        mainWindow.maximize()
      }
    }
  })

  ipcMain.handle('window-close', () => {
    if (mainWindow) {
      mainWindow.close()
    }
  })

  ipcMain.handle('window-toggle-fullscreen', () => {
    if (mainWindow) {
      mainWindow.setFullScreen(!mainWindow.isFullScreen())
    }
  })

  // Get window state
  ipcMain.handle('window-is-maximized', () => {
    return mainWindow ? mainWindow.isMaximized() : false
  })

  ipcMain.handle('window-is-fullscreen', () => {
    return mainWindow ? mainWindow.isFullScreen() : false
  })

  // Application info
  ipcMain.handle('get-app-version', () => {
    return app.getVersion()
  })

  // App Password Management
  ipcMain.handle('app-password:get', async () => {
    try {
      if (!globalDb) {
        return { success: false, message: 'Database not available' };
      }

      const result = await new Promise((resolve, reject) => {
        globalDb.get(
          `SELECT value FROM app_configuration WHERE key = 'app_password'`,
          [],
          (err, row) => {
            if (err) {
              console.error('❌ Get app password error:', err.message);
              reject(err);
            } else {
              resolve(row);
            }
          }
        );
      });

      return { 
        success: true, 
        hasPassword: !!result?.value 
      };
    } catch (error) {
      console.error('❌ Get app password error:', error);
      return { success: false, message: 'Failed to check app password' };
    }
  });

  ipcMain.handle('app-password:set', async (event, password) => {
    try {
      if (!globalDb) {
        return { success: false, message: 'Database not available' };
      }

      if (!password || password.length < 6) {
        return { success: false, message: 'Password must be at least 6 characters' };
      }

      // Hash the password
      const hashedPassword = bcrypt.hashSync(password, 10);

      // Store or update the app password
      await new Promise((resolve, reject) => {
        globalDb.run(
          `INSERT OR REPLACE INTO app_configuration (key, value, updated_at) 
           VALUES ('app_password', ?, datetime('now', '+5 hours', '+30 minutes'))`,
          [hashedPassword],
          (err) => {
            if (err) {
              console.error('❌ Set app password error:', err.message);
              reject(err);
            } else {
              resolve();
            }
          }
        );
      });

      console.log('✅ App password set successfully');
      return { success: true, message: 'App password set successfully' };
    } catch (error) {
      console.error('❌ Set app password error:', error);
      return { success: false, message: 'Failed to set app password' };
    }
  });

  ipcMain.handle('app-password:verify', async (event, password) => {
    try {
      if (!globalDb) {
        return { success: false, message: 'Database not available' };
      }

      if (!password) {
        return { success: false, message: 'Password is required' };
      }

      const result = await new Promise((resolve, reject) => {
        globalDb.get(
          `SELECT value FROM app_configuration WHERE key = 'app_password'`,
          [],
          (err, row) => {
            if (err) {
              console.error('❌ Verify app password error:', err.message);
              reject(err);
            } else {
              resolve(row);
            }
          }
        );
      });

      if (!result?.value) {
        return { success: false, message: 'No app password set' };
      }

      // Verify password
      const passwordMatch = bcrypt.compareSync(password, result.value);
      
      if (passwordMatch) {
        return { success: true, message: 'Password verified' };
      } else {
        return { success: false, message: 'Invalid password' };
      }
    } catch (error) {
      console.error('❌ Verify app password error:', error);
      return { success: false, message: 'Failed to verify password' };
    }
  });

  ipcMain.handle('app-password:remove', async () => {
    try {
      if (!globalDb) {
        return { success: false, message: 'Database not available' };
      }

      await new Promise((resolve, reject) => {
        globalDb.run(
          `DELETE FROM app_configuration WHERE key = 'app_password'`,
          [],
          (err) => {
            if (err) {
              console.error('❌ Remove app password error:', err.message);
              reject(err);
            } else {
              resolve();
            }
          }
        );
      });

      console.log('✅ App password removed successfully');
      return { success: true, message: 'App password removed successfully' };
    } catch (error) {
      console.error('❌ Remove app password error:', error);
      return { success: false, message: 'Failed to remove app password' };
    }
  });

  // IPC test
  ipcMain.on('ping', () => console.log('pong'))
}
