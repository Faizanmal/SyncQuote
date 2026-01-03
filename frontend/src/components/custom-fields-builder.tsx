'use client';

import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { 
  Plus, Trash2, GripVertical, Settings, Eye, 
  Save, Type, Hash, Calendar, CheckSquare, List,
  Mail, Phone, Link, FileText, Image, Star
} from 'lucide-react';
import { toast } from 'sonner';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { DragDropContext, Draggable, Droppable, DroppableProvided, DraggableProvided } from '@hello-pangea/dnd';

interface FieldDefinition {
  id: string;
  name: string;
  label: string;
  description?: string;
  type: string;
  scope: string;
  required: boolean;
  order: number;
  placeholder?: string;
  helpText?: string;
  options?: FieldOption[];
  validation?: any;
  isActive: boolean;
}

interface FieldOption {
  value: string;
  label: string;
  color?: string;
  order?: number;
}

interface FieldGroup {
  id: string;
  name: string;
  description?: string;
  scope: string;
  order: number;
  collapsible: boolean;
  fields: FieldDefinition[];
}

const FIELD_TYPES = [
  { value: 'text', label: 'Text', icon: Type },
  { value: 'textarea', label: 'Text Area', icon: FileText },
  { value: 'number', label: 'Number', icon: Hash },
  { value: 'currency', label: 'Currency', icon: Hash },
  { value: 'date', label: 'Date', icon: Calendar },
  { value: 'datetime', label: 'Date & Time', icon: Calendar },
  { value: 'select', label: 'Dropdown', icon: List },
  { value: 'multi_select', label: 'Multi-Select', icon: CheckSquare },
  { value: 'checkbox', label: 'Checkbox', icon: CheckSquare },
  { value: 'email', label: 'Email', icon: Mail },
  { value: 'phone', label: 'Phone', icon: Phone },
  { value: 'url', label: 'URL', icon: Link },
  { value: 'file', label: 'File Upload', icon: FileText },
  { value: 'image', label: 'Image', icon: Image },
  { value: 'rating', label: 'Rating', icon: Star },
];

const FIELD_SCOPES = [
  { value: 'proposal', label: 'Proposal' },
  { value: 'client', label: 'Client' },
  { value: 'line_item', label: 'Line Item' },
  { value: 'template', label: 'Template' },
];

export function CustomFieldsBuilder() {
  const [activeTab, setActiveTab] = useState('fields');
  const [selectedScope, setSelectedScope] = useState('proposal');
  const [showFieldDialog, setShowFieldDialog] = useState(false);
  const [showGroupDialog, setShowGroupDialog] = useState(false);
  const [editingField, setEditingField] = useState<FieldDefinition | null>(null);
  const queryClient = useQueryClient();

  const { data: fields } = useQuery<FieldDefinition[]>({
    queryKey: ['custom-fields', selectedScope],
    queryFn: async () => {
      const res = await fetch(`/api/custom-fields/definitions?scope=${selectedScope}`);
      return res.json();
    },
  });

  const { data: groups } = useQuery({
    queryKey: ['field-groups', selectedScope],
    queryFn: async () => {
      const res = await fetch(`/api/custom-fields/groups?scope=${selectedScope}`);
      return res.json();
    },
  });

  const createFieldMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch('/api/custom-fields/definitions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['custom-fields'] });
      toast.success('Field created successfully');
      setShowFieldDialog(false);
      setEditingField(null);
    },
  });

  const updateFieldMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const res = await fetch(`/api/custom-fields/definitions/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['custom-fields'] });
      toast.success('Field updated successfully');
      setShowFieldDialog(false);
      setEditingField(null);
    },
  });

  const deleteFieldMutation = useMutation({
    mutationFn: async (id: string) => {
      await fetch(`/api/custom-fields/definitions/${id}`, { method: 'DELETE' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['custom-fields'] });
      toast.success('Field deleted');
    },
  });

  const reorderFieldsMutation = useMutation({
    mutationFn: async (orders: Array<{ id: string; order: number }>) => {
      const res = await fetch('/api/custom-fields/definitions/reorder', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orders }),
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['custom-fields'] });
    },
  });

  const handleDragEnd = (result: any) => {
    if (!result.destination || !fields) return;

    const items = Array.from(fields);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);

    const orders = items.map((field: FieldDefinition, index) => ({
      id: field.id,
      order: index,
    }));

    reorderFieldsMutation.mutate(orders);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold">Custom Fields & Forms</h2>
          <p className="text-muted-foreground">Build dynamic forms with custom field types</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowGroupDialog(true)}>
            <Settings className="mr-2 h-4 w-4" />
            Add Group
          </Button>
          <Button onClick={() => {
            setEditingField(null);
            setShowFieldDialog(true);
          }}>
            <Plus className="mr-2 h-4 w-4" />
            Add Field
          </Button>
        </div>
      </div>

      <div className="flex gap-4">
        <Select value={selectedScope} onValueChange={setSelectedScope}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {FIELD_SCOPES.map(scope => (
              <SelectItem key={scope.value} value={scope.value}>
                {scope.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="fields">Fields</TabsTrigger>
          <TabsTrigger value="groups">Groups</TabsTrigger>
          <TabsTrigger value="preview">Preview</TabsTrigger>
        </TabsList>

        <TabsContent value="fields" className="space-y-4">
          <DragDropContext onDragEnd={handleDragEnd}>
            <Droppable droppableId="fields">
              {(provided: DroppableProvided) => (
                <div {...provided.droppableProps} ref={provided.innerRef} className="space-y-3">
                  {fields?.map((field: FieldDefinition, index: number) => (
                    <Draggable key={field.id} draggableId={field.id} index={index}>
                      {(provided: DraggableProvided) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.draggableProps}
                        >
                          <FieldCard
                            field={field}
                            dragHandleProps={provided.dragHandleProps}
                            onEdit={() => {
                              setEditingField(field);
                              setShowFieldDialog(true);
                            }}
                            onDelete={() => deleteFieldMutation.mutate(field.id)}
                          />
                        </div>
                      )}
                    </Draggable>
                  ))}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          </DragDropContext>

          {(!fields || fields.length === 0) && (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Settings className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-lg font-medium">No custom fields yet</p>
                <p className="text-sm text-muted-foreground mb-4">
                  Create fields to collect custom data
                </p>
                <Button onClick={() => setShowFieldDialog(true)}>
                  Add Your First Field
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="groups" className="space-y-4">
          <div className="space-y-4">
            {groups?.map((group: FieldGroup) => (
              <Card key={group.id}>
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle>{group.name}</CardTitle>
                      <CardDescription>{group.description}</CardDescription>
                    </div>
                    <Badge>{group.fields?.length || 0} fields</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {group.fields?.map((field: FieldDefinition) => (
                      <Badge key={field.id} variant="outline">
                        {field.label}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}

            {(!groups || groups.length === 0) && (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  No field groups created yet
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="preview" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Form Preview</CardTitle>
              <CardDescription>See how your custom fields will appear</CardDescription>
            </CardHeader>
            <CardContent>
              <DynamicFormPreview fields={fields || []} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <FieldEditorDialog
        field={editingField}
        scope={selectedScope}
        open={showFieldDialog}
        onOpenChange={setShowFieldDialog}
        onSave={(data) => {
          if (editingField) {
            updateFieldMutation.mutate({ id: editingField.id, data });
          } else {
            createFieldMutation.mutate({ ...data, scope: selectedScope });
          }
        }}
      />
    </div>
  );
}

function FieldCard({ 
  field, 
  dragHandleProps, 
  onEdit, 
  onDelete 
}: {
  field: FieldDefinition;
  dragHandleProps: any;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const FieldIcon = FIELD_TYPES.find(t => t.value === field.type)?.icon || Type;

  return (
    <Card>
      <CardContent className="flex items-center justify-between p-4">
        <div className="flex items-center gap-4 flex-1">
          <div {...dragHandleProps} className="cursor-grab active:cursor-grabbing">
            <GripVertical className="h-5 w-5 text-muted-foreground" />
          </div>

          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <FieldIcon className="h-5 w-5 text-primary" />
          </div>

          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h4 className="font-semibold">{field.label}</h4>
              {field.required && (
                <Badge variant="destructive" className="text-xs">Required</Badge>
              )}
              {!field.isActive && (
                <Badge variant="secondary" className="text-xs">Inactive</Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              {field.description || `Field name: ${field.name}`}
            </p>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="outline" className="text-xs">
                {FIELD_TYPES.find(t => t.value === field.type)?.label}
              </Badge>
              {field.options && field.options.length > 0 && (
                <span className="text-xs text-muted-foreground">
                  {field.options.length} options
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={onEdit}>
            <Settings className="h-4 w-4" />
          </Button>
          <Button size="sm" variant="outline" onClick={onDelete}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function FieldEditorDialog({ field, scope, open, onOpenChange, onSave }: { field?: FieldDefinition | null; scope: string; open: boolean; onOpenChange: (open: boolean) => void; onSave: (data: Partial<FieldDefinition>) => void }) {
  const [formData, setFormData] = useState<any>({
    name: field?.name || '',
    label: field?.label || '',
    description: field?.description || '',
    type: field?.type || 'text',
    required: field?.required || false,
    placeholder: field?.placeholder || '',
    helpText: field?.helpText || '',
    options: field?.options || [],
    validation: field?.validation || {},
  });

  const [newOption, setNewOption] = useState({ value: '', label: '' });

  const addOption = () => {
    if (newOption.value && newOption.label) {
      setFormData({
        ...formData,
        options: [...formData.options, { ...newOption, order: formData.options.length }],
      });
      setNewOption({ value: '', label: '' });
    }
  };

  const removeOption = (index: number) => {
    setFormData({
      ...formData,
      options: formData.options.filter((_: any, i: number) => i !== index),
    });
  };

  const needsOptions = ['select', 'multi_select', 'radio', 'checkbox'].includes(formData.type);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{field ? 'Edit Field' : 'Create Field'}</DialogTitle>
          <DialogDescription>
            Configure field properties and validation rules
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[600px] pr-4">
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Field Name (Internal)</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., project_budget"
                />
              </div>

              <div>
                <Label>Field Label</Label>
                <Input
                  value={formData.label}
                  onChange={(e) => setFormData({ ...formData, label: e.target.value })}
                  placeholder="e.g., Project Budget"
                />
              </div>
            </div>

            <div>
              <Label>Description</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Optional description"
                rows={2}
              />
            </div>

            <div>
              <Label>Field Type</Label>
              <Select value={formData.type} onValueChange={(value) => setFormData({ ...formData, type: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FIELD_TYPES.map(type => (
                    <SelectItem key={type.value} value={type.value}>
                      <div className="flex items-center gap-2">
                        <type.icon className="h-4 w-4" />
                        {type.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {needsOptions && (
              <div>
                <Label>Options</Label>
                <div className="space-y-2 mt-2">
                  {formData.options.map((option: FieldOption, index: number) => (
                    <div key={index} className="flex items-center gap-2">
                      <Input readOnly value={option.label} className="flex-1" />
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => removeOption(index)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                  <div className="flex items-center gap-2">
                    <Input
                      placeholder="Value"
                      value={newOption.value}
                      onChange={(e) => setNewOption({ ...newOption, value: e.target.value })}
                    />
                    <Input
                      placeholder="Label"
                      value={newOption.label}
                      onChange={(e) => setNewOption({ ...newOption, label: e.target.value })}
                    />
                    <Button size="sm" onClick={addOption}>
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Placeholder</Label>
                <Input
                  value={formData.placeholder}
                  onChange={(e) => setFormData({ ...formData, placeholder: e.target.value })}
                  placeholder="Optional placeholder text"
                />
              </div>

              <div>
                <Label>Help Text</Label>
                <Input
                  value={formData.helpText}
                  onChange={(e) => setFormData({ ...formData, helpText: e.target.value })}
                  placeholder="Optional help text"
                />
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label>Required Field</Label>
                <p className="text-sm text-muted-foreground">Users must fill this field</p>
              </div>
              <Switch
                checked={formData.required}
                onCheckedChange={(checked) => setFormData({ ...formData, required: checked })}
              />
            </div>

            {['text', 'textarea'].includes(formData.type) && (
              <div className="space-y-4 border-t pt-4">
                <h4 className="font-semibold">Validation Rules</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Min Length</Label>
                    <Input
                      type="number"
                      value={formData.validation.minLength || ''}
                      onChange={(e) => setFormData({
                        ...formData,
                        validation: { ...formData.validation, minLength: parseInt(e.target.value) }
                      })}
                    />
                  </div>
                  <div>
                    <Label>Max Length</Label>
                    <Input
                      type="number"
                      value={formData.validation.maxLength || ''}
                      onChange={(e) => setFormData({
                        ...formData,
                        validation: { ...formData.validation, maxLength: parseInt(e.target.value) }
                      })}
                    />
                  </div>
                </div>
              </div>
            )}

            {['number', 'currency'].includes(formData.type) && (
              <div className="space-y-4 border-t pt-4">
                <h4 className="font-semibold">Number Validation</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Minimum Value</Label>
                    <Input
                      type="number"
                      value={formData.validation.min || ''}
                      onChange={(e) => setFormData({
                        ...formData,
                        validation: { ...formData.validation, min: parseFloat(e.target.value) }
                      })}
                    />
                  </div>
                  <div>
                    <Label>Maximum Value</Label>
                    <Input
                      type="number"
                      value={formData.validation.max || ''}
                      onChange={(e) => setFormData({
                        ...formData,
                        validation: { ...formData.validation, max: parseFloat(e.target.value) }
                      })}
                    />
                  </div>
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button 
                onClick={() => onSave(formData)}
                disabled={!formData.name || !formData.label}
              >
                <Save className="mr-2 h-4 w-4" />
                Save Field
              </Button>
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

function DynamicFormPreview({ fields }: { fields: FieldDefinition[] }) {
  const [formValues, setFormValues] = useState<Record<string, any>>({});

  const renderField = (field: FieldDefinition) => {
    const commonProps = {
      id: field.name,
      placeholder: field.placeholder,
      required: field.required,
    };

    switch (field.type) {
      case 'text':
      case 'email':
      case 'phone':
      case 'url':
        return <Input {...commonProps} type={field.type} />;

      case 'textarea':
        return <Textarea {...commonProps} rows={3} />;

      case 'number':
      case 'currency':
        return <Input {...commonProps} type="number" />;

      case 'date':
        return <Input {...commonProps} type="date" />;

      case 'datetime':
        return <Input {...commonProps} type="datetime-local" />;

      case 'select':
        return (
          <Select>
            <SelectTrigger>
              <SelectValue placeholder={field.placeholder || 'Select...'} />
            </SelectTrigger>
            <SelectContent>
              {field.options?.map(opt => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );

      case 'checkbox':
        return (
          <div className="space-y-2">
            {field.options?.map(opt => (
              <div key={opt.value} className="flex items-center space-x-2">
                <input type="checkbox" id={`${field.name}-${opt.value}`} />
                <label htmlFor={`${field.name}-${opt.value}`}>{opt.label}</label>
              </div>
            ))}
          </div>
        );

      default:
        return <Input {...commonProps} />;
    }
  };

  return (
    <div className="space-y-6">
      {fields.map((field) => (
        <div key={field.id} className="space-y-2">
          <Label htmlFor={field.name}>
            {field.label}
            {field.required && <span className="text-destructive ml-1">*</span>}
          </Label>
          {field.helpText && (
            <p className="text-sm text-muted-foreground">{field.helpText}</p>
          )}
          {renderField(field)}
        </div>
      ))}

      {fields.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <Eye className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>Add fields to see form preview</p>
        </div>
      )}
    </div>
  );
}
