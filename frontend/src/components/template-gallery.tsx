'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useApi } from '@/hooks/use-api';
import { FileText, Star, Users } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface Template {
  id: string;
  name: string;
  description: string;
  category: string;
  thumbnail?: string;
  isPublic: boolean;
  useCount: number;
  user?: {
    name?: string;
    companyName?: string;
  };
}

interface TemplateGalleryProps {
  onSelectTemplate: (templateId: string) => void;
}

export function TemplateGallery({ onSelectTemplate }: TemplateGalleryProps) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const api = useApi();

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    try {
      setLoading(true);
      const response = await api.get('/templates');
      setTemplates(response.data);
    } catch (error) {
      console.error('Failed to fetch templates:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePreview = (template: Template) => {
    setSelectedTemplate(template);
    setPreviewOpen(true);
  };

  const handleUseTemplate = async () => {
    if (!selectedTemplate) return;
    onSelectTemplate(selectedTemplate.id);
    setPreviewOpen(false);
  };

  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      CONSULTING: 'bg-blue-100 text-blue-800',
      WEB_DEVELOPMENT: 'bg-purple-100 text-purple-800',
      MARKETING: 'bg-pink-100 text-pink-800',
      CONSTRUCTION: 'bg-orange-100 text-orange-800',
      DESIGN: 'bg-green-100 text-green-800',
      LEGAL: 'bg-gray-100 text-gray-800',
      OTHER: 'bg-slate-100 text-slate-800',
    };
    return colors[category] || colors.OTHER;
  };

  if (loading) {
    return <div className="flex items-center justify-center p-8">Loading templates...</div>;
  }

  return (
    <>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {templates.map((template) => (
          <Card key={template.id} className="hover:shadow-lg transition-shadow cursor-pointer">
            <CardHeader onClick={() => handlePreview(template)}>
              {template.thumbnail ? (
                <img
                  src={template.thumbnail}
                  alt={template.name}
                  className="w-full h-40 object-cover rounded-md mb-2"
                />
              ) : (
                <div className="w-full h-40 bg-gradient-to-br from-blue-100 to-purple-100 rounded-md flex items-center justify-center mb-2">
                  <FileText className="h-16 w-16 text-blue-500" />
                </div>
              )}
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">{template.name}</CardTitle>
                {template.isPublic && (
                  <Badge variant="secondary" className="text-xs">
                    <Users className="h-3 w-3 mr-1" />
                    Public
                  </Badge>
                )}
              </div>
              <CardDescription className="line-clamp-2">
                {template.description || 'No description'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <Badge className={getCategoryColor(template.category)}>
                  {template.category.replace('_', ' ')}
                </Badge>
                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                  <Star className="h-3 w-3" />
                  {template.useCount} uses
                </div>
              </div>
              <Button
                className="w-full mt-4"
                variant="outline"
                onClick={() => handlePreview(template)}
              >
                Preview & Use
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{selectedTemplate?.name}</DialogTitle>
            <DialogDescription>
              {selectedTemplate?.description || 'No description available'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {selectedTemplate?.thumbnail && (
              <img
                src={selectedTemplate.thumbnail}
                alt={selectedTemplate.name}
                className="w-full h-64 object-cover rounded-md"
              />
            )}
            <div className="flex items-center gap-4 text-sm">
              <Badge className={getCategoryColor(selectedTemplate?.category || 'OTHER')}>
                {selectedTemplate?.category.replace('_', ' ')}
              </Badge>
              <span className="text-muted-foreground">
                Used {selectedTemplate?.useCount} times
              </span>
              {selectedTemplate?.isPublic && (
                <Badge variant="secondary">
                  <Users className="h-3 w-3 mr-1" />
                  Public Template
                </Badge>
              )}
            </div>
            {selectedTemplate?.user && (
              <p className="text-sm text-muted-foreground">
                Created by {selectedTemplate.user.name || selectedTemplate.user.companyName}
              </p>
            )}
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setPreviewOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleUseTemplate}>
                Use This Template
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
