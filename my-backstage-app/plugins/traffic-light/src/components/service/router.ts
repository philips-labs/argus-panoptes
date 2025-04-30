import express from 'express';
import fetch from 'node-fetch'; // or use undici if you're using newer Node versions

export async function createRouter(): Promise<express.Router> {
  const router = express.Router();

  router.get('/dependabot-status', async (_req, res) => {
    const repo = 'philips-labs/dct-notary-admin'; // Replace with your repo
    const token = process.env.GITHUB_TOKEN;

    try {
      const response = await fetch(`https://api.github.com/repos/${repo}/pulls?state=open`, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github+json',
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        return res.status(response.status).json({ error: errorText });
      }

      const pulls = await response.json();
      const dependabotPRs = pulls.filter((pr: any) => pr.user?.login === 'dependabot[bot]');
      const status = dependabotPRs.length === 0 ? 'green' : 'red';

      return res.json({ status, openDependabotPRs: dependabotPRs.length });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  return router;
}
