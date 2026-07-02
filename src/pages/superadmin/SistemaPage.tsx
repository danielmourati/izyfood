import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Settings2, Wallet, ShieldCheck } from 'lucide-react';

export function SistemaPage() {
  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-center gap-3">
        <Settings2 className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-heading font-bold">Sistema</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Wallet className="h-4 w-4" /> Integração Mercado Pago
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p className="text-muted-foreground">
            A cobrança automática dos planos PRO via PIX (QR Code / copia-e-cola) será ativada na próxima
            iteração. Depois de ativada, esta seção permitirá:
          </p>
          <ul className="list-disc pl-5 text-muted-foreground space-y-1">
            <li>Cadastrar o access token do Mercado Pago</li>
            <li>Definir a URL do webhook de confirmação</li>
            <li>Testar a geração de um pagamento PIX</li>
            <li>Ver histórico de transações e status por tenant</li>
          </ul>
          <div className="mt-3 inline-flex items-center gap-2 rounded-lg bg-warning/10 border border-warning/30 px-3 py-2 text-warning-foreground text-xs">
            Aguardando integração Mercado Pago
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ShieldCheck className="h-4 w-4" /> Segurança
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>Todas as operações do Super Admin ficam registradas em Auditoria.</p>
          <p>Acesso restrito por RLS e pelo papel <code className="text-xs">superadmin</code>.</p>
        </CardContent>
      </Card>
    </div>
  );
}
