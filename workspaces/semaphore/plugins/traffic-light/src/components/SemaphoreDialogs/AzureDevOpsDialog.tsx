import {FC, useState, useEffect, useMemo} from 'react';
import { Grid, Paper, Typography, Link } from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles';
import { useApi } from '@backstage/core-plugin-api';
import { techInsightsApiRef } from '@backstage/plugin-tech-insights';
import { Entity } from '@backstage/catalog-model';
import { BaseSemaphoreDialog } from './BaseSemaphoreDialogs';
import { AzureUtils } from '../../utils/azureUtils';
import { determineSemaphoreColor } from '../utils';
import { SemaphoreData } from './types';
import { catalogApiRef } from '@backstage/plugin-catalog-react';

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
  projectList: {
    marginTop: theme.spacing(3),
  },
}));

interface AzureBugInsightsDialogProps {
  open: boolean;
  onClose: () => void;
  entities?: Entity[];
}

export const AzureDevOpsSemaphoreDialog: FC<
  AzureBugInsightsDialogProps
> = ({ open, onClose, entities = [] }) => {
  const classes = useStyles();
  const techInsightsApi = useApi(techInsightsApiRef);
  const azureUtils = useMemo(() => new AzureUtils(), []);
  const catalogApi = useApi(catalogApiRef);

  const [isLoading, setIsLoading] = useState(false);
  const [projectBugs, setProjectBugs] = useState<
    {
      project: string;
      bugCount: number;
      url: string;
      entities: { entityName: string }[];
    }[]
  >([]);
  const [data, setData] = useState<SemaphoreData>({
    color: 'gray',
    metrics: {},
    summary: 'No data available for this metric.',
    details: [],
  });

  useEffect(() => {
    if (!open || entities.length === 0) return;

    setIsLoading(true);

    const fetchBugMetrics = async () => {
      try {
        // 1. Fetch system threshold
        let redThreshold = 0.33;
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
                'azure-bugs-check-threshold-red'
              ];
            if (thresholdAnnotation) {
              redThreshold = parseFloat(thresholdAnnotation);
            }
          }
        } catch (err) {
          // console.warn(
          //   'Could not fetch system threshold annotation; using default 0.33',
          // );
        }

        const projectBugMap = new Map<
          string,
          { bugCount: number; url: string; failedCheck: boolean }
        >();

        const projectToEntitiesMap = new Map<
          string,
          { entityName: string }[]
        >();

        for (const entity of entities) {
          const ref = {
            kind: entity.kind,
            namespace: entity.metadata.namespace || 'default',
            name: entity.metadata.name,
          };

          const projectName =
            entity.metadata.annotations?.['azure.com/project'] ?? 'unknown';

          if (!projectBugMap.has(projectName) && projectName !== 'unknown') {
            const [metrics, checks] = await Promise.all([
              azureUtils.getAzureDevOpsBugFacts(techInsightsApi, ref),
              azureUtils.getAzureDevOpsBugChecks(techInsightsApi, ref),
            ]);

            if (!entity.metadata.annotations?.['azure.com/bugs-query-id'])
              continue;

            const orgName =
              entity.metadata.annotations?.['azure.com/organization'] ??
              'unknown-org';
            const queryId =
              entity.metadata.annotations?.['azure.com/bugs-query-id'] ??
              'unknown-query-id';

            const projectUrl = `https://dev.azure.com/${orgName}/${projectName}/_queries/query/${queryId}/`;

            projectBugMap.set(projectName, {
              bugCount: metrics.azureBugCount,
              url: projectUrl,
              failedCheck: checks.bugCountCheck === false,
            });
          }

          const entityDisplayName = entity.metadata.name;

          if (!projectToEntitiesMap.has(projectName)) {
            projectToEntitiesMap.set(projectName, []);
          }
          projectToEntitiesMap.get(projectName)!.push({
            entityName: entityDisplayName,
          });
        }

        const projectList = Array.from(projectBugMap.entries())
          .map(([project, { bugCount, url }]) => ({
            project,
            bugCount,
            url,
            entities: projectToEntitiesMap.get(project) ?? [],
          }))
          .sort((a, b) => b.bugCount - a.bugCount);

        setProjectBugs(projectList);

        const totalBugCount = projectList.reduce(
          (sum, p) => sum + p.bugCount,
          0,
        );

        // Determine color
        const failures = Array.from(projectBugMap.values()).filter(
          r => r.failedCheck,
        ).length;
        const { color } = determineSemaphoreColor(
          failures,
          entities.length,
          redThreshold,
        );

        let summary = 'No bugs detected.';
        if (color === 'yellow') {
          summary = 'Moderate bug levels found. Review advised.';
        } else if (color === 'red') {
          summary = 'High bug count detected. Immediate action recommended.';
        }

        setData({
          color,
          summary,
          metrics: { totalBugCount },
          details: [],
        });
      } catch (e) {
        // console.error('❌ Failed to fetch Azure DevOps bug data:', e);
        setProjectBugs([]);
        setData({
          color: 'gray',
          summary: 'Failed to load metrics.',
          metrics: {},
          details: [],
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchBugMetrics();
  }, [open, entities, techInsightsApi, azureUtils, catalogApi]);

  const totalBugCount = projectBugs.reduce((sum, p) => sum + p.bugCount, 0);
  const top5Projects = projectBugs.filter(p => p.bugCount > 0).slice(0, 5);

  const renderMetrics = () => (
    <>
      <Grid container spacing={2}>
        <Grid item xs={12}>
          <Paper className={classes.metricBox} elevation={1}>
            <Typography
              variant="h4"
              className={classes.metricValue}
              style={{ color: data.color }}
            >
              {totalBugCount}
            </Typography>
            <Typography className={classes.metricLabel}>
              Total Azure DevOps Bugs
            </Typography>
          </Paper>
        </Grid>
      </Grid>

      {top5Projects.length > 0 && (
        <div className={classes.projectList}>
          <Typography variant="h6">Projects with Most Bugs</Typography>
          <Grid container spacing={2} className={classes.projectList}>
            {top5Projects.map(project => (
              <Grid item xs={12} key={project.project}>
                <Paper className={classes.metricBox} elevation={1}>
                  <Link
                    href={project.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={classes.metricValue}
                  >
                    {project.project}
                  </Link>
                  <Typography className={classes.metricLabel}>
                    Bugs: {project.bugCount}
                  </Typography>

                  {project.entities.length > 0 && (
                    <Typography className={classes.metricLabel}>
                      Entities:{' '}
                      {project.entities.map(e => `${e.entityName}`).join(', ')}
                    </Typography>
                  )}
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
      title="Azure Bug Insights"
      data={data}
      isLoading={isLoading}
      renderMetrics={renderMetrics}
    />
  );
};
