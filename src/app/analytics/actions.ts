'use server';

import { auth } from '@clerk/nextjs/server';
import { fetchAndStoreUsageForUser } from '../../lib/usage-fetcher';
import { isMissingColumnError } from '@/lib/usage-event-helpers';

export async function refreshUsageData(daysBack: number = 7) {
  const { userId } = await auth();
  
  if (!userId) {
    throw new Error('User not authenticated');
  }

  try {
    const telemetry = await fetchAndStoreUsageForUser(userId, daysBack);
    return {
      success: true,
      message: `Usage data refreshed for ${daysBack} day(s)`,
      telemetry,
    };
  } catch (error) {
    console.error('Error refreshing usage data:', error);

    if (isMissingColumnError(error)) {
      throw new Error(
        'Daily usage metadata columns are missing in this environment. Apply migration 0003_usage_event_windows (and related schema updates) before refreshing usage data.'
      );
    }

    const message = error instanceof Error ? error.message : 'Failed to refresh usage data';
    throw new Error(message);
  }
}
