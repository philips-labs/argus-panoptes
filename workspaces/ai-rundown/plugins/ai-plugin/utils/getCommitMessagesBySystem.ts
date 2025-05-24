import { TechInsightsApi } from '@backstage/plugin-tech-insights';
import { CompoundEntityRef } from '@backstage/catalog-model';
import { CommitsPerRepo } from './types';

/**
 * Receives a record of all compound entity refs of a certain system,
 * finds the commit messages for these refs and returns a dictionary
 * with system as the key and an CommitPerRepo list as the value.
 */
export async function getCommitMessagesBySystem(
  techInsightsApi: TechInsightsApi,
  systemToEntityRefs: Record<string, CompoundEntityRef[]>,
): Promise<Record<string, CommitsPerRepo[]>> {
  /**
   * Creates an empty result object.
   */
  const result: Record<string, CommitsPerRepo[]> = {};

  /**
   * Goes through each pair of key and value objects of the
   * type system and entity ref list and gets all the commit messages
   * by means of computind a CommitsPerRepo list
   */
  for (const [system, entityRefs] of Object.entries(systemToEntityRefs)) {
    /**
     * Initializes an empty CommitsPerRepo list.
     */
    const allCommitMessages: CommitsPerRepo[] = [];

    /**
     * Goes through each entity ref in the entity ref list of
     * a certain system and gets the recent commits of that
     * entity ref.
     */
    for (const entityRef of entityRefs) {
      /**
       * Uses the techInsightsApi to retrieve the data saved under
       * id github-commit-message-retriever.
       */
      try {
        const facts = await techInsightsApi.getFacts(entityRef, [
          'github-commit-message-retriever',
        ]);

        /**
         * If no facts are stored on a certain entity ref
         * then no further action is needed and the program breaks.
         */
        if (!facts) break;

        /**
         * The JSON object retrieve is unpacked so that the recent
         * commit messages can be extracted.
         */
        const retriever = facts['github-commit-message-retriever'];
        const factsForEntity = retriever?.facts;
        const recentCommitMessages = factsForEntity?.recent_commit_messages;

        /**
         * If the recent commit messages are not undefines, the allCommitMessages
         * list is being populated with a new object of the type
         * CommitsPerRepo.
         */
        if (typeof recentCommitMessages === 'string') {
          allCommitMessages.push({
            repoName: entityRef.name,
            commitMessages: recentCommitMessages,
          });
        } else {
          console.debug(`No commit messages found for ${entityRef.name}`);
        }
      } catch (error) {
        console.error(`Failed to retrieve facts for ${entityRef.name}:`, error);
      }
    }

    /**
     * The created allCommitMessages list is added under the system
     * key in the dictionary to be returned.
     */
    result[system] = allCommitMessages;
  }

  return result;
}
