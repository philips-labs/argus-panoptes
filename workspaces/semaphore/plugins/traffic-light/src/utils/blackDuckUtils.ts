import {
  CompoundEntityRef,
  Entity,
  getCompoundEntityRef,
} from '@backstage/catalog-model';
import { TechInsightsApi } from '@backstage/plugin-tech-insights';

/**
 * Summary of BlackDuck facts for a repository.
 */
export interface BlackDuckSummary {
  entity: CompoundEntityRef;
  security_risks_critical: number;
  security_risks_high: number;
  security_risks_medium: number;
}

/**
 * Metrics returned by BlackDuck for a Backstage entity.
 */
export interface BlackDuckMetrics {
  security_risks_critical: number;
  security_risks_high: number;
  security_risks_medium: number;
}

/**
 * Results produced by running TechInsights checks that map to BlackDuck rules.
 */
export interface BlackDuckChecks {
  criticalSecurityCheck: boolean;
  highSecurityCheck: boolean;
  mediumSecurityCheck: boolean;
}

/**
 * A small utility for providing safe default objects when BlackDuck returns no data or an error is thrown.
 */
export const DEFAULT_METRICS: BlackDuckMetrics = {
  security_risks_critical: 0,
  security_risks_high: 0,
  security_risks_medium: 0,
};

export const DEFAULT_CHECKS: BlackDuckChecks = {
  criticalSecurityCheck: false,
  highSecurityCheck: false,
  mediumSecurityCheck: false,
};

/**
 * Service‑style wrapper around the {@link TechInsightsApi} that exposes
 * methods for dealing with BlackDuck facts and checks.
 */
export class BlackDuckUtils {
  // constructor() {}

  /**
   * Fetches BlackDuck facts for the provided entity.
   *
   * @param techInsightsApi – The TechInsightsApi instance used to fetch facts.
   * @param entity – The entity reference whose BlackDuck metrics should be retrieved.
   * @returns A {@link BlackDuckMetrics} object with the parsed results.
   */
  async getBlackDuckFacts(
    techInsightsApi: TechInsightsApi,
    entity: CompoundEntityRef,
  ): Promise<BlackDuckMetrics> {
    try {
      const response = await techInsightsApi.getFacts(entity, [
        'blackduck-fact-retriever',
      ]);

      const facts = response?.['blackduck-fact-retriever']?.facts;

      if (!facts) {
        return { ...DEFAULT_METRICS };
      }

      return {
        security_risks_critical:
          Number(facts.security_risks_critical ?? 0) || 0,
        security_risks_high: Number(facts.security_risks_high ?? 0) || 0,
        security_risks_medium: Number(facts.security_risks_medium ?? 0) || 0,
      };
    } catch (error) {
      return { ...DEFAULT_METRICS };
    }
  }

  /**
   * Executes the BlackDuck‑related TechInsights checks for the supplied entity.
   *
   * @param techInsightsApi – The TechInsightsApi instance for fetching checks.
   * @param entity – The entity reference for which to run the checks.
   * @returns A {@link BlackDuckChecks} object containing boolean results for each check.
   */
  async getBlackDuckChecks(
    techInsightsApi: TechInsightsApi,
    entity: CompoundEntityRef,
  ): Promise<BlackDuckChecks> {
    try {
      const checkResults = await techInsightsApi.runChecks(entity);

      // Extract the results of each checks
      const criticalSecurityCheck = checkResults.find(
        r => r.check.id === 'blackduck-critical-security-risk',
      );
      const highSecurityCheck = checkResults.find(
        r => r.check.id === 'blackduck-high-security-risk',
      );
      const mediumSecurityCheck = checkResults.find(
        r => r.check.id === 'blackduck-medium-security-risk',
      );

      // If no check results are found, log an error and return default values
      if (checkResults.length === 0) {
        return { ...DEFAULT_CHECKS };
      }

      // Return the parsed facts, converting to appropriate types and providing defaults
      return {
        criticalSecurityCheck: criticalSecurityCheck?.result === true,
        highSecurityCheck: highSecurityCheck?.result === true,
        mediumSecurityCheck: mediumSecurityCheck?.result === true,
      };
    } catch (error) {
      // Return default values if an error occurs
      return { ...DEFAULT_CHECKS };
    }
  }

  /**
   * Retrieves the top 5 critical BlackDuck repositories based on critical, high and medium security issues.
   *
   * @param techInsightsApi - The TechInsightsApi instance used to fetch BlackDuck facts.
   * @param entities - An array of Backstage Entity objects to check BlackDuck status for.
   * @returns A promise that resolves to an array of BlackDuckSummary objects,
   *          containing the top 5 critical repositories based on the defined criteria.
   */
  async getTop5CriticalBlackDuckRepos(
    techInsightsApi: TechInsightsApi,
    entities: Entity[],
  ): Promise<BlackDuckSummary[]> {
    const results: BlackDuckSummary[] = [];

    for (const entity of entities) {
      const entityRef = getCompoundEntityRef(entity);
      try {
        // Fetch BlackDuck facts for the entity
        const facts = await this.getBlackDuckFacts(techInsightsApi, entityRef);
        results.push({
          entity: entityRef,
          security_risks_critical:
            typeof facts.security_risks_critical === 'number'
              ? facts.security_risks_critical
              : 0,
          security_risks_high:
            typeof facts.security_risks_high === 'number'
              ? facts.security_risks_high
              : 0,
          security_risks_medium:
            typeof facts.security_risks_medium === 'number'
              ? facts.security_risks_medium
              : 0,
        });
      } catch (err) {
        results.push({
          entity: entityRef,
          security_risks_critical: 0,
          security_risks_high: 0,
          security_risks_medium: 0,
        });
      }
    }

    // Sort results by critical security issues, high security issues, and medium security issues
    const selected: BlackDuckSummary[] = [];

    // First, select repositories that have critical security issues
    const haveCriticalSecurityIssues = results
      .filter(r => !selected.includes(r) && r.security_risks_critical > 0)
      .sort((a, b) => b.security_risks_critical - a.security_risks_critical);
    selected.push(...haveCriticalSecurityIssues.slice(0, 5));

    // If we have less than 5, fill with repositories that have high security issues
    if (selected.length < 5) {
      const haveHighSecurityIssues = results
        .filter(r => !selected.includes(r) && r.security_risks_high > 0)
        .sort((a, b) => b.security_risks_high - a.security_risks_high);
      selected.push(...haveHighSecurityIssues.slice(0, 5 - selected.length));
    }

    // If we still have less than 5, fill with repositories that have medium security issues
    if (selected.length < 5) {
      const haveMediumSecurityIssues = results
        .filter(r => !selected.includes(r) && r.security_risks_medium > 0)
        .sort((a, b) => b.security_risks_medium - a.security_risks_medium);
      selected.push(...haveMediumSecurityIssues.slice(0, 5 - selected.length));
    }

    // If we still have less than 5, fill with any remaining repositories
    if (selected.length < 5) {
      const fallback = results
        .filter(r => !selected.includes(r))
        .slice(0, 5 - selected.length);
      selected.push(...fallback);
    }

    return selected;
  }
}
