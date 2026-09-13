const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,

  /**
   * Returns list of OS printers
   */
  getPrinters: async () => {
    return await ipcRenderer.invoke('get-printers');
  },

  /**
   * Print ESC/POS bytes to local Windows printer (Spooler RAW)
   */
  printRaw: async (printerName, bytesArray) => {
    return await ipcRenderer.invoke('print-raw', { printerName, bytesArray });
  },

  /**
   * Print ESC/POS bytes to network TCP printer (IP:Port)
   */
  printSocket: async (host, port, bytesArray) => {
    return await ipcRenderer.invoke('print-socket', { host, port, bytesArray });
  },
});
