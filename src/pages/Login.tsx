import React, { useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { useParams } from 'react-router-dom';
import { ArrowLeft, Eye, EyeOff, AlertCircle, CheckCircle2, WifiOff } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { formatAuthError } from '@/lib/auth-errors';
import degustLogoHorizontal from '@/assets/degust-logo-horizontal-v2.png.asset.json';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [forgotOpen, setForgotOpen] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetFeedback, setResetFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const { slug } = useParams<{ slug: string }>();
  const { login } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return;
    setError('');
    setIsLoading(true);
    try {
      const result = await login(email, password);
      if (!result.success) {
        setError(result.error || 'Credenciais inválidas. Verifique seu e-mail e senha.');
        setIsLoading(false);
      }
    } catch (err: unknown) {
      setError(formatAuthError(err));
      setIsLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetEmail.trim()) return;
    setResetFeedback(null);
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(resetEmail, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (resetError) {
      setResetFeedback({ type: 'error', text: formatAuthError(resetError) });
      return;
    }
    setResetFeedback({ type: 'success', text: 'E-mail de recuperação enviado.' });
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

      <main className="login-canvas min-h-[100dvh] flex items-center justify-center px-4 py-8 sm:px-6">
        <section className="login-panel w-full max-w-[430px] border border-card/80 bg-card/80 px-6 py-8 shadow-elegant backdrop-blur-xl sm:px-10 sm:py-10">
          <div className="mb-8 flex flex-col items-center text-center">
            <img
              src={degustLogoHorizontal.url}
              onError={(event) => { event.currentTarget.src = `https://degust.app/${degustLogoHorizontal.url.replace(/^\.\//, '')}`; }}
              alt="Degust"
              className="mb-7 h-auto w-[250px] max-w-full object-contain"
            />
            <h1 className="text-3xl font-bold text-foreground">Bem-vindo</h1>
            <p className="mt-2 text-sm text-muted-foreground">Acesse sua conta para continuar</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email" className="ml-1 font-semibold">E-mail</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="seu@email.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="h-12 rounded-xl bg-background/70 px-4"
                required
              />
            </div>

            <div className="space-y-2">
              <div className="ml-1 flex items-center justify-between gap-3">
                <Label htmlFor="password" className="font-semibold">Senha</Label>
                <Button type="button" variant="link" className="h-auto p-0 text-xs" onClick={() => { setForgotOpen(true); setResetFeedback(null); }}>
                  Esqueceu a senha?
                </Button>
              </div>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="h-12 rounded-xl bg-background/70 px-4 pr-12"
                  required
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={showPassword ? 'Esconder senha' : 'Mostrar senha'}
                  className="absolute right-1.5 top-1/2 h-9 w-9 -translate-y-1/2 text-muted-foreground"
                  onClick={() => setShowPassword(current => !current)}
                >
                  {showPassword ? <EyeOff /> : <Eye />}
                </Button>
              </div>
            </div>

            {error && (
              <div role="alert" className="flex items-start gap-2.5 rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
                {error.includes('conexão') || error.includes('internet') || error.includes('servidor') ? <WifiOff className="mt-0.5 h-4 w-4 shrink-0" /> : <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />}
                <p className="leading-snug">{error}</p>
              </div>
            )}

            <Button type="submit" size="lg" className="h-12 w-full rounded-xl text-base font-bold shadow-warm" disabled={isLoading}>
              {isLoading ? 'Entrando...' : 'Entrar'}
            </Button>
          </form>

          <footer className="mt-9 border-t border-border/70 pt-5 text-center text-xs text-muted-foreground">
            <p className="font-semibold text-foreground/80">Powered by Degust</p>
            <p className="mt-1">© 2026 Desenvolvido por Daniel Moura</p>
          </footer>
        </section>
      </main>

      <Dialog open={forgotOpen} onOpenChange={setForgotOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Recuperar senha</DialogTitle></DialogHeader>
          <form onSubmit={handleResetPassword} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="reset-email">E-mail cadastrado</Label>
              <Input id="reset-email" type="email" placeholder="seu@email.com" value={resetEmail} onChange={(event) => setResetEmail(event.target.value)} required />
            </div>
            {resetFeedback && (
              <div className={`flex items-start gap-2 rounded-lg border p-3 text-sm ${resetFeedback.type === 'success' ? 'border-success/25 bg-success/10 text-success' : 'border-destructive/20 bg-destructive/10 text-destructive'}`}>
                {resetFeedback.type === 'success' ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> : <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />}
                <span>{resetFeedback.text}</span>
              </div>
            )}
            <div className="flex gap-2">
              <Button type="button" variant="outline" className="flex-1" onClick={() => setForgotOpen(false)}><ArrowLeft /> Voltar</Button>
              <Button type="submit" className="flex-1">Enviar e-mail</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default Login;