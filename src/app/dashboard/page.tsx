'use client';

import React, { useEffect, useState } from 'react';
import { SafeSignedIn, useIsClerkConfigured, useSafeUser } from '@/lib/safe-clerk';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent } from '@/components/ui/card';
import KeyCard from '@/components/KeyCard';
import AddKeyForm from '@/components/AddKeyForm';
import EditKeyForm from '@/components/EditKeyForm';
import { Alert, AlertDescription } from '@/components/ui/alert';
import type { ProviderKeyListResponse, ProviderKeySummary, UsageMode } from '@/types/provider-keys';

export default function DashboardPage() {
  const { user, isLoaded } = useSafeUser();
  const clerkConfigured = useIsClerkConfigured();
  const router = useRouter();
  const [keys, setKeys] = useState<ProviderKeySummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingKey, setEditingKey] = useState<ProviderKeySummary | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [isEditing, setIsEditingState] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (clerkConfigured && isLoaded && !user) {
      router.push('/sign-in');
    }
  }, [clerkConfigured, isLoaded, user, router]);

  useEffect(() => {
    if (user) {
      void loadKeys();
    }
  }, [user]);

  const loadKeys = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/keys');
      if (!response.ok) {
        throw new Error('Failed to load API keys');
      }
      const data: ProviderKeyListResponse = await response.json();
      setKeys(data.keys || []);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load API keys');
      console.error('Error loading keys:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddKey = async (payload: {
    provider: string;
    apiKey: string;
    usageMode: UsageMode;
    organizationId?: string;
    projectId?: string;
  }) => {
    try {
      setIsAdding(true);
      const response = await fetch('/api/keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to add API key');
      }

      await loadKeys();
      setShowAddForm(false);
      setError('');
    } finally {
      setIsAdding(false);
    }
  };

  const handleEditKey = (keyId: number) => {
    const keyToEdit = keys.find((key) => key.id === keyId);
    if (keyToEdit) {
      setEditingKey(keyToEdit);
      setShowAddForm(false);
    }
  };

  const handleUpdateKey = async (
    keyId: number,
    payload: {
      apiKey?: string;
      usageMode: UsageMode;
      organizationId?: string;
      projectId?: string;
    }
  ) => {
    try {
      setIsEditingState(true);
      const response = await fetch(`/api/keys/${keyId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update API key');
      }

      await loadKeys();
      setEditingKey(null);
      setError('');
    } finally {
      setIsEditingState(false);
    }
  };

  const handleDeleteKey = async (keyId: number) => {
    try {
      const response = await fetch(`/api/keys/${keyId}`, { method: 'DELETE' });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete API key');
      }
      await loadKeys();
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete API key');
      console.error('Error deleting key:', err);
    }
  };

  if (!isLoaded) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Skeleton className="h-10 w-10 rounded-full" />
      </div>
    );
  }

  if (clerkConfigured && !user) {
    return null;
  }

  const greetingName = clerkConfigured && user?.firstName ? `, ${user.firstName}` : '';

  return (
    <SafeSignedIn>
      <main className="container space-y-10 py-10" aria-labelledby="dashboard-heading">
        <header className="space-y-2 text-center sm:text-left">
          <h1 id="dashboard-heading" className="text-3xl font-semibold tracking-tight">
            Welcome back{greetingName}.
          </h1>
          <p className="text-muted-foreground">
            Manage provider keys, trigger usage refreshes, and monitor token spend in one place.
          </p>
        </header>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <section className="space-y-4" aria-labelledby="keys-heading">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 id="keys-heading" className="text-lg font-medium">
                API keys
              </h2>
              <p className="text-sm text-muted-foreground">
                Encrypt and manage the provider credentials we use to fetch usage data.
              </p>
            </div>
            {!showAddForm && !editingKey && (
              <Button onClick={() => setShowAddForm(true)}>Add key</Button>
            )}
          </div>

          {showAddForm && (
            <AddKeyForm
              onAddKey={handleAddKey}
              onCancel={() => setShowAddForm(false)}
              isLoading={isAdding}
            />
          )}

          {editingKey && (
            <EditKeyForm
              keyId={editingKey.id}
              currentProvider={editingKey.provider}
              currentUsageMode={editingKey.usageMode ?? 'standard'}
              hasOrgConfig={Boolean(editingKey.hasOrgConfig)}
              onUpdateKey={handleUpdateKey}
              onCancel={() => setEditingKey(null)}
              isLoading={isEditing}
            />
          )}

          {isLoading ? (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {[...Array(3)].map((_, index) => (
                <Skeleton key={index} className="h-48 rounded-xl" />
              ))}
            </div>
          ) : keys.length === 0 ? (
            <Card className="bg-muted/40">
              <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
                <p className="text-sm text-muted-foreground">
                  No provider keys yet. Add your first key to start tracking usage.
                </p>
                <Button onClick={() => setShowAddForm(true)}>Add your first key</Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {keys.map((key) => (
                <KeyCard
                  key={key.id}
                  providerKey={key}
                  onEdit={handleEditKey}
                  onDelete={handleDeleteKey}
                />
              ))}
            </div>
          )}
        </section>
      </main>
    </SafeSignedIn>
  );
}
