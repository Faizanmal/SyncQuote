'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Slider } from '@/components/ui/slider';
import { useToast } from '@/components/ui/use-toast';
import {
  Sparkles,
  TrendingUp,
  DollarSign,
  Package,
  ShoppingCart,
  Plus,
  ArrowRight,
  Target,
  Zap,
  Gift,
  BarChart2,
  Eye,
  Check,
  X,
  RefreshCw,
  Settings,
  Lightbulb,
  ChevronRight,
  Star,
  Clock,
  ThumbsUp,
  ThumbsDown,
} from 'lucide-react';

interface UpsellRecommendation {
  id: string;
  type: 'upsell' | 'cross_sell' | 'bundle';
  title: string;
  description: string;
  originalPrice: number;
  recommendedPrice: number;
  discount?: number;
  confidence: number;
  reasoning: string;
  potentialRevenue: number;
  relatedProducts: string[];
  status: 'pending' | 'accepted' | 'rejected';
  createdAt: string;
}

interface BundleSuggestion {
  id: string;
  name: string;
  items: BundleItem[];
  originalTotal: number;
  bundlePrice: number;
  savings: number;
  conversionProbability: number;
}

interface BundleItem {
  id: string;
  name: string;
  price: number;
  category: string;
}

interface PricingOptimization {
  id: string;
  itemId: string;
  itemName: string;
  currentPrice: number;
  optimalPrice: number;
  priceElasticity: number;
  revenueImpact: number;
  demandForecast: number;
}

interface UpsellMetrics {
  totalRecommendations: number;
  acceptedRecommendations: number;
  acceptanceRate: number;
  totalRevenueGenerated: number;
  averageOrderValueIncrease: number;
  conversionRateImprovement: number;
}

interface UpsellSettings {
  enabled: boolean;
  maxRecommendations: number;
  minConfidence: number;
  showPricing: boolean;
  autoApply: boolean;
  triggerPoints: string[];
}

export function UpsellIntelligencePanel({ proposalId }: { proposalId?: string }) {
  const [recommendations, setRecommendations] = useState<UpsellRecommendation[]>([]);
  const [bundles, setBundles] = useState<BundleSuggestion[]>([]);
  const [pricingOptimizations, setPricingOptimizations] = useState<PricingOptimization[]>([]);
  const [metrics, setMetrics] = useState<UpsellMetrics | null>(null);
  const [settings, setSettings] = useState<UpsellSettings>({
    enabled: true,
    maxRecommendations: 3,
    minConfidence: 0.7,
    showPricing: true,
    autoApply: false,
    triggerPoints: ['cart', 'checkout', 'confirmation'],
  });
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchRecommendations();
    fetchBundles();
    fetchPricingOptimizations();
    fetchMetrics();
  }, [proposalId]);

  const fetchRecommendations = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/upsell/recommendations${proposalId ? `?proposalId=${proposalId}` : ''}`);
      const data = await response.json();
      setRecommendations(data.recommendations || []);
    } catch (error) {
      console.error('Failed to fetch recommendations:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchBundles = async () => {
    try {
      const response = await fetch(`/api/upsell/bundles${proposalId ? `?proposalId=${proposalId}` : ''}`);
      const data = await response.json();
      setBundles(data.bundles || []);
    } catch (error) {
      console.error('Failed to fetch bundles:', error);
    }
  };

  const fetchPricingOptimizations = async () => {
    try {
      const response = await fetch(`/api/upsell/pricing-optimization${proposalId ? `?proposalId=${proposalId}` : ''}`);
      const data = await response.json();
      setPricingOptimizations(data.optimizations || []);
    } catch (error) {
      console.error('Failed to fetch pricing optimizations:', error);
    }
  };

  const fetchMetrics = async () => {
    try {
      const response = await fetch('/api/upsell/metrics');
      const data = await response.json();
      setMetrics(data.metrics);
    } catch (error) {
      console.error('Failed to fetch metrics:', error);
    }
  };

  const generateRecommendations = async () => {
    try {
      setGenerating(true);
      const response = await fetch('/api/upsell/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ proposalId }),
      });
      const data = await response.json();
      setRecommendations(data.recommendations || []);
      toast({
        title: 'Recommendations generated',
        description: `${data.recommendations?.length || 0} new recommendations created`,
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to generate recommendations',
        variant: 'destructive',
      });
    } finally {
      setGenerating(false);
    }
  };

  const updateRecommendationStatus = async (id: string, status: 'accepted' | 'rejected') => {
    try {
      await fetch(`/api/upsell/recommendations/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      setRecommendations(prev => prev.map(r => (r.id === id ? { ...r, status } : r)));
      toast({
        title: status === 'accepted' ? 'Recommendation accepted' : 'Recommendation rejected',
        description: status === 'accepted' ? 'The upsell will be shown to the client' : 'This recommendation won\'t be shown',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to update recommendation',
        variant: 'destructive',
      });
    }
  };

  const applyPricingOptimization = async (id: string) => {
    try {
      await fetch(`/api/upsell/pricing-optimization/${id}/apply`, { method: 'POST' });
      fetchPricingOptimizations();
      toast({
        title: 'Price updated',
        description: 'The optimized price has been applied',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to apply price optimization',
        variant: 'destructive',
      });
    }
  };

  const updateSettings = async (newSettings: Partial<UpsellSettings>) => {
    try {
      const updated = { ...settings, ...newSettings };
      await fetch('/api/upsell/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated),
      });
      setSettings(updated);
      toast({
        title: 'Settings updated',
        description: 'Upsell settings have been saved',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to update settings',
        variant: 'destructive',
      });
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'upsell':
        return <TrendingUp className="w-4 h-4" />;
      case 'cross_sell':
        return <ShoppingCart className="w-4 h-4" />;
      case 'bundle':
        return <Package className="w-4 h-4" />;
      default:
        return <Sparkles className="w-4 h-4" />;
    }
  };

  const getTypeBadge = (type: string) => {
    const colors: Record<string, string> = {
      upsell: 'bg-purple-500',
      cross_sell: 'bg-blue-500',
      bundle: 'bg-green-500',
    };
    return (
      <Badge className={colors[type] || 'bg-gray-500'}>
        {getTypeIcon(type)}
        <span className="ml-1 capitalize">{type.replace('_', ' ')}</span>
      </Badge>
    );
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'accepted':
        return <Badge className="bg-green-500"><Check className="w-3 h-3 mr-1" /> Accepted</Badge>;
      case 'rejected':
        return <Badge variant="outline"><X className="w-3 h-3 mr-1" /> Rejected</Badge>;
      default:
        return <Badge variant="secondary"><Clock className="w-3 h-3 mr-1" /> Pending</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Upsell Intelligence</h2>
          <p className="text-muted-foreground">AI-powered recommendations to increase deal value</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchRecommendations}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
          <Button onClick={generateRecommendations} disabled={generating}>
            {generating ? (
              <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Sparkles className="w-4 h-4 mr-2" />
            )}
            Generate Recommendations
          </Button>
        </div>
      </div>

      {/* Metrics Overview */}
      {metrics && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-muted-foreground mb-2">
                <Target className="w-4 h-4" />
                <span className="text-sm">Acceptance Rate</span>
              </div>
              <p className="text-2xl font-bold">{(metrics.acceptanceRate * 100).toFixed(0)}%</p>
              <p className="text-sm text-muted-foreground">
                {metrics.acceptedRecommendations} / {metrics.totalRecommendations} accepted
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-muted-foreground mb-2">
                <DollarSign className="w-4 h-4" />
                <span className="text-sm">Revenue Generated</span>
              </div>
              <p className="text-2xl font-bold">${metrics.totalRevenueGenerated.toLocaleString()}</p>
              <p className="text-sm text-green-500">From upsells</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-muted-foreground mb-2">
                <TrendingUp className="w-4 h-4" />
                <span className="text-sm">AOV Increase</span>
              </div>
              <p className="text-2xl font-bold">+${metrics.averageOrderValueIncrease.toFixed(0)}</p>
              <p className="text-sm text-muted-foreground">Per proposal</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-muted-foreground mb-2">
                <Zap className="w-4 h-4" />
                <span className="text-sm">Conversion Improvement</span>
              </div>
              <p className="text-2xl font-bold">+{(metrics.conversionRateImprovement * 100).toFixed(1)}%</p>
              <p className="text-sm text-muted-foreground">When upsells shown</p>
            </CardContent>
          </Card>
        </div>
      )}

      <Tabs defaultValue="recommendations">
        <TabsList>
          <TabsTrigger value="recommendations">
            <Sparkles className="w-4 h-4 mr-2" />
            Recommendations
          </TabsTrigger>
          <TabsTrigger value="bundles">
            <Package className="w-4 h-4 mr-2" />
            Bundle Suggestions
          </TabsTrigger>
          <TabsTrigger value="pricing">
            <DollarSign className="w-4 h-4 mr-2" />
            Pricing Optimization
          </TabsTrigger>
          <TabsTrigger value="settings">
            <Settings className="w-4 h-4 mr-2" />
            Settings
          </TabsTrigger>
        </TabsList>

        <TabsContent value="recommendations" className="mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {recommendations.map((rec) => (
              <Card key={rec.id} className={rec.status === 'rejected' ? 'opacity-60' : ''}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      {getTypeBadge(rec.type)}
                      <CardTitle className="text-lg mt-2">{rec.title}</CardTitle>
                      <CardDescription>{rec.description}</CardDescription>
                    </div>
                    {getStatusBadge(rec.status)}
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-3 bg-muted rounded-lg">
                      <p className="text-sm text-muted-foreground">Original Price</p>
                      <p className="text-lg font-bold">${rec.originalPrice.toLocaleString()}</p>
                    </div>
                    <div className="p-3 bg-green-50 dark:bg-green-950/20 rounded-lg">
                      <p className="text-sm text-muted-foreground">Recommended</p>
                      <p className="text-lg font-bold text-green-600">${rec.recommendedPrice.toLocaleString()}</p>
                      {rec.discount && (
                        <Badge variant="outline" className="text-xs mt-1">
                          {rec.discount}% off
                        </Badge>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">AI Confidence</span>
                      <span className="font-medium">{(rec.confidence * 100).toFixed(0)}%</span>
                    </div>
                    <Progress value={rec.confidence * 100} />
                  </div>

                  <div className="p-3 bg-muted/50 rounded-lg">
                    <div className="flex items-start gap-2">
                      <Lightbulb className="w-4 h-4 text-yellow-500 mt-0.5" />
                      <p className="text-sm text-muted-foreground">{rec.reasoning}</p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Potential Revenue</span>
                    <span className="font-medium text-green-600">+${rec.potentialRevenue.toLocaleString()}</span>
                  </div>
                </CardContent>
                {rec.status === 'pending' && (
                  <CardFooter className="border-t pt-4 gap-2">
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={() => updateRecommendationStatus(rec.id, 'rejected')}
                    >
                      <ThumbsDown className="w-4 h-4 mr-2" />
                      Reject
                    </Button>
                    <Button
                      className="flex-1"
                      onClick={() => updateRecommendationStatus(rec.id, 'accepted')}
                    >
                      <ThumbsUp className="w-4 h-4 mr-2" />
                      Accept
                    </Button>
                  </CardFooter>
                )}
              </Card>
            ))}

            {recommendations.length === 0 && !loading && (
              <Card className="col-span-2 border-dashed">
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <Sparkles className="w-12 h-12 text-muted-foreground mb-4" />
                  <h3 className="font-medium mb-2">No Recommendations Yet</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Generate AI-powered upsell recommendations for your proposal
                  </p>
                  <Button onClick={generateRecommendations}>
                    <Sparkles className="w-4 h-4 mr-2" />
                    Generate Recommendations
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="bundles" className="mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {bundles.map((bundle) => (
              <Card key={bundle.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <Badge className="bg-green-500 mb-2">
                        <Gift className="w-3 h-3 mr-1" />
                        Bundle Deal
                      </Badge>
                      <CardTitle>{bundle.name}</CardTitle>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-muted-foreground line-through">
                        ${bundle.originalTotal.toLocaleString()}
                      </p>
                      <p className="text-xl font-bold text-green-600">
                        ${bundle.bundlePrice.toLocaleString()}
                      </p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    {bundle.items.map((item, index) => (
                      <div key={item.id} className="flex items-center justify-between p-2 bg-muted rounded">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-medium">
                            {index + 1}
                          </div>
                          <div>
                            <p className="font-medium text-sm">{item.name}</p>
                            <p className="text-xs text-muted-foreground">{item.category}</p>
                          </div>
                        </div>
                        <span className="text-sm">${item.price.toLocaleString()}</span>
                      </div>
                    ))}
                  </div>

                  <div className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-950/20 rounded-lg">
                    <div className="flex items-center gap-2">
                      <Star className="w-4 h-4 text-yellow-500" />
                      <span className="font-medium">You save</span>
                    </div>
                    <span className="text-lg font-bold text-green-600">${bundle.savings.toLocaleString()}</span>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Conversion Probability</span>
                      <span className="font-medium">{(bundle.conversionProbability * 100).toFixed(0)}%</span>
                    </div>
                    <Progress value={bundle.conversionProbability * 100} />
                  </div>
                </CardContent>
                <CardFooter className="border-t pt-4">
                  <Button className="w-full">
                    <Plus className="w-4 h-4 mr-2" />
                    Add Bundle to Proposal
                  </Button>
                </CardFooter>
              </Card>
            ))}

            {bundles.length === 0 && (
              <Card className="col-span-2 border-dashed">
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <Package className="w-12 h-12 text-muted-foreground mb-4" />
                  <h3 className="font-medium mb-2">No Bundle Suggestions</h3>
                  <p className="text-sm text-muted-foreground">
                    Add more items to your proposal to get bundle recommendations
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="pricing" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Pricing Optimization</CardTitle>
              <CardDescription>AI-suggested price adjustments based on market analysis</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Item</TableHead>
                    <TableHead className="text-right">Current Price</TableHead>
                    <TableHead className="text-right">Optimal Price</TableHead>
                    <TableHead className="text-right">Elasticity</TableHead>
                    <TableHead className="text-right">Revenue Impact</TableHead>
                    <TableHead className="w-[100px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pricingOptimizations.map((opt) => {
                    const priceChange = opt.optimalPrice - opt.currentPrice;
                    const percentChange = (priceChange / opt.currentPrice) * 100;
                    return (
                      <TableRow key={opt.id}>
                        <TableCell className="font-medium">{opt.itemName}</TableCell>
                        <TableCell className="text-right">${opt.currentPrice.toLocaleString()}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <span className={priceChange >= 0 ? 'text-green-600' : 'text-red-600'}>
                              ${opt.optimalPrice.toLocaleString()}
                            </span>
                            <Badge variant="outline" className="text-xs">
                              {priceChange >= 0 ? '+' : ''}{percentChange.toFixed(0)}%
                            </Badge>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Progress value={(opt.priceElasticity + 1) * 50} className="w-16 h-2" />
                            <span className="text-sm">{opt.priceElasticity.toFixed(2)}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <span className={opt.revenueImpact >= 0 ? 'text-green-600' : 'text-red-600'}>
                            {opt.revenueImpact >= 0 ? '+' : ''}${Math.abs(opt.revenueImpact).toLocaleString()}
                          </span>
                        </TableCell>
                        <TableCell>
                          <Button size="sm" onClick={() => applyPricingOptimization(opt.id)}>
                            Apply
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {pricingOptimizations.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground py-12">
                        No pricing optimizations available
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Upsell Settings</CardTitle>
              <CardDescription>Configure how upsell recommendations are generated and displayed</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <Label>Enable Upsell Intelligence</Label>
                  <p className="text-sm text-muted-foreground">Show AI recommendations on proposals</p>
                </div>
                <Switch
                  checked={settings.enabled}
                  onCheckedChange={(checked) => updateSettings({ enabled: checked })}
                />
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Maximum Recommendations</Label>
                    <span className="font-medium">{settings.maxRecommendations}</span>
                  </div>
                  <Slider
                    value={[settings.maxRecommendations]}
                    onValueChange={([value]) => updateSettings({ maxRecommendations: value })}
                    min={1}
                    max={10}
                    step={1}
                  />
                  <p className="text-sm text-muted-foreground">
                    Number of recommendations to show per proposal
                  </p>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Minimum Confidence</Label>
                    <span className="font-medium">{(settings.minConfidence * 100).toFixed(0)}%</span>
                  </div>
                  <Slider
                    value={[settings.minConfidence * 100]}
                    onValueChange={([value]) => updateSettings({ minConfidence: value / 100 })}
                    min={50}
                    max={100}
                    step={5}
                  />
                  <p className="text-sm text-muted-foreground">
                    Only show recommendations above this confidence level
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <Label>Show Pricing to Client</Label>
                  <p className="text-sm text-muted-foreground">Display original and discounted prices</p>
                </div>
                <Switch
                  checked={settings.showPricing}
                  onCheckedChange={(checked) => updateSettings({ showPricing: checked })}
                />
              </div>

              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <Label>Auto-apply High-confidence Recommendations</Label>
                  <p className="text-sm text-muted-foreground">
                    Automatically add recommendations above 90% confidence
                  </p>
                </div>
                <Switch
                  checked={settings.autoApply}
                  onCheckedChange={(checked) => updateSettings({ autoApply: checked })}
                />
              </div>

              <div className="space-y-2">
                <Label>Trigger Points</Label>
                <div className="grid grid-cols-3 gap-2">
                  {['cart', 'checkout', 'confirmation', 'email', 'reminder'].map((point) => (
                    <Button
                      key={point}
                      variant={settings.triggerPoints.includes(point) ? 'default' : 'outline'}
                      size="sm"
                      className="capitalize"
                      onClick={() => {
                        const newTriggers = settings.triggerPoints.includes(point)
                          ? settings.triggerPoints.filter(t => t !== point)
                          : [...settings.triggerPoints, point];
                        updateSettings({ triggerPoints: newTriggers });
                      }}
                    >
                      {point}
                    </Button>
                  ))}
                </div>
                <p className="text-sm text-muted-foreground">
                  When to show upsell recommendations to clients
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
