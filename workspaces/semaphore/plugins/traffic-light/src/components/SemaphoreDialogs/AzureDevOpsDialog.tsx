/**
 * AzureDevOpsDialog Component
 *
 * This component displays a dialog containing information about Azure DevOps bugs
 * for entities in a Backstage catalog. It shows bug metrics including total count,
 * project breakdown, and traffic light indicators based on threshold values.
 *
 * The component fetches bug data from Azure DevOps using Tech Insights API
 * and presents it in a user-friendly format with visual indicators of severity.
 */

import { Grid, Paper, Typography, Link } from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles';
import { useApi } from '@backstage/core-plugin-api';
import {
  TechInsightsApi,
  techInsightsApiRef,
} from '@backstage/plugin-tech-insights';
import { Entity } from '@backstage/catalog-model';
import { BaseSemaphoreDialog } from './BaseSemaphoreDialogs';
import { AzureUtils } from '../../utils/azureUtils';
import { determineSemaphoreColor } from '../utils';
import { SemaphoreData } from './types';
import { CatalogApi, catalogApiRef } from '@backstage/plugin-catalog-react';
import { useState, useMemo, useEffect } from 'react';
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
  projectList: {
    marginTop: theme.spacing(3),
  },
}));

interface AzureBugInsightsDialogProps {
  /** Whether the dialog is open */
  open: boolean;
  /** Callback function to close the dialog */
  onClose: () => void;
  /** Entities to fetch bug data for */
  entities?: Entity[];
}

/**
 * Fetches the system-level threshold for bug counts.
 *
 * Looks up the system entity associated with the provided entities and
 * retrieves the 'azure-bugs-check-threshold-red' annotation to determine
 * the threshold at which the bug count should be considered "red" (critical).
 *
 * @param catalogApi - The Backstage catalog API
 * @param entities - List of entities to derive the system from
 * @returns The threshold value (default: 0.33 if not specified)
 */
function getSystemThreshold(
  catalogApi: CatalogApi,
  entities: Entity[],
): Promise<number> {
  const defaultThreshold = 0.33;

  if (!entities.length) {
    return Promise.resolve(defaultThreshold);
  }

  const systemName = entities[0].spec?.system;
  const namespace = entities[0].metadata.namespace ?? 'default';

  if (typeof systemName !== 'string' || !systemName) {
    return Promise.resolve(defaultThreshold);
  }

  return catalogApi
    .getEntityByRef({
      kind: 'System',
      namespace,
      name: String(systemName),
    })
    .then(systemEntity => {
      const thresholdAnnotation =
        systemEntity?.metadata.annotations?.['azure-bugs-check-threshold-red'];
      return thresholdAnnotation
        ? parseFloat(thresholdAnnotation)
        : defaultThreshold;
    })
    .catch(() => {
      // Could not fetch system threshold annotation; using default 0.33
      return defaultThreshold;
    });
}

/**
 * Data structure for bug information for a specific Azure DevOps project
 */
type ProjectBugData = {
  /** Number of bugs in the project */
  bugCount: number;
  /** URL to the bugs query in Azure DevOps */
  url: string;
  /** Whether the project failed the bug check based on thresholds */
  failedCheck: boolean;
};

/**
 * Information about an entity within a project
 */
type ProjectEntityInfo = { entityName: string };

/**
 * Processes a list of entities to fetch and map their Azure DevOps bug data.
 *
 * This function:
 * 1. Groups entities by their associated Azure DevOps projects
 * 2. Fetches bug data for each unique project
 * 3. Creates mappings between projects, bug data, and related entities
 *
 * @param entities - List of catalog entities to process
 * @param azureUtils - Utility for Azure DevOps operations
 * @param techInsightsApi - API for accessing Tech Insights data
 * @returns Maps of project bug data and entities per project
 */
async function processEntitiesForBugs(
  entities: Entity[],
  azureUtils: AzureUtils,
  techInsightsApi: TechInsightsApi,
): Promise<{
  projectBugMap: Map<string, ProjectBugData>;
  projectToEntitiesMap: Map<string, ProjectEntityInfo[]>;
}> {
  const projectBugMap = new Map<string, ProjectBugData>();
  const projectToEntitiesMap = new Map<string, ProjectEntityInfo[]>();

  for (const entity of entities) {
    const projectName =
      entity.metadata.annotations?.['azure.com/project'] ?? 'unknown';

    // Group entities by project name
    if (!projectToEntitiesMap.has(projectName)) {
      projectToEntitiesMap.set(projectName, []);
    }
    projectToEntitiesMap
      .get(projectName)!
      .push({ entityName: entity.metadata.name });

    // Fetch bug data once per project, skipping if already fetched or invalid
    const queryId = entity.metadata.annotations?.['azure.com/bugs-query-id'];
    if (
      projectName === 'unknown' ||
      projectBugMap.has(projectName) ||
      !queryId
    ) {
      continue;
    }

    const ref = {
      kind: entity.kind,
      namespace: entity.metadata.namespace ?? 'default',
      name: entity.metadata.name,
    };

    // Fetch both metrics and check results in parallel
    const [metrics, checks] = await Promise.all([
      azureUtils.getAzureDevOpsBugFacts(techInsightsApi, ref),
      azureUtils.getAzureDevOpsBugChecks(techInsightsApi, ref),
    ]);

    const orgName =
      entity.metadata.annotations?.['azure.com/organization'] ?? 'unknown-org';
    const projectUrl = `https://dev.azure.com/${orgName}/${projectName}/_queries/query/${queryId}/`;

    projectBugMap.set(projectName, {
      bugCount: metrics.azureBugCount,
      url: projectUrl,
      failedCheck: checks.bugCountCheck === false,
    });
  }

  return { projectBugMap, projectToEntitiesMap };
}

/**
 * Main component for displaying Azure DevOps bug information in a dialog.
 *
 * This component fetches bug data from Azure DevOps for the provided entities,
 * calculates metrics, and displays them in a dialog with visual indicators.
 */
export const AzureDevOpsSemaphoreDialog: React.FC<
  AzureBugInsightsDialogProps
> = ({ open, onClose, entities = [] }) => {
  const classes = useStyles();
  const techInsightsApi = useApi(techInsightsApiRef);
  const azureUtils = useMemo(() => new AzureUtils(), []);
  const catalogApi = useApi(catalogApiRef);

  // State for loading status and data
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

  /**
   * Effect to fetch bug metrics when the dialog is opened
   */
  useEffect(() => {
    if (!open || entities.length === 0) return;

    const fetchBugMetrics = async () => {
      setIsLoading(true);
      try {
        // Get threshold configuration from system entity
        const redThreshold = await getSystemThreshold(catalogApi, entities);

        // Process entities to get bug data
        const { projectBugMap, projectToEntitiesMap } =
          await processEntitiesForBugs(entities, azureUtils, techInsightsApi);

        // Convert map data to sorted array for display
        const projectList = Array.from(projectBugMap.entries())
          .map(([project, { bugCount, url }]) => ({
            project,
            bugCount,
            url,
            entities: projectToEntitiesMap.get(project) ?? [],
          }))
          .sort((a, b) => b.bugCount - a.bugCount);

        setProjectBugs(projectList);

        // Calculate total bugs across all projects
        const totalBugCount = projectList.reduce(
          (sum, p) => sum + p.bugCount,
          0,
        );

        // Determine traffic light color based on threshold and failure count
        const failures = Array.from(projectBugMap.values()).filter(
          r => r.failedCheck,
        ).length;
        const { color } = determineSemaphoreColor(
          failures,
          entities.length,
          redThreshold,
        );

        // Generate summary message based on severity
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
      } catch {
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

  // Calculated metrics for display
  const totalBugCount = projectBugs.reduce((sum, p) => sum + p.bugCount, 0);
  const top5Projects = projectBugs.filter(p => p.bugCount > 0).slice(0, 5);

  /**
   * Renders the metrics section of the dialog, including:
   * - Total bug count
   * - Top 5 projects with most bugs
   * - Links to Azure DevOps queries
   */
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

  // Render the base semaphore dialog with our custom metrics
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
