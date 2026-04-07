import {
  ShoppingCart, Grid3X3, ClipboardList, Users, Package, BarChart3, Truck, UtensilsCrossed, Settings, DollarSign, Shield
} from 'lucide-react';
import { NavLink } from '@/components/NavLink';
import { useAuth } from '@/contexts/AuthContext';
import { useAttendantPermissions } from '@/hooks/use-attendant-permissions';
import { ThemeToggle } from '@/components/ThemeToggle';
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarMenu,
  SidebarMenuButton, SidebarMenuItem, SidebarFooter, useSidebar,
} from '@/components/ui/sidebar';
import { Separator } from '@/components/ui/separator';
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

type PermissionKey = 'manage_customers' | 'manage_products' | 'manage_stock';

interface NavItem {
  title: string;
  path: string;
  icon: React.ElementType;
  adminOnly: boolean;
  permissionKey?: PermissionKey;
}

const navItems: NavItem[] = [
  { title: 'Mesas', path: '', icon: Grid3X3, adminOnly: false },
  { title: 'PDV', path: '/pdv', icon: ShoppingCart, adminOnly: false },
  { title: 'Pedidos', path: '/pedidos', icon: ClipboardList, adminOnly: false },
  { title: 'Delivery', path: '/entregas', icon: Truck, adminOnly: false },
  { title: 'Caixa', path: '/caixa', icon: DollarSign, adminOnly: false },
  { title: 'Clientes', path: '/clientes', icon: Users, adminOnly: true, permissionKey: 'manage_customers' },
  { title: 'Produtos', path: '/produtos', icon: UtensilsCrossed, adminOnly: true, permissionKey: 'manage_products' },
  { title: 'Estoque', path: '/estoque', icon: Package, adminOnly: true, permissionKey: 'manage_stock' },
  { title: 'Relatórios', path: '/relatorios', icon: BarChart3, adminOnly: true },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === 'collapsed';
  const { user, isAdmin } = useAuth();
  const { permissions } = useAttendantPermissions();
  const [tenantLogo, setTenantLogo] = useState<string | null>(null);
  const [tenantName, setTenantName] = useState<string>('');

  const slug = user?.tenantSlug || '';

  useEffect(() => {
    if (!user?.tenantId) return;
    supabase.from('tenants').select('logo, name').eq('id', user.tenantId).single().then(({ data }) => {
      if (data) {
        setTenantLogo(data.logo);
        setTenantName(data.name);
      }
    });
  }, [user?.tenantId]);

  const items = navItems.filter(item => {
    if (isAdmin) return true;
    if (!item.adminOnly) return true;
    if (item.permissionKey) return permissions[item.permissionKey];
    return false;
  });

  return (
    <Sidebar collapsible="icon" className="border-r border-border">
      <SidebarContent className="bg-card flex flex-col">
        {/* Tenant Logo / Brand */}
        <div className="p-4 flex items-center gap-3">
          {tenantLogo ? (
            <img
              src={tenantLogo}
              alt={tenantName}
              className="h-10 w-10 rounded-lg object-contain bg-muted shrink-0"
            />
          ) : (
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-bold text-sm shrink-0">
              {tenantName?.charAt(0)?.toUpperCase() || '?'}
            </div>
          )}
          {!collapsed && (
            <div className="min-w-0">
              <p className="font-bold text-foreground text-sm leading-tight truncate">
                {tenantName || 'Minha Loja'}
              </p>
              <p className="text-[10px] text-muted-foreground truncate">Sistema PDV</p>
            </div>
          )}
        </div>

        <Separator className="mx-3 w-auto" />

        {/* Navigation */}
        <SidebarGroup className="flex-1 py-2">
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map(item => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={`/${slug}${item.path}`}
                      end={item.path === ''}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                      activeClassName="bg-primary text-primary-foreground font-semibold shadow-sm"
                    >
                      <item.icon className="h-[18px] w-[18px] shrink-0" />
                      {!collapsed && <span className="text-sm">{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="bg-card border-t border-border p-2 space-y-0.5">
        <ThemeToggle collapsed={collapsed} />

        <SidebarMenu>
          {user?.role === 'superadmin' && (
            <SidebarMenuItem>
              <SidebarMenuButton asChild>
                <NavLink
                  to={`/${slug}/admin`}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                  activeClassName="bg-primary text-primary-foreground font-semibold shadow-sm"
                >
                  <Shield className="h-[18px] w-[18px] shrink-0" />
                  {!collapsed && <span className="text-sm">Super Admin</span>}
                </NavLink>
              </SidebarMenuButton>
            </SidebarMenuItem>
          )}
          <SidebarMenuItem>
            <SidebarMenuButton asChild>
              <NavLink
                to={`/${slug}/configuracoes`}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                activeClassName="bg-primary text-primary-foreground font-semibold shadow-sm"
              >
                <Settings className="h-[18px] w-[18px] shrink-0" />
                {!collapsed && <span className="text-sm">Configurações</span>}
              </NavLink>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
