const { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage } = require('electron');
const path = require('path');
const { spawn } = require('child_process');

const isDev = !app.isPackaged;

let mainWindow;
let pythonProcess;
let tray;
let isQuitting = false;

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

  mainWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault();
      mainWindow.hide();
      return false;
    }
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

ipcMain.on('minimize-to-tray', () => {
  if (mainWindow) {
    mainWindow.hide();
  }
});

ipcMain.on('quit-app', () => {
  isQuitting = true;
  app.quit();
});

const fs = require('fs');

function logToFile(message) {
  const logDir = path.join(process.env.APPDATA, 'RedmineTracker');
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }
  const logPath = path.join(logDir, 'electron_main.log');
  const timestamp = new Date().toISOString();
  fs.appendFileSync(logPath, `[${timestamp}] ${message}\n`);
}

function startPythonBackend() {
  if (isDev) return; // In dev, concurrently handles it

  // Updated path for --onefile build
  let scriptPath = path.join(__dirname, '../backend/dist/backend.exe');
  scriptPath = scriptPath.replace('app.asar', 'app.asar.unpacked');

  logToFile(`Starting Backend Executable: ${scriptPath}`);

  pythonProcess = spawn(scriptPath, [], {
    stdio: 'pipe' // Capture stdout/stderr
  });

  pythonProcess.stdout.on('data', (data) => {
    logToFile(`Backend STDOUT: ${data}`);
  });

  pythonProcess.stderr.on('data', (data) => {
    logToFile(`Backend STDERR: ${data}`);
  });

  pythonProcess.on('error', (err) => {
    logToFile(`Failed to start Python backend: ${err}`);
  });

  pythonProcess.on('close', (code) => {
    logToFile(`Python backend exited with code ${code}`);
  });
}

function createTray() {
  const iconPath = path.join(__dirname, 'tray_icon.png');
  const icon = nativeImage.createFromPath(iconPath);
  tray = new Tray(icon);

  const contextMenu = Menu.buildFromTemplate([
    { label: 'Show App', click: () => mainWindow.show() },
    { type: 'separator' },
    {
      label: 'Quit', click: () => {
        isQuitting = true;
        app.quit();
      }
    }
  ]);

  tray.setToolTip('Redmine Tracker');
  tray.setContextMenu(contextMenu);

  tray.on('click', () => {
    if (mainWindow.isVisible()) {
      mainWindow.hide();
    } else {
      mainWindow.show();
    }
  });
}

app.on('ready', () => {
  if (!isDev) {
    startPythonBackend();
  }
  createWindow();
  createTray();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    if (pythonProcess) {
      if (process.platform === 'win32') {
        spawn('taskkill', ['/pid', pythonProcess.pid, '/f', '/t']);
      } else {
        pythonProcess.kill();
      }
    }
    app.exit(0);
  }
});

app.on('will-quit', () => {
  if (pythonProcess) {
    if (process.platform === 'win32') {
      spawn('taskkill', ['/pid', pythonProcess.pid, '/f', '/t']);
    } else {
      pythonProcess.kill();
    }
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});
