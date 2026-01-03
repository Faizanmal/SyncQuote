'use client';

import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { 
  Plus, Trash2, Save, Play, Clock, Users, ArrowRight, 
  CheckCircle, XCircle, AlertCircle, GitBranch, Timer 
} from 'lucide-react';
import { toast } from 'sonner';

interface ApprovalStep {
  id: string;
  name: string;
  approverIds: string[];
  requiredApprovals: number;
  allowDelegation: boolean;
  timeoutHours?: number;
  escalationUserId?: string;
  conditions?: ApprovalCondition[];
}

interface ApprovalCondition {
  field: string;
  operator: string;
  value: any;
}

interface ApprovalWorkflow {
  id: string;
  name: string;
  description?: string;
  steps: ApprovalStep[];
  isActive: boolean;
  createdAt: string;
}

interface ApprovalRequest {
  id: string;
  proposalId: string;
  workflowId: string;
  currentStepIndex: number;
  status: string;
  submittedBy: string;
  createdAt: string;
  approvals: any[];
}

export function ApprovalWorkflowBuilder() {
  const [activeTab, setActiveTab] = useState('workflows');
  const [selectedWorkflow, setSelectedWorkflow] = useState<ApprovalWorkflow | null>(null);
  const [editMode, setEditMode] = useState(false);
  const queryClient = useQueryClient();

  const { data: workflows } = useQuery({
    queryKey: ['approval-workflows'],
    queryFn: async () => {
      const res = await fetch('/api/approval-workflows');
      return res.json();
    },
  });

  const { data: pendingApprovals } = useQuery({
    queryKey: ['pending-approvals'],
    queryFn: async () => {
      const res = await fetch('/api/approval-workflows/requests/pending');
      return res.json();
    },
  });

  const createWorkflowMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch('/api/approval-workflows', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['approval-workflows'] });
      toast.success('Workflow created successfully');
      setEditMode(false);
    },
  });

  const updateWorkflowMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const res = await fetch(`/api/approval-workflows/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['approval-workflows'] });
      toast.success('Workflow updated successfully');
      setEditMode(false);
    },
  });

  const approveRequestMutation = useMutation({
    mutationFn: async ({ requestId, data }: { requestId: string; data: any }) => {
      const res = await fetch(`/api/approval-workflows/requests/${requestId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pending-approvals'] });
      toast.success('Approval submitted');
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold">Approval Workflows</h2>
          <p className="text-muted-foreground">Configure multi-level approval processes</p>
        </div>
        <Button onClick={() => setEditMode(true)}>
          <Plus className="mr-2 h-4 w-4" />
          New Workflow
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="workflows">Workflows</TabsTrigger>
          <TabsTrigger value="pending">
            Pending Approvals
            {pendingApprovals?.length > 0 && (
              <Badge variant="destructive" className="ml-2">
                {pendingApprovals.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        <TabsContent value="workflows" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {workflows?.map((workflow: ApprovalWorkflow) => (
              <Card key={workflow.id} className="cursor-pointer hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <CardTitle>{workflow.name}</CardTitle>
                      <CardDescription className="line-clamp-2">
                        {workflow.description}
                      </CardDescription>
                    </div>
                    <Badge variant={workflow.isActive ? 'default' : 'secondary'}>
                      {workflow.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-center text-sm">
                      <GitBranch className="mr-2 h-4 w-4 text-muted-foreground" />
                      <span>{workflow.steps.length} approval steps</span>
                    </div>
                    
                    <div className="flex gap-2">
                      <Button 
                        size="sm" 
                        variant="outline" 
                        className="flex-1"
                        onClick={() => {
                          setSelectedWorkflow(workflow);
                          setEditMode(true);
                        }}
                      >
                        Edit
                      </Button>
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => {
                          updateWorkflowMutation.mutate({
                            id: workflow.id,
                            data: { isActive: !workflow.isActive },
                          });
                        }}
                      >
                        {workflow.isActive ? 'Deactivate' : 'Activate'}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="pending" className="space-y-4">
          {pendingApprovals?.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <CheckCircle className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-lg font-medium">No pending approvals</p>
                <p className="text-sm text-muted-foreground">All caught up!</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {pendingApprovals?.map((request: ApprovalRequest) => (
                <ApprovalRequestCard 
                  key={request.id} 
                  request={request}
                  onApprove={(data) => approveRequestMutation.mutate({ requestId: request.id, data })}
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="history">
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">Approval history will appear here</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {editMode && (
        <WorkflowBuilderDialog
          workflow={selectedWorkflow}
          open={editMode}
          onOpenChange={(open) => {
            setEditMode(open);
            if (!open) setSelectedWorkflow(null);
          }}
          onSave={(data) => {
            if (selectedWorkflow) {
              updateWorkflowMutation.mutate({ id: selectedWorkflow.id, data });
            } else {
              createWorkflowMutation.mutate(data);
            }
          }}
        />
      )}
    </div>
  );
}

function ApprovalRequestCard({ 
  request, 
  onApprove 
}: { 
  request: ApprovalRequest;
  onApprove: (data: any) => void;
}) {
  const [comment, setComment] = useState('');
  const [showRejectDialog, setShowRejectDialog] = useState(false);

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-start">
          <div>
            <CardTitle className="text-lg">Proposal Approval Request</CardTitle>
            <CardDescription>Step {request.currentStepIndex + 1}</CardDescription>
          </div>
          <Badge>{request.status}</Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center">
              <Clock className="mr-1 h-4 w-4 text-muted-foreground" />
              {new Date(request.createdAt).toLocaleDateString()}
            </div>
          </div>

          <div className="flex gap-2">
            <Button 
              className="flex-1" 
              onClick={() => onApprove({ approved: true, comment })}
            >
              <CheckCircle className="mr-2 h-4 w-4" />
              Approve
            </Button>
            <Button 
              variant="destructive" 
              className="flex-1"
              onClick={() => setShowRejectDialog(true)}
            >
              <XCircle className="mr-2 h-4 w-4" />
              Reject
            </Button>
          </div>

          <Input
            placeholder="Add a comment (optional)"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
          />
        </div>
      </CardContent>
    </Card>
  );
}

function WorkflowBuilderDialog({ 
  workflow, 
  open, 
  onOpenChange,
  onSave 
}: {
  workflow: ApprovalWorkflow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (data: any) => void;
}) {
  const [name, setName] = useState(workflow?.name || '');
  const [description, setDescription] = useState(workflow?.description || '');
  const [steps, setSteps] = useState<ApprovalStep[]>(workflow?.steps || []);

  const addStep = () => {
    setSteps([...steps, {
      id: `step-${Date.now()}`,
      name: `Step ${steps.length + 1}`,
      approverIds: [],
      requiredApprovals: 1,
      allowDelegation: false,
    }]);
  };

  const removeStep = (index: number) => {
    setSteps(steps.filter((_, i) => i !== index));
  };

  const updateStep = (index: number, updates: Partial<ApprovalStep>) => {
    const newSteps = [...steps];
    newSteps[index] = { ...newSteps[index], ...updates };
    setSteps(newSteps);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {workflow ? 'Edit Workflow' : 'Create Workflow'}
          </DialogTitle>
          <DialogDescription>
            Configure approval steps and rules
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          <div className="space-y-4">
            <div>
              <Label>Workflow Name</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Standard Approval Process"
              />
            </div>
            <div>
              <Label>Description</Label>
              <Input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe when this workflow should be used"
              />
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold">Approval Steps</h3>
              <Button size="sm" onClick={addStep}>
                <Plus className="mr-2 h-4 w-4" />
                Add Step
              </Button>
            </div>

            <ScrollArea className="h-[400px] pr-4">
              <div className="space-y-4">
                {steps.map((step, index) => (
                  <Card key={step.id}>
                    <CardHeader>
                      <div className="flex justify-between items-center">
                        <CardTitle className="text-base">
                          Step {index + 1}: {step.name}
                        </CardTitle>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => removeStep(index)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div>
                        <Label>Step Name</Label>
                        <Input
                          value={step.name}
                          onChange={(e) => updateStep(index, { name: e.target.value })}
                          placeholder="e.g., Manager Review"
                        />
                      </div>

                      <div>
                        <Label>Required Approvals</Label>
                        <Input
                          type="number"
                          min={1}
                          value={step.requiredApprovals}
                          onChange={(e) => updateStep(index, { requiredApprovals: parseInt(e.target.value) })}
                        />
                      </div>

                      <div className="flex items-center justify-between">
                        <Label>Allow Delegation</Label>
                        <Switch
                          checked={step.allowDelegation}
                          onCheckedChange={(checked) => updateStep(index, { allowDelegation: checked })}
                        />
                      </div>

                      <div>
                        <Label>Timeout (hours)</Label>
                        <Input
                          type="number"
                          min={0}
                          value={step.timeoutHours || ''}
                          onChange={(e) => updateStep(index, { timeoutHours: parseInt(e.target.value) || undefined })}
                          placeholder="Optional"
                        />
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </ScrollArea>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button 
              onClick={() => onSave({ name, description, steps })}
              disabled={!name || steps.length === 0}
            >
              <Save className="mr-2 h-4 w-4" />
              Save Workflow
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
