import { FactRetriever } from '@backstage-community/plugin-tech-insights-node';
import { Entity } from '@backstage/catalog-model';
import { CatalogClient } from '@backstage/catalog-client';
import { GitHubCommit, GitHubPR } from './types';
import { Config } from '@backstage/config';

export const getGitHubTokenFromConfig = (
  config: Config,
): string | undefined => {
  try {
    const githubConfigs = config.getOptionalConfigArray('integrations.github');
    const githubConfig = githubConfigs?.[0];
    const token = githubConfig?.getOptionalString('token');

    if (!token) {
      console.error('❌ GitHub token is not defined.');
      return undefined;
    }

    console.info(`🔍 Retrieved GitHub token: ${token ? '✔️ Present' : '❌ Missing'}`);
    return token;
  } catch (e) {
    console.error(`❌ Could not retrieve GitHub token: ${e}`);
    return undefined;
  }
};

export const createGitHubCommitMessageRetriever: FactRetriever = {
  id: 'github-commit-message-retriever',
  version: '1.0',
  entityFilter: [{ kind: 'component' }],
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
  handler: async ctx => {
    const { token } = await ctx.auth.getPluginRequestToken({
      onBehalfOf: await ctx.auth.getOwnServiceCredentials(),
      targetPluginId: 'catalog',
    });
    const client = new CatalogClient({ discoveryApi: ctx.discovery });

    let entities: Entity[] = [];

    try {
      const response = await client.getEntities(
        { filter: { kind: 'Component' } },
        { token },
      );
      entities = response.items ?? [];
      console.info(
        `Fetched ${entities.length} component entities from catalog`,
      );
    } catch (e) {
      console.error(`Failed to fetch entities from catalog: ${e}`);
      return [];
    }

    const results = [];
    const gitHubtoken = getGitHubTokenFromConfig(ctx.config);

    for (const entity of entities) {
      const slug = entity.metadata.annotations?.['github.com/project-slug'];
      if (!slug) {
        console.warn(
          `No GitHub slug annotation found for entity: ${entity.metadata.name}`,
        );
        continue;
      }

      if (!token) {
        console.error(
          `GitHub token is not defined. Please check your configuration.`,
        );
        return [];
      }

      const [repoOwner, repoName] = slug.split('/');
      try {
        const prResponse = await fetch(
          `https://api.github.com/repos/${repoOwner}/${repoName}/pulls?state=closed&sort=updated&direction=desc&per_page=5`,
          {
            headers: {
              // Replace this with secure token injection from config or secrets
              Authorization: `Bearer ${gitHubtoken}`,
              Accept: 'application/vnd.github.v3+json',
            },
          },
        );

        if (!prResponse.ok) {
          console.error(`Failed to fetch PRs: ${prResponse.statusText}`);
          continue;
        }

        const prs: GitHubPR[] = await prResponse.json();
        console.info(
          `Fetched ${prs.length} PRs for ${entity.metadata.name}`,);
        if (!prs.length) continue;

        //const now = new Date();
        //const oneDayAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        // const oneDayAgo = new Date(0);

        const recentPRs = prs.filter(pr => {
          if (!pr.merged_at) return false;
          //const mergedAt = new Date(pr.merged_at);
          return true;
        });

        console.info(
          `Found ${recentPRs.length} recent PRs for ${entity.metadata.name}`,
        );
        if (recentPRs.length) {
          const lastPr = recentPRs[0];
          const prTitle = lastPr.title;

          let allCommitMessages: string[] = [];
          let commitCountLastWeek = 0;
          const oneWeekAgo = new Date();
          oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

          for (const pr of recentPRs) {
            console.info(`Fetching commits for PR: ${pr.number}`);
            const commitsResponse = await fetch(pr.commits_url, {
              headers: {
                Authorization: `Bearer ${gitHubtoken}`,
                Accept: 'application/vnd.github.v3+json',
              },
            });

            if (!commitsResponse.ok) continue;

            const commits: GitHubCommit[] = await commitsResponse.json();

            const recentCommits = commits.filter(commit => {
              //const commitDate = new Date(commit.commit.author.date);
              return true;
            });

            commitCountLastWeek += recentCommits.length;

            for (const commit of commits) {
              const shortMessage = commit.commit.message.split('\n')[0];
              allCommitMessages.push(shortMessage);
            }
          }

          const recentCommitMessages = allCommitMessages.join('\n');

          results.push({
            entity: {
              name: entity.metadata.name,
              namespace: entity.metadata.namespace ?? 'default',
              kind: entity.kind,
            },
            facts: {
              last_commit_message: prTitle,
              recent_commit_messages: recentCommitMessages,
              commit_count_last_week: commitCountLastWeek,
            },
          });
        }
      } catch (err) {
        console.error(
          `Error retrieving commit messages for ${entity.metadata.name}: ${err}`,
        );
      }
    }

    return results;
  },
};
