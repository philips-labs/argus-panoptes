import { render, waitFor } from '@testing-library/react';
import { RepoFetchComponent } from './RepoFetchComponent';

// Mock the global fetch function
global.fetch = jest.fn();

describe('RepoFetchComponent', () => {
  beforeEach(() => {
    // Reset mocks before each test
    jest.clearAllMocks();
  });

  it('should fetch repos and call onData', async () => {
    // Arrange
    const mockReposData = [
      { name: 'repo1', description: 'Description for repo1' },
      { name: 'repo2', description: null },
      { name: 'repo3', description: 'Description for repo3' },
    ];

    const mockResponse = {
      ok: true,
      json: jest.fn().mockResolvedValue(mockReposData),
    };

    (global.fetch as jest.Mock).mockResolvedValue(mockResponse);

    const mockOnData = jest.fn();

    // Act
    render(<RepoFetchComponent onData={mockOnData} />);

    // Assert
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.github.com/orgs/philips-labs/repos',
      );

      expect(mockOnData).toHaveBeenCalledWith([
        { name: 'repo1', description: 'Description for repo1' },
        { name: 'repo2', description: 'No description' },
        { name: 'repo3', description: 'Description for repo3' },
      ]);
    });
  });

  it('should handle empty response data', async () => {
    // Arrange
    const mockResponse = {
      ok: true,
      json: jest.fn().mockResolvedValue([]),
    };

    (global.fetch as jest.Mock).mockResolvedValue(mockResponse);

    const mockOnData = jest.fn();

    // Act
    render(<RepoFetchComponent onData={mockOnData} />);

    // Assert
    await waitFor(() => {
      expect(mockOnData).toHaveBeenCalledWith([]);
    });
  });

  it('should handle repos with various description values', async () => {
    // Arrange
    const mockReposData = [
      { name: 'repo1', description: 'Valid description' },
      { name: 'repo2', description: null },
      { name: 'repo3', description: undefined },
      { name: 'repo4', description: '' },
      { name: 'repo5' }, // missing description property
    ];

    const mockResponse = {
      ok: true,
      json: jest.fn().mockResolvedValue(mockReposData),
    };

    (global.fetch as jest.Mock).mockResolvedValue(mockResponse);

    const mockOnData = jest.fn();

    // Act
    render(<RepoFetchComponent onData={mockOnData} />);

    // Assert
    await waitFor(() => {
      expect(mockOnData).toHaveBeenCalledWith([
        { name: 'repo1', description: 'Valid description' },
        { name: 'repo2', description: 'No description' },
        { name: 'repo3', description: 'No description' },
        { name: 'repo4', description: '' }, // Empty string is truthy, so it stays
        { name: 'repo5', description: 'No description' },
      ]);
    });
  });

  it('should re-fetch when onData prop changes', async () => {
    // Arrange
    const mockReposData = [{ name: 'repo1', description: 'test' }];
    const mockResponse = {
      ok: true,
      json: jest.fn().mockResolvedValue(mockReposData),
    };

    (global.fetch as jest.Mock).mockResolvedValue(mockResponse);

    const mockOnData1 = jest.fn();
    const mockOnData2 = jest.fn();

    // Act
    const { rerender } = render(<RepoFetchComponent onData={mockOnData1} />);

    // Wait for the first fetch to complete
    await waitFor(() => {
      expect(mockOnData1).toHaveBeenCalledTimes(1);
    });

    // Clear mocks and rerender with new onData prop
    jest.clearAllMocks();
    rerender(<RepoFetchComponent onData={mockOnData2} />);

    // Assert
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(1);
      expect(mockOnData2).toHaveBeenCalledTimes(1);
      expect(mockOnData1).not.toHaveBeenCalled(); // The old callback shouldn't be called
    });
  });

  it('should render nothing', () => {
    // Arrange
    const mockResponse = {
      ok: true,
      json: jest.fn().mockResolvedValue([]),
    };
    (global.fetch as jest.Mock).mockResolvedValue(mockResponse);

    // Act
    const { container } = render(<RepoFetchComponent onData={jest.fn()} />);

    // Assert
    expect(container.firstChild).toBeNull();
  });
});
