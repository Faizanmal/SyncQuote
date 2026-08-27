'use client';

import { useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { api } from '@/lib/api';
import { Loader2, CheckCircle2 } from 'lucide-react';

export default function PublicInvoicePage() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const paid = searchParams.get('payment') === 'success';
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: invoice, isLoading } = useQuery({
    queryKey: ['public-invoice', params.id],
    enabled: Boolean(params.id),
    queryFn: async () => {
      const { data } = await api.get(`/invoices/public/${params.id}`);
      return data;
    },
  });

  const pay = async () => {
    setPaying(true);
    setError(null);
    try {
      const { data } = await api.post(`/invoices/public/${params.id}/checkout`, {
        successUrl: `${window.location.origin}/invoices/${params.id}?payment=success`,
        cancelUrl: `${window.location.origin}/invoices/${params.id}?payment=canceled`,
      });
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (err: unknown) {
      setError((err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Could not start payment');
    } finally {
      setPaying(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle>Invoice not found</CardTitle>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
      <Card className="max-w-xl mx-auto">
        <CardHeader>
          <CardTitle>Invoice {invoice.invoiceNumber}</CardTitle>
          <CardDescription>
            From {invoice.providerCompany || invoice.providerName} to {invoice.clientName}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {paid || invoice.status === 'paid' ? (
            <Alert>
              <CheckCircle2 className="h-4 w-4" />
              <AlertDescription>This invoice is paid. Thank you.</AlertDescription>
            </Alert>
          ) : (
            <>
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              <p className="text-2xl font-semibold">${Number(invoice.amountDue).toLocaleString()}</p>
              <p className="text-sm text-muted-foreground">
                Due {new Date(invoice.dueDate).toLocaleDateString()}
              </p>
              <Button onClick={pay} disabled={paying} className="w-full">
                {paying && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Pay with Stripe
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
