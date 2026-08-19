'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { 
  Home, 
  FileText, 
  Settings, 
  LogOut, 
  User,
  CreditCard,
  Plus,
  BarChart3,
  Users,
  Brain,
  FolderOpen,
  Bell,
  Plug,
  Monitor,
  DollarSign,
  Workflow,
  TrendingUp,
  FileCode,
} from 'lucide-react';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAuthStore } from '@/lib/auth';

const menuItems = [
  {
    title: 'Dashboard',
    icon: Home,
    href: '/dashboard',
  },
  {
    title: 'Proposals',
    icon: FileText,
    href: '/proposals',
  },
  {
    title: 'Documents',
    icon: FolderOpen,
    href: '/documents',
  },
  {
    title: 'AI Assistant',
    icon: Brain,
    href: '/ai-assistant',
  },
  {
    title: 'Snippets',
    icon: FileCode,
    href: '/snippets',
  },
  {
    title: 'Automation',
    icon: Workflow,
    href: '/automation',
  },
  {
    title: 'Analytics',
    icon: BarChart3,
    href: '/analytics',
  },
  {
    title: 'Forecasting',
    icon: TrendingUp,
    href: '/forecasting',
  },
  {
    title: 'Team',
    icon: Users,
    href: '/team',
  },
  {
    title: 'Integrations',
    icon: Plug,
    href: '/integrations',
  },
  {
    title: 'Payments',
    icon: DollarSign,
    href: '/payments',
  },
  {
    title: 'Monitoring',
    icon: Monitor,
    href: '/monitoring',
  },
  {
    title: 'Notifications',
    icon: Bell,
    href: '/notifications',
  },
  {
    title: 'Settings',
    icon: Settings,
    href: '/settings',
  },
];

export function AppSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, clearAuth } = useAuthStore();

  const handleLogout = () => {
    clearAuth();
    router.push('/signin');
  };

  const getInitials = (name?: string | null, email?: string | null) => {
    const source = name?.trim() || email?.trim();
    if (!source) return 'U';

    return source
      .split(' ')
      .filter(Boolean)
      .map((part) => part[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const displayName = user?.name?.trim() || user?.email || 'User';

  return (
    <Sidebar>
      <SidebarHeader className="border-b p-4">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-white font-bold">
            SQ
          </div>
          <span className="text-lg font-semibold">SyncQuote</span>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <Button className="w-full justify-center" size="sm" asChild>
              <Link href="/proposals/new">
                <Plus className="mr-2 h-4 w-4" />
                New Proposal
              </Link>
            </Button>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Menu</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton asChild isActive={pathname === item.href}>
                    <Link href={item.href}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t p-4">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-auto w-full justify-start gap-2 px-2 py-2">
              <Avatar className="h-8 w-8 shrink-0">
                <AvatarImage src={undefined} />
                <AvatarFallback>{getInitials(user?.name, user?.email)}</AvatarFallback>
              </Avatar>
              <div className="flex min-w-0 flex-1 flex-col items-start text-sm">
                <span className="w-full truncate text-left font-medium">{displayName}</span>
                <span className="w-full truncate text-left text-xs text-gray-500">{user?.email}</span>
              </div>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>My Account</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/settings/profile">
                <User className="mr-2 h-4 w-4" />
                Profile
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/settings/billing">
                <CreditCard className="mr-2 h-4 w-4" />
                Billing
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout}>
              <LogOut className="mr-2 h-4 w-4" />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
