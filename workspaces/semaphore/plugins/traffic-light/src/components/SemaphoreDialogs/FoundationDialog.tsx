/**
 * Foundation Pipeline Dialog Component
 * Shows metrics for foundation build pipeline success rates
 */
import { useEffect, useMemo, useState } from 'react';
import { makeStyles } from '@material-ui/core/styles';
import { useApi } from '@backstage/core-plugin-api';
import { techInsightsApiRef } from '@backstage/plugin-tech-insights';
import { catalogApiRef } from '@backstage/plugin-catalog-react';
import { Entity } from '@backstage/catalog-model';
import { BaseSemaphoreDialog } from './BaseSemaphoreDialogs';
import { FoundationUtils } from '../../utils/foundationUtils';
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
 * Styles for the dialog components
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
}));

interface FoundationSemaphoreDialogProps {
  open: boolean;
  onClose: () => void;
  entities?: Entity[];
}

/**
 * Main component for displaying Foundation Pipeline metrics in a dialog.
 *
 * Shows workflow run success/failure statistics across repositories and displays
 * a traffic light indicator based on the system's health status.
 */
export const FoundationSemaphoreDialog: React.FC<
  FoundationSemaphoreDialogProps
> = ({ open, onClose, entities = [] }) => {
  const classes = useStyles();
  const techInsightsApi = useApi(techInsightsApiRef);
  const catalogApi = useApi(catalogApiRef);
  const foundationUtils = useMemo(() => new FoundationUtils(), []);

  // Component state
  const [isLoading, setIsLoading] = useState(false);
  const [metrics, setMetrics] = useState<PipelineMetrics>({
    totalSuccess: 0,
    totalFailure: 0,
    totalRuns: 0,
    successRate: 0,
  });

  // Repositories with lowest success rates for display
  const [lowestSuccessRepos, setLowestSuccessRepos] = useState<
    { name: string; url: string; successRate: number }[]
  >([]);

  // Semaphore data containing color and summary
  const [data, setData] = useState<SemaphoreData>({
    color: 'gray',
    metrics: {},
    summary: 'No data available for this metric.',
    details: [],
  });

  /**
   * Effect hook to fetch metrics data when the dialog opens
   */
  useEffect(() => {
    if (!open || entities.length === 0) return;

    setIsLoading(true);

    const fetchMetrics = async () => {
      try {
        // Get system configuration for thresholds and repository list
        const { redThreshold, configuredRepoNames } = await getSystemConfig(
          catalogApi,
          entities,
          'foundation-check-threshold-red',
          'foundation-configured-repositories',
        );

        // Filter entities based on configured repository names if provided
        const filteredEntities =
          configuredRepoNames.length > 0
            ? entities.filter(entity =>
                configuredRepoNames.includes(entity.metadata.name),
              )
            : entities;

        if (filteredEntities.length === 0) {
          setData({
            color: 'gray',
            summary: 'No configured repositories found for foundation checks.',
            metrics: {},
            details: [],
          });
          return;
        }

        // Process entities to get metrics data
        const results = await processEntities(
          filteredEntities,
          techInsightsApi,
          foundationUtils.getFoundationPipelineFacts,
          foundationUtils.getFoundationPipelineChecks,
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
        // Error fallback with more details
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

    fetchMetrics();
  }, [open, entities, techInsightsApi, catalogApi, foundationUtils]);

  // Render metrics display using the shared utility
  const renderMetrics = () =>
    renderPipelineMetrics(metrics, lowestSuccessRepos, classes);

  // Render the dialog with all metrics and status information
  return (
    <BaseSemaphoreDialog
      open={open}
      onClose={onClose}
      title="Foundation Pipeline Insights"
      data={data}
      isLoading={isLoading}
      renderMetrics={renderMetrics}
    />
  );
};
