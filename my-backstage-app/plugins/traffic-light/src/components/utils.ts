export async function getAzureDevOpsBugs() {
  const organization = "argus-panoptes-dev";
  const project = "repo_2";
  const queryId = "b2fdb928-a73e-4cba-82c9-e605a194666d";
  const pat = "9APDLq54nbzmerzTCuD50qLNWFHSprSivK7Q6zTuvqqP3PNMFPW0JQQJ99BDACAAAAAAAAAAAAASAZDOrt3M";

  const encodedPat = btoa(":" + pat);

  const response = await fetch(`https://dev.azure.com/${organization}/${project}/_apis/wit/wiql/${queryId}?api-version=7.0`, {
    method: "GET",
    headers: {
      "Authorization": `Basic ${encodedPat}`,
      "Accept": "application/json"
    }
  });

  const data = await response.json();

  // Save bug count in a variable
  const bugs = data.workItems;
  const bugCount = bugs.length;

  console.log("Azure DevOps bugs:", bugs);

  return bugCount;
}

export async function getGitHubRepoStatus(repoName: string) {
  const token = "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"; 
  //const token = ${GITHUB_TOKEN};

  // GitHub API URL for the repository status
  const apiUrl = `https://api.github.com/repos/philips-labs/${repoName}/actions/runs?main`;

  // GET request to GitHub API
  const response = await fetch(apiUrl, {
    method: "GET",
    headers: {
      "Authorization": `token ${token}`,
      "Accept": "application/json"
    }
  });

  if (!response.ok) {
    console.error("Failed to fetch data from GitHub:", response.statusText);
    return;
  }
  const data = await response.json();

  // for the latest run
  const latestRun = data.workflow_runs?.[0];

  if (!latestRun) {
      console.warn("No workflow runs found on the 'main' branch");
      return "no_runs";
  }

  if (latestRun.status === "completed") {
      switch (latestRun.conclusion) {
        case "success":
          return "green";
        case "failure":
        case "timed_out":
        case "cancelled":
        case "neutral":
          return "red"; // Return red for failure or any other negative conclusion
        default:
          return "yellow"; // If we encounter an unknown conclusion state
      }
    } else {
      console.log(" Workflow is still in progress or queued.");
      return "yellow"; // Default to yellow if the workflow is not completed yet
    }
  }