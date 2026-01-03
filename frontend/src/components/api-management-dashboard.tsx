'use client';

import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { 
  Key, Webhook, Shield, Copy, Eye, EyeOff, Trash2, 
  Plus, Activity, Clock, CheckCircle, XCircle, Settings 
} from 'lucide-react';
import { toast } from 'sonner';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';

interface ApiKey {
  id: string;
  name: string;
  key: string;
  permissions: string[];
  lastUsedAt?: string;
  expiresAt?: string;
  isActive: boolean;
  createdAt: string;
}

interface Webhook {
  id: string;
  url: string;
  events: string[];
  isActive: boolean;
  secret: string;
  failureCount: number;
  lastDeliveryAt?: string;
  createdAt: string;
}

interface OAuthApp {
  id: string;
  name: string;
  clientId: string;
  clientSecret: string;
  redirectUris: string[];
  scopes: string[];
  isActive: boolean;
  createdAt: string;
}

interface CreateApiKeyData {
  name: string;
  permissions: string[];
  expiresInDays?: number;
}

interface CreateWebhookData {
  url: string;
  events: string[];
}

const AVAILABLE_PERMISSIONS = [
  'proposals:read', 'proposals:write', 'proposals:delete',
  'templates:read', 'templates:write', 'templates:delete',
  'clients:read', 'clients:write', 'clients:delete',
  'analytics:read', 'webhooks:manage'
];

const WEBHOOK_EVENTS = [
  'proposal.created', 'proposal.updated', 'proposal.sent', 'proposal.viewed',
  'proposal.signed', 'proposal.rejected', 'payment.received', 'client.created'
];

export function ApiManagementDashboard() {
  const [activeTab, setActiveTab] = useState('api-keys');
  const [showApiKeyDialog, setShowApiKeyDialog] = useState(false);
  const [showWebhookDialog, setShowWebhookDialog] = useState(false);
  const [showOAuthDialog, setShowOAuthDialog] = useState(false);
  const [revealedKeys, setRevealedKeys] = useState<Set<string>>(new Set());
  const queryClient = useQueryClient();

  const { data: apiKeys } = useQuery({
    queryKey: ['api-keys'],
    queryFn: async () => {
      const res = await fetch('/api/api-keys');
      return res.json();
    },
  });

  const { data: webhooks } = useQuery({
    queryKey: ['webhooks'],
    queryFn: async () => {
      const res = await fetch('/api/webhooks');
      return res.json();
    },
  });

  const { data: oauthApps } = useQuery({
    queryKey: ['oauth-apps'],
    queryFn: async () => {
      const res = await fetch('/api/oauth/apps');
      return res.json();
    },
  });

  const { data: apiAnalytics } = useQuery({
    queryKey: ['api-analytics'],
    queryFn: async () => {
      const res = await fetch('/api/api-keys/analytics');
      return res.json();
    },
  });

  const createApiKeyMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch('/api/api-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['api-keys'] });
      toast.success('API key created successfully');
      toast.info('Save your API key now - it won\'t be shown again!');
      setShowApiKeyDialog(false);
    },
  });

  const deleteApiKeyMutation = useMutation({
    mutationFn: async (id: string) => {
      await fetch(`/api/api-keys/${id}`, { method: 'DELETE' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['api-keys'] });
      toast.success('API key deleted');
    },
  });

  const createWebhookMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch('/api/webhooks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['webhooks'] });
      toast.success('Webhook created successfully');
      setShowWebhookDialog(false);
    },
  });

  const testWebhookMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/webhooks/${id}/test`, { method: 'POST' });
      return res.json();
    },
    onSuccess: () => {
      toast.success('Test event sent to webhook');
    },
  });

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  };

  const toggleKeyVisibility = (keyId: string) => {
    const newRevealed = new Set(revealedKeys);
    if (newRevealed.has(keyId)) {
      newRevealed.delete(keyId);
    } else {
      newRevealed.add(keyId);
    }
    setRevealedKeys(newRevealed);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold">API Management</h2>
          <p className="text-muted-foreground">Manage API keys, webhooks, and OAuth apps</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="api-keys">API Keys</TabsTrigger>
          <TabsTrigger value="webhooks">Webhooks</TabsTrigger>
          <TabsTrigger value="oauth">OAuth Apps</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
          <TabsTrigger value="docs">Documentation</TabsTrigger>
        </TabsList>

        <TabsContent value="api-keys" className="space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-sm text-muted-foreground">
              {apiKeys?.length || 0} active API keys
            </p>
            <Button onClick={() => setShowApiKeyDialog(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Create API Key
            </Button>
          </div>

          <div className="grid gap-4">
            {apiKeys?.map((key: ApiKey) => (
              <Card key={key.id}>
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <CardTitle className="text-lg">{key.name}</CardTitle>
                      <CardDescription>
                        Created {new Date(key.createdAt).toLocaleDateString()}
                      </CardDescription>
                    </div>
                    <Badge variant={key.isActive ? 'default' : 'secondary'}>
                      {key.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label className="text-xs text-muted-foreground">API Key</Label>
                    <div className="flex gap-2 mt-1">
                      <Input
                        readOnly
                        value={revealedKeys.has(key.id) ? key.key : '••••••••••••••••••••••••••••••••'}
                        className="font-mono text-sm"
                      />
                      <Button
                        size="icon"
                        variant="outline"
                        onClick={() => toggleKeyVisibility(key.id)}
                      >
                        {revealedKeys.has(key.id) ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </Button>
                      <Button
                        size="icon"
                        variant="outline"
                        onClick={() => copyToClipboard(key.key)}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  <div>
                    <Label className="text-xs text-muted-foreground">Permissions</Label>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {key.permissions.map((perm) => (
                        <Badge key={perm} variant="outline">
                          {perm}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center text-muted-foreground">
                      <Clock className="mr-1 h-4 w-4" />
                      Last used: {key.lastUsedAt ? new Date(key.lastUsedAt).toLocaleString() : 'Never'}
                    </div>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => deleteApiKeyMutation.mutate(key.id)}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="webhooks" className="space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-sm text-muted-foreground">
              {webhooks?.length || 0} configured webhooks
            </p>
            <Button onClick={() => setShowWebhookDialog(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add Webhook
            </Button>
          </div>

          <div className="grid gap-4">
            {webhooks?.map((webhook: Webhook) => (
              <Card key={webhook.id}>
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <CardTitle className="text-lg font-mono text-sm">
                        {webhook.url}
                      </CardTitle>
                      <CardDescription>
                        Created {new Date(webhook.createdAt).toLocaleDateString()}
                      </CardDescription>
                    </div>
                    <Badge variant={webhook.isActive ? 'default' : 'secondary'}>
                      {webhook.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label className="text-xs text-muted-foreground">Events</Label>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {webhook.events.map((event) => (
                        <Badge key={event} variant="outline">
                          {event}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4 text-sm">
                      {webhook.failureCount > 0 ? (
                        <div className="flex items-center text-destructive">
                          <XCircle className="mr-1 h-4 w-4" />
                          {webhook.failureCount} failures
                        </div>
                      ) : (
                        <div className="flex items-center text-green-600">
                          <CheckCircle className="mr-1 h-4 w-4" />
                          Healthy
                        </div>
                      )}
                      {webhook.lastDeliveryAt && (
                        <div className="text-muted-foreground">
                          Last delivery: {new Date(webhook.lastDeliveryAt).toLocaleString()}
                        </div>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => testWebhookMutation.mutate(webhook.id)}
                      >
                        Test
                      </Button>
                      <Button size="sm" variant="outline">
                        <Settings className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="oauth" className="space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-sm text-muted-foreground">
              {oauthApps?.length || 0} OAuth applications
            </p>
            <Button onClick={() => setShowOAuthDialog(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Create OAuth App
            </Button>
          </div>

          <div className="grid gap-4">
            {oauthApps?.map((app: OAuthApp) => (
              <Card key={app.id}>
                <CardHeader>
                  <CardTitle>{app.name}</CardTitle>
                  <CardDescription>
                    Created {new Date(app.createdAt).toLocaleDateString()}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label className="text-xs">Client ID</Label>
                    <div className="flex gap-2 mt-1">
                      <Input readOnly value={app.clientId} className="font-mono" />
                      <Button
                        size="icon"
                        variant="outline"
                        onClick={() => copyToClipboard(app.clientId)}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  <div>
                    <Label className="text-xs">Scopes</Label>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {app.scopes.map((scope) => (
                        <Badge key={scope} variant="outline">{scope}</Badge>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="analytics" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Total Requests</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{apiAnalytics?.totalRequests || 0}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-green-600">
                  {apiAnalytics?.successRate || 0}%
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Avg Response Time</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{apiAnalytics?.avgResponseTime || 0}ms</div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="docs">
          <Card>
            <CardHeader>
              <CardTitle>API Documentation</CardTitle>
              <CardDescription>Learn how to integrate with the SyncQuote API</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h3 className="font-semibold mb-2">Base URL</h3>
                <code className="bg-muted px-3 py-2 rounded block">
                  https://api.syncquote.com/v1
                </code>
              </div>

              <div>
                <h3 className="font-semibold mb-2">Authentication</h3>
                <p className="text-sm text-muted-foreground mb-2">
                  Include your API key in the Authorization header:
                </p>
                <code className="bg-muted px-3 py-2 rounded block text-sm">
                  Authorization: Bearer YOUR_API_KEY
                </code>
              </div>

              <Button variant="outline" asChild>
                <a href="/api/docs" target="_blank">
                  View Full Documentation
                </a>
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <CreateApiKeyDialog 
        open={showApiKeyDialog}
        onOpenChange={setShowApiKeyDialog}
        onSubmit={(data) => createApiKeyMutation.mutate(data)}
      />

      <CreateWebhookDialog
        open={showWebhookDialog}
        onOpenChange={setShowWebhookDialog}
        onSubmit={(data) => createWebhookMutation.mutate(data)}
      />
    </div>
  );
}

function CreateApiKeyDialog({ open, onOpenChange, onSubmit }: { open: boolean; onOpenChange: (open: boolean) => void; onSubmit: (data: CreateApiKeyData) => void }) {
  const [name, setName] = useState('');
  const [permissions, setPermissions] = useState<string[]>([]);
  const [expiresInDays, setExpiresInDays] = useState('');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create API Key</DialogTitle>
          <DialogDescription>
            Generate a new API key with specific permissions
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label>Key Name</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Production Integration"
            />
          </div>

          <div>
            <Label>Permissions</Label>
            <ScrollArea className="h-48 border rounded-md p-4 mt-2">
              <div className="space-y-2">
                {AVAILABLE_PERMISSIONS.map((perm) => (
                  <div key={perm} className="flex items-center space-x-2">
                    <Checkbox
                      id={perm}
                      checked={permissions.includes(perm)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setPermissions([...permissions, perm]);
                        } else {
                          setPermissions(permissions.filter(p => p !== perm));
                        }
                      }}
                    />
                    <label htmlFor={perm} className="text-sm cursor-pointer">
                      {perm}
                    </label>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>

          <div>
            <Label>Expires In (days)</Label>
            <Input
              type="number"
              value={expiresInDays}
              onChange={(e) => setExpiresInDays(e.target.value)}
              placeholder="Optional - leave blank for no expiration"
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button 
              onClick={() => {
                onSubmit({ 
                  name, 
                  permissions,
                  expiresInDays: expiresInDays ? parseInt(expiresInDays) : undefined
                });
                setName('');
                setPermissions([]);
                setExpiresInDays('');
              }}
              disabled={!name || permissions.length === 0}
            >
              Create Key
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function CreateWebhookDialog({ open, onOpenChange, onSubmit }: { open: boolean; onOpenChange: (open: boolean) => void; onSubmit: (data: CreateWebhookData) => void }) {
  const [url, setUrl] = useState('');
  const [events, setEvents] = useState<string[]>([]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Webhook</DialogTitle>
          <DialogDescription>
            Configure a webhook endpoint to receive events
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label>Webhook URL</Label>
            <Input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://your-app.com/webhooks"
            />
          </div>

          <div>
            <Label>Events</Label>
            <ScrollArea className="h-48 border rounded-md p-4 mt-2">
              <div className="space-y-2">
                {WEBHOOK_EVENTS.map((event) => (
                  <div key={event} className="flex items-center space-x-2">
                    <Checkbox
                      id={event}
                      checked={events.includes(event)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setEvents([...events, event]);
                        } else {
                          setEvents(events.filter(e => e !== event));
                        }
                      }}
                    />
                    <label htmlFor={event} className="text-sm cursor-pointer">
                      {event}
                    </label>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button 
              onClick={() => {
                onSubmit({ url, events });
                setUrl('');
                setEvents([]);
              }}
              disabled={!url || events.length === 0}
            >
              Create Webhook
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
