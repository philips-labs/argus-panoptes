/**
 * @jest-environment jsdom
 */
import { render, screen, fireEvent } from '@testing-library/react';
import { SummaryCard } from './SummaryCard';

const mockRepos = [
  { repoName: 'Repo One', summary: 'Summary one' },
  { repoName: 'Repo Two', summary: 'Summary two' },
];

describe('SummaryCard', () => {
  const system = 'System A';
  const handleDownload = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders system title', () => {
    render(
      <SummaryCard
        system={system}
        repos={mockRepos}
        repoSearch=""
        handleDownload={handleDownload}
      />,
    );
    expect(screen.getByRole('heading', { level: 4 })).toHaveTextContent(system);
  });

  it('filters repos based on repoSearch', () => {
    render(
      <SummaryCard
        system={system}
        repos={mockRepos}
        repoSearch="One"
        handleDownload={handleDownload}
      />,
    );

    expect(screen.getByText('Repo One')).toBeInTheDocument();
    expect(screen.queryByText('Repo Two')).not.toBeInTheDocument();
  });

  it('displays "No new releases." when no repos match filter', () => {
    render(
      <SummaryCard
        system={system}
        repos={mockRepos}
        repoSearch="Nonexistent"
        handleDownload={handleDownload}
      />,
    );

    expect(screen.getByText(/no new releases/i)).toBeInTheDocument();
  });

  it('calls handleDownload with system when download button is clicked', () => {
    render(
      <SummaryCard
        system={system}
        repos={mockRepos}
        repoSearch=""
        handleDownload={handleDownload}
      />,
    );

    const downloadButton = screen.getByRole('button', { name: /download/i });
    fireEvent.click(downloadButton);

    expect(handleDownload).toHaveBeenCalledTimes(1);
    expect(handleDownload).toHaveBeenCalledWith(system);
  });

  it('renders summaries of filtered repos', () => {
    render(
      <SummaryCard
        system={system}
        repos={mockRepos}
        repoSearch=""
        handleDownload={handleDownload}
      />,
    );

    mockRepos.forEach(({ repoName, summary }) => {
      expect(screen.getByText(repoName)).toBeInTheDocument();
      expect(screen.getByText(summary)).toBeInTheDocument();
    });
  });
});
