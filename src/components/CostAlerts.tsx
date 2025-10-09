'use client';

import React, { useState, useEffect } from 'react';

import { cn } from '@/lib/utils';
import { UsageEventWithMetadata } from '@/types/usage';

export interface AlertThreshold {
  id: string;
  type: 'daily' | 'weekly' | 'monthly';
  amount: number;
  enabled: boolean;
}

interface CostAlertsProps {
  events: UsageEventWithMetadata[];
  className?: string;
}

const getEventDate = (event: UsageEventWithMetadata) => new Date(event.windowStart ?? event.timestamp);

const STATUS_STYLES: Record<'safe' | 'warning' | 'danger', { badge: string; border: string; bar: string; text: string }> = {
  safe: {
    badge: 'bg-muted text-muted-foreground',
    border: 'border-border bg-muted/30',
    bar: 'bg-primary',
    text: 'text-muted-foreground'
  },
  warning: {
    badge: 'bg-secondary text-secondary-foreground',
    border: 'border-primary/40 bg-secondary',
    bar: 'bg-secondary-foreground',
    text: 'text-foreground'
  },
  danger: {
    badge: 'bg-destructive text-destructive-foreground',
    border: 'border-destructive bg-destructive/15',
    bar: 'bg-destructive',
    text: 'text-foreground'
  }
};

export interface AlertStatusSummary {
  status: 'safe' | 'warning' | 'danger';
  percentage: number;
  message: string;
}

export function evaluateAlertStatus(threshold: AlertThreshold, usage: number): AlertStatusSummary {
  if (!threshold.enabled) {
    return { status: 'safe', percentage: 0, message: 'Alert disabled' };
  }

  if (threshold.amount <= 0) {
    return {
      status: 'safe',
      percentage: 0,
      message: 'Set a budget above $0 to enable alerts.'
    };
  }

  const percentage = Number.isFinite(usage) ? (usage / threshold.amount) * 100 : 0;

  if (percentage >= 100) {
    return {
      status: 'danger',
      percentage,
      message: `Budget exceeded by $${Math.max(usage - threshold.amount, 0).toFixed(2)}`
    };
  }

  if (percentage >= 80) {
    return {
      status: 'warning',
      percentage,
      message: `${Math.max(100 - percentage, 0).toFixed(0)}% budget remaining`
    };
  }

  return {
    status: 'safe',
    percentage,
    message: `${Math.max(100 - percentage, 0).toFixed(0)}% budget remaining`
  };
}

export default function CostAlerts({ events, className }: CostAlertsProps) {
  const [thresholds, setThresholds] = useState<AlertThreshold[]>([
    { id: 'daily', type: 'daily', amount: 10, enabled: true },
    { id: 'weekly', type: 'weekly', amount: 50, enabled: true },
    { id: 'monthly', type: 'monthly', amount: 200, enabled: false }
  ]);
  const [showSettings, setShowSettings] = useState(false);

  const calculatePeriodUsage = (type: 'daily' | 'weekly' | 'monthly'): number => {
    const now = new Date();
    let startDate: Date;

    switch (type) {
      case 'daily':
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
      case 'weekly':
        const dayOfWeek = now.getDay();
        startDate = new Date(now.getTime() - dayOfWeek * 24 * 60 * 60 * 1000);
        startDate.setHours(0, 0, 0, 0);
        break;
      case 'monthly':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
    }

    return events
      .filter(event => getEventDate(event) >= startDate)
      .reduce((sum, event) => sum + parseFloat(event.costEstimate || '0'), 0);
  };

  const dailyUsage = calculatePeriodUsage('daily');
  const weeklyUsage = calculatePeriodUsage('weekly');
  const monthlyUsage = calculatePeriodUsage('monthly');

  const getUsageForThreshold = (threshold: AlertThreshold): number => {
    switch (threshold.type) {
      case 'daily': return dailyUsage;
      case 'weekly': return weeklyUsage;
      case 'monthly': return monthlyUsage;
    }
  };

  const updateThreshold = (id: string, updates: Partial<AlertThreshold>) => {
    setThresholds(prev => prev.map(t =>
      t.id === id ? { ...t, ...updates } : t
    ));
  };

  useEffect(() => {
    const stored = localStorage.getItem('costAlertThresholds');
    if (stored) {
      try {
        setThresholds(JSON.parse(stored));
      } catch (error) {
        console.error('Failed to parse stored thresholds:', error);
      }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('costAlertThresholds', JSON.stringify(thresholds));
  }, [thresholds]);

  const thresholdSummaries = thresholds.map((threshold) => {
    const usage = getUsageForThreshold(threshold);
    const alert = evaluateAlertStatus(threshold, usage);

    return { threshold, usage, alert };
  });

  const activeAlerts = thresholdSummaries.filter(({ threshold, alert }) => threshold.enabled && alert.status !== 'safe');

  return (
    <div className={cn('rounded-lg border border-border bg-card shadow-sm', className)}>
      <div className="flex items-start justify-between gap-4 border-b border-border px-4 py-4">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Cost alerts</h2>
          <p className="text-sm text-muted-foreground">Monitor spending against the budgets you define.</p>
        </div>
        <button
          onClick={() => setShowSettings(!showSettings)}
          className="inline-flex items-center justify-center rounded-md border border-border bg-muted px-3 py-1 text-sm font-medium text-foreground transition-colors hover:bg-muted/80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          {showSettings ? 'Hide settings' : 'Settings'}
        </button>
      </div>

      {activeAlerts.length > 0 && (
        <div className="border-b border-destructive bg-destructive/15 px-4 py-3 text-sm text-foreground">
          <h3 className="font-medium">Active alerts</h3>
          <div className="mt-2 space-y-2">
            {activeAlerts.map(({ threshold, usage, alert }) => (
              <div key={threshold.id} className="flex flex-wrap items-center gap-2">
                <span className="inline-flex h-2 w-2 rounded-full bg-destructive" aria-hidden="true" />
                <span className="font-medium capitalize">{threshold.type}:</span>
                <span>${usage.toFixed(2)} / ${threshold.amount}</span>
                <span className="text-muted-foreground">({alert.message})</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="px-4 py-4">
        <div className="grid gap-4 md:grid-cols-3">
          {thresholdSummaries.map(({ threshold, alert, usage }) => {
            const styles = STATUS_STYLES[alert.status];

            return (
              <div
                key={threshold.id}
                className={cn('rounded-lg border p-4 transition-colors', styles.border, !threshold.enabled && 'opacity-60')}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="text-sm font-semibold capitalize text-foreground">{threshold.type}</h4>
                    <p className="text-xs text-muted-foreground">Budget ${threshold.amount.toFixed(2)}</p>
                  </div>
                  <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium', styles.badge)}>
                    {threshold.enabled ? alert.status : 'disabled'}
                  </span>
                </div>

                <div className="mt-4 space-y-2">
                  <div className="flex items-center justify-between text-sm text-foreground">
                    <span>${usage.toFixed(2)} spent</span>
                    <span>{Math.min(alert.percentage, 999).toFixed(0)}%</span>
                  </div>
                  {threshold.enabled && threshold.amount > 0 && (
                    <div className="h-2 w-full rounded-full bg-muted">
                      <div
                        className={cn('h-2 rounded-full transition-all', styles.bar)}
                        style={{ width: `${Math.min(alert.percentage, 100)}%` }}
                      />
                    </div>
                  )}
                  <p className={cn('text-xs', styles.text)}>{alert.message}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {showSettings && (
        <div className="border-t border-border bg-muted/30 px-4 py-4">
          <h3 className="text-sm font-medium text-foreground">Alert settings</h3>
          <div className="mt-3 space-y-3">
            {thresholds.map(threshold => (
              <div key={threshold.id} className="flex flex-wrap items-center gap-4">
                <label className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <input
                    type="checkbox"
                    checked={threshold.enabled}
                    onChange={(e) => updateThreshold(threshold.id, { enabled: e.target.checked })}
                    className="rounded border-border text-primary focus:ring-primary"
                  />
                  <span className="capitalize">{threshold.type}</span>
                </label>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span>$</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={threshold.amount}
                    onChange={(e) => updateThreshold(threshold.id, { amount: parseFloat(e.target.value) || 0 })}
                    className="w-24 rounded-md border border-border bg-background px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 rounded-md border border-primary/30 bg-primary/5 p-3 text-xs text-muted-foreground">
            Alerts recalculate instantly using your filtered events. Daily budgets reset at midnight, weekly on Sunday, and monthly on the 1st.
          </div>
        </div>
      )}
    </div>
  );
}
