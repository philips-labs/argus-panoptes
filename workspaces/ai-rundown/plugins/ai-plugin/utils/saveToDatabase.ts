import { SummaryPerRepo } from './types';

/**
 * Posts commit summaries to the database for each system
 *
 * @param data - Object mapping system names to arrays of repository summaries
 * @param date - Date string for when the summaries were generated
 * @param apiBaseUrl - Base URL for the storage API
 * @param fetchFn - Fetch function for making HTTP requests
 */
export async function postSummaries(
  data: Record<string, SummaryPerRepo[]>,
  date: string,
  apiBaseUrl: string,
  fetchFn: typeof fetch,
): Promise<void> {
  // Process each system's summaries separately
  for (const [system, summaries] of Object.entries(data)) {
    // Send summaries to API endpoint with system name and date context
    const response = await fetchFn(`${apiBaseUrl}/summaries`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        system,
        date,
        summaries,
      }),
    });

    // Handle errors silently (consider logging or throwing in production)
    if (!response.ok) {
      await response.text();
    }
  }
}
