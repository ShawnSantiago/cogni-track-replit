'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { ProviderKeySummary } from '@/types/provider-keys';

interface KeyCardProps {
  providerKey: ProviderKeySummary;
  onEdit: (id: number) => void;
  onDelete: (id: number) => void;
}

const providerIcons: Record<string, string> = {
  openai: '🤖',
  anthropic: '🧠',
  google: '🔍',
  cohere: '💫',
};

export default function KeyCard({ providerKey, onEdit, onDelete }: KeyCardProps) {
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    if (!confirm('Delete this API key?')) return;
    setIsDeleting(true);
    try {
      await onDelete(providerKey.id);
    } finally {
      setIsDeleting(false);
    }
  };

  const addedAt = new Date(providerKey.createdAt).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

  const icon = providerIcons[providerKey.provider.toLowerCase()] ?? '🔑';

  return (
    <Card className="h-full shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <div className="flex items-center gap-3">
          <span className="text-2xl" aria-hidden>
            {icon}
          </span>
          <CardTitle className="text-lg capitalize">
            {providerKey.provider}
          </CardTitle>
        </div>
        <div className="flex gap-2">
          <Badge variant="outline" className="capitalize">
            {providerKey.provider}
          </Badge>
          <Badge variant={providerKey.usageMode === 'admin' ? 'secondary' : 'outline'} className="capitalize">
            {providerKey.usageMode === 'admin' ? 'Org mode' : 'Standard'}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <CardDescription className="font-mono text-sm">
          {providerKey.maskedKey ?? '••••••••'}
        </CardDescription>
        <p className="text-sm text-muted-foreground">
          Added on {addedAt}
          {providerKey.usageMode === 'admin' && (
            <>
              {' · '}
              {providerKey.hasOrgConfig ? 'Org & project configured' : 'Org config pending'}
            </>
          )}
        </p>
        <div className="flex gap-3">
          <Button variant="outline" className="flex-1" onClick={() => onEdit(providerKey.id)} disabled={isDeleting}>
            Edit
          </Button>
          <Button
            variant="destructive"
            className="flex-1"
            onClick={handleDelete}
            disabled={isDeleting}
          >
            {isDeleting ? 'Deleting…' : 'Delete'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
