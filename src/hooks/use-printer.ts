import { resolveItemSector } from '@/lib/print-sectors';
import { computeServiceFee } from '@/lib/utils';
import { isDesktopApp } from '@/lib/printer-desktop';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useStore } from '@/contexts/StoreContext';
import { supabase } from '@/integrations/supabase/client';
import {
  isBluetoothAvailable,
  isBluetoothConnected,
  connectBluetooth,
  disconnectBluetooth,
  printViaBluetooth,
  printViaHtmlFallback,
  tryReconnectBluetooth,
  initQzTray,
  isQzConnected,
  printViaQzTray,
  getBluetoothDeviceName,
  startBluetoothAutoReconnect,
  getLastPairedDeviceName,
  forgetBluetoothDevice,
  ensureBluetoothConnected,
  getBluetoothPriorityDefault,
  setBluetoothPriorityDefault,
  getEnablePrinterDevice,
  setEnablePrinterDevice,
  isMobileDevice,
  PRINTER_PREFS_EVENT,
  getPrintHostEnabled,
  setPrintHostEnabled,
  getDeviceId,
  getDeviceLabel,
  getDevicePrinterConfig,
} from '@/lib/printer';
import { PRINT_HOST_PRESENCE_PREFIX, insertPrintJob, type PrintJobKind } from '@/lib/print-queue';
import { excludeAlreadySent, fetchAlreadySentItemIds } from '@/lib/printed-guard';
import { receiptHtml } from '@/lib/receipt-renderer';
import {
  buildOrderReceipt,
  buildBillReceipt,
  buildCashCloseReceipt,
  buildEncodingTestReceipt,
  buildEncodingVerificationReceipt,
  fetchPrintSettings,
  receiptColumnsForWidth,
} from '@/lib/escpos';
import type { PrintSettings } from '@/lib/escpos';

/** True when ps has print-specific content beyond the tenant name. */
function isPrintSettingsUsable(ps: PrintSettings | null | undefined): boolean {
  if (!ps) return false;
  const hasText = !!(ps.address || ps.document || ps.whatsapp || ps.pixKey || ps.instagram || (ps.thankMessage && ps.thankMessage !== 'Obrigado pela preferência!'));
  const hasToggle = !!(ps.showAddress || ps.showDocument || ps.showWhatsapp || ps.showPixKey || ps.showInstagram || ps.showThankMessage);
  return hasText || hasToggle;
}

const printableText = (value?: string | null) => !!value && value.trim().length > 0;

function readDeviceCachedPrintSettings(tenantId: string | undefined): PrintSettings | null {
  if (typeof window === 'undefined') return null;

  if (tenantId) {
    try {
      const saved = window.localStorage.getItem(`print_settings_${tenantId}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object' && Object.keys(parsed).length > 0) {
          return parsed as PrintSettings;
        }
      }
    } catch (err) {
      console.warn('[print] cache local de print_settings inválido', err);
    }
  }

  const memoryCache = (window as any).__printSettingsCache;
  if (memoryCache && typeof memoryCache === 'object' && Object.keys(memoryCache).length > 0) {
    return memoryCache as PrintSettings;
  }

  return null;
}

function validateBillPrintSettingsCache(tenantId: string | undefined, resolved: PrintSettings): string | null {
  const cached = readDeviceCachedPrintSettings(tenantId) || resolved;

  if (!tenantId) {
    return 'Impressão bloqueada: a loja ainda não foi identificada neste aparelho. Reabra o PDV e tente novamente.';
  }

  if (!isPrintSettingsUsable(cached)) {
    return 'Impressão bloqueada: as configurações de cabeçalho/rodapé estão vazias no cache deste aparelho. Abra Configurações > Impressora, salve novamente e tente imprimir a conta.';
  }

  const missing: string[] = [];
  if (cached.showAddress && !printableText(cached.address)) missing.push('endereço');
  if (cached.showDocument && !printableText(cached.document)) missing.push('documento');
  if (cached.showWhatsapp && !printableText(cached.whatsapp)) missing.push('WhatsApp');
  if (cached.showPixKey && !printableText(cached.pixKey)) missing.push('chave PIX');
  if (cached.showInstagram && !printableText(cached.instagram)) missing.push('Instagram');
  if (cached.showThankMessage && !printableText(cached.thankMessage)) missing.push('mensagem de agradecimento');

  if (missing.length > 0) {
    return `Impressão bloqueada: ${missing.join(', ')} ${missing.length === 1 ? 'está vazio' : 'estão vazios'} no cache deste aparelho.`;
  }

  const hasPrintableHeader = printableText(cached.storeName)
    || !!(cached.showAddress && printableText(cached.address))
    || !!(cached.showDocument && printableText(cached.document))
    || !!(cached.showWhatsapp && printableText(cached.whatsapp));
  const hasPrintableFooter = !!(cached.showPixKey && printableText(cached.pixKey))
    || !!(cached.showInstagram && printableText(cached.instagram))
    || !!(cached.showThankMessage && printableText(cached.thankMessage));

  if (!hasPrintableHeader && !hasPrintableFooter) {
    return 'Impressão bloqueada: nenhum campo visível de cabeçalho/rodapé está pronto neste aparelho.';
  }

  return null;
}

export interface PrintResult {
  ok: boolean;
  reason?: string;
  /** true quando o cupom foi enviado para o aparelho do caixa imprimir. */
  queued?: boolean;
  /** Quando enfileirado: havia um Caixa online no momento do envio? */
  hostOnline?: boolean;
  jobId?: string;
  /** Canal usado: bluetooth, qz, html (visualização) ou disabled. */
  channel?: PrintChannel;
}

export type PrintChannel = 'bluetooth' | 'qz' | 'html' | 'disabled';

export const PRINT_DISABLED_REASON =
  'Impressão desativada neste aparelho. Ative "Usar impressora neste dispositivo" na seção Impressora Bluetooth (ou em Configurações > Impressora).';

export const PRINT_QUEUED_MESSAGE = 'Cupom enviado para o caixa. O papel sai na impressora do caixa em instantes.';
export const NO_PRINT_HOST_MESSAGE = 'Pedido salvo. Nenhum servidor de impressão (Caixa) ativo — o cupom sai quando o Caixa for ligado.';

export interface PrinterConfig {
  id: string;
  name: string;
  connection_type: 'bluetooth' | 'network' | 'system';
  address: string;
  paper_width: number;
  is_default: boolean;
  model?: string;
  escpos_profile?: string;
  char_encoding?: string;
  auto_connect_qz?: boolean;
  sector?: string;
  double_font_orders?: boolean;
  duplicate_new_orders?: boolean;
}

export type OrderPrintIntent = 'new' | 'reprint';

export function getOrderPrintCopies(
  intent: OrderPrintIntent,
  printer?: Pick<PrinterConfig, 'duplicate_new_orders'> | null,
): number {
  return intent === 'new' && printer?.duplicate_new_orders === true ? 2 : 1;
}

export function usePrinter() {
  const { user } = useAuth();
  const { printSettings, products: storeProducts, categories: storeCategories, settings: storeSettings } = useStore();
  const [printers, setPrinters] = useState<PrinterConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [btConnected, setBtConnected] = useState(false);
  const [btDeviceName, setBtDeviceName] = useState<string | null>(null);
  const [lastPairedName, setLastPairedName] = useState<string | null>(() => getLastPairedDeviceName());
  const [qzConnected, setQzConnected] = useState(false);
  const [btPriorityDefault, setBtPriorityDefaultState] = useState<boolean>(() => getBluetoothPriorityDefault());
  const [enablePrinterDeviceRaw, setEnablePrinterDeviceState] = useState<boolean>(() =>
    getEnablePrinterDevice(user?.id, user?.role),
  );
  // Em computadores, admins continuam com impressão ativa. Atendentes respeitam
  // a escolha individual deste usuário neste aparelho e começam desativados.
  const enablePrinterDevice = user?.role === 'atendente'
    ? enablePrinterDeviceRaw
    : !isMobileDevice() || enablePrinterDeviceRaw;
  const [printHostEnabledRaw, setPrintHostEnabledState] = useState<boolean>(() => getPrintHostEnabled());
  // Celulares nunca são servidor de impressão: sempre enviam para o Caixa.
  const printHostEnabled = !isMobileDevice() && printHostEnabledRaw;
  const [hostLabel, setHostLabel] = useState<string | null>(null);
  const [hostOnline, setHostOnline] = useState(false);
  const hostOnlineRef = useRef(false);

  const toggleBluetoothPriorityDefault = useCallback((v: boolean) => {
    setBluetoothPriorityDefault(v);
    setBtPriorityDefaultState(v);
  }, []);

  const toggleEnablePrinterDevice = useCallback((v: boolean) => {
    setEnablePrinterDevice(v, user?.id, user?.role);
    setEnablePrinterDeviceState(v);
  }, [user?.id, user?.role]);

  const togglePrintHost = useCallback((v: boolean) => {
    setPrintHostEnabled(v);
    setPrintHostEnabledState(v);
  }, []);

  // Mantém as preferências consolidadas entre as telas (Configurações > Impressora
  // e a seção do menu do pedido) e entre abas abertas no mesmo aparelho.
  useEffect(() => {
    const sync = () => {
      setEnablePrinterDeviceState(getEnablePrinterDevice(user?.id, user?.role));
      setBtPriorityDefaultState(getBluetoothPriorityDefault());
      setLastPairedName(getLastPairedDeviceName());
      setPrintHostEnabledState(getPrintHostEnabled());
    };
    window.addEventListener(PRINTER_PREFS_EVENT, sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(PRINTER_PREFS_EVENT, sync);
      window.removeEventListener('storage', sync);
    };
  }, [user?.id, user?.role]);

  // Presença: existe algum aparelho "Caixa" online para imprimir por nós?
  useEffect(() => {
    const tenantId = user?.tenantId;
    if (!tenantId) return;

    const channelName = `${PRINT_HOST_PRESENCE_PREFIX}${tenantId}`;
    const existing = supabase.getChannels().find(c => c.topic === `realtime:${channelName}`);
    if (existing) {
      supabase.removeChannel(existing);
    }

    const channel = supabase.channel(channelName, {
      config: { presence: { key: getDeviceId() } },
    });

    const readState = () => {
      const state = channel.presenceState() as Record<string, any[]>;
      const host = Object.values(state).flat().find((e: any) => e?.role === 'host') as any;
      const online = !!host;
      setHostLabel(host ? [host.userName, host.label].filter(Boolean).join(' · ') : null);
      hostOnlineRef.current = online;
      setHostOnline(prev => (prev === online ? prev : online));
    };

    channel
      .on('presence', { event: 'sync' }, readState)
      .on('presence', { event: 'join' }, readState)
      .on('presence', { event: 'leave' }, readState)
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          if (printHostEnabled) {
            await channel.track({ role: 'host', label: getDeviceLabel(), userName: user?.name || null, at: new Date().toISOString() });
          } else {
            await channel.track({ role: 'watcher', label: getDeviceLabel(), at: new Date().toISOString() });
          }
        }
      });

    return () => { supabase.removeChannel(channel); };
  }, [user?.tenantId, printHostEnabled]);

  const enqueuePrintJob = useCallback(async (kind: PrintJobKind, payload: any): Promise<PrintResult> => {
    const tenantId = user?.tenantId;
    if (!tenantId) {
      return { ok: false, reason: 'Loja não identificada neste aparelho. Reabra o PDV e tente novamente.' };
    }
    try {
      const jobId = await insertPrintJob({
        tenantId,
        createdBy: user?.id ?? null,
        deviceLabel: getDeviceLabel(),
        kind,
        payload,
      });
      const online = hostOnlineRef.current;
      return {
        ok: true, queued: true, jobId, hostOnline: online,
        reason: online ? PRINT_QUEUED_MESSAGE : NO_PRINT_HOST_MESSAGE,
      };
    } catch (err: any) {
      console.error('[print] falha ao enviar cupom para a fila do caixa', err);
      return { ok: false, reason: 'Não foi possível enviar o cupom para o caixa. Verifique a conexão e tente novamente.' };
    }
  }, [user?.tenantId, user?.id]);




  const fetchPrinters = useCallback(async () => {
    const { data } = await supabase
      .from('printer_configs')
      .select('*')
      .order('is_default', { ascending: false });

    if (data) {
      const mapped = data.map((p: any) => {
        const isSystem = p.connection_type === 'network' && (p.address === 'SYSTEM_BROWSER' || p.address?.startsWith('SYSTEM:'));
        return {
          ...p,
          connection_type: isSystem ? 'system' : p.connection_type,
          address: isSystem ? p.address.replace('SYSTEM:', '').replace('SYSTEM_BROWSER', 'BROWSER') : p.address
        };
      });
      setPrinters(mapped as unknown as PrinterConfig[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchPrinters(); }, [fetchPrinters]);

  useEffect(() => {
    const initConnections = async () => {
      // QZ auto-connect only if NOT on mobile and default printer opted in (or no printers configured yet)
      const shouldAutoQz = !isMobileDevice() && (printers.length === 0 || printers.some(p => p.is_default && p.auto_connect_qz));
      if (shouldAutoQz) {
        const qzReady = await initQzTray();
        setQzConnected(qzReady);
      }

      // Inicia loop de auto-reconexão (idempotente)
      startBluetoothAutoReconnect();

      // Try BT Auto-reconnect
      if (!isBluetoothConnected()) {
        const name = await tryReconnectBluetooth();
        if (name) {
          setBtConnected(true);
          setBtDeviceName(name);
        } else {
          const connected = isBluetoothConnected();
          setBtConnected(connected);
          if (connected) setBtDeviceName(getBluetoothDeviceName());
        }
      } else {
        setBtConnected(true);
        setBtDeviceName(getBluetoothDeviceName());
      }
    };
    initConnections();

    // Mirror the context printSettings into the window cache for ESC/POS library compatibility
    if (Object.keys(printSettings).length > 0 && (printSettings as any).storeName !== undefined) {
      (window as any).__printSettingsCache = printSettings;
    }
  }, [user?.tenantId, printSettings, printers]);

  useEffect(() => {
    const handleBtConnected = (e: any) => {
      setBtConnected(true);
      setBtDeviceName(e.detail?.name || 'Impressora Bluetooth');
    };
    const handleBtStatus = (e: any) => {
      const connected = !!e.detail?.connected;
      setBtConnected(connected);
      if (connected && e.detail?.name) setBtDeviceName(e.detail.name);
    };
    window.addEventListener('bt_connected', handleBtConnected);
    window.addEventListener('bt_status', handleBtStatus);

    // Polling leve para refletir o estado real (gatt pode cair sem evento em alguns navegadores)
    const poll = setInterval(() => {
      const connected = isBluetoothConnected();
      setBtConnected(prev => prev === connected ? prev : connected);
    }, 5000);

    return () => {
      window.removeEventListener('bt_connected', handleBtConnected);
      window.removeEventListener('bt_status', handleBtStatus);
      clearInterval(poll);
    };
  }, []);

  const retryQzConnection = async () => {
    if (isMobileDevice()) return false;
    const qzReady = await initQzTray();
    setQzConnected(qzReady);
    return qzReady;
  };

  const defaultPrinter = printers.find(p => p.is_default) || printers[0];
  const paperWidth = defaultPrinter?.paper_width || 80; // Default para 80mm

  /**
   * Identifica a impressora configurada para um setor específico (ex: 'recibo' para o Caixa, 'cozinha' para a Cozinha).
   */
  const getPrinterForSector = useCallback((sector?: string): PrinterConfig | null => {
    const targetSector = sector || 'recibo';
    const sectorSettings = printers.find(p => p.sector === targetSector)
      || printers.find(p => p.sector === 'recibo')
      || defaultPrinter;

    // 1. Configuração local salva no próprio dispositivo (override local)
    const deviceConfig = getDevicePrinterConfig();
    if (deviceConfig && deviceConfig.name) {
      return {
        id: 'local_device',
        name: deviceConfig.name,
        connection_type: deviceConfig.connectionType || (deviceConfig.name.includes('Bluetooth') ? 'bluetooth' : 'system'),
        address: deviceConfig.address || deviceConfig.name,
        paper_width: deviceConfig.paperWidth || 80,
        is_default: true,
        sector: targetSector,
        double_font_orders: sectorSettings?.double_font_orders ?? false,
        duplicate_new_orders: sectorSettings?.duplicate_new_orders ?? false,
      };
    }

    // 2. Procurar impressora cadastrada no banco de dados para o setor solicitado
    const exactMatch = printers.find(p => p.sector === targetSector);
    if (exactMatch) return exactMatch;

    // 3. Fallback para impressora de recibo (Caixa) se o setor específico não tiver impressora dedicada
    const reciboMatch = printers.find(p => p.sector === 'recibo');
    if (reciboMatch) return reciboMatch;

    // 4. Fallback para a impressora padrão ou primeira cadastrada
    return defaultPrinter || null;
  }, [printers, defaultPrinter]);

  // Existe impressora utilizável? Considera dois cenários:
  // 1) Toggle "Usar Impressora neste Dispositivo" ativo AND
  // 2) Impressora Bluetooth conectada/prioritária OU QZ/impressora padrão disponível.
  const hasActiveLocalBluetooth = btPriorityDefault && btConnected;

  const hasBluetoothDefault =
    defaultPrinter?.connection_type === 'bluetooth' &&
    (btConnected || btPriorityDefault || !!getLastPairedDeviceName());

  const hasPrinterAvailable =
    enablePrinterDevice &&
    (hasActiveLocalBluetooth ||
      (printers.length > 0 && (
        btConnected ||
        qzConnected ||
        defaultPrinter?.connection_type === 'system' ||
        defaultPrinter?.connection_type === 'network' ||
        hasBluetoothDefault
      )));


  const pairBluetooth = async () => {
    const name = await connectBluetooth({ forcePairing: true });
    setBtConnected(true);
    setBtDeviceName(name);
    setLastPairedName(getLastPairedDeviceName());
    return name;
  };

  const unpairBluetooth = () => {
    disconnectBluetooth();
    setBtConnected(false);
    setBtDeviceName(null);
  };

  const reconnectPrinter = async () => {
    // Tenta sem gesto via getDevices(); se falhar, devolve false para a UI cair em pairBluetooth().
    const ok = await ensureBluetoothConnected();
    if (ok) {
      setBtConnected(true);
      setBtDeviceName(getBluetoothDeviceName());
      return true;
    }
    const name = await tryReconnectBluetooth();
    if (name) {
      setBtConnected(true);
      setBtDeviceName(name);
      return true;
    }
    return false;
  };

  const forgetPrinter = () => {
    forgetBluetoothDevice();
    setBtConnected(false);
    setBtDeviceName(null);
    setLastPairedName(null);
    setBtPriorityDefaultState(false);
  };

  const sendToPrinter = async (
    data: Uint8Array,
    htmlFallback: string,
    title: string,
    options?: { force?: boolean; targetPrinter?: PrinterConfig | null; sector?: string }
  ): Promise<PrintChannel> => {
    if (!enablePrinterDevice && !options?.force) {
      console.info('[sendToPrinter] Impressão desativada neste dispositivo. Ignorando envio.');
      return 'disabled';
    }

    const resolvedPrinter = options?.targetPrinter || getPrinterForSector(options?.sector);
    const targetPaperWidth = resolvedPrinter?.paper_width || paperWidth;
    const printerAddress = resolvedPrinter?.address;
    const connectionType = resolvedPrinter?.connection_type || defaultPrinter?.connection_type;

    // 1. Bluetooth (ESC/POS) - Prioridade se o Bluetooth estiver conectado ou se houver dispositivo pareado
    if (isBluetoothConnected() || getLastPairedDeviceName() || btPriorityDefault || connectionType === 'bluetooth') {
      try {
        if (!isBluetoothConnected()) {
          await ensureBluetoothConnected();
        }
        if (isBluetoothConnected()) {
          console.log('[sendToPrinter] Enviando comando ESC/POS via Bluetooth para:', resolvedPrinter?.name || 'Bluetooth');
          await printViaBluetooth(data);
          return 'bluetooth'; // Sucesso, imprimiu via Bluetooth!
        }
      } catch (err) {
        console.warn('[sendToPrinter] Tentativa Bluetooth falhou, verificando canais alternativos:', err);
      }
    }

    // 2. QZ Tray / Desktop System Spooler / Socket (para o endereço da impressora do setor configurado)
    const wantsSystem = connectionType === 'system' || connectionType === 'network' || printers.some(p => p.connection_type === 'system' || p.connection_type === 'network');
    if (!isMobileDevice() && wantsSystem && !isQzConnected() && !isDesktopApp()) {
      try { await retryQzConnection(); } catch { /* segue para o fallback */ }
    }
    if (!isMobileDevice() && wantsSystem && (isQzConnected() || isDesktopApp())) {
      try {
        const destAddress = printerAddress || defaultPrinter?.address;
        console.log('[sendToPrinter] Enviando para impressora do setor/caixa:', resolvedPrinter?.name, '->', destAddress);
        await printViaQzTray(data, destAddress);
        return 'qz'; // Sucesso, imprimiu via QZ Tray / Desktop Spooler!
      } catch (err) {
        console.error('[sendToPrinter] Erro no QZ Tray:', err);
        throw err instanceof Error ? err : new Error('Falha ao enviar para a impressora (QZ Tray).');
      }
    }

    // 3. Fallback apenas se NENHUMA impressora direta (Bluetooth / QZ) funcionou
    if (options?.force && printHostEnabled) {
      throw new Error('Nenhuma impressora conectada neste caixa (QZ Tray/USB ou Bluetooth).');
    }
    console.info('[sendToPrinter] Nenhuma impressora direta conectada ou ativa. Abrindo janela de visualização HTML...');
    printViaHtmlFallback(htmlFallback, title, targetPaperWidth);
    return 'html';
  };

  /**
   * Returns a fully-populated PrintSettings object, guaranteed not to be a "barebones"
   * default.
   */
  const resolvePrintSettings = async (tenantId: string | undefined): Promise<any> => {
    // 1) Context baseline
    let ps: any = { ...printSettings };

    const savedFeed = typeof window !== 'undefined' ? localStorage.getItem('izf_feed_lines') : null;
    const feedLines = savedFeed ? Number(savedFeed) : (ps.feedLines ?? 4);

    // If the context already has real data, that's our truth.
    if (isPrintSettingsUsable(ps)) {
      return { ...ps, feedLines };
    }

    // 2) Fresh DB fetch
    if (tenantId) {
      try {
        const dbPs = await fetchPrintSettings(tenantId);
        if (isPrintSettingsUsable(dbPs)) {
          const merged = { ...dbPs, feedLines };
          try {
            localStorage.setItem(`print_settings_${tenantId}`, JSON.stringify(merged));
            (window as any).__printSettingsCache = merged;
          } catch { /* storage unavailable */ }
          return merged;
        }
      } catch (err) {
        console.warn('[print] fetchPrintSettings falhou, tentando localStorage', err);
      }

      // 3) localStorage on this device
      try {
        const saved = localStorage.getItem(`print_settings_${tenantId}`);
        if (saved) {
          const localPs = JSON.parse(saved);
          if (isPrintSettingsUsable(localPs)) {
            return { ...localPs, feedLines };
          }
        }
      } catch { /* parse failed */ }
    }

    return { ...ps, feedLines };
  };

  /**
   * Sem impressora local utilizável e com um aparelho "Caixa" online?
   * Então o cupom vai para a fila e é impresso lá.
   */
  const shouldQueue = (options?: { force?: boolean }) =>
    isMobileDevice() || !options?.force && !printHostEnabled && !hasPrinterAvailable && hostOnlineRef.current;

  const printOrder = async (orderIn: any, options?: { force?: boolean; sector?: string; intent?: OrderPrintIntent }): Promise<PrintResult> => {
    const intent = options?.intent ?? 'new';
    let order = orderIn;
    // O Caixa (force) imprime o que recebeu da fila sem rechecar: o próprio cupom da fila contaria como "já enviado".
    if (intent === 'new' && !options?.force && order?.id && Array.isArray(order.items)) {
      const sent = await fetchAlreadySentItemIds(order.id);
      const fresh = excludeAlreadySent(order.items, sent);
      if (fresh.length < order.items.length) console.info('[printOrder] itens já impressos removidos da comanda:', order.items.length - fresh.length);
      if (fresh.length === 0) return { ok: true, channel: 'disabled' } as any;
      order = { ...order, items: fresh };
    }
    if (shouldQueue(options)) return enqueuePrintJob('order', { ...order, __printIntent: intent });
    if (!enablePrinterDevice && !options?.force) {
      console.info('[printOrder] Opção por usar impressora desativada neste dispositivo. Ignorando.');
      return { ok: false, reason: PRINT_DISABLED_REASON };
    }
    const ps = await resolvePrintSettings(user?.tenantId);

    // Separa os itens por setor (produto > categoria > cozinha), salvo quando um setor foi forçado.
    const groups = new Map<string, any[]>();
    const items: any[] = Array.isArray(order?.items) ? order.items : [];
    if (options?.sector || items.length === 0) {
      groups.set(options?.sector || 'cozinha', items);
    } else {
      for (const it of items) {
        const sec = resolveItemSector(it, storeProducts, storeCategories);
        if (sec === 'none') continue;
        if (!groups.has(sec)) groups.set(sec, []);
        groups.get(sec)!.push(it);
      }
      if (groups.size === 0) return { ok: true };
    }

    let lastChannel: PrintChannel | undefined;
    for (const [sector, secItems] of groups) {
      const secOrder = { ...order, items: secItems };
      const targetPrinter = getPrinterForSector(sector);
      const targetPaperWidth = targetPrinter?.paper_width || paperWidth;
      console.log(`[printOrder] setor: ${sector}, impressora: ${targetPrinter?.name || 'padrão'}, itens: ${secItems.length}`);
      const orderSettings = { ...ps, doubleFontOrders: targetPrinter?.double_font_orders === true };
      const escpos = buildOrderReceipt(secOrder, targetPaperWidth, orderSettings, targetPrinter?.char_encoding);
      const html = buildOrderHtml(secOrder, orderSettings, targetPaperWidth);
      const copies = getOrderPrintCopies(intent, targetPrinter);
      for (let copy = 0; copy < copies; copy += 1) {
        lastChannel = await sendToPrinter(escpos, html, 'Comanda', { ...options, targetPrinter, sector });
      }
    }
    return { ok: true, channel: lastChannel };
  };

  const printBill = async (rawBill: any, options?: { force?: boolean }): Promise<PrintResult> => {
    const bill = rawBill?.serviceFee == null && rawBill?.orderType === 'mesa'
      ? { ...rawBill, serviceFee: computeServiceFee(rawBill, storeProducts, storeSettings?.serviceFeePercentage) }
      : rawBill;
    if (shouldQueue(options)) return enqueuePrintJob('bill', bill);
    if (!enablePrinterDevice && !options?.force) {
      console.info('[printBill] Opção por usar impressora desativada neste dispositivo. Ignorando.');
      return { ok: false, reason: PRINT_DISABLED_REASON };
    }
    const sector = 'recibo';
    const targetPrinter = getPrinterForSector(sector);
    const targetPaperWidth = targetPrinter?.paper_width || paperWidth;
    const ps = await resolvePrintSettings(user?.tenantId);
    console.log(`[printBill] printSettings usados (setor: recibo, impressora: ${targetPrinter?.name || 'padrão'}, largura: ${targetPaperWidth}mm):`, JSON.stringify(ps));
    const escpos = buildBillReceipt(bill, targetPaperWidth, ps, targetPrinter?.char_encoding);
    const html = buildBillHtml(bill, ps, targetPaperWidth);
    await sendToPrinter(escpos, html, 'Conta', { ...options, targetPrinter, sector });
    return { ok: true };
  };

  const printCashClose = async (data: any, options?: { force?: boolean }): Promise<PrintResult> => {
    if (shouldQueue(options)) return enqueuePrintJob('cash_close', data);
    if (!enablePrinterDevice && !options?.force) {
      console.info('[printCashClose] Opção por usar impressora desativada neste dispositivo. Ignorando.');
      return { ok: false, reason: PRINT_DISABLED_REASON };
    }
    const sector = 'recibo';
    const targetPrinter = getPrinterForSector(sector);
    const targetPaperWidth = targetPrinter?.paper_width || paperWidth;
    const escpos = buildCashCloseReceipt(data, targetPaperWidth, targetPrinter?.char_encoding);
    const html = buildCashCloseHtml(data, targetPaperWidth);
    const channel = await sendToPrinter(escpos, html, 'Fechamento de Caixa', { ...options, targetPrinter, sector });
    return { ok: true, channel };
  };

  /** Prints the calibration page with every character table, numbered. */
  const printEncodingTest = async (sector?: string, expandedEncoding?: string, verify = false): Promise<PrintResult> => {
    const targetPrinter = getPrinterForSector(sector);
    const targetPaperWidth = targetPrinter?.paper_width || paperWidth;
    const bytes = verify
      ? buildEncodingVerificationReceipt(targetPaperWidth, targetPrinter?.char_encoding || 'utf8')
      : buildEncodingTestReceipt(targetPaperWidth, expandedEncoding);
    const html = '<pre style="font-family:monospace">TESTE DE ACENTUACAO\n\nEste teste so funciona em impressora termica conectada (USB/QZ Tray ou Bluetooth).</pre>';
    const channel = await sendToPrinter(bytes, html, 'Teste de acentuação', { force: true, targetPrinter, sector });
    return { ok: channel !== 'html' && channel !== 'disabled', channel };
  };

  const printTest = async (sector?: string) => {
    const mockOrder = {
      id: `TESTE-${Date.now().toString().slice(-6)}`,
      orderType: 'mesa',
      tableNumber: '3',
      customerName: 'Cliente Teste',
      operatorName: user?.name || 'Operador',
      items: [
        { id: 'i1', name: 'X-Salada', quantity: 2, price: 22.5, subtotal: 45, notes: 'Sem cebola' },
        { id: 'i2', name: 'Refrigerante Lata 350ml', quantity: 2, price: 6.5, subtotal: 13, notes: '' },
        { id: 'i3', name: 'Batata Frita Média', quantity: 1, price: 18, subtotal: 18, notes: 'Bem passada' },
      ],
      subtotal: 76,
      serviceTax: 7.6,
      discount: 0,
      total: 83.6,
      paymentMethod: 'pix',
      createdAt: new Date().toISOString(),
      __test: true,
    };
    return printOrder(mockOrder, { force: true, sector });
  };


  return {
    printers,
    loading,
    defaultPrinter,
    getPrinterForSector,
    btConnected,
    btDeviceName,
    lastPairedName,
    btAvailable: isBluetoothAvailable(),
    btPriorityDefault,
    toggleBluetoothPriorityDefault,
    enablePrinterDevice,
    toggleEnablePrinterDevice,
    qzConnected,
    hasPrinterAvailable,
    retryQzConnection,
    fetchPrinters,
    pairBluetooth,
    unpairBluetooth,
    reconnectPrinter,
    forgetPrinter,
    printOrder,
    printBill,
    printCashClose,
    printTest,
    printEncodingTest,
    printHostEnabled,
    togglePrintHost,
    hostOnline,
    hostLabel,
    enqueuePrintJob,
  };
}

// Browser output reuses the exact thermal layout; UTF-8 preserves browser text.
export function buildOrderHtml(order: any, ps: PrintSettings = {}, paperWidth = 80): string {
  return receiptHtml(buildOrderReceipt(order, paperWidth, ps, 'utf8'), receiptColumnsForWidth(paperWidth));
}

export function buildBillHtml(bill: any, ps: PrintSettings = {}, paperWidth = 80): string {
  return receiptHtml(buildBillReceipt(bill, paperWidth, ps, 'utf8'), receiptColumnsForWidth(paperWidth));
}

export function buildCashCloseHtml(data: any, paperWidth = 80): string {
  return receiptHtml(buildCashCloseReceipt(data, paperWidth, 'utf8'), receiptColumnsForWidth(paperWidth));
}
