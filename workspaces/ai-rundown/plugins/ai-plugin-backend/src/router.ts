import express from 'express';
import { LoggerService } from '@backstage/backend-plugin-api';
import { PluginDatabaseManager } from '@backstage/backend-common';
import { AISummaryStore } from './utils/aiSummaryStore';
//import { SummaryPerRepo } from '@internal/plugin-ai-plugin/utils/types';

interface RouterOptions {
  logger: LoggerService;
  database: PluginDatabaseManager;
}

export interface SummaryPerRepo {
  repoName: string;
  summary: string;
}

export async function createRouter({
  logger,
  database,
}: RouterOptions): Promise<express.Router> {
  const router = express.Router();
  router.use(express.json());

  const db = await database.getClient();
  const store = new AISummaryStore(db);

  /**
   * GET /summaries - fetch all summaries for today
   */
  router.get('/summaries', async (req, res) => {
    const requestedDate = req.query.date as string;

    if (!requestedDate) {
      return res
        .status(400)
        .json({ error: 'Missing required "date" query param' });
    }

    try {
      const summaries = await store.getAllSummariesForDate(requestedDate);
      res.json(summaries);
    } catch (error) {
      logger.error('Error fetching summaries:');
      res.status(500).json({ error: 'Could not fetch summaries' });
    }
  });

  /**
   * POST /summaries - receive and store summaries
   * Expected format:
   * {
   *   system: "foo",
   *   date: "2025-05-13",
   *   summaries: [{ repoName: "repo-a", summary: "..." }, ...]
   * }
   */
  router.post('/summaries', async (req, res) => {
    try {
      console.log('Received POST body:', req.body);
      const { system, date, summaries } = req.body;

      if (!system || !date || !Array.isArray(summaries)) {
        return res.status(400).json({ error: 'Invalid request format' });
      }

      await store.saveSummaries(system, date, summaries as SummaryPerRepo[]);
      res.status(204).send();
    } catch (error) {
      logger.error('Error saving summaries:');
      res.status(500).json({ error: 'Could not save summaries' });
    }
  });

  return router;
}
