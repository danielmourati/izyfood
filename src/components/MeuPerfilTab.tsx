import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { maskPhone } from '@/lib/utils';
import { User, Save, Loader2, Store, Shield, CheckCircle2, AlertCircle, KeyRound } from 'lucide-react';

const roleLabels: Record<string, string> = {
  admin: 'Administrador',
  atendente: 'Atendente',
  motoboy: 'Motoboy',
  superadmin: 'Super Admin',
};

type Feedback = { type: 'success' | 'error'; message: string } | null;

export function MeuPerfilTab() {
  const { user } = useAuth();
  const [name, setName] = useState(user?.name || '');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [profileFeedback, setProfileFeedback] = useState<Feedback>(null);
  const [passwordFeedback, setPasswordFeedback] = useState<Feedback>(null);
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

  const handleSaveProfile = async () => {
    setProfileFeedback(null);
    if (!name.trim()) {
      setProfileFeedback({ type: 'error', message: 'Nome não pode ser vazio.' });
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ name: name.trim(), phone: phone.trim() })
        .eq('id', user!.id);
      if (error) throw error;
      setProfileFeedback({ type: 'success', message: 'Dados pessoais atualizados com sucesso.' });
    } catch (err: any) {
      setProfileFeedback({ type: 'error', message: err.message || 'Erro ao atualizar perfil.' });
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async () => {
    setPasswordFeedback(null);
    if (!password || password.length < 6) {
      setPasswordFeedback({ type: 'error', message: 'A senha deve ter pelo menos 6 caracteres.' });
      return;
    }
    if (password !== confirmPassword) {
      setPasswordFeedback({ type: 'error', message: 'As senhas não conferem.' });
      return;
    }

    setChangingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setPassword('');
      setConfirmPassword('');
      setPasswordFeedback({ type: 'success', message: 'Senha alterada com sucesso! Use a nova senha no próximo acesso.' });
    } catch (err: any) {
      setPasswordFeedback({ type: 'error', message: err.message || 'Erro ao alterar a senha.' });
    } finally {
      setChangingPassword(false);
    }
  };

  const renderFeedback = (fb: Feedback) => {
    if (!fb) return null;
    const isSuccess = fb.type === 'success';
    return (
      <Alert
        variant={isSuccess ? 'default' : 'destructive'}
        className={isSuccess ? 'border-green-500/50 bg-green-500/10 text-green-700 dark:text-green-400 [&>svg]:text-green-600' : ''}
      >
        {isSuccess ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
        <AlertTitle>{isSuccess ? 'Sucesso' : 'Erro'}</AlertTitle>
        <AlertDescription>{fb.message}</AlertDescription>
      </Alert>
    );
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

      {/* Personal data */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <User className="h-5 w-5" /> Dados Pessoais
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Nome</Label>
            <Input value={name} onChange={e => { setName(e.target.value); setProfileFeedback(null); }} placeholder="Seu nome completo" />
          </div>

          <div className="space-y-2">
            <Label>Email</Label>
            <Input value={user?.email || ''} disabled className="opacity-60" />
            <p className="text-xs text-muted-foreground">O email não pode ser alterado.</p>
          </div>

          <div className="space-y-2">
            <Label>Telefone / WhatsApp</Label>
            <Input value={phone} onChange={e => { setPhone(maskPhone(e.target.value)); setProfileFeedback(null); }} placeholder="(00) 00000-0000" maxLength={15} />
          </div>

          {renderFeedback(profileFeedback)}

          <Button onClick={handleSaveProfile} disabled={saving} className="w-full">
            {saving ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Salvando...</> : <><Save className="h-4 w-4 mr-2" /> Salvar Dados</>}
          </Button>
        </CardContent>
      </Card>

      {/* Password change - separated */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <KeyRound className="h-5 w-5" /> Alterar Senha
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Nova Senha</Label>
              <Input
                type="password"
                value={password}
                onChange={e => { setPassword(e.target.value); setPasswordFeedback(null); }}
                placeholder="Mín. 6 caracteres"
                autoComplete="new-password"
              />
            </div>
            <div className="space-y-2">
              <Label>Confirmar Senha</Label>
              <Input
                type="password"
                value={confirmPassword}
                onChange={e => { setConfirmPassword(e.target.value); setPasswordFeedback(null); }}
                placeholder="Repita a senha"
                autoComplete="new-password"
              />
            </div>
          </div>

          {renderFeedback(passwordFeedback)}

          <Button
            onClick={handleChangePassword}
            disabled={changingPassword || !password || !confirmPassword}
            className="w-full"
            variant="secondary"
          >
            {changingPassword ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Alterando senha...</>
            ) : (
              <><KeyRound className="h-4 w-4 mr-2" /> Alterar Senha</>
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
