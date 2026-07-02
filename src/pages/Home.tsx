import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useAttendantPermissions } from '@/hooks/use-attendant-permissions';
import { useTenantNavigate } from '@/hooks/use-tenant-navigate';
import { supabase } from '@/integrations/supabase/client';
import { cn, fmt } from '@/lib/utils';
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from '@/components/ui/accordion';
import {
  Utensils, Store, Bike, ShoppingBag, ClipboardList, Truck, DollarSign,
  Package, Boxes, Users, BarChart3, Settings, Lock, Unlock, ChevronRight,
} from 'lucide-react';

type SectionColor = 'vendas' | 'cadastros' | 'gestao';

type Shortcut = {
  key: string;
  label: string;
  icon: React.ElementType;
  to: string;
  show: boolean;
};

const sectionStyles: Record<SectionColor, { dot: string; title: string; card: string; icon: string }> = {
  vendas: {
    dot: 'bg-section-vendas',
    title: 'text-section-vendas',
    card: 'border-section-vendas/30 bg-section-vendas-soft/40 hover:border-section-vendas hover:bg-section-vendas hover:text-primary-foreground',
    icon: 'text-section-vendas group-hover:text-primary-foreground',
  },
  cadastros: {
    dot: 'bg-section-cadastros',
    title: 'text-section-cadastros',
    card: 'border-section-cadastros/30 bg-section-cadastros-soft/40 hover:border-section-cadastros hover:bg-section-cadastros hover:text-primary-foreground',
    icon: 'text-section-cadastros group-hover:text-primary-foreground',
  },
  gestao: {
    dot: 'bg-section-gestao',
    title: 'text-section-gestao',
    card: 'border-section-gestao/30 bg-section-gestao-soft/40 hover:border-section-gestao hover:bg-section-gestao hover:text-primary-foreground',
    icon: 'text-section-gestao group-hover:text-primary-foreground',
  },
};

const ShortcutCard: React.FC<{ icon: React.ElementType; label: string; color: SectionColor; onClick: () => void }> = ({ icon: Icon, label, color, onClick }) => {
  const s = sectionStyles[color];
  return (
    <button
      onClick={onClick}
      className={cn(
        'group flex flex-col items-center justify-center gap-2 rounded-2xl border-2 active:scale-95 transition-all py-6 sm:py-7 shadow-sm hover:shadow-md min-h-[104px]',
        s.card,
      )}
    >
      <Icon className={cn('h-7 w-7 sm:h-8 sm:w-8 transition-colors', s.icon)} strokeWidth={2.25} />
      <span className="font-heading font-bold text-sm sm:text-base text-center px-1">{label}</span>
    </button>
  );
};

const Home: React.FC = () => {
  const navigate = useTenantNavigate();
  const { user, isAdmin } = useAuth();
  const { permissions } = useAttendantPermissions();

  const can = (key: 'manage_customers' | 'manage_products' | 'manage_stock') =>
    isAdmin || !!permissions[key];

  // Cash register status
  const [cashStatus, setCashStatus] = useState<{ open: boolean; openedAt?: string; loading: boolean }>({
    open: false, loading: true,
  });

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data } = await supabase
        .from('cash_registers')
        .select('opened_at, closed_at')
        .is('closed_at', null)
        .order('opened_at', { ascending: false })
        .limit(1);
      if (!mounted) return;
      if (data && data.length > 0) {
        setCashStatus({ open: true, openedAt: data[0].opened_at, loading: false });
      } else {
        setCashStatus({ open: false, loading: false });
      }
    })();
    return () => { mounted = false; };
  }, []);

  const firstName = (user?.name || '').trim().split(/\s+/)[0] || 'usuário';

  // Vendas (always visible on top)
  const vendas: Shortcut[] = [
    { key: 'mesa', label: 'Mesa', icon: Utensils, to: '/mesas', show: true },
    { key: 'balcao', label: 'Balcão', icon: Store, to: '/pdv?tipo=balcao', show: true },
    { key: 'delivery', label: 'Delivery', icon: Bike, to: '/pdv?tipo=delivery', show: true },
    { key: 'retirada', label: 'Retirada', icon: ShoppingBag, to: '/pdv?tipo=retirada', show: true },
  ];

  // Outros atalhos (escondidos em sanfona)
  const moreSections: { title: string; color: SectionColor; items: Shortcut[] }[] = [
    {
      title: 'Operação',
      color: 'vendas',
      items: [
        { key: 'pedidos', label: 'Pedidos', icon: ClipboardList, to: '/pedidos', show: true },
        { key: 'entregas', label: 'Entregas', icon: Truck, to: '/entregas', show: true },
        { key: 'caixa', label: 'Caixa', icon: DollarSign, to: '/caixa', show: true },
      ],
    },
    {
      title: 'Cadastros',
      color: 'cadastros',
      items: [
        { key: 'produtos', label: 'Produtos', icon: Package, to: '/produtos', show: can('manage_products') },
        { key: 'estoque', label: 'Estoque', icon: Boxes, to: '/estoque', show: can('manage_stock') },
        { key: 'clientes', label: 'Clientes', icon: Users, to: '/clientes', show: can('manage_customers') },
      ],
    },
    {
      title: 'Gestão',
      color: 'gestao',
      items: [
        { key: 'relatorios', label: 'Relatórios', icon: BarChart3, to: '/relatorios', show: isAdmin },
        { key: 'config', label: 'Configurações', icon: Settings, to: '/configuracoes', show: true },
      ],
    },
  ];

  const visibleMoreSections = moreSections
    .map(s => ({ ...s, items: s.items.filter(i => i.show) }))
    .filter(s => s.items.length > 0);

  const vendasStyle = sectionStyles.vendas;

  return (
    <div className="h-full overflow-y-auto p-4 sm:p-6 pb-24 max-w-6xl mx-auto">
      {/* Saudação */}
      <header className="mb-5">
        <h1 className="text-2xl sm:text-3xl font-heading font-bold text-foreground leading-tight">
          Seja bem-vindo(a) de volta, <span className="text-primary">{firstName}</span>!
        </h1>
        <p className="text-sm text-muted-foreground mt-1">O que você quer fazer agora?</p>
      </header>

      {/* Status do Caixa */}
      <div
        className={cn(
          'mb-6 rounded-xl border p-3 sm:p-4 flex items-center gap-3',
          cashStatus.loading
            ? 'bg-muted/40 border-border'
            : cashStatus.open
              ? 'bg-section-vendas-soft/50 border-section-vendas/30'
              : 'bg-section-gestao-soft/50 border-section-gestao/40',
        )}
      >
        <div
          className={cn(
            'h-9 w-9 sm:h-10 sm:w-10 rounded-full flex items-center justify-center shrink-0',
            cashStatus.loading
              ? 'bg-muted text-muted-foreground'
              : cashStatus.open
                ? 'bg-section-vendas/15 text-section-vendas'
                : 'bg-section-gestao/15 text-section-gestao',
          )}
        >
          {cashStatus.open ? <Unlock className="h-5 w-5" /> : <Lock className="h-5 w-5" />}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Caixa</p>
          {cashStatus.loading ? (
            <p className="text-sm text-muted-foreground">Verificando…</p>
          ) : cashStatus.open ? (
            <p className="text-sm font-semibold text-foreground">
              Aberto{cashStatus.openedAt && ` desde ${new Date(cashStatus.openedAt).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}`}
            </p>
          ) : (
            <p className="text-sm font-semibold text-foreground">Fechado</p>
          )}
        </div>
        {!cashStatus.loading && !cashStatus.open && (
          <button
            onClick={() => navigate('/caixa')}
            className="shrink-0 inline-flex items-center gap-1 rounded-lg bg-section-gestao text-primary-foreground text-xs sm:text-sm font-bold px-3 py-2 shadow-sm hover:brightness-110 active:scale-95 transition-all"
          >
            <Unlock className="h-4 w-4" /> Abrir caixa
          </button>
        )}
        {!cashStatus.loading && cashStatus.open && (
          <button
            onClick={() => navigate('/caixa')}
            className="shrink-0 inline-flex items-center gap-1 text-section-vendas text-xs sm:text-sm font-semibold px-2 py-1 hover:underline"
          >
            Ver <ChevronRight className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Vendas */}
      <section className="mb-4">
        <h2 className={cn('flex items-center gap-2 text-sm font-semibold uppercase tracking-wider mb-3', vendasStyle.title)}>
          <span className={cn('inline-block w-2 h-2 rounded-full', vendasStyle.dot)} />
          Vendas
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {vendas.map(item => (
            <ShortcutCard
              key={item.key}
              icon={item.icon}
              label={item.label}
              color="vendas"
              onClick={() => navigate(item.to)}
            />
          ))}
        </div>
      </section>

      {/* Mais atalhos (sanfona) */}
      {visibleMoreSections.length > 0 && (
        <Accordion type="single" collapsible className="mt-4 border rounded-xl bg-card">
          <AccordionItem value="more" className="border-b-0">
            <AccordionTrigger className="px-4 py-3 text-sm font-semibold hover:no-underline">
              Mais atalhos
            </AccordionTrigger>
            <AccordionContent className="px-4 pb-4">
              <div className="space-y-6">
                {visibleMoreSections.map(section => {
                  const s = sectionStyles[section.color];
                  return (
                    <div key={section.title}>
                      <h3 className={cn('flex items-center gap-2 text-xs font-semibold uppercase tracking-wider mb-2', s.title)}>
                        <span className={cn('inline-block w-1.5 h-1.5 rounded-full', s.dot)} />
                        {section.title}
                      </h3>
                      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                        {section.items.map(item => (
                          <ShortcutCard
                            key={item.key}
                            icon={item.icon}
                            label={item.label}
                            color={section.color}
                            onClick={() => navigate(item.to)}
                          />
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      )}
    </div>
  );
};

export default Home;
