import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [forgotOpen, setForgotOpen] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const { login } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    const result = await login(email, password);
    if (!result.success) {
      setError(result.error || 'Credenciais inválidas');
    }
    setIsLoading(false);
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetEmail.trim()) return;
    const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) {
      toast.error(error.message);
    } else {
      toast.success('Email de recuperação enviado!');
      setForgotOpen(false);
      setResetEmail('');
    }
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
            {error && <p className="text-sm text-destructive text-center">{error}</p>}
            <Button type="submit" className="w-full h-12 text-base font-semibold" disabled={isLoading}>
              {isLoading ? 'Entrando...' : 'Entrar'}
            </Button>
          </form>

          <button
            type="button"
            className="w-full text-center text-sm text-muted-foreground hover:text-primary underline-offset-4 hover:underline mt-3 transition-colors"
            onClick={() => setForgotOpen(true)}
          >
            Esqueceu sua senha?
          </button>
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
            <div className="flex gap-2">
              <Button type="button" variant="outline" className="flex-1" onClick={() => setForgotOpen(false)}>
                <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
              </Button>
              <Button type="submit" className="flex-1">Enviar Email</Button>
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
