import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useAttendantPermissions } from '@/hooks/use-attendant-permissions';
import { useTenantNavigate } from '@/hooks/use-tenant-navigate';
import { cn } from '@/lib/utils';
import {
  Utensils, Store, Bike, ShoppingBag, ClipboardList, Truck, DollarSign,
  Package, Boxes, Users, BarChart3, Settings,
} from 'lucide-react';

type SectionColor = 'vendas' | 'cadastros' | 'gestao';

type Shortcut = {
  key: string;
  label: string;
  icon: React.ElementType;
  to: string;
  show: boolean;
};

type Section = {
  title: string;
  color: SectionColor;
  items: Shortcut[];
};

const sectionStyles: Record<SectionColor, { dot: string; title: string; card: string; icon: string }> = {
  vendas: {
    dot: 'bg-section-vendas',
    title: 'text-section-vendas',
    card: 'border-section-vendas/30 bg-section-vendas-soft/40 hover:border-section-vendas hover:bg-section-vendas hover:text-white',
    icon: 'text-section-vendas group-hover:text-white',
  },
  cadastros: {
    dot: 'bg-section-cadastros',
    title: 'text-section-cadastros',
    card: 'border-section-cadastros/30 bg-section-cadastros-soft/40 hover:border-section-cadastros hover:bg-section-cadastros hover:text-white',
    icon: 'text-section-cadastros group-hover:text-white',
  },
  gestao: {
    dot: 'bg-section-gestao',
    title: 'text-section-gestao',
    card: 'border-section-gestao/30 bg-section-gestao-soft/40 hover:border-section-gestao hover:bg-section-gestao hover:text-white',
    icon: 'text-section-gestao group-hover:text-white',
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
  const { isAdmin } = useAuth();
  const { permissions } = useAttendantPermissions();

  const can = (key: 'manage_customers' | 'manage_products' | 'manage_stock') =>
    isAdmin || !!permissions[key];

  const sections: Section[] = [
    {
      title: 'Vendas',
      color: 'vendas',
      items: [
        { key: 'mesa', label: 'Mesa', icon: Utensils, to: '/mesas', show: true },
        { key: 'balcao', label: 'Balcão', icon: Store, to: '/pdv?tipo=balcao', show: true },
        { key: 'delivery', label: 'Delivery', icon: Bike, to: '/pdv?tipo=delivery', show: true },
        { key: 'retirada', label: 'Retirada', icon: ShoppingBag, to: '/pdv?tipo=retirada', show: true },
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

  return (
    <div className="h-full overflow-y-auto p-4 sm:p-6 pb-24 max-w-6xl mx-auto">
      <h1 className="text-2xl sm:text-3xl font-heading font-bold text-foreground mb-6">Início</h1>

      <div className="space-y-8">
        {sections.map(section => {
          const visible = section.items.filter(i => i.show);
          if (visible.length === 0) return null;
          const s = sectionStyles[section.color];
          return (
            <section key={section.title}>
              <h2 className={cn('flex items-center gap-2 text-sm font-semibold uppercase tracking-wider mb-3', s.title)}>
                <span className={cn('inline-block w-2 h-2 rounded-full', s.dot)} />
                {section.title}
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {visible.map(item => (
                  <ShortcutCard
                    key={item.key}
                    icon={item.icon}
                    label={item.label}
                    color={section.color}
                    onClick={() => navigate(item.to)}
                  />
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
};

export default Home;
