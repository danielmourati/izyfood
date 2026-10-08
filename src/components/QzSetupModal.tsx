import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Download, ExternalLink, RefreshCw, Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { fetchTenantCertPem, downloadDegustBat, downloadCertPem } from '@/lib/qz-installer';

interface QzSetupModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onTestConnection?: () => Promise<boolean | void>;
}

export function QzSetupModal({ open, onOpenChange, onTestConnection }: QzSetupModalProps) {
  const { user } = useAuth();
  const [certLoading, setCertLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [diag, setDiag] = useState<{ version: string | null; certFingerprint: string | null; signatureOk: boolean | null; lastSignError: string | null } | null>(null);

  const withCert = async (fn: (pem: string, tenantName: string) => void) => {
    setCertLoading(true);
    try {
      const { pem, tenantName } = await fetchTenantCertPem(user?.tenantId);
      fn(pem, tenantName);
    } catch (e: any) {
      setLastError('Falha ao obter certificado: ' + (e?.message || 'Erro de conexão'));
    } finally {
      setCertLoading(false);
    }
  };

  const handleDownloadCert = () => withCert((pem) => downloadCertPem(pem));
  const handleDownloadBat = () => withCert((pem, name) => downloadDegustBat(name, pem));

  const handleTest = async () => {
    setTesting(true);
    setSuccess(false);
    try {
      if (onTestConnection) {
        const result = await onTestConnection();
        const { lastQzError, qzDiagnostics } = await import('@/lib/printer');
        setDiag({ ...qzDiagnostics });
        if (result === false) {
          setLastError(lastQzError || 'QZ Tray não respondeu. Confira se ele está aberto.');
        } else {
          setLastError(null);
          setSuccess(true);
        }
      }
    } catch (e: any) {
      setLastError(e?.message || 'QZ Tray não respondendo.');
    } finally {
      setTesting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl p-6 sm:p-8 rounded-2xl bg-card border border-border text-foreground space-y-6">
        {/* Header */}
        <DialogHeader className="space-y-2 text-left">
          <DialogTitle className="text-2xl font-bold tracking-tight text-foreground">
            Configurar QZ Tray em 3 passos
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            Faça uma vez por máquina. Depois disso, a impressão acontece direto, sem pop-up de autorização.
          </DialogDescription>
        </DialogHeader>

        {/* Step 1 */}
        <div className="flex gap-4 items-start">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-foreground font-semibold text-sm">
            1
          </div>
          <div className="space-y-2 flex-1 pt-0.5">
            <h3 className="font-semibold text-base text-foreground">Instale o QZ Tray</h3>
            <Button
              variant="outline"
              size="sm"
              className="rounded-full gap-2 text-xs font-medium border-border"
              onClick={() => window.open('https://qz.io/download', '_blank')}
            >
              <ExternalLink className="h-3.5 w-3.5" /> qz.io/download
            </Button>
          </div>
        </div>

        {/* Step 2 */}
        <div className="flex gap-4 items-start">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-foreground font-semibold text-sm">
            2
          </div>
          <div className="space-y-3 flex-1 pt-0.5">
            <div>
              <h3 className="font-semibold text-base text-foreground">Baixar Certificado e Auto-configurador</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Baixe o <strong className="text-foreground">cert.pem</strong> (botão 1) e o <strong className="text-foreground">Auto-configurador .bat</strong> (botão 2) na mesma pasta do seu computador.
              </p>
            </div>

            <div className="flex flex-wrap gap-2 pt-1">
              <Button
                onClick={handleDownloadCert}
                disabled={certLoading}
                className="rounded-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-xs gap-2 px-4 shadow-sm"
              >
                {certLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                Baixar cert.pem (Todos os sistemas)
              </Button>
              <Button
                onClick={handleDownloadBat}
                disabled={certLoading}
                variant="outline"
                className="rounded-full border-border font-semibold text-xs gap-2 px-4"
              >
                {certLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                Auto-configurador (Windows .bat)
              </Button>
            </div>

            <div className="rounded-2xl bg-amber-500/10 border border-amber-500/20 p-4 text-xs text-amber-800 dark:text-amber-300 leading-relaxed">
              <p>
                <strong>• No Windows:</strong> Certifique-se de baixar ambos os arquivos na <strong>mesma pasta</strong>. Em seguida, clique com o botão direito sobre o arquivo <code className="bg-amber-500/20 px-1 py-0.5 rounded text-amber-900 dark:text-amber-100 font-mono text-[11px]">degust-qz-setup.bat</code> e selecione <strong>"Executar como administrador"</strong>.
              </p>
            </div>
          </div>
        </div>

        {/* Step 3 */}
        <div className="flex gap-4 items-start">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-foreground font-semibold text-sm">
            3
          </div>
          <div className="space-y-1 flex-1 pt-0.5">
            <h3 className="font-semibold text-base text-foreground">
              Aguarde o QZ Tray reabrir e clique em <em>Testar de novo</em>
            </h3>
            <p className="text-xs text-muted-foreground">
              O configurador fecha e abre o QZ Tray sozinho. Se aparecer "Unrecognized Certificate", clique em <strong>Sim</strong> e autorize como administrador; depois feche e abra o QZ Tray. O certificado vale para todas as lojas Degust e Menuzin deste computador — uma única instalação configura os dois aplicativos.
            </p>
          </div>
        </div>

        {/* Manual fallback */}
        <div className="rounded-2xl border border-border bg-muted/40 p-4 space-y-2">
          <h3 className="font-semibold text-sm text-foreground">Se o alerta "Untrusted website" continuar</h3>
          <ol className="list-decimal pl-5 space-y-1 text-xs text-muted-foreground">
            <li>Baixe o <strong className="text-foreground">cert.pem</strong> (botão acima).</li>
            <li>Clique com o botão direito no ícone do QZ Tray, perto do relógio do Windows.</li>
            <li>Abra <strong className="text-foreground">Advanced &gt; Site Manager</strong>.</li>
            <li>Na aba <strong className="text-foreground">Allowed</strong>, clique no <strong className="text-foreground">+</strong> azul e escolha o arquivo <strong className="text-foreground">cert.pem</strong>.</li>
            <li>Clique em <strong className="text-foreground">Close</strong> e depois em <em>Testar de novo</em>.</li>
          </ol>
          <p className="text-[11px] text-muted-foreground">
            O registro do configurador fica em <code className="font-mono">C:\ProgramData\Degust\qz-setup.log</code>.
          </p>
        </div>

        {(lastError || success || diag) && (
          <div className="rounded-2xl border border-border p-4 space-y-2 text-xs">
            {success && (
              <p className="flex items-center gap-2 font-semibold text-primary">
                <CheckCircle2 className="h-4 w-4" /> QZ Tray conectado e validado com sucesso!
              </p>
            )}
            {lastError && (
              <p className="flex items-center gap-2 font-medium text-destructive">
                <XCircle className="h-4 w-4 shrink-0" /> {lastError}
              </p>
            )}
            {diag && (
              <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-muted-foreground">
                <dt>Versão do QZ Tray</dt>
                <dd className="text-foreground">{diag.version || 'não conectado'}</dd>
                <dt>Assinatura</dt>
                <dd className={diag.signatureOk === false ? 'text-destructive' : 'text-foreground'}>
                  {diag.signatureOk === true ? 'aceita' : diag.signatureOk === false ? `falhou${diag.lastSignError ? ` (${diag.lastSignError})` : ''}` : 'ainda não solicitada'}
                </dd>
                <dt>Certificado</dt>
                <dd className="font-mono text-[10px] break-all text-foreground">{diag.certFingerprint || '—'}</dd>
              </dl>
            )}
          </div>
        )}

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
          <Button
            variant="outline"
            className="rounded-full px-6 text-sm font-medium border-border"
            onClick={() => onOpenChange(false)}
          >
            Fechar
          </Button>
          <Button
            onClick={handleTest}
            disabled={testing}
            className="rounded-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold px-6 text-sm gap-2 shadow-sm"
          >
            {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Testar de novo
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
