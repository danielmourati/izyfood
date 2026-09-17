import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import PrintQueuePanel from '@/components/PrintQueuePanel';
import {
  Printer, Plus, Trash2, RefreshCw, HelpCircle, CheckCircle2,
  AlertTriangle, Monitor, Check, Loader2, Sliders
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { usePrinter } from '@/hooks/use-printer';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { getQzPrinters } from '@/lib/printer';
import { QzSetupModal } from '@/components/QzSetupModal';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';

export interface SectorItem {
  key: string;
  name: string;
  description: string;
}

const DEFAULT_SECTORS: SectorItem[] = [
  { key: 'recibo', name: 'Caixa (recibo)', description: 'Impressora usada para o recibo deste computador.' },
  { key: 'cozinha', name: 'Cozinha', description: 'Impressora de produção da Cozinha.' },
  { key: 'bar', name: 'Bar', description: 'Impressora de bebidas e pedidos do Bar.' },
  { key: 'balcao', name: 'Balcão', description: 'Impressora de atendimento no Balcão.' },
];

import { useIsMobile } from '@/hooks/use-mobile';

export function ImpressoraTab() {
  const { user, isAdmin } = useAuth();
  const isMobile = useIsMobile();
  const isAttendantMobile = !isAdmin || isMobile;
  const navigate = useNavigate();

  const {
    printers, loading, qzConnected, retryQzConnection, fetchPrinters, printTest,
    btConnected, btDeviceName, lastPairedName, pairBluetooth, reconnectPrinter, forgetPrinter,
    btPriorityDefault, toggleBluetoothPriorityDefault,
    enablePrinterDevice, toggleEnablePrinterDevice,
  } = usePrinter();

  const [selectedSector, setSelectedSector] = useState<string>('recibo');
  const [customSectors, setCustomSectors] = useState<SectorItem[]>([]);
  const [qzPrintersList, setQzPrintersList] = useState<string[]>([]);
  const [fetchingQzPrinters, setFetchingQzPrinters] = useState(false);
  const [showQzWizard, setShowQzWizard] = useState(false);
  const [showAddLocalModal, setShowAddLocalModal] = useState(false);
  const [newLocalName, setNewLocalName] = useState('');

  // Form state
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [form, setForm] = useState({
    name: '',
    address: '',
    paper_width: 80,
    auto_connect_qz: true,
    escpos_profile: 'generic',
    feed_lines: 3,
  });

  // Combine default and custom sectors, including any stored in DB
  const allSectors = React.useMemo(() => {
    const map = new Map<string, SectorItem>();
    DEFAULT_SECTORS.forEach(s => map.set(s.key, s));
    customSectors.forEach(s => map.set(s.key, s));

    // Incorporate any sector from printers array that is not default
    printers.forEach(p => {
      const sec = (p as any).sector;
      if (sec && !map.has(sec)) {
        map.set(sec, {
          key: sec,
          name: p.name || sec.toUpperCase(),
          description: `Impressora configurada para ${p.name || sec}.`,
        });
      }
    });

    return Array.from(map.values());
  }, [customSectors, printers]);

  // Find printer config for selected sector
  const currentPrinter = printers.find(p => (p as any).sector === selectedSector) || null;

  useEffect(() => {
    const savedFeed = typeof window !== 'undefined' ? localStorage.getItem('izf_feed_lines') : null;
    const initialFeed = savedFeed ? Number(savedFeed) : 3;

    if (currentPrinter) {
      setForm({
        name: currentPrinter.name || '',
        address: (currentPrinter.address || '').replace(/^SYSTEM:/, ''),
        paper_width: currentPrinter.paper_width || 80,
        auto_connect_qz: currentPrinter.auto_connect_qz ?? true,
        escpos_profile: currentPrinter.escpos_profile || 'generic',
        feed_lines: initialFeed,
      });
    } else {
      const activeSectorDef = allSectors.find(s => s.key === selectedSector);
      setForm({
        name: activeSectorDef ? activeSectorDef.name : 'Nova Impressora',
        address: '',
        paper_width: 80,
        auto_connect_qz: true,
        escpos_profile: 'generic',
        feed_lines: initialFeed,
      });
    }
  }, [selectedSector, currentPrinter, allSectors]);

  // Load QZ Tray system printers
  const handleRefreshPrintersList = async () => {
    setFetchingQzPrinters(true);
    try {
      const isReady = qzConnected || (await retryQzConnection());
      if (isReady) {
        const list = await getQzPrinters();
        setQzPrintersList(list);
        if (list.length > 0 && !form.address) {
          setForm(f => ({ ...f, address: list[0] }));
        }
        toast.success(`${list.length} impressora(s) detectada(s) no sistema.`);
      } else {
        setShowQzWizard(true);
      }
    } catch (e: any) {
      toast.error('Erro ao buscar impressoras: ' + (e?.message || 'QZ Tray inativo'));
    } finally {
      setFetchingQzPrinters(false);
    }
  };

  useEffect(() => {
    if (qzConnected) {
      getQzPrinters().then(setQzPrintersList).catch(() => {});
    }
  }, [qzConnected]);

  // CRUD: Save / Update printer location
  const handleSaveConfig = async () => {
    if (!user?.tenantId) return;
    setSaving(true);
    try {
      const sectorDef = allSectors.find(s => s.key === selectedSector);
      const nameToSave = form.name.trim() || sectorDef?.name || 'Impressora';

      const payload: any = {
        name: nameToSave,
        model: 'ESC/POS compatível',
        escpos_profile: form.escpos_profile,
        auto_connect_qz: form.auto_connect_qz,
        connection_type: 'network',
        address: form.address ? `SYSTEM:${form.address}` : 'SYSTEM:DEFAULT',
        paper_width: Number(form.paper_width),
        sector: selectedSector,
        tenant_id: user.tenantId,
      };

      // Save feed lines to local device storage & window cache
      if (typeof window !== 'undefined') {
        localStorage.setItem('izf_feed_lines', String(form.feed_lines));
        if ((window as any).__printSettingsCache) {
          (window as any).__printSettingsCache.feedLines = Number(form.feed_lines);
        }
      }

      if (currentPrinter?.id) {
        const { error } = await supabase.from('printer_configs').update(payload).eq('id', currentPrinter.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('printer_configs').insert(payload);
        if (error) throw error;
      }

      toast.success(`Configuração de ${nameToSave} salva com sucesso!`);
      await fetchPrinters();
    } catch (e: any) {
      toast.error('Erro ao salvar impressora: ' + (e.message || 'Falha na requisição'));
    } finally {
      setSaving(false);
    }
  };

  // CRUD: Delete / Unlink printer location
  const handleUnlinkPrinter = async () => {
    if (!currentPrinter?.id) {
      setForm(f => ({ ...f, address: '' }));
      toast.info('Nenhuma impressora vinculada a este local.');
      return;
    }
    try {
      await supabase.from('printer_configs').delete().eq('id', currentPrinter.id);
      toast.success('Impressora desvinculada.');
      setForm(f => ({ ...f, address: '' }));
      await fetchPrinters();
    } catch (e: any) {
      toast.error('Erro ao desvincular: ' + e.message);
    }
  };

  // Create new local
  const handleAddLocal = () => {
    if (!newLocalName.trim()) return;
    const cleanName = newLocalName.trim();
    const key = cleanName.toLowerCase().replace(/[^a-z0-9]/g, '_');
    const newSector: SectorItem = {
      key,
      name: cleanName,
      description: `Impressora configurada para ${cleanName}.`,
    };

    setCustomSectors(prev => [...prev.filter(s => s.key !== key), newSector]);
    setSelectedSector(key);
    setShowAddLocalModal(false);
    setNewLocalName('');
    toast.success(`Local "${cleanName}" adicionado. Configure os detalhes e clique em Salvar.`);
  };

  const handleRunTest = async () => {
    setTesting(true);
    try {
      await printTest();
      toast.success('Impressão de teste enviada!');
    } catch (e: any) {
      toast.error('Falha no teste de impressão: ' + (e?.message || 'Verifique a impressora'));
    } finally {
      setTesting(false);
    }
  };

  const activeSectorObj = allSectors.find(s => s.key === selectedSector) || {
    key: selectedSector,
    name: selectedSector,
    description: 'Impressora configurada para este setor.',
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-2xl bg-primary/10 text-primary">
            <Printer className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground tracking-tight">Impressoras</h1>
            <p className="text-xs text-muted-foreground">Escolha o local à esquerda e ajuste a impressora ao lado.</p>
          </div>
        </div>
      </div>

      {/* Device Printer Toggle Card */}
      <Card className="rounded-2xl border border-primary/30 bg-card shadow-sm p-4 space-y-3 font-sans">
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-0.5">
            <span className="font-extrabold uppercase tracking-wider text-xs text-primary flex items-center gap-2">
              <Printer className="h-4 w-4" /> Usar Impressora neste Dispositivo
            </span>
            <p className="text-xs text-muted-foreground">
              {enablePrinterDevice
                ? 'Impressão ativada neste aparelho. O preview automático do navegador ou impressora pareada será acionado ao enviar pedidos.'
                : 'Desativado (Padrão). O sistema salva e sincroniza os pedidos sem abrir o preview automático do navegador.'}
            </p>
          </div>
          <Switch
            checked={enablePrinterDevice}
            onCheckedChange={(checked) => {
              toggleEnablePrinterDevice(checked);
              toast.info(checked ? 'Impressão ativada neste dispositivo!' : 'Impressão desativada neste dispositivo (preview automático desligado).');
            }}
          />
        </div>
      </Card>

      {/* Impressão centralizada: aparelho "Caixa" + fila de cupons */}
      <Card className="rounded-2xl border border-primary/30 bg-card shadow-sm p-4 font-sans">
        <PrintQueuePanel />
      </Card>


      {/* Bluetooth Connection Module Card (Attachment 2) - Exibido somente quando o toggle está ativado */}
      {enablePrinterDevice && (
        <Card className="rounded-2xl border border-primary/30 bg-card shadow-sm p-4 space-y-3 font-sans">
          <div className="flex items-center justify-between border-b border-border/80 pb-2">
            <span className="font-extrabold uppercase tracking-wider text-xs text-primary flex items-center gap-2">
              <Printer className="h-4 w-4" /> Conexão Impressora Bluetooth (Dispositivo Local)
            </span>
            <span className={`text-[11px] font-black px-2.5 py-0.5 rounded flex items-center gap-1.5 ${
              btConnected
                ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30'
                : 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30'
            }`}>
              <span className={`h-2 w-2 rounded-full ${btConnected ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
              {btConnected ? 'Conectado' : 'Desconectado'}
            </span>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="text-muted-foreground">
              Dispositivo Pareado: <strong className="text-foreground font-bold">{btDeviceName || lastPairedName || 'Nenhum pareado'}</strong>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <Button
                size="sm"
                onClick={async () => {
                  try {
                    const name = await pairBluetooth();
                    toast.success(`Conectado a ${name}!`);
                  } catch (err) {
                    toast.error('Não foi possível conectar ao Bluetooth.');
                  }
                }}
                className="bg-primary text-primary-foreground hover:bg-primary/90 text-xs font-bold h-9 px-4 flex items-center gap-1.5 rounded-lg shadow-xs"
              >
                Parear / Buscar
              </Button>

              {btConnected ? (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    forgetPrinter();
                    toast.info('Impressora desconectada.');
                  }}
                  className="text-xs font-bold h-9 px-3 border-destructive/40 text-destructive hover:bg-destructive/10 rounded-lg"
                >
                  Desconectar
                </Button>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={async () => {
                    const ok = await reconnectPrinter();
                    if (ok) toast.success('Reconectado com sucesso!');
                    else toast.warning('Nenhuma impressora pareada previamente.');
                  }}
                  className="text-xs font-bold h-9 px-3 border-border text-foreground hover:bg-muted rounded-lg"
                >
                  Reconectar
                </Button>
              )}

              <Button
                size="sm"
                variant="secondary"
                onClick={handleRunTest}
                disabled={testing}
                className="text-xs font-bold h-9 px-3 rounded-lg flex items-center gap-1.5"
              >
                <Printer className="h-3.5 w-3.5" /> Teste de Impressão
              </Button>
            </div>
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-border/60 text-xs">
            <span className="font-semibold text-foreground">Usar Bluetooth como Padrão Local neste Aparelho</span>
            <Switch
              checked={btPriorityDefault}
              onCheckedChange={(checked) => {
                toggleBluetoothPriorityDefault(checked);
                toast.info(checked ? 'Prioridade Bluetooth ativada neste dispositivo!' : 'Prioridade Bluetooth desativada.');
              }}
            />
          </div>
        </Card>
      )}

      {!isAttendantMobile ? (
        <div className="space-y-6">
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Skeleton className="h-96 rounded-2xl md:col-span-1" />
              <Skeleton className="h-96 rounded-2xl md:col-span-2" />
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
              {/* Left Column: ONDE IMPRIMIR */}
              <div className="md:col-span-1 space-y-4">
                <div className="px-1">
                  <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">ONDE IMPRIMIR</h2>
                </div>

                <div className="space-y-2.5">
                  {allSectors.map((sec) => {
                    const isSelected = selectedSector === sec.key;
                    const boundPrinter = printers.find(p => (p as any).sector === sec.key);
                    const hasConfig = !!boundPrinter;

                    return (
                      <button
                        key={sec.key}
                        type="button"
                        onClick={() => setSelectedSector(sec.key)}
                        className={`w-full text-left p-4 rounded-2xl transition-all duration-200 border ${
                          isSelected
                            ? 'bg-card border-primary ring-2 ring-primary/20 shadow-md'
                            : 'bg-card/60 hover:bg-card border-border/80 text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-xl ${isSelected ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground'}`}>
                              <Monitor className="h-5 w-5" />
                            </div>
                            <div>
                              <p className={`font-semibold text-sm ${isSelected ? 'text-foreground font-bold' : 'text-foreground'}`}>
                                {sec.name}
                              </p>
                              <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium mt-0.5">
                                {boundPrinter ? boundPrinter.name : sec.key.toUpperCase()}
                              </p>
                            </div>
                          </div>

                          {hasConfig && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                              Ativa
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>

                <Button
                  variant="outline"
                  onClick={() => setShowAddLocalModal(true)}
                  className="w-full rounded-2xl border-dashed border-border text-foreground hover:bg-muted/50 py-5 font-semibold text-xs gap-2"
                >
                  <Plus className="h-4 w-4" /> Adicionar local
                </Button>
              </div>

              {/* Right Column: Configurações do Local Selecionado */}
              <div className="md:col-span-2">
                <Card className="rounded-2xl border-border bg-card shadow-sm overflow-hidden">
                  <CardHeader className="border-b border-border bg-muted/20 pb-4">
                    <div className="flex items-start justify-between gap-4 flex-wrap">
                      <div>
                        <CardTitle className="text-xl font-bold text-foreground">
                          {activeSectorObj.name}
                        </CardTitle>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {activeSectorObj.description}
                        </p>
                      </div>

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleUnlinkPrinter}
                        className="rounded-full text-destructive border-destructive/30 hover:bg-destructive/10 hover:text-destructive text-xs font-semibold gap-2"
                      >
                        <Trash2 className="h-3.5 w-3.5" /> Desvincular impressora
                      </Button>
                    </div>
                  </CardHeader>

                  <CardContent className="p-6 space-y-6">
                    {/* Form Field 1: Escolha a impressora */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="text-sm font-bold text-foreground">Escolha a impressora</Label>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={handleRefreshPrintersList}
                          disabled={fetchingQzPrinters}
                          className="text-primary hover:text-primary/90 text-xs font-semibold gap-1.5 h-auto p-0"
                        >
                          <RefreshCw className={`h-3.5 w-3.5 ${fetchingQzPrinters ? 'animate-spin' : ''}`} />
                          Procurar impressoras
                        </Button>
                      </div>

                      <div className="flex gap-2">
                        <Select
                          value={form.address}
                          onValueChange={(val) => setForm(f => ({ ...f, address: val }))}
                        >
                          <SelectTrigger className="w-full rounded-xl bg-background border-border text-foreground h-11">
                            <SelectValue placeholder="Selecione a impressora do sistema..." />
                          </SelectTrigger>
                          <SelectContent>
                            {qzPrintersList.length === 0 ? (
                              <SelectItem value="DEFAULT_PRINTER" disabled>
                                Nenhuma impressora encontrada (Clique em Procurar)
                              </SelectItem>
                            ) : (
                              qzPrintersList.map((pName) => (
                                <SelectItem key={pName} value={pName}>
                                  {pName}
                                </SelectItem>
                              ))
                            )}
                          </SelectContent>
                        </Select>

                        {form.address && (
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() => setForm(f => ({ ...f, address: '' }))}
                            className="rounded-xl border-border shrink-0 h-11 w-11 text-muted-foreground hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>

                    {/* Form Field 2: Tamanho do papel */}
                    <div className="space-y-2">
                      <Label className="text-sm font-bold text-foreground">Tamanho do papel</Label>
                      <Select
                        value={String(form.paper_width)}
                        onValueChange={(val) => setForm(f => ({ ...f, paper_width: Number(val) }))}
                      >
                        <SelectTrigger className="w-full rounded-xl bg-background border-border text-foreground h-11">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="80">80mm (bobina comum)</SelectItem>
                          <SelectItem value="58">58mm / 55mm (mini bobina)</SelectItem>
                          <SelectItem value="210">A4 / Folha inteira (impressora padrão)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Form Field 3: Imprimir e aceitar pedidos automaticamente */}
                    <div className="rounded-2xl border border-border p-4 bg-muted/10 flex items-center justify-between gap-4">
                      <div className="space-y-0.5">
                        <Label className="text-sm font-bold text-foreground cursor-pointer" htmlFor="auto-print-switch">
                          Imprimir e aceitar pedidos automaticamente
                        </Label>
                        <p className="text-xs text-muted-foreground">
                          O pedido é aceito assim que chega e o cupom sai na hora.
                        </p>
                      </div>
                      <Switch
                        id="auto-print-switch"
                        checked={form.auto_connect_qz}
                        onCheckedChange={(val) => setForm(f => ({ ...f, auto_connect_qz: val }))}
                      />
                    </div>

                    {/* Form Field 4: Opções avançadas Accordion */}
                <Accordion type="single" collapsible className="w-full border border-border rounded-2xl">
                  <AccordionItem value="advanced-opts" className="border-none px-4">
                    <AccordionTrigger className="text-sm font-bold text-foreground py-3 hover:no-underline">
                      <span className="flex items-center gap-2">
                        <Sliders className="h-4 w-4 text-primary" /> Opções avançadas
                      </span>
                    </AccordionTrigger>
                    <AccordionContent className="pt-2 pb-4 space-y-4 text-xs">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <Label className="text-xs font-medium">Perfil ESC/POS</Label>
                          <Select
                            value={form.escpos_profile}
                            onValueChange={(val) => setForm(f => ({ ...f, escpos_profile: val }))}
                          >
                            <SelectTrigger className="rounded-xl bg-background border-border">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="generic">Genérico ESC/POS</SelectItem>
                              <SelectItem value="epson_tm">Epson TM Series</SelectItem>
                              <SelectItem value="bematech_mp">Bematech MP Series</SelectItem>
                              <SelectItem value="elgin_i9">Elgin i9</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-1.5">
                          <Label className="text-xs font-medium">Avanço de linhas (Feed)</Label>
                          <Input
                            type="number"
                            min="1"
                            max="10"
                            value={form.feed_lines}
                            onChange={(e) => setForm(f => ({ ...f, feed_lines: Math.max(1, Number(e.target.value)) }))}
                            className="rounded-xl bg-background border-border"
                          />
                        </div>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  ) : null}

      {/* Footer Controls Bar */}
      <div className="rounded-2xl border border-border bg-card p-4 flex flex-wrap items-center justify-between gap-4 shadow-sm">
        <div className="flex items-center gap-4 flex-wrap">
          {/* Status Badge - Oculto em Mobile */}
          {!isMobile && (
            qzConnected ? (
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-xs font-bold">
                <CheckCircle2 className="h-4 w-4" /> Impressão ligada
              </div>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowQzWizard(true)}
                className="rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30 hover:bg-amber-500/20 text-xs font-bold gap-1.5"
              >
                <AlertTriangle className="h-3.5 w-3.5" /> QZ Desconectado
              </Button>
            )
          )}

          {!isMobile && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowQzWizard(true)}
              className="text-xs font-medium text-muted-foreground hover:text-foreground gap-1.5"
            >
              <HelpCircle className="h-4 w-4" /> Ajuda QZ
            </Button>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={handleRunTest}
            disabled={testing}
            className="rounded-full border-border text-foreground hover:bg-muted font-semibold text-xs gap-2 px-4"
          >
            {testing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Printer className="h-3.5 w-3.5" />}
            Imprimir teste
          </Button>
        </div>

        {/* Primary Save / Concluir */}
        <div className="flex items-center gap-3">
          <Button
            onClick={handleSaveConfig}
            disabled={saving}
            className="rounded-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs gap-2 px-6 shadow-sm"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            Salvar
          </Button>
          <Button
            variant="outline"
            onClick={() => navigate(-1)}
            className="rounded-full border-border text-foreground font-semibold text-xs px-6"
          >
            Concluir
          </Button>
        </div>
      </div>

      {/* 3-Step QZ Wizard Modal (Somente Desktop) */}
      {!isMobile && (
        <QzSetupModal
          open={showQzWizard}
          onOpenChange={setShowQzWizard}
          onTestConnection={retryQzConnection}
        />
      )}

      {/* Add Local Modal */}
      <Dialog open={showAddLocalModal} onOpenChange={setShowAddLocalModal}>
        <DialogContent className="max-w-md p-6 rounded-2xl bg-card border border-border">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-foreground">Adicionar Novo Local de Impressão</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label className="text-xs font-medium">Nome do Local / Setor</Label>
              <Input
                placeholder="Ex: Entrega, Caixa 2, Pizzaria..."
                value={newLocalName}
                onChange={(e) => setNewLocalName(e.target.value)}
                className="rounded-xl bg-background border-border"
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowAddLocalModal(false)} className="rounded-full">
              Cancelar
            </Button>
            <Button
              onClick={handleAddLocal}
              className="rounded-full bg-primary text-primary-foreground font-semibold"
            >
              Adicionar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
