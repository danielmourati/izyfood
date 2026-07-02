import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { FileText, Search } from 'lucide-react';

interface AuditLog {
  id: string;
  user_name: string | null;
  tenant_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  details: any;
  created_at: string;
}

export function AuditoriaPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [tenants, setTenants] = useState<Record<string, string>>({});
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [logsRes, tenantsRes] = await Promise.all([
        supabase.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(500),
        supabase.from('tenants').select('id, name'),
      ]);
      setLogs((logsRes.data as any) || []);
      const map: Record<string, string> = {};
      (tenantsRes.data || []).forEach((t: any) => { map[t.id] = t.name; });
      setTenants(map);
      setLoading(false);
    })();
  }, []);

  const filtered = logs.filter(l => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (l.user_name || '').toLowerCase().includes(q)
      || l.action.toLowerCase().includes(q)
      || l.entity_type.toLowerCase().includes(q)
      || (tenants[l.tenant_id || ''] || '').toLowerCase().includes(q);
  });

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-center gap-3">
        <FileText className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-heading font-bold">Auditoria Global</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Últimos 500 eventos</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por usuário, tenant, ação..." className="pl-9" />
          </div>

          {loading ? (
            <p className="text-sm text-muted-foreground">Carregando...</p>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum evento encontrado.</p>
          ) : (
            <div className="space-y-2 max-h-[70vh] overflow-y-auto">
              {filtered.map(l => (
                <div key={l.id} className="flex flex-wrap items-center gap-2 p-3 rounded-lg border border-border text-xs">
                  <span className="text-muted-foreground">
                    {new Date(l.created_at).toLocaleString('pt-BR')}
                  </span>
                  <Badge variant="outline">{tenants[l.tenant_id || ''] || l.tenant_id?.slice(0, 8) || '—'}</Badge>
                  <Badge variant="secondary">{l.action}</Badge>
                  <span className="font-mono text-muted-foreground">{l.entity_type}</span>
                  <span className="text-foreground font-medium">{l.user_name || 'sistema'}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
