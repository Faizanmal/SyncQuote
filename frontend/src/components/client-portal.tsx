'use client';

import { useState, useEffect } from 'react';
import { useApi } from '@/hooks/use-api';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Star, Send, FileText, Eye, CheckCircle, Clock } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';
import Link from 'next/link';

interface ClientPortalProps {
  email?: string;
}

export function ClientPortal({ email: initialEmail }: ClientPortalProps) {
  const [email, setEmail] = useState(initialEmail || '');
  const [proposals, setProposals] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(!!initialEmail);
  const api = useApi();

  useEffect(() => {
    if (email && isAuthenticated) {
      loadProposals();
    }
  }, [email, isAuthenticated]);

  const loadProposals = async () => {
    setLoading(true);
    try {
      const data = await api.get(`/client-portal/proposals?email=${email}`);
      setProposals(data.data);
    } catch (error) {
      toast.error('Failed to load proposals');
    } finally {
      setLoading(false);
    }
  };

  const handleEmailSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (email) {
      setIsAuthenticated(true);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'DRAFT':
        return <FileText className="h-4 w-4" />;
      case 'SENT':
        return <Send className="h-4 w-4" />;
      case 'VIEWED':
        return <Eye className="h-4 w-4" />;
      case 'SIGNED':
        return <CheckCircle className="h-4 w-4" />;
      default:
        return <Clock className="h-4 w-4" />;
    }
  };

  const getStatusVariant = (status: string): any => {
    switch (status) {
      case 'DRAFT':
        return 'secondary';
      case 'SENT':
        return 'default';
      case 'VIEWED':
        return 'default';
      case 'SIGNED':
        return 'success';
      case 'APPROVED':
        return 'success';
      default:
        return 'secondary';
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Client Portal</CardTitle>
            <CardDescription>
              Enter your email to view your proposals
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleEmailSubmit} className="space-y-4">
              <div>
                <Label htmlFor="email">Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="your@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <Button type="submit" className="w-full">
                Access Portal
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Your Proposals</h1>
          <p className="text-muted-foreground">
            Viewing proposals for {email}
          </p>
        </div>

        {loading ? (
          <div className="text-center py-12">Loading proposals...</div>
        ) : proposals.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">
                No proposals found for this email address
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {proposals.map((proposal) => (
              <Card
                key={proposal.id}
                className="hover:shadow-lg transition-shadow"
              >
                <CardHeader>
                  <div className="flex items-start justify-between mb-2">
                    <Badge
                      variant={getStatusVariant(proposal.status)}
                      className="flex items-center gap-1"
                    >
                      {getStatusIcon(proposal.status)}
                      {proposal.status}
                    </Badge>
                    {proposal.viewCount > 0 && (
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Eye className="h-3 w-3" />
                        {proposal.viewCount} views
                      </span>
                    )}
                  </div>
                  <CardTitle className="text-lg">{proposal.title}</CardTitle>
                  <CardDescription>
                    From {proposal.user.companyName || proposal.user.name}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="text-sm text-muted-foreground">
                      Created{' '}
                      {formatDistanceToNow(new Date(proposal.createdAt), {
                        addSuffix: true,
                      })}
                    </div>
                    {proposal.expiresAt && (
                      <div className="text-sm text-amber-600">
                        Expires{' '}
                        {formatDistanceToNow(new Date(proposal.expiresAt), {
                          addSuffix: true,
                        })}
                      </div>
                    )}
                    <Link href={`/p/${proposal.slug}`}>
                      <Button className="w-full">View Proposal</Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function ClientFeedbackForm({ proposalId }: { proposalId: string }) {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [clientName, setClientName] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const api = useApi();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      await api.post(`/client-portal/proposal/${proposalId}/feedback`, {
        rating: rating || undefined,
        comment,
        clientName,
        clientEmail,
      });

      toast.success('Feedback submitted successfully!');
      setRating(0);
      setComment('');
    } catch (error) {
      toast.error('Failed to submit feedback');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Leave Feedback</CardTitle>
        <CardDescription>
          Help us improve by sharing your thoughts
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>Your Name</Label>
            <Input
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              required
            />
          </div>

          <div>
            <Label>Your Email</Label>
            <Input
              type="email"
              value={clientEmail}
              onChange={(e) => setClientEmail(e.target.value)}
              required
            />
          </div>

          <div>
            <Label>Rating (Optional)</Label>
            <div className="flex gap-2 mt-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRating(star)}
                  className="focus:outline-none"
                >
                  <Star
                    className={`h-8 w-8 ${
                      star <= rating
                        ? 'fill-yellow-400 text-yellow-400'
                        : 'text-gray-300'
                    }`}
                  />
                </button>
              ))}
            </div>
          </div>

          <div>
            <Label>Comments</Label>
            <Textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Share your thoughts..."
              rows={4}
            />
          </div>

          <Button type="submit" disabled={submitting} className="w-full">
            {submitting ? 'Submitting...' : 'Submit Feedback'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
