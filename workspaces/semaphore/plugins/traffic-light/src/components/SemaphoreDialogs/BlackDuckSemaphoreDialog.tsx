import { FC, useState, useMemo, useEffect } from 'react';
import { Grid, Paper, Typography } from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles';
import { useApi } from '@backstage/core-plugin-api';
import { techInsightsApiRef } from '@backstage/plugin-tech-insights';
import { catalogApiRef } from '@backstage/plugin-catalog-react';
import { BaseSemaphoreDialog } from './BaseSemaphoreDialogs';
import { BlackDuckUtils } from '../../utils/blackDuckUtils';
import { SemaphoreData, IssueDetail } from './types';
import { Entity } from '@backstage/catalog-model';
import { determineBlackDuckColor } from '../Semaphores/BlackDuckTrafficLight';

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

interface BlackDuckSemaphoreDialogProps {
  open: boolean;
  onClose: () => void;
  entities?: Entity[];
}

export const BlackDuckSemaphoreDialog: FC<BlackDuckSemaphoreDialogProps> = ({
  open,
  onClose,
  entities = [],
}) => {
  const classes = useStyles();
  const techInsightsApi = useApi(techInsightsApiRef);
  const catalogApi = useApi(catalogApiRef);
  const blackDuckUtils = useMemo(() => new BlackDuckUtils(), []);

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

    const fetchBlackDuckData = async () => {
      try {
        // Filter entities to only those with BlackDuck enabled
        const enabledEntities = entities.filter(
          e =>
            e.metadata.annotations?.['tech-insights.io/blackduck-enabled'] ===
            'true',
        );

        if (enabledEntities.length === 0) {
          setData({
            color: 'gray',
            metrics: {},
            summary: 'No repositories found with BlackDuck enabled.',
            details: [],
          });
          return;
        }

        // Get BlackDuck facts for entities with BlackDuck enabled
        const results = await Promise.all(
          enabledEntities.map(entity =>
            blackDuckUtils.getBlackDuckFacts(techInsightsApi, {
              kind: entity.kind,
              namespace: entity.metadata.namespace || 'default',
              name: entity.metadata.name,
            }),
          ),
        );

        // Count totals
        const totals = results.reduce(
          (acc, r) => {
            acc.security_risks_critical += r.security_risks_critical || 0;
            acc.security_risks_high += r.security_risks_high || 0;
            acc.security_risks_medium += r.security_risks_medium || 0;
            return acc;
          },
          {
            security_risks_critical: 0,
            security_risks_high: 0,
            security_risks_medium: 0,
          } as Record<string, any>,
        );

        // Create details array from results
        const details: IssueDetail[] = [];

        const displayedRepos =
          await blackDuckUtils.getTop5CriticalBlackDuckRepos(
            techInsightsApi,
            enabledEntities,
          );

        for (const repo of displayedRepos) {
          // Create a description and determine severity based on the repo's issues
          let description = ``;
          let severity = '';

          if (repo.security_risks_critical > 0) {
            description = `Repository ${repo.entity.name} has ${repo.security_risks_critical} critical security risks.`;
            severity = 'critical';
          } else if (repo.security_risks_high > 0) {
            description = `Repository ${repo.entity.name} has ${repo.security_risks_high} high security risks.`;
            severity = 'high';
          } else if (repo.security_risks_medium > 0) {
            description = `Repository ${repo.entity.name} has ${repo.security_risks_high} medium security risks.`;
            severity = 'medium';
          } else {
            description = `Repository ${repo.entity.name} has no security risks.`;
            severity = 'low';
          }

          // Add the detail to the array
          details.push({
            severity: severity as 'critical' | 'high' | 'medium' | 'low',
            description: description,
          });
        }

        // Determine the overall status color
        const trafficLightcolor = await determineBlackDuckColor(
          entities,
          catalogApi,
          techInsightsApi,
          blackDuckUtils,
        );
        let color: 'green' | 'red' | 'yellow' | 'gray' = 'green';
        color = trafficLightcolor.color;

        // Create the summary
        let summary = 'No critical security risks were found.';
        if (color === 'red') {
          summary = 'Critical security risks require immediate attention.';
        } else if (color === 'yellow') {
          summary = 'Security risks need to be addressed before release.';
        }

        // Set the real data
        setData({ color, metrics: totals, summary, details });
      } catch (err) {
        // Set default data in case of error
        setData({
          color: 'gray',
          metrics: {},
          summary: 'Failed to load BlackDuck data.',
          details: [],
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchBlackDuckData();
  }, [open, entities, blackDuckUtils, techInsightsApi, catalogApi]);

  const renderMetrics = () => (
    <Grid container spacing={2}>
      <Grid item xs={4}>
        <Paper className={classes.metricBox} elevation={1}>
          <Typography variant="h4" className={classes.metricValue}>
            {data.metrics.security_risks_critical}
          </Typography>
          <Typography className={classes.metricLabel}>
            Critical Security Risks
          </Typography>
        </Paper>
      </Grid>
      <Grid item xs={4}>
        <Paper className={classes.metricBox} elevation={1}>
          <Typography variant="h4" className={classes.metricValue}>
            {data.metrics.security_risks_high}
          </Typography>
          <Typography className={classes.metricLabel}>
            High Security Risks
          </Typography>
        </Paper>
      </Grid>
      <Grid item xs={4}>
        <Paper className={classes.metricBox} elevation={1}>
          <Typography variant="h4" className={classes.metricValue}>
            {data.metrics.security_risks_medium}
          </Typography>
          <Typography className={classes.metricLabel}>
            Medium Security Risks
          </Typography>
        </Paper>
      </Grid>
    </Grid>
  );

  return (
    <BaseSemaphoreDialog
      open={open}
      onClose={onClose}
      title="BlackDuck"
      data={data}
      isLoading={isLoading}
      renderMetrics={renderMetrics}
    />
  );
};
