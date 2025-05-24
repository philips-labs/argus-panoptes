import { generateSummaries } from './createAISummary';
import { CommitsPerRepo } from './types';

describe('generateSummaries', () => {
  /**
   * Mocks the generation of AI content.
   */
  const mockGenerateContent = jest.fn();
  /**
   * Mocks the AI model.
   */
  const mockAI = {
    models: {
      generateContent: mockGenerateContent,
    },
  };

  /**
   * Clears all mocks before each test.
   */
  beforeEach(() => {
    jest.clearAllMocks();
  });

  /**
   * Checks if the summaries created are grouped by system.
   */
  it('generates summaries grouped by system', async () => {
    /**
     * Mockes the generation of content.
     */
    mockGenerateContent
      .mockResolvedValueOnce({ text: 'Summary for repo1' })
      .mockResolvedValueOnce({ text: 'Summary for repo2' });

    /**
     * Mocks an input for the generateSummariesFromCommits
     * function.
     */
    const input: Record<string, CommitsPerRepo[]> = {
      'system-a': [
        { repoName: 'repo1', commitMessages: 'Fix bug A' },
        { repoName: 'repo2', commitMessages: 'Add feature B' },
      ],
    };

    /**
     * Get's the response of the generateSummariesFromCommits
     * function on the mock entities.
     */
    const result = await generateSummaries(mockAI as any, input);

    /**
     * Checks to see if the results the function is providing
     * are as expected.
     */
    expect(result).toEqual({
      'system-a': [
        { repoName: 'repo1', summary: 'Summary for repo1' },
        { repoName: 'repo2', summary: 'Summary for repo2' },
      ],
    });
  });

  /**
   * Checks if the generateSummariesFromCommits function falls
   * back to the defaule message in case Gemini gives no response.
   */
  it('falls back to default message if Gemini returns no text', async () => {
    mockGenerateContent.mockResolvedValue({ text: undefined });

    /**
     * Mocks an input for the generateSummariesFromCommits
     * function.
     */
    const input: Record<string, CommitsPerRepo[]> = {
      'system-x': [{ repoName: 'repoX', commitMessages: 'Refactor code' }],
    };

    /**
     * Get's the response of the generateSummariesFromCommits
     * function on the mock entities.
     */
    const result = await generateSummaries(mockAI as any, input);

    /**
     * Checks to see if the results the function is providing
     * are as expected.
     */
    expect(result).toEqual({
      'system-x': [{ repoName: 'repoX', summary: 'No summary returned.' }],
    });
  });

  /**
   * Checks if the generateSummariesFromCommits function
   * logs error and skips repo on exceptions.
   */
  it('logs error and skips repo on exception', async () => {
    const consoleErrorSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => {});
    mockGenerateContent.mockRejectedValue(new Error('AI failed'));

    /**
     * Mocks an input for the generateSummariesFromCommits
     * function.
     */
    const input: Record<string, CommitsPerRepo[]> = {
      'system-error': [{ repoName: 'repoErr', commitMessages: 'Some commit' }],
    };

    /**
     * Get's the response of the generateSummariesFromCommits
     * function on the mock entities.
     */
    const result = await generateSummaries(mockAI as any, input);

    /**
     * Checks to see if the results the function is providing
     * are as expected.
     */
    expect(result).toEqual({ 'system-error': [] });
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Error summarizing repoErr in system-error:',
      expect.any(Error),
    );

    consoleErrorSpy.mockRestore();
  });
});
