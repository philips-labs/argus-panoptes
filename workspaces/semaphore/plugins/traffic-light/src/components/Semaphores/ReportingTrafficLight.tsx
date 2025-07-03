import { useMemo, useEffect, useState, useCallback } from 'react';
import { Entity } from '@backstage/catalog-model';
import { useApi } from '@backstage/core-plugin-api';
import { techInsightsApiRef } from '@backstage/plugin-tech-insights';
import { catalogApiRef } from '@backstage/plugin-catalog-react';
import { ReportingUtils } from '../../utils/reportingUtils';
import { BaseTrafficLight } from './BaseTrafficLight';
import { determineSemaphoreColor } from '../utils';

interface ReportingTrafficLightProps {
  entities: Entity[];
  onClick?: () => void;
}

/**
 * ReportingTrafficLight is a React component that displays a colored traffic light indicator
 * representing the overall Reporting pipeline quality status for a set of entities.
 *
 * @param entities - An array of Backstage Entity objects to check Reporting pipeline status for.
 * @param onClick - Optional click handler for the traffic light indicator.
 * @returns A React element rendering the traffic light with a tooltip.
 */
export const ReportingTrafficLight = ({
  entities,
  onClick,
}: ReportingTrafficLightProps) => {
  const [color, setColor] = useState<
    'green' | 'yellow' | 'red' | 'gray' | 'white'
  >('white');
  const [reason, setReason] = useState('Loading Reporting pipeline data...');

  const techInsightsApi = useApi(techInsightsApiRef);
  const catalogApi = useApi(catalogApiRef);
  const reportingUtils = useMemo(() => new ReportingUtils(), []);

  /**
   * Fetches the red threshold from system entity annotation
   * Uses defensive programming instead of exception handling
   */
  const fetchRedThreshold = useCallback(
    async (entityList: Entity[]): Promise<number> => {
      const defaultThreshold = 0.33;

      if (!entityList.length) return defaultThreshold;

      const systemName = entityList[0].spec?.system;
      const namespace = entityList[0].metadata.namespace ?? 'default';

      if (!systemName) return defaultThreshold;

      const systemEntityRef = {
        kind: 'System',
        namespace,
        name:
          typeof systemName === 'string'
            ? systemName
            : JSON.stringify(systemName),
      };

      const systemEntity = await catalogApi.getEntityByRef(systemEntityRef);

      const thresholdAnnotation =
        systemEntity?.metadata.annotations?.['reporting-check-threshold-red'];

      if (!thresholdAnnotation) return defaultThreshold;

      const parsed = parseFloat(thresholdAnnotation);
      return isNaN(parsed) ? defaultThreshold : parsed;
    },
    [catalogApi],
  );

  /**
   * Fetches reporting pipeline checks for all entities
   * Lets individual promise rejections bubble up naturally
   */
  const fetchReportingChecks = useCallback(
    async (entityList: Entity[]) => {
      const checkPromises = entityList.map(entity =>
        reportingUtils.getReportingPipelineChecks(techInsightsApi, {
          kind: entity.kind,
          namespace: entity.metadata.namespace ?? 'default',
          name: entity.metadata.name,
        }),
      );

      const results = await Promise.allSettled(checkPromises);

      // Count only fulfilled promises where successRateCheck is false
      const failures = results
        .filter(result => result.status === 'fulfilled')
        .map(result => (result as PromiseFulfilledResult<any>).value)
        .filter(r => r?.successRateCheck === false).length;

      return { failures, total: entityList.length };
    },
    [reportingUtils, techInsightsApi],
  );

  useEffect(() => {
    if (!entities.length) {
      setColor('gray');
      setReason('No entities selected');
      return;
    }

    const processData = async () => {
      // Default values for resilient operation
      let redThreshold = 0.33;
      let failures = 0;
      let total;

      // Attempt to fetch threshold - if it fails, use default
      const thresholdPromise = fetchRedThreshold(entities);
      const checksPromise = fetchReportingChecks(entities);

      // Use Promise.allSettled to handle both success and failure cases
      const [thresholdResult, checksResult] = await Promise.allSettled([
        thresholdPromise,
        checksPromise,
      ]);

      // Extract threshold if successful, otherwise keep default
      if (thresholdResult.status === 'fulfilled') {
        redThreshold = thresholdResult.value;
      }

      // Extract check results if successful, otherwise show error
      if (checksResult.status === 'fulfilled') {
        ({ failures, total } = checksResult.value);
      } else {
        setColor('gray');
        setReason('Error fetching reporting pipeline data');
        return;
      }

      // Determine color and reason based on results
      const { color: computedColor, reason: computedReason } =
        determineSemaphoreColor(failures, total, redThreshold);

      setColor(computedColor);
      setReason(computedReason);
    };

    // Let any unhandled promise rejections bubble up to error boundaries
    processData();
  }, [entities, fetchRedThreshold, fetchReportingChecks]);

  return <BaseTrafficLight color={color} tooltip={reason} onClick={onClick} />;
};
