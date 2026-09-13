const fs = require('fs');
const path = require('path');
const os = require('os');
const net = require('net');
const { execFile, spawn } = require('child_process');

/**
 * Print raw ESC/POS buffer directly to a Windows Printer via winspool.drv P/Invoke
 */
function printRawWin32(printerName, buffer) {
  return new Promise((resolve, reject) => {
    const tempFile = path.join(os.tmpdir(), `degust_print_${Date.now()}_${Math.random().toString(36).substring(7)}.bin`);

    try {
      fs.writeFileSync(tempFile, buffer);
    } catch (err) {
      return reject(new Error(`Falha ao criar arquivo temporário de impressão: ${err.message}`));
    }

    const psScript = `
$code = @"
using System;
using System.IO;
using System.Runtime.InteropServices;

public class RawPrinterHelper {
    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Ansi)]
    public class DOCINFOA {
        [MarshalAs(UnmanagedType.LPStr)] public string pDocName;
        [MarshalAs(UnmanagedType.LPStr)] public string pOutputFile;
        [MarshalAs(UnmanagedType.LPStr)] public string pDataType;
    }
    [DllImport("winspool.Drv", EntryPoint = "OpenPrinterA", SetLastError = true, CharSet = CharSet.Ansi, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    public static extern bool OpenPrinter([MarshalAs(UnmanagedType.LPStr)] string szPrinter, out IntPtr hPrinter, IntPtr pd);

    [DllImport("winspool.Drv", EntryPoint = "ClosePrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    public static extern bool ClosePrinter(IntPtr hPrinter);

    [DllImport("winspool.Drv", EntryPoint = "StartDocPrinterA", SetLastError = true, CharSet = CharSet.Ansi, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    public static extern bool StartDocPrinter(IntPtr hPrinter, Int32 level, [In, MarshalAs(UnmanagedType.LPStruct)] DOCINFOA di);

    [DllImport("winspool.Drv", EntryPoint = "EndDocPrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    public static extern bool EndDocPrinter(IntPtr hPrinter);

    [DllImport("winspool.Drv", EntryPoint = "StartPagePrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    public static extern bool StartPagePrinter(IntPtr hPrinter);

    [DllImport("winspool.Drv", EntryPoint = "EndPagePrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    public static extern bool EndPagePrinter(IntPtr hPrinter);

    [DllImport("winspool.Drv", EntryPoint = "WritePrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    public static extern bool WritePrinter(IntPtr hPrinter, IntPtr pBytes, Int32 dwCount, out Int32 dwWritten);

    public static bool SendFileToPrinter(string szPrinterName, string szFileName) {
        byte[] bytes = File.ReadAllBytes(szFileName);
        IntPtr hPrinter = new IntPtr(0);
        DOCINFOA di = new DOCINFOA();
        di.pDocName = "Degust ESCPOS Document";
        di.pDataType = "RAW";
        if (OpenPrinter(szPrinterName, out hPrinter, IntPtr.Zero)) {
            if (StartDocPrinter(hPrinter, 1, di)) {
                if (StartPagePrinter(hPrinter)) {
                    IntPtr pUnmanagedBytes = Marshal.AllocCoTaskMem(bytes.Length);
                    Marshal.Copy(bytes, 0, pUnmanagedBytes, bytes.Length);
                    int dwWritten = 0;
                    bool bSuccess = WritePrinter(hPrinter, pUnmanagedBytes, bytes.Length, out dwWritten);
                    Marshal.FreeCoTaskMem(pUnmanagedBytes);
                    EndPagePrinter(hPrinter);
                    EndDocPrinter(hPrinter);
                    ClosePrinter(hPrinter);
                    return bSuccess;
                }
                EndDocPrinter(hPrinter);
            }
            ClosePrinter(hPrinter);
        }
        return false;
    }
}
"@
Add-Type -TypeDefinition $code
$printer = "$([char]34)${printerName.replace(/"/g, '""')}$([char]34)"
$file = "$([char]34)${tempFile.replace(/"/g, '""')}$([char]34)"
$result = [RawPrinterHelper]::SendFileToPrinter("${printerName.replace(/"/g, '""')}", "${tempFile.replace(/"/g, '""')}")
if ($result) { write-host "OK" } else { write-error "FAIL" }
`;

    const psProcess = spawn('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', psScript]);

    let stdout = '';
    let stderr = '';

    psProcess.stdout.on('data', (data) => { stdout += data.toString(); });
    psProcess.stderr.on('data', (data) => { stderr += data.toString(); });

    psProcess.on('close', (code) => {
      // Clean temp file
      try { fs.unlinkSync(tempFile); } catch (e) { /* ignore */ }

      if (stdout.includes('OK')) {
        resolve({ success: true });
      } else {
        reject(new Error(`Erro ao enviar impressão para ${printerName}: ${stderr || 'Impressora não respondeu'}`));
      }
    });
  });
}

/**
 * Print raw ESC/POS buffer directly to a TCP socket (Ethernet / Wi-Fi printer)
 */
function printSocketTCP(host, port, buffer) {
  return new Promise((resolve, reject) => {
    const targetPort = port || 9100;
    const client = new net.Socket();

    client.setTimeout(6000);

    client.connect(targetPort, host, () => {
      client.write(buffer, () => {
        client.end();
        resolve({ success: true });
      });
    });

    client.on('error', (err) => {
      client.destroy();
      reject(new Error(`Erro de conexão com impressora em ${host}:${targetPort}: ${err.message}`));
    });

    client.on('timeout', () => {
      client.destroy();
      reject(new Error(`Tempo limite esgotado ao tentar conectar com ${host}:${targetPort}`));
    });
  });
}

module.exports = {
  printRawWin32,
  printSocketTCP,
};
