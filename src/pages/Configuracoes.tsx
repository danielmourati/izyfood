import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useStore } from '@/contexts/StoreContext';
import { useAuth, AppRole } from '@/contexts/AuthContext';
import { DiscountCoupon } from '@/types';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

import { fmt } from '@/lib/utils';
import {
  Settings, Users, Grid3X3, Ticket, Printer, Plus, Trash2, Edit2, Check, X, KeyRound, User, Loader2, FileText, CreditCard
} from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { MeuPerfilTab } from '@/components/MeuPerfilTab';
import { AuditLogsTab } from '@/components/AuditLogsTab';
import { ImpressoraTab } from '@/components/ImpressoraTab';
import { PlanoTab } from '@/components/PlanoTab';

type Tab = 'perfil' | 'geral' | 'usuarios' | 'permissoes' | 'cupons' | 'impressora' | 'logs' | 'plano';

const allTabs: { key: Tab; label: string; icon: React.ElementType; adminOnly: boolean }[] = [
  { key: 'perfil', label: 'Meu Perfil', icon: User, adminOnly: false },
  { key: 'geral', label: 'Geral', icon: Settings, adminOnly: true },
  { key: 'usuarios', label: 'Usuários', icon: Users, adminOnly: true },
  { key: 'permissoes', label: 'Permissões', icon: KeyRound, adminOnly: true },
  { key: 'cupons', label: 'Cupons', icon: Ticket, adminOnly: true },
  { key: 'impressora', label: 'Impressora', icon: Printer, adminOnly: true },
  { key: 'logs', label: 'Auditoria', icon: FileText, adminOnly: true },
  { key: 'plano', label: 'Plano', icon: CreditCard, adminOnly: true },
];

const roleLabels: Record<AppRole, string> = {
  admin: 'Administrador',
  atendente: 'Atendente',
  motoboy: 'Motoboy',
  superadmin: 'Super Admin',
};

const Configuracoes = () => {
  const [activeTab, setActiveTab] = useState<Tab>('perfil');
  const { isAdmin } = useAuth();
  const tabs = allTabs.filter(t => !t.adminOnly || isAdmin);

  return (
    <div className="h-full overflow-y-auto p-4 md:p-6 space-y-4">
      <h1 className="text-2xl font-bold text-foreground">Configurações</h1>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {tabs.map(t => (
          <Button
            key={t.key}
            variant={activeTab === t.key ? 'default' : 'outline'}
            className="gap-2 shrink-0"
            onClick={() => setActiveTab(t.key)}
          >
            <t.icon className="h-4 w-4" />
            {t.label}
          </Button>
        ))}
      </div>

      {activeTab === 'perfil' && <MeuPerfilTab />}
      {activeTab === 'geral' && <GeralTab />}
      {activeTab === 'usuarios' && <UsuariosTab />}
      {activeTab === 'permissoes' && <PermissoesTab />}
      {activeTab === 'cupons' && <CuponsTab />}
      {activeTab === 'impressora' && <ImpressoraTab />}
      {activeTab === 'logs' && <AuditLogsTab />}
      {activeTab === 'plano' && <PlanoTab />}
    </div>
  );
};

function applyMask(value: string, type: 'cnpj' | 'cpf' | 'phone'): string {
  const d = value.replace(/\D/g, '');
  if (type === 'cnpj') {
    return d.slice(0, 14)
      .replace(/(\d{2})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1/$2')
      .replace(/(\d{4})(\d)/, '$1-$2');
  }
  if (type === 'cpf') {
    return d.slice(0, 11)
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
  }
  // phone
  if (d.length <= 10) {
    return d.replace(/(\d{2})(\d{4})(\d{0,4})/, '($1) $2-$3').trim().replace(/-$/, '');
  }
  return d.slice(0, 11).replace(/(\d{2})(\d{5})(\d{0,4})/, '($1) $2-$3').trim().replace(/-$/, '');
}

interface PrintSettings {
  address?: string;
  document?: string;
  documentType?: 'cnpj' | 'cpf';
  whatsapp?: string;
  pixKey?: string;
  instagram?: string;
  thankMessage?: string;
  showAddress?: boolean;
  showDocument?: boolean;
  showWhatsapp?: boolean;
  showPixKey?: boolean;
  showInstagram?: boolean;
  showThankMessage?: boolean;
}

function GeralTab() {
  const { settings, updateTableCount, setSettings, printSettings, setPrintSettings } = useStore();
  const { user } = useAuth();
  const [tableCount, setTableCount] = useState(settings.tableCount.toString());
  const [serviceFee, setServiceFee] = useState('');
  const [tenantName, setTenantName] = useState('');
  const [tenantLogo, setTenantLogo] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [savingGeneral, setSavingGeneral] = useState(false);
  // printSettings lives in StoreContext — no local duplication needed

  useEffect(() => {
    if (user?.tenantId) {
      const lsKey = `print_settings_${user.tenantId}`;

      // 1. Load immediately from localStorage (instant, no latency on same device)
      const savedLocal = localStorage.getItem(lsKey);
      if (savedLocal) {
        try { setPrintSettings(prev => ({ ...prev, ...JSON.parse(savedLocal) })); } catch { }
      }

      // 2. Fetch from Supabase in parallel — always authoritative (works across devices)
      Promise.all([
        supabase.from('store_settings')
          .select('service_fee_percentage, table_count, print_settings')
          .eq('tenant_id', user.tenantId)
          .limit(1)
          .single(),
        supabase.from('tenants')
          .select('name, logo, login_icon, login_carousel_images')
          .eq('id', user.tenantId)
          .single(),
      ]).then(([settingsRes, tenantRes]) => {
        if (!settingsRes.error) {
          if (settingsRes.data) {
            const row = settingsRes.data as any;
            // Service fee
            const rawFee = row.service_fee_percentage;
            setServiceFee(rawFee != null && Number(rawFee) !== 0 ? String(rawFee) : '');

            // Print settings — apply unconditionally when the DB has data, even partial
            const ps = row.print_settings;
            if (ps && typeof ps === 'object' && Object.keys(ps).length > 0) {
              // Merge DB data on top of defaults (DB is source of truth)
              setPrintSettings(prev => ({ ...prev, ...ps }));
              // Backfill localStorage on this new device so next reload is instant
              localStorage.setItem(lsKey, JSON.stringify({ ...JSON.parse(savedLocal || '{}'), ...ps }));
            } else if (savedLocal) {
              // DB has empty print_settings — push this device's localStorage data up
              try {
                const localPs = JSON.parse(savedLocal);
                if (Object.keys(localPs).length > 0) {
                  supabase.from('store_settings')
                    .update({ print_settings: localPs } as any)
                    .eq('tenant_id', user.tenantId)
                    .then(({ error }) => {
                      if (error) console.error('Erro ao subir configurações locais para o banco:', error);
                    });
                }
              } catch { }
            }
          } else {
            // DB does not have any row in store_settings for this tenant
            if (savedLocal) {
              try {
                const localPs = JSON.parse(savedLocal);
                if (Object.keys(localPs).length > 0) {
                  supabase.from('store_settings')
                    .insert({
                      tenant_id: user.tenantId,
                      table_count: 20,
                      service_fee_percentage: 0,
                      print_settings: localPs,
                    } as any)
                    .then(({ error }) => {
                      if (error) console.error('Erro ao inicializar store_settings com configurações locais:', error);
                    });
                }
              } catch { }
            }
          }
        }

        // -- Tenant info --
        if (!tenantRes.error && tenantRes.data) {
          const data = tenantRes.data as any;
          setTenantName(data.name ?? '');
          setTenantLogo(data.logo ?? null);
        }
      });

      // 3. Realtime subscription to receive updates from other devices instantly
      const channelName = `config-realtime-${user.tenantId}-${Math.random().toString(36).slice(2)}`;
      const channel = supabase.channel(channelName)
        .on('postgres_changes', {
          event: 'UPDATE',
          schema: 'public',
          table: 'store_settings',
          filter: `tenant_id=eq.${user.tenantId}`
        }, (payload) => {
          const ps = payload.new.print_settings;
          if (ps && typeof ps === 'object' && Object.keys(ps).length > 0) {
            setPrintSettings(prev => ({ ...prev, ...ps }));
            localStorage.setItem(lsKey, JSON.stringify(ps));
            (window as any).__printSettingsCache = ps;
          }
          if (payload.new.service_fee_percentage != null) {
            const rawFee = payload.new.service_fee_percentage;
            setServiceFee(rawFee !== 0 ? String(rawFee) : '');
          }
          if (payload.new.table_count != null) {
            setTableCount(String(payload.new.table_count));
          }
        })
        .on('postgres_changes', {
          event: 'UPDATE',
          schema: 'public',
          table: 'tenants',
          filter: `id=eq.${user.tenantId}`
        }, (payload) => {
          if (payload.new.name) setTenantName(payload.new.name);
          if (payload.new.logo !== undefined) setTenantLogo(payload.new.logo);
        })
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [user?.tenantId]);

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user?.tenantId) return;
    setUploading(true);
    const ext = file.name.split('.').pop();
    const path = `${user.tenantId}/logo.${ext}`;
    const { error: uploadError } = await supabase.storage.from('tenant-assets').upload(path, file, { upsert: true });
    if (uploadError) {
      toast.error('Erro ao enviar logo');
      setUploading(false);
      return;
    }
    const { data: urlData } = supabase.storage.from('tenant-assets').getPublicUrl(path);
    const logoUrl = urlData.publicUrl + '?t=' + Date.now();
    await supabase.from('tenants').update({ logo: logoUrl }).eq('id', user.tenantId);
    setTenantLogo(logoUrl);
    toast.success('Logo atualizada!');
    setUploading(false);
  };

  const handleLoginIconUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user?.tenantId) return;
    setUploadingIcon(true);
    const ext = file.name.split('.').pop();
    const path = `${user.tenantId}/login-icon.${ext}`;
    const { error: uploadError } = await supabase.storage.from('tenant-assets').upload(path, file, { upsert: true });
    if (uploadError) {
      toast.error('Erro ao enviar ícone');
      setUploadingIcon(false);
      return;
    }
    const { data: urlData } = supabase.storage.from('tenant-assets').getPublicUrl(path);
    const iconUrl = urlData.publicUrl + '?t=' + Date.now();
    await supabase.from('tenants').update({ login_icon: iconUrl } as any).eq('id', user.tenantId);
    setLoginIcon(iconUrl);
    toast.success('Ícone do login atualizado!');
    setUploadingIcon(false);
  };

  const handleCarouselUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !user?.tenantId) return;
    setUploadingCarousel(true);
    const newImages = [...carouselImages];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const ext = file.name.split('.').pop();
      const path = `${user.tenantId}/carousel-${Date.now()}-${i}.${ext}`;
      const { error: uploadError } = await supabase.storage.from('tenant-assets').upload(path, file, { upsert: true });
      if (uploadError) continue;
      const { data: urlData } = supabase.storage.from('tenant-assets').getPublicUrl(path);
      newImages.push(urlData.publicUrl + '?t=' + Date.now());
    }
    await supabase.from('tenants').update({ login_carousel_images: newImages } as any).eq('id', user.tenantId);
    setCarouselImages(newImages);
    toast.success('Imagens do carrossel atualizadas!');
    setUploadingCarousel(false);
  };

  const removeCarouselImage = async (index: number) => {
    const newImages = carouselImages.filter((_, i) => i !== index);
    await supabase.from('tenants').update({ login_carousel_images: newImages } as any).eq('id', user?.tenantId!);
    setCarouselImages(newImages);
    toast.success('Imagem removida');
  };

  const handleSaveAll = async () => {
    if (!user?.tenantId) {
      toast.error('Sessão inválida, recarregue a página.');
      return;
    }

    const count = parseInt(tableCount);
    if (isNaN(count) || count < 5 || count > 100) {
      toast.error('Quantidade de mesas deve ser entre 5 e 100.');
      return;
    }

    setSavingGeneral(true);
    try {
      const fee = parseFloat((serviceFee || '0').replace(',', '.'));
      const validFee = isNaN(fee) ? 0 : fee;

      // 1. Save store name (tenant name)
      const saveTenantPromise = tenantName.trim()
        ? supabase.from('tenants').update({ name: tenantName.trim() }).eq('id', user.tenantId)
        : Promise.resolve();

      // 2. Upsert store_settings in ONE write (avoids race with updateTableCount)
      const { data: existing } = await supabase
        .from('store_settings')
        .select('id')
        .eq('tenant_id', user.tenantId)
        .limit(1);

      const settingsPayload = {
        tenant_id: user.tenantId,
        table_count: count,
        service_fee_percentage: validFee,
        print_settings: printSettings,
      };

      const saveSettingsPromise = supabase
        .from('store_settings')
        .upsert(settingsPayload as any, { onConflict: 'tenant_id' })
        .select()
        .single();

      const [tenantRes, settingsRes] = await Promise.all([saveTenantPromise, saveSettingsPromise]);

      if (tenantRes && (tenantRes as any).error) {
        throw new Error((tenantRes as any).error.message || 'Erro ao salvar dados do estabelecimento.');
      }
      if (settingsRes && (settingsRes as any).error) {
        throw new Error((settingsRes as any).error.message || 'Erro ao salvar configurações do caixa/impressão.');
      }

      // 3. Sync table count and fee back into context so all components see the new values immediately
      setSettings(prev => ({ ...prev, tableCount: count, serviceFeePercentage: validFee || undefined }));
      await updateTableCount(count);

      // Reflect saved fee back in input
      setServiceFee(validFee !== 0 ? String(validFee) : '');

      // 4. Immediately update context printSettings (don't wait for Realtime round-trip)
      const lsKey = `print_settings_${user.tenantId}`;
      const updatedPs = { ...printSettings, storeName: tenantName.trim() };
      setPrintSettings(updatedPs);
      localStorage.setItem(lsKey, JSON.stringify(updatedPs));
      (window as any).__printSettingsCache = updatedPs;

      toast.success('Configurações salvas e sincronizadas com sucesso!');
    } catch (err: any) {
      console.error('Error saving settings:', err);
      toast.error('Erro ao salvar configurações.');
    } finally {
      setSavingGeneral(false);
    }
  };

  const updatePS = (key: keyof PrintSettings, value: any) => setPrintSettings(prev => ({ ...prev, [key]: value }));

  return (
    <div className="space-y-4">
      {/* Aviso de Sincronização */}
      <div className="bg-warning/10 border border-warning/40 rounded-xl p-4 flex gap-3 text-warning-foreground">
        <Printer className="h-5 w-5 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <h4 className="font-semibold text-sm">Sincronização Automática em Nuvem</h4>
          <p className="text-xs leading-relaxed">
            As alterações salvas nesta página são sincronizadas em tempo real com todos os outros caixas, tablets e celulares que imprimem no seu estabelecimento.
          </p>
        </div>
      </div>

      {/* Card 1: Identidade Visual */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Settings className="h-5 w-5" /> Estabelecimento</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-start gap-6">
            <div className="space-y-2">
              <Label>Logo</Label>
              <div className="relative h-20 w-20 rounded-xl border-2 border-dashed border-border overflow-hidden bg-muted flex items-center justify-center">
                {tenantLogo ? (
                  <img src={tenantLogo} alt="Logo" className="h-full w-full object-contain" />
                ) : (
                  <span className="text-2xl text-muted-foreground">{tenantName?.charAt(0)?.toUpperCase() || '?'}</span>
                )}
              </div>
              <label className="cursor-pointer">
                <span className="text-xs text-primary hover:underline">{uploading ? 'Enviando...' : 'Alterar logo'}</span>
                <input type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} disabled={uploading} />
              </label>
            </div>
            <div className="flex-1 space-y-2">
              <Label>Nome do Estabelecimento</Label>
              <Input value={tenantName} onChange={e => setTenantName(e.target.value)} placeholder="Nome da sua loja" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Card 2: Informações Fiscais e de Contato */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><FileText className="h-5 w-5" /> Informações do Estabelecimento</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-xs text-muted-foreground">Dados que aparecerão no cabeçalho dos recibos impressos. Configure quais são exibidos nos cards de impressão abaixo.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2 sm:col-span-2">
              <Label>Endereço</Label>
              <Input value={printSettings.address || ''} onChange={e => updatePS('address', e.target.value)} placeholder="Rua Exemplo, 123 - Bairro - Cidade/UF" />
            </div>
            <div className="space-y-2">
              <Label>CNPJ / CPF</Label>
              <div className="flex gap-2">
                <select className="flex h-10 w-28 rounded-md border border-input bg-background px-3 py-2 text-sm" value={printSettings.documentType || 'cnpj'} onChange={e => updatePS('documentType', e.target.value as 'cnpj' | 'cpf')}>
                  <option value="cnpj">CNPJ</option>
                  <option value="cpf">CPF</option>
                </select>
                <Input
                  className="flex-1"
                  value={printSettings.document || ''}
                  onChange={e => updatePS('document', applyMask(e.target.value, printSettings.documentType || 'cnpj'))}
                  placeholder={printSettings.documentType === 'cpf' ? '000.000.000-00' : '00.000.000/0000-00'}
                  maxLength={printSettings.documentType === 'cpf' ? 14 : 18}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>WhatsApp</Label>
              <Input
                value={printSettings.whatsapp || ''}
                onChange={e => updatePS('whatsapp', applyMask(e.target.value, 'phone'))}
                placeholder="(00) 00000-0000"
                maxLength={15}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Image className="h-5 w-5" /> Tela de Login</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Login Icon */}
          <div className="space-y-2">
            <Label>Ícone do Login</Label>
            <p className="text-xs text-muted-foreground">Imagem exibida acima do formulário de login (diferente da logo da sidebar).</p>
            <div className="flex items-center gap-4">
              <div className="h-16 w-16 rounded-xl border-2 border-dashed border-border overflow-hidden bg-muted flex items-center justify-center">
                {loginIcon ? (
                  <img src={loginIcon} alt="Login Icon" className="h-full w-full object-contain" />
                ) : (
                  <Upload className="h-5 w-5 text-muted-foreground" />
                )}
              </div>
              <label className="cursor-pointer">
                <Button variant="outline" size="sm" asChild>
                  <span>{uploadingIcon ? 'Enviando...' : 'Alterar ícone'}</span>
                </Button>
                <input type="file" accept="image/*" className="hidden" onChange={handleLoginIconUpload} disabled={uploadingIcon} />
              </label>
            </div>
          </div>

          {/* Carousel Images */}
          <div className="space-y-2">
            <Label>Imagens do Carrossel</Label>
            <p className="text-xs text-muted-foreground">Imagens exibidas no lado esquerdo da tela de login. Se vazio, serão usadas as imagens padrão.</p>
            <div className="flex flex-wrap gap-3">
              {carouselImages.map((img, i) => (
                <div key={i} className="relative h-20 w-32 rounded-lg overflow-hidden border bg-muted group">
                  <img src={img} alt={`Slide ${i + 1}`} className="h-full w-full object-cover" />
                  <button
                    onClick={() => removeCarouselImage(i)}
                    className="absolute top-1 right-1 p-1 rounded-full bg-destructive text-destructive-foreground opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
              <label className="h-20 w-32 rounded-lg border-2 border-dashed border-border flex flex-col items-center justify-center cursor-pointer hover:bg-muted/50 transition-colors">
                <Plus className="h-5 w-5 text-muted-foreground" />
                <span className="text-[10px] text-muted-foreground mt-1">{uploadingCarousel ? 'Enviando...' : 'Adicionar'}</span>
                <input type="file" accept="image/*" multiple className="hidden" onChange={handleCarouselUpload} disabled={uploadingCarousel} />
              </label>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Grid3X3 className="h-5 w-5" /> Configurações Gerais</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-end gap-3 max-w-xs">
            <div className="flex-1 space-y-2">
              <Label>Quantidade de mesas (mín. 5)</Label>
              <Input type="number" min={5} max={100} value={tableCount} onChange={e => setTableCount(e.target.value)} />
            </div>
          </div>
          <div className="flex items-end gap-3 max-w-xs">
            <div className="flex-1 space-y-2">
              <Label>Taxa de serviço / comissão (%)</Label>
              <p className="text-xs text-muted-foreground">Aplicada apenas em pedidos do tipo Mesa</p>
              <Input type="text" inputMode="decimal" placeholder="Ex: 10" value={serviceFee} onChange={e => setServiceFee(e.target.value)} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Cabeçalho e Rodapé do Recibo */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Printer className="h-5 w-5" /> Recibo / Conta — Visibilidade do Cabeçalho</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-xs text-muted-foreground">Escolha quais informações do estabelecimento serão exibidas no topo do recibo impresso.</p>
          <div className="space-y-3">
            <div className="flex items-center justify-between py-2 border-b">
              <div>
                <p className="text-sm font-medium">Endereço</p>
                <p className="text-xs text-muted-foreground">{printSettings.address || 'Não configurado'}</p>
              </div>
              <Switch checked={!!printSettings.showAddress} onCheckedChange={v => updatePS('showAddress', v)} />
            </div>
            <div className="flex items-center justify-between py-2 border-b">
              <div>
                <p className="text-sm font-medium">{printSettings.documentType?.toUpperCase() || 'CNPJ'}</p>
                <p className="text-xs text-muted-foreground">{printSettings.document || 'Não configurado'}</p>
              </div>
              <Switch checked={!!printSettings.showDocument} onCheckedChange={v => updatePS('showDocument', v)} />
            </div>
            <div className="flex items-center justify-between py-2">
              <div>
                <p className="text-sm font-medium">WhatsApp</p>
                <p className="text-xs text-muted-foreground">{printSettings.whatsapp || 'Não configurado'}</p>
              </div>
              <Switch checked={!!printSettings.showWhatsapp} onCheckedChange={v => updatePS('showWhatsapp', v)} />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Printer className="h-5 w-5" /> Recibo / Conta — Rodapé Personalizado</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-xs text-muted-foreground">Informações exibidas no final do recibo. Ative apenas o que deseja imprimir.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Chave PIX</Label>
              <Input value={printSettings.pixKey || ''} onChange={e => updatePS('pixKey', e.target.value)} placeholder="email@exemplo.com ou CPF/CNPJ" />
            </div>
            <div className="space-y-2">
              <Label>Instagram</Label>
              <Input value={printSettings.instagram || ''} onChange={e => updatePS('instagram', e.target.value)} placeholder="@seurestaurante" />
            </div>
            <div className="sm:col-span-2 space-y-2">
              <Label>Mensagem de Obrigado</Label>
              <Input value={printSettings.thankMessage || ''} onChange={e => updatePS('thankMessage', e.target.value)} placeholder="Obrigado pela preferência!" />
            </div>
          </div>
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between py-2 border-b">
              <p className="text-sm font-medium">Exibir Chave PIX</p>
              <Switch checked={!!printSettings.showPixKey} onCheckedChange={v => updatePS('showPixKey', v)} />
            </div>
            <div className="flex items-center justify-between py-2 border-b">
              <p className="text-sm font-medium">Exibir Instagram</p>
              <Switch checked={!!printSettings.showInstagram} onCheckedChange={v => updatePS('showInstagram', v)} />
            </div>
            <div className="flex items-center justify-between py-2">
              <p className="text-sm font-medium">Exibir Mensagem de Obrigado</p>
              <Switch checked={!!printSettings.showThankMessage} onCheckedChange={v => updatePS('showThankMessage', v)} />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end pt-4">
        <Button onClick={handleSaveAll} size="lg" className="w-full sm:w-auto gap-2" disabled={savingGeneral}>
          {savingGeneral && <Loader2 className="h-4 w-4 animate-spin" />}
          {savingGeneral ? 'Salvando tudo...' : 'Salvar Tudo'}
        </Button>
      </div>
    </div>
  );
}

interface UserRow {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: AppRole;
  commission: number;
}

function UsuariosTab() {
  const { user } = useAuth();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', email: '', role: 'atendente' as AppRole, password: '', commission: '' });
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [resetModal, setResetModal] = useState<UserRow | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [resetting, setResetting] = useState(false);

  const fetchUsers = useCallback(async () => {
    // tenant_members is already filtered by RLS to current tenant
    const { data: members } = await supabase.from('tenant_members').select('user_id, commission_percentage');
    if (!members || members.length === 0) { setUsers([]); setLoadingUsers(false); return; }

    const memberUserIds = members.map(m => m.user_id);
    const { data: profiles } = await supabase.from('profiles').select('id, name, email, phone').in('id', memberUserIds);
    const { data: roles } = await supabase.from('user_roles').select('user_id, role').in('user_id', memberUserIds);

    if (profiles) {
      const userList: UserRow[] = profiles.map(p => {
        const userRole = roles?.find(r => r.user_id === p.id);
        const member = members.find(m => m.user_id === p.id);
        return { id: p.id, name: p.name, email: p.email, phone: p.phone || '', role: (userRole?.role as AppRole) || 'atendente', commission: Number((member as any)?.commission_percentage || 0) };
      });
      setUsers(userList);
    }
    setLoadingUsers(false);
  }, []);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const resetForm = () => {
    setForm({ name: '', email: '', role: 'atendente', password: '', commission: '' });
    setShowForm(false);
    setEditingId(null);
  };

  const handleSave = async () => {
    if (!form.name || !form.email) {
      toast.error('Preencha nome e email');
      return;
    }

    const commissionVal = parseFloat(form.commission.replace(',', '.')) || 0;

    if (editingId) {
      // Update profile name
      await supabase.from('profiles').update({ name: form.name }).eq('id', editingId);
      // Update role
      const { data: existingRole } = await supabase.from('user_roles').select('id').eq('user_id', editingId).single();
      if (existingRole) {
        await supabase.from('user_roles').update({ role: form.role }).eq('user_id', editingId);
      } else {
        await supabase.from('user_roles').insert({ user_id: editingId, role: form.role });
      }
      // Update commission
      await supabase.from('tenant_members').update({ commission_percentage: commissionVal } as any).eq('user_id', editingId);
      toast.success('Usuário atualizado!');
    } else {
      if (!form.password || form.password.length < 4) {
        toast.error('Senha deve ter no mínimo 4 caracteres');
        return;
      }
      try {
        const { data: createData, error } = await supabase.functions.invoke('manage-users', {
          body: {
            action: 'create',
            email: form.email,
            password: form.password,
            name: form.name,
            role: form.role,
            tenant_id: user?.tenantId,
            commission: commissionVal
          }
        });
        if (error) throw error;
        if (createData?.error) throw new Error(createData.error);
        toast.success('Usuário criado!');
      } catch (err: any) {
        toast.error(err.message || 'Erro ao criar usuário');
        return;
      }
    }
    resetForm();
    // Refetch after a short delay to allow trigger to create profile
    setTimeout(fetchUsers, 500);
  };

  const handleEdit = (u: UserRow) => {
    setForm({ name: u.name, email: u.email, role: u.role, password: '', commission: u.commission.toString() });
    setEditingId(u.id);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('manage-users', {
        body: { action: 'delete', user_id: id }
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success('Usuário removido com sucesso');
      fetchUsers();
    } catch (err: any) {
      toast.error(err.message || 'Erro ao remover usuário');
    }
  };

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2"><Users className="h-5 w-5" /> Usuários</CardTitle>
          {!showForm && (
            <Button size="sm" onClick={() => setShowForm(true)}><Plus className="h-4 w-4 mr-1" /> Novo</Button>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          {showForm && (
            <div className="border rounded-lg p-4 space-y-3 bg-muted/30">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Nome</Label>
                  <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Nome completo" />
                </div>
                <div className="space-y-1">
                  <Label>Email</Label>
                  <Input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="email@exemplo.com" disabled={!!editingId} />
                </div>
                <div className="space-y-1">
                  <Label>Função</Label>
                  <Select value={form.role} onValueChange={v => setForm(f => ({ ...f, role: v as AppRole }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">Administrador</SelectItem>
                      <SelectItem value="atendente">Atendente</SelectItem>
                      <SelectItem value="motoboy">Motoboy</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {!editingId && (
                  <div className="space-y-1">
                    <Label>Senha</Label>
                    <Input type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} placeholder="••••••" />
                  </div>
                )}
                {(form.role === 'atendente') && (
                  <div className="space-y-1">
                    <Label>Comissão (%)</Label>
                    <Input type="text" inputMode="decimal" value={form.commission} onChange={e => setForm(f => ({ ...f, commission: e.target.value }))} placeholder="Ex: 5" />
                  </div>
                )}
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={handleSave}><Check className="h-4 w-4 mr-1" /> {editingId ? 'Atualizar' : 'Criar'}</Button>
                <Button size="sm" variant="ghost" onClick={resetForm}><X className="h-4 w-4 mr-1" /> Cancelar</Button>
              </div>
            </div>
          )}

          {loadingUsers ? (
            <p className="text-sm text-muted-foreground text-center py-4">Carregando...</p>
          ) : (
            <div className="space-y-2">
              {users.map(u => (
                <div key={u.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/40 border">
                  <div>
                    <p className="font-medium text-foreground">{u.name}</p>
                    <p className="text-sm text-muted-foreground">{u.email}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={u.role === 'admin' ? 'default' : 'secondary'}>{roleLabels[u.role]}</Badge>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEdit(u)}>
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setResetModal(u)} title="Redefinir senha">
                      <KeyRound className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDelete(u.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!resetModal} onOpenChange={() => { setResetModal(null); setNewPassword(''); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Redefinir Senha</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Usuário: <strong>{resetModal?.name}</strong> ({resetModal?.email})
          </p>
          <div className="space-y-2">
            <Label>Nova Senha</Label>
            <Input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="Mínimo 6 caracteres" />
          </div>
          <Button onClick={async () => {
            if (!resetModal || !newPassword || newPassword.length < 6) {
              toast.error('Senha deve ter pelo menos 6 caracteres');
              return;
            }
            setResetting(true);
            try {
              const { data, error } = await supabase.functions.invoke('manage-users', {
                body: { action: 'reset_password', user_id: resetModal.id, new_password: newPassword },
              });
              if (error) throw error;
              if (data?.error) throw new Error(data.error);
              toast.success(`Senha de ${resetModal.name} redefinida!`);
              setResetModal(null);
              setNewPassword('');
            } catch (err: any) {
              toast.error(err.message || 'Erro ao redefinir senha');
            } finally {
              setResetting(false);
            }
          }} disabled={resetting} className="w-full">
            {resetting ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Redefinindo...</> : 'Redefinir Senha'}
          </Button>
        </DialogContent>
      </Dialog>
    </>
  );
}

function CuponsTab() {
  const { coupons, setCoupons } = useStore();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ code: '', type: 'percentage' as 'percentage' | 'fixed', value: '', minOrder: '', expiresAt: '' });

  const resetForm = () => {
    setForm({ code: '', type: 'percentage', value: '', minOrder: '', expiresAt: '' });
    setShowForm(false);
    setEditingId(null);
  };

  const handleSave = () => {
    if (!form.code || !form.value) return;
    const val = parseFloat(form.value.replace(',', '.'));
    if (isNaN(val) || val <= 0) return;

    const coupon: DiscountCoupon = {
      id: editingId || crypto.randomUUID(),
      code: form.code.toUpperCase(),
      type: form.type,
      value: val,
      active: true,
      minOrder: form.minOrder ? parseFloat(form.minOrder.replace(',', '.')) : undefined,
      expiresAt: form.expiresAt || undefined,
    };

    if (editingId) {
      setCoupons(prev => prev.map(c => c.id === editingId ? coupon : c));
    } else {
      setCoupons(prev => [...prev, coupon]);
    }
    resetForm();
  };

  const toggleActive = (id: string) => {
    setCoupons(prev => prev.map(c => c.id === id ? { ...c, active: !c.active } : c));
  };

  const handleDelete = (id: string) => {
    setCoupons(prev => prev.filter(c => c.id !== id));
  };

  const handleEdit = (coupon: DiscountCoupon) => {
    setForm({
      code: coupon.code,
      type: coupon.type,
      value: coupon.value.toString(),
      minOrder: coupon.minOrder?.toString() || '',
      expiresAt: coupon.expiresAt || '',
    });
    setEditingId(coupon.id);
    setShowForm(true);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2"><Ticket className="h-5 w-5" /> Cupons de Desconto</CardTitle>
        {!showForm && (
          <Button size="sm" onClick={() => setShowForm(true)}><Plus className="h-4 w-4 mr-1" /> Novo</Button>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {showForm && (
          <div className="border rounded-lg p-4 space-y-3 bg-muted/30">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Código</Label>
                <Input value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value }))} placeholder="EX: DESCONTO10" className="uppercase" />
              </div>
              <div className="space-y-1">
                <Label>Tipo</Label>
                <Select value={form.type} onValueChange={v => setForm(f => ({ ...f, type: v as 'percentage' | 'fixed' }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percentage">Porcentagem (%)</SelectItem>
                    <SelectItem value="fixed">Valor fixo (R$)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Valor {form.type === 'percentage' ? '(%)' : '(R$)'}</Label>
                <Input value={form.value} onChange={e => setForm(f => ({ ...f, value: e.target.value }))} placeholder={form.type === 'percentage' ? '10' : '5,00'} />
              </div>
              <div className="space-y-1">
                <Label>Pedido mínimo (R$)</Label>
                <Input value={form.minOrder} onChange={e => setForm(f => ({ ...f, minOrder: e.target.value }))} placeholder="Opcional" />
              </div>
              <div className="space-y-1">
                <Label>Validade</Label>
                <Input type="date" value={form.expiresAt} onChange={e => setForm(f => ({ ...f, expiresAt: e.target.value }))} />
              </div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={handleSave}><Check className="h-4 w-4 mr-1" /> {editingId ? 'Atualizar' : 'Criar'}</Button>
              <Button size="sm" variant="ghost" onClick={resetForm}><X className="h-4 w-4 mr-1" /> Cancelar</Button>
            </div>
          </div>
        )}

        <div className="space-y-2">
          {coupons.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">Nenhum cupom cadastrado.</p>}
          {coupons.map(c => (
            <div key={c.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/40 border">
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-mono font-bold text-foreground">{c.code}</p>
                  <Badge variant={c.active ? 'default' : 'secondary'}>{c.active ? 'Ativo' : 'Inativo'}</Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  {c.type === 'percentage' ? `${c.value}%` : `R$ ${fmt(c.value)}`} de desconto
                  {c.minOrder ? ` · Mín. R$ ${fmt(c.minOrder)}` : ''}
                  {c.expiresAt ? ` · Até ${new Date(c.expiresAt).toLocaleDateString('pt-BR')}` : ''}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={c.active} onCheckedChange={() => toggleActive(c.id)} />
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEdit(c)}>
                  <Edit2 className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDelete(c.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

const permissionLabels: Record<string, string> = {
  manage_categories: 'Cadastrar/editar categorias',
  manage_products: 'Cadastrar/editar produtos',
  edit_prices: 'Alterar preços e descrições',
  manage_stock: 'Dar entrada no estoque',
  remove_order_items: 'Remover itens do pedido',
  cancel_orders: 'Cancelar pedidos',
  apply_discounts: 'Aplicar descontos',
  manage_customers: 'Gerenciar clientes',
  manage_cash: 'Movimentar caixa (entradas/saídas)',
};

const permissionKeys = Object.keys(permissionLabels);

interface AttendantPermissions {
  id?: string;
  user_id: string;
  [key: string]: any;
}

function PermissoesTab() {
  const [users, setUsers] = useState<{ id: string; name: string; email: string; role: string }[]>([]);
  const [permissions, setPermissions] = useState<Record<string, AttendantPermissions>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [copySource, setCopySource] = useState('');

  const fetchData = useCallback(async () => {
    // Filter by tenant via tenant_members (RLS-filtered)
    const { data: members } = await supabase.from('tenant_members').select('user_id');
    if (!members || members.length === 0) { setUsers([]); setLoading(false); return; }
    const memberIds = members.map(m => m.user_id);

    const { data: profiles } = await supabase.from('profiles').select('id, name, email').in('id', memberIds);
    const { data: roles } = await supabase.from('user_roles').select('user_id, role').in('user_id', memberIds);
    const { data: perms } = await supabase.from('attendant_permissions').select('*');

    const attendants = (profiles || []).filter(p => {
      const role = roles?.find(r => r.user_id === p.id);
      const effectiveRole = role?.role || 'atendente';
      return effectiveRole === 'atendente';
    }).map(p => ({ id: p.id, name: p.name, email: p.email, role: 'atendente' }));

    setUsers(attendants);

    const permMap: Record<string, AttendantPermissions> = {};
    for (const perm of (perms || [])) {
      permMap[perm.user_id] = perm;
    }
    setPermissions(permMap);
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const togglePermission = async (userId: string, key: string) => {
    setSaving(userId);
    const existing = permissions[userId];
    const currentVal = existing?.[key] ?? false;
    const newVal = !currentVal;

    if (existing?.id) {
      await supabase.from('attendant_permissions').update({ [key]: newVal } as any).eq('id', existing.id);
    } else {
      const newPerms: any = { user_id: userId };
      permissionKeys.forEach(k => newPerms[k] = k === key ? newVal : false);
      const { data } = await supabase.from('attendant_permissions').insert(newPerms).select().single();
      if (data) {
        setPermissions(prev => ({ ...prev, [userId]: data }));
        setSaving(null);
        return;
      }
    }

    setPermissions(prev => ({
      ...prev,
      [userId]: { ...prev[userId], user_id: userId, [key]: newVal },
    }));
    setSaving(null);
  };

  const toggleAll = async (userId: string, enable: boolean) => {
    setSaving(userId);
    const updates: any = {};
    permissionKeys.forEach(k => updates[k] = enable);

    const existing = permissions[userId];
    if (existing?.id) {
      await supabase.from('attendant_permissions').update(updates).eq('id', existing.id);
    } else {
      const { data } = await supabase.from('attendant_permissions').insert({ user_id: userId, ...updates }).select().single();
      if (data) {
        setPermissions(prev => ({ ...prev, [userId]: data }));
        setSaving(null);
        return;
      }
    }
    setPermissions(prev => ({
      ...prev,
      [userId]: { ...prev[userId], user_id: userId, ...updates },
    }));
    setSaving(null);
  };

  const copyPermissions = async (targetUserId: string) => {
    if (!copySource) return;
    const source = permissions[copySource];
    if (!source) return;

    setSaving(targetUserId);
    const updates: any = {};
    permissionKeys.forEach(k => updates[k] = source[k] ?? false);

    const existing = permissions[targetUserId];
    if (existing?.id) {
      await supabase.from('attendant_permissions').update(updates).eq('id', existing.id);
    } else {
      const { data } = await supabase.from('attendant_permissions').insert({ user_id: targetUserId, ...updates }).select().single();
      if (data) {
        setPermissions(prev => ({ ...prev, [targetUserId]: data }));
        setSaving(null);
        toast.success('Permissões copiadas!');
        return;
      }
    }
    setPermissions(prev => ({
      ...prev,
      [targetUserId]: { ...prev[targetUserId], user_id: targetUserId, ...updates },
    }));
    setSaving(null);
    toast.success('Permissões copiadas!');
  };

  if (loading) return <p className="text-sm text-muted-foreground text-center py-8">Carregando...</p>;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><KeyRound className="h-5 w-5" /> Permissões de Atendentes</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {users.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">Nenhum atendente cadastrado.</p>
        )}
        {users.map(u => (
          <div key={u.id} className="border rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-foreground">{u.name}</p>
                <p className="text-xs text-muted-foreground">{u.email}</p>
              </div>
              <div className="flex gap-1">
                <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => toggleAll(u.id, true)}>
                  Marcar todos
                </Button>
                <Button size="sm" variant="ghost" className="text-xs h-7" onClick={() => toggleAll(u.id, false)}>
                  Desmarcar
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {permissionKeys.map(key => (
                <label key={key} className="flex items-center gap-2 text-sm cursor-pointer">
                  <Switch
                    checked={permissions[u.id]?.[key] ?? false}
                    onCheckedChange={() => togglePermission(u.id, key)}
                    disabled={saving === u.id}
                  />
                  <span className="text-foreground">{permissionLabels[key]}</span>
                </label>
              ))}
            </div>

            {/* Copy from another attendant */}
            {users.length > 1 && (
              <div className="flex gap-2 items-center pt-1 border-t">
                <span className="text-xs text-muted-foreground">Copiar de:</span>
                <Select value={copySource} onValueChange={setCopySource}>
                  <SelectTrigger className="h-8 text-xs w-40"><SelectValue placeholder="Selecionar" /></SelectTrigger>
                  <SelectContent>
                    {users.filter(x => x.id !== u.id).map(x => (
                      <SelectItem key={x.id} value={x.id}>{x.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button size="sm" variant="outline" className="text-xs h-8" onClick={() => copyPermissions(u.id)} disabled={!copySource}>
                  Copiar
                </Button>
              </div>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

// ImpressoraTab is now imported from @/components/ImpressoraTab

export default Configuracoes;
