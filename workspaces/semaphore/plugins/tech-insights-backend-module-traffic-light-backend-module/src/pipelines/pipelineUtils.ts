/**
 * Shared utilities for GitHub pipeline metrics retrievers
 * This module contains common types and functions used across different
 * pipeline fact retrievers to reduce code duplication.
 */
import { TechInsightFact } from '@backstage-community/plugin-tech-insights-node';
import { CatalogClient } from '@backstage/catalog-client';
import { JsonObject } from '@backstage/types';
import { Entity } from '@backstage/catalog-model';
import { LoggerService } from '@backstage/backend-plugin-api';
import { Config } from '@backstage/config';

// Common types used across pipeline retrievers
export type WorkflowRun = {
  name: string;
  status: string;
  conclusion: string | null;
  created_at: string;
  head_branch: string;
  workflow_id: number;
};

export type WorkflowDefinition = {
  id: number;
  name: string;
  path: string;
};

export type WorkflowMetrics = {
  name: string;
  totalRuns: number;
  successRuns: number;
  failureRuns: number;
  successRate: number;
};

export interface WorkflowLastRunMetrics extends JsonObject {
  workflowName: string;
  lastRunStatus: 'success' | 'failure' | 'unknown';
  lastRunDate: string;
}

export interface PipelineStatusSummary extends JsonObject {
  totalWorkflowRunsCount: number;
  uniqueWorkflowsCount: number;
  successWorkflowRunsCount: number;
  failureWorkflowRunsCount: number;
  successRate: number;
}

export interface ReportingPipelineStatusSummary extends JsonObject {
  workflowMetrics: WorkflowLastRunMetrics[];
  totalIncludedWorkflows: number;
  successfulRuns: number;
  failedRuns: number;
  successRate: number;
}

export interface FoundationPipelineStatusSummary extends PipelineStatusSummary {
  workflowMetrics: Record<string, WorkflowMetrics>;
}

export interface PipelineFactRetrieverContext {
  config: Config;
  entityFilter: Array<Record<string, string>>;
  auth: {
    getPluginRequestToken: (options: {
      onBehalfOf: any;
      targetPluginId: string;
    }) => Promise<{ token: string }>;
    getOwnServiceCredentials: () => Promise<any>;
  };
  discovery: { getBaseUrl: (pluginId: string) => Promise<string> };
  logger: LoggerService;
}

/**
 * Extracts GitHub token from Backstage configuration
 */
export function getGitHubToken(config: Config): string | undefined {
  try {
    const githubConfigs = config.getOptionalConfigArray('integrations.github');
    const githubConfig = githubConfigs?.[0];
    return githubConfig?.getOptionalString('token');
  } catch {
    return undefined;
  }
}

/**
 * Helper function to fetch all workflow definitions for a repository
 */
export async function fetchWorkflowDefinitions(
  owner: string,
  repoName: string,
  headers: Record<string, string>,
  logger: LoggerService,
): Promise<WorkflowDefinition[]> {
  const workflowsApiUrl = `https://api.github.com/repos/${owner}/${repoName}/actions/workflows`;
  try {
    const workflowsResponse = await fetch(workflowsApiUrl, { headers });
    if (workflowsResponse.ok) {
      const workflowsData = await workflowsResponse.json();
      return workflowsData.workflows ?? [];
    }
  } catch (error) {
    if (error instanceof Error) {
      logger.warn(
        `Failed to fetch workflow definitions for ${owner}/${repoName}:`,
        error,
      );
    } else {
      logger.warn(
        `Failed to fetch workflow definitions for ${owner}/${repoName}: An unknown error occurred.`,
      );
    }
  }
  return [];
}

/**
 * Helper function to fetch all workflow runs using pagination
 */
export async function fetchAllWorkflowRuns(
  owner: string,
  repoName: string,
  headers: Record<string, string>,
  branch: string = 'main',
): Promise<WorkflowRun[]> {
  const allRuns: WorkflowRun[] = [];
  const apiUrl = `https://api.github.com/repos/${owner}/${repoName}/actions/runs?branch=${branch}&per_page=100`;
  let page = 1;
  const maxPages = 30; // Limit to avoid excessive API calls

  while (page <= maxPages) {
    const pageUrl = `${apiUrl}&page=${page}`;
    const response = await fetch(pageUrl, { method: 'GET', headers });

    if (!response.ok) break;

    const data = await response.json();
    const pageRuns = (data.workflow_runs ?? []) as WorkflowRun[];
    allRuns.push(...pageRuns);

    const linkHeader = response.headers.get('Link');
    if (pageRuns.length < 100 || !linkHeader?.includes('rel="next"')) {
      break;
    }
    page++;
  }

  return allRuns.filter(run => run.head_branch === branch);
}

/**
 * Helper function to fetch the last run for a given workflow
 */
export async function fetchLastRun(
  owner: string,
  repoName: string,
  workflowId: number,
  branch: string,
  headers: Record<string, string>,
): Promise<WorkflowRun | null> {
  const url = `https://api.github.com/repos/${owner}/${repoName}/actions/workflows/${workflowId}/runs?branch=${branch}&per_page=1`;
  const response = await fetch(url, { headers });
  if (!response.ok) {
    return null;
  }
  const data = await response.json();
  return data.workflow_runs?.[0] ?? null;
}

/**
 * Creates standard GitHub API headers with authentication token if available
 */
export function createGitHubHeaders(token?: string): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github.v3+json',
  };

  if (token) {
    headers.Authorization = `token ${token}`;
  }

  return headers;
}

/**
 * Extracts GitHub repository information from entity annotations
 */
export function getRepositoryInfo(
  entity: Entity,
): { owner: string; repoName: string } | null {
  const projectSlug =
    entity.metadata.annotations?.['github.com/project-slug'] ?? '';
  const [owner, repoName] = projectSlug.split('/');

  if (!owner || !repoName) {
    return null;
  }

  return { owner, repoName };
}

/**
 * Filters entities to only include those with GitHub repository information
 */
export function filterGitHubEntities(entities: Entity[]): Entity[] {
  return entities.filter(entity => {
    const slug = entity.metadata.annotations?.['github.com/project-slug'];
    return !!slug;
  });
}

/**
 * Shared pipeline fact retriever handler implementation
 * Handles common logic across different pipeline retrievers
 */
export async function createPipelineFactRetrieverHandler<T extends JsonObject>(
  ctx: PipelineFactRetrieverContext,
  processEntity: (entity: Entity, token?: string) => Promise<T | null>,
): Promise<TechInsightFact[]> {
  const token = getGitHubToken(ctx.config);

  // Get catalog access token for fetching entities
  const { token: catalogToken } = await ctx.auth.getPluginRequestToken({
    onBehalfOf: await ctx.auth.getOwnServiceCredentials(),
    targetPluginId: 'catalog',
  });

  const catalogClient = new CatalogClient({ discoveryApi: ctx.discovery });

  // Fetch entities matching the provided filter
  const { items: entities } = await catalogClient.getEntities(
    { filter: ctx.entityFilter },
    { token: catalogToken },
  );

  // Filter entities with GitHub repositories
  const githubEntities = filterGitHubEntities(entities);

  // Process each entity and collect results
  const results = await Promise.all(
    githubEntities.map(async entity => {
      try {
        const facts = await processEntity(entity, token);

        if (!facts) {
          return null;
        }

        return {
          entity: {
            kind: entity.kind,
            namespace: entity.metadata.namespace ?? 'default',
            name: entity.metadata.name,
          },
          facts,
        } as TechInsightFact;
      } catch {
        return null;
      }
    }),
  );

  // Filter out null results
  return results.filter((r): r is TechInsightFact => r !== null);
}
