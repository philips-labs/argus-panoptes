/**
 * Azure DevOps Bugs Traffic Light
 * Visualizes bug count status across Azure DevOps projects
 */
import { useMemo, useEffect, useState } from 'react';
import { Entity } from '@backstage/catalog-model';
import { useApi } from '@backstage/core-plugin-api';
import { techInsightsApiRef } from '@backstage/plugin-tech-insights';
import { catalogApiRef } from '@backstage/plugin-catalog-react';
import { AzureUtils } from '../../utils/azureUtils';
import { Box, Tooltip } from '@material-ui/core';
import { determineSemaphoreColor } from '../utils';

/**
 * Traffic light component showing Azure DevOps bug counts
 */
export const AzureDevOpsBugsTrafficLight = ({
  entities,
  onClick,
}: {
  entities: Entity[];
  onClick?: () => void;
}) => {
  const [color, setColor] = useState<
    'green' | 'red' | 'yellow' | 'gray' | 'white'
  >('white');
  const [reason, setReason] = useState<string>(
    'Loading Azure DevOps bug data...',
  );

  const techInsightsApi = useApi(techInsightsApiRef);
  const catalogApi = useApi(catalogApiRef);
  const azureUtils = useMemo(() => new AzureUtils(), []);

  useEffect(() => {
    const fetchAzureData = async () => {
      if (!entities || entities.length === 0) {
        setColor('gray');
        setReason('No entities selected');
        return;
      }

      try {
        // 1. Get red threshold from system annotation
        let redThreshold = 0.33;
        const systemName = entities[0].spec?.system;
        const namespace = entities[0].metadata.namespace ?? 'default';

        if (systemName) {
          const systemEntity = await catalogApi.getEntityByRef({
            kind: 'System',
            namespace,
            name:
              typeof systemName === 'string' ? systemName : String(systemName),
          });

          const thresholdAnnotation =
            systemEntity?.metadata.annotations?.[
              'azure-bugs-check-threshold-red'
            ];
          if (thresholdAnnotation) {
            redThreshold = parseFloat(thresholdAnnotation);
          }
        }

        // 2. Map Azure DevOps projects to their bug counts and check status
        const projectBugMap = new Map<
          string,
          { bugCount: number; url: string; failedCheck: boolean }
        >();

        // 3. Process each entity to get its Azure DevOps bug metrics
        for (const entity of entities) {
          const ref = {
            kind: entity.kind,
            namespace: entity.metadata.namespace ?? 'default',
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

            // Build URL to Azure DevOps bug query
            const projectUrl = `https://dev.azure.com/${orgName}/${projectName}/_queries/query/${queryId}/`;

            projectBugMap.set(projectName, {
              bugCount: metrics.azureBugCount,
              url: projectUrl,
              failedCheck: checks.bugCountCheck === false,
            });
          }
        }

        // 4. Count projects that failed their bug threshold checks
        const failures = Array.from(projectBugMap.values()).filter(
          r => r.failedCheck,
        ).length;

        // 5. Determine traffic light color based on failure ratio
        const { color: computedColor, reason: computedReason } =
          determineSemaphoreColor(failures, entities.length, redThreshold);

        setColor(computedColor);
        setReason(computedReason);
      } catch {
        setColor('gray');
        setReason('Failed to retrieve Azure DevOps bug data');
      }
    };

    fetchAzureData();
  }, [entities, techInsightsApi, catalogApi, azureUtils]);

  // Render traffic light with tooltip showing status reason
  return (
    <Tooltip title={reason} placement="right">
      <Box
        my={1}
        width={50}
        height={50}
        borderRadius="50%"
        bgcolor={color}
        onClick={onClick}
        style={onClick ? { cursor: 'pointer' } : {}}
      />
    </Tooltip>
  );
};
