import { FactRetriever } from '@backstage-community/plugin-tech-insights-node';
import { Entity } from '@backstage/catalog-model';
import { CatalogClient } from '@backstage/catalog-client';
import { GitHubCommit, GitHubPR } from './types';
import { Config } from '@backstage/config';

/**
 * Extracts a GitHub API token from Backstage configuration.
 *
 * @param config - The Backstage configuration object
 * @returns The GitHub API token if found, otherwise undefined
 */
export const getGitHubTokenFromConfig = (
  config: Config,
): string | undefined => {
  try {
    // Look for GitHub configuration in the integrations section
    const githubConfigs = config.getOptionalConfigArray('integrations.github');
    const githubConfig = githubConfigs?.[0];
    const token = githubConfig?.getOptionalString('token');

    if (!token) {
      console.error('GitHub token is not defined.');
      return undefined;
    }
    return token;
  } catch (e) {
    console.error(`Could not retrieve GitHub token: ${e}`);
    return undefined;
  }
};

/**
 * Fetches Component entities from the Backstage catalog.
 *
 * @param client - Catalog API client instance
 * @param token - Authentication token for the catalog API
 * @returns Array of Component entities or empty array if fetch fails
 */
async function fetchEntities(
  client: CatalogClient,
  token: string,
): Promise<Entity[]> {
  try {
    // Query only for Component kind entities
    const response = await client.getEntities(
      { filter: { kind: 'Component' } },
      { token },
    );
    return response.items ?? [];
  } catch (e) {
    console.error(`Failed to fetch entities from catalog: ${e}`);
    return [];
  }
}

/**
 * Fetches recent closed pull requests for a specific GitHub repository.
 *
 * @param slug - GitHub repository identifier in 'owner/repo' format
 * @param gitHubToken - GitHub API authentication token
 * @returns Array of pull request objects or empty array if fetch fails
 */
async function fetchPullRequests(
  slug: string,
  gitHubToken: string,
): Promise<GitHubPR[]> {
  // Split the slug into owner and repo name
  const [repoOwner, repoName] = slug.split('/');
  const prResponse = await fetch(
    `https://api.github.com/repos/${repoOwner}/${repoName}/pulls?state=closed&sort=updated&direction=desc&per_page=5`,
    {
      headers: {
        Authorization: `Bearer ${gitHubToken}`,
        Accept: 'application/vnd.github.v3+json',
      },
    },
  );

  if (!prResponse.ok) {
    console.error(`Failed to fetch PRs: ${prResponse.statusText}`);
    return [];
  }

  return prResponse.json();
}

/**
 * Extracts commit data from a set of pull requests.
 *
 * @param prs - Array of pull request objects
 * @param gitHubToken - GitHub API authentication token
 * @returns Object containing commit messages and total count
 */
async function getCommitData(
  prs: GitHubPR[],
  gitHubToken: string,
): Promise<{ messages: string[]; count: number }> {
  let commitCountLastWeek = 0;
  const allCommitMessages: string[] = [];

  // Process each PR to get its commits
  for (const pr of prs) {
    const commitsResponse = await fetch(pr.commits_url, {
      headers: {
        Authorization: `Bearer ${gitHubToken}`,
        Accept: 'application/vnd.github.v3+json',
      },
    });

    if (!commitsResponse.ok) continue;

    const commits: GitHubCommit[] = await commitsResponse.json();
    commitCountLastWeek += commits.length;

    // Extract first line of each commit message as a summary
    for (const commit of commits) {
      const shortMessage = commit.commit.message.split('\n')[0];
      allCommitMessages.push(shortMessage);
    }
  }

  return { messages: allCommitMessages, count: commitCountLastWeek };
}

/**
 * Filters pull requests to only include those merged within the last week
 * and excludes dependency bump PRs (which typically don't represent feature work).
 *
 * @param prs - Array of pull request objects
 * @returns Filtered array of relevant pull requests
 */
function filterRecentPRs(prs: GitHubPR[]): GitHubPR[] {
  // Calculate date from one week ago
  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

  return prs.filter(pr => {
    if (!pr.merged_at) return false; // Skip unmerged PRs
    const mergedAt = new Date(pr.merged_at);
    const isRecent = mergedAt >= oneWeekAgo; // Only include PRs from last week
    const isNotBump = !pr.title.toLowerCase().startsWith('bump'); // Filter out dependency bumps
    return isRecent && isNotBump;
  });
}

/**
 * Processes a single entity to extract GitHub commit data.
 *
 * @param entity - Backstage catalog entity to process
 * @param gitHubToken - GitHub API authentication token
 * @returns Object with entity reference and commit facts, or null if data not available
 */
async function processEntity(entity: Entity, gitHubToken: string) {
  // Get GitHub repository identifier from entity annotations
  const slug = entity.metadata.annotations?.['github.com/project-slug'];
  if (!slug) {
    console.warn(
      `No GitHub slug annotation found for entity: ${entity.metadata.name}`,
    );
    return null;
  }

  try {
    // Fetch and process PR data
    const prs = await fetchPullRequests(slug, gitHubToken);
    if (!prs.length) return null;

    const recentPRs = filterRecentPRs(prs);
    if (!recentPRs.length) return null;

    const { messages, count } = await getCommitData(recentPRs, gitHubToken);
    const lastPr = recentPRs[0]; // Most recent PR

    // Return structured facts about the entity
    return {
      entity: {
        name: entity.metadata.name,
        namespace: entity.metadata.namespace ?? 'default',
        kind: entity.kind,
      },
      facts: {
        last_commit_message: lastPr.title, // Most recent PR title
        recent_commit_messages: messages.join('\n'), // All commit messages
        commit_count_last_week: count, // Total commit count
      },
    };
  } catch (err) {
    console.error(
      `Error retrieving commit messages for ${entity.metadata.name}: ${err}`,
    );
    return null;
  }
}

/**
 * Tech Insights fact retriever implementation for GitHub commit data.
 * This retriever collects information about recent pull requests and commits
 * for components in the catalog that have associated GitHub repositories.
 */
export const createGitHubCommitMessageRetriever: FactRetriever = {
  // Unique identifier for this fact retriever
  id: 'github-commit-message-retriever',

  // Semantic version for the retriever implementation
  version: '1.0',

  // Only process entities of kind 'component'
  entityFilter: [{ kind: 'component' }],

  // Define the schema of facts this retriever produces
  schema: {
    last_commit_message: {
      type: 'string',
      description: 'The last commit message from the most recent pull request',
    },
    recent_commit_messages: {
      type: 'string',
      description: 'List of recent commit messages from merged PRs',
    },
    commit_count_last_week: {
      type: 'integer',
      description: 'Number of commits in the last week',
    },
  },

  // Main handler function that produces facts
  handler: async ctx => {
    // Get authentication token for catalog access
    const { token } = await ctx.auth.getPluginRequestToken({
      onBehalfOf: await ctx.auth.getOwnServiceCredentials(),
      targetPluginId: 'catalog',
    });

    // Initialize catalog client and fetch relevant entities
    const client = new CatalogClient({ discoveryApi: ctx.discovery });
    const entities = await fetchEntities(client, token);
    const gitHubToken = getGitHubTokenFromConfig(ctx.config);

    // Verify GitHub token is available
    if (!gitHubToken) {
      console.error(
        `GitHub token is not defined. Please check your configuration.`,
      );
      return [];
    }

    // Process all entities in parallel for better performance
    const results = await Promise.all(
      entities.map(entity => processEntity(entity, gitHubToken)),
    );

    // Filter out null results and return valid facts
    return results.filter(
      (result): result is NonNullable<typeof result> => !!result,
    );
  },
};
