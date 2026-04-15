import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Printer, Plus, Trash2, Bluetooth, Wifi, TestTube, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { usePrinter, type PrinterConfig } from '@/hooks/use-printer';

export function ImpressoraTab() {
  const {
    printers, loading, btAvailable, btConnected, btDeviceName,
    fetchPrinters, pairBluetooth, unpairBluetooth, printTest,
  } = usePrinter();

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', connection_type: 'bluetooth' as 'bluetooth' | 'network', address: '', paper_width: 80, is_default: false });
  const [saving, setSaving] = useState(false);
  const [pairing, setPairing] = useState(false);
  const [testing, setTesting] = useState(false);

  const resetForm = () => {
    setForm({ name: '', connection_type: 'bluetooth', address: '', paper_width: 80, is_default: false });
    setShowForm(false);
  };

  const handleSave = async () => {
    if (!form.name.trim()) return;
    setSaving(true);

    // If marking as default, unset others
    if (form.is_default) {
      await supabase.from('printer_configs').update({ is_default: false } as any).eq('is_default', true);
    }

    await supabase.from('printer_configs').insert({
      name: form.name.trim(),
      connection_type: form.connection_type,
      address: form.address.trim(),
      paper_width: form.paper_width,
      is_default: form.is_default,
    } as any);

    setSaving(false);
    resetForm();
    fetchPrinters();
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

  const handlePair = async () => {
    setPairing(true);
    try {
      await pairBluetooth();
    } catch (e: any) {
      console.error('Bluetooth pairing error:', e);
    }
    setPairing(false);
  };

  const handleTest = async () => {
    setTesting(true);
    try {
      await printTest();
    } catch (e: any) {
      console.error('Print test error:', e);
    }
    setTesting(false);
  };

  return (
    <div className="space-y-4">
      {/* Bluetooth status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bluetooth className="h-5 w-5" /> Conexão Bluetooth
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {!btAvailable ? (
            <p className="text-sm text-muted-foreground">
              Web Bluetooth não disponível neste navegador. Use Chrome ou Edge para conectar via Bluetooth.
            </p>
          ) : (
            <>
              <div className="flex items-center gap-3">
                <Badge variant={btConnected ? 'default' : 'secondary'}>
                  {btConnected ? `Conectado: ${btDeviceName}` : 'Desconectado'}
                </Badge>
                {btConnected ? (
                  <Button variant="outline" size="sm" onClick={unpairBluetooth}>Desconectar</Button>
                ) : (
                  <Button size="sm" onClick={handlePair} disabled={pairing}>
                    {pairing && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
                    Parear Impressora
                  </Button>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Printer list */}
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
              {printers.map(p => (
                <div key={p.id} className="flex items-center justify-between p-3 rounded-lg border bg-card">
                  <div className="flex items-center gap-3">
                    {p.connection_type === 'bluetooth' ? <Bluetooth className="h-4 w-4 text-primary" /> : <Wifi className="h-4 w-4 text-primary" />}
                    <div>
                      <p className="text-sm font-medium text-foreground">{p.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {p.connection_type === 'bluetooth' ? 'Bluetooth' : `Rede — ${p.address}`} · {p.paper_width}mm
                      </p>
                    </div>
                    {p.is_default && <Badge variant="outline" className="text-xs">Padrão</Badge>}
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

      {/* Test print */}
      <Card>
        <CardContent className="pt-6">
          <Button variant="outline" className="gap-2" onClick={handleTest} disabled={testing}>
            {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <TestTube className="h-4 w-4" />}
            Imprimir Teste
          </Button>
          <p className="text-xs text-muted-foreground mt-2">
            Envia uma impressão de teste para a impressora padrão. Se não houver Bluetooth conectado, será usado o modo de impressão do navegador.
          </p>
        </CardContent>
      </Card>

      {/* Add printer dialog */}
      <Dialog open={showForm} onOpenChange={v => !v && resetForm()}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Adicionar Impressora</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nome</Label>
              <Input placeholder="Ex: Cozinha, Caixa" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Tipo de Conexão</Label>
              <Select value={form.connection_type} onValueChange={v => setForm(f => ({ ...f, connection_type: v as any }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="bluetooth">Bluetooth</SelectItem>
                  <SelectItem value="network">Rede (IP)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {form.connection_type === 'network' && (
              <div className="space-y-2">
                <Label>Endereço IP</Label>
                <Input placeholder="192.168.1.100:9100" value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} />
              </div>
            )}
            <div className="space-y-2">
              <Label>Largura do Papel</Label>
              <Select value={String(form.paper_width)} onValueChange={v => setForm(f => ({ ...f, paper_width: parseInt(v) }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="58">58mm</SelectItem>
                  <SelectItem value="80">80mm</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <Switch checked={form.is_default} onCheckedChange={v => setForm(f => ({ ...f, is_default: v }))} />
              <span className="text-sm text-foreground">Impressora padrão</span>
            </label>
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
