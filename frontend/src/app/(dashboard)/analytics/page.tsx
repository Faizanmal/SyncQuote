'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { CalendarDays, TrendingUp, Users, FileText, Eye, DollarSign, Clock, MousePointer, Target, Zap } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import CountUp from 'react-countup'
import { 
  LineChart, 
  Line, 
  AreaChart, 
  Area, 
  BarChart, 
  Bar, 
  PieChart, 
  Pie, 
  Cell, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  FunnelChart,
  Funnel,
  LabelList
} from 'recharts'
import { api } from '@/lib/api'

interface AnalyticsMetrics {
  totalRevenue: number
  monthlyRevenue: number
  totalProposals: number
  approvedProposals: number
  conversionRate: number
  averageViewTime: number
  totalViews: number
  uniqueVisitors: number
  activeUsers: number
  responseTime: number
  clientSatisfaction: number
  revenueGrowth: number
}

interface TimeSeriesData {
  date: string
  proposals: number
  views: number
  revenue: number
  conversions: number
  responseTime: number
}

interface FunnelData {
  name: string
  value: number
  fill: string
}

interface ConversionMetrics {
  stage: string
  count: number
  percentage: number
  dropoff: number
}

interface UserBehaviorData {
  action: string
  count: number
  avgTime: number
  conversionRate: number
}

interface GeographicData {
  country: string
  visits: number
  conversions: number
  revenue: number
}

export default function AnalyticsPage() {
  const [timeRange, setTimeRange] = useState('7d')
  const [selectedMetric, setSelectedMetric] = useState('revenue')
  const [realTimeMetrics, setRealTimeMetrics] = useState<AnalyticsMetrics | null>(null)

  // Fetch analytics data
  const { data: metrics, isLoading: metricsLoading } = useQuery({
    queryKey: ['analytics', 'metrics', timeRange],
    queryFn: () => api.get(`/analytics/metrics?range=${timeRange}`).then(res => res.data),
    refetchInterval: 30000, // Refresh every 30 seconds
  })

  const { data: timeSeriesData, isLoading: timeSeriesLoading } = useQuery({
    queryKey: ['analytics', 'timeseries', timeRange, selectedMetric],
    queryFn: () => api.get(`/analytics/timeseries?range=${timeRange}&metric=${selectedMetric}`).then(res => res.data),
  })

  const { data: funnelData } = useQuery({
    queryKey: ['analytics', 'funnel', timeRange],
    queryFn: () => api.get(`/analytics/funnel?range=${timeRange}`).then(res => res.data),
  })

  const { data: conversionData } = useQuery({
    queryKey: ['analytics', 'conversion', timeRange],
    queryFn: () => api.get(`/analytics/conversion?range=${timeRange}`).then(res => res.data),
  })

  const { data: userBehaviorData } = useQuery({
    queryKey: ['analytics', 'behavior', timeRange],
    queryFn: () => api.get(`/analytics/behavior?range=${timeRange}`).then(res => res.data),
  })

  const { data: geographicData } = useQuery({
    queryKey: ['analytics', 'geographic', timeRange],
    queryFn: () => api.get(`/analytics/geographic?range=${timeRange}`).then(res => res.data),
  })

  // Real-time updates via WebSocket
  useEffect(() => {
    // Simulated real-time updates - replace with actual WebSocket
    const interval = setInterval(() => {
      if (metrics) {
        setRealTimeMetrics({
          ...metrics,
          totalViews: metrics.totalViews + Math.floor(Math.random() * 5),
          activeUsers: Math.floor(Math.random() * 50) + 20,
          responseTime: Math.floor(Math.random() * 200) + 150,
        })
      }
    }, 5000)

    return () => clearInterval(interval)
  }, [metrics])

  const metricCards = [
    {
      title: 'Total Revenue',
      value: realTimeMetrics?.totalRevenue || metrics?.totalRevenue || 0,
      change: realTimeMetrics?.revenueGrowth || metrics?.revenueGrowth || 0,
      icon: DollarSign,
      format: 'currency',
      color: 'text-green-600',
    },
    {
      title: 'Monthly Revenue',
      value: realTimeMetrics?.monthlyRevenue || metrics?.monthlyRevenue || 0,
      change: 12.5,
      icon: TrendingUp,
      format: 'currency',
      color: 'text-blue-600',
    },
    {
      title: 'Total Proposals',
      value: realTimeMetrics?.totalProposals || metrics?.totalProposals || 0,
      change: 8.2,
      icon: FileText,
      format: 'number',
      color: 'text-purple-600',
    },
    {
      title: 'Conversion Rate',
      value: realTimeMetrics?.conversionRate || metrics?.conversionRate || 0,
      change: 2.1,
      icon: Target,
      format: 'percentage',
      color: 'text-orange-600',
    },
    {
      title: 'Total Views',
      value: realTimeMetrics?.totalViews || metrics?.totalViews || 0,
      change: 15.3,
      icon: Eye,
      format: 'number',
      color: 'text-indigo-600',
      realTime: true,
    },
    {
      title: 'Active Users',
      value: realTimeMetrics?.activeUsers || metrics?.activeUsers || 0,
      change: 5.7,
      icon: Users,
      format: 'number',
      color: 'text-emerald-600',
      realTime: true,
    },
    {
      title: 'Avg. View Time',
      value: realTimeMetrics?.averageViewTime || metrics?.averageViewTime || 0,
      change: -3.2,
      icon: Clock,
      format: 'time',
      color: 'text-yellow-600',
    },
    {
      title: 'Response Time',
      value: realTimeMetrics?.responseTime || metrics?.responseTime || 0,
      change: -8.1,
      icon: Zap,
      format: 'ms',
      color: 'text-red-600',
      realTime: true,
    },
  ]

  const formatValue = (value: number, format: string) => {
    switch (format) {
      case 'currency':
        return `$${value.toLocaleString()}`
      case 'percentage':
        return `${value.toFixed(1)}%`
      case 'time':
        return `${Math.floor(value / 60)}m ${value % 60}s`
      case 'ms':
        return `${value}ms`
      default:
        return value.toLocaleString()
    }
  }

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D']

  return (
    <div className="flex-1 space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Analytics Dashboard</h2>
          <p className="text-muted-foreground">
            Comprehensive insights into your proposal performance and business metrics
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="24h">Last 24h</SelectItem>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
              <SelectItem value="90d">Last 90 days</SelectItem>
              <SelectItem value="1y">Last year</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm">
            Export Report
          </Button>
        </div>
      </div>

      {/* Real-time Metrics Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {metricCards.map((metric, index) => (
          <Card key={metric.title} className="relative overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{metric.title}</CardTitle>
              <div className="flex items-center space-x-1">
                {metric.realTime && (
                  <div className="h-2 w-2 bg-green-500 rounded-full animate-pulse" />
                )}
                <metric.icon className={`h-4 w-4 ${metric.color}`} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                <CountUp
                  end={metric.value}
                  duration={2}
                  formattingFn={(value: number) => formatValue(value, metric.format)}
                />
              </div>
              <div className="flex items-center text-xs text-muted-foreground">
                <TrendingUp className={`mr-1 h-3 w-3 ${metric.change >= 0 ? 'text-green-500' : 'text-red-500'}`} />
                <span className={metric.change >= 0 ? 'text-green-500' : 'text-red-500'}>
                  {metric.change >= 0 ? '+' : ''}{metric.change.toFixed(1)}%
                </span>
                <span className="ml-1">from last period</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="conversion">Conversion Funnel</TabsTrigger>
          <TabsTrigger value="behavior">User Behavior</TabsTrigger>
          <TabsTrigger value="geographic">Geographic</TabsTrigger>
          <TabsTrigger value="realtime">Real-time</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {/* Time Series Chart */}
            <Card className="col-span-1">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Performance Trends</CardTitle>
                  <Select value={selectedMetric} onValueChange={setSelectedMetric}>
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="revenue">Revenue</SelectItem>
                      <SelectItem value="proposals">Proposals</SelectItem>
                      <SelectItem value="views">Views</SelectItem>
                      <SelectItem value="conversions">Conversions</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={timeSeriesData || []}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Area type="monotone" dataKey={selectedMetric} stroke="#8884d8" fill="#8884d8" fillOpacity={0.3} />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Proposal Status Distribution */}
            <Card className="col-span-1">
              <CardHeader>
                <CardTitle>Proposal Status Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={[
                        { name: 'Approved', value: 45, fill: '#00C49F' },
                        { name: 'Pending', value: 30, fill: '#FFBB28' },
                        { name: 'Declined', value: 15, fill: '#FF8042' },
                        { name: 'Draft', value: 10, fill: '#8884D8' },
                      ]}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name} ${(percent as number * 100).toFixed(0)}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {[
                        { name: 'Approved', value: 45, fill: '#00C49F' },
                        { name: 'Pending', value: 30, fill: '#FFBB28' },
                        { name: 'Declined', value: 15, fill: '#FF8042' },
                        { name: 'Draft', value: 10, fill: '#8884D8' },
                      ].map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Revenue and Performance Metrics */}
          <Card>
            <CardHeader>
              <CardTitle>Revenue vs Performance</CardTitle>
              <CardDescription>
                Compare revenue trends with proposal performance metrics
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <LineChart data={timeSeriesData || []}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis yAxisId="left" />
                  <YAxis yAxisId="right" orientation="right" />
                  <Tooltip />
                  <Legend />
                  <Line yAxisId="left" type="monotone" dataKey="revenue" stroke="#00C49F" strokeWidth={3} name="Revenue ($)" />
                  <Line yAxisId="right" type="monotone" dataKey="conversions" stroke="#8884d8" strokeWidth={2} name="Conversions" />
                  <Line yAxisId="right" type="monotone" dataKey="proposals" stroke="#FFBB28" strokeWidth={2} name="Proposals" />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="conversion" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {/* Conversion Funnel */}
            <Card className="col-span-1">
              <CardHeader>
                <CardTitle>Conversion Funnel</CardTitle>
                <CardDescription>Track user journey from view to approval</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={400}>
                  <FunnelChart>
                    <Tooltip />
                    <Funnel
                      dataKey="value"
                      data={funnelData || [
                        { name: 'Proposal Viewed', value: 1000, fill: '#8884d8' },
                        { name: 'Engaged (>30s)', value: 750, fill: '#82ca9d' },
                        { name: 'Downloaded PDF', value: 500, fill: '#ffc658' },
                        { name: 'Provided Signature', value: 300, fill: '#ff7300' },
                        { name: 'Approved', value: 200, fill: '#00C49F' },
                      ]}
                      isAnimationActive
                    >
                      <LabelList position="center" fill="#fff" stroke="none" />
                    </Funnel>
                  </FunnelChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Conversion Metrics Table */}
            <Card className="col-span-1">
              <CardHeader>
                <CardTitle>Conversion Breakdown</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {(conversionData || [
                    { stage: 'View to Engagement', count: 750, percentage: 75, dropoff: 25 },
                    { stage: 'Engagement to Download', count: 500, percentage: 66.7, dropoff: 33.3 },
                    { stage: 'Download to Signature', count: 300, percentage: 60, dropoff: 40 },
                    { stage: 'Signature to Approval', count: 200, percentage: 66.7, dropoff: 33.3 },
                  ]).map((metric: ConversionMetrics) => (
                    <div key={metric.stage} className="flex items-center justify-between p-4 border rounded-lg">
                      <div>
                        <p className="font-medium">{metric.stage}</p>
                        <p className="text-sm text-muted-foreground">{metric.count} users</p>
                      </div>
                      <div className="text-right">
                        <Badge variant={metric.percentage > 70 ? 'default' : metric.percentage > 50 ? 'secondary' : 'destructive'}>
                          {metric.percentage.toFixed(1)}%
                        </Badge>
                        <p className="text-xs text-red-500 mt-1">{metric.dropoff.toFixed(1)}% drop-off</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="behavior" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>User Behavior Analysis</CardTitle>
              <CardDescription>Understand how users interact with your proposals</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={userBehaviorData || [
                  { action: 'View Proposal', count: 1200, avgTime: 120, conversionRate: 15 },
                  { action: 'Download PDF', count: 450, avgTime: 5, conversionRate: 67 },
                  { action: 'Add Comment', count: 280, avgTime: 90, conversionRate: 45 },
                  { action: 'Sign Document', count: 190, avgTime: 180, conversionRate: 89 },
                  { action: 'Share Proposal', count: 150, avgTime: 30, conversionRate: 23 },
                ]}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="action" />
                  <YAxis yAxisId="left" />
                  <YAxis yAxisId="right" orientation="right" />
                  <Tooltip />
                  <Legend />
                  <Bar yAxisId="left" dataKey="count" fill="#8884d8" name="Count" />
                  <Bar yAxisId="right" dataKey="conversionRate" fill="#82ca9d" name="Conversion Rate %" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="geographic" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card className="col-span-2">
              <CardHeader>
                <CardTitle>Geographic Performance</CardTitle>
                <CardDescription>Proposal performance by location</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {(geographicData || [
                    { country: 'United States', visits: 2450, conversions: 425, revenue: 85000 },
                    { country: 'Canada', visits: 1200, conversions: 180, revenue: 36000 },
                    { country: 'United Kingdom', visits: 890, conversions: 125, revenue: 25000 },
                    { country: 'Australia', visits: 650, conversions: 95, revenue: 19000 },
                    { country: 'Germany', visits: 520, conversions: 75, revenue: 15000 },
                  ]).map((geo: GeographicData) => (
                    <div key={geo.country} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-6 bg-gray-200 rounded flex items-center justify-center text-xs font-bold">
                          {geo.country.slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-medium">{geo.country}</p>
                          <p className="text-sm text-muted-foreground">{geo.visits} visits</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-medium">${geo.revenue.toLocaleString()}</p>
                        <p className="text-sm text-muted-foreground">
                          {geo.conversions} conversions ({((geo.conversions / geo.visits) * 100).toFixed(1)}%)
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="realtime" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <div className="h-2 w-2 bg-green-500 rounded-full animate-pulse mr-2" />
                  Live Visitors
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">
                  <CountUp end={realTimeMetrics?.activeUsers || 23} duration={1} />
                </div>
                <p className="text-sm text-muted-foreground">Currently active</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <div className="h-2 w-2 bg-blue-500 rounded-full animate-pulse mr-2" />
                  Response Time
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">
                  <CountUp end={realTimeMetrics?.responseTime || 185} duration={1} />ms
                </div>
                <p className="text-sm text-muted-foreground">Average server response</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <div className="h-2 w-2 bg-orange-500 rounded-full animate-pulse mr-2" />
                  Page Views
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">
                  <CountUp end={realTimeMetrics?.totalViews || 1847} duration={1} />
                </div>
                <p className="text-sm text-muted-foreground">Today</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Live Activity Feed</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {/* Simulated real-time activity feed */}
                {Array.from({ length: 10 }).map((_, index) => (
                  <div key={index} className="flex items-center space-x-3 p-2 rounded border">
                    <div className="h-2 w-2 bg-green-500 rounded-full animate-pulse" />
                    <div className="flex-1">
                      <p className="text-sm">
                        User from <span className="font-medium">New York</span> viewed proposal 
                        <span className="font-medium"> &quot;Q4 Marketing Strategy&quot;</span>
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {30} seconds ago
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}