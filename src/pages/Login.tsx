import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { toast } from '@/hooks/use-toast';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { login } = useAuth();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (login(email, password)) {
      toast({ title: 'Bem-vindo!', description: 'Login realizado com sucesso.' });
    } else {
      toast({ title: 'Credenciais inválidas', description: 'Verifique email e senha.', variant: 'destructive' });
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/10 via-background to-accent/10">
      <Card className="w-full max-w-sm shadow-2xl border-primary/20">
        <CardHeader className="text-center pb-2">
          <img src="/logo.png" alt="Carnaúba" className="h-24 mx-auto mb-2 object-contain" />
          <h1 className="text-2xl font-bold text-foreground">Carnaúba POS</h1>
          <p className="text-sm text-muted-foreground">Faça login para continuar</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" placeholder="seu@email.com" value={email} onChange={e => setEmail(e.target.value)} className="h-12" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <Input id="password" type="password" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} className="h-12" required />
            </div>
            <Button type="submit" className="w-full h-12 text-base font-semibold">Entrar</Button>
          </form>

          <div className="text-xs text-center text-muted-foreground space-y-1 pt-4 border-t mt-4">
            <p>Proprietário: <strong>admin@carnauba.com</strong> / <strong>1234</strong></p>
            <p>Atendente: <strong>atendente@carnauba.com</strong> / <strong>0000</strong></p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Login;
