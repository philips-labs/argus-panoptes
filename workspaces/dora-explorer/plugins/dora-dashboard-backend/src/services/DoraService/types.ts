export type MetricType = 'df' | 'mltc' | 'cfr' | 'mttr';

export type Aggregation = 'daily' | 'monthly';

export interface MetricItem {
  data_key: string;
  data_value: number;
}

export interface DoraService {
  getMetric(
    type: MetricType,
    aggregation: Aggregation,
    project: string[],
    from: number,
    to: number,
  ): Promise<MetricItem[]>;
  getProjectNames(): Promise<string[]>;
}
