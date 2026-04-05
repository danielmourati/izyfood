import {
  ShoppingCart, Grid3X3, ClipboardList, Users, Package, BarChart3, LogOut, Truck, UtensilsCrossed, Settings, DollarSign, Shield
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
  const { user, logout, isAdmin } = useAuth();
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

  const initials = user?.name
    ? user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : '?';

  return (
    <Sidebar collapsible="icon" className="border-r-0">
      <SidebarContent className="bg-sidebar flex flex-col">
        {/* Tenant Logo / Brand */}
        <div className="p-4 flex items-center gap-3">
          {tenantLogo ? (
            <img
              src={tenantLogo}
              alt={tenantName}
              className="h-10 w-10 rounded-lg object-contain bg-white/10 shrink-0"
            />
          ) : (
            <div className="h-10 w-10 rounded-lg bg-sidebar-primary/20 flex items-center justify-center text-sidebar-primary font-bold text-sm shrink-0">
              {tenantName?.charAt(0)?.toUpperCase() || '?'}
            </div>
          )}
          {!collapsed && (
            <div className="min-w-0">
              <p className="font-bold text-sidebar-foreground text-sm leading-tight truncate">
                {tenantName || 'Minha Loja'}
              </p>
              <p className="text-[10px] text-sidebar-foreground/40 truncate">Sistema PDV</p>
            </div>
          )}
        </div>

        <Separator className="bg-sidebar-border mx-3 w-auto" />

        {/* User info */}
        <div className="px-4 py-3 flex items-center gap-3">
          <div className="h-8 w-8 rounded-full bg-sidebar-accent flex items-center justify-center text-sidebar-foreground font-semibold text-xs shrink-0 ring-1 ring-sidebar-primary/20">
            {initials}
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <p className="font-medium text-sidebar-foreground text-xs leading-tight truncate">{user?.name}</p>
              <p className="text-[10px] text-sidebar-foreground/40 truncate">{user?.email}</p>
            </div>
          )}
        </div>

        <Separator className="bg-sidebar-border mx-3 w-auto" />

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
                      className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors"
                      activeClassName="bg-sidebar-primary text-sidebar-primary-foreground font-semibold shadow-sm"
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

      <SidebarFooter className="bg-sidebar border-t border-sidebar-border p-2 space-y-0.5">
        <ThemeToggle collapsed={collapsed} />

        <SidebarMenu>
          {user?.role === 'superadmin' && (
            <SidebarMenuItem>
              <SidebarMenuButton asChild>
                <NavLink
                  to={`/${slug}/admin`}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors"
                  activeClassName="bg-sidebar-primary text-sidebar-primary-foreground font-semibold shadow-sm"
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
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors"
                activeClassName="bg-sidebar-primary text-sidebar-primary-foreground font-semibold shadow-sm"
              >
                <Settings className="h-[18px] w-[18px] shrink-0" />
                {!collapsed && <span className="text-sm">Configurações</span>}
              </NavLink>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>

        <button
          className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent transition-colors w-full"
          onClick={logout}
        >
          <LogOut className="h-[18px] w-[18px] shrink-0" />
          {!collapsed && <span className="text-sm">Sair</span>}
        </button>
      </SidebarFooter>
    </Sidebar>
  );
}
