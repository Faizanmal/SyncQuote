'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuthStore, type AuthState, type User } from '@/lib/auth';
import { api } from '@/lib/api';
import { Loader2 } from 'lucide-react';

function AuthCallback() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const setAuth = useAuthStore((state: AuthState) => state.setAuth);
  const [error, setError] = useState<string | null>(null);

  const token = searchParams.get('token');

  useEffect(() => {
    if (!token) {
      return;
    }

    const completeSignin = async () => {
      try {
        const response = await api.get<User>('/users/profile', {
          headers: { Authorization: `Bearer ${token}` },
        });
        setAuth(response.data, token);

        const inviteToken = sessionStorage.getItem('pendingInviteToken');
        if (inviteToken) {
          try {
            await api.post(`/team-invites/${inviteToken}/accept`, {}, {
              headers: { Authorization: `Bearer ${token}` },
            });
          } catch {
            // Email-matched pending invites are also applied during Google auth.
          }
          sessionStorage.removeItem('pendingInviteToken');
          router.replace('/team');
          return;
        }

        router.replace('/dashboard');
      } catch {
        setError('Failed to complete sign in. Please try again.');
      }
    };

    void completeSignin();
  }, [token, setAuth, router]);

  if (!token || error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4">
        <p className="text-red-500">{error || 'Missing authentication token.'}</p>
        <button
          onClick={() => router.replace('/signin')}
          className="text-blue-600 hover:underline"
        >
          Back to sign in
        </button>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4">
      <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      <p className="text-gray-600 dark:text-gray-400">Completing sign in...</p>
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        </div>
      }
    >
      <AuthCallback />
    </Suspense>
  );
}
