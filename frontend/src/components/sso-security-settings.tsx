'use client';

import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { 
  Shield, Users, Clock, Globe, AlertTriangle, 
  CheckCircle, Settings, Download, Upload 
} from 'lucide-react';
import { toast } from 'sonner';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

interface SsoConfig {
  id: string;
  name: string;
  provider: string;
  domain: string;
  isActive: boolean;
  metadata?: any;
  createdAt: string;
}

interface SecurityPolicy {
  id: string;
  name: string;
  passwordMinLength: number;
  passwordRequireUppercase: boolean;
  passwordRequireNumbers: boolean;
  passwordRequireSpecialChars: boolean;
  sessionTimeout: number;
  maxFailedAttempts: number;
  ipWhitelist: string[];
  mfaRequired: boolean;
  mfaMethod: string;
}

interface DirectorySyncConfig {
  id: string;
  provider: string;
  syncEnabled: boolean;
  lastSyncAt?: string;
  syncedUsers: number;
  syncedGroups: number;
}

export function SsoSecuritySettings() {
  const [activeTab, setActiveTab] = useState('sso');
  const [showSsoDialog, setShowSsoDialog] = useState(false);
  const queryClient = useQueryClient();

  const { data: ssoConfigs } = useQuery({
    queryKey: ['sso-configs'],
    queryFn: async () => {
      const res = await fetch('/api/sso/configs');
      return res.json();
    },
  });

  const { data: securityPolicy } = useQuery({
    queryKey: ['security-policy'],
    queryFn: async () => {
      const res = await fetch('/api/sso/security/policy');
      return res.json();
    },
  });

  const { data: directorySyncConfig } = useQuery({
    queryKey: ['directory-sync'],
    queryFn: async () => {
      const res = await fetch('/api/sso/directory-sync/config');
      return res.json();
    },
  });

  const { data: activeSessions } = useQuery({
    queryKey: ['active-sessions'],
    queryFn: async () => {
      const res = await fetch('/api/sso/security/sessions');
      return res.json();
    },
  });

  const createSsoConfigMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch('/api/sso/configs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sso-configs'] });
      toast.success('SSO configuration created');
      setShowSsoDialog(false);
    },
  });

  const updateSecurityPolicyMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch('/api/sso/security/policy', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['security-policy'] });
      toast.success('Security policy updated');
    },
  });

  const triggerDirectorySyncMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/sso/directory-sync/trigger', { method: 'POST' });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['directory-sync'] });
      toast.success('Directory sync initiated');
    },
  });

  const revokeSessionMutation = useMutation({
    mutationFn: async (sessionId: string) => {
      await fetch(`/api/sso/security/sessions/${sessionId}/revoke`, { method: 'POST' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['active-sessions'] });
      toast.success('Session revoked');
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold">SSO & Security</h2>
          <p className="text-muted-foreground">Enterprise authentication and security settings</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="sso">Single Sign-On</TabsTrigger>
          <TabsTrigger value="directory">Directory Sync</TabsTrigger>
          <TabsTrigger value="security">Security Policies</TabsTrigger>
          <TabsTrigger value="sessions">Active Sessions</TabsTrigger>
          <TabsTrigger value="audit">Audit Logs</TabsTrigger>
        </TabsList>

        <TabsContent value="sso" className="space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-sm text-muted-foreground">
              Configure SAML 2.0 and OAuth providers
            </p>
            <Button onClick={() => setShowSsoDialog(true)}>
              <Settings className="mr-2 h-4 w-4" />
              Add SSO Provider
            </Button>
          </div>

          <div className="grid gap-4">
            {ssoConfigs?.map((config: SsoConfig) => (
              <Card key={config.id}>
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <CardTitle className="text-lg">{config.name}</CardTitle>
                      <CardDescription>
                        {config.provider} • Domain: {config.domain}
                      </CardDescription>
                    </div>
                    <Badge variant={config.isActive ? 'default' : 'secondary'}>
                      {config.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm">
                      <Download className="mr-2 h-4 w-4" />
                      Download Metadata
                    </Button>
                    <Button variant="outline" size="sm">
                      Test Connection
                    </Button>
                    <Button variant="outline" size="sm">
                      Edit
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}

            {(!ssoConfigs || ssoConfigs.length === 0) && (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <Shield className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-lg font-medium">No SSO providers configured</p>
                  <p className="text-sm text-muted-foreground mb-4">
                    Set up SAML or OAuth for enterprise authentication
                  </p>
                  <Button onClick={() => setShowSsoDialog(true)}>
                    Configure SSO
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="directory" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Directory Synchronization</CardTitle>
              <CardDescription>
                Automatically sync users and groups from your identity provider
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {directorySyncConfig && (
                <>
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Enable Directory Sync</Label>
                      <p className="text-sm text-muted-foreground">
                        Automatically provision and deprovision users
                      </p>
                    </div>
                    <Switch checked={directorySyncConfig.syncEnabled} />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <Card>
                      <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-2xl font-bold">{directorySyncConfig.syncedUsers}</p>
                            <p className="text-sm text-muted-foreground">Synced Users</p>
                          </div>
                          <Users className="h-8 w-8 text-muted-foreground" />
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-2xl font-bold">{directorySyncConfig.syncedGroups}</p>
                            <p className="text-sm text-muted-foreground">Synced Groups</p>
                          </div>
                          <Users className="h-8 w-8 text-muted-foreground" />
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="text-sm">
                      <p className="font-medium">Last Sync</p>
                      <p className="text-muted-foreground">
                        {directorySyncConfig.lastSyncAt 
                          ? new Date(directorySyncConfig.lastSyncAt).toLocaleString()
                          : 'Never'}
                      </p>
                    </div>
                    <Button 
                      onClick={() => triggerDirectorySyncMutation.mutate()}
                      disabled={triggerDirectorySyncMutation.isPending}
                    >
                      Sync Now
                    </Button>
                  </div>

                  <div>
                    <Label>SCIM Endpoint</Label>
                    <Input 
                      readOnly 
                      value="https://api.syncquote.com/scim/v2" 
                      className="font-mono"
                    />
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="security" className="space-y-4">
          {securityPolicy && (
            <SecurityPolicyForm 
              policy={securityPolicy}
              onUpdate={(data) => updateSecurityPolicyMutation.mutate(data)}
            />
          )}
        </TabsContent>

        <TabsContent value="sessions" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Active Sessions</CardTitle>
              <CardDescription>
                Manage currently active user sessions
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {activeSessions?.map((session: any) => (
                  <div 
                    key={session.id} 
                    className="flex items-center justify-between p-4 border rounded-lg"
                  >
                    <div className="flex-1">
                      <p className="font-medium">{session.userEmail}</p>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
                        <span className="flex items-center">
                          <Globe className="mr-1 h-3 w-3" />
                          {session.ipAddress}
                        </span>
                        <span className="flex items-center">
                          <Clock className="mr-1 h-3 w-3" />
                          {new Date(session.createdAt).toLocaleString()}
                        </span>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => revokeSessionMutation.mutate(session.id)}
                    >
                      Revoke
                    </Button>
                  </div>
                ))}

                {(!activeSessions || activeSessions.length === 0) && (
                  <div className="text-center py-12 text-muted-foreground">
                    No active sessions
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="audit">
          <Card>
            <CardHeader>
              <CardTitle>Security Audit Logs</CardTitle>
              <CardDescription>
                Track authentication and security events
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12 text-muted-foreground">
                Audit logs will appear here
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function SecurityPolicyForm({ policy, onUpdate }: { policy: SecurityPolicy; onUpdate: (data: any) => void }) {
  const [formData, setFormData] = useState(policy);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Security Policy</CardTitle>
        <CardDescription>
          Configure password requirements and access controls
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div>
          <h3 className="text-lg font-semibold mb-4">Password Requirements</h3>
          
          <div className="space-y-4">
            <div>
              <Label>Minimum Length</Label>
              <Input
                type="number"
                min={8}
                value={formData.passwordMinLength}
                onChange={(e) => setFormData({ ...formData, passwordMinLength: parseInt(e.target.value) })}
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label>Require Uppercase Letters</Label>
                <p className="text-sm text-muted-foreground">At least one capital letter</p>
              </div>
              <Switch
                checked={formData.passwordRequireUppercase}
                onCheckedChange={(checked) => setFormData({ ...formData, passwordRequireUppercase: checked })}
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label>Require Numbers</Label>
                <p className="text-sm text-muted-foreground">At least one digit</p>
              </div>
              <Switch
                checked={formData.passwordRequireNumbers}
                onCheckedChange={(checked) => setFormData({ ...formData, passwordRequireNumbers: checked })}
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label>Require Special Characters</Label>
                <p className="text-sm text-muted-foreground">At least one symbol (!@#$%)</p>
              </div>
              <Switch
                checked={formData.passwordRequireSpecialChars}
                onCheckedChange={(checked) => setFormData({ ...formData, passwordRequireSpecialChars: checked })}
              />
            </div>
          </div>
        </div>

        <div>
          <h3 className="text-lg font-semibold mb-4">Session Management</h3>
          
          <div className="space-y-4">
            <div>
              <Label>Session Timeout (minutes)</Label>
              <Input
                type="number"
                min={5}
                value={formData.sessionTimeout}
                onChange={(e) => setFormData({ ...formData, sessionTimeout: parseInt(e.target.value) })}
              />
            </div>

            <div>
              <Label>Max Failed Login Attempts</Label>
              <Input
                type="number"
                min={3}
                value={formData.maxFailedAttempts}
                onChange={(e) => setFormData({ ...formData, maxFailedAttempts: parseInt(e.target.value) })}
              />
            </div>
          </div>
        </div>

        <div>
          <h3 className="text-lg font-semibold mb-4">Multi-Factor Authentication</h3>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label>Require MFA for All Users</Label>
                <p className="text-sm text-muted-foreground">Enforce two-factor authentication</p>
              </div>
              <Switch
                checked={formData.mfaRequired}
                onCheckedChange={(checked) => setFormData({ ...formData, mfaRequired: checked })}
              />
            </div>

            <div>
              <Label>MFA Method</Label>
              <Select
                value={formData.mfaMethod}
                onValueChange={(value) => setFormData({ ...formData, mfaMethod: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="totp">Authenticator App (TOTP)</SelectItem>
                  <SelectItem value="sms">SMS</SelectItem>
                  <SelectItem value="email">Email</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <div>
          <h3 className="text-lg font-semibold mb-4">IP Whitelist</h3>
          <Textarea
            placeholder="Enter IP addresses or CIDR ranges, one per line"
            value={formData.ipWhitelist?.join('\n') || ''}
            onChange={(e) => setFormData({ ...formData, ipWhitelist: e.target.value.split('\n').filter(Boolean) })}
            rows={4}
          />
          <p className="text-sm text-muted-foreground mt-2">
            Leave empty to allow all IP addresses
          </p>
        </div>

        <Button onClick={() => onUpdate(formData)}>
          <CheckCircle className="mr-2 h-4 w-4" />
          Save Security Policy
        </Button>
      </CardContent>
    </Card>
  );
}
