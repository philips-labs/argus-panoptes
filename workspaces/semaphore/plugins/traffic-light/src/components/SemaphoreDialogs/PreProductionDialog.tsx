/**
 * Preproduction Pipeline Dialog Component
 * Shows metrics for preproduction deployment pipeline success rates
 */
import { useState, useMemo, useEffect } from 'react';
import { makeStyles } from '@material-ui/core/styles';
import { useApi } from '@backstage/core-plugin-api';
import { techInsightsApiRef } from '@backstage/plugin-tech-insights';
import { catalogApiRef } from '@backstage/plugin-catalog-react';
import { Entity } from '@backstage/catalog-model';
import { BaseSemaphoreDialog } from './BaseSemaphoreDialogs';
import { PreproductionUtils } from '../../utils/preproductionUtils';
import { SemaphoreData } from './types';
import {
  PipelineMetrics,
  processEntities,
  aggregateMetrics,
  buildSemaphoreData,
  getLowestSuccessRepos,
  renderPipelineMetrics,
  getSystemConfig,
} from '../../utils/PipelineMetricsUtils';

/**
 * Styles for the preproduction dialog components
 */
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

/**
 * Props for the PreproductionSemaphoreDialog component
 *
 * @property {boolean} open - Whether the dialog is open or closed
 * @property {() => void} onClose - Callback function when dialog is closed
 * @property {Entity[]} [entities] - Array of Backstage entities to evaluate
 */
interface PreproductionSemaphoreDialogProps {
  open: boolean;
  onClose: () => void;
  entities?: Entity[];
}

/**
 * Dialog component that displays detailed metrics about preproduction pipeline runs
 *
 * Shows aggregated success rates, failed runs, and repositories with the lowest success rates.
 * Uses system annotations to determine thresholds and which repositories to include in the analysis.
 */
export const PreproductionSemaphoreDialog: React.FC<
  PreproductionSemaphoreDialogProps
> = ({ open, onClose, entities = [] }) => {
  const classes = useStyles();
  // APIs for retrieving data
  const techInsightsApi = useApi(techInsightsApiRef);
  const catalogApi = useApi(catalogApiRef);
  const preprodUtils = useMemo(() => new PreproductionUtils(), []);

  // Component state
  const [isLoading, setIsLoading] = useState(false);
  const [metrics, setMetrics] = useState<PipelineMetrics>({
    totalSuccess: 0,
    totalFailure: 0,
    totalRuns: 0,
    successRate: 0,
  });

  // State for tracking repositories with lowest success rates
  const [lowestSuccessRepos, setLowestSuccessRepos] = useState<
    { name: string; url: string; successRate: number }[]
  >([]);

  // Main data for the semaphore display
  const [data, setData] = useState<SemaphoreData>({
    color: 'gray',
    metrics: {},
    summary: 'No data available for this metric.',
    details: [],
  });

  /**
   * Effect that loads pipeline metrics when the dialog opens
   * or when entities change
   */
  useEffect(() => {
    // Skip if dialog is closed or there are no entities
    if (!open || entities.length === 0) return;

    setIsLoading(true);

    const fetchPipelineMetrics = async () => {
      try {
        // Get system configuration for thresholds and repository list
        const { redThreshold, configuredRepoNames } = await getSystemConfig(
          catalogApi,
          entities,
          'preproduction-check-threshold-red',
          'preproduction-configured-repositories',
        );

        // Filter entities based on configured repository names if provided
        const filteredEntities =
          configuredRepoNames.length > 0
            ? entities.filter(entity =>
                configuredRepoNames.includes(entity.metadata.name),
              )
            : entities;

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

        // Process entities to get metrics data
        const results = await processEntities(
          filteredEntities,
          techInsightsApi,
          preprodUtils.getPreproductionPipelineFacts,
          preprodUtils.getPreproductionPipelineChecks,
        );

        // Calculate aggregate metrics
        const aggregated = aggregateMetrics(results);

        // Count failures
        const failures = results.filter(r => r.failedCheck).length;

        // Build semaphore data with configured repo count
        const semaphoreData = buildSemaphoreData(
          aggregated,
          failures,
          filteredEntities.length,
          redThreshold,
          configuredRepoNames.length > 0 ? filteredEntities.length : undefined,
        );

        // Get repositories with lowest success rates
        const lowest = getLowestSuccessRepos(results);

        // Update state
        setMetrics(aggregated);
        setLowestSuccessRepos(lowest);
        setData(semaphoreData);
      } catch (error) {
        // Error fallback
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
          summary: `Failed to load metrics: ${
            error instanceof Error ? error.message : 'Unknown error'
          }`,
          details: [],
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchPipelineMetrics();
  }, [open, entities, techInsightsApi, catalogApi, preprodUtils]);

  // Render metrics display using the shared utility
  const renderMetrics = () =>
    renderPipelineMetrics(metrics, lowestSuccessRepos, classes);

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
