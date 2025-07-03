import { useMemo, useEffect, useState } from 'react';
import { BaseTrafficLight } from './BaseTrafficLight';
import { useApi } from '@backstage/core-plugin-api';
import { techInsightsApiRef } from '@backstage/plugin-tech-insights';
import { Entity } from '@backstage/catalog-model';
import { DependabotUtils } from '../../utils/dependabotUtils';

/**
 * Determines traffic light color based on Dependabot security alerts
 * Green: No critical or high alerts
 * Yellow: Some high alerts but no critical
 * Red: At least one critical alert
 */
export const determineDependabotColor = async (
  systemName: string,
  entities: Entity[],
  techInsightsApi: any,
  dependabotUtils: DependabotUtils,
): Promise<{ color: 'green' | 'red' | 'yellow' | 'gray'; reason: string }> => {
  const filteredEntities = entities.filter(e => e.spec?.system === systemName);

  // Validate inputs and handle edge cases
  if (
    !systemName ||
    !Array.isArray(entities) ||
    filteredEntities.length === 0
  ) {
    return {
      color: 'gray',
      reason: `No entities found for system: ${systemName}`,
    };
  }
  const fallbackEntity = entities.find(e => typeof e.spec?.system === 'string');
  const fallbackSystem = fallbackEntity?.spec?.system;
  const finalSystemName = systemName ?? fallbackSystem;
  const finalSystemNameString =
    typeof finalSystemName === 'string' ? finalSystemName : undefined;

  if (!finalSystemNameString) {
    return { color: 'gray', reason: 'No valid system name available' };
  }

  try {
    // Fetch Dependabot status for all entities in parallel
    const result = await Promise.all(
      filteredEntities.map(entity =>
        dependabotUtils.getDependabotChecks(techInsightsApi, {
          kind: entity.kind,
          namespace: entity.metadata.namespace ?? 'default',
          name: entity.metadata.name,
        }),
      ),
    );

    // Count checks that failed by severity level
    const totalChecks = result.reduce(
      (acc, res) => {
        acc.critical += res.criticalAlertCheck === false ? 1 : 0;
        acc.high += res.highAlertCheck === false ? 1 : 0;
        acc.medium += res.mediumAlertCheck === false ? 1 : 0;
        return acc;
      },
      {
        critical: 0,
        high: 0,
        medium: 0,
      },
    );

    // Apply traffic light rules based on alert counts
    if (totalChecks.high === 0 && totalChecks.critical === 0) {
      return { color: 'green', reason: 'All dependabot checks passed' };
    } else if (totalChecks.critical > 0) {
      return {
        color: 'red',
        reason: `Critical alerts exceed threshold (${totalChecks.critical} > 0)`,
      };
    }
    return {
      color: 'yellow',
      reason: `${totalChecks.critical} minor critical issues in dependabot alerts`,
    };
  } catch {
    return { color: 'gray', reason: 'Error fetching dependabot data' };
  }
};

/**
 * Component that displays a traffic light for Dependabot security status
 */
export const TrafficLightDependabot = ({
  entities,
  systemName,
  onClick,
}: {
  entities: Entity[];
  systemName: string;
  onClick?: () => void;
}) => {
  const [color, setColor] = useState<'green' | 'red' | 'yellow' | 'gray'>(
    'gray',
  );
  const [reason, setReason] = useState('Fetching Dependabot status...');

  const techInsightsApi = useApi(techInsightsApiRef);
  const dependabotUtils = useMemo(() => new DependabotUtils(), []);

  // Fetch and update status when dependencies change
  useEffect(() => {
    if (!entities.length) {
      setColor('gray');
      setReason('No entities selected');
      return;
    }

    const fetchData = async () => {
      const filteredEntities = entities.filter(
        e => e.spec?.system === systemName,
      );

      if (!systemName || filteredEntities.length === 0) {
        setColor('gray');
        setReason(`No entities found for system: ${systemName}`);
        return;
      }
      const dependabotColorAndReason = await determineDependabotColor(
        systemName,
        filteredEntities,
        techInsightsApi,
        dependabotUtils,
      );

      setColor(dependabotColorAndReason.color);
      setReason(dependabotColorAndReason.reason);
    };
    fetchData();
  }, [entities, techInsightsApi, dependabotUtils, systemName]);

  return <BaseTrafficLight color={color} tooltip={reason} onClick={onClick} />;
};
