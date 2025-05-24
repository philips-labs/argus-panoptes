import { getCommitMessagesBySystem } from './getCommitMessagesBySystem';
import { TechInsightsApi } from '@backstage/plugin-tech-insights';
import { CompoundEntityRef } from '@backstage/catalog-model';

describe('getCommitMessagesBySystem', () => {
  /**
   * Creates a mock TechInsightsApi to be used in testing the
   * getCommitMessagesBySystemFromEntityRefs function.
   */
  const mockTechInsightsApi = {
    getFacts: jest.fn(),
  } as unknown as TechInsightsApi;

  /**
   * Creates mock entity refs to be used in testing the
   * getCommitMessagesBySystemFromEntityRefs function.
   */
  const mockEntityRefs: Record<string, CompoundEntityRef[]> = {
    'system-a': [
      { name: 'repo1', namespace: 'default', kind: 'Component' },
      { name: 'repo2', namespace: 'default', kind: 'Component' },
    ],
    'system-b': [{ name: 'repo3', namespace: 'default', kind: 'Component' }],
  };

  /**
   * Before each test, the mocks are being cleared.
   */
  beforeEach(() => {
    jest.clearAllMocks();
  });

  /**
   * Checks if the commit messages are correctly grouped by system.
   */
  it('returns commit messages grouped by system', async () => {
    /**
     * Uses the mock techInsightsApi to get a response like structure
     * that can be later used on the getCommitMessagesBySystemFromEntityRefs
     * function.
     */
    mockTechInsightsApi.getFacts = jest
      .fn()
      .mockResolvedValueOnce({
        'github-commit-message-retriever': {
          facts: { recent_commit_messages: 'Commit A' },
        },
      })
      .mockResolvedValueOnce({
        'github-commit-message-retriever': {
          facts: { recent_commit_messages: 'Commit B' },
        },
      })
      .mockResolvedValueOnce({
        'github-commit-message-retriever': {
          facts: { recent_commit_messages: 'Commit C' },
        },
      });

    /**
     * The getCommitMessagesBySystemFromEntityRefs function is being
     * called using the mockTechInsightsApi as well as mockEntityRefs
     * and the result is being stored.
     */
    const result = await getCommitMessagesBySystem(
      mockTechInsightsApi,
      mockEntityRefs,
    );

    /**
     * Checks to see if the results the function is providing
     * are as expected.
     */
    expect(result).toEqual({
      'system-a': [
        { repoName: 'repo1', commitMessages: 'Commit A' },
        { repoName: 'repo2', commitMessages: 'Commit B' },
      ],
      'system-b': [{ repoName: 'repo3', commitMessages: 'Commit C' }],
    });
  });

  /**
   * Checks to see if the getCommitMessagesBySystemFromEntityRefs
   * function skips non-string commit messages.
   */
  it('skips non-string commit messages', async () => {
    /**
     * Uses the mock techInsightsApi to get a response like structure
     * that has no recent commits and that can be later used on the
     * getCommitMessagesBySystemFromEntityRefs function.
     */
    mockTechInsightsApi.getFacts = jest.fn().mockResolvedValue({
      'github-commit-message-retriever': {
        facts: { recent_commit_messages: null },
      },
    });

    /**
     * The getCommitMessagesBySystemFromEntityRefs function is being
     * called using the mockTechInsightsApi as well as mockEntityRefs
     * and the result is being stored.
     */
    const result = await getCommitMessagesBySystem(mockTechInsightsApi, {
      'system-x': [{ name: 'repoX', namespace: 'default', kind: 'Component' }],
    });

    /**
     * Checks to see if the results the function is providing
     * are as expected.
     */
    expect(result).toEqual({ 'system-x': [] });
  });

  /**
   * Checks to see if the getCommitMessagesBySystemFromEntityRefs
   * function logs error and continues on fetch failure.
   */
  it('logs error and continues on fetch failure', async () => {
    const consoleErrorSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    /**
     * Uses the mock techInsightsApi to get a response like structure
     * that throws an error because it failed to fetch facts and that
     * can be later used on the getCommitMessagesBySystemFromEntityRefs
     * function.
     */
    mockTechInsightsApi.getFacts = jest
      .fn()
      .mockRejectedValue(new Error('Failed to fetch facts'));

    /**
     * The getCommitMessagesBySystemFromEntityRefs function is being
     * called using the mockTechInsightsApi as well as mockEntityRefs
     * and the result is being stored.
     */
    const result = await getCommitMessagesBySystem(mockTechInsightsApi, {
      'system-y': [{ name: 'repoY', namespace: 'default', kind: 'Component' }],
    });

    /**
     * Checks to see if the results the function is providing
     * are as expected.
     */
    expect(result).toEqual({ 'system-y': [] });

    /**
     * Checks to see if the error cought by the method
     * is as expected.
     */
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Failed to retrieve facts for repoY:',
      expect.any(Error),
    );

    consoleErrorSpy.mockRestore();
  });

  /**
   * Checks to see if the getCommitMessagesBySystemFromEntityRefs
   * function skips if facts are undefined.
   */
  it('skips if facts are undefined', async () => {
    /**
     * Uses the mock techInsightsApi to get a response like structure
     * that is undefined and that can be later used on the
     * getCommitMessagesBySystemFromEntityRefs function.
     */
    mockTechInsightsApi.getFacts = jest.fn().mockResolvedValue(undefined);

    /**
     * The getCommitMessagesBySystemFromEntityRefs function is being
     * called using the mockTechInsightsApi as well as mockEntityRefs
     * and the result is being stored.
     */
    const result = await getCommitMessagesBySystem(mockTechInsightsApi, {
      'system-z': [{ name: 'repoZ', namespace: 'default', kind: 'Component' }],
    });

    /**
     * Checks to see if the results the function is providing
     * are as expected.
     */
    expect(result).toEqual({ 'system-z': [] });
  });
});
