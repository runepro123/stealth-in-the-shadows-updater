const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { autoUpdater } = require('electron-updater');

// Logging
autoUpdater.logger = require("electron-log");
autoUpdater.logger.transports.file.level = "info";

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 768,
    title: "Stealth in the Shadows",
    backgroundColor: '#050505',
    icon: path.join(__dirname, 'build/favicon.ico'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  const startUrl = process.env.ELECTRON_START_URL || `file://${path.join(__dirname, './build/index.html')}`;
  mainWindow.loadURL(startUrl);

  // Remove default menu for immersion
  mainWindow.setMenuBarVisibility(false);

  // Auto Update Logic - triggers immediately on launch
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    autoUpdater.checkForUpdatesAndNotify();
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
  if(mainWindow) mainWindow.webContents.send('update_status', { status: 'error', msg: 'UPLINK FAILED' });
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