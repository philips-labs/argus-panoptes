/**
 * Reporting Pipeline Dialog Component
 * Shows detailed metrics for reporting pipeline success rates across repositories
 */
import { useEffect, useState, useMemo } from 'react';
import { makeStyles } from '@material-ui/core/styles';
import { useApi } from '@backstage/core-plugin-api';
import { techInsightsApiRef } from '@backstage/plugin-tech-insights';
import { catalogApiRef } from '@backstage/plugin-catalog-react';
import { Entity } from '@backstage/catalog-model';
import { BaseSemaphoreDialog } from './BaseSemaphoreDialogs';
import { ReportingUtils } from '../../utils/reportingUtils';
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

// Create styles using the common pipeline styles
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
 * Props for configuring the Reporting Pipeline dialog
 */
interface ReportingSemaphoreDialogProps {
  open: boolean;
  onClose: () => void;
  entities?: Entity[];
}

export const ReportingSemaphoreDialog: React.FC<
  ReportingSemaphoreDialogProps
> = ({ open, onClose, entities = [] }) => {
  const classes = useStyles();
  const techInsightsApi = useApi(techInsightsApiRef);
  const catalogApi = useApi(catalogApiRef);
  const reportingUtils = useMemo(() => new ReportingUtils(), []);

  // Component state for loading and metrics data
  const [isLoading, setIsLoading] = useState(false);
  const [metrics, setMetrics] = useState<PipelineMetrics>({
    totalSuccess: 0,
    totalFailure: 0,
    totalRuns: 0,
    successRate: 0,
  });

  // Track repositories with lowest success rates
  const [lowestSuccessRepos, setLowestSuccessRepos] = useState<
    { name: string; url: string; successRate: number }[]
  >([]);

  // Traffic light status data for display
  const [data, setData] = useState<SemaphoreData>({
    color: 'gray',
    metrics: {},
    summary: 'No data available for this metric.',
    details: [],
  });

  // Fetch pipeline metrics when dialog opens
  useEffect(() => {
    if (!open || entities.length === 0) return;

    setIsLoading(true);

    const fetchPipelineMetrics = async () => {
      try {
        // Get threshold from system annotations
        const { redThreshold } = await getSystemConfig(
          catalogApi,
          entities,
          'reporting-check-threshold-red',
        );

        // Process entities to get metrics data
        const results = await processEntities(
          entities,
          techInsightsApi,
          reportingUtils.getReportingPipelineFacts,
          reportingUtils.getReportingPipelineChecks,
        );

        // Calculate aggregate metrics
        const aggregated = aggregateMetrics(results);

        // Count failures
        const failures = results.filter(r => r.failedCheck).length;

        // Build semaphore data
        const semaphoreData = buildSemaphoreData(
          aggregated,
          failures,
          entities.length,
          redThreshold,
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
  }, [open, entities, techInsightsApi, catalogApi, reportingUtils]);

  // Render metrics display using the shared utility
  const renderMetrics = () =>
    renderPipelineMetrics(metrics, lowestSuccessRepos, classes);

  return (
    <BaseSemaphoreDialog
      open={open}
      onClose={onClose}
      title="Reporting Pipeline Insights"
      data={data}
      isLoading={isLoading}
      renderMetrics={renderMetrics}
    />
  );
};
