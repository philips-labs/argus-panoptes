import { render, waitFor } from '@testing-library/react';
import { RepoFetchComponent } from './RepoFetchComponent';

// Mock the global fetch function
global.fetch = jest.fn();

describe('RepoFetchComponent', () => {
  // Setup console.error spy to test error handling
  // sconst originalConsoleError = console.error;
  // let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    // Reset mocks before each test
    jest.clearAllMocks();
    // consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  // afterEach(() => {
  //   // Restore console.error after each test
  //   consoleErrorSpy.mockRestore();
  // });

  // afterAll(() => {
  //   console.error = originalConsoleError;
  // });

  it('should fetch repos and call onData with simplified results', async () => {
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
    // Wait for the async function to complete
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

  it('should handle fetch errors', async () => {
    // Arrange
    const mockError = new Error('Network error');
    (global.fetch as jest.Mock).mockRejectedValue(mockError);

    const mockOnData = jest.fn();

    // Act
    render(<RepoFetchComponent onData={mockOnData} />);

    // Assert
    await waitFor(() => {
      // expect(consoleErrorSpy).toHaveBeenCalledWith(
      //   'Failed to fetch repos:',
      //   mockError,
      // );
      expect(mockOnData).not.toHaveBeenCalled();
    });
  });

  it('should handle JSON parsing errors', async () => {
    // Arrange
    const mockResponse = {
      ok: true,
      json: jest.fn().mockRejectedValue(new Error('Invalid JSON')),
    };

    (global.fetch as jest.Mock).mockResolvedValue(mockResponse);

    const mockOnData = jest.fn();

    // Act
    render(<RepoFetchComponent onData={mockOnData} />);

    // Assert
    await waitFor(() => {
      // expect(consoleErrorSpy).toHaveBeenCalled();
      expect(mockOnData).not.toHaveBeenCalled();
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

  it('should render nothing (return null)', () => {
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
