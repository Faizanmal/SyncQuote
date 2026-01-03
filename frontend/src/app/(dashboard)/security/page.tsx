'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Progress } from '@/components/ui/progress'
import { 
  Shield, 
  Lock, 
  Key, 
  Smartphone, 
  AlertTriangle, 
  Check, 
  X, 
  Eye, 
  EyeOff, 
  Clock, 
  MapPin, 
  Monitor, 
  Globe,
  Settings,
  FileText,
  RefreshCw,
  Download,
  Ban,
  Activity,
  Zap,
  UserX,
  CreditCard,
  Wifi,
  WifiOff
} from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { api } from '@/lib/api'

interface SecuritySettings {
  twoFactorEnabled: boolean
  sessionTimeout: number
  ipWhitelisting: boolean
  auditLogging: boolean
  passwordPolicy: {
    minLength: number
    requireUppercase: boolean
    requireNumbers: boolean
    requireSymbols: boolean
  }
  loginNotifications: boolean
  suspiciousActivityAlerts: boolean
}

interface AuditLogEntry {
  id: string
  action: string
  resource: string
  userId: string
  userName: string
  ip: string
  userAgent: string
  location: string
  timestamp: string
  riskLevel: 'low' | 'medium' | 'high'
  details: Record<string, any>
}

interface SecuritySession {
  id: string
  device: string
  browser: string
  os: string
  ip: string
  location: string
  current: boolean
  lastActive: string
  createdAt: string
}

interface SecurityThreat {
  id: string
  type: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  description: string
  timestamp: string
  status: 'active' | 'resolved' | 'investigating'
  affectedUsers: number
}

interface APIKey {
  id: string
  name: string
  key: string
  permissions: string[]
  lastUsed: string
  expiresAt: string
  createdAt: string
  status: 'active' | 'revoked'
}

const enable2FASchema = z.object({
  password: z.string().min(1, 'Password is required'),
  code: z.string().length(6, 'Code must be 6 digits'),
})

const createAPIKeySchema = z.object({
  name: z.string().min(1, 'Name is required'),
  permissions: z.array(z.string()).min(1, 'At least one permission is required'),
  expiresAt: z.string().optional(),
})

type Enable2FAForm = z.infer<typeof enable2FASchema>
type CreateAPIKeyForm = z.infer<typeof createAPIKeySchema>

export default function SecurityPage() {
  const [showBackupCodes, setShowBackupCodes] = useState(false)
  const [show2FADialog, setShow2FADialog] = useState(false)
  const [showAPIKeyDialog, setShowAPIKeyDialog] = useState(false)
  const [newAPIKey, setNewAPIKey] = useState<string | null>(null)
  const queryClient = useQueryClient()

  const { register: register2FA, handleSubmit: handleSubmit2FA, formState: { errors: errors2FA }, reset: reset2FA } = useForm<Enable2FAForm>({
    resolver: zodResolver(enable2FASchema),
  })

  const { register: registerAPIKey, handleSubmit: handleSubmitAPIKey, formState: { errors: errorsAPIKey }, reset: resetAPIKey, watch } = useForm<CreateAPIKeyForm>({
    resolver: zodResolver(createAPIKeySchema),
  })

  // Fetch security data
  const { data: settings } = useQuery({
    queryKey: ['security', 'settings'],
    queryFn: () => api.get('/security/settings').then(res => res.data),
  })

  const { data: auditLogs } = useQuery({
    queryKey: ['security', 'audit-logs'],
    queryFn: () => api.get('/security/audit-logs').then(res => res.data),
  })

  const { data: sessions } = useQuery({
    queryKey: ['security', 'sessions'],
    queryFn: () => api.get('/security/sessions').then(res => res.data),
  })

  const { data: threats } = useQuery({
    queryKey: ['security', 'threats'],
    queryFn: () => api.get('/security/threats').then(res => res.data),
  })

  const { data: apiKeys } = useQuery({
    queryKey: ['security', 'api-keys'],
    queryFn: () => api.get('/security/api-keys').then(res => res.data),
  })

  const { data: qrCode } = useQuery({
    queryKey: ['security', '2fa-qr'],
    queryFn: () => api.get('/security/2fa/qr').then(res => res.data),
    enabled: show2FADialog,
  })

  // Mutations
  const updateSettingsMutation = useMutation({
    mutationFn: (data: Partial<SecuritySettings>) => api.patch('/security/settings', data),
    onSuccess: () => {
      toast.success('Security settings updated!')
      queryClient.invalidateQueries({ queryKey: ['security', 'settings'] })
    },
    onError: () => {
      toast.error('Failed to update security settings')
    }
  })

  const enable2FAMutation = useMutation({
    mutationFn: (data: Enable2FAForm) => api.post('/security/2fa/enable', data),
    onSuccess: () => {
      toast.success('Two-factor authentication enabled!')
      setShow2FADialog(false)
      reset2FA()
      queryClient.invalidateQueries({ queryKey: ['security', 'settings'] })
    },
    onError: () => {
      toast.error('Failed to enable 2FA. Please check your code.')
    }
  })

  const disable2FAMutation = useMutation({
    mutationFn: () => api.post('/security/2fa/disable'),
    onSuccess: () => {
      toast.success('Two-factor authentication disabled!')
      queryClient.invalidateQueries({ queryKey: ['security', 'settings'] })
    },
  })

  const terminateSessionMutation = useMutation({
    mutationFn: (sessionId: string) => api.delete(`/security/sessions/${sessionId}`),
    onSuccess: () => {
      toast.success('Session terminated!')
      queryClient.invalidateQueries({ queryKey: ['security', 'sessions'] })
    },
  })

  const createAPIKeyMutation = useMutation({
    mutationFn: (data: CreateAPIKeyForm) => api.post('/security/api-keys', data),
    onSuccess: (response) => {
      toast.success('API key created!')
      setNewAPIKey((response as any).data.key)
      setShowAPIKeyDialog(false)
      resetAPIKey()
      queryClient.invalidateQueries({ queryKey: ['security', 'api-keys'] })
    },
  })

  const revokeAPIKeyMutation = useMutation({
    mutationFn: (keyId: string) => api.delete(`/security/api-keys/${keyId}`),
    onSuccess: () => {
      toast.success('API key revoked!')
      queryClient.invalidateQueries({ queryKey: ['security', 'api-keys'] })
    },
  })

  const onEnable2FA = (data: Enable2FAForm) => {
    enable2FAMutation.mutate(data)
  }

  const onCreateAPIKey = (data: CreateAPIKeyForm) => {
    createAPIKeyMutation.mutate(data)
  }

  const getRiskLevelColor = (level: string) => {
    switch (level) {
      case 'high':
        return 'text-red-500'
      case 'medium':
        return 'text-yellow-500'
      case 'low':
        return 'text-green-500'
      default:
        return 'text-gray-500'
    }
  }

  const getThreatSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'destructive'
      case 'high':
        return 'destructive'
      case 'medium':
        return 'secondary'
      case 'low':
        return 'outline'
      default:
        return 'outline'
    }
  }

  return (
    <div className="flex-1 space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Security Center</h2>
          <p className="text-muted-foreground">
            Manage your account security, audit logs, and access controls
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Button variant="outline">
            <Download className="mr-2 h-4 w-4" />
            Export Logs
          </Button>
          <Button variant="outline">
            <RefreshCw className="mr-2 h-4 w-4" />
            Security Scan
          </Button>
        </div>
      </div>

      {/* Security Overview */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Security Score</CardTitle>
            <Shield className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">87%</div>
            <Progress value={87} className="mt-2" />
            <p className="text-xs text-muted-foreground mt-1">
              +5% from last month
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Threats</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">3</div>
            <p className="text-xs text-muted-foreground">
              1 critical, 2 medium
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Sessions</CardTitle>
            <Monitor className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{sessions?.length || 0}</div>
            <p className="text-xs text-muted-foreground">
              Across {new Set(sessions?.map((s: SecuritySession) => s.device)).size || 0} devices
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Failed Logins</CardTitle>
            <UserX className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">12</div>
            <p className="text-xs text-muted-foreground">
              Last 24 hours
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Security Alerts */}
      {threats && threats.length > 0 && (
        <Alert className="border-red-200 bg-red-50">
          <AlertTriangle className="h-4 w-4 text-red-500" />
          <AlertDescription className="text-red-700">
            <strong>Security Alert:</strong> {threats.length} active security threat(s) detected. 
            <Button variant="link" className="p-0 h-auto ml-2 text-red-700">
              Review now →
            </Button>
          </AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="settings" className="space-y-4">
        <TabsList>
          <TabsTrigger value="settings">Settings</TabsTrigger>
          <TabsTrigger value="sessions">Sessions</TabsTrigger>
          <TabsTrigger value="audit">Audit Logs</TabsTrigger>
          <TabsTrigger value="threats">Threats</TabsTrigger>
          <TabsTrigger value="api-keys">API Keys</TabsTrigger>
        </TabsList>

        <TabsContent value="settings" className="space-y-4">
          <div className="grid gap-6">
            {/* Two-Factor Authentication */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Lock className="h-5 w-5" />
                  <span>Two-Factor Authentication</span>
                </CardTitle>
                <CardDescription>
                  Add an extra layer of security to your account
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Authenticator App</p>
                    <p className="text-sm text-muted-foreground">
                      Use an app like Google Authenticator or Authy
                    </p>
                  </div>
                  <div className="flex items-center space-x-2">
                    {settings?.twoFactorEnabled ? (
                      <>
                        <Badge variant="default">Enabled</Badge>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => disable2FAMutation.mutate()}
                        >
                          Disable
                        </Button>
                      </>
                    ) : (
                      <Dialog open={show2FADialog} onOpenChange={setShow2FADialog}>
                        <DialogTrigger asChild>
                          <Button size="sm">Enable</Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Enable Two-Factor Authentication</DialogTitle>
                            <DialogDescription>
                              Scan the QR code with your authenticator app and enter the verification code
                            </DialogDescription>
                          </DialogHeader>
                          <div className="space-y-4">
                            {qrCode && (
                              <div className="flex justify-center">
                                <img src={qrCode.qrCodeUrl} alt="2FA QR Code" className="w-48 h-48" />
                              </div>
                            )}
                            <form onSubmit={handleSubmit2FA(onEnable2FA)} className="space-y-4">
                              <div>
                                <Label htmlFor="password">Current Password</Label>
                                <Input
                                  id="password"
                                  type="password"
                                  {...register2FA('password')}
                                />
                                {errors2FA.password && (
                                  <p className="text-sm text-red-500 mt-1">{errors2FA.password.message}</p>
                                )}
                              </div>
                              <div>
                                <Label htmlFor="code">Verification Code</Label>
                                <Input
                                  id="code"
                                  {...register2FA('code')}
                                  placeholder="123456"
                                />
                                {errors2FA.code && (
                                  <p className="text-sm text-red-500 mt-1">{errors2FA.code.message}</p>
                                )}
                              </div>
                              <DialogFooter>
                                <Button type="button" variant="outline" onClick={() => setShow2FADialog(false)}>
                                  Cancel
                                </Button>
                                <Button type="submit" disabled={enable2FAMutation.isPending}>
                                  {enable2FAMutation.isPending ? 'Enabling...' : 'Enable 2FA'}
                                </Button>
                              </DialogFooter>
                            </form>
                          </div>
                        </DialogContent>
                      </Dialog>
                    )}
                  </div>
                </div>

                {settings?.twoFactorEnabled && (
                  <div className="space-y-2">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => setShowBackupCodes(!showBackupCodes)}
                    >
                      {showBackupCodes ? <EyeOff className="mr-2 h-4 w-4" /> : <Eye className="mr-2 h-4 w-4" />}
                      {showBackupCodes ? 'Hide' : 'Show'} Backup Codes
                    </Button>
                    {showBackupCodes && (
                      <div className="bg-gray-50 p-4 rounded border">
                        <p className="text-sm font-medium mb-2">Backup Codes (save these securely):</p>
                        <div className="grid grid-cols-2 gap-2 text-sm font-mono">
                          {['1234-5678', '2345-6789', '3456-7890', '4567-8901', '5678-9012'].map(code => (
                            <div key={code} className="bg-white p-2 rounded border">{code}</div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Security Settings */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Settings className="h-5 w-5" />
                  <span>Security Settings</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Login Notifications</p>
                    <p className="text-sm text-muted-foreground">
                      Get notified when someone signs in to your account
                    </p>
                  </div>
                  <Switch
                    checked={settings?.loginNotifications}
                    onCheckedChange={(checked) => updateSettingsMutation.mutate({ loginNotifications: checked })}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Suspicious Activity Alerts</p>
                    <p className="text-sm text-muted-foreground">
                      Get alerted about unusual account activity
                    </p>
                  </div>
                  <Switch
                    checked={settings?.suspiciousActivityAlerts}
                    onCheckedChange={(checked) => updateSettingsMutation.mutate({ suspiciousActivityAlerts: checked })}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Audit Logging</p>
                    <p className="text-sm text-muted-foreground">
                      Log all account activities for security review
                    </p>
                  </div>
                  <Switch
                    checked={settings?.auditLogging}
                    onCheckedChange={(checked) => updateSettingsMutation.mutate({ auditLogging: checked })}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Session Timeout</Label>
                  <Select 
                    value={settings?.sessionTimeout?.toString()} 
                    onValueChange={(value) => updateSettingsMutation.mutate({ sessionTimeout: parseInt(value) })}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="15">15 minutes</SelectItem>
                      <SelectItem value="30">30 minutes</SelectItem>
                      <SelectItem value="60">1 hour</SelectItem>
                      <SelectItem value="240">4 hours</SelectItem>
                      <SelectItem value="480">8 hours</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            {/* Password Policy */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Key className="h-5 w-5" />
                  <span>Password Policy</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <span>Minimum length: {settings?.passwordPolicy?.minLength || 8} characters</span>
                  <Badge variant="outline">Required</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span>Require uppercase letters</span>
                  <Switch checked={settings?.passwordPolicy?.requireUppercase} />
                </div>
                <div className="flex items-center justify-between">
                  <span>Require numbers</span>
                  <Switch checked={settings?.passwordPolicy?.requireNumbers} />
                </div>
                <div className="flex items-center justify-between">
                  <span>Require symbols</span>
                  <Switch checked={settings?.passwordPolicy?.requireSymbols} />
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="sessions" className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium">Active Sessions</h3>
            <Button variant="outline" size="sm">
              <Ban className="mr-2 h-4 w-4" />
              Terminate All Others
            </Button>
          </div>
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Device</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>IP Address</TableHead>
                  <TableHead>Last Active</TableHead>
                  <TableHead className="w-[70px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sessions?.map((session: SecuritySession) => (
                  <TableRow key={session.id}>
                    <TableCell>
                      <div className="flex items-center space-x-3">
                        {session.current ? (
                          <Wifi className="h-4 w-4 text-green-500" />
                        ) : (
                          <WifiOff className="h-4 w-4 text-gray-400" />
                        )}
                        <div>
                          <p className="font-medium">
                            {session.browser} on {session.os}
                          </p>
                          <p className="text-sm text-muted-foreground">{session.device}</p>
                          {session.current && (
                            <Badge variant="outline" className="text-xs">Current</Badge>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-1">
                        <MapPin className="h-3 w-3 text-muted-foreground" />
                        <span className="text-sm">{session.location}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {session.ip}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-1 text-sm text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        <span>{session.lastActive}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {!session.current && (
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => terminateSessionMutation.mutate(session.id)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="audit" className="space-y-4">
          <h3 className="text-lg font-medium">Audit Logs</h3>
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Action</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>IP / Location</TableHead>
                  <TableHead>Risk</TableHead>
                  <TableHead>Timestamp</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {auditLogs?.map((log: AuditLogEntry) => (
                  <TableRow key={log.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{log.action}</p>
                        <p className="text-sm text-muted-foreground">{log.resource}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium">{log.userName}</p>
                        <p className="text-sm text-muted-foreground">{log.userId}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="text-sm">{log.ip}</p>
                        <p className="text-xs text-muted-foreground">{log.location}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge 
                        variant={log.riskLevel === 'high' ? 'destructive' : log.riskLevel === 'medium' ? 'secondary' : 'outline'}
                      >
                        {log.riskLevel}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {log.timestamp}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="threats" className="space-y-4">
          <h3 className="text-lg font-medium">Security Threats</h3>
          <div className="space-y-4">
            {threats?.map((threat: SecurityThreat) => (
              <Card key={threat.id}>
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between">
                    <div className="space-y-2">
                      <div className="flex items-center space-x-2">
                        <Badge variant={getThreatSeverityColor(threat.severity)}>
                          {threat.severity}
                        </Badge>
                        <Badge variant="outline">
                          {threat.status}
                        </Badge>
                      </div>
                      <h4 className="font-medium">{threat.type}</h4>
                      <p className="text-sm text-muted-foreground">{threat.description}</p>
                      <div className="flex items-center space-x-4 text-xs text-muted-foreground">
                        <span>Affected users: {threat.affectedUsers}</span>
                        <span>Detected: {threat.timestamp}</span>
                      </div>
                    </div>
                    <div className="flex space-x-2">
                      <Button variant="outline" size="sm">Investigate</Button>
                      <Button variant="outline" size="sm">Resolve</Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="api-keys" className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium">API Keys</h3>
            <Dialog open={showAPIKeyDialog} onOpenChange={setShowAPIKeyDialog}>
              <DialogTrigger asChild>
                <Button>
                  <Key className="mr-2 h-4 w-4" />
                  Create API Key
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create API Key</DialogTitle>
                  <DialogDescription>
                    Generate a new API key for programmatic access
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmitAPIKey(onCreateAPIKey)} className="space-y-4">
                  <div>
                    <Label htmlFor="name">Key Name</Label>
                    <Input
                      id="name"
                      {...registerAPIKey('name')}
                      placeholder="My API Key"
                    />
                    {errorsAPIKey.name && (
                      <p className="text-sm text-red-500 mt-1">{errorsAPIKey.name.message}</p>
                    )}
                  </div>
                  <div>
                    <Label>Permissions</Label>
                    <div className="space-y-2 mt-2">
                      {['read:proposals', 'write:proposals', 'read:analytics', 'manage:team'].map(permission => (
                        <div key={permission} className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            id={permission}
                            {...registerAPIKey('permissions')}
                            value={permission}
                          />
                          <Label htmlFor={permission} className="text-sm">{permission}</Label>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="expiresAt">Expires (Optional)</Label>
                    <Input
                      id="expiresAt"
                      type="date"
                      {...registerAPIKey('expiresAt')}
                    />
                  </div>
                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setShowAPIKeyDialog(false)}>
                      Cancel
                    </Button>
                    <Button type="submit" disabled={createAPIKeyMutation.isPending}>
                      {createAPIKeyMutation.isPending ? 'Creating...' : 'Create Key'}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          {newAPIKey && (
            <Alert>
              <Key className="h-4 w-4" />
              <AlertDescription>
                <strong>Your new API key:</strong> 
                <code className="bg-gray-100 px-2 py-1 rounded ml-2">{newAPIKey}</code>
                <p className="text-sm mt-2">Save this key securely. You won't be able to see it again.</p>
              </AlertDescription>
            </Alert>
          )}

          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Key</TableHead>
                  <TableHead>Permissions</TableHead>
                  <TableHead>Last Used</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[70px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {apiKeys?.map((key: APIKey) => (
                  <TableRow key={key.id}>
                    <TableCell className="font-medium">{key.name}</TableCell>
                    <TableCell>
                      <code className="text-xs bg-gray-100 px-2 py-1 rounded">
                        {key.key.slice(0, 8)}...{key.key.slice(-4)}
                      </code>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {key.permissions.slice(0, 2).map(permission => (
                          <Badge key={permission} variant="outline" className="text-xs">
                            {permission}
                          </Badge>
                        ))}
                        {key.permissions.length > 2 && (
                          <Badge variant="outline" className="text-xs">
                            +{key.permissions.length - 2}
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {key.lastUsed || 'Never'}
                    </TableCell>
                    <TableCell>
                      <Badge variant={key.status === 'active' ? 'default' : 'destructive'}>
                        {key.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => revokeAPIKeyMutation.mutate(key.id)}
                        disabled={key.status === 'revoked'}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}