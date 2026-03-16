import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { toast } from '@/hooks/use-toast';

const Login = () => {
  const [pin, setPin] = useState('');
  const { login } = useAuth();

  const handleDigit = (d: string) => {
    if (pin.length < 4) setPin(prev => prev + d);
  };

  const handleClear = () => setPin('');

  const handleLogin = () => {
    if (login(pin)) {
      toast({ title: 'Bem-vindo!', description: 'Login realizado com sucesso.' });
    } else {
      toast({ title: 'PIN inválido', description: 'Tente novamente.', variant: 'destructive' });
      setPin('');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/10 via-background to-accent/10">
      <Card className="w-full max-w-sm shadow-2xl border-primary/20">
        <CardHeader className="text-center pb-2">
          <img src="/logo.png" alt="Carnaúba" className="h-24 mx-auto mb-2 object-contain" />
          <h1 className="text-2xl font-bold text-foreground">Carnaúba POS</h1>
          <p className="text-sm text-muted-foreground">Digite seu PIN para entrar</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex justify-center">
            <div className="flex gap-3">
              {[0, 1, 2, 3].map(i => (
                <div key={i} className={`w-4 h-4 rounded-full border-2 border-primary transition-all ${i < pin.length ? 'bg-primary scale-110' : 'bg-transparent'}`} />
              ))}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {['1','2','3','4','5','6','7','8','9'].map(d => (
              <Button key={d} variant="outline" className="h-14 text-xl font-semibold" onClick={() => handleDigit(d)}>
                {d}
              </Button>
            ))}
            <Button variant="ghost" className="h-14 text-sm" onClick={handleClear}>Limpar</Button>
            <Button variant="outline" className="h-14 text-xl font-semibold" onClick={() => handleDigit('0')}>0</Button>
            <Button className="h-14 text-lg font-semibold" onClick={handleLogin} disabled={pin.length < 4}>OK</Button>
          </div>

          <div className="text-xs text-center text-muted-foreground space-y-1 pt-2">
            <p>Proprietário: PIN <strong>1234</strong></p>
            <p>Atendente: PIN <strong>0000</strong></p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Login;
