const { app, BrowserWindow, ipcMain, Menu } = require('electron');
const path = require('path');
const { printRawWin32, printSocketTCP } = require('./printer-win32.cjs');

let mainWindow = null;

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 600,
    title: 'IzyFood / Degust - PDV & Gestão',
    icon: path.join(__dirname, '../public/favicon.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false, // Permite conexões locais e HTTP para dev/Supabase
    },
  });

  // Oculta menu padrão do Electron
  Menu.setApplicationMenu(null);

  if (isDev) {
    const devUrl = process.env.VITE_DEV_SERVER_URL || 'http://localhost:8080';
    console.log(`[Electron] Carregando servidor de desenvolvimento: ${devUrl}`);
    mainWindow.loadURL(devUrl);
    // mainWindow.webContents.openDevTools();
  } else {
    console.log('[Electron] Carregando dist/index.html...');
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Bloqueia múltiplas instâncias
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(() => {
    createWindow();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// IPC Handlers
ipcMain.handle('get-printers', async () => {
  if (!mainWindow) return [];
  try {
    const list = await mainWindow.webContents.getPrintersAsync();
    return list.map((p) => ({
      name: p.name,
      displayName: p.displayName || p.name,
      isDefault: p.isDefault,
      status: p.status,
    }));
  } catch (err) {
    console.error('[Electron IPC] Erro ao listar impressoras:', err);
    return [];
  }
});

ipcMain.handle('print-raw', async (event, { printerName, bytesArray }) => {
  try {
    const buffer = Buffer.from(bytesArray);
    const result = await printRawWin32(printerName, buffer);
    return { success: true, result };
  } catch (err) {
    console.error('[Electron IPC] Erro ao imprimir RAW:', err);
    throw new Error(err.message || 'Falha ao imprimir na impressora local.');
  }
});

ipcMain.handle('print-socket', async (event, { host, port, bytesArray }) => {
  try {
    const buffer = Buffer.from(bytesArray);
    const result = await printSocketTCP(host, port, buffer);
    return { success: true, result };
  } catch (err) {
    console.error('[Electron IPC] Erro ao imprimir Socket:', err);
    throw new Error(err.message || 'Falha ao imprimir na impressora de rede.');
  }
});
