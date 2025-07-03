import { CompoundEntityRef } from '@backstage/catalog-model';
import { TechInsightsApi } from '@backstage/plugin-tech-insights';
import { JsonObject } from '@backstage/types';

/**
 * Interface defining the shape of GitHub security facts (without checks)
 */
export interface GitHubSecurityFacts {
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
  openCodeScanningAlertCount: number;
  openSecretScanningAlertCount: number;
  codeScanningAlerts: Record<
    string,
    {
      severity: string;
      description: string;
      direct_link?: string;
      created_at: string;
    }
  >;
  secretScanningAlerts: Record<
    string,
    {
      severity: string;
      description: string;
      html_url: string;
      created_at: string;
    }
  >;
}

/**
 * The boolean outcomes of the checks.
 */
export interface GitHubSecurityChecks {
  criticalCheck: boolean;
  highCheck: boolean;
  mediumCheck: boolean;
  lowCheck: boolean;
  secretCheck: boolean;
}

/**
 * Combined interface for when you need both facts and checks
 */
export interface GitHubSecurityData
  extends GitHubSecurityFacts,
    GitHubSecurityChecks {}

const DEFAULT_FACTS: GitHubSecurityFacts = {
  criticalCount: 0,
  highCount: 0,
  mediumCount: 0,
  lowCount: 0,
  openCodeScanningAlertCount: 0,
  openSecretScanningAlertCount: 0,
  codeScanningAlerts: {},
  secretScanningAlerts: {},
};

const DEFAULT_CHECKS: GitHubSecurityChecks = {
  criticalCheck: false,
  highCheck: false,
  mediumCheck: false,
  lowCheck: false,
  secretCheck: false,
};

/**
 * Class‑based wrapper around {@link TechInsightsApi} that exposes typed helper
 * methods for GitHub Advanced Security facts & checks.
 */
export class GithubAdvancedSecurityUtils {
  /**
   * Function to fetch GitHub security facts for a given entity
   * @param api - TechInsightsApi instance
   * @param entity - The entity reference for which to fetch facts
   * @return A promise that resolves to an object containing GitHub security facts
   */
  async getGitHubSecurityFacts(
    api: TechInsightsApi,
    entity: CompoundEntityRef,
  ): Promise<GitHubSecurityFacts> {
    try {
      const response = await api.getFacts(entity, [
        'githubAdvancedSecurityFactRetriever',
      ]);
      const facts = response?.githubAdvancedSecurityFactRetriever?.facts;

      // Check if the facts are present and log an error if not
      if (!facts) {
        return { ...DEFAULT_FACTS };
      }

      // Type assertion to handle the JSON types correctly
      const codeScanningAlerts = (facts.codeScanningAlerts as JsonObject) || {};
      const secretScanningAlerts =
        (facts.secretScanningAlerts as JsonObject) || {};

      return {
        criticalCount: Number(facts.criticalCount ?? 0) || 0,
        highCount: Number(facts.highCount ?? 0) || 0,
        mediumCount: Number(facts.mediumCount ?? 0) || 0,
        lowCount: Number(facts.lowCount ?? 0) || 0,
        openCodeScanningAlertCount:
          Number(facts.openCodeScanningAlertCount ?? 0) || 0,
        openSecretScanningAlertCount:
          Number(facts.openSecretScanningAlertCount ?? 0) || 0,
        // Cast to the expected types
        codeScanningAlerts:
          codeScanningAlerts as GitHubSecurityFacts['codeScanningAlerts'],
        secretScanningAlerts:
          secretScanningAlerts as GitHubSecurityFacts['secretScanningAlerts'],
      };
    } catch {
      return { ...DEFAULT_FACTS };
    }
  }

  /**
   * Function to fetch GitHub security check results for a given entity
   * @param api - TechInsightsApi instance
   * @param entity - The entity reference for which to fetch check results
   * @return A promise that resolves to an object containing GitHub security check results
   */
  async getGitHubSecurityChecks(
    api: TechInsightsApi,
    entity: CompoundEntityRef,
  ): Promise<GitHubSecurityChecks> {
    try {
      const checkResults = await api.runChecks(entity);

      const secretCheck = checkResults.find(
        r => r.check.id === 'open-secret-scanning-alert-count',
      );
      const criticalCheck = checkResults.find(
        r => r.check.id === 'critical-count',
      );
      const highCheck = checkResults.find(r => r.check.id === 'high-count');
      const mediumCheck = checkResults.find(r => r.check.id === 'medium-count');
      const lowCheck = checkResults.find(r => r.check.id === 'low-count');

      return {
        criticalCheck: Boolean(criticalCheck?.result ?? false),
        highCheck: Boolean(highCheck?.result ?? false),
        mediumCheck: Boolean(mediumCheck?.result ?? false),
        lowCheck: Boolean(lowCheck?.result ?? false),
        secretCheck: Boolean(secretCheck?.result ?? false),
      };
    } catch {
      return { ...DEFAULT_CHECKS };
    }
  }

  /**
   * Convenience function to fetch both facts and checks in one call
   * @param api - TechInsightsApi instance
   * @param entity - The entity reference for which to fetch data
   * @return A promise that resolves to an object containing both facts and checks
   */
  async getGitHubSecurityData(
    api: TechInsightsApi,
    entity: CompoundEntityRef,
  ): Promise<GitHubSecurityData> {
    const [facts, checks] = await Promise.all([
      this.getGitHubSecurityFacts(api, entity),
      this.getGitHubSecurityChecks(api, entity),
    ]);

    return {
      ...facts,
      ...checks,
    };
  }
}
