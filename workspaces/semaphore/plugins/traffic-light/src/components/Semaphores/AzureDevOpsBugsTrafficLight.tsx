import { useMemo, useEffect, useState } from 'react';
import { Entity } from '@backstage/catalog-model';
import { useApi } from '@backstage/core-plugin-api';
import { techInsightsApiRef } from '@backstage/plugin-tech-insights';
import { catalogApiRef } from '@backstage/plugin-catalog-react';
import { AzureUtils } from '../../utils/azureUtils';
import { Box, Tooltip } from '@material-ui/core';
import { determineSemaphoreColor } from '../utils';

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
        } catch (e) {
          // console.warn(
          //   'Failed to read azure bugs red threshold, using default 0.33',
          // );
        }

        // 2. Fetch facts + checks, and skip entities with null bug counts
        const validResults = await Promise.all(
          entities.map(async entity => {
            const ref = {
              kind: entity.kind,
              namespace: entity.metadata.namespace || 'default',
              name: entity.metadata.name,
            };

            const [, checks] = await Promise.all([
              azureUtils.getAzureDevOpsBugFacts(techInsightsApi, ref),
              azureUtils.getAzureDevOpsBugChecks(techInsightsApi, ref),
            ]);

            if (!entity.metadata.annotations?.['azure.com/bugs-query-id'])
              return null;

            return {
              failedCheck: checks.bugCountCheck === false,
            };
          }),
        );

        // 3. Filter out nulls (entities with no data)
        const filteredResults = validResults.filter(Boolean) as {
          failedCheck: boolean;
        }[];

        const failures = filteredResults.filter(r => r.failedCheck).length;

        const { color: computedColor, reason: computedReason } =
          determineSemaphoreColor(failures, entities.length, redThreshold);

        setColor(computedColor);
        setReason(computedReason);
      } catch (err) {
        // console.error('Error fetching Azure DevOps bug data:', err);
        setColor('gray');
        setReason('Failed to retrieve Azure DevOps bug data');
      }
    };

    fetchAzureData();
  }, [entities, techInsightsApi, catalogApi, azureUtils]);

  return (
    <Tooltip title={reason}>
      <div>
        <Box
          my={1}
          width={50}
          height={50}
          borderRadius="50%"
          bgcolor={color}
          onClick={onClick}
          style={onClick ? { cursor: 'pointer' } : {}}
        />
      </div>
    </Tooltip>
  );
};
