import React from 'react';
import { useLocation } from 'react-router-dom';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/AppSidebar';
import { BackButton } from '@/components/BackButton';
import { TrialBanner } from '@/components/TrialBanner';
import { HeaderClock } from '@/components/HeaderClock';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useAuth } from '@/contexts/AuthContext';

export function Layout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const { user } = useAuth();
  const slug = user?.tenantSlug || '';
  const stripped = location.pathname.replace(new RegExp(`^/${slug}`), '') || '/';
  const isHome = stripped === '/' || stripped === '';
  const isPDV = stripped.startsWith('/pdv');
  const showDesktopBar = !isHome && !isPDV;

  return (
    <SidebarProvider defaultOpen={false}>
      <div className="h-[100dvh] flex w-full overflow-hidden">
        <AppSidebar />
        <div className="flex-1 flex flex-col h-full overflow-hidden">
          <TrialBanner />
          {/* Mobile Header */}
          <header className="md:hidden flex items-center gap-2 h-16 border-b bg-card px-4 shrink-0">
            <Tooltip>
              <TooltipTrigger asChild><SidebarTrigger /></TooltipTrigger>
              <TooltipContent>Abrir/fechar menu</TooltipContent>
            </Tooltip>
            <BackButton className="ml-1" />
            <HeaderClock className="ml-auto" />
          </header>
          {/* Desktop slim back bar (hidden on home & pdv to preserve their fullscreen layout) */}
          {showDesktopBar && (
            <div className="hidden md:flex items-center h-10 border-b bg-card px-4 shrink-0 gap-3">
              <Tooltip>
                <TooltipTrigger asChild><SidebarTrigger /></TooltipTrigger>
                <TooltipContent>Abrir/fechar menu</TooltipContent>
              </Tooltip>
              <BackButton />
              <HeaderClock className="ml-auto" />
            </div>
          )}
          <main className="flex-1 overflow-hidden relative">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}


