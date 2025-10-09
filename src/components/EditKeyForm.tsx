'use client';

import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { UsageMode } from '@/types/provider-keys';

interface UpdateKeyPayload {
  apiKey?: string;
  usageMode: UsageMode;
  organizationId?: string;
  projectId?: string;
}

interface EditKeyFormProps {
  keyId: number;
  currentProvider: string;
  currentUsageMode: UsageMode;
  hasOrgConfig: boolean;
  onUpdateKey: (keyId: number, payload: UpdateKeyPayload) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
}

export default function EditKeyForm({
  keyId,
  currentProvider,
  currentUsageMode,
  hasOrgConfig,
  onUpdateKey,
  onCancel,
  isLoading,
}: EditKeyFormProps) {
  const [apiKey, setApiKey] = useState('');
  const [usageMode, setUsageMode] = useState<UsageMode>(currentUsageMode);
  const [organizationId, setOrganizationId] = useState('');
  const [projectId, setProjectId] = useState('');
  const [error, setError] = useState('');

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

  useEffect(() => {
    if (usageMode !== 'admin') {
      setOrganizationId('');
      setProjectId('');
    }
  }, [usageMode]);

  const placeholders: Record<string, string> = {
    openai: 'sk-...',
    anthropic: 'sk-ant-...',
    google: 'AIza...',
    cohere: 'co_...',
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');

    const trimmedKey = apiKey.trim();
    const trimmedOrg = organizationId.trim();
    const trimmedProject = projectId.trim();
    const normalizedOrg = ensureOrgPrefix(trimmedOrg);
    const normalizedProject = ensureProjectPrefix(trimmedProject);

    const nextUsageMode: UsageMode = currentProvider === 'openai' ? usageMode : 'standard';
    const switchingToAdmin = nextUsageMode === 'admin';
    const hadPersistedAdminConfig = currentUsageMode === 'admin' && hasOrgConfig;

    if (switchingToAdmin) {
      const providedOrg = Boolean(normalizedOrg);
      const providedProject = Boolean(normalizedProject);

      if (!hadPersistedAdminConfig && (!providedOrg || !providedProject)) {
        setError('Organization and Project IDs are required when enabling admin mode');
        return;
      }

      if (hadPersistedAdminConfig && providedOrg !== providedProject) {
        setError('Provide both Organization and Project IDs or leave both blank to reuse the saved values');
        return;
      }
    }

    try {
      await onUpdateKey(keyId, {
        apiKey: trimmedKey || undefined,
        usageMode: nextUsageMode,
        organizationId: switchingToAdmin && normalizedOrg ? normalizedOrg : undefined,
        projectId: switchingToAdmin && normalizedProject ? normalizedProject : undefined,
      });
      setApiKey('');
      setOrganizationId('');
      setProjectId('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update API key');
    }
  };

  return (
    <Card className="shadow-sm">
      <CardHeader className="space-y-1">
        <CardTitle>Update {currentProvider.toUpperCase()} key</CardTitle>
        <CardDescription>
          Update usage settings for this provider. Provide a new API key only if you need to rotate it.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {currentProvider === 'openai' && (
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
                Admin mode pulls aggregated usage from your OpenAI organization/project.
              </p>
            </div>
          )}

          {currentProvider === 'openai' && usageMode === 'admin' && (
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
                  {hasOrgConfig
                    ? 'Leave blank to reuse the stored value; pasted values gain the `org-` prefix automatically.'
                    : 'Required when enabling admin mode. Paste the value from OpenAI; we add the `org-` prefix.'}
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
                  {hasOrgConfig
                    ? 'Leave blank to reuse the stored value.'
                    : 'Required when enabling admin mode.'}
                </p>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="apiKey">New API key</Label>
            <Input
              id="apiKey"
              type="password"
              value={apiKey}
              onChange={(event) => setApiKey(event.target.value)}
              placeholder={
                placeholders[currentProvider.toLowerCase()] ?? 'Enter your API key'
              }
              disabled={isLoading}
              autoComplete="new-password"
            />
            <p className="text-sm text-muted-foreground">
              Optional. Leave blank to keep the existing key. Keys are encrypted immediately and never stored in plain text.
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
            <Button type="submit" disabled={isLoading}>
              {isLoading ? 'Updating…' : 'Save changes'}
            </Button>
          </CardFooter>
        </form>
      </CardContent>
    </Card>
  );
}
