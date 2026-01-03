'use client';

import { AutomationWorkflows } from '@/components/automation-workflows';

export default function AutomationPage() {
  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Automation Workflows</h1>
        <p className="text-muted-foreground">
          Automate follow-ups, notifications, and proposal workflows
        </p>
      </div>
      <AutomationWorkflows />
    </div>
  );
}
