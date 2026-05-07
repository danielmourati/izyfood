import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useAttendantPermissions } from '@/hooks/use-attendant-permissions';
import { useTenantNavigate } from '@/hooks/use-tenant-navigate';
import {
  Utensils, Store, Bike, ShoppingBag, ClipboardList, Truck, DollarSign,
  Package, Boxes, Users, BarChart3, Settings,
} from 'lucide-react';

type Shortcut = {
  key: string;
  label: string;
  icon: React.ElementType;
  to: string;
  show: boolean;
};

type Section = {
  title: string;
  items: Shortcut[];
};

const ShortcutCard: React.FC<{ icon: React.ElementType; label: string; onClick: () => void }> = ({ icon: Icon, label, onClick }) => (
  <button
    onClick={onClick}
    className="group flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-border bg-card hover:border-primary hover:bg-primary hover:text-primary-foreground active:scale-95 transition-all py-6 sm:py-7 shadow-sm hover:shadow-md min-h-[104px]"
  >
    <Icon className="h-7 w-7 sm:h-8 sm:w-8" strokeWidth={2.25} />
    <span className="font-heading font-bold text-sm sm:text-base text-center px-1">{label}</span>
  </button>
);

const Home: React.FC = () => {
  const navigate = useTenantNavigate();
  const { isAdmin } = useAuth();
  const { permissions } = useAttendantPermissions();

  const can = (key: 'manage_customers' | 'manage_products' | 'manage_stock') =>
    isAdmin || !!permissions[key];

  const sections: Section[] = [
    {
      title: 'Vendas',
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
      items: [
        { key: 'produtos', label: 'Produtos', icon: Package, to: '/produtos', show: can('manage_products') },
        { key: 'estoque', label: 'Estoque', icon: Boxes, to: '/estoque', show: can('manage_stock') },
        { key: 'clientes', label: 'Clientes', icon: Users, to: '/clientes', show: can('manage_customers') },
      ],
    },
    {
      title: 'Gestão',
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
          return (
            <section key={section.title}>
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                {section.title}
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {visible.map(item => (
                  <ShortcutCard
                    key={item.key}
                    icon={item.icon}
                    label={item.label}
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
