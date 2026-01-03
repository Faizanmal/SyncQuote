'use client';

import React, { useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { 
  Users, MessageCircle, CheckCircle, Clock, 
  Send, Reply, Pencil, Eye, UserPlus, Settings 
} from 'lucide-react';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import io, { Socket } from 'socket.io-client';

interface Collaborator {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  role: string;
  permissions: string[];
  addedAt: string;
}

interface ReviewCycle {
  id: string;
  name: string;
  status: string;
  dueDate?: string;
  reviewers: string[];
  completedReviews: number;
  totalReviews: number;
}

interface Comment {
  id: string;
  content: string;
  userId: string;
  userName: string;
  createdAt: string;
  resolved: boolean;
  replies: Comment[];
  sectionId?: string;
}

interface Suggestion {
  id: string;
  content: string;
  suggestedText: string;
  userId: string;
  userName: string;
  status: string;
  createdAt: string;
  sectionId?: string;
}

interface OnlineUser {
  userId: string;
  userName: string;
  cursor?: { x: number; y: number };
  typing?: boolean;
}

export function CollaborationWorkspace({ proposalId }: { proposalId: string }) {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);
  const [showCollaborators, setShowCollaborators] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const queryClient = useQueryClient();

  // WebSocket connection
  useEffect(() => {
    const newSocket = io('http://localhost:3000/collaboration', {
      query: { proposalId },
    });

    newSocket.on('connect', () => {
      newSocket.emit('join:proposal', { proposalId });
    });

    newSocket.on('presence:update', (users: OnlineUser[]) => {
      setOnlineUsers(users);
    });

    newSocket.on('comment:created', () => {
      queryClient.invalidateQueries({ queryKey: ['comments', proposalId] });
      toast.info('New comment added');
    });

    newSocket.on('suggestion:created', () => {
      queryClient.invalidateQueries({ queryKey: ['suggestions', proposalId] });
      toast.info('New suggestion received');
    });

    newSocket.on('typing:start', ({ userId, userName }: any) => {
      setOnlineUsers(prev => 
        prev.map(u => u.userId === userId ? { ...u, typing: true } : u)
      );
    });

    newSocket.on('typing:stop', ({ userId }: any) => {
      setOnlineUsers(prev =>
        prev.map(u => u.userId === userId ? { ...u, typing: false } : u)
      );
    });

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, [proposalId]);

  const { data: collaborators } = useQuery({
    queryKey: ['collaborators', proposalId],
    queryFn: async () => {
      const res = await fetch(`/api/collaboration/${proposalId}/collaborators`);
      return res.json();
    },
  });

  const { data: reviewCycles } = useQuery({
    queryKey: ['review-cycles', proposalId],
    queryFn: async () => {
      const res = await fetch(`/api/collaboration/${proposalId}/review-cycles`);
      return res.json();
    },
  });

  const { data: comments } = useQuery({
    queryKey: ['comments', proposalId],
    queryFn: async () => {
      const res = await fetch(`/api/collaboration/${proposalId}/comments`);
      return res.json();
    },
  });

  const { data: suggestions } = useQuery({
    queryKey: ['suggestions', proposalId],
    queryFn: async () => {
      const res = await fetch(`/api/collaboration/${proposalId}/suggestions`);
      return res.json();
    },
  });

  const addCollaboratorMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch(`/api/collaboration/${proposalId}/collaborators`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['collaborators', proposalId] });
      toast.success('Collaborator added');
    },
  });

  const createCommentMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch(`/api/collaboration/${proposalId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['comments', proposalId] });
      setNewComment('');
      setReplyTo(null);
    },
  });

  const resolveCommentMutation = useMutation({
    mutationFn: async (commentId: string) => {
      const res = await fetch(`/api/collaboration/${proposalId}/comments/${commentId}/resolve`, {
        method: 'POST',
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['comments', proposalId] });
      toast.success('Comment resolved');
    },
  });

  const respondToSuggestionMutation = useMutation({
    mutationFn: async ({ suggestionId, accepted }: { suggestionId: string; accepted: boolean }) => {
      const res = await fetch(`/api/collaboration/${proposalId}/suggestions/${suggestionId}/respond`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accepted }),
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suggestions', proposalId] });
      toast.success('Suggestion updated');
    },
  });

  const handleTyping = (typing: boolean) => {
    if (socket) {
      socket.emit(typing ? 'typing:start' : 'typing:stop', { proposalId });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold">Collaboration</h2>
          <p className="text-muted-foreground">Work together in real-time</p>
        </div>
        <div className="flex gap-2">
          <div className="flex items-center gap-2 mr-4">
            <Users className="h-5 w-5 text-muted-foreground" />
            <span className="text-sm font-medium">{onlineUsers.length} online</span>
          </div>
          <Button variant="outline" onClick={() => setShowCollaborators(true)}>
            <UserPlus className="mr-2 h-4 w-4" />
            Add Collaborator
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content Area */}
        <div className="lg:col-span-2 space-y-6">
          {/* Online Users */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Active Collaborators</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {onlineUsers.map((user) => (
                  <div key={user.userId} className="flex items-center gap-2 bg-muted px-3 py-2 rounded-full">
                    <Avatar className="h-6 w-6">
                      <AvatarFallback>{user.userName[0]}</AvatarFallback>
                    </Avatar>
                    <span className="text-sm font-medium">{user.userName}</span>
                    {user.typing && (
                      <span className="text-xs text-muted-foreground">typing...</span>
                    )}
                    <div className="h-2 w-2 bg-green-500 rounded-full" />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Review Cycles */}
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle>Review Cycles</CardTitle>
                <Button size="sm" variant="outline">
                  <Clock className="mr-2 h-4 w-4" />
                  New Review
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {reviewCycles?.map((cycle: ReviewCycle) => (
                  <div key={cycle.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h4 className="font-semibold">{cycle.name}</h4>
                        <Badge variant={cycle.status === 'completed' ? 'default' : 'secondary'}>
                          {cycle.status}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        {cycle.completedReviews} of {cycle.totalReviews} reviews completed
                      </p>
                      {cycle.dueDate && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Due: {new Date(cycle.dueDate).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                    <Button size="sm" variant="outline">
                      <Eye className="mr-2 h-4 w-4" />
                      View
                    </Button>
                  </div>
                ))}

                {(!reviewCycles || reviewCycles.length === 0) && (
                  <div className="text-center py-8 text-muted-foreground">
                    No review cycles yet
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Comments */}
          <Card>
            <CardHeader>
              <CardTitle>Comments & Discussions</CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px] mb-4">
                <div className="space-y-4">
                  {comments?.map((comment: Comment) => (
                    <CommentThread
                      key={comment.id}
                      comment={comment}
                      onReply={(commentId) => setReplyTo(commentId)}
                      onResolve={(commentId) => resolveCommentMutation.mutate(commentId)}
                    />
                  ))}

                  {(!comments || comments.length === 0) && (
                    <div className="text-center py-12 text-muted-foreground">
                      No comments yet. Start a discussion!
                    </div>
                  )}
                </div>
              </ScrollArea>

              <div className="space-y-2">
                {replyTo && (
                  <div className="flex items-center justify-between bg-muted px-3 py-2 rounded">
                    <span className="text-sm">Replying to comment</span>
                    <Button size="sm" variant="ghost" onClick={() => setReplyTo(null)}>
                      Cancel
                    </Button>
                  </div>
                )}
                <div className="flex gap-2">
                  <Textarea
                    placeholder="Add a comment..."
                    value={newComment}
                    onChange={(e) => {
                      setNewComment(e.target.value);
                      handleTyping(true);
                    }}
                    onBlur={() => handleTyping(false)}
                    rows={2}
                  />
                  <Button
                    onClick={() => {
                      createCommentMutation.mutate({
                        content: newComment,
                        parentCommentId: replyTo,
                      });
                    }}
                    disabled={!newComment.trim()}
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Collaborators */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Collaborators</CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-64">
                <div className="space-y-3">
                  {collaborators?.map((collab: Collaborator) => (
                    <div key={collab.id} className="flex items-center gap-3">
                      <Avatar>
                        <AvatarFallback>{collab.userName[0]}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <p className="text-sm font-medium">{collab.userName}</p>
                        <p className="text-xs text-muted-foreground">{collab.userEmail}</p>
                      </div>
                      <Badge variant="outline">{collab.role}</Badge>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>

          {/* Suggestions */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Suggestions</CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-80">
                <div className="space-y-3">
                  {suggestions?.map((suggestion: Suggestion) => (
                    <div key={suggestion.id} className="border rounded-lg p-3 space-y-2">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <p className="text-sm font-medium">{suggestion.userName}</p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(suggestion.createdAt).toLocaleString()}
                          </p>
                        </div>
                        <Badge variant={
                          suggestion.status === 'accepted' ? 'default' :
                          suggestion.status === 'rejected' ? 'destructive' : 'secondary'
                        }>
                          {suggestion.status}
                        </Badge>
                      </div>

                      <p className="text-sm">{suggestion.content}</p>
                      
                      <div className="bg-muted p-2 rounded text-xs font-mono">
                        {suggestion.suggestedText}
                      </div>

                      {suggestion.status === 'pending' && (
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            className="flex-1"
                            onClick={() => respondToSuggestionMutation.mutate({
                              suggestionId: suggestion.id,
                              accepted: true,
                            })}
                          >
                            <CheckCircle className="mr-1 h-3 w-3" />
                            Accept
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="flex-1"
                            onClick={() => respondToSuggestionMutation.mutate({
                              suggestionId: suggestion.id,
                              accepted: false,
                            })}
                          >
                            Reject
                          </Button>
                        </div>
                      )}
                    </div>
                  ))}

                  {(!suggestions || suggestions.length === 0) && (
                    <div className="text-center py-8 text-muted-foreground text-sm">
                      No suggestions yet
                    </div>
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function CommentThread({ 
  comment, 
  onReply, 
  onResolve 
}: { 
  comment: Comment;
  onReply: (commentId: string) => void;
  onResolve: (commentId: string) => void;
}) {
  return (
    <div className={cn('border rounded-lg p-4', comment.resolved && 'opacity-50')}>
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <Avatar className="h-8 w-8">
            <AvatarFallback>{comment.userName[0]}</AvatarFallback>
          </Avatar>
          <div>
            <p className="text-sm font-medium">{comment.userName}</p>
            <p className="text-xs text-muted-foreground">
              {new Date(comment.createdAt).toLocaleString()}
            </p>
          </div>
        </div>
        {comment.resolved && (
          <Badge variant="outline" className="text-green-600">
            <CheckCircle className="mr-1 h-3 w-3" />
            Resolved
          </Badge>
        )}
      </div>

      <p className="text-sm mb-3">{comment.content}</p>

      <div className="flex gap-2">
        <Button size="sm" variant="ghost" onClick={() => onReply(comment.id)}>
          <Reply className="mr-1 h-3 w-3" />
          Reply
        </Button>
        {!comment.resolved && (
          <Button size="sm" variant="ghost" onClick={() => onResolve(comment.id)}>
            <CheckCircle className="mr-1 h-3 w-3" />
            Resolve
          </Button>
        )}
      </div>

      {comment.replies && comment.replies.length > 0 && (
        <div className="ml-8 mt-3 space-y-3 border-l-2 pl-4">
          {comment.replies.map((reply) => (
            <div key={reply.id}>
              <div className="flex items-center gap-2 mb-1">
                <Avatar className="h-6 w-6">
                  <AvatarFallback>{reply.userName[0]}</AvatarFallback>
                </Avatar>
                <p className="text-sm font-medium">{reply.userName}</p>
                <p className="text-xs text-muted-foreground">
                  {new Date(reply.createdAt).toLocaleString()}
                </p>
              </div>
              <p className="text-sm">{reply.content}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function cn(...classes: any[]) {
  return classes.filter(Boolean).join(' ');
}
