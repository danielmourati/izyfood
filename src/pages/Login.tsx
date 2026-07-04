import React, { useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { useAuth } from '@/contexts/AuthContext';
import { useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ArrowLeft, Eye, EyeOff, Zap, Truck, Wallet, Printer } from 'lucide-react';
import { toast } from 'sonner';
import degustLogoHorizontal from '@/assets/degust-logo-horizontal.png.asset.json';
import degustLogoLogin from '@/assets/degust-logo-login.png.asset.json';

const benefits = [
  { icon: Zap, title: 'Pedidos em segundos', desc: 'Do balcão à mesa, sem fricção.' },
  { icon: Truck, title: 'Delivery e retirada', desc: 'Controle total do fluxo até a entrega.' },
  { icon: Wallet, title: 'Caixa e comissões', desc: 'Fechamento automático, zero planilha.' },
  { icon: Printer, title: 'Impressão térmica', desc: 'Comanda no bluetooth, direto do celular.' },
];

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [forgotOpen, setForgotOpen] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const { slug } = useParams<{ slug: string }>();
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

  const pageTitle = 'Entrar — Degust | Sistema de Gestão para Restaurantes';
  const pageDescription = 'Acesse sua conta Degust para gerenciar pedidos, mesas, delivery, caixa e comissões do seu restaurante.';
  const canonicalPath = slug ? `/${slug}/login` : '/login';

  return (
    <>
    <Helmet>
      <title>{pageTitle}</title>
      <meta name="description" content={pageDescription} />
      <link rel="canonical" href={`https://degust.app${canonicalPath}`} />
      <meta property="og:title" content={pageTitle} />
      <meta property="og:description" content={pageDescription} />
      <meta property="og:url" content={`https://degust.app${canonicalPath}`} />
      <meta name="twitter:title" content={pageTitle} />
      <meta name="twitter:description" content={pageDescription} />
    </Helmet>
    <div className="min-h-screen flex flex-col lg:flex-row">
      {/* Left side - Persuasive brand panel */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-login-bg">
        {/* Decorative organic blobs */}
        <div className="absolute -top-24 -left-24 h-96 w-96 rounded-full bg-primary/25 blur-3xl" />
        <div className="absolute -bottom-32 -right-16 h-[28rem] w-[28rem] rounded-full bg-login-accent/20 blur-3xl" />
        <div className="absolute top-1/3 right-10 h-40 w-40 rounded-full bg-login-accent/10 blur-2xl" />

        {/* Subtle noise/pattern overlay */}
        <div
          className="absolute inset-0 opacity-[0.06] mix-blend-overlay"
          style={{
            backgroundImage:
              'radial-gradient(circle at 1px 1px, hsl(var(--login-accent)) 1px, transparent 0)',
            backgroundSize: '24px 24px',
          }}
        />

        <div className="relative z-10 flex flex-col justify-between h-full p-10 xl:p-14 text-primary-foreground">
          {/* Brand */}
          <div className="flex items-center gap-3">
            <img
              src={degustLogoLogin.url}
              alt="Degust - Sistema de Gestão para Restaurantes"
              className="h-12 object-contain"
            />
          </div>

          {/* Headline block */}
          <div className="space-y-6 max-w-lg">
            <h1 className="font-heading font-extrabold text-4xl xl:text-5xl leading-[1.05] tracking-tight text-secondary">
              Gestão fácil.
              <br />
              <span className="text-login-accent">Resultado rápido.</span>
            </h1>

            <p className="text-base xl:text-lg text-secondary/85 leading-relaxed">
              O sistema completo que transforma seu restaurante, lanchonete ou
              hamburgueria numa <span className="font-semibold text-secondary">máquina de vendas</span> —
              simples de usar, feito para a rotina real da cozinha.
            </p>

            {/* Benefits */}
            <ul className="grid gap-3 pt-2">
              {benefits.map(({ icon: Icon, title, desc }) => (
                <li key={title} className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-login-accent/20 text-login-accent ring-1 ring-login-accent/30">
                    <Icon className="h-4.5 w-4.5" strokeWidth={2.5} />
                  </div>
                  <div>
                    <p className="font-semibold text-secondary leading-tight">{title}</p>
                    <p className="text-sm text-secondary/70 leading-snug">{desc}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          {/* Footer badges */}
          <div className="flex flex-wrap items-center gap-2">
            {['Multi-loja', 'Multi-atendente', 'Impressão bluetooth', 'Offline-ready'].map((tag) => (
              <span
                key={tag}
                className="text-[11px] font-semibold uppercase tracking-wider text-secondary/80 border border-secondary/20 rounded-full px-2.5 py-1"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Right side - Login form */}
      <div className="flex-1 flex flex-col items-center justify-center bg-background p-6 lg:p-12">
        <div className="w-full max-w-sm space-y-8">
          <div className="text-center">
            <img
              src={degustLogoHorizontal.url}
              alt="Degust - Sistema de Gestão para Restaurantes"
              className="h-16 mx-auto mb-2 object-contain"
            />
          </div>

          <div className="space-y-2">
            <h2 className="text-2xl font-bold text-foreground">Login</h2>
            <p className="text-sm text-muted-foreground">Acesse sua conta para continuar</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" placeholder="seu@email.com" value={email}
                onChange={(e) => setEmail(e.target.value)} className="h-12" required />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Senha</Label>
                <button type="button" className="text-xs text-primary hover:underline underline-offset-4 transition-colors"
                  onClick={() => setForgotOpen(true)}>
                  Esqueceu a senha?
                </button>
              </div>
              <div className="relative">
                <Input id="password" type={showPassword ? "text" : "password"} placeholder="••••••••" value={password}
                  onChange={(e) => setPassword(e.target.value)} className="h-12 pr-10" required />
                <button
                  type="button"
                  aria-label={showPassword ? 'Esconder senha' : 'Mostrar senha'}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors rounded-full focus:outline-none focus:ring-1 focus:ring-primary h-7 w-7 flex items-center justify-center"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {error && <p className="text-sm text-destructive text-center">{error}</p>}

            <Button type="submit" className="w-full h-12 text-base font-semibold" disabled={isLoading}>
              {isLoading ? 'Entrando...' : 'Entrar'}
            </Button>
          </form>
        </div>

        <footer className="mt-auto pt-8 text-center text-xs text-muted-foreground space-y-1">
          <p className="font-semibold text-foreground/80">Powered by Degust</p>
          <p>© 2026 Desenvolvido por Daniel Moura</p>
        </footer>
      </div>

      {/* Forgot password dialog */}
      <Dialog open={forgotOpen} onOpenChange={setForgotOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Recuperar Senha</DialogTitle></DialogHeader>
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
    </>
  );
};

export default Login;
