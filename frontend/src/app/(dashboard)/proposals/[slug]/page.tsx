'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Switch } from '@/components/ui/switch';
import { TiptapEditor } from '@/components/tiptap-editor';
import { PricingTable, PricingItem } from '@/components/pricing-table';
import { api } from '@/lib/api';
import { ArrowLeft, Save, Send, Eye, Copy, Link2 } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';

const proposalSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  clientName: z.string().min(1, 'Client name is required'),
  clientEmail: z.string().email('Invalid email address'),
});

type ProposalFormData = z.infer<typeof proposalSchema>;

export default function ProposalDetailsPage() {
  const router = useRouter();
  const params = useParams();
  const slug = params.slug as string;
  const queryClient = useQueryClient();

  const [content, setContent] = useState('');
  const [pricingItems, setPricingItems] = useState<PricingItem[]>([]);
  const [depositRequired, setDepositRequired] = useState(false);
  const [depositPercentage, setDepositPercentage] = useState(50);
  const [error, setError] = useState<string | null>(null);

  const { register, handleSubmit, reset, formState: { errors } } = useForm<ProposalFormData>({
    resolver: zodResolver(proposalSchema),
  });

  const { data: proposal, isLoading } = useQuery({
    queryKey: ['proposals', slug],
    queryFn: async () => {
      const response = await api.get(`/proposals/${slug}`);
      return response.data;
    },
    enabled: !!slug,
  });

  useEffect(() => {
    if (proposal) {
      reset({
        title: proposal.title,
        clientName: proposal.clientName || '',
        clientEmail: proposal.clientEmail || '',
      });
      setContent(proposal.content || '');
      setPricingItems(proposal.pricingItems || []);
      setDepositRequired(!!proposal.depositRequired);
      setDepositPercentage(proposal.depositPercentage || 50);
    }
  }, [proposal, reset]);

  const updateProposal = useMutation({
    mutationFn: async (data: {
      title: string;
      clientName: string;
      clientEmail: string;
      status: string;
      content: string;
      pricingItems: PricingItem[];
      depositRequired: boolean;
      depositPercentage: number | null;
    }) => {
      const response = await api.patch(`/proposals/${proposal.id}`, data);
      return response.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['proposals', slug] });
      queryClient.invalidateQueries({ queryKey: ['proposals', 'recent'] });
      toast.success('Proposal updated successfully');

      if (data.slug && data.slug !== slug) {
        router.push(`/proposals/${data.slug}`);
      }
    },
    onError: (err: unknown) => {
      const error = err as { response?: { data?: { message?: string | string[] } } };
      const message = error.response?.data?.message;
      const text = Array.isArray(message)
        ? message.join(', ')
        : message || 'Failed to update proposal';
      setError(text);
      toast.error(text);
    },
  });

  const sendProposal = useMutation({
    mutationFn: async (data: ProposalFormData) => {
      await api.patch(`/proposals/${proposal.id}`, {
        ...data,
        status: proposal.status === 'SENT' ? 'SENT' : 'DRAFT',
        content,
        pricingItems,
        depositRequired,
        depositPercentage: depositRequired ? depositPercentage : null,
      });
      const response = await api.post(`/proposals/${proposal.id}/send`);
      return response.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['proposals', slug] });
      queryClient.invalidateQueries({ queryKey: ['proposals', 'recent'] });
      const emailNote =
        data.emailSent === false
          ? ' Email was skipped (no email provider). Public link copied if available.'
          : '';
      toast.success(`Proposal sent to client.${emailNote}`);
      if (data.publicUrl) {
        void navigator.clipboard?.writeText(data.publicUrl).catch(() => undefined);
      }
    },
    onError: (err: unknown) => {
      const error = err as { response?: { data?: { message?: string | string[] } } };
      const message = error.response?.data?.message;
      const text = Array.isArray(message)
        ? message.join(', ')
        : message || 'Failed to send proposal';
      setError(text);
      toast.error(text);
    },
  });

  const onSaveDraft = async (data: ProposalFormData) => {
    if (!proposal) return;
    setError(null);
    updateProposal.mutate({
      ...data,
      status: 'DRAFT',
      content,
      pricingItems,
      depositRequired,
      depositPercentage: depositRequired ? depositPercentage : null,
    });
  };

  const onSend = async (data: ProposalFormData) => {
    if (!proposal) return;
    setError(null);

    if (!content.trim() && pricingItems.length === 0) {
      setError('Add proposal content or pricing before sending');
      toast.error('Add proposal content or pricing before sending');
      return;
    }

    sendProposal.mutate(data);
  };

  const copyPublicLink = async () => {
    const url = `${window.location.origin}/p/${proposal?.slug || slug}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success('Public link copied');
    } catch {
      toast.error('Could not copy link');
    }
  };

  const isPending = updateProposal.isPending || sendProposal.isPending;

  if (isLoading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <div className="text-gray-500">Loading proposal...</div>
      </div>
    );
  }

  if (!proposal) {
    return (
      <div className="flex h-[50vh] flex-col items-center justify-center gap-4">
        <div className="text-xl font-semibold text-gray-700">Proposal not found</div>
        <Link href="/dashboard">
          <Button>Return to Dashboard</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="border-b bg-white dark:bg-gray-950 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <Link href="/dashboard">
                <Button variant="ghost" size="sm">
                  <ArrowLeft className="h-4 w-4" />
                </Button>
              </Link>
              <div>
                <h1 className="text-xl font-semibold">Edit Proposal</h1>
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Link2 className="h-3 w-3" />
                  Status: {proposal.status}
                  {proposal.viewCount != null ? ` · ${proposal.viewCount} views` : ''}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {(() => {
                    const acceptedAt = proposal.signedAt || proposal.approvedAt;
                    const parts = [
                      proposal.sentAt
                        ? `Sent ${new Date(proposal.sentAt).toLocaleString()}`
                        : null,
                      acceptedAt
                        ? `Accepted by ${proposal.signerName || proposal.clientName || 'client'} ${new Date(acceptedAt).toLocaleString()}`
                        : null,
                      proposal.depositPaid
                        ? `Deposit paid${
                            proposal.depositPaidAt
                              ? ` ${new Date(proposal.depositPaidAt).toLocaleString()}`
                              : ''
                          }`
                        : null,
                    ].filter(Boolean);
                    return parts.length ? parts.join(' · ') : 'Not sent yet';
                  })()}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={copyPublicLink}>
                <Copy className="mr-2 h-4 w-4" />
                Copy Link
              </Button>
              <Button
                variant="outline"
                onClick={() => window.open(`/p/${proposal.slug || slug}`, '_blank')}
              >
                <Eye className="mr-2 h-4 w-4" />
                Preview
              </Button>
              <Button
                variant="outline"
                onClick={handleSubmit(onSaveDraft)}
                disabled={isPending}
              >
                <Save className="mr-2 h-4 w-4" />
                Save Draft
              </Button>
              <Button onClick={handleSubmit(onSend)} disabled={isPending}>
                <Send className="mr-2 h-4 w-4" />
                Send to Client
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Proposal Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">Proposal Title</Label>
                <Input
                  id="title"
                  placeholder="Website Redesign Project"
                  {...register('title')}
                />
                {errors.title && (
                  <p className="text-sm text-red-500">{errors.title.message}</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="clientName">Client Name</Label>
                  <Input
                    id="clientName"
                    placeholder="Acme Corp"
                    {...register('clientName')}
                  />
                  {errors.clientName && (
                    <p className="text-sm text-red-500">{errors.clientName.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="clientEmail">Client Email</Label>
                  <Input
                    id="clientEmail"
                    type="email"
                    placeholder="client@example.com"
                    {...register('clientEmail')}
                  />
                  {errors.clientEmail && (
                    <p className="text-sm text-red-500">{errors.clientEmail.message}</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Proposal Content</CardTitle>
            </CardHeader>
            <CardContent>
              <TiptapEditor
                content={content}
                onChange={setContent}
                placeholder="Describe your proposal, services, timeline, and deliverables..."
              />
            </CardContent>
          </Card>

          <PricingTable
            items={pricingItems}
            onChange={setPricingItems}
            editable={true}
          />

          <Card>
            <CardHeader>
              <CardTitle>Deposit</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <Label htmlFor="depositRequired">Require deposit after acceptance</Label>
                  <p className="text-sm text-muted-foreground">
                    Client can pay via Stripe Checkout on the public proposal page.
                  </p>
                </div>
                <Switch
                  id="depositRequired"
                  checked={depositRequired}
                  onCheckedChange={setDepositRequired}
                />
              </div>
              {depositRequired && (
                <div className="space-y-2 max-w-xs">
                  <Label htmlFor="depositPercentage">Deposit percentage</Label>
                  <Input
                    id="depositPercentage"
                    type="number"
                    min={1}
                    max={100}
                    value={depositPercentage}
                    onChange={(e) => setDepositPercentage(Number(e.target.value) || 50)}
                  />
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
