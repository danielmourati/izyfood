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
  connection_type: 'bluetooth' | 'network';
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
    if (data) setPrinters(data as unknown as PrinterConfig[]);
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
    const qty = i.weight ? `${i.weight.toFixed(3)}kg` : `${i.quantity}x`;
    let html = `<p>${qty} ${i.name}</p>`;
    if (i.notes) {
      html += `<p style="margin: -6px 0 6px 12px; font-size: 11px; font-weight: bold;">[Obs: ${i.notes}]</p>`;
    }
    return html;
  }).join('');
  return `
    <div class="big">COMANDA</div>
    <div class="line"></div>
    <div class="row"><span>Tipo:</span><span>${orderTypeLabels[order.orderType] || order.orderType}</span></div>
    ${order.tableNumber ? `<div class="row"><span>Mesa:</span><span>${order.tableNumber}</span></div>` : ''}
    ${order.customerName ? `<div class="row"><span>Cliente:</span><span>${order.customerName}</span></div>` : ''}
    ${order.operatorName ? `<div class="row"><span>Operador:</span><span>${order.operatorName}</span></div>` : ''}
    <div class="row"><span>Data:</span><span>${fmtDate(order.createdAt)}</span></div>
    <div class="line"></div>
    <p class="bold">ITENS:</p>
    ${items}
    <div class="line"></div>
    <p>Pedido #${(order.id || '').slice(0, 8)}</p>
  `;
}

function buildBillHtml(bill: any): string {
  const items = (bill.items || []).map((i: any) => {
    const qty = i.weight ? `${i.weight.toFixed(3)}kg` : `${i.quantity}x`;
    return `<div class="row"><span>${qty} ${i.name}</span><span>${fmtBRL(i.subtotal)}</span></div>`;
  }).join('');

  let payments = '';
  if (bill.paymentSplits?.length) {
    payments = bill.paymentSplits.map((s: any) =>
      `<div class="row"><span>${paymentLabels[s.method] || s.method}</span><span>${fmtBRL(s.amount)}</span></div>`
    ).join('');
  } else if (bill.paymentMethod) {
    payments = `<div class="row"><span>Pgto:</span><span>${paymentLabels[bill.paymentMethod] || bill.paymentMethod}</span></div>`;
  }

  return `
    <div class="big">CONTA</div>
    <div class="line"></div>
    ${bill.tableNumber ? `<div class="row"><span>Mesa:</span><span>${bill.tableNumber}</span></div>` : ''}
    ${bill.customerName ? `<div class="row"><span>Cliente:</span><span>${bill.customerName}</span></div>` : ''}
    <div class="row"><span>Data:</span><span>${fmtDate(bill.createdAt)}</span></div>
    <div class="line"></div>
    ${items}
    <div class="line"></div>
    <div class="row bold"><span>TOTAL</span><span>${fmtBRL(bill.total)}</span></div>
    ${payments ? `<div class="line"></div><p class="bold">PAGAMENTO:</p>${payments}` : ''}
    <div class="line"></div>
    <p class="center">Obrigado pela preferência!</p>
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
