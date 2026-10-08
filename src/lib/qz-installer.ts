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

export function buildDegustBat(opts: { tenantName: string; certPem: string }): string {
  const { certPem } = opts;
  const lines = certPem
    .replace(/\r/g, '')
    .split('\n')
    .filter((l) => l.length > 0)
    .map((l) => `>>"%PEMFILE%" echo ${escapeBatLine(l)}`);

  return [
    '@echo off',
    'setlocal EnableExtensions',
    'REM Degust / Menuzin - configurador QZ Tray (todas as lojas)',
    'title Degust / Menuzin QZ Setup',
    '',
    'net session >nul 2>&1',
    'if %errorlevel% neq 0 (',
    '  echo Este instalador precisa ser executado como Administrador.',
    '  echo Clique com o botao direito no arquivo e escolha "Executar como administrador".',
    '  pause',
    '  exit /b 1',
    ')',
    '',
    'set "DGDIR=%ProgramData%\\Degust"',
    'if not exist "%DGDIR%" mkdir "%DGDIR%"',
    'set "LOG=%DGDIR%\\qz-setup.log"',
    'set "PEMFILE=%DGDIR%\\degust-cert.pem"',
    '> "%LOG%" echo Degust QZ Setup - %DATE% %TIME%',
    'set "FAILS=0"',
    '',
    'REM ---- 1. Localizar o QZ Tray ----',
    'set "QZDIR="',
    'if exist "%ProgramFiles%\\QZ Tray\\qz-tray.exe" set "QZDIR=%ProgramFiles%\\QZ Tray"',
    'if not defined QZDIR if exist "%ProgramFiles(x86)%\\QZ Tray\\qz-tray.exe" set "QZDIR=%ProgramFiles(x86)%\\QZ Tray"',
    'if not defined QZDIR if exist "%LOCALAPPDATA%\\Programs\\QZ Tray\\qz-tray.exe" set "QZDIR=%LOCALAPPDATA%\\Programs\\QZ Tray"',
    'if not defined QZDIR if exist "%LOCALAPPDATA%\\QZ Tray\\qz-tray.exe" set "QZDIR=%LOCALAPPDATA%\\QZ Tray"',
    'if not defined QZDIR (',
    '  call :say "[FALHOU] QZ Tray nao encontrado. Instale em https://qz.io/download/"',
    '  pause',
    '  exit /b 1',
    ')',
    'call :say "[OK] QZ Tray encontrado em %QZDIR%"',
    'set "QZCON=%QZDIR%\\qz-tray-console.exe"',
    'if not exist "%QZCON%" set "QZCON=%QZDIR%\\qz-tray.exe"',
    'for /f "delims=" %%v in (\'""%QZCON%" --version" 2^>nul\') do set "QZVER=%%v"',
    'if defined QZVER (call :say "[OK] Versao do QZ Tray: %QZVER%") else (call :say "[INFO] Versao do QZ Tray nao identificada")',
    '',
    'REM ---- 2. Fechar o QZ Tray ----',
    'call :say "Fechando o QZ Tray..."',
    'taskkill /IM qz-tray.exe /F >nul 2>&1',
    'taskkill /IM qz-tray-console.exe /F >nul 2>&1',
    'powershell -NoProfile -ExecutionPolicy Bypass -Command "Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -like \'*qz-tray*\' -or $_.CommandLine -like \'*qz.App*\' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }" >nul 2>&1',
    'timeout /t 3 /nobreak >nul',
    '',
    'REM ---- 3. Salvar o certificado ----',
    'if exist "%PEMFILE%" del /F /Q "%PEMFILE%"',
    ...lines,
    'findstr /C:"BEGIN CERTIFICATE" "%PEMFILE%" >nul 2>&1',
    'if %errorlevel%==0 (call :say "[OK] Certificado salvo em %PEMFILE%") else (call :say "[FALHOU] Nao foi possivel salvar o certificado" & set /a FAILS+=1)',
    '',
    'REM ---- 4. Metodo A: override.crt ----',
    'set "OVR=%QZDIR%\\override.crt"',
    'copy /Y "%PEMFILE%" "%OVR%" >nul 2>&1',
    'fc /B "%PEMFILE%" "%OVR%" >nul 2>&1',
    'if %errorlevel%==0 (call :say "[OK] override.crt instalado") else (call :say "[FALHOU] override.crt nao foi gravado" & set /a FAILS+=1)',
    '',
    'REM ---- 5. Metodo B: authcert.override no qz-tray.properties ----',
    'set "PROPS=%QZDIR%\\qz-tray.properties"',
    'powershell -NoProfile -ExecutionPolicy Bypass -Command "$f=$env:PROPS; $line=\'authcert.override=\' + ($env:OVR -replace \'\\\\\',\'/\'); if (Test-Path $f) { $c=@(Get-Content $f | Where-Object { $_ -notmatch \'^authcert\\.override=\' }) } else { $c=@() }; $c += $line; Set-Content -Path $f -Value $c -Encoding ASCII" >>"%LOG%" 2>&1',
    'findstr /B /C:"authcert.override=" "%PROPS%" >nul 2>&1',
    'if %errorlevel%==0 (call :say "[OK] qz-tray.properties atualizado") else (call :say "[FALHOU] qz-tray.properties nao foi atualizado" & set /a FAILS+=1)',
    '',
    'REM ---- 6. Metodo C: lista Allowed do Site Manager ----',
    '"%QZCON%" --allow "%PEMFILE%" >>"%LOG%" 2>&1',
    'if %errorlevel%==0 (',
    '  call :say "[OK] Certificado adicionado a lista Allowed"',
    ') else (',
    '  "%QZCON%" --whitelist "%PEMFILE%" >>"%LOG%" 2>&1',
    '  if errorlevel 1 (call :say "[INFO] Lista Allowed nao atualizada automaticamente - use o passo manual no app") else (call :say "[OK] Certificado adicionado a lista Allowed")',
    ')',
    '',
    'REM ---- 7. Reabrir o QZ Tray como usuario normal ----',
    'call :say "Abrindo o QZ Tray novamente..."',
    'explorer.exe "%QZDIR%\\qz-tray.exe"',
    '',
    'echo.',
    'echo ================================================================',
    'if %FAILS%==0 (',
    '  echo   Pronto! O QZ Tray agora confia no Degust e no Menuzin.',
    '  echo   Aguarde o QZ Tray abrir e clique em "Testar de novo" no app.',
    ') else (',
    '  echo   Algum passo falhou. Use o passo manual mostrado no app',
    '  echo   e, se precisar, envie o arquivo de registro:',
    '  echo   %LOG%',
    ')',
    'echo ================================================================',
    'echo.',
    'pause',
    'endlocal',
    'exit /b 0',
    '',
    ':say',
    'echo %~1',
    '>>"%LOG%" echo %~1',
    'exit /b 0',
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

export function downloadDegustBat(tenantName: string, certPem: string) {
  const bat = buildDegustBat({ tenantName, certPem });
  triggerDownload('degust-qz-setup.bat', bat, 'application/bat');
}

export function downloadCertPem(certPem: string) {
  triggerDownload('cert.pem', certPem, 'application/x-pem-file');
}
