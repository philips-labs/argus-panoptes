import { useMemo, useEffect, useState } from 'react';
import { Entity } from '@backstage/catalog-model';
import { useApi } from '@backstage/core-plugin-api';
import { techInsightsApiRef } from '@backstage/plugin-tech-insights';
import { GithubAdvancedSecurityUtils } from '../../utils/githubAdvancedSecurityUtils';
import { catalogApiRef } from '@backstage/plugin-catalog-react';
import { Box, Tooltip } from '@material-ui/core';

// Types
type TrafficLightColor = 'green' | 'red' | 'yellow' | 'gray' | 'white';

interface SecurityThresholds {
  critical_red: number;
  high_red: number;
  secrets_red: number;
  medium_red: number;
  medium_yellow: number;
  low_yellow: number;
}

interface SecurityCheckTotals {
  criticalCheckTrue: number;
  highCheckTrue: number;
  mediumCheckTrue: number;
  lowCheckTrue: number;
  secretCheckTrue: number;
  criticalEntities: string[];
  highEntities: string[];
  mediumEntities: string[];
  lowEntities: string[];
  secretEntities: string[];
}

interface SecurityResult {
  criticalCheck: boolean;
  highCheck: boolean;
  mediumCheck: boolean;
  lowCheck: boolean;
  secretCheck: boolean;
}

interface TrafficLightResult {
  color: TrafficLightColor;
  reason: string;
}

interface GitHubSecurityTrafficLightProps {
  entities: Entity[];
  onClick?: () => void;
}

/**
 * Determines the traffic light color and reason based on security data
 */
export function calculateGitHubSecurityTrafficLight(
  securityData: SecurityResult[],
  entities: Entity[],
  thresholds: SecurityThresholds,
): TrafficLightResult {
  if (!entities.length) {
    return {
      color: 'gray',
      reason: 'No entities selected',
    };
  }

  if (!securityData.length) {
    return {
      color: 'gray',
      reason: 'No security data available',
    };
  }

  // Count total number of failed checks for each metric and track entity names
  const totalChecks = securityData.reduce(
    (acc, result, index) => {
      const entityName = entities[index]?.metadata.name || `Entity ${index}`;

      if (result.criticalCheck) {
        acc.criticalCheckTrue += 1;
        acc.criticalEntities.push(entityName);
      }

      if (result.highCheck) {
        acc.highCheckTrue += 1;
        acc.highEntities.push(entityName);
      }

      if (result.mediumCheck) {
        acc.mediumCheckTrue += 1;
        acc.mediumEntities.push(entityName);
      }

      if (result.lowCheck) {
        acc.lowCheckTrue += 1;
        acc.lowEntities.push(entityName);
      }

      if (result.secretCheck) {
        acc.secretCheckTrue += 1;
        acc.secretEntities.push(entityName);
      }

      return acc;
    },
    {
      criticalCheckTrue: 0,
      highCheckTrue: 0,
      mediumCheckTrue: 0,
      lowCheckTrue: 0,
      secretCheckTrue: 0,
      criticalEntities: [] as string[],
      highEntities: [] as string[],
      mediumEntities: [] as string[],
      lowEntities: [] as string[],
      secretEntities: [] as string[],
    } as SecurityCheckTotals,
  );

  // Determine color and reason based on thresholds
  const isRedCondition =
    totalChecks.criticalCheckTrue > thresholds.critical_red ||
    totalChecks.secretCheckTrue > thresholds.secrets_red ||
    totalChecks.highCheckTrue > thresholds.high_red ||
    totalChecks.mediumCheckTrue > thresholds.medium_red;

  const isYellowCondition =
    totalChecks.mediumCheckTrue > thresholds.medium_yellow ||
    totalChecks.lowCheckTrue > thresholds.low_yellow;

  if (isRedCondition) {
    return {
      color: 'red',
      reason: formatRedReason(totalChecks, thresholds),
    };
  } else if (isYellowCondition) {
    return {
      color: 'yellow',
      reason: formatYellowReason(totalChecks, thresholds),
    };
  }
  return {
    color: 'green',
    reason: 'All GitHub security checks passed for all entities',
  };
}

/**
 * Format reason message for red traffic light
 */
function formatRedReason(
  totalChecks: SecurityCheckTotals,
  thresholds?: SecurityThresholds,
): string {
  const parts: string[] = [];

  if (totalChecks.criticalCheckTrue > (thresholds?.critical_red ?? 0)) {
    if (thresholds?.critical_red !== undefined) {
      parts.push(
        `Critical severity issues are exceeded by ${totalChecks.criticalCheckTrue} repos, the threshold for this system is: ${thresholds.critical_red}`,
      );
    }
  }
  if (totalChecks.secretCheckTrue > (thresholds?.secrets_red ?? 0)) {
    if (thresholds?.secrets_red !== undefined) {
      parts.push(
        `Secret scanning issues are exceeded by ${totalChecks.secretCheckTrue} repos, the threshold for this system is: ${thresholds.secrets_red}`,
      );
    }
  }
  if (totalChecks.highCheckTrue > (thresholds?.high_red ?? 0)) {
    if (thresholds?.high_red !== undefined) {
      parts.push(
        `High severity issues are exceeded by ${totalChecks.highCheckTrue} repos, the threshold for this system is: ${thresholds.high_red}`,
      );
    }
  }
  if (totalChecks.mediumCheckTrue > (thresholds?.medium_red ?? 0)) {
    if (thresholds?.medium_red !== undefined) {
      parts.push(
        `Medium severity issues are exceeded by ${
          totalChecks.mediumCheckTrue
        } repos, the threshold for this system is: ${parseFloat(
          thresholds.medium_red.toFixed(1),
        )}`,
      );
    }
  }
  return parts.join('\n') || 'Threshold for red traffic light exceeded.';
}

/**
 * Format reason message for yellow traffic light
 */
function formatYellowReason(
  totalChecks: SecurityCheckTotals,
  thresholds?: SecurityThresholds,
): string {
  const parts: string[] = [];

  if (totalChecks.mediumCheckTrue > (thresholds?.medium_yellow ?? 0)) {
    if (thresholds?.medium_yellow !== undefined) {
      parts.push(
        `Medium severity issues are exceeded by ${
          totalChecks.mediumCheckTrue
        } repos, the threshold for this system is: ${parseFloat(
          thresholds.medium_yellow.toFixed(1),
        )}`,
      );
    }
  }
  if (totalChecks.lowCheckTrue > (thresholds?.low_yellow ?? 0)) {
    if (thresholds?.low_yellow !== undefined) {
      parts.push(
        `Low severity issues are exceeded by ${
          totalChecks.lowCheckTrue
        } repos, the threshold for this system is: ${parseFloat(
          thresholds.low_yellow.toFixed(1),
        )}`,
      );
    }
  }
  return parts.join('\n') || 'Threshold for yellow traffic light exceeded.';
}

/**
 * Extract security thresholds from system entity
 */
export function extractSecurityThresholds(
  systemEntity: Entity | undefined,
  entityCount: number,
): SecurityThresholds {
  const annotations = systemEntity?.metadata.annotations || {};

  return {
    critical_red: parseFloat(
      annotations['github-advanced-security-system-critical-threshold-red'] ||
        '0',
    ),
    high_red: parseFloat(
      annotations['github-advanced-security-system-high-threshold-red'] || '0',
    ),
    secrets_red: parseFloat(
      annotations['github-advanced-security-system-secrets-threshold-red'] ||
        '0',
    ),
    medium_red:
      parseFloat(
        annotations['github-advanced-security-system-medium-threshold-red'] ||
          '0.5',
      ) * entityCount,
    medium_yellow:
      parseFloat(
        annotations[
          'github-advanced-security-system-medium-threshold-yellow'
        ] || '0.1',
      ) * entityCount,
    low_yellow:
      parseFloat(
        annotations['github-advanced-security-system-low-threshold-yellow'] ||
          '0.2',
      ) * entityCount,
  };
}

/**
 * Main GitHub Security Traffic Light Component
 */
export const GitHubSecurityTrafficLight = ({
  entities,
  onClick,
}: GitHubSecurityTrafficLightProps) => {
  const [color, setColor] = useState<TrafficLightColor>('white');
  const [reason, setReason] = useState<string>(
    'Loading GitHub Security data...',
  );

  const techInsightsApi = useApi(techInsightsApiRef);
  const catalogApi = useApi(catalogApiRef);

  const githubASUtils = useMemo(() => new GithubAdvancedSecurityUtils(), []);

  useEffect(() => {
    const fetchGitHubSecurityData = async () => {
      if (!entities.length) {
        setColor('gray');
        setReason('No entities selected');
        return;
      }

      try {
        // Get system entity and thresholds
        const systemName = entities[0].spec?.system;
        if (!systemName) {
          setColor('gray');
          setReason('No system name found in entities');
          return;
        }

        const systemEntity = await catalogApi.getEntityByRef({
          kind: 'System',
          namespace: entities[0].metadata.namespace ?? 'default',
          name:
            typeof systemName === 'string'
              ? systemName
              : JSON.stringify(systemName),
        });

        const thresholds = extractSecurityThresholds(
          systemEntity,
          entities.length,
        );

        // Get security data for all entities
        const securityData = await Promise.all(
          entities.map(entity =>
            githubASUtils.getGitHubSecurityData(techInsightsApi, {
              kind: entity.kind,
              namespace: entity.metadata.namespace ?? 'default',
              name: entity.metadata.name,
            }),
          ),
        );

        // Calculate traffic light color and reason
        const result = calculateGitHubSecurityTrafficLight(
          securityData,
          entities,
          thresholds,
        );
        setColor(result.color);
        setReason(result.reason);
      } catch {
        setColor('gray');
        setReason('Failed to retrieve GitHub Security data');
      }
    };

    fetchGitHubSecurityData();
  }, [entities, techInsightsApi, catalogApi, githubASUtils]);

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
