import { SummaryPerRepo } from './types';

export async function postSummaries(
  data: Record<string, SummaryPerRepo[]>,
  date: string,
  apiBaseUrl: string,
  fetchFn: typeof fetch,
): Promise<void> {
  for (const [system, summaries] of Object.entries(data)) {
    try {
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

      if (response.ok) {
        console.log(`✅ POST success for system '${system}'`);
      } else {
        const errorText = await response.text();
        console.error(
          `❌ POST failed for '${system}': ${response.status}`,
          errorText,
        );
      }
    } catch (err) {
      console.error(`❌ POST threw error for '${system}':`, err);
    }
  }
}
