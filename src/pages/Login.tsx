import React, { useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { useParams } from 'react-router-dom';
import { Eye, EyeOff, AlertCircle, WifiOff } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { formatAuthError } from '@/lib/auth-errors';
import degustLogoHorizontal from '@/assets/degust-logo-horizontal-v2.png.asset.json';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { slug } = useParams<{ slug: string }>();
  const { login } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return;
    setError('');
    setIsLoading(true);
    try {
      const result = await login(email, password, slug);
      if (!result.success) {
        setError(result.error || 'Credenciais inválidas. Verifique seu e-mail e senha.');
        setIsLoading(false);
      }
    } catch (err: unknown) {
      setError(formatAuthError(err));
      setIsLoading(false);
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

      <main className="login-canvas min-h-[100dvh] flex items-center justify-center px-4 py-8 sm:px-6">
        <section className="login-panel w-full max-w-[430px] border border-card/80 bg-card/80 px-6 py-8 shadow-elegant backdrop-blur-xl sm:px-10 sm:py-10">
          <div className="mb-8 flex flex-col items-center text-center">
            <img
              src={degustLogoHorizontal.url}
              onError={(event) => { event.currentTarget.src = `https://degust.app/${degustLogoHorizontal.url.replace(/^\.\//, '')}`; }}
              alt="Degust"
              className="mb-7 h-auto w-[125px] max-w-full object-contain"
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

    </>
  );
};

export default Login;