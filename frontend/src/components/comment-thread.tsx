'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useApi } from '@/hooks/use-api';
import { MessageSquare, Reply, Check, User } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface Comment {
  id: string;
  content: string;
  authorName: string;
  authorEmail?: string;
  parentId?: string;
  replies?: Comment[];
  resolved: boolean;
  resolvedBy?: string;
  resolvedAt?: string;
  createdAt: string;
  updatedAt: string;
}

interface CommentThreadProps {
  proposalId: string;
  currentUserEmail?: string;
  currentUserName?: string;
}

export function CommentThread({ proposalId, currentUserEmail, currentUserName }: CommentThreadProps) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const api = useApi();

  useEffect(() => {
    fetchComments();

    // Set up WebSocket listener
    if (typeof window !== 'undefined' && (window as any).socket) {
      const socket = (window as any).socket;
      
      socket.emit('join_proposal', { proposalId });
      socket.on('comment_added', (comment: Comment) => {
        setComments((prev) => [...prev, comment]);
      });

      return () => {
        socket.emit('leave_proposal', { proposalId });
        socket.off('comment_added');
      };
    }
  }, [proposalId]);

  const fetchComments = async () => {
    try {
      const response = await api.get(`/comments?proposalId=${proposalId}`);
      setComments(response.data);
    } catch (error) {
      console.error('Failed to fetch comments:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim()) return;

    setLoading(true);
    try {
      const response = await api.post('/comments', {
        proposalId,
        content: newComment,
        authorName: currentUserName || 'Anonymous',
        authorEmail: currentUserEmail,
        parentId: replyTo,
      });

      setComments((prev) => [...prev, response.data]);
      setNewComment('');
      setReplyTo(null);
    } catch (error) {
      console.error('Failed to add comment:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleResolve = async (commentId: string) => {
    try {
      await api.patch(`/comments/${commentId}/resolve`);
      setComments((prev) =>
        prev.map((c) =>
          c.id === commentId
            ? { ...c, resolved: true, resolvedAt: new Date().toISOString() }
            : c
        )
      );
    } catch (error) {
      console.error('Failed to resolve comment:', error);
    }
  };

  // Organize comments into threads
  const organizeThreads = (comments: Comment[]): Comment[] => {
    const commentMap = new Map<string, Comment>();
    const rootComments: Comment[] = [];

    // First pass: create map
    comments.forEach((comment) => {
      commentMap.set(comment.id, { ...comment, replies: [] });
    });

    // Second pass: organize hierarchy
    comments.forEach((comment) => {
      const commentWithReplies = commentMap.get(comment.id)!;
      if (comment.parentId) {
        const parent = commentMap.get(comment.parentId);
        if (parent) {
          parent.replies = parent.replies || [];
          parent.replies.push(commentWithReplies);
        }
      } else {
        rootComments.push(commentWithReplies);
      }
    });

    return rootComments;
  };

  const renderComment = (comment: Comment, depth = 0) => (
    <div key={comment.id} className={`${depth > 0 ? 'ml-8 mt-4 pl-4 border-l-2' : 'mb-4'}`}>
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 mt-1">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center">
            <User className="h-4 w-4 text-white" />
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-medium text-sm">{comment.authorName}</span>
            <span className="text-xs text-muted-foreground">
              {formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true })}
            </span>
            {comment.resolved && (
              <Badge variant="secondary" className="text-xs">
                <Check className="h-3 w-3 mr-1" />
                Resolved
              </Badge>
            )}
          </div>
          <p className="text-sm whitespace-pre-wrap">{comment.content}</p>
          <div className="flex items-center gap-2 mt-2">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={() => setReplyTo(comment.id)}
            >
              <Reply className="h-3 w-3 mr-1" />
              Reply
            </Button>
            {!comment.resolved && currentUserEmail && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs"
                onClick={() => handleResolve(comment.id)}
              >
                <Check className="h-3 w-3 mr-1" />
                Resolve
              </Button>
            )}
          </div>
        </div>
      </div>
      {comment.replies && comment.replies.length > 0 && (
        <div className="mt-2">
          {comment.replies.map((reply) => renderComment(reply, depth + 1))}
        </div>
      )}
    </div>
  );

  const threads = organizeThreads(comments);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5" />
          Comments & Discussion
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <form onSubmit={handleSubmit} className="space-y-2">
          {replyTo && (
            <div className="flex items-center justify-between bg-muted p-2 rounded">
              <span className="text-sm">Replying to comment...</span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setReplyTo(null)}
              >
                Cancel
              </Button>
            </div>
          )}
          <Textarea
            placeholder="Add a comment or question..."
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            rows={3}
          />
          <Button type="submit" disabled={loading || !newComment.trim()}>
            {loading ? 'Posting...' : replyTo ? 'Reply' : 'Post Comment'}
          </Button>
        </form>

        <div className="space-y-4 mt-6">
          {threads.length === 0 ? (
            <p className="text-center text-muted-foreground text-sm py-8">
              No comments yet. Start the conversation!
            </p>
          ) : (
            threads.map((comment) => renderComment(comment))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
