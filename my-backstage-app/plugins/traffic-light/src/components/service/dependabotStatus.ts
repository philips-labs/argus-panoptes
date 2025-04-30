import { Octokit } from '@octokit/rest';

const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN, // store token safely
});

export async function getDependabotStatus(owner: string, repo: string): Promise<'green' | 'yellow' | 'red'> {
  const prs = await octokit.pulls.list({
    owner,
    repo,
    state: 'open',
  });

  const dependabotPRs = prs.data.filter(pr => pr.user?.login === 'dependabot[bot]');

  if (dependabotPRs.length === 0) {
    return 'green'; // no PRs → all good
  }

  const isStale = dependabotPRs.some(pr => {
    const updatedAt = new Date(pr.updated_at);
    const diffDays = (Date.now() - updatedAt.getTime()) / (1000 * 60 * 60 * 24);
    return diffDays > 14;
  });

  return isStale ? 'red' : 'yellow';
}
