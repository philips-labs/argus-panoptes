import { useEffect, useMemo, useState } from 'react';
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

  useEffect(() => {
    const fetchData = async () => {
      if (!entities.length) {
        setColor('gray');
        setReason('No entities selected');
        return;
      }

      try {
        // 1. Fetch red threshold from system annotation
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
                'reporting-check-threshold-red'
              ];
            if (thresholdAnnotation) {
              redThreshold = parseFloat(thresholdAnnotation);
            }
          }
        } catch (err) {}

        // 2. Run reporting pipeline checks
        const results = await Promise.all(
          entities.map(entity =>
            reportingUtils.getReportingPipelineChecks(techInsightsApi, {
              kind: entity.kind,
              namespace: entity.metadata.namespace || 'default',
              name: entity.metadata.name,
            }),
          ),
        );

        const failures = results.filter(
          r => r.successRateCheck === false,
        ).length;

        // 3. Determine color and reason
        const { color: computedColor, reason: computedReason } =
          determineSemaphoreColor(failures, entities.length, redThreshold);

        setColor(computedColor);
        setReason(computedReason);
      } catch (err) {
        setColor('gray');
        setReason('Error fetching reporting pipeline data');
      }
    };

    fetchData();
  }, [entities, techInsightsApi, catalogApi, reportingUtils]);

  return <BaseTrafficLight color={color} tooltip={reason} onClick={onClick} />;
};
