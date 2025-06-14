import { useEffect, useMemo, useState } from 'react';
import { Entity } from '@backstage/catalog-model';
import { useApi } from '@backstage/core-plugin-api';
import { techInsightsApiRef } from '@backstage/plugin-tech-insights';
import { catalogApiRef } from '@backstage/plugin-catalog-react';
import { SonarCloudUtils } from '../../utils/sonarCloudUtils';
import { BaseTrafficLight } from './BaseTrafficLight';

/**
 * The component fetches SonarQube quality gate status for each provided entity using the Tech Insights API,
 * aggregates the results, and determines the appropriate traffic light color:
 * - Green: The number of entities that failed the quality gate is below the yellow threshold (set in system file).
 * - Yellow: The number of entities that failed the quality gate is between the yellow threshold and the red threshold(set in system file).
 * - Red: The number of entities that failed the quality gate is above the red threshold (set in system file).
 * - Gray: No entities are selected, data cannot be retrieved or threshold cannot be retrieved.
 *
 * The component also returns a reason for the color selection, which can be used in tooltips or logs.
 *
 * @param entities - An array of Backstage Entity objects to check SonarQube status for.
 * @param catalogApi - The Backstage Catalog API to fetch entity metadata.
 * @param techInsightsApi - The Backstage Tech Insights API to fetch SonarQube facts.
 * @param sonarUtils - An instance of SonarCloudUtils to interact with SonarQube data.
 * @returns an object containing the color and reason for the traffic light status.
 */
export const determineSonarQubeColor = async (
  entities: Entity[],
  catalogApi: any,
  techInsightsApi: any,
  sonarUtils: SonarCloudUtils,
): Promise<{ color: 'green' | 'red' | 'yellow' | 'gray'; reason: string }> => {
  // If no entities are provided, return gray color
  if (!entities.length) {
    return { color: 'gray', reason: 'No entities selected' };
  }

  // Filter entities to only those with SonarQube enabled
  const enabledEntities = entities.filter(
    e => e.metadata.annotations?.['sonarcloud.io/enabled'] === 'true',
  );

  if (!enabledEntities.length) {
    return { color: 'gray', reason: 'No entities have SonarQube enabled' };
  }

  // Get the system name from the first entity
  const systemName = entities[0].spec?.system;
  if (!systemName) {
    return { color: 'gray', reason: 'System metadata is missing' };
  }

  // Fetch system entity metadata from catalog
  const systemEntity = await catalogApi.getEntityByRef({
    kind: 'system',
    namespace: 'default',
    name: typeof systemName === 'string' ? systemName : String(systemName),
  });

  // Get thresholds for traffic light colour from system annotations
  const redThreshold = parseFloat(
    systemEntity?.metadata.annotations?.[
      'tech-insights.io/sonarcloud-quality-gate-red-threshold-percentage'
    ] || '50',
  );
  const yellowThreshold = parseFloat(
    systemEntity?.metadata.annotations?.[
      'tech-insights.io/sonarcloud-quality-gate-yellow-threshold-percentage'
    ] || '25',
  );

  try {
    const results = await Promise.all(
      enabledEntities.map(entity =>
        sonarUtils.getSonarQubeFacts(techInsightsApi, {
          kind: entity.kind,
          namespace: entity.metadata.namespace || 'default',
          name: entity.metadata.name,
        }),
      ),
    );

    const totalFailedQualityGate = results.reduce((acc, res) => {
      acc += res.quality_gate !== 'OK' ? 1 : 0;
      return acc;
    }, 0);

    // If the number of entities that failed the quality gate check is above the red threshold
    // Set the colour to red
    if (totalFailedQualityGate >= (redThreshold * entities.length) / 100) {
      return {
        color: 'red',
        reason: `${totalFailedQualityGate} entities failed the quality gate check`,
      };
    } else if (
      totalFailedQualityGate >=
      (yellowThreshold * entities.length) / 100
    ) {
      // If the number of entities that failed the quality gate check is between the red and the yellow threshold
      // Set the colour to yellow
      return {
        color: 'yellow',
        reason: `${totalFailedQualityGate} entities failed the quality gate check`,
      };
    }
    // If the number of entities that failed the quality gate check is below the yellow threshold
    // Set the colour to green
    return {
      color: 'green',
      reason: `${totalFailedQualityGate} entities failed the quality gate check`,
    };
  } catch (err) {
    return { color: 'gray', reason: 'Error fetching SonarQube data' };
  }
};

/**
 * SonarQubeTrafficLight is a React component that displays a colored traffic light indicator
 * representing the overall SonarQube quality status for a set of entities.
 * The component also displays a tooltip with a summary of the check results or error messages.
 *
 * @param entities - An array of Backstage Entity objects to check SonarQube status for.
 * @param onClick - Optional click handler for the traffic light indicator.
 * @returns A React element rendering the traffic light with a tooltip.
 */
export const SonarQubeTrafficLight = ({
  entities,
  onClick,
}: {
  entities: Entity[];
  system?: string | undefined;
  onClick?: () => void;
}) => {
  const [color, setColor] = useState<'green' | 'red' | 'yellow' | 'gray'>(
    'gray',
  );
  const [reason, setReason] = useState('Loading SonarQube data...');
  const techInsightsApi = useApi(techInsightsApiRef);
  const catalogApi = useApi(catalogApiRef);
  const sonarUtils = useMemo(
    () => new SonarCloudUtils(),
    [],
  );

  useEffect(() => {
    const fetchData = async () => {
      const sonarQubeColorAndReason = await determineSonarQubeColor(
        entities,
        catalogApi,
        techInsightsApi,
        sonarUtils,
      );

      setColor(sonarQubeColorAndReason.color);
      setReason(sonarQubeColorAndReason.reason);
    };

    fetchData();
  }, [entities, techInsightsApi, catalogApi, sonarUtils, setColor, setReason]);

  return <BaseTrafficLight color={color} tooltip={reason} onClick={onClick} />;
};
