/**
 * AI Summary Storage Service
 * Handles database operations for AI-generated commit summaries
 */
import { Knex } from 'knex';
import { SummaryPerRepo } from '@philips-labs/plugin-ai-plugin';

/**
 * Database operations for AI-generated repository summaries
 */
export class AISummaryStore {
  constructor(private readonly db: Knex) {}

  /**
   * Get summaries for a specific system on a specific date
   */
  async getSummariesForToday(
    system: string,
    date: string,
  ): Promise<SummaryPerRepo[]> {
    const rows = await this.db('ai_summaries')
      .select('repo_name', 'summary')
      .where({ system, date });

    // Transform DB rows to application model
    return rows.map(row => ({
      repoName: row.repo_name,
      summary: row.summary,
    }));
  }

  /**
   * Get all summaries across all systems for a specific date
   */
  async getAllSummariesForDate(
    date: string,
  ): Promise<Record<string, SummaryPerRepo[]>> {
    const rows = await this.db('ai_summaries')
      .select('system', 'repo_name', 'summary')
      .where({ date });

    // Group summaries by system
    const result: Record<string, SummaryPerRepo[]> = {};
    for (const row of rows) {
      if (!result[row.system]) result[row.system] = [];
      result[row.system].push({
        repoName: row.repo_name,
        summary: row.summary,
      });
    }
    return result;
  }

  /**
   * Save summaries for a system, using upsert to handle duplicates
   */
  async saveSummaries(
    system: string,
    date: string,
    summaries: SummaryPerRepo[],
  ) {
    // Filter out empty summaries and format for DB insertion
    const rows = summaries
      .filter(s => s.summary && s.summary.trim() !== '') // Skip empty or whitespace-only summaries
      .map(s => ({
        system,
        repo_name: s.repoName,
        summary: s.summary,
        date,
      }));

    if (rows.length === 0) {
      return;
    }

    try {
      // Use upsert pattern to handle duplicates by merging
      await this.db('ai_summaries')
        .insert(rows)
        .onConflict(['system', 'repo_name', 'date'])
        .merge(); // Or .ignore() if preferred
    } catch (error) {
      console.error('Failed to insert summaries:', error);
      throw error;
    }
  }
}
