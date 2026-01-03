'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  CreditCard,
  DollarSign,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Receipt,
  RefreshCcw,
  Download,
  Building,
  ArrowRight,
  Percent,
  Calendar,
} from 'lucide-react';
import { useApi } from '@/hooks/use-api';
import { toast } from 'sonner';

// Types
interface PaymentScheduleItem {
  id: string;
  name: string;
  amount: number;
  percentage: number;
  dueDate?: string;
  status: 'pending' | 'paid' | 'overdue' | 'cancelled';
  paidAt?: string;
}

interface Payment {
  id: string;
  proposalId: string;
  amount: number;
  currency: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'refunded';
  type: 'deposit' | 'milestone' | 'final';
  stripePaymentIntentId?: string;
  paidAt?: string;
  createdAt: string;
  refundedAt?: string;
  metadata?: {
    customerEmail?: string;
    customerName?: string;
    invoiceNumber?: string;
  };
}

interface PaymentFormProps {
  proposalId: string;
  proposalTitle: string;
  totalAmount: number;
  currency?: string;
  schedule?: PaymentScheduleItem[];
  onPaymentComplete?: (payment: Payment) => void;
}

interface ProposalPaymentDashboardProps {
  proposalId: string;
}

const STATUS_COLORS = {
  pending: 'bg-yellow-500',
  processing: 'bg-blue-500',
  completed: 'bg-green-500',
  failed: 'bg-red-500',
  refunded: 'bg-gray-500',
  paid: 'bg-green-500',
  overdue: 'bg-red-500',
  cancelled: 'bg-gray-500',
};

const STATUS_ICONS = {
  pending: Clock,
  processing: RefreshCcw,
  completed: CheckCircle,
  failed: XCircle,
  refunded: RefreshCcw,
  paid: CheckCircle,
  overdue: AlertCircle,
  cancelled: XCircle,
};

// Payment Form Component (for client-facing portal)
export function PaymentForm({
  proposalId,
  proposalTitle,
  totalAmount,
  currency = 'USD',
  schedule = [],
  onPaymentComplete,
}: PaymentFormProps) {
  const [loading, setLoading] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<string | null>(null);
  const [customAmount, setCustomAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'card' | 'bank'>('card');
  const api = useApi();

  // Calculate pending amount
  const paidAmount = schedule
    .filter((item) => item.status === 'paid')
    .reduce((sum, item) => sum + item.amount, 0);
  const pendingAmount = totalAmount - paidAmount;
  const progressPercentage = (paidAmount / totalAmount) * 100;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const handlePayment = async (amount: number, type: string) => {
    try {
      setLoading(true);
      
      // Create payment intent
      const response = await api.post('/payments/create-intent', {
        proposalId,
        amount,
        currency,
        type,
        paymentMethod,
      });

      // In production, this would redirect to Stripe Checkout or use Stripe Elements
      // For now, simulate payment flow
      const { clientSecret, paymentIntentId } = response.data;
      
      // Here you would integrate with Stripe.js
      // const stripe = await loadStripe(STRIPE_PUBLIC_KEY);
      // const { error } = await stripe.confirmCardPayment(clientSecret, {...});
      
      // Simulate successful payment for demo
      const paymentResponse = await api.post(`/payments/${paymentIntentId}/confirm`);
      
      toast.success('Payment processed successfully!');
      onPaymentComplete?.(paymentResponse.data);
    } catch (error) {
      toast.error('Payment failed. Please try again.');
      console.error('Payment error:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Payment Progress */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5" />
            Payment for: {proposalTitle}
          </CardTitle>
          <CardDescription>
            Total: {formatCurrency(totalAmount)} • Paid: {formatCurrency(paidAmount)} • Remaining: {formatCurrency(pendingAmount)}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Progress value={progressPercentage} className="h-3" />
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>{progressPercentage.toFixed(0)}% paid</span>
            <span>{formatCurrency(pendingAmount)} remaining</span>
          </div>
        </CardContent>
      </Card>

      {/* Payment Schedule */}
      {schedule.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Payment Schedule</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {schedule.map((item) => {
                const StatusIcon = STATUS_ICONS[item.status];
                return (
                  <div
                    key={item.id}
                    className={`flex items-center justify-between p-4 border rounded-lg ${
                      item.status === 'pending' ? 'bg-muted/50' : ''
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      <div
                        className={`p-2 rounded-full ${STATUS_COLORS[item.status]} bg-opacity-10`}
                      >
                        <StatusIcon
                          className={`h-4 w-4 ${
                            item.status === 'paid'
                              ? 'text-green-600'
                              : item.status === 'overdue'
                              ? 'text-red-600'
                              : 'text-yellow-600'
                          }`}
                        />
                      </div>
                      <div>
                        <p className="font-medium">{item.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {item.percentage}% • {item.dueDate && `Due: ${formatDate(item.dueDate)}`}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="font-semibold">{formatCurrency(item.amount)}</p>
                        <Badge variant={item.status === 'paid' ? 'default' : 'secondary'}>
                          {item.status}
                        </Badge>
                      </div>
                      {item.status === 'pending' && (
                        <Button
                          onClick={() => handlePayment(item.amount, item.name.toLowerCase())}
                          disabled={loading}
                        >
                          Pay Now
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quick Payment */}
      <Card>
        <CardHeader>
          <CardTitle>Make a Payment</CardTitle>
          <CardDescription>Choose a payment amount and method</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Payment Method Selection */}
          <div className="space-y-2">
            <Label>Payment Method</Label>
            <div className="grid grid-cols-2 gap-4">
              <div
                onClick={() => setPaymentMethod('card')}
                className={`p-4 border rounded-lg cursor-pointer transition-all ${
                  paymentMethod === 'card' ? 'border-primary bg-primary/5' : 'hover:border-primary/50'
                }`}
              >
                <div className="flex items-center gap-3">
                  <CreditCard className="h-5 w-5" />
                  <div>
                    <p className="font-medium">Credit Card</p>
                    <p className="text-xs text-muted-foreground">Visa, Mastercard, Amex</p>
                  </div>
                </div>
              </div>
              <div
                onClick={() => setPaymentMethod('bank')}
                className={`p-4 border rounded-lg cursor-pointer transition-all ${
                  paymentMethod === 'bank' ? 'border-primary bg-primary/5' : 'hover:border-primary/50'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Building className="h-5 w-5" />
                  <div>
                    <p className="font-medium">Bank Transfer</p>
                    <p className="text-xs text-muted-foreground">ACH Direct Debit</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Amount Selection */}
          <div className="space-y-2">
            <Label>Amount</Label>
            <div className="grid grid-cols-3 gap-2">
              <Button
                variant={selectedPayment === 'remaining' ? 'default' : 'outline'}
                onClick={() => {
                  setSelectedPayment('remaining');
                  setCustomAmount('');
                }}
              >
                Pay Remaining
                <span className="ml-1 text-xs">({formatCurrency(pendingAmount)})</span>
              </Button>
              <Button
                variant={selectedPayment === 'deposit' ? 'default' : 'outline'}
                onClick={() => {
                  setSelectedPayment('deposit');
                  setCustomAmount('');
                }}
              >
                50% Deposit
                <span className="ml-1 text-xs">({formatCurrency(totalAmount * 0.5)})</span>
              </Button>
              <Button
                variant={selectedPayment === 'custom' ? 'default' : 'outline'}
                onClick={() => setSelectedPayment('custom')}
              >
                Custom Amount
              </Button>
            </div>
          </div>

          {selectedPayment === 'custom' && (
            <div className="space-y-2">
              <Label htmlFor="amount">Custom Amount</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                  $
                </span>
                <Input
                  id="amount"
                  type="number"
                  placeholder="0.00"
                  className="pl-7"
                  value={customAmount}
                  onChange={(e) => setCustomAmount(e.target.value)}
                  max={pendingAmount}
                />
              </div>
            </div>
          )}
        </CardContent>
        <CardFooter>
          <Button
            className="w-full"
            size="lg"
            disabled={
              loading ||
              (!selectedPayment && !customAmount) ||
              (selectedPayment === 'custom' && !customAmount)
            }
            onClick={() => {
              let amount = 0;
              if (selectedPayment === 'remaining') amount = pendingAmount;
              else if (selectedPayment === 'deposit') amount = totalAmount * 0.5;
              else if (customAmount) amount = parseFloat(customAmount);
              
              if (amount > 0) {
                handlePayment(amount, selectedPayment || 'custom');
              }
            }}
          >
            {loading ? (
              <>
                <RefreshCcw className="h-4 w-4 mr-2 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <CreditCard className="h-4 w-4 mr-2" />
                Pay{' '}
                {selectedPayment === 'remaining'
                  ? formatCurrency(pendingAmount)
                  : selectedPayment === 'deposit'
                  ? formatCurrency(totalAmount * 0.5)
                  : customAmount
                  ? formatCurrency(parseFloat(customAmount))
                  : ''}
              </>
            )}
          </Button>
        </CardFooter>
      </Card>

      {/* Security Notice */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground justify-center">
        <svg
          className="h-4 w-4"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
        <span>Secure payment powered by Stripe</span>
      </div>
    </div>
  );
}

// Payment Dashboard for Proposal Owner
export function ProposalPaymentDashboard({ proposalId }: ProposalPaymentDashboardProps) {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refundDialog, setRefundDialog] = useState<Payment | null>(null);
  const [refundAmount, setRefundAmount] = useState('');
  const api = useApi();

  useEffect(() => {
    fetchPayments();
  }, [proposalId]);

  const fetchPayments = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/payments/proposal/${proposalId}`);
      setPayments(response.data);
    } catch (error) {
      console.error('Failed to fetch payments:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRefund = async () => {
    if (!refundDialog) return;

    try {
      await api.post(`/payments/${refundDialog.id}/refund`, {
        amount: refundAmount ? parseFloat(refundAmount) : undefined,
      });
      toast.success('Refund processed successfully');
      setRefundDialog(null);
      setRefundAmount('');
      fetchPayments();
    } catch (error) {
      toast.error('Failed to process refund');
    }
  };

  const formatCurrency = (amount: number, currency: string = 'USD') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const totalCollected = payments
    .filter((p) => p.status === 'completed')
    .reduce((sum, p) => sum + p.amount, 0);

  const totalRefunded = payments
    .filter((p) => p.status === 'refunded')
    .reduce((sum, p) => sum + p.amount, 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Collected</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {formatCurrency(totalCollected)}
            </div>
            <p className="text-xs text-muted-foreground">
              {payments.filter((p) => p.status === 'completed').length} successful payments
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Refunded</CardTitle>
            <RefreshCcw className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {formatCurrency(totalRefunded)}
            </div>
            <p className="text-xs text-muted-foreground">
              {payments.filter((p) => p.status === 'refunded').length} refunds issued
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Net Revenue</CardTitle>
            <Receipt className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(totalCollected - totalRefunded)}
            </div>
            <p className="text-xs text-muted-foreground">After refunds</p>
          </CardContent>
        </Card>
      </div>

      {/* Payment History */}
      <Card>
        <CardHeader>
          <CardTitle>Payment History</CardTitle>
          <CardDescription>All payments for this proposal</CardDescription>
        </CardHeader>
        <CardContent>
          {payments.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No payments yet
            </div>
          ) : (
            <div className="space-y-4">
              {payments.map((payment) => {
                const StatusIcon = STATUS_ICONS[payment.status];
                return (
                  <div
                    key={payment.id}
                    className="flex items-center justify-between p-4 border rounded-lg"
                  >
                    <div className="flex items-center gap-4">
                      <div
                        className={`p-2 rounded-full ${STATUS_COLORS[payment.status]} bg-opacity-10`}
                      >
                        <StatusIcon
                          className={`h-4 w-4 ${
                            payment.status === 'completed'
                              ? 'text-green-600'
                              : payment.status === 'failed'
                              ? 'text-red-600'
                              : payment.status === 'refunded'
                              ? 'text-gray-600'
                              : 'text-blue-600'
                          }`}
                        />
                      </div>
                      <div>
                        <p className="font-medium">
                          {payment.type.charAt(0).toUpperCase() + payment.type.slice(1)} Payment
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {payment.metadata?.customerEmail || 'Unknown'}
                          {payment.metadata?.invoiceNumber && ` • ${payment.metadata.invoiceNumber}`}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatDate(payment.paidAt || payment.createdAt)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="font-semibold">
                          {formatCurrency(payment.amount, payment.currency)}
                        </p>
                        <Badge
                          variant={
                            payment.status === 'completed'
                              ? 'default'
                              : payment.status === 'failed'
                              ? 'destructive'
                              : 'secondary'
                          }
                        >
                          {payment.status}
                        </Badge>
                      </div>
                      {payment.status === 'completed' && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setRefundDialog(payment)}
                        >
                          Refund
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Refund Dialog */}
      <Dialog open={!!refundDialog} onOpenChange={() => setRefundDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Process Refund</DialogTitle>
            <DialogDescription>
              Refund payment of {refundDialog && formatCurrency(refundDialog.amount, refundDialog.currency)}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Refund Amount</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                  $
                </span>
                <Input
                  type="number"
                  placeholder={`Full refund: ${refundDialog?.amount}`}
                  className="pl-7"
                  value={refundAmount}
                  onChange={(e) => setRefundAmount(e.target.value)}
                  max={refundDialog?.amount}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Leave empty for full refund
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRefundDialog(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleRefund}>
              Process Refund
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Export both components
export { PaymentForm as default };
