import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

import { ArrowLeft } from 'lucide-react';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [forgotOpen, setForgotOpen] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const { login, users, setUsers } = useAuth();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (login(email, password)) {
      // login success
    }
  };

  const handleResetPassword = (e: React.FormEvent) => {
    e.preventDefault();
    const user = users.find(u => u.email === resetEmail);
    if (!user) {
      return;
      return;
    }
    if (newPassword.length < 4) {
      return;
      return;
    }
    if (newPassword !== confirmPassword) {
      return;
      return;
    }
    setUsers(prev => prev.map(u => u.email === resetEmail ? { ...u, pin: newPassword } : u));
    toast({ title: 'Senha redefinida!', description: 'Faça login com a nova senha.' });
    setForgotOpen(false);
    setResetEmail('');
    setNewPassword('');
    setConfirmPassword('');
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-login-bg">
      <div className="flex-1 flex items-center justify-center w-full">
      <Card className="w-full max-w-sm shadow-2xl border-primary/20">
        <CardHeader className="text-center pb-2">
          <img src="/logo.png" alt="Carnaúba" className="h-24 mx-auto mb-2 object-contain" />
          <h1 className="text-2xl font-bold text-foreground">Carnaúba</h1>
          <p className="text-sm text-muted-foreground">Faça login para continuar</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" placeholder="seu@email.com" value={email} onChange={(e) => setEmail(e.target.value)} className="h-12" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <Input id="password" type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} className="h-12" required />
            </div>
            <Button type="submit" className="w-full h-12 text-base font-semibold">Entrar</Button>
          </form>

          <button
            type="button"
            className="w-full text-center text-sm text-muted-foreground hover:text-primary underline-offset-4 hover:underline mt-3 transition-colors"
            onClick={() => setForgotOpen(true)}
          >
            Esqueceu sua senha?
          </button>

          <div className="text-xs text-center text-muted-foreground space-y-1 pt-4 border-t mt-4">
            <p>Proprietário: <strong>admin@carnauba.com</strong> / <strong>1234</strong></p>
            <p>Atendente: <strong>atendente@carnauba.com</strong> / <strong>0000</strong></p>
          </div>
        </CardContent>
      </Card>

      <Dialog open={forgotOpen} onOpenChange={setForgotOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Recuperar Senha</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleResetPassword} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="reset-email">Email cadastrado</Label>
              <Input id="reset-email" type="email" placeholder="seu@email.com" value={resetEmail} onChange={(e) => setResetEmail(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-password">Nova senha</Label>
              <Input id="new-password" type="password" placeholder="••••••••" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirmar nova senha</Label>
              <Input id="confirm-password" type="password" placeholder="••••••••" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required />
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" className="flex-1" onClick={() => setForgotOpen(false)}>
                <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
              </Button>
              <Button type="submit" className="flex-1">Redefinir Senha</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
      </div>
      <footer className="py-4 text-center text-xs text-primary-foreground/60">
        <p>© 2026 Carnaúba. Desenvolvido por Daniel Moura</p>
      </footer>
    </div>
  );
};

export default Login;
