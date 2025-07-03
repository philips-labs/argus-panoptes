import { generateSummaries } from '../../utils/createAISummary';
import { CommitsPerRepo } from '../../utils/types';

describe('generateSummaries', () => {
  let mockFetch: jest.MockedFunction<typeof fetch>;

  /**
   * Sets up mocks before each test.
   */
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetch = jest.fn();
  });

  /**
   * Checks if the summaries created are grouped by system
   * and correctly returned from mocked AI responses.
   */
  it('generates summaries grouped by system', async () => {
    /**
     * Mocks two successful AI responses for two repos.
     * Updated to match the actual API response structure that the implementation expects.
     */
    mockFetch
      .mockResolvedValueOnce({
        json: async () => ({
          candidates: [
            {
              content: {
                parts: [{ text: 'Summary for repo1' }],
              },
            },
          ],
        }),
      } as Response)
      .mockResolvedValueOnce({
        json: async () => ({
          candidates: [
            {
              content: {
                parts: [{ text: 'Summary for repo2' }],
              },
            },
          ],
        }),
      } as Response);

    /**
     * Mocks an input for the generateSummaries function.
     */
    const input: Record<string, CommitsPerRepo[]> = {
      'system-a': [
        { repoName: 'repo1', commitMessages: 'Fix bug A' },
        { repoName: 'repo2', commitMessages: 'Add feature B' },
      ],
    };

    /**
     * Gets the response of the generateSummaries function on the mock input.
     * Updated to pass all required parameters: commitMessagesBySystem, apiBaseUrl, and fetchFn.
     */
    const result = await generateSummaries(input, 'http://test-api', mockFetch);

    /**
     * Checks to see if the results the function is providing are as expected.
     */
    expect(result).toEqual({
      'system-a': [
        { repoName: 'repo1', summary: 'Summary for repo1' },
        { repoName: 'repo2', summary: 'Summary for repo2' },
      ],
    });

    /**
     * Verifies that fetch was called with correct parameters.
     */
    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(mockFetch).toHaveBeenCalledWith('http://test-api/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: expect.stringContaining('Fix bug A'),
    });
  });

  /**
   * Checks if the generateSummaries function falls
   * back to the default message in case the AI API gives no usable response.
   */
  it('falls back to default message if API returns no content', async () => {
    /**
     * Mocks a response where content is undefined.
     * Updated to match the actual API response structure.
     */
    mockFetch.mockResolvedValueOnce({
      json: async () => ({
        candidates: [
          {
            content: {
              parts: [{ text: undefined }],
            },
          },
        ],
      }),
    } as Response);

    /**
     * Mocks an input for the generateSummaries function.
     */
    const input: Record<string, CommitsPerRepo[]> = {
      'system-x': [{ repoName: 'repoX', commitMessages: 'Refactor code' }],
    };

    /**
     * Gets the response of the generateSummaries function on the mock input.
     */
    const result = await generateSummaries(input, 'http://test-api', mockFetch);

    /**
     * Checks to see if the fallback message is used correctly.
     */
    expect(result).toEqual({
      'system-x': [{ repoName: 'repoX', summary: 'No summary returned.' }],
    });
  });

  /**
   * Checks if the generateSummaries function falls back when API returns empty response.
   */
  it('falls back to default message if API returns empty candidates', async () => {
    /**
     * Mocks a response with empty candidates array.
     */
    mockFetch.mockResolvedValueOnce({
      json: async () => ({
        candidates: [],
      }),
    } as Response);

    const input: Record<string, CommitsPerRepo[]> = {
      'system-y': [
        { repoName: 'repoY', commitMessages: 'Update dependencies' },
      ],
    };

    const result = await generateSummaries(input, 'http://test-api', mockFetch);

    expect(result).toEqual({
      'system-y': [{ repoName: 'repoY', summary: 'No summary returned.' }],
    });
  });

  /**
   * Checks if the generateSummaries function throws an error
   * when an exception occurs (e.g., network failure).
   * Since the implementation doesn't have error handling, it should throw.
   */
  it('throws error on network failure', async () => {
    /**
     * Mocks a rejected fetch to simulate network/API failure.
     */
    mockFetch.mockRejectedValueOnce(new Error('Network error'));

    /**
     * Mocks an input for the generateSummaries function.
     */
    const input: Record<string, CommitsPerRepo[]> = {
      'system-error': [{ repoName: 'repoErr', commitMessages: 'Some commit' }],
    };

    /**
     * Expects the function to throw an error since there's no error handling.
     */
    await expect(
      generateSummaries(input, 'http://test-api', mockFetch),
    ).rejects.toThrow('Network error');
  });

  /**
   * Checks if the function throws error when API call fails.
   * Since the implementation doesn't handle errors, it should throw on the first failure.
   */
  it('throws error on API failure', async () => {
    /**
     * Mock successful response for first repo, then simulate API failure.
     */
    mockFetch
      .mockResolvedValueOnce({
        json: async () => ({
          candidates: [
            {
              content: {
                parts: [{ text: 'Success summary' }],
              },
            },
          ],
        }),
      } as Response)
      .mockRejectedValueOnce(new Error('API failure'));

    const input: Record<string, CommitsPerRepo[]> = {
      'system-success': [
        { repoName: 'repo-success', commitMessages: 'Working changes' },
      ],
      'system-fail': [
        { repoName: 'repo-fail', commitMessages: 'Broken changes' },
      ],
    };

    /**
     * The function should throw when it hits the API failure on the second repo.
     */
    await expect(
      generateSummaries(input, 'http://test-api', mockFetch),
    ).rejects.toThrow('API failure');
  });
});
