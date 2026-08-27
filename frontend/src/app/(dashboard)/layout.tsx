'use client';

import { ReactNode, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore, type AuthState } from '@/lib/auth';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/app-sidebar';

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const isAuthenticated = useAuthStore((state: AuthState) => state.isAuthenticated);

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/signin');
    }
  }, [isAuthenticated, router]);

  if (!isAuthenticated) {
    return null;
  }

  return (
    <SidebarProvider className="min-h-svh">
      <AppSidebar />
      <SidebarInset className="min-w-0 overflow-y-auto bg-gray-50 dark:bg-gray-900">
        {children}
      </SidebarInset>
    </SidebarProvider>
  );
}
