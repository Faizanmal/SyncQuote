'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { api } from '@/lib/api';
import { CheckCircle2, Loader2 } from 'lucide-react';

export default function PublicContractPage() {
  const params = useParams<{ id: string }>();
  const [signerName, setSignerName] = useState('');
  const [signerEmail, setSignerEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [signed, setSigned] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const { data: contract, isLoading } = useQuery({
    queryKey: ['public-contract', params.id],
    enabled: Boolean(params.id),
    queryFn: async () => {
      const { data } = await api.get(`/contracts/${params.id}`);
      return data;
    },
  });

  const sign = async () => {
    setSubmitting(true);
    setError(null);
    try {
      await api.post(`/contracts/${params.id}/sign`, {
        signatureUrl: `typed:${signerName}`,
        signerName,
        signerEmail,
      });
      setSigned(true);
    } catch (err: unknown) {
      setError((err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Could not sign contract');
    } finally {
      setSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!contract) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle>Contract not found</CardTitle>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
      <Card className="max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle>{contract.title}</CardTitle>
          <CardDescription>Review the agreement and sign below</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <pre className="whitespace-pre-wrap text-sm bg-muted p-4 rounded-md max-h-96 overflow-auto">
            {contract.content}
          </pre>
          {signed || contract.status === 'signed' ? (
            <Alert>
              <CheckCircle2 className="h-4 w-4" />
              <AlertDescription>This contract has been signed.</AlertDescription>
            </Alert>
          ) : (
            <>
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              <div className="space-y-2">
                <Label htmlFor="signerName">Full name</Label>
                <Input id="signerName" value={signerName} onChange={(e) => setSignerName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="signerEmail">Email</Label>
                <Input id="signerEmail" type="email" value={signerEmail} onChange={(e) => setSignerEmail(e.target.value)} />
              </div>
              <Button className="w-full" onClick={sign} disabled={submitting || !signerName || !signerEmail}>
                {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Sign contract
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
