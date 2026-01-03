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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Progress } from '@/components/ui/progress'
import { 
  Activity, 
  AlertTriangle, 
  BarChart3, 
  CheckCircle, 
  Clock, 
  Cpu, 
  Database, 
  Globe, 
  HardDrive, 
  Heart, 
  Monitor, 
  Server, 
  Settings, 
  Shield, 
  Smartphone, 
  TrendingDown, 
  TrendingUp, 
  Users, 
  Wifi, 
  XCircle,
  Zap,
  AlertCircle,
  RefreshCw,
  Download,
  Upload,
  Eye,
  Play,
  Pause,
  Square,
  MoreHorizontal,
  Filter,
  Search,
  Calendar,
  FileText,
  Mail,
  Bell,
  Target,
  Layers,
  Cloud,
  GitBranch,
  Code,
  Bug,
  Gauge,
  MemoryStick,
  NetworkIcon as Network,
  Timer,
  Thermometer,
  MapPin,
  ChevronUp,
  ChevronDown,
  Info,
  Webhook
} from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { LineChart, Line, AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import CountUp from 'react-countup'

interface SystemMetrics {
  cpu: {
    usage: number
    cores: number
    temperature: number
    processes: number
  }
  memory: {
    usage: number
    total: number
    available: number
    cached: number
  }
  disk: {
    usage: number
    total: number
    available: number
    iops: number
  }
  network: {
    inbound: number
    outbound: number
    connections: number
    latency: number
  }
  database: {
    connections: number
    queryTime: number
    slowQueries: number
    cacheHitRate: number
  }
}

interface Alert {
  id: string
  severity: 'critical' | 'warning' | 'info'
  title: string
  message: string
  source: string
  timestamp: string
  status: 'open' | 'acknowledged' | 'resolved'
  assignedTo?: string
  resolvedAt?: string
  tags: string[]
  count: number
}

interface PerformanceMetric {
  id: string
  name: string
  category: 'frontend' | 'backend' | 'database' | 'infrastructure'
  value: number
  target: number
  unit: string
  trend: 'up' | 'down' | 'stable'
  history: Array<{ timestamp: string; value: number }>
  threshold: {
    warning: number
    critical: number
  }
}

interface ErrorLog {
  id: string
  message: string
  stack: string
  level: 'error' | 'warning' | 'info'
  source: string
  userId?: string
  userAgent?: string
  timestamp: string
  count: number
  resolved: boolean
  tags: string[]
  context: Record<string, unknown>
}

interface MonitoringIntegration {
  id: string
  name: string
  type: 'datadog' | 'newrelic' | 'sentry' | 'prometheus' | 'grafana' | 'pingdom'
  status: 'active' | 'inactive' | 'error'
  lastSync: string
  metricsCount: number
  alertsCount: number
  config: Record<string, unknown>
  logo: string
}

interface Deployment {
  id: string
  version: string
  environment: 'production' | 'staging' | 'development'
  status: 'success' | 'failed' | 'in-progress' | 'rolled-back'
  deployedAt: string
  deployedBy: string
  duration: number
  changes: string[]
  rollbackAvailable: boolean
  healthScore: number
}

const createAlertRuleSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  metric: z.string().min(1, 'Metric is required'),
  condition: z.enum(['greater_than', 'less_than', 'equals']),
  threshold: z.number().min(0),
  severity: z.enum(['critical', 'warning', 'info']),
  enabled: z.boolean().optional(),
})

type CreateAlertRuleForm = z.infer<typeof createAlertRuleSchema>

export default function MonitoringPage() {
  const [selectedTimeRange, setSelectedTimeRange] = useState('1h')
  const [selectedEnvironment, setSelectedEnvironment] = useState('production')
  const [alertDialogOpen, setAlertDialogOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedSeverity, setSelectedSeverity] = useState('all')
  const [autoRefresh, setAutoRefresh] = useState(true)
  const queryClient = useQueryClient()

  const { register: registerAlert, handleSubmit: handleAlertSubmit, formState: { errors: alertErrors }, reset: resetAlert } = useForm<CreateAlertRuleForm>({
    resolver: zodResolver(createAlertRuleSchema),
    defaultValues: { severity: 'warning', enabled: true }
  })

  // Fetch monitoring data
  const { data: systemMetrics } = useQuery({
    queryKey: ['system-metrics', selectedTimeRange, selectedEnvironment],
    queryFn: () => api.get(`/monitoring/metrics?range=${selectedTimeRange}&env=${selectedEnvironment}`).then(res => res.data),
    refetchInterval: autoRefresh ? 10000 : false,
  })

  const { data: alerts } = useQuery({
    queryKey: ['monitoring-alerts', selectedSeverity],
    queryFn: () => api.get(`/monitoring/alerts?severity=${selectedSeverity}`).then(res => res.data),
    refetchInterval: autoRefresh ? 30000 : false,
  })

  const { data: performanceMetrics } = useQuery({
    queryKey: ['performance-metrics', selectedTimeRange],
    queryFn: () => api.get(`/monitoring/performance?range=${selectedTimeRange}`).then(res => res.data),
    refetchInterval: autoRefresh ? 15000 : false,
  })

  const { data: errorLogs } = useQuery({
    queryKey: ['error-logs', searchQuery],
    queryFn: () => api.get(`/monitoring/errors?search=${searchQuery}`).then(res => res.data),
  })

  const { data: integrations } = useQuery({
    queryKey: ['monitoring-integrations'],
    queryFn: () => api.get('/monitoring/integrations').then(res => res.data),
  })

  const { data: deployments } = useQuery({
    queryKey: ['deployments', selectedEnvironment],
    queryFn: () => api.get(`/monitoring/deployments?env=${selectedEnvironment}`).then(res => res.data),
  })

  const { data: uptime } = useQuery({
    queryKey: ['uptime-stats'],
    queryFn: () => api.get('/monitoring/uptime').then(res => res.data),
    refetchInterval: autoRefresh ? 60000 : false,
  })

  // Mutations
  const createAlertRuleMutation = useMutation({
    mutationFn: (data: CreateAlertRuleForm) => api.post('/monitoring/alerts/rules', data),
    onSuccess: () => {
      toast.success('Alert rule created successfully!')
      setAlertDialogOpen(false)
      resetAlert()
      queryClient.invalidateQueries({ queryKey: ['monitoring-alerts'] })
    },
    onError: () => {
      toast.error('Failed to create alert rule')
    }
  })

  const acknowledgeAlertMutation = useMutation({
    mutationFn: (alertId: string) => api.patch(`/monitoring/alerts/${alertId}/acknowledge`),
    onSuccess: () => {
      toast.success('Alert acknowledged!')
      queryClient.invalidateQueries({ queryKey: ['monitoring-alerts'] })
    },
  })

  const resolveAlertMutation = useMutation({
    mutationFn: (alertId: string) => api.patch(`/monitoring/alerts/${alertId}/resolve`),
    onSuccess: () => {
      toast.success('Alert resolved!')
      queryClient.invalidateQueries({ queryKey: ['monitoring-alerts'] })
    },
  })

  const rollbackDeploymentMutation = useMutation({
    mutationFn: (deploymentId: string) => api.post(`/monitoring/deployments/${deploymentId}/rollback`),
    onSuccess: () => {
      toast.success('Rollback initiated!')
      queryClient.invalidateQueries({ queryKey: ['deployments'] })
    },
  })

  const onCreateAlertRule = (data: CreateAlertRuleForm) => {
    createAlertRuleMutation.mutate(data)
  }

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'destructive'
      case 'warning':
        return 'default'
      case 'info':
        return 'secondary'
      default:
        return 'outline'
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success':
        return 'default'
      case 'active':
        return 'default'
      case 'failed':
        return 'destructive'
      case 'error':
        return 'destructive'
      case 'in-progress':
        return 'secondary'
      case 'inactive':
        return 'outline'
      default:
        return 'outline'
    }
  }

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'up':
        return <TrendingUp className="h-4 w-4 text-green-500" />
      case 'down':
        return <TrendingDown className="h-4 w-4 text-red-500" />
      default:
        return <Activity className="h-4 w-4 text-blue-500" />
    }
  }

  const getHealthColor = (score: number) => {
    if (score >= 90) return 'text-green-500'
    if (score >= 70) return 'text-yellow-500'
    return 'text-red-500'
  }

  // Sample chart data
  const performanceData = [
    { time: '00:00', responseTime: 120, throughput: 850, errorRate: 0.5 },
    { time: '04:00', responseTime: 110, throughput: 920, errorRate: 0.3 },
    { time: '08:00', responseTime: 180, throughput: 1200, errorRate: 1.2 },
    { time: '12:00', responseTime: 220, throughput: 1450, errorRate: 2.1 },
    { time: '16:00', responseTime: 190, throughput: 1350, errorRate: 1.8 },
    { time: '20:00', responseTime: 140, throughput: 1100, errorRate: 0.9 },
  ]

  const resourceData = [
    { time: '00:00', cpu: 25, memory: 60, disk: 45 },
    { time: '04:00', cpu: 20, memory: 58, disk: 47 },
    { time: '08:00', cpu: 45, memory: 72, disk: 52 },
    { time: '12:00', cpu: 75, memory: 85, disk: 58 },
    { time: '16:00', cpu: 65, memory: 80, disk: 55 },
    { time: '20:00', cpu: 35, memory: 65, disk: 48 },
  ]

  const errorDistribution = [
    { name: '4xx Errors', value: 45, color: '#fbbf24' },
    { name: '5xx Errors', value: 25, color: '#ef4444' },
    { name: 'Database', value: 20, color: '#8b5cf6' },
    { name: 'Network', value: 10, color: '#06b6d4' },
  ]

  // Auto-refresh effect
  useEffect(() => {
    if (autoRefresh) {
      const interval = setInterval(() => {
        queryClient.invalidateQueries({ queryKey: ['system-metrics'] })
        queryClient.invalidateQueries({ queryKey: ['performance-metrics'] })
      }, 10000)
      return () => clearInterval(interval)
    }
  }, [autoRefresh, queryClient])

  return (
    <div className="flex-1 space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Performance & Monitoring</h2>
          <p className="text-muted-foreground">
            Monitor system health, performance metrics, and track deployments
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <div className="flex items-center space-x-2">
            <Label htmlFor="auto-refresh" className="text-sm">Auto-refresh</Label>
            <Switch
              id="auto-refresh"
              checked={autoRefresh}
              onCheckedChange={setAutoRefresh}
            />
          </div>
          <Select value={selectedTimeRange} onValueChange={setSelectedTimeRange}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1h">Last Hour</SelectItem>
              <SelectItem value="6h">Last 6 Hours</SelectItem>
              <SelectItem value="24h">Last 24 Hours</SelectItem>
              <SelectItem value="7d">Last 7 Days</SelectItem>
              <SelectItem value="30d">Last 30 Days</SelectItem>
            </SelectContent>
          </Select>
          <Select value={selectedEnvironment} onValueChange={setSelectedEnvironment}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="production">Production</SelectItem>
              <SelectItem value="staging">Staging</SelectItem>
              <SelectItem value="development">Development</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* System Health Overview */}
      <div className="grid gap-4 md:grid-cols-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Uptime</CardTitle>
            <Activity className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-500">
              <CountUp end={uptime?.percentage || 99.9} decimals={2} suffix="%" />
            </div>
            <p className="text-xs text-muted-foreground">
              {uptime?.streak || 45} days streak
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Response Time</CardTitle>
            <Timer className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              <CountUp end={systemMetrics?.avgResponseTime || 125} suffix="ms" />
            </div>
            <p className="text-xs text-muted-foreground">
              -15ms from yesterday
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Throughput</CardTitle>
            <TrendingUp className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              <CountUp end={systemMetrics?.throughput || 1250} suffix="/min" />
            </div>
            <p className="text-xs text-muted-foreground">
              +8% from last hour
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Error Rate</CardTitle>
            <AlertTriangle className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              <CountUp end={systemMetrics?.errorRate || 0.8} decimals={1} suffix="%" />
            </div>
            <p className="text-xs text-muted-foreground">
              Target: &lt; 1%
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Users</CardTitle>
            <Users className="h-4 w-4 text-indigo-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              <CountUp end={systemMetrics?.activeUsers || 1847} />
            </div>
            <p className="text-xs text-muted-foreground">
              Peak: 2,150 users
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Health Score</CardTitle>
            <Heart className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${getHealthColor(systemMetrics?.healthScore || 92)}`}>
              <CountUp end={systemMetrics?.healthScore || 92} suffix="/100" />
            </div>
            <p className="text-xs text-muted-foreground">
              Excellent health
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="alerts">Alerts</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="errors">Error Tracking</TabsTrigger>
          <TabsTrigger value="deployments">Deployments</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-6 lg:grid-cols-2">
            {/* System Resources */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Server className="h-5 w-5" />
                  <span>System Resources</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center space-x-2">
                      <Cpu className="h-4 w-4 text-blue-500" />
                      <span className="text-sm">CPU Usage</span>
                    </div>
                    <span className="text-sm font-medium">{systemMetrics?.cpu?.usage || 45}%</span>
                  </div>
                  <Progress value={systemMetrics?.cpu?.usage || 45} className="h-2" />
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center space-x-2">
                      <MemoryStick className="h-4 w-4 text-green-500" />
                      <span className="text-sm">Memory Usage</span>
                    </div>
                    <span className="text-sm font-medium">{systemMetrics?.memory?.usage || 68}%</span>
                  </div>
                  <Progress value={systemMetrics?.memory?.usage || 68} className="h-2" />
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center space-x-2">
                      <HardDrive className="h-4 w-4 text-purple-500" />
                      <span className="text-sm">Disk Usage</span>
                    </div>
                    <span className="text-sm font-medium">{systemMetrics?.disk?.usage || 52}%</span>
                  </div>
                  <Progress value={systemMetrics?.disk?.usage || 52} className="h-2" />
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center space-x-2">
                      <Network className="h-4 w-4 text-orange-500" />
                      <span className="text-sm">Network I/O</span>
                    </div>
                    <span className="text-sm font-medium">{systemMetrics?.network?.usage || 35}%</span>
                  </div>
                  <Progress value={systemMetrics?.network?.usage || 35} className="h-2" />
                </div>
              </CardContent>
            </Card>

            {/* Performance Chart */}
            <Card>
              <CardHeader>
                <CardTitle>Performance Trends</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={performanceData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="time" />
                    <YAxis />
                    <Tooltip />
                    <Line type="monotone" dataKey="responseTime" stroke="#3b82f6" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Resource Usage Chart */}
          <Card>
            <CardHeader>
              <CardTitle>Resource Usage Over Time</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={resourceData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="time" />
                  <YAxis />
                  <Tooltip />
                  <Area type="monotone" dataKey="cpu" stackId="1" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.6} />
                  <Area type="monotone" dataKey="memory" stackId="2" stroke="#10b981" fill="#10b981" fillOpacity={0.6} />
                  <Area type="monotone" dataKey="disk" stackId="3" stroke="#8b5cf6" fill="#8b5cf6" fillOpacity={0.6} />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Monitoring Integrations */}
          <div>
            <h3 className="text-lg font-medium mb-4">Monitoring Integrations</h3>
            <div className="grid gap-4 md:grid-cols-3">
              {integrations?.map((integration: MonitoringIntegration) => (
                <Card key={integration.id}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <div className="h-8 w-8 bg-muted rounded flex items-center justify-center">
                          <Monitor className="h-4 w-4" />
                        </div>
                        <CardTitle className="text-base">{integration.name}</CardTitle>
                      </div>
                      <Badge variant={getStatusColor(integration.status)}>
                        {integration.status}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Metrics:</span>
                        <span>{integration.metricsCount.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Alerts:</span>
                        <span>{integration.alertsCount}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Last Sync:</span>
                        <span>{integration.lastSync}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="alerts" className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Select value={selectedSeverity} onValueChange={setSelectedSeverity}>
                <SelectTrigger className="w-40">
                  <Filter className="mr-2 h-4 w-4" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Severities</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                  <SelectItem value="warning">Warning</SelectItem>
                  <SelectItem value="info">Info</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Dialog open={alertDialogOpen} onOpenChange={setAlertDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Bell className="mr-2 h-4 w-4" />
                  Create Alert Rule
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create Alert Rule</DialogTitle>
                  <DialogDescription>
                    Set up automated alerts based on system metrics
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleAlertSubmit(onCreateAlertRule)} className="space-y-4">
                  <div>
                    <Label htmlFor="name">Rule Name</Label>
                    <Input
                      id="name"
                      {...registerAlert('name')}
                      placeholder="High CPU Usage Alert"
                    />
                    {alertErrors.name && (
                      <p className="text-sm text-red-500 mt-1">{alertErrors.name.message}</p>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="metric">Metric</Label>
                      <Select {...registerAlert('metric')}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select metric" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="cpu_usage">CPU Usage</SelectItem>
                          <SelectItem value="memory_usage">Memory Usage</SelectItem>
                          <SelectItem value="disk_usage">Disk Usage</SelectItem>
                          <SelectItem value="response_time">Response Time</SelectItem>
                          <SelectItem value="error_rate">Error Rate</SelectItem>
                          <SelectItem value="throughput">Throughput</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="condition">Condition</Label>
                      <Select {...registerAlert('condition')}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="greater_than">Greater Than</SelectItem>
                          <SelectItem value="less_than">Less Than</SelectItem>
                          <SelectItem value="equals">Equals</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="threshold">Threshold</Label>
                      <Input
                        id="threshold"
                        type="number"
                        {...registerAlert('threshold')}
                        placeholder="80"
                      />
                    </div>
                    <div>
                      <Label htmlFor="severity">Severity</Label>
                      <Select {...registerAlert('severity')}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="critical">Critical</SelectItem>
                          <SelectItem value="warning">Warning</SelectItem>
                          <SelectItem value="info">Info</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="enabled"
                      {...registerAlert('enabled')}
                    />
                    <Label htmlFor="enabled" className="text-sm">Enable this alert rule</Label>
                  </div>
                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setAlertDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button type="submit" disabled={createAlertRuleMutation.isPending}>
                      {createAlertRuleMutation.isPending ? 'Creating...' : 'Create Rule'}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          <div className="grid gap-4">
            {alerts?.map((alert: Alert) => (
              <Card key={alert.id} className="border-l-4 border-l-red-500">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="flex items-center space-x-2">
                        {alert.severity === 'critical' && <XCircle className="h-5 w-5 text-red-500" />}
                        {alert.severity === 'warning' && <AlertTriangle className="h-5 w-5 text-yellow-500" />}
                        {alert.severity === 'info' && <Info className="h-5 w-5 text-blue-500" />}
                        <Badge variant={getSeverityColor(alert.severity)}>
                          {alert.severity}
                        </Badge>
                      </div>
                      <div>
                        <CardTitle className="text-base">{alert.title}</CardTitle>
                        <p className="text-sm text-muted-foreground">{alert.source}</p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Badge variant="outline">{alert.status}</Badge>
                      {alert.count > 1 && (
                        <Badge variant="secondary">{alert.count}x</Badge>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <p className="text-sm">{alert.message}</p>
                    <div className="flex items-center justify-between">
                      <div className="flex space-x-1">
                        {alert.tags.map(tag => (
                          <Badge key={tag} variant="outline" className="text-xs">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                      <span className="text-xs text-muted-foreground">{alert.timestamp}</span>
                    </div>
                    {alert.status === 'open' && (
                      <div className="flex space-x-2">
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => acknowledgeAlertMutation.mutate(alert.id)}
                        >
                          Acknowledge
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => resolveAlertMutation.mutate(alert.id)}
                        >
                          Resolve
                        </Button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="performance" className="space-y-4">
          <div className="grid gap-6">
            {/* Performance Metrics Grid */}
            <div className="grid gap-4 md:grid-cols-3">
              {performanceMetrics?.map((metric: PerformanceMetric) => (
                <Card key={metric.id}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">{metric.name}</CardTitle>
                      {getTrendIcon(metric.trend)}
                    </div>
                    <Badge variant="outline" className="text-xs w-fit">
                      {metric.category}
                    </Badge>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="text-2xl font-bold">
                        {metric.value}{metric.unit}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        Target: {metric.target}{metric.unit}
                      </div>
                      <Progress 
                        value={(metric.value / metric.target) * 100} 
                        className="h-2"
                      />
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>Warning: {metric.threshold.warning}</span>
                        <span>Critical: {metric.threshold.critical}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Throughput Chart */}
            <Card>
              <CardHeader>
                <CardTitle>Throughput & Response Time</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={performanceData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="time" />
                    <YAxis yAxisId="left" />
                    <YAxis yAxisId="right" orientation="right" />
                    <Tooltip />
                    <Line yAxisId="left" type="monotone" dataKey="throughput" stroke="#10b981" strokeWidth={2} />
                    <Line yAxisId="right" type="monotone" dataKey="responseTime" stroke="#3b82f6" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Error Rate Chart */}
            <div className="grid gap-6 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Error Rate Trends</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={200}>
                    <AreaChart data={performanceData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="time" />
                      <YAxis />
                      <Tooltip />
                      <Area type="monotone" dataKey="errorRate" stroke="#ef4444" fill="#ef4444" fillOpacity={0.3} />
                    </AreaChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Error Distribution</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie
                        data={errorDistribution}
                        cx="50%"
                        cy="50%"
                        innerRadius={40}
                        outerRadius={80}
                        dataKey="value"
                      >
                        {errorDistribution.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="mt-4 space-y-2">
                    {errorDistribution.map((entry, index) => (
                      <div key={index} className="flex items-center justify-between text-sm">
                        <div className="flex items-center space-x-2">
                          <div 
                            className="w-3 h-3 rounded-full" 
                            style={{ backgroundColor: entry.color }}
                          />
                          <span>{entry.name}</span>
                        </div>
                        <span>{entry.value}%</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="errors" className="space-y-4">
          <div className="flex items-center space-x-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search error logs..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Button variant="outline">
              <Download className="mr-2 h-4 w-4" />
              Export Logs
            </Button>
          </div>

          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Error</TableHead>
                  <TableHead>Level</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Count</TableHead>
                  <TableHead>Last Seen</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[70px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {errorLogs?.map((error: ErrorLog) => (
                  <TableRow key={error.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium line-clamp-1">{error.message}</p>
                        <p className="text-sm text-muted-foreground line-clamp-1">
                          {error.stack}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={error.level === 'error' ? 'destructive' : 'secondary'}>
                        {error.level}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        <p>{error.source}</p>
                        {error.userId && (
                          <p className="text-muted-foreground">User: {error.userId}</p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{error.count}x</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        <p>{error.timestamp}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={error.resolved ? 'default' : 'destructive'}>
                        {error.resolved ? 'Resolved' : 'Open'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm">
                        <Eye className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="deployments" className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium">Deployment History</h3>
            <div className="flex space-x-2">
              <Button variant="outline">
                <GitBranch className="mr-2 h-4 w-4" />
                Compare Versions
              </Button>
              <Button>
                <Upload className="mr-2 h-4 w-4" />
                New Deployment
              </Button>
            </div>
          </div>

          <div className="grid gap-4">
            {deployments?.map((deployment: Deployment) => (
              <Card key={deployment.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <Badge variant="outline">{deployment.version}</Badge>
                      <div>
                        <CardTitle className="text-base">
                          {deployment.environment} Deployment
                        </CardTitle>
                        <p className="text-sm text-muted-foreground">
                          by {deployment.deployedBy} • {deployment.deployedAt}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Badge variant={getStatusColor(deployment.status)}>
                        {deployment.status}
                      </Badge>
                      <div className={`text-sm font-medium ${getHealthColor(deployment.healthScore)}`}>
                        Health: {deployment.healthScore}/100
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Duration:</span>
                      <span>{deployment.duration}s</span>
                    </div>
                    <div>
                      <p className="text-sm font-medium mb-2">Changes:</p>
                      <div className="space-y-1">
                        {deployment.changes.slice(0, 3).map((change, index) => (
                          <p key={index} className="text-sm text-muted-foreground">
                            • {change}
                          </p>
                        ))}
                        {deployment.changes.length > 3 && (
                          <p className="text-sm text-muted-foreground">
                            +{deployment.changes.length - 3} more changes
                          </p>
                        )}
                      </div>
                    </div>
                    {deployment.rollbackAvailable && deployment.status === 'success' && (
                      <div className="flex space-x-2">
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => rollbackDeploymentMutation.mutate(deployment.id)}
                        >
                          <RefreshCw className="mr-1 h-3 w-3" />
                          Rollback
                        </Button>
                        <Button variant="outline" size="sm">
                          <Eye className="mr-1 h-3 w-3" />
                          View Logs
                        </Button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}