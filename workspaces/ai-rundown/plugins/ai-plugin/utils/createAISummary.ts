/**
 * AI-powered Git Commit Summary Generator
 *
 * This module generates structured summaries of git commit messages using AI.
 * It processes commits grouped by system and repository, sending them to an AI service
 * that returns categorized summaries of the changes.
 */
import { CommitsPerRepo, SummaryPerRepo } from './types';

/**
 * Generates structured summaries of commit messages using an AI service
 *
 * @param commitMessagesBySystem - Object mapping system names to arrays of repositories with their commit messages
 * @param apiBaseUrl - Base URL of the AI service API endpoint
 * @param fetchFn - Fetch function to use for API calls (allows for dependency injection and testing)
 * @returns Promise resolving to an object mapping system names to arrays of repository summaries
 */
export async function generateSummaries(
  commitMessagesBySystem: Record<string, CommitsPerRepo[]>,
  apiBaseUrl: string,
  fetchFn: typeof fetch,
): Promise<Record<string, SummaryPerRepo[]>> {
  // Initialize results object to store summaries by system
  const summaries: Record<string, SummaryPerRepo[]> = {};

  // Process each system and its repositories
  for (const [system, repos] of Object.entries(commitMessagesBySystem)) {
    // Array to collect summarized repositories for the current system
    const summarizedRepos: SummaryPerRepo[] = [];

    // Process each repository in the system
    for (const { repoName, commitMessages } of repos) {
      // Construct the AI prompt with instructions for summarizing the commit messages
      const prompt = `Summarize the following git commit messages:\n\n${commitMessages}. 
        Your response MUST follow the format: 
        New functionality 
        * Functionality 1
        * Functionality 2
        Improvements
        * Improvement 1
        * Improvement 2
        Bug fixes
        * Bug fix 1
        * Bug fix 2
        Breaking changes
        * Breaking change 1
        * Breaking change 2
        Write N/A if not applicable.
        Write in a concise and clear manner.
        Write in a list format.
        You must not add empty lines.
        Only use stars for the content of each section, not the section name itself.
        Write in a professional tone. Write just the summary. You must follow the format exactly. Do not add any other information.
        Do not write the commit messages again. I want the summary only.`;

      // Call the AI service API with the prompt
      const response = await fetchFn(`${apiBaseUrl}/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ prompt }),
      });

      // Parse the API response
      const data = await response.json();

      // Extract the summary text from the AI response or use a fallback message
      // The path data?.candidates?.[0]?.content?.parts?.[0]?.text navigates through the expected response structure
      const summary =
        data?.candidates?.[0]?.content?.parts?.[0]?.text ??
        'No summary returned.';

      // Add the repository name and its summary to the results array
      summarizedRepos.push({ repoName, summary });
    }

    // Store all summarized repositories for the current system
    summaries[system] = summarizedRepos;
  }

  // Return the complete mapping of systems to their repository summaries
  return summaries;
}
