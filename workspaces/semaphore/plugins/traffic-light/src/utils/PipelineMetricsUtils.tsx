/**
 * Shared utilities for pipeline metrics dialogs
 * Reduces code duplication across semaphore dialog components
 */
import { Grid, Paper, Typography, Link } from '@material-ui/core';
import type { GridSize } from '@material-ui/core';
import { Entity } from '@backstage/catalog-model';
import { determineSemaphoreColor } from '../components/utils.ts';
import { CatalogApi } from '@backstage/plugin-catalog-react';
import { SemaphoreData } from '../components/SemaphoreDialogs/types';
import { TechInsightsApi } from '@backstage/plugin-tech-insights';

// Common styles kept as an object for reuse
export const commonStyles = {
  metricBox: {
    padding: 2,
    marginBottom: 2,
    display: 'flex',
    flexDirection: 'column',
  },
  metricValue: {
    fontWeight: 'bold',
    fontSize: '22px',
  },
  metricLabel: {
    color: 'text.secondary',
  },
  repoList: {
    marginTop: 3,
  },
  repoLink: {
    fontWeight: 500,
  },
};

// Common repository result type
export interface RepositoryResult {
  name: string;
  url: string;
  successRate: number;
  successWorkflowRunsCount: number;
  failureWorkflowRunsCount: number;
  failedCheck: boolean;
}

// Common metrics structure
export interface PipelineMetrics {
  totalSuccess: number;
  totalFailure: number;
  totalRuns: number;
  successRate: number;
}

// Configuration for system thresholds
export interface SystemConfig {
  redThreshold: number;
  configuredRepoNames: string[];
}

/**
 * Fetches system-level configuration like thresholds and repository lists
 * from the catalog entity for the system.
 *
 * @param catalogApi - Backstage catalog API client
 * @param entities - List of entities to derive the system from
 * @param thresholdAnnotationKey - Key for the threshold annotation
 * @param configRepoAnnotationKey - Key for the configured repositories annotation
 * @returns Configuration object with thresholds and included repositories
 */
export async function getSystemConfig(
  catalogApi: CatalogApi,
  entities: Entity[],
  thresholdAnnotationKey: string,
  configRepoAnnotationKey?: string,
): Promise<SystemConfig> {
  const defaultConfig: SystemConfig = {
    redThreshold: 0.33,
    configuredRepoNames: [],
  };

  if (entities.length === 0) {
    return defaultConfig;
  }

  const systemName = entities[0]?.spec?.system;
  if (typeof systemName !== 'string' || !systemName) {
    return defaultConfig;
  }

  const namespace = entities[0].metadata.namespace ?? 'default';
  const systemEntity = await catalogApi.getEntityByRef({
    kind: 'System',
    namespace,
    name: systemName,
  });

  // Get red threshold from system annotation or use default
  const thresholdAnnotation =
    systemEntity?.metadata.annotations?.[thresholdAnnotationKey];
  if (thresholdAnnotation) {
    defaultConfig.redThreshold = parseFloat(thresholdAnnotation);
  }

  // Get list of configured repositories from system annotation
  if (configRepoAnnotationKey) {
    const configuredReposAnnotation =
      systemEntity?.metadata.annotations?.[configRepoAnnotationKey];
    if (configuredReposAnnotation) {
      defaultConfig.configuredRepoNames = configuredReposAnnotation
        .split(',')
        .map(name => name.trim())
        .filter(name => name.length > 0);
    }
  }
  return defaultConfig;
}

/**
 * Aggregates repository metrics to calculate overall system metrics
 *
 * @param results - Array of repository metrics results
 * @returns Object containing aggregated metrics
 */
export function aggregateMetrics(results: RepositoryResult[]): PipelineMetrics {
  const totalSuccess = results.reduce(
    (sum, r) => sum + r.successWorkflowRunsCount,
    0,
  );
  const totalFailure = results.reduce(
    (sum, r) => sum + r.failureWorkflowRunsCount,
    0,
  );
  const totalRuns = totalSuccess + totalFailure;
  const successRate = totalRuns > 0 ? (totalSuccess / totalRuns) * 100 : 0;

  return {
    totalSuccess,
    totalFailure,
    totalRuns,
    successRate: parseFloat(successRate.toFixed(2)),
  };
}

/**
 * Determines semaphore data based on metrics and failure threshold
 *
 * @param metrics - Aggregated pipeline metrics
 * @param failures - Count of failed checks
 * @param totalEntities - Total number of entities being evaluated
 * @param redThreshold - Threshold for red status
 * @param configuredRepoCount - Optional count of configured repositories
 * @returns SemaphoreData object for display
 */
export function buildSemaphoreData(
  metrics: PipelineMetrics,
  failures: number,
  totalEntities: number,
  redThreshold: number,
  configuredRepoCount?: number,
): SemaphoreData {
  // Determine traffic light color based on filtered entities
  const { color, reason } = determineSemaphoreColor(
    failures,
    totalEntities,
    redThreshold,
  );

  // Prepare summary message
  let summary = reason;
  if (color === 'red') {
    summary += ' Critical attention required.';
  } else if (color === 'yellow') {
    summary += ' Issues should be addressed before release.';
  } else {
    summary += ' Code quality is good.';
  }

  // Add info about configured repositories
  if (configuredRepoCount !== undefined && configuredRepoCount > 0) {
    summary += ` (Based on ${configuredRepoCount} configured repositories)`;
  }

  return {
    color,
    summary,
    metrics,
    details: [],
  };
}

/**
 * Gets the lowest performing repositories by success rate
 *
 * @param results - Array of repository results
 * @param limit - Maximum number of repositories to return
 * @returns Array of repositories sorted by success rate ascending
 */
export function getLowestSuccessRepos(
  results: RepositoryResult[],
  limit: number = 5,
): { name: string; url: string; successRate: number }[] {
  return [...results]
    .sort((a, b) => a.successRate - b.successRate)
    .slice(0, limit)
    .map(({ name, url, successRate }) => ({
      name,
      url,
      successRate,
    }));
}

/**
 * Renders a standardized metrics grid for pipeline metrics
 *
 * @param metrics - Pipeline metrics to display
 * @param classes - Material UI classes for styling
 * @returns React component for metrics display
 */
export function renderMetricsGrid(metrics: PipelineMetrics, classes: any) {
  return (
    <Grid container spacing={2}>
      {[
        ['Successful Runs', metrics.totalSuccess, 4, '#4caf50'],
        ['Failed Runs', metrics.totalFailure, 4, '#f44336'],
        ['Success Rate (%)', metrics.successRate, 4, '#2196f3'],
      ].map(([label, value, size, color]) => (
        <Grid item xs={size as GridSize} key={label}>
          <Paper className={classes.metricBox} elevation={1}>
            <Typography
              variant="h4"
              className={classes.metricValue}
              style={{ color: color as string }}
            >
              {value}
            </Typography>
            <Typography className={classes.metricLabel}>{label}</Typography>
          </Paper>
        </Grid>
      ))}
    </Grid>
  );
}

/**
 * Renders a list of repositories with lowest success rates
 *
 * @param repos - Array of repositories with success rates
 * @param classes - Material UI classes for styling
 * @returns React component for repository list
 */
export function renderLowestSuccessRepos(
  repos: { name: string; url: string; successRate: number }[],
  classes: any,
) {
  if (repos.length === 0) {
    return null;
  }

  return (
    <div className={classes.repoList}>
      <Typography variant="h6">Lowest Success Rate Repositories</Typography>
      <Grid container spacing={2} className={classes.repoList}>
        {repos.map(repo => (
          <Grid item xs={12} key={repo.name}>
            <Paper className={classes.metricBox} elevation={1}>
              <Link
                href={repo.url}
                target="_blank"
                rel="noopener noreferrer"
                className={classes.metricValue}
              >
                {repo.name}
              </Link>
              <Typography className={classes.metricLabel}>
                Success Rate: {repo.successRate}%
              </Typography>
            </Paper>
          </Grid>
        ))}
      </Grid>
    </div>
  );
}

/**
 * Processes pipeline entities and generates repository results
 *
 * @param entities - Array of entities to process
 * @param getFactsFn - Function to fetch facts for an entity
 * @param getChecksFn - Function to fetch check results for an entity
 * @returns Promise resolving to array of repository results
 */
export async function processEntities(
  entities: Entity[],
  techInsightsApi: TechInsightsApi,
  getFactsFn: (api: TechInsightsApi, ref: any) => Promise<any>,
  getChecksFn: (api: TechInsightsApi, ref: any) => Promise<any>,
): Promise<RepositoryResult[]> {
  // Process each entity to collect pipeline metrics in parallel
  return Promise.all(
    entities.map(async entity => {
      const ref = {
        kind: entity.kind,
        namespace: entity.metadata.namespace ?? 'default',
        name: entity.metadata.name,
      };
      // Fetch both metrics and check results simultaneously
      const [facts, check] = await Promise.all([
        getFactsFn(techInsightsApi, ref),
        getChecksFn(techInsightsApi, ref),
      ]);

      // Calculate success rate as a percentage
      const totalRuns =
        facts.successfulRuns !== undefined
          ? facts.successfulRuns + facts.failedRuns
          : facts.successWorkflowRunsCount + facts.failureWorkflowRunsCount;

      const successCount =
        facts.successfulRuns !== undefined
          ? facts.successfulRuns
          : facts.successWorkflowRunsCount;

      const successRate = totalRuns > 0 ? (successCount / totalRuns) * 100 : 0;

      // Get GitHub actions URL from entity annotations
      const projectSlug =
        entity.metadata.annotations?.['github.com/project-slug'];
      const url = projectSlug
        ? `https://github.com/${projectSlug}/actions`
        : '#';

      // Normalize the check field name
      const failedCheck =
        check.successRateCheck === false ||
        check.pipelineSuccessRateCheck === false;

      return {
        name: entity.metadata.name,
        url,
        successRate: parseFloat(successRate.toFixed(2)),
        successWorkflowRunsCount: successCount,
        failureWorkflowRunsCount: totalRuns - successCount,
        failedCheck,
      };
    }),
  );
}

/**
 * Renders standard pipeline metrics display
 *
 * @param metrics - Pipeline metrics to display
 * @param lowestSuccessRepos - Repositories with lowest success rates
 * @param classes - Material UI classes for styling
 * @returns React component with metrics and repository list
 */
export function renderPipelineMetrics(
  metrics: PipelineMetrics,
  lowestSuccessRepos: { name: string; url: string; successRate: number }[],
  classes: any,
) {
  return (
    <>
      {renderMetricsGrid(metrics, classes)}
      {renderLowestSuccessRepos(lowestSuccessRepos, classes)}
    </>
  );
}
