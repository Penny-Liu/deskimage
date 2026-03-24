import { app, BrowserWindow, Tray, Menu, nativeImage, screen } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let mainWindow: BrowserWindow | null = null;
let tickerWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let serverProcess: any = null;

const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL'];
const DIST = path.join(__dirname, '../dist');
const VITE_PUBLIC = app.isPackaged ? DIST : path.join(__dirname, '../public');

// Start the Express server
if (!app.isPackaged) {
  serverProcess = spawn('node', ['--import', 'tsx', path.join(__dirname, '../server.ts')], {
    env: { ...process.env, ELECTRON: 'true' },
    stdio: 'inherit'
  });
} else {
  serverProcess = spawn('node', [path.join(__dirname, '../dist/server.js')], {
    env: { ...process.env, DATABASE_PATH: process.env.DATABASE_PATH || path.join(app.getPath('userData'), 'radportal.db') },
    stdio: 'inherit'
  });
}

let isQuiting = false;

function createTray() {
  const iconPath = path.join(VITE_PUBLIC, 'logo.png');
  const icon = nativeImage.createFromPath(iconPath);
  tray = new Tray(icon.resize({ width: 16, height: 16 }));
  
  const contextMenu = Menu.buildFromTemplate([
    { label: '顯示主視窗', click: () => mainWindow?.show() },
    { label: '隱藏主視窗', click: () => mainWindow?.hide() },
    { type: 'separator' },
    { label: '退出', click: () => {
      isQuiting = true;
      app.quit();
    }}
  ]);

  tray.setToolTip('RadPortal 影像醫學部工作站');
  tray.setContextMenu(contextMenu);
  tray.on('double-click', () => mainWindow?.show());
}

function createTickerWindow() {
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width } = primaryDisplay.workAreaSize;

  tickerWindow = new BrowserWindow({
    width: width,
    height: 45,
    x: 0,
    y: 0,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: false,
    skipTaskbar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  // Load the ticker view
  if (VITE_DEV_SERVER_URL) {
    tickerWindow.loadURL(`${VITE_DEV_SERVER_URL}?view=ticker`);
  } else {
    tickerWindow.loadFile(path.join(DIST, 'index.html'), { query: { view: 'ticker' } });
  }

  tickerWindow.on('closed', () => {
    tickerWindow = null;
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    icon: path.join(VITE_PUBLIC, 'logo.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  if (VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(path.join(DIST, 'index.html'));
  }

  mainWindow.on('close', (event) => {
    if (!isQuiting) {
      event.preventDefault();
      mainWindow?.hide();
    }
    return false;
  });
}

app.whenReady().then(() => {
  createTray();
  createWindow();
  createTickerWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

app.on('quit', () => {
  if (serverProcess) serverProcess.kill();
});
