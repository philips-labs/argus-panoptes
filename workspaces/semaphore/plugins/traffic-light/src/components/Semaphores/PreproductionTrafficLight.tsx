import { useMemo, useEffect, useState } from 'react';
import { Entity } from '@backstage/catalog-model';
import { useApi } from '@backstage/core-plugin-api';
import { techInsightsApiRef } from '@backstage/plugin-tech-insights';
import { catalogApiRef } from '@backstage/plugin-catalog-react';
import { PreproductionUtils } from '../../utils/preproductionUtils';
import { BaseTrafficLight } from './BaseTrafficLight';
import { determineSemaphoreColor } from '../utils';

export const PreproductionTrafficLight = ({
  entities,
  onClick,
}: {
  entities: Entity[];
  onClick?: () => void;
}) => {
  const [color, setColor] = useState<
    'green' | 'yellow' | 'red' | 'gray' | 'white'
  >('white');
  const [reason, setReason] = useState(
    'Loading Preproduction pipeline data...',
  );
  const techInsightsApi = useApi(techInsightsApiRef);
  const catalogApi = useApi(catalogApiRef);

  const preproductionUtils = useMemo(() => new PreproductionUtils(), []);

  useEffect(() => {
    const fetchData = async () => {
      if (!entities.length) {
        setColor('gray');
        setReason('No entities selected');
        return;
      }

      try {
        // 1. Fetch red threshold and configured repositories from system annotation
        let redThreshold = 0.33;
        let configuredRepoNames: string[] = [];

        try {
          const systemName = entities[0].spec?.system;
          const namespace = entities[0].metadata.namespace ?? 'default';

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
                'preproduction-check-threshold-red'
              ];
            if (thresholdAnnotation) {
              redThreshold = parseFloat(thresholdAnnotation);
            }

            // Get configured repositories for preproduction checks
            const configuredReposAnnotation =
              systemEntity?.metadata.annotations?.[
                'preproduction-configured-repositories'
              ];
            if (configuredReposAnnotation) {
              configuredRepoNames = configuredReposAnnotation
                .split(',')
                .map(name => name.trim())
                .filter(name => name.length > 0);
            }
          }
        } catch {
          // If system entity can't be fetched, proceed with default values.
        }

        // 2. Filter entities to only include configured repositories
        const filteredEntities =
          configuredRepoNames.length > 0
            ? entities.filter(entity =>
                configuredRepoNames.includes(entity.metadata.name),
              )
            : entities; // Fallback to all entities if no configuration found

        if (filteredEntities.length === 0) {
          setColor('gray');
          setReason(
            'No configured repositories found for preproduction checks',
          );
          return;
        }

        // 3. Run preproduction pipeline checks on filtered entities
        const results = await Promise.all(
          filteredEntities.map(entity =>
            preproductionUtils.getPreproductionPipelineChecks(techInsightsApi, {
              kind: entity.kind,
              namespace: entity.metadata.namespace ?? 'default',
              name: entity.metadata.name,
            }),
          ),
        );

        const failures = results.filter(
          r => r.successRateCheck === false,
        ).length;

        // 4. Determine color and reason based on filtered entities
        const { color: computedColor, reason: computedReason } =
          determineSemaphoreColor(
            failures,
            filteredEntities.length,
            redThreshold,
          );

        setColor(computedColor);
        setReason(computedReason);
      } catch {
        setColor('gray');
        setReason('Error fetching preproduction pipeline data');
      }
    };

    fetchData();
  }, [entities, techInsightsApi, catalogApi, preproductionUtils]);

  return <BaseTrafficLight color={color} tooltip={reason} onClick={onClick} />;
};
