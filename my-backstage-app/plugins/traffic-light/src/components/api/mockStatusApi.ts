export type StatusResponse = {
    [checkName: string]: 'red' | 'green' | 'yellow';
  };
  
  const generateMetricScore = (): number => Math.floor(Math.random() * 100);
  
  const evaluateColor = (score: number): 'red' | 'green' => {
    return score >= 70 ? 'green' : 'red'; // Example threshold now set for 70 will change later for specific tool 
  };
  
  export const fetchRepoStatus = async (repoName: string): Promise<StatusResponse> => {
    await new Promise(resolve => setTimeout(resolve, 300)); 
  
    return {
      Dependabot: evaluateColor(generateMetricScore()),
      BlackDuck: evaluateColor(generateMetricScore()),
      Fortify: 'yellow',
      SonarQube: evaluateColor(generateMetricScore()),
      CodeScene: evaluateColor(generateMetricScore()),
      'Reporting Pipeline': evaluateColor(generateMetricScore()),
      'Pre-Production pipelines': evaluateColor(generateMetricScore()),
      'Foundation Pipelines': evaluateColor(generateMetricScore()),
    };
  };
  