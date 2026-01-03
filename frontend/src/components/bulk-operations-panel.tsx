'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useToast } from '@/components/ui/use-toast';
import {
  CheckSquare,
  Send,
  FileDown,
  Archive,
  Trash2,
  MoreHorizontal,
  Search,
  Filter,
  Loader2,
  FileText,
  Mail,
  Copy,
  Download,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  ChevronDown,
  RefreshCw,
  Eye,
  Edit,
  Layers,
} from 'lucide-react';

interface Proposal {
  id: string;
  title: string;
  clientName: string;
  clientEmail: string;
  status: 'draft' | 'sent' | 'viewed' | 'accepted' | 'declined' | 'expired';
  totalAmount: number;
  createdAt: string;
  expiresAt?: string;
}

interface BatchJob {
  id: string;
  type: 'bulk_send' | 'bulk_update' | 'bulk_export' | 'bulk_delete';
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  progress: number;
  totalItems: number;
  processedItems: number;
  failedItems: number;
  startedAt: string;
  completedAt?: string;
  resultUrl?: string;
}

export function BulkOperationsPanel() {
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [batchJobs, setBatchJobs] = useState<BatchJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [currentJob, setCurrentJob] = useState<BatchJob | null>(null);
  const [showBulkSendDialog, setShowBulkSendDialog] = useState(false);
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [exportFormat, setExportFormat] = useState<'pdf' | 'csv' | 'json' | 'xlsx'>('pdf');
  const { toast } = useToast();

  useEffect(() => {
    fetchProposals();
    fetchBatchJobs();
  }, [statusFilter]);

  useEffect(() => {
    // Poll for job updates if there's an active job
    if (currentJob && ['pending', 'processing'].includes(currentJob.status)) {
      const interval = setInterval(() => {
        fetchJobStatus(currentJob.id);
      }, 2000);
      return () => clearInterval(interval);
    }
  }, [currentJob]);

  const fetchProposals = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/proposals?status=${statusFilter}`);
      const data = await response.json();
      setProposals(data.proposals || []);
    } catch (error) {
      console.error('Failed to fetch proposals:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchBatchJobs = async () => {
    try {
      const response = await fetch('/api/bulk-operations/jobs');
      const data = await response.json();
      setBatchJobs(data.jobs || []);
    } catch (error) {
      console.error('Failed to fetch batch jobs:', error);
    }
  };

  const fetchJobStatus = async (jobId: string) => {
    try {
      const response = await fetch(`/api/bulk-operations/jobs/${jobId}`);
      const data = await response.json();
      setCurrentJob(data.job);
      if (['completed', 'failed', 'cancelled'].includes(data.job.status)) {
        fetchBatchJobs();
        fetchProposals();
      }
    } catch (error) {
      console.error('Failed to fetch job status:', error);
    }
  };

  const toggleSelect = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredProposals.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredProposals.map(p => p.id)));
    }
  };

  const bulkSend = async () => {
    try {
      const response = await fetch('/api/bulk-operations/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ proposalIds: Array.from(selectedIds) }),
      });
      const data = await response.json();
      setCurrentJob(data.job);
      setShowBulkSendDialog(false);
      toast({
        title: 'Bulk send started',
        description: `Sending ${selectedIds.size} proposals`,
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to start bulk send',
        variant: 'destructive',
      });
    }
  };

  const bulkUpdateStatus = async (newStatus: string) => {
    try {
      const response = await fetch('/api/bulk-operations/update-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ proposalIds: Array.from(selectedIds), status: newStatus }),
      });
      const data = await response.json();
      setCurrentJob(data.job);
      toast({
        title: 'Status update started',
        description: `Updating ${selectedIds.size} proposals`,
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to update status',
        variant: 'destructive',
      });
    }
  };

  const bulkExport = async () => {
    try {
      const response = await fetch('/api/bulk-operations/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          proposalIds: Array.from(selectedIds),
          format: exportFormat,
        }),
      });
      const data = await response.json();
      setCurrentJob(data.job);
      setShowExportDialog(false);
      toast({
        title: 'Export started',
        description: `Exporting ${selectedIds.size} proposals as ${exportFormat.toUpperCase()}`,
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to start export',
        variant: 'destructive',
      });
    }
  };

  const bulkDelete = async () => {
    if (!confirm(`Are you sure you want to delete ${selectedIds.size} proposals? This cannot be undone.`)) {
      return;
    }
    try {
      const response = await fetch('/api/bulk-operations/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ proposalIds: Array.from(selectedIds) }),
      });
      const data = await response.json();
      setCurrentJob(data.job);
      setSelectedIds(new Set());
      toast({
        title: 'Delete started',
        description: `Deleting ${selectedIds.size} proposals`,
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to delete proposals',
        variant: 'destructive',
      });
    }
  };

  const cancelJob = async (jobId: string) => {
    try {
      await fetch(`/api/bulk-operations/jobs/${jobId}/cancel`, { method: 'POST' });
      toast({
        title: 'Job cancelled',
        description: 'The batch operation has been cancelled',
      });
      fetchJobStatus(jobId);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to cancel job',
        variant: 'destructive',
      });
    }
  };

  const filteredProposals = proposals.filter(p => {
    const matchesSearch = p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.clientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.clientEmail.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSearch;
  });

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { color: string; icon: React.ReactNode }> = {
      draft: { color: 'bg-gray-500', icon: <FileText className="w-3 h-3" /> },
      sent: { color: 'bg-blue-500', icon: <Send className="w-3 h-3" /> },
      viewed: { color: 'bg-yellow-500', icon: <Eye className="w-3 h-3" /> },
      accepted: { color: 'bg-green-500', icon: <CheckCircle2 className="w-3 h-3" /> },
      declined: { color: 'bg-red-500', icon: <XCircle className="w-3 h-3" /> },
      expired: { color: 'bg-orange-500', icon: <Clock className="w-3 h-3" /> },
    };
    const variant = variants[status] || variants.draft;
    return (
      <Badge className={`${variant.color} flex items-center gap-1`}>
        {variant.icon}
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  };

  const getJobStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge className="bg-green-500"><CheckCircle2 className="w-3 h-3 mr-1" /> Completed</Badge>;
      case 'processing':
        return <Badge className="bg-blue-500"><Loader2 className="w-3 h-3 mr-1 animate-spin" /> Processing</Badge>;
      case 'pending':
        return <Badge variant="secondary"><Clock className="w-3 h-3 mr-1" /> Pending</Badge>;
      case 'failed':
        return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" /> Failed</Badge>;
      case 'cancelled':
        return <Badge variant="outline"><XCircle className="w-3 h-3 mr-1" /> Cancelled</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Bulk Operations</h2>
          <p className="text-muted-foreground">Manage multiple proposals at once</p>
        </div>
      </div>

      {/* Current Job Progress */}
      {currentJob && ['pending', 'processing'].includes(currentJob.status) && (
        <Card className="border-blue-200 bg-blue-50/50 dark:bg-blue-950/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
                <span className="font-medium">
                  {currentJob.type === 'bulk_send' && 'Sending proposals...'}
                  {currentJob.type === 'bulk_update' && 'Updating proposals...'}
                  {currentJob.type === 'bulk_export' && 'Exporting proposals...'}
                  {currentJob.type === 'bulk_delete' && 'Deleting proposals...'}
                </span>
              </div>
              <Button variant="outline" size="sm" onClick={() => cancelJob(currentJob.id)}>
                Cancel
              </Button>
            </div>
            <Progress value={currentJob.progress} className="h-2 mb-2" />
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>{currentJob.processedItems} of {currentJob.totalItems} processed</span>
              {currentJob.failedItems > 0 && (
                <span className="text-destructive">{currentJob.failedItems} failed</span>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Toolbar */}
      <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
        <div className="flex items-center gap-2 w-full md:w-auto">
          <div className="relative flex-1 md:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search proposals..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[140px]">
              <Filter className="w-4 h-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="sent">Sent</SelectItem>
              <SelectItem value="viewed">Viewed</SelectItem>
              <SelectItem value="accepted">Accepted</SelectItem>
              <SelectItem value="declined">Declined</SelectItem>
              <SelectItem value="expired">Expired</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Bulk Actions */}
        {selectedIds.size > 0 && (
          <div className="flex items-center gap-2 bg-muted p-2 rounded-lg">
            <span className="text-sm font-medium px-2">{selectedIds.size} selected</span>
            <Button size="sm" variant="outline" onClick={() => setShowBulkSendDialog(true)}>
              <Send className="w-4 h-4 mr-1" />
              Send
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="outline">
                  <Edit className="w-4 h-4 mr-1" />
                  Update Status
                  <ChevronDown className="w-3 h-3 ml-1" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onClick={() => bulkUpdateStatus('draft')}>
                  <FileText className="w-4 h-4 mr-2" /> Mark as Draft
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => bulkUpdateStatus('sent')}>
                  <Send className="w-4 h-4 mr-2" /> Mark as Sent
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => bulkUpdateStatus('accepted')}>
                  <CheckCircle2 className="w-4 h-4 mr-2" /> Mark as Accepted
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => bulkUpdateStatus('declined')}>
                  <XCircle className="w-4 h-4 mr-2" /> Mark as Declined
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button size="sm" variant="outline" onClick={() => setShowExportDialog(true)}>
              <Download className="w-4 h-4 mr-1" />
              Export
            </Button>
            <Button size="sm" variant="destructive" onClick={bulkDelete}>
              <Trash2 className="w-4 h-4 mr-1" />
              Delete
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setSelectedIds(new Set())}>
              Clear
            </Button>
          </div>
        )}
      </div>

      {/* Proposals Table */}
      <Tabs defaultValue="proposals">
        <TabsList>
          <TabsTrigger value="proposals">
            <Layers className="w-4 h-4 mr-2" />
            Proposals
          </TabsTrigger>
          <TabsTrigger value="jobs">
            <RefreshCw className="w-4 h-4 mr-2" />
            Job History
          </TabsTrigger>
        </TabsList>

        <TabsContent value="proposals" className="mt-4">
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[50px]">
                    <Checkbox
                      checked={selectedIds.size === filteredProposals.length && filteredProposals.length > 0}
                      onCheckedChange={toggleSelectAll}
                    />
                  </TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="w-[80px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredProposals.map((proposal) => (
                  <TableRow key={proposal.id} className={selectedIds.has(proposal.id) ? 'bg-muted/50' : ''}>
                    <TableCell>
                      <Checkbox
                        checked={selectedIds.has(proposal.id)}
                        onCheckedChange={() => toggleSelect(proposal.id)}
                      />
                    </TableCell>
                    <TableCell className="font-medium">{proposal.title}</TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium">{proposal.clientName}</p>
                        <p className="text-sm text-muted-foreground">{proposal.clientEmail}</p>
                      </div>
                    </TableCell>
                    <TableCell>${proposal.totalAmount.toLocaleString()}</TableCell>
                    <TableCell>{getStatusBadge(proposal.status)}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(proposal.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <MoreHorizontal className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem>
                            <Eye className="w-4 h-4 mr-2" /> View
                          </DropdownMenuItem>
                          <DropdownMenuItem>
                            <Edit className="w-4 h-4 mr-2" /> Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem>
                            <Copy className="w-4 h-4 mr-2" /> Duplicate
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="text-destructive">
                            <Trash2 className="w-4 h-4 mr-2" /> Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
                {filteredProposals.length === 0 && !loading && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-12">
                      No proposals found
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="jobs" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Recent Batch Jobs</CardTitle>
              <CardDescription>History of bulk operations</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px]">
                <div className="space-y-4">
                  {batchJobs.map((job) => (
                    <div key={job.id} className="flex items-start gap-4 pb-4 border-b last:border-0">
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">
                              {job.type === 'bulk_send' && 'Bulk Send'}
                              {job.type === 'bulk_update' && 'Status Update'}
                              {job.type === 'bulk_export' && 'Export'}
                              {job.type === 'bulk_delete' && 'Bulk Delete'}
                            </span>
                            {getJobStatusBadge(job.status)}
                          </div>
                          <span className="text-sm text-muted-foreground">
                            {new Date(job.startedAt).toLocaleString()}
                          </span>
                        </div>
                        <div className="mt-2">
                          <Progress value={job.progress} className="h-2" />
                          <div className="flex justify-between mt-1 text-sm text-muted-foreground">
                            <span>{job.processedItems} / {job.totalItems} items</span>
                            {job.failedItems > 0 && (
                              <span className="text-destructive">{job.failedItems} failed</span>
                            )}
                          </div>
                        </div>
                        {job.resultUrl && job.status === 'completed' && (
                          <Button variant="link" size="sm" className="mt-2 p-0 h-auto" asChild>
                            <a href={job.resultUrl} download>
                              <Download className="w-4 h-4 mr-1" />
                              Download Result
                            </a>
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                  {batchJobs.length === 0 && (
                    <div className="text-center text-muted-foreground py-12">
                      No batch jobs yet
                    </div>
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Bulk Send Dialog */}
      <Dialog open={showBulkSendDialog} onOpenChange={setShowBulkSendDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send Proposals</DialogTitle>
            <DialogDescription>
              Send {selectedIds.size} proposals to their respective clients
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
              <Mail className="w-5 h-5 text-muted-foreground" />
              <div>
                <p className="font-medium">{selectedIds.size} emails will be sent</p>
                <p className="text-sm text-muted-foreground">Each client will receive their proposal</p>
              </div>
            </div>
            <div className="p-3 border rounded-lg">
              <h4 className="font-medium mb-2">Preview</h4>
              <p className="text-sm text-muted-foreground">
                Subject: Your proposal from [Company Name]
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBulkSendDialog(false)}>Cancel</Button>
            <Button onClick={bulkSend}>
              <Send className="w-4 h-4 mr-2" />
              Send All
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Export Dialog */}
      <Dialog open={showExportDialog} onOpenChange={setShowExportDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Export Proposals</DialogTitle>
            <DialogDescription>
              Export {selectedIds.size} proposals to a file
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Export Format</Label>
              <Select value={exportFormat} onValueChange={(v: 'pdf' | 'csv' | 'json' | 'xlsx') => setExportFormat(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pdf">PDF Documents</SelectItem>
                  <SelectItem value="csv">CSV Spreadsheet</SelectItem>
                  <SelectItem value="xlsx">Excel Spreadsheet</SelectItem>
                  <SelectItem value="json">JSON Data</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="p-3 bg-muted rounded-lg text-sm">
              {exportFormat === 'pdf' && 'Each proposal will be exported as a separate PDF file, bundled in a ZIP archive.'}
              {exportFormat === 'csv' && 'All proposal data will be exported to a single CSV file.'}
              {exportFormat === 'xlsx' && 'All proposal data will be exported to an Excel spreadsheet with multiple sheets.'}
              {exportFormat === 'json' && 'All proposal data will be exported as structured JSON.'}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowExportDialog(false)}>Cancel</Button>
            <Button onClick={bulkExport}>
              <Download className="w-4 h-4 mr-2" />
              Export
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
