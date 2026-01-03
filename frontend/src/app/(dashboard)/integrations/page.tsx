'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Checkbox } from '@/components/ui/checkbox'
import { Progress } from '@/components/ui/progress'
import { 
  Plug, 
  Zap, 
  Share, 
  Globe, 
  Settings, 
  Plus, 
  Edit, 
  Trash2, 
  Eye, 
  Send, 
  Users, 
  Clock, 
  Target,
  Filter,
  Search,
  CheckCircle,
  XCircle,
  AlertCircle,
  Info,
  Activity,
  Calendar,
  FileText,
  DollarSign,
  UserPlus,
  TrendingUp,
  Download,
  Upload,
  Play,
  Pause,
  MoreHorizontal,
  ExternalLink,
  Key,
  Shield,
  RefreshCw,
  Database,
  Code,
  Webhook,
  Cpu,
  Cloud,
  Building,
  Mail,
  MessageSquare,
  Phone,
  Link as LinkIcon,
  GitBranch,
  Package,
  Star,
  Heart,
  Layers,
  Box
} from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { api } from '@/lib/api'

interface Integration {
  id: string
  name: string
  description: string
  provider: string
  category: 'crm' | 'payment' | 'communication' | 'productivity' | 'analytics' | 'storage'
  status: 'active' | 'inactive' | 'error' | 'configuring'
  version: string
  lastSync: string
  syncedRecords: number
  errorCount: number
  config: Record<string, unknown>
  features: string[]
  isPopular: boolean
  isFeatured: boolean
  logo: string
  website: string
  documentation: string
  supportEmail: string
  pricing: {
    plan: string
    monthlyRequests: number
    cost: number
  }
}

interface Webhook {
  id: string
  name: string
  url: string
  events: string[]
  headers: Record<string, string>
  secret: string
  isActive: boolean
  retryPolicy: {
    attempts: number
    backoff: 'linear' | 'exponential'
    delay: number
  }
  lastTriggered?: string
  successCount: number
  failureCount: number
  avgResponseTime: number
  createdAt: string
}

interface APIEndpoint {
  id: string
  path: string
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'
  description: string
  category: string
  isPublic: boolean
  rateLimit: {
    requests: number
    period: 'minute' | 'hour' | 'day'
    burst: number
  }
  authentication: 'api_key' | 'oauth' | 'basic' | 'none'
  requestCount: number
  errorRate: number
  avgResponseTime: number
  isDeprecated: boolean
  version: string
}

interface APIKey {
  id: string
  name: string
  key: string
  permissions: string[]
  rateLimit: {
    requests: number
    period: string
  }
  lastUsed?: string
  requestCount: number
  isActive: boolean
  expiresAt?: string
  createdAt: string
  ipWhitelist: string[]
}

interface IntegrationTemplate {
  id: string
  name: string
  description: string
  provider: string
  category: string
  setupSteps: string[]
  requiredFields: string[]
  optionalFields: string[]
  estimatedSetupTime: number
  difficulty: 'easy' | 'medium' | 'hard'
  usageCount: number
  rating: number
  reviews: number
}

interface IntegrationPerformance {
  name: string
  successRate: number
}

interface ApiUsage {
  method: string
  path: string
  requests: number
}

interface RealtimeActivity {
  message: string
  timestamp: string
  type: string
}

interface IntegrationPerformance {
  name: string
  successRate: number
}

interface ApiUsage {
  method: string
  path: string
  requests: number
}

interface RealtimeActivity {
  message: string
  timestamp: string
  type: string
}

const createIntegrationSchema = z.object({
  provider: z.string().min(1, 'Provider is required'),
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
  config: z.record(z.string(), z.any()),
})

const createWebhookSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  url: z.string().url('Valid URL is required'),
  events: z.array(z.string()).min(1, 'At least one event is required'),
  secret: z.string().optional(),
  retryAttempts: z.number().min(1).max(10),
})

const createAPIKeySchema = z.object({
  name: z.string().min(1, 'Name is required'),
  permissions: z.array(z.string()).min(1, 'At least one permission is required'),
  rateLimit: z.number().min(1),
  expiresAt: z.string().optional(),
  ipWhitelist: z.array(z.string()).optional(),
})

type CreateIntegrationForm = z.infer<typeof createIntegrationSchema>
type CreateWebhookForm = z.infer<typeof createWebhookSchema>
type CreateAPIKeyForm = z.infer<typeof createAPIKeySchema>

export default function IntegrationsPage() {
  const [selectedIntegrations, setSelectedIntegrations] = useState<string[]>([])
  const [integrationDialogOpen, setIntegrationDialogOpen] = useState(false)
  const [webhookDialogOpen, setWebhookDialogOpen] = useState(false)
  const [apiKeyDialogOpen, setApiKeyDialogOpen] = useState(false)
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [selectedStatus, setSelectedStatus] = useState('all')
  const [selectedIntegration, setSelectedIntegration] = useState<Integration | null>(null)
  const [selectedTemplate, setSelectedTemplate] = useState<IntegrationTemplate | null>(null)
  const queryClient = useQueryClient()

  const { register: registerIntegration, handleSubmit: handleIntegrationSubmit, formState: { errors: integrationErrors }, reset: resetIntegration } = useForm<CreateIntegrationForm>({
    resolver: zodResolver(createIntegrationSchema),
  })

  const { register: registerWebhook, handleSubmit: handleWebhookSubmit, formState: { errors: webhookErrors }, reset: resetWebhook } = useForm<CreateWebhookForm>({
    resolver: zodResolver(createWebhookSchema),
    defaultValues: { retryAttempts: 3 }
  })

  const { register: registerAPIKey, handleSubmit: handleAPIKeySubmit, formState: { errors: apiKeyErrors }, reset: resetAPIKey } = useForm<CreateAPIKeyForm>({
    resolver: zodResolver(createAPIKeySchema),
    defaultValues: { rateLimit: 1000 }
  })

  // Fetch data
  const { data: integrations } = useQuery({
    queryKey: ['integrations', searchQuery, selectedCategory, selectedStatus],
    queryFn: () => api.get(`/integrations?search=${searchQuery}&category=${selectedCategory}&status=${selectedStatus}`).then(res => res.data),
    refetchInterval: 30000,
  })

  const { data: webhooks } = useQuery({
    queryKey: ['webhooks'],
    queryFn: () => api.get('/integrations/webhooks').then(res => res.data),
  })

  const { data: apiEndpoints } = useQuery({
    queryKey: ['api-endpoints'],
    queryFn: () => api.get('/integrations/api/endpoints').then(res => res.data),
  })

  const { data: apiKeys } = useQuery({
    queryKey: ['api-keys'],
    queryFn: () => api.get('/integrations/api/keys').then(res => res.data),
  })

  const { data: templates } = useQuery({
    queryKey: ['integration-templates', selectedCategory],
    queryFn: () => api.get(`/integrations/templates?category=${selectedCategory}`).then(res => res.data),
  })

  const { data: marketplace } = useQuery({
    queryKey: ['integration-marketplace'],
    queryFn: () => api.get('/integrations/marketplace').then(res => res.data),
  })

  const { data: analytics } = useQuery({
    queryKey: ['integration-analytics'],
    queryFn: () => api.get('/integrations/analytics').then(res => res.data),
  })

  // Mutations
  const createIntegrationMutation = useMutation({
    mutationFn: (data: CreateIntegrationForm) => api.post('/integrations', data),
    onSuccess: () => {
      toast.success('Integration created successfully!')
      setIntegrationDialogOpen(false)
      resetIntegration()
      queryClient.invalidateQueries({ queryKey: ['integrations'] })
    },
    onError: () => {
      toast.error('Failed to create integration')
    }
  })

  const toggleIntegrationMutation = useMutation({
    mutationFn: ({ integrationId, status }: { integrationId: string, status: string }) => 
      api.patch(`/integrations/${integrationId}`, { status }),
    onSuccess: () => {
      toast.success('Integration updated!')
      queryClient.invalidateQueries({ queryKey: ['integrations'] })
    },
  })

  const syncIntegrationMutation = useMutation({
    mutationFn: (integrationId: string) => api.post(`/integrations/${integrationId}/sync`),
    onSuccess: () => {
      toast.success('Sync initiated!')
      queryClient.invalidateQueries({ queryKey: ['integrations'] })
    },
  })

  const createWebhookMutation = useMutation({
    mutationFn: (data: CreateWebhookForm) => api.post('/integrations/webhooks', data),
    onSuccess: () => {
      toast.success('Webhook created successfully!')
      setWebhookDialogOpen(false)
      resetWebhook()
      queryClient.invalidateQueries({ queryKey: ['webhooks'] })
    },
    onError: () => {
      toast.error('Failed to create webhook')
    }
  })

  const testWebhookMutation = useMutation({
    mutationFn: (webhookId: string) => api.post(`/integrations/webhooks/${webhookId}/test`),
    onSuccess: () => {
      toast.success('Test webhook sent!')
    },
  })

  const createAPIKeyMutation = useMutation({
    mutationFn: (data: CreateAPIKeyForm) => api.post('/integrations/api/keys', data),
    onSuccess: () => {
      toast.success('API key created successfully!')
      setApiKeyDialogOpen(false)
      resetAPIKey()
      queryClient.invalidateQueries({ queryKey: ['api-keys'] })
    },
    onError: () => {
      toast.error('Failed to create API key')
    }
  })

  const installFromMarketplaceMutation = useMutation({
    mutationFn: (templateId: string) => api.post(`/integrations/marketplace/${templateId}/install`),
    onSuccess: () => {
      toast.success('Integration installed successfully!')
      queryClient.invalidateQueries({ queryKey: ['integrations'] })
      setTemplateDialogOpen(false)
    },
  })

  const onCreateIntegration = (data: CreateIntegrationForm) => {
    createIntegrationMutation.mutate(data)
  }

  const onCreateWebhook = (data: CreateWebhookForm) => {
    createWebhookMutation.mutate(data)
  }

  const onCreateAPIKey = (data: CreateAPIKeyForm) => {
    createAPIKeyMutation.mutate(data)
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'default'
      case 'inactive':
        return 'secondary'
      case 'error':
        return 'destructive'
      case 'configuring':
        return 'secondary'
      default:
        return 'outline'
    }
  }

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'crm':
        return <Users className="h-4 w-4" />
      case 'payment':
        return <DollarSign className="h-4 w-4" />
      case 'communication':
        return <MessageSquare className="h-4 w-4" />
      case 'productivity':
        return <Layers className="h-4 w-4" />
      case 'analytics':
        return <TrendingUp className="h-4 w-4" />
      case 'storage':
        return <Database className="h-4 w-4" />
      default:
        return <Box className="h-4 w-4" />
    }
  }

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'easy':
        return 'default'
      case 'medium':
        return 'secondary'
      case 'hard':
        return 'destructive'
      default:
        return 'outline'
    }
  }

  const filteredIntegrations = integrations?.filter((integration: Integration) =>
    integration.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    integration.description.toLowerCase().includes(searchQuery.toLowerCase())
  )

  // Real-time updates
  useEffect(() => {
    const interval = setInterval(() => {
      queryClient.invalidateQueries({ queryKey: ['integrations'] })
      queryClient.invalidateQueries({ queryKey: ['integration-analytics'] })
    }, 30000)

    return () => clearInterval(interval)
  }, [queryClient])

  return (
    <div className="flex-1 space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Integration Hub</h2>
          <p className="text-muted-foreground">
            Connect with third-party services and manage your API ecosystem
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Badge variant="outline" className="flex items-center space-x-1">
            <Plug className="h-3 w-3" />
            <span>{integrations?.filter((i: Integration) => i.status === 'active').length || 0} active</span>
          </Badge>
          <Button variant="outline" onClick={() => setTemplateDialogOpen(true)}>
            <Package className="mr-2 h-4 w-4" />
            Browse Marketplace
          </Button>
        </div>
      </div>

      {/* Analytics Overview */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Integrations</CardTitle>
            <Plug className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics?.totalIntegrations || 0}</div>
            <p className="text-xs text-muted-foreground">
              +{analytics?.integrationGrowth || 0}% from last month
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">API Requests</CardTitle>
            <Globe className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics?.apiRequests || 0}</div>
            <p className="text-xs text-muted-foreground">
              {analytics?.apiRequestsGrowth || 0}% from last week
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
            <CheckCircle className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics?.successRate || 0}%</div>
            <p className="text-xs text-muted-foreground">
              +{analytics?.successRateGrowth || 0}% from last week
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Webhooks</CardTitle>
            <Webhook className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{webhooks?.filter((w: Webhook) => w.isActive).length || 0}</div>
            <p className="text-xs text-muted-foreground">
              of {webhooks?.length || 0} total webhooks
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="integrations" className="space-y-4">
        <TabsList>
          <TabsTrigger value="integrations">Integrations</TabsTrigger>
          <TabsTrigger value="webhooks">Webhooks</TabsTrigger>
          <TabsTrigger value="api">API Management</TabsTrigger>
          <TabsTrigger value="marketplace">Marketplace</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="integrations" className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search integrations..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 w-64"
                />
              </div>
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger className="w-40">
                  <Filter className="mr-2 h-4 w-4" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  <SelectItem value="crm">CRM</SelectItem>
                  <SelectItem value="payment">Payment</SelectItem>
                  <SelectItem value="communication">Communication</SelectItem>
                  <SelectItem value="productivity">Productivity</SelectItem>
                  <SelectItem value="analytics">Analytics</SelectItem>
                  <SelectItem value="storage">Storage</SelectItem>
                </SelectContent>
              </Select>
              <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                  <SelectItem value="error">Error</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Dialog open={integrationDialogOpen} onOpenChange={setIntegrationDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Integration
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Create Custom Integration</DialogTitle>
                  <DialogDescription>
                    Set up a custom integration with your preferred service
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleIntegrationSubmit(onCreateIntegration)} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="provider">Provider</Label>
                      <Select {...registerIntegration('provider')}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select provider" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="salesforce">Salesforce</SelectItem>
                          <SelectItem value="hubspot">HubSpot</SelectItem>
                          <SelectItem value="pipedrive">Pipedrive</SelectItem>
                          <SelectItem value="slack">Slack</SelectItem>
                          <SelectItem value="zapier">Zapier</SelectItem>
                          <SelectItem value="webhook">Custom Webhook</SelectItem>
                          <SelectItem value="custom">Custom API</SelectItem>
                        </SelectContent>
                      </Select>
                      {integrationErrors.provider && (
                        <p className="text-sm text-red-500 mt-1">{integrationErrors.provider.message}</p>
                      )}
                    </div>
                    <div>
                      <Label htmlFor="name">Integration Name</Label>
                      <Input
                        id="name"
                        {...registerIntegration('name')}
                        placeholder="My CRM Integration"
                      />
                      {integrationErrors.name && (
                        <p className="text-sm text-red-500 mt-1">{integrationErrors.name.message}</p>
                      )}
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                      id="description"
                      {...registerIntegration('description')}
                      placeholder="Describe what this integration does..."
                      rows={2}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>API Key</Label>
                      <Input placeholder="Enter your API key" />
                    </div>
                    <div>
                      <Label>API Secret</Label>
                      <Input type="password" placeholder="Enter your API secret" />
                    </div>
                  </div>
                  <div>
                    <Label>Base URL</Label>
                    <Input placeholder="https://api.example.com/v1" />
                  </div>
                  <div>
                    <Label>Sync Settings</Label>
                    <div className="space-y-2 mt-2">
                      <div className="flex items-center space-x-2">
                        <Checkbox id="autoSync" />
                        <Label htmlFor="autoSync" className="text-sm">Enable automatic sync</Label>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <Label className="text-xs">Sync Frequency</Label>
                          <Select>
                            <SelectTrigger>
                              <SelectValue placeholder="Select frequency" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="5min">Every 5 minutes</SelectItem>
                              <SelectItem value="15min">Every 15 minutes</SelectItem>
                              <SelectItem value="1hour">Every hour</SelectItem>
                              <SelectItem value="6hours">Every 6 hours</SelectItem>
                              <SelectItem value="24hours">Daily</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label className="text-xs">Batch Size</Label>
                          <Input type="number" placeholder="100" defaultValue="100" />
                        </div>
                      </div>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setIntegrationDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button type="submit" disabled={createIntegrationMutation.isPending}>
                      {createIntegrationMutation.isPending ? 'Creating...' : 'Create Integration'}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredIntegrations?.map((integration: Integration) => (
              <Card key={integration.id} className="hover:shadow-md transition-shadow">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={integration.logo} />
                        <AvatarFallback>{integration.name.slice(0, 2).toUpperCase()}</AvatarFallback>
                      </Avatar>
                      <div>
                        <CardTitle className="text-base">{integration.name}</CardTitle>
                        <div className="flex items-center space-x-2">
                          {getCategoryIcon(integration.category)}
                          <span className="text-xs text-muted-foreground">{integration.provider}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-1">
                      {integration.isPopular && <Star className="h-4 w-4 text-yellow-500" />}
                      {integration.isFeatured && <Heart className="h-4 w-4 text-red-500" />}
                    </div>
                  </div>
                  <CardDescription className="line-clamp-2">
                    {integration.description}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Badge variant={getStatusColor(integration.status)}>
                        {integration.status}
                      </Badge>
                      <Switch
                        checked={integration.status === 'active'}
                        onCheckedChange={(checked) => toggleIntegrationMutation.mutate({ 
                          integrationId: integration.id, 
                          status: checked ? 'active' : 'inactive' 
                        })}
                      />
                    </div>
                    
                    {integration.status === 'active' && (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">Last Sync:</span>
                          <span>{integration.lastSync}</span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">Records:</span>
                          <span>{integration.syncedRecords.toLocaleString()}</span>
                        </div>
                        {integration.errorCount > 0 && (
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">Errors:</span>
                            <Badge variant="destructive" className="text-xs">
                              {integration.errorCount}
                            </Badge>
                          </div>
                        )}
                      </div>
                    )}

                    <div className="flex space-x-2">
                      <Button variant="outline" size="sm" className="flex-1">
                        <Settings className="mr-1 h-3 w-3" />
                        Configure
                      </Button>
                      {integration.status === 'active' && (
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="flex-1"
                          onClick={() => syncIntegrationMutation.mutate(integration.id)}
                        >
                          <RefreshCw className="mr-1 h-3 w-3" />
                          Sync
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="webhooks" className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium">Webhook Management</h3>
            <Dialog open={webhookDialogOpen} onOpenChange={setWebhookDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  Create Webhook
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Create Webhook</DialogTitle>
                  <DialogDescription>
                    Set up a webhook to receive real-time notifications
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleWebhookSubmit(onCreateWebhook)} className="space-y-4">
                  <div>
                    <Label htmlFor="name">Webhook Name</Label>
                    <Input
                      id="name"
                      {...registerWebhook('name')}
                      placeholder="Customer Updates Webhook"
                    />
                    {webhookErrors.name && (
                      <p className="text-sm text-red-500 mt-1">{webhookErrors.name.message}</p>
                    )}
                  </div>
                  <div>
                    <Label htmlFor="url">Endpoint URL</Label>
                    <Input
                      id="url"
                      {...registerWebhook('url')}
                      placeholder="https://your-app.com/webhooks/syncquote"
                    />
                    {webhookErrors.url && (
                      <p className="text-sm text-red-500 mt-1">{webhookErrors.url.message}</p>
                    )}
                  </div>
                  <div>
                    <Label>Events to Subscribe</Label>
                    <div className="grid grid-cols-2 gap-2 mt-2">
                      {['proposal.created', 'proposal.updated', 'proposal.approved', 'proposal.signed', 'payment.received', 'user.created'].map(event => (
                        <div key={event} className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            id={event}
                            {...registerWebhook('events')}
                            value={event}
                          />
                          <Label htmlFor={event} className="text-sm">{event}</Label>
                        </div>
                      ))}
                    </div>
                    {webhookErrors.events && (
                      <p className="text-sm text-red-500 mt-1">{webhookErrors.events.message}</p>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="secret">Secret Key (Optional)</Label>
                      <Input
                        id="secret"
                        {...registerWebhook('secret')}
                        placeholder="webhook_secret_123"
                        type="password"
                      />
                    </div>
                    <div>
                      <Label htmlFor="retryAttempts">Retry Attempts</Label>
                      <Input
                        id="retryAttempts"
                        type="number"
                        {...registerWebhook('retryAttempts')}
                        min="1"
                        max="10"
                      />
                    </div>
                  </div>
                  <div>
                    <Label>Headers (Optional)</Label>
                    <div className="space-y-2 mt-2">
                      <div className="grid grid-cols-2 gap-2">
                        <Input placeholder="Header Name" />
                        <Input placeholder="Header Value" />
                      </div>
                      <Button type="button" variant="outline" size="sm">
                        <Plus className="mr-1 h-3 w-3" />
                        Add Header
                      </Button>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setWebhookDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button type="submit" disabled={createWebhookMutation.isPending}>
                      {createWebhookMutation.isPending ? 'Creating...' : 'Create Webhook'}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Webhook</TableHead>
                  <TableHead>Endpoint</TableHead>
                  <TableHead>Events</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Performance</TableHead>
                  <TableHead className="w-[100px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {webhooks?.map((webhook: Webhook) => (
                  <TableRow key={webhook.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{webhook.name}</p>
                        <p className="text-sm text-muted-foreground">
                          Created {webhook.createdAt}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-2">
                        <code className="bg-muted px-2 py-1 rounded text-xs">
                          {webhook.url}
                        </code>
                        <Button variant="ghost" size="sm">
                          <ExternalLink className="h-3 w-3" />
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {webhook.events.slice(0, 2).map(event => (
                          <Badge key={event} variant="outline" className="text-xs">
                            {event}
                          </Badge>
                        ))}
                        {webhook.events.length > 2 && (
                          <Badge variant="outline" className="text-xs">
                            +{webhook.events.length - 2}
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={webhook.isActive ? 'default' : 'secondary'}>
                        {webhook.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm space-y-1">
                        <div className="flex justify-between">
                          <span>Success:</span>
                          <span className="text-green-600">{webhook.successCount}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Failed:</span>
                          <span className="text-red-600">{webhook.failureCount}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Avg Time:</span>
                          <span>{webhook.avgResponseTime}ms</span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex space-x-1">
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => testWebhookMutation.mutate(webhook.id)}
                        >
                          <Send className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm">
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="api" className="space-y-4">
          <div className="grid gap-6">
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium">API Keys</h3>
                <Dialog open={apiKeyDialogOpen} onOpenChange={setApiKeyDialogOpen}>
                  <DialogTrigger asChild>
                    <Button>
                      <Plus className="mr-2 h-4 w-4" />
                      Generate API Key
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Generate API Key</DialogTitle>
                      <DialogDescription>
                        Create a new API key for accessing your SyncQuote data
                      </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleAPIKeySubmit(onCreateAPIKey)} className="space-y-4">
                      <div>
                        <Label htmlFor="name">Key Name</Label>
                        <Input
                          id="name"
                          {...registerAPIKey('name')}
                          placeholder="Production API Key"
                        />
                        {apiKeyErrors.name && (
                          <p className="text-sm text-red-500 mt-1">{apiKeyErrors.name.message}</p>
                        )}
                      </div>
                      <div>
                        <Label>Permissions</Label>
                        <div className="grid grid-cols-2 gap-2 mt-2">
                          {['read:proposals', 'write:proposals', 'read:users', 'write:users', 'read:analytics', 'webhooks'].map(permission => (
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
                        {apiKeyErrors.permissions && (
                          <p className="text-sm text-red-500 mt-1">{apiKeyErrors.permissions.message}</p>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="rateLimit">Rate Limit (requests/hour)</Label>
                          <Input
                            id="rateLimit"
                            type="number"
                            {...registerAPIKey('rateLimit')}
                          />
                        </div>
                        <div>
                          <Label htmlFor="expiresAt">Expires At (Optional)</Label>
                          <Input
                            id="expiresAt"
                            type="datetime-local"
                            {...registerAPIKey('expiresAt')}
                          />
                        </div>
                      </div>
                      <div>
                        <Label>IP Whitelist (Optional)</Label>
                        <Textarea
                          placeholder="192.168.1.1&#10;10.0.0.0/8"
                          className="text-sm"
                          rows={3}
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                          One IP address or CIDR range per line
                        </p>
                      </div>
                      <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => setApiKeyDialogOpen(false)}>
                          Cancel
                        </Button>
                        <Button type="submit" disabled={createAPIKeyMutation.isPending}>
                          {createAPIKeyMutation.isPending ? 'Generating...' : 'Generate Key'}
                        </Button>
                      </DialogFooter>
                    </form>
                  </DialogContent>
                </Dialog>
              </div>

              <Card>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Key Name</TableHead>
                      <TableHead>Permissions</TableHead>
                      <TableHead>Usage</TableHead>
                      <TableHead>Rate Limit</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="w-[70px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {apiKeys?.map((apiKey: APIKey) => (
                      <TableRow key={apiKey.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{apiKey.name}</p>
                            <code className="text-xs bg-muted px-1 rounded">
                              {apiKey.key.slice(0, 8)}...
                            </code>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {apiKey.permissions.slice(0, 2).map(permission => (
                              <Badge key={permission} variant="outline" className="text-xs">
                                {permission}
                              </Badge>
                            ))}
                            {apiKey.permissions.length > 2 && (
                              <Badge variant="outline" className="text-xs">
                                +{apiKey.permissions.length - 2}
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            <p>{apiKey.requestCount.toLocaleString()} requests</p>
                            <p className="text-muted-foreground">
                              Last used: {apiKey.lastUsed || 'Never'}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            <p>{apiKey.rateLimit.requests.toLocaleString()}/{apiKey.rateLimit.period}</p>
                            <Progress 
                              value={(apiKey.requestCount / apiKey.rateLimit.requests) * 100} 
                              className="h-2 mt-1"
                            />
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={apiKey.isActive ? 'default' : 'secondary'}>
                            {apiKey.isActive ? 'Active' : 'Inactive'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Button variant="ghost" size="sm">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Card>
            </div>

            <div>
              <h3 className="text-lg font-medium mb-4">API Endpoints</h3>
              <Card>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Endpoint</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Usage</TableHead>
                      <TableHead>Performance</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {apiEndpoints?.map((endpoint: APIEndpoint) => (
                      <TableRow key={endpoint.id}>
                        <TableCell>
                          <div className="flex items-center space-x-2">
                            <Badge variant="outline" className="text-xs">
                              {endpoint.method}
                            </Badge>
                            <code className="text-sm">{endpoint.path}</code>
                          </div>
                        </TableCell>
                        <TableCell>
                          <p className="text-sm">{endpoint.description}</p>
                          <Badge variant="outline" className="text-xs mt-1">
                            {endpoint.category}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            <p>{endpoint.requestCount.toLocaleString()} requests</p>
                            <p className="text-muted-foreground">
                              {endpoint.rateLimit.requests}/{endpoint.rateLimit.period}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            <p>Avg: {endpoint.avgResponseTime}ms</p>
                            <p className="text-muted-foreground">
                              Error: {endpoint.errorRate}%
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center space-x-2">
                            <Badge variant={endpoint.isPublic ? 'default' : 'secondary'}>
                              {endpoint.isPublic ? 'Public' : 'Private'}
                            </Badge>
                            {endpoint.isDeprecated && (
                              <Badge variant="destructive">Deprecated</Badge>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="marketplace" className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium">Integration Marketplace</h3>
            <div className="flex items-center space-x-2">
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  <SelectItem value="crm">CRM</SelectItem>
                  <SelectItem value="payment">Payment</SelectItem>
                  <SelectItem value="communication">Communication</SelectItem>
                  <SelectItem value="productivity">Productivity</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {templates?.map((template: IntegrationTemplate) => (
              <Card key={template.id} className="cursor-pointer hover:shadow-md transition-shadow">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">{template.name}</CardTitle>
                    <div className="flex items-center space-x-1">
                      <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                      <span className="text-sm">{template.rating}</span>
                    </div>
                  </div>
                  <CardDescription>
                    <div className="flex items-center space-x-2">
                      {getCategoryIcon(template.category)}
                      <span>{template.provider}</span>
                    </div>
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {template.description}
                    </p>
                    
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center space-x-1">
                        <Clock className="h-3 w-3" />
                        <span>{template.estimatedSetupTime} min</span>
                      </div>
                      <Badge variant={getDifficultyColor(template.difficulty)}>
                        {template.difficulty}
                      </Badge>
                    </div>

                    <div className="flex items-center justify-between text-sm text-muted-foreground">
                      <span>{template.usageCount} installs</span>
                      <span>{template.reviews} reviews</span>
                    </div>

                    <Dialog open={templateDialogOpen && selectedTemplate?.id === template.id} onOpenChange={(open) => {
                      setTemplateDialogOpen(open)
                      if (!open) setSelectedTemplate(null)
                    }}>
                      <DialogTrigger asChild>
                        <Button 
                          variant="outline" 
                          className="w-full"
                          onClick={() => setSelectedTemplate(template)}
                        >
                          <Download className="mr-2 h-4 w-4" />
                          Install
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-2xl">
                        <DialogHeader>
                          <DialogTitle>Install {template.name}</DialogTitle>
                          <DialogDescription>
                            {template.description}
                          </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4">
                          <div>
                            <h4 className="font-medium mb-2">Setup Steps:</h4>
                            <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground">
                              {template.setupSteps.map((step, index) => (
                                <li key={index}>{step}</li>
                              ))}
                            </ol>
                          </div>
                          
                          <div>
                            <h4 className="font-medium mb-2">Required Configuration:</h4>
                            <div className="grid grid-cols-2 gap-2">
                              {template.requiredFields.map(field => (
                                <div key={field}>
                                  <Label className="text-xs">{field}</Label>
                                  <Input placeholder={`Enter ${field}`} />
                                </div>
                              ))}
                            </div>
                          </div>

                          {template.optionalFields.length > 0 && (
                            <div>
                              <h4 className="font-medium mb-2">Optional Configuration:</h4>
                              <div className="grid grid-cols-2 gap-2">
                                {template.optionalFields.map(field => (
                                  <div key={field}>
                                    <Label className="text-xs">{field}</Label>
                                    <Input placeholder={`Enter ${field} (optional)`} />
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                        <DialogFooter>
                          <Button variant="outline" onClick={() => setTemplateDialogOpen(false)}>
                            Cancel
                          </Button>
                          <Button onClick={() => installFromMarketplaceMutation.mutate(template.id)}>
                            {installFromMarketplaceMutation.isPending ? 'Installing...' : 'Install Integration'}
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="analytics" className="space-y-4">
          <div className="grid gap-6">
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Integration Performance</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {analytics?.integrationPerformance?.map((integration: IntegrationPerformance) => (
                      <div key={integration.name} className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span>{integration.name}</span>
                          <span>{integration.successRate}% success</span>
                        </div>
                        <Progress value={integration.successRate} className="h-2" />
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>API Usage Trends</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {analytics?.apiUsage?.map((endpoint: ApiUsage) => (
                      <div key={endpoint.path} className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="font-mono text-xs">{endpoint.method} {endpoint.path}</span>
                          <span>{endpoint.requests} requests</span>
                        </div>
                        <Progress 
                          value={(endpoint.requests / analytics.totalRequests) * 100} 
                          className="h-2" 
                        />
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Real-time Activity</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {analytics?.realtimeActivity?.map((activity: RealtimeActivity, index: number) => (
                    <div key={index} className="flex items-center space-x-3 p-3 border rounded">
                      <div className="h-2 w-2 bg-green-500 rounded-full" />
                      <div className="flex-1">
                        <p className="text-sm font-medium">{activity.message}</p>
                        <p className="text-xs text-muted-foreground">{activity.timestamp}</p>
                      </div>
                      <Badge variant="outline" className="text-xs">
                        {activity.type}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}