'use client';

import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { 
  Store, Star, Download, DollarSign, TrendingUp, 
  Search, Filter, ShoppingCart, Award, Eye 
} from 'lucide-react';
import { toast } from 'sonner';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';

interface MarketplaceTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  price: number;
  priceType: 'free' | 'one_time' | 'subscription';
  previewImage?: string;
  rating: number;
  reviewCount: number;
  downloads: number;
  sellerId: string;
  sellerName: string;
  isFeatured: boolean;
  tags: string[];
  createdAt: string;
}

interface TemplateReview {
  id: string;
  templateId: string;
  userId: string;
  userName: string;
  rating: number;
  comment: string;
  createdAt: string;
}

interface PublishTemplateData {
  templateId: string;
  name: string;
  description: string;
  category: string;
  priceType: 'free' | 'one_time';
  price: number;
  tags: string[];
}

const CATEGORIES = [
  'Business Proposal',
  'Sales Proposal',
  'Marketing',
  'Consulting',
  'Web Development',
  'Design',
  'Legal',
  'Real Estate',
  'Financial',
  'Other'
];

export function TemplateMarketplace() {
  const [activeTab, setActiveTab] = useState<'browse' | 'my-purchases' | 'seller-dashboard'>('browse');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedTemplate, setSelectedTemplate] = useState<MarketplaceTemplate | null>(null);
  const [showPurchaseDialog, setShowPurchaseDialog] = useState(false);
  const [showPublishDialog, setShowPublishDialog] = useState(false);
  const queryClient = useQueryClient();

  const { data: templates } = useQuery({
    queryKey: ['marketplace-templates', searchQuery, selectedCategory],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (searchQuery) params.append('search', searchQuery);
      if (selectedCategory && selectedCategory !== 'all') params.append('category', selectedCategory);
      
      const res = await fetch(`/api/template-marketplace/search?${params}`);
      return res.json();
    },
  });

  const { data: featuredTemplates } = useQuery({
    queryKey: ['featured-templates'],
    queryFn: async () => {
      const res = await fetch('/api/template-marketplace/featured');
      return res.json();
    },
  });

  const { data: myPurchases } = useQuery({
    queryKey: ['my-template-purchases'],
    queryFn: async () => {
      const res = await fetch('/api/template-marketplace/purchases');
      return res.json();
    },
    enabled: activeTab === 'my-purchases',
  });

  const { data: sellerStats } = useQuery({
    queryKey: ['seller-stats'],
    queryFn: async () => {
      const res = await fetch('/api/template-marketplace/seller/stats');
      return res.json();
    },
    enabled: activeTab === 'seller-dashboard',
  });

  const purchaseTemplateMutation = useMutation({
    mutationFn: async (templateId: string) => {
      const res = await fetch(`/api/template-marketplace/purchase`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ templateId }),
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-template-purchases'] });
      toast.success('Template purchased successfully!');
      setShowPurchaseDialog(false);
    },
  });

  const publishTemplateMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch('/api/template-marketplace/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['seller-stats'] });
      toast.success('Template published to marketplace!');
      setShowPublishDialog(false);
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold">Template Marketplace</h2>
          <p className="text-muted-foreground">Discover and share professional proposal templates</p>
        </div>
        {activeTab === 'seller-dashboard' && (
          <Button onClick={() => setShowPublishDialog(true)}>
            <Store className="mr-2 h-4 w-4" />
            Publish Template
          </Button>
        )}
      </div>

      <Tabs value={activeTab} onValueChange={(v: any) => setActiveTab(v)}>
        <TabsList>
          <TabsTrigger value="browse">Browse</TabsTrigger>
          <TabsTrigger value="my-purchases">My Purchases</TabsTrigger>
          <TabsTrigger value="seller-dashboard">Seller Dashboard</TabsTrigger>
        </TabsList>

        <TabsContent value="browse" className="space-y-6">
          <div className="flex gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search templates..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {CATEGORIES.map(cat => (
                  <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {featuredTemplates && featuredTemplates.length > 0 && (
            <div>
              <h3 className="text-xl font-semibold mb-4 flex items-center">
                <Award className="mr-2 h-5 w-5 text-yellow-500" />
                Featured Templates
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {featuredTemplates.slice(0, 3).map((template: MarketplaceTemplate) => (
                  <TemplateCard
                    key={template.id}
                    template={template}
                    onClick={() => {
                      setSelectedTemplate(template);
                      setShowPurchaseDialog(true);
                    }}
                    featured
                  />
                ))}
              </div>
            </div>
          )}

          <div>
            <h3 className="text-xl font-semibold mb-4">All Templates</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {templates?.map((template: MarketplaceTemplate) => (
                <TemplateCard
                  key={template.id}
                  template={template}
                  onClick={() => {
                    setSelectedTemplate(template);
                    setShowPurchaseDialog(true);
                  }}
                />
              ))}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="my-purchases" className="space-y-4">
          {myPurchases && myPurchases.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {myPurchases.map((purchase: any) => (
                <Card key={purchase.id} className="hover:shadow-lg transition-shadow cursor-pointer">
                  <CardHeader>
                    <CardTitle className="text-lg line-clamp-1">
                      {purchase.template.name}
                    </CardTitle>
                    <CardDescription className="line-clamp-2">
                      {purchase.template.description}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="text-sm text-muted-foreground">
                        Purchased {new Date(purchase.purchasedAt).toLocaleDateString()}
                      </div>
                      <Button className="w-full" size="sm">
                        Use Template
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <ShoppingCart className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-lg font-medium">No templates purchased yet</p>
                <p className="text-sm text-muted-foreground mb-4">
                  Browse the marketplace to find templates for your proposals
                </p>
                <Button onClick={() => setActiveTab('browse')}>
                  Browse Templates
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="seller-dashboard" className="space-y-6">
          {sellerStats && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-2xl font-bold">{sellerStats.totalSales}</p>
                        <p className="text-sm text-muted-foreground">Total Sales</p>
                      </div>
                      <ShoppingCart className="h-8 w-8 text-muted-foreground" />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-2xl font-bold">${sellerStats.totalRevenue}</p>
                        <p className="text-sm text-muted-foreground">Revenue</p>
                      </div>
                      <DollarSign className="h-8 w-8 text-muted-foreground" />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-2xl font-bold">{sellerStats.avgRating.toFixed(1)}</p>
                        <p className="text-sm text-muted-foreground">Avg Rating</p>
                      </div>
                      <Star className="h-8 w-8 text-yellow-500" />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-2xl font-bold">{sellerStats.publishedTemplates}</p>
                        <p className="text-sm text-muted-foreground">Templates</p>
                      </div>
                      <Store className="h-8 w-8 text-muted-foreground" />
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Your Templates</CardTitle>
                  <CardDescription>Manage your marketplace listings</CardDescription>
                </CardHeader>
                <CardContent>
                  {sellerStats.templates && sellerStats.templates.length > 0 ? (
                    <div className="space-y-4">
                      {sellerStats.templates.map((template: any) => (
                        <div key={template.id} className="flex items-center justify-between p-4 border rounded-lg">
                          <div className="flex-1">
                            <h4 className="font-semibold">{template.name}</h4>
                            <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                              <span className="flex items-center">
                                <Download className="mr-1 h-3 w-3" />
                                {template.downloads} downloads
                              </span>
                              <span className="flex items-center">
                                <Star className="mr-1 h-3 w-3" />
                                {template.rating} ({template.reviewCount} reviews)
                              </span>
                              <span className="flex items-center">
                                <DollarSign className="mr-1 h-3 w-3" />
                                ${template.price}
                              </span>
                            </div>
                          </div>
                          <Badge variant={template.status === 'published' ? 'default' : 'secondary'}>
                            {template.status}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      No templates published yet
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>
      </Tabs>

      {selectedTemplate && (
        <TemplatePurchaseDialog
          template={selectedTemplate}
          open={showPurchaseDialog}
          onOpenChange={setShowPurchaseDialog}
          onPurchase={() => purchaseTemplateMutation.mutate(selectedTemplate.id)}
        />
      )}

      <PublishTemplateDialog
        open={showPublishDialog}
        onOpenChange={setShowPublishDialog}
        onPublish={(data) => publishTemplateMutation.mutate(data)}
      />
    </div>
  );
}

function TemplateCard({ 
  template, 
  onClick, 
  featured 
}: { 
  template: MarketplaceTemplate;
  onClick: () => void;
  featured?: boolean;
}) {
  return (
    <Card 
      className={cn(
        'hover:shadow-lg transition-shadow cursor-pointer',
        featured && 'border-2 border-yellow-400'
      )}
      onClick={onClick}
    >
      {featured && (
        <div className="bg-yellow-400 text-yellow-900 text-xs font-bold px-3 py-1 text-center">
          FEATURED
        </div>
      )}
      
      {template.previewImage && (
        <div className="aspect-video bg-muted relative overflow-hidden">
          <img 
            src={template.previewImage} 
            alt={template.name}
            className="object-cover w-full h-full"
          />
        </div>
      )}

      <CardHeader>
        <CardTitle className="text-lg line-clamp-1">{template.name}</CardTitle>
        <CardDescription className="line-clamp-2">
          {template.description}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1">
            <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
            <span className="font-semibold">{template.rating.toFixed(1)}</span>
            <span className="text-sm text-muted-foreground">
              ({template.reviewCount})
            </span>
          </div>
          <div className="flex items-center text-sm text-muted-foreground">
            <Download className="mr-1 h-3 w-3" />
            {template.downloads}
          </div>
        </div>

        <div className="flex items-center justify-between">
          <Badge variant="outline">{template.category}</Badge>
          {template.priceType === 'free' ? (
            <span className="text-lg font-bold text-green-600">FREE</span>
          ) : (
            <span className="text-lg font-bold">${template.price}</span>
          )}
        </div>

        <div className="text-xs text-muted-foreground">
          by {template.sellerName}
        </div>
      </CardContent>
    </Card>
  );
}

function TemplatePurchaseDialog({ template, open, onOpenChange, onPurchase }: any) {
  const { data: reviews } = useQuery({
    queryKey: ['template-reviews', template.id],
    queryFn: async () => {
      const res = await fetch(`/api/template-marketplace/${template.id}/reviews`);
      return res.json();
    },
    enabled: open,
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{template.name}</DialogTitle>
          <DialogDescription>by {template.sellerName}</DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {template.previewImage && (
            <div className="aspect-video bg-muted rounded-lg overflow-hidden">
              <img 
                src={template.previewImage} 
                alt={template.name}
                className="object-cover w-full h-full"
              />
            </div>
          )}

          <div>
            <h3 className="font-semibold mb-2">Description</h3>
            <p className="text-sm text-muted-foreground">{template.description}</p>
          </div>

          <div className="flex gap-4">
            <div className="flex-1">
              <h4 className="text-sm font-medium mb-1">Rating</h4>
              <div className="flex items-center gap-1">
                <Star className="h-5 w-5 fill-yellow-400 text-yellow-400" />
                <span className="text-lg font-bold">{template.rating.toFixed(1)}</span>
                <span className="text-sm text-muted-foreground">
                  ({template.reviewCount} reviews)
                </span>
              </div>
            </div>
            <div className="flex-1">
              <h4 className="text-sm font-medium mb-1">Downloads</h4>
              <div className="text-lg font-bold">{template.downloads}</div>
            </div>
          </div>

          <div>
            <h3 className="font-semibold mb-3">Reviews</h3>
            <ScrollArea className="h-64">
              <div className="space-y-4">
                {reviews?.map((review: TemplateReview) => (
                  <div key={review.id} className="border-b pb-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium">{review.userName}</span>
                      <div className="flex items-center gap-1">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <Star
                            key={i}
                            className={cn(
                              'h-3 w-3',
                              i < review.rating 
                                ? 'fill-yellow-400 text-yellow-400'
                                : 'text-gray-300'
                            )}
                          />
                        ))}
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground">{review.comment}</p>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>

          <div className="flex items-center justify-between pt-4 border-t">
            <div className="text-2xl font-bold">
              {template.priceType === 'free' ? (
                <span className="text-green-600">FREE</span>
              ) : (
                `$${template.price}`
              )}
            </div>
            <Button size="lg" onClick={onPurchase}>
              {template.priceType === 'free' ? 'Get Template' : 'Purchase Template'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function PublishTemplateDialog({ open, onOpenChange, onPublish }: { open: boolean; onOpenChange: (open: boolean) => void; onPublish: (data: PublishTemplateData) => void }) {
  const [formData, setFormData] = useState<{
    templateId: string;
    name: string;
    description: string;
    category: string;
    priceType: 'free' | 'one_time';
    price: number;
    tags: string;
  }>({
    templateId: '',
    name: '',
    description: '',
    category: '',
    priceType: 'free',
    price: 0,
    tags: '',
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Publish Template to Marketplace</DialogTitle>
          <DialogDescription>
            Share your template with the community
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium">Template Name</label>
            <Input
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Professional Business Proposal"
            />
          </div>

          <div>
            <label className="text-sm font-medium">Description</label>
            <Textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Describe your template..."
              rows={3}
            />
          </div>

          <div>
            <label className="text-sm font-medium">Category</label>
            <Select 
              value={formData.category}
              onValueChange={(value) => setFormData({ ...formData, category: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map(cat => (
                  <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-sm font-medium">Price Type</label>
            <Select 
              value={formData.priceType}
              onValueChange={(value) => setFormData({ ...formData, priceType: value as 'free' | 'one_time' })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="free">Free</SelectItem>
                <SelectItem value="one_time">One-time Purchase</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {formData.priceType !== 'free' && (
            <div>
              <label className="text-sm font-medium">Price ($)</label>
              <Input
                type="number"
                min={0}
                value={formData.price}
                onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) })}
              />
            </div>
          )}

          <div>
            <label className="text-sm font-medium">Tags (comma separated)</label>
            <Input
              value={formData.tags}
              onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
              placeholder="business, professional, modern"
            />
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button 
              onClick={() => {
                onPublish({
                  ...formData,
                  tags: formData.tags.split(',').map(t => t.trim()).filter(Boolean),
                });
              }}
              disabled={!formData.name || !formData.description || !formData.category}
            >
              Publish
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function cn(...classes: any[]) {
  return classes.filter(Boolean).join(' ');
}
