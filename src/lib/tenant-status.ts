export type TenantStatus = 'active' | 'inactive' | 'missing';

/** Only an active store may be shown; inactive or deleted stores show "Loja não encontrada". */
export function isStoreAvailable(status: TenantStatus | null | undefined): boolean {
  return status === 'active';
}

export function normalizeTenantStatus(v: unknown): TenantStatus {
  return v === 'active' || v === 'inactive' ? v : 'missing';
}
