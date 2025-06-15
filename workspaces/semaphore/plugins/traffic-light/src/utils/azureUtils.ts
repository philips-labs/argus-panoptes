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
 * Convenience wrapper around {@link TechInsightsApi} for AzureDevOps bug facts and checks.
 */
export class AzureUtils {
  // constructor() {}

  /**
   * Fetches the AzureDevOps bug facts for the given entity.
   */
  async getAzureDevOpsBugFacts(
    api: TechInsightsApi,
    entity: CompoundEntityRef,
  ): Promise<AzureDevOpsBugMetrics> {
    try {
      // console.log(
      //   '🔍 Fetching Azure DevOps bug facts for entity:',
      //   stringifyEntityRef(entity),
      // );

      const response = await api.getFacts(entity, [
        'azure-devops-bugs-retriever',
      ]);

      // console.log('📦 Raw Azure DevOps facts:', response);

      const facts = response?.['azure-devops-bugs-retriever']?.facts;

      // if (!facts) {
      //   console.warn(
      //     '⚠️ No facts found for entity:',
      //     stringifyEntityRef(entity),
      //   );
      //   return { ...DEFAULT_METRICS };
      // }

      const bugCount = Number(facts.azure_bug_count ?? 0);

      // console.info(`✅ Bug count for ${stringifyEntityRef(entity)}:`, bugCount);

      return { azureBugCount: bugCount };
    } catch (error) {
      // console.error(
      //   '❌ Error fetching Azure DevOps facts for entity:',
      //   stringifyEntityRef(entity),
      //   error,
      // );
      return { ...DEFAULT_METRICS };
    }
  }

  /**
   * Runs the AzureDevOps bug‑count Tech‑Insights check.
   */
  async getAzureDevOpsBugChecks(
    api: TechInsightsApi,
    entity: CompoundEntityRef,
  ): Promise<AzureDevOpsBugChecks> {
    try {
      // console.log(
      //   '✅ Running Azure DevOps bug count check for entity:',
      //   stringifyEntityRef(entity),
      // );

      const checkResults = await api.runChecks(entity);

      const bugCheck = checkResults.find(r => r.check.id === 'azure-bugs');

      // console.info(
      //   `🔍 Check result for ${stringifyEntityRef(entity)}:`,
      //   bugCheck?.result,
      // );

      return {
        bugCountCheck: bugCheck?.result === true,
      };
    } catch (error) {
      // console.error(
      //   '❌ Error running Azure DevOps bug check for entity:',
      //   stringifyEntityRef(entity),
      //   error,
      // );
      return { ...DEFAULT_CHECKS };
    }
  }
}
