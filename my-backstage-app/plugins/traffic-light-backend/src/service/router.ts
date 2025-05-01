import express from 'express';
import { Config } from '@backstage/config';
import { LoggerService } from '@backstage/backend-plugin-api';

export async function createRouter({
  config,
  logger,
}: {
  config: Config;
  logger: LoggerService;
}): Promise<express.Router> {
  const router = express.Router();

  router.get('/dependabotStatus/:owner/:repo', async (req, res) => {
    const { owner, repo } = req.params;

    logger.info(`Fetching dependabot status for ${owner}/${repo}`);

    res.json({ status: Math.random() > 0.5 ? 'green' : 'red' });
  });

  return router;
}
