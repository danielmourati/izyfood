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
  Settings, Users, Grid3X3, Ticket, Printer, Plus, Trash2, Edit2, Check, X, KeyRound, User, Loader2
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

type Tab = 'perfil' | 'geral' | 'usuarios' | 'cupons' | 'impressora';

const allTabs: { key: Tab; label: string; icon: React.ElementType; adminOnly: boolean }[] = [
  { key: 'perfil', label: 'Meu Perfil', icon: User, adminOnly: false },
  { key: 'geral', label: 'Geral', icon: Settings, adminOnly: true },
  { key: 'usuarios', label: 'Usuários', icon: Users, adminOnly: true },
  { key: 'cupons', label: 'Cupons', icon: Ticket, adminOnly: true },
  { key: 'impressora', label: 'Impressora', icon: Printer, adminOnly: true },
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
    <div className="p-4 md:p-6 space-y-4">
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
      {activeTab === 'cupons' && <CuponsTab />}
      {activeTab === 'impressora' && <ImpressoraTab />}
    </div>
  );
};

function GeralTab() {
  const { settings, updateTableCount } = useStore();
  const [tableCount, setTableCount] = useState(settings.tableCount.toString());

  const handleSave = () => {
    const count = parseInt(tableCount);
    if (isNaN(count) || count < 1 || count > 100) return;
    updateTableCount(count);
    toast.success('Configuração salva!');
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Grid3X3 className="h-5 w-5" /> Mesas</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-end gap-3 max-w-xs">
          <div className="flex-1 space-y-2">
            <Label>Quantidade de mesas</Label>
            <Input
              type="number"
              min={1}
              max={100}
              value={tableCount}
              onChange={e => setTableCount(e.target.value)}
            />
          </div>
          <Button onClick={handleSave}>Salvar</Button>
        </div>
      </CardContent>
    </Card>
  );
}

interface UserRow {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: AppRole;
}

function UsuariosTab() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', email: '', role: 'atendente' as AppRole, password: '' });
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [resetModal, setResetModal] = useState<UserRow | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [resetting, setResetting] = useState(false);

  const fetchUsers = useCallback(async () => {
    const { data: profiles } = await supabase.from('profiles').select('id, name, email, phone');
    const { data: roles } = await supabase.from('user_roles').select('user_id, role');

    if (profiles) {
      const userList: UserRow[] = profiles.map(p => {
        const userRole = roles?.find(r => r.user_id === p.id);
        return { id: p.id, name: p.name, email: p.email, phone: p.phone || '', role: (userRole?.role as AppRole) || 'atendente' };
      });
      setUsers(userList);
    }
    setLoadingUsers(false);
  }, []);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const resetForm = () => {
    setForm({ name: '', email: '', role: 'atendente', password: '' });
    setShowForm(false);
    setEditingId(null);
  };

  const handleSave = async () => {
    if (!form.name || !form.email) {
      toast.error('Preencha nome e email');
      return;
    }

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
      toast.success('Usuário atualizado!');
    } else {
      if (!form.password || form.password.length < 4) {
        toast.error('Senha deve ter no mínimo 4 caracteres');
        return;
      }
      // Create new user via signUp
      const { data: signUpData, error } = await supabase.auth.signUp({
        email: form.email,
        password: form.password,
        options: { data: { name: form.name } },
      });
      if (error) {
        toast.error(error.message);
        return;
      }
      if (signUpData.user) {
        // Assign role
        await supabase.from('user_roles').insert({ user_id: signUpData.user.id, role: form.role });
        toast.success('Usuário criado!');
      }
    }
    resetForm();
    // Refetch after a short delay to allow trigger to create profile
    setTimeout(fetchUsers, 500);
  };

  const handleEdit = (u: UserRow) => {
    setForm({ name: u.name, email: u.email, role: u.role, password: '' });
    setEditingId(u.id);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    // Note: deleting auth users requires admin API (service role).
    // For now, we just remove the role so they can't access.
    await supabase.from('user_roles').delete().eq('user_id', id);
    toast.success('Acesso do usuário removido');
    fetchUsers();
  };

  return (
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

function ImpressoraTab() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Printer className="h-5 w-5" /> Impressora</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">Configuração de impressora térmica em breve.</p>
      </CardContent>
    </Card>
  );
}

export default Configuracoes;
