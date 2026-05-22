import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useStore } from '@/contexts/StoreContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { CheckCircle2, XCircle, RefreshCw, Database, HardDrive, Cpu } from 'lucide-react';
import { PrintSettings } from '@/lib/escpos';

interface SourceSnapshot {
  source: 'Banco de Dados (Supabase)' | 'localStorage' | 'Memória (__printSettingsCache)' | 'StoreContext';
  icon: React.ElementType;
  data: Partial<PrintSettings> | null;
  error?: string;
}

const TOGGLE_KEYS: (keyof PrintSettings)[] = [
  'showAddress', 'showDocument', 'showWhatsapp',
  'showPixKey', 'showInstagram', 'showThankMessage',
];
const TEXT_KEYS: (keyof PrintSettings)[] = [
  'storeName', 'address', 'document', 'whatsapp',
  'pixKey', 'instagram', 'thankMessage',
];

const LABELS: Record<keyof PrintSettings, string> = {
  storeName: 'Nome da Loja', address: 'Endereço', document: 'CPF/CNPJ',
  documentType: 'Tipo Doc.', whatsapp: 'WhatsApp', pixKey: 'Chave PIX',
  instagram: 'Instagram', thankMessage: 'Mensagem Agradecimento',
  showAddress: 'Mostrar Endereço', showDocument: 'Mostrar Doc.',
  showWhatsapp: 'Mostrar WhatsApp', showPixKey: 'Mostrar PIX',
  showInstagram: 'Mostrar Instagram', showThankMessage: 'Mostrar Mensagem',
};

export default function DiagnosticoSync() {
  const { user } = useAuth();
  const { printSettings: contextPs } = useStore();
  const [snapshots, setSnapshots] = useState<SourceSnapshot[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = async () => {
    setLoading(true);
    const tenantId = user?.tenantId;

    // 1. Supabase DB
    let dbData: Partial<PrintSettings> | null = null;
    let dbError: string | undefined;
    if (tenantId) {
      const { data, error } = await supabase
        .from('store_settings')
        .select('print_settings')
        .eq('tenant_id', tenantId)
        .limit(1)
        .maybeSingle();
      if (error) dbError = error.message;
      else dbData = (data as any)?.print_settings ?? null;
    } else {
      dbError = 'tenantId não disponível';
    }

    // 2. localStorage
    let lsData: Partial<PrintSettings> | null = null;
    let lsError: string | undefined;
    if (tenantId) {
      const raw = localStorage.getItem(`print_settings_${tenantId}`);
      if (raw) {
        try { lsData = JSON.parse(raw); } catch { lsError = 'JSON inválido'; }
      } else {
        lsError = 'Chave não encontrada';
      }
    }

    // 3. window cache
    const windowData: Partial<PrintSettings> | null =
      (window as any).__printSettingsCache ?? null;

    setSnapshots([
      { source: 'Banco de Dados (Supabase)', icon: Database, data: dbData, error: dbError },
      { source: 'localStorage', icon: HardDrive, data: lsData, error: lsError },
      { source: 'Memória (__printSettingsCache)', icon: Cpu, data: windowData, error: windowData ? undefined : 'Cache vazio' },
      { source: 'StoreContext', icon: RefreshCw, data: contextPs as Partial<PrintSettings> },
    ]);
    setLoading(false);
  };

  useEffect(() => { refresh(); }, [user?.tenantId]);

  const hasData = (d: Partial<PrintSettings> | null) =>
    d && typeof d === 'object' && Object.keys(d).length > 0;

  const renderValue = (key: keyof PrintSettings, val: any) => {
    if (TOGGLE_KEYS.includes(key)) {
      return val === true
        ? <Badge className="bg-green-600 text-white text-xs">ON</Badge>
        : <Badge variant="outline" className="text-xs text-muted-foreground">OFF</Badge>;
    }
    return <span className="text-xs text-foreground truncate max-w-[180px]">{val ? String(val) : <span className="text-muted-foreground italic">vazio</span>}</span>;
  };

  return (
    <div className="h-full overflow-y-auto p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Diagnóstico de Sincronização</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Compara as configurações de impressão entre banco de dados, cache local e memória
          </p>
        </div>
        <Button onClick={refresh} disabled={loading} variant="outline" className="gap-2">
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Atualizar
        </Button>
      </div>

      {/* Summary row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {snapshots.map(s => {
          const ok = hasData(s.data) && !s.error;
          const Icon = s.icon;
          return (
            <Card key={s.source} className={`border-2 ${ok ? 'border-green-500/40 bg-green-500/5' : 'border-destructive/30 bg-destructive/5'}`}>
              <CardContent className="p-3 flex items-center gap-3">
                <Icon className={`h-5 w-5 shrink-0 ${ok ? 'text-green-600' : 'text-destructive'}`} />
                <div className="min-w-0">
                  <p className="text-xs font-semibold truncate">{s.source}</p>
                  {ok
                    ? <p className="text-xs text-green-600 flex items-center gap-1"><CheckCircle2 className="h-3 w-3" /> Sincronizado</p>
                    : <p className="text-xs text-destructive flex items-center gap-1"><XCircle className="h-3 w-3" />{s.error ?? 'Sem dados'}</p>
                  }
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Toggle summary */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Toggles de Visibilidade</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2 pr-4 font-medium text-muted-foreground">Campo</th>
                {snapshots.map(s => (
                  <th key={s.source} className="text-center py-2 px-2 font-medium text-muted-foreground text-xs">{s.source.split(' ')[0]}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {TOGGLE_KEYS.map(k => (
                <tr key={k} className="border-b last:border-0">
                  <td className="py-1.5 pr-4 text-xs">{LABELS[k]}</td>
                  {snapshots.map(s => (
                    <td key={s.source} className="text-center py-1.5 px-2">
                      {s.data ? renderValue(k, (s.data as any)[k]) : <span className="text-muted-foreground text-xs">—</span>}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Text fields summary */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Campos de Texto</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2 pr-4 font-medium text-muted-foreground">Campo</th>
                {snapshots.map(s => (
                  <th key={s.source} className="text-left py-2 px-2 font-medium text-muted-foreground text-xs">{s.source.split(' ')[0]}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {TEXT_KEYS.map(k => (
                <tr key={k} className="border-b last:border-0">
                  <td className="py-1.5 pr-4 text-xs">{LABELS[k]}</td>
                  {snapshots.map(s => (
                    <td key={s.source} className="py-1.5 px-2 max-w-[160px]">
                      {s.data ? renderValue(k, (s.data as any)[k]) : <span className="text-muted-foreground text-xs">—</span>}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground text-center">
        Todas as 4 colunas devem mostrar os mesmos valores quando a sincronização está funcionando corretamente.
      </p>
    </div>
  );
}
