'use client';

import { RevenueForecastDashboard } from '@/components/revenue-forecast-dashboard';

export default function ForecastingPage() {
  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Revenue Forecasting</h1>
        <p className="text-muted-foreground">
          Pipeline analysis, revenue projections, and team performance metrics
        </p>
      </div>
      <RevenueForecastDashboard />
    </div>
  );
}
