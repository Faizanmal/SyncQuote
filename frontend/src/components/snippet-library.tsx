'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
  Search,
  Copy,
  Edit,
  Trash2,
  FileText,
  Tag,
  Clock,
  Variable,
  Check,
} from 'lucide-react';
import { useApi } from '@/hooks/use-api';
import { toast } from 'sonner';

interface SnippetVariable {
  name: string;
  defaultValue: string;
  description?: string;
}

interface Snippet {
  id: string;
  name: string;
  description?: string;
  content: string;
  category?: string;
  variables: SnippetVariable[];
  tags: string[];
  isGlobal: boolean;
  useCount: number;
  lastUsedAt?: string;
  createdAt: string;
  updatedAt: string;
}

interface SnippetLibraryProps {
  onInsert?: (content: string) => void;
}

const DEFAULT_CATEGORIES = [
  'introduction',
  'scope',
  'terms',
  'pricing_note',
  'closing',
  'legal',
  'warranty',
  'timeline',
  'other',
];

export function SnippetLibrary({ onInsert }: SnippetLibraryProps) {
  const [snippets, setSnippets] = useState<Snippet[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [insertDialogOpen, setInsertDialogOpen] = useState(false);
  const [selectedSnippet, setSelectedSnippet] = useState<Snippet | null>(null);
  const [variableValues, setVariableValues] = useState<Record<string, string>>({});
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    content: '',
    category: '',
    tags: '',
    isGlobal: false,
  });
  const [variables, setVariables] = useState<SnippetVariable[]>([]);
  const api = useApi();

  useEffect(() => {
    fetchSnippets();
    fetchCategories();
  }, []);

  const fetchSnippets = async () => {
    try {
      setLoading(true);
      const response = await api.get('/snippets');
      setSnippets(response.data);
    } catch (error) {
      toast.error('Failed to load snippets');
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const response = await api.get('/snippets/categories');
      const fetchedCategories = response.data as string[];
      const allCategories = [...new Set([...DEFAULT_CATEGORIES, ...fetchedCategories])];
      setCategories(allCategories);
    } catch (error) {
      setCategories(DEFAULT_CATEGORIES);
    }
  };

  const handleCreate = async () => {
    try {
      await api.post('/snippets', {
        name: formData.name,
        description: formData.description,
        content: formData.content,
        category: formData.category || undefined,
        variables,
        tags: formData.tags.split(',').map(t => t.trim()).filter(Boolean),
        isGlobal: formData.isGlobal,
      });
      toast.success('Snippet created!');
      setEditDialogOpen(false);
      resetForm();
      fetchSnippets();
    } catch (error) {
      toast.error('Failed to create snippet');
    }
  };

  const handleUpdate = async () => {
    if (!selectedSnippet) return;
    try {
      await api.put(`/snippets/${selectedSnippet.id}`, {
        name: formData.name,
        description: formData.description,
        content: formData.content,
        category: formData.category || undefined,
        variables,
        tags: formData.tags.split(',').map(t => t.trim()).filter(Boolean),
        isGlobal: formData.isGlobal,
      });
      toast.success('Snippet updated!');
      setEditDialogOpen(false);
      resetForm();
      fetchSnippets();
    } catch (error) {
      toast.error('Failed to update snippet');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this snippet?')) return;
    try {
      await api.delete(`/snippets/${id}`);
      toast.success('Snippet deleted');
      fetchSnippets();
    } catch (error) {
      toast.error('Failed to delete snippet');
    }
  };

  const handleDuplicate = async (id: string) => {
    try {
      await api.post(`/snippets/${id}/duplicate`);
      toast.success('Snippet duplicated!');
      fetchSnippets();
    } catch (error) {
      toast.error('Failed to duplicate snippet');
    }
  };

  const handleInsert = async () => {
    if (!selectedSnippet || !onInsert) return;
    
    try {
      const response = await api.post(`/snippets/${selectedSnippet.id}/process`, {
        variables: variableValues,
      });
      
      onInsert(response.data.content);
      toast.success('Snippet inserted!');
      setInsertDialogOpen(false);
      setSelectedSnippet(null);
      setVariableValues({});
    } catch (error) {
      toast.error('Failed to process snippet');
    }
  };

  const openInsertDialog = (snippet: Snippet) => {
    setSelectedSnippet(snippet);
    // Initialize variable values with defaults
    const defaults: Record<string, string> = {};
    snippet.variables.forEach(v => {
      defaults[v.name] = v.defaultValue;
    });
    setVariableValues(defaults);
    setInsertDialogOpen(true);
  };

  const openEditDialog = (snippet?: Snippet) => {
    if (snippet) {
      setSelectedSnippet(snippet);
      setFormData({
        name: snippet.name,
        description: snippet.description || '',
        content: snippet.content,
        category: snippet.category || '',
        tags: snippet.tags.join(', '),
        isGlobal: snippet.isGlobal,
      });
      setVariables(snippet.variables || []);
    } else {
      resetForm();
    }
    setEditDialogOpen(true);
  };

  const resetForm = () => {
    setSelectedSnippet(null);
    setFormData({
      name: '',
      description: '',
      content: '',
      category: '',
      tags: '',
      isGlobal: false,
    });
    setVariables([]);
  };

  const addVariable = () => {
    setVariables([...variables, { name: '', defaultValue: '', description: '' }]);
  };

  const updateVariable = (index: number, field: keyof SnippetVariable, value: string) => {
    const updated = [...variables];
    updated[index] = { ...updated[index], [field]: value };
    setVariables(updated);
  };

  const removeVariable = (index: number) => {
    setVariables(variables.filter((_, i) => i !== index));
  };

  // Extract variables from content automatically
  const extractVariables = () => {
    const matches = formData.content.match(/\{\{(\w+)\}\}/g) || [];
    const varNames = [...new Set(matches.map(m => m.replace(/[{}]/g, '')))];
    const existingNames = variables.map(v => v.name);
    const newVars = varNames
      .filter(name => !existingNames.includes(name))
      .map(name => ({ name, defaultValue: '', description: '' }));
    setVariables([...variables, ...newVars]);
  };

  const filteredSnippets = snippets.filter(snippet => {
    const matchesSearch =
      !searchQuery ||
      snippet.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      snippet.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      snippet.content.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesCategory =
      selectedCategory === 'all' || snippet.category === selectedCategory;
    
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Snippet Library</h2>
          <p className="text-muted-foreground">
            Reusable content blocks for your proposals
          </p>
        </div>
        <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => openEditDialog()}>
              <Plus className="mr-2 h-4 w-4" />
              New Snippet
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {selectedSnippet ? 'Edit Snippet' : 'Create Snippet'}
              </DialogTitle>
              <DialogDescription>
                Create reusable content blocks with dynamic variables
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Name</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g., Standard Introduction"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="category">Category</Label>
                  <Select
                    value={formData.category}
                    onValueChange={(value) => setFormData({ ...formData, category: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((cat) => (
                        <SelectItem key={cat} value={cat}>
                          {cat.charAt(0).toUpperCase() + cat.slice(1).replace(/_/g, ' ')}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Input
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Brief description of this snippet"
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="content">Content</Label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={extractVariables}
                  >
                    <Variable className="mr-2 h-4 w-4" />
                    Extract Variables
                  </Button>
                </div>
                <Textarea
                  id="content"
                  value={formData.content}
                  onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                  placeholder="Use {{variable_name}} for dynamic content..."
                  rows={6}
                />
                <p className="text-xs text-muted-foreground">
                  Use {"{{variable_name}}"} syntax for dynamic variables
                </p>
              </div>

              {/* Variables */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Variables</Label>
                  <Button type="button" variant="outline" size="sm" onClick={addVariable}>
                    <Plus className="mr-2 h-4 w-4" />
                    Add Variable
                  </Button>
                </div>
                <div className="space-y-2">
                  {variables.map((variable, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <Input
                        placeholder="Name"
                        value={variable.name}
                        onChange={(e) => updateVariable(index, 'name', e.target.value)}
                        className="flex-1"
                      />
                      <Input
                        placeholder="Default value"
                        value={variable.defaultValue}
                        onChange={(e) => updateVariable(index, 'defaultValue', e.target.value)}
                        className="flex-1"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeVariable(index)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="tags">Tags</Label>
                <Input
                  id="tags"
                  value={formData.tags}
                  onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                  placeholder="tag1, tag2, tag3"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={selectedSnippet ? handleUpdate : handleCreate}>
                {selectedSnippet ? 'Update' : 'Create'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search snippets..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={selectedCategory} onValueChange={setSelectedCategory}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {categories.map((cat) => (
              <SelectItem key={cat} value={cat}>
                {cat.charAt(0).toUpperCase() + cat.slice(1).replace(/_/g, ' ')}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Snippet List */}
      {loading ? (
        <div className="flex items-center justify-center p-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredSnippets.map((snippet) => (
            <Card key={snippet.id} className="flex flex-col">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <CardTitle className="text-base">{snippet.name}</CardTitle>
                    {snippet.description && (
                      <CardDescription className="text-sm">
                        {snippet.description}
                      </CardDescription>
                    )}
                  </div>
                  {snippet.isGlobal && (
                    <Badge variant="secondary">Global</Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="flex-1">
                <div className="space-y-3">
                  <div className="text-sm text-muted-foreground line-clamp-3">
                    {snippet.content}
                  </div>
                  
                  {snippet.variables.length > 0 && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Variable className="h-3 w-3" />
                      {snippet.variables.length} variable{snippet.variables.length !== 1 ? 's' : ''}
                    </div>
                  )}
                  
                  <div className="flex flex-wrap gap-1">
                    {snippet.category && (
                      <Badge variant="outline" className="text-xs">
                        {snippet.category.replace(/_/g, ' ')}
                      </Badge>
                    )}
                    {snippet.tags.slice(0, 2).map((tag) => (
                      <Badge key={tag} variant="secondary" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                    {snippet.tags.length > 2 && (
                      <Badge variant="secondary" className="text-xs">
                        +{snippet.tags.length - 2}
                      </Badge>
                    )}
                  </div>

                  <div className="flex items-center gap-4 text-xs text-muted-foreground pt-2">
                    <span className="flex items-center gap-1">
                      <FileText className="h-3 w-3" />
                      Used {snippet.useCount}x
                    </span>
                    {snippet.lastUsedAt && (
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {new Date(snippet.lastUsedAt).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </div>
              </CardContent>
              <div className="border-t p-2 flex justify-end gap-1">
                {onInsert && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => openInsertDialog(snippet)}
                  >
                    <Check className="h-4 w-4 mr-1" />
                    Insert
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleDuplicate(snippet.id)}
                >
                  <Copy className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => openEditDialog(snippet)}
                >
                  <Edit className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleDelete(snippet.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </Card>
          ))}
          {filteredSnippets.length === 0 && (
            <div className="col-span-full text-center py-8 text-muted-foreground">
              {searchQuery || selectedCategory !== 'all'
                ? 'No snippets match your filters'
                : 'No snippets yet. Create your first one!'}
            </div>
          )}
        </div>
      )}

      {/* Insert Dialog */}
      <Dialog open={insertDialogOpen} onOpenChange={setInsertDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Insert Snippet</DialogTitle>
            <DialogDescription>
              {selectedSnippet?.name}
            </DialogDescription>
          </DialogHeader>
          {selectedSnippet && selectedSnippet.variables.length > 0 && (
            <div className="space-y-4 py-4">
              <p className="text-sm text-muted-foreground">
                Fill in the variable values:
              </p>
              {selectedSnippet.variables.map((variable) => (
                <div key={variable.name} className="space-y-2">
                  <Label htmlFor={variable.name}>
                    {variable.name.replace(/_/g, ' ')}
                    {variable.description && (
                      <span className="text-muted-foreground font-normal ml-2">
                        ({variable.description})
                      </span>
                    )}
                  </Label>
                  <Input
                    id={variable.name}
                    value={variableValues[variable.name] || ''}
                    onChange={(e) =>
                      setVariableValues({
                        ...variableValues,
                        [variable.name]: e.target.value,
                      })
                    }
                    placeholder={variable.defaultValue || `Enter ${variable.name}`}
                  />
                </div>
              ))}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setInsertDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleInsert}>Insert</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
