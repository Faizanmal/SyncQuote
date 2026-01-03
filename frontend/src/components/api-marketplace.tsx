"use client";

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import {
  Plus,
  Search,
  Star,
  Download,
  ExternalLink,
  Grid3X3,
  List,
  Filter,
  Loader2,
  CheckCircle,
  Settings,
  Trash2,
  Code2,
  Puzzle,
  Zap,
  BarChart3,
  CreditCard,
  Cloud,
  Calendar,
  Bot,
  Workflow,
  Package,
  Users,
  Shield,
  Globe,
  ChevronRight,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';

interface MarketplaceApp {
  id: string;
  name: string;
  description: string;
  longDescription?: string;
  category: string;
  icon: string;
  developer: {
    name: string;
    verified: boolean;
  };
  rating: number;
  reviewCount: number;
  installCount: number;
  permissions: string[];
  featured: boolean;
  installed: boolean;
  version: string;
  lastUpdated: string;
  screenshots?: string[];
  pricing: 'free' | 'freemium' | 'paid';
  priceMonthly?: number;
}

interface InstalledApp {
  id: string;
  appId: string;
  appName: string;
  appIcon: string;
  status: 'active' | 'disabled' | 'expired';
  installedAt: string;
  lastUsedAt?: string;
  configuration?: Record<string, any>;
}

const categoryIcons: Record<string, React.ReactNode> = {
  crm: <Users className="h-5 w-5" />,
  communication: <Globe className="h-5 w-5" />,
  productivity: <Zap className="h-5 w-5" />,
  analytics: <BarChart3 className="h-5 w-5" />,
  payments: <CreditCard className="h-5 w-5" />,
  storage: <Cloud className="h-5 w-5" />,
  calendar: <Calendar className="h-5 w-5" />,
  ai: <Bot className="h-5 w-5" />,
  automation: <Workflow className="h-5 w-5" />,
  other: <Package className="h-5 w-5" />,
};

const mockApps: MarketplaceApp[] = [
  {
    id: '1',
    name: 'HubSpot CRM Sync',
    description: 'Seamlessly sync proposals and contacts with HubSpot CRM.',
    longDescription: 'The HubSpot CRM Sync integration allows you to automatically synchronize your proposals, contacts, and deals between SyncQuote and HubSpot. Track proposal views, acceptances, and rejections directly in your HubSpot dashboard.',
    category: 'crm',
    icon: '🔶',
    developer: { name: 'SyncQuote Team', verified: true },
    rating: 4.8,
    reviewCount: 156,
    installCount: 2450,
    permissions: ['Read proposals', 'Access contacts', 'Sync data'],
    featured: true,
    installed: false,
    version: '2.3.1',
    lastUpdated: '2024-02-01',
    pricing: 'free',
  },
  {
    id: '2',
    name: 'Salesforce Connector',
    description: 'Enterprise-grade Salesforce integration for proposal management.',
    category: 'crm',
    icon: '☁️',
    developer: { name: 'SyncQuote Team', verified: true },
    rating: 4.7,
    reviewCount: 89,
    installCount: 1890,
    permissions: ['Read proposals', 'Access contacts', 'Sync deals', 'Custom fields'],
    featured: true,
    installed: true,
    version: '3.1.0',
    lastUpdated: '2024-01-28',
    pricing: 'paid',
    priceMonthly: 29,
  },
  {
    id: '3',
    name: 'Slack Notifications',
    description: 'Get real-time proposal notifications in your Slack workspace.',
    category: 'communication',
    icon: '💬',
    developer: { name: 'IntegratePro', verified: true },
    rating: 4.9,
    reviewCount: 234,
    installCount: 5670,
    permissions: ['Send notifications', 'Read proposal events'],
    featured: true,
    installed: true,
    version: '1.8.0',
    lastUpdated: '2024-02-05',
    pricing: 'free',
  },
  {
    id: '4',
    name: 'AI Content Generator',
    description: 'Generate professional proposal content using GPT-4.',
    category: 'ai',
    icon: '🤖',
    developer: { name: 'AI Labs', verified: true },
    rating: 4.6,
    reviewCount: 178,
    installCount: 3240,
    permissions: ['Read proposals', 'Generate content', 'Access templates'],
    featured: true,
    installed: false,
    version: '2.0.0',
    lastUpdated: '2024-02-10',
    pricing: 'freemium',
    priceMonthly: 19,
  },
  {
    id: '5',
    name: 'Stripe Payments',
    description: 'Accept payments directly on your proposals with Stripe.',
    category: 'payments',
    icon: '💳',
    developer: { name: 'SyncQuote Team', verified: true },
    rating: 4.9,
    reviewCount: 312,
    installCount: 8900,
    permissions: ['Process payments', 'Read proposals', 'Manage invoices'],
    featured: false,
    installed: false,
    version: '4.2.1',
    lastUpdated: '2024-02-08',
    pricing: 'free',
  },
  {
    id: '6',
    name: 'Google Drive Storage',
    description: 'Store and sync proposal documents with Google Drive.',
    category: 'storage',
    icon: '📁',
    developer: { name: 'CloudSync', verified: false },
    rating: 4.4,
    reviewCount: 67,
    installCount: 1230,
    permissions: ['Read files', 'Write files', 'Sync documents'],
    featured: false,
    installed: false,
    version: '1.5.0',
    lastUpdated: '2024-01-20',
    pricing: 'free',
  },
  {
    id: '7',
    name: 'Zapier Automation',
    description: 'Connect SyncQuote to 5000+ apps with Zapier.',
    category: 'automation',
    icon: '⚡',
    developer: { name: 'Zapier', verified: true },
    rating: 4.5,
    reviewCount: 145,
    installCount: 4560,
    permissions: ['Webhook access', 'Read proposals', 'Trigger events'],
    featured: false,
    installed: false,
    version: '2.1.0',
    lastUpdated: '2024-02-03',
    pricing: 'free',
  },
  {
    id: '8',
    name: 'Advanced Analytics',
    description: 'Deep insights into proposal performance and client behavior.',
    category: 'analytics',
    icon: '📊',
    developer: { name: 'DataViz Pro', verified: true },
    rating: 4.7,
    reviewCount: 98,
    installCount: 2100,
    permissions: ['Read analytics', 'Access reports', 'Export data'],
    featured: false,
    installed: false,
    version: '1.9.0',
    lastUpdated: '2024-01-25',
    pricing: 'paid',
    priceMonthly: 15,
  },
];

const mockInstalledApps: InstalledApp[] = [
  {
    id: 'inst-1',
    appId: '2',
    appName: 'Salesforce Connector',
    appIcon: '☁️',
    status: 'active',
    installedAt: '2024-01-15T10:00:00Z',
    lastUsedAt: '2024-02-12T14:30:00Z',
  },
  {
    id: 'inst-2',
    appId: '3',
    appName: 'Slack Notifications',
    appIcon: '💬',
    status: 'active',
    installedAt: '2024-01-20T09:00:00Z',
    lastUsedAt: '2024-02-12T16:00:00Z',
    configuration: {
      channel: '#proposals',
      notifyOnView: true,
      notifyOnSign: true,
    },
  },
];

export function ApiMarketplace() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<string>('browse');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('popular');
  const [selectedApp, setSelectedApp] = useState<MarketplaceApp | null>(null);
  const [installDialogOpen, setInstallDialogOpen] = useState(false);
  const [configDialogOpen, setConfigDialogOpen] = useState(false);
  const [selectedInstalledApp, setSelectedInstalledApp] = useState<InstalledApp | null>(null);

  // Fetch marketplace apps
  const { data: apps = mockApps, isLoading } = useQuery({
    queryKey: ['marketplace-apps'],
    queryFn: async () => {
      return mockApps;
    },
  });

  // Fetch installed apps
  const { data: installedApps = mockInstalledApps } = useQuery({
    queryKey: ['installed-apps'],
    queryFn: async () => {
      return mockInstalledApps;
    },
  });

  // Install app mutation
  const installAppMutation = useMutation({
    mutationFn: async (appId: string) => {
      const response = await fetch('/api/marketplace/install', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appId }),
      });
      if (!response.ok) throw new Error('Failed to install app');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['marketplace-apps'] });
      queryClient.invalidateQueries({ queryKey: ['installed-apps'] });
      setInstallDialogOpen(false);
      toast.success('App installed successfully!');
    },
    onError: () => {
      toast.error('Failed to install app');
    },
  });

  // Uninstall app mutation
  const uninstallAppMutation = useMutation({
    mutationFn: async (installationId: string) => {
      const response = await fetch(`/api/marketplace/uninstall/${installationId}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('Failed to uninstall app');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['marketplace-apps'] });
      queryClient.invalidateQueries({ queryKey: ['installed-apps'] });
      toast.success('App uninstalled');
    },
    onError: () => {
      toast.error('Failed to uninstall app');
    },
  });

  const filteredApps = apps.filter((app) => {
    const matchesSearch =
      app.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      app.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = categoryFilter === 'all' || app.category === categoryFilter;
    return matchesSearch && matchesCategory;
  }).sort((a, b) => {
    switch (sortBy) {
      case 'popular':
        return b.installCount - a.installCount;
      case 'rating':
        return b.rating - a.rating;
      case 'recent':
        return new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime();
      case 'name':
        return a.name.localeCompare(b.name);
      default:
        return 0;
    }
  });

  const featuredApps = apps.filter((app) => app.featured);
  const categories = [...new Set(apps.map((app) => app.category))];

  const getPricingBadge = (app: MarketplaceApp) => {
    switch (app.pricing) {
      case 'free':
        return <Badge variant="secondary">Free</Badge>;
      case 'freemium':
        return <Badge variant="outline">Freemium</Badge>;
      case 'paid':
        return <Badge variant="default">${app.priceMonthly}/mo</Badge>;
    }
  };

  const renderStars = (rating: number) => {
    return (
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`h-4 w-4 ${
              star <= rating ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'
            }`}
          />
        ))}
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">App Marketplace</h2>
          <p className="text-muted-foreground">
            Extend SyncQuote with powerful integrations and apps.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-sm">
            {installedApps.length} apps installed
          </Badge>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="browse">
            <Puzzle className="h-4 w-4 mr-2" />
            Browse Apps
          </TabsTrigger>
          <TabsTrigger value="installed">
            <Download className="h-4 w-4 mr-2" />
            Installed ({installedApps.length})
          </TabsTrigger>
          <TabsTrigger value="developer">
            <Code2 className="h-4 w-4 mr-2" />
            Developer
          </TabsTrigger>
        </TabsList>

        {/* Browse Tab */}
        <TabsContent value="browse" className="space-y-6">
          {/* Featured Apps */}
          <div>
            <h3 className="text-lg font-semibold mb-4">Featured Apps</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {featuredApps.slice(0, 4).map((app) => (
                <Card
                  key={app.id}
                  className="cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => {
                    setSelectedApp(app);
                    setInstallDialogOpen(true);
                  }}
                >
                  <CardContent className="pt-6">
                    <div className="flex items-start gap-3">
                      <div className="text-4xl">{app.icon}</div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-semibold truncate">{app.name}</h4>
                        <p className="text-xs text-muted-foreground">{app.developer.name}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <div className="flex items-center gap-1">
                            <Star className="h-3 w-3 text-yellow-400 fill-yellow-400" />
                            <span className="text-xs">{app.rating}</span>
                          </div>
                          {getPricingBadge(app)}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {/* Search and Filters */}
          <div className="flex flex-wrap items-center gap-4">
            <div className="relative flex-1 min-w-[200px] max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search apps..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-[160px]">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categories.map((category) => (
                  <SelectItem key={category} value={category}>
                    <div className="flex items-center gap-2">
                      {categoryIcons[category]}
                      <span className="capitalize">{category}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="popular">Most Popular</SelectItem>
                <SelectItem value="rating">Highest Rated</SelectItem>
                <SelectItem value="recent">Recently Updated</SelectItem>
                <SelectItem value="name">Name A-Z</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex items-center border rounded-md">
              <Button
                variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
                size="icon"
                onClick={() => setViewMode('grid')}
              >
                <Grid3X3 className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === 'list' ? 'secondary' : 'ghost'}
                size="icon"
                onClick={() => setViewMode('list')}
              >
                <List className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Apps Grid/List */}
          {viewMode === 'grid' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredApps.map((app) => (
                <Card key={app.id} className="relative overflow-hidden">
                  {app.installed && (
                    <div className="absolute top-2 right-2">
                      <Badge variant="default" className="bg-green-500">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Installed
                      </Badge>
                    </div>
                  )}
                  <CardHeader>
                    <div className="flex items-start gap-4">
                      <div className="text-5xl">{app.icon}</div>
                      <div>
                        <CardTitle className="text-lg">{app.name}</CardTitle>
                        <div className="flex items-center gap-1 mt-1">
                          <span className="text-sm text-muted-foreground">{app.developer.name}</span>
                          {app.developer.verified && (
                            <Shield className="h-3 w-3 text-blue-500" />
                          )}
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <CardDescription className="line-clamp-2 mb-4">
                      {app.description}
                    </CardDescription>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {renderStars(app.rating)}
                        <span className="text-sm text-muted-foreground">
                          ({app.reviewCount})
                        </span>
                      </div>
                      {getPricingBadge(app)}
                    </div>
                    <div className="flex items-center gap-4 mt-3 text-sm text-muted-foreground">
                      <span>{app.installCount.toLocaleString()} installs</span>
                      <Badge variant="outline" className="capitalize">
                        {categoryIcons[app.category]}
                        <span className="ml-1">{app.category}</span>
                      </Badge>
                    </div>
                  </CardContent>
                  <CardFooter>
                    <Button
                      className="w-full"
                      variant={app.installed ? 'outline' : 'default'}
                      onClick={() => {
                        setSelectedApp(app);
                        setInstallDialogOpen(true);
                      }}
                    >
                      {app.installed ? 'Manage' : 'Install'}
                      <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                  </CardFooter>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="p-0">
                <div className="divide-y">
                  {filteredApps.map((app) => (
                    <div
                      key={app.id}
                      className="flex items-center justify-between p-4 hover:bg-muted/50 cursor-pointer"
                      onClick={() => {
                        setSelectedApp(app);
                        setInstallDialogOpen(true);
                      }}
                    >
                      <div className="flex items-center gap-4">
                        <div className="text-4xl">{app.icon}</div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="font-semibold">{app.name}</h4>
                            {app.installed && (
                              <Badge variant="default" className="bg-green-500">
                                <CheckCircle className="h-3 w-3" />
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground line-clamp-1">
                            {app.description}
                          </p>
                          <div className="flex items-center gap-3 mt-1">
                            <div className="flex items-center gap-1">
                              <Star className="h-3 w-3 text-yellow-400 fill-yellow-400" />
                              <span className="text-xs">{app.rating}</span>
                            </div>
                            <span className="text-xs text-muted-foreground">
                              {app.installCount.toLocaleString()} installs
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {getPricingBadge(app)}
                        <Button variant={app.installed ? 'outline' : 'default'} size="sm">
                          {app.installed ? 'Manage' : 'Install'}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Installed Tab */}
        <TabsContent value="installed" className="space-y-6">
          {installedApps.length === 0 ? (
            <Card className="text-center py-12">
              <CardContent>
                <Puzzle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No apps installed</h3>
                <p className="text-muted-foreground mb-4">
                  Browse the marketplace to find apps that enhance your workflow.
                </p>
                <Button onClick={() => setActiveTab('browse')}>
                  Browse Apps
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {installedApps.map((installation) => (
                <Card key={installation.id}>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="text-4xl">{installation.appIcon}</div>
                        <div>
                          <h4 className="font-semibold">{installation.appName}</h4>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge
                              variant={installation.status === 'active' ? 'default' : 'secondary'}
                              className={installation.status === 'active' ? 'bg-green-500' : ''}
                            >
                              {installation.status === 'active' ? 'Active' : installation.status}
                            </Badge>
                            <span className="text-sm text-muted-foreground">
                              Installed {new Date(installation.installedAt).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedInstalledApp(installation);
                            setConfigDialogOpen(true);
                          }}
                        >
                          <Settings className="h-4 w-4 mr-1" />
                          Configure
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          onClick={() => uninstallAppMutation.mutate(installation.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    {installation.lastUsedAt && (
                      <p className="text-xs text-muted-foreground mt-3">
                        Last used: {new Date(installation.lastUsedAt).toLocaleString()}
                      </p>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Developer Tab */}
        <TabsContent value="developer" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Build Your Own App</CardTitle>
              <CardDescription>
                Create custom integrations and publish them to the marketplace.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                  <CardContent className="pt-6">
                    <Code2 className="h-8 w-8 text-blue-500 mb-3" />
                    <h4 className="font-semibold">REST API</h4>
                    <p className="text-sm text-muted-foreground">
                      Access proposals, contacts, and more via our REST API.
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <Zap className="h-8 w-8 text-yellow-500 mb-3" />
                    <h4 className="font-semibold">Webhooks</h4>
                    <p className="text-sm text-muted-foreground">
                      React to events in real-time with webhook notifications.
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <Puzzle className="h-8 w-8 text-purple-500 mb-3" />
                    <h4 className="font-semibold">OAuth 2.0</h4>
                    <p className="text-sm text-muted-foreground">
                      Secure user authentication with OAuth 2.0 support.
                    </p>
                  </CardContent>
                </Card>
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-semibold">API Documentation</h4>
                  <p className="text-sm text-muted-foreground">
                    Complete reference for our REST API and webhooks.
                  </p>
                </div>
                <Button variant="outline">
                  View Docs
                  <ExternalLink className="h-4 w-4 ml-2" />
                </Button>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-semibold">Register New App</h4>
                  <p className="text-sm text-muted-foreground">
                    Create a new app and get your API credentials.
                  </p>
                </div>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Create App
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Install/View App Dialog */}
      <Dialog open={installDialogOpen} onOpenChange={setInstallDialogOpen}>
        <DialogContent className="sm:max-w-[600px]">
          {selectedApp && (
            <>
              <DialogHeader>
                <div className="flex items-start gap-4">
                  <div className="text-6xl">{selectedApp.icon}</div>
                  <div>
                    <DialogTitle className="text-xl">{selectedApp.name}</DialogTitle>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-sm text-muted-foreground">
                        {selectedApp.developer.name}
                      </span>
                      {selectedApp.developer.verified && (
                        <Badge variant="outline" className="text-xs">
                          <Shield className="h-3 w-3 mr-1 text-blue-500" />
                          Verified
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              </DialogHeader>

              <div className="space-y-4 py-4">
                <div className="flex items-center gap-4">
                  {renderStars(selectedApp.rating)}
                  <span className="text-sm text-muted-foreground">
                    {selectedApp.reviewCount} reviews
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {selectedApp.installCount.toLocaleString()} installs
                  </span>
                </div>

                <p className="text-muted-foreground">
                  {selectedApp.longDescription || selectedApp.description}
                </p>

                <Separator />

                <div>
                  <h4 className="font-semibold mb-2">Permissions Required</h4>
                  <div className="flex flex-wrap gap-2">
                    {selectedApp.permissions.map((permission, idx) => (
                      <Badge key={idx} variant="outline">
                        {permission}
                      </Badge>
                    ))}
                  </div>
                </div>

                <Separator />

                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Version</span>
                  <span>{selectedApp.version}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Last Updated</span>
                  <span>{new Date(selectedApp.lastUpdated).toLocaleDateString()}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Category</span>
                  <Badge variant="outline" className="capitalize">
                    {categoryIcons[selectedApp.category]}
                    <span className="ml-1">{selectedApp.category}</span>
                  </Badge>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Pricing</span>
                  {getPricingBadge(selectedApp)}
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setInstallDialogOpen(false)}>
                  Cancel
                </Button>
                {selectedApp.installed ? (
                  <Button variant="destructive" onClick={() => {
                    // Find installation and uninstall
                    const installation = installedApps.find(i => i.appId === selectedApp.id);
                    if (installation) {
                      uninstallAppMutation.mutate(installation.id);
                    }
                    setInstallDialogOpen(false);
                  }}>
                    <Trash2 className="h-4 w-4 mr-2" />
                    Uninstall
                  </Button>
                ) : (
                  <Button onClick={() => installAppMutation.mutate(selectedApp.id)}>
                    {installAppMutation.isPending ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Download className="h-4 w-4 mr-2" />
                    )}
                    Install App
                  </Button>
                )}
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Configure App Dialog */}
      <Dialog open={configDialogOpen} onOpenChange={setConfigDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span className="text-2xl">{selectedInstalledApp?.appIcon}</span>
              Configure {selectedInstalledApp?.appName}
            </DialogTitle>
            <DialogDescription>
              Customize how this app works with SyncQuote.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="flex items-center justify-between">
              <div>
                <Label>App Status</Label>
                <p className="text-sm text-muted-foreground">Enable or disable this app</p>
              </div>
              <Switch checked={selectedInstalledApp?.status === 'active'} />
            </div>

            <Separator />

            {selectedInstalledApp?.configuration && (
              <>
                {selectedInstalledApp.appName === 'Slack Notifications' && (
                  <>
                    <div className="space-y-2">
                      <Label>Notification Channel</Label>
                      <Input
                        defaultValue={selectedInstalledApp.configuration.channel}
                        placeholder="#channel-name"
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <Label>Notify on proposal views</Label>
                      <Switch defaultChecked={selectedInstalledApp.configuration.notifyOnView} />
                    </div>

                    <div className="flex items-center justify-between">
                      <Label>Notify on proposal signatures</Label>
                      <Switch defaultChecked={selectedInstalledApp.configuration.notifyOnSign} />
                    </div>
                  </>
                )}
              </>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setConfigDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => {
              toast.success('Configuration saved');
              setConfigDialogOpen(false);
            }}>
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default ApiMarketplace;
