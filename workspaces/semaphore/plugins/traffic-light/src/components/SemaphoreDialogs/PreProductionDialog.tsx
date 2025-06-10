import React from 'react';
import { Grid, Paper, Typography, Link } from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles';
import { useApi } from '@backstage/core-plugin-api';
import { techInsightsApiRef } from '@backstage/plugin-tech-insights';
import { catalogApiRef } from '@backstage/plugin-catalog-react';
import { Entity } from '@backstage/catalog-model';
import { BaseSemaphoreDialog } from './BaseSemaphoreDialogs';
import { PreproductionUtils } from '../../utils/preproductionUtils';
import type { GridSize } from '@material-ui/core';
import { SemaphoreData } from './types';
import { determineSemaphoreColor } from '../utils';

const useStyles = makeStyles(theme => ({
  metricBox: {
    padding: theme.spacing(2),
    marginBottom: theme.spacing(2),
    display: 'flex',
    flexDirection: 'column',
  },
  metricValue: {
    fontWeight: 'bold',
    fontSize: '22px',
  },
  metricLabel: {
    color: theme.palette.text.secondary,
  },
  repoList: {
    marginTop: theme.spacing(3),
  },
  repoLink: {
    fontWeight: 500,
  },
}));

interface PreproductionSemaphoreDialogProps {
  open: boolean;
  onClose: () => void;
  entities?: Entity[];
}

export const PreproductionSemaphoreDialog: React.FC<
  PreproductionSemaphoreDialogProps
> = ({ open, onClose, entities = [] }) => {
  const classes = useStyles();
  const techInsightsApi = useApi(techInsightsApiRef);
  const catalogApi = useApi(catalogApiRef);
  const preprodUtils = React.useMemo(() => new PreproductionUtils(), []);

  const [isLoading, setIsLoading] = React.useState(false);
  const [metrics, setMetrics] = React.useState({
    totalSuccess: 0,
    totalFailure: 0,
    totalRuns: 0,
    successRate: 0,
  });

  const [lowestSuccessRepos, setLowestSuccessRepos] = React.useState<
    { name: string; url: string; successRate: number }[]
  >([]);

  const [data, setData] = React.useState<SemaphoreData>({
    color: 'gray',
    metrics: {},
    summary: 'No data available for this metric.',
    details: [],
  });

  React.useEffect(() => {
    if (!open || entities.length === 0) return;

    setIsLoading(true);

    const fetchPipelineMetrics = async () => {
      try {
        // 1. Get threshold and configured repositories from system annotations
        let redThreshold = 0.33;
        let configuredRepoNames: string[] = [];

        try {
          const systemName = entities[0].spec?.system;
          const namespace = entities[0].metadata.namespace || 'default';

          if (systemName) {
            const systemEntity = await catalogApi.getEntityByRef({
              kind: 'System',
              namespace,
              name:
                typeof systemName === 'string'
                  ? systemName
                  : String(systemName),
            });

            const thresholdAnnotation =
              systemEntity?.metadata.annotations?.[
                'preproduction-check-threshold-red'
              ];
            if (thresholdAnnotation) {
              redThreshold = parseFloat(thresholdAnnotation);
            }

            // Get configured repositories for preproduction checks
            const configuredReposAnnotation =
              systemEntity?.metadata.annotations?.[
                'preproduction-configured-repositories'
              ];
            if (configuredReposAnnotation) {
              configuredRepoNames = configuredReposAnnotation
                .split(',')
                .map(name => name.trim())
                .filter(name => name.length > 0);
            }
          }
        } catch (err) {
          console.warn('Failed to get system configuration, using defaults');
        }

        // 2. Filter entities to only include configured repositories
        const filteredEntities =
          configuredRepoNames.length > 0
            ? entities.filter(entity =>
                configuredRepoNames.includes(entity.metadata.name),
              )
            : entities; // Fallback to all entities if no configuration found

        if (filteredEntities.length === 0) {
          setMetrics({
            totalSuccess: 0,
            totalFailure: 0,
            totalRuns: 0,
            successRate: 0,
          });
          setLowestSuccessRepos([]);
          setData({
            color: 'gray',
            metrics: {},
            summary:
              'No configured repositories found for preproduction checks.',
            details: [],
          });
          return;
        }

        // 3. Gather facts + checks in parallel for filtered entities
        const results = await Promise.all(
          filteredEntities.map(async entity => {
            const ref = {
              kind: entity.kind,
              namespace: entity.metadata.namespace || 'default',
              name: entity.metadata.name,
            };

            const [facts, check] = await Promise.all([
              preprodUtils.getPreproductionPipelineFacts(techInsightsApi, ref),
              preprodUtils.getPreproductionPipelineChecks(techInsightsApi, ref),
            ]);

            const successRate =
              facts.successWorkflowRunsCount + facts.failureWorkflowRunsCount >
              0
                ? (facts.successWorkflowRunsCount /
                    (facts.successWorkflowRunsCount +
                      facts.failureWorkflowRunsCount)) *
                  100
                : 0;

            const projectSlug =
              entity.metadata.annotations?.['github.com/project-slug'];
            const url = projectSlug
              ? `https://github.com/${projectSlug}/actions`
              : '#';

            return {
              name: entity.metadata.name,
              url,
              successRate: parseFloat(successRate.toFixed(2)),
              successWorkflowRunsCount: facts.successWorkflowRunsCount,
              failureWorkflowRunsCount: facts.failureWorkflowRunsCount,
              failedCheck: check.successRateCheck === false,
            };
          }),
        );

        // 4. Metrics aggregation
        const totalSuccess = results.reduce(
          (sum, r) => sum + r.successWorkflowRunsCount,
          0,
        );
        const totalFailure = results.reduce(
          (sum, r) => sum + r.failureWorkflowRunsCount,
          0,
        );
        const totalRuns = totalSuccess + totalFailure;
        const successRate =
          totalRuns > 0 ? (totalSuccess / totalRuns) * 100 : 0;

        const failures = results.filter(r => r.failedCheck).length;

        // 5. Determine traffic light color based on filtered entities
        const { color } = determineSemaphoreColor(
          failures,
          filteredEntities.length,
          redThreshold,
        );

        let summary = 'Code quality is excellent with no significant issues.';
        if (color === 'red') {
          summary = 'Critical code quality issues require immediate attention.';
        } else if (color === 'yellow') {
          summary = 'Code quality issues need to be addressed before release.';
        }

        // Add info about configured repositories
        if (configuredRepoNames.length > 0) {
          summary += ` (Based on ${filteredEntities.length} configured repositories)`;
        }

        // 6. Bottom 5 repos by success rate
        const lowest = [...results]
          .sort((a, b) => a.successRate - b.successRate)
          .slice(0, 5)
          .map(({ name, url, successRate }) => ({
            name,
            url,
            successRate,
          }));

        setMetrics({
          totalSuccess,
          totalFailure,
          totalRuns,
          successRate: parseFloat(successRate.toFixed(2)),
        });

        setLowestSuccessRepos(lowest);

        setData({
          color,
          summary,
          metrics: {
            totalSuccess,
            totalFailure,
            totalRuns,
            successRate: parseFloat(successRate.toFixed(2)),
          },
          details: [],
        });
      } catch (e) {
        console.error('Failed to fetch pipeline data:', e);
        setMetrics({
          totalSuccess: 0,
          totalFailure: 0,
          totalRuns: 0,
          successRate: 0,
        });
        setLowestSuccessRepos([]);
        setData({
          color: 'gray',
          metrics: {},
          summary: 'Failed to load metrics.',
          details: [],
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchPipelineMetrics();
  }, [open, entities, techInsightsApi, catalogApi, preprodUtils]);

  const renderMetrics = () => (
    <>
      <Grid container spacing={2}>
        {[
          ['Successful Runs', metrics.totalSuccess, 4, '#4caf50'],
          ['Failed Runs', metrics.totalFailure, 4, '#f44336'],
          ['Success Rate (%)', metrics.successRate, 4, '#2196f3'],
        ].map(([label, value, size, color], index) => (
          <Grid item xs={size as GridSize} key={index}>
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

      {lowestSuccessRepos.length > 0 && (
        <div className={classes.repoList}>
          <Typography variant="h6">Lowest Success Rate Repositories</Typography>
          <Grid container spacing={2} className={classes.repoList}>
            {lowestSuccessRepos.map(repo => (
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
      )}
    </>
  );

  return (
    <BaseSemaphoreDialog
      open={open}
      onClose={onClose}
      title="Preproduction Pipeline Insights"
      data={data}
      isLoading={isLoading}
      renderMetrics={renderMetrics}
    />
  );
};
