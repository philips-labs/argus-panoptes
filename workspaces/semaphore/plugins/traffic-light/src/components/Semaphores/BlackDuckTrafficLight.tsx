import { useMemo, useEffect, useState } from 'react';
import { Entity } from '@backstage/catalog-model';
import { useApi } from '@backstage/core-plugin-api';
import { techInsightsApiRef } from '@backstage/plugin-tech-insights';
import { catalogApiRef } from '@backstage/plugin-catalog-react';
import { BlackDuckUtils } from '../../utils/blackDuckUtils';
import { BaseTrafficLight } from './BaseTrafficLight';

/**
 * This component fetches BlackDuck check results for each provided entity using the Tech Insights API,
 * aggregates the results, and determines the appropriate traffic light color:
 * - Green: All checks pass for all entities
 * - Yellow: There are some security issues reported by BlackDuck, but no critical issues, and no checks were failed by at more than 1/3 of the entities
 * - Red: There are critical security issues reported by BlackDuck, or at least one check was failed by at least 1/3 of the entities
 * - Gray: Entity or system cannot be retrieved or no entitis are selected.
 *
 * The component also displays a tooltip with a summary of the check results or error messages.
 *
 * @param entities - An array of Backstage Entity objects to check BlackDuck status for.
 * @param techInsightsApi - The Backstage Tech Insights API to fetch BlackDuck facts.
 * @param blackDuckUtils - An instance of BlackDuckUtils to interact with BlackDuck data.
 * @returns an object containing the color and reason for the traffic light status.
 */
export const determineBlackDuckColor = async (
  entities: Entity[],
  catalogApi: any,
  techInsightsApi: any,
  blackDuckUtils: BlackDuckUtils,
): Promise<{ color: 'green' | 'red' | 'yellow' | 'gray'; reason: string }> => {
  // If no entities are provided, return gray color
  if (!entities.length) {
    return { color: 'gray', reason: 'No entities selected' };
  }

  // Filter entities to only those with BlackDuck enabled
  const enabledEntities = entities.filter(
    e =>
      e.metadata.annotations?.['tech-insights.io/blackduck-enabled'] === 'true',
  );

  if (!enabledEntities.length) {
    return { color: 'gray', reason: 'No entities have BlackDuck enabled' };
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
  const proportion = parseFloat(
    systemEntity?.metadata.annotations?.[
      'tech-insights.io/blackduck-critical-check-percentage'
    ] || '33',
  );

  try {
    // Get the check results for each entity
    const results = await Promise.all(
      enabledEntities.map(entity =>
        blackDuckUtils.getBlackDuckChecks(techInsightsApi, {
          kind: entity.kind,
          namespace: entity.metadata.namespace || 'default',
          name: entity.metadata.name,
        }),
      ),
    );

    // Aggregate the results
    const counts = results.reduce(
      (acc, res) => {
        acc.criticalSecurityCheckFails +=
          res.criticalSecurityCheck === false ? 1 : 0;
        acc.highSecurityCheckFails += res.highSecurityCheck === false ? 1 : 0;
        acc.mediumSecurityCheckFails +=
          res.mediumSecurityCheck === false ? 1 : 0;
        return acc;
      },
      {
        criticalSecurityCheckFails: 0,
        highSecurityCheckFails: 0,
        mediumSecurityCheckFails: 0,
      },
    );

    // Count the number of checks that failed for more than 1/3 of the entities
    const redCount = Object.values(counts).filter(
      v => v > (enabledEntities.length * 100) / proportion,
    ).length;

    if (Object.values(counts).every(v => v === 0)) {
      // All checks passed for all entities
      return { color: 'green', reason: 'All BlackDuck checks passed' };
    } else if (counts.criticalSecurityCheckFails > 0 || redCount >= 1) {
      // Critical security issues or at least one check failed for more than 1/3 of the entities
      return {
        color: 'red',
        reason: `Critical security checks found or other severe security issues detected`,
      };
    }
    // Some security issues, but no critical issues and no checks failed for more than 1/3 of the entities
    return { color: 'yellow', reason: `Some security issues detected` };
  } catch (err) {
    return { color: 'gray', reason: 'Error fetching BlackDuck data' };
  }
};

/**
 * BlackDuckTrafficLight is a React component that displays a colored traffic light indicator
 * representing the overall BlackDuck quality status for a set of entities.
 * The component also displays a tooltip with a summary of the check results or error messages.
 *
 * @param entities - An array of Backstage Entity objects to check BlackDuck status for.
 * @param onClick - Optional click handler for the traffic light indicator.
 * @returns A React element rendering the traffic light with a tooltip.
 */
export const BlackDuckTrafficLight = ({
  entities,
  onClick,
}: {
  entities: Entity[];
  onClick?: () => void;
}) => {
  const [color, setColor] = useState<'green' | 'red' | 'yellow' | 'gray'>(
    'gray',
  );
  const [reason, setReason] = useState('Loading BlackDuck data...');
  const techInsightsApi = useApi(techInsightsApiRef);
  const catalogApi = useApi(catalogApiRef);

  const blackDuckUtils = useMemo(
    () => new BlackDuckUtils(),
    [],
  );

  useEffect(() => {
    const fetchData = async () => {
      const blackDuckColorAndReason = await determineBlackDuckColor(
        entities,
        catalogApi,
        techInsightsApi,
        blackDuckUtils,
      );

      setColor(blackDuckColorAndReason.color);
      setReason(blackDuckColorAndReason.reason);
    };

    fetchData();
  }, [entities, techInsightsApi, catalogApi, blackDuckUtils]);

  return <BaseTrafficLight color={color} tooltip={reason} onClick={onClick} />;
};
