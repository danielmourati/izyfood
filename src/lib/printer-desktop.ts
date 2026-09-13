/* eslint-disable @typescript-eslint/no-explicit-any */

declare global {
  interface Window {
    electronAPI?: {
      isElectron: boolean;
      getPrinters: () => Promise<Array<{ name: string; displayName: string; isDefault: boolean; status: number }>>;
      printRaw: (printerName: string, bytesArray: number[]) => Promise<{ success: boolean }>;
      printSocket: (host: string, port: number, bytesArray: number[]) => Promise<{ success: boolean }>;
    };
  }
}

/**
 * Checks if running inside Desktop Application (Electron)
 */
export function isDesktopApp(): boolean {
  return typeof window !== 'undefined' && !!(window as any).electronAPI?.isElectron;
}

/**
 * Get all installed printers from system OS via Electron IPC
 */
export async function getDesktopPrinters(): Promise<string[]> {
  if (!isDesktopApp()) return [];
  try {
    const list = await window.electronAPI!.getPrinters();
    return list.map((p) => p.name);
  } catch (err) {
    console.error('[Desktop] Erro ao listar impressoras nativas:', err);
    return [];
  }
}

/**
 * Send raw ESC/POS bytes directly to Windows Spooler via Win32 API
 */
export async function printViaDesktopSpooler(data: Uint8Array, printerName: string): Promise<void> {
  if (!isDesktopApp()) throw new Error('Aplicação não está no modo Desktop.');
  const bytesArray = Array.from(data);
  await window.electronAPI!.printRaw(printerName, bytesArray);
}

/**
 * Send raw ESC/POS bytes directly to a Network Printer via TCP Socket (IP:Port)
 */
export async function printViaDesktopSocket(data: Uint8Array, host: string, port = 9100): Promise<void> {
  if (!isDesktopApp()) throw new Error('Aplicação não está no modo Desktop.');
  const bytesArray = Array.from(data);
  await window.electronAPI!.printSocket(host, port, bytesArray);
}
