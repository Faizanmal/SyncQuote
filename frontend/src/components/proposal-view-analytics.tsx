'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Eye,
  Clock,
  MapPin,
  Monitor,
  Smartphone,
  Tablet,
  MousePointer,
  TrendingUp,
  Users,
} from 'lucide-react';
import { useApi } from '@/hooks/use-api';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
} from 'recharts';

interface ViewAnalytics {
  totalSessions: number;
  uniqueVisitors: number;
  averageDuration: number;
  averageScrollDepth: number;
  topSections: {
    sectionType: string;
    totalDuration: number;
    averageDuration: number;
    viewCount: number;
  }[];
  viewsByDevice: { device: string; count: number }[];
  viewsByLocation: { country: string; count: number }[];
  viewTimeline: { date: string; views: number }[];
}

interface SectionHeatmap {
  sectionType: string;
  sectionIndex: number;
  totalDuration: number;
  avgDuration: number;
  avgScrollDepth: number;
  interactionCount: number;
  viewCount: number;
}

interface RecentViewer {
  id: string;
  viewerEmail?: string;
  viewerName?: string;
  viewerCompany?: string;
  device?: string;
  country?: string;
  city?: string;
  totalDuration: number;
  scrollDepth: number;
  startedAt: string;
  endedAt?: string;
}

interface ProposalViewAnalyticsProps {
  proposalId: string;
}

const COLORS = ['#6366f1', '#8b5cf6', '#a855f7', '#d946ef', '#ec4899'];

const deviceIcons = {
  desktop: Monitor,
  mobile: Smartphone,
  tablet: Tablet,
  unknown: Monitor,
};

export function ProposalViewAnalytics({ proposalId }: ProposalViewAnalyticsProps) {
  const [analytics, setAnalytics] = useState<ViewAnalytics | null>(null);
  const [heatmap, setHeatmap] = useState<SectionHeatmap[]>([]);
  const [recentViewers, setRecentViewers] = useState<RecentViewer[]>([]);
  const [loading, setLoading] = useState(true);
  const api = useApi();

  useEffect(() => {
    fetchData();
  }, [proposalId]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [analyticsRes, heatmapRes, viewersRes] = await Promise.all([
        api.get(`/view-analytics/proposal/${proposalId}`),
        api.get(`/view-analytics/proposal/${proposalId}/heatmap`),
        api.get(`/view-analytics/proposal/${proposalId}/viewers?limit=10`),
      ]);
      
      setAnalytics(analyticsRes.data);
      setHeatmap(heatmapRes.data);
      setRecentViewers(viewersRes.data);
    } catch (error) {
      console.error('Failed to fetch view analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDuration = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!analytics) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center p-8">
          <p className="text-muted-foreground">No viewing data available yet.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Overview Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Views</CardTitle>
            <Eye className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.totalSessions}</div>
            <p className="text-xs text-muted-foreground">
              {analytics.uniqueVisitors} unique visitors
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg. Time Spent</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatDuration(analytics.averageDuration)}</div>
            <p className="text-xs text-muted-foreground">Per viewing session</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Scroll Depth</CardTitle>
            <MousePointer className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.averageScrollDepth.toFixed(0)}%</div>
            <Progress value={analytics.averageScrollDepth} className="mt-2" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Engagement</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {analytics.topSections.reduce((sum, s) => sum + s.viewCount, 0)}
            </div>
            <p className="text-xs text-muted-foreground">Section interactions</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="timeline" className="space-y-4">
        <TabsList>
          <TabsTrigger value="timeline">View Timeline</TabsTrigger>
          <TabsTrigger value="heatmap">Content Heatmap</TabsTrigger>
          <TabsTrigger value="devices">Devices & Location</TabsTrigger>
          <TabsTrigger value="viewers">Recent Viewers</TabsTrigger>
        </TabsList>

        <TabsContent value="timeline" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Views Over Time</CardTitle>
              <CardDescription>Daily view count for the last 30 days</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={analytics.viewTimeline}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Area
                      type="monotone"
                      dataKey="views"
                      stroke="#6366f1"
                      fill="#6366f1"
                      fillOpacity={0.2}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="heatmap" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Content Engagement Heatmap</CardTitle>
              <CardDescription>See which sections get the most attention</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {heatmap.map((section, index) => {
                  const maxDuration = Math.max(...heatmap.map(h => h.totalDuration));
                  const intensity = section.totalDuration / maxDuration;
                  
                  return (
                    <div key={index} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-medium capitalize">
                          {section.sectionType.replace(/_/g, ' ')}
                        </span>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <span>{formatDuration(section.avgDuration)} avg</span>
                          <span>{section.viewCount} views</span>
                          <span>{section.interactionCount} clicks</span>
                        </div>
                      </div>
                      <div
                        className="h-8 rounded-md transition-all"
                        style={{
                          background: `linear-gradient(90deg, rgba(99, 102, 241, ${0.2 + intensity * 0.6}) 0%, rgba(99, 102, 241, ${0.1 + intensity * 0.3}) 100%)`,
                          width: `${section.avgScrollDepth}%`,
                        }}
                      />
                      <Progress 
                        value={section.avgScrollDepth} 
                        className="h-1"
                      />
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Time Spent by Section</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={analytics.topSections} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" tick={{ fontSize: 12 }} />
                    <YAxis 
                      type="category" 
                      dataKey="sectionType" 
                      tick={{ fontSize: 12 }}
                      width={100}
                    />
                    <Tooltip 
                      formatter={(value: number) => formatDuration(value)}
                    />
                    <Bar dataKey="averageDuration" fill="#6366f1" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="devices" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Device Breakdown</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[250px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={analytics.viewsByDevice}
                        dataKey="count"
                        nameKey="device"
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        label={({ device, count }) => `${device}: ${count}`}
                      >
                        {analytics.viewsByDevice.map((entry, index) => (
                          <Cell key={entry.device} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-4 space-y-2">
                  {analytics.viewsByDevice.map((device, index) => {
                    const Icon = deviceIcons[device.device as keyof typeof deviceIcons] || Monitor;
                    return (
                      <div key={device.device} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Icon className="h-4 w-4" style={{ color: COLORS[index % COLORS.length] }} />
                          <span className="capitalize">{device.device}</span>
                        </div>
                        <span className="font-medium">{device.count}</span>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Top Locations</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {analytics.viewsByLocation.slice(0, 5).map((location, index) => (
                    <div key={location.country} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-muted-foreground" />
                        <span>{location.country || 'Unknown'}</span>
                      </div>
                      <Badge variant="secondary">{location.count} views</Badge>
                    </div>
                  ))}
                  {analytics.viewsByLocation.length === 0 && (
                    <p className="text-muted-foreground text-sm">No location data available</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="viewers" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Recent Viewers</CardTitle>
              <CardDescription>People who viewed your proposal</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px]">
                <div className="space-y-4">
                  {recentViewers.map((viewer) => {
                    const DeviceIcon = deviceIcons[viewer.device as keyof typeof deviceIcons] || Monitor;
                    
                    return (
                      <div
                        key={viewer.id}
                        className="flex items-start justify-between p-4 border rounded-lg"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <Users className="h-4 w-4 text-muted-foreground" />
                            <span className="font-medium">
                              {viewer.viewerName || viewer.viewerEmail || 'Anonymous'}
                            </span>
                          </div>
                          {viewer.viewerCompany && (
                            <p className="text-sm text-muted-foreground">{viewer.viewerCompany}</p>
                          )}
                          <div className="flex items-center gap-4 text-sm text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <DeviceIcon className="h-3 w-3" />
                              {viewer.device || 'Unknown'}
                            </span>
                            {viewer.city && viewer.country && (
                              <span className="flex items-center gap-1">
                                <MapPin className="h-3 w-3" />
                                {viewer.city}, {viewer.country}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="text-right text-sm">
                          <p className="font-medium">{formatDuration(viewer.totalDuration)}</p>
                          <p className="text-muted-foreground">{viewer.scrollDepth.toFixed(0)}% scroll</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {formatDate(viewer.startedAt)}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                  {recentViewers.length === 0 && (
                    <p className="text-muted-foreground text-center py-8">
                      No viewers yet. Share your proposal to start tracking views.
                    </p>
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
