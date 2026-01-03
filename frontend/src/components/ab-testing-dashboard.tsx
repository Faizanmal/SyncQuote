'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
  FlaskConical,
  Plus,
  Play,
  Pause,
  StopCircle,
  Trophy,
  TrendingUp,
  TrendingDown,
  BarChart2,
  Users,
  Eye,
  CheckCircle2,
  XCircle,
  Clock,
  Copy,
  Trash2,
  AlertTriangle,
  Sparkles,
  Target,
  Percent,
  ArrowRight,
  ChevronRight,
  Lightbulb,
} from 'lucide-react';

interface ABTest {
  id: string;
  name: string;
  proposalId: string;
  status: 'draft' | 'running' | 'paused' | 'completed' | 'winner_selected';
  trafficSplit: number;
  startedAt?: string;
  endedAt?: string;
  minSampleSize: number;
  confidenceLevel: number;
  variants: ABTestVariant[];
  winnerId?: string;
  autoSelectWinner: boolean;
}

interface ABTestVariant {
  id: string;
  name: string;
  description?: string;
  isControl: boolean;
  assignments: number;
  views: number;
  conversions: number;
  conversionRate: number;
  confidence?: number;
  improvement?: number;
  pValue?: number;
}

interface TestResults {
  testId: string;
  status: string;
  sampleSize: number;
  statisticalSignificance: boolean;
  recommendedWinner?: string;
  variants: {
    id: string;
    name: string;
    conversions: number;
    conversionRate: number;
    bayesianProbability: number;
    isWinner: boolean;
  }[];
}

export function ABTestingDashboard({ proposalId }: { proposalId?: string }) {
  const [tests, setTests] = useState<ABTest[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTest, setSelectedTest] = useState<ABTest | null>(null);
  const [testResults, setTestResults] = useState<TestResults | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const { toast } = useToast();

  // Form state
  const [testName, setTestName] = useState('');
  const [trafficSplit, setTrafficSplit] = useState(50);
  const [minSampleSize, setMinSampleSize] = useState(100);
  const [confidenceLevel, setConfidenceLevel] = useState(95);
  const [autoSelectWinner, setAutoSelectWinner] = useState(true);
  const [variants, setVariants] = useState([
    { name: 'Control', description: '', isControl: true },
    { name: 'Variant A', description: '', isControl: false },
  ]);

  useEffect(() => {
    fetchTests();
  }, [proposalId]);

  const fetchTests = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/ab-testing${proposalId ? `?proposalId=${proposalId}` : ''}`);
      const data = await response.json();
      setTests(data.tests || []);
    } catch (error) {
      console.error('Failed to fetch tests:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchTestResults = async (testId: string) => {
    try {
      const response = await fetch(`/api/ab-testing/${testId}/results`);
      const data = await response.json();
      setTestResults(data);
    } catch (error) {
      console.error('Failed to fetch results:', error);
    }
  };

  const createTest = async () => {
    try {
      const response = await fetch('/api/ab-testing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: testName,
          proposalId,
          trafficSplit,
          minSampleSize,
          confidenceLevel,
          autoSelectWinner,
          variants,
        }),
      });
      const data = await response.json();
      setTests(prev => [...prev, data.test]);
      setShowCreateDialog(false);
      resetForm();
      toast({
        title: 'Test created',
        description: 'A/B test has been created successfully',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to create test',
        variant: 'destructive',
      });
    }
  };

  const updateTestStatus = async (testId: string, status: string) => {
    try {
      await fetch(`/api/ab-testing/${testId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      setTests(prev => prev.map(t => (t.id === testId ? { ...t, status: status as ABTest['status'] } : t)));
      toast({
        title: 'Test updated',
        description: `Test ${status === 'running' ? 'started' : status === 'paused' ? 'paused' : 'stopped'}`,
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to update test',
        variant: 'destructive',
      });
    }
  };

  const selectWinner = async (testId: string, variantId: string) => {
    try {
      await fetch(`/api/ab-testing/${testId}/winner`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ variantId }),
      });
      setTests(prev => prev.map(t => (t.id === testId ? { ...t, status: 'winner_selected', winnerId: variantId } : t)));
      toast({
        title: 'Winner selected',
        description: 'The winning variant has been applied to the proposal',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to select winner',
        variant: 'destructive',
      });
    }
  };

  const deleteTest = async (testId: string) => {
    try {
      await fetch(`/api/ab-testing/${testId}`, { method: 'DELETE' });
      setTests(prev => prev.filter(t => t.id !== testId));
      toast({
        title: 'Test deleted',
        description: 'A/B test has been removed',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to delete test',
        variant: 'destructive',
      });
    }
  };

  const resetForm = () => {
    setTestName('');
    setTrafficSplit(50);
    setMinSampleSize(100);
    setConfidenceLevel(95);
    setAutoSelectWinner(true);
    setVariants([
      { name: 'Control', description: '', isControl: true },
      { name: 'Variant A', description: '', isControl: false },
    ]);
  };

  const addVariant = () => {
    const variantLetter = String.fromCharCode(65 + variants.length - 1);
    setVariants([...variants, { name: `Variant ${variantLetter}`, description: '', isControl: false }]);
  };

  const removeVariant = (index: number) => {
    if (variants.length > 2) {
      setVariants(variants.filter((_, i) => i !== index));
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'running':
        return <Badge className="bg-green-500"><Play className="w-3 h-3 mr-1" /> Running</Badge>;
      case 'paused':
        return <Badge className="bg-yellow-500"><Pause className="w-3 h-3 mr-1" /> Paused</Badge>;
      case 'completed':
        return <Badge className="bg-blue-500"><CheckCircle2 className="w-3 h-3 mr-1" /> Completed</Badge>;
      case 'winner_selected':
        return <Badge className="bg-purple-500"><Trophy className="w-3 h-3 mr-1" /> Winner Selected</Badge>;
      default:
        return <Badge variant="secondary"><Clock className="w-3 h-3 mr-1" /> Draft</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">A/B Testing</h2>
          <p className="text-muted-foreground">Test different proposal versions to optimize conversions</p>
        </div>
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              New Test
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Create A/B Test</DialogTitle>
              <DialogDescription>Set up a new experiment to test proposal variations</DialogDescription>
            </DialogHeader>
            <ScrollArea className="max-h-[60vh]">
              <div className="space-y-6 py-4 pr-4">
                <div className="space-y-2">
                  <Label>Test Name</Label>
                  <Input
                    placeholder="e.g., Pricing Table Layout Test"
                    value={testName}
                    onChange={(e) => setTestName(e.target.value)}
                  />
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label>Variants</Label>
                    <Button variant="outline" size="sm" onClick={addVariant}>
                      <Plus className="w-4 h-4 mr-1" />
                      Add Variant
                    </Button>
                  </div>
                  {variants.map((variant, index) => (
                    <Card key={index}>
                      <CardContent className="p-4">
                        <div className="flex items-start gap-4">
                          <div className="flex-1 space-y-3">
                            <div className="flex items-center gap-2">
                              <Input
                                value={variant.name}
                                onChange={(e) => {
                                  const newVariants = [...variants];
                                  newVariants[index].name = e.target.value;
                                  setVariants(newVariants);
                                }}
                                className="font-medium"
                              />
                              {variant.isControl && (
                                <Badge variant="outline">Control</Badge>
                              )}
                            </div>
                            <Textarea
                              placeholder="Describe what's different in this variant..."
                              value={variant.description}
                              onChange={(e) => {
                                const newVariants = [...variants];
                                newVariants[index].description = e.target.value;
                                setVariants(newVariants);
                              }}
                              rows={2}
                            />
                          </div>
                          {!variant.isControl && variants.length > 2 && (
                            <Button variant="ghost" size="sm" onClick={() => removeVariant(index)}>
                              <Trash2 className="w-4 h-4 text-destructive" />
                            </Button>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                <div className="space-y-4 pt-4 border-t">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label>Traffic Split</Label>
                      <span className="text-sm font-medium">{trafficSplit}% / {100 - trafficSplit}%</span>
                    </div>
                    <Slider
                      value={[trafficSplit]}
                      onValueChange={([value]) => setTrafficSplit(value)}
                      max={100}
                      step={5}
                    />
                    <p className="text-sm text-muted-foreground">
                      {trafficSplit}% to variants, {100 - trafficSplit}% to control
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Min Sample Size</Label>
                      <Input
                        type="number"
                        value={minSampleSize}
                        onChange={(e) => setMinSampleSize(parseInt(e.target.value))}
                        min={50}
                      />
                      <p className="text-xs text-muted-foreground">Per variant</p>
                    </div>
                    <div className="space-y-2">
                      <Label>Confidence Level</Label>
                      <Select value={confidenceLevel.toString()} onValueChange={(v) => setConfidenceLevel(parseInt(v))}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="90">90%</SelectItem>
                          <SelectItem value="95">95%</SelectItem>
                          <SelectItem value="99">99%</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                    <div>
                      <Label>Auto-select Winner</Label>
                      <p className="text-sm text-muted-foreground">
                        Automatically apply the winning variant when statistical significance is reached
                      </p>
                    </div>
                    <Switch checked={autoSelectWinner} onCheckedChange={setAutoSelectWinner} />
                  </div>
                </div>
              </div>
            </ScrollArea>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowCreateDialog(false)}>Cancel</Button>
              <Button onClick={createTest} disabled={!testName || variants.length < 2}>
                <FlaskConical className="w-4 h-4 mr-2" />
                Create Test
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Active Tests Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-2">
              <FlaskConical className="w-4 h-4" />
              <span className="text-sm">Active Tests</span>
            </div>
            <p className="text-2xl font-bold">
              {tests.filter(t => t.status === 'running').length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-2">
              <Users className="w-4 h-4" />
              <span className="text-sm">Total Participants</span>
            </div>
            <p className="text-2xl font-bold">
              {tests.reduce((sum, t) => sum + t.variants.reduce((vSum, v) => vSum + v.assignments, 0), 0)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-2">
              <Trophy className="w-4 h-4" />
              <span className="text-sm">Completed Tests</span>
            </div>
            <p className="text-2xl font-bold">
              {tests.filter(t => ['completed', 'winner_selected'].includes(t.status)).length}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tests List */}
      <div className="space-y-4">
        {tests.map((test) => (
          <Card key={test.id}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <FlaskConical className="w-5 h-5 text-muted-foreground" />
                  <div>
                    <CardTitle className="text-lg">{test.name}</CardTitle>
                    <CardDescription>
                      {test.variants.length} variants • {test.trafficSplit}% traffic
                    </CardDescription>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {getStatusBadge(test.status)}
                  {test.status === 'draft' && (
                    <Button size="sm" onClick={() => updateTestStatus(test.id, 'running')}>
                      <Play className="w-4 h-4 mr-1" />
                      Start
                    </Button>
                  )}
                  {test.status === 'running' && (
                    <Button size="sm" variant="outline" onClick={() => updateTestStatus(test.id, 'paused')}>
                      <Pause className="w-4 h-4 mr-1" />
                      Pause
                    </Button>
                  )}
                  {test.status === 'paused' && (
                    <Button size="sm" onClick={() => updateTestStatus(test.id, 'running')}>
                      <Play className="w-4 h-4 mr-1" />
                      Resume
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Variant</TableHead>
                    <TableHead className="text-right">Assignments</TableHead>
                    <TableHead className="text-right">Views</TableHead>
                    <TableHead className="text-right">Conversions</TableHead>
                    <TableHead className="text-right">Conv. Rate</TableHead>
                    <TableHead className="text-right">Confidence</TableHead>
                    <TableHead className="w-[100px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {test.variants.map((variant) => {
                    const isWinner = test.winnerId === variant.id;
                    const isBest = variant.conversionRate === Math.max(...test.variants.map(v => v.conversionRate));
                    return (
                      <TableRow key={variant.id} className={isWinner ? 'bg-green-50 dark:bg-green-950/20' : ''}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{variant.name}</span>
                            {variant.isControl && <Badge variant="outline">Control</Badge>}
                            {isWinner && <Badge className="bg-green-500"><Trophy className="w-3 h-3 mr-1" /> Winner</Badge>}
                            {!isWinner && isBest && test.status === 'running' && (
                              <Badge variant="secondary"><TrendingUp className="w-3 h-3 mr-1" /> Leading</Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">{variant.assignments}</TableCell>
                        <TableCell className="text-right">{variant.views}</TableCell>
                        <TableCell className="text-right">{variant.conversions}</TableCell>
                        <TableCell className="text-right">
                          <span className="font-medium">{(variant.conversionRate * 100).toFixed(1)}%</span>
                          {variant.improvement !== undefined && !variant.isControl && (
                            <span className={`ml-2 text-xs ${variant.improvement >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                              {variant.improvement >= 0 ? '+' : ''}{(variant.improvement * 100).toFixed(1)}%
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {variant.confidence !== undefined ? (
                            <div className="flex items-center justify-end gap-2">
                              <Progress value={variant.confidence * 100} className="w-16 h-2" />
                              <span className="text-sm">{(variant.confidence * 100).toFixed(0)}%</span>
                            </div>
                          ) : '-'}
                        </TableCell>
                        <TableCell>
                          {!test.winnerId && test.status !== 'draft' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => selectWinner(test.id, variant.id)}
                            >
                              Select
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>

              {/* Statistical Insights */}
              {test.status === 'running' && (
                <div className="mt-4 p-4 bg-muted/50 rounded-lg">
                  <div className="flex items-start gap-3">
                    <Lightbulb className="w-5 h-5 text-yellow-500 mt-0.5" />
                    <div>
                      <h4 className="font-medium">Statistical Insights</h4>
                      <p className="text-sm text-muted-foreground mt-1">
                        {test.variants.reduce((sum, v) => sum + v.assignments, 0) < test.minSampleSize * test.variants.length
                          ? `Need ${test.minSampleSize * test.variants.length - test.variants.reduce((sum, v) => sum + v.assignments, 0)} more participants to reach statistical significance.`
                          : 'Sample size reached! Results are statistically significant.'}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
            <CardFooter className="justify-between border-t pt-4">
              <div className="text-sm text-muted-foreground">
                {test.startedAt && `Started ${new Date(test.startedAt).toLocaleDateString()}`}
                {test.endedAt && ` • Ended ${new Date(test.endedAt).toLocaleDateString()}`}
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => {
                  setSelectedTest(test);
                  fetchTestResults(test.id);
                }}>
                  <BarChart2 className="w-4 h-4 mr-1" />
                  View Results
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => deleteTest(test.id)}
                  disabled={test.status === 'running'}
                >
                  <Trash2 className="w-4 h-4 text-destructive" />
                </Button>
              </div>
            </CardFooter>
          </Card>
        ))}

        {tests.length === 0 && !loading && (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <FlaskConical className="w-12 h-12 text-muted-foreground mb-4" />
              <h3 className="font-medium mb-2">No A/B Tests Yet</h3>
              <p className="text-sm text-muted-foreground mb-4 text-center">
                Create your first A/B test to optimize your proposal conversions
              </p>
              <Button onClick={() => setShowCreateDialog(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Create Test
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Results Dialog */}
      <Dialog open={!!selectedTest} onOpenChange={() => setSelectedTest(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Test Results: {selectedTest?.name}</DialogTitle>
            <DialogDescription>Detailed statistical analysis</DialogDescription>
          </DialogHeader>
          {testResults && (
            <div className="space-y-6 py-4">
              <div className="grid grid-cols-2 gap-4">
                <Card>
                  <CardContent className="p-4">
                    <div className="text-sm text-muted-foreground">Sample Size</div>
                    <div className="text-2xl font-bold">{testResults.sampleSize}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="text-sm text-muted-foreground">Statistical Significance</div>
                    <div className="text-2xl font-bold flex items-center gap-2">
                      {testResults.statisticalSignificance ? (
                        <>
                          <CheckCircle2 className="w-5 h-5 text-green-500" />
                          Yes
                        </>
                      ) : (
                        <>
                          <Clock className="w-5 h-5 text-yellow-500" />
                          Not yet
                        </>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="space-y-3">
                <h4 className="font-medium">Bayesian Probability Analysis</h4>
                {testResults.variants.map((variant) => (
                  <div key={variant.id} className="flex items-center gap-4 p-3 border rounded-lg">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{variant.name}</span>
                        {variant.isWinner && <Badge className="bg-green-500">Best</Badge>}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {variant.conversions} conversions • {(variant.conversionRate * 100).toFixed(1)}% rate
                      </div>
                    </div>
                    <div className="w-32">
                      <div className="text-right text-sm font-medium">
                        {(variant.bayesianProbability * 100).toFixed(0)}% chance to win
                      </div>
                      <Progress value={variant.bayesianProbability * 100} className="mt-1" />
                    </div>
                  </div>
                ))}
              </div>

              {testResults.recommendedWinner && (
                <div className="p-4 bg-green-50 dark:bg-green-950/20 rounded-lg border border-green-200">
                  <div className="flex items-center gap-2 text-green-700 dark:text-green-400">
                    <Trophy className="w-5 h-5" />
                    <span className="font-medium">Recommended Winner: {testResults.recommendedWinner}</span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    Based on Bayesian analysis with {selectedTest?.confidenceLevel}% confidence level
                  </p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
