'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Switch } from '@/components/ui/switch';
import { TiptapEditor } from '@/components/tiptap-editor';
import { PricingTable, PricingItem } from '@/components/pricing-table';
import { api } from '@/lib/api';
import { ArrowLeft, Save, Send } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';

const proposalSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  clientName: z.string().min(1, 'Client name is required'),
  clientEmail: z.string().email('Invalid email address'),
});

type ProposalFormData = z.infer<typeof proposalSchema>;

export default function NewProposalPage() {
  const router = useRouter();
  const [content, setContent] = useState('');
  const [pricingItems, setPricingItems] = useState<PricingItem[]>([]);
  const [depositRequired, setDepositRequired] = useState(false);
  const [depositPercentage, setDepositPercentage] = useState(50);
  const [error, setError] = useState<string | null>(null);

  const { register, handleSubmit, formState: { errors } } = useForm<ProposalFormData>({
    resolver: zodResolver(proposalSchema),
  });

  const createProposal = useMutation({
    mutationFn: async (payload: {
      title: string;
      clientName: string;
      clientEmail: string;
      status: string;
      content: string;
      pricingItems: PricingItem[];
      depositRequired: boolean;
      depositPercentage: number | null;
      sendAfterCreate?: boolean;
    }) => {
      const { sendAfterCreate, ...data } = payload;
      const response = await api.post('/proposals', data);
      const proposal = response.data;

      if (sendAfterCreate && proposal?.id) {
        const sendResponse = await api.post(`/proposals/${proposal.id}/send`);
        return sendResponse.data;
      }

      return proposal;
    },
    onSuccess: (data, variables) => {
      if (variables.sendAfterCreate) {
        const emailNote = data.emailSent === false
          ? ' (email skipped — configure SendGrid or share the link manually)'
          : '';
        toast.success(`Proposal sent${emailNote}`);
        if (data.publicUrl) {
          void navigator.clipboard?.writeText(data.publicUrl).catch(() => undefined);
        }
      } else {
        toast.success('Proposal saved as draft');
      }
      router.push(`/proposals/${data.slug}`);
    },
    onError: (err: unknown) => {
      const error = err as {
        response?: { status?: number; data?: { message?: string | string[] } };
      };
      const message = error.response?.data?.message;
      const text = Array.isArray(message)
        ? message.join(', ')
        : message || 'Failed to create proposal';
      setError(text);
      toast.error(text);
      if (error.response?.status === 403 && /limit|upgrade/i.test(text)) {
        toast.message('Open Billing to upgrade', {
          action: {
            label: 'Billing',
            onClick: () => router.push('/settings/billing'),
          },
        });
      }
    },
  });

  const onSubmit = async (data: ProposalFormData, status: 'DRAFT' | 'SENT') => {
    setError(null);

    if (status === 'SENT' && !content.trim() && pricingItems.length === 0) {
      setError('Add proposal content or pricing before sending');
      toast.error('Add proposal content or pricing before sending');
      return;
    }

    createProposal.mutate({
      ...data,
      status: 'DRAFT',
      content,
      pricingItems,
      depositRequired,
      depositPercentage: depositRequired ? depositPercentage : null,
      sendAfterCreate: status === 'SENT',
    });
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="border-b bg-white dark:bg-gray-950 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <Link href="/proposals">
                <Button variant="ghost" size="sm">
                  <ArrowLeft className="h-4 w-4" />
                </Button>
              </Link>
              <h1 className="text-xl font-semibold">New Proposal</h1>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={handleSubmit((data) => onSubmit(data, 'DRAFT'))}
                disabled={createProposal.isPending}
              >
                <Save className="mr-2 h-4 w-4" />
                Save Draft
              </Button>
              <Button
                onClick={handleSubmit((data) => onSubmit(data, 'SENT'))}
                disabled={createProposal.isPending}
              >
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
