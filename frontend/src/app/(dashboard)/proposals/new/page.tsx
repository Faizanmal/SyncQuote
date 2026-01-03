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
  const [error, setError] = useState<string | null>(null);

  const { register, handleSubmit, formState: { errors } } = useForm<ProposalFormData>({
    resolver: zodResolver(proposalSchema),
  });

  const createProposal = useMutation({
    mutationFn: async (data: { title: string; clientName: string; clientEmail: string; status: string }) => {
      const response = await api.post('/proposals', data);
      return response.data;
    },
    onSuccess: (data) => {
      toast.success('Proposal created successfully');
      router.push(`/proposals/${data.slug}`);
    },
    onError: (err: unknown) => {
      const error = err as { response?: { data?: { message?: string } } };
      setError(error.response?.data?.message || 'Failed to create proposal');
      toast.error('Failed to create proposal');
    },
  });

  const onSubmit = async (data: ProposalFormData, status: 'DRAFT' | 'SENT') => {
    setError(null);
    createProposal.mutate({ ...data, status });
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
          {/* Basic Information */}
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

          {/* Content Editor */}
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

          {/* Pricing Table */}
          <PricingTable
            items={pricingItems}
            onChange={setPricingItems}
            editable={true}
          />
        </div>
      </div>
    </div>
  );
}
