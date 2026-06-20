const { app, BrowserWindow } = require('electron');
const path = require('path');

// Load .env from alongside the executable when packaged
const envDir = app.isPackaged 
  ? (process.env.PORTABLE_EXECUTABLE_DIR || path.dirname(app.getPath('exe')))
  : __dirname;
  
let envPath = path.join(envDir, '.env');
const fs = require('fs');
if (!fs.existsSync(envPath) && fs.existsSync(path.join(envDir, '.env.txt'))) {
  envPath = path.join(envDir, '.env.txt');
}
const dotenvResult = require('dotenv').config({ path: envPath });

global.envDebug = {
  envPath: envPath,
  exists: fs.existsSync(envPath),
  dotenvError: dotenvResult.error ? dotenvResult.error.message : null,
  hasKey: !!process.env.GEMINI_API_KEY
};

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  // Start the express server
  process.env.NODE_ENV = 'production';
  require('./dist/server.cjs');

  // Load the app on port 3000
  setTimeout(() => {
    mainWindow.loadURL('http://localhost:3000');
  }, 1000);

  mainWindow.on('closed', function () {
    mainWindow = null;
  });

  // Automatically allow microphone/camera access
  mainWindow.webContents.session.setPermissionRequestHandler((webContents, permission, callback) => {
    if (permission === 'media' || permission === 'mediaKeySystem') {
      callback(true);
    } else {
      callback(true);
    }
  });

  mainWindow.webContents.session.setPermissionCheckHandler((webContents, permission, requestingOrigin, details) => {
    return true;
  });
}

app.on('ready', createWindow);

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', function () {
  if (mainWindow === null) {
    createWindow();
  }
});
