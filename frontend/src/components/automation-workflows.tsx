'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Plus,
  Play,
  Pause,
  Edit,
  Trash2,
  Clock,
  Mail,
  Bell,
  Webhook,
  MessageSquare,
  Tag,
  Zap,
  CheckCircle,
  XCircle,
  AlertCircle,
} from 'lucide-react';
import { useApi } from '@/hooks/use-api';
import { toast } from 'sonner';

interface WorkflowTemplate {
  name: string;
  description: string;
  trigger: string;
  delayHours: number;
  action: string;
  actionConfig: Record<string, any>;
}

interface Workflow {
  id: string;
  name: string;
  description?: string;
  isActive: boolean;
  trigger: string;
  triggerConditions?: Record<string, any>;
  delayHours: number;
  action: string;
  actionConfig: Record<string, any>;
  targetTags: string[];
  executionCount: number;
  lastExecutedAt?: string;
  createdAt: string;
  executions?: {
    id: string;
    status: string;
    scheduledFor: string;
    executedAt?: string;
    result?: Record<string, any>;
  }[];
  _count?: {
    executions: number;
  };
}

const TRIGGERS = [
  { value: 'PROPOSAL_SENT', label: 'Proposal Sent', icon: Mail },
  { value: 'PROPOSAL_VIEWED', label: 'Proposal Viewed', icon: CheckCircle },
  { value: 'PROPOSAL_UNOPENED', label: 'Proposal Not Opened', icon: AlertCircle },
  { value: 'PROPOSAL_APPROVED', label: 'Proposal Approved', icon: CheckCircle },
  { value: 'PROPOSAL_DECLINED', label: 'Proposal Declined', icon: XCircle },
  { value: 'PROPOSAL_EXPIRED', label: 'Proposal Expired', icon: Clock },
  { value: 'COMMENT_ADDED', label: 'Comment Added', icon: MessageSquare },
  { value: 'PAYMENT_RECEIVED', label: 'Payment Received', icon: CheckCircle },
];

const ACTIONS = [
  { value: 'SEND_EMAIL', label: 'Send Email', icon: Mail },
  { value: 'SEND_NOTIFICATION', label: 'Send Notification', icon: Bell },
  { value: 'ADD_TAG', label: 'Add Tag', icon: Tag },
  { value: 'WEBHOOK', label: 'Call Webhook', icon: Webhook },
  { value: 'SLACK_NOTIFICATION', label: 'Send to Slack', icon: MessageSquare },
];

export function AutomationWorkflows() {
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [templates, setTemplates] = useState<WorkflowTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedWorkflow, setSelectedWorkflow] = useState<Workflow | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    trigger: 'PROPOSAL_VIEWED',
    delayHours: 0,
    action: 'SEND_NOTIFICATION',
    isActive: true,
    targetTags: '',
  });
  const [actionConfig, setActionConfig] = useState<Record<string, any>>({});
  const api = useApi();

  useEffect(() => {
    fetchWorkflows();
    fetchTemplates();
  }, []);

  const fetchWorkflows = async () => {
    try {
      setLoading(true);
      const response = await api.get('/automation');
      setWorkflows(response.data);
    } catch (error) {
      toast.error('Failed to load automation workflows');
    } finally {
      setLoading(false);
    }
  };

  const fetchTemplates = async () => {
    try {
      const response = await api.get('/automation/templates');
      setTemplates(response.data);
    } catch (error) {
      console.error('Failed to load templates:', error);
    }
  };

  const handleCreate = async () => {
    try {
      await api.post('/automation', {
        name: formData.name,
        description: formData.description,
        trigger: formData.trigger,
        delayHours: formData.delayHours,
        action: formData.action,
        actionConfig,
        targetTags: formData.targetTags.split(',').map(t => t.trim()).filter(Boolean),
        isActive: formData.isActive,
      });
      toast.success('Workflow created!');
      setDialogOpen(false);
      resetForm();
      fetchWorkflows();
    } catch (error) {
      toast.error('Failed to create workflow');
    }
  };

  const handleUpdate = async () => {
    if (!selectedWorkflow) return;
    try {
      await api.put(`/automation/${selectedWorkflow.id}`, {
        name: formData.name,
        description: formData.description,
        trigger: formData.trigger,
        delayHours: formData.delayHours,
        action: formData.action,
        actionConfig,
        targetTags: formData.targetTags.split(',').map(t => t.trim()).filter(Boolean),
        isActive: formData.isActive,
      });
      toast.success('Workflow updated!');
      setDialogOpen(false);
      resetForm();
      fetchWorkflows();
    } catch (error) {
      toast.error('Failed to update workflow');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this workflow?')) return;
    try {
      await api.delete(`/automation/${id}`);
      toast.success('Workflow deleted');
      fetchWorkflows();
    } catch (error) {
      toast.error('Failed to delete workflow');
    }
  };

  const handleToggle = async (id: string) => {
    try {
      await api.post(`/automation/${id}/toggle`);
      fetchWorkflows();
    } catch (error) {
      toast.error('Failed to toggle workflow');
    }
  };

  const useTemplate = (template: WorkflowTemplate) => {
    setFormData({
      name: template.name,
      description: template.description,
      trigger: template.trigger,
      delayHours: template.delayHours,
      action: template.action,
      isActive: true,
      targetTags: '',
    });
    setActionConfig(template.actionConfig);
    setDialogOpen(true);
  };

  const openEditDialog = (workflow?: Workflow) => {
    if (workflow) {
      setSelectedWorkflow(workflow);
      setFormData({
        name: workflow.name,
        description: workflow.description || '',
        trigger: workflow.trigger,
        delayHours: workflow.delayHours,
        action: workflow.action,
        isActive: workflow.isActive,
        targetTags: workflow.targetTags.join(', '),
      });
      setActionConfig(workflow.actionConfig);
    } else {
      resetForm();
    }
    setDialogOpen(true);
  };

  const resetForm = () => {
    setSelectedWorkflow(null);
    setFormData({
      name: '',
      description: '',
      trigger: 'PROPOSAL_VIEWED',
      delayHours: 0,
      action: 'SEND_NOTIFICATION',
      isActive: true,
      targetTags: '',
    });
    setActionConfig({});
  };

  const getTriggerInfo = (trigger: string) => {
    return TRIGGERS.find(t => t.value === trigger) || TRIGGERS[0];
  };

  const getActionInfo = (action: string) => {
    return ACTIONS.find(a => a.value === action) || ACTIONS[0];
  };

  const renderActionConfig = () => {
    switch (formData.action) {
      case 'SEND_EMAIL':
        return (
          <>
            <div className="space-y-2">
              <Label>Recipient</Label>
              <Select
                value={actionConfig.to || 'client'}
                onValueChange={(value) => setActionConfig({ ...actionConfig, to: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="client">Client</SelectItem>
                  <SelectItem value="owner">Proposal Owner</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Subject</Label>
              <Input
                value={actionConfig.subject || ''}
                onChange={(e) => setActionConfig({ ...actionConfig, subject: e.target.value })}
                placeholder="Email subject..."
              />
            </div>
            <div className="space-y-2">
              <Label>Body</Label>
              <Textarea
                value={actionConfig.body || ''}
                onChange={(e) => setActionConfig({ ...actionConfig, body: e.target.value })}
                placeholder="Email body... Use {{proposal_title}}, {{client_name}}, {{proposal_link}}"
                rows={4}
              />
            </div>
          </>
        );
      case 'SEND_NOTIFICATION':
        return (
          <>
            <div className="space-y-2">
              <Label>Title</Label>
              <Input
                value={actionConfig.title || ''}
                onChange={(e) => setActionConfig({ ...actionConfig, title: e.target.value })}
                placeholder="Notification title"
              />
            </div>
            <div className="space-y-2">
              <Label>Message</Label>
              <Textarea
                value={actionConfig.message || ''}
                onChange={(e) => setActionConfig({ ...actionConfig, message: e.target.value })}
                placeholder="Notification message..."
                rows={3}
              />
            </div>
          </>
        );
      case 'ADD_TAG':
        return (
          <>
            <div className="space-y-2">
              <Label>Tag Name</Label>
              <Input
                value={actionConfig.tagName || ''}
                onChange={(e) => setActionConfig({ ...actionConfig, tagName: e.target.value })}
                placeholder="Tag to add"
              />
            </div>
            <div className="space-y-2">
              <Label>Tag Color</Label>
              <Input
                type="color"
                value={actionConfig.tagColor || '#6366f1'}
                onChange={(e) => setActionConfig({ ...actionConfig, tagColor: e.target.value })}
              />
            </div>
          </>
        );
      case 'WEBHOOK':
        return (
          <>
            <div className="space-y-2">
              <Label>Webhook URL</Label>
              <Input
                value={actionConfig.url || ''}
                onChange={(e) => setActionConfig({ ...actionConfig, url: e.target.value })}
                placeholder="https://..."
              />
            </div>
          </>
        );
      case 'SLACK_NOTIFICATION':
        return (
          <>
            <div className="space-y-2">
              <Label>Slack Webhook URL</Label>
              <Input
                value={actionConfig.webhookUrl || ''}
                onChange={(e) => setActionConfig({ ...actionConfig, webhookUrl: e.target.value })}
                placeholder="https://hooks.slack.com/..."
              />
            </div>
            <div className="space-y-2">
              <Label>Title</Label>
              <Input
                value={actionConfig.title || ''}
                onChange={(e) => setActionConfig({ ...actionConfig, title: e.target.value })}
                placeholder="Slack message title"
              />
            </div>
            <div className="space-y-2">
              <Label>Message</Label>
              <Textarea
                value={actionConfig.message || ''}
                onChange={(e) => setActionConfig({ ...actionConfig, message: e.target.value })}
                placeholder="Slack message..."
                rows={3}
              />
            </div>
          </>
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Automation Workflows</h2>
          <p className="text-muted-foreground">
            Automate follow-ups, notifications, and more
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => openEditDialog()}>
              <Plus className="mr-2 h-4 w-4" />
              New Workflow
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {selectedWorkflow ? 'Edit Workflow' : 'Create Workflow'}
              </DialogTitle>
              <DialogDescription>
                Set up automatic actions based on proposal events
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Name</Label>
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Workflow name"
                  />
                </div>
                <div className="flex items-center space-x-2 pt-8">
                  <Switch
                    checked={formData.isActive}
                    onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
                  />
                  <Label>Active</Label>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Description</Label>
                <Input
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="What does this workflow do?"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Trigger</Label>
                  <Select
                    value={formData.trigger}
                    onValueChange={(value) => setFormData({ ...formData, trigger: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TRIGGERS.map((trigger) => (
                        <SelectItem key={trigger.value} value={trigger.value}>
                          <div className="flex items-center gap-2">
                            <trigger.icon className="h-4 w-4" />
                            {trigger.label}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Delay (hours)</Label>
                  <Input
                    type="number"
                    min="0"
                    value={formData.delayHours}
                    onChange={(e) => setFormData({ ...formData, delayHours: parseInt(e.target.value) || 0 })}
                    placeholder="0 = immediate"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Action</Label>
                <Select
                  value={formData.action}
                  onValueChange={(value) => {
                    setFormData({ ...formData, action: value });
                    setActionConfig({});
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ACTIONS.map((action) => (
                      <SelectItem key={action.value} value={action.value}>
                        <div className="flex items-center gap-2">
                          <action.icon className="h-4 w-4" />
                          {action.label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Action-specific config */}
              {renderActionConfig()}

              <div className="space-y-2">
                <Label>Target Tags (optional)</Label>
                <Input
                  value={formData.targetTags}
                  onChange={(e) => setFormData({ ...formData, targetTags: e.target.value })}
                  placeholder="tag1, tag2 (only apply to proposals with these tags)"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={selectedWorkflow ? handleUpdate : handleCreate}>
                {selectedWorkflow ? 'Update' : 'Create'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Templates */}
      {templates.length > 0 && !loading && workflows.length === 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Quick Start Templates</CardTitle>
            <CardDescription>
              Get started with pre-built automation workflows
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2">
              {templates.map((template, index) => (
                <div
                  key={index}
                  className="p-4 border rounded-lg hover:border-primary cursor-pointer transition-colors"
                  onClick={() => useTemplate(template)}
                >
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <h4 className="font-medium">{template.name}</h4>
                      <p className="text-sm text-muted-foreground">
                        {template.description}
                      </p>
                    </div>
                    <Zap className="h-5 w-5 text-primary" />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Workflow List */}
      {loading ? (
        <div className="flex items-center justify-center p-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : (
        <div className="space-y-4">
          {workflows.map((workflow) => {
            const triggerInfo = getTriggerInfo(workflow.trigger);
            const actionInfo = getActionInfo(workflow.action);
            const TriggerIcon = triggerInfo.icon;
            const ActionIcon = actionInfo.icon;

            return (
              <Card key={workflow.id}>
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-4">
                      <div
                        className={`p-2 rounded-lg ${
                          workflow.isActive ? 'bg-primary/10' : 'bg-muted'
                        }`}
                      >
                        <Zap
                          className={`h-5 w-5 ${
                            workflow.isActive ? 'text-primary' : 'text-muted-foreground'
                          }`}
                        />
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold">{workflow.name}</h3>
                          <Badge variant={workflow.isActive ? 'default' : 'secondary'}>
                            {workflow.isActive ? 'Active' : 'Paused'}
                          </Badge>
                        </div>
                        {workflow.description && (
                          <p className="text-sm text-muted-foreground">
                            {workflow.description}
                          </p>
                        )}
                        <div className="flex items-center gap-4 text-sm text-muted-foreground pt-2">
                          <span className="flex items-center gap-1">
                            <TriggerIcon className="h-4 w-4" />
                            {triggerInfo.label}
                          </span>
                          {workflow.delayHours > 0 && (
                            <span className="flex items-center gap-1">
                              <Clock className="h-4 w-4" />
                              {workflow.delayHours}h delay
                            </span>
                          )}
                          <span className="flex items-center gap-1">
                            <ActionIcon className="h-4 w-4" />
                            {actionInfo.label}
                          </span>
                        </div>
                        <div className="flex items-center gap-4 text-xs text-muted-foreground pt-1">
                          <span>
                            Executed {workflow.executionCount || workflow._count?.executions || 0} times
                          </span>
                          {workflow.lastExecutedAt && (
                            <span>
                              Last: {new Date(workflow.lastExecutedAt).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleToggle(workflow.id)}
                      >
                        {workflow.isActive ? (
                          <Pause className="h-4 w-4" />
                        ) : (
                          <Play className="h-4 w-4" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openEditDialog(workflow)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(workflow.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
          {workflows.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              No workflows yet. Create your first automation!
            </div>
          )}
        </div>
      )}
    </div>
  );
}
