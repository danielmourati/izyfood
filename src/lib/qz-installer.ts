/**
 * QZ Tray installer helpers.
 *
 * Generates a Windows .bat that copies the tenant cert.pem into the QZ Tray
 * `override.crt` file so the local agent auto-trusts messages signed by Degust.
 * Also exposes a helper to fetch the tenant PEM from the qz-cert edge function.
 */
import { supabase } from '@/integrations/supabase/client';

let cachedCert: { tenantId: string; pem: string; tenantName: string } | null = null;

export async function fetchTenantCertPem(tenantId?: string): Promise<{ pem: string; tenantName: string }> {
  if (cachedCert && tenantId && cachedCert.tenantId === tenantId) {
    return { pem: cachedCert.pem, tenantName: cachedCert.tenantName };
  }
  const { data, error } = await supabase.functions.invoke('qz-cert', { body: {} });
  if (error) throw new Error(error.message || 'Falha ao obter certificado.');
  const pem = (data as any)?.cert_pem as string | undefined;
  const tenantName = ((data as any)?.tenant_name as string | undefined) || 'Degust';
  if (!pem) throw new Error('Resposta inválida do servidor de certificados.');
  if (tenantId) cachedCert = { tenantId, pem, tenantName };
  return { pem, tenantName };
}

function escapeBatLine(line: string): string {
  // Escape special .bat characters so echo prints the raw PEM line.
  return line
    .replace(/\^/g, '^^')
    .replace(/&/g, '^&')
    .replace(/</g, '^<')
    .replace(/>/g, '^>')
    .replace(/\|/g, '^|')
    .replace(/%/g, '%%');
}

export function buildMenuzinBat(opts: { tenantName: string; certPem: string }): string {
  const { tenantName, certPem } = opts;
  const lines = certPem
    .replace(/\r/g, '')
    .split('\n')
    .filter((l) => l.length > 0)
    .map((l) => `echo ${escapeBatLine(l)}>>"%CERTFILE%"`);

  return [
    '@echo off',
    'setlocal',
    `REM Menuzin/Degust - configurador QZ Tray para ${tenantName}`,
    'title Menuzin QZ Setup',
    '',
    'net session >nul 2>&1',
    'if %errorlevel% neq 0 (',
    '  echo Este instalador precisa ser executado como Administrador.',
    '  echo Feche esta janela, clique com o botao direito no arquivo e escolha',
    '  echo "Executar como administrador".',
    '  pause',
    '  exit /b 1',
    ')',
    '',
    'set "QZDIR=%ProgramFiles%\\QZ Tray"',
    'if not exist "%QZDIR%" set "QZDIR=%ProgramFiles(x86)%\\QZ Tray"',
    'if not exist "%QZDIR%" (',
    '  echo QZ Tray nao encontrado. Instale primeiro em https://qz.io/download/',
    '  pause',
    '  exit /b 1',
    ')',
    '',
    'if not exist "%QZDIR%\\auth" mkdir "%QZDIR%\\auth"',
    'set "CERTFILE=%QZDIR%\\auth\\override.crt"',
    'if exist "%CERTFILE%" del /F /Q "%CERTFILE%"',
    '',
    ...lines,
    '',
    'echo Certificado instalado em %CERTFILE%',
    '',
    'echo Reiniciando o servico do QZ Tray...',
    'net stop "QZ Tray" >nul 2>&1',
    'net start "QZ Tray" >nul 2>&1',
    '',
    'echo.',
    'echo ================================================================',
    `echo   Pronto! O QZ Tray agora confia no certificado da loja ${tenantName}.`,
    'echo   Volte ao Degust e clique em "Testar de novo".',
    'echo ================================================================',
    'echo.',
    'pause',
    'endlocal',
    '',
  ].join('\r\n');
}

function triggerDownload(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function downloadMenuzinBat(tenantName: string, certPem: string) {
  const bat = buildMenuzinBat({ tenantName, certPem });
  triggerDownload('menuzin-qz-setup.bat', bat, 'application/bat');
}

export function downloadCertPem(certPem: string) {
  triggerDownload('cert.pem', certPem, 'application/x-pem-file');
}
