'use client';

import React, { useState, useEffect, useMemo, useId, useRef } from 'react';

import { cn } from '@/lib/utils';

export interface UsageFilterOptions {
  dateRange: {
    start: string;
    end: string;
  };
  providers: string[];
  models: string[];
  projects: string[];
  apiKeys: string[];
  serviceTiers: string[];
}

interface AdvancedFiltersProps {
  filters: UsageFilterOptions;
  onFiltersChange: (filters: UsageFilterOptions) => void;
  availableProviders: string[];
  availableModels: string[];
  availableProjects: string[];
  availableApiKeys: string[];
  availableServiceTiers: string[];
  className?: string;
}

export default function AdvancedFilters({
  filters,
  onFiltersChange,
  availableProviders,
  availableModels,
  availableProjects,
  availableApiKeys,
  availableServiceTiers,
  className
}: AdvancedFiltersProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [draftFilters, setDraftFilters] = useState<UsageFilterOptions>(filters);
  const [actionStatus, setActionStatus] = useState<'idle' | 'applied' | 'cleared'>('idle');
  const [lastUpdatedAt, setLastUpdatedAt] = useState<number | null>(null);
  const panelId = useId();
  const headingId = `${panelId}-heading`;
  const panelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setDraftFilters(filters);
    setActionStatus('idle');
  }, [filters]);

  useEffect(() => {
    if (actionStatus === 'idle') return;

    const timer = window.setTimeout(() => {
      setActionStatus('idle');
      setLastUpdatedAt(null);
    }, 2500);

    return () => window.clearTimeout(timer);
  }, [actionStatus]);

  useEffect(() => {
    if (!isExpanded || lastUpdatedAt === null) return;

    const timer = window.setTimeout(() => {
      setIsExpanded(false);
    }, 300);

    return () => window.clearTimeout(timer);
  }, [isExpanded, lastUpdatedAt]);

  useEffect(() => {
    if (isExpanded) {
      // Move focus to the panel region when it expands
      setTimeout(() => {
        panelRef.current?.focus();
      }, 0);
    }
  }, [isExpanded]);

  const hasPendingChanges = useMemo(() => {
    const datesMatch =
      draftFilters.dateRange.start === filters.dateRange.start &&
      draftFilters.dateRange.end === filters.dateRange.end;
    const providersMatch =
      draftFilters.providers.length === filters.providers.length &&
      draftFilters.providers.every(provider => filters.providers.includes(provider));
    const modelsMatch =
      draftFilters.models.length === filters.models.length &&
      draftFilters.models.every(model => filters.models.includes(model));
    const projectsMatch =
      draftFilters.projects.length === filters.projects.length &&
      draftFilters.projects.every(project => filters.projects.includes(project));
    const apiKeysMatch =
      draftFilters.apiKeys.length === filters.apiKeys.length &&
      draftFilters.apiKeys.every(apiKey => filters.apiKeys.includes(apiKey));
    const serviceTiersMatch =
      draftFilters.serviceTiers.length === filters.serviceTiers.length &&
      draftFilters.serviceTiers.every(tier => filters.serviceTiers.includes(tier));

    return !(datesMatch && providersMatch && modelsMatch && projectsMatch && apiKeysMatch && serviceTiersMatch);
  }, [draftFilters, filters]);

  const dateError = useMemo(() => {
    const { start, end } = draftFilters.dateRange;
    if (start && end) {
      const s = new Date(start);
      const e = new Date(end);
      if (!isNaN(s.getTime()) && !isNaN(e.getTime()) && s > e) {
        return 'End date must be on or after start date.';
      }
    }
    return null;
  }, [draftFilters.dateRange]);

  const handleDateChange = (field: 'start' | 'end', value: string) => {
    setDraftFilters(prev => ({
      ...prev,
      dateRange: {
        ...prev.dateRange,
        [field]: value
      }
    }));
  };

  const handleProviderToggle = (provider: string) => {
    setDraftFilters(prev => {
      const nextProviders = prev.providers.includes(provider)
        ? prev.providers.filter(p => p !== provider)
        : [...prev.providers, provider];

      return {
        ...prev,
        providers: nextProviders
      };
    });
  };

  const handleModelToggle = (model: string) => {
    setDraftFilters(prev => {
      const nextModels = prev.models.includes(model)
        ? prev.models.filter(m => m !== model)
        : [...prev.models, model];

      return {
        ...prev,
        models: nextModels
      };
    });
  };

  const handleProjectToggle = (projectId: string) => {
    setDraftFilters(prev => {
      const nextProjects = prev.projects.includes(projectId)
        ? prev.projects.filter(project => project !== projectId)
        : [...prev.projects, projectId];

      return {
        ...prev,
        projects: nextProjects
      };
    });
  };

  const handleApiKeyToggle = (apiKeyId: string) => {
    setDraftFilters(prev => {
      const nextApiKeys = prev.apiKeys.includes(apiKeyId)
        ? prev.apiKeys.filter(key => key !== apiKeyId)
        : [...prev.apiKeys, apiKeyId];

      return {
        ...prev,
        apiKeys: nextApiKeys
      };
    });
  };

  const handleServiceTierToggle = (serviceTier: string) => {
    setDraftFilters(prev => {
      const nextServiceTiers = prev.serviceTiers.includes(serviceTier)
        ? prev.serviceTiers.filter(tier => tier !== serviceTier)
        : [...prev.serviceTiers, serviceTier];

      return {
        ...prev,
        serviceTiers: nextServiceTiers
      };
    });
  };

  const clearAllFilters = () => {
    const clearedFilters: UsageFilterOptions = {
      dateRange: {
        start: '',
        end: ''
      },
      providers: [],
      models: [],
      projects: [],
      apiKeys: [],
      serviceTiers: []
    };

    setDraftFilters(clearedFilters);
    onFiltersChange(clearedFilters);
    setActionStatus('cleared');
    setLastUpdatedAt(Date.now());
  };

  const applyFilters = () => {
    if (!hasPendingChanges) {
      setActionStatus('idle');
      return;
    }

    onFiltersChange({
      dateRange: {
        start: draftFilters.dateRange.start,
        end: draftFilters.dateRange.end
      },
      providers: [...draftFilters.providers],
      models: [...draftFilters.models],
      projects: [...draftFilters.projects],
      apiKeys: [...draftFilters.apiKeys],
      serviceTiers: [...draftFilters.serviceTiers]
    });
    setActionStatus('applied');
    setLastUpdatedAt(Date.now());
  };

  const activeFiltersCount =
    (filters.dateRange.start ? 1 : 0) +
    (filters.dateRange.end ? 1 : 0) +
    filters.providers.length +
    filters.models.length +
    filters.projects.length +
    filters.apiKeys.length +
    filters.serviceTiers.length;

  const chipBaseClasses =
    'rounded-full border px-3 py-1 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring';

  return (
    <div className={cn('rounded-lg border border-border bg-card shadow-sm', className)}>
      <button
        type="button"
        aria-expanded={isExpanded}
        aria-controls={panelId}
        id={headingId}
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex w-full items-center justify-between gap-3 rounded-t-lg px-4 py-4 text-left transition-colors hover:bg-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-medium">Advanced filters</h3>
          {activeFiltersCount > 0 && (
            <span className="inline-flex items-center rounded-full border border-primary/40 bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
              {activeFiltersCount} active
            </span>
          )}
        </div>
        <svg
          className={cn('h-5 w-5 text-muted-foreground transition-transform', isExpanded && 'rotate-180')}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      <div
        id={panelId}
        role="region"
        aria-labelledby={headingId}
        hidden={!isExpanded}
        ref={panelRef}
        tabIndex={-1}
        className="border-t border-border px-4 py-5"
      >
        {/* Date Range */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Date range</label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="flex-1">
              <label className="mb-1 block text-xs text-muted-foreground">From</label>
              <input
                type="date"
                value={draftFilters.dateRange.start}
                onChange={(e) => handleDateChange('start', e.target.value)}
                aria-invalid={Boolean(dateError)}
                aria-describedby={dateError ? `${panelId}-date-error` : undefined}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div className="flex-1">
              <label className="mb-1 block text-xs text-muted-foreground">To</label>
              <input
                type="date"
                value={draftFilters.dateRange.end}
                onChange={(e) => handleDateChange('end', e.target.value)}
                aria-invalid={Boolean(dateError)}
                aria-describedby={dateError ? `${panelId}-date-error` : undefined}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </div>
        </div>
        {dateError && (
          <p id={`${panelId}-date-error`} className="mt-2 text-sm text-destructive" role="alert">
            {dateError}
          </p>
        )}

        {/* Providers */}
        {availableProviders.length > 0 && (
          <div className="mt-6 space-y-2">
            <label className="text-sm font-medium">Providers</label>
            <div className="flex flex-wrap gap-2">
              {availableProviders.map(provider => {
                const isActive = draftFilters.providers.includes(provider);

                return (
                  <button
                    key={provider}
                    type="button"
                    onClick={() => handleProviderToggle(provider)}
                    aria-pressed={isActive}
                    className={cn(
                      chipBaseClasses,
                      isActive
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-transparent bg-muted text-muted-foreground hover:bg-muted/80'
                    )}
                  >
                    {provider.charAt(0).toUpperCase() + provider.slice(1)}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Models */}
        {availableModels.length > 0 && (
          <div className="mt-6 space-y-2">
            <label className="text-sm font-medium">Models</label>
            <div className="flex flex-wrap gap-2">
              {availableModels.slice(0, 10).map(model => {
                const isActive = draftFilters.models.includes(model);

                return (
                  <button
                    key={model}
                    type="button"
                    onClick={() => handleModelToggle(model)}
                    aria-pressed={isActive}
                    className={cn(
                      chipBaseClasses,
                      isActive
                        ? 'border-accent bg-accent text-accent-foreground'
                        : 'border-transparent bg-muted text-muted-foreground hover:bg-muted/80'
                    )}
                  >
                    {model}
                  </button>
                );
              })}
              {availableModels.length > 10 && (
                <span className="px-3 py-1 text-sm text-muted-foreground">
                  +{availableModels.length - 10} more
                </span>
              )}
            </div>
          </div>
        )}

        {availableProjects.length > 0 && (
          <div className="mt-6 space-y-2">
            <label className="text-sm font-medium">Projects</label>
            <div className="flex flex-wrap gap-2">
              {availableProjects.map(projectId => {
                const isActive = draftFilters.projects.includes(projectId);

                return (
                  <button
                    key={projectId}
                    type="button"
                    onClick={() => handleProjectToggle(projectId)}
                    aria-pressed={isActive}
                    className={cn(
                      chipBaseClasses,
                      isActive
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-transparent bg-muted text-muted-foreground hover:bg-muted/80'
                    )}
                  >
                    {projectId}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {availableApiKeys.length > 0 && (
          <div className="mt-6 space-y-2">
            <label className="text-sm font-medium">API keys</label>
            <div className="flex flex-wrap gap-2">
              {availableApiKeys.map(apiKeyId => {
                const isActive = draftFilters.apiKeys.includes(apiKeyId);

                return (
                  <button
                    key={apiKeyId}
                    type="button"
                    onClick={() => handleApiKeyToggle(apiKeyId)}
                    aria-pressed={isActive}
                    className={cn(
                      chipBaseClasses,
                      isActive
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-transparent bg-muted text-muted-foreground hover:bg-muted/80'
                    )}
                  >
                    {apiKeyId}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {availableServiceTiers.length > 0 && (
          <div className="mt-6 space-y-2">
            <label className="text-sm font-medium">Service tiers</label>
            <div className="flex flex-wrap gap-2">
              {availableServiceTiers.map(serviceTier => {
                const isActive = draftFilters.serviceTiers.includes(serviceTier);

                return (
                  <button
                    key={serviceTier}
                    type="button"
                    onClick={() => handleServiceTierToggle(serviceTier)}
                    aria-pressed={isActive}
                    className={cn(
                      chipBaseClasses,
                      isActive
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-transparent bg-muted text-muted-foreground hover:bg-muted/80'
                    )}
                  >
                    {serviceTier}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className="mt-6 border-t border-border pt-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            {activeFiltersCount > 0 ? (
              <button
                type="button"
                onClick={clearAllFilters}
                className="text-sm font-medium text-muted-foreground underline-offset-4 transition hover:text-foreground hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                Clear all filters
              </button>
            ) : (
              <span className="text-sm text-muted-foreground">No filters selected</span>
            )}
            <div className="flex flex-col gap-2 sm:items-end">
              <button
                type="button"
                onClick={applyFilters}
                disabled={!hasPendingChanges || Boolean(dateError)}
                className={cn(
                  'inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-50',
                  hasPendingChanges ? 'bg-primary text-primary-foreground hover:bg-primary/90' : 'bg-muted text-muted-foreground'
                )}
              >
                Apply filters
              </button>
              <div className="min-h-[1.25rem] text-xs text-muted-foreground" role="status" aria-live="polite" aria-atomic="true">
                {actionStatus === 'applied' && <span>Filters updated ✓</span>}
                {actionStatus === 'cleared' && <span>Filters cleared</span>}
                {actionStatus === 'idle' && !hasPendingChanges && activeFiltersCount > 0 && (
                  <span>No pending changes</span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
