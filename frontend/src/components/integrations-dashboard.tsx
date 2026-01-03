"use client";

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle,
  CardFooter 
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import {
  Calendar,
  Cloud,
  MessageSquare,
  Video,
  Link2,
  Check,
  X,
  Settings,
  RefreshCw,
  ExternalLink,
  Loader2,
  AlertCircle,
  Slack,
  Mail,
  FileText,
  FolderOpen,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';

interface Integration {
  id: string;
  name: string;
  description: string;
  provider: string;
  category: 'calendar' | 'storage' | 'communication';
  icon: React.ReactNode;
  connected: boolean;
  lastSynced?: string;
  status: 'active' | 'disconnected' | 'error';
  features: string[];
  configurable?: boolean;
}

interface IntegrationConfig {
  autoSync?: boolean;
  syncInterval?: number;
  notifyOnEvents?: boolean;
  defaultChannel?: string;
}

const integrationsList: Integration[] = [
  // Calendar Integrations
  {
    id: 'google-calendar',
    name: 'Google Calendar',
    description: 'Sync meetings, schedule proposal reviews, and set follow-up reminders.',
    provider: 'google',
    category: 'calendar',
    icon: <Calendar className="h-6 w-6 text-blue-500" />,
    connected: false,
    status: 'disconnected',
    features: ['Schedule meetings', 'Auto-reminders', 'Proposal deadlines', 'Team availability'],
    configurable: true,
  },
  {
    id: 'microsoft-outlook',
    name: 'Microsoft Outlook',
    description: 'Connect your Outlook calendar for seamless scheduling and reminders.',
    provider: 'microsoft',
    category: 'calendar',
    icon: <Calendar className="h-6 w-6 text-blue-700" />,
    connected: false,
    status: 'disconnected',
    features: ['Calendar sync', 'Email integration', 'Meeting scheduling'],
    configurable: true,
  },
  // Storage Integrations
  {
    id: 'google-drive',
    name: 'Google Drive',
    description: 'Store and sync proposal documents, attachments, and exports.',
    provider: 'google',
    category: 'storage',
    icon: <Cloud className="h-6 w-6 text-yellow-500" />,
    connected: false,
    status: 'disconnected',
    features: ['Auto-backup', 'File attachments', 'Export proposals', 'Version history'],
    configurable: true,
  },
  {
    id: 'dropbox',
    name: 'Dropbox',
    description: 'Sync your proposals and documents with Dropbox for easy access.',
    provider: 'dropbox',
    category: 'storage',
    icon: <Cloud className="h-6 w-6 text-blue-600" />,
    connected: false,
    status: 'disconnected',
    features: ['Cloud storage', 'File sharing', 'Automatic backup'],
    configurable: true,
  },
  {
    id: 'onedrive',
    name: 'Microsoft OneDrive',
    description: 'Store and access proposal files through Microsoft OneDrive.',
    provider: 'microsoft',
    category: 'storage',
    icon: <Cloud className="h-6 w-6 text-blue-500" />,
    connected: false,
    status: 'disconnected',
    features: ['Office integration', 'File sync', 'Collaboration'],
    configurable: true,
  },
  // Communication Integrations
  {
    id: 'slack',
    name: 'Slack',
    description: 'Get real-time notifications and updates in your Slack workspace.',
    provider: 'slack',
    category: 'communication',
    icon: <Slack className="h-6 w-6 text-purple-500" />,
    connected: false,
    status: 'disconnected',
    features: ['Proposal notifications', 'Team mentions', 'Quick actions', 'Channel updates'],
    configurable: true,
  },
  {
    id: 'microsoft-teams',
    name: 'Microsoft Teams',
    description: 'Collaborate with your team on proposals directly in Teams.',
    provider: 'microsoft',
    category: 'communication',
    icon: <MessageSquare className="h-6 w-6 text-purple-700" />,
    connected: false,
    status: 'disconnected',
    features: ['Channel notifications', 'Team collaboration', 'Meeting integration'],
    configurable: true,
  },
  {
    id: 'zoom',
    name: 'Zoom',
    description: 'Schedule and start proposal review meetings directly from SyncQuote.',
    provider: 'zoom',
    category: 'communication',
    icon: <Video className="h-6 w-6 text-blue-500" />,
    connected: false,
    status: 'disconnected',
    features: ['One-click meetings', 'Calendar integration', 'Recording links'],
    configurable: true,
  },
];

export function IntegrationsDashboard() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<string>('all');
  const [selectedIntegration, setSelectedIntegration] = useState<Integration | null>(null);
  const [configDialogOpen, setConfigDialogOpen] = useState(false);
  const [config, setConfig] = useState<IntegrationConfig>({
    autoSync: true,
    syncInterval: 15,
    notifyOnEvents: true,
    defaultChannel: '',
  });

  // Fetch connected integrations
  const { data: connectedIntegrations, isLoading } = useQuery({
    queryKey: ['integrations'],
    queryFn: async () => {
      const response = await fetch('/api/integrations');
      if (!response.ok) throw new Error('Failed to fetch integrations');
      return response.json();
    },
  });

  // Connect integration mutation
  const connectMutation = useMutation({
    mutationFn: async ({ provider, category }: { provider: string; category: string }) => {
      const response = await fetch(`/api/integrations/${category}/connect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider }),
      });
      if (!response.ok) throw new Error('Failed to connect integration');
      return response.json();
    },
    onSuccess: (data) => {
      // Redirect to OAuth flow if URL provided
      if (data.authUrl) {
        window.location.href = data.authUrl;
      } else {
        queryClient.invalidateQueries({ queryKey: ['integrations'] });
        toast.success('Integration connected successfully!');
      }
    },
    onError: () => {
      toast.error('Failed to connect integration');
    },
  });

  // Disconnect integration mutation
  const disconnectMutation = useMutation({
    mutationFn: async ({ provider, category }: { provider: string; category: string }) => {
      const response = await fetch(`/api/integrations/${category}/disconnect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider }),
      });
      if (!response.ok) throw new Error('Failed to disconnect integration');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['integrations'] });
      toast.success('Integration disconnected');
    },
    onError: () => {
      toast.error('Failed to disconnect integration');
    },
  });

  // Sync integration mutation
  const syncMutation = useMutation({
    mutationFn: async ({ provider, category }: { provider: string; category: string }) => {
      const response = await fetch(`/api/integrations/${category}/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider }),
      });
      if (!response.ok) throw new Error('Failed to sync integration');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['integrations'] });
      toast.success('Sync completed');
    },
    onError: () => {
      toast.error('Failed to sync');
    },
  });

  // Merge connected status into integrations list
  const integrations = integrationsList.map((integration) => {
    const connected = connectedIntegrations?.find(
      (c: any) => c.provider === integration.provider && c.category === integration.category
    );
    return {
      ...integration,
      connected: !!connected,
      status: connected ? 'active' : 'disconnected',
      lastSynced: connected?.lastSynced,
    } as Integration;
  });

  const filteredIntegrations = activeTab === 'all' 
    ? integrations 
    : integrations.filter(i => i.category === activeTab);

  const connectedCount = integrations.filter(i => i.connected).length;

  const handleConnect = (integration: Integration) => {
    connectMutation.mutate({ 
      provider: integration.provider, 
      category: integration.category 
    });
  };

  const handleDisconnect = (integration: Integration) => {
    disconnectMutation.mutate({ 
      provider: integration.provider, 
      category: integration.category 
    });
  };

  const handleSync = (integration: Integration) => {
    syncMutation.mutate({ 
      provider: integration.provider, 
      category: integration.category 
    });
  };

  const handleConfigure = (integration: Integration) => {
    setSelectedIntegration(integration);
    setConfigDialogOpen(true);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge variant="default" className="bg-green-500"><Check className="h-3 w-3 mr-1" />Connected</Badge>;
      case 'error':
        return <Badge variant="destructive"><AlertCircle className="h-3 w-3 mr-1" />Error</Badge>;
      default:
        return <Badge variant="secondary"><X className="h-3 w-3 mr-1" />Disconnected</Badge>;
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'calendar':
        return <Calendar className="h-4 w-4" />;
      case 'storage':
        return <FolderOpen className="h-4 w-4" />;
      case 'communication':
        return <MessageSquare className="h-4 w-4" />;
      default:
        return <Link2 className="h-4 w-4" />;
    }
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
          <h2 className="text-3xl font-bold tracking-tight">Integrations</h2>
          <p className="text-muted-foreground">
            Connect your favorite tools to streamline your workflow.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-sm">
            {connectedCount} of {integrations.length} connected
          </Badge>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Integrations</p>
                <p className="text-2xl font-bold">{integrations.length}</p>
              </div>
              <Link2 className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Calendar</p>
                <p className="text-2xl font-bold">
                  {integrations.filter(i => i.category === 'calendar' && i.connected).length}
                </p>
              </div>
              <Calendar className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Storage</p>
                <p className="text-2xl font-bold">
                  {integrations.filter(i => i.category === 'storage' && i.connected).length}
                </p>
              </div>
              <Cloud className="h-8 w-8 text-yellow-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Communication</p>
                <p className="text-2xl font-bold">
                  {integrations.filter(i => i.category === 'communication' && i.connected).length}
                </p>
              </div>
              <MessageSquare className="h-8 w-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs for filtering */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="all">All Integrations</TabsTrigger>
          <TabsTrigger value="calendar" className="flex items-center gap-1">
            <Calendar className="h-4 w-4" />
            Calendar
          </TabsTrigger>
          <TabsTrigger value="storage" className="flex items-center gap-1">
            <Cloud className="h-4 w-4" />
            Storage
          </TabsTrigger>
          <TabsTrigger value="communication" className="flex items-center gap-1">
            <MessageSquare className="h-4 w-4" />
            Communication
          </TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="mt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredIntegrations.map((integration) => (
              <Card key={integration.id} className="relative overflow-hidden">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-muted rounded-lg">
                        {integration.icon}
                      </div>
                      <div>
                        <CardTitle className="text-lg">{integration.name}</CardTitle>
                        <div className="flex items-center gap-2 mt-1">
                          {getCategoryIcon(integration.category)}
                          <span className="text-xs text-muted-foreground capitalize">
                            {integration.category}
                          </span>
                        </div>
                      </div>
                    </div>
                    {getStatusBadge(integration.status)}
                  </div>
                </CardHeader>
                <CardContent>
                  <CardDescription className="mb-4">
                    {integration.description}
                  </CardDescription>
                  <div className="flex flex-wrap gap-1">
                    {integration.features.slice(0, 3).map((feature, idx) => (
                      <Badge key={idx} variant="outline" className="text-xs">
                        {feature}
                      </Badge>
                    ))}
                    {integration.features.length > 3 && (
                      <Badge variant="outline" className="text-xs">
                        +{integration.features.length - 3} more
                      </Badge>
                    )}
                  </div>
                  {integration.lastSynced && (
                    <p className="text-xs text-muted-foreground mt-3">
                      Last synced: {new Date(integration.lastSynced).toLocaleString()}
                    </p>
                  )}
                </CardContent>
                <CardFooter className="flex gap-2">
                  {integration.connected ? (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleSync(integration)}
                        disabled={syncMutation.isPending}
                      >
                        {syncMutation.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <RefreshCw className="h-4 w-4 mr-1" />
                        )}
                        Sync
                      </Button>
                      {integration.configurable && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleConfigure(integration)}
                        >
                          <Settings className="h-4 w-4 mr-1" />
                          Configure
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => handleDisconnect(integration)}
                        disabled={disconnectMutation.isPending}
                      >
                        Disconnect
                      </Button>
                    </>
                  ) : (
                    <Button
                      className="w-full"
                      onClick={() => handleConnect(integration)}
                      disabled={connectMutation.isPending}
                    >
                      {connectMutation.isPending ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Link2 className="h-4 w-4 mr-2" />
                      )}
                      Connect
                    </Button>
                  )}
                </CardFooter>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      {/* Configuration Dialog */}
      <Dialog open={configDialogOpen} onOpenChange={setConfigDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedIntegration?.icon}
              Configure {selectedIntegration?.name}
            </DialogTitle>
            <DialogDescription>
              Customize how this integration works with SyncQuote.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6 py-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="auto-sync">Auto Sync</Label>
                <p className="text-sm text-muted-foreground">
                  Automatically sync data in the background
                </p>
              </div>
              <Switch
                id="auto-sync"
                checked={config.autoSync}
                onCheckedChange={(checked) => setConfig({ ...config, autoSync: checked })}
              />
            </div>

            <Separator />

            {config.autoSync && (
              <div className="space-y-2">
                <Label htmlFor="sync-interval">Sync Interval</Label>
                <Select
                  value={String(config.syncInterval)}
                  onValueChange={(value) => setConfig({ ...config, syncInterval: parseInt(value) })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select interval" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="5">Every 5 minutes</SelectItem>
                    <SelectItem value="15">Every 15 minutes</SelectItem>
                    <SelectItem value="30">Every 30 minutes</SelectItem>
                    <SelectItem value="60">Every hour</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            <Separator />

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="notify-events">Event Notifications</Label>
                <p className="text-sm text-muted-foreground">
                  Get notified when important events occur
                </p>
              </div>
              <Switch
                id="notify-events"
                checked={config.notifyOnEvents}
                onCheckedChange={(checked) => setConfig({ ...config, notifyOnEvents: checked })}
              />
            </div>

            {selectedIntegration?.category === 'communication' && (
              <>
                <Separator />
                <div className="space-y-2">
                  <Label htmlFor="default-channel">Default Channel</Label>
                  <Input
                    id="default-channel"
                    placeholder="e.g., #proposals or general"
                    value={config.defaultChannel}
                    onChange={(e) => setConfig({ ...config, defaultChannel: e.target.value })}
                  />
                  <p className="text-xs text-muted-foreground">
                    Where notifications will be sent by default
                  </p>
                </div>
              </>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setConfigDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => {
              // Save configuration
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

export default IntegrationsDashboard;
