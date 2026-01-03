'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Switch } from '@/components/ui/switch'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import { 
  FileText, 
  Copy, 
  Download, 
  Eye, 
  Edit, 
  Trash2, 
  GitBranch, 
  Clock, 
  User, 
  Check, 
  X, 
  MoreHorizontal,
  Image,
  Palette,
  Settings,
  Star,
  Search,
  Filter,
  Plus,
  History,
  Share,
  Lock,
  Unlock,
  Calendar,
  Tag,
  Bookmark,
  Layout,
  Type,
  PaintBucket,
  BarChart
} from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { api } from '@/lib/api'

interface Template {
  id: string
  name: string
  description: string
  category: string
  industry: string[]
  thumbnail: string
  content: unknown
  sections: string[]
  popularity: number
  rating: number
  createdBy: string
  createdAt: string
  isPublic: boolean
  usage: number
}

interface DocumentVersion {
  id: string
  version: string
  proposalId: string
  content: unknown
  changes: string[]
  createdBy: string
  createdAt: string
  size: number
  status: 'draft' | 'review' | 'approved' | 'archived'
  approvals: Approval[]
  comments: VersionComment[]
}

interface Approval {
  id: string
  userId: string
  userName: string
  status: 'pending' | 'approved' | 'rejected'
  comment?: string
  timestamp: string
}

interface VersionComment {
  id: string
  userId: string
  userName: string
  content: string
  timestamp: string
}

interface BrandingTheme {
  id: string
  name: string
  colors: {
    primary: string
    secondary: string
    accent: string
    text: string
    background: string
  }
  fonts: {
    heading: string
    body: string
    monospace: string
  }
  logo: string
  isDefault: boolean
}

interface WorkflowStep {
  id: string
  name: string
  type: 'approval' | 'review' | 'notification'
  assignees: string[]
  required: boolean
  order: number
}

interface Workflow {
  id: string
  name: string
  description: string
  steps: WorkflowStep[]
}

const createTemplateSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().min(1, 'Description is required'),
  category: z.string().min(1, 'Category is required'),
  industry: z.array(z.string()).min(1, 'At least one industry is required'),
  isPublic: z.boolean().optional(),
})

const createWorkflowSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
  steps: z.array(z.object({
    name: z.string(),
    type: z.enum(['approval', 'review', 'notification']),
    assignees: z.array(z.string()),
    required: z.boolean(),
  })).min(1, 'At least one step is required'),
})

type CreateTemplateForm = z.infer<typeof createTemplateSchema>
type CreateWorkflowForm = z.infer<typeof createWorkflowSchema>

export default function DocumentsPage() {
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null)
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false)
  const [workflowDialogOpen, setWorkflowDialogOpen] = useState(false)
  const [brandingDialogOpen, setBrandingDialogOpen] = useState(false)
  const [selectedVersion, setSelectedVersion] = useState<DocumentVersion | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('all')
  const queryClient = useQueryClient()

  const { register: registerTemplate, handleSubmit: handleTemplateSubmit, formState: { errors: templateErrors }, reset: resetTemplate } = useForm<CreateTemplateForm>({
    resolver: zodResolver(createTemplateSchema),
  })

  const { register: registerWorkflow, handleSubmit: handleWorkflowSubmit, formState: { errors: workflowErrors }, reset: resetWorkflow } = useForm<CreateWorkflowForm>({
    resolver: zodResolver(createWorkflowSchema),
  })

  // Fetch data
  const { data: templates } = useQuery({
    queryKey: ['documents', 'templates', searchQuery, selectedCategory],
    queryFn: () => api.get(`/documents/templates?search=${searchQuery}&category=${selectedCategory}`).then(res => res.data),
  })

  const { data: versions } = useQuery({
    queryKey: ['documents', 'versions'],
    queryFn: () => api.get('/documents/versions').then(res => res.data),
  })

  const { data: workflows } = useQuery({
    queryKey: ['documents', 'workflows'],
    queryFn: () => api.get('/documents/workflows').then(res => res.data),
  })

  const { data: themes } = useQuery({
    queryKey: ['documents', 'themes'],
    queryFn: () => api.get('/documents/themes').then(res => res.data),
  })

  // Mutations
  const createTemplateMutation = useMutation({
    mutationFn: (data: CreateTemplateForm) => api.post('/documents/templates', data),
    onSuccess: () => {
      toast.success('Template created successfully!')
      setTemplateDialogOpen(false)
      resetTemplate()
      queryClient.invalidateQueries({ queryKey: ['documents', 'templates'] })
    },
    onError: () => {
      toast.error('Failed to create template')
    }
  })

  const createVersionMutation = useMutation({
    mutationFn: ({ proposalId, changes }: { proposalId: string, changes: string[] }) => 
      api.post(`/documents/proposals/${proposalId}/versions`, { changes }),
    onSuccess: () => {
      toast.success('New version created!')
      queryClient.invalidateQueries({ queryKey: ['documents', 'versions'] })
    },
  })

  const approveVersionMutation = useMutation({
    mutationFn: ({ versionId, comment }: { versionId: string, comment?: string }) => 
      api.post(`/documents/versions/${versionId}/approve`, { comment }),
    onSuccess: () => {
      toast.success('Version approved!')
      queryClient.invalidateQueries({ queryKey: ['documents', 'versions'] })
    },
  })

  const rejectVersionMutation = useMutation({
    mutationFn: ({ versionId, comment }: { versionId: string, comment: string }) => 
      api.post(`/documents/versions/${versionId}/reject`, { comment }),
    onSuccess: () => {
      toast.success('Version rejected!')
      queryClient.invalidateQueries({ queryKey: ['documents', 'versions'] })
    },
  })

  const createWorkflowMutation = useMutation({
    mutationFn: (data: CreateWorkflowForm) => api.post('/documents/workflows', data),
    onSuccess: () => {
      toast.success('Workflow created successfully!')
      setWorkflowDialogOpen(false)
      resetWorkflow()
      queryClient.invalidateQueries({ queryKey: ['documents', 'workflows'] })
    },
  })

  const createThemeMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => api.post('/documents/themes', data),
    onSuccess: () => {
      toast.success('Theme created successfully!')
      setBrandingDialogOpen(false)
      queryClient.invalidateQueries({ queryKey: ['documents', 'themes'] })
    },
  })

  const onCreateTemplate = (data: CreateTemplateForm) => {
    createTemplateMutation.mutate(data)
  }

  const onCreateWorkflow = (data: CreateWorkflowForm) => {
    createWorkflowMutation.mutate(data)
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved':
        return 'default'
      case 'review':
        return 'secondary'
      case 'rejected':
        return 'destructive'
      case 'draft':
        return 'outline'
      default:
        return 'outline'
    }
  }

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'proposal':
        return <FileText className="h-4 w-4" />
      case 'contract':
        return <Lock className="h-4 w-4" />
      case 'presentation':
        return <Layout className="h-4 w-4" />
      case 'report':
        return <BarChart className="h-4 w-4" />
      default:
        return <FileText className="h-4 w-4" />
    }
  }

  const filteredTemplates = templates?.filter((template: Template) => 
    template.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    template.description.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div className="flex-1 space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Document Management</h2>
          <p className="text-muted-foreground">
            Manage templates, versions, workflows, and branding for your documents
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Button variant="outline">
            <Download className="mr-2 h-4 w-4" />
            Export All
          </Button>
          <Button variant="outline">
            <Settings className="mr-2 h-4 w-4" />
            Document Settings
          </Button>
        </div>
      </div>

      <Tabs defaultValue="templates" className="space-y-4">
        <TabsList>
          <TabsTrigger value="templates">Templates</TabsTrigger>
          <TabsTrigger value="versions">Version Control</TabsTrigger>
          <TabsTrigger value="workflows">Approval Workflows</TabsTrigger>
          <TabsTrigger value="branding">Branding & Themes</TabsTrigger>
        </TabsList>

        <TabsContent value="templates" className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search templates..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 w-64"
                />
              </div>
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger className="w-40">
                  <Filter className="mr-2 h-4 w-4" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  <SelectItem value="proposal">Proposals</SelectItem>
                  <SelectItem value="contract">Contracts</SelectItem>
                  <SelectItem value="presentation">Presentations</SelectItem>
                  <SelectItem value="report">Reports</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Dialog open={templateDialogOpen} onOpenChange={setTemplateDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  Create Template
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Create New Template</DialogTitle>
                  <DialogDescription>
                    Create a reusable template for future proposals
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleTemplateSubmit(onCreateTemplate)} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="name">Template Name</Label>
                      <Input
                        id="name"
                        {...registerTemplate('name')}
                        placeholder="Marketing Proposal Template"
                      />
                      {templateErrors.name && (
                        <p className="text-sm text-red-500 mt-1">{templateErrors.name.message}</p>
                      )}
                    </div>
                    <div>
                      <Label htmlFor="category">Category</Label>
                      <Select {...registerTemplate('category')}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select category" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="proposal">Proposal</SelectItem>
                          <SelectItem value="contract">Contract</SelectItem>
                          <SelectItem value="presentation">Presentation</SelectItem>
                          <SelectItem value="report">Report</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                      id="description"
                      {...registerTemplate('description')}
                      placeholder="Describe what this template is for..."
                      rows={3}
                    />
                    {templateErrors.description && (
                      <p className="text-sm text-red-500 mt-1">{templateErrors.description.message}</p>
                    )}
                  </div>
                  <div>
                    <Label>Industries</Label>
                    <div className="grid grid-cols-3 gap-2 mt-2">
                      {['Technology', 'Marketing', 'Consulting', 'Finance', 'Healthcare', 'Education'].map(industry => (
                        <div key={industry} className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            id={industry}
                            {...registerTemplate('industry')}
                            value={industry.toLowerCase()}
                          />
                          <Label htmlFor={industry} className="text-sm">{industry}</Label>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="isPublic"
                      {...registerTemplate('isPublic')}
                    />
                    <Label htmlFor="isPublic" className="text-sm">Make this template public</Label>
                  </div>
                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setTemplateDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button type="submit" disabled={createTemplateMutation.isPending}>
                      {createTemplateMutation.isPending ? 'Creating...' : 'Create Template'}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredTemplates?.map((template: Template) => (
              <Card key={template.id} className="cursor-pointer hover:shadow-md transition-shadow">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      {getCategoryIcon(template.category)}
                      <CardTitle className="text-base">{template.name}</CardTitle>
                    </div>
                    <div className="flex items-center space-x-1">
                      <Star className="h-4 w-4 text-yellow-500" />
                      <span className="text-sm">{template.rating}</span>
                    </div>
                  </div>
                  <CardDescription>{template.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex flex-wrap gap-1">
                      <Badge variant="outline">{template.category}</Badge>
                      {template.industry.slice(0, 2).map(ind => (
                        <Badge key={ind} variant="secondary" className="text-xs">{ind}</Badge>
                      ))}
                      {template.industry.length > 2 && (
                        <Badge variant="secondary" className="text-xs">+{template.industry.length - 2}</Badge>
                      )}
                    </div>
                    <div className="flex items-center justify-between text-sm text-muted-foreground">
                      <span>{template.usage} uses</span>
                      <span>by {template.createdBy}</span>
                    </div>
                    <div className="flex space-x-2">
                      <Button size="sm" className="flex-1" onClick={() => setSelectedTemplate(template)}>
                        <Eye className="mr-1 h-3 w-3" />
                        Preview
                      </Button>
                      <Button size="sm" variant="outline">
                        <Copy className="h-3 w-3" />
                      </Button>
                      <Button size="sm" variant="outline">
                        <Download className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Template Preview Dialog */}
          {selectedTemplate && (
            <Dialog open={!!selectedTemplate} onOpenChange={() => setSelectedTemplate(null)}>
              <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>{selectedTemplate.name}</DialogTitle>
                  <DialogDescription>{selectedTemplate.description}</DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="flex items-center space-x-4">
                    <Badge variant="outline">{selectedTemplate.category}</Badge>
                    <div className="flex items-center space-x-1">
                      <Star className="h-4 w-4 text-yellow-500" />
                      <span>{selectedTemplate.rating}</span>
                    </div>
                    <span className="text-sm text-muted-foreground">{selectedTemplate.usage} uses</span>
                  </div>
                  <Separator />
                  <div>
                    <h4 className="font-medium mb-2">Template Sections</h4>
                    <div className="grid grid-cols-2 gap-2">
                      {selectedTemplate.sections.map(section => (
                        <div key={section} className="flex items-center space-x-2 p-2 bg-gray-50 rounded">
                          <Layout className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm">{section}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="bg-gray-50 p-4 rounded">
                    <h4 className="font-medium mb-2">Template Preview</h4>
                    <div className="text-sm text-muted-foreground">
                      Template content would be rendered here...
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setSelectedTemplate(null)}>
                    Close
                  </Button>
                  <Button>
                    Use Template
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </TabsContent>

        <TabsContent value="versions" className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium">Document Versions</h3>
            <Button variant="outline">
              <GitBranch className="mr-2 h-4 w-4" />
              Create Branch
            </Button>
          </div>

          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Version</TableHead>
                  <TableHead>Document</TableHead>
                  <TableHead>Changes</TableHead>
                  <TableHead>Author</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="w-[70px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {versions?.map((version: DocumentVersion) => (
                  <TableRow key={version.id}>
                    <TableCell>
                      <div className="flex items-center space-x-2">
                        <GitBranch className="h-4 w-4 text-muted-foreground" />
                        <span className="font-mono text-sm">{version.version}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium">Proposal #{version.proposalId}</p>
                        <p className="text-sm text-muted-foreground">{version.size} KB</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        {version.changes.slice(0, 2).map((change, index) => (
                          <Badge key={index} variant="outline" className="text-xs">
                            {change}
                          </Badge>
                        ))}
                        {version.changes.length > 2 && (
                          <Badge variant="outline" className="text-xs">
                            +{version.changes.length - 2} more
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-2">
                        <Avatar className="h-6 w-6">
                          <AvatarFallback className="text-xs">
                            {version.createdBy.split(' ').map(n => n[0]).join('')}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-sm">{version.createdBy}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={getStatusColor(version.status)}>
                        {version.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-1 text-sm text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        <span>{version.createdAt}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex space-x-1">
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => setSelectedVersion(version)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        {version.status === 'review' && (
                          <>
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => approveVersionMutation.mutate({ versionId: version.id })}
                            >
                              <Check className="h-4 w-4 text-green-500" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => rejectVersionMutation.mutate({ 
                                versionId: version.id, 
                                comment: 'Needs revision' 
                              })}
                            >
                              <X className="h-4 w-4 text-red-500" />
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>

          {/* Version Details Dialog */}
          {selectedVersion && (
            <Dialog open={!!selectedVersion} onOpenChange={() => setSelectedVersion(null)}>
              <DialogContent className="max-w-3xl">
                <DialogHeader>
                  <DialogTitle>Version {selectedVersion.version} Details</DialogTitle>
                  <DialogDescription>
                    Document changes and approval status
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <h4 className="font-medium mb-2">Changes Made</h4>
                      <div className="space-y-1">
                        {selectedVersion.changes.map((change, index) => (
                          <div key={index} className="text-sm p-2 bg-blue-50 rounded">
                            {change}
                          </div>
                        ))}
                      </div>
                    </div>
                    <div>
                      <h4 className="font-medium mb-2">Approvals</h4>
                      <div className="space-y-2">
                        {selectedVersion.approvals.map((approval, index) => (
                          <div key={index} className="flex items-center justify-between p-2 border rounded">
                            <div className="flex items-center space-x-2">
                              <Avatar className="h-6 w-6">
                                <AvatarFallback className="text-xs">
                                  {approval.userName.split(' ').map(n => n[0]).join('')}
                                </AvatarFallback>
                              </Avatar>
                              <span className="text-sm">{approval.userName}</span>
                            </div>
                            <Badge variant={getStatusColor(approval.status)}>
                              {approval.status}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                  
                  {selectedVersion.comments && selectedVersion.comments.length > 0 && (
                    <div>
                      <h4 className="font-medium mb-2">Comments</h4>
                      <div className="space-y-2 max-h-40 overflow-y-auto">
                        {selectedVersion.comments.map((comment, index) => (
                          <div key={index} className="flex space-x-2 p-2 bg-gray-50 rounded">
                            <Avatar className="h-6 w-6">
                              <AvatarFallback className="text-xs">
                                {comment.userName.split(' ').map(n => n[0]).join('')}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1">
                              <div className="flex items-center space-x-2">
                                <span className="text-sm font-medium">{comment.userName}</span>
                                <span className="text-xs text-muted-foreground">{comment.timestamp}</span>
                              </div>
                              <p className="text-sm">{comment.content}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setSelectedVersion(null)}>
                    Close
                  </Button>
                  <Button>
                    <Download className="mr-2 h-4 w-4" />
                    Download
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </TabsContent>

        <TabsContent value="workflows" className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium">Approval Workflows</h3>
            <Dialog open={workflowDialogOpen} onOpenChange={setWorkflowDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  Create Workflow
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Create Approval Workflow</DialogTitle>
                  <DialogDescription>
                    Define the approval process for your documents
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleWorkflowSubmit(onCreateWorkflow)} className="space-y-4">
                  <div>
                    <Label htmlFor="name">Workflow Name</Label>
                    <Input
                      id="name"
                      {...registerWorkflow('name')}
                      placeholder="Standard Proposal Approval"
                    />
                    {workflowErrors.name && (
                      <p className="text-sm text-red-500 mt-1">{workflowErrors.name.message}</p>
                    )}
                  </div>
                  <div>
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                      id="description"
                      {...registerWorkflow('description')}
                      placeholder="Describe this workflow..."
                      rows={2}
                    />
                  </div>
                  <div>
                    <Label>Workflow Steps</Label>
                    <div className="space-y-2 mt-2">
                      {/* Dynamic workflow steps would go here */}
                      <div className="p-3 border rounded">
                        <div className="grid grid-cols-3 gap-2">
                          <Input placeholder="Step name" />
                          <Select>
                            <SelectTrigger>
                              <SelectValue placeholder="Type" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="approval">Approval</SelectItem>
                              <SelectItem value="review">Review</SelectItem>
                              <SelectItem value="notification">Notification</SelectItem>
                            </SelectContent>
                          </Select>
                          <Select>
                            <SelectTrigger>
                              <SelectValue placeholder="Assignee" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="manager">Manager</SelectItem>
                              <SelectItem value="legal">Legal Team</SelectItem>
                              <SelectItem value="finance">Finance Team</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <Button type="button" variant="outline" size="sm">
                        <Plus className="mr-1 h-3 w-3" />
                        Add Step
                      </Button>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setWorkflowDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button type="submit" disabled={createWorkflowMutation.isPending}>
                      {createWorkflowMutation.isPending ? 'Creating...' : 'Create Workflow'}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {workflows?.map((workflow: Workflow) => (
              <Card key={workflow.id}>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span>{workflow.name}</span>
                    <Badge variant="outline">{workflow.steps?.length || 0} steps</Badge>
                  </CardTitle>
                  <CardDescription>{workflow.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div>
                      <p className="text-sm font-medium mb-2">Workflow Steps:</p>
                      <div className="space-y-1">
                        {workflow.steps?.map((step: WorkflowStep, index: number) => (
                          <div key={step.id} className="flex items-center space-x-2 text-sm">
                            <div className="w-5 h-5 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs">
                              {index + 1}
                            </div>
                            <span>{step.name}</span>
                            <Badge variant="outline" className="text-xs">{step.type}</Badge>
                            {step.required && <Badge variant="secondary" className="text-xs">Required</Badge>}
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="flex space-x-2">
                      <Button variant="outline" size="sm" className="flex-1">
                        <Edit className="mr-1 h-3 w-3" />
                        Edit
                      </Button>
                      <Button variant="outline" size="sm" className="flex-1">
                        <Copy className="mr-1 h-3 w-3" />
                        Duplicate
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="branding" className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium">Branding & Themes</h3>
            <Dialog open={brandingDialogOpen} onOpenChange={setBrandingDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  Create Theme
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Create Brand Theme</DialogTitle>
                  <DialogDescription>
                    Customize colors, fonts, and styling for your documents
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="themeName">Theme Name</Label>
                    <Input id="themeName" placeholder="Corporate Blue" />
                  </div>
                  <div>
                    <Label>Colors</Label>
                    <div className="grid grid-cols-5 gap-2 mt-2">
                      <div>
                        <Label className="text-xs">Primary</Label>
                        <div className="flex items-center space-x-2">
                          <div className="w-8 h-8 bg-blue-600 rounded border"></div>
                          <Input className="text-xs" value="#2563EB" />
                        </div>
                      </div>
                      <div>
                        <Label className="text-xs">Secondary</Label>
                        <div className="flex items-center space-x-2">
                          <div className="w-8 h-8 bg-gray-600 rounded border"></div>
                          <Input className="text-xs" value="#4B5563" />
                        </div>
                      </div>
                      <div>
                        <Label className="text-xs">Accent</Label>
                        <div className="flex items-center space-x-2">
                          <div className="w-8 h-8 bg-green-500 rounded border"></div>
                          <Input className="text-xs" value="#10B981" />
                        </div>
                      </div>
                      <div>
                        <Label className="text-xs">Text</Label>
                        <div className="flex items-center space-x-2">
                          <div className="w-8 h-8 bg-gray-900 rounded border"></div>
                          <Input className="text-xs" value="#111827" />
                        </div>
                      </div>
                      <div>
                        <Label className="text-xs">Background</Label>
                        <div className="flex items-center space-x-2">
                          <div className="w-8 h-8 bg-white rounded border"></div>
                          <Input className="text-xs" value="#FFFFFF" />
                        </div>
                      </div>
                    </div>
                  </div>
                  <div>
                    <Label>Typography</Label>
                    <div className="grid grid-cols-3 gap-2 mt-2">
                      <div>
                        <Label className="text-xs">Heading Font</Label>
                        <Select>
                          <SelectTrigger>
                            <SelectValue placeholder="Select font" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="inter">Inter</SelectItem>
                            <SelectItem value="roboto">Roboto</SelectItem>
                            <SelectItem value="open-sans">Open Sans</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-xs">Body Font</Label>
                        <Select>
                          <SelectTrigger>
                            <SelectValue placeholder="Select font" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="inter">Inter</SelectItem>
                            <SelectItem value="roboto">Roboto</SelectItem>
                            <SelectItem value="open-sans">Open Sans</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-xs">Mono Font</Label>
                        <Select>
                          <SelectTrigger>
                            <SelectValue placeholder="Select font" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="fira-code">Fira Code</SelectItem>
                            <SelectItem value="source-code">Source Code Pro</SelectItem>
                            <SelectItem value="jetbrains-mono">JetBrains Mono</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="logo">Logo Upload</Label>
                    <div className="mt-2 border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                      <Image className="mx-auto h-12 w-12 text-gray-400" />
                      <div className="mt-2">
                        <Button variant="outline" size="sm">
                          Upload Logo
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">PNG, JPG up to 2MB</p>
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setBrandingDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={() => createThemeMutation.mutate({})}>
                    Create Theme
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {themes?.map((theme: BrandingTheme) => (
              <Card key={theme.id} className="cursor-pointer hover:shadow-md transition-shadow">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">{theme.name}</CardTitle>
                    {theme.isDefault && (
                      <Badge variant="default">Default</Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div>
                      <p className="text-sm font-medium mb-2">Color Palette</p>
                      <div className="flex space-x-1">
                        <div 
                          className="w-6 h-6 rounded border"
                          style={{ backgroundColor: theme.colors.primary }}
                        />
                        <div 
                          className="w-6 h-6 rounded border"
                          style={{ backgroundColor: theme.colors.secondary }}
                        />
                        <div 
                          className="w-6 h-6 rounded border"
                          style={{ backgroundColor: theme.colors.accent }}
                        />
                        <div 
                          className="w-6 h-6 rounded border"
                          style={{ backgroundColor: theme.colors.text }}
                        />
                        <div 
                          className="w-6 h-6 rounded border"
                          style={{ backgroundColor: theme.colors.background }}
                        />
                      </div>
                    </div>
                    <div>
                      <p className="text-sm font-medium mb-1">Typography</p>
                      <div className="text-xs text-muted-foreground">
                        <p>Heading: {theme.fonts.heading}</p>
                        <p>Body: {theme.fonts.body}</p>
                      </div>
                    </div>
                    <div className="flex space-x-2">
                      <Button size="sm" variant="outline" className="flex-1">
                        <Eye className="mr-1 h-3 w-3" />
                        Preview
                      </Button>
                      <Button size="sm" className="flex-1">
                        Apply
                      </Button>
                    </div>
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