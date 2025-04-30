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
  const bugCount = data.workItems.length;

  console.log("Azure DevOps bug count:", bugCount);

  return bugCount;
}