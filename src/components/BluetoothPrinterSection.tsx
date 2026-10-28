import TakeoverPrintHostButton from '@/components/TakeoverPrintHostButton';
import { useState } from 'react';
import { Printer, Bluetooth } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { usePrinter } from '@/hooks/use-printer';
import { isMobileDevice } from '@/lib/printer';

/**
 * Seção compacta de conexão/configuração da impressora Bluetooth local.
 * Usada no menu do pedido (mobile) — conexão é local do aparelho.
 */
export default function BluetoothPrinterSection() {
  const {
    btConnected,
    btDeviceName,
    lastPairedName,
    btAvailable,
    btPriorityDefault,
    toggleBluetoothPriorityDefault,
    enablePrinterDevice,
    toggleEnablePrinterDevice,
    pairBluetooth,
    reconnectPrinter,
    forgetPrinter,
    printTest,
    printHostEnabled,
    togglePrintHost,
    hostOnline,
    hostLabel,
    hostBlocked,
    hostBusy,
    hostMessage,
  } = usePrinter();
  const mobile = isMobileDevice();

  const [busy, setBusy] = useState<null | 'pair' | 'reconnect' | 'test'>(null);
  const [message, setMessage] = useState<{ type: 'ok' | 'warn' | 'error'; text: string } | null>(null);

  const msgClass = message
    ? message.type === 'ok'
      ? 'text-emerald-600 dark:text-emerald-400'
      : message.type === 'warn'
        ? 'text-amber-600 dark:text-amber-400'
        : 'text-destructive'
    : '';

  const handlePair = async () => {
    setBusy('pair');
    setMessage(null);
    try {
      const name = await pairBluetooth();
      setMessage({ type: 'ok', text: `Conectado a ${name}.` });
    } catch {
      setMessage({ type: 'error', text: 'Não foi possível conectar. Verifique se a impressora está ligada.' });
    } finally {
      setBusy(null);
    }
  };

  const handleReconnect = async () => {
    setBusy('reconnect');
    setMessage(null);
    try {
      const ok = await reconnectPrinter();
      setMessage(ok
        ? { type: 'ok', text: 'Reconectado com sucesso.' }
        : { type: 'warn', text: 'Nenhuma impressora pareada. Use Parear / Buscar.' });
    } catch {
      setMessage({ type: 'error', text: 'Falha ao reconectar.' });
    } finally {
      setBusy(null);
    }
  };

  const handleTest = async () => {
    setBusy('test');
    setMessage(null);
    try {
      const res: any = await printTest();
      if (res?.queued) setMessage({ type: res.hostOnline === false ? 'warn' : 'ok', text: res.reason });
      else setMessage({ type: 'ok', text: 'Teste enviado para a impressora.' });
    } catch {
      setMessage({ type: 'error', text: 'Não foi possível imprimir o teste.' });
    } finally {
      setBusy(null);
    }
  };

  if (mobile) {
    return (
      <div className="space-y-2">
        <span className="font-extrabold uppercase tracking-wider text-[11px] text-muted-foreground block border-b border-border pb-1">
          Servidor de impressão (Caixa)
        </span>
        <div className="rounded-md bg-muted/40 p-2.5 space-y-2">
          <p className={`text-[11px] font-semibold leading-snug ${hostOnline ? 'text-primary' : 'text-destructive'}`}>
            {hostOnline
              ? `Ativo${hostLabel ? ` — ${hostLabel}` : ''}. Os cupons saem na impressora do Caixa.`
              : 'Nenhum servidor de impressão ativo. Os pedidos são salvos e os cupons saem quando o Caixa for ligado.'}
          </p>
          <Button size="sm" variant="secondary" onClick={handleTest} disabled={!!busy} className="text-xs font-bold h-8 px-3 rounded-lg flex items-center gap-1.5">
            <Printer className="h-3.5 w-3.5" />
            {busy === 'test' ? 'Enviando...' : 'Imprimir teste'}
          </Button>
          {message && <p className={`text-[11px] font-semibold leading-snug ${msgClass}`}>{message.text}</p>}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <span className="font-extrabold uppercase tracking-wider text-[11px] text-muted-foreground block border-b border-border pb-1">
        Impressora (Este Aparelho)
      </span>

      <div className="rounded-md bg-muted/40 p-2.5 space-y-2.5">
        <div className="flex items-center justify-between gap-2 pb-2 border-b border-border/60">
          <span className="font-semibold text-foreground text-[11px] pr-2 leading-snug">
            Usar impressora neste dispositivo
          </span>
          <Switch
            checked={enablePrinterDevice}
            onCheckedChange={(checked) => {
              toggleEnablePrinterDevice(checked);
              setMessage({
                type: checked ? 'ok' : 'warn',
                text: checked
                  ? 'Impressão ativada neste aparelho.'
                  : 'Impressão desativada: cupons da cozinha e conta não serão impressos.',
              });
            }}
          />
        </div>

        {!enablePrinterDevice && !hostOnline && (
          <p className="text-[11px] text-amber-600 dark:text-amber-400 leading-snug font-semibold">
            Impressão desativada neste aparelho. Ative a chave acima para imprimir cupom da cozinha e conta.
          </p>
        )}

        {hostOnline && !printHostEnabled && (
          <p className="text-[11px] text-emerald-600 dark:text-emerald-400 leading-snug font-semibold">
            O caixa está online: os cupons deste aparelho saem na impressora do caixa, sem precisar de Bluetooth aqui.
          </p>
        )}

        <div className="flex items-center justify-between gap-2 pb-2 border-b border-border/60">
          <span className="font-semibold text-foreground text-[11px] pr-2 leading-snug">
            Este aparelho imprime para os outros (Caixa)
          </span>
          <Switch
            checked={printHostEnabled}
            disabled={hostBlocked || hostBusy}
            onCheckedChange={togglePrintHost}
          />
        </div>
        {hostBlocked && <p className="text-xs text-muted-foreground">Caixa ativo: {hostLabel || 'outro aparelho'}. Desative-o antes de trocar.</p>}
        {hostMessage && <p role="alert" className="text-xs text-destructive">{hostMessage}</p>}
        <TakeoverPrintHostButton />

        <Button size="sm" variant="secondary" onClick={handleTest} disabled={!!busy} className="text-xs font-bold h-8 px-3 rounded-lg flex items-center gap-1.5">
          <Printer className="h-3.5 w-3.5" />
          {busy === 'test' ? 'Imprimindo...' : 'Imprimir teste'}
        </Button>

        {message && <p className={`text-[11px] font-semibold leading-snug ${msgClass}`}>{message.text}</p>}
      </div>
    </div>
  );
}
