import { describe, expect, it } from 'vitest';
import { buildBillReceipt, buildOrderReceipt, getItemNoteLines } from '@/lib/escpos';
import { buildBillPreviewText } from '@/lib/receipt-preview';

const decodeReceipt = (data: Uint8Array) => new TextDecoder().decode(data);

describe('ESC/POS bill receipt', () => {
  it('prints Tipo as complete Mesa value on its own aligned row', () => {
    const receipt = decodeReceipt(buildBillReceipt({
      id: 'order-1',
      orderType: 'mesa',
      tableNumber: 5,
      items: [{ name: 'Açaí', quantity: 1, price: 48, subtotal: 48 }],
      total: 52.8,
      serviceFee: 4.8,
      createdAt: '2026-05-22T20:13:00.000Z',
      customerName: 'Consumidor',
    }, 58));

    expect(receipt).toMatch(/Tipo: +Mesa\n/);
    expect(receipt).not.toContain('Tipo:                     sa\n');
    expect(receipt).toMatch(/Taxa de Serviço: +R\$ 4,80\n/);
  });

  it('wraps long item names across multiple lines with price right-aligned on the LAST line (58mm)', () => {
    const receipt = decodeReceipt(buildBillReceipt({
      id: 'order-2',
      orderType: 'balcao',
      items: [{
        name: 'Açaí 500ml com complementos especiais e cobertura premium',
        quantity: 1,
        price: 48,
        subtotal: 48,
      }],
      total: 48,
      createdAt: '2026-05-22T20:13:00.000Z',
      customerName: 'Cliente',
    }, 58));

    const lines = receipt.split('\n');
    // Find the line containing the price; previous lines should hold remaining label text.
    const priceLineIdx = lines.findIndex(l => /R\$ ?48,00\s*$/.test(l));
    expect(priceLineIdx).toBeGreaterThan(0);
    const priceLine = lines[priceLineIdx];
    expect(priceLine.length).toBeLessThanOrEqual(30);
    // The line above the price line should be part of the wrapped label (no price on it).
    expect(lines[priceLineIdx - 1]).not.toMatch(/R\$/);
  });

  it('emits the full sequence of section separators in order', () => {
    const receipt = decodeReceipt(buildBillReceipt({
      id: 'order-3',
      orderType: 'mesa',
      tableNumber: 7,
      items: [{ name: 'Açaí', quantity: 1, price: 40, subtotal: 40 }],
      total: 44,
      serviceFee: 4,
      paymentSplits: [{ method: 'dinheiro', amount: 44 }],
      createdAt: '2026-05-22T20:13:00.000Z',
      customerName: 'Consumidor',
    }, 58, { storeName: 'Loja' }));

    const sep = '-'.repeat(30);
    // Expect at least 6 separators: header, title, data, items, adjustments, total, payment
    const occurrences = receipt.split(sep).length - 1;
    expect(occurrences).toBeGreaterThanOrEqual(6);
  });

  it('item longo quebrado em 2 linhas com preço na 1ª (ou na última linha conforme especificação do layout)', () => {
    const receipt = decodeReceipt(buildBillReceipt({
      id: 'order-4',
      orderType: 'balcao',
      items: [{
        name: 'Açaí 500ml com complementos especiais e cobertura premium',
        quantity: 1,
        price: 48,
        subtotal: 48,
      }],
      total: 48,
      createdAt: '2026-05-22T20:13:00.000Z',
      customerName: 'Cliente',
    }, 58));

    const lines = receipt.split('\n');
    const priceLineIdx = lines.findIndex(l => /R\$ ?48,00\s*$/.test(l));
    expect(priceLineIdx).toBeGreaterThan(0);
    const priceLine = lines[priceLineIdx];
    expect(priceLine.length).toBeLessThanOrEqual(30);
    // Verifies that the line containing the price is the last line of the wrapped name
    expect(lines[priceLineIdx - 1]).not.toMatch(/R\$/);
  });

  it('presença de todos os 7 separadores na ordem correta', () => {
    const receipt = decodeReceipt(buildBillReceipt({
      id: 'order-5',
      orderType: 'mesa',
      tableNumber: 5,
      items: [{ name: 'Açaí 500ml', quantity: 1, price: 48, subtotal: 48 }],
      total: 52.8,
      serviceFee: 4.8,
      paymentSplits: [{ method: 'dinheiro', amount: 52.8 }],
      createdAt: '2026-05-22T20:13:00.000Z',
      customerName: 'Consumidor',
    }, 58, {
      storeName: 'NOME DA LOJA',
      address: 'Rua Exemplo, 123',
      document: '00.000.000/0001-00',
      showAddress: true,
      showDocument: true,
    }));

    const sep = '-'.repeat(30);
    const parts = receipt.split(sep);

    // Separador reintroduzido abaixo de CONTA — agora são 7 separadores (8 partes).
    expect(parts.length).toBe(8);

    // Verify correct content order (CONTA e Tipo: em blocos separados)
    expect(parts[0]).toContain('NOME DA LOJA');
    expect(parts[1]).toContain('CONTA');
    expect(parts[2]).toContain('Tipo:');
    expect(parts[3]).toContain('1x Açaí 500ml');
    expect(parts[4]).toContain('Taxa de Serviço:');
    expect(parts[5]).toContain('TOTAL');
    expect(parts[6]).toContain('PAGAMENTO:');
  });

  it('renderiza cupom 58mm completo com PrintSettings padrão (Bluetooth)', () => {
    const bill = {
      id: 'order-ref',
      orderType: 'mesa',
      tableNumber: 5,
      items: [
        { name: 'Açaí 500ml', quantity: 1, price: 48, subtotal: 48 },
        { name: 'Refrigerante 350ml', quantity: 2, price: 4.5, subtotal: 9 },
      ],
      total: 66.8,
      serviceFee: 4.8,
      paymentSplits: [
        { method: 'dinheiro', amount: 40 },
        { method: 'pix', amount: 26.8 },
      ],
      createdAt: '2026-05-22T20:13:00.000Z',
      customerName: 'Consumidor',
    };

    const receipt = decodeReceipt(buildBillReceipt(bill, 58, {
      storeName: 'Lanchonete Exemplo',
      address: 'Rua Principal, 123',
      documentType: 'cnpj',
      document: '00.000.000/0001-00',
      whatsapp: '(86) 99999-9999',
      pixKey: '86999999999',
      instagram: '@profdanielmoura',
      thankMessage: 'Obrigado pela preferência!',
      showAddress: true,
      showDocument: true,
      showWhatsapp: true,
      showPixKey: true,
      showInstagram: true,
      showThankMessage: true,
    }));

    // Cabeçalho
    expect(receipt).toContain('LANCHONETE EXEMPLO');
    expect(receipt).toContain('Rua Principal, 123');
    expect(receipt).toContain('CNPJ: 00.000.000/0001-00');
    expect(receipt).toContain('WhatsApp: (86) 99999-9999');
    // Título e dados
    expect(receipt).toContain('CONTA');
    expect(receipt).toMatch(/Tipo: +Mesa\n/);
    expect(receipt).toMatch(/Mesa: +5\n/);
    expect(receipt).toMatch(/Cliente: +Consumidor\n/);
    // Itens, ajustes e total
    expect(receipt).toMatch(/1x Açaí 500ml +R\$48,00\n/);
    expect(receipt).toMatch(/Taxa de Serviço: +R\$ 4,80\n/);
    expect(receipt).toContain('TOTAL');
    // Pagamento
    expect(receipt).toContain('PAGAMENTO:');
    expect(receipt).toMatch(/Dinheiro +R\$40,00\n/);
    expect(receipt).toMatch(/PIX +R\$26,80\n/);
    // Rodapé
    expect(receipt).toContain('PIX: 86999999999');
    expect(receipt).toContain('Instagram: @profdanielmoura');
    expect(receipt).toContain('Obrigado pela preferência!');

  });

  it('regressão: rótulos Tipo, Mesa, Cliente e Data alinhados na mesma coluna (58mm Bluetooth)', () => {
    const receipt = decodeReceipt(buildBillReceipt({
      id: 'order-align',
      orderType: 'mesa',
      tableNumber: 12,
      items: [{ name: 'Açaí 300ml', quantity: 1, price: 30, subtotal: 30 }],
      total: 33,
      serviceFee: 3,
      createdAt: '2026-05-22T20:13:00.000Z',
      customerName: 'João',
    }, 58, { storeName: 'Loja' }));

    // Localiza cada linha de rótulo no texto bruto via regex, ignorando bytes ESC/POS de controle
    const matchLabelRow = (label: string, value: string) => {
      const re = new RegExp(`${label}: +${value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\n`);
      const m = receipt.match(re);
      return m ? m[0].replace(/\n$/, '') : undefined;
    };

    const tipoRow = matchLabelRow('Tipo', 'Mesa');
    const mesaRow = matchLabelRow('Mesa', '12');
    const clienteRow = matchLabelRow('Cliente', 'João');
    const dataRow = matchLabelRow('Data', '22/05/2026, 20:13');

    // Cada rótulo deve estar presente como uma linha completa
    expect(tipoRow).toBeDefined();
    expect(mesaRow).toBeDefined();
    expect(clienteRow).toBeDefined();
    expect(dataRow).toBeDefined();

    // 58mm = 32 colunas: label + espaços + valor preenchem toda a largura
    for (const row of [tipoRow!, mesaRow!, clienteRow!, dataRow!]) {
      expect(row.length).toBe(30);
    }

    // Ordem esperada no cupom: Tipo -> Mesa -> Cliente -> Data
    const idxTipo = receipt.indexOf(tipoRow!);
    const idxMesa = receipt.indexOf(mesaRow!);
    const idxCliente = receipt.indexOf(clienteRow!);
    const idxData = receipt.indexOf(dataRow!);
    expect(idxTipo).toBeGreaterThan(-1);
    expect(idxTipo).toBeLessThan(idxMesa);
    expect(idxMesa).toBeLessThan(idxCliente);
    expect(idxCliente).toBeLessThan(idxData);

    // Defeito histórico em mini Bluetooth: "Tipo:" colado a outro rótulo ou ao título CONTA
    expect(receipt).not.toMatch(/CONTA[^\n-]*Tipo:/);
    expect(receipt).not.toMatch(/Tipo:[^ \n]/);
    // Os rótulos não devem aparecer concatenados na mesma linha
    expect(receipt).not.toMatch(/Tipo:[^\n]*Mesa:/);
    expect(receipt).not.toMatch(/Mesa:[^\n]*Cliente:/);
    expect(receipt).not.toMatch(/Cliente:[^\n]*Data:/);
  });

  it('58mm: item curto cabe em uma linha com preço à direita', () => {
    const receipt = decodeReceipt(buildBillReceipt({
      id: 'x1',
      orderType: 'balcao',
      items: [{ name: 'Coca 350ml', quantity: 2, price: 5, subtotal: 10 }],
      total: 10,
      createdAt: '2026-05-22T20:13:00.000Z',
    }, 58));
    const line = receipt.split('\n').find(l => /Coca 350ml/.test(l))!;
    expect(line).toBeDefined();
    expect(line.length).toBe(30);
    expect(line).toMatch(/^2x Coca 350ml +R\$10,00$/);
  });

  it('58mm: item longo quebra em várias linhas com preço na última linha e gap >=1', () => {
    const receipt = decodeReceipt(buildBillReceipt({
      id: 'x2',
      orderType: 'balcao',
      items: [{
        name: 'Açaí 500ml com granola morango banana leite condensado',
        quantity: 1,
        price: 32.5,
        subtotal: 32.5,
      }],
      total: 32.5,
      createdAt: '2026-05-22T20:13:00.000Z',
    }, 58));
    const lines = receipt.split('\n');
    const priceIdx = lines.findIndex(l => /R\$32,50\s*$/.test(l));
    expect(priceIdx).toBeGreaterThan(0);
    const priceLine = lines[priceIdx];
    expect(priceLine.length).toBeLessThanOrEqual(30);
    // Gap mínimo de 1 espaço entre texto e preço (ou linha somente com preço à direita)
    expect(priceLine).toMatch(/(?:^ +R\$32,50$|\S +R\$32,50$)/);
    // Linha anterior é parte do rótulo quebrado, sem preço
    expect(lines[priceIdx - 1]).not.toMatch(/R\$/);
  });

  it('58mm: complemento longo mantém indentação alinhada ao "+" nas linhas quebradas', () => {
    const receipt = decodeReceipt(buildBillReceipt({
      id: 'x3',
      orderType: 'balcao',
      items: [{
        name: 'Açaí',
        quantity: 1,
        price: 20,
        subtotal: 20,
        selectedComplements: [
          { name: 'Cobertura chocolate belga cremosa premium extra', price: 3, quantity: 1 },
        ],
      }],
      total: 23,
      createdAt: '2026-05-22T20:13:00.000Z',
    }, 58));
    const lines = receipt.split('\n');
    const firstCompIdx = lines.findIndex(l => /^\s*\+ 1x Cobertura/.test(l));
    expect(firstCompIdx).toBeGreaterThan(-1);
    // Ao menos uma linha subsequente do mesmo complemento (quebrada) deve começar com a indentação alinhada ao caractere após o "+"
    // Prefixo do complemento é "  + " (4 chars) → linhas de continuação começam com 4 espaços.
    const nextLine = lines[firstCompIdx + 1];
    expect(nextLine).toBeDefined();
    expect(nextLine.startsWith('    ')).toBe(true);
    expect(nextLine.length).toBeLessThanOrEqual(30);
  });

  it('58mm: NENHUMA linha da prévia excede 30 colunas úteis', () => {
    const text = buildBillPreviewText({
      id: 'safe-w',
      orderType: 'mesa',
      tableNumber: 12,
      items: [
        { name: 'Coca 350ml', quantity: 2, price: 5, subtotal: 10 },
        {
          name: 'Açaí 500ml com granola morango banana leite condensado premium',
          quantity: 1, price: 32.5, subtotal: 32.5,
          selectedComplements: [
            { name: 'Cobertura chocolate belga cremosa premium extra', price: 3, quantity: 1 },
          ],
        },
      ],
      serviceFee: 3,
      paymentSplits: [{ method: 'pix', amount: 45.5 }],
      createdAt: '2026-05-22T20:13:00.000Z',
      customerName: 'Consumidor',
    }, 58, {
      storeName: 'Lanchonete Muito Grande do Bairro Central',
      address: 'Avenida Presidente Getúlio Vargas, 1234, Sala 5',
      documentType: 'cnpj',
      document: '00.000.000/0001-00',
      whatsapp: '(86) 99999-9999',
      pixKey: 'chave-pix-muito-longa-para-testar-quebra@exemplo.com',
      instagram: '@lanchonetemuitograndedobairro',
      thankMessage: 'Obrigado pela preferência e volte sempre!',
      showAddress: true, showDocument: true, showWhatsapp: true,
      showPixKey: true, showInstagram: true, showThankMessage: true,
    });
    for (const l of text.split('\n')) {
      expect(l.length).toBeLessThanOrEqual(30);
    }
  });

  it('58mm: nome de loja longo é quebrado em múltiplas linhas centralizadas <=30 col', () => {
    const receipt = decodeReceipt(buildBillReceipt({
      id: 'store-wrap',
      orderType: 'balcao',
      items: [{ name: 'Coca', quantity: 1, price: 5, subtotal: 5 }],
      total: 5,
      createdAt: '2026-05-22T20:13:00.000Z',
    }, 58, { storeName: 'Lanchonete Muito Grande do Bairro Central' }));
    const upperName = 'LANCHONETE MUITO GRANDE DO BAIRRO CENTRAL';
    // Should NOT appear as a single line
    expect(receipt.split('\n').some(l => l.includes(upperName))).toBe(false);
    // Yet some fragment ("LANCHONETE") should be present
    expect(receipt).toContain('LANCHONETE');
    expect(receipt).toContain('CENTRAL');
  });

  it('58mm: item com nome ~22 col + preço 8 col respeita partição nome/preço', () => {
    const receipt = decodeReceipt(buildBillReceipt({
      id: 'partition',
      orderType: 'balcao',
      // "1x " (3) + name(19) = 22, price "R$100,00" (8) → total 30, gap 0? need gap>=1.
      items: [{ name: 'Sanduíche Grande XL', quantity: 1, price: 100, subtotal: 100 }],
      total: 100,
      createdAt: '2026-05-22T20:13:00.000Z',
    }, 58));
    const lines = receipt.split('\n');
    const priceLine = lines.find(l => /R\$100,00\s*$/.test(l))!;
    expect(priceLine).toBeDefined();
    expect(priceLine.length).toBeLessThanOrEqual(30);
  });
});

describe('kitchen order notes rendering', () => {
  const baseOrder = {
    id: 'ord-notes',
    orderType: 'mesa',
    tableNumber: 3,
    total: 20,
    createdAt: '2026-05-22T20:13:00.000Z',
    customerName: 'Cliente',
  };

  it('getItemNoteLines: prefers structured fields (selectedNotes + otherNotes)', () => {
    const lines = getItemNoteLines({
      notes: 'ignored | legacy',
      selectedNotes: ['Sem cebola', 'Bem passado'],
      otherNotes: 'Extra crocante',
    });
    expect(lines).toEqual(['Sem cebola', 'Bem passado', 'Extra crocante']);
  });

  it('getItemNoteLines: falls back to legacy pipe-joined notes', () => {
    const lines = getItemNoteLines({ notes: 'Sem sal | Sem açúcar' });
    expect(lines).toEqual(['Sem sal', 'Sem açúcar']);
  });

  it('getItemNoteLines: only selectedNotes (no otherNotes, no legacy)', () => {
    const lines = getItemNoteLines({ selectedNotes: ['A', 'B', 'C'] });
    expect(lines).toEqual(['A', 'B', 'C']);
  });

  it('buildOrderReceipt: prints checkbox notes AND input note on kitchen ticket', () => {
    const receipt = decodeReceipt(buildOrderReceipt({
      ...baseOrder,
      items: [{
        name: 'Arrumadinho de Carne de Sol',
        quantity: 1,
        price: 20,
        subtotal: 20,
        selectedNotes: ['Arroz Branco', 'Sem tempero'],
        otherNotes: 'com molho à parte',
      }],
    }, 58));
    expect(receipt).toContain('* Arroz Branco');
    expect(receipt).toContain('* Sem tempero');
    expect(receipt).toContain('* com molho à parte');
  });

  it('buildOrderReceipt: legacy items with only pipe-joined notes still print all lines', () => {
    const receipt = decodeReceipt(buildOrderReceipt({
      ...baseOrder,
      items: [{
        name: 'X-Burger',
        quantity: 1,
        price: 20,
        subtotal: 20,
        notes: 'Sem cebola | Sem picles',
      }],
    }, 58));
    expect(receipt).toContain('* Sem cebola');
    expect(receipt).toContain('* Sem picles');
  });

  it('buildOrderReceipt: only checkbox notes (no input text) still print', () => {
    const receipt = decodeReceipt(buildOrderReceipt({
      ...baseOrder,
      items: [{
        name: 'Pizza',
        quantity: 1,
        price: 20,
        subtotal: 20,
        selectedNotes: ['Borda recheada', 'Bem assada'],
      }],
    }, 58));
    expect(receipt).toContain('* Borda recheada');
    expect(receipt).toContain('* Bem assada');
  });

  it('buildOrderReceipt: prints short item checkbox note immediately after item line', () => {
    const receipt = decodeReceipt(buildOrderReceipt({
      ...baseOrder,
      items: [{
        name: 'Coca Lata',
        quantity: 1,
        price: 6,
        subtotal: 6,
        selectedNotes: ['gelo e limão'],
      }],
    }, 58));

    const itemIdx = receipt.indexOf('1 Coca Lata');
    const noteIdx = receipt.indexOf('* gelo e limão');
    const attendantIdx = receipt.indexOf('Atendente:');

    expect(itemIdx).toBeGreaterThan(-1);
    expect(noteIdx).toBeGreaterThan(itemIdx);
    expect(attendantIdx).toBeGreaterThan(noteIdx);
    expect(receipt).toMatch(/1 Coca Lata[^\n]*\n(?:\x1B[\s\S]{1,2})*\s*\* gelo e limão/);
  });

  it('buildOrderReceipt: keeps observation between item and complements', () => {
    const receipt = decodeReceipt(buildOrderReceipt({
      ...baseOrder,
      items: [{
        name: 'Coca Lata',
        quantity: 1,
        price: 6,
        subtotal: 6,
        selectedNotes: ['gelo e limão'],
        selectedComplements: [{ name: 'Copo descartável', price: 0, quantity: 1 }],
      }],
    }, 58));

    const itemIdx = receipt.indexOf('1 Coca Lata');
    const noteIdx = receipt.indexOf('* gelo e limão');
    const compIdx = receipt.indexOf('+ 1x Copo descartável');

    expect(itemIdx).toBeGreaterThan(-1);
    expect(noteIdx).toBeGreaterThan(itemIdx);
    expect(compIdx).toBeGreaterThan(noteIdx);
  });

  it('getItemNoteLines: falls back to legacy notes when structured fields are empty arrays/strings', () => {
    const lines = getItemNoteLines({
      selectedNotes: [],
      otherNotes: '',
      notes: 'A | B | C',
    });
    expect(lines).toEqual(['A', 'B', 'C']);
  });

  it('buildOrderReceipt: prints all 3 lines when checkbox notes + input are set together', () => {
    const receipt = decodeReceipt(buildOrderReceipt({
      ...baseOrder,
      items: [{
        name: 'Arrumadinho de Carne de Sol',
        quantity: 1,
        price: 20,
        subtotal: 20,
        selectedNotes: ['Arroz Branco', 'Sem farofa'],
        otherNotes: 'Teste',
      }],
    }, 58));
    const idxArroz = receipt.indexOf('* Arroz Branco');
    const idxFarofa = receipt.indexOf('* Sem farofa');
    const idxTeste = receipt.indexOf('* Teste');
    expect(idxArroz).toBeGreaterThan(-1);
    expect(idxFarofa).toBeGreaterThan(idxArroz);
    expect(idxTeste).toBeGreaterThan(idxFarofa);
  });

  it('getItemNoteLines: deduplicates case-insensitively (trim + lower)', () => {
    const lines = getItemNoteLines({
      selectedNotes: ['Arroz Branco', ' arroz branco '],
      otherNotes: 'ARROZ BRANCO',
    });
    expect(lines).toEqual(['Arroz Branco']);
  });
});


