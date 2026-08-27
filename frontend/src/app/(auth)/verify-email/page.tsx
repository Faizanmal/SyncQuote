'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { api } from '@/lib/api';
import { Loader2, Mail, CheckCircle2, ArrowLeft } from 'lucide-react';

const resendSchema = z.object({
  email: z.string().email('Invalid email address'),
});

type ResendFormData = z.infer<typeof resendSchema>;

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const [status, setStatus] = useState<'verifying' | 'success' | 'error' | 'missing'>(
    token ? 'verifying' : 'missing',
  );
  const [error, setError] = useState<string | null>(null);
  const [resendSuccess, setResendSuccess] = useState(false);
  const [isResending, setIsResending] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm<ResendFormData>({
    resolver: zodResolver(resendSchema),
  });

  useEffect(() => {
    if (!token) {
      return;
    }

    let cancelled = false;

    const verify = async () => {
      try {
        await api.post('/auth/verify-email', { token });
        if (!cancelled) {
          setStatus('success');
        }
      } catch (err: unknown) {
        if (!cancelled) {
          setStatus('error');
          setError(
            (err as { response?: { data?: { message?: string } } })?.response?.data?.message
            || 'This verification link is invalid or has expired',
          );
        }
      }
    };

    void verify();

    return () => {
      cancelled = true;
    };
  }, [token]);

  const onResend = async (data: ResendFormData) => {
    setIsResending(true);
    setError(null);
    setResendSuccess(false);

    try {
      await api.post('/auth/verify-email/resend', { email: data.email });
      setResendSuccess(true);
    } catch (err: unknown) {
      setError(
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message
        || 'Failed to resend verification email',
      );
    } finally {
      setIsResending(false);
    }
  };

  if (status === 'verifying') {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-center">Verifying your email</CardTitle>
          <CardDescription className="text-center">
            Please wait while we confirm your address
          </CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center py-6">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        </CardContent>
      </Card>
    );
  }

  if (status === 'success') {
    return (
      <Card>
        <CardHeader>
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
            <CheckCircle2 className="h-6 w-6 text-green-600" />
          </div>
          <CardTitle className="text-center">Email verified</CardTitle>
          <CardDescription className="text-center">
            Your account is ready to use
          </CardDescription>
        </CardHeader>
        <CardFooter className="flex justify-center">
          <Link href="/signin">
            <Button>Continue to sign in</Button>
          </Link>
        </CardFooter>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Verify your email</CardTitle>
        <CardDescription>
          {status === 'missing'
            ? 'This page needs a verification link from your signup email'
            : 'That link is no longer valid. Request a new one below'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onResend)} className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          {resendSuccess && (
            <Alert>
              <AlertDescription>
                If that email exists and is unverified, we sent a new link.
              </AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                className="pl-10"
                {...register('email')}
              />
            </div>
            {errors.email && (
              <p className="text-sm text-red-500">{errors.email.message}</p>
            )}
          </div>

          <Button type="submit" className="w-full" disabled={isResending}>
            {isResending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Resend verification email
          </Button>
        </form>
      </CardContent>
      <CardFooter className="flex justify-center">
        <Link href="/signin">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to sign in
          </Button>
        </Link>
      </CardFooter>
    </Card>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense
      fallback={
        <Card>
          <CardContent className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
          </CardContent>
        </Card>
      }
    >
      <VerifyEmailContent />
    </Suspense>
  );
}
