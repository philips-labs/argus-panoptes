import express from 'express';
import { LoggerService, DatabaseService } from '@backstage/backend-plugin-api';
import { AISummaryStore } from './utils/aiSummaryStore';
import { SummaryPerRepo } from '@philips-labs/plugin-ai-plugin';
import { Config } from '@backstage/config';

interface RouterOptions {
  logger: LoggerService;
  database: DatabaseService;
  config: Config;
}

export async function createRouter({
  logger,
  database,
  config,
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
      return res.json(summaries);
    } catch (error) {
      logger.error(
        'Error fetching summaries:',
        error instanceof Error ? error : { error: String(error) },
      );
      return res.status(500).json({ error: 'Could not fetch summaries' });
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
  router.post('/summaries', async (req, res): Promise<void> => {
    try {
      const { system, date, summaries } = req.body;
      if (!system || !date || !Array.isArray(summaries)) {
        res.status(400).json({ error: 'Invalid request format' });
        return;
      }
      await store.saveSummaries(system, date, summaries as SummaryPerRepo[]);
      res.status(204).send();
    } catch (error) {
      logger.error(
        'Error saving summaries:',
        error instanceof Error ? error : { error: String(error) },
      );
      res.status(500).json({ error: 'Could not save summaries' });
    }
  });

  router.post('/generate', async (req, res) => {
    const prompt = req.body.prompt;
    if (!prompt) {
      return res.status(400).json({ error: 'Missing prompt' });
    }

    const geminiToken = config
      .getOptionalConfigArray('integrations.gemini')?.[0]
      ?.getOptionalString('token');
    if (!geminiToken) {
      return res.status(500).json({ error: 'Gemini token not configured' });
    }

    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiToken}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            contents: [
              {
                parts: [{ text: prompt }],
              },
            ],
          }),
        },
      );

      if (!response.ok) {
        const error = await response.json();
        console.error('Gemini error:', error);
        return res.status(500).json({ error: error.message });
      }

      const result = await response.json();
      return res.json(result);
    } catch (err) {
      console.error('Error contacting Gemini:', err);
      return res.status(500).json({ error: 'Failed to generate summary' }); // Added return here
    }
  });

  return router;
}
