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
let _keepAliveTimer: any = null;
let _reconnecting = false;
let _disconnectHandlerAttached = false;
let _autoReconnectStarted = false;
let _autoReconnectTimer: any = null;

const KEEPALIVE_INTERVAL_MS = 15000; // verifica a cada 15s
const RECONNECT_BACKOFF_MS = 2000;
const AUTO_RECONNECT_INTERVAL_MS = 30000; // tenta a cada 30s enquanto desconectado

const LS_LAST_NAME = 'bt_last_device_name';
const LS_LAST_ID = 'bt_last_device_id';

function _saveLastDevice(device: any) {
  try {
    if (device?.name) localStorage.setItem(LS_LAST_NAME, device.name);
    if (device?.id) localStorage.setItem(LS_LAST_ID, device.id);
  } catch { /* ignore */ }
}

export function getLastPairedDeviceName(): string | null {
  try { return localStorage.getItem(LS_LAST_NAME); } catch { return null; }
}

export function forgetBluetoothDevice() {
  try {
    localStorage.removeItem(LS_LAST_NAME);
    localStorage.removeItem(LS_LAST_ID);
  } catch { /* ignore */ }
  disconnectBluetooth();
}

function _emitStatus(connected: boolean, name?: string | null) {
  try {
    window.dispatchEvent(new CustomEvent('bt_status', { detail: { connected, name: name || null } }));
  } catch { /* ignore */ }
}

async function _reconnectCurrentDevice(): Promise<boolean> {
  if (!_device || _reconnecting) return false;
  _reconnecting = true;
  try {
    const name = await _connectToDevice(_device);
    console.info('[bt] reconectado:', name);
    return true;
  } catch (err) {
    console.warn('[bt] falha ao reconectar:', err);
    return false;
  } finally {
    _reconnecting = false;
  }
}

function _attachDisconnectHandler(device: any) {
  if (_disconnectHandlerAttached) return;
  _disconnectHandlerAttached = true;
  device.addEventListener('gattserverdisconnected', async () => {
    console.warn('[bt] gattserverdisconnected — tentando reconectar...');
    _characteristic = null;
    _emitStatus(false, device?.name);
    // Backoff antes de tentar
    setTimeout(() => { _reconnectCurrentDevice(); }, RECONNECT_BACKOFF_MS);
  });
}

function _startKeepAlive() {
  if (_keepAliveTimer) return;
  _keepAliveTimer = setInterval(async () => {
    if (!_device) return;
    const connected = !!_device.gatt?.connected && !!_characteristic;
    if (!connected && !_reconnecting) {
      console.info('[bt] keepalive detectou desconexão, reconectando...');
      await _reconnectCurrentDevice();
    }
  }, KEEPALIVE_INTERVAL_MS);
}

export function stopBluetoothKeepAlive() {
  if (_keepAliveTimer) {
    clearInterval(_keepAliveTimer);
    _keepAliveTimer = null;
  }
}

/** Garante conexão antes de imprimir; tenta reconectar se necessário. */
export async function ensureBluetoothConnected(): Promise<boolean> {
  if (isBluetoothConnected()) return true;
  if (!_device) return false;
  return await _reconnectCurrentDevice();
}

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
export async function connectBluetooth(options: { forcePairing?: boolean } = {}): Promise<string> {
  const bt = (navigator as any).bluetooth;
  if (!bt) throw new Error('Web Bluetooth não suportado neste navegador.');

  // Try to find already authorized devices first
  if (!options.forcePairing && bt.getDevices) {
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
    if (!devices || devices.length === 0) return null;

    // Prioriza o último device salvo (por id ou nome)
    const lastId = (() => { try { return localStorage.getItem(LS_LAST_ID); } catch { return null; } })();
    const lastName = getLastPairedDeviceName();

    const sorted = [...devices].sort((a: any, b: any) => {
      const score = (d: any) => (lastId && d.id === lastId ? 2 : 0) + (lastName && d.name === lastName ? 1 : 0);
      return score(b) - score(a);
    });

    for (const device of sorted) {
      // Watcher para reconectar assim que voltar a anunciar
      const onAdv = async () => {
        try { await _connectToDevice(device); } catch { /* ignore */ }
      };
      try {
        device.addEventListener('advertisementreceived', onAdv);
        await device.watchAdvertisements();
      } catch (e) {
        // watchAdvertisements pode não estar disponível — ignora
      }

      // Tenta conectar imediatamente
      try {
        const name = await _connectToDevice(device);
        return name;
      } catch (err) {
        console.warn('[bt] auto-reconexão falhou para', device.name || device.id, err);
      }
    }
  } catch (err) {
    console.warn('Erro ao acessar dispositivos Bluetooth pareados:', err);
  }
  return null;
}

/**
 * Inicia o loop de auto-reconexão: tenta agora, agenda retries periódicos,
 * e reagenda sempre que a aba voltar a ficar visível ou a rede voltar.
 * Seguro chamar múltiplas vezes — só inicia uma única vez por sessão.
 */
export function startBluetoothAutoReconnect() {
  if (_autoReconnectStarted) return;
  _autoReconnectStarted = true;

  const attempt = async () => {
    if (isBluetoothConnected()) return;
    if (!getLastPairedDeviceName()) return; // nada para reconectar
    try { await tryReconnectBluetooth(); } catch { /* ignore */ }
  };

  // Primeira tentativa imediata
  attempt();

  // Tentativas periódicas
  if (_autoReconnectTimer) clearInterval(_autoReconnectTimer);
  _autoReconnectTimer = setInterval(attempt, AUTO_RECONNECT_INTERVAL_MS);

  // Quando a aba volta a ficar visível
  try {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') attempt();
    });
  } catch { /* ignore */ }

  // Quando a rede volta
  try {
    window.addEventListener('online', () => { attempt(); });
  } catch { /* ignore */ }
}


/**
 * Shared connection logic for requested or retrieved device.
 */
async function _connectToDevice(device: any): Promise<string> {
  if (!device.gatt) throw new Error('Dispositivo não suporta GATT.');

  const server = device.gatt.connected ? device.gatt : await device.gatt.connect();

  // Try each known service / characteristic
  for (const svcUuid of PRINTER_SERVICE_UUIDS) {
    try {
      const service = await server.getPrimaryService(svcUuid);
      for (const charUuid of PRINTER_CHAR_UUIDS) {
        try {
          const char = await service.getCharacteristic(charUuid);
          _device = device;
          _characteristic = char;
          const deviceName = device.name || 'Impressora Bluetooth';
          _attachDisconnectHandler(device);
          _startKeepAlive();
          _saveLastDevice(device);
          window.dispatchEvent(new CustomEvent('bt_connected', { detail: { name: deviceName } }));
          _emitStatus(true, deviceName);
          return deviceName;
        } catch { /* try next */ }
      }
      // If specific chars not found, try first writable
      const chars = await service.getCharacteristics();
      for (const c of chars) {
        if (c.properties.write || c.properties.writeWithoutResponse) {
          _device = device;
          _characteristic = c;
          const deviceName = device.name || 'Impressora Bluetooth';
          _attachDisconnectHandler(device);
          _startKeepAlive();
          _saveLastDevice(device);
          window.dispatchEvent(new CustomEvent('bt_connected', { detail: { name: deviceName } }));
          _emitStatus(true, deviceName);
          return deviceName;
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
  stopBluetoothKeepAlive();
  if (_device?.gatt?.connected) _device.gatt.disconnect();
  _device = null;
  _characteristic = null;
  _disconnectHandlerAttached = false;
  _emitStatus(false, null);
}

/**
 * Check if a Bluetooth printer is currently connected.
 */
export function isBluetoothConnected(): boolean {
  return !!_device?.gatt?.connected && !!_characteristic;
}

export function getBluetoothDeviceName(): string | null {
  return _device?.name || (_device ? 'Impressora Bluetooth' : null);
}

/**
 * Send raw ESC/POS bytes via Bluetooth.
 * Splits into 256-byte chunks for BLE reliability and auto-reconecta se cair.
 */
export async function printViaBluetooth(data: Uint8Array): Promise<void> {
  // Garante conexão (reconecta se necessário) antes de imprimir
  if (!isBluetoothConnected()) {
    const ok = await ensureBluetoothConnected();
    if (!ok || !_characteristic) throw new Error('Impressora não conectada.');
  }

  const CHUNK = 256;
  try {
    for (let i = 0; i < data.length; i += CHUNK) {
      const chunk = data.slice(i, i + CHUNK);
      if (_characteristic.properties.writeWithoutResponse) {
        await _characteristic.writeValueWithoutResponse(chunk);
      } else {
        await _characteristic.writeValueWithResponse(chunk);
      }
      if (i + CHUNK < data.length) {
        await new Promise(r => setTimeout(r, 100));
      }
    }
  } catch (err) {
    // Se cair no meio, tenta reconectar uma vez e reenviar
    console.warn('[bt] erro durante impressão, tentando reconectar e reenviar:', err);
    const ok = await ensureBluetoothConnected();
    if (!ok || !_characteristic) throw err;
    for (let i = 0; i < data.length; i += CHUNK) {
      const chunk = data.slice(i, i + CHUNK);
      if (_characteristic.properties.writeWithoutResponse) {
        await _characteristic.writeValueWithoutResponse(chunk);
      } else {
        await _characteristic.writeValueWithResponse(chunk);
      }
      if (i + CHUNK < data.length) {
        await new Promise(r => setTimeout(r, 100));
      }
    }
  }
}

// ---- QZ Tray Integration ----

let _qzConnected = false;
let _qzSecurityConfigured = false;

async function configureQzSecurity() {
  if (_qzSecurityConfigured) return;
  _qzSecurityConfigured = true;
  try {
    const { fetchTenantCertPem } = await import('./qz-installer');
    const { supabase } = await import('@/integrations/supabase/client');

    qz.security.setCertificatePromise((resolve: any, reject: any) => {
      fetchTenantCertPem()
        .then(({ pem }) => resolve(pem))
        .catch(reject);
    });

    qz.security.setSignatureAlgorithm('SHA512');
    qz.security.setSignaturePromise((toSign: string) => (resolve: any, reject: any) => {
      supabase.functions
        .invoke('qz-sign', { body: { request: toSign } })
        .then(({ data, error }) => {
          if (error) return reject(error);
          const sig = (data as any)?.signature;
          if (!sig) return reject(new Error('Assinatura ausente na resposta.'));
          resolve(sig);
        })
        .catch(reject);
    });
  } catch (e) {
    console.warn('Falha ao configurar assinatura QZ:', e);
    _qzSecurityConfigured = false;
  }
}

/**
 * Check if QZ Tray is available and connect.
 */
export async function initQzTray(): Promise<boolean> {
  if (_qzConnected && qz.websocket.isActive()) return true;

  try {
    await configureQzSecurity();
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
      .line { border-top: 1px dashed #000; margin: 6px -16px; width: calc(100% + 32px); }
      .line-solid { border-top: 2px solid #000; margin: 6px -16px; width: calc(100% + 32px); }
      .center { text-align: center; }
      .row { display: flex; justify-content: space-between; gap: 2px; }
      .bold { font-weight: bold; }
      .big { font-size: 16px; font-weight: bold; text-align: center; margin: 8px 0; }
      .mb-1 { margin-bottom: 4px; }
      .header-text { font-size: 11px; }
      .footer-text { font-size: 12px; }
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
