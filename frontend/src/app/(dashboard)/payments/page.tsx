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
import { Separator } from '@/components/ui/separator'
import { 
  CreditCard, 
  DollarSign, 
  TrendingUp, 
  TrendingDown,
  Users, 
  Calendar, 
  Clock, 
  AlertCircle, 
  CheckCircle, 
  XCircle,
  Plus,
  Edit,
  Eye,
  Download,
  Upload,
  Send,
  RefreshCw,
  Settings,
  Filter,
  Search,
  MoreHorizontal,
  Receipt,
  Banknote,
  Wallet,
  PiggyBank,
  Target,
  BarChart3,
  LineChart,
  PieChart,
  Activity,
  Globe,
  MapPin,
  Building,
  User,
  Mail,
  Phone,
  FileText,
  Calendar as CalendarIcon,
  Timer,
  Zap,
  Shield,
  Link,
  Copy,
  ExternalLink,
  ArrowUpRight,
  ArrowDownRight,
  Info,
  AlertTriangle,
  Star,
  Heart,
  Repeat,
  PlayCircle,
  PauseCircle,
  StopCircle
} from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { LineChart as RechartsLineChart, Line, AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart as RechartsPieChart, Pie, Cell } from 'recharts'
import CountUp from 'react-countup'

interface PaymentAccount {
  id: string
  type: 'stripe' | 'paypal' | 'bank'
  accountId: string
  displayName: string
  status: 'active' | 'pending' | 'disabled' | 'error'
  isDefault: boolean
  currency: string
  balance: number
  country: string
  lastPayout: string
  capabilities: string[]
  requirements: string[]
  config: Record<string, any>
}

interface Invoice {
  id: string
  number: string
  customerId: string
  customerName: string
  customerEmail: string
  status: 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled'
  amount: number
  currency: string
  dueDate: string
  sentDate?: string
  paidDate?: string
  items: InvoiceItem[]
  taxes: InvoiceTax[]
  discounts: InvoiceDiscount[]
  notes?: string
  terms?: string
  paymentLink?: string
  remindersSent: number
  autoCollection: boolean
  createdAt: string
}

interface InvoiceItem {
  id: string
  description: string
  quantity: number
  unitPrice: number
  amount: number
  taxable: boolean
}

interface InvoiceTax {
  id: string
  name: string
  rate: number
  amount: number
}

interface InvoiceDiscount {
  id: string
  name: string
  type: 'percentage' | 'fixed'
  value: number
  amount: number
}

interface Subscription {
  id: string
  customerId: string
  customerName: string
  planId: string
  planName: string
  status: 'active' | 'paused' | 'cancelled' | 'expired' | 'trialing'
  amount: number
  currency: string
  interval: 'month' | 'year' | 'week'
  currentPeriodStart: string
  currentPeriodEnd: string
  trialEnd?: string
  cancelledAt?: string
  pausedAt?: string
  nextPayment: string
  paymentMethod: string
  discounts: SubscriptionDiscount[]
  usage?: SubscriptionUsage[]
  createdAt: string
}

interface SubscriptionDiscount {
  id: string
  couponId: string
  name: string
  type: 'percentage' | 'fixed'
  value: number
  duration: 'once' | 'repeating' | 'forever'
  endsAt?: string
}

interface SubscriptionUsage {
  metricId: string
  metricName: string
  quantity: number
  unitPrice: number
  amount: number
}

interface PaymentPlan {
  id: string
  name: string
  description: string
  amount: number
  currency: string
  interval: 'month' | 'year' | 'week'
  intervalCount: number
  trialDays?: number
  features: string[]
  isPopular: boolean
  isActive: boolean
  subscriberCount: number
  revenue: number
  conversionRate: number
  createdAt: string
}

interface Transaction {
  id: string
  type: 'payment' | 'refund' | 'chargeback' | 'payout' | 'fee'
  status: 'succeeded' | 'pending' | 'failed' | 'cancelled'
  amount: number
  currency: string
  customerId?: string
  customerName?: string
  description: string
  paymentMethod: string
  processingFee: number
  netAmount: number
  metadata: Record<string, any>
  createdAt: string
  settledAt?: string
}

interface PaymentMethod {
  id: string
  customerId: string
  type: 'card' | 'bank_account' | 'paypal' | 'apple_pay' | 'google_pay'
  brand?: string
  last4?: string
  expiryMonth?: number
  expiryYear?: number
  isDefault: boolean
  fingerprint: string
  country: string
  createdAt: string
}

interface Customer {
  id: string
  name: string
  email: string
  phone?: string
  company?: string
  address: {
    line1: string
    line2?: string
    city: string
    state: string
    postalCode: string
    country: string
  }
  paymentMethods: PaymentMethod[]
  defaultPaymentMethod?: string
  balance: number
  totalSpent: number
  lifetimeValue: number
  subscriptions: number
  invoices: number
  lastPayment?: string
  riskLevel: 'low' | 'medium' | 'high'
  tags: string[]
  notes?: string
  createdAt: string
}

const createInvoiceSchema = z.object({
  customerId: z.string().min(1, 'Customer is required'),
  dueDate: z.string().min(1, 'Due date is required'),
  items: z.array(z.object({
    description: z.string().min(1),
    quantity: z.number().min(1),
    unitPrice: z.number().min(0),
  })).min(1, 'At least one item is required'),
  notes: z.string().optional(),
  autoCollection: z.boolean().optional(),
})

const createSubscriptionSchema = z.object({
  customerId: z.string().min(1, 'Customer is required'),
  planId: z.string().min(1, 'Plan is required'),
  trialDays: z.number().optional(),
  couponId: z.string().optional(),
})

const createPlanSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
  amount: z.number().min(0, 'Amount must be positive'),
  currency: z.string().min(1),
  interval: z.enum(['month', 'year', 'week']),
  trialDays: z.number().optional(),
  features: z.array(z.string()).optional(),
})

type CreateInvoiceForm = z.infer<typeof createInvoiceSchema>
type CreateSubscriptionForm = z.infer<typeof createSubscriptionSchema>
type CreatePlanForm = z.infer<typeof createPlanSchema>

export default function PaymentsPage() {
  const [selectedTimeRange, setSelectedTimeRange] = useState('30d')
  const [invoiceDialogOpen, setInvoiceDialogOpen] = useState(false)
  const [subscriptionDialogOpen, setSubscriptionDialogOpen] = useState(false)
  const [planDialogOpen, setPlanDialogOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedStatus, setSelectedStatus] = useState('all')
  const [selectedCurrency, setSelectedCurrency] = useState('USD')
  const queryClient = useQueryClient()

  const { register: registerInvoice, handleSubmit: handleInvoiceSubmit, formState: { errors: invoiceErrors }, reset: resetInvoice } = useForm<CreateInvoiceForm>({
    resolver: zodResolver(createInvoiceSchema),
    defaultValues: { autoCollection: true }
  })

  const { register: registerSubscription, handleSubmit: handleSubscriptionSubmit, formState: { errors: subscriptionErrors }, reset: resetSubscription } = useForm<CreateSubscriptionForm>({
    resolver: zodResolver(createSubscriptionSchema),
  })

  const { register: registerPlan, handleSubmit: handlePlanSubmit, formState: { errors: planErrors }, reset: resetPlan } = useForm<CreatePlanForm>({
    resolver: zodResolver(createPlanSchema),
    defaultValues: { currency: 'USD', interval: 'month' }
  })

  // Fetch payment data
  const { data: paymentOverview } = useQuery({
    queryKey: ['payment-overview', selectedTimeRange, selectedCurrency],
    queryFn: () => api.get(`/payments/overview?range=${selectedTimeRange}&currency=${selectedCurrency}`).then(res => res.data),
    refetchInterval: 30000,
  })

  const { data: invoices } = useQuery({
    queryKey: ['invoices', searchQuery, selectedStatus],
    queryFn: () => api.get(`/payments/invoices?search=${searchQuery}&status=${selectedStatus}`).then((res: any) => res.data),
  })

  const { data: subscriptions } = useQuery({
    queryKey: ['subscriptions', selectedStatus],
    queryFn: () => api.get(`/payments/subscriptions?status=${selectedStatus}`).then((res: any) => res.data),
  })

  const { data: plans } = useQuery({
    queryKey: ['payment-plans'],
    queryFn: () => api.get('/payments/plans').then((res: any) => res.data),
  })

  const { data: transactions } = useQuery({
    queryKey: ['transactions', selectedTimeRange],
    queryFn: () => api.get(`/payments/transactions?range=${selectedTimeRange}`).then((res: any) => res.data),
  })

  const { data: customers } = useQuery({
    queryKey: ['payment-customers', searchQuery],
    queryFn: () => api.get(`/payments/customers?search=${searchQuery}`).then((res: any) => res.data),
  })

  const { data: paymentAccounts } = useQuery({
    queryKey: ['payment-accounts'],
    queryFn: () => api.get('/payments/accounts').then((res: any) => res.data),
  })

  const { data: revenueAnalytics } = useQuery({
    queryKey: ['revenue-analytics', selectedTimeRange],
    queryFn: () => api.get(`/payments/analytics?range=${selectedTimeRange}`).then((res: any) => res.data),
  })

  // Mutations
  const createInvoiceMutation = useMutation({
    mutationFn: (data: CreateInvoiceForm) => api.post('/payments/invoices', data),
    onSuccess: () => {
      toast.success('Invoice created successfully!')
      setInvoiceDialogOpen(false)
      resetInvoice()
      queryClient.invalidateQueries({ queryKey: ['invoices'] })
    },
    onError: () => {
      toast.error('Failed to create invoice')
    }
  })

  const sendInvoiceMutation = useMutation({
    mutationFn: (invoiceId: string) => api.post(`/payments/invoices/${invoiceId}/send`),
    onSuccess: () => {
      toast.success('Invoice sent successfully!')
      queryClient.invalidateQueries({ queryKey: ['invoices'] })
    },
  })

  const createSubscriptionMutation = useMutation({
    mutationFn: (data: CreateSubscriptionForm) => api.post('/payments/subscriptions', data),
    onSuccess: () => {
      toast.success('Subscription created successfully!')
      setSubscriptionDialogOpen(false)
      resetSubscription()
      queryClient.invalidateQueries({ queryKey: ['subscriptions'] })
    },
    onError: () => {
      toast.error('Failed to create subscription')
    }
  })

  const pauseSubscriptionMutation = useMutation({
    mutationFn: (subscriptionId: string) => api.post(`/payments/subscriptions/${subscriptionId}/pause`),
    onSuccess: () => {
      toast.success('Subscription paused!')
      queryClient.invalidateQueries({ queryKey: ['subscriptions'] })
    },
  })

  const cancelSubscriptionMutation = useMutation({
    mutationFn: (subscriptionId: string) => api.post(`/payments/subscriptions/${subscriptionId}/cancel`),
    onSuccess: () => {
      toast.success('Subscription cancelled!')
      queryClient.invalidateQueries({ queryKey: ['subscriptions'] })
    },
  })

  const createPlanMutation = useMutation({
    mutationFn: (data: CreatePlanForm) => api.post('/payments/plans', data),
    onSuccess: () => {
      toast.success('Payment plan created successfully!')
      setPlanDialogOpen(false)
      resetPlan()
      queryClient.invalidateQueries({ queryKey: ['payment-plans'] })
    },
    onError: () => {
      toast.error('Failed to create payment plan')
    }
  })

  const refundTransactionMutation = useMutation({
    mutationFn: ({ transactionId, amount }: { transactionId: string, amount?: number }) => 
      api.post(`/payments/transactions/${transactionId}/refund`, { amount }),
    onSuccess: () => {
      toast.success('Refund processed!')
      queryClient.invalidateQueries({ queryKey: ['transactions'] })
    },
  })

  const onCreateInvoice = (data: CreateInvoiceForm) => {
    createInvoiceMutation.mutate(data)
  }

  const onCreateSubscription = (data: CreateSubscriptionForm) => {
    createSubscriptionMutation.mutate(data)
  }

  const onCreatePlan = (data: CreatePlanForm) => {
    createPlanMutation.mutate(data)
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid':
      case 'active':
      case 'succeeded':
        return 'default'
      case 'sent':
      case 'pending':
      case 'trialing':
        return 'secondary'
      case 'overdue':
      case 'cancelled':
      case 'failed':
        return 'destructive'
      case 'draft':
      case 'paused':
        return 'outline'
      default:
        return 'outline'
    }
  }

  const getRiskColor = (risk: string) => {
    switch (risk) {
      case 'low':
        return 'default'
      case 'medium':
        return 'secondary'
      case 'high':
        return 'destructive'
      default:
        return 'outline'
    }
  }

  const formatCurrency = (amount: number, currency: string = 'USD') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
    }).format(amount / 100)
  }

  // Sample chart data
  const revenueData = [
    { month: 'Jan', revenue: 12500, subscriptions: 8200, oneTime: 4300 },
    { month: 'Feb', revenue: 15200, subscriptions: 9800, oneTime: 5400 },
    { month: 'Mar', revenue: 18900, subscriptions: 12100, oneTime: 6800 },
    { month: 'Apr', revenue: 22100, subscriptions: 14300, oneTime: 7800 },
    { month: 'May', revenue: 25800, subscriptions: 16900, oneTime: 8900 },
    { month: 'Jun', revenue: 28400, subscriptions: 18200, oneTime: 10200 },
  ]

  const paymentMethodData = [
    { name: 'Credit Cards', value: 65, color: '#3b82f6' },
    { name: 'Bank Transfer', value: 20, color: '#10b981' },
    { name: 'PayPal', value: 10, color: '#f59e0b' },
    { name: 'Other', value: 5, color: '#8b5cf6' },
  ]

  const churnData = [
    { month: 'Jan', churn: 3.2, newCustomers: 45, lostCustomers: 12 },
    { month: 'Feb', churn: 2.8, newCustomers: 52, lostCustomers: 14 },
    { month: 'Mar', churn: 4.1, newCustomers: 38, lostCustomers: 18 },
    { month: 'Apr', churn: 2.5, newCustomers: 61, lostCustomers: 15 },
    { month: 'May', churn: 3.7, newCustomers: 48, lostCustomers: 20 },
    { month: 'Jun', churn: 2.1, newCustomers: 67, lostCustomers: 13 },
  ]

  return (
    <div className="flex-1 space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Payment Center</h2>
          <p className="text-muted-foreground">
            Manage payments, invoices, subscriptions, and revenue analytics
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Select value={selectedTimeRange} onValueChange={setSelectedTimeRange}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">Last 7 Days</SelectItem>
              <SelectItem value="30d">Last 30 Days</SelectItem>
              <SelectItem value="90d">Last 90 Days</SelectItem>
              <SelectItem value="1y">Last Year</SelectItem>
            </SelectContent>
          </Select>
          <Select value={selectedCurrency} onValueChange={setSelectedCurrency}>
            <SelectTrigger className="w-24">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="USD">USD</SelectItem>
              <SelectItem value="EUR">EUR</SelectItem>
              <SelectItem value="GBP">GBP</SelectItem>
              <SelectItem value="CAD">CAD</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Revenue Overview */}
      <div className="grid gap-4 md:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-500">
              <CountUp 
                end={paymentOverview?.totalRevenue || 284000} 
                prefix="$" 
                separator="," 
              />
            </div>
            <p className="text-xs text-muted-foreground">
              +{paymentOverview?.revenueGrowth || 12}% from last period
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Monthly Recurring</CardTitle>
            <Repeat className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              <CountUp 
                end={paymentOverview?.mrr || 182000} 
                prefix="$" 
                separator="," 
              />
            </div>
            <p className="text-xs text-muted-foreground">
              +{paymentOverview?.mrrGrowth || 8}% MRR growth
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Subscriptions</CardTitle>
            <Users className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              <CountUp end={paymentOverview?.activeSubscriptions || 1247} />
            </div>
            <p className="text-xs text-muted-foreground">
              +{paymentOverview?.subscriptionGrowth || 5}% this month
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Churn Rate</CardTitle>
            <TrendingDown className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              <CountUp end={paymentOverview?.churnRate || 2.8} decimals={1} suffix="%" />
            </div>
            <p className="text-xs text-muted-foreground">
              Target: &lt; 5%
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Payment Success</CardTitle>
            <CheckCircle className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              <CountUp end={paymentOverview?.successRate || 97.2} decimals={1} suffix="%" />
            </div>
            <p className="text-xs text-muted-foreground">
              +{paymentOverview?.successRateGrowth || 0.5}% improvement
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="invoices">Invoices</TabsTrigger>
          <TabsTrigger value="subscriptions">Subscriptions</TabsTrigger>
          <TabsTrigger value="transactions">Transactions</TabsTrigger>
          <TabsTrigger value="customers">Customers</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Revenue Chart */}
            <Card>
              <CardHeader>
                <CardTitle>Revenue Trends</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={revenueData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <Tooltip formatter={(value) => [`$${value.toLocaleString()}`, '']} />
                    <Area type="monotone" dataKey="subscriptions" stackId="1" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.6} />
                    <Area type="monotone" dataKey="oneTime" stackId="1" stroke="#10b981" fill="#10b981" fillOpacity={0.6} />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Payment Methods */}
            <Card>
              <CardHeader>
                <CardTitle>Payment Methods</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <RechartsPieChart>
                    <Pie
                      data={paymentMethodData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={120}
                      dataKey="value"
                    >
                      {paymentMethodData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => [`${value}%`, '']} />
                  </RechartsPieChart>
                </ResponsiveContainer>
                <div className="mt-4 space-y-2">
                  {paymentMethodData.map((entry, index) => (
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

          {/* Churn Analysis */}
          <Card>
            <CardHeader>
              <CardTitle>Customer Churn Analysis</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <RechartsLineChart data={churnData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis yAxisId="left" />
                  <YAxis yAxisId="right" orientation="right" />
                  <Tooltip />
                  <Bar yAxisId="right" dataKey="newCustomers" fill="#10b981" opacity={0.7} />
                  <Bar yAxisId="right" dataKey="lostCustomers" fill="#ef4444" opacity={0.7} />
                  <Line yAxisId="left" type="monotone" dataKey="churn" stroke="#f59e0b" strokeWidth={3} />
                </RechartsLineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Payment Plans */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium">Payment Plans</h3>
              <Dialog open={planDialogOpen} onOpenChange={setPlanDialogOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="mr-2 h-4 w-4" />
                    Create Plan
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Create Payment Plan</DialogTitle>
                    <DialogDescription>
                      Set up a new subscription or payment plan
                    </DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handlePlanSubmit(onCreatePlan)} className="space-y-4">
                    <div>
                      <Label htmlFor="name">Plan Name</Label>
                      <Input
                        id="name"
                        {...registerPlan('name')}
                        placeholder="Professional Plan"
                      />
                      {planErrors.name && (
                        <p className="text-sm text-red-500 mt-1">{planErrors.name.message}</p>
                      )}
                    </div>
                    <div>
                      <Label htmlFor="description">Description</Label>
                      <Textarea
                        id="description"
                        {...registerPlan('description')}
                        placeholder="Perfect for growing businesses..."
                        rows={2}
                      />
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <Label htmlFor="amount">Amount (cents)</Label>
                        <Input
                          id="amount"
                          type="number"
                          {...registerPlan('amount')}
                          placeholder="2999"
                        />
                      </div>
                      <div>
                        <Label htmlFor="currency">Currency</Label>
                        <Select {...registerPlan('currency')}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="USD">USD</SelectItem>
                            <SelectItem value="EUR">EUR</SelectItem>
                            <SelectItem value="GBP">GBP</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label htmlFor="interval">Billing Interval</Label>
                        <Select {...registerPlan('interval')}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="month">Monthly</SelectItem>
                            <SelectItem value="year">Yearly</SelectItem>
                            <SelectItem value="week">Weekly</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="trialDays">Trial Days (Optional)</Label>
                      <Input
                        id="trialDays"
                        type="number"
                        {...registerPlan('trialDays')}
                        placeholder="14"
                      />
                    </div>
                    <div>
                      <Label>Features</Label>
                      <Textarea
                        placeholder="Feature 1&#10;Feature 2&#10;Feature 3"
                        rows={4}
                      />
                    </div>
                    <DialogFooter>
                      <Button type="button" variant="outline" onClick={() => setPlanDialogOpen(false)}>
                        Cancel
                      </Button>
                      <Button type="submit" disabled={createPlanMutation.isPending}>
                        {createPlanMutation.isPending ? 'Creating...' : 'Create Plan'}
                      </Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              {plans?.map((plan: PaymentPlan) => (
                <Card key={plan.id} className={plan.isPopular ? 'border-blue-500 shadow-lg' : ''}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">{plan.name}</CardTitle>
                      {plan.isPopular && (
                        <Badge className="bg-blue-500">Popular</Badge>
                      )}
                    </div>
                    <CardDescription>{plan.description}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div>
                        <div className="text-3xl font-bold">
                          {formatCurrency(plan.amount, plan.currency)}
                          <span className="text-sm font-normal text-muted-foreground">
                            /{plan.interval}
                          </span>
                        </div>
                        {plan.trialDays && (
                          <p className="text-sm text-muted-foreground">
                            {plan.trialDays} day free trial
                          </p>
                        )}
                      </div>

                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Subscribers:</span>
                          <span>{plan.subscriberCount}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Revenue:</span>
                          <span>{formatCurrency(plan.revenue, plan.currency)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Conversion:</span>
                          <span>{plan.conversionRate}%</span>
                        </div>
                      </div>

                      <div className="space-y-1">
                        {plan.features.slice(0, 4).map((feature, index) => (
                          <div key={index} className="flex items-center space-x-2 text-sm">
                            <CheckCircle className="h-4 w-4 text-green-500" />
                            <span>{feature}</span>
                          </div>
                        ))}
                        {plan.features.length > 4 && (
                          <p className="text-sm text-muted-foreground">
                            +{plan.features.length - 4} more features
                          </p>
                        )}
                      </div>

                      <div className="flex space-x-2">
                        <Button variant="outline" size="sm" className="flex-1">
                          <Edit className="mr-1 h-3 w-3" />
                          Edit
                        </Button>
                        <Button variant="outline" size="sm" className="flex-1">
                          <BarChart3 className="mr-1 h-3 w-3" />
                          Analytics
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="invoices" className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search invoices..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 w-64"
                />
              </div>
              <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                <SelectTrigger className="w-32">
                  <Filter className="mr-2 h-4 w-4" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="sent">Sent</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                  <SelectItem value="overdue">Overdue</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Dialog open={invoiceDialogOpen} onOpenChange={setInvoiceDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  Create Invoice
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Create Invoice</DialogTitle>
                  <DialogDescription>
                    Generate a new invoice for your customer
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleInvoiceSubmit(onCreateInvoice)} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="customerId">Customer</Label>
                      <Select {...registerInvoice('customerId')}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select customer" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="1">John Doe - Acme Corp</SelectItem>
                          <SelectItem value="2">Jane Smith - Tech Solutions</SelectItem>
                          <SelectItem value="3">Bob Johnson - StartupXYZ</SelectItem>
                        </SelectContent>
                      </Select>
                      {invoiceErrors.customerId && (
                        <p className="text-sm text-red-500 mt-1">{invoiceErrors.customerId.message}</p>
                      )}
                    </div>
                    <div>
                      <Label htmlFor="dueDate">Due Date</Label>
                      <Input
                        id="dueDate"
                        type="date"
                        {...registerInvoice('dueDate')}
                      />
                      {invoiceErrors.dueDate && (
                        <p className="text-sm text-red-500 mt-1">{invoiceErrors.dueDate.message}</p>
                      )}
                    </div>
                  </div>
                  <div>
                    <Label>Invoice Items</Label>
                    <div className="space-y-2 mt-2">
                      <div className="grid grid-cols-4 gap-2 p-3 border rounded">
                        <Input placeholder="Description" />
                        <Input type="number" placeholder="Quantity" />
                        <Input type="number" placeholder="Unit Price" />
                        <div className="flex items-center justify-center text-sm font-medium">
                          $0.00
                        </div>
                      </div>
                      <Button type="button" variant="outline" size="sm">
                        <Plus className="mr-1 h-3 w-3" />
                        Add Item
                      </Button>
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="notes">Notes (Optional)</Label>
                    <Textarea
                      id="notes"
                      {...registerInvoice('notes')}
                      placeholder="Thank you for your business..."
                      rows={3}
                    />
                  </div>
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="autoCollection"
                      {...registerInvoice('autoCollection')}
                    />
                    <Label htmlFor="autoCollection" className="text-sm">
                      Enable automatic payment collection
                    </Label>
                  </div>
                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setInvoiceDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button type="submit" disabled={createInvoiceMutation.isPending}>
                      {createInvoiceMutation.isPending ? 'Creating...' : 'Create Invoice'}
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
                  <TableHead>Invoice</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Due Date</TableHead>
                  <TableHead className="w-[100px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoices?.map((invoice: Invoice) => (
                  <TableRow key={invoice.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">#{invoice.number}</p>
                        <p className="text-sm text-muted-foreground">
                          Created {invoice.createdAt}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium">{invoice.customerName}</p>
                        <p className="text-sm text-muted-foreground">{invoice.customerEmail}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">
                        {formatCurrency(invoice.amount, invoice.currency)}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={getStatusColor(invoice.status)}>
                        {invoice.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        {invoice.dueDate}
                        {invoice.status === 'overdue' && (
                          <p className="text-red-500 text-xs">
                            {invoice.remindersSent} reminders sent
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex space-x-1">
                        {invoice.status === 'draft' && (
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => sendInvoiceMutation.mutate(invoice.id)}
                          >
                            <Send className="h-4 w-4" />
                          </Button>
                        )}
                        <Button variant="ghost" size="sm">
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm">
                          <Download className="h-4 w-4" />
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

        <TabsContent value="subscriptions" className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                <SelectTrigger className="w-32">
                  <Filter className="mr-2 h-4 w-4" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="trialing">Trialing</SelectItem>
                  <SelectItem value="paused">Paused</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Dialog open={subscriptionDialogOpen} onOpenChange={setSubscriptionDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  Create Subscription
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create Subscription</DialogTitle>
                  <DialogDescription>
                    Set up a new subscription for a customer
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubscriptionSubmit(onCreateSubscription)} className="space-y-4">
                  <div>
                    <Label htmlFor="customerId">Customer</Label>
                    <Select {...registerSubscription('customerId')}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select customer" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">John Doe - Acme Corp</SelectItem>
                        <SelectItem value="2">Jane Smith - Tech Solutions</SelectItem>
                        <SelectItem value="3">Bob Johnson - StartupXYZ</SelectItem>
                      </SelectContent>
                    </Select>
                    {subscriptionErrors.customerId && (
                      <p className="text-sm text-red-500 mt-1">{subscriptionErrors.customerId.message}</p>
                    )}
                  </div>
                  <div>
                    <Label htmlFor="planId">Payment Plan</Label>
                    <Select {...registerSubscription('planId')}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select plan" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">Starter - $29/month</SelectItem>
                        <SelectItem value="2">Professional - $99/month</SelectItem>
                        <SelectItem value="3">Enterprise - $299/month</SelectItem>
                      </SelectContent>
                    </Select>
                    {subscriptionErrors.planId && (
                      <p className="text-sm text-red-500 mt-1">{subscriptionErrors.planId.message}</p>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="trialDays">Trial Days (Optional)</Label>
                      <Input
                        id="trialDays"
                        type="number"
                        {...registerSubscription('trialDays')}
                        placeholder="14"
                      />
                    </div>
                    <div>
                      <Label htmlFor="couponId">Coupon (Optional)</Label>
                      <Input
                        id="couponId"
                        {...registerSubscription('couponId')}
                        placeholder="WELCOME20"
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setSubscriptionDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button type="submit" disabled={createSubscriptionMutation.isPending}>
                      {createSubscriptionMutation.isPending ? 'Creating...' : 'Create Subscription'}
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
                  <TableHead>Customer</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Next Payment</TableHead>
                  <TableHead className="w-[100px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {subscriptions?.map((subscription: Subscription) => (
                  <TableRow key={subscription.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{subscription.customerName}</p>
                        <p className="text-sm text-muted-foreground">
                          Since {subscription.createdAt}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium">{subscription.planName}</p>
                        <p className="text-sm text-muted-foreground">
                          {subscription.interval}ly billing
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">
                        {formatCurrency(subscription.amount, subscription.currency)}
                        <span className="text-sm font-normal text-muted-foreground">
                          /{subscription.interval}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={getStatusColor(subscription.status)}>
                        {subscription.status}
                      </Badge>
                      {subscription.trialEnd && subscription.status === 'trialing' && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Trial ends {subscription.trialEnd}
                        </p>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        {subscription.nextPayment}
                        <p className="text-muted-foreground text-xs">
                          {subscription.paymentMethod}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex space-x-1">
                        {subscription.status === 'active' && (
                          <>
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => pauseSubscriptionMutation.mutate(subscription.id)}
                            >
                              <PauseCircle className="h-4 w-4" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => cancelSubscriptionMutation.mutate(subscription.id)}
                            >
                              <StopCircle className="h-4 w-4" />
                            </Button>
                          </>
                        )}
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

        <TabsContent value="transactions" className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                <SelectTrigger className="w-32">
                  <Filter className="mr-2 h-4 w-4" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="payment">Payments</SelectItem>
                  <SelectItem value="refund">Refunds</SelectItem>
                  <SelectItem value="chargeback">Chargebacks</SelectItem>
                  <SelectItem value="payout">Payouts</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button variant="outline">
              <Download className="mr-2 h-4 w-4" />
              Export
            </Button>
          </div>

          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Transaction</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Payment Method</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="w-[70px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions?.map((transaction: Transaction) => (
                  <TableRow key={transaction.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{transaction.type}</p>
                        <p className="text-sm text-muted-foreground line-clamp-1">
                          {transaction.description}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium">{transaction.customerName || 'N/A'}</p>
                        <p className="text-sm text-muted-foreground">{transaction.customerId}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium">
                          {formatCurrency(transaction.amount, transaction.currency)}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Net: {formatCurrency(transaction.netAmount, transaction.currency)}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={getStatusColor(transaction.status)}>
                        {transaction.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">{transaction.paymentMethod}</div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        <p>{transaction.createdAt}</p>
                        {transaction.settledAt && (
                          <p className="text-muted-foreground">
                            Settled: {transaction.settledAt}
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {transaction.type === 'payment' && transaction.status === 'succeeded' && (
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => refundTransactionMutation.mutate({ transactionId: transaction.id })}
                        >
                          <RefreshCw className="h-4 w-4" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="customers" className="space-y-4">
          <div className="flex items-center space-x-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search customers..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Button variant="outline">
              <Upload className="mr-2 h-4 w-4" />
              Import
            </Button>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {customers?.map((customer: Customer) => (
              <Card key={customer.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-base">{customer.name}</CardTitle>
                      <p className="text-sm text-muted-foreground">{customer.email}</p>
                    </div>
                    <Badge variant={getRiskColor(customer.riskLevel)}>
                      {customer.riskLevel}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <p className="text-muted-foreground">Total Spent</p>
                        <p className="font-medium">{formatCurrency(customer.totalSpent)}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">LTV</p>
                        <p className="font-medium">{formatCurrency(customer.lifetimeValue)}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Subscriptions</p>
                        <p className="font-medium">{customer.subscriptions}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Invoices</p>
                        <p className="font-medium">{customer.invoices}</p>
                      </div>
                    </div>

                    {customer.company && (
                      <div className="flex items-center space-x-2 text-sm">
                        <Building className="h-4 w-4 text-muted-foreground" />
                        <span>{customer.company}</span>
                      </div>
                    )}

                    <div className="flex items-center space-x-2 text-sm">
                      <MapPin className="h-4 w-4 text-muted-foreground" />
                      <span>{customer.address.city}, {customer.address.country}</span>
                    </div>

                    {customer.lastPayment && (
                      <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                        <Calendar className="h-4 w-4" />
                        <span>Last payment: {customer.lastPayment}</span>
                      </div>
                    )}

                    <div className="flex space-x-2">
                      <Button variant="outline" size="sm" className="flex-1">
                        <Eye className="mr-1 h-3 w-3" />
                        View
                      </Button>
                      <Button variant="outline" size="sm" className="flex-1">
                        <Receipt className="mr-1 h-3 w-3" />
                        Invoice
                      </Button>
                    </div>
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