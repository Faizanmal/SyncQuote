'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/components/ui/use-toast';
import {
  RefreshCw,
  Link2,
  Unlink,
  Settings,
  Users,
  Building2,
  ArrowRightLeft,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  Plus,
  Trash2,
  ExternalLink,
} from 'lucide-react';

// CRM Provider Icons
const CrmIcons = {
  hubspot: () => (
    <svg viewBox="0 0 24 24" className="w-6 h-6" fill="currentColor">
      <path d="M18.164 7.93V5.084a2.198 2.198 0 001.267-1.984 2.21 2.21 0 00-4.42 0c0 .873.516 1.627 1.257 1.984v2.846a5.593 5.593 0 00-2.373 1.092l-6.427-5.004a2.28 2.28 0 00.068-.533 2.252 2.252 0 10-2.252 2.252c.39 0 .756-.101 1.076-.276l6.312 4.916a5.577 5.577 0 00-.496 2.307c0 .826.18 1.609.502 2.317l-1.98 1.94a2.028 2.028 0 00-.633-.104 2.035 2.035 0 102.035 2.035c0-.223-.037-.438-.104-.639l1.953-1.913a5.581 5.581 0 003.553 1.272 5.58 5.58 0 005.58-5.58 5.58 5.58 0 00-4.918-5.54z"/>
    </svg>
  ),
  salesforce: () => (
    <svg viewBox="0 0 24 24" className="w-6 h-6" fill="currentColor">
      <path d="M10.006 5.415a4.195 4.195 0 013.045-1.306c1.56 0 2.954.9 3.69 2.205.63-.27 1.335-.42 2.07-.42 2.82 0 5.13 2.31 5.13 5.13s-2.31 5.13-5.13 5.13c-.39 0-.78-.045-1.155-.12a3.94 3.94 0 01-3.405 1.98 3.94 3.94 0 01-1.965-.525 4.65 4.65 0 01-4.23 2.73c-2.13 0-3.96-1.425-4.515-3.39a4.245 4.245 0 01-.63.045c-2.34 0-4.245-1.905-4.245-4.245s1.905-4.245 4.245-4.245c.27 0 .54.03.795.075.39-2.19 2.31-3.855 4.635-3.855.78 0 1.515.195 2.16.54z"/>
    </svg>
  ),
  pipedrive: () => (
    <svg viewBox="0 0 24 24" className="w-6 h-6" fill="currentColor">
      <circle cx="12" cy="12" r="10"/>
    </svg>
  ),
  zoho: () => (
    <svg viewBox="0 0 24 24" className="w-6 h-6" fill="currentColor">
      <path d="M12 2L2 7v10l10 5 10-5V7L12 2z"/>
    </svg>
  ),
};

interface CrmIntegration {
  id: string;
  provider: 'hubspot' | 'salesforce' | 'pipedrive' | 'zoho';
  accountName: string;
  syncEnabled: boolean;
  lastSyncedAt?: string;
  status: 'connected' | 'error' | 'syncing';
  contactsCount?: number;
  dealsCount?: number;
}

interface CrmContact {
  id: string;
  externalId: string;
  email: string;
  name: string;
  company?: string;
  lastSyncedAt: string;
}

interface FieldMapping {
  id: string;
  sourceField: string;
  targetField: string;
  direction: 'to_crm' | 'from_crm' | 'bidirectional';
}

const CRM_PROVIDERS = [
  { id: 'hubspot', name: 'HubSpot', color: '#FF7A59' },
  { id: 'salesforce', name: 'Salesforce', color: '#00A1E0' },
  { id: 'pipedrive', name: 'Pipedrive', color: '#017737' },
  { id: 'zoho', name: 'Zoho CRM', color: '#E42527' },
];

export function CrmIntegrationDashboard() {
  const [integrations, setIntegrations] = useState<CrmIntegration[]>([]);
  const [contacts, setContacts] = useState<CrmContact[]>([]);
  const [fieldMappings, setFieldMappings] = useState<FieldMapping[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState<string | null>(null);
  const [showConnectDialog, setShowConnectDialog] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetchIntegrations();
  }, []);

  const fetchIntegrations = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/crm-integrations');
      const data = await response.json();
      setIntegrations(data.integrations || []);
      setContacts(data.contacts || []);
      setFieldMappings(data.fieldMappings || []);
    } catch (error) {
      console.error('Failed to fetch integrations:', error);
    } finally {
      setLoading(false);
    }
  };

  const connectCrm = async (provider: string) => {
    try {
      const response = await fetch(`/api/crm-integrations/${provider}/connect`);
      const data = await response.json();
      if (data.authUrl) {
        window.location.href = data.authUrl;
      }
    } catch (error) {
      toast({
        title: 'Connection failed',
        description: 'Failed to initiate CRM connection',
        variant: 'destructive',
      });
    }
  };

  const disconnectCrm = async (integrationId: string) => {
    try {
      await fetch(`/api/crm-integrations/${integrationId}`, { method: 'DELETE' });
      setIntegrations(prev => prev.filter(i => i.id !== integrationId));
      toast({
        title: 'Disconnected',
        description: 'CRM integration has been removed',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to disconnect CRM',
        variant: 'destructive',
      });
    }
  };

  const syncNow = async (integrationId: string) => {
    try {
      setSyncing(integrationId);
      await fetch(`/api/crm-integrations/${integrationId}/sync`, { method: 'POST' });
      toast({
        title: 'Sync started',
        description: 'CRM synchronization is in progress',
      });
      // Poll for completion
      setTimeout(() => {
        fetchIntegrations();
        setSyncing(null);
      }, 3000);
    } catch (error) {
      setSyncing(null);
      toast({
        title: 'Sync failed',
        description: 'Failed to sync with CRM',
        variant: 'destructive',
      });
    }
  };

  const toggleSync = async (integrationId: string, enabled: boolean) => {
    try {
      await fetch(`/api/crm-integrations/${integrationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ syncEnabled: enabled }),
      });
      setIntegrations(prev =>
        prev.map(i => (i.id === integrationId ? { ...i, syncEnabled: enabled } : i))
      );
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to update sync settings',
        variant: 'destructive',
      });
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'connected':
        return <Badge className="bg-green-500"><CheckCircle2 className="w-3 h-3 mr-1" /> Connected</Badge>;
      case 'syncing':
        return <Badge className="bg-blue-500"><RefreshCw className="w-3 h-3 mr-1 animate-spin" /> Syncing</Badge>;
      case 'error':
        return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" /> Error</Badge>;
      default:
        return <Badge variant="secondary">Unknown</Badge>;
    }
  };

  const CrmIcon = ({ provider }: { provider: string }) => {
    const Icon = CrmIcons[provider as keyof typeof CrmIcons];
    return Icon ? <Icon /> : null;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">CRM Integrations</h2>
          <p className="text-muted-foreground">Connect your CRM to sync contacts, deals, and proposals</p>
        </div>
        <Dialog open={showConnectDialog} onOpenChange={setShowConnectDialog}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Connect CRM
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Connect CRM</DialogTitle>
              <DialogDescription>Choose a CRM platform to connect with SyncQuote</DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-4 mt-4">
              {CRM_PROVIDERS.map((provider) => {
                const isConnected = integrations.some(i => i.provider === provider.id);
                return (
                  <Button
                    key={provider.id}
                    variant="outline"
                    className="h-24 flex-col gap-2"
                    disabled={isConnected}
                    onClick={() => connectCrm(provider.id)}
                  >
                    <div style={{ color: provider.color }}>
                      <CrmIcon provider={provider.id} />
                    </div>
                    <span>{provider.name}</span>
                    {isConnected && <Badge variant="secondary" className="text-xs">Connected</Badge>}
                  </Button>
                );
              })}
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Connected Integrations */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {integrations.map((integration) => {
          const provider = CRM_PROVIDERS.find(p => p.id === integration.provider);
          return (
            <Card key={integration.id}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div style={{ color: provider?.color }}>
                      <CrmIcon provider={integration.provider} />
                    </div>
                    <div>
                      <CardTitle className="text-lg">{provider?.name}</CardTitle>
                      <CardDescription>{integration.accountName}</CardDescription>
                    </div>
                  </div>
                  {getStatusBadge(syncing === integration.id ? 'syncing' : integration.status)}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-muted-foreground" />
                    <span>{integration.contactsCount || 0} Contacts</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-muted-foreground" />
                    <span>{integration.dealsCount || 0} Deals</span>
                  </div>
                </div>

                {integration.lastSyncedAt && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Clock className="w-3 h-3" />
                    Last synced: {new Date(integration.lastSyncedAt).toLocaleString()}
                  </div>
                )}

                <div className="flex items-center justify-between pt-2 border-t">
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={integration.syncEnabled}
                      onCheckedChange={(checked) => toggleSync(integration.id, checked)}
                    />
                    <span className="text-sm">Auto-sync</span>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => syncNow(integration.id)}
                      disabled={syncing === integration.id}
                    >
                      <RefreshCw className={`w-4 h-4 mr-1 ${syncing === integration.id ? 'animate-spin' : ''}`} />
                      Sync Now
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => disconnectCrm(integration.id)}
                    >
                      <Unlink className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}

        {integrations.length === 0 && !loading && (
          <Card className="col-span-2 border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Link2 className="w-12 h-12 text-muted-foreground mb-4" />
              <h3 className="font-medium mb-2">No CRM Connected</h3>
              <p className="text-sm text-muted-foreground mb-4">Connect your CRM to sync contacts and deals</p>
              <Button onClick={() => setShowConnectDialog(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Connect CRM
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Tabs for Contacts, Deals, and Settings */}
      {integrations.length > 0 && (
        <Tabs defaultValue="contacts">
          <TabsList>
            <TabsTrigger value="contacts">
              <Users className="w-4 h-4 mr-2" />
              Synced Contacts
            </TabsTrigger>
            <TabsTrigger value="mappings">
              <ArrowRightLeft className="w-4 h-4 mr-2" />
              Field Mappings
            </TabsTrigger>
            <TabsTrigger value="logs">
              <Clock className="w-4 h-4 mr-2" />
              Sync History
            </TabsTrigger>
          </TabsList>

          <TabsContent value="contacts" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Synced Contacts</CardTitle>
                <CardDescription>Contacts imported from your connected CRMs</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Company</TableHead>
                      <TableHead>Last Synced</TableHead>
                      <TableHead className="w-[100px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {contacts.slice(0, 10).map((contact) => (
                      <TableRow key={contact.id}>
                        <TableCell className="font-medium">{contact.name}</TableCell>
                        <TableCell>{contact.email}</TableCell>
                        <TableCell>{contact.company || '-'}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {new Date(contact.lastSyncedAt).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          <Button variant="ghost" size="sm">
                            <ExternalLink className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                    {contacts.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                          No contacts synced yet. Run a sync to import contacts.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="mappings" className="mt-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Field Mappings</CardTitle>
                  <CardDescription>Configure how fields sync between SyncQuote and your CRM</CardDescription>
                </div>
                <Button variant="outline" size="sm">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Mapping
                </Button>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>SyncQuote Field</TableHead>
                      <TableHead>Direction</TableHead>
                      <TableHead>CRM Field</TableHead>
                      <TableHead className="w-[100px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {fieldMappings.map((mapping) => (
                      <TableRow key={mapping.id}>
                        <TableCell className="font-medium">{mapping.sourceField}</TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {mapping.direction === 'bidirectional' ? '↔️' : mapping.direction === 'to_crm' ? '→' : '←'}
                            {mapping.direction.replace('_', ' ')}
                          </Badge>
                        </TableCell>
                        <TableCell>{mapping.targetField}</TableCell>
                        <TableCell>
                          <Button variant="ghost" size="sm">
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                    {fieldMappings.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                          No custom field mappings configured. Default mappings are in use.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="logs" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Sync History</CardTitle>
                <CardDescription>Recent synchronization activities</CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[300px]">
                  <div className="space-y-4">
                    {[
                      { time: '2 minutes ago', action: 'Full sync completed', status: 'success', details: '45 contacts, 12 deals synced' },
                      { time: '1 hour ago', action: 'Webhook received', status: 'success', details: 'Contact updated: john@example.com' },
                      { time: '3 hours ago', action: 'Full sync completed', status: 'success', details: '43 contacts, 11 deals synced' },
                      { time: '1 day ago', action: 'Sync failed', status: 'error', details: 'Authentication expired' },
                    ].map((log, index) => (
                      <div key={index} className="flex items-start gap-3 pb-3 border-b last:border-0">
                        {log.status === 'success' ? (
                          <CheckCircle2 className="w-5 h-5 text-green-500 mt-0.5" />
                        ) : (
                          <XCircle className="w-5 h-5 text-destructive mt-0.5" />
                        )}
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <span className="font-medium">{log.action}</span>
                            <span className="text-xs text-muted-foreground">{log.time}</span>
                          </div>
                          <p className="text-sm text-muted-foreground">{log.details}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
