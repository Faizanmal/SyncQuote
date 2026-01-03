"use client";

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import {
  Plus,
  FileText,
  Pen,
  Clock,
  Send,
  Download,
  Eye,
  MoreHorizontal,
  Search,
  Filter,
  CheckCircle,
  XCircle,
  Loader2,
  Copy,
  Trash2,
  Calendar,
  User,
  Building2,
  FileSignature,
  History,
  AlertTriangle,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';

interface Contract {
  id: string;
  title: string;
  description?: string;
  proposalId: string;
  proposalTitle: string;
  clientName: string;
  clientEmail: string;
  status: 'draft' | 'pending_review' | 'pending_signature' | 'signed' | 'expired' | 'cancelled';
  effectiveDate?: string;
  expirationDate?: string;
  signedAt?: string;
  signedBy?: string;
  templateId?: string;
  templateName?: string;
  createdAt: string;
  updatedAt: string;
}

interface ContractTemplate {
  id: string;
  name: string;
  description?: string;
  category: string;
  content: string;
  variables: Array<{
    name: string;
    type: string;
    label: string;
    required: boolean;
    defaultValue?: any;
  }>;
  isTeamTemplate: boolean;
  usageCount: number;
  createdAt: string;
}

const mockContracts: Contract[] = [
  {
    id: '1',
    title: 'Website Development Agreement',
    description: 'Full-stack website development services contract',
    proposalId: 'prop-1',
    proposalTitle: 'Website Redesign Project',
    clientName: 'Acme Corporation',
    clientEmail: 'legal@acme.com',
    status: 'signed',
    effectiveDate: '2024-02-01',
    expirationDate: '2025-01-31',
    signedAt: '2024-01-28T14:30:00Z',
    signedBy: 'John Smith, CEO',
    createdAt: '2024-01-15T10:00:00Z',
    updatedAt: '2024-01-28T14:30:00Z',
  },
  {
    id: '2',
    title: 'Mobile App Development Contract',
    description: 'Native mobile application development for iOS and Android',
    proposalId: 'prop-2',
    proposalTitle: 'Mobile App Development',
    clientName: 'TechStart Inc',
    clientEmail: 'contracts@techstart.io',
    status: 'pending_signature',
    effectiveDate: '2024-02-15',
    expirationDate: '2024-08-15',
    createdAt: '2024-02-01T09:00:00Z',
    updatedAt: '2024-02-05T16:00:00Z',
  },
  {
    id: '3',
    title: 'E-commerce Platform Agreement',
    description: 'Custom e-commerce platform development and maintenance',
    proposalId: 'prop-3',
    proposalTitle: 'E-commerce Platform',
    clientName: 'RetailMax LLC',
    clientEmail: 'legal@retailmax.com',
    status: 'pending_review',
    templateId: 'tmpl-1',
    templateName: 'Standard Development Agreement',
    createdAt: '2024-02-10T11:00:00Z',
    updatedAt: '2024-02-10T11:00:00Z',
  },
  {
    id: '4',
    title: 'Cloud Migration Services',
    description: 'Enterprise cloud migration and support contract',
    proposalId: 'prop-4',
    proposalTitle: 'Cloud Migration Services',
    clientName: 'DataFlow Systems',
    clientEmail: 'procurement@dataflow.io',
    status: 'draft',
    createdAt: '2024-02-12T08:00:00Z',
    updatedAt: '2024-02-12T08:00:00Z',
  },
];

const mockTemplates: ContractTemplate[] = [
  {
    id: 'tmpl-1',
    name: 'Standard Development Agreement',
    description: 'A comprehensive agreement for software development projects',
    category: 'Development',
    content: '# Development Agreement\n\nThis Agreement is entered into by...',
    variables: [
      { name: 'client_name', type: 'text', label: 'Client Name', required: true },
      { name: 'project_name', type: 'text', label: 'Project Name', required: true },
      { name: 'start_date', type: 'date', label: 'Start Date', required: true },
      { name: 'total_value', type: 'number', label: 'Total Value', required: true },
    ],
    isTeamTemplate: true,
    usageCount: 45,
    createdAt: '2023-06-15T10:00:00Z',
  },
  {
    id: 'tmpl-2',
    name: 'Consulting Services Agreement',
    description: 'Template for consulting and advisory services',
    category: 'Consulting',
    content: '# Consulting Agreement\n\nThis Consulting Agreement...',
    variables: [
      { name: 'client_name', type: 'text', label: 'Client Name', required: true },
      { name: 'hourly_rate', type: 'number', label: 'Hourly Rate', required: true },
      { name: 'scope', type: 'text', label: 'Scope of Work', required: true },
    ],
    isTeamTemplate: true,
    usageCount: 28,
    createdAt: '2023-08-20T14:00:00Z',
  },
  {
    id: 'tmpl-3',
    name: 'NDA - Mutual',
    description: 'Mutual non-disclosure agreement template',
    category: 'Legal',
    content: '# Mutual Non-Disclosure Agreement\n\nThis NDA is entered into...',
    variables: [
      { name: 'party_a', type: 'text', label: 'First Party Name', required: true },
      { name: 'party_b', type: 'text', label: 'Second Party Name', required: true },
      { name: 'effective_date', type: 'date', label: 'Effective Date', required: true },
      { name: 'term_years', type: 'number', label: 'Term (Years)', required: true, defaultValue: 2 },
    ],
    isTeamTemplate: true,
    usageCount: 89,
    createdAt: '2023-05-10T09:00:00Z',
  },
];

export function ContractManagement() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<string>('contracts');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
  const [signDialogOpen, setSignDialogOpen] = useState(false);
  const [selectedContract, setSelectedContract] = useState<Contract | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<ContractTemplate | null>(null);

  // Form state for new contract
  const [newContract, setNewContract] = useState({
    title: '',
    description: '',
    proposalId: '',
    templateId: '',
    effectiveDate: '',
    expirationDate: '',
  });

  // Fetch contracts
  const { data: contracts = mockContracts, isLoading } = useQuery({
    queryKey: ['contracts'],
    queryFn: async () => {
      return mockContracts;
    },
  });

  // Fetch templates
  const { data: templates = mockTemplates } = useQuery({
    queryKey: ['contract-templates'],
    queryFn: async () => {
      return mockTemplates;
    },
  });

  // Create contract mutation
  const createContractMutation = useMutation({
    mutationFn: async (data: typeof newContract) => {
      const response = await fetch('/api/contracts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('Failed to create contract');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contracts'] });
      setCreateDialogOpen(false);
      toast.success('Contract created successfully');
    },
    onError: () => {
      toast.error('Failed to create contract');
    },
  });

  // Request signature mutation
  const requestSignatureMutation = useMutation({
    mutationFn: async (contractId: string) => {
      const response = await fetch(`/api/contracts/${contractId}/request-signature`, {
        method: 'POST',
      });
      if (!response.ok) throw new Error('Failed to request signature');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contracts'] });
      toast.success('Signature request sent to client');
    },
    onError: () => {
      toast.error('Failed to request signature');
    },
  });

  const getStatusBadge = (status: Contract['status']) => {
    const statusConfig = {
      draft: { label: 'Draft', variant: 'secondary' as const, icon: FileText },
      pending_review: { label: 'Pending Review', variant: 'outline' as const, icon: Eye },
      pending_signature: { label: 'Awaiting Signature', variant: 'default' as const, icon: Pen },
      signed: { label: 'Signed', variant: 'default' as const, icon: CheckCircle },
      expired: { label: 'Expired', variant: 'destructive' as const, icon: Clock },
      cancelled: { label: 'Cancelled', variant: 'secondary' as const, icon: XCircle },
    };

    const config = statusConfig[status];
    const Icon = config.icon;

    return (
      <Badge variant={config.variant} className="flex items-center gap-1">
        <Icon className="h-3 w-3" />
        {config.label}
      </Badge>
    );
  };

  const filteredContracts = contracts.filter((contract) => {
    const matchesSearch =
      contract.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      contract.clientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      contract.proposalTitle.toLowerCase().includes(searchQuery.toLowerCase());

    if (statusFilter === 'all') return matchesSearch;
    return matchesSearch && contract.status === statusFilter;
  });

  const contractStats = {
    total: contracts.length,
    draft: contracts.filter((c) => c.status === 'draft').length,
    pending: contracts.filter((c) => c.status === 'pending_signature' || c.status === 'pending_review').length,
    signed: contracts.filter((c) => c.status === 'signed').length,
    expired: contracts.filter((c) => c.status === 'expired').length,
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Contracts</h2>
          <p className="text-muted-foreground">
            Create, manage, and track contracts for your proposals.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setTemplateDialogOpen(true)}>
            <FileText className="h-4 w-4 mr-2" />
            Templates
          </Button>
          <Button onClick={() => setCreateDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Create Contract
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Contracts</p>
                <p className="text-2xl font-bold">{contractStats.total}</p>
              </div>
              <FileSignature className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Drafts</p>
                <p className="text-2xl font-bold">{contractStats.draft}</p>
              </div>
              <FileText className="h-8 w-8 text-gray-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Pending</p>
                <p className="text-2xl font-bold">{contractStats.pending}</p>
              </div>
              <Clock className="h-8 w-8 text-yellow-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Signed</p>
                <p className="text-2xl font-bold text-green-600">{contractStats.signed}</p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Expired</p>
                <p className="text-2xl font-bold text-red-600">{contractStats.expired}</p>
              </div>
              <AlertTriangle className="h-8 w-8 text-red-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="contracts">Contracts</TabsTrigger>
          <TabsTrigger value="templates">Templates</TabsTrigger>
        </TabsList>

        {/* Contracts Tab */}
        <TabsContent value="contracts" className="space-y-4">
          {/* Search and Filters */}
          <div className="flex items-center gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search contracts..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="pending_review">Pending Review</SelectItem>
                <SelectItem value="pending_signature">Awaiting Signature</SelectItem>
                <SelectItem value="signed">Signed</SelectItem>
                <SelectItem value="expired">Expired</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Contracts Table */}
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Contract</TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Effective Date</TableHead>
                    <TableHead>Expiration</TableHead>
                    <TableHead>Last Updated</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredContracts.map((contract) => (
                    <TableRow key={contract.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{contract.title}</p>
                          <p className="text-sm text-muted-foreground truncate max-w-[250px]">
                            {contract.proposalTitle}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Building2 className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <p className="font-medium">{contract.clientName}</p>
                            <p className="text-sm text-muted-foreground">{contract.clientEmail}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>{getStatusBadge(contract.status)}</TableCell>
                      <TableCell>
                        {contract.effectiveDate
                          ? new Date(contract.effectiveDate).toLocaleDateString()
                          : '-'}
                      </TableCell>
                      <TableCell>
                        {contract.expirationDate
                          ? new Date(contract.expirationDate).toLocaleDateString()
                          : '-'}
                      </TableCell>
                      <TableCell>
                        {new Date(contract.updatedAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => setSelectedContract(contract)}>
                              <Eye className="h-4 w-4 mr-2" />
                              View Details
                            </DropdownMenuItem>
                            {contract.status === 'draft' && (
                              <DropdownMenuItem>
                                <Pen className="h-4 w-4 mr-2" />
                                Edit Contract
                              </DropdownMenuItem>
                            )}
                            {(contract.status === 'draft' || contract.status === 'pending_review') && (
                              <DropdownMenuItem
                                onClick={() => requestSignatureMutation.mutate(contract.id)}
                              >
                                <Send className="h-4 w-4 mr-2" />
                                Request Signature
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem>
                              <Download className="h-4 w-4 mr-2" />
                              Download PDF
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                              <Copy className="h-4 w-4 mr-2" />
                              Duplicate
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem>
                              <History className="h-4 w-4 mr-2" />
                              View History
                            </DropdownMenuItem>
                            {contract.status === 'draft' && (
                              <DropdownMenuItem className="text-destructive">
                                <Trash2 className="h-4 w-4 mr-2" />
                                Delete
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Templates Tab */}
        <TabsContent value="templates" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {templates.map((template) => (
              <Card key={template.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-lg">{template.name}</CardTitle>
                      <CardDescription className="mt-1">{template.description}</CardDescription>
                    </div>
                    {template.isTeamTemplate && (
                      <Badge variant="outline">Team</Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Badge variant="secondary">{template.category}</Badge>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <FileText className="h-4 w-4" />
                      <span>{template.variables.length} variables</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <User className="h-4 w-4" />
                      <span>Used {template.usageCount} times</span>
                    </div>
                  </div>
                </CardContent>
                <CardFooter className="flex gap-2">
                  <Button variant="outline" size="sm" className="flex-1">
                    <Eye className="h-4 w-4 mr-1" />
                    Preview
                  </Button>
                  <Button
                    size="sm"
                    className="flex-1"
                    onClick={() => {
                      setNewContract({ ...newContract, templateId: template.id });
                      setCreateDialogOpen(true);
                    }}
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Use Template
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      {/* Create Contract Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="sm:max-w-[550px]">
          <DialogHeader>
            <DialogTitle>Create New Contract</DialogTitle>
            <DialogDescription>
              Create a contract from a proposal using an optional template.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="title">Contract Title</Label>
              <Input
                id="title"
                placeholder="e.g., Website Development Agreement"
                value={newContract.title}
                onChange={(e) => setNewContract({ ...newContract, title: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description (Optional)</Label>
              <Textarea
                id="description"
                placeholder="Brief description of the contract..."
                value={newContract.description}
                onChange={(e) => setNewContract({ ...newContract, description: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="proposal">Proposal</Label>
              <Select
                value={newContract.proposalId}
                onValueChange={(value) => setNewContract({ ...newContract, proposalId: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a proposal" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="prop-1">Website Redesign - Acme Corp</SelectItem>
                  <SelectItem value="prop-2">Mobile App - TechStart</SelectItem>
                  <SelectItem value="prop-3">E-commerce - RetailMax</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="template">Template (Optional)</Label>
              <Select
                value={newContract.templateId}
                onValueChange={(value) => setNewContract({ ...newContract, templateId: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a template or start blank" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Start from blank</SelectItem>
                  {templates.map((template) => (
                    <SelectItem key={template.id} value={template.id}>
                      {template.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="effectiveDate">Effective Date</Label>
                <Input
                  id="effectiveDate"
                  type="date"
                  value={newContract.effectiveDate}
                  onChange={(e) => setNewContract({ ...newContract, effectiveDate: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="expirationDate">Expiration Date</Label>
                <Input
                  id="expirationDate"
                  type="date"
                  value={newContract.expirationDate}
                  onChange={(e) => setNewContract({ ...newContract, expirationDate: e.target.value })}
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => createContractMutation.mutate(newContract)}
              disabled={createContractMutation.isPending || !newContract.title || !newContract.proposalId}
            >
              {createContractMutation.isPending && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              Create Contract
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Contract Details Dialog */}
      <Dialog open={!!selectedContract} onOpenChange={() => setSelectedContract(null)}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>{selectedContract?.title}</DialogTitle>
            <DialogDescription>{selectedContract?.description}</DialogDescription>
          </DialogHeader>

          {selectedContract && (
            <div className="space-y-6 py-4">
              <div className="flex items-center justify-between">
                {getStatusBadge(selectedContract.status)}
                {selectedContract.signedAt && (
                  <div className="text-sm text-muted-foreground">
                    Signed: {new Date(selectedContract.signedAt).toLocaleDateString()}
                  </div>
                )}
              </div>

              <Separator />

              <div className="grid grid-cols-2 gap-6">
                <div>
                  <h4 className="font-semibold mb-2 flex items-center gap-2">
                    <Building2 className="h-4 w-4" />
                    Client
                  </h4>
                  <p className="font-medium">{selectedContract.clientName}</p>
                  <p className="text-sm text-muted-foreground">{selectedContract.clientEmail}</p>
                </div>
                <div>
                  <h4 className="font-semibold mb-2 flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Proposal
                  </h4>
                  <p className="font-medium">{selectedContract.proposalTitle}</p>
                </div>
              </div>

              <Separator />

              <div className="grid grid-cols-2 gap-6">
                <div>
                  <h4 className="font-semibold mb-2 flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    Effective Date
                  </h4>
                  <p>
                    {selectedContract.effectiveDate
                      ? new Date(selectedContract.effectiveDate).toLocaleDateString()
                      : 'Not set'}
                  </p>
                </div>
                <div>
                  <h4 className="font-semibold mb-2 flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    Expiration Date
                  </h4>
                  <p>
                    {selectedContract.expirationDate
                      ? new Date(selectedContract.expirationDate).toLocaleDateString()
                      : 'No expiration'}
                  </p>
                </div>
              </div>

              {selectedContract.signedBy && (
                <>
                  <Separator />
                  <div>
                    <h4 className="font-semibold mb-2 flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      Signed By
                    </h4>
                    <p>{selectedContract.signedBy}</p>
                    <p className="text-sm text-muted-foreground">
                      on {new Date(selectedContract.signedAt!).toLocaleString()}
                    </p>
                  </div>
                </>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedContract(null)}>
              Close
            </Button>
            <Button variant="outline">
              <Download className="h-4 w-4 mr-2" />
              Download PDF
            </Button>
            {selectedContract?.status === 'pending_review' && (
              <Button onClick={() => {
                if (selectedContract) {
                  requestSignatureMutation.mutate(selectedContract.id);
                  setSelectedContract(null);
                }
              }}>
                <Send className="h-4 w-4 mr-2" />
                Request Signature
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default ContractManagement;
