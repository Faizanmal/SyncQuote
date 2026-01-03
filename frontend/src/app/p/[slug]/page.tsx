'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { TiptapEditor } from '@/components/tiptap-editor';
import { PricingTable, PricingItem } from '@/components/pricing-table';
import { SignatureCanvas } from '@/components/signature-canvas';
import { PaymentForm } from '@/components/payment-integration';
import { api } from '@/lib/api';
import { formatDistanceToNow } from 'date-fns';
import {
  CheckCircle2,
  MessageSquare,
  Send,
  FileText,
  Calendar,
  User,
  Mail,
  Download,
  CreditCard,
} from 'lucide-react';
import { toast } from 'sonner';
import io from 'socket.io-client';

interface ProposalData {
  id: string;
  title: string;
  slug: string;
  content: string;
  status: 'DRAFT' | 'SENT' | 'VIEWED' | 'APPROVED' | 'DECLINED';
  clientName: string;
  clientEmail: string;
  companyLogo?: string;
  companyName?: string;
  viewCount: number;
  createdAt: string;
  updatedAt: string;
  pricingItems: PricingItem[];
  comments: Comment[];
  depositRequired?: boolean;
  depositPercentage?: number;
  currency?: string;
  signature?: {
    signatureData: string;
    signedAt: string;
    ipAddress: string;
  };
}

interface Comment {
  id: string;
  author: string;
  content: string;
  createdAt: string;
}

export default function PublicProposalPage() {
  const params = useParams();
  const slug = params.slug as string;
  const [newComment, setNewComment] = useState('');
  const [showSignature, setShowSignature] = useState(false);
  const [showPayment, setShowPayment] = useState(false);
  const [pricingItems, setPricingItems] = useState<PricingItem[]>([]);
  const socketRef = useRef<any>(null);
  const sessionIdRef = useRef<string | null>(null);
  const startTimeRef = useRef<number>(Date.now());

  const { data: proposal, isLoading, refetch } = useQuery<ProposalData>({
    queryKey: ['proposal', slug],
    queryFn: async () => {
      const response = await api.get(`/proposals/public/${slug}`);
      setPricingItems(response.data.pricingItems || []);
      return response.data;
    },
    enabled: !!slug,
  });

  // View Analytics Tracking
  const startSession = useCallback(async () => {
    if (!proposal?.id) return;
    
    try {
      const response = await api.post('/view-analytics/session/start', {
        proposalId: proposal.id,
        viewerEmail: proposal.clientEmail,
        viewerName: proposal.clientName,
        referrer: document.referrer || undefined,
      });
      sessionIdRef.current = response.data.sessionId;
    } catch (error) {
      console.error('Failed to start tracking session:', error);
    }
  }, [proposal?.id, proposal?.clientEmail, proposal?.clientName]);

  const updateSession = useCallback(async () => {
    if (!sessionIdRef.current) return;
    
    const duration = Math.floor((Date.now() - startTimeRef.current) / 1000);
    const scrollDepth = Math.round(
      (window.scrollY / (document.documentElement.scrollHeight - window.innerHeight)) * 100
    );
    
    try {
      await api.post('/view-analytics/session/update', {
        sessionId: sessionIdRef.current,
        duration,
        scrollDepth: Math.min(100, Math.max(0, scrollDepth || 0)),
      });
    } catch (error) {
      console.error('Failed to update session:', error);
    }
  }, []);

  const endSession = useCallback(async () => {
    if (!sessionIdRef.current) return;
    
    try {
      await api.post('/view-analytics/session/end', {
        sessionId: sessionIdRef.current,
      });
    } catch (error) {
      console.error('Failed to end session:', error);
    }
  }, []);

  // Initialize tracking when proposal loads
  useEffect(() => {
    if (proposal?.id && !sessionIdRef.current) {
      startSession();
    }
  }, [proposal?.id, startSession]);

  // Update session periodically and on scroll
  useEffect(() => {
    const interval = setInterval(updateSession, 10000); // Every 10 seconds
    
    const handleScroll = () => {
      updateSession();
    };
    
    window.addEventListener('scroll', handleScroll, { passive: true });
    
    return () => {
      clearInterval(interval);
      window.removeEventListener('scroll', handleScroll);
    };
  }, [updateSession]);

  // End session when leaving
  useEffect(() => {
    const handleBeforeUnload = () => {
      endSession();
    };
    
    window.addEventListener('beforeunload', handleBeforeUnload);
    
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      endSession();
    };
  }, [endSession]);

  const addCommentMutation = useMutation({
    mutationFn: async (content: string) => {
      const response = await api.post(`/proposals/${slug}/comments`, {
        content,
        author: proposal?.clientName || 'Client',
      });
      return response.data;
    },
    onSuccess: () => {
      setNewComment('');
      refetch();
      toast.success('Comment added');
    },
  });

  const approveMutation = useMutation({
    mutationFn: async (signatureData: string) => {
      const response = await api.post(`/proposals/${slug}/approve`, {
        signatureData,
        clientName: proposal?.clientName,
      });
      return response.data;
    },
    onSuccess: () => {
      refetch();
      toast.success('Proposal approved!');
      setShowSignature(false);
    },
  });

  const downloadPDFMutation = useMutation({
    mutationFn: async () => {
      const response = await api.get(`/proposals/${slug}/pdf`, {
        responseType: 'blob',
      });
      return response.data;
    },
    onSuccess: (blob) => {
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${proposal?.title || 'proposal'}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success('PDF downloaded');
    },
  });

  // WebSocket connection for real-time updates
  useEffect(() => {
    if (!slug) return;

    const wsUrl = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3001';
    socketRef.current = io(wsUrl);

    socketRef.current.emit('joinProposal', slug);

    socketRef.current.on('proposalViewed', () => {
      refetch();
    });

    socketRef.current.on('commentAdded', () => {
      refetch();
    });

    socketRef.current.on('proposalApproved', () => {
      refetch();
    });

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, [slug, refetch]);

  const handleAddComment = () => {
    if (!newComment.trim()) return;
    addCommentMutation.mutate(newComment);
  };

  const handleApprove = (signatureData: string) => {
    approveMutation.mutate(signatureData);
  };

  const calculateTotal = () => {
    return pricingItems.reduce((total, item) => {
      const itemTotal = item.quantity * item.price;
      return total + itemTotal;
    }, 0);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading proposal...</p>
        </div>
      </div>
    );
  }

  if (!proposal) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <FileText className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Proposal not found</h2>
          <p className="text-gray-600">This proposal may have been deleted or the link is incorrect.</p>
        </div>
      </div>
    );
  }

  const isApproved = proposal.status === 'APPROVED';
  const isDeclined = proposal.status === 'DECLINED';

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header with company branding */}
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {proposal.companyLogo && (
                <img
                  src={proposal.companyLogo}
                  alt={proposal.companyName || 'Company'}
                  className="h-10 w-auto"
                />
              )}
              <div>
                <h1 className="text-xl font-semibold text-gray-900">{proposal.title}</h1>
                {proposal.companyName && (
                  <p className="text-sm text-gray-600">{proposal.companyName}</p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {isApproved && (
                <Badge variant="default" className="bg-green-600">
                  <CheckCircle2 className="mr-1 h-3 w-3" />
                  Approved
                </Badge>
              )}
              {isDeclined && (
                <Badge variant="destructive">Declined</Badge>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => downloadPDFMutation.mutate()}
                disabled={downloadPDFMutation.isPending}
              >
                <Download className="mr-2 h-4 w-4" />
                Download PDF
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Proposal Details */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-4 text-sm text-gray-600">
                  <div className="flex items-center gap-1">
                    <User className="h-4 w-4" />
                    {proposal.clientName}
                  </div>
                  <div className="flex items-center gap-1">
                    <Mail className="h-4 w-4" />
                    {proposal.clientEmail}
                  </div>
                  <div className="flex items-center gap-1">
                    <Calendar className="h-4 w-4" />
                    {new Date(proposal.createdAt).toLocaleDateString()}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <TiptapEditor content={proposal.content} onChange={() => {}} editable={false} />
              </CardContent>
            </Card>

            {/* Pricing */}
            <PricingTable
              items={pricingItems}
              onChange={setPricingItems}
              editable={false}
              onClientChange={setPricingItems}
            />

            {/* Signature Section */}
            {!isApproved && !isDeclined && (
              <Card>
                <CardHeader>
                  <CardTitle>Approve This Proposal</CardTitle>
                </CardHeader>
                <CardContent>
                  {!showSignature ? (
                    <Button onClick={() => setShowSignature(true)} className="w-full">
                      <CheckCircle2 className="mr-2 h-4 w-4" />
                      Sign and Approve
                    </Button>
                  ) : (
                    <SignatureCanvas
                      onSave={handleApprove}
                      onCancel={() => setShowSignature(false)}
                    />
                  )}
                </CardContent>
              </Card>
            )}

            {/* Approved Signature Display */}
            {isApproved && proposal.signature && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-green-600">
                    <CheckCircle2 className="h-5 w-5" />
                    Approved
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="border rounded-lg p-4 bg-gray-50">
                      <img
                        src={proposal.signature.signatureData}
                        alt="Signature"
                        className="max-h-24"
                      />
                    </div>
                    <div className="text-sm text-gray-600 space-y-1">
                      <p>
                        Signed by <strong>{proposal.clientName}</strong>
                      </p>
                      <p>
                        {formatDistanceToNow(new Date(proposal.signature.signedAt), {
                          addSuffix: true,
                        })}
                      </p>
                      <p className="text-xs">IP: {proposal.signature.ipAddress}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Payment Section */}
            {isApproved && proposal.depositRequired && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CreditCard className="h-5 w-5" />
                    Payment Required
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {!showPayment ? (
                    <div className="text-center py-4">
                      <p className="text-muted-foreground mb-4">
                        A deposit of {proposal.depositPercentage || 50}% is required to proceed.
                      </p>
                      <Button onClick={() => setShowPayment(true)} className="w-full">
                        <CreditCard className="mr-2 h-4 w-4" />
                        Make Payment
                      </Button>
                    </div>
                  ) : (
                    <PaymentForm
                      proposalId={proposal.id}
                      proposalTitle={proposal.title}
                      totalAmount={calculateTotal()}
                      currency={proposal.currency || 'USD'}
                      onPaymentComplete={() => {
                        toast.success('Payment successful!');
                        refetch();
                        setShowPayment(false);
                      }}
                    />
                  )}
                </CardContent>
              </Card>
            )}
          </div>

          {/* Sidebar - Comments */}
          <div className="lg:col-span-1">
            <Card className="sticky top-24">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageSquare className="h-5 w-5" />
                  Comments ({proposal.comments?.length || 0})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {/* Comments List */}
                  <div className="space-y-4 max-h-96 overflow-y-auto">
                    {proposal.comments?.map((comment) => (
                      <div key={comment.id} className="flex gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback>
                            {comment.author.charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">{comment.author}</span>
                            <span className="text-xs text-gray-500">
                              {formatDistanceToNow(new Date(comment.createdAt), {
                                addSuffix: true,
                              })}
                            </span>
                          </div>
                          <p className="text-sm text-gray-700 mt-1">{comment.content}</p>
                        </div>
                      </div>
                    ))}
                    {(!proposal.comments || proposal.comments.length === 0) && (
                      <p className="text-sm text-gray-500 text-center py-4">
                        No comments yet
                      </p>
                    )}
                  </div>

                  <Separator />

                  {/* Add Comment */}
                  <div className="space-y-2">
                    <Textarea
                      placeholder="Add a comment..."
                      value={newComment}
                      onChange={(e) => setNewComment(e.target.value)}
                      rows={3}
                    />
                    <Button
                      onClick={handleAddComment}
                      disabled={!newComment.trim() || addCommentMutation.isPending}
                      className="w-full"
                      size="sm"
                    >
                      <Send className="mr-2 h-4 w-4" />
                      Add Comment
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
