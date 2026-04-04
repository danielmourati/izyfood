import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { User, Save, Loader2 } from 'lucide-react';

export function MeuPerfilTab() {
  const { user } = useAuth();
  const [name, setName] = useState(user?.name || '');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [loadedPhone, setLoadedPhone] = useState(false);

  // Load phone on mount
  React.useEffect(() => {
    if (user?.id && !loadedPhone) {
      supabase.from('profiles').select('phone').eq('id', user.id).single().then(({ data }) => {
        if (data) setPhone(data.phone || '');
        setLoadedPhone(true);
      });
    }
  }, [user?.id, loadedPhone]);

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
      // Update profile
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ name: name.trim(), phone: phone.trim() })
        .eq('id', user!.id);

      if (profileError) throw profileError;

      // Update password if provided
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
    <Card className="max-w-lg">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <User className="h-5 w-5" /> Meu Perfil
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>Nome</Label>
          <Input value={name} onChange={e => setName(e.target.value)} placeholder="Seu nome" />
        </div>

        <div className="space-y-2">
          <Label>Email</Label>
          <Input value={user?.email || ''} disabled className="opacity-60" />
          <p className="text-xs text-muted-foreground">O email não pode ser alterado.</p>
        </div>

        <div className="space-y-2">
          <Label>Telefone / WhatsApp</Label>
          <Input value={phone} onChange={e => setPhone(e.target.value)} placeholder="(00) 00000-0000" />
        </div>

        <div className="pt-2 border-t space-y-3">
          <p className="text-sm font-semibold text-foreground">Alterar Senha</p>
          <div className="space-y-2">
            <Label>Nova Senha</Label>
            <Input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Deixe vazio para não alterar" />
          </div>
          <div className="space-y-2">
            <Label>Confirmar Senha</Label>
            <Input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="Repita a nova senha" />
          </div>
        </div>

        <Button onClick={handleSave} disabled={saving} className="w-full">
          {saving ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Salvando...</> : <><Save className="h-4 w-4 mr-2" /> Salvar Alterações</>}
        </Button>
      </CardContent>
    </Card>
  );
}
