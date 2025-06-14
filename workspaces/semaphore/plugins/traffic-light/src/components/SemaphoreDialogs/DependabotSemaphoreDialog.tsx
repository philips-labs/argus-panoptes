import {FC, useState, useEffect, useMemo} from 'react';
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
    borderLeftColor: '#d32f2f',
  },
  highRepo: {
    borderLeftColor: '#f44336',
  },
  mediumRepo: {
    borderLeftColor: '#ff9800',
  },
  lowRepo: {
    borderLeftColor: '#2196f3',
  },
}));

interface DependabotSemaphoreDialogProps {
  open: boolean;
  onClose: () => void;
  entities: Entity[];
  system: string;
}

export const DependabotSemaphoreDialog: FC<
  DependabotSemaphoreDialogProps
> = ({ open, onClose, entities = [], system }) => {
  const classes = useStyles();
  const techInsightsApi = useApi(techInsightsApiRef);
  const dependabotUtils = useMemo(
    () => new DependabotUtils(),
    [],
  );
  const [data, setData] = useState<SemaphoreData>({
    color: 'gray',
    metrics: {},
    summary: 'No data available for this metric.',
    details: [],
  });
  const [topRepos, setTopRepos] = useState<RepoAlertSummary[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
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
        const results = await Promise.all(
          entities.map(async entity => {
            const facts = await dependabotUtils.getDependabotFacts(
              techInsightsApi,
              {
                kind: entity.kind,
                namespace: entity.metadata.namespace || 'default',
                name: entity.metadata.name,
              },
            );
            return { entity, facts };
          }),
        );

        let totalCritical = 0;
        let totalHigh = 0;
        let totalMedium = 0;

        const repoSummaries: RepoAlertSummary[] = results.map(
          ({ entity, facts }) => {
            const critical = facts.critical || 0;
            const high = facts.high || 0;
            const medium = facts.medium || 0;

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

        const top5Repos = [...repoSummaries]
          .sort((a, b) => {
            if (b.critical !== a.critical) return b.critical - a.critical;
            if (b.high !== a.high) return b.high - a.high;
            return b.medium - a.medium;
          })
          .slice(0, 5);

        const totalIssues = totalCritical + totalHigh + totalMedium;

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

        const trafficLightcolor = await determineDependabotColor(
          system,
          entities,
          techInsightsApi,
          dependabotUtils,
        );
        let color: 'green' | 'red' | 'yellow' | 'gray' = 'gray';
        color = trafficLightcolor.color;

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
          details: [],
        });

        setTopRepos(top5Repos);
      } catch (error) {
        setData({
          color: 'gray',
          metrics: {},
          summary: 'Failed to load Dependabot data.',
          details: [],
        });
        setTopRepos([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchDependabotData();
  }, [open, entities, dependabotUtils, techInsightsApi, system]);

  const getRepoClassName = (repo: RepoAlertSummary) => {
    if (repo.critical > 0) return `${classes.repoItem} ${classes.criticalRepo}`;
    if (repo.high > 0) return `${classes.repoItem} ${classes.highRepo}`;
    if (repo.medium > 0) return `${classes.repoItem} ${classes.mediumRepo}`;
    return `${classes.repoItem} ${classes.lowRepo}`;
  };

  const renderMetrics = () => (
    <>
      <Grid container spacing={2}>
        {[
          ['Total Issues', data.metrics.totalIssues, 4, '#666'],
          ['Total Repositories', data.metrics.totalRepositories, 4, '#666'],
          ['Critical', data.metrics.criticalIssues, 4, '#d32f2f'],
          ['High', data.metrics.highIssues, 4, '#f44336'],
          ['Medium', data.metrics.mediumIssues, 4, '#ff9800'],
        ].map(([label, value, size, color], i) => (
          <Grid item xs={size as GridSize} key={i}>
            <Paper className={classes.metricBox} elevation={1}>
              <Typography
                variant="h4"
                className={classes.metricValue}
                style={{ color: color as string }}
              >
                {value || 0}
              </Typography>
              <Typography className={classes.metricLabel}>{label}</Typography>
            </Paper>
          </Grid>
        ))}
      </Grid>

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
