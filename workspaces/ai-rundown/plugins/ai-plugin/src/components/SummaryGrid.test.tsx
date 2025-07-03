/**
 * @jest-environment jsdom
 */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SummaryGrid } from './SummaryGrid';
import { SummaryCard } from './SummaryCard';

// Mock SummaryCard to simplify testing SummaryGrid only
jest.mock('./SummaryCard', () => ({
  SummaryCard: jest.fn(({ system, repos, repoSearch, handleDownload }) => (
    <div data-testid="summary-card" data-system={system}>
      <span>{system}</span>
      <button onClick={() => handleDownload(system)}>Download</button>
      <div>{repoSearch}</div>
      <ul>
        {repos.map(({ repoName }: { repoName: string }) => (
          <li key={repoName}>{repoName}</li>
        ))}
      </ul>
    </div>
  )),
}));

// Cast SummaryCard to a Jest mock function for TS
const MockedSummaryCard = SummaryCard as jest.MockedFunction<
  typeof SummaryCard
>;

describe('SummaryGrid', () => {
  const mockHandleDownload = jest.fn();

  const sampleMessages = {
    'System B': [
      { repoName: 'repoB1', summary: 'summary B1' },
      { repoName: 'repoB2', summary: 'summary B2' },
    ],
    'System A': [{ repoName: 'repoA1', summary: 'summary A1' }],
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders a SummaryCard for each system in filteredMessages', () => {
    render(
      <SummaryGrid
        filteredMessages={sampleMessages}
        repoSearch="searchText"
        handleDownload={mockHandleDownload}
      />,
    );

    const cards = screen.getAllByTestId('summary-card');
    expect(cards).toHaveLength(Object.keys(sampleMessages).length);
  });

  it('passes correct props to each SummaryCard', () => {
    render(
      <SummaryGrid
        filteredMessages={sampleMessages}
        repoSearch="searchText"
        handleDownload={mockHandleDownload}
      />,
    );

    expect(MockedSummaryCard).toHaveBeenCalledTimes(
      Object.keys(sampleMessages).length,
    );

    // Sorted order: System A, then System B
    expect(MockedSummaryCard.mock.calls[0][0].system).toBe('System A');
    expect(MockedSummaryCard.mock.calls[1][0].system).toBe('System B');

    expect(MockedSummaryCard.mock.calls[0][0].repos).toEqual(
      sampleMessages['System A'],
    );
    expect(MockedSummaryCard.mock.calls[1][0].repos).toEqual(
      sampleMessages['System B'],
    );

    expect(MockedSummaryCard.mock.calls[0][0].repoSearch).toBe('searchText');
    expect(MockedSummaryCard.mock.calls[1][0].repoSearch).toBe('searchText');

    expect(MockedSummaryCard.mock.calls[0][0].handleDownload).toBe(
      mockHandleDownload,
    );
  });

  it('calls handleDownload prop when a card download button is clicked', async () => {
    render(
      <SummaryGrid
        filteredMessages={sampleMessages}
        repoSearch=""
        handleDownload={mockHandleDownload}
      />,
    );

    const buttons = screen.getAllByRole('button', { name: /download/i });
    expect(buttons).toHaveLength(2);

    // Click first download button (System A)
    await userEvent.click(buttons[0]);
    expect(mockHandleDownload).toHaveBeenCalledWith('System A');

    // Click second download button (System B)
    await userEvent.click(buttons[1]);
    expect(mockHandleDownload).toHaveBeenCalledWith('System B');
  });
});
