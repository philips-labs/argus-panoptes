import { Grid, Paper, Typography } from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles';
import { useApi } from '@backstage/core-plugin-api';
import { techInsightsApiRef } from '@backstage/plugin-tech-insights';
import { catalogApiRef } from '@backstage/plugin-catalog-react';
import { BaseSemaphoreDialog } from './BaseSemaphoreDialogs';
import { SonarCloudUtils } from '../../utils/sonarCloudUtils';
import { SemaphoreData, IssueDetail } from './types';
import { Entity } from '@backstage/catalog-model';
import { determineSonarQubeColor } from '../Semaphores/SonarQubeTrafficLight';
import { useEffect, useMemo, useState } from 'react';

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

interface SonarSemaphoreDialogProps {
  open: boolean;
  onClose: () => void;
  entities?: Entity[];
}

export const SonarQubeSemaphoreDialog: React.FC<SonarSemaphoreDialogProps> = ({
  open,
  onClose,
  entities = [],
}) => {
  const classes = useStyles();
  const techInsightsApi = useApi(techInsightsApiRef);
  const catalogApi = useApi(catalogApiRef);
  const sonarUtils = useMemo(() => new SonarCloudUtils(), []);

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

    const fetchSonarData = async () => {
      try {
        // Filter entities to only those with SonarQube enabled
        const enabledEntities = entities.filter(
          e => e.metadata.annotations?.['sonarcloud.io/enabled'] === 'true',
        );

        if (enabledEntities.length === 0) {
          setData({
            color: 'gray',
            metrics: {},
            summary: 'No repositories found with SonarQube enabled.',
            details: [],
          });
          return;
        }

        // Get SonarQube facts for all entities
        const results = await Promise.all(
          enabledEntities.map(entity =>
            sonarUtils.getSonarQubeFacts(techInsightsApi, {
              kind: entity.kind,
              namespace: entity.metadata.namespace ?? 'default',
              name: entity.metadata.name,
            }),
          ),
        );

        // Count totals
        const totals = results.reduce(
          (acc, r) => {
            acc.bugs += r.bugs || 0;
            acc.code_smells += r.code_smells || 0;
            acc.vulnerabilities += r.vulnerabilities || 0;
            acc.code_coverage += r.code_coverage / entities.length;
            acc.quality_gate += r.quality_gate === 'OK' ? 0 : 1;
            return acc;
          },
          {
            bugs: 0,
            code_smells: 0,
            vulnerabilities: 0,
            code_coverage: 0,
            quality_gate: 0,
          } as Record<string, any>,
        );

        // Round code_coverage to 2 decimal places
        totals.code_coverage = Number(totals.code_coverage.toFixed(2));

        // Create details array from results
        const details: IssueDetail[] = [];

        const displayedRepos = await sonarUtils.getTop5CriticalSonarCloudRepos(
          techInsightsApi,
          enabledEntities,
        );

        for (const repo of displayedRepos) {
          // Fetch entity metadata from catalog
          const entity = await catalogApi.getEntityByRef({
            kind: 'Component',
            namespace: 'default',
            name:
              typeof repo.entity.name === 'string'
                ? repo.entity.name
                : String(repo.entity.name),
          });

          // Create a description and determine severity based on the repo's issues
          let description = ``;
          let severity = '';

          if (repo.quality_gate === 1) {
            description = `Repository ${repo.entity.name} has a failed quality gate.`;
            severity = 'critical';
          } else if (repo.vulnerabilities > 0) {
            description = `Repository ${repo.entity.name} has ${repo.vulnerabilities} vulnerabilities.`;
            severity = 'high';
          } else if (repo.bugs > 0) {
            description = `Repository ${repo.entity.name} has ${repo.bugs} bugs.`;
            severity = 'high';
          } else if (repo.code_smells > 0) {
            description = `Repository ${repo.entity.name} has ${repo.code_smells} code smells.`;
            severity = 'medium';
          } else if (repo.code_coverage < 80) {
            description = `Repository ${repo.entity.name} has a code coverage of ${repo.code_coverage}%.`;
            severity = 'low';
          }

          // Add the detail to the array
          details.push({
            severity: severity as 'critical' | 'high' | 'medium' | 'low',
            description: description,
            url: `https://sonarcloud.io/project/overview?id=${entity?.metadata.annotations?.['sonarcloud.io/project-key']}`,
          });
        }

        // Determine the overall status color
        const trafficLightcolor = await determineSonarQubeColor(
          entities,
          catalogApi,
          techInsightsApi,
          sonarUtils,
        );
        const color: 'green' | 'red' | 'yellow' | 'gray' =
          trafficLightcolor.color;

        // Create the summary
        let summary = 'No critical code quality issues were found.';
        if (color === 'red') {
          summary = 'Critical code quality issues require immediate attention.';
        } else if (color === 'yellow') {
          summary = 'Code quality issues need to be addressed before release.';
        }

        // Set the real data
        setData({ color, metrics: totals, summary, details });
      } catch (err) {
        // Report to error tracking service (if available)
        // errorReporter?.captureException(err);

        // Provide meaningful user feedback based on error type
        const errorMessage =
          err instanceof Error
            ? `Failed to load SonarQube data: ${err.message}`
            : 'Failed to load SonarQube data due to an unknown error.';

        setData({
          color: 'gray',
          metrics: {},
          summary: errorMessage,
          details: [
            {
              severity: 'critical',
              description:
                'Unable to retrieve code quality metrics. Please try again later.',
              url: '',
            },
          ],
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchSonarData();
  }, [open, entities, sonarUtils, techInsightsApi, catalogApi]);

  const renderMetrics = () => (
    <Grid container spacing={2}>
      <Grid item xs={4}>
        <Paper className={classes.metricBox} elevation={1}>
          <Typography variant="h4" className={classes.metricValue}>
            {data.metrics.bugs}
          </Typography>
          <Typography className={classes.metricLabel}>Bugs</Typography>
        </Paper>
      </Grid>
      <Grid item xs={4}>
        <Paper className={classes.metricBox} elevation={1}>
          <Typography variant="h4" className={classes.metricValue}>
            {data.metrics.code_smells}
          </Typography>
          <Typography className={classes.metricLabel}>Code Smells</Typography>
        </Paper>
      </Grid>
      <Grid item xs={4}>
        <Paper className={classes.metricBox} elevation={1}>
          <Typography variant="h4" className={classes.metricValue}>
            {data.metrics.vulnerabilities}
          </Typography>
          <Typography className={classes.metricLabel}>
            Vulnerabilities
          </Typography>
        </Paper>
      </Grid>
      <Grid item xs={6}>
        <Paper className={classes.metricBox} elevation={1}>
          <Typography variant="h4" className={classes.metricValue}>
            {data.metrics.code_coverage}%
          </Typography>
          <Typography className={classes.metricLabel}>
            Average Code Coverage
          </Typography>
        </Paper>
      </Grid>
      <Grid item xs={6}>
        <Paper className={classes.metricBox} elevation={1}>
          <Typography variant="h4" className={classes.metricValue}>
            {data.metrics.quality_gate}
          </Typography>
          <Typography className={classes.metricLabel}>
            Failed Quality Gate
          </Typography>
        </Paper>
      </Grid>
    </Grid>
  );

  return (
    <BaseSemaphoreDialog
      open={open}
      onClose={onClose}
      title="SonarQube"
      data={data}
      isLoading={isLoading}
      renderMetrics={renderMetrics}
    />
  );
};
