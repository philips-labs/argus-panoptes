import { useEffect, useMemo, useState } from 'react';
import { Grid, Paper, Typography } from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles';
import { useApi } from '@backstage/core-plugin-api';
import { techInsightsApiRef } from '@backstage/plugin-tech-insights';
import { catalogApiRef } from '@backstage/plugin-catalog-react';
import { Entity } from '@backstage/catalog-model';
import { BaseSemaphoreDialog } from './BaseSemaphoreDialogs';
import {
  GithubAdvancedSecurityUtils,
  GitHubSecurityFacts,
} from '../../utils/githubAdvancedSecurityUtils';
import { SemaphoreData, IssueDetail, Severity } from './types';
import {
  calculateGitHubSecurityTrafficLight,
  extractSecurityThresholds,
} from '../Semaphores/GitHubSecurityTrafficLight';
import type { GridSize } from '@material-ui/core';

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
}));

interface GitHubSemaphoreDialogProps {
  open: boolean;
  onClose: () => void;
  entities?: Entity[];
}

/**
 * Helper function to extract repository name from GitHub URL
 */
const extractRepoName = (url: string): string => {
  if (!url) return '';

  const urlParts = url.split('/');
  const repoIndex = urlParts.indexOf('github.com');

  if (repoIndex !== -1 && repoIndex + 2 < urlParts.length) {
    return `${urlParts[repoIndex + 1]}/${urlParts[repoIndex + 2]}`;
  }

  return '';
};

/**
 * Processes raw security data into counts and a detailed list of issues.
 */
const processSecurityResults = (results: GitHubSecurityFacts[]) => {
  let critical = 0;
  let high = 0;
  let medium = 0;
  let low = 0;
  const details: IssueDetail[] = [];

  results.forEach(result => {
    // Process code scanning alerts
    Object.values(result.codeScanningAlerts || {}).forEach(alert => {
      const a = alert as any;

      // Count by severity
      const severity = (a.severity as Severity) || 'medium';
      switch (severity) {
        case 'critical':
          critical++;
          break;
        case 'high':
          high++;
          break;
        case 'medium':
          medium++;
          break;
        case 'low':
          low++;
          break;
        default:
          medium++;
      }

      // Extract repository name from direct_link or html_url
      const repoName = extractRepoName(a.direct_link ?? a.html_url ?? '');

      // Add repository name to description if available
      const description = repoName
        ? `[${repoName}] ${a.description}`
        : a.description;

      details.push({
        severity,
        description,
        component: a.location?.path,
        url: a.html_url ?? a.direct_link,
        directLink: a.direct_link,
      });
    });

    // Process secret scanning alerts (most are high severity)
    Object.values(result.secretScanningAlerts || {}).forEach(alert => {
      const a = alert as any;
      high++;

      // Extract repository name from html_url
      const repoName = extractRepoName(a.html_url ?? '');

      // Add repository name to description if available
      const description = repoName
        ? `[${repoName}] ${a.description}`
        : a.description;

      details.push({
        severity: 'high',
        description,
        url: a.html_url,
        directLink: a.html_url,
      });
    });
  });

  return { critical, high, medium, low, details };
};

/**
 * Sort issues by severity (critical first, then high, medium, low)
 */
function sortIssuesBySeverity(details: IssueDetail[]): IssueDetail[] {
  const severityOrder: Record<Severity, number> = {
    critical: 0,
    high: 1,
    medium: 2,
    low: 3,
  };

  return details.sort((a, b) => {
    const aOrder = severityOrder[a.severity] ?? 999;
    const bOrder = severityOrder[b.severity] ?? 999;
    return aOrder - bOrder;
  });
}

export const GitHubSemaphoreDialog: React.FC<GitHubSemaphoreDialogProps> = ({
  open,
  onClose,
  entities = [],
}) => {
  const classes = useStyles();
  const techInsightsApi = useApi(techInsightsApiRef);
  const catalogApi = useApi(catalogApiRef);

  const githubASUtils = useMemo(() => new GithubAdvancedSecurityUtils(), []);

  const [data, setData] = useState<SemaphoreData>({
    color: 'gray',
    metrics: {},
    summary: 'No data available for this metric.',
    details: [],
  });
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!open || entities.length === 0) return;

    setIsLoading(true);

    const fetchSystemEntity = async () => {
      const systemName = entities[0].spec?.system;
      if (typeof systemName !== 'string' || !systemName)
        return { systemEntity: undefined, thresholds: undefined };

      const systemEntity = await catalogApi.getEntityByRef({
        kind: 'System',
        namespace: entities[0].metadata.namespace ?? 'default',
        name: systemName,
      });

      const thresholds = extractSecurityThresholds(
        systemEntity,
        entities.length,
      );
      return { systemEntity, thresholds };
    };

    const fetchSecurityData = async () => {
      // Get system entity and thresholds (with separate error handling)
      const systemData = await fetchSystemEntity().catch(() => ({
        systemEntity: undefined,
        thresholds: undefined,
      }));

      // Get security check results (for traffic light calculation)
      const securityCheckResults = await Promise.all(
        entities.map(entity =>
          githubASUtils.getGitHubSecurityData(techInsightsApi, {
            kind: entity.kind,
            namespace: entity.metadata.namespace ?? 'default',
            name: entity.metadata.name,
          }),
        ),
      );

      // Process the fetched data using the helper function
      const { critical, high, medium, low, details } =
        processSecurityResults(securityCheckResults);

      const totalCode = securityCheckResults.reduce(
        (sum, r) => sum + r.openCodeScanningAlertCount,
        0,
      );
      const totalSecret = securityCheckResults.reduce(
        (sum, r) => sum + r.openSecretScanningAlertCount,
        0,
      );

      // Determine color using the traffic light function if thresholds are available
      let color: 'red' | 'yellow' | 'green' | 'gray';
      let summary: string;

      if (systemData.thresholds) {
        // Use the traffic light calculation function
        const trafficLightResult = calculateGitHubSecurityTrafficLight(
          securityCheckResults,
          entities,
          systemData.thresholds,
        );
        color =
          trafficLightResult.color === 'white'
            ? 'gray'
            : trafficLightResult.color;
        summary = trafficLightResult.reason;
      } else {
        // Fallback to simple logic if no thresholds available
        if (critical > 0 || high > 0) {
          color = 'red';
        } else if (medium > 0 || low > 0) {
          color = 'yellow';
        } else {
          color = 'green';
        }

        if (color === 'red') {
          summary = 'Critical security issues require immediate attention.';
        } else if (color === 'yellow') {
          summary = 'Security issues need to be addressed.';
        } else {
          summary = 'No security issues found.';
        }
      }

      // Sort details by severity before setting the data
      const sortedDetails = sortIssuesBySeverity(details);

      setData({
        color,
        metrics: {
          criticalIssues: critical,
          highIssues: high,
          mediumIssues: medium,
          lowIssues: low,
          totalIssues: totalCode + totalSecret,
          totalCodeScanningAlerts: totalCode,
          totalSecretScanningAlerts: totalSecret,
        },
        summary,
        details: sortedDetails,
      });
    };

    // Handle success and error using promise chain
    fetchSecurityData()
      .then(() => {
        // Success case - nothing additional needed
      })
      .catch(() => {
        // Error fallback
        setData({
          color: 'gray',
          metrics: {},
          summary: 'Failed to load GitHub Security data.',
          details: [],
        });
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [open, entities, githubASUtils, techInsightsApi, catalogApi]);

  const renderMetrics = () => (
    <Grid container spacing={2}>
      {[
        ['Code Scanning Alerts', data.metrics.totalCodeScanningAlerts, 6],
        ['Secret Scanning Alerts', data.metrics.totalSecretScanningAlerts, 6],
        ['Critical', data.metrics.criticalIssues, 3, '#d32f2f'],
        ['High', data.metrics.highIssues, 3, '#f44336'],
        ['Medium', data.metrics.mediumIssues, 3, '#ff9800'],
        ['Low', data.metrics.lowIssues, 3, '#2196f3'],
      ].map(([label, value, size, color]) => (
        <Grid item xs={size as GridSize} key={label as string}>
          <Paper className={classes.metricBox} elevation={1}>
            <Typography
              variant="h4"
              className={classes.metricValue}
              style={{ color: color as string | undefined }}
            >
              {value ?? 0}
            </Typography>
            <Typography className={classes.metricLabel}>{label}</Typography>
          </Paper>
        </Grid>
      ))}
    </Grid>
  );

  return (
    <BaseSemaphoreDialog
      open={open}
      onClose={onClose}
      title="GitHub Advanced Security"
      data={data}
      isLoading={isLoading}
      renderMetrics={renderMetrics}
    />
  );
};
