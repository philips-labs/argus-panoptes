import { GoogleGenAI } from '@google/genai';
import { CommitsPerRepo, SummaryPerRepo } from './types';

/**
 * Core logic: Summarize commit messages by system using Gemini.
 * Accepts a Gemini AI client and pre-fetched commit message data.
 */
export async function generateSummaries(
  ai: GoogleGenAI,
  commitMessagesBySystem: Record<string, CommitsPerRepo[]>,
): Promise<Record<string, SummaryPerRepo[]>> {
  /**
   * Initializes an empty record with system as key and
   * a SummaryPerRepo list as value.
   */
  const summaries: Record<string, SummaryPerRepo[]> = {};

  /**
   * Goes through each pair of key and value objects of the
   * type system and repo list and generates a release note for
   * the repo.
   */
  for (const [system, repos] of Object.entries(commitMessagesBySystem)) {
    /**
     * Initializes an empty SummaryPerRepo list.
     */
    const summarizedRepos: SummaryPerRepo[] = [];

    /**
     * Goes through each pair of repo name and commit messages of
     * the repo list and generates the release note.
     */
    for (const { repoName, commitMessages } of repos) {
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
      try {
        const response = await ai.models.generateContent({
          model: 'gemini-2.0-flash',
          contents: prompt,
        });

        const summary = response?.text ?? 'No summary returned.';
        summarizedRepos.push({ repoName, summary });
      } catch (error) {
        console.error(`Error summarizing ${repoName} in ${system}:`, error);
      }
    }

    summaries[system] = summarizedRepos;
  }

  return summaries;
}
