'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useAuthStore, type AuthState } from '@/lib/auth';
import { api } from '@/lib/api';
import { Loader2, CheckCircle2, Users } from 'lucide-react';

interface InvitePreview {
  teamName: string;
  email: string;
  role: string;
  expiresAt: string;
  inviterName: string;
}

function rememberInviteToken(token: string | null) {
  if (typeof window === 'undefined') {
    return;
  }
  if (token) {
    sessionStorage.setItem('pendingInviteToken', token);
  } else {
    sessionStorage.removeItem('pendingInviteToken');
  }
}

function InviteContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const user = useAuthStore((state: AuthState) => state.user);
  const isAuthenticated = useAuthStore((state: AuthState) => state.isAuthenticated);
  const [preview, setPreview] = useState<InvitePreview | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'accepting' | 'success' | 'error'>(
    token ? 'loading' : 'error',
  );
  const [error, setError] = useState<string | null>(token ? null : 'This invitation link is missing a token');
  const [isAccepting, setIsAccepting] = useState(false);

  useEffect(() => {
    if (!token) {
      return;
    }

    rememberInviteToken(token);
    let cancelled = false;

    const load = async () => {
      try {
        const { data } = await api.get<InvitePreview>(`/team-invites/${token}`);
        if (!cancelled) {
          setPreview(data);
          setStatus('ready');
        }
      } catch (err: unknown) {
        if (!cancelled) {
          setStatus('error');
          setError(
            (err as { response?: { data?: { message?: string } } })?.response?.data?.message
            || 'This invitation is invalid or has expired',
          );
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [token]);

  const acceptInvitation = async () => {
    if (!token) {
      return;
    }

    setIsAccepting(true);
    setError(null);

    try {
      await api.post(`/team-invites/${token}/accept`);
      rememberInviteToken(null);
      setStatus('success');
    } catch (err: unknown) {
      setError(
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message
        || 'Failed to accept invitation',
      );
    } finally {
      setIsAccepting(false);
    }
  };

  if (status === 'loading') {
    return (
      <Card>
        <CardContent className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        </CardContent>
      </Card>
    );
  }

  if (status === 'success') {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-green-600" />
            You joined the team
          </CardTitle>
          <CardDescription>
            {preview?.teamName ? `You now have access to ${preview.teamName}.` : 'The invitation was accepted.'}
          </CardDescription>
        </CardHeader>
        <CardFooter>
          <Button className="w-full" onClick={() => router.push('/team')}>
            Open team
          </Button>
        </CardFooter>
      </Card>
    );
  }

  if (status === 'error' || !preview) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Invitation unavailable</CardTitle>
          <CardDescription>Ask the team admin to send a new invite.</CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </CardContent>
        <CardFooter className="flex justify-center">
          <Link href="/signin" className="text-sm text-blue-600 hover:underline">
            Go to sign in
          </Link>
        </CardFooter>
      </Card>
    );
  }

  const emailMatches = user?.email?.toLowerCase() === preview.email.toLowerCase();
  const query = `token=${encodeURIComponent(token || '')}`;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          Join {preview.teamName}
        </CardTitle>
        <CardDescription>
          {preview.inviterName} invited {preview.email} as {preview.role.toLowerCase()}.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        <p className="text-sm text-muted-foreground">
          This invitation expires {new Date(preview.expiresAt).toLocaleDateString()}.
        </p>
        {isAuthenticated && !emailMatches && (
          <Alert variant="destructive">
            <AlertDescription>
              You are signed in as {user?.email}. Sign in with {preview.email} to accept this invite.
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
      <CardFooter className="flex flex-col gap-3">
        {isAuthenticated && emailMatches ? (
          <Button className="w-full" onClick={acceptInvitation} disabled={isAccepting}>
            {isAccepting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Accept invitation
          </Button>
        ) : (
          <>
            <Button className="w-full" asChild>
              <Link href={`/signup?${query}`}>Create an account</Link>
            </Button>
            <Button variant="outline" className="w-full" asChild>
              <Link href={`/signin?${query}`}>Sign in</Link>
            </Button>
          </>
        )}
      </CardFooter>
    </Card>
  );
}

export default function InvitePage() {
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
      <InviteContent />
    </Suspense>
  );
}
