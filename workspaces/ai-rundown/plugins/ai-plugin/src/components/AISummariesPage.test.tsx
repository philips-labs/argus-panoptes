/**
 * @jest-environment jsdom
 */
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AISummaries } from './AISummariesPage';
import { TestApiProvider } from '@backstage/test-utils';
import { catalogApiRef } from '@backstage/plugin-catalog-react';
import { techInsightsApiRef } from '@backstage/plugin-tech-insights';
import { discoveryApiRef, fetchApiRef } from '@backstage/core-plugin-api';
import { generateSummaries } from '../../utils/createAISummary';
import { postSummaries } from '../../utils/saveToDatabase';
import { getCommitMessagesBySystem } from '../../utils/getCommitMessagesBySystem';

// Mock the utility functions to isolate the component's logic
jest.mock('../../utils/createAISummary', () => ({
  generateSummaries: jest.fn(),
}));
jest.mock('../../utils/saveToDatabase', () => ({
  postSummaries: jest.fn(),
}));
jest.mock('../../utils/getCommitMessagesBySystem', () => ({
  getCommitMessagesBySystem: jest.fn(),
}));

// A single, unified mock fetch function for all tests.
const mockFetch = jest.fn();

const mockCatalogApi = {
  getEntities: jest.fn(),
};

const mockTechInsightsApi = {};

const mockDiscoveryApi = {
  getBaseUrl: jest
    .fn()
    .mockResolvedValue('http://localhost:7007/api/ai-plugin'),
};

const renderComponent = () =>
  render(
    <TestApiProvider
      apis={[
        [catalogApiRef, mockCatalogApi],
        [techInsightsApiRef, mockTechInsightsApi],
        [discoveryApiRef, mockDiscoveryApi],
        [fetchApiRef, { fetch: mockFetch }],
      ]}
    >
      <AISummaries />
    </TestApiProvider>,
  );

describe('AISummaries', () => {
  beforeEach(() => {
    // Clear all mocks before each test.
    jest.clearAllMocks();
    // Reset mocks to a default successful state for most tests.
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        system1: [{ repoName: 'repo-a', summary: 'Summary A' }],
        system2: [],
      }),
    });
    mockCatalogApi.getEntities.mockResolvedValue({
      items: [
        { metadata: { name: 'system1' } },
        { metadata: { name: 'system2' } },
      ],
    });
    (generateSummaries as jest.Mock).mockResolvedValue({
      system1: [{ repoName: 'repo-new', summary: 'New Summary' }],
    });
    (postSummaries as jest.Mock).mockResolvedValue(undefined);
    (getCommitMessagesBySystem as jest.Mock).mockResolvedValue({});
  });

  it('renders loading spinner initially and fetches data', async () => {
    renderComponent();
    expect(screen.getByText(/Loading release notes/i)).toBeInTheDocument();
    // Assert that the fetch function was called on initial render.
    await waitFor(() => expect(mockFetch).toHaveBeenCalled());
  });

  it('displays fetched summaries correctly', async () => {
    renderComponent();
    // Wait for the data to be loaded and displayed.
    await waitFor(() => {
      expect(screen.getByText('repo-a')).toBeInTheDocument();
      expect(screen.getByText('Summary A')).toBeInTheDocument();
    });
  });

  it('filters systems correctly via dropdown', async () => {
    renderComponent();
    await screen.findByText('repo-a');

    const systemFilter = screen.getByRole('combobox', { name: /System/i });
    await userEvent.click(systemFilter);

    const option = await screen.findByRole('option', { name: 'system2' });
    await userEvent.click(option);

    // After filtering, system1 should be gone and the "no releases" message for system2 should appear.
    await waitFor(() => {
      expect(screen.queryByText('repo-a')).not.toBeInTheDocument();
      expect(screen.getByText('No new releases.')).toBeInTheDocument();
    });
  });

  it('calls callAI when refresh is clicked', async () => {
    renderComponent();
    const refreshBtn = await screen.findByLabelText('refresh');
    await userEvent.click(refreshBtn);
    // The refresh button should trigger the AI generation function.
    await waitFor(() => expect(generateSummaries).toHaveBeenCalled());
  });

  it('falls back to generating new summaries if fetching fails', async () => {
    // Arrange: Mock fetch to fail, and AI generation to succeed with specific data.
    mockFetch.mockResolvedValue({ ok: false });
    (generateSummaries as jest.Mock).mockResolvedValue({
      system1: [{ repoName: 'repo-fallback', summary: 'Fallback Summary' }],
    });

    // Act
    renderComponent();

    // Assert: Wait for the fallback data to be displayed, not an error message.
    await waitFor(() => {
      expect(screen.getByText('repo-fallback')).toBeInTheDocument();
      expect(screen.getByText('Fallback Summary')).toBeInTheDocument();
    });

    // And assert that the fallback mechanism was indeed triggered.
    expect(generateSummaries).toHaveBeenCalled();
  });

  it('displays an error message if AI generation fails', async () => {
    // This fetch will return no data, triggering callAI.
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({}),
    });
    // Mock generateSummaries to simulate a failure.
    (generateSummaries as jest.Mock).mockRejectedValue(new Error('AI failed'));

    renderComponent();

    await waitFor(() => {
      expect(
        screen.getByText('Failed to generate AI summaries. Please try again.'),
      ).toBeInTheDocument();
    });
  });

  it('triggers AI generation if initial fetch returns no summaries', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ system1: [], system2: [] }),
    });
    renderComponent();

    await waitFor(() => {
      expect(generateSummaries).toHaveBeenCalled();
    });
  });

  it('ensures all systems from catalog are present in the filter', async () => {
    // Catalog returns system3, but fetch only returns system1 and system2.
    mockCatalogApi.getEntities.mockResolvedValue({
      items: [
        { metadata: { name: 'system1' } },
        { metadata: { name: 'system2' } },
        { metadata: { name: 'system3' } },
      ],
    });

    renderComponent();
    await waitFor(() => expect(screen.getByText('repo-a')).toBeInTheDocument());

    const systemFilter = screen.getByRole('combobox', { name: /System/i });
    await userEvent.click(systemFilter);

    // Check that all systems, including the one not in the fetch response, are options.
    expect(
      await screen.findByRole('option', { name: 'All' }),
    ).toBeInTheDocument();
    expect(
      await screen.findByRole('option', { name: 'system1' }),
    ).toBeInTheDocument();
    expect(
      await screen.findByRole('option', { name: 'system2' }),
    ).toBeInTheDocument();
    expect(
      await screen.findByRole('option', { name: 'system3' }),
    ).toBeInTheDocument();
  });
});
