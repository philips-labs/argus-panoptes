import { CompoundEntityRef } from '@backstage/catalog-model';
import { TechInsightsApi } from '@backstage/plugin-tech-insights';

/**
 * Shape of the metrics returned by `azureDevOpsBugsRetriever`.
 */
export interface AzureDevOpsBugMetrics {
  azureBugCount: number;
}

/**
 * Results of the companion Tech‑Insights checks.
 */
export interface AzureDevOpsBugChecks {
  bugCountCheck: boolean;
}

const DEFAULT_METRICS: AzureDevOpsBugMetrics = {
  azureBugCount: 0,
};

const DEFAULT_CHECKS: AzureDevOpsBugChecks = {
  bugCountCheck: false,
};

/**
 * Convenience wrapper around {@link TechInsightsApi} for Azure DevOps bug
 * facts and checks.
 */
export class AzureUtils {
  /**
   * Fetches the Azure DevOps bug facts for the given entity.
   */
  async getAzureDevOpsBugFacts(
    api: TechInsightsApi,
    entity: CompoundEntityRef,
  ): Promise<AzureDevOpsBugMetrics> {
    try {
      const response = await api.getFacts(entity, [
        'azure-devops-bugs-retriever',
      ]);

      const facts = response?.['azure-devops-bugs-retriever']?.facts;

      if (!facts) {
        return { ...DEFAULT_METRICS };
      }

      const bugCount = Number(facts.azure_bug_count ?? 0);

      return { azureBugCount: bugCount };
    } catch {
      return { ...DEFAULT_METRICS };
    }
  }

  /**
   * Runs the Azure DevOps bug‑count Tech‑Insights check.
   */
  async getAzureDevOpsBugChecks(
    api: TechInsightsApi,
    entity: CompoundEntityRef,
  ): Promise<AzureDevOpsBugChecks> {
    try {
      const checkResults = await api.runChecks(entity);

      const bugCheck = checkResults.find(r => r.check.id === 'azure-bugs');

      return {
        bugCountCheck: bugCheck?.result === true,
      };
    } catch {
      return { ...DEFAULT_CHECKS };
    }
  }
}
