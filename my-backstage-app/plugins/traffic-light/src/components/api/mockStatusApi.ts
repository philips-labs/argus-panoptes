import { getAzureDevOpsBugs } from '../utils.ts';

export type TrafficLightColor = 'green' | 'yellow' | 'red';

export type StatusResponse = {
  [checkName: string]: { color: TrafficLightColor; reason: string };
};
  
  const generateMetricScore = (): number => Math.floor(Math.random() * 100);
  
  const evaluateColor = (score: number): { color: TrafficLightColor; reason: string } => {
    if (score >= 70) { // Example threshold now set for 70 will change later for specific tool
      return { color: 'green', reason: `Score ${score} ≥ 70 (green)` };
    }
    return { color: 'red', reason: `Score ${score} < 70 (red)` };
  };

  const evaluateColorDevOps = (score: number): { color: TrafficLightColor; reason: string } => {
    if (score == 0) { // Example threshold now set for 70 will change later for specific tool
      return { color: 'green', reason: `0 bugs` };
    } else if (score == 1) {
      return { color: 'yellow', reason: `1 bug` };
    } else {
      return { color: 'red', reason: `> 1 bugs` };
    }
  };

  const mockResponse = {
    workItems: [
      { id: 101, fields: { "System.WorkItemType": "Bug" } },
      { id: 102, fields: { "System.WorkItemType": "Bug" } },
      { id: 103, fields: { "System.WorkItemType": "Task" } },
    ]
  };

  
  export const fetchRepoStatus = async (repoName: string): Promise<StatusResponse> => {
    await new Promise(resolve => setTimeout(resolve, 300)); 
  
    return {
      Dependabot: evaluateColor(generateMetricScore()),
      BlackDuck: evaluateColor(generateMetricScore()),
      Fortify: { color: 'yellow', reason: 'Fixed yellow for Fortify' },
      SonarQube: evaluateColor(generateMetricScore()),
      CodeScene: evaluateColor(generateMetricScore()),
      'Reporting Pipeline': evaluateColor(generateMetricScore()),
      'Pre-Production pipelines': evaluateColor(generateMetricScore()),
      'Foundation Pipelines': evaluateColorDevOps(await getAzureDevOpsBugs()),
    };
  };
  