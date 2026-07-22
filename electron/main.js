const { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const { pathToFileURL } = require('url');
const { findAvailablePort } = require('./port');

const isDev = !app.isPackaged;

let mainWindow;
let pythonProcess;
let viteProcess;
let tray;
let isQuitting = false;
let reminderWindow;
let reminderTopmostTimer;
let currentReminderKey;
const shownReminderKeys = new Set();
let reminderTimer;
let backendPort = 8000;
let frontendPort = 5173;

function backendUrl(pathname = '') {
  return `http://127.0.0.1:${backendPort}${pathname}`;
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1160,
    height: 820,
    show: false, // Don't show until ready to prevent white flash
    backgroundColor: '#181818', // Match loading screen background (Dark)
    frame: false, // Frameless for floating effect
    transparent: false, // Disable transparency for debugging
    alwaysOnTop: false,
    resizable: true, // Allow resizing
    minWidth: 720,
    minHeight: 560,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false, // For simple IPC, or use preload
    },
  });

  const startUrl = isDev
    ? `http://127.0.0.1:${frontendPort}?backendPort=${backendPort}`
    : (() => {
      const url = pathToFileURL(path.join(__dirname, '../dist/index.html'));
      url.searchParams.set('backendPort', String(backendPort));
      return url.toString();
    })();

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

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  })[character]);
}

function enforceReminderTopmost() {
  if (!reminderWindow || reminderWindow.isDestroyed()) {
    if (reminderTopmostTimer) clearInterval(reminderTopmostTimer);
    reminderTopmostTimer = null;
    return;
  }
  reminderWindow.setAlwaysOnTop(true, 'screen-saver', 1);
  reminderWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  if (!reminderWindow.isVisible()) reminderWindow.showInactive();
  reminderWindow.moveTop();
}

function startReminderTopmostGuard() {
  if (reminderTopmostTimer) clearInterval(reminderTopmostTimer);
  enforceReminderTopmost();
  reminderTopmostTimer = setInterval(enforceReminderTopmost, 1500);
  reminderTopmostTimer.unref?.();
}

function stopReminderTopmostGuard() {
  if (reminderTopmostTimer) clearInterval(reminderTopmostTimer);
  reminderTopmostTimer = null;
}

function showWorklogReminder(summary, settings, isTest = false) {
  if (reminderWindow && !reminderWindow.isDestroyed()) {
    enforceReminderTopmost();
    reminderWindow.focus();
    return;
  }

  const dailyTarget = Number(settings.daily_target_hours || 8);
  const weeklyTarget = Number(settings.weekly_target_hours || 40);
  const now = new Date();
  const isFriday = now.getDay() === 5;
  const dailyMissing = Math.max(0, dailyTarget - Number(summary.daily_hours || 0));
  const weeklyMissing = Math.max(0, weeklyTarget - Number(summary.weekly_hours || 0));
  const reminderTitle = dailyMissing <= 0 && isFriday && weeklyMissing > 0
    ? '本週的工時還沒補滿'
    : '今天的工時還沒補滿';
  const weeklyLine = isFriday && weeklyMissing > 0
    ? `<div class="metric"><span>本週</span><strong>${escapeHtml(summary.weekly_hours)} / ${weeklyTarget}h</strong><em>尚差 ${weeklyMissing.toFixed(1)}h</em></div>`
    : '';

  reminderWindow = new BrowserWindow({
    width: 450,
    height: isFriday && weeklyMissing > 0 ? 310 : 270,
    resizable: false,
    maximizable: false,
    minimizable: false,
    frame: false,
    alwaysOnTop: true,
    skipTaskbar: false,
    backgroundColor: '#17171d',
    webPreferences: { nodeIntegration: true, contextIsolation: false }
  });
  reminderWindow.setAlwaysOnTop(true, 'screen-saver');
  reminderWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  reminderWindow.setFullScreenable(false);

  const html = `<!doctype html><html><head><meta charset="UTF-8"><style>
    *{box-sizing:border-box}body{margin:0;padding:24px;font-family:Inter,Segoe UI,sans-serif;background:linear-gradient(145deg,#201a2b,#111118);color:#fff;border:1px solid rgba(167,139,250,.55);height:100vh}
    .head{display:flex;gap:12px;align-items:center;margin-bottom:16px}.icon{width:42px;height:42px;border-radius:13px;background:linear-gradient(135deg,#f59e0b,#ef4444);display:grid;place-items:center;font-size:23px}.title{font-size:19px;font-weight:750}.sub{color:#aaa;font-size:12px;margin-top:2px}
    .metric{display:grid;grid-template-columns:52px 1fr auto;align-items:center;gap:10px;padding:11px 12px;margin-top:8px;background:rgba(255,255,255,.055);border-radius:10px}.metric span{color:#bbb;font-size:13px}.metric strong{font-size:17px}.metric em{color:#fbbf24;font-size:12px;font-style:normal}
    .actions{display:flex;justify-content:flex-end;gap:9px;margin-top:18px}button{border:0;border-radius:9px;padding:9px 14px;color:white;background:#34343e;font-weight:650;cursor:pointer}button.primary{background:linear-gradient(135deg,#646cff,#9f55ff)}
  </style></head><body>
    <div class="head"><div class="icon">⏱</div><div><div class="title">${isTest ? '工時提醒測試' : reminderTitle}</div><div class="sub">Redmine Tracker · ${escapeHtml(summary.date || '')}</div></div></div>
    <div class="metric"><span>今天</span><strong>${escapeHtml(summary.daily_hours)} / ${dailyTarget}h</strong><em>尚差 ${dailyMissing.toFixed(1)}h</em></div>
    ${weeklyLine}
    <div class="actions"><button id="snooze">20 分鐘後提醒</button><button class="primary" id="open">前往補登</button></div>
    <script>const {ipcRenderer}=require('electron');document.getElementById('snooze').onclick=()=>ipcRenderer.send('reminder-action','snooze');document.getElementById('open').onclick=()=>ipcRenderer.send('reminder-action','open');</script>
  </body></html>`;
  reminderWindow.loadURL(`data:text/html;charset=UTF-8,${encodeURIComponent(html)}`);
  reminderWindow.once('ready-to-show', () => {
    reminderWindow.show();
    startReminderTopmostGuard();
    reminderWindow.focus();
  });
  reminderWindow.on('show', enforceReminderTopmost);
  reminderWindow.on('blur', () => setTimeout(enforceReminderTopmost, 0));
  reminderWindow.on('always-on-top-changed', (_event, isAlwaysOnTop) => {
    if (!isAlwaysOnTop) setTimeout(enforceReminderTopmost, 0);
  });
  reminderWindow.on('closed', () => {
    stopReminderTopmostGuard();
    reminderWindow = null;
  });
}

async function checkWorklogReminder() {
  try {
    const now = new Date();
    if (now.getDay() === 0 || now.getDay() === 6) return;
    const settingsResponse = await fetch(backendUrl('/api/settings'));
    if (!settingsResponse.ok) return;
    const settings = await settingsResponse.json();
    if (settings.reminders_enabled === false) return;
    const alertTime = settings.alert_time || '17:00';
    const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    if (currentTime < alertTime) return;

    const dateString = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const reminderKey = `${dateString}-${alertTime}`;
    if (shownReminderKeys.has(reminderKey)) return;
    const summaryResponse = await fetch(backendUrl(`/api/redmine/time_summary?date_str=${dateString}&refresh=true`));
    if (!summaryResponse.ok) return;
    const summary = await summaryResponse.json();
    if (summary.error) return;
    const dailyMissing = Number(summary.daily_hours || 0) < Number(settings.daily_target_hours || 8);
    const weeklyMissing = now.getDay() === 5 && Number(summary.weekly_hours || 0) < Number(settings.weekly_target_hours || 40);
    if (!dailyMissing && !weeklyMissing) return;

    shownReminderKeys.add(reminderKey);
    currentReminderKey = reminderKey;
    showWorklogReminder(summary, settings);
  } catch (error) {
    logToFile(`Reminder check failed: ${error}`);
  }
}

ipcMain.on('reminder-action', (_event, action) => {
  if (reminderWindow && !reminderWindow.isDestroyed()) reminderWindow.close();
  if (action === 'open' && mainWindow) {
    mainWindow.show();
    mainWindow.focus();
    mainWindow.webContents.send('navigate-to', '/calendar');
  }
  if (action === 'snooze' && currentReminderKey) {
    const key = currentReminderKey;
    setTimeout(() => {
      shownReminderKeys.delete(key);
      checkWorklogReminder();
    }, 20 * 60 * 1000);
  }
});

ipcMain.on('test-worklog-reminder', () => {
  const now = new Date();
  const dateString = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  showWorklogReminder({ date: dateString, daily_hours: 6.5, weekly_hours: 31.5 }, { daily_target_hours: 8, weekly_target_hours: 40 }, true);
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

function startPythonBackend(port) {
  const projectRoot = path.join(__dirname, '..');
  let executable;
  let args;
  if (isDev) {
    executable = path.join(projectRoot, '.venv', 'Scripts', 'python.exe');
    args = [path.join(projectRoot, 'backend', 'main.py')];
  } else {
    executable = path.join(__dirname, '../backend/dist/backend.exe').replace('app.asar', 'app.asar.unpacked');
    args = [];
  }

  logToFile(`Starting backend on port ${port}: ${executable}`);

  pythonProcess = spawn(executable, args, {
    cwd: isDev ? projectRoot : path.dirname(executable),
    stdio: 'pipe',
    env: { ...process.env, REDMINE_TRACKER_PORT: String(port) },
    windowsHide: true
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

function startViteDevServer(port) {
  const projectRoot = path.join(__dirname, '..');
  const nodeExecutable = process.env.npm_node_execpath || 'node';
  const viteEntry = path.join(projectRoot, 'node_modules', 'vite', 'bin', 'vite.js');
  viteProcess = spawn(nodeExecutable, [viteEntry, '--host', '127.0.0.1', '--port', String(port), '--strictPort'], {
    cwd: projectRoot,
    stdio: 'pipe',
    windowsHide: true
  });
  viteProcess.stdout.on('data', (data) => logToFile(`Vite STDOUT: ${data}`));
  viteProcess.stderr.on('data', (data) => logToFile(`Vite STDERR: ${data}`));
  viteProcess.on('error', (error) => logToFile(`Failed to start Vite: ${error}`));
  viteProcess.on('close', (code) => logToFile(`Vite exited with code ${code}`));
}

async function waitForBackend(timeoutMs = 15000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(backendUrl('/api/debug'));
      if (response.ok) return true;
    } catch {
      // Backend is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  return false;
}

async function waitForFrontend(timeoutMs = 15000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`http://127.0.0.1:${frontendPort}`);
      if (response.ok) return true;
    } catch {
      // Vite is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  return false;
}

function terminateChildProcess(child) {
  if (!child || child.killed) return;
  if (process.platform === 'win32') {
    spawn('taskkill', ['/pid', child.pid, '/f', '/t'], { windowsHide: true });
  } else {
    child.kill();
  }
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

app.whenReady().then(async () => {
  try {
    if (isDev) {
      frontendPort = await findAvailablePort(5173, 5272);
      startViteDevServer(frontendPort);
      const frontendReady = await waitForFrontend();
      if (!frontendReady) logToFile(`Vite did not become ready on port ${frontendPort} within 15 seconds`);
    }
    backendPort = await findAvailablePort();
    startPythonBackend(backendPort);
    const ready = await waitForBackend();
    if (!ready) logToFile(`Backend did not become ready on port ${backendPort} within 15 seconds`);
  } catch (error) {
    logToFile(`Backend startup coordination failed: ${error}`);
  }
  createWindow();
  createTray();
  setTimeout(checkWorklogReminder, 8000);
  reminderTimer = setInterval(checkWorklogReminder, 60 * 1000);
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    terminateChildProcess(pythonProcess);
    terminateChildProcess(viteProcess);
    app.exit(0);
  }
});

app.on('will-quit', () => {
  if (reminderTimer) clearInterval(reminderTimer);
  stopReminderTopmostGuard();
  terminateChildProcess(pythonProcess);
  terminateChildProcess(viteProcess);
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});
