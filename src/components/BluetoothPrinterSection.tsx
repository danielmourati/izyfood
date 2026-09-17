import { useState } from 'react';
import { Printer, Bluetooth } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { usePrinter } from '@/hooks/use-printer';

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
  } = usePrinter();

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
      await printTest();
      setMessage({ type: 'ok', text: 'Teste enviado para a impressora.' });
    } catch {
      setMessage({ type: 'error', text: 'Não foi possível imprimir o teste.' });
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-2">
      <span className="font-extrabold uppercase tracking-wider text-[11px] text-muted-foreground block border-b border-border pb-1">
        Impressora Bluetooth (Este Aparelho)
      </span>

      <div className="rounded-md bg-muted/40 p-2.5 space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 font-semibold text-foreground">
            <Bluetooth className="h-4 w-4 text-primary" />
            <span className="truncate max-w-[150px]">
              {btDeviceName || lastPairedName || 'Nenhum pareado'}
            </span>
          </div>
          <span
            className={`text-[10px] font-black px-2 py-0.5 rounded flex items-center gap-1.5 ${
              btConnected
                ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30'
                : 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30'
            }`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${btConnected ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
            {btConnected ? 'Conectado' : 'Desconectado'}
          </span>
        </div>

        {!btAvailable ? (
          <p className="text-[11px] text-amber-600 dark:text-amber-400 leading-snug">
            Este navegador não permite conexão Bluetooth. Use a impressão pelo navegador ou abra o app no Chrome/Edge do Android.
          </p>
        ) : (
          <>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                onClick={handlePair}
                disabled={!!busy}
                className="text-xs font-bold h-8 px-3 rounded-lg"
              >
                {busy === 'pair' ? 'Buscando...' : 'Parear / Buscar'}
              </Button>

              {btConnected ? (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!!busy}
                  onClick={() => {
                    forgetPrinter();
                    setMessage({ type: 'warn', text: 'Impressora desconectada deste aparelho.' });
                  }}
                  className="text-xs font-bold h-8 px-3 rounded-lg border-destructive/40 text-destructive hover:bg-destructive/10"
                >
                  Desconectar
                </Button>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleReconnect}
                  disabled={!!busy}
                  className="text-xs font-bold h-8 px-3 rounded-lg"
                >
                  {busy === 'reconnect' ? 'Reconectando...' : 'Reconectar'}
                </Button>
              )}

              <Button
                size="sm"
                variant="secondary"
                onClick={handleTest}
                disabled={!!busy}
                className="text-xs font-bold h-8 px-3 rounded-lg flex items-center gap-1.5"
              >
                <Printer className="h-3.5 w-3.5" />
                {busy === 'test' ? 'Imprimindo...' : 'Teste'}
              </Button>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-border/60">
              <span className="font-semibold text-foreground text-[11px] pr-2">
                Usar Bluetooth como padrão neste aparelho
              </span>
              <Switch
                checked={btPriorityDefault}
                onCheckedChange={(checked) => {
                  toggleBluetoothPriorityDefault(checked);
                  setMessage({
                    type: checked ? 'ok' : 'warn',
                    text: checked ? 'Bluetooth definido como padrão neste aparelho.' : 'Prioridade Bluetooth desativada.',
                  });
                }}
              />
            </div>
          </>
        )}

        {message && <p className={`text-[11px] font-semibold leading-snug ${msgClass}`}>{message.text}</p>}
      </div>
    </div>
  );
}
