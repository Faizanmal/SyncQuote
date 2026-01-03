"use client";

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import {
  Plus,
  FileText,
  DollarSign,
  Clock,
  Send,
  Download,
  Eye,
  MoreHorizontal,
  Search,
  Filter,
  Calendar,
  AlertCircle,
  CheckCircle,
  XCircle,
  Loader2,
  RefreshCw,
  Receipt,
  CreditCard,
  TrendingUp,
  Users,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';

interface Invoice {
  id: string;
  invoiceNumber: string;
  proposalId: string;
  proposalTitle: string;
  clientName: string;
  clientEmail: string;
  status: 'draft' | 'sent' | 'viewed' | 'paid' | 'partially_paid' | 'overdue' | 'cancelled';
  issueDate: string;
  dueDate: string;
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
  amountPaid: number;
  amountDue: number;
  currency: string;
  paymentTerms: string;
  createdAt: string;
}

interface InvoiceStats {
  totalInvoices: number;
  totalRevenue: number;
  pendingAmount: number;
  overdueAmount: number;
  paidThisMonth: number;
}

const mockInvoices: Invoice[] = [
  {
    id: '1',
    invoiceNumber: 'INV-2024-001',
    proposalId: 'prop-1',
    proposalTitle: 'Website Redesign Project',
    clientName: 'Acme Corporation',
    clientEmail: 'billing@acme.com',
    status: 'paid',
    issueDate: '2024-01-15',
    dueDate: '2024-02-14',
    subtotal: 15000,
    tax: 1500,
    discount: 500,
    total: 16000,
    amountPaid: 16000,
    amountDue: 0,
    currency: 'USD',
    paymentTerms: 'net_30',
    createdAt: '2024-01-15T10:00:00Z',
  },
  {
    id: '2',
    invoiceNumber: 'INV-2024-002',
    proposalId: 'prop-2',
    proposalTitle: 'Mobile App Development',
    clientName: 'TechStart Inc',
    clientEmail: 'finance@techstart.io',
    status: 'overdue',
    issueDate: '2024-01-20',
    dueDate: '2024-02-04',
    subtotal: 25000,
    tax: 2500,
    discount: 0,
    total: 27500,
    amountPaid: 0,
    amountDue: 27500,
    currency: 'USD',
    paymentTerms: 'net_15',
    createdAt: '2024-01-20T14:30:00Z',
  },
  {
    id: '3',
    invoiceNumber: 'INV-2024-003',
    proposalId: 'prop-3',
    proposalTitle: 'E-commerce Platform',
    clientName: 'RetailMax LLC',
    clientEmail: 'accounts@retailmax.com',
    status: 'sent',
    issueDate: '2024-02-01',
    dueDate: '2024-03-02',
    subtotal: 45000,
    tax: 4500,
    discount: 2250,
    total: 47250,
    amountPaid: 0,
    amountDue: 47250,
    currency: 'USD',
    paymentTerms: 'net_30',
    createdAt: '2024-02-01T09:00:00Z',
  },
  {
    id: '4',
    invoiceNumber: 'INV-2024-004',
    proposalId: 'prop-4',
    proposalTitle: 'Cloud Migration Services',
    clientName: 'DataFlow Systems',
    clientEmail: 'billing@dataflow.io',
    status: 'partially_paid',
    issueDate: '2024-02-05',
    dueDate: '2024-03-06',
    subtotal: 35000,
    tax: 3500,
    discount: 0,
    total: 38500,
    amountPaid: 19250,
    amountDue: 19250,
    currency: 'USD',
    paymentTerms: 'net_30',
    createdAt: '2024-02-05T11:00:00Z',
  },
];

const mockStats: InvoiceStats = {
  totalInvoices: 24,
  totalRevenue: 385000,
  pendingAmount: 94000,
  overdueAmount: 27500,
  paidThisMonth: 63500,
};

export function InvoiceManagement() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);

  // Create invoice form state
  const [newInvoice, setNewInvoice] = useState({
    proposalId: '',
    paymentTerms: 'net_30',
    notes: '',
    issueDate: new Date().toISOString().split('T')[0],
  });

  // Payment form state
  const [payment, setPayment] = useState({
    amount: 0,
    paymentMethod: 'credit_card',
    reference: '',
    notes: '',
  });

  // Fetch invoices
  const { data: invoices = mockInvoices, isLoading } = useQuery({
    queryKey: ['invoices'],
    queryFn: async () => {
      // In production, fetch from API
      // const response = await fetch('/api/invoices');
      // return response.json();
      return mockInvoices;
    },
  });

  // Fetch stats
  const { data: stats = mockStats } = useQuery({
    queryKey: ['invoice-stats'],
    queryFn: async () => {
      return mockStats;
    },
  });

  // Create invoice mutation
  const createInvoiceMutation = useMutation({
    mutationFn: async (data: typeof newInvoice) => {
      const response = await fetch('/api/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('Failed to create invoice');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      setCreateDialogOpen(false);
      toast.success('Invoice created successfully');
    },
    onError: () => {
      toast.error('Failed to create invoice');
    },
  });

  // Send invoice mutation
  const sendInvoiceMutation = useMutation({
    mutationFn: async (invoiceId: string) => {
      const response = await fetch(`/api/invoices/${invoiceId}/send`, {
        method: 'POST',
      });
      if (!response.ok) throw new Error('Failed to send invoice');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      toast.success('Invoice sent to client');
    },
    onError: () => {
      toast.error('Failed to send invoice');
    },
  });

  // Record payment mutation
  const recordPaymentMutation = useMutation({
    mutationFn: async ({ invoiceId, data }: { invoiceId: string; data: typeof payment }) => {
      const response = await fetch(`/api/invoices/${invoiceId}/payments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('Failed to record payment');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      setPaymentDialogOpen(false);
      toast.success('Payment recorded successfully');
    },
    onError: () => {
      toast.error('Failed to record payment');
    },
  });

  const getStatusBadge = (status: Invoice['status']) => {
    const statusConfig = {
      draft: { label: 'Draft', variant: 'secondary' as const, icon: FileText },
      sent: { label: 'Sent', variant: 'default' as const, icon: Send },
      viewed: { label: 'Viewed', variant: 'outline' as const, icon: Eye },
      paid: { label: 'Paid', variant: 'default' as const, icon: CheckCircle },
      partially_paid: { label: 'Partial', variant: 'outline' as const, icon: Clock },
      overdue: { label: 'Overdue', variant: 'destructive' as const, icon: AlertCircle },
      cancelled: { label: 'Cancelled', variant: 'secondary' as const, icon: XCircle },
    };

    const config = statusConfig[status];
    const Icon = config.icon;

    return (
      <Badge variant={config.variant} className="flex items-center gap-1">
        <Icon className="h-3 w-3" />
        {config.label}
      </Badge>
    );
  };

  const formatCurrency = (amount: number, currency: string = 'USD') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
    }).format(amount);
  };

  const filteredInvoices = invoices.filter((invoice) => {
    const matchesSearch =
      invoice.invoiceNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      invoice.clientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      invoice.proposalTitle.toLowerCase().includes(searchQuery.toLowerCase());

    if (activeTab === 'all') return matchesSearch;
    return matchesSearch && invoice.status === activeTab;
  });

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
          <h2 className="text-3xl font-bold tracking-tight">Invoices</h2>
          <p className="text-muted-foreground">
            Create, send, and track invoices for your proposals.
          </p>
        </div>
        <Button onClick={() => setCreateDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Create Invoice
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Invoices</p>
                <p className="text-2xl font-bold">{stats.totalInvoices}</p>
              </div>
              <Receipt className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Revenue</p>
                <p className="text-2xl font-bold">{formatCurrency(stats.totalRevenue)}</p>
              </div>
              <TrendingUp className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Pending</p>
                <p className="text-2xl font-bold">{formatCurrency(stats.pendingAmount)}</p>
              </div>
              <Clock className="h-8 w-8 text-yellow-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Overdue</p>
                <p className="text-2xl font-bold text-red-500">{formatCurrency(stats.overdueAmount)}</p>
              </div>
              <AlertCircle className="h-8 w-8 text-red-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Paid (This Month)</p>
                <p className="text-2xl font-bold text-green-600">{formatCurrency(stats.paidThisMonth)}</p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search and Filters */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search invoices..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button variant="outline" size="icon">
          <Filter className="h-4 w-4" />
        </Button>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="draft">Draft</TabsTrigger>
          <TabsTrigger value="sent">Sent</TabsTrigger>
          <TabsTrigger value="paid">Paid</TabsTrigger>
          <TabsTrigger value="overdue">Overdue</TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="mt-6">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Invoice</TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Issue Date</TableHead>
                    <TableHead>Due Date</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-right">Paid</TableHead>
                    <TableHead className="text-right">Due</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredInvoices.map((invoice) => (
                    <TableRow key={invoice.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{invoice.invoiceNumber}</p>
                          <p className="text-sm text-muted-foreground truncate max-w-[200px]">
                            {invoice.proposalTitle}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{invoice.clientName}</p>
                          <p className="text-sm text-muted-foreground">{invoice.clientEmail}</p>
                        </div>
                      </TableCell>
                      <TableCell>{getStatusBadge(invoice.status)}</TableCell>
                      <TableCell>{new Date(invoice.issueDate).toLocaleDateString()}</TableCell>
                      <TableCell>{new Date(invoice.dueDate).toLocaleDateString()}</TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(invoice.total, invoice.currency)}
                      </TableCell>
                      <TableCell className="text-right text-green-600">
                        {formatCurrency(invoice.amountPaid, invoice.currency)}
                      </TableCell>
                      <TableCell className="text-right text-orange-600">
                        {formatCurrency(invoice.amountDue, invoice.currency)}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => {
                              setSelectedInvoice(invoice);
                              setViewDialogOpen(true);
                            }}>
                              <Eye className="h-4 w-4 mr-2" />
                              View Details
                            </DropdownMenuItem>
                            {invoice.status === 'draft' && (
                              <DropdownMenuItem onClick={() => sendInvoiceMutation.mutate(invoice.id)}>
                                <Send className="h-4 w-4 mr-2" />
                                Send to Client
                              </DropdownMenuItem>
                            )}
                            {invoice.amountDue > 0 && (
                              <DropdownMenuItem onClick={() => {
                                setSelectedInvoice(invoice);
                                setPayment({ ...payment, amount: invoice.amountDue });
                                setPaymentDialogOpen(true);
                              }}>
                                <CreditCard className="h-4 w-4 mr-2" />
                                Record Payment
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem>
                              <Download className="h-4 w-4 mr-2" />
                              Download PDF
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem>
                              <RefreshCw className="h-4 w-4 mr-2" />
                              Send Reminder
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Create Invoice Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Create New Invoice</DialogTitle>
            <DialogDescription>
              Generate an invoice from an accepted proposal.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="proposal">Proposal</Label>
              <Select
                value={newInvoice.proposalId}
                onValueChange={(value) => setNewInvoice({ ...newInvoice, proposalId: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a proposal" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="prop-1">Website Redesign - Acme Corp</SelectItem>
                  <SelectItem value="prop-2">Mobile App - TechStart</SelectItem>
                  <SelectItem value="prop-3">E-commerce - RetailMax</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="issueDate">Issue Date</Label>
                <Input
                  id="issueDate"
                  type="date"
                  value={newInvoice.issueDate}
                  onChange={(e) => setNewInvoice({ ...newInvoice, issueDate: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="paymentTerms">Payment Terms</Label>
                <Select
                  value={newInvoice.paymentTerms}
                  onValueChange={(value) => setNewInvoice({ ...newInvoice, paymentTerms: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="due_on_receipt">Due on Receipt</SelectItem>
                    <SelectItem value="net_7">Net 7</SelectItem>
                    <SelectItem value="net_15">Net 15</SelectItem>
                    <SelectItem value="net_30">Net 30</SelectItem>
                    <SelectItem value="net_45">Net 45</SelectItem>
                    <SelectItem value="net_60">Net 60</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes (Optional)</Label>
              <Textarea
                id="notes"
                placeholder="Add any notes or special instructions..."
                value={newInvoice.notes}
                onChange={(e) => setNewInvoice({ ...newInvoice, notes: e.target.value })}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => createInvoiceMutation.mutate(newInvoice)}
              disabled={createInvoiceMutation.isPending || !newInvoice.proposalId}
            >
              {createInvoiceMutation.isPending && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              Create Invoice
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Invoice Dialog */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Invoice {selectedInvoice?.invoiceNumber}</DialogTitle>
            <DialogDescription>
              {selectedInvoice?.proposalTitle}
            </DialogDescription>
          </DialogHeader>

          {selectedInvoice && (
            <div className="space-y-6 py-4">
              <div className="flex justify-between items-start">
                <div>
                  <h4 className="font-semibold">Bill To</h4>
                  <p>{selectedInvoice.clientName}</p>
                  <p className="text-sm text-muted-foreground">{selectedInvoice.clientEmail}</p>
                </div>
                <div className="text-right">
                  {getStatusBadge(selectedInvoice.status)}
                </div>
              </div>

              <Separator />

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Issue Date</p>
                  <p className="font-medium">{new Date(selectedInvoice.issueDate).toLocaleDateString()}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Due Date</p>
                  <p className="font-medium">{new Date(selectedInvoice.dueDate).toLocaleDateString()}</p>
                </div>
              </div>

              <Separator />

              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span>{formatCurrency(selectedInvoice.subtotal, selectedInvoice.currency)}</span>
                </div>
                {selectedInvoice.discount > 0 && (
                  <div className="flex justify-between text-green-600">
                    <span>Discount</span>
                    <span>-{formatCurrency(selectedInvoice.discount, selectedInvoice.currency)}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Tax</span>
                  <span>{formatCurrency(selectedInvoice.tax, selectedInvoice.currency)}</span>
                </div>
                <Separator />
                <div className="flex justify-between text-lg font-bold">
                  <span>Total</span>
                  <span>{formatCurrency(selectedInvoice.total, selectedInvoice.currency)}</span>
                </div>
                {selectedInvoice.amountPaid > 0 && (
                  <>
                    <div className="flex justify-between text-green-600">
                      <span>Amount Paid</span>
                      <span>{formatCurrency(selectedInvoice.amountPaid, selectedInvoice.currency)}</span>
                    </div>
                    <div className="flex justify-between text-orange-600 font-medium">
                      <span>Amount Due</span>
                      <span>{formatCurrency(selectedInvoice.amountDue, selectedInvoice.currency)}</span>
                    </div>
                  </>
                )}
              </div>

              {selectedInvoice.amountDue > 0 && (
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">Payment Progress</p>
                  <Progress 
                    value={(selectedInvoice.amountPaid / selectedInvoice.total) * 100} 
                  />
                  <p className="text-xs text-muted-foreground text-right">
                    {Math.round((selectedInvoice.amountPaid / selectedInvoice.total) * 100)}% paid
                  </p>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setViewDialogOpen(false)}>
              Close
            </Button>
            <Button variant="outline">
              <Download className="h-4 w-4 mr-2" />
              Download PDF
            </Button>
            {selectedInvoice?.status === 'draft' && (
              <Button onClick={() => {
                if (selectedInvoice) {
                  sendInvoiceMutation.mutate(selectedInvoice.id);
                  setViewDialogOpen(false);
                }
              }}>
                <Send className="h-4 w-4 mr-2" />
                Send to Client
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Record Payment Dialog */}
      <Dialog open={paymentDialogOpen} onOpenChange={setPaymentDialogOpen}>
        <DialogContent className="sm:max-w-[450px]">
          <DialogHeader>
            <DialogTitle>Record Payment</DialogTitle>
            <DialogDescription>
              Record a payment for {selectedInvoice?.invoiceNumber}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="amount">Amount</Label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="amount"
                  type="number"
                  className="pl-9"
                  value={payment.amount}
                  onChange={(e) => setPayment({ ...payment, amount: parseFloat(e.target.value) })}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Amount due: {selectedInvoice && formatCurrency(selectedInvoice.amountDue, selectedInvoice.currency)}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="paymentMethod">Payment Method</Label>
              <Select
                value={payment.paymentMethod}
                onValueChange={(value) => setPayment({ ...payment, paymentMethod: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="credit_card">Credit Card</SelectItem>
                  <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                  <SelectItem value="check">Check</SelectItem>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="paypal">PayPal</SelectItem>
                  <SelectItem value="stripe">Stripe</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="reference">Reference / Transaction ID</Label>
              <Input
                id="reference"
                placeholder="e.g., TXN-123456"
                value={payment.reference}
                onChange={(e) => setPayment({ ...payment, reference: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="paymentNotes">Notes (Optional)</Label>
              <Textarea
                id="paymentNotes"
                placeholder="Add any payment notes..."
                value={payment.notes}
                onChange={(e) => setPayment({ ...payment, notes: e.target.value })}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setPaymentDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (selectedInvoice) {
                  recordPaymentMutation.mutate({
                    invoiceId: selectedInvoice.id,
                    data: payment,
                  });
                }
              }}
              disabled={recordPaymentMutation.isPending || payment.amount <= 0}
            >
              {recordPaymentMutation.isPending && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              Record Payment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default InvoiceManagement;
