import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { eq, and } from 'drizzle-orm';
import { getDb, schema } from '../../../../lib/database';
import { encrypt, decrypt } from '../../../../lib/encryption';
import { parseUsageMode, toIsoTimestamp } from '@/lib/provider-key-utils';
import type {
  ProviderKeyGetResponse,
  ProviderKeyMutationResponse,
  UsageMode,
} from '@/types/provider-keys';

type RouteParams = Record<string, string | string[]>;
type ProviderKeyInsert = typeof schema.providerKeys.$inferInsert;
type ProviderKeyRecord = typeof schema.providerKeys.$inferSelect;

function extractKeyId(params: RouteParams) {
  const raw = params.id;
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (!value) {
    return NaN;
  }
  return Number.parseInt(value, 10);
}

function parseOrgMetadata(key: ProviderKeyRecord): { organizationId?: string; projectId?: string } {
  if (!key.encryptedMetadata || !key.metadataIv || !key.metadataAuthTag) {
    return {};
  }

  try {
    const decrypted = decrypt({
      encryptedText: key.encryptedMetadata,
      iv: key.metadataIv,
      authTag: key.metadataAuthTag,
    });
    const parsed = JSON.parse(decrypted);
    return {
      organizationId: typeof parsed.organizationId === 'string' ? parsed.organizationId : undefined,
      projectId: typeof parsed.projectId === 'string' ? parsed.projectId : undefined,
    };
  } catch (error) {
    console.error('Failed to decrypt provider metadata', {
      keyId: key.id,
      error: error instanceof Error ? error.message : error,
    });
    return {};
  }
}

function normalizeOrgId(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return '';
  if (/^org[-_]/i.test(trimmed)) {
    return trimmed;
  }
  return `org-${trimmed}`;
}

function normalizeProjectId(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return '';
  if (/^proj[-_]/i.test(trimmed)) {
    return trimmed;
  }
  return `proj_${trimmed}`;
}

// GET /api/keys/[id] - Get a specific provider key (decrypted for display purposes only)
export async function GET(
  request: NextRequest,
  context: { params: Promise<RouteParams> }
) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const keyId = extractKeyId(await context.params);
    if (isNaN(keyId)) {
      return NextResponse.json({ error: 'Invalid key ID' }, { status: 400 });
    }

    const db = getDb();
    const [providerKey] = await db
      .select()
      .from(schema.providerKeys)
      .where(
        and(
          eq(schema.providerKeys.id, keyId),
          eq(schema.providerKeys.userId, userId)
        )
      );

    if (!providerKey) {
      return NextResponse.json({ error: 'Provider key not found' }, { status: 404 });
    }

    // For security, we'll only return the first and last 4 characters
    const decryptedKey = decrypt({
      encryptedText: providerKey.encryptedKey,
      iv: providerKey.iv,
      authTag: providerKey.authTag,
    });

    const maskedKey = decryptedKey.length > 8 
      ? `${decryptedKey.slice(0, 4)}...${decryptedKey.slice(-4)}`
      : '****';

    return NextResponse.json<ProviderKeyGetResponse>({
      key: {
        id: providerKey.id,
        provider: providerKey.provider,
        maskedKey,
        createdAt: toIsoTimestamp(providerKey.createdAt),
        usageMode: parseUsageMode(providerKey.usageMode) ?? 'standard',
        hasOrgConfig: Boolean(providerKey.encryptedMetadata && providerKey.metadataIv && providerKey.metadataAuthTag),
      }
    });
  } catch (error) {
    console.error('Error fetching provider key:', error);
    return NextResponse.json(
      { error: 'Failed to fetch provider key' },
      { status: 500 }
    );
  }
}

// PUT /api/keys/[id] - Update an existing provider key
export async function PUT(
  request: NextRequest,
  context: { params: Promise<RouteParams> }
) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const keyId = extractKeyId(await context.params);
    if (isNaN(keyId)) {
      return NextResponse.json({ error: 'Invalid key ID' }, { status: 400 });
    }

    const db = getDb();
    const body = await request.json();
    const { apiKey, usageMode, organizationId, projectId } = body;

    // Check if the key exists and belongs to the user
    const [existingKey] = await db
      .select()
      .from(schema.providerKeys)
      .where(
        and(
          eq(schema.providerKeys.id, keyId),
          eq(schema.providerKeys.userId, userId)
        )
      );

    if (!existingKey) {
      return NextResponse.json({ error: 'Provider key not found' }, { status: 404 });
    }

    const requestedUsageMode = parseUsageMode(usageMode);
    if (usageMode !== undefined && requestedUsageMode === null) {
      return NextResponse.json(
        { error: 'usageMode must be either "standard" or "admin"' },
        { status: 400 }
      );
    }

    const persistedUsageMode = parseUsageMode(existingKey.usageMode) ?? 'standard';
    const normalizedUsageMode: UsageMode = requestedUsageMode ?? persistedUsageMode;

    if (normalizedUsageMode === 'admin' && existingKey.provider !== 'openai') {
      return NextResponse.json(
        { error: 'Admin usage mode is only supported for OpenAI keys.' },
        { status: 400 }
      );
    }

    const { organizationId: existingOrgId, projectId: existingProjectId } = parseOrgMetadata(existingKey);

    const trimmedOrgId = typeof organizationId === 'string' ? organizationId.trim() : '';
    const trimmedProjectId = typeof projectId === 'string' ? projectId.trim() : '';

    const normalizedOrgId = trimmedOrgId ? normalizeOrgId(trimmedOrgId) : existingOrgId ?? '';
    const normalizedProjectId = trimmedProjectId ? normalizeProjectId(trimmedProjectId) : existingProjectId ?? '';

    const effectiveOrgId = normalizedUsageMode === 'admin' ? normalizedOrgId : null;
    const effectiveProjectId = normalizedUsageMode === 'admin' ? normalizedProjectId : null;

    if (normalizedUsageMode === 'admin' && (!effectiveOrgId || !effectiveProjectId)) {
      return NextResponse.json(
        { error: 'Organization ID and Project ID are required when using admin mode.' },
        { status: 400 }
      );
    }

    const metadataEncryption =
      normalizedUsageMode === 'admin'
        ? encrypt(
            JSON.stringify({
              organizationId: effectiveOrgId,
              projectId: effectiveProjectId,
            })
          )
        : null;

    const updatePayload: Partial<ProviderKeyInsert> = {
      usageMode: normalizedUsageMode,
      encryptedMetadata: metadataEncryption?.encryptedText ?? null,
      metadataIv: metadataEncryption?.iv ?? null,
      metadataAuthTag: metadataEncryption?.authTag ?? null,
    };

    const trimmedApiKey = typeof apiKey === 'string' ? apiKey.trim() : '';

    if (trimmedApiKey) {
      const encryptedData = encrypt(trimmedApiKey);
      updatePayload.encryptedKey = encryptedData.encryptedText;
      updatePayload.iv = encryptedData.iv;
      updatePayload.authTag = encryptedData.authTag;
    }

    const [updatedKey] = await db
      .update(schema.providerKeys)
      .set(updatePayload)
      .where(
        and(
          eq(schema.providerKeys.id, keyId),
          eq(schema.providerKeys.userId, userId)
        )
      )
      .returning();

    if (!updatedKey) {
      return NextResponse.json({ error: 'Failed to update provider key' }, { status: 500 });
    }

    const message = trimmedApiKey ? 'API key updated successfully' : 'Provider key settings updated successfully';

    return NextResponse.json<ProviderKeyMutationResponse>({ 
      key: {
        id: updatedKey.id,
        provider: updatedKey.provider,
        createdAt: toIsoTimestamp(updatedKey.createdAt),
        usageMode: normalizedUsageMode,
        hasOrgConfig: normalizedUsageMode === 'admin',
      },
      message,
    });
  } catch (error) {
    console.error('Error updating provider key:', error);
    return NextResponse.json(
      { error: 'Failed to update provider key' },
      { status: 500 }
    );
  }
}

// DELETE /api/keys/[id] - Delete a provider key
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<RouteParams> }
) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const keyId = extractKeyId(await context.params);
    if (isNaN(keyId)) {
      return NextResponse.json({ error: 'Invalid key ID' }, { status: 400 });
    }

    const db = getDb();
    // Check if the key exists and belongs to the user
    const [existingKey] = await db
      .select()
      .from(schema.providerKeys)
      .where(
        and(
          eq(schema.providerKeys.id, keyId),
          eq(schema.providerKeys.userId, userId)
        )
      );

    if (!existingKey) {
      return NextResponse.json({ error: 'Provider key not found' }, { status: 404 });
    }

    // Delete the key (usage events will be cascade deleted)
    await db
      .delete(schema.providerKeys)
      .where(
        and(
          eq(schema.providerKeys.id, keyId),
          eq(schema.providerKeys.userId, userId)
        )
      );

    return NextResponse.json({ 
      message: 'API key deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting provider key:', error);
    return NextResponse.json(
      { error: 'Failed to delete provider key' },
      { status: 500 }
    );
  }
}
