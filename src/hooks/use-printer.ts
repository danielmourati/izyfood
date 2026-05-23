import { useState, useEffect, useCallback } from 'react';
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
} from '@/lib/printer';
import {
  buildOrderReceipt,
  buildBillReceipt,
  buildCashCloseReceipt,
  fetchPrintSettings,
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

export interface PrinterConfig {
  id: string;
  name: string;
  connection_type: 'bluetooth' | 'network' | 'system';
  address: string;
  paper_width: number;
  is_default: boolean;
}

export function usePrinter() {
  const { user } = useAuth();
  const { printSettings } = useStore();
  const [printers, setPrinters] = useState<PrinterConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [btConnected, setBtConnected] = useState(false);
  const [btDeviceName, setBtDeviceName] = useState<string | null>(null);
  const [lastPairedName, setLastPairedName] = useState<string | null>(() => getLastPairedDeviceName());
  const [qzConnected, setQzConnected] = useState(false);

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
      // Try QZ
      const qzReady = await initQzTray();
      setQzConnected(qzReady);

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
  }, [user?.tenantId, printSettings]);

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
    const qzReady = await initQzTray();
    setQzConnected(qzReady);
    return qzReady;
  };

  const defaultPrinter = printers.find(p => p.is_default) || printers[0];
  const paperWidth = defaultPrinter?.paper_width || 58; // Default para 58mm (mini impressoras térmicas)

  const pairBluetooth = async () => {
    const name = await connectBluetooth();
    setBtConnected(true);
    setBtDeviceName(name);
    return name;
  };

  const unpairBluetooth = () => {
    disconnectBluetooth();
    setBtConnected(false);
    setBtDeviceName(null);
  };

  const sendToPrinter = async (data: Uint8Array, htmlFallback: string, title: string) => {
    // 1. Bluetooth (ESC/POS) - Prioridade se estiver conectado e for a impressora padrão (ou se não houver padrão)
    if (isBluetoothConnected() && (!defaultPrinter || defaultPrinter.connection_type === 'bluetooth')) {
      try {
        await printViaBluetooth(data);
        return; // Sucesso, finaliza aqui
      } catch (err) {
        console.error('Erro na impressão Bluetooth, caindo para HTML...', err);
      }
    }

    // 2. QZ Tray (USB/Rede)
    if ((defaultPrinter?.connection_type === 'system' || defaultPrinter?.connection_type === 'network') && isQzConnected()) {
      try {
        await printViaQzTray(data, defaultPrinter.address);
        return; // Sucesso, finaliza aqui
      } catch (err) {
        console.error('QZ Tray print error, falling back to HTML:', err);
      }
    }

    // 3. Fallback para HTML (Abre a janela nativa do Android/Windows)
    printViaHtmlFallback(htmlFallback, title, paperWidth);
  };

  /**
   * Returns a fully-populated PrintSettings object, guaranteed not to be a "barebones"
   * default. Order of precedence:
   *   1. Context printSettings (already loaded by StoreContext, kept fresh by Realtime).
   *   2. Fresh DB fetch via fetchPrintSettings() — no race timeout.
   *   3. localStorage fallback (offline scenario).
   *   4. Last-resort: at minimum the tenant name as storeName, so the receipt isn't blank.
   */
  const resolvePrintSettings = async (tenantId: string | undefined): Promise<any> => {
    // 1) Context baseline
    let ps: any = { ...printSettings };

    // If the context already has real data, that's our truth.
    if (isPrintSettingsUsable(ps)) {
      return ps;
    }

    // 2) Fresh DB fetch (no timeout race — mobile networks may be slow).
    if (tenantId) {
      try {
        const dbPs = await fetchPrintSettings(tenantId);
        if (isPrintSettingsUsable(dbPs)) {
          // Persist for next prints on this device
          try {
            localStorage.setItem(`print_settings_${tenantId}`, JSON.stringify(dbPs));
            (window as any).__printSettingsCache = dbPs;
          } catch { /* storage unavailable */ }
          return dbPs;
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
            return localPs;
          }
        }
      } catch { /* parse failed */ }
    }

    // 4) Whatever we have (even if empty) — at least keep storeName if context has it
    return ps;
  };

  const printOrder = async (order: any) => {
    const ps = await resolvePrintSettings(user?.tenantId);
    console.log('[printOrder] printSettings usados:', JSON.stringify(ps));
    const escpos = buildOrderReceipt(order, paperWidth, ps);
    const html = buildOrderHtml(order, ps);
    await sendToPrinter(escpos, html, 'Comanda');
  };

  const printBill = async (bill: any) => {
    const ps = await resolvePrintSettings(user?.tenantId);
    console.log('[printBill] printSettings usados:', JSON.stringify(ps));
    const blockReason = validateBillPrintSettingsCache(user?.tenantId, ps);
    if (blockReason) {
      console.warn('[printBill] bloqueado por configuração incompleta:', blockReason);
      throw new Error(blockReason);
    }
    const escpos = buildBillReceipt(bill, paperWidth, ps);
    const html = buildBillHtml(bill, ps);
    await sendToPrinter(escpos, html, 'Conta');
  };

  const printCashClose = async (data: any) => {
    const escpos = buildCashCloseReceipt(data, paperWidth);
    const html = buildCashCloseHtml(data);
    await sendToPrinter(escpos, html, 'Fechamento de Caixa');
  };

  const printTest = async () => {
    const testData = buildOrderReceipt({
      id: 'TESTE-0001',
      orderType: 'balcao',
      items: [{ name: 'Produto Teste', quantity: 1, price: 10, subtotal: 10 }],
      total: 10,
      createdAt: new Date().toISOString(),
      operatorName: 'Teste',
    }, paperWidth);
    const testHtml = `<div class="big">TESTE DE IMPRESSÃO</div><div class="line"></div><p>Se você está lendo isto, a impressão está funcionando!</p><div class="line"></div><p>${new Date().toLocaleString('pt-BR')}</p>`;
    await sendToPrinter(testData, testHtml, 'Teste');
  };

  return {
    printers,
    loading,
    defaultPrinter,
    btConnected,
    btDeviceName,
    btAvailable: isBluetoothAvailable(),
    qzConnected,
    retryQzConnection,
    fetchPrinters,
    pairBluetooth,
    unpairBluetooth,
    printOrder,
    printBill,
    printCashClose,
    printTest,
  };
}

// ---- HTML fallback builders ----

function fmtBRL(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
function fmtDate(iso: string) {
  return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

const orderTypeLabels: Record<string, string> = { balcao: 'Balcão', mesa: 'Mesa', delivery: 'Delivery', retirada: 'Retirada' };
const paymentLabels: Record<string, string> = { dinheiro: 'Dinheiro', pix: 'PIX', cartao: 'Cartão', fiado: 'Fiado' };

function buildOrderHtml(order: any, ps: any = {}): string {
  const items = (order.items || []).map((i: any) => {
    const qtyCount = i.weight ? `${i.weight.toFixed(3)}kg` : `${i.quantity}`;
    let html = `<p class="bold" style="margin: 0 0 2px 0;">${qtyCount} ${i.name || 'Produto sem nome'}</p>`;
    if (i.notes) {
      html += `<p style="margin: 0 0 4px 12px; font-size: 12px; font-style: italic;">* ${i.notes}</p>`;
    }
    if (i.selectedComplements && i.selectedComplements.length > 0) {
      i.selectedComplements.forEach((c: any) => {
        html += `<p style="margin: 0 0 2px 12px; font-size: 12px;">+ ${c.quantity}x ${c.name}</p>`;
      });
    }
    return html;
  }).join('');

  const orderNo = order.id ? order.id.slice(0, 4).toUpperCase() : '0000';
  const createdAt = order.createdAt || new Date().toISOString();

  let tipoLabel = 'BALCÃO';
  let tipoBorder = '1px solid #000';
  let tipoColor = '#000';
  if (order.orderType === 'delivery') {
    tipoLabel = '\uD83D\uDEF5  DELIVERY';
    tipoBorder = '2px solid #000';
  } else if (order.orderType === 'retirada') {
    tipoLabel = '\uD83D\uDCE6  RETIRADA';
    tipoBorder = '2px solid #000';
  } else if (order.tableNumber) {
    tipoLabel = `MESA: ${String(order.tableNumber).padStart(3, '0')}`;
  }

  const customerLine = order.orderType === 'delivery'
    ? `${order.customerName || 'Sem Nome'}${order.customerAddress ? ' — ' + order.customerAddress : ''}`
    : order.orderType === 'retirada'
      ? `${order.customerName || 'Sem Nome'}${order.customerPhone ? ' (' + order.customerPhone + ')' : ''}`
      : (order.customerName || 'Sem Nome');

  let headerHtml = '';
  if (ps.storeName) {
    headerHtml += `<div class="center bold" style="font-size: 16px; margin-bottom: 4px; text-transform: uppercase;">${ps.storeName}</div>`;
  }
  if (ps.showAddress && ps.address) {
    headerHtml += `<div class="center header-text" style="margin-bottom: 2px;">${ps.address}</div>`;
  }
  if (ps.showDocument && ps.document) {
    headerHtml += `<div class="center header-text" style="margin-bottom: 2px;">${(ps.documentType || 'CNPJ').toUpperCase()}: ${ps.document}</div>`;
  }
  if (ps.showWhatsapp && ps.whatsapp) {
    headerHtml += `<div class="center header-text" style="margin-bottom: 4px;">WhatsApp: ${ps.whatsapp}</div>`;
  }
  if (headerHtml) {
    headerHtml += '<div class="line"></div>';
  }

  let footerHtml = '';
  if (ps.showPixKey && ps.pixKey) {
    footerHtml += `<div class="center footer-text" style="margin-top: 4px;">PIX: ${ps.pixKey}</div>`;
  }
  if (ps.showInstagram && ps.instagram) {
    footerHtml += `<div class="center footer-text" style="margin-top: 2px;">Instagram: @${ps.instagram.replace('@', '')}</div>`;
  }
  if (ps.showThankMessage && ps.thankMessage) {
    footerHtml += `<p class="center footer-text bold" style="margin-top: 10px; margin-bottom: 0;">${ps.thankMessage}</p>`;
  }

  return `
    ${headerHtml}
    <div class="center" style="font-size: 14px; margin-bottom: 8px;">Cozinha Principal</div>
    <div style="margin-bottom: 8px;">${fmtDate(createdAt)} | Pedido: ${orderNo}</div>
    <div class="center" style="margin-bottom: 4px; font-size: 12px;">* Senha: ${orderNo} *</div>
    <div class="center bold" style="font-size: 20px; border: ${tipoBorder}; color: ${tipoColor}; padding: 6px 4px; margin: 10px 0; letter-spacing: 1px;">${tipoLabel}</div>
    
    <div style="margin-bottom: 8px; border-bottom: 1px solid #eee; padding-bottom: 4px;">Cliente: <strong>${customerLine}</strong></div>
    
    <div style="margin-top: 6px;">
      ${items || '<p class="center">Nenhum item</p>'}
    </div>
    
    <div class="line" style="margin-top: 12px;"></div>
    <div style="margin-top: 6px; font-size: 11px; color: #444;">Atendente: ${order.operatorName || 'Não informado'}</div>
    ${footerHtml ? `
    <div class="footer-text" style="border-top: 1px dashed #000; margin-top: 12px; padding-top: 6px;">
      ${footerHtml}
    </div>
    ` : ''}
  `;
}

function buildBillHtml(bill: any, ps: any = {}): string {
  const items = (bill.items || []).map((i: any) => {
    const qty = i.weight ? `${i.weight.toFixed(3)}kg` : `${i.quantity}x`;
    let html = `<div class="row"><span>${qty} ${i.name || 'Item'}</span><span>${fmtBRL(i.subtotal || 0)}</span></div>`;
    if (i.selectedComplements && i.selectedComplements.length > 0) {
      i.selectedComplements.forEach((c: any) => {
        html += `<div class="row" style="font-size: 11px; padding-left: 12px;"><span>+ ${c.quantity}x ${c.name}</span><span>${fmtBRL(c.price * c.quantity * (i.weight ? 1 : i.quantity))}</span></div>`;
      });
    }
    return html;
  }).join('');

  let payments = '';
  if (bill.paymentSplits?.length) {
    payments = bill.paymentSplits.map((s: any) =>
      `<div class="row"><span>${paymentLabels[s.method] || s.method}</span><span>${fmtBRL(s.amount || 0)}</span></div>`
    ).join('');
  } else if (bill.paymentMethod) {
    payments = `<div class="row"><span>Pgto:</span><span>${paymentLabels[bill.paymentMethod] || bill.paymentMethod}</span></div>`;
  }

  const createdAt = bill.createdAt || new Date().toISOString();

  let headerHtml = '';
  if (ps.storeName) {
    headerHtml += `<div class="center bold" style="font-size: 16px; margin-bottom: 4px; text-transform: uppercase;">${ps.storeName}</div>`;
  }
  if (ps.showAddress && ps.address) {
    headerHtml += `<div class="center header-text" style="margin-bottom: 2px;">${ps.address}</div>`;
  }
  if (ps.showDocument && ps.document) {
    headerHtml += `<div class="center header-text" style="margin-bottom: 2px;">${(ps.documentType || 'CNPJ').toUpperCase()}: ${ps.document}</div>`;
  }
  if (ps.showWhatsapp && ps.whatsapp) {
    headerHtml += `<div class="center header-text" style="margin-bottom: 4px;">WhatsApp: ${ps.whatsapp}</div>`;
  }
  if (headerHtml) {
    headerHtml += '<div class="line"></div>';
  }

  let footerHtml = '';
  if (ps.showPixKey && ps.pixKey) {
    footerHtml += `<div class="center footer-text" style="margin-top: 4px;">PIX: ${ps.pixKey}</div>`;
  }
  if (ps.showInstagram && ps.instagram) {
    footerHtml += `<div class="center footer-text" style="margin-top: 2px;">Instagram: @${ps.instagram.replace('@', '')}</div>`;
  }
  if (ps.showThankMessage && ps.thankMessage) {
    footerHtml += `<p class="center footer-text bold" style="margin-top: 10px; margin-bottom: 0;">${ps.thankMessage}</p>`;
  } else {
    footerHtml += `<p class="center footer-text" style="margin-top: 10px; margin-bottom: 0;">Obrigado pela preferência!</p>`;
  }

  // Dynamically calculate total if bill.total is falsy or 0
  let totalBilled = bill.total || 0;
  if (!totalBilled || totalBilled === 0) {
    const itemsTotal = (bill.items || []).reduce((acc: number, item: any) => {
      const itemSubtotal = item.subtotal ?? (item.price * (item.weight ?? item.quantity));
      return acc + (itemSubtotal || 0);
    }, 0);
    const discountVal = bill.discount ? (bill.discountType === 'percentage' ? (itemsTotal * bill.discount) / 100 : bill.discount) : 0;
    const serviceFeeVal = bill.serviceFee || 0;
    const deliveryFeeVal = bill.deliveryFee || 0;
    totalBilled = itemsTotal - discountVal + serviceFeeVal + deliveryFeeVal;
  }

  return `
    ${headerHtml}
    <div class="big">RESUMO DA CONTA</div>
    <div class="line"></div>
    <div class="row"><span>Tipo:</span><span>${orderTypeLabels[bill.orderType] || bill.orderType || 'Mesa'}</span></div>
    ${(bill.tableNumber || bill.orderType === 'mesa') ? `<div class="row"><span>Mesa:</span><span>${bill.tableNumber || 'N/A'}</span></div>` : ''}
    <div class="row"><span>Cliente:</span><span>${bill.customerName || ''}</span></div>
    <div class="row"><span>Data:</span><span>${fmtDate(createdAt)}</span></div>
    <div class="line"></div>
    <div style="margin: 10px 0;">
      ${items || '<p class="center">Nenhum item</p>'}
    </div>
    <div class="line"></div>
    <div class="row bold" style="font-size: 16px;"><span>TOTAL</span><span>${fmtBRL(totalBilled)}</span></div>
    ${payments ? `<div class="line" style="margin-top:10px;"></div><p class="bold">PAGAMENTO:</p>${payments}` : ''}
    <div class="footer-text" style="border-top: 1px dashed #000; margin-top: 12px; padding-top: 6px;">
      ${footerHtml}
    </div>
  `;
}

function buildCashCloseHtml(data: any): string {
  const saldo = data.initialAmount + data.totalCash;
  return `
    <div class="big">FECHAMENTO DE CAIXA</div>
    <div class="line"></div>
    <div class="row"><span>Abertura:</span><span>${fmtDate(data.openedAt)}</span></div>
    ${data.closedAt ? `<div class="row"><span>Fechamento:</span><span>${fmtDate(data.closedAt)}</span></div>` : ''}
    <div class="row"><span>Operador:</span><span>${data.operatorName}</span></div>
    <div class="line"></div>
    <div class="row bold"><span>Fundo de Troco:</span><span>${fmtBRL(data.initialAmount)}</span></div>
    <div class="line"></div>
    <p class="bold">VENDAS POR FORMA PGTO:</p>
    <div class="row"><span>Dinheiro:</span><span>${fmtBRL(data.totalCash)}</span></div>
    <div class="row"><span>PIX:</span><span>${fmtBRL(data.totalPix)}</span></div>
    <div class="row"><span>Cartão:</span><span>${fmtBRL(data.totalCard)}</span></div>
    <div class="row"><span>Fiado:</span><span>${fmtBRL(data.totalFiado)}</span></div>
    <div class="line"></div>
    <div class="row bold"><span>TOTAL VENDAS:</span><span>${fmtBRL(data.totalSales)}</span></div>
    <div class="line"></div>
    <div class="row bold"><span>SALDO CAIXA:</span><span>${fmtBRL(saldo)}</span></div>
    <p style="font-size:10px;color:#888">(Fundo + Dinheiro)</p>
  `;
}
