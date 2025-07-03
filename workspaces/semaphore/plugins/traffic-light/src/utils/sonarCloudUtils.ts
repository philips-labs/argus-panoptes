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
  /**
   * Fetches SonarCloud facts for the provided entity.
   *
   * @param techInsightsApi – The TechInsightsApi instance used to fetch facts.
   * @param entity – The entity reference whose SonarCloud metrics should be retrieved.
   * @returns A {@link SonarQubeMetrics} object with the parsed results.
   */
  getSonarQubeFacts(
    techInsightsApi: TechInsightsApi,
    entity: CompoundEntityRef,
  ): Promise<SonarQubeMetrics> {
    return techInsightsApi
      .getFacts(entity, ['sonarcloud-fact-retriever'])
      .then(response => {
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
          quality_gate:
            typeof facts.quality_gate === 'string' ||
            typeof facts.quality_gate === 'number'
              ? String(facts.quality_gate)
              : 'NONE',
        };
      })
      .catch(() => {
        // Failed to fetch SonarQube facts for entity
        return { ...DEFAULT_METRICS };
      });
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
  getTop5CriticalSonarCloudRepos(
    techInsightsApi: TechInsightsApi,
    entities: Entity[],
  ): Promise<SonarCloudSummary[]> {
    const summaryPromises = entities.map(entity => {
      const entityRef = getCompoundEntityRef(entity);

      return this.getSonarQubeFacts(techInsightsApi, entityRef)
        .then(facts => ({
          entity: entityRef,
          quality_gate: facts.quality_gate === 'OK' ? 0 : 1,
          vulnerabilities: facts.vulnerabilities,
          code_coverage: facts.code_coverage,
          bugs: facts.bugs,
          code_smells: facts.code_smells,
        }))
        .catch(() => {
          // Failed to process SonarCloud summary for entity
          return {
            entity: entityRef,
            quality_gate: 1, // Assume failed quality gate if we can't fetch facts
            vulnerabilities: 0,
            code_coverage: 0,
            bugs: 0,
            code_smells: 0,
          };
        });
    });

    return Promise.all(summaryPromises).then(allSummaries => {
      // Sort results by quality gate status, then by vulnerabilities, bugs, code smells, and code coverage
      const selected: SonarCloudSummary[] = [];
      const MAX_REPOS = 5;

      const addCandidates = (
        filterFn: (summary: SonarCloudSummary) => boolean,
        sortFn?: (a: SonarCloudSummary, b: SonarCloudSummary) => number,
      ) => {
        if (selected.length >= MAX_REPOS) return;

        const candidates = allSummaries.filter(
          summary => !selected.includes(summary) && filterFn(summary),
        );

        if (sortFn) {
          candidates.sort(sortFn);
        }

        selected.push(...candidates.slice(0, MAX_REPOS - selected.length));
      };

      // 1. Failed quality gate
      addCandidates(s => s.quality_gate === 1);

      // 2. Vulnerabilities (descending)
      addCandidates(
        s => s.vulnerabilities > 0,
        (a, b) => b.vulnerabilities - a.vulnerabilities,
      );

      // 3. Bugs (descending)
      addCandidates(
        s => s.bugs > 0,
        (a, b) => b.bugs - a.bugs,
      );

      // 4. Code Smells (descending)
      addCandidates(
        s => s.code_smells > 0,
        (a, b) => b.code_smells - a.code_smells,
      );

      // 5. Low code coverage (ascending)
      addCandidates(
        s => s.code_coverage < 80,
        (a, b) => a.code_coverage - b.code_coverage,
      );

      // 6. Fallback for any remaining repos
      addCandidates(() => true);

      return selected;
    });
  }
}
