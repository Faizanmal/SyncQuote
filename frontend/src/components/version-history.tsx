'use client';

import { useState, useEffect } from 'react';
import { useApi } from '@/hooks/use-api';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { History, GitCompare, Undo2, Clock } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

interface Version {
  id: string;
  version: number;
  changeDescription?: string;
  createdBy?: string;
  createdAt: string;
  snapshotData: any;
}

interface VersionHistoryProps {
  proposalId: string;
  onRestore?: () => void;
}

export function VersionHistory({ proposalId, onRestore }: VersionHistoryProps) {
  const [versions, setVersions] = useState<Version[]>([]);
  const [loading, setLoading] = useState(true);
  const [comparing, setComparing] = useState<{ v1?: string; v2?: string }>({});
  const [comparisonData, setComparisonData] = useState<any>(null);
  const api = useApi();

  useEffect(() => {
    loadVersions();
  }, [proposalId]);

  const loadVersions = async () => {
    try {
      const response = await api.get(`/versions/proposal/${proposalId}`);
      setVersions(response.data);
    } catch (error) {
      toast.error('Failed to load version history');
    } finally {
      setLoading(false);
    }
  };

  const handleRestore = async (versionId: string, versionNumber: number) => {
    if (!confirm(`Restore to version ${versionNumber}? This will create a new version.`)) {
      return;
    }

    try {
      await api.post(`/versions/${proposalId}/restore/${versionId}`, {});
      toast.success('Version restored successfully');
      loadVersions();
      onRestore?.();
    } catch (error) {
      toast.error('Failed to restore version');
    }
  };

  const handleCompare = async () => {
    if (!comparing.v1 || !comparing.v2) {
      toast.error('Please select two versions to compare');
      return;
    }

    try {
      const response = await api.get(`/versions/compare/${comparing.v1}/${comparing.v2}`);
      setComparisonData(response.data);
    } catch (error) {
      toast.error('Failed to compare versions');
    }
  };

  if (loading) {
    return <div className="text-center py-8">Loading version history...</div>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <History className="h-5 w-5" />
          Version History
        </CardTitle>
        <CardDescription>
          Track changes and restore previous versions of this proposal
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {versions.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              No version history yet
            </p>
          ) : (
            versions.map((version) => (
              <div
                key={version.id}
                className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <Badge variant="outline">Version {version.version}</Badge>
                    <span className="text-sm text-muted-foreground flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {formatDistanceToNow(new Date(version.createdAt), {
                        addSuffix: true,
                      })}
                    </span>
                  </div>
                  {version.changeDescription && (
                    <p className="text-sm">{version.changeDescription}</p>
                  )}
                  {version.createdBy && (
                    <p className="text-xs text-muted-foreground mt-1">
                      By: {version.createdBy}
                    </p>
                  )}
                </div>
                <div className="flex gap-2">
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button variant="outline" size="sm">
                        <GitCompare className="h-4 w-4 mr-1" />
                        Compare
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-2xl">
                      <DialogHeader>
                        <DialogTitle>Compare Versions</DialogTitle>
                        <DialogDescription>
                          View changes between different versions
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="text-sm font-medium">Version 1</label>
                            <select
                              className="w-full mt-1 p-2 border rounded"
                              onChange={(e) =>
                                setComparing({ ...comparing, v1: e.target.value })
                              }
                            >
                              <option value="">Select version</option>
                              {versions.map((v) => (
                                <option key={v.id} value={v.id}>
                                  Version {v.version}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="text-sm font-medium">Version 2</label>
                            <select
                              className="w-full mt-1 p-2 border rounded"
                              onChange={(e) =>
                                setComparing({ ...comparing, v2: e.target.value })
                              }
                            >
                              <option value="">Select version</option>
                              {versions.map((v) => (
                                <option key={v.id} value={v.id}>
                                  Version {v.version}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                        <Button onClick={handleCompare} className="w-full">
                          Compare
                        </Button>
                        {comparisonData && (
                          <div className="mt-4 p-4 bg-muted rounded-lg">
                            <pre className="text-xs overflow-auto">
                              {JSON.stringify(comparisonData, null, 2)}
                            </pre>
                          </div>
                        )}
                      </div>
                    </DialogContent>
                  </Dialog>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRestore(version.id, version.version)}
                  >
                    <Undo2 className="h-4 w-4 mr-1" />
                    Restore
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
