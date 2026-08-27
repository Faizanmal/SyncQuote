'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { api } from '@/lib/api';
import { unwrapList } from '@/lib/pagination';
import { useAuthStore, type AuthState } from '@/lib/auth';
import { 
  FileText, 
  Eye, 
  CheckCircle2, 
  XCircle, 
  Clock,
  Plus,
  TrendingUp
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface Proposal {
  id: string;
  title: string;
  slug: string;
  status: 'DRAFT' | 'SENT' | 'VIEWED' | 'APPROVED' | 'DECLINED' | 'SIGNED';
  viewCount: number;
  createdAt: string;
  updatedAt: string;
}

interface OverviewMetrics {
  totalProposals: number;
  sentProposals: number;
  approvedProposals: number;
  totalViews: number;
}

const statusConfig = {
  DRAFT: { label: 'Draft', variant: 'secondary' as const, icon: Clock },
  SENT: { label: 'Sent', variant: 'default' as const, icon: FileText },
  VIEWED: { label: 'Viewed', variant: 'default' as const, icon: Eye },
  APPROVED: { label: 'Approved', variant: 'default' as const, icon: CheckCircle2 },
  DECLINED: { label: 'Declined', variant: 'destructive' as const, icon: XCircle },
  SIGNED: { label: 'Signed', variant: 'default' as const, icon: CheckCircle2 },
};

export default function DashboardPage() {
  const user = useAuthStore((state: AuthState) => state.user);

  const { data: metrics } = useQuery<OverviewMetrics>({
    queryKey: ['analytics', 'overview'],
    queryFn: async () => {
      const response = await api.get('/analytics/overview');
      return response.data;
    },
  });

  const { data: proposals, isLoading: proposalsLoading } = useQuery<Proposal[]>({
    queryKey: ['proposals', 'recent'],
    queryFn: async () => {
      const response = await api.get('/proposals', { params: { page: 1, limit: 5 } });
      return unwrapList<Proposal>(response.data);
    },
  });

  const stats: OverviewMetrics = {
    totalProposals: metrics?.totalProposals || 0,
    sentProposals: metrics?.sentProposals || 0,
    approvedProposals: metrics?.approvedProposals || 0,
    totalViews: metrics?.totalViews || 0,
  };

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          Welcome back, {user?.name}
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          Here&apos;s what&apos;s happening with your proposals
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Proposals</CardTitle>
            <FileText className="h-4 w-4 text-gray-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalProposals}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Sent</CardTitle>
            <TrendingUp className="h-4 w-4 text-gray-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.sentProposals}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Approved</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.approvedProposals}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Views</CardTitle>
            <Eye className="h-4 w-4 text-gray-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalViews}</div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Proposals */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Recent Proposals</CardTitle>
              <CardDescription>Your latest proposal activity</CardDescription>
            </div>
            <Button asChild>
              <Link href="/proposals/new">
                <Plus className="mr-2 h-4 w-4" />
                New Proposal
              </Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {proposalsLoading ? (
            <div className="text-center py-8 text-gray-500">Loading...</div>
          ) : !proposals || proposals.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="mx-auto h-12 w-12 text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                No proposals yet
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                Get started by creating your first proposal
              </p>
              <Button asChild>
                <Link href="/proposals/new">
                  <Plus className="mr-2 h-4 w-4" />
                  Create Proposal
                </Link>
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {proposals.slice(0, 5).map((proposal) => {
                const StatusIcon = statusConfig[proposal.status]?.icon || Clock;
                return (
                  <div
                    key={proposal.id}
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                  >
                    <div className="flex items-center gap-4 flex-1">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900">
                        <FileText className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                      </div>
                      <div className="flex-1">
                        <Link
                          href={`/proposals/${proposal.slug}`}
                          className="font-medium text-gray-900 dark:text-white hover:text-blue-600"
                        >
                          {proposal.title}
                        </Link>
                        <div className="flex items-center gap-4 mt-1 text-sm text-gray-500">
                          <span className="flex items-center gap-1">
                            <Eye className="h-3 w-3" />
                            {proposal.viewCount} views
                          </span>
                          <span>
                            Updated {formatDistanceToNow(new Date(proposal.updatedAt), { addSuffix: true })}
                          </span>
                        </div>
                      </div>
                    </div>
                    <Badge variant={statusConfig[proposal.status]?.variant || 'secondary'}>
                      <StatusIcon className="mr-1 h-3 w-3" />
                      {statusConfig[proposal.status]?.label || proposal.status}
                    </Badge>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
