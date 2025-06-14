import {
  CompoundEntityRef,
  Entity,
  getCompoundEntityRef,
} from '@backstage/catalog-model';
import { TechInsightsApi } from '@backstage/plugin-tech-insights';

/**
 * Summary of SonarCloud facts for a repository.
 */
export interface SonarCloudSummary {
  entity: CompoundEntityRef;
  quality_gate: number;
  vulnerabilities: number;
  code_coverage: number;
  bugs: number;
  code_smells: number;
}

/**
 * Metrics returned by SonarCloud for a Backstage entity.
 */
export interface SonarQubeMetrics {
  bugs: number;
  code_smells: number;
  vulnerabilities: number;
  code_coverage: number;
  quality_gate: string;
}

/**
 * A small utility for providing safe default objects when SonarCloud returns no data or an error is thrown.
 */
export const DEFAULT_METRICS: SonarQubeMetrics = {
  bugs: 0,
  code_smells: 0,
  vulnerabilities: 0,
  code_coverage: 0,
  quality_gate: 'NONE',
};

/**
 * Service‑style wrapper around the {@link TechInsightsApi} that exposes
 * methods for dealing with SonarCloud facts and checks.
 */
export class SonarCloudUtils {
  // constructor() {}

  /**
   * Fetches SonarCloud facts for the provided entity.
   *
   * @param techInsightsApi – The TechInsightsApi instance used to fetch facts.
   * @param entity – The entity reference whose SonarCloud metrics should be retrieved.
   * @returns A {@link SonarQubeMetrics} object with the parsed results.
   */
  async getSonarQubeFacts(
    techInsightsApi: TechInsightsApi,
    entity: CompoundEntityRef,
  ): Promise<SonarQubeMetrics> {
    try {
      // fetch SonarCloud facts for the given entity
      const response = await techInsightsApi.getFacts(entity, [
        'sonarcloud-fact-retriever',
      ]);

      const facts = response?.['sonarcloud-fact-retriever']?.facts;

      // If no facts are found, return default metrics
      if (!facts) {
        return { ...DEFAULT_METRICS };
      }

      return {
        bugs: Number(facts.bugs ?? 0) || 0,
        code_smells: Number(facts.code_smells ?? 0) || 0,
        vulnerabilities: Number(facts.vulnerabilities ?? 0) || 0,
        code_coverage: Number(facts.code_coverage ?? 0) || 0,
        quality_gate: String(facts.quality_gate ?? 'NONE'),
      };
    } catch (error) {
      return { ...DEFAULT_METRICS };
    }
  }

  /**
   * Retrieves the top 5 critical SonarCloud repositories based on quality gate status,
   * vulnerabilities, bugs, code smells, and code coverage.
   *
   * @param techInsightsApi - The TechInsightsApi instance used to fetch SonarCloud facts.
   * @param entities - An array of Backstage Entity objects to check SonarCloud status for.
   * @returns A promise that resolves to an array of SonarCloudSummary objects,
   *          containing the top 5 critical repositories based on the defined criteria.
   */
  async getTop5CriticalSonarCloudRepos(
    techInsightsApi: TechInsightsApi,
    entities: Entity[],
  ): Promise<SonarCloudSummary[]> {
    const results: SonarCloudSummary[] = [];

    for (const entity of entities) {
      const entityRef = getCompoundEntityRef(entity);
      try {
        // Fetch SonarCloud facts for the entity
        const facts = await this.getSonarQubeFacts(techInsightsApi, entityRef);
        results.push({
          entity: entityRef,
          quality_gate: facts.quality_gate === 'OK' ? 0 : 1,
          vulnerabilities:
            typeof facts.vulnerabilities === 'number'
              ? facts.vulnerabilities
              : 0,
          code_coverage:
            typeof facts.code_coverage === 'number' ? facts.code_coverage : 0,
          bugs: typeof facts.bugs === 'number' ? facts.bugs : 0,
          code_smells:
            typeof facts.code_smells === 'number' ? facts.code_smells : 0,
        });
      } catch (err) {
        results.push({
          entity: entityRef,
          quality_gate: 1, // Assume failed quality gate if we can't fetch facts
          vulnerabilities: 0,
          code_coverage: 0,
          bugs: 0,
          code_smells: 0,
        });
      }
    }

    // Sort results by quality gate status, then by vulnerabilities, bugs, code smells, and code coverage
    const selected: SonarCloudSummary[] = [];

    // First, select repositories that failed the quality gate
    const failedQualityGate = results.filter(r => r.quality_gate === 1);
    selected.push(...failedQualityGate.slice(0, 5));

    // If we have less than 5, fill with repositories that have vulnerabilities
    if (selected.length < 5) {
      const vulnerableRepos = results
        .filter(r => !selected.includes(r) && r.vulnerabilities > 0)
        .sort((a, b) => b.vulnerabilities - a.vulnerabilities);
      selected.push(...vulnerableRepos.slice(0, 5 - selected.length));
    }

    // If we still have less than 5, fill with repositories that have bugs
    if (selected.length < 5) {
      const highBugsRepos = results
        .filter(r => !selected.includes(r) && r.bugs > 0)
        .sort((a, b) => b.bugs - a.bugs);
      selected.push(...highBugsRepos.slice(0, 5 - selected.length));
    }

    // If we still have less than 5, fill with repositories that have code smells
    if (selected.length < 5) {
      const highCodeSmellsRepos = results
        .filter(r => !selected.includes(r) && r.code_smells > 0)
        .sort((a, b) => b.code_smells - a.code_smells);
      selected.push(...highCodeSmellsRepos.slice(0, 5 - selected.length));
    }

    // If we still have less than 5, fill with repositories that have low code coverage
    if (selected.length < 5) {
      const lowCoverageRepos = results
        .filter(r => !selected.includes(r) && r.code_coverage < 80)
        .sort((a, b) => a.code_coverage - b.code_coverage);
      selected.push(...lowCoverageRepos.slice(0, 5 - selected.length));
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
