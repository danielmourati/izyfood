/**
 * Printer connection service — Web Bluetooth + browser fallback.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

const PRINTER_SERVICE_UUIDS = [
  '000018f0-0000-1000-8000-00805f9b34fb', // common thermal
  '0000ff00-0000-1000-8000-00805f9b34fb', // common BLE
  '49535343-fe7d-4ae5-8fa9-9fafd205e455', // common BLE serial
  'e7e11001-49d2-4d03-8012-1081a571b052', // common SPP
];

const PRINTER_CHAR_UUIDS = [
  '00002af1-0000-1000-8000-00805f9b34fb',
  '0000ff02-0000-1000-8000-00805f9b34fb',
  '49535343-8841-43f4-a8d4-ecbe34729bb3',
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
      try {
        const name = await _connectToDevice(device);
        return name;
      } catch (err) {
        console.warn('Reconnection to authorized device failed:', err);
      }
    }
  }

  let device: any;
  try {
    device = await bt.requestDevice({
      filters: PRINTER_SERVICE_UUIDS.map(uuid => ({ services: [uuid] })),
      optionalServices: PRINTER_SERVICE_UUIDS,
    });
  } catch {
    device = await bt.requestDevice({
      acceptAllDevices: true,
      optionalServices: PRINTER_SERVICE_UUIDS,
    });
  }

  return _connectToDevice(device);
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

/**
 * Fallback: open a formatted HTML receipt in a new window and trigger print.
 */
export function printViaHtmlFallback(htmlContent: string, title = 'Impressão'): void {
  const win = window.open('', '_blank', 'width=320,height=600');
  if (!win) {
    alert('Por favor, permita popups para imprimir.');
    return;
  }
  win.document.write(`
    <html><head><title>${title}</title>
    <style>
      body { font-family: 'Courier New', monospace; font-size: 14px; margin: 0; padding: 10px; width: 100%; box-sizing: border-box; }
      .line { border-top: 1px dashed #000; margin: 6px 0; width: 100%; }
      .center { text-align: center; }
      .row { display: flex; justify-content: space-between; gap: 4px; }
      .bold { font-weight: bold; }
      .big { font-size: 18px; font-weight: bold; text-align: center; margin: 10px 0; }
      .mb-1 { margin-bottom: 4px; }
      @media print { 
        body { width: 300px; padding: 0; }
        @page { margin: 0; }
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
