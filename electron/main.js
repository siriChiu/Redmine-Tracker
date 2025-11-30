const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { spawn } = require('child_process');

const isDev = !app.isPackaged;

let mainWindow;
let pythonProcess;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 500,
    height: 700,
    show: false, // Don't show until ready to prevent white flash
    backgroundColor: '#181818', // Match loading screen background (Dark)
    frame: false, // Frameless for floating effect
    transparent: false, // Disable transparency for debugging
    alwaysOnTop: true, // Floating on top
    resizable: true, // Allow resizing
    minWidth: 50,
    minHeight: 50,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false, // For simple IPC, or use preload
    },
  });

  const startUrl = isDev
    ? 'http://localhost:5173'
    : `file://${path.join(__dirname, '../dist/index.html')}`;

  mainWindow.loadURL(startUrl);

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // DevTools closed by default (user can open with Ctrl+Shift+I if needed)
  // mainWindow.webContents.openDevTools();

  // Intercept new window requests (e.g., target="_blank") and open in default browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    require('electron').shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// ... (IPC handlers remain the same)

ipcMain.on('close-window', () => {
  if (mainWindow) mainWindow.close();
});

ipcMain.on('resize-window', (event, { width, height }) => {
  if (mainWindow) {
    mainWindow.setSize(width, height);
  }
});

ipcMain.on('open-external-link', (event, url) => {
  require('electron').shell.openExternal(url);
});

ipcMain.on('set-window-bounds', (event, bounds) => {
  if (mainWindow) {
    mainWindow.setBounds(bounds);
  }
});

function startPythonBackend() {
  if (isDev) return; // In dev, concurrently handles it

  // Updated path for --onedir build (inside a folder)
  let scriptPath = path.join(__dirname, '../backend/dist/backend/backend.exe');
  scriptPath = scriptPath.replace('app.asar', 'app.asar.unpacked');

  console.log(`Starting Backend Executable: ${scriptPath}`);

  pythonProcess = spawn(scriptPath, [], {
    stdio: 'inherit'
  });

  pythonProcess.on('error', (err) => {
    console.error('Failed to start Python backend:', err);
  });

  pythonProcess.on('close', (code) => {
    console.log(`Python backend exited with code ${code}`);
  });
}

app.on('ready', () => {
  if (!isDev) {
    startPythonBackend();
  }
  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    if (pythonProcess) {
      pythonProcess.kill();
    }
    app.exit(0);
  }
});

app.on('will-quit', () => {
  if (pythonProcess) {
    pythonProcess.kill();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});
