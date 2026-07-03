import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import {
  Printer, Plus, Trash2, Bluetooth, Wifi, TestTube, Loader2, Monitor,
  Download, HelpCircle, PlugZap, CheckCircle2, ShieldCheck, FileDown,
  ExternalLink, Lock, Sparkles, ChefHat,
} from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { usePrinter, type PrinterConfig } from '@/hooks/use-printer';
import { useAuth } from '@/contexts/AuthContext';
import { useStore } from '@/contexts/StoreContext';
import { supabase } from '@/integrations/supabase/client';
import { getQzPrinters } from '@/lib/printer';
import { fetchTenantCertPem, downloadMenuzinBat, downloadCertPem } from '@/lib/qz-installer';

const QZ_DOWNLOAD_URL = 'https://qz.io/download/';
const QZ_CERT_URL = 'https://qz.io/wiki/2.0-signing-messages';

const ESCPOS_PROFILES: { value: string; label: string }[] = [
  { value: 'generic', label: 'Genérico ESC/POS' },
  { value: 'epson_tm', label: 'Epson TM Series' },
  { value: 'bematech_mp', label: 'Bematech MP Series' },
  { value: 'elgin_i9', label: 'Elgin i9' },
  { value: 'custom', label: 'Personalizado' },
];

const SECTORS: { value: 'recibo' | 'cozinha' | 'bar' | 'balcao'; label: string }[] = [
  { value: 'recibo', label: 'Recibo (padrão)' },
  { value: 'cozinha', label: 'Cozinha' },
  { value: 'bar', label: 'Bar' },
  { value: 'balcao', label: 'Balcão' },
];

type Feedback = { type: 'success' | 'error' | 'info'; message: string } | null;

export function ImpressoraTab() {
  const { user } = useAuth();
  const { storeSettings } = useStore() as any;
  const tenantLabel: string = storeSettings?.name || user?.tenantName || 'Estabelecimento';

  const {
    printers, loading, btAvailable, btConnected, btDeviceName, lastPairedName,
    qzConnected, retryQzConnection,
    fetchPrinters, pairBluetooth, unpairBluetooth, reconnectPrinter, forgetPrinter, printTest,
  } = usePrinter();

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    name: '',
    model: 'ESC/POS compatível',
    connection_type: 'system' as 'bluetooth' | 'network' | 'system',
    escpos_profile: 'generic',
    address: '',
    paper_width: 80,
    is_default: false,
    auto_connect_qz: true,
    sector: 'recibo' as 'recibo' | 'cozinha' | 'bar' | 'balcao',
  });
  const [saving, setSaving] = useState(false);
  const [pairing, setPairing] = useState(false);
  const [testing, setTesting] = useState(false);
  const [detectingQz, setDetectingQz] = useState(false);
  const [testingQz, setTestingQz] = useState(false);
  const [qzFeedback, setQzFeedback] = useState<Feedback>(null);
  const [pairFeedback, setPairFeedback] = useState<Feedback>(null);
  const [formFeedback, setFormFeedback] = useState<Feedback>(null);
  const [testFeedback, setTestFeedback] = useState<Feedback>(null);
  const [qzPrintersList, setQzPrintersList] = useState<string[]>([]);

  const isDesktop = React.useMemo(
    () => !/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent),
    []
  );

  React.useEffect(() => {
    if (qzConnected && showForm && form.connection_type === 'system') {
      getQzPrinters().then(setQzPrintersList);
    }
  }, [qzConnected, showForm, form.connection_type]);

  const resetForm = () => {
    setForm({
      name: '', model: 'ESC/POS compatível', connection_type: 'system', escpos_profile: 'generic',
      address: '', paper_width: 80, is_default: false, auto_connect_qz: true,
    });
    setFormFeedback(null);
    setShowForm(false);
  };

  const handleSave = async () => {
    setFormFeedback(null);
    if (!form.name.trim()) {
      setFormFeedback({ type: 'error', message: 'Informe o nome da impressora.' });
      return;
    }
    if (!user?.tenantId) return;
    setSaving(true);
    try {
      if (form.is_default) {
        await supabase.from('printer_configs').update({ is_default: false } as any).eq('is_default', true);
      }

      const payload: any = {
        name: form.name.trim(),
        model: form.model.trim() || 'ESC/POS compatível',
        escpos_profile: form.escpos_profile,
        auto_connect_qz: form.auto_connect_qz,
        connection_type: form.connection_type === 'system' ? 'network' : form.connection_type,
        address: form.connection_type === 'system' ? `SYSTEM:${form.address.trim() || 'BROWSER'}` : (form.address.trim() || ''),
        paper_width: form.paper_width,
        is_default: form.is_default,
        tenant_id: user.tenantId,
      };

      const { error } = await supabase.from('printer_configs').insert(payload);
      if (error) throw error;

      setFormFeedback({ type: 'success', message: 'Impressora salva com sucesso!' });
      setTimeout(() => resetForm(), 800);
      fetchPrinters();
    } catch (err: any) {
      console.error('Error saving printer:', err);
      setFormFeedback({ type: 'error', message: 'Erro ao salvar: ' + (err.message || 'Verifique sua conexão') });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    await supabase.from('printer_configs').delete().eq('id', id);
    fetchPrinters();
  };

  const handleSetDefault = async (id: string) => {
    await supabase.from('printer_configs').update({ is_default: false } as any).eq('is_default', true);
    await supabase.from('printer_configs').update({ is_default: true } as any).eq('id', id);
    fetchPrinters();
  };

  const handleDetectQz = async () => {
    setDetectingQz(true);
    setQzFeedback(null);
    const ready = await retryQzConnection();
    setDetectingQz(false);
    if (ready) {
      setQzFeedback({ type: 'success', message: 'QZ Tray conectado e pronto para uso.' });
    } else {
      setQzFeedback({
        type: 'error',
        message: 'QZ Tray não detectado. Verifique se o aplicativo está aberto e rodando na bandeja do sistema.',
      });
    }
  };

  const handleTestQzConnection = async () => {
    setTestingQz(true);
    setQzFeedback(null);
    try {
      const ready = qzConnected || (await retryQzConnection());
      if (!ready) {
        setQzFeedback({ type: 'error', message: 'QZ Tray não está conectado.' });
        return;
      }
      const printers = await getQzPrinters();
      setQzPrintersList(printers);
      setQzFeedback({
        type: 'success',
        message: `Conexão OK. ${printers.length} impressora(s) do sistema detectada(s).`,
      });
    } catch (e: any) {
      setQzFeedback({ type: 'error', message: e?.message || 'Falha no teste de conexão.' });
    } finally {
      setTestingQz(false);
    }
  };

  const handlePair = async () => {
    setPairing(true);
    setPairFeedback(null);
    try {
      const name = await pairBluetooth();
      setPairFeedback({ type: 'success', message: `Conectado a: ${name}` });
    } catch (e: any) {
      let msg = 'Erro ao parear.';
      if (e.name === 'NotFoundError') msg = 'Nenhuma impressora selecionada.';
      else if (e.name === 'SecurityError') msg = 'Permissão negada pelo navegador.';
      else msg = e.message || 'Erro desconhecido.';
      setPairFeedback({ type: 'error', message: msg });
    } finally {
      setPairing(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setTestFeedback(null);
    try {
      await printTest();
      setTestFeedback({ type: 'success', message: 'Impressão de teste enviada.' });
    } catch (e: any) {
      setTestFeedback({ type: 'error', message: e?.message || 'Falha ao imprimir teste.' });
    }
    setTesting(false);
  };

  const renderFeedback = (fb: Feedback) => {
    if (!fb) return null;
    const cls =
      fb.type === 'success'
        ? 'border-success/40 bg-success/10 text-success-foreground'
        : fb.type === 'error'
        ? 'border-destructive/40 bg-destructive/10 text-destructive'
        : 'border-muted bg-muted/40';
    return (
      <Alert className={cls}>
        <AlertDescription className="text-sm">{fb.message}</AlertDescription>
      </Alert>
    );
  };

  return (
    <div className="space-y-4">
      {/* Card 1 — QZ Tray Status */}
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-3 flex-wrap">
          <div>
            <CardTitle className="flex items-center gap-2 flex-wrap">
              <PlugZap className="h-5 w-5" /> Status do QZ Tray
              <Badge
                variant={qzConnected ? 'default' : 'secondary'}
                className={qzConnected ? 'bg-success text-success-foreground' : ''}
              >
                {qzConnected ? (
                  <span className="flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3" /> Cert: {tenantLabel}
                  </span>
                ) : (
                  'Não detectado'
                )}
              </Badge>
            </CardTitle>
          </div>
          <Button variant="outline" size="sm" className="gap-1.5" asChild>
            <a href={QZ_DOWNLOAD_URL} target="_blank" rel="noreferrer">
              <HelpCircle className="h-4 w-4" /> Como instalar
            </a>
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm text-muted-foreground flex-1 min-w-[180px]">
              {qzConnected
                ? 'Agente de impressão ativo. Impressões vão direto para a impressora sem janela de confirmação.'
                : 'Clique em Detectar para verificar se o QZ Tray está rodando neste computador.'}
            </p>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={handleDetectQz} disabled={detectingQz}>
              {detectingQz ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlugZap className="h-4 w-4" />} Detectar
            </Button>
            <Button size="sm" className="gap-1.5" onClick={handleTestQzConnection} disabled={testingQz}>
              {testingQz ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />} Teste de conexão
            </Button>
          </div>

          {renderFeedback(qzFeedback)}

          <Accordion type="single" collapsible>
            <AccordionItem value="help" className="border rounded-lg">
              <AccordionTrigger className="px-3 py-2 text-sm hover:no-underline">
                Ajuda & solução de problemas
              </AccordionTrigger>
              <AccordionContent className="px-3 pb-3 text-sm text-muted-foreground space-y-1.5">
                <p>• Certifique-se de que o QZ Tray está em execução (ícone na bandeja).</p>
                <p>• Verifique se a porta 8181 (WebSocket) não está bloqueada pelo firewall.</p>
                <p>• Se o navegador pedir para confiar em um certificado, aceite a solicitação.</p>
                <p>• Reinicie o QZ Tray e recarregue esta página se a conexão ficar instável.</p>
                <p>• Em ambientes corporativos, verifique com o TI se HTTPS/WSS está liberado.</p>
              </AccordionContent>
            </AccordionItem>
          </Accordion>

          {isDesktop && (
            <div className="border rounded-lg p-3 space-y-2">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="space-y-1">
                  <p className="font-semibold text-sm flex items-center gap-2 flex-wrap">
                    Configurar confiança permanente (Windows)
                    <Badge variant="outline" className="text-xs">
                      <ShieldCheck className="h-3 w-3 mr-1" /> Cert próprio: {tenantLabel}
                    </Badge>
                  </p>
                  <ol className="text-xs text-muted-foreground space-y-0.5 list-decimal list-inside">
                    <li>Baixe o instalador abaixo.</li>
                    <li>Clique direito → <strong>Executar como administrador</strong>.</li>
                    <li>Volte aqui e clique em <strong>Detectar</strong>. O prompt não deve mais aparecer.</li>
                  </ol>
                </div>
                <Button size="sm" className="gap-1.5" asChild>
                  <a href={QZ_DOWNLOAD_URL} target="_blank" rel="noreferrer">
                    <Download className="h-4 w-4" /> Baixar instalador
                  </a>
                </Button>
              </div>
            </div>
          )}

          <Accordion type="single" collapsible>
            <AccordionItem value="manual" className="border-0">
              <AccordionTrigger className="text-sm py-1 hover:no-underline">
                Instalação manual (avançado / macOS / Linux)
              </AccordionTrigger>
              <AccordionContent className="pt-2 space-y-2 text-sm text-muted-foreground">
                <p>Para plataformas não-Windows ou instalação manual do certificado, baixe o cert.pem e siga a documentação oficial.</p>
                <Button variant="outline" size="sm" className="gap-1.5" asChild>
                  <a href={QZ_CERT_URL} target="_blank" rel="noreferrer">
                    <FileDown className="h-4 w-4" /> Baixar cert.pem
                  </a>
                </Button>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </CardContent>
      </Card>

      {/* Card 2 — Bluetooth (advanced/fallback) */}
      <Accordion type="single" collapsible>
        <AccordionItem value="bt" className="border rounded-lg bg-card">
          <AccordionTrigger className="px-6 py-4 hover:no-underline">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Bluetooth className="h-4 w-4" /> Conexão Bluetooth
              <Badge variant={btConnected ? 'default' : 'secondary'} className="text-xs">
                {btConnected ? `Conectado: ${btDeviceName}` : 'Desconectado'}
              </Badge>
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-6 pb-4 space-y-3">
            {!btAvailable ? (
              <p className="text-sm text-muted-foreground">
                Web Bluetooth não disponível neste navegador. Use Chrome ou Edge para conectar via Bluetooth.
              </p>
            ) : (
              <>
                {isDesktop && (
                  <Alert className="border-warning/40 bg-warning/10">
                    <AlertDescription className="text-xs">
                      Em desktops, prefira o <strong>QZ Tray</strong> — o Bluetooth direto pelo navegador pode falhar em impressões longas.
                    </AlertDescription>
                  </Alert>
                )}
                <div className="flex items-center gap-2 flex-wrap">
                  {btConnected ? (
                    <Button variant="outline" size="sm" onClick={unpairBluetooth}>Desconectar</Button>
                  ) : (
                    <Button size="sm" onClick={handlePair} disabled={pairing}>
                      {pairing && <Loader2 className="h-4 w-4 animate-spin mr-1" />} Parear Impressora
                    </Button>
                  )}
                  {!btConnected && lastPairedName && (
                    <>
                      <span className="text-xs text-muted-foreground">Última: <strong>{lastPairedName}</strong></span>
                      <Button variant="outline" size="sm" onClick={reconnectPrinter}>Reconectar</Button>
                      <Button variant="ghost" size="sm" onClick={forgetPrinter}>Esquecer</Button>
                    </>
                  )}
                </div>
                {renderFeedback(pairFeedback)}
              </>
            )}
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      {/* Card 3 — Configured printers */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2"><Printer className="h-5 w-5" /> Impressoras Configuradas</span>
            <Button size="sm" className="gap-1" onClick={() => setShowForm(true)}>
              <Plus className="h-4 w-4" /> Adicionar
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-6"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : printers.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">Nenhuma impressora configurada.</p>
          ) : (
            <div className="space-y-3">
              {printers.map((p: PrinterConfig) => (
                <div key={p.id} className="flex items-center justify-between p-3 rounded-lg border bg-card">
                  <div className="flex items-center gap-3">
                    {p.connection_type === 'bluetooth' ? <Bluetooth className="h-4 w-4 text-primary" /> : p.connection_type === 'network' ? <Wifi className="h-4 w-4 text-primary" /> : <Monitor className="h-4 w-4 text-primary" />}
                    <div>
                      <p className="text-sm font-medium text-foreground flex items-center gap-2 flex-wrap">
                        {p.name}
                        {p.is_default && <Badge variant="outline" className="text-xs">Padrão</Badge>}
                        {p.auto_connect_qz && <Badge variant="outline" className="text-xs">Auto-conectar</Badge>}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {p.model || 'ESC/POS'} · {p.connection_type === 'bluetooth' ? 'Bluetooth' : p.connection_type === 'network' ? `Rede — ${p.address}` : 'Sistema (QZ)'} · {p.paper_width}mm
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    {!p.is_default && (
                      <Button variant="ghost" size="sm" className="text-xs" onClick={() => handleSetDefault(p.id)}>
                        Definir padrão
                      </Button>
                    )}
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDelete(p.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Card 4 — Test print */}
      <Card>
        <CardContent className="pt-6 space-y-2">
          <Button variant="outline" className="gap-2" onClick={handleTest} disabled={testing}>
            {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <TestTube className="h-4 w-4" />}
            Imprimir Teste
          </Button>
          <p className="text-xs text-muted-foreground">
            Envia uma impressão de teste para a impressora padrão. Se não houver Bluetooth ou QZ Tray, será usado o modo do navegador.
          </p>
          {renderFeedback(testFeedback)}
        </CardContent>
      </Card>

      {/* Add printer dialog */}
      <Dialog open={showForm} onOpenChange={v => !v && resetForm()}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Adicionar Impressora</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Nome da impressora</Label>
                <Input placeholder="Ex: Balcão" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
                <p className="text-[11px] text-muted-foreground">
                  {qzConnected ? 'Clique em Detectar acima para listar impressoras do sistema.' : ''}
                </p>
              </div>
              <div className="space-y-1.5">
                <Label>Modelo</Label>
                <Input placeholder="ESC/POS compatível" value={form.model} onChange={e => setForm(f => ({ ...f, model: e.target.value }))} />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Tipo de conexão</Label>
                <Select value={form.connection_type} onValueChange={v => setForm(f => ({ ...f, connection_type: v as any }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="system">QZ Tray — Impressão local (recomendado)</SelectItem>
                    <SelectItem value="bluetooth">Bluetooth</SelectItem>
                    <SelectItem value="network">Rede (IP)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Perfil ESC/POS</Label>
                <Select value={form.escpos_profile} onValueChange={v => setForm(f => ({ ...f, escpos_profile: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ESCPOS_PROFILES.map(p => (
                      <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {form.connection_type === 'network' && (
              <div className="space-y-1.5">
                <Label>Endereço IP</Label>
                <Input placeholder="192.168.1.100:9100" value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} />
              </div>
            )}

            {form.connection_type === 'system' && qzConnected && (
              <div className="space-y-1.5">
                <Label>Impressora do Sistema</Label>
                <Select value={form.address} onValueChange={v => setForm(f => ({ ...f, address: v }))}>
                  <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>
                    {qzPrintersList.map(p => (
                      <SelectItem key={p} value={p}>{p}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-muted-foreground">Impressoras detectadas pelo QZ Tray neste computador.</p>
              </div>
            )}
            {form.connection_type === 'system' && !qzConnected && (
              <div className="space-y-1.5">
                <Label>Nome exato no sistema</Label>
                <Input placeholder="Ex: L3150 Series" value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} />
                <p className="text-[11px] text-muted-foreground">Digite exatamente como está no Painel de Controle (ou instale o QZ Tray para listar automaticamente).</p>
              </div>
            )}

            <div className="space-y-1.5">
              <Label>Largura do Papel</Label>
              <Select value={String(form.paper_width)} onValueChange={v => setForm(f => ({ ...f, paper_width: parseInt(v) }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="58">58mm</SelectItem>
                  <SelectItem value="80">80mm</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between border rounded-lg p-3">
              <div>
                <p className="text-sm text-foreground">Conectar automaticamente ao QZ Tray ao logar</p>
                <p className="text-[11px] text-muted-foreground">Mantém a conexão viva para impressões mais rápidas.</p>
              </div>
              <Switch checked={form.auto_connect_qz} onCheckedChange={v => setForm(f => ({ ...f, auto_connect_qz: v }))} />
            </div>

            <label className="flex items-center gap-2 cursor-pointer">
              <Switch checked={form.is_default} onCheckedChange={v => setForm(f => ({ ...f, is_default: v }))} />
              <span className="text-sm text-foreground">Impressora padrão</span>
            </label>

            {renderFeedback(formFeedback)}

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={resetForm}>Cancelar</Button>
              <Button onClick={handleSave} disabled={saving || !form.name.trim()}>
                {saving && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
                Salvar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
