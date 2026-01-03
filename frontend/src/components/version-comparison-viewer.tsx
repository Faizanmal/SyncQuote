'use client';

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  FileText, GitCompare, Clock, User, Plus, Minus, 
  ArrowRight, ArrowLeft, ChevronDown, ChevronRight 
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface Version {
  id: string;
  versionNumber: number;
  createdBy: string;
  createdAt: string;
  changes?: string;
}

interface VersionDiff {
  oldVersion: Version;
  newVersion: Version;
  changes: SectionDiff[];
  addedSections: number;
  removedSections: number;
  modifiedSections: number;
}

interface SectionDiff {
  sectionId: string;
  sectionTitle: string;
  changeType: 'added' | 'removed' | 'modified' | 'unchanged';
  oldContent?: string;
  newContent?: string;
  lineDiffs?: LineDiff[];
}

interface LineDiff {
  type: 'added' | 'removed' | 'unchanged';
  content: string;
  lineNumber: number;
}

export function VersionComparisonViewer({ proposalId }: { proposalId: string }) {
  const [selectedVersions, setSelectedVersions] = useState<[string?, string?]>([undefined, undefined]);
  const [viewMode, setViewMode] = useState<'unified' | 'split'>('split');
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());

  const { data: versions } = useQuery({
    queryKey: ['proposal-versions', proposalId],
    queryFn: async () => {
      const res = await fetch(`/api/proposals/${proposalId}/versions`);
      return res.json();
    },
  });

  const { data: comparison, isLoading: isComparing } = useQuery({
    queryKey: ['version-comparison', selectedVersions[0], selectedVersions[1]],
    queryFn: async () => {
      if (!selectedVersions[0] || !selectedVersions[1]) return null;
      const res = await fetch(
        `/api/version-comparison/compare?oldVersionId=${selectedVersions[0]}&newVersionId=${selectedVersions[1]}`
      );
      return res.json();
    },
    enabled: !!(selectedVersions[0] && selectedVersions[1]),
  });

  const toggleSection = (sectionId: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(sectionId)) {
      newExpanded.delete(sectionId);
    } else {
      newExpanded.add(sectionId);
    }
    setExpandedSections(newExpanded);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold">Version Comparison</h2>
          <p className="text-muted-foreground">Compare changes between document versions</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Select Versions to Compare</CardTitle>
          <CardDescription>Choose two versions to see the differences</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
            <div>
              <label className="text-sm font-medium mb-2 block">Original Version</label>
              <select
                className="w-full p-2 border rounded-md"
                value={selectedVersions[0] || ''}
                onChange={(e) => setSelectedVersions([e.target.value, selectedVersions[1]])}
              >
                <option value="">Select version...</option>
                {versions?.map((v: Version) => (
                  <option key={v.id} value={v.id}>
                    v{v.versionNumber} - {new Date(v.createdAt).toLocaleDateString()}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex justify-center items-center">
              <ArrowRight className="h-6 w-6 text-muted-foreground" />
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">New Version</label>
              <select
                className="w-full p-2 border rounded-md"
                value={selectedVersions[1] || ''}
                onChange={(e) => setSelectedVersions([selectedVersions[0], e.target.value])}
              >
                <option value="">Select version...</option>
                {versions?.map((v: Version) => (
                  <option key={v.id} value={v.id}>
                    v{v.versionNumber} - {new Date(v.createdAt).toLocaleDateString()}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {comparison && (
        <>
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Change Summary</CardTitle>
                <Tabs value={viewMode} onValueChange={(v: any) => setViewMode(v)}>
                  <TabsList>
                    <TabsTrigger value="split">Side by Side</TabsTrigger>
                    <TabsTrigger value="unified">Unified</TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center">
                    <Plus className="h-5 w-5 text-green-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{comparison.addedSections}</p>
                    <p className="text-sm text-muted-foreground">Added</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                    <FileText className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{comparison.modifiedSections}</p>
                    <p className="text-sm text-muted-foreground">Modified</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-red-100 flex items-center justify-center">
                    <Minus className="h-5 w-5 text-red-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{comparison.removedSections}</p>
                    <p className="text-sm text-muted-foreground">Removed</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Changes</CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[600px]">
                <div className="space-y-4">
                  {comparison.changes.map((section: SectionDiff) => (
                    <SectionDiffCard
                      key={section.sectionId}
                      section={section}
                      viewMode={viewMode}
                      isExpanded={expandedSections.has(section.sectionId)}
                      onToggle={() => toggleSection(section.sectionId)}
                    />
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </>
      )}

      {!comparison && selectedVersions[0] && selectedVersions[1] && isComparing && (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">Loading comparison...</p>
          </CardContent>
        </Card>
      )}

      {!comparison && (!selectedVersions[0] || !selectedVersions[1]) && (
        <Card>
          <CardContent className="py-12 text-center">
            <GitCompare className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-lg font-medium">Select two versions to compare</p>
            <p className="text-sm text-muted-foreground">
              Choose versions from the dropdowns above to see their differences
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function SectionDiffCard({ 
  section, 
  viewMode, 
  isExpanded, 
  onToggle 
}: { 
  section: SectionDiff;
  viewMode: 'unified' | 'split';
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const getChangeColor = (changeType: string) => {
    switch (changeType) {
      case 'added': return 'bg-green-50 border-green-200';
      case 'removed': return 'bg-red-50 border-red-200';
      case 'modified': return 'bg-blue-50 border-blue-200';
      default: return 'bg-gray-50 border-gray-200';
    }
  };

  const getChangeBadge = (changeType: string) => {
    switch (changeType) {
      case 'added':
        return <Badge className="bg-green-600">Added</Badge>;
      case 'removed':
        return <Badge className="bg-red-600">Removed</Badge>;
      case 'modified':
        return <Badge className="bg-blue-600">Modified</Badge>;
      default:
        return <Badge variant="secondary">Unchanged</Badge>;
    }
  };

  if (section.changeType === 'unchanged') return null;

  return (
    <Card className={cn('border-2', getChangeColor(section.changeType))}>
      <CardHeader 
        className="cursor-pointer hover:bg-muted/50"
        onClick={onToggle}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {isExpanded ? (
              <ChevronDown className="h-5 w-5" />
            ) : (
              <ChevronRight className="h-5 w-5" />
            )}
            <CardTitle className="text-lg">{section.sectionTitle}</CardTitle>
          </div>
          {getChangeBadge(section.changeType)}
        </div>
      </CardHeader>

      {isExpanded && (
        <CardContent>
          {viewMode === 'split' ? (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <h4 className="text-sm font-semibold mb-2 text-red-700">Original</h4>
                <div className="bg-red-50 border border-red-200 rounded p-4">
                  {section.oldContent ? (
                    <pre className="text-sm whitespace-pre-wrap font-sans">
                      {section.oldContent}
                    </pre>
                  ) : (
                    <p className="text-sm text-muted-foreground italic">No content</p>
                  )}
                </div>
              </div>

              <div>
                <h4 className="text-sm font-semibold mb-2 text-green-700">Modified</h4>
                <div className="bg-green-50 border border-green-200 rounded p-4">
                  {section.newContent ? (
                    <pre className="text-sm whitespace-pre-wrap font-sans">
                      {section.newContent}
                    </pre>
                  ) : (
                    <p className="text-sm text-muted-foreground italic">No content</p>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-1">
              {section.lineDiffs?.map((line, idx) => (
                <div
                  key={idx}
                  className={cn(
                    'p-2 font-mono text-sm',
                    line.type === 'added' && 'bg-green-100 text-green-900',
                    line.type === 'removed' && 'bg-red-100 text-red-900',
                    line.type === 'unchanged' && 'bg-gray-50 text-gray-700'
                  )}
                >
                  <span className="inline-block w-8 text-muted-foreground">
                    {line.lineNumber}
                  </span>
                  <span className="inline-block w-4">
                    {line.type === 'added' && '+'}
                    {line.type === 'removed' && '-'}
                    {line.type === 'unchanged' && ' '}
                  </span>
                  <span>{line.content}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}
