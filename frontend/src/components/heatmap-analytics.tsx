'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Slider } from '@/components/ui/slider';
import { useToast } from '@/components/ui/use-toast';
import {
  MousePointer2,
  ScrollText,
  Activity,
  Eye,
  Clock,
  TrendingUp,
  TrendingDown,
  Target,
  MapPin,
  Layers,
  RefreshCw,
  Download,
  Filter,
  Calendar,
  Users,
  Sparkles,
  AlertTriangle,
  ChevronRight,
  Zap,
} from 'lucide-react';

interface HeatmapData {
  proposalId: string;
  clicks: ClickData[];
  scrollDepth: ScrollData[];
  engagement: EngagementData;
  predictiveScore: PredictiveScore;
}

interface ClickData {
  x: number;
  y: number;
  elementId?: string;
  elementType?: string;
  count: number;
  timestamp?: string;
}

interface ScrollData {
  depth: number;
  timeSpent: number;
  dropoffRate: number;
}

interface EngagementData {
  averageTimeOnPage: number;
  bounceRate: number;
  scrollCompletionRate: number;
  interactionRate: number;
  hotspots: Hotspot[];
}

interface Hotspot {
  id: string;
  elementId: string;
  elementType: string;
  clickCount: number;
  hoverTime: number;
  isHighEngagement: boolean;
}

interface PredictiveScore {
  overallScore: number;
  conversionProbability: number;
  engagementLevel: 'low' | 'medium' | 'high';
  recommendations: string[];
  riskFactors: string[];
}

interface ProposalView {
  id: string;
  viewerEmail?: string;
  viewedAt: string;
  duration: number;
  scrollDepth: number;
  clickCount: number;
  engagementScore: number;
}

export function HeatmapAnalytics({ proposalId }: { proposalId?: string }) {
  const [heatmapData, setHeatmapData] = useState<HeatmapData | null>(null);
  const [views, setViews] = useState<ProposalView[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedView, setSelectedView] = useState<'clicks' | 'scroll' | 'attention'>('clicks');
  const [dateRange, setDateRange] = useState<'7d' | '30d' | '90d'>('7d');
  const [opacity, setOpacity] = useState(70);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetchHeatmapData();
    fetchViews();
  }, [proposalId, dateRange]);

  useEffect(() => {
    if (heatmapData && canvasRef.current) {
      renderHeatmap();
    }
  }, [heatmapData, selectedView, opacity]);

  const fetchHeatmapData = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/heatmaps/${proposalId}?range=${dateRange}`);
      const data = await response.json();
      setHeatmapData(data);
    } catch (error) {
      console.error('Failed to fetch heatmap data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchViews = async () => {
    try {
      const response = await fetch(`/api/heatmaps/${proposalId}/views?range=${dateRange}`);
      const data = await response.json();
      setViews(data.views || []);
    } catch (error) {
      console.error('Failed to fetch views:', error);
    }
  };

  const renderHeatmap = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !heatmapData) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (selectedView === 'clicks') {
      // Render click heatmap
      heatmapData.clicks.forEach((click) => {
        const gradient = ctx.createRadialGradient(
          click.x, click.y, 0,
          click.x, click.y, 30 + click.count * 5
        );
        gradient.addColorStop(0, `rgba(255, 0, 0, ${opacity / 100})`);
        gradient.addColorStop(0.5, `rgba(255, 165, 0, ${(opacity / 100) * 0.5})`);
        gradient.addColorStop(1, 'rgba(255, 255, 0, 0)');

        ctx.beginPath();
        ctx.fillStyle = gradient;
        ctx.arc(click.x, click.y, 30 + click.count * 5, 0, Math.PI * 2);
        ctx.fill();
      });
    } else if (selectedView === 'scroll') {
      // Render scroll depth visualization
      const height = canvas.height;
      heatmapData.scrollDepth.forEach((scroll, index) => {
        const y = (scroll.depth / 100) * height;
        const nextY = index < heatmapData.scrollDepth.length - 1
          ? (heatmapData.scrollDepth[index + 1].depth / 100) * height
          : height;

        const alpha = (1 - scroll.dropoffRate) * (opacity / 100);
        ctx.fillStyle = `rgba(59, 130, 246, ${alpha})`;
        ctx.fillRect(0, y, canvas.width, nextY - y);
      });
    } else if (selectedView === 'attention') {
      // Render attention zones
      heatmapData.engagement.hotspots.forEach((hotspot) => {
        // Placeholder coordinates - would be actual element positions
        const x = Math.random() * canvas.width;
        const y = Math.random() * canvas.height;

        const gradient = ctx.createRadialGradient(x, y, 0, x, y, 50);
        const color = hotspot.isHighEngagement ? '147, 51, 234' : '59, 130, 246';
        gradient.addColorStop(0, `rgba(${color}, ${opacity / 100})`);
        gradient.addColorStop(1, `rgba(${color}, 0)`);

        ctx.beginPath();
        ctx.fillStyle = gradient;
        ctx.arc(x, y, 50, 0, Math.PI * 2);
        ctx.fill();
      });
    }
  }, [heatmapData, selectedView, opacity]);

  const exportHeatmap = async () => {
    try {
      const response = await fetch(`/api/heatmaps/${proposalId}/export`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ range: dateRange }),
      });
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `heatmap-${proposalId}-${dateRange}.png`;
      a.click();
      toast({
        title: 'Exported',
        description: 'Heatmap has been downloaded',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to export heatmap',
        variant: 'destructive',
      });
    }
  };

  const getEngagementBadge = (level: string) => {
    switch (level) {
      case 'high':
        return <Badge className="bg-green-500"><TrendingUp className="w-3 h-3 mr-1" /> High</Badge>;
      case 'medium':
        return <Badge className="bg-yellow-500"><Activity className="w-3 h-3 mr-1" /> Medium</Badge>;
      case 'low':
        return <Badge className="bg-red-500"><TrendingDown className="w-3 h-3 mr-1" /> Low</Badge>;
      default:
        return null;
    }
  };

  const formatDuration = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Heatmap Analytics</h2>
          <p className="text-muted-foreground">Visualize how viewers interact with your proposal</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={dateRange} onValueChange={(v: '7d' | '30d' | '90d') => setDateRange(v)}>
            <SelectTrigger className="w-[140px]">
              <Calendar className="w-4 h-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
              <SelectItem value="90d">Last 90 days</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={exportHeatmap}>
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Metrics Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-2">
              <Eye className="w-4 h-4" />
              <span className="text-sm">Total Views</span>
            </div>
            <p className="text-2xl font-bold">{views.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-2">
              <Clock className="w-4 h-4" />
              <span className="text-sm">Avg. Time on Page</span>
            </div>
            <p className="text-2xl font-bold">
              {formatDuration(heatmapData?.engagement.averageTimeOnPage || 0)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-2">
              <ScrollText className="w-4 h-4" />
              <span className="text-sm">Scroll Completion</span>
            </div>
            <p className="text-2xl font-bold">
              {Math.round((heatmapData?.engagement.scrollCompletionRate || 0) * 100)}%
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-2">
              <Target className="w-4 h-4" />
              <span className="text-sm">Predictive Score</span>
            </div>
            <p className="text-2xl font-bold flex items-center gap-2">
              {Math.round((heatmapData?.predictiveScore.overallScore || 0) * 100)}
              {heatmapData?.predictiveScore && getEngagementBadge(heatmapData.predictiveScore.engagementLevel)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Heatmap Area */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Heatmap Visualization</CardTitle>
                  <CardDescription>Click, scroll, and attention data</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant={selectedView === 'clicks' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setSelectedView('clicks')}
                  >
                    <MousePointer2 className="w-4 h-4 mr-1" />
                    Clicks
                  </Button>
                  <Button
                    variant={selectedView === 'scroll' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setSelectedView('scroll')}
                  >
                    <ScrollText className="w-4 h-4 mr-1" />
                    Scroll
                  </Button>
                  <Button
                    variant={selectedView === 'attention' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setSelectedView('attention')}
                  >
                    <Activity className="w-4 h-4 mr-1" />
                    Attention
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="relative bg-muted rounded-lg overflow-hidden" style={{ aspectRatio: '16/10' }}>
                {/* Proposal preview placeholder */}
                <div className="absolute inset-0 bg-white dark:bg-gray-900 p-4">
                  <div className="space-y-4">
                    <div className="h-8 bg-muted rounded w-1/3" />
                    <div className="h-4 bg-muted rounded w-2/3" />
                    <div className="h-4 bg-muted rounded w-1/2" />
                    <div className="h-32 bg-muted rounded mt-8" />
                    <div className="grid grid-cols-3 gap-4 mt-8">
                      <div className="h-20 bg-muted rounded" />
                      <div className="h-20 bg-muted rounded" />
                      <div className="h-20 bg-muted rounded" />
                    </div>
                    <div className="h-24 bg-muted rounded mt-8" />
                  </div>
                </div>
                {/* Heatmap overlay */}
                <canvas
                  ref={canvasRef}
                  className="absolute inset-0 w-full h-full pointer-events-none"
                  width={800}
                  height={500}
                />
              </div>
              <div className="flex items-center gap-4 mt-4">
                <Label className="text-sm">Opacity</Label>
                <Slider
                  value={[opacity]}
                  onValueChange={([value]) => setOpacity(value)}
                  max={100}
                  step={5}
                  className="w-32"
                />
                <span className="text-sm text-muted-foreground">{opacity}%</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Predictive Score */}
          {heatmapData?.predictiveScore && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-purple-500" />
                  Predictive Insights
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-muted-foreground">Conversion Probability</span>
                    <span className="font-bold">
                      {Math.round(heatmapData.predictiveScore.conversionProbability * 100)}%
                    </span>
                  </div>
                  <Progress value={heatmapData.predictiveScore.conversionProbability * 100} />
                </div>

                {heatmapData.predictiveScore.recommendations.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium flex items-center gap-2">
                      <Zap className="w-4 h-4 text-yellow-500" />
                      Recommendations
                    </h4>
                    <ul className="space-y-1">
                      {heatmapData.predictiveScore.recommendations.map((rec, index) => (
                        <li key={index} className="text-sm text-muted-foreground flex items-start gap-2">
                          <ChevronRight className="w-4 h-4 mt-0.5 flex-shrink-0" />
                          {rec}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {heatmapData.predictiveScore.riskFactors.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-orange-500" />
                      Risk Factors
                    </h4>
                    <ul className="space-y-1">
                      {heatmapData.predictiveScore.riskFactors.map((risk, index) => (
                        <li key={index} className="text-sm text-muted-foreground flex items-start gap-2">
                          <ChevronRight className="w-4 h-4 mt-0.5 flex-shrink-0" />
                          {risk}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Hotspots */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Top Hotspots</CardTitle>
              <CardDescription>Most engaged elements</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[200px]">
                <div className="space-y-3">
                  {heatmapData?.engagement.hotspots.slice(0, 5).map((hotspot, index) => (
                    <div key={hotspot.id} className="flex items-center gap-3 pb-3 border-b last:border-0">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                        hotspot.isHighEngagement ? 'bg-purple-100 text-purple-600' : 'bg-blue-100 text-blue-600'
                      }`}>
                        {index + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{hotspot.elementType}</p>
                        <p className="text-sm text-muted-foreground">
                          {hotspot.clickCount} clicks • {formatDuration(hotspot.hoverTime)} hover
                        </p>
                      </div>
                      {hotspot.isHighEngagement && (
                        <Badge variant="outline" className="text-xs">Hot</Badge>
                      )}
                    </div>
                  ))}
                  {(!heatmapData?.engagement.hotspots || heatmapData.engagement.hotspots.length === 0) && (
                    <div className="text-center text-muted-foreground py-8">
                      No hotspots detected yet
                    </div>
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>

          {/* Scroll Depth */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Scroll Depth</CardTitle>
              <CardDescription>Where viewers stop scrolling</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {[25, 50, 75, 100].map((depth) => {
                  const scrollData = heatmapData?.scrollDepth.find(s => s.depth === depth);
                  const retention = scrollData ? (1 - scrollData.dropoffRate) * 100 : 0;
                  return (
                    <div key={depth} className="flex items-center gap-3">
                      <span className="text-sm w-12">{depth}%</span>
                      <Progress value={retention} className="flex-1 h-2" />
                      <span className="text-sm text-muted-foreground w-12 text-right">
                        {Math.round(retention)}%
                      </span>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Recent Views */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Views</CardTitle>
          <CardDescription>Individual viewer engagement data</CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[300px]">
            <div className="space-y-4">
              {views.map((view) => (
                <div key={view.id} className="flex items-center gap-4 pb-4 border-b last:border-0">
                  <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                    <Users className="w-5 h-5 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">
                      {view.viewerEmail || 'Anonymous Viewer'}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {new Date(view.viewedAt).toLocaleString()}
                    </p>
                  </div>
                  <div className="text-right space-y-1">
                    <div className="flex items-center gap-4 text-sm">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" /> {formatDuration(view.duration)}
                      </span>
                      <span className="flex items-center gap-1">
                        <ScrollText className="w-3 h-3" /> {view.scrollDepth}%
                      </span>
                      <span className="flex items-center gap-1">
                        <MousePointer2 className="w-3 h-3" /> {view.clickCount}
                      </span>
                    </div>
                    <div className="flex items-center justify-end gap-2">
                      <span className="text-xs text-muted-foreground">Engagement:</span>
                      <Progress value={view.engagementScore * 100} className="w-20 h-2" />
                    </div>
                  </div>
                </div>
              ))}
              {views.length === 0 && (
                <div className="text-center text-muted-foreground py-8">
                  No views recorded yet
                </div>
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
