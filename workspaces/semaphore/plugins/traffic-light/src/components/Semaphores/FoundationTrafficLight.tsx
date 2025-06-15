import { useMemo, useEffect, useState } from 'react';
import { Entity } from '@backstage/catalog-model';
import { useApi } from '@backstage/core-plugin-api';
import { techInsightsApiRef } from '@backstage/plugin-tech-insights';
import { catalogApiRef } from '@backstage/plugin-catalog-react';
import { FoundationUtils } from '../../utils/foundationUtils';
import { BaseTrafficLight } from './BaseTrafficLight';
import { determineSemaphoreColor } from '../utils';

export const FoundationTrafficLight = ({
  entities,
  onClick,
}: {
  entities: Entity[];
  onClick?: () => void;
}) => {
  const [color, setColor] = useState<
    'green' | 'yellow' | 'red' | 'gray' | 'white'
  >('white');
  const [reason, setReason] = useState('Loading Foundation pipeline data...');
  const techInsightsApi = useApi(techInsightsApiRef);
  const catalogApi = useApi(catalogApiRef);

  const foundationUtils = useMemo(() => new FoundationUtils(), []);

  useEffect(() => {
    const fetchData = async () => {
      if (!entities.length) {
        setColor('gray');
        setReason('No entities selected');
        return;
      }

      try {
        // Step 1: Determine system entity and get configuration
        const systemName = entities[0].spec?.system;
        const namespace = entities[0].metadata.namespace || 'default';

        const systemEntity = systemName
          ? await catalogApi.getEntityByRef({
              kind: 'System',
              namespace,
              name:
                typeof systemName === 'string'
                  ? systemName
                  : String(systemName),
            })
          : null;

        // Step 2: Get threshold from annotation or default to 0.33 (i.e. 1/3)
        const redThresholdRaw =
          systemEntity?.metadata.annotations?.[
            'foundation-check-threshold-red'
          ] || '0.33';
        const redThreshold = parseFloat(redThresholdRaw);

        // Step 3: Get configured repositories for foundation checks
        let configuredRepoNames: string[] = [];
        const configuredReposAnnotation =
          systemEntity?.metadata.annotations?.[
            'foundation-configured-repositories'
          ];
        if (configuredReposAnnotation) {
          configuredRepoNames = configuredReposAnnotation
            .split(',')
            .map(name => name.trim())
            .filter(name => name.length > 0);
        }

        // Step 4: Filter entities to only include configured repositories
        const filteredEntities =
          configuredRepoNames.length > 0
            ? entities.filter(entity =>
                configuredRepoNames.includes(entity.metadata.name),
              )
            : entities; // Fallback to all entities if no configuration found

        if (filteredEntities.length === 0) {
          setColor('gray');
          setReason('No configured repositories found for foundation checks');
          return;
        }

        // Step 5: Get foundation results for filtered entities
        const results = await Promise.all(
          filteredEntities.map(entity =>
            foundationUtils.getFoundationPipelineChecks(techInsightsApi, {
              kind: entity.kind,
              namespace: entity.metadata.namespace || 'default',
              name: entity.metadata.name,
            }),
          ),
        );

        const failures = results.filter(
          r => r.successRateCheck === false,
        ).length;

        // Step 6: Apply modular logic based on filtered entities
        const { color: newColor, reason: newReason } = determineSemaphoreColor(
          failures,
          filteredEntities.length,
          redThreshold,
        );

        setColor(newColor);
        setReason(newReason);
      } catch (err) {
        setColor('gray');
        setReason('Error fetching foundation pipeline data');
      }
    };

    fetchData();
  }, [entities, techInsightsApi, catalogApi, foundationUtils]);

  return <BaseTrafficLight color={color} tooltip={reason} onClick={onClick} />;
};
