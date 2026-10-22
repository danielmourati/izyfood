// Each tenant user gets a private sign-in address so the same real e-mail
// can exist in several tenants. The real e-mail lives in profiles/tenant_members.
export function makeTenantLoginEmail(slug: string): string {
  const safe = String(slug || 'loja').toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 40) || 'loja'
  const id = crypto.randomUUID().replace(/-/g, '').slice(0, 16)
  return `u-${id}@t-${safe}.users.degust.app`
}
