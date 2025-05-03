import { getAzureDevOpsBugs, getGitHubRepoStatus } from '../utils.ts';

export type TrafficLightColor = 'green' | 'yellow' | 'red';

export type StatusResponse = {
  [checkName: string]: { color: TrafficLightColor; reason: string };
};

const generateMetricScore = (): number => Math.floor(Math.random() * 100);

const evaluateColor = (
  score: number,
): { color: TrafficLightColor; reason: string } => {
  if (score >= 70) {
    // Example threshold now set for 70 will change later for specific tool
    return { color: 'green', reason: `Score ${score} ≥ 70 (green)` };
  }
  return { color: 'red', reason: `Score ${score} < 70 (red)` };
};

const evaluateColorDevOps = (
  score: number,
): { color: TrafficLightColor; reason: string } => {
  if (score == 0) {
    // Example threshold now set for 70 will change later for specific tool
    return { color: 'green', reason: `0 bugs` };
  } else if (score == 1) {
    return { color: 'yellow', reason: `1 bug` };
  } else {
    return { color: 'red', reason: `> 1 bugs` };
  }
};

// Ensure status returned by getGitHubRepoStatus is valid
const validateTrafficLightColor = (status: any): TrafficLightColor => {
  if (status === 'green' || status === 'yellow' || status === 'red') {
    return status;
  }
  return 'red'; // Default to 'red' if status is invalid
};

export const fetchRepoStatus = async (
  repoName: string,
): Promise<StatusResponse> => {
  await new Promise(resolve => setTimeout(resolve, 300));

  const status = await getGitHubRepoStatus(repoName);

  console.log('Received GitHub status!!!!!!!!!!!!!!!!:', status);

  // Validate the status before using it
  const preProdStatus: TrafficLightColor = validateTrafficLightColor(status);

  return {
    Dependabot: { color: 'green', reason: `Score 70 ≥ 70 (green)` },
    BlackDuck: { color: 'green', reason: `Score 70 ≥ 70 (green)` },
    Fortify: { color: 'green', reason: 'Fixed yellow for Fortify' },
    SonarQube: { color: 'green', reason: `Score 70 ≥ 70 (green)` },
    CodeScene: { color: 'green', reason: `Score 70 ≥ 70 (green)` },
    'Reporting Pipeline': { color: 'green', reason: `Score 70 ≥ 70 (green)` },
    'Pre-Production pipelines': {
      color: preProdStatus,
      reason: `Score 70 ≥ 70 (green)`,
    },
    'Foundation Pipelines': evaluateColorDevOps(await getAzureDevOpsBugs()),
  };
};
