import React from 'react';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/AppSidebar';

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <div className="h-[100dvh] flex w-full overflow-hidden">
        <AppSidebar />
        <div className="flex-1 flex flex-col h-full overflow-hidden">
          {/* Mobile Header with trigger */}
          <header className="md:hidden flex items-center h-14 border-b bg-card px-4 shrink-0">
            <SidebarTrigger />
            <span className="font-bold ml-3 text-sm">Menu</span>
          </header>
          <main className="flex-1 overflow-hidden relative">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
