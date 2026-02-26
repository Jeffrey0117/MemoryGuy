import { app, BrowserWindow } from 'electron';
import path from 'path';
import fs from 'fs';
import { SystemMonitor } from './services/system-monitor';
import { ProcessMonitor } from './services/process-monitor';
import { MemoryTracker } from './services/memory-tracker';
import { Optimizer } from './services/optimizer';
import { setupIpcHandlers } from './ipc-handlers';

const LOG_FILE = path.join(__dirname, '..', 'crash.log');
function log(msg: string): void {
  const line = `[${new Date().toISOString()}] ${msg}\n`;
  fs.appendFileSync(LOG_FILE, line);
}

process.on('uncaughtException', (err) => {
  log(`UNCAUGHT: ${err.stack ?? err.message}`);
  app.quit();
});
process.on('unhandledRejection', (reason) => {
  log(`UNHANDLED: ${reason}`);
  app.quit();
});

app.commandLine.appendSwitch('disable-gpu');
app.commandLine.appendSwitch('disable-software-rasterizer');

declare const MAIN_WINDOW_VITE_DEV_SERVER_URL: string;
declare const MAIN_WINDOW_VITE_NAME: string;
declare const MAIN_WINDOW_PRELOAD_VITE_ENTRY: string;

let mainWindow: BrowserWindow | null = null;

const systemMonitor = new SystemMonitor();
const processMonitor = new ProcessMonitor();
const memoryTracker = new MemoryTracker(processMonitor);
const optimizer = new Optimizer(systemMonitor, processMonitor, memoryTracker);

function getPreloadPath(): string {
  const candidates = [
    path.join(__dirname, 'preload.js'),
    path.join(__dirname, '..', '..', 'dist', 'preload.js'),
    path.join(__dirname, '..', 'preload.js'),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) {
      log(`Preload found: ${p}`);
      return p;
    }
  }
  log(`No preload found! Tried: ${candidates.join(', ')}`);
  return candidates[0];
}

async function createWindow(): Promise<void> {
  log('Creating BrowserWindow...');
  mainWindow = new BrowserWindow({
    width: 1000,
    height: 700,
    minWidth: 700,
    minHeight: 500,
    backgroundColor: '#0f172a',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: getPreloadPath(),
      webSecurity: false,
    },
    show: false,
  });

  log('Loading content...');
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    log(`Loading dev URL: ${MAIN_WINDOW_VITE_DEV_SERVER_URL}`);
    await mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    const filePath = path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`);
    log(`Loading file: ${filePath}`);
    await mainWindow.loadFile(filePath);
  }

  mainWindow.webContents.openDevTools({ mode: 'bottom' });
  log('Showing window...');
  mainWindow.show();
  mainWindow.focus();
  log('Window visible!');

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

async function initialize(): Promise<void> {
  log('--- App initializing ---');
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
}

log('--- App starting ---');
app.whenReady().then(initialize).catch((err) => {
  log(`FATAL: ${err instanceof Error ? err.stack : String(err)}`);
  app.quit();
});

app.on('window-all-closed', () => {
  app.quit();
});

app.on('before-quit', () => {
  systemMonitor.stop();
  processMonitor.stop();
  memoryTracker.stop();
  optimizer.stop();
});
