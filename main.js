const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { autoUpdater } = require('electron-updater');
const log = require('electron-log');
const fs = require('fs');

// Logging
autoUpdater.logger = log;
autoUpdater.logger.transports.file.level = "info";

// CRITICAL FIX: Disable signature verification for unsigned/self-signed GitHub releases
autoUpdater.verifyUpdateCodeSignature = false; 
autoUpdater.autoDownload = true;
autoUpdater.autoInstallOnAppQuit = true;

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 768,
    title: "Stealth in the Shadows",
    backgroundColor: '#050505',
    icon: path.join(__dirname, 'dist/favicon.ico'), 
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  // Load from Vite dev server (5173) or local build (dist/index.html)
  const startUrl = process.env.ELECTRON_START_URL || `file://${path.join(__dirname, './dist/index.html')}`;
  mainWindow.loadURL(startUrl);

  // Remove default menu for immersion
  mainWindow.setMenuBarVisibility(false);

  // Auto Update Logic - triggers immediately on launch
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    // Check for updates after a short delay to ensure window is ready
    setTimeout(() => {
        autoUpdater.checkForUpdatesAndNotify();
    }, 1500);
  });
}

app.on('ready', createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});

// --- FILE SYSTEM IPC HANDLERS ---

const getSavePath = () => {
  const documentsPath = app.getPath('documents');
  return path.join(documentsPath, 'Dev City Studio', 'Stealth in the Shadows');
};

const getSaveFile = () => {
  return path.join(getSavePath(), 'save_data.json');
};

ipcMain.handle('save-game', async (event, data) => {
  try {
    const saveDir = getSavePath();
    if (!fs.existsSync(saveDir)) {
      fs.mkdirSync(saveDir, { recursive: true });
    }
    fs.writeFileSync(getSaveFile(), JSON.stringify(data, null, 2));
    return { success: true };
  } catch (error) {
    console.error('Failed to save game:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('load-game', async () => {
  try {
    const saveFile = getSaveFile();
    if (fs.existsSync(saveFile)) {
      const data = fs.readFileSync(saveFile, 'utf-8');
      return JSON.parse(data);
    }
    return null;
  } catch (error) {
    console.error('Failed to load game:', error);
    return null;
  }
});

ipcMain.handle('delete-save', async () => {
  try {
    const saveFile = getSaveFile();
    if (fs.existsSync(saveFile)) {
      fs.unlinkSync(saveFile);
    }
    return { success: true };
  } catch (error) {
    console.error('Failed to delete save:', error);
    return { success: false, error: error.message };
  }
});

// --- AUTO UPDATER EVENTS ---

autoUpdater.on('checking-for-update', () => {
  if(mainWindow) mainWindow.webContents.send('update_status', { status: 'checking', msg: 'ESTABLISHING UPLINK...' });
});

autoUpdater.on('update-available', (info) => {
  if(mainWindow) mainWindow.webContents.send('update_status', { status: 'available', msg: `PATCH DETECTED: v${info.version}` });
});

autoUpdater.on('update-not-available', () => {
  if(mainWindow) mainWindow.webContents.send('update_status', { status: 'none', msg: 'SYSTEM OPTIMIZED' });
});

autoUpdater.on('error', (err) => {
  log.error("Update error:", err); 
  if(mainWindow) mainWindow.webContents.send('update_status', { 
      status: 'error', 
      msg: 'UPLINK FAILED',
      detail: err.message || JSON.stringify(err) // Send specific error to UI
  });
});

autoUpdater.on('download-progress', (progressObj) => {
  if(mainWindow) mainWindow.webContents.send('update_progress', {
    percent: progressObj.percent,
    speed: progressObj.bytesPerSecond,
    transferred: progressObj.transferred,
    total: progressObj.total
  });
});

autoUpdater.on('update-downloaded', () => {
  if(mainWindow) mainWindow.webContents.send('update_status', { status: 'ready', msg: 'INSTALLING UPGRADE...' });
  // Quit and install after a short delay to let UI show the message
  setTimeout(() => {
    autoUpdater.quitAndInstall();
  }, 3000);
});