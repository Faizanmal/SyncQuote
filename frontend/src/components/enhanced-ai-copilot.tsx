'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import { Slider } from '@/components/ui/slider';
import {
  Sparkles,
  Send,
  Copy,
  Check,
  RefreshCcw,
  Wand2,
  FileText,
  MessageSquare,
  Lightbulb,
  PenLine,
  Languages,
  CheckCircle,
  Volume2,
  Clipboard,
  ChevronDown,
  Settings,
  Zap,
  Brain,
  Target,
  TrendingUp,
  Mail,
  FileSignature,
} from 'lucide-react';
import { useApi } from '@/hooks/use-api';
import { toast } from 'sonner';

// Types
interface AIMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface AITemplate {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  prompt: string;
  category: string;
}

interface AISettings {
  tone: 'professional' | 'friendly' | 'persuasive' | 'formal';
  length: 'concise' | 'moderate' | 'detailed';
  creativity: number;
}

interface EnhancedAICopilotProps {
  context?: {
    proposalId?: string;
    clientName?: string;
    industry?: string;
    proposalContent?: string;
  };
  onInsert?: (content: string) => void;
}

const AI_TEMPLATES: AITemplate[] = [
  {
    id: 'executive-summary',
    name: 'Executive Summary',
    description: 'Generate a compelling executive summary',
    icon: <FileText className="h-4 w-4" />,
    prompt: 'Write a professional executive summary for a proposal to [CLIENT]. The proposal is about [TOPIC]. Focus on key value propositions and expected outcomes.',
    category: 'Content',
  },
  {
    id: 'scope-of-work',
    name: 'Scope of Work',
    description: 'Create detailed scope documentation',
    icon: <Target className="h-4 w-4" />,
    prompt: 'Generate a comprehensive scope of work section including deliverables, milestones, and timelines for [PROJECT].',
    category: 'Content',
  },
  {
    id: 'pricing-justification',
    name: 'Pricing Justification',
    description: 'Explain and justify your pricing',
    icon: <TrendingUp className="h-4 w-4" />,
    prompt: 'Write a persuasive pricing justification explaining the value and ROI of the proposed investment of [AMOUNT].',
    category: 'Content',
  },
  {
    id: 'follow-up-email',
    name: 'Follow-up Email',
    description: 'Craft a follow-up email',
    icon: <Mail className="h-4 w-4" />,
    prompt: 'Write a professional follow-up email to [CLIENT] regarding the proposal sent [TIME_AGO]. The proposal was about [TOPIC].',
    category: 'Communication',
  },
  {
    id: 'objection-handler',
    name: 'Handle Objection',
    description: 'Address client concerns',
    icon: <MessageSquare className="h-4 w-4" />,
    prompt: 'Help me respond to this client objection: "[OBJECTION]". Provide a professional and empathetic response.',
    category: 'Communication',
  },
  {
    id: 'case-study',
    name: 'Case Study',
    description: 'Generate a relevant case study',
    icon: <Lightbulb className="h-4 w-4" />,
    prompt: 'Create a brief case study showcasing similar work done for a client in the [INDUSTRY] industry.',
    category: 'Content',
  },
  {
    id: 'terms-conditions',
    name: 'Terms & Conditions',
    description: 'Generate standard terms',
    icon: <FileSignature className="h-4 w-4" />,
    prompt: 'Generate professional terms and conditions for a [SERVICE_TYPE] engagement.',
    category: 'Legal',
  },
  {
    id: 'improve-writing',
    name: 'Improve Writing',
    description: 'Enhance existing content',
    icon: <PenLine className="h-4 w-4" />,
    prompt: 'Improve and polish the following text while maintaining its meaning: [TEXT]',
    category: 'Edit',
  },
  {
    id: 'translate',
    name: 'Translate',
    description: 'Translate to another language',
    icon: <Languages className="h-4 w-4" />,
    prompt: 'Translate the following to [LANGUAGE]: [TEXT]',
    category: 'Edit',
  },
  {
    id: 'summarize',
    name: 'Summarize',
    description: 'Create a concise summary',
    icon: <CheckCircle className="h-4 w-4" />,
    prompt: 'Summarize the following in 2-3 sentences: [TEXT]',
    category: 'Edit',
  },
];

const QUICK_ACTIONS = [
  { label: 'Make it shorter', prompt: 'Make this more concise while keeping key points:' },
  { label: 'Make it longer', prompt: 'Expand on this with more detail:' },
  { label: 'More professional', prompt: 'Rewrite this in a more professional tone:' },
  { label: 'More friendly', prompt: 'Rewrite this in a friendlier tone:' },
  { label: 'Add bullet points', prompt: 'Convert this into bullet points:' },
  { label: 'Fix grammar', prompt: 'Fix any grammar or spelling issues:' },
];

export function EnhancedAICopilot({ context, onInsert }: EnhancedAICopilotProps) {
  const [messages, setMessages] = useState<AIMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<AITemplate | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [settings, setSettings] = useState<AISettings>({
    tone: 'professional',
    length: 'moderate',
    creativity: 0.7,
  });
  const [showSettings, setShowSettings] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const api = useApi();

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const generateContent = async (prompt: string) => {
    if (!prompt.trim()) return;

    const userMessage: AIMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: prompt,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await api.post('/ai/generate', {
        prompt,
        context: {
          ...context,
          settings,
        },
        conversationHistory: messages.slice(-10).map((m) => ({
          role: m.role,
          content: m.content,
        })),
      });

      const assistantMessage: AIMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response.data.content,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      toast.error('Failed to generate content. Please try again.');
      console.error('AI generation error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleTemplateSelect = (template: AITemplate) => {
    setSelectedTemplate(template);
    setInput(template.prompt);
  };

  const copyToClipboard = async (content: string, messageId: string) => {
    await navigator.clipboard.writeText(content);
    setCopiedId(messageId);
    setTimeout(() => setCopiedId(null), 2000);
    toast.success('Copied to clipboard');
  };

  const insertContent = (content: string) => {
    onInsert?.(content);
    toast.success('Content inserted');
  };

  const regenerateResponse = async (originalPrompt: string) => {
    await generateContent(originalPrompt);
  };

  const handleQuickAction = (action: { label: string; prompt: string }, content: string) => {
    generateContent(`${action.prompt}\n\n${content}`);
  };

  const clearConversation = () => {
    setMessages([]);
  };

  // Group templates by category
  const templatesByCategory = AI_TEMPLATES.reduce(
    (acc, template) => {
      if (!acc[template.category]) {
        acc[template.category] = [];
      }
      acc[template.category].push(template);
      return acc;
    },
    {} as Record<string, AITemplate[]>
  );

  return (
    <div className="flex flex-col h-full">
      <Tabs defaultValue="chat" className="flex-1 flex flex-col">
        <div className="flex items-center justify-between border-b px-4 py-2">
          <TabsList>
            <TabsTrigger value="chat" className="gap-2">
              <MessageSquare className="h-4 w-4" />
              Chat
            </TabsTrigger>
            <TabsTrigger value="templates" className="gap-2">
              <Wand2 className="h-4 w-4" />
              Templates
            </TabsTrigger>
          </TabsList>

          <div className="flex items-center gap-2">
            <Dialog open={showSettings} onOpenChange={setShowSettings}>
              <DialogTrigger asChild>
                <Button variant="ghost" size="icon">
                  <Settings className="h-4 w-4" />
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>AI Settings</DialogTitle>
                  <DialogDescription>Customize the AI&apos;s behavior</DialogDescription>
                </DialogHeader>
                <div className="space-y-6 py-4">
                  <div className="space-y-2">
                    <Label>Tone</Label>
                    <Select
                      value={settings.tone}
                      onValueChange={(v) =>
                        setSettings({ ...settings, tone: v as AISettings['tone'] })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="professional">Professional</SelectItem>
                        <SelectItem value="friendly">Friendly</SelectItem>
                        <SelectItem value="persuasive">Persuasive</SelectItem>
                        <SelectItem value="formal">Formal</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Response Length</Label>
                    <Select
                      value={settings.length}
                      onValueChange={(v) =>
                        setSettings({ ...settings, length: v as AISettings['length'] })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="concise">Concise</SelectItem>
                        <SelectItem value="moderate">Moderate</SelectItem>
                        <SelectItem value="detailed">Detailed</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label>Creativity</Label>
                      <span className="text-sm text-muted-foreground">
                        {(settings.creativity * 100).toFixed(0)}%
                      </span>
                    </div>
                    <Slider
                      value={[settings.creativity]}
                      onValueChange={([v]) => setSettings({ ...settings, creativity: v })}
                      min={0}
                      max={1}
                      step={0.1}
                    />
                    <p className="text-xs text-muted-foreground">
                      Higher creativity produces more varied responses
                    </p>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
            <Button variant="ghost" size="sm" onClick={clearConversation}>
              Clear
            </Button>
          </div>
        </div>

        <TabsContent value="chat" className="flex-1 flex flex-col m-0 p-0">
          {/* Messages */}
          <ScrollArea ref={scrollRef} className="flex-1 p-4">
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center py-8">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                  <Sparkles className="h-8 w-8 text-primary" />
                </div>
                <h3 className="font-semibold text-lg mb-2">AI Content Assistant</h3>
                <p className="text-muted-foreground text-sm max-w-md mb-6">
                  Ask me to help you write proposals, create content, or improve your text.
                  I can help with executive summaries, pricing justifications, follow-up emails,
                  and more.
                </p>
                <div className="flex flex-wrap gap-2 justify-center">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      generateContent(
                        'Write a compelling executive summary for a software development proposal'
                      )
                    }
                  >
                    <FileText className="h-3 w-3 mr-1" />
                    Executive Summary
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      generateContent(
                        'Help me write a follow-up email for a proposal that was sent last week'
                      )
                    }
                  >
                    <Mail className="h-3 w-3 mr-1" />
                    Follow-up Email
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      generateContent('Suggest ways to justify a $50,000 project pricing')
                    }
                  >
                    <TrendingUp className="h-3 w-3 mr-1" />
                    Price Justification
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex ${
                      message.role === 'user' ? 'justify-end' : 'justify-start'
                    }`}
                  >
                    <div
                      className={`max-w-[80%] rounded-lg p-4 ${
                        message.role === 'user'
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted'
                      }`}
                    >
                      <div className="whitespace-pre-wrap">{message.content}</div>
                      {message.role === 'assistant' && (
                        <div className="flex items-center gap-1 mt-3 pt-2 border-t border-border/50">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7"
                            onClick={() => copyToClipboard(message.content, message.id)}
                          >
                            {copiedId === message.id ? (
                              <Check className="h-3 w-3 mr-1" />
                            ) : (
                              <Copy className="h-3 w-3 mr-1" />
                            )}
                            {copiedId === message.id ? 'Copied' : 'Copy'}
                          </Button>
                          {onInsert && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7"
                              onClick={() => insertContent(message.content)}
                            >
                              <Clipboard className="h-3 w-3 mr-1" />
                              Insert
                            </Button>
                          )}
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-7">
                                <Zap className="h-3 w-3 mr-1" />
                                Actions
                                <ChevronDown className="h-3 w-3 ml-1" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent>
                              <DropdownMenuLabel>Quick Actions</DropdownMenuLabel>
                              <DropdownMenuSeparator />
                              {QUICK_ACTIONS.map((action) => (
                                <DropdownMenuItem
                                  key={action.label}
                                  onClick={() => handleQuickAction(action, message.content)}
                                >
                                  {action.label}
                                </DropdownMenuItem>
                              ))}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                {isLoading && (
                  <div className="flex justify-start">
                    <div className="bg-muted rounded-lg p-4">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-primary rounded-full animate-bounce" />
                        <div
                          className="w-2 h-2 bg-primary rounded-full animate-bounce"
                          style={{ animationDelay: '0.2s' }}
                        />
                        <div
                          className="w-2 h-2 bg-primary rounded-full animate-bounce"
                          style={{ animationDelay: '0.4s' }}
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </ScrollArea>

          {/* Input */}
          <div className="border-t p-4">
            <div className="flex gap-2">
              <Textarea
                placeholder="Ask AI to help with your proposal..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    generateContent(input);
                  }
                }}
                className="min-h-[60px] resize-none"
              />
              <Button
                onClick={() => generateContent(input)}
                disabled={!input.trim() || isLoading}
                className="self-end"
              >
                {isLoading ? (
                  <RefreshCcw className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Press Enter to send, Shift+Enter for new line
            </p>
          </div>
        </TabsContent>

        <TabsContent value="templates" className="flex-1 m-0 p-4 overflow-auto">
          <div className="space-y-6">
            {Object.entries(templatesByCategory).map(([category, templates]) => (
              <div key={category}>
                <h3 className="font-semibold mb-3">{category}</h3>
                <div className="grid gap-3 md:grid-cols-2">
                  {templates.map((template) => (
                    <Card
                      key={template.id}
                      className="cursor-pointer hover:border-primary transition-colors"
                      onClick={() => handleTemplateSelect(template)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start gap-3">
                          <div className="p-2 rounded-lg bg-primary/10 text-primary">
                            {template.icon}
                          </div>
                          <div className="flex-1">
                            <h4 className="font-medium">{template.name}</h4>
                            <p className="text-sm text-muted-foreground">
                              {template.description}
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      {/* Template Dialog */}
      <Dialog open={!!selectedTemplate} onOpenChange={() => setSelectedTemplate(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedTemplate?.icon}
              {selectedTemplate?.name}
            </DialogTitle>
            <DialogDescription>{selectedTemplate?.description}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Customize Prompt</Label>
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                className="min-h-[150px]"
                placeholder="Modify the template prompt as needed..."
              />
              <p className="text-xs text-muted-foreground">
                Replace placeholders like [CLIENT], [TOPIC], etc. with actual values
              </p>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setSelectedTemplate(null)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                generateContent(input);
                setSelectedTemplate(null);
              }}
              disabled={!input.trim()}
            >
              <Sparkles className="h-4 w-4 mr-2" />
              Generate
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
