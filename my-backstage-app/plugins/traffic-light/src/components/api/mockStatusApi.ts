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
      'Foundation Pipelines': evaluateColor(generateMetricScore()),
    };
  };
  