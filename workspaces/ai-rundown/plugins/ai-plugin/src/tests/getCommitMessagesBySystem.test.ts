import { getCommitMessagesBySystem } from '../../utils/getCommitMessagesBySystem';
import { TechInsightsApi } from '@backstage/plugin-tech-insights';
import { CompoundEntityRef } from '@backstage/catalog-model';

describe('getCommitMessagesBySystem', () => {
  /**
   * Creates a mock TechInsightsApi to be used in testing the
   * getCommitMessagesBySystem function.
   */
  const mockTechInsightsApi = {
    getFacts: jest.fn(),
  } as unknown as TechInsightsApi;

  /**
   * Creates mock entity refs to be used in testing the
   * getCommitMessagesBySystem function.
   */
  const mockEntityRefs: Record<string, CompoundEntityRef[]> = {
    'system-a': [
      { name: 'repo1', namespace: 'default', kind: 'Component' },
      { name: 'repo2', namespace: 'default', kind: 'Component' },
    ],
    'system-b': [{ name: 'repo3', namespace: 'default', kind: 'Component' }],
  };

  /**
   * Helper function to get today's ISO timestamp for testing
   */
  const getTodayTimestamp = () => {
    return new Date().toISOString();
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
    const todayTimestamp = getTodayTimestamp();

    /**
     * Uses the mock techInsightsApi to get a response like structure
     * that can be later used on the getCommitMessagesBySystem function.
     * Updated to include timestamp that matches today's date.
     */
    mockTechInsightsApi.getFacts = jest
      .fn()
      .mockResolvedValueOnce({
        'github-commit-message-retriever': {
          facts: { recent_commit_messages: 'Commit A' },
          timestamp: todayTimestamp,
        },
      })
      .mockResolvedValueOnce({
        'github-commit-message-retriever': {
          facts: { recent_commit_messages: 'Commit B' },
          timestamp: todayTimestamp,
        },
      })
      .mockResolvedValueOnce({
        'github-commit-message-retriever': {
          facts: { recent_commit_messages: 'Commit C' },
          timestamp: todayTimestamp,
        },
      });

    /**
     * The getCommitMessagesBySystem function is being
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
   * Checks to see if the getCommitMessagesBySystem
   * function skips non-string commit messages.
   */
  it('skips non-string commit messages', async () => {
    const todayTimestamp = getTodayTimestamp();

    /**
     * Uses the mock techInsightsApi to get a response like structure
     * that has no recent commits and that can be later used on the
     * getCommitMessagesBySystem function.
     */
    mockTechInsightsApi.getFacts = jest.fn().mockResolvedValue({
      'github-commit-message-retriever': {
        facts: { recent_commit_messages: null },
        timestamp: todayTimestamp,
      },
    });

    /**
     * The getCommitMessagesBySystem function is being
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
   * Checks to see if the getCommitMessagesBySystem
   * function throws error on fetch failure.
   * Since the implementation doesn't have error handling, it should throw.
   */
  it('throws error on fetch failure', async () => {
    /**
     * Uses the mock techInsightsApi to get a response like structure
     * that throws an error because it failed to fetch facts and that
     * can be later used on the getCommitMessagesBySystem function.
     */
    mockTechInsightsApi.getFacts = jest
      .fn()
      .mockRejectedValue(new Error('Failed to fetch facts'));

    /**
     * The getCommitMessagesBySystem function is being
     * called using the mockTechInsightsApi as well as mockEntityRefs
     * and the result is being stored.
     */
    await expect(
      getCommitMessagesBySystem(mockTechInsightsApi, {
        'system-y': [
          { name: 'repoY', namespace: 'default', kind: 'Component' },
        ],
      }),
    ).rejects.toThrow('Failed to fetch facts');
  });

  /**
   * Checks to see if the getCommitMessagesBySystem
   * function skips if facts are undefined.
   */
  it('skips if facts are undefined', async () => {
    /**
     * Uses the mock techInsightsApi to get a response like structure
     * that is undefined and that can be later used on the
     * getCommitMessagesBySystem function.
     */
    mockTechInsightsApi.getFacts = jest.fn().mockResolvedValue(undefined);

    /**
     * The getCommitMessagesBySystem function is being
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

  /**
   * Checks if commits from yesterday are filtered out.
   */
  it('skips commits that are not from today', async () => {
    const yesterdayTimestamp = new Date(
      Date.now() - 24 * 60 * 60 * 1000,
    ).toISOString();

    /**
     * Uses the mock techInsightsApi to return commit messages with yesterday's timestamp.
     */
    mockTechInsightsApi.getFacts = jest.fn().mockResolvedValue({
      'github-commit-message-retriever': {
        facts: { recent_commit_messages: 'Yesterday commit' },
        timestamp: yesterdayTimestamp,
      },
    });

    const result = await getCommitMessagesBySystem(mockTechInsightsApi, {
      'system-old': [
        { name: 'repoOld', namespace: 'default', kind: 'Component' },
      ],
    });

    /**
     * Should return empty array since the timestamp is not from today.
     */
    expect(result).toEqual({ 'system-old': [] });
  });

  /**
   * Checks if missing timestamp causes commits to be skipped.
   */
  it('skips commits when timestamp is missing', async () => {
    /**
     * Uses the mock techInsightsApi to return commit messages without timestamp.
     */
    mockTechInsightsApi.getFacts = jest.fn().mockResolvedValue({
      'github-commit-message-retriever': {
        facts: { recent_commit_messages: 'Commit without timestamp' },
        // timestamp is missing
      },
    });

    const result = await getCommitMessagesBySystem(mockTechInsightsApi, {
      'system-no-time': [
        { name: 'repoNoTime', namespace: 'default', kind: 'Component' },
      ],
    });

    /**
     * Should return empty array since timestamp is missing.
     */
    expect(result).toEqual({ 'system-no-time': [] });
  });
});
