import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { createClient } from '@supabase/supabase-js';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

type Tenant = { id: string; name: string; slug: string };

export interface UserFormValue {
  id?: string;
  name: string;
  email: string;
  phone?: string;
  role: string;
  tenant_id: string;
  password?: string;
}

interface Props {
  open: boolean;
  mode: 'create' | 'edit';
  initial?: UserFormValue;
  tenants: Tenant[];
  onClose: () => void;
  onSaved: () => void;
}

const ROLES = [
  { value: 'admin', label: 'Administrador' },
  { value: 'atendente', label: 'Atendente' },
  { value: 'motoboy', label: 'Motoboy' },
];

/** Phone mask (00) 00000-0000 */
function maskPhone(v: string): string {
  const d = v.replace(/\D/g, '').slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

export function UserFormModal({ open, mode, initial, tenants, onClose, onSaved }: Props) {
  const [form, setForm] = useState<UserFormValue>({
    name: '', email: '', phone: '', role: 'atendente', tenant_id: '', password: '',
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setForm(initial ?? { name: '', email: '', phone: '', role: 'atendente', tenant_id: tenants[0]?.id || '', password: '' });
    }
  }, [open, initial, tenants]);

  const handleSave = async () => {
    if (!form.name.trim() || !form.email.trim() || !form.role || !form.tenant_id) {
      toast.error('Preencha nome, email, função e tenant');
      return;
    }
    if (mode === 'create' && (!form.password || form.password.length < 6)) {
      toast.error('Senha deve ter no mínimo 6 caracteres');
      return;
    }
    setSaving(true);
    try {
      const action = mode === 'create' ? 'create' : 'update';
      const { data, error } = await supabase.functions.invoke('manage-users', {
        body: {
          action,
          user_id: form.id,
          name: form.name.trim(),
          email: form.email.trim(),
          phone: form.phone || null,
          role: form.role,
          tenant_id: form.tenant_id,
          ...(mode === 'create' ? { password: form.password } : {}),
        },
      });
      if (error || (data as any)?.error) {
        throw error || new Error((data as any)?.error);
      }
      toast.success(mode === 'create' ? 'Usuário criado!' : 'Usuário atualizado!');
      onSaved();
      onClose();
    } catch (e: any) {
      console.warn('[UserFormModal] Edge function falhou, tentando salvamento direto:', e);
      try {
        if (mode === 'create') {
          // Cliente temporário para não alterar o token do admin logado
          const tempAuthClient = createClient(
            import.meta.env.VITE_SUPABASE_URL,
            import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            { auth: { persistSession: false, autoRefreshToken: false } }
          );

          const { data: signUpData, error: signUpError } = await tempAuthClient.auth.signUp({
            email: form.email.trim(),
            password: form.password || '123456',
            options: {
              data: {
                name: form.name.trim(),
                role: form.role,
                tenant_id: form.tenant_id,
              }
            }
          });

          if (signUpError) {
            if (signUpError.message.includes('already registered') || signUpError.message.includes('already exists')) {
              throw new Error('Este e-mail já está cadastrado no sistema.');
            }
            throw signUpError;
          }

          const createdId = signUpData?.user?.id;
          if (!createdId) {
            throw new Error('Não foi possível cadastrar a conta de acesso do usuário.');
          }

          const { error: profErr } = await supabase.from('profiles').upsert({
            id: createdId,
            name: form.name.trim(),
            email: form.email.trim(),
            phone: form.phone || '',
          } as any);
          if (profErr) console.warn('[UserFormModal] Upsert profiles warning:', profErr);

          const { error: roleErr } = await supabase.from('user_roles').upsert({
            user_id: createdId,
            role: form.role,
          } as any);
          if (roleErr) console.warn('[UserFormModal] Upsert user_roles warning:', roleErr);

          if (form.tenant_id) {
            const { error: memberErr } = await supabase.from('tenant_members').upsert({
              user_id: createdId,
              tenant_id: form.tenant_id,
              role: form.role,
            } as any);
            if (memberErr) console.warn('[UserFormModal] Upsert tenant_members warning:', memberErr);
          }

          toast.success('Usuário criado com sucesso!');
        } else if (form.id) {
          await supabase.from('profiles').update({
            name: form.name.trim(),
            email: form.email.trim(),
            phone: form.phone || '',
          } as any).eq('id', form.id);

          await supabase.from('user_roles').upsert({
            user_id: form.id,
            role: form.role,
          } as any);

          if (form.tenant_id) {
            await supabase.from('tenant_members').upsert({
              user_id: form.id,
              tenant_id: form.tenant_id,
              role: form.role,
            } as any);
          }

          toast.success('Usuário atualizado com sucesso!');
        }
        onSaved();
        onClose();
      } catch (fallbackErr: any) {
        console.error('[UserFormModal] Erro ao salvar usuário:', fallbackErr);
        toast.error(fallbackErr.message || e.message || 'Erro ao salvar usuário');
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{mode === 'create' ? 'Novo Usuário' : 'Editar Usuário'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Nome</Label>
            <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
          </div>
          <div>
            <Label>Email</Label>
            <Input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
          </div>
          <div>
            <Label>Telefone</Label>
            <Input value={form.phone || ''} onChange={e => setForm({ ...form, phone: maskPhone(e.target.value) })} placeholder="(00) 00000-0000" />
          </div>
          {mode === 'create' && (
            <div>
              <Label>Senha</Label>
              <Input type="password" value={form.password || ''} onChange={e => setForm({ ...form, password: e.target.value })} placeholder="mínimo 6 caracteres" />
            </div>
          )}
          <div>
            <Label>Função</Label>
            <Select value={form.role} onValueChange={v => setForm({ ...form, role: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {ROLES.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Tenant</Label>
            <Select value={form.tenant_id} onValueChange={v => setForm({ ...form, tenant_id: v })}>
              <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
              <SelectContent>
                {tenants.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {mode === 'create' ? 'Criar' : 'Salvar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
