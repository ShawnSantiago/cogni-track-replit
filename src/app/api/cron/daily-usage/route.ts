import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { fetchAndStoreUsageForUser } from '../../../../lib/usage-fetcher';

export async function GET(request: NextRequest) {
  try {
    // Verify this is a legitimate cron request
    const rawSecret = process.env.CRON_SECRET;
    const expectedSecret = rawSecret?.trim();
    if (!expectedSecret || expectedSecret === 'undefined' || expectedSecret === 'null') {
      console.error('CRON_SECRET is not configured or invalid. Rejecting cron request.', {
        hasEnvValue: Boolean(rawSecret),
      });
      return NextResponse.json({ error: 'Service unavailable' }, { status: 503 });
    }

    const authHeader = request.headers.get('authorization');
    const provided = authHeader?.startsWith('Bearer ')
      ? authHeader.slice('Bearer '.length).trim()
      : undefined;

    if (!provided || provided === 'undefined' || provided === 'null') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const expectedBuffer = Buffer.from(expectedSecret);
    const providedBuffer = Buffer.from(provided);
    if (
      expectedBuffer.length !== providedBuffer.length ||
      !timingSafeEqual(expectedBuffer, providedBuffer)
    ) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const flagState = (process.env.ENABLE_DAILY_USAGE_WINDOWS ?? 'false').toLowerCase() === 'true';
    console.log('Starting daily usage fetch cron job', {
      dailyWindowsEnabled: flagState,
    });

    // Import database dependencies
    const { getDb } = await import('../../../../lib/database');
    const { users } = await import('../../../../db/schema');

    // Get all users in the system
    const db = getDb();
    const allUsers = await db.select({ id: users.id }).from(users);
    
    console.log(`Found ${allUsers.length} users to process`);

    let successCount = 0;
    let errorCount = 0;
    let warningCount = 0;
    const telemetrySummary = {
      processedUsers: allUsers.length,
      processedKeys: 0,
      simulatedKeys: 0,
      failedKeys: 0,
      storedEvents: 0,
      updatedEvents: 0,
      windowsProcessed: 0,
      constraintInserts: 0,
      constraintUpdates: 0,
      manualFallbackInserts: 0,
      manualFallbackUpdates: 0,
      manualFallbackWindows: 0,
      manualFallbackKeys: 0,
      issuesByCode: new Map<string, number>(),
    };

    // Process each user
    for (const user of allUsers) {
      try {
        const telemetry = await fetchAndStoreUsageForUser(user.id, 1); // Fetch last 1 day
        successCount++;
        telemetrySummary.processedKeys += telemetry.processedKeys;
        telemetrySummary.simulatedKeys += telemetry.simulatedKeys;
        telemetrySummary.failedKeys += telemetry.failedKeys;
        telemetrySummary.storedEvents += telemetry.storedEvents;
        telemetrySummary.updatedEvents += telemetry.updatedEvents;
        telemetrySummary.windowsProcessed += telemetry.windowsProcessed;
        telemetrySummary.constraintInserts += telemetry.constraintInserts;
        telemetrySummary.constraintUpdates += telemetry.constraintUpdates;
        telemetrySummary.manualFallbackInserts += telemetry.manualFallbackInserts;
        telemetrySummary.manualFallbackUpdates += telemetry.manualFallbackUpdates;
        telemetrySummary.manualFallbackWindows += telemetry.manualFallbackWindows;
        telemetrySummary.manualFallbackKeys += telemetry.manualFallbackKeys;
        for (const issue of telemetry.issues) {
          const code = issue.code ?? 'UNKNOWN';
          const current = telemetrySummary.issuesByCode.get(code) ?? 0;
          telemetrySummary.issuesByCode.set(code, current + 1);
        }
        if (telemetry.issues.length > 0) {
          warningCount += telemetry.issues.length;
          console.warn('Usage ingestion completed with issues', { userId: user.id, telemetry });
        } else {
          console.log(`Successfully processed user ${user.id}`);
        }
      } catch (error) {
        errorCount++;
        console.error(`Error processing user ${user.id}:`, error);
      }
    }

    const issuesByCode = Object.fromEntries(telemetrySummary.issuesByCode.entries());

    const result = {
      success: true,
      processed: allUsers.length,
      successful: successCount,
      errors: errorCount,
      warningCount,
      timestamp: new Date().toISOString(),
      telemetry: {
        processedUsers: telemetrySummary.processedUsers,
        processedKeys: telemetrySummary.processedKeys,
        simulatedKeys: telemetrySummary.simulatedKeys,
        failedKeys: telemetrySummary.failedKeys,
        storedEvents: telemetrySummary.storedEvents,
        updatedEvents: telemetrySummary.updatedEvents,
        windowsProcessed: telemetrySummary.windowsProcessed,
        constraintInserts: telemetrySummary.constraintInserts,
        constraintUpdates: telemetrySummary.constraintUpdates,
        manualFallbackInserts: telemetrySummary.manualFallbackInserts,
        manualFallbackUpdates: telemetrySummary.manualFallbackUpdates,
        manualFallbackWindows: telemetrySummary.manualFallbackWindows,
        manualFallbackKeys: telemetrySummary.manualFallbackKeys,
        issuesByCode,
      },
    };

    console.log('Daily usage fetch completed:', result);
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error in daily usage cron job:', error);
    return NextResponse.json({ 
      error: 'Failed to run daily usage fetch',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}
