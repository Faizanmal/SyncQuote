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
import { 
  Bell, 
  BellRing, 
  Mail, 
  MessageSquare, 
  Smartphone, 
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
  Zap,
  Calendar,
  FileText,
  DollarSign,
  UserPlus,
  Activity,
  TrendingUp,
  Share,
  Download,
  Play,
  Pause,
  MoreHorizontal
} from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { api } from '@/lib/api'

interface Notification {
  id: string
  type: 'info' | 'success' | 'warning' | 'error'
  title: string
  message: string
  category: string
  priority: 'low' | 'medium' | 'high' | 'urgent'
  read: boolean
  channels: ('email' | 'push' | 'sms' | 'in-app')[]
  userId: string
  metadata: Record<string, unknown>
  createdAt: string
  readAt?: string
}

interface NotificationRule {
  id: string
  name: string
  description: string
  event: string
  conditions: NotificationCondition[]
  actions: NotificationAction[]
  enabled: boolean
  priority: 'low' | 'medium' | 'high' | 'urgent'
  createdAt: string
  triggeredCount: number
}

interface NotificationCondition {
  field: string
  operator: 'equals' | 'contains' | 'greater_than' | 'less_than'
  value: string
}

interface NotificationAction {
  type: 'email' | 'push' | 'sms' | 'webhook' | 'slack'
  target: string
  template?: string
  delay?: number
}

interface EmailCampaign {
  id: string
  name: string
  subject: string
  content: string
  recipients: string[]
  status: 'draft' | 'scheduled' | 'sending' | 'sent' | 'paused'
  scheduledAt?: string
  sentAt?: string
  openRate: number
  clickRate: number
  deliveryRate: number
  createdAt: string
}

interface NotificationTemplate {
  id: string
  name: string
  type: 'email' | 'push' | 'sms'
  subject?: string
  content: string
  variables: string[]
  category: string
  isDefault: boolean
}

const createRuleSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
  event: z.string().min(1, 'Event is required'),
  priority: z.enum(['low', 'medium', 'high', 'urgent']),
  enabled: z.boolean().optional(),
})

const createCampaignSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  subject: z.string().min(1, 'Subject is required'),
  content: z.string().min(1, 'Content is required'),
  recipients: z.array(z.string()).min(1, 'At least one recipient is required'),
  scheduledAt: z.string().optional(),
})

type CreateRuleForm = z.infer<typeof createRuleSchema>
type CreateCampaignForm = z.infer<typeof createCampaignSchema>

export default function NotificationsPage() {
  const [selectedNotifications, setSelectedNotifications] = useState<string[]>([])
  const [ruleDialogOpen, setRuleDialogOpen] = useState(false)
  const [campaignDialogOpen, setCampaignDialogOpen] = useState(false)
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedFilter, setSelectedFilter] = useState('all')
  const [selectedRule, setSelectedRule] = useState<NotificationRule | null>(null)
  const queryClient = useQueryClient()

  const { register: registerRule, handleSubmit: handleRuleSubmit, formState: { errors: ruleErrors }, reset: resetRule } = useForm<CreateRuleForm>({
    resolver: zodResolver(createRuleSchema),
    defaultValues: { priority: 'medium', enabled: true }
  })

  const { register: registerCampaign, handleSubmit: handleCampaignSubmit, formState: { errors: campaignErrors }, reset: resetCampaign } = useForm<CreateCampaignForm>({
    resolver: zodResolver(createCampaignSchema),
  })

  // Fetch data
  const { data: notifications } = useQuery({
    queryKey: ['notifications', searchQuery, selectedFilter],
    queryFn: () => api.get(`/notifications?search=${searchQuery}&filter=${selectedFilter}`).then(res => res.data),
    refetchInterval: 30000, // Refresh every 30 seconds
  })

  const { data: rules } = useQuery({
    queryKey: ['notification-rules'],
    queryFn: () => api.get('/notifications/rules').then(res => res.data),
  })

  const { data: campaigns } = useQuery({
    queryKey: ['email-campaigns'],
    queryFn: () => api.get('/notifications/campaigns').then(res => res.data),
  })

  const { data: templates } = useQuery({
    queryKey: ['notification-templates'],
    queryFn: () => api.get('/notifications/templates').then(res => res.data),
  })

  const { data: settings } = useQuery({
    queryKey: ['notification-settings'],
    queryFn: () => api.get('/notifications/settings').then(res => res.data),
  })

  const { data: analytics } = useQuery({
    queryKey: ['notification-analytics'],
    queryFn: () => api.get('/notifications/analytics').then(res => res.data),
  })

  // Mutations
  const markAsReadMutation = useMutation({
    mutationFn: (notificationIds: string[]) => api.patch('/notifications/mark-read', { ids: notificationIds }),
    onSuccess: () => {
      toast.success('Notifications marked as read!')
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
      setSelectedNotifications([])
    },
  })

  const deleteNotificationsMutation = useMutation({
    mutationFn: (notificationIds: string[]) => api.delete('/notifications', { data: { ids: notificationIds } }),
    onSuccess: () => {
      toast.success('Notifications deleted!')
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
      setSelectedNotifications([])
    },
  })

  const createRuleMutation = useMutation({
    mutationFn: (data: CreateRuleForm) => api.post('/notifications/rules', data),
    onSuccess: () => {
      toast.success('Notification rule created!')
      setRuleDialogOpen(false)
      resetRule()
      queryClient.invalidateQueries({ queryKey: ['notification-rules'] })
    },
    onError: () => {
      toast.error('Failed to create notification rule')
    }
  })

  const toggleRuleMutation = useMutation({
    mutationFn: ({ ruleId, enabled }: { ruleId: string, enabled: boolean }) => 
      api.patch(`/notifications/rules/${ruleId}`, { enabled }),
    onSuccess: () => {
      toast.success('Rule updated!')
      queryClient.invalidateQueries({ queryKey: ['notification-rules'] })
    },
  })

  const createCampaignMutation = useMutation({
    mutationFn: (data: CreateCampaignForm) => api.post('/notifications/campaigns', data),
    onSuccess: () => {
      toast.success('Email campaign created!')
      setCampaignDialogOpen(false)
      resetCampaign()
      queryClient.invalidateQueries({ queryKey: ['email-campaigns'] })
    },
    onError: () => {
      toast.error('Failed to create email campaign')
    }
  })

  const sendCampaignMutation = useMutation({
    mutationFn: (campaignId: string) => api.post(`/notifications/campaigns/${campaignId}/send`),
    onSuccess: () => {
      toast.success('Campaign sent!')
      queryClient.invalidateQueries({ queryKey: ['email-campaigns'] })
    },
  })

  const pauseCampaignMutation = useMutation({
    mutationFn: (campaignId: string) => api.post(`/notifications/campaigns/${campaignId}/pause`),
    onSuccess: () => {
      toast.success('Campaign paused!')
      queryClient.invalidateQueries({ queryKey: ['email-campaigns'] })
    },
  })

  const updateSettingsMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => api.patch('/notifications/settings', data),
    onSuccess: () => {
      toast.success('Settings updated!')
      queryClient.invalidateQueries({ queryKey: ['notification-settings'] })
    },
  })

  const testNotificationMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => api.post('/notifications/test', data),
    onSuccess: () => {
      toast.success('Test notification sent!')
    },
  })

  const onCreateRule = (data: CreateRuleForm) => {
    createRuleMutation.mutate(data)
  }

  const onCreateCampaign = (data: CreateCampaignForm) => {
    createCampaignMutation.mutate(data)
  }

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case 'warning':
        return <AlertCircle className="h-4 w-4 text-yellow-500" />
      case 'error':
        return <XCircle className="h-4 w-4 text-red-500" />
      default:
        return <Info className="h-4 w-4 text-blue-500" />
    }
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent':
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

  const getCampaignStatusColor = (status: string) => {
    switch (status) {
      case 'sent':
        return 'default'
      case 'sending':
        return 'secondary'
      case 'scheduled':
        return 'secondary'
      case 'paused':
        return 'destructive'
      case 'draft':
        return 'outline'
      default:
        return 'outline'
    }
  }

  const filteredNotifications = notifications?.filter((notification: Notification) =>
    notification.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    notification.message.toLowerCase().includes(searchQuery.toLowerCase())
  )

  // Real-time notifications via WebSocket (simulated)
  useEffect(() => {
    const interval = setInterval(() => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
    }, 30000)

    return () => clearInterval(interval)
  }, [queryClient])

  return (
    <div className="flex-1 space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Notifications Center</h2>
          <p className="text-muted-foreground">
            Manage notifications, email campaigns, and communication rules
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Badge variant="outline" className="flex items-center space-x-1">
            <Bell className="h-3 w-3" />
            <span>{notifications?.filter((n: Notification) => !n.read).length || 0} unread</span>
          </Badge>
          <Button variant="outline" onClick={() => testNotificationMutation.mutate({ type: 'test' })}>
            <Send className="mr-2 h-4 w-4" />
            Test Notification
          </Button>
        </div>
      </div>

      {/* Analytics Overview */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Sent</CardTitle>
            <Send className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics?.totalSent || 0}</div>
            <p className="text-xs text-muted-foreground">
              +{analytics?.sentGrowth || 0}% from last month
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Open Rate</CardTitle>
            <Eye className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics?.openRate || 0}%</div>
            <p className="text-xs text-muted-foreground">
              +{analytics?.openRateGrowth || 0}% from last month
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Click Rate</CardTitle>
            <Target className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics?.clickRate || 0}%</div>
            <p className="text-xs text-muted-foreground">
              +{analytics?.clickRateGrowth || 0}% from last month
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Rules</CardTitle>
            <Zap className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{rules?.filter((r: NotificationRule) => r.enabled).length || 0}</div>
            <p className="text-xs text-muted-foreground">
              of {rules?.length || 0} total rules
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="notifications" className="space-y-4">
        <TabsList>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
          <TabsTrigger value="rules">Rules & Automation</TabsTrigger>
          <TabsTrigger value="campaigns">Email Campaigns</TabsTrigger>
          <TabsTrigger value="templates">Templates</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="notifications" className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search notifications..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 w-64"
                />
              </div>
              <Select value={selectedFilter} onValueChange={setSelectedFilter}>
                <SelectTrigger className="w-40">
                  <Filter className="mr-2 h-4 w-4" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="unread">Unread</SelectItem>
                  <SelectItem value="read">Read</SelectItem>
                  <SelectItem value="high">High Priority</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center space-x-2">
              {selectedNotifications.length > 0 && (
                <>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => markAsReadMutation.mutate(selectedNotifications)}
                  >
                    <CheckCircle className="mr-2 h-4 w-4" />
                    Mark Read
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => deleteNotificationsMutation.mutate(selectedNotifications)}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete
                  </Button>
                </>
              )}
            </div>
          </div>

          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <Checkbox 
                      checked={selectedNotifications.length === filteredNotifications?.length}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setSelectedNotifications(filteredNotifications?.map((n: Notification) => n.id) || [])
                        } else {
                          setSelectedNotifications([])
                        }
                      }}
                    />
                  </TableHead>
                  <TableHead>Notification</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Channels</TableHead>
                  <TableHead>Time</TableHead>
                  <TableHead className="w-[70px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredNotifications?.map((notification: Notification) => (
                  <TableRow 
                    key={notification.id} 
                    className={notification.read ? 'opacity-60' : ''}
                  >
                    <TableCell>
                      <Checkbox 
                        checked={selectedNotifications.includes(notification.id)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setSelectedNotifications([...selectedNotifications, notification.id])
                          } else {
                            setSelectedNotifications(selectedNotifications.filter(id => id !== notification.id))
                          }
                        }}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-start space-x-3">
                        {getNotificationIcon(notification.type)}
                        <div className="flex-1">
                          <p className={`font-medium ${!notification.read ? 'text-foreground' : 'text-muted-foreground'}`}>
                            {notification.title}
                          </p>
                          <p className="text-sm text-muted-foreground line-clamp-2">
                            {notification.message}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{notification.category}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={getPriorityColor(notification.priority)}>
                        {notification.priority}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex space-x-1">
                        {notification.channels.includes('email') && <Mail className="h-4 w-4 text-muted-foreground" />}
                        {notification.channels.includes('push') && <Smartphone className="h-4 w-4 text-muted-foreground" />}
                        {notification.channels.includes('sms') && <MessageSquare className="h-4 w-4 text-muted-foreground" />}
                        {notification.channels.includes('in-app') && <Bell className="h-4 w-4 text-muted-foreground" />}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-1 text-sm text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        <span>{notification.createdAt}</span>
                      </div>
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
        </TabsContent>

        <TabsContent value="rules" className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium">Notification Rules</h3>
            <Dialog open={ruleDialogOpen} onOpenChange={setRuleDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  Create Rule
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Create Notification Rule</DialogTitle>
                  <DialogDescription>
                    Set up automated notifications based on specific events and conditions
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleRuleSubmit(onCreateRule)} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="name">Rule Name</Label>
                      <Input
                        id="name"
                        {...registerRule('name')}
                        placeholder="New proposal notification"
                      />
                      {ruleErrors.name && (
                        <p className="text-sm text-red-500 mt-1">{ruleErrors.name.message}</p>
                      )}
                    </div>
                    <div>
                      <Label htmlFor="priority">Priority</Label>
                      <Select {...registerRule('priority')}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="low">Low</SelectItem>
                          <SelectItem value="medium">Medium</SelectItem>
                          <SelectItem value="high">High</SelectItem>
                          <SelectItem value="urgent">Urgent</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                      id="description"
                      {...registerRule('description')}
                      placeholder="Describe what this rule does..."
                      rows={2}
                    />
                  </div>
                  <div>
                    <Label htmlFor="event">Trigger Event</Label>
                    <Select {...registerRule('event')}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select an event" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="proposal.created">Proposal Created</SelectItem>
                        <SelectItem value="proposal.approved">Proposal Approved</SelectItem>
                        <SelectItem value="proposal.viewed">Proposal Viewed</SelectItem>
                        <SelectItem value="payment.received">Payment Received</SelectItem>
                        <SelectItem value="user.registered">User Registered</SelectItem>
                        <SelectItem value="team.invited">Team Member Invited</SelectItem>
                      </SelectContent>
                    </Select>
                    {ruleErrors.event && (
                      <p className="text-sm text-red-500 mt-1">{ruleErrors.event.message}</p>
                    )}
                  </div>
                  <div>
                    <Label>Conditions</Label>
                    <div className="space-y-2 mt-2">
                      <div className="grid grid-cols-3 gap-2 p-3 border rounded">
                        <Select>
                          <SelectTrigger>
                            <SelectValue placeholder="Field" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="amount">Amount</SelectItem>
                            <SelectItem value="status">Status</SelectItem>
                            <SelectItem value="user.role">User Role</SelectItem>
                            <SelectItem value="proposal.type">Proposal Type</SelectItem>
                          </SelectContent>
                        </Select>
                        <Select>
                          <SelectTrigger>
                            <SelectValue placeholder="Operator" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="equals">Equals</SelectItem>
                            <SelectItem value="contains">Contains</SelectItem>
                            <SelectItem value="greater_than">Greater Than</SelectItem>
                            <SelectItem value="less_than">Less Than</SelectItem>
                          </SelectContent>
                        </Select>
                        <Input placeholder="Value" />
                      </div>
                      <Button type="button" variant="outline" size="sm">
                        <Plus className="mr-1 h-3 w-3" />
                        Add Condition
                      </Button>
                    </div>
                  </div>
                  <div>
                    <Label>Actions</Label>
                    <div className="space-y-2 mt-2">
                      <div className="grid grid-cols-3 gap-2 p-3 border rounded">
                        <Select>
                          <SelectTrigger>
                            <SelectValue placeholder="Action Type" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="email">Send Email</SelectItem>
                            <SelectItem value="push">Push Notification</SelectItem>
                            <SelectItem value="sms">Send SMS</SelectItem>
                            <SelectItem value="webhook">Webhook</SelectItem>
                            <SelectItem value="slack">Slack Message</SelectItem>
                          </SelectContent>
                        </Select>
                        <Input placeholder="Target (email, webhook URL, etc.)" />
                        <Select>
                          <SelectTrigger>
                            <SelectValue placeholder="Template" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="default">Default Template</SelectItem>
                            <SelectItem value="custom">Custom Template</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <Button type="button" variant="outline" size="sm">
                        <Plus className="mr-1 h-3 w-3" />
                        Add Action
                      </Button>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="enabled"
                      {...registerRule('enabled')}
                    />
                    <Label htmlFor="enabled" className="text-sm">Enable this rule immediately</Label>
                  </div>
                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setRuleDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button type="submit" disabled={createRuleMutation.isPending}>
                      {createRuleMutation.isPending ? 'Creating...' : 'Create Rule'}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {rules?.map((rule: NotificationRule) => (
              <Card key={rule.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">{rule.name}</CardTitle>
                    <div className="flex items-center space-x-2">
                      <Badge variant={getPriorityColor(rule.priority)}>
                        {rule.priority}
                      </Badge>
                      <Switch
                        checked={rule.enabled}
                        onCheckedChange={(checked) => toggleRuleMutation.mutate({ 
                          ruleId: rule.id, 
                          enabled: checked 
                        })}
                      />
                    </div>
                  </div>
                  <CardDescription>{rule.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-center space-x-2">
                      <Zap className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">Event: {rule.event}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Activity className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">Triggered {rule.triggeredCount} times</span>
                    </div>
                    <div className="flex space-x-2">
                      <Button variant="outline" size="sm" className="flex-1">
                        <Edit className="mr-1 h-3 w-3" />
                        Edit
                      </Button>
                      <Button variant="outline" size="sm" className="flex-1">
                        <Eye className="mr-1 h-3 w-3" />
                        Test
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="campaigns" className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium">Email Campaigns</h3>
            <Dialog open={campaignDialogOpen} onOpenChange={setCampaignDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  Create Campaign
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Create Email Campaign</DialogTitle>
                  <DialogDescription>
                    Create and schedule email campaigns for your users
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleCampaignSubmit(onCreateCampaign)} className="space-y-4">
                  <div>
                    <Label htmlFor="name">Campaign Name</Label>
                    <Input
                      id="name"
                      {...registerCampaign('name')}
                      placeholder="Monthly Newsletter"
                    />
                    {campaignErrors.name && (
                      <p className="text-sm text-red-500 mt-1">{campaignErrors.name.message}</p>
                    )}
                  </div>
                  <div>
                    <Label htmlFor="subject">Email Subject</Label>
                    <Input
                      id="subject"
                      {...registerCampaign('subject')}
                      placeholder="Your Monthly Update from SyncQuote"
                    />
                    {campaignErrors.subject && (
                      <p className="text-sm text-red-500 mt-1">{campaignErrors.subject.message}</p>
                    )}
                  </div>
                  <div>
                    <Label htmlFor="content">Email Content</Label>
                    <Textarea
                      id="content"
                      {...registerCampaign('content')}
                      placeholder="Write your email content here..."
                      rows={8}
                    />
                    {campaignErrors.content && (
                      <p className="text-sm text-red-500 mt-1">{campaignErrors.content.message}</p>
                    )}
                  </div>
                  <div>
                    <Label>Recipients</Label>
                    <div className="space-y-2 mt-2">
                      {['All Users', 'Pro Users Only', 'Free Users Only', 'Trial Users', 'Inactive Users'].map(group => (
                        <div key={group} className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            id={group}
                            {...registerCampaign('recipients')}
                            value={group.toLowerCase().replace(' ', '_')}
                          />
                          <Label htmlFor={group} className="text-sm">{group}</Label>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="scheduledAt">Schedule (Optional)</Label>
                    <Input
                      id="scheduledAt"
                      type="datetime-local"
                      {...registerCampaign('scheduledAt')}
                    />
                  </div>
                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setCampaignDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button type="submit" disabled={createCampaignMutation.isPending}>
                      {createCampaignMutation.isPending ? 'Creating...' : 'Create Campaign'}
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
                  <TableHead>Campaign</TableHead>
                  <TableHead>Recipients</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Performance</TableHead>
                  <TableHead>Scheduled</TableHead>
                  <TableHead className="w-[100px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {campaigns?.map((campaign: EmailCampaign) => (
                  <TableRow key={campaign.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{campaign.name}</p>
                        <p className="text-sm text-muted-foreground">{campaign.subject}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-1">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        <span>{campaign.recipients.length}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={getCampaignStatusColor(campaign.status)}>
                        {campaign.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {campaign.status === 'sent' && (
                        <div className="text-sm">
                          <p>Open: {campaign.openRate}%</p>
                          <p>Click: {campaign.clickRate}%</p>
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      {campaign.scheduledAt && (
                        <div className="flex items-center space-x-1 text-sm text-muted-foreground">
                          <Calendar className="h-3 w-3" />
                          <span>{campaign.scheduledAt}</span>
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex space-x-1">
                        {campaign.status === 'draft' && (
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => sendCampaignMutation.mutate(campaign.id)}
                          >
                            <Send className="h-4 w-4" />
                          </Button>
                        )}
                        {campaign.status === 'sending' && (
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => pauseCampaignMutation.mutate(campaign.id)}
                          >
                            <Pause className="h-4 w-4" />
                          </Button>
                        )}
                        <Button variant="ghost" size="sm">
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm">
                          <Download className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="templates" className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium">Notification Templates</h3>
            <Dialog open={templateDialogOpen} onOpenChange={setTemplateDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  Create Template
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create Notification Template</DialogTitle>
                  <DialogDescription>
                    Create reusable templates for notifications
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label>Template Name</Label>
                    <Input placeholder="Welcome Email Template" />
                  </div>
                  <div>
                    <Label>Template Type</Label>
                    <Select>
                      <SelectTrigger>
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="email">Email</SelectItem>
                        <SelectItem value="push">Push Notification</SelectItem>
                        <SelectItem value="sms">SMS</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Subject (Email only)</Label>
                    <Input placeholder="Welcome to SyncQuote!" />
                  </div>
                  <div>
                    <Label>Content</Label>
                    <Textarea 
                      placeholder="Hello {{user.name}}, welcome to SyncQuote..."
                      rows={6}
                    />
                  </div>
                  <div>
                    <Label>Available Variables</Label>
                    <div className="flex flex-wrap gap-1 mt-2">
                      {['{{user.name}}', '{{user.email}}', '{{proposal.title}}', '{{company.name}}'].map(variable => (
                        <Badge key={variable} variant="outline" className="text-xs cursor-pointer">
                          {variable}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setTemplateDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button>Create Template</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {templates?.map((template: NotificationTemplate) => (
              <Card key={template.id} className="cursor-pointer hover:shadow-md transition-shadow">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">{template.name}</CardTitle>
                    {template.isDefault && (
                      <Badge variant="default">Default</Badge>
                    )}
                  </div>
                  <CardDescription>
                    <Badge variant="outline" className="mr-2">{template.type}</Badge>
                    {template.category}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {template.subject && (
                      <div>
                        <p className="text-sm font-medium">Subject:</p>
                        <p className="text-sm text-muted-foreground">{template.subject}</p>
                      </div>
                    )}
                    <div>
                      <p className="text-sm font-medium">Content Preview:</p>
                      <p className="text-sm text-muted-foreground line-clamp-3">
                        {template.content}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm font-medium">Variables:</p>
                      <div className="flex flex-wrap gap-1">
                        {template.variables.slice(0, 3).map(variable => (
                          <Badge key={variable} variant="outline" className="text-xs">
                            {variable}
                          </Badge>
                        ))}
                        {template.variables.length > 3 && (
                          <Badge variant="outline" className="text-xs">
                            +{template.variables.length - 3}
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="flex space-x-2">
                      <Button variant="outline" size="sm" className="flex-1">
                        <Edit className="mr-1 h-3 w-3" />
                        Edit
                      </Button>
                      <Button variant="outline" size="sm" className="flex-1">
                        <Eye className="mr-1 h-3 w-3" />
                        Preview
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="settings" className="space-y-4">
          <div className="grid gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Notification Preferences</CardTitle>
                <CardDescription>
                  Configure how and when you receive notifications
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Email Notifications</p>
                    <p className="text-sm text-muted-foreground">
                      Receive notifications via email
                    </p>
                  </div>
                  <Switch
                    checked={settings?.emailEnabled}
                    onCheckedChange={(checked) => updateSettingsMutation.mutate({ emailEnabled: checked })}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Push Notifications</p>
                    <p className="text-sm text-muted-foreground">
                      Receive browser push notifications
                    </p>
                  </div>
                  <Switch
                    checked={settings?.pushEnabled}
                    onCheckedChange={(checked) => updateSettingsMutation.mutate({ pushEnabled: checked })}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">SMS Notifications</p>
                    <p className="text-sm text-muted-foreground">
                      Receive critical notifications via SMS
                    </p>
                  </div>
                  <Switch
                    checked={settings?.smsEnabled}
                    onCheckedChange={(checked) => updateSettingsMutation.mutate({ smsEnabled: checked })}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Notification Frequency</Label>
                  <Select 
                    value={settings?.frequency} 
                    onValueChange={(value) => updateSettingsMutation.mutate({ frequency: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="real-time">Real-time</SelectItem>
                      <SelectItem value="hourly">Hourly Digest</SelectItem>
                      <SelectItem value="daily">Daily Digest</SelectItem>
                      <SelectItem value="weekly">Weekly Digest</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Quiet Hours</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-xs">Start Time</Label>
                      <Input 
                        type="time" 
                        value={settings?.quietHours?.start}
                        onChange={(e) => updateSettingsMutation.mutate({ 
                          quietHours: { ...settings?.quietHours, start: e.target.value }
                        })}
                      />
                    </div>
                    <div>
                      <Label className="text-xs">End Time</Label>
                      <Input 
                        type="time" 
                        value={settings?.quietHours?.end}
                        onChange={(e) => updateSettingsMutation.mutate({ 
                          quietHours: { ...settings?.quietHours, end: e.target.value }
                        })}
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Channel Configuration</CardTitle>
                <CardDescription>
                  Configure notification channels and their settings
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>SMS Phone Number</Label>
                  <Input 
                    placeholder="+1234567890" 
                    value={settings?.phoneNumber}
                    onChange={(e) => updateSettingsMutation.mutate({ phoneNumber: e.target.value })}
                  />
                </div>
                
                <div>
                  <Label>Slack Webhook URL</Label>
                  <Input 
                    placeholder="https://hooks.slack.com/services/..." 
                    value={settings?.slackWebhook}
                    onChange={(e) => updateSettingsMutation.mutate({ slackWebhook: e.target.value })}
                  />
                </div>

                <div>
                  <Label>Default Email Sender</Label>
                  <Input 
                    placeholder="notifications@syncquote.com" 
                    value={settings?.emailSender}
                    onChange={(e) => updateSettingsMutation.mutate({ emailSender: e.target.value })}
                  />
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}