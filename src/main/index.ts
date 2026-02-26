import { app, BrowserWindow } from 'electron';
import path from 'path';
import { SystemMonitor } from './services/system-monitor';
import { ProcessMonitor } from './services/process-monitor';
import { MemoryTracker } from './services/memory-tracker';
import { Optimizer } from './services/optimizer';
import { AppTray } from './tray';
import { setupIpcHandlers } from './ipc-handlers';

declare const MAIN_WINDOW_VITE_DEV_SERVER_URL: string;
declare const MAIN_WINDOW_VITE_NAME: string;
declare const MAIN_WINDOW_PRELOAD_VITE_ENTRY: string;

let mainWindow: BrowserWindow | null = null;
let isQuitting = false;

const systemMonitor = new SystemMonitor();
const processMonitor = new ProcessMonitor();
const memoryTracker = new MemoryTracker(processMonitor);
const optimizer = new Optimizer(systemMonitor, processMonitor, memoryTracker);
const appTray = new AppTray(
  systemMonitor,
  processMonitor,
  memoryTracker,
  () => mainWindow,
);

async function createWindow(): Promise<void> {
  mainWindow = new BrowserWindow({
    width: 1000,
    height: 700,
    minWidth: 700,
    minHeight: 500,
    backgroundColor: '#0f172a',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: MAIN_WINDOW_PRELOAD_VITE_ENTRY,
    },
    show: true,
  });

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    await mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    await mainWindow.loadFile(
      path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`)
    );
  }

  // Minimize to tray instead of closing
  mainWindow.on('close', (e) => {
    if (!isQuitting) {
      e.preventDefault();
      mainWindow?.hide();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

async function initialize(): Promise<void> {
  setupIpcHandlers({
    systemMonitor,
    processMonitor,
    memoryTracker,
    optimizer,
    getMainWindow: () => mainWindow,
  });

  systemMonitor.start();
  processMonitor.start();
  memoryTracker.start();
  optimizer.start();

  await createWindow();
  appTray.create();
}

app.whenReady().then(initialize);

app.on('window-all-closed', () => {
  // Don't quit on window close — tray keeps running
  if (process.platform === 'darwin') return;
});

app.on('activate', () => {
  if (mainWindow) {
    mainWindow.show();
  } else {
    createWindow();
  }
});

app.on('before-quit', () => {
  isQuitting = true;
  systemMonitor.stop();
  processMonitor.stop();
  memoryTracker.stop();
  optimizer.stop();
  appTray.destroy();
});
