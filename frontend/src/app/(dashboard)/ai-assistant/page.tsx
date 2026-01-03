'use client'

import { useState, useRef } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Progress } from '@/components/ui/progress'
import { Slider } from '@/components/ui/slider'
import { 
  Sparkles, 
  Brain, 
  Wand2, 
  FileText, 
  Copy, 
  RefreshCw, 
  Settings, 
  TrendingUp, 
  Target, 
  Lightbulb,
  MessageSquare,
  Image,
  BarChart,
  CheckCircle,
  AlertCircle,
  Clock,
  Star,
  Zap,
  BookOpen,
  Users,
  DollarSign,
  Eye,
  ThumbsUp,
  ThumbsDown,
  Download,
  Save
} from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { api } from '@/lib/api'

interface AITemplate {
  id: string
  name: string
  description: string
  category: string
  industry: string[]
  tone: string
  length: 'short' | 'medium' | 'long'
  sections: string[]
  popularity: number
  successRate: number
}

interface AIGeneration {
  id: string
  type: 'content' | 'optimization' | 'summary' | 'translation'
  input: string
  output: string
  model: string
  tokens: number
  status: 'generating' | 'completed' | 'failed'
  createdAt: string
  rating?: number
  feedback?: string
}

interface AIInsight {
  type: 'improvement' | 'warning' | 'suggestion'
  title: string
  description: string
  impact: 'low' | 'medium' | 'high'
  section?: string
  confidence: number
}

interface ContentOptimization {
  readabilityScore: number
  sentimentScore: number
  keywordDensity: Record<string, number>
  suggestions: AIInsight[]
  estimatedConversionRate: number
}

const generateContentSchema = z.object({
  type: z.enum(['proposal', 'section', 'summary', 'email']),
  industry: z.string().min(1, 'Industry is required'),
  tone: z.enum(['professional', 'casual', 'persuasive', 'technical', 'friendly']),
  audience: z.string().min(1, 'Target audience is required'),
  keyPoints: z.string().min(1, 'Key points are required'),
  length: z.enum(['short', 'medium', 'long']),
  includeData: z.boolean().optional(),
  includeTestimonials: z.boolean().optional(),
})

const optimizeContentSchema = z.object({
  content: z.string().min(1, 'Content is required'),
  goals: z.array(z.string()).min(1, 'At least one goal is required'),
  targetAudience: z.string().min(1, 'Target audience is required'),
})

type GenerateContentForm = z.infer<typeof generateContentSchema>
type OptimizeContentForm = z.infer<typeof optimizeContentSchema>

export default function AIAssistantPage() {
  const [activeGeneration, setActiveGeneration] = useState<string | null>(null)
  const [generatedContent, setGeneratedContent] = useState<string>('')
  const [optimizationResults, setOptimizationResults] = useState<ContentOptimization | null>(null)
  const [showInsights, setShowInsights] = useState(false)
  const queryClient = useQueryClient()
  const contentRef = useRef<HTMLTextAreaElement>(null)

  const { register: registerGenerate, handleSubmit: handleGenerateSubmit, formState: { errors: generateErrors }, watch: watchGenerate, setValue: setGenerateValue } = useForm<GenerateContentForm>({
    resolver: zodResolver(generateContentSchema),
    defaultValues: {
      tone: 'professional',
      length: 'medium',
      includeData: true,
      includeTestimonials: false,
    }
  })

  const { register: registerOptimize, handleSubmit: handleOptimizeSubmit, formState: { errors: optimizeErrors }, setValue: setOptimizeValue } = useForm<OptimizeContentForm>({
    resolver: zodResolver(optimizeContentSchema),
  })

  // Fetch AI data
  const { data: templates } = useQuery({
    queryKey: ['ai', 'templates'],
    queryFn: () => api.get('/ai/templates').then(res => res.data),
  })

  const { data: generations } = useQuery({
    queryKey: ['ai', 'generations'],
    queryFn: () => api.get('/ai/generations').then(res => res.data),
  })

  const { data: usage } = useQuery({
    queryKey: ['ai', 'usage'],
    queryFn: () => api.get('/ai/usage').then(res => res.data),
  })

  const { data: insights } = useQuery({
    queryKey: ['ai', 'insights'],
    queryFn: () => api.get('/ai/insights').then(res => res.data),
    enabled: showInsights,
  })

  // Mutations
  const generateContentMutation = useMutation({
    mutationFn: (data: GenerateContentForm) => api.post('/ai/generate', data),
    onSuccess: (response) => {
      setGeneratedContent(response.data.content)
      setActiveGeneration(response.data.id)
      toast.success('Content generated successfully!')
      queryClient.invalidateQueries({ queryKey: ['ai', 'generations'] })
      queryClient.invalidateQueries({ queryKey: ['ai', 'usage'] })
    },
    onError: () => {
      toast.error('Failed to generate content')
    }
  })

  const optimizeContentMutation = useMutation({
    mutationFn: (data: OptimizeContentForm) => api.post('/ai/optimize', data),
    onSuccess: (response) => {
      setOptimizationResults(response.data)
      toast.success('Content optimized!')
      queryClient.invalidateQueries({ queryKey: ['ai', 'usage'] })
    },
    onError: () => {
      toast.error('Failed to optimize content')
    }
  })

  const improveToneMutation = useMutation({
    mutationFn: ({ content, targetTone }: { content: string, targetTone: string }) => 
      api.post('/ai/improve-tone', { content, targetTone }),
    onSuccess: (response) => {
      setGeneratedContent(response.data.content)
      toast.success('Tone improved!')
    },
  })

  const expandContentMutation = useMutation({
    mutationFn: ({ content, section }: { content: string, section?: string }) => 
      api.post('/ai/expand', { content, section }),
    onSuccess: (response) => {
      setGeneratedContent(response.data.content)
      toast.success('Content expanded!')
    },
  })

  const summarizeContentMutation = useMutation({
    mutationFn: (content: string) => api.post('/ai/summarize', { content }),
    onSuccess: (response) => {
      setGeneratedContent(response.data.summary)
      toast.success('Content summarized!')
    },
  })

  const rateGenerationMutation = useMutation({
    mutationFn: ({ id, rating, feedback }: { id: string, rating: number, feedback?: string }) => 
      api.post(`/ai/generations/${id}/rate`, { rating, feedback }),
    onSuccess: () => {
      toast.success('Feedback submitted!')
      queryClient.invalidateQueries({ queryKey: ['ai', 'generations'] })
    },
  })

  const onGenerateContent = (data: GenerateContentForm) => {
    generateContentMutation.mutate(data)
  }

  const onOptimizeContent = (data: OptimizeContentForm) => {
    optimizeContentMutation.mutate(data)
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    toast.success('Copied to clipboard!')
  }

  const insertIntoEditor = (content: string) => {
    // This would integrate with your TipTap editor
    toast.success('Content inserted into editor!')
  }

  const getInsightIcon = (type: string) => {
    switch (type) {
      case 'improvement':
        return <TrendingUp className="h-4 w-4 text-green-500" />
      case 'warning':
        return <AlertCircle className="h-4 w-4 text-yellow-500" />
      case 'suggestion':
        return <Lightbulb className="h-4 w-4 text-blue-500" />
      default:
        return <MessageSquare className="h-4 w-4 text-gray-500" />
    }
  }

  const getImpactColor = (impact: string) => {
    switch (impact) {
      case 'high':
        return 'text-red-500'
      case 'medium':
        return 'text-yellow-500'
      case 'low':
        return 'text-green-500'
      default:
        return 'text-gray-500'
    }
  }

  return (
    <div className="flex-1 space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">AI Proposal Assistant</h2>
          <p className="text-muted-foreground">
            Generate, optimize, and enhance your proposals with AI-powered insights
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Badge variant="outline" className="flex items-center space-x-1">
            <Zap className="h-3 w-3" />
            <span>{usage?.tokensUsed || 0} / {usage?.tokensLimit || 10000} tokens</span>
          </Badge>
          <Button variant="outline" size="sm">
            <Settings className="mr-2 h-4 w-4" />
            AI Settings
          </Button>
        </div>
      </div>

      {/* Usage Overview */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Generations This Month</CardTitle>
            <Brain className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{usage?.generationsCount || 0}</div>
            <Progress value={(usage?.generationsCount || 0) / 100 * 100} className="mt-2" />
            <p className="text-xs text-muted-foreground mt-1">
              +12 from last month
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg. Quality Score</CardTitle>
            <Star className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{usage?.averageRating || 4.5}</div>
            <p className="text-xs text-muted-foreground">
              ⭐⭐⭐⭐⭐ Excellent
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Time Saved</CardTitle>
            <Clock className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{usage?.timeSaved || 24}h</div>
            <p className="text-xs text-muted-foreground">
              This month
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
            <Target className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{usage?.successRate || 87}%</div>
            <p className="text-xs text-muted-foreground">
              Proposals approved
            </p>
          </CardContent>
        </Card>
      </div>

      {/* AI Insights Alert */}
      {insights && insights.length > 0 && (
        <Alert className="border-blue-200 bg-blue-50">
          <Sparkles className="h-4 w-4 text-blue-500" />
          <AlertDescription className="text-blue-700">
            <strong>AI Insight:</strong> I've analyzed your recent proposals and found {insights.length} optimization opportunities.
            <Button variant="link" className="p-0 h-auto ml-2 text-blue-700" onClick={() => setShowInsights(true)}>
              View insights →
            </Button>
          </AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="generate" className="space-y-4">
        <TabsList>
          <TabsTrigger value="generate">Generate Content</TabsTrigger>
          <TabsTrigger value="optimize">Optimize</TabsTrigger>
          <TabsTrigger value="templates">Templates</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
          <TabsTrigger value="insights">Insights</TabsTrigger>
        </TabsList>

        <TabsContent value="generate" className="space-y-4">
          <div className="grid gap-6 md:grid-cols-2">
            {/* Generation Form */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Wand2 className="h-5 w-5" />
                  <span>Generate Content</span>
                </CardTitle>
                <CardDescription>
                  Create compelling proposal content with AI assistance
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <form onSubmit={handleGenerateSubmit(onGenerateContent)} className="space-y-4">
                  <div>
                    <Label htmlFor="type">Content Type</Label>
                    <Select {...registerGenerate('type')}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select content type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="proposal">Full Proposal</SelectItem>
                        <SelectItem value="section">Proposal Section</SelectItem>
                        <SelectItem value="summary">Executive Summary</SelectItem>
                        <SelectItem value="email">Follow-up Email</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="industry">Industry</Label>
                    <Select {...registerGenerate('industry')}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select industry" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="technology">Technology</SelectItem>
                        <SelectItem value="marketing">Marketing</SelectItem>
                        <SelectItem value="consulting">Consulting</SelectItem>
                        <SelectItem value="finance">Finance</SelectItem>
                        <SelectItem value="healthcare">Healthcare</SelectItem>
                        <SelectItem value="education">Education</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="tone">Tone</Label>
                    <Select {...registerGenerate('tone')}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="professional">Professional</SelectItem>
                        <SelectItem value="casual">Casual</SelectItem>
                        <SelectItem value="persuasive">Persuasive</SelectItem>
                        <SelectItem value="technical">Technical</SelectItem>
                        <SelectItem value="friendly">Friendly</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="audience">Target Audience</Label>
                    <Input
                      id="audience"
                      {...registerGenerate('audience')}
                      placeholder="e.g., C-level executives, IT managers"
                    />
                    {generateErrors.audience && (
                      <p className="text-sm text-red-500 mt-1">{generateErrors.audience.message}</p>
                    )}
                  </div>

                  <div>
                    <Label htmlFor="keyPoints">Key Points (comma-separated)</Label>
                    <Textarea
                      id="keyPoints"
                      {...registerGenerate('keyPoints')}
                      placeholder="e.g., cost reduction, efficiency improvement, ROI increase"
                      rows={3}
                    />
                    {generateErrors.keyPoints && (
                      <p className="text-sm text-red-500 mt-1">{generateErrors.keyPoints.message}</p>
                    )}
                  </div>

                  <div>
                    <Label htmlFor="length">Content Length</Label>
                    <Select {...registerGenerate('length')}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="short">Short (1-2 paragraphs)</SelectItem>
                        <SelectItem value="medium">Medium (3-5 paragraphs)</SelectItem>
                        <SelectItem value="long">Long (full section)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="includeData"
                        {...registerGenerate('includeData')}
                      />
                      <Label htmlFor="includeData" className="text-sm">Include data & statistics</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="includeTestimonials"
                        {...registerGenerate('includeTestimonials')}
                      />
                      <Label htmlFor="includeTestimonials" className="text-sm">Include testimonials</Label>
                    </div>
                  </div>

                  <Button 
                    type="submit" 
                    className="w-full" 
                    disabled={generateContentMutation.isPending}
                  >
                    {generateContentMutation.isPending ? (
                      <>
                        <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <Sparkles className="mr-2 h-4 w-4" />
                        Generate Content
                      </>
                    )}
                  </Button>
                </form>
              </CardContent>
            </Card>

            {/* Generated Content */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>Generated Content</span>
                  {generatedContent && (
                    <div className="flex space-x-2">
                      <Button variant="outline" size="sm" onClick={() => copyToClipboard(generatedContent)}>
                        <Copy className="h-4 w-4" />
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => insertIntoEditor(generatedContent)}>
                        <FileText className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {generatedContent ? (
                  <div className="space-y-4">
                    <Textarea
                      ref={contentRef}
                      value={generatedContent}
                      onChange={(e) => setGeneratedContent(e.target.value)}
                      rows={12}
                      className="w-full"
                    />
                    
                    <div className="flex flex-wrap gap-2">
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => improveToneMutation.mutate({ 
                          content: generatedContent, 
                          targetTone: 'more persuasive' 
                        })}
                      >
                        <TrendingUp className="mr-1 h-3 w-3" />
                        More Persuasive
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => expandContentMutation.mutate({ content: generatedContent })}
                      >
                        <FileText className="mr-1 h-3 w-3" />
                        Expand
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => summarizeContentMutation.mutate(generatedContent)}
                      >
                        <Target className="mr-1 h-3 w-3" />
                        Summarize
                      </Button>
                    </div>

                    {activeGeneration && (
                      <div className="flex items-center justify-between p-3 bg-gray-50 rounded">
                        <span className="text-sm">Rate this generation:</span>
                        <div className="flex space-x-1">
                          {[1, 2, 3, 4, 5].map(rating => (
                            <Button
                              key={rating}
                              variant="ghost"
                              size="sm"
                              onClick={() => rateGenerationMutation.mutate({ 
                                id: activeGeneration, 
                                rating 
                              })}
                            >
                              <Star className="h-4 w-4" />
                            </Button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <Brain className="h-12 w-12 text-gray-400 mb-4" />
                    <p className="text-muted-foreground">
                      Generated content will appear here
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="optimize" className="space-y-4">
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Target className="h-5 w-5" />
                  <span>Content Optimization</span>
                </CardTitle>
                <CardDescription>
                  Analyze and improve your existing content for better conversion
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleOptimizeSubmit(onOptimizeContent)} className="space-y-4">
                  <div>
                    <Label htmlFor="content">Content to Optimize</Label>
                    <Textarea
                      id="content"
                      {...registerOptimize('content')}
                      placeholder="Paste your proposal content here..."
                      rows={8}
                    />
                    {optimizeErrors.content && (
                      <p className="text-sm text-red-500 mt-1">{optimizeErrors.content.message}</p>
                    )}
                  </div>

                  <div>
                    <Label htmlFor="targetAudience">Target Audience</Label>
                    <Input
                      id="targetAudience"
                      {...registerOptimize('targetAudience')}
                      placeholder="e.g., Enterprise buyers, SMB owners"
                    />
                    {optimizeErrors.targetAudience && (
                      <p className="text-sm text-red-500 mt-1">{optimizeErrors.targetAudience.message}</p>
                    )}
                  </div>

                  <div>
                    <Label>Optimization Goals</Label>
                    <div className="space-y-2 mt-2">
                      {[
                        'Increase conversion rate',
                        'Improve readability',
                        'Enhance persuasiveness',
                        'Reduce objections',
                        'Clarify value proposition'
                      ].map(goal => (
                        <div key={goal} className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            id={goal}
                            {...registerOptimize('goals')}
                            value={goal}
                          />
                          <Label htmlFor={goal} className="text-sm">{goal}</Label>
                        </div>
                      ))}
                    </div>
                  </div>

                  <Button 
                    type="submit" 
                    className="w-full" 
                    disabled={optimizeContentMutation.isPending}
                  >
                    {optimizeContentMutation.isPending ? (
                      <>
                        <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                        Optimizing...
                      </>
                    ) : (
                      <>
                        <Target className="mr-2 h-4 w-4" />
                        Optimize Content
                      </>
                    )}
                  </Button>
                </form>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Optimization Results</CardTitle>
              </CardHeader>
              <CardContent>
                {optimizationResults ? (
                  <div className="space-y-6">
                    {/* Scores */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="text-center">
                        <div className="text-2xl font-bold text-green-600">
                          {optimizationResults.readabilityScore}%
                        </div>
                        <p className="text-sm text-muted-foreground">Readability</p>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-blue-600">
                          {optimizationResults.estimatedConversionRate}%
                        </div>
                        <p className="text-sm text-muted-foreground">Est. Conversion</p>
                      </div>
                    </div>

                    {/* Sentiment */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium">Sentiment Score</span>
                        <span className="text-sm">{optimizationResults.sentimentScore > 0 ? 'Positive' : 'Negative'}</span>
                      </div>
                      <Progress value={(optimizationResults.sentimentScore + 1) / 2 * 100} />
                    </div>

                    {/* Suggestions */}
                    <div>
                      <h4 className="font-medium mb-3">AI Suggestions</h4>
                      <div className="space-y-2">
                        {optimizationResults.suggestions.map((suggestion, index) => (
                          <div key={index} className="flex items-start space-x-2 p-3 bg-gray-50 rounded">
                            {getInsightIcon(suggestion.type)}
                            <div className="flex-1">
                              <p className="font-medium text-sm">{suggestion.title}</p>
                              <p className="text-xs text-muted-foreground">{suggestion.description}</p>
                              <div className="flex items-center space-x-2 mt-1">
                                <Badge variant="outline" className={getImpactColor(suggestion.impact)}>
                                  {suggestion.impact} impact
                                </Badge>
                                <span className="text-xs text-muted-foreground">
                                  {suggestion.confidence}% confidence
                                </span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <BarChart className="h-12 w-12 text-gray-400 mb-4" />
                    <p className="text-muted-foreground">
                      Optimization results will appear here
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="templates" className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium">AI Templates</h3>
            <div className="flex items-center space-x-2">
              <Select defaultValue="all">
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Industries</SelectItem>
                  <SelectItem value="technology">Technology</SelectItem>
                  <SelectItem value="marketing">Marketing</SelectItem>
                  <SelectItem value="consulting">Consulting</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {templates?.map((template: AITemplate) => (
              <Card key={template.id} className="cursor-pointer hover:shadow-md transition-shadow">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">{template.name}</CardTitle>
                    <div className="flex items-center space-x-1">
                      <Star className="h-4 w-4 text-yellow-500" />
                      <span className="text-sm">{template.successRate}%</span>
                    </div>
                  </div>
                  <CardDescription>{template.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex flex-wrap gap-1">
                      <Badge variant="outline">{template.category}</Badge>
                      <Badge variant="outline">{template.tone}</Badge>
                      <Badge variant="outline">{template.length}</Badge>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground mb-2">Sections included:</p>
                      <div className="flex flex-wrap gap-1">
                        {template.sections.slice(0, 3).map(section => (
                          <Badge key={section} variant="secondary" className="text-xs">
                            {section}
                          </Badge>
                        ))}
                        {template.sections.length > 3 && (
                          <Badge variant="secondary" className="text-xs">
                            +{template.sections.length - 3}
                          </Badge>
                        )}
                      </div>
                    </div>
                    <Button 
                      size="sm" 
                      className="w-full"
                      onClick={() => {
                        setGenerateValue('industry', template.industry[0])
                        setGenerateValue('tone', template.tone as any)
                        setGenerateValue('length', template.length)
                        toast.success('Template loaded! Customize and generate.')
                      }}
                    >
                      Use Template
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          <h3 className="text-lg font-medium">Generation History</h3>
          <div className="space-y-4">
            {generations?.map((generation: AIGeneration) => (
              <Card key={generation.id}>
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between">
                    <div className="space-y-2 flex-1">
                      <div className="flex items-center space-x-2">
                        <Badge variant="outline">{generation.type}</Badge>
                        <Badge variant={generation.status === 'completed' ? 'default' : generation.status === 'failed' ? 'destructive' : 'secondary'}>
                          {generation.status}
                        </Badge>
                        {generation.rating && (
                          <div className="flex items-center space-x-1">
                            <Star className="h-3 w-3 text-yellow-500" />
                            <span className="text-xs">{generation.rating}/5</span>
                          </div>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Input: {generation.input.slice(0, 100)}...
                      </p>
                      <p className="text-sm">
                        {generation.output.slice(0, 200)}...
                      </p>
                      <div className="flex items-center space-x-4 text-xs text-muted-foreground">
                        <span>Model: {generation.model}</span>
                        <span>Tokens: {generation.tokens}</span>
                        <span>{generation.createdAt}</span>
                      </div>
                    </div>
                    <div className="flex space-x-2">
                      <Button variant="outline" size="sm" onClick={() => setGeneratedContent(generation.output)}>
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => copyToClipboard(generation.output)}>
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="insights" className="space-y-4">
          <h3 className="text-lg font-medium">AI Insights & Recommendations</h3>
          <div className="space-y-4">
            {insights?.map((insight: AIInsight, index: number) => (
              <Card key={index}>
                <CardContent className="pt-6">
                  <div className="flex items-start space-x-3">
                    {getInsightIcon(insight.type)}
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-medium">{insight.title}</h4>
                        <Badge variant="outline" className={getImpactColor(insight.impact)}>
                          {insight.impact} impact
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mb-2">{insight.description}</p>
                      {insight.section && (
                        <Badge variant="secondary" className="text-xs">
                          Section: {insight.section}
                        </Badge>
                      )}
                      <div className="mt-3">
                        <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                          <span>Confidence</span>
                          <span>{insight.confidence}%</span>
                        </div>
                        <Progress value={insight.confidence} className="h-1" />
                      </div>
                    </div>
                    <Button variant="outline" size="sm">
                      Apply
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}