import { app, BrowserWindow, Menu } from 'electron';
import path from 'path';
import fs from 'fs';
import { SystemMonitor } from './services/system-monitor';
import { ProcessMonitor } from './services/process-monitor';
import { MemoryTracker } from './services/memory-tracker';
import { ProtectionStore } from './services/protection-store';
import { ProcessGuardian } from './services/process-guardian';
import { PortScanner } from './services/port-scanner';
import { DevServerManager } from './services/dev-server-manager';
import { Optimizer } from './services/optimizer';
import { HookGenerator } from './services/hook-generator';
import { StartupManager } from './services/startup-manager';
import { EnvReader } from './services/env-reader';
import { DiskCleaner } from './services/disk-cleaner';
import { DiskVirtualizer } from './services/disk-virtualizer';
import { RefileRegistry } from './services/refile/refile-registry';
import { RefileWatcher } from './services/refile-watcher';
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

const protectionStore = new ProtectionStore();
const systemMonitor = new SystemMonitor();
const processMonitor = new ProcessMonitor();
const memoryTracker = new MemoryTracker(processMonitor);
const processGuardian = new ProcessGuardian(processMonitor, protectionStore);
const portScanner = new PortScanner(processMonitor);
const devServerManager = new DevServerManager(portScanner, protectionStore);
const optimizer = new Optimizer(systemMonitor, processMonitor, memoryTracker, protectionStore);
const hookGenerator = new HookGenerator(protectionStore);
const startupManager = new StartupManager();
const envReader = new EnvReader();
const diskCleaner = new DiskCleaner();
const diskVirtualizer = new DiskVirtualizer();
const refileRegistry = new RefileRegistry();
diskVirtualizer.setRegistry(refileRegistry);
const refileWatcher = new RefileWatcher(diskVirtualizer);

function getPreloadPath(): string {
  // Forge Vite plugin provides the correct path at build time
  if (typeof MAIN_WINDOW_PRELOAD_VITE_ENTRY === 'string' && MAIN_WINDOW_PRELOAD_VITE_ENTRY) {
    log(`Preload (Forge): ${MAIN_WINDOW_PRELOAD_VITE_ENTRY}`);
    return MAIN_WINDOW_PRELOAD_VITE_ENTRY;
  }
  // Fallback for packaged builds
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
  Menu.setApplicationMenu(null);

  mainWindow = new BrowserWindow({
    width: 1000,
    height: 700,
    minWidth: 700,
    minHeight: 500,
    frame: false,
    backgroundColor: '#121212',
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
    protectionStore,
    processGuardian,
    portScanner,
    devServerManager,
    hookGenerator,
    startupManager,
    envReader,
    diskCleaner,
    diskVirtualizer,
    refileRegistry,
    refileWatcher,
    getMainWindow: () => mainWindow,
  });

  protectionStore.start();
  systemMonitor.start();
  processMonitor.start();
  memoryTracker.start();
  processGuardian.start();
  portScanner.start();
  devServerManager.start();
  optimizer.start();

  const registryFile = path.join(app.getPath('userData'), 'refile-registry.json');
  const registryIsNew = !fs.existsSync(registryFile);
  refileRegistry.start();
  refileWatcher.start();

  if (registryIsNew) {
    const watchPaths = refileWatcher.getFolders().filter((f) => f.enabled).map((f) => f.path);
    if (watchPaths.length > 0) refileRegistry.scanFolders(watchPaths);
  }

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
  // Stop notification sources first to prevent burst during shutdown
  refileWatcher.stop();
  processGuardian.stop();
  devServerManager.stop();
  optimizer.stop();
  portScanner.stop();
  memoryTracker.stop();
  processMonitor.stop();
  systemMonitor.stop();
  protectionStore.stop();
});
