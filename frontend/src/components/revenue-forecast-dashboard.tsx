'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Target,
  PieChart as PieChartIcon,
  BarChart2,
  Calendar,
  Users,
  Trophy,
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
  LineChart,
  Line,
  Legend,
  Funnel,
  FunnelChart,
} from 'recharts';

interface PipelineStage {
  id: string;
  name: string;
  order: number;
  probability: number;
  color: string;
  proposalCount: number;
  totalValue: number;
  weightedValue: number;
}

interface PipelineData {
  stages: PipelineStage[];
  totalPipeline: number;
  weightedPipeline: number;
}

interface ForecastData {
  currentMonth: {
    projected: number;
    actual: number;
    target?: number;
  };
  nextMonth: {
    projected: number;
    target?: number;
  };
  quarterly: {
    quarter: string;
    projected: number;
    actual: number;
  }[];
  trends: {
    period: string;
    revenue: number;
    deals: number;
    avgDealSize: number;
  }[];
}

interface WinRateAnalysis {
  overall: number;
  byMonth: { month: string; rate: number; deals: number }[];
  byValue: { range: string; rate: number; deals: number }[];
  avgTimeToClose: number;
}

interface TeamPerformance {
  members: {
    userId: string;
    name: string;
    proposalsSent: number;
    proposalsWon: number;
    totalRevenue: number;
    winRate: number;
    avgDealSize: number;
    avgResponseTime: number;
  }[];
  totals: {
    proposalsSent: number;
    proposalsWon: number;
    totalRevenue: number;
    avgWinRate: number;
  };
}

const COLORS = ['#6366f1', '#8b5cf6', '#a855f7', '#d946ef', '#ec4899', '#f43f5e'];

export function RevenueForecastDashboard() {
  const [pipeline, setPipeline] = useState<PipelineData | null>(null);
  const [forecast, setForecast] = useState<ForecastData | null>(null);
  const [winRate, setWinRate] = useState<WinRateAnalysis | null>(null);
  const [teamPerformance, setTeamPerformance] = useState<TeamPerformance | null>(null);
  const [loading, setLoading] = useState(true);
  const api = useApi();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [pipelineRes, forecastRes, winRateRes, teamRes] = await Promise.all([
        api.get('/forecasting/pipeline'),
        api.get('/forecasting/forecast'),
        api.get('/forecasting/win-rate'),
        api.get('/forecasting/team-performance'),
      ]);
      
      setPipeline(pipelineRes.data);
      setForecast(forecastRes.data);
      setWinRate(winRateRes.data);
      setTeamPerformance(teamRes.data);
    } catch (error) {
      console.error('Failed to fetch forecasting data:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Overview Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pipeline Value</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(pipeline?.totalPipeline || 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              {formatCurrency(pipeline?.weightedPipeline || 0)} weighted
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">This Month</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(forecast?.currentMonth.actual || 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              {formatCurrency(forecast?.currentMonth.projected || 0)} projected
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Win Rate</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{winRate?.overall.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground">
              {winRate?.avgTimeToClose}h avg close time
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Deal Size</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(teamPerformance?.members[0]?.avgDealSize || 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              {teamPerformance?.totals.proposalsWon} deals won
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="pipeline" className="space-y-4">
        <TabsList>
          <TabsTrigger value="pipeline">Pipeline</TabsTrigger>
          <TabsTrigger value="forecast">Forecast</TabsTrigger>
          <TabsTrigger value="winrate">Win Rate</TabsTrigger>
          <TabsTrigger value="team">Team Performance</TabsTrigger>
        </TabsList>

        <TabsContent value="pipeline" className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            {/* Pipeline Funnel */}
            <Card>
              <CardHeader>
                <CardTitle>Deal Pipeline</CardTitle>
                <CardDescription>Proposals by stage</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {pipeline?.stages
                    .filter(s => s.proposalCount > 0 || s.probability > 0)
                    .sort((a, b) => a.order - b.order)
                    .map((stage, index) => {
                      const maxValue = Math.max(...(pipeline?.stages.map(s => s.totalValue) || [1]));
                      const widthPercentage = maxValue > 0 ? (stage.totalValue / maxValue) * 100 : 0;
                      
                      return (
                        <div key={stage.id} className="space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <div
                                className="w-3 h-3 rounded-full"
                                style={{ backgroundColor: stage.color }}
                              />
                              <span className="font-medium">{stage.name}</span>
                              <Badge variant="secondary" className="text-xs">
                                {stage.probability}% prob
                              </Badge>
                            </div>
                            <div className="text-right">
                              <span className="font-semibold">{formatCurrency(stage.totalValue)}</span>
                              <span className="text-sm text-muted-foreground ml-2">
                                ({stage.proposalCount} deals)
                              </span>
                            </div>
                          </div>
                          <div className="relative">
                            <div className="h-8 bg-muted rounded-md overflow-hidden">
                              <div
                                className="h-full rounded-md transition-all"
                                style={{
                                  width: `${widthPercentage}%`,
                                  backgroundColor: stage.color,
                                  opacity: 0.7,
                                }}
                              />
                            </div>
                            <div className="absolute inset-0 flex items-center justify-end pr-2">
                              <span className="text-xs font-medium">
                                {formatCurrency(stage.weightedValue)} weighted
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                </div>
              </CardContent>
            </Card>

            {/* Pipeline Distribution */}
            <Card>
              <CardHeader>
                <CardTitle>Value Distribution</CardTitle>
                <CardDescription>Pipeline value by stage</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pipeline?.stages.filter(s => s.totalValue > 0) as { name: string; totalValue: number; color?: string }[]}
                        dataKey="totalValue"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={100}
                        label={({ payload }) => `${(payload as { name: string; totalValue: number }).name}: ${formatCurrency((payload as { name: string; totalValue: number }).totalValue)}`}
                      >
                        {pipeline?.stages.map((stage, index) => (
                          <Cell key={stage.id} fill={stage.color || COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value: unknown) => formatCurrency(value as number)} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="forecast" className="space-y-4">
          {/* Revenue Trends */}
          <Card>
            <CardHeader>
              <CardTitle>Revenue Trends</CardTitle>
              <CardDescription>Monthly revenue over the last 12 months</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[350px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={forecast?.trends}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="period" tick={{ fontSize: 12 }} />
                    <YAxis 
                      tick={{ fontSize: 12 }}
                      tickFormatter={(value) => `$${value / 1000}k`}
                    />
                    <Tooltip
                      formatter={(value: number, name: string) => {
                        if (name === 'revenue') return formatCurrency(value);
                        if (name === 'avgDealSize') return formatCurrency(value);
                        return value;
                      }}
                    />
                    <Legend />
                    <Area
                      type="monotone"
                      dataKey="revenue"
                      name="Revenue"
                      stroke="#6366f1"
                      fill="#6366f1"
                      fillOpacity={0.2}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-4 lg:grid-cols-2">
            {/* Quarterly Performance */}
            <Card>
              <CardHeader>
                <CardTitle>Quarterly Performance</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[250px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={forecast?.quarterly}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="quarter" tick={{ fontSize: 12 }} />
                      <YAxis 
                        tick={{ fontSize: 12 }}
                        tickFormatter={(value) => `$${value / 1000}k`}
                      />
                      <Tooltip formatter={(value: number) => formatCurrency(value)} />
                      <Bar dataKey="actual" name="Actual" fill="#6366f1" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Deal Volume */}
            <Card>
              <CardHeader>
                <CardTitle>Deal Volume & Size</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[250px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={forecast?.trends}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="period" tick={{ fontSize: 12 }} />
                      <YAxis yAxisId="left" tick={{ fontSize: 12 }} />
                      <YAxis 
                        yAxisId="right" 
                        orientation="right" 
                        tick={{ fontSize: 12 }}
                        tickFormatter={(value) => `$${value / 1000}k`}
                      />
                      <Tooltip 
                        formatter={(value: number, name: string) => {
                          if (name === 'avgDealSize') return formatCurrency(value);
                          return value;
                        }}
                      />
                      <Legend />
                      <Line
                        yAxisId="left"
                        type="monotone"
                        dataKey="deals"
                        name="Deals"
                        stroke="#8b5cf6"
                        strokeWidth={2}
                      />
                      <Line
                        yAxisId="right"
                        type="monotone"
                        dataKey="avgDealSize"
                        name="Avg Deal Size"
                        stroke="#f59e0b"
                        strokeWidth={2}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="winrate" className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            {/* Win Rate by Month */}
            <Card>
              <CardHeader>
                <CardTitle>Win Rate Trend</CardTitle>
                <CardDescription>Monthly win rate over time</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={winRate?.byMonth}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                      <YAxis 
                        tick={{ fontSize: 12 }} 
                        domain={[0, 100]}
                        tickFormatter={(value) => `${value}%`}
                      />
                      <Tooltip formatter={(value: number) => `${value.toFixed(1)}%`} />
                      <Line
                        type="monotone"
                        dataKey="rate"
                        name="Win Rate"
                        stroke="#22c55e"
                        strokeWidth={2}
                        dot={{ fill: '#22c55e' }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Win Rate by Deal Size */}
            <Card>
              <CardHeader>
                <CardTitle>Win Rate by Deal Size</CardTitle>
                <CardDescription>Performance across value ranges</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={winRate?.byValue} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis 
                        type="number" 
                        domain={[0, 100]}
                        tickFormatter={(value) => `${value}%`}
                        tick={{ fontSize: 12 }}
                      />
                      <YAxis type="category" dataKey="range" tick={{ fontSize: 12 }} width={80} />
                      <Tooltip formatter={(value: number) => `${value.toFixed(1)}%`} />
                      <Bar dataKey="rate" name="Win Rate" fill="#22c55e" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Win Rate Stats */}
          <Card>
            <CardHeader>
              <CardTitle>Key Metrics</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="text-center p-4 bg-muted rounded-lg">
                  <div className="text-3xl font-bold text-green-600">
                    {winRate?.overall.toFixed(1)}%
                  </div>
                  <p className="text-sm text-muted-foreground">Overall Win Rate</p>
                </div>
                <div className="text-center p-4 bg-muted rounded-lg">
                  <div className="text-3xl font-bold">
                    {Math.round((winRate?.avgTimeToClose || 0) / 24)} days
                  </div>
                  <p className="text-sm text-muted-foreground">Avg Time to Close</p>
                </div>
                <div className="text-center p-4 bg-muted rounded-lg">
                  <div className="text-3xl font-bold">
                    {winRate?.byMonth?.length || 0}
                  </div>
                  <p className="text-sm text-muted-foreground">Months of Data</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="team" className="space-y-4">
          {/* Team Overview */}
          <Card>
            <CardHeader>
              <CardTitle>Team Performance</CardTitle>
              <CardDescription>Individual and team metrics</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {teamPerformance?.members.map((member, index) => (
                  <div
                    key={member.userId}
                    className="flex items-center justify-between p-4 border rounded-lg"
                  >
                    <div className="flex items-center gap-4">
                      <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary/10 text-primary font-semibold">
                        {member.name?.charAt(0) || '#'}
                      </div>
                      <div>
                        <p className="font-medium">{member.name || 'Unknown'}</p>
                        <p className="text-sm text-muted-foreground">
                          {member.proposalsSent} sent • {member.proposalsWon} won
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-8">
                      <div className="text-right">
                        <p className="font-semibold">{formatCurrency(member.totalRevenue)}</p>
                        <p className="text-xs text-muted-foreground">Total Revenue</p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold">{member.winRate.toFixed(1)}%</p>
                        <p className="text-xs text-muted-foreground">Win Rate</p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold">{formatCurrency(member.avgDealSize)}</p>
                        <p className="text-xs text-muted-foreground">Avg Deal</p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold">{member.avgResponseTime}h</p>
                        <p className="text-xs text-muted-foreground">Response Time</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Team Totals */}
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardContent className="pt-6">
                <div className="text-center">
                  <div className="text-2xl font-bold">
                    {teamPerformance?.totals.proposalsSent}
                  </div>
                  <p className="text-sm text-muted-foreground">Proposals Sent</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-center">
                  <div className="text-2xl font-bold">
                    {teamPerformance?.totals.proposalsWon}
                  </div>
                  <p className="text-sm text-muted-foreground">Deals Won</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-center">
                  <div className="text-2xl font-bold">
                    {formatCurrency(teamPerformance?.totals.totalRevenue || 0)}
                  </div>
                  <p className="text-sm text-muted-foreground">Total Revenue</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-center">
                  <div className="text-2xl font-bold">
                    {teamPerformance?.totals.avgWinRate.toFixed(1)}%
                  </div>
                  <p className="text-sm text-muted-foreground">Team Win Rate</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
