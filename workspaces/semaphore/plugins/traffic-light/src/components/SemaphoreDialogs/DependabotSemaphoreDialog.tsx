import {
  Grid,
  Paper,
  Typography,
  List,
  ListItem,
  ListItemText,
} from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles';
import { useApi } from '@backstage/core-plugin-api';
import { techInsightsApiRef } from '@backstage/plugin-tech-insights';
import { Entity } from '@backstage/catalog-model';
import { BaseSemaphoreDialog } from './BaseSemaphoreDialogs';
import { DependabotUtils, RepoAlertSummary } from '../../utils/dependabotUtils';
import { SemaphoreData } from './types';
import type { GridSize } from '@material-ui/core';
import { determineDependabotColor } from '../Semaphores/TrafficLightDependabot';
import { useEffect, useMemo, useState } from 'react';

// Defines the styles for the component using Material-UI's makeStyles hook.
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
  topReposSection: {
    marginTop: theme.spacing(3),
  },
  repoItem: {
    borderLeft: `4px solid transparent`,
    marginBottom: theme.spacing(1),
    backgroundColor: theme.palette.background.paper,
    borderRadius: theme.shape.borderRadius,
  },
  criticalRepo: {
    borderLeftColor: '#d32f2f', // Red for critical issues
  },
  highRepo: {
    borderLeftColor: '#f44336', // Lighter red for high severity
  },
  mediumRepo: {
    borderLeftColor: '#ff9800', // Orange for medium severity
  },
  lowRepo: {
    borderLeftColor: '#2196f3', // Blue for low severity
  },
}));

// Defines the props that the DependabotSemaphoreDialog component accepts.
interface DependabotSemaphoreDialogProps {
  open: boolean; // Controls whether the dialog is visible.
  onClose: () => void; // Function to call when the dialog should be closed.
  entities: Entity[]; // The list of entities (repositories) to display data for.
  system: string; // The name of the system being displayed.
}

/**
 * A dialog component that displays detailed Dependabot security alert information for a set of entities.
 * It shows aggregated metrics and a list of the top 5 most vulnerable repositories.
 */
export const DependabotSemaphoreDialog: React.FC<
  DependabotSemaphoreDialogProps
> = ({ open, onClose, entities = [], system }) => {
  const classes = useStyles();
  const techInsightsApi = useApi(techInsightsApiRef);

  // Memoize the DependabotUtils instance to avoid creating it on every render.
  const dependabotUtils = useMemo(() => new DependabotUtils(), []);

  // State to hold the aggregated data for the semaphore (color, metrics, summary).
  const [data, setData] = useState<SemaphoreData>({
    color: 'gray',
    metrics: {},
    summary: 'No data available for this metric.',
    details: [],
  });

  // State to hold the list of the top 5 repositories with the most alerts.
  const [topRepos, setTopRepos] = useState<RepoAlertSummary[]>([]);
  // State to manage the loading indicator.
  const [isLoading, setIsLoading] = useState(false);

  // This effect fetches and processes Dependabot data whenever the dialog is opened or the entities change.
  useEffect(() => {
    // If the dialog is not open or there are no entities, reset the state and do nothing.
    if (!open || entities.length === 0) {
      setData({
        color: 'gray',
        metrics: {},
        summary: 'No data available for this metric.',
        details: [],
      });
      setTopRepos([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    const fetchDependabotData = async () => {
      try {
        // Fetch Dependabot facts for all entities in parallel.
        const results = await Promise.all(
          entities.map(async entity => {
            const facts = await dependabotUtils.getDependabotFacts(
              techInsightsApi,
              {
                kind: entity.kind,
                namespace: entity.metadata.namespace ?? 'default',
                name: entity.metadata.name,
              },
            );
            return { entity, facts };
          }),
        );

        // Initialize counters for alert severities.
        let totalCritical = 0;
        let totalHigh = 0;
        let totalMedium = 0;

        // Process the results to aggregate totals and create summaries for each repository.
        const repoSummaries: RepoAlertSummary[] = results.map(
          ({ entity, facts }) => {
            const critical = facts.critical || 0;
            const high = facts.high || 0;
            const medium = facts.medium || 0;

            // Add to the total counts.
            totalCritical += critical;
            totalHigh += high;
            totalMedium += medium;

            return {
              name: entity.metadata.name,
              critical,
              high,
              medium,
            };
          },
        );

        // Sort the repositories by severity (critical > high > medium) and take the top 5.
        const top5Repos = [...repoSummaries]
          .sort((a, b) => {
            if (b.critical !== a.critical) return b.critical - a.critical;
            if (b.high !== a.high) return b.high - a.high;
            return b.medium - a.medium;
          })
          .slice(0, 5);

        const totalIssues = totalCritical + totalHigh + totalMedium;

        // Create a human-readable summary based on the highest severity found.
        let summary;
        if (totalCritical > 0) {
          summary = `${totalCritical} critical issues found`;
        } else if (totalHigh > 0) {
          summary = `${totalHigh} high severity issues found`;
        } else if (totalMedium > 0) {
          summary = `${totalMedium} medium severity issues found`;
        } else {
          summary = 'No Dependabot security issues found.';
        }

        // Determine the overall traffic light color for the semaphore.
        const trafficLightcolor = await determineDependabotColor(
          system,
          entities,
          techInsightsApi,
          dependabotUtils,
        );
        const color: 'green' | 'red' | 'yellow' | 'gray' =
          trafficLightcolor.color;

        // Update the component's state with the processed data.
        setData({
          color: color,
          metrics: {
            criticalIssues: totalCritical,
            highIssues: totalHigh,
            mediumIssues: totalMedium,
            totalIssues,
            totalRepositories: entities.length,
          },
          summary,
          details: [], // This dialog does not show a detailed issue list, so this is empty.
        });

        setTopRepos(top5Repos);
      } catch {
        // In case of an error, set a failure state.
        setData({
          color: 'gray',
          metrics: {},
          summary: 'Failed to load Dependabot data.',
          details: [],
        });
        setTopRepos([]);
      } finally {
        // Always stop the loading indicator.
        setIsLoading(false);
      }
    };

    fetchDependabotData();
  }, [open, entities, dependabotUtils, techInsightsApi, system]);

  // Helper function to determine the CSS class for a repository item based on its highest alert severity.
  const getRepoClassName = (repo: RepoAlertSummary) => {
    if (repo.critical > 0) return `${classes.repoItem} ${classes.criticalRepo}`;
    if (repo.high > 0) return `${classes.repoItem} ${classes.highRepo}`;
    if (repo.medium > 0) return `${classes.repoItem} ${classes.mediumRepo}`;
    return `${classes.repoItem} ${classes.lowRepo}`;
  };

  // Renders the grid of aggregated metrics.
  const renderMetrics = () => (
    <>
      <Grid container spacing={2}>
        {[
          ['Total Issues', data.metrics.totalIssues, 4, '#666'],
          ['Total Repositories', data.metrics.totalRepositories, 4, '#666'],
          ['Critical', data.metrics.criticalIssues, 4, '#d32f2f'],
          ['High', data.metrics.highIssues, 4, '#f44336'],
          ['Medium', data.metrics.mediumIssues, 4, '#ff9800'],
        ].map(([label, value, size, color]) => (
          <Grid item xs={size as GridSize} key={label}>
            <Paper className={classes.metricBox} elevation={1}>
              <Typography
                variant="h4"
                className={classes.metricValue}
                style={{ color: color as string }}
              >
                {value ?? 0}
              </Typography>
              <Typography className={classes.metricLabel}>{label}</Typography>
            </Paper>
          </Grid>
        ))}
      </Grid>

      {/* Renders the list of top 5 repositories if there are any. */}
      {topRepos.length > 0 && (
        <div className={classes.topReposSection}>
          <Typography variant="h6" gutterBottom>
            Top 5 Repositories by Priority
          </Typography>
          <List>
            {topRepos.map((repo, index) => (
              <ListItem key={repo.name} className={getRepoClassName(repo)}>
                <ListItemText
                  primary={`${index + 1}. ${repo.name}`}
                  secondary={
                    <span>
                      {/* Conditionally render the count for each severity level. */}
                      {repo.critical > 0 && (
                        <span style={{ color: '#d32f2f', fontWeight: 'bold' }}>
                          Critical: {repo.critical}
                        </span>
                      )}
                      {repo.critical > 0 &&
                        (repo.high > 0 || repo.medium > 0) &&
                        ' | '}
                      {repo.high > 0 && (
                        <span style={{ color: '#f44336', fontWeight: 'bold' }}>
                          High: {repo.high}
                        </span>
                      )}
                      {repo.high > 0 && repo.medium > 0 && ' | '}
                      {repo.medium > 0 && (
                        <span style={{ color: '#ff9800', fontWeight: 'bold' }}>
                          Medium: {repo.medium}
                        </span>
                      )}
                      {/* Display a message if no issues are found in a top repo (unlikely but possible). */}
                      {repo.critical === 0 &&
                        repo.high === 0 &&
                        repo.medium === 0 && (
                          <span style={{ color: '#4caf50' }}>
                            No issues found
                          </span>
                        )}
                    </span>
                  }
                />
              </ListItem>
            ))}
          </List>
        </div>
      )}
    </>
  );

  // Renders the base dialog component with the specific content for Dependabot.
  return (
    <BaseSemaphoreDialog
      open={open}
      onClose={onClose}
      title={`Dependabot Security Alerts${
        system !== 'all' ? ` - ${system}` : ''
      }`}
      data={data}
      isLoading={isLoading}
      renderMetrics={renderMetrics}
    />
  );
};
