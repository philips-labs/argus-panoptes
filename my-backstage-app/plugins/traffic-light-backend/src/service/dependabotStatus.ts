import { Octokit } from '@octokit/rest';
import { Config } from '@backstage/config';
import { LoggerService } from '@backstage/backend-plugin-api';

//gets dependabot status of the repo using the github token defined
export async function getDependabotStatus(
  //owner is github user
  owner: string,
  //the repo name
  repo: string,
  //backstage config object to access configurations like secrets or endpoints
  config: Config,
  //logs important info and errors
  logger: LoggerService
): Promise<'green' | 'yellow' | 'red'|'orange'> {
  //reads the github token from app-config.yaml
  const githubToken = config.getString('integrations.github[0].token');

  //creates the octokit instance authenticating it with the github token from the environment vars
  const octokit = new Octokit({ auth: githubToken});

  try {
    //fetches all open pull requests for the given owner and repo
    const prs = await octokit.pulls.list({ owner, repo, state: 'open' });

    //filters all PRs to only those opened by dependabot bot
    const dependabotPRs = prs.data.filter(pr => pr.user?.login === 'dependabot[bot]');

    //if no dependabotPRs are present then return green light
    if (dependabotPRs.length === 0) return 'green';

    //for each dependabotPR, get the latest update time, how many days ago that was and return true if it was more than 14 days ago (stale)
    const isStale = dependabotPRs.some(pr => {
      const updatedAt = new Date(pr.updated_at);
      const diffDays = (Date.now() - updatedAt.getTime()) / (1000 * 60 * 60 * 24);
      return diffDays > 14;
    });

    return 'orange';
    //if atleast one PR is stale 
    //return isStale ? 'red' : 'yellow';
  } catch (err) {
    //error handling , log the error and reutrn red if there is an error
    logger.error('Failed to fetch Dependabot PRs:',  err as Error);
    return 'red';
  }
}
