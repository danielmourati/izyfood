/**
 * Printer connection service — Web Bluetooth + browser fallback.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
import qz from 'qz-tray';

const PRINTER_SERVICE_UUIDS = [
  '000018f0-0000-1000-8000-00805f9b34fb', // generic thermal
  '0000ff00-0000-1000-8000-00805f9b34fb', // common 1
  '0000ff01-0000-1000-8000-00805f9b34fb', // common 2
  '0000af30-0000-1000-8000-00805f9b34fb', // some older ones
  'e7e11001-49d2-4d03-8012-1081a571b052', // specialized
  '49535343-fe7d-4ae5-8fa9-9fafd205e455', // BLE serial
];

const PRINTER_CHAR_UUIDS = [
  '00002af1-0000-1000-8000-00805f9b34fb',
  '0000ff02-0000-1000-8000-00805f9b34fb',
  '49535343-8841-43f4-a8d4-ecbe34729bb3',
  '0000ae01-0000-1000-8000-00805f9b34fb',
];

let _device: any = null;
let _characteristic: any = null;

/**
 * Check if Web Bluetooth API is available.
 */
export function isBluetoothAvailable(): boolean {
  return typeof navigator !== 'undefined' && !!(navigator as any).bluetooth;
}

/**
 * Request and connect to a Bluetooth thermal printer.
 * Returns the device name or throws on failure.
 */
export async function connectBluetooth(): Promise<string> {
  const bt = (navigator as any).bluetooth;
  if (!bt) throw new Error('Web Bluetooth não suportado neste navegador.');

  // Try to find already authorized devices first
  if (bt.getDevices) {
    const devices = await bt.getDevices();
    if (devices.length > 0) {
      // Use the first one or try to match by name if we stored it
      const device = devices[0];
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          const name = await _connectToDevice(device);
          return name;
        } catch (err) {
          console.warn(`Tentativa ${attempt} de reconectar falhou:`, err);
          if (attempt < 3) await new Promise(r => setTimeout(r, 2000));
        }
      }
    }
  }

  // We use acceptAllDevices because thermal printers often don't advertise 
  // their services in a standard way that filters correctly in all browsers.
  const device = await bt.requestDevice({
    acceptAllDevices: true,
    optionalServices: PRINTER_SERVICE_UUIDS,
  });

  return _connectToDevice(device);
}

/**
 * Try to automatically reconnect to the last paired device on load.
 * Does not throw on failure, silently ignores.
 */
export async function tryReconnectBluetooth(): Promise<string | null> {
  const bt = (navigator as any).bluetooth;
  if (!bt || !bt.getDevices) return null;

  try {
    const devices = await bt.getDevices();
    if (devices.length > 0) {
      const device = devices[0];
      
      // Tentar reconectar com retentativas (impressoras térmicas demoram a voltar a anunciar o GATT após reload)
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          console.log(`Tentativa ${attempt} de auto-reconexão Bluetooth ao dispositivo ${device.name}...`);
          const name = await _connectToDevice(device);
          return name;
        } catch (err) {
          console.warn(`Falha na tentativa ${attempt} de auto-reconexão:`, err);
          if (attempt < 3) {
            // Aguardar 2 segundos antes de tentar de novo
            await new Promise(r => setTimeout(r, 2000));
          }
        }
      }
    }
  } catch (err) {
    console.warn('Erro ao acessar dispositivos Bluetooth pareados:', err);
  }
  return null;
}

/**
 * Shared connection logic for requested or retrieved device.
 */
async function _connectToDevice(device: any): Promise<string> {
  if (!device.gatt) throw new Error('Dispositivo não suporta GATT.');

  const server = await device.gatt.connect();

  // Try each known service / characteristic
  for (const svcUuid of PRINTER_SERVICE_UUIDS) {
    try {
      const service = await server.getPrimaryService(svcUuid);
      for (const charUuid of PRINTER_CHAR_UUIDS) {
        try {
          const char = await service.getCharacteristic(charUuid);
          _device = device;
          _characteristic = char;
          return device.name || 'Impressora Bluetooth';
        } catch { /* try next */ }
      }
      // If specific chars not found, try first writable
      const chars = await service.getCharacteristics();
      for (const c of chars) {
        if (c.properties.write || c.properties.writeWithoutResponse) {
          _device = device;
          _characteristic = c;
          return device.name || 'Impressora Bluetooth';
        }
      }
    } catch { /* try next service */ }
  }

  throw new Error('Nenhuma característica de escrita encontrada na impressora.');
}

/**
 * Disconnect current Bluetooth device.
 */
export function disconnectBluetooth(): void {
  if (_device?.gatt?.connected) _device.gatt.disconnect();
  _device = null;
  _characteristic = null;
}

/**
 * Check if a Bluetooth printer is currently connected.
 */
export function isBluetoothConnected(): boolean {
  return !!_device?.gatt?.connected && !!_characteristic;
}

/**
 * Send raw ESC/POS bytes via Bluetooth.
 * Splits into 512-byte chunks for BLE reliability.
 */
export async function printViaBluetooth(data: Uint8Array): Promise<void> {
  if (!_characteristic) throw new Error('Impressora não conectada.');

  const CHUNK = 512;
  for (let i = 0; i < data.length; i += CHUNK) {
    const chunk = data.slice(i, i + CHUNK);
    if (_characteristic.properties.writeWithoutResponse) {
      await _characteristic.writeValueWithoutResponse(chunk);
    } else {
      await _characteristic.writeValueWithResponse(chunk);
    }
    // Small delay between chunks
    if (i + CHUNK < data.length) {
      await new Promise(r => setTimeout(r, 50));
    }
  }
}

// ---- QZ Tray Integration ----

let _qzConnected = false;

/**
 * Check if QZ Tray is available and connect.
 */
export async function initQzTray(): Promise<boolean> {
  if (_qzConnected && qz.websocket.isActive()) return true;
  
  try {
    if (!qz.websocket.isActive()) {
      await qz.websocket.connect({ host: 'localhost', retries: 2, delay: 1 });
    }
    _qzConnected = true;
    return true;
  } catch (err) {
    console.warn('QZ Tray não está em execução ou acessível:', err);
    _qzConnected = false;
    return false;
  }
}

export function isQzConnected(): boolean {
  return _qzConnected && qz.websocket.isActive();
}

/**
 * Get all system printers via QZ Tray.
 */
export async function getQzPrinters(): Promise<string[]> {
  if (!isQzConnected()) return [];
  try {
    return await qz.printers.find();
  } catch (e) {
    console.error('Erro ao buscar impressoras QZ:', e);
    return [];
  }
}

/**
 * Print ESC/POS bytes via QZ Tray.
 */
export async function printViaQzTray(data: Uint8Array, printerName?: string): Promise<void> {
  if (!isQzConnected()) throw new Error('QZ Tray não conectado.');

  // Find the printer
  const printers = await qz.printers.find();
  if (printers.length === 0) throw new Error('Nenhuma impressora encontrada no sistema.');

  let targetPrinter = printers[0]; // fallback to default
  if (printerName && printerName !== 'SYSTEM_BROWSER') {
    // try to match exactly or partially
    const match = printers.find((p: string) => p.toLowerCase() === printerName.toLowerCase()) 
      || printers.find((p: string) => p.toLowerCase().includes(printerName.toLowerCase()));
    if (match) targetPrinter = match;
  }

  // qz.print needs data in hex format for raw bytes
  const hexData = Array.from(data).map(b => b.toString(16).padStart(2, '0')).join('');

  const config = qz.configs.create(targetPrinter);
  await qz.print(config, [
    { type: 'raw', format: 'hex', data: hexData }
  ]);
}

/**
 * Fallback: open a formatted HTML receipt in a new window and trigger print.
 */
export function printViaHtmlFallback(
  htmlContent: string, 
  title = 'Impressão', 
  paperWidth = 80
): void {
  const win = window.open('', '_blank', 'width=320,height=600');
  if (!win) {
    alert('Por favor, permita popups para imprimir.');
    return;
  }

  const printWidth = paperWidth === 58 ? '197px' : '280px';

  win.document.write(`
    <html><head><title>${title}</title>
    <style>
      body { 
        font-family: 'Courier New', monospace; 
        font-size: 13px; 
        margin: 0; 
        padding: 0 16px; 
        width: ${printWidth}; 
        box-sizing: border-box; 
        overflow-x: hidden;
      }
      .line { border-top: 1px dashed #000; margin: 6px 0; width: 100%; }
      .center { text-align: center; }
      .row { display: flex; justify-content: space-between; gap: 2px; }
      .bold { font-weight: bold; }
      .big { font-size: 16px; font-weight: bold; text-align: center; margin: 8px 0; }
      .mb-1 { margin-bottom: 4px; }
      @media print { 
        body { width: ${printWidth}; padding: 0 16px; }
        @page { margin: 0; size: ${paperWidth}mm auto; }
      }
    </style></head><body>${htmlContent}</body></html>
  `);
  win.document.close();
  win.focus();
  
  // Use a delay to ensure document is parsed and images/styles are ready
  setTimeout(() => {
    win.print();
    // On some mobiles, closing immediately cancels print
    setTimeout(() => win.close(), 500);
  }, 500);
}
