'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { api } from '@/lib/api';
import {
  Plus,
  Search,
  MoreVertical,
  Eye,
  Edit,
  Trash2,
  Copy,
  Send,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface Proposal {
  id: string;
  title: string;
  slug: string;
  status: 'DRAFT' | 'SENT' | 'VIEWED' | 'APPROVED' | 'DECLINED';
  viewCount: number;
  createdAt: string;
  updatedAt: string;
}

const statusConfig = {
  DRAFT: { label: 'Draft', variant: 'secondary' as const },
  SENT: { label: 'Sent', variant: 'default' as const },
  VIEWED: { label: 'Viewed', variant: 'default' as const },
  APPROVED: { label: 'Approved', variant: 'default' as const },
  DECLINED: { label: 'Declined', variant: 'destructive' as const },
};

export default function ProposalsPage() {
  const [searchTerm, setSearchTerm] = useState('');

  const { data: proposals, isLoading } = useQuery<Proposal[]>({
    queryKey: ['proposals'],
    queryFn: async () => {
      const response = await api.get('/proposals');
      return response.data;
    },
  });

  const filteredProposals = proposals?.filter((proposal) =>
    proposal.title.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const copyLink = (slug: string) => {
    const url = `${window.location.origin}/p/${slug}`;
    navigator.clipboard.writeText(url);
  };

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Proposals
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Manage and track all your proposals
          </p>
        </div>
        <Button asChild>
          <Link href="/proposals/new">
            <Plus className="mr-2 h-4 w-4" />
            New Proposal
          </Link>
        </Button>
      </div>

      <div className="mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search proposals..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      <div className="bg-white dark:bg-gray-950 rounded-lg border">
        {isLoading ? (
          <div className="text-center py-12 text-gray-500">Loading...</div>
        ) : !filteredProposals || filteredProposals.length === 0 ? (
          <div className="text-center py-12">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              {searchTerm ? 'No proposals found' : 'No proposals yet'}
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              {searchTerm
                ? 'Try adjusting your search'
                : 'Get started by creating your first proposal'}
            </p>
            {!searchTerm && (
              <Button asChild>
                <Link href="/proposals/new">
                  <Plus className="mr-2 h-4 w-4" />
                  Create Proposal
                </Link>
              </Button>
            )}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Views</TableHead>
                <TableHead>Last Updated</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredProposals.map((proposal) => (
                <TableRow key={proposal.id}>
                  <TableCell>
                    <Link
                      href={`/proposals/${proposal.slug}`}
                      className="font-medium text-gray-900 dark:text-white hover:text-blue-600"
                    >
                      {proposal.title}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Badge variant={statusConfig[proposal.status].variant}>
                      {statusConfig[proposal.status].label}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1 text-gray-600 dark:text-gray-400">
                      <Eye className="h-4 w-4" />
                      {proposal.viewCount}
                    </div>
                  </TableCell>
                  <TableCell className="text-gray-600 dark:text-gray-400">
                    {formatDistanceToNow(new Date(proposal.updatedAt), {
                      addSuffix: true,
                    })}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem asChild>
                          <Link href={`/p/${proposal.slug}`}>
                            <Eye className="mr-2 h-4 w-4" />
                            View
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <Link href={`/proposals/${proposal.slug}/edit`}>
                            <Edit className="mr-2 h-4 w-4" />
                            Edit
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => copyLink(proposal.slug)}>
                          <Copy className="mr-2 h-4 w-4" />
                          Copy Link
                        </DropdownMenuItem>
                        {proposal.status === 'DRAFT' && (
                          <DropdownMenuItem>
                            <Send className="mr-2 h-4 w-4" />
                            Send
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem className="text-red-600">
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
