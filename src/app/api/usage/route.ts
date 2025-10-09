import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { fetchAndStoreUsageForUser } from '../../../lib/usage-fetcher';

export async function POST(request: NextRequest) {
  try {
    // Get the authenticated user
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse request body for optional parameters
    const body = await request.json().catch(() => ({}));
    const daysBack = body.daysBack || 1; // Default to 1 day

    // Validate daysBack parameter
    if (typeof daysBack !== 'number' || daysBack < 1 || daysBack > 30) {
      return NextResponse.json({ 
        error: 'daysBack must be a number between 1 and 30' 
      }, { status: 400 });
    }

    // Fetch and store usage data
    const telemetry = await fetchAndStoreUsageForUser(userId, daysBack);

    return NextResponse.json({ 
      success: true, 
      message: `Usage data fetched for ${daysBack} day(s)`,
      telemetry,
    });
  } catch (error) {
    console.error('Error fetching usage data:', error);
    const message = error instanceof Error ? error.message : 'Failed to fetch usage data';
    return NextResponse.json({ 
      error: message 
    }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    // Get the authenticated user
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '100'), 1000);
    const offset = Math.max(parseInt(searchParams.get('offset') || '0'), 0);

    // Import database dependencies
    const { getDb } = await import('../../../lib/database');
    const { usageEvents, providerKeys } = await import('../../../db/schema');
    const { eq, desc } = await import('drizzle-orm');
    const {
      BASE_USAGE_EVENT_SELECTION,
      METADATA_USAGE_EVENT_SELECTION,
      isMissingColumnError,
      mapDbRowToUsageEvent,
    } = await import('../../../lib/usage-event-helpers');

    // Fetch usage events for the user
    const db = getDb();
    const buildSelection = (includeMetadata: boolean) =>
      includeMetadata
        ? { ...BASE_USAGE_EVENT_SELECTION, ...METADATA_USAGE_EVENT_SELECTION }
        : { ...BASE_USAGE_EVENT_SELECTION };

    const fetchEvents = (includeMetadata: boolean) =>
      db
        .select(buildSelection(includeMetadata))
        .from(usageEvents)
        .innerJoin(providerKeys, eq(usageEvents.keyId, providerKeys.id))
        .where(eq(providerKeys.userId, userId))
        .orderBy(desc(usageEvents.timestamp))
        .limit(limit)
        .offset(offset);

    try {
      const events = await fetchEvents(true);
      const serializedEvents = (events as any[]).map(mapDbRowToUsageEvent);
      return NextResponse.json({ events: serializedEvents });
    } catch (queryError) {
      if (isMissingColumnError(queryError)) {
        console.warn('[api/usage] metadata columns missing – falling back to legacy selection');
        const legacyEvents = await fetchEvents(false);
        const serializedEvents = (legacyEvents as any[]).map(mapDbRowToUsageEvent);
        return NextResponse.json({ events: serializedEvents });
      }

      throw queryError;
    }
  } catch (error) {
    console.error('Error fetching usage events:', error);
    return NextResponse.json({ 
      error: 'Failed to fetch usage events' 
    }, { status: 500 });
  }
}
