import { Entity } from '@backstage/catalog-model';

export type Severity = 'critical' | 'high' | 'medium' | 'low';

export interface IssueDetail {
  severity: Severity;
  description: string;
  component?: string;
  url?: string;
  directLink?: string;
}

export interface PreproductionDetail {
  successMetric: string;
  description: string;
  component?: string;
  url?: string;
  directLink?: string;
}

export interface SemaphoreData {
  color: 'red' | 'yellow' | 'green' | 'gray';
  metrics: Record<string, any>;
  summary: string;
  details: IssueDetail[];
}

// Props for dialog components
export interface SemaphoreDialogProps {
  open: boolean;
  onClose: () => void;
  entities?: Entity[];
}

// Shared utility functions
export const getSeverityColorHex = (severity: Severity): string => {
  switch (severity) {
    case 'critical':
      return '#d32f2f'; // error.main
    case 'high':
      return '#f44336'; // error.light
    case 'medium':
      return '#ff9800'; // warning.main
    case 'low':
      return '#2196f3'; // info.main
    default:
      return '#757575'; // text.secondary
  }
};
