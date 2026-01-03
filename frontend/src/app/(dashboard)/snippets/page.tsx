'use client';

import { SnippetLibrary } from '@/components/snippet-library';

export default function SnippetsPage() {
  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Snippet Library</h1>
        <p className="text-muted-foreground">
          Create and manage reusable content blocks for your proposals
        </p>
      </div>
      <SnippetLibrary />
    </div>
  );
}
