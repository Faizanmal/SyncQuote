'use client';

import { useState } from 'react';
import { useApi } from '@/hooks/use-api';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Sparkles, Copy, RefreshCw, Check } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

interface AIContentAssistantProps {
  onInsert?: (content: string) => void;
  userId?: string;
  proposalId?: string;
}

export function AIContentAssistant({
  onInsert,
  userId,
  proposalId,
}: AIContentAssistantProps) {
  const [contentType, setContentType] = useState<string>('introduction');
  const [context, setContext] = useState({
    industry: '',
    serviceType: '',
    clientName: '',
    projectDescription: '',
    budget: '',
    timeline: '',
    additionalNotes: '',
  });
  const [generatedContent, setGeneratedContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const api = useApi();

  const handleGenerate = async () => {
    setLoading(true);
    try {
      const data = await api.post('/ai/generate', {
        contentType,
        context: {
          ...context,
          budget: context.budget ? parseFloat(context.budget) : undefined,
        },
        userId,
        proposalId,
      });

      setGeneratedContent(data.data.content);
      
      if (data.data.fallback) {
        toast.info('Using fallback content (AI API unavailable)');
      } else {
        toast.success('Content generated successfully!');
      }
    } catch (error) {
      toast.error('Failed to generate content');
    } finally {
      setLoading(false);
    }
  };

  const handleImprove = async (improvementType: 'professional' | 'concise' | 'persuasive') => {
    if (!generatedContent) {
      toast.error('Generate content first');
      return;
    }

    setLoading(true);
    try {
      const data = await api.post('/ai/improve', {
        content: generatedContent,
        improvementType,
      });

      setGeneratedContent(data.data.improved);
      toast.success('Content improved!');
    } catch (error) {
      toast.error('Failed to improve content');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(generatedContent);
    setCopied(true);
    toast.success('Copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleInsert = () => {
    if (onInsert && generatedContent) {
      onInsert(generatedContent);
      toast.success('Content inserted');
    }
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Sparkles className="h-4 w-4" />
          AI Assistant
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-purple-500" />
            AI Content Assistant
          </DialogTitle>
          <DialogDescription>
            Generate professional proposal content using AI
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-6">
          {/* Left: Input Form */}
          <div className="space-y-4">
            <div>
              <Label>Content Type</Label>
              <Select value={contentType} onValueChange={setContentType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="introduction">Introduction</SelectItem>
                  <SelectItem value="scope">Scope of Work</SelectItem>
                  <SelectItem value="terms">Terms & Conditions</SelectItem>
                  <SelectItem value="pricing">Pricing Structure</SelectItem>
                  <SelectItem value="conclusion">Conclusion & Next Steps</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Industry</Label>
              <Input
                placeholder="e.g., Technology, Consulting, Marketing"
                value={context.industry}
                onChange={(e) =>
                  setContext({ ...context, industry: e.target.value })
                }
              />
            </div>

            <div>
              <Label>Service Type</Label>
              <Input
                placeholder="e.g., Web Development, SEO, Design"
                value={context.serviceType}
                onChange={(e) =>
                  setContext({ ...context, serviceType: e.target.value })
                }
              />
            </div>

            <div>
              <Label>Client Name</Label>
              <Input
                placeholder="Client or company name"
                value={context.clientName}
                onChange={(e) =>
                  setContext({ ...context, clientName: e.target.value })
                }
              />
            </div>

            <div>
              <Label>Budget (Optional)</Label>
              <Input
                type="number"
                placeholder="5000"
                value={context.budget}
                onChange={(e) =>
                  setContext({ ...context, budget: e.target.value })
                }
              />
            </div>

            <div>
              <Label>Timeline (Optional)</Label>
              <Input
                placeholder="e.g., 4-6 weeks"
                value={context.timeline}
                onChange={(e) =>
                  setContext({ ...context, timeline: e.target.value })
                }
              />
            </div>

            <div>
              <Label>Project Description</Label>
              <Textarea
                placeholder="Describe the project requirements..."
                value={context.projectDescription}
                onChange={(e) =>
                  setContext({ ...context, projectDescription: e.target.value })
                }
                rows={3}
              />
            </div>

            <Button
              onClick={handleGenerate}
              disabled={loading}
              className="w-full"
            >
              {loading ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Generate Content
                </>
              )}
            </Button>
          </div>

          {/* Right: Generated Content */}
          <div className="space-y-4">
            <div>
              <Label>Generated Content</Label>
              <Textarea
                value={generatedContent}
                onChange={(e) => setGeneratedContent(e.target.value)}
                placeholder="Generated content will appear here..."
                rows={15}
                className="font-mono text-sm"
              />
            </div>

            {generatedContent && (
              <div className="space-y-2">
                <Label>Improve Content</Label>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleImprove('professional')}
                    disabled={loading}
                  >
                    More Professional
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleImprove('concise')}
                    disabled={loading}
                  >
                    More Concise
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleImprove('persuasive')}
                    disabled={loading}
                  >
                    More Persuasive
                  </Button>
                </div>

                <div className="flex gap-2 pt-2">
                  <Button
                    variant="outline"
                    onClick={handleCopy}
                    className="flex-1"
                  >
                    {copied ? (
                      <>
                        <Check className="h-4 w-4 mr-2" />
                        Copied!
                      </>
                    ) : (
                      <>
                        <Copy className="h-4 w-4 mr-2" />
                        Copy
                      </>
                    )}
                  </Button>
                  {onInsert && (
                    <Button onClick={handleInsert} className="flex-1">
                      Insert into Proposal
                    </Button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
