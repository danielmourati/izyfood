/** Converte a seleção da tela ({itemId: quantidade}) no formato aceito pelo banco, ignorando zeros. */
export function buildTransferSelection(selected: Record<string, number>): { id: string; qty: number }[] {
  return Object.entries(selected)
    .filter(([, q]) => q > 0)
    .map(([id, qty]) => ({ id, qty }));
}

/** Mensagem amigável para erros de troca de mesa vindos do banco. */
export function tableMoveErrorMessage(err: unknown): string {
  const msg = String((err as any)?.message || err || '');
  const m = msg.match(/Mesa (\d+) já está ocupada|table (\d+) already has an open order/);
  if (m) return `Mesa ${m[1] || m[2]} já está ocupada.`;
  return 'Não foi possível trocar de mesa.';
}

export function isTableOccupiedError(err: unknown): boolean {
  return /já está ocupada|already has an open order|order is closed/.test(String((err as any)?.message || ''));
}
