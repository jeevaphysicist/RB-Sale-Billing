import { app, shell, BrowserWindow, dialog, screen } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { registerIpcHandlers } from './ipcHandlers.js';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs'; 

import { initDB, verifyDatabase } from './Database/db.js';



const __dirname = path.dirname(fileURLToPath(import.meta.url));
const settingsPath = path.join(app.getPath('userData'), 'rabtoise-billing-inventory-settings.json');


async function initializeDatabase() {
  let dbPath;
  let shouldPrompt = false;
  let currentSettings = {};

  const exePath = app.getPath('exe');
  const appVersion = app.getVersion();
  const exeMtime = fs.existsSync(exePath) ? fs.statSync(exePath).mtimeMs : 0;

  if (fs.existsSync(settingsPath)) {
    try {
      currentSettings = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));
      dbPath = currentSettings.dbPath;

      const dbFileMissing = dbPath && !fs.existsSync(dbPath);

      // Simplify logic: only prompt if path is missing or file doesn't exist
      if (!dbPath || dbFileMissing) {
        shouldPrompt = true;
      }
    } catch (err) {
      console.error('Error reading settings:', err);
      shouldPrompt = true;
    }
  } else {
    // Fresh install
    shouldPrompt = true;
  }

  if (shouldPrompt) {
    const currentDir = dbPath ? path.dirname(dbPath) : 'Not Set';
    const message = dbPath 
      ? `Data Store Folder Confirmation:\n\n${currentDir}\n\nWould you like to use this folder or select a new one?`
      : 'Welcome! Please select a folder to store application data.';
    
    const buttons = dbPath ? ['Use Current Folder', 'Select New Folder', 'Exit'] : ['Select Folder', 'Exit'];
    const { response } = await dialog.showMessageBox({
      type: 'question',
      buttons: buttons,
      defaultId: 0,
      title: 'Setup - Data Store Configuration',
      message: message,
      cancelId: buttons.length - 1
    });

    // Exit option
    if (response === buttons.length - 1) {
      app.quit();
      return null;
    }

    // Select New Folder option (index 1 if dbPath exists, index 0 if not)
    if (response === (dbPath ? 1 : 0)) {
      const { filePaths } = await dialog.showOpenDialog({
        properties: ['openDirectory', 'createDirectory'],
        title: 'Select Data Store Folder',
        buttonLabel: 'Select Folder'
      });

      if (!filePaths || filePaths.length === 0) {
        if (!dbPath) {
          dialog.showErrorBox('Error', 'You must select a folder to continue.');
          app.quit();
          return null;
        }
        // If they had an existing path but cancelled picking a new one, we can fallback or quit
        // For safety, let's just use the existing one if they cancelled picking a new one but clicked "Select New"
      } else {
        dbPath = path.join(filePaths[0], 'billing.db');
      }
    }
    
    // Save updated settings
    const updatedSettings = {
      ...currentSettings,
      dbPath,
      appVersion,
      exeMtime
    };
    fs.writeFileSync(settingsPath, JSON.stringify(updatedSettings, null, 2));
  }

  try {
    const db = await initDB(dbPath);
    return { db, dbPath };
  } catch (err) {
    dialog.showErrorBox('Database Error', `Failed to initialize database: ${err.message}`);
    app.quit();
    return null;
  }
}

let mainWindow = null

function createWindow() {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize

  mainWindow = new BrowserWindow({
    width,
    height,
    minWidth: 800,
    minHeight: 600,
    show: false,
    frame: false,
    titleBarStyle: 'hidden',
    autoHideMenuBar: true,
    icon: join(__dirname, '../../resources/icon.png'),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      nodeIntegration: false,
      contextIsolation: true
    }
  })

  mainWindow.once('ready-to-show', () => {
    mainWindow.maximize()
    mainWindow.show()
  })

  // Handle window close event - no longer clearing session data
  // Users should remain logged in when they reopen the app
  mainWindow.on('close', (event) => {
    console.log('Window closing - session will persist');
  });
  
  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // Window state events
  mainWindow.on('maximize', () => {
    mainWindow.webContents.send('window-maximized')
  })

  mainWindow.on('unmaximize', () => {
    mainWindow.webContents.send('window-unmaximized')
  })

  mainWindow.on('enter-full-screen', () => {
    mainWindow.webContents.send('window-fullscreen')
  })

  mainWindow.on('leave-full-screen', () => {
    mainWindow.webContents.send('window-unfullscreen')
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(async() => {
  try {
    electronApp.setAppUserModelId('com.rabtoise.billing')
    console.log('🔌 Initializing database...')
    const dbResult = await initializeDatabase();
    
    if (!dbResult) {
      console.error('❌ Failed to initialize database')
      return;
    }
    
    const { db, dbPath } = dbResult;
    console.log('✅ Database initialized successfully')
    console.log('📁 Database location:', dbPath)

    app.on('browser-window-created', (_, window) => {
      optimizer.watchWindowShortcuts(window)
    })

    createWindow()

    // Verify database structure before proceeding
    try {
      console.log('🔍 Verifying database structure...');
      const dbIsValid = await verifyDatabase(db);
      if (!dbIsValid) {
        throw new Error('Database verification failed: Categories table is missing');
      }
      
      console.log('🔌 Registering IPC handlers...');
      registerIpcHandlers(mainWindow, app, db, dbPath);
      console.log('✅ IPC handlers registered');
    } catch (error) {
      console.error('❌ Database verification failed:', error);
      dialog.showErrorBox('Database Error', 'Failed to verify database structure. Please check the logs.');
      app.quit();
      return;
    }

    app.on('activate', function () {
      if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
  } catch (error) {
    console.error('❌ Error during app initialization:', error)
    dialog.showErrorBox('Initialization Error', 'Failed to initialize the application. Please check the logs.')
    app.quit()
  }
})


app.on('window-all-closed', () => {
  console.log('All windows closed - session data will persist for next app start');
  // Trigger rebuild
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('web-contents-created', (event, contents) => {
  contents.on('new-window', (navigationEvent, navigationUrl) => {
    navigationEvent.preventDefault()
    shell.openExternal(navigationUrl)
  })
})
