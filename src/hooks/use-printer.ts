import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  isBluetoothAvailable,
  isBluetoothConnected,
  connectBluetooth,
  disconnectBluetooth,
  printViaBluetooth,
  printViaHtmlFallback,
} from '@/lib/printer';
import {
  buildOrderReceipt,
  buildBillReceipt,
  buildCashCloseReceipt,
} from '@/lib/escpos';

export interface PrinterConfig {
  id: string;
  name: string;
  connection_type: 'bluetooth' | 'network' | 'system';
  address: string;
  paper_width: number;
  is_default: boolean;
}

export function usePrinter() {
  const [printers, setPrinters] = useState<PrinterConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [btConnected, setBtConnected] = useState(false);
  const [btDeviceName, setBtDeviceName] = useState<string | null>(null);

  const fetchPrinters = useCallback(async () => {
    const { data } = await supabase
      .from('printer_configs')
      .select('*')
      .order('is_default', { ascending: false });
    
    if (data) {
      const mapped = data.map((p: any) => ({
        ...p,
        connection_type: (p.connection_type === 'network' && p.address === 'SYSTEM_BROWSER') ? 'system' : p.connection_type
      }));
      setPrinters(mapped as unknown as PrinterConfig[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchPrinters(); }, [fetchPrinters]);

  useEffect(() => {
    setBtConnected(isBluetoothConnected());
  }, []);

  const defaultPrinter = printers.find(p => p.is_default) || printers[0];
  const paperWidth = defaultPrinter?.paper_width || 80;

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
    if (defaultPrinter?.connection_type === 'bluetooth' && isBluetoothConnected()) {
      await printViaBluetooth(data);
    } else if (defaultPrinter?.connection_type === 'system') {
      printViaHtmlFallback(htmlFallback, title);
    } else {
      printViaHtmlFallback(htmlFallback, title);
    }
  };

  const printOrder = async (order: any) => {
    const escpos = buildOrderReceipt(order, paperWidth);
    const html = buildOrderHtml(order);
    await sendToPrinter(escpos, html, 'Comanda');
  };

  const printBill = async (bill: any) => {
    const escpos = buildBillReceipt(bill, paperWidth);
    const html = buildBillHtml(bill);
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

function buildOrderHtml(order: any): string {
  const items = (order.items || []).map((i: any) => {
    const qtyCount = i.weight ? `${i.weight.toFixed(3)}kg` : `${i.quantity}`;
    let html = `<p class="bold mb-1">${qtyCount} ${i.name || 'Produto sem nome'}</p>`;
    if (i.notes) {
      html += `<p style="margin: -2px 0 8px 12px; font-size: 12px; font-style: italic;">* ${i.notes}</p>`;
    } else {
      html += `<div style="height: 4px;"></div>`;
    }
    return html;
  }).join('');
  
  const orderNo = order.id ? order.id.slice(0, 4).toUpperCase() : '0000';
  const comanda = order.tableNumber ? String(order.tableNumber).padStart(3, '0') : 'BALCÃO';
  const createdAt = order.createdAt || new Date().toISOString();

  return `
    <div class="center" style="font-size: 14px; margin-bottom: 8px;">Cozinha Principal</div>
    <div style="margin-bottom: 8px;">${fmtDate(createdAt)} | Pedido: ${orderNo}</div>
    <div class="center" style="margin-bottom: 4px; font-size: 12px;">* Senha: ${orderNo} *</div>
    <div class="center bold" style="font-size: 20px; border: 1px solid #000; padding: 4px; margin: 10px 0;">COMANDA: ${comanda}</div>
    
    <div style="margin-bottom: 12px; border-bottom: 1px solid #eee; padding-bottom: 4px;">Cliente: <strong>${order.customerName || 'Sem Nome'}</strong></div>
    
    <div style="margin-top: 10px;">
      ${items || '<p class="center">Nenhum item</p>'}
    </div>
    
    <div class="line" style="margin-top: 20px;"></div>
    <div style="margin-top: 8px; font-size: 11px; color: #444;">Atendente: ${order.operatorName || 'Não informado'}</div>
  `;
}

function buildBillHtml(bill: any): string {
  const items = (bill.items || []).map((i: any) => {
    const qty = i.weight ? `${i.weight.toFixed(3)}kg` : `${i.quantity}x`;
    return `<div class="row"><span>${qty} ${i.name || 'Item'}</span><span>${fmtBRL(i.subtotal || 0)}</span></div>`;
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

  return `
    <div class="big">RESUMO DA CONTA</div>
    <div class="line"></div>
    ${bill.tableNumber ? `<div class="row"><span>Mesa:</span><span>${bill.tableNumber}</span></div>` : ''}
    <div class="row"><span>Cliente:</span><span>${bill.customerName || 'Consumidor'}</span></div>
    <div class="row"><span>Data:</span><span>${fmtDate(createdAt)}</span></div>
    <div class="line"></div>
    <div style="margin: 10px 0;">
      ${items || '<p class="center">Nenhum item</p>'}
    </div>
    <div class="line"></div>
    <div class="row bold" style="font-size: 16px;"><span>TOTAL</span><span>${fmtBRL(bill.total || 0)}</span></div>
    ${payments ? `<div class="line" style="margin-top:10px;"></div><p class="bold">PAGAMENTO:</p>${payments}` : ''}
    <div class="line" style="margin-top: 20px;"></div>
    <p class="center" style="font-size: 12px; margin-top: 10px;">Obrigado pela preferência!</p>
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
