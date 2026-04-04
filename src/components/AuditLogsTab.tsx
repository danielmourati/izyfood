import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Search, FileText } from 'lucide-react';

interface AuditLog {
  id: string;
  user_name: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  details: Record<string, unknown>;
  created_at: string;
}

const entityLabels: Record<string, string> = {
  cash_register: 'Caixa',
  cash_movement: 'Movimentação',
  order: 'Pedido',
  sale: 'Venda',
  product: 'Produto',
  customer: 'Cliente',
  settings: 'Configurações',
  user: 'Usuário',
};

const actionLabels: Record<string, { label: string; color: string }> = {
  open: { label: 'Abertura', color: 'bg-green-500/10 text-green-700 dark:text-green-400' },
  close: { label: 'Fechamento', color: 'bg-blue-500/10 text-blue-700 dark:text-blue-400' },
  create: { label: 'Criação', color: 'bg-green-500/10 text-green-700 dark:text-green-400' },
  update: { label: 'Alteração', color: 'bg-amber-500/10 text-amber-700 dark:text-amber-400' },
  delete: { label: 'Exclusão', color: 'bg-red-500/10 text-red-700 dark:text-red-400' },
  cancel: { label: 'Cancelamento', color: 'bg-red-500/10 text-red-700 dark:text-red-400' },
  entrada: { label: 'Entrada', color: 'bg-green-500/10 text-green-700 dark:text-green-400' },
  saida: { label: 'Saída', color: 'bg-red-500/10 text-red-700 dark:text-red-400' },
  admin_auth: { label: 'Autorização Admin', color: 'bg-purple-500/10 text-purple-700 dark:text-purple-400' },
  finalize: { label: 'Finalização', color: 'bg-blue-500/10 text-blue-700 dark:text-blue-400' },
};

export function AuditLogsTab() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetchLogs();
  }, []);

  async function fetchLogs() {
    setLoading(true);
    const { data } = await supabase
      .from('audit_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200) as any;
    setLogs(data || []);
    setLoading(false);
  }

  const filtered = logs.filter(log => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      log.user_name.toLowerCase().includes(s) ||
      log.action.toLowerCase().includes(s) ||
      (entityLabels[log.entity_type] || log.entity_type).toLowerCase().includes(s) ||
      JSON.stringify(log.details).toLowerCase().includes(s)
    );
  });

  function formatDate(iso: string) {
    return new Date(iso).toLocaleString('pt-BR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    });
  }

  function formatDetails(details: Record<string, unknown>): string {
    if (!details || Object.keys(details).length === 0) return '';
    return Object.entries(details)
      .map(([k, v]) => `${k}: ${typeof v === 'number' ? v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : v}`)
      .join(' | ');
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-32">
        <div className="h-6 w-6 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por usuário, ação, entidade..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p>Nenhum registro encontrado</p>
        </div>
      ) : (
        <div className="space-y-2 max-h-[60vh] overflow-auto">
          {filtered.map(log => {
            const actionInfo = actionLabels[log.action] || { label: log.action, color: 'bg-muted text-foreground' };
            const entityLabel = entityLabels[log.entity_type] || log.entity_type;
            const detailStr = formatDetails(log.details);

            return (
              <div key={log.id} className="rounded-lg border border-border bg-card p-3 space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline" className={actionInfo.color}>
                      {actionInfo.label}
                    </Badge>
                    <Badge variant="secondary">{entityLabel}</Badge>
                    <span className="text-sm font-medium text-foreground">{log.user_name}</span>
                  </div>
                  <span className="text-xs text-muted-foreground whitespace-nowrap">{formatDate(log.created_at)}</span>
                </div>
                {detailStr && (
                  <p className="text-xs text-muted-foreground">{detailStr}</p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
