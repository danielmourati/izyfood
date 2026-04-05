import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ArrowLeft, ChevronLeft, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import { useParams } from 'react-router-dom';

const carouselImages = [
  '/carousel-1.jpg',
  '/carousel-2.jpg',
  '/carousel-3.jpg',
  '/carousel-4.jpg',
  '/carousel-5.jpg',
];

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [forgotOpen, setForgotOpen] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [currentSlide, setCurrentSlide] = useState(0);
  const [tenantLogo, setTenantLogo] = useState<string | null>(null);
  const [tenantName, setTenantName] = useState<string>('');
  const { login } = useAuth();

  // Try to get tenant slug from URL for dynamic logo
  useEffect(() => {
    const slug = window.location.pathname.split('/').filter(Boolean)[0];
    if (slug) {
      supabase.from('tenants').select('logo, name').eq('slug', slug).single().then(({ data }) => {
        if (data) {
          setTenantLogo(data.logo);
          setTenantName(data.name);
        }
      });
    }
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % carouselImages.length);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

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
    <div className="min-h-screen flex flex-col lg:flex-row">
      {/* Left side - Carousel */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-[hsl(var(--login-bg))]">
        {carouselImages.map((img, i) => (
          <div
            key={i}
            className="absolute inset-0 transition-opacity duration-1000 ease-in-out"
            style={{ opacity: currentSlide === i ? 1 : 0 }}
          >
            <img src={img} alt={`Slide ${i + 1}`} className="h-full w-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-[hsl(152,55%,14%,0.8)] via-transparent to-[hsl(152,55%,14%,0.3)]" />
          </div>
        ))}

        <div className="relative z-10 flex flex-col justify-between h-full p-8">
          <div />
          <div className="space-y-4">
            <h2 className="text-3xl font-bold text-white drop-shadow-lg">
              Gestão inteligente,<br />resultados reais.
            </h2>
            <p className="text-white/80 text-sm max-w-xs">
              Sistema completo de PDV para seu estabelecimento.
            </p>
            <div className="flex gap-2 pt-2">
              {carouselImages.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setCurrentSlide(i)}
                  className={`h-2 rounded-full transition-all duration-300 ${
                    currentSlide === i
                      ? 'w-8 bg-[hsl(var(--login-accent))]'
                      : 'w-2 bg-white/50 hover:bg-white/70'
                  }`}
                />
              ))}
            </div>
          </div>
        </div>

        <button
          onClick={() => setCurrentSlide((prev) => (prev - 1 + carouselImages.length) % carouselImages.length)}
          className="absolute left-4 top-1/2 -translate-y-1/2 z-10 p-2 rounded-full bg-white/20 hover:bg-white/30 text-white backdrop-blur-sm transition-colors"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <button
          onClick={() => setCurrentSlide((prev) => (prev + 1) % carouselImages.length)}
          className="absolute right-4 top-1/2 -translate-y-1/2 z-10 p-2 rounded-full bg-white/20 hover:bg-white/30 text-white backdrop-blur-sm transition-colors"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>

      {/* Right side - Login form */}
      <div className="flex-1 flex flex-col items-center justify-center bg-background p-6 lg:p-12">
        <div className="w-full max-w-sm space-y-8">
          <div className="text-center">
            {tenantLogo ? (
              <img src={tenantLogo} alt={tenantName} className="h-20 mx-auto mb-2 object-contain" />
            ) : (
              <div className="h-20 w-20 mx-auto mb-2 rounded-2xl bg-primary/10 flex items-center justify-center">
                <span className="text-3xl font-bold text-primary">{tenantName?.charAt(0)?.toUpperCase() || '🏪'}</span>
              </div>
            )}
            {tenantName && <p className="text-sm font-medium text-muted-foreground">{tenantName}</p>}
          </div>

          <div className="space-y-2">
            <h1 className="text-2xl font-bold text-foreground">Login</h1>
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
              <Input id="password" type="password" placeholder="••••••••" value={password}
                onChange={(e) => setPassword(e.target.value)} className="h-12" required />
            </div>

            {error && <p className="text-sm text-destructive text-center">{error}</p>}

            <Button type="submit" className="w-full h-12 text-base font-semibold" disabled={isLoading}>
              {isLoading ? 'Entrando...' : 'Entrar'}
            </Button>
          </form>
        </div>

        <footer className="mt-auto pt-8 text-center text-xs text-muted-foreground">
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
  );
};

export default Login;
