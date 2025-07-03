import { CompoundEntityRef } from '@backstage/catalog-model';
import { TechInsightsApi } from '@backstage/plugin-tech-insights';

export interface RepoAlertSummary {
  name: string;
  critical: number;
  high: number;
  medium: number;
}

export interface DependabotFacts {
  critical: number;
  high: number;
  medium: number;
}

export interface DependabotChecks {
  criticalAlertCheck: boolean;
  highAlertCheck: boolean;
  mediumAlertCheck: boolean;
}

/**
 * Class‑based wrapper around {@link TechInsightsApi} that exposes typed helper
 * methods for Dependabot facts & checks.
 */
export class DependabotUtils {
  /**
   * Fetches Dependabot facts for a given entity using the Tech Insights API.
   * Returns metrics like total alert counts per severity.
   */
  async getDependabotFacts(
    api: TechInsightsApi,
    entity: CompoundEntityRef,
  ): Promise<DependabotFacts> {
    try {
      const response = await api.getFacts(entity, ['dependabotFactRetriever']);
      const facts = response?.dependabotFactRetriever?.facts;

      if (!facts) {
        return { critical: 0, high: 0, medium: 0 };
      }

      return {
        critical: Number(facts.critical ?? 0),
        high: Number(facts.high ?? 0),
        medium: Number(facts.medium ?? 0),
      };
    } catch {
      return { critical: 0, high: 0, medium: 0 };
    }
  }

  /**
   * Runs checks on Dependabot facts for a given entity using the Tech Insights API.
   * Returns the results from the checks.
   */
  async getDependabotChecks(
    api: TechInsightsApi,
    entity: CompoundEntityRef,
  ): Promise<DependabotChecks> {
    try {
      const checkResults = await api.runChecks(entity);
      const criticalCheck = checkResults.find(
        r => r.check.id === 'dependabot-critical-alerts',
      );
      const highCheck = checkResults.find(
        r => r.check.id === 'dependabot-high-alerts',
      );
      const mediumCheck = checkResults.find(
        r => r.check.id === 'dependabot-medium-alerts',
      );

      if (checkResults.length === 0) {
        return {
          criticalAlertCheck: false,
          highAlertCheck: false,
          mediumAlertCheck: false,
        };
      }

      return {
        criticalAlertCheck: criticalCheck?.result === true,
        highAlertCheck: highCheck?.result === true,
        mediumAlertCheck: mediumCheck?.result === true,
      };
    } catch {
      return {
        criticalAlertCheck: false,
        highAlertCheck: false,
        mediumAlertCheck: false,
      };
    }
  }
}
