import {
  CompoundEntityRef,
  stringifyEntityRef,
} from '@backstage/catalog-model';
import { TechInsightsApi } from '@backstage/plugin-tech-insights';

import { JsonObject } from '@backstage/types';

export type TrafficLightColor = 'green' | 'yellow' | 'red';

interface WorkflowRun {
  id: number;
  name: string;
  status: 'completed' | 'queued' | 'in_progress' | string;
  conclusion:
    | 'success'
    | 'failure'
    | 'timed_out'
    | 'cancelled'
    | 'neutral'
    | null
    | string;
  [key: string]: any;
}

interface WorkflowConfig {
  exclude: string[];
  critical: string[];
  sampleIfNoCritical: number;
}

function shuffleArray(array: string[]): string[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

async function loadWorkflowConfig(): Promise<WorkflowConfig> {
  try {
    const res = await fetch('/config/github-workflows.json');
    if (!res.ok) throw new Error('Failed to load config');
    const data = await res.json();
    return (
      data.workflowConfig || {
        exclude: [],
        critical: [],
        sampleIfNoCritical: 0,
      }
    );
  } catch (err) {
    // console.error('Config load error:', err);
    return { exclude: [], critical: [], sampleIfNoCritical: 0 };
  }
}

export async function getGitHubRepoStatus(
  repoName: string,
): Promise<{ color: TrafficLightColor; reason: string }> {
  const apiUrl = `https://api.github.com/repos/philips-labs/${repoName}/actions/runs?branch=main`;

  const response = await fetch(apiUrl, {
    method: 'GET',
    headers: {
      Accept: 'application/vnd.github.v3+json',
    },
  });

  if (!response.ok) {
    // console.error('Failed to fetch GitHub data:', response.statusText);
    return {
      color: 'red',
      reason: `GitHub API error: ${response.statusText} `,
    };
  }

  const data = await response.json();
  const allRuns = data.workflow_runs as WorkflowRun[];

  if (allRuns.length === 0) {
    return { color: 'red', reason: "No workflow runs found on 'main' branch." };
  }

  const { exclude, critical, sampleIfNoCritical } = await loadWorkflowConfig();

  const allWorkflowNames = [...new Set(allRuns.map(run => run.name))].filter(
    name => !exclude.includes(name),
  );
  const criticalWorkflows =
    critical.length > 0
      ? critical
      : shuffleArray(allWorkflowNames).slice(0, sampleIfNoCritical);

  const latestPerWorkflow = new Map<string, WorkflowRun>();
  for (const run of allRuns) {
    if (!exclude.includes(run.name) && !latestPerWorkflow.has(run.name)) {
      latestPerWorkflow.set(run.name, run);
    }
  }

  const failing: string[] = [];
  const inProgress: string[] = [];

  for (const [name, run] of latestPerWorkflow.entries()) {
    if (criticalWorkflows.includes(name)) {
      if (run.status !== 'completed') {
        inProgress.push(name);
      } else if (
        ['failure', 'timed_out', 'cancelled'].includes(run.conclusion || '')
      ) {
        failing.push(name);
      }
    }
  }

  if (failing.length > 0) {
    return {
      color: 'red',
      reason: `Critical workflows failed: ${failing.join(', ')}`,
    };
  } else if (inProgress.length > 0) {
    return {
      color: 'yellow',
      reason: `Critical workflows in progress: ${inProgress.join(', ')}`,
    };
  }
  return { color: 'green', reason: 'All critical workflows succeeded.' };
}

export function determineSemaphoreColor(
  failures: number,
  totalEntities: number,
  redThreshold: number,
): { color: 'green' | 'yellow' | 'red'; reason: string } {
  const redLimit = redThreshold * totalEntities;

  if (failures === 0) {
    return { color: 'green', reason: 'All checks passed.' };
  } else if (failures > redLimit) {
    return {
      color: 'red',
      reason: `${failures} ${failures === 1 ? 'failure' : 'failures'}.`,
    };
  }
  return {
    color: 'yellow',
    reason: `${failures} minor ${failures === 1 ? 'issue' : 'issues'}.`,
  };
}

/**
 * Interface defining the shape of GitHub security facts
 */
export interface GitHubSecurityFacts {
  openCodeScanningAlertCount: number;
  openSecretScanningAlertCount: number;
  codeScanningAlerts: Record<
    string,
    {
      severity: string;
      description: string;
      html_url: string;
      direct_link?: string;
      location?: {
        path: string;
        start_line: number;
        commit_sha: string;
      };
      created_at: string;
      rule?: {
        id: string;
        name: string;
        description?: string;
      };
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
 * Function to fetch GitHub security facts for a given entity
 */
export const getGitHubSecurityFacts = async (
  api: TechInsightsApi,
  entity: CompoundEntityRef,
): Promise<GitHubSecurityFacts> => {
  try {
    // console.log(
    //   'Fetching GitHub Security facts for entity:',
    //   stringifyEntityRef(entity),
    // );

    const response = await api.getFacts(entity, [
      'githubAdvancedSecurityFactRetriever',
    ]);

    // console.log(
    //   'Raw Tech Insights API response:',
    //   JSON.stringify(response, null, 2),
    // );

    const facts = response?.githubAdvancedSecurityFactRetriever?.facts;

    if (!facts) {
      // console.error(
      //   'No GitHub Security facts found for entity:',
      //   stringifyEntityRef(entity),
      // );
      return {
        openCodeScanningAlertCount: 0,
        openSecretScanningAlertCount: 0,
        codeScanningAlerts: {},
        secretScanningAlerts: {},
      };
    }

    // Type assertion to handle the JSON types correctly
    const codeScanningAlerts = (facts.codeScanningAlerts as JsonObject) || {};
    const secretScanningAlerts =
      (facts.secretScanningAlerts as JsonObject) || {};

    return {
      openCodeScanningAlertCount: Number(facts.openCodeScanningAlertCount ?? 0),
      openSecretScanningAlertCount: Number(
        facts.openSecretScanningAlertCount ?? 0,
      ),
      // Cast to the expected types
      codeScanningAlerts:
        codeScanningAlerts as GitHubSecurityFacts['codeScanningAlerts'],
      secretScanningAlerts:
        secretScanningAlerts as GitHubSecurityFacts['secretScanningAlerts'],
    };
  } catch (error) {
    // console.error(
    //   'Error fetching GitHub Security facts for entity:',
    //   stringifyEntityRef(entity),
    //   error,
    // );
    return {
      openCodeScanningAlertCount: 0,
      openSecretScanningAlertCount: 0,
      codeScanningAlerts: {},
      secretScanningAlerts: {},
    };
  }
};
