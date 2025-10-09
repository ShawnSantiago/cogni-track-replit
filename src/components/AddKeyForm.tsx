'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import type { UsageMode } from '@/types/provider-keys';

interface AddKeyPayload {
  provider: string;
  apiKey: string;
  usageMode: UsageMode;
  organizationId?: string;
  projectId?: string;
}

interface AddKeyFormProps {
  onAddKey: (payload: AddKeyPayload) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
}

export default function AddKeyForm({ onAddKey, onCancel, isLoading }: AddKeyFormProps) {
  const [provider, setProvider] = useState('openai');
  const [apiKey, setApiKey] = useState('');
  const [usageMode, setUsageMode] = useState<UsageMode>('standard');
  const [organizationId, setOrganizationId] = useState('');
  const [projectId, setProjectId] = useState('');
  const [error, setError] = useState('');

  const providers = [
    { value: 'openai', label: 'OpenAI', placeholder: 'sk-...' },
    { value: 'anthropic', label: 'Anthropic', placeholder: 'sk-ant-...' },
    { value: 'google', label: 'Google', placeholder: 'AIza...' },
    { value: 'cohere', label: 'Cohere', placeholder: 'co_...' },
  ];

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');

    const trimmedKey = apiKey.trim();
    if (!trimmedKey) {
      setError('API key is required');
      return;
    }

    const trimmedOrg = organizationId.trim();
    const trimmedProject = projectId.trim();
    const normalizedOrg = ensureOrgPrefix(trimmedOrg);
    const normalizedProject = ensureProjectPrefix(trimmedProject);

    if (provider === 'openai' && usageMode === 'admin' && (!normalizedOrg || !normalizedProject)) {
      setError('Organization and Project IDs are required for admin mode');
      return;
    }

    try {
      await onAddKey({
        provider,
        apiKey: trimmedKey,
        usageMode: provider === 'openai' ? usageMode : 'standard',
        organizationId: provider === 'openai' && usageMode === 'admin' ? normalizedOrg : undefined,
        projectId: provider === 'openai' && usageMode === 'admin' ? normalizedProject : undefined,
      });
      setApiKey('');
      setProvider('openai');
      setUsageMode('standard');
      setOrganizationId('');
      setProjectId('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add API key');
    }
  };

  const handleProviderChange = (value: string) => {
    setProvider(value);
    if (value !== 'openai') {
      setUsageMode('standard');
      setOrganizationId('');
      setProjectId('');
    }
  };

  return (
    <Card className="shadow-sm">
      <CardHeader className="space-y-1">
        <CardTitle>Add new API key</CardTitle>
        <CardDescription>
          Securely store your LLM provider keys. Keys are encrypted before being saved.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="provider">Provider</Label>
            <Select value={provider} onValueChange={handleProviderChange} disabled={isLoading}>
              <SelectTrigger id="provider">
                <SelectValue placeholder="Select a provider" />
              </SelectTrigger>
              <SelectContent>
                {providers.map((p) => (
                  <SelectItem key={p.value} value={p.value}>
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {provider === 'openai' && (
            <div className="space-y-2">
              <Label htmlFor="usageMode">Usage mode</Label>
              <Select value={usageMode} onValueChange={(value) => setUsageMode(value as UsageMode)} disabled={isLoading}>
                <SelectTrigger id="usageMode">
                  <SelectValue placeholder="Select usage mode" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="standard">Standard (per-key usage)</SelectItem>
                  <SelectItem value="admin">Org admin (requires org/project IDs)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-sm text-muted-foreground">
                Admin mode pulls usage from your OpenAI organization/project. Only choose this if you want org-level billing data.
              </p>
            </div>
          )}

          {provider === 'openai' && usageMode === 'admin' && (
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="organizationId">Organization ID</Label>
                <Input
                  id="organizationId"
                  value={organizationId}
                  onChange={(event) => setOrganizationId(event.target.value)}
                  onBlur={() => setOrganizationId((prev) => ensureOrgPrefix(prev))}
                  placeholder="org-..."
                  disabled={isLoading}
                />
                <p className="text-sm text-muted-foreground">
                  Paste the value from OpenAI; we’ll add the `org-` prefix automatically.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="projectId">Project ID</Label>
                <Input
                  id="projectId"
                  value={projectId}
                  onChange={(event) => setProjectId(event.target.value)}
                  onBlur={() => setProjectId((prev) => ensureProjectPrefix(prev))}
                  placeholder="proj_..."
                  disabled={isLoading}
                />
                <p className="text-sm text-muted-foreground">
                  Required to scope usage to the correct OpenAI project.
                </p>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="apiKey">API key</Label>
            <Input
              id="apiKey"
              type="password"
              value={apiKey}
              onChange={(event) => setApiKey(event.target.value)}
              placeholder={
                providers.find((p) => p.value === provider)?.placeholder ?? 'Enter your API key'
              }
              disabled={isLoading}
              autoComplete="new-password"
            />
            <p className="text-sm text-muted-foreground">
              Your key is encrypted at rest. We never store plain text keys.
            </p>
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <CardFooter className="flex justify-end gap-3 px-0">
            <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading || !apiKey.trim()}>
              {isLoading ? 'Adding…' : 'Add API key'}
            </Button>
          </CardFooter>
        </form>
      </CardContent>
    </Card>
  );
}
  const ensureOrgPrefix = (value: string): string => {
    const trimmed = value.trim();
    if (!trimmed) return '';
    if (/^org[-_]/i.test(trimmed)) {
      return trimmed;
    }
    return `org-${trimmed}`;
  };

  const ensureProjectPrefix = (value: string): string => {
    const trimmed = value.trim();
    if (!trimmed) return '';
    if (/^proj[-_]/i.test(trimmed)) {
      return trimmed;
    }
    return `proj_${trimmed}`;
  };
