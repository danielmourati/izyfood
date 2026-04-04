import React, { useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { maskPhone } from '@/lib/utils';
import { toast } from 'sonner';
import { User, Save, Loader2, Store, Shield } from 'lucide-react';

const roleLabels: Record<string, string> = {
  admin: 'Administrador',
  atendente: 'Atendente',
  motoboy: 'Motoboy',
  superadmin: 'Super Admin',
};

export function MeuPerfilTab() {
  const { user } = useAuth();
  const [name, setName] = useState(user?.name || '');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [loadedPhone, setLoadedPhone] = useState(false);

  React.useEffect(() => {
    if (user?.id && !loadedPhone) {
      supabase.from('profiles').select('phone').eq('id', user.id).single().then(({ data }) => {
        if (data) setPhone(data.phone || '');
        setLoadedPhone(true);
      });
    }
  }, [user?.id, loadedPhone]);

  const initials = user?.name
    ? user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : '?';

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error('Nome não pode ser vazio');
      return;
    }
    if (password && password !== confirmPassword) {
      toast.error('As senhas não conferem');
      return;
    }
    if (password && password.length < 6) {
      toast.error('Senha deve ter pelo menos 6 caracteres');
      return;
    }

    setSaving(true);
    try {
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ name: name.trim(), phone: phone.trim() })
        .eq('id', user!.id);

      if (profileError) throw profileError;

      if (password) {
        const { error: passError } = await supabase.auth.updateUser({ password });
        if (passError) throw passError;
      }

      toast.success('Perfil atualizado com sucesso!');
      setPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      toast.error(err.message || 'Erro ao atualizar perfil');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4 max-w-lg">
      {/* User info card */}
      <Card>
        <CardContent className="p-5">
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xl shrink-0 ring-2 ring-primary/20">
              {initials}
            </div>
            <div className="min-w-0 space-y-1">
              <p className="text-lg font-semibold text-foreground truncate">{user?.name}</p>
              <p className="text-sm text-muted-foreground truncate">{user?.email}</p>
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="default" className="gap-1">
                  <Shield className="h-3 w-3" />
                  {roleLabels[user?.role || 'atendente']}
                </Badge>
                <Badge variant="outline" className="gap-1">
                  <Store className="h-3 w-3" />
                  {user?.tenantName}
                </Badge>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Edit form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <User className="h-5 w-5" /> Dados Pessoais
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Nome</Label>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="Seu nome completo" />
          </div>

          <div className="space-y-2">
            <Label>Email</Label>
            <Input value={user?.email || ''} disabled className="opacity-60" />
            <p className="text-xs text-muted-foreground">O email não pode ser alterado.</p>
          </div>

          <div className="space-y-2">
            <Label>Telefone / WhatsApp</Label>
            <Input value={phone} onChange={e => setPhone(maskPhone(e.target.value))} placeholder="(00) 00000-0000" maxLength={15} />
          </div>

          <div className="pt-3 border-t space-y-3">
            <p className="text-sm font-semibold text-foreground">Alterar Senha</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Nova Senha</Label>
                <Input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Mín. 6 caracteres" />
              </div>
              <div className="space-y-2">
                <Label>Confirmar Senha</Label>
                <Input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="Repita a senha" />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">Deixe os campos vazios para manter a senha atual.</p>
          </div>

          <Button onClick={handleSave} disabled={saving} className="w-full">
            {saving ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Salvando...</> : <><Save className="h-4 w-4 mr-2" /> Salvar Alterações</>}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
