export type TrafficLightColor = 'green' | 'yellow' | 'red';

export function determineSemaphoreColor(
  failures: number,
  totalEntities: number,
  redThreshold: number,
): { color: 'green' | 'yellow' | 'red'; reason: string } {
  const redLimit = redThreshold * totalEntities;
  const thresholdPercentage = (redThreshold * 100).toFixed(1);

  if (failures === 0) {
    return {
      color: 'green',
      reason: `All ${totalEntities} ${
        totalEntities === 1 ? 'entity' : 'entities'
      } passed the check (threshold: ${thresholdPercentage}%).`,
    };
  } else if (failures > redLimit) {
    return {
      color: 'red',
      reason: `${failures} out of ${totalEntities} ${
        totalEntities === 1 ? 'entity' : 'entities'
      } failed the check with a threshold of ${thresholdPercentage}%.`,
    };
  }
  return {
    color: 'yellow',
    reason: `${failures} out of ${totalEntities} ${
      totalEntities === 1 ? 'entity' : 'entities'
    } failed the check with a threshold of ${thresholdPercentage}%.`,
  };
}
